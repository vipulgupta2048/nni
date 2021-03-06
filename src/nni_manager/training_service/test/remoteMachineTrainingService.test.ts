/**
 * Copyright (c) Microsoft Corporation
 * All rights reserved.
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
 * to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

'use strict';

import * as assert from 'assert';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as component from '../../common/component';
import { TrialJobApplicationForm, TrialJobDetail, TrainingService } from '../../common/trainingService';
import { cleanupUnitTest, delay, prepareUnitTest } from '../../common/utils';
import { TrialConfigMetadataKey } from '../common/trialConfigMetadataKey';
import { RemoteMachineTrainingService } from '../remote_machine/remoteMachineTrainingService';

// copy mockedTrail.py to local folder
const localCodeDir: string = tmp.dirSync().name
const mockedTrialPath: string = './training_service/test/mockedTrial.py'
fs.copyFileSync(mockedTrialPath, localCodeDir + '/mockedTrial.py')

describe('Unit Test for RemoteMachineTrainingService', () => {
    /*
    To enable remote machine unit test, remote machine information needs to be configured in:
    Default/.vscode/rminfo.json,  whose content looks like:
    {
        "ip": "10.172.121.40",
        "user": "user1",
        "password": "mypassword"
    }
    */
    let skip: boolean = false;
    let testRmInfo: any;
    let machineList: any;
    try {
        testRmInfo = JSON.parse(fs.readFileSync('../../.vscode/rminfo.json', 'utf8'));
        console.log(testRmInfo);
        machineList = `[{\"ip\":\"${testRmInfo.ip}\",\"port\":22,\"username\":\"${testRmInfo.user}\",\"passwd\":\"${testRmInfo.password}\"}]`;
    } catch (err) {
        console.log('Please configure rminfo.json to enable remote machine unit test.');
        skip = true;
    }

    let remoteMachineTrainingService: RemoteMachineTrainingService

    before(() => {
        chai.should();
        chai.use(chaiAsPromised);
        prepareUnitTest();
    });

    after(() => {
        cleanupUnitTest();
    });

    beforeEach(() => {
        if (skip) {
            return;
        }
        remoteMachineTrainingService = component.get(RemoteMachineTrainingService);
        remoteMachineTrainingService.run();
    });

    afterEach(() => {
        if (skip) {
            return;
        }
        remoteMachineTrainingService.cleanUp();
    });

    it('List trial jobs', async () => {
        if (skip) {
            return;
        }
        chai.expect(await remoteMachineTrainingService.listTrialJobs()).to.be.empty;
    });

    it('Set cluster metadata', async () => {
        if (skip) {
            return;
        }
        await remoteMachineTrainingService.setClusterMetadata(TrialConfigMetadataKey.MACHINE_LIST, machineList);
        await remoteMachineTrainingService.setClusterMetadata(
            TrialConfigMetadataKey.TRIAL_CONFIG, `{"command":"sleep 1h && echo ","codeDir":"${localCodeDir}","gpuNum":1}`);
        const form: TrialJobApplicationForm = {
                jobType: 'TRIAL',
                hyperParameters: 'mock hyperparameters'
        };
        const trialJob = await remoteMachineTrainingService.submitTrialJob(form);

        // After a job is cancelled, the status should be changed to 'USER_CANCELED'
        await remoteMachineTrainingService.cancelTrialJob(trialJob.id);

        // After a job is cancelled, the status should be changed to 'USER_CANCELED'
        const trialJob2 = await remoteMachineTrainingService.getTrialJob(trialJob.id);
        chai.expect(trialJob2.status).to.be.equals('USER_CANCELED');

        //Expect rejected if passing invalid trial job id
        await remoteMachineTrainingService.cancelTrialJob(trialJob.id + 'ddd').should.eventually.be.rejected;
    });

    it('Submit job test', async () => {
        if (skip) {
            return;
        }
    });

    it('Submit job and read metrics data', async () => {
        if (skip) {
            return;
        }
        // set machine list'
        await remoteMachineTrainingService.setClusterMetadata(TrialConfigMetadataKey.MACHINE_LIST, machineList);

        // set meta data
        const trialConfig: string = `{\"command\":\"python3 mockedTrial.py\", \"codeDir\":\"${localCodeDir}\",\"gpuNum\":0}`
        await remoteMachineTrainingService.setClusterMetadata(TrialConfigMetadataKey.TRIAL_CONFIG, trialConfig);

        // submit job
        const form: TrialJobApplicationForm = {
            jobType: 'TRIAL',
            hyperParameters: 'mock hyperparameters'
        };
        const jobDetail: TrialJobDetail = await remoteMachineTrainingService.submitTrialJob(form);
        // Add metrics listeners
        const listener1 = function f1(metric: any) {
        }

        const listener2 = function f1(metric: any) {
        }

        remoteMachineTrainingService.addTrialJobMetricListener(listener1);
        remoteMachineTrainingService.addTrialJobMetricListener(listener2);
        await delay(10000);
        // remove listender1
        remoteMachineTrainingService.removeTrialJobMetricListener(listener1);
        await delay(5000);
    }).timeout(30000);

    it('Test getTrialJob exception', async () => {
        if (skip) {
            return;
        }
        await remoteMachineTrainingService.getTrialJob('wrongid').catch((err) => {
            assert(err !== undefined);
        });
    });
});

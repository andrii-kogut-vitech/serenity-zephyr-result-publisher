const fs = require('fs')
const ZephyrScaleClient = require('./zephyrScaleClient.js')


class PublishResults {
    zephyr = new ZephyrScaleClient(
        {
            'domain': process.env.ZEPHYR_DOMAIN,
            'apiToken': process.env.ZEPHYR_TOKEN,
            'projectKey': process.env.ZEPHYR_PROJECT_KEY,
            'parentId': process.env.ZEPHYR_FOLDER_PARENT_ID,
            'testCycleFolder': process.env.ZEPHYR_TEST_CYCLE_FOLDER
        });
    ;

    status = {
        'SUCCESS': 'pass',
        'ERROR': 'fail',
        'FAILURE': 'fail'
    };


    getListOfFiles(src = process.env.JSON_INPUT_PATH) {
        let jsonFiles = [];
        let files = fs.readdirSync(src)
        files.forEach(file => {
            if (file.includes('json')) {
                jsonFiles.push(file)
            }
            ;
        });
        return jsonFiles;
    }

    readContent(filename) {
        return JSON.parse(fs.readFileSync(process.env.JSON_INPUT_PATH + filename))
    }

    addStep(step) {
        return {
            "inline": {
                "description": step
            }
        }
    }


    addStepResult(step) {
        let result = {
            "statusName": this.status[step.result],
        }
        let actualResult = ''
        if (step.screenshots) {
            let imgUrl = `https://${process.env.SERENITY_REPORT_DOMAIN}/${process.env.SERENITY_REPORT_ID}/${step.screenshots[0].screenshot}`
            let resultImg = `<img src="${imgUrl}" />`
            actualResult = actualResult.concat(resultImg)
        }
        if (step.exception) {
            let exception = JSON.stringify(step.exception, undefined, 4)
            exception = exception.replace(/\n/g, `<br>`)
            exception = exception.replace(/\s/g, `&emsp;`)
            actualResult = actualResult.concat(`<b>Stacktrace:</b><br>${exception}`)
        }
        if (actualResult) {
            result.actualResult = actualResult
        }
        return result;
    }

    processResults() {
        let cycleKey = this.zephyr.addTestRunCycle()
        let jsonFiles = this.getListOfFiles();
        for (let fileNameSequence = 0; fileNameSequence < jsonFiles.length; fileNameSequence++) {
            let json = this.readContent(jsonFiles[fileNameSequence]);
            let folderName = json.featureTag.name.split('/')[0];
            let folderId = this.zephyr.getFolderIdByTitle(folderName);
            let suiteName = json.featureTag.name.split('/')[1];
            for (let testCaseSequence = 0; testCaseSequence < json.testSteps.length; testCaseSequence++) {
                let testCaseName = suiteName;
                for (let paramSequence = 0; paramSequence < json.dataTable.rows[testCaseSequence].values.length; paramSequence++) {
                    testCaseName = testCaseName + `: ${json.dataTable.rows[testCaseSequence].values[paramSequence]}`
                }
                let steps = []
                let stepResult = []
                let testCaseKey = this.zephyr.getTestCaseIdByTitle(testCaseName, folderId)
                let testSteps = json.testSteps[testCaseSequence].children;
                let testCaseResult = this.status[json.testSteps[testCaseSequence].result]
                testSteps.forEach(step => {
                    steps.push(this.addStep(step.description))
                    stepResult.push(this.addStepResult(step))
                });
                this.zephyr.addStepsToTestCase(testCaseKey, steps)
                this.zephyr.publishResults(cycleKey, testCaseKey, testCaseResult, stepResult)
            }

        }

    }

}

module.exports = PublishResults;

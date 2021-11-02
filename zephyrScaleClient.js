const request = require("sync-request");

/**
 * Zephyr Scale basic API wrapper
 */
class ZephyrScaleClient {

    /**
     * Zephyr Scale constructor
     *
     * @param options
     */
    constructor(options) {
        this._validate(options, 'domain');
        this._validate(options, 'apiToken');
        this._validate(options, 'projectKey');

        // compute base url
        this.options = options;
        this.base = `https://${this.options.domain}/v2/`;
    }


    /**
     * Validate config values
     *
     * @param options
     * @param name
     * @private
     */
    _validate(options, name) {
        if (options == null) {
            throw new Error("Missing Zephyr Scale options");
        }
        if (options[name] == null) {
            throw new Error(`Missing ${name} value. Please update Zephyr Scale option in wdio.conf`);
        }
    }

    /**
     * Form the url for api
     *
     * @param path
     * @returns {string}
     * @private
     */
    _url(path) {
        return `${this.base}${path}`;
    }

    /**
     * Post request formation
     *
     * @param api
     * @param body
     * @param error
     * @returns {*}
     * @private
     */
    _post(api, body, error = undefined) {
        return this._request("POST", api, body, error);
    }

    /**
     * get request formation
     *
     * @param api
     * @param error
     * @returns {*}
     * @private
     */
    _get(api, error = undefined) {
        return this._request("GET", api);
    }

    /**
     * Patch request formation
     *
     * @param api
     * @param error
     * @returns {*}
     * @private
     */
    _patch(api, error = undefined) {
        return this._request("PATCH", api);
    }

    /**
     * Api request sending to the corresponding url
     *
     * @param method
     * @param api
     * @param body
     * @param error
     * @returns {*}
     * @private
     */
    _request(method, api, body = undefined, error = undefined) {
        const option = {
            headers: {
                "Authorization": `Bearer ${this.options.apiToken}`,
                "Content-Type": "application/json; charset=utf-8",
            }
        };
        if (body !== undefined) {
            option["json"] = body
        }
        let result = request(method, this._url(api), option);
        result = JSON.parse(result.getBody('utf8'));
        if (result.error) {
            if (error) {
                error(result.error);
            } else {
                throw new Error(result.error);
            }
        }
        return result;
    }

    /**
     * Returns current date in 'Mon Jan 1 2020' format
     * @return {string}
     */
    getDateNow() {
        let now = new Date(Date.now())
        return now.toDateString()
    }

    /**
     * Creates testRunCycle in Zephyr Scale via API
     * @param casprojectKey
     * @param testRunName
     * @return testRunId of created testRun
     */
    addTestRunCycle(projectKey=this.options.projectKey, testRunName = `Test run ${this.getDateNow()}`, folderId=this.options.testCycleFolder) {
        let requestBody = {
            "projectKey": projectKey,
            "name": testRunName,
            "folderId": folderId
        }
        let response = this._post(`testcycles`, requestBody)
        return response['key'];
    }

    /**
     * Creates testCase in Zephyr Scale via API
     * @param name
     * @param folderId
     * @return testCaseId of created testCase
     */
    addTestCase(name, folderId) {
        let requestBody = {
            "projectKey": this.options.projectKey,
            "name": name,
            "folderId": folderId
        }
        let response = this._post(`testcases`, requestBody)
        return response['key']
    }

    /**
     * Add steps to testCase in Zephyr Scale via API
     * @param testCaseId
     * @param steps
     */
    addStepsToTestCase(testCaseId, steps) {
        let requestBody = {
            "mode": "OVERWRITE",
            "items": steps
        }
        this._post(`testcases/${testCaseId}/teststeps`, requestBody)
    }

    /**
     * Creates Folder in Zephyr Scale via API
     * @param name
     * @return folderId of created section
     */
    addFolderId(name, parentId=this.options.parentId) {
        let requestBody = {
            "name": name,
            "parentId": parentId,
            "projectKey": this.options.projectKey,
            "folderType": "TEST_CASE"
        }
        let response = this._post(`folders`, requestBody)
        return response['id']
    }

    filterJson(json, key, value) {
        let filtered = json.filter(a => a[key] == value);
        return filtered
    }

    /**
     * Gets data from api endpoint and returns data matched to key and value
     * @param api
     * @param key
     * @param value
     * @return {{}}
     */
    getDataDictFromApiByParams(api, key, value) {
        let data = this._get(api)
        data = data.values
        let dict = {};
        for (let i = 0; i < data.length; i++) {
            dict[data[i][key]] = data[i][value];
        }
        return dict
    }

    /**
     * Gets data and returns data matched to key and value
     * @param data
     * @param key
     * @param value
     * @return {{}}
     */
    getDataDictByParams(data, key, value) {
        let dict = {};
        for (let i = 0; i < data.length; i++) {
            dict[data[i][key]] = data[i][value];
        }
        return dict
    }

    /**
     * Gets testCaseId based on title and section
     * in cases there is no such testCase in section, it will be created
     * @param title
     * @param folderId
     * @return testCaseId
     */
    getTestCaseIdByTitle(title, folderId) {
        let data = this._get(`testcases?projectKey=${this.options.projectKey}&folderId=${folderId}&maxResults=200`)
        data = data.values
        data = this.getDataDictByParams(data, 'name', 'key')
        let cases = [];
        for (let name in data) {
            if (name === title) {
                cases.push(data[name])
            }
        }
        if (cases.length > 1) {
            throw new Error(`In section ${folderId} were found ${cases.length} cases with the same test case name - ${title}`)
        } else if (cases.length === 0) {
            return this.addTestCase(title, folderId)
        } else {
            return cases[0]
        }
    }
    /**
     * Gets folderId based on title
     * in cases there is no such section, it will be created
     * @param title
     * @param folderName
     * @return folderId
     */
    getFolderIdByTitle(folderName, title) {
        if (folderName === undefined) {
            throw new Error(`TestCase "${title}" does not have suite name, please add it`)
        }
        let data = this._get(`folders?projectKey=${this.options.projectKey}&folderType=TEST_CASE&maxResults=200`)
        data = data.values
        data = this.filterJson(data, 'parentId', this.options.parentId)
        data = this.getDataDictByParams(data, 'name', 'id')
        let folders = [];
        for (let name in data) {
            if (name === folderName) {
                folders.push(data[name])
            }
        }
        if (folders.length > 1) {
            throw new Error(`In project ${this.options.projectKey} were found ${folders.length} folders with the same folder name - ${name}`)
        } else if (folders.length === 0) {
            return this.addFolderId(folderName)
        } else {
            return folders[0]
        }
    }

    /**
     * Publish results into Zephyr Scale via API
     * @param cases
     * @param results
     */
    publishResults(cycleKey, testCaseKey, testCaseResult, stepResult) {
        let requestBody = {
            "projectKey": this.options.projectKey,
            "testCycleKey": cycleKey,
            "testCaseKey": testCaseKey,
            "statusName": testCaseResult,
            "testScriptResults": stepResult
        }
        this._post(`testexecutions`, requestBody)
    }

}

module.exports = ZephyrScaleClient;

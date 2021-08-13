const path = require("path");
const fs = require("fs");
const { get, set, difference, merge } = require('lodash')
const axios = require("axios");

const pluginName = "RequestLocalizationSync";

const flattenObject = (ob) => {
    var toReturn = {};
    for (var i in ob) {
        if (!ob.hasOwnProperty(i)) continue;
        if ((typeof ob[i]) == 'object' && ob[i] !== null && !Array.isArray(ob[i])) {
            var flatObject = flattenObject(ob[i]);
            for (var x in flatObject) {
                if (!flatObject.hasOwnProperty(x)) continue;
                toReturn[i + '.' + x] = flatObject[x];
            }
        } else {
            toReturn[i] = ob[i];
        }
    }
    return toReturn;
}

const parseKeyToObject = (keys = [], object = {}) => {
    return keys.reduce((result, key) => {
        set(result, key, get(object, key))
        return result
    }, {})
}

const requestBodyParser = (localeDatas, options = {}) => ({
    ...options,
    data: localeDatas
})

const isDisabled = (compilerOptions) => {
    return compilerOptions.mode !== 'production'
}

module.exports = class RequestLocalizationSync {

    static defaultOptions = {
        filename: "translations.json",
        authApplicationCode: process.env.AUTH_APPLICATION_CODE,
        applicationName: process.env.APPLICATION_NAME,
        defaultNameSpace: 'common',
        localResources: {},
        languages: ['en'],
        requestOptions: {
            url: process.env.LOCALIZATION_SYNC_URL,
            method: 'POST',
            headers: { 'Content-Type': 'application/json-patch+json', 'Accept': 'application/json' },
            bodyParser: requestBodyParser
        },
        isDisabled,
    };

    constructor(options = {}) {
        this.options = { ...RequestLocalizationSync.defaultOptions, ...options };
        this.matchKeys = [];
    }

    apply(compiler) {
        let isBypassed = false;
        if (typeof this.options.isDisabled === 'boolean') {
            isBypassed = this.options.isDisabled
        } else if (typeof this.options.isDisabled === 'function') {
            isBypassed = this.options.isDisabled(compiler.options)
        }
        if (isBypassed) return



        compiler.hooks.done.tap(pluginName, async (stats) => {


            const sendRequest = async (data, applicationName, languageCode = 'en') => {
                try {
                    const applicationCode = this.options.authApplicationCode || process.env.AUTH_APPLICATION_CODE
                    const portalCode = applicationName || this.options.applicationName || process.env.APPLICATION_NAME
                    const dataOptions = {
                        responseInfo: { languageCode },
                        applicationCode, portalCode,
                    };
                    const requestOptions = Object.assign(this.options.requestOptions, {
                        url: this.options.requestOptions.url || process.env.LOCALIZATION_SYNC_URL,
                        data: (this.options.requestOptions.bodyParser || requestBodyParser)(data, dataOptions),
                    })
                    const resp = await axios(requestOptions);
                    const version = get(resp, 'data.responseInfo.version') || 'unknown'
                    if (get(resp, 'data.data')) {
                        console.log(`${pluginName} Translations import success | Application Name: "${portalCode}"\n - Version ${version}`)
                    } else {
                        console.log(`Cannot sync Translations: ${JSON.stringify(get(resp, 'data.errors') || get(resp, 'data'))}\nVersion ${version}`);
                    }
                } catch (error) {
                    console.log('ERROR', pluginName, error)
                }
            }

            const applicationName = this.options.applicationName || process.env.APPLICATION_NAME
            const outputPath = path.join(compiler.outputPath, this.options.filename)
            const localResources = this.options.localResources;

            let resources = {}
            try {
                resources = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
            } catch (error) {
                console.log('ERROR', pluginName, error)
            }

            for (let languageCode of this.options.languages) {
                const localResource = localResources[languageCode];
                if (localResource) {
                    const localResourceKeys = flattenObject(localResource)

                    const data = merge(resources, localResource);
                    const resourceKeys = Object.keys(flattenObject(data))
                    const commonKeys = difference(resourceKeys, Object.keys(localResourceKeys))

                    const commonData = parseKeyToObject(commonKeys, data)

                    await Promise.all([
                        sendRequest(localResource, applicationName, languageCode),
                        sendRequest(commonData, this.options.defaultNameSpace, languageCode)
                    ])
                }
            }
        })
    }
};

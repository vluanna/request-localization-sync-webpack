# request-localization-sync-webpack
A webpack plugin to sync translate json to service on deploy before build
[event hook](https://webpack.js.org/api/compiler-hooks/)). 
Can stop compilation by condition.

## Installation

```
npm install --save-dev request-localization-sync-webpack
```

## Usage

In config file:

``` javascript
const RequestLocalizationSync = require('request-localization-sync-webpack');
// ...
  module: {
    plugins: [
      new RequestLocalizationSync({
        filename: "translations.json", // input file contain all keys, gen from you code, just look like the resource file but without value,
        authApplicationCode: 'WebApp1', // default take the value from process.env.AUTH_APPLICATION_CODE
        applicationName: 'app1', // default take the value from process.env.APPLICATION_NAME
        defaultNameSpace: 'translations',
        localResources: {}, // all locales resources object in you app: exp: { en: {...}, vi: {...} }
        languages: ['en', 'vi'],
        setCompilerHook: (compiler, pluginName, callback) => compiler.hooks.done.tap(pluginName, callback),
        // Axios options...
        requestOptions: {
          url: 'http://some.url/to/post/your/translations',
          method: 'post',
          headers: { 'Content-Type': 'application/json' },
          bodyParser: (permisionDatas, additionalBodyData ) => ({ permisionDatas, ...additionalBodyData }), // parser function to parse translate to axios data body
        },
        isDisabled: false, // this config will disable the plugin to run on compile
      }),
    ]
  },
// ...
```


You can find other axios's API options [here](https://github.com/axios/axios#axios-api)

By default, url will load from process env or sysconfig: LOCALIZATION_SYNC_URL


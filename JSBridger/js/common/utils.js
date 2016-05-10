/**
 * Created by eitanr on 11/29/14.
 */
'use strict';
function getCurrentEnv() {
    var currentEnv;
    process.argv.forEach(function (val) {
        if (val.indexOf('env=') === 0) {
            currentEnv = val.split('env=')[1];
        }
    });
    return currentEnv;
}

function getDirectoryId(env) {
    if (env === 'prod') {
        return 'cc2e24df-4bd5-432e-912d-0a855d2cf46e';
    }
    //other envs
    return '9c51c4be-eb67-4afb-8cac-af8fa4786601';
}

function consolelog() {
    console.log((new Date()).toString(), Array.prototype.slice.call(arguments, 0).map(function (arg) {
        if (typeof arg === 'object') {
            return JSON.stringify(arg);
        }
        return arg;
    }).join(' '));
}

module.exports = {
    getCurrentEnv: getCurrentEnv,
    availableEnvs: ['prod', 'staging', 'dev'],
    getDirectoryId: getDirectoryId,
    consoleLog: consolelog
};

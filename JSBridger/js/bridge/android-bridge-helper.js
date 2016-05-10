/**
 * Created by eitanr on 12/22/14.
 */
'use strict';
var androidBridge = {
    nativeToJs: function (callId, funcName, arg) {
        function parseJSArgs(arg) {
            try {
                return JSON.parse(arg);
            } catch (e) {
                return arg;
            }
        }

        var args = parseJSArgs(arg);

        if (Array.isArray(args)) {
            args.unshift(callId);
            window[funcName].apply(null, args);
        } else {
            window[funcName](callId, arg);
        }

    },
    jsToNative: function (callId, res) {
        function stringify(arg) {
            if (typeof arg === 'string') {
                return arg;
            }

            return JSON.stringify(arg);
        }

        if (typeof debugMode !== 'undefined' && debugMode === true) {
            console.log('%candroidInterface.callback(%d, "%s");', "color: purple; font-size: 14px;", callId, stringify(res));
        } else {
            androidInterface.callback(callId, stringify(res));
        }
    },

    resultToNative: function (callId) {
        return function (res) {
            androidBridge.jsToNative(callId, res);
        };
    }
};

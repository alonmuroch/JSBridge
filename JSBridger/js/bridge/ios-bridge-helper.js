/**
 * Created by talkol
 */
'use strict';

// in ios we can override alert to NSLog so redirect console.log there
var console = new Object();
console.log = function(msg) { alert(msg); }
console.debug = console.log;
console.info = console.log;
console.warn = console.log;
console.error = console.log;

var iosBridge = {
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
    function iosInterfaceExecute(url) {
        var iframe = document.createElement("IFRAME");
        iframe.setAttribute("src", url);
        document.documentElement.appendChild(iframe);
        iframe.parentNode.removeChild(iframe);
        iframe = null;
    }
    
    function stringify(arg) {
        if (typeof arg === 'string') {
            return arg;
        }
        
        return JSON.stringify(arg);
    }
    
    if (typeof debugMode !== 'undefined' && debugMode === true) {
        console.log('%ciosInterfaceExecute(%d, "%s");', "color: purple; font-size: 14px;", callId, stringify(res));
    } else {
        iosInterfaceExecute('bridge://' + callId + '?' + encodeURIComponent(stringify(res)));
    }
},
    
resultToNative: function (callId) {
    return function (res) {
        iosBridge.jsToNative(callId, res);
    };
}
};

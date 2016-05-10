'use strict';

function f1(callId, input){
    f2(function(res){
    	alert(input + "\nf1 result\n" + res);
        iosBridge.jsToNative(callId, input + "\nf1 result\n" + res);
    }); 
}
function f2(callback){
	f3(function(f3Res) {
		callback("f2 result\n" + f3Res);
	});
}
function f3(callback){
    callback("f3 result");
}
module.exports = {
    f1:f1
};
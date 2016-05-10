/**
 * Created by eitanr on 12/26/14.
 */

//global functions to be invoked from native app

//ANDROID
function getPassphrase(callId) { //OK
    androidBridge.jsToNative(callId, cpWrapper.getPassphrase());
}

function openWallet(callId, passphrase) { //OK
    cpWrapper.openWallet(passphrase)
    .then(androidBridge.resultToNative(callId));
}

function sendAsset(callId, passphrase, destinationAddress, assetName, quantity) { //OK
    cpWrapper.sendAsset(passphrase, destinationAddress, assetName, quantity)
    .then(androidBridge.resultToNative(callId));
}

function getWalletBalances(callId, walletAddress) {
    cpWrapper.getBalances(walletAddress)
    .then(androidBridge.resultToNative(callId));
}


//IOS
function iosGetPassphrase(callId) { //OK
    iosBridge.jsToNative(callId, cpWrapper.getPassphrase());
}

function iosOpenWallet(callId, passphrase) { //OK
    cpWrapper.openWallet(passphrase)
    .then(iosBridge.resultToNative(callId));
}

function iosSendAsset(callId, passphrase, destinationAddress, assetName, quantity) { //OK
    cpWrapper.sendAsset(passphrase, destinationAddress, assetName, quantity)
    .then(iosBridge.resultToNative(callId));
}

function iosGetWalletBalances(callId, walletAddress) {
    cpWrapper.getBalances(walletAddress)
    .then(iosBridge.resultToNative(callId));
}

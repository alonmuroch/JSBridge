/**
 * Created by eitanr on 12/13/14.
 */

var utils = require('../common/utils');
var MtpApiManager = require('../factories/MtpApiManager');
var Config = require('../common/config');

function sendCode(phoneNumber, datacenterId, authKeyId, authKey, serverSalt) {
    var authKeyStarted = tsNow();
    var options = {
        authKey: authKey,
        authKeyId: authKeyId,
        dcId: datacenterId,
        serverSalt: serverSalt
    };
    return MtpApiManager.invokeApi('auth.sendCode', {
        phone_number: phoneNumber,
        sms_type: 5,
        api_id: Config.App.id,
        api_hash: Config.App.hash
    }, options); //.then(function (sentCode) {
        //$scope.progress.enabled = false;
        //
        //$scope.credentials.phone_code_hash = sentCode.phone_code_hash;
        //$scope.credentials.phone_occupied = sentCode.phone_registered;
        //$scope.credentials.viaApp = sentCode._ == 'auth.sentAppCode';
        //$scope.callPending.remaining = sentCode.send_call_timeout || 60;
        //$scope.error = {};

        //callCheck();
        //
        //onContentLoaded(function () {
        //    $scope.$broadcast('ui_height');
        //});
    //
    //}, function (error) {
    //    $scope.progress.enabled = false;
    //    console.log('sendCode error', error);
    //    switch (error.type) {
    //        case 'PHONE_NUMBER_INVALID':
    //            $scope.error = {field: 'phone'};
    //            error.handled = true;
    //            break;
    //    }
    //})['finally'](function () {
        //if ($rootScope.idle.isIDLE || tsNow() - authKeyStarted > 60000) {
        //    NotificationsManager.notify({
        //        title: 'Telegram',
        //        message: 'Your authorization key was successfully generated! Open the app to log in.',
        //        tag: 'auth_key'
        //    });
        //}
    //});
}

module.exports = {
    sendCode: sendCode
};
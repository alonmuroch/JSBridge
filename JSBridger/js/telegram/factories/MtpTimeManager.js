/**
 * Created by eitanr on 12/14/14.
 */
//.factory('MtpTimeManager', function (Storage) {
var lastMessageID = [0, 0],
    timeOffset = 0;

var utils = require('../common/utils');
var binUtils = require('../common/bin_utils');


//Storage.get('server_time_offset').then(function (to) {
//    if (to) {
//        timeOffset = to;
//    }
//});

function generateMessageID() {
    var timeTicks = utils.tsNow(),
        timeSec = Math.floor(timeTicks / 1000) + timeOffset,
        timeMSec = timeTicks % 1000,
        random = binUtils.nextRandomInt(0xFFFF);

    var messageID = [timeSec, (timeMSec << 21) | (random << 3) | 4];
    if (lastMessageID[0] > messageID[0] ||
        lastMessageID[0] == messageID[0] && lastMessageID[1] >= messageID[1]) {

        messageID = [lastMessageID[0], lastMessageID[1] + 4];
    }

    lastMessageID = messageID;

    // console.log('generated msg id', messageID, timeOffset);

    return binUtils.longFromInts(messageID[0], messageID[1]);
}

//function applyServerTime(serverTime, localTime) {
//    var newTimeOffset = serverTime - Math.floor((localTime || tsNow()) / 1000),
//        changed = Math.abs(timeOffset - newTimeOffset) > 10;
//    Storage.set({server_time_offset: newTimeOffset});
//
//    lastMessageID = [0, 0];
//    timeOffset = newTimeOffset;
//    console.log(dT(), 'Apply server time', serverTime, localTime, newTimeOffset, changed);
//
//    return changed;
//};

module.exports = {
    generateID: generateMessageID
    //applyServerTime: applyServerTime
};
//})
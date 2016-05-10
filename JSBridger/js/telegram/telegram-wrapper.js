/**
 * Created by eitanr on 12/13/14.
 */
'use strict';
var Q = require('q');
var _ = require('lodash');

function sendCode() {
    var validationCode = _.sample('0123456789', 6).join('');
    return Q(validationCode);
}
function signUp() {
    return Q();
}
function signIn() {
    return Q();
}


module.exports = {
    sendCode: sendCode,
    signUp: signUp,
    signIn: signIn
};
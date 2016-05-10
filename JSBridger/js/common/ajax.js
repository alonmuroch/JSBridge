var request = require('request');
var zlib = require('zlib');
//var program = require('commander');
//var compression = require('compression');
var http = require('http');
var path = require('path');
var express = require('express');
var fs = require('fs');
var q = require('q');

function convertResponseToJsonIfValid(resp, contentType) {
    'use strict';
    if (!resp) {
        return null;
    }
    if (contentType.indexOf('application/json') === -1) {
        return resp.toString();
    }
    return JSON.parse(resp.toString());
}

//var fixUrl = function (url) {
//    'use strict';
//    return (/^https?:\/\//).test(url) ? url : 'http://' + url;
//};

var ajaxFn = function (reqFlags) {
    'use strict';
//    var url = fixUrl(reqFlags.url);
    var reqJson = (reqFlags.data ? (typeof reqFlags.data === 'object' ? reqFlags.data : JSON.parse(reqFlags.data)) : null) || true;
    console.log('req:' + JSON.stringify(reqJson));
    var reqOptions = {
        url: reqFlags.url,
        //json: (reqFlags.data ? JSON.parse(reqFlags.data) : null) || true,
        json: reqJson,
        method: reqFlags.method,
        headers: {
            "accept-encoding": "gzip,deflate",
//            "accept-charset": "ISO-8859-1,utf-8;q=0.7,*;q=0.3",
//            "accept-language": "en-US,en;q=0.8",
            "accept": "application/json"
//            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.13+ (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2"
        }
    };

    if (typeof reqFlags.timeout !== 'undefined') {
        reqOptions.timeout = reqFlags.timeout;
    }

    if (typeof reqFlags.method !== 'undefined') {
        reqOptions.method = reqFlags.method.toUpperCase();
    }

    var req = request(reqOptions);

    var deferred;

    var resolveFunction = function (err, value) {
        if (deferred) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(value);
            }
        }

        if (err) {
            if (reqFlags.error) {
                reqFlags.error(err);
            } else {
                reqFlags.success(null);
            }
        } else {
            reqFlags.success(value);
        }
    };

//    if (typeof reqFlags.success !== 'function' && typeof reqFlags.error !== 'function') {
    deferred = q.defer();
//    }

    req.on('response', function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var buffer = Buffer.concat(chunks);
            var encoding = res.headers['content-encoding'];
//            console.log(res.headers);
            if (encoding === 'gzip') {
                zlib.gunzip(buffer, function (err, decoded) {
                    resolveFunction(false, convertResponseToJsonIfValid(decoded, res.headers['content-type']));
                });
            } else if (encoding === 'deflate') {
                zlib.inflate(buffer, function (err, decoded) {
                    resolveFunction(false, convertResponseToJsonIfValid(decoded, res.headers['content-type']));
                });
            } else {
                resolveFunction(false, convertResponseToJsonIfValid(buffer, res.headers['content-type']));
            }
        });
    });

    req.on('error', function (err) {
        resolveFunction(err);
    });

    return deferred && deferred.promise;
};

module.exports = {
    ajax: function () {
        return ajaxFn.apply(null, arguments);
    },
    post: function (url, data, success, dataType) {
        if (typeof url === 'object') {
            url.type = 'POST';
            return ajaxFn(url);
        }

        var options = {
            type: "POST",
            url: url
        };
        if (data) {
            options.data = data;
        }
        if (success) {
            options.success = success;
        }
        if (dataType) {
            options.dataType = dataType;
        }
        return ajaxFn(options);
    },
    get: function (url, data, success, dataType) {
        if (typeof url === 'object') {
            return ajaxFn(url);
        }

        var options = {
            url: url
        };
        if (data) {
            options.data = data;
        }
        if (success) {
            options.success = success;
        }
        if (dataType) {
            options.dataType = dataType;
        }
        return ajaxFn(options);
    },
    getJSON: function (url, data, success) {
        var options = {
            dataType: 'json',
            url: url
        };

        if (typeof data === 'function' && typeof success === 'undefined') {
            options.success = data;
        } else {
            if (typeof data === 'object') {
                options.data = data;
            }
            if (typeof success === 'function') {
                options.success = success;
            }
        }
        return ajaxFn(options);
    }
};
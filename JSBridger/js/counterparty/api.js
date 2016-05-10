/**
 * Created by eitanr on 9/12/14.
 */
(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['./utils/util.generic.js', './utils/util.bitcore.js', '../common/ajax.js', 'q', 'lodash', './consts'], function (generic, bitcoreUtils, ajax, Q, _, consts) {
            return factory(generic, bitcoreUtils, ajax, Q, _, consts);
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./utils/util.generic.js'), require('./utils/util.bitcore.js'), require('../common/ajax.js'), require('q'), require('lodash'), require('./consts.js'));
    } else {
        // Browser globals
        root.api = factory(root.generic, root.bitcoreUtils, root.Zepto, root.Q, root._, root.consts);
    }
}(this, function (generic, bitcoreUtils, ajax, Q, _, consts) {
    'use strict';
    var TIMEOUT_FAILOVER_API = 4000; // 4 seconds (in ms)
    var TIMEOUT_FAILOVER_API_SINGLE = 10000; // 10 seconds (in ms) - timeout when just one server in the list
    var TIMEOUT_MULTI_API = 8000; // 8 seconds (in ms)
    var COUNTERPARTY_CONFIG_TIMEOUT = 30 * 60 * 1000; //half  hour

    var serversConfig = {
//    "servers": [ "https://counterwallet.co"],
//    "servers": [ "https://testnet.counterwallet.co"],
//        "servers": ["https://cw01.counterwallet.io", "https://cw02.counterwallet.io", "https://cw03.counterwallet.io"]
        servers: ["https://cw01.counterwallet.io", "https://cw02.counterwallet.io"]
//    "forceTestnet": true
    };
    var lastConfigCheck = null;

    function shouldRefreshCounterwalletConfig() {
        if (!lastConfigCheck) {
            return true;
        }
        return (new Date()).getTime() - lastConfigCheck > COUNTERPARTY_CONFIG_TIMEOUT;
    }

    function getCounterpartyConfig() {
        if (shouldRefreshCounterwalletConfig()) {
            var currentTime = (new Date()).getTime();
            return ajaxRequest('https://api.getgems.org/get-counterparty-config', {}).then(function (result) {
                serversConfig = result;
                lastConfigCheck = currentTime;
                return Q(cwAPIUrls(serversConfig.servers));
            }, function (err) {
                //fallback to defaults
                serversConfig = {
                    servers: ["https://cw01.counterwallet.io", "https://cw02.counterwallet.io"]
                };
                lastConfigCheck = currentTime;
                return Q(cwAPIUrls(serversConfig.servers));
            });
        }

        return Q(cwAPIUrls(serversConfig.servers));
    }

    function cwAPIUrls(urls) {
        return _.map(_.shuffle(urls), function (element) {
            return element + (consts.USE_TESTNET ? '/_t_api' : '/_api');
        });
    }

    //function rpcErrorToString(rpcError) {
    //    console.log(rpcError);
    //    return _.template('JSON-RPC Error: Type: <%=type%>, Code: <%=code%>, Message: <%=message%>', {
    //        type: rpcError.error.message,
    //        code: rpcError.code,
    //        message: rpcError.data ? rpcError.data.message : 'unspecified'
    //    });
    //}

    function ajaxRequest(url, postData, ajaxOptions, urlIndex) {
        var dfd = Q.defer();
        urlIndex = urlIndex || 0;
        ajaxOptions = ajaxOptions || {};
        postData = postData || null;

        var actualUrl = Array.isArray(url) ? url[urlIndex] : url;

        var options = {
            url: actualUrl,
            method: postData ? "POST" : "GET", //for node request
            type: postData ? "POST" : "GET", //for zepto ajax
            data: postData,
            success: function (response) {
                if (response && typeof response.result !== 'undefined') {
                    dfd.resolve(response.result);
                } else if (response.error) {
                    //console.log(response.error);
                    console.log(response.error, url, postData, ajaxOptions, urlIndex);
                    dfd.reject(response.error);
                } else {
                    console.log(response, url, postData, ajaxOptions, urlIndex);
                    dfd.reject('ERR:' + (typeof response === 'object' ? JSON.stringify(response) : response));
                }
            },
            error: function (err) {
                if (!Array.isArray(url) || url.length <= urlIndex + 1) {
                    dfd.reject(err);
                } else {
                    ajaxRequest(url, postData, ajaxOptions, urlIndex + 1)
                        .done(function (data) {
                            dfd.resolve(data);
                        }, function (err) {
                            dfd.reject(err);
                        });
                }
            }
        };

        _.assign(options, ajaxOptions);

        ajax.ajax(options);

        return dfd.promise;
    }

    function getDestType(method) {
        //based on the method, determine the endpoints list to use
        var counterBlockDMethods = ['is_ready', 'get_reflected_host_info', 'is_chat_handle_in_use',
            'get_messagefeed_messages_by_index', 'get_normalized_balances', 'get_required_btcpays',
            'get_chain_address_info', 'get_chain_block_height', 'get_chain_txns_status',
            'get_num_users_online', 'get_chat_handle', 'store_chat_handle', 'is_wallet_online', 'get_preferences', 'store_preferences',
            'get_raw_transactions', 'get_balance_history', 'get_last_n_messages',
            'get_owned_assets', 'get_asset_history', 'get_asset_extended_info', 'get_transaction_stats', 'get_wallet_stats', 'get_asset_pair_market_info',
            'get_market_price_summary', 'get_market_price_history', 'get_market_info', 'get_market_info_leaderboard', 'get_market_cap_history',
            'get_order_book_simple', 'get_order_book_buysell', 'get_trade_history',
            'record_btc_open_order', 'cancel_btc_open_order', 'get_bets', 'get_user_bets', 'get_feed', 'get_feeds_by_source',
            'parse_base64_feed', 'get_open_rps_count', 'get_user_rps',
            'get_users_pairs', 'get_market_orders', 'get_market_trades', 'get_markets_list', 'get_market_details',
            'get_pubkey_for_address', 'create_armory_utx', 'convert_armory_signedtx_to_raw_hex', 'create_support_case',
            'get_escrowed_balances', 'broadcast_tx'];

        return _.contains(counterBlockDMethods, method) ? 'counterblockd' : 'counterpartyd';
    }


    function jsonApiPost(endpoints, apiMethodName, apiMethodParams, timeout) {
        var destType = getDestType(apiMethodName);
        var ajaxOptions = {
            timeout: timeout,
            method: 'POST'
        };
        var rpcObject = {
            "jsonrpc": "2.0",
            "id": 0
        };

        var methodObject = {
            "method": apiMethodName,
            "params": apiMethodParams || {}
        };

        _.extend(rpcObject, destType === 'counterblockd' ? methodObject : {
            "method": "proxy_to_counterpartyd",
            "params": methodObject
        });

        return ajaxRequest(endpoints, JSON.stringify(rpcObject), ajaxOptions);
    }

    function detect525(apiMethodName, settledResults) {
        if (apiMethodName === 'is_ready') {
            return false;
        }

        function isNotCaughtUp(reason) {
            if (typeof window === 'undefined') {
                return reason && (_.contains(reason.data, 'is not caught up'));
            }

            return reason.status === 525;
        }

        return settledResults.length && _.reduce(settledResults, function (result, settledResult) {
                //525 only if all results are 525
                return result && settledResult.state === 'rejected' && isNotCaughtUp(settledResult.reason);
            }, true);
    }

    function multiAPIPrimativeQ(apiMethodName, apiMethodParams, filterFn) {
        var dfd = Q.defer();
        var deferreds = [];

        filterFn = filterFn || function (deferreds) {
            return deferreds; //by default filter nothing
        };

        getCounterpartyConfig().then(function (apiUrls) {
            _.forEach(apiUrls, function (apiUrl) {
                deferreds.push(jsonApiPost(apiUrl, apiMethodName, apiMethodParams, TIMEOUT_MULTI_API));
            });

            Q.allSettled(deferreds)
                .then(function (settledResults) {
                    if (detect525(apiMethodName, settledResults)) {
                        dfd.reject('The server(s) are currently updating and/or not caught up to the blockchain. Logging you out. Please try logging in again later. (Most likely this message is due to the server being updated.)');
                    } else {
                        dfd.resolve(filterFn(settledResults));
                    }
                });
        });

        return dfd.promise;
    }

    function isFulfilled(response) {
        return response.state === 'fulfilled';
    }

    function multiApiFirstResultQ(method, params) { //multiAPI
        return multiAPIPrimativeQ(method, params, function (deferreds) {
            var result = _.find(deferreds, isFulfilled);
            return typeof result !== 'undefined' ? Q(result.value) : Q.reject(JSON.stringify(deferreds[0]));
        });
    }


    function getNewestResult(successResults, newestField) {
        var newest = null;

        for (var i = 0; i < successResults.length; i++) {
            if (successResults[i].hasOwnProperty(newestField) && successResults[i][newestField] &&
                (newest === null || successResults[i][newestField] > successResults[newest][newestField])) {
                newest = i;
            }
        }

        return (newest === null ? null : successResults[newest]);
    }


    function multiApiNewestQ(method, params, newestField) {
        return multiAPIPrimativeQ(method, params, function (deferrds) {
            var successfulResults = _.filter(deferrds, isFulfilled).map(function (result) {
                return result.value;
            });
            return getNewestResult(successfulResults, newestField);
        });
    }


    function multiAPIConsensusQ(apiMethodName, apiMethodParams) {
        /*Make an API call and require all servers not returning an error to give back the same result, which is
         passed to the onSuccess callback.*/
        return multiAPIPrimativeQ(apiMethodName, apiMethodParams)
            .then(function (results) {
                var successResults = _.map(_.filter(results, isFulfilled), function (result) {
                    return result.value;
                });

                if (!successResults.length) {
                    //TODO: construct an error message here
                    return Q.reject(results.length ? results[0].state : 'no results for ' + apiMethodName);
                }


                if (typeof successResults[0] === "string" && successResults[0].indexOf(consts.ARMORY_OFFLINE_TX_PREFIX) === 0) { //armory offline tx
                    if (_.uniq(successResults).length !== 1) {
                        return Q.reject(successResults); //armory offline tx where not all consensus data matches
                    }
                } else { //regular tx
                    generic.assert(apiMethodParams.source);
                    if (!bitcoreUtils.CWBitcore.compareOutputs(apiMethodParams.source, successResults)) {
                        return Q.reject(successResults); //regular tx where not all consensus data matches
                    }
                }

                return Q({
                    data: _.last(successResults),
                    numTotalEndpoints: results.length,
                    numConsensusEndpoints: successResults.length
                });
            });
    }

    function failoverApiQ(apiMethodName, apiParams, endpoints, timeout) {
        var dfd = Q.defer();
        getCounterpartyConfig().then(function (urls) {
            timeout = timeout || urls.length === 1 ? TIMEOUT_FAILOVER_API_SINGLE : TIMEOUT_FAILOVER_API;
            endpoints = endpoints || urls;

            jsonApiPost(endpoints, apiMethodName, apiParams, timeout)
                .then(function (settledResults) {
                    if (detect525(apiMethodName, settledResults)) {
                        return dfd.reject('The server(s) are currently updating and/or not caught up to the blockchain. Logging you out. Please try logging in again later. (Most likely this message is due to the server being updated.)');
                    }

                    return dfd.resolve(settledResults);
                }, function (err) {
                    if (!endpoints.length) {
                        return dfd.reject(err);
                    }

                    failoverApiQ(apiMethodName, apiParams, _.rest(endpoints), timeout)
                        .then(function (result) {
                            dfd.resolve(result);
                        }, function (err) {
                            dfd.reject(err);
                        });
                });
        });

        return dfd.promise;
    }

    function supportUnconfirmedChangeParam(method) {
        return method.split("_").shift() === "create" && getDestType(method) === "counterpartyd";
    }


    /*
     AVAILABLE API CALL METHODS:
     * failoverAPI: Used for all counterpartyd get_ API requests (for now...later we may want to move to multiAPINewest)
     * multiAPI: Used for storing counterblockd state data (store_preferences, store_chat_handle, etc)
     * multiAPINewest: Used for fetching state data from counterblockd (e.g. get_preferences, get_chat_handle)
     * multiAPIConsensus: Used for all counterpartyd create_ API requests
     */

    return {
        multiApiFirstResultQ: multiApiFirstResultQ,
        failoverApiQ: failoverApiQ,
        multiAPIConsensusQ: multiAPIConsensusQ,
        multiApiNewestQ: multiApiNewestQ,
        supportUnconfirmedChangeParam: supportUnconfirmedChangeParam
    };
}));
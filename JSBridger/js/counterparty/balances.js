/**
 * Created by eitanr on 9/21/14.
 */
(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['lodash', './api', './utils/util.bitcoin', './consts'], function (_, api, btcUtils, consts) {
            return factory(_, api, btcUtils, consts);
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('lodash'), require('./api'), require('./utils/util.bitcoin'), require('./consts'));
    } else {
        // Browser globals
        root.balances = factory(root._, root.api, root.btcUtils, root.consts);
    }
}(this, function (_, api, btcUtils, consts) {
    'use strict';

    function getCounterpartyBalances(address) {
        return api.failoverApiQ("get_normalized_balances", {'addresses': [address]});
    }

    function getBtcBalance(address) {
        return api.failoverApiQ("get_chain_address_info", {
            addresses: [address],
            with_uxtos: true,
            with_last_txn_hashes: 5
        }).then(function (data) {
            var item = data[0].info; //always one address in this case
            return {
                confirmedRawBal: _.parseInt(item.balanceSat || 0),
                unconfirmedRawBal: _.parseInt(item.unconfirmedBalanceSat || 0)
            };
        });
    }

    function getBalances(address) {
        return getCounterpartyBalances(address).then(function (counterpartyBalances) {
                return getBtcBalance(address).then(function (btcBalances) {
                    var gemsBalance = _.find(counterpartyBalances, function (value) {
                            return value.asset.toUpperCase() === consts.GEMS_COUNTERPARTY_TOKEN;
                        }) || {};

                    var btcBalance = btcUtils.normalizeQuantity(btcBalances.confirmedRawBal + btcBalances.unconfirmedRawBal);

                    return {
                        gemsBalance: gemsBalance.normalized_quantity || 0,
                        btcBalance: btcBalance || 0
                    };
                });
            }
        );
    }

    return {
        getBalances: getBalances
    };
}));
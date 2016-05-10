/**
 * Created by eitanr on 12/19/14.
 */

(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['./components/Session', './passphrase', './balances', './utils/util.bitcoin', 'q', 'lodash', './consts'], function (Session, passphrase, balances, btcUtils, Q, _, consts) {
            return factory(Session, passphrase, balances, btcUtils, Q, _, consts);
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./components/Session'), require('./passphrase'), require('./balances'), require('./utils/util.bitcoin'), require('q'), require('lodash'), require('./consts'));
    } else {
        // Browser globals
        root.cpWrapper = factory(root.Session, root.passphrase, root.balances, root.btcUtils, root.Q, root._, root.consts);
    }
}(this, function (Session, passphraseModule, balances, btcUtils, Q, _, consts) {
    'use strict';

    var getBalances_Error = 'An error occured. please try again later.';
    var openWallet_InvalidPassphrase = 'Invalid Passphrase.';

    function normalizeAssetName(assetName) {
        assetName = (assetName || '').toUpperCase();

        return assetName === 'GEMS' ? consts.GEMS_COUNTERPARTY_TOKEN : assetName;
    }

    function openWallet(passphrase) {
        if (!passphraseModule.isValid(passphrase)) {
            return Q({
                success: false,
                error: openWallet_InvalidPassphrase
            });
        }

        return (new Session(passphrase)).then(function (wallet) {
            return {
                walletId: wallet.identifier,
                walletAddress: wallet.addresses[0].ADDRESS,
                testnet: consts.USE_TESTNET,
                success: true
            };
        }, function (err) {
            return {
                success: false,
                error: err.toString()
            };
        });
    }

    function refreshBalances(wallet) {
        var addresses = _.map(wallet.addresses, function (address) {
            return address.ADDRESS;
        });

        return wallet.refreshBTCBalances(true, addresses).then(function () {
            return wallet.refreshCounterpartyBalances(addresses);
        });
    }

    function doTransaction(wallet, destinationAddress, assetName, quantity) {
        var sourceAddress = wallet.addresses[0].ADDRESS;
        var canDoTransaction = wallet.canDoTransaction(sourceAddress);

        if (!canDoTransaction.result) {
            return Q.reject(canDoTransaction.reason);
        }

        return wallet.doTransaction(sourceAddress, 'create_send', {
            source: sourceAddress,
            destination: destinationAddress,
            quantity: btcUtils.denormalizeQuantity(parseFloat(quantity), true),
            asset: normalizeAssetName(assetName),
            _divisible: true
        });
    }

    function sendAsset(passphrase, destinationAddress, assetName, quantity) {
        return (new Session(passphrase)).then(function (wallet) {
            return Q()
                .then(function () {
                    return refreshBalances(wallet);
                })
                .then(function () {
                    return doTransaction(wallet, destinationAddress, assetName, quantity);
                })
                .then(function (/*result*/) {
                    return {
                        success: true
                    };
                }, function (err) {
                    return {
                        error: err.toString(),
                        success: false
                    };
                });
        });
    }

    function getPassphrase() {
        return {
            success: true,
            passphrase: passphraseModule.generate()
        };
    }

    function getBalances(address) {
        return balances.getBalances(address)
            .then(function (balances) {
                return _.defaults(balances || {}, {
                    success: true
                });
            }, function (errorMessage) {
                console.log(errorMessage);
                return {
                    success: false,
                    error: getBalances_Error
                };
            });
    }

    return {
        openWallet: openWallet, //used by client
        getPassphrase: getPassphrase, //used by client
        getBalances: getBalances, //used by client
        sendAsset: sendAsset //used by client
    };
}));

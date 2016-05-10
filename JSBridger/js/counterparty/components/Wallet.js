(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['../consts.js', '../api.js', '../utils/util.generic.js', '../utils/util.bitcoin.js', './Address.js', 'q', 'lodash'], function (consts, api, generic, btcUtils, Address, Q, _) {
            return factory(consts, api, generic, btcUtils, Address, Q, _);
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../consts.js'), require('../api.js'), require('../utils/util.generic.js'), require('../utils/util.bitcoin.js'), require('./Address.js'), require('q'), require('lodash'));
    } else {
        // Browser globals
        root.Wallet = factory(root.consts, root.api, root.generic, root.btcUtils, root.Address, root.Q, root._);
    }
}(this, function (consts, api, generic, btcUtils, Address, Q, _) {
    'use strict';

    function Wallet() {
        //The user's wallet
        var self = this;
        self.BITCOIN_WALLET = null; // CWHierarchicalKey instance
//    self.autoRefreshBTCBalances = true; //auto refresh BTC balances every 5 minutes

        self.identifier = null; //set when logging in
        self.networkBlockHeight = null; //stores the current network block height. refreshed when we refresh the BTC balances
        self.addresses = []; //ko.observableArray(); //AddressViewModel objects -- populated at login

        self.isNew = false; //set to true if we can't find the user's prefs when logging on. if set, we'll show some intro text on their login, etc.
        self.isExplicitlyNew = false; //set to true if the user explicitly clicks on Create New Wallet and makes it (e.g. this may be false and isNew true if the user typed in the wrong passphrase, or manually put the words together)
        self.isOldWallet = false;

        self.addAddress = function (type, address, armoryPubKey) {
            var key;

            generic.assert(["normal", "watch", "armory"].indexOf(type) !== -1);
            generic.assert((type === "normal" && !address) || address);
            generic.assert((type === "armory" && armoryPubKey) || !armoryPubKey);

            if (type === "normal") {
                //adds a key to the wallet, making a new address object on the wallet in the process
                //(assets must still be attached to this address, with updateBalances() or other means...)
                //also, a label should already exist for the address in PREFERENCES.address_aliases by the time this is called

                //derive an address from the key (for the appropriate network)
                // m : masterkery / 0' : first private derivation / 0 : external account / i : index
                key = self.BITCOIN_WALLET.getAddressKey(self.addresses.length);
                address = key.getAddress();
                armoryPubKey = null;
            } else {
                key = null;
            }

            //Make sure this address doesn't already exist in the wallet (sanity check)
            generic.assert(!self.getAddressObj(address), "Cannot addAddress: " + type + " address already exists in wallet!");

            //see if there's a label already for this address that's stored in PREFERENCES, and use that if so
            var addressHash = btcUtils.hashToB64(address);
            //^ we store in prefs by a hash of the address so that the server data (if compromised) cannot reveal address associations
            var label = consts.PREFERENCES.address_aliases[addressHash] || (type === 'normal' ? "My Address #" + (self.addresses.length + 1) : 'UNKNOWN LABEL');
            //^ an alias is made when a watch address is made, so this should always be found
            self.addresses.push(new Address(type, key, address, label, armoryPubKey)); //add new
            console.log(type, "wallet address added: " + address + " -- hash: " + addressHash + " -- label: " + label + " -- armoryPubKey: " + armoryPubKey);

            return address;
        };

        self.getAddressesList = function (withLabel) {
            return _.map(self.addresses, function (address) {
                if (withLabel) {
                    return [address.ADDRESS, address.label, address.getXCPBalance(), address.PUBKEY];
                }
                return address.ADDRESS;
            });
        };

        self.getBiggestXCPBalanceAddress = function () {
            var maxAmount = 0;
            var maxAddress = null;

            _.forEach(self.addresses, function (address) {
                var xcpBalance = address.getXCPBalance();
                if (xcpBalance > maxAmount) {
                    maxAmount = xcpBalance;
                    maxAddress = address;
                }
            });

            return maxAddress;

        };

        self.getAddressObj = function (address) {
            //given an address string, return a reference to the corresponding AddressViewModel object
            return _.find(self.addresses, function (a) {
                    return a.ADDRESS === address;
                }) || null;
        };

        self.getBalance = function (address, asset, normalized) {
            if (typeof normalized === 'undefined') {
                normalized = true;
            }
            var addressObj = self.getAddressObj(address);
            generic.assert(addressObj);
            var assetObj = addressObj.getAssetObj(asset);
            if (!assetObj) {
                return 0;//asset not in wallet
            }
            if (asset !== 'BTC') {
                return normalized ? assetObj.availableBalance() : assetObj.rawAvailableBalance();
            }

            var bal = assetObj.normalizedBalance() + assetObj.getUnconfirmedBalance();
            return normalized ? bal : btcUtils.denormalizeQuantity(bal);

        };

        self.getPubkey = function (address) {
            var addressObj = self.getAddressObj(address);
            generic.assert(addressObj);
            return addressObj.PUBKEY;
        };

        self.updateBalance = function (address, asset, rawBalance, unconfirmedRawBal) {
            //Update a balance for a specific asset on a specific address. Requires that the asset exist
            var addressObj = self.getAddressObj(address);
            generic.assert(addressObj);
            var assetObj = addressObj.getAssetObj(asset);
            if (assetObj) {
                assetObj.rawBalance = rawBalance;
                if (asset === 'BTC' && unconfirmedRawBal) {
                    assetObj.setUnconfirmedBalance(btcUtils.normalizeQuantity(unconfirmedRawBal));
                    assetObj.balanceChangePending = true;
                } else if (asset === 'BTC') {
                    assetObj.setUnconfirmedBalance(0);
                    assetObj.balanceChangePending = false;
                }
            } else {
                generic.assert(asset !== "XCP" && asset !== "BTC", "BTC or XCP not present in the address?"); //these should be already in each address
                //we're trying to update the balance of an asset that doesn't yet exist at this address
                //fetch the asset info from the server, and then use that in a call to addressObj.addOrUpdateAsset
                api.failoverApiQ("get_asset_info", {'assets': [asset]}).then(function (assetsInfo) {
                    addressObj.addOrUpdateAsset(asset, assetsInfo[0], rawBalance);
                });
            }
            return true;
        };

        self.getAddressesWithAsset = function (asset) {
            return _.reduce(self.getAddressesList(), function (addressesWithAssets, address) {
                var addressObj = self.getAddressObj(address);
                var assetObj = addressObj.getAssetObj(asset);
                if (assetObj) {
                    addressesWithAssets.push(assetObj.ADDRESS);
                }
                //if this address doesn't have the asset...that's fine
                return addressesWithAssets;
            }, []);
        };

        self.getTotalBalance = function (asset, normalized) { //gets the balance of an asset across all addresses
            if (typeof normalized === 'undefined') {
                normalized = true;
            }
            var rawBalance = 0;
            var divisible = null;
            var addressObj = null;
            var assetObj = null;
            var i = null;
            var j = null;

            for (i = 0; i < self.addresses.length; i++) {
                addressObj = self.addresses[i];
                for (j = 0; j < addressObj.assets.length; j++) {
                    assetObj = addressObj.assets[j];
                    if (assetObj.ASSET === asset) {
                        rawBalance += assetObj.rawBalance;
                        if (divisible === null) {
                            divisible = assetObj.DIVISIBLE;
                        }
                    }
                }
            }
            return normalized ? btcUtils.normalizeQuantity(rawBalance, divisible) : rawBalance;
        };

        self.getAssetsInWallet = function () { //gets assets that the user has a balance of
            //this is not optimized... O(n^2)
            var assets = [];
            var addressObj = null, assetObj = null, i = null, j = null;
            for (i = 0; i < self.addresses.length; i++) {
                addressObj = self.addresses[i];
                for (j = 0; j < addressObj.assets.length; j++) {
                    assetObj = addressObj.assets[j];
                    assets.push(assetObj.ASSET);
                }
            }
            return _.uniq(assets);
        };

        self.isAssetHolder = function (asset) {
            var addressObj = null, assetObj = null, i = null, j = null;
            for (i = 0; i < self.addresses.length; i++) {
                addressObj = self.addresses[i];
                for (j = 0; j < addressObj.assets.length; j++) {
                    assetObj = addressObj.assets[j];
                    if (assetObj.ASSET === asset) {
                        return true;
                    }
                }
            }
            return false;
        };

        self.isAssetDivisibilityAvailable = function (asset) {
            var divisible = -1;
            var addressObj = null, assetObj = null, i = null, j = null;
            for (i = 0; i < self.addresses.length; i++) {
                addressObj = self.addresses[i];
                for (j = 0; j < addressObj.assets.length; j++) {
                    assetObj = addressObj.assets[j];
                    if (assetObj.ASSET === asset) {
                        divisible = assetObj.DIVISIBLE ? 1 : 0;
                    }
                }
            }
            return divisible;
        };

        self.getAssetsDivisibility = function (assets, callback) {
            var assetsDivisibility = {};
            var notAvailable = [];

            // check if the wallet have the information
            for (var a in assets) {
                var asset = assets[a];
                if (asset === 'XCP' || asset === 'BTC') {
                    assetsDivisibility[asset] = true;
                } else {
                    var divisible = self.isAssetDivisibilityAvailable(asset);
                    if (divisible == -1) {
                        notAvailable.push(asset)
                    } else {
                        assetsDivisibility[asset] = (divisible == 1);
                    }
                }
            }

            if (notAvailable.length > 0) {
                // else make a query to counterpartyd
                api.failoverApiQ("get_asset_info", {'assets': notAvailable})
                    .then(function (assetsInfo) {
                        _.forOwn(assetsInfo, function (a) {
                            assetsDivisibility[assetsInfo[a].asset] = assetsInfo[a].divisible;
                        });
//                    for (var a in assetsInfo) {
//                        assetsDivisibility[assetsInfo[a].asset] = assetsInfo[a].divisible;
//                    }
                        callback(assetsDivisibility);
                    });
            } else {
                callback(assetsDivisibility);
            }
        };

        self.getAssetsOwned = function () { //gets assets the user actually owns (is issuer of)
            //this is not optimized... O(n^2)
            var assets = [];
            var addressObj = null, assetObj = null, i = null, j = null;
            for (i = 0; i < self.addresses.length; i++) {
                addressObj = self.addresses[i];
                for (j = 0; j < addressObj.assets.length; j++) {
                    assetObj = addressObj.assets[j];
                    if (assetObj.isMine())
                        assets.push(assetObj.ASSET);
                }
            }
            return _.uniq(assets);
        };

        self.refreshCounterpartyBalances = function (addresses, onSuccess, onError) {
            //update all counterparty asset balances for the specified address (including XCP)
            //Note: after login, this normally never needs to be called (except when adding a watch address),
            // as counterparty asset balances are updated automatically via the messages feed
            return api.failoverApiQ("get_normalized_balances", {'addresses': addresses}).then(function (balancesData) {
                console.log("Got initial balances: " + JSON.stringify(balancesData));

                if (!balancesData.length) {
                    console.log('user has no balance (i.e. first time logging in)');
                    //if (onSuccess) {
                    //    return onSuccess();
                    //}
                    return Q();
                }

                var numBalProcessed = 0;
                //Make a unique list of assets
                var assets = [];

                for (var i = 0; i < balancesData.length; i++) {
                    if (assets.indexOf(balancesData[i].asset) === -1) {
                        assets.push(balancesData[i].asset);
                    }
                }

                // TODO: optimize: assets infos already fetched in get_normalized_balances() in counterblockd
                return api.failoverApiQ("get_asset_info", {'assets': assets}).then(function (assetsInfo) {
                    return api.failoverApiQ("get_escrowed_balances", {'addresses': addresses}).then(function (escrowedBalances) {
                        _.forEach(assetsInfo, function (info) {
                            _.forEach(balancesData, function (balance) {
                                if (balance.asset === info.asset) {
                                    var address = balance.address;
                                    var asset = info.asset;
                                    var escrowedBalance = 0;
                                    if (escrowedBalances[address] && escrowedBalances[address][asset]) {
                                        escrowedBalance = escrowedBalances[address][asset];
                                    }
                                    self.getAddressObj(address).addOrUpdateAsset(asset, info, balance.quantity, escrowedBalance);
                                    numBalProcessed += 1;
                                    //if (numBalProcessed == balancesData.length && onSuccess) {
                                    if (numBalProcessed === balancesData.length) {
                                        return Q();
                                    }
                                }
                            });
                        });
                    });
                });
            });
        };

        self.refreshBTCBalances = function (isRecurring, addresses) {
            var dfd = Q.defer();

            //update all BTC balances (independently, so that one addr with a bunch of txns doesn't hold us up)
            if (addresses == undefined || addresses == null) {
                addresses = self.getAddressesList();
            }

            var addressObj = null;

            self.retriveBTCAddrsInfo(addresses).then(function (data) {
                //refresh the network block height (this is a bit hackish as blockHeight is embedded into each address object,
                // and they are all the same values, but we just look at the first value...we do it this way to avoid an extra API call every 5 minutes)
                if (data.length >= 1) {
                    self.networkBlockHeight = data[0]['blockHeight'];
                }

                _.forEach(data, function (item) {
                    //if someone sends BTC using the wallet, an entire TXout is spent, and the change is routed back. During this time
                    // the (confirmed) balance will be decreased by the ENTIRE quantity of that txout, even though they may be getting
                    // some/most of it back as change. To avoid people being confused over this, with BTC in particular, we should
                    // display the unconfirmed portion of the balance in addition to the confirmed balance, as it will include the change output
                    self.updateBalance(item['addr'], "BTC", item['confirmedRawBal'], item['unconfirmedRawBal']);

                    addressObj = self.getAddressObj(item['addr']);
                    generic.assert(addressObj, "Cannot find address in wallet for refreshing BTC balances!");

                    if (item['confirmedRawBal'] > 0 || item['unconfirmedRawBal'] > 0 ||
                        item['numPrimedTxoutsIncl0Confirms'] > 0 || item['numPrimedTxouts'] > 0 ||
                        item['lastTxns'] > 0) {
                        addressObj.withMovement = true;
                    }

                    if (item['confirmedRawBal'] && !addressObj.IS_WATCH_ONLY) {
                        //Also refresh BTC unspent txouts (to know when to "reprime" the account)
                        addressObj.numPrimedTxouts = item.numPrimedTxouts;
                        addressObj.numPrimedTxoutsIncl0Confirms = item.numPrimedTxoutsIncl0Confirms;

                        console.log("refreshBTCBalances: Address " + item['addr'] + " -- confirmed bal = " + item['confirmedRawBal']
                        + "; unconfirmed bal = " + item['unconfirmedRawBal'] + "; numPrimedTxouts = " + item['numPrimedTxouts']
                        + "; numPrimedTxoutsIncl0Confirms = " + item['numPrimedTxoutsIncl0Confirms']);


                    } else { //non-watch only with a zero balance == no primed txouts (no need to even try and get a 500 error)
                        addressObj.numPrimedTxouts = 0;
                        addressObj.numPrimedTxoutsIncl0Confirms = 0;
                    }
                });

                dfd.resolve();

            }, function (err) {
                //insight down or spazzing, set all BTC balances out to null
                console.log(err);
                var addressObj = null;
                for (var i = 0; i < addresses.length; i++) {
                    self.updateBalance(addresses[i], "BTC", null, null); //null = UNKNOWN
                    addressObj = self.getAddressObj(addresses[i]);
                    addressObj.numPrimedTxouts = null; //null = UNKNOWN
                    addressObj.numPrimedTxoutsIncl0Confirms = null; //null = UNKNOWN
                }
                dfd.reject("Got an error when trying to sync BTC balances: " + err.toString());
            });

            return dfd.promise;
        };

        self.removeKeys = function () {
            //removes all keys (addresses) from the wallet. Normally called when logging out
            //stop BTC balance timer on each address
            _.forEach(self.addresses, function (a) {
                a.doBTCBalanceRefresh = false;
            });
            self.addresses = []; //clear addresses
        };


        /////////////////////////
        //BTC-related
        self.broadcastSignedTx = function (signedTxHex) {
            if (signedTxHex === false) {
                return Q.reject("Client-side transaction validation FAILED. Transaction will be aborted and NOT broadcast." +
                " Please contact the Counterparty development team");
                //console.log("Client-side transaction validation FAILED. Transaction will be aborted and NOT broadcast."
                //+ " Please contact the Counterparty development team");
                //return false;
            }
            console.log("RAW SIGNED HEX: " + signedTxHex);

            return api.failoverApiQ("broadcast_tx", {"signed_tx_hex": signedTxHex});
        };

        self.signAndBroadcastTxRaw = function (key, unsignedTxHex, verifySourceAddr, verifyDestAddr) {
            generic.assert(verifySourceAddr, "Source address must be specified");
            generic.assert(verifyDestAddr, "Destination address must be specified");
            //Sign and broadcast a multisig transaction that we got back from counterpartyd (as a raw unsigned tx in hex)
            //* verifySourceAddr and verifyDestAddr MUST be specified to verify that the txn hash we get back from the server is what we expected.

            console.log("RAW UNSIGNED HEX: " + unsignedTxHex);

            //Sign the input(s)
            var signedHex = key.checkAndSignRawTransaction(unsignedTxHex, verifyDestAddr);
            return self.broadcastSignedTx(signedHex);
        };

        self.signAndBroadcastTx = function (address, unsignedTxHex, verifyDestAddr) {
            var key = self.getAddressObj(address).KEY;
            return self.signAndBroadcastTxRaw(key, unsignedTxHex, address, verifyDestAddr);
        };

        self.retriveBTCAddrsInfo = function (addresses) {
            //generic.assert(onSuccess, "onSuccess callback must be defined");

            return api.failoverApiQ("get_chain_address_info", {
                addresses: addresses,
                with_uxtos: true,
                with_last_txn_hashes: 5
            }).then(function (chainAddressInfo) {
                var results = _.reduce(chainAddressInfo, function (res, addressInfo) {
                    var totalBalance = _.reduce(addressInfo.uxtos, function (res, uxto) {
                        return res + btcUtils.denormalizeQuantity(uxto.amount);
                    }, 0);

                    var primedTxoutsIncl0Confirms = _.filter(addressInfo.uxtos, function (uxto) {
                        return btcUtils.denormalizeQuantity(uxto.amount) >= consts.MIN_PRIME_BALANCE;
                    });

                    var suitableUnspentTxouts = _.filter(primedTxoutsIncl0Confirms, function (uxto) {
                        return uxto.confirmations >= 1;
                    });

                    res.push({
                        addr: addressInfo.addr,
                        blockHeight: addressInfo.block_height,
                        confirmedRawBal: _.parseInt(addressInfo.info.balanceSat || 0),
                        unconfirmedRawBal: _.parseInt(addressInfo.info.unconfirmedBalanceSat || 0),
                        numPrimedTxouts: Math.min(suitableUnspentTxouts.length, Math.floor(totalBalance / consts.MIN_PRIME_BALANCE)),
                        numPrimedTxoutsIncl0Confirms: Math.min(primedTxoutsIncl0Confirms.length, Math.floor(totalBalance / consts.MIN_PRIME_BALANCE)),
                        lastTxns: addressInfo.last_txns,
                        rawUtxoData: addressInfo.uxtos
                    });

                    return res;
                }, []);

                return Q(results);
            }, function (err) {
                return Q.reject(err);
            });
        };

        /////////////////////////
        //Counterparty transaction-related
        self.canDoTransaction = function (address) {
            /* ensures that the specified address can perform a counterparty transaction */
            var addressObj = self.getAddressObj(address);
            generic.assert(!addressObj.IS_WATCH_ONLY, "Cannot perform this action on a watch only address!");
            if (addressObj.IS_WATCH_ONLY) {
                return {
                    reason: 'Cannot perform this action on a watch only address!',
                    result: false
                };
            }

            if (self.getBalance(address, "BTC", false) < consts.MIN_PRIME_BALANCE) {
                return {
                    reason: "Cannot do this action as you have insufficient BTC at this address. " +
                    "Due to Bitcoin fees, each Counterparty action requires " +
                    "approximately " + btcUtils.normalizeQuantity(consts.MIN_PRIME_BALANCE) + " BTC to perform. " +
                    "Please deposit the necessary BTC into \"" + btcUtils.getAddressLabel(address) + "\" and try again.",
                    result: false
                };
            }

            return {
                result: true
            };
        };

        self.doTransaction = function (address, action, data) {
            generic.assert(['sign_tx', 'broadcast_tx', 'convert_armory_signedtx_to_raw_hex'].indexOf(action) === -1,
                'Specified action not supported through this function. please use appropriate primatives');

            var addressObj = self.getAddressObj(address);
            var createSuccessResponse = function (txHash, data, endpoint, addressType, armoryUTx) {
                return {
                    txHash: txHash,
                    data: data,
                    endpoint: endpoint,
                    addressType: addressType,
                    armoryUTx: armoryUTx
                };
            };

            //should not ever be a watch only wallet
            //assert(!addressObj.IS_WATCH_ONLY);

            //specify the pubkey for a multisig tx
            //assert(data['encoding'] === undefined);
            //assert(data['pubkey'] === undefined);
            data.encoding = 'multisig';
            data.pubkey = addressObj.PUBKEY;
            //find and specify the verifyDestAddr

            if (consts.ALLOW_UNCONFIRMED_INPUTS && api.supportUnconfirmedChangeParam(action)) {
                data.allow_unconfirmed_inputs = true;
            }

            //hacks for passing in some data that should be sent to PENDING_ACTION_FEED.add(), but not the create_ API call
            // here we only have to worry about what we create a txn for (so not order matches, debits/credits, etc)
            var extra1 = null, extra2 = null;

            if (action === 'create_order') {
                extra1 = data._give_divisible;
                extra2 = data._get_divisible;
                delete data._give_divisible;
                delete data._get_divisible;
            }

            if (action === 'create_cancel') {
                extra1 = data._type;
                extra2 = data._tx_index;
                delete data._tx_index;
                delete data._type;
            }

            if (action === 'create_send') {
                extra1 = data._divisible;
                delete data._divisible;
            }

            var verifyDestAddr = data.destination || data.transfer_destination || data.feed_address || data.destBtcPay || data.source;
            delete data.destBtcPay;

            if (action === "create_burn") {
                verifyDestAddr = consts.TESTNET_UNSPENDABLE;
            }

            if (action === "create_dividend" && data.dividend_asset === 'BTC') {
                verifyDestAddr = data._btc_dividend_dests;
                delete data._btc_dividend_dests;
            }

            if (typeof(verifyDestAddr) === 'string') {
                verifyDestAddr = [verifyDestAddr];
            }

            //Do the transaction
            return api.multiAPIConsensusQ(action, data)
                .then(function (result) {
                    var unsignedTxHex = result.data;
                    console.log("TXN CREATED. numTotalEndpoints=" + result.numTotalEndpoints + ", numConsensusEndpoints=" + result.numConsensusEndpoints + ", RAW HEX=" + unsignedTxHex);

                    return self.signAndBroadcastTx(address, unsignedTxHex, verifyDestAddr).then(function (txHash, endpoint) {
                        //register this as a pending transaction
                        data.source = data.source || address;

                        if (action === 'create_order') {
                            data._give_divisible = extra1;
                            data._get_divisible = extra2;
                        } else if (action === 'create_cancel') {
                            data._type = extra1;
                            data._tx_index = extra2;
                        } else if (action === 'create_send') {
                            data._divisible = extra1;
                        }

                        var successResponse = createSuccessResponse(txHash, data, endpoint, 'normal', null);
                        console.log('sendAsset success: ', JSON.stringify(successResponse));
                        return Q(successResponse);
                    });
                });
        };

        self.storePreferences = function (callback, forLogin) {
            var params = {
                'wallet_id': self.identifier,
                'preferences': consts.PREFERENCES,
                'network': consts.USE_TESTNET ? 'testnet' : 'mainnet'
            };
            if (forLogin) {
                params.for_login = true;
            }
            return api.multiApiFirstResultQ("store_preferences", params).then(callback);
        };
    }

    return Wallet;

}));
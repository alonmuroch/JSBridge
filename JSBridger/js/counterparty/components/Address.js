(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['../utils/util.generic', '../utils/util.bitcoin', './Asset', '../api', 'lodash'], function (generic, btcUtils, Asset, api, _) {
            return factory(generic, btcUtils, Asset, api, _);
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../utils/util.generic'), require('../utils/util.bitcoin'), require('./Asset'), require('../api'), require('lodash'));
    } else {
        // Browser globals
        root.Address = factory(root.generic, root.btcUtils, root.Asset, root.api, root._);
    }
}(this, function (generic, btcUtils, Asset, api, _) {
    'use strict';

    function AddressViewModel(type, key, address, initialLabel, armoryPubKey) {
        //An address on a wallet
        //type is one of: normal, watch, armory
        generic.assert(['normal', 'watch', 'armory'].indexOf(type) !== -1);
        generic.assert((type === 'normal' && key) || (type === 'watch' && !key) || (type === 'armory' && !key));
        generic.assert((type === 'armory' && armoryPubKey) || !armoryPubKey); //only used with armory addresses

        var self = this;

        self.KEY = key; //  key : the HierarchicalKey bitcore object
        self.TYPE = type;
        self.ADDRESS = address;
        self.PUBKEY = type === 'armory' ? armoryPubKey : (key ? key.getPub() : ''); //hex string

        //Accessors for ease of use in templates...
        self.FEATURE_DIVIDEND = true; //counterWallet.disabledFeatures.indexOf('dividend') == -1;
        self.IS_NORMAL = (type === 'normal');
        self.IS_WATCH_ONLY = (type === 'watch');
        self.IS_ARMORY_OFFLINE = (type === 'armory');

        self.lastSort = '';
        self.lastSortDirection = '';

        self.label = initialLabel;
        self.numPrimedTxouts = null;
        //^ # of unspent txouts for this address fitting our criteria, or null if unknown (e.g. insight is down/not responding)
        self.numPrimedTxoutsIncl0Confirms = null;
        self.withMovement = false;

        self.assets = [
            new Asset({address: address, asset: "BTC"}), //will be updated with data loaded from insight
            new Asset({address: address, asset: "XCP"}),  //will be updated with data loaded from counterpartyd
            new Asset({address: address, asset: "GEMS"})
        ];

        self.getAssetObj = function (requestedAsset) {
            //given an asset string, return a reference to the corresponding AssetViewModel object
            return _.find(self.assets, function (asset) {
                return asset.ASSET === requestedAsset;
            });
        };

        self.getAssetsList = function () {
            return _.map(self.assets, function (asset) {
                return asset.ASSET;
            });
        };

        self.updateEscrowedBalances = function () {
            api.failoverApiQ("get_escrowed_balances", {'addresses': [self.ADDRESS]})
                .then(function (escrowedBalances) {
                    if (!escrowedBalances[self.ADDRESS]) {
                        return;
                    }
                    //TODO: make sure forOwn fits here
                    _.forOwn(escrowedBalances[self.ADDRESS], function (value, asset) {
                        var assetObj = self.getAssetObj(asset);
                        if (assetObj) {
                            assetObj.escrowedBalance(escrowedBalances[self.ADDRESS][asset]);
                        }
                    });
                });
        };

        self.addOrUpdateAsset = function (asset, assetInfo, initialRawBalance, escrowedBalance) {
            //Update asset property changes (ONLY establishes initial balance when logging in! -- past that, balance changes
            // come from debit and credit messages)
            //initialRawBalance is null if this is not an initial update
            //assetInfo comes from a call to get_asset_info, or as an issuance message feed object itself
            var match = _.find(self.assets, function (item) {
                return item.ASSET === asset;
            });

            if (asset === 'BTC' || asset === 'XCP') { //special case update
                generic.assert(match); //was created when the address viewmodel was initialized...
                match.rawBalance = initialRawBalance;
                match.escrowedBalance = escrowedBalance;
                return;
            }

            if (!match) {
                //add the asset if it doesn't exist. this can be triggered on login (from get_asset_info API results)
                // OR via the message feed (through receiving an asset send or ownership transfer for an asset not in the address yet)
                console.log("Adding token " + asset + " to address " + self.ADDRESS + " with raw bal " + initialRawBalance + " (divisible: " + assetInfo.divisible + ")");

                var assetProps = {
                    address: self.ADDRESS,
                    asset: asset,
                    divisible: assetInfo.divisible,
                    owner: assetInfo.owner || assetInfo.issuer,
                    locked: assetInfo.locked,
                    rawBalance: initialRawBalance,
                    rawSupply: assetInfo.supply || assetInfo.quantity,
                    description: assetInfo.description,
                    callable: assetInfo.callable,
                    callDate: assetInfo.call_date,
                    callPrice: assetInfo.call_price,
                    rawEscrowedBalance: escrowedBalance,
                    escrowedBalance: btcUtils.normalizeQuantity(escrowedBalance, assetInfo.divisible)
                };

                self.assets.push(new Asset(assetProps)); //add new
            } else {
                //update existing. NORMALLY this logic is really only reached from the messages feed, however, we can have the
                // case where if we have a sweep operation for instance (which will show up as an asset transfer and credit
                // message received on the same block, at about the same time), due to API calls that are made in the handlers for
                // these, we could have a potential race condition where WALLET.updateBalance ends up calling this function
                // instead of just updating the rawBalance itself. We should be able to gracefully handle that...
                if (initialRawBalance) {
                    match.rawBalance = initialRawBalance;
                    return;
                }

                //Now that that's out of the way, in cases after here, we should only reach this from the messages feed
                generic.assert(assetInfo.owner === undefined, "Logic should only be reached via messages feed data, not with get_asset_info data");

                if (assetInfo.description !== match.description) {
                    //when the description changes, the balance will get 0 passed into it to note this. obviously, don't take that as the literal balance :)
                    console.log("Updating token " + asset + " @ " + self.ADDRESS + " description to '" + assetInfo.description + "'");
                    match.description = assetInfo.description;
                } else if (assetInfo.transfer) {
                    //transfer come in through the messages feed only (get_asset_info results doesn't have a transfer field passed in)
                    console.log("Token " + asset + " @ " + self.ADDRESS + " transferred to '" + assetInfo.issuer + "'");
                    //like with a description change, the balance is passed as 0
                    match.owner = assetInfo.issuer;
                    if (match.isMine() === false && match.rawBalance === 0) {
                        _.pull(self.assets, match);//i.e. remove the asset if it was owned by this address (and no longer is), and had a zero balance
//                    self.assets.remove(match);
                    }
                } else if (assetInfo.locked) { //only add locking (do not change from locked back to unlocked, as that is not valid)
                    console.log("Token " + asset + " @ " + self.ADDRESS + " locked");
                    match.locked = assetInfo.locked;
                } else {
                    //handle issuance increases
                    //assert(match.description() == assetInfo['description']); //description change was handled earlier
                    //assert(match.owner() == (assetInfo['issuer'])); //transfer change was handled earlier
                    //assert(!assetInfo['locked']); //lock change was handled earlier
                    //assert(match.rawSupply() != assetInfo['quantity']);
                    console.log("Updating token " + asset + " @ " + self.ADDRESS + " # issued units. Orig #: " +
                    match.rawSupply + ", new #: " + assetInfo.quantity + ", unconfirmed bal #: " + match.getUnconfirmedBalance());
                    match.rawSupply = assetInfo.quantity;
                }
            }
        };

        self.removeAsset = function (asset) {
            _.remove(self.assets, function (item) {
                return item.ASSET === asset;
            });
        };

        self.getXCPBalance = function () {
            var xcpAsset = _.filter(self.assets, function (value) {
                return value.ASSET === 'XCP';
            });
            return xcpAsset[0].normalizedBalance();
        };

    }

    return AddressViewModel;
}));
(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['../consts', '../api', '../../vendor/cryptojs/components/core-min', '../utils/util.bitcoin.js', '../utils/util.bitcore.js', 'q', 'lodash', './Wallet'], function (consts, api, CryptoJS, btcUtils, bitcoreUtils, Q, _, Wallet) {
            return factory(consts, api, CryptoJS, btcUtils, bitcoreUtils, Q, _, Wallet);
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../consts'), require('../api'), require('../../vendor/cryptojs/components/core-min'), require('../utils/util.bitcoin.js'), require('../utils/util.bitcore.js'), require('q'), require('lodash'), require('./Wallet'));
    } else {
        // Browser globals
        root.Session = factory(root.consts, root.api, root.CryptoJS, root.btcUtils, root.bitcoreUtils, root.Q, root._, root.Wallet);
    }
}(this, function (consts, api, CryptoJS, btcUtils, bitcoreUtils, Q, _, Wallet) {
    'use strict';

    function Session(passphrase) {
        this.passphrase = passphrase;
        this.wallet = new Wallet();
        this.mustSavePrefs = false;
        this.USE_TESTNET = consts.USE_TESTNET;
        this.IS_DEV = consts.IS_DEV;

        return this.openWallet.call(this);
    }

    Session.prototype.openWallet = function () {
        //Start with a gate check to make sure at least one of the servers is ready and caught up before we try to log in
        return Q()
            .then(this.isReady.bind(this))
            .then(this.getPreferences.bind(this))
            .then(function () {
                this.initWallet.call(this);
                this.generateAddress.call(this);
                return this.savePreferences.call(this);
            }.bind(this))
            .then(this.openWalletSuccess.bind(this));
    };

    Session.prototype.getPreferences = function () {
        return api.multiApiNewestQ("get_preferences", {
            'wallet_id': this.wallet.identifier,
            'network': consts.USE_TESTNET ? 'testnet' : 'mainnet',
            'for_login': true
        }, 'last_updated').then(function (data) {
            if (data) {
                consts.PREFERENCES = data.preferences;
                _.defaults(consts.PREFERENCES, consts.DEFAULT_PREFERENCES);
            } else {
                console.log("Stored preferences NOT found on server(s). Creating new...");
                this.wallet.isNew = true;
                this.mustSavePrefs = true;
                consts.PREFERENCES = _.cloneDeep(consts.DEFAULT_PREFERENCES);
            }
        }.bind(this));
    };


    Session.prototype.initWallet = function () {
        this.wallet.BITCOIN_WALLET = new bitcoreUtils.CWHierarchicalKey(this.passphrase);
        this.wallet.isOldWallet = this.wallet.BITCOIN_WALLET.useOldHierarchicalKey;
    };

    Session.prototype.isReady = function () {
        return api.multiApiFirstResultQ('is_ready').then(function (data) {
                console.log("Backend is ready. Testnet: " + consts.USE_TESTNET + ". Last message feed index: " + data.last_message_index);
                var hashBase = CryptoJS.SHA256(this.passphrase + (consts.USE_TESTNET ? '_testnet' : ''));
                this.wallet.identifier = CryptoJS.SHA256(hashBase).toString(CryptoJS.enc.Base64);
                console.log("Wallet ID: " + this.wallet.identifier);

                //Set initial block height (will be updated again on each periodic refresh of BTC account balances)
                this.wallet.networkBlockHeight = data.block_height;

                consts.USER_COUNTRY = data.country; // set user country
                consts.QUOTE_ASSETS = data.quote_assets;// set quote assets

                return Q(this.wallet.identifier);
            }.bind(this),
            function (error) {
                return Q.reject(error);
            });
    };

    Session.prototype.generateAddress = function () {
        var address = this.wallet.addAddress('normal');
        var addressHash = btcUtils.hashToB64(address);
        var addressCount = this.wallet.addresses.length;
        var aliases = consts.PREFERENCES.address_aliases;

        if (!aliases[addressHash]) { //no existing label. we need to set one
            this.mustSavePrefs = true; //if not already true
            aliases[addressHash] = "GEMS - Address #" + addressCount;
        }
        console.log("Address discovery: Generating address " + addressCount + " of " + consts.PREFERENCES.num_addresses_used + ' (' + address + ')');

        if (_.last(this.wallet.addresses).withMovement) {
            console.log("Address discovery: Generating another address...");
            this.generateAddress();
        } else if (consts.PREFERENCES.num_addresses_used !== this.wallet.addresses.length) {
            consts.PREFERENCES.num_addresses_used = this.wallet.addresses.length;
            this.mustSavePrefs = true;
        }
    };

    Session.prototype.savePreferences = function () {
        //store the preferences on the server(s) for future use
        if (this.mustSavePrefs) {
            console.log("Preferences updated/generated during login. Updating on server(s)...");
            return this.wallet.storePreferences(function (result) {
                console.log('preferences saved!', result);
            }, true);
        }

        return Q();
    };

    Session.prototype.openWalletSuccess = function () {
        delete this.mustSavePrefs;

        return Q(this.wallet);
    };

    return Session;
}));
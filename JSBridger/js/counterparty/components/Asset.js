(function (root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['../utils/util.bitcoin'], function (btcUtils) {
            return factory(btcUtils);
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../utils/util.bitcoin'));
    } else {
        // Browser globals
        root.Asset = factory(root.btcUtils);
    }
}(this, function (btcUtils) {
    'use strict';

    //var btcUtils = require('../utils/util.bitcoin');

    function Asset(props) {
        //An address has 2 or more assets (BTC, XCP, and any others)
        var self = this;
        self.ADDRESS = props.address; //will not change
        self.ASSET = props.asset; //assetID, will not change
        self.DIVISIBLE = props.divisible !== undefined ? props.divisible : true;
        self.owner = props.owner;
        self.locked = props.locked !== undefined ? props.locked : false;
        self.rawBalance = props.rawBalance || (self.ASSET === 'BTC' ? null : 0);
        //^ raw (not normalized) (for BTC/XCP, default to null to show '??' instead of 0, until the balance is populated)
        self.rawSupply = props.rawSupply || 0; //raw
        self.SUPPLY = btcUtils.normalizeQuantity(self.rawSupply, self.DIVISIBLE);
        self.holdersSupply = self.rawSupply - self.rawBalance;
        self.description = props.description || '';
        self.CALLABLE = props.callable !== undefined ? props.callable : false;
        self.CALLDATE = props.callDate || null;
        self.CALLPRICE = props.callPrice || null;

        self.balanceChangePending = false;
        //^ if/when set to true, will highlight the balance to show that a balance change is pending
        self.issuanceQtyChangePending = false;
        //^ similar, but for the "Issued" text on owned assets

        self.escrowedBalance = props.rawEscrowedBalance;

        //self.dispEscrowedBalance = function () {
        //    if (self.escrowedBalance) {
        //        return '/ Escr: ' + btcUtils.smartFormat(btcUtils.normalizeQuantity(self.escrowedBalance, self.DIVISIBLE));
        //    }
        //};

        self.updateEscrowedBalance = function (delta) {
            self.escrowedBalance(self.escrowedBalance + delta);
        };

        self.isMine = function () {
            if (self.ASSET === 'BTC' || self.ASSET === 'XCP') {
                return null; //special value for BTC and XCP
            }
            return self.owner === self.ADDRESS;
        };

        self.normalizedBalance = function () {
            if (self.rawBalance === null) {
                return null;
            }
            return btcUtils.normalizeQuantity(self.rawBalance, self.DIVISIBLE);
        };

        self.normalizedTotalIssued = function () {
            return btcUtils.normalizeQuantity(self.rawSupply, self.DIVISIBLE);
        };

        //self.dispTotalIssued = function () {
        //    return btcUtils.smartFormat(self.normalizedTotalIssued());
        //};

        var unconfirmedBalance = 0;
        self.setUnconfirmedBalance = function (value) {
            unconfirmedBalance = value;
            if (value === 0) {
                self.balanceChangePending = false;
            }
        };

        self.getUnconfirmedBalance = function () {
            return unconfirmedBalance;
        };

        self.availableBalance = function () {
            return btcUtils.addFloat(self.normalizedBalance(), self.getUnconfirmedBalance());
        };

        self.rawAvailableBalance = function () {
            return btcUtils.denormalizeQuantity(self.availableBalance(), self.DIVISIBLE);
        };
    }

    return Asset;
}));
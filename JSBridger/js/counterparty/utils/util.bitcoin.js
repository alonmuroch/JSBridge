(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['crypto-js', 'jsdecimal', '../consts.js'], function (CryptoJS, Decimal, consts) {
            return factory(CryptoJS, Decimal, consts);
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('crypto-js'), require('jsdecimal'), require('../consts'));
    } else {
        // Browser globals
        root.btcUtils = factory(root.CryptoJS, root.Decimal, root.consts);
    }
}(this, function (CryptoJS, Decimal, consts) {
    'use strict';

    function normalizeQuantity(quantity, divisible) {
        //Converts from satoshi (int) to float (decimal form)
        if (typeof divisible === 'undefined') {
            divisible = true;
        }
        return divisible && quantity !== 0 ? Decimal.round(new Decimal(quantity).div(consts.UNIT), 8, Decimal.MidpointRounding.ToEven).toFloat() : parseInt(quantity, 10);
        //^ we have the quantity !== 0 check due to a bug in Decimal (https://github.com/hiroshi-manabe/JSDecimal/issues/2)
    }

    function denormalizeQuantity(quantity, divisible) {
        //Converts from float (decimal form) to satoshi (int)
        if (typeof divisible === 'undefined') {
            divisible = true;
        }
        return divisible && quantity !== 0 ? Decimal.round(new Decimal(quantity).mul(consts.UNIT), 8, Decimal.MidpointRounding.ToEven).toFloat() : parseInt(quantity, 10);
        //^ we have the quantity !== 0 check due to a bug in Decimal (https://github.com/hiroshi-manabe/JSDecimal/issues/2)
    }

    function addFloat(floatA, floatB) {
        var a = new Decimal(floatA);
        var b = new Decimal(floatB);
        return Decimal.round(a.add(b), 8, Decimal.MidpointRounding.ToEven).toFloat();
    }

    function hashToB64(content) {
        //used for storing address alias data, for instance
        return CryptoJS.SHA256(content).toString(CryptoJS.enc.Base64);
    }

    function smartFormat(num, truncateDecimalPlacesAtMin, truncateDecimalPlacesTo) { //arbitrary rules to make quantities formatted a bit more friendly
        if (num === null || isNaN(num)) {
            return '??';
        }
        if (num === 0) {
            return num;
        } //avoid Decimal class issue dealing with 0
        if (typeof(truncateDecimalPlacesMin) === 'undefined' || truncateDecimalPlacesMin === null) {
            truncateDecimalPlacesMin = null;
        }
        if (typeof(truncateDecimalPlacesTo) === 'undefined') {
            truncateDecimalPlacesTo = 4;
        }
        if (truncateDecimalPlacesAtMin === null || num > truncateDecimalPlacesAtMin) {
            num = Decimal.round(new Decimal(num), truncateDecimalPlacesTo, Decimal.MidpointRounding.ToEven).toFloat();
        }
        return numberWithCommas(noExponents(num));
    }

    function getAddressLabel(address) {
        //gets the address label if the address is in this wallet
        return consts.PREFERENCES['address_aliases'][hashToB64(address)] || address;
    }

    function bytesToWords(bytes) {
        var words = [];
        for (var i = 0, b = 0; i < bytes.length; i++, b += 8) {
            words[b >>> 5] |= bytes[i] << (24 - b % 32);
        }
        return words;
    }

    function wordsToBytes(words) {
        var bytes = [];
        for (var b = 0; b < words.length * 32; b += 8) {
            bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
        }
        return bytes;
    }

    function bytesToWordArray(bytes) {
        return new CryptoJS.lib.WordArray.init(bytesToWords(bytes), bytes.length);
    }

    function wordArrayToBytes(wordArray) {
        return wordsToBytes(wordArray.words);
    }

    return {
        hashToB64: hashToB64,
        normalizeQuantity: normalizeQuantity,
        bytesToWordArray: bytesToWordArray,
        wordArrayToBytes: wordArrayToBytes,
        smartFormat: smartFormat,
        addFloat: addFloat,
        denormalizeQuantity: denormalizeQuantity,
        getAddressLabel: getAddressLabel
    };
}));
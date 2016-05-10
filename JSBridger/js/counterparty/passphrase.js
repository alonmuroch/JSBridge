/**
 * Created by eitanr on 9/13/14.
 */
(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['../vendor/mnemonic/mnemonic', _], function (Mnemonic, _) {
            return factory(Mnemonic, _);
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../vendor/mnemonic/mnemonic'), require('lodash'));
    } else {
        // Browser globals
        root.passphrase = factory(root.Mnemonic, root._);
    }
}(this, function (Mnemonic, _) {
    'use strict';

    function generate() {
        var mn = new Mnemonic(128);
        return mn.toWords().join(' ');
    }

    function isValid(passphrase) {
        var words = passphrase.split(' ');

        if (words[0] === 'old' || words.length !== 12) {
            return false; //don't support old addresses
        }

        return _.reduce(words, function (isValid, word) {
            return isValid && _.contains(Mnemonic.words, word);
        }, true);
    }

    return {
        generate: generate,
        isValid: isValid
    };
}));
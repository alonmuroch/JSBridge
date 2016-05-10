(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], function () {
            return factory();
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        // Browser globals
        root.generic = factory();
    }
}(this, function () {
    'use strict';


    function assert(condition, message) {
        if (!condition) throw message || "Assertion failed";
    }

    function checkArgType(arg, type) {
        assert((typeof arg).toLowerCase() === type.toLowerCase(), "Invalid argument type");
    }

    function checkArgsType(args, types) {
        for (var a = 0; a < args.length; a++) {
            checkArgType(args[a], types[a]);
        }
    }

    function numberWithCommas(x) {
        //print a number with commas, as appropriate (http://stackoverflow.com/a/2901298)
        if (!isNumber(x)) {
            return x;
        }
        var parts = x.toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join(".");
    }

    function isNumber(n) {
        //http://stackoverflow.com/a/1830844
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    function numberHasDecimalPlace(n) {
        return n % 1 != 0;
    }


    function noExponents(n) {
        /* avoids floats resorting to scientific notation
         * adopted from: http://stackoverflow.com/a/16116500
         */
        var data = String(n).split(/[eE]/);
        if (data.length == 1) return data[0];

        var z = '', sign = this < 0 ? '-' : '',
            str = data[0].replace('.', ''),
            mag = Number(data[1]) + 1;

        if (mag < 0) {
            z = sign + '0.';
            while (mag++) z += '0';
            return z + str.replace(/^\-/, '');
        }
        mag -= str.length;
        while (mag--) z += '0';
        return str + z;
    }

//Dynamic array sort, allows for things like: People.sortBy("Name", "-Surname");
//Won't work below IE9, but totally safe otherwise
//From http://stackoverflow.com/a/4760279 
    !function () {
        function _dynamicSortMultiple(attr) {
            var props = arguments;
            return function (obj1, obj2) {
                var i = 0, result = 0, numberOfProperties = props.length;
                /* try getting a different result from 0 (equal)
                 * as long as we have extra properties to compare
                 */
                while (result === 0 && i < numberOfProperties) {
                    result = _dynamicSort(props[i])(obj1, obj2);
                    i++;
                }
                return result;
            };
        }

        function _dynamicSort(property) {
            var sortOrder = 1;
            if (property[0] === "-") {
                sortOrder = -1;
                property = property.substr(1);
            }
            return function (a, b) {
                var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
                return result * sortOrder;
            };
        }

        Object.defineProperty(Array.prototype, "sortBy", {
            enumerable: false,
            writable: true,
            value: function () {
                return this.sort(_dynamicSortMultiple.apply(null, arguments));
            }
        });
    }();


    function round(amount, decimals) {
        if (decimals === undefined || decimals === null) decimals = 8;
        return Decimal.round(new Decimal(amount), decimals, Decimal.MidpointRounding.ToEven).toFloat();
    }

// Reduce a fraction by finding the Greatest Common Divisor and dividing by it.
    function reduce(numerator, denominator) {
        var gcd = function gcd(a, b) {
            return b ? gcd(b, a % b) : a;
        };
        gcd = gcd(numerator, denominator);
        return [numerator / gcd, denominator / gcd];
    }

    function isValidURL(str) {
        var pattern = /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(\:\d+)?(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(\#[-a-z\d_]*)?$/i;

        return !!str.match(pattern);
    }


    return {
        assert: assert,
        checkArgType: checkArgType,
        checkArgsType: checkArgsType,
        numberWithCommas: numberWithCommas,
        isNumber: isNumber,
        numberHasDecimalPlace: numberHasDecimalPlace,
        noExponents: noExponents,
        round: round,
        reduce: reduce,
        isValidURL: isValidURL
    };
}));
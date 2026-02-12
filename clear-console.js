var CLEAR_CONSOLE = 0;
// 0 - vypisovanie
// 1 - mazanie

var ALLOWED_FILE = "header.js"; // <-- SEM ZADAJ NÁZOV TVOJEHO SUBORU

(function() {
    if (CLEAR_CONSOLE === 1) {
        // ZACHOVÁME PÔVODNÉ METÓDY
        var originalLog = console.log;
        var originalInfo = console.info;
        var originalWarn = console.warn;
        var originalError = console.error;
        var originalDebug = console.debug;
        
        // FUNKCIA NA KONTROLU, ČI LOG POCHÁDZA Z POVOLENÉHO SUBORU
        function isFromAllowedFile() {
            try {
                throw new Error();
            } catch (e) {
                var stack = e.stack || "";
                return stack.includes(ALLOWED_FILE);
            }
        }
        
        // POVOLÍME LEN VÝPISY Z POVOLENÉHO SUBORU
        console.log = function() {
            if (isFromAllowedFile()) {
                originalLog.apply(console, arguments);
            }
        };
        
        console.info = function() {
            if (isFromAllowedFile()) {
                originalInfo.apply(console, arguments);
            }
        };
        
        console.warn = function() {
            if (isFromAllowedFile()) {
                originalWarn.apply(console, arguments);
            }
        };
        
        console.error = function() {
            if (isFromAllowedFile()) {
                originalError.apply(console, arguments);
            }
        };
        
        console.debug = function() {
            if (isFromAllowedFile()) {
                originalDebug.apply(console, arguments);
            }
        };
        
        // Voliteľné: ticho potlačíme aj groupCollapsed, group, groupEnd
        if (console.groupCollapsed) console.groupCollapsed = function() {};
        if (console.group) console.group = function() {};
        if (console.groupEnd) console.groupEnd = function() {};
        if (console.table) console.table = function() {};
        if (console.dir) console.dir = function() {};
        if (console.time) console.time = function() {};
        if (console.timeEnd) console.timeEnd = function() {};
        if (console.trace) console.trace = function() {};
        if (console.assert) console.assert = function() {};
        
        // IHNEDŤ A OPAKOVANE - čistenie každých 10ms
        var clearIntervalId = setInterval(function() {
            if (typeof console !== 'undefined' && typeof console.clear === 'function') {
                // Kontrola, či posledný stack trace obsahuje povolený súbor
                try {
                    throw new Error();
                } catch (e) {
                    var stack = e.stack || "";
                    if (!stack.includes(ALLOWED_FILE)) {
                        console.clear();
                    }
                }
            }
        }, 10);
        
        // Voliteľné: zastavenie po 3 sekundách
        setTimeout(function() {
            clearInterval(clearIntervalId);
        }, 3000);
    }
})();

/*

var CLEAR_CONSOLE = 0;
// 0 - vypisovanie
// 1 - mazanie

(function() {
    if (CLEAR_CONSOLE === 1) {
        // ZACHOVÁME PÔVODNÉ METÓDY
        var originalLog = console.log;
        var originalInfo = console.info;
        var originalWarn = console.warn;
        var originalError = console.error;
        var originalDebug = console.debug;
        
        // ÚPLNE POTLAČÍME VŠETKY VÝPISY
        console.log = function() {};
        console.info = function() {};
        console.warn = function() {};
        console.error = function() {};
        console.debug = function() {};
        
        // Voliteľné: ticho potlačíme aj groupCollapsed, group, groupEnd
        if (console.groupCollapsed) console.groupCollapsed = function() {};
        if (console.group) console.group = function() {};
        if (console.groupEnd) console.groupEnd = function() {};
        if (console.table) console.table = function() {};
        if (console.dir) console.dir = function() {};
        if (console.time) console.time = function() {};
        if (console.timeEnd) console.timeEnd = function() {};
        if (console.trace) console.trace = function() {};
        if (console.assert) console.assert = function() {};
        
        // IHNEDŤ A OPAKOVANE - čistenie každých 10ms
        var clearIntervalId = setInterval(function() {
            if (typeof console !== 'undefined' && typeof console.clear === 'function') {
                console.clear();
            }
        }, 10);
        
        // Voliteľné: zastavenie po 3 sekundách
        setTimeout(function() {
            clearInterval(clearIntervalId);
        }, 3000);
    }
})();
*/

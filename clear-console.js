var CLEAR_CONSOLE = 1;

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
        
        // ŠPECIÁLNE PRE TAILWIND UPOZORNENIE - oneskorené čistenie
        setTimeout(function() {
            if (typeof console !== 'undefined' && typeof console.clear === 'function') {
                console.clear();
            }
        }, 100);
        
        setTimeout(function() {
            if (typeof console !== 'undefined' && typeof console.clear === 'function') {
                console.clear();
            }
        }, 500);
        
        setTimeout(function() {
            if (typeof console !== 'undefined' && typeof console.clear === 'function') {
                console.clear();
            }
        }, 1000);
    }
})();

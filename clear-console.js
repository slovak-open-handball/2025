var CLEAR_CONSOLE = 1;

(function() {
    if (CLEAR_CONSOLE === 1) {
        // Okamžité vyčistenie pri načítaní
        if (typeof console !== 'undefined' && typeof console.clear === 'function') {
            console.clear();
        }
        
        // Zachytenie a vyčistenie všetkých console.log výpisov
        if (typeof console !== 'undefined') {
            // Uložíme pôvodné metódy
            var originalLog = console.log;
            var originalInfo = console.info;
            var originalWarn = console.warn;
            var originalError = console.error;
            var originalDebug = console.debug;
            
            // Prepíšeme console.log
            console.log = function() {
                if (CLEAR_CONSOLE === 1) {
                    console.clear();
                }
                return originalLog.apply(console, arguments);
            };
            
            // Prepíšeme console.info
            console.info = function() {
                if (CLEAR_CONSOLE === 1) {
                    console.clear();
                }
                return originalInfo.apply(console, arguments);
            };
            
            // Prepíšeme console.warn
            console.warn = function() {
                if (CLEAR_CONSOLE === 1) {
                    console.clear();
                }
                return originalWarn.apply(console, arguments);
            };
            
            // Prepíšeme console.error
            console.error = function() {
                if (CLEAR_CONSOLE === 1) {
                    console.clear();
                }
                return originalError.apply(console, arguments);
            };
            
            // Prepíšeme console.debug
            console.debug = function() {
                if (CLEAR_CONSOLE === 1) {
                    console.clear();
                }
                return originalDebug.apply(console, arguments);
            };
        }
    }
})();

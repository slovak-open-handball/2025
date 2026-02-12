var CLEAR_CONSOLE = 1;

(function() {
    if (CLEAR_CONSOLE === 1) {
        // Okamžité vyčistenie pri načítaní
        if (typeof console !== 'undefined' && typeof console.clear === 'function') {
            console.clear();
        }
        
        // Zachytenie a úplné potlačenie všetkých console výpisov
        if (typeof console !== 'undefined') {
            // Uložíme pôvodné metódy (pre prípad, že by sme ich chceli neskôr obnoviť)
            var originalLog = console.log;
            var originalInfo = console.info;
            var originalWarn = console.warn;
            var originalError = console.error;
            var originalDebug = console.debug;
            
            // Prepíšeme console.log - žiadny výpis
            console.log = function() {
                // Vyčistíme a NEVYPÍŠEME nič
                if (CLEAR_CONSOLE === 1) {
                    console.clear();
                }
                // return originalLog.apply(console, arguments); // TOTO SME ODSTRÁNILI
            };
            
            // Prepíšeme console.info - žiadny výpis
            console.info = function() {
                if (CLEAR_CONSOLE === 1) {
                    console.clear();
                }
                // ŽIADNY VÝPIS
            };
            
            // Prepíšeme console.warn - žiadny výpis
            console.warn = function() {
                if (CLEAR_CONSOLE === 1) {
                    console.clear();
                }
                // ŽIADNY VÝPIS
            };
            
            // Prepíšeme console.error - žiadny výpis
            console.error = function() {
                if (CLEAR_CONSOLE === 1) {
                    console.clear();
                }
                // ŽIADNY VÝPIS
            };
            
            // Prepíšeme console.debug - žiadny výpis
            console.debug = function() {
                if (CLEAR_CONSOLE === 1) {
                    console.clear();
                }
                // ŽIADNY VÝPIS
            };
        }
    }
})();

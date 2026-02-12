var CLEAR_CONSOLE = 1;

(function() {
    if (CLEAR_CONSOLE === 1) {
        if (typeof console !== 'undefined' && typeof console.clear === 'function') {
            console.clear();
        }
    }
})();

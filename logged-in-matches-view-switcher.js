// view-switcher.js
(function() {
    // Zistiť preferovaný režim z URL alebo localStorage
    function getInitialViewMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlView = urlParams.get('view');
        
        if (urlView === 'matches' || urlView === 'spider') {
            localStorage.setItem('preferredViewMode', urlView);
            return urlView;
        }
        
        const savedMode = localStorage.getItem('preferredViewMode');
        return savedMode === 'spider' ? 'spider' : 'matches';
    }

    window.currentViewMode = getInitialViewMode();

    // Funkcia na načítanie správneho scriptu
    function loadViewScript() {
        const scriptId = 'view-mode-script';
        const oldScript = document.getElementById(scriptId);
        if (oldScript) {
            oldScript.remove();
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.type = 'module';
        
        if (window.currentViewMode === 'matches') {
            script.src = 'logged-in-matches.js';
        } else {
            script.src = 'logged-in-spider.js';
        }
        
        document.body.appendChild(script);
        console.log('Načítaný režim:', window.currentViewMode);
    }

    // Počkáme na DOM a potom načítame script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadViewScript);
    } else {
        loadViewScript();
    }

    // Globálna funkcia na prepínanie
    window.switchViewMode = function(mode) {
        if (mode === window.currentViewMode) return;
        
        window.currentViewMode = mode;
        localStorage.setItem('preferredViewMode', mode);
        
        // Pridať parameter do URL
        const url = new URL(window.location.href);
        url.searchParams.set('view', mode);
        window.location.href = url.toString();
    };
})();

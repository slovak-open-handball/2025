/*

// logged-in-matches-view-switcher.js
(function() {
    // ===== ČASŤ 1: view-switcher.js =====
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

    // ===== ČASŤ 2: Aktivácia tlačidiel po načítaní =====
    function updateActiveViewButton() {
        const mode = window.currentViewMode || 'matches';
        
        // Nájdeme tlačidlá podľa onclick atribútu
        const matchesBtn = document.querySelector('.view-mode-btn[onclick*="matches"]');
        const spiderBtn = document.querySelector('.view-mode-btn[onclick*="spider"]');
        
        // Alternatívne vyhľadávanie podľa textu, ak onclick nie je spoľahlivý
        if (!matchesBtn || !spiderBtn) {
            const allButtons = document.querySelectorAll('.view-mode-btn');
            allButtons.forEach(btn => {
                if (btn.textContent.includes('Zápasy')) {
                    btn.classList.toggle('active', mode === 'matches');
                } else if (btn.textContent.includes('Pavúk')) {
                    btn.classList.toggle('active', mode === 'spider');
                }
            });
        } else {
            if (matchesBtn && spiderBtn) {
                matchesBtn.classList.toggle('active', mode === 'matches');
                spiderBtn.classList.toggle('active', mode === 'spider');
            }
        }
    }

    // Spustiť po načítaní DOM
    document.addEventListener('DOMContentLoaded', updateActiveViewButton);

    // Sledovať zmeny (pre prípad, že by sa režim zmenil iným spôsobom)
    window.addEventListener('viewModeChanged', updateActiveViewButton);
    
    // Tiež spustíme hneď, ak už je DOM načítaný
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(updateActiveViewButton, 100);
    }
})();
*/

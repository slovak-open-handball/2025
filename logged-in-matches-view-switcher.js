// logged-in-matches-view-switcher.js - Jednoduchý prepínač medzi režimami

// Globálny stav pre aktuálny režim
window.currentViewMode = window.currentViewMode || 'matches';

// Funkcia na prepínanie režimov
window.switchViewMode = (mode) => {
    if (mode === window.currentViewMode) return;
    
    window.currentViewMode = mode;
    
    // Uložíme do localStorage pre zachovanie pri obnovení stránky
    localStorage.setItem('preferredViewMode', mode);
    
    // Znovu načítame stránku pre prepnutie režimu
    window.location.reload();
};

// Pri načítaní stránky skontrolujeme localStorage
document.addEventListener('DOMContentLoaded', () => {
    const savedMode = localStorage.getItem('preferredViewMode');
    if (savedMode && (savedMode === 'matches' || savedMode === 'spider')) {
        window.currentViewMode = savedMode;
    }
});

// Funkcia na dynamické načítanie správneho scriptu
window.loadViewModeScript = () => {
    // Odstránime starý script ak existuje
    const oldScript = document.querySelector('script[data-view-mode]');
    if (oldScript) {
        oldScript.remove();
    }
    
    // Vytvoríme nový script
    const script = document.createElement('script');
    script.type = 'module';
    script.setAttribute('data-view-mode', window.currentViewMode);
    
    if (window.currentViewMode === 'matches') {
        script.src = 'logged-in-matches.js';
    } else {
        script.src = 'logged-in-spider.js';
    }
    
    document.body.appendChild(script);
    console.log(`Načítaný režim: ${window.currentViewMode}`);
};

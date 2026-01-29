// logged-in-team-info.js
console.log("%c[logged-in-team-info.js] Skript beží (verzia BEZ data atribútov – fallback)", 
    "color:#8b5cf6; font-weight:bold; font-size:14px;");

function initTeamHoverListeners() {
    console.log("Hľadám span elementy s triedou flex-grow (fallback mód)...");

    const nameSpans = document.querySelectorAll('li span.flex-grow');

    console.log(`Nájdených ${nameSpans.length} spanov s triedou flex-grow`);

    if (nameSpans.length === 0) {
        console.warn("Žiadne span.flex-grow sa nenašli – pravdepodobne ešte React nerenderoval zoznam tímov.");
        return;
    }

    nameSpans.forEach((span, index) => {
        // Aby sa listener nepridával opakovane (pri viacerých volaniach)
        if (span.dataset.hoverListenerAdded) return;
        span.dataset.hoverListenerAdded = 'true';

        span.addEventListener('mouseover', e => {
            let visibleText = e.target.textContent.trim();
            let displayName = visibleText.replace(/^\d+\.\s*/, '').trim();

            const li = e.target.closest('li');
            if (!li) return;

            // Základné info
            let type = 'normálny tím';
            let bgColor = 'neznáma farba';
            let group = 'bez skupiny';
            let category = 'neznáma kategória';
            let order = visibleText.match(/^\d+/)?.[0] || 'bez poradia';

            if (li) {
                // Typ podľa farby riadku
                if (li.classList.contains('bg-yellow-50')) {
                    type = 'SUPERSTRUCTURE / nadstavbový tím';
                    bgColor = 'žltá (bg-yellow-50)';
                } else if (li.closest('.bg-blue-100')) {
                    type = 'tím v nadstavbovej skupine';
                    bgColor = 'modrá (bg-blue-100)';
                } else if (li.closest('.bg-gray-100')) {
                    type = 'tím v základnej skupine';
                    bgColor = 'šedá (bg-gray-100)';
                } else if (li.classList.contains('border-dashed')) {
                    type = 'Diera / placeholder';
                    bgColor = 'prerušovaná čiara';
                }

                // Názov skupiny z hlavičky karty
                const groupHeader = li.closest('.zoom-group-box')?.querySelector('h3, h4');
                if (groupHeader) {
                    group = groupHeader.textContent.trim();
                }

                // Názov kategórie z nadpisu nad skupinami
                const catHeader = li.closest('.flex-col')?.previousElementSibling;
                if (catHeader?.tagName === 'H3') {
                    category = catHeader.textContent.trim();
                }
            }

            // Výstup – farebný a štruktúrovaný
            console.groupCollapsed(`%c${displayName || '(bez názvu)'}`, 'color:#10b981; font-weight:bold;');
            console.log(`Viditeľný text:     ${visibleText}`);
            console.log(`Vyčistený názov:     ${displayName}`);
            console.log(`Poradie:             ${order}`);
            console.log(`Typ (podľa farby):   ${type}`);
            console.log(`Farba riadku:        ${bgColor}`);
            console.log(`Skupina:             ${group}`);
            console.log(`Kategória:           ${category}`);
            console.groupEnd();
        });
    });

    console.log("→ Hover listenery boli priradené na všetky span.flex-grow elementy.");
}

// Spustenie s oneskorením + opakovanie každých 3 sekundy (pre prípad lazy renderu)
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded → čakám 1.5 sekundy kvôli React renderu...");
    
    const tryInit = () => {
        initTeamHoverListeners();
        
        // Ak stále nič nenašiel, skús znova o 3 sekundy
        if (document.querySelectorAll('li span.flex-grow').length === 0) {
            console.log("Stále nič... skúšam znova o 3 sekundy");
            setTimeout(tryInit, 3000);
        }
    };

    setTimeout(tryInit, 1500); // 1.5 sekundy po načítaní DOM-u
});

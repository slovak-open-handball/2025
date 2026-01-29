// logged-in-team-info.js
console.log("%c[logged-in-team-info.js] Skript beží (verzia s data atribútmi – 2025)", 
    "color:#8b5cf6; font-weight:bold; font-size:14px;");

function initTeamHoverListeners() {
    console.log("Hľadám span elementy s data-team-name a data-team-id...");

    // Najprv skúsime priamo cez data atribút – najspoľahlivejšie
    const teamSpans = document.querySelectorAll('span[data-team-name]');

    console.log(`Nájdených ${teamSpans.length} spanov s atribútom data-team-name`);

    if (teamSpans.length > 0) {
        teamSpans.forEach((span, index) => {
            span.addEventListener('mouseover', e => {
                // Najprv čítame z data atribútov – toto je najpresnejšie
                const teamNameFromData = span.getAttribute('data-team-name') || '(bez mena)';
                const teamIdFromData   = span.getAttribute('data-team-id')   || '(bez ID)';

                // Fallback – ak by data atribút chýbal (pre staršie riadky)
                let visibleText = e.target.textContent.trim();
                let displayName = visibleText.replace(/^\d+\.\s*/, '');

                // Kontext z okolia
                const li = e.target.closest('li');
                let type = 'normálny tím';
                let group = 'bez skupiny';
                let category = 'neznáma kategória';

                if (li) {
                    if (li.classList.contains('bg-yellow-50')) {
                        type = 'SUPERSTRUCTURE / nadstavbový tím';
                    } else if (li.closest('.bg-blue-100')) {
                        type = 'tím v nadstavbovej skupine';
                    } else if (li.closest('.bg-gray-100')) {
                        type = 'tím v základnej skupine';
                    }

                    // Názov skupiny
                    const groupHeader = li.closest('.zoom-group-box')?.querySelector('h3, h4');
                    if (groupHeader) group = groupHeader.textContent.trim();

                    // Názov kategórie
                    const catHeader = li.closest('.flex-col')?.previousElementSibling;
                    if (catHeader?.tagName === 'H3') {
                        category = catHeader.textContent.trim();
                    }
                }

                // Výstup do konzoly – farebný a prehľadný
                console.groupCollapsed(`%c${displayName}`, 'color:#10b981; font-weight:bold;');
                console.log(`Názov (z data):     ${teamNameFromData}`);
                console.log(`ID (z data):         ${teamIdFromData}`);
                console.log(`Názov (z textu):     ${displayName}`);
                console.log(`Typ:                 ${type}`);
                console.log(`Skupina:             ${group}`);
                console.log(`Kategória:           ${category}`);
                console.log(`Poradie (odvodené):  ${visibleText.match(/^\d+/)?.[0] || 'bez poradia'}`);
                console.groupEnd();
            });
        });

        console.log("→ Hover listenery úspešne priradené na elementy s data atribútmi.");
    } else {
        console.warn("Nenašiel som žiadne span[data-team-name] – skontroluj, či sa React render už dokončil.");
        console.info("Tip: Skús refresh stránky alebo pridaj setTimeout na oneskorené spustenie.");
    }
}

// Spustenie po načítaní stránky + malé oneskorenie (kvôli React renderu)
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded → čakám 1 sekundu kvôli React renderu...");
    setTimeout(() => {
        console.log("Spúšťam initTeamHoverListeners()...");
        initTeamHoverListeners();
    }, 1000); // 1000 ms = 1 sekunda – môžeš zväčšiť na 2000 ak treba
});

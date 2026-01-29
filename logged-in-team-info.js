// logged-in-team-info.js
console.log("%c[logged-in-team-info.js] Skript beží – FULL FIRESTORE lookup pri hovere", 
    "color:#8b5cf6; font-weight:bold; font-size:14px;");

async function lookupTeamInFirestore(teamName, category = null, group = null) {
    if (!window.db) {
        console.warn("Firestore (window.db) nie je dostupné!");
        return null;
    }

    console.log(`Hľadám tím "${teamName}" v databáze...`);

    try {
        // 1. Najprv skúsime superstructure tímy (settings/superstructureGroups)
        const superstructureRef = doc(window.db, 'settings/superstructureGroups');
        const superstructureSnap = await getDoc(superstructureRef);

        if (superstructureSnap.exists()) {
            const data = superstructureSnap.data() || {};
            
            // Prechádzame všetky kategórie
            for (const [catKey, teams] of Object.entries(data)) {
                if (!Array.isArray(teams)) continue;
                
                // Ak máme kategóriu, filtrujeme ju
                if (category && catKey !== category) continue;

                const found = teams.find(t => 
                    t.teamName === teamName || 
                    t.teamName?.includes(teamName)  // pre prípad prefixu kategórie
                );

                if (found) {
                    console.log("→ Nájdený v superstructureGroups!");
                    return {
                        source: 'superstructure',
                        category: catKey,
                        ...found
                    };
                }
            }
        }

        // 2. Ak nie je v superstructure → hľadáme v users kolekcii
        console.log("Nie je v superstructure → hľadám v users...");
        const usersSnap = await getDocs(collection(window.db, "users"));

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            if (!userData?.teams) continue;

            for (const [catKey, teamArray] of Object.entries(userData.teams || {})) {
                if (!Array.isArray(teamArray)) continue;
                if (category && catKey !== category) continue;

                const found = teamArray.find(t => 
                    t.teamName === teamName ||
                    t.teamName?.includes(teamName)
                );

                if (found) {
                    console.log("→ Nájdený v users/" + userDoc.id);
                    return {
                        source: 'user',
                        userId: userDoc.id,
                        category: catKey,
                        ...found
                    };
                }
            }
        }

        console.log("Tím sa nenašiel nikde v databáze.");
        return null;
    } catch (err) {
        console.error("Chyba pri hľadaní tímu v Firestore:", err);
        return null;
    }
}

function initTeamHoverListeners() {
    console.log("Inicializujem hover listenery – fallback + Firestore lookup...");

    const nameSpans = document.querySelectorAll('li span.flex-grow');

    console.log(`Nájdených ${nameSpans.length} spanov s triedou flex-grow`);

    if (nameSpans.length === 0) {
        console.warn("Žiadne span.flex-grow – React ešte pravdepodobne nerenderoval.");
        return;
    }

    nameSpans.forEach(span => {
        // Zabránime duplicitným listenerom
        if (span.dataset.hoverListenerAdded) return;
        span.dataset.hoverListenerAdded = 'true';

        span.addEventListener('mouseover', async e => {
            let visibleText = e.target.textContent.trim();
            let teamName = visibleText.replace(/^\d+\.\s*/, '').trim();

            const li = e.target.closest('li');
            if (!li) return;

            // Kontext z DOM-u
            let category = 'neznáma kategória';
            let group = 'bez skupiny';
            let type = 'neznámy typ';

            const catHeader = li.closest('.flex-col')?.previousElementSibling;
            if (catHeader?.tagName === 'H3') {
                category = catHeader.textContent.trim();
            }

            const groupHeader = li.closest('.zoom-group-box')?.querySelector('h3, h4');
            if (groupHeader) {
                group = groupHeader.textContent.trim();
            }

            if (li.classList.contains('bg-yellow-50')) {
                type = 'SUPERSTRUCTURE tím';
            } else if (li.closest('.bg-blue-100')) {
                type = 'nadstavbová skupina';
            } else if (li.closest('.bg-gray-100')) {
                type = 'základná skupina';
            }

            // Výpis základných informácií z DOM-u
            console.groupCollapsed(`%c${teamName}`, 'color:#10b981; font-weight:bold;');
            console.log(`Viditeľný text:     ${visibleText}`);
            console.log(`Kategória (DOM):     ${category}`);
            console.log(`Skupina (DOM):       ${group}`);
            console.log(`Typ (podľa farby):   ${type}`);

            // Načítanie z Firestore
            console.log("Spúšťam vyhľadávanie v databáze...");
            const teamData = await lookupTeamInFirestore(teamName, category, group);

            if (teamData) {
                console.log("ÚPLNÉ DÁTA Z DATABÁZY:");
                console.dir(teamData);  // pekný výpis objektu
            } else {
                console.warn("Tím sa v databáze nenašiel (skús iný názov alebo refresh).");
            }

            console.groupEnd();
        });
    });

    console.log("Hover listenery boli úspešne priradené.");
}

// Spustenie s oneskorením + opakovaním
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded → čakám 2 sekundy...");
    setTimeout(() => {
        initTeamHoverListeners();

        // Opakujeme každých 4 sekundy, kým niečo nenájdeme
        const interval = setInterval(() => {
            if (document.querySelectorAll('li span.flex-grow').length > 0) {
                console.log("Zoznam tímov už je v DOM-e → listenery sú aktívne.");
                clearInterval(interval);
            } else {
                console.log("Stále čakám na zoznam tímov...");
                initTeamHoverListeners();
            }
        }, 4000);
    }, 2000);
});

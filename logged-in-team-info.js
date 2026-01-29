// logged-in-team-info.js

// === PRIAME IMPORTY FIRESTORE FUNKCIÍ ===
import {
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

console.log("%c[logged-in-team-info.js] Skript beží – FULL FIRESTORE lookup (priamy import, bez čakania)",
    "color:#8b5cf6; font-weight:bold; font-size:14px; background:#000; padding:4px 8px; border-radius:4px;");

// === HLAVNÁ FUNKCIA NA VYHĽADÁVANIE V DATABÁZE ===
async function lookupTeamInFirestore(teamName, category = null, group = null) {
    if (!window.db) {
        console.warn("Firestore (window.db) nie je dostupné!");
        return null;
    }

    // Vyčistený názov z DOM (bez poradia)
    let cleanName = teamName.trim();

    console.log(`Hľadám tím "${cleanName}" (kategória: ${category || 'ľubovoľná'}, skupina: ${group || 'ľubovoľná'})`);

    try {
        // 1. superstructureGroups → settings/superstructureGroups
        const superstructureRef = doc(window.db, 'settings/superstructureGroups');
        const superstructureSnap = await getDoc(superstructureRef);

        if (superstructureSnap.exists()) {
            const data = superstructureSnap.data() || {};

            for (const [catKey, teams] of Object.entries(data)) {
                if (!Array.isArray(teams)) continue;

                // Priorita: ak máme kategóriu z DOM, skúsime najprv s prefixom
                let candidates = [];

                // Varianta 1: s prefixom kategórie
                if (category && catKey === category) {
                    const prefixedName = `${category} ${cleanName}`;
                    candidates.push(prefixedName);
                }

                // Varianta 2: bez prefixu (pre istotu)
                candidates.push(cleanName);

                // Varianta 3: ak máme skupinu, skúsime aj iné kombinácie (voliteľné)

                for (const searchName of candidates) {
                    const found = teams.find(t =>
                        t.teamName === searchName ||
                        (t.teamName && t.teamName.includes(searchName))
                    );

                    if (found) {
                        console.log(`→ Nájdený v superstructureGroups (${catKey}) pod názvom "${found.teamName}"`);
                        return {
                            source: 'superstructure',
                            category: catKey,
                            ...found
                        };
                    }
                }
            }
        }

        // 2. prehľadávanie používateľov (users kolekcia)
        console.log("Nie je v superstructure → prehľadávam users...");
        const usersCol = collection(window.db, "users");
        const usersSnap = await getDocs(usersCol);

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            if (!userData?.teams) continue;

            for (const [catKey, teamArray] of Object.entries(userData.teams || {})) {
                if (!Array.isArray(teamArray)) continue;

                // Rovnaká stratégia: najprv s prefixom, potom bez
                let candidates = [cleanName];

                if (category && catKey === category) {
                    const prefixedName = `${category} ${cleanName}`;
                    candidates.unshift(prefixedName); // na prvé miesto
                }

                for (const searchName of candidates) {
                    const found = teamArray.find(t =>
                        t.teamName === searchName ||
                        (t.teamName && t.teamName.includes(searchName))
                    );

                    if (found) {
                        console.log(`→ Nájdený u používateľa ${userDoc.id} v kategórii ${catKey} pod názvom "${found.teamName}"`);
                        return {
                            source: 'user',
                            userId: userDoc.id,
                            category: catKey,
                            ...found
                        };
                    }
                }
            }
        }

        console.log("→ Žiadna zhoda v databáze ani s prefixom.");
        return null;
    } catch (err) {
        console.error("Chyba pri prehľadávaní Firestore:", err);
        return null;
    }
}

// === INICIALIZÁCIA HOVER LISTENEROV ===
function initTeamHoverListeners() {
    console.log("Inicializujem hover listenery na span.flex-grow...");

    const nameSpans = document.querySelectorAll('li span.flex-grow');
    console.log(`Nájdených ${nameSpans.length} spanov s triedou flex-grow`);

    if (nameSpans.length === 0) {
        console.warn("Žiadne span.flex-grow – React zatiaľ pravdepodobne nerenderoval zoznam tímov.");
        return;
    }

    nameSpans.forEach(span => {
        if (span.dataset.hoverListenerAdded) return;
        span.dataset.hoverListenerAdded = 'true';

        span.addEventListener('mouseover', async e => {
            let visibleText = e.target.textContent.trim();
            let teamName = visibleText.replace(/^\d+\.\s*/, '').trim();

            const li = e.target.closest('li');
            if (!li) return;

            let category = 'neznáma kategória';
            let group = 'bez skupiny';
            let type = 'neznámy typ';

            // 1. Najprv skúsime najbližší nadpis kategórie (funguje lepšie v multi-view)
            let catHeader = li.closest('.zoom-group-box')?.previousElementSibling;
            while (catHeader && catHeader.tagName !== 'H3' && catHeader.tagName !== 'H4') {
                catHeader = catHeader.previousElementSibling;
            }
            if (catHeader?.tagName === 'H3' || catHeader?.tagName === 'H4') {
                category = catHeader.textContent.trim();
            }

            // 2. Ak sa nenašiel – fallback na pôvodnú logiku (single view)
            if (category === 'neznáma kategória') {
                const altCatHeader = li.closest('.flex-col')?.previousElementSibling;
                if (altCatHeader?.tagName === 'H3') {
                    category = altCatHeader.textContent.trim();
                }
            }

            // 3. Ak stále nič – skúsime hash v URL (napr. #Fortuna-liga)
            if (category === 'neznáma kategória' && window.location.hash) {
                const hash = window.location.hash.substring(1);
                if (hash) {
                    const catNameFromHash = decodeURIComponent(hash.split('/')[0]).replace(/-/g, ' ');
                    if (catNameFromHash) {
                        category = catNameFromHash;
                        console.log(`Kategória získaná z URL hash: ${category}`);
                    }
                }
            }

            // Skupina (zostáva rovnaká)
            const groupHeader = li.closest('.zoom-group-box')?.querySelector('h3, h4');
            if (groupHeader) {
                group = groupHeader.textContent.trim();
            }

            // Typ podľa farby (zostáva rovnaký)
            if (li.classList.contains('bg-yellow-50')) {
                type = 'SUPERSTRUCTURE / nadstavbový tím';
            } else if (li.closest('.bg-blue-100')) {
                type = 'tím v nadstavbovej skupine';
            } else if (li.closest('.bg-gray-100')) {
                type = 'tím v základnej skupine';
            }

            // Výpis do konzoly
            console.groupCollapsed(`%c${teamName || '(bez názvu)'}`, 'color:#10b981; font-weight:bold;');
            console.log(`Viditeľný text:     ${visibleText}`);
            console.log(`Vyčistený názov:     ${teamName}`);
            console.log(`Kategória (z DOM / URL): ${category}`);
            console.log(`Skupina (z DOM):     ${group}`);
            console.log(`Typ (podľa farby):   ${type}`);

            // Spustenie vyhľadávania
            console.log("Spúšťam vyhľadávanie v Firestore...");
            const teamData = await lookupTeamInFirestore(teamName, category, group);

            if (teamData) {
                console.log("ÚPLNÉ DÁTA Z DATABÁZY:");
                console.dir(teamData);
            } else {
                console.warn("Tím sa v databáze nenašiel.");
            }

            console.groupEnd();
        });
    });

    console.log("→ Hover listenery boli úspešne priradené.");
}

// === OKAMŽITÉ SPUSTENIE PO NAČÍTANÍ DOM ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded → spúšťam inicializáciu listenerov okamžite");
    
    // Kontrola, či je db dostupná (podľa tvojho vyjadrenia vždy áno)
    if (window.db) {
        console.log("window.db je dostupné → inicializujem listenery");
        initTeamHoverListeners();
    } else {
        console.warn("window.db nie je dostupné – listenery nebudú inicializované");
    }
});

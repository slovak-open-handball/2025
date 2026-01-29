// logged-in-team-info.js

// === PRIAME IMPORTY FIRESTORE FUNKCIÍ ===
import {
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

console.log("%c[logged-in-team-info.js] Skript beží – čakám na Firebase inicializáciu",
    "color:#8b5cf6; font-weight:bold; font-size:14px; background:#000; padding:4px 8px; border-radius:4px;");

// === HLAVNÁ FUNKCIA NA VYHĽADÁVANIE V DATABÁZE ===
async function lookupTeamInFirestore(teamName, category = null, group = null) {
    if (!window.db) {
        console.warn("Firestore (window.db) nie je dostupné!");
        return null;
    }
    let cleanName = teamName.trim();
    console.log(`Hľadám tím "${cleanName}" (kategória: ${category || 'ľubovoľná'}, skupina: ${group || 'ľubovoľná'})`);
    try {
        // superstructureGroups
        const superstructureRef = doc(window.db, 'settings/superstructureGroups');
        const superstructureSnap = await getDoc(superstructureRef);
        if (superstructureSnap.exists()) {
            const data = superstructureSnap.data() || {};
            for (const [catKey, teams] of Object.entries(data)) {
                if (!Array.isArray(teams)) continue;
                let candidates = [];
                if (category && catKey === category) {
                    candidates.push(`${category} ${cleanName}`);
                }
                candidates.push(cleanName);
                for (const searchName of candidates) {
                    const found = teams.find(t =>
                        t.teamName === searchName ||
                        (t.teamName && t.teamName.includes(searchName))
                    );
                    if (found) {
                        console.log(`→ Nájdený v superstructureGroups (${catKey}) pod "${found.teamName}"`);
                        return { source: 'superstructure', category: catKey, ...found };
                    }
                }
            }
        }
        // users
        console.log("Nie je v superstructure → prehľadávam users...");
        const usersCol = collection(window.db, "users");
        const usersSnap = await getDocs(usersCol);
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            if (!userData?.teams) continue;
            for (const [catKey, teamArray] of Object.entries(userData.teams || {})) {
                if (!Array.isArray(teamArray)) continue;
                let candidates = [cleanName];
                if (category && catKey === category) {
                    candidates.unshift(`${category} ${cleanName}`);
                }
                for (const searchName of candidates) {
                    const found = teamArray.find(t =>
                        t.teamName === searchName ||
                        (t.teamName && t.teamName.includes(searchName))
                    );
                    if (found) {
                        console.log(`→ Nájdený u používateľa ${userDoc.id} v kategórii ${catKey} pod "${found.teamName}"`);
                        return { source: 'user', userId: userDoc.id, category: catKey, ...found };
                    }
                }
            }
        }
        console.log("→ Žiadna zhoda.");
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
        console.warn("Žiadne span.flex-grow – React zatiaľ nerenderoval zoznam tímov.");
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

            // 1. Najbližší nadpis kategórie (multi-view)
            let catHeader = li.closest('.zoom-group-box')?.previousElementSibling;
            while (catHeader && catHeader.tagName !== 'H3' && catHeader.tagName !== 'H4') {
                catHeader = catHeader.previousElementSibling;
            }
            if (catHeader?.tagName === 'H3' || catHeader?.tagName === 'H4') {
                category = catHeader.textContent.trim();
            }

            // 2. Fallback – single view
            if (category === 'neznáma kategória') {
                const altCatHeader = li.closest('.flex-col')?.previousElementSibling;
                if (altCatHeader?.tagName === 'H3') {
                    category = altCatHeader.textContent.trim();
                }
            }

            // 3. Hash z URL ako posledná možnosť
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

            const groupHeader = li.closest('.zoom-group-box')?.querySelector('h3, h4');
            if (groupHeader) {
                group = groupHeader.textContent.trim();
            }

            if (li.classList.contains('bg-yellow-50')) {
                type = 'SUPERSTRUCTURE / nadstavbový tím';
            } else if (li.closest('.bg-blue-100')) {
                type = 'tím v nadstavbovej skupine';
            } else if (li.closest('.bg-gray-100')) {
                type = 'tím v základnej skupine';
            }

            console.groupCollapsed(`%c${teamName || '(bez názvu)'}`, 'color:#10b981; font-weight:bold;');
            console.log(`Viditeľný text:     ${visibleText}`);
            console.log(`Vyčistený názov:     ${teamName}`);
            console.log(`Kategória:           ${category}`);
            console.log(`Skupina:             ${group}`);
            console.log(`Typ:                 ${type}`);

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

    // === NOVÝ FAREBNÝ LOG – potvrdenie, že listenery sú nastavené ===
    console.log("%c[logged-in-team-info.js] Hover listenery boli úspešne nastavené a sú aktívne!",
        "color:#10b981; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");

    console.log("→ Hover listenery boli úspešne priradené.");
}

// === ČAKANIE NA FIREBASE + OKAMŽITÉ SPUSTENIE ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded → čakám na inicializáciu Firebase...");

    let attempts = 0;
    const maxAttempts = 15;

    function tryInitialize() {
        attempts++;

        if (window.db) {
            console.log("window.db je dostupné → spúšťam listenery");
            initTeamHoverListeners();
            return;
        }

        if (attempts >= maxAttempts) {
            console.error("Firebase sa nenačítal ani po 15 pokusoch. Skontroluj authentication.js");
            return;
        }

        console.log(`Firebase ešte nie je pripravený (pokus ${attempts}/${maxAttempts}) → čakám 1s...`);
        setTimeout(tryInitialize, 1000);
    }

    // Prvý pokus okamžite
    tryInitialize();
});

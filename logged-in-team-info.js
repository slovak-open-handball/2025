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

    console.log(`Hľadám tím "${teamName}" (kategória: ${category || 'ľubovoľná'}, skupina: ${group || 'ľubovoľná'})`);

    try {
        // 1. superstructureGroups → settings/superstructureGroups
        const superstructureRef = doc(window.db, 'settings/superstructureGroups');
        const superstructureSnap = await getDoc(superstructureRef);

        if (superstructureSnap.exists()) {
            const data = superstructureSnap.data() || {};
            
            for (const [catKey, teams] of Object.entries(data)) {
                if (!Array.isArray(teams)) continue;
                if (category && catKey !== category) continue;

                const found = teams.find(t => 
                    t.teamName === teamName || 
                    (t.teamName && t.teamName.includes(teamName))
                );

                if (found) {
                    console.log(`→ Nájdený v superstructureGroups (${catKey})`);
                    return {
                        source: 'superstructure',
                        category: catKey,
                        ...found
                    };
                }
            }
        }

        // 2. prehľadávanie všetkých používateľov (users kolekcia)
        console.log("Nie je v superstructure → prehľadávam users kolekciu...");
        const usersCol = collection(window.db, "users");
        const usersSnap = await getDocs(usersCol);

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            if (!userData?.teams) continue;

            for (const [catKey, teamArray] of Object.entries(userData.teams || {})) {
                if (!Array.isArray(teamArray)) continue;
                if (category && catKey !== category) continue;

                const found = teamArray.find(t => 
                    t.teamName === teamName ||
                    (t.teamName && t.teamName.includes(teamName))
                );

                if (found) {
                    console.log(`→ Nájdený u používateľa ${userDoc.id} v kategórii ${catKey}`);
                    return {
                        source: 'user',
                        userId: userDoc.id,
                        category: catKey,
                        ...found
                    };
                }
            }
        }

        console.log("→ Žiadna zhoda v databáze.");
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
        // Zabránenie duplicitných listenerov
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

            const catHeader = li.closest('.flex-col')?.previousElementSibling;
            if (catHeader?.tagName === 'H3') {
                category = catHeader.textContent.trim();
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
            console.log(`Kategória (z DOM):   ${category}`);
            console.log(`Skupina (z DOM):     ${group}`);
            console.log(`Typ (podľa farby):   ${type}`);

            // === VYHĽADÁVANIE V DATABÁZE ===
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

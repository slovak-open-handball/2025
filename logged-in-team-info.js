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

// === FUNKCIA NA PRIRADENIE LISTENERA NA JEDEN ELEMENT ===
function addHoverListener(span) {
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

        // === NOVÁ LOGIKA NA NÁJDENIE NÁZVU KATEGÓRIE ===

        // 1. Skúsime nájsť najbližší predchádzajúci <h3> mimo zoom-group-box
        let current = li;
        while (current && current !== document.body) {
            // Ak sme v zoom-group-box, ideme von
            if (current.classList.contains('zoom-group-box')) {
                current = current.parentElement;
                continue;
            }

            // Hľadáme predchádzajúci súrodenec <h3>
            let prev = current.previousElementSibling;
            while (prev) {
                if (prev.tagName === 'H3' && prev.textContent.trim().length > 0) {
                    // Overíme, či to vyzerá ako názov kategórie (dlhší text, nie názov skupiny)
                    const text = prev.textContent.trim();
                    if (text.length > 5 && !text.includes('Základné skupiny') && !text.includes('Nadstavbové skupiny')) {
                        category = text;
                        break;
                    }
                }
                prev = prev.previousElementSibling;
            }

            if (category !== 'neznáma kategória') break;

            current = current.parentElement;
        }

        // 2. Ak stále nič – fallback na hash (ak je vybratá konkrétna kategória)
        if (category === 'neznáma kategória' && window.location.hash) {
            const hash = window.location.hash.substring(1);
            if (hash && hash !== '') {
                const catNameFromHash = decodeURIComponent(hash.split('/')[0]).replace(/-/g, ' ');
                if (catNameFromHash) {
                    category = catNameFromHash;
                    console.log(`Kategória získaná z URL hash: ${category}`);
                }
            }
        }

        // 3. Skupina (zostáva rovnaká)
        const groupHeader = li.closest('.zoom-group-box')?.querySelector('h3, h4');
        if (groupHeader) {
            group = groupHeader.textContent.trim();
        }

        // Typ podľa farby
        if (li.classList.contains('bg-yellow-50')) {
            type = 'SUPERSTRUCTURE / nadstavbový tím';
        } else if (li.closest('.bg-blue-100')) {
            type = 'tím v nadstavbovej skupine';
        } else if (li.closest('.bg-gray-100')) {
            type = 'tím v základnej skupine';
        }

        // Výpis
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
}

// === INICIALIZÁCIA HOVER LISTENEROV + MUTATION OBSERVER ===
function initTeamHoverListeners() {
    console.log("Inicializujem hover listenery na span.flex-grow...");

    // Pridáme listenery na aktuálne existujúce elementy
    const nameSpans = document.querySelectorAll('li span.flex-grow');
    console.log(`Nájdených ${nameSpans.length} spanov s triedou flex-grow pri inicializácii`);
    nameSpans.forEach(addHoverListener);

    // === MutationObserver – sleduje nové elementy ===
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        const newSpans = node.querySelectorAll('li span.flex-grow');
                        newSpans.forEach(addHoverListener);
                    }
                });
            }
        });
    });

    // Sledujeme celé body (alebo konkrétnu sekciu, ak vieš, kde sa tímy renderujú)
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log("%c[logged-in-team-info.js] Hover listenery boli úspešne nastavené a sú aktívne (sledovanie zmien DOM)!",
        "color:#10b981; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");
}

// === SPUSTENIE ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded → spúšťam inicializáciu listenerov...");

    if (window.db) {
        console.log("window.db je dostupné → inicializujem listenery");
        initTeamHoverListeners();
    } else {
        console.warn("window.db nie je dostupné – listenery nebudú inicializované");
    }
});

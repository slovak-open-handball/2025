// logged-in-team-info.js

// === PRIAME IMPORTY FIRESTORE FUNKCIÍ ===
import {
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

console.log("%c[logged-in-team-info.js] Skript beží – čakám na window.db",
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

        // === 1. Najvyššia priorita: hash v URL ===
        if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '') {
            const hash = window.location.hash.substring(1);
            const parts = hash.split('/');
            let catNameFromHash = decodeURIComponent(parts[0]).replace(/-/g, ' ').trim();

            // Ak nie je to krátky kód skupiny (1-3 znaky, len písmená/číslice bez medzier)
            if (!/^[A-Za-z0-9]{1,3}$/.test(catNameFromHash)) {
                category = catNameFromHash;
                console.log(`Kategória získaná z URL hash (priorita 1): ${category}`);
            }
        }

        // === 2. Ak hash nič nedal → hľadáme v DOM-e ===
        if (category === 'neznáma kategória') {
            let current = li;

            // Ideme von z vnútorných kontajnerov
            while (current && current !== document.body) {
                if (current.classList.contains('zoom-group-box') ||
                    current.classList.contains('zoom-content') ||
                    current.classList.contains('flex-grow') ||
                    current.classList.contains('zoom-responsive')) {
                    current = current.parentElement;
                    continue;
                }

                // Hľadáme predchádzajúci <h3>
                let prev = current.previousElementSibling;
                while (prev) {
                    if (prev.tagName === 'H3' && prev.textContent.trim()) {
                        const text = prev.textContent.trim();

                        // Vylúčime len interné nadpisy a krátke kódy skupín
                        if (!text.startsWith('Základné skupiny') &&
                            !text.startsWith('Nadstavbové skupiny') &&
                            !text.startsWith('Skupina') &&
                            !text.includes('Tímy bez skupiny') &&
                            // Vylúčime niečo ako "1A", "A", "12B" – krátke, bez medzier, alfanumerické
                            !/^[A-Za-z0-9]{1,4}$/.test(text) &&
                            // Neprijímame čisto číselné (napr. "12")
                            !/^\d+$/.test(text)) {

                            category = text;
                            console.log(`Kategória nájdená v DOM (nadpis <h3>): ${category}`);
                            break;
                        }
                    }
                    prev = prev.previousElementSibling;
                }

                if (category !== 'neznáma kategória') break;
                current = current.parentElement;
            }
        }

        // === 3. Skupina ===
        const groupHeader = li.closest('.zoom-group-box')?.querySelector('h3, h4');
        if (groupHeader) {
            group = groupHeader.textContent.trim();
        }

        // === 4. Typ podľa farby ===
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

// === INICIALIZÁCIA + MUTATION OBSERVER ===
function initTeamHoverListeners() {
    console.log("Inicializujem hover listenery na span.flex-grow...");

    const nameSpans = document.querySelectorAll('li span.flex-grow');
    console.log(`Nájdených ${nameSpans.length} spanov s triedou flex-grow pri inicializácii`);
    nameSpans.forEach(addHoverListener);

    // MutationObserver pre dynamické pridávanie tímov
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        const newSpans = node.querySelectorAll('li span.flex-grow:not([data-hover-listener-added])');
                        newSpans.forEach(addHoverListener);
                    }
                });
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    console.log("%c[logged-in-team-info.js] Hover listenery boli úspešne nastavené a sú aktívne (sledovanie zmien DOM)!",
        "color:#10b981; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");
}

// === ROBUSTNÉ ČAKANIE NA window.db ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded → čakám na window.db...");

    let attempts = 0;
    const maxAttempts = 20; // max 10 sekúnd (500 ms × 20)

    function waitForDb() {
        attempts++;

        if (window.db) {
            console.log("%cwindow.db je dostupné → spúšťam inicializáciu listenerov",
                "color:#10b981; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");
            initTeamHoverListeners();
            return;
        }

        if (attempts >= maxAttempts) {
            console.error("%c[CHYBA] window.db sa nenačítal ani po 20 pokusoch (10s). Skontroluj authentication.js",
                "color:#ef4444; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");
            return;
        }

        console.log(`window.db ešte nie je dostupné (pokus ${attempts}/${maxAttempts}) → čakám 500 ms...`);
        setTimeout(waitForDb, 500);
    }

    // Spustíme čakanie
    waitForDb();
});

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

async function lookupTeamInFirestore(teamName, category = null, group = null) {
    if (!window.db) {
        console.warn("Firestore (window.db) nie je dostupné!");
        return null;
    }

    let cleanName = teamName.trim();
    console.log(`Hľadám tím "${cleanName}" (predpokladaná kategória: ${category || 'ľubovoľná'}, skupina: ${group || 'ľubovoľná'})`);

    try {
        // 1. superstructureGroups – tu stále skúšame s prefixom, ak máme kategóriu
        const superstructureRef = doc(window.db, 'settings/superstructureGroups');
        const superstructureSnap = await getDoc(superstructureRef);
        if (superstructureSnap.exists()) {
            const data = superstructureSnap.data() || {};
            for (const [catKey, teams] of Object.entries(data)) {
                if (!Array.isArray(teams)) continue;

                let found = null;

                // Najprv presná zhoda s predpokladanou kategóriou
                if (category && catKey === category) {
                    const prefixed = `${category} ${cleanName}`;
                    found = teams.find(t => t.teamName === prefixed || t.teamName === cleanName);
                }

                // Ak nič, skúsime bez prefixu
                if (!found) {
                    found = teams.find(t => t.teamName === cleanName);
                }

                if (found) {
                    console.log(`→ Nájdený v superstructureGroups (${catKey}) pod "${found.teamName}"`);
                    return { source: 'superstructure', category: catKey, ...found };
                }
            }
        }

        // 2. users – PRVÝ POKUS: s presnou kategóriou (ak ju máme)
        console.log("Prehľadávam users...");
        const usersCol = collection(window.db, "users");
        const usersSnap = await getDocs(usersCol);

        let foundWithCategory = null;

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            if (!userData?.teams) continue;

            for (const [catKey, teamArray] of Object.entries(userData.teams || {})) {
                if (!Array.isArray(teamArray)) continue;

                // Pokúsime sa nájsť s predpokladanou kategóriou
                if (category && catKey === category) {
                    const found = teamArray.find(t => 
                        t.teamName === cleanName ||
                        t.teamName === `${category} ${cleanName}`  // pre istotu aj prefix
                    );
                    if (found) {
                        foundWithCategory = { source: 'user', userId: userDoc.id, category: catKey, ...found };
                        break;
                    }
                }
            }
            if (foundWithCategory) break;
        }

        if (foundWithCategory) {
            console.log(`→ Nájdený s presnou kategóriou ${foundWithCategory.category} (zhoduje sa s DOM/hash)`);
            return foundWithCategory;
        }

        // 3. FALLBACK: ak sa nenašiel v predpokladanej kategórii → hľadáme všade
        console.log(`Tím sa nenašiel v predpokladanej kategórii "${category}" → hľadám bez filtra kategórie (fallback)`);

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            if (!userData?.teams) continue;

            for (const [catKey, teamArray] of Object.entries(userData.teams || {})) {
                if (!Array.isArray(teamArray)) continue;

                const found = teamArray.find(t => t.teamName === cleanName);
                if (found) {
                    console.log(`→ FALLBACK: Nájdený u používateľa ${userDoc.id} v kategórii ${catKey} pod "${found.teamName}"`);
                    console.log(`  (pôvodná predpokladaná kategória z DOM/hash: ${category || 'žiadna'})`);
                    return { source: 'user', userId: userDoc.id, category: catKey, ...found };
                }
            }
        }

        console.log("→ Žiadna zhoda ani vo fallbacku.");
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
    
        // Premenné na začiatku
        let category = 'neznáma kategória';
        let group = 'bez skupiny';
        let type = 'neznámy typ';
        let categoryFromText = null;
        let tooltipText;
    
        // Detekcia "Kategória: Tím" – ak je priamo v texte
        const colonIndex = visibleText.indexOf(':');
        if (colonIndex !== -1 && colonIndex < visibleText.length - 1) {
            const potentialCategory = visibleText.substring(0, colonIndex).trim();
            const potentialTeamName = visibleText.substring(colonIndex + 1).trim();
            if (potentialTeamName && potentialTeamName.length > 1) {
                teamName = potentialTeamName.replace(/^\d+\.\s*/, '').trim();
                categoryFromText = potentialCategory;
                category = categoryFromText;  // môžeme rovno priradiť
            }
        }
    
        const li = e.target.closest('li');
        if (!li) return;
    
        // Získavanie kategórie z hash/DOM iba ak nie je z textu
        if (!categoryFromText) {
            // ... tvoja pôvodná logika hash + DOM ...
        }
    
        // Skupina + typ podľa farby (nezmenené)
        const groupHeader = li.closest('.zoom-group-box')?.querySelector('h3, h4');
        if (groupHeader) group = groupHeader.textContent.trim();
    
        if (li.classList.contains('bg-yellow-50')) {
            type = 'SUPERSTRUCTURE / nadstavbový tím';
        } else if (li.closest('.bg-blue-100')) {
            type = 'tím v nadstavbovej skupine';
        } else if (li.closest('.bg-gray-100')) {
            type = 'tím v základnej skupine';
        }
    
        // Konzolový výpis (nezmenený)
        console.groupCollapsed(`%c${teamName || '(bez názvu)'}`, 'color:#10b981; font-weight:bold;');
        console.log(`Viditeľný text: ${visibleText}`);
        console.log(`Vyčistený názov: ${teamName}`);
        console.log(`Kategória: ${category} ${categoryFromText ? '(z textu :)' : '(z hash/DOM)'}`);
        console.log(`Skupina: ${group}`);
        console.log(`Typ: ${type}`);
        console.log("Spúšťam vyhľadávanie v Firestore...");
    
        const teamData = await lookupTeamInFirestore(teamName, category, group);
    
        if (teamData) {
            console.log("ÚPLNÉ DÁTA Z DATABÁZY:");
            console.dir(teamData);
    
            // ───────────────────────────────────────────────
            // VÝPOČTY PRE TOOLTIP
            // ───────────────────────────────────────────────
            const playerCount   = (teamData.playerDetails || []).length;
            const womenCount    = (teamData.womenTeamMemberDetails || []).length;
            const menCount      = (teamData.menTeamMemberDetails || []).length;
            const totalPeople   = playerCount + womenCount + menCount;
    
            const packageName   = teamData.packageDetails?.name   || '—';
            const accommodation = teamData.accommodation?.type    || '—';
    
            // NOVÉ: arrival
            const arrivalType = teamData.arrival?.type || '—';
            const arrivalTime = teamData.arrival?.time ? ` (${teamData.arrival.time})` : '';
    
            const displayCategory = teamData.category || category || 'bez kategórie';
    
            // ───────────────────────────────────────────────
            // FINÁLNY TOOLTIP – viacriadkový, prehľadný
            // ───────────────────────────────────────────────
            tooltipText = `${displayCategory} → ${teamName}
    Počet osôb:      ${totalPeople}  (hráči ${playerCount}, člen RT ženy ${womenCount}, člen RT muži ${menCount})
    Balík:           ${packageName}
    Ubytovanie:      ${accommodation}
    Doprava:         ${arrivalType}${arrivalTime}`;
    
            span.setAttribute('title', tooltipText);
        } 
        else {
            console.warn("Tím sa v databáze nenašiel.");
            span.setAttribute('title', `${teamName}\n(kategória a údaje sa nenašli v databáze)`);
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

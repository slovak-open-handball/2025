// logged-in-team-info.js

import {
  doc, getDoc, onSnapshot, collection, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

console.log("%c[logged-in-team-info.js] Skript beží – čakám na window.db",
    "color:#8b5cf6; font-weight:bold; font-size:14px; background:#000; padding:4px 8px; border-radius:4px;");

let shouldShowTeamBubbles = true;
let unsubscribeUserSettings = null;

// === NAČÍTANIE NASTAVENIA ZO USER DOKUMENTU ===
function setupTeamBubblesListener() {
    if (unsubscribeUserSettings) return;
  
    if (!window.db || !window.auth || !window.auth.currentUser) {
        console.warn("[team-info] auth alebo db ešte nie je pripravené → čakáme");
        return;
    }

    const userId = window.auth.currentUser.uid;
    const userRef = doc(window.db, "users", userId);

    console.log(`[team-info] Nastavujem onSnapshot na users/${userId} → sledujem displayTeamBubbles`);

    onSnapshot(userRef, (snap) => {
        if (!snap.exists()) {
            console.warn("[team-info] Dokument používateľa neexistuje");
            shouldShowTeamBubbles = true; // fallback
            return;
        }

        const data = snap.data() || {};
        const newValue = data.displayTeamBubbles;

        // Ak pole vôbec neexistuje → nastavíme default (true) a zapíšeme ho
        if (newValue === undefined) {
            console.log("[team-info] Inicializujem displayTeamBubbles = true");
            updateDoc(userRef, { displayTeamBubbles: true })
                .catch(err => console.error("[team-info] Chyba pri init:", err));
            shouldShowTeamBubbles = true;
        } else {
            shouldShowTeamBubbles = !!newValue;  // true/false → boolean
            console.log(`[team-info] displayTeamBubbles = ${shouldShowTeamBubbles}`);
        }
    }, (err) => {
        console.error("[team-info] Chyba pri počúvaní nastavenia bubliniek:", err);
        shouldShowTeamBubbles = true; // fallback pri chybe
    });
}

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
        // ----------------- NOVÁ KONTROLA -----------------
        if (!shouldShowTeamBubbles) {
            // nastavenie vypnuté → žiadny tooltip
            return;
        }
        let visibleText = e.target.textContent.trim();
        let teamName = visibleText.replace(/^\d+\.\s*/, '').trim();
    
        // Premenné na začiatku
        let category = 'neznáma kategória';
        let group = 'bez skupiny';
        let type = 'neznámy typ';
        let categoryFromText = null;
        let currentTooltipText;
    
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
            // 1. Najprv hash v URL (ako predtým)
            if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '') {
                const hash = window.location.hash.substring(1);
                const parts = hash.split('/');
                let catNameFromHash = decodeURIComponent(parts[0]).replace(/-/g, ' ').trim();
                
                // ak to nevyzerá ako krátky kód skupiny (A, B, 1A, 12B...)
                if (!/^[A-Za-z0-9]{1,4}$/.test(catNameFromHash)) {
                    category = catNameFromHash;
                    console.log(`Kategória získaná z URL hash: ${category}`);
                }
            }
        
            // 2. Ak hash nič nedal → hľadáme najbližší relevantný nadpis (<h2>, <h3>, <h4>...)
            if (category === 'neznáma kategória') {
                let current = li;
                let foundHeader = null;
        
                // ideme hore po DOM strome, kým nenájdeme nadpis alebo neprejdeme príliš ďaleko
                while (current && current !== document.body && !foundHeader) {
                    // preskočíme niektoré kontajnery, ktoré nechceme brať ako nadpis
                    if (current.classList.contains('zoom-group-box') ||
                        current.classList.contains('zoom-content') ||
                        current.classList.contains('flex-grow') ||
                        current.classList.contains('zoom-responsive')) {
                        current = current.parentElement;
                        continue;
                    }
        
                    // hľadáme predchádzajúci súrodenec, ktorý je nadpis
                    let prev = current.previousElementSibling;
                    while (prev && !foundHeader) {
                        if (['H2','H3','H4'].includes(prev.tagName)) {
                            const text = prev.textContent.trim();
        
                            // vylúčime nezmyselné nadpisy
                            if (text && 
                                !text.startsWith('Základné skupiny') &&
                                !text.startsWith('Nadstavbové skupiny') &&
                                !text.startsWith('Skupina') &&
                                !text.includes('Tímy bez skupiny') &&
                                !/^[A-Za-z0-9]{1,4}$/.test(text) &&           // krátke kódy A, B, 1A...
                                !/^\d+$/.test(text) &&                        // čísla samé
                                text.length > 4) {                            // aspoň niečo zmysluplné
        
                                category = text;
                                console.log(`Kategória nájdená v DOM (nadpis ${prev.tagName}): "${category}"`);
                                foundHeader = true;
                                break;
                            }
                        }
                        prev = prev.previousElementSibling;
                    }
        
                    current = current.parentElement;
                }
            }
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
        
            const playerCount       = (teamData.playerDetails          || []).length;
            const womenCount        = (teamData.womenTeamMemberDetails || []).length;
            const menCount          = (teamData.menTeamMemberDetails   || []).length;
            const driverMaleCount   = (teamData.driverDetailsMale      || []).length;
            const driverFemaleCount = (teamData.driverDetailsFemale    || []).length;
        
            const totalPeople = playerCount + womenCount + menCount 
                              + driverMaleCount + driverFemaleCount;
        
            const packageName    = teamData.packageDetails?.name || '—';
            const accommodation  = teamData.accommodation?.type  || '—';
            const arrivalType    = teamData.arrival?.type        || '—';
            const arrivalTime    = teamData.arrival?.time 
                ? ` (${teamData.arrival.time})` 
                : '';
        
            const displayCategory = teamData.category || category || 'bez kategórie';
        
            // Zoznam riadkov, ktoré chceme zobraziť (iba tie s počtom > 0)
            const teamMemberLines = [];
        
            if (playerCount > 0) {
                teamMemberLines.push(`  • hráči: ${playerCount}`);
            }
            if (womenCount > 0) {
                teamMemberLines.push(`  • člen RT (ženy): ${womenCount}`);
            }
            if (menCount > 0) {
                teamMemberLines.push(`  • člen RT (muži): ${menCount}`);
            }
            if (driverMaleCount > 0) {
                teamMemberLines.push(`  • šofér (muži): ${driverMaleCount}`);
            }
            if (driverFemaleCount > 0) {
                teamMemberLines.push(`  • šofér (ženy): ${driverFemaleCount}`);
            }
        
            // Ak nie je žiadny člen tímu (veľmi nepravdepodobné, ale pre istotu)
            const membersText = teamMemberLines.length > 0 
                ? teamMemberLines.join('\n')
                : '  (žiadni členovia tímu v databáze)';
        
            currentTooltipText = `${displayCategory} → ${teamName}
Počet osôb celkom: ${totalPeople}
${membersText}

Balík: ${packageName}
Ubytovanie: ${accommodation}
Doprava: ${arrivalType}${arrivalTime}`;
        
            // aktualizujeme tooltip
            showTooltipUnderElement(currentTooltipText, li);
        } else {
            currentTooltipText = `${teamName || '(bez názvu)'}\n(údaje sa nenašli v databáze)`;
            showTooltipUnderElement(currentTooltipText, li);
        }

        console.groupEnd();
    });

    span.addEventListener('mouseout', () => {
        hideTooltip();
    });

    span.addEventListener('mouseleave', () => {
        hideTooltip();
    });
}

// na konci súboru (po všetkých funkciách) alebo pred initTeamHoverListeners
let customTooltip = null;

function createOrGetTooltip() {
    if (!customTooltip) {
        customTooltip = document.createElement('div');
        customTooltip.id = 'team-custom-tooltip';
        customTooltip.style.position = 'absolute';
        customTooltip.style.zIndex = '9999';
        customTooltip.style.background = 'rgba(129, 220, 163, 0.96)';
        customTooltip.style.color = '#000000';
        customTooltip.style.padding = '10px 14px';
        customTooltip.style.borderRadius = '6px';
        customTooltip.style.fontSize = '13px';
        customTooltip.style.fontFamily = 'system-ui, sans-serif';
        customTooltip.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)';
        customTooltip.style.pointerEvents = 'none';
        customTooltip.style.maxWidth = '400px';
        customTooltip.style.lineHeight = '1.45';
        customTooltip.style.whiteSpace = 'pre-wrap';
        customTooltip.style.display = 'none';
        customTooltip.style.border = '1px solid #81dca3';
        document.body.appendChild(customTooltip);
    }
    return customTooltip;
}

function showTooltipUnderElement(text, element) {
    const tt = createOrGetTooltip();

    tt.textContent = text;

    // Získame pozíciu <li> elementu
    const rect = element.getBoundingClientRect();

    // Tooltip pod riadkom
    const tooltipTop  = rect.bottom + window.scrollY + 8;   // 8 px pod spodným okrajom
    const tooltipLeft = rect.left + window.scrollX + (rect.width / 2) - 80;  // približne na stred

    // Ochrana pred presahom za ľavý okraj obrazovky
    const finalLeft = Math.max(10, tooltipLeft);

    tt.style.left = finalLeft + 'px';
    tt.style.top  = tooltipTop + 'px';
    tt.style.display = 'block';
}

function hideTooltip() {
    if (customTooltip) {
        customTooltip.style.display = 'none';
    }
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
            setupTeamBubblesListener();
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

// logged-in-team-info.js

import {
  doc, getDoc, onSnapshot, collection, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

console.log("%c[logged-in-team-info.js] Skript beží – čakám na window.db",
    "color:#8b5cf6; font-weight:bold; font-size:14px; background:#000; padding:4px 8px; border-radius:4px;");

let shouldShowTeamBubbles = true;
let unsubscribeUserSettings = null;
let customTooltip = null;
let observer = null;
let isReactAppDetected = false;
let reactAppRoot = null;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 30; // 15 sekúnd

// === ZJEDNODUŠENÁ DETEKCIA REACT APLIKÁCIE ===
function detectReactApp() {
    // Skontrolujeme prítomnosť React aplikácie
    return !!document.getElementById('root') || 
           typeof ReactDOM !== 'undefined' || 
           typeof React !== 'undefined' ||
           !!document.querySelector('[data-reactroot]');
}

// === UPRAVENÉ NAČÍTANIE NASTAVENIA ===
function setupTeamBubblesListener() {
    if (unsubscribeUserSettings) return;
  
    if (!window.db || !window.auth || !window.auth.currentUser) {
        console.warn("[team-info] auth alebo db ešte nie je pripravené → čakáme");
        return;
    }

    const userId = window.auth.currentUser.uid;
    const userRef = doc(window.db, "users", userId);

    console.log(`[team-info] Nastavujem onSnapshot na users/${userId} → sledujem displayTeamBubbles`);

    unsubscribeUserSettings = onSnapshot(userRef, (snap) => {
        if (!snap.exists()) {
            console.warn("[team-info] Dokument používateľa neexistuje");
            shouldShowTeamBubbles = true; // fallback
            return;
        }

        const data = snap.data() || {};
        const newValue = data.displayTeamBubbles;

        if (newValue === undefined) {
            console.log("[team-info] Inicializujem displayTeamBubbles = true");
            updateDoc(userRef, { displayTeamBubbles: true })
                .catch(err => console.error("[team-info] Chyba pri init:", err));
            shouldShowTeamBubbles = true;
        } else {
            shouldShowTeamBubbles = !!newValue;
            console.log(`[team-info] displayTeamBubbles = ${shouldShowTeamBubbles}`);
        }
    }, (err) => {
        console.error("[team-info] Chyba pri počúvaní nastavenia bubliniek:", err);
        shouldShowTeamBubbles = true;
    });
}

// === VYHĽADÁVANIE V FIRESTORE (OSTÁVA ROVNAKÉ) ===
async function lookupTeamInFirestore(teamName, category = null, group = null) {
    if (!window.db) {
        console.warn("Firestore (window.db) nie je dostupné!");
        return null;
    }

    let cleanName = teamName.trim();
    console.log(`Hľadám tím "${cleanName}" (predpokladaná kategória: ${category || 'ľubovoľná'}, skupina: ${group || 'ľubovoľná'})`);

    try {
        // 1. superstructureGroups
        const superstructureRef = doc(window.db, 'settings/superstructureGroups');
        const superstructureSnap = await getDoc(superstructureRef);
        if (superstructureSnap.exists()) {
            const data = superstructureSnap.data() || {};
            for (const [catKey, teams] of Object.entries(data)) {
                if (!Array.isArray(teams)) continue;

                let found = null;
                if (category && catKey === category) {
                    const prefixed = `${category} ${cleanName}`;
                    found = teams.find(t => t.teamName === prefixed || t.teamName === cleanName);
                }
                if (!found) {
                    found = teams.find(t => t.teamName === cleanName);
                }
                if (found) {
                    console.log(`→ Nájdený v superstructureGroups (${catKey}) pod "${found.teamName}"`);
                    return { source: 'superstructure', category: catKey, ...found };
                }
            }
        }

        // 2. users – s presnou kategóriou
        console.log("Prehľadávam users...");
        const usersCol = collection(window.db, "users");
        const usersSnap = await getDocs(usersCol);

        let foundWithCategory = null;
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            if (!userData?.teams) continue;

            for (const [catKey, teamArray] of Object.entries(userData.teams || {})) {
                if (!Array.isArray(teamArray)) continue;

                if (category && catKey === category) {
                    const found = teamArray.find(t => 
                        t.teamName === cleanName ||
                        t.teamName === `${category} ${cleanName}`
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
            console.log(`→ Nájdený s presnou kategóriou ${foundWithCategory.category}`);
            return foundWithCategory;
        }

        // 3. FALLBACK: hľadáme všade
        console.log(`Tím sa nenašiel v predpokladanej kategórii "${category}" → fallback`);

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            if (!userData?.teams) continue;

            for (const [catKey, teamArray] of Object.entries(userData.teams || {})) {
                if (!Array.isArray(teamArray)) continue;

                const found = teamArray.find(t => t.teamName === cleanName);
                if (found) {
                    console.log(`→ FALLBACK: Nájdený v kategórii ${catKey} pod "${found.teamName}"`);
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

// === FUNKCIE PRE TOOLTIP ===
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

    const rect = element.getBoundingClientRect();
    const tooltipTop = rect.bottom + window.scrollY + 8;
    const tooltipLeft = rect.left + window.scrollX + (rect.width / 2) - 80;
    const finalLeft = Math.max(10, tooltipLeft);

    tt.style.left = finalLeft + 'px';
    tt.style.top = tooltipTop + 'px';
    tt.style.display = 'block';
}

function hideTooltip() {
    if (customTooltip) {
        customTooltip.style.display = 'none';
    }
}

// === UNIVERZÁLNA FUNKCIA NA PRIRADENIE LISTENERA ===
function addHoverListener(element) {
    if (element.dataset.hoverListenerAdded) return;
    element.dataset.hoverListenerAdded = 'true';

    element.addEventListener('mouseover', async e => {
        if (!shouldShowTeamBubbles) return;
        
        // Získame text z elementu
        let visibleText = e.target.textContent.trim();
        let teamName = visibleText.replace(/^\d+\.\s*/, '').trim();
        
        // Odstráňme prípadný prefix kategórie (napr. "Kategória: ")
        const colonIndex = visibleText.indexOf(':');
        if (colonIndex !== -1 && colonIndex < visibleText.length - 1) {
            const beforeColon = visibleText.substring(0, colonIndex).trim();
            const afterColon = visibleText.substring(colonIndex + 1).trim();
            
            // Ak je pred dvojbodkou krátky text (pravdepodobne kategória)
            if (beforeColon.length < 20 && afterColon.length > 1) {
                teamName = afterColon.replace(/^\d+\.\s*/, '').trim();
            }
        }
        
        // Získame rodičovský li element
        const li = e.target.closest('li');
        if (!li) return;
        
        // Pre React aplikáciu: hľadáme kategóriu v texte
        let category = 'neznáma kategória';
        if (colonIndex !== -1) {
            const potentialCategory = visibleText.substring(0, colonIndex).trim();
            if (potentialCategory && potentialCategory.length < 30) {
                category = potentialCategory;
            }
        }
        
        // Získame údaje o tíme
        const teamData = await lookupTeamInFirestore(teamName, category);
        
        if (teamData) {
            const playerCount = (teamData.playerDetails || []).length;
            const womenCount = (teamData.womenTeamMemberDetails || []).length;
            const menCount = (teamData.menTeamMemberDetails || []).length;
            const driverMaleCount = (teamData.driverDetailsMale || []).length;
            const driverFemaleCount = (teamData.driverDetailsFemale || []).length;
            
            const totalPeople = playerCount + womenCount + menCount + driverMaleCount + driverFemaleCount;
            const packageName = teamData.packageDetails?.name || '—';
            const accommodation = teamData.accommodation?.type || '—';
            const arrivalType = teamData.arrival?.type || '—';
            const arrivalTime = teamData.arrival?.time ? ` (${teamData.arrival.time})` : '';
            const displayCategory = teamData.category || category || 'bez kategórie';
            
            // Zostavíme text tooltipu
            const teamMemberLines = [];
            if (playerCount > 0) teamMemberLines.push(`  • hráči: ${playerCount}`);
            if (womenCount > 0) teamMemberLines.push(`  • člen RT (ženy): ${womenCount}`);
            if (menCount > 0) teamMemberLines.push(`  • člen RT (muži): ${menCount}`);
            if (driverMaleCount > 0) teamMemberLines.push(`  • šofér (muži): ${driverMaleCount}`);
            if (driverFemaleCount > 0) teamMemberLines.push(`  • šofér (ženy): ${driverFemaleCount}`);
            
            const membersText = teamMemberLines.length > 0 
                ? teamMemberLines.join('\n')
                : '  (žiadni členovia tímu v databáze)';
            
            const tooltipText = `${displayCategory} → ${teamName}
Počet osôb celkom: ${totalPeople}
${membersText}

Balík: ${packageName}
Ubytovanie: ${accommodation}
Doprava: ${arrivalType}${arrivalTime}`;
            
            showTooltipUnderElement(tooltipText, li);
        } else {
            const tooltipText = `${teamName || '(bez názvu)'}\n(údaje sa nenašli v databáze)`;
            showTooltipUnderElement(tooltipText, li);
        }
    });

    element.addEventListener('mouseout', hideTooltip);
    element.addEventListener('mouseleave', hideTooltip);
}

// === VYLEPŠENÁ INICIALIZÁCIA PRE REACT ===
function initTeamHoverListeners() {
    console.log("Inicializujem hover listenery...");
    
    // PRIORITA 1: Pre React aplikáciu - hľadáme tímy v špecifickom formáte
    const reactTeams = document.querySelectorAll('li span.font-medium');
    console.log(`Nájdených ${reactTeams.length} React tímov (span.font-medium)`);
    reactTeams.forEach(addHoverListener);
    
    // PRIORITA 2: Pre klasické stránky - pôvodný selektor
    const classicTeams = document.querySelectorAll('li span.flex-grow');
    console.log(`Nájdených ${classicTeams.length} klasických tímov (span.flex-grow)`);
    classicTeams.forEach(addHoverListener);
    
    // PRIORITA 3: Všetky ďalšie span v li, ktoré obsahujú názvy tímov
    const allLiSpans = document.querySelectorAll('li span');
    allLiSpans.forEach(span => {
        const text = span.textContent.trim();
        // Ak span obsahuje text, ktorý vyzerá ako názov tímu
        if (text.length > 2 && 
            !text.includes('(') && 
            !text.includes(')') && 
            !text.match(/^\d+$/) &&
            !span.dataset.hoverListenerAdded) {
            addHoverListener(span);
        }
    });
    
    // MutationObserver pre dynamické pridávanie
    if (!observer) {
        observer = new MutationObserver((mutations) => {
            let shouldReinitialize = false;
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    shouldReinitialize = true;
                }
            });
            
            if (shouldReinitialize) {
                // Počkáme, kým sa DOM stabilizuje
                setTimeout(() => {
                    // Znova inicializujeme všetky nové elementy
                    const newReactTeams = document.querySelectorAll('li span.font-medium:not([data-hover-listener-added])');
                    const newClassicTeams = document.querySelectorAll('li span.flex-grow:not([data-hover-listener-added])');
                    
                    console.log(`MutationObserver: Pridávam ${newReactTeams.length + newClassicTeams.length} nových tímov`);
                    newReactTeams.forEach(addHoverListener);
                    newClassicTeams.forEach(addHoverListener);
                }, 100);
            }
        });
        
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }
    
    console.log("%cHover listenery boli nastavené!",
        "color:#10b981; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");
}

// === RE-INICIALIZÁCIA AK SA REACT NAČÍTA NESKÔR ===
function tryInitializeReactApp() {
    if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
        console.log("Maximálny počet pokusov na inicializáciu React aplikácie dosiahnutý");
        return;
    }
    
    initializationAttempts++;
    
    // Skontrolujeme, či už React aplikácia existuje
    const reactTeams = document.querySelectorAll('li span.font-medium');
    const rootElement = document.getElementById('root');
    
    if ((reactTeams.length > 0 || rootElement) && window.db) {
        console.log(`React aplikácia bola nájdená na pokus ${initializationAttempts} → inicializujem`);
        setupTeamBubblesListener();
        initTeamHoverListeners();
    } else {
        console.log(`Čakám na React aplikáciu... (pokus ${initializationAttempts}/${MAX_INIT_ATTEMPTS})`);
        setTimeout(tryInitializeReactApp, 500);
    }
}

// === HLAVNÁ INICIALIZÁCIA ===
function initApp() {
    console.log("Spúšťam inicializáciu...");
    isReactAppDetected = detectReactApp();
    
    if (isReactAppDetected) {
        console.log("%cDetekovaná React aplikácia",
            "color:#f59e0b; font-weight:bold; font-size:14px; background:#000; padding:4px 8px; border-radius:4px;");
    }
    
    // Čakáme na window.db
    let attempts = 0;
    const maxAttempts = 20;

    function waitForDb() {
        attempts++;

        if (window.db) {
            console.log("%cwindow.db je dostupné",
                "color:#10b981; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");
            
            if (isReactAppDetected) {
                // Pre React: skúsime okamžitú inicializáciu, potom periodickú
                setTimeout(() => {
                    setupTeamBubblesListener();
                    initTeamHoverListeners();
                    // Ak neboli nájdené žiadne tímy, skúsime znovu neskôr
                    if (document.querySelectorAll('li span.font-medium').length === 0) {
                        tryInitializeReactApp();
                    }
                }, 1000); // Počkáme sekundu, kým React vyrenderuje
            } else {
                // Pre klasické stránky
                setupTeamBubblesListener();
                initTeamHoverListeners();
            }
            return;
        }

        if (attempts >= maxAttempts) {
            console.error("%c[CHYBA] window.db sa nenačítal",
                "color:#ef4444; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");
            return;
        }

        console.log(`Čakám na window.db... (pokus ${attempts}/${maxAttempts})`);
        setTimeout(waitForDb, 500);
    }

    waitForDb();
}

// === SPUSTENIE ===
document.addEventListener('DOMContentLoaded', initApp);

// === PERIODICKÁ KONTROLA ===
setInterval(() => {
    const uninitializedReactTeams = document.querySelectorAll('li span.font-medium:not([data-hover-listener-added])');
    const uninitializedClassicTeams = document.querySelectorAll('li span.flex-grow:not([data-hover-listener-added])');
    
    if (uninitializedReactTeams.length + uninitializedClassicTeams.length > 0) {
        console.log(`Periodická kontrola: Pridávam ${uninitializedReactTeams.length + uninitializedClassicTeams.length} nových tímov`);
        uninitializedReactTeams.forEach(addHoverListener);
        uninitializedClassicTeams.forEach(addHoverListener);
    }
}, 3000);

// === MANUÁLNA RE-INICIALIZÁCIA ===
if (typeof window !== 'undefined') {
    window.reinitializeTeamHover = function() {
        console.log("Manuálna re-inicializácia hover listenerov...");
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        initializationAttempts = 0;
        initTeamHoverListeners();
    };
    
    // Môžeme spustiť manuálne z React aplikácie
    window.addEventListener('reactContentLoaded', () => {
        console.log("Event 'reactContentLoaded' zachytený → re-inicializácia");
        setTimeout(() => {
            setupTeamBubblesListener();
            initTeamHoverListeners();
        }, 1500);
    });
}

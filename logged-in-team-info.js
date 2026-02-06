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

// === GLOBÁLNE NASTAVENIE ZOBRAZOVANIA BUBLÍN ===
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
            
            // AK JE VYPNUTÉ, OKAMŽITE ODSTRÁNIME VŠETKY BUBLINKY A LISTENERY
            if (!shouldShowTeamBubbles) {
                console.log("[team-info] Bublinky vypnuté - odstraňujem tooltip a listenery");
                hideTooltip();
                removeAllHoverListeners();
            }
        }
    }, (err) => {
        console.error("[team-info] Chyba pri počúvaní nastavenia bubliniek:", err);
        shouldShowTeamBubbles = true;
    });
}

// === FUNKCIA NA ODSTRÁNENIE VŠETKÝCH HOVER LISTENEROV ===
function removeAllHoverListeners() {
    // Odstrániť tooltip
    hideTooltip();
    if (customTooltip && customTooltip.parentNode) {
        customTooltip.parentNode.removeChild(customTooltip);
        customTooltip = null;
    }
    
    // Odstrániť všetky listenery
    const elements = document.querySelectorAll('[data-hover-listener-added]');
    elements.forEach(el => {
        el.removeAttribute('data-hover-listener-added');
        // Vytvoríme nový element bez listenerov
        const newEl = el.cloneNode(true);
        if (el.parentNode) {
            el.parentNode.replaceChild(newEl, el);
        }
    });
    
    // Zastaviť observer
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    
    console.log("Všetky hover listenery boli odstránené (bublinky vypnuté)");
}

// === VYLEPŠENÉ VYHĽADÁVANIE V FIRESTORE ===
async function lookupTeamInFirestore(teamName, category = null, group = null) {
    if (!window.db) {
        console.warn("Firestore (window.db) nie je dostupné!");
        return null;
    }

    let cleanName = teamName.trim();
    console.log(`Hľadám tím "${cleanName}" (kategória: ${category || 'neznáma'}, skupina: ${group || 'ľubovoľná'})`);

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
    // SKONTROLUJEME, CI MÔŽEME ZOBRAZOVAŤ BUBLINKY
    if (!shouldShowTeamBubbles) {
        return; // Ak sú bublinky vypnuté, nevytvárame tooltip
    }
    
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

// === VYLEPŠENÁ FUNKCIA NA ZÍSKANIE KATEGÓRIE Z DOM ===
function getCategoryFromDOM(element) {
    if (!element) return 'neznáma kategória';
    
    // Najprv skúsime nájsť kategóriu v texte (ak je formát "Kategória: Tím")
    const visibleText = element.textContent.trim();
    const colonIndex = visibleText.indexOf(':');
    if (colonIndex !== -1 && colonIndex < visibleText.length - 1) {
        const potentialCategory = visibleText.substring(0, colonIndex).trim();
        if (potentialCategory && potentialCategory.length < 30) {
            return potentialCategory;
        }
    }
    
    // Hľadáme najbližší nadpis (h2, h3, h4) v DOM hierarchii
    let current = element;
    let foundHeader = null;
    
    // Najprv ideme hore po DOM strome (max 10 úrovní)
    for (let i = 0; i < 10; i++) {
        if (!current || current === document.body) break;
        
        // Skúsime nájsť nadpis medzi súrodencami
        let sibling = current.previousElementSibling;
        while (sibling && !foundHeader) {
            const tagName = sibling.tagName.toUpperCase();
            if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName)) {
                const text = sibling.textContent.trim();
                
                // Filtrujeme nezmyselné nadpisy
                if (text && 
                    !text.startsWith('Základné skupiny') &&
                    !text.startsWith('Nadstavbové skupiny') &&
                    !text.startsWith('Skupina') &&
                    !text.includes('Tímy bez skupiny') &&
                    !/^[A-Za-z0-9]{1,4}$/.test(text) &&
                    !/^\d+$/.test(text) &&
                    text.length > 4) {
                    
                    foundHeader = text;
                    break;
                }
            }
            sibling = sibling.previousElementSibling;
        }
        
        // Ak sme našli nadpis, vrátime ho
        if (foundHeader) {
            return foundHeader;
        }
        
        // Skúsime kontajnery, ktoré by mohli obsahovať kategóriu
        const possibleCategoryContainers = current.querySelectorAll(
            '.category-name, .category-title, [data-category], .card-header, .group-header'
        );
        
        for (const container of possibleCategoryContainers) {
            const text = container.textContent.trim();
            if (text && text.length > 2) {
                // Vyfiltrujeme krátke texty a čísla
                if (text.length > 4 && !/^\d+$/.test(text) && !/^[A-Z]{1,4}$/.test(text)) {
                    return text;
                }
            }
        }
        
        // Prejdeme na rodiča
        current = current.parentElement;
    }
    
    // Ak sme nenašli kategóriu v DOM, skúsime URL hash ako fallback
    if (window.location.hash && window.location.hash.length > 1) {
        const hash = window.location.hash.substring(1);
        const parts = hash.split('/');
        let catNameFromHash = decodeURIComponent(parts[0]).replace(/-/g, ' ').trim();
        
        if (!/^[A-Za-z0-9]{1,4}$/.test(catNameFromHash) && catNameFromHash.length > 3) {
            return catNameFromHash;
        }
    }
    
    return 'neznáma kategória';
}

// === VYLEPŠENÁ FUNKCIA NA PRIRADENIE LISTENERA ===
function addHoverListener(element) {
    // SKONTROLUJEME, CI MÁME POVOLENÉ BUBLINKY
    if (!shouldShowTeamBubbles) {
        return; // Ak sú bublinky vypnuté, nepridávame listenery
    }
    
    if (element.dataset.hoverListenerAdded) return;
    element.dataset.hoverListenerAdded = 'true';

    element.addEventListener('mouseover', async e => {
        // DVOJITÁ KONTROLA PRE ZABEZPEČENIE
        if (!shouldShowTeamBubbles) {
            hideTooltip();
            return;
        }
        
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
        
        // ZÍSKAME KATEGÓRIU - VYLEPŠENÁ VERZIA
        let category = getCategoryFromDOM(li);
        
        // Ak máme kategóriu v texte, použijeme ju
        if (colonIndex !== -1) {
            const potentialCategory = visibleText.substring(0, colonIndex).trim();
            if (potentialCategory && potentialCategory.length < 30) {
                category = potentialCategory;
            }
        }
        
        // Skupina + typ podľa farby
        let group = 'bez skupiny';
        let type = 'tím v základnej skupine';
        
        const groupHeader = li.closest('.zoom-group-box')?.querySelector('h3, h4');
        if (groupHeader) group = groupHeader.textContent.trim();
        
        if (li.classList.contains('bg-yellow-50')) {
            type = 'SUPERSTRUCTURE / nadstavbový tím';
        } else if (li.closest('.bg-blue-100')) {
            type = 'tím v nadstavbovej skupine';
        } else if (li.closest('.bg-gray-100')) {
            type = 'tím v základnej skupine';
        }
        
        // Konzolový výpis
        console.groupCollapsed(`%c${teamName || '(bez názvu)'}`, 'color:#10b981; font-weight:bold;');
        console.log(`Viditeľný text: ${visibleText}`);
        console.log(`Vyčistený názov: ${teamName}`);
        console.log(`Kategória: ${category}`);
        console.log(`Skupina: ${group}`);
        console.log(`Typ: ${type}`);
        
        // Získame údaje o tíme
        const teamData = await lookupTeamInFirestore(teamName, category, group);
        
        // Zobraziť bublinu IBA ak sa našli údaje A SÚ POVOLENÉ BUBLINKY
        if (teamData && shouldShowTeamBubbles) {
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
        } else if (!shouldShowTeamBubbles) {
            // Ak sú bublinky vypnuté, nespustíme nič
            console.log("Bublinky sú vypnuté - nezobrazujem tooltip");
        } else {
            // Ak sa tím nenašiel v databáze
            console.log("→ Tím sa nenašiel v databáze - bublina sa nezobrazí");
        }
        
        console.groupEnd();
    });

    element.addEventListener('mouseout', hideTooltip);
    element.addEventListener('mouseleave', hideTooltip);
}

// === OPTIMIZOVANÁ INICIALIZÁCIA ===
function initTeamHoverListeners() {
    console.log("Inicializujem hover listenery...");
    
    // SKONTROLUJEME, CI MÔŽEME INICIALIZOVAŤ
    if (!shouldShowTeamBubbles) {
        console.log("Bublinky sú vypnuté - preskakujem inicializáciu listenerov");
        removeAllHoverListeners();
        return;
    }
    
    // Odstránime staré listenery
    const oldSpans = document.querySelectorAll('[data-hover-listener-added]');
    oldSpans.forEach(span => {
        span.removeAttribute('data-hover-listener-added');
    });
    
    // Nájdeme všetky potenciálne tímy
    const selectors = [
        'li span.font-medium',           // React tímy
        'li span.flex-grow',             // Klasické tímy
        'li span:first-child',           // Ak je názov tímu v prvom spane
        '.zoom-group-box li span',       // Tímy v skupinách
        'li:not(.no-hover) span'         // Všetky ostatné
    ];
    
    let allTeams = new Set();
    
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            const text = el.textContent.trim();
            // Filtrujeme krátke texty a čísla
            if (text.length > 2 && 
                !text.match(/^\d+$/) && 
                !text.match(/^[A-Za-z0-9]{1,3}$/)) {
                allTeams.add(el);
            }
        });
    });
    
    console.log(`Nájdených ${allTeams.size} potenciálnych tímov`);
    
    // Pridáme listenery IBA AK SÚ POVOLENÉ BUBLINKY
    if (shouldShowTeamBubbles) {
        allTeams.forEach(addHoverListener);
    }
    
    // Nastavíme MutationObserver pre dynamické zmeny IBA AK SÚ POVOLENÉ BUBLINKY
    if (!observer && shouldShowTeamBubbles) {
        observer = new MutationObserver((mutations) => {
            let hasNewTeams = false;
            
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    hasNewTeams = true;
                }
                
                // Skontrolujeme aj zmeny v texte
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    hasNewTeams = true;
                }
            });
            
            if (hasNewTeams && shouldShowTeamBubbles) {
                // Počkáme 100ms, kým sa DOM stabilizuje
                setTimeout(() => {
                    // Znova inicializujeme
                    const newTeams = document.querySelectorAll(
                        'li span.font-medium:not([data-hover-listener-added]), ' +
                        'li span.flex-grow:not([data-hover-listener-added]), ' +
                        '.zoom-group-box li span:not([data-hover-listener-added])'
                    );
                    
                    if (newTeams.length > 0) {
                        console.log(`MutationObserver: Pridávam ${newTeams.length} nových tímov`);
                        newTeams.forEach(addHoverListener);
                    }
                }, 100);
            }
        });
        
        observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            characterData: true,
            attributes: false
        });
    }
    
    console.log("%cHover listenery boli nastavené!",
        "color:#10b981; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");
}

// === RE-INICIALIZÁCIA PRE REACT ===
let reactInitializationTimer = null;

function reinitializeForReact() {
    if (!shouldShowTeamBubbles) {
        console.log("Bublinky sú vypnuté - preskakujem re-inicializáciu pre React");
        return;
    }
    
    if (reactInitializationTimer) {
        clearTimeout(reactInitializationTimer);
    }
    
    reactInitializationTimer = setTimeout(() => {
        console.log("Re-inicializácia pre React aplikáciu...");
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        initTeamHoverListeners();
        
        // Manuálne pridáme listenery na všetky tímy, ktoré sú zobrazené
        const allTeams = document.querySelectorAll('li span');
        allTeams.forEach(span => {
            const text = span.textContent.trim();
            if (text.length > 2 && !text.match(/^\d+$/) && !span.dataset.hoverListenerAdded) {
                addHoverListener(span);
            }
        });
    }, 1000); // Počkáme sekundu, kým React vyrenderuje obsah
}

// === HLAVNÁ INICIALIZÁCIA ===
function initApp() {
    console.log("Spúšťam inicializáciu...");
    
    // Čakáme na window.db
    let attempts = 0;
    const maxAttempts = 20;

    function waitForDb() {
        attempts++;

        if (window.db) {
            console.log("%cwindow.db je dostupné → inicializujem",
                "color:#10b981; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");
            
            // NAJPRV NASTAVÍME LISTENER NA NASTAVENIA (aby sme vedeli či môžeme inicializovať)
            setupTeamBubblesListener();
            
            // Počkáme chvíľu, kým sa načítajú nastavenia
            setTimeout(() => {
                // IBA AK SÚ POVOLENÉ BUBLINKY, INICIALIZUJEME LISTENERY
                if (shouldShowTeamBubbles) {
                    setTimeout(() => {
                        initTeamHoverListeners();
                        
                        // Špeciálna inicializácia pre React aplikácie
                        if (document.getElementById('root') || typeof React !== 'undefined') {
                            console.log("%cDetekovaná React aplikácia → použijeme špeciálny režim",
                                "color:#f59e0b; font-weight:bold; font-size:14px; background:#000; padding:4px 8px; border-radius:4px;");
                            
                            // Re-inicializácia po 2 sekundách (React sa môže načítavať neskôr)
                            setTimeout(reinitializeForReact, 2000);
                            
                            // Event listener pre manuálnu re-inicializáciu
                            window.addEventListener('reactContentLoaded', reinitializeForReact);
                        }
                    }, 500);
                } else {
                    console.log("%cBublinky sú vypnuté - neinicializujem hover listenery",
                        "color:#ef4444; font-weight:bold; font-size:14px; background:#000; padding:4px 8px; border-radius:4px;");
                }
            }, 300);
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

// === PERIODICKÁ KONTROLA A RE-INICIALIZÁCIA ===
setInterval(() => {
    // Kontrola nespracovaných tímov IBA AK SÚ POVOLENÉ BUBLINKY
    if (shouldShowTeamBubbles) {
        const uninitializedTeams = document.querySelectorAll(
            'li span.font-medium:not([data-hover-listener-added]), ' +
            'li span.flex-grow:not([data-hover-listener-added]), ' +
            '.zoom-group-box li span:not([data-hover-listener-added])'
        );
        
        if (uninitializedTeams.length > 0) {
            console.log(`Periodická kontrola: Pridávam ${uninitializedTeams.length} nových tímov`);
            uninitializedTeams.forEach(addHoverListener);
        }
        
        // Re-inicializácia, ak sa DOM výrazne zmenil
        const totalTeams = document.querySelectorAll('li span').length;
        const initializedTeams = document.querySelectorAll('[data-hover-listener-added]').length;
        
        if (totalTeams > 0 && initializedTeams < totalTeams * 0.5) {
            console.log(`Málo inicializovaných tímov (${initializedTeams}/${totalTeams}) → re-inicializácia`);
            initTeamHoverListeners();
        }
    }
}, 5000); // Kontrola každých 5 sekúnd

// === MANUÁLNA RE-INICIALIZÁCIA ===
if (typeof window !== 'undefined') {
    window.reinitializeTeamHover = function() {
        // SKONTROLUJEME, CI MÔŽEME RE-INICIALIZOVAŤ
        if (!shouldShowTeamBubbles) {
            console.log("Bublinky sú vypnuté - manuálna re-inicializácia ignorovaná");
            return;
        }
        
        console.log("Manuálna re-inicializácia hover listenerov...");
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        initTeamHoverListeners();
    };
}

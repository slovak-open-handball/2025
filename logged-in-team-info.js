import {
  doc, getDoc, onSnapshot, collection, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
let shouldShowTeamBubbles = true;
let unsubscribeUserSettings = null;
let customTooltip = null;
let observer = null;
let currentUserId = null;
let currentHoverElement = null;
let pendingTooltipRequest = null;
function setupTeamBubblesListener() {
    if (unsubscribeUserSettings) return;  
    if (!window.db || !window.auth || !window.auth.currentUser) {
        console.warn("[team-info] auth alebo db ešte nie je pripravené → čakáme");
        return;
    }
    currentUserId = window.auth.currentUser.uid;
    const userRef = doc(window.db, "users", currentUserId);
    unsubscribeUserSettings = onSnapshot(userRef, (snap) => {
        if (!snap.exists()) {
            console.warn("[team-info] Dokument používateľa neexistuje");
            shouldShowTeamBubbles = true;
            updateDoc(userRef, { displayTeamBubbles: true })
                .then(() => console.log("[team-info] Inicializované displayTeamBubbles = true"))
                .catch(err => console.error("[team-info] Chyba pri init:", err));
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
                hideTooltipImmediately();
                removeAllHoverListeners();
                
                // Zastaviť observer
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
            } else {
                // Ak sú bublinky zapnuté, re-inicializujeme listenery
                console.log("[team-info] Bublinky zapnuté - inicializujem listenery");
                initTeamHoverListeners();
            }
        }
    }, (err) => {
        console.error("[team-info] Chyba pri počúvaní nastavenia bubliniek:", err);
        shouldShowTeamBubbles = true;
    });
}

// === FUNKCIA NA ODSTRÁNENIE VŠETKÝCH HOVER LISTENEROV ===
function removeAllHoverListeners() {
    // Zrušiť čakajúcu požiadavku
    if (pendingTooltipRequest) {
        clearTimeout(pendingTooltipRequest);
        pendingTooltipRequest = null;
    }
    
    // Odstrániť tooltip OKAMŽITE
    hideTooltipImmediately();
    
    if (customTooltip && customTooltip.parentNode) {
        customTooltip.parentNode.removeChild(customTooltip);
        customTooltip = null;
    }
    
    // Resetovať aktuálny hover element
    currentHoverElement = null;
    
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
        customTooltip.style.opacity = '0';
        customTooltip.style.transition = 'opacity 0.15s ease';
        document.body.appendChild(customTooltip);
    }
    return customTooltip;
}

function showTooltipUnderElement(text, element) {
    // SKONTROLUJEME, CI MÔŽEME ZOBRAZOVAŤ BUBLINKY
    if (!shouldShowTeamBubbles) {
        return;
    }
    
    // Kontrola, či sme stále nad tým istým elementom (porovnávame podľa ID alebo referencie)
    if (!currentHoverElement || !element.contains(currentHoverElement)) {
        return;
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
    
    // Animácia plynulého zobrazenia
    requestAnimationFrame(() => {
        tt.style.opacity = '1';
    });
}

// NOVÁ FUNKCIA: Okamžité skrytie tooltipu
function hideTooltipImmediately() {
    if (customTooltip) {
        customTooltip.style.opacity = '0';
        setTimeout(() => {
            if (customTooltip && customTooltip.style.opacity === '0') {
                customTooltip.style.display = 'none';
            }
        }, 150); // Čas zodpovedá trvaniu prechodu
        currentHoverElement = null;
        
        // Zrušiť čakajúcu požiadavku
        if (pendingTooltipRequest) {
            clearTimeout(pendingTooltipRequest);
            pendingTooltipRequest = null;
        }
    }
}

// === PRIORITNÁ FUNKCIA NA ZÍSKANIE KATEGÓRIE Z DOM ===
function getCategoryFromDOM(element) {
    if (!element) return 'neznáma kategória';
    
    const visibleText = element.textContent.trim();
    
    // 1. PRIORITA: URL HASH (najpresnejšie)
    if (window.location.hash && window.location.hash.length > 1) {
        const hash = window.location.hash.substring(1);
        const parts = hash.split('/');
        let catNameFromHash = decodeURIComponent(parts[0]).replace(/-/g, ' ').trim();
        
        // Očistíme názov kategórie z URL
        catNameFromHash = cleanCategoryName(catNameFromHash);
        
        if (isValidCategoryName(catNameFromHash)) {
            console.log(`[1. URL HASH] Kategória: "${catNameFromHash}"`);
            return catNameFromHash;
        }
    }
    
    // 2. PRIORITA: TEXT PRI HOVER (ak je formát "Kategória: Tím")
    const colonIndex = visibleText.indexOf(':');
    if (colonIndex !== -1 && colonIndex < visibleText.length - 1) {
        const potentialCategory = visibleText.substring(0, colonIndex).trim();
        
        // Validácia, či je to skutočne kategória
        if (isValidCategoryName(potentialCategory)) {
            console.log(`[2. TEXT PRI HOVER] Kategória: "${potentialCategory}"`);
            return potentialCategory;
        }
        
        // Alternatívne: ak je pred dvojbodkou text, ktorý vyzerá ako kategória
        if (potentialCategory && 
            potentialCategory.length > 2 && 
            potentialCategory.length < 30 &&
            !potentialCategory.match(/^\d+$/) &&
            !potentialCategory.match(/^[A-Za-z0-9]{1,3}$/) &&
            !potentialCategory.includes('•') &&
            !potentialCategory.includes('→')) {
            
            const cleaned = cleanCategoryName(potentialCategory);
            if (cleaned && cleaned.length > 2) {
                console.log(`[2. TEXT PRI HOVER - fallback] Kategória: "${cleaned}"`);
                return cleaned;
            }
        }
    }
    
    // 3. PRIORITA: PRVÝ NADPIS NAD TÍMOM (v DOM hierarchii)
    const li = element.closest('li');
    if (li) {
        // Hľadáme nadpisy nad týmto elementom v DOM hierarchii
        const parentHeader = findFirstHeaderAboveElement(li);
        if (parentHeader) {
            const headerText = parentHeader.textContent.trim();
            const cleanedHeader = cleanCategoryName(headerText);
            
            if (isValidCategoryName(cleanedHeader)) {
                console.log(`[3. NADPIS NAD TÍMOM] Kategória: "${cleanedHeader}" (z: "${headerText}")`);
                return cleanedHeader;
            }
        }
        
        // Fallback: hľadáme v zoom-group-box kontajneri
        const groupBox = li.closest('.zoom-group-box');
        if (groupBox) {
            // Najprv skúsime h3 v group-box (názov skupiny)
            const groupHeader = groupBox.querySelector('h3, h4, h5');
            if (groupHeader) {
                const headerText = groupHeader.textContent.trim();
                if (headerText && !headerText.toLowerCase().includes('skupina')) {
                    const cleaned = cleanCategoryName(headerText);
                    if (isValidCategoryName(cleaned)) {
                        console.log(`[3. ZOOM-GROUP-BOX] Kategória: "${cleaned}"`);
                        return cleaned;
                    }
                }
            }
            
            // Hľadáme vyššie v hierarchii
            let parent = groupBox.parentElement;
            for (let i = 0; i < 5; i++) {
                if (!parent) break;
                
                const headers = parent.querySelectorAll('h1, h2, h3');
                for (const header of headers) {
                    const text = header.textContent.trim();
                    const cleaned = cleanCategoryName(text);
                    if (isValidCategoryName(cleaned)) {
                        console.log(`[3. NADRADENÝ KONTAJNER] Kategória: "${cleaned}" (úroveň ${i})`);
                        return cleaned;
                    }
                }
                parent = parent.parentElement;
            }
        }
    }
    
    // 4. FALLBACK: Hľadáme na celej stránke
    const allHeaders = document.querySelectorAll('h1, h2, h3');
    for (const header of allHeaders) {
        const text = header.textContent.trim();
        const cleaned = cleanCategoryName(text);
        
        if (isValidCategoryName(cleaned)) {
            // Skontrolujeme vzdialenosť od nášho elementu
            const distance = getElementDistance(element, header);
            if (distance < 500) { // Max vzdialenosť v DOM
                console.log(`[4. FALLBACK] Kategória: "${cleaned}" (vzdialenosť: ${distance})`);
                return cleaned;
            }
        }
    }
    
    console.warn(`Nepodarilo sa nájsť kategóriu pre element: "${visibleText.substring(0, 50)}..."`);
    return 'neznáma kategória';
}

// === POMOCNÁ FUNKCIA NA NÁJDENIE PRVÉHO NADPISU NAD ELEMENTOM ===
function findFirstHeaderAboveElement(element) {
    let current = element;
    let searchDepth = 0;
    const maxDepth = 10;
    
    while (current && current !== document.body && searchDepth < maxDepth) {
        // Skúsime nájsť nadpisy medzi predchádzajúcimi súrodencami
        let sibling = current.previousElementSibling;
        let siblingCount = 0;
        const maxSiblings = 15;
        
        while (sibling && siblingCount < maxSiblings) {
            // Hľadáme nadpisy priamo v súrodencovi
            if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(sibling.tagName.toUpperCase())) {
                const text = sibling.textContent.trim();
                if (isValidCategoryName(cleanCategoryName(text))) {
                    return sibling;
                }
            }
            
            // Hľadáme nadpisy v potomkoch súrodenca
            const childHeaders = sibling.querySelectorAll('h1, h2, h3, h4, h5, h6');
            for (const header of childHeaders) {
                const text = header.textContent.trim();
                if (isValidCategoryName(cleanCategoryName(text))) {
                    return header;
                }
            }
            
            sibling = sibling.previousElementSibling;
            siblingCount++;
        }
        
        // Ak sme nenašli medzi súrodencami, skúsime rodiča
        current = current.parentElement;
        searchDepth++;
    }
    
    return null;
}

// === FUNKCIA NA ČISTENIE NÁZVU KATEGÓRIE ===
function cleanCategoryName(name) {
    if (!name) return '';
    
    let cleaned = name.trim();
    
    // Odstrániť nechcené prefixy
    const unwantedPrefixes = [
        'skupina',
        'Skupina',
        'základná skupina',
        'nadstavbová skupina',
        'Základné skupiny',
        'Nadstavbové skupiny',
        'Tímy bez skupiny'
    ];
    
    for (const prefix of unwantedPrefixes) {
        if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
            cleaned = cleaned.substring(prefix.length).trim();
            // Odstrániť prípadné pomlčky a dvojbodky na začiatku
            cleaned = cleaned.replace(/^[-–:]\s*/, '').trim();
            break;
        }
    }
    
    // Odstrániť čísla skupín (napr. "A", "B", "1", "2")
    cleaned = cleaned.replace(/^[A-Za-z0-9]\s*[-–]\s*/, '').trim();
    
    // Odstrániť príliš dlhé texty (pravdepodobne nie sú kategórie)
    if (cleaned.length > 50) {
        // Skúsime nájsť prvú časť oddelenú čiarkou alebo pomlčkou
        const parts = cleaned.split(/[,–-]/);
        if (parts[0] && parts[0].length > 2 && parts[0].length < 30) {
            cleaned = parts[0].trim();
        }
    }
    
    return cleaned;
}

// === POMOCNÁ FUNKCIA NA VALIDÁCIU NÁZVU KATEGÓRIE ===
function isValidCategoryName(text) {
    if (!text || text.length < 3) return false;
    
    // Filtre pre neplatné názvy
    const invalidPatterns = [
        /^\d+$/,                          // Čísla
        /^[A-Za-z0-9]{1,3}$/,             // Krátke kódy (A, B, 1, 2, atď.)
        /^skupina$/i,                     // "Skupina"
        /^základná skupina$/i,            // "Základná skupina"
        /^nadstavbová skupina$/i,         // "Nadstavbová skupina"
        /^základné skupiny$/i,            // "Základné skupiny"
        /^nadstavbové skupiny$/i,         // "Nadstavbové skupiny"
        /^tímy bez skupiny$/i,            // "Tímy bez skupiny"
        /^zoznam tímov$/i,                // "Zoznam tímov"
        /^všetky tímy$/i,                 // "Všetky tímy"
        /^prehľad$/i,                     // "Prehľad"
        /^tabuľka$/i,                     // "Tabuľka"
        /^výsledky$/i,                    // "Výsledky"
        /^navigácia$/i,                   // "Navigácia"
        /^menu$/i,                        // "Menu"
        /^filter$/i,                      // "Filter"
        /^vyhľadávať$/i,                  // "Vyhľadávať"
        /^hlavná ponuka$/i,               // "Hlavná ponuka"
        /^logo$/i,                        // "Logo"
        /^domov$/i,                       // "Domov"
        /^o nás$/i,                       // "O nás"
        /^kontakt$/i,                     // "Kontakt"
        /^prihlásiť sa$/i,                // "Prihlásiť sa"
        /^odhlásiť sa$/i                  // "Odhlásiť sa"
    ];
    
    // Skontrolujeme všetky neplatné vzory
    for (const pattern of invalidPatterns) {
        if (pattern.test(text)) {
            return false;
        }
    }
    
    // Príliš dlhé názvy pravdepodobne nie sú kategórie
    if (text.length > 50) return false;
    
    // Príliš krátke názvy
    if (text.length < 3) return false;
    
    // Platné vzory pre názvy kategórií
    const validPatterns = [
        /^[A-ZÁÉÍÓÚÝČĎĽŇŠŤŽ][a-záéíóúýčďľňšťž]+(\s+[A-ZÁÉÍÓÚÝČĎĽŇŠŤŽ][a-záéíóúýčďľňšťž]+)*$/, // Veľké písmeno na začiatku každého slova
        /^[A-ZÁÉÍÓÚÝČĎĽŇŠŤŽ]{2,}$/i,                                                          // Všetky písmená (napr. "FUTSAL", "FLORBAL")
        /^\d+\s*[-–]\s*[A-ZÁÉÍÓÚÝČĎĽŇŠŤŽ].*$/i,                                            // "1 - Názov kategórie"
        /^[A-ZÁÉÍÓÚÝČĎĽŇŠŤŽ][a-záéíóúýčďľňšťž]+\s*[-–]\s*.+$/i,                              // "Futbal - muži"
        /^kategória\s*[:.]?\s*.+$/i                                                          // "Kategória: Názov"
    ];
    
    // Ak vyhovuje aspoň jednému platnému vzoru
    for (const pattern of validPatterns) {
        if (pattern.test(text)) {
            return true;
        }
    }
    
    // Fallback: obsahuje medzeru a aspoň jedno veľké písmeno
    if (text.includes(' ') && /[A-ZÁÉÍÓÚÝČĎĽŇŠŤŽ]/.test(text)) {
        return true;
    }
    
    return false;
}

// === POMOCNÁ FUNKCIA NA VÝPOČET VZDIALENOSTI ===
function getElementDistance(el1, el2) {
    if (!el1 || !el2) return Infinity;
    
    let distance = 0;
    let current1 = el1;
    let current2 = el2;
    const path1 = [];
    const path2 = [];
    
    // Získame cestu k root elementu pre prvý element
    while (current1 && current1 !== document.body) {
        path1.unshift(current1);
        current1 = current1.parentElement;
    }
    
    // Získame cestu k root elementu pre druhý element
    while (current2 && current2 !== document.body) {
        path2.unshift(current2);
        current2 = current2.parentElement;
    }
    
    // Nájdeme spoločného predka
    let commonAncestor = null;
    for (let i = 0; i < Math.min(path1.length, path2.length); i++) {
        if (path1[i] === path2[i]) {
            commonAncestor = path1[i];
        } else {
            break;
        }
    }
    
    if (!commonAncestor) return Infinity;
    
    // Vypočítame vzdialenosť
    distance = (path1.length - path1.indexOf(commonAncestor)) + 
               (path2.length - path2.indexOf(commonAncestor));
    
    return distance;
}

// === VYLEPŠENÁ FUNKCIA NA PRIRADENIE LISTENERA ===
function addHoverListener(element) {
    // SKONTROLUJEME, CI MÁME POVOLENÉ BUBLINKY
    if (!shouldShowTeamBubbles) {
        return;
    }
    
    if (element.dataset.hoverListenerAdded) return;
    element.dataset.hoverListenerAdded = 'true';

    let elementHoverTimeout = null;
    let isElementHovered = false;
    let currentLiElement = null; // Uložíme si referenciu na li element

    element.addEventListener('mouseover', async e => {
        // Kontrola, či sme už nad týmto elementom
        if (isElementHovered) return;
        
        isElementHovered = true;
        currentHoverElement = element; // Uložíme si span element
        
        // Získame li element
        const li = e.target.closest('li');
        if (!li) {
            isElementHovered = false;
            currentHoverElement = null;
            return;
        }
        currentLiElement = li; // Uložíme si referenciu na li
        
        // Zrušiť predchádzajúci timeout
        if (elementHoverTimeout) {
            clearTimeout(elementHoverTimeout);
        }
        
        // DVOJITÁ KONTROLA PRE ZABEZPEČENIE
        if (!shouldShowTeamBubbles) {
            hideTooltipImmediately();
            isElementHovered = false;
            currentHoverElement = null;
            currentLiElement = null;
            return;
        }
        
        // Pridáme malé oneskorenie pre stabilitu
        elementHoverTimeout = setTimeout(async () => {
            // Kontrola, či sme stále nad elementom
            if (!isElementHovered || currentHoverElement !== element) {
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
            
            // Zobraziť bublinu IBA ak sa našli údaje A SÚ POVOLENÉ BUBLINKY A stále sme nad elementom
            if (teamData && shouldShowTeamBubbles && isElementHovered && currentHoverElement === element) {
                const playerCount = (teamData.playerDetails || []).length;
                const womenCount = (teamData.womenTeamMemberDetails || []).length;
                const menCount = (teamData.menTeamMemberDetails || []).length;
                const driverMaleCount = (teamData.driverDetailsMale || []).length;
                const driverFemaleCount = (teamData.driverDetailsFemale || []).length;
                
                const totalPeople = playerCount + womenCount + menCount + driverMaleCount + driverFemaleCount;
                const packageName = teamData.packageDetails?.name || '—';
                const accommodation = teamData.accommodation?.type || '—';
                const accommodationName = teamData.accommodation?.name || '—';
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
                
                // Upravený text tooltipu s novým riadkom "Ubytovňa:"
                const tooltipText = `${displayCategory} → ${teamName}
Počet osôb celkom: ${totalPeople}
${membersText}

Balík: ${packageName}
Ubytovanie: ${accommodation}
Ubytovňa: ${accommodationName}
Doprava: ${arrivalType}${arrivalTime}`;
                
                showTooltipUnderElement(tooltipText, li);
            } else if (!shouldShowTeamBubbles) {
                // Ak sú bublinky vypnuté, nespustíme nič
                console.log("Bublinky sú vypnuté - nezobrazujem tooltip");
            } else if (!isElementHovered || currentHoverElement !== element) {
                // Ak už nie sme nad elementom
                console.log("Už nie sme nad elementom - preskakujem");
            } else {
                // Ak sa tím nenašiel v databáze
                console.log("→ Tím sa nenašiel v databáze - bublina sa nezobrazí");
            }
            
            console.groupEnd();
        }, 50); // Malé oneskorenie pre stabilitu
    });

    element.addEventListener('mouseout', (e) => {
        // Označíme, že už nie sme nad elementom
        isElementHovered = false;
        
        // Zrušiť timeout
        if (elementHoverTimeout) {
            clearTimeout(elementHoverTimeout);
            elementHoverTimeout = null;
        }
        
        // Kontrola, či sa kurzor presunul do tooltipu
        const relatedTarget = e.relatedTarget;
        if (relatedTarget && customTooltip && customTooltip.contains(relatedTarget)) {
            return; // Nechať tooltip zobrazený, ak sa kurzor presunul do neho
        }
        
        // Skryť tooltip
        hideTooltipImmediately();
        currentLiElement = null;
    });

    element.addEventListener('mouseleave', (e) => {
        // Rýchle skrytie pri opustení elementu
        isElementHovered = false;
        currentHoverElement = null;
        currentLiElement = null;
        
        if (elementHoverTimeout) {
            clearTimeout(elementHoverTimeout);
            elementHoverTimeout = null;
        }
        
        hideTooltipImmediately();
    });
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
    
    // Resetovať stav
    currentHoverElement = null;
    if (pendingTooltipRequest) {
        clearTimeout(pendingTooltipRequest);
        pendingTooltipRequest = null;
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
    
    // Pridáme listener na tooltip
    createOrGetTooltip();
    customTooltip.addEventListener('mouseleave', hideTooltipImmediately);
    
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

        if (window.db && window.auth && window.auth.currentUser) {
            console.log("%cwindow.db a auth sú dostupné → inicializujem",
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
                    // Zastaviť observer ak existuje
                    if (observer) {
                        observer.disconnect();
                        observer = null;
                    }
                }
            }, 300);
            return;
        }

        if (attempts >= maxAttempts) {
            console.error("%c[CHYBA] window.db alebo auth sa nenačítali",
                "color:#ef4444; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");
            return;
        }

        console.log(`Čakám na window.db a auth... (pokus ${attempts}/${maxAttempts})`);
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
    } else {
        // Ak sú bublinky vypnuté, uistíme sa, že nemáme žiadne listenery
        const hasListeners = document.querySelectorAll('[data-hover-listener-added]').length > 0;
        if (hasListeners) {
            console.log("Bublinky sú vypnuté, ale našli sa listenery → odstraňujem");
            removeAllHoverListeners();
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

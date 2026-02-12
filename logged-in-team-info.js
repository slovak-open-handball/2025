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
        return;
    }
    currentUserId = window.auth.currentUser.uid;
    const userRef = doc(window.db, "users", currentUserId);
    unsubscribeUserSettings = onSnapshot(userRef, (snap) => {
        if (!snap.exists()) {
            shouldShowTeamBubbles = true;
            updateDoc(userRef, { displayTeamBubbles: true })
                .then(() => console.log(""))
                .catch(err => console.error("", err));
            return;
        }
        const data = snap.data() || {};
        const newValue = data.displayTeamBubbles;
        if (newValue === undefined) {
            updateDoc(userRef, { displayTeamBubbles: true })
                .catch(err => console.error("", err));
            shouldShowTeamBubbles = true;
        } else {
            shouldShowTeamBubbles = !!newValue;
            if (!shouldShowTeamBubbles) {
                hideTooltipImmediately();
                removeAllHoverListeners();                
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
            } else {
                initTeamHoverListeners();
            }
        }
    }, (err) => {
        shouldShowTeamBubbles = true;
    });
}
function removeAllHoverListeners() {
    if (pendingTooltipRequest) {
        clearTimeout(pendingTooltipRequest);
        pendingTooltipRequest = null;
    }    
    hideTooltipImmediately();    
    if (customTooltip && customTooltip.parentNode) {
        customTooltip.parentNode.removeChild(customTooltip);
        customTooltip = null;
    }    
    currentHoverElement = null;    
    const elements = document.querySelectorAll('[data-hover-listener-added]');
    elements.forEach(el => {
        el.removeAttribute('data-hover-listener-added');
        const newEl = el.cloneNode(true);
        if (el.parentNode) {
            el.parentNode.replaceChild(newEl, el);
        }
    });    
    if (observer) {
        observer.disconnect();
        observer = null;
    }    
}
async function lookupTeamInFirestore(teamName, category = null, group = null) {
    if (!window.db) {
        return null;
    }
    let cleanName = teamName.trim();
    try {
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
                    return { source: 'superstructure', category: catKey, ...found };
                }
            }
        }
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
            return foundWithCategory;
        }
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            if (!userData?.teams) continue;
            for (const [catKey, teamArray] of Object.entries(userData.teams || {})) {
                if (!Array.isArray(teamArray)) continue;
                const found = teamArray.find(t => t.teamName === cleanName);
                if (found) {
                    return { source: 'user', userId: userDoc.id, category: catKey, ...found };
                }
            }
        }
        return null;
    } catch (err) {
        return null;
    }
}
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
    if (!shouldShowTeamBubbles) {
        return;
    }    
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
    requestAnimationFrame(() => {
        tt.style.opacity = '1';
    });
}
function hideTooltipImmediately() {
    if (customTooltip) {
        customTooltip.style.opacity = '0';
        setTimeout(() => {
            if (customTooltip && customTooltip.style.opacity === '0') {
                customTooltip.style.display = 'none';
            }
        }, 150);
        currentHoverElement = null;        
        if (pendingTooltipRequest) {
            clearTimeout(pendingTooltipRequest);
            pendingTooltipRequest = null;
        }
    }
}
function getCategoryFromDOM(element) {
    if (!element) return 'neznáma kategória';    
    const visibleText = element.textContent.trim();    
    if (window.location.hash && window.location.hash.length > 1) {
        const hash = window.location.hash.substring(1);
        const parts = hash.split('/');
        let catNameFromHash = decodeURIComponent(parts[0]).replace(/-/g, ' ').trim();        
        catNameFromHash = cleanCategoryName(catNameFromHash);        
        if (isValidCategoryName(catNameFromHash)) {
            return catNameFromHash;
        }
    }    
    const colonIndex = visibleText.indexOf(':');
    if (colonIndex !== -1 && colonIndex < visibleText.length - 1) {
        const potentialCategory = visibleText.substring(0, colonIndex).trim();        
        if (isValidCategoryName(potentialCategory)) {
            return potentialCategory;
        }        
        if (potentialCategory && 
            potentialCategory.length > 2 && 
            potentialCategory.length < 30 &&
            !potentialCategory.match(/^\d+$/) &&
            !potentialCategory.match(/^[A-Za-z0-9]{1,3}$/) &&
            !potentialCategory.includes('•') &&
            !potentialCategory.includes('→')) {            
            const cleaned = cleanCategoryName(potentialCategory);
            if (cleaned && cleaned.length > 2) {
                return cleaned;
            }
        }
    }    
    const li = element.closest('li');
    if (li) {
        const parentHeader = findFirstHeaderAboveElement(li);
        if (parentHeader) {
            const headerText = parentHeader.textContent.trim();
            const cleanedHeader = cleanCategoryName(headerText);            
            if (isValidCategoryName(cleanedHeader)) {
                return cleanedHeader;
            }
        }        
        const groupBox = li.closest('.zoom-group-box');
        if (groupBox) {
            const groupHeader = groupBox.querySelector('h3, h4, h5');
            if (groupHeader) {
                const headerText = groupHeader.textContent.trim();
                if (headerText && !headerText.toLowerCase().includes('skupina')) {
                    const cleaned = cleanCategoryName(headerText);
                    if (isValidCategoryName(cleaned)) {
                        return cleaned;
                    }
                }
            }            
            let parent = groupBox.parentElement;
            for (let i = 0; i < 5; i++) {
                if (!parent) break;                
                const headers = parent.querySelectorAll('h1, h2, h3');
                for (const header of headers) {
                    const text = header.textContent.trim();
                    const cleaned = cleanCategoryName(text);
                    if (isValidCategoryName(cleaned)) {
                        return cleaned;
                    }
                }
                parent = parent.parentElement;
            }
        }
    }    
    const allHeaders = document.querySelectorAll('h1, h2, h3');
    for (const header of allHeaders) {
        const text = header.textContent.trim();
        const cleaned = cleanCategoryName(text);        
        if (isValidCategoryName(cleaned)) {
            const distance = getElementDistance(element, header);
            if (distance < 500) { 
                return cleaned;
            }
        }
    }    
    return 'neznáma kategória';
}
function findFirstHeaderAboveElement(element) {
    let current = element;
    let searchDepth = 0;
    const maxDepth = 10;    
    while (current && current !== document.body && searchDepth < maxDepth) {
        let sibling = current.previousElementSibling;
        let siblingCount = 0;
        const maxSiblings = 15;        
        while (sibling && siblingCount < maxSiblings) {
            if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(sibling.tagName.toUpperCase())) {
                const text = sibling.textContent.trim();
                if (isValidCategoryName(cleanCategoryName(text))) {
                    return sibling;
                }
            }            
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
        current = current.parentElement;
        searchDepth++;
    }    
    return null;
}
function cleanCategoryName(name) {
    if (!name) return '';    
    let cleaned = name.trim();    
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
            cleaned = cleaned.replace(/^[-–:]\s*/, '').trim();
            break;
        }
    }    
    cleaned = cleaned.replace(/^[A-Za-z0-9]\s*[-–]\s*/, '').trim();    
    if (cleaned.length > 50) {
        const parts = cleaned.split(/[,–-]/);
        if (parts[0] && parts[0].length > 2 && parts[0].length < 30) {
            cleaned = parts[0].trim();
        }
    }    
    return cleaned;
}
function isValidCategoryName(text) {
    if (!text || text.length < 3) return false;    
    const invalidPatterns = [
        /^\d+$/,
        /^[A-Za-z0-9]{1,3}$/,
        /^skupina$/i,
        /^základná skupina$/i,
        /^nadstavbová skupina$/i,
        /^základné skupiny$/i,
        /^nadstavbové skupiny$/i,
        /^tímy bez skupiny$/i,
        /^zoznam tímov$/i,
        /^všetky tímy$/i,
        /^tabuľka$/i,
        /^výsledky$/i,
        /^navigácia$/i,
        /^menu$/i,
        /^filter$/i,
        /^vyhľadávať$/i,
        /^hlavná ponuka$/i,
        /^logo$/i,
        /^domov$/i,
        /^o nás$/i,
        /^kontakt$/i,
        /^prihlásiť sa$/i,
        /^odhlásiť sa$/i
    ];    
    for (const pattern of invalidPatterns) {
        if (pattern.test(text)) {
            return false;
        }
    }    
    if (text.length > 50) return false;    
    if (text.length < 3) return false;    
    const validPatterns = [
        /^[A-ZÁÉÍÓÚÝČĎĽŇŠŤŽ][a-záéíóúýčďľňšťž]+(\s+[A-ZÁÉÍÓÚÝČĎĽŇŠŤŽ][a-záéíóúýčďľňšťž]+)*$/,
        /^[A-ZÁÉÍÓÚÝČĎĽŇŠŤŽ]{2,}$/i,
        /^\d+\s*[-–]\s*[A-ZÁÉÍÓÚÝČĎĽŇŠŤŽ].*$/i,
        /^[A-ZÁÉÍÓÚÝČĎĽŇŠŤŽ][a-záéíóúýčďľňšťž]+\s*[-–]\s*.+$/i,
        /^kategória\s*[:.]?\s*.+$/i
    ];    
    for (const pattern of validPatterns) {
        if (pattern.test(text)) {
            return true;
        }
    }    
    if (text.includes(' ') && /[A-ZÁÉÍÓÚÝČĎĽŇŠŤŽ]/.test(text)) {
        return true;
    }    
    return false;
}
function getElementDistance(el1, el2) {
    if (!el1 || !el2) return Infinity;    
    let distance = 0;
    let current1 = el1;
    let current2 = el2;
    const path1 = [];
    const path2 = [];    
    while (current1 && current1 !== document.body) {
        path1.unshift(current1);
        current1 = current1.parentElement;
    }    
    while (current2 && current2 !== document.body) {
        path2.unshift(current2);
        current2 = current2.parentElement;
    }    
    let commonAncestor = null;
    for (let i = 0; i < Math.min(path1.length, path2.length); i++) {
        if (path1[i] === path2[i]) {
            commonAncestor = path1[i];
        } else {
            break;
        }
    }    
    if (!commonAncestor) return Infinity;    
    distance = (path1.length - path1.indexOf(commonAncestor)) + 
               (path2.length - path2.indexOf(commonAncestor));    
    return distance;
}
function addHoverListener(element) {
    if (!shouldShowTeamBubbles) {
        return;
    }    
    if (element.dataset.hoverListenerAdded) return;
    element.dataset.hoverListenerAdded = 'true';
    let elementHoverTimeout = null;
    let isElementHovered = false;
    let currentLiElement = null;
    element.addEventListener('mouseover', async e => {
        if (isElementHovered) return;        
        isElementHovered = true;
        currentHoverElement = element;         
        const li = e.target.closest('li');
        if (!li) {
            isElementHovered = false;
            currentHoverElement = null;
            return;
        }
        currentLiElement = li;        
        if (elementHoverTimeout) {
            clearTimeout(elementHoverTimeout);
        }        
        if (!shouldShowTeamBubbles) {
            hideTooltipImmediately();
            isElementHovered = false;
            currentHoverElement = null;
            currentLiElement = null;
            return;
        }        
        elementHoverTimeout = setTimeout(async () => {
            if (!isElementHovered || currentHoverElement !== element) {
                return;
            }            
            let visibleText = e.target.textContent.trim();
            let teamName = visibleText.replace(/^\d+\.\s*/, '').trim();            
            const colonIndex = visibleText.indexOf(':');
            if (colonIndex !== -1 && colonIndex < visibleText.length - 1) {
                const beforeColon = visibleText.substring(0, colonIndex).trim();
                const afterColon = visibleText.substring(colonIndex + 1).trim();                
                if (beforeColon.length < 20 && afterColon.length > 1) {
                    teamName = afterColon.replace(/^\d+\.\s*/, '').trim();
                }
            }            
            let category = getCategoryFromDOM(li);            
            if (colonIndex !== -1) {
                const potentialCategory = visibleText.substring(0, colonIndex).trim();
                if (potentialCategory && potentialCategory.length < 30) {
                    category = potentialCategory;
                }
            }            
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
            const teamData = await lookupTeamInFirestore(teamName, category, group);            
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
Ubytovňa: ${accommodationName}
Doprava: ${arrivalType}${arrivalTime}`;                
                showTooltipUnderElement(tooltipText, li);
            }            
        }, 50);
    });
    element.addEventListener('mouseout', (e) => {
        isElementHovered = false;        
        if (elementHoverTimeout) {
            clearTimeout(elementHoverTimeout);
            elementHoverTimeout = null;
        }        
        const relatedTarget = e.relatedTarget;
        if (relatedTarget && customTooltip && customTooltip.contains(relatedTarget)) {
            return;
        }        
        hideTooltipImmediately();
        currentLiElement = null;
    });
    element.addEventListener('mouseleave', (e) => {
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
function initTeamHoverListeners() {
    if (!shouldShowTeamBubbles) {
        removeAllHoverListeners();
        return;
    }    
    currentHoverElement = null;
    if (pendingTooltipRequest) {
        clearTimeout(pendingTooltipRequest);
        pendingTooltipRequest = null;
    }    
    const oldSpans = document.querySelectorAll('[data-hover-listener-added]');
    oldSpans.forEach(span => {
        span.removeAttribute('data-hover-listener-added');
    });    
    const selectors = [
        'li span.font-medium',
        'li span.flex-grow',
        'li span:first-child',
        '.zoom-group-box li span',
        'li:not(.no-hover) span'
    ];    
    let allTeams = new Set();    
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            const text = el.textContent.trim();
            if (text.length > 2 && 
                !text.match(/^\d+$/) && 
                !text.match(/^[A-Za-z0-9]{1,3}$/)) {
                allTeams.add(el);
            }
        });
    });        
    if (shouldShowTeamBubbles) {
        allTeams.forEach(addHoverListener);
    }    
    createOrGetTooltip();
    customTooltip.addEventListener('mouseleave', hideTooltipImmediately);    
    if (!observer && shouldShowTeamBubbles) {
        observer = new MutationObserver((mutations) => {
            let hasNewTeams = false;            
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    hasNewTeams = true;
                }                
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    hasNewTeams = true;
                }
            });            
            if (hasNewTeams && shouldShowTeamBubbles) {
                setTimeout(() => {
                    const newTeams = document.querySelectorAll(
                        'li span.font-medium:not([data-hover-listener-added]), ' +
                        'li span.flex-grow:not([data-hover-listener-added]), ' +
                        '.zoom-group-box li span:not([data-hover-listener-added])'
                    );                    
                    if (newTeams.length > 0) {
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
let reactInitializationTimer = null;
function reinitializeForReact() {
    if (!shouldShowTeamBubbles) {
        return;
    }    
    if (reactInitializationTimer) {
        clearTimeout(reactInitializationTimer);
    }    
    reactInitializationTimer = setTimeout(() => {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        initTeamHoverListeners();        
        const allTeams = document.querySelectorAll('li span');
        allTeams.forEach(span => {
            const text = span.textContent.trim();
            if (text.length > 2 && !text.match(/^\d+$/) && !span.dataset.hoverListenerAdded) {
                addHoverListener(span);
            }
        });
    }, 1000); 
}
function initApp() {
    let attempts = 0;
    const maxAttempts = 20;
    function waitForDb() {
        attempts++;
        if (window.db && window.auth && window.auth.currentUser) {         
            setupTeamBubblesListener();            
            setTimeout(() => {
                if (shouldShowTeamBubbles) {
                    setTimeout(() => {
                        initTeamHoverListeners();                        
                        if (document.getElementById('root') || typeof React !== 'undefined') {                            
                            setTimeout(reinitializeForReact, 2000);                            
                            window.addEventListener('reactContentLoaded', reinitializeForReact);
                        }
                    }, 500);
                } else {
                    if (observer) {
                        observer.disconnect();
                        observer = null;
                    }
                }
            }, 300);
            return;
        }
        if (attempts >= maxAttempts) {
            return;
        }
        setTimeout(waitForDb, 500);
    }
    waitForDb();
}
document.addEventListener('DOMContentLoaded', initApp);
setInterval(() => {
    if (shouldShowTeamBubbles) {
        const uninitializedTeams = document.querySelectorAll(
            'li span.font-medium:not([data-hover-listener-added]), ' +
            'li span.flex-grow:not([data-hover-listener-added]), ' +
            '.zoom-group-box li span:not([data-hover-listener-added])'
        );        
        if (uninitializedTeams.length > 0) {
            uninitializedTeams.forEach(addHoverListener);
        }        
        const totalTeams = document.querySelectorAll('li span').length;
        const initializedTeams = document.querySelectorAll('[data-hover-listener-added]').length;        
        if (totalTeams > 0 && initializedTeams < totalTeams * 0.5) {
            initTeamHoverListeners();
        }
    } else {
        const hasListeners = document.querySelectorAll('[data-hover-listener-added]').length > 0;
        if (hasListeners) {
            removeAllHoverListeners();
        }
    }
}, 5000);
if (typeof window !== 'undefined') {
    window.reinitializeTeamHover = function() {
        if (!shouldShowTeamBubbles) {
            return;
        }        
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        initTeamHoverListeners();
    };
}

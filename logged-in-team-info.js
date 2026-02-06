// logged-in-team-info.js  (verzia kompatibilná aj s teams-in-accommodation stránkou)

import {
  doc, getDoc, onSnapshot, collection, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

console.log("%c[logged-in-team-info.js] Skript beží – verzia 2026-02 kompatibilná s AddGroupsApp",
    "color:#8b5cf6; font-weight:bold; font-size:14px; background:#000; padding:4px 8px; border-radius:4px;");

let shouldShowTeamBubbles = true;
let unsubscribeUserSettings = null;

// === NAČÍTANIE NASTAVENIA ZO USER DOKUMENTU ===
function setupTeamBubblesListener() {
    if (unsubscribeUserSettings) return;
    if (!window.db || !window.auth || !window.auth.currentUser) return;

    const userId = window.auth.currentUser.uid;
    const userRef = doc(window.db, "users", userId);

    console.log(`[team-info] Sledujem users/${userId} → displayTeamBubbles`);

    unsubscribeUserSettings = onSnapshot(userRef, (snap) => {
        if (!snap.exists()) {
            shouldShowTeamBubbles = true;
            return;
        }
        const data = snap.data() || {};
        const val = data.displayTeamBubbles;
        if (val === undefined) {
            updateDoc(userRef, { displayTeamBubbles: true }).catch(console.error);
            shouldShowTeamBubbles = true;
        } else {
            shouldShowTeamBubbles = !!val;
        }
    }, (err) => {
        console.error("[team-info] onSnapshot error:", err);
        shouldShowTeamBubbles = true;
    });
}

// === HLAVNÁ FUNKCIA VYHĽADÁVANIA TÍMU (bez zmien) ===
async function lookupTeamInFirestore(teamName, category = null, group = null) {
    if (!window.db) return null;
    const cleanName = teamName.trim();

    try {
        // superstructureGroups – priorita
        const ssRef = doc(window.db, 'settings/superstructureGroups');
        const ssSnap = await getDoc(ssRef);
        if (ssSnap.exists()) {
            const data = ssSnap.data() || {};
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
                if (found) return { source: 'superstructure', category: catKey, ...found };
            }
        }

        // users – najprv s očakávanou kategóriou
        const usersSnap = await getDocs(collection(window.db, "users"));
        for (const doc of usersSnap.docs) {
            const ud = doc.data();
            if (!ud?.teams) continue;
            for (const [catKey, arr] of Object.entries(ud.teams || {})) {
                if (!Array.isArray(arr)) continue;
                if (category && catKey === category) {
                    const found = arr.find(t => 
                        t.teamName === cleanName || t.teamName === `${category} ${cleanName}`
                    );
                    if (found) return { source: 'user', userId: doc.id, category: catKey, ...found };
                }
            }
        }

        // fallback – hľadáme všade
        for (const doc of usersSnap.docs) {
            const ud = doc.data();
            if (!ud?.teams) continue;
            for (const [catKey, arr] of Object.entries(ud.teams || {})) {
                if (!Array.isArray(arr)) continue;
                const found = arr.find(t => t.teamName === cleanName);
                if (found) return { source: 'user', userId: doc.id, category: catKey, ...found };
            }
        }

        return null;
    } catch (err) {
        console.error("lookupTeamInFirestore error:", err);
        return null;
    }
}

// === DETEKCIA TYPU STRÁNKY ===
function isAccommodationPage() {
    return !!document.getElementById('root') || 
           !!document.querySelector('.bg-green-700') || 
           !!document.querySelector('h2:text-xl:font-bold:text-white');
}

// === ZÍSKANIE KATEGÓRIE NA NOVEJ STRÁNKE ===
function getCategoryFromLi(li) {
    // Najčastejší prípad na accommodation stránke → text pred : v span.font-medium
    const span = li.querySelector('span.font-medium');
    if (span) {
        const text = span.textContent.trim();
        const colonPos = text.indexOf(':');
        if (colonPos > 2 && colonPos < text.length - 2) {
            const cat = text.substring(0, colonPos).trim();
            if (cat && cat.length > 2 && !/^\d+$/.test(cat)) {
                return cat;
            }
        }
    }
    return null;
}

// === PRIRADENIE HOVER LISTENERA ===
function addHoverListener(element) {
    if (element.dataset.hoverListenerAdded) return;
    element.dataset.hoverListenerAdded = 'true';

    element.addEventListener('mouseover', async (e) => {
        if (!shouldShowTeamBubbles) return;

        const li = e.target.closest('li');
        if (!li) return;

        let teamName = '';
        let category = 'neznáma kategória';

        // 1. Skúsime získať z textu spanu (funguje na oboch typoch stránok)
        const nameSpan = li.querySelector('span.font-medium') || 
                        li.querySelector('span.flex-grow');
        
        if (nameSpan) {
            const fullText = nameSpan.textContent.trim();
            const colonIdx = fullText.indexOf(':');
            if (colonIdx !== -1) {
                category = fullText.substring(0, colonIdx).trim();
                teamName = fullText.substring(colonIdx + 1).trim();
            } else {
                teamName = fullText.replace(/^\d+\.\s*/, '').trim();
            }
        } else {
            teamName = li.textContent.trim().replace(/^\d+\.\s*/, '').trim();
        }

        // 2. Ak sa kategóriu nepodarilo získať z textu → fallback na accommodation štruktúru
        if (category === 'neznáma kategória' && isAccommodationPage()) {
            const catFromLi = getCategoryFromLi(li);
            if (catFromLi) category = catFromLi;
        }

        // Zvyšok logiky (typ, skupina, tooltip) môže ostať podobný ako predtým
        let type = 'neznámy typ';
        if (li.classList.contains('bg-yellow-50')) {
            type = 'SUPERSTRUCTURE / nadstavbový tím';
        } else if (li.closest('.bg-blue-100')) {
            type = 'tím v nadstavbovej skupine';
        } else if (li.closest('.bg-gray-100') || li.classList.contains('bg-gray-50')) {
            type = 'tím v základnej skupine / nepriradené ubytovanie';
        }

        console.groupCollapsed(`%c${teamName}`, 'color:#10b981');
        console.log('Kategória:', category);
        console.log('Názov:', teamName);
        console.log('Typ:', type);

        const teamData = await lookupTeamInFirestore(teamName, category);
        
        let tooltipText = `${category} → ${teamName}\n(údaje sa nenašli)`;

        if (teamData) {
            const playerCount = (teamData.playerDetails || []).length;
            const womenCount = (teamData.womenTeamMemberDetails || []).length;
            const menCount   = (teamData.menTeamMemberDetails || []).length;
            const dmCount    = (teamData.driverDetailsMale || []).length;
            const dfCount    = (teamData.driverDetailsFemale || []).length;

            const total = playerCount + womenCount + menCount + dmCount + dfCount;

            const lines = [];
            if (playerCount) lines.push(` • hráči: ${playerCount}`);
            if (womenCount) lines.push(` • člen RT (ženy): ${womenCount}`);
            if (menCount)   lines.push(` • člen RT (muži): ${menCount}`);
            if (dmCount)    lines.push(` • šofér (muži): ${dmCount}`);
            if (dfCount)    lines.push(` • šofér (ženy): ${dfCount}`);

            tooltipText = `${teamData.category || category} → ${teamName}
Počet osôb celkom: ${total}
${lines.length ? lines.join('\n') : ' (žiadni členovia v DB)'}
Balík: ${teamData.packageDetails?.name || '—'}
Ubytovanie: ${teamData.accommodation?.type || '—'}
Doprava: ${teamData.arrival?.type || '—'}${teamData.arrival?.time ? ` (${teamData.arrival.time})` : ''}`;
        }

        showTooltipUnderElement(tooltipText, li);
        console.groupEnd();
    });

    element.addEventListener('mouseout', hideTooltip);
    element.addEventListener('mouseleave', hideTooltip);
}

// Tooltip funkcie (bez zmien)
let customTooltip = null;

function createOrGetTooltip() {
    if (customTooltip) return customTooltip;
    customTooltip = document.createElement('div');
    Object.assign(customTooltip.style, {
        position: 'absolute',
        zIndex: '9999',
        background: 'rgba(129, 220, 163, 0.96)',
        color: '#000',
        padding: '10px 14px',
        borderRadius: '6px',
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        maxWidth: '400px',
        lineHeight: '1.45',
        whiteSpace: 'pre-wrap',
        display: 'none',
        border: '1px solid #81dca3'
    });
    customTooltip.id = 'team-custom-tooltip';
    document.body.appendChild(customTooltip);
    return customTooltip;
}

function showTooltipUnderElement(text, element) {
    const tt = createOrGetTooltip();
    tt.textContent = text;
    const rect = element.getBoundingClientRect();
    let left = rect.left + window.scrollX + (rect.width / 2) - 140;
    left = Math.max(10, Math.min(left, window.innerWidth - 420));
    tt.style.left = left + 'px';
    tt.style.top = (rect.bottom + window.scrollY + 10) + 'px';
    tt.style.display = 'block';
}

function hideTooltip() {
    if (customTooltip) customTooltip.style.display = 'none';
}

// === INICIALIZÁCIA ===
function initTeamHoverListeners() {
    console.log("[team-info] Hľadám elementy na pripojenie tooltipov...");

    const isAccomPage = isAccommodationPage();

    const selector = isAccomPage 
        ? 'li span.font-medium'
        : 'li span.flex-grow';

    const elements = document.querySelectorAll(selector);
    console.log(`→ nájdených ${elements.length} elementov (${isAccomPage ? 'accommodation page' : 'klasický zoznam'})`);

    elements.forEach(addHoverListener);

    // Mutation observer – veľmi dôležitý na React stránke
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (!mutation.addedNodes) return;
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                const newEls = node.querySelectorAll(`${selector}:not([data-hover-listener-added])`);
                newEls.forEach(addHoverListener);
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// === ŠTARTOVACIA LOGIKA ===
document.addEventListener('DOMContentLoaded', () => {
    let attempts = 0;
    const max = 25;

    function tryInit() {
        attempts++;
        if (window.db && window.auth?.currentUser) {
            console.log("%c[team-info] DB + auth ready → štartujem", "color:#10b981; font-weight:bold");
            setupTeamBubblesListener();
            initTeamHoverListeners();
            return;
        }
        if (attempts >= max) {
            console.warn("[team-info] window.db sa nenačítal ani po", max, "pokusoch");
            return;
        }
        setTimeout(tryInit, 400);
    }

    tryInit();
});

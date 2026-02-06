// logged-in-team-info.js  – verzia kompatibilná s KLASICKOU stránkou AJ s AddGroupsApp (nepriradené ubytovanie)

import {
  doc, getDoc, onSnapshot, collection, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

console.log("%c[logged-in-team-info.js] Skript beží – podporuje KLASICKÉ aj ACCOMMODATION stránky",
    "color:#8b5cf6; font-weight:bold; font-size:14px; background:#000; padding:4px 8px; border-radius:4px;");

let shouldShowTeamBubbles = true;
let unsubscribeUserSettings = null;

// ──────────────────────────────────────────────
// 1. Nastavenie zobrazenia bubliniek (bez zmeny)
// ──────────────────────────────────────────────
function setupTeamBubblesListener() {
    if (unsubscribeUserSettings) return;

    if (!window.db || !window.auth || !window.auth.currentUser) {
        console.warn("[team-info] auth alebo db ešte nie je pripravené");
        return;
    }

    const userId = window.auth.currentUser.uid;
    const userRef = doc(window.db, "users", userId);

    console.log(`[team-info] onSnapshot → users/${userId}  (displayTeamBubbles)`);

    unsubscribeUserSettings = onSnapshot(userRef, (snap) => {
        if (!snap.exists()) {
            shouldShowTeamBubbles = true;
            return;
        }
        const data = snap.data() || {};
        const val = data.displayTeamBubbles;
        if (val === undefined) {
            console.log("[team-info] Inicializujem displayTeamBubbles = true");
            updateDoc(userRef, { displayTeamBubbles: true }).catch(console.error);
            shouldShowTeamBubbles = true;
        } else {
            shouldShowTeamBubbles = !!val;
            console.log(`[team-info] displayTeamBubbles = ${shouldShowTeamBubbles}`);
        }
    }, (err) => {
        console.error("[team-info] onSnapshot error:", err);
        shouldShowTeamBubbles = true;
    });
}

// ──────────────────────────────────────────────
// lookupTeamInFirestore – bez zmeny
// ──────────────────────────────────────────────
async function lookupTeamInFirestore(teamName, category = null, group = null) {
    if (!window.db) {
        console.warn("Firestore nie je dostupné");
        return null;
    }
    let cleanName = teamName.trim();
    console.log(`Hľadám tím "${cleanName}" (cat: ${category||'?'}, group: ${group||'?'})`);

    try {
        // 1. superstructureGroups
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
                if (!found) found = teams.find(t => t.teamName === cleanName);
                if (found) {
                    console.log(`→ superstructureGroups / ${catKey} / ${found.teamName}`);
                    return { source: 'superstructure', category: catKey, ...found };
                }
            }
        }

        // 2. users – najprv s predpokladanou kategóriou
        const usersSnap = await getDocs(collection(window.db, "users"));
        let found = null;
        for (const userDoc of usersSnap.docs) {
            const ud = userDoc.data();
            if (!ud?.teams) continue;
            for (const [catKey, arr] of Object.entries(ud.teams || {})) {
                if (!Array.isArray(arr)) continue;
                if (category && catKey === category) {
                    const match = arr.find(t =>
                        t.teamName === cleanName ||
                        t.teamName === `${category} ${cleanName}`
                    );
                    if (match) {
                        found = { source: 'user', userId: userDoc.id, category: catKey, ...match };
                        break;
                    }
                }
            }
            if (found) break;
        }

        if (found) return found;

        // 3. fallback – hľadáme všade
        console.log("→ fallback: hľadám bez filtrovanej kategórie");
        for (const userDoc of usersSnap.docs) {
            const ud = userDoc.data();
            if (!ud?.teams) continue;
            for (const [catKey, arr] of Object.entries(ud.teams || {})) {
                if (!Array.isArray(arr)) continue;
                const match = arr.find(t => t.teamName === cleanName);
                if (match) {
                    console.log(`→ FALLBACK nájdený v ${catKey} u ${userDoc.id}`);
                    return { source: 'user', userId: userDoc.id, category: catKey, ...match };
                }
            }
        }

        console.log("→ nenašlo sa nič");
        return null;
    } catch (err) {
        console.error("lookupTeamInFirestore error:", err);
        return null;
    }
}

// ──────────────────────────────────────────────
// Detekcia typu stránky
// ──────────────────────────────────────────────
function isAccommodationPage() {
    return (
        document.getElementById('root') ||
        document.querySelector('.bg-green-700') ||           // zelený header "Tímy s nepriradeným ubytovaním"
        document.querySelector('li.bg-gray-50')              // štýl riadkov na novej stránke
    ) !== null;
}

// ──────────────────────────────────────────────
// Získanie teamName + category z elementu (univerzálne)
// ──────────────────────────────────────────────
function extractTeamInfoFromElement(el) {
    let visibleText = el.textContent.trim();
    let teamName = visibleText.replace(/^\d+\.\s*/, '').trim();
    let category = null;

    // Najprv skúsime formát "Kategória: Názov" (nová stránka)
    const colonIndex = visibleText.indexOf(':');
    if (colonIndex > 3 && colonIndex < visibleText.length - 3) {
        category = visibleText.substring(0, colonIndex).trim();
        teamName = visibleText.substring(colonIndex + 1).trim().replace(/^\d+\.\s*/, '').trim();
        return { teamName, category, source: 'text-with-colon' };
    }

    // Inak klasický spôsob (pôvodná logika)
    return { teamName, category: null, source: 'classic' };
}

// ──────────────────────────────────────────────
// Hover listener – rozšírený o oba typy stránok
// ──────────────────────────────────────────────
function addHoverListener(span) {
    if (span.dataset.hoverListenerAdded) return;
    span.dataset.hoverListenerAdded = 'true';

    span.addEventListener('mouseover', async (e) => {
        if (!shouldShowTeamBubbles) return;

        let li = e.target.closest('li');
        if (!li) return;

        // 1. Získame základné info z textu spanu
        const info = extractTeamInfoFromElement(e.target);
        let teamName = info.teamName;
        let category = info.category || 'neznáma kategória';

        // 2. Ak nemáme kategóriu z textu → pôvodná logika (hash + DOM nadpisy)
        if (!info.category) {
            // Hash
            if (window.location.hash && window.location.hash.length > 1) {
                let hash = window.location.hash.substring(1);
                let parts = hash.split('/');
                let catFromHash = decodeURIComponent(parts[0]).replace(/-/g, ' ').trim();
                if (!/^[A-Za-z0-9]{1,4}$/.test(catFromHash)) {
                    category = catFromHash;
                }
            }

            // DOM nadpisy (fallback)
            if (category === 'neznáma kategória') {
                let current = li;
                while (current && current !== document.body) {
                    if (current.classList.contains('zoom-group-box') ||
                        current.classList.contains('zoom-content')) {
                        current = current.parentElement;
                        continue;
                    }
                    let prev = current.previousElementSibling;
                    while (prev) {
                        if (['H2','H3','H4'].includes(prev.tagName)) {
                            let txt = prev.textContent.trim();
                            if (txt.length > 4 &&
                                !txt.startsWith('Základné skupiny') &&
                                !txt.startsWith('Nadstavbové skupiny') &&
                                !txt.startsWith('Skupina') &&
                                !txt.includes('Tímy bez skupiny') &&
                                !/^[A-Za-z0-9]{1,4}$/.test(txt)) {
                                category = txt;
                                break;
                            }
                        }
                        prev = prev.previousElementSibling;
                    }
                    if (category !== 'neznáma kategória') break;
                    current = current.parentElement;
                }
            }
        }

        // Typ podľa farby / štruktúry
        let type = 'neznámy typ';
        if (li.classList.contains('bg-yellow-50')) {
            type = 'SUPERSTRUCTURE / nadstavbový tím';
        } else if (li.closest('.bg-blue-100')) {
            type = 'tím v nadstavbovej skupine';
        } else if (li.closest('.bg-gray-100') || li.classList.contains('bg-gray-50')) {
            type = 'základná skupina / nepriradené ubytovanie';
        }

        const groupHeader = li.closest('.zoom-group-box')?.querySelector('h3, h4');
        const group = groupHeader ? groupHeader.textContent.trim() : 'bez skupiny';

        console.groupCollapsed(`%c${teamName}`, 'color:#10b981; font-weight:bold;');
        console.log(`Text: ${e.target.textContent.trim()}`);
        console.log(`Názov: ${teamName}`);
        console.log(`Kategória: ${category}  (${info.source})`);
        console.log(`Typ: ${type}`);

        const teamData = await lookupTeamInFirestore(teamName, category, group);

        let tooltipText = `${category} → ${teamName}\n(údaje nenájdené)`;

        if (teamData) {
            const pc = (teamData.playerDetails || []).length;
            const wc = (teamData.womenTeamMemberDetails || []).length;
            const mc = (teamData.menTeamMemberDetails || []).length;
            const dm = (teamData.driverDetailsMale || []).length;
            const df = (teamData.driverDetailsFemale || []).length;
            const total = pc + wc + mc + dm + df;

            const lines = [];
            if (pc) lines.push(` • hráči: ${pc}`);
            if (wc) lines.push(` • člen RT (ženy): ${wc}`);
            if (mc) lines.push(` • člen RT (muži): ${mc}`);
            if (dm) lines.push(` • šofér (muži): ${dm}`);
            if (df) lines.push(` • šofér (ženy): ${df}`);

            tooltipText = `${teamData.category || category} → ${teamName}
Počet osôb: ${total}
${lines.length ? lines.join('\n') : ' (bez členov v DB)'}
Balík: ${teamData.packageDetails?.name || '—'}
Ubytovanie: ${teamData.accommodation?.type || '—'}
Doprava: ${teamData.arrival?.type || '—'}${teamData.arrival?.time ? ` (${teamData.arrival.time})` : ''}`;
        }

        showTooltipUnderElement(tooltipText, li);
        console.groupEnd();
    });

    span.addEventListener('mouseout', hideTooltip);
    span.addEventListener('mouseleave', hideTooltip);
}

// Tooltip – bez zmien
let customTooltip = null;

function createOrGetTooltip() {
    if (customTooltip) return customTooltip;
    customTooltip = document.createElement('div');
    customTooltip.id = 'team-custom-tooltip';
    Object.assign(customTooltip.style, {
        position: 'absolute',
        zIndex: '9999',
        background: 'rgba(129, 220, 163, 0.96)',
        color: '#000000',
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
    document.body.appendChild(customTooltip);
    return customTooltip;
}

function showTooltipUnderElement(text, element) {
    const tt = createOrGetTooltip();
    tt.textContent = text;
    const rect = element.getBoundingClientRect();
    let left = rect.left + window.scrollX + (rect.width / 2) - 140;
    left = Math.max(10, Math.min(left, window.innerWidth - 420));
    tt.style.left = `${left}px`;
    tt.style.top = `${rect.bottom + window.scrollY + 10}px`;
    tt.style.display = 'block';
}

function hideTooltip() {
    if (customTooltip) customTooltip.style.display = 'none';
}

// ──────────────────────────────────────────────
// Inicializácia + MutationObserver
// ──────────────────────────────────────────────
function initTeamHoverListeners() {
    const isAccom = isAccommodationPage();
    console.log(`[team-info] Detekovaný typ stránky: ${isAccom ? 'ACCOMMODATION' : 'KLASICKÝ'}`);

    const selector = isAccom
        ? 'li span.font-medium'
        : 'li span.flex-grow';

    const elements = document.querySelectorAll(selector);
    console.log(`→ ${elements.length} elementov na pripojenie`);

    elements.forEach(addHoverListener);

    // Mutation Observer – dôležitý najmä pre React stránku
    const observer = new MutationObserver(muts => {
        muts.forEach(mut => {
            if (!mut.addedNodes) return;
            mut.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                const news = node.querySelectorAll(`${selector}:not([data-hover-listener-added])`);
                news.forEach(addHoverListener);
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log("%c[team-info] Hover listenery + observer aktívne", "color:#10b981; font-weight:bold");
}

// ──────────────────────────────────────────────
// Štart
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    let attempts = 0;
    const maxAttempts = 25;

    function waitForDb() {
        attempts++;
        if (window.db) {
            console.log("%cwindow.db ready → inicializácia", "color:#10b981; font-weight:bold");
            setupTeamBubblesListener();
            initTeamHoverListeners();
            return;
        }
        if (attempts >= maxAttempts) {
            console.error("[team-info] window.db sa nenačítal po 25 pokusoch");
            return;
        }
        setTimeout(waitForDb, 400);
    }

    waitForDb();
});

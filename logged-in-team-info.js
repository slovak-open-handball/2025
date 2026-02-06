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
            shouldShowTeamBubbles = true;
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

// === VYHĽADÁVANIE TÍMU (BEZ ZMENY) ===
async function lookupTeamInFirestore(teamName, category = null, group = null) {
    if (!window.db) {
        console.warn("Firestore (window.db) nie je dostupné!");
        return null;
    }

    let cleanName = teamName.trim();
    console.log(`Hľadám tím "${cleanName}" (kategória: ${category || 'ľubovoľná'}, skupina: ${group || 'ľubovoľná'})`);

    try {
        // ... (táto funkcia ostáva BEZ ZMENY – skopíruj ju celú z pôvodného kódu)
        // superstructureGroups → users s prioritou kategórie → fallback bez kategórie
        // ... (celý kód lookupTeamInFirestore bez úprav)
    } catch (err) {
        console.error("Chyba pri prehľadávaní Firestore:", err);
        return null;
    }
}

// === HLAVNÁ FUNKCIA – pridanie hover listenera ===
function addHoverListener(element) {
    // element môže byť <span class="flex-grow"> alebo <span class="font-medium">
    if (element.dataset.hoverListenerAdded) return;
    element.dataset.hoverListenerAdded = 'true';

    element.addEventListener('mouseover', async (e) => {
        if (!shouldShowTeamBubbles) return;

        // ──────────────────────────────────────────────
        // 1. Získanie názvu tímu + kategórie z rôznych štruktúr
        // ──────────────────────────────────────────────
        let visibleText = '';
        let teamName = '';
        let categoryFromText = null;

        // ── React verzia (nová stránka) ───────────────────────────────
        if (element.classList.contains('font-medium')) {
            const li = element.closest('li');
            if (!li) return;

            visibleText = element.textContent.trim();
            // formát: "Kategória: Názov tímu"
            const colonIndex = visibleText.indexOf(':');
            if (colonIndex > 0 && colonIndex < visibleText.length - 1) {
                categoryFromText = visibleText.substring(0, colonIndex).trim();
                teamName = visibleText.substring(colonIndex + 1).trim();
            } else {
                teamName = visibleText;
            }
        }
        // ── Pôvodná verzia (staré stránky) ────────────────────────────
        else {
            visibleText = e.target.textContent.trim();
            teamName = visibleText.replace(/^\d+\.\s*/, '').trim();

            const colonIndex = visibleText.indexOf(':');
            if (colonIndex !== -1 && colonIndex < visibleText.length - 1) {
                const potentialCategory = visibleText.substring(0, colonIndex).trim();
                const potentialTeamName = visibleText.substring(colonIndex + 1).trim();
                if (potentialTeamName && potentialTeamName.length > 1) {
                    categoryFromText = potentialCategory;
                    teamName = potentialTeamName.replace(/^\d+\.\s*/, '').trim();
                }
            }
        }

        if (!teamName) return;

        let category = categoryFromText || 'neznáma kategória';
        let group = 'bez skupiny';
        let type = 'neznámy typ';

        const li = element.closest('li');
        if (!li) return;

        // ──────────────────────────────────────────────
        // 2. Kategória – fallbacky, ak nie je v texte
        // ──────────────────────────────────────────────
        if (!categoryFromText) {
            // hash
            if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '') {
                const hash = window.location.hash.substring(1);
                const parts = hash.split('/');
                const catFromHash = decodeURIComponent(parts[0]).replace(/-/g, ' ').trim();
                if (!/^[A-Za-z0-9]{1,4}$/.test(catFromHash)) {
                    category = catFromHash;
                }
            }

            // DOM nadpis (fallback)
            if (category === 'neznáma kategória') {
                let current = li;
                while (current && current !== document.body) {
                    if (['zoom-group-box','zoom-content','flex-grow','zoom-responsive'].some(c => current.classList.contains(c))) {
                        current = current.parentElement;
                        continue;
                    }
                    let prev = current.previousElementSibling;
                    while (prev) {
                        if (['H2','H3','H4'].includes(prev.tagName)) {
                            const txt = prev.textContent.trim();
                            if (txt && txt.length > 4 &&
                                !txt.startsWith('Základné skupiny') &&
                                !txt.startsWith('Nadstavbové skupiny') &&
                                !txt.startsWith('Skupina') &&
                                !txt.includes('Tímy bez skupiny') &&
                                !/^[A-Za-z0-9]{1,4}$/.test(txt) &&
                                !/^\d+$/.test(txt)) {
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

        // ──────────────────────────────────────────────
        // 3. Skupina + typ (prispôsobené obom štruktúram)
        // ──────────────────────────────────────────────
        const groupHeader = li.closest('.zoom-group-box')?.querySelector('h3, h4') ||
                           li.closest('.bg-white.rounded-xl')?.querySelector('h2, h3');
        if (groupHeader) group = groupHeader.textContent.trim();

        if (li.classList.contains('bg-yellow-50')) {
            type = 'SUPERSTRUCTURE / nadstavbový tím';
        } else if (li.closest('.bg-blue-100')) {
            type = 'tím v nadstavbovej skupine';
        } else if (li.closest('.bg-gray-100') || li.classList.contains('border-l-4')) {
            type = 'tím so zobrazeným ubytovaním';
        }

        // ──────────────────────────────────────────────
        // 4. Logovanie + vyhľadávanie dát
        // ──────────────────────────────────────────────
        console.groupCollapsed(`%c${teamName}`, 'color:#10b981; font-weight:bold;');
        console.log(`Text: ${visibleText}`);
        console.log(`Názov: ${teamName}`);
        console.log(`Kategória: ${category} ${categoryFromText ? '(z textu)' : '(z hash/DOM)'}`);
        console.log(`Skupina: ${group}`);
        console.log(`Typ: ${type}`);

        const teamData = await lookupTeamInFirestore(teamName, category, group);

        let tooltipText = '';

        if (teamData) {
            const playerCount     = (teamData.playerDetails          || []).length;
            const womenCount      = (teamData.womenTeamMemberDetails || []).length;
            const menCount        = (teamData.menTeamMemberDetails   || []).length;
            const driverMaleCount = (teamData.driverDetailsMale      || []).length;
            const driverFemaleCount = (teamData.driverDetailsFemale  || []).length;

            const total = playerCount + womenCount + menCount + driverMaleCount + driverFemaleCount;

            const pkg  = teamData.packageDetails?.name     || '—';
            const accom = teamData.accommodation?.type     || '—';
            const arrType = teamData.arrival?.type         || '—';
            const arrTime = teamData.arrival?.time ? ` (${teamData.arrival.time})` : '';

            const cats = teamData.category || category || 'bez kategórie';

            const lines = [];
            if (playerCount > 0)     lines.push(` • hráči: ${playerCount}`);
            if (womenCount > 0)      lines.push(` • člen RT (ženy): ${womenCount}`);
            if (menCount > 0)        lines.push(` • člen RT (muži): ${menCount}`);
            if (driverMaleCount > 0) lines.push(` • šofér (muži): ${driverMaleCount}`);
            if (driverFemaleCount > 0) lines.push(` • šofér (ženy): ${driverFemaleCount}`);

            const members = lines.length > 0 ? lines.join('\n') : ' (žiadni členovia v DB)';

            tooltipText = `${cats} → ${teamName}
Počet osôb: ${total}
${members}
Balík: ${pkg}
Ubytovanie: ${accom}
Doprava: ${arrType}${arrTime}`;
        } else {
            tooltipText = `${teamName}\n(údaje sa nenašli v databáze)`;
        }

        showTooltipUnderElement(tooltipText, li);
        console.groupEnd();
    });

    element.addEventListener('mouseout', hideTooltip);
    element.addEventListener('mouseleave', hideTooltip);
}

// ──────────────────────────────────────────────
// Tooltip (bez zmien)
// ──────────────────────────────────────────────

let customTooltip = null;

function createOrGetTooltip() { /* ... rovnaké ako pôvodne ... */ }
function showTooltipUnderElement(text, element) { /* ... rovnaké ... */ }
function hideTooltip() { /* ... rovnaké ... */ }

// ──────────────────────────────────────────────
// INICIALIZÁCIA + MUTATION OBSERVER
// ──────────────────────────────────────────────

function initTeamHoverListeners() {
    console.log("Inicializujem hover listenery...");

    // Selektory pre OBIDVE stránky
    const selectors = [
        'li span.flex-grow',                            // stará stránka
        'li span.font-medium'                           // nová React stránka
    ];

    const allSpans = document.querySelectorAll(selectors.join(', '));
    console.log(`Nájdených ${allSpans.length} kandidátov na hover`);

    allSpans.forEach(addHoverListener);

    // Mutation observer – dynamické pridávanie
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    const newCandidates = node.querySelectorAll(selectors.join(', ') + ':not([data-hover-listener-added])');
                    newCandidates.forEach(addHoverListener);
                });
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    console.log("%c[team-info] Hover bublinky aktívny – podporuje starú aj novú (React) stránku",
        "color:#10b981; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");
}

// ──────────────────────────────────────────────
// Štart + čakanie na db
// ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded → čakám na window.db...");
    let attempts = 0;
    const maxAttempts = 25;

    function waitForDb() {
        attempts++;
        if (window.db) {
            console.log("%cwindow.db OK → spúšťam listenery + inicializáciu",
                "color:#10b981; font-weight:bold; font-size:14px; background:#000; padding:6px 12px; border-radius:6px;");
            setupTeamBubblesListener();
            initTeamHoverListeners();
            return;
        }
        if (attempts >= maxAttempts) {
            console.error("%c[CHYBA] window.db sa nenačítal ani po 12,5 s", "color:#ef4444; font-weight:bold;");
            return;
        }
        setTimeout(waitForDb, 500);
    }

    waitForDb();
});

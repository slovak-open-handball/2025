// logged-in-team-info.js
console.log("%c[logged-in-team-info.js] Skript beží – čakám na Firebase", 
    "color:#8b5cf6; font-weight:bold; font-size:14px;");

// === HLAVNÁ FUNKCIA NA VYHĽADÁVANIE ===
async function lookupTeamInFirestore(teamName, category = null, group = null) {
    // Bezpečnostná kontrola – čakáme, kým je všetko pripravené
    if (!window.db || typeof window.doc !== 'function' || typeof window.getDoc !== 'function') {
        console.warn("Firebase ešte nie je pripravený (chýba window.db alebo window.doc). Skúšam neskôr...");
        return null;
    }

    console.log(`Hľadám tím "${teamName}" ...`);

    try {
        // 1. superstructureGroups
        const superstructureRef = window.doc(window.db, 'settings/superstructureGroups');
        const superstructureSnap = await window.getDoc(superstructureRef);

        if (superstructureSnap.exists()) {
            const data = superstructureSnap.data() || {};
            for (const [catKey, teams] of Object.entries(data)) {
                if (!Array.isArray(teams)) continue;
                if (category && catKey !== category) continue;

                const found = teams.find(t => 
                    t.teamName === teamName || 
                    (t.teamName && t.teamName.includes(teamName))
                );

                if (found) {
                    console.log(`→ Nájdený v superstructureGroups (${catKey})`);
                    return { source: 'superstructure', category: catKey, ...found };
                }
            }
        }

        // 2. users kolekcia
        console.log("Nie je v superstructure → prehľadávam users...");
        const usersCollection = window.collection(window.db, "users");
        const usersSnap = await window.getDocs(usersCollection);

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            if (!userData?.teams) continue;

            for (const [catKey, teamArray] of Object.entries(userData.teams || {})) {
                if (!Array.isArray(teamArray)) continue;
                if (category && catKey !== category) continue;

                const found = teamArray.find(t => 
                    t.teamName === teamName ||
                    (t.teamName && t.teamName.includes(teamName))
                );

                if (found) {
                    console.log(`→ Nájdený u používateľa ${userDoc.id} v kategórii ${catKey}`);
                    return { source: 'user', userId: userDoc.id, category: catKey, ...found };
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

// === HOVER LISTENER ===
function initTeamHoverListeners() {
    console.log("Inicializujem hover listenery...");

    const nameSpans = document.querySelectorAll('li span.flex-grow');
    console.log(`Nájdených ${nameSpans.length} spanov s triedou flex-grow`);

    if (nameSpans.length === 0) {
        console.warn("Žiadne span.flex-grow – React ešte nerenderoval.");
        return;
    }

    nameSpans.forEach(span => {
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

            const catHeader = li.closest('.flex-col')?.previousElementSibling;
            if (catHeader?.tagName === 'H3') category = catHeader.textContent.trim();

            const groupHeader = li.closest('.zoom-group-box')?.querySelector('h3, h4');
            if (groupHeader) group = groupHeader.textContent.trim();

            if (li.classList.contains('bg-yellow-50')) type = 'SUPERSTRUCTURE tím';
            else if (li.closest('.bg-blue-100')) type = 'nadstavbová skupina';
            else if (li.closest('.bg-gray-100')) type = 'základná skupina';

            console.groupCollapsed(`%c${teamName}`, 'color:#10b981; font-weight:bold;');
            console.log(`Viditeľný text:     ${visibleText}`);
            console.log(`Kategória (DOM):     ${category}`);
            console.log(`Skupina (DOM):       ${group}`);
            console.log(`Typ (podľa farby):   ${type}`);

            // Pokus o lookup
            const teamData = await lookupTeamInFirestore(teamName, category, group);

            if (teamData) {
                console.log("ÚPLNÉ DÁTA Z DATABÁZY:");
                console.dir(teamData);
            } else {
                console.warn("Tím sa nenašiel alebo Firebase nie je pripravený.");
            }

            console.groupEnd();
        });
    });

    console.log("Hover listenery priradené.");
}

// === Spustenie s čakaním na Firebase ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded → čakám na Firebase (max 10 sekúnd)...");

    let attempts = 0;
    const maxAttempts = 10;

    const tryInit = () => {
        attempts++;
        console.log(`Pokus ${attempts}/${maxAttempts}: kontrolujem Firebase...`);

        if (window.db && typeof window.doc === 'function' && typeof window.getDoc === 'function') {
            console.log("Firebase je pripravený → spúšťam listenery!");
            initTeamHoverListeners();
        } else if (attempts < maxAttempts) {
            console.log("Firebase ešte nie je pripravený, čakám 1 sekundu...");
            setTimeout(tryInit, 1000);
        } else {
            console.error("Firebase sa nenačítal ani po 10 sekundách. Skontroluj authentication.js");
        }
    };

    setTimeout(tryInit, 1500); // prvý pokus po 1.5 s
});

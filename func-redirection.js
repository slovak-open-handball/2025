// func-redirection.js
// ============================================================
// Načíta všetky tímy z kolekcie 'users' a vypíše ich do konzoly
// ako klikateľné odkazy: teams#category=<KATEGÓRIA>&team=<TÍM>
// + Nastaví každý výskyt názvu tímu na stránke ako klikateľný odkaz
//   s korektnou kategóriou podľa kontextu (teams.js, matches.js, tables.js)
//   Vzhľad zostáva PÔVODNÝ (žiadna modrá, žiadne podčiarknutie)
// ============================================================

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ------------------------------------------------------------
// Čakanie na window.db
// ------------------------------------------------------------
const waitForDb = (timeoutMs = 15000, intervalMs = 200) => {
    return new Promise((resolve, reject) => {
        if (window.db) { resolve(window.db); return; }
        const startTime = Date.now();
        const onDbInitialized = () => {
            if (window.db) { cleanup(); resolve(window.db); }
        };
        const cleanup = () => {
            window.removeEventListener("dbInitialized", onDbInitialized);
            clearInterval(intervalId);
            clearTimeout(timeoutId);
        };
        window.addEventListener("dbInitialized", onDbInitialized);
        const intervalId = setInterval(() => {
            if (window.db) { cleanup(); resolve(window.db); return; }
            if (Date.now() - startTime > timeoutMs) {
                cleanup();
                reject(new Error("Timeout: window.db nebola inicializovaná do " + timeoutMs + " ms."));
            }
        }, intervalMs);
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error("Timeout: window.db nebola inicializovaná do " + timeoutMs + " ms."));
        }, timeoutMs);
    });
};

// ------------------------------------------------------------
// slugify pre URL
// ------------------------------------------------------------
const slugify = (text) => {
    if (!text) return "";

    // 1) Nahradíme " - " (medzera-pomlčka-medzera) za dočasný marker.
    //    Tento marker prežije ostatné nahradenia a na konci ho
    //    preložíme na "---".
    const DASH_MARKER = "___DASH_SEP___";
    let s = String(text).trim().replace(/\s+-\s+/g, DASH_MARKER);

    // 2) Štandardné spracovanie: medzery → pomlčky, odstránenie
    //    nebezpečných znakov, zlúčenie viacerých pomlčiek.
    s = s
        .replace(/\s+/g, "-")
        .replace(/[^\w\-áäčďéíĺľňóôŕšťúůýžÁÄČĎÉĹĽŇÓÔŔŠŤÚŮÝŽ]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");

    // 3) Marker preložíme na "---"
    s = s.split(DASH_MARKER).join("---");

    return s;
};

// ------------------------------------------------------------
// URL odkazu pre tím
// ------------------------------------------------------------
const buildTeamUrl = (categoryName, teamName) => {
    const categorySlug = slugify(categoryName);
    const teamSlug = slugify(teamName);
    return `teams#category=${categorySlug}&team=${teamSlug}`;
};

// ------------------------------------------------------------
// Globálne dáta
// ------------------------------------------------------------
let allTeamsFlat = [];
let teamNameToCategoriesMap = new Map();
let knownCategoryNames = [];
// Mapa: akýkoľvek variant názvu (pôvodný aj namapovaný) -> kategórie
let variantNameToCategoriesMap = new Map();

// ------------------------------------------------------------
// Rozpoznanie kategórie v texte
// ------------------------------------------------------------
const textContainsKnownCategory = (text) => {
    if (!text) return null;
    const trimmed = String(text).trim();
    if (!trimmed) return null;
    if (knownCategoryNames.includes(trimmed)) return trimmed;
    const sorted = [...knownCategoryNames].sort((a, b) => b.length - a.length);
    for (const cat of sorted) {
        if (trimmed.includes(cat)) return cat;
    }
    return null;
};

// ------------------------------------------------------------
// Detekcia kategórie z window.matchesData podľa názvu tímu
// (matches.js má často namapované názvy, ktoré nie sú v users)
// ------------------------------------------------------------
const findCategoryFromMatchesData = (teamNameText, contextElement) => {
    if (!teamNameText) return null;
    try {
        const matchesData = window.matchesData || window.allMatches || [];
        if (!Array.isArray(matchesData) || matchesData.length === 0) return null;

        // Skús nájsť element s atribútom data-match-id alebo closest tr s id
        let matchId = null;
        let current = contextElement;
        while (current && current !== document.body) {
            if (current.dataset && current.dataset.matchId) {
                matchId = current.dataset.matchId;
                break;
            }
            current = current.parentNode;
        }

        // 1) Ak máme matchId, nájdi zápas a v ňom kategóriu
        if (matchId) {
            const found = matchesData.find(m => m.id === matchId);
            if (found) {
                const cat = found.categoryName ||
                    (found.categoryId && window.categoriesData ? window.categoriesData[found.categoryId] : null);
                if (cat) {
                    const verified = textContainsKnownCategory(cat);
                    if (verified) return verified;
                    return cat;
                }
            }
        }

        // 2) Inak skús nájsť zápas, v ktorom sa tím vyskytuje
        const trimmed = String(teamNameText).trim();
        for (const m of matchesData) {
            const home = m.homeTeamName || m.homeTeamIdentifier || '';
            const away = m.awayTeamName || m.awayTeamIdentifier || '';
            if (home === trimmed || away === trimmed) {
                const cat = m.categoryName ||
                    (m.categoryId && window.categoriesData ? window.categoriesData[m.categoryId] : null);
                if (cat) {
                    const verified = textContainsKnownCategory(cat);
                    if (verified) return verified;
                    return cat;
                }
            }
        }
    } catch (e) {}
    return null;
};

// ------------------------------------------------------------
// 1) Kontext z nadpisu (h1–h4) v predkoch
// ------------------------------------------------------------
const findCategoryFromHeadings = (element, rootElement) => {
    let current = element;
    while (current && current !== rootElement) {
        const tag = current.nodeName?.toUpperCase();
        if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4") {
            const found = textContainsKnownCategory(current.textContent);
            if (found) return found;
        }
        if (current.querySelector) {
            const heading = current.querySelector("h1, h2, h3, h4");
            if (heading) {
                const found = textContainsKnownCategory(heading.textContent);
                if (found) return found;
            }
        }
        current = current.parentNode;
    }
    return null;
};

// ------------------------------------------------------------
// 2) Kontext z riadku tabuľky <tr>
// ------------------------------------------------------------
const findCategoryFromTableRow = (element, rootElement) => {
    let current = element;
    while (current && current !== rootElement) {
        if (current.nodeName?.toUpperCase() === "TR") {
            const cells = current.querySelectorAll("td, th");
            for (const cell of cells) {
                const found = textContainsKnownCategory(cell.textContent);
                if (found) return found;
            }
            return null;
        }
        current = current.parentNode;
    }
    return null;
};

// ------------------------------------------------------------
// 3) Kontext z hlavičky skupinovej tabuľky (tables.js)
// ------------------------------------------------------------
const findCategoryFromGroupTableHeader = (element, rootElement) => {
    let current = element;
    while (current && current !== rootElement) {
        const cls = current.className || "";
        if (typeof cls === "string" && /rounded-(xl|lg)/.test(cls) && /(shadow|border)/.test(cls)) {
            const header = current.querySelector(".px-6.py-4.border-b");
            if (header) {
                const h3 = header.querySelector("h3");
                if (h3) {
                    const text = (h3.textContent || "").trim();
                    const direct = textContainsKnownCategory(text);
                    if (direct) return direct;
                    const parts = text.split(/\s+-\s+/);
                    for (const part of parts) {
                        const found = textContainsKnownCategory(part);
                        if (found) return found;
                    }
                }
            }
            const heading = current.querySelector("h1, h2, h3, h4");
            if (heading) {
                const text = (heading.textContent || "").trim();
                const direct = textContainsKnownCategory(text);
                if (direct) return direct;
                const parts = text.split(/\s+-\s+/);
                for (const part of parts) {
                    const found = textContainsKnownCategory(part);
                    if (found) return found;
                }
            }
            return null;
        }
        current = current.parentNode;
    }
    return null;
};

// ------------------------------------------------------------
// 4) Kontext z URL hash filtra (tables.js)
// ------------------------------------------------------------
const decodeFromURL = (text) => {
    if (!text) return '';
    try { return decodeURIComponent(text).replace(/-/g, ' '); }
    catch (e) { return text.replace(/-/g, ' '); }
};

const findCategoryFromUrlHash = () => {
    try {
        const hash = window.location.hash;
        if (!hash || hash === '#') return null;
        // matches.js používa #match/..., tables.js #category=...
        if (hash.startsWith('#match/')) return null;
        const params = new URLSearchParams(hash.substring(1));
        const category = params.get('category');
        if (category) {
            const decoded = decodeFromURL(category);
            const found = textContainsKnownCategory(decoded);
            if (found) return found;
            const found2 = textContainsKnownCategory(category);
            if (found2) return found2;
            return decoded;
        }
    } catch (e) {}
    return null;
};

// ------------------------------------------------------------
// 5) Kontext z aktívneho tlačidla filtra kategórií (tables.js)
// ------------------------------------------------------------
const findCategoryFromActiveFilterButton = () => {
    try {
        const filterContainer = document.querySelector('.mb-6.space-y-3');
        if (!filterContainer) return null;
        const buttons = filterContainer.querySelectorAll('button');
        for (const btn of buttons) {
            const cls = btn.className || '';
            if (typeof cls === 'string' && cls.includes('text-white') && cls.includes('shadow-md')) {
                const text = (btn.textContent || '').trim();
                if (text === 'Všetky kategórie' || text.includes('Playoff')) continue;
                const found = textContainsKnownCategory(text);
                if (found) return found;
            }
        }
    } catch (e) {}
    return null;
};

// ------------------------------------------------------------
// 6) Kontext z gradient boxu – detail zápasu (matches.js)
// Hľadá kategóriu v NADRADENOM boxe s hlavičkou .bg-gray-50
// (v matches.js je kategória v badge v hlavičke boxu, nie
//  v gradient boxe samotnom).
// ------------------------------------------------------------
const findCategoryFromGradientBox = (element, rootElement) => {
    let current = element;
    while (current && current !== rootElement) {
        const cls = current.className || "";
        if (typeof cls === "string" && /bg-gradient-to-r/.test(cls)) {
            // Hľadaj kategóriu v NADRADENOM boxe (rodič gradient boxu)
            let parent = current.parentNode;
            let safety = 0;
            while (parent && parent !== rootElement && safety < 5) {
                const parentCls = parent.className || "";
                if (typeof parentCls === "string" && /rounded-(xl|lg)/.test(parentCls)) {
                    // Hľadaj badge s kategóriou v hlavičke
                    const header = parent.querySelector(".bg-gray-50");
                    if (header) {
                        const found = textContainsKnownCategory(header.textContent);
                        if (found) return found;
                    }
                    const found = textContainsKnownCategory(parent.textContent);
                    if (found) return found;
                }
                parent = parent.parentNode;
                safety++;
            }
            // Fallback: priamo v gradient boxe
            const found = textContainsKnownCategory(current.textContent);
            if (found) return found;
        }
        current = current.parentNode;
    }
    return null;
};

// ------------------------------------------------------------
// 7) Kontext z boxu (rounded + shadow/border) – fallback
// ------------------------------------------------------------
const findCategoryFromBox = (element, rootElement) => {
    let current = element;
    while (current && current !== rootElement) {
        const cls = current.className || "";
        if (typeof cls === "string" && /rounded-(xl|lg)/.test(cls) && /(shadow|border)/.test(cls)) {
            // 1) Hlavička .bg-gray-50
            const header = current.querySelector(".bg-gray-50");
            if (header) {
                const found = textContainsKnownCategory(header.textContent);
                if (found) return found;
            }
            // 2) Akýkoľvek nadpis
            const heading = current.querySelector("h1, h2, h3, h4");
            if (heading) {
                const found = textContainsKnownCategory(heading.textContent);
                if (found) return found;
            }
            // 3) Celý text boxu
            const found = textContainsKnownCategory(current.textContent);
            if (found) return found;
            return null;
        }
        current = current.parentNode;
    }
    return null;
};

// ------------------------------------------------------------
// 8) Kontext z boxu VYŠŠIE v štruktúre – pre detail zápasu
// Keď aktuálny box (napr. TeamMembersList so súpiskou) nemá
// kategóriu, hľadáme v predchádzajúcich súrodencoch predkov
// (napr. box s info o zápase, ktorý je nad súpiskami).
// ------------------------------------------------------------
const findCategoryFromUpperBox = (element, rootElement) => {
    let current = element;
    let safety = 0;
    while (current && current !== rootElement && safety < 15) {
        // Prejdi predchádzajúcich súrodencov aktuálneho elementu
        let sibling = current.previousElementSibling;
        let siblingSafety = 0;
        while (sibling && siblingSafety < 20) {
            // Skús nájsť kategóriu v tomto súrodencovi (boxe)
            const cls = sibling.className || "";
            if (typeof cls === "string" && /rounded-(xl|lg)/.test(cls)) {
                // Hlavička .bg-gray-50
                const header = sibling.querySelector(".bg-gray-50");
                if (header) {
                    const found = textContainsKnownCategory(header.textContent);
                    if (found) return found;
                }
                // Akýkoľvek nadpis
                const heading = sibling.querySelector("h1, h2, h3, h4");
                if (heading) {
                    const found = textContainsKnownCategory(heading.textContent);
                    if (found) return found;
                }
                // Celý text boxu
                const found = textContainsKnownCategory(sibling.textContent);
                if (found) return found;
            }
            sibling = sibling.previousElementSibling;
            siblingSafety++;
        }
        current = current.parentNode;
        safety++;
    }
    return null;
};

// ------------------------------------------------------------
// Zlúčená funkcia: nájde kontextovú kategóriu pre element
// ------------------------------------------------------------
const findCategoryContextForElement = (element, rootElement, teamNameText) => {
    if (!element) return null;

    let cat = findCategoryFromHeadings(element, rootElement);
    if (cat) return cat;

    cat = findCategoryFromTableRow(element, rootElement);
    if (cat) return cat;

    cat = findCategoryFromGroupTableHeader(element, rootElement);
    if (cat) return cat;

    cat = findCategoryFromUrlHash();
    if (cat) return cat;

    cat = findCategoryFromActiveFilterButton();
    if (cat) return cat;

    cat = findCategoryFromGradientBox(element, rootElement);
    if (cat) return cat;

    // 🔥 NOVÉ: box vyššie v štruktúre (detail zápasu – súpisky)
    cat = findCategoryFromUpperBox(element, rootElement);
    if (cat) return cat;

    cat = findCategoryFromBox(element, rootElement);
    if (cat) return cat;

    // fallback cez window.matchesData
    cat = findCategoryFromMatchesData(teamNameText, element);
    if (cat) return cat;

    return null;
};

// ------------------------------------------------------------
// URL pre tím podľa kontextu
// Používa variantNameToCategoriesMap – obsahuje aj namapované názvy
// ------------------------------------------------------------
const getTeamUrlForContext = (teamName, contextCategory) => {
    if (contextCategory) {
        const cats = variantNameToCategoriesMap.get(teamName);
        if (cats && cats.has(contextCategory)) {
            return buildTeamUrl(contextCategory, teamName);
        }
    }
    const cats = variantNameToCategoriesMap.get(teamName);
    if (cats && cats.size > 0) {
        const firstCat = cats.values().next().value;
        return buildTeamUrl(firstCat, teamName);
    }
    // Skús aj pôvodnú mapu
    const originalCats = teamNameToCategoriesMap.get(teamName);
    if (originalCats && originalCats.size > 0) {
        const firstCat = originalCats.values().next().value;
        return buildTeamUrl(firstCat, teamName);
    }
    return buildTeamUrl("", teamName);
};

// ------------------------------------------------------------
// Linkifikácia DOM
// ------------------------------------------------------------
const makeTeamNamesClickable = () => {
    if (!allTeamsFlat.length) return;

    // Zoznam všetkých variantov názvov (pôvodné + namapované)
    const allVariants = new Set();
    allTeamsFlat.forEach(t => allVariants.add(t.teamName));
    variantNameToCategoriesMap.forEach((cats, name) => allVariants.add(name));

    const variantsSorted = [...allVariants].sort((a, b) => b.length - a.length);
    const escapedNames = variantsSorted.map(t =>
        t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    if (escapedNames.length === 0) return;

    const teamNameRegex = new RegExp(`(${escapedNames.join("|")})`, "g");

    const rootElement = document.getElementById("root") || document.body;

    const walker = document.createTreeWalker(
        rootElement,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                if (!node.nodeValue || !node.nodeValue.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Preskoč texty, ktoré už sú v <a> alebo v nebezpečných tagoch
                let parent = node.parentNode;
                while (parent && parent !== rootElement) {
                    const tag = parent.nodeName?.toUpperCase();
                    if (tag === "A" || tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "INPUT") {
                        return NodeFilter.FILTER_REJECT;
                    }
                    parent = parent.parentNode;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    textNodes.forEach((textNode) => {
        const text = textNode.nodeValue;
        if (!text) return;
        teamNameRegex.lastIndex = 0;
        if (!teamNameRegex.test(text)) return;
        teamNameRegex.lastIndex = 0;

        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = teamNameRegex.exec(text)) !== null) {
            const matchedName = match[0];
            const matchIndex = match.index;

            if (matchIndex > lastIndex) {
                parts.push({ type: "text", value: text.slice(lastIndex, matchIndex) });
            }

            // Kontextová kategória sa počíta pre každý nájdený tím samostatne
            const contextCategory = findCategoryContextForElement(
                textNode.parentNode,
                rootElement,
                matchedName
            );
            const url = getTeamUrlForContext(matchedName, contextCategory);
            parts.push({ type: "link", value: matchedName, url });

            lastIndex = matchIndex + matchedName.length;
        }

        if (lastIndex < text.length) {
            parts.push({ type: "text", value: text.slice(lastIndex) });
        }

        if (parts.length === 0) return;

        const fragment = document.createDocumentFragment();
        parts.forEach(part => {
            if (part.type === "link") {
                const a = document.createElement("a");
                a.href = part.url;
                a.textContent = part.value;
                a.style.color = "inherit";
                a.style.textDecoration = "none";
                a.style.font = "inherit";
                a.style.cursor = "pointer";
                // 🔥 Označíme LEN <a>, nie rodiča – inak by sme zablokovali
                // ďalšie textové uzly v tom istom rodičovi (napr. druhý tím v <td>)
                a.dataset.teamLinkified = "1";
                fragment.appendChild(a);
            } else {
                fragment.appendChild(document.createTextNode(part.value));
            }
        });

        const parent = textNode.parentNode;
        if (parent) {
            parent.replaceChild(fragment, textNode);
        }
    });
};

// ------------------------------------------------------------
// Pomocná funkcia: vytvorí varianty názvov cez matchTracker/teamManager
// (matches.js zobrazuje namapované názvy, ktoré nie sú v users)
// ------------------------------------------------------------
const buildVariantNameMap = async () => {
    variantNameToCategoriesMap = new Map();

    // Najprv naplníme pôvodné názvy
    teamNameToCategoriesMap.forEach((cats, name) => {
        if (!variantNameToCategoriesMap.has(name)) {
            variantNameToCategoriesMap.set(name, new Set());
        }
        cats.forEach(c => variantNameToCategoriesMap.get(name).add(c));
    });

    // Skúsime namapovať každý názov cez matchTracker
    const tryMap = async (name, categoryName) => {
        try {
            if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                const mapped = await window.matchTracker.getTeamNameByDisplayId(name);
                if (mapped && mapped !== name && mapped !== 'null' && mapped !== 'undefined') {
                    if (!variantNameToCategoriesMap.has(mapped)) {
                        variantNameToCategoriesMap.set(mapped, new Set());
                    }
                    variantNameToCategoriesMap.get(mapped).add(categoryName);
                }
            }
        } catch (e) {}
        try {
            if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                const mapped = window.teamManager.getTeamNameByDisplayIdSync(name);
                if (mapped && mapped !== name) {
                    if (!variantNameToCategoriesMap.has(mapped)) {
                        variantNameToCategoriesMap.set(mapped, new Set());
                    }
                    variantNameToCategoriesMap.get(mapped).add(categoryName);
                }
            }
        } catch (e) {}
    };

    const promises = [];
    teamNameToCategoriesMap.forEach((cats, name) => {
        cats.forEach(cat => {
            promises.push(tryMap(name, cat));
        });
    });
    await Promise.all(promises);

    // Skúsime aj opačný smer – ak matchTracker obsahuje mapovanie
    // pre názov, ktorý je v DOM, ale nie je v users
    // (napr. matches.js zobrazuje "HC Pezinok", ale v users je "U12 CH HC Pezinok")
    try {
        if (window.teamNames && typeof window.teamNames === 'object') {
            Object.entries(window.teamNames).forEach(([key, val]) => {
                if (!val || typeof val !== 'string') return;
                const cats = teamNameToCategoriesMap.get(key) || teamNameToCategoriesMap.get(val);
                if (cats) {
                    if (!variantNameToCategoriesMap.has(val)) {
                        variantNameToCategoriesMap.set(val, new Set());
                    }
                    cats.forEach(c => variantNameToCategoriesMap.get(val).add(c));
                }
            });
        }
    } catch (e) {}
};

// ------------------------------------------------------------
// Hlavná funkcia
// ------------------------------------------------------------
export const loadAllTeamsFromUsers = async () => {
    console.log("============================================================");
    console.log("⏳ ČAKÁM NA INICIALIZÁCIU window.db...");
    console.log("============================================================");

    let db;
    try {
        db = await waitForDb();
    } catch (err) {
        console.error("❌ " + err.message);
        return null;
    }

    console.log("✅ window.db je dostupná, načítavam tímy z kolekcie 'users'...");
    console.log("");

    try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);

        if (snapshot.empty) {
            console.warn("⚠️ Kolekcia 'users' je prázdna.");
            return [];
        }

        const teamsByCategory = {};
        let totalTeams = 0;
        let totalUsers = 0;

        snapshot.forEach((userDoc) => {
            const userData = userDoc.data() || {};
            const uid = userDoc.id;
            const email = userData.email || "(bez e-mailu)";
            const teams = userData.teams;
            if (!teams || typeof teams !== "object") return;
            totalUsers++;
            Object.entries(teams).forEach(([categoryName, teamArray]) => {
                if (!Array.isArray(teamArray)) return;
                if (!teamsByCategory[categoryName]) teamsByCategory[categoryName] = [];
                teamArray.forEach((team) => {
                    if (!team || !team.teamName) return;
                    teamsByCategory[categoryName].push({
                        teamName: team.teamName,
                        uid: uid,
                        email: email,
                        groupName: team.groupName || null,
                        order: team.order ?? null,
                        teamId: team.id || null,
                    });
                    totalTeams++;
                });
            });
        });

        console.log("");
        console.log("============================================================");
        console.log(`✅ NAČÍTANÝCH ${totalTeams} TÍMOV od ${totalUsers} POUŽÍVATEĽOV`);
        console.log("============================================================");

        const sortedCategories = Object.keys(teamsByCategory).sort((a, b) =>
            a.localeCompare(b, "sk")
        );

        sortedCategories.forEach((categoryName) => {
            const teams = teamsByCategory[categoryName];
            console.log("");
            console.log(`📁 KATEGÓRIA: ${categoryName} (${teams.length} tímov)`);
            console.log("------------------------------------------------------------");
            const sortedTeams = [...teams].sort((a, b) => {
                const ga = a.groupName || "zzz";
                const gb = b.groupName || "zzz";
                if (ga !== gb) return ga.localeCompare(gb, "sk");
                const oa = a.order ?? Infinity;
                const ob = b.order ?? Infinity;
                if (oa !== ob) return oa - ob;
                return a.teamName.localeCompare(b.teamName, "sk");
            });
            sortedTeams.forEach((team, index) => {
                const group = team.groupName ? `[${team.groupName}]` : "[bez skupiny]";
                const order = team.order != null ? `${team.order}.` : "–";
                const url = buildTeamUrl(categoryName, team.teamName);
                console.log(`   ${String(index + 1).padStart(3, " ")}. ${group} ${order} ${team.teamName}\n       🔗 ${url}`);
            });
        });

        const flatList = [];
        sortedCategories.forEach((categoryName) => {
            teamsByCategory[categoryName].forEach((team) => {
                flatList.push({
                    category: categoryName,
                    group: team.groupName || "",
                    order: team.order ?? "",
                    teamName: team.teamName,
                    url: buildTeamUrl(categoryName, team.teamName),
                });
            });
        });

        // Príprava máp
        allTeamsFlat = [];
        teamNameToCategoriesMap = new Map();
        knownCategoryNames = [...sortedCategories];

        sortedCategories.forEach((categoryName) => {
            teamsByCategory[categoryName].forEach((team) => {
                allTeamsFlat.push({
                    teamName: team.teamName,
                    categoryName: categoryName,
                    url: buildTeamUrl(categoryName, team.teamName),
                });
                if (!teamNameToCategoriesMap.has(team.teamName)) {
                    teamNameToCategoriesMap.set(team.teamName, new Set());
                }
                teamNameToCategoriesMap.get(team.teamName).add(categoryName);
            });
        });

        // Vytvor variantnú mapu (namapované názvy)
        await buildVariantNameMap();

        // Linkifikácia
        const runLinkification = () => {
            try { makeTeamNamesClickable(); }
            catch (e) { console.warn("⚠️ Linkifikácia DOM zlyhala:", e); }
        };

        runLinkification();
        setTimeout(runLinkification, 500);
        setTimeout(runLinkification, 1500);
        setTimeout(runLinkification, 3000);
        setTimeout(runLinkification, 5000);

        if (window.MutationObserver) {
            const observer = new MutationObserver(() => {
                clearTimeout(window.__teamLinkifyTimer);
                window.__teamLinkifyTimer = setTimeout(runLinkification, 300);
            });
            const rootElement = document.getElementById("root") || document.body;
            observer.observe(rootElement, {
                childList: true,
                subtree: true,
                characterData: true,
            });
            window.__teamLinkifyObserver = observer;
        }

        // Sledujeme zmeny hash (prepínanie filtra v tables.js, detail zápasu v matches.js)
        window.addEventListener('hashchange', () => {
            clearTimeout(window.__teamLinkifyHashTimer);
            window.__teamLinkifyHashTimer = setTimeout(runLinkification, 300);
        });

        return { teamsByCategory, flatList, totalTeams, totalUsers };
    } catch (error) {
        console.error("❌ Chyba pri načítavaní tímov:", error);
        return null;
    }
};

// ------------------------------------------------------------
// Automatické spustenie
// ------------------------------------------------------------
if (typeof window !== "undefined") {
    window.loadAllTeamsFromUsers = loadAllTeamsFromUsers;
    window.buildTeamUrl = buildTeamUrl;
    window.slugify = slugify;
    window.makeTeamNamesClickable = makeTeamNamesClickable;
    window.buildVariantNameMap = buildVariantNameMap;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            loadAllTeamsFromUsers();
        });
    } else {
        loadAllTeamsFromUsers();
    }
}

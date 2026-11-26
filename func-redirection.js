// func-redirection.js
// ============================================================
// Načíta všetky tímy z kolekcie 'users' a vypíše ich do konzoly
// ako klikateľné odkazy: teams#category=<KATEGÓRIA>&team=<TÍM>
// + Nastaví každý výskyt názvu tímu na stránke ako klikateľný odkaz
//   s korektnou kategóriou podľa kontextu:
//     - teams.js: nadpis kategórie v boxe
//     - matches.js: riadok tabuľky zápasov (kategória v inom stĺpci)
//     - matches.js detail: gradient box + boxy súpisiek
//     - tables.js: skupinová tabuľka (kategória v hlavičke skupiny)
//     - tables.js: riadok zápasu (kategória z hlavičky skupiny / URL / filtra)
//     - tables.js: playoff boxy (kategória z URL / aktívneho tlačidla filtra)
//   Vzhľad zostáva PÔVODNÝ (žiadna modrá, žiadne podčiarknutie)
// Čaká na inicializáciu window.db (z authentication.js)
// ============================================================

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ------------------------------------------------------------
// Čakanie na window.db
// ------------------------------------------------------------
const waitForDb = (timeoutMs = 15000, intervalMs = 200) => {
    return new Promise((resolve, reject) => {
        if (window.db) {
            resolve(window.db);
            return;
        }

        const startTime = Date.now();

        const onDbInitialized = () => {
            if (window.db) {
                cleanup();
                resolve(window.db);
            }
        };

        const cleanup = () => {
            window.removeEventListener("dbInitialized", onDbInitialized);
            clearInterval(intervalId);
            clearTimeout(timeoutId);
        };

        window.addEventListener("dbInitialized", onDbInitialized);

        const intervalId = setInterval(() => {
            if (window.db) {
                cleanup();
                resolve(window.db);
                return;
            }
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
    return String(text)
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-áäčďéíĺľňóôŕšťúůýžÁÄČĎÉĹĽŇÓÔŔŠŤÚŮÝŽ]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
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
// 1) Kontext z nadpisu (h1–h4) v predkoch – pre teams.js,
//    skupinové tabuľky (h3 v hlavičke skupiny) a pod.
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
// 2) Kontext z riadku tabuľky <tr> – pre matches.js zoznam zápasov
// Hľadá v bunkách <td>/<th> toho istého riadku text, ktorý
// zodpovedá niektorej kategórii. (V tables.js kategória v riadku
// nie je, takže to vráti null a pokračuje sa ďalej.)
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
// 3) Kontext z hlavičky skupinovej tabuľky v tables.js
// Hľadá element s triedou 'px-6 py-4 border-b' (hlavička skupiny)
// v najbližšom boxe 'rounded-xl shadow-lg' a v ňom h3 s názvom
// kategórie v tvare "KATEGÓRIA - SKUPINA".
// ------------------------------------------------------------
const findCategoryFromGroupTableHeader = (element, rootElement) => {
    let current = element;
    while (current && current !== rootElement) {
        const cls = current.className || "";
        if (
            typeof cls === "string" &&
            /rounded-(xl|lg)/.test(cls) &&
            /(shadow|border)/.test(cls)
        ) {
            // Hlavička skupiny má 'px-6 py-4 border-b' + farebné pozadie
            const header = current.querySelector(".px-6.py-4.border-b");
            if (header) {
                const h3 = header.querySelector("h3");
                if (h3) {
                    const text = (h3.textContent || "").trim();
                    // Formát: "KATEGÓRIA - SKUPINA" → skúsime celý text aj
                    // jednotlivé časti
                    const direct = textContainsKnownCategory(text);
                    if (direct) return direct;
                    // Skús rozdeliť podľa " - "
                    const parts = text.split(/\s+-\s+/);
                    for (const part of parts) {
                        const found = textContainsKnownCategory(part);
                        if (found) return found;
                    }
                }
            }
            // Skús aj akýkoľvek nadpis v boxe
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
// Hash formát: #category=<slug>&group=<slug>&view=<slug>
// ------------------------------------------------------------
const decodeFromURL = (text) => {
    if (!text) return '';
    try {
        return decodeURIComponent(text).replace(/-/g, ' ');
    } catch (e) {
        return text.replace(/-/g, ' ');
    }
};

const findCategoryFromUrlHash = () => {
    try {
        const hash = window.location.hash;
        if (!hash || hash === '#') return null;
        const params = new URLSearchParams(hash.substring(1));
        const category = params.get('category');
        if (category) {
            const decoded = decodeFromURL(category);
            const found = textContainsKnownCategory(decoded);
            if (found) return found;
            // Skús aj priamo (bez dekódovania)
            const found2 = textContainsKnownCategory(category);
            if (found2) return found2;
            return decoded;
        }
    } catch (e) {}
    return null;
};

// ------------------------------------------------------------
// 5) Kontext z aktívneho tlačidla filtra kategórií (tables.js)
// Aktívne tlačidlo má triedy 'text-white shadow-md' a inline
// backgroundColor. Nájde ho v najbližšom spoločnom rodičovi
// (kontajner filtrov 'mb-6 space-y-3').
// ------------------------------------------------------------
const findCategoryFromActiveFilterButton = () => {
    try {
        // Nájdi kontajner filtrov
        const filterContainer = document.querySelector('.mb-6.space-y-3');
        if (!filterContainer) return null;
        // Nájdi aktívne tlačidlo (text-white + shadow-md)
        const buttons = filterContainer.querySelectorAll('button');
        for (const btn of buttons) {
            const cls = btn.className || '';
            if (
                typeof cls === 'string' &&
                cls.includes('text-white') &&
                cls.includes('shadow-md')
            ) {
                const text = (btn.textContent || '').trim();
                // Preskoč tlačidlo "Playoff" a "Všetky kategórie"
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
// ------------------------------------------------------------
const findCategoryFromGradientBox = (element, rootElement) => {
    let current = element;
    while (current && current !== rootElement) {
        const cls = current.className || "";
        if (typeof cls === "string" && /bg-gradient-to-r/.test(cls)) {
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
        if (
            typeof cls === "string" &&
            /rounded-(xl|lg)/.test(cls) &&
            /(shadow|border)/.test(cls)
        ) {
            const header = current.querySelector(".bg-gray-50");
            if (header) {
                const found = textContainsKnownCategory(header.textContent);
                if (found) return found;
            }
            const heading = current.querySelector("h1, h2, h3, h4");
            if (heading) {
                const found = textContainsKnownCategory(heading.textContent);
                if (found) return found;
            }
            const found = textContainsKnownCategory(current.textContent);
            if (found) return found;
            return null;
        }
        current = current.parentNode;
    }
    return null;
};

// ------------------------------------------------------------
// Zlúčená funkcia: nájde kontextovú kategóriu pre element
// Poradie stratégií podľa špecifickosti:
//   1. Nadpisy (teams.js, hlavičky skupín)
//   2. Riadok tabuľky (matches.js zoznam zápasov)
//   3. Hlavička skupinovej tabuľky (tables.js)
//   4. URL hash filter (tables.js)
//   5. Aktívne tlačidlo filtra (tables.js – playoff boxy)
//   6. Gradient box (matches.js detail)
//   7. Box (rounded + shadow) – fallback
// ------------------------------------------------------------
const findCategoryContextForElement = (element, rootElement) => {
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

    cat = findCategoryFromBox(element, rootElement);
    if (cat) return cat;

    return null;
};

// ------------------------------------------------------------
// URL pre tím podľa kontextu
// ------------------------------------------------------------
const getTeamUrlForContext = (teamName, contextCategory) => {
    if (contextCategory) {
        const categoriesForTeam = teamNameToCategoriesMap.get(teamName);
        if (categoriesForTeam && categoriesForTeam.has(contextCategory)) {
            return buildTeamUrl(contextCategory, teamName);
        }
    }
    const categoriesForTeam = teamNameToCategoriesMap.get(teamName);
    if (categoriesForTeam && categoriesForTeam.size > 0) {
        const firstCat = categoriesForTeam.values().next().value;
        return buildTeamUrl(firstCat, teamName);
    }
    return buildTeamUrl("", teamName);
};

// ------------------------------------------------------------
// Linkifikácia DOM
// ------------------------------------------------------------
const makeTeamNamesClickable = () => {
    if (!allTeamsFlat.length) return;

    const teamsSorted = [...allTeamsFlat].sort(
        (a, b) => b.teamName.length - a.teamName.length
    );

    const escapedNames = teamsSorted.map(t =>
        t.teamName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
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
                let parent = node.parentNode;
                while (parent && parent !== rootElement) {
                    const tag = parent.nodeName?.toUpperCase();
                    if (tag === "A" || tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "INPUT") {
                        return NodeFilter.FILTER_REJECT;
                    }
                    parent = parent.parentNode;
                }
                if (node.parentNode && node.parentNode.dataset && node.parentNode.dataset.teamLinkified === "1") {
                    return NodeFilter.FILTER_REJECT;
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
        if (!teamNameRegex.test(text)) {
            teamNameRegex.lastIndex = 0;
            return;
        }
        teamNameRegex.lastIndex = 0;

        const contextCategory = findCategoryContextForElement(textNode.parentNode, rootElement);

        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = teamNameRegex.exec(text)) !== null) {
            const matchedName = match[0];
            const matchIndex = match.index;

            if (matchIndex > lastIndex) {
                parts.push({ type: "text", value: text.slice(lastIndex, matchIndex) });
            }

            const url = getTeamUrlForContext(matchedName, contextCategory);
            parts.push({ type: "link", value: matchedName, url });

            lastIndex = matchIndex + matchedName.length;
        }

        if (lastIndex < text.length) {
            parts.push({ type: "text", value: text.slice(lastIndex) });
        }

        if (parts.length <= 1) return;

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
                a.dataset.teamLinkified = "1";
                fragment.appendChild(a);
            } else {
                fragment.appendChild(document.createTextNode(part.value));
            }
        });

        const parent = textNode.parentNode;
        if (parent) {
            parent.dataset.teamLinkified = "1";
            parent.replaceChild(fragment, textNode);
        }
    });
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
        console.error("   Uisti sa, že authentication.js bol načítaný pred func-redirection.js.");
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

                if (!teamsByCategory[categoryName]) {
                    teamsByCategory[categoryName] = [];
                }

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

                console.log(
                    `   ${String(index + 1).padStart(3, " ")}. ${group} ${order} ${team.teamName}\n       🔗 ${url}`
                );
            });
        });

        console.log("");
        console.log("============================================================");
        console.log("📋 PLOCHÝ ZOZNAM VŠETKÝCH TÍMOV S ODKAZMI");
        console.log("============================================================");

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

        console.table(flatList);

        console.log("");
        console.log("============================================================");
        console.log("🔗 HTML ZOZNAM KLIKATEĽNÝCH ODKAZOV (skopíruj do stránky)");
        console.log("============================================================");

        let htmlOutput = "";
        sortedCategories.forEach((categoryName) => {
            htmlOutput += `\n<h3>${categoryName}</h3>\n<ul>\n`;
            const sortedTeams = [...teamsByCategory[categoryName]].sort((a, b) =>
                a.teamName.localeCompare(b.teamName, "sk")
            );
            sortedTeams.forEach((team) => {
                const url = buildTeamUrl(categoryName, team.teamName);
                htmlOutput += `  <li><a href="${url}">${team.teamName}</a></li>\n`;
            });
            htmlOutput += `</ul>\n`;
        });
        console.log(htmlOutput);

        // ------------------------------------------------------------
        // Príprava máp pre linkifikáciu
        // ------------------------------------------------------------
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

        // ------------------------------------------------------------
        // Linkifikácia DOM
        // ------------------------------------------------------------
        const runLinkification = () => {
            try {
                makeTeamNamesClickable();
            } catch (e) {
                console.warn("⚠️ Linkifikácia DOM zlyhala:", e);
            }
        };

        runLinkification();
        setTimeout(runLinkification, 500);
        setTimeout(runLinkification, 1500);
        setTimeout(runLinkification, 3000);

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

        // Sledujeme aj zmeny hash (prepínanie filtra v tables.js)
        window.addEventListener('hashchange', () => {
            clearTimeout(window.__teamLinkifyHashTimer);
            window.__teamLinkifyHashTimer = setTimeout(runLinkification, 200);
        });

        return {
            teamsByCategory,
            flatList,
            totalTeams,
            totalUsers,
        };
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

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            loadAllTeamsFromUsers();
        });
    } else {
        loadAllTeamsFromUsers();
    }
}

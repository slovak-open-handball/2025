// func-redirection.js
// ============================================================
// Načíta všetky tímy z kolekcie 'users' a vypíše ich do konzoly
// ako klikateľné odkazy: teams#category=<KATEGÓRIA>&team=<TÍM>
// + Nastaví každý výskyt názvu tímu na stránke ako klikateľný odkaz
//   s korektnou kategóriou podľa kontextu:
//     - teams.js: nadpis kategórie v boxe
//     - matches.js: riadok tabuľky zápasov (kategória v inom stĺpci)
//     - matches.js detail: box s info o zápase (kategória v hlavičke)
//     - matches.js detail: boxy súpisiek (kategória z boxu s info)
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
// Pomocné funkcie na rozpoznanie kategórie v texte
// ------------------------------------------------------------
const textContainsKnownCategory = (text) => {
    if (!text) return null;
    const trimmed = String(text).trim();
    if (!trimmed) return null;

    // Presná zhoda
    if (knownCategoryNames.includes(trimmed)) return trimmed;

    // Obsahuje niektorú kategóriu (napr. "Kategória: U12 CH")
    // Zoradíme od najdlhšej po najkratšiu, aby sme našli najšpecifickejšiu
    const sorted = [...knownCategoryNames].sort((a, b) => b.length - a.length);
    for (const cat of sorted) {
        if (trimmed.includes(cat)) return cat;
    }
    return null;
};

// ------------------------------------------------------------
// 1) Kontext z nadpisu (h1–h4) v predkoch – pre teams.js
// ------------------------------------------------------------
const findCategoryFromHeadings = (element, rootElement) => {
    let current = element;
    while (current && current !== rootElement) {
        const tag = current.nodeName?.toUpperCase();
        if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4") {
            const found = textContainsKnownCategory(current.textContent);
            if (found) return found;
        }
        // Skús nájsť nadpis v potomkoch tohto elementu (napr. box má <h3>)
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
// 2) Kontext z riadku tabuľky <tr> – pre zoznam zápasov
// Hľadá v bunkách <td>/<th> toho istého riadku text, ktorý
// zodpovedá niektorej kategórii.
// ------------------------------------------------------------
const findCategoryFromTableRow = (element, rootElement) => {
    let current = element;
    while (current && current !== rootElement) {
        if (current.nodeName?.toUpperCase() === "TR") {
            // Prejdi bunky v riadku
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
// 3) Kontext z najbližšieho "boxu" (rounded + shadow)
// – pre detail zápasu (box s info o zápase, boxy súpisiek)
// Hľadá nadpis kategórie v hlavičke boxu (prvý <h1>–<h4> alebo
// element s class obsahujúcou 'bg-gray-50').
// ------------------------------------------------------------
const findCategoryFromBox = (element, rootElement) => {
    let current = element;
    while (current && current !== rootElement) {
        const cls = current.className || "";
        // Box rozpoznáme podľa kombinácie rounded + shadow/border
        if (
            typeof cls === "string" &&
            /rounded-(xl|lg)/.test(cls) &&
            /(shadow|border)/.test(cls)
        ) {
            // Najprv skús hlavičku boxu (bg-gray-50)
            const header = current.querySelector(".bg-gray-50");
            if (header) {
                const found = textContainsKnownCategory(header.textContent);
                if (found) return found;
            }
            // Potom akýkoľvek nadpis v boxe
            const heading = current.querySelector("h1, h2, h3, h4");
            if (heading) {
                const found = textContainsKnownCategory(heading.textContent);
                if (found) return found;
            }
            // Potom celý text boxu (napr. badge s kategóriou)
            const found = textContainsKnownCategory(current.textContent);
            if (found) return found;
            return null;
        }
        current = current.parentNode;
    }
    return null;
};

// ------------------------------------------------------------
// 4) Kontext z najbližšieho elementu s triedou 'bg-gradient-to-r'
// – pre box s info o zápase v detaile (obsahuje badge s kategóriou)
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
// Zlúčená funkcia: nájde kontextovú kategóriu pre element
// Skúša viac stratégií v poradí podľa špecifickosti.
// ------------------------------------------------------------
const findCategoryContextForElement = (element, rootElement) => {
    if (!element) return null;

    // 1) Nadpisy (teams.js aj detaily)
    let cat = findCategoryFromHeadings(element, rootElement);
    if (cat) return cat;

    // 2) Riadok tabuľky (zoznam zápasov)
    cat = findCategoryFromTableRow(element, rootElement);
    if (cat) return cat;

    // 3) Box s info o zápase (gradient)
    cat = findCategoryFromGradientBox(element, rootElement);
    if (cat) return cat;

    // 4) Box (rounded + shadow/border)
    cat = findCategoryFromBox(element, rootElement);
    if (cat) return cat;

    return null;
};

// ------------------------------------------------------------
// Pre daný tím a kontextovú kategóriu vráti URL
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

        // Kontextová kategória pre tento textový uzol
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

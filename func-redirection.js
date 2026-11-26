// func-redirection.js
// ============================================================
// Načíta všetky tímy z kolekcie 'users' a vypíše ich do konzoly
// ako klikateľné odkazy: teams#category=<KATEGÓRIA>&team=<TÍM>
// + Nastaví každý výskyt názvu tímu na stránke ako klikateľný odkaz
//   s korektnou kategóriou podľa kontextu (nadpisu kategórie)
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
// Pomocná funkcia: slugify pre URL
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
// Vytvorenie URL odkazu pre tím
// ------------------------------------------------------------
const buildTeamUrl = (categoryName, teamName) => {
    const categorySlug = slugify(categoryName);
    const teamSlug = slugify(teamName);
    return `teams#category=${categorySlug}&team=${teamSlug}`;
};

// ------------------------------------------------------------
// Globálne dáta
// ------------------------------------------------------------
// Plochý zoznam všetkých tímov: [{ teamName, categoryName, url }, ...]
let allTeamsFlat = [];

// Mapa: názov tímu -> množina kategórií, v ktorých sa vyskytuje
let teamNameToCategoriesMap = new Map();

// Zoznam všetkých známych názvov kategórií (pre rozpoznanie nadpisu)
let knownCategoryNames = [];

// ------------------------------------------------------------
// Zistí, pod akou kategóriou sa daný element nachádza.
// Prejde rodičov smerom nahor a hľadá najbližší nadpis (h1–h4)
// alebo element, ktorého text presne zodpovedá niektorej kategórii.
// ------------------------------------------------------------
const findCategoryContextForElement = (element, rootElement) => {
    let current = element;
    while (current && current !== rootElement) {
        // 1) Skús nájsť nadpis (h1–h4) v rámci tohto elementu alebo jeho potomkoch
        if (current.querySelector) {
            const heading = current.querySelector("h1, h2, h3, h4");
            if (heading) {
                const headingText = (heading.textContent || "").trim();
                // Presná zhoda s niektorou kategóriou
                if (headingText && knownCategoryNames.includes(headingText)) {
                    return headingText;
                }
                // Skúsime aj či nadpis obsahuje názov kategórie (napr. "Kategória: U12 CH")
                for (const catName of knownCategoryNames) {
                    if (headingText.includes(catName)) {
                        return catName;
                    }
                }
            }
        }

        // 2) Skús priamy text aktuálneho elementu (napr. <h3>U12 CH</h3>)
        if (current.childNodes && current.childNodes.length > 0) {
            // overíme, či element sám nie je nadpis s textom kategórie
            const tag = current.nodeName?.toUpperCase();
            if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4") {
                const text = (current.textContent || "").trim();
                if (knownCategoryNames.includes(text)) {
                    return text;
                }
                for (const catName of knownCategoryNames) {
                    if (text.includes(catName)) {
                        return catName;
                    }
                }
            }
        }

        current = current.parentNode;
    }
    return null;
};

// ------------------------------------------------------------
// Pre daný tím a kontextovú kategóriu vráti URL.
// Ak tím v danej kategórii neexistuje, vráti fallback URL
// (prvú kategóriu, v ktorej sa tím nachádza).
// ------------------------------------------------------------
const getTeamUrlForContext = (teamName, contextCategory) => {
    // Ak máme kontextovú kategóriu a tím v nej existuje, použijeme ju
    if (contextCategory) {
        const categoriesForTeam = teamNameToCategoriesMap.get(teamName);
        if (categoriesForTeam && categoriesForTeam.has(contextCategory)) {
            return buildTeamUrl(contextCategory, teamName);
        }
    }
    // Fallback: prvá kategória, v ktorej sa tím nachádza
    const categoriesForTeam = teamNameToCategoriesMap.get(teamName);
    if (categoriesForTeam && categoriesForTeam.size > 0) {
        const firstCat = categoriesForTeam.values().next().value;
        return buildTeamUrl(firstCat, teamName);
    }
    // Posledný fallback – prázdna kategória (nemalo by nastať)
    return buildTeamUrl("", teamName);
};

// ------------------------------------------------------------
// Nastaví všetky výskyty názvov tímov v DOM ako klikateľné odkazy
// s korektnou kategóriou podľa kontextu
// ------------------------------------------------------------
const makeTeamNamesClickable = () => {
    if (!allTeamsFlat.length) return;

    // Zoradíme tímy od najdlhšieho názvu po najkratší
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

        // 🔥 ZISTÍME KONTEXTOVÚ KATEGÓRIU pre tento textový uzol
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

            // 🔥 URL podľa kontextu (kategória nadpisu)
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

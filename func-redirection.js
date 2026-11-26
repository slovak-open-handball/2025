// func-redirection.js
// ============================================================
// Načíta všetky tímy z kolekcie 'users' a vypíše ich do konzoly
// ako klikateľné odkazy: teams#category=<KATEGÓRIA>&team=<TÍM>
// + Nastaví každý výskyt názvu tímu na stránke ako klikateľný odkaz
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
// "U12 CH" -> "U12-CH", "HC Pezinok" -> "HC-Pezinok"
// ------------------------------------------------------------
const slugify = (text) => {
    if (!text) return "";
    return String(text)
        .trim()
        .replace(/\s+/g, "-")        // medzery → pomlčky
        .replace(/[^\w\-áäčďéíĺľňóôŕšťúůýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚŮÝŽ]/g, "") // odstráni nebezpečné znaky
        .replace(/-+/g, "-")          // viac pomlčiek → jedna
        .replace(/^-+|-+$/g, "");     // orež pomlčky na začiatku/konci
};

// ------------------------------------------------------------
// Vytvorenie URL odkazu pre tím
// Príklad: teams#category=U12-CH&team=HC-Pezinok
// ------------------------------------------------------------
const buildTeamUrl = (categoryName, teamName) => {
    const categorySlug = slugify(categoryName);
    const teamSlug = slugify(teamName);
    return `teams#category=${categorySlug}&team=${teamSlug}`;
};

// ------------------------------------------------------------
// Globálny zoznam tímov (naplní sa po načítaní)
// Štruktúra: [{ teamName, categoryName, url }, ...]
// ------------------------------------------------------------
let allTeamsFlat = [];

// ------------------------------------------------------------
// Nastaví všetky výskyty názvov tímov v DOM ako klikateľné odkazy
// ------------------------------------------------------------
const makeTeamNamesClickable = () => {
    if (!allTeamsFlat.length) return;

    // Zoradíme tímy od najdlhšieho názvu po najkratší,
    // aby sme predišli čiastočnému nahradeniu (napr. "U12" v "U12 CH")
    const teamsSorted = [...allTeamsFlat].sort(
        (a, b) => b.teamName.length - a.teamName.length
    );

    // Vytvoríme regex pre všetky názvy tímov naraz
    const escapedNames = teamsSorted.map(t =>
        t.teamName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    if (escapedNames.length === 0) return;

    const teamNameRegex = new RegExp(`(${escapedNames.join("|")})`, "g");

    // Mapa: názov tímu -> URL
    const teamUrlMap = new Map();
    teamsSorted.forEach(t => {
        if (!teamUrlMap.has(t.teamName)) {
            teamUrlMap.set(t.teamName, t.url);
        }
    });

    // Prechádzame textové uzly v #root (alebo v celom body)
    const rootElement = document.getElementById("root") || document.body;

    const walker = document.createTreeWalker(
        rootElement,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                // Preskočíme prázdne texty
                if (!node.nodeValue || !node.nodeValue.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Preskočíme texty, ktoré už sú v <a>, <script>, <style>, <textarea>
                let parent = node.parentNode;
                while (parent && parent !== rootElement) {
                    const tag = parent.nodeName?.toUpperCase();
                    if (tag === "A" || tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "INPUT") {
                        return NodeFilter.FILTER_REJECT;
                    }
                    parent = parent.parentNode;
                }
                // Preskočíme texty, ktoré už boli spracované
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
            // reset regex lastIndex
            teamNameRegex.lastIndex = 0;
            return;
        }
        teamNameRegex.lastIndex = 0;

        // Rozdelíme text podľa názvov tímov
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = teamNameRegex.exec(text)) !== null) {
            const matchedName = match[0];
            const matchIndex = match.index;

            if (matchIndex > lastIndex) {
                parts.push({ type: "text", value: text.slice(lastIndex, matchIndex) });
            }

            const url = teamUrlMap.get(matchedName);
            if (url) {
                parts.push({ type: "link", value: matchedName, url });
            } else {
                parts.push({ type: "text", value: matchedName });
            }

            lastIndex = matchIndex + matchedName.length;
        }

        if (lastIndex < text.length) {
            parts.push({ type: "text", value: text.slice(lastIndex) });
        }

        // Ak sa nič nenašlo, nič nemeniť
        if (parts.length <= 1) return;

        // Nahradíme textový uzol fragmentom s odkazmi
        const fragment = document.createDocumentFragment();
        parts.forEach(part => {
            if (part.type === "link") {
                const a = document.createElement("a");
                a.href = part.url;
                a.textContent = part.value;
                a.style.color = "#2563eb";
                a.style.textDecoration = "underline";
                a.style.cursor = "pointer";
                a.dataset.teamLinkified = "1";
                // Voliteľne: ak chceme, aby sa odkaz otvoril v tej istej karte
                // (predvolené správanie <a>)
                fragment.appendChild(a);
            } else {
                fragment.appendChild(document.createTextNode(part.value));
            }
        });

        const parent = textNode.parentNode;
        if (parent) {
            // Označíme rodiča, aby sme ho už znovu nespracovávali
            parent.dataset.teamLinkified = "1";
            parent.replaceChild(fragment, textNode);
        }
    });
};

// ------------------------------------------------------------
// Hlavná funkcia – načíta tímy, vypíše ich do konzoly
// a nastaví klikateľné odkazy na stránke
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

        // Štruktúra: { kategória: [ { teamName, uid, email, groupName, order } ] }
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

        // ------------------------------------------------------------
        // Výpis do konzoly – zoskupené podľa kategórií
        // ------------------------------------------------------------
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

            // Zoradíme tímy: najprv podľa skupiny, potom podľa poradia, potom podľa názvu
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

                // Vypíšeme text + klikateľný odkaz
                console.log(
                    `   ${String(index + 1).padStart(3, " ")}. ${group} ${order} ${team.teamName}\n       🔗 ${url}`
                );
            });
        });

        // ------------------------------------------------------------
        // Plochý zoznam všetkých tímov s URL (pre ľahké kopírovanie)
        // ------------------------------------------------------------
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
        // EXTRA: HTML zoznam klikateľných odkazov (pre vloženie do stránky)
        // ------------------------------------------------------------
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
        // Uložíme si plochý zoznam pre linkifikáciu DOM
        // ------------------------------------------------------------
        allTeamsFlat = [];
        sortedCategories.forEach((categoryName) => {
            teamsByCategory[categoryName].forEach((team) => {
                allTeamsFlat.push({
                    teamName: team.teamName,
                    categoryName: categoryName,
                    url: buildTeamUrl(categoryName, team.teamName),
                });
            });
        });

        // ------------------------------------------------------------
        // Spustíme linkifikáciu DOM (aj s oneskorením, aby React stihol vykresliť)
        // ------------------------------------------------------------
        const runLinkification = () => {
            try {
                makeTeamNamesClickable();
            } catch (e) {
                console.warn("⚠️ Linkifikácia DOM zlyhala:", e);
            }
        };

        // Okamžite
        runLinkification();
        // A ešte niekoľkokrát s oneskorením (React render je async)
        setTimeout(runLinkification, 500);
        setTimeout(runLinkification, 1500);
        setTimeout(runLinkification, 3000);

        // Sledujeme zmeny v DOM (React prekresľuje) – linkifikácia sa spustí pri zmene
        if (window.MutationObserver) {
            const observer = new MutationObserver(() => {
                // Debounce, aby sme nespúšťali príliš často
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

        // ------------------------------------------------------------
        // Vrátime aj štruktúrované dáta (pre ďalšie použitie)
        // ------------------------------------------------------------
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
// Automatické spustenie pri načítaní modulu (voliteľné)
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

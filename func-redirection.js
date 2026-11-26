// func-redirection.js
// ============================================================
// Načíta všetky tímy z kolekcie 'users' a vypíše ich do konzoly
// ako klikateľné odkazy: teams#category=<KATEGÓRIA>&team=<TÍM>
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
// Hlavná funkcia – načíta tímy a vypíše ich do konzoly
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

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            loadAllTeamsFromUsers();
        });
    } else {
        loadAllTeamsFromUsers();
    }
}

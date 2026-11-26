// func-redirection.js
// ============================================================
// Načíta všetky tímy z kolekcie 'users' a vypíše ich do konzoly
// Čaká na inicializáciu window.db (z authentication.js)
// ============================================================

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ------------------------------------------------------------
// Čakanie na window.db
// ------------------------------------------------------------
const waitForDb = (timeoutMs = 15000, intervalMs = 200) => {
    return new Promise((resolve, reject) => {
        // Ak už je db dostupná, vrátime ju hneď
        if (window.db) {
            resolve(window.db);
            return;
        }

        const startTime = Date.now();

        // Počúvame aj na event 'dbInitialized' (dispatchuje ho authentication.js)
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

        // Zároveň pollujeme (pre istotu, keby event už prebehol)
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

        // TVRDÝ timeout
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error("Timeout: window.db nebola inicializovaná do " + timeoutMs + " ms."));
        }, timeoutMs);
    });
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
                console.log(
                    `   ${String(index + 1).padStart(3, " ")}. ${group} ${order} ${team.teamName}  (uid: ${team.uid}, email: ${team.email})`
                );
            });
        });

        // ------------------------------------------------------------
        // Plochý zoznam všetkých tímov (pre ľahké kopírovanie)
        // ------------------------------------------------------------
        console.log("");
        console.log("============================================================");
        console.log("📋 PLOCHÝ ZOZNAM VŠETKÝCH TÍMOV (kategória | skupina | poradie | názov)");
        console.log("============================================================");

        const flatList = [];
        sortedCategories.forEach((categoryName) => {
            teamsByCategory[categoryName].forEach((team) => {
                flatList.push({
                    category: categoryName,
                    group: team.groupName || "",
                    order: team.order ?? "",
                    teamName: team.teamName,
                });
            });
        });

        console.table(flatList);

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
    // Sprístupníme funkciu globálne pre manuálne volanie z konzoly
    window.loadAllTeamsFromUsers = loadAllTeamsFromUsers;

    // Automaticky spustíme po načítaní stránky
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            loadAllTeamsFromUsers();
        });
    } else {
        loadAllTeamsFromUsers();
    }
}

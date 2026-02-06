// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef, useSyncExternalStore } = React;

/**
 * Globálna funkcia pre zobrazenie notifikácií
 */
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }
    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success':
            typeClasses = 'bg-green-500 text-white';
            break;
        case 'error':
            typeClasses = 'bg-red-500 text-white';
            break;
        case 'info':
            typeClasses = 'bg-blue-500 text-white';
            break;
        default:
            typeClasses = 'bg-gray-700 text-white';
    }
    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;
    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);
    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

let isEmailSyncListenerSetup = false;

const AddGroupsApp = ({ userProfileData }) => {

    // ──────────────────────────────────────────────
    // Real-time log ubytovania (type = "ubytovanie")
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (!window.db) {
            console.warn("[PLACES LOG] window.db nie je dostupné");
            return;
        }

        console.log("[PLACES LOG] Spúšťam real-time sledovanie kolekcie 'places' (iba ubytovanie)");

        let previousCount = -1;

        const unsubscribePlaces = onSnapshot(
            collection(window.db, 'places'),
            (snapshot) => {
                const places = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.type !== "ubytovanie") return;

                    places.push({
                        id: doc.id,
                        name: data.name || '(bez názvu)',
                        type: data.type || '?',
                        lat: data.lat ?? data.location?.latitude ?? '?',
                        lng: data.lng ?? data.location?.longitude ?? '?',
                        accommodationType: data.accommodationType || null,
                        capacity: data.capacity ?? null,
                        createdAt: data.createdAt
                            ? new Date(data.createdAt.toMillis()).toLocaleString('sk-SK')
                            : '?',
                    });
                });

                console.clear(); // voliteľné – ak chceš čistú konzolu

                console.log("═══════════════════════════════════════════════════");
                console.log(`NAČÍTANÉ UBYTOVANIE (type = "ubytovanie") — ${new Date().toLocaleTimeString('sk-SK')}`);
                console.log(`Celkový počet: ${places.length} ${previousCount >= 0 ? `(bolo ${previousCount})` : ''}`);
                console.log("═══════════════════════════════════════════════════");

                if (places.length === 0) {
                    console.log("→ Žiadne ubytovacie miesta v databáze");
                } else {
                    places.forEach((place, index) => {
                        console.log(`Ubytovanie #${index + 1}:`);
                        console.log(` ID ............ ${place.id}`);
                        console.log(` Názov ......... ${place.name}`);
                        console.log(` Typ ........... ${place.type}`);
                        console.log(` Súradnice ..... ${place.lat} , ${place.lng}`);
                        if (place.accommodationType) console.log(` Typ ubyt. ..... ${place.accommodationType}`);
                        if (place.capacity !== null) console.log(` Kapacita ...... ${place.capacity}`);
                        console.log(` Vytvorené ..... ${place.createdAt}`);
                        console.log("───────────────────────────────────────────────");
                    });
                }

                previousCount = places.length;
            },
            (error) => {
                console.error("[PLACES LOG] Chyba pri onSnapshot places:", error);
            }
        );

        return () => {
            console.log("[PLACES LOG] Zastavujem sledovanie 'places'");
            unsubscribePlaces();
        };
    }, []);

    // ──────────────────────────────────────────────
    // NOVÉ: Real-time log všetkých používateľov z kolekcie "users"
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (!window.db) {
            console.warn("[USERS LOG] window.db nie je dostupné");
            return;
        }
    
        console.log("[USERS LOG] Spúšťam real-time sledovanie kolekcie 'users' + detail tímov");
    
        let previousUsersCount = -1;
    
        const unsubscribeUsers = onSnapshot(
            collection(window.db, 'users'),
            (snapshot) => {
                const usersSummary = [];
                let totalTeamsAcrossAllUsers = 0;
    
                snapshot.forEach((doc) => {
                    const data = doc.data() || {};
    
                    const userEntry = {
                        id: doc.id,
                        email: data.email || '(bez emailu)',
                        displayName: data.displayName || data.name || '(bez mena)',
                        role: data.role || '—',
                        createdAt: data.createdAt
                            ? new Date(data.createdAt.toMillis()).toLocaleString('sk-SK')
                            : '—',
                        lastSignIn: data.lastSignInTime
                            ? new Date(data.lastSignInTime.toMillis()).toLocaleString('sk-SK')
                            : '—',
                        teams: [],
                    };
    
                    // Prechádzame všetky kategórie v "teams"
                    if (data.teams && typeof data.teams === 'object') {
                        Object.entries(data.teams).forEach(([category, teamArray]) => {
                            if (!Array.isArray(teamArray)) return;
    
                            teamArray.forEach((team, teamIndex) => {
                                if (!team || !team.teamName) return;
    
                                totalTeamsAcrossAllUsers++;
    
                                const teamInfo = {
                                    category,
                                    teamName: team.teamName,
                                    groupName: team.groupName || '—',
                                    players: team.players ?? team._players ?? 0,
                                    jerseyHome: team.jerseyHomeColor || '—',
                                    jerseyAway: team.jerseyAwayColor || '—',
                                    accommodation: team.accommodation?.type || '—',
                                    arrival: team.arrival
                                        ? `${team.arrival.type || '?'} ${team.arrival.time || ''}`.trim()
                                        : '—',
                                    package: team.packageDetails?.name || '—',
                                    tshirtsSummary: team.tshirts
                                        ? team.tshirts
                                              .map(t => `${t.size}: ${t.quantity} ks`)
                                              .join(', ')
                                        : '—',
                                    menTeamMembers: team.menTeamMembersCount || 0,
                                    womenTeamMembers: team.womenTeamMembersCount || 0,
                                    driversMale: team.drivers?.male ?? team._menDriversCount ?? 0,
                                    driversFemale: team.drivers?.female ?? team._womenDriversCount ?? 0,
                                };
    
                                // Pridáme počet hráčov z poľa detailov (ak existuje)
                                if (Array.isArray(team.playerDetails)) {
                                    teamInfo.playersDetailed = team.playerDetails.length;
                                }
    
                                userEntry.teams.push(teamInfo);
                            });
                        });
                    }
    
                    usersSummary.push(userEntry);
                });
    
                // ─── Výpis ────────────────────────────────────────
                // console.clear();           ← stále zakomentované
    
                console.log("═══════════════════════════════════════════════════");
                console.log(`POUŽÍVATELIA + TÍMY — ${new Date().toLocaleTimeString('sk-SK')}`);
                console.log(`Celkom používateľov: ${usersSummary.length}   |   Celkom tímov: ${totalTeamsAcrossAllUsers}`);
                console.log(`(predtým: ${previousUsersCount >= 0 ? previousUsersCount : '—'})`);
                console.log("═══════════════════════════════════════════════════");
    
                if (usersSummary.length === 0) {
                    console.log("→ Žiadni používatelia v databáze");
                } else {
                    usersSummary.forEach((user, uIndex) => {
                        console.log(`Používateľ #${uIndex + 1} ──────────────────────────────────────`);
                        console.log(` UID .............. ${user.id}`);
                        console.log(` Meno / email ..... ${user.displayName}  (${user.email})`);
                        console.log(` Rola ............. ${user.role}`);
                        console.log(` Vytvorený ........ ${user.createdAt}`);
                        console.log(` Posl. prihlásenie  ${user.lastSignIn}`);
                        console.log(` Počet tímov ...... ${user.teams.length}`);
    
                        if (user.teams.length === 0) {
                            console.log("   → žiadne tímy");
                        } else {
                            user.teams.forEach((team, tIndex) => {
                                console.log(`   Tím #${tIndex + 1} [${team.category}]`);
                                console.log(`     • Názov ........ ${team.teamName}`);
                                console.log(`     • Skupina ...... ${team.groupName}`);
                                console.log(`     • Hráči ........ ${team.players}${
                                    team.playersDetailed ? ` (${team.playersDetailed} v detaile)` : ''
                                }`);
                                console.log(`     • RT muži ...... ${team.menTeamMembers}`);
                                console.log(`     • RT ženy ...... ${team.womenTeamMembers}`);
                                console.log(`     • Vodiči M/Ž ... ${team.driversMale} / ${team.driversFemale}`);
                                console.log(`     • Dresy domáci . ${team.jerseyHome}`);
                                console.log(`     • Dresy vonku .. ${team.jerseyAway}`);
                                console.log(`     • Ubytovanie ... ${team.accommodation}`);
                                console.log(`     • Príchod ...... ${team.arrival}`);
                                console.log(`     • Balík ........ ${team.package}`);
                                console.log(`     • Tričká ....... ${team.tshirtsSummary}`);
                                console.log("   ───────────────────────────────────────");
                            });
                        }
                        console.log("───────────────────────────────────────────────");
                    });
                }
    
                previousUsersCount = usersSummary.length;
            },
            (error) => {
                console.error("[USERS LOG] Chyba pri onSnapshot users:", error);
            }
        );
    
        return () => {
            console.log("[USERS LOG] Zastavujem sledovanie 'users'");
            unsubscribeUsers();
        };
    }, []);
    
    // ──────────────────────────────────────────────
    // Zvyšok tvojej pôvodnej komponenty (placeholder)
    // ──────────────────────────────────────────────
    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-center' },
        React.createElement(
            'div',
            { className: `w-full max-w-2xl bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]` },
            React.createElement(
                'div',
                { className: `flex flex-col items-center justify-center mb-6 p-4 -mx-8 -mt-8 rounded-t-xl` },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center' }, 'Ubytovanie tímov')
            ),
            React.createElement(
                'div',
                { className: 'text-center text-gray-600 mt-8' },
                'Načítavanie ubytovacích možností pre tímy...'
            )
        )
    );
};

/**
 * Táto funkcia je poslucháčom udalosti 'globalDataUpdated'.
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu MyDataApp.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        // Synchronizácia emailu (pôvodná logika)
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            console.log("logged-in-teams-in-accomodation.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);

                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`E-mail rozdiel: auth → ${user.email} vs firestore → ${firestoreEmail}`);
                                await updateDoc(userProfileRef, { email: user.email });

                                await addDoc(collection(window.db, 'notifications'), {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });

                                window.showGlobalNotification('E-mail bol automaticky aktualizovaný.', 'success');
                            }
                        }
                    } catch (error) {
                        console.error("Chyba pri synchronizácii e-mailu:", error);
                        window.showGlobalNotification('Chyba pri synchronizácii e-mailu.', 'error');
                    }
                }
            });

            isEmailSyncListenerSetup = true;
        }

        // Vykreslenie
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
            console.log("Aplikácia vykreslená (AddGroupsApp)");
        }
    } else {
        // loader ...
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center h-full pt-16' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
                )
            );
        }
    }
};

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated'.
console.log("logged-in-teams-in-accomodation.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

if (window.globalUserProfileData) {
    console.log("Globálne dáta už existujú → vykresľujem okamžite");
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    // loader fallback
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            React.createElement(
                'div',
                { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
}

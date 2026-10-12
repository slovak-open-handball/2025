// logged-in-transport.js
import { doc, getDoc, getDocs, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
        case 'success': typeClasses = 'bg-green-500 text-white'; break;
        case 'error':   typeClasses = 'bg-red-500 text-white';   break;
        case 'info':    typeClasses = 'bg-blue-500 text-white';  break;
        default:        typeClasses = 'bg-gray-700 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

const TransportApp = ({ userProfileData }) => {
    // ============================================================
    // NAČÍTANIE tournamentStart / tournamentEnd + TÍMOV S UBYTOVŇOU
    // ============================================================
    useEffect(() => {
        if (!window.db) return;

        let unsubscribeRegistration = null;

        const formatTs = (ts) => {
            if (!ts) return null;
            if (typeof ts.toDate === 'function') {
                return ts.toDate().toISOString();
            }
            return ts;
        };

        // 1) Dátumy turnaja – len tournamentStart a tournamentEnd
        const loadTournamentDates = async () => {
            try {
                const regRef = doc(window.db, 'settings', 'registration');
                const snap = await getDoc(regRef);

                if (!snap.exists()) {
                    console.log('[TRANSPORT] settings/registration neexistuje.');
                    return;
                }

                const data = snap.data();

                console.log('[TRANSPORT] ===== DÁTUMY TURNAJA =====');
                console.log('[TRANSPORT] tournamentStart:', formatTs(data.tournamentStart));
                console.log('[TRANSPORT] tournamentEnd:  ', formatTs(data.tournamentEnd));
                console.log('[TRANSPORT] ============================');
            } catch (err) {
                console.error('[TRANSPORT] Chyba pri načítaní dátumov turnaja:', err);
            }
        };

        // Live listener na zmeny tournamentStart / tournamentEnd
        try {
            const regRef = doc(window.db, 'settings', 'registration');
            unsubscribeRegistration = onSnapshot(regRef, (snap) => {
                if (!snap.exists()) return;
                const data = snap.data();
                console.log('[TRANSPORT] (live) tournamentStart:', formatTs(data.tournamentStart));
                console.log('[TRANSPORT] (live) tournamentEnd:  ', formatTs(data.tournamentEnd));
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/registration) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na settings/registration:', e);
        }

        // 2) Tímy s priradenou ubytovňou, zoskupené podľa kategórie
        const loadTeamsWithAccommodation = async () => {
            try {
                const usersRef = collection(window.db, 'users');
                const usersSnap = await getDocs(usersRef);

                const grouped = {};

                usersSnap.forEach((userDoc) => {
                    const userData = userDoc.data() || {};
                    const teams = userData.teams;
                    if (!teams || typeof teams !== 'object') return;

                    Object.entries(teams).forEach(([category, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;

                        teamArray.forEach((team) => {
                            if (!team || !team.teamName) return;

                            const accomType = team.accommodation?.type?.trim?.() || '';
                            const accomName = team.accommodation?.name?.trim?.() || '';

                            // Len tímy s priradenou konkrétnou ubytovňou (majú name)
                            if (!accomName) return;

                            if (!grouped[category]) grouped[category] = [];

                            grouped[category].push({
                                teamName: team.teamName.trim(),
                                accommodationType: accomType || '(nešpecifikovaný)',
                                accommodationName: accomName,
                                userId: userDoc.id
                            });
                        });
                    });
                });

                console.log('[TRANSPORT] ===== TÍMY S PRIRADENOU UBYTOVŇOU PODĽA KATEGÓRIÍ =====');
                const categories = Object.keys(grouped).sort((a, b) =>
                    a.localeCompare(b, 'sk', { sensitivity: 'base' })
                );

                if (categories.length === 0) {
                    console.log('[TRANSPORT] Žiadne tímy s priradenou ubytovňou.');
                } else {
                    categories.forEach((category) => {
                        console.log(`\n[TRANSPORT] Kategória: ${category} (${grouped[category].length} tímov)`);
                        grouped[category]
                            .sort((a, b) => a.teamName.localeCompare(b.teamName, 'sk', { sensitivity: 'base' }))
                            .forEach((t) => {
                                console.log(`   • ${t.teamName}  →  ubytovňa: "${t.accommodationName}"  (typ: ${t.accommodationType})`);
                            });
                    });
                }
                console.log('[TRANSPORT] =====================================================');
            } catch (err) {
                console.error('[TRANSPORT] Chyba pri načítaní tímov s ubytovaním:', err);
            }
        };

        loadTournamentDates();
        loadTeamsWithAccommodation();

        return () => {
            if (unsubscribeRegistration) unsubscribeRegistration();
        };
    }, []);

    return React.createElement(
        'div',
        { className: 'w-full flex-1 flex flex-col' },
        React.createElement(
            'div',
            { className: 'w-full flex-1 bg-white rounded-xl shadow-xl p-8 flex flex-col items-center justify-start transform transition-all duration-500' },
            React.createElement(
                'div',
                { className: 'flex flex-col items-center mb-6' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center' }, 'Doprava')
            )
        )
    );
};

let isEmailSyncListenerSetup = false;

const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        if (window.auth && window.db && !isEmailSyncListenerSetup) {            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {                                
                                await updateDoc(userProfileRef, {
                                    email: user.email
                                });
            
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email, 
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(), 
                                });
                                
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');
                            }
                        }
                    } catch (error) {
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true; 
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(TransportApp, { userProfileData }));
        }
    } else {
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

window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

if (window.globalUserProfileData) {
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
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

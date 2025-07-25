// header.js
// Tento súbor predpokladá, že __app_id, __firebase_config, __initial_auth_token a __firebase_app_name
// sú globálne definované v <head> hlavného HTML súboru.

// Inicializácia Firebase (ak už nie je inicializovaná iným skriptom)
let firebaseAppHeader;
let authHeader;
let dbHeader;
let unsubscribeUsersListener = null; // Pre uloženie funkcie na zrušenie odberu
let initialUsersLoadComplete = false; // Flag pre odlíšenie počiatočného načítania dát
let usersCache = {}; // Cache na ukladanie stavu používateľov pre detekciu zmien

// Funkcia na zobrazenie push-up notifikácie
function showPushNotification(message, notificationId) { // Pridaný notificationId pre sledovanie
    const notificationArea = document.getElementById('header-notification-area');
    if (!notificationArea) {
        console.error("Header.js: Element s ID 'header-notification-area' nebol nájdený.");
        return;
    }

    // Skontrolujeme, či táto notifikácia už bola zobrazená v tejto relácii
    const lastShownTime = localStorage.getItem(`notification_shown_${notificationId}`);
    const now = new Date().getTime();

    // Ak už bola zobrazená v poslednej minúte, nezobrazuj ju znova
    if (lastShownTime && (now - parseInt(lastShownTime, 10) < 60 * 1000)) { // 60 sekúnd
        console.log(`Header.js: Notifikácia s ID ${notificationId} už bola nedávno zobrazená, preskakujem.`);
        return;
    }

    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg mb-3 transition-transform duration-500 ease-out transform translate-y-full opacity-0 pointer-events-auto';
    notificationDiv.innerHTML = `<p class="font-semibold">${message}</p>`;
    
    // Pridáme notifikáciu na začiatok oblasti (najnovšie hore)
    notificationArea.prepend(notificationDiv);

    // Uložíme čas zobrazenia do lokálneho úložiska
    localStorage.setItem(`notification_shown_${notificationId}`, now.toString());

    // Animácia zobrazenia
    setTimeout(() => {
        notificationDiv.classList.remove('translate-y-full', 'opacity-0');
        notificationDiv.classList.add('translate-y-0', 'opacity-100');
    }, 10); // Krátke oneskorenie pre spustenie animácie

    // Automatické skrytie po 10 sekundách
    setTimeout(() => {
        notificationDiv.classList.remove('translate-y-0', 'opacity-100');
        notificationDiv.classList.add('translate-y-full', 'opacity-0');
        // Po dokončení animácie odstránime element z DOM
        notificationDiv.addEventListener('transitionend', () => {
            notificationDiv.remove();
        }, { once: true });
    }, 10000);
}

// Pomocná funkcia na aktualizáciu viditeľnosti odkazov v hlavičke
function updateHeaderLinks(currentUser, isRegistrationOpenStatus) {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink && profileLink && logoutButton && registerLink) {
        if (currentUser) { // Ak je používateľ prihlásený
            authLink.classList.add('hidden');
            profileLink.classList.remove('hidden');
            logoutButton.classList.remove('hidden');
            registerLink.classList.add('hidden'); // Skryť registračný odkaz, ak je prihlásený
        } else { // Ak používateľ nie je prihlásený
            authLink.classList.remove('hidden');
            profileLink.classList.add('hidden');
            logoutButton.classList.add('hidden');
            if (isRegistrationOpenStatus) {
                registerLink.classList.remove('hidden');
            } else {
                registerLink.classList.add('hidden');
            }
        }
    } else {
        console.warn("Header.js: Niektoré navigačné odkazy neboli nájdené v hlavičke.");
    }
}

// Hlavná inicializačná logika pre hlavičku
async function initializeHeaderLogic() {
    console.log("Header.js: Inicializujem logiku hlavičky.");

    try {
        if (typeof firebase === 'undefined') {
            console.error("Header.js: Firebase SDK nie je načítané.");
            return;
        }

        // Skontrolujte, či už existuje predvolená aplikácia Firebase
        if (firebase.apps.length === 0) {
            // Používame globálne __firebase_config
            firebaseAppHeader = firebase.initializeApp(JSON.parse(__firebase_config));
        } else {
            // Ak už predvolená aplikácia existuje, použite ju
            firebaseAppHeader = firebase.app();
            console.warn("Header.js: Firebase App named '[DEFAULT]' already exists. Using existing app instance.");
        }
        authHeader = firebase.auth(firebaseAppHeader);
        dbHeader = firebase.firestore(firebaseAppHeader);

        // Načítanie nastavení registrácie pre odkaz "Registrácia na turnaj"
        let currentIsRegistrationOpenStatus = false;
        try {
            const settingsDoc = await dbHeader.collection('settings').doc('registration').get();
            if (settingsDoc.exists) {
                const data = settingsDoc.data();
                const now = new Date();
                const regStart = data.registrationStartDate ? data.registrationStartDate.toDate() : null;
                const regEnd = data.registrationEndDate ? data.registrationEndDate.toDate() : null;

                const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
                const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

                currentIsRegistrationOpenStatus = (
                    (isRegStartValid ? now >= regStart : true) &&
                    (isRegEndValid ? now <= regEnd : true)
                );
            } else {
                currentIsRegistrationOpenStatus = false; // Predvolene zatvorené, ak sa nastavenia nenašli
            }
        } catch (error) {
            console.error("Header.js: Chyba pri načítaní nastavení registrácie pre hlavičku:", error);
            currentIsRegistrationOpenStatus = false;
        }

        // Listener pre zmeny stavu autentifikácie
        authHeader.onAuthStateChanged(async (currentHeaderUser) => {
            console.log("Header.js: onAuthStateChanged - Používateľ:", currentHeaderUser ? currentHeaderUser.uid : "null");
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);

            // Zrušenie predchádzajúceho listenera na zmeny používateľov
            if (unsubscribeUsersListener) {
                unsubscribeUsersListener();
                unsubscribeUsersListener = null;
                initialUsersLoadComplete = false; // Reset flag pri zmene používateľa/odhlásení
                usersCache = {}; // Vyčisti cache
                console.log("Header.js: Zrušený listener pre zmeny používateľov.");
            }

            if (currentHeaderUser) {
                try {
                    // Načítanie roly prihláseného používateľa
                    const userDoc = await dbHeader.collection('users').doc(currentHeaderUser.uid).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        const userRole = userData.role;
                        const userApproved = userData.approved;

                        if (userRole === 'admin' && userApproved === true) {
                            console.log("Header.js: Prihlásený používateľ je schválený administrátor. Nastavujem listener na zmeny používateľov.");
                            // Nastavenie listenera na zmeny v kolekcii 'users'
                            unsubscribeUsersListener = dbHeader.collection('users').onSnapshot(snapshot => {
                                if (!initialUsersLoadComplete) {
                                    // Pri prvom načítaní len naplníme cache a nastavíme flag
                                    snapshot.docs.forEach(doc => {
                                        usersCache[doc.id] = doc.data();
                                    });
                                    initialUsersLoadComplete = true;
                                    console.log("Header.js: Počiatočné načítanie používateľov pre notifikácie dokončené.");
                                    return;
                                }

                                snapshot.docChanges().forEach(async change => { // Zmenené na async
                                    let message = '';
                                    const changedUserData = change.doc.data();
                                    const userId = change.doc.id;
                                    const userEmail = changedUserData.email || userId; // Použijeme email alebo UID

                                    console.log(`Header.js: Detekovaná zmena pre používateľa ${userEmail} (ID: ${userId}). Typ zmeny: ${change.type}`);
                                    console.log("Header.js: Nové dáta:", changedUserData);

                                    if (change.type === 'modified') {
                                        // Detekujeme konkrétne zmeny
                                        const oldData = usersCache[userId];
                                        console.log("Header.js: Staré dáta z cache:", oldData);

                                        if (oldData) {
                                            const changedFields = Object.keys(changedUserData).filter(key => {
                                                const oldValue = oldData[key];
                                                const newValue = changedUserData[key];

                                                // Špeciálne ošetrenie pre Timestamp objekty
                                                if (oldValue && typeof oldValue.toDate === 'function' && newValue && typeof newValue.toDate === 'function') {
                                                    return oldValue.toDate().getTime() !== newValue.toDate().getTime();
                                                }
                                                // Pre ostatné typy porovnávame stringifikované hodnoty
                                                return JSON.stringify(newValue) !== JSON.stringify(oldValue);
                                            });
                                            
                                            console.log("Header.js: Zmenené polia:", changedFields);

                                            if (changedFields.length > 0) {
                                                message = `Používateľ ${userEmail} aktualizoval svoje údaje: ${changedFields.join(', ')}.`;
                                            }
                                        } else {
                                            // Ak staré dáta nie sú v cache (napr. nový používateľ bol pridaný a hneď upravený)
                                            message = `Používateľ ${userEmail} bol aktualizovaný.`;
                                        }
                                        
                                    } else if (change.type === 'added') {
                                        // Ak je to nový používateľ a nie je to počiatočné načítanie
                                        message = `Nový používateľ ${userEmail} bol zaregistrovaný.`;
                                    } else if (change.type === 'removed') {
                                        message = `Používateľ ${userEmail} bol odstránený.`;
                                    }

                                    console.log("Header.js: Generovaná správa notifikácie:", message);

                                    if (message) {
                                        // Používame kombináciu userId a timestampu ako unikátny ID pre notifikáciu
                                        const notificationId = `${userId}_${change.type}_${new Date().getTime()}`;
                                        showPushNotification(message, notificationId);
                                        // *** ODSTRÁNENÉ UKLADANIE NOTIFIKÁCIE DO FIRESTORE Z TOHTO MIESTA ***
                                        // Ukladanie notifikácií bude prebiehať na stránkach, kde sa zmeny vykonávajú.
                                    }
                                    // Aktualizujeme cache po spracovaní zmeny
                                    usersCache[userId] = changedUserData;
                                });
                            }, error => {
                                console.error("Header.js: Chyba pri počúvaní zmien používateľov:", error);
                            });
                        } else {
                            console.log("Header.js: Používateľ nie je administrátor alebo nie je schválený. Listener na zmeny používateľov nebol nastavený.");
                        }
                    } else {
                        console.warn("Header.js: Používateľský dokument sa nenašiel pre UID:", currentHeaderUser.uid);
                    }
                } catch (e) {
                    console.error("Header.js: Chyba pri načítaní roly používateľa alebo nastavení listenera:", e);
                }
            }
        });

    } catch (e) {
        console.error("Header.js: Chyba pri inicializácii Firebase v hlavičke:", e);
    }

    // Spracovanie odhlásenia pre tlačidlo v hlavičke
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            if (authHeader) { // Používame authHeader
                try {
                    await authHeader.signOut();
                    // Po odhlásení zrušíme listener
                    if (unsubscribeUsersListener) {
                        unsubscribeUsersListener();
                        unsubscribeUsersListener = null;
                        initialUsersLoadComplete = false;
                        usersCache = {};
                        console.log("Header.js: Zrušený listener pre zmeny používateľov po odhlásení.");
                    }
                    window.location.href = 'login.html'; // Presmerovanie po odhlásení
                } catch (e) {
                    console.error("Header.js: Chyba pri odhlásení z hlavičky:", e);
                }
            }
        });
    }
}

// Sprístupnenie funkcie globálne, aby ju mohol volať register.html a iné stránky
window.initializeHeaderLogic = initializeHeaderLogic;

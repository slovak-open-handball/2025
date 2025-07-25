// header.js
// Tento súbor predpokladá, že __app_id, __firebase_config, __initial_auth_token a __firebase_app_name
// sú globálne definované v <head> hlavného HTML súboru.

// Inicializácia Firebase (ak už nie je inicializovaná iným skriptom)
let firebaseAppHeader;
let authHeader;
let dbHeader;
let unsubscribeAdminNotificationsListener = null; // Pre uloženie funkcie na zrušenie odberu notifikácií
let initialNotificationsLoadComplete = false; // Flag pre odlíšenie počiatočného načítania notifikácií
let notificationsCache = {}; // Cache na ukladanie stavu notifikácií pre detekciu zmien

// Pomocná funkcia na generovanie hashu zo stringu
function stringToHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return String(hash); // Ensure it returns a string
}

// Funkcia na zobrazenie push-up notifikácie
function showPushNotification(message, notificationId) {
    const notificationArea = document.getElementById('header-notification-area');
    if (!notificationArea) {
        console.error("Header.js: Element s ID 'header-notification-area' nebol nájdený.");
        return;
    }

    // Skontrolujeme, či táto notifikácia už bola zobrazená v tejto relácii (používame localStorage)
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

    // Bezpečný prístup k __app_id
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

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

            // Zrušenie predchádzajúceho listenera na notifikácie
            if (unsubscribeAdminNotificationsListener) {
                unsubscribeAdminNotificationsListener();
                unsubscribeAdminNotificationsListener = null;
                initialNotificationsLoadComplete = false; // Reset flag pri zmene používateľa/odhlásení
                notificationsCache = {}; // Vyčisti cache
                console.log("Header.js: Zrušený listener pre notifikácie admina.");
            }

            if (currentHeaderUser) {
                try {
                    const userDocRef = dbHeader.collection('users').doc(currentHeaderUser.uid);
                    let userDoc = await userDocRef.get();

                    // Check if it's a brand new user (creation time is very close to last sign-in time)
                    // This is a heuristic to detect if the user was just created by register.js
                    const isNewUser = currentHeaderUser.metadata.creationTime &&
                                      currentHeaderUser.metadata.lastSignInTime &&
                                      Math.abs(new Date(currentHeaderUser.metadata.creationTime).getTime() - new Date(currentHeaderUser.metadata.lastSignInTime).getTime()) < 5000; // 5 sekúnd tolerancie

                    if (!userDoc.exists && isNewUser) {
                        console.log(`Header.js: Používateľský dokument pre nového používateľa ${currentHeaderUser.uid} sa zatiaľ nenašiel. Čakám a skúšam znova...`);
                        // Introduce a small delay for Firestore write propagation
                        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
                        userDoc = await userDocRef.get(); // Try fetching again
                    }

                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        const userRole = userData.role;
                        const userApproved = userData.approved;
                        const passwordLastChanged = userData.passwordLastChanged;
                        const registeredAt = userData.registeredAt;

                        // Pomocná funkcia na kontrolu, či je hodnota platný Firestore Timestamp
                        const isValidFirestoreTimestamp = (value) => {
                            return value && typeof value.toDate === 'function';
                        };

                        // Kontrola passwordLastChanged
                        if (!isValidFirestoreTimestamp(passwordLastChanged)) {
                            console.warn("Header.js: 'passwordLastChanged' nie je platný Timestamp objekt.", { type: typeof passwordLastChanged, value: passwordLastChanged });

                            // Tolerancia pre novo registrovaných používateľov (až 10 minút)
                            const now = new Date();
                            const registeredDate = isValidFirestoreTimestamp(registeredAt) ? registeredAt.toDate() : null;
                            const isRecentlyRegistered = registeredDate && (now.getTime() - registeredDate.getTime() < 10 * 60 * 1000); // 10 minút tolerancie

                            if (isRecentlyRegistered) {
                                console.log("Header.js: Používateľ je novo registrovaný, dočasne tolerujem neplatný 'passwordLastChanged'.");
                                // Neprihlasovať okamžite pre nových používateľov
                            } else {
                                console.error("Header.js: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla a nie je novo registrovaný.");
                                await authHeader.signOut();
                                window.location.href = 'login.html';
                                return; // Zastaviť ďalšie vykonávanie
                            }
                        }

                        if (userRole === 'admin' && userApproved === true) {
                            console.log("Header.js: Prihlásený používateľ je schválený administrátor. Nastavujem listener na notifikácie admina.");
                            // Nastavenie listenera na nové, neprečítané notifikácie pre tohto admina alebo pre 'all_admins'
                            unsubscribeAdminNotificationsListener = dbHeader.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications')
                                .where('recipientId', 'in', [currentHeaderUser.uid, 'all_admins'])
                                .where('read', '==', false) // Len neprečítané notifikácie
                                .onSnapshot(snapshot => {
                                    if (!initialNotificationsLoadComplete) {
                                        // Pri prvom načítaní len naplníme cache a nastavíme flag
                                        snapshot.docs.forEach(doc => {
                                            notificationsCache[doc.id] = doc.data();
                                        });
                                        initialNotificationsLoadComplete = true;
                                        console.log("Header.js: Počiatočné načítanie neprečítaných notifikácií pre push-up dokončené.");
                                        return;
                                    }

                                    snapshot.docChanges().forEach(async change => {
                                        if (change.type === 'added') { // Zaujímajú nás len novo pridané neprečítané notifikácie
                                            const notificationData = change.doc.data();
                                            const notificationId = change.doc.id;
                                            
                                            console.log(`Header.js: Detekovaná nová neprečítaná notifikácia (ID: ${notificationId}).`);
                                            console.log("Header.js: Dáta notifikácie:", notificationData);

                                            const message = notificationData.message;
                                            if (message) {
                                                showPushNotification(message, notificationId);
                                                // Označíme notifikáciu ako prečítanú vo Firestore, aby sa už neopakovala
                                                try {
                                                    await dbHeader.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').doc(notificationId).update({
                                                        read: true
                                                    });
                                                    console.log(`Header.js: Notifikácia ${notificationId} označená ako prečítaná vo Firestore.`);
                                                } catch (updateError) {
                                                    console.error(`Header.js: Chyba pri označovaní notifikácie ${notificationId} ako prečítanej:`, updateError);
                                                }
                                            }
                                        }
                                    });
                                }, error => {
                                    console.error("Header.js: Chyba pri počúvaní notifikácií admina:", error);
                                });
                        } else {
                            console.log("Header.js: Používateľ nie je administrátor alebo nie je schválený. Listener na notifikácie admina nebol nastavený.");
                        }
                    } else {
                        console.error("Header.js: Používateľský dokument sa nenašiel ani po opakovanom pokuse pre UID:", currentHeaderUser.uid);
                        // Ak sa dokument používateľa nenašiel ani po oneskorení, odhláste ho z bezpečnostných dôvodov
                        await authHeader.signOut();
                        window.location.href = 'login.html';
                        return;
                    }
                } catch (e) {
                    console.error("Header.js: Chyba pri načítaní roly používateľa alebo nastavení listenera:", e);
                    // V prípade chyby pri načítaní dát používateľa odhláste
                    await authHeader.signOut();
                    window.location.href = 'login.html';
                    return;
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
                    if (unsubscribeAdminNotificationsListener) {
                        unsubscribeAdminNotificationsListener();
                        unsubscribeAdminNotificationsListener = null;
                        initialNotificationsLoadComplete = false;
                        notificationsCache = {};
                        console.log("Header.js: Zrušený listener pre notifikácie admina po odhlásení.");
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

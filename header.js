import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query, updateDoc, arrayUnion, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { countryDialCodes } from "./countryDialCodes.js";

let registrationCheckIntervalId = null;
let unsubscribeFromNotifications = null;
let unsubscribeFromUserSettings = null;
window.isRegistrationDataLoaded = false;
window.isCategoriesDataLoaded = false;
let isFirestoreListenersSetup = false; 
window.areCategoriesLoaded = false;
let notificationListenerSetupCount = 0;

// Globálna premenná pre aktuálny stav displayNotifications
let currentDisplayNotifications = false;
let currentUserId = null;

// Set pre sledovanie už zobrazených notifikácií
let shownNotificationIds = new Set();

window.showGlobalNotification = (message, type = 'success') => {
  let notificationElement = document.getElementById('global-notification');

  if (!notificationElement) {
    notificationElement = document.createElement('div');
    notificationElement.id = 'global-notification';
    notificationElement.className = `
      fixed top-4 left-1/2 transform -translate-x-1/2 z-[100]
      p-4 rounded-lg shadow-lg text-white font-semibold transition-all duration-300 ease-in-out
      flex items-center space-x-2
      opacity-0 pointer-events-none
    `;
    document.body.appendChild(notificationElement);
  }

  notificationElement.classList.remove('bg-red-600', 'bg-[#3A8D41]');
  
  if (type === 'success') {
    notificationElement.classList.add('bg-[#3A8D41]');
  } else {
    notificationElement.classList.add('bg-red-600');
  }

    setTimeout(() => {
        notificationElement.classList.add('opacity-100', 'pointer-events-auto');
    }, 10);

    setTimeout(() => {
        notificationElement.classList.remove('opacity-100', 'pointer-events-auto');
    }, 7500);
};

const formatPhoneNumber = (phoneNumber) => {
    const cleaned = phoneNumber.replace(/[^+\d]/g, '');
    let number = cleaned;

    const sortedDialCodes = countryDialCodes.sort((a, b) => b.dialCode.length - a.dialCode.length);
    let dialCode = '';

    for (const code of sortedDialCodes) {
        if (number.startsWith(code.dialCode)) {
            dialCode = code.dialCode;
            number = number.substring(dialCode.length);
            break;
        }
    }

    if (!dialCode) {
        return phoneNumber;
    }

    number = number.replace(/\s/g, '');

    let formattedNumber = '';
    while (number.length > 0) {
        formattedNumber += number.substring(0, 3);
        number = number.substring(3);
        if (number.length > 0) {
            formattedNumber += ' ';
        }
    }

    return `${dialCode} ${formattedNumber}`.trim();
};

const formatNotificationMessage = (text) => {
    // Rozdelenie textu na časti podľa apostrofov
    const parts = text.split("'");
    
    // Ak nemáme dostatok častí, vrátime pôvodný text
    if (parts.length < 5) {
        return text;
    }

    // Prvá časť (pred prvým apostrofom)
    let formattedText = parts[0];
    
    // Prejdeme všetky páry apostrofov
    for (let i = 1; i < parts.length - 1; i += 2) {
        const value = parts[i];
        const nextPart = parts[i + 1];
        
        // Formátujeme podľa poradia
        if (i === 1) {
            // Prvý pár - šikmo
            formattedText += `<em>${value}</em>`;
        } else if (i === 3) {
            // Druhý pár - bold
            formattedText += `<strong>${value}</strong>`;
        } else {
            // Ostatné páry - normálne
            formattedText += value;
        }
        
        // Pridáme text za apostrofom
        formattedText += nextPart;
    }
    
    // Ak máme nejaké polia navyše, pridáme ich ako nový riadok
    if (parts.length > 5) {
        // Zistíme, či ide o hromadnú notifikáciu s viacerými zmenami
        const changes = [];
        
        // Prejdeme všetky zvyšné časti
        for (let i = 5; i < parts.length - 1; i += 2) {
            if (i + 1 < parts.length) {
                const fieldName = parts[i - 1]?.trim() || '';
                const oldValue = parts[i];
                const newValue = parts[i + 2];
                
                if (oldValue && newValue) {
                    changes.push(`${fieldName} z <em>${oldValue}</em> na <strong>${newValue}</strong>`);
                }
                i += 2;
            }
        }
        
        if (changes.length > 0) {
            formattedText += '<br>' + changes.join('<br>');
        }
    }
    
    // Formátovanie telefónnych čísel
    formattedText = formattedText.replace(/(<em>|\+?[0-9\s]+<\/em>)/g, (match) => {
        if (match.includes('+')) {
            const number = match.replace(/<\/?em>/g, '');
            return `<em>${formatPhoneNumber(number)}</em>`;
        }
        return match;
    });
    
    formattedText = formattedText.replace(/(<strong>|\+?[0-9\s]+<\/strong>)/g, (match) => {
        if (match.includes('+')) {
            const number = match.replace(/<\/?strong>/g, '');
            return `<strong>${formatPhoneNumber(number)}</strong>`;
        }
        return match;
    });
    
    return formattedText;
};

const showDatabaseNotification = (message, type = 'info') => {
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.className = `
            fixed top-4 right-4 z-[100]
            flex flex-col space-y-2
        `;
        document.body.appendChild(notificationContainer);
    }
    
    const notificationId = `db-notification-${Date.now()}`;
    const notificationElement = document.createElement('div');
    
    notificationElement.id = notificationId;
    notificationElement.className = `
        bg-gray-800 text-white p-4 pr-10 rounded-lg shadow-lg
        transform translate-x-full transition-all duration-500 ease-out
        flex flex-col items-start space-y-1
    `;

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '🔔';
    
    // Spracovanie správy - rozdelenie podľa e-mailu a jednotlivých zmien
    let formattedMessage = message;
    
    // Ak správa začína "Používateľ ...:", extrahujeme e-mail a zvyšok
    const userMatch = message.match(/^(Používateľ [^:]+:)(.*)$/s);
    
    if (userMatch) {
        const userInfo = userMatch[1].trim();
        const restOfMessage = userMatch[2].trim();
        
        // Formátujeme hlavnú časť správy
        const formattedRest = formatNotificationMessage(restOfMessage);
        
        // Zobrazenie: e-mail na prvom riadku, zmeny pod ním
        formattedMessage = `
            <div class="font-semibold text-blue-300">${userInfo}</div>
            <div class="mt-1">${formattedRest}</div>
        `;
    } else {
        // Ak nejde o používateľskú notifikáciu, normálne naformátujeme
        formattedMessage = formatNotificationMessage(message);
    }

    notificationElement.innerHTML = `
        <div class="flex items-start space-x-2 w-full">
            <span>${icon}</span>
            <div class="flex-1">${formattedMessage}</div>
            <button onclick="document.getElementById('${notificationId}').remove()" class="absolute top-1 right-1 text-gray-400 hover:text-white">&times;</button>
        </div>
    `;

    notificationContainer.appendChild(notificationElement);

    setTimeout(() => {
        notificationElement.classList.remove('translate-x-full');
    }, 10);

    setTimeout(() => {
        notificationElement.classList.add('translate-x-full');
        setTimeout(() => notificationElement.remove(), 500);
    }, 7000);
};

const handleLogout = async () => {
    try {
        const auth = getAuth();
        await signOut(auth);
        console.log("header.js: Používateľ bol úspešne odhlásený.");
        
        if (unsubscribeFromNotifications) {
            unsubscribeFromNotifications();
            unsubscribeFromNotifications = null;
            console.log("header.js: Listener notifikácií zrušený.");
        }
        
        if (unsubscribeFromUserSettings) {
            unsubscribeFromUserSettings();
            unsubscribeFromUserSettings = null;
            console.log("header.js: Listener nastavení používateľa zrušený.");
        }
        
        shownNotificationIds.clear();
        
        currentUserId = null;
        currentDisplayNotifications = false;
        
        window.location.href = 'login.html';
    } catch (error) {
        console.error("header.js: Chyba pri odhlásení:", error);
        window.showGlobalNotification('Chyba pri odhlásení. Skúste to znova.', 'error');
    }
};

const getHeaderColorByRole = (role) => {
  switch (role) {
    case 'admin':
      return '#47b3ff';
    case 'hall':
      return '#b06835';
    case 'club':
      return '#9333EA';
    case 'referee':
      return '#007800';
    case 'volunteer':
      return '#FFAC1C';
    default:
      return '#1D4ED8';
    }
}

const setupUserSettingsListener = (userId) => {
    if (!window.db || !userId) {
        console.warn("header.js: Chýba db alebo userId pre nastavenie listenera používateľa.");
        return null;
    }
    
    if (unsubscribeFromUserSettings) {
        unsubscribeFromUserSettings();
        unsubscribeFromUserSettings = null;
    }
    
    console.log("%c📋 HEADER.JS: Nastavujem listener pre zmeny nastavení používateľa:", "background: #ffa500; color: black;", userId);
    
    const userDocRef = doc(window.db, 'users', userId);
    
    return onSnapshot(userDocRef, (docSnap) => {
        console.log("%c📋 HEADER.JS: Listener nastavení - dostal som update z databázy!", "background: #ffa500; color: black;");
        if (docSnap.exists()) {
            const userData = docSnap.data();
            console.log("   Data z databázy:", userData);
            
            if (userData.hasOwnProperty('displayNotifications')) {
                const oldValue = currentDisplayNotifications;
                currentDisplayNotifications = userData.displayNotifications;
                
                console.log("%c🔔 DISPLAY NOTIFICATIONS ZMENENÉ 🔔", "background: #47b3ff; color: white; font-size: 14px; font-weight: bold; padding: 4px; border-radius: 4px;");
                console.log("%c   Stará hodnota:", "color: #ff6b6b; font-weight: bold;", oldValue);
                console.log("%c   Nová hodnota: ", "color: #51cf66; font-weight: bold;", currentDisplayNotifications);
                console.log("%c   Zdroj:        onSnapshot listener (databáza)", "color: #47b3ff;");
                console.log("--------------------------------------------------");
            } else {
                const oldValue = currentDisplayNotifications;
                currentDisplayNotifications = false;
                
                console.log("%c🔔 DISPLAY NOTIFICATIONS - PREDVOLENÁ HODNOTA 🔔", "background: #ff6b6b; color: white; font-size: 14px; font-weight: bold; padding: 4px; border-radius: 4px;");
                console.log("%c   Pole displayNotifications neexistuje v databáze", "color: #ff6b6b;");
                console.log("%c   Stará hodnota:", "color: #ff6b6b; font-weight: bold;", oldValue);
                console.log("%c   Nová hodnota: ", "color: #51cf66; font-weight: bold;", currentDisplayNotifications);
                console.log("--------------------------------------------------");
            }
            
            if (window.globalUserProfileData) {
                window.globalUserProfileData.displayNotifications = currentDisplayNotifications;
            }
        } else {
            console.warn("header.js: Dokument používateľa neexistuje!");
        }
    }, (error) => {
        console.error("header.js: Chyba pri počúvaní nastavení používateľa:", error);
    });
};

const loadInitialDisplayNotifications = async (userId) => {
    // Ak už máme aktuálnu hodnotu pre tohto používateľa, nevoláme databázu
    if (currentUserId === userId && currentDisplayNotifications !== false) {
        console.log("%c📋 HEADER.JS: Používam existujúcu hodnotu displayNotifications", "background: #845ef7; color: white;");
        return currentDisplayNotifications;
    }
    
    console.log("%c📋 HEADER.JS: loadInitialDisplayNotifications volaná pre userId:", "background: #845ef7; color: white;", userId);
    
    if (!window.db || !userId) {
        console.warn("header.js: Chýba db alebo userId pre načítanie nastavení.");
        return false;
    }
    
    try {
        const userDocRef = doc(window.db, 'users', userId);
        console.log("   Volám getDoc pre:", userDocRef.path);
        
        const userSnap = await getDoc(userDocRef);
        console.log("   getDoc dokončený, exists:", userSnap.exists());
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log("   Dáta z getDoc:", userData);
            
            const initialValue = userData.displayNotifications || false;
            console.log("   displayNotifications hodnota z databázy:", userData.displayNotifications);
            console.log("   initialValue (po || false):", initialValue);
            
            currentDisplayNotifications = initialValue;
            
            console.log("%c🔔 DISPLAY NOTIFICATIONS - POČIATOČNÉ NAČÍTANIE 🔔", "background: #845ef7; color: white; font-size: 14px; font-weight: bold; padding: 4px; border-radius: 4px;");
            console.log("%c   ✅ ÚSPEŠNE NAČÍTANÉ Z DATABÁZY", "color: #51cf66; font-weight: bold;");
            console.log("%c   Hodnota:       ", "color: #51cf66; font-weight: bold;", currentDisplayNotifications);
            console.log("%c   ID používateľa:", "color: #888;", userId);
            console.log("--------------------------------------------------");
            
            return initialValue;
        } else {
            console.warn("header.js: Dokument používateľa neexistuje!");
        }
    } catch (e) {
        console.error("header.js: Chyba pri načítaní počiatočnej hodnoty displayNotifications:", e);
    }
    return false;
};

const updateHeaderLinks = (userProfileData) => {
    console.log("%c📋 HEADER.JS: updateHeaderLinks volaná", "background: #1D4ED8; color: white;");
    console.log("   userProfileData:", userProfileData);
    
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const headerElement = document.querySelector('header');
    
    if (!authLink || !profileLink || !logoutButton || !headerElement) {
        console.error("header.js: Niektoré elementy hlavičky neboli nájdené.");
        return;
    }

    if (window.location.pathname.includes('register.html')) {
        headerElement.style.backgroundColor = '#1D4ED8'; 
        headerElement.classList.remove('invisible'); 
        authLink.classList.remove('hidden');
        profileLink.classList.add('hidden');
        logoutButton.classList.add('hidden');
        const registerLink = document.getElementById('register-link');
        if (registerLink) {
            registerLink.classList.add('hidden');
        }
        return;
    }

    if (window.isGlobalAuthReady && window.isRegistrationDataLoaded && window.isCategoriesDataLoaded) {
        console.log("   Podmienky splnené, pokračujem...");
        
        if (userProfileData) {
            console.log("   userProfileData existuje, uid:", userProfileData.id);
            
            authLink.classList.add('hidden');
            profileLink.classList.remove('hidden');
            logoutButton.classList.remove('hidden');
            headerElement.style.backgroundColor = getHeaderColorByRole(userProfileData.role);

            // IBA AK SA ZMENIL POUŽÍVATEĽ - nastavíme listenery
            if (userProfileData.id && currentUserId !== userProfileData.id) {
                console.log("%c🔄 POUŽÍVATEĽ ZMENENÝ - nastavujem listenery", "background: #ff9800; color: black;");
                
                currentUserId = userProfileData.id;
                
                // Načítame počiatočné nastavenia
                loadInitialDisplayNotifications(userProfileData.id).then((initialValue) => {
                    console.log("%c📋 HEADER.JS: loadInitialDisplayNotifications dokončené", "background: #845ef7; color: white;", initialValue);
                    
                    // Zrušíme starý listener nastavení
                    if (unsubscribeFromUserSettings) {
                        unsubscribeFromUserSettings();
                        unsubscribeFromUserSettings = null;
                    }
                    
                    // Nastavíme nový listener nastavení
                    unsubscribeFromUserSettings = setupUserSettingsListener(userProfileData.id);
                    
                    // Zrušíme starý listener notifikácií
                    if (unsubscribeFromNotifications) {
                        unsubscribeFromNotifications();
                        unsubscribeFromNotifications = null;
                    }
                    
                    // Vyčistíme Set zobrazených notifikácií
                    shownNotificationIds.clear();
                    
                    // Nastavíme listener notifikácií IBA pre adminov
                    if (userProfileData.role === 'admin') {
                        console.log("   Používateľ je admin, nastavujem listener notifikácií...");
                        setupNotificationListenerForAdmin(userProfileData);
                    }
                }).catch(error => {
                    console.error("   CHYBA pri loadInitialDisplayNotifications:", error);
                });
            } else {
                console.log("   Používateľ sa nezmenil, preskakujem reinicializáciu listenerov");
            }

        } else {
            console.log("   userProfileData je null, odhlasujem používateľa");
            
            authLink.classList.remove('hidden');
            profileLink.classList.add('hidden');
            logoutButton.classList.add('hidden');
            headerElement.style.backgroundColor = getHeaderColorByRole(null);
            
            // Vyčistenie všetkých listenerov
            if (unsubscribeFromNotifications) {
                unsubscribeFromNotifications();
                unsubscribeFromNotifications = null;
            }
            
            if (unsubscribeFromUserSettings) {
                unsubscribeFromUserSettings();
                unsubscribeFromUserSettings = null;
            }
            
            shownNotificationIds.clear();
            currentUserId = null;
            currentDisplayNotifications = false;
        }

        updateRegistrationLinkVisibility(userProfileData);
        headerElement.classList.remove('invisible');
    } else {
        console.log("   Podmienky NIE SÚ splnené, čakám...");
        console.log("   window.isGlobalAuthReady:", window.isGlobalAuthReady);
        console.log("   window.isRegistrationDataLoaded:", window.isRegistrationDataLoaded);
        console.log("   window.isCategoriesDataLoaded:", window.isCategoriesDataLoaded);
    }
};

const updateRegistrationLinkVisibility = (userProfileData) => {
    const registerLink = document.getElementById('register-link');
    if (!registerLink) return;

    if (userProfileData) {
        registerLink.classList.add('hidden');
        return;
    }

    const isRegistrationOpen = window.registrationDates && new Date() >= window.registrationDates.registrationStartDate.toDate() && new Date() <= window.registrationDates.registrationEndDate.toDate();
    const hasCategories = window.hasCategories;

    if (isRegistrationOpen && hasCategories) {
        registerLink.classList.remove('hidden');
        if (userProfileData) { 
            registerLink.href = 'logged-in-registration.html';
        } else {
            registerLink.href = 'register.html';
        }
    } else {
        registerLink.classList.add('hidden');
    }
};

const setupNotificationListenerForAdmin = (userProfileData) => {
    // Kontrola, či už listener nie je nastavený
    if (unsubscribeFromNotifications) {
        console.log("   Listener notifikácií už je nastavený, preskakujem...");
        return;
    }
    
    notificationListenerSetupCount++;
    console.log(`%c📋 HEADER.JS: ========== SPÚŠŤAM LISTENER NOTIFIKÁCIÍ ==========`, "background: #47b3ff; color: white; font-size: 14px;");
    console.log(`   Volanie #${notificationListenerSetupCount}`);
    console.log(`   Aktuálny stav displayNotifications: ${currentDisplayNotifications ? '✅ ZAPNUTÉ' : '❌ VYPNUTÉ'}`);
    console.log(`========================================`);
    
    if (!window.db) {
        console.warn("header.js: Firestore databáza nie je inicializovaná pre notifikácie.");
        return;
    }
    
    const notificationsCollectionRef = collection(window.db, "notifications");
    console.log("   Nastavujem onSnapshot pre collection:", notificationsCollectionRef.path);
    
    unsubscribeFromNotifications = onSnapshot(notificationsCollectionRef, async (snapshot) => {
        console.log("%c📋 HEADER.JS: Listener notifikácií - dostal som update!", "background: #47b3ff; color: white;");
        
        const auth = getAuth();
        const userId = auth.currentUser ? auth.currentUser.uid : null;

        if (!userId) {
            console.log("   Žiadny prihlásený používateľ, preskakujem");
            return;
        }

        let unreadCount = 0;
        const allNotifications = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));

        allNotifications.forEach(notification => {
            const seenBy = notification.data.seenBy || [];
            if (!seenBy.includes(userId)) {
                unreadCount++;
            }
        });

        if (window.globalUserProfileData) {
            window.globalUserProfileData.unreadNotificationCount = unreadCount;
            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: window.globalUserProfileData }));
        }

        console.log("%c🔍 KONTROLA DISPLAY NOTIFICATIONS", "background: #47b3ff; color: white; font-size: 13px; font-weight: bold; padding: 3px; border-radius: 3px;");
        console.log(`%c   Hodnota z databázy: ${currentDisplayNotifications}`, currentDisplayNotifications ? "color: #51cf66; font-weight: bold;" : "color: #ff6b6b; font-weight: bold;");
        console.log(`%c   Výsledok: ${currentDisplayNotifications ? '✅ Zobrazujem notifikácie' : '❌ Notifikácie sú vypnuté'}`, currentDisplayNotifications ? "color: #51cf66;" : "color: #ff6b6b;");
        console.log("--------------------------------------------------");
        
        if (!currentDisplayNotifications) {
            console.log("   Notifikácie sú vypnuté, končím spracovanie");
            return;
        }

        if (unreadCount >= 3) {
            let message = '';
            if (unreadCount >= 5) {
                message = `Máte ${unreadCount} nových neprečítaných upozornení.`;
            } else { 
                message = `Máte ${unreadCount} nové neprečítané upozornenia.`;
            }
            console.log("   Zobrazujem hromadnú notifikáciu:", message);
            showDatabaseNotification(message, 'info');
        }

        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                if (!currentDisplayNotifications) {
                    return;
                }
                
                const newNotification = change.doc.data();
                const notificationId = change.doc.id;
                
                const seenBy = newNotification.seenBy || [];
                
                if (!seenBy.includes(userId) && !shownNotificationIds.has(notificationId)) {
                    console.log("header.js: Nová notifikácia prijatá, ešte nebola videná:", notificationId);
                    
                    shownNotificationIds.add(notificationId);
                    
                    let changesMessage = '';
                    
                    if (newNotification.changes) {
                        if (Array.isArray(newNotification.changes) && newNotification.changes.length > 0) {
                            changesMessage = newNotification.changes[0];
                        } else if (typeof newNotification.changes === 'string') {
                            changesMessage = newNotification.changes;
                        }
                    } else if (newNotification.message) {
                        changesMessage = newNotification.message;
                    } else if (newNotification.content) {
                        changesMessage = newNotification.content;
                    } else {
                        changesMessage = 'Nová notifikácia';
                    }
                    
                    if (newNotification.userEmail) {
                        changesMessage = `Používateľ ${newNotification.userEmail}: ${changesMessage}`;
                    }
                    
                    console.log("header.js: Zobrazujem notifikáciu:", changesMessage);
                    showDatabaseNotification(changesMessage, newNotification.type || 'info');
                    
                    const notificationDocRef = doc(window.db, "notifications", notificationId);
                    try {
                        await updateDoc(notificationDocRef, {
                            seenBy: arrayUnion(userId)
                        });
                    } catch (e) {
                        console.error("header.js: Chyba pri aktualizácii notifikácie 'seenBy':", e);
                    }
                }
            }
        });
    }, (error) => {
            console.error("header.js: Chyba pri počúvaní notifikácií:", error);
    });

    console.log("header.js: Listener pre notifikácie admina nastavený.");
};

const setupFirestoreListeners = () => {
    console.log("%c📋 HEADER.JS: setupFirestoreListeners volaná", "background: #1D4ED8; color: white;");
    
    if (!window.db) {
        console.warn("header.js: Firestore databáza nie je inicializovaná. Odkladám nastavenie listenerov.");
        return; 
    }

    if (isFirestoreListenersSetup) {
        console.log("header.js: Listenery Firestore sú už nastavené.");
        return;
    }

    try {
        console.log("   Nastavujem listener pre settings/registration");
        const registrationDocRef = doc(window.db, "settings", "registration");
        onSnapshot(registrationDocRef, (docSnap) => {
            console.log("   Listener registration - dostal som update");
            if (docSnap.exists()) {
                window.registrationDates = docSnap.data();
                console.log("header.js: Dáta o registrácii aktualizované (onSnapshot).", window.registrationDates);
            } else {
                window.registrationDates = null;
                console.warn("header.js: Dokument 'settings/registration' nebol nájdený!");
            }
            window.isRegistrationDataLoaded = true; 
            updateHeaderLinks(window.globalUserProfileData);
        }, (error) => {
            console.error("header.js: Chyba pri počúvaní dát o registrácii:", error);
            window.isRegistrationDataLoaded = true;
            updateHeaderLinks(window.globalUserProfileData);
        });

        console.log("   Nastavujem listener pre settings/categories");
        const categoriesDocRef = doc(window.db, "settings", "categories");
        onSnapshot(categoriesDocRef, (docSnap) => {
            console.log("   Listener categories - dostal som update");
            if (docSnap.exists()) {
                const categories = docSnap.data();
                window.hasCategories = Object.keys(categories).length > 0;
                console.log(`header.js: Dáta kategórií aktualizované (onSnapshot). Počet kategórií: ${Object.keys(categories).length}`);
            } else {
                window.hasCategories = false;
                console.warn("header.js: Dokument 'settings/categories' nebol nájdený!");
            }
            window.isCategoriesDataLoaded = true;
            window.areCategoriesLoaded = true;
            window.dispatchEvent(new CustomEvent('categoriesLoaded'));
            console.log("header.js: Odoslaná udalosť 'categoriesLoaded'.");
            updateHeaderLinks(window.globalUserProfileData);
        }, (error) => {
            console.error("header.js: Chyba pri počúvaní dát o kategóriách:", error);
            window.isCategoriesDataLoaded = true;
            window.areCategoriesLoaded = true;
            window.dispatchEvent(new CustomEvent('categoriesLoaded'));
            console.log("header.js: Odoslaná udalosť 'categoriesLoaded' (s chybou).");
            updateHeaderLinks(window.globalUserProfileData);
        });

        if (registrationCheckIntervalId) {
            clearInterval(registrationCheckIntervalId);
        }
        registrationCheckIntervalId = setInterval(() => {
            if (window.registrationDates) {
                updateRegistrationLinkVisibility(window.globalUserProfileData);
            }
        }, 1000); 
        console.log("header.js: Časovač pre kontrolu registrácie spustený.");
        
        window.addEventListener('beforeunload', () => {
            if (registrationCheckIntervalId) {
                clearInterval(registrationCheckIntervalId);
                console.log("header.js: Časovač pre kontrolu registrácie zrušený.");
            }
            
            if (unsubscribeFromNotifications) {
                unsubscribeFromNotifications();
            }
            if (unsubscribeFromUserSettings) {
                unsubscribeFromUserSettings();
            }
        });

        isFirestoreListenersSetup = true;
        console.log("header.js: Firestore listenery boli úspešne nastavené.");

    } catch (error) {
        console.error("header.js: Chyba pri inicializácii listenerov Firestore:", error);
    }
};

window.loadHeaderAndScripts = async () => {
    console.log("%c📋 HEADER.JS: loadHeaderAndScripts spustená", "background: #1D4ED8; color: white; font-size: 16px;");
    
    try {
        const headerPlaceholder = document.getElementById('header-placeholder');
        console.log("   headerPlaceholder nájdený:", headerPlaceholder ? "áno" : "nie");
        
        const response = await fetch('header.html');
        console.log("   fetch header.html response status:", response.status);
        
        if (!response.ok) throw new Error('Chyba pri načítaní header.html');
        const headerHtml = await response.text();
        console.log("   header.html načítaný, dĺžka:", headerHtml.length);
        
        if (headerPlaceholder) {
            headerPlaceholder.innerHTML = headerHtml;
            console.log("   header.html vložený do placeholderu");
        }

        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
            console.log("header.js: Listener pre tlačidlo odhlásenia bol pridaný.");
        } else {
            console.warn("header.js: Tlačidlo logout-button nebolo nájdené!");
        }

        window.addEventListener('globalDataUpdated', (event) => {
            console.log('%c📋 HEADER.JS: Prijatá udalosť "globalDataUpdated"', "background: #1D4ED8; color: white;");
            console.log("   event.detail:", event.detail);
            window.isGlobalAuthReady = true; 
            setupFirestoreListeners();
            updateHeaderLinks(event.detail);
        });

        if (window.isGlobalAuthReady) {
             console.log('header.js: Autentifikačné dáta sú už načítané, spúšťam listenery Firestore.');
             console.log("   window.globalUserProfileData:", window.globalUserProfileData);
             setupFirestoreListeners();
             updateHeaderLinks(window.globalUserProfileData);
        } else {
            console.log("header.js: Čakám na globalDataUpdated event...");
        }

    } catch (error) {
        console.error("header.js: Chyba pri inicializácii hlavičky:", error);
    }
};

if (document.readyState === 'loading') {
    console.log("header.js: Dokument sa načítava, pridávam event listener pre DOMContentLoaded");
    window.addEventListener('DOMContentLoaded', window.loadHeaderAndScripts);
} else {
    console.log("header.js: Dokument už je načítaný, spúšťam loadHeaderAndScripts okamžite");
    window.loadHeaderAndScripts();
}

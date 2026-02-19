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
    // Ak je text pole, spracujeme každý prvok zvlášť
    if (Array.isArray(text)) {
        return text.map(item => formatNotificationMessage(item)).join('<br>');
    }
    
    // Pôvodné spracovanie reťazca
    const parts = text.split("'");
    
    if (parts.length < 5) {
        return text;
    }

    let formattedText = parts[0];
    
    for (let i = 1; i < parts.length - 1; i += 2) {
        const value = parts[i];
        const nextPart = parts[i + 1];
        
        if (i === 1) {
            formattedText += `<em>${value}</em>`;
        } else if (i === 3) {
            formattedText += `<strong>${value}</strong>`;
        } else {
            formattedText += value;
        }
        
        formattedText += nextPart;
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
    if (Array.isArray(message)) {
        message = message.join('<br>');
    }
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
        
    const userDocRef = doc(window.db, 'users', userId);
    
    return onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            
            if (userData.hasOwnProperty('displayNotifications')) {
                const oldValue = currentDisplayNotifications;
                currentDisplayNotifications = userData.displayNotifications;                
            } else {
                const oldValue = currentDisplayNotifications;
                currentDisplayNotifications = false;                
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
    if (currentUserId === userId && currentDisplayNotifications !== false) {
        return currentDisplayNotifications;
    }    
    if (!window.db || !userId) {
        console.warn("header.js: Chýba db alebo userId pre načítanie nastavení.");
        return false;
    }
    
    try {
        const userDocRef = doc(window.db, 'users', userId);        
        const userSnap = await getDoc(userDocRef);        
        if (userSnap.exists()) {
            const userData = userSnap.data();            
            const initialValue = userData.displayNotifications || false;            
            currentDisplayNotifications = initialValue;            
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
        if (userProfileData) {            
            authLink.classList.add('hidden');
            profileLink.classList.remove('hidden');
            logoutButton.classList.remove('hidden');
            headerElement.style.backgroundColor = getHeaderColorByRole(userProfileData.role);
            if (userProfileData.id && currentUserId !== userProfileData.id) {                
                currentUserId = userProfileData.id;                
                loadInitialDisplayNotifications(userProfileData.id).then((initialValue) => {                    
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
                        setupNotificationListenerForAdmin(userProfileData);
                    }
                }).catch(error => {
                    console.error("   CHYBA pri loadInitialDisplayNotifications:", error);
                });
            } 
        } else {            
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
    if (unsubscribeFromNotifications) {
        return;
    }    
    notificationListenerSetupCount++;    
    if (!window.db) {
        console.warn("header.js: Firestore databáza nie je inicializovaná pre notifikácie.");
        return;
    }    
    const notificationsCollectionRef = collection(window.db, "notifications");    
    unsubscribeFromNotifications = onSnapshot(notificationsCollectionRef, async (snapshot) => {        
        const auth = getAuth();
        const userId = auth.currentUser ? auth.currentUser.uid : null;
        if (!userId) {
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
        if (!currentDisplayNotifications) {
            return;
        }
        if (unreadCount >= 3) {
            let message = '';
            if (unreadCount >= 5) {
                message = `Máte ${unreadCount} nových neprečítaných upozornení.`;
            } else { 
                message = `Máte ${unreadCount} nové neprečítané upozornenia.`;
            }
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
                    shownNotificationIds.add(notificationId);                    
                    
                    let changesMessage = '';
                    
                    // === JEDNODUCHŠIE SPRACOVANIE ===
                    if (newNotification.changes) {
                        if (Array.isArray(newNotification.changes)) {
                            // Ak je to pole, vezmeme ho ako celok - formatNotificationMessage si poradí
                            changesMessage = newNotification.changes;
                        } else {
                            changesMessage = String(newNotification.changes);
                        }
                    } else if (newNotification.message) {
                        changesMessage = newNotification.message;
                    } else if (newNotification.content) {
                        changesMessage = newNotification.content;
                    } else {
                        changesMessage = 'Nová notifikácia';
                    }
                    
                    if (newNotification.userEmail) {
                        // Ak je changesMessage pole, pridáme email ku každému prvku?
                        if (Array.isArray(changesMessage)) {
                            changesMessage = changesMessage.map(msg => 
                                `Používateľ ${newNotification.userEmail}: ${msg}`
                            );
                        } else {
                            changesMessage = `Používateľ ${newNotification.userEmail}: ${changesMessage}`;
                        }
                    }                    
                    
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
        console.error("", error);
    });
};

const setupFirestoreListeners = () => {    
    if (!window.db) {
        console.warn("header.js: Firestore databáza nie je inicializovaná. Odkladám nastavenie listenerov.");
        return; 
    }
    if (isFirestoreListenersSetup) {
        return;
    }

    try {
        const registrationDocRef = doc(window.db, "settings", "registration");
        onSnapshot(registrationDocRef, (docSnap) => {
            if (docSnap.exists()) {
                window.registrationDates = docSnap.data();
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
        const categoriesDocRef = doc(window.db, "settings", "categories");
        onSnapshot(categoriesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const categories = docSnap.data();
                window.hasCategories = Object.keys(categories).length > 0;
            } else {
                window.hasCategories = false;
                console.warn("header.js: Dokument 'settings/categories' nebol nájdený!");
            }
            window.isCategoriesDataLoaded = true;
            window.areCategoriesLoaded = true;
            window.dispatchEvent(new CustomEvent('categoriesLoaded'));
            updateHeaderLinks(window.globalUserProfileData);
        }, (error) => {
            console.error("header.js: Chyba pri počúvaní dát o kategóriách:", error);
            window.isCategoriesDataLoaded = true;
            window.areCategoriesLoaded = true;
            window.dispatchEvent(new CustomEvent('categoriesLoaded'));
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
        
        window.addEventListener('beforeunload', () => {
            if (registrationCheckIntervalId) {
                clearInterval(registrationCheckIntervalId);
            }
            
            if (unsubscribeFromNotifications) {
                unsubscribeFromNotifications();
            }
            if (unsubscribeFromUserSettings) {
                unsubscribeFromUserSettings();
            }
        });

        isFirestoreListenersSetup = true;

    } catch (error) {
        console.error("header.js: Chyba pri inicializácii listenerov Firestore:", error);
    }
};

window.loadHeaderAndScripts = async () => {
    
    try {
        const headerPlaceholder = document.getElementById('header-placeholder');
        
        const response = await fetch('header.html');
        
        if (!response.ok) throw new Error('Chyba pri načítaní header.html');
        const headerHtml = await response.text();
        
        if (headerPlaceholder) {
            headerPlaceholder.innerHTML = headerHtml;
        }

        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        } else {
            console.warn("header.js: Tlačidlo logout-button nebolo nájdené!");
        }
        window.addEventListener('globalDataUpdated', (event) => {
            window.isGlobalAuthReady = true; 
            setupFirestoreListeners();
            updateHeaderLinks(event.detail);
        });
        if (window.isGlobalAuthReady) {
             setupFirestoreListeners();
             updateHeaderLinks(window.globalUserProfileData);
        }
    } catch (error) {
        console.error("header.js: Chyba pri inicializácii hlavičky:", error);
    }
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', window.loadHeaderAndScripts);
} else {
    window.loadHeaderAndScripts();
}

import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query, updateDoc, arrayUnion, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { countryDialCodes } from "./countryDialCodes.js";

let registrationCheckIntervalId = null;
let unsubscribeFromNotifications = null;
let unsubscribeFromUserSettings = null;
let unsubscribeFromPagesVisibility = null;
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

// Globálna premenná pre viditeľnosť stránok
let pagesVisibility = {};

/**
 * Kontroluje, či je používateľ "skutočne" prihlásený (email používateľ, nie anonymný)
 * @returns {boolean} - true pre email používateľa, false pre anonymného alebo neprihláseného
 */
const isReallyLoggedIn = () => {
    if (!window.globalUserProfileData) return false;
    if (window.isAnonymousUser === true) return false;
    if (window.globalUserProfileData.role === 'anonymous') return false;
    return true;
};

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
    if (Array.isArray(text)) {
        return text.map(item => formatNotificationMessage(item)).join('<br>');
    }
    
    const parts = text.split("'");
    
    if (parts.length < 3) {
        return text;
    }

    let formattedText = parts[0];
    
    for (let i = 1; i < parts.length; i++) {
        if (i % 2 === 1) {
            const pairIndex = Math.floor(i / 2) + 1;
            
            if (pairIndex % 2 === 1) {
                formattedText += `<em>${parts[i]}</em>`;
            } else {
                formattedText += `<strong>${parts[i]}</strong>`;
            }
        } else {
            formattedText += parts[i];
        }
    }
    
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
    
    const formattedMessage = formatNotificationMessage(message);

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
        
        if (unsubscribeFromPagesVisibility) {
            unsubscribeFromPagesVisibility();
            unsubscribeFromPagesVisibility = null;
        }
        
        shownNotificationIds.clear();
        
        currentUserId = null;
        currentDisplayNotifications = false;
        
        window.location.href = 'login.html';
    } catch (error) {
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
                currentDisplayNotifications = userData.displayNotifications;                
            } else {
                currentDisplayNotifications = false;                
            }
            
            if (window.globalUserProfileData) {
                window.globalUserProfileData.displayNotifications = currentDisplayNotifications;
            }
        } 
    }, (error) => {
    });
};

const loadInitialDisplayNotifications = async (userId) => {
    if (currentUserId === userId && currentDisplayNotifications !== false) {
        return currentDisplayNotifications;
    }    
    if (!window.db || !userId) {
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
        } 
    } catch (e) {
    }
    return false;
};

// Načítanie viditeľnosti stránok z Firestore
const loadPagesVisibility = async () => {
    if (!window.db) {
        return;
    }

    try {
        const pagesRef = collection(window.db, 'pages');
        const pagesSnapshot = await getDocs(pagesRef);
        
        pagesVisibility = {};
        
        if (!pagesSnapshot.empty) {
            pagesSnapshot.forEach(doc => {
                const data = doc.data();
                pagesVisibility[doc.id] = {
                    visible: data.visible !== undefined ? data.visible : false,
                    label: data.label || doc.id
                };
            });
        }       
        
        // Aktualizujeme navigáciu po načítaní viditeľnosti stránok
        updateNavigationLinks();
    } catch (error) {
    }
};

// Nastavenie listenera pre zmeny viditeľnosti stránok
const setupPagesVisibilityListener = () => {
    if (!window.db) {
        return;
    }

    if (unsubscribeFromPagesVisibility) {
        unsubscribeFromPagesVisibility();
        unsubscribeFromPagesVisibility = null;
    }

    const pagesRef = collection(window.db, 'pages');
    
    unsubscribeFromPagesVisibility = onSnapshot(pagesRef, (snapshot) => {
        pagesVisibility = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            pagesVisibility[doc.id] = {
                visible: data.visible !== undefined ? data.visible : false,
                label: data.label || doc.id
            };
        });       
        
        // Aktualizujeme navigáciu pri každej zmene
        updateNavigationLinks();
    }, (error) => {
    });
};

// Aktualizácia navigačných odkazov podľa viditeľnosti stránok
const updateNavigationLinks = () => {    
    // Ak ešte nemáme načítané dáta, nič nerobíme (odkazy zostanú skryté)
    if (Object.keys(pagesVisibility).length === 0) {
        return;
    }
    
    // 1. Spracovanie všetkých odkazov s data-page atribútom
    const navLinks = document.querySelectorAll('[data-page]');
    
    navLinks.forEach(link => {
        const pageId = link.getAttribute('data-page');
        const pageConfig = pagesVisibility[pageId];
        const isVisible = pageConfig && pageConfig.visible === true;        
        
        // Aktualizujeme viditeľnosť odkazu
        if (isVisible) {
            link.classList.remove('hidden');
            link.style.display = '';
            link.dataset.visible = 'true';
        } else {
            link.classList.add('hidden');
            link.style.display = 'none';
            link.dataset.visible = 'false';
        }
    });

    // 2. Špeciálne spracovanie pre "register" - zachováme existujúcu logiku
    const registerLink = document.getElementById('register-link');
    if (registerLink) {
        updateRegistrationLinkVisibility(window.globalUserProfileData);
    }

    // 3. Home link - vždy viditeľný
    const homeLink = document.getElementById('home-link');
    if (homeLink) {
        homeLink.classList.remove('hidden');
        homeLink.style.display = '';
    }
};

// Inicializácia viditeľnosti - najprv všetko skryjeme
const initializeNavigationVisibility = () => {
    const navLinks = document.querySelectorAll('[data-page]');
    navLinks.forEach(link => {
        link.classList.add('hidden');
        link.style.display = 'none'; // PRIAMO NASTAVÍME display:none
    });
    
    const homeLink = document.getElementById('home-link');
    if (homeLink) {
        homeLink.classList.remove('hidden');
        homeLink.style.display = '';
    }
    
    const registerLink = document.getElementById('register-link');
    if (registerLink) {
        registerLink.classList.add('hidden');
        registerLink.style.display = 'none';
    }

    // Mapa je predvolene skrytá, ale bude sa kontrolovať v updateNavigationLinks
    const mapLink = document.getElementById('map-link');
    if (mapLink) {
        mapLink.classList.add('hidden');
        mapLink.style.display = 'none';
    }
};

// Kontrola prístupu k aktuálnej stránke
const checkCurrentPageAccess = () => {
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop().replace('.html', '');
    
    // Povolené stránky bez kontroly
    const allowedPages = ['', 'index', 'login', 'admin-register'];
    if (allowedPages.includes(currentPage)) {
        return true;
    }
    
    // Špeciálne pravidlo pre mapu - prihlásení používatelia majú prístup vždy
    if (currentPage === 'map') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
        // Ak nie je prihlásený, kontrolujeme nastavenia
        const pageConfig = pagesVisibility['map'];
        if (pageConfig && pageConfig.visible === true) {
            return true;
        }
        // Inak presmerujeme
        window.location.href = 'index.html';
        return false;
    }
    
    const pageConfig = pagesVisibility[currentPage];
    
    // Ak stránka nie je v databáze, predpokladáme že je viditeľná
    if (!pageConfig) {
        return true;
    }
    
    // Ak je stránka skrytá, presmerujeme na hlavnú stránku
    if (pageConfig.visible === false) {
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
};

const updateHeaderLinks = (userProfileData) => {    
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const headerElement = document.querySelector('header');
    
    if (!authLink || !profileLink || !logoutButton || !headerElement) {
        return;
    }

    // NAJPRV AKTUALIZUJEME NAVIGAČNÉ ODKAZY (NEZÁVISLE OD PRIHLÁSENIA)
    updateNavigationLinks();
    checkCurrentPageAccess();

    // DODATOČNÁ KONTROLA: Uistíme sa, že teams-in-groups je skrytý ak nie je viditeľný
    const teamsLink = document.getElementById('teams-in-groups-link');
    if (teamsLink) {
        const pageConfig = pagesVisibility['teams-in-groups'];
        const isVisible = pageConfig && pageConfig.visible === true;
        if (!isVisible) {
            teamsLink.classList.add('hidden');
            teamsLink.style.display = 'none';
        }
    }

    // DODATOČNÁ KONTROLA: Mapa - špeciálne pravidlo pre prihlásených používateľov
    const mapLink = document.getElementById('map-link');
    if (mapLink) {
        const isLoggedIn = isReallyLoggedIn();
        const pageConfig = pagesVisibility['map'];
        const isVisible = (pageConfig && pageConfig.visible === true) || isLoggedIn;
        if (!isVisible) {
            mapLink.classList.add('hidden');
            mapLink.style.display = 'none';
        }
    }

    if (window.location.pathname.includes('register.html') || window.location.pathname.includes('logged-in-registration.html')) {
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
        const isLoggedIn = isReallyLoggedIn();
        
        if (isLoggedIn) {            
            authLink.classList.add('hidden');
            profileLink.classList.remove('hidden');
            logoutButton.classList.remove('hidden');
            headerElement.style.backgroundColor = getHeaderColorByRole(userProfileData.role);
            
            if (userProfileData.id && currentUserId !== userProfileData.id) {                
                currentUserId = userProfileData.id;                
                loadInitialDisplayNotifications(userProfileData.id).then(() => {                    
                    if (unsubscribeFromUserSettings) {
                        unsubscribeFromUserSettings();
                        unsubscribeFromUserSettings = null;
                    }
                    
                    unsubscribeFromUserSettings = setupUserSettingsListener(userProfileData.id);
                    
                    if (unsubscribeFromNotifications) {
                        unsubscribeFromNotifications();
                        unsubscribeFromNotifications = null;
                    }
                    
                    shownNotificationIds.clear();
                    
                    if (userProfileData.role === 'admin') {
                        setupNotificationListenerForAdmin(userProfileData);
                    }
                }).catch(error => {
                });
            } 
        } else {            
            authLink.classList.remove('hidden');
            profileLink.classList.add('hidden');
            logoutButton.classList.add('hidden');
            headerElement.style.backgroundColor = getHeaderColorByRole(null);
            
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

// Anonymný používateľ by mal vidieť tlačidlo registrácie, keď je registrácia otvorená
const updateRegistrationLinkVisibility = (userProfileData) => {
    const registerLink = document.getElementById('register-link');
    if (!registerLink) return;

    const isRegistrationOpen = window.registrationDates && 
        new Date() >= window.registrationDates.registrationStartDate.toDate() && 
        new Date() <= window.registrationDates.registrationEndDate.toDate();
    const hasCategories = window.hasCategories;

    const shouldShowRegisterLink = hasCategories && isRegistrationOpen && !isReallyLoggedIn();

    if (shouldShowRegisterLink) {
        registerLink.classList.remove('hidden');
        registerLink.href = 'register.html';
    } else {
        registerLink.classList.add('hidden');
    }
};

const setupNotificationListenerForAdmin = (userProfileData) => {
    if (unsubscribeFromNotifications) {
        return;
    }
    
    if (!userProfileData || userProfileData.role !== 'admin') {
        return;
    }
    
    if (window.isAnonymousUser === true) {
        return;
    }
    
    notificationListenerSetupCount++;    
    if (!window.db) {
        return;
    }    
    const notificationsCollectionRef = collection(window.db, "notifications");    
    unsubscribeFromNotifications = onSnapshot(notificationsCollectionRef, async (snapshot) => {        
        const auth = getAuth();
        const userId = auth.currentUser ? auth.currentUser.uid : null;
        if (!userId) {
            return;
        }
        
        if (window.isAnonymousUser === true) {
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
                    
                    if (newNotification.changes) {
                        if (Array.isArray(newNotification.changes)) {
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
                        if (Array.isArray(changesMessage)) {
                            changesMessage = `Používateľ ${newNotification.userEmail}:<br>${changesMessage.join('<br>')}`;
                        } else {
                            changesMessage = `Používateľ ${newNotification.userEmail}: ${changesMessage}`;
                        }
                    } else if (Array.isArray(changesMessage)) {
                        changesMessage = changesMessage.join('<br>');
                    }                 
                    
                    showDatabaseNotification(changesMessage, newNotification.type || 'info');                    
                    
                    const notificationDocRef = doc(window.db, "notifications", notificationId);
                    try {
                        await updateDoc(notificationDocRef, {
                            seenBy: arrayUnion(userId)
                        });
                    } catch (e) {
                    }
                }
            }
        });
    }, (error) => {
    });
};

const setupFirestoreListeners = () => {    
    if (!window.db) {
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
            }
            window.isRegistrationDataLoaded = true; 
            updateHeaderLinks(window.globalUserProfileData);
        }, (error) => {
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
            }
            window.isCategoriesDataLoaded = true;
            window.areCategoriesLoaded = true;
            window.dispatchEvent(new CustomEvent('categoriesLoaded'));
            updateHeaderLinks(window.globalUserProfileData);
        }, (error) => {
            window.isCategoriesDataLoaded = true;
            window.areCategoriesLoaded = true;
            window.dispatchEvent(new CustomEvent('categoriesLoaded'));
            updateHeaderLinks(window.globalUserProfileData);
        });

        // NASTAVENIE LISTENERA PRE VIDITEĽNOSŤ STRÁNOK
        setupPagesVisibilityListener();
        
        // NAČÍTANIE VIDITEĽNOSTI STRÁNOK
        loadPagesVisibility();

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
            if (unsubscribeFromPagesVisibility) {
                unsubscribeFromPagesVisibility();
            }
        });

        isFirestoreListenersSetup = true;

    } catch (error) {
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

        // INICIALIZÁCIA: Najprv všetky odkazy skryjeme
        initializeNavigationVisibility();

        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
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
    }
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', window.loadHeaderAndScripts);
} else {
    window.loadHeaderAndScripts();
}

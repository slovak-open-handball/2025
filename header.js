import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query, updateDoc, arrayUnion, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { countryDialCodes } from "./countryDialCodes.js";




// ---------------------------------------------------------------------------------------------------------------- ZAČIATOK približenie stranky

// true = zapnutá kontrola, overlay sa zobrazuje, vyžaduje sa zmenšenie priblíženia na 80% alebo menej
// false = vypnutá kontrola, overlay sa nezobrazuje
const ZOOM_CONTROL_ENABLED = false; 

// Zistenie či ide o mobilné zariadenie
const isMobileDevice = () => {
    return /Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent) || 
           (window.innerWidth <= 768 && window.innerHeight <= 1024);
};

const getCurrentZoomLevel = () => {
    // Pre mobilné zariadenia - používame inú metódu
    if (isMobileDevice()) {
        try {
            // Metóda pre mobily: porovnanie vizuálneho viewportu s layout viewportom
            const visualViewport = window.visualViewport;
            if (visualViewport) {
                // Na mobile sa zoom prejavuje ako zmena pomeru visualViewport.width / layout viewport
                const zoom = (visualViewport.width / window.innerWidth) * 100;
                return Math.round(zoom);
            }
            
            // Alternatívna metóda pre mobily: porovnanie screen.width s innerWidth
            if (window.screen && window.screen.width) {
                const zoom = (window.screen.width / window.innerWidth) * 100;
                return Math.round(zoom);
            }
        } catch (e) {}
        
        // Pre mobilné zariadenia vždy vrátime 100%, pretože pinch-to-zoom je dočasný
        return 100;
    }

    // Metóda 1: Použitie window.devicePixelRatio pre mobilné zariadenia
    if (window.devicePixelRatio) {
        if (window.innerWidth !== window.screen.width) {
            return Math.round(window.devicePixelRatio * 100);
        }
    }

    // Metóda 2: Výpočet pomocou vizuálneho viewportu
    try {
        const testElement = document.createElement('div');
        testElement.style.width = '100px';
        testElement.style.height = '100px';
        testElement.style.position = 'absolute';
        testElement.style.visibility = 'hidden';
        testElement.style.top = '-1000px';
        document.body.appendChild(testElement);

        const cssWidth = testElement.offsetWidth;
        const screenWidth = testElement.getBoundingClientRect().width;
        
        document.body.removeChild(testElement);

        if (cssWidth > 0 && screenWidth > 0) {
            const zoom = (screenWidth / cssWidth) * 100;
            return Math.round(zoom);
        }
    } catch (e) {}

    // Metóda 3: Alternatívny výpočet pomocou window.outerWidth a window.innerWidth
    try {
        if (window.outerWidth && window.innerWidth) {
            const zoom = (window.innerWidth / window.outerWidth) * 100;
            return Math.round(zoom);
        }
    } catch (e) {}

    // Metóda 4: Pre moderné prehliadače - Media Queries
    try {
        const mediaQuery = window.matchMedia('(resolution: 1dppx)');
        if (mediaQuery.matches) {
            return 100;
        }
        
        const resolutions = [0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2];
        for (const res of resolutions) {
            const mq = window.matchMedia(`(resolution: ${res}dppx)`);
            if (mq.matches) {
                return Math.round(res * 100);
            }
        }
    } catch (e) {}

    return 100;
};

// Vytvorenie overlay pre informáciu o zoome
const createZoomOverlay = () => {
    // Ak je kontrola vypnutá, nič nerobíme
    if (!ZOOM_CONTROL_ENABLED) {
        console.log('ℹ️ Kontrola priblíženia je vypnutá (ZOOM_CONTROL_ENABLED = false)');
        return null;
    }

    // Pre mobilné zariadenia overlay nezobrazujeme (pinch-to-zoom je dočasný)
    if (isMobileDevice()) {
        console.log('📱 Mobilné zariadenie - overlay sa nezobrazuje (pinch-to-zoom je dočasný)');
        return null;
    }

    // Odstránime existujúci overlay ak existuje
    const existingOverlay = document.getElementById('zoom-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'zoom-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: white;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-family: Arial, sans-serif;
        padding: 20px;
        box-sizing: border-box;
    `;

    overlay.innerHTML = `
        <div style="text-align: center; max-width: 600px;">
            <h1 style="font-size: 28px; color: #1a1a1a; margin-bottom: 20px;">
                🔍 Nastavenie priblíženia
            </h1>
            <p style="font-size: 18px; color: #333; margin-bottom: 10px;">
                Pre správne zobrazenie stránky nastavte priblíženie na <strong>80%</strong> alebo menej.
            </p>
            <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
                Aktuálne priblíženie: <span id="zoom-display" style="font-weight: bold; color: #e74c3c;">100%</span>
            </p>
            <p style="font-size: 14px; color: #888; margin-top: 10px;">
                <span style="display: inline-block; margin: 0 10px;">🖥️ Windows/Linux: <kbd style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">Ctrl</kbd> + <kbd style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">−</kbd> alebo <kbd style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">Ctrl</kbd> + koliesko</span>
                <br>
                <span style="display: inline-block; margin: 5px 10px;">🍎 Mac: <kbd style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">Cmd</kbd> + <kbd style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">−</kbd> alebo <kbd style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">Cmd</kbd> + koliesko</span>
            </p>
        </div>
    `;

    document.body.appendChild(overlay);

    // Aktualizácia zobrazenia zoomu
    const updateZoomDisplay = () => {
        const zoom = getCurrentZoomLevel();
        const display = document.getElementById('zoom-display');
        if (display) {
            display.textContent = zoom + '%';
            if (zoom <= 80) {
                display.style.color = '#2ecc71';
            } else {
                display.style.color = '#e74c3c';
            }
        }
        return zoom;
    };

    // Funkcia na skrytie overlay
    const dismissOverlay = () => {
        const zoom = getCurrentZoomLevel();
        if (zoom <= 80) {
            const overlay = document.getElementById('zoom-overlay');
            if (overlay) {
                overlay.style.transition = 'opacity 0.5s';
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.remove();
                }, 500);
            }
        } else {
            alert('Priblíženie musí byť nastavené na 80% alebo menej. Prosím, znížte priblíženie pomocou klávesových skratiek.');
            updateZoomDisplay();
        }
    };

    // Klávesové skratky pre zmenu zoomu
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            document.body.style.zoom = '100%';
            setTimeout(updateZoomDisplay, 100);
        }
    });

    // Aktualizácia pri zmene okna
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateZoomDisplay();
        }, 300);
    });

    // Počiatočná aktualizácia
    setTimeout(updateZoomDisplay, 100);

    return overlay;
};

// Funkcia na výpis priblíženia do konzoly
const logCurrentZoom = () => {
    const zoom = getCurrentZoomLevel();
    const device = isMobileDevice() ? '📱 Mobil' : '🖥️ Desktop';
    console.log(`${device} - Aktuálne priblíženie stránky: ${zoom}%`);
    return zoom;
};

// Funkcia na kontrolu a zobrazenie overlay
const checkAndShowZoomOverlay = () => {
    // Ak je kontrola vypnutá, nič nerobíme
    if (!ZOOM_CONTROL_ENABLED) {
        console.log('ℹ️ Kontrola priblíženia je vypnutá (ZOOM_CONTROL_ENABLED = false)');
        const existingOverlay = document.getElementById('zoom-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        return;
    }

    // Pre mobilné zariadenia overlay nezobrazujeme
    if (isMobileDevice()) {
        console.log('📱 Mobilné zariadenie - kontrola priblíženia je preskočená');
        const existingOverlay = document.getElementById('zoom-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        return;
    }

    const zoom = getCurrentZoomLevel();
    console.log(`📐 Aktuálne priblíženie stránky: ${zoom}%`);
    
    if (zoom > 80) {
        console.log('⚠️ Priblíženie je nad 80%. Zobrazujem overlay.');
        createZoomOverlay();
    } else {
        console.log('✅ Priblíženie je 80% alebo menej.');
        const existingOverlay = document.getElementById('zoom-overlay');
        if (existingOverlay) {
            existingOverlay.style.transition = 'opacity 0.5s';
            existingOverlay.style.opacity = '0';
            setTimeout(() => {
                existingOverlay.remove();
            }, 500);
        }
    }
};

// Automatické zistenie a výpis priblíženia pri načítaní stránky
const setupZoomMonitoring = () => {
    setTimeout(checkAndShowZoomOverlay, 500);

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            logCurrentZoom();
            
            if (!ZOOM_CONTROL_ENABLED || isMobileDevice()) {
                return;
            }
            
            const overlay = document.getElementById('zoom-overlay');
            const zoom = getCurrentZoomLevel();
            
            if (zoom > 80 && !overlay) {
                createZoomOverlay();
            } else if (zoom <= 80 && overlay) {
                overlay.style.transition = 'opacity 0.5s';
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.remove();
                }, 500);
            }
        }, 300);
    });

    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            checkAndShowZoomOverlay();
        }, 500);
    });
};

// Spustíme sledovanie priblíženia po načítaní DOM
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', setupZoomMonitoring);
} else {
    setupZoomMonitoring();
}

// Exportujeme funkcie pre prípadné manuálne použitie
window.getCurrentZoomLevel = getCurrentZoomLevel;
window.logCurrentZoom = logCurrentZoom;
window.checkAndShowZoomOverlay = checkAndShowZoomOverlay;
window.createZoomOverlay = createZoomOverlay;
window.ZOOM_CONTROL_ENABLED = ZOOM_CONTROL_ENABLED;
window.isMobileDevice = isMobileDevice;

// ---------------------------------------------------------------------------------------------------------------- KONIEC približenie stranky





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

// Globálna premenná pre stav registrácie
let registrationDates = null;
let hasCategories = false;

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
    if (Object.keys(pagesVisibility).length === 0) {
        return;
    }
    
    const publicNavLinks = document.querySelectorAll('[data-page]');
    
    publicNavLinks.forEach(link => {
        const pageId = link.getAttribute('data-page');
        const pageConfig = pagesVisibility[pageId];
        
        let isVisible = pageConfig && pageConfig.visible === true;
        
        // ŠPECIÁLNE PRAVIDLO: Tabuľky majú rovnakú viditeľnosť ako Zápasy
        if (pageId === 'tables') {
            const matchesConfig = pagesVisibility['matches'];
            isVisible = matchesConfig && matchesConfig.visible === true;
        }
        
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

    // Špeciálne spracovanie pre "register" - zachováme existujúcu logiku
    const registerLink = document.getElementById('register-link');
    if (registerLink) {
        updateRegistrationLinkVisibility(window.globalUserProfileData);
    }

    // Home link - vždy viditeľný
    const homeLink = document.getElementById('home-link');
    if (homeLink) {
        homeLink.classList.remove('hidden');
        homeLink.style.display = '';
    }
};

// Inicializácia viditeľnosti - najprv všetko skryjeme
const initializeNavigationVisibility = () => {
    // Skryjeme všetky verejné odkazy
    const publicNavLinks = document.querySelectorAll('[data-page]');
    publicNavLinks.forEach(link => {
        const pageId = link.getAttribute('data-page');
        // Tabuľky skryjeme rovnako ako Skupiny (budú sa riadiť rovnakou logikou)
        link.classList.add('hidden');
        link.style.display = 'none';
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

const getHoverColorByRole = (role) => {
  switch (role) {
    case 'admin':
      return '#e3f2fd';
    case 'hall':
      return '#fef3e2';
    case 'club':
      return '#f3e5f5';
    case 'referee':
      return '#e8f5e9';
    case 'volunteer':
      return '#fff3e0';
    default:
      return '#e3f2fd';
  }
};

/**
 * Aktualizuje text v hlavičke "Registrácia na turnaj"
 * @param {boolean} isRegistrationOpen - true ak je registrácia otvorená
 */
const updateHeaderRegistrationText = (isRegistrationOpen) => {
    const registrationHeaderLink = document.getElementById('registration-header-link');
    if (registrationHeaderLink) {
        registrationHeaderLink.classList.add('hidden');
    }

    // Kontrola či sú kategórie definované
    if (!hasCategories) {
        registrationHeaderLink.classList.add('hidden');
        return;
    }

    // Kontrola či je používateľ prihlásený
    const isLoggedIn = isReallyLoggedIn();
    
    // Ak je používateľ prihlásený, odkaz nezobrazujeme
    if (isLoggedIn) {
        registrationHeaderLink.classList.add('hidden');
        return;
    }

    if (isRegistrationOpen) {
        registrationHeaderLink.classList.remove('hidden');
        registrationHeaderLink.textContent = 'Registrácia na turnaj';
        registrationHeaderLink.href = 'register.html';
    } else {
        registrationHeaderLink.classList.add('hidden');
    }
};

/**
 * Kontroluje, či je registrácia otvorená na základe dátumu a kategórií
 * @returns {boolean} - true ak je registrácia otvorená
 */
const isRegistrationOpen = () => {
    // Ak nie sú kategórie, registrácia nie je otvorená
    if (!hasCategories) {
        return false;
    }

    // Ak nie sú dáta o registrácii, registrácia nie je otvorená
    if (!registrationDates || !registrationDates.registrationStartDate || !registrationDates.registrationEndDate) {
        return false;
    }

    const now = new Date();
    const registrationStart = registrationDates.registrationStartDate.toDate();
    const registrationEnd = registrationDates.registrationEndDate.toDate();

    return now >= registrationStart && now <= registrationEnd;
};

const updateHeaderLinks = (userProfileData) => {    
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const headerElement = document.querySelector('header');
    const navLinks = document.querySelectorAll('nav a');
    
    if (!authLink || !profileLink || !logoutButton || !headerElement) {
        return;
    }

    // NAJPRV AKTUALIZUJEME NAVIGAČNÉ ODKAZY (NEZÁVISLE OD PRIHLÁSENIA)
    updateNavigationLinks();
    checkCurrentPageAccess();

    // AKTUALIZUJEME TEXT REGISTRÁCIE V HLAVIČKE
    updateHeaderRegistrationText(isRegistrationOpen());

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
        
        // Skryjeme text registrácie na registračných stránkach
        const registrationHeaderText = document.getElementById('registration-header-text');
        if (registrationHeaderText) {
            registrationHeaderText.classList.add('hidden');
        }
        
        // Nastavenie hover farby pre registračné stránky
        const hoverColor = '#e3f2fd';
        navLinks.forEach(link => {
            link.addEventListener('mouseenter', function() {
                this.style.backgroundColor = hoverColor;
                this.style.color = '#1a1a1a';
            });
            link.addEventListener('mouseleave', function() {
                this.style.backgroundColor = 'transparent';
                this.style.color = '';
            });
        });
        return;
    }

    if (window.isGlobalAuthReady && window.isRegistrationDataLoaded && window.isCategoriesDataLoaded) {        
        const isLoggedIn = isReallyLoggedIn();
        
        if (isLoggedIn) {            
            authLink.classList.add('hidden');
            profileLink.classList.remove('hidden');
            logoutButton.classList.remove('hidden');
            headerElement.style.backgroundColor = getHeaderColorByRole(userProfileData.role);
            
            // NASTAVENIE HOVER FARBY PRE NAVIGAČNÉ ODKAZY PODĽA ROLY
            const hoverColor = getHoverColorByRole(userProfileData.role);
            navLinks.forEach(link => {
                // Odstránime predchádzajúce event listenery (ak existujú)
                link.removeEventListener('mouseenter', link._mouseEnterHandler);
                link.removeEventListener('mouseleave', link._mouseLeaveHandler);
                
                // Pridáme nové event listenery
                link._mouseEnterHandler = function() {
                    this.style.backgroundColor = hoverColor;
                    this.style.color = '#1a1a1a';
                };
                link._mouseLeaveHandler = function() {
                    this.style.backgroundColor = 'transparent';
                    this.style.color = '';
                };
                
                link.addEventListener('mouseenter', link._mouseEnterHandler);
                link.addEventListener('mouseleave', link._mouseLeaveHandler);
            });
            
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
            
            // NASTAVENIE HOVER FARBY PRE NEPRIHLÁSENÉHO POUŽÍVATEĽA
            const hoverColor = '#e3f2fd';
            navLinks.forEach(link => {
                link.removeEventListener('mouseenter', link._mouseEnterHandler);
                link.removeEventListener('mouseleave', link._mouseLeaveHandler);
                
                link._mouseEnterHandler = function() {
                    this.style.backgroundColor = hoverColor;
                    this.style.color = '#1a1a1a';
                };
                link._mouseLeaveHandler = function() {
                    this.style.backgroundColor = 'transparent';
                    this.style.color = '';
                };
                
                link.addEventListener('mouseenter', link._mouseEnterHandler);
                link.addEventListener('mouseleave', link._mouseLeaveHandler);
            });
            
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
        
        // Znovu aktualizujeme text v hlavičke
        updateHeaderRegistrationText(isRegistrationOpen());
        
        headerElement.classList.remove('invisible');
    }
};

const initializeNavHoverStyles = () => {
    const navLinks = document.querySelectorAll('nav a');
    const defaultHoverColor = '#e3f2fd';
    
    navLinks.forEach(link => {
        link._mouseEnterHandler = function() {
            this.style.backgroundColor = defaultHoverColor;
            this.style.color = '#1a1a1a';
        };
        link._mouseLeaveHandler = function() {
            this.style.backgroundColor = 'transparent';
            this.style.color = '';
        };
        
        link.addEventListener('mouseenter', link._mouseEnterHandler);
        link.addEventListener('mouseleave', link._mouseLeaveHandler);
    });
};

// Anonymný používateľ by mal vidieť tlačidlo registrácie, keď je registrácia otvorená
const updateRegistrationLinkVisibility = (userProfileData) => {
    const registerLink = document.getElementById('register-link');
    if (!registerLink) return;

    const isRegistrationOpenNow = isRegistrationOpen();
    const shouldShowRegisterLink = hasCategories && isRegistrationOpenNow && !isReallyLoggedIn();

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
                registrationDates = docSnap.data();
                window.registrationDates = registrationDates;
            } else {
                registrationDates = null;
                window.registrationDates = null;
            }
            window.isRegistrationDataLoaded = true; 
            
            // Aktualizujeme text v hlavičke po zmene dátumu registrácie
            updateHeaderRegistrationText(isRegistrationOpen());
            updateRegistrationLinkVisibility(window.globalUserProfileData);
            updateHeaderLinks(window.globalUserProfileData);
        }, (error) => {
            window.isRegistrationDataLoaded = true;
            updateHeaderLinks(window.globalUserProfileData);
        });
        
        const categoriesDocRef = doc(window.db, "settings", "categories");
        onSnapshot(categoriesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const categories = docSnap.data();
                hasCategories = Object.keys(categories).length > 0;
                window.hasCategories = hasCategories;
            } else {
                hasCategories = false;
                window.hasCategories = false;
            }
            window.isCategoriesDataLoaded = true;
            window.areCategoriesLoaded = true;
            window.dispatchEvent(new CustomEvent('categoriesLoaded'));
            
            // Aktualizujeme text v hlavičke po zmene kategórií
            updateHeaderRegistrationText(isRegistrationOpen());
            updateRegistrationLinkVisibility(window.globalUserProfileData);
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
            if (registrationDates) {
                // Pravidelne kontrolujeme stav registrácie
                updateHeaderRegistrationText(isRegistrationOpen());
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
        
        // INICIALIZÁCIA: Nastavíme základné hover štýly
        initializeNavHoverStyles();

        // INICIALIZÁCIA: Skryjeme text registrácie na začiatku
        const registrationHeaderText = document.getElementById('registration-header-text');
        if (registrationHeaderText) {
            registrationHeaderText.classList.add('hidden');
        }

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

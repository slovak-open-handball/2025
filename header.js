import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { countryDialCodes } from "./countryDialCodes.js";

let registrationCheckIntervalId = null;
let unsubscribeFromNotifications = null; 
window.isRegistrationDataLoaded = false;
window.isCategoriesDataLoaded = false;
let isFirestoreListenersSetup = false; 
window.areCategoriesLoaded = false;

// Vytvorenie bieleho prekryvného obdĺžnika s animovaným kolieskom
const createWhiteOverlay = () => {
    // Skontrolujeme, či už existuje
    const existingOverlay = document.getElementById('zoom-init-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.id = 'zoom-init-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: white;
        z-index: 999999999999;
        opacity: 1;
        transition: opacity 0.5s ease;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    // Vytvorenie animovaného kolieska
    const spinner = document.createElement('div');
    spinner.id = 'zoom-spinner';
    spinner.style.cssText = `
        width: 60px;
        height: 60px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #47b3ff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        z-index: 999999999999;
        box-shadow: 0 4px 20px rgba(71, 179, 255, 0.3);
    `;
    
    // Pridanie CSS animácie
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        
        @keyframes pulse {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
        }
    `;
    
    document.head.appendChild(style);
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
    
    console.log("Bielý prekryvný obdĺžnik s animovaným kolieskom vytvorený");
    return overlay;
};

// Funkcia pre skrytie bieleho prekryvného obdĺžnika
const hideWhiteOverlay = () => {
    const overlay = document.getElementById('zoom-init-overlay');
    const spinner = document.getElementById('zoom-spinner');
    const spinnerText = document.getElementById('spinner-text');
    
    if (spinner) {
        spinner.style.opacity = '0';
        spinner.style.transition = 'opacity 0.3s ease';
    }
    
    if (spinnerText) {
        spinnerText.style.opacity = '0';
        spinnerText.style.transition = 'opacity 0.3s ease';
    }
    
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            if (overlay.parentElement) {
                overlay.remove();
                console.log("Bielý prekryvný obdĺžnik odstránený");
            }
        }, 500);
    }
};

// Funkcia pre aktualizáciu textu kolieska (voliteľné)
const updateSpinnerText = (text) => {
    const overlay = document.getElementById('zoom-init-overlay');
    if (!overlay) return;
    
    // Odstrániť starý text, ak existuje
    const oldText = document.getElementById('spinner-text');
    if (oldText) {
        oldText.remove();
    }
    
    if (text) {
        const textElement = document.createElement('div');
        textElement.id = 'spinner-text';
        textElement.textContent = text;
        textElement.style.cssText = `
            position: absolute;
            top: calc(50% + 50px);
            left: 50%;
            transform: translateX(-50%);
            color: #47b3ff;
            font-size: 14px;
            font-weight: 600;
            text-align: center;
            z-index: 999999999999;
            animation: fadeIn 0.5s ease, pulse 2s ease-in-out infinite;
            background: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            border-radius: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        `;
        
        overlay.appendChild(textElement);
    }
};

// Funkcia pre nastavenie priblíženia na 80% (skutočná simulácia Ctrl+-)
const setZoomTo80Percent = () => {
    console.log("Nastavujem priblíženie na 80% (simulácia Ctrl+-)");
    
    // Aktualizovať text kolieska
    updateSpinnerText("Nastavujem priblíženie...");
    
    // Metóda 1: CSS zoom property (podporované v Chrome, Edge)
    const setZoomWithCSS = () => {
        const targetZoom = 80;
        localStorage.setItem('pageZoom', targetZoom);
        
        // Resetovať predchádzajúce transformácie
        document.body.style.transform = '';
        document.body.style.transformOrigin = '';
        document.documentElement.style.transform = '';
        document.documentElement.style.transformOrigin = '';
        
        // Skúsime rôzne metódy pre rôzne prehliadače
        const htmlElement = document.documentElement;
        const bodyElement = document.body;
        
        // Metóda A: CSS zoom (najlepšia pre Chrome)
        if ('zoom' in htmlElement.style) {
            htmlElement.style.zoom = `${targetZoom}%`;
            console.log("Použitá CSS zoom property");
            return true;
        }
        
        // Metóda B: transform na body s viewport kompenzáciou
        bodyElement.style.transform = `scale(${targetZoom / 100})`;
        bodyElement.style.transformOrigin = 'top center';
        bodyElement.style.width = '125%'; // Kompenzácia: 100/80 = 1.25
        bodyElement.style.marginLeft = '-12.5%'; // Centrovanie
        bodyElement.style.overflowX = 'hidden';
        
        // Pre fixované elementy: musíme ich umiestniť relatívne
        const fixedElements = document.querySelectorAll('*[style*="fixed"], .fixed, [class*="fixed"]');
        fixedElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(el);
            
            // Ak je element fixovaný
            if (computedStyle.position === 'fixed') {
                // Pre pravý dolný roh
                if (computedStyle.right === '0px' || computedStyle.bottom === '0px') {
                    // Pridáme wrapper pre fixované elementy
                    if (!el.parentElement.classList.contains('zoom-fixed-wrapper')) {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'zoom-fixed-wrapper';
                        wrapper.style.position = 'fixed';
                        wrapper.style.right = computedStyle.right;
                        wrapper.style.bottom = computedStyle.bottom;
                        wrapper.style.zIndex = computedStyle.zIndex;
                        
                        el.parentElement.insertBefore(wrapper, el);
                        wrapper.appendChild(el);
                        
                        // Upravíme pozíciu vnútri wrappera
                        el.style.position = 'absolute';
                        el.style.right = '0';
                        el.style.bottom = '0';
                    }
                }
            }
        });
        
        console.log("Použitá CSS transform metóda s kompenzáciou");
        return false;
    };
    
    // Metóda 2: Viewport meta tag manipulation (najlepšia pre všetky prehliadače)
    const setZoomWithViewport = () => {
        const targetZoom = 80;
        localStorage.setItem('pageZoom', targetZoom);
        
        // Získame aktuálny viewport tag alebo vytvoríme nový
        let viewport = document.querySelector('meta[name="viewport"]');
        
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }
        
        // Vypočítame scale pre viewport
        const scale = targetZoom / 100;
        
        // Nastavíme viewport content
        const initialScale = Math.min(scale, 1.0);
        const maximumScale = Math.max(scale, 1.0);
        const userScalable = scale !== 1.0 ? 'yes' : 'no';
        
        viewport.content = `width=device-width, initial-scale=${initialScale}, maximum-scale=${maximumScale}, user-scalable=${userScalable}`;
        
        // Pre desktop: použijeme aj CSS transform s viewport kompenzáciou
        if (window.innerWidth > 768) { // Desktop
            document.body.style.transform = `scale(${scale})`;
            document.body.style.transformOrigin = 'top center';
            
            // Kompenzácia veľkosti
            const scaleFactor = 1 / scale;
            document.body.style.width = `${scaleFactor * 100}%`;
            document.body.style.marginLeft = `${(scaleFactor - 1) * 50}%`;
        }
        
        console.log("Použitá viewport metóda");
        return true;
    };
    
    // Skúsime najprv CSS zoom
    let success = setZoomWithCSS();
    
    // Ak nefunguje, skúsime viewport metódu
    if (!success) {
        setTimeout(() => {
            updateSpinnerText("Používam alternatívnu metódu...");
            setTimeout(() => {
                success = setZoomWithViewport();
            }, 300);
        }, 300);
    }
    
    // Aktualizovať text pred dokončením
    setTimeout(() => {
        updateSpinnerText("Dokončujem...");
    }, 600);
    
    // Zobrazíme spätnú väzbu
    setTimeout(() => {
        showZoomFeedback(80);
    }, 800);
    
    // Pre istotu pridáme aj event listener pre resize
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 300);
};

// Funkcia pre obnovenie pôvodného priblíženia
const resetZoom = () => {
    // Aktualizovať text kolieska
    updateSpinnerText("Obnovujem pôvodné priblíženie...");
    
    localStorage.setItem('pageZoom', 100);
    
    // Reset všetkých metód
    document.body.style.transform = '';
    document.body.style.transformOrigin = '';
    document.body.style.width = '';
    document.body.style.marginLeft = '';
    document.body.style.overflowX = '';
    
    document.documentElement.style.transform = '';
    document.documentElement.style.transformOrigin = '';
    document.documentElement.style.zoom = '';
    document.documentElement.style.fontSize = '';
    
    // Reset viewport
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    }
    
    // Odstrániť wrappery pre fixované elementy
    document.querySelectorAll('.zoom-fixed-wrapper').forEach(wrapper => {
        const child = wrapper.firstElementChild;
        if (child) {
            // Obnoviť pôvodné štýly
            child.style.position = '';
            child.style.right = '';
            child.style.bottom = '';
            
            // Presunúť späť
            wrapper.parentElement.insertBefore(child, wrapper);
            wrapper.remove();
        }
    });
    
    console.log("Priblíženie obnovené na 100%");
    
    // Aktualizovať text pred dokončením
    setTimeout(() => {
        updateSpinnerText("Dokončené!");
    }, 500);
    
    setTimeout(() => {
        showZoomFeedback(100);
    }, 800);
};

// Funkcia pre vizuálnu spätnú väzbu
const showZoomFeedback = (zoomLevel) => {
    // Najprv odstránime existujúcu spätnú väzbu, ak nejaká existuje
    const existingFeedback = document.getElementById('zoom-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    // Vytvoríme novú spätnú väzbu
    const feedback = document.createElement('div');
    feedback.id = 'zoom-feedback';
    feedback.textContent = `Priblíženie: ${zoomLevel}%`;
    feedback.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0,0,0,0.85);
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        z-index: 999999999999;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 2px solid #47b3ff;
        animation: fadeIn 0.5s ease;
    `;
    document.body.appendChild(feedback);
    
    // Po zobrazení spätnej väzby skryjeme biely prekryvný obdĺžnik
    setTimeout(() => {
        hideWhiteOverlay();
        console.log("Spätná väzba o priblížení sa zobrazila, biely prekryvný obdĺžnik sa skrýva");
    }, 300);
    
    // Postupne zmizne spätná väzba
    setTimeout(() => {
        feedback.style.opacity = '0';
        feedback.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            if (feedback.parentElement) {
                feedback.remove();
            }
        }, 500);
    }, 2000);
};

// Inicializácia priblíženia pri načítaní stránky
const initializeZoom = () => {
    // Vytvoríme biely prekryvný obdĺžnik s animovaným kolieskom hneď na začiatku
    createWhiteOverlay();
    
    const savedZoom = localStorage.getItem('pageZoom');
    if (savedZoom && parseFloat(savedZoom) !== 100) {
        console.log(`Nájdené priblíženie: ${savedZoom}%`);
        updateSpinnerText(`Načítavam priblíženie ${savedZoom}%...`);
    } else {
        updateSpinnerText("Inicializujem priblíženie...");
    }
};

// Funkcie pre konzolu
window.setZoom80 = () => {
    // Zobraziť biely prekryvný obdĺžnik s animovaným kolieskom pred zmenou priblíženia
    createWhiteOverlay();
    updateSpinnerText("Nastavujem priblíženie na 80%...");
    setZoomTo80Percent();
};

window.testResetZoom = () => {
    // Zobraziť biely prekryvný obdĺžnik s animovaným kolieskom pred resetom
    createWhiteOverlay();
    updateSpinnerText("Resetujem priblíženie...");
    resetZoom();
};

// Testovacia funkcia pre fixované elementy
window.testFixedElements = () => {
    const fixedElements = document.querySelectorAll('[style*="fixed"], .fixed, [class*="fixed"]');
    console.log(`Nájdené fixované elementy: ${fixedElements.length}`);
    fixedElements.forEach((el, i) => {
        const style = window.getComputedStyle(el);
        console.log(`Element ${i}:`, {
            tag: el.tagName,
            class: el.className,
            position: style.position,
            top: style.top,
            right: style.right,
            bottom: style.bottom,
            left: style.left
        });
    });
};

// Pridanie klávesovej skratky
document.addEventListener('keydown', (e) => {
    // Ctrl+8 pre 80%
    if (e.ctrlKey && e.key === '8') {
        e.preventDefault();
        // Zobraziť biely prekryvný obdĺžnik pred zmenou priblíženia
        createWhiteOverlay();
        updateSpinnerText("Nastavujem priblíženie na 80%...");
        setZoomTo80Percent();
    }
    // Ctrl+0 pre reset
    if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        // Zobraziť biely prekryvný obdĺžnik pred resetom
        createWhiteOverlay();
        updateSpinnerText("Resetujem priblíženie...");
        resetZoom();
    }
});

// Ostatný kód zostáva rovnaký...
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
    const firstApostrophe = text.indexOf("'");
    const secondApostrophe = text.indexOf("'", firstApostrophe + 1);
    const thirdApostrophe = text.indexOf("'", secondApostrophe + 1);
    const fourthApostrophe = text.indexOf("'", thirdApostrophe + 1);

    if (firstApostrophe !== -1 && secondApostrophe !== -1 && thirdApostrophe !== -1 && fourthApostrophe !== -1) {
        let oldText = text.substring(firstApostrophe + 1, secondApostrophe);
        let newText = text.substring(thirdApostrophe + 1, fourthApostrophe);

        if (oldText.startsWith('+') && newText.startsWith('+')) {
            oldText = formatPhoneNumber(oldText);
            newText = formatPhoneNumber(newText);
        }

        let formattedText = text.substring(0, firstApostrophe);
        formattedText += `<em>${oldText}</em>`;
        formattedText += text.substring(secondApostrophe + 1, thirdApostrophe);
        formattedText += `<strong>${newText}</strong>`;
        formattedText += text.substring(fourthApostrophe + 1);
        
        return formattedText;
    }
    
    return text;
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
        flex items-center space-x-2"
    `;

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '🔔';
    
    const formattedMessage = message.replace(/\n/g, '<br>');

    notificationElement.innerHTML = `
        <span>${icon}</span>
        <span>${formattedMessage}</span>
        <button onclick="document.getElementById('${notificationId}').remove()" class="absolute top-1 right-1 text-gray-400 hover:text-white">&times;</button>
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

            if (userProfileData.role === 'admin') {
                if (!unsubscribeFromNotifications) {
                    setupNotificationListenerForAdmin(userProfileData);
                }
            } else {
                if (unsubscribeFromNotifications) {
                    unsubscribeFromNotifications();
                    unsubscribeFromNotifications = null;
                    console.log("header.js: Listener notifikácií zrušený, pretože používateľ nie je admin.");
                }
            }
        } else {
            authLink.classList.remove('hidden');
            profileLink.classList.add('hidden');
            logoutButton.classList.add('hidden');
            headerElement.style.backgroundColor = getHeaderColorByRole(null);
            if (unsubscribeFromNotifications) {
                unsubscribeFromNotifications();
                unsubscribeFromNotifications = null;
                console.log("header.js: Listener notifikácií zrušený pri odhlásení.");
            }
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
    if (!window.db) {
        console.warn("header.js: Firestore databáza nie je inicializovaná pre notifikácie.");
        return;
    }

    if (unsubscribeFromNotifications) {
        unsubscribeFromNotifications();
    }
    
    const notificationsCollectionRef = collection(window.db, "notifications");
    
    unsubscribeFromNotifications = onSnapshot(notificationsCollectionRef, (snapshot) => {
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
            console.log("header.js: GlobalUserProfileData aktualizované s počtom neprečítaných notifikácií:", unreadCount);
        }

        if (userProfileData.displayNotifications) {
            if (unreadCount >= 3) {
                let message = '';
                if (unreadCount >= 5) {
                    message = `Máte ${unreadCount} nových neprečítaných upozornení.`;
                } else {
                    message = `Máte ${unreadCount} nové neprečítané upozornenia.`;
                }
                showDatabaseNotification(message, 'info');

                return; 
            }

            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added") {
                    const newNotification = change.doc.data();
                    const notificationId = change.doc.id;
                    
                    const seenBy = newNotification.seenBy || [];
                    if (!seenBy.includes(userId)) {
                        console.log("header.js: Nová notifikácia prijatá a nebola videná používateľom:", newNotification);
                        
                        let changesMessage = '';
                        if (Array.isArray(newNotification.changes) && newNotification.changes.length > 0) {
                            const changeLabel = newNotification.changes.length > 1 ? " zmenil tieto údaje:" : "zmenil tento údaj:";
                            changesMessage = `Používateľ ${newNotification.userEmail} ${changeLabel}\n`;
                            
                            const formattedChanges = newNotification.changes.map(changeString => formatNotificationMessage(changeString));
                            
                            changesMessage += formattedChanges.join('<br>');
                        } else if (typeof newNotification.changes === 'string') {
                            changesMessage = `Používateľ ${newNotification.userEmail} zmenil tento údaj:\n${formatNotificationMessage(newNotification.changes)}`;
                        } else {
                            changesMessage = `Používateľ ${newNotification.userEmail} vykonal zmenu.`;
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
        }
    }, (error) => {
        console.error("header.js: Chyba pri počúvaní notifikácií:", error);
    });

    console.log("header.js: Listener pre notifikácie admina nastavený.");
};

const setupFirestoreListeners = () => {
    if (!window.db) {
        console.warn("header.js: Firestore databáza nie je inicializovaná. Odkladám nastavenie listenerov.");
        return;
    }

    if (isFirestoreListenersSetup) {
        console.log("header.js: Listenery Firestore sú už nastavené.");
        return;
    }

    try {
        const registrationDocRef = doc(window.db, "settings", "registration");
        onSnapshot(registrationDocRef, (docSnap) => {
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

        const categoriesDocRef = doc(window.db, "settings", "categories");
        onSnapshot(categoriesDocRef, (docSnap) => {
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
        });

        isFirestoreListenersSetup = true;
        console.log("header.js: Firestore listenery boli úspešne nastavené.");

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
            console.log("header.js: Listener pre tlačidlo odhlásenia bol pridaný.");
        }

        window.addEventListener('globalDataUpdated', (event) => {
            console.log('header.js: Prijatá udalosť "globalDataUpdated". Aktualizujem hlavičku.');
            window.isGlobalAuthReady = true; 
            setupFirestoreListeners();
            updateHeaderLinks(event.detail);
        });

        if (window.isGlobalAuthReady) {
            console.log('header.js: Autentifikačné dáta sú už načítané, spúšťam listenery Firestore.');
            setupFirestoreListeners();
            updateHeaderLinks(window.globalUserProfileData);
        }

    } catch (error) {
        console.error("header.js: Chyba pri inicializácii hlavičky:", error);
    }
};

// Inicializácia priblíženia pri načítaní stránky
window.addEventListener('load', () => {
    initializeZoom();
    
    // Nastavíme na 80% po načítaní
    setTimeout(() => {
        const savedZoom = localStorage.getItem('pageZoom');
        if (!savedZoom || parseFloat(savedZoom) !== 80) {
            updateSpinnerText("Automaticky nastavujem priblíženie 80%...");
            setZoomTo80Percent();
        } else {
            // Ak už je na 80%, len re-aplikujeme a skryjeme koliesko rýchlejšie
            updateSpinnerText("Priblíženie už je nastavené na 80%...");
            setTimeout(() => {
                setZoomTo80Percent();
            }, 500);
        }
    }, 800);
});

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', window.loadHeaderAndScripts);
} else {
    window.loadHeaderAndScripts();
}

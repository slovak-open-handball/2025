import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { countryDialCodes } from "./countryDialCodes.js";

let registrationCheckIntervalId = null;
let unsubscribeFromNotifications = null; 
window.isRegistrationDataLoaded = false;
window.isCategoriesDataLoaded = false;
let isFirestoreListenersSetup = false; 
window.areCategoriesLoaded = false;

// **UPRAVENÉ: Funkcia pre nastavenie priblíženia na 80% - zachováva viditeľnosť**
const setZoomTo80Percent = () => {
    console.log("Nastavujem priblíženie na 80% (bez skrývania obsahu)");
    
    const targetZoom = 80;
    localStorage.setItem('pageZoom', targetZoom);
    
    // **Odstrániť predchádzajúce štýly, ktoré by mohli skrývať obsah**
    const oldStyles = document.getElementById('global-zoom-styles');
    if (oldStyles) oldStyles.remove();
    
    // **Použijeme kombináciu transform a zoom s opatrnými nastaveniami**
    const style = document.createElement('style');
    style.id = 'global-zoom-styles';
    
    // **Kritická zmena: Používame transform-origin a width, ktoré zachovávajú obsah**
    style.textContent = `
        /* Aplikujeme priblíženie na celú stránku */
        html {
            zoom: 0.8;
            -moz-transform: scale(0.8);
            -moz-transform-origin: 0 0;
            -o-transform: scale(0.8);
            -o-transform-origin: 0 0;
            -webkit-transform: scale(0.8);
            -webkit-transform-origin: 0 0;
        }
        
        /* Pre prehliadače, ktoré nepodporujú zoom na html */
        body {
            transform: scale(0.8);
            transform-origin: top left;
            width: 125%; /* Kompenzácia: 100/0.8 = 125 */
            height: auto;
            min-height: 125vh;
        }
        
        /* ZABEZPEČENIE VIDITEĽNOSTI HEADER */
        header, #header-placeholder, [id*="header"] {
            transform: scale(1) !important; /* Header zobrazujeme v plnej veľkosti */
            width: 100% !important;
            position: relative !important;
            z-index: 1000 !important;
        }
        
        /* Zabezpečíme, že všetok obsah je viditeľný */
        * {
            box-sizing: border-box !important;
        }
        
        /* Pre mobilné zariadenia - menej agresívne nastavenia */
        @media (max-width: 768px) {
            html {
                zoom: 1;
                transform: none !important;
            }
            
            body {
                transform: none !important;
                width: 100% !important;
                min-height: 100vh !important;
            }
        }
    `;
    
    document.head.appendChild(style);
    
    // **Pridáme viewport meta tag pre mobilné zariadenia**
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=0.8, maximum-scale=1.5, user-scalable=yes';
    
    console.log("Priblíženie na 80% aplikované (header viditeľný)");
    
    // **Uistíme sa, že header je viditeľný**
    setTimeout(() => {
        const header = document.querySelector('header');
        const headerPlaceholder = document.getElementById('header-placeholder');
        
        if (header) {
            header.style.visibility = 'visible';
            header.style.opacity = '1';
        }
        
        if (headerPlaceholder) {
            headerPlaceholder.style.visibility = 'visible';
            headerPlaceholder.style.opacity = '1';
        }
    }, 100);
    
    return true;
};

// **UPRAVENÉ: Funkcia pre obnovenie pôvodného priblíženia**
const resetZoom = () => {
    localStorage.setItem('pageZoom', 100);
    
    // Odstrániť globálne štýly
    const zoomStyles = document.getElementById('global-zoom-styles');
    if (zoomStyles) {
        zoomStyles.remove();
    }
    
    // Reset viewport
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.5, user-scalable=yes';
    }
    
    // Reset štýlov
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
    
    // Zobraziť všetok obsah
    document.querySelectorAll('header, #header-placeholder, [id*="header"]').forEach(el => {
        el.style.cssText = '';
    });
    
    console.log("Priblíženie obnovené na 100%");
};

// Funkcia pre vizuálnu spätnú väzbu (zostáva rovnaká)
const showZoomFeedback = (zoomLevel) => {
    const existingFeedback = document.getElementById('zoom-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
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
        z-index: 99999;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 2px solid #47b3ff;
    `;
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.style.opacity = '0';
        feedback.style.transition = 'opacity 0.5s ease';
        setTimeout(() => feedback.remove(), 500);
    }, 2000);
};

// **UPRAVENÉ: Inicializácia priblíženia - s oneskorením pre lepšiu kompatibilitu**
const initializeZoom = () => {
    // Skontrolujeme, či máme uložené priblíženie
    const savedZoom = localStorage.getItem('pageZoom');
    const shouldApply80Percent = !savedZoom || parseFloat(savedZoom) !== 80;
    
    // **Funkcia, ktorá aplikuje zoom s oneskorením pre lepšiu stabilitu**
    const applyZoom = () => {
        // Najprv uistíme sa, že dokument je pripravený
        if (!document.body) {
            setTimeout(applyZoom, 50);
            return;
        }
        
        if (shouldApply80Percent) {
            console.log("Aplikujem priblíženie 80% (prvýkrát)");
            setZoomTo80Percent();
        } else if (parseFloat(savedZoom) === 80) {
            console.log("Re-aplikujem priblíženie 80% (už bolo nastavené)");
            setZoomTo80Percent();
        }
        
        // Zobrazíme spätnú väzbu
        showZoomFeedback(savedZoom ? parseFloat(savedZoom) : 80);
    };
    
    // **Spustíme aplikáciu zoom s malým oneskorením**
    setTimeout(applyZoom, 100);
    
    console.log(`Inicializácia priblíženia. Saved zoom: ${savedZoom}, Apply 80%: ${shouldApply80Percent}`);
};

// **UPRAVENÉ: Spustíme inicializáciu priblíženia po načítaní dokumentu**
document.addEventListener('DOMContentLoaded', () => {
    initializeZoom();
});

// Funkcie pre konzolu
window.setZoom80 = () => {
    setZoomTo80Percent();
    showZoomFeedback(80);
};

window.testResetZoom = () => {
    resetZoom();
    showZoomFeedback(100);
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
            left: style.left,
            visibility: style.visibility,
            opacity: style.opacity
        });
    });
};

// Pridanie klávesovej skratky
document.addEventListener('keydown', (e) => {
    // Ctrl+8 pre 80%
    if (e.ctrlKey && e.key === '8') {
        e.preventDefault();
        setZoomTo80Percent();
        showZoomFeedback(80);
    }
    // Ctrl+0 pre reset
    if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        resetZoom();
        showZoomFeedback(100);
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
    // ... (pôvodný kód ostáva) ...
    return text;
};

const showDatabaseNotification = (message, type = 'info') => {
    // ... (pôvodný kód ostáva) ...
};

const handleLogout = async () => {
    // ... (pôvodný kód ostáva) ...
};

const getHeaderColorByRole = (role) => {
    // ... (pôvodný kód ostáva) ...
};

const updateHeaderLinks = (userProfileData) => {
    // ... (pôvodný kód ostáva) ...
};

const updateRegistrationLinkVisibility = (userProfileData) => {
    // ... (pôvodný kód ostáva) ...
};

const setupNotificationListenerForAdmin = (userProfileData) => {
    // ... (pôvodný kód ostáva) ...
};

const setupFirestoreListeners = () => {
    // ... (pôvodný kód ostáva) ...
};

// **UPRAVENÉ: Funkcia pre načítanie header s lepším časovaním**
window.loadHeaderAndScripts = async () => {
    try {
        // **Čakáme kým bude dokument pripravený**
        if (!document.body) {
            setTimeout(window.loadHeaderAndScripts, 100);
            return;
        }
        
        const headerPlaceholder = document.getElementById('header-placeholder');
        if (!headerPlaceholder) {
            console.error("header.js: header-placeholder nebol nájdený");
            return;
        }
        
        // **Najprv uistíme sa, že header-placeholder je viditeľný**
        headerPlaceholder.style.visibility = 'visible';
        headerPlaceholder.style.opacity = '1';
        headerPlaceholder.style.position = 'relative';
        headerPlaceholder.style.zIndex = '1000';
        
        const response = await fetch('header.html');
        
        if (!response.ok) throw new Error('Chyba pri načítaní header.html');
        const headerHtml = await response.text();
        
        headerPlaceholder.innerHTML = headerHtml;
        
        // **Uistíme sa, že nový header je viditeľný**
        const newHeader = headerPlaceholder.querySelector('header');
        if (newHeader) {
            newHeader.style.visibility = 'visible';
            newHeader.style.opacity = '1';
            newHeader.style.position = 'relative';
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

// **UPRAVENÉ: Spustíme načítanie header s oneskorením, aby bol viditeľný**
setTimeout(() => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.loadHeaderAndScripts);
    } else {
        window.loadHeaderAndScripts();
    }
}, 200);

// **Pridáme listener pre resize, ktorý re-aplikuje zoom a zabezpečí viditeľnosť**
window.addEventListener('resize', () => {
    const savedZoom = localStorage.getItem('pageZoom');
    if (savedZoom && parseFloat(savedZoom) === 80) {
        setTimeout(setZoomTo80Percent, 100);
    }
});

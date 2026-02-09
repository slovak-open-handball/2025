import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { countryDialCodes } from "./countryDialCodes.js";

let registrationCheckIntervalId = null;
let unsubscribeFromNotifications = null; 
window.isRegistrationDataLoaded = false;
window.isCategoriesDataLoaded = false;
let isFirestoreListenersSetup = false; 
window.areCategoriesLoaded = false;

// **UPRAVENÉ: Funkcia pre nastavenie priblíženia na 80% - optimalizovaná pre celú stránku**
const setZoomTo80Percent = () => {
    console.log("Nastavujem priblíženie na 80% pre celú stránku");
    
    const targetZoom = 80;
    localStorage.setItem('pageZoom', targetZoom);
    
    // **Kritická zmena: Použijeme viewport meta tag, ktorý ovplyvňuje celú stránku**
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        document.head.insertBefore(viewport, document.head.firstChild);
    }
    viewport.content = 'width=device-width, initial-scale=0.8, maximum-scale=0.8, user-scalable=yes';
    
    // **Pridáme globálne CSS pre celú stránku**
    if (!document.getElementById('global-zoom-styles')) {
        const style = document.createElement('style');
        style.id = 'global-zoom-styles';
        style.textContent = `
            /* Reset predchádzajúcich štýlov */
            html, body {
                transform: none !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            /* Aplikujeme priblíženie cez zoom property ak je podporovaná */
            html {
                zoom: 0.8;
            }
            
            /* Alternatíva pre prehliadače, ktoré nepodporujú zoom */
            body {
                transform: scale(0.8);
                transform-origin: top center;
                width: 125%;
                margin-left: -12.5%;
                position: relative;
            }
            
            /* Pre mobilné zariadenia - necháme viewport robiť prácu */
            @media (max-width: 768px) {
                body {
                    transform: none !important;
                    width: 100% !important;
                    margin-left: 0 !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log("Priblíženie na 80% aplikované na celú stránku");
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
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes';
    }
    
    // Reset štýlov na html a body
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
    
    console.log("Priblíženie obnovené na 100% pre celú stránku");
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

// **UPRAVENÉ: Inicializácia priblíženia - volá sa OKAMŽITE**
const initializeZoom = () => {
    // Skontrolujeme, či máme uložené priblíženie
    const savedZoom = localStorage.getItem('pageZoom');
    const shouldApply80Percent = !savedZoom || parseFloat(savedZoom) !== 80;
    
    // **Funkcia, ktorá aplikuje zoom čo najskôr**
    const applyZoomImmediately = () => {
        if (shouldApply80Percent) {
            setZoomTo80Percent();
        } else if (parseFloat(savedZoom) === 80) {
            setZoomTo80Percent(); // Re-aplikujeme pre konzistenciu
        }
    };
    
    // **Aplikujeme zoom čo najskôr**
    if (document.readyState === 'loading') {
        // Aplikujeme ihneď po načítaní HTML (pred obrázkami a štýlmi)
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(applyZoomImmediately, 0);
        });
        
        // **Kritická časť: Skúsime aplikovať ešte skôr pomocou MutationObserver**
        if (document.head) {
            const observer = new MutationObserver((mutations) => {
                // Keď sa objaví body element, aplikujeme zoom
                if (document.body) {
                    applyZoomImmediately();
                    observer.disconnect();
                }
            });
            
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        }
    } else {
        // Dokument je už načítaný - aplikujeme ihneď
        setTimeout(applyZoomImmediately, 0);
    }
    
    console.log(`Inicializácia priblíženia. Saved zoom: ${savedZoom}, Apply 80%: ${shouldApply80Percent}`);
};

// **UPRAVENÉ: Spustíme inicializáciu priblíženia IHNEĎ po načítaní skriptu**
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeZoom);
} else {
    initializeZoom();
}

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
            left: style.left
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

// **ODSTRÁNENÉ: load event listener - už nie je potrebný**

// Ostatný kód zostáva rovnaký...
window.showGlobalNotification = (message, type = 'success') => {
    // ... (pôvodný kód ostáva) ...
};

const formatPhoneNumber = (phoneNumber) => {
    // ... (pôvodný kód ostáva) ...
};

const formatNotificationMessage = (text) => {
    // ... (pôvodný kód ostáva) ...
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

// **UPRAVENÉ: Spustíme inicializáciu hlavičky**
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.loadHeaderAndScripts);
} else {
    window.loadHeaderAndScripts();
}

// **Pridáme automatickú aplikáciu zoom pri resize (pre istotu)**
window.addEventListener('resize', () => {
    const savedZoom = localStorage.getItem('pageZoom');
    if (savedZoom && parseFloat(savedZoom) === 80) {
        // Pre istotu re-aplikujeme zoom
        setTimeout(setZoomTo80Percent, 100);
    }
});

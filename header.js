// Ochrana proti zobrazeniu stránky v iframe
// Tento kód zabráni načítaniu obsahu stránky v iframe a namiesto toho zobrazí chybovú správu.
if (window.self !== window.top) {
    // Ak je stránka načítaná v iframe, zabránime jej zobrazeniu
    document.body.innerHTML = ''; // Vymaže všetok existujúci obsah tela
    document.body.style.margin = '0'; // Odstráni okraje tela
    document.body.style.overflow = 'hidden'; // Zabraňuje posúvaniu

    const errorMessageDiv = document.createElement('div');
    errorMessageDiv.textContent = 'Túto webovú stránku nie je možné zobraziť.';
    errorMessageDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: red;
        font-size: 2em;
        font-weight: bold;
        text-align: center;
        z-index: 9999;
        font-family: 'Inter', sans-serif; /* Používame font Inter pre konzistenciu */
    `;
    document.body.appendChild(errorMessageDiv);

    // Zastavíme načítanie ďalších skriptov a obsahu, ak je to možné
    throw new Error('Page cannot be displayed in an iframe.');
}

// Global application ID and Firebase configuration
// Tieto premenné sú definované v hlavnom HTML súbore a spravuje ich authentication.js
const { useEffect, useState, useRef } = React;
const { getAuth, signOut, onAuthStateChanged } = window.auth;
const { getFirestore, doc, getDoc } = window.db;

const Header = () => {
    const [user, setUser] = useState(null);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleAuthStateChange = (user) => {
            setUser(user);
        };
        const handleAuthStateReady = () => {
            if (window.isGlobalAuthReady && window.globalUserProfileData) {
                setUser(window.globalUserProfileData);
                updateHeaderLinks(window.globalUserProfileData);
            }
        };

        window.addEventListener('auth-state-changed', handleAuthStateReady);
        if (window.isGlobalAuthReady) {
            handleAuthStateReady();
        }

        const auth = window.auth;
        if (auth) {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    const db = window.db;
                    const userDocRef = doc(db, "users", user.uid);
                    getDoc(userDocRef).then((docSnap) => {
                        if (docSnap.exists()) {
                            const userData = docSnap.data();
                            handleAuthStateChange(userData);
                        } else {
                            handleAuthStateChange({ role: 'user', approved: false });
                        }
                    });
                } else {
                    handleAuthStateChange(null);
                    updateHeaderLinks(null);
                }
            });
        } else {
            console.warn("Header.js: Firebase Auth nie je k dispozícii.");
        }

        return () => {
            window.removeEventListener('auth-state-changed', handleAuthStateReady);
        };
    }, []);

    const updateHeaderLinks = (userData) => {
        const registerLink = document.getElementById('register-link');
        const profileLink = document.getElementById('profile-link');
        const authLink = document.getElementById('auth-link');
        const logoutButton = document.getElementById('logout-button');
        const adminLinks = document.querySelectorAll('.admin-link');
        const userLinks = document.querySelectorAll('.user-link');
        const teamLinks = document.querySelectorAll('.team-link');

        if (userData) {
            if (registerLink) registerLink.classList.remove('hidden');
            if (profileLink) profileLink.classList.remove('hidden');
            if (authLink) authLink.classList.add('hidden');
            if (logoutButton) logoutButton.classList.remove('hidden');
        } else {
            if (registerLink) registerLink.classList.add('hidden');
            if (profileLink) profileLink.classList.add('hidden');
            if (authLink) authLink.classList.remove('hidden');
            if (logoutButton) logoutButton.classList.add('hidden');
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(window.auth);
            if (window.showGlobalNotification) {
                window.showGlobalNotification('Úspešne ste sa odhlásili.', 'success');
            }
            console.log('User logged out successfully.');
            // Presmerovanie na domovskú stránku po odhlásení
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error signing out:', error);
            if (window.showGlobalNotification) {
                window.showGlobalNotification('Chyba pri odhlásení.', 'error', error.message);
            }
        }
    };

    useEffect(() => {
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }
        return () => {
            if (logoutButton) {
                logoutButton.removeEventListener('click', handleLogout);
            }
        };
    }, [handleLogout]);

    return null;
};

// Render GlobalHeaderAndNotifications do špecifického DOM elementu
let headerRoot = document.getElementById('header-notification-root');
if (!headerRoot) {
    headerRoot = document.createElement('div');
    headerRoot.id = 'header-notification-root';
    document.body.appendChild(headerRoot);
    console.log("Header: Vytvoril som a pridal 'header-notification-root' div do tela dokumentu.");
} else {
    console.log("Header: 'header-notification-root' div už existuje.");
}

try {
    // OPRAVA: Použitie createRoot namiesto render pre React 18
    const root = ReactDOM.createRoot(headerRoot);
    root.render(React.createElement(Header));
    console.log("Header: GlobalHeaderAndNotifications úspešne vykreslený.");
} catch (e) {
    console.error("Header: Chyba pri vykreslení GlobalHeaderAndNotifications:", e);
}

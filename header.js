// Ochrana proti zobrazeniu stránky v iframe
if (window.self !== window.top) {
    document.body.innerHTML = '';
    document.body.style.cssText = `
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
        font-family: 'Inter', sans-serif;
    `;
    const errorMessageDiv = document.createElement('div');
    errorMessageDiv.textContent = 'Túto webovú stránku nie je možné zobraziť.';
    document.body.appendChild(errorMessageDiv);
    throw new Error('Page cannot be displayed in an iframe.');
}

// Global application ID and Firebase configuration (používame už inicializované v authentication.js)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Modály pre notifikácie a potvrdenia
const { useEffect, useState, useCallback } = React;

const TopRightNotificationModal = ({ message, onClose, displayNotificationsEnabled }) => {
    if (!message || !displayNotificationsEnabled) return null;
    return (
        React.createElement(
            'div',
            {
                className: 'fixed top-4 right-4 z-[999] bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full',
                onClick: onClose
            },
            React.createElement('p', null, message)
        )
    );
};

const CenterConfirmationModal = ({ message, onClose, onConfirm, onCancel }) => {
    if (!message) return null;
    return (
        React.createElement(
            'div',
            { className: 'fixed inset-0 z-[1000] flex items-center justify-center bg-gray-800 bg-opacity-75' },
            React.createElement(
                'div',
                { className: 'bg-white p-6 rounded-lg shadow-xl text-center' },
                React.createElement('p', { className: 'text-lg font-semibold mb-4' }, message),
                React.createElement(
                    'div',
                    { className: 'flex justify-center space-x-4' },
                    onConfirm && React.createElement(
                        'button',
                        {
                            onClick: onConfirm,
                            className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition'
                        },
                        'Áno'
                    ),
                    onCancel && React.createElement(
                        'button',
                        {
                            onClick: onCancel,
                            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition'
                        },
                        'Nie'
                    ),
                    !onConfirm && !onCancel && React.createElement(
                        'button',
                        {
                            onClick: onClose,
                            className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition'
                        },
                        'OK'
                    )
                )
            )
        )
    );
};

// Hlavný React komponent pre hlavičku a notifikácie
function GlobalHeaderAndNotifications() {
    const [user, setUser] = useState(null);
    const [currentTopRightMessage, setCurrentTopRightMessage] = useState('');
    const [displayTopRightNotificationsEnabled, setDisplayTopRightNotificationsEnabled] = useState(true);
    const [currentCenterMessage, setCurrentCenterMessage] = useState('');
    const [confirmationPromise, setConfirmationPromise] = useState(null);

    // Načítanie užívateľských dát a aktualizácia UI
    const handleAuthStateChange = useCallback(() => {
        // Kontrolujeme, či sú globálne premenné už definované
        if (window.isGlobalAuthReady) {
            setUser(window.globalUserProfileData);
            // Zobrazíme/skryjeme odkazy podľa roly používateľa
            const profileLink = document.getElementById('profile-link');
            const authLink = document.getElementById('auth-link');
            const logoutButton = document.getElementById('logout-button');
            const registerLink = document.getElementById('register-link');
            const adminUsersLink = document.getElementById('admin-users-link');
            const adminRegSettingsLink = document.getElementById('admin-tournament-settings-link');

            // Skryjeme všetky autentifikačné odkazy a tlačidlá, aby sme predišli nesprávnemu stavu
            [profileLink, authLink, logoutButton, registerLink, adminUsersLink, adminRegSettingsLink].forEach(el => {
                if (el) el.classList.add('hidden');
            });

            if (window.globalUserProfileData) {
                // Používateľ je prihlásený
                if (profileLink) profileLink.classList.remove('hidden');
                if (logoutButton) logoutButton.classList.remove('hidden');

                if (window.globalUserProfileData.role === 'admin') {
                    if (adminUsersLink) adminUsersLink.classList.remove('hidden');
                    if (adminRegSettingsLink) adminRegSettingsLink.classList.remove('hidden');
                    if (registerLink) registerLink.classList.remove('hidden');
                } else if (window.globalUserProfileData.role === 'user' && window.globalUserProfileData.approved) {
                    if (registerLink) registerLink.classList.remove('hidden');
                }
            } else {
                // Používateľ nie je prihlásený
                if (authLink) authLink.classList.remove('hidden');
            }
        }
    }, []);

    // Pridáme event listener pre 'auth-state-changed'
    useEffect(() => {
        // Kontrola, či je Firebase Auth už pripravené (pri prvom načítaní)
        if (window.isGlobalAuthReady) {
            handleAuthStateChange();
        }

        window.addEventListener('auth-state-changed', handleAuthStateChange);
        return () => window.removeEventListener('auth-state-changed', handleAuthStateChange);
    }, [handleAuthStateChange]);

    const handleLogout = useCallback(async () => {
        if (!window.auth) return;
        try {
            await signOut(window.auth);
            window.showGlobalNotification('Úspešne ste sa odhlásili.', 'success');
            // Po odhlásení sa presmerujeme na domovskú stránku, čo je index.html
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            window.showGlobalNotification('Chyba pri odhlasovaní.', 'error');
            console.error('Chyba pri odhlasovaní:', error);
        }
    }, []);

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


    return React.createElement(
        React.Fragment,
        null,
        React.createElement(TopRightNotificationModal, {
            message: currentTopRightMessage,
            onClose: () => setCurrentTopRightMessage(''),
            displayNotificationsEnabled: displayTopRightNotificationsEnabled
        }),
        React.createElement(CenterConfirmationModal, {
            message: currentCenterMessage,
            onClose: () => setCurrentCenterMessage('')
        })
    );
}

// Render GlobalHeaderAndNotifications do špecifického DOM elementu
// Používame DOMContentLoaded, aby sme sa uistili, že je celý DOM pripravený
document.addEventListener('DOMContentLoaded', () => {
    let headerRoot = document.getElementById('header-notification-root');
    if (!headerRoot) {
        headerRoot = document.createElement('div');
        headerRoot.id = 'header-notification-root';
        document.body.appendChild(headerRoot);
    }
    
    // OPRAVA: Použitie createRoot namiesto render pre React 18
    try {
        const root = ReactDOM.createRoot(headerRoot);
        root.render(React.createElement(GlobalHeaderAndNotifications));
    } catch (e) {
        console.error("Header: Chyba pri vykreslení GlobalHeaderAndNotifications:", e);
    }
});

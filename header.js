// Ochrana proti zobrazeniu stránky v iframe
if (window.self !== window.top) {
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';

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
        font-family: 'Inter', sans-serif;
    `;
    document.body.appendChild(errorMessageDiv);

    throw new Error('Page cannot be displayed in an iframe.');
}

import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useEffect, useState } = React;

// Pomocné komponenty pre modálne okná
const TopRightNotificationModal = ({ message, onClose, displayNotificationsEnabled }) => {
    if (!message || !displayNotificationsEnabled) return null;
    return React.createElement(
        'div',
        {
            className: 'fixed top-16 right-4 z-50 p-4 bg-white rounded-lg shadow-lg max-w-sm',
            style: { transition: 'opacity 0.5s ease-in-out' }
        },
        React.createElement('div', { className: 'flex items-center' },
            React.createElement('div', { className: 'ml-3 text-sm font-medium text-gray-900' }, message),
            React.createElement('button', {
                onClick: onClose,
                className: 'ml-auto text-gray-400 hover:text-gray-900'
            }, '×')
        )
    );
};

const CenterConfirmationModal = ({ message, onClose }) => {
    if (!message) return null;
    return React.createElement(
        'div',
        { className: 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50' },
        React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-xl max-w-sm text-center' },
            React.createElement('p', { className: 'text-lg font-semibold mb-4' }, message),
            React.createElement('button', {
                onClick: onClose,
                className: 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-colors'
            }, 'Zavrieť')
        )
    );
};


// Hlavná komponenta pre hlavičku a notifikácie
function GlobalHeaderAndNotifications() {
    const [currentTopRightMessage, setCurrentTopRightMessage] = useState('');
    const [currentCenterMessage, setCurrentCenterMessage] = useState(null);
    const [displayTopRightNotificationsEnabled, setDisplayTopRightNotificationsEnabled] = useState(true);

    const showCenterConfirmation = (message) => {
        setCurrentCenterMessage(message);
    };
    
    const handleLogout = async () => {
        try {
            const auth = getAuth();
            await signOut(auth);
            console.log("Používateľ bol úspešne odhlásený.");
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Chyba pri odhlásení:", error);
            showCenterConfirmation(`Chyba pri odhlásení: ${error.message}`);
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

    useEffect(() => {
        const handleAuthStateReady = () => {
            const user = window.globalUserProfileData;
            const registerLink = document.getElementById('register-link');
            const profileLink = document.getElementById('profile-link');
            const authLink = document.getElementById('auth-link');
            const logoutButton = document.getElementById('logout-button');
    
            if (registerLink) registerLink.classList.add('hidden');
            if (profileLink) profileLink.classList.add('hidden');
            if (authLink) authLink.classList.add('hidden');
            if (logoutButton) logoutButton.classList.add('hidden');
            
            if (user) {
                if (user.role === 'admin') {
                    if (profileLink) {
                        profileLink.href = 'logged-in-users.html';
                        profileLink.textContent = 'Admin zóna';
                        profileLink.classList.remove('hidden');
                    }
                } else if (user.role === 'user') {
                    if (profileLink) {
                        profileLink.href = 'logged-in-my-data.html';
                        profileLink.textContent = 'Moja zóna';
                        profileLink.classList.remove('hidden');
                    }
                    if (registerLink) registerLink.classList.remove('hidden');
                }
                if (logoutButton) logoutButton.classList.remove('hidden');
            } else {
                if (authLink) authLink.classList.remove('hidden');
                if (registerLink) registerLink.classList.remove('hidden');
            }
        };

        if (window.isGlobalAuthReady) {
            handleAuthStateReady();
        }
        
        window.addEventListener('auth-state-changed', handleAuthStateReady);
        return () => {
            window.removeEventListener('auth-state-changed', handleAuthStateReady);
        };
    }, []);

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
            onClose: () => setCurrentCenterMessage(null)
        })
    );
}

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
    ReactDOM.render(
        React.createElement(GlobalHeaderAndNotifications),
        headerRoot
    );
    console.log("Header: GlobalHeaderAndNotifications úspešne vykreslený.");
} catch (e) {
    console.error("Header: Chyba pri vykreslení GlobalHeaderAndNotifications:", e);
}

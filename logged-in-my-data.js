// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

// Import komponentu pre modálne okno, ktorý je teraz v samostatnom súbore
import { ChangeProfileModal } from "./logged-in-my-data-change-profile-modal.js";

const { useState, useEffect } = React;

/**
 * Globálna funkcia pre zobrazenie notifikácií
 */
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    let bgColorClass, textColorClass;
    if (type === 'success') {
        bgColorClass = 'bg-green-100';
        textColorClass = 'text-green-800';
    } else if (type === 'error') {
        bgColorClass = 'bg-red-100';
        textColorClass = 'text-red-800';
    } else {
        bgColorClass = 'bg-blue-100';
        textColorClass = 'text-blue-800';
    }

    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    notificationElement.textContent = message;

    setTimeout(() => {
        notificationElement.style.opacity = '1';
    }, 100);

    setTimeout(() => {
        notificationElement.style.opacity = '0';
    }, 5000);
};

// Funkcia na detekciu predvoľby z telefónneho čísla
const detectDialCodeFromPhoneNumber = (phoneNumber, dialCodes) => {
    const sortedDialCodes = [...dialCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const country of sortedDialCodes) {
        if (phoneNumber.startsWith(country.dialCode)) {
            return country.dialCode;
        }
    }
    return '';
};

// Funkcia na formátovanie telefónneho čísla
const formatPhoneNumber = (phoneNumber, dialCodes) => {
    if (!phoneNumber) {
        return 'Nezadané';
    }
    const detectedDialCode = detectDialCodeFromPhoneNumber(phoneNumber, dialCodes);
    if (detectedDialCode) {
        const numberWithoutDialCode = phoneNumber.substring(detectedDialCode.length).trim();
        // Pridáme medzery pre lepšiu čitateľnosť, ak je to možné
        if (numberWithoutDialCode.length === 9) {
            return `${detectedDialCode} ${numberWithoutDialCode.substring(0, 3)} ${numberWithoutDialCode.substring(3, 6)} ${numberWithoutDialCode.substring(6, 9)}`;
        }
        return `${detectedDialCode} ${numberWithoutDialCode}`;
    }
    return phoneNumber;
};


/**
 * Hlavný komponent aplikácie "Moja zóna".
 */
export const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [roleColor, setRoleColor] = useState('#007BFF'); // Predvolená farba
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        const app = initializeApp(JSON.parse(__firebase_config));
        const auth = getAuth(app);
        const db = getFirestore(app);

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    await signInWithCustomToken(auth, __initial_auth_token);
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDocSnap = await getDoc(userDocRef);

                    if (userDocSnap.exists()) {
                        const data = userDocSnap.data();
                        setUserProfileData(data);
                        setRoleColor(getRoleColor(data.role));
                    } else {
                        console.log("No such document!");
                    }
                } catch (error) {
                    console.error("Error signing in or fetching user data:", error);
                }
            } else {
                console.log("User is not signed in.");
                setUserProfileData(null);
            }
            setIsLoading(false);
        });

        return () => {
            unsubscribeAuth();
        };
    }, []);

    const getRoleColor = (role) => {
        switch (role) {
            case 'admin':
                return '#EF4444'; // red-500
            case 'vydavatel':
                return '#3B82F6'; // blue-500
            case 'editor':
                return '#10B981'; // green-500
            default:
                return '#6B7280'; // gray-500
        }
    };
    
    // Zobrazí správne formátované telefónne číslo
    const displayedPhoneNumber = userProfileData?.contactPhoneNumber ? formatPhoneNumber(userProfileData.contactPhoneNumber, countryDialCodes) : 'Nezadané';

    if (isLoading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center pt-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        );
    }

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'flex flex-col items-center justify-center h-full' },
            React.createElement(
                'h2',
                { className: 'text-2xl font-bold text-gray-800' },
                'Žiadne používateľské údaje'
            ),
            React.createElement(
                'p',
                { className: 'text-gray-600 mt-2' },
                'Prosím, prihláste sa, aby ste videli svoje údaje.'
            )
        );
    }

    const { firstName, lastName, role, email } = userProfileData;

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8' },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-xl overflow-hidden' },
            React.createElement(
                'div',
                { className: 'p-8' },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center mb-6' },
                    React.createElement(
                        'h1',
                        { className: 'text-3xl font-bold text-gray-900' },
                        'Môj profil'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => setShowModal(true),
                            className: `px-6 py-2 rounded-lg font-medium text-white transition-colors duration-200`,
                            style: { backgroundColor: roleColor }
                        },
                        'Upraviť'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 mt-8' },
                    // Meno
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800' },
                            'Meno a priezvisko:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            `${firstName} ${lastName}`
                        )
                    ),
                    // Rola
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800' },
                            'Rola:'
                        ),
                        React.createElement(
                            'div',
                            { className: 'text-lg mt-1' },
                            React.createElement(
                                'span',
                                {
                                    className: `inline-block px-3 py-1 rounded-full text-sm font-semibold text-white`,
                                    style: { backgroundColor: roleColor }
                                },
                                role.charAt(0).toUpperCase() + role.slice(1)
                            )
                        )
                    ),
                    // E-mail
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800' },
                            'E-mailová adresa:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            email || 'Nezadané'
                        )
                    ),
                    // Telefónne číslo
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800' },
                            'Telefónne číslo:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            displayedPhoneNumber
                        )
                    )
                )
            )
        ),
        // Na tomto mieste sa modálne okno zavolá a po úspešnom uložení zmien sa zobrazí notifikácia
        React.createElement(ChangeProfileModal, {
            show: showModal,
            onClose: () => setShowModal(false),
            onSaveSuccess: () => {
                setShowModal(false);
                window.showGlobalNotification('Profilové údaje boli úspešne zmenené', 'success');
            },
            userProfileData: userProfileData,
            roleColor: roleColor
        })
    );
};

// Renderovanie aplikácie do DOM
const rootElement = document.getElementById('root');
if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(MyDataApp, null));
    console.log("MyDataApp.js: Aplikácia vykreslená.");
} else {
    console.error("MyDataApp.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
}

// Explicitne sprístupníme komponent pre ladenie alebo externé použitie
window.MyDataApp = MyDataApp;

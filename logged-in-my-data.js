import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { countryDialCodes } from "./countryDialCodes.js";
import { ChangeProfileModal } from "./logged-in-my-data-change-profile-modal.js";
import { ChangeBillingModal } from "./logged-in-my-data-change-billing-modal.js";
import { ChangeVolunteerModal } from "./logged-in-my-data-change-volunteer-modal.js";

const { useState, useEffect, useRef, useSyncExternalStore } = React;

window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }
    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success':
            typeClasses = 'bg-green-500 text-white';
            break;
        case 'error':
            typeClasses = 'bg-red-500 text-white';
            break;
        case 'info':
            typeClasses = 'bg-blue-500 text-white';
            break;
        default:
            typeClasses = 'bg-gray-700 text-white';
    }
    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '-';
    const cleanNumber = phoneNumber.replace(/\s/g, '');
    const sortedDialCodes = [...countryDialCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);
    let dialCode = '';
    let restOfNumber = '';
    for (const country of sortedDialCodes) {
        if (cleanNumber.startsWith(country.dialCode)) {
            dialCode = country.dialCode;
            restOfNumber = cleanNumber.substring(country.dialCode.length);
            break;
        }
    }
    if (!dialCode) {
        return cleanNumber;
    }
    const parts = [];
    for (let i = 0; i < restOfNumber.length; i += 3) {
        parts.push(restOfNumber.substring(i, i + 3));
    }
    if (parts.length > 0) {
        return `${dialCode} ${parts.join(' ')}`;
    } else {
        return dialCode;
    }
};

const ProfileSection = ({ userProfileData, onOpenProfileModal, onOpenBillingModal, onOpenVolunteerModal, canEdit, isPasswordChangeOnlyMode }) => {
    const getRoleColor = (role) => {
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
    };
    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';
    const getFullRoleName = (role) => {
        switch (role) {
            case 'admin':
                return 'Administrátor';
            case 'super-admin':
                return 'Super administrátor';
            case 'club':
                return 'Klub';
            case 'referee':
                return 'Rozhodca';
            case 'volunteer':
                return 'Dobrovoľník';
            case 'hall':
                return 'Športová hala';
            default:
                return 'Používateľ';
        }
    };
    const profileCardTitle = userProfileData?.role === 'club' ? 'Kontaktná osoba' : 'Moje údaje';
    const nameLabel = userProfileData?.role === 'club' ? 'Meno a priezvisko kontaktnej osoby' : 'Meno a priezvisko';
    const emailLabel = userProfileData?.role === 'club' ? 'E-mailová adresa kontaktnej osoby' : 'E-mailová adresa';
    const phoneLabel = userProfileData?.role === 'club' ? 'Telefónne číslo kontaktnej osoby' : 'Telefónne číslo';
    const showProfilePencil = canEdit || (userProfileData.role === 'club' && isPasswordChangeOnlyMode);    
    const showBillingPencil = canEdit;
    const showVolunteerPencil = canEdit;

    // Funkcia na formátovanie dátumu
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('sk-SK');
        } catch (e) {
            return dateString;
        }
    };

    // Funkcia na získanie textu pohlavia
    const getGenderText = (gender) => {
        if (gender === 'male') return 'Muž';
        if (gender === 'female') return 'Žena';
        return gender || '-';
    };

    // Profilový box (spoločný pre všetkých)
    const profileContent = React.createElement(
        'div',
        { className: `w-full max-w-2xl bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]` },
        React.createElement(
            'div',
            { className: `flex items-center justify-between mb-6 p-4 -mx-8 -mt-8 rounded-t-xl text-white`, style: { backgroundColor: roleColor } },
            React.createElement('h2', { className: 'text-3xl font-bold tracking-tight' }, profileCardTitle),
            showProfilePencil && React.createElement(
                'button',
                {
                    onClick: onOpenProfileModal,
                    className: 'flex items-center space-x-2 px-4 py-2 rounded-full bg-white text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white hover:bg-gray-100',
                    'aria-label': 'Upraviť profil',
                    style: { color: roleColor }
                },
                React.createElement(
                    'svg',
                    { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                ),
                React.createElement('span', { className: 'font-medium' }, 'Upraviť')
            )
        ),
        React.createElement(
            'div',
            { className: 'space-y-6 text-lg' },
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, nameLabel),
                React.createElement('div', { className: 'font-normal' }, `${userProfileData.firstName} ${userProfileData.lastName}`)
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, emailLabel),
                React.createElement('div', { className: 'font-normal' }, userProfileData.email)
            ),
            userProfileData.role !== 'admin' && userProfileData.role !== 'hall' && 
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, phoneLabel),
                React.createElement('div', { className: 'font-normal' }, formatPhoneNumber(userProfileData.contactPhoneNumber))
            ),
            userProfileData.club && userProfileData.club !== '' &&
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Klub'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.club)
            )
        )
    );

    // Box pre dobrovoľnícke údaje (len pre rolu volunteer)
    let volunteerContent = null;
    if (userProfileData?.role === 'volunteer') {
        volunteerContent = React.createElement(
            'div',
            { className: 'w-full max-w-2xl bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]' },
            React.createElement(
                'div',
                { className: 'flex items-center justify-between mb-6 p-4 -mx-8 -mt-8 rounded-t-xl text-white', style: { backgroundColor: roleColor } },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight' }, 'Osobné údaje'),
                showVolunteerPencil && React.createElement(
                    'button',
                    {
                        onClick: onOpenVolunteerModal,
                        className: 'flex items-center space-x-2 px-4 py-2 rounded-full bg-white text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white hover:bg-gray-100',
                        'aria-label': 'Upraviť osobné údaje',
                        style: { color: roleColor }
                    },
                    React.createElement(
                        'svg',
                        { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                    ),
                    React.createElement('span', { className: 'font-medium' }, 'Upraviť')
                )
            ),
            React.createElement(
                'div',
                { className: 'space-y-6 text-gray-700 text-lg' },
                React.createElement('div', null,
                    React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Adresa trvalého bydliska'),
                    React.createElement('div', { className: 'font-normal' },
                        `${userProfileData.street || '-'} ${userProfileData.houseNumber || '-'}, ${userProfileData.postalCode ? userProfileData.postalCode.slice(0, 3) + ' ' + userProfileData.postalCode.slice(3) : '-'} ${userProfileData.city || '-'}, ${userProfileData.country || '-'}`
                    )
                ),
                React.createElement('div', { className: 'grid grid-cols-2 gap-4' },
                    React.createElement('div', null,
                        React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Pohlavie'),
                        React.createElement('div', { className: 'font-normal' }, getGenderText(userProfileData.gender))
                    ),
                    React.createElement('div', null,
                        React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Dátum narodenia'),
                        React.createElement('div', { className: 'font-normal' }, formatDate(userProfileData.birthDate))
                    )
                ),
                userProfileData.tshirtSize && React.createElement('div', null,
                    React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Veľkosť trička'),
                    React.createElement('div', { className: 'font-normal' }, userProfileData.tshirtSize)
                ),
                userProfileData.volunteerRoles && userProfileData.volunteerRoles.length > 0 && React.createElement('div', null,
                    React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Dobrovoľnícke roly'),
                    React.createElement('div', { className: 'font-normal flex flex-wrap gap-2 mt-1' },
                        userProfileData.volunteerRoles.map((role, idx) => 
                            React.createElement('span', { key: idx, className: 'bg-gray-100 px-3 py-1 rounded-full text-sm' }, role)
                        )
                    )
                ),
                userProfileData.selectedDates && userProfileData.selectedDates.length > 0 && (() => {
                    // Zoradenie dátumov od najskoršieho po najneskorší
                    const sortedDates = [...userProfileData.selectedDates].sort((a, b) => {
                        const dateA = new Date(a);
                        const dateB = new Date(b);
                        return dateA - dateB;
                    });                    
                    return React.createElement('div', null,
                        React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Dostupnosť - vybrané dátumy'),
                        React.createElement('div', { className: 'font-normal flex flex-wrap gap-2 mt-1' },
                            sortedDates.map((date, idx) => 
                                React.createElement('span', { key: idx, className: 'bg-gray-100 px-3 py-1 rounded-full text-sm' }, formatDate(date))
                            )
                        )
                    );
                })(),
                userProfileData.note && React.createElement('div', null,
                    React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Poznámka'),
                    React.createElement('div', { className: 'font-normal italic' }, userProfileData.note)
                )
            )
        );
    }

    // Upravená časť ProfileSection - zobrazenie fakturačných údajov z usersprivate
    let billingContent = null;
    if (userProfileData.role !== 'admin' && userProfileData.role !== 'hall' && userProfileData.role !== 'referee' && userProfileData.role !== 'volunteer') {
        // Získame fakturačnú adresu z usersprivate (billingAddress)
        const billingAddress = userProfileData.billingAddress || {};
        
        billingContent = React.createElement(
            'div',
            { className: 'w-full max-w-2xl bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]' },
            React.createElement(
                'div',
                { className: 'flex items-center justify-between mb-6 p-4 -mx-8 -mt-8 rounded-t-xl text-white', style: { backgroundColor: roleColor } },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight' }, 'Fakturačné údaje'),
                showBillingPencil && React.createElement(
                    'button',
                    {
                        onClick: onOpenBillingModal,
                        className: 'flex items-center space-x-2 px-4 py-2 rounded-full bg-white text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white hover:bg-gray-100',
                        'aria-label': 'Upraviť fakturačné údaje',
                        style: { color: roleColor }
                    },
                    React.createElement(
                        'svg',
                        { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                    ),
                    React.createElement('span', { className: 'font-medium' }, 'Upraviť')
                )
            ),
            React.createElement(
                'div',
                { className: 'space-y-6 text-gray-700 text-lg' },
                React.createElement('div', null,
                    React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Oficiálny názov klubu'),
                    React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.clubName || '-')
                ),
                React.createElement('div', null,
                    React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Adresa'),
                    React.createElement('div', { className: 'font-normal' },
                        `${billingAddress.street || '-'} ${billingAddress.houseNumber || '-'}, ${billingAddress.postalCode ? billingAddress.postalCode.slice(0, 3) + ' ' + billingAddress.postalCode.slice(3) : '-'} ${billingAddress.city || '-'}, ${billingAddress.country || '-'}`
                    )
                ),
                React.createElement('div', null,
                    React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'IČO'),
                    React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.ico || '-')
                ),
                React.createElement('div', null,
                    React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'DIČ'),
                    React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.dic || '-')
                ),
                React.createElement('div', null,
                    React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'IČ DPH'),
                    React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.icdph || '-')
                )
            )
        );
    }

    // Zoznam boxov na zobrazenie
    const boxes = [profileContent];
    if (volunteerContent) boxes.push(volunteerContent);
    if (billingContent) boxes.push(billingContent);

    return React.createElement(
        'div',
        { className: 'flex flex-col items-center gap-8' },
        boxes
    );
};

const globalDataStore = (() => {
    let internalSnapshot = {};
    let listeners = new Set();
    const getGlobalState = () => {
        return {
            isGlobalAuthReady: window.isGlobalAuthReady || false,
            isRegistrationDataLoaded: window.isRegistrationDataLoaded || false,
            isCategoriesDataLoaded: window.isCategoriesDataLoaded || false,
        };
    };
    const emitChange = () => {
        const newGlobalState = getGlobalState();
        let changed = false;
        if (JSON.stringify(newGlobalState) !== JSON.stringify(internalSnapshot)) {
            changed = true;
        }        
        if (changed) {
            internalSnapshot = newGlobalState;
            listeners.forEach(listener => listener());
        }
    };
    internalSnapshot = getGlobalState();
    const getSnapshotForReact = () => internalSnapshot;
    const subscribeForReact = (callback) => {
        listeners.add(callback);
        window.addEventListener('globalDataUpdated', emitChange);
        window.addEventListener('categoriesLoaded', emitChange);
        return () => {
            listeners.delete(callback);
            window.removeEventListener('globalDataUpdated', emitChange);
            window.removeEventListener('categoriesLoaded', emitChange);
        };
    };

    return { getSnapshot: getSnapshotForReact, subscribe: subscribeForReact };
})();

const MyDataApp = ({ userProfileData }) => {
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [showVolunteerModal, setShowVolunteerModal] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [settingsRegistrationDates, setSettingsRegistrationDates] = useState(null);
    const [isPasswordChangeOnlyMode, setIsPasswordChangeOnlyMode] = useState(false);
    const { 
        isGlobalAuthReady, 
        isRegistrationDataLoaded, 
        isCategoriesDataLoaded, 
    } = useSyncExternalStore(globalDataStore.subscribe, globalDataStore.getSnapshot);
    
    useEffect(() => {
        if (!window.db) {
            return;
        }
        const registrationDocRef = doc(window.db, "settings", "registration");
        const unsubscribe = onSnapshot(registrationDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSettingsRegistrationDates(data);
            } else {
                setSettingsRegistrationDates(null);
            }
        }, (error) => {
            setSettingsRegistrationDates(null);
        });
        return () => unsubscribe();
    }, [window.db]); 
    
    useEffect(() => {
        if (userProfileData) {
            setShowProfileModal(false);
            setShowBillingModal(false);
            setShowVolunteerModal(false);
        }
    }, [userProfileData]);
    
    useEffect(() => {
        let timer;         
        const updateCanEditStatus = () => {
            setCanEdit(false); 
            setIsPasswordChangeOnlyMode(false);
            if (!userProfileData || !isGlobalAuthReady || !isRegistrationDataLoaded || !isCategoriesDataLoaded || !settingsRegistrationDates) {
                return;
            }
            const isAdmin = userProfileData.role === 'admin';
            if (isAdmin) {
                setCanEdit(true);
                return; 
            }
            
            // SPRÁVNA KONVERZIA DÁTUMU - ošetrenie pre Timestamp aj Date
            let deadlineDate = null;
            
            // Najprv skúsime získať dátum z userProfileData
            if (userProfileData?.dataEditDeadline) {
                if (typeof userProfileData.dataEditDeadline.toDate === 'function') {
                    deadlineDate = userProfileData.dataEditDeadline.toDate();
                } 
                else if (userProfileData.dataEditDeadline instanceof Date) {
                    deadlineDate = userProfileData.dataEditDeadline;
                } 
                else if (userProfileData.dataEditDeadline.seconds !== undefined) {
                    deadlineDate = new Date(userProfileData.dataEditDeadline.seconds * 1000);
                } 
                else {
                    deadlineDate = new Date(userProfileData.dataEditDeadline);
                }
            }
            
            // Ak nemáme deadline z userProfileData, použijeme z settings
            if (!deadlineDate && settingsRegistrationDates?.dataEditDeadline) {
                if (typeof settingsRegistrationDates.dataEditDeadline.toDate === 'function') {
                    deadlineDate = settingsRegistrationDates.dataEditDeadline.toDate();
                } 
                else if (settingsRegistrationDates.dataEditDeadline instanceof Date) {
                    deadlineDate = settingsRegistrationDates.dataEditDeadline;
                } 
                else if (settingsRegistrationDates.dataEditDeadline.seconds !== undefined) {
                    deadlineDate = new Date(settingsRegistrationDates.dataEditDeadline.seconds * 1000);
                } 
                else {
                    deadlineDate = new Date(settingsRegistrationDates.dataEditDeadline);
                }
            }
            
            // KONTROLA: Vypíšeme deadline a aktuálny čas pre debug
            if (deadlineDate) {
                console.log('=== DEADLINE CHECK ===');
                console.log('Deadline date:', deadlineDate);
                console.log('Deadline timestamp:', deadlineDate.getTime());
                console.log('Current time:', new Date());
                console.log('Current timestamp:', Date.now());
                console.log('Is now <= deadline?', Date.now() <= deadlineDate.getTime());
                console.log('User role:', userProfileData.role);
            }
            
            const deadlineMillis = deadlineDate ? deadlineDate.getTime() : null;
            
            if (deadlineMillis !== null) { 
                const nowMillis = Date.now();
                // UPRAVENÉ: Odstránená výnimka pre referee a volunteer
                if (nowMillis <= deadlineMillis) { 
                    setCanEdit(true); 
                    if (timer) clearTimeout(timer);
                    if (deadlineMillis - nowMillis > 0) {
                        timer = setTimeout(() => {
                            setCanEdit(false);
                            if (userProfileData.role === 'club') {
                                setIsPasswordChangeOnlyMode(true);
                            } else {
                                setIsPasswordChangeOnlyMode(false);
                            }
                        }, deadlineMillis - nowMillis + 100); 
                    }
                } else {
                    setCanEdit(false);
                    if (userProfileData.role === 'club') {
                        setIsPasswordChangeOnlyMode(true);
                    } else {
                        setIsPasswordChangeOnlyMode(false);
                    }
                }
            } else {
                // Ak nie je žiadny deadline, NEPOVOLÍME editáciu nikomu (okrem admina)
                setCanEdit(false);
                setIsPasswordChangeOnlyMode(false);
            }
        };
        updateCanEditStatus();
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [userProfileData, isGlobalAuthReady, isRegistrationDataLoaded, isCategoriesDataLoaded, settingsRegistrationDates]);
    
    const getRoleColor = (role) => {
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
    };
    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';
    
    return React.createElement(
        'div',
        { className: 'flex-grow' },
        React.createElement(
            ProfileSection,
            {
                userProfileData: userProfileData,
                onOpenProfileModal: () => setShowProfileModal(true),
                onOpenBillingModal: () => setShowBillingModal(true),
                onOpenVolunteerModal: () => setShowVolunteerModal(true),
                canEdit: canEdit,
                isPasswordChangeOnlyMode: isPasswordChangeOnlyMode
            }
        ),
        React.createElement(
            ChangeProfileModal,
            {
                show: showProfileModal,
                onClose: () => setShowProfileModal(false),
                userProfileData: userProfileData,
                roleColor: roleColor,
                onlyAllowPasswordChange: isPasswordChangeOnlyMode
            }
        ),
        React.createElement(
            ChangeBillingModal,
            {
                show: showBillingModal,
                onClose: () => setShowBillingModal(false),
                userProfileData: userProfileData,
                roleColor: roleColor
            }
        ),
        React.createElement(
            ChangeVolunteerModal,
            {
                show: showVolunteerModal,
                onClose: () => setShowVolunteerModal(false),
                userProfileData: userProfileData,
                roleColor: roleColor
            }
        )
    );
};

let isEmailSyncListenerSetup = false;

const loadUserPrivateData = async (uid) => {
    // Kontrola, či je window.db inicializované
    if (!window.db) {
        console.warn('loadUserPrivateData: window.db nie je inicializované');
        return {};
    }
    
    try {
        const privateDocRef = doc(window.db, 'usersprivate', uid);
        const privateDocSnap = await getDoc(privateDocRef);
        if (privateDocSnap.exists()) {
            return privateDocSnap.data();
        }
        return {};
    } catch (error) {
        console.error('Chyba pri načítaní usersprivate:', error);
        return {};
    }
};

let privateDataLoaded = false;

const handleDataUpdateAndRender = async (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');
    
    if (!userProfileData) {
        // Zobrazíme spinner
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center h-full pt-16' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
                )
            );
        }
        return;
    }
    
    // Ak nemáme uid, nemôžeme načítať private dáta
    if (!userProfileData.uid) {
        console.warn('handleDataUpdateAndRender: Chýba uid v userProfileData');
        // Zobrazíme dáta bez private dát
        renderMyDataApp(userProfileData, {});
        return;
    }
    
    // Načítame dáta z usersprivate (iba ak je window.db dostupný)
    let privateData = {};
    if (window.db) {
        try {
            privateData = await loadUserPrivateData(userProfileData.uid);
            console.log('handleDataUpdateAndRender: Načítané private dáta:', privateData);
        } catch (error) {
            console.error('handleDataUpdateAndRender: Chyba pri načítaní private dát:', error);
        }
    } else {
        console.warn('handleDataUpdateAndRender: window.db nie je dostupný, private dáta sa nenačítajú');
    }
    
    // Zlúčime dáta z users a usersprivate
    const mergedData = {
        ...userProfileData,
        billingAddress: privateData.billingAddress || {},
        address: privateData.address || {},
        persons: privateData.persons || {},
        // Zachováme aj pôvodné polia pre prípad, že by tam boli
        ...privateData
    };
    
    // Renderujeme aplikáciu s merged dátami
    renderMyDataApp(mergedData, privateData);
    
    // Nastavíme listener pre email synchronizáciu (iba raz)
    if (window.auth && window.db && !isEmailSyncListenerSetup) {            
        onAuthStateChanged(window.auth, async (user) => {
            if (user) {
                try {
                    const userProfileRef = doc(window.db, 'users', user.uid);
                    const docSnap = await getDoc(userProfileRef);
        
                    if (docSnap.exists()) {
                        const firestoreEmail = docSnap.data().email;
                        if (user.email !== firestoreEmail) {                                
                            await updateDoc(userProfileRef, {
                                email: user.email
                            });            
                            const notificationsCollectionRef = collection(window.db, 'notifications');
                            await addDoc(notificationsCollectionRef, {
                                userEmail: user.email,
                                changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                timestamp: new Date(),
                            });                                
                            window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');            
                        }
                    }
                } catch (error) {
                    window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                }
            }
        });
        isEmailSyncListenerSetup = true; 
    }
};

const renderMyDataApp = (userProfileData, privateData) => {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MyDataApp, { userProfileData }));
    }
};

window.addEventListener('dbInitialized', async () => {
    console.log('logged-in-my-data: dbInitialized event received');
    // Ak už máme globalUserProfileData, načítame private dáta
    if (window.globalUserProfileData) {
        await handleDataUpdateAndRender({ detail: window.globalUserProfileData });
    }
});

// Načítanie počiatočných dát
if (window.globalUserProfileData) {
    // Ak už máme globalUserProfileData, načítame private dáta
    // Počkáme ale na inicializáciu db
    if (window.db) {
        handleDataUpdateAndRender({ detail: window.globalUserProfileData });
    } else {
        // Počkáme na udalosť dbInitialized
        console.log('logged-in-my-data: Čakám na inicializáciu db...');
        // Zobrazíme spinner
        const rootElement = document.getElementById('root');
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center h-full pt-16' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
                )
            );
        }
    }
} else {
    // Žiadne dáta, zobrazíme spinner
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            React.createElement(
                'div',
                { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
}

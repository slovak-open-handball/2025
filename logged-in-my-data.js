import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { countryDialCodes } from "./countryDialCodes.js";
import { ChangeProfileModal } from "./logged-in-my-data-change-profile-modal.js";
import { ChangeBillingModal } from "./logged-in-my-data-change-billing-modal.js";
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
const ProfileSection = ({ userProfileData, onOpenProfileModal, onOpenBillingModal, canEdit, isPasswordChangeOnlyMode }) => {
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
    const billingContent = (userProfileData.role === 'admin' || userProfileData.role === 'hall' || userProfileData.role === 'referee' || userProfileData.role === 'volunteer') ? null : React.createElement(
        'div',
        { className: 'w-full max-w-2xl bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]`' },
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
                    `${userProfileData.street || '-'} ${userProfileData.houseNumber || '-'}, ${userProfileData.postalCode ? userProfileData.postalCode.slice(0, 3) + ' ' + userProfileData.postalCode.slice(3) : '-'} ${userProfileData.city || '-'}, ${userProfileData.country || '-'}`
                )
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'IČO'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.ico || '-')
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'DIČ'),
                React.createElement('div', { className : 'font-normal' }, userProfileData.billing?.dic || '-')
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'IČ DPH'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.icdph || '-')
            )
        )
    );
    return React.createElement(
        'div',
        { className: 'flex flex-col items-center gap-8' },
        profileContent,
        billingContent
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
        }
    }, [userProfileData]);
    const effectiveDataEditDeadline = userProfileData?.dataEditDeadline || settingsRegistrationDates?.dataEditDeadline;    
    const deadlineMillis = (effectiveDataEditDeadline instanceof Timestamp) ? 
                            effectiveDataEditDeadline.toDate().getTime() : 
                            (effectiveDataEditDeadline instanceof Date) ?
                            effectiveDataEditDeadline.getTime() :
                            null;
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
            if (deadlineMillis !== null) { 
                const nowMillis = Date.now();
                if (nowMillis <= deadlineMillis || userProfileData.role === 'referee' || userProfileData.role === 'volunteer') { 
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
    }, [userProfileData, isGlobalAuthReady, isRegistrationDataLoaded, isCategoriesDataLoaded, settingsRegistrationDates, deadlineMillis]); 
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
        )
    );
};
let isEmailSyncListenerSetup = false;
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');
    if (userProfileData) {
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
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(MyDataApp, { userProfileData }));
        }
    } else {
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
};
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);
if (window.globalUserProfileData) {
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
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

// Importy pre Firebase funkcie
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

// Pridaná pomocná funkcia pre formátovanie PSČ
const formatPostalCodeForDisplay = (postalCode) => {
    if (!postalCode) return '-';
    const cleaned = String(postalCode).replace(/\s/g, '');
    if (cleaned.length === 5) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    }
    return cleaned || '-';
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

    // Box pre dobrovoľnícke údaje (len pre rolu volunteer) - ZOBRAZUJE DÁTA Z usersprivate
    let volunteerContent = null;
    if (userProfileData?.role === 'volunteer') {
        // Získame adresu z privateData (userProfileData.address)
        const address = userProfileData.address || {};
        // Získame dátum narodenia z privateData (userProfileData.birthDate)
        const birthDate = userProfileData.birthDate || '';
        
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
                // ADRESA Z usersprivate
                React.createElement('div', null,
                    React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Adresa trvalého bydliska'),
                    React.createElement('div', { className: 'font-normal' },
                        `${address.street || '-'} ${address.houseNumber || '-'}, ${formatPostalCodeForDisplay(address.postalCode)} ${address.city || '-'}, ${address.country || '-'}`
                    )
                ),
                React.createElement('div', { className: 'grid grid-cols-2 gap-4' },
                    React.createElement('div', null,
                        React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Pohlavie'),
                        React.createElement('div', { className: 'font-normal' }, getGenderText(userProfileData.gender))
                    ),
                    React.createElement('div', null,
                        React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Dátum narodenia'),
                        // DÁTUM NARODENIA Z usersprivate
                        React.createElement('div', { className: 'font-normal' }, formatDate(birthDate))
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
        const address = userProfileData.address || {};
        
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
                        `${address.street || '-'} ${address.houseNumber || '-'}, ${formatPostalCodeForDisplay(address.postalCode)} ${address.city || '-'}, ${address.country || '-'}`
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
                    React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.icDph || '-')
                )
            )
        );
    }

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

// ============================================================
// HLAVNÁ KOMPONENTA MyDataApp S REAL-TIME LISTENEROM PRE OBE KOLEKCIE
// ============================================================
const MyDataApp = ({ userProfileData: initialUserProfileData }) => {
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [showVolunteerModal, setShowVolunteerModal] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [settingsRegistrationDates, setSettingsRegistrationDates] = useState(null);
    const [isPasswordChangeOnlyMode, setIsPasswordChangeOnlyMode] = useState(false);
    const [userProfileData, setUserProfileData] = useState(initialUserProfileData);
    const userIdRef = useRef(null);
    const [privateData, setPrivateData] = useState({});
    
    const { 
        isGlobalAuthReady, 
        isRegistrationDataLoaded, 
        isCategoriesDataLoaded, 
    } = useSyncExternalStore(globalDataStore.subscribe, globalDataStore.getSnapshot);
    
    // Načítanie settings registration
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
    
    // ============================================================
    // REAL-TIME LISTENER PRE SLEDOVANIE ZMIEN V users KOLEKCII
    // ============================================================
    useEffect(() => {
        if (!window.db || !userProfileData?.id) {
            return;
        }
        
        const userId = userProfileData.id;
        userIdRef.current = userId;
        const userDocRef = doc(window.db, 'users', userId);
                
        const unsubscribeUsers = onSnapshot(userDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const updatedUserData = docSnap.data();
                
                // Zlúčime dáta - zachováme existujúce private dáta
                setUserProfileData(prevData => {
                    const mergedData = {
                        ...prevData,
                        ...updatedUserData,
                        id: userId,
                        uid: userId,
                        // Zachováme private dáta
                        address: prevData?.address || {},
                        billingAddress: prevData?.billingAddress || {},
                        birthDate: prevData?.birthDate || '',
                        persons: prevData?.persons || {},
                    };
                    
                    return mergedData;
                });
                
            }
        }, (error) => {
        });
        
        return () => {
            unsubscribeUsers();
        };
    }, [userProfileData?.id]);
    
    // ============================================================
    // REAL-TIME LISTENER PRE SLEDOVANIE ZMIEN V usersprivate KOLEKCII
    // ============================================================
    useEffect(() => {
        if (!window.db || !userProfileData?.id) {
            return;
        }
        
        const userId = userProfileData.id;
        const privateDocRef = doc(window.db, 'usersprivate', userId);
        
        const unsubscribePrivate = onSnapshot(privateDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const privateDataFromFirestore = docSnap.data();
                setPrivateData(privateDataFromFirestore);
                
                // Aktualizujeme userProfileData s private dátami
                setUserProfileData(prevData => {
                    const mergedData = {
                        ...prevData,
                        // Adresa pre dobrovoľníka z usersprivate
                        address: privateDataFromFirestore.address || {},
                        // Adresa pre fakturáciu (môže byť samostatná)
                        billingAddress: privateDataFromFirestore.billingAddress || privateDataFromFirestore.address || {},
                        // Dátum narodenia pre dobrovoľníka z usersprivate
                        birthDate: privateDataFromFirestore.birthDate || prevData?.birthDate || '',
                        // Ostatné private dáta
                        persons: privateDataFromFirestore.persons || {},
                        // Priame polia pre jednoduchší prístup (pre kompatibilitu)
                        street: privateDataFromFirestore.address?.street || prevData?.street || '',
                        houseNumber: privateDataFromFirestore.address?.houseNumber || prevData?.houseNumber || '',
                        city: privateDataFromFirestore.address?.city || prevData?.city || '',
                        postalCode: privateDataFromFirestore.address?.postalCode || prevData?.postalCode || '',
                        country: privateDataFromFirestore.address?.country || prevData?.country || '',
                    };
                    
                    return mergedData;
                });
                
            }
        }, (error) => {
        });
        
        return () => {
            unsubscribePrivate();
        };
    }, [userProfileData?.id]);
    
    useEffect(() => {
        if (userProfileData) {
            setShowProfileModal(false);
            setShowBillingModal(false);
            setShowVolunteerModal(false);
        }
    }, [userProfileData]);
    
    // HLAVNÝ EFFECT PRE KONTROLU DEADLINE - používa userProfileData priamo
    useEffect(() => {
        let timer;
        
        const updateCanEditStatus = () => {            
            // NASTAVÍME PREDVOLENÉ HODNOTY
            setCanEdit(false);
            setIsPasswordChangeOnlyMode(false);
            
            // KONTROLA: Či máme userProfileData
            if (!userProfileData) {
                return;
            }
            
            // ADMIN - vždy môže editovať
            const isAdmin = userProfileData.role === 'admin';
            if (isAdmin) {
                setCanEdit(true);
                return;
            }
            
            // SPRÁVNA KONVERZIA DÁTUMU - najprv skúsime z userProfileData
            let deadlineDate = null;
            
            // 1. SKÚSIME ZÍSKAŤ DÁTUM Z userProfileData (individuálny deadline)
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
            
            // 2. AK NEMÁME INDIVIDUÁLNY DEADLINE, POUŽIJEME GLOBÁLNY ZO SETTINGS
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
            
            // 3. AK NEMÁME ŽIADNY DEADLINE, NEPOVOLÍME EDITÁCIU
            if (!deadlineDate) {
                setCanEdit(false);
                setIsPasswordChangeOnlyMode(false);
                return;
            }
            
            const deadlineMillis = deadlineDate.getTime();
            const nowMillis = Date.now();
            
            if (nowMillis <= deadlineMillis) {
                setCanEdit(true);
                // Nastavíme timer na automatické vypnutie po uplynutí deadline
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
        };
        
        // Spustíme kontrolu vždy, keď sa zmení userProfileData alebo settingsRegistrationDates
        updateCanEditStatus();
        
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [userProfileData, settingsRegistrationDates]);
    
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
                onlyAllowPasswordChange: isPasswordChangeOnlyMode,
                privateData: privateData
            }
        ),
        React.createElement(
            ChangeBillingModal,
            {
                show: showBillingModal,
                onClose: () => setShowBillingModal(false),
                userProfileData: userProfileData,
                roleColor: roleColor,
                privateData: privateData
            }
        ),
        React.createElement(
            ChangeVolunteerModal,
            {
                show: showVolunteerModal,
                onClose: () => setShowVolunteerModal(false),
                userProfileData: userProfileData,
                roleColor: roleColor,
                privateData: privateData
            }
        )
    );
};

let isEmailSyncListenerSetup = false;
let isDbInitialized = false;
let pendingUserProfileData = null;

// ============================================================
// UPRAVENÁ FUNKCIA loadUserPrivateData - načíta aj deadline dáta
// ============================================================
const loadUserPrivateData = async (userId) => {
    if (!window.db) {
        return {};
    }
    
    if (!userId) {
        return {};
    }
    
    try {
        const privateDocRef = doc(window.db, 'usersprivate', userId);
        const privateDocSnap = await getDoc(privateDocRef);
        if (privateDocSnap.exists()) {
            const data = privateDocSnap.data();
            return data;
        }
        return {};
    } catch (error) {
        return {};
    }
};

const renderMyDataApp = (userProfileData) => {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        try {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(MyDataApp, { userProfileData }));
        } catch (error) {
        }
    }
};

// ============================================================
// UPRAVENÁ FUNKCIA processUserData - zabezpečí načítanie z usersprivate
// ============================================================
const processUserData = async (userProfileData) => {
    if (!userProfileData) {
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
        return;
    }
    
    const userId = userProfileData.id || userProfileData.uid;
    
    if (!userId) {
        renderMyDataApp(userProfileData);
        return;
    }
    
    // Načítame dáta z usersprivate
    let privateData = {};
    if (window.db) {
        try {
            privateData = await loadUserPrivateData(userId);
        } catch (error) {
        }
    } else {
        pendingUserProfileData = userProfileData;
        return;
    }
    
    // ============================================================
    // DÔLEŽITÉ: Získame aktuálne dáta z users pre deadline
    // ============================================================
    try {
        const userDocRef = doc(window.db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            
            // Ak má používateľ dataEditDeadline, použijeme ho
            if (userData.dataEditDeadline) {
                userProfileData.dataEditDeadline = userData.dataEditDeadline;
            }
            if (userData.rosterEditDeadline) {
                userProfileData.rosterEditDeadline = userData.rosterEditDeadline;
            }
        }
    } catch (error) {
    }
    
    // Zlúčime dáta z users a usersprivate
    const mergedData = {
        ...userProfileData,
        uid: userId,
        // Adresa pre dobrovoľníka z usersprivate
        address: privateData.address || {},
        // Adresa pre fakturáciu z usersprivate (alebo rovnaká)
        billingAddress: privateData.billingAddress || privateData.address || {},
        // Dátum narodenia z usersprivate
        birthDate: privateData.birthDate || userProfileData.birthDate || '',
        // Ostatné private dáta
        persons: privateData.persons || {},
        // Priame polia pre jednoduchší prístup
        street: privateData.address?.street || userProfileData.street || '',
        houseNumber: privateData.address?.houseNumber || userProfileData.houseNumber || '',
        city: privateData.address?.city || userProfileData.city || '',
        postalCode: privateData.address?.postalCode || userProfileData.postalCode || '',
        country: privateData.address?.country || userProfileData.country || '',
    };
    
    renderMyDataApp(mergedData);
    
    // Nastavíme listener pre email synchronizáciu
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

const handleDataUpdateAndRender = async (event) => {
    const userProfileData = event.detail;
    
    if (userProfileData) {
        window.globalUserProfileData = userProfileData;
    }
    
    if (isDbInitialized && window.db) {
        await processUserData(userProfileData);
    } else if (userProfileData) {
        pendingUserProfileData = userProfileData;
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
};

window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

window.addEventListener('dbInitialized', async () => {
    isDbInitialized = true;
    
    if (pendingUserProfileData) {
        const dataToProcess = pendingUserProfileData;
        pendingUserProfileData = null;
        await processUserData(dataToProcess);
    } else if (window.globalUserProfileData) {
        await processUserData(window.globalUserProfileData);
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
});

if (window.db) {
    isDbInitialized = true;
}

if (window.globalUserProfileData) {
    if (isDbInitialized) {
        processUserData(window.globalUserProfileData);
    } else {
        pendingUserProfileData = window.globalUserProfileData;
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

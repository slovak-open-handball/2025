// logged-in-my-data.js
// Tento súbor bol upravený tak, aby umožňoval zmenu mena, priezviska a e-mailovej adresy
// prostredníctvom modálneho okna. Validácia teraz zohľadňuje, či bola zmenená e-mailová adresa
// a podľa toho vyžaduje alebo nevyžaduje zadanie hesla.

// Importy pre Firebase funkcie
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

// Pomocné globálne premenné pre Firebase, ktoré by mali byť inicializované v authentication.js
const auth = typeof window.auth !== 'undefined' ? window.auth : getAuth();
const db = typeof window.db !== 'undefined' ? window.db : getFirestore();
const showGlobalNotification = typeof window.showGlobalNotification !== 'undefined' ? window.showGlobalNotification : (msg, type) => console.log(msg);

/**
 * Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti.
 */
const PasswordInput = ({ id, label, value, onChange, placeholder, showPassword, toggleShowPassword, disabled }) => {
    // Použitie SVG ikon pre oko (zobraziť heslo) a preškrtnuté oko (skryť heslo)
    const EyeIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
    );

    const EyeOffIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 .8-2.5 2.1-4.72 3.8-6.5' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10 12a2 2 110-4 2 2 0 000-4zm4-4a2 2 011-4 2 2 0 01-4 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M21 12c-1.274 4.057-5.064 7-9.542 7-1.576 0-3.076-.239-4.5-.688M12 5v.01' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M.5 22.5l22-22' })
    );

    return React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement(
            'label',
            { htmlFor: id, className: 'block text-sm font-medium text-gray-700' },
            label
        ),
        React.createElement(
            'div',
            { className: 'mt-1 relative rounded-md shadow-sm' },
            React.createElement('input', {
                type: showPassword ? 'text' : 'password',
                id: id,
                name: id,
                value: value,
                onChange: onChange,
                placeholder: placeholder,
                autoComplete: id,
                disabled: disabled,
                className: 'block w-full rounded-md border-gray-300 shadow-sm pr-10 focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 transition duration-150 ease-in-out sm:text-sm'
            }),
            React.createElement(
                'div',
                { className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 cursor-pointer', onClick: toggleShowPassword },
                showPassword ? EyeOffIcon : EyeIcon
            )
        )
    );
};

/**
 * Komponent pre zobrazenie chybovej správy.
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.message - Chybová správa na zobrazenie.
 */
const ErrorMessage = ({ message }) => {
    return React.createElement(
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'div',
            { className: 'p-8 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md' },
            React.createElement('p', { className: 'font-bold' }, 'Chyba'),
            React.createElement('p', null, message)
        )
    );
};

/**
 * Modálne okno pre úpravu profilových údajov.
 */
const EditProfileModal = ({ show, onClose, userProfileData, onUpdate }) => {
    const [firstName, setFirstName] = useState(userProfileData.firstName);
    const [lastName, setLastName] = useState(userProfileData.lastName);
    const [newEmail, setNewEmail] = useState(userProfileData.email);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Synchronizácia údajov, keď sa otvára modálne okno
    useEffect(() => {
        if (show) {
            setFirstName(userProfileData.firstName);
            setLastName(userProfileData.lastName);
            setNewEmail(userProfileData.email);
            setPassword('');
            setError('');
        }
    }, [show, userProfileData]);

    // Validácia formulára na základe požiadavky
    const isEmailChanged = newEmail !== userProfileData.email;
    const isNameChanged = firstName !== userProfileData.firstName || lastName !== userProfileData.lastName;
    const isPasswordRequired = isEmailChanged;

    const isFormValid = () => {
        // Ak sa zmenil iba e-mail, heslo je povinné
        if (isEmailChanged) {
            return password.length > 0;
        }
        // Ak sa zmenilo len meno alebo priezvisko, heslo nie je povinné, ale aspoň jedna zmena musí byť
        if (isNameChanged) {
            return true;
        }
        // Ak sa nič nezmenilo, formulár nie je platný na odoslanie
        return false;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!isFormValid()) {
            setError('Formulár nie je platný. Vyplňte všetky povinné polia a uistite sa, že ste vykonali aspoň jednu zmenu.');
            setLoading(false);
            return;
        }

        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('Žiadny prihlásený používateľ.');
            }

            // Objekt na uloženie aktualizovaných údajov pre Firestore
            const updatedFields = {};
            if (firstName !== userProfileData.firstName) {
                updatedFields.firstName = firstName;
            }
            if (lastName !== userProfileData.lastName) {
                updatedFields.lastName = lastName;
            }

            // Ak sa mení e-mail, musíme použiť špeciálny postup
            if (isEmailChanged) {
                const credential = EmailAuthProvider.credential(currentUser.email, password);
                await reauthenticateWithCredential(currentUser, credential);
                await verifyBeforeUpdateEmail(currentUser, newEmail);
                showGlobalNotification('Na Váš nový e-mail bola odoslaná overovacia správa. Prosím, overte ho.', 'success');
            }

            // Ak sa zmenilo meno alebo priezvisko, aktualizujeme profil vo Firestore
            if (Object.keys(updatedFields).length > 0) {
                const userDocRef = doc(db, 'artifacts', window.__app_id, 'users', currentUser.uid, 'userProfile', currentUser.uid);
                await updateDoc(userDocRef, updatedFields);
                showGlobalNotification('Údaje profilu boli úspešne aktualizované.', 'success');
            }
            
            setLoading(false);
            onClose();

        } catch (err) {
            console.error("Chyba pri aktualizácii profilu:", err);
            setError(err.message);
            showGlobalNotification('Chyba pri aktualizácii profilu. Skúste to prosím znova.', 'error');
            setLoading(false);
        }
    };

    if (!show) {
        return null;
    }

    const buttonClasses = `w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 
                           ${!isFormValid() || loading 
                               ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                               : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'}`;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50' },
        React.createElement(
            'div',
            { className: 'relative p-8 bg-white w-96 rounded-xl shadow-lg' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-semibold' }, 'Upraviť profil'),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' },
                    '×'
                )
            ),
            React.createElement(
                'form',
                { onSubmit: handleSubmit },
                React.createElement(
                    'div',
                    { className: 'space-y-4' },
                    // Pole pre meno
                    React.createElement('div', { className: 'mb-4' },
                        React.createElement('label', { htmlFor: 'firstName', className: 'block text-sm font-medium text-gray-700' }, 'Meno'),
                        React.createElement('input', {
                            type: 'text',
                            id: 'firstName',
                            value: firstName,
                            onChange: (e) => setFirstName(e.target.value),
                            placeholder: 'Zadajte meno',
                            className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 transition duration-150 ease-in-out sm:text-sm'
                        })
                    ),
                    // Pole pre priezvisko
                    React.createElement('div', { className: 'mb-4' },
                        React.createElement('label', { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700' }, 'Priezvisko'),
                        React.createElement('input', {
                            type: 'text',
                            id: 'lastName',
                            value: lastName,
                            onChange: (e) => setLastName(e.target.value),
                            placeholder: 'Zadajte priezvisko',
                            className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 transition duration-150 ease-in-out sm:text-sm'
                        })
                    ),
                    // Pole pre e-mail
                    React.createElement('div', { className: 'mb-4' },
                        React.createElement('label', { htmlFor: 'newEmail', className: 'block text-sm font-medium text-gray-700' }, 'E-mailová adresa'),
                        React.createElement('input', {
                            type: 'email',
                            id: 'newEmail',
                            value: newEmail,
                            onChange: (e) => setNewEmail(e.target.value),
                            placeholder: 'Zadajte novú e-mailovú adresu',
                            className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 transition duration-150 ease-in-out sm:text-sm'
                        })
                    ),
                    // Pole pre heslo (podmienečne zobrazené)
                    isPasswordRequired && React.createElement(PasswordInput, {
                        id: 'password',
                        label: 'Aktuálne heslo',
                        value: password,
                        onChange: (e) => setPassword(e.target.value),
                        placeholder: 'Zadajte svoje aktuálne heslo',
                        showPassword: showPassword,
                        toggleShowPassword: () => setShowPassword(!showPassword),
                    }),
                    error && React.createElement(
                        'p',
                        { className: 'text-red-500 text-xs italic mt-1' },
                        error
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: buttonClasses,
                            disabled: !isFormValid() || loading,
                        },
                        loading ? 'Ukladám...' : 'Uložiť zmeny'
                    )
                )
            )
        )
    );
};

/**
 * Hlavný React komponent MyDataApp, ktorý zobrazuje profil používateľa.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        const handleGlobalDataUpdate = () => {
            if (window.globalUserProfileData) {
                setUserProfileData(window.globalUserProfileData);
                setLoading(false);
            } else {
                setError('Používateľské dáta neboli nájdené.');
                setLoading(false);
            }
        };

        if (window.globalUserProfileData) {
            handleGlobalDataUpdate();
        } else {
            window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);
        }

        // Nastavenie listenera pre onSnapshot, ak je používateľ prihlásený a máme db
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                const userDocRef = doc(db, 'artifacts', window.__app_id, 'users', user.uid, 'userProfile', user.uid);
                onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const profileData = { id: docSnap.id, ...docSnap.data() };
                        window.globalUserProfileData = profileData;
                        setUserProfileData(profileData);
                    } else {
                        // Profil sa nenašiel, mohlo by ísť o chybu
                        console.error("Profil používateľa nebol nájdený!");
                        setError('Profil používateľa nebol nájdený.');
                    }
                }, (err) => {
                    console.error("Chyba pri načítaní profilu:", err);
                    setError('Chyba pri načítaní profilových dát.');
                });
            }
        });

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
            if (unsubscribe) unsubscribe();
        };
    }, []);

    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center h-screen' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        );
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    const headerColor = 'bg-blue-600';

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8' },
        React.createElement(
            'div',
            { className: `bg-white p-8 rounded-xl shadow-lg mt-8` },
            React.createElement(
                'div',
                { className: `p-6 rounded-lg shadow-lg ${headerColor} mb-8 flex justify-between items-center` },
                React.createElement(
                    'h2',
                    { className: 'text-2xl font-bold text-white' },
                    'Môj profil'
                ),
                React.createElement(
                    'button',
                    { 
                        onClick: () => setShowModal(true),
                        className: 'bg-white text-blue-600 font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-gray-100 transition duration-200'
                    },
                    'Upraviť profil'
                )
            ),
            React.createElement(
                'div',
                { className: 'space-y-4' },
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Meno:'),
                    ` ${userProfileData.firstName}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Priezvisko:'),
                    ` ${userProfileData.lastName}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Aktuálna e-mailová adresa:'),
                    ` ${userProfileData.email}`
                )
            )
        ),
        React.createElement(EditProfileModal, {
            show: showModal,
            onClose: () => setShowModal(false),
            userProfileData: userProfileData,
            onUpdate: (updatedData) => setUserProfileData(updatedData)
        })
    );
};

// Explicitne sprístupníme komponent pre ladenie alebo externé použitie
window.MyDataApp = MyDataApp;

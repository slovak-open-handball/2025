// logged-in-my-data.js
// Tento súbor spravuje React komponent MyDataApp, ktorý zobrazuje
// profilové a registračné dáta prihláseného používateľa.
// Spolieha sa na to, že Firebase inštancie (auth, db) a profilové dáta
// sú už definované globálne v 'authentication.js'.

const { useState, useEffect, useCallback } = React;

/**
 * Pomocný komponent pre načítavanie dát.
 */
const Loader = () => {
    return React.createElement(
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'div',
            { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
        )
    );
};

/**
 * Pomocný komponent pre zobrazenie chybovej správy.
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
 * Zobrazuje dáta o registrácii a fakturácii používateľa.
 * @param {object} userProfileData - Dáta profilu používateľa.
 * @param {string} headerColor - Farba hlavičky sekcie.
 * @returns {React.Element} - Vykreslený komponent.
 */
const renderBillingAndAddressInfo = (userProfileData, headerColor) => {
    const isTeamRegistration = userProfileData.registrationType === 'team';

    // Obsah sekcie pre registračné a fakturačné dáta
    const registrationSectionContent = isTeamRegistration
        ? React.createElement(
            'div',
            null,
            React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Názov tímu:'), ` ${userProfileData.teamName}`),
            React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Kategória:'), ` ${userProfileData.categoryName}`),
            React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Štát:'), ` ${userProfileData.country}`),
            React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Počet členov:'), ` ${userProfileData.teamMembersCount}`),
        )
        : React.createElement(
            'div',
            null,
            React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Kategória:'), ` ${userProfileData.categoryName}`),
            React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Štát:'), ` ${userProfileData.country}`)
        );

    const addressSectionContent = React.createElement(
        'div',
        null,
        React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Ulica a číslo:'), ` ${userProfileData.billingAddress.street}`),
        React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Mesto:'), ` ${userProfileData.billingAddress.city}`),
        React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'PSČ:'), ` ${userProfileData.billingAddress.postalCode}`),
        React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Štát:'), ` ${userProfileData.billingAddress.country}`)
    );

    return React.createElement(
        'div',
        { className: 'space-y-8' },
        // Sekcia registrácie
        React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-md p-6' },
            React.createElement(
                'div',
                { className: `flex items-center justify-between pb-4 mb-4 border-b-2 border-${headerColor}-200` },
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-700' }, 'Dáta registrácie'),
            ),
            registrationSectionContent
        ),
        // Sekcia fakturácie
        React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-md p-6' },
            React.createElement(
                'div',
                { className: `flex items-center justify-between pb-4 mb-4 border-b-2 border-${headerColor}-200` },
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-700' }, 'Fakturačné údaje'),
                React.createElement(
                    'button',
                    {
                        onClick: () => { /* Otvoriť modálne okno na úpravu */ },
                        className: `text-${headerColor}-500 hover:text-${headerColor}-700 transition-colors duration-200`
                    },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                    )
                )
            ),
            addressSectionContent
        )
    );
};


// Komponent z z-logged-in-change-email.js
// Obsahuje logiku pre zmenu hesla a e-mailu
const ChangeEmailApp = ({ isOpen, onClose, userProfileData }) => {
    const auth = window.auth;
    const db = window.db;

    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);

    // Načítanie globálnej notifikačnej funkcie
    const showGlobalNotification = useCallback((message, type) => {
        if (window.showGlobalNotification) {
            window.showGlobalNotification(message, type);
        } else {
            console.error('showGlobalNotification function is not available.');
        }
    }, []);

    const isFormValid = newEmail.length > 0 && password.length > 0 && emailError === '' && passwordError === '';

    const handleNewEmailChange = (e) => {
        const email = e.target.value;
        setNewEmail(email);
        if (email.length > 0 && !/\S+@\S+\.\S+/.test(email)) {
            setEmailError('Zadajte platnú e-mailovú adresu.');
        } else {
            setEmailError('');
        }
    };

    const handlePasswordChange = (e) => {
        setPassword(e.target.value);
        if (e.target.value.length === 0) {
            setPasswordError('Heslo nemôže byť prázdne.');
        } else {
            setPasswordError('');
        }
    };
    
    // Funkcia na re-autentifikáciu používateľa
    const reauthenticateUser = async (user, currentPassword) => {
        try {
            const credential = window.EmailAuthProvider.credential(user.email, currentPassword);
            await window.reauthenticateWithCredential(user, credential);
            return true;
        } catch (error) {
            console.error('Chyba pri re-autentifikácii:', error);
            setPasswordError('Nesprávne heslo. Skúste to znova.');
            return false;
        }
    };
    
    // Funkcia na zmenu e-mailovej adresy
    const handleEmailChange = async (e) => {
        e.preventDefault();
        setLoading(true);
        setEmailError('');
        setPasswordError('');
    
        if (!auth.currentUser) {
            showGlobalNotification('Používateľ nie je prihlásený.', 'error');
            setLoading(false);
            return;
        }
    
        try {
            // Re-autentifikácia
            const user = auth.currentUser;
            const reauthenticated = await reauthenticateUser(user, password);
    
            if (!reauthenticated) {
                setLoading(false);
                return;
            }
    
            // Aktualizácia e-mailu v Authentication
            await window.updateEmail(user, newEmail);
    
            // Aktualizácia e-mailu v Firestore
            const userDocRef = window.doc(db, 'users', user.uid);
            await window.updateDoc(userDocRef, {
                email: newEmail
            });
    
            showGlobalNotification('E-mailová adresa bola úspešne zmenená.', 'success');
            onClose(); // Zatvorenie modálneho okna
        } catch (error) {
            console.error('Chyba pri zmene e-mailovej adresy:', error);
            showGlobalNotification(`Chyba: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    // UI pre modálne okno na zmenu e-mailu
    if (!isOpen) return null;
    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center' },
        React.createElement(
            'div',
            { className: 'relative p-5 border w-96 shadow-lg rounded-md bg-white' },
            React.createElement(
                'div',
                null,
                React.createElement(
                    'div',
                    { className: 'text-center' },
                    React.createElement('h3', { className: 'text-2xl leading-6 font-bold text-gray-900 mb-4' }, 'Zmeniť e-mailovú adresu'),
                    React.createElement(
                        'form',
                        { onSubmit: handleEmailChange, className: 'mt-2 space-y-4' },
                        React.createElement(
                            'div',
                            null,
                            React.createElement('label', { htmlFor: 'new-email', className: 'block text-sm font-medium text-gray-700 text-left' }, 'Nová e-mailová adresa'),
                            React.createElement('input', {
                                type: 'email',
                                id: 'new-email',
                                name: 'new-email',
                                value: newEmail,
                                onChange: handleNewEmailChange,
                                className: 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
                                placeholder: 'Zadajte novú e-mailovú adresu',
                                disabled: loading,
                            }),
                            emailError && React.createElement(
                                'p',
                                { className: 'text-red-500 text-xs italic mt-1' },
                                emailError
                            )
                        ),
                        // Použitie komponentu PasswordInput (ak je dostupný, inak len input)
                        React.createElement(
                            'div',
                            { className: 'relative' },
                            React.createElement('label', { htmlFor: 'current-password', className: 'block text-sm font-medium text-gray-700 text-left' }, 'Aktuálne heslo'),
                            React.createElement('input', {
                                type: showCurrentPassword ? 'text' : 'password',
                                id: 'current-password',
                                name: 'current-password',
                                value: password,
                                onChange: handlePasswordChange,
                                className: 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
                                placeholder: 'Zadajte svoje aktuálne heslo',
                                disabled: loading,
                            }),
                            React.createElement(
                                'button',
                                { type: 'button', onClick: () => setShowCurrentPassword(!showCurrentPassword), className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 mt-6' },
                                showCurrentPassword ?
                                    React.createElement(
                                        'svg',
                                        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.562-2.75 10.038 10.038 0 015.688-4.25' }),
                                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10 12a2 2 0 100-4 2 2 0 000 4z' }),
                                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' })
                                    )
                                    :
                                    React.createElement(
                                        'svg',
                                        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
                                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7a9.97 9.97 0 01-1.562 2.75 10.038 10.038 0 01-5.688 4.25' })
                                    )
                            )
                        ),
                        passwordError && React.createElement(
                            'p',
                            { className: 'text-red-500 text-xs italic mt-1' },
                            passwordError
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex justify-end space-x-4 mt-6' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: onClose,
                                    className: 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors duration-200'
                                },
                                'Zrušiť'
                            ),
                            React.createElement(
                                'button',
                                {
                                    type: 'submit',
                                    className: `px-4 py-2 rounded-md transition-colors duration-200 ${loading || !isFormValid ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`,
                                    disabled: loading || !isFormValid,
                                },
                                loading ? 'Ukladám...' : 'Uložiť zmeny'
                            )
                        )
                    )
                )
            )
        )
    );
};

/**
 * Hlavný React komponent pre zobrazenie profilu používateľa.
 * @returns {React.Element} - Vykreslený komponent.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData);
    const [isLoading, setIsLoading] = useState(!window.isGlobalAuthReady);
    const [error, setError] = useState(null);

    // Nový stav pre modálne okno na zmenu e-mailu
    const [isChangeEmailModalOpen, setIsChangeEmailModalOpen] = useState(false);

    const isUserAdmin = userProfileData && userProfileData.isUserAdmin;

    useEffect(() => {
        const handleDataUpdate = (event) => {
            console.log("MyDataApp: Prijatá udalosť 'globalDataUpdated', aktualizujem dáta.");
            setUserProfileData(event.detail);
            setIsLoading(false);
            if (!event.detail) {
                setError('Nepodarilo sa načítať profilové dáta. Uistite sa, že ste prihlásený.');
            } else {
                setError(null);
            }
        };

        window.addEventListener('globalDataUpdated', handleDataUpdate);
        
        // Ak sa dáta načítajú po prvom renderovaní, použijeme existujúce globálne dáta
        if (window.isGlobalAuthReady && window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            setIsLoading(false);
        } else if (window.isGlobalAuthReady && !window.globalUserProfileData) {
            setError('Nepodarilo sa načítať profilové dáta. Uistite sa, že ste prihlásený.');
            setIsLoading(false);
        }


        // Čistenie pri odmontovaní komponentu
        return () => {
            window.removeEventListener('globalDataUpdated', handleDataUpdate);
        };
    }, []);

    if (isLoading) {
        return React.createElement(Loader, null);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'flex justify-center pt-16' },
            React.createElement(
                'div',
                { className: 'p-8 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-lg shadow-md' },
                React.createElement('p', { className: 'font-bold' }, 'Upozornenie'),
                React.createElement('p', null, 'Dáta používateľa nie sú dostupné.')
            )
        );
    }
    const formatPhoneNumber = (phoneNumber) => {
      // Funkcia na formátovanie telefónneho čísla
      if (!phoneNumber) return '';
      const cleaned = ('' + phoneNumber).replace(/\D/g, '');
      const match = cleaned.match(/^(\d{4})(\d{3})(\d{3})$/);
      if (match) {
        return `+${match[1]} ${match[2]} ${match[3]}`;
      }
      return phoneNumber;
    };
    
    const headerColor = userProfileData.registrationType === 'team' ? 'yellow' : 'blue';

    return React.createElement(
        'div',
        { className: 'container mx-auto p-4 md:p-8 lg:p-12' },
        React.createElement(
            'div',
            { className: 'flex flex-col lg:flex-row lg:space-x-8 space-y-8 lg:space-y-0' },
            React.createElement(
                'div',
                { className: 'bg-white rounded-lg shadow-md p-6 lg:w-1/2' },
                React.createElement(
                    'div',
                    { className: `flex items-center justify-between pb-4 mb-4 border-b-2 border-${headerColor}-200` },
                    React.createElement('h2', { className: 'text-2xl font-bold text-gray-700' }, 'Kontaktná osoba'),
                    // Ikona ceruzky pre otvorenie modálneho okna na zmenu e-mailu
                    React.createElement(
                        'button',
                        {
                            onClick: () => setIsChangeEmailModalOpen(true),
                            className: `text-${headerColor}-500 hover:text-${headerColor}-700 transition-colors duration-200`
                        },
                        React.createElement(
                            'svg',
                            { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'space-y-2' },
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko: '),
                        ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`.trim()
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                        ` ${userProfileData.email}`
                    ),
                    !isUserAdmin && React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                        ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                    ),
                )
            ),
            renderBillingAndAddressInfo(userProfileData, headerColor)
        ),
        // Modálne okno na zmenu e-mailu s logikou z ChangeEmailApp
        React.createElement(ChangeEmailApp, {
            isOpen: isChangeEmailModalOpen,
            onClose: () => setIsChangeEmailModalOpen(false),
            userProfileData: userProfileData
        })
    );
};

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;

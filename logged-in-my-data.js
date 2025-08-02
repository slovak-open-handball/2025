// logged-in-my-data.js
// Tento súbor bol upravený, aby fungoval bez 'import' príkazov a spoliehal sa na globálne premenné.
// Na správnu funkčnosť je potrebné, aby súbor 'authentication.js' sprístupnil všetky
// potrebné funkcie (auth, db, updateEmail, reauthenticateWithCredential, EmailAuthProvider)
// na globálnom objekte 'window'.

// Používame priamy prístup k globálnemu objektu React a jeho metódam
const useState = React.useState;
const useEffect = React.useEffect;

/**
 * Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti.
 * Používa sa pre pole aktuálneho hesla v modálnom okne.
 */
const PasswordInput = ({ id, label, value, onChange, placeholder, showPassword, toggleShowPassword, disabled, validationStatus }) => {
  // SVG ikony pre oko (zobraziť heslo) a preškrtnuté oko (skryť heslo)
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.082-1.272m6.113-1.074a3 3 0 11-4.838-3.238M15 12a3 3 0 11-6 0 3 3 0 016 0zm-2.067 2.067L22 22M2 2l20 20M12 5c4.477 0 8.268 2.943 9.542 7a9.97 9.97 0 01-1.082 1.272M7.18 10.18a3.001 3.001 0 014.18 4.18' })
  );

  return React.createElement(
    'div',
    { className: 'relative' },
    React.createElement(
      'label',
      { htmlFor: id, className: 'block text-sm font-medium text-gray-700' },
      label
    ),
    React.createElement(
      'div',
      { className: 'relative mt-1 rounded-md shadow-sm' },
      React.createElement(
        'input',
        {
          type: showPassword ? 'text' : 'password',
          id: id,
          value: value,
          onChange: onChange,
          placeholder: placeholder,
          disabled: disabled,
          required: true,
          className: 'block w-full rounded-md border-gray-300 pr-10 focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed sm:text-sm'
        }
      ),
      React.createElement(
        'div',
        { className: 'absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer', onClick: toggleShowPassword },
        showPassword ? EyeOffIcon : EyeIcon
      )
    )
  );
};


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
 * Hlavný React komponent MyDataApp, ktorý zobrazuje údaje profilu
 * a umožňuje ich zmenu.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const handleGlobalDataUpdate = () => {
            console.log('MyDataApp: Prijatá udalosť "globalDataUpdated". Firebase je inicializovaný.');
            const user = window.auth.currentUser;
            const db = window.db;
            const appId = window.__app_id;
            
            if (user && db) {
                // Pre správne fungovanie je potrebné, aby funkcie doc a onSnapshot boli globálne.
                // Môžeš ich sprístupniť v authentication.js takto: window.doc = doc; window.onSnapshot = onSnapshot;
                // V tomto kóde predpokladáme, že sú dostupné.
                const userDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/private/user-profile`);
                const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setUserProfileData(docSnap.data());
                    } else {
                        // Ak dokument neexistuje, nastavíme email z auth objektu
                        setUserProfileData({ email: user.email });
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Chyba pri načítaní profilu:", error);
                    setError("Chyba pri načítaní dát profilu. Skúste to prosím neskôr.");
                    setLoading(false);
                });
                return () => unsubscribeFirestore();
            } else {
                setLoading(false);
                setError("Používateľ nie je prihlásený alebo Firebase nie je inicializovaný.");
            }
        };

        if (window.isGlobalAuthReady) {
            handleGlobalDataUpdate();
        } else {
            window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);
        }

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    const handleOpenModal = () => {
        setIsModalOpen(true);
        if (userProfileData && userProfileData.email) {
            setNewEmail(userProfileData.email);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setNewEmail('');
        setPassword('');
        setEmailError('');
        setPasswordError('');
    };

    const handleNewEmailChange = (event) => {
        setNewEmail(event.target.value);
        if (emailError) setEmailError('');
    };

    const handlePasswordChange = (event) => {
        setPassword(event.target.value);
        if (passwordError) setPasswordError('');
    };

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setEmailError('');
        setPasswordError('');

        let hasError = false;

        if (!validateEmail(newEmail)) {
            setEmailError('Zadajte platnú e-mailovú adresu.');
            hasError = true;
        }

        if (!password) {
            setPasswordError('Prosím, zadajte svoje aktuálne heslo.');
            hasError = true;
        }

        if (hasError) {
            return;
        }
        
        const user = window.auth.currentUser;
        if (!user) {
            setError("Používateľ nie je prihlásený.");
            return;
        }

        if (newEmail === user.email) {
            setEmailError("Nová e-mailová adresa je rovnaká ako súčasná.");
            return;
        }

        setLoading(true);

        try {
            // Používame správne globálne funkcie, ktoré sú sprístupnené z authentication.js
            const credential = window.EmailAuthProvider.credential(user.email, password);
            await window.reauthenticateWithCredential(user, credential);
            await window.updateEmail(user, newEmail);
            console.log("E-mailová adresa bola úspešne zmenená.");
            // Namiesto alertu použijeme globálnu notifikáciu, ak je definovaná.
            if (window.showGlobalNotification) {
                window.showGlobalNotification("E-mailová adresa bola úspešne zmenená.", 'success');
            } else {
                alert("E-mailová adresa bola úspešne zmenená."); 
            }
            handleCloseModal();
        } catch (error) {
            setLoading(false);
            console.error("Chyba pri zmene e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError("Nesprávne heslo.");
            } else if (error.code === 'auth/email-already-in-use') {
                setEmailError("Táto e-mailová adresa sa už používa.");
            } else {
                if (window.showGlobalNotification) {
                    window.showGlobalNotification(`Chyba pri zmene e-mailu: ${error.message}`, 'error');
                } else {
                    setError(`Chyba: ${error.message}`);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return React.createElement(Loader, null);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    // Predpokladáme, že farba hlavičky pre všetkých bude modrá, keďže sa nejedná o admina.
    const headerColor = 'bg-blue-600';

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8' },
        React.createElement(
            'div',
            { className: `bg-white p-8 rounded-xl shadow-lg mt-8` },
            React.createElement(
                'div',
                { className: `p-6 rounded-lg shadow-lg ${headerColor} mb-8` },
                React.createElement(
                    'h2',
                    { className: 'text-2xl font-bold text-white' },
                    'Môj profil'
                )
            ),
            React.createElement(
                'div',
                { className: 'space-y-4' },
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between' },
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                        ` ${userProfileData.email}`
                    ),
                    React.createElement(
                        'button',
                        { onClick: handleOpenModal, className: 'p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100 transition-colors' },
                        // Ikona ceruzky (SVG)
                        React.createElement(
                            'svg',
                            { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L15.232 5.232z' })
                        )
                    )
                )
            )
        ),
        isModalOpen && React.createElement(
            'div',
            { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50' },
            React.createElement(
                'div',
                { className: 'relative p-8 bg-white w-96 max-w-sm m-auto flex-col flex rounded-lg shadow-xl' },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center pb-3' },
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-bold text-gray-900' },
                        'Zmeniť e-mailovú adresu'
                    ),
                    React.createElement(
                        'button',
                        { onClick: handleCloseModal, className: 'text-gray-400 hover:text-gray-500' },
                        React.createElement(
                            'span',
                            { className: 'sr-only' },
                            'Zatvoriť'
                        ),
                        // Ikona krížika
                        React.createElement(
                            'svg',
                            { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                        )
                    )
                ),
                React.createElement(
                    'form',
                    { onSubmit: handleSubmit, className: 'space-y-4' },
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'label',
                            { htmlFor: 'new-email', className: 'block text-sm font-medium text-gray-700' },
                            'Nová e-mailová adresa'
                        ),
                        React.createElement(
                            'input',
                            {
                                type: 'email',
                                id: 'new-email',
                                value: newEmail,
                                onChange: handleNewEmailChange,
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed sm:text-sm ${emailError ? 'border-red-500' : ''}`,
                                placeholder: 'Zadajte novú e-mailovú adresu',
                                disabled: loading,
                            }
                        ),
                        emailError && React.createElement(
                            'p',
                            { className: 'text-red-500 text-xs italic mt-1' },
                            emailError
                        )
                    ),
                    React.createElement(PasswordInput, {
                        id: 'current-password',
                        label: 'Aktuálne heslo',
                        value: password,
                        onChange: handlePasswordChange,
                        required: true,
                        placeholder: 'Zadajte svoje aktuálne heslo',
                        disabled: loading,
                        showPassword: showPassword,
                        toggleShowPassword: () => setShowPassword(!showPassword),
                    }),
                    passwordError && React.createElement(
                        'p',
                        { className: 'text-red-500 text-xs italic mt-1' },
                        passwordError
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: `w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed`,
                            disabled: loading || !newEmail || !password,
                        },
                        loading ? 'Ukladám...' : 'Uložiť zmeny'
                    )
                )
            )
        )
    );
};

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;

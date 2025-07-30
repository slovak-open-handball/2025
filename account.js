// account.js
// Tento súbor predpokladá, že Firebase SDK je už načítané a inicializované
// v account.html.

// Pomocná funkcia na získanie URL parametrov
function getUrlParams() {
    const params = {};
    window.location.search.substring(1).split('&').forEach(param => {
        const [key, value] = param.split('=');
        params[key] = decodeURIComponent(value);
    });
    return params;
}

// PasswordInput Component pre polia hesla s prepínačom viditeľnosti
// Akceptuje 'validationStatus' ako objekt pre detailnú vizuálnu indikáciu platnosti hesla
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, validationStatus, onFocus }) {
  // SVG ikony pre oko (zobraziť heslo) a preškrtnuté oko (skryť heslo)
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, // SVG element má fill="none"
    // Cesta pre vyplnený stred (pupila)
    React.createElement('path', { fill: 'currentColor', stroke: 'none', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    // Cesta pre vonkajší obrys oka (bez výplne)
    React.createElement('path', { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }),
    // Cesta pre šikmú čiaru
    React.createElement('line', { x1: '21', y1: '3', x2: '3', y2: '21', stroke: 'currentColor', strokeWidth: '2' })
  );

  // Okraj inputu bude vždy predvolený (border-gray-300)
  const borderClass = 'border-gray-300';

  return React.createElement(
    'div',
    { className: 'mb-4' }, // Pridaná trieda mb-4 pre konzistentné medzery
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        // Používame len predvolenú triedu okraja
        className: `shadow appearance-none border ${borderClass} rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10`,
        value: value,
        onChange: onChange,
        onCopy: onCopy,
        onPaste: onPaste,
        onCut: onCut,
        required: true,
        placeholder: placeholder,
        autoComplete: autoComplete,
        disabled: disabled,
        onFocus: onFocus // Pridaný onFocus prop
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 focus:outline-none',
          disabled: disabled,
        },
        showPassword ? EyeIcon : EyeOffIcon
      )
    ),
    // ZMENA: Podmienka pre zobrazenie popisu hesla - zobrazí sa len ak je validationStatus definovaný
    validationStatus && React.createElement(
      'div',
      { className: `text-xs italic mt-1 text-gray-600` }, // Text "Heslo musí obsahovať" je vždy sivý
      'Heslo musí obsahovať:',
      React.createElement(
        'ul',
        { className: 'list-none pl-4' }, // Používame list-none a vlastné odrážky pre dynamiku
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.minLength ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.minLength ? '✔' : '•'),
          'aspoň 10 znakov,'
        ),
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.hasUpperCase ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.hasUpperCase ? '✔' : '•'),
          'aspoň jedno veľké písmeno,'
        ),
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.hasLowerCase ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.hasLowerCase ? '✔' : '•'),
          'aspoň jedno malé písmeno,'
        ),
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.hasNumber ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.hasNumber ? '✔' : '•'),
          'aspoň jednu číslicu.'
        )
      )
    )
  );
}

// Funkcia pre validáciu hesla (teraz presne zhodná s logged-in-change-password.js)
const validatePassword = (pwd) => {
    const status = {
      minLength: pwd.length >= 10,
      hasUpperCase: /[A-Z]/.test(pwd),
      hasLowerCase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
    };
    // Celková platnosť hesla
    status.isValid = status.minLength && status.hasUpperCase && status.hasLowerCase && status.hasNumber;
    return status;
};


// Main React component for the reset password / email verification page
function ResetPasswordApp() {
    // Odstránené useState pre auth a db, teraz sa pristupuje ku globálnym inštanciám
    // const [auth, setAuth] = React.useState(null);
    // const [db, setDb] = React.useState(null);
    const [mode, setMode] = React.useState(null);
    const [oobCode, setOobCode] = React.useState(null);
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [message, setMessage] = React.useState(''); // Správa o overení kódu / e-mailu
    const [successMessage, setSuccessMessage] = React.useState(''); // Správa o úspešnom resete hesla / overení e-mailu
    const [loading, setLoading] = React.useState(true);
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

    // Stavy pre výsledky validácie nového hesla (ako v logged-in-change-password.js)
    const [passwordValidationStatus, setPasswordValidationStatus] = React.useState({
      minLength: false,
      hasUpperCase: false,
      hasLowerCase: false,
      hasNumber: false,
      isValid: false, // Celková platnosť hesla
    });
    const [isConfirmPasswordMatching, setIsConfirmPasswordMatching] = React.useState(false);
    // NOVINKA: Stav pre sledovanie, či bol input "Potvrďte nové heslo" aktivovaný
    const [confirmPasswordTouched, setConfirmPasswordTouched] = React.useState(false);


    React.useEffect(() => {
        try {
            // Prístup ku globálnym inštanciám Firebase Auth a Firestore
            const authInstance = window.auth;
            // const dbInstance = window.db; // Firestore už nie je potrebný v tomto komponente

            if (!authInstance) { // Kontrola, či je authInstance dostupná
                setError("Firebase Authentication nie je inicializované. Skontrolujte account.html.");
                setLoading(false);
                return;
            }

            const params = getUrlParams();
            const currentMode = params.mode;
            const currentOobCode = params.oobCode;

            if (currentMode && currentOobCode) {
                setMode(currentMode);
                setOobCode(currentOobCode);

                if (currentMode === 'resetPassword') {
                    // Logika pre resetovanie hesla
                    authInstance.verifyPasswordResetCode(currentOobCode)
                        .then(email => {
                            setMessage(`Prosím, zadajte nové heslo pre ${email}.`);
                            setLoading(false);
                        })
                        .catch(e => {
                            console.error("Chyba pri overovaní reset kódu:", e);
                            setError("Neplatný alebo expirovaný odkaz na resetovanie hesla.");
                            setLoading(false);
                        });
                } else if (currentMode === 'verifyAndChangeEmail') { // ZMENA: Názov režimu
                    console.log("account.js: Režim 'verifyAndChangeEmail' detekovaný.");
                    
                    // NOVINKA: Najprv skontrolujeme akčný kód
                    authInstance.checkActionCode(currentOobCode)
                        .then(actionCodeInfo => {
                            console.log("account.js: DEBUG - actionCodeInfo z checkActionCode:", actionCodeInfo);
                            // E-mail a UID sú tu dostupné, ale už ich nebudeme priamo používať pre Firestore zápis
                            // targetUserEmail = actionCodeInfo.data.email;
                            // targetUserUid = actionCodeInfo.data.uid;

                            // Až potom aplikujeme akčný kód
                            return authInstance.applyActionCode(currentOobCode);
                        })
                        .then(async () => { // Zmena na async funkciu
                            console.log("account.js: applyActionCode úspešné. E-mail bol overený v Authentication.");
                            
                            // NOVINKA: Zobrazenie novej správy o úspechu
                            setSuccessMessage("Vaša e-mailová adresa bola úspešne overená. Pre jej úspešnú aktualizáciu sa prosím prihláste. Budete presmerovaní na prihlasovaciu stránku.");
                            
                            setLoading(false);
                            // Presmerovanie na prihlasovaciu stránku po krátkom oneskorení
                            setTimeout(() => {
                                window.location.href = 'login.html';
                            }, 3000);
                        })
                        .catch(e => {
                            console.error("account.js: Chyba pri overovaní e-mailu (checkActionCode alebo applyActionCode zlyhalo):", e);
                            setError("Neplatný alebo expirovaný odkaz na overenie e-mailu.");
                            setLoading(false);
                        });
                } else if (currentMode === 'recoverEmail') { // NOVINKA: Režim pre obnovenie pôvodného e-mailu
                    console.log("account.js: Režim 'recoverEmail' detekovaný.");
                    authInstance.applyActionCode(currentOobCode)
                        .then(() => {
                            console.log("account.js: applyActionCode úspešné pre recoverEmail. Pôvodný e-mail bol obnovený.");
                            setSuccessMessage("Vaša pôvodná e-mailová adresa bola úspešne obnovená. Budete presmerovaní na prihlasovaciu stránku.");
                            setLoading(false);
                            setTimeout(() => {
                                window.location.href = 'login.html';
                            }, 3000);
                        })
                        .catch(e => {
                            console.error("account.js: Chyba pri obnovovaní e-mailu (recoverEmail zlyhalo):", e);
                            setError("Neplatný alebo expirovaný odkaz na obnovenie e-mailu.");
                            setLoading(false);
                        });
                }
                 else {
                    setError("Neplatný režim akcie. Chýbajú parametre.");
                    setLoading(false);
                }
            } else {
                setError("Neplatný odkaz. Chýbajú parametre.");
                setLoading(false);
            }
        } catch (e) {
            console.error("Chyba pri inicializácii Firebase alebo parsovaní URL:", e);
            setError(`Chyba pri inicializácii: ${e.message}`);
            setLoading(false);
        }
    }, []); // Odstránená závislosť na dbInstance

    // Effect pre validáciu hesla pri zmene 'newPassword' alebo 'confirmNewPassword'
    React.useEffect(() => {
        const pwdStatus = validatePassword(newPassword);
        setPasswordValidationStatus(pwdStatus);

        // isConfirmPasswordMatching závisí aj od celkovej platnosti nového hesla
        setIsConfirmPasswordMatching(newPassword === confirmNewPassword && newPassword.length > 0 && pwdStatus.isValid);
    }, [newPassword, confirmNewPassword]);


    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        // Prístup ku globálnej inštancii Firebase Auth
        const authInstance = window.auth;
        if (!authInstance || !oobCode) {
            setError("Chyba: Autentifikácia nie je pripravená alebo chýba kód.");
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setError("Heslá sa nezhodujú.");
            return;
        }

        // Používame celkový stav platnosti z passwordValidationStatus
        if (!passwordValidationStatus.isValid) {
            setError("Nové heslo nespĺňa všetky požiadavky. Skontrolujte prosím zoznam pod heslom.");
            return;
        }

        setLoading(true);
        try {
            await authInstance.confirmPasswordReset(oobCode, newPassword);
            setSuccessMessage("Vaše heslo bolo úspešne resetované! Budete presmerovaní na prihlasovaciu stránku.");
            setMessage('');
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        } catch (e) {
            console.error("Chyba pri resetovaní hesla:", e);
            if (e.code === 'auth/expired-action-code') {
                setError("Odkaz na resetovanie hesla vypršal. Požiadajte o nový.");
            } else if (e.code === 'auth/invalid-action-code') {
                setError("Neplatný odkaz na resetovanie hesla.");
            } else if (e.code === 'auth/user-disabled') {
                setError("Váš účet bol zakázaný. Kontaktujte podporu.");
            } else if (e.code === 'auth/weak-password') {
                // Použijeme validatePassword pre detailnejšiu správu o slabom hesle
                const validationResults = validatePassword(newPassword);
                const errors = [];
                if (!validationResults.minLength) errors.push("aspoň 10 znakov");
                if (!validationResults.hasLowerCase) errors.push("aspoň jedno malé písmeno");
                if (!validationResults.hasUpperCase) errors.push("aspoň jedno veľké písmeno");
                if (!validationResults.hasNumber) errors.push("aspoň jednu číslicu");
                
                setError("Heslo je príliš slabé. Heslo musí obsahovať:\n• " + errors.join("\n• ") + ".");
            } else {
                setError(`Chyba pri resetovaní hesla: ${e.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Dynamické triedy pre tlačidlo na základe stavu disabled
    const buttonClasses = `
        font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200
        ${loading || !newPassword || !confirmNewPassword || !passwordValidationStatus.isValid || !isConfirmPasswordMatching
            ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' // Zakázaný stav
            : 'bg-blue-500 hover:bg-blue-700 text-white' // Aktívny stav
        }
    `;


    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
            React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
        );
    }

    if (error && !successMessage) {
        return React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center' },
            React.createElement('h1', { className: 'text-2xl font-bold text-red-600 mb-4' }, 'Chyba'),
            React.createElement(
                'div',
                { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
                error
            ),
            React.createElement(
                'a',
                { href: 'login.html', className: 'text-blue-600 hover:underline mt-4 inline-block' },
                'Späť na prihlásenie'
            )
        );
    }

    if (successMessage) {
        return React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center' },
            React.createElement('h1', { className: 'text-2xl font-bold text-green-600 mb-4' }, 'Úspech!'),
            React.createElement(
                'div',
                { className: 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
                successMessage
            ),
            !successMessage.includes("Budete presmerovaní") && React.createElement(
                'a',
                { href: 'login.html', className: 'text-blue-600 hover:underline mt-4 inline-block' },
                'Späť na prihlásenie'
            )
        );
    }

    // Ak je režim resetPassword a kód je platný, zobraz formulár
    if (mode === 'resetPassword' && oobCode) {
        return React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-xl w-full max-w-md' },
            React.createElement('h1', { className: 'text-2xl font-bold text-center text-gray-800 mb-6' }, 'Nastaviť nové heslo'),
            message && React.createElement(
                'div',
                { className: 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
                message
            ),
            React.createElement(
                'form',
                { onSubmit: handleResetPassword, className: 'space-y-4' },
                React.createElement(PasswordInput, {
                    id: 'newPassword',
                    label: 'Nové heslo',
                    value: newPassword,
                    onChange: (e) => {
                        setNewPassword(e.target.value);
                        // Okamžitá aktualizácia validácie
                        setPasswordValidationStatus(validatePassword(e.target.value));
                    },
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    placeholder: 'Zadajte nové heslo',
                    autoComplete: 'new-password',
                    validationStatus: passwordValidationStatus, // Odovzdanie detailného stavu validácie hesla
                    disabled: loading,
                    showPassword: showPassword,
                    toggleShowPassword: () => setShowPassword(!showPassword)
                }),
                React.createElement(PasswordInput, {
                    id: 'confirmNewPassword',
                    label: 'Potvrdiť nové heslo',
                    value: confirmNewPassword,
                    onChange: (e) => {
                        setConfirmNewPassword(e.target.value);
                        setConfirmPasswordTouched(true); // Nastaví touched stav
                    },
                    onFocus: () => setConfirmPasswordTouched(true), // Nastaví touched stav pri aktivácii
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    placeholder: 'Zadajte heslo znova',
                    autoComplete: 'new-password',
                    disabled: loading,
                    showConfirmPassword: showConfirmPassword,
                    toggleShowPassword: () => setShowConfirmPassword(!showConfirmPassword)
                }),
                // NOVINKA: Zobrazenie správy "Heslá sa nezhodujú"
                !isConfirmPasswordMatching && confirmNewPassword.length > 0 && confirmPasswordTouched &&
                React.createElement(
                    'p',
                    { className: 'text-red-500 text-xs italic mt-1' },
                    'Heslá sa nezhodujú'
                ),
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: buttonClasses, // Použitie dynamických tried
                        disabled: loading || !newPassword || !confirmNewPassword || !passwordValidationStatus.isValid || !isConfirmPasswordMatching,
                    },
                    loading ? React.createElement(
                        'div',
                        { className: 'flex items-center justify-center' },
                        React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-white', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                            React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                            React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                        ),
                        'Nastavujem heslo...'
                    ) : 'Nastaviť heslo'
                )
            )
        );
    }

    return null; // Nič nevykresľuj, ak režim nie je resetPassword alebo už bola spracovaná úspešná správa
}

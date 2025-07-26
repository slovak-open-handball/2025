// reset-password.js
// Tento súbor predpokladá, že Firebase SDK je už načítané a inicializované
// v reset-password.html.

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
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description, tabIndex }) {
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

  return React.createElement(
    'div',
    { className: 'mb-4' },
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10',
        value: value,
        onChange: onChange,
        onCopy: onCopy,
        onPaste: onPaste,
        onCut: onCut,
        required: true,
        placeholder: placeholder,
        autoComplete: autoComplete,
        disabled: disabled,
        tabIndex: tabIndex
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
    description && React.createElement('div', { className: 'text-gray-600 text-xs italic mt-1' }, description)
  );
}

// Main React component for the reset password page
function ResetPasswordApp() {
    const [auth, setAuth] = React.useState(null);
    const [mode, setMode] = React.useState(null);
    const [oobCode, setOobCode] = React.useState(null);
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [message, setMessage] = React.useState(''); // Správa o overení kódu
    const [successMessage, setSuccessMessage] = React.useState(''); // Správa o úspešnom resete hesla
    const [loading, setLoading] = React.useState(true);
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

    React.useEffect(() => {
        try {
            if (typeof firebase === 'undefined' || typeof firebase.auth === 'undefined') {
                setError("Firebase SDK nie je načítané. Skontrolujte reset-password.html.");
                setLoading(false);
                return;
            }
            const authInstance = firebase.auth();
            setAuth(authInstance);

            const params = getUrlParams();
            const currentMode = params.mode;
            const currentOobCode = params.oobCode;

            if (currentMode && currentOobCode) {
                setMode(currentMode);
                setOobCode(currentOobCode);
                // Overenie oobCode a získanie e-mailu
                authInstance.verifyPasswordResetCode(currentOobCode)
                    .then(email => {
                        setMessage(`Prosím, zadajte nové heslo pre ${email}.`); // Nastavíme informačnú správu
                        setLoading(false);
                    })
                    .catch(e => {
                        console.error("Chyba pri overovaní reset kódu:", e);
                        setError("Neplatný alebo expirovaný odkaz na resetovanie hesla.");
                        setLoading(false);
                    });
            } else {
                setError("Neplatný odkaz na resetovanie hesla. Chýbajú parametre.");
                setLoading(false);
            }
        } catch (e) {
            console.error("Chyba pri inicializácii Firebase alebo parsovaní URL:", e);
            setError(`Chyba pri inicializácii: ${e.message}`);
            setLoading(false);
        }
    }, []);

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage(''); // Reset úspešnej správy

        if (!auth || !oobCode) {
            setError("Chyba: Autentifikácia nie je pripravená alebo chýba kód.");
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setError("Heslá sa nezhodujú.");
            return;
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            setError('Heslo musí obsahovať aspoň jedno malé písmeno, jedno veľké písmeno a jednu číslicu.');
            return;
        }

        setLoading(true);
        try {
            await auth.confirmPasswordReset(oobCode, newPassword);
            setSuccessMessage("Vaše heslo bolo úspešne resetované! Budete presmerovaní na prihlasovaciu stránku."); // Nastavíme úspešnú správu
            setMessage(''); // Vyčistíme informačnú správu
            
            // Presmerovanie na prihlasovaciu stránku po krátkom oneskorení
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
                setError("Heslo je príliš slabé. Použite silnejšie heslo.");
            } else {
                setError(`Chyba pri resetovaní hesla: ${e.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
            React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
        );
    }

    if (error && !successMessage) { // Zobraz chybu, ak nie je úspešná správa
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

    if (successMessage) { // Zobraz úspešnú správu po resete hesla
        return React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center' },
            React.createElement('h1', { className: 'text-2xl font-bold text-green-600 mb-4' }, 'Úspech!'),
            React.createElement(
                'div',
                { className: 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
                successMessage
            ),
            !successMessage.includes("Budete presmerovaní") && React.createElement( // Zobraz odkaz, ak nie je automatické presmerovanie
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
            message && React.createElement( // Zobraz informačnú správu nad formulárom
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
                    onChange: (e) => setNewPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    placeholder: 'Zadajte nové heslo',
                    autoComplete: 'new-password',
                    description: React.createElement(
                        React.Fragment,
                        null,
                        'Heslo musí obsahovať:',
                        React.createElement(
                            'ul',
                            { className: 'list-disc list-inside ml-4' },
                            React.createElement('li', null, 'aspoň jedno malé písmeno,'),
                            React.createElement('li', null, 'aspoň jedno veľké písmeno,'),
                            React.createElement('li', null, 'aspoň jednu číslicu.')
                        )
                    ),
                    disabled: loading,
                    showPassword: showPassword,
                    toggleShowPassword: () => setShowPassword(!showPassword)
                }),
                React.createElement(PasswordInput, {
                    id: 'confirmNewPassword',
                    label: 'Potvrdiť nové heslo',
                    value: confirmNewPassword,
                    onChange: (e) => setConfirmNewPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    placeholder: 'Zadajte heslo znova',
                    autoComplete: 'new-password',
                    disabled: loading,
                    showPassword: showConfirmPassword,
                    toggleShowPassword: () => setShowConfirmPassword(!showConfirmPassword)
                }),
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
                        disabled: loading || !newPassword || !confirmNewPassword,
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

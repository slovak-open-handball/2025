// login.js
// This file assumes that firebaseConfig, initialAuthToken and appId
// are globally defined in <head> login.html.
// It has been modified so that when "Forgot password?" is clicked, the login form is hidden
// and the password reset form is displayed instead, without using a modal window with a dark background.
// Email validation and styling of the "Send" button have also been added to the password reset form.
// A red error will now be displayed if an account with the given email is not found.
// In this version, the style of disabled buttons has been changed as per user request.

// Imports for necessary Firebase functions
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";

// SVG icons for showing/hiding password
const EyeIcon = React.createElement(
  'svg',
  { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
);

const EyeOffIcon = React.createElement(
  'svg',
  { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
  React.createElement('path', { fill: 'currentColor', stroke: 'none', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
  React.createElement('path', { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }),
  React.createElement('line', { x1: '21', y1: '3', x2: '3', y2: '21', stroke: 'currentColor', strokeWidth: '2' })
);

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description, tabIndex }) {
    return React.createElement(
        'div',
        { className: 'mb-6' },
        React.createElement(
            'label',
            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id },
            label
        ),
        React.createElement(
            'div',
            { className: 'relative' },
            React.createElement(
                'input',
                {
                    className: 'shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-colors duration-200',
                    id: id,
                    type: showPassword ? 'text' : 'password',
                    placeholder: placeholder,
                    value: value,
                    onChange: onChange,
                    autoComplete: autoComplete,
                    onCopy: onCopy,
                    onPaste: onPaste,
                    onCut: onCut,
                    disabled: disabled,
                    tabIndex: tabIndex,
                }
            ),
            React.createElement(
                'div',
                {
                    className: 'absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer',
                    onClick: toggleShowPassword
                },
                showPassword ? EyeIcon : EyeOffIcon
            )
        ),
        description && React.createElement(
            'p',
            { className: 'text-gray-600 text-xs mt-1' },
            description
        )
    );
}

// Function to validate email address
const isEmailValid = (email) => {
    // Regex to check 'a@b.cd' format
    const re = /\S+@\S+\.\S{2,}/;
    return re.test(email);
};

// Password Reset component
const ResetPasswordForm = ({ onCancel }) => {
    const [email, setEmail] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        if (!isEmailValid(email)) {
            setError('Please enter a valid email address.');
            setLoading(false);
            return;
        }

        try {
            if (!window.auth) {
                console.error("Firebase Auth is not initialized.");
                return;
            }
            await sendPasswordResetEmail(window.auth, email);
            setMessage('A password reset link has been sent to your email.');
        } catch (err) {
            console.error("Error sending password reset email:", err);
            if (err.code === 'auth/user-not-found') {
                setError('No account found with this email address.');
            } else {
                setError('Error: Failed to send password reset email. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const isSendButtonDisabled = loading || !isEmailValid(email);

    return React.createElement(
        'div',
        { className: 'bg-white shadow-md rounded-lg px-8 pt-6 pb-8 mb-4' },
        React.createElement('h2', { className: 'text-2xl font-bold mb-4 text-center' }, 'Password Reset'),
        React.createElement(
            'form',
            { onSubmit: handleResetPassword },
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email-reset' },
                    'Email address'
                ),
                React.createElement(
                    'input',
                    {
                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-colors duration-200',
                        id: 'email-reset',
                        type: 'email',
                        placeholder: 'Enter email address',
                        value: email,
                        onChange: (e) => setEmail(e.target.value),
                        disabled: loading,
                        tabIndex: 1
                    }
                )
            ),
            React.createElement(
                'div',
                { className: 'flex items-center justify-between' },
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: `font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out focus:outline-none focus:shadow-outline w-full
                          ${isSendButtonDisabled
                            ? 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                            : 'bg-blue-500 hover:bg-blue-600 text-white transform hover:scale-105'
                          }`,
                        disabled: isSendButtonDisabled,
                        tabIndex: 2
                    },
                    loading ? 'Sending...' : 'Send'
                )
            ),
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: onCancel,
                    className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 w-full mt-4',
                    tabIndex: 3
                },
                'Cancel'
            ),
            message && React.createElement(
                'p',
                { className: 'text-sm mt-4 text-center text-green-600' },
                message
            ),
            error && React.createElement(
                'p',
                { className: 'text-sm mt-4 text-center text-red-600' },
                error
            )
        )
    );
};


// Main application component for the login page (converted to React.createElement)
const App = () => {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [showResetPasswordForm, setShowResetPasswordForm] = React.useState(false);
    // NEW: State for the unapproved admin message
    const [unapprovedAdminMessage, setUnapprovedAdminMessage] = React.useState('');

    // Function to toggle password visibility
    const toggleShowPassword = () => {
        setShowPassword(prevShowPassword => !prevShowPassword);
    };

    // Password validation
    const isPasswordValid = (password) => {
        // Password must be at least 10 characters long
        return password.length >= 10;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setUnapprovedAdminMessage(''); // Clear unapproved admin message on new login attempt

        try {
            if (!window.auth) {
                throw new Error("Firebase Auth is not initialized.");
            }
            await signInWithEmailAndPassword(window.auth, email, password);
            // If login is successful, onAuthStateChanged listener in authentication.js
            // will handle the redirect to index.html.
        } catch (err) {
            console.error("Error during login:", err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('Incorrect email or password.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email format.');
            } else {
                setError('You entered an incorrect username or password. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Calculate if the button is disabled
    const isButtonDisabled = loading || !isEmailValid(email) || !isPasswordValid(password);

    React.useEffect(() => {
        const authListener = onAuthStateChanged(window.auth, (user) => {
            if (user) {
                // If user is already logged in (e.g., from previous session),
                // onAuthStateChanged in authentication.js will handle redirect
                // based on their approved status.
                console.log("login.js: User is logged in. authentication.js will handle redirect.");
                // No explicit redirect to index.html from here,
                // let authentication.js manage based on approval status.
            }
        });

        // Parse URL for status parameter on component mount
        const urlParams = new URLSearchParams(window.location.search);
        const status = urlParams.get('status');
        if (status === 'unapproved_admin') {
            setUnapprovedAdminMessage("Váš účet bol zaregistrovaný ako administrátorský. Prosím, počkajte na schválenie. O stave vášho účtu vás budeme informovať.");
            // Optionally clear the URL parameter so it doesn't reappear on refresh
            const newUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        }


        // After rendering, make sure the header is visible
        const header = document.querySelector('header');
        if (header) {
            header.classList.remove('invisible');
            header.classList.add('bg-blue-800');
            console.log("login.js: Header set to visible.");
        }

        return () => authListener();
    }, []);

    return React.createElement(
        'div',
        { className: 'w-full max-w-md' },
        showResetPasswordForm ? (
            React.createElement(ResetPasswordForm, { onCancel: () => setShowResetPasswordForm(false) })
        ) : (
            React.createElement(
                'div',
                { className: 'bg-white shadow-md rounded-lg px-8 pt-6 pb-8 mb-4' },
                React.createElement(
                    'div',
                    { className: 'flex justify-center mb-6' },
                    React.createElement(
                        'h1',
                        { className: 'text-3xl font-bold text-gray-800' },
                        'Login'
                    )
                ),
                // Display the unapproved admin message here
                unapprovedAdminMessage && React.createElement(
                    'div',
                    { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
                    React.createElement(
                        'span',
                        { className: 'block sm:inline' },
                        unapprovedAdminMessage
                    )
                ),
                React.createElement(
                    'form',
                    { onSubmit: handleLogin, className: 'space-y-4' },
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement(
                            'label',
                            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' },
                            'Email address'
                        ),
                        React.createElement(
                            'input',
                            {
                                className: 'shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-colors duration-200',
                                id: 'email',
                                type: 'email',
                                placeholder: 'Enter email address',
                                value: email,
                                onChange: (e) => setEmail(e.target.value),
                                disabled: loading,
                                autoComplete: 'username',
                                tabIndex: 1
                            }
                        )
                    ),
                    React.createElement(PasswordInput, {
                        id: 'password',
                        label: 'Password',
                        value: password,
                        onChange: (e) => setPassword(e.target.value),
                        placeholder: 'Enter password',
                        autoComplete: 'current-password',
                        showPassword: showPassword,
                        toggleShowPassword: toggleShowPassword,
                        disabled: loading,
                        tabIndex: 2
                    }),
                    error && React.createElement(
                        'div',
                        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative', role: 'alert' },
                        React.createElement(
                            'span',
                            { className: 'block sm:inline' },
                            error
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-between flex-col' },
                        React.createElement(
                            'button',
                            {
                                type: 'submit',
                                className: `font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out focus:outline-none focus:shadow-outline w-full
                                          ${isButtonDisabled
                                    ? 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                    : 'bg-blue-500 hover:bg-blue-600 text-white transform hover:scale-105'
                                }`,
                                disabled: isButtonDisabled,
                                tabIndex: 3
                            },
                            loading ? 'Logging in...' : 'Login'
                        ),
                        React.createElement(
                            'a',
                            {
                                href: '#',
                                onClick: (e) => { e.preventDefault(); setShowResetPasswordForm(true); },
                                className: 'inline-block align-baseline font-bold text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200 mt-4',
                            },
                            'Forgot Password?'
                        )
                    )
                )
            )
        )
    );
};

// Function to check if all necessary global variables are available
const renderApp = () => {
    try {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(App, null));
        console.log("login.js: React App rendered after 'globalDataUpdated' event.");
    } catch (error) {
        console.error("Error rendering React component:", error);
    }
};

// Wait for 'globalDataUpdated' event before rendering the application.
// If the event has already occurred, render immediately.
if (window.isGlobalAuthReady) {
    renderApp();
} else {
    window.addEventListener('globalDataUpdated', renderApp);
}

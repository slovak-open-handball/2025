// logged-in-my-data.js
// Tento súbor bol upravený tak, aby okrem zobrazenia profilových údajov
// umožňoval aj zmenu e-mailovej adresy prihláseného používateľa prostredníctvom modálneho okna.
// Logika zmeny e-mailu bola prenesená z z-logged-in-change-email.js.
// Kód bol aktualizovaný, aby bol odolnejší voči chybám s "undefined" premennými.
// Bola pridaná aktualizovaná funkcia pre zobrazenie farebných notifikácií.
// Farba hlavičky sa teraz mení dynamicky na základe roly používateľa.
// Text v hlavičke bol upravený z "Môj profil" na "Kontaktná osoba".
// Meno a priezvisko sú zobrazené v jednom riadku a boli zmenené popisy pred údajmi.
// Rozloženie profilových údajov bolo zmenené tak, aby bol popis a hodnota na samostatných riadkoch s rôznou veľkosťou medzier.
// Modálne okno pre zmenu e-mailu bolo upravené tak, aby jeho šírka zodpovedala hlavnému profilovému boxu a bolo trochu širšie.
// Biely obdĺžnik a modrý obdĺžnik v profile majú teraz rovnakú šírku, a modrý obdĺžnik má ostré spodné rohy.
// Úpravy pre požiadavku používateľa: odstránenie čierneho orámovania z inputu pre telefónne číslo
// a pridanie logiky na povolenie zadávania iba číslic.

// Importy pre Firebase funkcie
import {
    getAuth,
    EmailAuthProvider,
    reauthenticateWithCredential,
    verifyBeforeUpdateEmail,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Importy pre React a ReactDOM
import React, {
    useState,
    useEffect
} from 'react';
import ReactDOM from 'react-dom/client';

// Import funkcie pre zobrazenie notifikácie z header.js
// Predpokladá sa, že header.js už bol načítaný a window.showGlobalNotification je dostupné.
const showGlobalNotification = window.showGlobalNotification;

// Komponenta pre modálne okno na zmenu e-mailu
const ChangeEmailModal = ({
    show,
    onClose,
    userProfileData
}) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (show && userProfileData && userProfileData.email) {
            setEmail(userProfileData.email);
            setPassword('');
        }
    }, [show, userProfileData]);

    const handleChangeEmail = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            console.error("Žiadny prihlásený používateľ.");
            showGlobalNotification('Chyba: Nie ste prihlásený.', 'error');
            setIsSubmitting(false);
            return;
        }

        if (email === userProfileData.email) {
            showGlobalNotification('E-mailová adresa nebola zmenená, je rovnaká ako predtým.', 'info');
            setIsSubmitting(false);
            onClose();
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            await verifyBeforeUpdateEmail(user, email);

            showGlobalNotification('E-mail na overenie bol odoslaný na vašu novú adresu. Skontrolujte si e-mail a potvrďte zmenu.', 'success');
            onClose();
        } catch (error) {
            console.error("Chyba pri zmene e-mailu:", error);
            showGlobalNotification(`Chyba: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!show) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50 p-4">
            <div className="relative mx-auto p-8 border w-full max-w-lg shadow-lg rounded-lg bg-white transform transition-all duration-300 scale-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Zmeniť e-mailovú adresu</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>
                <form onSubmit={handleChangeEmail}>
                    <div className="mb-4">
                        <label htmlFor="new-email" className="block text-gray-700 text-sm font-semibold mb-2">Nový e-mail</label>
                        <input
                            type="email"
                            id="new-email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="shadow-sm appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Zadajte nový e-mail"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="current-password" className="block text-gray-700 text-sm font-semibold mb-2">Aktuálne heslo (pre potvrdenie)</label>
                        <input
                            type="password"
                            id="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="shadow-sm appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Zadajte vaše aktuálne heslo"
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-200"
                        >
                            Zrušiť
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Ukladám...' : 'Uložiť zmeny'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Hlavná komponenta pre zobrazenie a úpravu údajov používateľa
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData);
    const [showModal, setShowModal] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');

    useEffect(() => {
        // Listener na globálnu udalosť, ktorá je vysielaná z authentication.js
        const handleGlobalDataUpdate = (event) => {
            if (event.detail) {
                setUserProfileData(event.detail);
                setPhoneNumber(event.detail.phoneNumber || ''); // Nastavíme telefónne číslo po načítaní
            } else {
                setUserProfileData(null);
            }
        };

        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Odhlásenie listeneru pri unmount
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    // Handler pre zmenu telefónneho čísla
    const handlePhoneNumberChange = (e) => {
        // Odstránime všetky znaky, ktoré nie sú číslice
        const value = e.target.value.replace(/[^0-9]/g, '');
        setPhoneNumber(value);
    };

    // Handler pre uloženie zmien v profile
    const handleSaveProfile = async () => {
        if (!userProfileData || !window.db) {
            showGlobalNotification('Chyba: Nie ste prihlásený alebo dáta nie sú pripravené.', 'error');
            return;
        }

        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
             showGlobalNotification('Chyba: Používateľ nie je prihlásený.', 'error');
             return;
        }

        try {
            const userDocRef = doc(window.db, 'users', user.uid);
            await updateDoc(userDocRef, {
                phoneNumber: phoneNumber
            });
            showGlobalNotification('Profil bol úspešne aktualizovaný!', 'success');
        } catch (error) {
            console.error("Chyba pri aktualizácii profilu:", error);
            showGlobalNotification('Chyba pri aktualizácii profilu: ' + error.message, 'error');
        }
    };


    if (!userProfileData) {
        return (
            <div className="flex justify-center pt-16">
                <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500"></div>
            </div>
        );
    }

    return React.createElement(
        'div', {
            className: 'flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4 sm:p-6 lg:p-8 bg-gray-100'
        },
        React.createElement(
            'div', {
                className: 'w-full max-w-4xl bg-blue-600 rounded-t-xl shadow-lg relative z-10 p-4 sm:p-6'
            },
            React.createElement(
                'h2', {
                    className: 'text-2xl sm:text-3xl font-bold text-white mb-2'
                },
                'Kontaktná osoba'
            ),
            React.createElement(
                'p', {
                    className: 'text-blue-200'
                },
                'Údaje o kontaktnej osobe, ktorá je zodpovedná za registráciu tímu.'
            )
        ),
        React.createElement(
            'div', {
                className: 'w-full max-w-4xl bg-white rounded-b-xl shadow-lg -mt-4 p-6 sm:p-8 relative z-20'
            },
            React.createElement(
                'div', {
                    className: 'space-y-6'
                },
                React.createElement(
                    'div', {
                        className: 'flex flex-col'
                    },
                    React.createElement(
                        'p', {
                            className: 'font-bold text-gray-800 flex items-center'
                        },
                        'Meno a priezvisko kontaktnej osoby:'
                    ),
                    React.createElement(
                        'p', {
                            className: 'text-gray-800 text-lg mt-1'
                        },
                        `${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`
                    )
                ),
                React.createElement(
                    'div', {
                        className: 'flex flex-col'
                    },
                    React.createElement(
                        'p', {
                            className: 'font-bold text-gray-800 flex items-center'
                        },
                        'E-mailová adresa kontaktnej osoby:'
                    ),
                    React.createElement(
                        'div', {
                            className: 'flex items-center space-x-4 mt-1'
                        },
                        React.createElement(
                            'p', {
                                className: 'text-gray-800 text-lg'
                            },
                            userProfileData.email || 'N/A'
                        ),
                        React.createElement(
                            'button', {
                                onClick: () => setShowModal(true),
                                className: 'text-sm text-blue-600 hover:text-blue-800 font-semibold focus:outline-none'
                            },
                            'Zmeniť e-mail'
                        )
                    )
                ),
                React.createElement(
                    'div', {
                        className: 'flex flex-col'
                    },
                    React.createElement(
                        'p', {
                            className: 'font-bold text-gray-800 flex items-center'
                        },
                        'Telefónne číslo kontaktnej osoby:'
                    ),
                    React.createElement(
                        'input', {
                            type: 'tel',
                            value: phoneNumber,
                            onChange: handlePhoneNumberChange,
                            className: 'mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200',
                            placeholder: 'Zadajte telefónne číslo',
                            maxLength: 20
                        }
                    )
                )
            ),
            React.createElement(
                'div', {
                    className: 'flex justify-end mt-8 gap-2'
                },
                React.createElement(
                    'button', {
                        onClick: handleSaveProfile,
                        className: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-200'
                    },
                    'Uložiť zmeny'
                )
            )
        ),
        React.createElement(ChangeEmailModal, {
            show: showModal,
            onClose: () => setShowModal(false),
            userProfileData: userProfileData
        })
    );
};

// Renderovanie aplikácie do DOM
const rootElement = document.getElementById('root');
if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(MyDataApp, null));
    console.log("logged-in-my-data.js: Aplikácia vykreslená.");
} else {
    console.error("logged-in-my-data.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
}

// Explicitne sprístupníme komponent pre ladenie alebo externé použitie
window.MyDataApp = MyDataApp;

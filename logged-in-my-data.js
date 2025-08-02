// logged-in-my-data.js
// Tento súbor bol upravený tak, aby umožňoval úpravu profilových a fakturačných údajov
// priamo na stránke prostredníctvom modálnych okien.

const { useState, useEffect } = React;
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
            React.createElement('p', null, message)
        )
    );
};

/**
 * Pomocný komponent pre zobrazenie modálneho okna.
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.title - Nadpis modálneho okna.
 * @param {function} props.onClose - Funkcia, ktorá sa zavolá pri zatvorení okna.
 * @param {React.ReactNode} props.children - Obsah modálneho okna.
 */
const Modal = ({ title, onClose, children }) => {
    // Vytvoríme referenciu na modálne okno, aby sme mohli zavrieť ho aj kliknutím mimo neho
    const modalRef = React.useRef(null);

    // Pridáme event listener pre zatvorenie modálneho okna kliknutím mimo neho
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50'
        },
        React.createElement(
            'div',
            {
                ref: modalRef,
                className: 'relative p-5 border w-11/12 md:w-1/2 lg:w-1/3 shadow-lg rounded-md bg-white'
            },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center pb-3' },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold' },
                    title
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-400 hover:text-gray-600 transition-colors'
                    },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M6 18L18 6M6 6l12 12' })
                    )
                )
            ),
            children
        )
    );
};

/**
 * Komponent pre úpravu kontaktných údajov.
 */
const EditContactForm = ({ userProfileData, onSave, onCancel }) => {
    const [firstName, setFirstName] = useState(userProfileData.firstName || '');
    const [lastName, setLastName] = useState(userProfileData.lastName || '');
    const [email, setEmail] = useState(userProfileData.email || '');
    const [contactPhoneNumber, setContactPhoneNumber] = useState(userProfileData.contactPhoneNumber || '');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ firstName, lastName, email, contactPhoneNumber });
    };

    return React.createElement(
        'form',
        { onSubmit: handleSubmit, className: 'space-y-4' },
        React.createElement(
            'div',
            { className: 'space-y-2' },
            React.createElement(
                'label',
                { className: 'block text-gray-700' },
                'Meno'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    value: firstName,
                    onChange: (e) => setFirstName(e.target.value),
                    className: 'w-full p-2 border border-gray-300 rounded-md',
                    required: true
                }
            ),
            React.createElement(
                'label',
                { className: 'block text-gray-700' },
                'Priezvisko'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    value: lastName,
                    onChange: (e) => setLastName(e.target.value),
                    className: 'w-full p-2 border border-gray-300 rounded-md',
                    required: true
                }
            ),
            React.createElement(
                'label',
                { className: 'block text-gray-700' },
                'E-mail'
            ),
            React.createElement(
                'input',
                {
                    type: 'email',
                    value: email,
                    onChange: (e) => setEmail(e.target.value),
                    className: 'w-full p-2 border border-gray-300 rounded-md',
                    required: true
                }
            ),
            React.createElement(
                'label',
                { className: 'block text-gray-700' },
                'Telefónne číslo'
            ),
            React.createElement(
                'input',
                {
                    type: 'tel',
                    value: contactPhoneNumber,
                    onChange: (e) => setContactPhoneNumber(e.target.value),
                    className: 'w-full p-2 border border-gray-300 rounded-md'
                }
            )
        ),
        React.createElement(
            'div',
            { className: 'flex justify-end space-x-2' },
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: onCancel,
                    className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md'
                },
                'Zrušiť'
            ),
            React.createElement(
                'button',
                {
                    type: 'submit',
                    className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md'
                },
                'Uložiť zmeny'
            )
        )
    );
};

/**
 * Komponent pre úpravu fakturačných údajov.
 */
const EditBillingForm = ({ userProfileData, onSave, onCancel }) => {
    const [companyName, setCompanyName] = useState(userProfileData.billingAddress?.companyName || '');
    const [street, setStreet] = useState(userProfileData.billingAddress?.street || '');
    const [city, setCity] = useState(userProfileData.billingAddress?.city || '');
    const [zipCode, setZipCode] = useState(userProfileData.billingAddress?.zipCode || '');
    const [country, setCountry] = useState(userProfileData.billingAddress?.country || '');
    const [ico, setIco] = useState(userProfileData.billingAddress?.ico || '');
    const [dic, setDic] = useState(userProfileData.billingAddress?.dic || '');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            billingAddress: {
                companyName,
                street,
                city,
                zipCode,
                country,
                ico,
                dic
            }
        });
    };

    return React.createElement(
        'form',
        { onSubmit: handleSubmit, className: 'space-y-4' },
        React.createElement(
            'div',
            { className: 'space-y-2' },
            React.createElement(
                'label',
                { className: 'block text-gray-700' },
                'Názov firmy'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    value: companyName,
                    onChange: (e) => setCompanyName(e.target.value),
                    className: 'w-full p-2 border border-gray-300 rounded-md'
                }
            ),
            React.createElement(
                'label',
                { className: 'block text-gray-700' },
                'Ulica'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    value: street,
                    onChange: (e) => setStreet(e.target.value),
                    className: 'w-full p-2 border border-gray-300 rounded-md'
                }
            ),
            React.createElement(
                'label',
                { className: 'block text-gray-700' },
                'Mesto'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    value: city,
                    onChange: (e) => setCity(e.target.value),
                    className: 'w-full p-2 border border-gray-300 rounded-md'
                }
            ),
            React.createElement(
                'label',
                { className: 'block text-gray-700' },
                'PSČ'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    value: zipCode,
                    onChange: (e) => setZipCode(e.target.value),
                    className: 'w-full p-2 border border-gray-300 rounded-md'
                }
            ),
            React.createElement(
                'label',
                { className: 'block text-gray-700' },
                'Štát'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    value: country,
                    onChange: (e) => setCountry(e.target.value),
                    className: 'w-full p-2 border border-gray-300 rounded-md'
                }
            ),
            React.createElement(
                'label',
                { className: 'block text-gray-700' },
                'IČO'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    value: ico,
                    onChange: (e) => setIco(e.target.value),
                    className: 'w-full p-2 border border-gray-300 rounded-md'
                }
            ),
            React.createElement(
                'label',
                { className: 'block text-gray-700' },
                'DIČ'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    value: dic,
                    onChange: (e) => setDic(e.target.value),
                    className: 'w-full p-2 border border-gray-300 rounded-md'
                }
            )
        ),
        React.createElement(
            'div',
            { className: 'flex justify-end space-x-2' },
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: onCancel,
                    className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md'
                },
                'Zrušiť'
            ),
            React.createElement(
                'button',
                {
                    type: 'submit',
                    className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md'
                },
                'Uložiť zmeny'
            )
        )
    );
};


/**
 * Hlavný komponent MyDataApp, ktorý zobrazuje údaje a spravuje modálne okná.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData);
    const [showModal, setShowModal] = useState(false);
    const [editingSection, setEditingSection] = useState(null); // 'contact' alebo 'billing'

    // Formátovanie telefónneho čísla
    const formatPhoneNumber = (number) => {
        if (!number) return 'Nezadané';
        const cleaned = ('' + number).replace(/\D/g, '');
        const match = cleaned.match(/^(\d{4})(\d{3})(\d{3})$/);
        if (match) {
            return `+${match[1]} ${match[2]} ${match[3]}`;
        }
        return number;
    };
    
    // Farba hlavičky na základe roly
    const headerColor = userProfileData && userProfileData.role === 'admin' ? 'bg-red-600' : 'bg-blue-600';

    // Handler pre otvorenie modálneho okna na úpravu
    const handleEditClick = (section) => {
        setEditingSection(section);
        setShowModal(true);
    };

    // Handler pre zatvorenie modálneho okna
    const handleCloseModal = () => {
        setShowModal(false);
        setEditingSection(null);
    };

    // Handler pre uloženie zmien do Firestore
    const handleSave = async (updatedData) => {
        try {
            const userDocRef = doc(window.db, "users", userProfileData.id);
            await updateDoc(userDocRef, updatedData);
            window.showGlobalNotification('Údaje boli úspešne aktualizované!', 'success');
            handleCloseModal();
        } catch (error) {
            console.error('Chyba pri aktualizácii dokumentu:', error);
            window.showGlobalNotification('Chyba pri ukladaní údajov. Skúste to prosím neskôr.', 'error');
        }
    };
    
    // useEffect pre sledovanie globálnych dát
    useEffect(() => {
        const handleGlobalDataUpdate = (event) => {
            setUserProfileData(event.detail);
        };
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);


    // Zobrazenie načítavača, ak dáta ešte nie sú dostupné
    if (!userProfileData) {
        return React.createElement(Loader);
    }
    
    // Overenie, či je používateľ admin
    const isUserAdmin = userProfileData.role === 'admin';

    return React.createElement(
        'div',
        { className: 'p-4 md:p-8 lg:p-12 max-w-4xl mx-auto' },
        React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-xl overflow-hidden' },
            
            // Sekcia "Kontaktná osoba"
            React.createElement(
                'div',
                { className: 'border-b border-gray-200' },
                React.createElement(
                    'div',
                    { className: `flex justify-between items-center ${headerColor} text-white p-4` },
                    React.createElement(
                        'h2',
                        { className: 'text-2xl font-bold' },
                        'Kontaktná osoba'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => handleEditClick('contact'),
                            className: 'p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-200'
                        },
                        React.createElement(
                            'svg',
                            { className: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'p-6' },
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

            // Sekcia "Fakturačné údaje"
            React.createElement(
                'div',
                { className: 'border-t border-gray-200' },
                React.createElement(
                    'div',
                    { className: `flex justify-between items-center ${headerColor} text-white p-4` },
                    React.createElement(
                        'h2',
                        { className: 'text-2xl font-bold' },
                        'Fakturačné údaje'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => handleEditClick('billing'),
                            className: 'p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-200'
                        },
                        React.createElement(
                            'svg',
                            { className: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'p-6' },
                    userProfileData.billingAddress && userProfileData.billingAddress.companyName && React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Názov firmy:'),
                        ` ${userProfileData.billingAddress.companyName}`
                    ),
                    userProfileData.billingAddress && userProfileData.billingAddress.street && React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                        ` ${userProfileData.billingAddress.street}, ${userProfileData.billingAddress.city}, ${userProfileData.billingAddress.zipCode}, ${userProfileData.billingAddress.country}`
                    ),
                    userProfileData.billingAddress && userProfileData.billingAddress.ico && React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                        ` ${userProfileData.billingAddress.ico}`
                    ),
                    userProfileData.billingAddress && userProfileData.billingAddress.dic && React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                        ` ${userProfileData.billingAddress.dic}`
                    ),
                    !userProfileData.billingAddress && React.createElement(
                        'p',
                        { className: 'text-gray-500 italic' },
                        'Fakturačné údaje neboli zadané.'
                    )
                )
            ),

            // Modálne okno na úpravu
            showModal && React.createElement(
                Modal,
                {
                    title: editingSection === 'contact' ? 'Upraviť kontaktné údaje' : 'Upraviť fakturačné údaje',
                    onClose: handleCloseModal
                },
                editingSection === 'contact' ?
                    React.createElement(EditContactForm, { userProfileData, onSave: handleSave, onCancel: handleCloseModal }) :
                    React.createElement(EditBillingForm, { userProfileData, onSave: handleSave, onCancel: handleCloseModal })
            )
        )
    );
};


// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;

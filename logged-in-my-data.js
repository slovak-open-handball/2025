// Importy pre Firebase funkcie
import { doc, getFirestore, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

/**
 * Modálny komponent pre zmenu fakturačných údajov.
 */
export const ChangeBillingModal = ({ show, onClose, userProfileData, roleColor }) => {
    const db = window.db;

    // Stavy pre formulár
    const [companyName, setCompanyName] = useState('');
    const [street, setStreet] = useState('');
    const [houseNumber, setHouseNumber] = useState('');
    const [city, setCity] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [country, setCountry] = useState('');
    const [ico, setIco] = useState('');
    const [dic, setDic] = useState('');
    const [icdph, setIcdph] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Načítanie počiatočných hodnôt z `userProfileData` do stavu pri zobrazení modálu
    useEffect(() => {
        if (show && userProfileData) {
            setCompanyName(userProfileData.companyName || '');
            setStreet(userProfileData.street || '');
            setHouseNumber(userProfileData.houseNumber || '');
            setCity(userProfileData.city || '');
            setPostalCode(userProfileData.postalCode || '');
            setCountry(userProfileData.country || '');
            setIco(userProfileData.ico || '');
            setDic(userProfileData.dic || '');
            setIcdph(userProfileData.icdph || '');
            setError(null);
        }
    }, [show, userProfileData]);

    // Kontrola, či sa zmenil formulár
    const isFormChanged = () => {
        return (
            companyName !== userProfileData.companyName ||
            street !== userProfileData.street ||
            houseNumber !== userProfileData.houseNumber ||
            city !== userProfileData.city ||
            postalCode !== userProfileData.postalCode ||
            country !== userProfileData.country ||
            ico !== userProfileData.ico ||
            dic !== userProfileData.dic ||
            icdph !== userProfileData.icdph
        );
    };

    const handleUpdateBilling = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        const user = window.auth.currentUser;
        if (!user) {
            window.showGlobalNotification('Používateľ nie je prihlásený.', 'error');
            setLoading(false);
            return;
        }

        if (!isFormChanged()) {
             window.showGlobalNotification('Žiadne zmeny na uloženie.', 'info');
             setLoading(false);
             onClose();
             return;
        }

        try {
            const updatedData = {
                companyName: companyName,
                street: street,
                houseNumber: houseNumber,
                city: city,
                postalCode: postalCode,
                country: country,
                ico: ico,
                dic: dic,
                icdph: icdph
            };
            
            await updateDoc(doc(db, "users", user.uid), updatedData);
            window.showGlobalNotification('Fakturačné údaje boli úspešne aktualizované!', 'success');
            onClose();

        } catch (e) {
            console.error("Chyba pri aktualizácii fakturačných údajov:", e);
            setError('Nepodarilo sa aktualizovať fakturačné údaje. Skúste to prosím neskôr.');
            window.showGlobalNotification('Nepodarilo sa aktualizovať fakturačné údaje. Skúste to prosím neskôr.', 'error');
        } finally {
            setLoading(false);
        }
    };
    
    // Nadpis modálneho okna
    const ModalHeader = React.createElement(
        'div',
        { className: 'flex justify-between items-center px-6 py-4 border-b rounded-t-xl sticky top-0 z-10', style: { backgroundColor: roleColor } },
        React.createElement('h3', { className: 'text-2xl font-bold text-white' }, 'Upraviť fakturačné údaje'),
        React.createElement(
            'button',
            {
                onClick: onClose,
                className: 'text-white hover:text-gray-200'
            },
            React.createElement('svg', { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
            )
        )
    );

    // Tlačidlo na uloženie zmien
    const isButtonEnabled = isFormChanged();
    const buttonStyle = {
        backgroundColor: isButtonEnabled ? roleColor : 'white',
        color: isButtonEnabled ? 'white' : roleColor,
        border: isButtonEnabled ? 'none' : `2px solid ${roleColor}`,
        cursor: isButtonEnabled && !loading ? 'pointer' : 'not-allowed',
        boxShadow: isButtonEnabled ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none',
    };

    const ModalContent = React.createElement(
        'div',
        { className: 'p-6 h-full overflow-y-auto' }, // Pridaná trieda 'h-full' a 'overflow-y-auto'
        error && React.createElement(
            'div',
            { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
            error
        ),
        React.createElement(
            'form',
            {
                onSubmit: handleUpdateBilling
            },
            React.createElement(
                'div',
                { className: 'flex flex-col md:flex-row md:space-x-8' },
                // Ľavý stĺpec pre osobné údaje
                React.createElement(
                    'div',
                    { className: 'w-full md:w-1/2' },
                     React.createElement('h4', { className: 'text-xl font-bold text-gray-900 mb-4' }, 'Moje údaje'),
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement(
                            'label',
                            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'companyName' },
                            'Názov spoločnosti'
                        ),
                        React.createElement('input', {
                            type: 'text',
                            id: 'companyName',
                            value: companyName,
                            onChange: (e) => setCompanyName(e.target.value),
                            placeholder: userProfileData.companyName,
                            className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                            style: { borderColor: roleColor, boxShadow: 'none' }
                        })
                    ),
                     React.createElement(
                        'div',
                        { className: 'flex mb-4 space-x-4' },
                        React.createElement(
                            'div',
                            { className: 'w-2/3' },
                            React.createElement(
                                'label',
                                { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'street' },
                                'Ulica'
                            ),
                            React.createElement('input', {
                                type: 'text',
                                id: 'street',
                                value: street,
                                onChange: (e) => setStreet(e.target.value),
                                placeholder: userProfileData.street,
                                className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                                style: { borderColor: roleColor, boxShadow: 'none' }
                            })
                        ),
                        React.createElement(
                            'div',
                            { className: 'w-1/3' },
                            React.createElement(
                                'label',
                                { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'houseNumber' },
                                'Číslo'
                            ),
                            React.createElement('input', {
                                type: 'text',
                                id: 'houseNumber',
                                value: houseNumber,
                                onChange: (e) => setHouseNumber(e.target.value),
                                placeholder: userProfileData.houseNumber,
                                className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                                style: { borderColor: roleColor, boxShadow: 'none' }
                            })
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex mb-4 space-x-4' },
                        React.createElement(
                            'div',
                            { className: 'w-2/3' },
                            React.createElement(
                                'label',
                                { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'city' },
                                'Mesto'
                            ),
                            React.createElement('input', {
                                type: 'text',
                                id: 'city',
                                value: city,
                                onChange: (e) => setCity(e.target.value),
                                placeholder: userProfileData.city,
                                className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                                style: { borderColor: roleColor, boxShadow: 'none' }
                            })
                        ),
                        React.createElement(
                            'div',
                            { className: 'w-1/3' },
                            React.createElement(
                                'label',
                                { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'postalCode' },
                                'PSČ'
                            ),
                            React.createElement('input', {
                                type: 'text',
                                id: 'postalCode',
                                value: postalCode,
                                onChange: (e) => setPostalCode(e.target.value),
                                placeholder: userProfileData.postalCode,
                                className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                                style: { borderColor: roleColor, boxShadow: 'none' }
                            })
                        )
                    ),
                     React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement(
                            'label',
                            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'country' },
                            'Krajina'
                        ),
                        React.createElement('input', {
                            type: 'text',
                            id: 'country',
                            value: country,
                            onChange: (e) => setCountry(e.target.value),
                            placeholder: userProfileData.country,
                            className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                            style: { borderColor: roleColor, boxShadow: 'none' }
                        })
                    )
                ),
                // Pravý stĺpec pre fakturačné údaje
                React.createElement(
                    'div',
                    { className: 'w-full md:w-1/2 mt-8 md:mt-0' },
                    React.createElement('h4', { className: 'text-xl font-bold text-gray-900 mb-4' }, 'Fakturačné údaje'),
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement(
                            'label',
                            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'ico' },
                            'IČO'
                        ),
                        React.createElement('input', {
                            type: 'text',
                            id: 'ico',
                            value: ico,
                            onChange: (e) => setIco(e.target.value),
                            placeholder: userProfileData.ico,
                            className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                            style: { borderColor: roleColor, boxShadow: 'none' }
                        })
                    ),
                     React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement(
                            'label',
                            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'dic' },
                            'DIČ'
                        ),
                        React.createElement('input', {
                            type: 'text',
                            id: 'dic',
                            value: dic,
                            onChange: (e) => setDic(e.target.value),
                            placeholder: userProfileData.dic,
                            className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                            style: { borderColor: roleColor, boxShadow: 'none' }
                        })
                    ),
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement(
                            'label',
                            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'icdph' },
                            'IČ DPH'
                        ),
                        React.createElement('input', {
                            type: 'text',
                            id: 'icdph',
                            value: icdph,
                            onChange: (e) => setIcdph(e.target.value),
                            placeholder: userProfileData.icdph,
                            className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                            style: { borderColor: roleColor, boxShadow: 'none' }
                        })
                    )
                )
            ),
             React.createElement(
                'div',
                { className: 'flex justify-end mt-6' },
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: `px-8 py-3 rounded-full font-bold text-lg transition-all duration-300 ${isButtonEnabled ? 'hover:scale-105' : ''} focus:outline-none`,
                        disabled: !isButtonEnabled || loading,
                        style: buttonStyle
                    },
                    loading ? 'Ukladám...' : 'Uložiť zmeny'
                )
            )
        )
    );

    const modal = show ? React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[10000] p-4',
            onClick: (e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto flex flex-col max-h-[90vh]' },
            ModalHeader,
            React.createElement('div', { className: 'flex-grow overflow-y-auto' },
                ModalContent
            )
        )
    ) : null;

    return ReactDOM.createPortal(modal, document.body);
};

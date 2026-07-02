// Importy pre Firebase funkcie
import { doc, getFirestore, updateDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect, useRef } = React;

/**
 * Modálny komponent pre zmenu fakturačných údajov.
 */
export const ChangeBillingModal = ({ show, onClose, userProfileData, roleColor }) => {
    // Ak je rola používateľa 'admin' alebo 'hall', nezobrazíme modál.
    if (userProfileData?.role === 'admin' || userProfileData?.role === 'hall' || userProfileData?.role === 'referee' || userProfileData?.role === 'volunteer') {
        return null;
    }
    
    const db = window.db;

    // Stavy pre formulár, inicializované ako prázdne
    const [clubName, setClubName] = useState('');
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

    // Ref pre uloženie pôvodných hodnôt pre porovnanie
    const originalDataRef = useRef({});
    // Ref pre sledovanie, či ide o počiatočné načítanie formulára
    const isInitialLoad = useRef(true);

    // Načítanie počiatočných hodnôt z `userProfileData` do ref a vyčistenie formulára
    useEffect(() => {
        if (show && userProfileData) {
            // Získame billing adresu z usersprivate (billingAddress)
            const billingAddress = userProfileData.billingAddress || {};
        
            console.log('ChangeBillingModal - Načítavam dáta:', {
                billingAddress: billingAddress,
                billing: userProfileData.billing,
                userProfileData: userProfileData
            });
        
            // Uložíme pôvodné dáta do ref pre neskoršie porovnanie
            originalDataRef.current = {
                clubName: userProfileData.billing?.clubName || '',
                street: billingAddress.street || '',
                houseNumber: billingAddress.houseNumber || '',
                city: billingAddress.city || '',
                postalCode: billingAddress.postalCode || '',
                country: billingAddress.country || '',
                ico: userProfileData.billing?.ico || '',
                dic: userProfileData.billing?.dic || '',
                icdph: userProfileData.billing?.icdph || ''
            };
        
            // NAČÍTAME HODNOTY DO FORMULÁRA - dôležitá zmena!
            setClubName(userProfileData.billing?.clubName || '');
            setStreet(billingAddress.street || '');
            setHouseNumber(billingAddress.houseNumber || '');
            setCity(billingAddress.city || '');
            setPostalCode(billingAddress.postalCode || '');
            setCountry(billingAddress.country || '');
            setIco(userProfileData.billing?.ico || '');
            setDic(userProfileData.billing?.dic || '');
            setIcdph(userProfileData.billing?.icdph || '');
            setError(null);
        
            // Nastavíme, že sa jedná o počiatočné načítanie.
            isInitialLoad.current = true;
        }
    }, [show, userProfileData]);

    // Funkcia na normalizáciu hodnôt pre bezpečné porovnanie,
    // ošetruje undefined/null a biele znaky.
    const getNormalizedValue = (value) => {
        return String(value || '').replace(/\s/g, '');
    };

    // Kontrola, či sa zmenil formulár
    const isFormChanged = () => {
        // Ak je to počiatočné načítanie modalu, neboli vykonané žiadne zmeny.
        if (isInitialLoad.current) {
            return false;
        }
        
        const originalData = originalDataRef.current;
        
        // Ak ešte nie sú načítané pôvodné dáta, nedá sa porovnávať.
        if (!originalData.clubName && !originalData.street && !originalData.houseNumber && !originalData.city && !originalData.postalCode && !originalData.country && !originalData.ico && !originalData.dic && !originalData.icdph) {
            return false;
        }

        return (
            getNormalizedValue(clubName) !== getNormalizedValue(originalData.clubName) ||
            getNormalizedValue(street) !== getNormalizedValue(originalData.street) ||
            getNormalizedValue(houseNumber) !== getNormalizedValue(originalData.houseNumber) ||
            getNormalizedValue(city) !== getNormalizedValue(originalData.city) ||
            getNormalizedValue(postalCode) !== getNormalizedValue(originalData.postalCode) ||
            getNormalizedValue(country) !== getNormalizedValue(originalData.country) ||
            getNormalizedValue(ico) !== getNormalizedValue(originalData.ico) ||
            getNormalizedValue(dic) !== getNormalizedValue(originalData.dic) ||
            getNormalizedValue(icdph) !== getNormalizedValue(originalData.icdph)
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

        // Validácia IČ DPH pred odoslaním
        if (icdph && !/^[A-Z]{2}\d+$/.test(icdph) && icdph !== originalDataRef.current.icdph) {
            setError('IČ DPH musí začínať dvoma veľkými písmenami a obsahovať iba číslice.');
            setLoading(false);
            return;
        }
        
        try {
            // Normalizujeme PSČ (odstránime medzery)
            const normalizedPostalCode = postalCode.replace(/\s/g, '');
            
            // Dáta pre kolekciu 'users' (billing a základné údaje)
            const userData = {
                billing: {
                    clubName: clubName !== '' ? clubName : userProfileData.billing?.clubName || '',
                    ico: ico !== '' ? ico : userProfileData.billing?.ico || '',
                    dic: dic !== '' ? dic : userProfileData.billing?.dic || '',
                    icdph: icdph !== '' ? icdph : userProfileData.billing?.icdph || ''
                }
            };
            
            // Dáta pre kolekciu 'usersprivate' (fakturačná adresa)
            const privateData = {
                billingAddress: {
                    street: street !== '' ? street : (userProfileData.billingAddress?.street || ''),
                    houseNumber: houseNumber !== '' ? houseNumber : (userProfileData.billingAddress?.houseNumber || ''),
                    city: city !== '' ? city : (userProfileData.billingAddress?.city || ''),
                    postalCode: normalizedPostalCode !== '' ? normalizedPostalCode : (userProfileData.billingAddress?.postalCode || ''),
                    country: country !== '' ? country : (userProfileData.billingAddress?.country || '')
                }
            };
            
            // Logika pre vytvorenie záznamu o zmene v databáze
            const originalBillingData = originalDataRef.current;
            const changeMessages = [];

            // Mapovanie pre názvy polí
            const fieldNames = {
                'billing.clubName': 'Názov klubu',
                'billing.ico': 'IČO',
                'billing.dic': 'DIČ',
                'billing.icdph': 'IČ DPH',
                'billingAddress.street': 'Ulica (fakturačná)',
                'billingAddress.houseNumber': 'Číslo domu (fakturačné)',
                'billingAddress.city': 'Mesto (fakturačné)',
                'billingAddress.postalCode': 'PSČ (fakturačné)',
                'billingAddress.country': 'Krajina (fakturačná)',
            };

            const changes = {
                'billing.clubName': clubName,
                'billing.ico': ico,
                'billing.dic': dic,
                'billing.icdph': icdph,
                'billingAddress.street': street,
                'billingAddress.houseNumber': houseNumber,
                'billingAddress.city': city,
                'billingAddress.postalCode': normalizedPostalCode,
                'billingAddress.country': country,
            };

            for (const key in changes) {
                const newValue = changes[key];
                let originalValue;
                
                // Získame pôvodnú hodnotu podľa kľúča
                if (key.startsWith('billing.')) {
                    const fieldKey = key.substring(8); // odstránime 'billing.'
                    originalValue = originalBillingData[fieldKey];
                } else if (key.startsWith('billingAddress.')) {
                    const fieldKey = key.substring(15); // odstránime 'billingAddress.'
                    originalValue = originalBillingData[fieldKey];
                } else {
                    originalValue = originalBillingData[key];
                }

                if (newValue !== '' && getNormalizedValue(newValue) !== getNormalizedValue(originalValue)) {
                    const fieldName = fieldNames[key] || key;
                    const oldVal = originalValue || 'prázdne';
                    const newVal = newValue || 'prázdne';
                    changeMessages.push(`Zmena ${fieldName}: z '${oldVal}' na '${newVal}'`);
                }
            }

            // Uložíme zmeny do notifikácií
            if (changeMessages.length > 0) {
                await addDoc(collection(db, 'notifications'), {
                    userEmail: user.email,
                    changes: changeMessages,
                    timestamp: new Date().toISOString(),
                });
            }
            
            // AKTUALIZÁCIA KOLEKCIE 'users'
            await updateDoc(doc(db, "users", user.uid), userData);
            
            // AKTUALIZÁCIA KOLEKCIE 'usersprivate'
            await updateDoc(doc(db, "usersprivate", user.uid), privateData);
            
            window.showGlobalNotification('Fakturačné údaje boli aktualizované!', 'success');
            onClose();

        } catch (e) {
            console.error("Chyba pri aktualizácii fakturačných údajov:", e);
            setError('Nepodarilo sa aktualizovať fakturačné údaje. Skúste to prosím neskôr.');
            window.showGlobalNotification('Nepodarilo sa aktualizovať fakturačné údaje. Skúste to prosím neskôr.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Funkcia na formátovanie PSČ do formátu "XXX XX"
    const formatPostalCodeDisplay = (code) => {
        if (!code) {
            return '';
        }
        const sanitized = code.replace(/\s/g, '').replace(/[^0-9]/g, '');
        if (sanitized.length > 3) {
            return sanitized.substring(0, 3) + ' ' + sanitized.substring(3, 5);
        }
        return sanitized;
    };

    // Nový handler, ktorý zruší počiatočný stav načítania
    const handleValueChange = (setter, value) => {
        isInitialLoad.current = false;
        setter(value);
    };

    // Funkcia pre formátovanie PSČ (pre input)
    const handlePostalCodeChange = (e) => {
        isInitialLoad.current = false;
        const input = e.target.value.replace(/\s/g, ''); // Odstránime medzery
        const sanitized = input.replace(/[^0-9]/g, ''); // Ponecháme len číslice
        
        let formatted = '';
        if (sanitized.length > 3) {
            formatted = sanitized.substring(0, 3) + ' ' + sanitized.substring(3, 5);
        } else {
            formatted = sanitized;
        }

        setPostalCode(formatted);
    };

    // Nová funkcia pre formátovanie IČ DPH počas zadávania
    const handleIcdphChange = (e) => {
        isInitialLoad.current = false;
        const input = e.target.value;
        const sanitized = input.replace(/[^a-zA-Z0-9]/g, ''); // Odstránime všetko okrem písmen a číslic
        let formatted = '';

        // Prvé dva znaky musia byť písmená, prevedieme ich na veľké
        const letters = sanitized.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, '');
        // Zvyšné znaky musia byť číslice
        const digits = sanitized.substring(2).replace(/[^0-9]/g, '');

        formatted = letters + digits;

        setIcdph(formatted);
    };

    // Handler na zatvorenie modalu s kontrolou zmien
    const handleCloseWithCheck = () => {
        // Ak boli vykonané zmeny, najskôr zatvoríme modal, potom zobrazíme notifikáciu
        if (isFormChanged()) {
            onClose(); // Zatvorenie modalu
            // Zobrazíme notifikáciu s krátkym oneskorením, aby sa modal stihol zatvoriť
            setTimeout(() => {
                window.showGlobalNotification('Fakturačné údaje neboli aktualizované!', 'error');
            }, 50); 
        } else {
            // Ak sa žiadne zmeny neuskutočnili, modal sa zatvorí bez upozornenia
            onClose();
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
                onClick: handleCloseWithCheck, // Používame upravený handler
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
        { className: 'p-6 h-full overflow-y-auto' },
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
                { className: 'mb-4' },
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'clubName' },
                    'Oficiálny názov klubu'
                ),
                React.createElement('input', {
                    type: 'text',
                    id: 'clubName',
                    value: clubName,
                    onChange: (e) => handleValueChange(setClubName, e.target.value),
                    placeholder: userProfileData.billing?.clubName || '-',
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
                        'Ulica (fakturačná)'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'street',
                        value: street,
                        onChange: (e) => handleValueChange(setStreet, e.target.value),
                        placeholder: userProfileData.billingAddress?.street || '-',
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
                        'Číslo domu (fakturačné)'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'houseNumber',
                        value: houseNumber,
                        onChange: (e) => handleValueChange(setHouseNumber, e.target.value),
                        placeholder: userProfileData.billingAddress?.houseNumber || '-',
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
                        'Mesto (fakturačné)'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'city',
                        value: city,
                        onChange: (e) => handleValueChange(setCity, e.target.value),
                        placeholder: userProfileData.billingAddress?.city || '-',
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
                        'PSČ (fakturačné)'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'postalCode',
                        value: postalCode,
                        // Použitie novej funkcie pre formátovanie
                        onChange: handlePostalCodeChange,
                        // Ak PSČ neexistuje, zobrazí sa pomlčka
                        placeholder: userProfileData.billingAddress?.postalCode
                            ? formatPostalCodeDisplay(userProfileData.billingAddress.postalCode)
                            : '-',
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
                    'Krajina (fakturačná)'
                ),
                React.createElement('input', {
                    type: 'text',
                    id: 'country',
                    value: country,
                    onChange: (e) => handleValueChange(setCountry, e.target.value),
                    placeholder: userProfileData.billingAddress?.country || '-',
                    className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                    style: { borderColor: roleColor, boxShadow: 'none' }
                })
            ),
            React.createElement(
                'div',
                { className: 'flex mb-4 space-x-4' },
                // IČO
                React.createElement(
                    'div',
                    { className: 'w-1/3' },
                    React.createElement(
                        'label',
                        { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'ico' },
                        'IČO'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'ico',
                        value: ico,
                        onChange: (e) => handleValueChange(setIco, e.target.value.replace(/[^0-9]/g, '')),
                        placeholder: userProfileData.billing?.ico || '-',
                        className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                        style: { borderColor: roleColor, boxShadow: 'none' }
                    })
                ),
                // DIČ
                React.createElement(
                    'div',
                    { className: 'w-1/3' },
                    React.createElement(
                        'label',
                        { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'dic' },
                        'DIČ'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'dic',
                        value: dic,
                        onChange: (e) => handleValueChange(setDic, e.target.value.replace(/[^0-9]/g, '')),
                        placeholder: userProfileData.billing?.dic || '-',
                        className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                        style: { borderColor: roleColor, boxShadow: 'none' }
                    })
                ),
                // IČ DPH
                React.createElement(
                    'div',
                    { className: 'w-1/3' },
                    React.createElement(
                        'label',
                        { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'icdph' },
                        'IČ DPH'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'icdph',
                        value: icdph,
                        onChange: handleIcdphChange,
                        placeholder: userProfileData.billing?.icdph || '-',
                        className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                        style: { borderColor: roleColor, boxShadow: 'none' }
                    })
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end mt-6' },
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: `px-8 py-3 rounded-full font-bold text-lg transition-all duration-300 ${isButtonEnabled ? 'hover:scale-105' : 'cursor-not-allowed'} focus:outline-none`,
                        disabled: !isButtonEnabled || loading,
                        style: buttonStyle
                    },
                    loading ? 'Ukladam...' : 'Uložiť zmeny'
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
                    handleCloseWithCheck(); // Používame upravený handler
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

// logged-in-my-data-change-volunteer-modal.js
import { doc, updateDoc, onSnapshot, addDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { countryDialCodes } from "./countryDialCodes.js";

const formatPostalCode = (value) => {
    const cleanedValue = value.replace(/\D/g, '');
    const limitedValue = cleanedValue.slice(0, 5);
    if (limitedValue.length > 3) {
        return `${limitedValue.slice(0, 3)} ${limitedValue.slice(3)}`;
    }
    return limitedValue;
};

// Funkcia na generovanie dátumov medzi tournamentStart a tournamentEnd
const generateDatesBetween = (startDate, endDate) => {
    const dates = [];
    const currentDate = new Date(startDate);
    const lastDate = new Date(endDate);
    while (currentDate <= lastDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
};

// DialCode Modal (rovnaký ako v registračnom formulári)
const DialCodeModal = ({ isOpen, onClose, onSelect, selectedDialCode, unlockedButtonColor }) => {
    const [filter, setFilter] = React.useState('');
    const modalRef = React.useRef();
    React.useEffect(() => {
        function handleClickOutside(event) {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose, modalRef]);
    const filteredCodes = countryDialCodes.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.dialCode.includes(filter)
    );
    const getDialCodeClasses = (code) => {
        return `py-2 px-4 cursor-pointer hover:bg-gray-100 flex justify-between items-center rounded-lg ${selectedDialCode.dialCode === code.dialCode ? `bg-blue-100 ${unlockedButtonColor} ` : ''}`;
    };
    if (!isOpen) return null;
    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center p-4 z-50' },
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-sm', ref: modalRef },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-lg font-bold' }, 'Vyberte predvoľbu'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-800'
                    },
                    'X'
                )
            ),
            React.createElement('input', {
                type: 'text',
                placeholder: 'Hľadať krajinu alebo kód...',
                className: 'w-full p-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500',
                value: filter,
                onChange: (e) => setFilter(e.target.value)
            }),
            React.createElement(
                'ul',
                { className: 'max-h-60 overflow-y-auto' },
                filteredCodes.map(c =>
                    React.createElement(
                        'li',
                        {
                            key: c.code,
                            className: getDialCodeClasses(c),
                            onClick: () => { onSelect(c); onClose(); }
                        },
                        React.createElement('span', null, c.name),
                        React.createElement('span', { className: 'font-semibold' }, c.dialCode)
                    )
                )
            )
        )
    );
};

const ChangeVolunteerModal = ({ show, onClose, userProfileData, roleColor }) => {
    const [formData, setFormData] = React.useState({
        street: '',
        houseNumber: '',
        city: '',
        postalCode: '',
        country: '',
        gender: '',
        birthDate: '',
        tshirtSize: '',
        volunteerRoles: [],
        selectedDates: [],
        note: '',
        phone: '',
    });
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [tshirtSizes, setTshirtSizes] = React.useState([]);
    const [isSizesLoading, setIsSizesLoading] = React.useState(true);
    const [availableDates, setAvailableDates] = React.useState([]);
    const [isDatesLoading, setIsDatesLoading] = React.useState(true);
    const [selectedDialCode, setSelectedDialCode] = React.useState({ name: 'Slovenská republika', code: 'SK', dialCode: '+421' });
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [phoneNumber, setPhoneNumber] = React.useState('');

    // Načítanie veľkostí tričiek
    React.useEffect(() => {
        if (!show) return;
        const fetchTshirtSizes = () => {
            const db = window.db;
            const docRef = doc(db, 'settings/sizeTshirts');
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data && data.sizes && Array.isArray(data.sizes)) {
                        setTshirtSizes(data.sizes);
                    }
                }
                setIsSizesLoading(false);
            }, (error) => {
                console.error("Chyba pri načítavaní veľkostí tričiek:", error);
                setIsSizesLoading(false);
            });
            return () => unsubscribe();
        };
        fetchTshirtSizes();
    }, [show]);

    // Načítanie dátumov z Firestore
    React.useEffect(() => {
        if (!show) return;
        const fetchTournamentDates = () => {
            const db = window.db;
            const docRef = doc(db, 'settings/registration');
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.tournamentStart && data.tournamentEnd) {
                        const dates = generateDatesBetween(data.tournamentStart.toDate(), data.tournamentEnd.toDate());
                        setAvailableDates(dates);
                    }
                }
                setIsDatesLoading(false);
            }, (error) => {
                console.error("Chyba pri načítavaní dátumov:", error);
                setIsDatesLoading(false);
            });
            return () => unsubscribe();
        };
        fetchTournamentDates();
    }, [show]);

    // Inicializácia formulára s existujúcimi údajmi
    React.useEffect(() => {
        if (show && userProfileData) {
            // Extrahovanie telefónneho čísla a predvoľby
            let phone = userProfileData.contactPhoneNumber || '';
            let dialCode = '+421';
            let restNumber = '';
            const sortedDialCodes = [...countryDialCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);
            for (const country of sortedDialCodes) {
                if (phone.startsWith(country.dialCode)) {
                    dialCode = country.dialCode;
                    restNumber = phone.substring(country.dialCode.length);
                    setSelectedDialCode(country);
                    break;
                }
            }
            // Formátovanie zvyšku čísla po 3 číslach
            const parts = [];
            for (let i = 0; i < restNumber.length; i += 3) {
                parts.push(restNumber.substring(i, i + 3));
            }
            setPhoneNumber(parts.join(' '));
            
            setFormData({
                street: userProfileData.street || '',
                houseNumber: userProfileData.houseNumber || '',
                city: userProfileData.city || '',
                postalCode: userProfileData.postalCode ? 
                    (userProfileData.postalCode.replace(/\s/g, '').slice(0, 3) + ' ' + userProfileData.postalCode.replace(/\s/g, '').slice(3, 5)) : '',
                country: userProfileData.country || '',
                gender: userProfileData.gender || '',
                birthDate: userProfileData.birthDate || '',
                tshirtSize: userProfileData.tshirtSize || '',
                volunteerRoles: userProfileData.volunteerRoles || [],
                selectedDates: userProfileData.selectedDates || [],
                note: userProfileData.note || '',
                phone: restNumber,
            });
        }
    }, [show, userProfileData]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleVolunteerRoleChange = (e) => {
        const { value, checked } = e.target;
        setFormData(prev => {
            const newRoles = checked
                ? [...prev.volunteerRoles, value]
                : prev.volunteerRoles.filter(role => role !== value);
            return { ...prev, volunteerRoles: newRoles };
        });
    };

    const handleDateSelection = (date) => {
        const dateString = date.toISOString().split('T')[0];
        setFormData(prev => {
            const newDates = prev.selectedDates.includes(dateString)
                ? prev.selectedDates.filter(d => d !== dateString)
                : [...prev.selectedDates, dateString];
            return { ...prev, selectedDates: newDates };
        });
    };

    const handlePostalCodeChange = (e) => {
        const formattedValue = formatPostalCode(e.target.value);
        setFormData(prev => ({ ...prev, postalCode: formattedValue }));
    };

    const handlePhoneChange = (e) => {
        const input = e.target;
        const { value, selectionStart } = input;
        const cleanedValue = value.replace(/\D/g, '');
        const formattedValue = cleanedValue.replace(/(\d{3})(?=\d)/g, '$1 ');
        const spacesBefore = (value.slice(0, selectionStart).match(/\s/g) || []).length;
        const spacesAfter = (formattedValue.slice(0, selectionStart).match(/\s/g) || []).length;
        const spaceDiff = spacesAfter - spacesBefore;
        setPhoneNumber(formattedValue);
        setFormData(prev => ({ ...prev, phone: cleanedValue }));
        setTimeout(() => {
            input.selectionStart = selectionStart + spaceDiff;
            input.selectionEnd = selectionStart + spaceDiff;
        }, 0);
    };

    const handleDialCodeSelect = (code) => {
        setSelectedDialCode(code);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        
        const contactPhoneNumber = `${selectedDialCode.dialCode}${formData.phone}`;
        const userId = userProfileData.id;
        
        // --- PRIPRAVA ZMIEN PRE NOTIFIKÁCIU ---
        // Získame pôvodné údaje pred zmenou
        const originalData = {
            street: userProfileData.street || '',
            houseNumber: userProfileData.houseNumber || '',
            city: userProfileData.city || '',
            postalCode: userProfileData.postalCode || '',
            country: userProfileData.country || '',
            gender: userProfileData.gender || '',
            birthDate: userProfileData.birthDate || '',
            tshirtSize: userProfileData.tshirtSize || '',
            volunteerRoles: userProfileData.volunteerRoles || [],
            selectedDates: userProfileData.selectedDates || [],
            note: userProfileData.note || '',
            phone: userProfileData.contactPhoneNumber || '',
        };
        
        // Pripravíme si zoznam zmien pre notifikáciu
        const changeMessages = [];
        
        // Pomocná funkcia na normalizáciu hodnôt (ošetrenie medzier a prázdnych hodnôt)
        const getNormalizedValue = (value) => {
            if (Array.isArray(value)) {
                return value.sort().join(', ');
            }
            return String(value || '').trim();
        };
        
        // Funkcia na formátovanie názvu poľa pre výpis
        const getFieldName = (field) => {
            const fieldNames = {
                street: 'Ulica',
                houseNumber: 'Číslo domu',
                city: 'Mesto',
                postalCode: 'PSČ',
                country: 'Krajina',
                gender: 'Pohlavie',
                birthDate: 'Dátum narodenia',
                tshirtSize: 'Veľkosť trička',
                volunteerRoles: 'Dobrovoľnícke role',
                selectedDates: 'Dostupné dátumy',
                note: 'Poznámka',
                phone: 'Telefónne číslo'
            };
            return fieldNames[field] || field;
        };
        
        // Funkcia na formátovanie hodnoty pre výpis
        const formatValueForDisplay = (field, value) => {
            if (field === 'gender') {
                return value === 'male' ? 'Muž' : (value === 'female' ? 'Žena' : value);
            }
            if (field === 'birthDate' && value) {
                try {
                    return new Date(value).toLocaleDateString('sk-SK');
                } catch (e) {
                    return value;
                }
            }
            if (field === 'selectedDates' && Array.isArray(value)) {
                return value.map(date => {
                    try {
                        return new Date(date).toLocaleDateString('sk-SK');
                    } catch (e) {
                        return date;
                    }
                }).join(', ');
            }
            if (field === 'volunteerRoles' && Array.isArray(value)) {
                return value.join(', ');
            }
            if (field === 'phone') {
                // Formátovanie telefónneho čísla
                const cleanNumber = value.replace(/\s/g, '');
                const sortedDialCodes = [...countryDialCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);
                let dialCode = '';
                let restOfNumber = '';
                for (const country of sortedDialCodes) {
                    if (cleanNumber.startsWith(country.dialCode)) {
                        dialCode = country.dialCode;
                        restOfNumber = cleanNumber.substring(country.dialCode.length);
                        break;
                    }
                }
                if (!dialCode) {
                    return cleanNumber || 'prázdne';
                }
                const parts = [];
                for (let i = 0; i < restOfNumber.length; i += 3) {
                    parts.push(restOfNumber.substring(i, i + 3));
                }
                return `${dialCode} ${parts.join(' ')}`;
            }
            return value || 'prázdne';
        };
        
        // Kontrola zmien v jednotlivých poliach
        // Adresa
        if (getNormalizedValue(formData.street) !== getNormalizedValue(originalData.street)) {
            changeMessages.push(`Zmena ${getFieldName('street')}: z '${formatValueForDisplay('street', originalData.street)}' na '${formatValueForDisplay('street', formData.street)}'`);
        }
        if (getNormalizedValue(formData.houseNumber) !== getNormalizedValue(originalData.houseNumber)) {
            changeMessages.push(`Zmena ${getFieldName('houseNumber')}: z '${formatValueForDisplay('houseNumber', originalData.houseNumber)}' na '${formatValueForDisplay('houseNumber', formData.houseNumber)}'`);
        }
        if (getNormalizedValue(formData.city) !== getNormalizedValue(originalData.city)) {
            changeMessages.push(`Zmena ${getFieldName('city')}: z '${formatValueForDisplay('city', originalData.city)}' na '${formatValueForDisplay('city', formData.city)}'`);
        }
        if (getNormalizedValue(formData.postalCode.replace(/\s/g, '')) !== getNormalizedValue(originalData.postalCode.replace(/\s/g, ''))) {
            changeMessages.push(`Zmena ${getFieldName('postalCode')}: z '${formatValueForDisplay('postalCode', originalData.postalCode)}' na '${formatValueForDisplay('postalCode', formData.postalCode)}'`);
        }
        if (getNormalizedValue(formData.country) !== getNormalizedValue(originalData.country)) {
            changeMessages.push(`Zmena ${getFieldName('country')}: z '${formatValueForDisplay('country', originalData.country)}' na '${formatValueForDisplay('country', formData.country)}'`);
        }
        
        // Osobné údaje
        if (getNormalizedValue(formData.gender) !== getNormalizedValue(originalData.gender)) {
            changeMessages.push(`Zmena ${getFieldName('gender')}: z '${formatValueForDisplay('gender', originalData.gender)}' na '${formatValueForDisplay('gender', formData.gender)}'`);
        }
        if (getNormalizedValue(formData.birthDate) !== getNormalizedValue(originalData.birthDate)) {
            changeMessages.push(`Zmena ${getFieldName('birthDate')}: z '${formatValueForDisplay('birthDate', originalData.birthDate)}' na '${formatValueForDisplay('birthDate', formData.birthDate)}'`);
        }
        
        // Telefónne číslo (porovnávame celé číslo s predvoľbou)
        const newFullPhone = `${selectedDialCode.dialCode}${formData.phone}`;
        if (getNormalizedValue(newFullPhone) !== getNormalizedValue(originalData.phone)) {
            changeMessages.push(`Zmena ${getFieldName('phone')}: z '${formatValueForDisplay('phone', originalData.phone)}' na '${formatValueForDisplay('phone', newFullPhone)}'`);
        }
        
        // Veľkosť trička
        if (getNormalizedValue(formData.tshirtSize) !== getNormalizedValue(originalData.tshirtSize)) {
            changeMessages.push(`Zmena ${getFieldName('tshirtSize')}: z '${formatValueForDisplay('tshirtSize', originalData.tshirtSize)}' na '${formatValueForDisplay('tshirtSize', formData.tshirtSize)}'`);
        }
        
        // Dobrovoľnícke role (porovnanie polí)
        if (JSON.stringify(formData.volunteerRoles.sort()) !== JSON.stringify(originalData.volunteerRoles.sort())) {
            changeMessages.push(`Zmena ${getFieldName('volunteerRoles')}: z '[${formatValueForDisplay('volunteerRoles', originalData.volunteerRoles)}]' na '[${formatValueForDisplay('volunteerRoles', formData.volunteerRoles)}]'`);
        }
        
        // Vybrané dátumy
        if (JSON.stringify(formData.selectedDates.sort()) !== JSON.stringify(originalData.selectedDates.sort())) {
            changeMessages.push(`Zmena ${getFieldName('selectedDates')}: z '[${formatValueForDisplay('selectedDates', originalData.selectedDates)}]' na '[${formatValueForDisplay('selectedDates', formData.selectedDates)}]'`);
        }
        
        // Poznámka
        if (getNormalizedValue(formData.note) !== getNormalizedValue(originalData.note)) {
            changeMessages.push(`Zmena ${getFieldName('note')}: z '${formatValueForDisplay('note', originalData.note)}' na '${formatValueForDisplay('note', formData.note)}'`);
        }
        
        try {
            const db = window.db;
            const userRef = doc(db, 'users', userId);
            
            await updateDoc(userRef, {
                street: formData.street,
                houseNumber: formData.houseNumber,
                city: formData.city,
                postalCode: formData.postalCode.replace(/\s/g, ''),
                country: formData.country,
                gender: formData.gender,
                birthDate: formData.birthDate,
                tshirtSize: formData.tshirtSize,
                volunteerRoles: formData.volunteerRoles,
                selectedDates: formData.selectedDates,
                note: formData.note,
                contactPhoneNumber: contactPhoneNumber,
            });
            
            // --- VYTVORENIE NOTIFIKÁCIE PRE SPRÁVCU ---
            // Ak došlo k nejakým zmenám, vytvoríme záznam v kolekcii 'notifications'
            if (changeMessages.length > 0) {
                await addDoc(collection(db, 'notifications'), {
                    userEmail: userProfileData.email, // E-mail dobrovoľníka
                    changes: changeMessages,          // Pole správ so zmenami
                    timestamp: new Date().toISOString(), // Dátum a čas zmeny
                });
            }
            
            window.showGlobalNotification('Dobrovoľnícke údaje boli úspešne aktualizované.', 'success');
            onClose();
        } catch (error) {
            console.error("Chyba pri ukladaní:", error);
            setError("Nastala chyba pri ukladaní údajov. Skúste to prosím znova.");
            window.showGlobalNotification('Nastala chyba pri ukladaní údajov.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const volunteerOptions = [
        'Registrácia',
        'Organizácia v hale',
        'VIP občerstvenie',
        'Fan shop',
        'Stolík/zápisy stretnutí',
        'Občerstvenie pre deti'
    ];

    const isFormValid = () => {
        return formData.street && formData.houseNumber && formData.city &&
               formData.postalCode.replace(/\s/g, '').length === 5 && formData.country &&
               formData.gender && formData.birthDate && formData.tshirtSize &&
               formData.volunteerRoles.length > 0 && formData.selectedDates.length > 0 &&
               formData.phone.length >= 9;
    };

    if (!show) return null;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center p-4 z-50' },
        React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto' },
            React.createElement(
                'div',
                { className: 'sticky top-0 flex items-center justify-between p-4 border-b', style: { backgroundColor: roleColor } },
                React.createElement('h2', { className: 'text-2xl font-bold text-white' }, 'Upraviť osobné údaje'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-white hover:text-gray-200 text-2xl font-bold'
                    },
                    '×'
                )
            ),
            React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'p-6 space-y-4' },
                // Adresa trvalého bydliska
                React.createElement('h3', { className: 'text-lg font-bold text-gray-800 mb-2' }, 'Adresa trvalého bydliska'),
                React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Ulica'),
                        React.createElement('input', {
                            type: 'text',
                            name: 'street',
                            placeholder: 'Ulica',
                            value: formData.street,
                            onChange: handleInputChange,
                            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                        })
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Popisné číslo'),
                        React.createElement('input', {
                            type: 'text',
                            name: 'houseNumber',
                            placeholder: 'Popisné číslo',
                            value: formData.houseNumber,
                            onChange: handleInputChange,
                            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                        })
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Mesto/obec'),
                        React.createElement('input', {
                            type: 'text',
                            name: 'city',
                            placeholder: 'Mesto/obec',
                            value: formData.city,
                            onChange: handleInputChange,
                            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                        })
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'PSČ (xxx xx)'),
                        React.createElement('input', {
                            type: 'text',
                            name: 'postalCode',
                            placeholder: 'PSČ (xxx xx)',
                            value: formData.postalCode,
                            onChange: handlePostalCodeChange,
                            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                        })
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Krajina'),
                        React.createElement('input', {
                            type: 'text',
                            name: 'country',
                            placeholder: 'Krajina',
                            value: formData.country,
                            onChange: handleInputChange,
                            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                        })
                    )
                ),
                // Pohlavie a Dátum narodenia
                React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Pohlavie'),
                        React.createElement('select', {
                            name: 'gender',
                            value: formData.gender,
                            onChange: handleInputChange,
                            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                        },
                            React.createElement('option', { value: '' }, 'Vyberte...'),
                            React.createElement('option', { value: 'male' }, 'Muž'),
                            React.createElement('option', { value: 'female' }, 'Žena')
                        )
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Dátum narodenia'),
                        React.createElement('input', {
                            type: 'date',
                            name: 'birthDate',
                            value: formData.birthDate,
                            onChange: handleInputChange,
                            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                        })
                    )
                ),
                // Telefónne číslo
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Telefónne číslo'),
                    React.createElement('div', { className: 'flex' },
                        React.createElement('button', {
                            type: 'button',
                            onClick: () => setIsModalOpen(true),
                            className: 'bg-white hover:bg-gray-100 text-gray-700 font-semibold py-2 px-3 rounded-l-lg border-t border-b border-l border-gray-300 focus:outline-none transition-all duration-300 flex items-center justify-between gap-2'
                        },
                            React.createElement('span', null, selectedDialCode.dialCode),
                            React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-4 w-4 text-gray-500", viewBox: "0 0 20 20", fill: "currentColor" },
                                React.createElement('path', { fillRule: "evenodd", d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z", clipRule: "evenodd" })
                            )
                        ),
                        React.createElement('input', {
                            type: 'tel',
                            name: 'phone',
                            placeholder: 'xxx xxx xxx',
                            value: phoneNumber,
                            onChange: handlePhoneChange,
                            className: 'shadow appearance-none border rounded-r-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                        })
                    )
                ),
                // Veľkosť trička
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Veľkosť trička'),
                    React.createElement('select', {
                        name: 'tshirtSize',
                        value: formData.tshirtSize,
                        onChange: handleInputChange,
                        disabled: isSizesLoading,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                    },
                        isSizesLoading ? React.createElement('option', { value: '' }, 'Načítavam veľkosti...') : React.createElement('option', { value: '' }, 'Vyberte veľkosť...'),
                        tshirtSizes.map(size => React.createElement('option', { key: size, value: size }, size))
                    )
                ),
                // Dobrovoľnícke role
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Môžem byť nápomocný'),
                    React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2' },
                        volunteerOptions.map(option => {
                            const isSelected = formData.volunteerRoles.includes(option);
                            return React.createElement('label', {
                                key: option,
                                className: `flex items-center bg-gray-100 p-2 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors duration-200 ${isSelected ? 'bg-blue-200' : ''}`
                            },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    value: option,
                                    checked: isSelected,
                                    onChange: handleVolunteerRoleChange,
                                    className: 'form-checkbox h-4 w-4 text-blue-600'
                                }),
                                React.createElement('span', { className: 'ml-2 text-gray-700 text-sm' }, option)
                            );
                        })
                    )
                ),
                // Výber dátumov
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Vyberte dátumy, kedy môžete pomôcť'),
                    React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto' },
                        availableDates.map((date, index) => {
                            const dateString = date.toISOString().split('T')[0];
                            const isSelected = formData.selectedDates.includes(dateString);
                            return React.createElement('label', {
                                key: index,
                                className: `flex items-center bg-gray-100 p-2 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors duration-200 ${isSelected ? 'bg-blue-200' : ''}`
                            },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    checked: isSelected,
                                    onChange: () => handleDateSelection(date),
                                    className: 'form-checkbox h-4 w-4 text-blue-600'
                                }),
                                React.createElement('span', { className: 'ml-2 text-gray-700 text-sm' }, date.toLocaleDateString('sk-SK'))
                            );
                        })
                    )
                ),
                // Poznámka
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Poznámka (voliteľné)'),
                    React.createElement('textarea', {
                        name: 'note',
                        placeholder: 'Sem môžete napísať dodatočné informácie...',
                        value: formData.note || '',
                        onChange: handleInputChange,
                        rows: 3,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                    })
                ),
                // Chybová správa
                error && React.createElement('div', { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded' }, error),
                // Tlačidlá
                React.createElement('div', { className: 'flex justify-end space-x-3 pt-4 border-t' },
                    React.createElement('button', {
                        type: 'button',
                        onClick: onClose,
                        className: 'px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors'
                    }, 'Zrušiť'),
                    React.createElement('button', {
                        type: 'submit',
                        disabled: isSubmitting || !isFormValid(),
                        className: `px-4 py-2 rounded-lg text-white transition-colors ${isSubmitting || !isFormValid() ? 'bg-gray-400 cursor-not-allowed' : 'hover:opacity-90'}`,
                        style: { backgroundColor: isSubmitting || !isFormValid() ? undefined : roleColor }
                    }, isSubmitting ? 'Ukladám...' : 'Uložiť zmeny')
                )
            ),
            React.createElement(DialCodeModal, {
                isOpen: isModalOpen,
                onClose: () => setIsModalOpen(false),
                onSelect: handleDialCodeSelect,
                selectedDialCode: selectedDialCode,
                unlockedButtonColor: `bg-[${roleColor}] hover:bg-[${roleColor}]/80 text-white`
            })
        )
    );
};

// Export pre použitie v hlavnom súbore
export { ChangeVolunteerModal };

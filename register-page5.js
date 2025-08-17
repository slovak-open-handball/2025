import { getFirestore, doc, onSnapshot, collection, query, getDoc, updateDoc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Komponent pre zobrazenie notifikácií
export function NotificationModal({ message, onClose, type = 'info' }) { // EXPORTOVANÉ
    const [show, setShow] = React.useState(false);
    const timerRef = React.useRef(null);

    React.useEffect(() => {
        if (message) {
            setShow(true);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
                setShow(false);
                setTimeout(onClose, 500);
            }, 10000);
        } else {
            setShow(false);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [message, onClose]);

    if (!show && !message) return null;

    let bgColorClass;
    if (type === 'success') {
        bgColorClass = 'bg-green-500';
    } else if (type === 'error') {
        bgColorClass = 'bg-red-600';
    } else {
        bgColorClass = 'bg-blue-500';
    }

    return React.createElement(
        'div',
        {
            className: `fixed bottom-4 right-4 ${bgColorClass} text-white p-4 rounded-lg shadow-lg transition-transform transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`,
            style: { zIndex: 1000 }
        },
        React.createElement('p', { className: 'font-semibold' }, message)
    );
}

// Komponent pre nastavenia ubytovania a príchodu tímu
function TeamAccommodationAndArrival({
    team,
    categoryName,
    teamIndex,
    onGranularTeamsDataChange, // Prop pre aktualizáciu dát v rodičovi
    loading,
    accommodationTypes,
    accommodationCounts,
    tournamentStartDateDisplay,
    generateTimeOptions
}) {
    const [selectedAccommodation, setSelectedAccommodation] = React.useState(team.accommodation?.type || '');
    const [arrivalType, setArrivalType] = React.useState(team.arrival?.type || '');
    const [arrivalHours, setArrivalHours] = React.useState(() => {
        const initialTime = typeof team.arrival?.time === 'string' ? team.arrival.time : '';
        return initialTime ? initialTime.split(':')[0] : '';
    });
    const [arrivalMinutes, setArrivalMinutes] = React.useState(() => {
        const initialTime = typeof team.arrival?.time === 'string' ? team.arrival.time : '';
        return initialTime ? initialTime.split(':')[1] : '';
    });

    React.useEffect(() => {
        setSelectedAccommodation(team.accommodation?.type || '');
        setArrivalType(team.arrival?.type || '');
        const initialTime = typeof team.arrival?.time === 'string' ? team.arrival.time : '';
        setArrivalHours(initialTime ? initialTime.split(':')[0] : '');
        setArrivalMinutes(initialTime ? initialTime.split(':')[1] : '');
    }, [team.accommodation, team.arrival]);

    const handleAccommodationChange = (e) => {
        const newValue = e.target.value;
        setSelectedAccommodation(newValue);
        onGranularTeamsDataChange(categoryName, teamIndex, 'accommodation', { type: newValue });
    };

    const handleArrivalChange = (e) => {
        const newValue = e.target.value;
        setArrivalType(newValue);
        // Získame existujúce dáta o príchode, aby sme zachovali drivers, ak sa zmení len typ dopravy
        const currentTeamArrivalData = team.arrival || {};

        if (newValue !== 'verejná doprava - vlak' && newValue !== 'verejná doprava - autobus') {
            setArrivalHours('');
            setArrivalMinutes('');
            // Ak je typ dopravy 'vlastná doprava' alebo 'bez dopravy', drivers by mali byť null alebo prázdny objekt {male:0, female:0}
            const driversToPass = newValue === 'vlastná doprava' ? { male: 0, female: 0 } : null;
            onGranularTeamsDataChange(categoryName, teamIndex, 'arrival', { type: newValue, time: null, drivers: driversToPass });
        } else {
            // Ak je verejná doprava, drivers sú null
            const timeString = (arrivalHours && arrivalMinutes) ? `${arrivalHours}:${arrivalMinutes}` : '';
            onGranularTeamsDataChange(categoryName, teamIndex, 'arrival', { type: newValue, time: timeString, drivers: null });
        }
    };

    const handleTimeSelectChange = (e) => {
        const { id, value } = e.target;
        let currentHours = arrivalHours;
        let currentMinutes = arrivalMinutes;

        if (id.includes('arrivalHours')) {
            currentHours = value;
            setArrivalHours(value);
        } else if (id.includes('arrivalMinutes')) {
            currentMinutes = value;
            setArrivalMinutes(value);
        }

        let timeString = '';
        if (currentHours && currentMinutes) {
            timeString = `${currentHours}:${currentMinutes}`;
        } else if (currentHours && currentMinutes === '') {
            timeString = currentHours; // Ak sú hodiny, ale minúty nie
        } else if (currentHours === '' && currentMinutes) {
            timeString = currentMinutes; // Ak sú minúty, ale hodiny nie
        }
        // Pri zmene času zachovať existujúce drivers a typ dopravy
        const currentTeamArrivalData = team.arrival || {};
        onGranularTeamsDataChange(categoryName, teamIndex, 'arrival', {
            ...currentTeamArrivalData,
            type: arrivalType, // Zabezpečiť, že sa nemení typ dopravy
            time: timeString || null,
            drivers: currentTeamArrivalData.drivers // Zachovať drivers
        });
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(
            'div',
            { className: 'border-t border-gray-200 pt-4 mt-4' },
            React.createElement('h4', { className: 'text-lg font-bold mb-4 text-gray-700' }, 'Výber typu ubytovania'),
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement(
                    'div',
                    { className: 'space-y-2' },
                    React.createElement(
                        'label',
                        { className: `flex items-center p-3 rounded-lg cursor-pointer ${loading ? 'bg-gray-100' : 'hover:bg-blue-50'} transition-colors duration-200` },
                        React.createElement('input', {
                            type: 'radio',
                            name: `accommodationType-${categoryName}-${teamIndex}`,
                            value: 'bez ubytovania',
                            checked: selectedAccommodation === 'bez ubytovania',
                            onChange: handleAccommodationChange,
                            className: 'form-radio h-5 w-5 text-blue-600',
                            disabled: loading,
                        }),
                        React.createElement('span', { className: 'ml-3 text-gray-800' }, `bez ubytovania`)
                    ),
                    accommodationTypes.sort((a, b) => a.type.localeCompare(b.type)).map((acc) => {
                        const currentCount = accommodationCounts[acc.type] || 0;
                        const isFull = currentCount >= acc.capacity;
                        const isDisabled = isFull || loading;
                        const labelClasses = `flex items-center p-3 rounded-lg ${isDisabled ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'hover:bg-blue-50 cursor-pointer'} transition-colors duration-200`;

                        return React.createElement(
                            'label',
                            {
                                key: acc.type,
                                className: labelClasses,
                            },
                            React.createElement('input', {
                                type: 'radio',
                                name: `accommodationType-${categoryName}-${teamIndex}`,
                                value: acc.type,
                                checked: selectedAccommodation === acc.type,
                                onChange: handleAccommodationChange,
                                className: 'form-radio h-5 w-5 text-blue-600',
                                disabled: isDisabled,
                            }),
                            React.createElement('span', { className: 'ml-3 text-gray-800' },
                                `${acc.type}${isFull ? ' (naplnená kapacita)' : ''}`
                            )
                        );
                    })
                )
            )
        ),

        React.createElement(
            'div',
            { className: 'border-t border-gray-200 pt-4 mt-4' },
            React.createElement('h4', { className: 'text-lg font-bold mb-4 text-gray-700' }, 'Výber spôsobu príchodu na turnaj'),
            React.createElement(
                'p',
                { className: 'text-sm text-gray-600 mb-4' },
                `Ak budete prichádzať verejnou dopravou a je potrebné pre Vás zabezpečiť dopravu na miesto ubytovania, napíšte nám čas príchodu vlaku/autobusu dňa ${tournamentStartDateDisplay} do Žiliny. V prípade príchodu po 10:00 hod. bude zabezpečený zvoz len na miesto otvorenia turnaja.`
            ),
            React.createElement(
                'div',
                { className: 'mb-4 space-y-2' },
                React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                        'label',
                        { className: `flex items-center p-3 rounded-lg cursor-pointer ${loading ? 'bg-gray-100' : 'hover:bg-blue-50'} transition-colors duration-200` },
                        React.createElement('input', {
                            type: 'radio',
                            name: `arrivalType-${categoryName}-${teamIndex}`,
                            value: 'verejná doprava - vlak',
                            checked: arrivalType === 'verejná doprava - vlak',
                            onChange: handleArrivalChange,
                            className: 'form-radio h-5 w-5 text-blue-600',
                            disabled: loading,
                        }),
                        React.createElement('span', { className: 'ml-3 text-gray-800' }, 'verejná doprava - vlak')
                    ),
                    arrivalType === 'verejná doprava - vlak' && React.createElement(
                        'div',
                        { className: 'ml-8 mb-4' },
                        React.createElement(
                            'div',
                            { className: 'flex space-x-4' },
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: `arrivalHours-${categoryName}-${teamIndex}` }, 'Hodina'),
                                React.createElement('select', {
                                    id: `arrivalHours-${categoryName}-${teamIndex}`,
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalHours || '',
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                }, generateTimeOptions(24))
                            ),
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: `arrivalMinutes-${categoryName}-${teamIndex}` }, 'Minúta'),
                                React.createElement('select', {
                                    id: `arrivalMinutes-${categoryName}-${teamIndex}`,
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalMinutes || '',
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                }, generateTimeOptions(60))
                            )
                        )
                    )
                ),
                React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                        'label',
                        { className: `flex items-center p-3 rounded-lg cursor-pointer ${loading ? 'bg-gray-100' : 'hover:bg-blue-50'} transition-colors duration-200` },
                        React.createElement('input', {
                            type: 'radio',
                            name: `arrivalType-${categoryName}-${teamIndex}`,
                            value: 'verejná doprava - autobus',
                            checked: arrivalType === 'verejná doprava - autobus',
                            onChange: handleArrivalChange,
                            className: 'form-radio h-5 w-5 text-blue-600',
                            disabled: loading,
                        }),
                        React.createElement('span', { className: 'ml-3 text-gray-800' }, 'verejná doprava - autobus')
                    ),
                    arrivalType === 'verejná doprava - autobus' && React.createElement(
                        'div',
                        { className: 'ml-8 mb-4' },
                        React.createElement(
                            'div',
                            { className: 'flex space-x-4' },
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { htmlFor: `arrivalHours-${categoryName}-${teamIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Hodina'),
                                React.createElement('select', {
                                    id: `arrivalHours-${categoryName}-${teamIndex}`,
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalHours || '',
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                }, generateTimeOptions(24))
                            ),
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { htmlFor: `arrivalMinutes-${categoryName}-${teamIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Minúta'),
                                React.createElement('select', {
                                    id: `arrivalMinutes-${categoryName}-${teamIndex}`,
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalMinutes || '',
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                }, generateTimeOptions(60))
                            )
                        )
                    )
                ),
                React.createElement(
                    'label',
                    { className: `flex items-center p-3 rounded-lg cursor-pointer ${loading ? 'bg-gray-100' : 'hover:bg-blue-50'} transition-colors duration-200` },
                    React.createElement('input', {
                        type: 'radio',
                        name: `arrivalType-${categoryName}-${teamIndex}`,
                        value: 'vlastná doprava',
                        checked: arrivalType === 'vlastná doprava',
                        onChange: handleArrivalChange,
                        className: 'form-radio h-5 w-5 text-blue-600',
                        disabled: loading,
                    }),
                    React.createElement('span', { className: 'ml-3 text-gray-800' }, 'vlastná doprava')
                ),
                React.createElement(
                    'label',
                    { className: `flex items-center p-3 rounded-lg cursor-pointer ${loading ? 'bg-gray-100' : 'hover:bg-blue-50'} transition-colors duration-200` },
                    React.createElement('input', {
                        type: 'radio',
                        name: `arrivalType-${categoryName}-${teamIndex}`,
                        value: 'bez dopravy',
                        checked: arrivalType === 'bez dopravy',
                        onChange: handleArrivalChange,
                        className: 'form-radio h-5 w-5 text-blue-600',
                        disabled: loading,
                    }),
                    React.createElement('span', { className: 'ml-3 text-gray-800' }, 'bez dopravy')
                )
            )
        )
    );
}

// NOVÝ KOMPONENT: TeamPackageSettings
function TeamPackageSettings({
    team,
    categoryName,
    teamIndex,
    onGranularTeamsDataChange,
    loading,
    packages,
    tournamentDays
}) {
    const [selectedPackageId, setSelectedPackageId] = React.useState(team.packageId || '');

    React.useEffect(() => {
        setSelectedPackageId(team.packageId || '');
    }, [team.packageId]);

    const handlePackageChange = (e) => {
        const newPackageId = e.target.value;
        setSelectedPackageId(newPackageId);
        const selectedPackageDetails = packages.find(pkg => pkg.id === newPackageId);
        onGranularTeamsDataChange(categoryName, teamIndex, 'packageId', newPackageId);
        onGranularTeamsDataChange(categoryName, teamIndex, 'packageDetails', selectedPackageDetails);
    };

    return React.createElement(
        'div',
        { className: 'border-t border-gray-200 pt-4 mt-4' },
        React.createElement('h4', { className: 'text-lg font-bold mb-4 text-gray-700' }, 'Výber balíčka'),
        React.createElement(
            'p',
            { className: 'text-sm text-gray-600 mb-4' },
            `Uvedená cena je pre jednu osobu.`
        ),
        React.createElement(
            'div',
            { className: 'mb-4 space-y-2' },
            packages.length > 0 ? (
                packages.map((pkg) => (
                    React.createElement(
                        'label',
                        {
                            key: pkg.id,
                            className: `flex flex-col p-3 rounded-lg border cursor-pointer ${selectedPackageId === pkg.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'} ${loading ? 'opacity-70 cursor-not-allowed' : ''} transition-colors duration-200`,
                        },
                        React.createElement(
                            'div',
                            { className: 'flex items-center justify-between w-full' },
                            React.createElement(
                                'div',
                                { className: 'flex items-center' },
                                React.createElement('input', {
                                    type: 'radio',
                                    name: `selectedPackage-${categoryName}-${teamIndex}`,
                                    value: pkg.id,
                                    checked: selectedPackageId === pkg.id,
                                    onChange: handlePackageChange,
                                    className: 'form-radio h-5 w-5 text-blue-600',
                                    disabled: loading,
                                }),
                                React.createElement('span', { className: 'ml-3 font-semibold text-gray-800' }, pkg.name)
                            ),
                            React.createElement('span', { className: 'font-bold text-gray-900' }, `${pkg.price} €`)
                        ),
                        React.createElement(
                            'div',
                            { className: 'ml-8 text-sm text-gray-600 mt-2' },
                            (pkg.meals && (tournamentDays.length > 0 || Object.keys(pkg.meals).length > 0)) ? (
                                [...new Set([...tournamentDays, ...Object.keys(pkg.meals || {}).filter(key => key !== 'participantCard')])].sort().map(date => {
                                    const mealsForDay = pkg.meals[date];
                                    const includedItems = [];

                                    // Kontrola, či je dátum platný
                                    if (isNaN(new Date(date).getTime())) {
                                        return null;
                                    }

                                    if (mealsForDay && mealsForDay.breakfast === 1) includedItems.push('raňajky');
                                    if (mealsForDay && mealsForDay.lunch === 1) includedItems.push('obed');
                                    if (mealsForDay && mealsForDay.dinner === 1) includedItems.push('večera');
                                    if (mealsForDay && mealsForDay.refreshment === 1) includedItems.push('občerstvenie');

                                    if (includedItems.length > 0) {
                                        const dateObj = new Date(date + 'T00:00:00'); // Ensure date is parsed correctly
                                        const displayDate = dateObj.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric' });
                                        return React.createElement('p', { key: date }, `${displayDate}: ${includedItems.join(', ')}`);
                                    }
                                    return null;
                                }).filter(item => item !== null)
                            ) : (
                                React.createElement('p', null, 'Žiadne stravovanie definované pre tento balíček.')
                            ),
                            (pkg.meals && pkg.meals.participantCard === 1) &&
                                React.createElement('p', { className: 'font-bold text-gray-700 mt-1' }, 'zahŕňa účastnícku kartu')
                        )
                    )
                ))
            ) : (
                React.createElement('p', { className: 'text-gray-500 text-center py-4' }, 'Nie sú dostupné žiadne balíčky.')
            )
        )
    );
}


// Komponent pre vlastný selectbox tímu s možnosťou zalamovania textu
function CustomTeamSelect({ value, onChange, options, disabled, placeholder }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const selectRef = React.useRef(null);

    // Formátovanie zobrazenej hodnoty
    const selectedOption = options.find(option => option.id === value);
    const displayedValue = selectedOption ? `${selectedOption.categoryName} - ${selectedOption.teamName}` : placeholder;

    const handleSelectClick = () => {
        if (!disabled) {
            setIsOpen(prev => !prev);
        }
    };

    const handleOptionClick = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    // Zatvorenie selectboxu pri kliknutí mimo neho
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const inputClasses = `
        shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-full cursor-pointer
        ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}
        relative flex justify-between items-center pr-10
        min-h-[4rem] flex-wrap align-middle
    `;

    const dropdownClasses = `
        absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto
        ${isOpen ? 'block' : 'hidden'}
    `;

    const optionClasses = `
        px-3 py-2 cursor-pointer hover:bg-blue-100 text-gray-800 whitespace-normal break-words
    `;

    return React.createElement(
        'div',
        { className: 'relative w-full', ref: selectRef },
        React.createElement(
            'div',
            { className: inputClasses, onClick: handleSelectClick },
            React.createElement('span', { className: 'flex-grow whitespace-normal' }, displayedValue),
            React.createElement(
                'svg',
                { className: `h-5 w-5 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`, viewBox: '0 0 20 20', fill: 'currentColor' },
                React.createElement('path', { fillRule: 'evenodd', d: 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z', clipRule: 'evenodd' })
            )
        ),
        React.createElement(
            'div',
            { className: dropdownClasses },
            options.length === 0 ? (
                React.createElement('div', { className: 'px-3 py-2 text-gray-500' }, 'Žiadne dostupné tímy.')
            ) : (
                options.map(option => (
                    React.createElement(
                        'div',
                        {
                            key: option.id,
                            onClick: () => handleOptionClick(option.id),
                            className: optionClasses + (option.id === value ? ' bg-blue-200' : '')
                        },
                        // Zmena formátu pre zobrazenie v rozbaľovacom zozname
                        `${option.categoryName} - ${option.teamName}`
                    )
                ))
            )
        )
    );
}


// Hlavný komponent Page5Form
export function Page5Form({ formData, handlePrev, handleSubmit, loading, setLoading, setRegistrationSuccess, handleChange, setTeamsDataFromPage4, teamsDataFromPage4, isRecaptchaReady, tournamentStartDate, tournamentEndDate, onGranularTeamsDataChange }) {
    const db = getFirestore();

    const [notificationMessage, setNotificationMessage] = React.useState('');
    const [notificationType, setNotificationType] = React.useState('info');

    const closeNotification = () => {
        setNotificationMessage('');
        setNotificationType('info');
    };

    const [accommodationTypes, setAccommodationTypes] = React.useState([]);
    const [accommodationCounts, setAccommodationCounts] = React.useState({});
    const [packages, setPackages] = React.useState([]); // Packages state is still needed here for fetching
    const [tournamentStartDateDisplay, setTournamentStartDateDisplay] = React.useState('');

    // Lokálny stav pre záznamy šoférov - teraz inicializovaný z teamsDataFromPage4 v useEffect
    const [driverEntries, setDriverEntries] = React.useState([]);

    // Pomocná funkcia na generovanie unikátneho ID pre dočasné záznamy šoférov
    const generateUniqueId = () => `driver-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Funkcia na re-agregáciu dát šoférov pre konkrétny tím a aktualizáciu rodičovského stavu
    const updateTeamDriversInParent = React.useCallback((currentEntries, categoryName, teamIndex) => {
        const currentTeamDrivers = { male: 0, female: 0 };
        currentEntries.forEach(entry => {
            if (entry.categoryName === categoryName && entry.teamIndex === teamIndex && entry.gender && entry.count !== '') {
                const count = parseInt(entry.count, 10);
                if (!isNaN(count) && count > 0) {
                    if (entry.gender === 'male') {
                        currentTeamDrivers.male += count;
                    } else {
                        currentTeamDrivers.female += count;
                    }
                }
            }
        });

        const currentTeamArrivalData = team.arrival || {}; // Uistite sa, že používate 'team' z props
        onGranularTeamsDataChange(categoryName, teamIndex, 'arrival', {
            ...currentTeamArrivalData,
            drivers: currentTeamDrivers.male === 0 && currentTeamDrivers.female === 0 ? null : currentTeamDrivers
        });
    }, [onGranularTeamsDataChange, teamsDataFromPage4]);


    // useEffect na inicializáciu driverEntries z teamsDataFromPage4
    React.useEffect(() => {
        const driversFromParentData = [];

        for (const categoryName in teamsDataFromPage4) {
            // Filter out any undefined/null categories at this level
            if (!teamsDataFromPage4[categoryName] || typeof teamsDataFromPage4[categoryName] !== 'object') continue;

            (teamsDataFromPage4[categoryName] || []).filter(t => t).forEach((team, teamIndex) => {
                const teamStableIdPrefix = `${categoryName}-${teamIndex}`;

                if (team.arrival?.type === 'vlastná doprava') {
                    if (team.arrival?.drivers?.male > 0) {
                        driversFromParentData.push({
                            id: `${teamStableIdPrefix}-male`,
                            count: team.arrival.drivers.male.toString(),
                            gender: 'male',
                            categoryName: categoryName,
                            teamIndex: teamIndex,
                        });
                    }
                    if (team.arrival?.drivers?.female > 0) {
                        driversFromParentData.push({
                            id: `${teamStableIdPrefix}-female`,
                            count: team.arrival.drivers.female.toString(),
                            gender: 'female',
                            categoryName: categoryName,
                            teamIndex: teamIndex,
                        });
                    }
                }
            });
        }
        
        // Len ak je teamsDataFromPage4 plne načítané (t.j. už to nie je prázdny počiatočný stav),
        // tak aktualizujeme driverEntries. Inak ponecháme pôvodný stav.
        if (Object.keys(teamsDataFromPage4).length > 0 || (Object.keys(teamsDataFromPage4).length === 0 && driverEntries.length === 0)) {
            setDriverEntries(driversFromParentData);
        }
        
    }, [teamsDataFromPage4]); // Závislosť od teamsDataFromPage4


    const getDaysBetween = (start, end) => {
        const dates = [];
        let currentDate = new Date(start);
        while (currentDate <= end) {
            dates.push(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return dates;
    };

    const tournamentDays = React.useMemo(() => {
        const startDate = tournamentStartDate ? new Date(tournamentStartDate) : null;
        const endDate = tournamentEndDate ? new Date(tournamentEndDate) : null;
        if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            return getDaysBetween(startDate, endDate);
        }
        return [];
    }, [tournamentStartDate, tournamentEndDate]);


    React.useEffect(() => {
        let unsubscribeAccommodation;
        let unsubscribeRegistrationSettings;
        let unsubscribePackages;

        const fetchSettings = () => {
            if (!window.db) {
                setTimeout(fetchSettings, 100);
                return;
            }
            try {
                const accommodationDocRef = doc(window.db, 'settings', 'accommodation');
                unsubscribeAccommodation = onSnapshot(accommodationDocRef, (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        setAccommodationTypes(data.types || []);
                    } else {
                        setAccommodationTypes([]);
                    }
                }, (error) => {
                    console.error("Chyba pri načítaní nastavení ubytovania:", error);
                    setNotificationMessage("Chyba pri načítaní nastavení ubytovania.", 'error');
                    setNotificationType('error');
                });

                const packagesCollectionRef = collection(window.db, 'settings', 'packages', 'list');
                unsubscribePackages = onSnapshot(packagesCollectionRef, (snapshot) => {
                    const fetchedPackages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    fetchedPackages.sort((a, b) => a.name.localeCompare(b.name));
                    setPackages(fetchedPackages);
                }, (error) => {
                    console.error("Chyba pri načítaní balíčkov:", error);
                    setNotificationMessage("Chyba pri načítaní balíčkov.", 'error');
                    setNotificationType('error');
                });

                const registrationDocRef = doc(window.db, 'settings', 'registration');
                unsubscribeRegistrationSettings = onSnapshot(registrationDocRef, (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        if (data.tournamentStart && data.tournamentStart instanceof Timestamp) {
                            const date = data.tournamentStart.toDate();
                            const formattedDate = date.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            setTournamentStartDateDisplay(formattedDate);
                        } else {
                            setTournamentStartDateDisplay('');
                        }
                    } else {
                        setTournamentStartDateDisplay('');
                    }
                }, (error) => {
                    console.error("Chyba pri načítaní nastavení registrácie (tournamentStart):", error);
                });

            } catch (e) {
                console.error("Chyba pri nastavovaní poslucháča pre ubytovanie/balíčky/registrácie:", e);
                setNotificationMessage("Chyba pri načítaní údajov.", 'error');
                setNotificationType('error');
            }
        };

        fetchSettings();

        return () => {
            if (unsubscribeAccommodation) {
                unsubscribeAccommodation();
            }
            if (unsubscribePackages) {
                unsubscribePackages();
            }
            if (unsubscribeRegistrationSettings) {
                unsubscribeRegistrationSettings();
            }
        };
    }, [db]); // Pridaná závislosť na db

    React.useEffect(() => {
        let unsubscribeCounts;
        const fetchAccommodationCounts = () => {
            if (!window.db) {
                setTimeout(fetchAccommodationCounts, 100);
                return;
            }
            try {
                const accommodationCountsDocRef = doc(window.db, 'settings', 'accommodationCounts');
                unsubscribeCounts = onSnapshot(accommodationCountsDocRef, (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        setAccommodationCounts(data || {});
                    } else {
                        setAccommodationCounts({});
                    }
                }, (error) => {
                    console.error("Chyba pri načítaní počtov obsadenosti ubytovania:", error);
                    setNotificationMessage("Chyba pri načítaní údajov o obsadenosti ubytovania.", 'error');
                    setNotificationType('error');
                });
            } catch (e) {
                console.error("Chyba pri nastavovaní poslucháča pre počty ubytovania:", e);
                setNotificationMessage("Chyba pri načítaní údajov o obsadenosti ubytovania.", 'error');
                setNotificationType('error');
            }
        };

        fetchAccommodationCounts();

        return () => {
            if (unsubscribeCounts) {
                unsubscribeCounts();
            }
        };
    }, [db]);

    // Táto funkcia teraz volá onGranularTeamsDataChange
    const handleTeamDataChange = React.useCallback((categoryName, teamIndex, field, value) => {
        setTeamsData(prevTeamsData => {
            const updatedTeamsData = { ...prevTeamsData };
            if (!updatedTeamsData[categoryName]) {
                updatedTeamsData[categoryName] = [];
            }
            if (!updatedTeamsData[categoryName][teamIndex]) {
                updatedTeamsData[categoryName][teamIndex] = {};
            }

            // Špeciálne ošetrenie pre playerDetails, womenTeamMemberDetails, menTeamMemberDetails
            if (['playerDetails', 'womenTeamMemberDetails', 'menTeamMemberDetails'].includes(field)) {
                updatedTeamsData[categoryName][teamIndex][field] = value;
            } else if (field.startsWith('players_')) { // Spracovanie zmien v počte hráčov alebo členov tímu
                const [, teamType] = field.split('_'); // 'players', 'womenTeamMembers', 'menTeamMembers'
                const currentCount = updatedTeamsData[categoryName][teamIndex][teamType] || 0;
                const newCount = parseInt(value, 10);

                updatedTeamsData[categoryName][teamIndex][teamType] = isNaN(newCount) ? 0 : newCount;

                // Inicializácia alebo orezanie detailov hráčov/členov tímu
                const detailFieldName = teamType === 'players' ? 'playerDetails' :
                                       (teamType === 'womenTeamMembers' ? 'womenTeamMemberDetails' : 'menTeamMemberDetails');
                const currentDetails = updatedTeamsData[categoryName][teamIndex][detailFieldName] || [];
                const newDetails = Array(newCount).fill(null).map((_, i) => currentDetails[i] || {});
                updatedTeamsData[categoryName][teamIndex][detailFieldName] = newDetails;
            } else if (field.startsWith('tshirt_')) {
                const [, size] = field.split('_');
                const quantity = parseInt(value, 10);
                const currentTshirts = updatedTeamsData[categoryName][teamIndex].tshirts || [];
                const existingTshirtIndex = currentTshirts.findIndex(t => t.size === size);

                if (existingTshirtIndex !== -1) {
                    if (isNaN(quantity) || quantity <= 0) {
                        currentTshirts.splice(existingTshirtIndex, 1); // Odstrániť, ak je 0 alebo NaN
                    } else {
                        currentTshirts[existingTshirtIndex] = { size, quantity };
                    }
                } else if (!isNaN(quantity) && quantity > 0) {
                    currentTshirts.push({ size, quantity });
                }
                updatedTeamsData[categoryName][teamIndex].tshirts = [...currentTshirts]; // Vytvoriť novú referenciu pre React
            } else {
                updatedTeamsData[categoryName][teamIndex][field] = value;
            }
            return updatedTeamsData;
        });
    }, []); // Empty dependency array means this function is created once

    // Volá sa pri zmene vnútri Page4Form, aby sa aktualizoval nadradený stav
    React.useEffect(() => {
        // Iba ak je `teamsData` (lokálny stav) odlišný od `teamsDataFromPage4` (prop),
        // vykonáme aktualizáciu rodičovského stavu, aby sme predišli nekonečnej slučke.
        // Hlboká kontrola rovnosti objektov je dôležitá.
        if (JSON.stringify(teamsData) !== JSON.stringify(teamsDataFromPage4)) {
            setTeamsDataFromPage4(teamsData);
        }
    }, [teamsData, setTeamsDataFromPage4, teamsDataFromPage4]);


    // Validácia formulára pre Page4Form
    const isFormValidPage4 = React.useMemo(() => {
        if (!teamsData || Object.keys(teamsData).length === 0) {
            return false;
        }

        for (const categoryName in teamsData) {
            const teamsInCurrentCategory = teamsData[categoryName];
            if (!teamsInCurrentCategory || !Array.isArray(teamsInCurrentCategory)) {
                return false;
            }

            for (const team of teamsInCurrentCategory) {
                if (!team) continue; // Skip null or undefined team entries

                // Kontrola názvu tímu
                if (!team.teamName || team.teamName.trim() === '') {
                    return false;
                }

                // Kontrola počtu hráčov a členov realizačného tímu
                if (team.players === undefined || team.players < 0 || team.players > numberOfPlayersLimit) return false;
                if (team.womenTeamMembers === undefined || team.womenTeamMembers < 0 || team.womenTeamMembers > numberOfTeamMembersLimit) return false;
                if (team.menTeamMembers === undefined || team.menTeamMembers < 0 || team.menTeamMembers > numberOfTeamMembersLimit) return false;


                // Kontrola detailov hráčov
                if (team.players > 0) {
                    if (!team.playerDetails || team.playerDetails.length !== team.players) return false;
                    for (const player of team.playerDetails) {
                        if (!player || !player.firstName || player.firstName.trim() === '' ||
                            !player.lastName || player.lastName.trim() === '' ||
                            !player.dateOfBirth || player.dateOfBirth.trim() === '' ||
                            !player.jerseyNumber || player.jerseyNumber <= 0 ||
                            player.isRegistered === undefined || // must be boolean
                            (player.isRegistered && (!player.registrationNumber || player.registrationNumber.trim() === '')) // if registered, reg. number must be present
                        ) {
                            return false;
                        }
                    }
                }

                // Kontrola detailov ženských členov realizačného tímu
                if (team.womenTeamMembers > 0) {
                    if (!team.womenTeamMemberDetails || team.womenTeamMemberDetails.length !== team.womenTeamMembers) return false;
                    for (const member of team.womenTeamMemberDetails) {
                        if (!member || !member.firstName || member.firstName.trim() === '' ||
                            !member.lastName || member.lastName.trim() === '' ||
                            !member.dateOfBirth || member.dateOfBirth.trim() === ''
                        ) {
                            return false;
                        }
                    }
                }

                // Kontrola detailov mužských členov realizačného tímu
                if (team.menTeamMembers > 0) {
                    if (!team.menTeamMemberDetails || team.menTeamMemberDetails.length !== team.menTeamMembers) return false;
                    for (const member of team.menTeamMemberDetails) {
                        if (!member || !member.firstName || member.firstName.trim() === '' ||
                            !member.lastName || member.lastName.trim() === '' ||
                            !member.dateOfBirth || member.dateOfBirth.trim() === ''
                        ) {
                            return false;
                        }
                    }
                }

                // Kontrola tričiek (ak sú nejaké veľkosti dostupné)
                if (tshirtSizes.length > 0) {
                    const totalTshirtQuantity = (team.tshirts || []).reduce((sum, t) => sum + (t.quantity || 0), 0);
                    const totalTeamMembers = team.players + team.womenTeamMembers + team.menTeamMembers;
                    if (totalTshirtQuantity !== totalTeamMembers) {
                        return false; // Počet tričiek sa musí zhodovať s celkovým počtom členov tímu
                    }
                }
            }
        }
        return true;
    }, [teamsData, numberOfPlayersLimit, numberOfTeamMembersLimit, tshirtSizes]);


    const nextButtonClasses = `
        font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
        ${!isFormValidPage4 || loading || !isRecaptchaReady
            ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-700 text-white'
        }
    `;

    // Funkcia pre prechod na predchádzajúcu stránku
    const handlePrevClick = () => {
        // Pri návrate nezabúdame odovzdať aktuálne dáta, ak boli nejaké zadané
        handlePrev(teamsData);
    };

    // Funkcia pre spracovanie odoslania formulára pre túto stránku
    const handlePage4Submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        // Prístup k setShowNotification, setNotificationMessage, setNotificationType z props
        closeNotification();

        if (!isFormValidPage4) {
            setNotificationMessage("Prosím, vyplňte všetky povinné polia pre každý tím a uistite sa, že počet tričiek zodpovedá počtu členov.", 'error');
            setNotificationType('error');
            setLoading(false);
            return;
        }

        try {
            // teamsData už obsahuje aktuálny stav, ktorý bol synchronizovaný cez useEffect
            await handleNextPage4(teamsData);
        } catch (error) {
            console.error("Chyba pri spracovaní dát Page4:", error);
            setNotificationMessage(`Chyba pri spracovaní údajov: ${error.message}`, 'error');
            setNotificationType('error');
        } finally {
            setLoading(false);
        }
    };


    const renderTeamForm = (categoryName, teamsInCategory) => {
        return (teamsInCategory || []).filter(team => team).map((team, teamIndex) => {
            const teamId = `${categoryName}-${teamIndex}`;

            // Handle playerDetails initialization if undefined or null
            const playerDetails = team.playerDetails || Array(team.players || 0).fill(null).map(() => ({}));
            const womenTeamMemberDetails = team.womenTeamMemberDetails || Array(team.womenTeamMembers || 0).fill(null).map(() => ({}));
            const menTeamMemberDetails = team.menTeamMemberDetails || Array(team.menTeamMembers || 0).fill(null).map(() => ({}));
            const tshirts = team.tshirts || [];

            return React.createElement(
                'div',
                { key: teamId, className: 'bg-blue-50 p-4 rounded-lg mb-6 shadow-md border border-blue-100' },
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { htmlFor: `teamName-${teamId}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Názov tímu'),
                        React.createElement('input', {
                            type: 'text',
                            id: `teamName-${teamId}`,
                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                            value: team.teamName || '',
                            onChange: (e) => handleTeamDetailsChange(categoryName, teamIndex, 'teamName', e.target.value),
                            placeholder: 'Zadajte názov tímu',
                            required: true,
                            disabled: loading,
                            tabIndex: 1 + teamIndex * 10
                        })
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { htmlFor: `players-${teamId}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, `Počet hráčov (max ${numberOfPlayersLimit})`),
                        React.createElement('input', {
                            type: 'number',
                            id: `players-${teamId}`,
                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                            value: team.players || 0,
                            onChange: (e) => handleTeamDetailsChange(categoryName, teamIndex, 'players_' + 'players', parseInt(e.target.value, 10) || 0),
                            min: 0,
                            max: numberOfPlayersLimit,
                            required: true,
                            disabled: loading,
                            tabIndex: 2 + teamIndex * 10
                        })
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { htmlFor: `womenTeamMembers-${teamId}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, `Počet členov realizačného tímu (ženy) (max ${numberOfTeamMembersLimit})`),
                        React.createElement('input', {
                            type: 'number',
                            id: `womenTeamMembers-${teamId}`,
                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                            value: team.womenTeamMembers || 0,
                            onChange: (e) => handleTeamDetailsChange(categoryName, teamIndex, 'players_' + 'womenTeamMembers', parseInt(e.target.value, 10) || 0),
                            min: 0,
                            max: numberOfTeamMembersLimit,
                            required: true,
                            disabled: loading,
                            tabIndex: 3 + teamIndex * 10
                        })
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { htmlFor: `menTeamMembers-${teamId}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, `Počet členov realizačného tímu (muži) (max ${numberOfTeamMembersLimit})`),
                        React.createElement('input', {
                            type: 'number',
                            id: `menTeamMembers-${teamId}`,
                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                            value: team.menTeamMembers || 0,
                            onChange: (e) => handleTeamDetailsChange(categoryName, teamIndex, 'players_' + 'menTeamMembers', parseInt(e.target.value, 10) || 0),
                            min: 0,
                            max: numberOfTeamMembersLimit,
                            required: true,
                            disabled: loading,
                            tabIndex: 4 + teamIndex * 10
                        })
                    )
                ),

                // Formuláre pre hráčov
                team.players > 0 && React.createElement(
                    'div',
                    { className: 'mt-6 border-t pt-4 border-gray-200' },
                    React.createElement('h4', { className: 'text-lg font-bold mb-4 text-gray-700' }, 'Detaily hráčov'),
                    playerDetails.map((player, pIndex) => (
                        React.createElement(
                            'div',
                            { key: `${teamId}-player-${pIndex}`, className: 'bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-100' },
                            React.createElement('h5', { className: 'font-semibold text-gray-800 mb-3' }, `Hráč ${pIndex + 1}`),
                            React.createElement(
                                'div',
                                { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { htmlFor: `playerFirstName-${teamId}-${pIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Meno'),
                                    React.createElement('input', {
                                        type: 'text',
                                        id: `playerFirstName-${teamId}-${pIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: player.firstName || '',
                                        onChange: (e) => {
                                            const newPlayerDetails = [...playerDetails];
                                            newPlayerDetails[pIndex] = { ...newPlayerDetails[pIndex], firstName: e.target.value };
                                            handleTeamDetailsChange(categoryName, teamIndex, 'playerDetails', newPlayerDetails);
                                        },
                                        placeholder: 'Meno hráča',
                                        required: true,
                                        disabled: loading,
                                        tabIndex: 5 + teamIndex * 10 + pIndex * 10
                                    })
                                ),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { htmlFor: `playerLastName-${teamId}-${pIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Priezvisko'),
                                    React.createElement('input', {
                                        type: 'text',
                                        id: `playerLastName-${teamId}-${pIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: player.lastName || '',
                                        onChange: (e) => {
                                            const newPlayerDetails = [...playerDetails];
                                            newPlayerDetails[pIndex] = { ...newPlayerDetails[pIndex], lastName: e.target.value };
                                            handleTeamDetailsChange(categoryName, teamIndex, 'playerDetails', newPlayerDetails);
                                        },
                                        placeholder: 'Priezvisko hráča',
                                        required: true,
                                        disabled: loading,
                                        tabIndex: 6 + teamIndex * 10 + pIndex * 10
                                    })
                                ),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { htmlFor: `playerDateOfBirth-${teamId}-${pIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Dátum narodenia'),
                                    React.createElement('input', {
                                        type: 'date',
                                        id: `playerDateOfBirth-${teamId}-${pIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: player.dateOfBirth || '',
                                        onChange: (e) => {
                                            const newPlayerDetails = [...playerDetails];
                                            newPlayerDetails[pIndex] = { ...newPlayerDetails[pIndex], dateOfBirth: e.target.value };
                                            handleTeamDetailsChange(categoryName, teamIndex, 'playerDetails', newPlayerDetails);
                                        },
                                        required: true,
                                        disabled: loading,
                                        tabIndex: 7 + teamIndex * 10 + pIndex * 10
                                    })
                                ),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { htmlFor: `playerJerseyNumber-${teamId}-${pIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Číslo dresu'),
                                    React.createElement('input', {
                                        type: 'number',
                                        id: `playerJerseyNumber-${teamId}-${pIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: player.jerseyNumber || '',
                                        onChange: (e) => {
                                            const newPlayerDetails = [...playerDetails];
                                            newPlayerDetails[pIndex] = { ...newPlayerDetails[pIndex], jerseyNumber: parseInt(e.target.value, 10) || '' };
                                            handleTeamDetailsChange(categoryName, teamIndex, 'playerDetails', newPlayerDetails);
                                        },
                                        min: 1,
                                        placeholder: 'Číslo dresu',
                                        required: true,
                                        disabled: loading,
                                        tabIndex: 8 + teamIndex * 10 + pIndex * 10
                                    })
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'col-span-1 md:col-span-2 flex items-center mt-2' },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        id: `playerIsRegistered-${teamId}-${pIndex}`,
                                        className: 'form-checkbox h-5 w-5 text-blue-600',
                                        checked: player.isRegistered || false,
                                        onChange: (e) => {
                                            const newPlayerDetails = [...playerDetails];
                                            newPlayerDetails[pIndex] = { ...newPlayerDetails[pIndex], isRegistered: e.target.checked };
                                            handleTeamDetailsChange(categoryName, teamIndex, 'playerDetails', newPlayerDetails);
                                        },
                                        disabled: loading,
                                        tabIndex: 9 + teamIndex * 10 + pIndex * 10
                                    }),
                                    React.createElement('label', { htmlFor: `playerIsRegistered-${teamId}-${pIndex}`, className: 'ml-2 text-gray-700' }, 'Registrovaný/á')
                                ),
                                player.isRegistered && React.createElement(
                                    'div',
                                    { className: 'col-span-1 md:col-span-2' },
                                    React.createElement('label', { htmlFor: `playerRegistrationNumber-${teamId}-${pIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Číslo registrácie'),
                                    React.createElement('input', {
                                        type: 'text',
                                        id: `playerRegistrationNumber-${teamId}-${pIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: player.registrationNumber || '',
                                        onChange: (e) => {
                                            const newPlayerDetails = [...playerDetails];
                                            newPlayerDetails[pIndex] = { ...newPlayerDetails[pIndex], registrationNumber: e.target.value };
                                            handleTeamDetailsChange(categoryName, teamIndex, 'playerDetails', newPlayerDetails);
                                        },
                                        placeholder: 'Registračné číslo',
                                        required: true,
                                        disabled: loading,
                                        tabIndex: 10 + teamIndex * 10 + pIndex * 10
                                    })
                                )
                            )
                        )
                    ))
                ),

                // Formuláre pre ženských členov realizačného tímu
                team.womenTeamMembers > 0 && React.createElement(
                    'div',
                    { className: 'mt-6 border-t pt-4 border-gray-200' },
                    React.createElement('h4', { className: 'text-lg font-bold mb-4 text-gray-700' }, 'Detaily členov realizačného tímu (ženy)'),
                    womenTeamMemberDetails.map((member, mIndex) => (
                        React.createElement(
                            'div',
                            { key: `${teamId}-woman-member-${mIndex}`, className: 'bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-100' },
                            React.createElement('h5', { className: 'font-semibold text-gray-800 mb-3' }, `Členka ${mIndex + 1}`),
                            React.createElement(
                                'div',
                                { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { htmlFor: `womanMemberFirstName-${teamId}-${mIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Meno'),
                                    React.createElement('input', {
                                        type: 'text',
                                        id: `womanMemberFirstName-${teamId}-${mIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: member.firstName || '',
                                        onChange: (e) => {
                                            const newMemberDetails = [...womenTeamMemberDetails];
                                            newMemberDetails[mIndex] = { ...newMemberDetails[mIndex], firstName: e.target.value };
                                            handleTeamDetailsChange(categoryName, teamIndex, 'womenTeamMemberDetails', newMemberDetails);
                                        },
                                        placeholder: 'Meno členky',
                                        required: true,
                                        disabled: loading,
                                        tabIndex: 11 + teamIndex * 10 + mIndex * 10
                                    })
                                ),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { htmlFor: `womanMemberLastName-${teamId}-${mIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Priezvisko'),
                                    React.createElement('input', {
                                        type: 'text',
                                        id: `womanMemberLastName-${teamId}-${mIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: member.lastName || '',
                                        onChange: (e) => {
                                            const newMemberDetails = [...womenTeamMemberDetails];
                                            newMemberDetails[mIndex] = { ...newMemberDetails[mIndex], lastName: e.target.value };
                                            handleTeamDetailsChange(categoryName, teamIndex, 'womenTeamMemberDetails', newMemberDetails);
                                        },
                                        placeholder: 'Priezvisko členky',
                                        required: true,
                                        disabled: loading,
                                        tabIndex: 12 + teamIndex * 10 + mIndex * 10
                                    })
                                ),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { htmlFor: `womanMemberDateOfBirth-${teamId}-${mIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Dátum narodenia'),
                                    React.createElement('input', {
                                        type: 'date',
                                        id: `womanMemberDateOfBirth-${teamId}-${mIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: member.dateOfBirth || '',
                                        onChange: (e) => {
                                            const newMemberDetails = [...womenTeamMemberDetails];
                                            newMemberDetails[mIndex] = { ...newMemberDetails[mIndex], dateOfBirth: e.target.value };
                                            handleTeamDetailsChange(categoryName, teamIndex, 'womenTeamMemberDetails', newMemberDetails);
                                        },
                                        required: true,
                                        disabled: loading,
                                        tabIndex: 13 + teamIndex * 10 + mIndex * 10
                                    })
                                )
                            )
                        )
                    ))
                ),

                // Formuláre pre mužských členov realizačného tímu
                team.menTeamMembers > 0 && React.createElement(
                    'div',
                    { className: 'mt-6 border-t pt-4 border-gray-200' },
                    React.createElement('h4', { className: 'text-lg font-bold mb-4 text-gray-700' }, 'Detaily členov realizačného tímu (muži)'),
                    menTeamMemberDetails.map((member, mIndex) => (
                        React.createElement(
                            'div',
                            { key: `${teamId}-man-member-${mIndex}`, className: 'bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-100' },
                            React.createElement('h5', { className: 'font-semibold text-gray-800 mb-3' }, `Člen ${mIndex + 1}`),
                            React.createElement(
                                'div',
                                { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { htmlFor: `manMemberFirstName-${teamId}-${mIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Meno'),
                                    React.createElement('input', {
                                        type: 'text',
                                        id: `manMemberFirstName-${teamId}-${mIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: member.firstName || '',
                                        onChange: (e) => {
                                            const newMemberDetails = [...menTeamMemberDetails];
                                            newMemberDetails[mIndex] = { ...newMemberDetails[mIndex], firstName: e.target.value };
                                            handleTeamDetailsChange(categoryName, teamIndex, 'menTeamMemberDetails', newMemberDetails);
                                        },
                                        placeholder: 'Meno člena',
                                        required: true,
                                        disabled: loading,
                                        tabIndex: 14 + teamIndex * 10 + mIndex * 10
                                    })
                                ),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { htmlFor: `manMemberLastName-${teamId}-${mIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Priezvisko'),
                                    React.createElement('input', {
                                        type: 'text',
                                        id: `manMemberLastName-${teamId}-${mIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: member.lastName || '',
                                        onChange: (e) => {
                                            const newMemberDetails = [...menTeamMemberDetails];
                                            newMemberDetails[mIndex] = { ...newMemberDetails[mIndex], lastName: e.target.value };
                                            handleTeamDetailsChange(categoryName, teamIndex, 'menTeamMemberDetails', newMemberDetails);
                                        },
                                        placeholder: 'Priezvisko člena',
                                        required: true,
                                        disabled: loading,
                                        tabIndex: 15 + teamIndex * 10 + mIndex * 10
                                    })
                                ),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { htmlFor: `manMemberDateOfBirth-${teamId}-${mIndex}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Dátum narodenia'),
                                    React.createElement('input', {
                                        type: 'date',
                                        id: `manMemberDateOfBirth-${teamId}-${mIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: member.dateOfBirth || '',
                                        onChange: (e) => {
                                            const newMemberDetails = [...menTeamMemberDetails];
                                            newMemberDetails[mIndex] = { ...newMemberDetails[mIndex], dateOfBirth: e.target.value };
                                            handleTeamDetailsChange(categoryName, teamIndex, 'menTeamMemberDetails', newMemberDetails);
                                        },
                                        required: true,
                                        disabled: loading,
                                        tabIndex: 16 + teamIndex * 10 + mIndex * 10
                                    })
                                )
                            )
                        )
                    ))
                ),

                // Sekcia pre veľkosti tričiek
                tshirtSizes.length > 0 && React.createElement(
                    'div',
                    { className: 'mt-6 border-t pt-4 border-gray-200' },
                    React.createElement('h4', { className: 'text-lg font-bold mb-4 text-gray-700' }, 'Veľkosti tričiek'),
                    React.createElement('p', { className: 'text-sm text-gray-600 mb-4' }, 'Celkový počet tričiek sa musí zhodovať s celkovým počtom členov tímu (hráči + realizačný tím).'),
                    React.createElement('div', { className: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' },
                        tshirtSizes.map((size) => {
                            const currentQuantity = tshirts.find(t => t.size === size)?.quantity || 0;
                            return React.createElement(
                                'div',
                                { key: size, className: 'flex flex-col' },
                                React.createElement('label', { htmlFor: `tshirt-${teamId}-${size}`, className: 'block text-gray-700 text-sm font-bold mb-2' }, `Veľkosť ${size}`),
                                React.createElement('input', {
                                    type: 'number',
                                    id: `tshirt-${teamId}-${size}`,
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: currentQuantity,
                                    onChange: (e) => handleTeamDetailsChange(categoryName, teamIndex, `tshirt_${size}`, parseInt(e.target.value, 10) || 0),
                                    min: 0,
                                    disabled: loading,
                                    tabIndex: 17 + teamIndex * 10
                                })
                            );
                        })
                    )
                )
            );
        });
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),

        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
            'Registrácia - strana 4'
        ),

        React.createElement(
            'form',
            { onSubmit: handlePage4Submit, className: 'space-y-6' },
            Object.keys(teamsData).length === 0 ? (
                React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Prejdite prosím na predchádzajúcu stránku a zadajte tímy.')
            ) : (
                Object.keys(teamsData).filter(categoryName => teamsData[categoryName] && teamsData[categoryName].length > 0).map(categoryName => (
                    React.createElement(
                        'div',
                        { key: categoryName, className: 'border-t border-gray-200 pt-4 mt-4' },
                        React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, `Kategória: ${categoryName}`),
                        renderTeamForm(categoryName, teamsData[categoryName])
                    )
                ))
            ),

            React.createElement(
                'div',
                { className: 'flex justify-between mt-6' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: handlePrevClick, // Používame novú funkciu pre Späť
                        className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
                        disabled: loading,
                        tabIndex: 1
                    },
                    'Späť'
                ),
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: nextButtonClasses,
                        disabled: loading || !isRecaptchaReady || !isFormValidPage4,
                        tabIndex: 2
                    },
                    // Zobrazenie načítavacieho spinnera počas prechodu
                    loading ? React.createElement(
                        'div',
                        { className: 'flex items-center justify-center' },
                        React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                            React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                            React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                        ),
                        'Ďalej...'
                    ) : 'Ďalej'
                )
            )
        )
    );
}

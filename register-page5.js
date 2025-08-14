import { getFirestore, doc, onSnapshot, collection, query, getDoc, updateDoc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

function NotificationModal({ message, onClose, type = 'info' }) {
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

// Komponent pre správu príchodu a ubytovania tímu
function TeamAccommodationAndArrival({ 
    team, 
    categoryName, 
    teamIndex, 
    handleChange, 
    loading, 
    accommodationTypes, 
    accommodationCounts, 
    tournamentStartDateDisplay, 
    generateTimeOptions 
}) {
    // Lokálne stavy pre ubytovanie a príchod (aby sa zmeny prejavili lokálne pred handleChange)
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

    // Synchronizácia lokálnych stavov s propmi (pri zmene tímu)
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
        handleChange(categoryName, teamIndex, 'accommodation', { type: newValue });
    };

    const handleArrivalChange = (e) => {
        const newValue = e.target.value;
        setArrivalType(newValue);
        if (newValue !== 'vlaková doprava' && newValue !== 'autobusová doprava' && newValue !== 'vlastná doprava') {
            setArrivalHours('');
            setArrivalMinutes('');
            // Reset drivers data when arrival type changes away from transport types
            handleChange(categoryName, teamIndex, 'arrival', { type: newValue, time: null, drivers: null });
        } else if (newValue === 'vlastná doprava') {
             // For 'vlastná doprava', drivers will be managed globally. Initialize with 0 for validation.
             handleChange(categoryName, teamIndex, 'arrival', { type: newValue, time: null, drivers: [] }); // Zmena na prázdne pole
        } else {
            // Ensure time is updated correctly when arrival type changes to time-based
            const timeString = (arrivalHours && arrivalMinutes) ? `${arrivalHours}:${arrivalMinutes}` : '';
            handleChange(categoryName, teamIndex, 'arrival', { type: newValue, time: timeString, drivers: null });
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
        
        // Always construct the time string. If a part is empty, it means "not selected".
        // The parent handleChange will receive this string.
        let timeString = '';
        if (currentHours && currentMinutes) {
            timeString = `${currentHours}:${currentMinutes}`;
        } else if (currentHours && currentMinutes === '') { // Only hours selected, minutes are empty
            timeString = currentHours; // Just store hours, or whatever is preferred for partial input
        } else if (currentHours === '' && currentMinutes) { // Only minutes selected, hours are empty
            timeString = currentMinutes; // Just store minutes
        }
        // If both are empty, timeString remains ''

        // Pass null to parent if timeString is empty to signify no time selected,
        // otherwise pass the constructed time string.
        handleChange(categoryName, teamIndex, 'arrival', { type: arrivalType, time: timeString || null, drivers: null }); // Drivers are now managed globally
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
                    // Zobrazenie typov ubytovania zoradených abecedne
                    accommodationTypes.sort((a, b) => a.type.localeCompare(b.type)).map((acc) => {
                        // Získanie aktuálneho počtu pre daný typ ubytovania
                        const currentCount = accommodationCounts[acc.type] || 0;
                        // Skontrolujte, či je kapacita plná
                        const isFull = currentCount >= acc.capacity;
                        // Zablokovať, ak je plná kapacita alebo sa načítava
                        const isDisabled = isFull || loading;
                        // Triedy pre label
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
                            value: 'vlaková doprava',
                            checked: arrivalType === 'vlaková doprava',
                            onChange: handleArrivalChange,
                            className: 'form-radio h-5 w-5 text-blue-600',
                            disabled: loading,
                        }),
                        React.createElement('span', { className: 'ml-3 text-gray-800' }, 'vlaková doprava')
                    ),
                    arrivalType === 'vlaková doprava' && React.createElement(
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
                                    value: arrivalHours || '', // Ensure it's controlled by state
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                    disabled: loading,
                                }, generateTimeOptions(24))
                            ),
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: `arrivalMinutes-${categoryName}-${teamIndex}` }, 'Minúta'),
                                React.createElement('select', {
                                    id: `arrivalMinutes-${categoryName}-${teamIndex}`,
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalMinutes || '', // Ensure it's controlled by state
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                    disabled: loading,
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
                            value: 'autobusová doprava',
                            checked: arrivalType === 'autobusová doprava',
                            onChange: handleArrivalChange,
                            className: 'form-radio h-5 w-5 text-blue-600',
                            disabled: loading,
                        }),
                        React.createElement('span', { className: 'ml-3 text-gray-800' }, 'autobusová doprava')
                    ),
                    arrivalType === 'autobusová doprava' && React.createElement(
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
                                    value: arrivalHours || '', // Ensure it's controlled by state
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                    disabled: loading,
                                }, generateTimeOptions(24))
                            ),
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: `arrivalMinutes-${categoryName}-${teamIndex}` }, 'Minúta'),
                                React.createElement('select', {
                                    id: `arrivalMinutes-${categoryName}-${teamIndex}`,
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalMinutes || '', // Ensure it's controlled by state
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                    disabled: loading,
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
                // Pôvodné inputboxy pre počet šoférov sú odstránené z tohto komponentu.
                // Budú spravované v globálnej sekcii v Page5Form.
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

// Komponent pre výber balíčka tímu
function TeamPackageSettings({ 
    team, 
    categoryName, 
    teamIndex, 
    handleChange, 
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
        const selectedPkg = packages.find(pkg => pkg.id === newPackageId);
        handleChange(categoryName, teamIndex, 'packageId', newPackageId);
        handleChange(categoryName, teamIndex, 'packageDetails', selectedPkg ? {
            name: selectedPkg.name,
            price: selectedPkg.price,
            meals: selectedPkg.meals
        } : null);
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(
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
                                        
                                        if (isNaN(new Date(date).getTime())) {
                                            return null;
                                        }

                                        if (mealsForDay && mealsForDay.breakfast === 1) includedItems.push('raňajky');
                                        if (mealsForDay && mealsForDay.lunch === 1) includedItems.push('obed');
                                        if (mealsForDay && mealsForDay.dinner === 1) includedItems.push('večera');
                                        if (mealsForDay && mealsForDay.refreshment === 1) includedItems.push('občerstvenie');

                                        if (includedItems.length > 0) {
                                            const dateObj = new Date(date + 'T00:00:00');
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
        )
    );
}


export function Page5Form({ formData, handlePrev, handleSubmit, loading, setLoading, setRegistrationSuccess, handleChange, teamsDataFromPage4, isRecaptchaReady, tournamentStartDate, tournamentEndDate }) {
    const db = getFirestore();

    const [notificationMessage, setNotificationMessage] = React.useState('');
    const [notificationType, setNotificationType] = React.useState('info');

    const closeNotification = () => {
        setNotificationMessage('');
        setNotificationType('info');
    };

    const [accommodationTypes, setAccommodationTypes] = React.useState([]);
    const [accommodationCounts, setAccommodationCounts] = React.useState({});
    const [packages, setPackages] = React.useState([]);
    const [tournamentStartDateDisplay, setTournamentStartDateDisplay] = React.useState('');

    // Nový stav pre záznamy o šoféroch
    // Štruktúra: [{ id: 'uniqueId', count: number, gender: 'male'|'female', categoryName: string, teamIndex: number }]
    const [driverEntries, setDriverEntries] = React.useState([]);

    // Helper na generovanie unikátnych ID pre záznamy o šoféroch
    const generateUniqueId = () => `driver-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    }, [db]);

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


    // Nová handleChange funkcia pre aktualizáciu vnorených dát tímu
    const handleTeamDataChange = (categoryName, teamIndex, field, value) => {
        // Toto volá pôvodnú handleChange z App.js, ktorá vie pracovať s teamsDataFromPage4
        handleChange({
            target: {
                id: 'teamsDataFromPage4', // Špeciálny ID, ktorý App.js rozpozná
                value: {
                    categoryName: categoryName,
                    teamIndex: teamIndex,
                    field: field,
                    data: value
                }
            }
        });
    };


    // Zoznam tímov, ktoré si zvolili "vlastná doprava"
    const teamsWithOwnTransport = React.useMemo(() => {
        const teams = [];
        for (const categoryName in teamsDataFromPage4) {
            (teamsDataFromPage4[categoryName] || []).filter(t => t).forEach((team, teamIndex) => {
                if (team.arrival?.type === 'vlastná doprava') {
                    teams.push({
                        categoryName: categoryName,
                        teamIndex: teamIndex,
                        teamName: team.teamName,
                        id: `${categoryName}-${teamIndex}` // Unikátne ID pre tím v selectoch
                    });
                }
            });
        }
        return teams;
    }, [teamsDataFromPage4]);

    // Možnosti pre pohlavie šoféra (vždy "Muži" a "Ženy")
    const getAvailableGenderOptions = () => [
        { value: '', label: '-- Vyberte pohlavie --' },
        { value: 'male', label: 'Muži' },
        { value: 'female', label: 'Ženy' }
    ];

    // Možnosti pre výber tímu (filtrované na základe už vybratých kombinácií tím-pohlavie)
    const getAvailableTeamOptions = (currentEntry = null) => {
        const usedTeamGenderCombinations = new Set();
        driverEntries.forEach(entry => {
            // Ak to nie je aktuálny záznam, ktorý sa upravuje, a je platný, pridaj jeho kombináciu do množiny
            if (entry.id !== (currentEntry ? currentEntry.id : null) && entry.categoryName && entry.teamIndex !== null && entry.gender !== '') {
                usedTeamGenderCombinations.add(`${entry.categoryName}-${entry.teamIndex}-${entry.gender}`);
            }
        });

        const options = [];
        teamsWithOwnTransport.forEach(team => {
            const maleCombo = `${team.id}-male`;
            const femaleCombo = `${team.id}-female`;
            
            // Overíme, či kombinácia tím-pohlavie je už použitá v iných záznamoch
            const isMaleTaken = usedTeamGenderCombinations.has(maleCombo);
            const isFemaleTaken = usedTeamGenderCombinations.has(femaleCombo);
            
            // Pridáme možnosť tímu iba ak nie je úplne "vyčerpaný" pre obe pohlavia, alebo ak aktuálny záznam upravuje tento tím
            const currentEntryTeamId = currentEntry ? `${currentEntry.categoryName}-${currentEntry.teamIndex}` : null;

            if (currentEntryTeamId === team.id) { // Ak aktuálny záznam upravuje tento tím
                options.push(team);
            } else if (!isMaleTaken || !isFemaleTaken) { // Ak tím nie je obsadený pre obe pohlavia inými záznamami
                 options.push(team);
            }
        });

        // Zoraďte možnosti (okrem placeholderu, ktorý sa pridáva manuálne)
        const sortedOptions = options.sort((a, b) => a.teamName.localeCompare(b.teamName));
        return sortedOptions;
    };

    // Funkcia na pridanie nového záznamu o šoférovi
    const handleAddDriverEntry = () => {
        setDriverEntries(prev => [...prev, {
            id: generateUniqueId(),
            count: '',
            gender: '',
            categoryName: '',
            teamIndex: null
        }]);
    };

    // Funkcia na odstránenie záznamu o šoférovi
    const handleRemoveDriverEntry = (idToRemove) => {
        setDriverEntries(prev => prev.filter(entry => entry.id !== idToRemove));
    };

    // Funkcia na zmenu hodnoty v zázname o šoférovi
    const handleDriverEntryChange = (id, field, value) => {
        setDriverEntries(prev => prev.map(entry => {
            if (entry.id === id) {
                if (field === 'teamId') { // Ak sa mení selectbox tímu
                    const [catName, teamIdxStr] = value.split('-');
                    const teamIdx = teamIdxStr ? parseInt(teamIdxStr, 10) : null;
                    return {
                        ...entry,
                        categoryName: catName || '',
                        teamIndex: teamIdx
                    };
                } else {
                    return {
                        ...entry,
                        [field]: value
                    };
                }
            }
            return entry;
        }));
    };

    // Kontrola, či je tlačidlo na pridanie šoféra viditeľné
    const isAddDriverButtonVisible = React.useMemo(() => {
        if (loading) return false;
        
        // Ak už existuje aspoň jeden záznam, ktorý je neúplný (tzn. jedno z jeho polí je prázdne/neplatné)
        const hasIncompleteEntry = driverEntries.some(entry => 
            entry.count === '' || 
            parseInt(entry.count, 10) <= 0 || 
            entry.gender === '' || 
            entry.categoryName === '' || 
            entry.teamIndex === null
        );
        if (hasIncompleteEntry) {
            return false;
        }

        const availableCombinations = new Set();
        const usedCombinations = new Set();

        driverEntries.forEach(entry => {
            if (entry.categoryName && entry.teamIndex !== null && entry.gender) {
                usedCombinations.add(`${entry.categoryName}-${entry.teamIndex}-${entry.gender}`);
            }
        });

        teamsWithOwnTransport.forEach(team => {
            const maleCombo = `${team.id}-male`;
            const femaleCombo = `${team.id}-female`;
            if (!usedCombinations.has(maleCombo)) availableCombinations.add(maleCombo);
            if (!usedCombinations.has(femaleCombo)) availableCombinations.add(femaleCombo);
        });

        return availableCombinations.size > 0;
    }, [driverEntries, teamsWithOwnTransport, loading]);


    const isFormValidPage5 = React.useMemo(() => {
        // Ak nie sú žiadne tímy, formulár nie je platný
        if (!teamsDataFromPage4 || Object.keys(teamsDataFromPage4).length === 0) {
            return false;
        }

        // Iterujeme cez všetky tímy a kontrolujeme validáciu ubytovania a balíčkov
        for (const categoryName in teamsDataFromPage4) {
            for (const team of (teamsDataFromPage4[categoryName] || []).filter(t => t)) {
                // Validácia ubytovania pre každý tím
                if (accommodationTypes.length > 0 && (!team.accommodation?.type || team.accommodation.type.trim() === '')) {
                    const selectedAccType = accommodationTypes.find(acc => acc.type === team.accommodation?.type);
                    if (team.accommodation?.type !== 'bez ubytovania' && selectedAccType) {
                        const currentCount = accommodationCounts[selectedAccType.type] || 0;
                        if (currentCount >= selectedAccType.capacity) {
                            return false; // Vybrané ubytovanie je plné
                        }
                    } else if (accommodationTypes.length > 0 && !team.accommodation?.type) {
                        return false; // Ak sú typy ubytovania, ale nič nie je vybrané
                    }
                }

                // Validácia balíčka pre každý tím
                if (packages.length > 0 && (!team.packageId || team.packageId.trim() === '')) {
                    return false;
                }

                // Validácia príchodu pre vlakovú/autobusovú dopravu
                if ((team.arrival?.type === 'vlaková doprava' || team.arrival?.type === 'autobusová doprava') && (!team.arrival?.time || team.arrival.time.trim() === '')) {
                    return false;
                }
            }
        }

        // Nová validácia pre driverEntries (pre "vlastná doprava")
        const aggregatedDrivers = {}; // { 'category-teamIndex': { male: 0, female: 0 } }
        const usedCombinations = new Set(); // Na kontrolu duplicitných kombinácií tím-pohlavie

        for (const entry of driverEntries) {
            const count = parseInt(entry.count, 10);
            if (isNaN(count) || count <= 0 || entry.gender === '' || entry.categoryName === '' || entry.teamIndex === null) {
                return false; // Neúplný alebo neplatný záznam o šoférovi
            }

            const teamId = `${entry.categoryName}-${entry.teamIndex}`;
            const comboKey = `${teamId}-${entry.gender}`;

            if (usedCombinations.has(comboKey)) {
                return false; // Nájdeme duplicitnú kombináciu tím-pohlavie
            }
            usedCombinations.add(comboKey);

            if (!aggregatedDrivers[teamId]) {
                aggregatedDrivers[teamId] = { male: 0, female: 0 };
            }
            if (entry.gender === 'male') {
                aggregatedDrivers[teamId].male += count;
            } else {
                aggregatedDrivers[teamId].female += count;
            }
        }

        // Skontrolujte, či každý tím s "vlastná doprava" má priradeného aspoň jedného šoféra
        // Agregácia z driverEntries je teraz komplexnejšia, musíme to prejsť ručne
        const teamsRequiringDrivers = teamsWithOwnTransport.map(team => team.id);
        const teamsWithAssignedDrivers = new Set();
        
        driverEntries.forEach(entry => {
            if (entry.categoryName && entry.teamIndex !== null) {
                teamsWithAssignedDrivers.add(`${entry.categoryName}-${entry.teamIndex}`);
            }
        });

        // Pre každý tím, ktorý si zvolil vlastnú dopravu, musíme overiť, či má aspoň jedného šoféra
        for (const teamId of teamsRequiringDrivers) {
            if (!teamsWithAssignedDrivers.has(teamId)) {
                return false; // Tím s vlastnou dopravou nemá priradených žiadnych šoférov
            }
            // A tiež overiť, či celkový počet šoférov pre tento tím je > 0
            const assigned = aggregatedDrivers[teamId];
            if (!assigned || (assigned.male === 0 && assigned.female === 0)) {
                return false; // Tím s vlastnou dopravou má priradený záznam, ale celkový počet šoférov je 0
            }
        }

        return true;
    }, [teamsDataFromPage4, accommodationTypes, accommodationCounts, packages, driverEntries, teamsWithOwnTransport]);


    const nextButtonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
    ${!isFormValidPage5 || loading || !isRecaptchaReady
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
      : 'bg-blue-500 hover:bg-blue-700 text-white'
    }
  `;

    const handlePage5Submit = async (e) => {
        e.preventDefault();

        if (setLoading) setLoading(true); 
        closeNotification(); 

        if (!isFormValidPage5) {
            setNotificationMessage("Prosím, vyplňte všetky povinné polia pre každý tím (ubytovanie, balíček, príchod). Pre tímy s 'vlastnou dopravou' musíte pridať aspoň jedného šoféra a uistiť sa, že všetky polia sú vyplnené a bez duplicitných záznamov pre pohlavie a tím.", 'error');
            setNotificationType('error');
            setLoading(false); 
            return;
        }

        try {
            // Hlboká kópia teamsDataFromPage4 na úpravu pred odoslaním
            const teamsDataForSubmission = JSON.parse(JSON.stringify(teamsDataFromPage4));

            // Reset počtov šoférov pre všetky tímy v teamsDataForSubmission, ktoré používajú 'vlastná doprava'
            // Aplikujeme agregované počty z driverEntries do teamsDataForSubmission
            for (const categoryName in teamsDataForSubmission) {
                teamsDataForSubmission[categoryName] = teamsDataForSubmission[categoryName].map((team, teamIdx) => {
                    const teamId = `${categoryName}-${teamIdx}`;
                    if (team.arrival?.type === 'vlastná doprava') {
                        // Vypočítame agregované počty šoférov pre tento konkrétny tím
                        let maleDriversCount = 0;
                        let femaleDriversCount = 0;
                        driverEntries.filter(entry => 
                            entry.categoryName === categoryName && 
                            entry.teamIndex === teamIdx
                        ).forEach(entry => {
                            const count = parseInt(entry.count, 10);
                            if (!isNaN(count) && count > 0) {
                                if (entry.gender === 'male') {
                                    maleDriversCount += count;
                                } else if (entry.gender === 'female') {
                                    femaleDriversCount += count;
                                }
                            }
                        });

                        return {
                            ...team,
                            arrival: {
                                ...team.arrival,
                                drivers: { male: maleDriversCount, female: femaleDriversCount }
                            }
                        };
                    }
                    // Ak nie je vlastná doprava, drivers by mal byť null
                    return {
                        ...team,
                        arrival: {
                            ...team.arrival,
                            drivers: null
                        }
                    };
                });
            }
            
            // Nakoniec, po agregácii všetkých dát o šoféroch do teamsDataForSubmission, odovzdáme túto aktualizovanú štruktúru ďalej
            await handleSubmit(teamsDataForSubmission); // handleSubmit from App.js now takes one argument (teamsDataForSubmission)

        } catch (error) {
            console.error("Chyba pri spracovaní dát Page5:", error);
            setNotificationMessage(`Chyba pri spracovaní údajov: ${error.message}`, 'error');
            setNotificationType('error');
        } finally {
            if (setLoading) setLoading(false);
        }
    };

    const generateTimeOptions = (limit) => {
        const options = [React.createElement('option', { key: "placeholder", value: "" }, "--")];
        for (let i = 0; i < limit; i++) {
            const value = i.toString().padStart(2, '0');
            options.push(React.createElement('option', { key: value, value: value }, value));
        }
        return options;
    };


    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),

        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
            'Registrácia - Ubytovanie a Príchod Tímov'
        ),

        React.createElement(
            'form',
            { onSubmit: handlePage5Submit, className: 'space-y-4' },
            Object.keys(teamsDataFromPage4).length === 0 ? (
                React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Prejdite prosím na predchádzajúcu stránku a zadajte tímy.')
            ) : (
                Object.keys(teamsDataFromPage4).map(categoryName => (
                    React.createElement(
                        'div',
                        { key: categoryName, className: 'border-t border-gray-200 pt-4 mt-4' },
                        React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, `Kategória: ${categoryName}`),
                        (teamsDataFromPage4[categoryName] || []).filter(t => t).map((team, teamIndex) => (
                            React.createElement(
                                'div',
                                { key: `${categoryName}-${teamIndex}`, className: 'bg-blue-50 p-4 rounded-lg mb-4 space-y-2' },
                                React.createElement('p', { className: 'font-semibold text-blue-800 mb-4' }, `Tím: ${team.teamName}`),

                                // Komponent pre ubytovanie a príchod tímu
                                React.createElement(TeamAccommodationAndArrival, {
                                    team: team,
                                    categoryName: categoryName,
                                    teamIndex: teamIndex,
                                    handleChange: handleTeamDataChange,
                                    loading: loading,
                                    accommodationTypes: accommodationTypes,
                                    accommodationCounts: accommodationCounts,
                                    tournamentStartDateDisplay: tournamentStartDateDisplay,
                                    generateTimeOptions: generateTimeOptions,
                                }),

                                // Komponent pre výber balíčka tímu
                                React.createElement(TeamPackageSettings, {
                                    team: team,
                                    categoryName: categoryName,
                                    teamIndex: teamIndex,
                                    handleChange: handleTeamDataChange,
                                    loading: loading,
                                    packages: packages,
                                    tournamentDays: tournamentDays,
                                })
                            )
                        ))
                    )
                ))
            ),

            // Sekcia pre správu šoférov (Vlastná doprava)
            teamsWithOwnTransport.length > 0 && ( // Zobrazí sa len ak sú nejaké tímy s vlastnou dopravou
                React.createElement(
                    'div',
                    { className: 'border-t border-gray-200 pt-4 mt-4' },
                    React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, 'Šoféri pre vlastnú dopravu'),
                    React.createElement('p', { className: 'text-sm text-gray-600 mb-4' }, 'Tu môžete pridať informácie o šoféroch pre tímy, ktoré zvolili "vlastnú dopravu".'),

                    driverEntries.map((entry) => (
                        React.createElement(
                            'div',
                            { key: entry.id, className: 'flex items-center space-x-2 mb-2 w-full' },
                            // Input pre počet šoférov
                            React.createElement('div', { className: 'w-24' }, 
                                React.createElement('input', {
                                    type: 'number',
                                    className: 'shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-full', 
                                    value: entry.count,
                                    onChange: (e) => handleDriverEntryChange(entry.id, 'count', e.target.value),
                                    placeholder: 'Počet',
                                    min: 1,
                                    required: true,
                                    disabled: loading,
                                })
                            ),
                            // Selectbox pre pohlavie
                            React.createElement('div', { className: 'flex-1 min-w-[120px]' }, 
                                React.createElement('select', {
                                    className: 'shadow border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-full',
                                    value: entry.gender,
                                    onChange: (e) => handleDriverEntryChange(entry.id, 'gender', e.target.value),
                                    required: true,
                                    disabled: loading,
                                }, getAvailableGenderOptions().map(opt => (
                                    React.createElement('option', { key: opt.value, value: opt.value }, opt.label)
                                ))
                                )
                            ),
                            // Selectbox pre tím
                            React.createElement('div', { className: 'flex-1 min-w-[200px]' },
                                React.createElement('select', {
                                    className: 'shadow border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-full', 
                                    value: entry.categoryName && entry.teamIndex !== null ? `${entry.categoryName}-${entry.teamIndex}` : '',
                                    onChange: (e) => handleDriverEntryChange(entry.id, 'teamId', e.target.value), 
                                    required: true,
                                    disabled: loading,
                                }, 
                                React.createElement('option', { key: "team-placeholder", value: '' }, '-- Vyberte tím --'), 
                                getAvailableTeamOptions(entry).map(team => (
                                    React.createElement('option', { key: team.id, value: team.id }, `${team.teamName} (${team.categoryName})`)
                                ))
                                )
                            ),
                            // Tlačidlo na odstránenie riadku
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleRemoveDriverEntry(entry.id),
                                    className: `bg-red-500 hover:bg-red-700 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 focus:outline-none focus:shadow-outline ${driverEntries.length === 0 ? 'invisible' : ''}`, // Skryť, ak žiadne záznamy
                                    disabled: loading,
                                },
                                '-'
                            )
                        )
                    )),
                    // Tlačidlo "+"
                    isAddDriverButtonVisible &&
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: handleAddDriverEntry,
                            className: `
                                bg-green-500 hover:bg-green-700 text-white font-bold w-10 h-10 rounded-full flex items-center justify-center mx-auto mt-4 
                                transition-colors duration-200 focus:outline-none focus:shadow-outline
                                ${loading ? 'opacity-70 cursor-not-allowed' : ''}
                            `.trim(),
                            disabled: loading || driverEntries.some(entry => entry.count === '' || parseInt(entry.count, 10) <= 0 || entry.gender === '' || entry.categoryName === '' || entry.teamIndex === null) || !isAddDriverButtonVisible,
                        },
                        '+'
                    )
                )
            ),

            React.createElement(
                'div',
                { className: 'flex justify-between mt-6' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: handlePrev,
                        className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
                        disabled: loading,
                    },
                    'Späť'
                ),
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: nextButtonClasses,
                        disabled: loading || !isRecaptchaReady || !isFormValidPage5,
                        tabIndex: 2
                    },
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

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

export function Page5Form({ formData, handlePrev, handleSubmit, loading, setLoading, setRegistrationSuccess, handleChange, teamsDataFromPage4, isRecaptchaReady, tournamentStartDate, tournamentEndDate }) {
    const db = getFirestore();

    const [notificationMessage, setNotificationMessage] = React.useState('');
    const [notificationType, setNotificationType] = React.useState('info');

    const closeNotification = () => {
        setNotificationMessage('');
        setNotificationType('info');
    };

    const [accommodationTypes, setAccommodationTypes] = React.useState([]);
    const [selectedAccommodation, setSelectedAccommodation] = React.useState(formData.accommodation?.type || '');
    const [accommodationCounts, setAccommodationCounts] = React.useState({});

    const [packages, setPackages] = React.useState([]);
    const [selectedPackageId, setSelectedPackageId] = React.useState(formData.packageId || '');

    const [arrivalType, setArrivalType] = React.useState(formData.arrival?.type || '');

    const [arrivalHours, setArrivalHours] = React.useState(() => {
        const initialTime = typeof formData.arrival?.time === 'string' ? formData.arrival.time : '';
        return initialTime ? initialTime.split(':')[0] : '';
    });
    const [arrivalMinutes, setArrivalMinutes] = React.useState(() => {
        const initialTime = typeof formData.arrival?.time === 'string' ? formData.arrival.time : '';
        return initialTime ? initialTime.split(':')[1] : '';
    });

    const [tournamentStartDateDisplay, setTournamentStartDateDisplay] = React.useState('');

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


    const handleAccommodationChange = (e) => {
        const newValue = e.target.value;
        setSelectedAccommodation(newValue);
        handleChange({ target: { id: 'accommodation', value: { type: newValue } } });
    };

    const handlePackageChange = (e) => {
        const newPackageId = e.target.value;
        setSelectedPackageId(newPackageId);
        const selectedPkg = packages.find(pkg => pkg.id === newPackageId);
        handleChange({ target: { id: 'package', value: selectedPkg || null } });
        handleChange({ target: { id: 'packageId', value: newPackageId } });
    };

    const handleArrivalChange = (e) => {
        const newValue = e.target.value;
        setArrivalType(newValue);
        if (newValue !== 'vlaková doprava' && newValue !== 'autobusová doprava') {
            setArrivalHours('');
            setArrivalMinutes('');
            handleChange({ target: { id: 'arrival', value: { type: newValue, time: null } } });
        } else {
            const timeString = (arrivalHours && arrivalMinutes) ? `${arrivalHours}:${arrivalMinutes}` : '';
            handleChange({ target: { id: 'arrival', value: { type: newValue, time: timeString } } });
        }
    };

    const handleTimeSelectChange = (e) => {
        const { id, value } = e.target;
        let newHours = arrivalHours;
        let newMinutes = arrivalMinutes;

        if (id === 'arrivalHours') {
            newHours = value;
            setArrivalHours(value);
        } else if (id === 'arrivalMinutes') {
            newMinutes = value;
            setArrivalMinutes(value);
        }
        
        const timeString = (newHours && newMinutes) ? `${newHours}:${newMinutes}` : '';
        handleChange({ target: { id: 'arrival', value: { type: arrivalType, time: timeString } } });
    };


    const isFormValidPage5 = React.useMemo(() => {
        if (accommodationTypes.length > 0 && !selectedAccommodation) {
            return false;
        }

        if (packages.length > 0 && !selectedPackageId) {
            return false;
        }

        if ((arrivalType === 'vlaková doprava' || arrivalType === 'autobusová doprava') && (!formData.arrival?.time || formData.arrival.time === '')) {
            return false;
        }

        return true;
    }, [selectedAccommodation, accommodationTypes, arrivalType, formData.arrival?.time, packages, selectedPackageId]);


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
            setNotificationMessage("Prosím, vyplňte všetky povinné polia.", 'error');
            setNotificationType('error');
            setLoading(false); 
            return;
        }

        try {
            const finalArrivalTime = (arrivalType === 'vlaková doprava' || arrivalType === 'autobusová doprava')
                                     ? (arrivalHours && arrivalMinutes ? `${arrivalHours}:${arrivalMinutes}` : null)
                                     : null;
            
            const selectedPkgDetails = packages.find(pkg => pkg.id === selectedPackageId);

            const updatedFormDataForNextPage = {
                ...formData,
                accommodation: {
                    type: selectedAccommodation
                },
                arrival: {
                    type: arrivalType,
                    time: finalArrivalTime
                },
                packageId: selectedPackageId,
                packageDetails: selectedPkgDetails ? {
                    name: selectedPkgDetails.name,
                    price: selectedPkgDetails.price,
                    meals: selectedPkgDetails.meals
                } : null
            };
            
            await handleSubmit(updatedFormDataForNextPage); 

        } catch (error) {
            console.error("Chyba pri spracovaní dát Page5:", error);
            setNotificationMessage(`Chyba pri spracovaní údajov: ${error.message}`, 'error');
            setNotificationType('error');
        } finally {
            if (setLoading) setLoading(false);
        }
    };

    const generateTimeOptions = (limit) => {
        const options = [React.createElement('option', { key: "", value: "" }, "--")];
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
            'Registrácia - Ubytovanie a Príchod'
        ),

        React.createElement(
            'form',
            { onSubmit: handlePage5Submit, className: 'space-y-4' },
            React.createElement(
                'div',
                { className: 'border-t border-gray-200 pt-4 mt-4' },
                React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, 'Výber typu ubytovania'),
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
                                name: 'accommodationType',
                                value: 'Bez ubytovania',
                                checked: selectedAccommodation === 'Bez ubytovania',
                                onChange: handleAccommodationChange,
                                className: 'form-radio h-5 w-5 text-blue-600',
                                disabled: loading,
                            }),
                            React.createElement('span', { className: 'ml-3 text-gray-800' }, `Bez ubytovania`) 
                        ),
                        accommodationTypes.map((acc) => {
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
                                    name: 'accommodationType',
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
                React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, 'Výber spôsobu príchodu na turnaj'),
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
                                name: 'arrivalType',
                                value: 'vlaková doprava',
                                checked: arrivalType === 'vlaková doprava',
                                onChange: handleArrivalChange,
                                className: 'form-radio h-5 w-5 text-blue-600',
                                disabled: loading,
                            }),
                            React.createElement('span', { className: 'ml-3 text-gray-800' }, 'Vlaková doprava')
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
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'arrivalHours' }, 'Hodina'),
                                    React.createElement('select', {
                                        id: 'arrivalHours',
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: arrivalHours || '',
                                        onChange: handleTimeSelectChange,
                                        required: true,
                                        disabled: loading,
                                    }, generateTimeOptions(24))
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'flex-1' },
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'arrivalMinutes' }, 'Minúta'),
                                    React.createElement('select', {
                                        id: 'arrivalMinutes',
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: arrivalMinutes || '',
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
                                name: 'arrivalType',
                                value: 'autobusová doprava',
                                checked: arrivalType === 'autobusová doprava',
                                onChange: handleArrivalChange,
                                className: 'form-radio h-5 w-5 text-blue-600',
                                disabled: loading,
                            }),
                            React.createElement('span', { className: 'ml-3 text-gray-800' }, 'Autobusová doprava')
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
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'arrivalHours' }, 'Hodina'),
                                    React.createElement('select', {
                                        id: 'arrivalHours',
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: arrivalHours || '',
                                        onChange: handleTimeSelectChange,
                                        required: true,
                                        disabled: loading,
                                    }, generateTimeOptions(24))
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'flex-1' },
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'arrivalMinutes' }, 'Minúta'),
                                    React.createElement('select', {
                                        id: 'arrivalMinutes',
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: arrivalMinutes || '',
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
                            name: 'arrivalType',
                            value: 'vlastná doprava',
                            checked: arrivalType === 'vlastná doprava',
                            onChange: handleArrivalChange,
                            className: 'form-radio h-5 w-5 text-blue-600',
                            disabled: loading,
                        }),
                        React.createElement('span', { className: 'ml-3 text-gray-800' }, 'Vlastná doprava')
                    ),
                    React.createElement(
                        'label',
                        { className: `flex items-center p-3 rounded-lg cursor-pointer ${loading ? 'bg-gray-100' : 'hover:bg-blue-50'} transition-colors duration-200` },
                        React.createElement('input', {
                            type: 'radio',
                            name: 'arrivalType',
                            value: 'bez dopravy',
                            checked: arrivalType === 'bez dopravy',
                            onChange: handleArrivalChange,
                            className: 'form-radio h-5 w-5 text-blue-600',
                            disabled: loading,
                        }),
                        React.createElement('span', { className: 'ml-3 text-gray-800' }, 'Bez dopravy')
                    )
                )
            ),

            React.createElement(
                'div',
                { className: 'border-t border-gray-200 pt-4 mt-4' },
                React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, 'Výber balíčka (stravovanie a občerstvenie)'),
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
                                            name: 'selectedPackage',
                                            value: pkg.id,
                                            checked: selectedPackageId === pkg.id,
                                            onChange: handlePackageChange,
                                            className: 'form-radio h-5 w-5 text-blue-600',
                                            disabled: loading,
                                        }),
                                        React.createElement('span', { className: 'ml-3 font-semibold text-gray-800' }, pkg.name)
                                    ),
                                    React.createElement('span', { className: 'font-bold text-gray-900' }, `${pkg.price}€`)
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'ml-8 text-sm text-gray-600 mt-2' },
                                    (pkg.meals && Object.keys(pkg.meals).length > 0 && tournamentDays.length > 0) ? (
                                        tournamentDays.map(date => {
                                            const mealsForDay = pkg.meals[date];
                                            const includedItems = [];
                                            // Check only for valid date keys, exclude 'participantCard'
                                            if (date === 'participantCard') return null; 

                                            if (mealsForDay && mealsForDay.breakfast === 1) includedItems.push('Raňajky');
                                            if (mealsForDay && mealsForDay.lunch === 1) includedItems.push('Obed');
                                            if (mealsForDay && mealsForDay.dinner === 1) includedItems.push('Večera');
                                            if (mealsForDay && mealsForDay.refreshment === 1) includedItems.push('Občerstvenie');

                                            if (includedItems.length > 0) {
                                                const displayDate = new Date(date).toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric' });
                                                return React.createElement('p', { key: date }, `${displayDate}: ${includedItems.join(', ')}`);
                                            }
                                            return null;
                                        }).filter(item => item !== null)
                                    ) : (
                                        React.createElement('p', null, 'Žiadne stravovanie definované pre tento balíček.')
                                    ),
                                    (pkg.meals && pkg.meals.participantCard === 1) &&
                                        React.createElement('p', { className: 'font-bold text-gray-700 mt-1' }, 'Zahŕňa účastnícku kartu')
                                )
                            )
                        ))
                    ) : (
                        React.createElement('p', { className: 'text-gray-500 text-center py-4' }, 'Nie sú dostupné žiadne balíčky.')
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

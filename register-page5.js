import { getFirestore, doc, onSnapshot, collection, query, getDoc, updateDoc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// NotificationModal Component pre zobrazovanie dočasných správ (presunutý sem)
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
                setTimeout(onClose, 500); // Nechaj chvíľu na animáciu, potom zavolaj onClose
            }, 10000); // Zobrazí sa na 10 sekúnd
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
        bgColorClass = 'bg-red-600'; // Nastavenie červenej pre chyby
    } else {
        bgColorClass = 'bg-blue-500'; // Predvolená modrá pre info
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

export function Page5Form({ formData, handlePrev, handleSubmit, loading, setLoading, setRegistrationSuccess, handleChange, teamsDataFromPage4 }) {
    const db = getFirestore();

    const [accommodations, setAccommodations] = React.useState([]);
    const [selectedAccommodationType, setSelectedAccommodationType] = React.useState(formData.accommodation?.type || '');
    const [accommodationCounts, setAccommodationCounts] = React.useState({});
    const [isAccommodationDataLoaded, setIsAccommodationDataLoaded] = React.useState(false);

    const [selectedArrivalType, setSelectedArrivalType] = React.useState(formData.arrival?.type || '');
    const initialHours = formData.arrival?.time ? formData.arrival.time.split(':')[0] : '';
    const initialMinutes = formData.arrival?.time ? formData.arrival.time.split(':')[1] : '';
    const [arrivalHours, setArrivalHours] = React.useState(initialHours);
    const [arrivalMinutes, setArrivalMinutes] = React.useState(initialMinutes);

    // NOVINKA: Stav pre dátum začiatku turnaja
    const [tournamentStartDateDisplay, setTournamentStartDateDisplay] = React.useState('');

    // Stavy pre lokálne notifikácie v tomto komponente
    const [notificationMessage, setNotificationMessage] = React.useState('');
    const [showNotification, setShowNotification] = React.useState(false);
    const [notificationType, setNotificationType] = React.useState('info');

    // Lokálna funkcia pre zatvorenie notifikácie
    const closeLocalNotification = React.useCallback(() => {
        setShowNotification(false);
        setNotificationMessage('');
        setNotificationType('info');
    }, []);

    // Lokálna funkcia pre odoslanie notifikácie
    const dispatchLocalNotification = React.useCallback((message, type = 'info') => {
        setNotificationMessage(message);
        setShowNotification(true);
        setNotificationType(type);
    }, []);


    // Načítanie dostupných typov ubytovania a ich kapacít
    React.useEffect(() => {
        let unsubscribeAccommodation;
        let unsubscribeRegistrationSettings;

        const fetchSettings = () => {
            if (!window.db) {
                setTimeout(fetchSettings, 100);
                return;
            }
            try {
                // Listener pre nastavenia ubytovania
                const accommodationDocRef = doc(window.db, 'settings', 'accommodation');
                unsubscribeAccommodation = onSnapshot(accommodationDocRef, (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        setAccommodations(data.types || []);
                    } else {
                        setAccommodations([]);
                    }
                    setIsAccommodationDataLoaded(true);
                }, (error) => {
                    console.error("Chyba pri načítaní nastavení ubytovania:", error);
                    dispatchLocalNotification("Chyba pri načítaní nastavení ubytovania.", 'error');
                    setIsAccommodationDataLoaded(true);
                });

                // Listener pre registračné nastavenia (pre dátum začiatku turnaja)
                const registrationDocRef = doc(window.db, 'settings', 'registration');
                unsubscribeRegistrationSettings = onSnapshot(registrationDocRef, (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        // ZMENA: Použitie importovaného Timestamp namiesto globálneho firebase.firestore.Timestamp
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
                console.error("Chyba pri nastavovaní poslucháča pre ubytovanie/registrácie:", e);
                dispatchLocalNotification("Chyba pri načítaní údajov.", 'error');
            }
        };

        fetchSettings();

        return () => {
            if (unsubscribeAccommodation) {
                unsubscribeAccommodation();
            }
            if (unsubscribeRegistrationSettings) {
                unsubscribeRegistrationSettings();
            }
        };
    }, [db, dispatchLocalNotification]);

    // Načítanie agregovaných počtov obsadenosti ubytovania z /settings/accommodationCounts
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
                        setAccommodationCounts({}); // Ak dokument neexistuje, predvolene prázdny objekt
                    }
                }, (error) => {
                    console.error("Chyba pri načítaní počtov obsadenosti ubytovania:", error);
                    dispatchLocalNotification("Chyba pri načítaní údajov o obsadenosti ubytovania.", 'error');
                });
            } catch (e) {
                console.error("Chyba pri nastavovaní poslucháča pre počty ubytovania:", e);
                dispatchLocalNotification("Chyba pri načítaní údajov o obsadenosti ubytovania.", 'error');
            }
        };

        fetchAccommodationCounts();

        return () => {
            if (unsubscribeCounts) {
                unsubscribeCounts();
            }
        };
    }, [db, dispatchLocalNotification]);


    const handleAccommodationChange = (e) => {
        const newValue = e.target.value;
        setSelectedAccommodationType(newValue);
        handleChange({ target: { id: 'accommodation', value: { type: newValue } } });
    };

    const handleArrivalChange = (e) => {
        const newValue = e.target.value;
        setSelectedArrivalType(newValue);
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
        handleChange({ target: { id: 'arrival', value: { type: selectedArrivalType, time: timeString } } });
    };


    const isFormValidPage5 = React.useMemo(() => {
        if (!selectedAccommodationType) {
            return false;
        }

        if (!selectedArrivalType) {
            return false;
        }
        if ((selectedArrivalType === 'vlaková doprava' || selectedArrivalType === 'autobusová doprava')) {
            if (!arrivalHours || !arrivalMinutes) {
                return false;
            }
        }
        return true;
    }, [selectedAccommodationType, selectedArrivalType, arrivalHours, arrivalMinutes]);


    const nextButtonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
    ${!isFormValidPage5 || loading
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
      : 'bg-blue-500 hover:bg-blue-700 text-white'
    }
  `;

    const handleRegistrationSubmit = async (e) => {
        e.preventDefault();

        if (!isFormValidPage5) {
            dispatchLocalNotification("Prosím, vyplňte všetky povinné polia.", 'error');
            return;
        }

        if (setLoading) setLoading(true);
        closeLocalNotification(); 

        try {
            const finalArrivalTime = (selectedArrivalType === 'vlaková doprava' || selectedArrivalType === 'autobusová doprava')
                                     ? (arrivalHours && arrivalMinutes ? `${arrivalHours}:${arrivalMinutes}` : null)
                                     : null;

            const finalFormData = {
                ...formData,
                accommodation: {
                    type: selectedAccommodationType
                },
                arrival: {
                    type: selectedArrivalType,
                    time: finalArrivalTime
                }
            };

            let totalPeopleForCurrentRegistration = 0;
            if (teamsDataFromPage4) {
                for (const categoryName in teamsDataFromPage4) {
                    if (teamsDataFromPage4[categoryName]) {
                        for (const team of teamsDataFromPage4[categoryName]) {
                            totalPeopleForCurrentRegistration += (parseInt(team.players, 10) || 0) +
                                                                  (parseInt(team.womenTeamMembers, 10) || 0) +
                                                                  (parseInt(team.menTeamMembers, 10) || 0);
                        }
                    }
                }
            }
            
            await handleSubmit(finalFormData); 

            const accommodationToUpdate = finalFormData.accommodation?.type;
            if (accommodationToUpdate) {
                const accommodationCountsDocRef = doc(db, 'settings', 'accommodationCounts');
                
                const docSnap = await getDoc(accommodationCountsDocRef);
                let currentCount = 0;

                if (docSnap.exists() && docSnap.data()[accommodationToUpdate] !== undefined) {
                    currentCount = docSnap.data()[accommodationToUpdate];
                }

                const newTotal = currentCount + totalPeopleForCurrentRegistration;

                await setDoc(accommodationCountsDocRef, {
                    [accommodationToUpdate]: newTotal
                }, { merge: true });
            }

            if (setRegistrationSuccess) setRegistrationSuccess(true); 
        } catch (error) {
            console.error("Chyba pri finalizácii registrácie alebo aktualizácii počtov ubytovania:", error);
            dispatchLocalNotification(`Chyba pri registrácii: ${error.message}`, 'error');
            if (setRegistrationSuccess) setRegistrationSuccess(false);
        } finally {
            if (setLoading) setLoading(false);
        }
    };

    // Pomocné funkcie na generovanie <option> pre hodiny a minúty
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
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeLocalNotification, type: notificationType }),

        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
            'Registrácia - Ubytovanie a Príchod'
        ),

        React.createElement(
            'form',
            { onSubmit: handleRegistrationSubmit, className: 'space-y-4' },
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
                                checked: selectedAccommodationType === 'Bez ubytovania',
                                onChange: handleAccommodationChange,
                                className: 'form-radio h-5 w-5 text-blue-600',
                                disabled: loading,
                            }),
                            React.createElement('span', { className: 'ml-3 text-gray-800' }, `Bez ubytovania`) 
                        ),
                        accommodations.map((acc) => {
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
                                    checked: selectedAccommodationType === acc.type,
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
                // NOVINKA: Informačný text
                React.createElement(
                    'p',
                    { className: 'text-sm text-gray-600 mb-4' },
                    `Ak budete prichádzať verejnou dopravou a je potrebné pre Vás zabezpečiť dopravu na miesto ubytovania, napíšte nám čas príchodu vlaku/autobusu dňa ${tournamentStartDateDisplay} do Žiliny. V prípade príchodu po 10:00 hod. bude zabezpečený zvoz len na miesto otvorenia turnaja.`
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 space-y-2' },
                    React.createElement(
                        'label',
                        { className: `flex items-center p-3 rounded-lg cursor-pointer ${loading ? 'bg-gray-100' : 'hover:bg-blue-50'} transition-colors duration-200` },
                        React.createElement('input', {
                            type: 'radio',
                            name: 'arrivalType',
                            value: 'vlaková doprava',
                            checked: selectedArrivalType === 'vlaková doprava',
                            onChange: handleArrivalChange,
                            className: 'form-radio h-5 w-5 text-blue-600',
                            disabled: loading,
                        }),
                        React.createElement('span', { className: 'ml-3 text-gray-800' }, 'Vlaková doprava')
                    ),
                    (selectedArrivalType === 'vlaková doprava') && React.createElement(
                        'div',
                        { className: 'ml-8' }, // Odsadenie pre pole času
                        React.createElement(
                            'p',
                            { className: 'block text-gray-700 text-sm font-bold mb-2' },
                            'Predpokladaný čas príchodu:'
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex space-x-4' },
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { className: 'sr-only', htmlFor: 'arrivalHours' }, 'Hodina'), // Skrytý label pre prístupnosť
                                React.createElement('select', {
                                    id: 'arrivalHours',
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalHours,
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                    disabled: loading,
                                }, generateTimeOptions(24))
                            ),
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { className: 'sr-only', htmlFor: 'arrivalMinutes' }, 'Minúta'), // Skrytý label pre prístupnosť
                                React.createElement('select', {
                                    id: 'arrivalMinutes',
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalMinutes,
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                    disabled: loading,
                                }, generateTimeOptions(60))
                            )
                        )
                    ),
                    React.createElement(
                        'label',
                        { className: `flex items-center p-3 rounded-lg cursor-pointer ${loading ? 'bg-gray-100' : 'hover:bg-blue-50'} transition-colors duration-200` },
                        React.createElement('input', {
                            type: 'radio',
                            name: 'arrivalType',
                            value: 'autobusová doprava',
                            checked: selectedArrivalType === 'autobusová doprava',
                            onChange: handleArrivalChange,
                            className: 'form-radio h-5 w-5 text-blue-600',
                            disabled: loading,
                        }),
                        React.createElement('span', { className: 'ml-3 text-gray-800' }, 'Autobusová doprava')
                    ),
                    (selectedArrivalType === 'autobusová doprava') && React.createElement(
                        'div',
                        { className: 'ml-8' },
                        React.createElement(
                            'p',
                            { className: 'block text-gray-700 text-sm font-bold mb-2' },
                            'Predpokladaný čas príchodu:'
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex space-x-4' },
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { className: 'sr-only', htmlFor: 'arrivalHours' }, 'Hodina'),
                                React.createElement('select', {
                                    id: 'arrivalHours',
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalHours,
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                    disabled: loading,
                                }, generateTimeOptions(24))
                            ),
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { className: 'sr-only', htmlFor: 'arrivalMinutes' }, 'Minúta'),
                                React.createElement('select', {
                                    id: 'arrivalMinutes',
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalMinutes,
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                    disabled: loading,
                                }, generateTimeOptions(60))
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
                            checked: selectedArrivalType === 'vlastná doprava',
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
                            checked: selectedArrivalType === 'bez dopravy',
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
                        disabled: loading || !isFormValidPage5,
                    },
                    loading ? React.createElement(
                        'div',
                        { className: 'flex items-center justify-center' },
                        React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                            React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                            React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                        ),
                        'Registrujem...'
                    ) : 'Registrovať'
                )
            )
        )
    );
}

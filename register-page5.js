import { getFirestore, doc, onSnapshot, collection, query, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

export function Page5Form({ formData, handlePrev, handleSubmit, loading, setLoading, setRegistrationSuccess, handleChange, teamsDataFromPage4 }) { // Pridaný teamsDataFromPage4 ako prop
    const db = getFirestore();

    const [accommodations, setAccommodations] = React.useState([]);
    const [selectedAccommodationType, setSelectedAccommodationType] = React.useState(formData.accommodation?.type || '');
    const [accommodationCounts, setAccommodationCounts] = React.useState({});
    const [isAccommodationDataLoaded, setIsAccommodationDataLoaded] = React.useState(false);

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
        const fetchAccommodationSettings = () => {
            if (!window.db) {
                setTimeout(fetchAccommodationSettings, 100);
                return;
            }
            try {
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
            } catch (e) {
                console.error("Chyba pri nastavovaní poslucháča pre ubytovanie:", e);
                dispatchLocalNotification("Chyba pri nastavovaní poslucháča pre ubytovanie.", 'error');
                setIsAccommodationDataLoaded(true);
            }
        };

        fetchAccommodationSettings();

        return () => {
            if (unsubscribeAccommodation) {
                unsubscribeAccommodation();
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
        // Zmena: value je teraz selectedAccommodationType priamo
        const newValue = e.target.value; 
        setSelectedAccommodationType(newValue);
        handleChange({ target: { id: 'accommodation', value: { type: newValue } } });
    };

    const isFormValidPage5 = selectedAccommodationType !== '';

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
            dispatchLocalNotification("Prosím, vyberte typ ubytovania.", 'error');
            return;
        }

        if (setLoading) setLoading(true);
        // Vynulovanie lokálnych notifikácií
        closeLocalNotification(); 

        try {
            const finalFormData = {
                ...formData,
                accommodation: {
                    type: selectedAccommodationType
                }
            };

            // Vypočítaj celkový počet ľudí pre túto registráciu z teamsDataFromPage4
            let totalPeopleForCurrentRegistration = 0;
            if (teamsDataFromPage4) { // Používame teamsDataFromPage4 namiesto formData.teams
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
            
            // Pred odoslaním na registráciu, aktualizujeme počty ubytovania
            // Až po úspešnej registrácii rodičom sa aktualizuje accommodationCounts
            await handleSubmit(finalFormData); 

            const accommodationToUpdate = finalFormData.accommodation?.type;
            if (accommodationToUpdate) {
                const accommodationCountsDocRef = doc(db, 'settings', 'accommodationCounts');
                
                // Získajte aktuálny stav dokumentu a počtu
                const docSnap = await getDoc(accommodationCountsDocRef);
                let currentCount = 0;

                if (docSnap.exists() && docSnap.data()[accommodationToUpdate] !== undefined) {
                    currentCount = docSnap.data()[accommodationToUpdate];
                }

                const newTotal = currentCount + totalPeopleForCurrentRegistration;

                // Aktualizujte dokument pomocou setDoc s merge: true
                await setDoc(accommodationCountsDocRef, {
                    [accommodationToUpdate]: newTotal
                }, { merge: true }); // Toto zabezpečí, že sa aktualizuje len dané pole, alebo sa vytvorí, ak neexistuje
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

    return React.createElement(
        React.Fragment,
        null,
        // Používame lokálny NotificationModal a lokálne stavy
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeLocalNotification, type: notificationType }),

        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
            'Registrácia - Ubytovanie'
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
                    // Zmena zo selectboxu na zoznam radio buttonov
                    React.createElement(
                        'div',
                        { className: 'space-y-2' }, // Medzery medzi možnosťami
                        // Možnosť "Bez ubytovania"
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
                            // ZMENA: Odstránený text s počtom registrovaných
                            React.createElement('span', { className: 'ml-3 text-gray-800' }, `Bez ubytovania`) 
                        ),
                        // Dynamické možnosti ubytovania z Firestore
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
                                // ZMENA: Odstránený text s kapacitou a počtom registrovaných
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

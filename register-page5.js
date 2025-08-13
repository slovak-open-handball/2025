import { getFirestore, doc, onSnapshot, collection, query, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function Page5Form({ formData, handlePrev, handleSubmit, loading, setLoading, notificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, NotificationModal, closeNotification, handleChange }) {
    const db = getFirestore();

    const [accommodations, setAccommodations] = React.useState([]);
    const [selectedAccommodationType, setSelectedAccommodationType] = React.useState(formData.accommodation?.type || '');
    const [accommodationCounts, setAccommodationCounts] = React.useState({});
    const [isAccommodationDataLoaded, setIsAccommodationDataLoaded] = React.useState(false);

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
                    // Defenzívne volanie notifikačných funkcií
                    if (setNotificationMessage) setNotificationMessage("Chyba pri načítaní nastavení ubytovania.");
                    if (setShowNotification) setShowNotification(true);
                    if (setNotificationType) setNotificationType('error');
                    setIsAccommodationDataLoaded(true);
                });
            } catch (e) {
                console.error("Chyba pri nastavovaní poslucháča pre ubytovanie:", e);
                // Defenzívne volanie notifikačných funkcií
                if (setNotificationMessage) setNotificationMessage("Chyba pri nastavovaní poslucháča pre ubytovanie.");
                if (setShowNotification) setShowNotification(true);
                if (setNotificationType) setNotificationType('error');
                setIsAccommodationDataLoaded(true);
            }
        };

        fetchAccommodationSettings();

        return () => {
            if (unsubscribeAccommodation) {
                unsubscribeAccommodation();
            }
        };
    }, [db, setNotificationMessage, setShowNotification, setNotificationType]);

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
                    // Defenzívne volanie notifikačných funkcií
                    if (setNotificationMessage) setNotificationMessage("Chyba pri načítaní údajov o obsadenosti ubytovania.");
                    if (setShowNotification) setShowNotification(true);
                    if (setNotificationType) setNotificationType('error');
                });
            } catch (e) {
                console.error("Chyba pri nastavovaní poslucháča pre počty ubytovania:", e);
                // Defenzívne volanie notifikačných funkcií
                if (setNotificationMessage) setNotificationMessage("Chyba pri načítaní údajov o obsadenosti ubytovania.");
                if (setShowNotification) setShowNotification(true);
                if (setNotificationType) setNotificationType('error');
            }
        };

        fetchAccommodationCounts();

        return () => {
            if (unsubscribeCounts) {
                unsubscribeCounts();
            }
        };
    }, [db, setNotificationMessage, setShowNotification, setNotificationType]);


    const handleAccommodationChange = (e) => {
        setSelectedAccommodationType(e.target.value);
        handleChange({ target: { id: 'accommodation', value: { type: e.target.value } } });
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
            if (setNotificationMessage) setNotificationMessage("Prosím, vyberte typ ubytovania.");
            if (setShowNotification) setShowNotification(true);
            if (setNotificationType) setNotificationType('error');
            return;
        }

        if (setLoading) setLoading(true);
        if (setNotificationMessage) setNotificationMessage('');
        if (setShowNotification) setShowNotification(false);
        if (setNotificationType) setNotificationType('info');

        try {
            const finalFormData = {
                ...formData,
                accommodation: {
                    type: selectedAccommodationType
                }
            };
            await handleSubmit(finalFormData); 
            if (setRegistrationSuccess) setRegistrationSuccess(true); 
        } catch (error) {
            console.error("Chyba pri finalizácii registrácie:", error);
            if (setNotificationMessage) setNotificationMessage(`Chyba pri registrácii: ${error.message}`);
            if (setShowNotification) setShowNotification(true);
            if (setNotificationType) setNotificationType('error');
            if (setRegistrationSuccess) setRegistrationSuccess(false);
        } finally {
            if (setLoading) setLoading(false);
        }
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),

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
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'accommodationType' }, 'Typ ubytovania'),
                    React.createElement(
                        'select',
                        {
                            id: 'accommodationType',
                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                            value: selectedAccommodationType,
                            onChange: handleAccommodationChange,
                            required: true,
                            disabled: loading || !isAccommodationDataLoaded,
                        },
                        React.createElement('option', { value: '' }, 'Vyberte typ ubytovania'),
                        React.createElement('option', { value: 'Bez ubytovania', disabled: false }, `Bez ubytovania (${accommodationCounts["Bez ubytovania"] || 0} registrovaných)`)
                        ,
                        accommodations.map((acc) => {
                            const currentCount = accommodationCounts[acc.type] || 0;
                            const isFull = currentCount >= acc.capacity;
                            return React.createElement(
                                'option',
                                {
                                    key: acc.type,
                                    value: acc.type,
                                    disabled: isFull,
                                    style: {
                                        cursor: isFull ? 'not-allowed' : 'pointer'
                                    }
                                },
                                `${acc.type} (Kapacita: ${acc.capacity}, Registrovaných: ${currentCount})${isFull ? ' (naplnená kapacita)' : ''}`
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
                        'Odosielam...'
                    ) : 'Registrovať sa'
                )
            )
        )
    );
}

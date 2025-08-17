import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { NotificationModal } from './register-page5.js'; // Import NotificationModal

export function Page4Form({ formData, handlePrev, handleNextPage4, loading, setLoading, notificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, numberOfPlayersLimit, numberOfTeamMembersLimit, teamsDataFromPage4, setTeamsDataFromPage4, closeNotification }) { // Odstránené NotificationModal z props, pretože sa importuje

    // Získame referenciu na Firebase Firestore
    const db = getFirestore();

    // Stav pre dynamicky načítané veľkosti tričiek z Firestore
    const [tshirtSizes, setTshirtSizes] = React.useState([]);

    // Lokálny stav pre dáta tímov v rámci Page4Form
    // Inicializujeme ho buď existujúcimi dátami z props (teamsDataFromPage4), alebo prázdnym objektom.
    const [teamsData, setTeamsData] = React.useState(teamsDataFromPage4 || {});

    // Effect pre synchronizáciu teamsDataFromPage4 prop s lokálnym stavom teamsData
    React.useEffect(() => {
        // Kontrolujeme, či sa teamsDataFromPage4 skutočne zmenili, aby sme predišli nekonečnej slučke
        if (JSON.stringify(teamsDataFromPage4) !== JSON.stringify(teamsData)) {
            setTeamsData(teamsDataFromPage4 || {});
        }
    }, [teamsDataFromPage4, teamsData]); // Závislosť na teamsData, aby sa detekovali zmeny aj v lokálnom stave

    // Effect pre načítanie veľkostí tričiek z Firestore
    React.useEffect(() => {
        let unsubscribe;
        const fetchTshirtSizes = () => {
            // Predpokladáme, že window.db je už inicializované z authentication.js
            if (!window.db) {
                console.log("Firestore DB nie je zatiaľ k dispozícii pre veľkosti tričiek.");
                // Skúste znova po krátkom oneskorení, ak db ešte nie je k dispozícii
                setTimeout(fetchTshirtSizes, 100);
                return;
            }
            try {
                const tshirtSizesDocRef = doc(window.db, 'settings', 'sizeTshirts');
                unsubscribe = onSnapshot(tshirtSizesDocRef, (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        setTshirtSizes(data.sizes || []);
                    } else {
                        setTshirtSizes([]);
                    }
                }, (error) => {
                    console.error("Chyba pri načítaní veľkostí tričiek:", error);
                    // Používame props pre notifikácie
                    if (setShowNotification) setShowNotification(true);
                    if (setNotificationMessage) setNotificationMessage("Chyba pri načítaní veľkostí tričiek.", 'error');
                    if (setNotificationType) setNotificationType('error');
                });
            } catch (e) {
                console.error("Chyba pri nastavovaní poslucháča pre veľkosti tričiek:", e);
                // Používame props pre notifikácie
                if (setShowNotification) setShowNotification(true);
                if (setNotificationMessage) setNotificationMessage("Chyba pri načítaní veľkostí tričiek.", 'error');
                if (setNotificationType) setNotificationType('error');
            }
        };

        fetchTshirtSizes();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [db, setShowNotification, setNotificationMessage, setNotificationType]); // Pridaná závislosť na db

    // Spravuje zmeny v údajoch o tímoch, vrátane hráčov a členov realizačného tímu
    const handleTeamDetailsChange = React.useCallback((categoryName, teamIndex, field, value) => {
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
        if (setLoading) setLoading(true);
        if (closeNotification) closeNotification();

        if (!isFormValidPage4) {
            if (setNotificationMessage) setNotificationMessage("Prosím, vyplňte všetky povinné polia pre každý tím a uistite sa, že počet tričiek zodpovedá počtu členov.", 'error');
            if (setNotificationType) setNotificationType('error');
            if (setLoading) setLoading(false);
            return;
        }

        try {
            // teamsData už obsahuje aktuálny stav, ktorý bol synchronizovaný cez useEffect
            await handleNextPage4(teamsData);
        } catch (error) {
            console.error("Chyba pri spracovaní dát Page4:", error);
            if (setNotificationMessage) setNotificationMessage(`Chyba pri spracovaní údajov: ${error.message}`, 'error');
            if (setNotificationType) setNotificationType('error');
        } finally {
            if (setLoading) setLoading(false);
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

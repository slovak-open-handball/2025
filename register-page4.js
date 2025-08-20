import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function Page4Form({ formData, handlePrev, handleNextPage4, loading, setLoading, notificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, NotificationModal, numberOfPlayersLimit, numberOfTeamMembersLimit, teamsDataFromPage4, setTeamsDataFromPage4, closeNotification }) {

    // Získame referenciu na Firebase Firestore
    const db = getFirestore();

    // Stav pre dynamicky načítané veľkosti tričiek z Firestore
    const [tshirtSizes, setTshirtSizes] = React.useState([]);

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
                    setTshirtSizes([]);
                });
            } catch (error) {
                console.error("Chyba pri prístupe k Firestore pre veľkosti tričiek:", error);
                setTshirtSizes([]);
            }
        };

        fetchTshirtSizes();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);

    const handleTeamFieldChange = React.useCallback((categoryName, teamIndex, field, value) => {
        setTeamsDataFromPage4(prevTeamsData => {
            const newTeamsData = { ...prevTeamsData };
            if (!newTeamsData[categoryName]) {
                newTeamsData[categoryName] = [];
            }
            if (!newTeamsData[categoryName][teamIndex]) {
                newTeamsData[categoryName][teamIndex] = {};
            }

            // Špeciálne ošetrenie pre 'players', 'womenTeamMembers', 'menTeamMembers'
            if (['players', 'womenTeamMembers', 'menTeamMembers'].includes(field)) {
                const numValue = parseInt(value, 10) || 0;
                newTeamsData[categoryName][teamIndex][field] = numValue;

                // Ak sa mení počet hráčov, inicializujeme playerDetails
                if (field === 'players') {
                    const existingPlayers = newTeamsData[categoryName][teamIndex].playerDetails || [];
                    const newPlayers = Array.from({ length: numValue }).map((_, i) => {
                        const existingPlayer = existingPlayers[i] || {};
                        return {
                            jerseyNumber: '', firstName: '', lastName: '', dateOfBirth: '', isRegistered: false, registrationNumber: '',
                            address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' },
                            ...existingPlayer
                        };
                    });
                    newTeamsData[categoryName][teamIndex].playerDetails = newPlayers;
                }
                // Ak sa mení počet ženských členov realizačného tímu, inicializujeme womenTeamMemberDetails
                if (field === 'womenTeamMembers') {
                    const existingMembers = newTeamsData[categoryName][teamIndex].womenTeamMemberDetails || [];
                    const newMembers = Array.from({ length: numValue }).map((_, i) => {
                        const existingMember = existingMembers[i] || {};
                        return {
                            firstName: '', lastName: '', dateOfBirth: '',
                            address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' },
                            ...existingMember
                        };
                    });
                    newTeamsData[categoryName][teamIndex].womenTeamMemberDetails = newMembers;
                }
                // Ak sa mení počet mužských členov realizačného tímu, inicializujeme menTeamMemberDetails
                if (field === 'menTeamMembers') {
                    const existingMembers = newTeamsData[categoryName][teamIndex].menTeamMemberDetails || [];
                    const newMembers = Array.from({ length: numValue }).map((_, i) => {
                        const existingMember = existingMembers[i] || {};
                        return {
                            firstName: '', lastName: '', dateOfBirth: '',
                            address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' },
                            ...existingMember
                        };
                    });
                    newTeamsData[categoryName][teamIndex].menTeamMemberDetails = newMembers;
                }

            } else if (field === 'tshirts') {
                newTeamsData[categoryName][teamIndex].tshirts = value;
            } else if (field === 'accommodation') {
                newTeamsData[categoryName][teamIndex].accommodation = { type: value };
            } else if (field === 'arrival') {
                newTeamsData[categoryName][teamIndex].arrival = { ...newTeamsData[categoryName][teamIndex].arrival, type: value };
                // Ak zmeníme typ dopravy na iný ako "vlastná doprava", vynulujeme šoférov
                if (value !== 'vlastná doprava') {
                    if (newTeamsData[categoryName][teamIndex].arrival) {
                        newTeamsData[categoryName][teamIndex].arrival.drivers = null;
                    }
                    newTeamsData[categoryName][teamIndex].driverDetailsMale = [];
                    newTeamsData[categoryName][teamIndex].driverDetailsFemale = [];
                }
            } else if (field === 'arrival.time') {
                newTeamsData[categoryName][teamIndex].arrival = { ...newTeamsData[categoryName][teamIndex].arrival, time: value };
            } else if (field.startsWith('arrival.drivers')) {
                const driverGender = field.split('.')[2]; // 'male' or 'female'
                const numDrivers = parseInt(value, 10) || 0;

                if (!newTeamsData[categoryName][teamIndex].arrival) {
                    newTeamsData[categoryName][teamIndex].arrival = {};
                }
                if (!newTeamsData[categoryName][teamIndex].arrival.drivers) {
                    newTeamsData[categoryName][teamIndex].arrival.drivers = { male: 0, female: 0 };
                }
                newTeamsData[categoryName][teamIndex].arrival.drivers[driverGender] = numDrivers;

                // Inicializácia driverDetailsMale alebo driverDetailsFemale
                if (driverGender === 'male') {
                    const existingDrivers = newTeamsData[categoryName][teamIndex].driverDetailsMale || [];
                    const newDrivers = Array.from({ length: numDrivers }).map((_, i) => {
                        const existingDriver = existingDrivers[i] || {};
                        return {
                            firstName: '', lastName: '', dateOfBirth: '',
                            address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' },
                            ...existingDriver
                        };
                    });
                    newTeamsData[categoryName][teamIndex].driverDetailsMale = newDrivers;
                } else if (driverGender === 'female') {
                    const existingDrivers = newTeamsData[categoryName][teamIndex].driverDetailsFemale || [];
                    const newDrivers = Array.from({ length: numDrivers }).map((_, i) => {
                        const existingDriver = existingDrivers[i] || {};
                        return {
                            firstName: '', lastName: '', dateOfBirth: '',
                            address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' },
                            ...existingDriver
                        };
                    });
                    newTeamsData[categoryName][teamIndex].driverDetailsFemale = newDrivers;
                }

            } else {
                newTeamsData[categoryName][teamIndex][field] = value;
            }

            return newTeamsData;
        });
    }, [setTeamsDataFromPage4]);


    const handleTshirtChange = React.useCallback((categoryName, teamIndex, tshirtIndex, field, value) => {
        setTeamsDataFromPage4(prevTeamsData => {
            const newTeamsData = { ...prevTeamsData };
            const team = newTeamsData[categoryName][teamIndex];
            if (!team.tshirts) {
                team.tshirts = [];
            }
            if (!team.tshirts[tshirtIndex]) {
                team.tshirts[tshirtIndex] = { size: '', quantity: 0 };
            }
            team.tshirts[tshirtIndex][field] = field === 'quantity' ? parseInt(value, 10) || 0 : value;
            return newTeamsData;
        });
    }, [setTeamsDataFromPage4]);

    const handleAddTshirt = React.useCallback((categoryName, teamIndex) => {
        setTeamsDataFromPage4(prevTeamsData => {
            const newTeamsData = { ...prevTeamsData };
            const team = newTeamsData[categoryName][teamIndex];
            if (!team.tshirts) {
                team.tshirts = [];
            }
            team.tshirts.push({ size: '', quantity: 0 });
            return newTeamsData;
        });
    }, [setTeamsDataFromPage4]);

    const handleRemoveTshirt = React.useCallback((categoryName, teamIndex, tshirtIndex) => {
        setTeamsDataFromPage4(prevTeamsData => {
            const newTeamsData = { ...prevTeamsData };
            const team = newTeamsData[categoryName][teamIndex];
            if (team.tshirts && team.tshirts.length > 1) {
                team.tshirts.splice(tshirtIndex, 1);
            } else {
                team.tshirts = [{ size: '', quantity: 0 }]; // Vždy ponecháme aspoň jeden prázdny riadok
            }
            return newTeamsData;
        });
    }, [setTeamsDataFromPage4]);

    // Funkcia na validáciu formulára pre Page4
    const isFormValidPage4 = React.useMemo(() => {
        // Skontrolujte, či všetky požadované polia majú hodnoty
        for (const categoryName in teamsDataFromPage4) {
             // NOVINKA: Ignorujeme 'globalNote' ak sa tam náhodou dostane
            if (categoryName === 'globalNote') {
                continue;
            }
            const teamsInCurrentCategory = teamsDataFromPage4[categoryName];
            if (Array.isArray(teamsInCurrentCategory)) { // Zabezpečíme, že pracujeme s poľom
                for (const team of teamsInCurrentCategory) {
                    if (team.players === '' || team.players === undefined || team.players < 0) return false;
                    if (team.womenTeamMembers === '' || team.womenTeamMembers === undefined || team.womenTeamMembers < 0) return false;
                    if (team.menTeamMembers === '' || team.menTeamMembers === undefined || team.menTeamMembers < 0) return false;

                    // Kontrola, či celkový počet členov tímu neprekračuje limit
                    const totalTeamMembers = (parseInt(team.players, 10) || 0) + (parseInt(team.womenTeamMembers, 10) || 0) + (parseInt(team.menTeamMembers, 10) || 0);
                    if (totalTeamMembers > numberOfTeamMembersLimit) return false;

                    // Kontrola počtu hráčov voči limitu
                    if ((parseInt(team.players, 10) || 0) > numberOfPlayersLimit) return false;

                    // Kontrola tričiek
                    if (team.tshirts && team.tshirts.length > 0) {
                        for (const tshirt of team.tshirts) {
                            // Ak je zadaná veľkosť, musí byť zadané aj množstvo (>0)
                            if (tshirt.size && (tshirt.quantity === '' || tshirt.quantity === undefined || tshirt.quantity <= 0)) return false;
                            // Ak je zadané množstvo, musí byť zadaná aj veľkosť
                            if (tshirt.quantity > 0 && !tshirt.size) return false;
                        }
                    }

                    // Kontrola ubytovania (ak je vybraté iné ako 'Bez ubytovania', mali by tam byť nejaké dáta, hoci tu to neriešime detailne)
                    if (team.accommodation?.type && team.accommodation.type !== 'Bez ubytovania') {
                        // Tu by mohla byť dodatočná validácia pre ubytovanie, ak je potrebná
                    }

                    // Kontrola dopravy
                    if (team.arrival?.type && team.arrival.type !== 'bez dopravy') {
                        if ((team.arrival.type === 'verejná doprava - vlak' || team.arrival.type === 'verejná doprava - autobus') && !team.arrival.time) return false;
                        if (team.arrival.type === 'vlastná doprava') {
                            const maleDrivers = parseInt(team.arrival.drivers?.male, 10) || 0;
                            const femaleDrivers = parseInt(team.arrival.drivers?.female, 10) || 0;
                            if (maleDrivers < 0 || femaleDrivers < 0) return false;
                        }
                    }

                    // Kontrola balíčka - ak je vybraný packageId, ale chýbajú packageDetails
                    if (team.packageId && !team.packageDetails) {
                        // Toto by sa nemalo stať, ak je packageDetails nastavené na základe packageId
                        // Ale pre istotu pridáme validáciu
                        return false;
                    }
                }
            }
        }
        return true;
    }, [teamsDataFromPage4, numberOfPlayersLimit, numberOfTeamMembersLimit]);


    const nextButtonClasses = `
        font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
        ${loading || !isRecaptchaReady || !isFormValidPage4
            ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-700 text-white'
        }
    `.trim();

    const handleSubmitPage4 = async (e) => {
        e.preventDefault();
        setLoading(true);
        closeNotification();

        if (!isFormValidPage4) {
            setNotificationMessage('Prosím, vyplňte všetky povinné polia a opravte chyby.');
            setNotificationType('error');
            setShowNotification(true);
            setLoading(false);
            return;
        }

        handleNextPage4(teamsDataFromPage4);
        setLoading(false);
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),

        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-2 text-center text-gray-800' },
            'Registrácia - strana 4'
        ),
        React.createElement(
            'p',
            { className: 'text-center text-sm text-gray-600 mb-6 px-4' },
            'Teraz zadajte počty hráčov, členov realizačného tímu a šoférov pre každý tím. Tieto údaje môžete neskôr upraviť v sekcii "Moja zóna" až do ',
            React.createElement('strong', { style: { whiteSpace: 'nowrap' } }, 'uzávierky súpisiek.')
        ),

        React.createElement(
            'form',
            { onSubmit: handleSubmitPage4, className: 'space-y-4' },
            Object.keys(teamsDataFromPage4).length === 0 ? (
                React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Prejdite prosím na predchádzajúce stránky a zadajte kategórie a tímy.')
            ) : (
                Object.keys(teamsDataFromPage4)
                    .filter(categoryName => Array.isArray(teamsDataFromPage4[categoryName])) // ZMENA: Filtrovanie kľúčov, ktoré nie sú poľami
                    .map(categoryName => (
                        React.createElement(
                            'div',
                            { key: categoryName, className: 'border-t border-gray-200 pt-4 mt-4' },
                            React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, `Kategória: ${categoryName}`),
                            (Array.isArray(teamsDataFromPage4[categoryName]) ? teamsDataFromPage4[categoryName] : []).map((team, teamIndex) => {
                                const totalTeamMembers = (parseInt(team.players, 10) || 0) + (parseInt(team.womenTeamMembers, 10) || 0) + (parseInt(team.menTeamMembers, 10) || 0);
                                const isTotalTeamMembersOverLimit = totalTeamMembers > numberOfTeamMembersLimit;
                                const isPlayersOverLimit = (parseInt(team.players, 10) || 0) > numberOfPlayersLimit;

                                return React.createElement(
                                    'div',
                                    { key: `${categoryName}-${teamIndex}`, className: 'bg-blue-50 p-4 rounded-lg mb-4 space-y-2' },
                                    React.createElement('p', { className: 'font-semibold text-blue-800 mb-4' }, `Tím: ${team.teamName}`),
                                    React.createElement(
                                        'div',
                                        { className: 'mb-4' },
                                        React.createElement('label', { htmlFor: `players-${categoryName}-${teamIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, `Počet hráčov (max ${numberOfPlayersLimit})`),
                                        React.createElement('input', {
                                            type: 'number',
                                            id: `players-${categoryName}-${teamIndex}`,
                                            className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${isPlayersOverLimit ? 'border-red-500' : ''}`.trim(),
                                            value: team.players || '',
                                            onChange: (e) => handleTeamFieldChange(categoryName, teamIndex, 'players', e.target.value),
                                            min: "0",
                                            max: numberOfPlayersLimit.toString(),
                                            disabled: loading,
                                            tabIndex: 1
                                        }),
                                        isPlayersOverLimit && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, `Prekročený limit hráčov (${numberOfPlayersLimit}).`),
                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0') // Placeholder pre udržanie výšky
                                    ),
                                    React.createElement(
                                        'div',
                                        { className: 'mb-4' },
                                        React.createElement('label', { htmlFor: `womenTeamMembers-${categoryName}-${teamIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, `Počet žien realizačného tímu`),
                                        React.createElement('input', {
                                            type: 'number',
                                            id: `womenTeamMembers-${categoryName}-${teamIndex}`,
                                            className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${isTotalTeamMembersOverLimit ? 'border-red-500' : ''}`.trim(),
                                            value: team.womenTeamMembers || '',
                                            onChange: (e) => handleTeamFieldChange(categoryName, teamIndex, 'womenTeamMembers', e.target.value),
                                            min: "0",
                                            max: numberOfTeamMembersLimit.toString(),
                                            disabled: loading,
                                            tabIndex: 1
                                        }),
                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0') // Placeholder pre udržanie výšky
                                    ),
                                    React.createElement(
                                        'div',
                                        { className: 'mb-4' },
                                        React.createElement('label', { htmlFor: `menTeamMembers-${categoryName}-${teamIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, `Počet mužov realizačného tímu`),
                                        React.createElement('input', {
                                            type: 'number',
                                            id: `menTeamMembers-${categoryName}-${teamIndex}`,
                                            className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${isTotalTeamMembersOverLimit ? 'border-red-500' : ''}`.trim(),
                                            value: team.menTeamMembers || '',
                                            onChange: (e) => handleTeamFieldChange(categoryName, teamIndex, 'menTeamMembers', e.target.value),
                                            min: "0",
                                            max: numberOfTeamMembersLimit.toString(),
                                            disabled: loading,
                                            tabIndex: 1
                                        }),
                                        isTotalTeamMembersOverLimit && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, `Maximálny počet členov realizačného tímu je ${numberOfTeamMembersLimit}.`),
                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0') // Placeholder pre udržanie výšky
                                    ),
                                    // Tričká
                                    React.createElement(
                                        'div',
                                        { className: 'mb-4 border-t border-gray-200 pt-4' },
                                        React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700' }, 'Účastnícke tričká'),
                                        React.createElement('p', { className: 'text-sm text-gray-600 mb-4' }, 'Všetky sú unisex.'),
                                        (team.tshirts || []).map((tshirt, tshirtIndex) => (
                                            React.createElement('div', { key: tshirtIndex, className: 'flex items-center space-x-2 mb-2' },
                                                React.createElement('div', { className: 'flex-1' },
                                                    React.createElement('label', { htmlFor: `tshirt-size-${categoryName}-${teamIndex}-${tshirtIndex}`, className: 'sr-only' }, 'Veľkosť'),
                                                    React.createElement('select', {
                                                        id: `tshirt-size-${categoryName}-${teamIndex}-${tshirtIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: tshirt.size || '',
                                                        onChange: (e) => handleTshirtChange(categoryName, teamIndex, tshirtIndex, 'size', e.target.value),
                                                        disabled: loading,
                                                        tabIndex: 1
                                                    },
                                                        React.createElement('option', { value: '' }, 'Vyberte veľkosť'),
                                                        tshirtSizes.map(size => React.createElement('option', { key: size, value: size }, size))
                                                    )
                                                ),
                                                React.createElement('div', { className: 'w-24' },
                                                    React.createElement('label', { htmlFor: `tshirt-quantity-${categoryName}-${teamIndex}-${tshirtIndex}`, className: 'sr-only' }, 'Počet'),
                                                    React.createElement('input', {
                                                        type: 'number',
                                                        id: `tshirt-quantity-${categoryName}-${teamIndex}-${tshirtIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: tshirt.quantity || '',
                                                        onChange: (e) => {
                                                            const val = parseInt(e.target.value, 10);
                                                            handleTshirtChange(categoryName, teamIndex, tshirtIndex, 'quantity', isNaN(val) ? '' : val);
                                                        },
                                                        min: "0",
                                                        disabled: loading,
                                                        placeholder: 'Počet',
                                                        tabIndex: 1
                                                    })
                                                ),
                                                React.createElement(
                                                    'button',
                                                    {
                                                        type: 'button',
                                                        onClick: () => handleRemoveTshirt(categoryName, teamIndex, tshirtIndex),
                                                        className: 'bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
                                                        disabled: loading,
                                                        tabIndex: 1
                                                    },
                                                    '-'
                                                )
                                            )
                                        )),
                                        React.createElement(
                                            'button',
                                            {
                                                type: 'button',
                                                onClick: () => handleAddTshirt(categoryName, teamIndex),
                                                className: 'mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
                                                disabled: loading,
                                                tabIndex: 1
                                            },
                                            '+'
                                        )
                                    ),
                                    // Ubytovanie
                                    React.createElement(
                                        'div',
                                        { className: 'mb-4 border-t border-gray-200 pt-4' },
                                        React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700' }, 'Ubytovanie'),
                                        React.createElement(
                                            'select',
                                            {
                                                id: `accommodation-${categoryName}-${teamIndex}`,
                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                value: team.accommodation?.type || '',
                                                onChange: (e) => handleTeamFieldChange(categoryName, teamIndex, 'accommodation', e.target.value),
                                                disabled: loading,
                                                tabIndex: 1
                                            },
                                            React.createElement('option', { value: '' }, 'Vyberte typ ubytovania'),
                                            React.createElement('option', { value: 'Zabezpečuje organizátor' }, 'Zabezpečuje organizátor'),
                                            React.createElement('option', { value: 'Vlastné ubytovanie' }, 'Vlastné ubytovanie'),
                                            React.createElement('option', { value: 'Bez ubytovania' }, 'Bez ubytovania')
                                        ),
                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                    ),
                                    // Doprava
                                    React.createElement(
                                        'div',
                                        { className: 'mb-4 border-t border-gray-200 pt-4' },
                                        React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700' }, 'Doprava'),
                                        React.createElement(
                                            'select',
                                            {
                                                id: `arrival-${categoryName}-${teamIndex}`,
                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                value: team.arrival?.type || '',
                                                onChange: (e) => handleTeamFieldChange(categoryName, teamIndex, 'arrival', e.target.value),
                                                disabled: loading,
                                                tabIndex: 1
                                            },
                                            React.createElement('option', { value: '' }, 'Vyberte typ dopravy'),
                                            React.createElement('option', { value: 'verejná doprava - vlak' }, 'Verejná doprava - vlak'),
                                            React.createElement('option', { value: 'verejná doprava - autobus' }, 'Verejná doprava - autobus'),
                                            React.createElement('option', { value: 'vlastná doprava' }, 'Vlastná doprava'),
                                            React.createElement('option', { value: 'bez dopravy' }, 'Bez dopravy')
                                        ),
                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0'),
                                        (team.arrival?.type === 'verejná doprava - vlak' || team.arrival?.type === 'verejná doprava - autobus') &&
                                        React.createElement(
                                            'div',
                                            { className: 'mt-2' },
                                            React.createElement('label', { htmlFor: `arrival-time-${categoryName}-${teamIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Predpokladaný čas príchodu'),
                                            React.createElement('input', {
                                                type: 'datetime-local',
                                                id: `arrival-time-${categoryName}-${teamIndex}`,
                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                value: team.arrival?.time || '',
                                                onChange: (e) => handleTeamFieldChange(categoryName, teamIndex, 'arrival.time', e.target.value),
                                                disabled: loading,
                                                tabIndex: 1
                                            }),
                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                        ),
                                        team.arrival?.type === 'vlastná doprava' &&
                                        React.createElement(
                                            'div',
                                            { className: 'mt-2 flex space-x-4' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex-1' },
                                                React.createElement('label', { htmlFor: `drivers-male-${categoryName}-${teamIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Počet mužov šoférov'),
                                                React.createElement('input', {
                                                    type: 'number',
                                                    id: `drivers-male-${categoryName}-${teamIndex}`,
                                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                    value: team.arrival?.drivers?.male || '',
                                                    onChange: (e) => handleTeamFieldChange(categoryName, teamIndex, 'arrival.drivers.male', e.target.value),
                                                    min: "0",
                                                    disabled: loading,
                                                    tabIndex: 1
                                                }),
                                                React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'flex-1' },
                                                React.createElement('label', { htmlFor: `drivers-female-${categoryName}-${teamIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Počet žien šoférov'),
                                                React.createElement('input', {
                                                    type: 'number',
                                                    id: `drivers-female-${categoryName}-${teamIndex}`,
                                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                    value: team.arrival?.drivers?.female || '',
                                                    onChange: (e) => handleTeamFieldChange(categoryName, teamIndex, 'arrival.drivers.female', e.target.value),
                                                    min: "0",
                                                    disabled: loading,
                                                    tabIndex: 1
                                                }),
                                                React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                            )
                                        )
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

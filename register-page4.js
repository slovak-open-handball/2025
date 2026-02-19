// register-page4.js - OPRAVENÝ
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function Page4Form({ formData, handlePrev, handleNextPage4, loading, setLoading, notificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, NotificationModal, numberOfPlayersLimit, numberOfTeamMembersLimit, teamsDataFromPage4, setTeamsDataFromPage4, closeNotification }) {

    // Získame referenciu na Firebase Firestore
    const db = getFirestore();

    // Stav pre dynamicky načítané veľkosti tričiek z Firestore
    const [tshirtSizes, setTshirtSizes] = React.useState([]);

    // Stav pre dynamicky načítané limity (max. hráčov a členov RT) pre každú kategóriu
    const [categoryLimits, setCategoryLimits] = React.useState({});

    // Effect pre načítanie veľkostí tričiek z Firestore
    React.useEffect(() => {
        let unsubscribe;
        const fetchTshirtSizes = () => {
            if (!window.db) {
                console.log("Firestore DB nie je zatiaľ k dispozícii pre veľkosti tričiek.");
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
                        console.warn("Dokument /settings/sizeTshirts neexistuje. Používa sa prázdne pole pre veľkosti tričiek.");
                        setTshirtSizes([]);
                    }
                }, (error) => {
                    console.error("Chyba pri načítaní veľkostí tričiek:", error);
                });
            } catch (e) {
                console.error("Chyba pri nastavovaní poslucháča pre veľkosti tričiek:", e);
            }
        };

        fetchTshirtSizes();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);

    // EFFECT: Načítanie limitov pre kategórie z Firestore
    React.useEffect(() => {
        if (!window.db) {
            console.log("Firestore DB nie je k dispozícii pre načítanie limitov kategórií.");
            return;
        }

        const categoriesDocRef = doc(window.db, 'settings', 'categories');
        const unsubscribe = onSnapshot(categoriesDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data() || {};
                const limits = {};
                Object.entries(data).forEach(([categoryId, categoryData]) => {
                    limits[categoryData.name] = {
                        maxPlayers: categoryData.maxPlayers ?? 12,
                        maxTeamMembers: categoryData.maxImplementationTeam ?? 3
                    };
                });
                setCategoryLimits(limits);
            } else {
                console.warn("Dokument /settings/categories neexistuje.");
                setCategoryLimits({});
            }
        }, (error) => {
            console.error("Chyba pri načítaní limitov kategórií:", error);
        });

        return () => unsubscribe();
    }, []);

    // Pomocná funkcia na vytvorenie prázdneho poľa detailov pre osoby
    const createEmptyDetailsArray = (count, type) => {
        const baseTemplate = {
            firstName: '',
            lastName: '',
            dateOfBirth: '',
            address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }
        };
        
        if (type === 'player') {
            return Array.from({ length: count }, () => ({
                ...baseTemplate,
                jerseyNumber: '',
                isRegistered: false,
                registrationNumber: ''
            }));
        }
        
        return Array.from({ length: count }, () => ({ ...baseTemplate }));
    };

    // Spracovanie zmeny detailov tímu
    const handleTeamDetailChange = (categoryName, teamIndex, field, value) => {
        let newValue;
        const currentCategoryLimit = categoryLimits[categoryName] || { maxPlayers: 12, maxTeamMembers: 3 };

        if (value === '') {
            newValue = '';
        } else {
            let parsed = parseInt(value, 10);
            
            if (isNaN(parsed)) {
                newValue = '';
            } else {
                if (field === 'players') {
                    newValue = parsed;
                    if (newValue < 1 && newValue !== '') newValue = 1;
                    if (newValue > currentCategoryLimit.maxPlayers) newValue = currentCategoryLimit.maxPlayers;
                } else if (field === 'womenTeamMembers' || field === 'menTeamMembers') {
                    newValue = parsed;
                    if (newValue < 0 && newValue !== '') newValue = 0;
                } else {
                    newValue = parsed;
                }
            }
        }

        setTeamsDataFromPage4(prevDetails => {
            const newDetails = JSON.parse(JSON.stringify(prevDetails)); // Hlboká kópia
            
            if (!newDetails[categoryName]) {
                newDetails[categoryName] = [];
            }
            
            // Ak tím ešte neexistuje, vytvoríme ho so všetkými potrebnými poliami
            if (!newDetails[categoryName][teamIndex]) {
                newDetails[categoryName][teamIndex] = {
                    teamName: '',
                    players: '',
                    womenTeamMembers: '',
                    menTeamMembers: '',
                    tshirts: [{ size: '', quantity: '' }],
                    playerDetails: [],
                    womenTeamMemberDetails: [],
                    menTeamMemberDetails: [],
                    driverDetailsMale: [],
                    driverDetailsFemale: [],
                    accommodation: { type: '' },
                    arrival: { type: '', time: null, drivers: null },
                    packageId: '',
                    packageDetails: null,
                    jerseyColors: { color1: '', color2: '' }
                };
            }

            // Aktualizujeme požadované pole
            newDetails[categoryName][teamIndex][field] = newValue;

            // Ak sa mení počet hráčov, aktualizujeme aj playerDetails
            if (field === 'players') {
                const newCount = parseInt(newValue, 10) || 0;
                const oldDetails = newDetails[categoryName][teamIndex].playerDetails || [];
                
                // Zachováme existujúce detaily, ak sa počet nezmenšil
                newDetails[categoryName][teamIndex].playerDetails = Array.from({ length: newCount }, (_, i) => {
                    if (i < oldDetails.length) {
                        return oldDetails[i];
                    }
                    return {
                        jerseyNumber: '',
                        firstName: '',
                        lastName: '',
                        dateOfBirth: '',
                        isRegistered: false,
                        registrationNumber: '',
                        address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }
                    };
                });
            }

            // Ak sa mení počet žien v RT, aktualizujeme womenTeamMemberDetails
            if (field === 'womenTeamMembers') {
                const newCount = parseInt(newValue, 10) || 0;
                const oldDetails = newDetails[categoryName][teamIndex].womenTeamMemberDetails || [];
                
                newDetails[categoryName][teamIndex].womenTeamMemberDetails = Array.from({ length: newCount }, (_, i) => {
                    if (i < oldDetails.length) {
                        return oldDetails[i];
                    }
                    return {
                        firstName: '',
                        lastName: '',
                        dateOfBirth: '',
                        address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }
                    };
                });
            }

            // Ak sa mení počet mužov v RT, aktualizujeme menTeamMemberDetails
            if (field === 'menTeamMembers') {
                const newCount = parseInt(newValue, 10) || 0;
                const oldDetails = newDetails[categoryName][teamIndex].menTeamMemberDetails || [];
                
                newDetails[categoryName][teamIndex].menTeamMemberDetails = Array.from({ length: newCount }, (_, i) => {
                    if (i < oldDetails.length) {
                        return oldDetails[i];
                    }
                    return {
                        firstName: '',
                        lastName: '',
                        dateOfBirth: '',
                        address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }
                    };
                });
            }

            return newDetails;
        });
    };

    // Spracovanie zmeny veľkosti trička
    const handleTshirtSizeChange = (categoryName, teamIndex, tshirtIndex, value) => {
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = JSON.parse(JSON.stringify(prevDetails));
            const team = newDetails[categoryName][teamIndex];
            if (team.tshirts[tshirtIndex]) {
                team.tshirts[tshirtIndex].size = value;
            }
            return newDetails;
        });
    };

    // Spracovanie zmeny množstva trička
    const handleTshirtQuantityChange = (categoryName, teamIndex, tshirtIndex, value) => {
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = JSON.parse(JSON.stringify(prevDetails));
            const team = newDetails[categoryName][teamIndex];
            let parsedQuantity = parseInt(value, 10);
            if (isNaN(parsedQuantity) || value === '') {
                team.tshirts[tshirtIndex].quantity = '';
            } else {
                team.tshirts[tshirtIndex].quantity = Math.max(0, parsedQuantity);
            }
            return newDetails;
        });
    };

    // Pridanie nového riadku pre tričko
    const handleAddTshirtRow = (categoryName, teamIndex) => {
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = JSON.parse(JSON.stringify(prevDetails));
            const team = newDetails[categoryName][teamIndex];
            team.tshirts = [...team.tshirts, { size: '', quantity: '' }];
            return newDetails;
        });
    };

    // Odstránenie riadku pre tričko
    const handleRemoveTshirtRow = (categoryName, teamIndex, tshirtIndexToRemove) => {
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = JSON.parse(JSON.stringify(prevDetails));
            const team = newDetails[categoryName][teamIndex];
            team.tshirts = team.tshirts.filter((_, idx) => idx !== tshirtIndexToRemove);
            if (team.tshirts.length === 0) {
                team.tshirts.push({ size: '', quantity: '' });
            }
            return newDetails;
        });
    };

    // Získanie dostupných veľkostí tričiek
    const getAvailableTshirtSizeOptions = (teamTshirts, currentIndex = -1) => {
        const selectedSizesInOtherRows = Array.isArray(teamTshirts)
            ? teamTshirts.filter((tshirt, idx) => idx !== currentIndex && tshirt.size !== '').map(tshirt => tshirt.size)
            : [];

        return tshirtSizes.filter(size => !selectedSizesInOtherRows.includes(size));
    };

    // Validácia celého formulára pre stránku 4
    const isFormValidPage4 = React.useMemo(() => {
        if (!teamsDataFromPage4 || Object.keys(teamsDataFromPage4).length === 0) {
            return false;
        }

        let allTshirtsMatch = true;
        let allTeamMembersFilled = true;

        for (const categoryName in teamsDataFromPage4) {
            if (categoryName === 'globalNote') continue;

            const currentCategoryLimit = categoryLimits[categoryName] || { maxPlayers: 12, maxTeamMembers: 3 };
            const teamsInCategory = Array.isArray(teamsDataFromPage4[categoryName])
                ? teamsDataFromPage4[categoryName]
                : [];

            for (const team of teamsInCategory.filter(t => t)) {
                if (!team || typeof team.teamName !== 'string' || !team.teamName.trim()) {
                    return false;
                }
                
                const playersValue = parseInt(team.players, 10);
                if (isNaN(playersValue) || playersValue < 1 || playersValue > currentCategoryLimit.maxPlayers) {
                    return false;
                }

                const womenTeamMembersValue = parseInt(team.womenTeamMembers, 10) || 0;
                const menTeamMembersValue = parseInt(team.menTeamMembers, 10) || 0;

                if (womenTeamMembersValue < 0 || menTeamMembersValue < 0) return false;

                if ((womenTeamMembersValue + menTeamMembersValue) > currentCategoryLimit.maxTeamMembers) {
                    return false;
                }

                if (womenTeamMembersValue === 0 && menTeamMembersValue === 0) {
                    allTeamMembersFilled = false;
                }

                for (const tshirt of (Array.isArray(team.tshirts) ? team.tshirts : [])) {
                    if (tshirt.size === '' || isNaN(parseInt(tshirt.quantity, 10)) || parseInt(tshirt.quantity, 10) < 0) {
                        return false;
                    }
                }

                const teamRequiredTshirts = (isNaN(parseInt(team.players, 10)) ? 0 : parseInt(team.players, 10)) + 
                                            (isNaN(parseInt(team.womenTeamMembers, 10)) ? 0 : parseInt(team.womenTeamMembers, 10)) +
                                            (isNaN(parseInt(team.menTeamMembers, 10)) ? 0 : parseInt(team.menTeamMembers, 10));
                
                let teamOrderedTshirts = 0;
                for (const tshirt of (Array.isArray(team.tshirts) ? team.tshirts : [])) {
                    teamOrderedTshirts += (isNaN(parseInt(tshirt.quantity, 10)) ? 0 : parseInt(tshirt.quantity, 10));
                }

                if (teamRequiredTshirts !== teamOrderedTshirts) {
                    allTshirtsMatch = false;
                }
            }
        }
        return allTshirtsMatch && allTeamMembersFilled;
    }, [teamsDataFromPage4, categoryLimits]);

    // CSS triedy pre tlačidlo "Ďalej"
    const nextButtonClasses = `
        font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
        ${loading || !isRecaptchaReady || !isFormValidPage4
            ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-700 text-white'
        }
    `;

    // Funkcia pre prechod na Page5
    const handleNextPage4ToPage5 = async (e) => {
        e.preventDefault();
        
        if (typeof setLoading === 'function') setLoading(true);
        if (typeof setShowNotification === 'function') setShowNotification(false);
        if (typeof setNotificationType === 'function') setNotificationType('info');

        if (!isFormValidPage4) {
            if (typeof setNotificationMessage === 'function') {
                setNotificationMessage('Prosím, skontrolujte všetky polia tímu a objednávky tričiek. Uistite sa, že pre každý tím je vyplnený aspoň jeden člen realizačného tímu.');
                setShowNotification(true);
                setNotificationType('error');
            }
            if (typeof setLoading === 'function') setLoading(false);
            return;
        }
        
        // Príprava dát pred odoslaním
        const teamsDataToSaveFinal = JSON.parse(JSON.stringify(teamsDataFromPage4)); 
        for (const categoryName in teamsDataToSaveFinal) {
            if (categoryName === 'globalNote') continue;

            const currentTeamsInCategory = Array.isArray(teamsDataToSaveFinal[categoryName]) ? teamsDataToSaveFinal[categoryName] : [];
            teamsDataToSaveFinal[categoryName] = currentTeamsInCategory.map(team => ({
                ...team,
                players: team.players === '' ? 0 : team.players,
                womenTeamMembers: team.womenTeamMembers === '' ? 0 : team.womenTeamMembers,
                menTeamMembers: team.menTeamMembers === '' ? 0 : team.menTeamMembers,
                tshirts: Array.isArray(team.tshirts) ? team.tshirts.map(tshirt => ({
                    ...tshirt,
                    quantity: tshirt.quantity === '' ? 0 : tshirt.quantity
                })) : [],
                // Uistíme sa, že všetky polia pre detaily existujú
                playerDetails: team.playerDetails || [],
                womenTeamMemberDetails: team.womenTeamMemberDetails || [],
                menTeamMemberDetails: team.menTeamMemberDetails || [],
                driverDetailsMale: team.driverDetailsMale || [],
                driverDetailsFemale: team.driverDetailsFemale || []
            }));
        }

        await handleNextPage4(teamsDataToSaveFinal);
        if (typeof setLoading === 'function') setLoading(false);
    };

    // Zvyšok komponentu (JSX) ostáva rovnaký...
    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: "error" }),

        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
            'Registrácia - strana 4'
        ),
        React.createElement(
            'form',
            { onSubmit: handleNextPage4ToPage5, className: 'space-y-4' },
            Object.keys(teamsDataFromPage4).length === 0 ? (
                React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Prejdite prosím na predchádzajúcu stránku a vyberte kategórie s počtom tímov.')
            ) : (
                Object.keys(teamsDataFromPage4)
                    .filter(categoryName => categoryName !== 'globalNote')
                    .map(categoryName => {
                    const currentCategoryLimit = categoryLimits[categoryName] || { maxPlayers: 12, maxTeamMembers: 3 };
                    return React.createElement(
                        'div',
                        { key: categoryName, className: 'border-t border-gray-200 pt-4 mt-4' },
                        React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, `Kategória: ${categoryName}`),
                        (Array.isArray(teamsDataFromPage4[categoryName]) ? teamsDataFromPage4[categoryName] : []).filter(t => t).map((team, teamIndex) => {
                            const teamRequiredTshirts = (isNaN(parseInt(team.players, 10)) ? 0 : parseInt(team.players, 10)) + 
                                                        (isNaN(parseInt(team.womenTeamMembers, 10)) ? 0 : parseInt(team.womenTeamMembers, 10)) +
                                                        (isNaN(parseInt(team.menTeamMembers, 10)) ? 0 : parseInt(team.menTeamMembers, 10));
                            
                            let teamOrderedTshirts = 0;
                            for (const tshirt of (Array.isArray(team.tshirts) ? team.tshirts : [])) {
                                teamOrderedTshirts += (isNaN(parseInt(tshirt.quantity, 10)) ? 0 : parseInt(tshirt.quantity, 10));
                            }
                            const teamTshirtDifference = teamRequiredTshirts - teamOrderedTshirts;

                            const isTshirtInputEnabled = 
                                (parseInt(team.players, 10) > 0) || 
                                (parseInt(team.womenTeamMembers, 10) > 0) || 
                                (parseInt(team.menTeamMembers, 10) > 0);

                            const currentWomenTeamMembers = parseInt(team.womenTeamMembers, 10) || 0;
                            const currentMenTeamMembers = parseInt(team.menTeamMembers, 10) || 0;
                            const isTeamMembersTotalOverLimit = 
                                (currentWomenTeamMembers + currentMenTeamMembers) > currentCategoryLimit.maxTeamMembers;

                            const isTshirtSectionDisabled = loading || !isTshirtInputEnabled || isTeamMembersTotalOverLimit;

                            return React.createElement(
                                'div',
                                { key: `${categoryName}-${teamIndex}`, className: 'bg-blue-50 p-4 rounded-lg mb-4 space-y-2' },
                                React.createElement('p', { className: 'font-semibold text-blue-800' }, `Tím ${teamIndex + 1}`),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `teamName-${categoryName}-${teamIndex}` }, 'Názov tímu'),
                                    React.createElement('p', {
                                        id: `teamName-${categoryName}-${teamIndex}`,
                                        className: 'text-gray-700 py-2 px-3 break-words',
                                        style: { cursor: 'default' },
                                    }, team.teamName)
                                ),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `players-${categoryName}-${teamIndex}` }, `Počet hráčov (max: ${currentCategoryLimit.maxPlayers})`),
                                    React.createElement('input', {
                                        type: 'number',
                                        id: `players-${categoryName}-${teamIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: team.players,
                                        onChange: (e) => handleTeamDetailChange(categoryName, teamIndex, 'players', e.target.value),
                                        placeholder: 'Zadajte počet hráčov',
                                        disabled: loading,
                                    })
                                ),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `womenTeamMembers-${categoryName}-${teamIndex}` }, `Počet žien realizačného tímu`),
                                    React.createElement('input', {
                                        type: 'number',
                                        id: `womenTeamMembers-${categoryName}-${teamIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: team.womenTeamMembers === 0 ? 0 : team.womenTeamMembers || '', 
                                        onChange: (e) => handleTeamDetailChange(categoryName, teamIndex, 'womenTeamMembers', e.target.value),
                                        placeholder: 'Zadajte počet žien',
                                        min: 0, 
                                        disabled: loading,
                                    })
                                ),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `menTeamMembers-${categoryName}-${teamIndex}` }, `Počet mužov realizačného tímu`),
                                    React.createElement('input', {
                                        type: 'number',
                                        id: `menTeamMembers-${categoryName}-${teamIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: team.menTeamMembers === 0 ? 0 : team.menTeamMembers || '', 
                                        onChange: (e) => handleTeamDetailChange(categoryName, teamIndex, 'menTeamMembers', e.target.value),
                                        placeholder: 'Zadajte počet mužov',
                                        min: 0, 
                                        disabled: loading,
                                    }),
                                    React.createElement('p', { className: 'text-sm text-gray-600 mt-1' }, `Maximálny počet členov realizačného tímu je ${currentCategoryLimit.maxTeamMembers}.`)
                                ),
                                
                                React.createElement(
                                    'div',
                                    { className: 'border-t border-gray-200 pt-4 mt-4' },
                                    React.createElement('h4', { className: 'text-base font-bold mb-2 text-gray-700' }, 'Účastnícke tričká'),
                                    React.createElement('p', { className: 'text-sm text-gray-600 mb-4' }, 'Všetky sú unisex.'),
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center font-bold mb-2 space-x-2' },
                                        React.createElement('span', { className: 'w-1/3 text-gray-700' }, 'Veľkosť'), 
                                        React.createElement('span', { className: 'w-1/2 text-left text-gray-700' }, 'Počet'), 
                                        React.createElement('span', { className: 'w-8' })
                                    ),
                                    (Array.isArray(team.tshirts) ? team.tshirts : [{ size: '', quantity: '' }]).map((tshirt, tshirtIndex) => (
                                        React.createElement(
                                            'div',
                                            { key: tshirtIndex, className: 'flex items-center space-x-2 mb-2' },
                                            React.createElement(
                                                'select',
                                                {
                                                    className: `shadow border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-1/3 ${isTshirtSectionDisabled ? 'cursor-not-allowed' : ''}`, 
                                                    value: tshirt.size,
                                                    onChange: (e) => handleTshirtSizeChange(categoryName, teamIndex, tshirtIndex, e.target.value),
                                                    required: true,
                                                    disabled: isTshirtSectionDisabled, 
                                                },
                                                React.createElement('option', { value: '' }, 'Vyberte'), 
                                                getAvailableTshirtSizeOptions(team.tshirts, tshirtIndex).map(size => (
                                                    React.createElement('option', { key: size, value: size }, size)
                                                ))
                                            ),
                                            React.createElement('input', {
                                                type: 'number',
                                                className: `shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-1/2 text-left ${isTshirtSectionDisabled ? 'cursor-not-allowed' : ''}`, 
                                                value: tshirt.quantity,
                                                onChange: (e) => handleTshirtQuantityChange(categoryName, teamIndex, tshirtIndex, e.target.value),
                                                min: 0,
                                                required: true,
                                                disabled: isTshirtSectionDisabled, 
                                                placeholder: 'Zadajte počet', 
                                            }),
                                            React.createElement(
                                                'button',
                                                {
                                                    type: 'button',
                                                    onClick: () => handleRemoveTshirtRow(categoryName, teamIndex, tshirtIndex),
                                                    className: `bg-red-500 hover:bg-red-700 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 focus:outline-none focus:shadow-outline ${team.tshirts.length === 1 ? 'invisible' : ''} ${isTshirtSectionDisabled ? 'cursor-not-allowed' : ''}`,
                                                    disabled: isTshirtSectionDisabled || team.tshirts.length === 1,
                                                },
                                                '-'
                                            )
                                        )
                                    )),
                                    getAvailableTshirtSizeOptions(Array.isArray(team.tshirts) ? team.tshirts : []).length > 0 && React.createElement(
                                        'button',
                                        {
                                            type: 'button',
                                            onClick: () => handleAddTshirtRow(categoryName, teamIndex),
                                            className: `
                                                font-bold w-10 h-10 rounded-full flex items-center justify-center mx-auto mt-4 
                                                transition-colors duration-200 focus:outline-none focus:shadow-outline
                                                ${isTshirtSectionDisabled || (Array.isArray(team.tshirts) && team.tshirts.some(t => t.size === '' || t.quantity === '' || isNaN(parseInt(t.quantity, 10)))) || getAvailableTshirtSizeOptions(Array.isArray(team.tshirts) ? team.tshirts : []).length === 0
                                                    ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
                                                    : 'bg-blue-500 hover:bg-blue-700 text-white'
                                                }
                                            `.trim(),
                                            disabled: isTshirtSectionDisabled || (Array.isArray(team.tshirts) && team.tshirts.some(t => t.size === '' || t.quantity === '' || isNaN(parseInt(t.quantity, 10)))) || getAvailableTshirtSizeOptions(Array.isArray(team.tshirts) ? team.tshirts : []).length === 0,
                                        },
                                        '+'
                                    )
                                ),
                                (isTeamMembersTotalOverLimit || teamTshirtDifference !== 0) && React.createElement(
                                    'div',
                                    { className: `mt-2 p-2 rounded-lg text-center bg-red-100 text-red-700` },
                                    (() => {
                                        if (isTeamMembersTotalOverLimit) {
                                            return [
                                                React.createElement('strong', { key: 'prefix_bold' }, 'Na pokračovanie'),
                                                React.createElement('span', { key: 'middle_normal' }, ' v registrácii na turnaj '),
                                                React.createElement('strong', { key: 'suffix_bold' }, 'je\u00A0potrebné znížiť počet členov realizačného tímu.')
                                            ];
                                        }
                                        if (teamTshirtDifference !== 0) {
                                            const absDiff = Math.abs(teamTshirtDifference);
                                            let actionText = teamTshirtDifference > 0 ? 'objednať ešte' : 'zrušiť';
                                            let countText;
                                            if (absDiff === 1) {
                                                countText = `${absDiff} tričko.`;
                                            } else if (absDiff >= 2 && absDiff <= 4) {
                                                countText = `${absDiff} tričká.`;
                                            } else {
                                                countText = `${absDiff} tričiek.`;
                                            }
                                            return [
                                                React.createElement('strong', { key: 'prefix_bold_tshirt' }, 'Na pokračovanie'),
                                                React.createElement('span', { key: 'middle_normal_tshirt' }, ' v registrácii na turnaj '),
                                                React.createElement('strong', { key: 'is_needed_tshirt' }, 'je\u00A0potrebné'),
                                                React.createElement('span', { key: 'category_team_normal_tshirt' }, ` v kategórii ${categoryName} pre tím ${team.teamName} `),
                                                React.createElement('strong', { key: 'action_count_bold_tshirt' }, `${actionText} ${countText}`)
                                            ];
                                        }
                                        return null;
                                    })()
                                )
                            );
                        })
                    );
                })
            ),

            React.createElement(
                'div',
                { className: 'flex justify-between mt-6' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: () => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4: teamsDataFromPage4 }), 
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

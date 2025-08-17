import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Komponent pre prepínač (Toggle Switch)
function ToggleSwitch({ isOn, handleToggle, disabled }) {
    const bgColorClass = isOn ? 'bg-green-500' : 'bg-red-500';
    const togglePositionClass = isOn ? 'translate-x-full' : 'translate-x-0';

    return React.createElement(
        'div',
        {
            className: `relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out cursor-pointer ${bgColorClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`,
            onClick: disabled ? null : handleToggle,
            style: { boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' } // Vnútorný tieň pre efekt "zatlačenia"
        },
        React.createElement(
            'span',
            {
                className: `inline-block w-5 h-5 transform bg-white rounded-full shadow-lg ring-0 transition-transform duration-200 ease-in-out ${togglePositionClass}`,
                style: { boxShadow: '0 2px 5px rgba(0,0,0,0.2)' } // Tieň pre gombík prepínača
            }
        )
    );
}


// Obsahuje komponent pre zadávanie detailov hráčov a členov realizačného tímu pre každý tím.

export function Page6Form({ formData, handlePrev, handleSubmit, loading, teamsDataFromPage4, NotificationModal, notificationMessage, closeNotification, numberOfPlayersLimit, numberOfTeamMembersLimit, dataEditDeadline, setNotificationMessage, setNotificationType }) {

    const [localTeamDetails, setLocalTeamDetails] = React.useState({});
    // Nový stav pre chyby hráčov
    const [playerErrors, setPlayerErrors] = React.useState({}); // { [categoryName]: { [teamIndex]: { [playerIndex]: { jerseyNumber: 'error', combination: 'error', registrationNumber: 'error' } } } }

    // Helper pre notifikácie
    const dispatchAppNotification = React.useCallback((message, type = 'info') => {
        setNotificationMessage(message);
        setNotificationType(type);
    }, [setNotificationMessage, setNotificationType]);


    React.useEffect(() => {
        const initialDetails = {};
        for (const categoryName in teamsDataFromPage4) {
            initialDetails[categoryName] = (teamsDataFromPage4[categoryName] || []).map(team => {
                const playersCount = parseInt(team.players, 10) || 0;
                const womenMembersCount = parseInt(team.womenTeamMembers, 10) || 0;
                const menMembersCount = parseInt(team.menTeamMembers, 10) || 0;

                // Ensure playerDetails are correctly structured, merging existing data
                const playerDetails = Array.from({ length: playersCount }).map((_, i) => {
                    const existingPlayer = team.playerDetails?.[i] || {};
                    return {
                        jerseyNumber: '',
                        firstName: '',
                        lastName: '',
                        dateOfBirth: '',
                        isRegistered: false,
                        registrationNumber: '',
                        address: { // Always ensure address object exists with default values
                            street: '',
                            houseNumber: '',
                            city: '',
                            postalCode: '',
                            country: '',
                        },
                        ...existingPlayer, // Override defaults with existing player data
                        address: { // Deep merge address to ensure all sub-fields exist
                            street: '',
                            houseNumber: '',
                            city: '',
                            postalCode: '',
                            country: '',
                            ...(existingPlayer.address || {}) // Override address defaults with existing address data (use {} if existingPlayer.address is undefined)
                        }
                    };
                });

                // Ensure team member details are correctly structured
                const womenTeamMemberDetails = Array.from({ length: womenMembersCount }).map((_, i) => {
                    const existingMember = team.womenTeamMemberDetails?.[i] || {};
                    return {
                        firstName: '',
                        lastName: '',
                        dateOfBirth: '',
                        address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }, // Inicializácia adresy
                        ...existingMember,
                        address: { ...(existingMember.address || {}) } // Deep merge address
                    };
                });

                const menTeamMemberDetails = Array.from({ length: menMembersCount }).map((_, i) => {
                    const existingMember = team.menTeamMemberDetails?.[i] || {};
                    return {
                        firstName: '',
                        lastName: '',
                        dateOfBirth: '',
                        address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }, // Inicializácia adresy
                        ...existingMember,
                        address: { ...(existingMember.address || {}) } // Deep merge address
                    };
                });

                return {
                    ...team, // Spread all existing properties from the original team object
                    players: playersCount, // Ensure counts are numbers
                    womenTeamMembers: womenMembersCount,
                    menTeamMembers: menMembersCount,
                    playerDetails: playerDetails,
                    womenTeamMemberDetails: womenTeamMemberDetails,
                    menTeamMemberDetails: menTeamMemberDetails,
                    // Zabezpečenie, aby accommodation bol vždy objekt s type property
                    accommodation: {
                        type: team.accommodation?.type || '', // Inicializuj type z existujúceho, alebo na prázdny reťazec
                        ...(team.accommodation || {}) // Rozšír ostatné potenciálne properties ubytovania
                    }
                };
            });
        }
        setLocalTeamDetails(initialDetails);
    }, [teamsDataFromPage4]);


    const validateTeamPlayers = React.useCallback((currentTeamPlayers, categoryName, teamIndex) => {
        const newPlayerErrorsForTeam = {}; // Chyby pre aktuálny tím
        let teamHasErrors = false;

        // Validácia čísla dresu
        const jerseyNumbers = new Set();
        const jerseyNumberErrors = new Set(); // Sleduje čísla dresov, ktoré už vyvolali chybu
        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            const jersey = player.jerseyNumber.trim();

            if (jersey !== '') {
                if (jerseyNumbers.has(jersey)) {
                    jerseyNumberErrors.add(jersey); // Označ duplicitné číslo dresu
                    teamHasErrors = true;
                } else {
                    jerseyNumbers.add(jersey);
                }
            }
        }

        // Nastav chybové správy pre čísla dresu
        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            if (jerseyNumberErrors.has(player.jerseyNumber.trim())) {
                if (!newPlayerErrorsForTeam[i]) newPlayerErrorsForTeam[i] = {};
                newPlayerErrorsForTeam[i].jerseyNumber = 'Duplicitné číslo dresu v tíme.';
            }
        }


        // Validácia kombinácie údajov hráča
        const playerCombinations = new Set();
        const combinationErrors = new Set(); // Sleduje kombinácie, ktoré už vyvolali chybu
        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            const firstName = player.firstName.trim().toLowerCase();
            const lastName = player.lastName.trim().toLowerCase();
            const dateOfBirth = player.dateOfBirth.trim();
            const registrationNumber = player.registrationNumber.trim().toLowerCase();

            // Ak sú všetky kľúčové polia prázdne, ignoruj pre kontrolu duplicít
            if (firstName === '' && lastName === '' && dateOfBirth === '' && registrationNumber === '') {
                continue;
            }

            let combinationKey;
            if (player.isRegistered && registrationNumber !== '') {
                // Registrovaný hráč s číslom registrácie
                combinationKey = `${firstName}-${lastName}-${dateOfBirth}-${registrationNumber}`;
            } else {
                // Neregistrovaný hráč alebo registrovaný bez čísla registrácie
                combinationKey = `${firstName}-${lastName}-${dateOfBirth}`;
            }

            if (playerCombinations.has(combinationKey)) {
                combinationErrors.add(combinationKey); // Označ duplicitnú kombináciu
                teamHasErrors = true;
            } else {
                playerCombinations.add(combinationKey);
            }
        }

        // Validácia duplicitného registračného čísla
        const registeredNumbers = new Set();
        const registeredNumberErrors = new Set();
        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            const regNum = player.registrationNumber.trim();
            if (player.isRegistered && regNum !== '') {
                if (registeredNumbers.has(regNum)) {
                    registeredNumberErrors.add(regNum);
                    teamHasErrors = true;
                } else {
                    registeredNumbers.add(regNum);
                }
            }
        }


        // Nastav chybové správy pre kombinácie údajov hráča
        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            const firstName = player.firstName.trim().toLowerCase();
            const lastName = player.lastName.trim().toLowerCase();
            const dateOfBirth = player.dateOfBirth.trim();
            const registrationNumber = player.registrationNumber.trim().toLowerCase();

            if (firstName === '' && lastName === '' && dateOfBirth === '' && registrationNumber === '') {
                 continue; // Preskoč prázdne záznamy
            }

            let combinationKey;
            if (player.isRegistered && registrationNumber !== '') {
                combinationKey = `${firstName}-${lastName}-${dateOfBirth}-${registrationNumber}`;
            } else {
                combinationKey = `${firstName}-${lastName}-${dateOfBirth}`;
            }

            if (combinationErrors.has(combinationKey)) {
                if (!newPlayerErrorsForTeam[i]) newPlayerErrorsForTeam[i] = {};
                newPlayerErrorsForTeam[i].combination = 'Duplicitný hráč v tíme.';
            }

            // Nastav chybovú správu pre duplicitné registračné číslo
            if (player.isRegistered && registeredNumberErrors.has(player.registrationNumber.trim())) {
                if (!newPlayerErrorsForTeam[i]) newPlayerErrorsForTeam[i] = {};
                newPlayerErrorsForTeam[i].registrationNumber = 'Duplicitné číslo registrácie v tíme.';
            }
        }

        // Aktualizuj globálny stav chýb
        setPlayerErrors(prevPlayerErrors => ({
            ...prevPlayerErrors,
            [categoryName]: {
                ...(prevPlayerErrors[categoryName] || {}),
                [teamIndex]: newPlayerErrorsForTeam
            }
        }));

        return teamHasErrors; // Vráti, či boli nájdené chyby v tíme
    }, []); // Bez závislostí, aby sa funkcia re-renderovala len pri zmene chybových stavov.

    const handlePlayerDetailChange = (categoryName, teamIndex, playerIndex, field, value) => {
        setLocalTeamDetails(prevDetails => {
            const newDetails = JSON.parse(JSON.stringify(prevDetails)); // Deep copy pre bezpečnú mutáciu
            // Zabezpečenie inicializácie hráča a jeho adresy, ak neexistujú
            if (!newDetails[categoryName]?.[teamIndex]?.playerDetails?.[playerIndex]) {
                if (!newDetails[categoryName][teamIndex].playerDetails) {
                    newDetails[categoryName][teamIndex].playerDetails = [];
                }
                newDetails[categoryName][teamIndex].playerDetails[playerIndex] = {
                    jerseyNumber: '', firstName: '', lastName: '', dateOfBirth: '', isRegistered: false, registrationNumber: '',
                    address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }
                };
            }
            const playerToUpdate = newDetails[categoryName][teamIndex].playerDetails[playerIndex];

            if (field === 'isRegistered') {
                playerToUpdate.isRegistered = value;
                // Keď sa prepínač vypne, vymaž registračné číslo
                if (!value) {
                    playerToUpdate.registrationNumber = '';
                }
            } else if (field.startsWith('address.')) {
                const addressField = field.substring('address.'.length);
                if (!playerToUpdate.address) { // Zabezpečenie inicializácie objektu adresy
                    playerToUpdate.address = { street: '', houseNumber: '', city: '', postalCode: '', country: '' };
                }

                if (addressField === 'postalCode') {
                    let rawValue = value.replace(/[^0-9]/g, ''); // Ponechaj iba číslice
                    let formattedValue = rawValue;

                    if (rawValue.length > 5) { // Obmedz na maximálne 5 číslic
                        rawValue = rawValue.substring(0, 5);
                    }

                    if (rawValue.length > 3) {
                        // Aplikuj formát "xxx xx"
                        formattedValue = rawValue.substring(0, 3) + ' ' + rawValue.substring(3, 5);
                    }
                    playerToUpdate.address[addressField] = formattedValue;
                } else {
                    playerToUpdate.address[addressField] = value;
                }
            }
            else {
                playerToUpdate[field] = value;
            }

            // Spusti validáciu pre aktuálny tím
            const teamHasErrors = validateTeamPlayers(newDetails[categoryName][teamIndex].playerDetails, categoryName, teamIndex);

            if (teamHasErrors) {
                dispatchAppNotification('V tíme boli nájdené duplicitné údaje. Prosím, skontrolujte chyby.', 'error');
            } else {
                // Notifikácia sa vyčistí po 10 sekundách, takže tu nemusíme explicitne čistiť,
                // pokiaľ neboli žiadne chyby predchádzajúci raz
                if (notificationMessage === 'V tíme boli nájdené duplicitné údaje. Prosím, skontrolujte chyby.') {
                    dispatchAppNotification('', 'info'); // Vymaž špecifickú notifikáciu
                }
            }
            return newDetails;
        });
    };

    const handleTeamMemberDetailChange = (categoryName, teamIndex, memberIndex, type, field, value) => {
        setLocalTeamDetails(prevDetails => {
            const newDetails = JSON.parse(JSON.stringify(prevDetails)); // Deep copy pre bezpečnú mutáciu
            const detailArrayName = `${type}TeamMemberDetails`;
            const memberToUpdate = newDetails[categoryName][teamIndex][detailArrayName][memberIndex];

            // Zabezpečenie inicializácie adresy
            if (!memberToUpdate.address) {
                memberToUpdate.address = { street: '', houseNumber: '', city: '', postalCode: '', country: '' };
            }

            if (field.startsWith('address.')) {
                const addressField = field.substring('address.'.length);
                if (addressField === 'postalCode') {
                    let rawValue = value.replace(/[^0-9]/g, ''); // Ponechaj iba číslice
                    let formattedValue = rawValue;

                    if (rawValue.length > 5) { // Obmedz na maximálne 5 číslic
                        rawValue = rawValue.substring(0, 5);
                    }

                    if (rawValue.length > 3) {
                        // Aplikuj formát "xxx xx"
                        formattedValue = rawValue.substring(0, 3) + ' ' + rawValue.substring(3, 5);
                    }
                    memberToUpdate.address[addressField] = formattedValue;
                } else {
                    memberToUpdate.address[addressField] = value;
                }
            } else {
                memberToUpdate[field] = value;
            }
            return newDetails;
        });
    };

    // Všetky polia sú teraz nepovinné, takže formulár je vždy "platný" na postup
    const isFormValidPage6 = React.useMemo(() => {
        // Skontroluj, či sú nejaké chyby v playerErrors, ak sú, formulár nie je "validný" pre pokračovanie
        for (const categoryName in playerErrors) {
            for (const teamIndex in playerErrors[categoryName]) {
                for (const playerIndex in playerErrors[categoryName][teamIndex]) {
                    if (playerErrors[categoryName][teamIndex][playerIndex].jerseyNumber || playerErrors[categoryName][teamIndex][playerIndex].combination || playerErrors[categoryName][teamIndex][playerIndex].registrationNumber) {
                        return false;
                    }
                }
            }
        }
        return true; // Vráti true, ak neexistujú žiadne duplicitné chyby
    }, [playerErrors]);

    const nextButtonClasses = `
        font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
        ${loading || !isFormValidPage6 // Tlačidlo je zakázané, ak je loading alebo sú duplicitné chyby
            ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-700 text-white'
        }
    `;

    const handlePage6Submit = (e) => {
        e.preventDefault();

        // Dodatočná kontrola validácie pred odoslaním, ak by niekto obišiel okamžitú validáciu
        // Hoci tlačidlo je zakázané, je dobré mať túto kontrolu aj tu
        if (!isFormValidPage6) {
            dispatchAppNotification('Opravte prosím duplicitné údaje hráčov pred pokračovaním.', 'error');
            return;
        }

        const finalTeamsData = JSON.parse(JSON.stringify(teamsDataFromPage4));

        for (const categoryName in localTeamDetails) {
            (localTeamDetails[categoryName] || []).forEach((localTeam, teamIndex) => {
                if (finalTeamsData[categoryName] && finalTeamsData[categoryName][teamIndex]) {
                    finalTeamsData[categoryName][teamIndex].playerDetails = localTeam.playerDetails;
                    finalTeamsData[categoryName][teamIndex].womenTeamMemberDetails = localTeam.womenTeamMemberDetails;
                    finalTeamsData[categoryName][teamIndex].menTeamMemberDetails = localTeam.menTeamMemberDetails;
                }
            });
        }
        handleSubmit(finalTeamsData);
    };


    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: 'info' }),

        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-2 text-center text-gray-800' },
            'Registrácia - strana 6: Detaily tímu'
        ),
        React.createElement(
            'p',
            { className: 'text-center text-sm text-gray-600 mb-6 px-4' },
            'Všetky údaje na tejto strane sú nepovinné pre registráciu tímu, ',
            React.createElement('strong', null, 'ale je povinné ich vyplniť v sekcii "Moja zóna"'),
            ' po prihlásení sa do svojho turnajového účtu do dátumu ',
            React.createElement('strong', null, dataEditDeadline || 'nezadaný dátum'),
            '.'
        ),

        React.createElement(
            'form',
            { onSubmit: handlePage6Submit, className: 'space-y-4' },
            Object.keys(localTeamDetails).length === 0 ? (
                React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Prejdite prosím na predchádzajúce stránky a zadajte tímy.')
            ) : (
                Object.keys(localTeamDetails).map(categoryName => (
                    React.createElement(
                        'div',
                        { key: categoryName, className: 'border-t border-gray-200 pt-4 mt-4' },
                        React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, `Kategória: ${categoryName}`),
                        (localTeamDetails[categoryName] || []).map((team, teamIndex) => {
                            const playersCount = parseInt(team.players, 10) || 0;
                            const womenMembersCount = parseInt(team.womenTeamMembers, 10) || 0;
                            const menMembersCount = parseInt(team.menTeamMembers, 10) || 0;

                            // URČENIE, ČI TÍM MÁ VYBRANÉ UBYTOVANIE (INÉ AKO "BEZ UBYTOVANIA")
                            // Použi toLowerCase() pre case-insensitive porovnanie a ošetri prázdne reťazce
                            const hasAccommodation = team.accommodation && team.accommodation.type && team.accommodation.type.toLowerCase() !== 'bez ubytovania';


                            // Debugging logs - Pomôžu ti pochopiť stav dát
                            console.log(`Page6Form - Processing Team: ${team.teamName}`);
                            console.log(`  Accommodation Object:`, team.accommodation);
                            console.log(`  Accommodation Type:`, team.accommodation?.type);
                            console.log(`  Has Accommodation (boolean):`, hasAccommodation);


                            return React.createElement(
                                'div',
                                { key: `${categoryName}-${teamIndex}`, className: 'bg-blue-50 p-4 rounded-lg mb-4 space-y-2' },
                                React.createElement('p', { className: 'font-semibold text-blue-800 mb-4' }, `Tím: ${team.teamName}`),

                                playersCount > 0 && React.createElement(
                                    'div',
                                    null,
                                    React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700' }, 'Detaily hráčov'),
                                    Array.from({ length: playersCount }).map((_, playerIndex) => {
                                        const player = team.playerDetails?.[playerIndex] || {};
                                        const playerSpecificErrors = playerErrors?.[categoryName]?.[teamIndex]?.[playerIndex] || {};

                                        return React.createElement('div', { key: `player-input-${categoryName}-${teamIndex}-${playerIndex}`, className: 'mb-4 p-3 bg-gray-100 rounded-md shadow-sm' },
                                            React.createElement('p', { className: 'font-medium text-gray-800 mb-2' }, `Hráč ${playerIndex + 1}`),
                                            React.createElement('div', { className: 'flex flex-wrap items-end gap-x-4 gap-y-2' },
                                                React.createElement('div', { className: 'w-24' },
                                                    React.createElement('label', { htmlFor: `jerseyNumber-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Dres'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `jerseyNumber-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.jerseyNumber ? 'border-red-500' : ''}`,
                                                        value: player.jerseyNumber || '',
                                                        onChange: (e) => {
                                                            const value = e.target.value.replace(/[^0-9]/g, '');
                                                            handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'jerseyNumber', value);
                                                        },
                                                        disabled: loading,
                                                        placeholder: 'Číslo'
                                                    }),
                                                    // Placeholder pre chybu dresu
                                                    playerSpecificErrors.jerseyNumber ?
                                                        React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, playerSpecificErrors.jerseyNumber) :
                                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0') // Invisible placeholder for consistent spacing
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('label', { htmlFor: `firstName-player-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Meno'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `firstName-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.combination ? 'border-red-500' : ''}`,
                                                        value: player.firstName || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'firstName', e.target.value),
                                                        disabled: loading,
                                                        placeholder: 'Meno hráča'
                                                    }),
                                                    // Placeholder pre chybu kombinácie
                                                    playerSpecificErrors.combination ?
                                                        React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, playerSpecificErrors.combination) :
                                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0') // Invisible placeholder
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('label', { htmlFor: `lastName-player-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Priezvisko'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `lastName-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.combination ? 'border-red-500' : ''}`,
                                                        value: player.lastName || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'lastName', e.target.value),
                                                        disabled: loading,
                                                        placeholder: 'Priezvisko hráča'
                                                    }),
                                                    // Placeholder pre chybu kombinácie
                                                    React.createElement('p', { className: `text-red-500 text-xs italic mt-1 ${playerSpecificErrors.combination ? '' : 'opacity-0'}` }, playerSpecificErrors.combination || '\u00A0')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[150px]' },
                                                    React.createElement('label', { htmlFor: `dateOfBirth-player-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Dátum narodenia'),
                                                    React.createElement('input', {
                                                        type: 'date',
                                                        id: `dateOfBirth-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.combination ? 'border-red-500' : ''}`,
                                                        value: player.dateOfBirth || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'dateOfBirth', e.target.value),
                                                        disabled: loading,
                                                    }),
                                                    // Placeholder pre chybu kombinácie
                                                    React.createElement('p', { className: `text-red-500 text-xs italic mt-1 ${playerSpecificErrors.combination ? '' : 'opacity-0'}` }, playerSpecificErrors.combination || '\u00A0')
                                                ),
                                                React.createElement('div', { className: 'flex-initial w-auto flex flex-col items-center justify-center pt-2' }, // Zarovnanie prepínača
                                                    React.createElement('label', { htmlFor: `isRegistered-player-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Registrovaný'),
                                                    React.createElement(ToggleSwitch, {
                                                        isOn: player.isRegistered || false,
                                                        handleToggle: () => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'isRegistered', !player.isRegistered),
                                                        disabled: loading,
                                                    }),
                                                    // Prázdny placeholder, ak ToggleSwitch nespôsobuje chyby
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { // Tento div drží input pre registračné číslo
                                                    className: `flex-1 min-w-[120px] transition-opacity duration-200 ${player.isRegistered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`
                                                },
                                                    React.createElement('label', { htmlFor: `registrationNumber-player-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Číslo registrácie'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `registrationNumber-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.combination || playerSpecificErrors.registrationNumber ? 'border-red-500' : ''}`, // Pridaná podmienka pre registracne cislo
                                                        value: player.registrationNumber || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'registrationNumber', e.target.value),
                                                        disabled: loading || !player.isRegistered, // Zakázané, ak nie je registrovaný
                                                        placeholder: 'Číslo'
                                                    }),
                                                    // Placeholder pre chybu kombinácie a registračné číslo
                                                    playerSpecificErrors.combination || playerSpecificErrors.registrationNumber ?
                                                        React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, playerSpecificErrors.combination || playerSpecificErrors.registrationNumber) :
                                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                            ),
                                            // Nový riadok pre adresné polia
                                            React.createElement('div', {
                                                className: `flex flex-wrap items-end gap-x-4 gap-y-2 mt-4 transition-all duration-300 ${hasAccommodation ? 'h-auto opacity-100 pointer-events-auto' : 'h-0 overflow-hidden opacity-0 pointer-events-none'}`
                                            },
                                                hasAccommodation && React.createElement('h5', { className: 'block text-gray-700 text-base font-bold mb-2 w-full mt-4' }, 'Adresa trvalého bydliska (pre účely ubytovania)'),
                                                React.createElement('div', {
                                                    className: `flex-1 min-w-[120px]`
                                                },
                                                    React.createElement('label', { htmlFor: `street-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Ulica'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `street-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: player.address?.street || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'address.street', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        placeholder: 'Ulica'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0') // Placeholder
                                                ),
                                                React.createElement('div', {
                                                    className: `w-24`
                                                },
                                                    React.createElement('label', { htmlFor: `houseNumber-addr-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Popisné číslo'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `houseNumber-addr-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: player.address?.houseNumber || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'address.houseNumber', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        placeholder: 'Číslo'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0') // Placeholder
                                                ),
                                                React.createElement('div', {
                                                    className: `flex-1 min-w-[120px]`
                                                },
                                                    React.createElement('label', { htmlFor: `city-addr-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Mesto'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `city-addr-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: player.address?.city || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'address.city', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        placeholder: 'Mesto'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0') // Placeholder
                                                ),
                                                React.createElement('div', {
                                                    className: `flex-1 min-w-[120px]`
                                                },
                                                    React.createElement('label', { htmlFor: `postalCode-addr-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'PSČ'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `postalCode-addr-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: player.address?.postalCode || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'address.postalCode', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        maxLength: 6, // "XXX XX" is 6 characters
                                                        placeholder: '000 00'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0') // Placeholder
                                                ),
                                                React.createElement('div', {
                                                    className: `flex-1 min-w-[120px]`
                                                },
                                                    React.createElement('label', { htmlFor: `country-addr-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Štát'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `country-addr-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: player.address?.country || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'address.country', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        placeholder: 'Štát'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0') // Placeholder
                                                )
                                            )
                                        );
                                    })
                                ),

                                womenMembersCount > 0 && React.createElement(
                                    'div',
                                    null,
                                    React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700 mt-4' }, 'Detaily členov realizačného tímu (ženy)'),
                                    Array.from({ length: womenMembersCount }).map((_, memberIndex) => {
                                        const member = team.womenTeamMemberDetails?.[memberIndex] || {};
                                        return React.createElement('div', { key: `woman-member-input-${categoryName}-${teamIndex}-${memberIndex}`, className: 'mb-4 p-3 bg-gray-100 rounded-md shadow-sm' },
                                            React.createElement('p', { className: 'font-medium text-gray-800 mb-2' }, `Žena ${memberIndex + 1}`),
                                            React.createElement('div', { className: 'flex flex-wrap items-end gap-x-4 gap-y-2' },
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('label', { htmlFor: `firstName-woman-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Meno'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `firstName-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.firstName || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'firstName', e.target.value),
                                                        disabled: loading,
                                                        placeholder: 'Meno členky'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('label', { htmlFor: `lastName-woman-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Priezvisko'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `lastName-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.lastName || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'lastName', e.target.value),
                                                        disabled: loading,
                                                        placeholder: 'Priezvisko členky'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[150px]' },
                                                    React.createElement('label', { htmlFor: `dateOfBirth-woman-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Dátum narodenia'),
                                                    React.createElement('input', {
                                                        type: 'date',
                                                        id: `dateOfBirth-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.dateOfBirth || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'dateOfBirth', e.target.value),
                                                        disabled: loading,
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                )
                                            ),
                                            // Nový riadok pre adresné polia pre ženy
                                            React.createElement('div', {
                                                className: `flex flex-wrap items-end gap-x-4 gap-y-2 mt-4 transition-all duration-300 ${hasAccommodation ? 'h-auto opacity-100 pointer-events-auto' : 'h-0 overflow-hidden opacity-0 pointer-events-none'}`
                                            },
                                                hasAccommodation && React.createElement('h5', { className: 'block text-gray-700 text-base font-bold mb-2 w-full mt-4' }, 'Adresa trvalého bydliska (pre účely ubytovania)'),
                                                React.createElement('div', { className: `flex-1 min-w-[120px]` },
                                                    React.createElement('label', { htmlFor: `street-woman-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Ulica'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `street-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.address?.street || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'address.street', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        placeholder: 'Ulica'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { className: `w-24` },
                                                    React.createElement('label', { htmlFor: `houseNumber-woman-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Popisné číslo'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `houseNumber-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.address?.houseNumber || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'address.houseNumber', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        placeholder: 'Číslo'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { className: `flex-1 min-w-[120px]` },
                                                    React.createElement('label', { htmlFor: `city-woman-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Mesto'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `city-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.address?.city || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'address.city', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        placeholder: 'Mesto'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { className: `flex-1 min-w-[120px]` },
                                                    React.createElement('label', { htmlFor: `postalCode-woman-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'PSČ'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `postalCode-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.address?.postalCode || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'address.postalCode', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        maxLength: 6,
                                                        placeholder: '000 00'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { className: `flex-1 min-w-[120px]` },
                                                    React.createElement('label', { htmlFor: `country-woman-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Štát'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `country-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.address?.country || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'address.country', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        placeholder: 'Štát'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                )
                                            )
                                        );
                                    })
                                ),

                                menMembersCount > 0 && React.createElement(
                                    'div',
                                    null,
                                    React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700 mt-4' }, 'Detaily členov realizačného tímu (muži)'),
                                    Array.from({ length: menMembersCount }).map((_, memberIndex) => {
                                        const member = team.menTeamMemberDetails?.[memberIndex] || {};
                                        return React.createElement('div', { key: `man-member-input-${categoryName}-${teamIndex}-${memberIndex}`, className: 'mb-4 p-3 bg-gray-100 rounded-md shadow-sm' },
                                            React.createElement('p', { className: 'font-medium text-gray-800 mb-2' }, `Muž ${memberIndex + 1}`),
                                            React.createElement('div', { className: 'flex flex-wrap items-end gap-x-4 gap-y-2' },
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('label', { htmlFor: `firstName-man-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Meno'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `firstName-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.firstName || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'firstName', e.target.value),
                                                        disabled: loading,
                                                        placeholder: 'Meno člena'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('label', { htmlFor: `lastName-man-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Priezvisko'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `lastName-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.lastName || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'lastName', e.target.value),
                                                        disabled: loading,
                                                        placeholder: 'Priezvisko člena'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[150px]' },
                                                    React.createElement('label', { htmlFor: `dateOfBirth-man-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Dátum narodenia'),
                                                    React.createElement('input', {
                                                        type: 'date',
                                                        id: `dateOfBirth-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.dateOfBirth || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'dateOfBirth', e.target.value),
                                                        disabled: loading,
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                )
                                            ),
                                            // Nový riadok pre adresné polia pre mužov
                                            React.createElement('div', {
                                                className: `flex flex-wrap items-end gap-x-4 gap-y-2 mt-4 transition-all duration-300 ${hasAccommodation ? 'h-auto opacity-100 pointer-events-auto' : 'h-0 overflow-hidden opacity-0 pointer-events-none'}`
                                            },
                                                hasAccommodation && React.createElement('h5', { className: 'block text-gray-700 text-base font-bold mb-2 w-full mt-4' }, 'Adresa trvalého bydliska (pre účely ubytovania)'),
                                                React.createElement('div', { className: `flex-1 min-w-[120px]` },
                                                    React.createElement('label', { htmlFor: `street-man-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Ulica'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `street-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.address?.street || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'address.street', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        placeholder: 'Ulica'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { className: `w-24` },
                                                    React.createElement('label', { htmlFor: `houseNumber-man-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Popisné číslo'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `houseNumber-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.address?.houseNumber || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'address.houseNumber', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        placeholder: 'Číslo'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { className: `flex-1 min-w-[120px]` },
                                                    React.createElement('label', { htmlFor: `city-man-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Mesto'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `city-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.address?.city || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'address.city', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        placeholder: 'Mesto'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { className: `flex-1 min-w-[120px]` },
                                                    React.createElement('label', { htmlFor: `postalCode-man-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'PSČ'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `postalCode-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.address?.postalCode || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'address.postalCode', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        maxLength: 6,
                                                        placeholder: '000 00'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                ),
                                                React.createElement('div', { className: `flex-1 min-w-[120px]` },
                                                    React.createElement('label', { htmlFor: `country-man-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Štát'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `country-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.address?.country || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'address.country', e.target.value),
                                                        disabled: loading || !hasAccommodation,
                                                        placeholder: 'Štát'
                                                    }),
                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                )
                                            )
                                        );
                                    })
                                )
                            );
                        })
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
                        disabled: loading || !isFormValidPage6, // Znova aktivované na základe validácie duplicity
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

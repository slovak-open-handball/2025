// register-page6.js
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Komponent pre prepínač (toggle switch)
function ToggleSwitch({ isOn, handleToggle, disabled }) {
    const bgColorClass = isOn ? 'bg-green-500' : 'bg-red-500';
    const togglePositionClass = isOn ? 'translate-x-full' : 'translate-x-0';

    return React.createElement(
        'div',
        {
            className: `relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out cursor-pointer ${bgColorClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`.trim(),
            onClick: disabled ? null : handleToggle,
            style: { boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }
        },
        React.createElement(
            'span',
            {
                className: `inline-block w-5 h-5 transform bg-white rounded-full shadow-lg ring-0 transition-transform duration-200 ease-in-out ${togglePositionClass}`.trim(),
                style: { boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }
            }
        )
    );
}

// Pomocná funkcia na formátovanie dátumu na DD. MM. YYYY
const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString; // Vráti pôvodný reťazec, ak sa nedá parsovať
        }
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Mesiace sú 0-11
        const year = date.getFullYear();
        return `${day}. ${month}. ${year}`;
    } catch (e) {
        console.error("Chyba pri formátovaní dátumu:", e);
        return dateString; // V prípade chyby vráť pôvodný reťazec
    }
};

// Hlavný komponent pre zadávanie detailov hráčov a členov realizačného tímu pre každý tím.
export function Page6Form({ handlePrev, handleSubmit, loading, teamsDataFromPage4, NotificationModal, notificationMessage, closeNotification, numberOfPlayersLimit, numberOfTeamMembersLimit, dataEditDeadline, setNotificationMessage, setNotificationType, onSaveAndPrev, notificationType, availableCategoriesMap, globalNote, setGlobalNote }) { // Pridaná globalNote a setGlobalNote
    const [localTeamDetails, setLocalTeamDetails] = React.useState({});
    // Nový stav pre chyby hráčov
    const [playerErrors, setPlayerErrors] = React.useState({}); // { [categoryName]: { [teamIndex]: { [playerIndex]: { jerseyNumber: 'error', combination: 'error', registrationNumber: 'error', dateOfBirth: 'error' } } } }

    // Helper pre notifikácie
    const dispatchAppNotification = React.useCallback((message, type = 'info') => {
        setNotificationMessage(message);
        setNotificationType(type);
    }, [setNotificationMessage, setNotificationType]);


    // Inicializácia localTeamDetails z teamsDataFromPage4 pri zmene teamsDataFromPage4
    React.useEffect(() => {
        const initialDetails = {};
        for (const categoryName in teamsDataFromPage4) {
            const teamsInCurrentCategory = teamsDataFromPage4[categoryName];
            if (Array.isArray(teamsInCurrentCategory)) {
                initialDetails[categoryName] = teamsInCurrentCategory.map(team => {
                    const playersCount = parseInt(team.players, 10) || 0;
                    const womenMembersCount = parseInt(team.womenTeamMembers, 10) || 0;
                    const menMembersCount = parseInt(team.menTeamMembers, 10) || 0;

                    // Zabezpečenie správnej štruktúry pre playerDetails, zlúčenie existujúcich dát
                    const playerDetails = Array.from({ length: playersCount }).map((_, i) => {
                        const existingPlayer = team.playerDetails?.[i] || {};
                        return {
                            jerseyNumber: '',
                            jerseyNumberColor1: '', // NOVINKA
                            jerseyNumberColor2: '', // NOVINKA
                            firstName: '',
                            lastName: '',
                            dateOfBirth: '',
                            isRegistered: false,
                            registrationNumber: '',
                            address: {
                                street: '',
                                houseNumber: '',
                                city: '',
                                postalCode: '',
                                country: '',
                            },
                            ...existingPlayer,
                            address: {
                                street: '',
                                houseNumber: '',
                                city: '',
                                postalCode: '',
                                country: '',
                                ...(existingPlayer.address || {})
                            }
                        };
                    });

                    // Zabezpečenie správnej štruktúry pre detaily členov tímu
                    const womenTeamMemberDetails = Array.from({ length: womenMembersCount }).map((_, i) => {
                        const existingMember = team.womenTeamMemberDetails?.[i] || {};
                        return {
                            firstName: '',
                            lastName: '',
                            dateOfBirth: '',
                            address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' },
                            ...existingMember,
                            address: { ...(existingMember.address || {}) }
                        };
                    });

                    const menTeamMemberDetails = Array.from({ length: menMembersCount }).map((_, i) => {
                        const existingMember = team.menTeamMemberDetails?.[i] || {};
                        return {
                            firstName: '',
                            lastName: '',
                            dateOfBirth: '',
                            address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' },
                            ...existingMember,
                            address: { ...(existingMember.address || {}) }
                        };
                    });

                    // Zabezpečenie správnej štruktúry pre detaily šoférov
                    const driversMaleCount = team.arrival?.drivers?.male || 0;
                    const driversFemaleCount = team.arrival?.drivers?.female || 0;

                    const driverDetailsMale = Array.from({ length: driversMaleCount }).map((_, i) => {
                        const existingDriver = team.driverDetailsMale?.[i] || {}; // Predpokladajme, že existujú takéto polia
                        return {
                            firstName: '',
                            lastName: '',
                            dateOfBirth: '',
                            address: { street: '', houseNumber: '', city: '', postalCode: '', country: '', },
                            ...existingDriver,
                            address: { ...(existingDriver.address || {}) }
                        };
                    });

                    const driverDetailsFemale = Array.from({ length: driversFemaleCount }).map((_, i) => {
                        const existingDriver = team.driverDetailsFemale?.[i] || {}; // Predpokladajme, že existujú takéto polia
                        return {
                            firstName: '',
                            lastName: '',
                            dateOfBirth: '',
                            address: { street: '', houseNumber: '', city: '', postalCode: '', country: '', },
                            ...existingDriver,
                            address: { ...(existingDriver.address || {}) }
                        };
                    });


                    return {
                        ...team, // Rozšíri všetky existujúce vlastnosti z pôvodného objektu tímu
                        players: playersCount, // Zabezpečí, aby počty boli čísla
                        womenTeamMembers: womenMembersCount,
                        menTeamMembers: menMembersCount,
                        playerDetails: playerDetails,
                        womenTeamMemberDetails: womenTeamMemberDetails,
                        menTeamMemberDetails: menTeamMemberDetails,
                        driverDetailsMale: driverDetailsMale,
                        driverDetailsFemale: driverDetailsFemale,
                        // Zabezpečenie, aby accommodation bol vždy objekt s type property
                        accommodation: {
                            type: team.accommodation?.type || '', // Inicializuj type z existujúceho, alebo na prázdny reťazec
                            ...(team.accommodation || {}) // Rozšír ostatné potenciálne properties ubytovania
                        }
                    };
                });
            } else {
                console.warn(`teamsDataFromPage4[${categoryName}] nie je pole. Nastavujem na prázdne pole.`);
                initialDetails[categoryName] = [];
            }
        }
        setLocalTeamDetails(initialDetails);
    }, [teamsDataFromPage4]);


    // Funkcia na validáciu hráčov v tíme
    const validateTeamPlayers = React.useCallback((currentTeamPlayers, categoryName, teamIndex) => {
        const newPlayerErrorsForTeam = {}; // Chyby pre aktuálny tím
        let teamHasErrors = false;

        // Validácia čísla dresu – farba 1
        const jerseyNumbersColor1 = new Set();
        const jerseyNumberErrorsColor1 = new Set();
        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            const jersey = (player.jerseyNumberColor1 || '').trim();
        
            if (jersey !== '') {
                if (jerseyNumbersColor1.has(jersey)) {
                    jerseyNumberErrorsColor1.add(jersey);
                    teamHasErrors = true;
                } else {
                    jerseyNumbersColor1.add(jersey);
                }
            }
        }
        
        // Validácia čísla dresu – farba 2
        const jerseyNumbersColor2 = new Set();
        const jerseyNumberErrorsColor2 = new Set();
        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            const jersey = (player.jerseyNumberColor2 || '').trim();
        
            if (jersey !== '') {
                if (jerseyNumbersColor2.has(jersey)) {
                    jerseyNumberErrorsColor2.add(jersey);
                    teamHasErrors = true;
                } else {
                    jerseyNumbersColor2.add(jersey);
                }
            }
        }
        
        // Nastav chybové správy pre čísla dresu – farba 1
        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            if (jerseyNumberErrorsColor1.has((player.jerseyNumberColor1 || '').trim())) {
                if (!newPlayerErrorsForTeam[i]) newPlayerErrorsForTeam[i] = {};
                newPlayerErrorsForTeam[i].jerseyNumberColor1 = 'Duplicitné číslo dresu (farba 1) v tíme.';
            }
            if (jerseyNumberErrorsColor2.has((player.jerseyNumberColor2 || '').trim())) {
                if (!newPlayerErrorsForTeam[i]) newPlayerErrorsForTeam[i] = {};
                newPlayerErrorsForTeam[i].jerseyNumberColor2 = 'Duplicitné číslo dresu (farba 2) v tíme.';
            }
        }

        // Validácia kombinácie údajov hráča
        const playerCombinations = new Set();
        const combinationErrors = new Set();
        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            const firstName = player.firstName.trim().toLowerCase();
            const lastName = player.lastName.trim().toLowerCase();
            const dateOfBirth = player.dateOfBirth.trim();
            const registrationNumber = player.registrationNumber.trim().toLowerCase();

            if (firstName === '' && lastName === '' && dateOfBirth === '' && registrationNumber === '') {
                continue;
            }

            let combinationKey;
            if (player.isRegistered && registrationNumber !== '') {
                combinationKey = `${firstName}-${lastName}-${dateOfBirth}-${registrationNumber}`;
            } else {
                combinationKey = `${firstName}-${lastName}-${dateOfBirth}`;
            }

            if (playerCombinations.has(combinationKey)) {
                combinationErrors.add(combinationKey);
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

        // Validácia dátumu narodenia pre hráča
        let categoryData = null;
        for (const id in availableCategoriesMap) {
            if (availableCategoriesMap[id].name === categoryName) {
                categoryData = availableCategoriesMap[id];
                break;
            }
        }

        let categoryDateFrom = null;
        let categoryDateTo = null;
        let isDateFromActive = false;
        let isDateToActive = false;

        if (categoryData) {
            isDateFromActive = categoryData.dateFromActive === true && !!categoryData.dateFrom; // Kontrolujeme aj či dátum existuje
            isDateToActive = categoryData.dateToActive === true && !!categoryData.dateTo; // Kontrolujeme aj či dátum existuje

            if (isDateFromActive) {
                categoryDateFrom = new Date(categoryData.dateFrom);
                categoryDateFrom.setUTCHours(0, 0, 0, 0);
            }
            if (isDateToActive) {
                categoryDateTo = new Date(categoryData.dateTo);
                categoryDateTo.setUTCHours(0, 0, 0, 0);
            }
        } else {
            console.log(`[Validation Debug] Kategória '${categoryName}' nebola nájdená v availableCategoriesMap. Validácia dátumu narodenia pre túto kategóriu bude preskočená.`);
        }

        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            const dob = player.dateOfBirth;
            let dateOfBirthError = '';

            if (dob) {
                const playerDob = new Date(dob);
                
                if (isNaN(playerDob.getTime())) {
                    dateOfBirthError = `Zadajte, prosím, platný dátum narodenia.`;
                    teamHasErrors = true;
                } else {
                    playerDob.setUTCHours(0, 0, 0, 0); 
                    
                    if (isDateFromActive && playerDob < categoryDateFrom) {
                        const minDateFormatted = formatDateToDDMMYYYY(categoryData.dateFrom);
                        dateOfBirthError = `Neplatný dátum narodenia pre túto kategóriu. <span style="white-space:nowrap;">(Min: ${minDateFormatted})</span>`;
                        teamHasErrors = true;
                    }

                    if (isDateToActive && playerDob > categoryDateTo) {
                        const maxDateFormatted = formatDateToDDMMYYYY(categoryData.dateTo);
                        if (dateOfBirthError) {
                            dateOfBirthError += `<span style="white-space:nowrap;">(Max: ${maxDateFormatted})</span>`; 
                        } else {
                            dateOfBirthError = `Neplatný dátum narodenia pre túto kategóriu. <span style="white-space:nowrap;">(Max: ${maxDateFormatted})</span>`;
                        }
                        teamHasErrors = true;
                    }
                }
            }
            if (dateOfBirthError) {
                if (!newPlayerErrorsForTeam[i]) newPlayerErrorsForTeam[i] = {};
                newPlayerErrorsForTeam[i].dateOfBirth = dateOfBirthError;
            } else {
                // Ak bola chyba predtla, ale teraz už nie je, vyčistíme ju
                if (newPlayerErrorsForTeam[i] && newPlayerErrorsForTeam[i].dateOfBirth) {
                    delete newPlayerErrorsForTeam[i].dateOfBirth;
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
                continue;
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
            } else {
                if (newPlayerErrorsForTeam[i] && newPlayerErrorsForTeam[i].combination) {
                    delete newPlayerErrorsForTeam[i].combination;
                }
            }

            // Nastav chybovú správu pre duplicitné registračné číslo
            if (player.isRegistered && registeredNumberErrors.has(player.registrationNumber.trim())) {
                if (!newPlayerErrorsForTeam[i]) newPlayerErrorsForTeam[i] = {};
                newPlayerErrorsForTeam[i].registrationNumber = 'Duplicitné číslo registrácie v tíme.';
            } else {
                if (newPlayerErrorsForTeam[i] && newPlayerErrorsForTeam[i].registrationNumber) {
                    delete newPlayerErrorsForTeam[i].registrationNumber;
                }
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

        // Znovu prepočítaj teamHasErrors po aktualizácii newPlayerErrorsForTeam
        // Toto je dôležité, aby sa správne zistilo, či existujú nejaké chyby v tíme.
        let updatedTeamHasErrors = false;
        for (const playerIndex in newPlayerErrorsForTeam) {
            if (Object.keys(newPlayerErrorsForTeam[playerIndex]).length > 0) {
                updatedTeamHasErrors = true;
                break;
            }
            // Kontrola, či sa podarilo vyčistiť všetky chyby pre daného hráča
            // Ak je newPlayerErrorsForTeam[playerIndex] prázdny objekt, znamená to, že chyby boli vyčistené
            if (Object.keys(newPlayerErrorsForTeam[playerIndex] || {}).length === 0) {
                // Pokračovať v iterácii, ak je prázdny
            } else {
                // Ak sú tam stále chyby, nastav updatedTeamHasErrors na true
                updatedTeamHasErrors = true;
            }
        }

        return updatedTeamHasErrors; // Vráti, či boli nájdené chyby v tíme
    }, [availableCategoriesMap]); // Pridaná závislosť availableCategoriesMap


    const handlePlayerDetailChange = (categoryName, teamIndex, playerIndex, field, value) => {
        setLocalTeamDetails(prevDetails => {
            const newDetails = JSON.parse(JSON.stringify(prevDetails));
            if (!newDetails[categoryName]?.[teamIndex]?.playerDetails) {
                newDetails[categoryName][teamIndex].playerDetails = [];
            }
            if (!newDetails[categoryName][teamIndex].playerDetails[playerIndex]) {
                newDetails[categoryName][teamIndex].playerDetails[playerIndex] = {
                    jerseyNumber: '', firstName: '', lastName: '', dateOfBirth: '', isRegistered: false, registrationNumber: '',
                    address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }
                };
            }
            const playerToUpdate = newDetails[categoryName][teamIndex].playerDetails[playerIndex];

            if (field === 'isRegistered') {
                playerToUpdate.isRegistered = value;
                if (!value) {
                    playerToUpdate.registrationNumber = '';
                }
            } else if (field.startsWith('address.')) {
                const addressField = field.substring('address.'.length);
                if (!playerToUpdate.address) {
                    playerToUpdate.address = { street: '', houseNumber: '', city: '', postalCode: '', country: '' };
                }

                if (addressField === 'postalCode') {
                    let rawValue = value.replace(/[^0-9]/g, '');
                    let formattedValue = rawValue;

                    if (rawValue.length > 5) {
                        rawValue = rawValue.substring(0, 5);
                    }

                    if (rawValue.length > 3) {
                        formattedValue = rawValue.substring(0, 3) + ' ' + rawValue.substring(3, 5);
                    }
                    playerToUpdate.address[addressField] = formattedValue;
                } else {
                    playerToUpdate.address[addressField] = value;
                }
            } else {
                playerToUpdate[field] = value;
            }

            // Spusti validáciu pre aktuálny tím
            // Volanie dispatchAppNotification presunuté do useEffect, aby sa predišlo varovaniu "Cannot update a component while rendering"
            validateTeamPlayers(newDetails[categoryName][teamIndex].playerDetails, categoryName, teamIndex);

            return newDetails;
        });
    };

    const handleTeamMemberDetailChange = (categoryName, teamIndex, memberIndex, type, field, value) => {
        setLocalTeamDetails(prevDetails => {
            const newDetails = JSON.parse(JSON.stringify(prevDetails));
            const detailArrayName = `${type}TeamMemberDetails`;
            const memberToUpdate = newDetails[categoryName][teamIndex][detailArrayName][memberIndex];

            if (!memberToUpdate.address) {
                memberToUpdate.address = { street: '', houseNumber: '', city: '', postalCode: '', country: '' };
            }

            if (field.startsWith('address.')) {
                const addressField = field.substring('address.'.length);
                if (addressField === 'postalCode') {
                    let rawValue = value.replace(/[^0-9]/g, '');
                    let formattedValue = rawValue;

                    if (rawValue.length > 5) {
                        rawValue = rawValue.length > 5 ? rawValue.substring(0, 5) : rawValue; // Ensure max 5 digits
                    }

                    if (rawValue.length > 3) {
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

    // Funkcia na zmenu detailov šoféra
    const handleDriverDetailChange = (categoryName, teamIndex, driverIndex, genderType, field, value) => {
        setLocalTeamDetails(prevDetails => {
            const newDetails = JSON.parse(JSON.stringify(prevDetails));
            const detailArrayName = `driverDetails${genderType === 'male' ? 'Male' : 'Female'}`; // 'driverDetailsMale' alebo 'driverDetailsFemale'
            const driverToUpdate = newDetails[categoryName][teamIndex][detailArrayName][driverIndex];

            if (!driverToUpdate.address) {
                driverToUpdate.address = { street: '', houseNumber: '', city: '', postalCode: '', country: '' };
            }

            if (field.startsWith('address.')) {
                const addressField = field.substring('address.'.length);
                if (addressField === 'postalCode') {
                    let rawValue = value.replace(/[^0-9]/g, '');
                    let formattedValue = rawValue;

                    if (rawValue.length > 5) {
                        rawValue = rawValue.length > 5 ? rawValue.substring(0, 5) : rawValue; // Ensure max 5 digits
                    }

                    if (rawValue.length > 3) {
                        formattedValue = rawValue.substring(0, 3) + ' ' + rawValue.substring(3, 5);
                    }
                    driverToUpdate.address[addressField] = formattedValue;
                } else {
                    driverToUpdate.address[addressField] = value;
                }
            } else {
                driverToUpdate[field] = value;
            }
            return newDetails;
        });
    };

    // NOVINKA: useEffect pre spracovanie notifikácií na základe playerErrors
    React.useEffect(() => {
        let hasAnyPlayerErrors = false;
        for (const categoryName in playerErrors) {
            for (const teamIndex in playerErrors[categoryName]) {
                for (const playerIndex in playerErrors[categoryName][teamIndex]) {
                    // Kontrolujeme všetky typy chýb
                    if (playerErrors[categoryName][teamIndex][playerIndex].jerseyNumberColor1 ||
                        playerErrors[categoryName][teamIndex][playerIndex].jerseyNumberColor2 ||
                        playerErrors[categoryName][teamIndex][playerIndex].combination ||
                        playerErrors[categoryName][teamIndex][playerIndex].registrationNumber ||
                        playerErrors[categoryName][teamIndex][playerIndex].dateOfBirth
                    ) {
                        hasAnyPlayerErrors = true;
                        break;
                    }
                }
                if (hasAnyPlayerErrors) break;
            }
            if (hasAnyPlayerErrors) break;
        }

        if (hasAnyPlayerErrors) {
            dispatchAppNotification('Boli nájdené duplicitné alebo neplatné údaje. Prosím, opravte chyby.', 'error');
        } else {
            // Iba ak je aktuálna notifikácia o chybách, tak ju zrušíme
            if (notificationMessage === 'Boli nájdené duplicitné alebo neplatné údaje. Prosím, opravte chyby.') {
                dispatchAppNotification('', 'info');
            }
        }
    }, [playerErrors, dispatchAppNotification, notificationMessage]);


    const isFormValidPage6 = React.useMemo(() => {
        for (const categoryName in playerErrors) {
            for (const teamIndex in playerErrors[categoryName]) {
                for (const playerIndex in playerErrors[categoryName][teamIndex]) {
                    // Kontrolujeme všetky typy chýb
                    if (playerErrors[categoryName][teamIndex][playerIndex].jerseyNumberColor1 ||
                        playerErrors[categoryName][teamIndex][playerIndex].jerseyNumberColor2 ||
                        playerErrors[categoryName][teamIndex][playerIndex].combination ||
                        playerErrors[categoryName][teamIndex][playerIndex].registrationNumber ||
                        playerErrors[categoryName][teamIndex][playerIndex].dateOfBirth
                    ) {
                        return false;
                    }
                }
            }
        }
        return true;
    }, [playerErrors]);

    const nextButtonClasses = `
        font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
        ${loading || !isFormValidPage6
            ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-700 text-white'
        }
    `.trim();

    const handlePage6Submit = (e) => {
        e.preventDefault();

        if (!isFormValidPage6) {
            dispatchAppNotification('Opravte prosím duplicitné alebo neplatné údaje pred pokračovaním.', 'error');
            return;
        }

        const finalTeamsData = JSON.parse(JSON.stringify(teamsDataFromPage4));

        for (const categoryName in localTeamDetails) {
            (Array.isArray(localTeamDetails[categoryName]) ? localTeamDetails[categoryName] : []).forEach((localTeam, teamIndex) => {
                if (finalTeamsData[categoryName] && finalTeamsData[categoryName][teamIndex]) {
                    finalTeamsData[categoryName][teamIndex].playerDetails = localTeam.playerDetails;
                    finalTeamsData[categoryName][teamIndex].womenTeamMemberDetails = localTeam.womenTeamMemberDetails;
                    finalTeamsData[categoryName][teamIndex].menTeamMemberDetails = localTeam.menTeamMemberDetails;
                    finalTeamsData[categoryName][teamIndex].driverDetailsMale = localTeam.driverDetailsMale;
                    finalTeamsData[categoryName][teamIndex].driverDetailsFemale = localTeam.driverDetailsFemale;
                }
            });
        }
        // ZMENA: Voláme handleSubmit s finalTeamsData a globalNote
        handleSubmit(finalTeamsData, globalNote);
    };

    // Nová funkcia na uloženie dát a prechod späť
    const handleSaveAndPrev = () => {
        const updatedTeamsData = JSON.parse(JSON.stringify(teamsDataFromPage4));

        for (const categoryName in localTeamDetails) {
            (Array.isArray(localTeamDetails[categoryName]) ? localTeamDetails[categoryName] : []).forEach((localTeam, teamIndex) => {
                if (updatedTeamsData[categoryName] && updatedTeamsData[categoryName][teamIndex]) {
                    updatedTeamsData[categoryName][teamIndex].playerDetails = localTeam.playerDetails;
                    updatedTeamsData[categoryName][teamIndex].womenTeamMemberDetails = localTeam.womenTeamMemberDetails;
                    updatedTeamsData[categoryName][teamIndex].menTeamMemberDetails = localTeam.menTeamMemberDetails;
                    updatedTeamsData[categoryName][teamIndex].driverDetailsMale = localTeam.driverDetailsMale;
                    updatedTeamsData[categoryName][teamIndex].driverDetailsFemale = localTeam.driverDetailsFemale;
                }
            });
        }
        // ZMENA: Voláme onSaveAndPrev s updatedTeamsData a globalNote
        onSaveAndPrev(updatedTeamsData, globalNote);
    };

    // Funkcia na formátovanie dátumu a času (DD. MM. YYYY hh:mm)
    const formatDateAndTime = (date) => {
        if (!date) return 'nezadaný dátum';
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            date = new Date(date); // Skúsime previesť na Date objekt, ak to ešte nie je
            if (isNaN(date.getTime())) {
                return 'nezadaný dátum'; // Ak sa nedá previesť, vráť pôvodný text
            }
        }
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Mesiace sú 0-11
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}. ${month}. ${year} ${hours}:${minutes}`;
    };


    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),

        React.createElement(
        'div',
        { 
            className: 'w-full px-2',
            style: { width: '100%' }
        },
            React.createElement(
                'h2',
                { className: 'text-2xl font-bold mb-2 text-center text-gray-800' },
                'Registrácia - strana 6'
            ),
            React.createElement(
                'p',
                { className: 'text-center text-sm text-gray-600 mb-6 px-4' },
                'Údaje na tejto strane sú ',
                React.createElement('strong', null, 'nepovinné pre registráciu tímu na turnaj.'),
                ' V\u00A0prípade ich nevyplnenia bude ',
                React.createElement('strong', null, 'potrebné ich doplniť'),
                ' neskôr: po prihlásení sa do svojho turnajového účtu e\u2011mailovou adresou a\u00A0heslom z\u00A0tohto registračného formulára, a\u00A0to v\u00A0ľavom menu v\u00A0sekcii "Súpiska tímov" ',
                React.createElement('strong', { style: { whiteSpace: 'nowrap' } }, 'do ' + formatDateAndTime(dataEditDeadline) + ' hod.')
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
                            (Array.isArray(localTeamDetails[categoryName]) ? localTeamDetails[categoryName] : []).map((team, teamIndex) => {
                                const playersCount = parseInt(team.players, 10) || 0;
                                const womenMembersCount = parseInt(team.womenTeamMembers, 10) || 0;
                                const menMembersCount = parseInt(team.menTeamMembers, 10) || 0;
                                const driversMaleCount = team.arrival?.drivers?.male || 0;
                                const driversFemaleCount = team.arrival?.drivers?.female || 0;
    
    
                                const hasAccommodation = team.accommodation && team.accommodation.type && team.accommodation.type.toLowerCase() !== 'bez ubytovania';
    
                                return React.createElement(
                                    'div',
                                    { key: `${categoryName}-${teamIndex}`, className: 'bg-blue-50 p-4 rounded-lg mb-4 space-y-2' },
                                    React.createElement('p', { className: 'font-semibold text-blue-800 mb-4' }, `Tím: ${team.teamName}`),
    
                                    playersCount > 0 && React.createElement(
                                        'div',
                                        null,
                                        React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700' }, 'Detaily hráčov'),
                                        
                                        // HLAVIČKA – zobrazí sa len raz, ak je aspoň jeden hráč
                                        React.createElement('div', { className: 'mb-2 p-3 bg-gray-200 rounded-md shadow-sm' },
                                            React.createElement('div', { className: 'flex flex-wrap items-end gap-x-4 gap-y-2' },
                                                React.createElement('div', { className: 'w-24' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, `Číslo dresu (${team.jerseyColors?.color1 || 'farba 1'})`)
                                                ),
                                                React.createElement('div', { className: 'w-24' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, `Číslo dresu (${team.jerseyColors?.color2 || 'farba 2'})`)
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Meno')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Priezvisko')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[150px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Dátum narodenia')
                                                ),
                                                React.createElement('div', { className: 'flex-initial w-auto flex flex-col' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Registrovaný vo zväze')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Číslo registrácie')
                                                ),
                                                hasAccommodation && React.createElement(React.Fragment, null,
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Ulica')
                                                    ),
                                                    React.createElement('div', { className: 'w-24' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Popisné číslo')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Mesto/obec')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'PSČ')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Štát')
                                                    )
                                                )
                                            )
                                        ),
                                        
                                        // JEDNOTLIVÍ HRÁČI – každý v jednom riadku, bez labelov
                                        Array.from({ length: playersCount }).map((_, playerIndex) => {
                                            const player = team.playerDetails?.[playerIndex] || {};
                                            const playerSpecificErrors = playerErrors?.[categoryName]?.[teamIndex]?.[playerIndex] || {};
                                    
                                            return React.createElement('div', { 
                                                key: `player-input-${categoryName}-${teamIndex}-${playerIndex}`, 
                                                className: 'mb-2 p-3 bg-gray-100 rounded-md shadow-sm' 
                                            },
                                                React.createElement('div', { className: 'flex flex-wrap items-start gap-x-4 gap-y-2' },
                                                    // Farba 1
                                                    React.createElement('div', { className: 'w-24' },
                                                        React.createElement('input', {
                                                            type: 'text',
                                                            id: `jerseyNumberColor1-${categoryName}-${teamIndex}-${playerIndex}`,
                                                            className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.jerseyNumberColor1 ? 'border-red-500' : ''}`.trim(),
                                                            value: player.jerseyNumberColor1 || '',
                                                            onChange: (e) => {
                                                                const value = e.target.value.replace(/[^0-9]/g, '');
                                                                handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'jerseyNumberColor1', value);
                                                            },
                                                            disabled: loading,
                                                            placeholder: 'Číslo'
                                                        }),
                                                        playerSpecificErrors.jerseyNumberColor1 ?
                                                            React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, playerSpecificErrors.jerseyNumberColor1) :
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                    ),
                                                    // Farba 2
                                                    React.createElement('div', { className: 'w-24' },
                                                        React.createElement('input', {
                                                            type: 'text',
                                                            id: `jerseyNumberColor2-${categoryName}-${teamIndex}-${playerIndex}`,
                                                            className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.jerseyNumberColor2 ? 'border-red-500' : ''}`.trim(),
                                                            value: player.jerseyNumberColor2 || '',
                                                            onChange: (e) => {
                                                                const value = e.target.value.replace(/[^0-9]/g, '');
                                                                handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'jerseyNumberColor2', value);
                                                            },
                                                            disabled: loading,
                                                            placeholder: 'Číslo'
                                                        }),
                                                        playerSpecificErrors.jerseyNumberColor2 ?
                                                            React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, playerSpecificErrors.jerseyNumberColor2) :
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                    ),
                                                    // Meno
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('input', {
                                                            type: 'text',
                                                            id: `firstName-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                            className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.combination ? 'border-red-500' : ''}`.trim(),
                                                            value: player.firstName || '',
                                                            onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'firstName', e.target.value),
                                                            disabled: loading,
                                                            placeholder: 'Meno hráča'
                                                        }),
                                                        React.createElement('p', { className: `text-red-500 text-xs italic mt-1 ${playerSpecificErrors.combination ? '' : 'opacity-0'}`.trim() }, playerSpecificErrors.combination || '\u00A0')
                                                    ),
                                                    // Priezvisko
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('input', {
                                                            type: 'text',
                                                            id: `lastName-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                            className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.combination ? 'border-red-500' : ''}`.trim(),
                                                            value: player.lastName || '',
                                                            onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'lastName', e.target.value),
                                                            disabled: loading,
                                                            placeholder: 'Priezvisko hráča'
                                                        }),
                                                        React.createElement('p', { className: `text-red-500 text-xs italic mt-1 ${playerSpecificErrors.combination ? '' : 'opacity-0'}`.trim() }, playerSpecificErrors.combination || '\u00A0')
                                                    ),
                                                    // Dátum narodenia
                                                    React.createElement('div', { className: 'flex-1 min-w-[150px]' },
                                                        React.createElement('input', {
                                                            type: 'date',
                                                            id: `dateOfBirth-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                            className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.dateOfBirth ? 'border-red-500' : ''}`.trim(),
                                                            value: player.dateOfBirth || '',
                                                            onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'dateOfBirth', e.target.value),
                                                            disabled: loading,
                                                        }),
                                                        playerSpecificErrors.dateOfBirth ?
                                                            React.createElement('p', { 
                                                                className: 'text-red-500 text-xs italic mt-1',
                                                                dangerouslySetInnerHTML: { __html: playerSpecificErrors.dateOfBirth } 
                                                            }) :
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                    ),
                                                    // Toggle
                                                    React.createElement('div', { className: 'flex-initial w-auto flex flex-col justify-center' },
                                                        React.createElement('div', { className: 'flex justify-center items-center w-full py-2' },
                                                            React.createElement(ToggleSwitch, {
                                                                isOn: player.isRegistered || false,
                                                                handleToggle: () => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'isRegistered', !player.isRegistered),
                                                                disabled: loading,
                                                            })
                                                        ),
                                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                    ),
                                                    // Číslo registrácie
                                                    React.createElement('div', {
                                                        className: `flex-1 min-w-[120px] transition-opacity duration-200 ${player.isRegistered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`.trim()
                                                    },
                                                        React.createElement('input', {
                                                            type: 'text',
                                                            id: `registrationNumber-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                            className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.combination || playerSpecificErrors.registrationNumber ? 'border-red-500' : ''}`.trim(),
                                                            value: player.registrationNumber || '',
                                                            onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'registrationNumber', e.target.value),
                                                            disabled: loading || !player.isRegistered,
                                                            placeholder: 'Číslo'
                                                        }),
                                                        React.createElement('p', { className: `text-red-500 text-xs italic mt-1 ${playerSpecificErrors.combination || playerSpecificErrors.registrationNumber ? '' : 'opacity-0'}`.trim() }, playerSpecificErrors.combination || playerSpecificErrors.registrationNumber || '\u00A0')
                                                    ),
                                                    // Adresa – v tom istom riadku
                                                    hasAccommodation && React.createElement(React.Fragment, null,
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `street-${categoryName}-${teamIndex}-${playerIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: player.address?.street || '',
                                                                onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'address.street', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Ulica'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'w-24' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `houseNumber-addr-${categoryName}-${teamIndex}-${playerIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: player.address?.houseNumber || '',
                                                                onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'address.houseNumber', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Číslo'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `city-addr-${categoryName}-${teamIndex}-${playerIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: player.address?.city || '',
                                                                onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'address.city', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Mesto/obec'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `postalCode-addr-${categoryName}-${teamIndex}-${playerIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: player.address?.postalCode || '',
                                                                onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'address.postalCode', e.target.value),
                                                                disabled: loading,
                                                                maxLength: 6,
                                                                placeholder: '000 00'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `country-addr-${categoryName}-${teamIndex}-${playerIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: player.address?.country || '',
                                                                onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'address.country', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Štát'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        )
                                                    )
                                                )
                                            );
                                        })
                                    ),
    
                                    womenMembersCount > 0 && React.createElement(
                                        'div',
                                        null,
                                        React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700 mt-4' }, 'Detaily členov realizačného tímu (ženy)'),
                                    
                                        // HLAVIČKA – zobrazí sa len raz
                                        React.createElement('div', { className: 'mb-2 p-3 bg-gray-200 rounded-md shadow-sm' },
                                            React.createElement('div', { className: 'flex flex-wrap items-end gap-x-4 gap-y-2' },
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Meno')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Priezvisko')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[150px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Dátum narodenia')
                                                ),
                                                hasAccommodation && React.createElement(React.Fragment, null,
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Ulica')
                                                    ),
                                                    React.createElement('div', { className: 'w-24' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Popisné číslo')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Mesto/obec')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'PSČ')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Štát')
                                                    )
                                                )
                                            )
                                        ),
                                    
                                        // JEDNOTLIVÉ ŽENY – každá v jednom riadku
                                        Array.from({ length: womenMembersCount }).map((_, memberIndex) => {
                                            const member = team.womenTeamMemberDetails?.[memberIndex] || {};
                                            return React.createElement('div', {
                                                key: `woman-member-input-${categoryName}-${teamIndex}-${memberIndex}`,
                                                className: 'mb-2 p-3 bg-gray-100 rounded-md shadow-sm'
                                            },
                                                React.createElement('div', { className: 'flex flex-wrap items-start gap-x-4 gap-y-2' },
                                                    // Meno
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
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
                                                    // Priezvisko
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
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
                                                    // Dátum narodenia
                                                    React.createElement('div', { className: 'flex-1 min-w-[150px]' },
                                                        React.createElement('input', {
                                                            type: 'date',
                                                            id: `dateOfBirth-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                            value: member.dateOfBirth || '',
                                                            onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'dateOfBirth', e.target.value),
                                                            disabled: loading,
                                                        }),
                                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                    ),
                                                    // Adresa v tom istom riadku
                                                    hasAccommodation && React.createElement(React.Fragment, null,
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `street-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: member.address?.street || '',
                                                                onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'address.street', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Ulica'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'w-24' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `houseNumber-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: member.address?.houseNumber || '',
                                                                onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'address.houseNumber', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Číslo'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `city-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: member.address?.city || '',
                                                                onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'address.city', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Mesto/obec'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `postalCode-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: member.address?.postalCode || '',
                                                                onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'address.postalCode', e.target.value),
                                                                disabled: loading,
                                                                maxLength: 6,
                                                                placeholder: '000 00'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `country-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: member.address?.country || '',
                                                                onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'address.country', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Štát'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        )
                                                    )
                                                )
                                            );
                                        })
                                    ),
                                        
                                    menMembersCount > 0 && React.createElement(
                                        'div',
                                        null,
                                        React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700 mt-4' }, 'Detaily členov realizačného tímu (muži)'),
                                    
                                        // HLAVIČKA
                                        React.createElement('div', { className: 'mb-2 p-3 bg-gray-200 rounded-md shadow-sm' },
                                            React.createElement('div', { className: 'flex flex-wrap items-end gap-x-4 gap-y-2' },
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Meno')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Priezvisko')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[150px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Dátum narodenia')
                                                ),
                                                hasAccommodation && React.createElement(React.Fragment, null,
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Ulica')
                                                    ),
                                                    React.createElement('div', { className: 'w-24' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Popisné číslo')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Mesto/obec')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'PSČ')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Štát')
                                                    )
                                                )
                                            )
                                        ),
                                    
                                        Array.from({ length: menMembersCount }).map((_, memberIndex) => {
                                            const member = team.menTeamMemberDetails?.[memberIndex] || {};
                                            return React.createElement('div', {
                                                key: `man-member-input-${categoryName}-${teamIndex}-${memberIndex}`,
                                                className: 'mb-2 p-3 bg-gray-100 rounded-md shadow-sm'
                                            },
                                                React.createElement('div', { className: 'flex flex-wrap items-start gap-x-4 gap-y-2' },
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
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
                                                        React.createElement('input', {
                                                            type: 'date',
                                                            id: `dateOfBirth-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                            value: member.dateOfBirth || '',
                                                            onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'dateOfBirth', e.target.value),
                                                            disabled: loading,
                                                        }),
                                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                    ),
                                                    hasAccommodation && React.createElement(React.Fragment, null,
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `street-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: member.address?.street || '',
                                                                onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'address.street', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Ulica'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'w-24' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `houseNumber-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: member.address?.houseNumber || '',
                                                                onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'address.houseNumber', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Číslo'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `city-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: member.address?.city || '',
                                                                onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'address.city', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Mesto/obec'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `postalCode-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: member.address?.postalCode || '',
                                                                onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'address.postalCode', e.target.value),
                                                                disabled: loading,
                                                                maxLength: 6,
                                                                placeholder: '000 00'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `country-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: member.address?.country || '',
                                                                onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'address.country', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Štát'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        )
                                                    )
                                                )
                                            );
                                        })
                                    ),
                                        
                                    driversMaleCount > 0 && React.createElement(
                                        'div',
                                        null,
                                        React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700 mt-4' }, 'Detaily šoférov (muži)'),
                                    
                                        // HLAVIČKA
                                        React.createElement('div', { className: 'mb-2 p-3 bg-gray-200 rounded-md shadow-sm' },
                                            React.createElement('div', { className: 'flex flex-wrap items-end gap-x-4 gap-y-2' },
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Meno')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Priezvisko')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[150px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Dátum narodenia')
                                                ),
                                                hasAccommodation && React.createElement(React.Fragment, null,
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Ulica')
                                                    ),
                                                    React.createElement('div', { className: 'w-24' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Popisné číslo')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Mesto/obec')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'PSČ')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Štát')
                                                    )
                                                )
                                            )
                                        ),
                                    
                                        Array.from({ length: driversMaleCount }).map((_, driverIndex) => {
                                            const driver = team.driverDetailsMale?.[driverIndex] || {};
                                            return React.createElement('div', {
                                                key: `male-driver-input-${categoryName}-${teamIndex}-${driverIndex}`,
                                                className: 'mb-2 p-3 bg-gray-100 rounded-md shadow-sm'
                                            },
                                                React.createElement('div', { className: 'flex flex-wrap items-start gap-x-4 gap-y-2' },
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('input', {
                                                            type: 'text',
                                                            id: `firstName-male-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                            value: driver.firstName || '',
                                                            onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'male', 'firstName', e.target.value),
                                                            disabled: loading,
                                                            placeholder: 'Meno šoféra'
                                                        }),
                                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('input', {
                                                            type: 'text',
                                                            id: `lastName-male-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                            value: driver.lastName || '',
                                                            onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'male', 'lastName', e.target.value),
                                                            disabled: loading,
                                                            placeholder: 'Priezvisko šoféra'
                                                        }),
                                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[150px]' },
                                                        React.createElement('input', {
                                                            type: 'date',
                                                            id: `dateOfBirth-male-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                            value: driver.dateOfBirth || '',
                                                            onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'male', 'dateOfBirth', e.target.value),
                                                            disabled: loading,
                                                        }),
                                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                    ),
                                                    hasAccommodation && React.createElement(React.Fragment, null,
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `street-male-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: driver.address?.street || '',
                                                                onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'male', 'address.street', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Ulica'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'w-24' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `houseNumber-male-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: driver.address?.houseNumber || '',
                                                                onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'male', 'address.houseNumber', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Číslo'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `city-male-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: driver.address?.city || '',
                                                                onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'male', 'address.city', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Mesto/obec'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `postalCode-male-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: driver.address?.postalCode || '',
                                                                onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'male', 'address.postalCode', e.target.value),
                                                                disabled: loading,
                                                                maxLength: 6,
                                                                placeholder: '000 00'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `country-male-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: driver.address?.country || '',
                                                                onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'male', 'address.country', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Štát'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        )
                                                    )
                                                )
                                            );
                                        })
                                    ),
                                        
                                    driversFemaleCount > 0 && React.createElement(
                                        'div',
                                        null,
                                        React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700 mt-4' }, 'Detaily šoférov (ženy)'),
                                    
                                        // HLAVIČKA
                                        React.createElement('div', { className: 'mb-2 p-3 bg-gray-200 rounded-md shadow-sm' },
                                            React.createElement('div', { className: 'flex flex-wrap items-end gap-x-4 gap-y-2' },
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Meno')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Priezvisko')
                                                ),
                                                React.createElement('div', { className: 'flex-1 min-w-[150px]' },
                                                    React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Dátum narodenia')
                                                ),
                                                hasAccommodation && React.createElement(React.Fragment, null,
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Ulica')
                                                    ),
                                                    React.createElement('div', { className: 'w-24' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Popisné číslo')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Mesto/obec')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'PSČ')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Štát')
                                                    )
                                                )
                                            )
                                        ),
                                    
                                        Array.from({ length: driversFemaleCount }).map((_, driverIndex) => {
                                            const driver = team.driverDetailsFemale?.[driverIndex] || {};
                                            return React.createElement('div', {
                                                key: `female-driver-input-${categoryName}-${teamIndex}-${driverIndex}`,
                                                className: 'mb-2 p-3 bg-gray-100 rounded-md shadow-sm'
                                            },
                                                React.createElement('div', { className: 'flex flex-wrap items-start gap-x-4 gap-y-2' },
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('input', {
                                                            type: 'text',
                                                            id: `firstName-female-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                            value: driver.firstName || '',
                                                            onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'female', 'firstName', e.target.value),
                                                            disabled: loading,
                                                            placeholder: 'Meno šoféra'
                                                        }),
                                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                        React.createElement('input', {
                                                            type: 'text',
                                                            id: `lastName-female-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                            value: driver.lastName || '',
                                                            onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'female', 'lastName', e.target.value),
                                                            disabled: loading,
                                                            placeholder: 'Priezvisko šoféra'
                                                        }),
                                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                    ),
                                                    React.createElement('div', { className: 'flex-1 min-w-[150px]' },
                                                        React.createElement('input', {
                                                            type: 'date',
                                                            id: `dateOfBirth-female-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                            value: driver.dateOfBirth || '',
                                                            onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'female', 'dateOfBirth', e.target.value),
                                                            disabled: loading,
                                                        }),
                                                        React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                    ),
                                                    hasAccommodation && React.createElement(React.Fragment, null,
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `street-female-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: driver.address?.street || '',
                                                                onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'female', 'address.street', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Ulica'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'w-24' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `houseNumber-female-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: driver.address?.houseNumber || '',
                                                                onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'female', 'address.houseNumber', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Číslo'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `city-female-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: driver.address?.city || '',
                                                                onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'female', 'address.city', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Mesto/obec'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `postalCode-female-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: driver.address?.postalCode || '',
                                                                onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'female', 'address.postalCode', e.target.value),
                                                                disabled: loading,
                                                                maxLength: 6,
                                                                placeholder: '000 00'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        ),
                                                        React.createElement('div', { className: 'flex-1 min-w-[120px]' },
                                                            React.createElement('input', {
                                                                type: 'text',
                                                                id: `country-female-driver-${categoryName}-${teamIndex}-${driverIndex}`,
                                                                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                                value: driver.address?.country || '',
                                                                onChange: (e) => handleDriverDetailChange(categoryName, teamIndex, driverIndex, 'female', 'address.country', e.target.value),
                                                                disabled: loading,
                                                                placeholder: 'Štát'
                                                            }),
                                                            React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                        )
                                                    )
                                                )
                                            );
                                        })
                                    ),
                                );
                            })
                        )
                    ))
                ),
                // NOVINKA: Inputbox pre poznámku
                React.createElement(
                    'div',
                    { className: 'border-t border-gray-200 pt-4 mt-4' },
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'globalNote' }, 'Poznámka'),
                    React.createElement('textarea', {
                        id: 'globalNote',
                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                        value: globalNote,
                        onChange: (e) => setGlobalNote(e.target.value),
                        rows: 6, // Predvolená výška 6 riadkov
                        placeholder: 'Sem môžete pridať akékoľvek ďalšie poznámky k registrácii...',
                        disabled: loading
                    })
                ),
    
                React.createElement(
                    'div',
                    { className: 'flex justify-between mt-6 pb-8' }, 
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: handleSaveAndPrev,
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
                            disabled: loading || !isFormValidPage6,
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
        )
    );
}

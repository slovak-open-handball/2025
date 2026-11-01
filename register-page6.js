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
            return dateString;
        }
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}. ${month}. ${year}`;
    } catch (e) {
        console.error("Chyba pri formátovaní dátumu:", e);
        return dateString;
    }
};

// Hlavný komponent
export function Page6Form({ handlePrev, handleSubmit, loading, teamsDataFromPage4, NotificationModal, notificationMessage, closeNotification, numberOfPlayersLimit, numberOfTeamMembersLimit, dataEditDeadline, setNotificationMessage, setNotificationType, onSaveAndPrev, notificationType, availableCategoriesMap, globalNote, setGlobalNote }) {
    const [localTeamDetails, setLocalTeamDetails] = React.useState({});
    const [playerErrors, setPlayerErrors] = React.useState({});

    // Grid template konštanty s PEVNOU šírkou (px) pre garantované zarovnanie hlavičky a riadkov
    const GRID_PLAYERS_WITH_ACCOMMODATION = '96px 96px 200px 200px 150px 120px 200px 200px 96px 200px 200px 200px';
    const GRID_PLAYERS_NO_ACCOMMODATION = '96px 96px 200px 200px 150px 120px 200px';

    const GRID_MEMBERS_WITH_ACCOMMODATION = '200px 200px 150px 200px 96px 200px 200px 200px';
    const GRID_MEMBERS_NO_ACCOMMODATION = '200px 200px 150px';

    const GRID_DRIVERS_WITH_ACCOMMODATION = '200px 200px 150px 200px 96px 200px 200px 200px';
    const GRID_DRIVERS_NO_ACCOMMODATION = '200px 200px 150px';

    // Helper pre notifikácie
    const dispatchAppNotification = React.useCallback((message, type = 'info') => {
        setNotificationMessage(message);
        setNotificationType(type);
    }, [setNotificationMessage, setNotificationType]);


    // Inicializácia localTeamDetails z teamsDataFromPage4
    React.useEffect(() => {
        const initialDetails = {};
        for (const categoryName in teamsDataFromPage4) {
            const teamsInCurrentCategory = teamsDataFromPage4[categoryName];
            if (Array.isArray(teamsInCurrentCategory)) {
                initialDetails[categoryName] = teamsInCurrentCategory.map(team => {
                    const playersCount = parseInt(team.players, 10) || 0;
                    const womenMembersCount = parseInt(team.womenTeamMembers, 10) || 0;
                    const menMembersCount = parseInt(team.menTeamMembers, 10) || 0;

                    const playerDetails = Array.from({ length: playersCount }).map((_, i) => {
                        const existingPlayer = team.playerDetails?.[i] || {};
                        return {
                            jerseyNumber: '',
                            jerseyNumber2: '',
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

                    const driversMaleCount = team.arrival?.drivers?.male || 0;
                    const driversFemaleCount = team.arrival?.drivers?.female || 0;

                    const driverDetailsMale = Array.from({ length: driversMaleCount }).map((_, i) => {
                        const existingDriver = team.driverDetailsMale?.[i] || {};
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
                        const existingDriver = team.driverDetailsFemale?.[i] || {};
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
                        ...team,
                        players: playersCount,
                        womenTeamMembers: womenMembersCount,
                        menTeamMembers: menMembersCount,
                        playerDetails: playerDetails,
                        womenTeamMemberDetails: womenTeamMemberDetails,
                        menTeamMemberDetails: menTeamMemberDetails,
                        driverDetailsMale: driverDetailsMale,
                        driverDetailsFemale: driverDetailsFemale,
                        accommodation: {
                            type: team.accommodation?.type || '',
                            ...(team.accommodation || {})
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


    // Validácia hráčov
    const validateTeamPlayers = React.useCallback((currentTeamPlayers, categoryName, teamIndex) => {
        const newPlayerErrorsForTeam = {};
        let teamHasErrors = false;

        const jerseyNumbersColor1 = new Map();
        const jerseyNumberErrorsColor1 = new Set();
        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            const jersey = (player.jerseyNumber || '').trim();
            if (jersey !== '') {
                if (!jerseyNumbersColor1.has(jersey)) {
                    jerseyNumbersColor1.set(jersey, []);
                }
                jerseyNumbersColor1.get(jersey).push(i);
            }
        }
        jerseyNumbersColor1.forEach((indices, jersey) => {
            if (indices.length > 1) {
                jerseyNumberErrorsColor1.add(jersey);
                teamHasErrors = true;
            }
        });

        const jerseyNumbersColor2 = new Map();
        const jerseyNumberErrorsColor2 = new Set();
        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            const jersey = (player.jerseyNumber2 || '').trim();
            if (jersey !== '') {
                if (!jerseyNumbersColor2.has(jersey)) {
                    jerseyNumbersColor2.set(jersey, []);
                }
                jerseyNumbersColor2.get(jersey).push(i);
            }
        }
        jerseyNumbersColor2.forEach((indices, jersey) => {
            if (indices.length > 1) {
                jerseyNumberErrorsColor2.add(jersey);
                teamHasErrors = true;
            }
        });

        for (let i = 0; i < currentTeamPlayers.length; i++) {
            const player = currentTeamPlayers[i];
            const jerseyColor1 = (player.jerseyNumber || '').trim();
            const jerseyColor2 = (player.jerseyNumber2 || '').trim();
            if (jerseyColor1 !== '' && jerseyNumberErrorsColor1.has(jerseyColor1)) {
                if (!newPlayerErrorsForTeam[i]) newPlayerErrorsForTeam[i] = {};
                newPlayerErrorsForTeam[i].jerseyNumber = 'Duplicitné číslo dresu (farba 1) v tíme.';
            }
            if (jerseyColor2 !== '' && jerseyNumberErrorsColor2.has(jerseyColor2)) {
                if (!newPlayerErrorsForTeam[i]) newPlayerErrorsForTeam[i] = {};
                newPlayerErrorsForTeam[i].jerseyNumber2 = 'Duplicitné číslo dresu (farba 2) v tíme.';
            }
        }

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
            isDateFromActive = categoryData.dateFromActive === true && !!categoryData.dateFrom;
            isDateToActive = categoryData.dateToActive === true && !!categoryData.dateTo;
            if (isDateFromActive) {
                categoryDateFrom = new Date(categoryData.dateFrom);
                categoryDateFrom.setUTCHours(0, 0, 0, 0);
            }
            if (isDateToActive) {
                categoryDateTo = new Date(categoryData.dateTo);
                categoryDateTo.setUTCHours(0, 0, 0, 0);
            }
        } else {
            console.log(`[Validation Debug] Kategória '${categoryName}' nebola nájdená v availableCategoriesMap.`);
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
                if (newPlayerErrorsForTeam[i] && newPlayerErrorsForTeam[i].dateOfBirth) {
                    delete newPlayerErrorsForTeam[i].dateOfBirth;
                }
            }
        }

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
            if (player.isRegistered && registeredNumberErrors.has(player.registrationNumber.trim())) {
                if (!newPlayerErrorsForTeam[i]) newPlayerErrorsForTeam[i] = {};
                newPlayerErrorsForTeam[i].registrationNumber = 'Duplicitné číslo registrácie v tíme.';
            } else {
                if (newPlayerErrorsForTeam[i] && newPlayerErrorsForTeam[i].registrationNumber) {
                    delete newPlayerErrorsForTeam[i].registrationNumber;
                }
            }
        }

        setPlayerErrors(prevPlayerErrors => ({
            ...prevPlayerErrors,
            [categoryName]: {
                ...(prevPlayerErrors[categoryName] || {}),
                [teamIndex]: newPlayerErrorsForTeam
            }
        }));

        let updatedTeamHasErrors = false;
        for (const playerIndex in newPlayerErrorsForTeam) {
            if (Object.keys(newPlayerErrorsForTeam[playerIndex]).length > 0) {
                updatedTeamHasErrors = true;
                break;
            }
        }
        return updatedTeamHasErrors;
    }, [availableCategoriesMap]);


    const handlePlayerDetailChange = (categoryName, teamIndex, playerIndex, field, value) => {
        setLocalTeamDetails(prevDetails => {
            const newDetails = JSON.parse(JSON.stringify(prevDetails));
            if (!newDetails[categoryName]?.[teamIndex]?.playerDetails) {
                newDetails[categoryName][teamIndex].playerDetails = [];
            }
            if (!newDetails[categoryName][teamIndex].playerDetails[playerIndex]) {
                newDetails[categoryName][teamIndex].playerDetails[playerIndex] = {
                    jerseyNumber: '', jerseyNumber2: '', firstName: '', lastName: '', dateOfBirth: '', isRegistered: false, registrationNumber: '',
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
                        rawValue = rawValue.length > 5 ? rawValue.substring(0, 5) : rawValue;
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

    const handleDriverDetailChange = (categoryName, teamIndex, driverIndex, genderType, field, value) => {
        setLocalTeamDetails(prevDetails => {
            const newDetails = JSON.parse(JSON.stringify(prevDetails));
            const detailArrayName = `driverDetails${genderType === 'male' ? 'Male' : 'Female'}`;
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
                        rawValue = rawValue.length > 5 ? rawValue.substring(0, 5) : rawValue;
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

    // useEffect pre notifikácie
    React.useEffect(() => {
        let hasAnyPlayerErrors = false;
        for (const categoryName in playerErrors) {
            for (const teamIndex in playerErrors[categoryName]) {
                for (const playerIndex in playerErrors[categoryName][teamIndex]) {
                    if (playerErrors[categoryName][teamIndex][playerIndex].jerseyNumber ||
                        playerErrors[categoryName][teamIndex][playerIndex].jerseyNumber2 ||
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
            if (notificationMessage === 'Boli nájdené duplicitné alebo neplatné údaje. Prosím, opravte chyby.') {
                dispatchAppNotification('', 'info');
            }
        }
    }, [playerErrors, dispatchAppNotification, notificationMessage]);


    const isFormValidPage6 = React.useMemo(() => {
        for (const categoryName in playerErrors) {
            for (const teamIndex in playerErrors[categoryName]) {
                for (const playerIndex in playerErrors[categoryName][teamIndex]) {
                    if (playerErrors[categoryName][teamIndex][playerIndex].jerseyNumber ||
                        playerErrors[categoryName][teamIndex][playerIndex].jerseyNumber2 ||
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
        handleSubmit(finalTeamsData, globalNote);
    };

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
        onSaveAndPrev(updatedTeamsData, globalNote);
    };

    const formatDateAndTime = (date) => {
        if (!date) return 'nezadaný dátum';
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            date = new Date(date);
            if (isNaN(date.getTime())) {
                return 'nezadaný dátum';
            }
        }
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}. ${month}. ${year} ${hours}:${minutes}`;
    };


    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),

        // HLAVNÝ OBALOVÝ DIV – obsahuje horizontálny scroll pre CELÚ STRÁNKU
        React.createElement(
            'div',
            {
                className: 'w-full',
                style: {
                    overflowX: 'auto',         // ✅ JEDEN horizontálny posuvník pre celú stránku
                    width: '100%',
                    WebkitOverflowScrolling: 'touch'
                }
            },
            React.createElement(
                'div',
                {
                    // Vnútorný div – roztiahne sa podľa obsahu (šírka bledomodrého boxu)
                    style: {
                        minWidth: 'max-content',  // ✅ Šírka stránky sa prispôsobí obsahu
                        padding: '0 8px'
                    }
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
                                        {
                                            key: `${categoryName}-${teamIndex}`,
                                            className: 'bg-blue-50 py-4 rounded-lg mb-4 space-y-2',
                                            style: { width: 'max-content', minWidth: '100%' }  // ✅ Bledomodrý box sa roztiahne podľa obsahu
                                        },
                                        React.createElement('p', { className: 'font-semibold text-blue-800 mb-4 px-4' }, `Tím: ${team.teamName}`),

                                        // ===================== HRÁČI =====================
                                        playersCount > 0 && React.createElement(
                                            'div', null,  // ✅ ODSTRÁNENÉ overflow-x-auto
                                            React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700' }, 'Detaily hráčov'),

                                            // HLAVIČKA
                                            React.createElement('div', { className: 'mb-2' },
                                                React.createElement('div', { className: 'p-4 shadow-sm' },
                                                    React.createElement('div', {
                                                        className: 'grid items-end gap-x-4 gap-y-2',
                                                        style: { gridTemplateColumns: hasAccommodation ? GRID_PLAYERS_WITH_ACCOMMODATION : GRID_PLAYERS_NO_ACCOMMODATION }
                                                    },
                                                        React.createElement('div', null,
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Číslo dresu'),
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, `(${team.jerseyColors?.color1 || 'farba 1'})`)
                                                        ),
                                                        React.createElement('div', null,
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Číslo dresu'),
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, `(${team.jerseyColors?.color2 || 'farba 2'})`)
                                                        ),
                                                        React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Meno')),
                                                        React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Priezvisko')),
                                                        React.createElement('div', null,
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Dátum'),
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'narodenia')
                                                        ),
                                                        React.createElement('div', null,
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Registrovaný'),
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'vo zväze')
                                                        ),
                                                        React.createElement('div', null,
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Číslo'),
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'registrácie')
                                                        ),
                                                        hasAccommodation && React.createElement(React.Fragment, null,
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Ulica')),
                                                            React.createElement('div', null,
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Popisné'),
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'číslo')
                                                            ),
                                                            React.createElement('div', null,
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Mesto'),
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'obec')
                                                            ),
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'PSČ')),
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Štát'))
                                                        )
                                                    )
                                                )
                                            ),

                                            // RIADKY HRÁČOV
                                            Array.from({ length: playersCount }).map((_, playerIndex) => {
                                                const player = team.playerDetails?.[playerIndex] || {};
                                                const playerSpecificErrors = playerErrors?.[categoryName]?.[teamIndex]?.[playerIndex] || {};

                                                return React.createElement('div', {
                                                    key: `player-input-${categoryName}-${teamIndex}-${playerIndex}`,
                                                    className: 'mb-2'
                                                },
                                                    React.createElement('div', { className: 'p-4 shadow-sm' },
                                                        React.createElement('div', {
                                                            className: 'grid items-start gap-x-4 gap-y-2',
                                                            style: { gridTemplateColumns: hasAccommodation ? GRID_PLAYERS_WITH_ACCOMMODATION : GRID_PLAYERS_NO_ACCOMMODATION }
                                                        },
                                                            // Farba 1
                                                            React.createElement('div', null,
                                                                React.createElement('input', {
                                                                    type: 'text',
                                                                    id: `jerseyNumber-${categoryName}-${teamIndex}-${playerIndex}`,
                                                                    className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.jerseyNumber ? 'border-red-500' : ''}`.trim(),
                                                                    value: player.jerseyNumber || '',
                                                                    onChange: (e) => {
                                                                        const value = e.target.value.replace(/[^0-9]/g, '');
                                                                        handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'jerseyNumber', value);
                                                                    },
                                                                    disabled: loading,
                                                                    placeholder: 'Číslo'
                                                                }),
                                                                playerSpecificErrors.jerseyNumber ?
                                                                    React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, playerSpecificErrors.jerseyNumber) :
                                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                            ),
                                                            // Farba 2
                                                            React.createElement('div', null,
                                                                React.createElement('input', {
                                                                    type: 'text',
                                                                    id: `jerseyNumber2-${categoryName}-${teamIndex}-${playerIndex}`,
                                                                    className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${playerSpecificErrors.jerseyNumber2 ? 'border-red-500' : ''}`.trim(),
                                                                    value: player.jerseyNumber2 || '',
                                                                    onChange: (e) => {
                                                                        const value = e.target.value.replace(/[^0-9]/g, '');
                                                                        handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'jerseyNumber2', value);
                                                                    },
                                                                    disabled: loading,
                                                                    placeholder: 'Číslo'
                                                                }),
                                                                playerSpecificErrors.jerseyNumber2 ?
                                                                    React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, playerSpecificErrors.jerseyNumber2) :
                                                                    React.createElement('p', { className: 'text-xs italic mt-1 opacity-0' }, '\u00A0')
                                                            ),
                                                            // Meno
                                                            React.createElement('div', null,
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
                                                            React.createElement('div', null,
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
                                                            React.createElement('div', null,
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
                                                            React.createElement('div', { className: 'flex flex-col justify-center' },
                                                                React.createElement('div', { className: 'flex justify-center items-center py-2' },
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
                                                                className: `transition-opacity duration-200 ${player.isRegistered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`.trim()
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
                                                            // Adresa
                                                            hasAccommodation && React.createElement(React.Fragment, null,
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                    )
                                                );
                                            })
                                        ),

                                        // ===================== ŽENY – REALIZAČNÝ TÍM =====================
                                        womenMembersCount > 0 && React.createElement(
                                            'div', null,
                                            React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700 mt-4' }, 'Detaily členov realizačného tímu (ženy)'),
                                            React.createElement('div', { className: 'mb-2' },
                                                React.createElement('div', { className: 'p-4 shadow-sm' },
                                                    React.createElement('div', {
                                                        className: 'grid items-end gap-x-4 gap-y-2',
                                                        style: { gridTemplateColumns: hasAccommodation ? GRID_MEMBERS_WITH_ACCOMMODATION : GRID_MEMBERS_NO_ACCOMMODATION }
                                                    },
                                                        React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Meno')),
                                                        React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Priezvisko')),
                                                        React.createElement('div', null,
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Dátum'),
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'narodenia')
                                                        ),
                                                        hasAccommodation && React.createElement(React.Fragment, null,
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Ulica')),
                                                            React.createElement('div', null,
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Popisné'),
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'číslo')
                                                            ),
                                                            React.createElement('div', null,
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Mesto'),
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'obec')
                                                            ),
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'PSČ')),
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Štát'))
                                                        )
                                                    )
                                                )
                                            ),
                                            Array.from({ length: womenMembersCount }).map((_, memberIndex) => {
                                                const member = team.womenTeamMemberDetails?.[memberIndex] || {};
                                                return React.createElement('div', {
                                                    key: `woman-member-input-${categoryName}-${teamIndex}-${memberIndex}`,
                                                    className: 'mb-2'
                                                },
                                                    React.createElement('div', { className: 'p-4 shadow-sm' },
                                                        React.createElement('div', {
                                                            className: 'grid items-start gap-x-4 gap-y-2',
                                                            style: { gridTemplateColumns: hasAccommodation ? GRID_MEMBERS_WITH_ACCOMMODATION : GRID_MEMBERS_NO_ACCOMMODATION }
                                                        },
                                                            React.createElement('div', null,
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
                                                            React.createElement('div', null,
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
                                                            React.createElement('div', null,
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
                                                            hasAccommodation && React.createElement(React.Fragment, null,
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                    )
                                                );
                                            })
                                        ),

                                        // ===================== MUŽI – REALIZAČNÝ TÍM =====================
                                        menMembersCount > 0 && React.createElement(
                                            'div', null,
                                            React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700 mt-4' }, 'Detaily členov realizačného tímu (muži)'),
                                            React.createElement('div', { className: 'mb-2' },
                                                React.createElement('div', { className: 'p-4 shadow-sm' },
                                                    React.createElement('div', {
                                                        className: 'grid items-end gap-x-4 gap-y-2',
                                                        style: { gridTemplateColumns: hasAccommodation ? GRID_MEMBERS_WITH_ACCOMMODATION : GRID_MEMBERS_NO_ACCOMMODATION }
                                                    },
                                                        React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Meno')),
                                                        React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Priezvisko')),
                                                        React.createElement('div', null,
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Dátum'),
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'narodenia')
                                                        ),
                                                        hasAccommodation && React.createElement(React.Fragment, null,
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Ulica')),
                                                            React.createElement('div', null,
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Popisné'),
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'číslo')
                                                            ),
                                                            React.createElement('div', null,
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Mesto'),
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'obec')
                                                            ),
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'PSČ')),
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Štát'))
                                                        )
                                                    )
                                                )
                                            ),
                                            Array.from({ length: menMembersCount }).map((_, memberIndex) => {
                                                const member = team.menTeamMemberDetails?.[memberIndex] || {};
                                                return React.createElement('div', {
                                                    key: `man-member-input-${categoryName}-${teamIndex}-${memberIndex}`,
                                                    className: 'mb-2'
                                                },
                                                    React.createElement('div', { className: 'p-4 shadow-sm' },
                                                        React.createElement('div', {
                                                            className: 'grid items-start gap-x-4 gap-y-2',
                                                            style: { gridTemplateColumns: hasAccommodation ? GRID_MEMBERS_WITH_ACCOMMODATION : GRID_MEMBERS_NO_ACCOMMODATION }
                                                        },
                                                            React.createElement('div', null,
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
                                                            React.createElement('div', null,
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
                                                            React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                    )
                                                );
                                            })
                                        ),

                                        // ===================== ŠOFÉRI – MUŽI =====================
                                        driversMaleCount > 0 && React.createElement(
                                            'div', null,
                                            React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700 mt-4' }, 'Detaily šoférov (muži)'),
                                            React.createElement('div', { className: 'mb-2' },
                                                React.createElement('div', { className: 'p-4 shadow-sm' },
                                                    React.createElement('div', {
                                                        className: 'grid items-end gap-x-4 gap-y-2',
                                                        style: { gridTemplateColumns: hasAccommodation ? GRID_DRIVERS_WITH_ACCOMMODATION : GRID_DRIVERS_NO_ACCOMMODATION }
                                                    },
                                                        React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Meno')),
                                                        React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Priezvisko')),
                                                        React.createElement('div', null,
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Dátum'),
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'narodenia')
                                                        ),
                                                        hasAccommodation && React.createElement(React.Fragment, null,
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Ulica')),
                                                            React.createElement('div', null,
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Popisné'),
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'číslo')
                                                            ),
                                                            React.createElement('div', null,
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Mesto'),
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'obec')
                                                            ),
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'PSČ')),
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Štát'))
                                                        )
                                                    )
                                                )
                                            ),
                                            Array.from({ length: driversMaleCount }).map((_, driverIndex) => {
                                                const driver = team.driverDetailsMale?.[driverIndex] || {};
                                                return React.createElement('div', {
                                                    key: `male-driver-input-${categoryName}-${teamIndex}-${driverIndex}`,
                                                    className: 'mb-2'
                                                },
                                                    React.createElement('div', { className: 'p-4 shadow-sm' },
                                                        React.createElement('div', {
                                                            className: 'grid items-start gap-x-4 gap-y-2',
                                                            style: { gridTemplateColumns: hasAccommodation ? GRID_DRIVERS_WITH_ACCOMMODATION : GRID_DRIVERS_NO_ACCOMMODATION }
                                                        },
                                                            React.createElement('div', null,
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
                                                            React.createElement('div', null,
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
                                                            React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                    )
                                                );
                                            })
                                        ),

                                        // ===================== ŠOFÉRI – ŽENY =====================
                                        driversFemaleCount > 0 && React.createElement(
                                            'div', null,
                                            React.createElement('h4', { className: 'text-lg font-bold mb-2 text-gray-700 mt-4' }, 'Detaily šoférov (ženy)'),
                                            React.createElement('div', { className: 'mb-2' },
                                                React.createElement('div', { className: 'p-4 shadow-sm' },
                                                    React.createElement('div', {
                                                        className: 'grid items-end gap-x-4 gap-y-2',
                                                        style: { gridTemplateColumns: hasAccommodation ? GRID_DRIVERS_WITH_ACCOMMODATION : GRID_DRIVERS_NO_ACCOMMODATION }
                                                    },
                                                        React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Meno')),
                                                        React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Priezvisko')),
                                                        React.createElement('div', null,
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Dátum'),
                                                            React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'narodenia')
                                                        ),
                                                        hasAccommodation && React.createElement(React.Fragment, null,
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Ulica')),
                                                            React.createElement('div', null,
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Popisné'),
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'číslo')
                                                            ),
                                                            React.createElement('div', null,
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Mesto'),
                                                                React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'obec')
                                                            ),
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'PSČ')),
                                                            React.createElement('div', null, React.createElement('span', { className: 'block text-gray-700 text-sm font-bold' }, 'Štát'))
                                                        )
                                                    )
                                                )
                                            ),
                                            Array.from({ length: driversFemaleCount }).map((_, driverIndex) => {
                                                const driver = team.driverDetailsFemale?.[driverIndex] || {};
                                                return React.createElement('div', {
                                                    key: `female-driver-input-${categoryName}-${teamIndex}-${driverIndex}`,
                                                    className: 'mb-2'
                                                },
                                                    React.createElement('div', { className: 'p-4 shadow-sm' },
                                                        React.createElement('div', {
                                                            className: 'grid items-start gap-x-4 gap-y-2',
                                                            style: { gridTemplateColumns: hasAccommodation ? GRID_DRIVERS_WITH_ACCOMMODATION : GRID_DRIVERS_NO_ACCOMMODATION }
                                                        },
                                                            React.createElement('div', null,
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
                                                            React.createElement('div', null,
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
                                                            React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                                React.createElement('div', null,
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
                                                    )
                                                );
                                            })
                                        ),
                                    );
                                })
                            )
                        ))
                    ),

                    // Poznámka
                    React.createElement(
                        'div',
                        { className: 'border-t border-gray-200 pt-4 mt-4' },
                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'globalNote' }, 'Poznámka'),
                        React.createElement('textarea', {
                            id: 'globalNote',
                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                            value: globalNote,
                            onChange: (e) => setGlobalNote(e.target.value),
                            rows: 6,
                            placeholder: 'Sem môžete pridať akékoľvek ďalšie poznámky k registrácii...',
                            disabled: loading,
                            style: { minWidth: '400px' }
                        })
                    ),

                    React.createElement(
                        'div',
                        { className: 'flex justify-between mt-6 pb-16' },
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
        )
    );
}

// register-page6.js
// Obsahuje komponent pre zadávanie detailov hráčov a členov realizačného tímu pre každý tím.

export function Page6Form({ formData, handlePrev, handleSubmit, loading, teamsDataFromPage4, NotificationModal, notificationMessage, closeNotification, numberOfPlayersLimit, numberOfTeamMembersLimit }) {

    // Lokálny stav pre detaily hráčov a realizačného tímu pre všetky tímy
    const [localTeamDetails, setLocalTeamDetails] = React.useState({});

    // Inicializácia lokálneho stavu pri prvom načítaní alebo zmene teamsDataFromPage4
    React.useEffect(() => {
        const initialDetails = {};
        for (const categoryName in teamsDataFromPage4) {
            initialDetails[categoryName] = (teamsDataFromPage4[categoryName] || []).map(team => {
                const playersCount = parseInt(team.players, 10) || 0;
                const womenMembersCount = parseInt(team.womenTeamMembers, 10) || 0;
                const menMembersCount = parseInt(team.menTeamMembers, 10) || 0;

                return {
                    teamName: team.teamName,
                    players: playersCount,
                    womenTeamMembers: womenMembersCount,
                    menTeamMembers: menMembersCount,
                    // Inicializácia polí detailov hráčov a členov tímu, ak neexistujú
                    playerDetails: team.playerDetails || Array.from({ length: playersCount }).map(() => ({
                        jerseyNumber: '',
                        firstName: '',
                        lastName: '',
                        dateOfBirth: '',
                        isRegistered: false,
                        registrationNumber: ''
                    })),
                    womenTeamMemberDetails: team.womenTeamMemberDetails || Array.from({ length: womenMembersCount }).map(() => ({
                        firstName: '',
                        lastName: '',
                        dateOfBirth: ''
                    })),
                    menTeamMemberDetails: team.menTeamMemberDetails || Array.from({ length: menMembersCount }).map(() => ({
                        firstName: '',
                        lastName: '',
                        dateOfBirth: ''
                    })),
                };
            });
        }
        setLocalTeamDetails(initialDetails);
    }, [teamsDataFromPage4]);


    // Handler pre zmeny v detailoch hráča
    const handlePlayerDetailChange = (categoryName, teamIndex, playerIndex, field, value) => {
        setLocalTeamDetails(prevDetails => {
            const newDetails = { ...prevDetails };
            if (!newDetails[categoryName]?.[teamIndex]?.playerDetails?.[playerIndex]) {
                // Ak detail ešte neexistuje, inicializujte ho
                if (!newDetails[categoryName][teamIndex].playerDetails) {
                    newDetails[categoryName][teamIndex].playerDetails = [];
                }
                newDetails[categoryName][teamIndex].playerDetails[playerIndex] = {
                    jerseyNumber: '', firstName: '', lastName: '', dateOfBirth: '', isRegistered: false, registrationNumber: ''
                };
            }
            // Špeciálne ošetrenie pre 'isRegistered'
            if (field === 'isRegistered') {
                newDetails[categoryName][teamIndex].playerDetails[playerIndex].isRegistered = value;
                // Ak sa prepne na neregistrovaný, vyčistite číslo registrácie
                if (!value) {
                    newDetails[categoryName][teamIndex].playerDetails[playerIndex].registrationNumber = '';
                }
            } else {
                newDetails[categoryName][teamIndex].playerDetails[playerIndex][field] = value;
            }
            return newDetails;
        });
    };

    // Handler pre zmeny v detailoch člena realizačného tímu (ženy/muži)
    const handleTeamMemberDetailChange = (categoryName, teamIndex, memberIndex, type, field, value) => {
        setLocalTeamDetails(prevDetails => {
            const newDetails = { ...prevDetails };
            const detailArrayName = `${type}TeamMemberDetails`; // 'womenTeamMemberDetails' alebo 'menTeamMemberDetails'

            if (!newDetails[categoryName]?.[teamIndex]?.[detailArrayName]?.[memberIndex]) {
                // Ak detail ešte neexistuje, inicializujte ho
                if (!newDetails[categoryName][teamIndex][detailArrayName]) {
                    newDetails[categoryName][teamIndex][detailArrayName] = [];
                }
                newDetails[categoryName][teamIndex][detailArrayName][memberIndex] = {
                    firstName: '', lastName: '', dateOfBirth: ''
                };
            }
            newDetails[categoryName][teamIndex][detailArrayName][memberIndex][field] = value;
            return newDetails;
        });
    };

    // Validácia formulára na Page6
    const isFormValidPage6 = React.useMemo(() => {
        for (const categoryName in localTeamDetails) {
            for (const team of localTeamDetails[categoryName]) {
                // Validácia hráčov
                for (let i = 0; i < team.players; i++) {
                    const player = team.playerDetails?.[i];
                    if (!player ||
                        !player.firstName.trim() ||
                        !player.lastName.trim() ||
                        !player.dateOfBirth.trim() ||
                        !/^\d+$/.test(player.jerseyNumber) || // Číslo dresu musí byť len číselný údaj
                        (player.isRegistered && !player.registrationNumber.trim()) // Ak je registrovaný, číslo registrácie je povinné
                    ) {
                        return false;
                    }
                }

                // Validácia ženských členov realizačného tímu
                for (let i = 0; i < team.womenTeamMembers; i++) {
                    const member = team.womenTeamMemberDetails?.[i];
                    if (!member ||
                        !member.firstName.trim() ||
                        !member.lastName.trim() ||
                        !member.dateOfBirth.trim()
                    ) {
                        return false;
                    }
                }

                // Validácia mužských členov realizačného tímu
                for (let i = 0; i < team.menTeamMembers; i++) {
                    const member = team.menTeamMemberDetails?.[i];
                    if (!member ||
                        !member.firstName.trim() ||
                        !member.lastName.trim() ||
                        !member.dateOfBirth.trim()
                    ) {
                        return false;
                    }
                }
            }
        }
        return true;
    }, [localTeamDetails]);

    // CSS triedy pre tlačidlo "Ďalej"
    const nextButtonClasses = `
        font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
        ${!isFormValidPage6 || loading
            ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-700 text-white'
        }
    `;

    const handlePage6Submit = (e) => {
        e.preventDefault();
        // Spojíme lokálne detaily s pôvodnými dátami z teamsDataFromPage4
        const finalTeamsData = JSON.parse(JSON.stringify(teamsDataFromPage4)); // Hlboká kópia

        for (const categoryName in localTeamDetails) {
            (localTeamDetails[categoryName] || []).forEach((localTeam, teamIndex) => {
                if (finalTeamsData[categoryName] && finalTeamsData[categoryName][teamIndex]) {
                    finalTeamsData[categoryName][teamIndex].playerDetails = localTeam.playerDetails;
                    finalTeamsData[categoryName][teamIndex].womenTeamMemberDetails = localTeam.womenTeamMemberDetails;
                    finalTeamsData[categoryName][teamIndex].menTeamMemberDetails = localTeam.menTeamMemberDetails;
                }
            });
        }
        handleSubmit(finalTeamsData); // Odovzdáme finálne dáta do App.js
    };


    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: 'info' }),

        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
            'Registrácia - strana 6: Detaily tímu'
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
                                        return React.createElement('div', { key: `player-input-${categoryName}-${teamIndex}-${playerIndex}`, className: 'mb-4 p-3 bg-gray-100 rounded-md shadow-sm' },
                                            React.createElement('p', { className: 'font-medium text-gray-800 mb-2' }, `Hráč ${playerIndex + 1}`),
                                            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                                                React.createElement('div', null,
                                                    React.createElement('label', { htmlFor: `jerseyNumber-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Číslo dresu'),
                                                    React.createElement('input', {
                                                        type: 'text', // Text to allow empty string and then validate for numbers only
                                                        id: `jerseyNumber-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: player.jerseyNumber || '',
                                                        onChange: (e) => {
                                                            const value = e.target.value.replace(/[^0-9]/g, ''); // Len číselný údaj
                                                            handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'jerseyNumber', value);
                                                        },
                                                        required: true,
                                                        disabled: loading,
                                                        placeholder: 'Napr. 10'
                                                    })
                                                ),
                                                React.createElement('div', null,
                                                    React.createElement('label', { htmlFor: `firstName-player-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Meno'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `firstName-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: player.firstName || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'firstName', e.target.value),
                                                        required: true,
                                                        disabled: loading,
                                                        placeholder: 'Meno hráča'
                                                    })
                                                ),
                                                React.createElement('div', null,
                                                    React.createElement('label', { htmlFor: `lastName-player-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Priezvisko'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `lastName-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: player.lastName || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'lastName', e.target.value),
                                                        required: true,
                                                        disabled: loading,
                                                        placeholder: 'Priezvisko hráča'
                                                    })
                                                ),
                                                React.createElement('div', null,
                                                    React.createElement('label', { htmlFor: `dateOfBirth-player-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Dátum narodenia'),
                                                    React.createElement('input', {
                                                        type: 'date',
                                                        id: `dateOfBirth-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: player.dateOfBirth || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'dateOfBirth', e.target.value),
                                                        required: true,
                                                        disabled: loading,
                                                    })
                                                ),
                                                React.createElement('div', { className: 'flex items-center mt-2' },
                                                    React.createElement('input', {
                                                        type: 'checkbox',
                                                        id: `isRegistered-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: 'form-checkbox h-5 w-5 text-blue-600 rounded',
                                                        checked: player.isRegistered || false,
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'isRegistered', e.target.checked),
                                                        disabled: loading,
                                                    }),
                                                    React.createElement('label', { htmlFor: `isRegistered-player-${categoryName}-${teamIndex}-${playerIndex}`, className: 'ml-2 text-gray-700 font-bold text-sm' }, 'Registrovaný')
                                                ),
                                                player.isRegistered && React.createElement('div', null,
                                                    React.createElement('label', { htmlFor: `registrationNumber-player-${categoryName}-${teamIndex}-${playerIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Číslo registrácie'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `registrationNumber-player-${categoryName}-${teamIndex}-${playerIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: player.registrationNumber || '',
                                                        onChange: (e) => handlePlayerDetailChange(categoryName, teamIndex, playerIndex, 'registrationNumber', e.target.value),
                                                        required: true,
                                                        disabled: loading,
                                                        placeholder: 'Číslo registrácie'
                                                    })
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
                                            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                                                React.createElement('div', null,
                                                    React.createElement('label', { htmlFor: `firstName-woman-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Meno'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `firstName-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.firstName || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'firstName', e.target.value),
                                                        required: true,
                                                        disabled: loading,
                                                        placeholder: 'Meno členky'
                                                    })
                                                ),
                                                React.createElement('div', null,
                                                    React.createElement('label', { htmlFor: `lastName-woman-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Priezvisko'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `lastName-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.lastName || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'lastName', e.target.value),
                                                        required: true,
                                                        disabled: loading,
                                                        placeholder: 'Priezvisko členky'
                                                    })
                                                ),
                                                React.createElement('div', null,
                                                    React.createElement('label', { htmlFor: `dateOfBirth-woman-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Dátum narodenia'),
                                                    React.createElement('input', {
                                                        type: 'date',
                                                        id: `dateOfBirth-woman-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.dateOfBirth || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'women', 'dateOfBirth', e.target.value),
                                                        required: true,
                                                        disabled: loading,
                                                    })
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
                                            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                                                React.createElement('div', null,
                                                    React.createElement('label', { htmlFor: `firstName-man-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Meno'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `firstName-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.firstName || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'firstName', e.target.value),
                                                        required: true,
                                                        disabled: loading,
                                                        placeholder: 'Meno člena'
                                                    })
                                                ),
                                                React.createElement('div', null,
                                                    React.createElement('label', { htmlFor: `lastName-man-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Priezvisko'),
                                                    React.createElement('input', {
                                                        type: 'text',
                                                        id: `lastName-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.lastName || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'lastName', e.target.value),
                                                        required: true,
                                                        disabled: loading,
                                                        placeholder: 'Priezvisko člena'
                                                    })
                                                ),
                                                React.createElement('div', null,
                                                    React.createElement('label', { htmlFor: `dateOfBirth-man-${categoryName}-${teamIndex}-${memberIndex}`, className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Dátum narodenia'),
                                                    React.createElement('input', {
                                                        type: 'date',
                                                        id: `dateOfBirth-man-${categoryName}-${teamIndex}-${memberIndex}`,
                                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                                        value: member.dateOfBirth || '',
                                                        onChange: (e) => handleTeamMemberDetailChange(categoryName, teamIndex, memberIndex, 'men', 'dateOfBirth', e.target.value),
                                                        required: true,
                                                        disabled: loading,
                                                    })
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
    );
}

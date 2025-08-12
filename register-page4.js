export function Page4Form({ formData, handlePrev, handleSubmit, loading, setLoading, notificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, NotificationModal, numberOfPlayersLimit, numberOfTeamMembersLimit, teamsDataFromPage4, setTeamsDataFromPage4, closeNotification }) {

    const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

    const handleTeamDetailChange = (categoryName, teamIndex, field, value) => {
        let newValue;

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
                    if (newValue > numberOfPlayersLimit) newValue = numberOfPlayersLimit;
                } else if (field === 'teamMembers') {
                    newValue = parsed;
                    if (newValue < 1 && newValue !== '') newValue = 1;
                    if (newValue > numberOfTeamMembersLimit) newValue = numberOfTeamMembersLimit;
                } else {
                    newValue = parsed; 
                }
            }
        }

        setTeamsDataFromPage4(prevDetails => {
            const newDetails = { ...prevDetails };
            if (!newDetails[categoryName]) {
                newDetails[categoryName] = [];
            }
            if (!newDetails[categoryName][teamIndex]) {
                newDetails[categoryName][teamIndex] = {
                    teamName: '', 
                    players: '', 
                    teamMembers: '',
                    tshirts: [{ size: '', quantity: '' }]
                };
            }
            newDetails[categoryName][teamIndex] = {
                ...newDetails[categoryName][teamIndex],
                [field]: newValue
            };
            return newDetails;
        });
    };

    const handleTshirtSizeChange = (categoryName, teamIndex, tshirtIndex, value) => {
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = { ...prevDetails };
            const team = newDetails[categoryName][teamIndex];
            team.tshirts[tshirtIndex].size = value;
            return newDetails;
        });
    };

    const handleTshirtQuantityChange = (categoryName, teamIndex, tshirtIndex, value) => {
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = { ...prevDetails };
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

    const handleAddTshirtRow = (categoryName, teamIndex) => {
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = { ...prevDetails };
            const team = newDetails[categoryName][teamIndex];
            team.tshirts = [...team.tshirts, { size: '', quantity: '' }];
            return newDetails;
        });
    };

    const handleRemoveTshirtRow = (categoryName, teamIndex, tshirtIndexToRemove) => {
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = { ...prevDetails };
            const team = newDetails[categoryName][teamIndex];
            team.tshirts = team.tshirts.filter((_, idx) => idx !== tshirtIndexToRemove);
            if (team.tshirts.length === 0) {
                team.tshirts.push({ size: '', quantity: '' });
            }
            return newDetails;
        });
    };

    const getAvailableTshirtSizeOptions = (teamTshirts, currentIndex = -1) => {
        const selectedSizesInOtherRows = teamTshirts
            .filter((tshirt, idx) => idx !== currentIndex && tshirt.size !== '')
            .map(tshirt => tshirt.size);

        return TSHIRT_SIZES.filter(size => !selectedSizesInOtherRows.includes(size));
    };

    const getPerTeamTshirtValidationMessage = React.useCallback((diff, currentCategoryName, currentTeamName) => {
        if (diff === 0) return '';

        const absDiff = Math.abs(diff);
        const messagePrefix = diff > 0 
            ? `Pre pokračovanie v registrácii na turnaj je potrebné v kategórii ${currentCategoryName} pre tím ${currentTeamName} objednať ešte `
            : `Pre pokračovanie v registrácii na turnaj je potrebné v kategórii ${currentCategoryName} pre tím ${currentTeamName} zrušiť `;

        let messageSuffix;
        if (absDiff === 1) {
            messageSuffix = diff > 0 ? ' tričko.' : ' objednané tričko.';
        } else if (absDiff >= 2 && absDiff <= 4) {
            messageSuffix = diff > 0 ? ' tričká.' : ' objednané tričká.';
        } else {
            messageSuffix = diff > 0 ? ' tričiek.' : ' objednaných tričiek.';
        }

        return `${messagePrefix}${absDiff} ${messageSuffix}`;
    }, []);

    const isFormValidPage4 = React.useMemo(() => {
        if (!teamsDataFromPage4 || Object.keys(teamsDataFromPage4).length === 0) {
            return false;
        }

        let allTshirtsMatch = true;

        for (const categoryName in teamsDataFromPage4) {
            for (const team of (teamsDataFromPage4[categoryName] || []).filter(t => t)) {
                if (!team || typeof team.teamName !== 'string' || !team.teamName.trim()) {
                    console.error("Validácia zlyhala: Názov tímu je neplatný alebo chýba pre kategóriu:", categoryName, "Tím:", team);
                    return false;
                }
                
                const playersValue = parseInt(team.players, 10);
                if (isNaN(playersValue) || playersValue < 1 || playersValue > numberOfPlayersLimit) {
                    return false;
                }

                const teamMembersValue = parseInt(team.teamMembers, 10);
                if (isNaN(teamMembersValue) || teamMembersValue < 1 || teamMembersValue > numberOfTeamMembersLimit) {
                    return false;
                }

                for (const tshirt of (team.tshirts || [])) {
                    if (tshirt.size === '' || isNaN(parseInt(tshirt.quantity, 10)) || parseInt(tshirt.quantity, 10) < 0) {
                        return false;
                    }
                }

                const teamRequiredTshirts = (isNaN(parseInt(team.players, 10)) ? 0 : parseInt(team.players, 10)) + 
                                            (isNaN(parseInt(team.teamMembers, 10)) ? 0 : parseInt(team.teamMembers, 10));
                
                let teamOrderedTshirts = 0;
                for (const tshirt of (team.tshirts || [])) {
                    teamOrderedTshirts += (isNaN(parseInt(tshirt.quantity, 10)) ? 0 : parseInt(tshirt.quantity, 10));
                }

                if (teamRequiredTshirts !== teamOrderedTshirts) {
                    allTshirtsMatch = false;
                }
            }
        }
        return allTshirtsMatch;
    }, [teamsDataFromPage4, numberOfPlayersLimit, numberOfTeamMembersLimit]);

    const registerButtonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
    ${loading || !isRecaptchaReady || !isFormValidPage4
      ? 'bg-white text-green-500 border border-green-500 cursor-not-allowed'
      : 'bg-green-500 hover:bg-green-700 text-white'
    }
  `;

    const handleFinalSubmit = async (e) => {
        e.preventDefault();
        if (typeof setLoading === 'function') setLoading(true);
        if (typeof setNotificationMessage === 'function') setNotificationMessage('');
        if (typeof setShowNotification === 'function') setShowNotification(false);
        if (typeof setNotificationType === 'function') setNotificationType('info');

        if (!isFormValidPage4) {
            if (typeof setNotificationMessage === 'function') {
                setNotificationMessage('Prosím, skontrolujte všetky polia tímu a objednávky tričiek. Všetky požiadavky musia byť splnené.');
                setShowNotification(true);
                setNotificationType('error');
            }
            if (typeof setLoading === 'function') setLoading(false);
            return;
        }
        
        const teamsDataToSave = JSON.parse(JSON.stringify(teamsDataFromPage4));
        for (const categoryName in teamsDataToSave) {
            teamsDataToSave[categoryName] = teamsDataToSave[categoryName].map(team => ({
                ...team,
                players: team.players === '' ? 0 : team.players,
                teamMembers: team.teamMembers === '' ? 0 : team.teamMembers,
                tshirts: team.tshirts.map(tshirt => ({
                    ...tshirt,
                    quantity: tshirt.quantity === '' ? 0 : tshirt.quantity
                }))
            }));
        }

        await handleSubmit(teamsDataToSave);
        if (typeof setLoading === 'function') setLoading(false);
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: "error" }),

        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
            'Registrácia - Detaily tímov'
        ),
        React.createElement(
            'form',
            { onSubmit: handleFinalSubmit, className: 'space-y-4' },
            Object.keys(teamsDataFromPage4).length === 0 ? (
                React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Prejdite prosím na predchádzajúcu stránku a vyberte kategórie s počtom tímov.')
            ) : (
                Object.keys(teamsDataFromPage4).map(categoryName => (
                    React.createElement(
                        'div',
                        { key: categoryName, className: 'border-t border-gray-200 pt-4 mt-4' },
                        React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, `Kategória: ${categoryName}`),
                        (teamsDataFromPage4[categoryName] || []).filter(t => t).map((team, teamIndex) => {
                            const teamRequiredTshirts = (isNaN(parseInt(team.players, 10)) ? 0 : parseInt(team.players, 10)) + 
                                                        (isNaN(parseInt(team.teamMembers, 10)) ? 0 : parseInt(team.teamMembers, 10));
                            
                            let teamOrderedTshirts = 0;
                            for (const tshirt of (team.tshirts || [])) {
                                teamOrderedTshirts += (isNaN(parseInt(tshirt.quantity, 10)) ? 0 : parseInt(tshirt.quantity, 10));
                            }
                            const teamTshirtDifference = teamRequiredTshirts - teamOrderedTshirts;

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
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `players-${categoryName}-${teamIndex}` }, `Počet hráčov (min: 1, max: ${numberOfPlayersLimit})`),
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
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `teamMembers-${categoryName}-${teamIndex}` }, `Počet členov realizačného tímu (min: 1, max: ${numberOfTeamMembersLimit})`),
                                    React.createElement('input', {
                                        type: 'number',
                                        id: `teamMembers-${categoryName}-${teamIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: team.teamMembers,
                                        onChange: (e) => handleTeamDetailChange(categoryName, teamIndex, 'teamMembers', e.target.value),
                                        placeholder: 'Zadajte počet členov realizačného tímu',
                                        disabled: loading,
                                    })
                                ),
                                
                                React.createElement(
                                    'div',
                                    { className: 'border-t border-gray-200 pt-4 mt-4' },
                                    React.createElement('h4', { className: 'text-base font-bold mb-2 text-gray-700' }, 'Účastnícke tričká'),
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center font-bold mb-2 space-x-2' },
                                        React.createElement('span', { className: 'flex-1 text-gray-700' }, 'Veľkosť'),
                                        React.createElement('span', { className: 'w-28 text-left text-gray-700' }, 'Množstvo'),
                                        React.createElement('span', { className: 'w-8' })
                                    ),
                                    (team.tshirts || [{ size: '', quantity: '' }]).map((tshirt, tshirtIndex) => (
                                        React.createElement(
                                            'div',
                                            { key: tshirtIndex, className: 'flex items-center space-x-2 mb-2' },
                                            React.createElement(
                                                'select',
                                                {
                                                    className: 'shadow border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 flex-1',
                                                    value: tshirt.size,
                                                    onChange: (e) => handleTshirtSizeChange(categoryName, teamIndex, tshirtIndex, e.target.value),
                                                    required: true,
                                                    disabled: loading,
                                                },
                                                React.createElement('option', { value: '' }, 'Vyberte veľkosť'),
                                                getAvailableTshirtSizeOptions(team.tshirts, tshirtIndex).map(size => (
                                                    React.createElement('option', { key: size, value: size }, size)
                                                ))
                                            ),
                                            React.createElement('input', {
                                                type: 'number',
                                                className: 'shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-28 text-left',
                                                value: tshirt.quantity,
                                                onChange: (e) => handleTshirtQuantityChange(categoryName, teamIndex, tshirtIndex, e.target.value),
                                                min: 0,
                                                required: true,
                                                disabled: loading,
                                            }),
                                            React.createElement(
                                                'button',
                                                {
                                                    type: 'button',
                                                    onClick: () => handleRemoveTshirtRow(categoryName, teamIndex, tshirtIndex),
                                                    className: `bg-red-500 hover:bg-red-700 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 focus:outline-none focus:shadow-outline ${team.tshirts.length === 1 ? 'invisible' : ''}`,
                                                    disabled: loading || team.tshirts.length === 1,
                                                },
                                                '-'
                                            )
                                        )
                                    )),
                                    getAvailableTshirtSizeOptions(team.tshirts).length > 0 && React.createElement(
                                        'button',
                                        {
                                            type: 'button',
                                            onClick: () => handleAddTshirtRow(categoryName, teamIndex),
                                            className: `
                                                font-bold w-10 h-10 rounded-full flex items-center justify-center mx-auto mt-4 
                                                transition-colors duration-200 focus:outline-none focus:shadow-outline
                                                ${loading || team.tshirts.some(t => t.size === '' || t.quantity === '' || isNaN(parseInt(t.quantity, 10))) || getAvailableTshirtSizeOptions(team.tshirts).length === 0
                                                    ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
                                                    : 'bg-blue-500 hover:bg-blue-700 text-white'
                                                }
                                            `.trim(),
                                            disabled: loading || team.tshirts.some(t => t.size === '' || t.quantity === '' || isNaN(parseInt(t.quantity, 10))) || getAvailableTshirtSizeOptions(team.tshirts).length === 0,
                                        },
                                        '+'
                                    )
                                ),
                                teamTshirtDifference !== 0 && React.createElement(
                                    'div',
                                    { className: `mt-2 p-2 rounded-lg text-center font-bold bg-red-100 text-red-700` },
                                    getPerTeamTshirtValidationMessage(teamTshirtDifference, categoryName, team.teamName)
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
                        tabIndex: 1
                    },
                    'Späť'
                ),
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: registerButtonClasses,
                        disabled: loading || !isRecaptchaReady || !isFormValidPage4,
                        tabIndex: 2
                    },
                    loading ? React.createElement(
                        'div',
                        { className: 'flex items-center justify-center' },
                        React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-green-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                            React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                            React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                        ),
                        'Registrujem...'
                    ) : 'Registrovať sa'
                )
            )
        )
    );
}

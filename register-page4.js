export function Page4Form({ formData, handlePrev, handleSubmit, loading, setLoading, notificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, NotificationModal, numberOfPlayersLimit, numberOfTeamMembersLimit, teamsDataFromPage4, setTeamsDataFromPage4, closeNotification }) {

    // Rozšírený zoznam veľkostí tričiek
    const TSHIRT_SIZES = ['134 - 140', '146 - 152', '158 - 164', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

    // Spracovanie zmeny detailov tímu (napr. názov, počet hráčov, počet žien/mužov v realizačnom tíme)
    const handleTeamDetailChange = (categoryName, teamIndex, field, value) => {
        let newValue;

        if (value === '') {
            newValue = ''; // Ak je hodnota prázdna, nastavíme ju na prázdny reťazec
        } else {
            let parsed = parseInt(value, 10); // Pokúsime sa parsovať hodnotu na celé číslo
            
            if (isNaN(parsed)) {
                newValue = ''; // Ak sa parslovanie nepodarí, nastavíme na prázdny reťazec
            } else {
                // Obmedzenia pre počet hráčov, žien a mužov v realizačnom tíme
                if (field === 'players') {
                    newValue = parsed;
                    if (newValue < 1 && newValue !== '') newValue = 1; // Minimálne 1 hráč
                    if (newValue > numberOfPlayersLimit) newValue = numberOfPlayersLimit; // Maximálny počet hráčov z databázy
                } else if (field === 'womenTeamMembers' || field === 'menTeamMembers') {
                    newValue = parsed;
                    if (newValue < 0 && newValue !== '') newValue = 0; // Minimálne 0 členov
                    // Kontrola maximálneho počtu sa vykonáva až vo validácii isFormValidPage4 pre súčet mužov a žien
                } else {
                    newValue = parsed; 
                }
            }
        }

        // Aktualizácia stavu teamsDataFromPage4 s novými detailmi tímu
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = { ...prevDetails };
            if (!newDetails[categoryName]) {
                newDetails[categoryName] = [];
            }
            if (!newDetails[categoryName][teamIndex]) {
                newDetails[categoryName][teamIndex] = {
                    teamName: '', 
                    players: '', 
                    womenTeamMembers: '', // Nové pole pre počet žien
                    menTeamMembers: '',   // Nové pole pre počet mužov
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

    // Spracovanie zmeny veľkosti trička
    const handleTshirtSizeChange = (categoryName, teamIndex, tshirtIndex, value) => {
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = { ...prevDetails };
            const team = newDetails[categoryName][teamIndex];
            team.tshirts[tshirtIndex].size = value;
            return newDetails;
        });
    };

    // Spracovanie zmeny množstva trička
    const handleTshirtQuantityChange = (categoryName, teamIndex, tshirtIndex, value) => {
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = { ...prevDetails };
            const team = newDetails[categoryName][teamIndex];
            let parsedQuantity = parseInt(value, 10);
            if (isNaN(parsedQuantity) || value === '') {
                team.tshirts[tshirtIndex].quantity = ''; // Ak je hodnota neplatná alebo prázdna
            } else {
                team.tshirts[tshirtIndex].quantity = Math.max(0, parsedQuantity); // Množstvo nesmie byť záporné
            }
            return newDetails;
        });
    };

    // Pridanie nového riadku pre tričko
    const handleAddTshirtRow = (categoryName, teamIndex) => {
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = { ...prevDetails };
            const team = newDetails[categoryName][teamIndex];
            team.tshirts = [...team.tshirts, { size: '', quantity: '' }]; // Pridanie nového prázdneho riadku
            return newDetails;
        });
    };

    // Odstránenie riadku pre tričko
    const handleRemoveTshirtRow = (categoryName, teamIndex, tshirtIndexToRemove) => {
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = { ...prevDetails };
            const team = newDetails[categoryName][teamIndex];
            team.tshirts = team.tshirts.filter((_, idx) => idx !== tshirtIndexToRemove); // Odstránenie vybraného riadku
            if (team.tshirts.length === 0) {
                team.tshirts.push({ size: '', quantity: '' }); // Ak bol odstránený posledný, pridáme prázdny
            }
            return newDetails;
        });
    };

    // Získanie dostupných veľkostí tričiek (aby sa neopakovali už vybrané)
    const getAvailableTshirtSizeOptions = (teamTshirts, currentIndex = -1) => {
        const selectedSizesInOtherRows = teamTshirts
            .filter((tshirt, idx) => idx !== currentIndex && tshirt.size !== '')
            .map(tshirt => tshirt.size);

        return TSHIRT_SIZES.filter(size => !selectedSizesInOtherRows.includes(size));
    };

    // Vytvorenie správy o validácii tričiek pre každý tím
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

    // Validácia celého formulára pre stránku 4
    const isFormValidPage4 = React.useMemo(() => {
        // Ak nie sú žiadne tímy, formulár nie je platný
        if (!teamsDataFromPage4 || Object.keys(teamsDataFromPage4).length === 0) {
            return false;
        }

        let allTshirtsMatch = true; // Predpokladáme, že všetky tričká sedia

        // Prechádzame všetky kategórie a tímy
        for (const categoryName in teamsDataFromPage4) {
            for (const team of (teamsDataFromPage4[categoryName] || []).filter(t => t)) {
                // Kontrola názvu tímu
                if (!team || typeof team.teamName !== 'string' || !team.teamName.trim()) {
                    console.error("Validácia zlyhala: Názov tímu je neplatný alebo chýba pre kategóriu:", categoryName, "Tím:", team);
                    return false;
                }
                
                // Validácia počtu hráčov
                const playersValue = parseInt(team.players, 10);
                if (isNaN(playersValue) || playersValue < 1 || playersValue > numberOfPlayersLimit) {
                    return false;
                }

                // Validácia počtu žien a mužov realizačného tímu
                const womenTeamMembersValue = parseInt(team.womenTeamMembers, 10);
                const menTeamMembersValue = parseInt(team.menTeamMembers, 10);

                if (isNaN(womenTeamMembersValue) || womenTeamMembersValue < 0) return false;
                if (isNaN(menTeamMembersValue) || menTeamMembersValue < 0) return false;

                // Súčet žien a mužov musí byť v rámci limitu
                if ((womenTeamMembersValue + menTeamMembersValue) > numberOfTeamMembersLimit) {
                    return false;
                }
                if ((womenTeamMembersValue + menTeamMembersValue) < 0 && (womenTeamMembersValue + menTeamMembersValue) !== '') {
                    return false;
                }

                // Validácia detailov tričiek
                for (const tshirt of (team.tshirts || [])) {
                    if (tshirt.size === '' || isNaN(parseInt(tshirt.quantity, 10)) || parseInt(tshirt.quantity, 10) < 0) {
                        return false;
                    }
                }

                // Výpočet potrebných tričiek (hráči + realizačný tím)
                const teamRequiredTshirts = (isNaN(parseInt(team.players, 10)) ? 0 : parseInt(team.players, 10)) + 
                                            (isNaN(parseInt(team.womenTeamMembers, 10)) ? 0 : parseInt(team.womenTeamMembers, 10)) +
                                            (isNaN(parseInt(team.menTeamMembers, 10)) ? 0 : parseInt(team.menTeamMembers, 10));
                
                // Súčet objednaných tričiek
                let teamOrderedTshirts = 0;
                for (const tshirt of (team.tshirts || [])) {
                    teamOrderedTshirts += (isNaN(parseInt(tshirt.quantity, 10)) ? 0 : parseInt(tshirt.quantity, 10));
                }

                // Ak sa počty nezhodujú, nastavíme allTshirtsMatch na false
                if (teamRequiredTshirts !== teamOrderedTshirts) {
                    allTshirtsMatch = false;
                }
            }
        }
        return allTshirtsMatch; // Vrátime výsledok validácie
    }, [teamsDataFromPage4, numberOfPlayersLimit, numberOfTeamMembersLimit]);

    // CSS triedy pre tlačidlo registrácie
    const registerButtonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
    ${loading || !isRecaptchaReady || !isFormValidPage4
      ? 'bg-white text-green-500 border border-green-500 cursor-not-allowed'
      : 'bg-green-500 hover:bg-green-700 text-white'
    }
  `;

    // Funkcia pre finálne odoslanie formulára
    const handleFinalSubmit = async (e) => {
        e.preventDefault();
        // Nastavenie stavov načítania a notifikácií
        if (typeof setLoading === 'function') setLoading(true);
        if (typeof setNotificationMessage === 'function') setNotificationMessage('');
        if (typeof setShowNotification === 'function') setShowNotification(false);
        if (typeof setNotificationType === 'function') setNotificationType('info');

        // Ak formulár nie je platný, zobrazíme chybovú správu
        if (!isFormValidPage4) {
            if (typeof setNotificationMessage === 'function') {
                setNotificationMessage('Prosím, skontrolujte všetky polia tímu a objednávky tričiek. Všetky požiadavky musia byť splnené.');
                setShowNotification(true);
                setNotificationType('error');
            }
            if (typeof setLoading === 'function') setLoading(false);
            return;
        }
        
        // Príprava dát pred odoslaním (konverzia prázdnych reťazcov na 0)
        const teamsDataToSave = JSON.parse(JSON.stringify(teamsDataFromPage4));
        for (const categoryName in teamsDataToSave) {
            teamsDataToSave[categoryName] = teamsDataToSave[categoryName].map(team => ({
                ...team,
                players: team.players === '' ? 0 : team.players,
                womenTeamMembers: team.womenTeamMembers === '' ? 0 : team.womenTeamMembers, // Konverzia
                menTeamMembers: team.menTeamMembers === '' ? 0 : team.menTeamMembers,       // Konverzia
                tshirts: team.tshirts.map(tshirt => ({
                    ...tshirt,
                    quantity: tshirt.quantity === '' ? 0 : tshirt.quantity
                }))
            }));
        }

        // Odoslanie spracovaných dát
        await handleSubmit(teamsDataToSave);
        if (typeof setLoading === 'function') setLoading(false);
    };

    return React.createElement(
        React.Fragment,
        null,
        // Modálne okno pre notifikácie
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: "error" }),

        // Nadpis stránky
        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
            'Registrácia - Detaily tímov'
        ),
        // Formulár pre detaily tímov
        React.createElement(
            'form',
            { onSubmit: handleFinalSubmit, className: 'space-y-4' },
            // Ak nie sú žiadne tímy vybrané, zobrazíme správu
            Object.keys(teamsDataFromPage4).length === 0 ? (
                React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Prejdite prosím na predchádzajúcu stránku a vyberte kategórie s počtom tímov.')
            ) : (
                // Mapovanie cez kategórie a tímy
                Object.keys(teamsDataFromPage4).map(categoryName => (
                    React.createElement(
                        'div',
                        { key: categoryName, className: 'border-t border-gray-200 pt-4 mt-4' },
                        React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, `Kategória: ${categoryName}`),
                        (teamsDataFromPage4[categoryName] || []).filter(t => t).map((team, teamIndex) => {
                            // Výpočet potrebných tričiek pre každý tím
                            const teamRequiredTshirts = (isNaN(parseInt(team.players, 10)) ? 0 : parseInt(team.players, 10)) + 
                                                        (isNaN(parseInt(team.womenTeamMembers, 10)) ? 0 : parseInt(team.womenTeamMembers, 10)) +
                                                        (isNaN(parseInt(team.menTeamMembers, 10)) ? 0 : parseInt(team.menTeamMembers, 10));
                            
                            let teamOrderedTshirts = 0;
                            for (const tshirt of (team.tshirts || [])) {
                                teamOrderedTshirts += (isNaN(parseInt(tshirt.quantity, 10)) ? 0 : parseInt(tshirt.quantity, 10));
                            }
                            const teamTshirtDifference = teamRequiredTshirts - teamOrderedTshirts;

                            return React.createElement(
                                'div',
                                { key: `${categoryName}-${teamIndex}`, className: 'bg-blue-50 p-4 rounded-lg mb-4 space-y-2' },
                                React.createElement('p', { className: 'font-semibold text-blue-800' }, `Tím ${teamIndex + 1}`),
                                // Názov tímu
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
                                // Počet hráčov
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
                                // Počet žien realizačného tímu
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `womenTeamMembers-${categoryName}-${teamIndex}` }, `Počet žien realizačného tímu`),
                                    React.createElement('input', {
                                        type: 'number',
                                        id: `womenTeamMembers-${categoryName}-${teamIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: team.womenTeamMembers,
                                        onChange: (e) => handleTeamDetailChange(categoryName, teamIndex, 'womenTeamMembers', e.target.value),
                                        placeholder: 'Zadajte počet žien',
                                        min: 0, // Pridame min pre zeny
                                        disabled: loading,
                                    })
                                ),
                                // Počet mužov realizačného tímu
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `menTeamMembers-${categoryName}-${teamIndex}` }, `Počet mužov realizačného tímu`),
                                    React.createElement('input', {
                                        type: 'number',
                                        id: `menTeamMembers-${categoryName}-${teamIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: team.menTeamMembers,
                                        onChange: (e) => handleTeamDetailChange(categoryName, teamIndex, 'menTeamMembers', e.target.value),
                                        placeholder: 'Zadajte počet mužov',
                                        min: 0, // Pridame min pre muzov
                                        disabled: loading,
                                    })
                                ),
                                
                                // Sekcia pre účastnícke tričká
                                React.createElement(
                                    'div',
                                    { className: 'border-t border-gray-200 pt-4 mt-4' },
                                    React.createElement('h4', { className: 'text-base font-bold mb-2 text-gray-700' }, 'Účastnícke tričká'),
                                    // Nový text "Všetky sú unisex."
                                    React.createElement('p', { className: 'text-sm text-gray-600 mb-4' }, 'Všetky sú unisex.'),
                                    // Hlavička pre riadky s tričkami
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center font-bold mb-2 space-x-2' },
                                        React.createElement('span', { className: 'flex-1 text-gray-700' }, 'Veľkosť'),
                                        React.createElement('span', { className: 'w-28 text-left text-gray-700' }, 'Množstvo'),
                                        React.createElement('span', { className: 'w-8' })
                                    ),
                                    // Mapovanie cez riadky s tričkami
                                    (team.tshirts || [{ size: '', quantity: '' }]).map((tshirt, tshirtIndex) => (
                                        React.createElement(
                                            'div',
                                            { key: tshirtIndex, className: 'flex items-center space-x-2 mb-2' },
                                            // Výber veľkosti trička
                                            React.createElement(
                                                'select',
                                                {
                                                    className: 'shadow border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-1/4', // Upravená šírka
                                                    value: tshirt.size,
                                                    onChange: (e) => handleTshirtSizeChange(categoryName, teamIndex, tshirtIndex, e.target.value),
                                                    required: true,
                                                    disabled: loading,
                                                },
                                                React.createElement('option', { value: '' }, 'Vyberte'), // Upravený text
                                                // Mapovanie dostupných veľkostí
                                                getAvailableTshirtSizeOptions(team.tshirts, tshirtIndex).map(size => (
                                                    React.createElement('option', { key: size, value: size }, size)
                                                ))
                                            ),
                                            // Zadanie množstva trička
                                            React.createElement('input', {
                                                type: 'number',
                                                className: 'shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-28 text-left',
                                                value: tshirt.quantity,
                                                onChange: (e) => handleTshirtQuantityChange(categoryName, teamIndex, tshirtIndex, e.target.value),
                                                min: 0,
                                                required: true,
                                                disabled: loading,
                                                placeholder: 'Zadajte počet', // Pridaný placeholder
                                            }),
                                            // Tlačidlo na odstránenie riadku trička
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
                                    // Tlačidlo na pridanie riadku trička (zobrazí sa len ak sú ešte dostupné veľkosti)
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
                                // Zobrazenie validačnej správy pre tričká, ak je rozdiel
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

            // Ovládacie tlačidlá formulára (Späť a Registrovať sa)
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
                    // Zobrazenie načítavacieho spinnera počas registrácie
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

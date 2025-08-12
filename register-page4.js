// register-page4.js
// Obsahuje komponenty a logiku pre štvrtú (finálnu) stránku registračného formulára - detaily tímov.

export function Page4Form({ formData, handlePrev, handleSubmit, loading, setLoading, notificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, NotificationModal, numberOfPlayersLimit, numberOfTeamMembersLimit, teamsDataFromPage4, setTeamsDataFromPage4, closeNotification }) {
    // formData.categories obsahuje štruktúru: { 'Kategória Názov': { numberOfTeams: X }, ... }
    // Vytvoríme počiatočný stav pre tímy na základe formData.categories a numberOfTeamsFromPage3
    const [teamDetails, setTeamDetails] = React.useState(() => {
        const initialDetails = {};
        // Ak už máme dáta z Page4 (napr. pri návrate "Späť"), použijeme tie
        if (Object.keys(teamsDataFromPage4).length > 0) {
            return teamsDataFromPage4;
        }

        const clubName = formData.billing.clubName || ''; // Získame názov klubu z formData

        if (formData.categories) {
            Object.keys(formData.categories).forEach(categoryName => {
                const numTeams = formData.categories[categoryName].numberOfTeams;
                initialDetails[categoryName] = Array.from({ length: numTeams }).map((_, teamIndex) => {
                    // Generovanie názvu tímu: NázovKlubu A, NázovKlubu B, atď., ak je viac ako 1 tím
                    const suffix = numTeams > 1 ? ` ${String.fromCharCode('A'.charCodeAt(0) + teamIndex)}` : '';
                    return {
                        teamName: `${clubName}${suffix}`, // Automaticky generovaný názov tímu
                        players: 1, // Predvolené na 1
                        teamMembers: 0, // Predvolené na 0
                    };
                });
            });
        }
        return initialDetails;
    });

    // useEffect pre aktualizáciu teamDetails, ak sa zmenia formData.categories (napr. pri návrate z inej strany a zmene kategórií)
    // ALEBO ak sa zmení názov klubu, pregenerujeme názvy tímov (ak už nie sú zadané z teamsDataFromPage4)
    React.useEffect(() => {
        // Ak sú už dáta teamsDataFromPage4 naplnené (napr. pri návrate na stranu 4), neprepisujeme ich automaticky
        if (Object.keys(teamsDataFromPage4).length === 0) {
            const newDetails = {};
            const clubName = formData.billing.clubName || '';

            if (formData.categories) {
                Object.keys(formData.categories).forEach(categoryName => {
                    const numTeams = formData.categories[categoryName].numberOfTeams;
                    const existingTeams = teamDetails[categoryName] || [];
                    const updatedTeams = Array.from({ length: numTeams }).map((_, teamIndex) => {
                        const suffix = numTeams > 1 ? ` ${String.fromCharCode('A'.charCodeAt(0) + teamIndex)}` : '';
                        return {
                            ...existingTeams[teamIndex], // Zachovať existujúce dáta (napr. počet hráčov/členov tímu)
                            teamName: `${clubName}${suffix}`, // Automaticky generovaný názov tímu
                            players: existingTeams[teamIndex]?.players || 1, // Zachovať existujúci počet hráčov, inak predvolené na 1
                            teamMembers: existingTeams[teamIndex]?.teamMembers || 0, // Zachovať existujúci počet členov tímu, inak predvolené na 0
                        };
                    });
                    newDetails[categoryName] = updatedTeams;
                });
            }
            // Iba aktualizujeme stav, ak sa naozaj zmenil, aby sme predišli nekonečnej slučke
            if (JSON.stringify(newDetails) !== JSON.stringify(teamDetails)) {
                setTeamDetails(newDetails);
                setTeamsDataFromPage4(newDetails); // Aktualizovať aj stav v App.js
            }
        }
    }, [formData.categories, formData.billing.clubName, setTeamsDataFromPage4]); // Pridané formData.billing.clubName ako závislosť

    // Handler pre zmenu názvu tímu, počtu hráčov alebo členov tímu
    // Poznámka: onChange pre názov tímu je teraz odstránený, pretože je automaticky generovaný a zablokovaný
    const handleTeamDetailChange = (categoryName, teamIndex, field, value) => {
        setTeamDetails(prevDetails => {
            const newDetails = { ...prevDetails };
            newDetails[categoryName] = [...(newDetails[categoryName] || [])]; // Zabezpečiť, že je to pole
            newDetails[categoryName][teamIndex] = {
                ...(newDetails[categoryName][teamIndex] || {}),
                [field]: parseInt(value, 10) || 0 // Prevod na číslo pre počty (názov tímu sa nemení cez tento handler)
            };
            return newDetails;
        });
        // Aktualizovať aj stav v App.js
        setTeamsDataFromPage4(prevDetails => {
            const newDetails = { ...prevDetails };
            newDetails[categoryName] = [...(newDetails[categoryName] || [])];
            newDetails[categoryName][teamIndex] = {
                ...(newDetails[categoryName][teamIndex] || {}),
                [field]: parseInt(value, 10) || 0
            };
            return newDetails;
        });
    };

    // Validácia formulára pre stranu 4
    const isFormValidPage4 = React.useMemo(() => {
        if (!teamDetails || Object.keys(teamDetails).length === 0) return false;

        for (const categoryName in teamDetails) {
            for (const team of teamDetails[categoryName]) {
                if (!team.teamName.trim()) return false; // Názov tímu je povinný (aj keď auto-generovaný)
                if (team.players < 1 || team.players > numberOfPlayersLimit) return false; // Min 1, Max podľa nastavení
                if (team.teamMembers < 0 || team.teamMembers > numberOfTeamMembersLimit) return false; // Min 0, Max podľa nastavení
            }
        }
        return true;
    }, [teamDetails, numberOfPlayersLimit, numberOfTeamMembersLimit]);

    // Dynamické triedy pre tlačidlo "Registrovať sa"
    const registerButtonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
    ${loading || !isRecaptchaReady || !isFormValidPage4
      ? 'bg-white text-green-500 border border-green-500 cursor-not-allowed'
      : 'bg-green-500 hover:bg-green-700 text-white'
    }
  `;

    // Handler pre finálne odoslanie formulára
    const handleFinalSubmit = async (e) => {
        e.preventDefault();
        if (typeof setLoading === 'function') setLoading(true);
        if (typeof setNotificationMessage === 'function') setNotificationMessage('');
        if (typeof setShowNotification === 'function') setShowNotification(false);
        if (typeof setNotificationType === 'function') setNotificationType('info');

        if (!isFormValidPage4) {
            if (typeof setNotificationMessage === 'function') {
                setNotificationMessage('Prosím, skontrolujte všetky polia tímu. Názov tímu je povinný a počty hráčov/členov tímu musia byť v rámci povolených limitov.');
                setShowNotification(true);
                setNotificationType('error');
            }
            if (typeof setLoading === 'function') setLoading(false);
            return;
        }
        
        // Predáme teamDetails rodičovskému komponentu na uloženie do Firestore
        await handleSubmit(teamDetails);
        if (typeof setLoading === 'function') setLoading(false);
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: "error" }),

        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
            'Registrácia - Detaily tímov' // Nový nadpis
        ),
        React.createElement(
            'form',
            { onSubmit: handleFinalSubmit, className: 'space-y-4' },
            Object.keys(teamDetails).length === 0 ? (
                React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Prejdite prosím na predchádzajúcu stránku a vyberte kategórie s počtom tímov.')
            ) : (
                Object.keys(teamDetails).map(categoryName => (
                    React.createElement(
                        'div',
                        { key: categoryName, className: 'border-t border-gray-200 pt-4 mt-4' },
                        React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, `Kategória: ${categoryName}`),
                        (teamDetails[categoryName] || []).map((team, teamIndex) => (
                            React.createElement(
                                'div',
                                { key: `${categoryName}-${teamIndex}`, className: 'bg-blue-50 p-4 rounded-lg mb-4 space-y-2' },
                                React.createElement('p', { className: 'font-semibold text-blue-800' }, `Tím ${teamIndex + 1}`),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `teamName-${categoryName}-${teamIndex}` }, 'Názov tímu'),
                                    // Zmena z inputboxu na zalamovateľný text
                                    React.createElement('p', {
                                        id: `teamName-${categoryName}-${teamIndex}`,
                                        className: 'text-gray-700 py-2 px-3 break-words', // Pridané break-words pre zalamovanie dlhého textu
                                        style: { cursor: 'default' }, // Zmenený kurzor na default
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
                                        min: 1,
                                        max: numberOfPlayersLimit,
                                        required: true,
                                        disabled: loading,
                                    })
                                ),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `teamMembers-${categoryName}-${teamIndex}` }, `Počet členov realizačného tímu (min: 0, max: ${numberOfTeamMembersLimit})`),
                                    React.createElement('input', {
                                        type: 'number',
                                        id: `teamMembers-${categoryName}-${teamIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: team.teamMembers,
                                        onChange: (e) => handleTeamDetailChange(categoryName, teamIndex, 'teamMembers', e.target.value),
                                        min: 0,
                                        max: numberOfTeamMembersLimit,
                                        required: true, // Je nutné, aby pole existovalo pre validáciu
                                        disabled: loading,
                                    })
                                ),
                            )
                        ))
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
                        tabIndex: 1 // Vráti sa na predchádzajúcu stránku
                    },
                    'Späť'
                ),
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: registerButtonClasses,
                        disabled: loading || !isRecaptchaReady || !isFormValidPage4, // Aktualizovaná podmienka disable
                        tabIndex: 2 // Finálne odoslanie
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

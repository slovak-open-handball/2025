// register-page4.js
// Obsahuje komponenty a logiku pre štvrtú (finálnu) stránku registračného formulára - detaily tímov.

export function Page4Form({ formData, handlePrev, handleSubmit, loading, setLoading, notificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, NotificationModal, numberOfPlayersLimit, numberOfTeamMembersLimit, teamsDataFromPage4, setTeamsDataFromPage4, closeNotification }) {
    // teamDetails bude teraz lokálny stav, ktorý sa dynamicky inicializuje v useEffect
    const [teamDetails, setTeamDetails] = React.useState({});

    // useEffect pre robustnú aktualizáciu teamDetails pri zmenách formData
    React.useEffect(() => {
        const clubName = formData.billing.clubName || '';
        const newDetails = {};

        if (formData.categories) {
            Object.keys(formData.categories).forEach(categoryName => {
                const numTeams = formData.categories[categoryName].numberOfTeams;

                // Zabezpečiť, že numTeams je platné číslo, inak predvolené na 0
                const actualNumTeams = typeof numTeams === 'number' && !isNaN(numTeams) ? numTeams : 0;

                // Pokúste sa zachovať existujúce názvy tímov/hráčov/členov, ak sú k dispozícii,
                // ale názvy tímov pregenerujte na základe aktuálneho clubName
                const existingTeams = teamDetails[categoryName] || []; // Získajte existujúce tímy z aktuálneho stavu

                newDetails[categoryName] = Array.from({ length: actualNumTeams }).map((_, teamIndex) => {
                    const suffix = actualNumTeams > 1 ? ` ${String.fromCharCode('A'.charCodeAt(0) + teamIndex)}` : '';
                    const generatedTeamName = `${clubName}${suffix}`;

                    // Zachovať hráčov a členov realizačného tímu, ak existovali pre tento konkrétny index tímu a kategóriu
                    const existingTeamData = existingTeams[teamIndex] || {};

                    return {
                        teamName: generatedTeamName, // Vždy pregenerujte názov na základe aktuálneho clubName
                        players: existingTeamData.players || 1, // Zachovať alebo predvolené na 1
                        teamMembers: existingTeamData.teamMembers || 1, // Zachovať alebo predvolené na 1
                    };
                });
            });
        }

        // Iba aktualizujte stav, ak sa naozaj zmenil, aby ste predišli nekonečnej slučke
        // JSON.stringify sa používa pre hĺbkové porovnanie objektov
        if (JSON.stringify(newDetails) !== JSON.stringify(teamDetails)) {
            setTeamDetails(newDetails);
            // Ak chceme, aby sa zmeny v Page4Form prejavili aj v rodičovskom komponente (App.js) okamžite,
            // môžeme tu zavolať setTeamsDataFromPage4. Avšak, je dôležité zvážiť, či to nespôsobí
            // nekonečnú slučku, ak setTeamsDataFromPage4 tiež spustí tento useEffect.
            // Pre tento prípad je lepšie nechať odovzdanie dát až pri finálnom handleSubmit.
            // setTeamsDataFromPage4(newDetails); // Zakomentované, aby sa predišlo potenciálnej slučke
        }
    }, [formData.categories, formData.billing.clubName, numberOfPlayersLimit, numberOfTeamMembersLimit]); // Závislosti: iba propy, ktoré ovplyvňujú štruktúru/obsah teamDetails

    // Tento useEffect slúži na jednorazovú hydratáciu lokálneho stavu z propu teamsDataFromPage4,
    // ak rodičovský komponent (App.js) poskytuje predtým vyplnené dáta (napr. pri navigácii "späť").
    // Zabezpečuje, aby sa to vykonalo len vtedy, ak sa dáta propu skutočne zmenili a nie sú prázdne.
    React.useEffect(() => {
        if (Object.keys(teamsDataFromPage4).length > 0 && JSON.stringify(teamsDataFromPage4) !== JSON.stringify(teamDetails)) {
             setTeamDetails(teamsDataFromPage4);
        }
    }, [teamsDataFromPage4]); // Reaguje iba na zmeny propu teamsDataFromPage4


    // Handler pre zmenu počtu hráčov alebo členov tímu
    const handleTeamDetailChange = (categoryName, teamIndex, field, value) => {
        setTeamDetails(prevDetails => {
            const newDetails = { ...prevDetails };
            newDetails[categoryName] = [...(newDetails[categoryName] || [])];
            newDetails[categoryName][teamIndex] = {
                ...(newDetails[categoryName][teamIndex] || {}),
                [field]: parseInt(value, 10) || 0 // Prevod na číslo pre počty
            };
            return newDetails;
        });
        // Aktualizovať aj stav v App.js hneď pri zmene počtu hráčov/členov tímu
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
            // Zabezpečiť, že teamDetails[categoryName] je pole a iterovať cez jeho prvky
            for (const team of (teamDetails[categoryName] || [])) {
                // Obranná kontrola: zabezpečiť, že 'team' je objekt a 'team.teamName' je reťazec
                if (!team || typeof team.teamName !== 'string' || !team.teamName.trim()) {
                    console.error("Validácia zlyhala: Názov tímu je neplatný alebo chýba pre kategóriu:", categoryName, "Tím:", team);
                    return false;
                }
                if (team.players < 1 || team.players > numberOfPlayersLimit) return false; // Min 1, Max podľa nastavení
                if (team.teamMembers < 1 || team.teamMembers > numberOfTeamMembersLimit) return false; // Min 1, Max podľa nastavení
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
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `teamMembers-${categoryName}-${teamIndex}` }, `Počet členov realizačného tímu (min: 1, max: ${numberOfTeamMembersLimit})`),
                                    React.createElement('input', {
                                        type: 'number',
                                        id: `teamMembers-${categoryName}-${teamIndex}`,
                                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                        value: team.teamMembers,
                                        onChange: (e) => handleTeamDetailChange(categoryName, teamIndex, 'teamMembers', e.target.value),
                                        min: 1, // Zmenené min na 1
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

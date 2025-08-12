// register-page4.js
// Obsahuje komponenty a logiku pre štvrtú (finálnu) stránku registračného formulára - detaily tímov.

export function Page4Form({ formData, handlePrev, handleSubmit, loading, setLoading, notificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, NotificationModal, numberOfPlayersLimit, numberOfTeamMembersLimit, teamsDataFromPage4, setTeamsDataFromPage4, closeNotification }) {
    // teamDetails už nie je lokálny stav. Bude sa spoliehať priamo na prop teamsDataFromPage4.
    // Inicializácia a generovanie názvov tímov sa deje v rodičovskom komponente (App.js).

    // Handler pre zmenu počtu hráčov alebo členov tímu
    const handleTeamDetailChange = (categoryName, teamIndex, field, value) => {
        let newValue;

        if (value === '') {
            newValue = ''; // Ak je vstup prázdny reťazec, ponechajte ho prázdny.
        } else {
            let parsed = parseInt(value, 10);
            if (isNaN(parsed)) {
                newValue = ''; // Ak vstup nie je číslo (napr. "abc"), nastavte ho na prázdny reťazec.
                               // Týmto umožníte používateľovi vymazať neplatný vstup.
            } else {
                // Aplikujte orezanie (clamping) iba, ak je to platné číslo
                if (field === 'players') {
                    newValue = Math.max(1, Math.min(parsed, numberOfPlayersLimit));
                } else if (field === 'teamMembers') {
                    newValue = Math.max(1, Math.min(parsed, numberOfTeamMembersLimit));
                } else {
                    newValue = parsed; // Fallback pre iné polia, ak by existovali
                }
            }
        }

        setTeamsDataFromPage4(prevDetails => { // Priamo aktualizujeme stav v rodičovskom komponente
            const newDetails = { ...prevDetails };
            if (!newDetails[categoryName]) {
                newDetails[categoryName] = [];
            }
            // Zabezpečiť, že existuje objekt tímu na danom indexe, inak ho vytvoriť
            if (!newDetails[categoryName][teamIndex]) {
                // Pôvodný teamName by mal byť poskytnutý z App.js pri inicializácii Page4Form
                // Ak by tu bol tím vytvorený "za behu", default teamName by bol prázdny.
                // Pre tento scenár, predpokladáme, že tím objekt je vždy inicializovaný s teamName z App.js
                newDetails[categoryName][teamIndex] = {
                    teamName: '', // Toto by malo byť reálne z App.js, ale pre istotu
                    players: 1, // Predvolené hodnoty pre novovytvorený tím
                    teamMembers: 1
                };
            }
            newDetails[categoryName][teamIndex] = {
                ...newDetails[categoryName][teamIndex],
                [field]: newValue // Použijeme už skontrolovanú a orezanú hodnotu
            };
            return newDetails;
        });
    };

    // Validácia formulára pre stranu 4
    const isFormValidPage4 = React.useMemo(() => {
        // Validujeme priamo teamsDataFromPage4
        if (!teamsDataFromPage4 || Object.keys(teamsDataFromPage4).length === 0) {
            return false;
        }

        for (const categoryName in teamsDataFromPage4) {
            // Zabezpečiť, že teamsDataFromPage4[categoryName] je pole a iterovať cez jeho prvky
            // Filter pre odstránenie null/undefined prvkov, ktoré by mohli viesť k chybe trim()
            for (const team of (teamsDataFromPage4[categoryName] || []).filter(t => t)) {
                // Obranná kontrola: zabezpečiť, že 'team' je objekt a 'team.teamName' je reťazec
                if (!team || typeof team.teamName !== 'string' || !team.teamName.trim()) {
                    console.error("Validácia zlyhala: Názov tímu je neplatný alebo chýba pre kategóriu:", categoryName, "Tím:", team);
                    return false;
                }
                // DÔLEŽITÉ: Tu sa vykonáva finálna validácia, či sú hodnoty v rozsahu.
                // Používame `typeof team.players !== 'number'` na kontrolu, či je hodnota vôbec číslo,
                // pretože `newValue` môže byť prázdny reťazec.
                if (typeof team.players !== 'number' || team.players < 1 || team.players > numberOfPlayersLimit) return false;
                if (typeof team.teamMembers !== 'number' || team.teamMembers < 1 || team.teamMembers > numberOfTeamMembersLimit) return false;
            }
        }
        return true;
    }, [teamsDataFromPage4, numberOfPlayersLimit, numberOfTeamMembersLimit]); // Závislosti sa zmenili na teamsDataFromPage4

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
        
        // Predáme teamsDataFromPage4 rodičovskému komponentu na uloženie do Firestore
        await handleSubmit(teamsDataFromPage4); // Odovzdávame priamo teamsDataFromPage4
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
            // Používame teamsDataFromPage4 priamo pre podmienené renderovanie
            Object.keys(teamsDataFromPage4).length === 0 ? (
                React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Prejdite prosím na predchádzajúcu stránku a vyberte kategórie s počtom tímov.')
            ) : (
                Object.keys(teamsDataFromPage4).map(categoryName => (
                    React.createElement(
                        'div',
                        { key: categoryName, className: 'border-t border-gray-200 pt-4 mt-4' },
                        React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, `Kategória: ${categoryName}`),
                        // Filter pre odstránenie null/undefined prvkov pred mapovaním
                        (teamsDataFromPage4[categoryName] || []).filter(t => t).map((team, teamIndex) => (
                            React.createElement(
                                'div',
                                { key: `${categoryName}-${teamIndex}`, className: 'bg-blue-50 p-4 rounded-lg mb-4 space-y-2' },
                                React.createElement('p', { className: 'font-semibold text-blue-800' }, `Tím ${teamIndex + 1}`),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `players-${categoryName}-${teamIndex}` }, 'Názov tímu'),
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
                                        value: team.players, // Hodnota je čítaná priamo zo stavu
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
                                        value: team.teamMembers, // Hodnota je čítaná priamo zo stavu
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

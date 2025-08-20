import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function Page4Form({ formData, handlePrev, handleNextPage4, loading, setLoading, notificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, NotificationModal, numberOfPlayersLimit, numberOfTeamMembersLimit, teamsDataFromPage4, setTeamsDataFromPage4, closeNotification }) {

    // Získame referenciu na Firebase Firestore
    const db = getFirestore();

    // Stav pre dynamicky načítané veľkosti tričiek z Firestore
    const [tshirtSizes, setTshirtSizes] = React.useState([]);

    // Effect pre načítanie veľkostí tričiek z Firestore
    React.useEffect(() => {
        let unsubscribe;
        const fetchTshirtSizes = () => {
            // Predpokladáme, že window.db je už inicializované z authentication.js
            if (!window.db) {
                console.log("Firestore DB nie je zatiaľ k dispozícii pre veľkosti tričiek.");
                // Skúste znova po krátkom oneskorení, ak db ešte nie je k dispozícii
                setTimeout(fetchTshirtSizes, 100);
                return;
            }
            try {
                const tshirtSizesDocRef = doc(window.db, 'settings', 'sizeTshirts');
                unsubscribe = onSnapshot(tshirtSizesDocRef, (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        // Nastavíme stav s veľkosťami tričiek z poľa 'sizes'
                        setTshirtSizes(data.sizes || []);
                    } else {
                        console.warn("Dokument /settings/sizeTshirts neexistuje. Používa sa prázdne pole pre veľkosti tričiek.");
                        setTshirtSizes([]);
                    }
                }, (error) => {
                    console.error("Chyba pri načítaní veľkostí tričiek:", error);
                    // Tu by ste mohli zobraziť notifikáciu používateľovi, ak je to potrebné
                });
            } catch (e) {
                console.error("Chyba pri nastavovaní poslucháča pre veľkosti tričiek:", e);
            }
        };

        fetchTshirtSizes();

        // Cleanup funkcia pre odhlásenie sa z onSnapshot
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []); // Prázdne pole závislostí zabezpečí, že sa effect spustí iba raz pri mountnutí komponentu


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
            // Zabezpečíme, že tímový objekt existuje a má inicializované aj womenTeamMembers a menTeamMembers
            if (!newDetails[categoryName][teamIndex]) {
                newDetails[categoryName][teamIndex] = {
                    teamName: '', 
                    players: '', 
                    womenTeamMembers: '', 
                    menTeamMembers: '',   
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
        const selectedSizesInOtherRows = Array.isArray(teamTshirts) // Zabezpečenie, že teamTshirts je pole
            ? teamTshirts.filter((tshirt, idx) => idx !== currentIndex && tshirt.size !== '').map(tshirt => tshirt.size)
            : [];

        // Používame dynamicky načítané veľkosti tričiek
        return tshirtSizes.filter(size => !selectedSizesInOtherRows.includes(size));
    };

    // Vytvorenie správy o validácii tričiek pre každý tím
    const getPerTeamTshirtValidationMessage = React.useCallback((diff, currentCategoryName, currentTeamName, isTeamMembersTotalOverLimit) => {
        if (isTeamMembersTotalOverLimit) {
            return [
                React.createElement('strong', { key: 'prefix_bold' }, 'Na pokračovanie'),
                React.createElement('span', { key: 'middle_normal' }, ' v registrácii na turnaj '),
                React.createElement('strong', { key: 'suffix_bold' }, 'je\u00A0potrebné znížiť počet členov realizačného tímu.')
            ];
        }

        if (diff === 0) return null; // Ak nie je rozdiel, vrátime null alebo prázdny reťazec, aby sa nič nezobrazilo

        const absDiff = Math.abs(diff);
        let actionText; // "objednať ešte" alebo "zrušiť"
        let countText; // "1 tričko", "2 tričká", "5 tričiek"

        if (diff > 0) {
            actionText = 'objednať ešte';
            if (absDiff === 1) {
                countText = `${absDiff} tričko.`;
            } else if (absDiff >= 2 && absDiff <= 4) {
                countText = `${absDiff} tričká.`;
            } else {
                countText = `${absDiff} tričiek.`;
            }
        } else { // diff < 0
            actionText = 'zrušiť';
            if (absDiff === 1) {
                countText = `${absDiff} objednané tričko.`;
            } else if (absDiff >= 2 && absDiff <= 4) {
                countText = `${absDiff} objednané tričká.`;
            } else {
                countText = `${absDiff} objednaných tričiek.`;
            }
        }

        return [
            React.createElement('strong', { key: 'prefix_bold_tshirt' }, 'Na pokračovanie'),
            React.createElement('span', { key: 'middle_normal_tshirt' }, ' v registrácii na turnaj '),
            React.createElement('strong', { key: 'is_needed_tshirt' }, 'je\u00A0potrebné'), // Pridaná pevná medzera
            React.createElement('span', { key: 'category_team_normal_tshirt' }, ` v kategórii ${currentCategoryName} pre tím ${currentTeamName} `),
            React.createElement('strong', { key: 'action_count_bold_tshirt' }, `${actionText} ${countText}`)
        ];
    }, []);

    // Validácia celého formulára pre stránku 4
    const isFormValidPage4 = React.useMemo(() => {
        // Ak nie sú žiadne tímy, formulár nie je platný
        if (!teamsDataFromPage4 || Object.keys(teamsDataFromPage4).length === 0) {
            return false;
        }

        let allTshirtsMatch = true; // Predpokladáme, že všetky tričká sedia
        let allTeamMembersFilled = true; // Predpokladáme, že všetky tímy majú vyplnené realizacne teamy

        // Prechádzame všetky kategórie a tímy
        for (const categoryName in teamsDataFromPage4) {
            // NOVINKA: Preskoč kategóriu 'globalNote'
            if (categoryName === 'globalNote') {
                continue;
            }

            // Zabezpečíme, že teamsDataFromPage4[categoryName] je pole, alebo použijeme prázdne pole
            const teamsInCategory = Array.isArray(teamsDataFromPage4[categoryName])
                ? teamsDataFromPage4[categoryName]
                : [];

            for (const team of teamsInCategory.filter(t => t)) { // OPRAVA: Používame teamsInCategory
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
                const womenTeamMembersValue = parseInt(team.womenTeamMembers, 10) || 0; // Prevod na 0 ak je NaN/prázdne
                const menTeamMembersValue = parseInt(team.menTeamMembers, 10) || 0;     // Prevod na 0 ak je NaN/prázdne

                if (womenTeamMembersValue < 0 || menTeamMembersValue < 0) return false;

                // Súčet žien a mužov musí byť v rámci limitu
                if ((womenTeamMembersValue + menTeamMembersValue) > numberOfTeamMembersLimit) {
                    return false;
                }

                // Nová podmienka: aspoň jeden z realizačných tímov musí byť vyplnený
                if (womenTeamMembersValue === 0 && menTeamMembersValue === 0) {
                    allTeamMembersFilled = false; // Ak sú obidva 0, nie sú vyplnené
                }

                // Validácia detailov tričiek
                for (const tshirt of (Array.isArray(team.tshirts) ? team.tshirts : [])) { // Zabezpečenie, že team.tshirts je pole
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
                for (const tshirt of (Array.isArray(team.tshirts) ? team.tshirts : [])) { // Zabezpečíme, že team.tshirts je pole
                    teamOrderedTshirts += (isNaN(parseInt(tshirt.quantity, 10)) ? 0 : parseInt(tshirt.quantity, 10));
                }

                // Ak sa počty nezhodujú, nastavíme allTshirtsMatch na false
                if (teamRequiredTshirts !== teamOrderedTshirts) {
                    allTshirtsMatch = false;
                }
            }
        }
        return allTshirtsMatch && allTeamMembersFilled; // Vrátime výsledok validácie
    }, [teamsDataFromPage4, numberOfPlayersLimit, numberOfTeamMembersLimit]);

    // CSS triedy pre tlačidlo "Ďalej" (zmenené z "Registrovať")
    const nextButtonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
    ${loading || !isRecaptchaReady || !isFormValidPage4
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' // Zakázaný stav
      : 'bg-blue-500 hover:bg-blue-700 text-white' // Aktívny stav (modrá pre "Ďalej")
    }
  `;

    // Funkcia pre prechod na Page5
    const handleNextPage4ToPage5 = async (e) => { // 'e' je udalosť odoslania formulára
        e.preventDefault(); // Zastavíme predvolené správanie formulára (načítanie stránky)
        
        // Nastavenie stavov načítania a notifikácií
        if (typeof setLoading === 'function') setLoading(true);
        if (typeof setShowNotification === 'function') setShowNotification(false);
        if (typeof setNotificationType === 'function') setNotificationType('info');

        // Ak formulár nie je platný, zobrazíme chybovú správu
        if (!isFormValidPage4) {
            if (typeof setNotificationMessage === 'function') {
                setNotificationMessage('Prosím, skontrolujte všetky polia tímu a objednávky tričiek. Uistite sa, že pre každý tím je vyplnený aspoň jeden člen realizačného tímu.'); // Aktualizovaná správa
                setShowNotification(true);
                setNotificationType('error');
            }
            if (typeof setLoading === 'function') setLoading(false);
            return;
        }
        
        // Príprava dát pred odoslaním (konverzia prázdnych reťazcov na 0)
        // Používame teamsDataFromPage4 zo stavu komponentu, nie z parametra
        const teamsDataToSaveFinal = JSON.parse(JSON.stringify(teamsDataFromPage4)); 
        for (const categoryName in teamsDataToSaveFinal) {
            // NOVINKA: Preskoč kategóriu 'globalNote' pri ukladaní
            if (categoryName === 'globalNote') {
                continue;
            }

            // Zabezpečíme, že je to pole, pred tým ako na ňom voláme map
            const currentTeamsInCategory = Array.isArray(teamsDataToSaveFinal[categoryName]) ? teamsDataToSaveFinal[categoryName] : [];
            teamsDataToSaveFinal[categoryName] = currentTeamsInCategory.map(team => ({
                ...team,
                players: team.players === '' ? 0 : team.players,
                womenTeamMembers: team.womenTeamMembers === '' ? 0 : team.womenTeamMembers,       // Konverzia
                menTeamMembers: team.menTeamMembers === '' ? 0 : team.menTeamMembers,         // Konverzia
                tshirts: Array.isArray(team.tshirts) ? team.tshirts.map(tshirt => ({ // Zabezpečíme, že team.tshirts je pole
                    ...tshirt,
                    quantity: tshirt.quantity === '' ? 0 : tshirt.quantity
                })) : []
            }));
        }

        // Odoslanie spracovaných dát na ďalšiu stránku (Page5)
        await handleNextPage4(teamsDataToSaveFinal); // Voláme handleNextPage4 z App.js
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
            'Registrácia - strana 4'
        ),
        // Formulár pre detaily tímov
        React.createElement(
            'form',
            { onSubmit: handleNextPage4ToPage5, className: 'space-y-4' },
            // Ak nie sú žiadne tímy vybrané, zobrazíme správu
            Object.keys(teamsDataFromPage4).length === 0 ? (
                React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Prejdite prosím na predchádzajúcu stránku a vyberte kategórie s počtom tímov.')
            ) : (
                // Mapovanie cez kategórie a tímy
                Object.keys(teamsDataFromPage4)
                    .filter(categoryName => categoryName !== 'globalNote') // NOVINKA: Filtrujeme kategóriu 'globalNote'
                    .map(categoryName => (
                    React.createElement(
                        'div',
                        { key: categoryName, className: 'border-t border-gray-200 pt-4 mt-4' },
                        React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, `Kategória: ${categoryName}`),
                        // OPRAVENÉ: Zabezpečenie, že teamsDataFromPage4[categoryName] je pole
                        (Array.isArray(teamsDataFromPage4[categoryName]) ? teamsDataFromPage4[categoryName] : []).filter(t => t).map((team, teamIndex) => {
                            // Výpočet potrebných tričiek pre každý tím
                            const teamRequiredTshirts = (isNaN(parseInt(team.players, 10)) ? 0 : parseInt(team.players, 10)) + 
                                                        (isNaN(parseInt(team.womenTeamMembers, 10)) ? 0 : parseInt(team.womenTeamMembers, 10)) +
                                                        (isNaN(parseInt(team.menTeamMembers, 10)) ? 0 : parseInt(team.menTeamMembers, 10));
                            
                            let teamOrderedTshirts = 0;
                            for (const tshirt of (Array.isArray(team.tshirts) ? team.tshirts : [])) { // Zabezpečíme, že team.tshirts je pole
                                teamOrderedTshirts += (isNaN(parseInt(tshirt.quantity, 10)) ? 0 : parseInt(tshirt.quantity, 10));
                            }
                            const teamTshirtDifference = teamRequiredTshirts - teamOrderedTshirts;

                            // Nová premenná pre kontrolu, či je povolený vstup pre tričká
                            const isTshirtInputEnabled = 
                                (parseInt(team.players, 10) > 0) || 
                                (parseInt(team.womenTeamMembers, 10) > 0) || 
                                (parseInt(team.menTeamMembers, 10) > 0);

                            // Doplnková kontrola pre zablokovanie, ak súčet realizačných tímov prekročí limit
                            // OPRAVA: Konvertujeme hodnoty na čísla (alebo 0, ak sú prázdne/NaN) pred sčítaním
                            const currentWomenTeamMembers = parseInt(team.womenTeamMembers, 10) || 0;
                            const currentMenTeamMembers = parseInt(team.menTeamMembers, 10) || 0;
                            const isTeamMembersTotalOverLimit = 
                                (currentWomenTeamMembers + currentMenTeamMembers) > numberOfTeamMembersLimit;

                            const isTshirtSectionDisabled = loading || !isTshirtInputEnabled || isTeamMembersTotalOverLimit;

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
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1', htmlFor: `players-${categoryName}-${teamIndex}` }, `Počet hráčov (max: ${numberOfPlayersLimit})`),
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
                                        value: team.womenTeamMembers === 0 ? 0 : team.womenTeamMembers || '', 
                                        onChange: (e) => handleTeamDetailChange(categoryName, teamIndex, 'womenTeamMembers', e.target.value),
                                        placeholder: 'Zadajte počet žien',
                                        min: 0, 
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
                                        value: team.menTeamMembers === 0 ? 0 : team.menTeamMembers || '', 
                                        onChange: (e) => handleTeamDetailChange(categoryName, teamIndex, 'menTeamMembers', e.target.value),
                                        placeholder: 'Zadajte počet mužov',
                                        min: 0, 
                                        disabled: loading,
                                    }),
                                    // Nový text pod inputboxom pre počet mužov
                                    React.createElement('p', { className: 'text-sm text-gray-600 mt-1' }, `Maximálny počet členov realizačného tímu je ${numberOfTeamMembersLimit}.`)
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
                                        React.createElement('span', { className: 'w-1/3 text-gray-700' }, 'Veľkosť'), 
                                        React.createElement('span', { className: 'w-1/2 text-left text-gray-700' }, 'Počet'), 
                                        React.createElement('span', { className: 'w-8' })
                                    ),
                                    // Mapovanie cez riadky s tričkami
                                    // OPRAVENÉ: Zabezpečenie, že team.tshirts je pole
                                    (Array.isArray(team.tshirts) ? team.tshirts : [{ size: '', quantity: '' }]).map((tshirt, tshirtIndex) => (
                                        React.createElement(
                                            'div',
                                            { key: tshirtIndex, className: 'flex items-center space-x-2 mb-2' },
                                            // Výber veľkosti trička
                                            React.createElement(
                                                'select',
                                                {
                                                    className: `shadow border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-1/3 ${isTshirtSectionDisabled ? 'cursor-not-allowed' : ''}`, 
                                                    value: tshirt.size,
                                                    onChange: (e) => handleTshirtSizeChange(categoryName, teamIndex, tshirtIndex, e.target.value),
                                                    required: true,
                                                    // Zablokovanie na základe stavu isTshirtInputEnabled a isTeamMembersTotalOverLimit
                                                    disabled: isTshirtSectionDisabled, 
                                                },
                                                React.createElement('option', { value: '' }, 'Vyberte'), 
                                                // Mapovanie dostupných veľkostí (teraz z načítaného stavu)
                                                getAvailableTshirtSizeOptions(team.tshirts, tshirtIndex).map(size => (
                                                    React.createElement('option', { key: size, value: size }, size)
                                                ))
                                            ),
                                            // Zadanie množstva trička
                                            React.createElement('input', {
                                                type: 'number',
                                                className: `shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-1/2 text-left ${isTshirtSectionDisabled ? 'cursor-not-allowed' : ''}`, 
                                                value: tshirt.quantity,
                                                onChange: (e) => handleTshirtQuantityChange(categoryName, teamIndex, tshirtIndex, e.target.value),
                                                min: 0,
                                                required: true,
                                                // Zablokovanie na základe stavu isTshirtInputEnabled a isTeamMembersTotalOverLimit
                                                disabled: isTshirtSectionDisabled, 
                                                placeholder: 'Zadajte počet', 
                                            }),
                                            // Tlačidlo na odstránenie riadku trička
                                            React.createElement(
                                                'button',
                                                {
                                                    type: 'button',
                                                    onClick: () => handleRemoveTshirtRow(categoryName, teamIndex, tshirtIndex),
                                                    className: `bg-red-500 hover:bg-red-700 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 focus:outline-none focus:shadow-outline ${team.tshirts.length === 1 ? 'invisible' : ''} ${isTshirtSectionDisabled ? 'cursor-not-allowed' : ''}`,
                                                    // Tlačidlo na odstránenie tiež zablokované
                                                    disabled: isTshirtSectionDisabled || team.tshirts.length === 1,
                                                },
                                                '-'
                                            )
                                        )
                                    )),
                                    // Tlačidlo na pridanie riadku trička (zobrazí sa len ak sú ešte dostupné veľkosti)
                                    getAvailableTshirtSizeOptions(Array.isArray(team.tshirts) ? team.tshirts : []).length > 0 && React.createElement( // Zabezpečenie, že team.tshirts je pole
                                        'button',
                                        {
                                            type: 'button',
                                            onClick: () => handleAddTshirtRow(categoryName, teamIndex),
                                            className: `
                                                font-bold w-10 h-10 rounded-full flex items-center justify-center mx-auto mt-4 
                                                transition-colors duration-200 focus:outline-none focus:shadow-outline
                                                ${isTshirtSectionDisabled || (Array.isArray(team.tshirts) && team.tshirts.some(t => t.size === '' || t.quantity === '' || isNaN(parseInt(t.quantity, 10)))) || getAvailableTshirtSizeOptions(Array.isArray(team.tshirts) ? team.tshirts : []).length === 0 // Zabezpečenie Array.isArray
                                                    ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
                                                    : 'bg-blue-500 hover:bg-blue-700 text-white'
                                                }
                                            `.trim(),
                                            disabled: isTshirtSectionDisabled || (Array.isArray(team.tshirts) && team.tshirts.some(t => t.size === '' || t.quantity === '' || isNaN(parseInt(t.quantity, 10)))) || getAvailableTshirtSizeOptions(Array.isArray(team.tshirts) ? team.tshirts : []).length === 0, // Zabezpečenie Array.isArray
                                        },
                                        '+'
                                    )
                                ),
                                // Zobrazenie validačnej správy pre tričká, ak je rozdiel
                                (isTeamMembersTotalOverLimit || teamTshirtDifference !== 0) && React.createElement( // Zobrazí sa, ak je prekročený limit alebo rozdiel v tričkách
                                    'div',
                                    { className: `mt-2 p-2 rounded-lg text-center bg-red-100 text-red-700` },
                                    getPerTeamTshirtValidationMessage(teamTshirtDifference, categoryName, team.teamName, isTeamMembersTotalOverLimit) // Predanie isTeamMembersTotalOverLimit
                                )
                            );
                        })
                    )
                ))
            ),

            // Ovládacie tlačidlá formulára (Späť a Ďalej)
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
                    // Zobrazenie načítavacieho spinnera počas prechodu
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

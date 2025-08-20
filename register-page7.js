// register-page7.js
// Obsahuje komponent pre poslednú stránku registračného formulára - zhrnutie zadaných údajov.

// Nový komponent pre modálne okno potvrdenia e-mailu
function EmailConfirmationModal({ show, onClose, onConfirm, userEmail, loading }) {
    if (!show) return null;

    // Dynamické triedy pre tlačidlá v modálnom okne
    const getModalButtonClasses = (originalBgColorClass, disabledState) => {
        const baseClasses = 'py-2 px-4 rounded-lg transition-colors duration-200';
        const colorMatch = originalBgColorClass.match(/bg-(.+)-(\d+)/);

        // NOVINKA: Špecifické ošetrenie pre 'bg-gray-300' pre zabezpečenie čierneho textu
        if (originalBgColorClass === 'bg-gray-300') {
            if (disabledState) {
                // Pre zablokované tlačidlo "Späť na úpravu"
                return `${baseClasses} bg-white border border-gray-300 text-black opacity-50 cursor-not-allowed hover:cursor-not-allowed`;
            } else {
                // Pre aktívne tlačidlo "Späť na úpravu"
                return `${baseClasses} bg-gray-300 hover:bg-gray-400 text-black`;
            }
        }

        // Pôvodná logika pre ostatné tlačidlá (napr. zelené, modré)
        if (disabledState && colorMatch) {
            const colorName = colorMatch[1];
            const colorShade = colorMatch[2];
            return `${baseClasses} bg-white border border-${colorName}-${colorShade} text-${colorName}-${colorShade} opacity-50 cursor-not-allowed hover:cursor-not-allowed`;
        } else {
            // Špeciálne ošetrenie pre sivé tlačidlá, ktoré používajú text-gray-800, nie text-white.
            // Táto časť sa už pre 'bg-gray-300' nespustí vďaka prvej podmienke.
            if (originalBgColorClass.includes('bg-gray-')) {
                return `${baseClasses} ${originalBgColorClass} ${originalBgColorClass.replace('bg-', 'hover:bg-')} text-gray-800`;
            } else {
                return `${baseClasses} ${originalBgColorClass} ${originalBgColorClass.replace('bg-', 'hover:bg-')} text-white`;
            }
        }
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full' },
            React.createElement('h2', { className: 'text-xl font-bold mb-4 text-center' }, 'Potvrdenie e-mailovej adresy'),
            React.createElement('p', { className: 'mb-4 text-center' }, `Pre dokončenie registrácie potvrďte, že zadaná e-mailová adresa je správna:`),
            React.createElement('p', { className: 'mb-2 text-center font-bold text-blue-700 break-words' }, userEmail), // Zobrazenie e-mailu
            // NOVINKA: Pridaný text pod e-mailovú adresu
            React.createElement('p', { className: 'mb-6 text-center text-gray-600 text-sm' }, 'Na túto zadanú e-mailovú adresu bude odoslané potvrdenie o zaregistrovaní vášho klubu na turnaj.'),

            React.createElement(
                'div',
                { className: 'flex justify-center space-x-4' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: getModalButtonClasses('bg-gray-300', loading), // Používa upravenú funkciu
                        disabled: loading,
                    },
                    'Späť na úpravu'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onConfirm,
                        className: getModalButtonClasses('bg-green-500', loading),
                        disabled: loading,
                    },
                    loading ? React.createElement(
                        'div',
                        { className: 'flex items-center justify-center' },
                        React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' }, // ZMENA: text-white na text-blue-500
                            React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                            React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                        ),
                        'Potvrdzujem...'
                    ) : 'Potvrdiť registráciu'
                )
            )
        )
    );
}

export function Page7Form({ formData, handlePrev, handleSubmit, loading, teamsDataFromPage4, NotificationModal, notificationMessage, closeNotification, notificationType, selectedCountryDialCode, globalNote }) { // Pridaný globalNote prop

    const [isConsentChecked, setIsConsentChecked] = React.useState(false); // Nový stav pre checkbox
    const [showEmailConfirmationModal, setShowEmailConfirmationModal] = React.useState(false); // Stav pre zobrazenie potvrdzovacieho modálu

    // Funkcia na formátovanie dátumu narodenia
    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            // Pre istotu skontrolujeme, či je dátum platný po parsovaní
            if (isNaN(date.getTime())) {
                return ''; // Ak je neplatný, vrátime prázdny reťazec
            }
            return date.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) {
            console.error("Chyba pri formátovaní dátumu:", e);
            return ''; // V prípade chyby formátovania
        }
    };

    // Pomocná funkcia pre zobrazenie adresy v jednom riadku
    const formatAddress = (address) => {
        if (!address || Object.values(address).every(val => !val)) {
            return ''; // Ak je adresa prázdna, vrátiť prázdny reťazec
        }
        const parts = [];
        if (address.street) parts.push(address.street);
        if (address.houseNumber) parts.push(address.houseNumber);
        
        let firstLine = parts.join(' ');

        const secondParts = [];
        if (address.postalCode) secondParts.push(address.postalCode);
        if (address.city) secondParts.push(address.city);
        
        let secondLine = secondParts.join(' ');

        let fullAddress = '';
        if (firstLine && secondLine) {
            fullAddress = `${firstLine}, ${secondLine}`;
        } else if (firstLine) {
            fullAddress = firstLine;
        } else if (secondLine) {
            fullAddress = secondLine;
        }

        if (address.country) {
            if (fullAddress) {
                fullAddress += `, ${address.country}`;
            } else {
                fullAddress = address.country;
            }
        }

        return fullAddress;
    };

    // Funkcia na formátovanie dát tímu pre zobrazenie
    const formatTeamsData = (teams) => {
        if (!teams || Object.keys(teams).length === 0) {
            return React.createElement('p', null, 'Žiadne tímy neboli pridané.');
        }

        // ZMENA: Filter pre kľúče, aby sa spracovávali len kategórie (objekty, ktoré sú polia alebo sa očakávajú ako polia)
        return Object.keys(teams).filter(categoryName => Array.isArray(teams[categoryName])).map(categoryName => {
            const teamsInCategory = teams[categoryName];
            if (!teamsInCategory || teamsInCategory.length === 0) {
                return React.createElement('div', { key: categoryName, className: 'mb-2' },
                    React.createElement('strong', null, `Kategória: ${categoryName}`),
                    React.createElement('p', { className: 'ml-4 text-gray-600' }, 'Žiadne tímy v tejto kategórie.')
                );
            }

            return React.createElement('div', { key: categoryName, className: 'mb-4 border-l-4 border-blue-200 pl-4' },
                React.createElement('strong', { className: 'text-blue-700' }, `Kategória: ${categoryName}`),
                teamsInCategory.map((team, index) => {
                    const tshirtsDetails = team.tshirts && team.tshirts.length > 0
                        ? team.tshirts.filter(t => t.size && t.quantity > 0)
                                    .map(t => `${t.quantity}× ${t.size}`)
                                    .join(', ')
                        : 'žiadne';

                    const totalTshirtQuantity = team.tshirts && team.tshirts.length > 0
                        ? team.tshirts.reduce((sum, t) => sum + (parseInt(t.quantity, 10) || 0), 0)
                        : 0;

                    const finalTshirtsDisplay = tshirtsDetails === 'žiadne'
                        ? 'žiadne'
                        : React.createElement(React.Fragment, null,
                            tshirtsDetails,
                            ', ',
                            React.createElement('strong', null, `celkom: ${totalTshirtQuantity} ks`)
                          );


                    // Detaily ubytovania
                    const accommodationDetails = team.accommodation?.type || 'Bez ubytovania';

                    // Detaily dopravy
                    let arrivalDetails = team.arrival?.type || 'Nezadaný';
                    if ((team.arrival?.type === 'verejná doprava - vlak' || team.arrival?.type === 'verejná doprava - autobus') && team.arrival?.time) {
                        arrivalDetails += ` (čas príchodu: ${team.arrival.time})`;
                    } else if (team.arrival?.type === 'vlastná doprava' && (team.arrival?.drivers?.male > 0 || team.arrival?.drivers?.female > 0)) {
                        const driversInfo = [];
                        if (team.arrival.drivers.male > 0) driversInfo.push(`${team.arrival.drivers.male} muž`);
                        if (team.arrival.drivers.female > 0) driversInfo.push(`${team.arrival.drivers.female} žena`);
                        arrivalDetails += ` (šoféri: ${driversInfo.join(', ')})`;
                    }

                    // Detaily balíčka
                    let packageDetailsHtml = null;
                    if (team.packageId && team.packageDetails) {
                        const pkg = team.packageDetails;
                        let mealsHtml = null;
                        if (pkg.meals) {
                            const mealDates = Object.keys(pkg.meals).filter(key => key !== 'participantCard').sort();
                            mealsHtml = React.createElement('div', { className: 'ml-4 text-sm text-gray-600' },
                                React.createElement('strong', null, 'Stravovanie:'),
                                mealDates.length > 0 ? (
                                    mealDates.map(date => {
                                        const dateObj = new Date(date + 'T00:00:00');
                                        const displayDate = dateObj.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric' });
                                        const mealsForDay = pkg.meals[date];
                                        const includedItems = [];
                                        if (mealsForDay?.breakfast === 1) includedItems.push('raňajky');
                                        if (mealsForDay?.lunch === 1) includedItems.push('obed');
                                        if (mealsForDay?.dinner === 1) includedItems.push('večera');
                                        if (mealsForDay?.refreshment === 1) includedItems.push('občerstvenie');

                                        if (includedItems.length > 0) {
                                            return React.createElement('p', { key: date }, `${displayDate}: ${includedItems.join(', ')}`);
                                        }
                                        return null;
                                    })
                                ) : React.createElement('p', null, 'Žiadne stravovanie definované.')
                            );
                            if (pkg.meals.participantCard === 1) {
                                mealsHtml = React.createElement(React.Fragment, null,
                                    mealsHtml,
                                    React.createElement('p', { className: 'font-bold text-gray-700 ml-4 mt-1' }, 'Zahŕňa účastnícku kartu.')
                                );
                            }
                        }

                        packageDetailsHtml = React.createElement(React.Fragment, null,
                            React.createElement('p', null, React.createElement('strong', null, 'Balíček: '), `${pkg.name || '-'} (${pkg.price || 0} €/osoba)`),
                            mealsHtml
                        );
                    } else {
                        packageDetailsHtml = React.createElement('p', null, React.createElement('strong', null, 'Balíček: '), 'Nezadaný');
                    }

                    // Zozbieranie všetkých osôb do jedného poľa pre tabuľku
                    const allParticipants = [];

                    // Pridanie hráčov
                    (team.playerDetails || []).forEach(player => {
                        allParticipants.push({
                            type: 'Hráč',
                            jerseyNumber: player.jerseyNumber || '',
                            firstName: player.firstName || '',
                            lastName: player.lastName || '',
                            dateOfBirth: formatDate(player.dateOfBirth),
                            registrationNumber: (player.isRegistered && player.registrationNumber) ? player.registrationNumber : '',
                            address: formatAddress(player.address)
                        });
                    });

                    // Pridanie ženských členov realizačného tímu
                    (team.womenTeamMemberDetails || []).forEach(member => {
                        allParticipants.push({
                            type: 'Realizačný tím (žena)',
                            jerseyNumber: '',
                            firstName: member.firstName || '',
                            lastName: member.lastName || '',
                            dateOfBirth: formatDate(member.dateOfBirth),
                            registrationNumber: '',
                            address: formatAddress(member.address)
                        });
                    });

                    // Pridanie mužských členov realizačného tímu
                    (team.menTeamMemberDetails || []).forEach(member => {
                        allParticipants.push({
                            type: 'Realizačný tím (muž)',
                            jerseyNumber: '',
                            firstName: member.firstName || '',
                            lastName: member.lastName || '',
                            dateOfBirth: formatDate(member.dateOfBirth),
                            registrationNumber: '',
                            address: formatAddress(member.address)
                        });
                    });

                    // NOVINKA: Pridanie mužských šoférov
                    (team.driverDetailsMale || []).forEach(driver => {
                        allParticipants.push({
                            type: 'Šofér (muž)',
                            jerseyNumber: '',
                            firstName: driver.firstName || '',
                            lastName: driver.lastName || '',
                            dateOfBirth: formatDate(driver.dateOfBirth),
                            registrationNumber: '',
                            address: formatAddress(driver.address)
                        });
                    });

                    // NOVINKA: Pridanie ženských šoférov
                    (team.driverDetailsFemale || []).forEach(driver => {
                        allParticipants.push({
                            type: 'Šofér (žena)',
                            jerseyNumber: '',
                            firstName: driver.firstName || '',
                            lastName: driver.lastName || '',
                            dateOfBirth: formatDate(driver.dateOfBirth),
                            registrationNumber: '',
                            address: formatAddress(driver.address)
                        });
                    });


                    return React.createElement('div', { key: index, className: 'mb-4 p-4 bg-gray-50 rounded-lg shadow-sm' },
                        React.createElement('p', { className: 'font-semibold text-blue-800 mb-2' }, `Tím ${index + 1}: ${team.teamName || '-'}`),
                        React.createElement('p', { className: 'text-sm text-gray-700 mb-4' }, `Počet hráčov: ${team.players || 0}, členovia realizačného tímu (ženy): ${team.womenTeamMembers || 0}, členovia realizačného tímu (muži): ${team.menTeamMembers || 0}, šoféri (ženy): ${team.arrival?.drivers?.female || 0}, šoféri (muži): ${team.arrival?.drivers?.male || 0}`),
                        
                        // Zobrazenie tabuľky pre všetkých účastníkov
                        allParticipants.length > 0 ? (
                            React.createElement('div', { className: 'w-full overflow-x-auto box-border' },
                                React.createElement('table', { className: 'bg-white border border-gray-300 rounded-lg shadow-sm w-max' },
                                    React.createElement('thead', null,
                                        React.createElement('tr', { className: 'bg-gray-200 text-gray-700 text-sm leading-normal' },
                                            React.createElement('th', { className: 'py-3 px-2 text-left', style: { minWidth: '100px', whiteSpace: 'nowrap' } }, 'Osoba'),
                                            React.createElement('th', { className: 'py-3 px-2 text-left', style: { minWidth: '80px', whiteSpace: 'nowrap' } }, 'Číslo dresu'),
                                            React.createElement('th', { className: 'py-3 px-2 text-left', style: { minWidth: '120px', whiteSpace: 'nowrap' } }, 'Meno'),
                                            React.createElement('th', { className: 'py-3 px-2 text-left', style: { minWidth: '120px', whiteSpace: 'nowrap' } }, 'Priezvisko'),
                                            React.createElement('th', { className: 'py-3 px-2 text-left', style: { minWidth: '120px', whiteSpace: 'nowrap' } }, 'Dátum narodenia'),
                                            React.createElement('th', { className: 'py-3 px-2 text-left', style: { minWidth: '120px', whiteSpace: 'nowrap' } }, 'Číslo registrácie'),
                                            React.createElement('th', { className: 'py-3 px-2 text-left', style: { minWidth: '200px', whiteSpace: 'nowrap' } }, 'Adresa bydliska')
                                        )
                                    ),
                                    React.createElement('tbody', { className: 'text-gray-600 text-sm font-light' },
                                        allParticipants.map((participant, pIdx) => (
                                            React.createElement('tr', { key: pIdx, className: 'border-b border-gray-200 hover:bg-gray-100' },
                                                React.createElement('td', { className: 'py-2 px-2 text-left', style: { whiteSpace: 'nowrap', minHeight: '36px' } }, participant.type),
                                                React.createElement('td', { className: 'py-2 px-2 text-left', style: { whiteSpace: 'nowrap', minHeight: '36px' } }, participant.jerseyNumber),
                                                React.createElement('td', { className: 'py-2 px-2 text-left', style: { whiteSpace: 'nowrap', minHeight: '36px' } }, participant.firstName),
                                                React.createElement('td', { className: 'py-2 px-2 text-left', style: { whiteSpace: 'nowrap', minHeight: '36px' } }, participant.lastName),
                                                React.createElement('td', { className: 'py-2 px-2 text-left', style: { whiteSpace: 'nowrap', minHeight: '36px' } }, participant.dateOfBirth),
                                                React.createElement('td', { className: 'py-2 px-2 text-left', style: { whiteSpace: 'nowrap', minHeight: '36px' } }, participant.registrationNumber),
                                                React.createElement('td', { className: 'py-2 px-2 text-left', style: { whiteSpace: 'nowrap', minHeight: '36px' } }, participant.address)
                                            )
                                        ))
                                    )
                                )
                            )
                        ) : React.createElement('p', { className: 'text-gray-600 text-sm' }, 'Žiadni účastníci zadaní pre tento tím.'),
                        React.createElement('p', { className: 'mt-4 text-gray-700' }, React.createElement('strong', null, 'Tričká: '), finalTshirtsDisplay),
                        React.createElement('p', { className: 'text-gray-700' }, React.createElement('strong', null, 'Ubytovanie: '), accommodationDetails),
                        React.createElement('p', { className: 'text-gray-700' }, React.createElement('strong', null, 'Doprava: '), arrivalDetails),
                        packageDetailsHtml
                    );
                })
            );
        });
    };

    // Handler pre zobrazenie potvrdzovacieho modálu
    const handleShowConfirmation = () => {
        setShowEmailConfirmationModal(true);
    };

    // Handler pre uzavretie potvrdzovacieho modálu
    const handleCloseConfirmation = () => {
        setShowEmailConfirmationModal(false);
    };

    // Handler pre skutočné odoslanie formulára po potvrdení v modálnom okne
    const handleConfirmSubmit = () => {
        // Tu sa zavolá pôvodná funkcia handleSubmit, ktorá dokončí registráciu
        handleSubmit(teamsDataFromPage4, globalNote); // ZMENA: Odovzdávame teamsDataFromPage4 a globalNote
        handleCloseConfirmation(); // Zatvorí modál po odoslaní
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),
        
        // Modálne okno potvrdenia e-mailu
        React.createElement(EmailConfirmationModal, {
            show: showEmailConfirmationModal,
            onClose: handleCloseConfirmation,
            onConfirm: handleConfirmSubmit,
            userEmail: formData.email, // E-mailová adresa z formData
            loading: loading,
        }),

        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
            'Súhrn registrácie'
        ),

        React.createElement(
            'div',
            { className: 'space-y-6 text-gray-700' },
            React.createElement(
                'div',
                { className: 'p-4 border border-gray-200 rounded-lg bg-gray-50' },
                React.createElement('h3', { className: 'text-xl font-semibold mb-3 text-gray-800' }, 'Osobné údaje'),
                React.createElement('p', null, React.createElement('strong', null, 'Meno a priezvisko kontaktnej osoby: '), `${formData.firstName} ${formData.lastName}`),
                React.createElement('p', null, React.createElement('strong', null, 'E-mailová adresa kontaktnej osoby: '), formData.email),
                React.createElement('p', null, React.createElement('strong', null, 'Telefónne číslo kontaktnej osoby: '), 
                    formData.contactPhoneNumber ? 
                        `${selectedCountryDialCode} ${formData.contactPhoneNumber}` : '-'
                )
            ),

            React.createElement(
                'div',
                { className: 'p-4 border border-gray-200 rounded-lg bg-gray-50' },
                React.createElement('h3', { className: 'text-xl font-semibold mb-3 text-gray-800' }, 'Fakturačné údaje'),
                React.createElement('p', null, React.createElement('strong', null, 'Oficiálny názov klubu: '), formData.billing?.clubName || '-'),
                React.createElement('p', null, React.createElement('strong', null, 'IČO: '), formData.billing?.ico || '-'),
                React.createElement('p', null, React.createElement('strong', null, 'DIČ: '), formData.billing?.dic || '-'),
                React.createElement('p', null, React.createElement('strong', null, 'IČ DPH: '), formData.billing?.icDph || '-'),
                React.createElement('p', null, React.createElement('strong', null, 'Fakturačná adresa: '), 
                    formatAddress({
                        street: formData.street,
                        houseNumber: formData.houseNumber,
                        city: formData.city,
                        postalCode: formData.postalCode,
                        country: formData.country
                    }) || '-'
                )
            ),

            React.createElement(
                'div',
                { className: 'p-4 border border-gray-200 rounded-lg bg-gray-50' },
                React.createElement('h3', { className: 'text-xl font-semibold mb-3 text-gray-800' }, 'Registrované tímy a ich detaily'),
                formatTeamsData(teamsDataFromPage4)
            ),

            // NOVINKA: Zobrazenie globálnej poznámky
            globalNote && globalNote.trim() !== '' && React.createElement( // Podmienka, aby sa zobrazilo len ak globalNote nie je prázdny
                'div',
                { className: 'p-4 border border-gray-200 rounded-lg bg-gray-50' },
                React.createElement('h3', { className: 'text-xl font-semibold mb-3 text-gray-800' }, 'Poznámka'),
                React.createElement('p', { className: 'whitespace-pre-wrap' }, globalNote)
            ),

            // NOVINKA: Checkbox pre súhlas so spracovaním osobných údajov
            React.createElement(
                'div',
                { className: 'mt-6 flex items-center' },
                React.createElement('input', {
                    type: 'checkbox',
                    id: 'consent-checkbox',
                    className: 'form-checkbox h-5 w-5 text-blue-600 rounded-md focus:ring-blue-500',
                    checked: isConsentChecked,
                    onChange: (e) => setIsConsentChecked(e.target.checked),
                    disabled: loading,
                }),
                React.createElement('label', { htmlFor: 'consent-checkbox', className: 'ml-2 block text-gray-900' },
                    'Súhlasím so spracovaním osobných údajov pre účely organizácie turnaja.'
                )
            ),

            React.createElement(
                'div',
                { className: 'flex justify-between mt-6' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: () => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4: teamsDataFromPage4, currentGlobalNote: globalNote }), // NOVINKA: Odovzdanie globalNote
                        className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
                        disabled: loading,
                    },
                    'Späť'
                ),
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: handleShowConfirmation, // Teraz voláme funkciu na zobrazenie potvrdzovacieho modálu
                        // Dynamické triedy pre tlačidlo "Registrovať"
                        className: `font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 ${
                            loading || !isConsentChecked // Zablokované, ak loading alebo checkbox nie je zaškrtnutý
                                ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' // Zablokovaný stav
                                : 'bg-green-500 hover:bg-green-700 text-white' // Aktívny stav
                        }`,
                        disabled: loading || !isConsentChecked, // Zablokované, ak loading alebo checkbox nie je zaškrtnutý
                        style: { cursor: (loading || !isConsentChecked) ? 'not-allowed' : 'pointer' } // Ikona myši
                    },
                    loading ? React.createElement(
                        'div',
                        { className: 'flex items-center justify-center' },
                        React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' }, // ZMENA: text-green-500 na text-blue-500
                            React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                            React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                        ),
                        'Registrujem...'
                    ) : 'Registrovať'
                )
            )
        )
    );
}

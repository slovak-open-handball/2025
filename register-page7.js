// register-page7.js
// Obsahuje komponent pre poslednú stránku registračného formulára - zhrnutie zadaných údajov.

export function Page7Form({ formData, handlePrev, handleSubmit, loading, teamsDataFromPage4, NotificationModal, notificationMessage, closeNotification }) {

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

        return Object.keys(teams).map(categoryName => {
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
                                    .map(t => `${t.quantity}x ${t.size}`)
                                    .join(', ')
                        : 'žiadne';

                    // Detaily ubytovania
                    const accommodationDetails = team.accommodation?.type || 'Bez ubytovania';
                    // const teamHasAccommodation = accommodationDetails.toLowerCase() !== 'bez ubytovania'; // Nepotrebné, adresa sa zobrazuje podmienečne podľa hasAccommodation na Page6

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
                    if (team.packageId && team.packageDetails) { // Podmienka: musí byť vybrané packageId a packageDetails
                        const pkg = team.packageDetails;
                        let mealsHtml = null;
                        if (pkg.meals) {
                            const mealDates = Object.keys(pkg.meals).filter(key => key !== 'participantCard').sort();
                            mealsHtml = React.createElement('div', { className: 'ml-4 text-sm text-gray-600' },
                                React.createElement('strong', null, 'Stravovanie:'),
                                mealDates.length > 0 ? (
                                    mealDates.map(date => {
                                        const dateObj = new Date(date + 'T00:00:00'); // Ensure correct date parsing
                                        const displayDate = dateObj.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric' });
                                        const mealsForDay = pkg.meals[date];
                                        const includedItems = [];
                                        if (mealsForDay?.breakfast === 1) includedItems.push('Raňajky');
                                        if (mealsForDay?.lunch === 1) includedItems.push('Obed');
                                        if (mealsForDay?.dinner === 1) includedItems.push('Večera');
                                        if (mealsForDay?.refreshment === 1) includedItems.push('Občerstvenie');

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
                                    React.createElement('p', { className: 'font-bold text-gray-700 ml-4 mt-1' }, 'Zahŕňa účastnícku kartu')
                                );
                            }
                        }

                        packageDetailsHtml = React.createElement(React.Fragment, null,
                            React.createElement('p', null, `Balíček: ${pkg.name || '-'} (${pkg.price || 0}€)`),
                            mealsHtml
                        );
                    } else {
                        packageDetailsHtml = React.createElement('p', null, 'Balíček: Nezadaný');
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
                            jerseyNumber: '', // Realizačný tím nemá dres
                            firstName: member.firstName || '',
                            lastName: member.lastName || '',
                            dateOfBirth: formatDate(member.dateOfBirth),
                            registrationNumber: '', // Realizačný tím nemá registráciu
                            address: formatAddress(member.address)
                        });
                    });

                    // Pridanie mužských členov realizačného tímu
                    (team.menTeamMemberDetails || []).forEach(member => {
                        allParticipants.push({
                            type: 'Realizačný tím (muž)',
                            jerseyNumber: '', // Realizačný tím nemá dres
                            firstName: member.firstName || '',
                            lastName: member.lastName || '',
                            dateOfBirth: formatDate(member.dateOfBirth),
                            registrationNumber: '', // Realizačný tím nemá registráciu
                            address: formatAddress(member.address)
                        });
                    });


                    return React.createElement('div', { key: index, className: 'mb-4 ml-4 p-4 bg-gray-50 rounded-lg shadow-sm' },
                        React.createElement('p', { className: 'font-semibold text-blue-800 mb-2' }, `Tím ${index + 1}: ${team.teamName || '-'}`),
                        React.createElement('p', { className: 'text-sm text-gray-700 mb-4' }, `Počet hráčov: ${team.players || 0}, Členovia realizačného tímu (ženy): ${team.womenTeamMembers || 0}, Členovia realizačného tímu (muži): ${team.menTeamMembers || 0}`),
                        
                        // Zobrazenie tabuľky pre všetkých účastníkov
                        allParticipants.length > 0 ? (
                            React.createElement('div', { className: 'overflow-x-auto' },
                                React.createElement('table', { className: 'min-w-full bg-white border border-gray-300 rounded-lg shadow-sm' },
                                    React.createElement('thead', null,
                                        React.createElement('tr', { className: 'bg-gray-200 text-gray-700 uppercase text-sm leading-normal' },
                                            React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Typ'),
                                            React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Číslo dresu'),
                                            React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Meno'),
                                            React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Priezvisko'),
                                            React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Dátum narodenia'),
                                            React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Číslo registrácie'),
                                            React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Adresa trvalého bydliska')
                                        )
                                    ),
                                    React.createElement('tbody', { className: 'text-gray-600 text-sm font-light' },
                                        allParticipants.map((participant, pIdx) => (
                                            React.createElement('tr', { key: pIdx, className: 'border-b border-gray-200 hover:bg-gray-100' },
                                                React.createElement('td', { className: 'py-3 px-4 text-left whitespace-nowrap' }, participant.type),
                                                React.createElement('td', { className: 'py-3 px-4 text-left' }, participant.jerseyNumber),
                                                React.createElement('td', { className: 'py-3 px-4 text-left' }, participant.firstName),
                                                React.createElement('td', { className: 'py-3 px-4 text-left' }, participant.lastName),
                                                React.createElement('td', { className: 'py-3 px-4 text-left' }, participant.dateOfBirth),
                                                React.createElement('td', { className: 'py-3 px-4 text-left' }, participant.registrationNumber),
                                                React.createElement('td', { className: 'py-3 px-4 text-left' }, participant.address)
                                            )
                                        ))
                                    )
                                )
                            )
                        ) : React.createElement('p', { className: 'ml-4 text-gray-600 text-sm' }, 'Žiadni účastníci zadaní pre tento tím.'),

                        React.createElement('p', { className: 'mt-4 text-gray-700' }, React.createElement('strong', null, 'Tričká: '), tshirtsDetails),
                        React.createElement('p', { className: 'text-gray-700' }, React.createElement('strong', null, 'Ubytovanie: '), accommodationDetails),
                        React.createElement('p', { className: 'text-gray-700' }, React.createElement('strong', null, 'Doprava: '), arrivalDetails),
                        packageDetailsHtml
                    );
                })
            );
        });
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),

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
                React.createElement('p', null, React.createElement('strong', null, 'Meno: '), formData.firstName),
                React.createElement('p', null, React.createElement('strong', null, 'Priezvisko: '), formData.lastName),
                React.createElement('p', null, React.createElement('strong', null, 'E-mail: '), formData.email),
                React.createElement('p', null, React.createElement('strong', null, 'Telefónne číslo: '), formData.contactPhoneNumber)
            ),

            React.createElement(
                'div',
                { className: 'p-4 border border-gray-200 rounded-lg bg-gray-50' },
                React.createElement('h3', { className: 'text-xl font-semibold mb-3 text-gray-800' }, 'Fakturačné údaje'),
                React.createElement('p', null, React.createElement('strong', null, 'Oficiálny názov klubu: '), formData.billing?.clubName || '-'),
                React.createElement('p', null, React.createElement('strong', null, 'IČO: '), formData.billing?.ico || '-'),
                React.createElement('p', null, React.createElement('strong', null, 'DIČ: '), formData.billing?.dic || '-'),
                React.createElement('p', null, React.createElement('strong', null, 'IČ DPH: '), formData.billing?.icDph || '-'),
                React.createElement('p', null, React.createElement('strong', null, 'Ulica a číslo: '), `${formData.street || '-'} ${formData.houseNumber || '-'}`),
                React.createElement('p', null, React.createElement('strong', null, 'Mesto: '), formData.city || '-'),
                React.createElement('p', null, React.createElement('strong', null, 'PSČ: '), formData.postalCode || '-'),
                React.createElement('p', null, React.createElement('strong', null, 'Krajina: '), formData.country || '-')
            ),

            // Odstránený blok "Hlavné informácie (registranta)"

            React.createElement(
                'div',
                { className: 'p-4 border border-gray-200 rounded-lg bg-gray-50' },
                React.createElement('h3', { className: 'text-xl font-semibold mb-3 text-gray-800' }, 'Registrované tímy a ich detaily'),
                formatTeamsData(teamsDataFromPage4)
            ),

            React.createElement(
                'div',
                { className: 'flex justify-between mt-6' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        // NOVINKA: Odovzdávame aktuálne dáta do handlePrev
                        onClick: () => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4: teamsDataFromPage4 }),
                        className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
                        disabled: loading,
                    },
                    'Späť'
                ),
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: handleSubmit,
                        className: `font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 ${loading ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-700 text-white'}`,
                        disabled: loading,
                    },
                    loading ? React.createElement(
                        'div',
                        { className: 'flex items-center justify-center' },
                        React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-green-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
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

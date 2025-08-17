// register-page6.js
// Obsahuje komponent pre poslednú stránku registračného formulára - zhrnutie zadaných údajov.

export function Page6Form({ formData, handlePrev, handleSubmit, loading, teamsDataFromPage4, NotificationModal, notificationMessage, closeNotification }) {

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
                    if (team.packageDetails) {
                        const pkg = team.packageDetails;
                        let mealsHtml = null;
                        if (pkg.meals) {
                            const mealDates = Object.keys(pkg.meals).filter(key => key !== 'participantCard').sort();
                            mealsHtml = React.createElement('div', { className: 'ml-4 text-sm text-gray-600' },
                                React.createElement('strong', null, 'Stravovanie:'),
                                mealDates.length > 0 ? (
                                    mealDates.map(date => {
                                        const mealsForDay = pkg.meals[date];
                                        const includedItems = [];
                                        if (mealsForDay?.breakfast === 1) includedItems.push('Raňajky');
                                        if (mealsForDay?.lunch === 1) includedItems.push('Obed');
                                        if (mealsForDay?.dinner === 1) includedItems.push('Večera');
                                        if (mealsForDay?.refreshment === 1) includedItems.push('Občerstvenie');

                                        if (includedItems.length > 0) {
                                            const dateObj = new Date(date + 'T00:00:00');
                                            const displayDate = dateObj.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric' });
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

                    // Dynamické generovanie riadkov pre hráčov
                    const playersRows = Array.from({ length: team.players || 0 }).map((_, playerIndex) => (
                        React.createElement('div', { key: `player-${index}-${playerIndex}`, className: 'mb-2 ml-4 p-2 bg-gray-100 rounded-md shadow-sm' },
                            React.createElement('p', null, React.createElement('strong', null, `Hráč ${playerIndex + 1}:`)),
                            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-2 text-sm' },
                                React.createElement('p', null, `Číslo dresu: ${team.playerDetails?.[playerIndex]?.jerseyNumber || '-'}`),
                                React.createElement('p', null, `Meno: ${team.playerDetails?.[playerIndex]?.firstName || '-'}`),
                                React.createElement('p', null, `Priezvisko: ${team.playerDetails?.[playerIndex]?.lastName || '-'}`),
                                React.createElement('p', null, `Dátum narodenia: ${team.playerDetails?.[playerIndex]?.dateOfBirth || '-'}`),
                                React.createElement('p', null, `Registrovaný: ${team.playerDetails?.[playerIndex]?.isRegistered ? 'Áno' : 'Nie'}`),
                                team.playerDetails?.[playerIndex]?.isRegistered && React.createElement('p', null, `Číslo registrácie: ${team.playerDetails?.[playerIndex]?.registrationNumber || '-'}`)
                            )
                        )
                    ));

                    // Dynamické generovanie riadkov pre členov realizačného tímu (ženy)
                    const womenTeamMembersRows = Array.from({ length: team.womenTeamMembers || 0 }).map((_, memberIndex) => (
                        React.createElement('div', { key: `woman-member-${index}-${memberIndex}`, className: 'mb-2 ml-4 p-2 bg-gray-100 rounded-md shadow-sm' },
                            React.createElement('p', null, React.createElement('strong', null, `Člen realizačného tímu (žena) ${memberIndex + 1}:`)),
                            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-2 text-sm' },
                                React.createElement('p', null, `Meno: ${team.womenTeamMemberDetails?.[memberIndex]?.firstName || '-'}`),
                                React.createElement('p', null, `Priezvisko: ${team.womenTeamMemberDetails?.[memberIndex]?.lastName || '-'}`),
                                React.createElement('p', null, `Dátum narodenia: ${team.womenTeamMemberDetails?.[memberIndex]?.dateOfBirth || '-'}`)
                            )
                        )
                    ));

                    // Dynamické generovanie riadkov pre členov realizačného tímu (muži)
                    const menTeamMembersRows = Array.from({ length: team.menTeamMembers || 0 }).map((_, memberIndex) => (
                        React.createElement('div', { key: `man-member-${index}-${memberIndex}`, className: 'mb-2 ml-4 p-2 bg-gray-100 rounded-md shadow-sm' },
                            React.createElement('p', null, React.createElement('strong', null, `Člen realizačného tímu (muž) ${memberIndex + 1}:`)),
                            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-2 text-sm' },
                                React.createElement('p', null, `Meno: ${team.menTeamMemberDetails?.[memberIndex]?.firstName || '-'}`),
                                React.createElement('p', null, `Priezvisko: ${team.menTeamMemberDetails?.[memberIndex]?.lastName || '-'}`),
                                React.createElement('p', null, `Dátum narodenia: ${team.menTeamMemberDetails?.[memberIndex]?.dateOfBirth || '-'}`)
                            )
                        )
                    ));


                    return React.createElement('div', { key: index, className: 'mb-2 ml-4 p-2 bg-gray-50 rounded-md shadow-sm' },
                        React.createElement('p', null, React.createElement('strong', null, `Tím ${index + 1}: `), team.teamName || '-'),
                        React.createElement('p', null, `Počet hráčov: ${team.players || 0}`),
                        playersRows, // Zobrazenie riadkov hráčov
                        React.createElement('p', null, `Členovia realizačného tímu (ženy): ${team.womenTeamMembers || 0}`),
                        womenTeamMembersRows, // Zobrazenie riadkov ženského realizačného tímu
                        React.createElement('p', null, `Členovia realizačného tímu (muži): ${team.menTeamMembers || 0}`),
                        menTeamMembersRows, // Zobrazenie riadkov mužského realizačného tímu
                        React.createElement('p', null, `Tričká: ${tshirtsDetails}`),
                        React.createElement('p', null, `Ubytovanie: ${accommodationDetails}`),
                        React.createElement('p', null, `Doprava: ${arrivalDetails}`),
                        packageDetailsHtml
                    );
                })
            );
        });
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: 'info' }),

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

            // Informácie o ubytovaní (pôvodne pre formData, zachované)
            // Tieto sekcie zostávajú, ak reprezentujú celkové klubové preferencie, nie tímu
            // Dôležité: Tieto sú len pre hlavné údaje formulára, nie pre každý tím
            React.createElement(
                'div',
                { className: 'p-4 border border-gray-200 rounded-lg bg-gray-50' },
                React.createElement('h3', { className: 'text-xl font-semibold mb-3 text-gray-800' }, 'Hlavné informácie (registranta)'),
                React.createElement('p', null, React.createElement('strong', null, 'Typ ubytovania (registranta): '), formData.accommodation?.type || 'Nezadané'),
                React.createElement('p', null, React.createElement('strong', null, 'Typ dopravy (registranta): '), formData.arrival?.type || 'Nezadané'),
                (formData.arrival?.type === 'vlaková doprava' || formData.arrival?.type === 'autobusová doprava') && formData.arrival?.time &&
                React.createElement('p', null, React.createElement('strong', null, 'Plánovaný čas príchodu (registranta): '), formData.arrival.time)
            ),

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
                        onClick: handlePrev,
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

// register-page5.js
// Obsahuje komponent pre zhrnutie zadaných údajov pred finálnou registráciou.

export function Page5Summary({ formData, teamsDataFromPage4, availableCategoriesMap, handlePrev, handleSubmit, loading, NotificationModal, notificationMessage, closeNotification }) {

    // Funkcia na nájdenie názvu kategórie podľa ID
    const getCategoryNameById = (categoryId) => {
        return availableCategoriesMap[categoryId] || 'Neznáma kategória';
    };

    // Helper funkcia pre formátovanie telefónneho čísla, ak už nie je formátované
    const formatPhoneNumberForDisplay = (phoneNumber) => {
        // Ak už obsahuje medzery, predpokladáme, že je formátované
        if (phoneNumber.includes(' ')) {
            return phoneNumber;
        }
        // Inak formátujeme
        let formatted = '';
        for (let i = 0; i < phoneNumber.length; i++) {
            formatted += phoneNumber[i];
            if ((i + 1) % 3 === 0 && i + 1 < phoneNumber.length) {
                formatted += ' ';
            }
        }
        return formatted;
    };

    // CSS triedy pre tlačidlo registrácie
    const registerButtonClasses = `
        font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
        ${loading
            ? 'bg-white text-green-500 border border-green-500 cursor-not-allowed'
            : 'bg-green-500 hover:bg-green-700 text-white'
        }
    `;

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification }),

        React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
            'Zhrnutie registrácie'
        ),
        React.createElement(
            'div',
            { className: 'space-y-6' }, // Väčšie medzery medzi sekciami
            // Osobné údaje
            React.createElement(
                'div',
                { className: 'bg-gray-50 p-4 rounded-lg shadow-sm' },
                React.createElement('h3', { className: 'text-xl font-semibold mb-3 text-gray-700' }, 'Osobné údaje'),
                React.createElement('p', { className: 'text-gray-700' }, React.createElement('strong', null, 'Meno: '), `${formData.firstName} ${formData.lastName}`),
                React.createElement('p', { className: 'text-gray-700' }, React.createElement('strong', null, 'E-mail: '), formData.email),
                React.createElement('p', { className: 'text-gray-700' }, React.createElement('strong', null, 'Tel. číslo: '), formatPhoneNumberForDisplay(formData.contactPhoneNumber)),
            ),

            // Fakturačné údaje
            React.createElement(
                'div',
                { className: 'bg-gray-50 p-4 rounded-lg shadow-sm' },
                React.createElement('h3', { className: 'text-xl font-semibold mb-3 text-gray-700' }, 'Fakturačné údaje'),
                React.createElement('p', { className: 'text-gray-700' }, React.createElement('strong', null, 'Názov klubu: '), formData.billing?.clubName),
                formData.billing?.ico && React.createElement('p', { className: 'text-gray-700' }, React.createElement('strong', null, 'IČO: '), formData.billing.ico),
                formData.billing?.dic && React.createElement('p', { className: 'text-gray-700' }, React.createElement('strong', null, 'DIČ: '), formData.billing.dic),
                formData.billing?.icDph && React.createElement('p', { className: 'text-gray-700' }, React.createElement('strong', null, 'IČ DPH: '), formData.billing.icDph),
                React.createElement('p', { className: 'text-gray-700' }, React.createElement('strong', null, 'Adresa: '), `${formData.street} ${formData.houseNumber}, ${formData.postalCode} ${formData.city}, ${formData.country}`),
            ),

            // Kategórie a tímy
            Object.keys(teamsDataFromPage4).length > 0 && React.createElement(
                'div',
                { className: 'bg-gray-50 p-4 rounded-lg shadow-sm' },
                React.createElement('h3', { className: 'text-xl font-semibold mb-3 text-gray-700' }, 'Kategórie a tímy'),
                Object.keys(teamsDataFromPage4).map(categoryName => (
                    React.createElement(
                        'div',
                        { key: categoryName, className: 'mb-4 border-b border-gray-200 pb-2 last:border-b-0' },
                        React.createElement('h4', { className: 'text-lg font-medium text-gray-800' }, `Kategória: ${categoryName}`),
                        (teamsDataFromPage4[categoryName] || []).map((team, teamIndex) => (
                            React.createElement(
                                'div',
                                { key: `${categoryName}-${teamIndex}-summary`, className: 'ml-4 mt-2 p-3 bg-white rounded-md shadow-sm' },
                                React.createElement('p', { className: 'font-semibold text-blue-700' }, `Tím ${teamIndex + 1}: ${team.teamName}`),
                                React.createElement('p', { className: 'text-gray-700 text-sm' }, React.createElement('strong', null, 'Počet hráčov: '), team.players),
                                React.createElement('p', { className: 'text-gray-700 text-sm' }, React.createElement('strong', null, 'Realizačný tím (ženy): '), team.womenTeamMembers),
                                React.createElement('p', { className: 'text-gray-700 text-sm' }, React.createElement('strong', null, 'Realizačný tím (muži): '), team.menTeamMembers),
                                team.tshirts && team.tshirts.length > 0 && React.createElement(
                                    'div',
                                    { className: 'mt-2' },
                                    React.createElement('p', { className: 'font-medium text-gray-700 text-sm' }, 'Tričká:'),
                                    React.createElement('ul', { className: 'list-disc list-inside text-gray-700 text-sm' },
                                        team.tshirts.map((tshirt, tsIndex) => (
                                            tshirt.size && tshirt.quantity > 0 && React.createElement('li', { key: tsIndex }, `${tshirt.size}: ${tshirt.quantity} ks`)
                                        ))
                                    )
                                )
                            )
                        ))
                    )
                ))
            ),

            // Ovládacie tlačidlá
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
                        onClick: handleSubmit, // Volá finálny submit (registráciu)
                        className: registerButtonClasses,
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

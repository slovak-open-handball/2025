// logged-in-tournament-settings-category-settings.js

import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function CategorySettings({ db, userProfileData, showNotification, sendAdminNotification }) {
    const [categories, setCategories] = React.useState([]);
    const [showModal, setShowModal] = React.useState(false);
    const [currentCategory, setCurrentCategory] = React.useState(null);
    const [newMaxTeams, setNewMaxTeams] = React.useState(12);

    // Načítavanie kategórií
    React.useEffect(() => {
        if (!db || !userProfileData || userProfileData.role !== 'admin') return;

        const catRef = doc(db, 'settings', 'categories');

        const unsubscribe = onSnapshot(catRef, snap => {
            if (snap.exists()) {
                const data = snap.data() || {};
                const list = Object.entries(data).map(([id, obj]) => ({
                    id,
                    name: obj.name || `Kategória ${id}`,
                    maxTeams: obj.maxTeams ?? 12,
                    dateFrom: obj.dateFrom || '',
                    dateTo: obj.dateTo || '',
                })).sort((a, b) => a.name.localeCompare(b.name));

                setCategories(list);
            } else {
                setCategories([]);
            }
        }, err => {
            showNotification(`Chyba pri načítaní kategórií: ${err.message}`, 'error');
        });

        return () => unsubscribe();
    }, [db, userProfileData, showNotification]);

    const openEditModal = (cat) => {
        setCurrentCategory(cat);
        setNewMaxTeams(cat.maxTeams);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setCurrentCategory(null);
        setNewMaxTeams(12);
    };

    const handleSave = async () => {
        if (!db || userProfileData?.role !== 'admin') {
            showNotification("Nemáte oprávnenie.", 'error');
            return;
        }

        if (newMaxTeams < 1) {
            showNotification("Maximálny počet tímov musí byť aspoň 1.", 'error');
            return;
        }

        try {
            const catRef = doc(db, 'settings', 'categories');
            await setDoc(catRef, {
                [currentCategory.id]: {
                    ...currentCategory,
                    maxTeams: Number(newMaxTeams)
                }
            }, { merge: true });

            showNotification(`Max. počet tímov pre „${currentCategory.name}“ zmenený na ${newMaxTeams}.`, 'success');

            // voliteľná admin notifikácia
            await sendAdminNotification?.({
                type: 'updateCategoryMaxTeams',
                data: {
                    categoryName: currentCategory.name,
                    oldValue: currentCategory.maxTeams,
                    newValue: newMaxTeams
                }
            });

            closeModal();
        } catch (err) {
            showNotification(`Chyba pri ukladaní: ${err.message}`, 'error');
        }
    };

    // Farba podľa počtu tímov (voliteľné vizuálne vylepšenie)
    const getMaxTeamsColor = (count) => {
        if (count <= 6) return 'text-red-600';
        if (count <= 10) return 'text-orange-600';
        if (count <= 14) return 'text-yellow-600';
        return 'text-green-600';
    };

    return React.createElement(
        React.Fragment,
        null,

        React.createElement(
            'div',
            { className: 'space-y-6 p-6 border border-gray-200 rounded-lg shadow-sm mt-8 bg-white' },
            React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-6' }, 'Nastavenia kategórií'),

            categories.length === 0 ?
                React.createElement(
                    'p',
                    { className: 'text-gray-500 text-center py-12 italic' },
                    'Momentálne nie sú načítané žiadne kategórie.'
                ) :
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' },
                    categories.map(cat => React.createElement(
                        'div',
                        {
                            key: cat.id,
                            className: 'bg-white border border-gray-200 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden'
                        },
                        React.createElement(
                            'div',
                            { className: 'p-5' },
                            React.createElement('h3', {
                                className: 'text-xl font-semibold text-gray-800 mb-3 truncate'
                            }, cat.name),

                            React.createElement(
                                'div',
                                { className: 'space-y-2 text-gray-700' },
                                React.createElement(
                                    'div',
                                    { className: 'flex justify-between items-center' },
                                    React.createElement('span', { className: 'font-medium' }, 'Max. tímov:'),
                                    React.createElement(
                                        'span',
                                        { className: `font-bold text-lg ${getMaxTeamsColor(cat.maxTeams)}` },
                                        cat.maxTeams
                                    )
                                ),
                                (cat.dateFrom || cat.dateTo) && React.createElement(
                                    'div',
                                    { className: 'text-sm text-gray-600' },
                                    `Narodení ${cat.dateFrom ? `od ${cat.dateFrom}` : ''}${cat.dateTo ? ` do ${cat.dateTo}` : ''}`
                                )
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'px-5 pb-5 pt-2 border-t border-gray-100 bg-gray-50' },
                            React.createElement(
                                'button',
                                {
                                    onClick: () => openEditModal(cat),
                                    className: 'w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors duration-200'
                                },
                                'Upraviť maximálny počet tímov'
                            )
                        )
                    ))
                )
        ),

        // ─── MODAL na úpravu max tímov ───────────────────
        showModal && React.createElement(
            'div',
            { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4' },
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden' },
                React.createElement(
                    'div',
                    { className: 'p-6' },
                    React.createElement('h3', {
                        className: 'text-xl font-bold text-gray-800 mb-6 text-center'
                    }, currentCategory?.name || 'Kategória'),

                    React.createElement('label', {
                        className: 'block text-gray-700 font-medium mb-3 text-center'
                    }, 'Maximálny počet tímov v kategórii'),

                    React.createElement('input', {
                        type: 'number',
                        min: 1,
                        className: 'w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                        value: newMaxTeams,
                        onChange: e => setNewMaxTeams(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1)),
                        autoFocus: true
                    }),

                    React.createElement(
                        'div',
                        { className: 'flex justify-center gap-4 mt-8' },
                        React.createElement('button', {
                            onClick: closeModal,
                            className: 'bg-gray-200 hover:bg-gray-300 text-gray-800 px-8 py-3 rounded-lg font-medium min-w-[120px] transition-colors'
                        }, 'Zrušiť'),
                        React.createElement('button', {
                            onClick: handleSave,
                            className: 'bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium min-w-[120px] transition-colors'
                        }, 'Uložiť')
                    )
                )
            )
        )
    );
}

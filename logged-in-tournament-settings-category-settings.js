// logged-in-tournament-settings-category-settings.js

import { doc, onSnapshot, setDoc, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function CategorySettings({ db, userProfileData, showNotification, sendAdminNotification }) {
    const [categories, setCategories] = React.useState([]);
    const [showModal, setShowModal] = React.useState(false);
    const [currentCategory, setCurrentCategory] = React.useState(null);
    const [newMaxTeams, setNewMaxTeams] = React.useState(12);

    // Načítanie kategórií
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
                    ...currentCategory,           // zachováme name, dateFrom, dateTo, ...
                    maxTeams: Number(newMaxTeams) // zmeníme len toto pole
                }
            }, { merge: true });

            showNotification(`Maximálny počet tímov pre „${currentCategory.name}“ zmenený na ${newMaxTeams}.`, 'success');

            // voliteľná notifikácia adminom
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

    // ────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────

    return React.createElement(
        React.Fragment,
        null,

        React.createElement(
            'div',
            { className: 'space-y-4 p-6 border border-gray-200 rounded-lg shadow-sm mt-8' },
            React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Nastavenia kategórií'),

            React.createElement(
                'div',
                { className: 'space-y-3' },
                categories.length > 0 ?
                    categories.map(cat => React.createElement(
                        'div',
                        {
                            key: cat.id,
                            className: 'flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-4 rounded-md shadow-sm gap-3'
                        },
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-medium text-gray-800 text-lg' }, cat.name),
                            React.createElement('div', { className: 'text-sm text-gray-600 mt-1 space-x-3' },
                                React.createElement('span', null, `Max. tímov: ${cat.maxTeams}`),
                                (cat.dateFrom || cat.dateTo) && React.createElement(
                                    'span',
                                    null,
                                    `• Narodení ${cat.dateFrom ? `od ${cat.dateFrom}` : ''}${cat.dateTo ? ` do ${cat.dateTo}` : ''}`
                                )
                            )
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: () => openEditModal(cat),
                                className: 'bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold py-1 px-4 rounded transition-colors'
                            },
                            'Upraviť max. tímov'
                        )
                    )) :
                    React.createElement(
                        'p',
                        { className: 'text-gray-500 text-center py-8 italic' },
                        'Zatiaľ nie sú načítané žiadne kategórie (alebo dokument categories je prázdny).'
                    )
            )
        ),

        // ─── MODAL – iba úprava max tímov ────────────────
        showModal && React.createElement(
            'div', { className: 'fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50' },
            React.createElement(
                'div', { className: 'bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl' },
                React.createElement('h3', { className: 'text-xl font-bold mb-5 text-center' },
                    `Max. počet tímov – ${currentCategory?.name}`
                ),

                React.createElement('label', {
                    className: 'block text-gray-700 font-medium mb-2 text-center'
                }, 'Zadajte nový maximálny počet tímov'),

                React.createElement('input', {
                    type: 'number',
                    min: 1,
                    className: 'border border-gray-300 rounded w-full px-4 py-3 text-center text-2xl font-bold mb-6 focus:outline-none focus:ring-2 focus:ring-blue-400',
                    value: newMaxTeams,
                    onChange: e => setNewMaxTeams(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1)),
                    autoFocus: true
                }),

                React.createElement(
                    'div',
                    { className: 'flex justify-center gap-4' },
                    React.createElement('button', {
                        onClick: closeModal,
                        className: 'bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2.5 rounded font-medium transition-colors min-w-[100px]'
                    }, 'Zrušiť'),
                    React.createElement('button', {
                        onClick: handleSave,
                        className: 'bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded font-medium transition-colors min-w-[100px]'
                    }, 'Uložiť')
                )
            )
        )
    );
}

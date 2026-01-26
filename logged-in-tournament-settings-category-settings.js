// logged-in-tournament-settings-category-settings.js

import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function CategorySettings({ db, userProfileData, showNotification }) {
    const [categories, setCategories] = React.useState([]);
    const [editedMaxTeams, setEditedMaxTeams] = React.useState({}); // { categoryId: newValue }
    const [saving, setSaving] = React.useState(false);

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
                })).sort((a, b) => a.name.localeCompare(b.name));

                setCategories(list);
                // inicializujeme editované hodnoty podľa aktuálnych dát
                const initialEdited = {};
                list.forEach(cat => {
                    initialEdited[cat.id] = cat.maxTeams;
                });
                setEditedMaxTeams(initialEdited);
            } else {
                setCategories([]);
                setEditedMaxTeams({});
            }
        }, err => {
            showNotification(`Chyba pri načítaní kategórií: ${err.message}`, 'error');
        });

        return () => unsubscribe();
    }, [db, userProfileData, showNotification]);

    const handleInputChange = (catId, value) => {
        const numValue = value === '' ? '' : Math.max(1, parseInt(value) || 1);
        setEditedMaxTeams(prev => ({
            ...prev,
            [catId]: numValue
        }));
    };

    const hasChanges = React.useMemo(() => {
        return categories.some(cat => editedMaxTeams[cat.id] !== cat.maxTeams);
    }, [categories, editedMaxTeams]);

    const handleSaveAll = async () => {
        if (!hasChanges || saving) return;

        if (!db || userProfileData?.role !== 'admin') {
            showNotification("Nemáte oprávnenie.", 'error');
            return;
        }

        setSaving(true);

        try {
            const catRef = doc(db, 'settings', 'categories');
            const updates = {};

            categories.forEach(cat => {
                const newValue = editedMaxTeams[cat.id];
                if (newValue !== cat.maxTeams && newValue >= 1) {
                    updates[cat.id] = {
                        name: cat.name,
                        maxTeams: Number(newValue)
                    };
                }
            });

            if (Object.keys(updates).length > 0) {
                await setDoc(catRef, updates, { merge: true });
                showNotification("Všetky zmeny boli uložené.", 'success');
            }

            // aktualizujeme pôvodné hodnoty po uložení
            setCategories(prev => prev.map(cat => ({
                ...cat,
                maxTeams: editedMaxTeams[cat.id] ?? cat.maxTeams
            })));
        } catch (err) {
            showNotification(`Chyba pri ukladaní zmien: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Farba podľa počtu tímov (voliteľné)
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
                React.Fragment,
                null,
                React.createElement(
                    'div',
                    { className: 'space-y-5' },
                    categories.map(cat => React.createElement(
                        'div',
                        {
                            key: cat.id,
                            className: 'bg-white border border-gray-200 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden flex flex-col'
                        },
                        React.createElement(
                            'div',
                            { className: 'p-6 flex-grow' },
                            React.createElement('h3', {
                                className: 'text-xl font-semibold text-gray-800 mb-4 truncate'
                            }, cat.name),

                            React.createElement(
                                'div',
                                { className: 'flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4' },
                                React.createElement(
                                    'span',
                                    { className: 'font-medium text-lg whitespace-nowrap' },
                                    'Maximálny počet tímov:'
                                ),
                                React.createElement('input', {
                                    type: 'number',
                                    min: 1,
                                    value: editedMaxTeams[cat.id] ?? cat.maxTeams,
                                    onChange: e => handleInputChange(cat.id, e.target.value),
                                    className: 'w-24 text-center border border-gray-300 rounded-lg py-2 px-3 font-bold text-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'  // ← tu je text-black
                                })
                            )
                        )
                    ))
                ),

                // Jedno spoločné tlačidlo na uloženie všetkých zmien
                React.createElement(
                    'div',
                    { className: 'mt-8 flex justify-center' },
                    React.createElement(
                        'button',
                        {
                            onClick: handleSaveAll,
                            disabled: !hasChanges || saving,
                            className: `px-10 py-4 rounded-lg font-bold text-lg transition-colors min-w-[280px] ${
                                hasChanges && !saving
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`
                        },
                        saving ? 'Ukladám...' : 'Uložiť'
                    )
                )
            )
    )
);
}

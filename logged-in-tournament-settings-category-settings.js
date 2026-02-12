// logged-in-tournament-settings-category-settings.js

import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function CategorySettings({ db, userProfileData, showNotification }) {
    const [categories, setCategories] = React.useState([]);
    const [editedMaxTeams, setEditedMaxTeams] = React.useState({});
    const [editedPeriods, setEditedPeriods] = React.useState({});
    const [editedPeriodDuration, setEditedPeriodDuration] = React.useState({});
    const [editedBreakDuration, setEditedBreakDuration] = React.useState({});
    const [editedMatchBreak, setEditedMatchBreak] = React.useState({});
    const [editedDrawColor, setEditedDrawColor] = React.useState({});
    const [editedTransportColor, setEditedTransportColor] = React.useState({});
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
                    periods: obj.periods ?? 2,
                    periodDuration: obj.periodDuration ?? 20,
                    breakDuration: obj.breakDuration ?? 2,
                    matchBreak: obj.matchBreak ?? 5,
                    drawColor: obj.drawColor ?? '#3B82F6',
                    transportColor: obj.transportColor ?? '#10B981'
                })).sort((a, b) => a.name.localeCompare(b.name));

                setCategories(list);
                
                // Inicializácia editovaných hodnôt
                const initialMaxTeams = {};
                const initialPeriods = {};
                const initialPeriodDuration = {};
                const initialBreakDuration = {};
                const initialMatchBreak = {};
                const initialDrawColor = {};
                const initialTransportColor = {};
                
                list.forEach(cat => {
                    initialMaxTeams[cat.id] = cat.maxTeams;
                    initialPeriods[cat.id] = cat.periods;
                    initialPeriodDuration[cat.id] = cat.periodDuration;
                    initialBreakDuration[cat.id] = cat.breakDuration;
                    initialMatchBreak[cat.id] = cat.matchBreak;
                    initialDrawColor[cat.id] = cat.drawColor;
                    initialTransportColor[cat.id] = cat.transportColor;
                });
                
                setEditedMaxTeams(initialMaxTeams);
                setEditedPeriods(initialPeriods);
                setEditedPeriodDuration(initialPeriodDuration);
                setEditedBreakDuration(initialBreakDuration);
                setEditedMatchBreak(initialMatchBreak);
                setEditedDrawColor(initialDrawColor);
                setEditedTransportColor(initialTransportColor);
            } else {
                setCategories([]);
                setEditedMaxTeams({});
                setEditedPeriods({});
                setEditedPeriodDuration({});
                setEditedBreakDuration({});
                setEditedMatchBreak({});
                setEditedDrawColor({});
                setEditedTransportColor({});
            }
        }, err => {
            showNotification(`Chyba pri načítaní kategórií: ${err.message}`, 'error');
        });

        return () => unsubscribe();
    }, [db, userProfileData, showNotification]);

    // Handlery pre jednotlivé inputy
    const handleMaxTeamsChange = (catId, value) => {
        const numValue = value === '' ? '' : Math.max(1, parseInt(value) || 1);
        setEditedMaxTeams(prev => ({ ...prev, [catId]: numValue }));
    };

    const handlePeriodsChange = (catId, value) => {
        const numValue = value === '' ? '' : Math.max(1, parseInt(value) || 1);
        setEditedPeriods(prev => ({ ...prev, [catId]: numValue }));
    };

    const handlePeriodDurationChange = (catId, value) => {
        const numValue = value === '' ? '' : Math.max(1, parseInt(value) || 1);
        setEditedPeriodDuration(prev => ({ ...prev, [catId]: numValue }));
    };

    const handleBreakDurationChange = (catId, value) => {
        const numValue = value === '' ? '' : Math.max(0, parseInt(value) || 0);
        setEditedBreakDuration(prev => ({ ...prev, [catId]: numValue }));
    };

    const handleMatchBreakChange = (catId, value) => {
        const numValue = value === '' ? '' : Math.max(0, parseInt(value) || 0);
        setEditedMatchBreak(prev => ({ ...prev, [catId]: numValue }));
    };

    const handleDrawColorChange = (catId, value) => {
        setEditedDrawColor(prev => ({ ...prev, [catId]: value }));
    };

    const handleTransportColorChange = (catId, value) => {
        setEditedTransportColor(prev => ({ ...prev, [catId]: value }));
    };

    // Výpočet celkového času zápasu
    const calculateTotalMatchTime = (catId) => {
        const periods = editedPeriods[catId] ?? categories.find(c => c.id === catId)?.periods ?? 2;
        const periodDuration = editedPeriodDuration[catId] ?? categories.find(c => c.id === catId)?.periodDuration ?? 20;
        const breakDuration = editedBreakDuration[catId] ?? categories.find(c => c.id === catId)?.breakDuration ?? 2;
        const matchBreak = editedMatchBreak[catId] ?? categories.find(c => c.id === catId)?.matchBreak ?? 5;
        
        const playingTime = periods * periodDuration;
        const breaksBetweenPeriods = (periods - 1) * breakDuration;
        const totalTimeWithMatchBreak = playingTime + breaksBetweenPeriods + matchBreak;
        
        return {
            playingTime,
            breaksBetweenPeriods,
            totalTimeWithMatchBreak
        };
    };

    // Kontrola zmien
    const hasChanges = React.useMemo(() => {
        return categories.some(cat => 
            editedMaxTeams[cat.id] !== cat.maxTeams ||
            editedPeriods[cat.id] !== cat.periods ||
            editedPeriodDuration[cat.id] !== cat.periodDuration ||
            editedBreakDuration[cat.id] !== cat.breakDuration ||
            editedMatchBreak[cat.id] !== cat.matchBreak ||
            editedDrawColor[cat.id] !== cat.drawColor ||
            editedTransportColor[cat.id] !== cat.transportColor
        );
    }, [categories, editedMaxTeams, editedPeriods, editedPeriodDuration, 
        editedBreakDuration, editedMatchBreak, editedDrawColor, editedTransportColor]);

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
                const updatedData = {};
                let hasUpdates = false;

                if (editedMaxTeams[cat.id] !== cat.maxTeams && editedMaxTeams[cat.id] >= 1) {
                    updatedData.maxTeams = Number(editedMaxTeams[cat.id]);
                    hasUpdates = true;
                }
                if (editedPeriods[cat.id] !== cat.periods && editedPeriods[cat.id] >= 1) {
                    updatedData.periods = Number(editedPeriods[cat.id]);
                    hasUpdates = true;
                }
                if (editedPeriodDuration[cat.id] !== cat.periodDuration && editedPeriodDuration[cat.id] >= 1) {
                    updatedData.periodDuration = Number(editedPeriodDuration[cat.id]);
                    hasUpdates = true;
                }
                if (editedBreakDuration[cat.id] !== cat.breakDuration && editedBreakDuration[cat.id] >= 0) {
                    updatedData.breakDuration = Number(editedBreakDuration[cat.id]);
                    hasUpdates = true;
                }
                if (editedMatchBreak[cat.id] !== cat.matchBreak && editedMatchBreak[cat.id] >= 0) {
                    updatedData.matchBreak = Number(editedMatchBreak[cat.id]);
                    hasUpdates = true;
                }
                if (editedDrawColor[cat.id] !== cat.drawColor) {
                    updatedData.drawColor = editedDrawColor[cat.id];
                    hasUpdates = true;
                }
                if (editedTransportColor[cat.id] !== cat.transportColor) {
                    updatedData.transportColor = editedTransportColor[cat.id];
                    hasUpdates = true;
                }

                if (hasUpdates) {
                    updates[cat.id] = {
                        name: cat.name,
                        ...updatedData
                    };
                }
            });

            if (Object.keys(updates).length > 0) {
                await setDoc(catRef, updates, { merge: true });
                showNotification("Všetky zmeny boli uložené.", 'success');
            }

            // Aktualizácia pôvodných hodnôt po uložení
            setCategories(prev => prev.map(cat => ({
                ...cat,
                maxTeams: editedMaxTeams[cat.id] ?? cat.maxTeams,
                periods: editedPeriods[cat.id] ?? cat.periods,
                periodDuration: editedPeriodDuration[cat.id] ?? cat.periodDuration,
                breakDuration: editedBreakDuration[cat.id] ?? cat.breakDuration,
                matchBreak: editedMatchBreak[cat.id] ?? cat.matchBreak,
                drawColor: editedDrawColor[cat.id] ?? cat.drawColor,
                transportColor: editedTransportColor[cat.id] ?? cat.transportColor
            })));
        } catch (err) {
            showNotification(`Chyba pri ukladaní zmien: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Reset handler pre jednotlivú kategóriu
    const handleResetCategory = (catId) => {
        const category = categories.find(c => c.id === catId);
        if (category) {
            setEditedMaxTeams(prev => ({ ...prev, [catId]: category.maxTeams }));
            setEditedPeriods(prev => ({ ...prev, [catId]: category.periods }));
            setEditedPeriodDuration(prev => ({ ...prev, [catId]: category.periodDuration }));
            setEditedBreakDuration(prev => ({ ...prev, [catId]: category.breakDuration }));
            setEditedMatchBreak(prev => ({ ...prev, [catId]: category.matchBreak }));
            setEditedDrawColor(prev => ({ ...prev, [catId]: category.drawColor }));
            setEditedTransportColor(prev => ({ ...prev, [catId]: category.transportColor }));
        }
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
                        { className: 'space-y-6' },
                        categories.map(cat => {
                            const totalTime = calculateTotalMatchTime(cat.id);
                            
                            return React.createElement(
                                'div',
                                {
                                    key: cat.id,
                                    className: 'bg-white border border-gray-200 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden'
                                },
                                React.createElement(
                                    'div',
                                    { className: 'p-6' },
                                    // Hlavička kategórie s názvom a reset tlačidlom
                                    React.createElement(
                                        'div',
                                        { className: 'flex justify-between items-center mb-6' },
                                        React.createElement('h3', {
                                            className: 'text-xl font-semibold text-gray-800'
                                        }, cat.name),
                                        React.createElement(
                                            'button',
                                            {
                                                onClick: () => handleResetCategory(cat.id),
                                                className: 'px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors'
                                            },
                                            'Reset'
                                        )
                                    ),

                                    // Grid pre nastavenia
                                    React.createElement(
                                        'div',
                                        { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' },
                                        
                                        // Maximálny počet tímov
                                        React.createElement(
                                            'div',
                                            { className: 'space-y-2' },
                                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                                'Maximálny počet tímov:'
                                            ),
                                            React.createElement('input', {
                                                type: 'number',
                                                min: 1,
                                                value: editedMaxTeams[cat.id] ?? cat.maxTeams,
                                                onChange: e => handleMaxTeamsChange(cat.id, e.target.value),
                                                className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                                            })
                                        ),

                                        // Počet periód
                                        React.createElement(
                                            'div',
                                            { className: 'space-y-2' },
                                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                                'Počet periód:'
                                            ),
                                            React.createElement('input', {
                                                type: 'number',
                                                min: 1,
                                                value: editedPeriods[cat.id] ?? cat.periods,
                                                onChange: e => handlePeriodsChange(cat.id, e.target.value),
                                                className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                                            })
                                        ),

                                        // Trvanie periódy
                                        React.createElement(
                                            'div',
                                            { className: 'space-y-2' },
                                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                                'Trvanie periódy (min):'
                                            ),
                                            React.createElement('input', {
                                                type: 'number',
                                                min: 1,
                                                value: editedPeriodDuration[cat.id] ?? cat.periodDuration,
                                                onChange: e => handlePeriodDurationChange(cat.id, e.target.value),
                                                className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                                            })
                                        ),

                                        // Prestávka medzi periódami
                                        React.createElement(
                                            'div',
                                            { className: 'space-y-2' },
                                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                                'Prestávka medzi periódami (min):'
                                            ),
                                            React.createElement('input', {
                                                type: 'number',
                                                min: 0,
                                                value: editedBreakDuration[cat.id] ?? cat.breakDuration,
                                                onChange: e => handleBreakDurationChange(cat.id, e.target.value),
                                                className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                                            })
                                        ),

                                        // Prestávka medzi zápasmi
                                        React.createElement(
                                            'div',
                                            { className: 'space-y-2' },
                                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                                'Prestávka medzi zápasmi (min):'
                                            ),
                                            React.createElement('input', {
                                                type: 'number',
                                                min: 0,
                                                value: editedMatchBreak[cat.id] ?? cat.matchBreak,
                                                onChange: e => handleMatchBreakChange(cat.id, e.target.value),
                                                className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                                            })
                                        ),

                                        // Farba pre rozlosovanie
                                        React.createElement(
                                            'div',
                                            { className: 'space-y-2' },
                                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                                'Farba pre rozlosovanie:'
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'flex gap-2' },
                                                React.createElement('input', {
                                                    type: 'color',
                                                    value: editedDrawColor[cat.id] ?? cat.drawColor,
                                                    onChange: e => handleDrawColorChange(cat.id, e.target.value),
                                                    className: 'w-12 h-10 border border-gray-300 rounded-lg cursor-pointer'
                                                }),
                                                React.createElement('input', {
                                                    type: 'text',
                                                    value: editedDrawColor[cat.id] ?? cat.drawColor,
                                                    onChange: e => handleDrawColorChange(cat.id, e.target.value),
                                                    className: 'flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-mono'
                                                })
                                            )
                                        ),

                                        // Farba pre dopravu
                                        React.createElement(
                                            'div',
                                            { className: 'space-y-2' },
                                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                                'Farba pre dopravu:'
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'flex gap-2' },
                                                React.createElement('input', {
                                                    type: 'color',
                                                    value: editedTransportColor[cat.id] ?? cat.transportColor,
                                                    onChange: e => handleTransportColorChange(cat.id, e.target.value),
                                                    className: 'w-12 h-10 border border-gray-300 rounded-lg cursor-pointer'
                                                }),
                                                React.createElement('input', {
                                                    type: 'text',
                                                    value: editedTransportColor[cat.id] ?? cat.transportColor,
                                                    onChange: e => handleTransportColorChange(cat.id, e.target.value),
                                                    className: 'flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-mono'
                                                })
                                            )
                                        )
                                    ),

                                    // Výpočet celkového času zápasu
                                    React.createElement(
                                        'div',
                                        { className: 'mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200' },
                                        React.createElement('h4', { className: 'font-semibold text-gray-700 mb-2' },
                                            'Celkový čas zápasu:'
                                        ),
                                        React.createElement(
                                            'div',
                                            { className: 'grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm' },
                                            React.createElement('div', { className: 'text-gray-600' },
                                                'Čistý hrací čas: ',
                                                React.createElement('span', { className: 'font-bold text-gray-900' },
                                                    `${totalTime.playingTime} min`
                                                )
                                            ),
                                            React.createElement('div', { className: 'text-gray-600' },
                                                'Prestávky v zápase: ',
                                                React.createElement('span', { className: 'font-bold text-gray-900' },
                                                    `${totalTime.breaksBetweenPeriods} min`
                                                )
                                            ),
                                            React.createElement('div', { className: 'text-gray-600' },
                                                'Celkový čas s prestávkou: ',
                                                React.createElement('span', { className: 'font-bold text-blue-600' },
                                                    `${totalTime.totalTimeWithMatchBreak} min`
                                                )
                                            )
                                        )
                                    ),

                                    // Ukážka farieb
                                    React.createElement(
                                        'div',
                                        { className: 'mt-4 flex gap-4 items-center' },
                                        React.createElement(
                                            'div',
                                            { 
                                                className: 'px-4 py-2 rounded-lg text-white text-sm font-medium',
                                                style: { backgroundColor: editedDrawColor[cat.id] ?? cat.drawColor }
                                            },
                                            'Rozlosovanie'
                                        ),
                                        React.createElement(
                                            'div',
                                            { 
                                                className: 'px-4 py-2 rounded-lg text-white text-sm font-medium',
                                                style: { backgroundColor: editedTransportColor[cat.id] ?? cat.transportColor }
                                            },
                                            'Doprava'
                                        )
                                    )
                                )
                            );
                        })
                    ),

                    // Tlačidlo na uloženie všetkých zmien
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
                            saving ? 'Ukladám...' : 'Uložiť všetky zmeny'
                        )
                    )
                )
        )
    );
}

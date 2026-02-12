import { doc, onSnapshot, setDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Funkcia na vytvorenie notifikácie o zmene nastavení kategórie
const createCategorySettingsChangeNotification = async (actionType, changesArray, categoryData) => {
    if (!window.db || !changesArray?.length) return;
    
    try {
        const currentUserEmail = window.globalUserProfileData?.email || null;
        
        await addDoc(collection(window.db, 'notifications'), {
            userEmail: currentUserEmail || "",
            performedBy: currentUserEmail || null,
            changes: changesArray,
            timestamp: Timestamp.now(),
            actionType: actionType,
            relatedCategoryId: categoryData.categoryId || null,
            relatedCategoryName: categoryData.categoryName || null,
            settingsType: 'category_settings'
        });
        
        console.log("[NOTIFIKÁCIA – zmena nastavení kategórie]", changesArray);
    } catch (err) {
        console.error("[CHYBA pri ukladaní notifikácie nastavení kategórie]", err);
    }
};

export function CategorySettings({ 
    db, 
    userProfileData, 
    showNotification,
    initialCategoryId, // URL názov (slug)
    onSelectCategory,
    onHasChangesChange // Nový prop pre hlásenie zmien
}) {
    const [categories, setCategories] = React.useState([]);
    const [selectedCategoryId, setSelectedCategoryId] = React.useState(null);
    const [editedMaxTeams, setEditedMaxTeams] = React.useState({});
    const [editedPeriods, setEditedPeriods] = React.useState({});
    const [editedPeriodDuration, setEditedPeriodDuration] = React.useState({});
    const [editedBreakDuration, setEditedBreakDuration] = React.useState({});
    const [editedMatchBreak, setEditedMatchBreak] = React.useState({});
    const [editedDrawColor, setEditedDrawColor] = React.useState({});
    const [editedTransportColor, setEditedTransportColor] = React.useState({});
    const [saving, setSaving] = React.useState(false);
    const [previousValues, setPreviousValues] = React.useState({});
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);

    // Pomocná funkcia na prevod názvu na URL-friendly formát
    const slugify = (text) => {
        if (!text) return '';
        return text
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    };

    // Funkcia na získanie ID kategórie podľa názvu z URL
    const getCategoryIdFromUrlName = (urlName, categoriesList) => {
        if (!urlName || !categoriesList.length) return null;
        
        const foundCategory = categoriesList.find(cat => 
            slugify(cat.name) === urlName
        );
        
        return foundCategory ? foundCategory.id : null;
    };

    // Handler pre výber kategórie - do URL ukladá názov, nie ID
    const handleSelectCategory = (catId) => {
        const category = categories.find(c => c.id === catId);
        if (category && onSelectCategory) {
            onSelectCategory(slugify(category.name), catId);
        }
        setSelectedCategoryId(catId);
    };

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
                const initialPreviousValues = {};
                
                list.forEach(cat => {
                    initialMaxTeams[cat.id] = cat.maxTeams;
                    initialPeriods[cat.id] = cat.periods;
                    initialPeriodDuration[cat.id] = cat.periodDuration;
                    initialBreakDuration[cat.id] = cat.breakDuration;
                    initialMatchBreak[cat.id] = cat.matchBreak;
                    initialDrawColor[cat.id] = cat.drawColor;
                    initialTransportColor[cat.id] = cat.transportColor;
                    initialPreviousValues[cat.id] = { ...cat };
                });
                
                setEditedMaxTeams(prev => {
                    const newState = { ...initialMaxTeams };
                    Object.keys(prev).forEach(key => {
                        if (prev[key] !== initialMaxTeams[key]) {
                            newState[key] = prev[key];
                        }
                    });
                    return newState;
                });
                
                setEditedPeriods(prev => {
                    const newState = { ...initialPeriods };
                    Object.keys(prev).forEach(key => {
                        if (prev[key] !== initialPeriods[key]) {
                            newState[key] = prev[key];
                        }
                    });
                    return newState;
                });
                
                setEditedPeriodDuration(prev => {
                    const newState = { ...initialPeriodDuration };
                    Object.keys(prev).forEach(key => {
                        if (prev[key] !== initialPeriodDuration[key]) {
                            newState[key] = prev[key];
                        }
                    });
                    return newState;
                });
                
                setEditedBreakDuration(prev => {
                    const newState = { ...initialBreakDuration };
                    Object.keys(prev).forEach(key => {
                        if (prev[key] !== initialBreakDuration[key]) {
                            newState[key] = prev[key];
                        }
                    });
                    return newState;
                });
                
                setEditedMatchBreak(prev => {
                    const newState = { ...initialMatchBreak };
                    Object.keys(prev).forEach(key => {
                        if (prev[key] !== initialMatchBreak[key]) {
                            newState[key] = prev[key];
                        }
                    });
                    return newState;
                });
                
                setEditedDrawColor(prev => {
                    const newState = { ...initialDrawColor };
                    Object.keys(prev).forEach(key => {
                        if (prev[key] !== initialDrawColor[key]) {
                            newState[key] = prev[key];
                        }
                    });
                    return newState;
                });
                
                setEditedTransportColor(prev => {
                    const newState = { ...initialTransportColor };
                    Object.keys(prev).forEach(key => {
                        if (prev[key] !== initialTransportColor[key]) {
                            newState[key] = prev[key];
                        }
                    });
                    return newState;
                });
                
                setPreviousValues(initialPreviousValues);
                
                // Nastav kategóriu z props (z URL) alebo prvú kategóriu
                if (list.length > 0) {
                    const categoryIdFromUrl = getCategoryIdFromUrlName(initialCategoryId, list);
                    
                    if (categoryIdFromUrl) {
                        setSelectedCategoryId(categoryIdFromUrl);
                    } else if (!selectedCategoryId) {
                        setSelectedCategoryId(list[0].id);
                        if (onSelectCategory) {
                            onSelectCategory(slugify(list[0].name), list[0].id);
                        }
                    }
                }
                
                setIsInitialLoad(false);
            } else {
                setCategories([]);
                setEditedMaxTeams({});
                setEditedPeriods({});
                setEditedPeriodDuration({});
                setEditedBreakDuration({});
                setEditedMatchBreak({});
                setEditedDrawColor({});
                setEditedTransportColor({});
                setPreviousValues({});
                setSelectedCategoryId(null);
                setIsInitialLoad(false);
            }
        }, err => {
            showNotification(`Chyba pri načítaní kategórií: ${err.message}`, 'error');
            setIsInitialLoad(false);
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
        
        // AUTOMATICKÉ VYNULOVANIE: Ak je počet periód 1, vynulujeme prestávku medzi periódami
        const periodsValue = value === '' ? 1 : Math.max(1, parseInt(value) || 1);
        if (periodsValue === 1) {
            setEditedBreakDuration(prev => ({ ...prev, [catId]: 0 }));
        }
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

    // Kontrola zmien - sledujeme všetky kategórie
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

    // Hlásime zmeny nadradenému komponentu
    React.useEffect(() => {
        if (onHasChangesChange) {
            onHasChangesChange(hasChanges && !saving);
        }
    }, [hasChanges, saving, onHasChangesChange]);

    // Zobrazenie počtu kategórií so zmenami
    const categoriesWithChangesCount = React.useMemo(() => {
        return categories.filter(cat => 
            editedMaxTeams[cat.id] !== cat.maxTeams ||
            editedPeriods[cat.id] !== cat.periods ||
            editedPeriodDuration[cat.id] !== cat.periodDuration ||
            editedBreakDuration[cat.id] !== cat.breakDuration ||
            editedMatchBreak[cat.id] !== cat.matchBreak ||
            editedDrawColor[cat.id] !== cat.drawColor ||
            editedTransportColor[cat.id] !== cat.transportColor
        ).length;
    }, [categories, editedMaxTeams, editedPeriods, editedPeriodDuration, 
        editedBreakDuration, editedMatchBreak, editedDrawColor, editedTransportColor]);

    // OCHRANA PRED STRATOU DÁT - beforeunload
    React.useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasChanges && !saving) {
                e.preventDefault();
                e.returnValue = 'Máte neuložené zmeny. Naozaj chcete opustiť stránku?';
                return e.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasChanges, saving]);

    // Samostatný useEffect na spracovanie zmeny URL v RÁMCI CategorySettings
    React.useEffect(() => {
        if (!isInitialLoad && categories.length > 0 && initialCategoryId) {
            const categoryIdFromUrl = getCategoryIdFromUrlName(initialCategoryId, categories);
            if (categoryIdFromUrl && categoryIdFromUrl !== selectedCategoryId) {
                // Pri zmene URL v RÁMCI CategorySettings (prepínanie kategórií)
                // NIKDY NEZOBRAZUJEME UPOZORNENIE
                setSelectedCategoryId(categoryIdFromUrl);
            }
        }
    }, [initialCategoryId, categories, selectedCategoryId, isInitialLoad]);

    // Funkcia na generovanie zoznamu zmien pre notifikáciu
    const generateChangesList = (category, oldValues, newValues) => {
        const changes = [];
        
        if (newValues.maxTeams !== oldValues.maxTeams) {
            changes.push(`Max. počet tímov z '${oldValues.maxTeams}' na '${newValues.maxTeams}'`);
        }
        if (newValues.periods !== oldValues.periods) {
            changes.push(`Počet periód z '${oldValues.periods}' na '${newValues.periods}'`);
        }
        if (newValues.periodDuration !== oldValues.periodDuration) {
            changes.push(`Trvanie periódy z '${oldValues.periodDuration} min' na '${newValues.periodDuration} min'`);
        }
        if (newValues.breakDuration !== oldValues.breakDuration) {
            changes.push(`Prestávka medzi periódami z '${oldValues.breakDuration} min' na '${newValues.breakDuration} min'`);
        }
        if (newValues.matchBreak !== oldValues.matchBreak) {
            changes.push(`Prestávka medzi zápasmi z '${oldValues.matchBreak} min' na '${newValues.matchBreak} min'`);
        }
        if (newValues.drawColor !== oldValues.drawColor) {
            changes.push(`Farba pre rozlosovanie z '${oldValues.drawColor}' na '${newValues.drawColor}'`);
        }
        if (newValues.transportColor !== oldValues.transportColor) {
            changes.push(`Farba pre dopravu z '${oldValues.transportColor}' na '${newValues.transportColor}'`);
        }
        
        return changes;
    };

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
            const categoriesWithChanges = [];

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
                    
                    const oldValues = previousValues[cat.id] || cat;
                    const newValues = {
                        maxTeams: editedMaxTeams[cat.id] ?? cat.maxTeams,
                        periods: editedPeriods[cat.id] ?? cat.periods,
                        periodDuration: editedPeriodDuration[cat.id] ?? cat.periodDuration,
                        breakDuration: editedBreakDuration[cat.id] ?? cat.breakDuration,
                        matchBreak: editedMatchBreak[cat.id] ?? cat.matchBreak,
                        drawColor: editedDrawColor[cat.id] ?? cat.drawColor,
                        transportColor: editedTransportColor[cat.id] ?? cat.transportColor
                    };
                    
                    categoriesWithChanges.push({
                        categoryId: cat.id,
                        categoryName: cat.name,
                        oldValues,
                        newValues,
                        changes: generateChangesList(cat, oldValues, newValues)
                    });
                }
            });

            if (Object.keys(updates).length > 0) {
                await setDoc(catRef, updates, { merge: true });
                showNotification("Všetky zmeny boli uložené.", 'success');
                
                for (const catChange of categoriesWithChanges) {
                    if (catChange.changes.length > 0) {
                        const mainChanges = [
                            `Úprava nastavení kategórie: '${catChange.categoryName}'`,
                            ...catChange.changes
                        ];
                        
                        await createCategorySettingsChangeNotification(
                            'category_settings_updated',
                            mainChanges,
                            {
                                categoryId: catChange.categoryId,
                                categoryName: catChange.categoryName,
                                settings: catChange.newValues
                            }
                        );
                        
                        if (catChange.oldValues.drawColor !== catChange.newValues.drawColor) {
                            await createCategorySettingsChangeNotification(
                                'category_draw_color_updated',
                                [`Zmena farby pre rozlosovanie v kategórii ${catChange.categoryName}: z '${catChange.oldValues.drawColor}' na '${catChange.newValues.drawColor}'`],
                                {
                                    categoryId: catChange.categoryId,
                                    categoryName: catChange.categoryName,
                                    oldColor: catChange.oldValues.drawColor,
                                    newColor: catChange.newValues.drawColor,
                                    colorType: 'draw'
                                }
                            );
                        }
                        
                        if (catChange.oldValues.transportColor !== catChange.newValues.transportColor) {
                            await createCategorySettingsChangeNotification(
                                'category_transport_color_updated',
                                [`Zmena farby pre dopravu v kategórii ${catChange.categoryName}: z '${catChange.oldValues.transportColor}' na '${catChange.newValues.transportColor}'`],
                                {
                                    categoryId: catChange.categoryId,
                                    categoryName: catChange.categoryName,
                                    oldColor: catChange.oldValues.transportColor,
                                    newColor: catChange.newValues.transportColor,
                                    colorType: 'transport'
                                }
                            );
                        }
                    }
                }
                
                const updatedPreviousValues = {};
                categories.forEach(cat => {
                    updatedPreviousValues[cat.id] = {
                        ...cat,
                        maxTeams: editedMaxTeams[cat.id] ?? cat.maxTeams,
                        periods: editedPeriods[cat.id] ?? cat.periods,
                        periodDuration: editedPeriodDuration[cat.id] ?? cat.periodDuration,
                        breakDuration: editedBreakDuration[cat.id] ?? cat.breakDuration,
                        matchBreak: editedMatchBreak[cat.id] ?? cat.matchBreak,
                        drawColor: editedDrawColor[cat.id] ?? cat.drawColor,
                        transportColor: editedTransportColor[cat.id] ?? cat.transportColor
                    };
                });
                setPreviousValues(updatedPreviousValues);
            }

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

    // Získanie vybranej kategórie
    const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

    if (isInitialLoad) {
        return React.createElement(
            React.Fragment,
            null,
            React.createElement(
                'div',
                { className: 'space-y-6 p-6 border border-gray-200 rounded-lg shadow-sm mt-8 bg-white text-center' },
                React.createElement('p', { className: 'text-gray-500' }, 'Načítavam kategórie...')
            )
        );
    }

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
                    // Tlačidlá pre kategórie s indikátorom zmien
                    React.createElement(
                        'div',
                        { className: 'mb-8' },
                        React.createElement(
                            'div',
                            { className: 'flex flex-wrap gap-3' },
                            categories.map(cat => {
                                const hasCategoryChanges = 
                                    editedMaxTeams[cat.id] !== cat.maxTeams ||
                                    editedPeriods[cat.id] !== cat.periods ||
                                    editedPeriodDuration[cat.id] !== cat.periodDuration ||
                                    editedBreakDuration[cat.id] !== cat.breakDuration ||
                                    editedMatchBreak[cat.id] !== cat.matchBreak ||
                                    editedDrawColor[cat.id] !== cat.drawColor ||
                                    editedTransportColor[cat.id] !== cat.transportColor;
                                
                                return React.createElement(
                                    'button',
                                    {
                                        key: cat.id,
                                        onClick: () => handleSelectCategory(cat.id),
                                        className: `relative px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
                                            selectedCategoryId === cat.id
                                                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300 ring-offset-2'
                                                : hasCategoryChanges
                                                    ? 'bg-yellow-100 text-gray-700 hover:bg-yellow-200 hover:shadow border-2 border-yellow-500'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow'
                                        }`
                                    },
                                    cat.name,
                                    hasCategoryChanges && !saving && React.createElement(
                                        'span',
                                        { className: 'absolute -top-2 -right-2 w-4 h-4 bg-yellow-500 rounded-full animate-pulse' }
                                    )
                                );
                            })
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-xs text-gray-500 mt-3' },
                            categoriesWithChangesCount > 0 
                                ? `Máte neuložené zmeny v ${categoriesWithChangesCount} ${categoriesWithChangesCount === 1 ? 'kategórii' : 'kategóriách'}. Zmeny sa ukladajú hromadne.`
                                : 'Vyberte kategóriu pre úpravu jej nastavení'
                        )
                    ),

                    // Karta vybranej kategórie
                    selectedCategory && React.createElement(
                        'div',
                        {
                            key: selectedCategory.id,
                            className: 'bg-white border border-gray-200 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden'
                        },
                        React.createElement(
                            'div',
                            { className: 'p-6' },
                            // Hlavička kategórie
                            React.createElement(
                                'div',
                                { className: 'flex justify-between items-center mb-6' },
                                React.createElement('h3', {
                                    className: 'text-xl font-semibold text-gray-800'
                                }, selectedCategory.name),
                                React.createElement(
                                    'button',
                                    {
                                        onClick: () => handleResetCategory(selectedCategory.id),
                                        className: 'px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors'
                                    },
                                    'Reset'
                                )
                            ),

                            // Všetky polia
                            React.createElement(
                                'div',
                                { className: 'space-y-4' },
                                
                                // Maximálny počet tímov
                                React.createElement(
                                    'div',
                                    { className: 'space-y-1' },
                                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                        'Maximálny počet tímov:'
                                    ),
                                    React.createElement('input', {
                                        type: 'number',
                                        min: 1,
                                        value: editedMaxTeams[selectedCategory.id] ?? selectedCategory.maxTeams,
                                        onChange: e => handleMaxTeamsChange(selectedCategory.id, e.target.value),
                                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                                    })
                                ),

                                // Počet periód
                                React.createElement(
                                    'div',
                                    { className: 'space-y-1' },
                                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                        'Počet periód:'
                                    ),
                                    React.createElement('input', {
                                        type: 'number',
                                        min: 1,
                                        value: editedPeriods[selectedCategory.id] ?? selectedCategory.periods,
                                        onChange: e => handlePeriodsChange(selectedCategory.id, e.target.value),
                                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                                    })
                                ),

                                // Trvanie periódy
                                React.createElement(
                                    'div',
                                    { className: 'space-y-1' },
                                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                        'Trvanie periódy (min):'
                                    ),
                                    React.createElement('input', {
                                        type: 'number',
                                        min: 1,
                                        value: editedPeriodDuration[selectedCategory.id] ?? selectedCategory.periodDuration,
                                        onChange: e => handlePeriodDurationChange(selectedCategory.id, e.target.value),
                                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                                    })
                                ),

                                // PODMIENENÉ ZOBRAZENIE: Prestávka medzi periódami - zobrazí sa len ak je počet periód > 1
                                (editedPeriods[selectedCategory.id] ?? selectedCategory.periods) > 1 && React.createElement(
                                    'div',
                                    { className: 'space-y-1' },
                                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                        'Prestávka medzi periódami (min):'
                                    ),
                                    React.createElement('input', {
                                        type: 'number',
                                        min: 0,
                                        value: editedBreakDuration[selectedCategory.id] ?? selectedCategory.breakDuration,
                                        onChange: e => handleBreakDurationChange(selectedCategory.id, e.target.value),
                                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                                    })
                                ),

                                // Prestávka medzi zápasmi
                                React.createElement(
                                    'div',
                                    { className: 'space-y-1' },
                                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                        'Prestávka medzi zápasmi (min):'
                                    ),
                                    React.createElement('input', {
                                        type: 'number',
                                        min: 0,
                                        value: editedMatchBreak[selectedCategory.id] ?? selectedCategory.matchBreak,
                                        onChange: e => handleMatchBreakChange(selectedCategory.id, e.target.value),
                                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                                    })
                                ),

                                // Farba pre rozlosovanie
                                React.createElement(
                                    'div',
                                    { className: 'space-y-1' },
                                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                        'Farba pre rozlosovanie:'
                                    ),
                                    React.createElement(
                                        'div',
                                        { className: 'flex gap-2' },
                                        React.createElement('input', {
                                            type: 'color',
                                            value: editedDrawColor[selectedCategory.id] ?? selectedCategory.drawColor,
                                            onChange: e => handleDrawColorChange(selectedCategory.id, e.target.value),
                                            className: 'w-12 h-10 border border-gray-300 rounded-lg cursor-pointer'
                                        }),
                                        React.createElement('input', {
                                            type: 'text',
                                            value: editedDrawColor[selectedCategory.id] ?? selectedCategory.drawColor,
                                            onChange: e => handleDrawColorChange(selectedCategory.id, e.target.value),
                                            className: 'flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-mono'
                                        })
                                    )
                                ),

                                // Farba pre dopravu
                                React.createElement(
                                    'div',
                                    { className: 'space-y-1' },
                                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                        'Farba pre dopravu:'
                                    ),
                                    React.createElement(
                                        'div',
                                        { className: 'flex gap-2' },
                                        React.createElement('input', {
                                            type: 'color',
                                            value: editedTransportColor[selectedCategory.id] ?? selectedCategory.transportColor,
                                            onChange: e => handleTransportColorChange(selectedCategory.id, e.target.value),
                                            className: 'w-12 h-10 border border-gray-300 rounded-lg cursor-pointer'
                                        }),
                                        React.createElement('input', {
                                            type: 'text',
                                            value: editedTransportColor[selectedCategory.id] ?? selectedCategory.transportColor,
                                            onChange: e => handleTransportColorChange(selectedCategory.id, e.target.value),
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
                                    { className: 'grid grid-cols-1 gap-4 text-sm' },
                                    React.createElement('div', { className: 'text-gray-600' },
                                        'Čistý hrací čas: ',
                                        React.createElement('span', { className: 'font-bold text-gray-900' },
                                            `${(() => {
                                                const time = calculateTotalMatchTime(selectedCategory.id);
                                                return time.playingTime;
                                            })()} min`
                                        )
                                    ),
                                    React.createElement('div', { className: 'text-gray-600' },
                                        'Prestávky v zápase: ',
                                        React.createElement('span', { className: 'font-bold text-gray-900' },
                                            `${(() => {
                                                const time = calculateTotalMatchTime(selectedCategory.id);
                                                return time.breaksBetweenPeriods;
                                            })()} min`
                                        )
                                    ),
                                    React.createElement('div', { className: 'text-gray-600' },
                                        'Celkový čas s prestávkou: ',
                                        React.createElement('span', { className: 'font-bold text-blue-600' },
                                            `${(() => {
                                                const time = calculateTotalMatchTime(selectedCategory.id);
                                                return time.totalTimeWithMatchBreak;
                                            })()} min`
                                        )
                                    )
                                )
                            )
                        )
                    ),

                    // Tlačidlo na uloženie všetkých zmien
                    React.createElement(
                        'div',
                        { className: 'mt-8 flex flex-col items-center gap-2' },
                        React.createElement(
                            'button',
                            {
                                onClick: handleSaveAll,
                                disabled: !hasChanges || saving,
                                className: `px-10 py-4 rounded-lg font-bold text-lg transition-colors min-w-[280px] border ${
                                    hasChanges && !saving
                                        ? 'bg-green-600 hover:bg-green-700 text-white border-transparent'
                                        : 'bg-white text-green-600 border-2 border-green-600 cursor-not-allowed opacity-75'
                                }`
                            },
                            saving ? 'Ukladám...' : 'Uložiť všetky zmeny'
                        ),
                        hasChanges && !saving && React.createElement(
                            'span',
                            { className: 'text-sm text-yellow-600 font-medium' },
                            `Máte neuložené zmeny v ${categoriesWithChangesCount} ${categoriesWithChangesCount === 1 ? 'kategórii' : 'kategóriách'}.`
                        )
                    )
                )
        )
    );
}

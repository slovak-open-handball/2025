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
    initialCategoryId,
    onSelectCategory,
    onHasChangesChange,
    onResetChanges
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
    
    // NOVÉ: State pre timeout
    const [editedTimeoutCount, setEditedTimeoutCount] = React.useState({});
    const [editedTimeoutDuration, setEditedTimeoutDuration] = React.useState({});
    
    // NOVÉ: State pre vylúčenie
    const [editedExclusionTime, setEditedExclusionTime] = React.useState({});
    
    const [saving, setSaving] = React.useState(false);
    const [previousValues, setPreviousValues] = React.useState({});
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);

    // NOVÝ: State pre existujúce zápasy - TERAZ S onSnapshot
    const [existingMatches, setExistingMatches] = React.useState({});

    // REF pre uloženie pôvodných hodnôt kategórií
    const originalCategoriesRef = React.useRef({});

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

    // NOVÁ FUNKCIA: Sledovanie existujúcich zápasov v reálnom čase
    const subscribeToMatches = () => {
        if (!db) return null;

        try {
            const matchesRef = collection(db, 'matches');
            
            // Používame onSnapshot pre automatické aktualizácie
            const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
                const matchesByCategory = {};
                
                snapshot.forEach((doc) => {
                    const match = doc.data();
                    if (match.categoryId) {
                        if (!matchesByCategory[match.categoryId]) {
                            matchesByCategory[match.categoryId] = [];
                        }
                        matchesByCategory[match.categoryId].push({
                            id: doc.id,
                            ...match
                        });
                    }
                });
                
                setExistingMatches(matchesByCategory);
                console.log("[CategorySettings] Aktualizované existujúce zápasy:", 
                    Object.keys(matchesByCategory).map(catId => 
                        `${catId}: ${matchesByCategory[catId].length} zápasov`
                    ).join(', ')
                );
            }, (err) => {
                console.error("[CategorySettings] Chyba pri sledovaní zápasov:", err);
            });
            
            return unsubscribe;
        } catch (err) {
            console.error("[CategorySettings] Chyba pri nastavovaní sledovania zápasov:", err);
            return null;
        }
    };

    // Načítavanie kategórií a sledovanie existujúcich zápasov
    React.useEffect(() => {
        if (!db || !userProfileData || userProfileData.role !== 'admin') return;

        // Spustíme sledovanie zápasov
        const unsubscribeMatches = subscribeToMatches();

        const catRef = doc(db, 'settings', 'categories');

        const unsubscribeCategories = onSnapshot(catRef, snap => {
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
                    transportColor: obj.transportColor ?? '#10B981',
                    // NOVÉ: Načítanie hodnôt timeout
                    timeoutCount: obj.timeoutCount ?? 2,
                    timeoutDuration: obj.timeoutDuration ?? 1,
                    // NOVÉ: Načítanie času pre vylúčenie
                    exclusionTime: obj.exclusionTime ?? 2
                })).sort((a, b) => a.name.localeCompare(b.name));

                setCategories(list);
                
                // Uložíme pôvodné hodnoty do ref
                const originalValues = {};
                list.forEach(cat => {
                    originalValues[cat.id] = {
                        maxTeams: cat.maxTeams,
                        periods: cat.periods,
                        periodDuration: cat.periodDuration,
                        breakDuration: cat.breakDuration,
                        matchBreak: cat.matchBreak,
                        drawColor: cat.drawColor,
                        transportColor: cat.transportColor,
                        timeoutCount: cat.timeoutCount,
                        timeoutDuration: cat.timeoutDuration,
                        exclusionTime: cat.exclusionTime
                    };
                });
                originalCategoriesRef.current = originalValues;
                
                // Inicializácia editovaných hodnôt
                const initialMaxTeams = {};
                const initialPeriods = {};
                const initialPeriodDuration = {};
                const initialBreakDuration = {};
                const initialMatchBreak = {};
                const initialDrawColor = {};
                const initialTransportColor = {};
                const initialTimeoutCount = {};
                const initialTimeoutDuration = {};
                const initialExclusionTime = {};
                const initialPreviousValues = {};
                
                list.forEach(cat => {
                    initialMaxTeams[cat.id] = cat.maxTeams;
                    initialPeriods[cat.id] = cat.periods;
                    initialPeriodDuration[cat.id] = cat.periodDuration;
                    initialBreakDuration[cat.id] = cat.breakDuration;
                    initialMatchBreak[cat.id] = cat.matchBreak;
                    initialDrawColor[cat.id] = cat.drawColor;
                    initialTransportColor[cat.id] = cat.transportColor;
                    initialTimeoutCount[cat.id] = cat.timeoutCount;
                    initialTimeoutDuration[cat.id] = cat.timeoutDuration;
                    initialExclusionTime[cat.id] = cat.exclusionTime;
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

                // NOVÉ: Inicializácia timeout state
                setEditedTimeoutCount(prev => {
                    const newState = { ...initialTimeoutCount };
                    Object.keys(prev).forEach(key => {
                        if (prev[key] !== initialTimeoutCount[key]) {
                            newState[key] = prev[key];
                        }
                    });
                    return newState;
                });

                setEditedTimeoutDuration(prev => {
                    const newState = { ...initialTimeoutDuration };
                    Object.keys(prev).forEach(key => {
                        if (prev[key] !== initialTimeoutDuration[key]) {
                            newState[key] = prev[key];
                        }
                    });
                    return newState;
                });

                // NOVÉ: Inicializácia exclusion state
                setEditedExclusionTime(prev => {
                    const newState = { ...initialExclusionTime };
                    Object.keys(prev).forEach(key => {
                        if (prev[key] !== initialExclusionTime[key]) {
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
                setEditedTimeoutCount({});
                setEditedTimeoutDuration({});
                setEditedExclusionTime({});
                setPreviousValues({});
                setSelectedCategoryId(null);
                setIsInitialLoad(false);
            }
        }, err => {
            showNotification(`Chyba pri načítaní kategórií: ${err.message}`, 'error');
            setIsInitialLoad(false);
        });

        // Cleanup - odhlásime oba snapshoty
        return () => {
            unsubscribeCategories();
            if (unsubscribeMatches) {
                unsubscribeMatches();
            }
        };
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

    // NOVÝ: Handler pre počet timeoutov
    const handleTimeoutCountChange = (catId, value) => {
        const numValue = value === '' ? '' : Math.max(0, parseInt(value) || 0);
        setEditedTimeoutCount(prev => ({ ...prev, [catId]: numValue }));
        
        // Ak je počet timeoutov 0, automaticky vynulujeme aj čas timeoutu
        if (numValue === 0 || numValue === '0' || numValue === 0) {
            setEditedTimeoutDuration(prev => ({ ...prev, [catId]: 0 }));
        }
    };

    // NOVÝ: Handler pre čas timeoutu
    const handleTimeoutDurationChange = (catId, value) => {
        const numValue = value === '' ? '' : Math.max(0, parseInt(value) || 0);
        setEditedTimeoutDuration(prev => ({ ...prev, [catId]: numValue }));
    };

    // NOVÝ: Handler pre čas vylúčenia
    const handleExclusionTimeChange = (catId, value) => {
        const numValue = value === '' ? '' : Math.max(0, parseInt(value) || 0);
        setEditedExclusionTime(prev => ({ ...prev, [catId]: numValue }));
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
            editedTransportColor[cat.id] !== cat.transportColor ||
            // NOVÉ: Kontrola timeout a exclusion zmien
            editedTimeoutCount[cat.id] !== cat.timeoutCount ||
            editedTimeoutDuration[cat.id] !== cat.timeoutDuration ||
            editedExclusionTime[cat.id] !== cat.exclusionTime
        );
    }, [categories, editedMaxTeams, editedPeriods, editedPeriodDuration, 
        editedBreakDuration, editedMatchBreak, editedDrawColor, editedTransportColor,
        editedTimeoutCount, editedTimeoutDuration, editedExclusionTime]);

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
            editedTransportColor[cat.id] !== cat.transportColor ||
            editedTimeoutCount[cat.id] !== cat.timeoutCount ||
            editedTimeoutDuration[cat.id] !== cat.timeoutDuration ||
            editedExclusionTime[cat.id] !== cat.exclusionTime
        ).length;
    }, [categories, editedMaxTeams, editedPeriods, editedPeriodDuration, 
        editedBreakDuration, editedMatchBreak, editedDrawColor, editedTransportColor,
        editedTimeoutCount, editedTimeoutDuration, editedExclusionTime]);

    // RESET VŠETKÝCH NEULOŽENÝCH ZMIEN
    const resetAllChanges = React.useCallback(() => {
        console.log("resetAllChanges - spúšťam reset kategórií");
    
        // Použijeme ORIGINAL VALUES z ref, NIE aktuálne categories
        const initialMaxTeams = {};
        const initialPeriods = {};
        const initialPeriodDuration = {};
        const initialBreakDuration = {};
        const initialMatchBreak = {};
        const initialDrawColor = {};
        const initialTransportColor = {};
        const initialTimeoutCount = {};
        const initialTimeoutDuration = {};
        const initialExclusionTime = {};
        
        // Prejdeme všetky ID v originalCategoriesRef
        Object.keys(originalCategoriesRef.current).forEach(catId => {
            const original = originalCategoriesRef.current[catId];
            initialMaxTeams[catId] = original.maxTeams;
            initialPeriods[catId] = original.periods;
            initialPeriodDuration[catId] = original.periodDuration;
            initialBreakDuration[catId] = original.breakDuration;
            initialMatchBreak[catId] = original.matchBreak;
            initialDrawColor[catId] = original.drawColor;
            initialTransportColor[catId] = original.transportColor;
            initialTimeoutCount[catId] = original.timeoutCount ?? 2;
            initialTimeoutDuration[catId] = original.timeoutDuration ?? 1;
            initialExclusionTime[catId] = original.exclusionTime ?? 2;
        });
        
        setEditedMaxTeams(initialMaxTeams);
        setEditedPeriods(initialPeriods);
        setEditedPeriodDuration(initialPeriodDuration);
        setEditedBreakDuration(initialBreakDuration);
        setEditedMatchBreak(initialMatchBreak);
        setEditedDrawColor(initialDrawColor);
        setEditedTransportColor(initialTransportColor);
        setEditedTimeoutCount(initialTimeoutCount);
        setEditedTimeoutDuration(initialTimeoutDuration);
        setEditedExclusionTime(initialExclusionTime);
        
        console.log("resetAllChanges - reset dokončený");
    }, []);

    // Registrujeme reset funkciu u nadradeného komponentu - IBA RAZ
    React.useEffect(() => {
        console.log("Registrujem reset funkciu, onResetChanges existuje:", !!onResetChanges);
        if (onResetChanges) {
            onResetChanges(resetAllChanges);
        }
        
        // Cleanup - odregistrujeme reset funkciu pri odmontovaní
        return () => {
            if (onResetChanges) {
                onResetChanges(null);
            }
        };
    }, []); // PRÁZDNE POLE - spustí sa iba raz

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
        // NOVÉ: Zmeny pre timeout
        if (newValues.timeoutCount !== oldValues.timeoutCount) {
            changes.push(`Počet timeoutov z '${oldValues.timeoutCount}' na '${newValues.timeoutCount}'`);
        }
        if (newValues.timeoutDuration !== oldValues.timeoutDuration) {
            changes.push(`Trvanie timeoutu z '${oldValues.timeoutDuration} min' na '${newValues.timeoutDuration} min'`);
        }
        // NOVÉ: Zmeny pre vylúčenie
        if (newValues.exclusionTime !== oldValues.exclusionTime) {
            changes.push(`Čas vylúčenia z '${oldValues.exclusionTime} min' na '${newValues.exclusionTime} min'`);
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
                // NOVÉ: Ukladanie timeout nastavení
                if (editedTimeoutCount[cat.id] !== cat.timeoutCount && editedTimeoutCount[cat.id] >= 0) {
                    updatedData.timeoutCount = Number(editedTimeoutCount[cat.id]);
                    hasUpdates = true;
                }
                if (editedTimeoutDuration[cat.id] !== cat.timeoutDuration && editedTimeoutDuration[cat.id] >= 0) {
                    updatedData.timeoutDuration = Number(editedTimeoutDuration[cat.id]);
                    hasUpdates = true;
                }
                // NOVÉ: Ukladanie exclusion nastavení
                if (editedExclusionTime[cat.id] !== cat.exclusionTime && editedExclusionTime[cat.id] >= 0) {
                    updatedData.exclusionTime = Number(editedExclusionTime[cat.id]);
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
                        transportColor: editedTransportColor[cat.id] ?? cat.transportColor,
                        timeoutCount: editedTimeoutCount[cat.id] ?? cat.timeoutCount,
                        timeoutDuration: editedTimeoutDuration[cat.id] ?? cat.timeoutDuration,
                        exclusionTime: editedExclusionTime[cat.id] ?? cat.exclusionTime
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
                
                // Aktualizujeme originalCategoriesRef s novými hodnotami
                const updatedOriginalValues = { ...originalCategoriesRef.current };
                    categories.forEach(cat => {
                        updatedOriginalValues[cat.id] = {
                            maxTeams: editedMaxTeams[cat.id] ?? cat.maxTeams,
                            periods: editedPeriods[cat.id] ?? cat.periods,
                            periodDuration: editedPeriodDuration[cat.id] ?? cat.periodDuration,
                            breakDuration: editedBreakDuration[cat.id] ?? cat.breakDuration,
                            matchBreak: editedMatchBreak[cat.id] ?? cat.matchBreak,
                            drawColor: editedDrawColor[cat.id] ?? cat.drawColor,
                            transportColor: editedTransportColor[cat.id] ?? cat.transportColor,
                            timeoutCount: editedTimeoutCount[cat.id] ?? cat.timeoutCount,
                            timeoutDuration: editedTimeoutDuration[cat.id] ?? cat.timeoutDuration,
                            exclusionTime: editedExclusionTime[cat.id] ?? cat.exclusionTime
                        };
                    });
                    originalCategoriesRef.current = updatedOriginalValues;
                
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
                        transportColor: editedTransportColor[cat.id] ?? cat.transportColor,
                        timeoutCount: editedTimeoutCount[cat.id] ?? cat.timeoutCount,
                        timeoutDuration: editedTimeoutDuration[cat.id] ?? cat.timeoutDuration,
                        exclusionTime: editedExclusionTime[cat.id] ?? cat.exclusionTime
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
                transportColor: editedTransportColor[cat.id] ?? cat.transportColor,
                timeoutCount: editedTimeoutCount[cat.id] ?? cat.timeoutCount,
                timeoutDuration: editedTimeoutDuration[cat.id] ?? cat.timeoutDuration,
                exclusionTime: editedExclusionTime[cat.id] ?? cat.exclusionTime
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
            setEditedTimeoutCount(prev => ({ ...prev, [catId]: category.timeoutCount }));
            setEditedTimeoutDuration(prev => ({ ...prev, [catId]: category.timeoutDuration }));
            setEditedExclusionTime(prev => ({ ...prev, [catId]: category.exclusionTime }));
        }
    };

    // Získanie vybranej kategórie
    const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
    
    // NOVÁ FUNKCIA: Kontrola, či má kategória existujúce zápasy
    const hasExistingMatchesForCategory = (catId) => {
        return existingMatches[catId] && existingMatches[catId].length > 0;
    };

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
                                    editedTransportColor[cat.id] !== cat.transportColor ||
                                    editedTimeoutCount[cat.id] !== cat.timeoutCount ||
                                    editedTimeoutDuration[cat.id] !== cat.timeoutDuration ||
                                    editedExclusionTime[cat.id] !== cat.exclusionTime;
                                
                                // NOVÉ: Kontrola existujúcich zápasov pre túto kategóriu
                                const hasMatches = hasExistingMatchesForCategory(cat.id);
                                
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
                                                    : hasMatches
                                                        ? 'bg-orange-100 text-gray-700 hover:bg-orange-200 hover:shadow border-2 border-orange-400'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow'
                                        }`
                                    },
                                    cat.name,
                                    hasCategoryChanges && !saving && React.createElement(
                                        'span',
                                        { className: 'absolute -top-2 -right-2 w-4 h-4 bg-yellow-500 rounded-full animate-pulse' }
                                    ),
                                    // NOVÉ: Indikátor existujúcich zápasov (iba ak nemá zmeny)
                                    !hasCategoryChanges && hasMatches && React.createElement(
                                        'span',
                                        { 
                                            className: 'absolute -top-2 -right-2 w-4 h-4 bg-orange-500 rounded-full',
                                            title: 'Pre túto kategóriu existujú zápasy - niektoré nastavenia sú zablokované'
                                        }
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
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center gap-2' },
                                    React.createElement('h3', {
                                        className: 'text-xl font-semibold text-gray-800'
                                    }, selectedCategory.name),
                                    
                                    // NOVÉ: Varovanie o existujúcich zápasoch - TERAZ SA AUTOMATICKY AKTUALIZUJE
                                    hasExistingMatchesForCategory(selectedCategory.id) && React.createElement(
                                        'span',
                                        { 
                                            className: 'inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium',
                                            title: 'Pre túto kategóriu existujú zápasy. Niektoré nastavenia nie je možné meniť.'
                                        },
                                        React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }),
                                        `Existuje ${existingMatches[selectedCategory.id].length} ${existingMatches[selectedCategory.id].length === 1 ? 'zápas' : existingMatches[selectedCategory.id].length < 5 ? 'zápasy' : 'zápasov'}`
                                    )
                                ),
                                React.createElement(
                                    'button',
                                    {
                                        onClick: () => handleResetCategory(selectedCategory.id),
                                        className: 'px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors'
                                    },
                                    'Reset'
                                )
                            ),

                            // NOVÉ: Zistenie, či je kategória zablokovaná pre úpravy - TERAZ SA AUTOMATICKY AKTUALIZUJE
                            (() => {
                                const hasMatches = hasExistingMatchesForCategory(selectedCategory.id);
                                
                                return React.createElement(
                                    'div',
                                    { className: 'space-y-4' },
                                    
                                    // Maximálny počet tímov - NIE JE ZABLOKOVANÝ (môže sa meniť)
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

                                    // Počet periód - ZABLOKOVANÝ ak existujú zápasy
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
                                            disabled: hasMatches,
                                            className: `w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
                                                hasMatches ? 'bg-gray-100 cursor-not-allowed opacity-75' : ''
                                            }`
                                        }),
                                        hasMatches && React.createElement(
                                            'p',
                                            { className: 'text-xs text-orange-600 mt-1 flex items-center gap-1' },
                                            React.createElement('i', { className: 'fa-solid fa-lock' }),
                                            'Toto nastavenie nie je možné meniť, pretože pre túto kategóriu už existujú zápasy.'
                                        )
                                    ),

                                    // Trvanie periódy - ZABLOKOVANÝ ak existujú zápasy
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
                                            disabled: hasMatches,
                                            className: `w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
                                                hasMatches ? 'bg-gray-100 cursor-not-allowed opacity-75' : ''
                                            }`
                                        }),
                                        hasMatches && React.createElement(
                                            'p',
                                            { className: 'text-xs text-orange-600 mt-1 flex items-center gap-1' },
                                            React.createElement('i', { className: 'fa-solid fa-lock' }),
                                            'Toto nastavenie nie je možné meniť, pretože pre túto kategóriu už existujú zápasy.'
                                        )
                                    ),

                                    // PODMIENENÉ ZOBRAZENIE: Prestávka medzi periódami - ZABLOKOVANÝ ak existujú zápasy
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
                                            disabled: hasMatches,
                                            className: `w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
                                                hasMatches ? 'bg-gray-100 cursor-not-allowed opacity-75' : ''
                                            }`
                                        }),
                                        hasMatches && React.createElement(
                                            'p',
                                            { className: 'text-xs text-orange-600 mt-1 flex items-center gap-1' },
                                            React.createElement('i', { className: 'fa-solid fa-lock' }),
                                            'Toto nastavenie nie je možné meniť, pretože pre túto kategóriu už existujú zápasy.'
                                        )
                                    ),

                                    // Prestávka medzi zápasmi - ZABLOKOVANÝ ak existujú zápasy
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
                                            disabled: hasMatches,
                                            className: `w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
                                                hasMatches ? 'bg-gray-100 cursor-not-allowed opacity-75' : ''
                                            }`
                                        }),
                                        hasMatches && React.createElement(
                                            'p',
                                            { className: 'text-xs text-orange-600 mt-1 flex items-center gap-1' },
                                            React.createElement('i', { className: 'fa-solid fa-lock' }),
                                            'Toto nastavenie nie je možné meniť, pretože pre túto kategóriu už existujú zápasy.'
                                        )
                                    ),

                                    // NOVÉ: Nastavenia pre timeout - ZABLOKOVANÉ ak existujú zápasy
                                    React.createElement(
                                        'div',
                                        { className: 'space-y-1' },
                                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                            'Počet timeoutov na zápas:'
                                        ),
                                        React.createElement('input', {
                                            type: 'number',
                                            min: 0,
                                            value: editedTimeoutCount[selectedCategory.id] ?? selectedCategory.timeoutCount ?? 2,
                                            onChange: e => handleTimeoutCountChange(selectedCategory.id, e.target.value),
                                            disabled: hasMatches,
                                            className: `w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
                                                hasMatches ? 'bg-gray-100 cursor-not-allowed opacity-75' : ''
                                            }`
                                        }),
                                        hasMatches && React.createElement(
                                            'p',
                                            { className: 'text-xs text-orange-600 mt-1 flex items-center gap-1' },
                                            React.createElement('i', { className: 'fa-solid fa-lock' }),
                                            'Toto nastavenie nie je možné meniť, pretože pre túto kategóriu už existujú zápasy.'
                                        )
                                    ),

                                    // NOVÉ: PODMIENENÉ ZOBRAZENIE - Trvanie timeoutu - ZABLOKOVANÉ ak existujú zápasy
                                    (editedTimeoutCount[selectedCategory.id] ?? selectedCategory.timeoutCount) > 0 && React.createElement(
                                        'div',
                                        { className: 'space-y-1' },
                                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                            'Trvanie timeoutu (min):'
                                        ),
                                        React.createElement('input', {
                                            type: 'number',
                                            min: 0,
                                            value: editedTimeoutDuration[selectedCategory.id] ?? selectedCategory.timeoutDuration ?? 1,
                                            onChange: e => handleTimeoutDurationChange(selectedCategory.id, e.target.value),
                                            disabled: hasMatches,
                                            className: `w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
                                                hasMatches ? 'bg-gray-100 cursor-not-allowed opacity-75' : ''
                                            }`
                                        }),
                                        hasMatches && React.createElement(
                                            'p',
                                            { className: 'text-xs text-orange-600 mt-1 flex items-center gap-1' },
                                            React.createElement('i', { className: 'fa-solid fa-lock' }),
                                            'Toto nastavenie nie je možné meniť, pretože pre túto kategóriu už existujú zápasy.'
                                        )
                                    ),

                                    // NOVÉ: Čas vylúčenia - ZABLOKOVANÝ ak existujú zápasy
                                    React.createElement(
                                        'div',
                                        { className: 'space-y-1' },
                                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700' },
                                            'Čas vylúčenia (min):'
                                        ),
                                        React.createElement('input', {
                                            type: 'number',
                                            min: 0,
                                            value: editedExclusionTime[selectedCategory.id] ?? selectedCategory.exclusionTime ?? 2,
                                            onChange: e => handleExclusionTimeChange(selectedCategory.id, e.target.value),
                                            disabled: hasMatches,
                                            className: `w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
                                                hasMatches ? 'bg-gray-100 cursor-not-allowed opacity-75' : ''
                                            }`
                                        }),
                                        hasMatches && React.createElement(
                                            'p',
                                            { className: 'text-xs text-orange-600 mt-1 flex items-center gap-1' },
                                            React.createElement('i', { className: 'fa-solid fa-lock' }),
                                            'Toto nastavenie nie je možné meniť, pretože pre túto kategóriu už existujú zápasy.'
                                        )
                                    ),
                                    
                                    // Farba pre rozlosovanie - ZABLOKOVANÁ ak existujú zápasy
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
                                                disabled: hasMatches,
                                                className: `w-12 h-10 border border-gray-300 rounded-lg ${
                                                    hasMatches ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
                                                }`
                                            }),
                                            React.createElement('input', {
                                                type: 'text',
                                                value: editedDrawColor[selectedCategory.id] ?? selectedCategory.drawColor,
                                                onChange: e => handleDrawColorChange(selectedCategory.id, e.target.value),
                                                disabled: hasMatches,
                                                className: `flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black font-mono ${
                                                    hasMatches ? 'bg-gray-100 cursor-not-allowed opacity-75' : ''
                                                }`
                                            })
                                        ),
                                        hasMatches && React.createElement(
                                            'p',
                                            { className: 'text-xs text-orange-600 mt-1 flex items-center gap-1' },
                                            React.createElement('i', { className: 'fa-solid fa-lock' }),
                                            'Farbu pre rozlosovanie nie je možné meniť, pretože pre túto kategóriu už existujú zápasy.'
                                        )
                                    ),

                                    // Farba pre dopravu - NIE JE ZABLOKOVANÁ (môže sa meniť)
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
                                );
                            })(),

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

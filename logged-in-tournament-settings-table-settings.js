// logged-in-tournament-settings-table-settings.js

import { doc, updateDoc, getDoc, setDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const createTableSettingsChangeNotification = async (actionType, changesArray) => {
    if (!window.db || !changesArray?.length) return;
    
    try {
        const currentUserEmail = window.globalUserProfileData?.email || null;
        
        await addDoc(collection(window.db, 'notifications'), {
            userEmail: currentUserEmail || "",
            performedBy: currentUserEmail || null,
            changes: changesArray,
            timestamp: Timestamp.now(),
            actionType: actionType,
            settingsType: 'table_settings'
        });
        
    } catch (err) {
    }
};

export function TableSettings({ db, userProfileData, showNotification }) {
    const [sortingConditions, setSortingConditions] = React.useState([]);
    
    const [pointsForWin, setPointsForWin] = React.useState(3);
    const [originalPointsForWin, setOriginalPointsForWin] = React.useState(3);
    
    const [blueCardSuspensionMatches, setBlueCardSuspensionMatches] = React.useState(1);
    const [originalBlueCardSuspensionMatches, setOriginalBlueCardSuspensionMatches] = React.useState(1);
    
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [hasChanges, setHasChanges] = React.useState(false);
    const [originalSortingConditions, setOriginalSortingConditions] = React.useState([]);

    const availableParameters = [
        { value: 'headToHead', label: 'Vzájomný zápas' },
        { value: 'scoreDifference', label: '+/-' },
        { value: 'goalsScored', label: 'Počet strelených gólov' },
        { value: 'goalsConceded', label: 'Počet inkasovaných gólov' },
        { value: 'draw', label: 'Losovanie' },
        { value: 'wins', label: 'Počet výhier' },
        { value: 'losses', label: 'Počet prehier' }
    ];

    const parametersWithDirection = [
        'scoreDifference',
        'goalsScored',
        'goalsConceded',
        'wins',
        'losses',
        'headToHead'
    ];

    const formatCondition = (cond, index) => {
        if (!cond || !cond.parameter) return null;
        
        const param = availableParameters.find(p => p.value === cond.parameter)?.label || cond.parameter;
        
        if (parametersWithDirection.includes(cond.parameter)) {
            const direction = cond.direction === 'asc' ? 'vzostupne' : 'zostupne';
            return `${index + 1}. ${param} (${direction})`;
        } else {
            return `${index + 1}. ${param}`;
        }
    };

    const getZapasText = (count) => {
        if (count === 1) return 'zápas';
        if (count >= 2 && count <= 4) return 'zápasy';
        return 'zápasov';
    };

    const getBodText = (count) => {
        if (count === 1) return 'bod';
        if (count >= 2 && count <= 4) return 'body';
        return 'bodov';
    };

    const formatConditionValue = (cond) => {
        if (!cond || !cond.parameter) return 'Žiadne';
        
        const param = availableParameters.find(p => p.value === cond.parameter)?.label || cond.parameter;
        
        if (parametersWithDirection.includes(cond.parameter)) {
            const direction = cond.direction === 'asc' ? 'vzostupne' : 'zostupne';
            return `${param} (${direction})`;
        } else {
            return param;
        }
    };

    const generateDetailedChanges = (oldConditions, newConditions, oldPoints, newPoints, oldBlueCardSuspension, newBlueCardSuspension) => {
        const changes = [];
        
        if (oldPoints !== newPoints) {
            changes.push(`Zmena bodov za výhru: z '${oldPoints}' na '${newPoints}'`);
        }
        
        if (oldBlueCardSuspension !== newBlueCardSuspension) {
            changes.push(`Zmena počtu zápasov vylúčenia za modrú kartu: z '${oldBlueCardSuspension}' na '${newBlueCardSuspension}'`);
        }
        
        const oldConditionsStr = JSON.stringify(oldConditions);
        const newConditionsStr = JSON.stringify(newConditions);
        
        if (oldConditionsStr !== newConditionsStr) {
            changes.push('Zmena nastavení poradia');

            changes.push('');
            
            if (newConditions.length > 0) {
                changes.push(`'''Nové poradie rozhodovania:'`);
                newConditions.forEach((cond, index) => {
                    const formattedValue = formatConditionValue(cond);
                    changes.push(`'''${index + 1}. ${formattedValue}'`);
                });
            } else {
                changes.push(`'''Nové poradie rozhodovania: Žiadne vlastné kritériá (iba podľa bodov)'`);
            }

            changes.push('');
            
            if (oldConditions.length > 0) {
                changes.push(`'Pôvodné poradie rozhodovania:'''`);
                oldConditions.forEach((cond, index) => {
                    const formattedValue = formatConditionValue(cond);
                    changes.push(`'${index + 1}. ${formattedValue}'''`);
                });
            } else {
                changes.push(`'Pôvodné poradie rozhodovania: Žiadne vlastné kritériá (iba podľa bodov)'''`);
            }
        }
        
        return changes;
    };

    React.useEffect(() => {
        const loadTableSettings = async () => {
            if (!db) return;
            
            try {
                setIsLoading(true);
                const settingsDocRef = doc(db, 'settings', 'table');
                const settingsDoc = await getDoc(settingsDocRef);
                
                if (settingsDoc.exists()) {
                    const data = settingsDoc.data();
                    setSortingConditions(data.sortingConditions || []);
                    setOriginalSortingConditions(data.sortingConditions || []);
                    setPointsForWin(data.pointsForWin || 3);
                    setOriginalPointsForWin(data.pointsForWin || 3);
                    setBlueCardSuspensionMatches(data.blueCardSuspensionMatches || 1);
                    setOriginalBlueCardSuspensionMatches(data.blueCardSuspensionMatches || 1);
                } else {
                    const defaultSettings = {
                        sortingConditions: [],
                        pointsForWin: 3,
                        blueCardSuspensionMatches: 1
                    };
                    await setDoc(settingsDocRef, defaultSettings);
                    setSortingConditions([]);
                    setOriginalSortingConditions([]);
                    setPointsForWin(3);
                    setOriginalPointsForWin(3);
                    setBlueCardSuspensionMatches(1);
                    setOriginalBlueCardSuspensionMatches(1);
                }
            } catch (error) {
                showNotification(`Chyba pri načítaní nastavení tabuľky: ${error.message}`, 'error');
            } finally {
                setIsLoading(false);
            }
        };

        loadTableSettings();
    }, [db, showNotification]);

    const handlePointsForWinChange = (value) => {
        const numValue = parseInt(value) || 0;
        const clampedValue = Math.max(1, Math.min(10, numValue));
        setPointsForWin(clampedValue);
        
        checkForChanges(clampedValue, blueCardSuspensionMatches);
    };

    const handleBlueCardSuspensionChange = (value) => {
        const numValue = parseInt(value) || 0;
        const clampedValue = Math.max(1, numValue);
        setBlueCardSuspensionMatches(clampedValue);
        
        checkForChanges(pointsForWin, clampedValue);
    };

    const checkForChanges = (currentPoints, currentBlueCardSuspension) => {
        const pointsChanged = currentPoints !== originalPointsForWin;
        const blueCardChanged = currentBlueCardSuspension !== originalBlueCardSuspensionMatches;
        const conditionsChanged = JSON.stringify(sortingConditions) !== JSON.stringify(originalSortingConditions);
        
        setHasChanges(pointsChanged || blueCardChanged || conditionsChanged);
    };

    const handleSortingConditionChange = (index, field, value) => {
        setSortingConditions(prev => {
            const updated = [...prev];
            if (!updated[index]) {
                updated[index] = { parameter: '', direction: 'asc' };
            }
            updated[index] = { ...updated[index], [field]: value };
            
            if (field === 'parameter') {
                if (value === 'headToHead') {
                    updated[index].direction = 'desc';
                } else if (!parametersWithDirection.includes(value)) {
                    updated[index].direction = 'asc';
                }
            }
            
            return updated;
        });
        setHasChanges(true);
    };

    const handleMoveUp = (index) => {
        if (index === 0) return;
        
        setSortingConditions(prev => {
            const updated = [...prev];
            [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
            return updated;
        });
        setHasChanges(true);
    };

    const handleMoveDown = (index) => {
        if (index === sortingConditions.length - 1) return;
        
        setSortingConditions(prev => {
            const updated = [...prev];
            [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
            return updated;
        });
        setHasChanges(true);
    };

    const handleAddCondition = () => {
        setSortingConditions(prev => [
            ...prev,
            { parameter: '', direction: 'desc' }
        ]);
        setHasChanges(true);
    };

    const handleRemoveCondition = (index) => {
        setSortingConditions(prev => prev.filter((_, i) => i !== index));
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!db) return;
        
        try {
            setIsSaving(true);
            const settingsDocRef = doc(db, 'settings', 'table');
            
            const validConditions = sortingConditions.filter(cond => cond.parameter && cond.parameter.trim() !== '');
            
            const dataToSave = {
                sortingConditions: validConditions,
                pointsForWin: pointsForWin,
                blueCardSuspensionMatches: blueCardSuspensionMatches
            };

            const conditionsChanged = JSON.stringify(validConditions) !== JSON.stringify(originalSortingConditions);
            const pointsChanged = pointsForWin !== originalPointsForWin;
            const blueCardChanged = blueCardSuspensionMatches !== originalBlueCardSuspensionMatches;
            const isChanged = conditionsChanged || pointsChanged || blueCardChanged;
            
            if (isChanged) {
                const changes = generateDetailedChanges(
                    originalSortingConditions, 
                    validConditions, 
                    originalPointsForWin, 
                    pointsForWin,
                    originalBlueCardSuspensionMatches,
                    blueCardSuspensionMatches
                );
                await createTableSettingsChangeNotification('table_settings_updated', changes);
            }
            
            await setDoc(settingsDocRef, dataToSave, { merge: true });
            
            setOriginalSortingConditions(validConditions);
            setSortingConditions(validConditions);
            setOriginalPointsForWin(pointsForWin);
            setOriginalBlueCardSuspensionMatches(blueCardSuspensionMatches);
            setHasChanges(false);
            
            showNotification('Nastavenia poradia boli uložené.', 'success');
            
        } catch (error) {
            showNotification(`Chyba pri ukladaní nastavení poradia: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetToDefault = () => {
        setSortingConditions([]);
        setPointsForWin(3);
        setBlueCardSuspensionMatches(1);
        setHasChanges(true);
    };

    const getAvailableParameters = (currentIndex) => {
        const selectedValues = sortingConditions
            .filter((_, index) => index !== currentIndex)
            .map(cond => cond.parameter)
            .filter(param => param && param.trim() !== '');
        
        return [
            { value: '', label: '-- Vyberte parameter --', disabled: true, isPlaceholder: true },
            ...availableParameters.filter(param => !selectedValues.includes(param.value))
        ];
    };

    const areConditionsValid = () => {
        return sortingConditions.every(cond => cond.parameter && cond.parameter.trim() !== '');
    };

    const supportsDirection = (parameter) => {
        return parametersWithDirection.includes(parameter);
    };

    if (isLoading) {
        return React.createElement(
            'div',
            { className: 'text-center py-8' },
            React.createElement('p', { className: 'text-gray-600' }, 'Načítavam nastavenia poradia...')
        );
    }

    return React.createElement(
        'div',
        { className: 'space-y-6' },
        
        React.createElement(
            'div',
            { className: 'border border-gray-200 rounded-lg p-6' },
            
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement('h2', { className: 'text-2xl font-semibold text-gray-800' },
                    'Nastavenia tabuľky/zápasov'
                ),
                React.createElement('p', { className: 'text-gray-600 mt-1 text-sm' },
                    'Nastavte body za výhru, tresty za karty a kritériá pre určenie poradia tímov v tabuľke. Poradie kritérií určuje prioritu.'
                )
            ),
            
            React.createElement(
                'div',
                { className: 'mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200' },
                React.createElement(
                    'div',
                    { className: 'flex items-center space-x-4' },
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        React.createElement(
                            'label',
                            { 
                                htmlFor: 'pointsForWin',
                                className: 'block text-sm font-medium text-gray-700 mb-1'
                            },
                            'Počet bodov za výhru'
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'w-32' },
                        React.createElement(
                            'input',
                            {
                                id: 'pointsForWin',
                                type: 'number',
                                min: '1',
                                max: '10',
                                value: pointsForWin,
                                onChange: (e) => handlePointsForWinChange(e.target.value),
                                className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-center font-medium'
                            }
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-sm text-gray-600' },
                        React.createElement('span', { className: 'font-medium' }, getBodText(pointsForWin)),
                        ' za výhru'
                    )
                )
            ),
            
            React.createElement(
                'div',
                { className: 'mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200' },
                React.createElement(
                    'div',
                    { className: 'flex items-center space-x-4' },
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        React.createElement(
                            'label',
                            { 
                                htmlFor: 'blueCardSuspension',
                                className: 'block text-sm font-medium text-gray-700 mb-1'
                            },
                            'Počet zápasov, na ktoré bude hráč vylúčený po obdržaní modrej karty'
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'w-32' },
                        React.createElement(
                            'input',
                            {
                                id: 'blueCardSuspension',
                                type: 'number',
                                min: '0',
                                value: blueCardSuspensionMatches,
                                onChange: (e) => handleBlueCardSuspensionChange(e.target.value),
                                className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-center font-medium'
                            }
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-sm text-gray-600' },
                        React.createElement('span', { className: 'font-medium' }, getZapasText(blueCardSuspensionMatches)),
                    )
                )
            ),
            
            React.createElement(
                'div',
                { className: 'bg-white rounded-lg' },
                
                React.createElement(
                    'h3',
                    { className: 'text-lg font-medium text-gray-800 mb-3' },
                    'Kritériá poradia pri rovnosti bodov'
                ),
                
                React.createElement(
                    'div',
                    { className: 'space-y-3 mb-4' },
                    sortingConditions.map((condition, index) => {
                        const hasDirectionSupport = condition.parameter && supportsDirection(condition.parameter);
                        const canMoveUp = index > 0;
                        const canMoveDown = index < sortingConditions.length - 1;
                        
                        return React.createElement(
                            'div',
                            { 
                                key: index,
                                className: 'flex items-center space-x-4 bg-gray-50 p-3 rounded-lg'
                            },
                            React.createElement(
                                'div',
                                { className: 'flex items-center space-x-1 w-16' },
                                React.createElement(
                                    'span',
                                    { className: 'text-gray-500 font-medium w-6 text-center' },
                                    `${index + 1}.`
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'flex flex-col space-y-1' },
                                    React.createElement(
                                        'button',
                                        {
                                            type: 'button',
                                            onClick: () => handleMoveUp(index),
                                            disabled: !canMoveUp,
                                            className: `p-1 rounded transition-colors duration-200 ${
                                                canMoveUp 
                                                    ? 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 cursor-pointer' 
                                                    : 'text-gray-300 cursor-not-allowed'
                                            }`
                                        },
                                        React.createElement('svg', { className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M5 15l7-7 7 7' })
                                        )
                                    ),
                                    React.createElement(
                                        'button',
                                        {
                                            type: 'button',
                                            onClick: () => handleMoveDown(index),
                                            disabled: !canMoveDown,
                                            className: `p-1 rounded transition-colors duration-200 ${
                                                canMoveDown 
                                                    ? 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 cursor-pointer' 
                                                    : 'text-gray-300 cursor-not-allowed'
                                            }`
                                        },
                                        React.createElement('svg', { className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 9l-7 7-7-7' })
                                        )
                                    )
                                )
                            ),
                            React.createElement(
                                'select',
                                {
                                    value: condition.parameter || '',
                                    onChange: (e) => handleSortingConditionChange(index, 'parameter', e.target.value),
                                    className: `flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900`
                                },
                                getAvailableParameters(index).map(param => {
                                    if (param.isPlaceholder) {
                                        return React.createElement(
                                            'option', 
                                            { 
                                                key: param.value, 
                                                value: param.value,
                                                disabled: true,
                                                className: 'text-gray-400 cursor-not-allowed hover:cursor-not-allowed'
                                            }, 
                                            param.label
                                        );
                                    }
                                    return React.createElement(
                                        'option', 
                                        { 
                                            key: param.value, 
                                            value: param.value,
                                            className: 'text-gray-900 cursor-pointer hover:cursor-pointer'
                                        }, 
                                        param.label
                                    );
                                })
                            ),
                            (condition.parameter && supportsDirection(condition.parameter) && condition.parameter !== 'headToHead')
                                ? React.createElement(
                                    'select',
                                    {
                                        value: condition.direction || 'asc',
                                        onChange: (e) => handleSortingConditionChange(index, 'direction', e.target.value),
                                        className: 'px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 w-32 text-gray-900 cursor-pointer'
                                    },
                                    React.createElement('option', { value: 'asc', className: 'text-gray-900' }, 'Vzostupne'),
                                    React.createElement('option', { value: 'desc', className: 'text-gray-900' }, 'Zostupne')
                                )
                                : (condition.parameter === 'headToHead'
                                    ? React.createElement(
                                        'div',
                                        { className: 'w-32 px-3 py-2 text-sm text-gray-500 italic' },
                                        'Zostupne'
                                    )
                                    : React.createElement('div', { className: 'w-32' })
                                ),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleRemoveCondition(index),
                                    className: 'p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors duration-200 cursor-pointer'
                                },
                                React.createElement('svg', { className: 'h-5 w-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                                )
                            )
                        );
                    })
                ),
                
                sortingConditions.length < availableParameters.length &&
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: handleAddCondition,
                        className: 'inline-flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mb-4 cursor-pointer'
                    },
                    React.createElement('svg', { className: 'h-5 w-5 mr-2', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M12 4v16m8-8H4' })
                    ),
                    'Pridať podmienku'
                ),
                
                sortingConditions.length === 0 &&
                React.createElement(
                    'div',
                    { className: 'text-sm text-gray-500 italic mb-4' },
                    'Nie sú nastavené žiadne vlastné podmienky poradia. Tímy budú zoradené iba podľa počtu bodov.'
                )
            ),
            
            React.createElement(
                'div',
                { className: 'flex justify-end space-x-4 mt-6' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: handleResetToDefault,
                        disabled: isSaving,
                        className: 'px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                    },
                    'Obnoviť predvolené'
                ),
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: handleSave,
                        disabled: !hasChanges || isSaving || !areConditionsValid(),
                        className: `px-6 py-2 rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                            !hasChanges || isSaving || !areConditionsValid()
                                ? 'bg-white text-blue-600 border-2 border-blue-600 opacity-50 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                        }`
                    },
                    isSaving ? 'Ukladám...' : 'Uložiť nastavenia'
                )
            )
        )
    );
}

window.TableSettings = TableSettings;

// logged-in-tournament-settings-table-settings.js

import { doc, updateDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function TableSettings({ db, userProfileData, showNotification, sendAdminNotification }) {
  // Stav pre podmienky poradia
  const [sortingConditions, setSortingConditions] = React.useState([]);
  
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [originalSortingConditions, setOriginalSortingConditions] = React.useState([]);

  // Dostupné parametre pre selectbox
  const availableParameters = [
    { value: 'headToHead', label: 'Vzájomný zápas' },
    { value: 'scoreDifference', label: '+/-' },
    { value: 'goalsScored', label: 'Počet strelených gólov' },
    { value: 'goalsConceded', label: 'Počet inkasovaných gólov' },
    { value: 'draw', label: 'Losovanie' },
    { value: 'wins', label: 'Počet výhier' },
    { value: 'losses', label: 'Počet prehier' }
  ];

  // Parametre, ktoré podporujú voľbu smeru (vzostupne/zostupne)
  const parametersWithDirection = [
    'scoreDifference',
    'goalsScored',
    'goalsConceded',
    'wins',
    'losses'
  ];

  // Načítanie nastavení poradia z Firestore
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
        } else {
          // Vytvoríme predvolené nastavenia, ak neexistujú
          const defaultSettings = {
            sortingConditions: []
          };
          await setDoc(settingsDocRef, defaultSettings);
          setSortingConditions([]);
          setOriginalSortingConditions([]);
        }
      } catch (error) {
        showNotification(`Chyba pri načítaní nastavení tabuľky: ${error.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadTableSettings();
  }, [db, showNotification]);

  // Handler pre zmenu podmienky poradia
  const handleSortingConditionChange = (index, field, value) => {
    setSortingConditions(prev => {
      const updated = [...prev];
      if (!updated[index]) {
        updated[index] = { parameter: '', direction: 'asc' };
      }
      updated[index] = { ...updated[index], [field]: value };
      
      // Ak parameter nepodporuje smer, nastavíme predvolenú hodnotu a zamkneme
      if (field === 'parameter' && !parametersWithDirection.includes(value)) {
        updated[index].direction = 'asc';
      }
      
      return updated;
    });
    setHasChanges(true);
  };

  // Handler pre pridanie novej podmienky
  const handleAddCondition = () => {
    setSortingConditions(prev => [
      ...prev,
      { parameter: '', direction: 'asc' }
    ]);
    setHasChanges(true);
  };

  // Handler pre odstránenie podmienky
  const handleRemoveCondition = (index) => {
    setSortingConditions(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  // Handler pre uloženie nastavení
  const handleSave = async () => {
    if (!db) return;
    
    try {
      setIsSaving(true);
      const settingsDocRef = doc(db, 'settings', 'table');
      
      // Pripravíme dáta na uloženie - odstránime prázdne podmienky
      const validConditions = sortingConditions.filter(cond => cond.parameter && cond.parameter.trim() !== '');
      
      const dataToSave = {
        sortingConditions: validConditions
      };

      // Zistíme, čo sa zmenilo pre notifikáciu
      const changes = [];
      
      // Zmeny v podmienkach poradia
      if (JSON.stringify(validConditions) !== JSON.stringify(originalSortingConditions)) {
        if (validConditions.length === 0) {
          changes.push('Poradie bolo nastavené na predvolené (podľa bodov)');
        } else {
          const conditionsText = validConditions.map((cond, index) => {
            const param = availableParameters.find(p => p.value === cond.parameter)?.label || cond.parameter;
            // Pridáme smer iba pre parametre, ktoré ho podporujú
            if (parametersWithDirection.includes(cond.parameter)) {
              const direction = cond.direction === 'asc' ? 'vzostupne' : 'zostupne';
              return `${index + 1}. ${param} (${direction})`;
            }
            return `${index + 1}. ${param}`;
          }).join('; ');
          changes.push(`Poradie účastníkov: ${conditionsText}`);
        }
      }

      await setDoc(settingsDocRef, dataToSave, { merge: true });
      
      // Aktualizujeme pôvodné nastavenia
      setOriginalSortingConditions(validConditions);
      setSortingConditions(validConditions); // Aktualizujeme stav aby neobsahoval prázdne podmienky
      setHasChanges(false);
      
      showNotification('Nastavenia poradia boli úspešne uložené.', 'success');
      
      // Notifikácia pre adminov
      if (changes.length > 0) {
        await sendAdminNotification({
          type: 'updateSettings',
          data: {
            changesMade: `Zmena nastavení poradia: ${changes.join('; ')}`
          }
        });
      }
    } catch (error) {
      showNotification(`Chyba pri ukladaní nastavení poradia: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handler pre reset nastavení na predvolené
  const handleResetToDefault = () => {
    setSortingConditions([]);
    setHasChanges(true);
  };

  // Získanie dostupných parametrov pre selectbox
  const getAvailableParameters = (currentIndex) => {
    const selectedValues = sortingConditions
      .filter((_, index) => index !== currentIndex)
      .map(cond => cond.parameter)
      .filter(param => param && param.trim() !== ''); // Iba neprázdne hodnoty
    
    // Pridáme možnosť "Vyberte" ako prvú a potom dostupné parametre
    return [
      { value: '', label: '-- Vyberte parameter --', disabled: true, isPlaceholder: true },
      ...availableParameters.filter(param => !selectedValues.includes(param.value))
    ];
  };

  // Kontrola, či sú všetky podmienky validné
  const areConditionsValid = () => {
    return sortingConditions.every(cond => cond.parameter && cond.parameter.trim() !== '');
  };

  // Zistenie, či parameter podporuje smer
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
    
    // Hlavný kontajner s orámovaním
    React.createElement(
      'div',
      { className: 'border border-gray-200 rounded-lg p-6' },
      
      // Hlavička
      React.createElement(
        'div',
        { className: 'mb-6' },
        React.createElement('h2', { className: 'text-2xl font-semibold text-gray-800' },
          'Nastavenia tabuľky'
        ),
        React.createElement('p', { className: 'text-gray-600 mt-1 text-sm' },
          'Nastavte kritériá pre určenie poradia tímov v tabuľke. Poradie kritérií určuje prioritu.'
        )
      ),
      
      // Sekcia pre nastavenie poradia
      React.createElement(
        'div',
        { className: 'bg-white rounded-lg' },
        
        // Dynamické riadky podmienok
        React.createElement(
          'div',
          { className: 'space-y-3 mb-4' },
          sortingConditions.map((condition, index) => {
            const hasDirectionSupport = condition.parameter && supportsDirection(condition.parameter);
            
            return React.createElement(
              'div',
              { 
                key: index,
                className: 'flex items-center space-x-4 bg-gray-50 p-3 rounded-lg'
              },
              React.createElement(
                'span',
                { className: 'text-gray-500 font-medium w-8' },
                `${index + 1}.`
              ),
              // Select pre výber parametra
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
              // Select pre smer - zobrazí sa len pre podporované parametre
              hasDirectionSupport 
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
                : React.createElement('div', { className: 'w-32' }), // Prázdny div pre zachovanie medzery
              // Tlačidlo pre odstránenie
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
        
        // Tlačidlo pre pridanie novej podmienky
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
        
        // Informácia o predvolenom poradí
        sortingConditions.length === 0 &&
        React.createElement(
          'div',
          { className: 'text-sm text-gray-500 italic mb-4' },
          'Nie sú nastavené žiadne vlastné podmienky poradia. Tímy budú zoradené iba podľa počtu bodov.'
        )
      ),
      
      // Akčné tlačidlá
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
            className: `px-6 py-2 bg-blue-600 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${hasChanges && !isSaving && areConditionsValid() ? 'hover:bg-blue-700 cursor-pointer' : ''}`
          },
          isSaving ? 'Ukladám...' : 'Uložiť nastavenia'
        )
      )
    )
  );
}

// Pridáme komponent do globálneho scope
window.TableSettings = TableSettings;

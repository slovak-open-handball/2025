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
        updated[index] = { parameter: 'headToHead', direction: 'asc' };
      }
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setHasChanges(true);
  };

  // Handler pre pridanie novej podmienky
  const handleAddCondition = () => {
    setSortingConditions(prev => [
      ...prev,
      { parameter: 'headToHead', direction: 'asc' }
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
      
      // Pripravíme dáta na uloženie
      const dataToSave = {
        sortingConditions: sortingConditions
      };

      // Zistíme, čo sa zmenilo pre notifikáciu
      const changes = [];
      
      // Zmeny v podmienkach poradia
      if (JSON.stringify(sortingConditions) !== JSON.stringify(originalSortingConditions)) {
        if (sortingConditions.length === 0) {
          changes.push('Poradie bolo nastavené na predvolené (podľa dátumu registrácie)');
        } else {
          const conditionsText = sortingConditions.map((cond, index) => {
            const param = availableParameters.find(p => p.value === cond.parameter)?.label || cond.parameter;
            const direction = cond.direction === 'asc' ? 'vzostupne' : 'zostupne';
            return `${index + 1}. ${param} (${direction})`;
          }).join('; ');
          changes.push(`Poradie účastníkov: ${conditionsText}`);
        }
      }

      await setDoc(settingsDocRef, dataToSave, { merge: true });
      
      // Aktualizujeme pôvodné nastavenia
      setOriginalSortingConditions(sortingConditions);
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

  // Získanie dostupných parametrov pre selectbox (odstránime už vybraté)
  const getAvailableParameters = (currentIndex) => {
    const selectedValues = sortingConditions
      .filter((_, index) => index !== currentIndex)
      .map(cond => cond.parameter);
    
    return availableParameters.filter(param => !selectedValues.includes(param.value));
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
    
    // Hlavička
    React.createElement(
      'div',
      { className: 'border-b border-gray-200 pb-4' },
      React.createElement('h2', { className: 'text-2xl font-semibold text-gray-800' },
        'Nastavenia tabuľky'
      ),
      React.createElement('p', { className: 'text-gray-600 mt-1 text-sm' },
        'Nastavte kritériá pre určenie poradia účastníkov v tabuľke. Poradie kritérií určuje prioritu.'
      )
    ),
    
    // Sekcia pre nastavenie poradia
    React.createElement(
      'div',
      { className: 'bg-white border border-gray-200 rounded-lg p-6' },
      
      // Dynamické riadky podmienok
      React.createElement(
        'div',
        { className: 'space-y-3 mb-4' },
        sortingConditions.map((condition, index) => 
          React.createElement(
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
            React.createElement(
              'select',
              {
                value: condition.parameter || 'headToHead',
                onChange: (e) => handleSortingConditionChange(index, 'parameter', e.target.value),
                className: 'flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500'
              },
              getAvailableParameters(index).map(param => 
                React.createElement('option', { key: param.value, value: param.value }, param.label)
              )
            ),
            React.createElement(
              'select',
              {
                value: condition.direction || 'asc',
                onChange: (e) => handleSortingConditionChange(index, 'direction', e.target.value),
                className: 'px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 w-32'
              },
              React.createElement('option', { value: 'asc' }, 'Vzostupne'),
              React.createElement('option', { value: 'desc' }, 'Zostupne')
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => handleRemoveCondition(index),
                className: 'p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors duration-200'
              },
              React.createElement('svg', { className: 'h-5 w-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
              )
            )
          )
        )
      ),
      
      // Tlačidlo pre pridanie novej podmienky
      sortingConditions.length < availableParameters.length &&
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: handleAddCondition,
          className: 'inline-flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
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
        { className: 'text-sm text-gray-500 italic mt-2' },
        'Nie sú nastavené žiadne vlastné podmienky poradia. Účastníci budú zoradení podľa dátumu registrácie (od najnovších).'
      ),
      
      // Informačný panel
      React.createElement(
        'div',
        { className: 'bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6' },
        React.createElement('div', { className: 'flex' },
          React.createElement('div', { className: 'flex-shrink-0' },
            React.createElement('svg', { className: 'h-5 w-5 text-blue-400', viewBox: '0 0 20 20', fill: 'currentColor' },
              React.createElement('path', { fillRule: 'evenodd', d: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z', clipRule: 'evenodd' })
            )
          ),
          React.createElement('div', { className: 'ml-3 flex-1' },
            React.createElement('p', { className: 'text-sm text-blue-700' },
              'Poradie účastníkov sa riadi nastavenými kritériami. Prvé kritérium má najvyššiu prioritu.'
            )
          )
        )
      )
    ),
    
    // Akčné tlačidlá
    React.createElement(
      'div',
      { className: 'flex justify-end space-x-4 pt-4 border-t border-gray-200' },
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: handleResetToDefault,
          disabled: isSaving,
          className: 'px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
        },
        'Obnoviť predvolené'
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: handleSave,
          disabled: !hasChanges || isSaving,
          className: `px-6 py-2 bg-blue-600 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${hasChanges && !isSaving ? 'hover:bg-blue-700' : ''}`
        },
        isSaving ? 'Ukladám...' : 'Uložiť nastavenia'
      )
    )
  );
}

// Pridáme komponent do globálneho scope
window.TableSettings = TableSettings;

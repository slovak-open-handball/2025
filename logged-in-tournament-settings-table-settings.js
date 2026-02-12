// logged-in-tournament-settings-table-settings.js

import { doc, updateDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function TableSettings({ db, userProfileData, showNotification, sendAdminNotification }) {
  const [tableSettings, setTableSettings] = React.useState({
    showLevel: true,
    showCategory: true,
    showGender: true,
    showYearOfBirth: true,
    showClub: true,
    showCity: true,
    showAccommodation: true,
    showTShirt: true,
    showPackages: true,
    showNote: true,
    showRegisteredAt: false,
    showPaymentStatus: true,
    showPaymentMethod: true
  });
  
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [originalSettings, setOriginalSettings] = React.useState(null);

  // Načítanie nastavení tabuľky z Firestore
  React.useEffect(() => {
    const loadTableSettings = async () => {
      if (!db) return;
      
      try {
        setIsLoading(true);
        const settingsDocRef = doc(db, 'settings', 'table');
        const settingsDoc = await getDoc(settingsDocRef);
        
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setTableSettings(data);
          setOriginalSettings(data);
        } else {
          // Vytvoríme predvolené nastavenia, ak neexistujú
          const defaultSettings = {
            showLevel: true,
            showCategory: true,
            showGender: true,
            showYearOfBirth: true,
            showClub: true,
            showCity: true,
            showAccommodation: true,
            showTShirt: true,
            showPackages: true,
            showNote: true,
            showRegisteredAt: false,
            showPaymentStatus: true,
            showPaymentMethod: true
          };
          setTableSettings(defaultSettings);
          setOriginalSettings(defaultSettings);
        }
      } catch (error) {
        showNotification(`Chyba pri načítaní nastavení tabuľky: ${error.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadTableSettings();
  }, [db, showNotification]);

  // Handler pre zmenu checkboxu
  const handleCheckboxChange = (field) => (e) => {
    const newValue = e.target.checked;
    setTableSettings(prev => ({
      ...prev,
      [field]: newValue
    }));
    setHasChanges(true);
  };

  // Handler pre uloženie nastavení
  const handleSave = async () => {
    if (!db) return;
    
    try {
      setIsSaving(true);
      const settingsDocRef = doc(db, 'settings', 'table');
      
      // Zistíme, čo sa zmenilo pre notifikáciu
      const changes = [];
      Object.keys(tableSettings).forEach(key => {
        if (originalSettings && tableSettings[key] !== originalSettings[key]) {
          const fieldName = getFieldLabel(key);
          const newState = tableSettings[key] ? 'zobrazený' : 'skrytý';
          changes.push(`Stĺpec "${fieldName}" bude ${newState}`);
        }
      });

      await setDoc(settingsDocRef, tableSettings, { merge: true });
      
      // Aktualizujeme pôvodné nastavenia
      setOriginalSettings(tableSettings);
      setHasChanges(false);
      
      showNotification('Nastavenia tabuľky boli úspešne uložené.', 'success');
      
      // Notifikácia pre adminov
      if (changes.length > 0) {
        await sendAdminNotification({
          type: 'updateSettings',
          data: {
            changesMade: `Zmena nastavení tabuľky: ${changes.join('; ')}`
          }
        });
      }
    } catch (error) {
      showNotification(`Chyba pri ukladaní nastavení tabuľky: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handler pre reset nastavení na predvolené
  const handleResetToDefault = () => {
    const defaultSettings = {
      showLevel: true,
      showCategory: true,
      showGender: true,
      showYearOfBirth: true,
      showClub: true,
      showCity: true,
      showAccommodation: true,
      showTShirt: true,
      showPackages: true,
      showNote: true,
      showRegisteredAt: false,
      showPaymentStatus: true,
      showPaymentMethod: true
    };
    
    setTableSettings(defaultSettings);
    setHasChanges(true);
  };

  // Pomocná funkcia pre získanie popisku poľa
  const getFieldLabel = (field) => {
    const labels = {
      showLevel: 'Výkonnostná úroveň',
      showCategory: 'Kategória',
      showGender: 'Pohlavie',
      showYearOfBirth: 'Rok narodenia',
      showClub: 'Klub',
      showCity: 'Mesto',
      showAccommodation: 'Ubytovanie',
      showTShirt: 'Veľkosť trička',
      showPackages: 'Zvolené balíčky',
      showNote: 'Poznámka',
      showRegisteredAt: 'Dátum registrácie',
      showPaymentStatus: 'Stav platby',
      showPaymentMethod: 'Spôsob platby'
    };
    return labels[field] || field;
  };

  if (isLoading) {
    return React.createElement(
      'div',
      { className: 'text-center py-8' },
      React.createElement('p', { className: 'text-gray-600' }, 'Načítavam nastavenia tabuľky...')
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
        'Nastavenia tabuľky účastníkov'
      ),
      React.createElement('p', { className: 'text-gray-600 mt-1 text-sm' },
        'Vyberte, ktoré stĺpce sa majú zobrazovať v tabuľke účastníkov turnaja.'
      )
    ),
    
    // Grid s checkboxmi
    React.createElement(
      'div',
      { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
      
      // Základné údaje
      React.createElement(
        'div',
        { className: 'space-y-2' },
        React.createElement('h3', { className: 'font-medium text-gray-700 mb-2' },
          'Základné údaje'
        ),
        React.createElement(
          'div',
          { className: 'space-y-2' },
          // Výkonnostná úroveň
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showLevel,
              onChange: handleCheckboxChange('showLevel'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Výkonnostná úroveň')
          ),
          // Kategória
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showCategory,
              onChange: handleCheckboxChange('showCategory'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Kategória')
          ),
          // Pohlavie
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showGender,
              onChange: handleCheckboxChange('showGender'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Pohlavie')
          ),
          // Rok narodenia
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showYearOfBirth,
              onChange: handleCheckboxChange('showYearOfBirth'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Rok narodenia')
          )
        )
      ),
      
      // Kontaktné údaje a klub
      React.createElement(
        'div',
        { className: 'space-y-2' },
        React.createElement('h3', { className: 'font-medium text-gray-700 mb-2' },
          'Klub a lokalita'
        ),
        React.createElement(
          'div',
          { className: 'space-y-2' },
          // Klub
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showClub,
              onChange: handleCheckboxChange('showClub'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Klub')
          ),
          // Mesto
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showCity,
              onChange: handleCheckboxChange('showCity'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Mesto')
          )
        )
      ),
      
      // Špecifické nastavenia turnaja
      React.createElement(
        'div',
        { className: 'space-y-2' },
        React.createElement('h3', { className: 'font-medium text-gray-700 mb-2' },
          'Turnajové nastavenia'
        ),
        React.createElement(
          'div',
          { className: 'space-y-2' },
          // Ubytovanie
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showAccommodation,
              onChange: handleCheckboxChange('showAccommodation'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Ubytovanie')
          ),
          // Veľkosť trička
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showTShirt,
              onChange: handleCheckboxChange('showTShirt'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Veľkosť trička')
          ),
          // Zvolené balíčky
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showPackages,
              onChange: handleCheckboxChange('showPackages'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Zvolené balíčky')
          ),
          // Poznámka
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showNote,
              onChange: handleCheckboxChange('showNote'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Poznámka')
          )
        )
      ),
      
      // Registrácia a platby
      React.createElement(
        'div',
        { className: 'space-y-2' },
        React.createElement('h3', { className: 'font-medium text-gray-700 mb-2' },
          'Registrácia a platby'
        ),
        React.createElement(
          'div',
          { className: 'space-y-2' },
          // Dátum registrácie
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showRegisteredAt,
              onChange: handleCheckboxChange('showRegisteredAt'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Dátum registrácie')
          ),
          // Stav platby
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showPaymentStatus,
              onChange: handleCheckboxChange('showPaymentStatus'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Stav platby')
          ),
          // Spôsob platby
          React.createElement(
            'label',
            { className: 'flex items-center space-x-3' },
            React.createElement('input', {
              type: 'checkbox',
              checked: tableSettings.showPaymentMethod,
              onChange: handleCheckboxChange('showPaymentMethod'),
              className: 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
            }),
            React.createElement('span', { className: 'text-gray-700' }, 'Spôsob platby')
          )
        )
      )
    ),
    
    // Informačný panel
    React.createElement(
      'div',
      { className: 'bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4' },
      React.createElement('div', { className: 'flex' },
        React.createElement('div', { className: 'flex-shrink-0' },
          React.createElement('svg', { className: 'h-5 w-5 text-blue-400', viewBox: '0 0 20 20', fill: 'currentColor' },
            React.createElement('path', { fillRule: 'evenodd', d: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z', clipRule: 'evenodd' })
          )
        ),
        React.createElement('div', { className: 'ml-3 flex-1' },
          React.createElement('p', { className: 'text-sm text-blue-700' },
            'Tieto nastavenia ovplyvňujú zobrazenie tabuľky účastníkov v administračnom rozhraní. Stĺpce, ktoré nie sú zaškrtnuté, budú skryté.'
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

// logged-in-tournament-settings-pages-settings.js

// Import potrebných Firebase funkcií
import { collection, getDocs, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

function PagesSettings({ db, showNotification, sendAdminNotification }) {
  const [pageSettings, setPageSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(null);

  // Definícia stránky pre rozlosovanie tímov do skupín
  const PAGE_DEFINITION = {
    id: 'teamDraw',
    label: 'Rozlosovanie tímov do skupín',
    defaultVisible: true
  };

  // Načítanie nastavení stránky z Firestore
  useEffect(() => {
    if (!db) return;

    const fetchPageSettings = async () => {
      try {
        setLoading(true);
        const pageRef = doc(db, 'pages', PAGE_DEFINITION.id);
        const pageDoc = await getDoc(pageRef);
        
        if (pageDoc.exists()) {
          // Načítame existujúce nastavenia
          const data = pageDoc.data();
          setPageSettings({
            id: PAGE_DEFINITION.id,
            label: data.label || PAGE_DEFINITION.label,
            visible: data.visible !== undefined ? data.visible : PAGE_DEFINITION.defaultVisible,
          });
        } else {
          // Ak dokument neexistuje, vytvoríme predvolené nastavenia
          const defaultSettings = {
            id: PAGE_DEFINITION.id,
            label: PAGE_DEFINITION.label,
            visible: PAGE_DEFINITION.defaultVisible,
          };
          setPageSettings(defaultSettings);
        }
        
        // Uložíme pôvodné nastavenia pre porovnanie
        setOriginalSettings(JSON.parse(JSON.stringify(pageSettings || defaultSettings)));
      } catch (error) {
        if (showNotification) {
          showNotification(`Chyba pri načítaní nastavení stránky: ${error.message}`, 'error');
        } else {
          console.error('Chyba pri načítaní nastavení stránky:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPageSettings();
  }, [db, showNotification]);

  // Zmena viditeľnosti stránky
  const handleToggleVisibility = () => {
    if (pageSettings) {
      setPageSettings({
        ...pageSettings,
        visible: !pageSettings.visible
      });
      setHasChanges(true);
    }
  };

  // Uloženie zmien do Firestore
  const handleSave = async () => {
    if (!db || !pageSettings) return;
    
    try {
      setSaving(true);
      
      // Zistíme, či nastala zmena
      if (originalSettings && originalSettings.visible === pageSettings.visible) {
        if (showNotification) {
          showNotification('Žiadne zmeny na uloženie.', 'info');
        }
        setSaving(false);
        return;
      }

      // Uložíme nastavenia stránky
      const pageRef = doc(db, 'pages', pageSettings.id);
      await setDoc(pageRef, {
        label: pageSettings.label,
        visible: pageSettings.visible,
        updatedAt: Timestamp.fromDate(new Date()),
      }, { merge: true });

      // Aktualizujeme pôvodné dáta
      setOriginalSettings(JSON.parse(JSON.stringify(pageSettings)));
      setHasChanges(false);

      // Odošleme notifikáciu administrátorom
      if (sendAdminNotification) {
        await sendAdminNotification({
          type: 'updatePagesSettings',
          data: {
            changesMade: `Zmena viditeľnosti stránky "${pageSettings.label}": ${pageSettings.visible ? 'viditeľná' : 'skrytá'}`,
            changedPages: [{
              id: pageSettings.id,
              label: pageSettings.label,
              visible: pageSettings.visible
            }],
          }
        });
      }

      if (showNotification) {
        showNotification('Nastavenia stránky boli úspešne uložené!', 'success');
      }
    } catch (error) {
      if (showNotification) {
        showNotification(`Chyba pri ukladaní nastavení stránky: ${error.message}`, 'error');
      } else {
        console.error('Chyba pri ukladaní nastavení stránky:', error);
      }
    } finally {
      setSaving(false);
    }
  };

  // Reset zmien
  const handleReset = () => {
    if (originalSettings) {
      setPageSettings(JSON.parse(JSON.stringify(originalSettings)));
      setHasChanges(false);
      if (showNotification) {
        showNotification('Zmeny boli zahodené.', 'info');
      }
    }
  };

  if (loading) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center py-12' },
      React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500' })
    );
  }

  if (!pageSettings) {
    return React.createElement(
      'div',
      { className: 'text-center py-8 text-gray-500' },
      'Nepodarilo sa načítať nastavenia stránky.'
    );
  }

  return React.createElement(
    'div',
    { className: 'space-y-6' },
    React.createElement(
      'div',
      { className: 'flex justify-between items-center' },
      React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Nastavenia viditeľnosti stránky'),
      React.createElement(
        'div',
        { className: 'flex gap-3' },
        hasChanges && React.createElement(
          'button',
          {
            onClick: handleReset,
            className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors'
          },
          'Zahodiť zmeny'
        ),
        React.createElement(
          'button',
          {
            onClick: handleSave,
            disabled: !hasChanges || saving,
            className: `font-medium py-2 px-6 rounded-lg transition-colors ${
              hasChanges && !saving
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`
          },
          saving ? 'Ukladám...' : 'Uložiť zmeny'
        )
      )
    ),
    React.createElement(
      'p',
      { className: 'text-gray-600 text-sm' },
      'Tu môžete zapnúť alebo vypnúť viditeľnosť stránky "Rozlosovanie tímov do skupín" v aplikácii.'
    ),
    React.createElement(
      'div',
      { className: 'bg-gray-50 rounded-lg overflow-hidden border border-gray-200' },
      React.createElement(
        'div',
        { className: 'p-4' },
        React.createElement(
          'div',
          { className: 'flex items-center justify-between' },
          React.createElement(
            'div',
            { className: 'flex items-center gap-4' },
            React.createElement('span', { className: 'font-medium text-gray-800' }, pageSettings.label),
            React.createElement('span', { className: 'text-sm text-gray-500' }, `(ID: ${pageSettings.id})`)
          ),
          React.createElement(
            'div',
            { className: 'flex items-center gap-3' },
            React.createElement(
              'span',
              { className: `text-sm ${pageSettings.visible ? 'text-green-600' : 'text-red-500'}` },
              pageSettings.visible ? 'Viditeľná' : 'Skrytá'
            ),
            React.createElement(
              'button',
              {
                onClick: handleToggleVisibility,
                className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  pageSettings.visible ? 'bg-blue-600' : 'bg-gray-300'
                }`
              },
              React.createElement('span', {
                className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  pageSettings.visible ? 'translate-x-6' : 'translate-x-1'
                }`
              })
            )
          )
        )
      )
    ),
    React.createElement(
      'div',
      { className: 'text-sm text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-200' },
      React.createElement('strong', null, 'Info:'),
      ' Zmeny sa prejavia okamžite po uložení. Pre zobrazenie zmien môže byť potrebné obnoviť stránku.'
    )
  );
}

export { PagesSettings };

window.PagesSettings = PagesSettings;

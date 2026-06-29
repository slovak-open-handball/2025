// logged-in-tournament-settings-pages-settings.js

// Import potrebných Firebase funkcií
import { collection, getDocs, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

function PagesSettings({ db, showNotification, sendAdminNotification }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Definícia všetkých dostupných stránok
  const PAGE_DEFINITIONS = [
    { id: 'teams-in-groups', label: 'Rozlosovanie tímov do skupín', defaultVisible: false },
    { id: 'matches', label: 'Zápasy', defaultVisible: false },
  ];

  // Pomocná funkcia na zoradenie stránok podľa PAGE_DEFINITIONS
  const sortPagesByDefinition = (pagesArray) => {
    const orderMap = {};
    PAGE_DEFINITIONS.forEach((def, index) => {
      orderMap[def.id] = index;
    });
    
    return [...pagesArray].sort((a, b) => {
      const orderA = orderMap[a.id] !== undefined ? orderMap[a.id] : Infinity;
      const orderB = orderMap[b.id] !== undefined ? orderMap[b.id] : Infinity;
      return orderA - orderB;
    });
  };

  // Načítanie nastavení stránok z Firestore
  useEffect(() => {
    if (!db) return;

    const fetchPages = async () => {
      try {
        setLoading(true);
        const pagesRef = collection(db, 'pages');
        const pagesSnapshot = await getDocs(pagesRef);
        
        if (pagesSnapshot.empty) {
          // Ak kolekcia neexistuje, vytvoríme predvolené nastavenia (všetky skryté)
          const defaultPages = PAGE_DEFINITIONS.map(page => ({
            id: page.id,
            label: page.label,
            visible: false, // Všetky stránky budú skryté
          }));
          setPages(defaultPages);
        } else {
          // Načítame existujúce nastavenia
          const pagesData = [];
          pagesSnapshot.forEach(doc => {
            const data = doc.data();
            pagesData.push({
              id: doc.id,
              label: data.label || doc.id,
              visible: data.visible !== undefined ? data.visible : false,
            });
          });
          
          // Skontrolujeme, či máme všetky definované stránky
          const existingIds = new Set(pagesData.map(p => p.id));
          const missingPages = PAGE_DEFINITIONS
            .filter(p => !existingIds.has(p.id))
            .map(p => ({
              id: p.id,
              label: p.label,
              visible: false,
            }));
          
          const allPages = [...pagesData, ...missingPages];
          // Zoradíme stránky podľa PAGE_DEFINITIONS
          const sortedPages = sortPagesByDefinition(allPages);
          setPages(sortedPages);
        }
      } catch (error) {
        if (showNotification) {
          showNotification(`Chyba pri načítaní nastavení stránok: ${error.message}`, 'error');
        } else {
          console.error('Chyba pri načítaní nastavení stránok:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [db, showNotification]);

  // Zmena viditeľnosti stránky - okamžité uloženie
  const handleToggleVisibility = async (pageId) => {
    // Nájdeme stránku, ktorú meníme
    const pageToUpdate = pages.find(p => p.id === pageId);
    if (!pageToUpdate) return;

    // Nový stav
    const newVisible = !pageToUpdate.visible;
    
    // Aktualizujeme lokálny stav
    setPages(prevPages => {
      const updatedPages = prevPages.map(page => 
        page.id === pageId 
          ? { ...page, visible: newVisible }
          : page
      );
      return sortPagesByDefinition(updatedPages);
    });

    // Okamžite uložíme do Firestore
    try {
      setSaving(true);
      
      const pageRef = doc(db, 'pages', pageId);
      await setDoc(pageRef, {
        label: pageToUpdate.label,
        visible: newVisible,
        updatedAt: Timestamp.fromDate(new Date()),
      }, { merge: true });

      // Odošleme notifikáciu administrátorom o zmene
      if (sendAdminNotification) {
        const statusText = newVisible ? 'verejná' : 'skrytá';
        const changesDescription = `${pageToUpdate.label}: z '${pageToUpdate.visible ? 'verejná' : 'skrytá'}' na '${statusText}'`;
        
        await sendAdminNotification({
          type: 'updatePagesSettings',
          data: {
            changesMade: `Zmena viditeľnosti stránky: ${changesDescription}`,
            changedPages: [{
              id: pageId,
              label: pageToUpdate.label,
              visible: newVisible,
              originalVisible: pageToUpdate.visible
            }],
            originalPages: pages.map(p => ({ 
              id: p.id, 
              label: p.label, 
              visible: p.id === pageId ? pageToUpdate.visible : p.visible 
            }))
          }
        });
      }

      if (showNotification) {
        showNotification(`Nastavenie stránky "${pageToUpdate.label}" bolo uložené!`, 'success');
      }
    } catch (error) {
      // Ak sa uloženie nepodarí, vrátime pôvodný stav
      setPages(prevPages => {
        const revertedPages = prevPages.map(page => 
          page.id === pageId 
            ? { ...page, visible: pageToUpdate.visible }
            : page
        );
        return sortPagesByDefinition(revertedPages);
      });

      if (showNotification) {
        showNotification(`Chyba pri ukladaní nastavenia stránky: ${error.message}`, 'error');
      } else {
        console.error('Chyba pri ukladaní nastavenia stránky:', error);
      }
    } finally {
      setSaving(false);
    }
  };

  // Komponent prepínača (ToggleSwitch) - zelená farba rovnako ako v AccommodationSettings
  const ToggleSwitch = ({ isOn, onToggle, disabled }) => {
    return React.createElement(
      'button',
      {
        type: 'button',
        onClick: onToggle,
        disabled: disabled,
        className: `
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${isOn ? 'bg-green-500' : 'bg-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `,
      },
      React.createElement('span', {
        className: `
          inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200
          ${isOn ? 'translate-x-6' : 'translate-x-1'}
        `,
      })
    );
  };

  if (loading) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center py-12' },
      React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500' })
    );
  }

  return React.createElement(
    'div',
    { className: 'space-y-6' },
    React.createElement(
      'div',
      { className: 'flex justify-between items-center' },
      React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Nastavenia viditeľnosti webových stránok')
    ),
    React.createElement(
      'div',
      { className: 'bg-gray-50 rounded-lg overflow-hidden border border-gray-200' },
      React.createElement(
        'div',
        { className: 'grid grid-cols-1 divide-y divide-gray-200' },
        pages.map((page) =>
          React.createElement(
            'div',
            {
              key: page.id,
              className: 'flex items-center justify-between p-4 hover:bg-gray-100 transition-colors'
            },
            React.createElement(
              'div',
              { className: 'flex items-center gap-4' },
              React.createElement('span', { className: 'font-medium text-gray-800' }, page.label),
            ),
            React.createElement(
              'div',
              { className: 'flex items-center gap-3' },
              React.createElement(
                'span',
                { className: `text-sm ${page.visible ? 'text-green-600' : 'text-red-500'}` },
                page.visible ? 'Verejná' : 'Skrytá'
              ),
              React.createElement(ToggleSwitch, {
                isOn: page.visible,
                onToggle: () => handleToggleVisibility(page.id),
                disabled: saving
              })
            )
          )
        )
      )
    ),
    // Informačná správa o automatickom ukladaní
    React.createElement(
      'div',
      { className: 'text-sm text-gray-500 text-right pt-2' },
      'Zmeny sa ukladajú automaticky pri každom prepnutí'
    )
  );
}

export { PagesSettings };

window.PagesSettings = PagesSettings;

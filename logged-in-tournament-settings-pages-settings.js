// logged-in-tournament-settings-pages-settings.js

const { useState, useEffect } = React;

function PagesSettings({ db, showNotification, sendAdminNotification }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPages, setOriginalPages] = useState([]);

  // Definícia všetkých dostupných stránok
  const PAGE_DEFINITIONS = [
    { id: 'home', label: 'Domovská stránka', defaultVisible: true },
    { id: 'tournament', label: 'Turnaj', defaultVisible: true },
    { id: 'matches', label: 'Zápasy', defaultVisible: true },
    { id: 'tables', label: 'Tabuľky', defaultVisible: true },
    { id: 'registration', label: 'Registrácia', defaultVisible: true },
    { id: 'myData', label: 'Moje údaje', defaultVisible: true },
    { id: 'hallPanel', label: 'Panel pre haly', defaultVisible: true },
    { id: 'adminPanel', label: 'Administrátorský panel', defaultVisible: true },
    // Pridajte ďalšie stránky podľa potreby
  ];

  // Načítanie nastavení stránok z Firestore
  useEffect(() => {
    if (!db) return;

    const fetchPages = async () => {
      try {
        setLoading(true);
        const pagesRef = collection(db, 'pages');
        const pagesSnapshot = await getDocs(pagesRef);
        
        if (pagesSnapshot.empty) {
          // Ak kolekcia neexistuje, vytvoríme predvolené nastavenia
          const defaultPages = PAGE_DEFINITIONS.map(page => ({
            id: page.id,
            label: page.label,
            visible: page.defaultVisible,
          }));
          setPages(defaultPages);
          setOriginalPages(JSON.parse(JSON.stringify(defaultPages)));
        } else {
          // Načítame existujúce nastavenia
          const pagesData = [];
          pagesSnapshot.forEach(doc => {
            const data = doc.data();
            pagesData.push({
              id: doc.id,
              label: data.label || doc.id,
              visible: data.visible !== undefined ? data.visible : true,
            });
          });
          
          // Skontrolujeme, či máme všetky definované stránky
          const existingIds = new Set(pagesData.map(p => p.id));
          const missingPages = PAGE_DEFINITIONS
            .filter(p => !existingIds.has(p.id))
            .map(p => ({
              id: p.id,
              label: p.label,
              visible: p.defaultVisible,
            }));
          
          const allPages = [...pagesData, ...missingPages];
          setPages(allPages);
          setOriginalPages(JSON.parse(JSON.stringify(allPages)));
        }
      } catch (error) {
        showNotification(`Chyba pri načítaní nastavení stránok: ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [db]);

  // Zmena viditeľnosti stránky
  const handleToggleVisibility = (pageId) => {
    setPages(prevPages => 
      prevPages.map(page => 
        page.id === pageId 
          ? { ...page, visible: !page.visible }
          : page
      )
    );
    setHasChanges(true);
  };

  // Uloženie zmien do Firestore
  const handleSave = async () => {
    if (!db) return;
    
    try {
      setSaving(true);
      
      // Zistíme, ktoré stránky sa zmenili
      const changedPages = pages.filter(page => {
        const original = originalPages.find(p => p.id === page.id);
        return original && original.visible !== page.visible;
      });

      if (changedPages.length === 0) {
        showNotification('Žiadne zmeny na uloženie.', 'info');
        setSaving(false);
        return;
      }

      // Uložíme každú zmenenú stránku
      for (const page of changedPages) {
        const pageRef = doc(db, 'pages', page.id);
        await setDoc(pageRef, {
          label: page.label,
          visible: page.visible,
          updatedAt: Timestamp.fromDate(new Date()),
        }, { merge: true });
      }

      // Aktualizujeme pôvodné dáta
      setOriginalPages(JSON.parse(JSON.stringify(pages)));
      setHasChanges(false);

      // Odošleme notifikáciu administrátorom
      const changesDescription = changedPages
        .map(p => `${p.label}: ${p.visible ? 'viditeľná' : 'skrytá'}`)
        .join('; ');
      
      await sendAdminNotification({
        type: 'updatePagesSettings',
        data: {
          changesMade: `Zmena viditeľnosti stránok: ${changesDescription}`,
          changedPages: changedPages.map(p => ({ id: p.id, label: p.label, visible: p.visible })),
        }
      });

      showNotification('Nastavenia stránok boli úspešne uložené!', 'success');
    } catch (error) {
      showNotification(`Chyba pri ukladaní nastavení stránok: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Reset zmien
  const handleReset = () => {
    setPages(JSON.parse(JSON.stringify(originalPages)));
    setHasChanges(false);
    showNotification('Zmeny boli zahodené.', 'info');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Nastavenia viditeľnosti stránok</h2>
        <div className="flex gap-3">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Zahodiť zmeny
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`font-medium py-2 px-6 rounded-lg transition-colors ${
              hasChanges && !saving
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? 'Ukladám...' : 'Uložiť zmeny'}
          </button>
        </div>
      </div>

      <p className="text-gray-600 text-sm">
        Tu môžete zapnúť alebo vypnúť viditeľnosť jednotlivých stránok v aplikácii.
        Skryté stránky nebudú dostupné pre bežných používateľov.
      </p>

      <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
        <div className="grid grid-cols-1 divide-y divide-gray-200">
          {pages.map((page) => (
            <div
              key={page.id}
              className="flex items-center justify-between p-4 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="font-medium text-gray-800">{page.label}</span>
                <span className="text-sm text-gray-500">(ID: {page.id})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm ${page.visible ? 'text-green-600' : 'text-red-500'}`}>
                  {page.visible ? 'Viditeľná' : 'Skrytá'}
                </span>
                <button
                  onClick={() => handleToggleVisibility(page.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    page.visible ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      page.visible ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-200">
        <strong>Info:</strong> Zmeny sa prejavia okamžite po uložení. Pre zobrazenie zmien môže byť potrebné obnoviť stránku.
      </div>
    </div>
  );
}

window.PagesSettings = PagesSettings;

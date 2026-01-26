import { collection, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";

const getRecaptchaToken = async (action) => {
  if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
    console.error("reCAPTCHA API nie je načítané alebo pripravené.");
    return null;
  }
  try {
    const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
    return token;
  } catch (e) {
    console.error("Chyba pri získavaní reCAPTCHA tokenu:", e);
    return null;
  }
};

export function Page3Form({
  formData,
  handlePrev,
  handleNextPage3ToPage4,
  loading,
  setLoading,
  setNotificationMessage,
  setShowNotification,
  setNotificationType,
  setRegistrationSuccess,
  isRecaptchaReady,
  selectedCountryDialCode,
  NotificationModal,
  notificationMessage,
  closeNotification,
  availableCategoriesMap,
  selectedCategoryRows,
  setSelectedCategoryRows,
  notificationType
}) {
  const [categoriesData, setCategoriesData] = React.useState({});
  const [isCategoriesLoaded, setIsCategoriesLoaded] = React.useState(false);
  const [categoryTeamCounts, setCategoryTeamCounts] = React.useState({}); // { categoryId: počet tímov }

  // Načítanie kategórií + maxTeams
  React.useEffect(() => {
    if (availableCategoriesMap && Object.keys(availableCategoriesMap).length > 0) {
      const formattedCategories = {};
      Object.entries(availableCategoriesMap).forEach(([id, value]) => {
        if (typeof value === 'object' && value !== null && value.name) {
          formattedCategories[id] = value;
        } else if (typeof value === 'string') {
          formattedCategories[id] = { name: value };
        }
      });
      setCategoriesData(formattedCategories);
      setIsCategoriesLoaded(true);

      console.log("=== Maximálny počet tímov v jednotlivých kategóriách ===");
      Object.entries(formattedCategories).forEach(([id, cat]) => {
        const maxTeams = cat.maxTeams ?? "nie je definovaný";
        console.log(`Kategória: ${cat.name || "bez názvu"} | ID: ${id} | Max tímov: ${maxTeams}`);
      });
      console.log("======================================");
    } else if (availableCategoriesMap) {
      setCategoriesData({});
      setIsCategoriesLoaded(true);
      if (typeof setNotificationMessage === 'function') {
        setNotificationMessage('V systéme nie sú definované žiadne kategórie.');
        setShowNotification(true);
        setNotificationType('error');
      }
    } else {
      console.warn("availableCategoriesMap ešte nie je k dispozícii v Page3Form.");
    }

    if (!selectedCategoryRows || selectedCategoryRows.length === 0) {
      setSelectedCategoryRows([{ categoryId: '', teams: 1 }]);
    }
  }, [availableCategoriesMap]);

  // Načítanie aktuálneho počtu tímov z /users/
  React.useEffect(() => {
    if (!window.db) return;

    const usersCollectionRef = collection(window.db, 'users');

    const unsubscribe = onSnapshot(usersCollectionRef, (snapshot) => {
      const counts = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const teams = data.teams || {};

        Object.entries(teams).forEach(([catName, teamArray]) => {
          if (Array.isArray(teamArray)) {
            const count = teamArray.filter(Boolean).length;
            if (count > 0) {
              // Používame categoryName ako kľúč – ak máš ID inak, musíš mapovať
              counts[catName] = (counts[catName] || 0) + count;
            }
          }
        });
      });

      setCategoryTeamCounts(counts);
    });

    return () => unsubscribe();
  }, []);

  // Je kategória plná?
  const isCategoryFull = (catId) => {
    const current = categoryTeamCounts[catId] || 0;
    const max = categoriesData[catId]?.maxTeams ?? Infinity;
    return current >= max;
  };

  // Získanie dostupných kategórií pre konkrétny riadok (index)
const getAvailableCategoryOptions = (currentIndex = -1) => {
  const allCategoryIds = Object.keys(categoriesData);

  // Zoznam všetkých vybraných kategórií v INÝCH riadkoch (okrem aktuálneho riadku)
  const selectedInOtherRows = selectedCategoryRows
    .filter((_, idx) => idx !== currentIndex)           // vynechaj aktuálny riadok
    .map(row => row.categoryId)
    .filter(id => id);                                  // len neprázdne

  return allCategoryIds
    .filter(catId => {
      // 1. Ak je kategória plná → vylúč
      if (isCategoryFull(catId)) return false;

      // 2. Ak je už vybraná v inom riadku → vylúč (žiadne duplicity!)
      if (selectedInOtherRows.includes(catId)) return false;

      // Ak prejde oboma podmienkami → zobraz ju
      return true;
    })
    .map(catId => {
      const cat = categoriesData[catId];
      let name = cat?.name || "Bez názvu";
      const isFull = isCategoryFull(catId); // už vieme, že nie je plná, ale pre istotu
      const displayName = isFull ? `${name} (plná kapacita)` : name;

      return {
        id: catId,
        name: displayName,
        disabled: isFull,
        isFull: isFull,
        originalName: name
      };
    })
    .sort((a, b) => a.originalName.localeCompare(b.originalName));
};

  const handleCategoryChange = (index, value) => {
    setSelectedCategoryRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], categoryId: value };
      return next;
    });
  };

  const handleTeamsChange = (index, value) => {
    const num = parseInt(value, 10);
    setSelectedCategoryRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], teams: Math.max(1, num || 1) };
      return next;
    });
  };

  const handleAddRow = () => {
    const last = selectedCategoryRows[selectedCategoryRows.length - 1];
    if (last.categoryId && getAvailableCategoryOptions().length > 0) {
      setSelectedCategoryRows(prev => [...prev, { categoryId: '', teams: 1 }]);
    }
  };

  const handleRemoveRow = (index) => {
    setSelectedCategoryRows(prev => prev.filter((_, i) => i !== index));
  };

  const isFormValidPage3 = selectedCategoryRows.every(r => r.categoryId && r.teams >= 1);

  const hasAtLeastOneFreeCategory = Object.keys(categoriesData).some(catId => {
    return !isCategoryFull(catId);   // stačí, aby nebola plná – aj keby už bola vybraná
  });

  const isAnyCategoryUnselected = selectedCategoryRows.some(row => !row.categoryId);

  const nextButtonClasses = loading || !isRecaptchaReady || !isFormValidPage3
    ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
    : 'bg-blue-500 hover:bg-blue-700 text-white';

  return React.createElement(
  React.Fragment,
  null,

  React.createElement(NotificationModal, {
    message: notificationMessage,
    onClose: closeNotification,
    type: notificationType
  }),

  React.createElement(
    'h2',
    { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
    'Registrácia - strana 3'
  ),

  !isCategoriesLoaded ? (
    React.createElement('div', { className: 'text-center py-8' }, 'Načítavam kategórie...')
  ) : Object.keys(categoriesData).length === 0 ? (
    React.createElement(
      'div',
      { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md mx-auto text-center' },
      React.createElement(
        'p',
        { className: 'text-red-600 text-lg font-semibold' },
        'V systéme nie sú definované žiadne kategórie. Registrácia nie je možná.'
      )
    )
  ) : (
    React.createElement(
      'form',
      { onSubmit: handleNextPage3ToPage4, className: 'space-y-6' },
      React.createElement(
        'div',
        { className: 'flex items-center font-bold mb-3 space-x-4' },
        React.createElement('span', { className: 'flex-1 text-gray-700' }, 'Kategória'),
        React.createElement('span', { className: 'w-32 text-gray-700' }, 'Počet tímov'),
        React.createElement('span', { className: 'w-10' })
      ),

      // Ak existuje aspoň jedna voľná kategória → zobrazíme riadky
      hasAtLeastOneFreeCategory ? (
        React.createElement(
          React.Fragment,
          null,
          selectedCategoryRows.map((row, index) => {
            const options = getAvailableCategoryOptions(index);

            return React.createElement(
              'div',
              { key: index, className: 'flex flex-col space-y-1' },
              React.createElement(
                'div',
                { className: 'flex items-center space-x-3' },
                React.createElement(
                  'select',
                  {
                    className: 'shadow border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 flex-1',
                    value: row.categoryId,
                    onChange: (e) => handleCategoryChange(index, e.target.value),
                    required: true,
                    disabled: loading,
                    tabIndex: 22 + index * 2
                  },
                  React.createElement('option', { value: '' }, 'Vyberte kategóriu'),
                  options.map(cat => React.createElement(
                    'option',
                    {
                      key: cat.id,
                      value: cat.id,
                      disabled: cat.disabled
                    },
                    cat.name  // tu je názov + "(plná kapacita)" ak je plná
                  ))
                ),
                React.createElement('input', {
                  type: 'number',
                  min: 1,
                  value: row.teams,
                  onChange: (e) => handleTeamsChange(index, e.target.value),
                  required: true,
                  disabled: loading,
                  className: 'shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-32 text-center',
                  tabIndex: 23 + index * 2
                }),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    onClick: () => handleRemoveRow(index),
                    className: `bg-red-500 hover:bg-red-700 text-white font-bold w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200 focus:outline-none focus:shadow-outline ${selectedCategoryRows.length === 1 ? 'invisible' : ''}`,
                    disabled: loading || selectedCategoryRows.length === 1,
                    tabIndex: 24 + index * 2
                  },
                  '−'
                )
              ),

              // Červený text pod riadkom iba ak je aktuálne vybraná kategória plná
              row.categoryId && isCategoryFull(row.categoryId) && React.createElement(
                'p',
                { className: 'text-sm text-red-600 mt-1 ml-3' },
                'Kapacita turnaja v tejto kategórii je už naplnená.'
              )
            );
          }),

          // Tlačidlo na pridanie ďalšieho riadku
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleAddRow,
              disabled: loading || isAnyCategoryUnselected || getAvailableCategoryOptions().length === 0,
              className: `w-12 h-12 rounded-full text-2xl font-bold mx-auto block mt-6 transition-colors ${
                loading || isAnyCategoryUnselected || getAvailableCategoryOptions().length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`,
              tabIndex: 22 + selectedCategoryRows.length * 2
            },
            '+'
          )
        )
      ) : (
        // Ak sú všetky kategórie plné
        React.createElement(
          'div',
          { className: 'bg-red-50 p-8 rounded-lg text-center border border-red-200' },
          React.createElement(
            'p',
            { className: 'text-red-700 font-semibold text-xl' },
            'Všetky kategórie sú už plné. Registrácia nie je možná.'
          )
        )
      ),

      // Tlačidlá dole
      React.createElement(
        'div',
        { className: 'flex justify-between mt-10' },
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: handlePrev,
            disabled: loading,
            className: 'px-10 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 transition-colors',
            tabIndex: 20
          },
          'Späť'
        ),
        React.createElement(
          'button',
          {
            type: 'submit',
            disabled: loading || !isRecaptchaReady || !isFormValidPage3 || !hasAtLeastOneFreeCategory,
            className: `px-12 py-3 rounded-lg font-bold transition-colors ${
              loading || !isRecaptchaReady || !isFormValidPage3 || !hasAtLeastOneFreeCategory
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`,
            tabIndex: 21
          },
          loading ? React.createElement(
            'div',
            { className: 'flex items-center justify-center' },
            React.createElement('svg', {
              className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-white',
              xmlns: 'http://www.w3.org/2000/svg',
              fill: 'none',
              viewBox: '0 0 24 24'
            },
              React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
              React.createElement('path', {
                className: 'opacity-75',
                fill: 'currentColor',
                d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
              })
            ),
            'Ukladám...'
          ) : 'Ďalej'
        )
      )
    )
  )
);
}

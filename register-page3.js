import { collection, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function Page3Form({
  formData,
  handlePrev,
  handleNextPage3,               // ← toto je správny názov propsu z App.js
  loading,
  setLoading,
  setNotificationMessage,
  setShowNotification,
  setNotificationType,
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
  const [categoryTeamCounts, setCategoryTeamCounts] = React.useState({});

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

      // Výpis načítaných kategórií + aktuálne počty (ak už máme counts)
      console.log("=== NAČÍTANÉ KATEGÓRIE + AKTUÁLNY POČET TÍMOV ===");
      Object.entries(formattedCategories).forEach(([id, cat]) => {
        const catName = cat.name || "Bez názvu";
        const currentTeams = categoryTeamCounts[catName] || 0;
        const maxTeams = cat.maxTeams ?? "neurčené";
        console.log(`ID: ${id} | ${catName} | Max: ${maxTeams} | Aktuálne: ${currentTeams}`);
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
  }, [availableCategoriesMap, categoryTeamCounts]); // ← pridali sme categoryTeamCounts ako závislosť

React.useEffect(() => {
  if (!window.db) return;

  const usersCollectionRef = collection(window.db, 'users');

  const unsubscribe = onSnapshot(usersCollectionRef, (snapshot) => {
    const countsById = {}; // finálny objekt { catId: počet }

    // 1. Vytvoríme mapu názov → ID (z categoriesData)
    const nameToIdMap = {};
    Object.entries(categoriesData).forEach(([id, cat]) => {
      if (cat?.name) {
        nameToIdMap[cat.name.trim()] = id; // trim pre istotu
      }
    });

    // 2. Prechádzame všetky users dokumenty
    snapshot.forEach((doc) => {
      const data = doc.data();
      const teams = data.teams || {};

      Object.entries(teams).forEach(([catName, teamArray]) => {
        if (Array.isArray(teamArray)) {
          const count = teamArray.filter(Boolean).length;
          if (count > 0) {
            const catId = nameToIdMap[catName.trim()];
            if (catId) {
              // Ukladáme pod ID
              countsById[catId] = (countsById[catId] || 0) + count;
            } else {
              console.warn(`Nenašlo sa ID pre kategóriu s názvom: "${catName}"`);
            }
          }
        }
      });
    });

    setCategoryTeamCounts(countsById);

    // Výpis pre kontrolu
    console.log("%c=== AKTUALIZOVANÝ POČET TÍMOV (podľa ID) ===", "color: #0066cc; font-weight: bold;");
    if (Object.keys(countsById).length === 0) {
      console.log("Žiadne tímy.");
    } else {
      Object.entries(countsById).forEach(([catId, count]) => {
        const catName = categoriesData[catId]?.name || catId;
        console.log(`${catId} (${catName}) → ${count} tímov`);
      });
    }
    console.log("======================================");
  });

  return () => unsubscribe();
}, [categoriesData]); // závislosť na categoriesData, aby sa mapa aktualizovala

  // Je kategória plná?
  const isCategoryFull = (catId) => {
    const current = categoryTeamCounts[catId] || 0;
    const max = categoriesData[catId]?.maxTeams ?? Infinity;
    return current >= max;
  };

  // Zostávajúce tímy, ktoré ešte môže pridať
  const getRemainingTeamsForCategory = (catId) => {
    if (!catId) return Infinity;
    const current = categoryTeamCounts[catId] || 0;
    const max = categoriesData[catId]?.maxTeams ?? Infinity;
    return Math.max(0, max - current);
  };

  // Dostupné kategórie pre konkrétny riadok (bez duplicitných výberov)
  const getAvailableCategoryOptions = (currentIndex = -1) => {
    const allCategoryIds = Object.keys(categoriesData);
    const selectedInOtherRows = selectedCategoryRows
      .filter((_, idx) => idx !== currentIndex)
      .map(row => row.categoryId)
      .filter(id => id);

    return allCategoryIds
      .filter(catId => {
        if (isCategoryFull(catId)) return false;
        if (selectedInOtherRows.includes(catId)) return false;
        return true;
      })
      .map(catId => {
        const cat = categoriesData[catId];
        let name = cat?.name || "Bez názvu";
        const isFull = isCategoryFull(catId);
        const displayName = isFull ? `${name} (plná kapacita)` : name;
        return {
          id: catId,
          name: displayName,
          disabled: isFull,
          isFull,
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
    } else if (getAvailableCategoryOptions().length === 0) {
      setNotificationMessage?.('Nie je možné pridať ďalší tím – všetky kategórie sú už obsadené alebo plné.');
      setShowNotification?.(true);
      setNotificationType?.('error');
    }
  };

  const handleRemoveRow = (index) => {
    setSelectedCategoryRows(prev => prev.filter((_, i) => i !== index));
  };

  const isFormValid = selectedCategoryRows.every(r => {
    if (!r.categoryId || r.teams < 1) return false;
    const remaining = getRemainingTeamsForCategory(r.categoryId);
    return r.teams <= remaining;
  });

  const hasAtLeastOneFreeCategory = Object.keys(categoriesData).some(catId => !isCategoryFull(catId));

  const isAnyCategoryUnselected = selectedCategoryRows.some(row => !row.categoryId);

const nextButtonClasses = loading || !isRecaptchaReady || !isFormValid || !hasAtLeastOneFreeCategory
  ? 'px-12 py-3 rounded-lg font-bold transition-colors bg-white text-green-700 border-2 border-green-600 cursor-not-allowed'
  : 'px-12 py-3 rounded-lg font-bold transition-colors bg-green-600 hover:bg-green-700 text-white';

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
        {
          onSubmit: (e) => {
            e.preventDefault();
            if (!isFormValid) {
              setNotificationMessage?.('Prosím, skontrolujte vybrané kategórie a počty tímov – niektoré prekročili kapacitu alebo nie sú vyplnené.');
              setShowNotification?.(true);
              setNotificationType?.('error');
              return;
            }
            handleNextPage3(selectedCategoryRows);  // ← správne volanie!
          },
          className: 'space-y-6'
        },
        React.createElement(
          'div',
          { className: 'flex items-center font-bold mb-3 space-x-4' },
          React.createElement('span', { className: 'flex-1 text-gray-700' }, 'Kategória'),
          React.createElement('span', { className: 'w-32 text-gray-700' }, 'Počet tímov'),
          React.createElement('span', { className: 'w-10' })
        ),
        hasAtLeastOneFreeCategory ? (
          React.createElement(
            React.Fragment,
            null,
            selectedCategoryRows.map((row, index) => {
              const options = getAvailableCategoryOptions(index);
              const selectedCatId = row.categoryId;
              const remaining = getRemainingTeamsForCategory(selectedCatId);
              const requested = parseInt(row.teams, 10) || 0;
              const isOverLimit = selectedCatId && remaining < requested && requested > 0;

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
                      { key: cat.id, value: cat.id, disabled: cat.disabled },
                      cat.name
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
                isOverLimit && React.createElement(
                  'p',
                  { className: 'text-sm text-red-600 mt-1 ml-3' },
                  `Pozor: v tejto kategórii už je prihlásených ${categoryTeamCounts[selectedCatId] || 0} tímov. `,
                  `Maximálna kapacita je ${categoriesData[selectedCatId]?.maxTeams ?? 'neurčená'}. `,
                  `Môžete prihlásiť maximálne ${remaining} tím${remaining === 1 ? '' : 'ov'}.`
                ),
                row.categoryId && isCategoryFull(row.categoryId) && React.createElement(
                  'p',
                  { className: 'text-sm text-red-600 mt-1 ml-3' },
                  'Kapacita turnaja v tejto kategórii je už naplnená.'
                )
              );
            }),
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
              disabled: loading || !isRecaptchaReady || !isFormValid || !hasAtLeastOneFreeCategory,
              className: nextButtonClasses,
              tabIndex: 21
            },
            loading ? React.createElement(
              'div',
              { className: 'flex items-center justify-center' },
              React.createElement('svg', {
                className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-current',  // text-current = farba podľa rodiča (tu green-700)
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

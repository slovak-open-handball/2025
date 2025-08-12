// register-page3.js
// Obsahuje komponenty a logiku pre tretiu (finálnu) stránku registračného formulára.

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Funkcia na získanie reCAPTCHA tokenu (prevzatá z register.js)
// Konštanty sú definované globálne v register.html
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa"; // Je definovaný aj globálne, ale pre istotu znova tu
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

// Page3Form Component
export function Page3Form({ formData, handlePrev, handleSubmit, loading, setLoading, setNotificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, NotificationModal, notificationMessage, closeNotification, availableCategoriesMap }) { // Pridaný availableCategoriesMap
  const [categoriesData, setCategoriesData] = React.useState({}); // Objekt pre kategórie (kľúč: id, hodnota: názov)
  const [selectedCategoryRows, setSelectedCategoryRows] = React.useState([{ categoryId: '', teams: 1 }]);
  const [isCategoriesLoaded, setIsCategoriesLoaded] = React.useState(false);

  // Načítanie kategórií z Firestore
  // Tento useEffect už nebude načítavať kategórie, ale použije tie, ktoré dostane z props
  React.useEffect(() => {
    if (availableCategoriesMap && Object.keys(availableCategoriesMap).length > 0) {
      setCategoriesData(availableCategoriesMap);
      setIsCategoriesLoaded(true);
      console.log("Kategórie prijaté z props:", availableCategoriesMap);
    } else if (availableCategoriesMap) { // Ak je prázdny objekt, znamená to, že neboli nájdené žiadne kategórie
      setCategoriesData({});
      setIsCategoriesLoaded(true);
      // Pridávame defenzívnu kontrolu pred volaním
      if (typeof setNotificationMessage === 'function') {
        setNotificationMessage('V systéme nie sú definované žiadne kategórie.');
        setShowNotification(true);
        setNotificationType('error');
      }
    } else { // Ak availableCategoriesMap ešte nie je definované, znamená to, že sa načítava
      // Toto by sa nemalo stať, ak je App.js správne
      console.warn("availableCategoriesMap ešte nie je k dispozícii v Page3Form.");
    }
  }, [availableCategoriesMap, setNotificationMessage, setShowNotification, setNotificationType]); // Pridané závislosti pre setters


  // Handler pre zmenu vybranej kategórie v riadku
  const handleCategoryChange = (index, value) => {
    setSelectedCategoryRows(prevRows => {
      const newRows = [...prevRows];
      newRows[index].categoryId = value;
      return newRows;
    });
  };

  // Handler pre zmenu počtu tímov v riadku
  const handleTeamsChange = (index, value) => {
    const numValue = parseInt(value, 10);
    setSelectedCategoryRows(prevRows => {
      const newRows = [...prevRows];
      newRows[index].teams = Math.max(1, numValue || 1); // Minimálne 1 tím
      return newRows;
    });
  };

  // Handler pre pridanie nového riadku
  const handleAddRow = () => {
    // Len ak existujú nevybraté kategórie a posledný riadok je platný
    if (getAvailableCategoryOptions().length > 0 && selectedCategoryRows[selectedCategoryRows.length - 1].categoryId !== '') {
      setSelectedCategoryRows(prevRows => [...prevRows, { categoryId: '', teams: 1 }]);
    }
  };

  // Handler pre odstránenie riadku
  const handleRemoveRow = (indexToRemove) => {
    setSelectedCategoryRows(prevRows => prevRows.filter((_, index) => index !== indexToRemove));
  };

  // Funkcia na získanie dostupných kategórií pre selectbox
  const getAvailableCategoryOptions = (currentIndex = -1) => {
    const allCategoryIds = Object.keys(categoriesData);
    const selectedIdsInOtherRows = selectedCategoryRows
      .filter((row, idx) => idx !== currentIndex && row.categoryId !== '')
      .map(row => row.categoryId);

    return allCategoryIds
      .filter(catId => !selectedIdsInOtherRows.includes(catId))
      .map(catId => ({ id: catId, name: categoriesData[catId] })); // Predpokladáme, že categoriesData[catId] je názov
  };

  // Overenie platnosti formulára pre stranu 3
  const isFormValidPage3 = selectedCategoryRows.every(row => row.categoryId !== '' && row.teams >= 1);
  // NOVINKA: Kontrola, či je posledný riadok platný (vybratá kategória)
  const isLastRowCategorySelected = selectedCategoryRows.length > 0 ? selectedCategoryRows[selectedCategoryRows.length - 1].categoryId !== '' : false;

  // Dynamické triedy pre tlačidlo "Registrovať sa"
  const registerButtonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
    ${loading || !isRecaptchaReady || !isFormValidPage3
      ? 'bg-white text-green-500 border border-green-500 cursor-not-allowed' // Zakázaný stav
      : 'bg-green-500 hover:bg-green-700 text-white' // Aktívny stav
    }
  `;

  // Dynamické triedy pre tlačidlo "+"
  const addButtonClasses = `
    font-bold w-10 h-10 rounded-full flex items-center justify-center mx-auto mt-4 transition-colors duration-200 focus:outline-none focus:shadow-outline
    ${loading || getAvailableCategoryOptions().length === 0 || !isLastRowCategorySelected // Zmenená podmienka disable
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' // Zakázaný stav: biele pozadie, modrý text a border, no-drop kurzor
      : 'bg-blue-500 hover:bg-blue-700 text-white' // Aktívny stav
    }
  `;

  // Handler pre finálne odoslanie formulára z Page3
  const handlePage3Submit = async (e) => {
    e.preventDefault();
    // Pridávame defenzívnu kontrolu pred volaním
    if (typeof setLoading === 'function') setLoading(true); // Nastavíme loading stav
    if (typeof setNotificationMessage === 'function') setNotificationMessage(''); // Vyčistíme notifikácie
    if (typeof setShowNotification === 'function') setShowNotification(false);
    if (typeof setNotificationType === 'function') setNotificationType('info');

    // Validácia, či sú všetky vybraté kategórie a počet tímov platné
    if (!isFormValidPage3) {
      if (typeof setNotificationMessage === 'function') {
        setNotificationMessage('Prosím, vyberte kategóriu pre každý riadok a zadajte platný počet tímov (minimálne 1).');
        setShowNotification(true);
        setNotificationType('error');
      }
      if (typeof setLoading === 'function') setLoading(false);
      return;
    }

    // Transformácia selectedCategoryRows do požadovaného formátu
    const categoriesToSave = {};
    selectedCategoryRows.forEach(row => {
      if (row.categoryId && row.teams) {
        // Použijeme názov kategórie ako kľúč a vnútri numberOfTeams
        const categoryName = availableCategoriesMap[row.categoryId] || row.categoryId; // Získame názov z mapy
        categoriesToSave[categoryName] = {
          numberOfTeams: row.teams
        };
      }
    });

    // Zavoláme handleSubmit prop (čo je handleFinalSubmit z App.js) a odovzdáme mu dáta
    await handleSubmit(categoriesToSave); // ODOSIELAME DÁTA
    if (typeof setLoading === 'function') setLoading(false); // Reset loading stavu po dokončení
  };


  // Renderovanie formulára
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: "error" }),

    React.createElement(
      'h2',
      { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
      'Registrácia - strana 3' // Zmenený nadpis
    ),
    React.createElement(
      'form',
      { onSubmit: handlePage3Submit, className: 'space-y-4' }, // handleSubmit je prop z App.js

      !isCategoriesLoaded ? (
        React.createElement('div', { className: 'text-center py-8' }, 'Načítavam kategórie...')
      ) : Object.keys(categoriesData).length === 0 ? (
        React.createElement(
          'div',
          { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center' },
          React.createElement(
            'p',
            { className: 'text-red-600 text-lg font-semibold' },
            'V systéme nie sú definované žiadne kategórie. Registrácia nie je možná.'
          )
        )
      ) : (
        React.createElement(
          'div',
          { className: 'space-y-4' },
          selectedCategoryRows.map((row, index) => (
            React.createElement(
              'div',
              { key: index, className: 'flex items-center space-x-2' },
              React.createElement(
                'select',
                {
                  className: 'shadow border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 flex-grow',
                  value: row.categoryId,
                  onChange: (e) => handleCategoryChange(index, e.target.value),
                  required: true,
                  disabled: loading,
                  tabIndex: 22 + index * 2 // Dynamický tabIndex
                },
                React.createElement('option', { value: '' }, 'Vyberte kategóriu'),
                getAvailableCategoryOptions(index).map(cat => (
                  React.createElement('option', { key: cat.id, value: cat.id }, cat.name)
                ))
              ),
              React.createElement('input', {
                type: 'number',
                className: 'shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-20 text-center',
                value: row.teams,
                onChange: (e) => handleTeamsChange(index, e.target.value),
                min: 1,
                required: true,
                disabled: loading,
                tabIndex: 23 + index * 2 // Dynamický tabIndex
              }),
              selectedCategoryRows.length > 1 && React.createElement( // Zobraziť tlačidlo mínus len ak je viac ako jeden riadok
                'button',
                {
                  type: 'button',
                  onClick: () => handleRemoveRow(index),
                  className: 'bg-red-500 hover:bg-red-700 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 focus:outline-none focus:shadow-outline',
                  disabled: loading,
                  tabIndex: 24 + index * 2 // Dynamický tabIndex
                },
                '-'
              )
            )
          )),
          // Tlačidlo "+"
          getAvailableCategoryOptions().length > 0 && React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleAddRow,
              className: addButtonClasses, // Použitie dynamických tried
              disabled: loading || !isLastRowCategorySelected || getAvailableCategoryOptions().length === 0, // Zmenená podmienka disable
              tabIndex: 22 + selectedCategoryRows.length * 2 // Nový tabIndex pre tlačidlo "+"
            },
            '+'
          )
        )
      ),

      React.createElement(
        'div',
        { className: 'flex justify-between mt-6' },
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: handlePrev,
            className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
            disabled: loading,
            tabIndex: 20 // Nový tabIndex
          },
          'Späť'
        ),
        React.createElement(
          'button',
          {
            type: 'submit',
            className: registerButtonClasses,
            disabled: loading || !isRecaptchaReady || !isFormValidPage3 || Object.keys(categoriesData).length === 0, // Zmenená podmienka disable
            tabIndex: 21 // Nový tabIndex
          },
          loading ? React.createElement(
            'div',
            { className: 'flex items-center justify-center' },
            React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-green-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
              React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
              React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
            ),
            'Registrujem...'
          ) : 'Registrovať sa'
        )
      )
    )
  );
}

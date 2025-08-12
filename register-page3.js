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

export function Page3Form({ formData, handlePrev, handleNextPage3, loading, setLoading, setNotificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, NotificationModal, notificationMessage, closeNotification, availableCategoriesMap, selectedCategoryRows, setSelectedCategoryRows }) {
  const [categoriesData, setCategoriesData] = React.useState({});
  const [isCategoriesLoaded, setIsCategoriesLoaded] = React.useState(false);

  React.useEffect(() => {
    if (availableCategoriesMap && Object.keys(availableCategoriesMap).length > 0) {
      setCategoriesData(availableCategoriesMap);
      setIsCategoriesLoaded(true);
      console.log("Kategórie prijaté z props:", availableCategoriesMap);
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
  }, [availableCategoriesMap, setNotificationMessage, setShowNotification, setNotificationType, selectedCategoryRows, setSelectedCategoryRows]);

  const handleCategoryChange = (index, value) => {
    setSelectedCategoryRows(prevRows => {
      const newRows = [...prevRows];
      newRows[index].categoryId = value;
      return newRows;
    });
  };

  const handleTeamsChange = (index, value) => {
    const numValue = parseInt(value, 10);
    setSelectedCategoryRows(prevRows => {
      const newRows = [...prevRows];
      newRows[index].teams = Math.max(1, numValue || 1);
      return newRows;
    });
  };

  const handleAddRow = () => {
    if (getAvailableCategoryOptions().length > 0 && selectedCategoryRows[selectedCategoryRows.length - 1].categoryId !== '') {
      setSelectedCategoryRows(prevRows => [...prevRows, { categoryId: '', teams: 1 }]);
    }
  };

  const handleRemoveRow = (indexToRemove) => {
    setSelectedCategoryRows(prevRows => prevRows.filter((_, index) => index !== indexToRemove));
  };

  const getAvailableCategoryOptions = (currentIndex = -1) => {
    const allCategoryIds = Object.keys(categoriesData);
    const selectedIdsInOtherRows = selectedCategoryRows
      .filter((row, idx) => idx !== currentIndex && row.categoryId !== '')
      .map(row => row.categoryId);

    return allCategoryIds
      .filter(catId => !selectedIdsInOtherRows.includes(catId))
      .map(catId => ({ id: catId, name: categoriesData[catId] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const isFormValidPage3 = selectedCategoryRows.every(row => row.categoryId !== '' && row.teams >= 1);
  const isLastRowCategorySelected = selectedCategoryRows.length > 0 ? selectedCategoryRows[selectedCategoryRows.length - 1].categoryId !== '' : false;

  // NOVINKA: Kontrola, či je niektorá kategória nevybratá
  const isAnyCategoryUnselected = React.useMemo(() => {
    return selectedCategoryRows.some(row => row.categoryId === '');
  }, [selectedCategoryRows]);

  const nextButtonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
    ${loading || !isRecaptchaReady || !isFormValidPage3 || Object.keys(categoriesData).length === 0
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
      : 'bg-blue-500 hover:bg-blue-700 text-white'
    }
  `;

  const addButtonClasses = `
    font-bold w-10 h-10 rounded-full flex items-center justify-center mx-auto mt-4 transition-colors duration-200 focus:outline-none focus:shadow-outline
    ${loading || getAvailableCategoryOptions().length === 0 || isAnyCategoryUnselected // Zmenená podmienka disable
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
      : 'bg-blue-500 hover:bg-blue-700 text-white'
    }
  `;

  const handleNextPage3ToPage4 = async (e) => {
    e.preventDefault();
    if (typeof setLoading === 'function') setLoading(true);
    if (typeof setNotificationMessage === 'function') setNotificationMessage('');
    if (typeof setShowNotification === 'function') setShowNotification(false);
    if (typeof setNotificationType === 'function') setNotificationType('info');

    if (!isFormValidPage3) {
      if (typeof setNotificationMessage === 'function') {
        setNotificationMessage('Prosím, vyberte kategóriu pre každý riadok a zadajte platný počet tímov (minimálne 1).');
        setShowNotification(true);
        setNotificationType('error');
      }
      if (typeof setLoading === 'function') setLoading(false);
      return;
    }

    await handleNextPage3(selectedCategoryRows);
    if (typeof setLoading === 'function') setLoading(false);
  };

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: "error" }),

    React.createElement(
      'h2',
      { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
      'Registrácia - strana 3'
    ),
    React.createElement(
      'form',
      { onSubmit: handleNextPage3ToPage4, className: 'space-y-4' },

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
          React.createElement(
            'div',
            { className: 'flex items-center font-bold mb-2 space-x-2' },
            React.createElement('span', { className: 'flex-1 text-gray-700' }, 'Kategória'),
            React.createElement('span', { className: 'w-28 text-left text-gray-700' }, 'Počet tímov'),
            React.createElement('span', { className: 'w-8' })
          ),
          selectedCategoryRows.map((row, index) => (
            React.createElement(
              'div',
              { key: index, className: 'flex items-center space-x-2' },
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
                getAvailableCategoryOptions(index).map(cat => (
                  React.createElement('option', { key: cat.id, value: cat.id }, cat.name)
                ))
              ),
              React.createElement('input', {
                type: 'number',
                className: 'shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-28 text-left',
                value: row.teams,
                onChange: (e) => handleTeamsChange(index, e.target.value),
                min: 1,
                required: true,
                disabled: loading,
                tabIndex: 23 + index * 2
              }),
              React.createElement(
                'button',
                {
                  type: 'button',
                  onClick: () => handleRemoveRow(index),
                  className: `bg-red-500 hover:bg-red-700 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 focus:outline-none focus:shadow-outline ${selectedCategoryRows.length === 1 ? 'invisible' : ''}`,
                  disabled: loading || selectedCategoryRows.length === 1,
                  tabIndex: 24 + index * 2
                },
                '-'
              )
            )
          )),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleAddRow,
              className: addButtonClasses,
              disabled: loading || isAnyCategoryUnselected || getAvailableCategoryOptions().length === 0, // Zmenená podmienka disable
              tabIndex: 22 + selectedCategoryRows.length * 2
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
            tabIndex: 20
          },
          'Späť'
        ),
        React.createElement(
          'button',
          {
            type: 'submit',
            className: nextButtonClasses,
            disabled: loading || !isRecaptchaReady || !isFormValidPage3 || Object.keys(categoriesData).length === 0,
            tabIndex: 21
          },
          loading ? React.createElement(
            'div',
            { className: 'flex items-center justify-center' },
            React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
              React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
              React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
            ),
            'Ďalej...'
          ) : 'Ďalej'
        )
      )
    )
  );
}

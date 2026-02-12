// logged-in-tournament-settings.js (hlavný súbor - upravený)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, Timestamp, updateDoc, arrayUnion, arrayRemove, getDoc, collection, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ... (všetky pomocné funkcie zostávajú rovnaké) ...

function TournamentSettingsApp() {
  const app = initializeApp(window.firebaseConfig);
  const auth = getAuth(app); 
  const db = getFirestore(app);     

  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 

  const [tournamentStartDate, setTournamentStartDate] = React.useState('');
  const [tournamentEndDate, setTournamentEndDate] = React.useState('');
  const [activeSetting, setActiveSetting] = React.useState(null);
  const [activeCategoryId, setActiveCategoryId] = React.useState(null); // Nový stav pre kategóriu

  const settingComponents = [
    { id: 'general', title: 'Všeobecné nastavenia registrácie', component: GeneralRegistrationSettings },
    { id: 'tshirt', title: 'Nastavenia veľkostí tričiek', component: TShirtSizeSettings },
    { id: 'accommodation', title: 'Nastavenia ubytovania', component: AccommodationSettings },
    { id: 'package', title: 'Nastavenia balíčkov', component: PackageSettings },
    { id: 'categories', title: 'Nastavenia kategórií', component: CategorySettings },
  ];

  // Funkcia na aktualizáciu URL hashu - HIERARCHICKÝ FORMÁT
  const updateUrlHash = (settingId, categoryId = null) => {
    if (settingId && categoryId) {
      window.location.hash = `${settingId}/category-${categoryId}`;
    } else if (settingId) {
      window.location.hash = settingId;
    } else {
      window.location.hash = '';
    }
  };

  // Funkcia na získanie nastavenia z URL hashu
  const getSettingFromHash = () => {
    const hash = window.location.hash.slice(1); // Odstránime #
    if (!hash) return null;
    
    // Rozparsujeme hash na časti
    const parts = hash.split('/');
    const settingId = parts[0];
    
    if (settingId && settingComponents.some(s => s.id === settingId)) {
      return settingId;
    }
    return null;
  };

  // Funkcia na získanie ID kategórie z URL hashu
  const getCategoryIdFromHash = () => {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    
    const parts = hash.split('/');
    if (parts.length > 1 && parts[1].startsWith('category-')) {
      return parts[1].replace('category-', '');
    }
    return null;
  };

  // Handler pre zmenu aktívneho nastavenia
  const handleSetActiveSetting = (settingId) => {
    setActiveSetting(settingId);
    setActiveCategoryId(null);
    updateUrlHash(settingId);
  };

  // Handler pre návrat na hlavnú stránku
  const handleBackToMain = () => {
    setActiveSetting(null);
    setActiveCategoryId(null);
    updateUrlHash(null);
  };

  // Handler pre výber kategórie (bude volaný z CategorySettings)
  const handleSelectCategory = (categoryId) => {
    setActiveCategoryId(categoryId);
    updateUrlHash('categories', categoryId);
  };

  // Načítanie nastavenia z URL pri inicializácii
  React.useEffect(() => {
    if (isAuthReady && userProfileData?.role === 'admin') {
      const settingFromHash = getSettingFromHash();
      const categoryFromHash = getCategoryIdFromHash();
      
      if (settingFromHash) {
        setActiveSetting(settingFromHash);
        if (settingFromHash === 'categories' && categoryFromHash) {
          setActiveCategoryId(categoryFromHash);
        }
      }
    }
  }, [isAuthReady, userProfileData]);

  // Reakcia na zmenu URL hashu
  React.useEffect(() => {
    const handleHashChange = () => {
      if (isAuthReady && userProfileData?.role === 'admin') {
        const settingFromHash = getSettingFromHash();
        const categoryFromHash = getCategoryIdFromHash();
        
        setActiveSetting(settingFromHash);
        if (settingFromHash === 'categories' && categoryFromHash) {
          setActiveCategoryId(categoryFromHash);
        } else {
          setActiveCategoryId(null);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAuthReady, userProfileData]);

  // ... (zvyšok kódu zostáva rovnaký) ...

  return React.createElement(
    'div',
    { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl mx-auto space-y-8' }, 
    React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
      'Nastavenia turnaja'
    ),
    
    activeSetting ? (
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'div',
          { className: 'flex items-center mb-4' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleBackToMain,
              className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 flex items-center'
            },
            React.createElement('svg', { className: 'h-4 w-4 mr-2', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
              React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10 19l-7-7m0 0l7-7m-7 7h18' })
            ),
            'Späť'
          )
        ),
        React.createElement(
          settingComponents.find(s => s.id === activeSetting).component,
          {
            db: db,
            userProfileData: userProfileData,
            tournamentStartDate: tournamentStartDate,
            setTournamentStartDate: setTournamentStartDate,
            tournamentEndDate: tournamentEndDate,
            setTournamentEndDate: setTournamentEndDate,
            showNotification: showNotification,
            sendAdminNotification: (notificationData) => sendAdminNotification(db, auth, notificationData),
            formatDateForDisplay: formatDateForDisplay,
            formatToDatetimeLocal: formatToDatetimeLocal,
            // Nové props pre CategorySettings
            initialCategoryId: activeSetting === 'categories' ? activeCategoryId : null,
            onSelectCategory: handleSelectCategory,
          }
        )
      )
    ) : (
      React.createElement(
        'div',
        { className: 'space-y-4' },
        settingComponents.map(setting => (
          React.createElement(
            'button',
            {
              key: setting.id,
              onClick: () => handleSetActiveSetting(setting.id),
              className: 'w-full text-left bg-blue-500 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg shadow-md transition-colors duration-200 text-xl'
            },
            setting.title
          )
        ))
      )
    )
  );
}

window.TournamentSettingsApp = TournamentSettingsApp;

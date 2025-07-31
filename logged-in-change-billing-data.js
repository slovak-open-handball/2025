// logged-in-change-billing-data.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-change-billing-data.html
// a GlobalNotificationHandler v header.js spravuje globálnu autentifikáciu a stav používateľa.

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
// Ponechané pre zobrazovanie správ o spätnej väzbe pre používateľa v tomto module.
function NotificationModal({ message, onClose, type = 'info' }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    if (message) {
      setShow(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 500);
      }, 10000);
    } else {
      setShow(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [message, onClose]);

  if (!show && !message) return null;

  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-[#3A8D41]'; // Zelená
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Červená
  } else {
    bgColorClass = 'bg-blue-500'; // Predvolená modrá pre info
  }

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: { pointerEvents: 'none' }
    },
    React.createElement(
      'div',
      {
        className: `${bgColorClass} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center`,
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// Main React component for the logged-in-change-billing-data.html page
function ChangeBillingDataApp() {
  // NOVÉ: Získame referencie na Firebase služby priamo
  const app = firebase.app();
  const auth = firebase.auth(app);
  const db = firebase.firestore(app);

  // NOVÉ: Lokálny stav pre aktuálneho používateľa a jeho profilové dáta
  // Tieto stavy budú aktualizované lokálnym onAuthStateChanged a onSnapshot
  const [user, setUser] = React.useState(auth.currentUser); // Inicializovať s aktuálnym používateľom
  const [userProfileData, setUserProfileData] = React.useState(null); 

  const [loading, setLoading] = React.useState(true); // Loading pre dáta v ChangeBillingDataApp
  const [error, setError] = React.useState('');
  // PONECHANÉ: userNotificationMessage pre lokálne notifikácie
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // States for billing data
  const [clubName, setClubName] = React.useState('');
  const [ico, setIco] = React.useState('');
  const [dic, setDic] = React.useState('');
  const [icDph, setIcDph] = React.useState('');
  // States for address
  const [street, setStreet] = React.useState('');
  const [houseNumber, setHouseNumber] = React.useState('');
  const [city, setCity] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');
  const [country, setCountry] = React.useState('');

  // States for validation errors
  const [icoError, setIcoError] = React.useState('');
  const [dicError, setDicError] = React.useState('');
  const [icDphError, setIcDphError] = React.useState('');
  const [postalCodeError, setPostalCodeError] = React.useState('');

  // NOVINKA: Stav pre dátum uzávierky úprav dát
  const [dataEditDeadline, setDataEditDeadline] = React.useState(null);
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // Zabezpečíme, že appId je definované (používame globálnu premennú)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  // NOVINKA: Memoizovaná hodnota pre povolenie úprav dát
  const isDataEditingAllowed = React.useMemo(() => {
    if (!settingsLoaded || !dataEditDeadline) return true; // Ak nastavenia nie sú načítané alebo dátum nie je definovaný, povoliť úpravy
    const now = new Date();
    const deadline = new Date(dataEditDeadline);
    return now <= deadline;
  }, [settingsLoaded, dataEditDeadline]);

  // NOVÉ: Lokálny Auth Listener pre ChangeBillingDataApp
  // Tento listener zabezpečí, že ChangeBillingDataApp reaguje na zmeny autentifikácie,
  // ale primárne odhlásenie/presmerovanie spravuje GlobalNotificationHandler.
  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      console.log("ChangeBillingDataApp: Lokálny onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
      setUser(currentUser);
      // Ak používateľ nie je prihlásený, presmerujeme ho (aj keď by to mal spraviť GNH)
      if (!currentUser) {
        console.log("ChangeBillingDataApp: Používateľ nie je prihlásený, presmerovávam na login.html.");
        window.location.href = 'login.html';
      }
    });
    return () => unsubscribeAuth();
  }, [auth]); // Závisí od auth inštancie

  // NOVÉ: Lokálny Effect pre načítanie používateľských dát z Firestore
  // Tento efekt sa spustí, keď je používateľ prihlásený a db je k dispozícii.
  // Predpokladá sa, že passwordLastChanged a approved status sú už overené v header.js.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db) { // Spustí sa len ak je používateľ prihlásený a db je k dispozícii
      console.log(`ChangeBillingDataApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      setLoading(true); // Nastavíme loading na true, kým sa načítajú dáta profilu

      try {
        const userDocRef = db.collection('users').doc(user.uid);
        unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
          if (docSnapshot.exists) {
            const userData = docSnapshot.data();
            console.log("ChangeBillingDataApp: Používateľský dokument existuje, dáta:", userData);

            // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
            // Toto je pridaná logika, ktorá sa spustí hneď po načítaní dát.
            // Ak je passwordLastChanged neplatný alebo chýba, odhlásiť.
            if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                console.error("ChangeBillingDataApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                console.log("ChangeBillingDataApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
                auth.signOut(); // Používame auth z React stavu
                window.location.href = 'login.html';
                localStorage.removeItem(`passwordLastChanged_${user.uid}`); // Vyčistíme localStorage
                setUser(null); // Explicitne nastaviť user na null
                setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                return; // Zastaviť ďalšie spracovanie
            }

            // Normálne spracovanie, ak je passwordLastChanged platný
            const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
            const localStorageKey = `passwordLastChanged_${user.uid}`;
            let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

            console.log(`ChangeBillingDataApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Uložené: ${storedPasswordChangedTime}`);

            if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                // Prvé načítanie pre tohto používateľa/prehliadač, inicializuj localStorage a NEODHLASUJ
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("ChangeBillingDataApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
                // Nepokračujeme tu, pokračujeme s normálnym spracovaním dát pre prvé načítanie
            } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                // Heslo bolo zmenené na inom zariadení/relácii
                console.log("ChangeBillingDataApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                auth.signOut(); // Používame auth z React stavu
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey); // Vyčistiť localStorage po odhlásení
                setUser(null); // Explicitne nastaviť user na null
                setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                return;
            } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                // Toto by sa ideálne nemalo stať, ak je Firestore zdrojom pravdy
                console.warn("ChangeBillingDataApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                auth.signOut(); // Používame auth z React stavu
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey);
                setUser(null); // Explicitne nastaviť user na null
                setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                return;
            } else {
                // Časy sú rovnaké, zabezpečte, aby bol localStorage aktuálny
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("ChangeBillingDataApp: Timestampy sú rovnaké, aktualizujem localStorage.");
            }

            // NOVÁ LOGIKA: Odhlásenie, ak je používateľ admin a nie je schválený
            if (userData.role === 'admin' && userData.approved === false) {
                console.log("ChangeBillingDataApp: Používateľ je admin a nie je schválený. Odhlasujem.");
                auth.signOut();
                window.location.href = 'login.html';
                setUser(null); // Explicitne nastaviť user na null
                setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                return; // Zastav ďalšie spracovanie
            }

            setUserProfileData(userData); // Aktualizujeme stav userProfileData
            
            // Set billing data states
            setClubName(userData.billing?.clubName || '');
            setIco(userData.billing?.ico || '');
            setDic(userData.billing?.dic || '');
            setIcDph(userData.billing?.icDph || '');
            // NAČÍTANIE HODNÔT ADRESY Z userProfileData
            setStreet(userData.street || '');
            setHouseNumber(userData.houseNumber || '');
            setCity(userData.city || '');
            // Automaticky formátovať PSČ po načítaní
            setPostalCode(formatAndValidatePostalCode(userData.postalCode || '').formattedValue);
            setCountry(userData.country || '');


            setLoading(false); // Zastavíme načítavanie po načítaní používateľských dát
            setError(''); // Vymazať chyby po úspešnom načítaní

            // Aktualizácia viditeľnosti menu po načítaní roly (volanie globálnej funkcie z left-menu.js)
            if (typeof window.updateMenuItemsVisibility === 'function') {
                window.updateMenuItemsVisibility(userData.role);
            } else {
                console.warn("ChangeBillingDataApp: Funkcia updateMenuItemsVisibility nie je definovaná.");
            }

            console.log("ChangeBillingDataApp: Načítanie používateľských dát dokončené, loading: false");
          } else {
            console.warn("ChangeBillingDataApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
            setLoading(false); // Zastaví načítavanie, aby sa zobrazila chyba
            setUser(null); // Explicitne nastaviť user na null
            setUserProfileData(null); // Explicitne nastaviť userProfileData na null
          }
        }, error => {
          console.error("ChangeBillingDataApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          if (error.code === 'permission-denied') {
              setError(`Chyba oprávnení: Nemáte prístup k svojmu profilu. Skúste sa prosím znova prihlásiť alebo kontaktujte podporu.`);
          } else if (error.code === 'unavailable') {
              setError(`Chyba pripojenia: Služba Firestore je nedostupná. Skúste to prosím neskôr.`);
          } else if (error.code === 'unauthenticated') {
               setError(`Chyba autentifikácie: Nie ste prihlásený. Skúste sa prosím znova prihlásiť.`);
               if (auth) {
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
               }
          } else {
              setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
          }
          setLoading(false); // Zastaví načítavanie aj pri chybe
          console.log("ChangeBillingDataApp: Načítanie používateľských dát zlyhalo, loading: false");
          setUser(null); // Explicitne nastaviť user na null
          setUserProfileData(null); // Explicitne nastaviť userProfileData na null
        });
      } catch (e) {
        console.error("ChangeBillingDataApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
        setLoading(false); // Zastaví načítavanie aj pri chybe
        setUser(null); // Explicitne nastaviť user na null
        setUserProfileData(null); // Explicitne nastaviť userProfileData na null
      }
    } else if (user === null) {
        // Ak je user null (a už nie undefined), znamená to, že bol odhlásený.
        // Presmerovanie už by mal spraviť GlobalNotificationHandler.
        // Tu len zabezpečíme, že loading je false a dáta sú vyčistené.
        setLoading(false);
        setUserProfileData(null);
    }

    return () => {
      // Zrušíme odber onSnapshot pri unmount
      if (unsubscribeUserDoc) {
        console.log("ChangeBillingDataApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, auth]); // Závisí od user a db (a auth pre signOut)

  // NOVINKA: Effect pre načítanie nastavení (dátum uzávierky úprav)
  React.useEffect(() => {
    let unsubscribeSettings;
    const fetchSettings = async () => {
      if (!db) {
        console.log("ChangeBillingDataApp: Čakám na DB pre načítanie nastavení.");
        return;
      }
      try {
          console.log("ChangeBillingDataApp: Pokúšam sa načítať nastavenia registrácie pre dátum uzávierky.");
          const settingsDocRef = db.collection('settings').doc('registration');
          unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            console.log("ChangeBillingDataApp: onSnapshot pre nastavenia registrácie spustený.");
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                console.log("ChangeBillingDataApp: Nastavenia registrácie existujú, dáta:", data);
                setDataEditDeadline(data.dataEditDeadline ? data.dataEditDeadline.toDate().toISOString() : null); // Používame ISO string pre konzistentnosť
            } else {
                console.log("ChangeBillingDataApp: Nastavenia registrácie sa nenašli v Firestore. Dátum uzávierky úprav nie je definovaný.");
                setDataEditDeadline(null);
            }
            setSettingsLoaded(true);
            console.log("ChangeBillingDataApp: Načítanie nastavení dokončené, settingsLoaded: true.");
          }, error => {
            console.error("ChangeBillingDataApp: Chyba pri načítaní nastavení registrácie (onSnapshot error):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true);
          });

          return () => {
            if (unsubscribeSettings) {
                console.log("ChangeBillingDataApp: Ruším odber onSnapshot pre nastavenia registrácie.");
                unsubscribeSettings();
            }
          };
      } catch (e) {
          console.error("ChangeBillingDataApp: Chyba pri nastavovaní onSnapshot pre nastavenia registrácie (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
      }
    };

    fetchSettings();
  }, [db]); // Závisí len od 'db'

  // VALIDATION FUNCTIONS
  const validateIco = (value) => {
    // IČO - len čísla
    if (value && !/^\d+$/.test(value)) {
      return 'IČO môže obsahovať iba čísla.';
    }
    return '';
  };

  const validateDic = (value) => {
    // DIČ - len čísla
    if (value && !/^\d+$/.test(value)) {
      return 'DIČ môže obsahovať iba čísla.';
    }
    return '';
  };

  const validateIcDph = (value) => {
    // IČ DPH - prvé dva znaky veľké písmeno bez diakritiky, potom len čísla
    // Kontrola, či neobsahuje diakritiku (rozšírený rozsah znakov, ktoré nie sú A-Z)
    const diacriticsRegex = /[^\u0041-\u005A\u0030-\u0039]/g; // Povolené len A-Z a 0-9

    if (value) { // Ak hodnota nie je prázdna
      const firstTwoChars = value.substring(0, 2);
      const remainingChars = value.substring(2);

      // Kontrola diakritiky v prvých dvoch znakoch
      if (firstTwoChars.match(diacriticsRegex)) {
        return 'Prvé dva znaky IČ DPH nesmú obsahovať diakritiku.';
      }

      // Kontrola, či prvé dva znaky sú veľké písmená a zvyšok sú čísla
      if (!/^[A-Z]{2}$/.test(firstTwoChars) || (remainingChars && !/^\d*$/.test(remainingChars))) {
        return 'IČ DPH musí začínať dvoma veľkými písmenami (bez diakritiky) nasledovanými číslami.';
      }
    }
    return '';
  };

  const formatAndValidatePostalCode = (value) => {
    // PSČ - len čísla, automatická medzera po treťom znaku, za medzerou ešte presne dva znaky
    let cleanedValue = value.replace(/\D/g, ''); // Odstránime všetky nečíselné znaky
    let formattedValue = cleanedValue;
    let errorMsg = '';

    if (cleanedValue.length > 3) {
      formattedValue = cleanedValue.substring(0, 3) + ' ' + cleanedValue.substring(3, 5);
    }

    // Validácia formátu XXXXX
    if (cleanedValue.length > 0 && cleanedValue.length !== 5) {
        errorMsg = 'PSČ musí mať presne 5 číslic.';
    } else if (cleanedValue.length === 5 && !/^\d{5}$/.test(cleanedValue)) {
        errorMsg = 'PSČ môže obsahovať iba čísla.';
    }

    return { formattedValue, errorMsg };
  };


  const handleUpdateBillingData = async (e) => {
    e.preventDefault();

    // Re-validate all fields before submission
    const newIcoError = validateIco(ico);
    const newDicError = validateDic(dic);
    const newIcDphError = validateIcDph(icDph);
    const { errorMsg: newPostalCodeError } = formatAndValidatePostalCode(postalCode); // Use the errorMsg from formatter

    setIcoError(newIcoError);
    setDicError(newDicError);
    setIcDphError(newIcDphError);
    setPostalCodeError(newPostalCodeError);

    // NOVINKA: Kontrola, či je formulár platný pred odoslaním
    const isFormCurrentlyValid = clubName.trim() !== '' &&
                                 street.trim() !== '' &&
                                 houseNumber.trim() !== '' &&
                                 city.trim() !== '' &&
                                 postalCode.replace(/\s/g, '').length === 5 && // Kontrola PSČ po odstránení medzier
                                 country.trim() !== '' &&
                                 (ico.trim() !== '' || dic.trim() !== '' || icDph.trim() !== '') && // Aspoň jedno z IČO/DIČ/IČ DPH
                                 !newIcoError && !newDicError && !newIcDphError && !newPostalCodeError; // Žiadne validačné chyby


    if (!isFormCurrentlyValid) {
      setUserNotificationMessage("Prosím, vyplňte všetky povinné polia a opravte chyby vo formulári.");
      return;
    }

    // NOVINKA: Kontrola povolenia úprav dát
    if (!isDataEditingAllowed) {
      setError("Úpravy fakturačných údajov sú po uzávierke zakázané.");
      return;
    }

    if (!db || !user) {
      setError("Databáza alebo používateľ nie je k dispozícii.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    try {
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.update({
        billing: {
          clubName: clubName,
          ico: ico,
          dic: dic,
          icDph: icDph
        },
        // AKTUALIZÁCIA ADRESNÝCH ÚDAJOV PRIAMO V KORENI POUŽÍVATEĽSKÉHO DOKUMENTU
        street: street,
        houseNumber: houseNumber,
        city: city,
        postalCode: postalCode.replace(/\s/g, ''), // Uložiť PSČ bez medzery
        country: country
      });
      setUserNotificationMessage("Fakturačné údaje úspešne aktualizované!");

      // --- Logika pre ukladanie notifikácie pre administrátorov ---
      try {
          // Používame pevne zadané 'default-app-id' pre cestu k notifikáciám
          const appId = 'default-app-id'; 
          let notificationMessage = '';
          let notificationRecipientId = '';

          // Konkrétna správa o zmene fakturačných údajov
          if (userProfileData.role === 'user') {
              notificationMessage = `Používateľ ${userProfileData.email} si zmenil fakturačné údaje (názov klubu: ${clubName}, IČO: ${ico}, DIČ: ${dic}, IČ DPH: ${icDph}, adresa: ${street} ${houseNumber}, ${postalCode} ${city}, ${country}).`;
              notificationRecipientId = 'all_admins'; // Notifikácia pre všetkých administrátorov
          } else if (userProfileData.role === 'admin') {
              notificationMessage = `Administrátor ${userProfileData.email} si zmenil fakturačné údaje (názov klubu: ${clubName}, IČO: ${ico}, DIČ: ${dic}, IČ DPH: ${icDph}, adresa: ${street} ${houseNumber}, ${postalCode} ${city}, ${country}).`;
              notificationRecipientId = user.uid; // Notifikácia pre tohto konkrétneho administrátora
          }

          if (notificationMessage) {
              await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
                  message: notificationMessage,
                  timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                  recipientId: notificationRecipientId,
                  read: false
              });
              console.log("Notifikácia o zmene fakturačných údajov úspešne uložená do Firestore.");
          }
      } catch (e) {
          console.error("ChangeBillingDataApp: Chyba pri ukladaní notifikácie o zmene fakturačných údajov:", e);
      }
      // --- Koniec logiky pre ukladania notifikácie ---

    } catch (e) {
      console.error("ChangeBillingDataApp: Chyba pri aktualizácii fakturačných údajov:", e);
      setError(`Chyba pri aktualizácii fakturačných údajov: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // NOVINKA: Kontrola, či je formulár platný pre povolenie tlačidla
  const isFormValid = clubName.trim() !== '' &&
                      street.trim() !== '' &&
                      houseNumber.trim() !== '' &&
                      city.trim() !== '' &&
                      postalCode.replace(/\s/g, '').length === 5 && // PSČ musí mať presne 5 číslic (bez medzery)
                      country.trim() !== '' &&
                      (ico.trim() !== '' || dic.trim() !== '' || icDph.trim() !== '') && // Aspoň jedno z IČO/DIČ/IČ DPH musí byť vyplnené
                      !icoError && !dicError && !icDphError && !postalCodeError; // Žiadne validačné chyby


  // Display loading state
  if (!user || (user && !userProfileData) || !settingsLoaded || loading) {
    if (user === null) {
        console.log("ChangeBillingDataApp: Používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam...';
    if (user && !settingsLoaded) { // NOVINKA: Čakanie na načítanie nastavení
        loadingMessage = 'Načítavam nastavenia...';
    } else if (user && settingsLoaded && !userProfileData) {
        loadingMessage = 'Načítavam profilové dáta...';
    } else if (loading) {
        loadingMessage = 'Ukladám zmeny...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // Redirect if user is not 'user' role
  if (userProfileData && userProfileData.role !== 'user') {
      console.log("ChangeBillingDataApp: Používateľ nemá rolu 'user'. Presmerovávam na logged-in-my-data.html.");
      window.location.href = 'logged-in-my-data.html';
      return null;
  }

  // Dynamické triedy pre tlačidlo na základe stavu disabled
  const buttonClasses = `
    mt-6 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200
    ${loading || !isDataEditingAllowed || !isFormValid // ZMENA: Pridaná kontrola isFormValid
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' // Zakázaný stav
      : 'bg-blue-500 hover:bg-blue-700 text-white' // Aktívny stav
    }
  `;

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage('')
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-md mt-20 mb-10 p-4' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      // NOVINKA: Správa o uzávierke úprav
      !isDataEditingAllowed && React.createElement(
        'div',
        { className: 'bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        `Úpravy fakturačných údajov sú povolené len do ${dataEditDeadline ? new Date(dataEditDeadline).toLocaleDateString('sk-SK') + ' ' + new Date(dataEditDeadline).toLocaleTimeString('sk-SK') : 'nedefinovaného dátumu'}.`
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Zmeniť fakturačné údaje'
        ),
        React.createElement(
          'form',
          { onSubmit: handleUpdateBillingData, className: 'space-y-4' },
          // Oficiálny názov klubu
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'clubName', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Oficiálny názov klubu'),
            React.createElement('input', {
              type: 'text',
              id: 'clubName',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: clubName,
              onChange: (e) => setClubName(e.target.value),
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            })
          ),
          // IČO
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'ico', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'IČO'),
            React.createElement('input', {
              type: 'text',
              id: 'ico',
              className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200 ${icoError ? 'border-red-500' : ''}`,
              value: ico,
              onChange: (e) => {
                // Obmedzenie na len čísla
                const numericValue = e.target.value.replace(/\D/g, '');
                setIco(numericValue);
                setIcoError(validateIco(numericValue));
              },
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            }),
            icoError && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1', style: { wordBreak: 'break-all' } }, icoError)
          ),
          // DIČ
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'dic', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'DIČ'),
            React.createElement('input', {
              type: 'text',
              id: 'dic',
              className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200 ${dicError ? 'border-red-500' : ''}`,
              value: dic,
              onChange: (e) => {
                // Obmedzenie na len čísla
                const numericValue = e.target.value.replace(/\D/g, '');
                setDic(numericValue);
                setDicError(validateDic(numericValue));
              },
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            }),
            dicError && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1', style: { wordBreak: 'break-all' } }, dicError)
          ),
          // IČ DPH
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'icDph', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'IČ DPH'),
            React.createElement('input', {
              type: 'text',
              id: 'icDph',
              className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200 ${icDphError ? 'border-red-500' : ''}`,
              value: icDph,
              onChange: (e) => {
                // Obmedzenie na prvé dva znaky veľké písmená (bez diakritiky), potom len čísla
                let inputValue = e.target.value.toUpperCase();
                let filteredValue = '';

                if (inputValue.length > 0) {
                    // Prvé dva znaky: len veľké písmená bez diakritiky
                    const firstTwo = inputValue.substring(0, 2).replace(/[^A-Z]/g, '');
                    filteredValue += firstTwo;

                    // Zvyšné znaky: len čísla
                    if (inputValue.length > 2) {
                        const remaining = inputValue.substring(2).replace(/\D/g, '');
                        filteredValue += remaining;
                    }
                }
                
                setIcDph(filteredValue);
                setIcDphError(validateIcDph(filteredValue));
              },
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            }),
            icDphError && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1', style: { wordBreak: 'break-all' } }, icDphError)
          ),
          // Ulica
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'street', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Ulica'),
            React.createElement('input', {
              type: 'text',
              id: 'street',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: street,
              onChange: (e) => setStreet(e.target.value),
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            })
          ),
          // Popisné číslo
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'houseNumber', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Popisné číslo'),
            React.createElement('input', {
              type: 'text',
              id: 'houseNumber',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: houseNumber,
              onChange: (e) => setHouseNumber(e.target.value),
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            })
          ),
          // Mesto
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'city', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Mesto'),
            React.createElement('input', {
              type: 'text',
              id: 'city',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: city,
              onChange: (e) => setCity(e.target.value),
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            })
          ),
          // PSČ
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'postalCode', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'PSČ'),
            React.createElement('input', {
              type: 'text',
              id: 'postalCode',
              className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200 ${postalCodeError ? 'border-red-500' : ''}`,
              value: postalCode,
              onChange: (e) => {
                const { formattedValue, errorMsg } = formatAndValidatePostalCode(e.target.value);
                setPostalCode(formattedValue);
                setPostalCodeError(errorMsg);
              },
              maxLength: 6, // 5 číslic + 1 medzera
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            }),
            postalCodeError && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1', style: { wordBreak: 'break-all' } }, postalCodeError)
          ),
          // Štát
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'country', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Štát'),
            React.createElement('input', {
              type: 'text',
              id: 'country',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: country,
              onChange: (e) => setCountry(e.target.value),
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            })
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: buttonClasses, // Použitie dynamických tried
              disabled: loading || !isDataEditingAllowed || !isFormValid, // ZMENA: Disabled ak je po uzávierke alebo formulár nie je platný
            },
            loading ? 'Ukladám...' : 'Uložiť fakturačné údaje'
          )
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.ChangeBillingDataApp = ChangeBillingDataApp;

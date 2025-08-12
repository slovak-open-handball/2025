// register-page3.js
// Obsahuje komponenty a logiku pre tretiu (finálnu) stránku registračného formulára.

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Funkcia na získanie reCAPTCHA tokenu (prevzatá z register.js)
// Konštanty sú definované globálne v register.html
const getRecaptchaToken = async (action) => {
  const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa"; // Je definovaný aj globálne, ale pre istotu znova tu
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
export function Page3Form({ formData, handlePrev, loading, setLoading, setNotificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, NotificationModal }) {
  const isRegisteringRef = React.useRef(false); // Ref pre okamžitý prístup v onAuthStateChanged

  // Dynamické triedy pre tlačidlo "Registrovať sa"
  const registerButtonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
    ${loading || !isRecaptchaReady
      ? 'bg-white text-green-500 border border-green-500 cursor-not-allowed' // Zakázaný stav
      : 'bg-green-500 hover:bg-green-700 text-white' // Aktívny stav
    }
  `;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);
    setNotificationType('info');
    isRegisteringRef.current = true; // Okamžitá aktualizácia referencie pre onAuthStateChanged

    // Validácia fakturačných údajov
    const { clubName, ico, dic, icDph } = formData.billing;

    if (!clubName.trim()) {
        setNotificationMessage('Oficiálny názov klubu je povinný.');
        setShowNotification(true);
        setNotificationType('error');
        setLoading(false);
        isRegisteringRef.current = false;
        return;
    }

    if (!ico && !dic && !icDph) {
      setNotificationMessage('Musíte zadať aspoň jedno z polí IČO, DIČ alebo IČ DPH.');
      setShowNotification(true);
      setNotificationType('error');
      setLoading(false);
      isRegisteringRef.current = false;
      return;
    }

    if (icDph) {
      const icDphRegex = /^[A-Z]{2}[0-9]+$/;
      if (!icDphRegex.test(icDph)) {
        setNotificationMessage('IČ DPH musí začínať dvoma veľkými písmenami a nasledovať číslicami (napr. SK1234567890).');
        setShowNotification(true);
        setNotificationType('error');
        setLoading(false);
        isRegisteringRef.current = false;
        return;
      }
    }

    const postalCodeClean = formData.postalCode.replace(/\s/g, '');
    if (postalCodeClean.length !== 5 || !/^\d{5}$/.test(postalCodeClean)) {
      setNotificationMessage('PSČ musí mať presne 5 číslic.');
      setShowNotification(true);
      setNotificationType('error');
      setLoading(false);
      isRegisteringRef.current = false;
      return;
    }

    const fullPhoneNumber = `${selectedCountryDialCode}${formData.contactPhoneNumber}`;
    console.log("Konštruované telefónne číslo pre odoslanie:", fullPhoneNumber); // Logovanie telefónneho čísla

    try {
      // Prístup ku globálnym inštanciám Firebase Auth a Firestore
      const authInstance = window.auth;
      const firestoreDb = window.db;
      const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec"; // Je definovaný aj globálne, ale pre istotu znova tu


      if (!authInstance || !firestoreDb) {
        setNotificationMessage('Firebase nie je inicializované. Skúste to prosím znova.');
        setShowNotification(true);
        setNotificationType('error');
        setLoading(false);
        isRegisteringRef.current = false;
        return;
      }

      // Získanie reCAPTCHA tokenu pre finálnu registráciu (klient-side overenie)
      const recaptchaToken = await getRecaptchaToken('register_user');
      if (!recaptchaToken) {
        setLoading(false);
        isRegisteringRef.current = false;
        return; // Zastav, ak token nebol získaný
      }
      console.log("reCAPTCHA Token pre registráciu používateľa získaný (klient-side overenie).");

      // 1. Vytvorenie používateľa vo Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(authInstance, formData.email, formData.password);
      const user = userCredential.user;

      if (!user || !user.uid) {
        console.error("register-page3.js: Používateľský objekt je neplatný po vytvorení účtu. UID nie je k dispozícii.");
        setNotificationMessage('Chyba pri vytváraní používateľského účtu. Skúste to prosím znova.');
        setShowNotification(true);
        setNotificationType('error');
        setLoading(false);
        isRegisteringRef.current = false;
        return;
      }
      console.log("Používateľ vytvorený v Auth s UID:", user.uid);


      // 2. Uloženie používateľských údajov do Firestore
      // Zmenená cesta pre zápis do databázy na /users/{userId}
      const userDocRef = doc(collection(firestoreDb, 'users'), user.uid);

      console.log("register-page3.js: Pokúšam sa zapísať údaje do Firestore pre UID:", user.uid, "do cesty:", userDocRef.path);
      await setDoc(userDocRef, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        contactPhoneNumber: fullPhoneNumber,
        country: formData.country,
        city: formData.city,
        postalCode: formData.postalCode,
        street: formData.street,
        houseNumber: formData.houseNumber,
        billing: formData.billing,
        role: 'user', // Predvolená rola 'user'
        approved: true,
        registrationDate: serverTimestamp(),
        passwordLastChanged: serverTimestamp(),
      });
      console.log("Údaje používateľa úspešne zapísané do Firestore.");

      // 3. Odoslanie registračného e-mailu cez Google Apps Script (no-cors)
      try {
          const payload = {
            action: 'sendRegistrationEmail',
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            contactPhoneNumber: fullPhoneNumber,
            isAdmin: false, // Toto nie je administrátorská registrácia
            billing: { // Pridanie fakturačných údajov
              clubName: formData.billing.clubName,
              ico: formData.billing.ico,
              dic: formData.billing.dic,
              icDph: formData.billing.icDph,
              address: { // Adresa pre fakturačné údaje
                street: formData.street,
                houseNumber: formData.houseNumber,
                zipCode: formData.postalCode,
                city: formData.city,
                country: formData.country
              }
            }
          };
          console.log("Odosielam registračný e-mail s payloadom:", JSON.stringify(payload, null, 2)); // Pridané logovanie payloadu
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          console.log("Požiadavka na odoslanie registračného e-mailu odoslaná (no-cors režim).");
          try {
            // V režime 'no-cors' je odpoveď 'opaque', takže text() alebo json() zlyhá.
            // Táto časť je tu len pre konzistentnosť s admin-register.js, ale nefunguje.
            const responseData = await response.text();
            console.log("Odpoveď z Apps Script (fetch - registračný e-mail) ako text:", responseData);
          } catch (jsonError) {
            console.warn("Nepodarilo sa analyzovať odpoveď z Apps Script (očakávané s 'no-cors' pre JSON):", jsonError);
          }
      } catch (emailError) {
          console.error("Chyba pri odosielaní registračného e-mailu cez Apps Script (chyba fetch):", emailError);
      }

      // Pridanie krátkeho oneskorenia, aby sa zabezpečilo spracovanie sieťových požiadaviek
      await new Promise(resolve => setTimeout(resolve, 200)); // Oneskorenie 200ms

      // Aktualizovaná správa po úspešnej registrácii
      setNotificationMessage(`Ďakujeme za Vašu registráciu na turnaj Slovak Open Handball. Potvrdenie o zaregistrovaní Vášho klubu bolo odoslané na e-mailovú adresu ${formData.email}.`);
      setShowNotification(true);
      setNotificationType('success'); // Nastavenie typu notifikácie na úspech
      setRegistrationSuccess(true); // Nastavenie stavu úspešnej registrácie

      // 5. Explicitne odhlásiť používateľa po úspešnej registrácii a uložení dát
      try {
        await signOut(authInstance);
        console.log("Používateľ úspešne odhlásený po registrácii.");
      } catch (signOutError) {
        console.error("Chyba pri odhlasovaní po registrácii:", signOutError);
      }

      // Vyčistiť formulár - už nie je potrebné, lebo presmerujeme
      // setFormData({ /* ... */ });
      // setPage(1); // Reset na prvú stránku formulára

      // Presmerovanie na prihlasovaciu stránku po dlhšom oneskorení (aby sa správa zobrazila)
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 5000); // 5 sekúnd na zobrazenie notifikácie

    } catch (error) {
      console.error('Chyba počas registrácie alebo zápisu do Firestore:', error);
      let errorMessage = 'Registrácia zlyhala. Skúste to prosím neskôr.';

      if (error.code) {
          switch (error.code) {
              case 'auth/email-already-in-use':
                  errorMessage = 'Zadaná e-mailová adresa je už používaná.';
                  break;
              case 'auth/invalid-email':
                  errorMessage = 'Neplatný formát e-mailovej adresy.';
                  break;
              case 'auth/weak-password':
                  errorMessage = 'Heslo je príliš slabé. Použite silnejšie heslo.';
                  break;
              case 'permission-denied': // Špecifická chyba povolenia Firestore
                  errorMessage = 'Chyba databázy: Nemáte oprávnenie na zápis. Skontrolujte bezpečnostné pravidlá Firestore.';
                  break;
              default:
                  errorMessage = error.message || errorMessage;
                  break;
          }
      } else {
          errorMessage = error.message || errorMessage;
      }
      setNotificationMessage(errorMessage);
      setShowNotification(true);
      setNotificationType('error');
    } finally {
      setLoading(false);
      isRegisteringRef.current = false; // Reset referencie
    }
  };

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(NotificationModal, { message: notificationMessage, onClose: () => { /* NotificationModal sa zatvára automaticky */ }, type: "error" }), // Len pre chyby z formulára

    React.createElement(
      'h2',
      { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
      'Registrácia - Potvrdenie' // Nový nadpis
    ),
    React.createElement(
      'div',
      { className: 'space-y-4' },
      React.createElement(
        'div',
        { className: 'bg-blue-50 p-4 rounded-lg text-sm text-gray-700 border border-blue-200' },
        React.createElement('p', { className: 'font-semibold mb-2' }, 'Skontrolujte prosím zadané údaje:'),
        React.createElement('ul', { className: 'list-disc list-inside space-y-1' },
          React.createElement('li', null, React.createElement('strong', null, 'Meno:'), ` ${formData.firstName} ${formData.lastName}`),
          React.createElement('li', null, React.createElement('strong', null, 'Email:'), ` ${formData.email}`),
          React.createElement('li', null, React.createElement('strong', null, 'Telefón:'), ` ${selectedCountryDialCode}${formData.contactPhoneNumber}`),
          React.createElement('li', null, React.createElement('strong', null, 'Klub:'), ` ${formData.billing?.clubName}`),
          (formData.billing?.ico || formData.billing?.dic || formData.billing?.icDph) &&
          React.createElement('li', null, React.createElement('strong', null, 'IČO/DIČ/IČ DPH:'),
            formData.billing?.ico && ` IČO: ${formData.billing.ico}`,
            formData.billing?.dic && ` DIČ: ${formData.billing.dic}`,
            formData.billing?.icDph && ` IČ DPH: ${formData.billing.icDph}`
          ),
          React.createElement('li', null, React.createElement('strong', null, 'Adresa:'), ` ${formData.street} ${formData.houseNumber}, ${formData.postalCode} ${formData.city}, ${formData.country}`)
        ),
        React.createElement('p', { className: 'mt-4 text-orange-600 font-semibold' }, 'Kliknutím na tlačidlo "Registrovať sa" potvrdzujete správnosť všetkých údajov a súhlasíte s podmienkami registrácie.')
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
            onClick: handleSubmit, // Spustí finálnu registračnú logiku
            className: registerButtonClasses,
            disabled: loading || !isRecaptchaReady, // Zmenená podmienka disable
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

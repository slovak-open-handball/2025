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
export function Page3Form({ formData, handlePrev, handleSubmit, loading, setLoading, setNotificationMessage, setShowNotification, setNotificationType, setRegistrationSuccess, isRecaptchaReady, selectedCountryDialCode, NotificationModal, notificationMessage, closeNotification }) { // NOVINKA: Pridaný notificationMessage a closeNotification
  const isRegisteringRef = React.useRef(false); // Ref pre okamžitý prístup v onAuthStateChanged

  // Dynamické triedy pre tlačidlo "Registrovať sa"
  const registerButtonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
    ${loading || !isRecaptchaReady
      ? 'bg-white text-green-500 border border-green-500 cursor-not-allowed' // Zakázaný stav
      : 'bg-green-500 hover:bg-green-700 text-white' // Aktívny stav
    }
  `;

  // handleSubmit z Page3Form je teraz handleFinalSubmit z App.js
  // (Ponechávame názov handleSubmit pre konzistentnosť v rámci Page3Form)
  // Funkcionalita bola presunutá do App.js a volá sa prostredníctvom propu.

  return React.createElement(
    React.Fragment,
    null,
    // NOVINKA: NotificationModal teraz správne prijíma props
    React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: "error" }), // Len pre chyby z formulára

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

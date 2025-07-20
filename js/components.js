// js/components.js

// Komponenta pre vstup hesla s prepínaním viditeľnosti
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description }) {
  // Ikona pre zobrazenie hesla (oko)
  const EyeIcon = (
    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  // Ikona pre skrytie hesla (preškrtnuté oko)
  const EyeOffIcon = (
    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a9.95 9.95 0 011.875.175m.001 0V5m0 14v-2.175m0-10.65L12 12m-6.25 6.25L12 12m0 0l6.25-6.25M12 12l-6.25-6.25" />
    </svg>
  );

  return (
    <div className="relative">
      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={id}>{label}</label>
      <input
        type={showPassword ? "text" : "password"} // Typ inputu sa mení na základe stavu showPassword
        id={id}
        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10"
        value={value}
        onChange={onChange}
        // Zakázanie kopírovania, vkladania a strihania pre polia hesla
        onCopy={(e) => e.preventDefault()}
        onPaste={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        required
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled} // Zakáže input, ak je prop 'disabled' true
      />
      <button
        type="button"
        onClick={toggleShowPassword} // Prepína viditeľnosť hesla
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
        disabled={disabled} // Zakáže tlačidlo, ak je prop 'disabled' true
      >
        {showPassword ? EyeOffIcon : EyeIcon} {/* Zobrazí príslušnú ikonu */}
      </button>
      {description && ( // Zobrazí popis, ak je poskytnutý
        <p className="text-gray-600 text-sm -mt-2">
          {description}
        </p>
      )}
    </div>
  );
}

// Komponenta pre zobrazenie notifikácií (vyskakovacie okno)
function NotificationModal({ message, onClose }) {
  const [show, setShow] = React.useState(false); // Stav pre riadenie viditeľnosti modalu
  const timerRef = React.useRef(null); // Ref pre uloženie ID časovača

  React.useEffect(() => {
    // Ak je k dispozícii správa, zobrazí modal a spustí časovač
    if (message) {
      setShow(true);
      // Vymaže existujúci časovač, aby sa predišlo viacerým časovačom
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setShow(false); // Spustí animáciu zmiznutia
        // Zavolá onClose po dokončení animácie zmiznutia
        setTimeout(onClose, 500); // 500ms pre animáciu posunu/zmiznutia
      }, 10000); // Zobrazí sa na 10 sekúnd
    } else {
      // Ak je správa prázdna/null, okamžite skryje modal a vymaže časovač
      setShow(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    // Funkcia na vyčistenie: vymaže časovač pri odpojení komponentu alebo zmene závislostí
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [message, onClose]); // Spustí sa znova pri zmene správy alebo onClose

  // Vykreslí komponent len ak je 'show' true (pre animáciu) alebo ak je správa (počiatočné vykreslenie)
  if (!show && !message) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full' // Animácia posunu
      }`}
      style={{ pointerEvents: 'none' }} // Umožňuje kliknutia prejsť cez pozadie modalu
    >
      <div
        className="bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center"
        style={{ pointerEvents: 'auto' }} // Znova povolí kliknutia pre obsah modalu
      >
        <p className="font-semibold">{message}</p>
      </div>
    </div>
  );
}

// Tieto komponenty budú dostupné globálne.

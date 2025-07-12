// utils/helpers.js

/**
 * Formátuje objekt Date do reťazca vhodného pre input type="datetime-local".
 * @param {Date|null} date - Objekt Date na formátovanie.
 * @returns {string} Formátovaný reťazec (YYYY-MM-DDTHH:mm) alebo prázdny reťazec, ak je vstup null.
 */
export const formatToDateTimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Validuje heslo podľa definovaných kritérií.
 * @param {string} pwd - Heslo na validáciu.
 * @returns {string|null} Chybová správa, ak heslo nie je platné, inak null.
 */
export const validatePassword = (pwd) => {
  const errors = [];

  if (pwd.length < 10) {
    errors.push("minimálne 10 znakov");
  }
  if (pwd.length > 4096) {
    errors.push("maximálne 4096 znakov");
  }
  if (!/[A-Z]/.test(pwd)) {
    errors.push("jedno veľké písmeno");
  }
  if (!/[a-z]/.test(pwd)) {
    errors.push("jedno malé písmeno");
  }
  if (!/[0-9]/.test(pwd)) {
    errors.push("jednu číslicu");
  }

  if (errors.length === 0) {
    return null;
  } else {
    return "Heslo musí obsahovať aspoň:\n• " + errors.join("\n• ") + ".";
  }
};

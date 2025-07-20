// Import reCAPTCHA site key
import { RECAPTCHA_SITE_KEY } from './firebaseConfig.js';

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
export const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Function to validate password strength
export const validatePassword = (pwd) => {
  const errors = [];

  if (pwd.length < 10) {
    errors.push("minimálne 10 znakov");
  }
  if (pwd.length > 4096) {
    errors.push("maximálne 4096 znakov");
  }
  if (!/[A-Z]/.test(pwd)) {
    errors.push("aspoň jedno veľké písmeno");
  }
  if (!/[a-z]/.test(pwd)) {
    errors.push("aspoň jedno malé písmeno");
  }
  if (!/[0-9]/.test(pwd)) {
    errors.push("aspoň jednu číslicu");
  }

  if (errors.length === 0) {
    return null;
  } else {
    return "Heslo musí obsahovať:\n• " + errors.join("\n• ") + ".";
  }
};

// Function to get reCAPTCHA token
export const getRecaptchaToken = async (action, siteKey) => {
  if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
    console.error("reCAPTCHA API nie je načítané alebo pripravené.");
    return null;
  }
  try {
    const token = await grecaptcha.execute(siteKey, { action: action });
    return token;
  } catch (e) {
    console.error("Chyba pri získavaní reCAPTCHA tokenu:", e);
    return null;
  }
};

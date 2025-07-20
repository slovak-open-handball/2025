// js/utils.js

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
// This ensures the datetime-local input displays the time in the user's local timezone.
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Funkcia na výpočet zostávajúceho času pre odpočítavanie
const calculateTimeLeft = (registrationStartDate) => {
  const now = new Date();
  const startDate = registrationStartDate ? new Date(registrationStartDate) : null;

  // Ak startDate nie je platný dátum, alebo už je v minulosti, odpočítavanie nie je potrebné
  if (!startDate || isNaN(startDate) || now >= startDate) {
      return null;
  }

  const difference = startDate.getTime() - now.getTime(); // Rozdiel v milisekách

  if (difference <= 0) {
      return null; // Čas už uplynul
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

// Funkcia pre validáciu hesla
const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
        return "Heslo musí mať aspoň 8 znakov.";
    }
    if (!hasUpperCase) {
        return "Heslo musí obsahovať aspoň jedno veľké písmeno.";
    }
    if (!hasLowerCase) {
        return "Heslo musí obsahovať aspoň jedno malé písmeno.";
    }
    if (!hasDigit) {
        return "Heslo musí obsahovať aspoň jedno číslo.";
    }
    if (!hasSpecialChar) {
        return "Heslo musí obsahovať aspoň jeden špeciálny znak.";
    }
    return null; // Heslo je platné
};

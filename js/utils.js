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

// If using ES modules, you would use:
// export { formatToDatetimeLocal, calculateTimeLeft };

// js/firebase-config.js

// Globálne premenné pre konfiguráciu Firebase a ďalšie kľúče
// Ak sú __app_id, __firebase_config a __initial_auth_token definované globálne (napr. z Canvas prostredia), použijú sa.
// V opačnom prípade sa použijú predvolené hodnoty z tvojho pôvodného App.js.

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : '1:26454452024:web:6954b4f90f87a3a1eb43cd';
const FIREBASE_CONFIG = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const INITIAL_AUTH_TOKEN = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Tieto konštanty budú dostupné globálne, keď sa tento skript načíta.
// Nie je potrebné ich exportovať, ak sa používajú ako jednoduché skripty.

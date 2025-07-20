// js/firebase-config.js

// Firebase Konfigurácia
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};

// Ďalšie globálne konštanty
const APP_ID = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Inicializácia Firebase (musí byť zavolaná raz na stránke)
// Používame globálne premenné, ktoré budú dostupné po načítaní tohto skriptu.
// firebase.initializeApp(FIREBASE_CONFIG);
// const app = firebase.app();
// const auth = firebase.auth();
// const db = firebase.firestore();
// const functions = firebase.functions(); // Ak sa používajú Firebase Functions

// Ak by ste chceli, môžete inicializáciu robiť v AuthContext.js
// Tu len definujeme konštanty.

// App.js

import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext.js'; // Import AuthProvider a useAuth
import Header from './components/Header.js'; // Import Header komponentu
import HomePage from './pages/HomePage.js'; // Import HomePage komponentu
import RegisterPage from './pages/RegisterPage.js'; // Import RegisterPage komponentu
import LoginPage from './pages/LoginPage.js'; // Import LoginPage komponentu
import LoggedInPage from './pages/LoggedInPage.js'; // Import LoggedInPage komponentu

// Hlavný komponent aplikácie
function AppContent() {
  // Získanie globálneho stavu a funkcií z AuthContextu
  const { loading, isAuthReady, user, error, message } = useAuth();

  // Získanie aktuálnej cesty URL
  const currentPath = window.location.pathname.split('/').pop();

  // Zobrazenie načítavacej obrazovky, kým sa inicializuje autentifikácia a nastavenia
  if (loading || !isAuthReady) {
    return (
      React.createElement("div", { className: "flex items-center justify-center min-h-screen bg-gray-100" },
        React.createElement("div", { className: "text-xl font-semibold text-gray-700" }, "Načítava sa...")
      )
    );
  }

  // Podmienené renderovanie stránok na základe aktuálnej URL
  let pageContent = null;
  if (currentPath === '' || currentPath === 'index.html') {
    pageContent = React.createElement(HomePage, null);
  } else if (currentPath === 'register.html') {
    pageContent = React.createElement(RegisterPage, { isAdminRegisterPage: false });
  } else if (currentPath === 'admin-register.html') {
    pageContent = React.createElement(RegisterPage, { isAdminRegisterPage: true });
  } else if (currentPath === 'login.html') {
    pageContent = React.createElement(LoginPage, null);
  } else if (currentPath === 'logged-in.html') {
    // LoggedInPage už obsahuje vlastnú logiku presmerovania, ak používateľ nie je prihlásený
    pageContent = React.createElement(LoggedInPage, null);
  } else {
    // Stránka 404 alebo presmerovanie na domovskú stránku
    pageContent = React.createElement("div", { className: "flex items-center justify-center min-h-screen bg-gray-100" },
      React.createElement("div", { className: "text-xl font-semibold text-gray-700" }, "Stránka nebola nájdená.")
    );
  }

  return (
    React.createElement(React.Fragment, null,
      // Hlavička je teraz renderovaná priamo v AppContent, aby bola konzistentná na všetkých stránkach
      // s výnimkou logged-in.html, kde je renderovaná v rámci LoggedInPage
      currentPath !== 'logged-in.html' && React.createElement(Header, { user: user, isAdmin: user?.role === 'admin', handleLogout: () => window.location.href = 'login.html', isAuthReady: isAuthReady }), // Jednoduchá verzia pre ne-logged-in stránky
      
      // Kontajner pre obsah stránky
      React.createElement("div", { className: `flex justify-center items-start ${currentPath === 'logged-in.html' ? '' : 'min-h-screen pt-20'}` },
        // Zobrazenie globálnych správ o úspechu alebo chybách (ak nie sú špecifické pre komponent)
        // Tieto správy sa zobrazia nad obsahom stránky
        message && (
          React.createElement("div", { className: "fixed top-20 left-1/2 -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative z-50 w-full max-w-md text-center", role: "alert" },
            message
          )
        ),
        error && (
          React.createElement("div", { className: "fixed top-20 left-1/2 -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative z-50 w-full max-w-md text-center whitespace-pre-wrap", role: "alert" },
            error
          )
        ),
        pageContent // Renderovanie aktuálneho obsahu stránky
      )
    )
  );
}

// Hlavný export komponentu App, ktorý obalí AppContent do AuthProvider
export default function App() {
  return (
    React.createElement(AuthProvider, null,
      React.createElement(AppContent, null)
    )
  );
}

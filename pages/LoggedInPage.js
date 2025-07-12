// pages/LoggedInPage.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext.js'; // Import useAuth hooku
import Header from '../components/Header.js'; // Import komponentu hlavičky
import MyData from '../components/profile/MyData.js'; // Import komponentu Moje údaje
import ChangePassword from '../components/profile/ChangePassword.js'; // Import komponentu Zmeniť heslo
import ChangeName from '../components/profile/ChangeName.js'; // Import komponentu Zmeniť meno
import ChangePhoneNumber from '../components/profile/ChangePhoneNumber.js'; // Import komponentu Zmeniť telefón
import UserList from '../components/admin/UserList.js'; // Import komponentu Zoznam používateľov
import TeamList from '../components/admin/TeamList.js'; // Import komponentu Všetky tímy
import Settings from '../components/admin/Settings.js'; // Import komponentu Nastavenia

/**
 * Hlavný komponent pre stránku po prihlásení (logged-in.html).
 * Zobrazuje navigačné menu a dynamicky renderuje obsah na základe vybranej sekcie.
 */
const LoggedInPage = () => {
  // Získanie potrebných hodín a funkcií z AuthContextu
  const { user, isAdmin, loading, message, error, handleLogout } = useAuth();

  // Lokálny stav pre aktuálne zobrazenú sekciu profilu/administrácie
  const [profileView, setProfileView] = useState(() => {
    const hash = window.location.hash.substring(1);
    return hash || 'my-data'; // Predvolené zobrazenie
  });

  // Efekt pre sledovanie zmien v URL hashi a aktualizáciu profileView
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      setProfileView(hash || 'my-data');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Funkcia na zmenu zobrazenia sekcie
  const changeProfileView = (view) => {
    setProfileView(view);
    window.location.hash = view; // Aktualizovať URL hash
  };

  // Ak používateľ nie je prihlásený, presmerovať ho na prihlasovaciu stránku
  if (!user) {
    window.location.href = 'login.html';
    return null; 
  }

  return (
    React.createElement("div", { className: "min-h-screen bg-gray-100 flex flex-col font-inter overflow-y-auto" },
      // Hlavička aplikácie
      React.createElement(Header, { user: user, isAdmin: isAdmin, handleLogout: handleLogout, isAuthReady: true }), // isAuthReady je v tomto kontexte vždy true

      // Hlavný obsah stránky
      React.createElement("div", { className: "flex-grow pt-20 flex justify-center items-start" },
        React.createElement("div", { className: "flex flex-grow w-full pb-10" }, 
          // Bočné navigačné menu
          React.createElement("div", { className: "fixed top-20 left-0 h-[calc(100vh-theme(spacing.20))] w-[271px] bg-white p-6 rounded-lg shadow-xl overflow-y-auto z-40 ml-4" }, 
            React.createElement("h2", { className: "text-2xl font-bold text-gray-800 mb-4" }, "Menu"),
            React.createElement("nav", null,
              React.createElement("ul", { className: "space-y-2" },
                // Odkazy pre všetkých prihlásených používateľov
                React.createElement("li", null,
                  React.createElement("button", {
                    onClick: () => changeProfileView('my-data'),
                    className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'my-data' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`
                  }, "Moje údaje")
                ),
                React.createElement("li", null,
                  React.createElement("button", {
                    onClick: () => changeProfileView('change-password'),
                    className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'change-password' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`
                  }, "Zmeniť heslo")
                ),
                React.createElement("li", null,
                  React.createElement("button", {
                    onClick: () => changeProfileView('change-name'),
                    className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'change-name' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`
                  }, "Zmeniť meno a priezvisko") 
                ),
                // Odkaz na zmenu telefónneho čísla len pre ne-adminov
                !isAdmin && (
                  React.createElement("li", null,
                    React.createElement("button", {
                      onClick: () => changeProfileView('change-phone-number'),
                      className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'change-phone-number' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`
                    }, "Zmeniť telefónne číslo")
                  )
                ),
                // Odkazy len pre administrátorov
                isAdmin && (
                  React.createElement("li", null,
                    React.createElement("button", {
                      onClick: () => changeProfileView('users'),
                      className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'users' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`
                    }, "Používatelia")
                  )
                ),
                isAdmin && (
                  React.createElement("li", null,
                    React.createElement("button", {
                      onClick: () => changeProfileView('all-teams'),
                      className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'all-teams' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`
                    }, "Všetky tímy (registrácie)")
                  )
                ),
                isAdmin && (
                  React.createElement("li", null,
                    React.createElement("button", {
                      onClick: () => changeProfileView('settings'),
                      className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'settings' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`
                    }, "Nastavenia")
                  )
                )
              )
            )
          ),

          // Hlavná oblasť obsahu
          React.createElement("div", { className: "flex-grow ml-[287px] p-8 bg-white rounded-lg shadow-xl overflow-x-auto overflow-y-auto mr-4" }, 
            // Zobrazenie správ o úspechu alebo chybách
            message && (
              React.createElement("div", { className: "bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4", role: "alert" },
                message
              )
            ),
            error && (
              React.createElement("div", { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap", role: "alert" },
                error
              )
            ),

            React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" }, `Vitajte, ${user.displayName || 'Používateľ'}!`),
            
            // Podmienené renderovanie komponentov na základe profileView
            profileView === 'my-data' && React.createElement(MyData, null),
            profileView === 'change-password' && React.createElement(ChangePassword, null),
            profileView === 'change-name' && React.createElement(ChangeName, null),
            profileView === 'change-phone-number' && !isAdmin && React.createElement(ChangePhoneNumber, null),
            profileView === 'users' && isAdmin && React.createElement(UserList, null),
            profileView === 'all-teams' && isAdmin && React.createElement(TeamList, null),
            profileView === 'settings' && isAdmin && React.createElement(Settings, null)
          )
        )
      )
    )
  );
};

export default LoggedInPage;

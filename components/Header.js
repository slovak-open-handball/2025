// components/Header.js

import React from 'react';

/**
 * Komponent hlavičky aplikácie.
 * Zobrazuje názov aplikácie a navigačné odkazy pre prihlásenie/registráciu/odhlásenie.
 * @param {object} props - Vlastnosti komponentu.
 * @param {object|null} props.user - Objekt aktuálne prihláseného používateľa.
 * @param {boolean} props.isAdmin - Určuje, či je používateľ administrátor.
 * @param {function} props.handleLogout - Funkcia na odhlásenie používateľa.
 * @param {boolean} props.isAuthReady - Určuje, či je stav autentifikácie inicializovaný.
 */
const Header = ({ user, isAdmin, handleLogout, isAuthReady }) => {
  return (
    React.createElement("header", { className: "fixed top-0 left-0 right-0 bg-white shadow-md p-4 flex items-center justify-between z-50 rounded-b-lg" },
      React.createElement("div", { className: "text-xl font-bold text-gray-800" }, "Slovak Open Handball"),
      React.createElement("div", { className: "flex items-center space-x-4" },
        // Zobraziť odkaz na prihlásenie, ak používateľ nie je prihlásený a autentifikácia je pripravená
        isAuthReady && !user && (
          React.createElement("a", {
            href: "login.html",
            className: "text-blue-600 hover:text-blue-800 font-semibold"
          }, "Prihlásenie")
        ),
        // Zobraziť odkaz na "Moja zóna", ak je používateľ prihlásený a autentifikácia je pripravená
        isAuthReady && user && (
          React.createElement("a", {
            href: "logged-in.html",
            className: "text-blue-600 hover:text-blue-800 font-semibold"
          }, "Moja zóna")
        ),
        // Zobraziť tlačidlo na odhlásenie, ak je používateľ prihlásený a autentifikácia je pripravená
        isAuthReady && user && (
          React.createElement("button", {
            onClick: handleLogout,
            className: "bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
          }, "Odhlásenie")
        )
      )
    )
  );
};

export default Header;

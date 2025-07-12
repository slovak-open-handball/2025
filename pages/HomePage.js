// pages/HomePage.js

import React from 'react';
import { useAuth } from '../AuthContext.js'; // Import useAuth hooku

/**
 * Komponent pre hlavnú (domovskú) stránku aplikácie.
 * Zobrazuje uvítaciu správu a odkazy na prihlásenie/registráciu.
 */
const HomePage = () => {
  // Získanie potrebných hodnôt z AuthContextu
  const { user, isRegistrationOpen, countdownMessage } = useAuth();

  const h1Element = React.createElement("h1", { className: "text-3xl font-bold text-gray-800 mb-4" }, "Vitajte na stránke Slovak Open Handball");

  let conditionalContent;
  if (user) {
    // Ak je používateľ prihlásený
    conditionalContent = React.createElement(React.Fragment, null,
      React.createElement("p", { className: "text-lg text-gray-600" }, "Ste prihlásený. Prejdite do svojej zóny pre viac možností."),
      React.createElement("div", { className: "mt-6 flex justify-center" },
        React.createElement("a", {
          href: "logged-in.html",
          className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
        }, "Moja zón")
      )
    );
  } else {
    // Ak používateľ nie je prihlásený
    conditionalContent = React.createElement(React.Fragment, null,
      React.createElement("p", { className: "text-lg text-gray-600" }, "Prosím, prihláste sa alebo sa zaregistrujte, aby ste mohli pokračovali."),
      React.createElement("div", { className: "mt-6 flex justify-center space-x-4" },
        React.createElement("a", {
          href: "login.html",
          className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
        }, "Prihlásenie"),
        // Zobraziť odkaz na registráciu iba ak je registrácia otvorená
        isRegistrationOpen && (
          React.createElement("a", {
            href: "register.html",
            className: "bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
          }, "Registrácia na turnaj")
        )
      ),
      // Zobraziť správu o odpočítavaní registrácie
      React.createElement("div", { className: "mt-6 text-center text-gray-700 font-semibold" },
        countdownMessage
      )
    );
  }

  return (
    React.createElement("div", { className: "w-full max-w-md p-4" },
      React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full text-center" },
        h1Element,
        conditionalContent
      )
    )
  );
};

export default HomePage;

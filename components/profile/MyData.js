// components/profile/MyData.js

import React from 'react';
import { useAuth } from '../../AuthContext.js'; // Import useAuth hooku

/**
 * Komponent pre zobrazenie základných údajov prihláseného používateľa.
 */
const MyData = () => {
  // Získanie potrebných hodín z AuthContextu
  const { user, isAdmin } = useAuth();

  return (
    React.createElement("div", { className: "space-y-4 border-t pt-4 mt-4" },
      React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Moje údaje"),
      React.createElement("p", { className: "text-gray-700" },
        React.createElement("span", { className: "font-semibold" }, "E-mailová adresa: "), user?.email || '-'
      ),
      React.createElement("p", { className: "text-gray-700" },
        React.createElement("span", { className: "font-semibold" }, "Meno a priezvisko: "), user?.displayName || '-'
      ),
      // Zobraziť telefónne číslo len pre ne-adminov
      !isAdmin && ( 
        React.createElement("p", { className: "text-gray-700" },
          React.createElement("span", { className: "font-semibold" }, "Telefónne číslo: "), user?.contactPhoneNumber || '-'
        )
      )
    )
  );
};

export default MyData;

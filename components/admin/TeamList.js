// components/admin/TeamList.js

import React, { useEffect } from 'react';
import { useAuth } from '../../AuthContext.js'; // Import useAuth hooku

/**
 * Komponent pre zobrazenie všetkých registračných údajov tímov (len pre administrátorov).
 */
const TeamList = () => {
  // Získanie potrebných hodín a funkcií z AuthContextu
  const { allUsersData, fetchAllUsers } = useAuth();

  // Načítať používateľov (tímy) pri prvom zobrazení komponentu
  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]); // fetchAllUsers je závislosť, ale je stabilná z AuthContextu

  return (
    React.createElement("div", { className: "space-y-4 border-t pt-4 mt-4" },
      React.createElement("h2", { className: "text-xl font-semibold text-gray-800 mb-4" }, "Všetky tímy (údaje z registračného formulára)"),
      allUsersData.length > 0 ? (
        React.createElement("div", { className: "overflow-x-auto" },
          React.createElement("table", { className: "min-w-full bg-white border border-gray-200 rounded-lg shadow-sm" },
            React.createElement("thead", null,
              React.createElement("tr", { className: "bg-gray-100 border-b border-gray-200" },
                React.createElement("th", { className: "py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider" }, "E-mail"),
                React.createElement("th", { className: "py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider" }, "Meno kontaktnej osoby"),
                React.createElement("th", { className: "py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider" }, "Priezvisko kontaktnej osoby"),
                React.createElement("th", { className: "py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider" }, "Telefónne číslo"),
                React.createElement("th", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, "Rola"),
                React.createElement("th", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, "Schválený")
              )
            ),
            React.createElement("tbody", { className: "divide-y divide-gray-200" },
              allUsersData.map((u) => (
                React.createElement("tr", { key: u.uid, className: "hover:bg-gray-50" },
                  React.createElement("td", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, u.email),
                  React.createElement("td", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, u.firstName || '-'),
                  React.createElement("td", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, u.lastName || '-'),
                  React.createElement("td", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, u.contactPhoneNumber || '-'),
                  React.createElement("td", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, u.role || 'user'),
                  React.createElement("td", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, u.approved ? 'Áno' : 'Nie')
                )
              ))
            )
          )
        )
      ) : React.createElement("p", { className: "text-gray-600" }, "Žiadne registračné údaje na zobrazenie alebo načítavanie...")
    )
  );
};

export default TeamList;

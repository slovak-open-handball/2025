// components/profile/ChangeName.js

import React, { useState } from 'react';
import { useAuth } from '../../AuthContext.js'; // Import useAuth hooku
import { EyeIcon, EyeOffIcon } from '../../utils/icons.js'; // Import ikon

/**
 * Komponent pre zmenu mena a priezviska prihláseného používateľa.
 */
const ChangeName = () => {
  // Získanie potrebných hodín a funkcií z AuthContextu
  const { loading, error, message, handleChangeName, isEditingOpen, editEndDate } = useAuth();

  // Lokálny stav pre formulárové polia
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  // Lokálny stav pre zobrazenie/skrytie hesla
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  // Funkcia pre odoslanie formulára
  const onSubmit = async (e) => {
    e.preventDefault();
    const success = await handleChangeName(newFirstName, newLastName, currentPassword);
    if (success) {
      // Ak je zmena mena úspešná, vyčistiť formulár
      setNewFirstName('');
      setNewLastName('');
      setCurrentPassword('');
    }
  };

  return (
    isEditingOpen ? ( // Zobraziť formulár, len ak je editácia povolená
      React.createElement("form", { onSubmit: onSubmit, className: "space-y-4 border-t pt-4 mt-4" },
        React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť meno a priezvisko"),
        React.createElement("div", null,
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-first-name" }, "Nové meno"),
          React.createElement("input", {
            type: "text",
            id: "new-first-name",
            className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
            value: newFirstName,
            onChange: (e) => setNewFirstName(e.target.value),
            required: true,
            placeholder: "Zadajte nové meno",
            autoComplete: "given-name"
          })
        ),
        React.createElement("div", null,
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-last-name" }, "Nové priezvisko"),
          React.createElement("input", {
            type: "text",
            id: "new-last-name",
            className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
            value: newLastName,
            onChange: (e) => setNewLastName(e.target.value),
            required: true,
            placeholder: "Zadajte nové priezvisko",
            autoComplete: "family-name"
          })
        ),
        React.createElement("div", { className: "relative" },
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "current-password-name-change" }, "Aktuálne heslo (pre overenie)"),
          React.createElement("input", {
            type: showCurrentPassword ? "text" : "password",
            id: "current-password-name-change",
            className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
            value: currentPassword,
            onChange: (e) => setCurrentPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            required: true,
            placeholder: "Zadajte svoje aktuálne heslo",
            autoComplete: "current-password"
          }),
          React.createElement("button", {
            type: "button",
            onClick: () => setShowCurrentPassword(!showCurrentPassword),
            className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
          },
            showCurrentPassword ? EyeOffIcon : EyeIcon
          )
        ),
        React.createElement("button", {
          type: "submit",
          className: "bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4",
          disabled: loading
        }, loading ? 'Ukladám...' : 'Zmeniť meno a priezvisko')
      )
    ) : ( // Zobraziť správu, ak editácia nie je povolená
      React.createElement("div", { className: "text-center text-gray-700 text-lg" },
        React.createElement("p", null, "Editácia údajov je momentálne uzavretá."),
        editEndDate && React.createElement("p", null, `Editácia bola povolená do: ${editEndDate.toLocaleString('sk-SK')}`)
      )
    )
  );
};

export default ChangeName;

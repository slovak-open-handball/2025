// components/profile/ChangePhoneNumber.js

import React, { useState } from 'react';
import { useAuth } from '../../AuthContext.js'; // Import useAuth hooku
import { EyeIcon, EyeOffIcon } from '../../utils/icons.js'; // Import ikon

/**
 * Komponent pre zmenu kontaktného telefónneho čísla prihláseného používateľa.
 */
const ChangePhoneNumber = () => {
  // Získanie potrebných hodín a funkcií z AuthContextu
  const { loading, error, message, handleChangeContactPhoneNumber, isEditingOpen, editEndDate, setError } = useAuth();

  // Lokálny stav pre formulárové polia
  const [newContactPhoneNumber, setNewContactPhoneNumber] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  // Lokálny stav pre zobrazenie/skrytie hesla
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  // Funkcia pre odoslanie formulára
  const onSubmit = async (e) => {
    e.preventDefault();
    const success = await handleChangeContactPhoneNumber(newContactPhoneNumber, currentPassword);
    if (success) {
      // Ak je zmena telefónneho čísla úspešná, vyčistiť formulár
      setNewContactPhoneNumber('');
      setCurrentPassword('');
    }
  };

  return (
    isEditingOpen ? ( // Zobraziť formulár, len ak je editácia povolená
      React.createElement("form", { onSubmit: onSubmit, className: "space-y-4 border-t pt-4 mt-4" },
        React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť telefónne číslo"),
        React.createElement("div", null,
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-contact-phone-number" }, "Nové telefónne číslo"),
          React.createElement("input", {
            type: "tel",
            id: "new-contact-phone-number",
            className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
            value: newContactPhoneNumber,
            onChange: (e) => {
              const value = e.target.value;
              // Základná validácia pre telefónne číslo
              if (value === '') {
                setNewContactPhoneNumber('');
                setError('');
              } else if (value[0] !== '+') {
                setError("Telefónne číslo musí začínať znakom +.");
                setNewContactPhoneNumber(value); 
              } else if (!/^\+\d*$/.test(value)) {
                setError("Telefónne číslo musí zaínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
                setNewContactPhoneNumber(value); 
              } else {
                setNewContactPhoneNumber(value);
                setError('');
              }
            },
            required: true,
            placeholder: "+421901234567",
            pattern: "^\\+\\d+$",
            title: "Telefónne číslo musí zaínať znakom '+' a obsahovať iba číslice (napr. +421901234567)"
          })
        ),
        React.createElement("div", { className: "relative" },
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "current-password-phone-change" }, "Aktuálne heslo (pre overenie)"),
          React.createElement("input", {
            type: showCurrentPassword ? "text" : "password",
            id: "current-password-phone-change",
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
          className: "bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4",
          disabled: loading
        }, loading ? 'Ukladám...' : 'Zmeniť telefónne číslo')
      )
    ) : ( // Zobraziť správu, ak editácia nie je povolená
      React.createElement("div", { className: "text-center text-gray-700 text-lg" },
        React.createElement("p", null, "Editácia údajov je momentálne uzavretá."),
        editEndDate && React.createElement("p", null, `Editácia bola povolená do: ${editEndDate.toLocaleString('sk-SK')}`)
      )
    )
  );
};

export default ChangePhoneNumber;

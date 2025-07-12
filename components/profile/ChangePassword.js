// components/profile/ChangePassword.js

import React, { useState } from 'react';
import { useAuth } from '../../AuthContext.js'; // Import useAuth hooku
import { EyeIcon, EyeOffIcon } from '../../utils/icons.js'; // Import ikon

/**
 * Komponent pre zmenu hesla prihláseného používateľa.
 */
const ChangePassword = () => {
  // Získanie potrebných hodín a funkcií z AuthContextu
  const { loading, error, message, handleChangePassword, isEditingOpen, editEndDate } = useAuth();

  // Lokálny stav pre formulárové polia
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Lokálny stav pre zobrazenie/skrytie hesla
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Funkcia pre odoslanie formulára
  const onSubmit = async (e) => {
    e.preventDefault();
    const success = await handleChangePassword(currentPassword, newPassword, confirmNewPassword);
    if (success) {
      // Ak je zmena hesla úspešná, vyčistiť formulár
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };

  return (
    isEditingOpen ? ( // Zobraziť formulár, len ak je editácia povolená
      React.createElement("form", { onSubmit: onSubmit, className: "space-y-4 border-t pt-4 mt-4" },
        React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť heslo"),
        React.createElement("div", { className: "relative" },
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "modal-current-password-password-change" }, "Aktuálne heslo (pre overenie)"),
          React.createElement("input", {
            type: showCurrentPassword ? "text" : "password",
            id: "modal-current-password-password-change",
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
        React.createElement("div", { className: "relative" },
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "modal-new-password" }, "Nové heslo"),
          React.createElement("input", {
            type: showNewPassword ? "text" : "password",
            id: "modal-new-password",
            className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
            value: newPassword,
            onChange: (e) => setNewPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            required: true,
            placeholder: "Zadajte nové heslo (min. 10 znakov)",
            autoComplete: "new-password"
          }),
          React.createElement("button", {
            type: "button",
            onClick: () => setShowNewPassword(!showNewPassword),
            className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
          },
            showNewPassword ? EyeOffIcon : EyeIcon
          )
        ),
        React.createElement("div", { className: "relative" },
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "modal-confirm-new-password" }, "Potvrďte nové heslo"),
          React.createElement("input", {
            type: showConfirmNewPassword ? "text" : "password",
            id: "modal-confirm-new-password",
            className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
            value: confirmNewPassword,
            onChange: (e) => setConfirmNewPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            required: true,
            placeholder: "Potvrďte heslo",
            autoComplete: "new-password"
          }),
          React.createElement("button", {
            type: "button",
            onClick: () => setShowConfirmNewPassword(!showConfirmNewPassword),
            className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
          },
            showConfirmNewPassword ? EyeOffIcon : EyeIcon
          )
        ),
        React.createElement("button", {
          type: "submit",
          className: "bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4",
          disabled: loading
        }, loading ? 'Ukladám...' : 'Zmeniť heslo')
      )
    ) : ( // Zobraziť správu, ak editácia nie je povolená
      React.createElement("div", { className: "text-center text-gray-700 text-lg" },
        React.createElement("p", null, "Editácia údajov je momentálne uzavretá."),
        editEndDate && React.createElement("p", null, `Editácia bola povolená do: ${editEndDate.toLocaleString('sk-SK')}`)
      )
    )
  );
};

export default ChangePassword;

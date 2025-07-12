// components/modals/RoleEditModal.js

import React from 'react';

/**
 * Modálne okno na úpravu roly používateľa.
 * @param {object} props - Vlastnosti komponentu.
 * @param {boolean} props.show - Určuje, či sa má modálne okno zobraziť.
 * @param {object|null} props.userToEditRole - Objekt používateľa, ktorého rola sa má upraviť.
 * @param {string} props.newRole - Aktuálne vybraná nová rola.
 * @param {function} props.setNewRole - Funkcia na nastavenie novej roly.
 * @param {function} props.onClose - Funkcia na zatvorenie modálneho okna.
 * @param {function} props.onConfirm - Funkcia, ktorá sa zavolá po potvrdení úpravy roly.
 * @param {boolean} props.loading - Určuje, či prebieha operácia (pre zobrazenie stavu načítania tlačidla).
 */
const RoleEditModal = ({ show, userToEditRole, newRole, setNewRole, onClose, onConfirm, loading }) => {
  if (!show) return null;

  return (
    React.createElement("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50" },
      React.createElement("div", { className: "relative p-5 border w-96 shadow-lg rounded-md bg-white" },
        React.createElement("h3", { className: "text-lg font-bold text-gray-900 mb-4" }, `Upraviť rolu pre ${userToEditRole?.email}`),
        React.createElement("div", { className: "mb-4" },
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-user-role" }, "Nová rola"),
          React.createElement("select", {
            id: "new-user-role",
            className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
            value: newRole,
            onChange: (e) => setNewRole(e.target.value)
          },
            React.createElement("option", { value: "user" }, "Používateľ"),
            React.createElement("option", { value: "admin" }, "Administrátor")
          )
        ),
        React.createElement("div", { className: "flex justify-end space-x-4" },
          React.createElement("button", {
            onClick: onClose,
            className: "px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
          }, "Zrušiť"),
          React.createElement("button", {
            onClick: onConfirm,
            className: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200",
            disabled: loading
          }, loading ? 'Ukladám...' : 'Uložiť')
        )
      )
    )
  );
};

export default RoleEditModal;

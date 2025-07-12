// components/modals/DeleteConfirmationModal.js

import React from 'react';

/**
 * Modálne okno na potvrdenie odstránenia používateľa.
 * @param {object} props - Vlastnosti komponentu.
 * @param {boolean} props.show - Určuje, či sa má modálne okno zobraziť.
 * @param {object|null} props.userToDelete - Objekt používateľa, ktorý sa má odstrániť.
 * @param {function} props.onClose - Funkcia na zatvorenie modálneho okna.
 * @param {function} props.onConfirm - Funkcia, ktorá sa zavolá po potvrdení odstránenia.
 * @param {boolean} props.loading - Určuje, či prebieha operácia (pre zobrazenie stavu načítania tlačidla).
 */
const DeleteConfirmationModal = ({ show, userToDelete, onClose, onConfirm, loading }) => {
  if (!show) return null;

  return (
    React.createElement("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50" },
      React.createElement("div", { className: "relative p-5 border w-96 shadow-lg rounded-md bg-white" },
        React.createElement("h3", { className: "text-lg font-bold text-gray-900 mb-4" }, "Potvrdiť odstránenie"), 
        React.createElement("p", { className: "text-gray-700 mb-6" }, `Naozaj chcete natrvalo odstrániť používateľa ${userToDelete?.email} z databázy? Táto akcia je nezvratná.`), 
        React.createElement("div", { className: "flex justify-end space-x-4" },
          React.createElement("button", {
            onClick: onClose,
            className: "px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
          }, "Zrušiť"),
          React.createElement("button", {
            onClick: onConfirm,
            className: "px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200",
            disabled: loading
          }, loading ? 'Odstraňujem...' : 'Odstrániť') 
        )
      )
    )
  );
};

export default DeleteConfirmationModal;

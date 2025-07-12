// components/admin/Settings.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext.js'; // Import useAuth hooku
import { formatToDateTimeLocal } from '../../utils/helpers.js'; // Import pomocnej funkcie

/**
 * Komponent pre správu nastavení turnaja (len pre administrátorov).
 * Umožňuje nastaviť dátumy začiatku/konca registrácie a konca editácie údajov.
 */
const Settings = () => {
  // Získanie potrebných hodín a funkcií z AuthContextu
  const { 
    loading, 
    error, 
    message, 
    isAdmin, 
    handleSaveSettings,
    registrationStartDate, // Aktuálne dátumy z kontextu
    registrationEndDate,
    editEndDate
  } = useAuth();

  // Lokálny stav pre dočasné hodnoty formulárových polí
  const [tempRegistrationStartDate, setTempRegistrationStartDate] = useState('');
  const [tempRegistrationEndDate, setTempRegistrationEndDate] = useState('');
  const [tempEditEndDate, setTempEditEndDate] = useState('');

  // Nastavenie počiatočných hodnôt formulára z kontextu, keď sa načítajú
  useEffect(() => {
    setTempRegistrationStartDate(formatToDateTimeLocal(registrationStartDate));
    setTempRegistrationEndDate(formatToDateTimeLocal(registrationEndDate));
    setTempEditEndDate(formatToDateTimeLocal(editEndDate));
  }, [registrationStartDate, registrationEndDate, editEndDate]); // Spustí sa, keď sa zmenia dátumy v kontexte

  // Funkcia pre odoslanie formulára
  const onSubmit = async (e) => {
    e.preventDefault();
    // Konvertovať reťazce na objekty Date
    const regStartDateObj = tempRegistrationStartDate ? new Date(tempRegistrationStartDate) : null;
    const regEndDateObj = tempRegistrationEndDate ? new Date(tempRegistrationEndDate) : null;
    const edDateObj = tempEditEndDate ? new Date(tempEditEndDate) : null;

    await handleSaveSettings(regStartDateObj, regEndDateObj, edDateObj);
  };

  // Ak používateľ nie je admin, nezobrazovať nastavenia
  if (!isAdmin) {
    return React.createElement("div", { className: "text-center text-gray-700 text-lg" }, "Nemáte oprávnenie na zobrazenie tejto stránky.");
  }

  return (
    React.createElement("div", { className: "space-y-4 border-t pt-4 mt-4" },
      React.createElement("h2", { className: "text-xl font-semibold text-gray-800 mb-4" }, "Nastavenia turnaja"),
      React.createElement("form", { onSubmit: onSubmit, className: "space-y-4" },
        React.createElement("div", null,
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "registration-start-date" }, "Registrácia povolená od:"), 
          React.createElement("input", {
            type: "datetime-local",
            id: "registration-start-date",
            className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
            value: tempRegistrationStartDate, 
            onChange: (e) => setTempRegistrationStartDate(e.target.value), 
            required: true
          })
        ),
        React.createElement("div", null,
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "registration-end-date" }, "Registrácia povolená do:"),
          React.createElement("input", {
            type: "datetime-local",
            id: "registration-end-date",
            className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
            value: tempRegistrationEndDate, 
            onChange: (e) => setTempRegistrationEndDate(e.target.value), 
            required: true
          })
        ),
        React.createElement("div", null,
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "edit-end-date" }, "Editácia údajov povolená do:"),
          React.createElement("input", {
            type: "datetime-local",
            id: "edit-end-date",
            className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
            value: tempEditEndDate, 
            onChange: (e) => setTempEditEndDate(e.target.value), 
            required: true
          })
        ),
        React.createElement("button", {
          type: "submit",
          className: "bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4",
          disabled: loading
        }, loading ? 'Ukladám nastavenia...' : 'Uložiť nastavenia')
      )
    )
  );
};

export default Settings;

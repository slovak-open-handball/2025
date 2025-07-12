// pages/RegisterPage.js

import React, { useState } from 'react';
import { useAuth } from '../AuthContext.js'; // Import useAuth hooku
import { EyeIcon, EyeOffIcon } from '../utils/icons.js'; // Import ikon

/**
 * Komponent pre registračnú stránku.
 * Používa sa pre bežnú registráciu aj pre registráciu administrátora.
 * @param {object} props - Vlastnosti komponentu.
 * @param {boolean} props.isAdminRegisterPage - True, ak je stránka pre registráciu administrátora.
 */
const RegisterPage = ({ isAdminRegisterPage }) => {
  // Získanie potrebných hodín a funkcií z AuthContextu
  const { 
    user, 
    loading, 
    message, 
    error, 
    setMessage, 
    setError, 
    handleRegister, 
    isRegistrationOpen,
    registrationStartDate,
    registrationEndDate
  } = useAuth();

  // Lokálny stav pre formulárové polia
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactPhoneNumber, setContactPhoneNumber] = useState('');

  // Lokálny stav pre zobrazenie/skrytie hesla
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Ak je používateľ už prihlásený, presmerovať ho
  if (user) {
    window.location.href = 'logged-in.html';
    return null; 
  }

  // Určenie, či je registrácia povolená na základe typu stránky a stavu registrácie
  const isRegistrationAllowed = isAdminRegisterPage || isRegistrationOpen;

  // Funkcia pre odoslanie formulára
  const onSubmit = async (e) => {
    e.preventDefault();
    const success = await handleRegister(email, password, confirmPassword, firstName, lastName, contactPhoneNumber, isAdminRegisterPage);
    if (success) {
      // Ak je registrácia úspešná, vyčistiť formulár
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');
      setContactPhoneNumber('');
      window.location.href = 'login.html'; // Presmerovať na prihlasovaciu stránku
    }
  };

  return (
    React.createElement("div", { className: "w-full max-w-md p-4" },
      React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full" },
        React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" },
          isAdminRegisterPage ? "Registrácia administrátora" : "Registrácia na turnaj"
        ),
        isRegistrationAllowed ? ( 
          React.createElement("form", { onSubmit: onSubmit, className: "space-y-4" },
            React.createElement("div", null,
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-first-name" },
                isAdminRegisterPage ? "Meno" : "Meno kontaktnej osoby" 
              ),
              React.createElement("input", {
                type: "text",
                id: "reg-first-name",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                value: firstName,
                onChange: (e) => setFirstName(e.target.value),
                required: true,
                placeholder: "Zadajte svoje meno",
                autoComplete: "given-name"
              })
            ),
            React.createElement("div", null,
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-last-name" },
                isAdminRegisterPage ? "Priezvisko" : "Priezvisko kontaktnej osoby" 
              ),
              React.createElement("input", {
                type: "text",
                id: "reg-last-name",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                value: lastName,
                onChange: (e) => setLastName(e.target.value),
                required: true,
                placeholder: "Zadajte svoje priezvisko",
                autoComplete: "family-name"
              })
            ),
            !isAdminRegisterPage && (
              React.createElement("div", null,
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-phone-number" }, "Telefónne číslo kontaktnej osoby"),
                React.createElement("input", {
                  type: "tel", 
                  id: "reg-phone-number",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                  value: contactPhoneNumber,
                  onChange: (e) => {
                    const value = e.target.value;
                    // Základná validácia pre telefónne číslo
                    if (value === '') {
                      setContactPhoneNumber('');
                      setError('');
                    } else if (value[0] !== '+') {
                      setError("Telefónne číslo musí začínať znakom +.");
                      setContactPhoneNumber(value); 
                    } else if (!/^\+\d*$/.test(value)) {
                      setError("Telefónne číslo musí zaínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
                      setContactPhoneNumber(value); 
                    } else {
                      setContactPhoneNumber(value);
                      setError('');
                    }
                  },
                  required: true,
                  placeholder: "+421901234567", 
                  pattern: "^\\+\\d+$", 
                  title: "Telefónne číslo musí zaínať znakom '+' a obsahovať iba číslice (napr. +421901234567)" 
                })
              )
            ),
            React.createElement("p", { className: "text-gray-600 text-sm mt-4" }, 
              isAdminRegisterPage 
                ? "Po odoslaní registračného formuláru už NIE JE možné zmeniť e-mailovú adresu."
                : "E-mailová adresa bude slúžiť na všetku komunikáciu súvisiacu s turnajom - zasielanie informácií, faktúr atď. Po odoslaní registračného formuláru už NIE JE možné zmeniť e-mailovú adresu."
            ),
            React.createElement("div", null,
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-email" }, 
                isAdminRegisterPage ? "E-mailová adresa" : "E-mailová adresa kontaktnej osoby" 
              ),
              React.createElement("input", {
                type: "email",
                id: "reg-email",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                value: email,
                onChange: (e) => setEmail(e.target.value),
                required: true,
                placeholder: "Zadajte svoju e-mailovú adresu",
                autoComplete: "email"
              })
            ),
            !isAdminRegisterPage && (
              React.createElement("p", { className: "text-gray-600 text-sm mt-4" }, 
                "E-mailová adresa a heslo sú potrebné na editáciu údajov poskytnutých v tomto registračnom formulári a na správu turnajového účtu."
              )
            ),
            React.createElement("div", { className: "relative" },
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-password" }, "Heslo"),
              React.createElement("input", {
                type: showPassword ? "text" : "password",
                id: "reg-password",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                value: password,
                onChange: (e) => setPassword(e.target.value),
                onCopy: (e) => e.preventDefault(),
                onPaste: (e) => e.preventDefault(),
                onCut: (e) => e.preventDefault(),
                required: true,
                placeholder: "Zvoľte heslo (min. 10 znakov)",
                autoComplete: "new-password"
              }),
              React.createElement("button", {
                type: "button",
                onClick: () => setShowPassword(!showPassword),
                className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
              },
                showPassword ? EyeOffIcon : EyeIcon
              )
            ),
            React.createElement("div", { className: "relative" },
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-confirm-password" }, "Potvrďte heslo"),
              React.createElement("input", {
                type: showConfirmPassword ? "text" : "password",
                id: "reg-confirm-password",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                value: confirmPassword,
                onChange: (e) => setConfirmPassword(e.target.value),
                onCopy: (e) => e.preventDefault(),
                onPaste: (e) => e.preventDefault(),
                onCut: (e) => e.preventDefault(),
                required: true,
                placeholder: "Potvrďte heslo",
                autoComplete: "new-password"
              }),
              React.createElement("button", {
                type: "button",
                onClick: () => setShowConfirmPassword(!showConfirmPassword),
                className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
              },
                showConfirmPassword ? EyeOffIcon : EyeIcon
              )
            ),
            message && (
              React.createElement("div", { className: "bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4", role: "alert" },
                message
              )
            ),
            error && (
              React.createElement("div", { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap", role: "alert" },
                error
              )
            ),
            React.createElement("button", {
              type: "submit",
              className: "bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
              disabled: loading
            }, loading ? 'Registrujem...' : 'Registrovať sa')
          )
        ) : (
          React.createElement("div", { className: "text-center text-gray-700 text-lg" },
            React.createElement("p", null, "Registrácia na turnaj je momentálne uzavretá alebo ešte nezačala."),
            registrationStartDate && React.createElement("p", null, `Registrácia povolená od: ${registrationStartDate.toLocaleString('sk-SK')}`),
            registrationEndDate && React.createElement("p", null, `Registrácia povolená do: ${registrationEndDate.toLocaleString('sk-SK')}`)
          )
        )
      )
    )
  );
};

export default RegisterPage;

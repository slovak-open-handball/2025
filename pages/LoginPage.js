// pages/LoginPage.js

import React, { useState } from 'react';
import { useAuth } from '../AuthContext.js'; // Import useAuth hooku
import { EyeIcon, EyeOffIcon } from '../utils/icons.js'; // Import ikon

/**
 * Komponent pre prihlasovaciu stránku.
 * Umožňuje používateľom prihlásiť sa do aplikácie.
 */
const LoginPage = () => {
  // Získanie potrebných hodín a funkcií z AuthContextu
  const { user, loading, message, error, setMessage, setError, handleLogin } = useAuth();

  // Lokálny stav pre formulárové polia
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Lokálny stav pre zobrazenie/skrytie hesla
  const [showPassword, setShowPassword] = useState(false);

  // Ak je používateľ už prihlásený, presmerovať ho
  if (user) {
    window.location.href = 'logged-in.html';
    return null; 
  }

  // Funkcia pre odoslanie formulára
  const onSubmit = async (e) => {
    e.preventDefault();
    const success = await handleLogin(email, password);
    if (success) {
      // Ak je prihlásenie úspešné, presmerovať na prihlásenú stránku
      window.location.href = 'logged-in.html';
    }
  };

  return (
    React.createElement("div", { className: "w-full max-w-md p-4" },
      React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full" },
        // Zobrazenie správ o úspechu alebo chybách
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

        React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" }, "Prihlásenie"),
        React.createElement("form", { onSubmit: onSubmit, className: "space-y-4" },
          React.createElement("div", null,
            React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "email" }, "E-mailová adresa"),
            React.createElement("input", {
              type: "email",
              id: "email",
              className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
              value: email,
              onChange: (e) => setEmail(e.target.value),
              required: true,
              placeholder: "Zadajte svoju e-mailovú adresu",
              autoComplete: "email"
            })
          ),
          React.createElement("div", { className: "relative" },
            React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "password" }, "Heslo"),
            React.createElement("input", {
              type: showPassword ? "text" : "password",
              id: "password",
              className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
              value: password,
              onChange: (e) => setPassword(e.target.value),
              onCopy: (e) => e.preventDefault(),
              onPaste: (e) => e.preventDefault(),
              onCut: (e) => e.preventDefault(),
              required: true,
              placeholder: "Zadajte heslo",
              autoComplete: "current-password"
            }),
            React.createElement("button", {
              type: "button",
              onClick: () => setShowPassword(!showPassword),
              className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
            },
              showPassword ? EyeOffIcon : EyeIcon
            )
          ),
          React.createElement("button", {
            type: "submit",
            className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
            disabled: loading
          }, loading ? 'Prihlasujem...' : 'Prihlásiť sa')
        )
      )
    )
  );
};

export default LoginPage;

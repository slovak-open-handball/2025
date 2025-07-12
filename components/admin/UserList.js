// components/admin/UserList.js

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../AuthContext.js'; // Import useAuth hooku
import DeleteConfirmationModal from '../modals/DeleteConfirmationModal.js'; // Import modálneho okna na potvrdenie odstránenia
import RoleEditModal from '../modals/RoleEditModal.js'; // Import modálneho okna na úpravu roly

/**
 * Komponent pre zobrazenie zoznamu všetkých používateľov (len pre administrátorov).
 * Umožňuje administrátorom spravovať používateľov (odstrániť, upraviť rolu, schváliť).
 */
const UserList = () => {
  // Získanie potrebných hodín a funkcií z AuthContextu
  const { 
    user, 
    loading, 
    error, 
    message, 
    fetchAllUsers, 
    handleDeleteUser, 
    handleUpdateUserRole, 
    handleApproveUser,
    allUsersData,
    setAllUsersData // Potrebné pre aktualizáciu zoznamu po operáciách
  } = useAuth();

  // Lokálny stav pre modálne okná
  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showRoleEditModal, setShowRoleEditModal] = useState(false);
  const [userToEditRole, setUserToEditRole] = useState(null);
  const [newRole, setNewRole] = useState('');

  // Načítať používateľov pri prvom zobrazení komponentu
  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]); // fetchAllUsers je závislosť, ale je stabilná z AuthContextu

  // Funkcie pre správu modálneho okna na odstránenie
  const openDeleteConfirmationModal = (u) => {
    setUserToDelete(u);
    setShowDeleteConfirmationModal(true);
  };

  const closeDeleteConfirmationModal = () => {
    setUserToDelete(null);
    setShowDeleteConfirmationModal(false);
  };

  const confirmDeleteUser = async () => {
    await handleDeleteUser(userToDelete);
    closeDeleteConfirmationModal();
  };

  // Funkcie pre správu modálneho okna na úpravu roly
  const openRoleEditModal = (u) => {
    setUserToEditRole(u);
    setNewRole(u.role || 'user'); // Prednastaviť aktuálnu rolu
    setShowRoleEditModal(true);
  };

  const closeRoleEditModal = () => {
    setUserToEditRole(null);
    setNewRole('');
    setShowRoleEditModal(false);
  };

  const confirmUpdateUserRole = async () => {
    await handleUpdateUserRole(userToEditRole, newRole);
    closeRoleEditModal();
  };

  return (
    React.createElement("div", { className: "space-y-4 border-t pt-4 mt-4" },
      React.createElement("h2", { className: "text-xl font-semibold text-gray-800 mb-4" }, "Zoznam používateľov (Administrácia)"),
      allUsersData.length > 0 ? (
        React.createElement(React.Fragment, null,
          React.createElement("ul", { className: "divide-y divide-gray-200" },
            allUsersData.map((u) =>
              React.createElement("li", { key: u.uid, className: "py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between" },
                React.createElement("div", { className: "flex-grow mb-2 sm:mb-0" },
                  React.createElement("p", { className: "text-gray-600 text-sm" }, u.email),
                  React.createElement("p", { className: "text-gray-500 text-xs" }, `Rola: ${u.role || 'user'}`), 
                  React.createElement("p", { className: "text-gray-500 text-xs" }, `Schválený: ${u.approved ? 'Áno' : 'Nie'}`) 
                ),
                // Zobraziť tlačidlá akcií len pre iných používateľov (nie pre seba)
                user && user.uid !== u.uid && ( 
                  React.createElement("div", { className: "flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0" },
                    // Tlačidlo na schválenie, ak je admin a nie je schválený
                    u.role === 'admin' && u.approved === false && (
                      React.createElement("button", {
                        onClick: () => handleApproveUser(u),
                        className: "bg-green-500 hover:bg-green-700 text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors duration-200"
                      }, "Povoliť používateľa")
                    ),
                    // Tlačidlo na úpravu roly
                    React.createElement("button", {
                      onClick: () => openRoleEditModal(u),
                      className: "bg-blue-500 hover:bg-blue-700 text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors duration-200"
                    }, "Upraviť rolu"),
                    // Tlačidlo na odstránenie používateľa
                    React.createElement("button", { 
                      onClick: () => openDeleteConfirmationModal(u), 
                      className: "bg-red-500 hover:bg-red-700 text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors duration-200"
                    }, "Odstrániť používateľa") 
                  )
                )
              )
            )
          )
        )
      ) : React.createElement("p", { className: "text-gray-600" }, "Žiadni používatelia na zobrazenie alebo načítavanie..."),

      // Modálne okno na potvrdenie odstránenia
      React.createElement(DeleteConfirmationModal, {
        show: showDeleteConfirmationModal,
        userToDelete: userToDelete,
        onClose: closeDeleteConfirmationModal,
        onConfirm: confirmDeleteUser,
        loading: loading
      }),

      // Modálne okno na úpravu roly
      React.createElement(RoleEditModal, {
        show: showRoleEditModal,
        userToEditRole: userToEditRole,
        newRole: newRole,
        setNewRole: setNewRole,
        onClose: closeRoleEditModal,
        onConfirm: confirmUpdateUserRole,
        loading: loading
      })
    )
  );
};

export default UserList;

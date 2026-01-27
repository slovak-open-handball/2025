import React from "https://esm.sh/react@18.2.0";
import ReactDOM from "https://esm.sh/react-dom@18.2.0";
import { doc, getDoc, onSnapshot, updateDoc, collection, Timestamp, query, getDocs, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef } = React;
const SUPERSTRUCTURE_TEAMS_DOC_PATH = 'settings/superstructureGroups';
const listeners = new Set();
const ConfirmDeleteGapModal = ({ isOpen, onClose, onConfirm, position, groupName, categoryName, isConfirming }) => {
  if (!isOpen) return null;
  return React.createElement(
    'div',
      {
      className: 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[200]',
      onClick: onClose
      },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl p-8 max-w-md w-full',
        onClick: e => e.stopPropagation()
      },
      React.createElement(
        'h2',
        { className: 'text-2xl font-bold text-gray-800 mb-6 text-center' },
          'Odstrániť voľné miesto v poradí'
        ),
        React.createElement(
          'p',
          { className: 'text-gray-700 mb-4 text-center' },
            `Naozaj chcete odstrániť voľné miesto na pozícii ${position} v skupine ${groupName} (${categoryName})?`
        ),
          React.createElement(
            'p',
            { className: 'text-sm text-amber-700 mb-8 text-center font-medium' },
            'Všetky tímy s vyšším poradím sa posunú o 1 nižšie.'
          ),
            React.createElement(
              'div',
              { className: 'flex justify-end space-x-4' },
              React.createElement(
                'button',
                {
                  onClick: onClose,
                  className: 'px-6 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors'
                },
                'Zrušiť'
              ),
              React.createElement(
                'button',
                {
                  onClick: () => {
                    onConfirm();
                    onClose();
                  },
                  disabled: isConfirming,
                  className: `px-6 py-2.5 rounded-lg text-white transition-colors ${
                    isConfirming ? 'bg-gray-400 cursor-wait opacity-60' : 'bg-amber-600 hover:bg-amber-700'
                  }`
                },
                isConfirming ? 'Spracúvam...' : 'Áno, odstrániť miesto'
        )
      )
    )
  );
};
// Nový komponent – stabilná notifikácia
// Stabilná notifikácia cez portál
const NotificationPortal = () => {
  const { useState, useEffect } = React;
  const [notification, setNotification] = React.useState(null);
  useEffect(() => {
    const unsubscribe = subscribe((notif) => {
      setNotification(notif);
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    });
    return unsubscribe;
  }, []);
  if (!notification) return null;
  // Farby pozadia podľa typu
  const typeClasses = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    default: 'bg-gray-700'
  }[notification.type || 'default'];
  return ReactDOM.createPortal(
    React.createElement(
      'div',
      {
        key: notification.id,
        className: `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-2xl text-white text-center z-[9999] transition-all duration-400 ease-in-out opacity-100 scale-100 translate-y-0 ${typeClasses}`
      },
      notification.message
    ),
    document.body
  );
};
export const notify = (message, type = 'info') => {
  const id = Date.now() + Math.random();
  listeners.forEach(cb => cb({ id, message, type }));
};
export const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, team, isConfirming }) => {
  if (!isOpen || !team) return null;
  const isGlobal = team.isSuperstructureTeam;
  const actionText = isGlobal ? "úplne odstrániť" : "presunúť medzi tímy bez skupiny";
  const title = isGlobal ? "Odstrániť tím" : "Zrušiť zaradenie tímu do skupiny";
  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[200]',
      onClick: onClose
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl p-8 max-w-md w-full',
        onClick: e => e.stopPropagation()
      },
      React.createElement(
        'h2',
        { className: 'text-2xl font-bold text-gray-800 mb-6 text-center' },
        title
      ),
      React.createElement(
        'p',
        { className: 'text-gray-700 mb-8 text-center' },
        isGlobal
          ? `Naozaj chcete natrvalo odstrániť tím "${team.teamName}"?`
          : `Naozaj chcete presunúť tím "${team.teamName}" medzi tímy bez skupiny?`
      ),
      React.createElement(
        'div',
        { className: 'flex justify-end space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: 'px-6 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors'
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: () => {
              onConfirm();
              onClose();
            },
            disabled: isConfirming,
            className: `px-6 py-2.5 rounded-lg text-white transition-colors ${
              isGlobal ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
            } ${isConfirming ? 'opacity-50 cursor-wait' : ''}`
          },
          isConfirming ? 'Spracúvam...' : isGlobal ? 'Áno, odstrániť' : 'Áno, presunúť'
        )
      )
    )
  );
};
const AddGroupsApp = (props) => {
    const teamsWithoutGroupRef = React.useRef(null);
    const [allTeams, setAllTeams] = useState([]);
    const [userTeamsData, setUserTeamsData] = useState([]);
    const [superstructureTeams, setSuperstructureTeams] = useState({});
    const [allGroupsByCategoryId, setAllGroupsByCategoryId] = useState({});
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedGroupName, setSelectedGroupName] = useState('');
    const [uiNotification, setUiNotification] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [teamToEdit, setTeamToEdit] = useState(null);
    const [isInitialHashReadComplete, setIsInitialHashReadComplete] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);
    const currentUserEmail = window.globalUserProfileData?.email || null;
    const [deleteGapModal, setDeleteGapModal] = useState(null);
const handleDeleteGap = async (categoryName, groupName, gapPosition) => {
    if (!window.db || !categoryName || !groupName || gapPosition == null) return;
    const trimmedGroup = (groupName || "").trim();
    try {
        const categoryId = Object.keys(categoryIdToNameMap).find(
            id => categoryIdToNameMap[id] === categoryName
        );
        const groupInfo = categoryId && allGroupsByCategoryId[categoryId]
            ? allGroupsByCategoryId[categoryId].find(g => g.name.trim() === trimmedGroup)
            : null;
        const isSuperstructureGroup = groupInfo?.type === 'nadstavbová skupina';
        let affectedCount = 0;
        if (isSuperstructureGroup) {
            // Nadstavbová skupina – settings/superstructureGroups
            const docRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
            const snap = await getDoc(docRef);
            if (!snap.exists()) {
                notify("Dokument nadstavbových skupín sa nenašiel", "error");
                return;
            }
            const data = snap.data() || {};
            let teams = [...(data[categoryName] || [])];
            const inGroup = teams.filter(t =>
                t.groupName && t.groupName.trim() === trimmedGroup
            );
            if (inGroup.length === 0) {
                notify(`V nadstavbovej skupine „${trimmedGroup}“ neboli nájdené žiadne tímy.`, "info");
                return;
            }
            // Získame tímy, ktoré treba posunúť (order > gapPosition)
            const teamsToShift = inGroup
                .filter(t => typeof t.order === 'number' && t.order > gapPosition)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            affectedCount = teamsToShift.length;
            // Pre každý tím spustíme logiku manuálnej zmeny poradia
            for (const team of teamsToShift) {
                const newOrder = (team.order || 0) - 1;
                // Tu simulujeme to, čo robí ceruzka/editácia
                // Predpokladáme, že máš nejakú funkciu na zmenu poradia
                // Ak nemáš samostatnú funkciu, použijeme podobnú logiku ako v handleUpdateAnyTeam
                const updatedTeam = { ...team, order: newOrder };
                // Aktualizujeme tím v poli
                const teamIndex = teams.findIndex(t =>
                    t.teamName === team.teamName &&
                    (t.id && team.id ? t.id === team.id : true)
                );
                if (teamIndex !== -1) {
                    teams[teamIndex] = updatedTeam;
                }
                // Vytvoríme notifikáciu ako pri zmene poradia
                await createTeamAssignmentNotification('change_order_global', {
                    id: team.id,
                    teamName: team.teamName,
                    category: categoryName,
                    groupName: trimmedGroup,
                    oldOrder: team.order,
                    newOrder: newOrder
                });
            }
            try {
                await updateDoc(docRef, { [categoryName]: teams });
                console.log("[SUCCESS] Nadstavbová skupina aktualizovaná – posunuté tímy");
            } catch (err) {
                console.error("[CHYBA superstructure update]:", err);
            }
        } else {
            // Základné skupiny – používatelia
            const usersSnap = await getDocs(collection(window.db, "users"));
            for (const userDoc of usersSnap.docs) {
                const userData = userDoc.data();
                let teamsInCategory = userData.teams?.[categoryName] || [];
                if (teamsInCategory.length === 0) continue;
                const inGroup = teamsInCategory.filter(t =>
                    t.groupName && t.groupName.trim() === trimmedGroup
                );
                if (inGroup.length === 0) continue;
                // Tímy na posunutie
                const teamsToShift = inGroup
                    .filter(t => typeof t.order === 'number' && t.order > gapPosition)
                    .sort((a, b) => (a.order || 0) - (b.order || 0));
                if (teamsToShift.length === 0) continue;
                affectedCount += teamsToShift.length;
                // Pre každý tím posunieme order o -1 a uložíme
                for (const team of teamsToShift) {
                    const newOrder = (team.order || 0) - 1;
                    // Nájdeme index v poli používateľa
                    const teamIndex = teamsInCategory.findIndex(t =>
                        t.teamName === team.teamName &&
                        (t.order ?? null) === (team.order ?? null)
                    );
                    if (teamIndex !== -1) {
                        teamsInCategory[teamIndex] = {
                            ...teamsInCategory[teamIndex],
                            order: newOrder
                        };
                        // Notifikácia ako pri manuálnej zmene
                        await createTeamAssignmentNotification('change_order_user', {
                            id: team.id,
                            teamName: team.teamName,
                            category: categoryName,
                            groupName: trimmedGroup,
                            oldOrder: team.order,
                            newOrder: newOrder
                        });
                    }
                }
                // Uložíme aktualizované pole pre tohto používateľa
                try {
                    const userRef = doc(window.db, "users", userDoc.id);
                    await updateDoc(userRef, {
                        [`teams.${categoryName}`]: teamsInCategory
                    });
                    console.log(`[SUCCESS] Používateľ ${userDoc.id} – posunuté tímy`);
                } catch (err) {
                    console.error(`[CHYBA] Používateľ ${userDoc.id}:`, err);
                }
            }
        }
        // Finálna notifikácia
        if (affectedCount > 0) {
            notify(
                `Voľné miesto na pozícii ${gapPosition} v skupine „${trimmedGroup}“ (${categoryName}) bolo odstránené. Posunulo sa ${affectedCount} tímov (ako pri manuálnej editácii).`,
                "success"
            );
        } else {
            notify(`V skupine „${trimmedGroup}“ (${categoryName}) neboli nájdené tímy na posunutie.`, "info");
        }
    } catch (err) {
        console.error("Chyba pri odstraňovaní diery:", err);
        notify("Nepodarilo sa odstrániť voľné miesto v poradí.", "error");
    }
};
    const createTeamAssignmentNotification = async (action, team) => {
        if (!window.db) return;
        if (!currentUserEmail) {
            console.warn("Nie je dostupný e-mail prihláseného používateľa → notifikácia nebude mať userEmail");
        }
   
        let message = '';
        let category = team.category || '?';
        let group = team.groupName || 'bez skupiny';
        let teamName = team.teamName || 'Neznámy tím';
        let orderText = (team.order != null && group !== 'bez skupiny')
            ? ` (poradie: ${team.order})`
            : '';
   
        switch (action) {
            case 'assign_global':
                message = `Tím ${teamName} priradený do skupiny ${group} (${category})${orderText}.`;
                break;
            case 'change_group_global':
                message = `Zmena skupiny tímu ${teamName} → ${group} (${category})${orderText}.`;
                break;
            case 'assign_user':
                message = `Tím ${teamName} zaradený do skupiny ${group} (${category})${orderText}.`;
                break;
            case 'change_group_user':
                message = `Zmena skupiny tímu ${teamName} → ${group} (${category})${orderText}.`;
                break;
            case 'add_new_global':
                message = `Nový tím ${teamName} vytvorený a zaradený do ${group} (${category})${orderText}.`;
                break;
   
            // ostatné akcie bez zmeny (nemajú poradie)
            case 'unassign_global':
                message = `Tím ${teamName} odstránený zo skupiny (${category}).`;
                break;
            case 'unassign_user':
                message = `Tím ${teamName} presunutý medzi tímy bez skupiny (${category}).`;
                break;
            case 'change_order_global':
                message = `Poradie tímu ${teamName} v skupine ${group} (${category}) zmenené z '${team.oldOrder}' na '${team.newOrder}'.`;
                break;
            case 'change_order_user':
                message = `Poradie tímu ${teamName} v skupine ${group} (${category}) zmenené z '${team.oldOrder}' na '${team.newOrder}'.`;
                break;
            default:
                message = `Zmena tímu ${teamName} (${action}).`;
        }
   
        try {
            const notificationsRef = collection(window.db, 'notifications');
            await addDoc(notificationsRef, {
                userEmail: currentUserEmail || "",
                performedBy: currentUserEmail || null,
                changes: [message],
                timestamp: serverTimestamp(),
                relatedTeamId: team.id ?? null,
                relatedCategory: category,
                relatedGroup: group || null,
                actionType: action
            });
            console.log("[NOTIFIKÁCIA] Uložená:", message);
        } catch (err) {
            console.error("[NOTIFIKÁCIA] Chyba pri ukladaní:", err);
        }
    };
    // Efekt pre manažovanie notifikácií
    useEffect(() => {
        let timer;
        const unsubscribe = subscribe((notification) => {
            setUiNotification(notification);
            clearTimeout(timer);
            timer = setTimeout(() => {
                setUiNotification(null);
            }, 5000);
        });
        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);
    // ===================================================================
    // VNÚTORNÉ FUNKCIE – všetky majú prístup k setUiNotification, categoryIdToNameMap atď.
    // ===================================================================
    const handleDeleteTeam = async (teamToDelete) => {
        if (!window.db || !teamToDelete || !teamToDelete.isSuperstructureTeam) {
            notify("Možno odstrániť len nadstavbové tímy", "error");
            return;
        }
   
        const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
        try {
            const docSnap = await getDoc(superstructureDocRef);
            const globalTeamsData = docSnap.exists() ? docSnap.data() : {};
            let teams = globalTeamsData[teamToDelete.category] || [];
            const teamIndex = teams.findIndex(t => t.id === teamToDelete.id);
            if (teamIndex === -1) {
                notify("Odstraňovaný tím sa nenašiel", "error");
                return;
            }
   
            const originalGroup = teamToDelete.groupName;
            const originalOrder = teamToDelete.order;
            teams.splice(teamIndex, 1);
   
            const reorderedTeams = teams.map(t => {
                if (t.groupName === originalGroup && t.order != null && t.order > originalOrder) {
                    return { ...t, order: t.order - 1 };
                }
                return t;
            });
   
            await setDoc(superstructureDocRef, {
                ...globalTeamsData,
                [teamToDelete.category]: reorderedTeams
            }, { merge: true });
   
            await createTeamAssignmentNotification('unassign_global', {
                id: teamToDelete.id,
                teamName: teamToDelete.teamName,
                category: teamToDelete.category,
                groupName: teamToDelete.groupName
            });
   
            notify(`Tím '${teamToDelete.teamName}' bol odstránený zo skupiny.`, "success");
        } catch (error) {
            console.error("Chyba pri odstraňovaní tímu:", error);
            notify("Nepodarilo sa odstrániť tím zo skupiny.", "error");
        }
    };
    const handleUnassignUserTeam = async (team) => {
        if (!window.db || !team?.uid) return;
   
        try {
            const userRef = doc(window.db, 'users', team.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                  notify(`Používateľ '${team.uid}' už neexistuje.`, "error");
                return;
            }
   
            const userData = userSnap.data();
            const categoryName = team.category;
            const teamsInCategory = [...(userData.teams?.[categoryName] || [])];
            const teamIndex = teamsInCategory.findIndex(t => t.teamName === team.teamName);
            if (teamIndex === -1) {
                notify("Tím sa nenašiel v profile používateľa.", "error");
                return;
            }
   
            teamsInCategory[teamIndex] = {
                ...teamsInCategory[teamIndex],
                groupName: null,
                order: null
            };
   
            await updateDoc(userRef, { [`teams.${categoryName}`]: teamsInCategory });
   
            await createTeamAssignmentNotification('unassign_user', {
                id: team.id,
                teamName: team.teamName,
                category: team.category,
                groupName: team.groupName
            });
   
            notify(`Tím '${team.teamName}' bol presunutý medzi tímy bez skupiny.`, "success");
        } catch (err) {
            console.error("Chyba pri zrušení zaradenia tímu:", err);
            notify("Nepodarilo sa presunúť tím medzi tímy bez skupiny.", "error");
        }
    };
    const handleRemoveOrDeleteTeam = (team) => {
      setConfirmModal({
        team,
        isDelete: team.isSuperstructureTeam,
        open: true
      });
    };
    const [isConfirming, setIsConfirming] = useState(false);
 
    const handleConfirmRemove = async () => {
      if (!confirmModal?.team) return;
      setIsConfirming(true);
   
      try {
        const team = confirmModal.team;
        if (team.isSuperstructureTeam) {
          await handleDeleteTeam(team);
        } else {
          await handleUnassignUserTeam(team);
        }
        setConfirmModal(null);
      } catch (err) {
        console.error(err);
        notify("Operácia zlyhala", "error");
      } finally {
        setIsConfirming(false);
      }
    };
    const handleUpdateAnyTeam = async ({ categoryId, groupName, teamName, order, originalTeam }) => {
        if (!window.db || !originalTeam) return;
        const categoryName = categoryIdToNameMap[categoryId];
        if (!categoryName) return;
   
        const finalTeamName = originalTeam.isSuperstructureTeam
          ? `${categoryName} ${teamName.trim()}`
          : teamName.trim();   
        // === Globálny tím (superštruktúra) ===
        if (originalTeam.isSuperstructureTeam) {
            const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
   
            try {
                const docSnap = await getDoc(superstructureDocRef);
                if (!docSnap.exists()) return;
                const data = docSnap.data() || {};
                const oldCategory = originalTeam.category;
                let oldTeams = [...(data[oldCategory] || [])];
                const idx = oldTeams.findIndex(t => t.id === originalTeam.id);
                if (idx === -1) {
                    notify("Pôvodný tím sa nenašiel", "error");
                    return;
                }
                oldTeams.splice(idx, 1);
   
                const categoryChanged = oldCategory !== categoryName;
                const groupChanged = originalTeam.groupName !== (groupName || null);
   
                let targetTeams = categoryChanged ? [...(data[categoryName] || [])] : oldTeams;
   
                let newOrder = null;
                const newGroup = groupName || null;
   
                if (newGroup) {
                    const inGroup = targetTeams.filter(t => t.groupName === newGroup);
                    const max = inGroup.reduce((m, t) => Math.max(m, t.order || 0), 0);
                    newOrder = (originalTeam.groupName === newGroup && !categoryChanged && !groupChanged)
                        ? (originalTeam.order ?? max + 1)
                        : max + 1;
   
                    // Ak prišla nová hodnota order a je platná
                    if (order != null && !isNaN(order)) {
                        newOrder = parseInt(order, 10);
                    }
                }
   
                const updatedTeam = {
                    id: originalTeam.id,
                    teamName: teamName.trim(),
                    groupName: newGroup,
                    order: newOrder,
                };
   
                targetTeams.push(updatedTeam);
   
                const updatePayload = { [oldCategory]: oldTeams };
                if (categoryChanged) updatePayload[categoryName] = targetTeams;
                else updatePayload[oldCategory] = targetTeams;
   
                await updateDoc(superstructureDocRef, updatePayload);
   
                // Detekcia, čo sa zmenilo
                let action;
                let notificationData = {
                    id: originalTeam.id,
                    teamName: teamName.trim(),
                    category: categoryName,
                    groupName: newGroup || null
                };
   
                if (groupChanged || categoryChanged) {
                    action = originalTeam.groupName ? 'change_group_global' : 'assign_global';
                } else if (newOrder !== originalTeam.order && newGroup === originalTeam.groupName) {
                    // Zmena iba poradia v rovnakej skupine
                    action = 'change_order_global';
                    notificationData.oldOrder = originalTeam.order;
                    notificationData.newOrder = newOrder;
                } else {
                    action = 'change_group_global'; // fallback
                }
   
                await createTeamAssignmentNotification(action, notificationData);
   
                notify(`Tím '${finalTeamName}' bol ${groupName ? 'zaradený/upravený' : 'odstránený zo skupiny'} v kategórii '${categoryName}'.`, "success");
            } catch (err) {
                console.error("Chyba pri aktualizácii tímu:", err);
                notify("Nepodarilo sa aktualizovať tím.", "error");
            }
        }
   
        // === Používateľský tím ===
        else {
            // ... (tu je podobná logika, len pre používateľa)
   
            if (!originalTeam?.uid) return;
   
            const userRef = doc(window.db, 'users', originalTeam.uid);
   
            try {
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    notify("Používateľ už neexistuje.", "error");
                    return;
                }
   
                const userData = userSnap.data();
                const teamsInCategory = [...(userData.teams?.[originalTeam.category] || [])];
                const teamIndex = teamsInCategory.findIndex(t => t.teamName === originalTeam.teamName);
                if (teamIndex === -1) {
                    notify("Tím sa nenašiel v profile používateľa.", "error");
                    return;
                }
   
                let newOrder = null;
                const newGroup = groupName || null;
   
                if (newGroup) {
                    const othersInGroup = teamsInCategory.filter(t => t.groupName === newGroup && t.teamName !== originalTeam.teamName);
                    const max = othersInGroup.reduce((m, t) => Math.max(m, t.order || 0), 0);
                    newOrder = order != null ? parseInt(order, 10) : max + 1;
                }
   
                const oldOrder = teamsInCategory[teamIndex].order;
                const oldGroup = teamsInCategory[teamIndex].groupName;
   
                teamsInCategory[teamIndex] = {
                    ...teamsInCategory[teamIndex],
                    teamName: teamName.trim(),
                    groupName: newGroup,
                    order: newOrder
                };
   
                await updateDoc(userRef, { [`teams.${originalTeam.category}`]: teamsInCategory });
   
                let action;
                let notificationData = {
                    id: originalTeam.id,
                    teamName: teamName.trim(),
                    category: originalTeam.category,
                    groupName: newGroup || null
                };
   
                const groupChanged = oldGroup !== newGroup;
   
                if (groupChanged) {
                    action = oldGroup ? 'change_group_user' : 'assign_user';
                } else if (newOrder !== oldOrder && newGroup === oldGroup) {
                    action = 'change_order_user';
                    notificationData.oldOrder = oldOrder;
                    notificationData.newOrder = newOrder;
                } else {
                    action = 'change_group_user'; // fallback
                }
   
                await createTeamAssignmentNotification(action, notificationData);
   
                notify(`Tím '${finalTeamName}' bol ${groupName ? 'zaradený/upravený' : 'odstránený zo skupiny'} v kategórii '${categoryName}'.`, "success");
            } catch (err) {
                console.error("Chyba pri aktualizácii tímu:", err);
                notify("Nepodarilo sa aktualizovať tím.", "error");
            }
        }
    };
    const handleAddNewTeam = async ({ categoryId, groupName, teamName, order }) => {
      if (!window.db) {
        notify("Firestore nie je inicializovaný.", "error");
        return;
      }
      const categoryName = categoryIdToNameMap[categoryId];

      // Tu pridávame kontrolu, či je tím superštruktúrny
      const isSuperstructureTeam = true; // Pretože táto funkcia sa volá len pre superstructure tímy
      const fullTeamName = isSuperstructureTeam
        ? `${categoryName} ${teamName.trim()}`
        : teamName.trim();

      const isDuplicateFinal = allTeams.some(team => team.teamName === fullTeamName);
      if (isDuplicateFinal) {
        notify(`Tím '${fullTeamName}' už existuje. Ukladanie zrušené.`, "error");
        return;
      }
      try {
        const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
        const docSnap = await getDoc(superstructureDocRef);
        const globalTeamsData = docSnap.exists() ? docSnap.data() : {};
        const currentTeamsForCategory = globalTeamsData[categoryName] || [];
        const teamsInTargetGroup = currentTeamsForCategory.filter(t => t.groupName === groupName);
        let maxOrder = 0;
        teamsInTargetGroup.forEach(t => {
          if (t.order > maxOrder) maxOrder = t.order;
        });
        const newOrder = order != null ? parseInt(order, 10) : (groupName ? maxOrder + 1 : null);
        const newTeam = {
          teamName: fullTeamName,
          groupName: groupName || null,
          order: newOrder,
          id: crypto.randomUUID()
        };
        const updatedTeamsArray = [...currentTeamsForCategory, newTeam];
        await setDoc(superstructureDocRef, {
          ...globalTeamsData,
          [categoryName]: updatedTeamsArray
        }, { merge: true });
        await createTeamAssignmentNotification('add_new_global', {
          id: newTeam.id,
          teamName: teamName.trim(),
          category: categoryName,
          groupName: groupName || null,
          order: newOrder
        });

        notify(`Nový tím '${fullTeamName}' bol pridaný ${groupName ? `do skupiny '${groupName}'` : 'bez skupiny'}.`, "success");
      } catch (error) {
        console.error("Chyba pri pridávaní nového tímu:", error);
        notify("Nepodarilo sa pridať nový tím do skupiny.", "error");
      }
    };
    const handleUpdateUserTeam = async ({ categoryId, groupName, teamName, order, originalTeam }) => {
        if (!window.db || !originalTeam?.uid || !originalTeam?.id) return;
   
        const categoryName = categoryIdToNameMap[categoryId];
        if (categoryName !== originalTeam.category) {
            notify("Kategóriu tímu nemôžete meniť.", "error");
            return;
        }
   
        const finalTeamName = `${teamName.trim()}`;
        const userRef = doc(window.db, 'users', originalTeam.uid);
   
        try {
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                notify("Používateľ už neexistuje.", "error");
                return;
            }
            const userData = userSnap.data();
            const teamsInCategory = [...(userData.teams?.[categoryName] || [])];
            const teamIndex = teamsInCategory.findIndex(t => t.teamName === originalTeam.teamName);
            if (teamIndex === -1) {
                notify("Tím sa nenašiel v profile používateľa (podľa názvu).", "error");
                return;
            }
   
          const newGroup = groupName || null;
          let newOrder = null;
         
            if (groupName) {
                const othersInGroup = teamsInCategory.filter(t => t.groupName === newGroup && t.teamName !== originalTeam.teamName);
                const max = othersInGroup.reduce((m, t) => Math.max(m, t.order || 0), 0);
                newOrder = order != null ? parseInt(order, 10) : max + 1;
            }
   
            teamsInCategory[teamIndex] = {
                ...teamsInCategory[teamIndex],
                teamName: teamName.trim(),
                groupName: groupName || null,
                order: newOrder
            };
            await updateDoc(userRef, { [`teams.${categoryName}`]: teamsInCategory });
   
            const action = originalTeam.groupName === groupName ? 'change_group_user' : 'assign_user';
            await createTeamAssignmentNotification(action, {
                id: originalTeam.id,
                teamName: teamName.trim(),
                category: categoryName,
                groupName: groupName || null
            });
   
            notify(`Tím '${finalTeamName}' bol ${groupName ? 'zaradený/upravený' : 'odstránený zo skupiny'} v kategórii '${categoryName}'.`, "success");
        } catch (err) {
            console.error("Chyba pri aktualizácii tímu:", err);
            notify("Nepodarilo sa aktualizovať zaradenie tímu do skupiny.", "error");
        }
    };
    // ===================================================================
    // MODÁLNE OKNO (ako vnútorný komponent)
    // ===================================================================
    const NewTeamModal = ({
      isOpen,
      onClose,
      teamToEdit,
      allTeams = [],
      categoryIdToNameMap = {},
      allGroupsByCategoryId = {},
      defaultCategoryId = '',
      defaultGroupName = '',
      unifiedSaveHandler
    }) => {
      const { useState, useEffect } = React;
      const [orderInputValue, setOrderInputValue] = useState(null);
      const [selectedCategory, setSelectedCategory] = useState('');
      const [selectedGroup, setSelectedGroup] = useState('');
      const [teamName, setTeamName] = useState('');
      const [isDuplicate, setIsDuplicate] = useState(false);
      const [originalTeamName, setOriginalTeamName] = useState('');
      const [originalCategory, setOriginalCategory] = useState('');
      const [originalGroup, setOriginalGroup] = useState('');
      const isCategoryLocked = !!teamToEdit && !teamToEdit.isSuperstructureTeam;
      const isCategoryFixed = !!defaultCategoryId && !teamToEdit;
      const isGroupFixed = !!defaultGroupName && !teamToEdit;
      const [groupEndingMismatch, setGroupEndingMismatch] = useState(false);
      const [orderMismatchMessage, setOrderMismatchMessage] = useState(null); // string = chybová hláška, null = OK
      // ────────────────────────────────────────────────
      // Validácia: koncovka + prípadné číslo pred ňou
      // ────────────────────────────────────────────────
      useEffect(() => {
        if (!isOpen || teamToEdit || !selectedCategory || !teamName.trim()) {
          setGroupEndingMismatch(false);
          setOrderMismatchMessage(null);
          return;
        }
        const trimmed = teamName.trim();
        const lastChar = trimmed.slice(-1).toLowerCase();
        const groups = allGroupsByCategoryId[selectedCategory] || [];
        // Iba základné skupiny
        const basicGroups = groups.filter(g => g.type === 'základná skupina');
        // Existuje aspoň jedna základná skupina končiaca na dané písmeno?
        const hasMatchingBasicGroup = basicGroups.some(
          g => g.name.slice(-1).toLowerCase() === lastChar
        );
        setGroupEndingMismatch(!hasMatchingBasicGroup);
        // Ak existuje základná skupina a je pred písmenom aspoň 1 znak → kontrola čísla
        if (hasMatchingBasicGroup && trimmed.length >= 2) {
          const numberPart = trimmed.slice(0, -1).trim();
          const requestedOrder = parseInt(numberPart, 10);
          if (!isNaN(requestedOrder) && requestedOrder >= 1) {
            // nájdeme prvú základnú skupinu končiacu na lastChar
            const matchingBasicGroup = basicGroups.find(
              g => g.name.slice(-1).toLowerCase() === lastChar
            );
            if (!matchingBasicGroup) {
              setOrderMismatchMessage(null);
              return;
            }
            const groupName = matchingBasicGroup.name;
            const categoryName = categoryIdToNameMap[selectedCategory];
            // počet tímov iba v tejto základnej skupine
            const teamsInGroup = allTeams.filter(
              t => t.category === categoryName && t.groupName === groupName
            );
            const currentCount = teamsInGroup.length;
            if (currentCount < requestedOrder) {
              setOrderMismatchMessage(
                `V základnej skupine "${groupName}" nie je tím s poradovým číslom ${requestedOrder}.`
              );
            } else {
              setOrderMismatchMessage(null);
            }
          } else {
            setOrderMismatchMessage(null);
          }
        } else {
          setOrderMismatchMessage(null);
        }
      }, [
        teamName,
        selectedCategory,
        isOpen,
        teamToEdit,
        allTeams,
        allGroupsByCategoryId,
        categoryIdToNameMap
      ]);
   
      useEffect(() => {
        if (!isOpen || !selectedGroup) {
          setOrderInputValue(null);
          return;
        }
   
        if (teamToEdit && teamToEdit.groupName === selectedGroup && teamToEdit.order != null) {
          setOrderInputValue(teamToEdit.order);
          return;
        }
   
        const currentCategoryName = categoryIdToNameMap[selectedCategory];
        if (!currentCategoryName) return;
   
        const teamsInThisGroup = allTeams.filter(
          t => t.category === currentCategoryName && t.groupName === selectedGroup
        );
   
        if (teamsInThisGroup.length === 0) {
          setOrderInputValue(1);
          return;
        }
   
        const usedOrders = new Set(
          teamsInThisGroup
            .map(t => t.order)
            .filter(o => typeof o === 'number' && o > 0)
        );
   
        const maxOrder = Math.max(...usedOrders, 0);
        let freeOrder = 1;
        while (usedOrders.has(freeOrder)) freeOrder++;
   
        setOrderInputValue(freeOrder);
      }, [selectedGroup, isOpen, teamToEdit, allTeams, selectedCategory, categoryIdToNameMap]);
   
      useEffect(() => {
        if (isOpen) {
          if (teamToEdit) {
            const categoryId = Object.keys(categoryIdToNameMap).find(
              id => categoryIdToNameMap[id] === teamToEdit.category
            ) || '';
   
            // Ak je kategória locked, nastavíme ju raz a už sa nebude dať meniť
            setSelectedCategory(categoryId);
            setSelectedGroup(teamToEdit.groupName || '');
   
            const teamNameWithoutPrefix = teamToEdit.teamName.replace(
              new RegExp(`^${teamToEdit.category} `), ''
            );
            setTeamName(teamNameWithoutPrefix);
   
            setOriginalTeamName(teamToEdit.teamName);
            setOriginalCategory(categoryId);
            setOriginalGroup(teamToEdit.groupName || '');
          } else {
            setSelectedCategory(defaultCategoryId || '');
            setSelectedGroup(defaultGroupName || '');
            setTeamName('');
            setOriginalTeamName('');
            setOriginalCategory('');
            setOriginalGroup('');
          }
        } else {
          setSelectedCategory('');
          setSelectedGroup('');
          setTeamName('');
          setIsDuplicate(false);
          setOriginalTeamName('');
          setOriginalCategory('');
          setOriginalGroup('');
          setOrderInputValue(null);
        }
  }, [isOpen, teamToEdit, defaultCategoryId, defaultGroupName, categoryIdToNameMap]);
        useEffect(() => {
          if (!isOpen) return;

          const trimmedName = teamName.trim();
          if (!trimmedName || !selectedCategory) {
              setIsDuplicate(false);
              return;
          }

          const categoryName = categoryIdToNameMap[selectedCategory];
          if (!categoryName) {
              setIsDuplicate(false);
              return;
          }

          // Kontrola duplicity podľa čistého mena + kategória
          const isDuplicate = allTeams.some(team => {
              const teamNameToCompare = team.isSuperstructureTeam
                  ? team.teamName.replace(new RegExp(`^${categoryName} `), '').trim()
                  : team.teamName.trim();
              return (
                  team.category === categoryName &&
                  teamNameToCompare === trimmedName &&
                  (!teamToEdit || team.teamName.trim() !== originalTeamName.trim())
              );
          });

          setIsDuplicate(isDuplicate);
      }, [teamName, selectedCategory, allTeams, categoryIdToNameMap, teamToEdit, originalTeamName]);
      
        const sortedCategoryEntries = Object.entries(categoryIdToNameMap)
            .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));
          const availableGroups = selectedCategory && allGroupsByCategoryId[selectedCategory]
            ? allGroupsByCategoryId[selectedCategory].sort((a, b) => a.name.localeCompare(b.name))
            : [];
       
          const handleCategoryChange = (e) => {
            // Ak je kategória locked, zmena sa ignoruje
            if (isCategoryLocked) return;
            setSelectedCategory(e.target.value);
            if (!defaultGroupName) setSelectedGroup('');
          };
        const handleSubmit = (e) => {
            e.preventDefault();
            if (isSubmitDisabled) return;
            unifiedSaveHandler({
                categoryId: selectedCategory,
                groupName: selectedGroup || null,
                teamName: teamName.trim(),
                order: orderInputValue,
                isEdit: !!teamToEdit,
                originalTeam: teamToEdit
            });
        };
        const isCategoryValid = !!selectedCategory;
        const isGroupValid = !!selectedGroup;
        const isTeamNameValid = teamName.trim().length > 0;
        const isSubmitDisabled =
          !isCategoryValid ||
          !isGroupValid ||
          !isTeamNameValid ||
          isDuplicate ||
          groupEndingMismatch ||
          !!orderMismatchMessage;
        const modalTitle = teamToEdit ? 'Upraviť tím' : 'Pridať nový tím';
        const buttonText = teamToEdit ? 'Aktualizovať tím' : 'Pridať tím';
     
        if (!isOpen) return null;
        const currentCategoryName = categoryIdToNameMap[selectedCategory] || '';
        const finalTeamNamePreview = teamName.trim() ? (teamToEdit?.isSuperstructureTeam || !teamToEdit) ? `${currentCategoryName} ${teamName.trim()}` : teamName.trim() : '';
        return React.createElement(
          'div',
          {
            className: 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[100]',
            onClick: onClose
          },
          React.createElement(
            'div',
            {
              className: 'bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg',
              onClick: (e) => e.stopPropagation()
            },
            React.createElement(
              'h2',
              { className: 'text-2xl font-bold text-gray-800 mb-6 text-center' },
              modalTitle
            ),
            !teamToEdit
              ? React.createElement(
                  'div',
                  { className: 'mb-6' },
                  React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Názov tímu (bez názvu kategórie):'),
                  React.createElement('input', {
                    type: 'text',
                    className: `w-full p-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                      isDuplicate || groupEndingMismatch || orderMismatchMessage ? 'border-red-500' : 'border-gray-300'
                    }`,
                    value: teamName,
                    onChange: (e) => setTeamName(e.target.value),
                    required: true,
                    autoFocus: true
                  }),
                  finalTeamNamePreview && React.createElement(
                    'div',
                    { className: 'mt-3 p-3 bg-indigo-50 rounded-lg text-center' },
                    React.createElement('p', { className: 'text-sm text-gray-600' }, 'Finálny (dočasný) názov bude:'),
                    React.createElement('p', { className: 'text-lg font-bold text-indigo-700 mt-1' }, finalTeamNamePreview)
                  ),
                  isDuplicate && React.createElement(
                    'p',
                    { className: 'mt-2 text-sm text-red-600 font-medium' },
                    '⚠️ Tím s týmto názvom už existuje!'
                  ),
                  groupEndingMismatch && React.createElement(
                    'p',
                    { className: 'mt-2 text-sm text-red-600 font-medium' },
                    `⚠️ V tejto kategórii neexistuje žiadna základná skupina končiaca na „${teamName.trim().slice(-1).toUpperCase()}“`
                  ),
                  orderMismatchMessage && React.createElement(
                    'p',
                    { className: 'mt-2 text-sm text-red-600 font-medium' },
                    `⚠️ ${orderMismatchMessage}`
                  )
                )
              : React.createElement(
                  'div',
                  { className: 'mb-6 text-center' },
                  React.createElement('p', { className: 'text-sm text-gray-600' }, 'Aktuálny názov tímu:'),
                  React.createElement('p', { className: 'text-2xl font-bold text-indigo-700 mt-1' }, teamToEdit.teamName)
                ),
                React.createElement(
                    'form',
                    { onSubmit: handleSubmit, className: 'space-y-6' },
                    React.createElement(
                      'div',
                      { className: 'flex flex-col' },
                      React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Kategória:'),
                      React.createElement(
                        'select',
                        {
                          className: `p-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 ${
                            isCategoryLocked || isCategoryFixed
                              ? 'bg-gray-100 cursor-not-allowed'
                              : 'border-gray-300'
                          }`,
                          value: selectedCategory,
                          onChange: handleCategoryChange,
                          required: true,
                          disabled: isCategoryLocked || isCategoryFixed
                        },
                        React.createElement('option', { value: '' }, '--- Vyberte kategóriu ---'),
                        sortedCategoryEntries.map(([id, name]) =>
                          React.createElement('option', { key: id, value: id }, name)
                        )
                      ),
                      (isCategoryLocked || isCategoryFixed) &&
                        React.createElement(
                          'p',
                          { className: 'text-xs text-indigo-600 mt-1 italic' },
                          isCategoryLocked
                            ? 'Kategóriu používateľského tímu nemožno meniť.'
                            : `Predvolená kategória: ${categoryIdToNameMap[defaultCategoryId]}`
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Skupina:'),
                        React.createElement(
                            'select',
                            {
                                className: `p-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 ${!selectedCategory || isGroupFixed ? 'bg-gray-100 cursor-not-allowed' : ''}`,
                                value: selectedGroup,
                                onChange: (e) => setSelectedGroup(e.target.value),
                                required: true,
                                disabled: !selectedCategory || isGroupFixed
                            },
                            React.createElement('option', { value: '' }, availableGroups.length > 0 ? '--- Vyberte skupinu ---' : 'Najprv vyberte kategóriu'),
                            availableGroups.map((group) => React.createElement('option', { key: group.name, value: group.name }, `${group.name} (${group.type})`))
                        ),
                        isGroupFixed && React.createElement('p', { className: 'text-xs text-indigo-600 mt-1' }, `Predvolená skupina: ${defaultGroupName}`)
                    ),
                    selectedGroup && React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Poradie v skupine:'),
                        React.createElement('input', {
                            type: 'number',
                            min: '1',
                            className: 'p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 w-32',
                            value: orderInputValue ?? '',
                            onChange: (e) => setOrderInputValue(e.target.value === '' ? null : parseInt(e.target.value, 10)),
                            placeholder: 'auto'
                        }),
                    ),
                    React.createElement(
                        'div',
                        { className: 'pt-8 flex justify-end space-x-4' },
                        React.createElement('button', {
                            type: 'button',
                            className: 'px-6 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors',
                            onClick: onClose
                        }, 'Zrušiť'),
                        React.createElement('button', {
                            type: 'submit',
                            className: `
                                px-6 py-2.5
                                rounded-lg
                                text-white
                                font-medium
                                transition-colors
                                duration-200
                                ${isSubmitDisabled
                                    ? 'bg-gray-400 cursor-not-allowed opacity-60'
                                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'}
                            `,
                            disabled: isSubmitDisabled
                        }, buttonText)
                    )
                )
            )
        );
    };
    // Zjednotený handler pre uloženie
    const unifiedSaveHandler = async (data) => {
      if (data.isEdit) {
        await handleUpdateAnyTeam(data);
      } else {
        await handleAddNewTeam(data);
      }
      closeModal();
    };
    const closeModal = () => {
      setIsModalOpen(false);
      setTeamToEdit(null);
    };
    const openAddModal = () => {
        setTeamToEdit(null);
        setIsModalOpen(true);
    };
    // ===================================================================
    // Zvyšok kódu – listenery, render funkcie, return
    // ===================================================================
    useEffect(() => {
        if (!window.db) return;
        const unsubscribeUsers = onSnapshot(query(collection(window.db, 'users')), (querySnapshot) => {
            let userTeamsList = [];
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData && userData.teams) {
                    Object.entries(userData.teams).forEach(([categoryName, teamArray]) => {
                        if (Array.isArray(teamArray)) {
                            teamArray.forEach(team => {
                                if (team.teamName) {
                                    const hasGroup = team.groupName && team.groupName.trim() !== '';
                                    userTeamsList.push({
                                        uid: doc.id,
                                        category: categoryName,
                                        id: team.id,
                                        teamName: team.teamName,
                                        groupName: team.groupName || null,
                                        order: hasGroup ? (team.order ?? 0) : null,
                                        isSuperstructureTeam: false,
                                    });
                                }
                            });
                        }
                    });
                }
            });
            setUserTeamsData(userTeamsList);
        });
        const unsubscribeSuperstructure = onSnapshot(doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/')), (docSnap) => {
            setSuperstructureTeams(docSnap.exists() ? docSnap.data() : {});
        });
        const unsubscribeCategories = onSnapshot(doc(window.db, 'settings', 'categories'), (docSnap) => {
            const categoryIdToName = {};
            if (docSnap.exists()) {
                const categoryData = docSnap.data();
                Object.entries(categoryData).forEach(([categoryId, categoryObject]) => {
                    if (categoryObject && categoryObject.name) {
                        categoryIdToName[categoryId] = categoryObject.name;
                    }
                });
            }
            setCategoryIdToNameMap(categoryIdToName);
        });
        const unsubscribeGroups = onSnapshot(doc(window.db, 'settings', 'groups'), (docSnap) => {
            const groupsByCategoryId = {};
            if (docSnap.exists()) {
                const groupData = docSnap.data();
                Object.entries(groupData).forEach(([categoryId, groupArray]) => {
                    if (Array.isArray(groupArray)) {
                        groupsByCategoryId[categoryId] = groupArray.map(group => ({
                            name: group.name,
                            type: group.type
                        }));
                    }
                });
            }
            setAllGroupsByCategoryId(groupsByCategoryId);
        });
        return () => {
            unsubscribeUsers();
            unsubscribeSuperstructure();
            unsubscribeCategories();
            unsubscribeGroups();
        };
    }, []);
    useEffect(() => {
        const globalTeamsList = Object.entries(superstructureTeams).flatMap(([categoryName, teamArray]) =>
            (teamArray || []).map(team => ({
                uid: 'global',
                category: categoryName,
                id: team.id || crypto.randomUUID(),
                teamName: team.teamName,
                groupName: team.groupName || null,
                order: team.groupName ? (team.order ?? 0) : null,
                isSuperstructureTeam: true
            }))
        );
        setAllTeams([...userTeamsData, ...globalTeamsList]);
    }, [userTeamsData, superstructureTeams]);
    // Hash sync logika (nezmenená)
    useEffect(() => {
        const readHash = () => {
            const hash = window.location.hash.substring(1);
            if (!hash) {
                setSelectedCategoryId('');
                setSelectedGroupName('');
                return;
            }
            const [catSlug, groupSlug] = hash.split('/');
            const catName = decodeURIComponent(catSlug).replace(/-/g, ' ');
            const groupName = groupSlug ? decodeURIComponent(groupSlug).replace(/-/g, ' ') : '';
            const catId = Object.entries(categoryIdToNameMap).find(([, name]) => name === catName)?.[0];
            setSelectedCategoryId(catId || '');
            setSelectedGroupName(groupName);
        };
        readHash();
        window.addEventListener('hashchange', readHash);
        return () => window.removeEventListener('hashchange', readHash);
    }, [categoryIdToNameMap]);
    useEffect(() => {
        if (!isInitialHashReadComplete) return;
        const catName = categoryIdToNameMap[selectedCategoryId];
        if (!catName) {
            window.location.replace('#');
            return;
        }
        let hash = encodeURIComponent(catName.replace(/ /g, '-'));
        if (selectedGroupName) {
            hash += `/${encodeURIComponent(selectedGroupName.replace(/ /g, '-'))}`;
        }
        window.location.replace(`#${hash}`);
    }, [selectedCategoryId, selectedGroupName, categoryIdToNameMap, isInitialHashReadComplete]);
    const handleCategorySelect = (e) => {
        const id = e.target.value;
        setSelectedCategoryId(id);
        const name = categoryIdToNameMap[id];
        window.location.replace(name ? `#${encodeURIComponent(name.replace(/ /g, '-'))}` : '#');
    };
    const handleGroupSelect = (e) => {
        const group = e.target.value;
        setSelectedGroupName(group);
        const catName = categoryIdToNameMap[selectedCategoryId];
        if (!catName) return;
        let hash = `#${encodeURIComponent(catName.replace(/ /g, '-'))}`;
        if (group) hash += `/${encodeURIComponent(group.replace(/ /g, '-'))}`;
        window.location.replace(hash);
    };
    const getGroupColorClass = (type) => {
        switch (type) {
            case 'základná skupina': return 'bg-gray-100';
            case 'nadstavbová skupina': return 'bg-blue-100';
            default: return 'bg-white';
        }
    };
    const renderTeamList = (teamsToRender, targetGroupId, targetCategoryId, isWithoutGroup = false) => {
        // Pomocná funkcia na získanie "čistého" mena bez prefixu kategórie
        const getCleanDisplayName = (team) => {
          let name = team.teamName;
          if (team.isSuperstructureTeam && team.category && name.startsWith(team.category + ' ')) {
            name = name.substring(team.category.length + 1).trim();
          }
          return name;
        };
   
        if (isWithoutGroup) {
            // Tímy bez skupiny → triedime len podľa názvu, bez čísel a placeholderov
            const sortedTeams = [...teamsToRender].sort((a, b) =>
                a.teamName.localeCompare(b.teamName)
            );
   
            const items = sortedTeams.map((team, idx) => {
                let display = getCleanDisplayName(team);
                if (!selectedCategoryId) {
                    // ak zobrazujeme všetky kategórie → ukážeme aj názov kategórie
                    display = `${team.category}: ${display}`;
                }
   
                const showDeleteButton = !isWithoutGroup || team.isSuperstructureTeam;
   
                return React.createElement(
                    'li',
                    {
                        key: team.id || `${team.uid || 'g'}-${team.teamName}-${team.groupName || ''}-${idx}`,
                        className: `flex justify-between items-center px-4 py-3 rounded-lg border shadow-sm ${team.isSuperstructureTeam ? 'bg-yellow-50' : 'bg-white'}`
                    },
                    React.createElement('span', { className: 'flex-grow text-gray-800' }, display),
   
                    React.createElement(
                        'div',
                        { className: 'flex items-center space-x-1' },
                        React.createElement(
                            'button',
                            {
                                onClick: () => {
                                    setTeamToEdit(team);
                                    setIsModalOpen(true);
                                },
                                className: 'text-gray-500 hover:text-indigo-600 p-1.5 rounded-full hover:bg-indigo-50 transition-colors',
                                title: 'Upraviť tím'
                            },
                            React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                            )
                        ),
                        showDeleteButton &&
                        React.createElement(
                            'button',
                            {
                                onClick: () => handleRemoveOrDeleteTeam(team),
                                className: 'text-gray-500 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors',
                                title: team.isSuperstructureTeam ? 'Odstrániť tím' : 'Zrušiť zaradenie do skupiny'
                            },
                            React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                            )
                        )
                    )
                );
            });
   
            return React.createElement('ul', { className: 'space-y-2' }, ...items);
        }
   
        // ────────────────────────────────────────────────
        // Skupina → zoradíme podľa order + doplníme missing placeholder-y
        // ────────────────────────────────────────────────
   
        const sortedTeams = [...teamsToRender].sort((a, b) => {
            const oa = typeof a.order === 'number' ? a.order : Infinity;
            const ob = typeof b.order === 'number' ? b.order : Infinity;
            return oa - ob;
        });
   
        // Zoznam všetkých použitých poradových čísel (iba platné celé čísla ≥ 1)
        const usedOrders = new Set(
            sortedTeams
                .map(t => t.order)
                .filter(o => Number.isInteger(o) && o >= 1)
        );
   
        const maxOrder = usedOrders.size > 0 ? Math.max(...usedOrders) : 0;
   
        const items = [];
   
        // Vytvoríme riadky od 1 po maxOrder (vrátane dier)
        for (let pos = 1; pos <= maxOrder; pos++) {
            const teamsAtThisPosition = sortedTeams.filter(t => t.order === pos);
            const hasDuplicate = teamsAtThisPosition.length > 1;
   
            if (teamsAtThisPosition.length === 0) {
              // CHÝBAJÚCI tím → placeholder + kôš
              items.push(
                React.createElement(
                  'li',
                  {
                    key: `missing-${targetGroupId || 'global'}-${pos}`,
                    className: 'flex items-center justify-between px-4 py-3 rounded-lg border-2 border-dashed border-gray-400 bg-gray-50/60 italic text-gray-500 text-sm'
                  },
                  React.createElement(
                    'div',
                    { className: 'flex items-center space-x-3 flex-grow' },
                    React.createElement(
                      'span',
                      { className: 'text-center flex-grow' },
                      `V skupine chýba tím s poradovým číslom ${pos}.`
                    )
                  ),
                  React.createElement(
                    'button',
                    {
                      onClick: () => {
                        // otvoríme modálne okno na potvrdenie odstránenia diery
                        setDeleteGapModal({
                          categoryName: categoryIdToNameMap[targetCategoryId],
                          groupName: targetGroupId,
                          position: pos,
                          open: true
                        });
                      },
                      className: 'text-gray-500 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors',
                      title: 'Odstrániť voľné miesto (posunúť nasledujúce tímy)'
                    },
                    React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                    )
                  )
                )
              );
            } else {
                // Jeden alebo viac tímov na tomto poradovom čísle
                teamsAtThisPosition.forEach((team, teamIdx) => {
                    const displayName = getCleanDisplayName(team);
                    const textColor = hasDuplicate ? 'text-red-700 font-semibold' : 'text-gray-800';
   
                    items.push(
                        React.createElement(
                            'li',
                            {
                                key: team.id || `team-${pos}-${team.teamName}-${teamIdx}`,
                                className: `flex justify-between items-center px-4 py-3 rounded-lg border shadow-sm ${team.isSuperstructureTeam ? 'bg-yellow-50' : 'bg-white'} ${hasDuplicate ? 'border-red-300' : ''}`
                            },
                            React.createElement(
                                'span',
                                { className: `flex-grow ${textColor}` },
                                `${pos}. ${displayName}${hasDuplicate ? '' : ''}`
                            ),
                            React.createElement(
                                'div',
                                { className: 'flex items-center space-x-1' },
                                React.createElement(
                                    'button',
                                    {
                                        onClick: () => {
                                            setTeamToEdit(team);
                                            setIsModalOpen(true);
                                        },
                                        className: 'text-gray-500 hover:text-indigo-600 p-1.5 rounded-full hover:bg-indigo-50 transition-colors',
                                        title: 'Upraviť tím'
                                    },
                                    React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                                    )
                                ),
                                React.createElement(
                                    'button',
                                    {
                                        onClick: () => handleRemoveOrDeleteTeam(team),
                                        className: 'text-gray-500 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors',
                                        title: team.isSuperstructureTeam ? 'Odstrániť tím' : 'Zrušiť zaradenie do skupiny'
                                    },
                                    React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                                    )
                                )
                            )
                        )
                    );
                });
            }
        }
   
        // Extra tímy s order > maxOrder (napr. ručne nastavené vysoké číslo)
        sortedTeams
            .filter(t => typeof t.order === 'number' && t.order > maxOrder)
            .forEach(team => {
                const displayName = getCleanDisplayName(team);
                items.push(
                    React.createElement(
                        'li',
                        {
                            key: team.id || `extra-${team.order}-${team.teamName}`,
                            className: 'flex justify-between items-center px-4 py-3 rounded-lg border shadow-sm bg-orange-50/70 border-orange-300'
                        },
                        React.createElement(
                            'span',
                            { className: 'flex-grow text-orange-800' },
                            `${team.order}. ${displayName} (vyššie ako aktuálne maximum)`
                        ),
                        // tlačidlá edit / delete (rovnaké ako vyššie)
                        React.createElement(
                            'div',
                            { className: 'flex items-center space-x-1' },
                            React.createElement(
                                'div',
                                { className: 'flex items-center space-x-1' },
                                React.createElement(
                                    'button',
                                    {
                                        onClick: () => { setTeamToEdit(team); setIsModalOpen(true); },
                                        className: 'text-gray-500 hover:text-indigo-600 p-1.5 rounded-full hover:bg-indigo-50 transition-colors',
                                        title: 'Upraviť tím'
                                    },
                                    React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                                    )
                                ),
                                React.createElement(
                                    'button',
                                    {
                                        onClick: () => handleRemoveOrDeleteTeam(team),
                                        className: 'text-gray-500 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors',
                                        title: team.isSuperstructureTeam ? 'Odstrániť tím' : 'Zrušiť zaradenie do skupiny'
                                    },
                                    React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                                    )
                                )
                            )
                        )
                    )
                );
            });
   
        return React.createElement('ul', { className: 'space-y-2' }, ...items);
    };
    const renderGroupedCategories = () => {
        if (Object.keys(allGroupsByCategoryId).length === 0) {
            return React.createElement('div', { className: 'w-full max-w-xl mx-auto' },
                React.createElement('p', { className: 'text-center text-gray-500' }, 'Žiadne skupiny neboli nájdené.')
            );
        }
        const sortedCategoryEntries = Object.entries(categoryIdToNameMap).sort(([, a], [, b]) => a.localeCompare(b));
        return React.createElement(
            'div',
            { className: 'flex flex-wrap gap-2 sm:gap-2 justify-center' },
            sortedCategoryEntries.map(([categoryId, categoryName], index) => {
                const groups = allGroupsByCategoryId[categoryId] || [];
                const teamsInThisCategory = allTeams.filter(team => team.category === categoryName);
                const sortedGroups = [...groups].sort((a, b) => {
                    if (a.type === 'základná skupina' && b.type !== 'základná skupina') return -1;
                    if (b.type === 'základná skupina' && a.type !== 'základná skupina') return 1;
                    return a.name.localeCompare(b.name);
                });
                return React.createElement(
                    'div',
                    { key: index, className: 'flex flex-col bg-white rounded-xl shadow-xl p-6 mb-3 flex-shrink-0' },
                    React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center whitespace-nowrap' }, categoryName),
                    React.createElement('ul', { className: 'space-y-2' },
                        sortedGroups.map((group, groupIndex) =>
                            React.createElement(
                                'li',
                                { key: groupIndex, className: `px-4 py-2 rounded-lg text-gray-700 whitespace-nowrap ${getGroupColorClass(group.type)}` },
                                React.createElement('div', null,
                                    React.createElement('p', { className: 'font-semibold whitespace-nowrap' }, group.name),
                                    React.createElement('p', { className: 'text-sm text-gray-500 whitespace-nowrap' }, group.type),
                                    React.createElement('div', { className: 'mt-2 space-y-1' },
                                        renderTeamList(teamsInThisCategory.filter(t => t.groupName === group.name), group.name, categoryId)
                                    )
                                )
                            )
                        )
                    )
                );
            })
        );
    };
    const renderSingleCategoryView = () => {
        const categoryName = categoryIdToNameMap[selectedCategoryId] || "Neznáma kategória";
        let groups = allGroupsByCategoryId[selectedCategoryId] || [];
        if (selectedGroupName) {
            groups = groups.filter(g => g.name === selectedGroupName);
        }
        const sortedGroups = [...groups].sort((a, b) => {
            if (a.type === 'základná skupina' && b.type !== 'základná skupina') return -1;
            if (b.type === 'základná skupina' && a.type !== 'základná skupina') return 1;
            return a.name.localeCompare(b.name);
        });
        const teamsWithoutGroupHeight = teamsWithoutGroupRef.current?.offsetHeight || null;
        return React.createElement(
            'div',
            { className: 'flex flex-col lg:flex-row justify-center space-x-0 lg:space-x-3 w-full px-4' },
            React.createElement(
                'div',
                {
                    ref: teamsWithoutGroupRef,
                    className: "w-full lg:w-1/4 max-w-sm bg-white rounded-xl shadow-xl p-6 mb-4 flex-shrink-0"
                },
                React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center' }, `Tímy bez skupiny v\u00A0kategórii: ${categoryName}`),
                renderTeamList(teamsWithoutGroup, null, selectedCategoryId, true)
            ),
            React.createElement(
                'div',
                { className: 'flex-grow min-w-0 flex flex-col gap-3' },
                sortedGroups.length > 0 ? sortedGroups.map((group, groupIndex) => {
                    const customStyle = selectedGroupName && teamsWithoutGroupHeight
                        ? { minHeight: `${teamsWithoutGroupHeight}px` }
                        : {};
                    return React.createElement(
                        'div',
                        {
                            key: groupIndex,
                            className: `flex flex-col rounded-xl shadow-xl p-6 mb-3 flex-shrink-0 ${getGroupColorClass(group.type)}`,
                            style: customStyle
                        },
                        React.createElement('h3', { className: 'text-2xl font-semibold mb-2 text-center whitespace-nowrap' }, group.name),
                        React.createElement('p', { className: 'text-center text-sm text-gray-600 mb-4' }, group.type),
                        React.createElement('div', { className: 'mt-2 space-y-1' },
                            renderTeamList(teamsInGroups.filter(t => t.groupName === group.name), group.name, selectedCategoryId)
                        )
                    );
                }) : React.createElement('p', { className: 'text-center text-gray-500' }, 'Žiadne skupiny v tejto kategórii.')
            )
        );
    };
    const teamsWithoutGroup = selectedCategoryId
        ? allTeams.filter(t => t.category === categoryIdToNameMap[selectedCategoryId] && !t.groupName).sort((a, b) => a.teamName.localeCompare(b.teamName))
        : allTeams.filter(t => !t.groupName).sort((a, b) => a.teamName.localeCompare(b.teamName));
    const teamsInGroups = selectedCategoryId
        ? allTeams.filter(t => t.category === categoryIdToNameMap[selectedCategoryId] && t.groupName)
        : allTeams.filter(t => t.groupName);
    const sortedCategoryEntries = Object.entries(categoryIdToNameMap).sort(([,a], [,b]) => a.localeCompare(b));
    const availableGroupsForSelect = (allGroupsByCategoryId[selectedCategoryId] || []).sort((a, b) => a.name.localeCompare(b.name));
    const uiNotificationClasses = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-2xl text-white text-center z-[9999] transition-all duration-400 ease-in-out ${
        uiNotification
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-4 pointer-events-none'
    }`;
    let typeClasses = '';
    switch (uiNotification?.type) {
        case 'success': typeClasses = 'bg-green-500'; break;
        case 'error': typeClasses = 'bg-red-500'; break;
        case 'info': typeClasses = 'bg-blue-500'; break;
        default: typeClasses = 'bg-gray-700';
    }
    const fabBaseClasses = 'fixed bottom-8 right-8 p-5 rounded-full shadow-2xl transform focus:outline-none';
    const fabButton = React.createElement(
        'button',
        {
            className: `
                fixed bottom-8 right-8
                w-16 h-16
                rounded-full
                bg-green-600
                hover:bg-green-700
                text-white
                text-4xl
                font-bold
                shadow-2xl
                flex items-center justify-center
                focus:outline-none
                focus:ring-4 focus:ring-green-300
                z-40
            `,
            onClick: openAddModal,
            title: "Pridať nový tím",
            'aria-label': "Pridať nový tím"
        },
        '+'
    );
    return React.createElement(
        'div',
        { className: 'flex flex-col w-full relative text-[87.5%]' },
        React.createElement(NotificationPortal, null),
        React.createElement(NewTeamModal, {
            isOpen: isModalOpen,
            onClose: closeModal,
            teamToEdit,
            allTeams,
            categoryIdToNameMap,
            allGroupsByCategoryId,
            defaultCategoryId: selectedCategoryId,
            defaultGroupName: selectedGroupName,
            unifiedSaveHandler
        }),
        React.createElement(ConfirmDeleteModal, {
          isOpen: !!confirmModal?.open,
          onClose: () => setConfirmModal(null),
          onConfirm: handleConfirmRemove,
          team: confirmModal?.team,
          isConfirming: isConfirming
        }),
        React.createElement(ConfirmDeleteGapModal, {
          isOpen: !!deleteGapModal?.open,
          onClose: () => setDeleteGapModal(null),
          onConfirm: () => {
            if (deleteGapModal) {
              handleDeleteGap(
                deleteGapModal.categoryName,
                deleteGapModal.groupName,
                deleteGapModal.position
              );
            }
            setDeleteGapModal(null);
          },
          position: deleteGapModal?.position,
          groupName: deleteGapModal?.groupName,
          categoryName: deleteGapModal?.categoryName,
          isConfirming: false // prípadne pridaj loading stav ak chceš
        }),
        React.createElement(
            'div',
            { className: 'w-full max-w-xs mx-auto mb-8' },
            React.createElement('label', { className: 'block text-center text-xl font-semibold mb-2' }, 'Vyberte kategóriu:'),
            React.createElement(
                'select',
                {
                    className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200',
                    value: selectedCategoryId,
                    onChange: handleCategorySelect
                },
                React.createElement('option', { value: '' }, 'Všetky kategórie'),
                sortedCategoryEntries.map(([id, name]) => React.createElement('option', { key: id, value: id }, name))
            ),
            React.createElement('label', { className: 'block text-center text-xl font-semibold mb-2 mt-4' }, 'Vyberte skupinu (Voliteľné):'),
            React.createElement(
                'select',
                {
                    className: `w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${!selectedCategoryId ? 'opacity-50' : ''}`,
                    value: selectedGroupName,
                    onChange: handleGroupSelect,
                    disabled: !selectedCategoryId,
                    style: { cursor: !selectedCategoryId ? 'not-allowed' : 'pointer' }
                },
                React.createElement('option', { value: '' }, 'Zobraziť všetky skupiny'),
                availableGroupsForSelect.map((group, index) =>
                    React.createElement('option', { key: index, value: group.name }, `${group.name} (${group.type})`)
                )
            )
        ),
        selectedCategoryId
            ? renderSingleCategoryView()
            : React.createElement(
                'div',
                { className: 'flex flex-col lg:flex-row justify-center space-x-0 lg:space-x-4 w-full px-4' },
                React.createElement(
                    'div',
                    { className: 'w-full lg:w-1/4 max-w-sm bg-white rounded-xl shadow-xl p-8 mb-6 flex-shrink-0' },
                    React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center' }, 'Zoznam všetkých tímov'),
                    renderTeamList(teamsWithoutGroup, null, null, true)
                ),
                React.createElement('div', { className: 'flex-grow min-w-0' }, renderGroupedCategories())
            ),
        fabButton
    );
};
// Inicializácia aplikácie
let isEmailSyncListenerSetup = false;
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        if (userProfileData) {
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
            if (window.auth && window.db && !isEmailSyncListenerSetup) {
                onAuthStateChanged(window.auth, async (user) => {
                    if (user) {
                        try {
                            const userProfileRef = doc(window.db, 'users', user.uid);
                            const docSnap = await getDoc(userProfileRef);
                            if (docSnap.exists()) {
                                const firestoreEmail = docSnap.data().email;
                                if (user.email !== firestoreEmail) {
                                    await updateDoc(userProfileRef, { email: user.email });
                                    const notificationsCollectionRef = collection(window.db, 'notifications');
                                    await addDoc(notificationsCollectionRef, {
                                        userEmail: user.email,
                                        changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                        timestamp: new Date(),
                                    });
                                }
                            }
                        } catch (error) {
                            console.error("Chyba pri synchronizácii e-mailu:", error);
                        }
                    }
                });
                isEmailSyncListenerSetup = true;
            }
        } else {
            root.render(React.createElement('div', { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            ));
        }
    }
};
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);
if (window.globalUserProfileData) {
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement('div', { className: 'flex justify-center items-center h-full pt-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        ));
    }
}

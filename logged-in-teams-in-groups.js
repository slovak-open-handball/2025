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
  const [notification, setNotification] = React.useState(null);
  useEffect(() => {
    let timer;
    const unsubscribe = subscribe((notif) => {
      setNotification(notif);
      clearTimeout(timer); // Vymaž predchádzajúci timer
      timer = setTimeout(() => setNotification(null), 5000);
    });
    
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
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
    const [showCategoryPrefix, setShowCategoryPrefix] = useState(true);
  
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

    // UPRAVENÉ: Ak už máme správu v dátach, použijeme ju
    if (team.message) {
        message = team.message;
    } else {
        // Pôvodná logika pre spätnú kompatibilitu
        let orderText = (team.order != null && group !== 'bez skupiny')
            ? ` (poradie: ${team.order})`
            : '';

        switch (action) {
            case 'assign_global':
                message = `Pre tím ${teamName} zmena: Skupina z 'bez skupiny' na '${group} (poradie: ${team.newOrder})'`;
                break;
            case 'change_group_global':
                message = `Pre tím ${teamName} zmena: Skupina z '${team.oldGroup || 'bez skupiny'} (poradie: ${team.oldOrder || '-'})' na '${group} (poradie: ${team.newOrder || '?'})'`;
                break;
            case 'assign_user':
                message = `Pre tím ${teamName} zmena: Skupina z 'bez skupiny' na '${group} (poradie: ${team.newOrder})'`;
                break;
            case 'change_group_user':
                message = `Pre tím ${teamName} zmena: Skupina z '${team.oldGroup || 'bez skupiny'} (poradie: ${team.oldOrder || '-'})' na '${group} (poradie: ${team.newOrder || '?'})'`;
                break;
            case 'add_new_global':
                message = `V kategórii ${category} vytvorený nový tím ${teamName} a priradený do skupiny '''${group}'${team.order ? ` s poradím: ${team.order}` : ''}`;
                break;
            case 'unassign_global':
                message = `Z kategórie ${category} a skupiny ${team.oldGroup || group} (poradie: ${team.order}) bol odstránený tím '''${teamName}'`;
                break;
            case 'unassign_user':
                message = `Z kategórie ${category} a skupiny ${team.oldGroup || group} (poradie: ${team.oldOrder}) bol odstránený tím '''${teamName}'`;
                break;
            case 'change_order_global':
                message = `Pre tím ${teamName} zmena: Poradie z '${team.oldOrder || '?'}' na '${team.newOrder || '?'}'`;
                break;
            case 'change_order_user':
                message = `Pre tím ${teamName} zmena: Poradie z '${team.oldOrder || '?'}' na '${team.newOrder || '?'}'`;
                break;
            case 'change_team_name':
                message = `Pre tím ${teamName} zmena: Názov tímu z '${team.oldTeamName}' na '${teamName}'`;
                break;
            default:
                message = `zmena tímu ${teamName} (${action}).`;
        }
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
            actionType: action,
            // Pridáme dodatočné informácie pre lepšie sledovanie zmien
            oldGroup: team.oldGroup || null,
            newGroup: team.groupName || null,
            oldOrder: team.oldOrder || null,
            newOrder: team.newOrder || team.order || null
        });
        console.log("[NOTIFIKÁCIA] Uložená:", message);
    } catch (err) {
        console.error("[NOTIFIKÁCIA] Chyba pri ukladaní:", err);
    }
};

      useEffect(() => {
        const handleResize = () => {
          setAllTeams(prev => [...prev]);
        };
  
        const handleZoomChange = () => {
          setAllTeams(prev => [...prev]);
        };
  
        window.addEventListener('resize', handleResize);
        window.addEventListener('zoomchange', handleZoomChange);
  
        return () => {
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('zoomchange', handleZoomChange);
        };
      }, []);
  

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

            // Získame informácie o tíme pred odstránením
            const originalGroup = teamToDelete.groupName;
            const originalOrder = teamToDelete.order;

            // Odstránime tím bez prečíslovania ostatných
            teams.splice(teamIndex, 1);

            // ODSTRANENÉ: Automatické prečíslovanie zostávajúcich tímov
            // const reorderedTeams = teams.map(t => {
            //     if (t.groupName === originalGroup && t.order != null && t.order > originalOrder) {
            //         return { ...t, order: t.order - 1 };
            //     }
            //     return t;
            // });
    
            // Namiesto toho ukladáme tím bez zmeny order ostatných
            await setDoc(superstructureDocRef, {
                ...globalTeamsData,
                [teamToDelete.category]: teams // použijeme pôvodné pole bez prečíslovania
            }, { merge: true });

            await createTeamAssignmentNotification('unassign_global', {
                id: teamToDelete.id,
                teamName: teamToDelete.teamName,
                category: teamToDelete.category,
                groupName: teamToDelete.groupName,
                order: teamToDelete.order,
                oldOrder: originalOrder,
            });

            notify(`Tím '${teamToDelete.teamName}' bol odstránený zo skupiny. Ostatné tímy zostávajú s pôvodnými poradovými číslami.`, "success");
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

            const originalTeam = teamsInCategory[teamIndex];
            const oldGroup = originalTeam.groupName;
            const oldOrder = originalTeam.order;
   
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
                groupName: oldGroup,
                oldGroup: oldGroup,
                oldOrder: oldOrder,
                order: oldOrder
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

    const finalTeamName = originalTeam.isSuperstructureTeam ? teamName.trim() : teamName.trim();  
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

            // Zistíme maximálne poradie v novej skupine
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
                groupName: newGroup || null,
                oldGroup: originalTeam.groupName || null,
                oldOrder: originalTeam.order || null, // Pôvodné poradie
                newOrder: newOrder, // Nové poradie
                oldTeamName: originalTeam.teamName || null
            };

            if (groupChanged || categoryChanged) {
                action = originalTeam.groupName ? 'change_group_global' : 'assign_global';
                
                // UPRAVENÉ: Pridáme informácie o pôvodnom a novom poradí
                notificationData.message = `Pre tím ${teamName.trim()} zmena: Skupina z '${originalTeam.groupName || 'bez skupiny'} (poradie: ${originalTeam.order || '-'})' na '${newGroup || 'bez skupiny'}  (poradie: ${newOrder || '-'})'`;
            } else if (newOrder !== originalTeam.order && newGroup === originalTeam.groupName) {
                // zmena: iba poradia v rovnakej skupine
                action = 'change_order_global';
                notificationData.oldOrder = originalTeam.order;
                notificationData.newOrder = newOrder;
                notificationData.message = `Pre tím ${teamName.trim()} zmena: Poradie z '${originalTeam.order || '?'}' na '${newOrder || '?'}'`;
            } else if (teamName.trim() !== originalTeam.teamName.replace(new RegExp(`^${originalTeam.category} `), '')) {
                // zmena: názvu tímu
                action = 'change_team_name';
                notificationData.oldTeamName = originalTeam.teamName;
                notificationData.message = `Pre tím ${teamName.trim()} zmena: Názov tímu z '${originalTeam.teamName}' na '${teamName.trim()}'`;
            } else {
                action = 'change_group_global'; // fallback
                notificationData.message = `Pre tím ${teamName.trim()} zmena: Skupina z '${originalTeam.groupName || 'bez skupiny'}' na '${newGroup || 'bez skupiny'}'`;
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
                notify("Tím sa nenašiel v profile používateľa (podľa názvu).", "error");
                return;
            }

            const oldGroup = teamsInCategory[teamIndex].groupName;
            const oldOrder = teamsInCategory[teamIndex].order;
            
            let newOrder = null;
            const newGroup = groupName || null;

            if (groupName) {
                const othersInGroup = teamsInCategory.filter(t => t.groupName === newGroup && t.teamName !== originalTeam.teamName);
                const max = othersInGroup.reduce((m, t) => Math.max(m, t.order || 0), 0);
                newOrder = order != null ? parseInt(order, 10) : max + 1;
            }

            teamsInCategory[teamIndex] = {
                ...teamsInCategory[teamIndex],
                teamName: teamName.trim(),
                groupName: newGroup,
                order: newOrder
            };

            await updateDoc(userRef, { [`teams.${originalTeam.category}`]: teamsInCategory });

            // Detekcia typu zmeny
            let action;
            let notificationData = {
                id: originalTeam.id,
                teamName: teamName.trim(),
                category: originalTeam.category,
                groupName: newGroup || null,
                oldGroup: oldGroup || null,
                oldOrder: oldOrder || null, // Pôvodné poradie
                newOrder: newOrder, // Nové poradie
                oldTeamName: originalTeam.teamName || null
            };

            const groupChanged = oldGroup !== newGroup;

            if (groupChanged) {
                action = oldGroup ? 'change_group_user' : 'assign_user';
                // UPRAVENÉ: Pridáme informácie o pôvodnom a novom poradí
                notificationData.message = `Pre tím ${teamName.trim()} zmena: Skupina z '${oldGroup || 'bez skupiny'} (poradie: ${oldOrder || '-'})' na '${newGroup || 'bez skupiny'} (poradie: ${newOrder || '?'})'`;
            } else if (newOrder !== oldOrder && newGroup === oldGroup) {
                action = 'change_order_user';
                notificationData.oldOrder = oldOrder;
                notificationData.newOrder = newOrder;
                notificationData.message = `Pre tím ${teamName.trim()} zmena: Poradie z '${oldOrder || '?'}' na '${newOrder || '?'}'`;
            } else if (teamName.trim() !== originalTeam.teamName) {
                // zmena: názvu tímu
                action = 'change_team_name';
                notificationData.oldTeamName = originalTeam.teamName;
                notificationData.message = `Pre tím ${teamName.trim()} zmena: Názov tímu z '${originalTeam.teamName}' na '${teamName.trim()}'`;
            } else {
                action = 'change_group_user'; // fallback
                notificationData.message = `Pre tím ${teamName.trim()} zmena: Skupina z '${oldGroup || 'bez skupiny'}' na '${newGroup || 'bez skupiny'}'`;
            }

            await createTeamAssignmentNotification(action, notificationData);

            notify(`Tím '${finalTeamName}' bol ${groupName ? 'zaradený/upravený' : 'odstránený zo skupiny'} v kategórii '${categoryName}'.`, "success");
        } catch (err) {
            console.error("Chyba pri aktualizácii tímu:", err);
            notify("Nepodarilo sa aktualizovať zaradenie tímu do skupiny.", "error");
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
  unifiedSaveHandler,
  showCategoryPrefix = true
}) => {
  const [orderInputValue, setOrderInputValue] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamNameError, setTeamNameError] = useState('');
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [originalTeamName, setOriginalTeamName] = useState('');
  const [originalCategory, setOriginalCategory] = useState('');
  const [originalGroup, setOriginalGroup] = useState('');
  
  // Zistíme, či môžeme meniť názov tímu
  const canEditTeamName = !teamToEdit || teamToEdit.isSuperstructureTeam;
  
  const isCategoryLocked = !!teamToEdit && !teamToEdit.isSuperstructureTeam;
  const isCategoryFixed = !!defaultCategoryId && !teamToEdit;
  const isGroupFixed = !!defaultGroupName && !teamToEdit;
  const [groupEndingMismatch, setGroupEndingMismatch] = useState(false);
  const [orderMismatchMessage, setOrderMismatchMessage] = useState(null);
  const [hasCorrectFormat, setHasCorrectFormat] = useState(false);

  // Zobrazí sa náhľad len pre superstructure tímy
  const shouldShowPreview = teamToEdit?.isSuperstructureTeam || (!teamToEdit); 

  // Pridaj túto funkciu na spracovanie zmien v inpute
  const handleTeamNameChange = (e) => {
  const value = e.target.value;
  
  if ((teamToEdit?.isSuperstructureTeam || !teamToEdit) && showCategoryPrefix) {
    let newValue = value;
    
    // Reset všetkých chýb na začiatku
    setTeamNameError('');
    setHasCorrectFormat(false);
    setGroupEndingMismatch(false);
    setOrderMismatchMessage(null);
    
    // Ak máme aspoň jeden znak
    if (newValue.length >= 1) {
      // Prvý znak - môže byť iba číslica 1-9
      const firstChar = newValue.charAt(0);
      if (!/^[1-9]$/.test(firstChar)) {
        setTeamNameError("Prvý znak musí byť číslica 1-9");
        // Odstráň neplatný znak
        newValue = newValue.substring(0, 0) + newValue.substring(1);
      } else {
        setTeamNameError('');
      }
    }
    
    // Ak máme aspoň dva znaky
    if (newValue.length >= 2) {
      const secondChar = newValue.charAt(1);
      
      // Povolené: číslica 0-9 alebo písmeno
      if (!/^[0-9a-zA-ZáäčďéíľĺňóôřŕšťúůýžÁÄČĎÉÍĽĹŇÓÔŘŔŠŤÚŮÝŽ]$/.test(secondChar)) {
        setTeamNameError("Druhý znak môže byť iba číslica 0-9 alebo písmeno.");
        newValue = newValue.substring(0, 1) + newValue.substring(2);
      } else {
        // Zmeň písmeno na veľké
        if (/^[a-zA-ZáäčďéíľĺňóôřŕšťúůýžÁÄČĎÉÍĽĹŇÓÔŘŔŠŤÚŮÝŽ]$/.test(secondChar)) {
          const upperSecond = secondChar.toUpperCase();
          newValue = newValue.substring(0, 1) + upperSecond + newValue.substring(2);
        }
        setTeamNameError('');
      }
    }
    
    // **DÔLEŽITÁ ZMENA: Ak sú dve číslice, musí nasledovať písmeno**
    if (newValue.length >= 2) {
      const firstChar = newValue.charAt(0);
      const secondChar = newValue.charAt(1);
      
      // Ak sú oba znaky číslice
      if (/^[1-9]$/.test(firstChar) && /^[0-9]$/.test(secondChar)) {
        // Ak máme iba 2 znaky (dve číslice), nastav chybu
        if (newValue.length === 2) {
          setTeamNameError("Po dvoch čísliciach musí nasledovať písmeno.");
        } 
        // Ak máme 3 alebo viac znakov, skontroluj tretí znak
        else if (newValue.length >= 3) {
          const thirdChar = newValue.charAt(2);
          
          // Tretí znak musí byť písmeno
          if (!/^[a-zA-ZáäčďéíľĺňóôřŕšťúůýžÁÄČĎÉÍĽĹŇÓÔŘŔŠŤÚŮÝŽ]$/.test(thirdChar)) {
            setTeamNameError("Po dvoch čísliciach musí nasledovať písmeno.");
            // Odstráň neplatný znak
            newValue = newValue.substring(0, 2) + newValue.substring(3);
          } else {
            // Zmeň tretí znak na veľké písmeno
            const upperThird = thirdChar.toUpperCase();
            newValue = newValue.substring(0, 2) + upperThird + newValue.substring(3);
            setTeamNameError('');
            
            // **Po troch znakoch (číslo+číslo+písmeno) už žiadne ďalšie znaky**
            if (newValue.length > 3) {
              newValue = newValue.substring(0, 3);
              setTeamNameError("Zadaný názov tímu má správny formát.");
              setHasCorrectFormat(true);
            }
          }
        }
      } 
      // Ak je druhý znak písmeno
      else if (/^[a-zA-ZáäčďéíľĺňóôřŕšťúůýžÁÄČĎÉÍĽĹŇÓÔŘŔŠŤÚŮÝŽ]$/.test(secondChar)) {
        // Maximálne 2 znaky (číslo+písmeno)
        if (newValue.length > 2) {
          newValue = newValue.substring(0, 2);
          setTeamNameError("Zadaný názov tímu má správny formát.");
          setHasCorrectFormat(true);
        } else if (newValue.length === 2) {
          // Ak máme 2 znaky (číslo+písmeno), je to správny formát
          setTeamNameError("Zadaný názov tímu má správny formát.");
          setHasCorrectFormat(true);
        }
      }
    }
    
    // **DODATOČNÁ OCHRANA: Ak sa niekto pokúsi vložiť viac znakov iným spôsobom**
    // (napr. paste, drag&drop, atď.)
    if (newValue.length > 3) {
      newValue = newValue.substring(0, 3);
      setTeamNameError("Zadaný názov tímu má správny formát.");
      setHasCorrectFormat(true);
    }
    
    // Aktualizácia hodnoty v inpute
    if (newValue !== value) {
      setTimeout(() => {
        const inputElement = e.target;
        if (inputElement) {
          inputElement.value = newValue;
          inputElement.selectionStart = newValue.length;
          inputElement.selectionEnd = newValue.length;
        }
      }, 0);
    }
    
    setTeamName(newValue);

    if (newValue.trim() && selectedCategory && selectedGroup) {
      checkOrderInGroup(newValue.trim(), selectedCategory, selectedGroup);
    }
  } else {
    // Pre používateľské tímy - bežné správanie
    setTeamName(value);
    setTeamNameError('');
    setHasCorrectFormat(false);
  }
};

// Nová funkcia na kontrolu poradia v skupine (pred useEffect definíciou)
const checkOrderInGroup = (teamName, categoryId, groupName) => {
  if (!teamName || !categoryId || !groupName) {
    setOrderMismatchMessage(null);
    return;
  }
  
  const trimmed = teamName.trim();
  const lastChar = trimmed.slice(-1).toLowerCase();
  const categoryName = categoryIdToNameMap[categoryId];
  const groups = allGroupsByCategoryId[categoryId] || [];
  
  // Iba základné skupiny
  const basicGroups = groups.filter(g => g.type === 'základná skupina');
  
  // Kontrola, či existuje základná skupina s danou koncovkou
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
      
      const actualGroupName = matchingBasicGroup.name;
      
      // počet tímov iba v tejto základnej skupine
      const teamsInGroup = allTeams.filter(
        t => t.category === categoryName && t.groupName === actualGroupName
      );
      
      const currentCount = teamsInGroup.length;
      if (currentCount < requestedOrder) {
        setOrderMismatchMessage(
          `V základnej skupine "${actualGroupName}" nie je tím s poradovým číslom ${requestedOrder}.`
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
};

  useEffect(() => {
    if (!isOpen || teamToEdit || !selectedCategory || !selectedGroup || !teamName.trim()) {
      return;
    }
  
    // Keď sa zmení vybraná skupina, spusti kontrolu
    checkOrderInGroup(teamName.trim(), selectedCategory, selectedGroup);
  }, [selectedGroup]);
  
// Efekt pre validáciu koncovky a čísla poradia
useEffect(() => {
  if (!isOpen || teamToEdit || !selectedCategory || !selectedGroup || !teamName.trim()) {
    setGroupEndingMismatch(false);
    setOrderMismatchMessage(null);
    return;
  }
  
  // Spusti kontrolu pri zmene kategórie alebo skupiny
  checkOrderInGroup(teamName.trim(), selectedCategory, selectedGroup);
}, [
  selectedCategory,
  selectedGroup,
  isOpen,
  teamToEdit,
  allTeams,
  allGroupsByCategoryId,
  categoryIdToNameMap
]);

  // Efekt pre order input
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

  // Efekt pre inicializáciu hodnôt
  useEffect(() => {
    if (isOpen) {
      if (teamToEdit) {
        const categoryId = Object.keys(categoryIdToNameMap).find(
          id => categoryIdToNameMap[id] === teamToEdit.category
        ) || '';
        
        setSelectedCategory(categoryId);
        setSelectedGroup(teamToEdit.groupName || '');
        
        // Pre superstructure tímy odstránime kategóriu z názvu
        // Pre používateľské tímy necháme pôvodný názov
        const initialTeamName = teamToEdit.isSuperstructureTeam
          ? teamToEdit.teamName.replace(new RegExp(`^${teamToEdit.category} `), '')
          : teamToEdit.teamName;
        
        setTeamName(initialTeamName);
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
      setHasCorrectFormat(false);
    }
  }, [isOpen, teamToEdit, defaultCategoryId, defaultGroupName, categoryIdToNameMap]);

  // Efekt pre kontrolu duplicity
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
      // Pre superstructure tímy odstránime kategóriu z názvu pri porovnávaní
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
    // Ak je kategória locked, zmena: sa ignoruje
    if (isCategoryLocked) return;
    setSelectedCategory(e.target.value);
    if (!defaultGroupName) setSelectedGroup('');
  };

const handleSubmit = (e) => {
  e.preventDefault();
  if (isSubmitDisabled) return;
  
  // VALIDÁCIA PRE SUPERSTRUCTURE TÍMY
  let finalTeamName = teamName.trim();
  
  if ((teamToEdit?.isSuperstructureTeam || !teamToEdit) && showCategoryPrefix) {
      // Len pre superstructure tímy s prefixom kategórie
      const trimmed = teamName.trim();
      
      // 1. Skontroluj dĺžku (minimálne 2 znaky)
      if (trimmed.length < 2) {
          notify("Názov tímu musí mať aspoň 2 znaky", "error");
          return;
      }
      
      // 2. Prvý znak musí byť číslica 1-9
      const firstChar = trimmed.charAt(0);
      if (!/^[1-9]$/.test(firstChar)) {
          notify("Prvý znak musí byť číslica 1-9", "error");
          return;
      }
      
      // 3. Transformuj druhý znak
      let secondChar = trimmed.charAt(1);
      if (secondChar === '') {
          notify("Názov tímu musí mať aspoň 2 znaky", "error");
          return;
      }
      
      // Ak je druhý znak písmeno (aj s diakritikou), zmeň na veľké
      if (/^[a-zA-ZáäčďéíľĺňóôřŕšťúůýžÁÄČĎÉÍĽĹŇÓÔŘŔŠŤÚŮÝŽ]$/.test(secondChar)) {
          secondChar = secondChar.toUpperCase();
      } 
      // Ak je druhý znak číslica, skontroluj, že je 0-9
      else if (!/^[0-9]$/.test(secondChar)) {
          notify("Druhý znak môže byť iba číslica 0-9 alebo písmeno", "error");
          return;
      }
      
      // **DÔLEŽITÁ VALIDÁCIA: Ak sú dve číslice, musí byť aj tretí znak (písmeno)**
      if (/^[0-9]$/.test(secondChar)) {
          // Ak máme iba dve číslice, pošleme chybu
          if (trimmed.length === 2) {
              notify("Názov tímu musí obsahovať písmeno", "error");
              return;
          }
          
          // Kontrola tretieho znaku
          const thirdChar = trimmed.charAt(2);
          if (!thirdChar) {
              notify("Názov tímu musí obsahovať písmeno", "error");
              return;
          }
          
          if (!/^[a-zA-ZáäčďéíľĺňóôřŕšťúůýžÁÄČĎÉÍĽĹŇÓÔŘŔŠŤÚŮÝŽ]$/.test(thirdChar)) {
              notify("Názov tímu musí obsahovať písmeno", "error");
              return;
          }
      }
      
      // 4. Tretí znak - len ak existuje a druhý znak bol číslica
      let finalName = firstChar + secondChar;
      if (trimmed.length >= 3) {
          const thirdChar = trimmed.charAt(2);
          
          // Ak bol druhý znak písmeno, tretí znak sa nedá pridať
          if (!/^[0-9]$/.test(secondChar)) {
              notify("Zadaný názov tímu má správny formát.", "error");
              return;
          }
          
          // Tretí znak musí byť písmeno (malé/veľké s diakritikou)
          if (!/^[a-zA-ZáäčďéíľĺňóôřŕšťúůýžÁÄČĎÉÍĽĹŇÓÔŘŔŠŤÚŮÝŽ]$/.test(thirdChar)) {
              notify("Tretí znak môže byť iba písmeno", "error");
              return;
          }
          
          // Zmeň tretí znak na veľké písmeno
          finalName += thirdChar.toUpperCase();
      }
      
      // Pridaj zvyšné znaky, ak existujú (od štvrtého znaku)
      if (trimmed.length > 3) {
          finalName += trimmed.substring(3);
      }
      
      finalTeamName = finalName;
  }
  
  // Použi prop showCategoryPrefix namiesto neexistujúcej premennej
  const teamNameToSave = teamToEdit?.isSuperstructureTeam
      ? (showCategoryPrefix 
          ? `${teamToEdit.category} ${finalTeamName}` 
          : finalTeamName)
      : finalTeamName;

  unifiedSaveHandler({
      categoryId: selectedCategory,
      groupName: selectedGroup || null,
      teamName: teamNameToSave,
      order: orderInputValue,
      isEdit: !!teamToEdit,
      originalTeam: teamToEdit
  });
};

  const currentCategoryName = categoryIdToNameMap[selectedCategory] || '';
  
  // Vytvoríme náhľad názvu
  let finalTeamNamePreview = '';
  if (teamName.trim()) {
      if (teamToEdit?.isSuperstructureTeam) {
          // Pre superstructure: Ak má byť zobrazený prefix, pridáme ho
          finalTeamNamePreview = showCategoryPrefix 
              ? `${teamToEdit.category} ${teamName.trim()}`
              : teamName.trim();
      } else if (!teamToEdit) {
          // Pre nové tímy: Zobrazíme podľa nastavenia
          finalTeamNamePreview = showCategoryPrefix 
              ? `${currentCategoryName} ${teamName.trim()}`
              : teamName.trim();
      } else {
          // Pre používateľské tímy pri editácii: iba názov
          finalTeamNamePreview = teamName.trim();
      }
  }

  const isCategoryValid = !!selectedCategory;
  const isGroupValid = !!selectedGroup;
  const isTeamNameValid = teamName.trim().length > 0;
  const isSubmitDisabled =
    !isCategoryValid ||
    !isGroupValid ||
    !isTeamNameValid ||
    isDuplicate ||
    groupEndingMismatch ||
    !!orderMismatchMessage ||
    (!canEditTeamName && !teamName.trim()); // Ak nemôžeme meniť názov, ale pole je prázdne

  const modalTitle = teamToEdit ? 'Upraviť tím' : 'Pridať nový tím';
  const buttonText = teamToEdit ? 'Aktualizovať tím' : 'Pridať tím';

  if (!isOpen) return null;

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
      
      // Pole pre názov tímu - ZOBRAZÍ SA LEN AK MÔŽEME MENIŤ NÁZOV
      canEditTeamName ? React.createElement(
        'div',
        { className: 'mb-6' },
        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 
          teamToEdit?.isSuperstructureTeam ? 'Názov tímu (bez názvu kategórie):' : 'Názov tímu:'
        ),
        React.createElement('input', {
          type: 'text',
          className: `w-full p-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
            isDuplicate || groupEndingMismatch || orderMismatchMessage || (teamNameError && !hasCorrectFormat) 
              ? 'border-red-500' 
              : hasCorrectFormat 
                ? 'border-green-500' 
                : 'border-gray-300'
          }`,
          value: teamName,
          onChange: handleTeamNameChange,
          required: true,
          autoFocus: true,
          disabled: !canEditTeamName
        }),

        teamNameError ? React.createElement(
          'p',
          { 
            className: `mt-2 text-sm font-medium ${
              hasCorrectFormat ? 'text-green-600' : 'text-red-600'
            }`
          },
          `${teamNameError}`
        ) : null,
        
// NÁHĽAD - ZOBRAZÍ SA LEN PRE SUPERSTRUCTURE TÍMY A NOVÉ TÍMY
        (shouldShowPreview && finalTeamNamePreview) ? React.createElement(
          'div',
          { className: 'mt-3 p-3 bg-indigo-50 rounded-lg text-center' },
          React.createElement('p', { className: 'text-sm text-gray-600' }, 'Výsledný názov:'),
          React.createElement('p', { className: 'text-base font-bold text-indigo-700 mt-1' }, finalTeamNamePreview)
        ) : null,
        
        // Chybové hlášky - VŠETKY SA ZOBRAZUJÚ NA ROVNAKOM MIESTE
        (teamNameError || isDuplicate || groupEndingMismatch || orderMismatchMessage) ? React.createElement(
          'div',
          { className: 'mt-2 space-y-1' },
          teamNameError ? React.createElement(
            'p',
            { 
              className: `text-sm font-medium ${
                hasCorrectFormat ? 'text-green-600' : 'text-red-600'
              }`
            },
            `${teamNameError}`
          ) : null,
          
          isDuplicate ? React.createElement(
            'p',
            { className: 'text-sm text-red-600 font-medium' },
            ' Tím s týmto názvom už existuje!'
          ) : null,
          
          groupEndingMismatch ? React.createElement(
            'p',
            { className: 'text-sm text-red-600 font-medium' },
            ` V tejto kategórii neexistuje žiadna základná skupina ${teamName.trim().slice(-1).toUpperCase()}`
          ) : null,
          
          orderMismatchMessage ? React.createElement(
            'p',
            { className: 'text-sm text-red-600 font-medium' },
            ` ${orderMismatchMessage}`
          ) : null
        ) : null,
        
        // Tento blok bol PRED zátvorkou - presuňte ho SEM
        (!canEditTeamName && teamToEdit) ? React.createElement(
          'div',
          { className: 'mb-6 p-4 bg-gray-50 rounded-lg' },
          React.createElement('p', { className: 'text-sm font-medium text-gray-700 mb-2' }, 'Názov tímu:'),
          React.createElement('p', { className: 'text-base font-bold text-gray-800' }, teamToEdit.teamName)
        ) : null
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
          (isCategoryLocked || isCategoryFixed) ?
            React.createElement(
              'p',
              { className: 'text-xs text-indigo-600 mt-1 italic' },
              isCategoryLocked
                ? 'Kategóriu používateľského tímu nemožno meniť.'
                : `Predvolená kategória: ${categoryIdToNameMap[defaultCategoryId]}`
            ) : null
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
          isGroupFixed ? React.createElement('p', { className: 'text-xs text-indigo-600 mt-1' }, `Predvolená skupina: ${defaultGroupName}`) : null
        ),

        selectedGroup ? React.createElement(
          'div',
          { className: 'flex flex-col' },
          React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Poradie v skupine:'),
          React.createElement('input', {
            type: 'number',
            min: '1',
            className: 'p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 w-full',
            value: orderInputValue ?? '',
            onChange: (e) => setOrderInputValue(e.target.value === '' ? null : parseInt(e.target.value, 10)),
            placeholder: 'auto'
          })
        ) : null,

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
            // Pre superstructure tímy
            if (team.isSuperstructureTeam) {
                // Ak má byť zobrazený prefix, vrátime celý názov
                if (showCategoryPrefix) {
                    return team.teamName;
                }
                // Ak nemá byť zobrazený prefix, odstránime ho
                if (team.category && team.teamName.startsWith(team.category + ' ')) {
                    return team.teamName.substring(team.category.length + 1).trim();
                }
                return team.teamName;
            }
            // Pre ostatné tímy odstránime prefix kategórie, ak existuje
            let name = team.teamName;
            if (team.category && name.startsWith(team.category + ' ')) {
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
  
// Upravená funkcia renderSingleCategoryView()
const renderSingleCategoryView = () => {
    const categoryName = categoryIdToNameMap[selectedCategoryId] || "Neznáma kategória";
    let groups = allGroupsByCategoryId[selectedCategoryId] || [];
    if (selectedGroupName) {
        groups = groups.filter(g => g.name === selectedGroupName);
    }
    
    // Rozdelenie skupín podľa typu
    const basicGroups = groups.filter(g => g.type === 'základná skupina');
    const superstructureGroups = groups.filter(g => g.type === 'nadstavbová skupina');
    
    // Triedenie skupín
    const sortedBasicGroups = [...basicGroups].sort((a, b) => a.name.localeCompare(b.name));
    const sortedSuperstructureGroups = [...superstructureGroups].sort((a, b) => a.name.localeCompare(b.name));
    
    // Získaj tímy bez skupiny pre túto kategóriu
    const teamsWithoutGroupForCategory = selectedCategoryId
        ? allTeams.filter(t => t.category === categoryName && !t.groupName).sort((a, b) => a.teamName.localeCompare(b.teamName))
        : [];
    
    // Dynamická šírka boxov podľa zoom levelu
    const getBoxWidth = () => {
        if (typeof window !== 'undefined') {
            const width = window.innerWidth;
            if (width < 768) return '95vw'; // Mobilné zariadenia
            if (width < 1024) return '45vw'; // Tablety
            if (width < 1280) return '35vw'; // Menšie monitory
            return '380px'; // Štandardná šírka
        }
        return '380px';
    };
    
    const boxWidth = getBoxWidth();
    
    // Zistíme, či existujú tímy bez skupiny
    const hasTeamsWithoutGroup = teamsWithoutGroupForCategory.length > 0;
    
    // Počítač maximálnej výšky pre karty v riadku
    const calculateMaxTeamCount = (groupList) => {
        if (groupList.length === 0) return 0;
        
        let maxCount = 0;
        groupList.forEach(group => {
            const teamsInGroup = allTeams.filter(t => 
                t.category === categoryName && 
                t.groupName === group.name
            );
            
            // Spočítame rôzne pozície (vrátane dier)
            const usedOrders = new Set(
                teamsInGroup
                    .map(t => t.order)
                    .filter(o => Number.isInteger(o) && o >= 1)
            );
            
            const maxOrder = usedOrders.size > 0 ? Math.max(...usedOrders) : 0;
            const count = Math.max(teamsInGroup.length, maxOrder);
            maxCount = Math.max(maxCount, count);
        });
        
        return maxCount;
    };
    
    // Vypočítame maximálny počet tímov pre základné a nadstavbové skupiny
    const maxBasicTeams = calculateMaxTeamCount(basicGroups);
    const maxSuperTeams = calculateMaxTeamCount(superstructureGroups);
    
    // Výška na jeden tím (v px) + padding
    const teamHeight = 65; // približná výška jedného tímu s paddingom
    const baseCardHeight = 140; // výška hlavičky karty + paddingy
    
    return React.createElement(
        'div',
        { 
            className: 'w-full min-w-0 overflow-x-auto zoom-responsive',
            style: { 
                overflowX: 'auto',
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e0 #f1f5f9'
            }
        },
        
        // HLAVNÝ KONTAJNER S DYNAMICKOU ŠÍRKOU
        React.createElement(
            'div',
            { 
                className: `flex min-w-max px-4 pb-6 zoom-content ${!hasTeamsWithoutGroup ? 'justify-center' : ''}`,
                style: { 
                    minWidth: 'min-content',
                    transition: 'all 0.3s ease'
                }
            },
            
            // ĽAVÝ STĹPEC - Tímy bez skupiny (LEN AK SÚ NEKTORÉ)
            hasTeamsWithoutGroup && React.createElement(
                'div',
                {
                    ref: teamsWithoutGroupRef,
                    className: "bg-white rounded-xl shadow-xl p-6 mr-8 flex-shrink-0 zoom-box flex flex-col",
                    style: { 
                        width: boxWidth,
                        minWidth: boxWidth,
                        maxWidth: boxWidth,
                        transition: 'width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease'
                    }
                },
                React.createElement('h3', { 
                    className: 'text-2xl font-semibold mb-4 text-center flex-shrink-0' 
                }, `Tímy bez skupiny v kategórii: ${categoryName}`),
                React.createElement('div', { 
                    className: 'flex-grow overflow-y-auto min-h-0'
                }, renderTeamList(teamsWithoutGroupForCategory, null, selectedCategoryId, true))
            ),
            
            // PRAVÁ ČASŤ - Skupiny (základné + nadstavbové)
            React.createElement(
                'div',
                { 
                    className: `flex-grow min-w-0 flex flex-col ${!hasTeamsWithoutGroup ? 'items-center' : ''}`
                },
                
                // ZÁKLADNÉ SKUPINY
                sortedBasicGroups.length > 0 && React.createElement(
                    React.Fragment,
                    null,
                    React.createElement('h3', { 
                        className: `text-2xl font-semibold mb-4 text-gray-800 whitespace-nowrap ${!hasTeamsWithoutGroup ? 'text-center' : ''}`
                    }, 'Základné skupiny'),
                    React.createElement(
                        'div',
                        { 
                            className: `flex mb-8 overflow-x-auto pb-4 zoom-groups-container ${!hasTeamsWithoutGroup ? 'justify-center' : ''}`,
                            style: { 
                                flexWrap: 'nowrap',
                                gap: '1.5rem',
                                alignItems: 'stretch' // Dôležité: všetky karty rovnako vysoké
                            }
                        },
                        sortedBasicGroups.map((group, groupIndex) => {
                            const teamsInGroup = allTeams.filter(t => 
                                t.category === categoryName && 
                                t.groupName === group.name
                            );
                            
                            // Dynamická výška na základe maximálneho počtu tímov v tomto type skupiny
                            const calculatedHeight = baseCardHeight + (maxBasicTeams * teamHeight);
                            const minHeight = Math.max(calculatedHeight, 300); // Minimálna výška
                            
                            return React.createElement(
                                'div',
                                {
                                    key: `basic-${groupIndex}`,
                                    className: 'flex-shrink-0 zoom-group-box',
                                    style: { 
                                        width: boxWidth,
                                        minWidth: boxWidth,
                                        maxWidth: boxWidth,
                                        height: `${minHeight}px`,
                                        minHeight: `${minHeight}px`,
                                        transition: 'width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease, height 0.3s ease'
                                    }
                                },
                                React.createElement(
                                    'div',
                                    {
                                        className: 'flex flex-col rounded-xl shadow-xl p-6 h-full bg-gray-100'
                                    },
                                    React.createElement('h3', { 
                                        className: 'text-2xl font-semibold mb-2 text-center whitespace-nowrap truncate flex-shrink-0' 
                                    }, group.name),
                                    React.createElement('p', { 
                                        className: 'text-center text-sm text-gray-600 mb-4 whitespace-nowrap flex-shrink-0' 
                                    }, group.type),
                                    React.createElement('div', { 
                                        className: 'mt-2 space-y-1 flex-grow overflow-hidden'
                                    },
                                        renderTeamList(teamsInGroup, group.name, selectedCategoryId)
                                    ),
                                )
                            );
                        })
                    )
                ),
                
                // NADSTAVBOVÉ SKUPINY
                sortedSuperstructureGroups.length > 0 && React.createElement(
                    React.Fragment,
                    null,
                    React.createElement('h3', { 
                        className: `text-2xl font-semibold mb-4 text-gray-800 whitespace-nowrap ${!hasTeamsWithoutGroup ? 'text-center' : ''}`
                    }, 'Nadstavbové skupiny'),
                    React.createElement(
                        'div',
                        { 
                            className: `flex overflow-x-auto pb-4 zoom-groups-container ${!hasTeamsWithoutGroup ? 'justify-center' : ''}`,
                            style: { 
                                flexWrap: 'nowrap',
                                gap: '1.5rem',
                                alignItems: 'stretch' // Dôležité: všetky karty rovnako vysoké
                            }
                        },
                        sortedSuperstructureGroups.map((group, groupIndex) => {
                            const teamsInGroup = allTeams.filter(t => 
                                t.category === categoryName && 
                                t.groupName === group.name
                            );
                            
                            // Dynamická výška na základe maximálneho počtu tímov v tomto type skupiny
                            const calculatedHeight = baseCardHeight + (maxSuperTeams * teamHeight);
                            const minHeight = Math.max(calculatedHeight, 300); // Minimálna výška
                            
                            return React.createElement(
                                'div',
                                {
                                    key: `super-${groupIndex}`,
                                    className: 'flex-shrink-0 zoom-group-box',
                                    style: { 
                                        width: boxWidth,
                                        minWidth: boxWidth,
                                        maxWidth: boxWidth,
                                        height: `${minHeight}px`,
                                        minHeight: `${minHeight}px`,
                                        transition: 'width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease, height 0.3s ease'
                                    }
                                },
                                React.createElement(
                                    'div',
                                    {
                                        className: 'flex flex-col rounded-xl shadow-xl p-6 h-full bg-blue-100'
                                    },
                                    React.createElement('h3', { 
                                        className: 'text-2xl font-semibold mb-2 text-center whitespace-nowrap truncate flex-shrink-0' 
                                    }, group.name),
                                    React.createElement('p', { 
                                        className: 'text-center text-sm text-gray-600 mb-4 whitespace-nowrap flex-shrink-0' 
                                    }, group.type),
                                    React.createElement('div', { 
                                        className: 'mt-2 space-y-1 flex-grow overflow-hidden'
                                    },
                                        renderTeamList(teamsInGroup, group.name, selectedCategoryId)
                                    )
                                )
                            );
                        })
                    )
                ),
                
                // AK NIE SÚ ŽIADNE SKUPINY
                sortedBasicGroups.length === 0 && sortedSuperstructureGroups.length === 0 && React.createElement(
                    'div',
                    { 
                        className: 'min-w-96',
                        style: { minWidth: boxWidth }
                    },
                    React.createElement('p', { className: 'text-center text-gray-500 py-8' }, 
                        'Žiadne skupiny v tejto kategórii.'
                    )
                )
            )
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

    useEffect(() => {
        const addGlobalStyles = () => {
            if (document.getElementById('group-cards-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'group-cards-styles';
            style.textContent = `
                .zoom-group-box > div > div:last-child {
                    overflow: visible !important;
                    max-height: none !important;
                }
                
                .zoom-groups-container {
                    align-items: stretch !important;
                }
            
                .zoom-group-box {
                    display: flex !important;
                    flex-direction: column !important;
                }
            
                .zoom-group-box > div {
                    flex: 1 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    min-height: 0 !important;
                }
            
                .zoom-group-box ul {
                    flex-grow: 1 !important;
                    overflow: visible !important;
                    max-height: none !important;
                }
            
                .overflow-y-auto,
                .overflow-y-scroll {
                    overflow-y: visible !important;
                }
                
                .flex-grow {
                    flex-grow: 1 !important;
                }
            `;
            document.head.appendChild(style);
        };
    
        addGlobalStyles();
    
        return () => {
            const style = document.getElementById('group-cards-styles');
            if (style) {
                document.head.removeChild(style);
            }
        };
    }, []);
  
    // Pôvodný kód pred return v komponente AddGroupsApp:
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
            unifiedSaveHandler,
            showCategoryPrefix: showCategoryPrefix
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
            ),
          React.createElement(
            'div',
            { className: 'mt-4 flex items-center justify-center' },
            React.createElement(
                'label',
                { 
                    className: 'flex items-center space-x-2 cursor-pointer',
                    title: 'Zobrazovať názov kategórie pred názvom tímu v nadstavbových skupinách'
                },
                React.createElement('input', {
                    type: 'checkbox',
                    checked: showCategoryPrefix,
                    onChange: (e) => setShowCategoryPrefix(e.target.checked),
                    className: 'w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500'
                }),
                React.createElement(
                    'span',
                    { className: 'text-sm font-medium text-gray-700' },
                    'Zobrazovať názov kategórie pred názvom tímu v nadstavbových skupinách'
                )
            )
        ),
          
        ),
        selectedCategoryId
            ? renderSingleCategoryView()
            : React.createElement(
                'div',
                { className: 'flex flex-col lg:flex-row justify-center space-x-0 lg:space-x-4 w-full px-4' },
                // Zobrazujeme ľavý obdĺžnik LEN AK EXISTUJÚ TÍMY BEZ SKUPINY
                teamsWithoutGroup.length > 0 && React.createElement(
                    'div',
                    { className: 'w-full lg:w-1/4 max-w-sm bg-white rounded-xl shadow-xl p-8 mb-6 flex-shrink-0' },
                    React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center' }, 'Zoznam všetkých tímov'),
                    renderTeamList(teamsWithoutGroup, null, null, true)
                ),
                React.createElement('div', { 
                    className: `flex-grow min-w-0 ${teamsWithoutGroup.length === 0 ? 'w-full' : ''}` 
                }, renderGroupedCategories())
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
                                        changes: `zmena: e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
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

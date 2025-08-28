import { doc, onSnapshot, setDoc, Timestamp, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Funkcie sú teraz odovzdávané ako props, takže ich už netreba importovať
// import { formatToDatetimeLocal, formatDateForDisplay, showNotification, sendAdminNotification } from './utils.js';

/**
 * Vypočíta počet dní medzi dvoma dátumami (vrátane oboch dátumov).
 * @param {Date} startDate - Začiatočný dátum.
 * @param {Date} endDate - Koncový dátum.
 * @returns {number} Počet dní, alebo 0 ak sú dátumy neplatné.
 */
const calculateDaysDuration = (startDate, endDate) => {
  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return 0; 
  }
  // Nastavíme čas na začiatok dňa, aby sme eliminovali vplyv časovej zóny a času
  const startOfDay = new Date(startDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(endDate);
  endOfDay.setHours(0, 0, 0, 0);

  const diffTime = Math.abs(endOfDay.getTime() - startOfDay.getTime());
  // Pridáme +1, aby sme zahrnuli aj začiatočný a koncový deň
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
  return diffDays;
};


export function GeneralRegistrationSettings({ db, userProfileData, tournamentStartDate, setTournamentStartDate, tournamentEndDate, setTournamentEndDate, showNotification, sendAdminNotification, formatToDatetimeLocal, formatDateForDisplay }) {
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [dataEditDeadline, setDataEditDeadline] = React.useState(''); 
  const [rosterEditDeadline, setRosterEditDeadline] = React.useState(''); 
  const [numberOfPlayers, setNumberOfPlayers] = React.useState(0);
  const [numberOfImplementationTeam, setNumberOfImplementationTeam] = React.useState(0);

  const isFrozenForEditing = React.useMemo(() => {
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    return regStart instanceof Date && !isNaN(regStart) && now >= regStart;
  }, [registrationStartDate]);

  React.useEffect(() => {
    let unsubscribeSettings;
    const fetchSettings = async () => {
      if (!db || !userProfileData || userProfileData.role !== 'admin') {
        return; 
      }
      try {
          const settingsDocRef = doc(db, 'settings', 'registration');
          unsubscribeSettings = onSnapshot(settingsDocRef, docSnapshot => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
                setDataEditDeadline(data.dataEditDeadline ? formatToDatetimeLocal(data.dataEditDeadline.toDate()) : ''); 
                setRosterEditDeadline(data.rosterEditDeadline ? formatToDatetimeLocal(data.rosterEditDeadline.toDate()) : ''); 
                setNumberOfPlayers(data.numberOfPlayers || 0);
                setNumberOfImplementationTeam(data.numberOfImplementationTeam || 0);
                setTournamentStartDate(data.tournamentStart ? formatToDatetimeLocal(data.tournamentStart.toDate()) : '');
                setTournamentEndDate(data.tournamentEnd ? formatToDatetimeLocal(data.tournamentEnd.toDate()) : '');

            } else {
                setRegistrationStartDate('');
                setRegistrationEndDate('');
                setDataEditDeadline(''); 
                setRosterEditDeadline(''); 
                setNumberOfPlayers(0);
                setNumberOfImplementationTeam(0);
                setTournamentStartDate('');
                setTournamentEndDate('');
            }
          }, error => {
            showNotification(`Chyba pri načítaní nastavení: ${error.message}`, 'error'); 
          });

          return () => {
            if (unsubscribeSettings) {
                unsubscribeSettings();
            }
          };
      } catch (e) {
          showNotification(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`, 'error'); 
      }
    };

    fetchSettings();
  }, [db, userProfileData, setTournamentStartDate, setTournamentEndDate, showNotification, formatToDatetimeLocal]);


  const handleUpdateRegistrationSettings = async (e) => {
    e.preventDefault();
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      showNotification("Nemáte oprávnenie na zmenu nastavení registrácie.", 'error'); 
      return;
    }
    
    try {
      const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
      const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;
      const dataEditDead = dataEditDeadline ? new Date(dataEditDeadline) : null; 
      const rosterEditDead = rosterEditDeadline ? new Date(rosterEditDeadline) : null; 
      const tourStart = tournamentStartDate ? new Date(tournamentStartDate) : null;
      const tourEnd = tournamentEndDate ? new Date(tournamentEndDate) : null;

      if (regStart && regEnd && regStart >= regEnd) {
        showNotification("Dátum začiatku registrácie musí byť pred dátumom konca registrácie.", 'error'); 
        return;
      }
      if (dataEditDead && regEnd && dataEditDead < regEnd) {
        showNotification("Dátum uzávierky úprav dát nemôže byť pred dátumom konca registrácie.", 'error'); 
        return;
      }
      if (rosterEditDead && dataEditDead && rosterEditDead < dataEditDead) {
        showNotification("Dátum uzávierky úprav súpisiek nemôže byť pred dátumom uzávierky úprav používateľských dát.", 'error');
        return;
      }
      if (tourStart && tourEnd && tourStart >= tourEnd) {
        showNotification("Dátum začiatku turnaja musí byť pred dátumom konca turnaja.", 'error');
        return;
      }


      if (numberOfPlayers < 0) {
        showNotification("Počet hráčov nemôže byť záporný.", 'error');
        return;
      }
      if (numberOfImplementationTeam < 0) {
        showNotification("Počet členov realizačného tímu nemôže byť záporný.", 'error');
        return;
      }

      const settingsDocRef = doc(db, 'settings', 'registration');
      const oldSettingsDoc = await getDoc(settingsDocRef); 
      const oldData = oldSettingsDoc.exists() ? oldSettingsDoc.data() : {};
      let changes = [];
      
      // Nový flag pre sledovanie zmien trvania turnaja
      let tournamentDurationChanged = false; 

      if ((oldData.registrationStartDate ? oldData.registrationStartDate.toMillis() : null) !== (regStart ? Timestamp.fromDate(regStart).toMillis() : null)) {
          changes.push(`Dátum začiatku registrácie z '${formatDateForDisplay(oldData.registrationStartDate)}' na '${formatDateForDisplay(regStart)}'`);
      }
      if ((oldData.registrationEndDate ? oldData.registrationEndDate.toMillis() : null) !== (regEnd ? Timestamp.fromDate(regEnd).toMillis() : null)) {
          changes.push(`Dátum konca registrácie z '${formatDateForDisplay(oldData.registrationEndDate)}' na '${formatDateForDisplay(regEnd)}'`);
      }
      if ((oldData.dataEditDeadline ? oldData.dataEditDeadline.toMillis() : null) !== (dataEditDead ? Timestamp.fromDate(dataEditDead).toMillis() : null)) {
          changes.push(`Uzávierka úprav dát z '${formatDateForDisplay(oldData.dataEditDeadline)}' na '${formatDateForDisplay(dataEditDead)}'`);
      }
      if ((oldData.rosterEditDeadline ? oldData.rosterEditDeadline.toMillis() : null) !== (rosterEditDead ? Timestamp.fromDate(rosterEditDead).toMillis() : null)) {
          changes.push(`Uzávierka úprav súpisiek z '${formatDateForDisplay(oldData.rosterEditDeadline)}' na '${formatDateForDisplay(rosterEditDead)}'`);
      }

      // Staré dátumy turnaja z databázy
      const oldTournamentStart = oldData.tournamentStart ? oldData.tournamentStart.toDate() : null;
      const oldTournamentEnd = oldData.tournamentEnd ? oldData.tournamentEnd.toDate() : null;

      // Ak sa zmení dátum začiatku turnaja
      if ((oldData.tournamentStart ? oldData.tournamentStart.toMillis() : null) !== (tourStart ? Timestamp.fromDate(tourStart).toMillis() : null)) {
          changes.push(`Dátum začiatku turnaja z '${formatDateForDisplay(oldData.tournamentStart)}' na '${formatDateForDisplay(tourStart)}'`);
      }
      // Ak sa zmení dátum konca turnaja
      if ((oldData.tournamentEnd ? oldData.tournamentEnd.toMillis() : null) !== (tourEnd ? Timestamp.fromDate(tourEnd).toMillis() : null)) {
          changes.push(`Dátum konca turnaja z '${formatDateForDisplay(oldData.tournamentEnd)}' na '${formatDateForDisplay(tourEnd)}'`);
      }

      // Vypočítame dĺžku turnaja pre staré a nové nastavenia
      const oldDurationDays = calculateDaysDuration(oldTournamentStart, oldTournamentEnd);
      const newDurationDays = calculateDaysDuration(tourStart, tourEnd);
      
      // Ak sa zmenil celkový počet dní, nastavíme flag
      if (oldDurationDays !== newDurationDays) {
        tournamentDurationChanged = true;
      }


      if (oldData.numberOfPlayers !== numberOfPlayers) {
          changes.push(`Maximálny počet hráčov v tíme z '${oldData.numberOfPlayers || 0}' na '${numberOfPlayers}'`);
      }
      if (oldData.numberOfImplementationTeam !== numberOfImplementationTeam) {
          changes.push(`Maximálny počet členov realizačného tímu z '${oldData.numberOfImplementationTeam || 0}' na '${numberOfImplementationTeam}'`);
      }

      await setDoc(settingsDocRef, {
        registrationStartDate: regStart ? Timestamp.fromDate(regStart) : null,
        registrationEndDate: regEnd ? Timestamp.fromDate(regEnd) : null,
        dataEditDeadline: dataEditDead ? Timestamp.fromDate(dataEditDead) : null, 
        rosterEditDeadline: rosterEditDead ? Timestamp.fromDate(rosterEditDead) : null, 
        numberOfPlayers: numberOfPlayers,
        numberOfImplementationTeam: numberOfImplementationTeam,
        tournamentStart: tourStart ? Timestamp.fromDate(tourStart) : null,
        tournamentEnd: tourEnd ? Timestamp.fromDate(tourEnd) : null,
      });
      
      showNotification("Nastavenia registrácie úspešne aktualizované!", 'success'); 

      if (changes.length > 0) {
          sendAdminNotification({
              type: 'updateSettings',
              data: {
                  changesMade: changes.join('; ')
              }
          });
      }

      // Ak sa zmenil celkový počet dní turnaja, zobrazíme dodatočnú červenú notifikáciu s oneskorením
      if (tournamentDurationChanged) {
          setTimeout(() => {
              showNotification("Skontrolujte nastavenia balíčkov (stravovanie a občerstvenie).", 'error');
          }, 7000); // Oneskorenie 7 sekúnd
      }

    } catch (e) {
      showNotification(`Chyba pri aktualizácii nastavenia: ${e.message}`, 'error'); 
    }
  };

  return React.createElement(
    'form',
    { onSubmit: handleUpdateRegistrationSettings, className: 'space-y-4 p-6 border border-gray-200 rounded-lg shadow-sm' }, 
    React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Všeobecné nastavenia registrácie'),
    React.createElement(
      'div',
      null,
      React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-start-date' }, 'Dátum a čas začiatku registrácie'),
      React.createElement('input', {
        type: 'datetime-local',
        id: 'reg-start-date',
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
        value: registrationStartDate,
        onChange: (e) => setRegistrationStartDate(e.target.value),
      })
    ),
    React.createElement(
      'div',
      null,
      React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-end-date' }, 'Dátum a čas konca registrácie'),
      React.createElement('input', {
        type: 'datetime-local',
        id: 'reg-end-date',
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
        value: registrationEndDate,
        onChange: (e) => setRegistrationEndDate(e.target.value),
      })
    ),
    React.createElement(
      'div',
      null,
      React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'data-edit-deadline' }, 'Dátum a čas uzávierky úprav používateľských dát'),
      React.createElement('input', {
        type: 'datetime-local',
        id: 'data-edit-deadline',
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
        value: dataEditDeadline,
        onChange: (e) => setDataEditDeadline(e.target.value),
      })
    ),
    React.createElement(
      'div',
      null,
      React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'roster-edit-deadline' }, 'Dátum a čas uzávierky úprav súpisiek klubov/tímov'),
    React.createElement('input', {
          type: 'datetime-local',
          id: 'roster-edit-deadline',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: rosterEditDeadline,
          onChange: (e) => setRosterEditDeadline(e.target.value),
        })
      ),
    React.createElement(
      'div',
      null,
      React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'tournament-start' }, 'Dátum a čas - začiatok turnaja'),
      React.createElement('input', {
        type: 'datetime-local',
        id: 'tournament-start',
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
        value: tournamentStartDate,
        onChange: (e) => setTournamentStartDate(e.target.value),
      })
    ),
    React.createElement(
      'div',
      null,
      React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'tournament-end' }, 'Dátum a čas - koniec turnaja'),
    React.createElement('input', {
          type: 'datetime-local',
          id: 'tournament-end',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: tournamentEndDate,
          onChange: (e) => setTournamentEndDate(e.target.value),
        })
      ),
    React.createElement(
      'div',
      null,
      React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'number-of-players' }, 'Maximálny počet hráčov v tíme'),
      React.createElement('input', {
        type: 'number',
        id: 'number-of-players',
        className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${isFrozenForEditing ? 'bg-gray-200 cursor-not-allowed' : ''}`, 
        value: numberOfPlayers,
        onChange: (e) => setNumberOfPlayers(parseInt(e.target.value) || 0), 
        min: 0, 
        disabled: isFrozenForEditing, 
      })
    ),
    React.createElement(
      'div',
      null,
      React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'number-of-implementation-team' }, 'Maximálny počet členov realizačného tímu'),
      React.createElement('input', {
        type: 'number',
        id: 'number-of-implementation-team',
        className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${isFrozenForEditing ? 'bg-gray-200 cursor-not-allowed' : ''}`, 
        value: numberOfImplementationTeam,
        onChange: (e) => setNumberOfImplementationTeam(parseInt(e.target.value) || 0), 
        min: 0, 
        disabled: isFrozenForEditing, 
      })
    ),
    React.createElement(
      'button',
      {
        type: 'submit',
        className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
      },
      'Aktualizovať nastavenia'
    )
  );
}

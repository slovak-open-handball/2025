// register-page5.js
import { getFirestore, doc, onSnapshot, collection, query, getDoc, updateDoc, setDoc, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Komponent pre zobrazenie notifikácií
function NotificationModal({ message, onClose, type = 'info' }) {
    const [show, setShow] = React.useState(false);
    const timerRef = React.useRef(null);

    React.useEffect(() => {
        if (message) {
            setShow(true);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
                setShow(false);
                setTimeout(onClose, 500);
            }, 10000);
        } else {
            setShow(false);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [message, onClose]);

    if (!show && !message) return null;

    let bgColorClass;
    if (type === 'success') {
        bgColorClass = 'bg-green-500';
    } else if (type === 'error') {
        bgColorClass = 'bg-red-600';
    } else {
        bgColorClass = 'bg-blue-500';
    }

    return React.createElement(
        'div',
        {
            className: `fixed bottom-4 right-4 ${bgColorClass} text-white p-4 rounded-lg shadow-lg transition-transform transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`,
            style: { zIndex: 1000 }
        },
        React.createElement('p', { className: 'font-semibold' }, message)
    );
}

function TeamJerseyColors({
  team,
  categoryName,
  teamIndex,
  onGranularTeamsDataChange,
  loading
}) {
  const [color1, setColor1] = React.useState(team.jerseyColors?.color1 || '');
  const [color2, setColor2] = React.useState(team.jerseyColors?.color2 || '');

  // synchronizácia pri zmene teamu zvonku
  React.useEffect(() => {
    setColor1(team.jerseyColors?.color1 || '');
    setColor2(team.jerseyColors?.color2 || '');
  }, [team.jerseyColors]);

  const handleColorChange = (field, value) => {
    const newColors = {
      color1: field === 'color1' ? value : color1,
      color2: field === 'color2' ? value : color2
    };

    if (field === 'color1') setColor1(value);
    if (field === 'color2') setColor2(value);

    onGranularTeamsDataChange(categoryName, teamIndex, 'jerseyColors', newColors);
  };

  return React.createElement(
    'div',
    { className: 'border-t border-gray-200 pt-4 mt-4' },
    React.createElement('h4', { className: 'text-lg font-bold mb-4 text-gray-700' }, 'Farba dresov'),
    React.createElement(
      'div',
      { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      React.createElement(
        'div',
        null,
        React.createElement('label', {
          className: 'block text-gray-700 text-sm font-bold mb-2',
          htmlFor: `jerseyColor1-${categoryName}-${teamIndex}`
        }, 'Farba dresov 1:'),
        React.createElement('input', {
          type: 'text',
          id: `jerseyColor1-${categoryName}-${teamIndex}`,
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: color1,
          onChange: (e) => handleColorChange('color1', e.target.value),
          placeholder: 'Zadajte farbu',
          disabled: loading,
          maxLength: 50
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', {
          className: 'block text-gray-700 text-sm font-bold mb-2',
          htmlFor: `jerseyColor2-${categoryName}-${teamIndex}`
        }, 'Farba dresov 2:'),
        React.createElement('input', {
          type: 'text',
          id: `jerseyColor2-${categoryName}-${teamIndex}`,
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: color2,
          onChange: (e) => handleColorChange('color2', e.target.value),
          placeholder: 'Zadajte farbu',
          disabled: loading,
          maxLength: 50
        })
      )
    ),
    React.createElement(
      'p',
      { className: 'text-sm text-gray-500 mt-2' },
      'Uveďte dve farby dresov.'
    )
  );
}

// register-page5.js - opravený TeamAccommodationAndArrival komponent
function TeamAccommodationAndArrival({
    team,
    categoryName,
    teamIndex,
    onGranularTeamsDataChange,
    loading,
    accommodationTypes,
    existingAccommodationCounts,      // Počty z existujúcich registrácií (z databázy)
    currentRegistrationAccommodationCounts, // Počty z aktuálnej registrácie
    tournamentStartDate,
    generateTimeOptions,
    arrivalDateTime
}) {
    const [selectedAccommodation, setSelectedAccommodation] = React.useState(team.accommodation?.type || '');
    const [arrivalType, setArrivalType] = React.useState(team.arrival?.type || '');
    const [arrivalHours, setArrivalHours] = React.useState(() => {
        const initialTime = typeof team.arrival?.time === 'string' ? team.arrival.time : '';
        return initialTime ? initialTime.split(':')[0] : '';
    });
    const [arrivalMinutes, setArrivalMinutes] = React.useState(() => {
        const initialTime = typeof team.arrival?.time === 'string' ? team.arrival.time : '';
        return initialTime ? initialTime.split(':')[1] : '';
    });

    // Výpočet počtu ľudí v aktuálnom tíme
    const calculateCurrentTeamPeople = React.useCallback(() => {
        let total = 0;
        
        if (team.playerDetails && Array.isArray(team.playerDetails)) {
            total += team.playerDetails.length;
        }
        if (team.menTeamMemberDetails && Array.isArray(team.menTeamMemberDetails)) {
            total += team.menTeamMemberDetails.length;
        }
        if (team.womenTeamMemberDetails && Array.isArray(team.womenTeamMemberDetails)) {
            total += team.womenTeamMemberDetails.length;
        }
        if (team.driverDetailsMale && Array.isArray(team.driverDetailsMale)) {
            total += team.driverDetailsMale.length;
        }
        if (team.driverDetailsFemale && Array.isArray(team.driverDetailsFemale)) {
            total += team.driverDetailsFemale.length;
        }
        
        return total;
    }, [team]);

    const currentTeamPeople = calculateCurrentTeamPeople();

    React.useEffect(() => {
        setSelectedAccommodation(team.accommodation?.type || '');
        setArrivalType(team.arrival?.type || '');
        const initialTime = typeof team.arrival?.time === 'string' ? team.arrival.time : '';
        setArrivalHours(initialTime ? initialTime.split(':')[0] : '');
        setArrivalMinutes(initialTime ? initialTime.split(':')[1] : '');
    }, [team.accommodation, team.arrival]);

    // NOVÝ EFEKT: Kontrola kapacity pre aktuálne vybraný typ ubytovania
    React.useEffect(() => {
        // Ak nie je vybraný žiadny typ ubytovania alebo je to "bez ubytovania", nič nerobíme
        if (!selectedAccommodation || selectedAccommodation === 'bez ubytovania') {
            return;
        }

        // Nájdeme vybraný typ ubytovania
        const selectedAccType = accommodationTypes.find(acc => acc.type === selectedAccommodation);
        if (!selectedAccType) return;
    
        // KROK 1: Existujúce registrácie z databázy
        const existingCount = existingAccommodationCounts[selectedAccType.type] || 0;
    
        // KROK 2: Aktuálne prebiehajúca registrácia (bez tohto tímu)
        let currentCountWithoutThisTeam = currentRegistrationAccommodationCounts[selectedAccType.type] || 0;
    
        // DÔLEŽITÉ: Odpočítame tento tím z aktuálnej registrácie
        // Pretože currentRegistrationAccommodationCounts už obsahuje tento tím
        if (team.accommodation?.type === selectedAccommodation) {
            currentCountWithoutThisTeam -= currentTeamPeople;
        }
    
        // KROK 3: Celková obsadenosť
        const totalOccupied = existingCount + currentCountWithoutThisTeam;
        const remaining = selectedAccType.capacity - totalOccupied;
    
        // KROK 4: Ak už nie je dostatok miesta, zrušíme výber
        if (remaining < currentTeamPeople) {
            console.log(`Kapacita pre ${selectedAccommodation} je naplnená. Zostáva ${remaining} miest, potrebujeme ${currentTeamPeople}. Rušíme výber.`);
            
            // Zrušíme výber v lokálnom stave
            setSelectedAccommodation('');
            
            // Zrušíme výber v rodičovskom stave
            onGranularTeamsDataChange(categoryName, teamIndex, 'accommodation', { type: '' });
            
            // Zobrazíme notifikáciu (ak je k dispozícii)
            if (typeof window.showNotification === 'function') {
                window.showNotification(`Typ ubytovania "${selectedAccommodation}" už nie je k dispozícii. Kapacita je naplnená.`, 'warning');
            } else {
                alert(`Typ ubytovania "${selectedAccommodation}" už nie je k dispozícii. Kapacita je naplnená.`);
            }
        }
    }, [
        selectedAccommodation, 
        accommodationTypes, 
        existingAccommodationCounts, 
        currentRegistrationAccommodationCounts, 
        currentTeamPeople, 
        categoryName, 
        teamIndex, 
        onGranularTeamsDataChange,
        team.accommodation?.type
    ]);

    const handleAccommodationChange = (e) => {
        const newValue = e.target.value;
        
        if (newValue === 'bez ubytovania') {
            setSelectedAccommodation(newValue);
            onGranularTeamsDataChange(categoryName, teamIndex, 'accommodation', { type: newValue });
            return;
        }

        // Pre konkrétne typy ubytovania skontrolujeme kapacitu
        const selectedAccType = accommodationTypes.find(acc => acc.type === newValue);
        if (selectedAccType) {
            // KROK 1: Existujúce registrácie z databázy
            const existingCount = existingAccommodationCounts[selectedAccType.type] || 0;
            
            // KROK 2: Aktuálne prebiehajúca registrácia (bez tohto tímu)
            let currentCountWithoutThisTeam = currentRegistrationAccommodationCounts[selectedAccType.type] || 0;
            
            // Ak už má tento tím vybraný iný typ ubytovania, odpočítame ho
            if (team.accommodation?.type && team.accommodation.type !== 'bez ubytovania' && team.accommodation.type !== newValue) {
                currentCountWithoutThisTeam -= currentTeamPeople;
            }
            
            // KROK 3: Celková obsadenosť
            const totalOccupied = existingCount + currentCountWithoutThisTeam;
            const remaining = selectedAccType.capacity - totalOccupied;
            
            // KROK 4: Kontrola, či sa tím zmestí
            if (remaining < currentTeamPeople) {
                alert(`Tento typ ubytovania už nemá dostatočnú kapacitu pre ${currentTeamPeople} osôb. Zostáva ${remaining} miest.`);
                return;
            }
        }

        setSelectedAccommodation(newValue);
        onGranularTeamsDataChange(categoryName, teamIndex, 'accommodation', { type: newValue });
    };

    const handleArrivalChange = (e) => {
        const newValue = e.target.value;
        setArrivalType(newValue);
        const currentTeamArrivalData = team.arrival || {};

        if (newValue !== 'verejná doprava - vlak' && newValue !== 'verejná doprava - autobus') {
            setArrivalHours('');
            setArrivalMinutes('');
            const driversToPass = newValue === 'vlastná doprava' ? { male: 0, female: 0 } : null;
            onGranularTeamsDataChange(categoryName, teamIndex, 'arrival', { type: newValue, time: null, drivers: driversToPass });
        } else {
            const timeString = (arrivalHours && arrivalMinutes) ? `${arrivalHours}:${arrivalMinutes}` : '';
            onGranularTeamsDataChange(categoryName, teamIndex, 'arrival', { type: newValue, time: timeString, drivers: null });
        }
    };

    const handleTimeSelectChange = (e) => {
        const { id, value } = e.target;
        let currentHours = arrivalHours;
        let currentMinutes = arrivalMinutes;

        if (id.includes('arrivalHours')) {
            currentHours = value;
            setArrivalHours(value);
        } else if (id.includes('arrivalMinutes')) {
            currentMinutes = value;
            setArrivalMinutes(value);
        }

        let timeString = '';
        if (currentHours && currentMinutes) {
            timeString = `${currentHours}:${currentMinutes}`;
        } else if (currentHours && currentMinutes === '') {
            timeString = currentHours;
        } else if (currentHours === '' && currentMinutes) {
            timeString = currentMinutes;
        }
        const currentTeamArrivalData = team.arrival || {};
        onGranularTeamsDataChange(categoryName, teamIndex, 'arrival', {
            ...currentTeamArrivalData,
            type: arrivalType,
            time: timeString || null,
            drivers: currentTeamArrivalData.drivers
        });
    };

    const formattedTournamentStartDate = tournamentStartDate instanceof Date && !isNaN(tournamentStartDate.getTime())
        ? tournamentStartDate.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';

    const formattedArrivalDate = arrivalDateTime instanceof Date && !isNaN(arrivalDateTime.getTime())
        ? arrivalDateTime.toLocaleDateString('sk-SK', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })
        : 'dátum príchodu';

    const formattedArrivalTime = arrivalDateTime instanceof Date && !isNaN(arrivalDateTime.getTime())
        ? arrivalDateTime.toLocaleTimeString('sk-SK', {
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'čas príchodu';

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(
            'div',
            { className: 'border-t border-gray-200 pt-4 mt-4' },
            React.createElement('h4', { className: 'text-lg font-bold mb-4 text-gray-700' }, 'Výber typu ubytovania'),
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement(
                    'div',
                    { className: 'space-y-2' },
                    // Možnosť "bez ubytovania" - vždy dostupná
                    React.createElement(
                        'label',
                        { 
                            className: `flex items-center p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
                                loading ? 'bg-gray-100' : 'hover:bg-blue-50'
                            }`,
                        },
                        React.createElement('input', {
                            type: 'radio',
                            name: `accommodationType-${categoryName}-${teamIndex}`,
                            value: 'bez ubytovania',
                            checked: selectedAccommodation === 'bez ubytovania',
                            onChange: handleAccommodationChange,
                            className: 'form-radio h-5 w-5 text-blue-600',
                            disabled: loading,
                        }),
                        React.createElement('span', { className: 'ml-3 text-gray-800' }, 'bez ubytovania')
                    ),
                    
                    // Ostatné typy ubytovania s kontrolou kapacity
                    accommodationTypes.sort((a, b) => a.type.localeCompare(b.type)).map((acc) => {
                        // KROK 1: Existujúce registrácie z databázy
                        const existingCount = existingAccommodationCounts[acc.type] || 0;
                        
                        // KROK 2: Aktuálne prebiehajúca registrácia (bez tohto tímu)
                        let currentCountWithoutThisTeam = currentRegistrationAccommodationCounts[acc.type] || 0;
                        
                        // Ak už má tento tím vybraný iný typ ubytovania, odpočítame ho
                        if (team.accommodation?.type && team.accommodation.type !== 'bez ubytovania' && team.accommodation.type !== acc.type) {
                            currentCountWithoutThisTeam -= currentTeamPeople;
                        }
                        
                        // KROK 3: Celková obsadenosť
                        const totalOccupied = existingCount + currentCountWithoutThisTeam;
                        const remaining = acc.capacity - totalOccupied;
                        
                        // KROK 4: Zablokovanie - PRIORITA 1: Kapacita z databázy je plná
                        // Ak je kapacita z databázy už plná (existingCount >= capacity), zablokujeme
                        const isDatabaseFull = existingCount >= acc.capacity;
                        
                        // KROK 5: Zablokovanie - PRIORITA 2: Celková kapacita (databáza + aktuálna registrácia) nestačí pre tento tím
                        const isTotalFull = remaining < currentTeamPeople;
                        
                        // Kombinovaná podmienka - blokujeme ak:
                        // 1. Databáza je už plná, ALEBO
                        // 2. Celková kapacita nestačí pre tento tím
                        // A zároveň to nie je aktuálne vybraný typ
                        const shouldDisable = (isDatabaseFull || isTotalFull) && selectedAccommodation !== acc.type;
                        
                        const finalDisabled = shouldDisable || loading;
                        
                        return React.createElement(
                            'label',
                            {
                                key: acc.type,
                                className: `flex items-center p-3 rounded-lg transition-colors duration-200 ${
                                    finalDisabled 
                                        ? 'bg-gray-100 cursor-not-allowed text-gray-400' 
                                        : 'hover:bg-blue-50 cursor-pointer'
                                }`,
                            },
                            React.createElement('input', {
                                type: 'radio',
                                name: `accommodationType-${categoryName}-${teamIndex}`,
                                value: acc.type,
                                checked: selectedAccommodation === acc.type,
                                onChange: handleAccommodationChange,
                                className: 'form-radio h-5 w-5 text-blue-600',
                                disabled: finalDisabled,
                            }),
                            React.createElement(
                                'span', 
                                { 
                                    className: `ml-3 ${finalDisabled ? 'text-gray-400' : 'text-gray-800'}` 
                                },
                                `${acc.type}${isDatabaseFull ? ' (naplnená kapacita)' : (isTotalFull ? ` (voľných len ${remaining} z ${currentTeamPeople} potrebných)` : '')}`
                            )
                        );
                    })
                )
            )
        ),

        React.createElement(
            'div',
            { className: 'border-t border-gray-200 pt-4 mt-4' },
            React.createElement('h4', { className: 'text-lg font-bold mb-4 text-gray-700' }, 'Výber spôsobu príchodu na turnaj'),
            React.createElement(
                'p',
                { className: 'text-sm text-gray-600 mb-4' },
                `Ak budete prichádzať verejnou dopravou a je potrebné pre vás zabezpečiť dopravu na miesto ubytovania, napíšte nám čas príchodu vlaku/autobusu dňa ${formattedArrivalDate}. V prípade príchodu po ${formattedArrivalTime} hod. bude zabezpečený zvoz len na miesto otvorenia turnaja.`            
            ),
            React.createElement(
                'div',
                { className: 'mb-4 space-y-2' },
                React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                        'label',
                        { className: `flex items-center p-3 rounded-lg cursor-pointer ${loading ? 'bg-gray-100' : 'hover:bg-blue-50'} transition-colors duration-200` },
                        React.createElement('input', {
                            type: 'radio',
                            name: `arrivalType-${categoryName}-${teamIndex}`,
                            value: 'verejná doprava - vlak',
                            checked: arrivalType === 'verejná doprava - vlak',
                            onChange: handleArrivalChange,
                            className: 'form-radio h-5 w-5 text-blue-600',
                            disabled: loading,
                        }),
                        React.createElement('span', { className: 'ml-3 text-gray-800' }, 'verejná doprava - vlak')
                    ),
                    arrivalType === 'verejná doprava - vlak' && React.createElement(
                        'div',
                        { className: 'ml-8 mb-4' },
                        React.createElement(
                            'div',
                            { className: 'flex space-x-4' },
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: `arrivalHours-${categoryName}-${teamIndex}` }, 'Hodina'),
                                React.createElement('select', {
                                    id: `arrivalHours-${categoryName}-${teamIndex}`,
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalHours || '',
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                }, generateTimeOptions(24))
                            ),
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: `arrivalMinutes-${categoryName}-${teamIndex}` }, 'Minúta'),
                                React.createElement('select', {
                                    id: `arrivalMinutes-${categoryName}-${teamIndex}`,
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalMinutes || '',
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                }, generateTimeOptions(60))
                            )
                        )
                    )
                ),
                React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                        'label',
                        { className: `flex items-center p-3 rounded-lg cursor-pointer ${loading ? 'bg-gray-100' : 'hover:bg-blue-50'} transition-colors duration-200` },
                        React.createElement('input', {
                            type: 'radio',
                            name: `arrivalType-${categoryName}-${teamIndex}`,
                            value: 'verejná doprava - autobus',
                            checked: arrivalType === 'verejná doprava - autobus',
                            onChange: handleArrivalChange,
                            className: 'form-radio h-5 w-5 text-blue-600',
                            disabled: loading,
                        }),
                        React.createElement('span', { className: 'ml-3 text-gray-800' }, 'verejná doprava - autobus')
                    ),
                    arrivalType === 'verejná doprava - autobus' && React.createElement(
                        'div',
                        { className: 'ml-8 mb-4' },
                        React.createElement(
                            'div',
                            { className: 'flex space-x-4' },
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: `arrivalHours-${categoryName}-${teamIndex}` }, 'Hodina'),
                                React.createElement('select', {
                                    id: `arrivalHours-${categoryName}-${teamIndex}`,
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalHours || '',
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                }, generateTimeOptions(24))
                            ),
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: `arrivalMinutes-${categoryName}-${teamIndex}` }, 'Minúta'),
                                React.createElement('select', {
                                    id: `arrivalMinutes-${categoryName}-${teamIndex}`,
                                    className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                                    value: arrivalMinutes || '',
                                    onChange: handleTimeSelectChange,
                                    required: true,
                                }, generateTimeOptions(60))
                            )
                        )
                    )
                ),
                React.createElement(
                    'label',
                    { className: `flex items-center p-3 rounded-lg cursor-pointer ${loading ? 'bg-gray-100' : 'hover:bg-blue-50'} transition-colors duration-200` },
                    React.createElement('input', {
                        type: 'radio',
                        name: `arrivalType-${categoryName}-${teamIndex}`,
                        value: 'vlastná doprava',
                        checked: arrivalType === 'vlastná doprava',
                        onChange: handleArrivalChange,
                        className: 'form-radio h-5 w-5 text-blue-600',
                        disabled: loading,
                    }),
                    React.createElement('span', { className: 'ml-3 text-gray-800' }, 'vlastná doprava')
                ),
                React.createElement(
                    'label',
                    { className: `flex items-center p-3 rounded-lg cursor-pointer ${loading ? 'bg-gray-100' : 'hover:bg-blue-50'} transition-colors duration-200` },
                    React.createElement('input', {
                        type: 'radio',
                        name: `arrivalType-${categoryName}-${teamIndex}`,
                        value: 'bez dopravy',
                        checked: arrivalType === 'bez dopravy',
                        onChange: handleArrivalChange,
                        className: 'form-radio h-5 w-5 text-blue-600',
                        disabled: loading,
                    }),
                    React.createElement('span', { className: 'ml-3 text-gray-800' }, 'bez dopravy')
                )
            )
        )
    );
}

// Komponent pre nastavenia balíčka tímu
function TeamPackageSettings({
    team,
    categoryName,
    teamIndex,
    onGranularTeamsDataChange, // Prop pre aktualizáciu dát v rodičovi
    loading,
    packages,
    tournamentDays,
    selectedAccommodationType // NOVÝ PROP - typ ubytovania vybraný pre tento tím
}) {
    const [selectedPackageId, setSelectedPackageId] = React.useState(team.packageId || '');

    React.useEffect(() => {
        setSelectedPackageId(team.packageId || '');
    }, [team.packageId]);

    const handlePackageChange = (e) => {
        const newPackageId = e.target.value;
        setSelectedPackageId(newPackageId);
        const selectedPkg = packages.find(pkg => pkg.id === newPackageId);
        onGranularTeamsDataChange(categoryName, teamIndex, 'packageId', newPackageId);
        onGranularTeamsDataChange(categoryName, teamIndex, 'packageDetails', selectedPkg ? {
            name: selectedPkg.name,
            price: selectedPkg.price,
            meals: selectedPkg.meals
        } : null);
    };

    // Filtrovanie balíčkov podľa vybraného typu ubytovania
    const filteredPackages = React.useMemo(() => {
        if (!selectedAccommodationType) {
            // Ak ešte nie je vybraný typ ubytovania, nezobrazujeme žiadne balíčky
            return [];
        }
        
        if (selectedAccommodationType === 'bez ubytovania') {
            // Pre "bez ubytovania" zobrazíme len balíčky, ktoré majú v accommodationTypes "bez ubytovania"
            return packages.filter(pkg => 
                pkg.accommodationTypes && pkg.accommodationTypes.includes('bez ubytovania')
            );
        }
        
        // Pre konkrétny typ ubytovania zobrazíme všetky balíčky, ktoré obsahujú tento typ
        // (vrátane tých, ktoré majú zároveň "bez ubytovania")
        return packages.filter(pkg => 
            pkg.accommodationTypes && pkg.accommodationTypes.includes(selectedAccommodationType)
        );
    }, [packages, selectedAccommodationType]);

    // Zoradenie balíčkov podľa názvu
    const sortedPackages = React.useMemo(() => {
        return [...filteredPackages].sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredPackages]);

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(
            'div',
            { className: 'border-t border-gray-200 pt-4 mt-4' },
            React.createElement('h4', { className: 'text-lg font-bold mb-4 text-gray-700' }, 'Výber balíčka'),
            React.createElement(
                'p',
                { className: 'text-sm text-gray-600 mb-4' },
                `Uvedená cena je pre jednu osobu.`
            ),
            React.createElement(
                'div',
                { className: 'mb-4 space-y-2' },
                !selectedAccommodationType ? (
                    React.createElement('p', { className: 'text-gray-500 text-center py-4' }, 
                        'Najprv vyberte typ ubytovania.'
                    )
                ) : sortedPackages.length > 0 ? (
                    sortedPackages.map((pkg) => (
                        React.createElement(
                            'label',
                            {
                                key: pkg.id,
                                className: `flex flex-col p-3 rounded-lg border cursor-pointer ${selectedPackageId === pkg.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'} ${loading ? 'opacity-70 cursor-not-allowed' : ''} transition-colors duration-200`,
                            },
                            React.createElement(
                                'div',
                                { className: 'flex items-center justify-between w-full' },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center' },
                                    React.createElement('input', {
                                        type: 'radio',
                                        name: `selectedPackage-${categoryName}-${teamIndex}`,
                                        value: pkg.id,
                                        checked: selectedPackageId === pkg.id,
                                        onChange: handlePackageChange,
                                        className: 'form-radio h-5 w-5 text-blue-600',
                                        disabled: loading,
                                    }),
                                    React.createElement('span', { className: 'ml-3 font-semibold text-gray-800' }, pkg.name)
                                ),
                                React.createElement('span', { className: 'font-bold text-gray-900' }, `${pkg.price} € / osoba`)
                            ),
                            React.createElement(
                                'div',
                                { className: 'ml-8 text-sm text-gray-600 mt-2' },
                                (pkg.meals && (tournamentDays.length > 0 || Object.keys(pkg.meals).length > 0)) ? (
                                    [...new Set([...tournamentDays, ...Object.keys(pkg.meals || {}).filter(key => key !== 'participantCard')])].sort().map(date => {
                                        const mealsForDay = pkg.meals[date];
                                        const includedItems = [];

                                        // Kontrola, či je dátum platný
                                        if (isNaN(new Date(date).getTime())) {
                                            return null;
                                        }

                                        if (mealsForDay && mealsForDay.breakfast === 1) includedItems.push('raňajky');
                                        if (mealsForDay && mealsForDay.lunch === 1) includedItems.push('obed');
                                        if (mealsForDay && mealsForDay.dinner === 1) includedItems.push('večera');
                                        if (mealsForDay && mealsForDay.refreshment === 1) includedItems.push('občerstvenie');

                                        if (includedItems.length > 0) {
                                            const dateObj = new Date(date + 'T00:00:00'); // Ensure date is parsed correctly
                                            const displayDate = dateObj.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric' });
                                            return React.createElement('p', { key: date }, `${displayDate}: ${includedItems.join(', ')}`);
                                        }
                                        return null;
                                    }).filter(item => item !== null)
                                ) : (
                                    React.createElement('p', null, 'Žiadne stravovanie definované pre tento balíček.')
                                ),
                                (pkg.meals && pkg.meals.participantCard === 1) &&
                                    React.createElement('p', { className: 'font-bold text-gray-700 mt-1' }, 'zahŕňa účastnícku kartu')
                            )
                        )
                    ))
                ) : (
                    React.createElement('p', { className: 'text-gray-500 text-center py-4' }, 
                        selectedAccommodationType === 'bez ubytovania'
                            ? 'Pre voľbu "bez ubytovania" nie sú dostupné žiadne balíčky.'
                            : `Pre vybraný typ ubytovania (${selectedAccommodationType}) nie sú dostupné žiadne balíčky.`
                    )
                )
            )
        )
    );
}

// Komponent pre vlastný selectbox tímu s možnosťou zalamovania textu
function CustomTeamSelect({ value, onChange, options, disabled, placeholder }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const selectRef = React.useRef(null);

    // Formátovanie zobrazenej hodnoty
    const selectedOption = options.find(option => option.id === value);
    const displayedValue = selectedOption ? `${selectedOption.categoryName} - ${selectedOption.teamName}` : placeholder;

    const handleSelectClick = () => {
        if (!disabled) {
            setIsOpen(prev => !prev);
        }
    };

    const handleOptionClick = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    // Zatvorenie selectboxu pri kliknutí mimo neho
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const inputClasses = `
        shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-full cursor-pointer
        ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}
        relative flex justify-between items-center pr-10
        min-h-[4rem] flex-wrap align-middle
    `;

    const dropdownClasses = `
        absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto
        ${isOpen ? 'block' : 'hidden'}
    `;

    const optionClasses = `
        px-3 py-2 cursor-pointer hover:bg-blue-100 text-gray-800 whitespace-normal break-words
    `;

    return React.createElement(
        'div',
        { className: 'relative w-full', ref: selectRef },
        React.createElement(
            'div',
            { className: inputClasses, onClick: handleSelectClick },
            React.createElement('span', { className: 'flex-grow whitespace-normal' }, displayedValue),
            React.createElement(
                'svg',
                { className: `h-5 w-5 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`, viewBox: '0 0 20 20', fill: 'currentColor' },
                React.createElement('path', { fillRule: 'evenodd', d: 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z', clipRule: 'evenodd' })
            )
        ),
        React.createElement(
            'div',
            { className: dropdownClasses },
            options.length === 0 ? (
                React.createElement('div', { className: 'px-3 py-2 text-gray-500' }, 'Žiadne dostupné tímy.')
            ) : (
                options.map(option => (
                    React.createElement(
                        'div',
                        {
                            key: option.id,
                            onClick: () => handleOptionClick(option.id),
                            className: optionClasses + (option.id === value ? ' bg-blue-200' : '')
                        },
                        // Zmena formátu pre zobrazenie v rozbaľovacom zozname
                        `${option.categoryName} - ${option.teamName}`
                    )
                ))
            )
        )
    );
}

// Hlavný komponent Page5Form
export function Page5Form({ formData, handlePrev, handleSubmit, loading, setLoading, setRegistrationSuccess, handleChange, setTeamsDataFromPage4, teamsDataFromPage4, isRecaptchaReady, onGranularTeamsDataChange }) {
    const db = getFirestore();

    const [notificationMessage, setNotificationMessage] = React.useState('');
    const [notificationType, setNotificationType] = React.useState('info');

    // Nové lokálne stavy pre dátumy z databázy
    const [localTournamentStartDate, setLocalTournamentStartDate] = React.useState(null);
    const [localTournamentEndDate, setLocalTournamentEndDate] = React.useState(null);
    const [arrivalDateTime, setArrivalDateTime] = React.useState(null);

    const closeNotification = () => {
        setNotificationMessage('');
        setNotificationType('info');
    };

    const [accommodationTypes, setAccommodationTypes] = React.useState([]);
    // Zmena: Ubytovacie počty sú teraz lokálny stav pre existujúce registrácie
    const [existingAccommodationCounts, setExistingAccommodationCounts] = React.useState({});
    const [packages, setPackages] = React.useState([]);

    // Lokálny stav pre záznamy šoférov - teraz inicializovaný z teamsDataFromPage4 v useEffect
    const [driverEntries, setDriverEntries] = React.useState([]);

    // Pomocná funkcia na generovanie unikátneho ID pre dočasné záznamy šoférov.
    const generateUniqueTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Ref pre sledovanie, či už boli šoféri inicializovaní z parent dát
    const isInitialDriversLoad = React.useRef(true);

    // Funkcia na re-agregáciu dát šoférov pre konkrétny tím a aktualizáciu rodičovského stavu
    const updateTeamDriversInParent = React.useCallback((currentEntries, categoryName, teamIndex) => {
        const currentTeamDrivers = { male: 0, female: 0 };
        currentEntries.forEach(entry => {
            if (entry.categoryName === categoryName && entry.teamIndex === teamIndex && entry.gender && entry.count !== '') {
                const count = parseInt(entry.count, 10);
                if (!isNaN(count) && count > 0) {
                    if (entry.gender === 'male') {
                        currentTeamDrivers.male += count;
                    } else {
                        currentTeamDrivers.female += count;
                    }
                }
            }
        });

        const currentTeamArrivalData = teamsDataFromPage4[categoryName]?.[teamIndex]?.arrival || {};
        onGranularTeamsDataChange(categoryName, teamIndex, 'arrival', {
            ...currentTeamArrivalData,
            drivers: currentTeamDrivers.male === 0 && currentTeamDrivers.female === 0 ? null : currentTeamDrivers
        });
    }, [onGranularTeamsDataChange, teamsDataFromPage4]);

    // useEffect na inicializáciu driverEntries z teamsDataFromPage4
    React.useEffect(() => {
        if (isInitialDriversLoad.current) {
            const driversFromParentData = [];

            for (const categoryName in teamsDataFromPage4) {
                if (!teamsDataFromPage4[categoryName] || typeof teamsDataFromPage4[categoryName] !== 'object') continue;

                (teamsDataFromPage4[categoryName] || []).filter(t => t).forEach((team, teamIndex) => {
                    if (team.arrival?.type === 'vlastná doprava') {
                        if (team.arrival?.drivers?.male > 0) {
                            driversFromParentData.push({
                                id: generateUniqueTempId(),
                                count: team.arrival.drivers.male.toString(),
                                gender: 'male',
                                categoryName: categoryName,
                                teamIndex: teamIndex,
                            });
                        }
                        if (team.arrival?.drivers?.female > 0) {
                            driversFromParentData.push({
                                id: generateUniqueTempId(),
                                count: team.arrival.drivers.female.toString(),
                                gender: 'female',
                                categoryName: categoryName,
                                teamIndex: teamIndex,
                            });
                        }
                    }
                });
            }
            setDriverEntries(driversFromParentData);
            isInitialDriversLoad.current = false;
        }
    }, []); // Prázdne pole závislostí zabezpečuje, že sa useEffect spustí len raz

    const getDaysBetween = (start, end) => {
        const dates = [];
        let currentDate = new Date(start);
        while (currentDate <= end) {
            dates.push(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return dates;
    };

    // tournamentDays teraz závisí od lokálnych stavov
    const tournamentDays = React.useMemo(() => {
        const startDate = localTournamentStartDate ? new Date(localTournamentStartDate) : null;
        const endDate = localTournamentEndDate ? new Date(localTournamentEndDate) : null;
        if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            return getDaysBetween(startDate, endDate);
        }
        return [];
    }, [localTournamentStartDate, localTournamentEndDate]);

    // NOVÁ POMOCNÁ FUNKCIA: Výpočet počtu ľudí v aktuálnej registrácii pre každý typ ubytovania
    const calculateCurrentRegistrationAccommodationCounts = React.useCallback(() => {
        const counts = {};

        for (const categoryName in teamsDataFromPage4) {
            const teamsInCurrentCategory = teamsDataFromPage4[categoryName];
            if (!teamsInCurrentCategory || !Array.isArray(teamsInCurrentCategory)) continue;

            for (const team of teamsInCurrentCategory) {
                if (!team) continue;

                if (team.accommodation?.type && team.accommodation.type !== 'bez ubytovania') {
                    // Spočítame všetkých ľudí v tomto tíme
                    let totalPeopleInTeam = 0;
                    
                    // Hráči
                    if (team.playerDetails && Array.isArray(team.playerDetails)) {
                        totalPeopleInTeam += team.playerDetails.length;
                    }
                    // Členovia realizačného tímu (muži a ženy)
                    if (team.menTeamMemberDetails && Array.isArray(team.menTeamMemberDetails)) {
                        totalPeopleInTeam += team.menTeamMemberDetails.length;
                    }
                    if (team.womenTeamMemberDetails && Array.isArray(team.womenTeamMemberDetails)) {
                        totalPeopleInTeam += team.womenTeamMemberDetails.length;
                    }
                    // Šoféri (muži a ženy)
                    if (team.driverDetailsMale && Array.isArray(team.driverDetailsMale)) {
                        totalPeopleInTeam += team.driverDetailsMale.length;
                    }
                    if (team.driverDetailsFemale && Array.isArray(team.driverDetailsFemale)) {
                        totalPeopleInTeam += team.driverDetailsFemale.length;
                    }

                    // Pridáme počet osôb do celkového súčtu pre aktuálnu registráciu
                    if (counts[team.accommodation.type]) {
                        counts[team.accommodation.type] += totalPeopleInTeam;
                    } else {
                        counts[team.accommodation.type] = totalPeopleInTeam;
                    }
                }
            }
        }

        return counts;
    }, [teamsDataFromPage4]);

    // Vypočítame aktuálne obsadenie pre túto registráciu
    const currentRegistrationAccommodationCounts = React.useMemo(() => 
        calculateCurrentRegistrationAccommodationCounts(), 
        [calculateCurrentRegistrationAccommodationCounts]
    );

    React.useEffect(() => {
        let unsubscribeAccommodation;
        let unsubscribePackages;
        let unsubscribeRegistrationSettings;
        let unsubscribeUsers;
        let unsubscribeAccommodationTypes;

        const fetchSettings = () => {
            if (!window.db) {
                setTimeout(fetchSettings, 100);
                return;
            }
            try {
                const accommodationDocRef = doc(window.db, 'settings', 'accommodation');
                unsubscribeAccommodationTypes = onSnapshot(accommodationDocRef, (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        setAccommodationTypes(data.types || []);
                    } else {
                        setAccommodationTypes([]);
                    }
                }, (error) => {
                    console.error("Chyba pri načítaní nastavení ubytovania:", error);
                    setNotificationMessage("Chyba pri načítaní nastavení ubytovania.");
                    setNotificationType('error');
                });

                const packagesCollectionRef = collection(window.db, 'settings', 'packages', 'list');
                unsubscribePackages = onSnapshot(packagesCollectionRef, (snapshot) => {
                    const fetchedPackages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    fetchedPackages.sort((a, b) => a.name.localeCompare(b.name));
                    setPackages(fetchedPackages);
                }, (error) => {
                    console.error("Chyba pri načítaní balíčkov:", error);
                    setNotificationMessage("Chyba pri načítaní balíčkov.");
                    setNotificationType('error');
                });

                const registrationDocRef = doc(window.db, 'settings', 'registration');
                unsubscribeRegistrationSettings = onSnapshot(registrationDocRef, (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        // Prevod Firebase Timestamp na Date objekty
                        if (data.tournamentStart instanceof Timestamp) {
                            setLocalTournamentStartDate(data.tournamentStart.toDate());
                        } else {
                            setLocalTournamentStartDate(null);
                        }
                        if (data.tournamentEnd instanceof Timestamp) {
                            setLocalTournamentEndDate(data.tournamentEnd.toDate());
                        } else {
                            setLocalTournamentEndDate(null);
                        }
                        if (data.arrivalDate instanceof Timestamp) {
                            setArrivalDateTime(data.arrivalDate.toDate());
                        } else {
                            setArrivalDateTime(null);
                        }
                    } else {
                        console.warn("Dokument 'settings/registration' neexistuje. Dátumy turnaja neboli načítané.");
                        setLocalTournamentStartDate(null);
                        setLocalTournamentEndDate(null);
                        setArrivalDateTime(null);
                    }
                }, (error) => {
                    console.error("Chyba pri načítaní nastavení registrácie (dátumy turnaja):", error);
                    setNotificationMessage("Chyba pri načítaní dátumov turnaja.");
                    setNotificationType('error');
                });

                // Poslucháč pre `/users/` kolekciu - počítame EXISTUJÚCE registrácie
                const usersCollectionRef = collection(window.db, 'users');
                unsubscribeUsers = onSnapshot(usersCollectionRef, async (querySnapshot) => {
                    if (querySnapshot.empty) {
                        console.log("Kolekcia '/users/' neobsahuje žiadne dokumenty.");
                        setExistingAccommodationCounts({});
                    } else {
                        const accommodationSummary = {};

                        querySnapshot.forEach((userDoc) => {
                            const userData = userDoc.data();
                            const teams = userData.teams || {};

                            Object.entries(teams).forEach(([categoryName, teamsArray]) => {
                                if (!Array.isArray(teamsArray)) return;

                                teamsArray.filter(team => team).forEach(team => {
                                    const accommodationType = team.accommodation?.type;
                                    
                                    if (accommodationType && accommodationType !== 'bez ubytovania') {
                                        let totalPeopleInTeam = 0;

                                        if (team.playerDetails && Array.isArray(team.playerDetails)) {
                                            totalPeopleInTeam += team.playerDetails.length;
                                        }
                                        if (team.menTeamMemberDetails && Array.isArray(team.menTeamMemberDetails)) {
                                            totalPeopleInTeam += team.menTeamMemberDetails.length;
                                        }
                                        if (team.womenTeamMemberDetails && Array.isArray(team.womenTeamMemberDetails)) {
                                            totalPeopleInTeam += team.womenTeamMemberDetails.length;
                                        }
                                        if (team.driverDetailsMale && Array.isArray(team.driverDetailsMale)) {
                                            totalPeopleInTeam += team.driverDetailsMale.length;
                                        }
                                        if (team.driverDetailsFemale && Array.isArray(team.driverDetailsFemale)) {
                                            totalPeopleInTeam += team.driverDetailsFemale.length;
                                        }

                                        if (accommodationSummary[accommodationType]) {
                                            accommodationSummary[accommodationType] += totalPeopleInTeam;
                                        } else {
                                            accommodationSummary[accommodationType] = totalPeopleInTeam;
                                        }
                                    }
                                });
                            });
                        });

                        setExistingAccommodationCounts(accommodationSummary);
                    }
                }, (error) => {
                    console.error("Chyba pri načítaní dát z '/users/':", error);
                    setNotificationMessage("Chyba pri načítaní dát z databázy.");
                    setNotificationType('error');
                });

            } catch (e) {
                console.error("Chyba pri nastavovaní poslucháčov:", e);
                setNotificationMessage("Chyba pri načítaní údajov.");
                setNotificationType('error');
            }
        };

        fetchSettings();

        return () => {
            if (unsubscribeAccommodationTypes) {
                unsubscribeAccommodationTypes();
            }
            if (unsubscribePackages) {
                unsubscribePackages();
            }
            if (unsubscribeRegistrationSettings) {
                unsubscribeRegistrationSettings();
            }
            if (unsubscribeUsers) {
                unsubscribeUsers();
            }
        };
    }, [db]);

    // Táto funkcia teraz volá onGranularTeamsDataChange
    const handleTeamDataChange = (categoryName, teamIndex, field, value) => {
        onGranularTeamsDataChange(categoryName, teamIndex, field, value);
    };

    const teamsWithOwnTransport = React.useMemo(() => {
        const teams = [];
        for (const categoryName in teamsDataFromPage4) {
            if (!teamsDataFromPage4[categoryName] || typeof teamsDataFromPage4[categoryName] !== 'object') continue;

            (teamsDataFromPage4[categoryName] || []).filter(t => t).forEach((team, teamIndex) => {
                if (team.arrival?.type === 'vlastná doprava') {
                    teams.push({
                        categoryName: categoryName,
                        teamIndex: teamIndex,
                        teamName: team.teamName,
                        id: `${categoryName}-${teamIndex}`
                    });
                }
            });
        }
        return teams;
    }, [teamsDataFromPage4]);

    const getAvailableGenderOptions = React.useCallback((currentEntry) => {
        const allOptions = [
            React.createElement('option', { key: "placeholder", value: "" }, "Vyberte"),
            React.createElement('option', { key: "male", value: "male" }, "Muži"),
            React.createElement('option', { key: "female", value: "female" }, "Ženy")
        ];
    
        if (!currentEntry || currentEntry.categoryName === '' || currentEntry.teamIndex === null) {
            return allOptions;
        }
    
        const currentTeamId = `${currentEntry.categoryName}-${currentEntry.teamIndex}`;
        const usedGendersForCurrentTeam = new Set();
    
        driverEntries.forEach(entry => {
            if (entry.id !== currentEntry.id && entry.categoryName && entry.teamIndex !== null && entry.gender !== '') {
                if (`${entry.categoryName}-${entry.teamIndex}` === currentTeamId) {
                    usedGendersForCurrentTeam.add(entry.gender);
                }
            }
        });
    
        return allOptions.filter(option => {
            const optionValue = option.props.value;
            if (optionValue === '') {
                return true;
            }
            return !usedGendersForCurrentTeam.has(optionValue) || optionValue === currentEntry.gender;
        });
    }, [driverEntries]);

    const getAvailableTeamOptions = React.useCallback((currentEntry = null) => {
        const usedTeamGenderCombinations = new Set();
        driverEntries.forEach(entry => {
            if (entry.id !== (currentEntry ? currentEntry.id : null) && entry.categoryName && entry.teamIndex !== null && entry.gender !== '') {
                usedTeamGenderCombinations.add(`${entry.categoryName}-${entry.teamIndex}-${entry.gender}`);
            }
        });

        const options = [];
        teamsWithOwnTransport.forEach(team => {
            const maleCombo = `${team.id}-male`;
            const femaleCombo = `${team.id}-female`;

            if (currentEntry?.id && currentEntry.categoryName === team.categoryName && currentEntry.teamIndex === team.teamIndex) {
                 options.push(team);
            } else if (!usedTeamGenderCombinations.has(maleCombo) || !usedTeamGenderCombinations.has(femaleCombo)) {
                 options.push(team);
            }
        });

        const sortedOptions = options.sort((a, b) => a.teamName.localeCompare(b.teamName));
        return sortedOptions;
    }, [driverEntries, teamsWithOwnTransport]);

    const handleAddDriverEntry = () => {
        setDriverEntries(prev => {
            const newEntry = {
                id: generateUniqueTempId(),
                count: '',
                gender: '',
                categoryName: '',
                teamIndex: null
            };
            const updatedEntries = [...prev, newEntry];
            return updatedEntries;
        });
    };

    const handleRemoveDriverEntry = (idToRemove) => {
        let removedEntryTeamInfo = null;
        let removedEntryCategoryName = null;
        let removedEntryTeamIndex = null;

        setDriverEntries(prev => {
            const updatedEntries = prev.filter(entry => {
                if (entry.id === idToRemove) {
                    removedEntryCategoryName = entry.categoryName;
                    removedEntryTeamIndex = entry.teamIndex;
                    removedEntryTeamInfo = teamsDataFromPage4[entry.categoryName]?.[entry.teamIndex];
                    return false;
                }
                return true;
            });

            if (removedEntryTeamInfo && removedEntryCategoryName && removedEntryTeamIndex !== null && removedEntryTeamInfo.arrival?.type === 'vlastná doprava') {
                updateTeamDriversInParent(updatedEntries, removedEntryCategoryName, removedEntryTeamIndex);
            }
            return updatedEntries;
        });
    };

    const handleDriverEntryChange = (id, field, value) => {
        setDriverEntries(currentDrivers => {
            const newDrivers = currentDrivers.map(entry => ({ ...entry }));

            let updatedEntry = null;
            let updatedEntryIndex = -1; 

            for (let i = 0; i < newDrivers.length; i++) {
                if (newDrivers[i].id === id) {
                    updatedEntry = newDrivers[i]; 
                    updatedEntryIndex = i; 
                    break;
                }
            }

            if (!updatedEntry) {
                console.warn("Pokus o zmenu záznamu šoféra s neznámym ID:", id);
                return currentDrivers; 
            }

            if (field === 'teamId') {
                const [catName, teamIdxStr] = value.split('-');
                updatedEntry.categoryName = catName || '';
                updatedEntry.teamIndex = teamIdxStr ? parseInt(teamIdxStr, 10) : null;
                updatedEntry.gender = '';
            } else {
                updatedEntry[field] = value;
            }

            const affectedTeams = new Set();
            const originalEntryFromCurrentDrivers = currentDrivers.find(entry => entry.id === id);
            if (originalEntryFromCurrentDrivers && originalEntryFromCurrentDrivers.categoryName && originalEntryFromCurrentDrivers.teamIndex !== null) {
                affectedTeams.add(`${originalEntryFromCurrentDrivers.categoryName}-${originalEntryFromCurrentDrivers.teamIndex}`);
            }
            if (updatedEntry.categoryName && updatedEntry.teamIndex !== null) {
                affectedTeams.add(`${updatedEntry.categoryName}-${updatedEntry.teamIndex}`);
            }

            affectedTeams.forEach(teamIdStr => {
                const [catName, teamIdxStr] = teamIdStr.split('-');
                const teamIdx = parseInt(teamIdxStr, 10);
                if (teamsDataFromPage4[catName] && teamsDataFromPage4[catName][teamIdx] && teamsDataFromPage4[catName][teamIdx].arrival?.type === 'vlastná doprava') {
                    updateTeamDriversInParent(newDrivers, catName, teamIdx);
                }
            });
            
            return newDrivers; 
        });
    };

    const isAddDriverButtonVisible = React.useMemo(() => {
        if (loading) return false;

        const hasIncompleteEntry = driverEntries.some(entry =>
            entry.count === '' ||
            parseInt(entry.count, 10) <= 0 ||
            entry.gender === '' ||
            entry.categoryName === '' ||
            entry.teamIndex === null ||
            (entry.gender !== '' && !teamsWithOwnTransport.some(t => `${t.categoryName}-${t.teamIndex}`))
        );
        if (hasIncompleteEntry) {
            return false;
        }

        const usedCombinations = new Set();
        driverEntries.forEach(entry => {
            if (entry.categoryName && entry.teamIndex !== null && entry.gender) {
                usedCombinations.add(`${entry.categoryName}-${entry.teamIndex}-${entry.gender}`);
            }
        });

        for (const team of teamsWithOwnTransport) {
            const maleCombo = `${team.id}-male`;
            const femaleCombo = `${team.id}-female`;

            if (!usedCombinations.has(maleCombo) || !usedCombinations.has(femaleCombo)) {
                 return true;
            }
        }
        return false;
    }, [driverEntries, teamsWithOwnTransport, loading]);

    // UPRAVENÁ VALIDÁCIA: Počíta s existujúcimi + aktuálnymi registráciami
    const isFormValidPage5 = React.useMemo(() => {
        if (!teamsDataFromPage4 || Object.keys(teamsDataFromPage4).length === 0) {
            return false;
        }

        let hasTeamWithOwnTransport = false;

        // Overenie, či sú všetky tímy a ich dáta platné
        for (const categoryName in teamsDataFromPage4) {
            const teamsInCurrentCategory = teamsDataFromPage4[categoryName];
            if (!teamsInCurrentCategory || !Array.isArray(teamsInCurrentCategory)) continue;

            for (const team of teamsInCurrentCategory) {
                if (!team) continue;

                // Validácia ubytovania
                if (accommodationTypes.length > 0) {
                    if (!team.accommodation?.type || team.accommodation.type.trim() === '') {
                        return false;
                    }

                    // Pre tímy, ktoré si vybrali konkrétny typ ubytovania (nie "bez ubytovania")
                    if (team.accommodation.type !== 'bez ubytovania') {
                        const selectedAccType = accommodationTypes.find(acc => acc.type === team.accommodation.type);
                        
                        if (selectedAccType) {
                            // Celková obsadenosť = EXISTUJÚCE registrácie + AKTUÁLNA registrácia
                            const existingOccupied = existingAccommodationCounts[selectedAccType.type] || 0;
                            const currentOccupied = currentRegistrationAccommodationCounts[selectedAccType.type] || 0;
                            const totalOccupied = existingOccupied + currentOccupied;
                            
                            if (totalOccupied > selectedAccType.capacity) {
                                return false;
                            }
                        }
                    }
                }
                
                // Validácia balíčka
                if (packages.length > 0 && (!team.packageId || team.packageId.trim() === '')) {
                    return false;
                }
                
                // Validácia času príchodu pre verejnú dopravu
                if ((team.arrival?.type === 'verejná doprava - vlak' || team.arrival?.type === 'verejná doprava - autobus') && 
                    (!team.arrival?.time || team.arrival.time.trim() === '' || team.arrival.time.length !== 5)) {
                    return false;
                }

                if (team.arrival?.type === 'vlastná doprava') {
                    hasTeamWithOwnTransport = true;
                }
            }
        }

        // Validácia duplicitných záznamov šoférov
        const usedDriverEntryCombinations = new Set();
        for (const entry of driverEntries) {
            const count = parseInt(entry.count, 10);
            if (isNaN(count) || count <= 0 || entry.gender === '' || entry.categoryName === '' || entry.teamIndex === null) {
                return false;
            }

            const comboKey = `${entry.categoryName}-${entry.teamIndex}-${entry.gender}`;
            if (usedDriverEntryCombinations.has(comboKey)) {
                return false;
            }
            usedDriverEntryCombinations.add(comboKey);
        }
        
        return true;
    }, [teamsDataFromPage4, accommodationTypes, existingAccommodationCounts, currentRegistrationAccommodationCounts, packages, driverEntries, teamsWithOwnTransport]);

    const nextButtonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200
    ${!isFormValidPage5 || loading || !isRecaptchaReady
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
      : 'bg-blue-500 hover:bg-blue-700 text-white'
    }
  `;

    const addButtonClasses = `
        font-bold w-10 h-10 rounded-full flex items-center justify-center mx-auto mt-4
        transition-colors duration-200 focus:outline-none focus:shadow-outline
        ${!isAddDriverButtonVisible || loading
            ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-700 text-white'
        }`.trim();

    const handlePage5Submit = async (e) => {
        e.preventDefault();

        if (setLoading) setLoading(true);
        closeNotification();

        if (!isFormValidPage5) {
            let errorMessage = "Prosím, vyplňte všetky povinné polia pre každý tím (ubytovanie, balíček, príchod).";
            
            if (driverEntries.length > 0) {
                 errorMessage += " Skontrolujte tiež, či sú všetky pridané záznamy šoférov vyplnené, majú kladný počet a nie sú duplicitné pre daný tím a pohlavie.";
            }

            setNotificationMessage(errorMessage);
            setNotificationType('error');
            setLoading(false);
            return;
        }

        try {
            await handleSubmit(teamsDataFromPage4); 
        } catch (error) {
            console.error("Chyba pri spracovaní dát Page5:", error);
            setNotificationMessage(`Chyba pri spracovaní údajov: ${error.message}`);
            setNotificationType('error');
        } finally {
            if (setLoading) setLoading(false);
        }
    };

    const generateTimeOptions = (limit) => {
        const options = [React.createElement('option', { key: "placeholder", value: "" }, "--")];
        for (let i = 0; i < limit; i++) {
            const value = i.toString().padStart(2, '0');
            options.push(React.createElement('option', { key: value, value: value }, value));
        }
        return options;
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
          'Registrácia - strana 5'
        ),
        React.createElement(
          'form',
          { onSubmit: handlePage5Submit, className: 'space-y-4' },
          Object.keys(teamsDataFromPage4).length === 0 ? (
            React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Prejdite prosím na predchádzajúcu stránku a zadajte tímy.')
          ) : (
            Object.keys(teamsDataFromPage4)
              .filter(categoryName => {
                const categoryData = teamsDataFromPage4[categoryName];
                if (typeof categoryName !== 'string' || categoryName.trim() === '') return false;
                if (!categoryData || typeof categoryData !== 'object' || !Array.isArray(categoryData)) return false;
                return categoryData.some(team => team !== null && team !== undefined);
              })
              .map(categoryName => (
                React.createElement(
                  'div',
                  { key: categoryName, className: 'border-t border-gray-200 pt-4 mt-4' },
                  React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, `Kategória: ${categoryName}`),
                  (teamsDataFromPage4[categoryName] || []).filter(t => t).map((team, teamIndex) => (
                    React.createElement(
                      'div',
                      { key: `${categoryName}-${teamIndex}`, className: 'bg-blue-50 p-4 rounded-lg mb-4 space-y-2' },
                      React.createElement('p', { className: 'font-semibold text-blue-800 mb-4' }, `Tím: ${team.teamName}`),

                      React.createElement(TeamJerseyColors, {
                        team: team,
                        categoryName: categoryName,
                        teamIndex: teamIndex,
                        onGranularTeamsDataChange: onGranularTeamsDataChange,
                        loading: loading
                      }),

                      React.createElement(TeamAccommodationAndArrival, {
                        team: team,
                        categoryName: categoryName,
                        teamIndex: teamIndex,
                        onGranularTeamsDataChange: onGranularTeamsDataChange,
                        loading: loading,
                        accommodationTypes: accommodationTypes,
                        // UPRAVENÉ: Odovzdávame EXISTUJÚCE počty, nie celkové
                        existingAccommodationCounts: existingAccommodationCounts,
                        // UPRAVENÉ: Odovzdávame AJ aktuálne počty pre dynamickú kontrolu kapacity
                        currentRegistrationAccommodationCounts: currentRegistrationAccommodationCounts,
                        tournamentStartDate: localTournamentStartDate,
                        generateTimeOptions: generateTimeOptions,
                        arrivalDateTime: arrivalDateTime
                      }),

                      React.createElement(TeamPackageSettings, {
                        team: team,
                        categoryName: categoryName,
                        teamIndex: teamIndex,
                        onGranularTeamsDataChange: onGranularTeamsDataChange,
                        loading: loading,
                        packages: packages,
                        tournamentDays: tournamentDays,
                        selectedAccommodationType: team.accommodation?.type
                      })
                    )
                  ))
                )
              ))
            ),

            teamsWithOwnTransport.length > 0 && (
                React.createElement(
                    'div',
                    { className: 'border-t border-gray-200 pt-4 mt-4' },
                    React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, 'Šoféri pri voľbe vlastná doprava'),
                    React.createElement('p', { className: 'text-sm text-gray-600 mb-4' }, 'Pridajte informácie o šoféroch pre tímy, ktoré majú zvolenú vlastnú dopravu. Zvoľte tím, ku ktorému budú šoféri priradení (ubytovanie a stravovanie spoločné so zvoleným tímom).'),

                    driverEntries.map((entry) => (
                        React.createElement(
                            'div',
                            { key: entry.id, className: 'flex items-start space-x-2 mb-4 w-full' },
                            React.createElement(
                                'div',
                                { className: 'flex flex-col flex-grow space-y-2' },
                                React.createElement(
                                    'div',
                                    { className: 'w-full' },
                                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Tím'),
                                    React.createElement(CustomTeamSelect, {
                                        value: entry.categoryName && entry.teamIndex !== null ? `${entry.categoryName}-${entry.teamIndex}` : '',
                                        onChange: (value) => handleDriverEntryChange(entry.id, 'teamId', value),
                                        options: getAvailableTeamOptions(entry),
                                        disabled: loading,
                                        placeholder: 'Vyberte tím',
                                    })
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'flex space-x-2 w-full' },
                                    React.createElement('div', { className: 'w-1/2 flex-shrink-0' },
                                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Počet'),
                                        React.createElement('input', {
                                            type: 'number',
                                            className: 'shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-full',
                                            value: entry.count,
                                            onChange: (e) => handleDriverEntryChange(entry.id, 'count', e.target.value),
                                            placeholder: 'Zadajte počet',
                                            min: 0,
                                            required: true,
                                            disabled: loading,
                                            id: `count-${entry.id}`
                                        })
                                    ),
                                    React.createElement('div', { className: 'w-1/2' },
                                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-1' }, 'Pohlavie'),
                                        React.createElement('select', {
                                            className: 'shadow border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-full',
                                            value: entry.gender,
                                            onChange: (e) => handleDriverEntryChange(entry.id, 'gender', e.target.value),
                                            required: true,
                                            disabled: loading,
                                            id: `gender-${entry.id}`
                                        }, getAvailableGenderOptions(entry))
                                    )
                                )
                            ),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleRemoveDriverEntry(entry.id),
                                    className: `bg-red-500 hover:bg-red-700 text-white font-bold w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-colors duration-200 focus:outline-none focus:shadow-outline ml-2 mt-auto mb-auto ${driverEntries.length === 0 ? 'invisible' : ''}`,
                                    disabled: loading,
                                },
                                '-'
                            )
                        )
                    )),
                    (isAddDriverButtonVisible && !loading) && React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: handleAddDriverEntry,
                            className: addButtonClasses,
                        },
                        '+'
                    )
                )
            ),

            React.createElement(
                'div',
                { className: 'flex justify-between mt-6' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: () => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4: teamsDataFromPage4 }),
                        className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
                        disabled: loading,
                    },
                    'Späť'
                ),
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: nextButtonClasses,
                        disabled: loading || !isRecaptchaReady || !isFormValidPage5,
                        tabIndex: 2
                    },
                    loading ? React.createElement(
                        'div',
                        { className: 'flex items-center justify-center' },
                        React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                            React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '10', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                            React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                        ),
                        'Ďalej...'
                    ) : 'Ďalej'
                )
            )
        )
    );
}

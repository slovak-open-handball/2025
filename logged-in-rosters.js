import { getFirestore, doc, onSnapshot, updateDoc, collection, query, where, getDoc, getDocs, addDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef, useMemo } = window.React || {};

function useRegistrationLimits() {
    const db = getFirestore();
    const [limitsByCategory, setLimitsByCategory] = useState({});

    useEffect(() => {
        if (!db) return;

        const categoriesDocRef = doc(db, 'settings', 'categories');

        const unsubscribe = onSnapshot(categoriesDocRef, (docSnap) => {
            const newLimitsByCategory = {};
            if (docSnap.exists()) {
                const data = docSnap.data();
                Object.entries(data).forEach(([categoryId, categoryData]) => {
                    const categoryName = categoryData.name;
                    if (categoryName) {
                        newLimitsByCategory[categoryName] = {
                            numberOfPlayers: Number(categoryData.maxPlayers) ?? 12,
                            numberOfImplementationTeam: Number(categoryData.maxImplementationTeam) ?? 3
                        };
                    }
                });
            }
            setLimitsByCategory(newLimitsByCategory);
        }, (error) => {
            setLimitsByCategory({});
        });

        return () => unsubscribe();
    }, [db]);

    return limitsByCategory;
}

const getChangesForNotification = (original, updated, formatDateFn) => {
    const changes = [];

    const ignoredKeys = new Set([
        '_userId', '_teamIndex', '_registeredBy', 'id', 'uniqueId',
        'originalArray', 'originalIndex', 'password', 'emailVerified',
        'isMenuToggled', 'role', 'approved', 'registrationDate',
        'passwordLastChanged', 'teams', 'categories', 'timestamp', 'note',
        '_category', '_menTeamMembersCount', '_womenTeamMembersCount',
        '_menDriversCount', '_womenDriversCount', '_players', '_teamTshirtsMap'
    ]);

    const normalize = (value, path) => {
        if (value == null) return '';
    
        if (typeof value.toDate === 'function') {
            return formatDateFn(value.toDate());
        }
    
        const lowerPath = path.toLowerCase();
    
        if (lowerPath === 'arrival') {
            return value.type
                ? `${value.type}${value.time ? ` (${value.time})` : ''}`
                : '';
        }
    
        if (lowerPath === 'arrival.type') {
            return value || '';
        }
        if (lowerPath === 'arrival.time') {
            return value || '';
        }
    
        if (lowerPath.includes('dateofbirth') ||
            lowerPath.includes('registrationdate') ||
            lowerPath.includes('date')) {
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return formatDateFn(value);
            }
        }
    
        if (typeof value === 'object' && !Array.isArray(value)) {
            return JSON.stringify(value);
        }
    
        return String(value);
    };

    const processMealsChanges = (origMeals, updMeals) => {
        if (!origMeals || !updMeals) return;
        const allDates = new Set([
            ...Object.keys(origMeals || {}),
            ...Object.keys(updMeals || {})
        ]);
        allDates.forEach(date => {
            if (date === 'participantCard') {
                const o = origMeals[date] === 1 ? 'Áno' : 'Nie';
                const u = updMeals[date] === 1 ? 'Áno' : 'Nie';
                if (o !== u) {
                    changes.push(`Detail balíka → Účastnícka karta: z '${o}' na '${u}'`);
                }
                return;
            }
            const origDay = origMeals[date] || {};
            const updDay = updMeals[date] || {};
            const mealTranslations = {
                breakfast: 'raňajky',
                lunch: 'obed',
                dinner: 'večera',
                refreshment: 'občerstvenie'
            };
            Object.keys(mealTranslations).forEach(mealKey => {
                const oVal = origDay[mealKey] === 1 ? 'Áno' :
                             origDay[mealKey] === 0 ? 'Nie' : '-';
                const uVal = updDay[mealKey] === 1 ? 'Áno' :
                             updDay[mealKey] === 0 ? 'Nie' : '-';
                if (oVal !== uVal) {
                    const slovakMeal = mealTranslations[mealKey];
                    const niceDate = formatDateFn(date);
                    changes.push(
                        `Detail balíka → Stravovanie ${niceDate} – ${slovakMeal}: z '${oVal}' na '${uVal}'`
                    );
                }
            });
        });
    };

    if (original?.packageDetails?.meals || updated?.packageDetails?.meals) {
        processMealsChanges(
            original?.packageDetails?.meals,
            updated?.packageDetails?.meals
        );
    }

    const compare = (o, u, prefix = '') => {
        const keys = new Set([...Object.keys(o || {}), ...Object.keys(u || {})]);
        for (const key of keys) {
            if (ignoredKeys.has(key)) continue;

            const currentPath = prefix ? `${prefix}.${key}` : key;

            if (currentPath.startsWith('packageDetails.meals')) {
                continue;
            }

            const ov = o?.[key];
            const uv = u?.[key];

            if (typeof ov === 'object' && ov !== null && !Array.isArray(ov) &&
                typeof uv === 'object' && uv !== null && !Array.isArray(uv)) {
                compare(ov, uv, currentPath);
                continue;
            }

            if (currentPath === 'tshirts' || currentPath.endsWith('.tshirts')) {
                const origMap = new Map((ov || []).map(t => [String(t.size).trim(), t.quantity || 0]));
                const updMap = new Map((uv || []).map(t => [String(t.size).trim(), t.quantity || 0]));
                const allSizes = new Set([...origMap.keys(), ...updMap.keys()]);
                for (const size of allSizes) {
                    const oldQ = origMap.get(size) || 0;
                    const newQ = updMap.get(size) || 0;
                    if (oldQ !== newQ) {
                        if (oldQ === 0) {
                            changes.push(`Pridané tričká '''(${size}): ${newQ} ks'`);
                        } else if (newQ === 0) {
                            changes.push(`Odstránené tričká '''(${size}): ${oldQ} ks'`);
                        } else {
                            changes.push(`Zmena počtu tričiek (${size}): z '${oldQ} ks' na '${newQ} ks'`);
                        }
                    }
                }
                continue;
            }

            const a = normalize(ov, currentPath);
            const b = normalize(uv, currentPath);

            if (a !== b) {
                let label = currentPath
                    .replace(/\./g, ' → ')
                    .replace(/\[(\d+)\]/g, ' [$1]');

                const niceLabels = {
                    'teamName': 'Názov tímu',
                    'arrival.type': 'Typ dopravy',
                    'arrival.time': 'Čas príchodu',
                    'accommodation.type': 'Typ ubytovania',
                    'accommodation.name': 'Ubytovňa',
                    'packageDetails.name': 'Názov balíka',
                    'packageDetails.price': 'Cena balíka',
                    'firstName': 'Meno',
                    'lastName': 'Priezvisko',
                    'dateOfBirth': 'Dátum narodenia',
                    'jerseyNumber': 'Číslo dresu',
                    'registrationNumber': 'Registračné číslo',
                    'address.street': 'Ulica',
                    'address.houseNumber': 'Popisné číslo',
                    'address.postalCode': 'PSČ',
                    'address.city': 'Mesto/obec',
                    'address.country': 'Štát',
                    'jerseyHomeColor': 'Farba dresov 1',
                    'jerseyAwayColor': 'Farba dresov 2'
                };

                if (niceLabels[currentPath]) {
                    label = niceLabels[currentPath];
                }

                let displayA = a || '-';
                let displayB = b || '-';

                if (currentPath === 'packageDetails.price') {
                    displayA = a ? `${a} €` : '-';
                    displayB = b ? `${b} €` : '-';
                }

                changes.push(`Zmena ${label}: z '${displayA}' na '${displayB}'`);
            }
        }
    };

    compare(original, updated);

    return changes;
};

const formatPostalCode = (value) => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 5);
    if (digits.length <= 3) return digits;
    return digits.slice(0, 3) + ' ' + digits.slice(3);
};

const cleanPostalCode = (value) => {
    return value ? value.replace(/\D/g, '').slice(0, 5) : '';
};

function showLocalNotification(message, type = 'success') {
    let notificationElement = document.getElementById('local-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'local-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }
    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success':
            typeClasses = 'bg-green-500 text-white';
            break;
        case 'error':
            typeClasses = 'bg-red-500 text-white';
            break;
        case 'info':
            typeClasses = 'bg-blue-500 text-white';
            break;
        default:
            typeClasses = 'bg-gray-700 text-white';
    }
    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
}

const formatDateTimeSK = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date)) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}. ${pad(date.getMonth()+1)}. ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())} hod.`;
};

const formatDateToDMMYYYY = (dateString) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    if (year && month && day) {
        return `${day}. ${month}. ${year}`;
    }
    return dateString;
};

window.formatDateToDMMYYYY = formatDateToDMMYYYY;

const mealTypeLabels = {
    breakfast: 'raňajky',
    lunch: 'obed',
    dinner: 'večera',
    refreshment: 'občerstvenie'
};
const mealOrder = ['breakfast', 'lunch', 'dinner', 'refreshment'];
const dayAbbreviations = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];

const getRoleColor = (role) => {
    switch (role) {
        case 'admin':
            return '#47b3ff';
        case 'hall':
            return '#b06835';
        case 'club':
            return '#9333EA';
        default:
            return '#1D4ED8';
    }
};

function AddMemberTypeModal({ 
  show, 
  onClose, 
  onSelectMemberType, 
  userProfileData, 
  isDataEditDeadlinePassed,
  maxPlayersPerTeam,
  maxImplementationMembers,
  currentTeam
}) {
  const [selectedType, setSelectedType] = useState('');

  if (!show) return null;

  const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';

  const currentPlayersCount = Number(currentTeam?.players) || 0;
  const currentImplCount = 
    (Number(currentTeam?.menTeamMembers ?? 0) + Number(currentTeam?.womenTeamMembers ?? 0));

  const playersLimitReached = currentPlayersCount >= maxPlayersPerTeam;
  const implLimitReached    = currentImplCount    >= maxImplementationMembers;
  
  const isOwnTransport = currentTeam?.arrival?.type === 'vlastná doprava';

  const handleAdd = () => {
    if (selectedType) {
      onSelectMemberType(selectedType);
      setSelectedType('');
      onClose();
    } else {
      showLocalNotification('Prosím, vyberte typ člena.', 'error');
    }
  };

  const isButtonDisabled = isDataEditDeadlinePassed;

  const buttonClasses = `px-4 py-2 rounded-md transition-colors ${
    isButtonDisabled ? 'bg-white text-current border border-current' : 'text-white'
  }`;

  const buttonStyles = {
    backgroundColor: isButtonDisabled ? 'white' : roleColor,
    color: isButtonDisabled ? roleColor : 'white',
    borderColor: isButtonDisabled ? roleColor : 'transparent',
    cursor: isButtonDisabled ? 'not-allowed' : 'pointer'
  };

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex justify-center items-center p-4 z-[1001]' },
    React.createElement(
      'div',
      { className: 'relative p-8 bg-white w-full max-w-sm mx-auto rounded-lg shadow-lg' },
      React.createElement(
        'div',
        { className: `flex justify-between items-center text-white p-4 -mx-8 -mt-8 mb-4 rounded-t-lg`, style: { backgroundColor: roleColor } },
        React.createElement('h3', { className: 'text-xl font-semibold' }, 'Pridať člena tímu'),
        React.createElement(
          'button',
          { onClick: onClose, className: 'text-white hover:text-gray-200 text-3xl leading-none font-semibold' },
          '×'
        )
      ),
      React.createElement(
        'div',
        { className: 'space-y-4' },
        React.createElement(
          'div',
          null,
          React.createElement('label', { htmlFor: 'memberType', className: 'block text-sm font-medium text-gray-700' }, 'Typ člena'),
          React.createElement('select', {
            id: 'memberType',
            className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
            value: selectedType,
            onChange: (e) => setSelectedType(e.target.value),
            required: true,
            disabled: isButtonDisabled
          },
            React.createElement('option', { value: '' }, 'Vyberte typ'),

            React.createElement('option', {
              value: 'player',
              disabled: playersLimitReached
            }, 'Hráč'),

            React.createElement('option', {
              value: 'womenTeamMember',
              disabled: implLimitReached
            }, 'Člen realizačného tímu (žena)'),

            React.createElement('option', {
              value: 'menTeamMember',
              disabled: implLimitReached
            }, 'Člen realizačného tímu (muž)'),

            isOwnTransport && React.createElement('option', {
              value: 'driverFemale'
            }, 'Šofér (žena)'),

            isOwnTransport && React.createElement('option', {
              value: 'driverMale'
            }, 'Šofér (muž)')
          )
        ),
        React.createElement(
          'div',
          { className: 'flex justify-end space-x-2 mt-6' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: onClose,
              className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors'
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleAdd,
              disabled: isButtonDisabled,
              className: buttonClasses,
              style: buttonStyles
            },
            'Pridať'
          )
        )
      )
    )
  );
}

function MemberDetailsModal({
    show,
    onClose,
    onSaveMember,
    memberType,
    userProfileData,
    teamAccommodationType,
    memberData,
    isEditMode,
    isRosterEditDeadlinePassed,
    isDataEditDeadlinePassed,
    teamCategoryName,
    currentTeam,
    maxPlayersPerTeam,
    maxImplementationMembers,
    teamOfMemberToEdit,
}) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [jerseyNumber, setJerseyNumber] = useState('');
    const [registrationNumber, setRegistrationNumber] = useState('');
    const [street, setStreet] = useState('');
    const [houseNumber, setHouseNumber] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const postalCodeInputRef = useRef(null);
    const [dateOfBirthError, setDateOfBirthError] = useState('');
    const [isDateOfBirthValid, setIsDateOfBirthValid] = useState(true);

    const [regNumberError, setRegNumberError] = useState('');
    const [isRegNumberUnique, setIsRegNumberUnique] = useState(true);

    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';
    const showAddressFields = teamAccommodationType !== 'bez ubytovania';
    const isButtonDisabled = isEditMode ? isRosterEditDeadlinePassed : isDataEditDeadlinePassed;
    
    const handlePostalCodeChange = (e) => {
        const input = e.target;
        const cursorPosition = input.selectionStart; 
    
        const cleaned = cleanPostalCode(input.value);
    
        setPostalCode(cleaned);
    
        setTimeout(() => {
            if (!postalCodeInputRef.current) return;
    
            const formatted = formatPostalCode(cleaned);
            const inputEl = postalCodeInputRef.current;
    
            let newPosition = cursorPosition;
    
            if (input.value.length > formatted.length) {
                if (cursorPosition > 3 && cursorPosition <= 4) {
                    newPosition = 3;
                } else if (cursorPosition > 4) {
                    newPosition = cursorPosition - 1;
                }
            } else {
                if (cursorPosition > 3 && cursorPosition < 5) {
                    newPosition = cursorPosition + 1;
                }
            }
    
            newPosition = Math.min(newPosition, formatted.length);
            newPosition = Math.max(0, newPosition);
    
            inputEl.setSelectionRange(newPosition, newPosition);
        }, 0);
    };  

    const validateDateOfBirth = (dateString, categoryName) => {
        if (!dateString) {
            setDateOfBirthError('Dátum narodenia je povinný.');
            setIsDateOfBirthValid(false);
            return false;
        }

        const birthDate = new Date(dateString);
        const today = new Date();
        if (birthDate > today) {
            setDateOfBirthError('Dátum narodenia nemôže byť v budúcnosti.');
            setIsDateOfBirthValid(false);
            return false;
        }

        if (window.categoriesWithDates && window.categoriesWithDates[categoryName]) {
            const { dateFrom, dateTo } = window.categoriesWithDates[categoryName];
            const dateFromObj = dateFrom ? new Date(dateFrom) : null;
            const dateToObj = dateTo ? new Date(dateTo) : null;

            if (dateFromObj && birthDate < dateFromObj) {
                setDateOfBirthError(`Dátum narodenia musí byť neskôr ako ${formatDateToDMMYYYY(dateFrom)}.`);
                setIsDateOfBirthValid(false);
                return false;
            }
            if (dateToObj && birthDate > dateToObj) {
                setDateOfBirthError(`Dátum narodenia musí byť skôr ako ${formatDateToDMMYYYY(dateTo)}.`);
                setIsDateOfBirthValid(false);
                return false;
            }
        }

        setDateOfBirthError('');
        setIsDateOfBirthValid(true);
        return true;
    };

    const checkRegistrationDuplicate = (regNumber) => {
        if (memberType !== 'player' || !regNumber?.trim()) {
            setRegNumberError('');
            setIsRegNumberUnique(true);
            return true;
        }

        const existingPlayers = currentTeam?.playerDetails || [];

        const isDuplicate = existingPlayers.some(player => {
            if (isEditMode) {
                if (
                    player.firstName === memberData?.firstName &&
                    player.lastName === memberData?.lastName &&
                    player.dateOfBirth === memberData?.dateOfBirth
                ) {
                    return false;
                }
            }
            return (player.registrationNumber || '').trim() === regNumber.trim();
        });

        if (isDuplicate) {
            setRegNumberError('Hráč s týmto číslom registrácie už v tíme existuje.');
            setIsRegNumberUnique(false);
            return false;
        }

        setRegNumberError('');
        setIsRegNumberUnique(true);
        return true;
    };

    const handleDateOfBirthChange = (e) => {
        const newDate = e.target.value;
        setDateOfBirth(newDate);
        if (memberType === 'player') {
            validateDateOfBirth(newDate, teamCategoryName);
        }
    };

    const handleRegistrationChange = (e) => {
        const value = e.target.value;
        setRegistrationNumber(value);
        checkRegistrationDuplicate(value);
    };

    useEffect(() => {
        const loadMemberData = async () => {
            if (show) {                
                if (isEditMode && memberData) {
                    setFirstName(memberData.firstName || '');
                    setLastName(memberData.lastName || '');
                    setJerseyNumber(memberData.jerseyNumber || '');
                    setRegistrationNumber(memberData.registrationNumber || '');
                    
                    let foundPrivateData = false;
                    
                    if (memberData._privateData && teamOfMemberToEdit) {
                        const teamKey = `${teamOfMemberToEdit.categoryName}_team${teamOfMemberToEdit._teamIndex + 1}`;
                        const privateTeamData = memberData._privateData.persons?.[teamKey];
                        
                        if (privateTeamData) {
                            let privateArrayName;
                            switch (memberData.originalType) {
                                case 'player':
                                    privateArrayName = 'players';
                                    break;
                                case 'womenTeamMember':
                                    privateArrayName = 'womenTeamMembers';
                                    break;
                                case 'menTeamMember':
                                    privateArrayName = 'menTeamMembers';
                                    break;
                                case 'driverFemale':
                                    privateArrayName = 'driversFemale';
                                    break;
                                case 'driverMale':
                                    privateArrayName = 'driversMale';
                                    break;
                                default:
                                    privateArrayName = null;
                            }
                            
                            if (privateArrayName && privateTeamData[privateArrayName]) {
                                let privateMember = null;
                                
                                if (memberData._memberIndex !== undefined && privateTeamData[privateArrayName][memberData._memberIndex]) {
                                    privateMember = privateTeamData[privateArrayName][memberData._memberIndex];
                                } else {
                                    privateMember = privateTeamData[privateArrayName].find(
                                        p => p.firstName === memberData.firstName && 
                                             p.lastName === memberData.lastName
                                    );
                                }
                                
                                if (privateMember) {
                                    setDateOfBirth(privateMember.dateOfBirth || '');
                                    if (privateMember.address) {
                                        setStreet(privateMember.address.street || '');
                                        setHouseNumber(privateMember.address.houseNumber || '');
                                        setPostalCode(privateMember.address.postalCode || '');
                                        setCity(privateMember.address.city || '');
                                        setCountry(privateMember.address.country || '');
                                    }
                                    foundPrivateData = true;
                                }
                            }
                        }
                    }
                    
                    if (!foundPrivateData) {
                        setDateOfBirth(memberData.dateOfBirth || '');
                        if (memberData.address) {
                            setStreet(memberData.address.street || '');
                            setHouseNumber(memberData.address.houseNumber || '');
                            setPostalCode(memberData.address.postalCode || '');
                            setCity(memberData.address.city || '');
                            setCountry(memberData.address.country || '');
                        } else {
                            setStreet('');
                            setHouseNumber('');
                            setPostalCode('');
                            setCity('');
                            setCountry('');
                        }
                    }
                    
                    if (memberType === 'player' && memberData.registrationNumber) {
                        checkRegistrationDuplicate(memberData.registrationNumber);
                    }
                } else {
                    setFirstName('');
                    setLastName('');
                    setDateOfBirth('');
                    setJerseyNumber('');
                    setRegistrationNumber('');
                    setStreet('');
                    setHouseNumber('');
                    setPostalCode('');
                    setCity('');
                    setCountry('');
                    setRegNumberError('');
                    setIsRegNumberUnique(true);
                }
            }
        };
        
        loadMemberData();
    }, [show, memberType, memberData, isEditMode, teamOfMemberToEdit]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isButtonDisabled) return;

        let canSubmit = true;

        if (memberType === 'player') {
            if (!validateDateOfBirth(dateOfBirth, teamCategoryName)) {
                canSubmit = false;
            }
            if (!checkRegistrationDuplicate(registrationNumber)) {
                canSubmit = false;
            }
        }

        if (!canSubmit) return;

        const memberDetails = {
            firstName,
            lastName,
            dateOfBirth,
            ...(memberType === 'player' && { 
                jerseyNumber: parseInt(jerseyNumber, 10) || null,
                registrationNumber: registrationNumber?.trim() || null 
            }),
        };

        if (showAddressFields) {
            memberDetails.address = {
                street,
                houseNumber,
                postalCode,
                city,
                country
            };
        }

        onSaveMember(memberDetails);
        onClose();
    };

    const isSubmitDisabled = 
        isButtonDisabled || 
        !isDateOfBirthValid ||
        (memberType === 'player' && !isRegNumberUnique);

    const buttonClasses = `px-4 py-2 rounded-md transition-colors ${
        isSubmitDisabled ? 'bg-white text-current border border-current' : 'text-white'
    }`;

    const buttonStyles = {
        backgroundColor: isSubmitDisabled ? 'white' : roleColor,
        color: isSubmitDisabled ? roleColor : 'white',
        borderColor: isSubmitDisabled ? roleColor : 'transparent',
        cursor: isSubmitDisabled ? 'not-allowed' : 'pointer'
    };

    if (!show) return null;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex justify-center items-center p-4 z-[1001]' },
        React.createElement(
            'div',
            { className: 'relative p-6 bg-white w-full max-w-md mx-auto rounded-lg shadow-lg max-h-[85vh] overflow-y-auto overflow-x-hidden' },
            React.createElement(
                'div',
                { className: `flex justify-between items-center text-white p-4 -mx-8 -mt-8 mb-4 rounded-t-lg`, style: { backgroundColor: roleColor } },
                React.createElement('h3', { className: 'text-xl font-semibold' }, 
                    `${isEditMode ? 'Upraviť' : 'Pridať'} ${memberType === 'player' ? 'hráč' : memberType === 'womenTeamMember' ? 'člen realizačného tímu (žena)' : memberType === 'menTeamMember' ? 'člen realizačného tímu (muž)' : memberType === 'driverFemale' ? 'šofér (žena)' : memberType === 'driverMale' ? 'šofér (muž)' : 'člena'}`
                ),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-white hover:text-gray-200 text-3xl leading-none font-semibold' },
                    '×'
                )
            ),
            React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'space-y-4' },
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'firstName', className: 'block text-sm font-medium text-gray-700' }, 'Meno'),
                    React.createElement('input', { 
                        type: 'text', 
                        id: 'firstName', 
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', 
                        value: firstName, 
                        onChange: (e) => setFirstName(e.target.value), 
                        required: true, 
                        disabled: isButtonDisabled 
                    })
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700' }, 'Priezvisko'),
                    React.createElement('input', { 
                        type: 'text', 
                        id: 'lastName', 
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', 
                        value: lastName, 
                        onChange: (e) => setLastName(e.target.value), 
                        required: true, 
                        disabled: isButtonDisabled 
                    })
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'dateOfBirth', className: 'block text-sm font-medium text-gray-700' }, 'Dátum narodenia'),
                    React.createElement('input', {
                        type: 'date',
                        id: 'dateOfBirth',
                        className: `mt-1 block w-full border rounded-md shadow-sm p-2 ${dateOfBirthError ? 'border-red-500' : 'border-gray-300'}`,
                        value: dateOfBirth,
                        onChange: handleDateOfBirthChange,
                        disabled: isButtonDisabled
                    }),
                    dateOfBirthError && React.createElement('p', { className: 'mt-1 text-sm text-red-600' }, dateOfBirthError)
                ),
                (memberType === 'player') && React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'jerseyNumber', className: 'block text-sm font-medium text-gray-700' }, 'Číslo dresu'),
                    React.createElement('input', { 
                        type: 'number', 
                        id: 'jerseyNumber', 
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', 
                        value: jerseyNumber, 
                        onChange: (e) => setJerseyNumber(e.target.value), 
                        disabled: isButtonDisabled 
                    })
                ),
                (memberType === 'player') && React.createElement('div', null,
                    React.createElement('label', { 
                        htmlFor: 'registrationNumber', 
                        className: 'block text-sm font-medium text-gray-700' 
                    }, 'Číslo registrácie'),
                    React.createElement('input', {
                        type: 'text',
                        id: 'registrationNumber',
                        className: `mt-1 block w-full border rounded-md shadow-sm p-2 transition-colors ${
                            regNumberError
                                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                        }`,
                        value: registrationNumber,
                        onChange: handleRegistrationChange,
                        disabled: isButtonDisabled,
                    }),
                    regNumberError && React.createElement('p', { 
                        className: 'mt-1 text-sm text-red-600' 
                    }, regNumberError)
                ),

                showAddressFields && React.createElement('div', { className: 'space-y-4 mt-6 border-t pt-4' },
                React.createElement('h4', { className: 'text-md font-semibold text-gray-800' }, 'Adresa trvalého bydliska (pre účely ubytovania)'),

                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'street', className: 'block text-sm font-medium text-gray-700' }, 'Ulica'),
                    React.createElement('input', {
                        type: 'text',
                        id: 'street',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: street,
                        onChange: (e) => setStreet(e.target.value),
                        disabled: isButtonDisabled
                    })
                ),
            
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'houseNumber', className: 'block text-sm font-medium text-gray-700' }, 'Popisné číslo'),
                    React.createElement('input', {
                        type: 'text',
                        id: 'houseNumber',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: houseNumber,
                        onChange: (e) => setHouseNumber(e.target.value),
                        disabled: isButtonDisabled
                    })
                ),
            
                React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
                    React.createElement('div', null,
                        React.createElement('label', { htmlFor: 'postalCode', className: 'block text-sm font-medium text-gray-700' }, 'PSČ'),
                        React.createElement('input', {
                          type: 'text',
                          id: 'postalCode',
                          ref: postalCodeInputRef,
                          className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono',
                          value: formatPostalCode(postalCode),
                          onChange: handlePostalCodeChange,
                          maxLength: 6,
                          inputMode: 'numeric',
                          pattern: '[0-9 ]*', 
                          disabled: isButtonDisabled
                        })
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { htmlFor: 'city', className: 'block text-sm font-medium text-gray-700' }, 'Mesto/obec'),
                        React.createElement('input', {
                            type: 'text',
                            id: 'city',
                            className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                            value: city,
                            onChange: (e) => setCity(e.target.value),
                            disabled: isButtonDisabled
                        })
                    )
                ),
            
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'country', className: 'block text-sm font-medium text-gray-700' }, 'Štát'),
                    React.createElement('input', {
                        type: 'text',
                        id: 'country',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: country,
                        onChange: (e) => setCountry(e.target.value),
                        disabled: isButtonDisabled
                    })
                )
            ),

                React.createElement(
                    'div',
                    { className: 'flex justify-end space-x-2 mt-6' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            disabled: isSubmitDisabled,
                            className: buttonClasses,
                            style: buttonStyles
                        },
                        isEditMode ? 'Uložiť zmeny' : 'Pridať člena'
                    )
                )
            )
        )
    );
}

function EditTeamModal({ show, onClose, teamData, onSaveTeam, onDeleteTeam, userProfileData, availablePackages, availableAccommodationTypes, availableTshirtSizes, isDataEditDeadlinePassed }) {
    const [editedTeamData, setEditedTeamData] = React.useState({
        jerseyHomeColor: '',
        jerseyAwayColor: ''
    });
    const [editedTeamName, setEditedTeamName] = useState(teamData ? teamData.teamName : '');
    const [editedCategoryName, setEditedCategoryName] = useState(teamData ? teamData.categoryName : '');
    const [editedArrivalType, setEditedArrivalType] = useState(teamData ? teamData.arrival?.type || 'bez dopravy' : 'bez dopravy');
    const [editedPackageName, setEditedPackageName] = useState(teamData ? teamData.packageDetails?.name || '' : '');
    const [editedAccommodationType, setEditedAccommodationType] = useState(teamData ? teamData.accommodation?.type || '' : '');
    const [editedArrivalHour, setEditedArrivalHour] = useState('');
    const [editedArrivalMinute, setEditedArrivalMinute] = useState('');
    const [tshirtEntries, setTshirtEntries] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [totalMembersCount, setTotalMembersCount] = useState(0);

    useEffect(() => {
      if (teamData) {
        setEditedTeamName(teamData.teamName || '');
        setEditedCategoryName(teamData.categoryName || '');
        setEditedArrivalType(teamData.arrival?.type || 'bez dopravy');
        setEditedPackageName(teamData.packageDetails?.name || '');
        setEditedAccommodationType(teamData.accommodation?.type || '');
        if (teamData.arrival?.time) {
          const [hour, minute] = teamData.arrival.time.split(':');
          setEditedArrivalHour(hour || '');
          setEditedArrivalMinute(minute || '');
        } else {
          setEditedArrivalHour('');
          setEditedArrivalMinute('');
        }
        setTshirtEntries(teamData.tshirts && Array.isArray(teamData.tshirts) ? teamData.tshirts.map(t => ({...t})) : []);
        setEditedTeamData({
          ...teamData,
          jerseyHomeColor: teamData.jerseyHomeColor || '',
          jerseyAwayColor: teamData.jerseyAwayColor || ''
        });
        
        // Výpočet celkového počtu členov v tíme
        const players = teamData.playerDetails?.length || 0;
        const menTeamMembers = teamData.menTeamMemberDetails?.length || 0;
        const womenTeamMembers = teamData.womenTeamMemberDetails?.length || 0;
        const driverFemale = teamData.driverDetailsFemale?.length || 0;
        const driverMale = teamData.driverDetailsMale?.length || 0;
        setTotalMembersCount(players + menTeamMembers + womenTeamMembers + driverFemale + driverMale);
        
        setHasChanges(false);
      }
    }, [teamData]);

    if (!show) return null;

    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';

    // Prepočet celkového počtu tričiek
    const totalTshirtsQuantity = useMemo(() => {
        return tshirtEntries.reduce((sum, entry) => sum + (parseInt(entry.quantity, 10) || 0), 0);
    }, [tshirtEntries]);

    // Kontrola, či je počet tričiek presne rovnaký ako počet členov
    const isTshirtCountMismatch = totalTshirtsQuantity !== totalMembersCount;

    // Kontrola, či sú vybrané všetky veľkosti
    const allTshirtSizesSelected = useMemo(() => {
        if (tshirtEntries.length === 0) return totalMembersCount === 0;
        return tshirtEntries.every(tshirt => tshirt.size !== '');
    }, [tshirtEntries, totalMembersCount]);

    const isSaveButtonDisabled = isDataEditDeadlinePassed || !hasChanges || isTshirtCountMismatch || !allTshirtSizesSelected;

    // Kontrola, či je možné pridať ďalšie tričko (celkový počet už nie je väčší ako počet členov)
    const isAddTshirtButtonDisabled = isDataEditDeadlinePassed || totalTshirtsQuantity >= totalMembersCount;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isDataEditDeadlinePassed) {
          showLocalNotification('Termín na úpravu údajov už vypršal.', 'error');
          return;
        }

        if (isTshirtCountMismatch) {
          showLocalNotification(`Počet tričiek (${totalTshirtsQuantity}) sa musí rovnať počtu členov v tíme (${totalMembersCount}).`, 'error');
          return;
        }

        let finalArrivalTime = '';
        if (editedArrivalType === 'verejná doprava - vlak' || editedArrivalType === 'verejná doprava - autobus') {
            finalArrivalTime = `${editedArrivalHour.padStart(2, '0')}:${editedArrivalMinute.padStart(2, '0')}`;
        }

        const filteredTshirtEntries = tshirtEntries.filter(t => t.size && t.quantity && parseInt(t.quantity, 10) > 0)
                                                    .map(t => ({ ...t, quantity: parseInt(t.quantity, 10) }));

        const updatedTeamData = {
            ...teamData,
            teamName: editedTeamName,
            categoryName: editedCategoryName,
            arrival: {
                ...teamData.arrival,
                type: editedArrivalType,
                time: finalArrivalTime
            },
            packageDetails: { ...teamData.packageDetails, name: editedPackageName },
            accommodation: { ...teamData.accommodation, type: editedAccommodationType },
            tshirts: filteredTshirtEntries,
            jerseyHomeColor: editedTeamData.jerseyHomeColor?.trim() || '',
            jerseyAwayColor: editedTeamData.jerseyAwayColor?.trim() || ''
        };
        await onSaveTeam(updatedTeamData);
        setHasChanges(false);
        onClose();
    };

    const handleArrivalTypeChange = (e) => {
      setEditedArrivalType(e.target.value);
      setHasChanges(true);
    };
    const handleAccommodationTypeChange = (e) => {
      setEditedAccommodationType(e.target.value);
      setHasChanges(true);
    };
    const handlePackageNameChange = (e) => {
      setEditedPackageName(e.target.value);
      setHasChanges(true);
    };

    const handleArrivalHourChange = (e) => {
      setEditedArrivalHour(e.target.value);
      setHasChanges(true);
    };

    const handleArrivalMinuteChange = (e) => {
      setEditedArrivalMinute(e.target.value);
      setHasChanges(true);
    };

    const showArrivalTimeInputs = editedArrivalType === 'verejná doprava - vlak' || editedArrivalType === 'verejná doprava - autobus';

    const handleAddTshirtEntry = () => {
        if (totalTshirtsQuantity < totalMembersCount) {
            setTshirtEntries([...tshirtEntries, { size: '', quantity: 1 }]);
            setHasChanges(true);
        }
    };

    const handleRemoveTshirtEntry = (index) => {
        const entryToRemove = tshirtEntries[index];
        const quantityToRemove = parseInt(entryToRemove.quantity, 10) || 0;
        const newTotal = totalTshirtsQuantity - quantityToRemove;
        
        // Ak by odstránenie spôsobilo, že počet tričiek by bol menší ako počet členov, nedovolí to
        if (newTotal < totalMembersCount) {
            showLocalNotification(`Nie je možné odstrániť tričká, pretože by ich bolo menej (${newTotal}) ako členov v tíme (${totalMembersCount}).`, 'error');
            return;
        }
        
        setTshirtEntries(tshirtEntries.filter((_, i) => i !== index));
        setHasChanges(true);
    };

    const handleTshirtSizeChange = (index, newSize) => {
        const updatedEntries = [...tshirtEntries];
        updatedEntries[index].size = newSize;
        setTshirtEntries(updatedEntries);
        setHasChanges(true);
    };

    const handleTshirtQuantityChange = (index, newQuantity) => {
        const oldQuantity = parseInt(tshirtEntries[index].quantity, 10) || 0;
        const newQuantityInt = Math.max(1, parseInt(newQuantity, 10) || 1);
        const otherEntriesTotal = totalTshirtsQuantity - oldQuantity;
        const newTotal = otherEntriesTotal + newQuantityInt;
        
        // Kontrola, či nový celkový počet nepresiahne počet členov
        if (newTotal > totalMembersCount) {
            showLocalNotification(`Celkový počet tričiek (${newTotal}) by presiahol počet členov v tíme (${totalMembersCount}). Maximálny povolený počet je ${totalMembersCount - otherEntriesTotal}.`, 'error');
            return;
        }
        
        const updatedEntries = [...tshirtEntries];
        updatedEntries[index].quantity = newQuantityInt;
        setTshirtEntries(updatedEntries);
        setHasChanges(true);
    };

    const saveButtonClasses = `px-4 py-2 rounded-md transition-colors ${
        isSaveButtonDisabled ? 'bg-white text-current border border-current' : 'text-white'
    }`;
    const saveButtonStyles = {
        backgroundColor: isSaveButtonDisabled ? 'white' : roleColor,
        color: isSaveButtonDisabled ? roleColor : 'white',
        borderColor: isSaveButtonDisabled ? roleColor : 'transparent',
        cursor: isSaveButtonDisabled ? 'not-allowed' : 'pointer'
    };

    const addTshirtButtonClasses = `flex items-center justify-center w-8 h-8 rounded-full transition-colors focus:outline-none focus:ring-2
        ${isAddTshirtButtonDisabled
            ? 'bg-white border border-solid cursor-not-allowed'
            : 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500'
        }`;
    const addTshirtButtonStyles = {
        cursor: isAddTshirtButtonDisabled ? 'not-allowed' : 'pointer',
        borderColor: isAddTshirtButtonDisabled ? roleColor : 'transparent',
        color: isAddTshirtButtonDisabled ? roleColor : 'white',
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex justify-center items-center p-4 z-[1001]' },
        React.createElement(
            'div',
            { className: 'relative p-6 bg-white w-full max-w-md mx-auto rounded-lg shadow-lg max-h-[85vh] overflow-y-auto overflow-x-hidden' },
            React.createElement(
                'div',
                { className: `flex flex-col text-white p-4 -mx-8 -mt-8 mb-4 rounded-t-lg`, style: { backgroundColor: roleColor } },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center w-full' },
                    React.createElement('h3', { className: 'text-2xl font-semibold' }, `Upraviť tím: ${teamData.teamName}`),
                    React.createElement(
                        'button',
                        {
                            onClick: onClose,
                            className: 'text-white hover:text-gray-200 text-3xl leading-none font-semibold'
                        },
                        '×'
                    )
                ),
                React.createElement('p', { className: 'text-md font-medium mt-1' }, `Kategória: ${editedCategoryName}`)
            ),
            React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'space-y-4' },

                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'arrivalType', className: 'block text-sm font-medium text-gray-700' }, 'Typ dopravy'),
                    React.createElement('select', {
                        id: 'arrivalType',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: editedArrivalType,
                        onChange: handleArrivalTypeChange,
                        required: true,
                        disabled: isDataEditDeadlinePassed
                    },
                    React.createElement('option', { value: 'bez dopravy' }, 'bez dopravy'),
                    React.createElement('option', { value: 'verejná doprava - autobus' }, 'verejná doprava - autobus'),
                    React.createElement('option', { value: 'verejná doprava - vlak' }, 'verejná doprava - vlak'),
                    React.createElement('option', { value: 'vlastná doprava' }, 'vlastná doprava')
                    )
                ),
                showArrivalTimeInputs && React.createElement(
                  'div',
                  null,
                  React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Plánovaný čas príchodu na turnaj'),
                  React.createElement(
                    'div',
                    { className: 'flex space-x-3 items-center' },
                    React.createElement(
                      'div',
                      { className: 'w-24' },
                      React.createElement('label', { htmlFor: 'arrivalHour', className: 'block text-xs text-gray-600 mb-1' }, 'Hodina'),
                      React.createElement('input', {
                        id: 'arrivalHour',
                        type: 'text',
                        maxLength: 2,
                        className: 'block w-full border border-gray-300 rounded-md shadow-sm p-2 text-center font-mono text-lg',
                        value: editedArrivalHour,
                        onChange: (e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                          setEditedArrivalHour(val);
                          setHasChanges(true);
                        },
                        onBlur: () => {
                          if (editedArrivalHour !== '') {
                            const num = parseInt(editedArrivalHour, 10);
                            if (!isNaN(num) && num >= 0 && num <= 23) {
                              setEditedArrivalHour(num.toString().padStart(2, '0'));
                            } else {
                              setEditedArrivalHour('');
                            }
                          }
                        },
                        pattern: '[0-9]*',
                        inputMode: 'numeric',
                        disabled: isDataEditDeadlinePassed,
                      })
                    ),
                    React.createElement('span', { className: 'text-gray-500 text-xl mt-6' }, ':'),
                    React.createElement(
                      'div',
                      { className: 'w-24' },
                      React.createElement('label', { htmlFor: 'arrivalMinute', className: 'block text-xs text-gray-600 mb-1' }, 'Minúta'),
                      React.createElement('input', {
                        id: 'arrivalMinute',
                        type: 'text',
                        maxLength: 2,
                        className: 'block w-full border border-gray-300 rounded-md shadow-sm p-2 text-center font-mono text-lg',
                        value: editedArrivalMinute,
                        onChange: (e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                          setEditedArrivalMinute(val);
                          setHasChanges(true);
                        },
                        onBlur: () => {
                          if (editedArrivalMinute !== '') {
                            const num = parseInt(editedArrivalMinute, 10);
                            if (!isNaN(num) && num >= 0 && num <= 59) {
                              setEditedArrivalMinute(num.toString().padStart(2, '0'));
                            } else {
                              setEditedArrivalMinute('');
                            }
                          }
                        },
                        pattern: '[0-9]*',
                        inputMode: 'numeric',
                        disabled: isDataEditDeadlinePassed,
                      })
                    )
                  )
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'accommodationType', className: 'block text-sm font-medium text-gray-700' }, 'Typ ubytovania'),
                    React.createElement('select', {
                        id: 'accommodationType',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: editedAccommodationType,
                        onChange: handleAccommodationTypeChange,
                        required: true,
                        disabled: isDataEditDeadlinePassed
                    },
                    React.createElement('option', { value: 'bez ubytovania' }, 'bez ubytovania'),
                    availableAccommodationTypes
                        .slice()
                        .sort((a, b) => a.type.localeCompare(b.type))
                        .map((acc, idx) =>
                            React.createElement('option', { key: idx, value: acc.type }, acc.type)
                        )
                    )
                ),

                React.createElement(
                  'div',
                  { className: 'mb-6 border-t border-gray-200 pt-4' },
                  React.createElement('label', {
                    className: 'block text-base text-gray-800 mb-3'
                  }, 'Farby dresov'),
                  React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 sm:grid-cols-2 gap-6' },
                
                    React.createElement(
                      'div',
                      null,
                      React.createElement('label', { className: 'block text-sm text-gray-700 mb-1' }, 'Farba dresov 1'),
                      React.createElement('input', {
                        type: 'text',
                        className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
                        value: editedTeamData.jerseyHomeColor || '',
                        onChange: (e) => {
                          setEditedTeamData(prev => ({
                            ...prev,
                            jerseyHomeColor: e.target.value
                          }));
                          setHasChanges(true);
                        },
                        placeholder: 'napr. červená',
                        disabled: isDataEditDeadlinePassed
                      })
                    ),

                    React.createElement(
                      'div',
                      null,
                      React.createElement('label', { className: 'block text-sm text-gray-700 mb-1' }, 'Farba dresov 2'),
                      React.createElement('input', {
                        type: 'text',
                        className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
                        value: editedTeamData.jerseyAwayColor || '',
                        onChange: (e) => {
                        setEditedTeamData(prev => ({
                            ...prev,
                            jerseyAwayColor: e.target.value
                          }));
                          setHasChanges(true);
                        },
                        placeholder: 'napr. modrá',
                        disabled: isDataEditDeadlinePassed
                      })
                    )
                  ),
                  React.createElement('p', {
                    className: 'mt-2 text-sm text-gray-500'
                  }, 'Zadajte farbu')
                ),
                
                React.createElement(
                  'div',
                  null,
                  React.createElement('label', { htmlFor: 'packageName', className: 'block text-sm font-medium text-gray-700' }, 'Balík'),
                  React.createElement('select', {
                    id: 'packageName',
                    className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                    value: editedPackageName,
                    onChange: handlePackageNameChange,
                    required: true,
                    disabled: isDataEditDeadlinePassed
                  },
                  (() => {
                    const allPackages = availablePackages || [];
                    
                    const filteredPackages = allPackages.filter(pkg => {
                      if (!pkg.accommodationTypes || pkg.accommodationTypes.length === 0) {
                        return true;
                      }
                      
                      if (editedAccommodationType === 'bez ubytovania') {
                        return pkg.accommodationTypes.includes('bez ubytovania');
                      }
                      
                      return pkg.accommodationTypes.includes(editedAccommodationType);
                    });
                    
                    return filteredPackages
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((pkg, idx) =>
                        React.createElement('option', { key: idx, value: pkg.name }, pkg.name)
                      );
                  })()
                  )
                ),

                React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'div',
                        { className: 'mb-2' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700' }, 'Tričká'),
                    ),
                    tshirtEntries.map((tshirt, index) => {
                        const selectedSizesExcludingCurrent = new Set(
                            tshirtEntries
                                .filter((_, i) => i !== index)
                                .map(entry => entry.size)
                                .filter(Boolean)
                        );

                        const filteredAvailableSizes = availableTshirtSizes
                            .filter(size => !selectedSizesExcludingCurrent.has(size) || size === tshirt.size)
                            .slice()
                            .sort();

                        return React.createElement(
                            'div',
                            { key: index, className: 'flex items-center space-x-2 mb-2' },
                            React.createElement('select', {
                                className: 'mt-1 block w-1/2 border border-gray-300 rounded-md shadow-sm p-2',
                                value: tshirt.size,
                                onChange: (e) => handleTshirtSizeChange(index, e.target.value),
                                required: true,
                                disabled: isDataEditDeadlinePassed
                            },
                            React.createElement('option', { value: '' }, 'Vyberte veľkosť'),
                            filteredAvailableSizes.map((size, sIdx) =>
                                React.createElement('option', { key: sIdx, value: size }, size)
                            )
                            ),
                            React.createElement('input', {
                                type: 'number',
                                className: 'mt-1 block w-1/4 border border-gray-300 rounded-md shadow-sm p-2',
                                placeholder: 'Počet',
                                value: tshirt.quantity,
                                onChange: (e) => handleTshirtQuantityChange(index, e.target.value),
                                min: '1',
                                required: true,
                                disabled: isDataEditDeadlinePassed
                            }),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleRemoveTshirtEntry(index),
                                    className: 'flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500',
                                    disabled: isDataEditDeadlinePassed
                                },
                                React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' }, React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M20 12H4' }))
                            )
                        )
                    }),
                    React.createElement(
                        'div',
                        { className: 'flex justify-center mt-4' },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: handleAddTshirtEntry,
                                disabled: isAddTshirtButtonDisabled,
                                className: addTshirtButtonClasses,
                                style: addTshirtButtonStyles
                            },
                            React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' }, React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: `M12 6v6m0 0v6m0-6h6m-6 0H6` }))
                        )
                    )
                ),

                React.createElement(
                    'div',
                    { className: 'flex justify-between space-x-2 mt-6' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => onDeleteTeam(teamData),
                            className: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors',
                            disabled: isDataEditDeadlinePassed
                        },
                        'Vymazať'
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex space-x-2' },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: onClose,
                                className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors'
                            },
                            'Zrušiť'
                        ),
                        React.createElement(
                            'button',
                            {
                                type: 'submit',
                                disabled: isSaveButtonDisabled,
                                className: saveButtonClasses,
                                style: saveButtonStyles
                            },
                            'Uložiť zmeny'
                        )
                    )
                )
            )
        )
    );
}

function AddTeamModal({ show, onClose, onAddTeam, userProfileData, availablePackages, availableAccommodationTypes, availableTshirtSizes, teamsData, availableCategoriesFromSettings, isDataEditDeadlinePassed }) {
    const db = getFirestore();
    const [selectedCategory, setSelectedCategory] = useState('');
    const [teamNamePreview, setTeamNamePreview] = useState('');
    const [arrivalType, setArrivalType] = useState('bez dopravy');
    const [arrivalHour, setArrivalHour] = useState('');
    const [arrivalMinute, setArrivalMinute] = useState('');
    const [accommodationType, setAccommodationType] = useState('bez ubytovania');
    const [packageName, setPackageName] = useState(availablePackages.length > 0 ? availablePackages.sort()[0] : '');
    const [hasChanges, setHasChanges] = useState(false);

    const clubName = userProfileData?.billing?.clubName?.trim() || 'Neznámy klub';
    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';

    // Nový tím má vždy 0 členov, takže tričká by mali byť 0
    const totalMembersCount = 0;
    const totalTshirtsQuantity = 0; // Nový tím nemá žiadne tričká

    useEffect(() => {
        if (show) {
            setSelectedCategory('');
            setTeamNamePreview('');
            setArrivalType('bez dopravy');
            setArrivalHour('');
            setArrivalMinute('');
            setAccommodationType('bez ubytovania');
            setPackageName(availablePackages.length > 0 ? availablePackages.sort()[0] : '');
            setHasChanges(false);
        }
    }, [show, availablePackages]);

    useEffect(() => {
        if (selectedCategory && teamsData && clubName !== 'Neznámy klub') {
            const allTeamsInCategory = teamsData[selectedCategory] || [];
            const existingClubTeamsForCategory = allTeamsInCategory.filter(
                team => team.clubName?.trim() === clubName && team.categoryName === selectedCategory
            );

            let generatedName;
            if (existingClubTeamsForCategory.length === 0) {
                generatedName = clubName;
            } else {
                const numberOfTeamsAfterAddingNew = existingClubTeamsForCategory.length;
                generatedName = `${clubName} ${String.fromCharCode('A'.charCodeAt(0) + numberOfTeamsAfterAddingNew)}`;
            }
            setTeamNamePreview(generatedName);
        } else {
            setTeamNamePreview('');
        }
    }, [selectedCategory, clubName, teamsData]);

    // Nový tím má 0 členov, takže tričká musia byť 0
    const isSaveButtonDisabled = isDataEditDeadlinePassed || !hasChanges || !selectedCategory;

    const showArrivalTimeInputs = arrivalType === 'verejná doprava - vlak' || arrivalType === 'verejná doprava - autobus';

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isDataEditDeadlinePassed) {
          showLocalNotification('Termín na úpravu údajov už vypršal.', 'error');
          return;
        }

        if (isSaveButtonDisabled) {
            showLocalNotification('Prosím, vyplňte kategóriu.', 'error');
            return;
        }

        let finalArrivalTime = '';
        if (arrivalType === 'verejná doprava - vlak' || arrivalType === 'verejná doprava - autobus') {
            finalArrivalTime = `${arrivalHour.padStart(2, '0')}:${arrivalMinute.padStart(2, '0')}`;
        }

        // Nový tím má 0 členov, takže tričká sú prázdne pole
        const filteredTshirtEntries = [];

        let packageDetails = {};
        if (packageName) {
            try {
                const packagesRef = collection(db, 'settings', 'packages', 'list');
                const q = query(packagesRef, where('name', '==', packageName));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const packageDoc = querySnapshot.docs[0];
                    packageDetails = {
                        name: packageName,
                        meals: packageDoc.data().meals || {},
                        price: packageDoc.data().price || 0,
                        id: packageDoc.id
                    };
                }
            } catch (error) {
                showLocalNotification('Nastala chyba pri načítavaní detailov balíka.', 'error');
                return;
            }
        }

        const newTeamData = {
            teamName: teamNamePreview,
            categoryName: selectedCategory,
            clubName: clubName,
            players: 0,
            menTeamMembers: 0,
            womenTeamMembers: 0,
            playerDetails: [],
            menTeamMemberDetails: [],
            womenTeamMemberDetails: [],
            driverDetailsFemale: [],
            driverDetailsMale: [],
            arrival: { type: arrivalType, time: finalArrivalTime },
            accommodation: { type: accommodationType },
            packageDetails: packageDetails,
            tshirts: filteredTshirtEntries, // Prázdne pole pre nový tím
        };
        await onAddTeam(newTeamData);
        setHasChanges(false);
        onClose();
    };

    if (!show) return null;

    const buttonClasses = `px-4 py-2 rounded-md transition-colors ${
        isSaveButtonDisabled ? 'bg-white text-current border border-current' : 'text-white'
    }`;
    const buttonStyles = {
        backgroundColor: isSaveButtonDisabled ? 'white' : roleColor,
        color: isSaveButtonDisabled ? roleColor : 'white',
        borderColor: isSaveButtonDisabled ? roleColor : 'transparent',
        cursor: isSaveButtonDisabled ? 'not-allowed' : 'pointer'
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex justify-center items-center p-4 z-[1001]' },
        React.createElement(
            'div',
            { className: 'relative p-6 bg-white w-full max-w-md mx-auto rounded-lg shadow-lg max-h-[85vh] overflow-y-auto overflow-x-hidden' },
            React.createElement(
                'div',
                { className: `flex justify-between items-center text-white p-4 -mx-8 -mt-8 mb-4 rounded-t-lg`, style: { backgroundColor: roleColor } },
                React.createElement('h3', { className: 'text-2xl font-semibold' }, 'Pridať nový tím'),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-white hover:text-gray-200 text-3xl leading-none font-semibold' },
                    '×'
                )
            ),
            React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'space-y-4' },
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'categoryName', className: 'block text-sm font-medium text-gray-700' }, 'Kategória'),
                    React.createElement('select', {
                        id: 'categoryName',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: selectedCategory,
                        onChange: (e) => {
                            setSelectedCategory(e.target.value);
                            setHasChanges(true);
                        },
                        required: true,
                        disabled: isDataEditDeadlinePassed
                    },
                    React.createElement('option', { value: '' }, 'Vyberte kategóriu'),
                    availableCategoriesFromSettings.sort().map((cat, idx) => (
                        React.createElement('option', { key: idx, value: cat }, cat)
                    ))
                    )
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700' }, 'Názov tímu (automaticky generovaný)'),
                    React.createElement('input', {
                        type: 'text',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100 cursor-not-allowed',
                        value: teamNamePreview,
                        readOnly: true,
                        disabled: true
                    })
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'arrivalType', className: 'block text-sm font-medium text-gray-700' }, 'Typ dopravy'),
                    React.createElement('select', {
                        id: 'arrivalType',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: arrivalType,
                        onChange: (e) => {
                            setArrivalType(e.target.value);
                            setHasChanges(true);
                        },
                        required: true,
                        disabled: isDataEditDeadlinePassed
                    },
                    React.createElement('option', { value: 'bez dopravy' }, 'bez dopravy'),
                    React.createElement('option', { value: 'verejná doprava - autobus' }, 'verejná doprava - autobus'),
                    React.createElement('option', { value: 'verejná doprava - vlak' }, 'verejná doprava - vlak'),
                    React.createElement('option', { value: 'vlastná doprava' }, 'vlastná doprava')
                    )
                ),
                showArrivalTimeInputs && React.createElement(
                  'div',
                  null,
                  React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Plánovaný čas príchodu na turnaj'),
                  React.createElement(
                    'div',
                    { className: 'flex space-x-3 items-center' },
                    React.createElement(
                      'div',
                      { className: 'w-24' },
                      React.createElement('label', { htmlFor: 'arrivalHourAdd', className: 'block text-xs text-gray-600 mb-1' }, 'Hodina'),
                      React.createElement('input', {
                        id: 'arrivalHourAdd',
                        type: 'text',
                        maxLength: 2,
                        className: 'block w-full border border-gray-300 rounded-md shadow-sm p-2 text-center font-mono text-lg',
                        value: arrivalHour,
                        onChange: (e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                          setArrivalHour(val);
                          setHasChanges(true);
                        },
                        onBlur: () => {
                          if (arrivalHour !== '') {
                            const num = parseInt(arrivalHour, 10);
                            if (!isNaN(num) && num >= 0 && num <= 23) {
                              setArrivalHour(num.toString().padStart(2, '0'));
                            } else {
                              setArrivalHour('');
                            }
                          }
                        },
                        pattern: '[0-9]*',
                        inputMode: 'numeric',
                        disabled: isDataEditDeadlinePassed,
                      })
                    ),
                    React.createElement('span', { className: 'text-gray-500 text-xl mt-6' }, ':'),
                    React.createElement(
                      'div',
                      { className: 'w-24' },
                      React.createElement('label', { htmlFor: 'arrivalMinuteAdd', className: 'block text-xs text-gray-600 mb-1' }, 'Minúta'),
                      React.createElement('input', {
                        id: 'arrivalMinuteAdd',
                        type: 'text',
                        maxLength: 2,
                        className: 'block w-full border border-gray-300 rounded-md shadow-sm p-2 text-center font-mono text-lg',
                        value: arrivalMinute,
                        onChange: (e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                          setArrivalMinute(val);
                          setHasChanges(true);
                        },
                        onBlur: () => {
                          if (arrivalMinute !== '') {
                            const num = parseInt(arrivalMinute, 10);
                            if (!isNaN(num) && num >= 0 && num <= 59) {
                              setArrivalMinute(num.toString().padStart(2, '0'));
                            } else {
                              setArrivalMinute('');
                            }
                          }
                        },
                        pattern: '[0-9]*',
                        inputMode: 'numeric',
                        disabled: isDataEditDeadlinePassed,
                      })
                    )
                  )
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'accommodationType', className: 'block text-sm font-medium text-gray-700' }, 'Typ ubytovania'),
                    React.createElement('select', {
                        id: 'accommodationType',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: accommodationType,
                        onChange: (e) => {
                            setAccommodationType(e.target.value);
                            setHasChanges(true);
                        },
                        required: true,
                        disabled: isDataEditDeadlinePassed
                    },
                    React.createElement('option', { value: 'bez ubytovania' }, 'bez ubytovania'),
                    availableAccommodationTypes
                        .slice()
                        .sort((a, b) => a.type.localeCompare(b.type))
                        .map((acc, idx) =>
                            React.createElement('option', { key: idx, value: acc.type }, acc.type)
                        )
                    )
                ),
                React.createElement(
                  'div',
                  null,
                  React.createElement('label', { htmlFor: 'packageName', className: 'block text-sm font-medium text-gray-700' }, 'Balík'),
                  React.createElement('select', {
                    id: 'packageName',
                    className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                    value: packageName,
                    onChange: (e) => {
                      setPackageName(e.target.value);
                      setHasChanges(true);
                    },
                    required: true,
                    disabled: isDataEditDeadlinePassed
                  },
                  (() => {
                    const allPackages = availablePackages || [];
                    
                    const filteredPackages = allPackages.filter(pkg => {
                      if (!pkg.accommodationTypes || pkg.accommodationTypes.length === 0) {
                        return true;
                      }
                      
                      if (accommodationType === 'bez ubytovania') {
                        return pkg.accommodationTypes.includes('bez ubytovania');
                      }
                      
                      return pkg.accommodationTypes.includes(accommodationType);
                    });
                    
                    return filteredPackages
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((pkg, idx) =>
                        React.createElement('option', { key: idx, value: pkg.name }, pkg.name)
                      );
                  })()
                  )
                ),

                React.createElement(
                    'div',
                    { className: 'flex justify-end space-x-2 mt-6' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            disabled: isSaveButtonDisabled,
                            className: buttonClasses,
                            style: buttonStyles
                        },
                        'Uložiť tím'
                    )
                )
            )
        )
    );
}

function RostersApp() {
  const auth = getAuth();
  const db = getFirestore();  
  const limitsByCategory = useRegistrationLimits();
  const [user, setUser] = useState(null);
  const [userProfileData, setUserProfileData] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [teamsData, setTeamsData] = useState({});
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [availablePackages, setAvailablePackages] = useState([]);
  const [availableAccommodationTypes, setAvailableAccommodationTypes] = useState([]);
  const [availableTshirtSizes, setAvailableTshirtSizes] = useState([]);
  const [showAddMemberTypeModal, setShowAddMemberTypeModal] = useState(false);
  const [showMemberDetailsModal, setShowMemberDetailsModal] = useState(false);
  const [memberTypeToAdd, setMemberTypeToAdd] = useState(null);
  const [teamToAddMemberTo, setTeamToAddMemberTo] = useState(null);
  const [teamAccommodationTypeToAddMemberTo, setTeamAccommodationTypeToAddMemberTo] = useState('');
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [availableCategoriesFromSettings, setAvailableCategoriesFromSettings] = useState([]);
  const [isMemberEditMode, setIsMemberEditMode] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState(null);
  const [teamOfMemberToEdit, setTeamOfMemberToEdit] = useState(null);
  const [rosterEditDeadline, setRosterEditDeadline] = useState(null);
  const [dataEditDeadline, setDataEditDeadline] = useState(null);
  const [isRosterEditDeadlinePassed, setIsRosterEditDeadlinePassed] = useState(false);
  const [isDataEditDeadlinePassed, setIsDataEditDeadlinePassed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoriesWithDates, setCategoriesWithDates] = useState({});

  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  useEffect(() => {
      const categoriesLimits = {};
  
      Object.entries(limitsByCategory).forEach(([categoryName, limits]) => {
        categoriesLimits[categoryName] = {
          maxPlayersPerTeam: limits.numberOfPlayers,
          maxImplementationMembers: limits.numberOfImplementationTeam
        };
      });
    
      const limitsInfo = {
          categoriesLimits,
          hasWindowRegistrationLimits: !!window.registrationLimits,
          registrationLimitsContent: window.registrationLimits 
              ? { ...window.registrationLimits } 
              : "nedefinované"
      };
  
  }, [limitsByCategory]);
    
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setIsAuthReady(true);
    });

    const handleGlobalDataUpdated = (event) => {
      setUserProfileData(event.detail);
      if (window.hideGlobalLoader) {
        window.hideGlobalLoader();
      }
    };
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    if (window.isGlobalAuthReady) {
        setIsAuthReady(true);
        setUser(auth.currentUser);
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            if (window.hideGlobalLoader) {
                window.hideGlobalLoader();
            }
        }
    }

    return () => {
      unsubscribeAuth();
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, []);

useEffect(() => {
    let unsubscribeSettings;
    let unsubscribeUserDeadlines;

    const safeToDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value.toDate === 'function') {
            return value.toDate();
        }
        if (typeof value === 'string') {
            const parsed = new Date(value);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        return null;
    };

    const fetchDeadlines = async () => {
        try {
            const settingsDocRef = doc(db, 'settings', 'registration');
            unsubscribeSettings = onSnapshot(settingsDocRef, (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    const settingsRosterDeadline = safeToDate(data.rosterEditDeadline);
                    const settingsDataDeadline = safeToDate(data.dataEditDeadline);

                    if (user && user.uid) {
                        const userDocRef = doc(db, 'users', user.uid);
                        unsubscribeUserDeadlines = onSnapshot(userDocRef, (userDocSnapshot) => {
                            let userRosterDeadline = null;
                            let userDataDeadline = null;

                            if (userDocSnapshot.exists()) {
                                const userData = userDocSnapshot.data();
                                userRosterDeadline = safeToDate(userData.rosterEditDeadline);
                                userDataDeadline = safeToDate(userData.dataEditDeadline);
                            }

                            const finalRosterDeadline = 
                                [settingsRosterDeadline, userRosterDeadline]
                                    .filter(Boolean)
                                    .sort((a, b) => b.getTime() - a.getTime())[0] || null;

                            const finalDataDeadline = 
                                [settingsDataDeadline, userDataDeadline]
                                    .filter(Boolean)
                                    .sort((a, b) => b.getTime() - a.getTime())[0] || null;

                            setRosterEditDeadline(finalRosterDeadline);
                            setDataEditDeadline(finalDataDeadline);
                        });
                    } else {
                        setRosterEditDeadline(settingsRosterDeadline);
                        setDataEditDeadline(settingsDataDeadline);
                    }
                } else {
                    setRosterEditDeadline(null);
                    setDataEditDeadline(null);
                }
            });
        } catch (e) {
            setRosterEditDeadline(null);
            setDataEditDeadline(null);
        }
    };

    if (db && isAuthReady) {
        fetchDeadlines();
    }

    return () => {
        if (unsubscribeSettings) unsubscribeSettings();
        if (unsubscribeUserDeadlines) unsubscribeUserDeadlines();
    };
}, [db, user, isAuthReady]);

useEffect(() => {
    const now = new Date();
    setIsRosterEditDeadlinePassed(rosterEditDeadline ? now > rosterEditDeadline : false);
    setIsDataEditDeadlinePassed(dataEditDeadline ? now > dataEditDeadline : false);

    const intervalId = setInterval(() => {
        const currentCheckTime = new Date();
        setIsRosterEditDeadlinePassed(rosterEditDeadline ? currentCheckTime > rosterEditDeadline : false);
        setIsDataEditDeadlinePassed(dataEditDeadline ? currentCheckTime > dataEditDeadline : false);
    }, 1000);

    return () => clearInterval(intervalId);
}, [rosterEditDeadline, dataEditDeadline]);

useEffect(() => {
  let unsubscribePackages;
  if (db) {
    try {
      const packagesRef = collection(db, 'settings', 'packages', 'list');
      unsubscribePackages = onSnapshot(packagesRef, (snapshot) => {
        const packagesList = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.name) {
            packagesList.push({
              name: data.name,
              accommodationTypes: data.accommodationTypes || [],
              price: data.price || 0,
              meals: data.meals || {},
              id: doc.id
            });
          }
        });
        setAvailablePackages(packagesList);
      }, (error) => {
      });
    } catch (e) {
    }
  }
  return () => {
    if (unsubscribePackages) {
      unsubscribePackages();
    }
  };
}, [db]);

useEffect(() => {
    let unsubscribeAccommodation;
    if (db) {
        try {
            const accommodationDocRef = doc(db, 'settings', 'accommodation');
            unsubscribeAccommodation = onSnapshot(accommodationDocRef, (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    const accommodationObjects = data.types || [];
                    setAvailableAccommodationTypes(accommodationObjects);
                } else {
                    setAvailableAccommodationTypes([]);
                }
            }, (error) => {
            });
        } catch (e) {
        }
    }
    return () => {
        if (unsubscribeAccommodation) {
            unsubscribeAccommodation();
        }
    };
}, [db]);

  useEffect(() => {
    let unsubscribeTshirtSizes;
    if (db) {
        try {
            const tshirtSizesDocRef = doc(db, 'settings', 'sizeTshirts');
            unsubscribeTshirtSizes = onSnapshot(tshirtSizesDocRef, (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    const sizes = data.sizes || [];
                    setAvailableTshirtSizes(sizes);
                } else {
                    setAvailableTshirtSizes([]);
                }
            }, (error) => {
            });
        } catch (e) {
        }
    }
    return () => {
        if (unsubscribeTshirtSizes) {
            unsubscribeTshirtSizes();
        }
    };
  }, [db]);

  useEffect(() => {
    let unsubscribeCategories;
    if (db) {
        try {
            const categoriesDocRef = doc(db, 'settings', 'categories');
                unsubscribeCategories = onSnapshot(categoriesDocRef, (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        const categoriesList = [];
                        const categoriesWithDates = {};
                        for (const fieldName in data) {
                            if (Object.prototype.hasOwnProperty.call(data, fieldName)) {
                                const categoryObject = data[fieldName];
                                if (categoryObject && typeof categoryObject === 'object' && categoryObject.name) {
                                    categoriesList.push(categoryObject.name);
                                    categoriesWithDates[categoryObject.name] = {
                                        dateFrom: categoryObject.dateFrom,
                                        dateTo: categoryObject.dateTo,
                                    };
                                }
                            }
                        }
                        setAvailableCategoriesFromSettings(categoriesList);
                        setCategoriesWithDates(categoriesWithDates);
                        window.categoriesWithDates = categoriesWithDates;
                    } else {
                        setAvailableCategoriesFromSettings([]);
                        setCategoriesWithDates({});
                        window.categoriesWithDates = {};
                    }
                }, (error) => {
                });
            } catch (e) {
            }
        }
        return () => {
            if (unsubscribeCategories) {
                unsubscribeCategories();
            }
        };
    }, [db]);

    useEffect(() => {
        let unsubscribeUserDoc;
        let unsubscribeUserPrivate;

        if (user && db && isAuthReady) {
            setLoading(true);
    
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userPrivateDocRef = doc(db, 'usersprivate', user.uid);
    
                unsubscribeUserPrivate = onSnapshot(userPrivateDocRef, (privateDocSnapshot) => {
                    let privateData = {};
                    if (privateDocSnapshot.exists()) {
                        privateData = privateDocSnapshot.data();
                    }
    
                    unsubscribeUserDoc = onSnapshot(userDocRef, (docSnapshot) => {
                        if (docSnapshot.exists()) {
                            const userData = docSnapshot.data();
                            
                            const userDataWithPrivate = {
                                ...userData,
                                _privateData: privateData
                            };
    
                            setUserProfileData(userDataWithPrivate);
    
                            if (userData.role !== 'club') {
                                window.location.href = 'logged-in-my-data.html';
                                return;
                            }
    
                            if (userData.teams) {
                                const normalizedTeams = {};
                                const currentClubName = userData.billing?.clubName?.trim() || 'Neznámy klub';
    
                                for (const categoryKey in userData.teams) {
                                    if (Object.prototype.hasOwnProperty.call(userData.teams, categoryKey)) {
                                        normalizedTeams[categoryKey] = userData.teams[categoryKey].map((team, teamIndex) => {
                                            const teamKey = `${categoryKey}_team${teamIndex + 1}`;
                                            const privateTeamData = privateData.persons?.[teamKey] || {};
    
                                            let mergedPlayerDetails = [];
                                            if (team.playerDetails) {
                                                mergedPlayerDetails = team.playerDetails.map((player, playerIndex) => {
                                                    const privatePlayer = privateTeamData.players?.[playerIndex] || {};
                                                    return {
                                                        ...player,
                                                        dateOfBirth: privatePlayer.dateOfBirth || player.dateOfBirth || '',
                                                        address: privatePlayer.address || player.address || {
                                                            street: '',
                                                            houseNumber: '',
                                                            city: '',
                                                            postalCode: '',
                                                            country: ''
                                                        }
                                                    };
                                                });
                                            }
    
                                            let mergedWomenTeamMembers = [];
                                            if (team.womenTeamMemberDetails) {
                                                mergedWomenTeamMembers = team.womenTeamMemberDetails.map((member, memberIndex) => {
                                                    const privateMember = privateTeamData.womenTeamMembers?.[memberIndex] || {};
                                                    return {
                                                        ...member,
                                                        dateOfBirth: privateMember.dateOfBirth || member.dateOfBirth || '',
                                                        address: privateMember.address || member.address || {
                                                            street: '',
                                                            houseNumber: '',
                                                            city: '',
                                                            postalCode: '',
                                                            country: ''
                                                        }
                                                    };
                                                });
                                            }
    
                                            let mergedMenTeamMembers = [];
                                            if (team.menTeamMemberDetails) {
                                                mergedMenTeamMembers = team.menTeamMemberDetails.map((member, memberIndex) => {
                                                    const privateMember = privateTeamData.menTeamMembers?.[memberIndex] || {};
                                                    return {
                                                        ...member,
                                                        dateOfBirth: privateMember.dateOfBirth || member.dateOfBirth || '',
                                                        address: privateMember.address || member.address || {
                                                            street: '',
                                                            houseNumber: '',
                                                            city: '',
                                                            postalCode: '',
                                                            country: ''
                                                        }
                                                    };
                                                });
                                            }
    
                                            // Zlúčenie šoférov - žien
                                            let mergedDriverDetailsFemale = [];
                                            if (team.driverDetailsFemale) {
                                                mergedDriverDetailsFemale = team.driverDetailsFemale.map((driver, driverIndex) => {
                                                    const privateDriver = privateTeamData.driversFemale?.[driverIndex] || {};
                                                    return {
                                                        ...driver,
                                                        dateOfBirth: privateDriver.dateOfBirth || driver.dateOfBirth || '',
                                                        address: privateDriver.address || driver.address || {
                                                            street: '',
                                                            houseNumber: '',
                                                            city: '',
                                                            postalCode: '',
                                                            country: ''
                                                        }
                                                    };
                                                });
                                            }
    
                                            let mergedDriverDetailsMale = [];
                                            if (team.driverDetailsMale) {
                                                mergedDriverDetailsMale = team.driverDetailsMale.map((driver, driverIndex) => {
                                                    const privateDriver = privateTeamData.driversMale?.[driverIndex] || {};
                                                    return {
                                                        ...driver,
                                                        dateOfBirth: privateDriver.dateOfBirth || driver.dateOfBirth || '',
                                                        address: privateDriver.address || driver.address || {
                                                            street: '',
                                                            houseNumber: '',
                                                            city: '',
                                                            postalCode: '',
                                                            country: ''
                                                        }
                                                    };
                                                });
                                            }
    
                                            return {
                                                ...team,
                                                clubName: team.clubName?.trim() || currentClubName,
                                                categoryName: team.categoryName || categoryKey,
                                                playerDetails: mergedPlayerDetails,
                                                womenTeamMemberDetails: mergedWomenTeamMembers,
                                                menTeamMemberDetails: mergedMenTeamMembers,
                                                driverDetailsFemale: mergedDriverDetailsFemale,
                                                driverDetailsMale: mergedDriverDetailsMale,
                                                _privateData: privateData,
                                                _teamKey: teamKey
                                            };
                                        });
                                    }
                                }
                                setTeamsData(normalizedTeams);
                            } else {
                                setTeamsData({});
                            }
                            setLoading(false);
                        } else {
                            setLoading(false);
                        }
                    }, error => {
                        setLoading(false);
                    });
                }, error => {
                    setLoading(false);
                });
    
            } catch (e) {
                setLoading(false);
            }
        } else if (isAuthReady && user === null) {
            setLoading(false);
            setUserProfileData(null);
            setTeamsData({});
        }
    
        return () => {
            if (unsubscribeUserDoc) {
                unsubscribeUserDoc();
            }
            if (unsubscribeUserPrivate) {
                unsubscribeUserPrivate();
            }
        };
    }, [user, db, isAuthReady, auth]);

  if (!isAuthReady || !userProfileData) {
    return null;
  }

  const getAllTeamMembers = (team) => {
      const members = [];
  
      if (team.playerDetails && team.playerDetails.length > 0) {
          team.playerDetails.forEach((player, index) => {
              members.push({
                  originalType: 'player',
                  type: 'Hráč',
                  _memberIndex: index,
                  _privateData: team._privateData,
                  _teamIndex: team._teamIndex,
                  ...player,
              });
          });
      }
  
      if (team.menTeamMemberDetails && team.menTeamMemberDetails.length > 0) {
          team.menTeamMemberDetails.forEach((member, index) => {
              members.push({
                  originalType: 'menTeamMember',
                  type: 'Člen realizačného tímu (muž)',
                  _memberIndex: index,
                  _privateData: team._privateData,
                  ...member,
              });
          });
      }
  
      if (team.womenTeamMemberDetails && team.womenTeamMemberDetails.length > 0) {
          team.womenTeamMemberDetails.forEach((member, index) => {
              members.push({
                  originalType: 'womenTeamMember',
                  type: 'Člen realizačného tímu (žena)',
                  _memberIndex: index,
                  _privateData: team._privateData,
                  ...member,
              });
          });
      }
  
      if (team.driverDetailsFemale && team.driverDetailsFemale.length > 0) {
          team.driverDetailsFemale.forEach((driver, index) => {
              members.push({
                  originalType: 'driverFemale',
                  type: 'Šofér (žena)',
                  _memberIndex: index,
                  _privateData: team._privateData,
                  ...driver,
              });
          });
      }
  
      if (team.driverDetailsMale && team.driverDetailsMale.length > 0) {
          team.driverDetailsMale.forEach((driver, index) => {
              members.push({
                  originalType: 'driverMale',
                  type: 'Šofér (muž)',
                  _memberIndex: index,
                  _privateData: team._privateData,
                  ...driver,
              });
          });
      }
  
      return members;
  };

  const getLimitsForTeam = (team) => {
    if (!team || !team.categoryName) {
        return { numberOfPlayers: 0, numberOfImplementationTeam: 0 };
    }
    const limits = limitsByCategory[team.categoryName];
    return limits || { numberOfPlayers: 0, numberOfImplementationTeam: 0 };
  };

  const teamCategories = Object.entries(teamsData).sort((a, b) => a[0].localeCompare(b[0]));

  const getTeamPluralization = (count) => {
    if (count === 1) {
      return 'tím';
    } else if (count >= 2 && count <= 4) {
      return 'tímy';
    } else {
      return 'tímov';
    }
  };

  const handleOpenEditTeamModal = (team) => {
    setSelectedTeam({ ...team, categoryName: team.categoryName });
    setShowEditTeamModal(true);
  };

const handleSaveTeam = async (updatedTeamData) => {
    if (isDataEditDeadlinePassed) {
        showLocalNotification('Termín pre úpravu dát tímu už uplynul.', 'error');
        return;
    }
    if (!user || !user.uid) {
        showLocalNotification('Chyba: Používateľ nie je prihlásený.', 'error');
        return;
    }

    const userEmail = user.email;
    const originalTeam = selectedTeam;
    const teamName = updatedTeamData.teamName || selectedTeam?.teamName || 'bez názvu';
    const category = updatedTeamData.categoryName || selectedTeam?.categoryName || '?';

    const originalPackageName = selectedTeam?.packageDetails?.name || '';
    const newPackageName = updatedTeamData.packageDetails.name;

    if (newPackageName !== originalPackageName) {
        try {
            const packagesRef = collection(db, 'settings', 'packages', 'list');
            const q = query(packagesRef, where('name', '==', newPackageName));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const pkg = snap.docs[0].data();
                updatedTeamData.packageDetails.meals = pkg.meals || {};
                updatedTeamData.packageDetails.price = pkg.price || 0;
                updatedTeamData.packageDetails.id = snap.docs[0].id;
            } else {
                updatedTeamData.packageDetails.meals = {};
                updatedTeamData.packageDetails.price = 0;
                updatedTeamData.packageDetails.id = null;
            }
        } catch (err) {
            showLocalNotification('Chyba pri načítaní detailov balíka.', 'error');
            return;
        }
    }

    const teamCategory = selectedTeam.categoryName;
    const originalTeamName = selectedTeam.teamName;

    const teamIndex = teamsData[teamCategory]?.findIndex(t => t.teamName === originalTeamName);
    
    if (teamIndex == null) {
        showLocalNotification('Chyba: Pôvodný tím nebol nájdený.', 'error');
        return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const currentTeams = { ...teamsData };
    currentTeams[teamCategory][teamIndex] = updatedTeamData;

    try {
        await updateDoc(userDocRef, { teams: currentTeams });

        const changes = getChangesForNotification(originalTeam, updatedTeamData, formatDateToDMMYYYY);
        if (changes.length > 0 && userEmail) {
            const prefixed = changes.map(ch => `Tím "${teamName}" (${category}): ${ch}`);
            await addDoc(collection(db, 'notifications'), {
                userEmail,
                changes: prefixed,
                timestamp: serverTimestamp()
            });
        }

        showLocalNotification('Údaje tímu boli aktualizované!', 'success');
    } catch (error) {
        showLocalNotification('Nastala chyba pri aktualizácii údajov tímu.', 'error');
    }
};

const handleDeleteTeam = async (teamToDelete) => {
    if (isDataEditDeadlinePassed) {
        showLocalNotification('Termín pre úpravu dát tímu už uplynul, tím nie je možné vymazať.', 'error');
        return;
    }
    if (!user || !user.uid || !userProfileData?.billing?.clubName) {
        showLocalNotification('Chyba: Používateľ nie je prihlásený alebo chýba názov klubu.', 'error');
        return;
    }

    // ✅ SPRÁVNY CONFIRM DIALOG PRE TÍM
    const confirmDelete = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 z-[1002] flex justify-center items-center p-4';
        modal.innerHTML = `
            <div class="relative p-8 bg-white w-full max-w-sm mx-auto rounded-lg shadow-lg">
                <h3 class="text-xl font-semibold mb-4 text-gray-800">Potvrdiť vymazanie tímu</h3>
                <p class="mb-6 text-gray-700">
                    Naozaj chcete vymazať tím 
                    <strong>${teamToDelete.teamName}</strong> 
                    (${teamToDelete.categoryName || 'Neznáma kategória'})?
                    <br><br>
                    <span class="text-red-600 font-semibold">Táto akcia je nevratná.</span>
                </p>
                <div class="flex justify-end space-x-3">
                    <button id="cancel" class="px-5 py-2.5 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition">
                        Zrušiť
                    </button>
                    <button id="confirm" class="px-5 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition">
                        Áno, vymazať
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#cancel').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
        modal.querySelector('#confirm').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };
    });

    if (!confirmDelete) return;

    const userEmail = user.email;
    const teamName = teamToDelete.teamName;
    const category = teamToDelete.categoryName;

    const userDocRef = doc(db, 'users', user.uid);
    const currentTeamsCopy = JSON.parse(JSON.stringify(teamsData));
    const cat = teamToDelete.categoryName;
    const club = userProfileData.billing.clubName?.trim();

    if (!currentTeamsCopy[cat]) {
        showLocalNotification('Chyba: Kategória tímu nebola nájdená.', 'error');
        return;
    }

    let teamsInCat = currentTeamsCopy[cat].filter(t => t.teamName !== teamToDelete.teamName);
    let clubTeams = teamsInCat.filter(t => t.clubName?.trim() === club && t.categoryName === cat);
    let others = teamsInCat.filter(t => !(t.clubName?.trim() === club && t.categoryName === cat));

    clubTeams.sort((a, b) => {
        const getS = n => {
            const m = n.match(new RegExp(`^${club.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*([A-Z])$`));
            return m ? m[1] : '';
        };
        const sa = getS(a.teamName), sb = getS(b.teamName);
        if (sa === '' && sb !== '') return -1;
        if (sa !== '' && sb === '') return 1;
        return sa.localeCompare(sb);
    });

    if (clubTeams.length === 0) {
        delete currentTeamsCopy[cat];
    } else if (clubTeams.length === 1) {
        clubTeams[0].teamName = club;
    } else {
        clubTeams.forEach((t, i) => t.teamName = `${club} ${String.fromCharCode(65 + i)}`);
    }

    if (currentTeamsCopy[cat]) {
        currentTeamsCopy[cat] = [...others, ...clubTeams];
    }

    try {
        await updateDoc(userDocRef, { teams: currentTeamsCopy });

        // Notifikácia o vymazaní tímu
        if (userEmail) {
            const changes = [
                `Tím "${teamName}" (${category}) bol vymazaný`,
            ];
            const notificationsRef = collection(db, 'notifications');
            await addDoc(notificationsRef, {
                userEmail,
                changes,
                timestamp: serverTimestamp()
            });
        }

        showLocalNotification('Tím bol vymazaný!', 'success');
        setShowEditTeamModal(false);
        setSelectedTeam(null);
    } catch (error) {
        console.error('Chyba pri mazaní tímu:', error);
        showLocalNotification('Nastala chyba pri mazaní tímu.', 'error');
    }
};

const handleAddTeam = async (newTeamDataFromModal) => {
    if (isDataEditDeadlinePassed) {
        showLocalNotification('Termín pre pridanie nového tímu už uplynul.', 'error');
        return;
    }
    if (!user || !user.uid) {
        showLocalNotification('Chyba: Používateľ nie je prihlásený.', 'error');
        return;
    }

    const userEmail = user.email;
    const teamName = newTeamDataFromModal.teamName || 'bez názvu';
    const category = newTeamDataFromModal.categoryName;

    const userDocRef = doc(db, 'users', user.uid);
    const currentTeamsCopy = JSON.parse(JSON.stringify(teamsData));
    const categoryKey = newTeamDataFromModal.categoryName;
    const clubName = newTeamDataFromModal.clubName;

    if (!currentTeamsCopy[categoryKey]) {
        currentTeamsCopy[categoryKey] = [];
    }

    let existingClubTeams = currentTeamsCopy[categoryKey].filter(
        t => t.clubName?.trim() === clubName && t.categoryName === categoryKey
    );

    const allRelevant = [
        ...existingClubTeams.map(t => ({ ...t, originalNameForSort: t.teamName })),
        { ...newTeamDataFromModal, originalNameForSort: newTeamDataFromModal.teamName }
    ];

    allRelevant.sort((a, b) => {
        const getSuffix = name => {
            const m = name.match(new RegExp(`^${clubName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*([A-Z])$`));
            return m ? m[1] : '';
        };
        const sa = getSuffix(a.originalNameForSort);
        const sb = getSuffix(b.originalNameForSort);
        if (sa === '' && sb !== '') return -1;
        if (sa !== '' && sb === '') return 1;
        return sa.localeCompare(sb);
    });

    if (allRelevant.length === 1) {
        allRelevant[0].teamName = clubName;
    } else {
        allRelevant.forEach((t, i) => {
            t.teamName = `${clubName} ${String.fromCharCode('A'.charCodeAt(0) + i)}`;
        });
    }

    const otherTeams = currentTeamsCopy[categoryKey].filter(
        t => !(t.clubName?.trim() === clubName && t.categoryName === categoryKey)
    );

    currentTeamsCopy[categoryKey] = [...otherTeams, ...allRelevant];

    try {
        await updateDoc(userDocRef, { teams: currentTeamsCopy });

        if (userEmail) {
            const changes = [`Nový tím bol pridaný: '''${teamName} (${category})'`];

            const notificationsRef = collection(db, 'notifications');
            await addDoc(notificationsRef, {
                userEmail,
                changes,
                timestamp: serverTimestamp()
            });
        }
        showLocalNotification('Nový tím bol pridaný a názvy tímov aktualizované!', 'success');
    } catch (error) {
        showLocalNotification('Nastala chyba pri pridávaní tímu a aktualizácii názvov.', 'error');
    }
};

const handleOpenAddMemberTypeModal = (team) => {
    setTeamToAddMemberTo(team);
    setTeamAccommodationTypeToAddMemberTo(team.accommodation?.type || 'bez ubytovania');
    setIsMemberEditMode(false);
    setMemberToEdit(null);
    setShowAddMemberTypeModal(true);
  };

const handleOpenEditMemberDetailsModal = (team, member) => {
    setTeamOfMemberToEdit({
        ...team,
        categoryName: team.categoryName,
        _teamIndex: team._teamIndex,  
    });
    setMemberToEdit(member);
    setMemberTypeToAdd(member.originalType);
    setTeamAccommodationTypeToAddMemberTo(team.accommodation?.type || 'bez ubytovania');
    setIsMemberEditMode(true);
    setShowMemberDetailsModal(true);
};

const handleSelectMemberType = (type) => {
    setMemberTypeToAdd(type);
    setShowAddMemberTypeModal(false);
    setShowMemberDetailsModal(true);
};

const handleSaveNewMember = async (newMemberDetails) => {
    if (isDataEditDeadlinePassed) {
        showLocalNotification('Termín pre pridanie nového člena tímu už uplynul.', 'error');
        return;
    }
    if (!user || !user.uid || !teamToAddMemberTo) {
        showLocalNotification('Chyba: Používateľ nie je prihlásený alebo tím nie je vybraný.', 'error');
        return;
    }

    const userEmail = user.email;
    const memberName = `${newMemberDetails.firstName || ''} ${newMemberDetails.lastName || ''}`.trim() || 'bez mena';
    const teamName = teamToAddMemberTo.teamName || 'bez názvu';
    const category = teamToAddMemberTo.categoryName || '?';

    const limitsForThisTeam = getLimitsForTeam(teamToAddMemberTo);
    const maxPlayersPerTeam = limitsForThisTeam.numberOfPlayers;
    const maxImplementationMembers = limitsForThisTeam.numberOfImplementationTeam;

    let memberTypeLabel = '';
    switch (memberTypeToAdd) {
        case 'player':          memberTypeLabel = 'hráč'; break;
        case 'womenTeamMember': memberTypeLabel = 'člen realizačného tímu (žena)'; break;
        case 'menTeamMember':   memberTypeLabel = 'člen realizačného tímu (muž)'; break;
        case 'driverFemale':    memberTypeLabel = 'šoférka (žena)'; break;
        case 'driverMale':      memberTypeLabel = 'šofér (muž)'; break;
        default:                memberTypeLabel = 'člen tímu';
    }

    const userDocRef = doc(db, 'users', user.uid);
    const userPrivateDocRef = doc(db, 'usersprivate', user.uid);
    
    const currentTeams = { ...teamsData };
    const teamCategory = teamToAddMemberTo.categoryName;
    const teamIndex = currentTeams[teamCategory].findIndex(t => t.teamName === teamToAddMemberTo.teamName);

    if (teamIndex === -1) {
        showLocalNotification('Chyba: Tím nebol nájdený.', 'error');
        return;
    }

    const teamToUpdate = { ...currentTeams[teamCategory][teamIndex] };

    const memberForUsers = {
        firstName: newMemberDetails.firstName || '',
        lastName: newMemberDetails.lastName || '',
        jerseyNumber: newMemberDetails.jerseyNumber || null,
        registrationNumber: newMemberDetails.registrationNumber || null,
    };

    const memberForPrivate = {
        dateOfBirth: newMemberDetails.dateOfBirth || '',
        address: newMemberDetails.address || {
            street: '',
            houseNumber: '',
            city: '',
            postalCode: '',
            country: ''
        }
    };

    switch (memberTypeToAdd) {
        case 'player':
            if (!teamToUpdate.playerDetails) teamToUpdate.playerDetails = [];
            teamToUpdate.playerDetails.push(memberForUsers);
            teamToUpdate.players = (teamToUpdate.players || 0) + 1;
            break;
        case 'womenTeamMember':
            if (!teamToUpdate.womenTeamMemberDetails) teamToUpdate.womenTeamMemberDetails = [];
            teamToUpdate.womenTeamMemberDetails.push(memberForUsers);
            teamToUpdate.womenTeamMembers = teamToUpdate.womenTeamMemberDetails.length;
            break;
        case 'menTeamMember':
            if (!teamToUpdate.menTeamMemberDetails) teamToUpdate.menTeamMemberDetails = [];
            teamToUpdate.menTeamMemberDetails.push(memberForUsers);
            teamToUpdate.menTeamMembers = teamToUpdate.menTeamMemberDetails.length;
            break;
        case 'driverFemale':
            if (!teamToUpdate.driverDetailsFemale) teamToUpdate.driverDetailsFemale = [];
            teamToUpdate.driverDetailsFemale.push(memberForUsers);
            break;
        case 'driverMale':
            if (!teamToUpdate.driverDetailsMale) teamToUpdate.driverDetailsMale = [];
            teamToUpdate.driverDetailsMale.push(memberForUsers);
            break;
        default:
            showLocalNotification('Neznámy typ člena tímu.', 'error');
            return;
    }

    currentTeams[teamCategory][teamIndex] = teamToUpdate;

    try {
        await updateDoc(userDocRef, { teams: currentTeams });

        let privateData = {};
        try {
            const privateDocSnapshot = await getDoc(userPrivateDocRef);
            if (privateDocSnapshot.exists()) {
                privateData = privateDocSnapshot.data();
            }
        } catch (e) {
        }

        if (!privateData.persons) privateData.persons = {};
        const teamKey = `${teamCategory}_team${teamIndex + 1}`;
        if (!privateData.persons[teamKey]) privateData.persons[teamKey] = {};

        const memberArrayName = memberTypeToAdd === 'player' ? 'players' :
                               memberTypeToAdd === 'womenTeamMember' ? 'womenTeamMembers' :
                               memberTypeToAdd === 'menTeamMember' ? 'menTeamMembers' :
                               memberTypeToAdd === 'driverFemale' ? 'driversFemale' :
                               'driversMale';
        
        const memberIndex = teamToUpdate[memberTypeToAdd === 'player' ? 'playerDetails' :
                                         memberTypeToAdd === 'womenTeamMember' ? 'womenTeamMemberDetails' :
                                         memberTypeToAdd === 'menTeamMember' ? 'menTeamMemberDetails' :
                                         memberTypeToAdd === 'driverFemale' ? 'driverDetailsFemale' :
                                         'driverDetailsMale'].length - 1;

        if (!privateData.persons[teamKey][memberArrayName]) {
            privateData.persons[teamKey][memberArrayName] = [];
        }
        privateData.persons[teamKey][memberArrayName][memberIndex] = memberForPrivate;

        await setDoc(userPrivateDocRef, privateData, { merge: true });

        if (userEmail) {
            const changes = [
                `Pridaný nový ${memberTypeLabel}: ${memberName}`,
                `Tím: ${teamName} (${category})`
            ];
            if (newMemberDetails.dateOfBirth) {
                changes.push(`Dátum narodenia: ${formatDateToDMMYYYY(newMemberDetails.dateOfBirth)}`);
            }
            if (newMemberDetails.jerseyNumber && memberTypeToAdd === 'player') {
                changes.push(`Číslo dresu: ${newMemberDetails.jerseyNumber}`);
            }
            if (newMemberDetails.registrationNumber && memberTypeToAdd === 'player') {
                changes.push(`Registračné číslo: ${newMemberDetails.registrationNumber}`);
            }
            await addDoc(collection(db, 'notifications'), {
                userEmail,
                changes,
                timestamp: serverTimestamp()
            });
        }

        showLocalNotification('Nový člen tímu bol pridaný!', 'success');
        setTeamToAddMemberTo(null);
        setMemberTypeToAdd(null);
    } catch (error) {
        showLocalNotification('Nastala chyba pri pridávaní člena tímu.', 'error');
    }
};

const handleDeleteMember = async (team, member) => {
    if (isDataEditDeadlinePassed) {
        showLocalNotification('Termín na úpravu členov tímu uplynul.', 'error');
        return;
    }

    // Správny confirm dialog pre člena
    const confirmDelete = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 z-[1002] flex justify-center items-center p-4';
        modal.innerHTML = `
            <div class="relative p-8 bg-white w-full max-w-sm mx-auto rounded-lg shadow-lg">
                <h3 class="text-xl font-semibold mb-4 text-gray-800">Odstrániť člena tímu</h3>
                <p class="mb-6 text-gray-700">
                    Naozaj chcete odstrániť člena 
                    <strong>${member.firstName || ''} ${member.lastName || ''}</strong> 
                    (${member.type || 'člen'}) z tímu 
                    <strong>${team.teamName || 'Neznámy tím'}</strong>?
                </p>
                <div class="flex justify-end space-x-3">
                    <button id="cancel" class="px-5 py-2.5 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition">
                        Zrušiť
                    </button>
                    <button id="confirm" class="px-5 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition">
                        Áno, odstrániť
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#cancel').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
        modal.querySelector('#confirm').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };
    });

    if (!confirmDelete) return;

    const userEmail = user.email;
    const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'bez mena';
    const teamName = team.teamName || 'bez názvu';
    const category = team.categoryName || '?';
    const memberTypeLabel = member.type || 'člen';

    const userDocRef = doc(db, 'users', user.uid);
    const userPrivateDocRef = doc(db, 'usersprivate', user.uid);
    
    const currentTeams = { ...teamsData };
    const teamCategory = team.categoryName;
    const teamIndex = currentTeams[teamCategory].findIndex(t => t.teamName === team.teamName);

    if (teamIndex === -1) {
        showLocalNotification('Tím nebol nájdený.', 'error');
        return;
    }

    const teamToUpdate = { ...currentTeams[teamCategory][teamIndex] };
    let arrayName;

    switch (member.originalType) {
        case 'player': arrayName = 'playerDetails'; break;
        case 'womenTeamMember': arrayName = 'womenTeamMemberDetails'; break;
        case 'menTeamMember': arrayName = 'menTeamMemberDetails'; break;
        case 'driverFemale': arrayName = 'driverDetailsFemale'; break;
        case 'driverMale': arrayName = 'driverDetailsMale'; break;
        default:
            showLocalNotification('Neznámy typ člena.', 'error');
            return;
    }

    const memberArray = teamToUpdate[arrayName] || [];
    const memberIndex = memberArray.findIndex(m =>
        m.firstName === member.firstName &&
        m.lastName === member.lastName
    );

    if (memberIndex === -1) {
        showLocalNotification('Člen nebol nájdený.', 'error');
        return;
    }

    // Odstránime člena z poľa
    memberArray.splice(memberIndex, 1);

    // Aktualizujeme počty
    switch (member.originalType) {
        case 'player':
            teamToUpdate.players = Math.max(0, (teamToUpdate.players || 0) - 1);
            break;
        case 'womenTeamMember':
            teamToUpdate.womenTeamMembers = teamToUpdate.womenTeamMemberDetails?.length || 0;
            break;
        case 'menTeamMember':
            teamToUpdate.menTeamMembers = teamToUpdate.menTeamMemberDetails?.length || 0;
            break;
    }

    currentTeams[teamCategory][teamIndex] = teamToUpdate;

    try {
        // === 1. ULOŽÍME DO USERS ===
        await updateDoc(userDocRef, { teams: currentTeams });

        // === 2. ODSTRÁNIME Z USERSPRIVATE ===
        let privateData = {};
        try {
            const privateDocSnapshot = await getDoc(userPrivateDocRef);
            if (privateDocSnapshot.exists()) {
                privateData = privateDocSnapshot.data();
            }
        } catch (e) {
            // Dokument neexistuje
        }

        if (privateData.persons) {
            const teamKey = `${teamCategory}_team${teamIndex + 1}`;
            if (privateData.persons[teamKey]) {
                const privateArrayName = arrayName === 'playerDetails' ? 'players' :
                                        arrayName === 'womenTeamMemberDetails' ? 'womenTeamMembers' :
                                        arrayName === 'menTeamMemberDetails' ? 'menTeamMembers' :
                                        arrayName === 'driverDetailsFemale' ? 'driversFemale' :
                                        'driversMale';

                if (privateData.persons[teamKey][privateArrayName]) {
                    // Odstránime člena z pola
                    privateData.persons[teamKey][privateArrayName].splice(memberIndex, 1);
                    
                    // Ak je pole prázdne, odstránime ho
                    if (privateData.persons[teamKey][privateArrayName].length === 0) {
                        delete privateData.persons[teamKey][privateArrayName];
                    }
                }
                
                // Ak je tím prázdny, odstránime ho
                if (Object.keys(privateData.persons[teamKey]).length === 0) {
                    delete privateData.persons[teamKey];
                }
            }
        }

        await setDoc(userPrivateDocRef, privateData, { merge: true });

        // === 3. NOTIFIKÁCIA DO FIRESTORE ===
        if (userEmail) {
            const changes = [
                `Odstránený člen: ${memberName} (${memberTypeLabel})`,
                `Tím: ${teamName} (${category})`
            ];
            // Pridáme aj informáciu o dátume narodenia ak existuje
            if (member.dateOfBirth) {
                changes.push(`Dátum narodenia: ${formatDateToDMMYYYY(member.dateOfBirth)}`);
            }
            // Pridáme aj informáciu o čísle dresu ak existuje (pre hráčov)
            if (member.jerseyNumber) {
                changes.push(`Číslo dresu: ${member.jerseyNumber}`);
            }
            // Pridáme aj informáciu o registračnom čísle ak existuje (pre hráčov)
            if (member.registrationNumber) {
                changes.push(`Registračné číslo: ${member.registrationNumber}`);
            }
            
            const notificationsRef = collection(db, 'notifications');
            await addDoc(notificationsRef, {
                userEmail,
                changes,
                timestamp: serverTimestamp()
            });
            console.log('Notifikácia o odstránení člena uložená do Firestore.');
        }

        showLocalNotification('Člen bol odstránený.', 'success');
    } catch (error) {
        console.error('Chyba pri odstraňovaní člena:', error);
        showLocalNotification('Nepodarilo sa odstrániť člena.', 'error');
    }
};

const handleSaveEditedMember = async (updatedMemberDetails) => {
    if (isRosterEditDeadlinePassed) {
        showLocalNotification('Termín pre úpravu členov tímu už uplynul.', 'error');
        return;
    }
    if (!user || !user.uid || !teamOfMemberToEdit || !memberToEdit) {
        showLocalNotification('Chyba: Používateľ nie je prihlásený alebo chýbajú údaje pre úpravu člena.', 'error');
        return;
    }

    const userEmail = user.email;
    const originalMember = memberToEdit;
    const memberName = `${updatedMemberDetails.firstName || originalMember.firstName || ''} ${updatedMemberDetails.lastName || originalMember.lastName || ''}`.trim() || 'bez mena';
    const teamName = teamOfMemberToEdit.teamName || 'bez názvu';
    const category = teamOfMemberToEdit.categoryName || '?';

    const userDocRef = doc(db, 'users', user.uid);
    const userPrivateDocRef = doc(db, 'usersprivate', user.uid);
    
    const currentTeams = { ...teamsData };
    const teamCategory = teamOfMemberToEdit.categoryName;
    const teamNameFromPath = teamOfMemberToEdit.teamName;
    const teamIndex = currentTeams[teamCategory].findIndex(t => t.teamName === teamNameFromPath);

    if (teamIndex === -1) {
        showLocalNotification('Chyba: Tím nebol nájdený pre aktualizáciu člena.', 'error');
        return;
    }

    // Vytvoríme hlbokú kópiu tímu
    const teamToUpdate = JSON.parse(JSON.stringify(currentTeams[teamCategory][teamIndex]));
    let memberArrayName;
    switch (memberToEdit.originalType) {
        case 'player':          memberArrayName = 'playerDetails'; break;
        case 'womenTeamMember': memberArrayName = 'womenTeamMemberDetails'; break;
        case 'menTeamMember':   memberArrayName = 'menTeamMemberDetails'; break;
        case 'driverFemale':    memberArrayName = 'driverDetailsFemale'; break;
        case 'driverMale':      memberArrayName = 'driverDetailsMale'; break;
        default:
            showLocalNotification('Neznámy typ člena tímu pre aktualizáciu.', 'error');
            return;
    }

    const memberArray = teamToUpdate[memberArrayName];
    const memberIndex = memberArray.findIndex(
        m => m.firstName === memberToEdit.firstName &&
             m.lastName === memberToEdit.lastName
    );

    if (memberIndex === -1) {
        showLocalNotification('Chyba: Člen tímu nebol nájdený pre aktualizáciu.', 'error');
        return;
    }

    const originalMemberData = memberArray[memberIndex];
    
    // === PRIPRAVÍME DÁTA PRE USERS (LEN ZÁKLADNÉ ÚDAJE - BEZ ADRESY A DÁTUMU) ===
    const memberForUsers = {
        firstName: updatedMemberDetails.firstName !== undefined ? updatedMemberDetails.firstName : originalMemberData.firstName || '',
        lastName: updatedMemberDetails.lastName !== undefined ? updatedMemberDetails.lastName : originalMemberData.lastName || '',
        jerseyNumber: updatedMemberDetails.jerseyNumber !== undefined ? updatedMemberDetails.jerseyNumber : originalMemberData.jerseyNumber || null,
        registrationNumber: updatedMemberDetails.registrationNumber !== undefined ? updatedMemberDetails.registrationNumber : originalMemberData.registrationNumber || null,
    };
    
    // Zachováme aj ďalšie polia, ktoré môžu byť v origináli (okrem dateOfBirth a address)
    for (const key in originalMemberData) {
        if (!['firstName', 'lastName', 'jerseyNumber', 'registrationNumber', 'dateOfBirth', 'address', '_privateData'].includes(key)) {
            memberForUsers[key] = originalMemberData[key];
        }
    }

    // === PRIPRAVÍME DÁTA PRE USERSPRIVATE (S ADRESOU A DÁTUMOM) ===
    const memberForPrivate = {
        dateOfBirth: updatedMemberDetails.dateOfBirth !== undefined ? updatedMemberDetails.dateOfBirth : originalMemberData.dateOfBirth || '',
        address: updatedMemberDetails.address !== undefined ? updatedMemberDetails.address : originalMemberData.address || {
            street: '',
            houseNumber: '',
            city: '',
            postalCode: '',
            country: ''
        }
    };

    // Aktualizujeme člena v poli (BEZ ADRESY A DÁTUMU)
    memberArray[memberIndex] = memberForUsers;

    // 🔥 KRITICKÁ ČASŤ: VYČISTÍME CELÝ TÍM OD ADRIES A DÁTUMOV
    const cleanTeamMembers = (team) => {
        // Vytvoríme hlbokú kópiu tímu
        const cleanTeam = JSON.parse(JSON.stringify(team));
        
        // Vyčistíme všetky polia s členmi
        const cleanArray = (arr) => {
            if (!arr) return arr;
            return arr.map(item => {
                const clean = { ...item };
                delete clean.dateOfBirth;
                delete clean.address;
                delete clean._privateData;
                return clean;
            });
        };
        
        cleanTeam.playerDetails = cleanArray(cleanTeam.playerDetails);
        cleanTeam.womenTeamMemberDetails = cleanArray(cleanTeam.womenTeamMemberDetails);
        cleanTeam.menTeamMemberDetails = cleanArray(cleanTeam.menTeamMemberDetails);
        cleanTeam.driverDetailsFemale = cleanArray(cleanTeam.driverDetailsFemale);
        cleanTeam.driverDetailsMale = cleanArray(cleanTeam.driverDetailsMale);
        
        return cleanTeam;
    };

    // Vyčistíme celý tím
    const cleanedTeam = cleanTeamMembers(teamToUpdate);
    currentTeams[teamCategory][teamIndex] = cleanedTeam;

    try {
        // === 1. ULOŽÍME DO USERS (BEZ ADRIES A DÁTUMOV) - IBA RAZ ===
        await updateDoc(userDocRef, { teams: currentTeams });

        // === 2. ULOŽÍME DO USERSPRIVATE (S ADRESAMI A DÁTUMAMI) ===
        let privateData = {};
        try {
            const privateDocSnapshot = await getDoc(userPrivateDocRef);
            if (privateDocSnapshot.exists()) {
                privateData = privateDocSnapshot.data();
            }
        } catch (e) {
            // Dokument ešte neexistuje
        }

        if (!privateData.persons) privateData.persons = {};
        const teamKey = `${teamCategory}_team${teamIndex + 1}`;
        if (!privateData.persons[teamKey]) privateData.persons[teamKey] = {};

        const privateArrayName = memberArrayName === 'playerDetails' ? 'players' :
                                memberArrayName === 'womenTeamMemberDetails' ? 'womenTeamMembers' :
                                memberArrayName === 'menTeamMemberDetails' ? 'menTeamMembers' :
                                memberArrayName === 'driverDetailsFemale' ? 'driversFemale' :
                                'driversMale';

        if (!privateData.persons[teamKey][privateArrayName]) {
            privateData.persons[teamKey][privateArrayName] = [];
        }
        
        privateData.persons[teamKey][privateArrayName][memberIndex] = memberForPrivate;

        await setDoc(userPrivateDocRef, privateData, { merge: true });

        // === NOTIFIKÁCIA ===
        const changes = getChangesForNotification(
            { 
                firstName: originalMemberData.firstName, 
                lastName: originalMemberData.lastName,
                jerseyNumber: originalMemberData.jerseyNumber,
                registrationNumber: originalMemberData.registrationNumber,
                dateOfBirth: originalMemberData.dateOfBirth,
                address: originalMemberData.address 
            },
            { 
                firstName: memberForUsers.firstName,
                lastName: memberForUsers.lastName,
                jerseyNumber: memberForUsers.jerseyNumber,
                registrationNumber: memberForUsers.registrationNumber,
                dateOfBirth: memberForPrivate.dateOfBirth,
                address: memberForPrivate.address
            },
            formatDateToDMMYYYY
        );

        if (changes.length > 0 && userEmail) {
            const prefixedChanges = changes.map(ch =>
                `${memberName} – ${memberToEdit.type} – tím ${teamName} (${category}): ${ch}`
            );
            await addDoc(collection(db, 'notifications'), {
                userEmail,
                changes: prefixedChanges,
                timestamp: serverTimestamp()
            });
        }

        showLocalNotification('Údaje člena tímu boli aktualizované!', 'success');
        setMemberToEdit(null);
        setTeamOfMemberToEdit(null);
        setShowMemberDetailsModal(false);
    } catch (error) {
        console.error('Chyba pri aktualizácii člena tímu:', error);
        showLocalNotification('Nastala chyba pri aktualizácii údajov člena tímu.', 'error');
    }
};

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col font-inter overflow-y-auto w-full' },
    React.createElement(
      'div',
      { className: 'w-full p-4' },
      React.createElement(
        'div',
        { className: 'w-full' },

        userProfileData?.role === 'club' && React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto mb-6 space-y-2 px-2 sm:px-0' },
        React.createElement(
          'div',
          { className: 'bg-white border border-gray-200 rounded-lg p-5 shadow-sm text-center' },
          React.createElement(
            'div',
            { className: 'space-y-3 text-gray-700' },
            React.createElement(
              'p',
              { className: 'font-medium text-base' },
              "Úprava údajov tímov/pridanie nového tímu povolené do: ",
              React.createElement(
                'span',
                { className: isDataEditDeadlinePassed ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold' },
                formatDateTimeSK(dataEditDeadline)
              )
            ),
            React.createElement(
              'p',
              { className: 'font-medium text-base' },
              "Úprava súpisiek tímov povolená do: ",
              React.createElement(
                'span',
                { className: isRosterEditDeadlinePassed ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold' },
                formatDateTimeSK(rosterEditDeadline)
              )
            )
          )
        )
      ),

        teamCategories.length > 0 ? (
          React.createElement('div', { className: 'space-y-6 w-full' },
            teamCategories.map(([categoryName, teamsArray]) => (
              teamsArray.length > 0 && React.createElement('div', { key: categoryName, className: 'space-y-4 w-full' },
                userProfileData?.role === 'club' && React.createElement(
                    'div',
                    { className: 'flex justify-center mb-4' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setShowAddTeamModal(true),
                            disabled: isDataEditDeadlinePassed,
                            className: `flex items-center space-x-2 px-6 py-3 rounded-full text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#9333EA] hover:bg-opacity-90 ${isDataEditDeadlinePassed ? 'bg-white border border-solid' : ''}`,
                            style: {
                                backgroundColor: isDataEditDeadlinePassed ? 'white' : getRoleColor(userProfileData?.role),
                                color: isDataEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'white',
                                borderColor: isDataEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'transparent',
                                cursor: isDataEditDeadlinePassed ? 'not-allowed' : 'pointer'
                            },
                            'aria-label': 'Pridať nový tím'
                        },
                        React.createElement(
                            'svg',
                            { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg', style: { color: isDataEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'white' } },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: `M12 6v6m0 0v6m0-6h6m-6 0H6` })
                        ),
                        React.createElement('span', { className: 'font-semibold' }, 'Pridať nový tím')
                    )
                ),
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-4' }, `${categoryName} (${teamsArray.length} ${getTeamPluralization(teamsArray.length)})`),
                React.createElement('div', { className: 'space-y-6 w-full' },
                  teamsArray.map((team, index) => {
                    const allMembers = getAllTeamMembers(team);

                    const arrivalType = team.arrival?.type || 'Nezadané';
                    const accommodationType = team.accommodation?.type || 'Nezadané';
                    const accommodationName = team.accommodation?.name || 'Nepriradené';
                    const packageName = team.packageDetails?.name || 'Nezadané';

                    const arrivalTime = (
                        (arrivalType === "verejná doprava - autobus" || arrivalType === "verejná doprava - vlak") && team.arrival?.time
                    ) ? ` (čas: ${team.arrival.time} hod.)` : '';

                    const shouldShowAddressColumn = accommodationType !== 'bez ubytovania';

                    const formatAddress = (address) => {
                        if (!address) return '-';

                        const parts = [];
                
                        if (address.street && address.houseNumber) {
                            parts.push(`${address.street} ${address.houseNumber}`);
                        } else if (address.street) {
                            parts.push(address.street);
                        } else if (address.houseNumber) {
                            parts.push(address.houseNumber);
                        }
                    
                        if (address.postalCode && address.city) {
                            const formattedPsc = formatPostalCode(address.postalCode);
                            parts.push(`${formattedPsc} ${address.city}`);
                        } else if (address.postalCode) {
                            parts.push(formatPostalCode(address.postalCode));
                        } else if (address.city) {
                            parts.push(address.city);
                        }
    
                        if (address.country) {
                            parts.push(address.country);
                        }
                    
                        return parts.length > 0 ? parts.join(', ') : '-';
                    };

                    const editTeamButtonClasses = `flex items-center space-x-2 px-4 py-2 rounded-full bg-white text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white hover:bg-gray-100 ${isDataEditDeadlinePassed ? 'border border-solid' : ''}`;
                    const editTeamButtonStyles = {
                        color: getRoleColor(userProfileData?.role),
                        borderColor: isDataEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'transparent',
                        cursor: isDataEditDeadlinePassed ? 'not-allowed' : 'pointer',
                        backgroundColor: isDataEditDeadlinePassed ? 'white' : 'white'
                    };

                    return React.createElement('div', {
                        key: index,
                        className: 'bg-white pb-6 rounded-lg shadow-md border-l-4 border-[#9333EA] mb-4 w-full'
                    },
                      React.createElement('div', { className: `bg-[#9333EA] text-white py-2 px-6 rounded-t-lg w-full flex justify-between items-center` },
                        React.createElement('p', { className: 'text-xl font-semibold' }, `Názov tímu: ${team.teamName || 'Neznámy tím'}`),
                        React.createElement(
                            'button',
                            {
                                onClick: () => handleOpenEditTeamModal({ ...team, categoryName: categoryName }),
                                disabled: isDataEditDeadlinePassed,
                                className: editTeamButtonClasses,
                                style: editTeamButtonStyles,
                                'aria-label': 'Upraviť tím'
                            },
                            React.createElement(
                                'svg',
                                { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg', style: { color: getRoleColor(userProfileData?.role) } },
                                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: `M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z` })
                            ),
                            React.createElement('span', { className: 'font-medium' }, 'Upraviť')
                        )
                      ),

                      React.createElement('div', { className: 'px-6 pt-4 w-full' },
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Kategória: ${categoryName}`),
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Hráči: ${team.players || 0}`),
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Člen realizačného tímu (žena): ${team.womenTeamMemberDetails?.length || 0}`),
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Člen realizačného tímu (muž): ${team.menTeamMemberDetails?.length || 0}`),
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Šofér (žena): ${team.driverDetailsFemale?.length || 0}`),
                        React.createElement('p', { className: 'text-md text-gray-700 mb-2' }, `Šofér (muž): ${team.driverDetailsMale?.length || 0}`),

                        React.createElement('p', { className: 'text-md text-gray-700' }, `Typ dopravy: ${arrivalType}${arrivalTime}`),
                        (() => {
                            const currentAccommodationObject = availableAccommodationTypes.find(
                                acc => acc.type === accommodationType
                            );                            
                            const shouldShowAccommodationName = 
                                accommodationType !== 'bez ubytovania' && 
                                (!currentAccommodationObject || currentAccommodationObject.isPublic !== false);
                        
                            if (shouldShowAccommodationName) {
                                return React.createElement('div', { className: 'flex items-center' },
                                    React.createElement('div', { className: 'w-1/2' },
                                        React.createElement('span', { className: 'text-md text-gray-700' }, `Typ ubytovania: ${accommodationType}`)
                                    ),
                                    React.createElement('div', { className: 'w-1/2' },
                                        React.createElement('span', { className: 'text-md text-gray-700' }, `Ubytovňa: ${accommodationName || 'nepriradená'}`)
                                    )
                                );
                            }
                            return React.createElement('p', { className: 'text-md text-gray-700' }, `Typ ubytovania: ${accommodationType}`);
                        })(),
                        React.createElement(
                          'div',
                          { className: 'mt-3 text-gray-700' }, 
                          React.createElement(
                            'p',
                            { className: 'mb-1' },
                            'Farby dresov:'
                          ),
                          React.createElement(
                            'p',
                            { className: 'ml-4 text-sm text-gray-600' },
                            React.createElement('span', null, 'Farba dresov 1: '),
                            team.jerseyHomeColor?.trim() || '-'
                          ),
                          React.createElement(
                            'p',
                            { className: 'ml-4 text-sm text-gray-600' },
                            React.createElement('span', null, 'Farba dresov 2: '),
                            team.jerseyAwayColor?.trim() || '-'
                          )
                        ),                                  

                        team.packageDetails && (() => {
                            const totalPersons = (team.players || 0) +
                                                 (team.menTeamMemberDetails?.length || 0) +
                                                 (team.womenTeamMemberDetails?.length || 0) +
                                                 (team.driverDetailsFemale?.length || 0) +
                                                 (team.driverDetailsMale?.length || 0);
                            const pricePerPerson = team.packageDetails.price || 0;
                            const totalPrice = totalPersons * pricePerPerson;
                            
                            return React.createElement(
                                'div',
                                { className: 'mt-2 mb-4' },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center' },
                                    React.createElement(
                                        'div',
                                        { className: 'w-1/2' },
                                        React.createElement('span', { className: 'text-md text-gray-700' }, `Balík: ${packageName}`)
                                    ),
                                    React.createElement(
                                        'div',
                                        { className: 'w-1/2' },
                                        React.createElement('span', { className: 'text-md text-gray-700 ' }, `Celkom: ${totalPrice} €`)
                                    )
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'ml-4 mt-2 mb-4 space-y-1' },
                                    React.createElement('p', { className: 'text-sm text-gray-600' }, `Cena balíka: ${team.packageDetails.price || 0} € / osoba`),
                                    team.packageDetails.meals && team.packageDetails.meals.participantCard === 1 && React.createElement(
                                        'p',
                                        { className: 'text-sm text-gray-600' },
                                        `Zahŕňa účastnícku kartu`
                                    ),
                                    team.packageDetails.meals && (() => {
                                        const activeMealDates = Object.keys(team.packageDetails.meals).sort().filter(key => {
                                            const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(key);
                                            return isValidDate && key !== 'participantCard' && Object.values(team.packageDetails.meals[key]).some(status => status === 1);
                                        });
                        
                                        if (activeMealDates.length > 0) {
                                            return React.createElement(
                                                'div',
                                                { className: 'mt-2' },
                                                React.createElement('p', { className: 'text-sm text-gray-600 font-semibold' }, 'Stravovanie:'),
                                                activeMealDates.map(date => {
                                                    const dateObj = new Date(date);
                                                    const dayIndex = dateObj.getDay();
                                                    const dayAbbr = dayAbbreviations[dayIndex];
                        
                                                    const activeMeals = mealOrder
                                                        .filter(mealType => team.packageDetails.meals[date][mealType] === 1)
                                                        .map(mealType => mealTypeLabels[mealType]);
                        
                                                    const activeMealsString = activeMeals.join(', ');
                        
                                                    return React.createElement(
                                                        'p',
                                                        { key: date, className: 'text-sm text-gray-600 ml-2' },
                                                        `${dayAbbr} ${formatDateToDMMYYYY(date)}: ${activeMealsString}`
                                                    );
                                                })
                                            );
                                        }
                                        return null;
                                    })()
                                )
                            );
                        })(),
                                          
                        team.tshirts && team.tshirts.length > 0 && (
                            React.createElement('div', { className: 'mb-4 w-full' },
                                React.createElement('p', { className: 'text-md text-gray-700 font-semibold mb-1' }, 'Tričká:'),
                                team.tshirts.map((tshirt, tIndex) => (
                                    React.createElement('p', { key: tIndex, className: 'text-md text-gray-700 ml-4' },
                                        `Veľkosť: ${tshirt.size}, počet: ${tshirt.quantity}×`
                                    )
                                ))
                            )
                        )
                      ),

                      React.createElement('div', { className: 'mt-4 px-6 w-full' },
                      React.createElement('h4', { className: 'text-lg font-bold text-gray-800 mb-3' }, 'Zoznam členov:'),
  
                      allMembers.length > 0 ? (
                        React.createElement('div', { className: 'overflow-x-auto w-full' },
                          React.createElement('table', { className: 'min-w-full bg-white border border-gray-200 rounded-lg' },
                            
                            React.createElement('thead', null,
                              React.createElement('tr', { className: 'bg-gray-100 text-left text-sm font-medium text-gray-600 uppercase tracking-wider' },
                                [
                                  React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Akcie'),
                                  React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Typ člena'),
                                  React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Číslo dresu'),
                                  React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Meno'),
                                  React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Priezvisko'),
                                  React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Dátum narodenia'),
                                  React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Číslo registrácie'),
                                  shouldShowAddressColumn && React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Adresa'),
                                ].filter(Boolean)
                              )
                            ),
                    
                            React.createElement('tbody', { className: 'divide-y divide-gray-200' },
                              allMembers.map((member, mIndex) => {
                                const canEdit = !isRosterEditDeadlinePassed;
                                const canDelete = !isDataEditDeadlinePassed;
                    
                                return React.createElement('tr', { key: mIndex, className: 'hover:bg-gray-50' },
                                  [
                                    React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm flex items-center space-x-2' },
                    
                                      React.createElement('button', {
                                          onClick: () => canEdit && handleOpenEditMemberDetailsModal(team, member),
                                          disabled: !canEdit,
                                          className: `flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                            canEdit
                                              ? 'text-white shadow-sm hover:shadow-md'
                                              : 'border border-solid'
                                          }`,
                                          style: {
                                            backgroundColor: canEdit ? getRoleColor(userProfileData?.role) : 'white',
                                            color: canEdit ? 'white' : getRoleColor(userProfileData?.role),
                                            borderColor: canEdit ? 'transparent' : getRoleColor(userProfileData?.role),
                                            cursor: canEdit ? 'pointer' : 'not-allowed'
                                          }
                                        },
                                          React.createElement('svg', { 
                                            className: 'w-4 h-4', 
                                            fill: 'none', 
                                            stroke: 'currentColor', 
                                            viewBox: '0 0 24 24' 
                                          },
                                            React.createElement('path', { 
                                              strokeLinecap: 'round', 
                                              strokeLinejoin: 'round', 
                                              strokeWidth: '2', 
                                              d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' 
                                            })
                                          ),
                                          React.createElement('span', null, 'Upraviť')
                                        ),
                    
                                      React.createElement('button', {
                                        onClick: () => canDelete && handleDeleteMember(team, member),
                                        disabled: !canDelete,
                                        className: `flex items-center justify-center w-9 h-9 rounded-full transition-colors focus:outline-none focus:ring-2 ${
                                          canDelete
                                            ? 'bg-red-100 hover:bg-red-200 text-red-700 focus:ring-red-400'
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`,
                                        'aria-label': 'Odstrániť člena'
                                      },
                                        React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                                          React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                                        )
                                      )
                                    ),
                    
                                    React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.type || '-'),
                                    React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-600' }, member.jerseyNumber || '-'),
                                    React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.firstName || '-'),
                                    React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.lastName || '-'),
                                    React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-600' },
                                      member.dateOfBirth ? formatDateToDMMYYYY(member.dateOfBirth) : '-'
                                    ),
                                    React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-600' }, member.registrationNumber || '-'),
                                    shouldShowAddressColumn && React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, formatAddress(member.address)),
                                  ].filter(Boolean)
                                );
                              })
                            )
                          )
                        )
                      ) : (
                        React.createElement('p', { className: 'text-center text-gray-600 text-sm py-4' }, 'V tomto tíme zatiaľ nie sú žiadni členovia.')
                      ),
                    
                      React.createElement(
                        'div',
                        { className: 'flex justify-center mt-4' },
                        React.createElement(
                          'button',
                          {
                            type: 'button',
                            onClick: () => handleOpenAddMemberTypeModal({ ...team, categoryName: categoryName }),
                            disabled: isDataEditDeadlinePassed,
                            className: `flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDataEditDeadlinePassed ? 'bg-white border border-solid' : ''}`,
                            style: {
                              backgroundColor: isDataEditDeadlinePassed ? 'white' : getRoleColor(userProfileData?.role),
                              color: isDataEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'white',
                              borderColor: isDataEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'transparent',
                              cursor: isDataEditDeadlinePassed ? 'not-allowed' : 'pointer'
                            },
                            'aria-label': 'Pridať člena tímu'
                          },
                            React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg', style: { color: isDataEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'white' } }, React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: `M12 6v6m0 0v6m0-6h6m-6 0H6` }))
                            )
                          )
                        )
                      )
                  })
                )
              )
            ))
          )
        ) : (
          userProfileData?.role === 'club' && React.createElement('p', { className: 'text-center text-gray-600 text-lg py-8' }, 'Zatiaľ neboli vytvorené žiadne tímy pre tohto používateľa.')
        )
      ),
      userProfileData?.role === 'club' && React.createElement(
          'div',
          { className: 'flex justify-center mt-8 pb-8' },
          React.createElement(
              'button',
              {
                  type: 'button',
                  onClick: () => setShowAddTeamModal(true),
                  disabled: isDataEditDeadlinePassed,
                  className: `flex items-center space-x-2 px-6 py-3 rounded-full text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#9333EA] hover:bg-opacity-90 ${isDataEditDeadlinePassed ? 'bg-white border border-solid' : ''}`,
                  style: {
                      backgroundColor: isDataEditDeadlinePassed ? 'white' : getRoleColor(userProfileData?.role),
                      color: isDataEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'white',
                      borderColor: isDataEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'transparent',
                      cursor: isDataEditDeadlinePassed ? 'not-allowed' : 'pointer'
                  },
                  'aria-label': 'Pridať nový tím'
              },
              React.createElement(
                  'svg',
                  { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg', style: { color: isDataEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'white' } },
                  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: `M12 6v6m0 0v6m0-6h6m-6 0H6` })
              ),
              React.createElement('span', { className: 'font-semibold' }, 'Pridať nový tím')
          )
      ),

      selectedTeam && React.createElement(
        EditTeamModal,
        {
          show: showEditTeamModal,
          onClose: () => {
            setShowEditTeamModal(false);
            setSelectedTeam(null);
          },
          teamData: selectedTeam,
          onSaveTeam: handleSaveTeam,
          onDeleteTeam: handleDeleteTeam,
          userProfileData: userProfileData,
          availablePackages: availablePackages,
          availableAccommodationTypes: availableAccommodationTypes,
          availableTshirtSizes: availableTshirtSizes,
          isDataEditDeadlinePassed: isDataEditDeadlinePassed
        }
      ),
      React.createElement(
        AddMemberTypeModal,
        {
          show: showAddMemberTypeModal,
          onClose: () => setShowAddMemberTypeModal(false),
          onSelectMemberType: handleSelectMemberType,
          userProfileData: userProfileData,
          isDataEditDeadlinePassed: isDataEditDeadlinePassed,
          maxPlayersPerTeam: getLimitsForTeam(teamToAddMemberTo).numberOfPlayers,
          maxImplementationMembers: getLimitsForTeam(teamToAddMemberTo).numberOfImplementationTeam,
          currentTeam: teamToAddMemberTo,
        }
      ),
      React.createElement(
          MemberDetailsModal,
          {
              show: showMemberDetailsModal,
              onClose: () => {
                  setShowMemberDetailsModal(false);
                  setMemberToEdit(null);
                  setIsMemberEditMode(false);
              },
              onSaveMember: isMemberEditMode ? handleSaveEditedMember : handleSaveNewMember,
              memberType: memberTypeToAdd,
              userProfileData: userProfileData,
              teamAccommodationType: teamAccommodationTypeToAddMemberTo,
              memberData: memberToEdit,
              isEditMode: isMemberEditMode,
              isRosterEditDeadlinePassed: isRosterEditDeadlinePassed,
              isDataEditDeadlinePassed: isDataEditDeadlinePassed,
              teamCategoryName: isMemberEditMode ? teamOfMemberToEdit?.categoryName : teamToAddMemberTo?.categoryName,
              currentTeam: isMemberEditMode ? teamOfMemberToEdit : teamToAddMemberTo,
              maxPlayersPerTeam: getLimitsForTeam(isMemberEditMode ? teamOfMemberToEdit : teamToAddMemberTo).numberOfPlayers,
              maxImplementationMembers: getLimitsForTeam(isMemberEditMode ? teamOfMemberToEdit : teamToAddMemberTo).numberOfImplementationTeam,
              teamOfMemberToEdit: teamOfMemberToEdit,
          }
      ),
    
      React.createElement(
        AddTeamModal,
        {
            show: showAddTeamModal,
            onClose: () => setShowAddTeamModal(false),
            onAddTeam: handleAddTeam,
            userProfileData: userProfileData,
            availablePackages: availablePackages,
            availableAccommodationTypes: availableAccommodationTypes,
            availableTshirtSizes: availableTshirtSizes,
            teamsData: teamsData || {},
            availableCategoriesFromSettings: availableCategoriesFromSettings,
            isDataEditDeadlinePassed: isDataEditDeadlinePassed
        }
      )
    )
  );
}

window.RostersApp = RostersApp;

import { getFirestore, doc, onSnapshot, updateDoc, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef, useMemo } = window.React || {};

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

const formatDateToDMMYYYY = (dateString) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    if (year && month && day) {
        return `${day}. ${month}. ${year}`;
    }
    return dateString;
};

// Pridajte do globálneho scope
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

function AddMemberTypeModal({ show, onClose, onSelectMemberType, userProfileData, isDataEditDeadlinePassed }) {
    const [selectedType, setSelectedType] = useState('');
    if (!show) return null;
    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';
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
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 z-[1001] flex justify-center items-start pt-20 pb-4 overflow-y-auto' },
        React.createElement(
            'div',
            { className: 'relative w-full max-w-md mx-auto rounded-lg shadow-lg bg-white max-h-[85vh] flex flex-col' },
            React.createElement(
                'div',
                { className: `flex justify-between items-center text-white p-4 rounded-t-lg`, style: { backgroundColor: roleColor } },
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
                    React.createElement('option', { value: 'player' }, 'Hráč'),
                    React.createElement('option', { value: 'womenTeamMember' }, 'Člen realizačného tímu (žena)'),
                    React.createElement('option', { value: 'menTeamMember' }, 'Člen realizačného tímu (muž)'),
                    React.createElement('option', { value: 'driverFemale' }, 'Šofér (žena)'),
                    React.createElement('option', { value: 'driverMale' }, 'Šofér (muž)')
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
    teamCategoryName // Pridané
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
    const [dateOfBirthError, setDateOfBirthError] = useState(''); 
    const [isDateOfBirthValid, setIsDateOfBirthValid] = useState(true); 

    useEffect(() => {
        if (show) {
            if (isEditMode && memberData) {
                setFirstName(memberData.firstName || '');
                setLastName(memberData.lastName || '');
                setDateOfBirth(memberData.dateOfBirth || '');
                setJerseyNumber(memberData.jerseyNumber || '');
                setRegistrationNumber(memberData.registrationNumber || '');
                setStreet(memberData.address?.street || '');
                setHouseNumber(memberData.address?.houseNumber || '');
                setPostalCode(memberData.address?.postalCode || '');
                setCity(memberData.address?.city || '');
                setCountry(memberData.address?.country || '');
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
            }
        }
    }, [show, memberType, teamAccommodationType, memberData, isEditMode]);

    if (!show) return null;

    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';
    const showAddressFields = teamAccommodationType !== 'bez ubytovania';
    const isButtonDisabled = isEditMode ? isRosterEditDeadlinePassed : isDataEditDeadlinePassed;

    // Validácia dátumu narodenia
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
            if (dateFrom || dateTo) {
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
        }
        setDateOfBirthError('');
        setIsDateOfBirthValid(true);
        return true;
    };

    const handleDateOfBirthChange = (e) => {
        const newDate = e.target.value;
        setDateOfBirth(newDate);
        if (memberType === 'player') {
            validateDateOfBirth(newDate, teamCategoryName);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isButtonDisabled) return;
        if (memberType === 'player' && !validateDateOfBirth(dateOfBirth, teamCategoryName)) {
            return;
        }
        const memberDetails = {
            firstName,
            lastName,
            dateOfBirth,
            ...(memberType === 'player' && { jerseyNumber: parseInt(jerseyNumber, 10) || null }),
            ...(memberType === 'player' && { registrationNumber }),
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

    const buttonClasses = `px-4 py-2 rounded-md transition-colors ${
        isButtonDisabled || !isDateOfBirthValid ? 'bg-white text-current border border-current' : 'text-white'
    }`;
    const buttonStyles = {
        backgroundColor: isButtonDisabled || !isDateOfBirthValid ? 'white' : roleColor,
        color: isButtonDisabled || !isDateOfBirthValid ? roleColor : 'white',
        borderColor: isButtonDisabled || !isDateOfBirthValid ? roleColor : 'transparent',
        cursor: isButtonDisabled || !isDateOfBirthValid ? 'not-allowed' : 'pointer'
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 z-[1001] flex justify-center items-start pt-20 pb-4 overflow-y-auto' },
        React.createElement(
            'div',
            { className: 'relative p-6 bg-white w-full max-w-md mx-auto rounded-lg shadow-lg max-h-[85vh] overflow-y-auto overflow-x-hidden' },
            React.createElement(
                'div',
                { className: `flex justify-between items-center text-white p-4 rounded-t-lg`, style: { backgroundColor: roleColor } },
                React.createElement('h3', { className: 'text-xl font-semibold' }, `${isEditMode ? 'Upraviť' : 'Pridať'} ${memberType === 'player' ? 'hráča' : memberType === 'womenTeamMember' ? 'členku realizačného tímu' : memberType === 'menTeamMember' ? 'člena realizačného tímu' : memberType === 'driverFemale' ? 'šoférku' : memberType === 'driverMale' ? 'šoféra' : 'člena'}`),
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
                    React.createElement('input', { type: 'text', id: 'firstName', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: firstName, onChange: (e) => setFirstName(e.target.value), required: true, disabled: isButtonDisabled })
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700' }, 'Priezvisko'),
                    React.createElement('input', { type: 'text', id: 'lastName', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: lastName, onChange: (e) => setLastName(e.target.value), required: true, disabled: isButtonDisabled })
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
                    React.createElement('input', { type: 'number', id: 'jerseyNumber', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: jerseyNumber, onChange: (e) => setJerseyNumber(e.target.value), disabled: isButtonDisabled })
                ),
                (memberType === 'player') && React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'registrationNumber', className: 'block text-sm font-medium text-gray-700' }, 'Číslo registrácie'),
                    React.createElement('input', { type: 'text', id: 'registrationNumber', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: registrationNumber, onChange: (e) => setRegistrationNumber(e.target.value), disabled: isButtonDisabled })
                ),
                showAddressFields && React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'street', className: 'block text-sm font-medium text-gray-700' }, 'Ulica'),
                    React.createElement('input', { type: 'text', id: 'street', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: street, onChange: (e) => setStreet(e.target.value), disabled: isButtonDisabled })
                ),
                showAddressFields && React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'houseNumber', className: 'block text-sm font-medium text-gray-700' }, 'Popisné číslo'),
                    React.createElement('input', { type: 'text', id: 'houseNumber', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: houseNumber, onChange: (e) => setHouseNumber(e.target.value), disabled: isButtonDisabled })
                ),
                showAddressFields && React.createElement('div', { className: 'grid grid-cols-2 gap-4' },
                    React.createElement('div', null,
                        React.createElement('label', { htmlFor: 'postalCode', className: 'block text-sm font-medium text-gray-700' }, 'PSČ'),
                        React.createElement('input', { type: 'text', id: 'postalCode', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: postalCode, onChange: (e) => setPostalCode(e.target.value), disabled: isButtonDisabled })
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { htmlFor: 'city', className: 'block text-sm font-medium text-gray-700' }, 'Mesto/Obec'),
                        React.createElement('input', { type: 'text', id: 'city', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: city, onChange: (e) => setCity(e.target.value), disabled: isButtonDisabled })
                    )
                ),
                showAddressFields && React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'country', className: 'block text-sm font-medium text-gray-700' }, 'Krajina'),
                    React.createElement('input', { type: 'text', id: 'country', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: country, onChange: (e) => setCountry(e.target.value), disabled: isButtonDisabled })
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
                            disabled: isButtonDisabled || !isDateOfBirthValid,
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
    const [editedTeamName, setEditedTeamName] = useState(teamData ? teamData.teamName : '');
    const [editedCategoryName, setEditedCategoryName] = useState(teamData ? teamData.categoryName : '');
    const [editedArrivalType, setEditedArrivalType] = useState(teamData ? teamData.arrival?.type || 'bez dopravy' : 'bez dopravy');
    const [editedPackageName, setEditedPackageName] = useState(teamData ? teamData.packageDetails?.name || '' : '');
    const [editedAccommodationType, setEditedAccommodationType] = useState(teamData ? teamData.accommodation?.type || '' : '');
    const [editedArrivalHour, setEditedArrivalHour] = useState('');
    const [editedArrivalMinute, setEditedArrivalMinute] = useState('');
    const [tshirtEntries, setTshirtEntries] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);

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
        setHasChanges(false);
      }
    }, [teamData]);

    if (!show) return null;

    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';

    const totalMembersInTeam = useMemo(() => {
        if (!teamData) return 0;
        const players = teamData.playerDetails?.length || 0;
        const menTeamMembers = teamData.menTeamMemberDetails?.length || 0;
        const womenTeamMembers = teamData.womenTeamMemberDetails?.length || 0;
        const driverFemale = teamData.driverDetailsFemale?.length || 0;
        const driverMale = teamData.driverDetailsMale?.length || 0;
        return players + menTeamMembers + womenTeamMembers + driverFemale + driverMale;
    }, [teamData]);

    const totalTshirtsQuantity = useMemo(() => {
        return tshirtEntries.reduce((sum, entry) => sum + (parseInt(entry.quantity, 10) || 0), 0);
    }, [tshirtEntries]);

    const allTshirtSizesSelected = useMemo(() => {
        if (tshirtEntries.length === 0) return true;
        return tshirtEntries.every(tshirt => tshirt.size !== '');
    }, [tshirtEntries]);

    const isSaveButtonDisabled = isDataEditDeadlinePassed || !hasChanges;

    const isAddTshirtButtonDisabled = isDataEditDeadlinePassed || totalTshirtsQuantity === totalMembersInTeam;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isDataEditDeadlinePassed) {
          showLocalNotification('Termín na úpravu údajov už vypršal.', 'error');
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
            tshirts: filteredTshirtEntries
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

    const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

    const handleAddTshirtEntry = () => {
        setTshirtEntries([...tshirtEntries, { size: '', quantity: 1 }]);
        setHasChanges(true);
    };

    const handleRemoveTshirtEntry = (index) => {
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
        const updatedEntries = [...tshirtEntries];
        updatedEntries[index].quantity = Math.max(1, parseInt(newQuantity, 10) || 1);
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
            ? 'bg-white border border-solid'
            : 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500'
        }`;
    const addTshirtButtonStyles = {
        cursor: isAddTshirtButtonDisabled ? 'not-allowed' : 'pointer',
        borderColor: isAddTshirtButtonDisabled ? roleColor : 'transparent',
        color: isAddTshirtButtonDisabled ? roleColor : 'white',
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 z-[1001] flex justify-center items-start pt-20 pb-4 overflow-y-auto' },
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
                        { className: 'flex space-x-2' },
                        React.createElement(
                            'div',
                            { className: 'w-1/2' },
                            React.createElement('label', { htmlFor: 'arrivalHour', className: 'block text-sm font-medium text-gray-700' }, 'Hodina'),
                            React.createElement('select', {
                                id: 'arrivalHour',
                                className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                                value: editedArrivalHour,
                                onChange: handleArrivalHourChange,
                                required: true,
                                disabled: isDataEditDeadlinePassed
                            },
                            React.createElement('option', { value: '' }, '-- Hodina --'),
                            hourOptions.map((hour) =>
                                React.createElement('option', { key: hour, value: hour }, hour)
                            )
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'w-1/2' },
                            React.createElement('label', { htmlFor: 'arrivalMinute', className: 'block text-sm font-medium text-gray-700' }, 'Minúta'),
                            React.createElement('select', {
                                id: 'arrivalMinute',
                                className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                                value: editedArrivalMinute,
                                onChange: handleArrivalMinuteChange,
                                required: true,
                                disabled: isDataEditDeadlinePassed
                            },
                            React.createElement('option', { value: '' }, '-- Minúta --'),
                            minuteOptions.map((minute) =>
                                React.createElement('option', { key: minute, value: minute }, minute)
                            )
                            )
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
                    availableAccommodationTypes.slice().sort((a,b) => a.localeCompare(b)).map((type, idx) =>
                        React.createElement('option', { key: idx, value: type }, type)
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
                        value: editedPackageName,
                        onChange: handlePackageNameChange,
                        required: true,
                        disabled: isDataEditDeadlinePassed
                    },
                    availablePackages.slice().sort().map((pkgName, idx) =>
                        React.createElement('option', { key: idx, value: pkgName }, pkgName)
                    )
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

    const isSaveButtonDisabled = isDataEditDeadlinePassed || !hasChanges || !selectedCategory;

    const showArrivalTimeInputs = arrivalType === 'verejná doprava - vlak' || arrivalType === 'verejná doprava - autobus';

    const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isDataEditDeadlinePassed) {
          showLocalNotification('Termín na úpravu údajov už vypršal.', 'error');
          return;
        }

        if (isSaveButtonDisabled) {
            showLocalNotification('Prosím, vyplňte kategóriu a názov tímu.', 'error');
            return;
        }

        let finalArrivalTime = '';
        if (arrivalType === 'verejná doprava - vlak' || arrivalType === 'verejná doprava - autobus') {
            finalArrivalTime = `${arrivalHour.padStart(2, '0')}:${arrivalMinute.padStart(2, '0')}`;
        }

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
                console.error("Error fetching package details for new team:", error);
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
            tshirts: filteredTshirtEntries,
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
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 z-[1001] flex justify-center items-start pt-20 pb-4 overflow-y-auto' },
        React.createElement(
            'div',
            { className: 'relative p-6 bg-white w-full max-w-md mx-auto rounded-lg shadow-lg max-h-[85vh] overflow-y-auto overflow-x-hidden' },
            React.createElement(
                'div',
                { className: `flex justify-between items-center text-white p-4 rounded-t-lg`, style: { backgroundColor: roleColor } },
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
                        { className: 'flex space-x-2' },
                        React.createElement(
                            'div',
                            { className: 'w-1/2' },
                            React.createElement('label', { htmlFor: 'arrivalHour', className: 'block text-sm font-medium text-gray-700' }, 'Hodina'),
                            React.createElement('select', {
                                id: 'arrivalHour',
                                className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                                value: arrivalHour,
                                onChange: (e) => {
                                    setArrivalHour(e.target.value);
                                    setHasChanges(true);
                                },
                                required: true,
                                disabled: isDataEditDeadlinePassed
                            },
                            React.createElement('option', { value: '' }, '-- Hodina --'),
                            hourOptions.map((hour) =>
                                React.createElement('option', { key: hour, value: hour }, hour)
                            )
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'w-1/2' },
                            React.createElement('label', { htmlFor: 'arrivalMinute', className: 'block text-sm font-medium text-gray-700' }, 'Minúta'),
                            React.createElement('select', {
                                id: 'arrivalMinute',
                                className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                                value: arrivalMinute,
                                onChange: (e) => {
                                    setArrivalMinute(e.target.value);
                                    setHasChanges(true);
                                },
                                required: true,
                                disabled: isDataEditDeadlinePassed
                            },
                            React.createElement('option', { value: '' }, '-- Minúta --'),
                            minuteOptions.map((minute) =>
                                React.createElement('option', { key: minute, value: minute }, minute)
                            )
                            )
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
                    availableAccommodationTypes.slice().sort((a,b) => a.localeCompare(b)).map((type, idx) =>
                        React.createElement('option', { key: idx, value: type }, type)
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
                    availablePackages.slice().sort().map((pkgName, idx) =>
                        React.createElement('option', { key: idx, value: pkgName }, pkgName)
                    )
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
  const [categoriesWithDates, setCategoriesWithDates] = useState({}); // Pridané

  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

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

    const fetchDeadlines = async () => {
        try {
            const settingsDocRef = doc(db, 'settings', 'registration');
            unsubscribeSettings = onSnapshot(settingsDocRef, (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    const settingsRosterDeadline = data.rosterEditDeadline?.toDate() || null;
                    const settingsDataDeadline = data.dataEditDeadline?.toDate() || null;

                    console.log("Načítané deadliny z nastavení (Timestamp → Date):", {
                        rosterEditDeadline: settingsRosterDeadline,
                        dataEditDeadline: settingsDataDeadline
                    });

                    if (user && user.uid) {
                        const userDocRef = doc(db, 'users', user.uid);
                        unsubscribeUserDeadlines = onSnapshot(userDocRef, (userDocSnapshot) => {
                            let userRosterDeadline = null;
                            let userDataDeadline = null;

                            if (userDocSnapshot.exists()) {
                                const userData = userDocSnapshot.data();
                                userRosterDeadline = userData.rosterEditDeadline?.toDate() || null;
                                userDataDeadline = userData.dataEditDeadline?.toDate() || null;

                                console.log("Načítané deadliny z používateľského profilu (Timestamp → Date):", {
                                    userRosterDeadline,
                                    userDataDeadline
                                });
                            }

                            const finalRosterDeadline = !userRosterDeadline || !settingsRosterDeadline
                                ? userRosterDeadline || settingsRosterDeadline
                                : new Date(Math.max(userRosterDeadline.getTime(), settingsRosterDeadline.getTime()));

                            const finalDataDeadline = !userDataDeadline || !settingsDataDeadline
                                ? userDataDeadline || settingsDataDeadline
                                : new Date(Math.max(userDataDeadline.getTime(), settingsDataDeadline.getTime()));

                            console.log("Finálne deadliny (maximum z oboch zdrojov):", {
                                rosterEditDeadline: finalRosterDeadline,
                                dataEditDeadline: finalDataDeadline
                            });

                            setRosterEditDeadline(finalRosterDeadline);
                            setDataEditDeadline(finalDataDeadline);
                        }, (error) => {
                            console.error("Chyba pri načítaní používateľských deadlinov:", error);
                            setRosterEditDeadline(settingsRosterDeadline);
                            setDataEditDeadline(settingsDataDeadline);
                        });
                    } else {
                        setRosterEditDeadline(settingsRosterDeadline);
                        setDataEditDeadline(settingsDataDeadline);
                    }
                } else {
                    console.log("Dokument s nastaveniami neexistuje.");
                    setRosterEditDeadline(null);
                    setDataEditDeadline(null);
                }
            }, (error) => {
                console.error("Chyba pri načítaní deadlinov z nastavení:", error);
                setRosterEditDeadline(null);
                setDataEditDeadline(null);
            });
        } catch (e) {
            console.error("Chyba pri nastavovaní onSnapshot pre deadliny:", e);
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
    console.log("Aktuálne deadliny v stave:", {
        rosterEditDeadline,
        dataEditDeadline
    });
}, [rosterEditDeadline, dataEditDeadline]);

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
                          packagesList.push(data.name);
                      }
                  });
                  setAvailablePackages(packagesList);
              }, (error) => {
                  console.error("RostersApp: Error fetching packages:", error);
              });
          } catch (e) {
              console.error("RostersApp: Error setting up onSnapshot for packages:", e);
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
                      const types = data.types?.map(typeObj => typeObj.type) || [];
                      setAvailableAccommodationTypes(types);
                  } else {
                      setAvailableAccommodationTypes([]);
                  }
              }, (error) => {
                  console.error("RostersApp: Error fetching accommodation types:", error);
              });
          } catch (e) {
              console.error("RostersApp: Error setting up onSnapshot for accommodation types:", e);
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
                console.error("RostersApp: Error fetching tshirt sizes:", error);
            });
        } catch (e) {
            console.error("RostersApp: Error setting up onSnapshot for tshirt sizes:", e);
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
                        window.categoriesWithDates = categoriesWithDates; // Pridané
                    } else {
                        setAvailableCategoriesFromSettings([]);
                        setCategoriesWithDates({});
                        window.categoriesWithDates = {};
                    }
                }, (error) => {
                    console.error("RostersApp: Error fetching categories from settings:", error);
                });
            } catch (e) {
                console.error("RostersApp: Error setting up onSnapshot for categories from settings:", e);
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

    if (user && db && isAuthReady) {
      setLoading(true);

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            setUserProfileData(userData);

            if (userData.teams) {
                const normalizedTeams = {};
                const currentClubName = userData.billing?.clubName?.trim() || 'Neznámy klub';

                for (const categoryKey in userData.teams) {
                    if (Object.prototype.hasOwnProperty.call(userData.teams, categoryKey)) {
                        normalizedTeams[categoryKey] = userData.teams[categoryKey].map(team => {
                            return {
                                ...team,
                                clubName: team.clubName?.trim() || currentClubName,
                                categoryName: team.categoryName || categoryKey
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
          console.error("RostersApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          setLoading(false);
        });
      } catch (e) {
        console.error("RostersApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
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
    };
  }, [user, db, isAuthReady, auth]);

  if (!isAuthReady || !userProfileData) {
    return null;
  }

  const getAllTeamMembers = (team) => {
    const members = [];

    if (team.playerDetails && team.playerDetails.length > 0) {
      team.playerDetails.forEach(player => {
        members.push({
          originalType: 'player',
          type: 'Hráč',
          ...player,
        });
      });
    }

    if (team.menTeamMemberDetails && team.menTeamMemberDetails.length > 0) {
      team.menTeamMemberDetails.forEach(member => {
        members.push({
          originalType: 'menTeamMember',
          type: 'Člen realizačného tímu (muž)',
          ...member,
        });
      });
    }

    if (team.womenTeamMemberDetails && team.womenTeamMemberDetails.length > 0) {
      team.womenTeamMemberDetails.forEach(member => {
        members.push({
          originalType: 'womenTeamMember',
          type: 'Člen realizačného tímu (žena)',
          ...member,
        });
      });
    }

    if (team.driverDetailsFemale && team.driverDetailsFemale.length > 0) {
      team.driverDetailsFemale.forEach(driver => {
        members.push({
          originalType: 'driverFemale',
          type: 'Šofér (žena)',
          ...driver,
        });
      });
    }

    if (team.driverDetailsMale && team.driverDetailsMale.length > 0) {
      team.driverDetailsMale.forEach(driver => {
        members.push({
          originalType: 'driverMale',
          type: 'Šofér (muž)',
          ...driver,
        });
      });
    }

    return members;
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

    const originalPackageName = selectedTeam?.packageDetails?.name || '';
    const newPackageName = updatedTeamData.packageDetails.name;

    if (newPackageName !== originalPackageName) {
        try {
            const packagesRef = collection(db, 'settings', 'packages', 'list');
            const q = query(packagesRef, where('name', '==', newPackageName));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const packageDoc = querySnapshot.docs[0];
                const packageData = packageDoc.data();
                updatedTeamData.packageDetails.meals = packageData.meals || {};
                updatedTeamData.packageDetails.price = packageData.price || 0;
                updatedTeamData.packageDetails.id = packageDoc.id;
            } else {
                updatedTeamData.packageDetails.meals = {};
                updatedTeamData.packageDetails.price = 0;
                updatedTeamData.packageDetails.id = null;
            }
        } catch (error) {
            console.error("Error fetching new package details:", error);
            showLocalNotification('Nastala chyba pri načítaní detailov nového balíka.', 'error');
            return;
        }
    }

    const teamCategory = updatedTeamData.categoryName;
    const teamIndex = teamsData[teamCategory].findIndex(t => t.teamName === updatedTeamData.teamName);

    if (teamIndex !== -1) {
        const userDocRef = doc(db, 'users', user.uid);
        const currentTeams = { ...teamsData };

        currentTeams[teamCategory][teamIndex] = updatedTeamData;

        try {
            await updateDoc(userDocRef, {
                teams: currentTeams
            });
            showLocalNotification('Údaje tímu boli úspešne aktualizované!', 'success');
        } catch (error) {
            console.error("Chyba pri aktualizácii tímu:", error);
            showLocalNotification('Nastala chyba pri aktualizácii údajov tímu.', 'error');
        }
    } else {
        showLocalNotification('Chyba: Tím nebol nájdený pre aktualizáciu.', 'error');
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

    const confirmDelete = await new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 z-[1001] flex justify-center items-start pt-20 pb-4 overflow-y-auto';
        modal.innerHTML = `
            <div class="relative w-full max-w-md mx-auto rounded-lg shadow-lg bg-white max-h-[85vh] flex flex-col">
                <h3 class="text-xl font-semibold mb-4 text-gray-800">Potvrdiť vymazanie tímu</h3>
                <p class="mb-6 text-gray-700">Naozaj chcete vymazať tím <strong>${teamToDelete.teamName}</strong>? Táto akcia je nevratná.</p>
                <div class="flex justify-end space-x-2">
                    <button id="cancelDelete" class="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors">Zrušiť</button>
                    <button id="confirmDelete" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">Vymazať</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('cancelDelete').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
        document.getElementById('confirmDelete').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };
    });

    if (!confirmDelete) {
        return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const currentTeamsCopy = JSON.parse(JSON.stringify(teamsData));

    const categoryToDeleteFrom = teamToDelete.categoryName;
    const clubName = userProfileData.billing.clubName?.trim();

    if (!currentTeamsCopy[categoryToDeleteFrom]) {
        showLocalNotification('Chyba: Kategória tímu nebola nájdená.', 'error');
        return;
    }

    let teamsInCurrentCategory = currentTeamsCopy[categoryToDeleteFrom].filter(
        team => team.teamName !== teamToDelete.teamName
    );

    let clubTeamsInCategory = teamsInCurrentCategory.filter(
        team => team.clubName?.trim() === clubName && team.categoryName === categoryToDeleteFrom
    );
    let otherTeamsInCategories = teamsInCurrentCategory.filter(
        team => !(team.clubName?.trim() === clubName && team.categoryName === categoryToDeleteFrom)
    );

    clubTeamsInCategory.sort((a, b) => {
        const getSuffixPart = (teamName, baseClubName) => {
            const regex = new RegExp(`^${baseClubName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*([A-Z])$`);
            const match = teamName.match(regex);
            return match ? match[1] : '';
        };

        const suffixA = getSuffixPart(a.teamName, clubName);
        const suffixB = getSuffixPart(b.teamName, clubName);

        if (suffixA === '' && suffixB !== '') return -1;
        if (suffixA !== '' && suffixB === '') return 1;
        return suffixA.localeCompare(suffixB);
    });

    if (clubTeamsInCategory.length === 0) {
        delete currentTeamsCopy[categoryToDeleteFrom];
    } else if (clubTeamsInCategory.length === 1) {
        clubTeamsInCategory[0].teamName = clubName;
    } else {
        for (let i = 0; i < clubTeamsInCategory.length; i++) {
            clubTeamsInCategory[i].teamName = `${clubName} ${String.fromCharCode('A'.charCodeAt(0) + i)}`;
        }
    }

    if (currentTeamsCopy[categoryToDeleteFrom]) {
        currentTeamsCopy[categoryToDeleteFrom] = [...otherTeamsInCategories, ...clubTeamsInCategory];
    }

    try {
        await updateDoc(userDocRef, {
            teams: currentTeamsCopy
        });
        showLocalNotification('Tím bol úspešne vymazaný!', 'success');
        setShowEditTeamModal(false);
        setSelectedTeam(null);
    } catch (error) {
        console.error("Chyba pri mazaní tímu:", error);
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

    const userDocRef = doc(db, 'users', user.uid);
    const currentTeamsCopy = JSON.parse(JSON.stringify(teamsData));

    const category = newTeamDataFromModal.categoryName;
    const clubName = newTeamDataFromModal.clubName;

    if (!currentTeamsCopy[category]) {
        currentTeamsCopy[category] = [];
    }

    let existingClubTeamsInThisCategory = currentTeamsCopy[category].filter(
        team => team.clubName?.trim() === clubName && team.categoryName === category
    );

    const allRelevantTeamsBeforeUpdate = [
        ...existingClubTeamsInThisCategory.map(team => ({ ...team, originalNameForSort: team.teamName })),
        { ...newTeamDataFromModal, originalNameForSort: newTeamDataFromModal.teamName }
    ];

    allRelevantTeamsBeforeUpdate.sort((a, b) => {
        const getSuffixPart = (teamName, baseClubName) => {
            const regex = new RegExp(`^${baseClubName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*([A-Z])$`);
            const match = teamName.match(regex);
            return match ? match[1] : '';
        };

        const suffixA = getSuffixPart(a.originalNameForSort, clubName);
        const suffixB = getSuffixPart(b.originalNameForSort, clubName);

        if (suffixA === '' && suffixB !== '') return -1;
        if (suffixA !== '' && suffixB === '') return 1;
        return suffixA.localeCompare(suffixB);
    });

    if (allRelevantTeamsBeforeUpdate.length === 1) {
        allRelevantTeamsBeforeUpdate[0].teamName = clubName;
    } else {
        for (let i = 0; i < allRelevantTeamsBeforeUpdate.length; i++) {
            allRelevantTeamsBeforeUpdate[i].teamName = `${clubName} ${String.fromCharCode('A'.charCodeAt(0) + i)}`;
        }
    }

    const otherTeamsInCategories = currentTeamsCopy[category].filter(
        team => !(team.clubName?.trim() === clubName && team.categoryName === category)
    );

    currentTeamsCopy[category] = [...otherTeamsInCategories, ...allRelevantTeamsBeforeUpdate];

    try {
        await updateDoc(userDocRef, {
            teams: currentTeamsCopy
        });
        showLocalNotification('Nový tím bol úspešne pridaný a názvy tímov aktualizované!', 'success');
    } catch (error) {
        console.error("Chyba pri pridávaní tímu a aktualizácii názvov:", error);
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
    setTeamOfMemberToEdit(team);
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

    const userDocRef = doc(db, 'users', user.uid);
    const currentTeams = { ...teamsData };
    const teamCategory = teamToAddMemberTo.categoryName;
    const teamIndex = currentTeams[teamCategory].findIndex(t => t.teamName === teamToAddMemberTo.teamName);

    if (teamIndex === -1) {
        showLocalNotification('Chyba: Tím nebol nájdený.', 'error');
        return;
    }

    const teamToUpdate = { ...currentTeams[teamCategory][teamIndex] };

    switch (memberTypeToAdd) {
        case 'player':
            if (!teamToUpdate.playerDetails) teamToUpdate.playerDetails = [];
            teamToUpdate.playerDetails.push(newMemberDetails);
            teamToUpdate.players = (teamToUpdate.players || 0) + 1;
            break;
        case 'womenTeamMember':
            if (!teamToUpdate.womenTeamMemberDetails) teamToUpdate.womenTeamMemberDetails = [];
            teamToUpdate.womenTeamMemberDetails.push(newMemberDetails);
            teamToUpdate.womenTeamMembers = (teamToUpdate.womenTeamMembers || 0) + 1;
            break;
        case 'menTeamMember':
            if (!teamToUpdate.menTeamMemberDetails) teamToUpdate.menTeamMemberDetails = [];
            teamToUpdate.menTeamMemberDetails.push(newMemberDetails);
            teamToUpdate.menTeamMembers = (teamToUpdate.menTeamMembers || 0) + 1;
            break;
        case 'driverFemale':
            if (!teamToUpdate.driverDetailsFemale) teamToUpdate.driverDetailsFemale = [];
            teamToUpdate.driverDetailsFemale.push(newMemberDetails);
            break;
        case 'driverMale':
            if (!teamToUpdate.driverDetailsMale) teamToUpdate.driverDetailsMale = [];
            teamToUpdate.driverDetailsMale.push(newMemberDetails);
            break;
        default:
            showLocalNotification('Neznámy typ člena tímu.', 'error');
            return;
    }

    currentTeams[teamCategory][teamIndex] = teamToUpdate;

    try {
        await updateDoc(userDocRef, {
            teams: currentTeams
        });
        showLocalNotification('Nový člen tímu bol úspešne pridaný!', 'success');
        setTeamToAddMemberTo(null);
        setMemberTypeToAdd(null);
    } catch (error) {
        console.error("Chyba pri pridávaní člena tímu:", error);
        showLocalNotification('Nastala chyba pri pridávaní člena tímu.', 'error');
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

    const userDocRef = doc(db, 'users', user.uid);
    const currentTeams = { ...teamsData };
    const teamCategory = teamOfMemberToEdit.categoryName;
    const teamName = teamOfMemberToEdit.teamName;
    const teamIndex = currentTeams[teamCategory].findIndex(t => t.teamName === teamName);

    if (teamIndex === -1) {
        showLocalNotification('Chyba: Tím nebol nájdený pre aktualizáciu člena.', 'error');
        return;
    }

    const teamToUpdate = { ...currentTeams[teamCategory][teamIndex] };
    let memberArrayName;

    switch (memberToEdit.originalType) {
        case 'player': memberArrayName = 'playerDetails'; break;
        case 'womenTeamMember': memberArrayName = 'womenTeamMemberDetails'; break;
        case 'menTeamMember': memberArrayName = 'menTeamMemberDetails'; break;
        case 'driverFemale': memberArrayName = 'driverDetailsFemale'; break;
        case 'driverMale': memberArrayName = 'driverDetailsMale'; break;
        default:
            showLocalNotification('Neznámy typ člena tímu pre aktualizáciu.', 'error');
            return;
    }

    const memberArray = teamToUpdate[memberArrayName];
    const memberIndex = memberArray.findIndex(
        m => m.firstName === memberToEdit.firstName &&
             m.lastName === memberToEdit.lastName &&
             m.dateOfBirth === memberToEdit.dateOfBirth
    );

    if (memberIndex !== -1) {
        memberArray[memberIndex] = { ...memberArray[memberIndex], ...updatedMemberDetails };
    } else {
        showLocalNotification('Chyba: Člen tímu nebol nájdený pre aktualizáciu.', 'error');
        return;
    }

    currentTeams[teamCategory][teamIndex] = teamToUpdate;

    try {
        await updateDoc(userDocRef, { teams: currentTeams });
        showLocalNotification('Údaje člena tímu boli úspešne aktualizované!', 'success');
        setMemberToEdit(null);
        setTeamOfMemberToEdit(null);
    } catch (error) {
        console.error("Chyba pri aktualizácii člena tímu:", error);
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

        teamCategories.length > 0 ? (
          React.createElement('div', { className: 'space-y-6 w-full' },
            teamCategories.map(([categoryName, teamsArray]) => (
              teamsArray.length > 0 && React.createElement('div', { key: categoryName, className: 'space-y-4 w-full' },
                userProfileData && React.createElement(
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
                            parts.push(`${address.postalCode} ${address.city}`);
                        } else if (address.postalCode) {
                            parts.push(address.postalCode);
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
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Počet hráčov: ${team.players || 0}`),
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Členovia realizačného tímu (ženy): ${team.womenTeamMembers || 0}`),
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Členovia realizačného tímu (muži): ${team.menTeamMembers || 0}`),
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Šoféri (ženy): ${team.driverDetailsFemale?.length || 0}`),
                        React.createElement('p', { className: 'text-md text-gray-700 mb-2' }, `Šoféri (muži): ${team.driverDetailsMale?.length || 0}`),

                        React.createElement('p', { className: 'text-md text-gray-700' }, `Typ dopravy: ${arrivalType}${arrivalTime}`),
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Typ ubytovania: ${accommodationType}`),

                        team.packageDetails && React.createElement(
                            'div',
                            { className: 'mt-2 mb-4' },
                            React.createElement('p', { className: 'text-md text-gray-700' }, `Balík: ${packageName}`),
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
                        ),
                        team.tshirts && team.tshirts.length > 0 && (
                            React.createElement('div', { className: 'mb-4 w-full' },
                                React.createElement('p', { className: 'text-md text-gray-700 font-semibold mb-1' }, 'Tričká:'),
                                team.tshirts.map((tshirt, tIndex) => (
                                    React.createElement('p', { key: tIndex, className: 'text-md text-gray-700 ml-4' },
                                        `Veľkosť: ${tshirt.size}, Počet: ${tshirt.quantity}`
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
                                    React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Číslo registrácie'),
                                    shouldShowAddressColumn && React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Adresa'),
                                  ].filter(Boolean)
                                )
                              ),
                              React.createElement('tbody', { className: 'divide-y divide-gray-200' },
                                allMembers.map((member, mIndex) => {
                                    const editMemberButtonClasses = `flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors ${isRosterEditDeadlinePassed ? 'bg-white border border-solid' : ''}`;
                                    const editMemberButtonStyles = {
                                        color: isRosterEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'white',
                                        borderColor: isRosterEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'transparent',
                                        cursor: isRosterEditDeadlinePassed ? 'not-allowed' : 'pointer',
                                        backgroundColor: isRosterEditDeadlinePassed ? 'white' : getRoleColor(userProfileData?.role)
                                    };
                                    return (
                                        React.createElement('tr', { key: mIndex, className: 'hover:bg-gray-50' },
                                            [
                                            React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' },
                                                React.createElement('button', {
                                                    onClick: () => handleOpenEditMemberDetailsModal(team, member),
                                                    disabled: isRosterEditDeadlinePassed,
                                                    className: editMemberButtonClasses,
                                                    style: editMemberButtonStyles,
                                                    'aria-label': 'Upraviť člena'
                                                },
                                                    React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg', style: { color: isRosterEditDeadlinePassed ? getRoleColor(userProfileData?.role) : 'white' } }, React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: `M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z` })),
                                                    React.createElement('span', null, 'Upraviť')
                                                )
                                            ),
                                            React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.type),
                                            React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-600' }, member.jerseyNumber || '-'),
                                            React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.firstName || '-'),
                                            React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.lastName || '-'),
                                            React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-600' }, member.registrationNumber || '-'),
                                            shouldShowAddressColumn && React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, formatAddress(member.address)),
                                            ].filter(Boolean)
                                        )
                                    );
                                })
                              )
                            )
                          )) : (
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
          React.createElement('p', { className: 'text-center text-gray-600 text-lg py-8' }, 'Zatiaľ neboli vytvorené žiadne tímy pre tohto používateľa.')
        )
      ),
      userProfileData && React.createElement(
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
          isDataEditDeadlinePassed: isDataEditDeadlinePassed
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
              teamCategoryName: isMemberEditMode ? teamOfMemberToEdit?.categoryName : teamToAddMemberTo?.categoryName, // Pridané
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

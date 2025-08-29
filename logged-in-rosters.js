// logged-in-rosters.js
// Tento súbor predpokladá, že Firebase SDK verzie 9.x.x je inicializovaný v authentication.js
// a globálne funkcie ako window.auth, window.db, showGlobalLoader sú dostupné.

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
import { getFirestore, doc, onSnapshot, updateDoc, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


/**
 * Lokálna funkcia pre zobrazenie notifikácií v tomto module.
 * Presunutá sem z logged-in-my-data.js pre nezávislosť štýlovania.
 * Aj keď sa v tejto verzii nepoužíva, je tu pre prípadné budúce využitie.
 */
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

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
}

// Formátovanie dátumu na DD. MM. RRRR
const formatDateToDMMYYYY = (dateString) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    if (year && month && day) {
        return `${day}. ${month}. ${year}`;
    }
    return dateString;
};

// Mapovanie typov jedál na slovenské názvy a definovanie poradia
const mealTypeLabels = {
    breakfast: 'raňajky',
    lunch: 'obed',
    dinner: 'večera',
    refreshment: 'občerstvenie'
};

const mealOrder = ['breakfast', 'lunch', 'dinner', 'refreshment'];

// Skratky dní v týždni pre slovenčinu (0 = nedeľa, 1 = pondelok, ...)
const dayAbbreviations = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];

// Funkcia na získanie farby roly
const getRoleColor = (role) => {
    switch (role) {
        case 'admin':
            return '#47b3ff';
        case 'hall':
            return '#b06835';
        case 'user':
            return '#9333EA';
        default:
            return '#1D4ED8';
    }
};

// Komponent modálneho okna pre výber typu člena tímu
function AddMemberTypeModal({ show, onClose, onSelectMemberType, userProfileData }) {
    const [selectedType, setSelectedType] = React.useState('');

    if (!show) return null;

    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';

    const handleAdd = () => {
        if (selectedType) {
            onSelectMemberType(selectedType);
            setSelectedType(''); // Reset selected type
            onClose();
        } else {
            showLocalNotification('Prosím, vyberte typ člena.', 'error');
        }
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center' },
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
                        required: true
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
                            className: `px-4 py-2 text-white rounded-md transition-colors`,
                            style: { backgroundColor: roleColor, hoverBackgroundColor: roleColor }
                        },
                        'Pridať'
                    )
                )
            )
        )
    );
}

// Komponent modálneho okna pre pridanie detailov člena tímu
function AddMemberDetailsModal({ show, onClose, onSaveMember, memberType, userProfileData, teamAccommodationType }) {
    const [firstName, setFirstName] = React.useState('');
    const [lastName, setLastName] = React.useState('');
    const [dateOfBirth, setDateOfBirth] = React.useState('');
    const [jerseyNumber, setJerseyNumber] = React.useState('');
    const [registrationNumber, setRegistrationNumber] = React.useState('');
    const [street, setStreet] = React.useState('');
    const [houseNumber, setHouseNumber] = React.useState('');
    const [postalCode, setPostalCode] = React.useState('');
    const [city, setCity] = React.useState('');
    const [country, setCountry] = React.useState('');

    React.useEffect(() => {
        // Reset form when modal opens for a new memberType or closes
        if (show) {
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
    }, [show, memberType, teamAccommodationType]);

    if (!show) return null;

    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';
    const showAddressFields = teamAccommodationType !== 'bez ubytovania';

    const handleSubmit = (e) => {
        e.preventDefault();
        const newMember = {
            firstName,
            lastName,
            dateOfBirth,
            ...(memberType === 'player' && { jerseyNumber: parseInt(jerseyNumber, 10) || null }), // Len pre hráča
            ...(memberType === 'player' && { registrationNumber }), // Len pre hráča
        };
        
        // Pridaj adresu len ak je zobrazená
        if (showAddressFields) {
            newMember.address = {
                street,
                houseNumber,
                postalCode,
                city,
                country
            };
        }
        
        onSaveMember(newMember);
        onClose();
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center' },
        React.createElement(
            'div',
            { className: 'relative p-8 bg-white w-full max-w-md mx-auto rounded-lg shadow-lg' },
            React.createElement(
                'div',
                { className: `flex justify-between items-center text-white p-4 -mx-8 -mt-8 mb-4 rounded-t-lg`, style: { backgroundColor: roleColor } },
                React.createElement('h3', { className: 'text-xl font-semibold' }, `Pridať ${
                    memberType === 'player' ? 'hráča' :
                    memberType === 'womenTeamMember' ? 'členku realizačného tímu' :
                    memberType === 'menTeamMember' ? 'člena realizačného tímu' :
                    memberType === 'driverFemale' ? 'šoférku' :
                    memberType === 'driverMale' ? 'šoféra' : 'člena'
                }`),
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
                    React.createElement('input', { type: 'text', id: 'firstName', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: firstName, onChange: (e) => setFirstName(e.target.value), required: true })
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700' }, 'Priezvisko'),
                    React.createElement('input', { type: 'text', id: 'lastName', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: lastName, onChange: (e) => setLastName(e.target.value), required: true })
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'dateOfBirth', className: 'block text-sm font-medium text-gray-700' }, 'Dátum narodenia'),
                    React.createElement('input', { type: 'date', id: 'dateOfBirth', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: dateOfBirth, onChange: (e) => setDateOfBirth(e.target.value) })
                ),
                (memberType === 'player') && React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'jerseyNumber', className: 'block text-sm font-medium text-gray-700' }, 'Číslo dresu'),
                    React.createElement('input', { type: 'number', id: 'jerseyNumber', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: jerseyNumber, onChange: (e) => setJerseyNumber(e.target.value) })
                ),
                (memberType === 'player') && React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'registrationNumber', className: 'block text-sm font-medium text-gray-700' }, 'Číslo registrácie'),
                    React.createElement('input', { type: 'text', id: 'registrationNumber', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: registrationNumber, onChange: (e) => setRegistrationNumber(e.target.value) })
                ),
                showAddressFields && React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'street', className: 'block text-sm font-medium text-gray-700' }, 'Ulica'),
                    React.createElement('input', { type: 'text', id: 'street', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: street, onChange: (e) => setStreet(e.target.value) })
                ),
                showAddressFields && React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'houseNumber', className: 'block text-sm font-medium text-gray-700' }, 'Popisné číslo'),
                    React.createElement('input', { type: 'text', id: 'houseNumber', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: houseNumber, onChange: (e) => setHouseNumber(e.target.value) })
                ),
                showAddressFields && React.createElement('div', { className: 'grid grid-cols-2 gap-4' },
                    React.createElement('div', null,
                        React.createElement('label', { htmlFor: 'postalCode', className: 'block text-sm font-medium text-gray-700' }, 'PSČ'),
                        React.createElement('input', { type: 'text', id: 'postalCode', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: postalCode, onChange: (e) => setPostalCode(e.target.value) })
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { htmlFor: 'city', className: 'block text-sm font-medium text-gray-700' }, 'Mesto/Obec'),
                        React.createElement('input', { type: 'text', id: 'city', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: city, onChange: (e) => setCity(e.target.value) })
                    )
                ),
                showAddressFields && React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'country', className: 'block text-sm font-medium text-gray-700' }, 'Krajina'),
                    React.createElement('input', { type: 'text', id: 'country', className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2', value: country, onChange: (e) => setCountry(e.target.value) })
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
                            className: `px-4 py-2 text-white rounded-md transition-colors`,
                            style: { backgroundColor: roleColor, hoverBackgroundColor: roleColor }
                        },
                        'Pridať člena'
                    )
                )
            )
        )
    );
}


// Komponent modálneho okna pre úpravu tímu
function EditTeamModal({ show, onClose, teamData, onSaveTeam, userProfileData, availablePackages, availableAccommodationTypes, availableTshirtSizes, onAddMember }) {
    // Tieto stavy sa stále inicializujú z teamData, ale input boxy sa pre ne nebudú renderovať.
    // Sú potrebné pre zostavenie updatedTeamData v handleSubmit.
    const [editedTeamName, setEditedTeamName] = React.useState(teamData ? teamData.teamName : '');
    const [editedCategoryName, setEditedCategoryName] = React.useState(teamData ? teamData.categoryName : '');
    // Nové stavy pre selectboxy
    const [editedArrivalType, setEditedArrivalType] = React.useState(teamData ? teamData.arrival?.type || 'bez dopravy' : 'bez dopravy');
    const [editedPackageName, setEditedPackageName] = React.useState(teamData ? teamData.packageDetails?.name || '' : '');
    const [editedAccommodationType, setEditedAccommodationType] = React.useState(teamData ? teamData.accommodation?.type || '' : ''); // Nový stav pre typ ubytovania
    
    // Stavy pre čas príchodu - hodiny a minúty
    const [editedArrivalHour, setEditedArrivalHour] = React.useState('');
    const [editedArrivalMinute, setEditedArrivalMinute] = React.useState('');

    // Stav pre tričká
    const [tshirtEntries, setTshirtEntries] = React.useState([]);


    // Aktualizácia stavu, keď sa zmenia teamData (napr. pri otvorení pre iný tím)
    React.useEffect(() => {
        if (teamData) {
            setEditedTeamName(teamData.teamName || '');
            setEditedCategoryName(teamData.categoryName || '');
            setEditedArrivalType(teamData.arrival?.type || 'bez dopravy');
            setEditedPackageName(teamData.packageDetails?.name || '');
            setEditedAccommodationType(teamData.accommodation?.type || ''); // Inicializácia typu ubytovania

            // Parsujeme čas na hodiny a minúty
            if (teamData.arrival?.time) {
                const [hour, minute] = teamData.arrival.time.split(':');
                setEditedArrivalHour(hour || '');
                setEditedArrivalMinute(minute || '');
            } else {
                setEditedArrivalHour('');
                setEditedArrivalMinute('');
            }

            // Inicializácia tričiek
            setTshirtEntries(teamData.tshirts && Array.isArray(teamData.tshirts) ? teamData.tshirts.map(t => ({...t})) : []);
        }
    }, [teamData]);

    if (!show) return null;

    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';

    // Výpočet celkového počtu členov tímu
    const totalMembersInTeam = React.useMemo(() => {
        if (!teamData) return 0;
        const players = teamData.playerDetails?.length || 0;
        const menTeamMembers = teamData.menTeamMemberDetails?.length || 0;
        const womenTeamMembers = teamData.womenTeamMemberDetails?.length || 0;
        const driverFemale = teamData.driverDetailsFemale?.length || 0;
        const driverMale = teamData.driverDetailsMale?.length || 0;
        return players + menTeamMembers + womenTeamMembers + driverFemale + driverMale;
    }, [teamData]);

    // Výpočet celkového počtu tričiek
    const totalTshirtsQuantity = React.useMemo(() => {
        return tshirtEntries.reduce((sum, entry) => sum + (parseInt(entry.quantity, 10) || 0), 0);
    }, [tshirtEntries]);

    // Kontrola, či sú všetky selectboxy pre veľkosti tričiek vyplnené
    const allTshirtSizesSelected = React.useMemo(() => {
        if (tshirtEntries.length === 0) return true; // Ak nie sú žiadne tričká, predpokladáme, že je to OK
        return tshirtEntries.every(tshirt => tshirt.size !== '');
    }, [tshirtEntries]);


    // Podmienka pre zablokovanie tlačidla "Uložiť zmeny"
    const isSaveButtonDisabled = totalTshirtsQuantity !== totalMembersInTeam || !allTshirtSizesSelected;

    // Podmienka pre zablokovanie tlačidla "+" na pridanie tričiek
    const isAddTshirtButtonDisabled = totalTshirtsQuantity === totalMembersInTeam;


    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isSaveButtonDisabled) {
            showLocalNotification('Počet tričiek sa nezhoduje s počtom členov tímu alebo nie sú vybraté všetky veľkosti tričiek.', 'error');
            return;
        }

        let finalArrivalTime = '';
        if (editedArrivalType === 'verejná doprava - vlak' || editedArrivalType === 'verejná doprava - autobus') {
            finalArrivalTime = `${editedArrivalHour.padStart(2, '0')}:${editedArrivalMinute.padStart(2, '0')}`;
        }

        // Filtrujeme prázdne a neplatné záznamy tričiek a konvertujeme quantity na číslo
        const filteredTshirtEntries = tshirtEntries.filter(t => t.size && t.quantity && parseInt(t.quantity, 10) > 0)
                                                    .map(t => ({ ...t, quantity: parseInt(t.quantity, 10) }));


        const updatedTeamData = {
            ...teamData,
            teamName: editedTeamName, // Použijeme pôvodný názov tímu, lebo sa neupravuje
            categoryName: editedCategoryName, // Použijeme pôvodnú kategóriu, lebo sa neupravuje
            // Aktualizácia typu dopravy a času príchodu
            arrival: { 
                ...teamData.arrival, 
                type: editedArrivalType,
                time: finalArrivalTime
            },
            // Aktualizácia názvu balíka
            packageDetails: { ...teamData.packageDetails, name: editedPackageName },
            // Aktualizácia typu ubytovania
            accommodation: { ...teamData.accommodation, type: editedAccommodationType },
            // Aktualizácia tričiek
            tshirts: filteredTshirtEntries
            // Ostatné počty členov/šoférov sa zatiaľ neupravujú cez toto modálne okno
        };
        await onSaveTeam(updatedTeamData);
        
        // Odloženie onClose na ďalší cyklus udalostí
        setTimeout(() => {
            onClose();
        }, 0);
    };

    const showArrivalTimeInputs = editedArrivalType === 'verejná doprava - vlak' || editedArrivalType === 'verejná doprava - autobus';

    // Generovanie možností pre hodiny (00-23)
    const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    // Generovanie možností pre minúty (00-59)
    const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

    // Funkcie pre správu tričiek
    const handleAddTshirtEntry = () => {
        setTshirtEntries([...tshirtEntries, { size: '', quantity: 1 }]);
    };

    const handleRemoveTshirtEntry = (index) => {
        setTshirtEntries(tshirtEntries.filter((_, i) => i !== index));
    };

    const handleTshirtSizeChange = (index, newSize) => {
        const updatedEntries = [...tshirtEntries];
        updatedEntries[index].size = newSize;
        setTshirtEntries(updatedEntries);
    };

    const handleTshirtQuantityChange = (index, newQuantity) => {
        const updatedEntries = [...tshirtEntries];
        // Ensure quantity is a positive number
        updatedEntries[index].quantity = Math.max(1, parseInt(newQuantity, 10) || 1);
        setTshirtEntries(updatedEntries);
    };


    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center' },
        React.createElement(
            'div',
            { className: 'relative p-8 bg-white w-full max-w-md mx-auto rounded-lg shadow-lg' },
            React.createElement(
                'div',
                { className: `flex justify-between items-center text-white p-4 -mx-8 -mt-8 mb-4 rounded-t-lg`, style: { backgroundColor: roleColor } },
                React.createElement('h3', { className: 'text-2xl font-semibold' }, `Upraviť tím: ${teamData.teamName}`),
                React.createElement(
                    'button',
                    { 
                        onClick: () => setTimeout(() => onClose(), 0), // Obalenie onClose do setTimeout
                        className: 'text-white hover:text-gray-200 text-3xl leading-none font-semibold' 
                    },
                    '×'
                )
            ),
            React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'space-y-4' },
                // Odstránené input boxy pre Názov tímu a Kategóriu
                
                // Selectbox pre Typ dopravy
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'arrivalType', className: 'block text-sm font-medium text-gray-700' }, 'Typ dopravy'),
                    React.createElement('select', {
                        id: 'arrivalType',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: editedArrivalType,
                        onChange: (e) => setEditedArrivalType(e.target.value),
                        required: true
                    },
                    React.createElement('option', { value: 'bez dopravy' }, 'bez dopravy'),
                    React.createElement('option', { value: 'verejná doprava - autobus' }, 'verejná doprava - autobus'),
                    React.createElement('option', { value: 'verejná doprava - vlak' }, 'verejná doprava - vlak'),
                    React.createElement('option', { value: 'vlastná doprava' }, 'vlastná doprava')
                    )
                ),
                // Podmienené zobrazenie selectboxov pre čas príchodu
                showArrivalTimeInputs && React.createElement(
                    'div',
                    null, // Nový div kontajner pre nadpis a selectboxy
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Plánovaný čas príchodu na turnaj'), // Popisok
                    React.createElement(
                        'div',
                        { className: 'flex space-x-2' },
                        React.createElement(
                            'div',
                            { className: 'w-1/2' },
                            React.createElement('label', { htmlFor: 'arrivalHour', className: 'block text-sm font-medium text-gray-700' }, 'Hodina'), // Zviditeľnený popisok
                            React.createElement('select', {
                                id: 'arrivalHour',
                                className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                                value: editedArrivalHour,
                                onChange: (e) => setEditedArrivalHour(e.target.value),
                                required: true
                            },
                            React.createElement('option', { value: '' }, '-- Hodina --'), // Predvolená prázdna hodnota s popisom
                            hourOptions.map((hour) =>
                                React.createElement('option', { key: hour, value: hour }, hour)
                            )
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'w-1/2' },
                            React.createElement('label', { htmlFor: 'arrivalMinute', className: 'block text-sm font-medium text-gray-700' }, 'Minúta'), // Zviditeľnený popisok
                            React.createElement('select', {
                                id: 'arrivalMinute',
                                className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                                value: editedArrivalMinute,
                                onChange: (e) => setEditedArrivalMinute(e.target.value),
                                required: true
                            },
                            React.createElement('option', { value: '' }, '-- Minúta --'), // Predvolená prázdna hodnota s popisom
                            minuteOptions.map((minute) =>
                                React.createElement('option', { key: minute, value: minute }, minute)
                            )
                            )
                        )
                    )
                ),
                // Selectbox pre Typ ubytovania
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'accommodationType', className: 'block text-sm font-medium text-gray-700' }, 'Typ ubytovania'),
                    React.createElement('select', {
                        id: 'accommodationType',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: editedAccommodationType,
                        onChange: (e) => setEditedAccommodationType(e.target.value),
                        required: true
                    },
                    React.createElement('option', { value: 'bez ubytovania' }, 'bez ubytovania'), // Predvolená možnosť
                    availableAccommodationTypes.slice().sort((a,b) => a.localeCompare(b)).map((type, idx) => // Zoradenie abecedne
                        React.createElement('option', { key: idx, value: type }, type)
                    )
                    )
                ),
                // Selectbox pre Balík
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'packageName', className: 'block text-sm font-medium text-gray-700' }, 'Balík'),
                    React.createElement('select', {
                        id: 'packageName',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: editedPackageName,
                        onChange: (e) => setEditedPackageName(e.target.value),
                        required: true
                    },
                    availablePackages.slice().sort().map((pkgName, idx) => // Zoradenie balíkov abecedne
                        React.createElement('option', { key: idx, value: pkgName }, pkgName)
                    )
                    )
                ),

                // Sekcia pre Tričká
                React.createElement(
                    'div',
                    null,
                    // Zmenené - odstránený dynamický text o počte tričiek/členov
                    React.createElement(
                        'div',
                        { className: 'mb-2' }, 
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700' }, 'Tričká'),
                    ),
                    tshirtEntries.map((tshirt, index) => (
                        React.createElement(
                            'div',
                            { key: index, className: 'flex items-center space-x-2 mb-2' },
                            React.createElement('select', {
                                className: 'mt-1 block w-1/2 border border-gray-300 rounded-md shadow-sm p-2',
                                value: tshirt.size,
                                onChange: (e) => handleTshirtSizeChange(index, e.target.value),
                                required: true
                            },
                            React.createElement('option', { value: '' }, 'Vyberte veľkosť'),
                            availableTshirtSizes.slice().sort().map((size, sIdx) => // Načítavanie veľkostí z nového miesta
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
                                required: true
                            }),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleRemoveTshirtEntry(index),
                                    className: 'flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500'
                                },
                                React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' }, React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M20 12H4' }))
                            )
                        )
                    )),
                    // Nový kontajner pre tlačidlo "+", vždy centrovaný horizontálne
                    React.createElement(
                        'div',
                        { className: 'flex justify-center mt-4' }, // Pridané mt-4 pre medzeru
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: handleAddTshirtEntry,
                                disabled: isAddTshirtButtonDisabled, // Zablokovanie tlačidla
                                className: `flex items-center justify-center w-8 h-8 rounded-full transition-colors focus:outline-none focus:ring-2
                                    ${isAddTshirtButtonDisabled
                                        ? 'bg-white border border-solid' // Biele pozadie s orámovaním
                                        : 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500'
                                    }`,
                                style: { 
                                    cursor: isAddTshirtButtonDisabled ? 'not-allowed' : 'pointer', // Zmena kurzoru
                                    borderColor: isAddTshirtButtonDisabled ? roleColor : 'transparent', // Farba orámovania
                                    color: isAddTshirtButtonDisabled ? roleColor : 'white', // Farba SVG ikony
                                }
                            },
                            React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' }, React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M12 6v6m0 0v6m0-6h6m-6 0H6' }))
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
                            onClick: () => setTimeout(() => onClose(), 0), // Obalenie onClose do setTimeout
                            className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            disabled: isSaveButtonDisabled,
                            className: `px-4 py-2 rounded-md transition-colors ${isSaveButtonDisabled ? 'bg-white text-current border border-current' : 'text-white'}`,
                            style: { 
                                backgroundColor: isSaveButtonDisabled ? 'white' : roleColor, 
                                color: isSaveButtonDisabled ? roleColor : 'white',
                                borderColor: isSaveButtonDisabled ? roleColor : 'transparent',
                                cursor: isSaveButtonDisabled ? 'not-allowed' : 'pointer'
                            }
                        },
                        'Uložiť zmeny'
                    )
                )
            )
        )
    );
}

// Komponent modálneho okna pre pridanie nového tímu
function AddTeamModal({ show, onClose, onAddTeam, userProfileData, availablePackages, availableAccommodationTypes, availableTshirtSizes, teamsData, availableCategories }) {
    const db = getFirestore();
    const [selectedCategory, setSelectedCategory] = React.useState('');
    const [teamNamePreview, setTeamNamePreview] = React.useState(''); // Predbežný názov tímu na zobrazenie
    const [arrivalType, setArrivalType] = React.useState('bez dopravy');
    const [arrivalHour, setArrivalHour] = React.useState('');
    const [arrivalMinute, setArrivalMinute] = React.useState('');
    const [accommodationType, setAccommodationType] = React.useState('bez ubytovania'); // Predvolená hodnota
    const [packageName, setPackageName] = React.useState(availablePackages.length > 0 ? availablePackages.sort()[0] : ''); // Predvolená hodnota
    const [tshirtEntries, setTshirtEntries] = React.useState([]);

    const clubName = userProfileData?.clubName || 'Neznámy klub';
    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';

    // Reset stavov pri otvorení/zatvorení modalu
    React.useEffect(() => {
        if (show) {
            setSelectedCategory('');
            setTeamNamePreview('');
            setArrivalType('bez dopravy');
            setArrivalHour('');
            setArrivalMinute('');
            setAccommodationType('bez ubytovania');
            setPackageName(availablePackages.length > 0 ? availablePackages.sort()[0] : '');
            setTshirtEntries([]);
        }
    }, [show, availablePackages]);

    // Logika pre odvodenie názvu tímu
    React.useEffect(() => {
        if (selectedCategory && clubName !== 'Neznámy klub' && teamsData) {
            const teamsInSelectedCategory = teamsData[selectedCategory] || [];
            
            const clubTeamsInThisCategory = teamsInSelectedCategory.filter(team => 
                team.clubName === clubName && team.categoryName === selectedCategory
            );

            let nextSuffixChar = 'A';
            const existingSuffixes = new Set();

            clubTeamsInThisCategory.forEach(team => {
                const match = team.teamName.match(new RegExp(`${clubName}\\s*([A-Z])$`));
                if (match) {
                    existingSuffixes.add(match[1]);
                }
            });

            // Nájdite najmenšie nepoužité písmeno ako príponu
            while (existingSuffixes.has(nextSuffixChar)) {
                nextSuffixChar = String.fromCharCode(nextSuffixChar.charCodeAt(0) + 1);
            }
            setTeamNamePreview(`${clubName} ${nextSuffixChar}`);
        } else {
            setTeamNamePreview('');
        }
    }, [selectedCategory, clubName, teamsData]);

    const totalMembersInTeam = 0; // Nový tím má na začiatku 0 členov
    const totalTshirtsQuantity = tshirtEntries.reduce((sum, entry) => sum + (parseInt(entry.quantity, 10) || 0), 0);
    const allTshirtSizesSelected = tshirtEntries.every(tshirt => tshirt.size !== '');
    
    // Tlačidlo "Uložiť" je neaktívne, ak nie je vybraná kategória, vygenerovaný názov tímu, 
    // alebo ak sa počet tričiek nezhoduje s počtom členov (čo je 0 pre nový tím)
    const isSaveButtonDisabled = !selectedCategory || !teamNamePreview || totalTshirtsQuantity !== totalMembersInTeam || !allTshirtSizesSelected;
    const isAddTshirtButtonDisabled = totalTshirtsQuantity === totalMembersInTeam; // Zablokované, ak je 0 členov (pre nový tím)

    const showArrivalTimeInputs = arrivalType === 'verejná doprava - vlak' || arrivalType === 'verejná doprava - autobus';

    const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

    const handleAddTshirtEntry = () => {
        setTshirtEntries([...tshirtEntries, { size: '', quantity: 1 }]);
    };

    const handleRemoveTshirtEntry = (index) => {
        setTshirtEntries(tshirtEntries.filter((_, i) => i !== index));
    };

    const handleTshirtSizeChange = (index, newSize) => {
        const updatedEntries = [...tshirtEntries];
        updatedEntries[index].size = newSize;
        setTshirtEntries(updatedEntries);
    };

    const handleTshirtQuantityChange = (index, newQuantity) => {
        const updatedEntries = [...tshirtEntries];
        updatedEntries[index].quantity = Math.max(1, parseInt(newQuantity, 10) || 1);
        setTshirtEntries(updatedEntries);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isSaveButtonDisabled) {
            showLocalNotification('Prosím, vyplňte kategóriu, uistite sa, že počet tričiek sa zhoduje s počtom členov tímu (0 pre nový tím) a sú vybraté všetky veľkosti tričiek.', 'error');
            return;
        }

        let finalArrivalTime = '';
        if (arrivalType === 'verejná doprava - vlak' || arrivalType === 'verejná doprava - autobus') {
            finalArrivalTime = `${arrivalHour.padStart(2, '0')}:${arrivalMinute.padStart(2, '0')}`;
        }

        const filteredTshirtEntries = tshirtEntries.filter(t => t.size && t.quantity && parseInt(t.quantity, 10) > 0)
                                                    .map(t => ({ ...t, quantity: parseInt(t.quantity, 10) }));

        // Načítanie detailov balíka pre informácie o jedle a cene
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
            teamName: teamNamePreview, // Použijeme už vygenerovaný názov
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
        await onAddTeam(newTeamData); // Zavoláme funkciu na pridanie tímu z rodičovského komponentu
        setTimeout(() => onClose(), 0);
    };

    if (!show) return null;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center' },
        React.createElement(
            'div',
            { className: 'relative p-8 bg-white w-full max-w-md mx-auto rounded-lg shadow-lg' },
            React.createElement(
                'div',
                { className: `flex justify-between items-center text-white p-4 -mx-8 -mt-8 mb-4 rounded-t-lg`, style: { backgroundColor: roleColor } },
                React.createElement('h3', { className: 'text-2xl font-semibold' }, 'Pridať nový tím'),
                React.createElement(
                    'button',
                    { onClick: () => setTimeout(() => onClose(), 0), className: 'text-white hover:text-gray-200 text-3xl leading-none font-semibold' },
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
                        onChange: (e) => setSelectedCategory(e.target.value),
                        required: true
                    },
                    React.createElement('option', { value: '' }, 'Vyberte kategóriu'),
                    availableCategories.sort().map((cat, idx) => (
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
                // Selectbox pre Typ dopravy
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'arrivalType', className: 'block text-sm font-medium text-gray-700' }, 'Typ dopravy'),
                    React.createElement('select', {
                        id: 'arrivalType',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: arrivalType,
                        onChange: (e) => setArrivalType(e.target.value),
                        required: true
                    },
                    React.createElement('option', { value: 'bez dopravy' }, 'bez dopravy'),
                    React.createElement('option', { value: 'verejná doprava - autobus' }, 'verejná doprava - autobus'),
                    React.createElement('option', { value: 'verejná doprava - vlak' }, 'verejná doprava - vlak'),
                    React.createElement('option', { value: 'vlastná doprava' }, 'vlastná doprava')
                    )
                ),
                // Podmienené zobrazenie selectboxov pre čas príchodu
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
                                onChange: (e) => setArrivalHour(e.target.value),
                                required: true
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
                                onChange: (e) => setArrivalMinute(e.target.value),
                                required: true
                            },
                            React.createElement('option', { value: '' }, '-- Minúta --'), 
                            minuteOptions.map((minute) =>
                                React.createElement('option', { key: minute, value: minute }, minute)
                            )
                            )
                        )
                    )
                ),
                // Selectbox pre Typ ubytovania
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'accommodationType', className: 'block text-sm font-medium text-gray-700' }, 'Typ ubytovania'),
                    React.createElement('select', {
                        id: 'accommodationType',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: accommodationType,
                        onChange: (e) => setAccommodationType(e.target.value),
                        required: true
                    },
                    React.createElement('option', { value: 'bez ubytovania' }, 'bez ubytovania'), 
                    availableAccommodationTypes.slice().sort((a,b) => a.localeCompare(b)).map((type, idx) => 
                        React.createElement('option', { key: idx, value: type }, type)
                    )
                    )
                ),
                // Selectbox pre Balík
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'packageName', className: 'block text-sm font-medium text-gray-700' }, 'Balík'),
                    React.createElement('select', {
                        id: 'packageName',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: packageName,
                        onChange: (e) => setPackageName(e.target.value),
                        required: true
                    },
                    availablePackages.slice().sort().map((pkgName, idx) => 
                        React.createElement('option', { key: idx, value: pkgName }, pkgName)
                    )
                    )
                ),

                // Sekcia pre Tričká (začínajú prázdne)
                React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'div',
                        { className: 'mb-2' }, 
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700' }, 'Tričká'),
                    ),
                    tshirtEntries.map((tshirt, index) => (
                        React.createElement(
                            'div',
                            { key: index, className: 'flex items-center space-x-2 mb-2' },
                            React.createElement('select', {
                                className: 'mt-1 block w-1/2 border border-gray-300 rounded-md shadow-sm p-2',
                                value: tshirt.size,
                                onChange: (e) => handleTshirtSizeChange(index, e.target.value),
                                required: true
                            },
                            React.createElement('option', { value: '' }, 'Vyberte veľkosť'),
                            availableTshirtSizes.slice().sort().map((size, sIdx) => 
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
                                required: true
                            }),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleRemoveTshirtEntry(index),
                                    className: 'flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500'
                                },
                                React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' }, React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M20 12H4' }))
                            )
                        )
                    )),
                    React.createElement(
                        'div',
                        { className: 'flex justify-center mt-4' }, 
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: handleAddTshirtEntry,
                                disabled: isAddTshirtButtonDisabled, 
                                className: `flex items-center justify-center w-8 h-8 rounded-full transition-colors focus:outline-none focus:ring-2
                                    ${isAddTshirtButtonDisabled
                                        ? 'bg-white border border-solid' 
                                        : 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500'
                                    }`,
                                style: { 
                                    cursor: isAddTshirtButtonDisabled ? 'not-allowed' : 'pointer', 
                                    borderColor: isAddTshirtButtonDisabled ? roleColor : 'transparent', 
                                    color: isAddTshirtButtonDisabled ? roleColor : 'white', 
                                }
                            },
                            React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' }, React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M12 6v6m0 0v6m0-6h6m-6 0H6' }))
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
                            onClick: () => setTimeout(() => onClose(), 0), 
                            className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            disabled: isSaveButtonDisabled,
                            className: `px-4 py-2 rounded-md transition-colors ${isSaveButtonDisabled ? 'bg-white text-current border border-current' : 'text-white'}`,
                            style: { 
                                backgroundColor: isSaveButtonDisabled ? 'white' : roleColor, 
                                color: isSaveButtonDisabled ? roleColor : 'white',
                                borderColor: isSaveButtonDisabled ? roleColor : 'transparent',
                                cursor: isSaveButtonDisabled ? 'not-allowed' : 'pointer'
                            }
                        },
                        'Uložiť tím'
                    )
                )
            )
        )
    );
}

// Main React component for the logged-in-rosters.html page
function RostersApp() {
  const auth = getAuth(); 
  const db = getFirestore();     

  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 
  const [teamsData, setTeamsData] = React.useState({}); // Nový stav pre dáta tímov
  const [showEditTeamModal, setShowEditTeamModal] = React.useState(false); // Stav pre modálne okno
  const [selectedTeam, setSelectedTeam] = React.useState(null); // Stav pre vybraný tím na úpravu
  const [availablePackages, setAvailablePackages] = React.useState([]); // Nový stav pre balíky z databázy
  const [availableAccommodationTypes, setAvailableAccommodationTypes] = React.useState([]); // Nový stav pre typy ubytovania
  const [availableTshirtSizes, setAvailableTshirtSizes] = React.useState([]); // Nový stav pre dostupné veľkosti tričiek
  const [showAddMemberTypeModal, setShowAddMemberTypeModal] = React.useState(false); // Stav pre modálne okno výberu typu člena
  const [showAddMemberDetailsModal, setShowAddMemberDetailsModal] = React.useState(false); // Stav pre modálne okno detailov člena
  const [memberTypeToAdd, setMemberTypeToAdd] = React.useState(null); // Typ člena, ktorý sa má pridať
  const [teamToAddMemberTo, setTeamToAddMemberTo] = React.useState(null); // Tím, do ktorého sa pridáva člen
  const [teamAccommodationTypeToAddMemberTo, setTeamAccommodationTypeToAddMemberTo] = React.useState(''); // Ubytovanie tímu pre nový modal
  const [showAddTeamModal, setShowAddTeamModal] = React.useState(false); // Nový stav pre modálne okno pridania tímu
  const [availableCategories, setAvailableCategories] = React.useState([]); // Nový stav pre dostupné kategórie


  // Loading stav pre používateľský profil
  const [loading, setLoading] = React.useState(true); 

  // Používateľské ID pre Firebase App ID
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  React.useEffect(() => {
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

  // Načítanie zoznamu balíkov z Firestore
  React.useEffect(() => {
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
                  console.log("RostersApp: Packages loaded:", packagesList);
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

  // Načítanie typov ubytovania z Firestore
  React.useEffect(() => {
      let unsubscribeAccommodation;
      if (db) {
          try {
              const accommodationDocRef = doc(db, 'settings', 'accommodation');
              unsubscribeAccommodation = onSnapshot(accommodationDocRef, (docSnapshot) => {
                  if (docSnapshot.exists()) {
                      const data = docSnapshot.data();
                      const types = data.types?.map(typeObj => typeObj.type) || [];
                      setAvailableAccommodationTypes(types);
                      console.log("RostersApp: Accommodation types loaded:", types);
                  } else {
                      console.log("RostersApp: Accommodation settings document not found.");
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

  // Načítanie dostupných veľkostí tričiek z Firestore
  React.useEffect(() => {
    let unsubscribeTshirtSizes;
    if (db) {
        try {
            const tshirtSizesDocRef = doc(db, 'settings', 'sizeTshirts'); // Zmenený názov dokumentu
            unsubscribeTshirtSizes = onSnapshot(tshirtSizesDocRef, (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    const sizes = data.sizes || []; // Predpokladáme pole stringov priamo
                    setAvailableTshirtSizes(sizes);
                    console.log("RostersApp: Tshirt sizes loaded:", sizes);
                } else {
                    console.log("RostersApp: Tshirt sizes settings document not found.");
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


  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db && isAuthReady) {
      console.log(`RostersApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      setLoading(true); 

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => { 
          if (docSnapshot.exists()) { 
            const userData = docSnapshot.data();
            console.log("RostersApp: Používateľský dokument existuje, dáta:", userData); // Log celej dátovej štruktúry
            setUserProfileData(userData);
            
            // Extrahovanie a nastavenie dát tímov
            if (userData.teams) {
                setTeamsData(userData.teams);
                // Extrakt kategórií z tímov a ich zoradenie abecedne
                setAvailableCategories(Object.keys(userData.teams).sort()); 
            } else {
                setTeamsData({}); // Ak teams neexistuje, nastavíme prázdny objekt
                setAvailableCategories([]);
            }

            setLoading(false);
          } else {
            console.warn("RostersApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
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
        setAvailableCategories([]);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("RostersApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, isAuthReady, auth]);


  if (!isAuthReady || !userProfileData) {
    // Ak autentifikácia alebo profil ešte nie sú pripravené, zobrazíme prázdnu stránku
    // alebo loader, ktorý je už v logged-in-rosters.html
    return null;
  }

  // Helper funkcia na konsolidáciu všetkých členov tímu do jedného poľa
  const getAllTeamMembers = (team) => {
    const members = [];

    // Hráči
    if (team.playerDetails && team.playerDetails.length > 0) {
      team.playerDetails.forEach(player => {
        members.push({
          type: 'Hráč',
          firstName: player.firstName,
          lastName: player.lastName,
          jerseyNumber: player.jerseyNumber,
          address: player.address // Pridanie adresy
        });
      });
    }

    // Členovia realizačného tímu (muži)
    if (team.menTeamMemberDetails && team.menTeamMemberDetails.length > 0) {
      team.menTeamMemberDetails.forEach(member => {
        members.push({
          type: 'Člen realizačného tímu (muž)',
          firstName: member.firstName,
          lastName: member.lastName,
          address: member.address // Pridanie adresy
        });
      });
    }

    // Členky realizačného tímu (ženy)
    if (team.womenTeamMemberDetails && team.womenTeamMemberDetails.length > 0) {
      team.womenTeamMemberDetails.forEach(member => {
        members.push({
          type: 'Člen realizačného tímu (žena)',
          firstName: member.firstName,
          lastName: member.lastName,
          address: member.address // Pridanie adresy
        });
      });
    }

    // Šofér (žena)
    if (team.driverDetailsFemale && team.driverDetailsFemale.length > 0) {
      team.driverDetailsFemale.forEach(driver => {
        members.push({
          type: 'Šofér (žena)',
          firstName: driver.firstName,
          lastName: driver.lastName,
          address: driver.address // Pridanie adresy
        });
      });
    }

    // Šofér (muž)
    if (team.driverDetailsMale && team.driverDetailsMale.length > 0) {
      team.driverDetailsMale.forEach(driver => {
        members.push({
          type: 'Šofér (muž)',
          firstName: driver.firstName,
          lastName: driver.lastName,
          address: driver.address // Pridanie adresy
        });
      });
    }

    return members;
  };

  // Prevod objektu teamsData na pole pre jednoduchšie mapovanie vo React komponente
  // A zoradenie kategórií podľa názvu abecedne
  const teamCategories = Object.entries(teamsData).sort((a, b) => a[0].localeCompare(b[0]));

  // Helper funkcia na skloňovanie slova "tím"
  const getTeamPluralization = (count) => {
    if (count === 1) {
      return 'tím';
    } else if (count >= 2 && count <= 4) {
      return 'tímy';
    } else {
      return 'tímov';
    }
  };

  // Funkcia pre otvorenie modálneho okna na úpravu tímu
  const handleOpenEditTeamModal = (team) => {
    setSelectedTeam({ ...team, categoryName: team.categoryName }); // Uložíme celý tím a jeho kategóriu
    setShowEditTeamModal(true);
  };

  // Funkcia pre uloženie zmien tímu
  const handleSaveTeam = async (updatedTeamData) => {
    if (!user || !user.uid) {
        showLocalNotification('Chyba: Používateľ nie je prihlásený.', 'error');
        return;
    }

    const originalPackageName = selectedTeam?.packageDetails?.name || '';
    const newPackageName = updatedTeamData.packageDetails.name;

    // Ak sa zmenil názov balíka, potrebujeme načítať nové detaily jedál a ID
    if (newPackageName !== originalPackageName) {
        try {
            const packagesRef = collection(db, 'settings', 'packages', 'list');
            const q = query(packagesRef, where('name', '==', newPackageName));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const packageDoc = querySnapshot.docs[0]; // Získame celý dokument
                const packageData = packageDoc.data();
                updatedTeamData.packageDetails.meals = packageData.meals || {};
                updatedTeamData.packageDetails.price = packageData.price || 0; // Aktualizovať aj cenu
                updatedTeamData.packageDetails.id = packageDoc.id; // Uložíme ID balíka
            } else {
                console.warn(`Package with name ${newPackageName} not found.`);
                updatedTeamData.packageDetails.meals = {}; // Ak balík neexistuje, vymazať jedlá
                updatedTeamData.packageDetails.price = 0; // Resetovať cenu
                updatedTeamData.packageDetails.id = null; // Resetovať ID balíka
            }
        } catch (error) {
            console.error("Error fetching new package details:", error);
            showLocalNotification('Nastala chyba pri načítavaní detailov nového balíka.', 'error');
            return; // Predčasné ukončenie, ak nastala chyba pri načítaní balíka
        }
    }


    const teamCategory = updatedTeamData.categoryName;
    const teamIndex = teamsData[teamCategory].findIndex(t => t.teamName === updatedTeamData.teamName);

    if (teamIndex !== -1) {
        const userDocRef = doc(db, 'users', user.uid);
        const currentTeams = { ...teamsData }; // Kópia existujúcich tímov

        // Vytvorenie novej štruktúry pre aktualizáciu konkrétneho tímu v rámci kategórie
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

  // Funkcia pre otvorenie prvého modálneho okna pre pridanie člena
  const handleOpenAddMemberTypeModal = (team) => {
    setTeamToAddMemberTo(team);
    setTeamAccommodationTypeToAddMemberTo(team.accommodation?.type || ''); // Uloženie typu ubytovania tímu
    setShowAddMemberTypeModal(true);
  };

  // Funkcia po výbere typu člena, otvorí druhé modálne okno
  const handleSelectMemberType = (type) => {
    setMemberTypeToAdd(type);
    setShowAddMemberTypeModal(false); // Zatvorí prvý modal
    setShowAddMemberDetailsModal(true); // Otvorí druhý modal
  };

  // Funkcia pre uloženie nového člena tímu
  const handleSaveNewMember = async (newMemberDetails) => {
    if (!user || !user.uid || !teamToAddMemberTo || !memberTypeToAdd) {
        showLocalNotification('Chyba: Chýbajú dáta pre pridanie člena.', 'error');
        return;
    }

    const teamCategory = teamToAddMemberTo.categoryName;
    const teamIndex = teamsData[teamCategory].findIndex(t => t.teamName === teamToAddMemberTo.teamName);

    if (teamIndex !== -1) {
        const userDocRef = doc(db, 'users', user.uid);
        const currentTeams = { ...teamsData };
        const updatedTeam = { ...currentTeams[teamCategory][teamIndex] };

        // Inicializácia polí, ak neexistujú
        if (!updatedTeam.playerDetails) updatedTeam.playerDetails = [];
        if (!updatedTeam.menTeamMemberDetails) updatedTeam.menTeamMemberDetails = [];
        if (!updatedTeam.womenTeamMemberDetails) updatedTeam.womenTeamMemberDetails = [];
        if (!updatedTeam.driverDetailsFemale) updatedTeam.driverDetailsFemale = [];
        if (!updatedTeam.driverDetailsMale) updatedTeam.driverDetailsMale = [];

        // Pridanie člena do správneho poľa
        switch (memberTypeToAdd) {
            case 'player':
                updatedTeam.playerDetails.push(newMemberDetails);
                updatedTeam.players = (updatedTeam.players || 0) + 1; // Aktualizácia počtu
                break;
            case 'womenTeamMember':
                updatedTeam.womenTeamMemberDetails.push(newMemberDetails);
                updatedTeam.womenTeamMembers = (updatedTeam.womenTeamMembers || 0) + 1;
                break;
            case 'menTeamMember':
                updatedTeam.menTeamMemberDetails.push(newMemberDetails);
                updatedTeam.menTeamMembers = (updatedTeam.menTeamMembers || 0) + 1;
                break;
            case 'driverFemale':
                updatedTeam.driverDetailsFemale.push(newMemberDetails);
                // Nemá samostatný počet driversFemale, použijeme dĺžku poľa
                break;
            case 'driverMale':
                updatedTeam.driverDetailsMale.push(newMemberDetails);
                // Nemá samostatný počet driversMale, použijeme dĺžku poľa
                break;
            default:
                console.warn("Neznámy typ člena na pridanie:", memberTypeToAdd);
                showLocalNotification('Chyba: Neznámy typ člena.', 'error');
                return;
        }
        
        currentTeams[teamCategory][teamIndex] = updatedTeam;

        try {
            await updateDoc(userDocRef, {
                teams: currentTeams
            });
            showLocalNotification('Člen tímu bol úspešne pridaný!', 'success');
        } catch (error) {
            console.error("Chyba pri pridávaní člena tímu:", error);
            showLocalNotification('Nastala chyba pri pridávaní člena tímu.', 'error');
        }
    } else {
        showLocalNotification('Chyba: Tím nebol nájdený pre pridanie člena.', 'error');
    }
  };

  // Funkcia pre pridanie nového tímu s premenovaním existujúcich
  const handleAddTeam = async (newTeamDataFromModal) => {
    if (!user || !user.uid || !userProfileData?.clubName) {
        showLocalNotification('Chyba: Používateľ nie je prihlásený alebo chýba názov klubu.', 'error');
        return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    // Vytvoríme hlbokú kópiu premenných, aby sme sa vyhli priamym mutáciám stavu
    const currentTeamsCopy = JSON.parse(JSON.stringify(teamsData)); 

    const selectedCategory = newTeamDataFromModal.categoryName;
    const clubName = userProfileData.clubName;

    // Inicializujeme kategóriu v kópii, ak ešte neexistuje
    if (!currentTeamsCopy[selectedCategory]) {
        currentTeamsCopy[selectedCategory] = [];
    }

    // Pripravíme nový tím s názvom vygenerovaným v modálnom okne (napr. "Môj Klub C")
    const newTeam = {
        ...newTeamDataFromModal,
        clubName: clubName,
        // Názov tímu (teamName) je už nastavený logikou teamNamePreview v modale
    };

    // Získame všetky tímy pre aktuálny klub v vybranej kategórii
    // a pridáme k nim nový tím pre reevaluáciu prípon
    let allClubTeamsInSelectedCategory = (currentTeamsCopy[selectedCategory] || [])
                                        .filter(team => team.clubName === clubName);

    allClubTeamsInSelectedCategory.push(newTeam);

    // Zoradíme tieto tímy abecedne podľa ich názvov.
    // Toto je kľúčové pre konzistentné prideľovanie prípon "A", "B", "C" atď.
    allClubTeamsInSelectedCategory.sort((a, b) => a.teamName.localeCompare(b.teamName));

    const updatedTeamsForCategory = [];
    for (let i = 0; i < allClubTeamsInSelectedCategory.length; i++) {
        const team = allClubTeamsInSelectedCategory[i];
        const newSuffix = String.fromCharCode('A'.charCodeAt(0) + i); // Generujeme príponu (A, B, C...)
        const newTeamName = `${clubName} ${newSuffix}`; // Vytvoríme nový názov tímu

        updatedTeamsForCategory.push({
            ...team,
            teamName: newTeamName // Priradíme nový názov
        });
    }

    // Teraz nahradíme tímy patriace k tomuto klubu v kópii pre vybranú kategóriu,
    // pričom zachováme ostatné tímy (ak existujú), ktoré do tohto klubu v tejto kategórii nepatria.
    const otherTeamsInSelectedCategory = (currentTeamsCopy[selectedCategory] || [])
                                            .filter(team => team.clubName !== clubName);

    currentTeamsCopy[selectedCategory] = [...otherTeamsInSelectedCategory, ...updatedTeamsForCategory];

    // Aktualizujeme celé pole 'teams' v dokumente používateľa vo Firestore
    try {
        await updateDoc(userDocRef, {
            teams: currentTeamsCopy
        });
        showLocalNotification('Nový tím bol úspešne pridaný a názvy tímov aktualizované!', 'success');
        setShowAddTeamModal(false); // Zatvoríme modálne okno po úspešnom pridaní
    } catch (error) {
        console.error("Chyba pri pridávaní nového tímu a aktualizácii názvov:", error);
        showLocalNotification('Nastala chyba pri pridávaní nového tímu.', 'error');
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
              React.createElement('div', { key: categoryName, className: 'space-y-4 w-full' }, 
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
                                className: 'flex items-center space-x-2 px-4 py-2 rounded-full bg-white text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white hover:bg-gray-100',
                                'aria-label': 'Upraviť tím',
                                style: { color: getRoleColor(userProfileData?.role) }
                            },
                            React.createElement(
                                'svg',
                                { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
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
                      

                      allMembers.length > 0 && (
                        React.createElement('div', { className: 'mt-4 px-6 w-full' }, 
                          React.createElement('h4', { className: 'text-lg font-bold text-gray-800 mb-3' }, 'Zoznam členov:'),
                          React.createElement('div', { className: 'overflow-x-auto w-full' }, 
                            React.createElement('table', { className: 'min-w-full bg-white border border-gray-200 rounded-lg' },
                              React.createElement('thead', null,
                                React.createElement('tr', { className: 'bg-gray-100 text-left text-sm font-medium text-gray-600 uppercase tracking-wider' },
                                  [
                                    React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Typ člena'),
                                    React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Číslo dresu'),
                                    React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Meno'),
                                    React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Priezvisko'),
                                    shouldShowAddressColumn && React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Adresa'),
                                  ].filter(Boolean) 
                                )
                              ),
                              React.createElement('tbody', { className: 'divide-y divide-gray-200' },
                                allMembers.map((member, mIndex) => (
                                  React.createElement('tr', { key: mIndex, className: 'hover:bg-gray-50' },
                                    [
                                      React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.type),
                                      React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-600' }, member.jerseyNumber || '-'),
                                      React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.firstName || '-'),
                                      React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.lastName || '-'),
                                      shouldShowAddressColumn && React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, formatAddress(member.address)),
                                    ].filter(Boolean) 
                                  )
                                ))
                              )
                            )
                          ),
                          React.createElement(
                            'div',
                            { className: 'flex justify-center mt-4' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleOpenAddMemberTypeModal({ ...team, categoryName: categoryName }),
                                    className: 'flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
                                    'aria-label': 'Pridať člena tímu'
                                },
                                React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' }, React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M12 6v6m0 0v6m0-6h6m-6 0H6' }))
                            )
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
      // Tlačidlo pre pridanie nového tímu na konci stránky
      userProfileData && React.createElement(
          'div',
          { className: 'flex justify-center mt-8 pb-8' },
          React.createElement(
              'button',
              {
                  type: 'button',
                  onClick: () => setShowAddTeamModal(true),
                  className: `flex items-center space-x-2 px-6 py-3 rounded-full text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#9333EA] hover:bg-opacity-90`,
                  style: { backgroundColor: getRoleColor(userProfileData?.role) },
                  'aria-label': 'Pridať nový tím'
              },
              React.createElement(
                  'svg',
                  { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M12 6v6m0 0v6m0-6h6m-6 0H6' })
              ),
              React.createElement('span', { className: 'font-semibold' }, 'Pridať nový tím')
          )
      ),

      // Modálne okno pre úpravu tímu
      selectedTeam && React.createElement(
        EditTeamModal,
        {
          show: showEditTeamModal,
          onClose: () => setShowEditTeamModal(false),
          teamData: selectedTeam,
          onSaveTeam: handleSaveTeam,
          userProfileData: userProfileData, // Pre farbu nadpisu
          availablePackages: availablePackages, // Odovzdanie zoznamu balíkov
          availableAccommodationTypes: availableAccommodationTypes, // Odovzdanie typov ubytovania
          availableTshirtSizes: availableTshirtSizes // Odovzdanie dostupných veľkostí tričiek
        }
      ),
      // Modálne okno pre výber typu člena
      React.createElement(
        AddMemberTypeModal,
        {
          show: showAddMemberTypeModal,
          onClose: () => setShowAddMemberTypeModal(false),
          onSelectMemberType: handleSelectMemberType,
          userProfileData: userProfileData
        }
      ),
      // Modálne okno pre detaily člena
      React.createElement(
        AddMemberDetailsModal,
        {
          show: showAddMemberDetailsModal,
          onClose: () => setShowAddMemberDetailsModal(false),
          onSaveMember: handleSaveNewMember,
          memberType: memberTypeToAdd,
          userProfileData: userProfileData,
          teamAccommodationType: teamAccommodationTypeToAddMemberTo // Odovzdanie typu ubytovania
        }
      ),
      // Modálne okno pre pridanie nového tímu
      React.createElement(
        AddTeamModal,
        {
            show: showAddTeamModal,
            onClose: () => setShowAddTeamModal(false),
            onAddTeam: handleAddTeam, // Funkcia na pridanie tímu
            userProfileData: userProfileData,
            availablePackages: availablePackages,
            availableAccommodationTypes: availableAccommodationTypes,
            availableTshirtSizes: availableTshirtSizes,
            teamsData: teamsData, // Pre logiku generovania názvu tímu
            availableCategories: availableCategories // Pre selectbox kategórie
        }
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.RostersApp = RostersApp;

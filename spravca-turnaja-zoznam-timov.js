import {db, clubsCollectionRef, categoriesCollectionRef, groupsCollectionRef, openModal, closeModal, populateCategorySelect, doc, getDocs, query, where, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, showMessage, showConfirmation} from './spravca-turnaja-common.js';

const teamCreationModal = document.getElementById('teamCreationModal');
const teamCreationModalClose = teamCreationModal ? teamCreationModal.querySelector('.close') : null;
const teamCreationForm = document.getElementById('teamCreationForm');
const createdTeamsTableBody = document.getElementById('createdTeamsTableBody');
const createdTeamsTableHeader = document.getElementById('createdTeamsTableHeader');
const clubModal = document.getElementById('clubModal');
const clubModalClose = clubModal ? clubModal.querySelector('.close') : null;
const clubModalTitle = document.getElementById('clubModalTitle');
const clubFormContent = document.getElementById('clubFormContent');
const clubFilterContent = document.getElementById('clubFilterContent');
const clubForm = document.getElementById('clubForm');
const clubNameField = document.getElementById('clubNameField');
const clubNameInput = document.getElementById('clubName');
const clubAssignmentFields = document.getElementById('clubAssignmentFields');
const clubCategorySelect = document.getElementById('clubCategorySelect');
const clubGroupSelect = document.getElementById('clubGroupSelect');
const orderInGroupInput = document.getElementById('orderInGroup');
const unassignedClubField = document.getElementById('unassignedClubField');
const unassignedClubSelect = document.getElementById('unassignedClubSelect');
const filterModalTitle = document.getElementById('filterModalTitle');
const filterSelect = document.getElementById('filterSelect');
const addButton = document.getElementById('addButton');
const clearFiltersButton = document.getElementById('clearFiltersButton');
const groupTypeFilterButtons = document.getElementById('groupTypeFilterButtons'); // Referencia na kontajner tlačidiel typu skupiny

let allAvailableCategories = [];
let allAvailableGroups = [];
let allTeams = [];
let teamsToDisplay = []; // Toto pole bude obsahovať tímy aktuálne zobrazené v tabuľke po filtrovaní
let editingClubId = null;
let currentClubModalMode = null;
let currentFilters = {
    teamName: null,
    category: null,
    group: null,
    groupType: null // Filter podľa typu skupiny
};
let currentSort = {
    column: null,
    direction: 'asc'
};

// Mapa pre preklad typov skupín z formátu DB na zobrazenie s diakritikou
const groupTypeDisplayMap = {
    "Zakladna skupina": "Základná skupina",
    "Nadstavbova skupina": "Nadstavbová skupina",
    "Skupina o umiestnenie": "Skupina o umiestnenie"
};

/**
 * Parsuje plný názov tímu a extrahuje prefix kategórie a základný názov.
 * @param {string} fullTeamName - Plný názov tímu.
 * @returns {{categoryPrefix: string|null, baseName: string}} Objekt s prefixom kategórie a základným názvom.
 */
function parseTeamName(fullTeamName) {
    if (!fullTeamName || typeof fullTeamName !== 'string') {
        return { categoryPrefix: null, baseName: fullTeamName || '' };
    }
    const parts = fullTeamName.split(' - ');
    if (parts.length >= 2) {
        const categoryPrefix = parts[0].trim();
        const category = allAvailableCategories.find(cat => (cat.name || cat.id).trim().toLowerCase() === categoryPrefix.toLowerCase());
        if (category) {
            const baseName = parts.slice(1).join(' - ').trim();
            return { categoryPrefix: category.name || category.id, baseName };
        }
    }
    return { categoryPrefix: null, baseName: fullTeamName.trim() };
}

/**
 * Vyčistí názov tímu pre účely filtrovania (odstráni suffixy ako A, B, C, ak ide o jedno písmeno).
 * @param {string} teamName - Názov tímu.
 * @returns {string} Vyčistený názov tímu.
 */
function getCleanedTeamNameForFilter(teamName) {
    if (!teamName || typeof teamName !== 'string') {
        return '';
    }
    let cleanedName = teamName.trim();
    // Regex na odstránenie medzery a PRESNE JEDNÉHO veľkého písmena na konci (napr. " A", " B", " C")
    const suffixRegex = /\s+[A-Z]$/i; // Zmenené z /\s+[A-Z]+$/i
    if (suffixRegex.test(cleanedName)) {
        cleanedName = cleanedName.replace(suffixRegex, '');
    }
    return cleanedName;
}

/**
 * Získa unikátne základné názvy tímov pre filter.
 * @param {Array<object>} teams - Pole objektov tímov.
 * @returns {Array<string>} Pole unikátnych základných názvov tímov.
 */
function getUniqueTeamNamesForFilter(teams) {
    const baseNames = teams.map(team => getCleanedTeamNameForFilter(team.name || team.id))
                           .filter(name => name && name.trim() !== '');
    return [...new Set(baseNames)].sort((a, b) => a.localeCompare(b, 'sk-SK'));
}

/**
 * Získa unikátne názvy kategórií tímov pre filter.
 * @param {Array<object>} teams - Pole objektov tímov (teamsToDisplay).
 * @param {Array<object>} categories - Pole všetkých objektov kategórií (allAvailableCategories).
 * @returns {Array<object>} Pole objektov {id, name} unikátnych kategórií.
 */
function getUniqueTeamCategories(teams, categories) {
    const uniqueCategoryMap = new Map(); // Key: normalized category name, Value: {id, name} object

    // Pridaj "Neznáma kategória" možnosť, ak nejaký tím nemá priradenú kategóriu
    const hasUnknownCategory = teams.some(team => team.categoryId === null || typeof team.categoryId === 'undefined' || (typeof team.categoryId === 'string' && team.categoryId.trim() === ''));
    if (hasUnknownCategory) {
        uniqueCategoryMap.set('neznáma kategória', { id: null, name: 'Neznáma kategória' });
    }

    teams.forEach(team => {
        if (team.categoryId && typeof team.categoryId === 'string' && team.categoryId.trim() !== '') {
            const category = categories.find(cat => cat.id === team.categoryId);
            let categoryNameForDisplay;
            let categoryIdForValue;

            if (category) {
                categoryNameForDisplay = category.name || category.id;
                categoryIdForValue = category.id;
            } else {
                // Fallback pre kategórie, ktoré sa nenašli v allAvailableCategories (nekonzistentné dáta)
                categoryNameForDisplay = team.categoryId; // Použi ID ako názov, ak sa nenašlo
                categoryIdForValue = team.categoryId;
            }

            // Ensure consistent trimming and lowercasing for the map key
            const normalizedCategoryName = (categoryNameForDisplay || '').trim().toLowerCase();
            if (!uniqueCategoryMap.has(normalizedCategoryName)) {
                uniqueCategoryMap.set(normalizedCategoryName, { id: categoryIdForValue, name: categoryNameForDisplay });
            }
        }
    });

    const categoryOptions = Array.from(uniqueCategoryMap.values());

    // Sort by name, with "Neznáma kategória" (id: null) always at the top
    return categoryOptions.sort((a, b) => {
        if (a.id === null) return -1; // "Neznáma kategória" comes first
        if (b.id === null) return 1;
        return (a.name || '').localeCompare((b.name || ''), 'sk-SK');
    });
}

/**
 * Získa unikátne názvy skupín tímov pre filter.
 * @param {Array<object>} teams - Pole objektov tímov (teamsToDisplay).
 * @param {Array<object>} groups - Pole všetkých objektov skupín (allAvailableGroups).
 * @returns {Array<object>} Pole objektov {id, name} unikátnych skupín.
 */
function getUniqueTeamGroups(teams, groups) {
    const uniqueGroupMap = new Map(); // Key: normalized group name, Value: {id, name} object

    // Pridaj "Nepriradené" možnosť, ak nejaký tím nemá priradenú skupinu
    const hasUnassigned = teams.some(team => !team.groupId || (typeof team.groupId === 'string' && team.groupId.trim() === ''));
    if (hasUnassigned) {
        uniqueGroupMap.set('nepriradené', { id: null, name: 'Nepriradené' });
    }

    teams.forEach(team => {
        if (team.groupId && typeof team.groupId === 'string' && team.groupId.trim() !== '') {
            const group = groups.find(g => g.id === team.groupId);
            let groupNameForDisplay;
            let groupIdForValue;

            if (group) {
                groupNameForDisplay = group.name || group.id;
                groupIdForValue = group.id;
            } else {
                // Fallback pre skupiny, ktoré sa nenašli v allAvailableGroups (nekonzistentné dáta)
                // Try to derive name from ID, if it's in "category - name" format
                const parts = team.groupId.split(' - ');
                groupNameForDisplay = (parts.length > 1) ? parts.slice(1).join(' - ').trim() : team.groupId;
                groupIdForValue = team.groupId; // Use the original ID for the value
            }

            // Ensure consistent trimming and lowercasing for the map key
            const normalizedGroupName = (groupNameForDisplay || '').trim().toLowerCase();
            
            // Only add if not already present by normalized name
            if (!uniqueGroupMap.has(normalizedGroupName)) {
                uniqueGroupMap.set(normalizedGroupName, { id: groupIdForValue, name: groupNameForDisplay });
            }
        }
    });

    const groupOptions = Array.from(uniqueGroupMap.values());

    // Sort by name, with "Nepriradené" (id: null) always at the top
    return groupOptions.sort((a, b) => {
        if (a.id === null) return -1; // "Nepriradené" comes first
        if (b.id === null) return 1;
        return (a.name || '').localeCompare((b.name || ''), 'sk-SK');
    });
}

/**
 * Načíta všetky kategórie z Firestore a uloží ich do allAvailableCategories.
 */
async function loadAllCategoriesForDynamicSelects() {
    allAvailableCategories = [];
    try {
        const querySnapshot = await getDocs(categoriesCollectionRef);
        querySnapshot.forEach((doc) => {
            const categoryData = doc.data();
            if (categoryData && typeof categoryData.name === 'string' && categoryData.name.trim() !== '') {
                allAvailableCategories.push({ id: doc.id, name: categoryData.name.trim() });
            } else {
                // Ak názov chýba, použijeme ID ako názov
                allAvailableCategories.push({ id: doc.id, name: doc.id });
            }
        });
        allAvailableCategories.sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'sk-SK'));
    } catch (e) {
        await showMessage('Chyba', "Nepodarilo sa načítať kategórie.");
        allAvailableCategories = [];
    }
}

async function loadAllGroups() {
    allAvailableGroups = [];
    try {
        const querySnapshot = await getDocs(groupsCollectionRef);
        querySnapshot.forEach((doc) => {
            const groupData = doc.data();
            if (groupData && typeof groupData.name === 'string' && groupData.name.trim() !== '') {
                allAvailableGroups.push({ id: doc.id, name: groupData.name.trim(), categoryId: groupData.categoryId, type: groupData.type || "Zakladna skupina" }); // Pridaný typ
            } else {
                // Ak názov chýba, použijeme ID ako názov
                allAvailableGroups.push({ id: doc.id, name: doc.id, categoryId: groupData.categoryId, type: groupData.type || "Zakladna skupina" }); // Pridaný typ
            }
        });
        allAvailableGroups.sort((a, b) => {
            const nameA = (a.name || a.id) || '';
            const nameB = (b.name || b.id) || '';
            return nameA.localeCompare(nameB, 'sk-SK');
        });
    } catch (e) {
        await showMessage('Chyba', "Nepodarilo sa načítať skupiny.");
        allAvailableGroups = [];
        if (clubGroupSelect) {
            clubGroupSelect.innerHTML = '<option value="">-- Chyba pri načítaní skupín --</option>';
            clubGroupSelect.disabled = true;
        }
    }
}

/**
 * Naplní select element skupinami, voliteľne filtrovanými podľa kategórie.
 * @param {HTMLSelectElement} selectElement - Select element, ktorý sa má naplniť.
 * @param {string} selectedId - ID aktuálne vybranej skupiny.
 * @param {Array<object>} availableGroups - Pole všetkých dostupných skupín.
 * @param {string|null} categoryId - ID kategórie, podľa ktorej sa majú skupiny filtrovať.
 */
function populateGroupSelectForClubModal(selectElement, selectedId = '', availableGroups, categoryId = null) {
    if (!selectElement) {
        return;
    }
    selectElement.innerHTML = '<option value="">-- Vyberte skupinu --</option>';
    const filteredGroups = categoryId
        ? availableGroups.filter(group => group.categoryId === categoryId)
        : availableGroups;

    const sortedFilteredGroups = filteredGroups.sort((a, b) => {
        const nameA = (a.name || a.id) || '';
        const nameB = (b.name || b.id) || '';
        return nameA.localeCompare(nameB, 'sk-SK');
    });

    if (sortedFilteredGroups.length === 0) {
        const category = allAvailableCategories.find(cat => cat.id === categoryId);
        const categoryName = category ? category.name : categoryId; // Používame názov kategórie
        const option = document.createElement('option');
        option.value = "";
        option.textContent = categoryId && !categoryId.startsWith('--') ? ` -- Žiadne skupiny v kategórii "${categoryName}" --` : `-- Vyberte skupinu --`;
        option.disabled = true;
        selectElement.appendChild(option);
        selectElement.disabled = true;
    } else {
        sortedFilteredGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            const displayedGroupName = group.name || group.id; // Zobrazujeme name, ak existuje
            option.textContent = displayedGroupName;
            selectElement.appendChild(option);
        });
        selectElement.disabled = false;
        if (selectedId && selectElement.querySelector(`option[value="${selectedId}"]`)) {
            selectElement.value = selectedId;
        } else {
            selectElement.value = "";
        }
    }
}

/**
 * Naplní select element nepriradenými klubmi.
 */
async function populateUnassignedClubsSelect() {
    if (!unassignedClubSelect) {
        return;
    }
    unassignedClubSelect.innerHTML = '<option value="">-- Vyberte nepriradený tím --</option>';
    unassignedClubSelect.disabled = true;
    try {
        const q = query(clubsCollectionRef, where("groupId", "==", null));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Žiadne nepriradené tímy";
            option.disabled = true;
            unassignedClubSelect.appendChild(option);
            unassignedClubSelect.disabled = true;
        } else {
            const unassignedTeams = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            unassignedTeams.sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'sk-SK'));
            unassignedTeams.forEach(team => {
                const option = document.createElement('option');
                option.value = team.id;
                option.textContent = team.name || team.id;
                option.dataset.categoryId = team.categoryId;
                unassignedClubSelect.appendChild(option);
            });
            unassignedClubSelect.disabled = false;
        }
    } catch (e) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "-- Chyba pri načítaní --";
        option.disabled = true;
        unassignedClubSelect.appendChild(option);
        unassignedClubSelect.disabled = true;
    }
}

/**
 * Resetuje stav modálneho okna klubu.
 */
function resetClubModal() {
    editingClubId = null;
    currentClubModalMode = null;
    if (clubForm) clubForm.reset();
    if (clubNameField) clubNameField.style.display = 'block';
    if (unassignedClubField) unassignedClubField.style.display = 'none';
    if (clubCategorySelect) {
        clubCategorySelect.innerHTML = '<option value="">-- Vyberte kategóriu --</option>';
        clubCategorySelect.disabled = true;
    }
    if (clubGroupSelect) {
        clubGroupSelect.innerHTML = '<option value="">-- Vyberte skupinu --</option>';
        clubGroupSelect.disabled = true; // Vždy disabled na začiatku
    }
    if (orderInGroupInput) {
        orderInGroupInput.value = '';
        orderInGroupInput.disabled = true;
        orderInGroupInput.removeAttribute('required');
    }
    if (unassignedClubSelect) {
        unassignedClubSelect.innerHTML = '<option value="">-- Vyberte nepriradený tím --</option>';
        unassignedClubSelect.disabled = true;
    }
    if (clubModalTitle) clubModalTitle.textContent = 'Upraviť tím / Priradiť klub';
    if (clubForm) {
        const submitButton = clubForm.querySelector('button[type="submit"]');
        if (submitButton) submitButton.textContent = 'Uložiť zmeny / Priradiť';
    }
    if (clubFilterContent) clubFilterContent.style.display = 'none';
    if (clubFormContent) clubFormContent.style.display = 'block';
    if (filterModalTitle) filterModalTitle.textContent = 'Filter';
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">-- Zobraziť všetko --</option>';
        filterSelect.value = "";
    }
}

/**
 * Pokúsi sa automaticky vybrať kategóriu na základe názvu tímu.
 * Ak nájde zhodu, nastaví select box a povolí/zakáže súvisiace polia.
 * @param {string} teamName - Aktuálny názov tímu z inputu.
 */
function attemptAutoSelectCategory(teamName) {
    let categoryToSelect = null;
    const teamNameLower = teamName.trim().toLowerCase();

    for (const category of allAvailableCategories) {
        const categoryNameLower = (category.name || category.id).trim().toLowerCase();
        // Check if the team name starts with the category name, followed by a space or hyphen, or is an exact match
        if (teamNameLower.startsWith(categoryNameLower)) {
            if (teamNameLower.length === categoryNameLower.length ||
                teamNameLower.charAt(categoryNameLower.length) === ' ' ||
                teamNameLower.charAt(categoryNameLower.length) === '-') {
                categoryToSelect = category.id;
                break; // Found a match, stop searching
            }
        }
    }

    // Set the category select value
    if (clubCategorySelect) {
        const currentSelectedValue = clubCategorySelect.value;
        const isCurrentlyAutoSelected = categoryToSelect && currentSelectedValue === categoryToSelect;
        const isDefaultEmpty = currentSelectedValue === '' && clubCategorySelect.options[clubCategorySelect.selectedIndex]?.textContent === '-- Vyberte kategóriu --';

        if (categoryToSelect) {
            // If a category is found, select it.
            clubCategorySelect.value = categoryToSelect;
            clubCategorySelect.disabled = false; // Enable if a category is selected
        } else if (!categoryToSelect && !isDefaultEmpty) {
            // If no category is found and a category was previously selected (not default empty),
            // and it was NOT an auto-selection based on the current input (meaning user manually selected it),
            // then we should NOT reset it.
            // If it was an auto-selection that no longer matches, or it's the default empty, then reset.
            const wasManuallySelected = allAvailableCategories.some(cat => cat.id === currentSelectedValue && !teamNameLower.startsWith((cat.name || cat.id).trim().toLowerCase()));
            if (!wasManuallySelected) {
                clubCategorySelect.value = ""; // Reset if no match or if it was an old auto-selection
                clubCategorySelect.disabled = allAvailableCategories.length === 0; // Disable if no categories available
            }
        } else if (!categoryToSelect && isDefaultEmpty) {
            // If no match and it's already default empty, just ensure disabled state is correct
            clubCategorySelect.disabled = allAvailableCategories.length === 0;
        }

        // Manually trigger change event to update dependent selects (group)
        const event = new Event('change');
        clubCategorySelect.dispatchEvent(event);
    }
}

/**
 * Nájde prvé dostupné poradie v skupine (najmenšie celé číslo > 0).
 * @param {string} categoryId - ID kategórie.
 * @param {string} groupId - ID skupiny.
 * @param {string|null} excludeTeamId - ID tímu, ktorý sa má vylúčiť z kontroly (pri úprave).
 * @returns {Promise<number|null>} Prvé dostupné poradie alebo null, ak nastane chyba.
 */
async function findFirstAvailableOrderInGroup(categoryId, groupId, excludeTeamId = null) {
    if (!categoryId || !groupId) {
        return null;
    }

    try {
        const q = query(
            clubsCollectionRef,
            where('categoryId', '==', categoryId),
            where('groupId', '==', groupId)
        );
        const querySnapshot = await getDocs(q);
        const existingOrders = new Set();
        querySnapshot.forEach(doc => {
            if (doc.id !== excludeTeamId) { // Vylúčime aktuálne upravovaný tím
                const order = doc.data().orderInGroup;
                if (typeof order === 'number' && order > 0) {
                    existingOrders.add(order);
                }
            }
        });

        let order = 1;
        while (existingOrders.has(order)) {
            order++;
        }
        return order;
    } catch (e) {
        console.error("Chyba pri hľadaní dostupného poradia v skupine:", e);
        return null;
    }
}


/**
 * Otvorí modálne okno klubu v rôznych režimoch (priradenie, úprava, vytvorenie, filter).
 * @param {string|null} identifier - ID tímu (pre edit) alebo typ filtra (pre filter).
 * @param {string} mode - Režim modálneho okna ('assign', 'edit', 'create', 'filter').
 */
async function openClubModal(identifier = null, mode = 'assign') {
    if (!clubModal || !clubModalTitle || !clubFormContent || !clubFilterContent || !clubForm || !clubNameField || !clubAssignmentFields || !unassignedClubField || !clubNameInput || !clubCategorySelect || !clubGroupSelect || !orderInGroupInput || !unassignedClubSelect || !filterModalTitle || !filterSelect) {
        await showMessage('Chyba', "Nastala chyba pri otváraní modálu. Niektoré elementy používateľského rozhrania chýbajú.");
        return;
    }
    resetClubModal();
    if (unassignedClubSelect) unassignedClubSelect.onchange = null;
    if (clubCategorySelect) clubCategorySelect.onchange = null;
    if (clubGroupSelect) clubGroupSelect.onchange = null;
    if (filterSelect) filterSelect.onchange = null;

    editingClubId = (mode === 'edit') ? identifier : null;
    currentClubModalMode = mode;

    // Načítanie kategórií a skupín, ak ešte nie sú načítané
    if (allAvailableCategories.length === 0) {
        await loadAllCategoriesForDynamicSelects();
    }
    if (allAvailableGroups.length === 0) {
        await loadAllGroups();
    }

    // Pridanie listenera pre automatickú zmenu '/' na '⁄' A automatické nastavenie kategórie
    if (clubNameInput) {
        clubNameInput.removeEventListener('input', handleClubNameInput); // Odstrániť starý listener pre istotu
        clubNameInput.addEventListener('input', handleClubNameInput);
    }

    if (['assign', 'edit', 'create'].includes(mode)) {
        clubFormContent.style.display = 'block';
        clubFilterContent.style.display = 'none';

        if (mode === 'assign') {
            clubModalTitle.textContent = 'Priradiť nepriradený tím';
        } else if (mode === 'create') {
            clubModalTitle.textContent = 'Vytvoriť nový tím';
             if (clubForm) {
                  const submitButton = clubForm.querySelector('button[type="submit"]');
                  if (submitButton) submitButton.textContent = 'Vytvoriť tím';
             }
        } else if (mode === 'edit') {
            clubModalTitle.textContent = 'Upraviť tím';
             if (clubForm) {
                 const submitButton = clubForm.querySelector('button[type="submit"]')
                 if (submitButton) submitButton.textContent = 'Uložiť zmeny';
             }
        }

        if (mode === 'assign') {
            clubNameField.style.display = 'none';
            clubAssignmentFields.style.display = 'block';
            unassignedClubField.style.display = 'block';

            if (clubCategorySelect) clubCategorySelect.disabled = true;
            if (clubGroupSelect) clubGroupSelect.disabled = true; // Vždy disabled na začiatku
            if (orderInGroupInput) orderInGroupInput.disabled = true;

            clubCategorySelect.innerHTML = `<option value="">-- Kategória sa zobrazí po výbere tímu --</option>`;
            populateGroupSelectForClubModal(clubGroupSelect, null, allAvailableGroups, null);
            await populateUnassignedClubsSelect();

            if (unassignedClubSelect) {
                unassignedClubSelect.onchange = () => {
                    const selectedId = unassignedClubSelect.value;
                    const selectedOption = unassignedClubSelect.options[unassignedClubSelect.selectedIndex];
                    const categoryId = selectedOption ? selectedOption.dataset.categoryId : null;

                    if (selectedId && categoryId && !categoryId.startsWith('--')) {
                        const category = allAvailableCategories.find(cat => cat.id === categoryId);
                        const categoryName = category ? category.name : 'Neznáma kategória';
                        clubCategorySelect.innerHTML = `<option value="${categoryId}">${categoryName}</option>`;
                        if (clubCategorySelect) clubCategorySelect.disabled = true;
                        if (clubGroupSelect) clubGroupSelect.disabled = false; // Enable group select
                        populateGroupSelectForClubModal(clubGroupSelect, null, allAvailableGroups, categoryId);
                        if (orderInGroupInput) {
                            orderInGroupInput.disabled = true;
                            orderInGroupInput.value = '';
                            orderInGroupInput.removeAttribute('required');
                        }
                    } else {
                        clubCategorySelect.innerHTML = `<option value="">-- Kategória sa zobrazí po výbere tímu --</option>`;
                        if (clubCategorySelect) clubCategorySelect.disabled = true;
                        if (clubGroupSelect) clubGroupSelect.disabled = true; // Disable group select
                        clubGroupSelect.innerHTML = '<option value="">-- Vyberte skupinu --</option>';
                        if (orderInGroupInput) {
                            orderInGroupInput.disabled = true;
                            orderInGroupInput.value = '';
                            orderInGroupInput.removeAttribute('required');
                        }
                    }
                };
            }
            if (clubGroupSelect) {
                clubGroupSelect.onchange = async () => { // Zmena na async
                    const selectedGroupId = clubGroupSelect.value;
                    const selectedCategoryId = clubCategorySelect.value; // Získať vybranú kategóriu
                    if (selectedGroupId && selectedGroupId !== '' && !selectedGroupId.startsWith('--') && selectedCategoryId) {
                        if (orderInGroupInput) {
                            orderInGroupInput.disabled = false;
                            orderInGroupInput.setAttribute('required', 'required');
                            const availableOrder = await findFirstAvailableOrderInGroup(selectedCategoryId, selectedGroupId, editingClubId);
                            if (availableOrder !== null) {
                                orderInGroupInput.value = availableOrder;
                            } else {
                                orderInGroupInput.value = ''; // Reset if no order found or error
                            }
                            orderInGroupInput.focus();
                        }
                    } else {
                        if (orderInGroupInput) {
                            orderInGroupInput.disabled = true;
                            orderInGroupInput.value = '';
                            orderInGroupInput.removeAttribute('required');
                        }
                    }
                };
            }
        } else if (mode === 'edit' && identifier) {
            editingClubId = identifier;
            clubNameField.style.display = 'block';
            clubAssignmentFields.style.display = 'block';
            unassignedClubField.style.display = 'none';

            if (unassignedClubSelect) unassignedClubSelect.disabled = true;
            if (clubCategorySelect) clubCategorySelect.disabled = false;
            if (clubGroupSelect) clubGroupSelect.disabled = true; // Disabled by default for edit mode too
            
            try {
                const clubDocRef = doc(clubsCollectionRef, editingClubId);
                const clubDoc = await getDoc(clubDocRef);
                if (clubDoc.exists()) {
                    const clubData = clubDoc.data();
                    clubNameInput.value = clubData.name || ''; // Zobrazujeme name
                    clubNameInput.focus();

                    // Trigger input event to run handleClubNameInput (which includes attemptAutoSelectCategory)
                    clubNameInput.dispatchEvent(new Event('input'));

                    let categoryToSelect = clubCategorySelect.value; // Get the category that was potentially auto-selected by the input event

                    // If the category from DB was valid, prefer it. Otherwise, use auto-selected.
                    const isValidCategoryFromDB = allAvailableCategories.some(cat => cat.id === clubData.categoryId);
                    if (clubData.categoryId && isValidCategoryFromDB) {
                        categoryToSelect = clubData.categoryId;
                        populateCategorySelect(clubCategorySelect, categoryToSelect); // Re-populate to ensure it's set
                    } else {
                        // If DB category was invalid/missing, and auto-selection didn't find one, ensure default is shown
                        if (!categoryToSelect || categoryToSelect === '') {
                             populateCategorySelect(clubCategorySelect, null);
                        }
                    }


                    // Ak je vybratá kategória, povolíme a naplníme skupinu
                    if (categoryToSelect && categoryToSelect !== '' && !categoryToSelect.startsWith('--')) {
                        if (clubGroupSelect) clubGroupSelect.disabled = false; // Enable group select if category is valid
                        populateGroupSelectForClubModal(clubGroupSelect, clubData.groupId, allAvailableGroups, categoryToSelect);
                    } else {
                        if (clubGroupSelect) clubGroupSelect.disabled = true; // Keep disabled if no category
                        clubGroupSelect.innerHTML = '<option value="">-- Vyberte skupinu --</option>';
                    }

                    orderInGroupInput.value = (typeof clubData.orderInGroup === 'number' && clubData.orderInGroup > 0) ? clubData.orderInGroup : '';
                    if (orderInGroupInput) orderInGroupInput.removeAttribute('required');
                    if (orderInGroupInput) {
                        orderInGroupInput.disabled = !(clubData.groupId && typeof clubData.groupId === 'string' && clubData.groupId.trim() !== '');
                         if (!orderInGroupInput.disabled) {
                              orderInGroupInput.setAttribute('required', 'required');
                         }
                    }

                    // Listenery pre zmenu kategórie a skupiny
                    if (clubCategorySelect) {
                        clubCategorySelect.onchange = () => {
                            const selectedCategoryId = clubCategorySelect.value;
                            if (selectedCategoryId && selectedCategoryId !== '' && !selectedCategoryId.startsWith('--')) {
                                if (clubGroupSelect) clubGroupSelect.disabled = false; // Enables
                                populateGroupSelectForClubModal(clubGroupSelect, null, allAvailableGroups, selectedCategoryId);
                                if (orderInGroupInput) {
                                    orderInGroupInput.disabled = true;
                                    orderInGroupInput.value = '';
                                    orderInGroupInput.removeAttribute('required');
                                }
                            } else {
                                if (clubGroupSelect) clubGroupSelect.disabled = true; // Disables
                                clubGroupSelect.innerHTML = '<option value="">-- Vyberte skupinu --';
                                if (orderInGroupInput) {
                                    orderInGroupInput.disabled = true;
                                    orderInGroupInput.value = '';
                                    orderInGroupInput.removeAttribute('required');
                                }
                            }
                        };
                    }
                    if (clubGroupSelect) {
                        clubGroupSelect.onchange = async () => { // Zmena na async
                            const selectedGroupId = clubGroupSelect.value;
                            const selectedCategoryId = clubCategorySelect.value; // Získať vybranú kategóriu
                            if (selectedGroupId && selectedGroupId !== '' && !selectedGroupId.startsWith('--') && selectedCategoryId) {
                                if (orderInGroupInput) {
                                    orderInGroupInput.disabled = false;
                                    orderInGroupInput.setAttribute('required', 'required');
                                    const availableOrder = await findFirstAvailableOrderInGroup(selectedCategoryId, selectedGroupId, editingClubId);
                                    if (availableOrder !== null) {
                                        orderInGroupInput.value = availableOrder;
                                    } else {
                                        orderInGroupInput.value = ''; // Reset if no order found or error
                                    }
                                    orderInGroupInput.focus();
                                }
                            } else {
                                if (orderInGroupInput) {
                                    orderInGroupInput.disabled = true;
                                    orderInGroupInput.value = '';
                                    orderInGroupInput.removeAttribute('required');
                                }
                            }
                        };
                    }
                } else {
                    await showMessage('Chyba', "Tím na úpravu sa nenašiel.");
                    closeModal(clubModal);
                    displayCreatedTeams();
                    return;
                }
            } catch (e) {
                console.error("Chyba pri načítaní údajov tímu na úpravu:", e);
                await showMessage('Chyba', "Nepodarilo sa načítať údaje tímu na úpravu.");
                closeModal(clubModal);
                displayCreatedTeams();
                return;
            }
        } else if (mode === 'create') {
            clubNameField.style.display = 'block';
            clubAssignmentFields.style.display = 'block';
            unassignedClubField.style.display = 'none';
            if (unassignedClubSelect) unassignedClubSelect.disabled = true;
            if (clubCategorySelect) clubCategorySelect.disabled = false;
            if (clubGroupSelect) clubGroupSelect.disabled = true; // Always disabled on start
            if (orderInGroupInput) orderInGroupInput.disabled = true;

            // Initial population of categories (start with no selection)
            if (allAvailableCategories.length > 0) {
                populateCategorySelect(clubCategorySelect, null);
            } else {
                clubCategorySelect.innerHTML = '<option value="">-- Žiadne kategórie --</option>';
                clubCategorySelect.disabled = true;
            }
            clubGroupSelect.innerHTML = '<option value="">-- Vyberte skupinu --</option>';
            
            // Manually trigger initial auto-selection if there's pre-filled text (e.g., from browser autofill)
            // This will call handleClubNameInput, which in turn calls attemptAutoSelectCategory
            clubNameInput.dispatchEvent(new Event('input'));


            if (clubCategorySelect) {
                clubCategorySelect.onchange = () => {
                    const selectedCategoryId = clubCategorySelect.value;
                    if (selectedCategoryId && selectedCategoryId !== '' && !selectedCategoryId.startsWith('--')) {
                        if (clubGroupSelect) clubGroupSelect.disabled = false; // Enables
                        populateGroupSelectForClubModal(clubGroupSelect, null, allAvailableGroups, selectedCategoryId);
                        if (orderInGroupInput) {
                            orderInGroupInput.disabled = true;
                            orderInGroupInput.value = '';
                            orderInGroupInput.removeAttribute('required');
                        }
                    } else {
                        if (clubGroupSelect) clubGroupSelect.disabled = true; // Disables
                        clubGroupSelect.innerHTML = '<option value="">-- Vyberte skupinu --</option>';
                        if (orderInGroupInput) {
                            orderInGroupInput.disabled = true;
                            orderInGroupInput.value = '';
                            orderInGroupInput.removeAttribute('required');
                        }
                    }
                };
            }
            if (clubGroupSelect) {
                clubGroupSelect.onchange = async () => { // Zmena na async
                    const selectedGroupId = clubGroupSelect.value;
                    const selectedCategoryId = clubCategorySelect.value; // Získať vybranú kategóriu
                    if (selectedGroupId && selectedGroupId !== '' && !selectedGroupId.startsWith('--') && selectedCategoryId) {
                        if (orderInGroupInput) {
                            orderInGroupInput.disabled = false;
                            orderInGroupInput.setAttribute('required', 'required');
                            const availableOrder = await findFirstAvailableOrderInGroup(selectedCategoryId, selectedGroupId, editingClubId);
                            if (availableOrder !== null) {
                                orderInGroupInput.value = availableOrder;
                            } else {
                                orderInGroupInput.value = ''; // Reset if no order found or error
                            }
                            orderInGroupInput.focus();
                        }
                    } else {
                        if (orderInGroupInput) {
                            orderInGroupInput.disabled = true;
                            orderInGroupInput.value = '';
                            orderInGroupInput.removeAttribute('required');
                        }
                    }
                };
            }
            if (clubGroupSelect) clubGroupSelect.removeAttribute('required');
            if (orderInGroupInput) orderInGroupInput.removeAttribute('required');
            setTimeout(() => {
                if (clubNameInput) clubNameInput.focus();
            }, 0);
        } else {
            await showMessage('Chyba', "Vyskytla sa chyba pri otváraní modálu. Neplatný režim.");
            closeModal(clubModal);
            return;
        }
        setTimeout(() => {
            if (mode === 'assign' && unassignedClubSelect && !unassignedClubSelect.disabled) {
                unassignedClubSelect.focus();
            } else if (mode === 'edit' && clubNameInput) {
                clubNameInput.focus();
            } else if (mode === 'create' && clubNameInput) {
                clubNameInput.focus();
            }
        }, 100);
    } else if (mode === 'filter') {
        clubFormContent.style.display = 'none';
        clubFilterContent.style.display = 'block';
        const filterType = identifier;
        if (filterType === 'teamName') clubModalTitle.textContent = 'Filter podľa názvu tímu';
        else if (filterType === 'category') clubModalTitle.textContent = 'Filter podľa kategórie';
        else if (filterType === 'group') clubModalTitle.textContent = 'Filter podľa skupiny';
        else clubModalTitle.textContent = 'Filter';
        filterModalTitle.textContent = 'Vyberte hodnotu filtra';

        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">-- Zobraziť všetko --</option>'; // Táto možnosť by mala byť vždy prvá

            if (filterType === 'teamName') {
                const teamNames = getUniqueTeamNamesForFilter(teamsToDisplay); // Používame teamsToDisplay
                teamNames.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    filterSelect.appendChild(option);
                });
            } else if (filterType === 'category') {
                const uniqueCategories = getUniqueTeamCategories(teamsToDisplay, allAvailableCategories); // Používame teamsToDisplay
                uniqueCategories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id !== null ? cat.id : ''; // ID ako value, prázdny reťazec pre null
                    option.textContent = cat.name || cat.id || ''; // Názov ako text
                    filterSelect.appendChild(option);
                });
            } else if (filterType === 'group') {
                // Určenie, ktorú sadu tímov použiť pre generovanie možností skupín
                // Ak je aktívny filter kategórie, zobrazia sa iba skupiny relevantné pre danú kategóriu.
                // Inak sa zobrazia všetky unikátne skupiny zo všetkých tímov.
                let teamsForGroupOptions = allTeams;
                if (currentFilters.category !== null) {
                    teamsForGroupOptions = allTeams.filter(team => {
                        const teamCategoryId = team.categoryId;
                        if (currentFilters.category === null) {
                            return !teamCategoryId || (typeof teamCategoryId === 'string' && teamCategoryId.trim() === '');
                        } else {
                            return teamCategoryId === currentFilters.category;
                        }
                    });
                }
                
                const uniqueGroups = getUniqueTeamGroups(teamsForGroupOptions, allAvailableGroups);
                
                uniqueGroups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.id !== null ? group.id : ''; // ID ako value, prázdny reťazec pre null
                    option.textContent = group.name || group.id || ''; // Názov ako text
                    filterSelect.appendChild(option);
                });
            }

            // Nastavenie vybranej hodnoty filtra
            let selectedFilterValueForDisplay = currentFilters[filterType];
            let selectedOptionValue = '';

            if (filterType === 'teamName') {
                selectedOptionValue = selectedFilterValueForDisplay || '';
            } else if (filterType === 'category' || filterType === 'group') {
                if (selectedFilterValueForDisplay === null) {
                    selectedOptionValue = ''; // Pre "Neznáma kategória" / "Nepriradené" filter je ID null, ale value v selecte je prázdne
                } else {
                    selectedOptionValue = selectedFilterValueForDisplay;
                }
            }
            
            // Nastavíme vybranú hodnotu v selecte
            if (filterSelect.querySelector(`option[value="${selectedOptionValue}"]`)) {
                filterSelect.value = selectedOptionValue;
            } else {
                filterSelect.value = "";
            }

            filterSelect.onchange = () => {
                const selectedValue = filterSelect.value;
                let valueToStore = null;

                // Ak je selectedValue prázdny reťazec, znamená to "Zobraziť všetko" alebo "Neznáma kategória" / "Nepriradené"
                // V prípade kategórie/skupiny, ak je vybraná možnosť s prázdnou hodnotou, ale text je "Neznáma kategória" / "Nepriradené",
                // chceme uložiť null. Inak, ak je prázdny reťazec, znamená to zrušenie filtra.
                if (selectedValue === '') {
                    const selectedOption = filterSelect.options[filterSelect.selectedIndex];
                    if (filterType === 'category' && selectedOption && selectedOption.textContent === 'Neznáma kategória') {
                        valueToStore = null;
                    } else if (filterType === 'group' && selectedOption && selectedOption.textContent === 'Nepriradené') {
                        valueToStore = null;
                    } else {
                        valueToStore = null; // Pre "Zobraziť všetko" alebo akúkoľvek inú prázdnu hodnotu
                    }
                } else {
                    valueToStore = selectedValue;
                }

                if (filterType === 'category') {
                     if (currentFilters.category !== valueToStore) {
                          currentFilters.group = null; // Resetujeme filter skupiny, ak sa zmení kategória
                     }
                     currentFilters.category = valueToStore;
                } else if (filterType === 'group') {
                     currentFilters.group = valueToStore;
                } else {
                      currentFilters[filterType] = valueToStore;
                }
                closeModal(clubModal);
                displayCreatedTeams();
            };
            setTimeout(() => {
                filterSelect.focus();
            }, 0);
        }
    } else {
        await showMessage('Chyba', "Vyskytla sa chyba pri otváraní modálu. Neplatný režim.");
        closeModal(clubModal);
        return;
    }
    openModal(clubModal);
}

/**
 * Handler pre input event na clubNameInput. Nahradí '/' znakom '⁄'.
 * @param {Event} event - Objekt udalosti.
 */
function handleClubNameInput(event) {
    const input = event.target;
    if (input.value.includes('/')) {
        input.value = input.value.replace(/\//g, '⁄');
    }
    // Attempt to auto-select category whenever the input value changes
    attemptAutoSelectCategory(input.value);
}

if (clubForm) {
    clubForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const operationType = currentClubModalMode; // Používame currentClubModalMode
        let clubName = clubNameInput.value.trim();
        const selectedCategoryIdInModal = currentClubModalMode === 'assign' && unassignedClubSelect && unassignedClubSelect.value !== '' && !unassignedClubSelect.value.startsWith('--') && unassignedClubSelect.options[unassignedClubSelect.selectedIndex] ? unassignedClubSelect.options[unassignedClubSelect.selectedIndex].dataset.categoryId : (clubCategorySelect && clubCategorySelect.value !== '' && !clubCategorySelect.value.startsWith('--') ? clubCategorySelect.value : null);
        const selectedGroupIdInModal = clubGroupSelect && clubGroupSelect.value !== '' && !clubGroupSelect.value.startsWith('--') ? clubGroupSelect.value : null;
        let orderInGroup = (orderInGroupInput && orderInGroupInput.value !== '' && selectedGroupIdInModal) ? parseInt(orderInGroupInput.value, 10) : null;
        if (typeof orderInGroup !== 'number' || orderInGroup <= 0) {
            orderInGroup = null;
        }

        let confirmationTitle = '';
        let confirmationMessage = '';
        let clubIdToProcess = editingClubId; // Predvolené pre edit

        // Validácie a nastavenie potvrdzovacích správ
        if (operationType === 'create') {
            if (!clubName) {
                await showMessage('Chyba', "Zadajte názov tímu.");
                if (clubNameInput) clubNameInput.focus();
                return;
            }
            const qExistingName = query(clubsCollectionRef, where('name', '==', clubName), where('categoryId', '==', selectedCategoryIdInModal));
            const existingNameSnapshot = await getDocs(qExistingName);
            if (!existingNameSnapshot.empty) {
                const category = allAvailableCategories.find(cat => cat.id === selectedCategoryIdInModal);
                const categoryDisplayName = category ? category.name : selectedCategoryIdInModal;
                await showMessage('Upozornenie', `Tím s názvom "${clubName}" už v kategórii "${categoryDisplayName}" existuje. Prosím, zvoľte iný názov.`);
                if (clubNameInput) clubNameInput.focus();
                return;
            }
            // Kontrola duplicitného poradia v skupine pri vytváraní
            if (selectedCategoryIdInModal && selectedGroupIdInModal && orderInGroup !== null) {
                const existingOrderQuery = query(clubsCollectionRef,
                    where('categoryId', '==', selectedCategoryIdInModal),
                    where('groupId', '==', selectedGroupIdInModal),
                    where('orderInGroup', '==', orderInGroup)
                );
                const existingOrderSnapshot = await getDocs(existingOrderQuery);
                if (!existingOrderSnapshot.empty) {
                    await showMessage('Chyba', `Poradie ${orderInGroup} je už obsadené v tejto skupine. Prosím, vyberte iné poradie.`);
                    if (orderInGroupInput) orderInGroupInput.focus();
                    return;
                }
            }

        } else if (operationType === 'assign') {
            if (!unassignedClubSelect || !unassignedClubSelect.value || unassignedClubSelect.value.startsWith('--')) {
                await showMessage('Chyba', "Prosím, vyberte nepriradený tím k priradeniu.");
                return;
            }
            if (!selectedGroupIdInModal) {
                await showMessage('Chyba', "Prosím, vyberte skupinu, do ktorej chcete tím priradiť.");
                if (clubGroupSelect) clubGroupSelect.focus();
                return;
            }
            if (orderInGroup === null) {
                await showMessage('Chyba', "Zadajte platné poradie tímu v skupine (číslo väčšie ako 0).");
                if (orderInGroupInput) orderInGroupInput.focus();
                return;
            }

            clubIdToProcess = unassignedClubSelect.value;
            const clubDocToAssign = await getDoc(doc(clubsCollectionRef, clubIdToProcess));
            if (!clubDocToAssign.exists()) {
                await showMessage('Chyba', "Tím na priradenie sa nenašiel. Prosím, skúste znova.");
                return;
            }
            clubName = clubDocToAssign.data().name || clubDocToAssign.id; // Použijeme názov tímu z databázy pre potvrdenie

            // Kontrola duplicitného poradia v skupine
            const existingOrderQuery = query(clubsCollectionRef,
                where('categoryId', '==', selectedCategoryIdInModal),
                where('groupId', '==', selectedGroupIdInModal),
                where('orderInGroup', '==', orderInGroup)
            );
            const existingOrderSnapshot = await getDocs(existingOrderQuery);
            if (!existingOrderSnapshot.empty && existingOrderSnapshot.docs.some(doc => doc.id !== clubIdToProcess)) {
                await showMessage('Chyba', `Poradie ${orderInGroup} je už obsadené v tejto skupine. Prosím, vyberte iné poradie.`);
                if (orderInGroupInput) orderInGroupInput.focus();
                return;
            }

            const category = allAvailableCategories.find(cat => cat.id === selectedCategoryIdInModal);
            const categoryDisplayName = category ? category.name : selectedCategoryIdInModal;
            const group = allAvailableGroups.find(g => g.id === selectedGroupIdInModal);
            const groupDisplayName = group ? group.name : selectedGroupIdInModal;

            confirmationTitle = 'Potvrdenie priradenia tímu';
            confirmationMessage = `Naozaj chcete priradiť tím "${clubName}" do kategórie "${categoryDisplayName}", skupiny "${groupDisplayName}" na poradie ${orderInGroup}?`;
        } else if (operationType === 'edit' && editingClubId) {
            if (!clubName) {
                await showMessage('Chyba', "Zadajte názov tímu.");
                if (clubNameInput) clubNameInput.focus();
                return;
            }

            const clubDoc = await getDoc(doc(clubsCollectionRef, clubIdToProcess));
            if (!clubDoc.exists()) {
                await showMessage('Chyba', "Tím na úpravu sa nenašiel. Prosím, skúste znova.");
                return;
            }
            const clubData = clubDoc.data();

            const nameChanged = (clubName !== clubData.name);
            const categoryChanged = (selectedCategoryIdInModal !== clubData.categoryId);
            const groupChanged = (selectedGroupIdInModal !== clubData.groupId);
            const orderChanged = (orderInGroup !== clubData.orderInGroup);

            if (!nameChanged && !categoryChanged && !groupChanged && !orderChanged) {
                // Ak neboli žiadne zmeny, jednoducho zatvoríme modal bez správy
                if (clubModal) closeModal(clubModal);
                resetClubModal();
                displayCreatedTeams();
                return;
            }

            if (nameChanged || categoryChanged || groupChanged || orderChanged) {
                const qExistingName = query(clubsCollectionRef, where('name', '==', clubName), where('categoryId', '==', selectedCategoryIdInModal));
                const existingNameSnapshot = await getDocs(qExistingName);
                if (!existingNameSnapshot.empty && existingNameSnapshot.docs.some(doc => doc.id !== clubIdToProcess)) {
                    const category = allAvailableCategories.find(cat => cat.id === selectedCategoryIdInModal);
                    const categoryDisplayName = category ? category.name : selectedCategoryIdInModal;
                    await showMessage('Upozornenie', `Tím s názvom "${clubName}" už v kategórii "${categoryDisplayName}" existuje. Prosím, zvoľte iný názov.`);
                    if (clubNameInput) clubNameInput.focus();
                    return;
                }
            }

            // Kontrola duplicitného poradia v skupine pri úprave
            if (selectedGroupIdInModal && orderInGroup !== null) {
                const existingOrderQuery = query(clubsCollectionRef,
                    where('categoryId', '==', selectedCategoryIdInModal),
                    where('groupId', '==', selectedGroupIdInModal),
                    where('orderInGroup', '==', orderInGroup)
                );
                const existingOrderSnapshot = await getDocs(existingOrderQuery);
                if (!existingOrderSnapshot.empty && existingOrderSnapshot.docs.some(doc => doc.id !== clubIdToProcess)) {
                    await showMessage('Chyba', `Poradie ${orderInGroup} je už obsadené v tejto skupine. Prosím, vyberte iné poradie.`);
                    if (orderInGroupInput) orderInGroupInput.focus();
                    return;
                }
            }
        } else {
            await showMessage('Chyba', "Nastala chyba pri spracovaní formulára. Neplatný režim.");
            return;
        }

        let confirmed = true; // Predvolene potvrdené pre create a edit
        if (operationType === 'assign') {
            // Zobrazenie potvrdzovacieho dialógu len pre priradenie
            confirmed = await showConfirmation(confirmationTitle, confirmationMessage);
        }

        if (!confirmed) {
            return; // Ak používateľ nepotvrdí (len pre assign), zostane modal otvorený
        }

        // Akcia potvrdená (alebo pre create/edit bez potvrdenia), zatvoríme pôvodný modal a resetujeme formulár
        if (clubModal) closeModal(clubModal);
        resetClubModal();

        try {
            let dataToSave = {};
            if (operationType === 'create') {
                const newClubDocRef = doc(clubsCollectionRef);
                clubIdToProcess = newClubDocRef.id;
                dataToSave = {
                    name: clubName,
                    categoryId: selectedCategoryIdInModal,
                    groupId: selectedGroupIdInModal,
                    orderInGroup: orderInGroup,
                    createdFromBase: clubName // Uložíme pôvodný názov ako základ
                };
                await setDoc(newClubDocRef, dataToSave);
            } else if (operationType === 'assign') {
                dataToSave = {
                    categoryId: selectedCategoryIdInModal,
                    groupId: selectedGroupIdInModal,
                    orderInGroup: orderInGroup,
                };
                await updateDoc(doc(clubsCollectionRef, clubIdToProcess), dataToSave);
            } else if (operationType === 'edit') {
                dataToSave = {
                    name: clubName,
                    categoryId: selectedCategoryIdInModal,
                    groupId: selectedGroupIdInModal,
                    orderInGroup: orderInGroup,
                };
                await updateDoc(doc(clubsCollectionRef, clubIdToProcess), dataToSave);
            }
            displayCreatedTeams(); // Znova načítať a zobraziť tímy
        } catch (error) {
            console.error('Chyba pri ukladaní dát tímu:', error);
            await showMessage('Chyba', `Chyba pri ukladaní dát! Prosím, skúste znova. Detail: ${error.message}`);
            // Modál je už zatvorený, takže ho netreba zatvárať znova
        }
    });
}

/**
 * Zobrazí vytvorené tímy v tabuľke, aplikuje filtre a zoradenie.
 */
async function displayCreatedTeams() {
    if (!createdTeamsTableBody || !createdTeamsTableHeader || !groupTypeFilterButtons) {
        return;
    }
    createdTeamsTableBody.innerHTML = '';
    createdTeamsTableHeader.innerHTML = `
        <th data-filter-type="teamName">Názov tímu</th>
        <th data-filter-type="category">Kategória</th>
        <th data-filter-type="group">Skupina</th>
        <th data-sort-type="orderInGroup">Poradie v skupine</th>
        <th><button id="clearFiltersButton" class="action-button">Vymazať filtre</button></th>
    `;
    const headerCells = createdTeamsTableHeader.querySelectorAll('th');
    addHeaderFilterListeners();

    const clearFiltersButtonElement = document.getElementById('clearFiltersButton');
    if (clearFiltersButtonElement) {
         const oldListener = clearFiltersButtonElement._clickListener;
         if(oldListener) {
              clearFiltersButtonElement.removeEventListener('click', oldListener);
         }
         const newListener = () => {
             currentFilters = {
                 teamName: null,
                 category: null,
                 group: null,
                 groupType: null // Resetujeme aj filter typu skupiny
             };
             currentSort = {
                 column: null,
                 direction: 'asc'
             };
             displayCreatedTeams();
         };
         clearFiltersButtonElement.addEventListener('click', newListener);
         clearFiltersButtonElement._clickListener = newListener;
    }

    try {
        const querySnapshot = await getDocs(clubsCollectionRef);
        allTeams = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Načítanie kategórií a skupín, ak ešte nie sú načítané
        if (allAvailableCategories.length === 0) {
            await loadAllCategoriesForDynamicSelects();
        }
        if (allAvailableGroups.length === 0) {
            await loadAllGroups();
        }

        if (allTeams.length === 0) {
            createdTeamsTableBody.innerHTML = '<tr><td colspan="6">Zatiaľ nie sú vytvorené žiadne tímy.</td></tr>';
            teamsToDisplay = [];
            displayAppliedFiltersInHeader();
            renderGroupTypeFilterButtons(); // Vykreslí tlačidlá aj keď nie sú tímy
            return;
        }

        // Predvolené zoradenie podľa názvu tímu
        allTeams.sort((a, b) => {
            const nameA = (a.name || a.id || '').trim().toLowerCase();
            const nameB = (b.name || b.id || '').trim().toLowerCase();
            return nameA.localeCompare(nameB, 'sk-SK');
        });

        let filteredTeams = allTeams;

        // Aplikácia filtrov
        Object.keys(currentFilters).forEach(filterType => {
            const filterValue = currentFilters[filterType]; // This is the ID or null
            if (filterValue !== null) {
                filteredTeams = filteredTeams.filter(team => {
                    const teamCategoryId = team.categoryId;
                    const teamGroupId = team.groupId;
                    const teamGroup = allAvailableGroups.find(g => g.id === teamGroupId);
                    const teamGroupType = teamGroup ? teamGroup.type : null;

                    if (filterType === 'teamName') {
                        // Porovnávame vyčistený názov tímu s vybranou hodnotou filtra
                        const cleanedTeamName = getCleanedTeamNameForFilter(team.name || team.id);
                        return cleanedTeamName.toLowerCase() === filterValue.toLowerCase();
                    } else if (filterType === 'category') {
                        if (filterValue === null) { // Filter for "Neznáma kategória" (ID is null)
                            return !teamCategoryId || (typeof teamCategoryId === 'string' && teamCategoryId.trim() === '');
                        } else {
                            return teamCategoryId === filterValue; // Compare IDs
                        }
                    } else if (filterType === 'group') {
                        if (filterValue === null) { // Filter for "Nepriradené" (ID is null)
                            return !teamGroupId || (typeof teamGroupId === 'string' && teamGroupId.trim() === '');
                        } else {
                            return teamGroupId === filterValue; // Compare IDs
                        }
                    } else if (filterType === 'groupType') { // Filter podľa typu skupiny
                        return teamGroupType === filterValue;
                    }
                    return false;
                });
            }
        });

        teamsToDisplay = filteredTeams; // Aktualizácia teamsToDisplay po filtrovaní

        // Aplikácia zoradenia
        if (currentSort.column === 'orderInGroup') {
            teamsToDisplay.sort((a, b) => {
                const orderA = a.orderInGroup;
                const orderB = b.orderInGroup;
                const isANumber = typeof orderA === 'number' && orderA > 0;
                const isBNumber = typeof orderB === 'number' && orderB > 0;

                if (!isANumber && !isBNumber) return 0;
                if (!isANumber) return 1; // Nepriradené alebo neplatné idú na koniec
                if (!isBNumber) return -1; // Nepriradené alebo neplatné idú na koniec

                if (currentSort.direction === 'asc') {
                    return orderA - orderB;
                } else {
                    return orderB - orderA;
                }
            });
        }

        if (teamsToDisplay.length === 0) {
            createdTeamsTableBody.innerHTML = '<tr><td colspan="6">Žiadne tímy zodpovedajúce filtru.</td></tr>';
            displayAppliedFiltersInHeader();
            renderGroupTypeFilterButtons(); // Vykreslí tlačidlá aj keď nie sú tímy
            return;
        }

        // Zobrazenie indikátora zoradenia v hlavičke
        const headerCellsForSortingIndicator = createdTeamsTableHeader.querySelectorAll('th');
        headerCellsForSortingIndicator.forEach(cell => {
            cell.classList.remove('sort-asc', 'sort-desc');
        });
        if (currentSort.column) {
            const sortHeader = createdTeamsTableHeader.querySelector(`th[data-sort-type="${currentSort.column}"]`);
            if (sortHeader) {
                sortHeader.classList.add(`sort-${currentSort.direction}`);
            }
        }

        // Vykreslenie riadkov tabuľky
        teamsToDisplay.forEach(team => {
            const row = createdTeamsTableBody.insertRow();
            row.dataset.teamId = team.id;

            const teamNameCell = row.insertCell();
            teamNameCell.textContent = team.name || 'Neznámy názov'; // Zobrazujeme name

            const categoryCell = row.insertCell();
            const category = allAvailableCategories.find(cat => cat.id === team.categoryId);
            categoryCell.textContent = category ? category.name : (team.categoryId || 'Neznáma kategória'); // Zobrazujeme name

            const groupCell = row.insertCell();
            let displayedGroupName = 'Nepriradené';
            if (team.groupId && typeof team.groupId === 'string' && team.groupId.trim() !== '') {
                const group = allAvailableGroups.find(g => g.id === team.groupId);
                if (group) {
                    displayedGroupName = group.name; // Zobrazujeme name
                } else {
                    // Ak sa ID skupiny nenašlo, pokúsime sa parsovať názov z ID, ak je v tvare "kategoria - nazov"
                    const parts = team.groupId.split(' - ');
                    if (parts.length > 1) {
                        const parsedGroupName = parts.slice(1).join(' - ').trim();
                        if (parsedGroupName !== '') {
                            displayedGroupName = parsedGroupName;
                        } else {
                            displayedGroupName = team.groupId;
                        }
                    } else {
                        displayedGroupName = team.groupId;
                    }
                }
            }
            groupCell.textContent = displayedGroupName;

            const orderCell = row.insertCell();
            orderCell.textContent = (team.groupId && typeof team.orderInGroup === 'number' && team.orderInGroup > 0) ? team.orderInGroup : '-';
            orderCell.style.textAlign = 'center';

            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions-cell');
            actionsCell.style.textAlign = 'center';
            actionsCell.style.display = 'flex';
            actionsCell.style.justifyContent = 'center';
            actionsCell.style.gap = '5px';

            const editButton = document.createElement('button');
            editButton.textContent = 'Upraviť';
            editButton.classList.add('action-button');
            editButton.onclick = () => {
                if (typeof openClubModal === 'function') {
                    openClubModal(team.id, 'edit');
                } else {
                    showMessage('Chyba', "Funkcia na úpravu tímu nie je dostupná.");
                }
            };
            actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Vymazať';
            deleteButton.classList.add('action-button', 'delete-button');
            deleteButton.onclick = async () => {
                // Zatvoríme clubModal hneď, ako sa spustí žiadosť o potvrdenie
                if (clubModal && clubModal.style.display !== 'none') {
                    closeModal(clubModal);
                }
                const confirmed = await showConfirmation('Potvrdenie vymazania', `Naozaj chcete vymazať tím "${team.name}"? Táto akcia je nezvratná!`);
                if (confirmed) {
                    await deleteTeam(team.id);
                }
            };
            actionsCell.appendChild(deleteButton);
        });

         const clearFiltersCell = createdTeamsTableBody.querySelector('td:last-child');
         if (clearFiltersCell) {
              clearFiltersCell.colSpan = 1;
         }
          const noTeamsRow = createdTeamsTableBody.querySelector('tr td[colspan="6"]');
          if (noTeamsRow) {
              noTeamsRow.colSpan = 6;
          }
         displayAppliedFiltersInHeader();
         renderGroupTypeFilterButtons(); // Vykreslí tlačidlá po zobrazení tímov
    } catch (e) {
        console.error('Chyba pri načítaní a zobrazení tímov:', e);
        createdTeamsTableBody.innerHTML = '<tr><td colspan="6">Nepodarilo sa načítať tímy.</td></tr>';
        allTeams = [];
        teamsToDisplay = [];
        displayAppliedFiltersInHeader();
        renderGroupTypeFilterButtons(); // Vykreslí tlačidlá aj pri chybe
    }
}

/**
 * Zobrazí aplikované filtre v hlavičke tabuľky.
 */
function displayAppliedFiltersInHeader() {
     const headerCells = createdTeamsTableHeader.querySelectorAll('th');
     headerCells.forEach(headerCell => {
         const filterType = headerCell.dataset.filterType;
         const existingFilterDisplay = headerCell.querySelector('.applied-filter-value');
         if (existingFilterDisplay) {
             existingFilterDisplay.remove();
         }

         if (filterType && currentFilters[filterType] !== null) {
             const filterValue = currentFilters[filterType]; // This is the ID or null
             const filterValueSpan = document.createElement('span');
             filterValueSpan.classList.add('applied-filter-value');

              let displayedFilterValue = filterValue;
              if (filterType === 'category') {
                   if (filterValue === null) {
                       displayedFilterValue = 'Neznáma kategória';
                   } else {
                       const category = allAvailableCategories.find(cat => cat.id === filterValue);
                       displayedFilterValue = category ? category.name : filterValue;
                   }
              } else if (filterType === 'group') {
                   if (filterValue === null) {
                       displayedFilterValue = 'Nepriradené';
                   } else {
                       const group = allAvailableGroups.find(g => g.id === filterValue);
                       displayedFilterValue = group ? group.name : filterValue;
                   }
              }
             filterValueSpan.textContent = `${displayedFilterValue}`;
             headerCell.appendChild(filterValueSpan);
         }
     });
}

/**
 * Vykreslí tlačidlá na filtrovanie tímov podľa typu skupiny.
 */
function renderGroupTypeFilterButtons() {
    if (!groupTypeFilterButtons) return;

    groupTypeFilterButtons.innerHTML = ''; // Vyčistíme kontajner

    const uniqueGroupTypes = new Set();
    allAvailableGroups.forEach(group => {
        if (group.type) {
            uniqueGroupTypes.add(group.type);
        }
    });

    const orderedTypes = ["Zakladna skupina", "Nadstavbova skupina", "Skupina o umiestnenie"];
    const sortedUniqueTypes = Array.from(uniqueGroupTypes).sort((a, b) => {
        const indexA = orderedTypes.indexOf(a);
        const indexB = orderedTypes.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b, 'sk-SK'); // Ak ani jeden nie je v orderedTypes, zoradíme abecedne
        if (indexA === -1) return 1; // Neznámy typ ide na koniec
        if (indexB === -1) return -1; // Neznámy typ ide na koniec
        return indexA - indexB; // Zoradíme podľa poradia v orderedTypes
    });

    // Ponecháme len tlačidlá pre jednotlivé typy skupín, bez tlačidla "Všetky skupiny"
    sortedUniqueTypes.forEach(type => {
        const button = document.createElement('button');
        button.textContent = groupTypeDisplayMap[type] || type; // Zobrazíme preložený názov
        button.classList.add('action-button');
        if (currentFilters.groupType === type) {
            button.classList.add('active-filter-button'); // Zvýrazníme, ak je tento typ aktívny
        }
        button.addEventListener('click', () => {
            currentFilters.groupType = type;
            displayCreatedTeams();
        });
        groupTypeFilterButtons.appendChild(button);
    });

    // Ak nie je vybraný žiadny filter typu skupiny, automaticky vyberieme prvý dostupný typ
    if (currentFilters.groupType === null && sortedUniqueTypes.length > 0) {
        currentFilters.groupType = sortedUniqueTypes[0];
        // Pre-select the first button
        const firstButton = groupTypeFilterButtons.querySelector('.action-button');
        if (firstButton) {
            firstButton.classList.add('active-filter-button');
        }
    }
}


/**
 * Pridá listenery pre kliknutie na hlavičky tabuľky pre filtrovanie a zoradenie.
 */
function addHeaderFilterListeners() {
    if (!createdTeamsTableHeader) {
        return;
    }
    const headerCells = createdTeamsTableHeader.querySelectorAll('th');
    headerCells.forEach(headerCell => {
        const filterType = headerCell.dataset.filterType;
        const sortType = headerCell.dataset.sortType;

        // Odstránime predchádzajúce listenery, aby sa predišlo duplicitám
        headerCell.removeEventListener('click', handleHeaderClick);

        // Resetuj štýly pre prípad, že sa mení stav
        headerCell.style.cursor = 'default';
        headerCell.style.pointerEvents = 'auto'; // Default to auto

        // Podmienka pre kliknutie na hlavičku "Skupina"
        if (filterType === 'group') {
            if (currentFilters.category === null) {
                // Ak je filter kategórie neaktívny, zablokujeme kliknutie na filter skupiny
                headerCell.style.cursor = 'default';
                headerCell.style.pointerEvents = 'none'; // Zablokuje všetky udalosti myši vrátane hover
            } else {
                headerCell.style.cursor = 'pointer';
                headerCell.addEventListener('click', handleHeaderClick);
            }
        } else if (filterType || sortType === 'orderInGroup') {
            headerCell.style.cursor = 'pointer';
            headerCell.addEventListener('click', handleHeaderClick);
        }
        // Pre ostatné th, ktoré nemajú filterType ani sortType, ostane cursor 'default' a pointerEvents 'auto'
    });
}
function handleHeaderClick() {
    const filterType = this.dataset.filterType;
    const sortType = this.dataset.sortType;
    if (filterType) {
        openClubModal(filterType, 'filter');
    } else if (sortType === 'orderInGroup') {
        if (currentSort.column === sortType) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = sortType;
            currentSort.direction = 'asc';
        }
        displayCreatedTeams();
    }
}
async function deleteTeam(teamId) {
    try {
        const teamDocRef = doc(clubsCollectionRef, teamId);
        await deleteDoc(teamDocRef);
        await showMessage('Úspech', `Tím bol úspešne vymazaný.`);
        displayCreatedTeams();
        if (clubModal && clubModal.style.display !== 'none') {
            if (currentClubModalMode === 'assign') {
                populateUnassignedClubsSelect();
            }
            if (editingClubId === teamId) {
                closeModal(clubModal);
                resetClubModal();
            }
        }
    } catch (e) {
        console.error('Chyba pri mazaní tímu:', e);
        await showMessage('Chyba', "Nepodarilo sa vymazať tím. Prosím, skúste znova.");
    }
}
const handleAddButtonClick = () => {
     openClubModal(null, 'create');
};
document.addEventListener('DOMContentLoaded', async () => {
    const loggedInUsername = localStorage.getItem('username');
    if (!loggedInUsername || loggedInUsername !== 'admin') {
        window.location.href = 'login.html';
        return;
    }
    await loadAllCategoriesForDynamicSelects();
    await loadAllGroups();
    await displayCreatedTeams(); // Zobrazí tímy po načítaní dát
    const addButtonElement = document.getElementById('addButton');
    if (addButtonElement) {
        addButton.style.display = 'block';
        addButton.title = "Vytvoriť nový tím";
        addButton.removeEventListener('click', handleAddButtonClick);
        addButton.addEventListener('click', handleAddButtonClick);
    }
    if (clubModalClose) {
        clubModalClose.addEventListener('click', () => {
            closeModal(clubModal);
            resetClubModal();
            displayCreatedTeams();
        });
    }
     if (clubModal) {
         window.addEventListener('click', (event) => {
              const modalContent = clubModal.querySelector('.modal-content');
              if (event.target === clubModal && modalContent && !modalContent.contains(event.target)) {
                   closeModal(clubModal);
                   resetClubModal();
                    displayCreatedTeams();
              }
         });
     }
});
export { openClubModal, displayCreatedTeams };

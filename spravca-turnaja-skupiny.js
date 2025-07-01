import { db, categoriesCollectionRef, groupsCollectionRef, clubsCollectionRef, openModal, closeModal, populateCategorySelect, populateGroupSelect, query, where, getDocs, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, doc, showMessage, showConfirmation } from './spravca-turnaja-common.js';

const addButton = document.getElementById('addButton');
const groupsContentDiv = document.getElementById('groupsContent');
const groupModal = document.getElementById('groupModal');
const groupModalCloseBtn = groupModal ? groupModal.querySelector('.group-modal-close') : null;
const groupForm = document.getElementById('groupForm');
const groupCategorySelect = document.getElementById('groupCategory');
const groupTypeSelect = document.getElementById('groupType'); // NOVÉ: Referencia na select box pre typ skupiny
const groupNameInput = document.getElementById('groupName');
const groupModalTitle = document.getElementById('groupModalTitle');
const groupFormSubmitButton = groupForm ? groupForm.querySelector('button[type="submit"]') : null;

let currentGroupModalMode = 'add';
let editingGroupId = null; // Bude uchovávať skutočné ID dokumentu skupiny pri úprave

// Mapa pre preklad typov skupín z formátu DB na zobrazenie s diakritikou
const groupTypeDisplayMap = {
    "Zakladna skupina": "Základná skupina",
    "Nadstavbova skupina": "Nadstavbová skupina",
    "Skupina o umiestnenie": "Skupina o umiestnenie"
};

/**
 * Otvorí modálne okno pre pridanie alebo úpravu skupiny.
 * @param {string|null} groupId - ID skupiny, ak sa upravuje existujúca skupina.
 * @param {object|null} groupData - Dáta skupiny, ak sa upravuje existujúca skupina.
 */
async function openGroupModal(groupId = null, groupData = null) {
    // Aktualizované overenie, aby zahŕňalo aj groupTypeSelect
    if (!groupModal || !groupForm || !groupCategorySelect || !groupTypeSelect || !groupNameInput || !groupModalTitle || !groupFormSubmitButton) {
        if (groupModal) closeModal(groupModal);
        return;
    }
    openModal(groupModal);
    groupForm.reset();
    groupNameInput.disabled = false;
    groupFormSubmitButton.textContent = 'Uložiť';

    if (groupId && groupData) {
        currentGroupModalMode = 'edit';
        editingGroupId = groupId; // Uložíme skutočné ID dokumentu
        groupModalTitle.textContent = 'Upraviť skupinu'; // Zmenený text pre úpravu
        groupFormSubmitButton.textContent = 'Uložiť zmeny';
        await populateCategorySelect(groupCategorySelect, groupData.categoryId);
        groupCategorySelect.disabled = false;
        groupTypeSelect.value = groupData.type || ''; // Nastaví vybraný typ skupiny
        groupTypeSelect.disabled = false;
        groupNameInput.value = groupData.name || '';
        groupNameInput.focus();
    } else {
        currentGroupModalMode = 'add';
        editingGroupId = null;
        groupModalTitle.textContent = 'Pridať skupinu';
        groupFormSubmitButton.textContent = 'Uložiť';
        await populateCategorySelect(groupCategorySelect, null);
        groupCategorySelect.disabled = false;
        groupTypeSelect.value = ''; // Resetuje typ skupiny
        groupTypeSelect.disabled = false;
        if (groupCategorySelect.options.length > 1) {
            groupCategorySelect.focus();
        } else if (groupTypeSelect.options.length > 1) { // Ak sú kategórie prázdne, skúsi fokusovať typ
            groupTypeSelect.focus();
        }
        else {
            groupNameInput.focus();
        }
    }
}

/**
 * Zobrazí skupiny kategorizované podľa kategórií.
 */
async function displayGroupsByCategory() {
    if (!groupsContentDiv) return;
    groupsContentDiv.innerHTML = ''; // Vyčistí obsah pred načítaním
    try {
        const categoriesSnapshot = await getDocs(categoriesCollectionRef);
        // Zoradíme kategórie podľa poľa 'name' pre zobrazenie
        const sortedCategoriesDocs = categoriesSnapshot.docs.sort((a, b) => {
            const nameA = (a.data().name || '').toLowerCase();
            const nameB = (b.data().name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        const categories = sortedCategoriesDocs.map(doc => ({ id: doc.id, data: doc.data() }));

        if (categories.length === 0) {
            const message = document.createElement('p');
            message.textContent = "Pridajte kategórie v sekcii 'Kategórie' pre zobrazenie skupín.";
            groupsContentDiv.appendChild(message);
            return;
        }

        const groupsSnapshot = await getDocs(groupsCollectionRef);
        const groupsByCategory = {};
        groupsSnapshot.forEach(doc => {
            const groupData = doc.data();
            const groupId = doc.id;
            const categoryId = groupData.categoryId;
            if (categoryId) {
                if (!groupsByCategory[categoryId]) {
                    groupsByCategory[categoryId] = [];
                }
                groupsByCategory[categoryId].push({ id: groupId, data: groupData });
            }
        });

        categories.forEach(category => {
            const categoryDisplayName = category.data.name || category.id; // Používame názov kategórie z dát, s fallbackom na ID
            const categoryId = category.id; // ID kategórie pre filtrovanie skupín
            const groupsForThisCategory = groupsByCategory[categoryId] || [];

            const categorySectionDiv = document.createElement('div');
            categorySectionDiv.classList.add('category-group-section', 'section-block');

            // Názov kategórie sa teraz zobrazí v hlavičke tabuľky
            const categoryGroupsTable = document.createElement('table');
            categoryGroupsTable.classList.add('category-group-table');

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const groupNameTh = document.createElement('th');
            groupNameTh.textContent = 'Názov skupiny';
            const groupTypeTh = document.createElement('th'); // NOVÉ: Hlavička pre typ skupiny
            groupTypeTh.textContent = 'Typ skupiny'; // Text hlavičky
            const actionsTh = document.createElement('th');
            // Pridanie názvu kategórie do hlavičky stĺpca s tlačidlami
            actionsTh.innerHTML = `<span style="font-weight: bold;">${categoryDisplayName}</span>`; // Názov kategórie
            actionsTh.style.textAlign = 'center';
            actionsTh.style.verticalAlign = 'middle';
            actionsTh.style.width = '150px'; // Nastavte šírku podľa potreby
            headerRow.appendChild(groupNameTh);
            headerRow.appendChild(groupTypeTh); // NOVÉ: Pridanie hlavičky typu
            headerRow.appendChild(actionsTh);
            thead.appendChild(headerRow);
            categoryGroupsTable.appendChild(thead);

            const tbody = document.createElement('tbody');
            if (groupsForThisCategory.length === 0) {
                const noGroupsRow = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 3; // Zmenené colspan na 3
                td.textContent = `V kategórii "${categoryDisplayName}" zatiaľ nie sú žiadne skupiny.`; // Zobrazujeme názov kategórie
                td.style.textAlign = 'center';
                noGroupsRow.appendChild(td);
                tbody.appendChild(noGroupsRow);
            } else {
                groupsForThisCategory.sort((a, b) => (a.data.name || '').localeCompare(b.data.name || '', 'sk-SK'));
                groupsForThisCategory.forEach(group => {
                    const groupRow = document.createElement('tr');
                    const groupNameTd = document.createElement('td');
                    groupNameTd.textContent = group.data.name || 'Neznámy názov skupiny';
                    groupRow.appendChild(groupNameTd);

                    const groupTypeTd = document.createElement('td'); // NOVÉ: Bunka pre typ skupiny
                    // Použijeme groupTypeDisplayMap na zobrazenie s diakritikou
                    groupTypeTd.textContent = groupTypeDisplayMap[group.data.type] || group.data.type || 'Neznámy typ';
                    groupRow.appendChild(groupTypeTd);

                    const groupActionsTd = document.createElement('td');
                    groupActionsTd.style.whiteSpace = 'nowrap';
                    groupActionsTd.style.textAlign = 'center'; // Centrujeme tlačidlá

                    const editGroupButton = document.createElement('button');
                    editGroupButton.textContent = 'Upraviť'; // Zmenený text pre úpravu
                    editGroupButton.classList.add('action-button');
                    editGroupButton.onclick = () => {
                        openGroupModal(group.id, group.data);
                    };
                    groupActionsTd.appendChild(editGroupButton);

                    const deleteGroupButton = document.createElement('button');
                    deleteGroupButton.textContent = 'Vymazať';
                    deleteGroupButton.classList.add('action-button', 'delete-button');
                    deleteGroupButton.onclick = async () => {
                        const confirmed = await showConfirmation('Potvrdenie vymazania', `Naozaj chcete vymazať skupinu "${group.data.name}" z kategórie "${categoryDisplayName}"? Tímy priradené k tejto skupine prídu o priradenie (groupId a orderInGroup sa nastavia na null)!`);
                        if (!confirmed) {
                            return;
                        }
                        try {
                            const batch = writeBatch(db);
                            const clubsInGroupQuery = query(clubsCollectionRef, where('groupId', '==', group.id));
                            const clubsSnapshot = await getDocs(clubsInGroupQuery);
                            clubsSnapshot.forEach(doc => {
                                batch.update(doc.ref, { groupId: null, orderInGroup: null });
                            });
                            batch.delete(doc(groupsCollectionRef, group.id));
                            await batch.commit();
                            await showMessage('Úspech', `Skupina "${group.data.name}" úspešne vymazaná.`);
                            displayGroupsByCategory();
                        } catch (error) {
                            console.error('Chyba pri mazaní skupiny:', error);
                            await showMessage('Chyba', 'Chyba pri mazaní skupiny! Prosím, skúste znova.');
                        }
                    };
                    groupActionsTd.appendChild(deleteGroupButton);
                    groupRow.appendChild(groupActionsTd);
                    tbody.appendChild(groupRow);
                });
            }
            categoryGroupsTable.appendChild(tbody);
            categorySectionDiv.appendChild(categoryGroupsTable);
            groupsContentDiv.appendChild(categorySectionDiv);
        });

        // Tento blok kódu by sa mal spúšťať len v prípade, že po spracovaní všetkých kategórií
        // neboli nájdené žiadne skupiny PRIRADENÉ k existujúcim kategóriám.
        // Správa o tom, že žiadne skupiny nemajú priradenú kategóriu, bola presunutá vyššie.
        // Ak sú kategórie, ale žiadne skupiny, zobrazí sa správa "V kategórii 'X' zatiaľ nie sú žiadne skupiny."
        // Ak nie sú žiadne kategórie, zobrazí sa správa "Pridajte kategórie..."
        // Preto táto podmienka je zbytočná, ak `groupsContentDiv` nie je prázdny.
        // if (Object.keys(groupsByCategory).length === 0 && categories.length > 0) {
        //     const message = document.createElement('p');
        //     message.textContent = "Žiadne skupiny zatiaľ nemajú priradenú kategóriu, alebo žiadne skupiny neboli pridané.";
        //     groupsContentDiv.appendChild(message);
        // }
    } catch (error) {
        console.error('Chyba pri načítaní dát skupín:', error);
        const errorMessage = document.createElement('p');
        errorMessage.textContent = 'Chyba pri načítaní dát skupín.';
        groupsContentDiv.appendChild(errorMessage);
    }
}

/**
 * Resetuje stav modálneho okna skupiny.
 */
function resetGroupModal() {
    currentGroupModalMode = 'add';
    editingGroupId = null;
    if (groupForm) groupForm.reset();
    if (groupModalTitle) groupModalTitle.textContent = 'Pridať skupinu';
    if (groupCategorySelect) {
        groupCategorySelect.innerHTML = '<option value="">-- Vyberte kategóriu --</option>';
        groupCategorySelect.disabled = true;
    }
    if (groupTypeSelect) { // NOVÉ: Resetuje typ skupiny
        groupTypeSelect.value = '';
        groupTypeSelect.disabled = true;
    }
}

// Spustí sa po načítaní DOM obsahu
document.addEventListener('DOMContentLoaded', async () => {
    const loggedInUsername = localStorage.getItem('username');
    if (!loggedInUsername || loggedInUsername !== 'admin') {
        window.location.href = 'login.html'; // Presmerovanie na prihlasovaciu stránku, ak nie je admin
        return;
    }
    displayGroupsByCategory();

    // Táto časť by mala zostať, aby sa zabezpečilo, že groupsContentDiv je viditeľný
    // a ostatné sekcie sú skryté, ak je to potrebné.
    if (groupsContentDiv) {
        groupsContentDiv.style.display = 'flex'; // Zabezpečí, že flexbox funguje
        const otherSections = document.querySelectorAll('main > section, main > div');
        otherSections.forEach(section => {
            if (section.id !== 'groupsContent') {
                section.style.display = 'none';
            }
        });
    }

    if (addButton) {
        addButton.style.display = 'block';
        addButton.title = "Pridať skupinu";
        addButton.onclick = () => {
            openGroupModal();
        };
    }
});

// Listener pre zatvorenie modálneho okna
if (groupModalCloseBtn) {
    groupModalCloseBtn.addEventListener('click', () => {
        closeModal(groupModal);
        resetGroupModal();
    });
}

// Listener pre odoslanie formulára skupiny
if (groupForm) {
    groupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedCategoryId = groupCategorySelect ? groupCategorySelect.value : '';
        const selectedGroupType = groupTypeSelect ? groupTypeSelect.value : ''; // NOVÉ: Získame vybraný typ skupiny
        const groupName = groupNameInput ? groupNameInput.value.trim() : '';

        if (selectedCategoryId === '' || selectedCategoryId.startsWith('--')) {
            await showMessage('Chyba', 'Prosím, vyberte platnú kategóriu pre skupinu.');
            if (groupCategorySelect) groupCategorySelect.focus();
            return;
        }
        // NOVÉ: Overenie, či bol vybraný typ skupiny
        if (selectedGroupType === '' || selectedGroupType.startsWith('--')) {
            await showMessage('Chyba', 'Prosím, vyberte platný typ skupiny.');
            if (groupTypeSelect) groupTypeSelect.focus();
            return;
        }
        if (groupName === '') {
            await showMessage('Chyba', 'Názov skupiny nemôže byť prázdny.');
            if (groupNameInput) groupNameInput.focus();
            return;
        }

        // Získame názov kategórie pre zobrazenie v správach
        const categoryDoc = await getDoc(doc(categoriesCollectionRef, selectedCategoryId));
        const categoryDisplayName = categoryDoc.exists() ? categoryDoc.data().name : selectedCategoryId;

        try {
            if (currentGroupModalMode === 'add') {
                // Režim pridávania novej skupiny
                // Skontrolujeme, či skupina s rovnakým názvom a TYPOM už v danej kategórii existuje
                const qExistingName = query(
                    groupsCollectionRef,
                    where('name', '==', groupName),
                    where('categoryId', '==', selectedCategoryId),
                    where('type', '==', selectedGroupType) // NOVÉ: Kontrola aj podľa typu
                );
                const existingNameSnapshot = await getDocs(qExistingName);
                if (!existingNameSnapshot.empty) {
                    await showMessage('Upozornenie', `Skupina s názvom "${groupName}" a typom "${groupTypeDisplayMap[selectedGroupType] || selectedGroupType}" už v kategórii "${categoryDisplayName}" existuje! Názvy skupín musia byť unikátne v rámci kategórie a typu.`);
                    if (groupNameInput) groupNameInput.focus();
                    return;
                }

                // Generujeme náhodné ID pre nový dokument skupiny
                const newGroupDocRef = doc(groupsCollectionRef);
                await setDoc(newGroupDocRef, { name: groupName, categoryId: selectedCategoryId, type: selectedGroupType }); // Uloží aj typ skupiny

                await showMessage('Úspech', `Skupina "${groupName}" (${groupTypeDisplayMap[selectedGroupType] || selectedGroupType}) v kategórii "${categoryDisplayName}" úspešne pridaná.`);
            } else if (currentGroupModalMode === 'edit') {
                // Režim úpravy existujúcej skupiny
                const groupIdToUpdate = editingGroupId; // Toto je stabilné ID dokumentu skupiny
                if (!groupIdToUpdate) {
                    await showMessage('Chyba', "Chyba pri úprave skupiny. Prosím, obnovte stránku.");
                    if (groupModal) closeModal(groupModal);
                    resetGroupModal();
                    return;
                }

                const currentGroupDoc = await getDoc(doc(groupsCollectionRef, groupIdToUpdate));
                if (!currentGroupDoc.exists()) {
                    await showMessage('Chyba', "Skupina na úpravu nebola nájdená.");
                    if (groupModal) closeModal(groupModal);
                    resetGroupModal();
                    return;
                }
                const oldGroupData = currentGroupDoc.data();
                const oldCategoryOfGroup = oldGroupData.categoryId;
                const oldNameOfGroup = oldGroupData.name;
                const oldTypeOfGroup = oldGroupData.type; // NOVÉ: Starý typ skupiny

                // Skontrolujeme, či sa zmenil názov, kategória alebo typ
                const nameChanged = (groupName !== oldNameOfGroup);
                const categoryChanged = (selectedCategoryId !== oldCategoryOfGroup);
                const typeChanged = (selectedGroupType !== oldTypeOfGroup); // NOVÉ: Kontrola zmeny typu

                if (nameChanged || categoryChanged || typeChanged) {
                    // Ak sa zmenil názov, kategória alebo typ, skontrolujeme unikátnosť nového kombina
                    const qExistingName = query(
                        groupsCollectionRef,
                        where('name', '==', groupName),
                        where('categoryId', '==', selectedCategoryId),
                        where('type', '==', selectedGroupType) // NOVÉ: Kontrola aj podľa typu
                    );
                    const existingNameSnapshot = await getDocs(qExistingName);

                    // Ak existuje iný dokument s rovnakým názvom, kategóriou a typom
                    if (!existingNameSnapshot.empty && existingNameSnapshot.docs.some(doc => doc.id !== groupIdToUpdate)) {
                        await showMessage('Upozornenie', `Skupina s názvom "${groupName}" a typom "${groupTypeDisplayMap[selectedGroupType] || selectedGroupType}" už v kategórii "${categoryDisplayName}" existuje! Názvy skupín musia byť unikátne v rámci kategórie a typu.`);
                        if (groupNameInput) groupNameInput.focus();
                        return;
                    }

                    const batch = writeBatch(db);
                    // Aktualizujeme pole 'name', 'categoryId' a 'type' v existujúcom dokumente skupiny
                    batch.update(doc(groupsCollectionRef, groupIdToUpdate), { name: groupName, categoryId: selectedCategoryId, type: selectedGroupType });

                    // Ak sa zmenila kategória skupiny, aktualizujeme aj categoryId v kluboch priradených k tejto skupine
                    if (categoryChanged) {
                        const clubsInGroupQuery = query(clubsCollectionRef, where('groupId', '==', groupIdToUpdate));
                        const clubsSnapshot = await getDocs(clubsInGroupQuery);
                        clubsSnapshot.forEach(clubDoc => {
                            batch.update(clubDoc.ref, { categoryId: selectedCategoryId });
                        });
                    }
                    await batch.commit();
                    await showMessage('Úspech', `Skupina "${oldNameOfGroup}" úspešne upravená na "${groupName}" (${groupTypeDisplayMap[selectedGroupType] || selectedGroupType}) v kategórii "${categoryDisplayName}".`);
                } else {
                    // Ak sa nič nezmenilo, len zatvoríme modál
                    await showMessage('Informácia', 'Žiadne zmeny neboli vykonané.');
                }
            }
            if (groupModal) closeModal(groupModal);
            resetGroupModal();
            displayGroupsByCategory();
        } catch (error) {
            console.error('Chyba pri ukladaní skupiny:', error);
            await showMessage('Chyba', `Chyba pri ukladaní skupiny! Detail: ${error.message}`);
            if (groupModal) closeModal(groupModal);
            resetGroupModal();
        }
    });
}

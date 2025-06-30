import { db, categoriesCollectionRef, groupsCollectionRef, clubsCollectionRef, getDocs, query, where } from './spravca-turnaja-common.js';
let dynamicContentArea = null;
let backToCategoriesButton = null;
let backToGroupButtonsButton = null;
let categoryButtonsContainer = null;
let categoryTitleDisplay = null;
let groupSelectionButtons = null;
let allGroupsContent = null;
let singleGroupContent = null;
let allGroupsContainer = null;
let allGroupsUnassignedDisplay = null;
let singleGroupDisplayBlock = null;
let singleGroupUnassignedDisplay = null;
let allCategories = [];
let allGroups = [];
let allTeams = [];
let currentCategoryId = null;
let currentGroupId = null;

// Mapa pre preklad typov skupín z formátu DB na zobrazenie s diakritikou
const groupTypeDisplayMap = {
    "Zakladna skupina": "Základná skupina",
    "Nadstavbova skupina": "Nadstavbová skupina",
    "Skupina o umiestnenie": "Skupina o umiestnenie"
};


function getCleanClubNameForUrl(rawClubNameFromData, categoryNameFromData, teamNameForCleaning) {
    let cleanedName = rawClubNameFromData;
    if (!cleanedName && teamNameForCleaning) {
        cleanedName = teamNameForCleaning;
    }
    if (!cleanedName) return 'Neznámy klub';
    const regexEndLetter = /\s[A-Z]$/;
    if (regexEndLetter.test(cleanedName)) {
        cleanedName = cleanedName.replace(regexEndLetter, '').trim();
    }
    if (categoryNameFromData) {
        const categoryRegexPattern = `^${categoryNameFromData.replace(/[-\s]/g, '[-\\s]')}\\s*-\\s*`;
        const categoryRegex = new RegExp(categoryRegexPattern, 'i');
        cleanedName = cleanedName.replace(categoryRegex, '').trim();
    }    
    return cleanedName.trim();
}
function getHTMLElements() {
    dynamicContentArea = document.getElementById('dynamicContentArea');
    backToCategoriesButton = document.getElementById('backToCategoriesButton');
    backToGroupButtonsButton = document.getElementById('backToGroupButtonsButton');
    categoryButtonsContainer = document.getElementById('categoryButtonsContainer');
    categoryTitleDisplay = document.getElementById('categoryTitleDisplay');
    groupSelectionButtons = document.getElementById('groupSelectionButtons');
    allGroupsContent = document.getElementById('allGroupsContent');
    singleGroupContent = document.getElementById('singleGroupContent');    
    allGroupsContainer = allGroupsContent ? allGroupsContent.querySelector('.groups-container') : null;
    allGroupsUnassignedDisplay = allGroupsContent ? allGroupsContent.querySelector('.unassigned-teams-display') : null;
    singleGroupDisplayBlock = singleGroupContent ? singleGroupContent.querySelector('.group-display') : null;
    singleGroupUnassignedDisplay = singleGroupContent ? singleGroupContent.querySelector('.unassigned-teams-display') : null;
    const elementsFound = dynamicContentArea && backToCategoriesButton && backToGroupButtonsButton &&
                            categoryButtonsContainer && categoryTitleDisplay && groupSelectionButtons &&
                            allGroupsContent && singleGroupContent &&
                            allGroupsContainer && allGroupsUnassignedDisplay &&
                            singleGroupDisplayBlock && singleGroupUnassignedDisplay;
    if (!elementsFound) {
        if (dynamicContentArea) dynamicContentArea.innerHTML = '<p>FATAL ERROR: Chyba pri inicializácii aplikácie. Chýbajú potrebné HTML elementy. Skontrolujte konzolu pre detaily.</p>';
        if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'none';
        if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'none';
        if (groupSelectionButtons) groupSelectionButtons.style.display = 'none';
        if (allGroupsContent) allGroupsContent.style.display = 'none';
        if (singleGroupContent) singleGroupContent.style.display = 'none';
        if (backToCategoriesButton) backToCategoriesButton.style.display = 'none';
        if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'none';
        return false;
    }
    return true;
}
async function loadAllTournamentData() {
    try {
        const categoriesSnapshot = await getDocs(categoriesCollectionRef);
        allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allCategories.sort((a, b) => (a.name || a.id || '').localeCompare((b.name || b.id || ''), 'sk-SK'));
        const groupsSnapshot = await getDocs(groupsCollectionRef);
        allGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allGroups = allGroups.map(group => {
            if (!group.categoryId) {
                const categoryFromId = allCategories.find(cat => group.id.startsWith(`${cat.id} - `));
                if (categoryFromId) {
                    group.categoryId = categoryFromId.id;
                }
            }
            return group;
        }).filter(group => group.categoryId);
        // Pridanie predvolenej hodnoty pre type, ak chýba
        allGroups.forEach(group => {
            if (!group.type) {
                group.type = "Zakladna skupina"; // Predvolená hodnota
            }
        });

        allGroups.sort((a, b) => (a.name || a.id || '').localeCompare((b.name || a.id || ''), 'sk-SK'));
        const teamsSnapshot = await getDocs(clubsCollectionRef);
        allTeams = teamsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                clubName: data.clubName || data.name || ''
            };
        });
    } catch (error) {
        if (dynamicContentArea && categoryButtonsContainer) {
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = '<p class="error-message">Nepodarilo sa načítať dáta turnaja. Prosím, skúste znova.</p>';
            categoryButtonsContainer.parentNode.insertBefore(errorDiv, categoryButtonsContainer.nextSibling);
        } else if (dynamicContentArea) {
            dynamicContentArea.innerHTML = '<p class="error-message">Nepodarilo sa načítať dáta turnaja. Prosím, skúste znova.</p>';
        }
        if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'none';
        if (groupSelectionButtons) groupSelectionButtons.style.display = 'none';
        if (allGroupsContent) allGroupsContent.style.display = 'none';
        if (singleGroupContent) singleGroupContent.style.display = 'none';
        if (backToCategoriesButton) backToCategoriesButton.style.display = 'none';
        if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'none';
        alert("Nepodarilo sa načítať dáta turnaja.");
    }
}
function showOnly(containerIdToShow) {
    if (allGroupsContent) allGroupsContent.style.display = 'none';
    if (singleGroupContent) singleGroupContent.style.display = 'none';
    if (dynamicContentArea) {
        if (containerIdToShow === 'singleGroupContent') {
            dynamicContentArea.classList.add('single-group-active');
        } else {
            dynamicContentArea.classList.remove('single-group-active');
        }
    }
    switch (containerIdToShow) {
        case 'allGroupsContent':
            if (allGroupsContent) allGroupsContent.style.display = 'block';
            break;
        case 'singleGroupContent':
            if (singleGroupContent) singleGroupContent.style.display = 'block';
            break;
        default:
            if (allGroupsContent) allGroupsContent.style.display = 'none';
            if (singleGroupContent) singleGroupContent.style.display = 'none';
            break;
    }
    if (containerIdToShow === 'allGroupsContent' && allGroupsContainer && window.getComputedStyle(allGroupsContent).display !== 'none') {
        // Uniform width is not needed for the new layout by group type
        // const uniformWidth = findMaxTableContentWidth(allGroupsContainer);
        // if (uniformWidth > 0) {
        //     setUniformTableWidth(uniformWidth, allGroupsContainer);
        // }
    } else if (containerIdToShow === 'singleGroupContent' && singleGroupContent && window.getComputedStyle(singleGroupContent).display !== 'none') {
        const uniformWidth = findMaxTableContentWidth(singleGroupContent);
        if (uniformWidth > 0) {
            setUniformTableWidth(uniformWidth, singleGroupContent);
        }
    }
}
function clearActiveCategoryButtons() {
    const categoryButtons = categoryButtonsContainer ? categoryButtonsContainer.querySelectorAll('.display-button') : [];
    categoryButtons.forEach(button => button.classList.remove('active'));
}
function setActiveCategoryButton(categoryId) {
    clearActiveCategoryButtons();
    const categoryButton = categoryButtonsContainer ? categoryButtonsContainer.querySelector(`.display-button[data-category-id="${categoryId}"]`) : null;
    if (categoryButton) {
        categoryButton.classList.add('active'); // Oprava: `button` zmenené na `categoryButton`
    }
}
function clearActiveGroupButtons() {
    const groupButtons = groupSelectionButtons ? groupSelectionButtons.querySelectorAll('.display-button') : [];
    groupButtons.forEach(button => button.classList.remove('active'));
    // Removed specific handling for group titles in 'allGroupsContainer' as layout changes
    // const groupTitlesInAllView = allGroupsContainer ? allGroupsContainer.querySelectorAll('.group-display h3') : [];
    // groupTitlesInAllView.forEach(title => title.classList.remove('active-title'));
}
function setActiveGroupButton(groupId) {
    clearActiveGroupButtons();
    const groupButton = groupSelectionButtons ? groupSelectionButtons.querySelector(`.display-button[data-group-id="${groupId}"]`) : null;
    if (groupButton) {
        groupButton.classList.add('active');
    }
    // Removed specific handling for group titles in 'allGroupsContainer' as layout changes
    // if (allGroupsContainer) {
    //     const groupDisplays = allGroupsContainer.querySelectorAll('.group-display');
    //     groupDisplays.forEach(groupDiv => {
    //         if (groupDiv.dataset.groupId === groupId) {
    //             const h3Title = groupDiv.querySelector('h3');
    //             if (h3Title) {
    //                 h3Title.classList.add('active-title');
    //             }
    //         }
    //     });
    // }
}
function displayCategoriesAsButtons() {
    currentCategoryId = null;
    currentGroupId = null;
    if (!getHTMLElements()) {
        return;
    }
    if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'flex';
    if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'none';
    if (groupSelectionButtons) groupSelectionButtons.style.display = 'none';
    if (backToCategoriesButton) backToCategoriesButton.style.display = 'none';
    if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'none';
    showOnly(null);
    if (categoryButtonsContainer) categoryButtonsContainer.innerHTML = '';
    clearActiveCategoryButtons();
    clearActiveGroupButtons();
    if (allCategories.length === 0) {
        if (categoryButtonsContainer) categoryButtonsContainer.innerHTML = '<p>Zatiaľ nie sú pridané žiadne kategórie.</p>';
        return;
    }
    const chlapciCategories = [];
    const dievcataCategories = [];
    const ostatneCategories = [];
    const sortedCategories = [...allCategories].sort((a, b) => (a.name || a.id || '').localeCompare((b.name || b.id || ''), 'sk-SK'));
    sortedCategories.forEach(category => {
        const categoryName = category.name || category.id;
        if (categoryName.endsWith(' CH')) {
            chlapciCategories.push(category);
        } else if (categoryName.endsWith(' D')) {
            dievcataCategories.push(category);
        } else {
            ostatneCategories.push(category);
        }
    });
    const createCategoryGroupDisplay = (title, categories) => {
        if (categories.length === 0) return null;
        const groupDiv = document.createElement('div');
        groupDiv.classList.add('category-group');
        const heading = document.createElement('h3');
        heading.textContent = title;
        groupDiv.appendChild(heading);
        const buttonsDiv = document.createElement('div');
        buttonsDiv.classList.add('category-buttons');
        groupDiv.appendChild(buttonsDiv);
        categories.forEach(category => {
            const button = document.createElement('button');
            button.classList.add('display-button');
            button.textContent = category.name || category.id;
            button.dataset.categoryId = category.id;
            button.addEventListener('click', () => {
                const categoryId = button.dataset.categoryId;
                displayGroupsForCategory(categoryId);
            });
            buttonsDiv.appendChild(button);
        });
        return groupDiv;
    };
    if (categoryButtonsContainer) {
        const chlapciGroup = createCategoryGroupDisplay('Chlapci', chlapciCategories);
        if (chlapciGroup) {
            categoryButtonsContainer.appendChild(chlapciGroup);
        }
        const dievcataGroup = createCategoryGroupDisplay('Dievčatá', dievcataCategories);
        if (dievcataGroup) {
            categoryButtonsContainer.appendChild(dievcataGroup);
        }
        const ostatneGroup = createCategoryGroupDisplay('Ostatné kategórie', ostatneCategories);
        if (ostatneGroup) {
            categoryButtonsContainer.appendChild(ostatneGroup);
        }
        if (categoryButtonsContainer.children.length === 0) {
            categoryButtonsContainer.innerHTML = '<p>Zatiaľ nie sú pridané žiadne kategórie.</p>';
        }
    }
}
function displayGroupsForCategory(categoryId) {
    currentCategoryId = categoryId;
    currentGroupId = null;
    if (!getHTMLElements()) {
        goBackToCategories();
        return;
    }
    if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'flex';
    if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'block';
    if (groupSelectionButtons) groupSelectionButtons.style.display = 'flex'; // Zobrazíme groupSelectionButtons pre typy skupín
    if (backToCategoriesButton) backToCategoriesButton.style.display = 'none';
    if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'none';
    if (allGroupsContainer) allGroupsContainer.innerHTML = '';
    if (allGroupsUnassignedDisplay) allGroupsUnassignedDisplay.innerHTML = '';
    if (singleGroupDisplayBlock) singleGroupDisplayBlock.innerHTML = '';
    if (singleGroupUnassignedDisplay) singleGroupUnassignedDisplay.innerHTML = '';
    if (groupSelectionButtons) groupSelectionButtons.innerHTML = ''; // Vyčistíme groupSelectionButtons
    showOnly('allGroupsContent');
    setActiveCategoryButton(categoryId);
    clearActiveGroupButtons();
    window.location.hash = 'category-' + encodeURIComponent(categoryId);
    const selectedCategory = allCategories.find(cat => cat.id === categoryId);
    if (!selectedCategory) {
        if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'none';
        if (groupSelectionButtons) groupSelectionButtons.style.display = 'none';
        showOnly(null);
        if (dynamicContentArea && categoryButtonsContainer) {
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = `<p class="error-message">Chyba: Kategória "${categoryId}" sa nenašla. Prosím, skúste znova alebo kontaktujte administrátora.</p>`;
            categoryButtonsContainer.parentNode.insertBefore(errorDiv, categoryButtonsContainer.nextSibling);
        }
        return;
    }
    if (categoryTitleDisplay) categoryTitleDisplay.textContent = selectedCategory.name || selectedCategory.id;
    
    const groupsInCategory = allGroups.filter(group => group.categoryId === categoryId);
    
    // Zoskupenie skupín podľa typu
    const groupsByType = {};
    // Používame pevné poradie typov pre zobrazenie
    const orderedTypes = ["Zakladna skupina", "Nadstavbova skupina", "Skupina o umiestnenie"];
    orderedTypes.forEach(typeKey => {
        groupsByType[groupTypeDisplayMap[typeKey]] = []; // Inicializácia pre všetky typy s diakritikou v správnom poradí
    });

    groupsInCategory.forEach(group => {
        const typeDisplay = groupTypeDisplayMap[group.type] || group.type || 'Neznámy typ';
        // Pridávame skupiny len do existujúcich typov, aby sme zachovali poradie
        if (groupsByType[typeDisplay]) {
            groupsByType[typeDisplay].push(group);
        } else {
            // Ak sa nájde typ, ktorý nie je v orderedTypes (napr. staré dáta), pridať ho na koniec
            if (!groupsByType['Ostatné typy']) {
                groupsByType['Ostatné typy'] = [];
            }
            groupsByType['Ostatné typy'].push(group);
        }
    });

    // Zobrazenie typov skupín a ich tlačidiel
    if (groupSelectionButtons) {
        groupSelectionButtons.classList.add('group-type-container'); // Nová trieda pre flexbox layout
        groupSelectionButtons.innerHTML = ''; // Vyčistíme pred pridaním nových prvkov

        // Prechádzame cez zoradené typy
        orderedTypes.concat(['Ostatné typy']).forEach(typeDisplayKey => {
            const typeDisplay = groupTypeDisplayMap[typeDisplayKey] || typeDisplayKey; // Preklad pre zobrazenie
            const groupsForThisType = groupsByType[typeDisplay];
            
            if (groupsForThisType && groupsForThisType.length > 0) {
                const typeSectionDiv = document.createElement('div');
                typeSectionDiv.classList.add('group-type-section');

                const typeHeaderDiv = document.createElement('div');
                typeHeaderDiv.classList.add('group-type-header'); // Kontajner pre nadpis a tlačidlá

                const typeTitle = document.createElement('h3');
                typeTitle.textContent = typeDisplay;
                typeHeaderDiv.appendChild(typeTitle);

                const typeButtonsDiv = document.createElement('div');
                typeButtonsDiv.classList.add('group-buttons-by-type');

                groupsForThisType.sort((a, b) => (a.name || a.id || '').localeCompare((b.name || b.id || ''), 'sk-SK')); // Zoradenie skupín v rámci typu
                groupsForThisType.forEach(group => {
                    const button = document.createElement('button');
                    button.classList.add('display-button');
                    button.textContent = group.name || group.id;
                    button.dataset.groupId = group.id;
                    button.addEventListener('click', () => {
                        const groupIdToDisplay = button.dataset.groupId;
                        displaySingleGroup(groupIdToDisplay);
                    });
                    typeButtonsDiv.appendChild(button);
                });
                typeHeaderDiv.appendChild(typeButtonsDiv);
                typeSectionDiv.appendChild(typeHeaderDiv); // Pridáme header div do sekcie typu
                groupSelectionButtons.appendChild(typeSectionDiv);
            }
        });

        if (groupSelectionButtons.children.length === 0) {
            groupSelectionButtons.innerHTML = `<p>V kategórii "${selectedCategory.name || selectedCategory.id}" zatiaľ nie sú vytvorené žiadne skupiny.</p>`;
            groupSelectionButtons.style.display = 'block'; // Zabezpečiť, že správa bude viditeľná
        }
    }


    // Pôvodné zobrazenie skupín v `allGroupsContainer` už nie je potrebné v tomto pohľade
    if (allGroupsContainer) allGroupsContainer.innerHTML = '';
    // Removed force-3-plus-2-layout as it's not applicable to the new layout
    // if (allGroupsContainer) {
    //     if (groupsInCategory.length === 5) {
    //         allGroupsContainer.classList.add('force-3-plus-2-layout');
    //     } else {
    //         allGroupsContainer.classList.remove('force-3-plus-2-layout');
    //     }
    // }
    // Removed the loop for adding groupDivs to allGroupsContainer
    // groupsInCategory.forEach(group => { ... });


    const unassignedTeamsInCategory = allTeams.filter(team =>
        (!team.groupId || (typeof team.groupId === 'string' && team.groupId.trim() === '')) &&
        team.categoryId === categoryId
    );
    if (unassignedTeamsInCategory.length > 0) {
        if (allGroupsUnassignedDisplay) allGroupsUnassignedDisplay.innerHTML = '';
        const unassignedDivContent = document.createElement('div');
        unassignedDivContent.classList.add('unassigned-teams-section');
        const unassignedTitle = document.createElement('h2');
        unassignedTitle.textContent = 'Nepriradené tímy v tejto kategórii';
        unassignedDivContent.appendChild(unassignedTitle);
        unassignedTeamsInCategory.sort((a, b) => {
            const nameA = (a.name || a.id || '').toLowerCase();
            const nameB = (b.name || b.id || '').toLowerCase();
            return nameA.localeCompare(nameB, 'sk-SK');
        });
        const unassignedList = document.createElement('ul');
        unassignedList.classList.add('unassigned-team-list');
        unassignedTeamsInCategory.forEach(team => {
            const teamItem = document.createElement('li');
            teamItem.classList.add('unassigned-team-list-item');
            teamItem.textContent = team.name || 'Neznámy tím';
            unassignedList.appendChild(teamItem);
        });
        unassignedDivContent.appendChild(unassignedList);
        if (allGroupsUnassignedDisplay) {
            allGroupsUnassignedDisplay.appendChild(unassignedDivContent);
        }
    } else {
        if (allGroupsUnassignedDisplay) allGroupsUnassignedDisplay.innerHTML = '';
    }
}
function displaySingleGroup(groupId) {
    const group = allGroups.find(g => g.id === groupId);
    if (!group) {
        const hash = window.location.hash;
        const categoryPrefix = '#category-';
        const hashParts = hash.startsWith(categoryPrefix) ? hash.substring(categoryPrefix.length).split('/')[0] : null;
        const categoryIdFromHash = hashParts ? decodeURIComponent(hashParts) : null;
        if (categoryIdFromHash && allCategories.some(cat => cat.id === categoryIdFromHash)) {
            displayGroupsForCategory(categoryIdFromHash);
        } else {
            goBackToCategories();
        }
        return;
    }
    currentCategoryId = group.categoryId;
    currentGroupId = groupId;
    if (!getHTMLElements()) {
        goBackToCategories();
        return;
    }
    if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'flex';
    if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'block';
    if (groupSelectionButtons) groupSelectionButtons.style.display = 'flex'; // Stále zobrazujeme, aj keď sú to typy
    if (backToCategoriesButton) backToCategoriesButton.style.display = 'none';
    if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'block';
    if (singleGroupDisplayBlock) singleGroupDisplayBlock.innerHTML = '';
    if (singleGroupUnassignedDisplay) singleGroupUnassignedDisplay.innerHTML = '';
    showOnly('singleGroupContent');
    setActiveCategoryButton(currentCategoryId);
    setActiveGroupButton(groupId);
    window.location.hash = `category-${encodeURIComponent(currentCategoryId)}/group-${encodeURIComponent(groupId)}`;
    const category = allCategories.find(cat => cat.id === currentCategoryId);
    if (category && categoryTitleDisplay) {
        categoryTitleDisplay.textContent = category.name || category.id;
    }
    if (singleGroupDisplayBlock) {
        const groupTitle = document.createElement('h3');
        // Zobrazenie typu skupiny s diakritikou a názvu
        groupTitle.textContent = `${groupTypeDisplayMap[group.type] || group.type || 'Neznámy typ'} - ${group.name || group.id}`;
        groupTitle.style.cursor = 'default';
        groupTitle.style.pointerEvents = 'none';
        singleGroupDisplayBlock.appendChild(groupTitle);
        const teamsInGroup = allTeams.filter(team => team.groupId === group.id);
        if (teamsInGroup.length === 0) {
            const noTeamsPara = document.createElement('p');
            noTeamsPara.textContent = 'V tejto skupine zatiaľ nie sú žiadne tímy.';
            noTeamsPara.style.padding = '10px';
            singleGroupDisplayBlock.appendChild(noTeamsPara);
        } else {
            teamsInGroup.sort((a, b) => {
                const orderA = a.orderInGroup || Infinity;
                const orderB = b.orderInGroup || Infinity;
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                const nameA = (a.name || a.id || '').toLowerCase();
                const nameB = (b.name || b.id || '').toLowerCase();
                return nameA.localeCompare(nameB, 'sk-SK');
            });
            const teamList = document.createElement('ul');
            teamList.classList.add('team-list');
            teamsInGroup.forEach(team => {
                const teamItem = document.createElement('li');
                teamItem.classList.add('team-list-item');
                teamItem.textContent = team.name || 'Neznámy tím';
                teamItem.style.cursor = 'pointer';
                const rawClubNameForCleaning = team.clubName || team.name || '';
                teamItem.dataset.clubName = rawClubNameForCleaning;
                const categoryForUrl = allCategories.find(cat => cat.id === currentCategoryId);
                const categoryNameForUrl = categoryForUrl ? (categoryForUrl.name || categoryForUrl.id) : '';                
                const fullTeamName = `${categoryNameForUrl} - ${team.name || 'Neznámy tím'}`.trim();
                const cleanedTeamName = fullTeamName.replace(/\s/g, '+');
                teamItem.addEventListener('click', (event) => {
                    const clickedClubNameRaw = event.currentTarget.dataset.clubName;                    
                    const cleanedClubName = getCleanClubNameForUrl(clickedClubNameRaw, categoryNameForUrl, team.name)
                        .replace(/\s/g, '+');
                    const url = `prihlasene-kluby.html?club=${cleanedClubName}&team=${cleanedTeamName}`;
                    window.location.href = url;
                });
                teamList.appendChild(teamItem);
            });
            singleGroupDisplayBlock.appendChild(teamList);
        }
    }
    const unassignedTeamsInCategory = allTeams.filter(team =>
        (!team.groupId || (typeof team.groupId === 'string' && team.groupId.trim() === '')) &&
        team.categoryId === currentCategoryId
    );
    if (unassignedTeamsInCategory.length > 0) {
        if (singleGroupUnassignedDisplay) {
            singleGroupUnassignedDisplay.innerHTML = '';
            const unassignedDivContent = document.createElement('div');
            unassignedDivContent.classList.add('unassigned-teams-section');
            const unassignedTitle = document.createElement('h2');
            unassignedTitle.textContent = 'Nepriradené tímy v tejto kategórii';
            unassignedDivContent.appendChild(unassignedTitle);
            unassignedTeamsInCategory.sort((a, b) => {
                const nameA = (a.name || a.id || '').toLowerCase();
                const nameB = (b.name || b.id || '').toLowerCase();
                return nameA.localeCompare(nameB, 'sk-SK');
            });
            const unassignedList = document.createElement('ul');
            unassignedList.classList.add('unassigned-team-list');
            unassignedTeamsInCategory.forEach(team => {
                const teamItem = document.createElement('li');
                teamItem.classList.add('unassigned-team-list-item');
                teamItem.textContent = team.name || 'Neznámy tím';
                unassignedList.appendChild(teamItem);
            });
            unassignedDivContent.appendChild(unassignedList);
            if (singleGroupUnassignedDisplay) {
                singleGroupUnassignedDisplay.appendChild(unassignedDivContent);
            }
        }
    } else {
        if (singleGroupUnassignedDisplay) singleGroupUnassignedDisplay.innerHTML = '';
    }
}
function goBackToCategories() {
    currentCategoryId = null;
    currentGroupId = null;
    if (!getHTMLElements()) {
        return;
    }
    if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'flex';
    if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'none';
    if (groupSelectionButtons) groupSelectionButtons.style.display = 'none';
    if (backToCategoriesButton) backToCategoriesButton.style.display = 'none';
    if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'none';
    showOnly(null);
    clearActiveCategoryButtons();
    clearActiveGroupButtons();
    if (window.location.hash) {
        history.replaceState({}, document.title, window.location.pathname);
    }
    displayCategoriesAsButtons();
}
function goBackToGroupView() {
    const categoryIdToReturnTo = currentCategoryId;
    currentGroupId = null;
    if (!getHTMLElements()) {
        goBackToCategories();
        return;
    }
    if (!categoryIdToReturnTo) {
        goBackToCategories();
        return;
    }
    if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'flex';
    if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'block';
    if (groupSelectionButtons) groupSelectionButtons.style.display = 'flex'; // Stále zobrazujeme typy
    if (backToCategoriesButton) backToCategoriesButton.style.display = 'none';
    if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'none';
    if (singleGroupDisplayBlock) singleGroupDisplayBlock.innerHTML = '';
    if (singleGroupUnassignedDisplay) singleGroupUnassignedDisplay.innerHTML = '';
    showOnly('allGroupsContent'); // Zobrazenie všetkých skupín (teraz zoskupených podľa typu)
    setActiveCategoryButton(categoryIdToReturnTo);
    clearActiveGroupButtons();
    window.location.hash = 'category-' + encodeURIComponent(categoryIdToReturnTo);
    displayGroupsForCategory(categoryIdToReturnTo); // Zavoláme pôvodnú funkciu, ktorá teraz vykreslí typy a ich skupiny
}
function findMaxTableContentWidth(containerElement) {
    let maxWidth = 0;
    if (!containerElement) {
        return 0;
    }
    const groupDisplays = containerElement.querySelectorAll('.group-display');
    if (groupDisplays.length === 0) {
        return 0;
    }
    groupDisplays.forEach(displayDiv => {
        const originalStyles = {
            flexBasis: displayDiv.style.flexBasis,
            width: displayDiv.style.width,
            minWidth: displayDiv.style.minWidth,
            maxWidth: displayDiv.style.maxWidth,
            flexShrink: displayDiv.style.flexShrink,
            flexGrow: displayDiv.style.flexGrow,
            display: displayDiv.style.display
        };
        let tempDisplay = originalStyles.display;
        if (window.getComputedStyle(displayDiv).display === 'none') {
            displayDiv.style.display = 'block';
        }
        displayDiv.style.flexBasis = 'max-content';
        displayDiv.style.width = 'auto';
        displayDiv.style.minWidth = 'auto';
        displayDiv.style.maxWidth = 'none';
        displayDiv.style.flexShrink = '0';
        displayDiv.style.flexGrow = '0';
        const requiredWidth = displayDiv.offsetWidth;
        displayDiv.style.flexBasis = originalStyles.flexBasis;
        displayDiv.style.width = originalStyles.width;
        displayDiv.style.minWidth = originalStyles.minWidth;
        displayDiv.style.maxWidth = originalStyles.maxWidth;
        displayDiv.style.flexShrink = originalStyles.flexShrink;
        displayDiv.style.flexGrow = originalStyles.flexGrow;
        if (window.getComputedStyle(displayDiv).display === 'block' && tempDisplay === 'none') {
            displayDiv.style.display = originalStyles.display;
        }
        if (requiredWidth > maxWidth) {
            maxWidth = requiredWidth;
        }
    });
    const safetyPadding = 20;
    return maxWidth > 0 ? maxWidth + safetyPadding : 0;
}
function setUniformTableWidth(width, containerElement) {
    if (width <= 0 || !containerElement) {
        return;
    }
    const groupDisplays = containerElement.querySelectorAll('.group-display');
    if (groupDisplays.length === 0) {
        return;
    }
    groupDisplays.forEach(displayDiv => {
        displayDiv.style.width = `${width}px`;
        displayDiv.style.minWidth = `${width}px`;
        displayDiv.style.maxWidth = `${width}px`;
        displayDiv.style.flexBasis = 'auto';
        displayDiv.style.flexShrink = '0';
        displayDiv.style.flexGrow = '0';
    });
}
document.addEventListener('DOMContentLoaded', async () => {
    if (!getHTMLElements()) {
        return;
    }
    await loadAllTournamentData();
    if (backToCategoriesButton) backToCategoriesButton.addEventListener('click', goBackToCategories);
    if (backToGroupButtonsButton) backToGroupButtonsButton.addEventListener('click', goBackToGroupView);
    displayCategoriesAsButtons();
    const hash = window.location.hash;
    const categoryPrefix = '#category-';
    const groupPrefix = '/group-';
    if (hash && hash.startsWith(categoryPrefix)) {
        const hashParts = hash.substring(categoryPrefix.length).split(groupPrefix);
        const urlCategoryId = hashParts[0];
        const urlGroupId = hashParts.length > 1 ? hashParts[1] : null;
        const decodedCategoryId = decodeURIComponent(urlCategoryId);
        const decodedGroupId = urlGroupId ? decodeURIComponent(urlGroupId) : null;
        const categoryExists = allCategories.some(cat => cat.id === decodedCategoryId);
        if (categoryExists) {
            setTimeout(() => {
                displayGroupsForCategory(decodedCategoryId);
                if (decodedGroupId) {
                    const groupExists = allGroups.some(group => group.id === decodedGroupId && group.categoryId === decodedCategoryId);
                    if (groupExists) {
                        displaySingleGroup(decodedGroupId);
                    }
                }
            }, 50);
        }
    } 
});
window.addEventListener('hashchange', () => {
    if (!getHTMLElements()) {
        return;
    }
    if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'flex';
    const hash = window.location.hash;
    const categoryPrefix = '#category-';
    const groupPrefix = '/group-';
    if (hash && hash.startsWith(categoryPrefix)) {
        const hashParts = hash.substring(categoryPrefix.length).split(groupPrefix);
        const urlCategoryId = hashParts[0];
        const urlGroupId = hashParts.length > 1 ? hashParts[1] : null;
        const decodedCategoryId = decodeURIComponent(urlCategoryId);
        const decodedGroupId = urlGroupId ? decodeURIComponent(urlGroupId) : null;
        const categoryExists = allCategories.some(cat => cat.id === decodedCategoryId);
        if (categoryExists) {
            const alreadyInTargetState = (currentCategoryId === decodedCategoryId) &&
                                         (currentGroupId === decodedGroupId);
            if (alreadyInTargetState) {
                return;
            }
            currentCategoryId = decodedCategoryId;
            currentGroupId = decodedGroupId;
            if (decodedGroupId) {
                const groupExists = allGroups.some(group => group.id === decodedGroupId && group.categoryId === decodedCategoryId);
                if (groupExists) {
                    displayGroupsForCategory(decodedCategoryId);
                    displaySingleGroup(decodedGroupId);
                } else {
                    displayGroupsForCategory(decodedCategoryId);
                }
            } else {
                displayGroupsForCategory(decodedCategoryId);
            }
        } else {
            goBackToCategories();
        }
    } else {
        goBackToCategories();
    }
});
window.addEventListener('resize', () => {
    if (!getHTMLElements()) {
        return;
    }
    if (currentCategoryId !== null) {
        const isAllGroupsVisible = allGroupsContent && window.getComputedStyle(allGroupsContent).display !== 'none';
        const isSingleGroupVisible = singleGroupContent && window.getComputedStyle(singleGroupContent).display !== 'none';
        if (isAllGroupsVisible && allGroupsContainer) {
            // No longer apply uniform width to group-display elements in allGroupsContainer
            // const uniformWidth = findMaxTableContentWidth(allGroupsContainer);
            // if (uniformWidth > 0) {
            //     setUniformTableWidth(uniformWidth, allGroupsContainer);
            // }
        } else if (isSingleGroupVisible && singleGroupContent) {
            const uniformWidth = findMaxTableContentWidth(singleGroupContent);
            if (uniformWidth > 0) {
                setUniformTableWidth(uniformWidth, singleGroupContent);
            }
        }
    }
});

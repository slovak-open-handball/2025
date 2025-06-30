import { db, categoriesCollectionRef, groupsCollectionRef, clubsCollectionRef, getDocs, query, where } from './spravca-turnaja-common.js';
let dynamicContentArea = null;
let backToCategoriesButton = null;
let backToGroupButtonsButton = null;
let categoryButtonsContainer = null;
let categoryTitleDisplay = null;
let groupSelectionButtons = null; // Tento element bude slúžiť na zobrazenie riadkov s typom skupiny a tlačidlami
let allGroupsContent = null; // Tento element bude slúžiť na zobrazenie detailov všetkých skupín (zoznamy tímov)
let singleGroupContent = null;
let allGroupsContainer = null; // Kontajner vo vnútri allGroupsContent
let allGroupsUnassignedDisplay = null;
let singleGroupDisplayBlock = null;
let singleGroupUnassignedDisplay = null;
let allCategories = [];
let allGroups = [];
let allTeams = [];
let currentCategoryId = null; // Uchováva ID kategórie
let currentGroupId = null;    // Uchováva ID skupiny

// Mapa pre preklad typov skupín z formátu DB na zobrazenie s diakritikou
const groupTypeDisplayMap = {
    "Zakladna skupina": "Základná skupina",
    "Nadstavbova skupina": "Nadstavbová skupina",
    "Skupina o umiestnenie": "Skupina o umiestnenie"
};

// Globálna premenná pre maximálnu šírku zobrazenia názvu tímu
let globalMaxTeamDisplayNameWidth = 0;


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
    // Aj tu pre prihlasene-kluby.html sa zachováva logika replace(/\s/g, '+');
    // Ak by sa chcelo aj tu nahradzovať "-", treba zmeniť regex na /[ -]/g
    return cleanedName.trim();
}

function getHTMLElements() {
    dynamicContentArea = document.getElementById('dynamicContentArea');
    backToCategoriesButton = document.getElementById('backToCategoriesButton');
    backToGroupButtonsButton = document.getElementById('backToGroupButtonsButton');
    categoryButtonsContainer = document.getElementById('categoryButtonsContainer');
    categoryTitleDisplay = document.getElementById('categoryTitleDisplay');
    groupSelectionButtons = document.getElementById('groupSelectionButtons'); // Tento element bude slúžiť na zobrazenie riadkov s typom skupiny a tlačidlami
    allGroupsContent = document.getElementById('allGroupsContent'); // Tento element bude slúžiť na zobrazenie detailov všetkých skupín (zoznamy tímov)
    singleGroupContent = document.getElementById('singleGroupContent');    
    allGroupsContainer = allGroupsContent ? allGroupsContent.querySelector('.groups-container') : null; // Kontajner pre zobrazenie všetkých skupín
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

/**
 * Vypočíta maximálnu potrebnú šírku pre zobrazenie najdlhšieho názvu tímu.
 * Vytvorí dočasný element pre presné meranie.
 */
function calculateMaxTeamNameDisplayWidth() {
    let maxWidth = 0;
    // Vytvorenie dočasného, skrytého elementu na meranie šírky textu
    const tempMeasurer = document.createElement('li');
    tempMeasurer.style.position = 'absolute';
    tempMeasurer.style.visibility = 'hidden';
    tempMeasurer.style.whiteSpace = 'nowrap';
    tempMeasurer.style.padding = '8px 10px'; // Zhoduje sa s paddingom .team-list-item
    tempMeasurer.style.border = '1px solid transparent'; // Zhoduje sa s borderom .team-list-item
    tempMeasurer.style.fontSize = '0.95em'; // Zhoduje sa s veľkosťou fontu .team-list-item
    document.body.appendChild(tempMeasurer);

    allTeams.forEach(team => {
        tempMeasurer.textContent = team.name || 'Neznámy tím';
        const currentWidth = tempMeasurer.offsetWidth;
        if (currentWidth > maxWidth) {
            maxWidth = currentWidth;
        }
    });

    document.body.removeChild(tempMeasurer);
    // Pridáme nejaký bezpečnostný padding pre robustnosť (napr. pre scrollbar, drobné variácie)
    // A padding/border pre .group-display div (15px padding + 1px border na každej strane = 32px)
    const safetyPaddingForListItem = 10; // Extra padding pre položku zoznamu
    const groupDisplayPaddingBorder = 15 * 2 + 1 * 2; // 15px padding + 1px border na každej strane
    return maxWidth > 0 ? maxWidth + safetyPaddingForListItem + groupDisplayPaddingBorder : 0;
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

        // Po načítaní všetkých tímov vypočítame maximálnu šírku
        globalMaxTeamDisplayNameWidth = calculateMaxTeamNameDisplayWidth();

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
        console.error("Nepodarilo sa načítať dáta turnaja:", error); // Používame console.error namiesto alert()
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
    // Už nie je potrebné volať findMaxTableContentWidth/setUniformTableWidth tu,
    // pretože šírka sa nastavuje globálne pri vykresľovaní skupín
}
function clearActiveCategoryButtons() {
    const categoryButtons = categoryButtonsContainer ? categoryButtonsContainer.querySelectorAll('.display-button') : [];
    categoryButtons.forEach(button => button.classList.remove('active'));
}
function setActiveCategoryButton(categoryId) {
    clearActiveCategoryButtons();
    const categoryButton = categoryButtonsContainer ? categoryButtonsContainer.querySelector(`.display-button[data-category-id="${categoryId}"]`) : null;
    if (categoryButton) {
        categoryButton.classList.add('active');
    }
}
function clearActiveGroupButtons() {
    // Toto teraz prechádza cez groupSelectionButtons, kde sú tlačidlá typov
    const groupButtons = groupSelectionButtons ? groupSelectionButtons.querySelectorAll('.display-button') : [];
    groupButtons.forEach(button => button.classList.remove('active'));
}
function setActiveGroupButton(groupId) {
    clearActiveGroupButtons();
    const groupButton = groupSelectionButtons ? groupSelectionButtons.querySelector(`.display-button[data-group-id="${groupId}"]`) : null;
    if (groupButton) {
        groupButton.classList.add('active');
    }
    // Ak sa zobrazuje jedna skupina, zvýrazníme aj jej nadpis v zobrazení všetkých skupín
    if (allGroupsContainer) {
        const groupDisplays = allGroupsContainer.querySelectorAll('.group-display');
        groupDisplays.forEach(groupDiv => {
            if (groupDiv.dataset.groupId === groupId) {
                const h3Title = groupDiv.querySelector('h3');
                if (h3Title) {
                    h3Title.classList.add('active-title');
                }
            }
        });
    }
}
function displayCategoriesAsButtons() {
    currentCategoryId = null;
    currentGroupId = null;
    if (!getHTMLElements()) {
        return;
    }
    if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'flex';
    if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'none';
    if (groupSelectionButtons) groupSelectionButtons.style.display = 'none'; // Skryje navigačné tlačidlá skupín
    if (allGroupsContent) allGroupsContent.style.display = 'none'; // Skryje detaily skupín
    if (backToCategoriesButton) backToCategoriesButton.style.display = 'none';
    if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'none';
    showOnly(null); // Zabezpečí skrytie všetkých kontajnerov pre skupiny
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
            button.dataset.categoryId = category.id; // Still use ID for internal mapping
            button.addEventListener('click', () => {
                // Pass category ID, but store name in URL
                displayGroupsForCategory(button.dataset.categoryId);
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

/**
 * Zobrazí navigačné tlačidlá pre skupiny (zoskupené podľa typu)
 * a zároveň detaily všetkých skupín v rámci vybranej kategórie.
 * @param {string} categoryId ID vybranej kategórie.
 */
function displayGroupsForCategory(categoryId) {
    currentCategoryId = categoryId;
    currentGroupId = null; // Resetovať vybranú skupinu pri zmene kategórie
    if (!getHTMLElements()) {
        goBackToCategories();
        return;
    }
    // Zobrazenie hlavných kontajnerov
    if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'flex'; // Zobrazí tlačidlá kategórií
    if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'block'; // Zobrazí názov kategórie
    if (groupSelectionButtons) groupSelectionButtons.style.display = 'flex'; // Zobrazí kontajner pre typy skupín a ich tlačidlá
    if (allGroupsContent) allGroupsContent.style.display = 'block'; // Zobrazí kontajner pre detaily všetkých skupín
    if (backToCategoriesButton) backToCategoriesButton.style.display = 'block'; // Zobrazí tlačidlo "Späť na kategórie"
    if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'none'; // Skryje tlačidlo "Späť na skupiny" (sme na prehľade kategórie)
    
    // Vyčistíme obsah pre prípadné predošlé zobrazenia
    if (groupSelectionButtons) groupSelectionButtons.innerHTML = '';
    if (allGroupsContainer) allGroupsContainer.innerHTML = '';
    if (allGroupsUnassignedDisplay) allGroupsUnassignedDisplay.innerHTML = '';
    if (singleGroupDisplayBlock) singleGroupDisplayBlock.innerHTML = '';
    if (singleGroupUnassignedDisplay) singleGroupUnassignedDisplay.innerHTML = '';

    showOnly('allGroupsContent'); // Zobrazí .allGroupsContent a skryje .singleGroupContent

    setActiveCategoryButton(categoryId);
    clearActiveGroupButtons(); // Zruší aktívny stav pre tlačidlá skupín
    
    const selectedCategory = allCategories.find(cat => cat.id === categoryId);
    // Ulož názov kategórie do URL namiesto ID, nahraď medzery A pomlčky plusmi
    const categoryUrlName = (selectedCategory.name || selectedCategory.id).replace(/[ -]/g, '+');
    window.location.hash = 'category-' + encodeURIComponent(categoryUrlName);

    if (!selectedCategory) {
        if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'none';
        if (groupSelectionButtons) groupSelectionButtons.style.display = 'none';
        if (allGroupsContent) allGroupsContent.style.display = 'none';
        if (backToCategoriesButton) backToCategoriesButton.style.display = 'none';
        if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'none';
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
    
    // 1. Zobrazenie navigačných tlačidiel skupín zoskupených podľa typu
    const groupsByType = {};
    const orderedTypes = ["Zakladna skupina", "Nadstavbova skupina", "Skupina o umiestnenie"];
    orderedTypes.forEach(typeKey => {
        groupsByType[groupTypeDisplayMap[typeKey]] = [];
    });

    groupsInCategory.forEach(group => {
        const typeDisplay = groupTypeDisplayMap[group.type] || group.type || 'Neznámy typ';
        if (groupsByType[typeDisplay]) {
            groupsByType[typeDisplay].push(group);
        } else {
            if (!groupsByType['Ostatné typy']) {
                groupsByType['Ostatné typy'] = [];
            }
            groupsByType['Ostatné typy'].push(group);
        }
    });

    if (groupSelectionButtons) {
        groupSelectionButtons.classList.add('group-type-container'); // Zabezpečí flexbox layout
        
        orderedTypes.concat(['Ostatné typy']).forEach(typeDisplayKey => {
            const typeDisplay = groupTypeDisplayMap[typeDisplayKey] || typeDisplayKey;
            const groupsForThisType = groupsByType[typeDisplay];
            
            if (groupsForThisType && groupsForThisType.length > 0) {
                const typeHeaderDiv = document.createElement('div');
                typeHeaderDiv.classList.add('group-type-header'); // Pre nadpis a tlačidlá v jednom riadku

                const typeTitle = document.createElement('h3');
                typeTitle.textContent = typeDisplay;
                typeHeaderDiv.appendChild(typeTitle);

                const typeButtonsDiv = document.createElement('div');
                typeButtonsDiv.classList.add('group-buttons-by-type');

                groupsForThisType.sort((a, b) => (a.name || a.id || '').localeCompare((b.name || b.id || ''), 'sk-SK'));
                groupsForThisType.forEach(group => {
                    const button = document.createElement('button');
                    button.classList.add('display-button');
                    button.textContent = group.name || group.id;
                    button.dataset.groupId = group.id; // Still use ID for internal mapping
                    button.addEventListener('click', () => {
                        // Pass group ID, but store group name in URL
                        displaySingleGroup(button.dataset.groupId);
                    });
                    typeButtonsDiv.appendChild(button);
                });
                typeHeaderDiv.appendChild(typeButtonsDiv);
                groupSelectionButtons.appendChild(typeHeaderDiv); // Pridáme celý riadok s nadpisom a tlačidlami
            }
        });

        if (groupSelectionButtons.children.length === 0) {
            groupSelectionButtons.innerHTML = `<p>V kategórii "${selectedCategory.name || selectedCategory.id}" zatiaľ nie sú vytvorené žiadne skupiny.</p>`;
            groupSelectionButtons.style.display = 'block';
        }
    }


    // 2. Zobrazenie detailov všetkých skupín v allGroupsContainer
    if (allGroupsContainer) {
        allGroupsContainer.innerHTML = ''; // Vyčistíme kontajner pred pridaním nových detailov

        if (groupsInCategory.length === 0) {
            const noGroupsMsg = document.createElement('p');
            noGroupsMsg.textContent = `V kategórii "${selectedCategory.name || selectedCategory.id}" zatiaľ nie sú žiadne skupiny na zobrazenie detailov.`;
            noGroupsMsg.style.textAlign = 'center';
            noGroupsMsg.style.padding = '20px';
            allGroupsContainer.appendChild(noGroupsMsg);
        } else {
            // Zoskupenie skupín podľa typu pre zobrazenie
            const groupedDetailsByType = {};
            orderedTypes.forEach(typeKey => {
                groupedDetailsByType[groupTypeDisplayMap[typeKey]] = [];
            });

            groupsInCategory.forEach(group => {
                const typeDisplay = groupTypeDisplayMap[group.type] || group.type || 'Neznámy typ';
                if (groupedDetailsByType[typeDisplay]) {
                    groupedDetailsByType[typeDisplay].push(group);
                } else {
                    if (!groupedDetailsByType['Ostatné typy']) {
                        groupedDetailsByType['Ostatné typy'] = [];
                    }
                    groupedDetailsByType['Ostatné typy'].push(group);
                }
            });

            // Vykreslenie zoskupených detailov do allGroupsContainer
            orderedTypes.concat(['Ostatné typy']).forEach(typeDisplayKey => {
                const typeDisplay = groupTypeDisplayMap[typeDisplayKey] || typeDisplayKey;
                const groupsForThisType = groupedDetailsByType[typeDisplay];

                if (groupsForThisType && groupsForThisType.length > 0) {
                    const typeSectionDiv = document.createElement('div');
                    typeSectionDiv.classList.add('group-type-section'); // Nová trieda pre sekciu typu (napr. Základná skupina)

                    const sectionTitle = document.createElement('h2');
                    sectionTitle.textContent = typeDisplay;
                    typeSectionDiv.appendChild(sectionTitle);

                    const groupsDisplayGrid = document.createElement('div');
                    groupsDisplayGrid.classList.add('groups-display-grid'); // Pre mriežkové zobrazenie skupín v rámci typu

                    groupsForThisType.sort((a, b) => (a.name || a.id || '').localeCompare((b.name || b.id || ''), 'sk-SK'));
                    groupsForThisType.forEach(group => {
                        const groupDisplayDiv = document.createElement('div');
                        groupDisplayDiv.classList.add('group-display');
                        groupDisplayDiv.dataset.groupId = group.id;

                        // Aplikujeme globálne vypočítanú šírku na groupDisplayDiv
                        if (globalMaxTeamDisplayNameWidth > 0) {
                            groupDisplayDiv.style.width = `${globalMaxTeamDisplayNameWidth}px`;
                            groupDisplayDiv.style.minWidth = `${globalMaxTeamDisplayNameWidth}px`;
                            groupDisplayDiv.style.maxWidth = `${globalMaxTeamDisplayNameWidth}px`;
                            groupDisplayDiv.style.flexBasis = 'auto'; // Flex-basis by mal byť auto, aby width prebralo prioritu
                            groupDisplayDiv.style.flexShrink = '0'; // Zabráni zmenšovaniu
                            groupDisplayDiv.style.flexGrow = '0'; // Zabráni zväčšovaniu
                        }
                        
                        const groupTitle = document.createElement('h3');
                        groupTitle.textContent = group.name || group.id; 
                        groupTitle.style.cursor = 'pointer'; // Nastavíme kurzor na "pointer", aby bolo vidieť, že je klikateľný
                        groupTitle.addEventListener('click', () => {
                            displaySingleGroup(group.id); // Pridáme event listener pre kliknutie na hlavičku
                        });
                        groupDisplayDiv.appendChild(groupTitle);

                        const teamsInGroup = allTeams.filter(team => team.groupId === group.id);
                        if (teamsInGroup.length === 0) {
                            const noTeamsPara = document.createElement('p');
                            noTeamsPara.textContent = 'V tejto skupine zatiaľ nie sú žiadne tímy.';
                            noTeamsPara.style.padding = '10px';
                            groupDisplayDiv.appendChild(noTeamsPara);
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

                                // NOVÁ ČASŤ: Pridanie kategórie a skupiny do URL
                                const categoryUrlParam = (categoryForUrl ? (categoryForUrl.name || categoryForUrl.id) : '').replace(/[ -]/g, '+');
                                const groupUrlParam = (group.name || group.id).replace(/[ -]/g, '+');

                                teamItem.addEventListener('click', (event) => {
                                    const clickedClubNameRaw = event.currentTarget.dataset.clubName;                    
                                    const cleanedClubName = getCleanClubNameForUrl(clickedClubNameRaw, categoryNameForUrl, team.name)
                                        .replace(/\s/g, '+');
                                    
                                    // Získanie aktuálneho hash fragmentu z zobrazenie-skupin.html
                                    // Budeme ho konštruovať z currentCategoryId a currentGroupId pre spoľahlivosť
                                    let hashToPass = '';
                                    if (currentCategoryId) {
                                        const currentCategory = allCategories.find(cat => cat.id === currentCategoryId);
                                        const currentCategoryUrlName = (currentCategory.name || currentCategory.id).replace(/[ -]/g, '+');
                                        hashToPass = `#category-${encodeURIComponent(currentCategoryUrlName)}`;

                                        if (currentGroupId) {
                                            const currentGroup = allGroups.find(g => g.id === currentGroupId);
                                            const currentGroupUrlName = (currentGroup.name || currentGroup.id).replace(/[ -]/g, '+');
                                            hashToPass += `/group-${encodeURIComponent(currentGroupUrlName)}`;
                                        }
                                    }

                                    // Aktualizovaná URL s novými parametrami
                                    const url = `prihlasene-kluby.html?club=${cleanedClubName}&team=${cleanedTeamName}&category=${categoryUrlParam}&group=${groupUrlParam}&sourcePage=zobrazenie-skupin&sourceHash=${encodeURIComponent(hashToPass)}`;
                                    window.location.href = url;
                                });
                                teamList.appendChild(teamItem);
                            });
                            groupDisplayDiv.appendChild(teamList);
                        }
                        groupsDisplayGrid.appendChild(groupDisplayDiv);
                    });
                    typeSectionDiv.appendChild(groupsDisplayGrid);
                    allGroupsContainer.appendChild(typeSectionDiv);
                }
            });
        }
    }

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
            teamItem.classList.add('team-list-item');
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

/**
 * Zobrazí detaily jednej konkrétnej skupiny.
 * @param {string} groupId ID vybranej skupiny.
 */
function displaySingleGroup(groupId) {
    const group = allGroups.find(g => g.id === groupId);
    if (!group) {
        // Fallback to category view if group not found from URL
        const hash = window.location.hash;
        const categoryPrefix = '#category-';
        const hashParts = hash.startsWith(categoryPrefix) ? hash.substring(categoryPrefix.length).split('/')[0] : null;
        // Dekódovanie a nahradenie plusov späť na medzery
        const urlCategoryNameFromHash = hashParts ? decodeURIComponent(hashParts[0]).replace(/\+/g, ' ') : null;
        
        let categoryIdFromHash = null;
        if (urlCategoryNameFromHash) {
            const foundCategory = allCategories.find(cat => (cat.name || cat.id) === urlCategoryNameFromHash);
            categoryIdFromHash = foundCategory ? foundCategory.id : null;
        }

        if (categoryIdFromHash && allCategories.some(cat => cat.id === categoryIdFromHash)) {
            displayGroupsForCategory(categoryIdFromHash); // Vráti sa na prehľad kategórie, ak sa skupina nenašla
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

    // Zobrazenie hlavných kontajnerov
    if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'flex'; // Zobrazí tlačidlá kategórií
    if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'block'; // Zobrazí názov kategórie
    if (groupSelectionButtons) groupSelectionButtons.style.display = 'flex'; // Zobrazí kontajner pre typy skupín a ich tlačidlá
    if (allGroupsContent) allGroupsContent.style.display = 'none'; // Skryje detaily všetkých skupín
    if (singleGroupContent) singleGroupContent.style.display = 'block'; // Zobrazí detail jedinej skupiny
    if (backToCategoriesButton) backToCategoriesButton.style.display = 'none'; // SKRYJEME tlačidlo "Späť na kategórie"
    if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'block'; // Zobrazí tlačidlo "Späť na skupiny"

    // Vyčistíme obsah singleGroupContent
    if (singleGroupDisplayBlock) singleGroupDisplayBlock.innerHTML = '';
    if (singleGroupUnassignedDisplay) singleGroupUnassignedDisplay.innerHTML = '';

    setActiveCategoryButton(currentCategoryId);
    setActiveGroupButton(groupId); // Zvýrazní aktívne tlačidlo skupiny
    
    const category = allCategories.find(cat => cat.id === currentCategoryId);
    // Ulož názvy kategórie a skupiny do URL, nahraď medzery A pomlčky plusmi
    const categoryUrlName = (category.name || category.id).replace(/[ -]/g, '+');
    const groupUrlName = (group.name || group.id).replace(/[ -]/g, '+');
    window.location.hash = `category-${encodeURIComponent(categoryUrlName)}/group-${encodeURIComponent(groupUrlName)}`;

    if (category && categoryTitleDisplay) {
        categoryTitleDisplay.textContent = category.name || category.id;
    }

    if (singleGroupDisplayBlock) {
        // Aplikujeme globálne vypočítanú šírku na singleGroupDisplayBlock
        if (globalMaxTeamDisplayNameWidth > 0) {
            singleGroupDisplayBlock.style.width = `${globalMaxTeamDisplayNameWidth}px`;
            singleGroupDisplayBlock.style.minWidth = `${globalMaxTeamDisplayNameWidth}px`;
            singleGroupDisplayBlock.style.maxWidth = `${globalMaxTeamDisplayNameWidth}px`;
            singleGroupDisplayBlock.style.flexBasis = 'auto'; // Flex-basis by mal byť auto, aby width prebralo prioritu
            singleGroupDisplayBlock.style.flexShrink = '0'; // Zabráni zmenšovaniu
            singleGroupDisplayBlock.style.flexGrow = '0'; // Zabráni zväčšovaniu
        }

        const groupTitle = document.createElement('h3');
        groupTitle.textContent = group.name || group.id;
        groupTitle.style.cursor = 'default'; // Tu necháme default, lebo už je klikateľné cez tlačidlo "Späť na skupiny"
        groupTitle.style.pointerEvents = 'none'; // Aby sa zabránilo opätovnému kliknutiu, keď sme už v zobrazení jednej skupiny
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

                // NOVÁ ČASŤ: Pridanie kategórie a skupiny do URL
                const categoryUrlParam = (categoryForUrl ? (categoryForUrl.name || categoryForUrl.id) : '').replace(/[ -]/g, '+');
                const groupUrlParam = (group.name || group.id).replace(/[ -]/g, '+');

                teamItem.addEventListener('click', (event) => {
                    const clickedClubNameRaw = event.currentTarget.dataset.clubName;                    
                    const cleanedClubName = getCleanClubNameForUrl(clickedClubNameRaw, categoryNameForUrl, team.name)
                        .replace(/\s/g, '+');
                    
                    // Získanie aktuálneho hash fragmentu z zobrazenie-skupin.html
                    // Budeme ho konštruovať z currentCategoryId a currentGroupId pre spoľahlivosť
                    let hashToPass = '';
                    if (currentCategoryId) {
                        const currentCategory = allCategories.find(cat => cat.id === currentCategoryId);
                        const currentCategoryUrlName = (currentCategory.name || currentCategory.id).replace(/[ -]/g, '+');
                        hashToPass = `#category-${encodeURIComponent(currentCategoryUrlName)}`;

                        if (currentGroupId) {
                            const currentGroup = allGroups.find(g => g.id === currentGroupId);
                            const currentGroupUrlName = (currentGroup.name || currentGroup.id).replace(/[ -]/g, '+');
                            hashToPass += `/group-${encodeURIComponent(currentGroupUrlName)}`;
                        }
                    }

                    // Aktualizovaná URL s novými parametrami
                    const url = `prihlasene-kluby.html?club=${cleanedClubName}&team=${cleanedTeamName}&category=${categoryUrlParam}&group=${groupUrlParam}&sourcePage=zobrazenie-skupin&sourceHash=${encodeURIComponent(hashToPass)}`;
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
                teamItem.classList.add('team-list-item');
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
    if (groupSelectionButtons) groupSelectionButtons.style.display = 'none'; // Skryje navigačné tlačidlá skupín
    if (allGroupsContent) allGroupsContent.style.display = 'none'; // Skryje detaily skupín
    if (singleGroupContent) singleGroupContent.style.display = 'none'; // Skryje detail jednej skupiny
    if (backToCategoriesButton) backToCategoriesButton.style.display = 'none';
    if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'none';
    showOnly(null); // Zabezpečí skrytie všetkých kontajnerov pre skupiny
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
    
    // Zobrazenie hlavných kontajnerov
    if (categoryButtonsContainer) categoryButtonsContainer.style.display = 'flex';
    if (categoryTitleDisplay) categoryTitleDisplay.style.display = 'block';
    if (groupSelectionButtons) groupSelectionButtons.style.display = 'flex'; // Zobrazí navigačné tlačidlá skupín
    if (allGroupsContent) allGroupsContent.style.display = 'block'; // Zobrazí detaily všetkých skupín
    if (singleGroupContent) singleGroupContent.style.display = 'none'; // Skryje detail jednej skupiny
    if (backToCategoriesButton) backToCategoriesButton.style.display = 'block'; // ZOBRAZÍME tlačidlo "Späť na kategórie"
    if (backToGroupButtonsButton) backToGroupButtonsButton.style.display = 'none'; // Skryje tlačidlo "Späť na skupiny"

    // showOnly('allGroupsContent'); // Táto funkcia už nie je taká dôležitá, keďže ručne nastavujeme display
    setActiveCategoryButton(categoryIdToReturnTo);
    clearActiveGroupButtons(); // Zruší aktívny stav pre tlačidlá skupín
    
    const category = allCategories.find(cat => cat.id === categoryIdToReturnTo);
    // Ulož názov kategórie do URL namiesto ID, nahraď medzery A pomlčky plusmi
    const categoryUrlName = (category.name || category.id).replace(/[ -]/g, '+');
    window.location.hash = 'category-' + encodeURIComponent(categoryUrlName);

    displayGroupsForCategory(categoryIdToReturnTo); // Znovu vykreslí prehľad kategórie s typmi a všetkými detailami skupín
}

// Odstránené: findMaxTableContentWidth a setUniformTableWidth, pretože sa riadime globálnou šírkou


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
        // Dekódujeme a nahradíme plusy späť na medzery pred hľadaním
        const urlCategoryName = decodeURIComponent(hashParts[0]).replace(/\+/g, ' ');
        const urlGroupName = hashParts.length > 1 ? decodeURIComponent(hashParts[1]).replace(/\+/g, ' ') : null;

        let decodedCategoryId = null;
        const foundCategory = allCategories.find(cat => (cat.name || cat.id) === urlCategoryName);
        if (foundCategory) {
            decodedCategoryId = foundCategory.id;
        }
        
        if (decodedCategoryId) {
            setTimeout(() => {
                if (urlGroupName) {
                    let decodedGroupId = null;
                    const foundGroup = allGroups.find(group => (group.name || group.id) === urlGroupName && group.categoryId === decodedCategoryId);
                    if (foundGroup) {
                        decodedGroupId = foundGroup.id;
                    }

                    if (decodedGroupId) {
                        // Ak je v URL aj názov skupiny a existuje, zobrazíme priamo túto skupinu
                        displaySingleGroup(decodedGroupId);
                    } else {
                        // Ak názov skupiny z URL neexistuje, zobrazíme prehľad kategórie
                        displayGroupsForCategory(decodedCategoryId);
                    }
                } else {
                    // Ak v URL nie je názov skupiny, zobrazíme prehľad kategórie
                    displayGroupsForCategory(decodedCategoryId);
                }
            }, 50);
        } else {
            // Ak kategória z URL neexistuje, vrátime sa na zobrazenie kategórií
            goBackToCategories();
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
        // Dekódujeme a nahradíme plusy späť na medzery pred hľadaním
        const urlCategoryName = decodeURIComponent(hashParts[0]).replace(/\+/g, ' ');
        const urlGroupName = hashParts.length > 1 ? decodeURIComponent(hashParts[1]).replace(/\+/g, ' ') : null;

        let decodedCategoryId = null;
        const foundCategory = allCategories.find(cat => (cat.name || cat.id) === urlCategoryName);
        if (foundCategory) {
            decodedCategoryId = foundCategory.id;
        }

        let decodedGroupId = null;
        if (urlGroupName && decodedCategoryId) {
            const foundGroup = allGroups.find(group => (group.name || group.id) === urlGroupName && group.categoryId === decodedCategoryId);
            if (foundGroup) {
                decodedGroupId = foundGroup.id;
            }
        }
        
        // Ak existuje decodedCategoryId, pokracujeme s jeho spracovanim
        if (decodedCategoryId) {
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
                    displaySingleGroup(decodedGroupId);
                } else {
                    displayGroupsForCategory(decodedCategoryId);
                }
            } else {
                displayGroupsForCategory(decodedCategoryId);
            }
        } else {
            // Ak kategória z URL neexistuje (názov sa nenašiel), vrátime sa na zobrazenie kategórií
            goBackToCategories();
        }

    } else {
        goBackToCategories();
    }
});
window.addEventListener('resize', () => {
    // Pri zmene veľkosti okna nie je potrebné prepočítavať šírku, pretože je statická (založená na najdlhšom názve tímu).
    // Flexbox CSS sa postará o zalomenie do riadkov.
});

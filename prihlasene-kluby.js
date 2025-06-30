import { db, clubsCollectionRef, categoriesCollectionRef, groupsCollectionRef, getDocs, doc, getDoc, query, where } from './spravca-turnaja-common.js';
import { collection } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

const clubListSection = document.getElementById('clubListSection');
const clubsHeaderTable = document.getElementById('clubsHeaderTable');
const clubsBodyTable = document.getElementById('clubsBodyTable');
const clubsSummaryTableHeader = document.getElementById('clubsSummaryTableHeader');
const clubsSummaryTableBody = document.getElementById('clubsSummaryTableBody');
const longestNameRowFixedBody = document.getElementById('longestNameRowFixedBody');
const clubsBodyTableFooter = document.getElementById('clubsBodyTableFooter');
const clubDetailSection = document.getElementById('clubDetailSection');
const backToListButton = document.getElementById('backToListButton');
const clubDetailTitleSpan = document.querySelector('#clubDetailTitle span');
const teamsInCategoryButtonsDiv = document.getElementById('teamsInCategoryButtons');
const selectedTeamDetailsDiv = document.getElementById('selectedTeamDetails');
const selectedTeamNameSpan = document.getElementById('selectedTeamName'); // Toto sa už nepoužíva priamo, ale je v HTML
const selectedTeamRealizacnyTimDiv = document.getElementById('selectedTeamRealizacnyTim');
const selectedTeamTrenerInfoSpan = document.getElementById('selectedTeamTrenerInfo');
const selectedTeamVeduciDruzstvaInfoSpan = document.getElementById('selectedTeamVeduciDruzstvaInfo');
const selectedTeamSoupiskaHracovUl = document.getElementById('selectedTeamSoupiskaHracov');

let allClubs = [];
let allCategories = [];
let allGroups = [];
let referringPage = '';

/**
 * Načíta všetky potrebné dáta (kluby, kategórie, skupiny) z Firestore.
 * @returns {Promise<void>}
 */
async function loadAllData() {
    try {
        const clubsSnapshot = await getDocs(clubsCollectionRef);
        allClubs = clubsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const categoriesSnapshot = await getDocs(categoriesCollectionRef);
        allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allCategories.sort((a, b) => (a.name || a.id).localeCompare((b.name || b.id), 'sk-SK'));

        const groupsSnapshot = await getDocs(groupsCollectionRef);
        allGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        // Zmenené alert() na console.error a zobrazenie chyby v UI namiesto alertu
        console.error('Nepodarilo sa načítať dáta turnaja:', error);
        if (clubsSummaryTableBody) {
             const numPotentialColumns = 1 + 1 + (allCategories ? allCategories.length : 0);
             clubsSummaryTableBody.innerHTML = `<tr><td colspan="${numPotentialColumns}" style="text-align: center; color: red;">Chyba pri načítaní klubov.</td></tr>`;
        }
         allClubs = [];
         allCategories = [];
         allGroups = [];
         history.replaceState({}, '', window.location.pathname);
    }
}

/**
 * Získa základný názov klubu (odstráni suffixy ako A, B, C a čísla).
 * @param {object} club - Objekt klubu.
 * @returns {string} Základný názov klubu.
 */
function getClubBaseName(club) {
    let initialBaseName;
    if (club.name && typeof club.name === 'string' && club.name.trim() !== '') {
        initialBaseName = club.name.trim();
    } else if (club.id && typeof club.id === 'string' && club.id.includes(' - ')) {
        // Ak je ID v tvare "Kategória - Názov", vezmeme len názov
        const parts = club.id.split(' - ');
        initialBaseName = parts.length > 1 ? parts.slice(1).join(' - ').trim() : parts[0].trim();
    } else {
        initialBaseName = club.name || club.id || 'Neznámy subjekt';
    }

    // Odstránenie suffixov ako A, B, C alebo čísla na konci
    const trailingSuffixRegex = /\s+([A-Z]{1,3}|\d+)$/;
    const match = initialBaseName.match(trailingSuffixRegex);
    if (match) {
        initialBaseName = initialBaseName.substring(0, match.index).trim();
    }
    return initialBaseName;
}

/**
 * Aktualizuje <colgroup> elementy tabuliek pre správne zarovnanie stĺpcov.
 */
function updateColgroups() {
    const numColumns = 1 + 1 + allCategories.length; // Názov klubu + Tímy (celkovo) + Kategórie
    const updateTableColgroup = (table) => {
        if (table) {
            let colgroup = table.querySelector('colgroup');
            if (!colgroup) {
                colgroup = document.createElement('colgroup');
                if(table.firstElementChild) {
                    table.insertBefore(colgroup, table.firstElementChild);
                } else {
                     table.appendChild(colgroup);
                }
            }
            colgroup.innerHTML = '';
            for (let i = 0; i < numColumns; i++) {
                colgroup.appendChild(document.createElement('col'));
            }
        }
    };
    updateTableColgroup(clubsHeaderTable);
    updateTableColgroup(clubsBodyTable);
}

/**
 * Aktualizuje hlavičku a pätičku súhrnnej tabuľky klubov.
 */
function updateHeaderAndFooter() {
    updateColgroups();

    // Aktualizácia hlavičky (clubsSummaryTableHeader)
    if (clubsSummaryTableHeader) {
        clubsSummaryTableHeader.querySelectorAll('th:not(:first-child)').forEach(th => th.remove()); // Odstráni všetky okrem prvého "Názov klubu"
        const teamsTh = document.createElement('th');
        teamsTh.textContent = 'Tímy';
        teamsTh.style.textAlign = 'center';
         const firstTh = clubsSummaryTableHeader.querySelector('th');
         if(firstTh) {
             firstTh.insertAdjacentElement('afterend', teamsTh);
         } else {
             clubsSummaryTableHeader.appendChild(teamsTh);
         }

        if (allCategories.length > 0) {
            allCategories.forEach(category => {
                const th = document.createElement('th');
                th.textContent = category.name || category.id;
                th.dataset.categoryId = category.id;
                th.style.textAlign = 'center';
                clubsSummaryTableHeader.appendChild(th);
            });
        }
        // removeTransparentRows(clubsSummaryTableHeader.parentElement); // Odstráni transparentné riadky, ak nejaké sú - túto funkciu nebudeme volať tu
    }

    // Aktualizácia pätičky (clubsBodyTableFooter)
    if (clubsBodyTableFooter) {
        clubsBodyTableFooter.innerHTML = '';
        const footerRow = document.createElement('tr');
        const firstFooterCell = document.createElement('th');
        firstFooterCell.textContent = ''; // Prázdna bunka pre názov klubu
        footerRow.appendChild(firstFooterCell);

        const teamsFooterTh = document.createElement('th');
        teamsFooterTh.textContent = 'Tímy'; // Celkový počet tímov
        teamsFooterTh.style.textAlign = 'center';
        footerRow.appendChild(teamsFooterTh);

        if (allCategories.length > 0) {
            allCategories.forEach(category => {
                const footerTh = document.createElement('th');
                footerTh.textContent = category.name || category.id;
                footerTh.style.textAlign = 'center';
                footerRow.appendChild(footerTh);
            });
        }
        clubsBodyTableFooter.appendChild(footerRow);
        // removeTransparentRows(clubsBodyTableFooter); // Túto funkciu nebudeme volať tu
    }

    // Nastavenie colspan pre správu "Načítavam prehľad..."
    if (clubsSummaryTableBody) {
        const firstRow = clubsSummaryTableBody.querySelector('tr');
        if (firstRow && firstRow.cells.length === 1 && firstRow.cells[0].hasAttribute('colspan')) {
            const cell = firstRow.cells[0];
            const numColumns = 1 + 1 + allCategories.length;
            cell.colSpan = numColumns;
        }
    }
}

/**
 * Zobrazí súhrnnú tabuľku klubov.
 */
function displayClubsSummaryTable() {
    if (clubListSection) clubListSection.style.display = 'block';
    if (clubDetailSection) clubDetailSection.style.display = 'none';

    // Vyčistenie detailnej sekcie
    if (clubDetailTitleSpan) clubDetailTitleSpan.textContent = '';
    if (teamsInCategoryButtonsDiv) teamsInCategoryButtonsDiv.innerHTML = '';
    if(selectedTeamDetailsDiv) selectedTeamDetailsDiv.style.display = 'none';
    if(selectedTeamTrenerInfoSpan) selectedTeamTrenerInfoSpan.textContent = 'Nezadané';
    if(selectedTeamVeduciDruzstvaInfoSpan) selectedTeamVeduciDruzstvaInfoSpan.textContent = 'Nezadané';
    if(selectedTeamSoupiskaHracovUl) selectedTeamSoupiskaHracovUl.innerHTML = '<li>Zatiaľ bez súpisky.</li>';


    if (!clubsSummaryTableBody || !clubsSummaryTableHeader || !longestNameRowFixedBody || !clubsBodyTableFooter || !clubsHeaderTable || !clubsBodyTable) {
        return;
    }

    clubsSummaryTableBody.innerHTML = '';
    longestNameRowFixedBody.innerHTML = '';
    updateHeaderAndFooter();

    if (allClubs.length === 0) {
        const numColumns = 1 + 1 + allCategories.length;
        const noClubsRow = clubsSummaryTableBody.insertRow();
        const cell = noClubsRow.insertCell();
        cell.colSpan = numColumns;
        cell.textContent = "Zatiaľ nie sú pridané žiadne kluby pre prehľad.";
        cell.style.textAlign = 'center';
        longestNameRowFixedBody.innerHTML = ''; // Vyčistí aj fixed header
         if(clubsBodyTableFooter){
             clubsBodyTableFooter.innerHTML = ''; // Vyčistí aj footer
             const footerRow = clubsBodyTableFooter.insertRow();
             const footerCell = footerRow.insertCell();
             footerCell.colSpan = numColumns;
             footerCell.textContent = '';
         }
        return;
    }

    // Zoskupenie klubov podľa základného názvu
    const clubsByBaseName = allClubs.reduce((acc, club) => {
        const baseName = getClubBaseName(club);
        if (!acc[baseName]) {
            acc[baseName] = [];
        }
        acc[baseName].push(club);
        return acc;
    }, {});

    const sortedBaseNames = Object.keys(clubsByBaseName).sort((a, b) => a.localeCompare(b, 'sk-SK'));

    // Vytvorenie "fixed" hlavičky (riadok s najdlhším názvom)
    let longestBaseName = '';
    let clubsForLongestBaseName = [];

    if (sortedBaseNames.length > 0) {
        const baseNamesWithTeams = sortedBaseNames.filter(name => clubsByBaseName[name] && clubsByBaseName[name].length > 0);
        if (baseNamesWithTeams.length > 0) {
             // Nájdeme najdlhší názov medzi tými, ktoré majú tímy
             longestBaseName = baseNamesWithTeams.reduce((a, b) => a.length > b.length ? a : b);
             clubsForLongestBaseName = allClubs.filter(club => getClubBaseName(club) === longestBaseName);
        }
    }

    if (longestBaseName) {
        const longestNameRow = longestNameRowFixedBody.insertRow();
        longestNameRow.dataset.baseName = longestBaseName;
        longestNameRow.dataset.isFixedHeader = 'true';

        const cellBaseName = longestNameRow.insertCell();
        cellBaseName.textContent = longestBaseName;

        let totalTeamsCount = 0;
        allCategories.forEach(category => {
            const categoryId = category.id;
            const teamsInCategoryCount = clubsForLongestBaseName.filter(club => club.categoryId === categoryId).length;
            totalTeamsCount += teamsInCategoryCount;
        });

        const cellTotalTeams = longestNameRow.insertCell();
        cellTotalTeams.textContent = totalTeamsCount > 0 ? totalTeamsCount.toString() : '';
        cellTotalTeams.style.textAlign = 'center';
        cellTotalTeams.dataset.isCountCell = 'true';

        allCategories.forEach(category => {
            const countCell = longestNameRow.insertCell();
            const categoryId = category.id;
            const teamsInCategoryCount = clubsForLongestBaseName.filter(club => club.categoryId === categoryId).length;
            countCell.textContent = teamsInCategoryCount > 0 ? teamsInCategoryCount.toString() : '';
            countCell.style.textAlign = 'center';
            countCell.dataset.isCountCell = 'true';
            countCell.dataset.categoryId = categoryId;
        });
        longestNameRow.dataset.totalTeams = totalTeamsCount;
         longestNameRow.dataset.hasTeams = totalTeamsCount > 0;
    }

    // Vykreslenie riadkov pre každý základný názov klubu
    sortedBaseNames.forEach(baseName => {
        const row = clubsSummaryTableBody.insertRow();
        row.dataset.baseName = baseName;
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
             const url = new URL(window.location.href);
             url.searchParams.set('club', baseName);
             url.searchParams.delete('team'); // Odstránime teamId, ak je prítomné
             url.searchParams.delete('category'); // Odstránime category, ak je prítomné
             url.searchParams.delete('group'); // Odstránime group, ak je prítomné
             history.pushState({ baseName: baseName }, '', url.toString());
             displaySubjectDetails(baseName);
        });

        const baseNameCell = row.insertCell();
        baseNameCell.textContent = baseName;

        let totalTeamsCount = 0;
         allCategories.forEach(category => {
             const categoryId = category.id;
             const teamsInCategoryCount = clubsByBaseName[baseName].filter(club => club.categoryId === categoryId).length;
             totalTeamsCount += teamsInCategoryCount;
         });

        const totalTeamsCell = row.insertCell();
        totalTeamsCell.textContent = totalTeamsCount.toString();
        totalTeamsCell.style.textAlign = 'center';
        totalTeamsCell.dataset.isCountCell = 'true';

        allCategories.forEach(category => {
            const countCell = row.insertCell();
            const categoryId = category.id;
            const teamsInCategoryCount = clubsByBaseName[baseName].filter(club => club.categoryId === categoryId).length;
            countCell.textContent = teamsInCategoryCount > 0 ? teamsInCategoryCount.toString() : '';
            countCell.style.textAlign = 'center';
            countCell.dataset.isCountCell = 'true';
            countCell.dataset.categoryId = categoryId;
        });
        row.dataset.totalTeams = totalTeamsCount;
         row.dataset.hasTeams = totalTeamsCount > 0;
    });

    requestAnimationFrame(() => {
         adjustTableWidthsAndCleanUp();
    });
}

/**
 * Prispôsobí šírky stĺpcov tabuliek a vyčistí "nulové" riadky.
 */
function adjustTableWidthsAndCleanUp() {
    if (!clubsHeaderTable || !clubsBodyTable || !clubsSummaryTableBody || !longestNameRowFixedBody) {
         if(clubsSummaryTableBody) {
              cleanUpZeroRows(); // Uistite sa, že sa volá aj v prípade chýbajúcich elementov
         }
        return;
    }

    const headerCols = clubsHeaderTable.querySelectorAll('colgroup col');
    const bodyCols = clubsBodyTable.querySelectorAll('colgroup col');
    const numColumns = headerCols.length;

    if (numColumns === 0) {
         cleanUpZeroRows();
        return;
    }

    const columnWidths = Array(numColumns).fill(0);

    // Zmeranie šírok z fixed hlavičky
    const fixedRow = longestNameRowFixedBody.querySelector('tr');
    if (fixedRow && fixedRow.cells.length === numColumns) {
        Array.from(fixedRow.cells).forEach((cell, index) => {
            columnWidths[index] = Math.max(columnWidths[index], cell.getBoundingClientRect().width);
        });
    }

    // Zmeranie šírok z riadkov tela tabuľky
    const rowsToMeasure = Array.from(clubsSummaryTableBody.querySelectorAll('tr'));
    rowsToMeasure.forEach(row => {
         if (row.cells.length === numColumns) { // Uistite sa, že riadok má správny počet buniek
              Array.from(row.cells).forEach((cell, index) => {
                   columnWidths[index] = Math.max(columnWidths[index], cell.getBoundingClientRect().width);
              });
         }
    });

    // Nastavenie šírok stĺpcov
    columnWidths.forEach((width, index) => {
        const finalWidth = width; // Môžete pridať nejaký padding, napr. + 10
        if (headerCols[index]) {
            headerCols[index].style.width = `${finalWidth}px`;
        }
        if (bodyCols[index]) {
            bodyCols[index].style.width = `${finalWidth}px`;
        }
    });

    // Vyčistenie transparentných riadkov a "nulových" riadkov
    removeTransparentRows(clubsSummaryTableBody);
    removeTransparentRows(longestNameRowFixedBody);
    // removeTransparentRows(clubsSummaryTableHeader); // Túto funkciu nebudeme volať tu
    cleanUpZeroRows(); // Voláme na konci, aby sa spracovali všetky zmeny
}

/**
 * Odstráni riadky, ktoré nemajú žiadne tímy (totalTeams === 0).
 */
function cleanUpZeroRows() {
     if (!clubsSummaryTableBody || !longestNameRowFixedBody) {
          return;
     }

     const rowsToRemove = [];
     clubsSummaryTableBody.querySelectorAll('tr').forEach(row => {
         // Kontrola, či riadok nemá žiadne tímy
         if (row.dataset.totalTeams === '0') {
             rowsToRemove.push(row);
         }
     });

     rowsToRemove.forEach(row => {
          row.remove();
     });

     // Ak po vyčistení nezostali žiadne riadky s tímami, zobrazíme správu
     if (clubsSummaryTableBody.children.length === 0) {
         const numColumns = 1 + 1 + allCategories.length;
         const noClubsRow = clubsSummaryTableBody.insertRow();
         const cell = noClubsRow.insertCell();
         cell.colSpan = numColumns;
         cell.textContent = "Zatiaľ nie sú pridané žiadne kluby pre prehľad s prihlásenými tímami.";
         cell.style.textAlign = 'center';
     }

      // Skrytie/zobrazenie fixed hlavičky
      const fixedRow = longestNameRowFixedBody.querySelector('tr');
      if (fixedRow && clubsSummaryTableBody.children.length === 1 && clubsSummaryTableBody.querySelector('td[colspan]')) {
           fixedRow.style.display = 'none';
      } else if (fixedRow) {
           fixedRow.style.display = '';
      }
}

/**
 * Zvýrazní tlačidlo konkrétneho tímu v detailnej sekcii.
 * @param {string|null} teamIdToHighlight - ID tímu, ktorý sa má zvýrazniť, alebo null pre zrušenie zvýraznenia.
 */
function highlightTeamButton(teamIdToHighlight) {
     if (teamsInCategoryButtonsDiv) {
          teamsInCategoryButtonsDiv.querySelectorAll('button').forEach(btn => {
              btn.style.fontWeight = 'normal';
              btn.style.backgroundColor = '';
              btn.style.color = '';
              btn.classList.remove('active-team-button');
          });

          const targetButton = teamsInCategoryButtonsDiv.querySelector(`button[data-team-id="${teamIdToHighlight}"]`);
          if (targetButton) {
              targetButton.style.fontWeight = 'bold';
              targetButton.style.backgroundColor = '#c46f50'; // Farba zvýraznenia
              targetButton.style.color = 'white'; // Farba textu pre zvýraznenie
              targetButton.classList.add('active-team-button');
          }
     }
}

/**
 * Zobrazí detaily pre vybraný subjekt (základný názov klubu) a jeho tímy.
 * @param {string} baseName - Základný názov klubu.
 * @param {string|null} initialTeamId - Voliteľné ID tímu, ktorý sa má zobraziť ako prvý.
 */
async function displaySubjectDetails(baseName, initialTeamId = null) {
     if (clubListSection) clubListSection.style.display = 'none';
     if (clubDetailSection) clubDetailSection.style.display = 'block';

     if(clubDetailTitleSpan) clubDetailTitleSpan.textContent = baseName;
     if(teamsInCategoryButtonsDiv) teamsInCategoryButtonsDiv.innerHTML = 'Načítavam tímy...';
     if(selectedTeamDetailsDiv) selectedTeamDetailsDiv.style.display = 'none';
     if(selectedTeamTrenerInfoSpan) selectedTeamTrenerInfoSpan.textContent = 'Nezadané';
     if(selectedTeamVeduciDruzstvaInfoSpan) selectedTeamVeduciDruzstvaInfoSpan.textContent = 'Nezadané';
     if(selectedTeamSoupiskaHracovUl) selectedTeamSoupiskaHracovUl.innerHTML = '<li>Zatiaľ bez súpisky.</li>';

     const teamsForSubject = allClubs.filter(club => getClubBaseName(club) === baseName);

     if (!teamsInCategoryButtonsDiv) {
         return;
     }

     teamsInCategoryButtonsDiv.innerHTML = ''; // Vyčistí pred načítaním

     if (teamsForSubject.length === 0) {
         const noTeamsMessage = document.createElement('p');
         noTeamsMessage.textContent = `Žiadne tímy pre subjekt "${baseName}".`;
         teamsInCategoryButtonsDiv.appendChild(noTeamsMessage);
         if(selectedTeamDetailsDiv) selectedTeamDetailsDiv.style.display = 'none';
     } else {
          // Zoradenie tímov pre tlačidlá
          teamsForSubject.sort((a, b) => {
               let categoryA = allCategories.find(cat => String(cat.id) === String(a.categoryId));
               let categoryNameA = (categoryA && categoryA.name) ? categoryA.name : (String(a.categoryId) || 'Neznáma kategória');
               let groupA = allGroups.find(g => String(g.id) === String(a.groupId));
               let groupNameA = groupA ? (groupA.name || String(groupA.id)) : 'Nepriradené';
               const teamTextA = `${categoryNameA}${groupNameA !== 'Nepriradené' ? ' - ' + groupNameA : ''}`;

               let categoryB = allCategories.find(cat => String(cat.id) === String(b.categoryId));
               let categoryNameB = (categoryB && categoryB.name) ? categoryB.name : (String(b.categoryId) || 'Neznáma kategória');
               let groupB = allGroups.find(g => String(g.id) === String(b.groupId));
               let groupNameB = groupB ? (groupB.name || String(groupB.id)) : 'Nepriradené';
               const teamTextB = `${categoryNameB}${groupNameB !== 'Nepriradené' ? ' - ' + groupNameB : ''}`;

               return teamTextA.localeCompare(teamTextB, 'sk-SK');
           });

          teamsForSubject.forEach(team => {
               const teamButton = document.createElement('button');
               teamButton.classList.add('action-button');

               const group = allGroups.find(g => String(g.id) === String(team.groupId));
               const groupName = group ? (group.name || String(group.id)) : 'Nepriradené';

               let categoryName = 'Neznáma kategória';
               const category = allCategories.find(cat => String(cat.id) === String(team.categoryId));
               if (category && category.name) {
                    categoryName = category.name;
               } else {
                   // Ak kategória nie je nájdená, pokúsime sa ju parsovať z ID tímu
                   const teamIdString = String(team.id) || '';
                   const separator = ' - ';
                   let separatorIndex = teamIdString.indexOf(separator);
                   if (separatorIndex === -1) {
                       separatorIndex = teamIdString.indexOf('-'); // Pre staršie formáty
                   }
                   if (separatorIndex !== -1) {
                       categoryName = teamIdString.substring(0, separatorIndex).trim();
                   }
               }
               // Konštruujeme text tlačidla
               const buttonText = groupName !== 'Nepriradené' ? `${categoryName} - ${groupName}` : categoryName;
               teamButton.textContent = buttonText;
               teamButton.dataset.teamId = team.id; // Uložíme ID tímu do datasetu

               teamButton.addEventListener('click', () => {
                    const url = new URL(window.location.href);
                    // Nastavujeme URL parametre na základe názvu kategórie a skupiny
                    url.searchParams.set('club', baseName);
                    url.searchParams.set('category', categoryName);
                    url.searchParams.set('group', groupName);
                    url.searchParams.set('teamId', team.id); // Pridáme team.id
                    // Pre zobrazenie detailov stále potrebujeme unikátne ID tímu, uložíme ho do history.state
                    history.pushState({ baseName: baseName, categoryName: categoryName, groupName: groupName, teamId: team.id }, '', url.toString());
                    displaySpecificTeamDetails(team.id);
                });
               teamsInCategoryButtonsDiv.appendChild(teamButton);
           });

           // Zobrazíme detaily prvého tímu, alebo tímu z URL
           const teamToDisplay = (initialTeamId && teamsForSubject.find(t => String(t.id) === String(initialTeamId)))
                                 ? teamsForSubject.find(t => String(t.id) === String(initialTeamId))
                                 : (teamsForSubject.length > 0 ? teamsForSubject[0] : null);

           if (teamToDisplay) {
                displaySpecificTeamDetails(teamToDisplay.id);
           } else {
                if(selectedTeamDetailsDiv) selectedTeamDetailsDiv.style.display = 'none'; // Skryje detaily, ak nie je tím na zobrazenie
           }
     }
}

/**
 * Zobrazí detailné informácie o konkrétnom tíme.
 * @param {string} teamId - ID tímu, ktorého detaily sa majú zobraziť.
 */
async function displaySpecificTeamDetails(teamId) {
    if(selectedTeamDetailsDiv) selectedTeamDetailsDiv.style.display = 'block'; // Zobrazí detailný blok
    if(selectedTeamTrenerInfoSpan) selectedTeamTrenerInfoSpan.textContent = 'Načítavam...';
    if(selectedTeamVeduciDruzstvaInfoSpan) selectedTeamVeduciDruzstvaInfoSpan.textContent = 'Načítavam...';
    if(selectedTeamSoupiskaHracovUl) selectedTeamSoupiskaHracovUl.innerHTML = '<li>Načítavam súpisku...</li>';

    try {
        const teamDocRef = doc(clubsCollectionRef, teamId);
        const teamDoc = await getDoc(teamDocRef);

        if (!teamDoc.exists()) {
            if(selectedTeamTrenerInfoSpan) selectedTeamTrenerInfoSpan.textContent = 'Chyba: Tím nenájdený';
            if(selectedTeamVeduciDruzstvaInfoSpan) selectedTeamVeduciDruzstvaInfoSpan.textContent = 'Chyba: Tím nenájdený';
            if(selectedTeamSoupiskaHracovUl) selectedTeamSoupiskaHracovUl.innerHTML = '<li>Chyba pri načítaní súpisky.</li>';
            highlightTeamButton(null); // Zruší zvýraznenie
            if(selectedTeamDetailsDiv) selectedTeamDetailsDiv.style.display = 'none';
            return;
        }

        const teamData = teamDoc.data();

        // Zobrazenie názvu tímu
         const baseName = getClubBaseName(teamData);
         const category = allCategories.find(cat => String(cat.id) === String(teamData.categoryId));
         const categoryName = (category && category.name) ? category.name : (String(teamData.categoryId) || 'Neznáma kategória');
         const group = allGroups.find(g => String(g.id) === String(teamData.groupId));
         const groupName = group ? (group.name || String(group.id)) : 'Nepriradené';

         // Aktualizácia hlavného titulku na základe nájdeného tímu
         if (clubDetailTitleSpan) clubDetailTitleSpan.textContent = `${baseName} - ${categoryName}${groupName !== 'Nepriradené' ? ' - ' + groupName : ''}`;

        // Načítanie a zobrazenie realizačného tímu
        if (selectedTeamRealizacnyTimDiv) {
            const realizacnyTimCollectionRef = collection(teamDoc.ref, 'realizacnyTim');
            try {
                 const realizacnyTimSnapshot = await getDocs(realizacnyTimCollectionRef);
                 let trenerName = 'Nezadané';
                 let veduciName = 'Nezadané';

                 realizacnyTimSnapshot.docs.forEach(staffDoc => {
                      const staffData = staffDoc.data();
                      if (staffDoc.id === 'trener' && staffData && staffData.meno) {
                           trenerName = staffData.meno;
                      } else if (staffDoc.id === 'veduci' && staffData && staffData.meno) {
                           veduciName = staffData.meno;
                      }
                 });
                 if(selectedTeamTrenerInfoSpan) selectedTeamTrenerInfoSpan.textContent = trenerName;
                 if(selectedTeamVeduciDruzstvaInfoSpan) selectedTeamVeduciDruzstvaInfoSpan.textContent = veduciName;
             } catch (realizacnyTimError) {
                 console.error("Chyba pri načítaní realizačného tímu:", realizacnyTimError);
                 if(selectedTeamTrenerInfoSpan) selectedTeamTrenerInfoSpan.textContent = 'Chyba pri načítaní';
                 if(selectedTeamVeduciDruzstvaInfoSpan) selectedTeamVeduciDruzstvaInfoSpan.textContent = 'Chyba pri načítaní';
             }
        }

        // Načítanie a zobrazenie súpisky hráčov
        if (selectedTeamSoupiskaHracovUl) {
             selectedTeamSoupiskaHracovUl.innerHTML = ''; // Vyčistí pred naplnením
             const hraciCollectionRef = collection(teamDoc.ref, 'hraci');
             try {
                  const hraciSnapshot = await getDocs(hraciCollectionRef);
                  if (hraciSnapshot.empty) {
                       const noPlayersItem = document.createElement('li');
                       noPlayersItem.textContent = 'Zatiaľ bez súpisky.';
                       selectedTeamSoupiskaHracovUl.appendChild(noPlayersItem);
                  } else {
                       const hraciList = hraciSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                       hraciList.sort((a, b) => {
                            const orderA = typeof a.cisloDresu === 'number' ? a.cisloDresu : Infinity;
                            const orderB = typeof b.cisloDresu === 'number' ? b.cisloDresu : Infinity;
                            if (orderA !== orderB) {
                                return orderA - orderB;
                            }
                            const nameA = (a.meno || a.id || '').toLowerCase();
                            const nameB = (b.meno || b.id || '').toLowerCase();
                            return nameA.localeCompare(nameB, 'sk-SK');
                       });

                       hraciList.forEach(hrac => {
                            const hracItem = document.createElement('li');
                            let hracText = '';
                            if (typeof hrac.cisloDresu === 'number' && hrac.cisloDresu > 0) {
                                 hracText += `${hrac.cisloDresu}. `;
                            }
                            hracText += hrac.meno || hrac.id || 'Neznámy hráč';
                            hracItem.textContent = hracText;
                            selectedTeamSoupiskaHracovUl.appendChild(hracItem);
                       });
                  }
             } catch (hraciError) {
                  console.error("Chyba pri načítaní súpisky hráčov:", hraciError);
                  if (selectedTeamSoupiskaHracovUl) {
                       selectedTeamSoupiskaHracovUl.innerHTML = '<li>Chyba pri načítaní súpisky.</li>';
                  }
             }
        }
    } catch (error) {
         console.error("Chyba pri zobrazení detailov tímu:", error);
         if(clubDetailTitleSpan) clubDetailTitleSpan.textContent = 'Chyba pri načítaní detailov tímu';
         if(selectedTeamRealizacnyTimDiv) selectedTeamRealizacnyTimDiv.innerHTML = '<p style="color: red;">Nepodarilo sa načítať detaily realizačného tímu.</p>';
         if(selectedTeamSoupiskaHracovUl) selectedTeamSoupiskaHracovUl.innerHTML = '<li>Nepodarilo sa načítať súpisku.</li>';
          highlightTeamButton(null); // Zruší zvýraznenie
           if(selectedTeamDetailsDiv) selectedTeamDetailsDiv.style.display = 'none';
    } finally {
        highlightTeamButton(teamId); // Zvýrazní tlačidlo po načítaní
    }
}

/**
 * Vráti používateľa na predchádzajúcu stránku alebo na súhrnnú tabuľku.
 */
function goBackToList() {
    // Ak sme prišli zo zobrazenia skupín, vrátime sa späť v histórii prehliadača
    if (referringPage.includes('zobrazenie-skupin.html')) {
        history.back();
    } else {
        // Inak, zobrazíme súhrnnú tabuľku a vyčistíme URL parametre
        displayClubsSummaryTable();
        history.replaceState({}, '', window.location.pathname);
    }
}

/**
 * Odstráni transparentné riadky z daného kontajnera.
 * @param {HTMLElement} container - HTML element, z ktorého sa majú odstrániť riadky.
 */
function removeTransparentRows(container) {
    if (!container) return;
    const rows = Array.from(container.querySelectorAll('tr'));
    for (const row of rows) {
        const hasTransparentCell = Array.from(row.cells).some(cell => {
            const style = window.getComputedStyle(cell);
            return style.color === 'rgba(0, 0, 0, 0)' || style.color === 'transparent';
        });
        if (hasTransparentCell) {
            row.remove();
        }
    }
}

/**
 * Spracuje stav URL pri načítaní stránky a naviguje na príslušné zobrazenie.
 */
async function handleUrlState() {
    await loadAllData(); // Načíta všetky dáta na začiatku

    if (document.referrer) {
        const referrerUrl = new URL(document.referrer);
        referringPage = referrerUrl.pathname;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const clubBaseName = urlParams.get('club');
    const categoryUrlParam = urlParams.get('category');
    const groupUrlParam = urlParams.get('group');
    const teamIdFromUrl = urlParams.get('teamId'); // NOVÉ: Získame teamId priamo z URL

    let teamIdToDisplay = null;

    if (teamIdFromUrl) {
        // Ak je teamId priamo v URL, prioritne ho použijeme
        const foundTeamById = allClubs.find(c => String(c.id) === String(teamIdFromUrl));
        if (foundTeamById) {
            teamIdToDisplay = foundTeamById.id;
            // Aktualizujeme history.state, aby zodpovedal aktuálnym parametrom
            const currentClubBaseName = getClubBaseName(foundTeamById);
            const category = allCategories.find(cat => String(cat.id) === String(foundTeamById.categoryId));
            const currentCategoryName = (category && category.name) ? category.name : (String(foundTeamById.categoryId) || 'Neznáma kategória');
            const group = allGroups.find(g => String(g.id) === String(foundTeamById.groupId));
            const currentGroupName = group ? (group.name || String(group.id)) : 'Nepriradené';

            const url = new URL(window.location.href);
            url.searchParams.set('club', currentClubBaseName);
            url.searchParams.set('category', currentCategoryName);
            url.searchParams.set('group', currentGroupName);
            url.searchParams.set('teamId', teamIdToDisplay);
            history.replaceState({ baseName: currentClubBaseName, categoryName: currentCategoryName, groupName: currentGroupName, teamId: teamIdToDisplay }, '', url.toString());
        }
    } else if (clubBaseName && categoryUrlParam && groupUrlParam) {
        // Ak nie je teamId priamo, ale sú ostatné parametre, pokúsime sa nájsť tím
        const foundTeam = allClubs.find(c => {
            const currentBaseName = getClubBaseName(c);
            const category = allCategories.find(cat => String(cat.id) === String(c.categoryId));
            const currentCategoryName = (category && category.name) ? category.name : (String(c.categoryId) || 'Neznáma kategória');
            const group = allGroups.find(g => String(g.id) === String(c.groupId));
            const currentGroupName = group ? (group.name || String(group.id)) : 'Nepriradené';

            return currentBaseName === clubBaseName &&
                   currentCategoryName === categoryUrlParam &&
                   currentGroupName === groupUrlParam;
        });

        if (foundTeam) {
            teamIdToDisplay = foundTeam.id;
            const url = new URL(window.location.href);
            url.searchParams.set('club', clubBaseName);
            url.searchParams.set('category', categoryUrlParam);
            url.searchParams.set('group', groupUrlParam);
            url.searchParams.set('teamId', teamIdToDisplay); // Doplníme teamId do URL
            history.replaceState({ baseName: clubBaseName, categoryName: categoryUrlParam, groupName: groupUrlParam, teamId: teamIdToDisplay }, '', url.toString());
        }
    } else if (clubBaseName) {
        // Ak je prítomný len clubBaseName, zobrazíme detaily subjektu a prvý tím
        const teamsForSubject = allClubs.filter(club => getClubBaseName(club) === clubBaseName);
        if (teamsForSubject.length > 0) {
            const firstTeam = teamsForSubject[0];
            const category = allCategories.find(cat => String(cat.id) === String(firstTeam.categoryId));
            const categoryName = (category && category.name) ? category.name : (String(firstTeam.categoryId) || 'Neznáma kategória');
            const group = allGroups.find(g => String(g.id) === String(firstTeam.groupId));
            const groupName = group ? (group.name || String(group.id)) : 'Nepriradené';

            // Aktualizujeme URL, aby obsahovala kategóriu a skupinu (pre prvý tím)
            const url = new URL(window.location.href);
            url.searchParams.set('club', clubBaseName);
            url.searchParams.set('category', categoryName);
            url.searchParams.set('group', groupName);
            url.searchParams.set('teamId', firstTeam.id); // Pridáme teamId
            history.replaceState({ baseName: clubBaseName, categoryName: categoryName, groupName: groupName, teamId: firstTeam.id }, '', url.toString());

            teamIdToDisplay = firstTeam.id;
        }
    }

    // Ak sa teamIdToDisplay našlo (či už z URL alebo ako prvý tím), zobrazíme detaily
    if (teamIdToDisplay) {
        displaySubjectDetails(clubBaseName || 'Neznámy subjekt', teamIdToDisplay); // Použijeme clubBaseName z URL alebo default
    } else {
        // Ak sa nenašiel žiadny tím alebo chýbajú parametre, zobrazíme súhrnnú tabuľku
        displayClubsSummaryTable();
        history.replaceState({}, '', window.location.pathname); // Vyčistíme URL parametre
    }
}

// Spustí sa po načítaní DOM obsahu
document.addEventListener('DOMContentLoaded', () => {
    handleUrlState();

    // Pridanie listenera pre tlačidlo "Späť"
    const currentBackToListButton = document.getElementById('backToListButton');
    if (currentBackToListButton) {
        currentBackToListButton.removeEventListener('click', goBackToList); // Odstránenie starého listenera
        currentBackToListButton.addEventListener('click', goBackToList);
    }
});

// Listener pre zmeny v histórii prehliadača (napr. stlačenie tlačidla Späť/Vpred)
window.addEventListener('popstate', () => {
    handleUrlState();
});

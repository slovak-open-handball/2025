import { db, categoriesCollectionRef, groupsCollectionRef, clubsCollectionRef, matchesCollectionRef, playingDaysCollectionRef, placesCollectionRef, openModal, closeModal, populateCategorySelect, populateGroupSelect, getDocs, doc, setDoc, addDoc, getDoc, query, where, orderBy, deleteDoc, writeBatch, settingsCollectionRef, showMessage, showConfirmation } from './spravca-turnaja-common.js';
import { collection, deleteField, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';


const SETTINGS_DOC_ID = 'matchTimeSettings';
export const blockedSlotsCollectionRef = collection(db, 'tournamentData', 'mainTournamentData', 'blockedSlots');

/**
 * Pomocná funkcia na konverziu "HH:MM" na minúty od polnoci.
 * @param {string} timeStr Reťazec času vo formáte "HH:MM".
 * @returns {number} Minúty od polnoci.
 */
function parseTimeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Pomocná funkcia na formátovanie minút od polnoci na reťazec "HH:MM".
 * @param {number} minutes Minúty od polnoci.
 * @returns {string} Reťazec času vo formáte "HH:MM".
 */
function formatMinutesToTime(minutes) {
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Pomocná funkcia na výpočet koncového času "stopy" zápasu (trvanie zápasu + čas medzi zápasmi).
 * @param {string} startTimeStr Počiatočný čas zápasu vo formáte "HH:MM".
 * @param {number} duration Trvanie zápasu v minútach.
 * @param {number} bufferTime Čas medzi zápasmi v minútach.
 * @returns {string} Formátovaný koncový čas stopy zápasu.
 */
function calculateFootprintEndTime(startTimeStr, duration, bufferTime) {
    const startInMinutes = parseTimeToMinutes(startTimeStr);
    const endInMinutes = startInMinutes + duration + bufferTime;
    return formatMinutesToTime(endInMinutes);
}

/**
 * Animuje daný text postupným vypisovaním, zvýrazňovaním a následným postupným mazaním v nekonečnej slučke.
 * @param {string} containerId ID HTML elementu, kde sa má animovaný text zobraziť.
 * @param {string} text Reťazec textu na animáciu.
 */
async function animateLoadingText(containerId, text) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const characters = text.split('');
    const charElements = characters.map(char => {
        const span = document.createElement('span');
        span.className = 'loading-char';
        span.innerHTML = char === ' ' ? '&nbsp;' : char; 
        container.appendChild(span);
        return span;
    });

    if (!document.getElementById('loading-char-style')) {
        const style = document.createElement('style');
        style.id = 'loading-char-style';
        style.textContent = `
            .loading-char {
                opacity: 0;
                display: inline-block;
                transition: opacity 0.1s ease-in-out, font-weight 0.3s ease-in-out;
                min-width: 0.5em;
            }
            .loading-char.visible {
                opacity: 1;
            }
            .loading-char.bold {
                font-weight: bold;
            }
            .footer-spacer-row {
                background-color: white !important;
            }
            .footer-spacer-row:hover {
                background-color: white !important;
                cursor: default;
            }
            /* Aktualizované štýly pre tlačidlá v modálnych oknách */
            .modal-content button[type="submit"],
            .modal-content button.action-button,
            .modal-content button.delete-button {
                width: calc(100% - 22px); /* Rozšíri sa na celú šírku vstupného poľa */
                box-sizing: border-box; /* Zahrnie padding a okraj do šírky */
                margin-top: 15px; /* Priestor nad tlačidlom */
            }
            .modal-content button.delete-button {
                margin-left: -1px;
            }
            /* Nové štýly pre okraje buniek tabuľky */
            .match-list-table td {
                border-right: 1px solid #EAEAEA;
            }
            .match-list-table td:last-child {
                border-right: none;
            }
            /* Štýly pre Drag & Drop */
            .match-row.dragging {
                opacity: 0.5;
                border: 2px dashed #007bff;
            }
            .drop-over-row {
                background-color: #e6f7ff !important; /* Svetlomodrá pre prázdne sloty, na ktoré sa dá pustiť */
                border: 2px dashed #007bff;
            }
            .drop-target-active {
                background-color: #f0f8ff !important; /* Svetlejšia modrá pre pozadie dátumovej skupiny */
                border: 2px dashed #007bff;
            }
            .drop-over-forbidden {
                background-color: #ffe6e6 !important; /* Svetločervená pre zakázané ciele pustenia */
                border: 2px dashed #dc3545;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
    }

    let animationId;
    let charIndex = 0;
    let bolding = false;
    let typingDirection = 1; // 1 pre písanie, -1 pre mazanie

    const typeSpeed = 70;
    const unTypeSpeed = 50;
    const boldDuration = 500;
    const pauseDuration = 1000;

    const animate = () => {
        if (typingDirection === 1) { // Vypisovanie
            if (charIndex < charElements.length) {
                charElements[charIndex].classList.add('visible');
                charIndex++;
                animationId = setTimeout(animate, typeSpeed);
            } else { // Dokončené vypisovanie, začiatok zvýrazňovania
                bolding = true;
                charElements.forEach(span => span.classList.add('bold'));
                animationId = setTimeout(() => {
                    bolding = false;
                    typingDirection = -1; // Začiatok mazania
                    animationId = setTimeout(animate, pauseDuration); // Pauza pred mazaním
                }, boldDuration);
            }
        } else { // Mazanie
            if (charIndex > 0) {
                charIndex--;
                charElements[charIndex].classList.remove('bold');
                charElements[charIndex].classList.remove('visible');
                animationId = setTimeout(animate, unTypeSpeed);
            } else { // Dokončené mazanie, reset a opätovné začatie písania
                typingDirection = 1;
                animationId = setTimeout(animate, pauseDuration); // Pauza pred opätovným písaním
            }
        }
    };

    animate();

    // Vráti funkciu na zastavenie animácie
    return () => {
        clearTimeout(animationId);
        container.innerHTML = ''; // Vymaže obsah
    };
}


/**
 * Naplní select element dátumami hracích dní.
 * @param {HTMLSelectElement} selectElement Select element na naplnenie.
 * @param {string} selectedDate Dátum na predvolené vybratie.
 */
async function populatePlayingDaysSelect(selectElement, selectedDate = '') {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Vyberte dátum --</option>';
    try {
        const querySnapshot = await getDocs(query(playingDaysCollectionRef, orderBy("date", "asc")));
        querySnapshot.forEach((doc) => {
            const day = doc.data();
            const option = document.createElement('option');
            option.value = day.date;            
            const dateObj = new Date(day.date);
            const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}. ${String(dateObj.getMonth() + 1).padStart(2, '0')}. ${dateObj.getFullYear()}`;
            option.textContent = formattedDate;            
            selectElement.appendChild(option);
        });
        if (selectedDate) {
            selectElement.value = selectedDate;
        }
    } catch (error) {
        console.error("Chyba pri načítaní hracích dní:", error);
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '-- Chyba pri načítaní dátumov --';
        option.disabled = true;
        selectElement.appendChild(option);
    }
}

/**
 * Naplní select element názvami športových hál.
 * @param {HTMLSelectElement} selectElement Select element na naplnenie.
 * @param {string} selectedPlaceName Názov športovej haly na predvolené vybratie.
 */
async function populateSportHallSelects(selectElement, selectedPlaceName = '') {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Vyberte miesto (športovú halu) --</option>';
    try {
        const querySnapshot = await getDocs(query(placesCollectionRef, where("type", "==", "Športová hala"), orderBy("name", "asc")));
        if (querySnapshot.empty) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '-- Žiadne športové haly nenájdené --';
            option.disabled = true;
            selectElement.appendChild(option);
        } else {
            querySnapshot.forEach((doc) => {
                const place = { id: doc.id, ...doc.data() };
                const option = document.createElement('option');
                option.value = place.name;
                option.textContent = `${place.name}`;
                selectElement.appendChild(option);
            });
        }
        if (selectedPlaceName) {
            selectElement.value = selectedPlaceName;
        }
    } catch (error) {
        console.error("Chyba pri načítaní hál:", error);
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '-- Chyba pri načítaní hál --';
        option.disabled = true;
        selectElement.appendChild(option);
    }
}

/**
 * Naplní select element názvami všetkých miest.
 * @param {HTMLSelectElement} selectElement Select element na naplnenie.
 * @param {string} selectedPlaceCombined Kombinovaný názov miesta a typu na predvolené vybratie.
 */
async function populateAllPlaceSelects(selectElement, selectedPlaceCombined = '') {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Vyberte miesto --</option>';
    try {
        const querySnapshot = await getDocs(query(placesCollectionRef, orderBy("name", "asc")));
        if (querySnapshot.empty) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '-- Žiadne miesta nenájdené --';
            option.disabled = true;
            selectElement.appendChild(option);
        } else {
            querySnapshot.forEach((doc) => {
                const place = { id: doc.id, ...doc.data() };
                const option = document.createElement('option');
                option.value = `${place.name}:::${place.type}`;
                option.textContent = `${place.name} (${place.type})`;
                selectElement.appendChild(option);
            });
        }
        if (selectedPlaceCombined) {
            selectElement.value = selectedPlaceCombined;
        }
    } catch (error) {
        console.error("Chyba pri načítaní miest:", error);
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '-- Chyba pri načítaní miest --';
        option.disabled = true;
        selectElement.appendChild(option);
    }
}

/**
 * Získa nastavenia zápasu pre konkrétnu kategóriu.
 * @param {string} categoryId ID kategórie.
 * @param {object} currentAllSettings Aktuálny objekt allSettings.
 * @returns {object} Objekt obsahujúci trvanie a čas medzi zápasmi.
 */
function getCategoryMatchSettings(categoryId, currentAllSettings) {
    try {
        const categorySettings = currentAllSettings.categoryMatchSettings?.[categoryId];
        if (categorySettings) {
            return {
                duration: categorySettings.duration || 60,
                bufferTime: categorySettings.bufferTime || 5
            };
        }
    } catch (error) {
        console.error("Chyba pri načítaní nastavení kategórie:", error);
    }
    return { duration: 60, bufferTime: 5 };
}

/**
 * Aktualizuje vstupy trvania zápasu a času medzi zápasmi na základe vybraných nastavení kategórie.
 * @param {object} currentAllSettings Aktuálny objekt allSettings.
 */
async function updateMatchDurationAndBuffer(currentAllSettings) {
    const matchDurationInput = document.getElementById('matchDuration');
    const matchBufferTimeInput = document.getElementById('matchBufferTime');
    const matchCategorySelect = document.getElementById('matchCategory');

    const selectedCategoryId = matchCategorySelect.value;

    if (selectedCategoryId) {
        const settings = getCategoryMatchSettings(selectedCategoryId, currentAllSettings);
        matchDurationInput.value = settings.duration;
        matchBufferTimeInput.value = settings.bufferTime;
    } else {
        // Ak nie je vybraná žiadna kategória, predvolené hodnoty sú 60/5
        matchDurationInput.value = 60;
        matchBufferTimeInput.value = 5;
    }
}

/**
 * Nájde prvý dostupný časový slot pre zápas na základe existujúcich zápasov a zablokovaných intervalov.
 * Táto funkcia je navrhnutá tak, aby vždy navrhla najskorší možný čas,
 * prioritizujúc explicitné záznamy "Voľný slot dostupný", ak sa neprekrývajú s pevnými udalosťami.
 * NEBERIE do úvahy, či sa zápas "zmestí" do navrhovaného slotu; `recalculateAndSaveScheduleForDateAndLocation`
 * spracuje posúvanie nasledujúcich udalostí, ak zápas pretečie.
 * @param {object} currentAllSettings Aktuálny objekt allSettings.
 */
async function findFirstAvailableTime(currentAllSettings) {
    const matchDateSelect = document.getElementById('matchDateSelect');
    const matchLocationSelect = document.getElementById('matchLocationSelect');
    const matchStartTimeInput = document.getElementById('matchStartTime');
    const matchDurationInput = document.getElementById('matchDuration');
    const matchBufferTimeInput = document.getElementById('matchBufferTime');

    console.log("findFirstAvailableTime volaná.");
    const selectedDate = matchDateSelect.value;
    const selectedLocationName = matchLocationSelect.value;
    // Použi aktuálne hodnoty z input polí, ktoré by mali byť aktualizované funkciou updateMatchDurationAndBuffer
    const proposedMatchDuration = Number(matchDurationInput.value) || 0;
    const proposedMatchBufferTime = Number(matchBufferTimeInput.value) || 0;
    const proposedMatchFootprint = proposedMatchDuration + proposedMatchBufferTime;

    console.log("Vybraný dátum:", selectedDate);
    console.log("Vybrané miesto:", selectedLocationName);
    console.log("Navrhovaná stopa zápasu (trvanie + buffer):", proposedMatchFootprint);

    if (!selectedDate || !selectedLocationName) {
        matchStartTimeInput.value = '';
        console.log("Dátum alebo miesto prázdne, vymazávam počiatočný čas a vraciam sa.");
        return;
    }

    // Preskoč hľadanie času, ak je vybraná "Nezadaná hala", pretože je nepriradená
    if (selectedLocationName === 'Nezadaná hala') {
        matchStartTimeInput.value = '00:00'; // Predvolené na 00:00 pre nepriradené zápasy
        console.log("Miesto je 'Nezadaná hala', preskakujem logiku hľadania času a nastavujem na 00:00.");
        return;
    }

    try {
        const initialScheduleStartMinutes = await getInitialScheduleStartMinutes(selectedDate, currentAllSettings);
        console.log("Počiatočné minúty ukazovateľa pre vybraný deň (z nastavení):", initialScheduleStartMinutes);

        // Načítaj všetky zápasy a všetky zablokované intervaly (aj zablokované, aj voľné zástupné symboly)
        const [matchesSnapshot, blockedIntervalsSnapshot] = await Promise.all([
            getDocs(query(matchesCollectionRef, where("date", "==", selectedDate), where("location", "==", selectedLocationName))),
            getDocs(query(blockedSlotsCollectionRef, where("date", "==", selectedDate), where("location", "==", selectedLocationName)))
        ]);

        const allEvents = [];
        matchesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const startInMinutes = parseTimeToMinutes(data.startTime);
            // Použi nastavenia kategórie pre trvanie a čas medzi zápasmi
            const categorySettings = getCategoryMatchSettings(data.categoryId, currentAllSettings);
            const duration = categorySettings.duration;
            const bufferTime = categorySettings.bufferTime;

            allEvents.push({
                id: doc.id,
                start: startInMinutes,
                end: startInMinutes + duration + bufferTime,
                type: 'match',
                isBlocked: false // Zápasy nie sú v tomto kontexte 'zablokované' intervaly
            });
        });

        blockedIntervalsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const startInMinutes = parseTimeToMinutes(data.startTime);
            const endInMinutes = parseTimeToMinutes(data.endTime);
            allEvents.push({
                id: doc.id,
                start: startInMinutes,
                end: endInMinutes,
                type: 'blocked_interval',
                isBlocked: data.isBlocked === true,
                originalMatchId: data.originalMatchId || null
            });
        });

        // Zoraď všetky udalosti podľa ich počiatočného času
        allEvents.sort((a, b) => a.start - b.start);
        console.log("Všetky načítané udalosti (zápasy a intervaly), zoradené:", allEvents.map(e => ({id: e.id, type: e.type, start: e.start, end: e.end, isBlocked: e.isBlocked, originalMatchId: e.originalMatchId})));

        let proposedStartTimeInMinutes = -1;

        // Krok 1: Prioritizuj sloty "Voľný interval dostupný" (isBlocked: false, bez ohľadu na originalMatchId)
        // Toto sú všeobecné medzery a tiež medzery "po vymazanom zápase".
        for (const event of allEvents) {
            if (event.type === 'blocked_interval' && event.isBlocked === false) {
                const intervalStart = event.start;
                const intervalEnd = event.end;
                const intervalDuration = intervalEnd - intervalStart;

                // Uisti sa, že interval začína na alebo po počiatočnom čase rozvrhu
                // a že navrhovaný zápas sa zmestí do tohto intervalu.
                if (intervalStart >= initialScheduleStartMinutes && intervalDuration >= proposedMatchFootprint) {
                    proposedStartTimeInMinutes = intervalStart;
                    console.log(`Nájdený vhodný "Voľný interval dostupný" začínajúci o ${proposedStartTimeInMinutes}.`);
                    break; // Nájdený prvý vhodný voľný interval
                }
            }
        }

        // Krok 2: Ak sa nenašiel vhodný "Voľný interval dostupný",
        // potom nájdi prvý dostupný čas po všetkých obsadených udalostiach (zápasy, zablokované používateľom alebo zástupné symboly vymazaných zápasov).
        if (proposedStartTimeInMinutes === -1) {
            let fixedOccupiedPeriods = [];
            allEvents.filter(e => e.type === 'match' || e.isBlocked === true || e.originalMatchId).forEach(e => {
                fixedOccupiedPeriods.push({ start: e.start, end: e.end });
            });

            // Zoraď a zlúč pevné obsadené obdobia
            fixedOccupiedPeriods.sort((a, b) => a.start - b.start);
            const mergedFixedOccupiedPeriods = [];
            if (fixedOccupiedPeriods.length > 0) {
                let currentMerged = { ...fixedOccupiedPeriods[0] };
                for (let i = 1; i < fixedOccupiedPeriods.length; i++) {
                    const nextPeriod = fixedOccupiedPeriods[i];
                    if (nextPeriod.start <= currentMerged.end) {
                        currentMerged.end = Math.max(currentMerged.end, nextPeriod.end);
                    } else {
                        mergedFixedOccupiedPeriods.push(currentMerged);
                        currentMerged = { ...nextPeriod };
                    }
                }
                mergedFixedOccupiedPeriods.push(currentMerged);
            }
            console.log("Zlúčené pevné obsadené obdobia (zápasy + isBlocked:true + originalMatchId):", mergedFixedOccupiedPeriods);

            let currentPointer = initialScheduleStartMinutes;
            for (const occupied of mergedFixedOccupiedPeriods) {
                if (currentPointer < occupied.start) {
                    // Nájdená medzera pred obsadeným obdobím
                    if ((occupied.start - currentPointer) >= proposedMatchFootprint) {
                        proposedStartTimeInMinutes = currentPointer;
                        console.log(`Nájdená medzera pred pevným obsadeným obdobím začínajúcim o ${proposedStartTimeInMinutes}.`);
                        break;
                    }
                }
                currentPointer = Math.max(currentPointer, occupied.end);
            }

            // Ak sa stále nenašiel čas, skontroluj po poslednej pevnej udalosti až do konca dňa
            if (proposedStartTimeInMinutes === -1 && currentPointer < 24 * 60) {
                if ((24 * 60 - currentPointer) >= proposedMatchFootprint) {
                    proposedStartTimeInMinutes = currentPointer;
                    console.log(`Nájdená medzera na konci dňa začínajúca o ${proposedStartTimeInMinutes}.`);
                }
            }
        }

        // Náhradné riešenie: Ak sa čas neurčil (napr. celý deň je teoreticky zablokovaný alebo žiadne prvky)
        if (proposedStartTimeInMinutes === -1) {
            proposedStartTimeInMinutes = initialScheduleStartMinutes;
            console.log("Náhradné riešenie: Logikou sa nenašiel dostupný čas, predvolené na počiatočný čas dňa:", proposedStartTimeInMinutes);
        }

        const formattedHour = String(Math.floor(proposedStartTimeInMinutes / 60)).padStart(2, '0');
        const formattedMinute = String(proposedStartTimeInMinutes % 60).padStart(2, '0');
        matchStartTimeInput.value = `${formattedHour}:${formattedMinute}`;
        console.log("Nastavený čas začiatku zápasu:", matchStartTimeInput.value);

    } catch (error) {
        console.error("Chyba pri hľadaní prvého dostupného času:", error);
        matchStartTimeInput.value = ''; // Vymaž v prípade chyby
    }
}

/**
 * Získa zobrazovaný názov, názov klubu a ID klubu pre daný tím.
 * @param {string} categoryId ID kategórie.
 * @param {string} groupId ID skupiny.
 * @param {number} teamNumber Poradové číslo tímu v skupine.
 * @param {Map<string, string>} categoriesMap Mapa ID kategórií na názvy.
 * @param {Map<string, string>} groupsMap Mapa ID skupín na názvy.
 * @returns {Promise<object>} Objekt obsahujúci fullDisplayName, clubName, clubId a shortDisplayName.
 */
const getTeamName = async (categoryId, groupId, teamNumber, categoriesMap, groupsMap) => {
    if (!categoryId || !groupId || !teamNumber) {
        return { fullDisplayName: null, clubName: null, clubId: null, shortDisplayName: null };
    }
    try {
        const categoryName = categoriesMap.get(categoryId) || categoryId;
        const groupName = groupsMap.get(groupId) || groupId;

        let clubName = `Tím ${teamNumber}`;
        let clubId = null;

        const clubsQuery = query(
            clubsCollectionRef,
            where("categoryId", "==", categoryId),
            where("groupId", "==", groupId),
            where("orderInGroup", "==", parseInt(teamNumber))
        );
        const clubsSnapshot = await getDocs(clubsQuery);

        if (!clubsSnapshot.empty) {
            const teamDocData = clubsSnapshot.docs[0].data();
            clubId = clubsSnapshot.docs[0].id;
            if (teamDocData.name) {
                clubName = teamDocData.name;
            }
        }

        let shortCategoryName = categoryName;
        if (shortCategoryName) {
            shortCategoryName = shortCategoryName.replace(/U(\d+)\s*([CHZ])/i, 'U$1$2').toUpperCase();
        }

        let shortGroupName = '';
        if (groupName) {
            const match = groupName.match(/(?:skupina\s*)?([A-Z])/i);
            if (match && match[1]) {
                shortGroupName = match[1].toUpperCase();
            }
        }

        const fullDisplayName = `${shortCategoryName} ${shortGroupName}${teamNumber}`;
        const shortDisplayName = `${shortGroupName}${teamNumber}`;

        return {
            fullDisplayName: fullDisplayName,
            clubName: clubName,
            clubId: clubId,
            shortDisplayName: shortDisplayName
        };
    } catch (error) {
        console.error("Chyba pri získavaní názvu tímu:", error);
        return { fullDisplayName: `Chyba`, clubName: `Chyba`, clubId: null, shortDisplayName: `Chyba` };
    }
};

/**
 * Prepočíta a uloží rozvrh pre konkrétny dátum a miesto, spracuje presunuté zápasy a vymazané zástupné symboly.
 * Táto funkcia teraz aktívne kompaktuje rozvrh posúvaním udalostí dopredu, aby vyplnila medzery.
 * @param {string} processDate Dátum, pre ktorý sa rozvrh spracováva.
 * @param {string} processLocation Miesto, pre ktoré sa rozvrh spracováva.
 * @param {'process'|'cleanup'} purpose Určuje, či sa toto volanie týka 'spracovania' cieľového miesta alebo 'vyčistenia' pôvodného miesta po presune.
 * @param {object|null} movedMatchDetails Informácie o zápase, ktorý bol práve presunutý.
 * { id, oldDate, oldLocation, oldStartTime, oldFootprintEndTime, newDate, newLocation, newStartTime, newFootprintEndTime }
 * @param {object} allSettings Všetky nastavenia turnaja, vrátane nastavení zápasov kategórií.
 */
async function recalculateAndSaveScheduleForDateAndLocation(
    processDate,
    processLocation,
    purpose,
    movedMatchDetails = null,
    allSettings // Odovzdaj allSettings tejto funkcii
) {
    console.log(`recalculateAndSaveScheduleForDateAndLocation: === SPUSTENÉ pre Dátum: ${processDate}, Miesto: ${processLocation}, Účel: ${purpose}. ` +
                `Presunutý zápas ID: ${movedMatchDetails ? movedMatchDetails.id : 'žiadny'} ===`);
    try {
        const batch = writeBatch(db); 

        // 1. Načítaj všetky existujúce zápasy a zablokované/voľné sloty pre daný processDate a processLocation.
        const matchesQuery = query(matchesCollectionRef, where("date", "==", processDate), where("location", "==", processLocation));
        const matchesSnapshot = await getDocs(matchesQuery);
        let currentMatches = matchesSnapshot.docs.map(doc => {
            const data = doc.data();
            // Získaj trvanie a čas medzi zápasmi z nastavení kategórie, ak sú k dispozícii, inak použi vlastné dáta zápasu alebo predvolené hodnoty
            const categorySettings = allSettings.categoryMatchSettings?.[data.categoryId];
            const duration = categorySettings?.duration || Number(data.duration) || 60;
            const bufferTime = categorySettings?.bufferTime || Number(data.bufferTime) || 5;
            const startInMinutes = parseTimeToMinutes(data.startTime);

            return {
                id: doc.id,
                type: 'match',
                docRef: doc.ref,
                ...data,
                duration: duration, // Použi aktualizované trvanie
                bufferTime: bufferTime, // Použi aktualizovaný čas medzi zápasmi
                startInMinutes: startInMinutes,
                footprintEndInMinutes: startInMinutes + duration + bufferTime // Prepočítaj stopu
            };
        });

        const blockedSlotsQuery = query(blockedSlotsCollectionRef, where("date", "==", processDate), where("location", "==", processLocation));
        const blockedSlotsSnapshot = await getDocs(blockedSlotsQuery);
        let currentBlockedAndFreeSlots = blockedSlotsSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'blocked_interval',
            isBlocked: doc.data().isBlocked === true,
            originalMatchId: doc.data().originalMatchId || null,
            docRef: doc.ref,
            ...doc.data(),
            startInMinutes: parseTimeToMinutes(doc.data().startTime),
            endInMinutes: parseTimeToMinutes(doc.data().endTime)
        }));

        // 2. Oddeľ skutočne pevné udalosti (zápasy a používateľom zablokované intervaly a trvalé voľné sloty 'vymazaného zápasu')
        // od automaticky generovaných flexibilných zástupných symbolov, ktoré sa znova vytvoria.
        let fixedEvents = []; // Toto sú udalosti, ktoré sa umiestnia a potenciálne posunú
        let autoGeneratedPlaceholdersToDelete = []; // Tieto sa vymažú a znova vytvoria

        currentMatches.forEach(match => fixedEvents.push(match));
        currentBlockedAndFreeSlots.forEach(slot => {
            if (slot.isBlocked === true || slot.originalMatchId) { // Používateľom zablokovaný alebo trvalý voľný slot 'vymazaného zápasu'
                fixedEvents.push(slot);
            } else { // Automaticky generovaný dočasný voľný slot (bez originalMatchId)
                autoGeneratedPlaceholdersToDelete.push(slot);
            }
        });

        // Vymaž všetky staré automaticky generované zástupné symboly voľných slotov
        for (const placeholder of autoGeneratedPlaceholdersToDelete) {
            batch.delete(placeholder.docRef);
            console.log(`Fáza 1: Pridané do batchu na vymazanie starého automaticky generovaného zástupného intervalu ID: ${placeholder.id}`);
        }

        // --- Logika pre vytváranie/mazanie trvalých zástupných symbolov na základe typu presunu (Fáza 2.5) ---
        // Nájdi akýkoľvek existujúci trvalý zástupný symbol pre toto konkrétne ID presunutého zápasu v rámci *tohto* processDate/processLocation
        let existingPermanentPlaceholderRef = null;
        let existingPermanentPlaceholderData = null;
        if (movedMatchDetails && movedMatchDetails.id) {
            const existingPlaceholderDoc = currentBlockedAndFreeSlots.find(bs => 
                bs.originalMatchId === movedMatchDetails.id && 
                bs.date === processDate && 
                bs.location === processLocation
            );
            if (existingPlaceholderDoc) {
                existingPermanentPlaceholderRef = existingPlaceholderDoc.docRef;
                existingPermanentPlaceholderData = existingPlaceholderDoc;
            }
        }

        if (movedMatchDetails && movedMatchDetails.id) {
            if (purpose === 'cleanup') {
                // Toto volanie je pre *pôvodné* miesto presunu na iné miesto/deň.
                // Vytvor alebo aktualizuj trvalý voľný slot na starom mieste.
                const freeIntervalData = {
                    date: processDate,
                    location: processLocation,
                    startTime: movedMatchDetails.oldStartTime,
                    endTime: movedMatchDetails.oldFootprintEndTime,
                    isBlocked: false,
                    originalMatchId: movedMatchDetails.id, // Označ ako trvalý voľný slot
                    startInMinutes: parseTimeToMinutes(movedMatchDetails.oldStartTime),
                    endInMinutes: parseTimeToMinutes(movedMatchDetails.oldFootprintEndTime),
                    createdAt: new Date()
                };

                if (existingPermanentPlaceholderRef) {
                    batch.update(existingPermanentPlaceholderRef, freeIntervalData);
                    console.log(`Fáza 2.5 (Vyčistenie): AKTUALIZOVANÝ trvalý voľný interval pre presunutý zápas ID ${movedMatchDetails.id}.`);
                } else {
                    const newPlaceholderRef = doc(blockedSlotsCollectionRef);
                    batch.set(newPlaceholderRef, freeIntervalData);
                    // Pridaj do fixedEvents, aby sa zohľadnil v slučke kompakcie
                    fixedEvents.push({ ...freeIntervalData, docRef: newPlaceholderRef, type: 'blocked_interval' });
                    console.log(`Fáza 2.5 (Vyčistenie): VYTVORENÝ trvalý voľný interval pre presunutý zápas ID ${movedMatchDetails.id}.`);
                }
            } else if (purpose === 'process') {
                // Toto volanie je pre *cieľové* miesto.
                // Zohľadni len, ak ide o presun v rámci toho istého dňa/miesta.
                const isSameDaySameLocationMove = movedMatchDetails.oldDate === processDate && movedMatchDetails.oldLocation === processLocation;

                if (isSameDaySameLocationMove) {
                    const oldStartInMinutes = parseTimeToMinutes(movedMatchDetails.oldStartTime);
                    const newStartInMinutes = parseTimeToMinutes(movedMatchDetails.newStartTime);

                    if (newStartInMinutes > oldStartInMinutes) {
                        // Prípad 3: Presunuté na NESKORŠÍ čas. Vytvor alebo aktualizuj trvalý voľný slot na starom mieste.
                        const freeIntervalData = {
                            date: processDate,
                            location: processLocation,
                            startTime: movedMatchDetails.oldStartTime,
                            endTime: movedMatchDetails.oldFootprintEndTime,
                            isBlocked: false,
                            originalMatchId: movedMatchDetails.id, // Označ ako trvalý voľný slot
                            startInMinutes: oldStartInMinutes,
                            endInMinutes: parseTimeToMinutes(movedMatchDetails.oldFootprintEndTime),
                            createdAt: new Date()
                        };

                        if (existingPermanentPlaceholderRef) {
                            batch.update(existingPermanentPlaceholderRef, freeIntervalData);
                            console.log(`Fáza 2.5 (Spracovanie - Rovnaký deň/miesto, Presunuté neskôr): AKTUALIZOVANÝ trvalý voľný interval pre presunutý zápas ID ${movedMatchDetails.id}.`);
                        } else {
                            const newPlaceholderRef = doc(blockedSlotsCollectionRef);
                            batch.set(newPlaceholderRef, freeIntervalData);
                            fixedEvents.push({ ...freeIntervalData, docRef: newPlaceholderRef, type: 'blocked_interval' });
                            console.log(`Fáza 2.5 (Spracovanie - Rovnaký deň/miesto, Presunuté neskôr): VYTVORENÝ trvalý voľný interval pre presunutý zápas ID ${movedMatchDetails.id}.`);
                        }
                    } else {
                        // Prípad 2: Presunuté na SKORŠÍ čas. Vymaž akýkoľvek existujúci trvalý voľný slot pre tento zápas.
                        if (existingPermanentPlaceholderRef) {
                            batch.delete(existingPermanentPlaceholderRef);
                            // Odstráň z fixedEvents, aby sa ďalej nespracovával v tomto behu
                            fixedEvents = fixedEvents.filter(e => e.id !== existingPermanentPlaceholderData.id);
                            console.log(`Fáza 2.5 (Spracovanie - Rovnaký deň/miesto, Presunuté skôr): VYMAZANÝ trvalý voľný interval pre presunutý zápas ID ${movedMatchDetails.id}.`);
                        }
                    }
                }
                // Ak je účel 'process', ale ide o presun medzi miestami/dátumami, tu sa nevytvára žiadny špecifický zástupný symbol.
                // Vyčistenie starého miesta bolo spracované volaním 'cleanup'.
            }
        }
        // --- Koniec logiky pre vytváranie/mazanie trvalých zástupných symbolov (Fáza 2.5) ---

        // Uisti sa, že fixedEvents je zoradený po pridaní/odstránení trvalých zástupných symbolov
        fixedEvents.sort((a, b) => {
            if (a.startInMinutes !== b.startInMinutes) {
                return a.startInMinutes - b.startInMinutes;
            }
            // Prioritizuj zápasy pred zablokovanými intervalmi, ak začínajú v rovnakom čase
            if (a.type === 'match' && b.type === 'blocked_interval') return -1;
            if (a.type === 'blocked_interval' && b.type === 'match') return 1;
            return 0; 
        });
        console.log(`Fáza 2.6: Zoradené fixedEvents po spracovaní zástupných symbolov:`, fixedEvents.map(e => ({id: e.id, type: e.type, startInMinutes: e.startInMinutes, isBlocked: e.isBlocked || 'N/A', originalMatchId: e.originalMatchId || 'N/A'})));


        const initialScheduleStartMinutes = await getInitialScheduleStartMinutes(processDate, allSettings);
        let currentTimePointer = initialScheduleStartMinutes;
        console.log(`Fáza 3 (Kompakcia): Počiatočný ukazovateľ času (currentTimePointer): ${currentTimePointer} minút.`);

        // 3. Iteruj cez zoradené pevné udalosti, aby si vytvoril konečnú časovú os a vytvoril nové zástupné symboly.
        for (let i = 0; i < fixedEvents.length; i++) {
            const event = fixedEvents[i];
            console.log(`Fáza 3 (Kompakcia): SPRACOVÁVAM udalosť: ID: ${event.id || 'N/A'}, Typ: ${event.type}, Pôvodný Start (min): ${event.startInMinutes}, Aktuálny currentTimePointer: ${currentTimePointer}`);

            let newEventStartInMinutes = event.startInMinutes;

            // Ak je pred touto udalosťou medzera, posuň ju dopredu
            if (event.startInMinutes > currentTimePointer) {
                newEventStartInMinutes = currentTimePointer;
                console.log(`Fáza 3 (Kompakcia): Udalosť ${event.id} posunutá dopredu. Nový Start: ${newEventStartInMinutes}.`);
            } else if (event.startInMinutes < currentTimePointer) {
                // Ak udalosť začína pred aktuálnym ukazovateľom, znamená to, že sa prekrýva
                // Posuň ju na aktuálny ukazovateľ.
                newEventStartInMinutes = currentTimePointer;
                console.log(`Fáza 3 (Kompakcia): Udalosť ${event.id} prekrýva, posunutá na currentTimePointer: ${newEventStartInMinutes}.`);
            }

            // Aktualizuj počiatočný čas udalosti v pamäti
            event.startInMinutes = newEventStartInMinutes;
            const newStartTimeFormatted = formatMinutesToTime(newEventStartInMinutes);

            // Pridaj do batchu pre aktualizáciu databázy
            if (event.type === 'match') {
                batch.update(event.docRef, { startTime: newStartTimeFormatted });
                event.startTime = newStartTimeFormatted; // Aktualizuj v pamäti pre stopu ďalšej iterácie
                event.endOfPlayInMinutes = event.startInMinutes + event.duration;
                event.footprintEndInMinutes = event.startInMinutes + event.duration + event.bufferTime;
            } else if (event.type === 'blocked_interval' && (event.isBlocked === true || event.originalMatchId)) {
                // Pre pevné zablokované intervaly aktualizuj ich počiatočné/koncové časy, ak boli posunuté
                // Uisti sa, že vypočítaš trvanie na základe pôvodného počiatočného/koncového času, ak je k dispozícii, inak aktuálneho.
                const originalDuration = (event.originalStartInMinutes && event.originalEndInMinutes) ? (event.originalEndInMinutes - event.originalStartInMinutes) : (event.endInMinutes - event.startInMinutes);
                const newEndTimeInMinutes = newEventStartInMinutes + originalDuration;
                const newEndTimeFormatted = formatMinutesToTime(newEndTimeInMinutes);
                batch.update(event.docRef, { startTime: newStartTimeFormatted, endTime: newEndTimeFormatted, startInMinutes: newEventStartInMinutes, endInMinutes: newEndTimeInMinutes });
                event.startTime = newStartTimeFormatted; // Aktualizuj v pamäti
                event.endTime = newEndTimeFormatted; // Aktualizuj v pamäti
                event.endInMinutes = newEndTimeInMinutes; // Aktualizuj v pamäti
            }

            // Posuň ukazovateľ časovej osi na základe *nového* koncového času aktuálnej udalosti
            const eventFootprintEndInMinutes = (event.type === 'match') ? event.startInMinutes + event.duration + event.bufferTime : event.endInMinutes;
            currentTimePointer = Math.max(currentTimePointer, eventFootprintEndInMinutes);
            console.log(`Fáza 3 (Kompakcia): Po spracovaní udalosti ${event.id || 'N/A'}, currentTimePointer je teraz: ${currentTimePointer}`);
        }

        // 4. Znova vytvor všetky automaticky generované zástupné symboly 'voľný interval dostupný'
        // Znova nastav currentTimePointer na počiatočný štart pre generovanie zástupných symbolov
        currentTimePointer = initialScheduleStartMinutes;
        
        // Zoraď fixedEvents znova, pretože ich počiatočné časy boli upravené v predchádzajúcej slučke
        fixedEvents.sort((a, b) => a.startInMinutes - b.startInMinutes);
        console.log(`Fáza 4: Zoradené fixedEvents po kompakcii pre generovanie zástupných symbolov:`, fixedEvents.map(e => ({id: e.id, type: e.type, startInMinutes: e.startInMinutes, isBlocked: e.isBlocked || 'N/A', originalMatchId: e.originalMatchId || 'N/A'})));


        for (const event of fixedEvents) {
            const eventFootprintEndInMinutes = (event.type === 'match') ? event.startInMinutes + event.duration + event.bufferTime : event.endInMinutes;

            // Ak je medzera medzi aktuálnym ukazovateľom a aktuálnou pevnou udalosťou, vytvor zástupný symbol 'voľný interval dostupný'
            if (currentTimePointer < event.startInMinutes) {
                const gapStart = currentTimePointer;
                const gapEnd = event.startInMinutes;
                const formattedGapStartTime = formatMinutesToTime(gapStart);
                const formattedGapEndTime = formatMinutesToTime(gapEnd);
                
                // Vytvor len, ak má medzera kladné trvanie
                if (gapEnd > gapStart) {
                    const newPlaceholderRef = doc(blockedSlotsCollectionRef);
                    batch.set(newPlaceholderRef, {
                        date: processDate,
                        location: processLocation,
                        startTime: formattedGapStartTime,
                        endTime: formattedGapEndTime,
                        isBlocked: false,
                        startInMinutes: gapStart,
                        endInMinutes: gapEnd,
                        originalMatchId: null, // Toto je všeobecná medzera, nie z vymazaného zápasu
                        createdAt: new Date()
                    });
                    console.log(`Fáza 4: VYTVORENÝ nový voľný interval (medzera po kompakcii): ${formattedGapStartTime}-${formattedGapEndTime}.`);
                }
            }
            // Posuň ukazovateľ časovej osi
            currentTimePointer = Math.max(currentTimePointer, eventFootprintEndInMinutes);
            console.log(`Fáza 4: Po spracovaní udalosti ${event.id || 'N/A'}, currentTimePointer je teraz: ${currentTimePointer}`);
        }

        // Vytvor konečný zástupný symbol 'voľný interval dostupný', ak je priestor do konca dňa
        if (currentTimePointer < 24 * 60) {
            const gapStart = currentTimePointer;
            const gapEnd = 24 * 60;
            const formattedGapStartTime = formatMinutesToTime(gapStart);
            const formattedGapEndTime = formatMinutesToTime(gapEnd);

            if (gapEnd > gapStart) { // Vytvor len, ak má medzera kladné trvanie
                const newPlaceholderRef = doc(blockedSlotsCollectionRef);
                batch.set(newPlaceholderRef, {
                    date: processDate,
                    location: processLocation,
                    startTime: formattedGapStartTime,
                    endTime: formattedGapEndTime,
                    isBlocked: false,
                    startInMinutes: gapStart,
                    endInMinutes: gapEnd,
                    originalMatchId: null, // Toto je všeobecná medzera
                    createdAt: new Date()
                });
                console.log(`Fáza 4: VYTVORENÝ konečný voľný interval (po kompakcii): ${formattedGapStartTime}-${formattedGapEndTime}.`);
            }
        }
        
        await batch.commit();
        console.log(`recalculateAndSaveScheduleForDateAndLocation: Batch commit úspešný.`);

        await displayMatchesAsSchedule(allSettings); // Odovzdaj allSettings
    } catch (error) {
        console.error("recalculateAndSaveScheduleForDateAndLocation: Chyba pri prepočítavaní a ukladaní rozvrhu:", error);
        await showMessage('Chyba', `Chyba pri prepočítavaní rozvrhu: ${error.message}`);
    }
}

/**
 * Získa počiatočný čas rozvrhu v minútach pre daný dátum.
 * @param {string} date Dátum.
 * @param {object} currentAllSettings Aktuálny objekt allSettings.
 * @returns {Promise<number>} Počiatočný čas v minútach.
 */
async function getInitialScheduleStartMinutes(date, currentAllSettings) {
    let firstDayStartTime = '08:00';
    let otherDaysStartTime = '08:00';

    if (currentAllSettings) {
        firstDayStartTime = currentAllSettings.firstDayStartTime || '08:00';
        otherDaysStartTime = currentAllSettings.otherDaysStartTime || '08:00';
    }

    const playingDaysSnapshot = await getDocs(query(playingDaysCollectionRef, orderBy("date", "asc")));
    const sortedPlayingDays = playingDaysSnapshot.docs.map(d => d.data().date).sort();
    const isFirstPlayingDay = sortedPlayingDays.length > 0 && date === sortedPlayingDays[0];

    const initialStartTimeStr = isFirstPlayingDay ? firstDayStartTime : otherDaysStartTime;
    return parseTimeToMinutes(initialStartTimeStr);
}

/**
 * Získa dáta zápasu podľa ID zápasu.
 * @param {string} matchId ID zápasu.
 * @returns {Promise<object|null>} Dáta zápasu alebo null, ak sa nenašiel.
 */
async function getMatchData(matchId) {
    try {
        const matchDoc = await getDoc(doc(matchesCollectionRef, matchId));
        if (matchDoc.exists()) {
            return matchDoc.data();
        }
    } catch (error) {
        console.error("Chyba pri získavaní dát zápasu:", error);
    }
    return null;
}

/**
 * Vymaže zápas a vytvorí na jeho mieste voľný interval.
 * @param {string} matchId ID zápasu na vymazanie.
 * @param {object} allSettings Všetky nastavenia turnaja, vrátane nastavení zápasov kategórií.
 */
async function deleteMatch(matchId, allSettings) {
    console.log(`deleteMatch: === FUNKCIA VYMAZANIA ZÁPASU SPUSTENÁ ===`);
    console.log(`deleteMatch: Pokúšam sa vymazať zápas s ID: ${matchId}`);
    const matchModal = document.getElementById('matchModal');

    const confirmed = await showConfirmation(
        'Potvrdenie vymazania',
        `Naozaj chcete vymazať tento zápas?`
    );

    if (confirmed) {
        try {
            const matchDocRef = doc(matchesCollectionRef, matchId);
            const matchDoc = await getDoc(matchDocRef);

            if (!matchDoc.exists()) {
                await showMessage('Informácia', 'Zápas sa nenašiel.');
                console.warn('deleteMatch: Dokument zápasu nenájdený pre ID:', matchId);
                return;
            }

            const matchData = matchDoc.data();
            const date = matchData.date;
            const location = matchData.location;
            const startTime = matchData.startTime;
            
            // Získaj trvanie a čas medzi zápasmi z nastavení kategórie, ak sú k dispozícii, inak použi vlastné dáta zápasu alebo predvolené
            const categorySettings = allSettings.categoryMatchSettings?.[matchData.categoryId];
            const duration = categorySettings?.duration || Number(matchData.duration) || 60;
            const bufferTime = categorySettings?.bufferTime || Number(matchData.bufferTime) || 5;

            const startInMinutes = parseTimeToMinutes(startTime);
            const endInMinutes = startInMinutes + duration + bufferTime;
            const endTime = formatMinutesToTime(endInMinutes);

            const batch = writeBatch(db);
            batch.delete(matchDocRef);
            console.log(`deleteMatch: Zápas ${matchId} pridaný do batchu na vymazanie.`);

            // Vytvor nový voľný interval (zástupný symbol) na mieste vymazaného zápasu
            // Tento zástupný symbol bude mať isBlocked: false a originalMatchId, aby signalizoval, že ide o pevný 'prázdny' slot.
            const newFreeIntervalRef = doc(blockedSlotsCollectionRef);
            const freeIntervalData = {
                date: date,
                location: location,
                startTime: startTime,
                endTime: endTime,
                isBlocked: false, // Je to teraz voľný interval
                originalMatchId: matchId, // Ulož pôvodné ID zápasu pre referenciu, aby bol "trvalý"
                startInMinutes: startInMinutes,
                endInMinutes: endInMinutes,
                createdAt: new Date()
            };
            batch.set(newFreeIntervalRef, freeIntervalData);
            console.log(`deleteMatch: Pridaný nový voľný interval do batchu pre vymazaný zápas:`, freeIntervalData);

            await batch.commit();
            await showMessage('Úspech', 'Zápas bol úspešne vymazaný a časový interval bol označený ako voľný!');
            closeModal(matchModal);
            
            // Prepočítaj rozvrh pre dotknutý dátum a miesto
            // Tu nie sú potrebné žiadne movedMatchDetails, pretože ide o vymazanie, nie presun.
            await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, allSettings);
            console.log("deleteMatch: Rozvrh prepočítaný a zobrazený po vymazaní zápasu.");

        } catch (error) {
            console.error("deleteMatch: Chyba pri mazaní zápasu alebo vytváraní voľného intervalu:", error);
            await showMessage('Chyba', `Chyba pri mazaní zápasu: ${error.message}`);
        }
    } else {
        console.log("deleteMatch: Mazanie zápasu zrušené používateľom.");
    }
}


/**
 * Presunie a preplánuje zápas.
 * @param {string} draggedMatchId ID presunutého zápasu.
 * @param {string} targetDate Cieľový dátum pre zápas.
 * @param {string} targetLocation Cieľové miesto pre zápas.
 * @param {string|null} droppedProposedStartTime Navrhovaný počiatočný čas po pustení.
 * @param {object} allSettings Všetky nastavenia turnaja, vrátane nastavení zápasov kategórií.
 */
async function moveAndRescheduleMatch(draggedMatchId, targetDate, targetLocation, droppedProposedStartTime = null, allSettings) {
    console.log(`moveAndRescheduleMatch: === SPUSTENÉ pre zápas ID: ${draggedMatchId}, cieľ: ${targetDate}, ${targetLocation}, navrhovaný čas: ${droppedProposedStartTime} ===`);
    try {
        const draggedMatchDocRef = doc(matchesCollectionRef, draggedMatchId);
        const draggedMatchDoc = await getDoc(draggedMatchDocRef);
        if (!draggedMatchDoc.exists()) {
            await showMessage('Chyba', 'Presúvaný zápas nebol nájdený.');
            console.error('moveAndRescheduleMatch: Presúvaný zápas nenájdený!', draggedMatchId);
            return;
        }
        const draggedMatchData = draggedMatchDoc.data();
        const originalDate = draggedMatchData.date;
        const originalLocation = draggedMatchData.location;
        const originalStartTime = draggedMatchData.startTime;

        // Získaj trvanie a čas medzi zápasmi z nastavení kategórie pre výpočet pôvodnej stopy
        const categorySettings = allSettings.categoryMatchSettings?.[draggedMatchData.categoryId];
        const originalDuration = categorySettings?.duration || Number(draggedMatchData.duration) || 60;
        const originalBufferTime = categorySettings?.bufferTime || Number(draggedMatchData.bufferTime) || 5;

        const originalFootprintEndTime = calculateFootprintEndTime(originalStartTime, originalDuration, originalBufferTime);

        // Aktualizuj nové miesto a čas zápasu v DB
        const updatedMatchData = {
            ...draggedMatchData,
            date: targetDate,
            location: targetLocation,
            startTime: droppedProposedStartTime
        };
        await setDoc(draggedMatchDocRef, updatedMatchData, { merge: true });
        console.log(`moveAndRescheduleMatch: Zápas ${draggedMatchId} aktualizovaný v DB s novými dátami:`, updatedMatchData);

        const newFootprintEndTime = calculateFootprintEndTime(droppedProposedStartTime, originalDuration, originalBufferTime); // Použi pôvodné trvanie/buffer pre novú stopu

        const movedMatchDetails = {
            id: draggedMatchId,
            oldDate: originalDate,
            oldLocation: originalLocation,
            oldStartTime: originalStartTime,
            oldFootprintEndTime: originalFootprintEndTime,
            newDate: targetDate,
            newLocation: targetLocation,
            newStartTime: droppedProposedStartTime,
            newFootprintEndTime: newFootprintEndTime
        };

        // 1. Prepočítaj CIEĽOVÉ miesto/dátum
        await recalculateAndSaveScheduleForDateAndLocation(
            targetDate,
            targetLocation,
            'process', // Účel: spracovať cieľové miesto
            movedMatchDetails,
            allSettings // Odovzdaj allSettings
        );
        console.log(`moveAndRescheduleMatch: Prepočet pre cieľové miesto (${targetDate}, ${targetLocation}) dokončený.`);

        // 2. Ak sa zápas presunul na *iný* deň alebo miesto, prepočítaj aj PÔVODNÉ miesto/dátum
        if (originalDate !== targetDate || originalLocation !== targetLocation) {
            await recalculateAndSaveScheduleForDateAndLocation(
                originalDate,
                originalLocation,
                'cleanup', // Účel: vyčistiť pôvodné miesto
                movedMatchDetails, // Odovzdaj úplné detaily pre kontext, hoci vyčistenie používa len staré dáta
                allSettings // Odovzdaj allSettings
            );
            console.log(`moveAndRescheduleMatch: Prepočet pre pôvodné miesto (${originalDate}, ${originalLocation}) dokončený.`);
        }

        await showMessage('Úspech', 'Zápas úspešne presunutý a rozvrh prepočítaný!');
        closeModal(document.getElementById('messageModal'));
    } catch (error) {
        console.error("moveAndRescheduleMatch: Chyba pri presúvaní a prepočítavaní rozvrhu:", error);
        await showMessage('Chyba', `Chyba pri presúvaní zápasu: ${error.message}.`);
        await displayMatchesAsSchedule(allSettings); // Odovzdaj allSettings
    }
}

/**
 * Generuje zobrazovací reťazec pre udalosť v rozvrhu (zápas alebo zablokovaný interval).
 * @param {object} event Objekt udalosti.
 * @param {object} allSettings Všetky nastavenia turnaja.
 * @param {Map<string, string>} categoryColorsMap Mapa ID kategórií na farby.
 * @returns {string} Formátovaný zobrazovací reťazec.
 */
function getEventDisplayString(event, allSettings, categoryColorsMap) {
    if (event.type === 'match') {
        // Trvanie zápasu a čas medzi zápasmi sú teraz priamo na objekte udalosti po počiatočnom spracovaní
        const displayedMatchEndTimeInMinutes = event.endOfPlayInMinutes; 
        const formattedDisplayedEndTime = formatMinutesToTime(displayedMatchEndTimeInMinutes);
        
        return `${event.startTime} - ${formattedDisplayedEndTime}|${event.team1ClubName || 'N/A'}|${event.team2ClubName || 'N/A'}|${event.team1ShortDisplayName || 'N/A'}|${event.team2ShortDisplayName || 'N/A'}`;
    } else if (event.type === 'blocked_interval') {
        let displayText = '';
        if (event.isBlocked === true) {
            displayText = 'Zablokovaný interval';
            const blockedIntervalStartHour = String(Math.floor(event.startInMinutes / 60)).padStart(2, '0');
            const blockedIntervalStartMinute = String(event.startInMinutes % 60).padStart(2, '0');
            const blockedIntervalEndHour = String(Math.floor(event.endInMinutes / 60)).padStart(2, '0');
            const blockedIntervalEndMinute = String(event.endInMinutes % 60).padStart(2, '0');
            return `${blockedIntervalStartHour}:${blockedIntervalStartMinute} - ${blockedIntervalEndHour}:${blockedIntervalEndMinute}|${displayText}`;
        } else {
            displayText = 'Voľný interval dostupný'; 
            return `${event.startTime} - ${event.endTime}|${displayText}`; 
        }
    }
    return '';
}

/**
 * Zobrazí zápasy ako rozvrh, zoskupené podľa miesta a dátumu.
 * @param {object} currentAllSettings Aktuálny objekt allSettings, odovzdaný z onSnapshot listenera.
 */
async function displayMatchesAsSchedule(currentAllSettings) {
    const matchesContainer = document.getElementById('matchesContainer');
    if (!matchesContainer) return;

    // Ulož funkciu zastavenia animácie z predchádzajúceho volania
    if (typeof matchesContainer._stopAnimation === 'function') {
        matchesContainer._stopAnimation();
        console.log("displayMatchesAsSchedule: Zastavujem predchádzajúcu animáciu.");
    } else {
        console.log("displayMatchesAsSchedule: Predchádzajúca _stopAnimation nebola funkcia alebo bola nedefinovaná.");
    }
    matchesContainer.innerHTML = `<p id="loadingAnimationText" style="text-align: center; font-size: 1.2em; color: #555;"></p>`;
    // Ulož novú funkciu zastavenia animácie
    matchesContainer._stopAnimation = animateLoadingText('loadingAnimationText', 'Načítavam zoznam zápasov...');
    console.log("displayMatchesAsSchedule: Nová _stopAnimation priradená.");

    console.log('displayMatchesAsSchedule: Spustené načítavanie dát.');

    try {
        const matchesQuery = query(matchesCollectionRef, orderBy("date", "asc"), orderBy("location", "asc"), orderBy("startTime", "asc"));
        const matchesSnapshot = await getDocs(matchesQuery);
        let allMatchesRaw = matchesSnapshot.docs.map(doc => ({ id: doc.id, type: 'match', docRef: doc.ref, ...doc.data() }));
        console.log("displayMatchesAsSchedule: Načítané surové zápasy (po fetchData):", JSON.stringify(allMatchesRaw.map(m => ({id: m.id, date: m.date, location: m.location, startTime: m.startTime, storedDuration: m.duration, storedBufferTime: m.bufferTime}))));

        const categoriesSnapshot = await getDocs(categoriesCollectionRef);
        const categoriesMap = new Map();
        const categoryColorsMap = new Map();
        categoriesSnapshot.forEach(doc => {
            const categoryData = doc.data();
            categoriesMap.set(doc.id, categoryData.name || doc.id);
            categoryColorsMap.set(doc.id, categoryData.color || null);
        });
        console.log("displayMatchesAsSchedule: Načítané kategórie:", Array.from(categoriesMap.entries()));
        console.log("Farby pre Kategórie:");
        categoriesSnapshot.docs.forEach(doc => {
            const categoryData = doc.data();
            console.log(`ID kategórie: ${doc.id}, Názov: ${categoryData.name}, Farba: ${categoryData.color || 'N/A'}`);
        });

        const groupsSnapshot = await getDocs(groupsCollectionRef);
        const groupsMap = new Map();
        groupsSnapshot.forEach(doc => groupsMap.set(doc.id, doc.data().name || doc.id));
        console.log("displayMatchesAsSchedule: Načítané skupiny:", Array.from(groupsMap.entries()));

        const playingDaysSnapshot = await getDocs(query(playingDaysCollectionRef, orderBy("date", "asc")));
        const allPlayingDayDates = playingDaysSnapshot.docs.map(doc => doc.data().date);
        allPlayingDayDates.sort();
        console.log("displayMatchesAsSchedule: Načítané hracie dni (len dátumy):", allPlayingDayDates);

        const sportHallsSnapshot = await getDocs(query(placesCollectionRef, where("type", "==", "Športová hala"), orderBy("name", "asc")));
        const allSportHalls = sportHallsSnapshot.docs.map(doc => doc.data().name);
        console.log("displayMatchesAsSchedule: Načítané športové haly:", allSportHalls);

        const allSettings = currentAllSettings; // Použi currentAllSettings odovzdané ako parameter
        let globalFirstDayStartTime = allSettings.firstDayStartTime || '08:00';
        let globalOtherDaysStartTime = allSettings.otherDaysStartTime || '08:00';
        console.log(`displayMatchesAsSchedule: Globálny čas začiatku (prvý deň): ${globalFirstDayStartTime}, (ostatné dni): ${globalOtherDaysStartTime}`);

        const blockedIntervalsSnapshot = await getDocs(query(blockedSlotsCollectionRef));
        const allBlockedIntervals = blockedIntervalsSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'blocked_interval',
            isBlocked: doc.data().isBlocked === true,
            originalMatchId: doc.data().originalMatchId || null,
            ...doc.data(),
            startInMinutes: parseTimeToMinutes(doc.data().startTime),
            endInMinutes: parseTimeToMinutes(doc.data().endTime)
        }));
        console.log("displayMatchesAsSchedule: Načítané zablokované intervaly:", JSON.stringify(allBlockedIntervals.map(s => ({id: s.id, date: s.date, location: s.location, startTime: s.startTime, endTime: s.endTime, isBlocked: s.isBlocked, originalMatchId: s.originalMatchId}))));

        // --- NOVÁ LOGIKA: Aktualizuj dokumenty zápasov so správnym trvaním/bufferom z nastavení ---
        const updateMatchesBatch = writeBatch(db);
        let matchesToUpdateCount = 0;

        const processedMatchesPromises = allMatchesRaw.map(async match => {
            const [team1Data, team2Data] = await Promise.allSettled([
                getTeamName(match.categoryId, match.groupId, match.team1Number, categoriesMap, groupsMap),
                getTeamName(match.categoryId, match.groupId, match.team2Number, categoriesMap, groupsMap)
            ]);

            const categorySettings = getCategoryMatchSettings(match.categoryId, allSettings);
            const calculatedDuration = categorySettings.duration;
            const calculatedBufferTime = categorySettings.bufferTime;
            const startInMinutes = parseTimeToMinutes(match.startTime);

            // Skontroluj, či je potrebné aktualizovať uložené trvanie/buffer
            if (match.duration !== calculatedDuration || match.bufferTime !== calculatedBufferTime) {
                console.log(`displayMatchesAsSchedule: Zápas ID ${match.id} má neaktuálne trvanie/buffer. Aktualizujem v DB. Staré: D=${match.duration}, B=${match.bufferTime}. Nové: D=${calculatedDuration}, B=${calculatedBufferTime}`);
                updateMatchesBatch.update(match.docRef, {
                    duration: calculatedDuration,
                    bufferTime: calculatedBufferTime
                });
                matchesToUpdateCount++;
            }

            return {
                ...match,
                team1DisplayName: team1Data.status === 'fulfilled' ? team1Data.value.fullDisplayName : 'N/A',
                team1ShortDisplayName: team1Data.status === 'fulfilled' ? team1Data.value.shortDisplayName : 'N/A',
                team1ClubName: team1Data.status === 'fulfilled' ? team1Data.value.clubName : 'N/A',
                team1ClubId: team1Data.status === 'fulfilled' ? team1Data.value.clubId : null,
                team2DisplayName: team2Data.status === 'fulfilled' ? team2Data.value.fullDisplayName : 'N/A',
                team2ShortDisplayName: team2Data.status === 'fulfilled' ? team2Data.value.shortDisplayName : 'N/A',
                team2ClubName: team2Data.status === 'fulfilled' ? team2Data.value.clubName : 'N/A',
                team2ClubId: team2Data.status === 'fulfilled' ? team2Data.value.clubId : null,
                duration: calculatedDuration, // Použi aktualizované trvanie
                bufferTime: calculatedBufferTime, // Použi aktualizovaný čas medzi zápasmi
                startInMinutes: startInMinutes,
                endOfPlayInMinutes: startInMinutes + calculatedDuration, // Prepočítaj koniec hry
                footprintEndInMinutes: startInMinutes + calculatedDuration + calculatedBufferTime // Prepočítaj koniec stopy
            };
        });

        let allMatches = await Promise.all(processedMatchesPromises);
        
        if (matchesToUpdateCount > 0) {
            console.log(`displayMatchesAsSchedule: Spúšťam batch pre aktualizáciu ${matchesToUpdateCount} zápasov.`);
            await updateMatchesBatch.commit();
            console.log(`displayMatchesAsSchedule: Batch pre aktualizáciu zápasov úspešne dokončený.`);
        }
        
        console.log("displayMatchesAsSchedule: Všetky zápasy s naplnenými zobrazovanými názvami a prepočítanou dĺžkou/bufferom:", JSON.stringify(allMatches.map(m => ({id: m.id, date: m.date, location: m.location, startTime: m.startTime, duration: m.duration, bufferTime: m.bufferTime, footprintEndInMinutes: m.footprintEndInMinutes}))));


        const groupedMatches = new Map();
        const unassignedMatches = []; // Nové pole pre zápasy bez haly

        allMatches.forEach(match => {
            if (match.locationType === 'Športová hala') {
                if (!groupedMatches.has(match.location)) {
                    groupedMatches.set(match.location, new Map());
                }
                const dateMap = groupedMatches.get(match.location);
                if (!dateMap.has(match.date)) {
                    dateMap.set(match.date, []);
                }
                dateMap.get(match.date).push(match);
            } else {
                unassignedMatches.push(match); // Pridaj k nepriradeným zápasom
                console.warn(`displayMatchesAsSchedule: Zápas ${match.id} s neplatným typom miesta "${match.locationType}" bol preskočený z rozvrhu športových hál.`);
            }
        });
        console.log('displayMatchesAsSchedule: Zoskupené zápasy (podľa miesta a dátumu):', groupedMatches);
        console.log('displayMatchesAsSchedule: Nepriradené zápasy:', unassignedMatches); // Zaznamenaj nepriradené zápasy


        let scheduleHtml = '<div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: flex-start;">';

        if (allSportHalls.length === 0 && unassignedMatches.length === 0) {
            scheduleHtml += '<p style="margin: 20px; text-align: center; color: #888;">Žiadne športové haly na zobrazenie. Pridajte nové miesta typu "Športová hala" pomocou tlačidla "+".</p>';
        } else if (allPlayingDayDates.length === 0 && unassignedMatches.length === 0) {
            scheduleHtml += '<p style="margin: 20px; text-align: center; color: #888;">Žiadne hracie dni neboli definované. Najprv pridajte hracie dni.</p>';
        }
        else {
            const isOddNumberOfLocations = allSportHalls.length % 2 !== 0;

            for (let i = 0; i < allSportHalls.length; i++) {
                const location = allSportHalls[i];
                const matchesByDateForLocation = groupedMatches.get(location) || new Map();

                const uniqueGroupIdsInLocation = new Set();
                matchesByDateForLocation.forEach(dateMap => {
                    dateMap.forEach(match => {
                        if (match.groupId) {
                            uniqueGroupIdsInLocation.add(match.groupId);
                        }
                    });
                });
                const groupIdsArrayInLocation = Array.from(uniqueGroupIdsInLocation).sort();
                let groupAlignmentMapForLocation = new Map();

                if (groupIdsArrayInLocation.length === 2) {
                    groupAlignmentMapForLocation.set(groupIdsArrayInLocation[0], 'left');
                    groupAlignmentMapForLocation.set(groupIdsArrayInLocation[1], 'right');
                } else if (groupIdsArrayInLocation.length === 3) {
                    groupAlignmentMapForLocation.set(groupIdsArrayInLocation[0], 'left');
                    groupAlignmentMapForLocation.set(groupIdsArrayInLocation[1], 'right');
                    groupAlignmentMapForLocation.set(groupIdsArrayInLocation[2], 'center');
                }


                let locationGroupStyle = "flex: 1 1 45%; min-width: 300px; margin-bottom: 0; border: 1px solid #ccc; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);";
                if (isOddNumberOfLocations && i === allSportHalls.length - 1) {
                    locationGroupStyle += " margin-right: 25.25%;";
                    locationGroupStyle += " margin-left: 25.25%;";
                }

                scheduleHtml += `<div class="location-group" style="${locationGroupStyle}">`;
                scheduleHtml += `<h2 class="location-header-clickable" data-location="${location}" data-type="Športová hala" style="background-color: #007bff; color: white; padding: 18px; margin: 0; text-align: center; cursor: pointer;">${location}</h2>`;

                if (allPlayingDayDates.length === 0) {
                    scheduleHtml += `<p style="margin: 20px; text-align: center; color: #888;">Žiadne hracie dni neboli definované. Najprv pridajte hracie dni.</p>`;
                } else {
                    for (const date of allPlayingDayDates) {
                        const matchesForDateAndLocation = groupedMatches.get(location) ? groupedMatches.get(location).get(date) || [] : [];
                        
                        const displayDateObj = new Date(date);
                        const formattedDisplayDate = `${String(displayDateObj.getDate()).padStart(2, '0')}. ${String(displayDateObj.getMonth() + 1).padStart(2, '0')}. ${displayDateObj.getFullYear()}`;
                        const dayName = displayDateObj.toLocaleDateString('sk-SK', { weekday: 'long' });


                        const currentEventsForRendering = [
                            ...matchesForDateAndLocation.map(m => {
                                // Trvanie a čas medzi zápasmi sú už aktualizované v poli allMatches
                                return {
                                    ...m,
                                    type: 'match',
                                    startInMinutes: m.startInMinutes,
                                    endOfPlayInMinutes: m.endOfPlayInMinutes,
                                    footprintEndInMinutes: m.footprintEndInMinutes,
                                    bufferTime: m.bufferTime
                                };
                            }),
                            ...allBlockedIntervals.filter(bs => bs.date === date && bs.location === location)
                        ];
                        currentEventsForRendering.sort((a, b) => a.startInMinutes - b.startInMinutes);
                        console.log(`displayMatchesAsSchedule: Udalosti pre render pre ${location} na ${date} (zoradené):`, JSON.stringify(currentEventsForRendering.map(e => ({id: e.id, type: e.type, startTime: e.startTime || e.startInMinutes, endTime: e.endTime || e.endInMinutes, isBlocked: e.isBlocked, originalMatchId: e.originalMatchId, endOfPlayInMinutes: e.endOfPlayInMinutes, footprintEndInMinutes: e.footprintEndInMinutes}))));


                        const finalEventsToRender = [];
                        const initialScheduleStartMinutes = await getInitialScheduleStartMinutes(date, allSettings); 
                        let currentTimePointerInMinutes = initialScheduleStartMinutes;
                        
                        // Uisti sa, že ak pre daný deň nie sú žiadne udalosti, vytvorí sa zástupný symbol od počiatočného štartu do konca dňa
                        if (currentEventsForRendering.length === 0) {
                            const gapStart = initialScheduleStartMinutes;
                            const gapEnd = 24 * 60; // Koniec dňa
                            const formattedGapStartTime = formatMinutesToTime(gapStart);
                            const formattedGapEndTime = formatMinutesToTime(gapEnd);
                            if (gapEnd > gapStart) {
                                finalEventsToRender.push({
                                    type: 'blocked_interval',
                                    id: 'generated-initial-interval-' + Math.random().toString(36).substr(2, 9),
                                    date: date,
                                    location: location,
                                    startTime: formattedGapStartTime,
                                    endTime: formattedGapEndTime,
                                    isBlocked: false,
                                    startInMinutes: gapStart,
                                    endInMinutes: gapEnd,
                                    originalMatchId: null
                                });
                                console.log(`displayMatchesAsSchedule: Žiadne udalosti pre ${date} na ${location}. Pridávam počiatočný celodenný zástupný symbol.`);
                            }
                        } else {
                            for (let i = 0; i < currentEventsForRendering.length; i++) {
                                const event = currentEventsForRendering[i];
                                const eventStart = event.startInMinutes;
                                const eventEnd = event.type === 'match' ? event.footprintEndInMinutes : event.endInMinutes;

                                // Pridaj voľný interval, ak je medzera medzi aktuálnym ukazovateľom a začiatkom udalosti
                                if (currentTimePointerInMinutes < eventStart) {
                                    const gapStart = currentTimePointerInMinutes;
                                    const gapEnd = eventStart;
                                    const formattedGapStartTime = formatMinutesToTime(gapStart);
                                    const formattedGapEndTime = formatMinutesToTime(gapEnd);
                                    
                                    // Získaj čas medzi zápasmi *predchádzajúcej* udalosti zápasu, ak existuje.
                                    // Je kľúčové iterovať dozadu, aby sa našiel posledný zápas a získal sa jeho buffer.
                                    let previousMatchBufferTime = 0;
                                    for(let j = i - 1; j >= 0; j--) {
                                        if (currentEventsForRendering[j].type === 'match') {
                                            previousMatchBufferTime = currentEventsForRendering[j].bufferTime || 0;
                                            break; // Nájdený posledný zápas, získaj jeho buffer a preruš
                                        }
                                    }

                                    // Pridaj zástupný symbol len, ak bol vytvorený z vymazaného zápasu,
                                    // alebo ak je jeho trvanie väčšie ako čas medzi zápasmi predchádzajúceho zápasu.
                                    const existingFreeInterval = allBlockedIntervals.find(s => 
                                        s.date === date && 
                                        s.location === location && 
                                        s.isBlocked === false && 
                                        s.startInMinutes === gapStart && 
                                        s.endInMinutes === gapEnd
                                    );

                                    const isFromDeletedMatch = existingFreeInterval && existingFreeInterval.originalMatchId;
                                    const isLongerThanPreviousBuffer = (gapEnd - gapStart) > previousMatchBufferTime;

                                    if (isFromDeletedMatch || isLongerThanPreviousBuffer) {
                                        finalEventsToRender.push({
                                            type: 'blocked_interval',
                                            id: existingFreeInterval ? existingFreeInterval.id : 'generated-interval-' + Math.random().toString(36).substr(2, 9),
                                            date: date,
                                            location: location,
                                            startTime: formattedGapStartTime,
                                            endTime: formattedGapEndTime,
                                            isBlocked: false,
                                            startInMinutes: gapStart,
                                            endInMinutes: gapEnd,
                                            originalMatchId: isFromDeletedMatch ? existingFreeInterval.originalMatchId : null // Zachovaj, ak z vymazaného zápasu
                                        });
                                        console.log(`displayMatchesAsSchedule: Pridávam zástupný symbol medzery (${formattedGapStartTime}-${formattedGapEndTime}). Z vymazaného zápasu: ${isFromDeletedMatch}, Dlhšie ako buffer: ${isLongerThanPreviousBuffer}`);
                                    } else {
                                        console.log(`displayMatchesAsSchedule: Preskakujem medzeru ${formattedGapStartTime}-${formattedGapEndTime}, pretože je to čisto čas medzi zápasmi alebo je príliš krátka.`);
                                    }
                                }
                                
                                // Pridaj skutočnú udalosť
                                finalEventsToRender.push(event);
                                currentTimePointerInMinutes = Math.max(currentTimePointerInMinutes, eventEnd);
                            }

                            // Pridaj konečný zástupný symbol, ak je medzera medzi poslednou udalosťou a koncom dňa
                            if (currentTimePointerInMinutes < 24 * 60) {
                                const gapStart = currentTimePointerInMinutes;
                                const gapEnd = 24 * 60;
                                const formattedGapStartTime = formatMinutesToTime(gapStart);
                                const formattedGapEndTime = formatMinutesToTime(gapEnd);

                                if ((gapEnd - gapStart) > 0) { // Pridaj len, ak je trvanie > 0
                                    const existingFinalPlaceholder = allBlockedIntervals.find(s => 
                                        s.date === date && 
                                        s.location === location && 
                                        s.isBlocked === false && 
                                        s.startInMinutes === gapStart && 
                                        s.endInMinutes === gapEnd
                                    );
                                    finalEventsToRender.push({
                                        type: 'blocked_interval',
                                        id: existingFinalPlaceholder ? existingFinalPlaceholder.id : 'generated-final-interval-' + Math.random().toString(36).substr(2, 9),
                                        date: date,
                                        location: location,
                                        startTime: formattedGapStartTime,
                                        endTime: formattedGapEndTime,
                                        isBlocked: false,
                                        startInMinutes: gapStart,
                                        endInMinutes: gapEnd,
                                        originalMatchId: null 
                                    });
                                    console.log(`displayMatchesAsSchedule: Pridávam konečný zástupný symbol medzery: ${formattedGapStartTime}-${formattedGapEndTime}.`);
                                } else {
                                    console.log(`displayMatchesAsSchedule: Preskakujem konečnú medzeru ${formattedGapStartTime}-${formattedGapEndTime}, pretože jej trvanie je 0.`);
                                }
                            }
                        }

                        console.log(`displayMatchesAsSchedule: FinalEventsToRender (po vložení medzier a zástupných symbolov):`, JSON.stringify(finalEventsToRender.map(e => ({id: e.id, type: e.type, startTime: e.startTime || e.startInMinutes, endTime: e.endTime || e.endInMinutes, isBlocked: e.isBlocked, originalMatchId: e.originalMatchId, endOfPlayInMinutes: e.endOfPlayInMinutes, footprintEndInMinutes: e.footprintEndInMinutes}))));

                        
                        scheduleHtml += `<div class="date-group" data-date="${date}" data-location="${location}" data-initial-start-time="${formatMinutesToTime(initialScheduleStartMinutes)}">`;
                        scheduleHtml += `<h3 class="playing-day-header-clickable" style="background-color: #eaeaea; padding: 15px; margin: 0; border-bottom: 1px solid #ddd; cursor: pointer;">${dayName} ${formattedDisplayDate}</h3>`;

                        scheduleHtml += `<table class="data-table match-list-table compact-table" style="width: 100%; border-collapse: collapse;">`;
                        scheduleHtml += `<thead><tr>`;
                        scheduleHtml += `<th>Čas</th>`;
                        scheduleHtml += `<th>Domáci</th>`;
                        scheduleHtml += `<th>Hostia</th>`;
                        scheduleHtml += `<th>ID Domáci</th>`;
                        scheduleHtml += `<th>ID Hostia</th></tr></thead><tbody>`;

                        let contentAddedForThisDate = false;
                        
                        for (const event of finalEventsToRender) {
                            if (event.type === 'match') {
                                const match = event;
                                const displayedMatchEndTimeInMinutes = match.endOfPlayInMinutes; 
                                const formattedDisplayedEndTime = formatMinutesToTime(displayedMatchEndTimeInMinutes);
                                
                                const categoryColor = categoryColorsMap.get(match.categoryId) || 'transparent';
                                let textAlignStyle = '';
                                if (match.groupId && groupAlignmentMapForLocation.has(match.groupId)) {
                                    textAlignStyle = `text-align: ${groupAlignmentMapForLocation.get(match.groupId)};`;
                                } else if (groupIdsArrayInLocation.length > 3) {
                                     textAlignStyle = `text-align: center;`;
                                }
                                console.log(`displayMatchesAsSchedule: Vykresľujem zápas: ID ${match.id}, Čas: ${match.startTime}-${formattedDisplayedEndTime} (zobrazený), Miesto: ${match.location}, Dátum: ${match.date}`);

                                scheduleHtml += `
                                    <tr draggable="true" data-id="${match.id}" class="match-row" data-start-time="${match.startTime}" data-duration="${match.duration}" data-buffer-time="${match.bufferTime}" data-footprint-end-time="${formatMinutesToTime(match.footprintEndInMinutes)}">
                                        <td>${match.startTime} - ${formattedDisplayedEndTime}</td>
                                        <td style="${textAlignStyle}">${match.team1ClubName || 'N/A'}</td>
                                        <td style="${textAlignStyle}">${match.team2ClubName || 'N/A'}</td>
                                        <td style="background-color: ${categoryColor}; ${textAlignStyle}">${match.team1ShortDisplayName || 'N/A'}</td>
                                        <td style="background-color: ${categoryColor}; ${textAlignStyle}">${match.team2ShortDisplayName || 'N/A'}</td>
                                    </tr>
                                `;
                                contentAddedForThisDate = true;

                            } else if (event.type === 'blocked_interval') {
                                const blockedInterval = event;
                                const blockedIntervalStartHour = String(Math.floor(blockedInterval.startInMinutes / 60)).padStart(2, '0');
                                const blockedIntervalStartMinute = String(blockedInterval.startInMinutes % 60).padStart(2, '0');
                                const blockedIntervalEndHour = String(Math.floor(blockedInterval.endInMinutes / 60)).padStart(2, '0');
                                const blockedIntervalEndMinute = String(blockedInterval.endInMinutes % 60).padStart(2, '0');
                                
                                const isUserBlocked = blockedInterval.isBlocked === true; 

                                // Vykresli tento voľný interval len, ak bol vytvorený z vymazaného zápasu,
                                // alebo ak je jeho trvanie väčšie ako 0 (t.j. nie medzera s nulovou dĺžkou).
                                // Automaticky generované všeobecné medzery, ktoré sú po zohľadnení bufferu efektívne 0 trvania, sa preskakujú.
                                const intervalDuration = blockedInterval.endInMinutes - blockedInterval.startInMinutes;

                                if (!isUserBlocked && !blockedInterval.originalMatchId && intervalDuration === 0) {
                                    console.log(`displayMatchesAsSchedule: Preskakujem vykreslenie čisto kozmetického/nulového zástupného symbolu: ${blockedIntervalStartHour}:${blockedIntervalStartMinute}-${blockedIntervalEndHour}:${blockedIntervalEndMinute}`);
                                    continue; // Preskoč vykreslenie tohto riadku, ak ide o generovaný voľný interval bez skutočného trvania
                                }


                                let rowClass = '';
                                let cellStyle = '';
                                let displayText = ''; 
                                let dataAttributes = `data-is-blocked="${isUserBlocked}"`;
                                if (blockedInterval.originalMatchId) {
                                    dataAttributes += ` data-original-match-id="${blockedInterval.originalMatchId}"`;
                                }

                                let displayTimeHtml = `<td>${blockedIntervalStartHour}:${blockedIntervalStartMinute} - ${blockedIntervalEndHour}:${blockedIntervalEndMinute}</td>`;
                                let textColspan = '4';

                                if (blockedInterval.endInMinutes === 24 * 60 && blockedInterval.startInMinutes === 0) { // Celodenný interval
                                    displayTimeHtml = `<td></td>`; 
                                    textColspan = '4';
                                } else if (blockedInterval.endInMinutes === 24 * 60) { // Interval do konca dňa
                                    displayTimeHtml = `<td></td>`;
                                    textColspan = '4';
                                } else if (blockedInterval.startInMinutes === 0) { // Interval od začiatku dňa
                                     displayTimeHtml = `<td>00:00 - ${blockedIntervalEndHour}:${blockedIntervalEndMinute}</td>`; 
                                     textColspan = '4';
                                }

                                if (isUserBlocked) { 
                                    rowClass = 'blocked-interval-row'; 
                                    cellStyle = 'text-align: center; color: white; background-color: #dc3545; font-style: italic;';
                                    displayText = 'Zablokovaný interval'; 
                                } else {
                                    rowClass = 'empty-interval-row free-interval-available-row'; 
                                    cellStyle = 'text-align: center; color: #888; font-style: italic; background-color: #f0f0f0;'; 
                                    displayText = 'Voľný interval dostupný'; 
                                }

                                console.log(`displayMatchesAsSchedule: Vykresľujem zablokovaný interval: ID ${blockedInterval.id}, Čas: ${blockedIntervalStartHour}:${blockedIntervalStartMinute}-${blockedIntervalEndHour}:${blockedIntervalEndMinute}, Miesto: ${blockedInterval.location}, Dátum: ${blockedInterval.date}, isBlocked: ${isUserBlocked}, Zobrazovaný text: "${displayText}"`);

                                scheduleHtml += `
                                    <tr class="${rowClass}" data-id="${blockedInterval.id}" data-date="${date}" data-location="${location}" data-start-time="${blockedIntervalStartHour}:${blockedIntervalStartMinute}" data-end-time="${blockedIntervalEndHour}:${blockedIntervalEndMinute}" ${dataAttributes}>
                                        ${displayTimeHtml}
                                        <td colspan="${textColspan}" style="${cellStyle}">${displayText}</td>
                                    </tr>
                                `;
                                contentAddedForThisDate = true;
                            }
                        }
                        
                        scheduleHtml += `
                            <tr class="footer-spacer-row" style="height: 15px; background-color: white;">
                                <td colspan="5"></td>
                            </tr>
                        `;


                        if (!contentAddedForThisDate) {
                            scheduleHtml += `<tr><td colspan="5" style="text-align: center; color: #888; font-style: italic; padding: 15px;">Žiadne zápasy ani zablokované intervaly pre tento deň.</td></tr>`;
                        }

                        scheduleHtml += `</tbody></table></div>`;
                    }
                }
                scheduleHtml += `</div>`;
            }

            // Zobraz nepriradené zápasy
            if (unassignedMatches.length > 0) {
                scheduleHtml += `<div class="location-group" style="flex: 1 1 45%; min-width: 300px; margin-bottom: 0; border: 1px solid #ccc; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">`;
                scheduleHtml += `<h2 style="background-color: #6c757d; color: white; padding: 18px; margin: 0; text-align: center;">Zápasy bez zadanej haly</h2>`;
                
                // Zoskup nepriradené zápasy podľa dátumu
                const unassignedMatchesByDate = new Map();
                unassignedMatches.forEach(match => {
                    if (!unassignedMatchesByDate.has(match.date)) {
                        unassignedMatchesByDate.set(match.date, []);
                    }
                    unassignedMatchesByDate.get(match.date).push(match);
                });

                // Zoraď dátumy pre nepriradené zápasy
                const sortedUnassignedDates = Array.from(unassignedMatchesByDate.keys()).sort();

                if (sortedUnassignedDates.length === 0) {
                    scheduleHtml += `<p style="margin: 20px; text-align: center; color: #888;">Žiadne zápasy bez priradenej haly.</p>`;
                } else {
                    for (const date of sortedUnassignedDates) {
                        const matchesForDate = unassignedMatchesByDate.get(date).sort((a, b) => {
                            const [hA, mA] = a.startTime.split(':').map(Number);
                            const [hB, mB] = b.startTime.split(':').map(Number);
                            return (hA * 60 + mA) - (hB * 60 + mB);
                        });

                        const displayDateObj = new Date(date);
                        const formattedDisplayDate = `${String(displayDateObj.getDate()).padStart(2, '0')}. ${String(displayDateObj.getMonth() + 1).padStart(2, '0')}. ${displayDateObj.getFullYear()}`;
                        const dayName = displayDateObj.toLocaleDateString('sk-SK', { weekday: 'long' });

                        scheduleHtml += `<div class="date-group" data-date="${date}" data-location="Nezadaná hala" data-initial-start-time="00:00">`; // Použi fiktívne hodnoty pre nepriradené
                        scheduleHtml += `<h3 class="playing-day-header-clickable" style="background-color: #eaeaea; padding: 15px; margin: 0; border-bottom: 1px solid #ddd; cursor: pointer;">${dayName} ${formattedDisplayDate}</h3>`;
                        scheduleHtml += `<table class="data-table match-list-table compact-table" style="width: 100%; border-collapse: collapse;">`;
                        scheduleHtml += `<thead><tr>`;
                        scheduleHtml += `<th>Čas</th>`;
                        scheduleHtml += `<th>Domáci</th>`;
                        scheduleHtml += `<th>Hostia</th>`;
                        scheduleHtml += `<th>ID Domáci</th>`;
                        scheduleHtml += `<th>ID Hostia</th></tr></thead><tbody>`;

                        matchesForDate.forEach(match => {
                            // Trvanie zápasu a čas medzi zápasmi sú už aktualizované v poli allMatches
                            const displayedMatchEndTimeInMinutes = match.endOfPlayInMinutes; 
                            const formattedDisplayedEndTime = formatMinutesToTime(displayedMatchEndTimeInMinutes);
                            const categoryColor = categoryColorsMap.get(match.categoryId) || 'transparent';

                            scheduleHtml += `
                                <tr draggable="true" data-id="${match.id}" class="match-row" data-start-time="${match.startTime}" data-duration="${match.duration}" data-buffer-time="${match.bufferTime}" data-footprint-end-time="${formattedDisplayedEndTime}" data-unassigned="true">
                                    <td>${match.startTime} - ${formattedDisplayedEndTime}</td>
                                    <td>${match.team1ClubName || 'N/A'}</td>
                                    <td>${match.team2ClubName || 'N/A'}</td>
                                    <td style="background-color: ${categoryColor};">${match.team1ShortDisplayName || 'N/A'}</td>
                                    <td style="background-color: ${categoryColor};">${match.team2ShortDisplayName || 'N/A'}</td>
                                </tr>
                            `;
                        });

                        scheduleHtml += `
                            <tr class="footer-spacer-row" style="height: 15px; background-color: white;">
                                <td colspan="5"></td>
                            </tr>
                        `;
                        scheduleHtml += `</tbody></table></div>`;
                    }
                }
                scheduleHtml += `</div>`;
            }
        }
        scheduleHtml += '</div>';

        matchesContainer.innerHTML = scheduleHtml;
        console.log('displayMatchesAsSchedule: HTML rozvrhu aktualizované.');

        matchesContainer.querySelectorAll('.match-row').forEach(row => {
            row.addEventListener('click', (event) => {
                const matchId = event.currentTarget.dataset.id;
                openMatchModal(matchId, allSettings); // Odovzdaj allSettings
            });
            row.addEventListener('dragstart', (event) => {
                console.log(`Drag & Drop: dragstart - ID zápasu: ${event.target.dataset.id}, Cieľ:`, event.target);
                event.dataTransfer.setData('text/plain', event.target.dataset.id);
                event.dataTransfer.effectAllowed = 'move';
                event.target.classList.add('dragging');
            });

            row.addEventListener('dragend', (event) => {
                console.log(`Drag & Drop: dragend - ID zápasu: ${event.target.dataset.id}, Cieľ:`, event.target);
                event.target.classList.remove('dragging');
            });
            // Nové obsluhy dragover a drop pre match-row
            row.addEventListener('dragover', (event) => {
                event.preventDefault(); // Povoliť pustenie
                event.dataTransfer.dropEffect = 'move';
                event.currentTarget.classList.add('drop-over-row'); // Vizuálna spätná väzba
                console.log(`Drag & Drop: dragover na match-row - ID: ${event.currentTarget.dataset.id}, Cieľ:`, event.currentTarget);
            });

            row.addEventListener('dragleave', (event) => {
                event.currentTarget.classList.remove('drop-over-row');
                console.log(`Drag & Drop: dragleave z match-row - ID: ${event.currentTarget.dataset.id}, Cieľ:`, event.currentTarget);
            });

            row.addEventListener('drop', async (event) => {
                event.preventDefault();
                event.currentTarget.classList.remove('drop-over-row');

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const targetMatchId = event.currentTarget.dataset.id;
                const newDate = event.currentTarget.closest('.date-group').dataset.date;
                const newLocation = event.currentTarget.closest('.date-group').dataset.location;

                console.log(`Drag & Drop: drop na match-row - Presunutý zápas ID: ${draggedMatchId}, Cieľový zápas ID: ${targetMatchId}, Nový dátum: ${newDate}, Nové miesto: ${newLocation}, Cieľ:`, event.currentTarget);

                if (draggedMatchId === targetMatchId) {
                    console.log("Drag & Drop: Pustené na seba, žiadna akcia.");
                    return;
                }

                // Urči, či sa púšťa pred alebo za cieľovým zápasom
                const rect = event.currentTarget.getBoundingClientRect();
                const dropY = event.clientY;
                const middleY = rect.top + rect.height / 2;

                let droppedProposedStartTime;
                if (dropY < middleY) {
                    // Pustené v prvej polovici cieľového riadku, takže umiestni PRED cieľový zápas
                    droppedProposedStartTime = event.currentTarget.dataset.startTime;
                    console.log(`Drag & Drop: Pustené PRED cieľový zápas. Navrhovaný počiatočný čas: ${droppedProposedStartTime}`);
                } else {
                    // Pustené v druhej polovici cieľového riadku, takže umiestni ZA cieľový zápas
                    droppedProposedStartTime = event.currentTarget.dataset.footprintEndTime; // Toto je koniec hry + buffer
                    console.log(`Drag & Drop: Pustené ZA cieľový zápas. Navrhovaný počiatočný čas: ${droppedProposedStartTime}`);
                }

                await moveAndRescheduleMatch(draggedMatchId, newDate, newLocation, droppedProposedStartTime, allSettings);
            });
        });

        matchesContainer.querySelectorAll('.empty-interval-row').forEach(row => {
            row.addEventListener('click', (event) => {
                const date = event.currentTarget.dataset.date;
                const location = event.currentTarget.dataset.location;
                const startTime = event.currentTarget.dataset.startTime; 
                const endTime = event.currentTarget.dataset.endTime; 
                const blockedIntervalId = event.currentTarget.dataset.id;

                openFreeIntervalModal(date, location, startTime, endTime, blockedIntervalId, allSettings); // Odovzdaj allSettings
            });
            row.addEventListener('dragover', (event) => {
                event.preventDefault(); // Kľúčové pre povolenie pustenia
                event.dataTransfer.dropEffect = 'move';
                event.currentTarget.classList.add('drop-over-row');
                console.log(`Drag & Drop: dragover na empty-interval-row - ID: ${event.currentTarget.dataset.id}, Cieľ:`, event.currentTarget);
            });
            row.addEventListener('dragleave', (event) => {
                event.currentTarget.classList.remove('drop-over-row');
                console.log(`Drag & Drop: dragleave z empty-interval-row - ID: ${event.currentTarget.dataset.id}, Cieľ:`, event.currentTarget);
            });
            row.addEventListener('drop', async (event) => {
                event.preventDefault(); // Kľúčové pre spracovanie pustenia
                event.currentTarget.classList.remove('drop-over-row');

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const newDate = event.currentTarget.dataset.date;
                const newLocation = event.currentTarget.dataset.location;
                const droppedProposedStartTime = event.currentTarget.dataset.startTime;
                const targetBlockedIntervalId = event.currentTarget.dataset.id;

                console.log(`Drag & Drop: drop na empty-interval-row - Presunutý zápas ID: ${draggedMatchId}, Nový dátum: ${newDate}, Nové miesto: ${newLocation}, Navrhovaný čas: ${droppedProposedStartTime}, Cieľový interval ID: ${targetBlockedIntervalId}, Cieľ:`, event.currentTarget);
                
                if (targetBlockedIntervalId) {
                    try {
                        // Vymaž starý automaticky generovaný voľný slot, pretože je nahradený pusteným zápasom
                        // Toto je dôležité pre vyčistenie, aby recalculateAndSaveScheduleForDateAndLocation ho okamžite znova nevytvoril.
                        await deleteDoc(doc(blockedSlotsCollectionRef, targetBlockedIntervalId));
                        console.log(`Drag & Drop: Pôvodný voľný slot ${targetBlockedIntervalId} vymazaný.`);
                    } catch (error) {
                        console.error(`Drag & Drop: Chyba pri mazaní pôvodného voľného slotu ${targetBlockedIntervalId}:`, error);
                    }
                }
                
                await moveAndRescheduleMatch(draggedMatchId, newDate, newLocation, droppedProposedStartTime, allSettings);
            });
        });

        matchesContainer.querySelectorAll('.blocked-interval-row').forEach(row => {
            row.addEventListener('click', (event) => {
                const blockedIntervalId = event.currentTarget.dataset.id;
                const date = event.currentTarget.dataset.date;
                const location = event.currentTarget.dataset.location;
                const startTime = event.currentTarget.dataset.startTime;
                const endTime = event.currentTarget.dataset.endTime;
                openFreeIntervalModal(date, location, startTime, endTime, blockedIntervalId, allSettings); // Odovzdaj allSettings
            });
            row.addEventListener('dragover', (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'none'; // Nemožno pustiť na skutočne zablokovaný interval
                event.currentTarget.classList.add('drop-over-forbidden');
                console.log(`Drag & Drop: dragover na blocked-interval-row - ID: ${event.currentTarget.dataset.id}, Drop efekt: none, Cieľ:`, event.currentTarget);
            });
            row.addEventListener('dragleave', (event) => {
                event.currentTarget.classList.remove('drop-over-forbidden');
                console.log(`Drag & Drop: dragleave z blocked-interval-row - ID: ${event.currentTarget.dataset.id}, Cieľ:`, event.currentTarget);
            });
            row.addEventListener('drop', async (event) => {
                event.preventDefault();
                event.currentTarget.classList.remove('drop-over-forbidden');

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const date = event.currentTarget.dataset.date;
                const location = event.currentTarget.dataset.location;
                const startTime = event.currentTarget.dataset.startTime;
                const endTime = event.currentTarget.dataset.endTime;

                console.log(`Drag & Drop: drop na blocked-interval-row - Pokus o presun zápasu ${draggedMatchId} na zablokovaný interval: Dátum ${date}, Miesto ${location}, Čas ${startTime}-${endTime}. Presun ZAMITNUTÝ. Cieľ:`, event.currentTarget);
                await showMessage('Upozornenie', 'Tento časový interval je zablokovaný. Zápas naň nie je možné presunúť.');
            });
        });

        matchesContainer.querySelectorAll('.location-header-clickable').forEach(header => {
            header.addEventListener('click', (event) => {
                const locationToEdit = header.dataset.location;
                const locationTypeToEdit = header.dataset.type;
                editPlace(locationToEdit, locationTypeToEdit);
            });
        });

        matchesContainer.querySelectorAll('.playing-day-header-clickable').forEach(header => {
            header.addEventListener('click', (event) => {
                const dateGroupDiv = event.currentTarget.closest('.date-group');
                if (dateGroupDiv) {
                    const dateToEdit = dateGroupDiv.dataset.date;
                    editPlayingDay(dateToEdit);
                }
            });
        });

        matchesContainer.querySelectorAll('.date-group').forEach(dateGroupDiv => {
            dateGroupDiv.addEventListener('dragover', (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move'; // Predvolené na presun pre všeobecnú oblasť

                const targetRow = event.target.closest('tr');
                if (targetRow) {
                    // Ak je nad konkrétnym riadkom, nech obsluha dragover tohto riadku spracuje štýlovanie/efekt.
                    // NEPRIDÁVAJ drop-target-active na samotný dateGroupDiv.
                    // Tiež NENASTAVUJ dropEffect na 'none' tu pre platné riadky.
                    if (targetRow.classList.contains('blocked-interval-row')) {
                        // Toto je skutočne zakázaný riadok, ale jeho vlastná obsluha dragover spracuje vizuál.
                        // Stále môžeme nastaviť dropEffect na 'none' tu, aby sa zabezpečilo, že na tejto úrovni nie je možné pustiť.
                        event.dataTransfer.dropEffect = 'none';
                    }
                    // Pre match-row a empty-interval-row, ich individuálna obsluha dragover to spracuje.
                    // Netreba tu pridávať 'drop-target-active' na rodiča.
                } else {
                    // Ak nie je nad konkrétnym riadkom (t.j. nad všeobecným pozadím dátumovej skupiny)
                    dateGroupDiv.classList.add('drop-target-active');
                    console.log(`Drag & Drop: dragover na date-group (pozadie) - Drop efekt: move, Cieľ:`, event.target);
                }
            });

            dateGroupDiv.addEventListener('dragleave', (event) => {
                // Toto musí byť opatrné, aby sa neodstránila trieda, ak sa len presúva z jedného riadku na druhý v rámci tej istej dátumovej skupiny
                // Lepší spôsob je odstrániť ju len vtedy, keď myš opustí celý dateGroupDiv
                // Zatiaľ to nechajme jednoduché a uistime sa, že sa odstráni pri pustení alebo úplnom opustení.
                const relatedTarget = event.relatedTarget;
                if (!relatedTarget || !dateGroupDiv.contains(relatedTarget)) {
                    dateGroupDiv.classList.remove('drop-target-active');
                    console.log(`Drag & Drop: dragleave z date-group (celý div), Cieľ:`, event.target);
                }
            });

            dateGroupDiv.addEventListener('drop', async (event) => {
                event.preventDefault();
                dateGroupDiv.classList.remove('drop-target-active'); // Odstráň aktívnu triedu pri pustení

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const newDate = dateGroupDiv.dataset.date;
                const newLocation = dateGroupDiv.dataset.location;
                let droppedProposedStartTime = null;

                const targetRow = event.target.closest('tr');

                if (targetRow && (targetRow.classList.contains('match-row') || targetRow.classList.contains('empty-interval-row') || targetRow.classList.contains('blocked-interval-row'))) {
                    // Ak sa pustí na konkrétny riadok, obsluha pustenia tohto riadku sa o to postará.
                    // Táto obsluha pustenia rodiča by nemala robiť nič.
                    console.log(`Drag & Drop: Udalosť pustenia na date-group, ale cieľ je konkrétny riadok. Delegujem na obsluhu riadku.`);
                    return;
                }

                // Pôvodná logika pre pustenie na všeobecné pozadie dátumovej skupiny (prvý dostupný čas)
                console.log(`Drag & Drop: drop na date-group (pozadie) - Presunutý zápas ID: ${draggedMatchId}, Nový dátum: ${newDate}, Nové miesto: ${newLocation}, Cieľ:`, event.target);

                if (draggedMatchId) {
                    const isUnassignedSection = (newLocation === 'Nezadaná hala');

                    if (isUnassignedSection) {
                        const draggedMatchData = (await getDoc(doc(matchesCollectionRef, draggedMatchId))).data();
                        droppedProposedStartTime = draggedMatchData.startTime;
                        console.log(`Drag & Drop: Pustené na nepriradenú sekciu. Používam pôvodný počiatočný čas zápasu: ${droppedProposedStartTime}`);
                    } else {
                        const initialScheduleStartMinutesForDrop = await getInitialScheduleStartMinutes(newDate, allSettings);
                        let currentPointerForDrop = initialScheduleStartMinutesForDrop;

                        const fixedEventsQuery = query(
                            matchesCollectionRef,
                            where("date", "==", newDate),
                            where("location", "==", newLocation)
                        );
                        const fixedEventsSnapshot = await getDocs(fixedEventsQuery);
                        const fixedEvents = fixedEventsSnapshot.docs.map(doc => {
                            const data = doc.data();
                            // Získaj trvanie a čas medzi zápasmi z nastavení kategórie, ak sú k dispozícii, inak použi vlastné dáta zápasu alebo predvolené
                            const categorySettings = allSettings.categoryMatchSettings?.[data.categoryId];
                            const duration = categorySettings?.duration || Number(data.duration) || 60;
                            const bufferTime = categorySettings?.bufferTime || Number(data.bufferTime) || 5;
                            const startInMinutes = parseTimeToMinutes(data.startTime);
                            return {
                                id: doc.id,
                                start: startInMinutes,
                                end: startInMinutes + duration + bufferTime,
                                type: 'match'
                            };
                        });

                        const blockedIntervalsQuery = query(
                            blockedSlotsCollectionRef,
                            where("date", "==", newDate),
                            where("location", "==", newLocation)
                        );
                        const blockedIntervalsSnapshot = await getDocs(blockedIntervalsQuery);
                        blockedIntervalsSnapshot.docs.forEach(doc => {
                            const data = doc.data();
                            if (data.isBlocked === true || data.originalMatchId) {
                                const startInMinutes = parseTimeToMinutes(data.startTime);
                                const endInMinutes = parseTimeToMinutes(data.endTime);
                                fixedEvents.push({ id: doc.id, start: startInMinutes, end: endInMinutes, type: 'blocked_interval' });
                            }
                        });

                        fixedEvents.sort((a, b) => a.start - b.start);

                        for (const event of fixedEvents) {
                            if (currentPointerForDrop < event.start) {
                                break;
                            }
                            currentPointerForDrop = Math.max(currentPointerForDrop, event.end);
                        }

                        droppedProposedStartTime = formatMinutesToTime(currentPointerForDrop);
                        console.log(`Drag & Drop: Pustené na pozadie dátumovej skupiny. Vypočítaný najskorší dostupný čas: ${droppedProposedStartTime}`);
                    }

                    console.log(`Drag & Drop: Pokúšam sa presunúť a preplánovať zápas ${draggedMatchId} na Dátum: ${newDate}, Miesto: ${newLocation}, Navrhovaný počiatočný čas: ${droppedProposedStartTime}.`);
                    await moveAndRescheduleMatch(draggedMatchId, newDate, newLocation, droppedProposedStartTime, allSettings);
                }
            });
        });

    } catch (error) {
        console.error("Chyba pri načítaní rozvrhu zápasov (zachytená chyba):", error);
        matchesContainer.innerHTML = `
            <div class="error-message">
                <h3>Chyba pri načítaní rozvrhu zápasov!</h3>
                <p>Prosím, skontrolujte konzolu prehliadača (F12 > Konzola) pre detaily.</p>
                <p>Možné príčiny:</p>
                <ul>
                    <li>Chýbajúce indexy vo Firestore. Skontrolujte záložku "Sieť" v konzole a Firebase Console.</li>
                    <li>Problém s pripojením k databáze alebo bezpečnostné pravidlá.</li>
                    <li>Žiadne dáta v kolekciách.</li>
                </ul>
                <p>Detail chyby: ${error.message}</p>
            </div>
        `;
        if (error.code === 'unavailable' || (error.message && error.message.includes('offline'))) {
             matchesContainer.innerHTML += '<p class="error-message">Zdá sa, že nie ste pripojení k internetu, alebo je problém s pripojením k Firebase.</p>';
        }
    }
}

/**
 * Vymaže hrací deň a všetky súvisiace zápasy a zablokované intervaly.
 * @param {string} dateToDelete Dátum hracieho dňa na vymazanie.
 */
async function deletePlayingDay(dateToDelete) {
    const confirmed = await showConfirmation(
        'Potvrdenie vymazania',
        `Naozaj chcete vymazať hrací deň ${dateToDelete} a VŠETKY zápasy, ktoré sa konajú v tento deň?`
    );

    if (confirmed) {
        try {
            const batch = writeBatch(db);

            const playingDayQuery = query(playingDaysCollectionRef, where("date", "==", dateToDelete));
            const playingDaySnapshot = await getDocs(playingDayQuery);
            if (!playingDaySnapshot.empty) {
                playingDaySnapshot.docs.forEach(docToDelete => {
                    batch.delete(doc(playingDaysCollectionRef, docToDelete.id));
                });
            }

            const matchesQuery = query(matchesCollectionRef, where("date", "==", dateToDelete));
            const matchesSnapshot = await getDocs(matchesQuery);
            matchesSnapshot.docs.forEach(matchDoc => {
                batch.delete(doc(matchesCollectionRef, matchDoc.id));
            });

            const blockedIntervalsQuery = query(blockedSlotsCollectionRef, where("date", "==", dateToDelete));
            const blockedIntervalsSnapshot = await getDocs(blockedSlotsCollectionRef); // Opravený tento riadok
            blockedIntervalsSnapshot.docs.forEach(blockedIntervalDoc => {
                batch.delete(doc(blockedSlotsCollectionRef, blockedIntervalDoc.id));
            });


            await batch.commit();
            await showMessage('Úspech', `Hrací deň ${dateToDelete} a všetky súvisiace zápasy/intervaly boli vymazané!`);
            closeModal(document.getElementById('playingDayModal'));
            // onSnapshot listener pre nastavenia spustí displayMatchesAsSchedule s najnovšími nastaveniami.
        } catch (error) {
            console.error("Chyba pri mazaní hracieho dňa:", error);
            await showMessage('Chyba', `Chyba pri mazaní hracieho dňa. Detail: ${error.message}`);
        }
    }
}

/**
 * Vymaže miesto a všetky súvisiace zápasy.
 * @param {string} placeNameToDelete Názov miesta na vymazanie.
 * @param {string} placeTypeToDelete Typ miesta na vymazanie.
 */
async function deletePlace(placeNameToDelete, placeTypeToDelete) {
    const confirmed = await showConfirmation(
        'Potvrdenie vymazania',
        `Naozaj chcete vymazať miesto ${placeNameToDelete} (${placeTypeToDelete}) a VŠETKY zápasy, ktoré sa viažu na toto miesto?`
    );

    if (confirmed) {
        try {
            const batch = writeBatch(db);

            const placeQuery = query(placesCollectionRef, where("name", "==", placeNameToDelete), where("type", "==", placeTypeToDelete));
            const placeSnapshot = await getDocs(placeQuery);
            if (!placeSnapshot.empty) {
                placeSnapshot.docs.forEach(docToDelete => {
                    batch.delete(doc(placesCollectionRef, docToDelete.id));
                });
            }

            const matchesQuery = query(matchesCollectionRef, where("location", "==", placeNameToDelete), where("locationType", "==", placeTypeToDelete));
            const matchesSnapshot = await getDocs(matchesQuery);
            matchesSnapshot.docs.forEach(matchDoc => {
                batch.delete(doc(matchesCollectionRef, matchDoc.id));
            });

            const blockedIntervalsQuery = query(blockedSlotsCollectionRef, where("location", "==", placeNameToDelete));
            const blockedIntervalsSnapshot = await getDocs(blockedSlotsCollectionRef); // Opravený tento riadok
            blockedIntervalsSnapshot.docs.forEach(blockedIntervalDoc => {
                batch.delete(doc(blockedSlotsCollectionRef, blockedIntervalDoc.id));
            });


            await batch.commit();
            await showMessage('Úspech', `Miesto ${placeNameToDelete} (${placeTypeToDelete}) a všetky súvisiace zápasy boli vymazané!`);
            closeModal(document.getElementById('placeModal'));
            // onSnapshot listener pre nastavenia spustí displayMatchesAsSchedule s najnovšími nastaveniami.
        } catch (error) {
                console.error("Chyba pri mazaní miesta:", error);
                await showMessage('Chyba', `Chyba pri mazaní miesta ${placeNameToDelete} (${placeTypeToDelete}). Detail: ${error.message}`);
        }
    }
}

/**
 * Otvorí modálne okno hracieho dňa pre úpravu existujúceho hracieho dňa.
 * @param {string} dateToEdit Dátum hracieho dňa na úpravu.
 */
async function editPlayingDay(dateToEdit) {
    const playingDayModal = document.getElementById('playingDayModal');
    const playingDayIdInput = document.getElementById('playingDayId');
    const playingDayDateInput = document.getElementById('playingDayDate');
    const playingDayModalTitle = document.getElementById('playingDayModalTitle');
    const deletePlayingDayButtonModal = document.getElementById('deletePlayingDayButtonModal');

    try {
        const q = query(playingDaysCollectionRef, where("date", "==", dateToEdit));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const playingDayDoc = querySnapshot.docs[0];
            const playingDayData = playingDayDoc.data();
            const playingDayId = playingDayDoc.id;

            playingDayIdInput.value = playingDayId;
            playingDayDateInput.value = playingDayData.date || '';
            playingDayModalTitle.textContent = 'Upraviť hrací deň';
            deletePlayingDayButtonModal.style.display = 'inline-block';
            if (deletePlayingDayButtonModal && deletePlayingDayButtonModal._currentHandler) {
                deletePlayingDayButtonModal.removeEventListener('click', deletePlayingDayButtonModal._currentHandler); 
                delete deletePlayingDayButtonModal._currentHandler;
            }
            const handler = () => deletePlayingDay(playingDayData.date);
            deletePlayingDayButtonModal.addEventListener('click', handler);
            deletePlayingDayButtonModal._currentHandler = handler;
            openModal(playingDayModal);
        } else {
            await showMessage('Informácia', "Hrací deň sa nenašiel.");
        }
    } catch (error) {
        console.error("Chyba pri načítavaní dát hracieho dňa:", error);
        await showMessage('Chyba', "Vyskytla sa chyba pri načítavaní dát hracieho dňa. Skúste to znova.");
    }
}

/**
 * Otvorí modálne okno miesta pre úpravu existujúceho miesta.
 * @param {string} placeName Názov miesta na úpravu.
 * @param {string} placeType Typ miesta na úpravu.
 */
async function editPlace(placeName, placeType) {
    const placeModal = document.getElementById('placeModal');
    const placeIdInput = document.getElementById('placeId');
    const placeTypeSelect = document.getElementById('placeTypeSelect');
    const placeNameInput = document.getElementById('placeName');
    const placeAddressInput = document.getElementById('placeAddress');
    const placeGoogleMapsUrlInput = document.getElementById('placeGoogleMapsUrl');
    const deletePlaceButtonModal = document.getElementById('deletePlaceButtonModal');
    const placeModalTitle = document.getElementById('placeModalTitle'); // Získaj element názvu

    try {
        const q = query(placesCollectionRef, where("name", "==", placeName), where("type", "==", placeType));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const placeDoc = querySnapshot.docs[0];
            const placeData = placeDoc.data();
            const placeId = placeDoc.id;

            placeIdInput.value = placeId;
            placeTypeSelect.value = placeData.type || '';
            placeNameInput.value = placeData.name || '';
            placeAddressInput.value = placeData.address || '';
            placeGoogleMapsUrlInput.value = placeData.googleMapsUrl || '';

            placeModalTitle.textContent = 'Upraviť miesto'; // Nastav názov tu

            deletePlaceButtonModal.style.display = 'inline-block';
            if (deletePlaceButtonModal && deletePlaceButtonModal._currentHandler) {
                deletePlaceButtonModal.removeEventListener('click', deletePlaceButtonModal._currentHandler);
                delete deletePlaceButtonModal._currentHandler;
            }
            const handler = () => deletePlace(placeData.name, placeData.type);
            deletePlaceButtonModal.addEventListener('click', handler);
            deletePlaceButtonModal._currentHandler = handler;
            openModal(placeModal);
        } else {
            await showMessage('Informácia', "Miesto sa nenašlo.");
        }
    }
    catch (error) {
        console.error("Chyba pri načítavaní dát miesta:", error);
        await showMessage('Chyba', "Vyskytla sa chyba pri načítavaní dát miesta. Skúste to znova.");
    }
}

/**
 * Otvorí modálne okno zápasu pre pridanie nového zápasu alebo úpravu existujúceho.
 * @param {string|null} matchId ID zápasu na úpravu, alebo null pre nový zápas.
 * @param {object} currentAllSettings Aktuálny objekt allSettings.
 * @param {string} prefillDate Dátum na predvyplnenie výberu dátumu.
 * @param {string} prefillLocation Miesto na predvyplnenie výberu miesta.
 * @param {string} prefillStartTime Počiatočný čas na predvyplnenie vstupu počiatočného času.
 */
async function openMatchModal(matchId = null, currentAllSettings, prefillDate = '', prefillLocation = '', prefillStartTime = '') {
    const matchModal = document.getElementById('matchModal');
    const matchIdInput = document.getElementById('matchId');
    const matchModalTitle = document.getElementById('matchModalTitle');
    const matchDateSelect = document.getElementById('matchDateSelect');
    const matchLocationSelect = document.getElementById('matchLocationSelect'); 
    const matchStartTimeInput = document.getElementById('matchStartTime');
    const matchDurationInput = document.getElementById('matchDuration');
    const matchBufferTimeInput = document.getElementById('matchBufferTime');
    const matchCategorySelect = document.getElementById('matchCategory');
    const matchGroupSelect = document.getElementById('matchGroup');
    const team1NumberInput = document.getElementById('team1NumberInput');
    const team2NumberInput = document.getElementById('team2NumberInput'); 
    const deleteMatchButtonModal = document.getElementById('deleteMatchButtonModal');
    const matchForm = document.getElementById('matchForm');

    const allSettings = currentAllSettings;

    if (deleteMatchButtonModal && deleteMatchButtonModal._currentHandler) {
        deleteMatchButtonModal.removeEventListener('click', deleteMatchButtonModal._currentHandler);
        delete deleteMatchButtonModal._currentHandler;
    }

    matchForm.reset();
    matchIdInput.value = matchId || '';
    deleteMatchButtonModal.style.display = matchId ? 'inline-block' : 'none';
    
    if (matchId) {
        const handler = () => deleteMatch(matchId, allSettings);
        deleteMatchButtonModal.addEventListener('click', handler);
        deleteMatchButtonModal._currentHandler = handler;
    } else {
        deleteMatchButtonModal._currentHandler = null; 
    }

    // Naplní výber kategórie najprv
    await populateCategorySelect(matchCategorySelect);

    if (matchId) {
        matchModalTitle.textContent = 'Upraviť zápas';
        const matchDocRef = doc(matchesCollectionRef, matchId);
        const matchDoc = await getDoc(matchDocRef);
        if (!matchDoc.exists()) {
            await showMessage('Informácia', "Zápas sa nenašiel.");
            return;
        }
        const matchData = matchDoc.data();
        await populatePlayingDaysSelect(matchDateSelect, matchData.date);
        if (!matchData.location || matchData.locationType !== 'Športová hala') {
            await populateSportHallSelects(matchLocationSelect, '');
        } else {
            await populateSportHallSelects(matchLocationSelect, matchData.location);
        }
        matchStartTimeInput.value = matchData.startTime || '';
        
        // Uisti sa, že je vybraná správna kategória v rozbaľovacom zozname PRED získaním nastavení
        matchCategorySelect.value = matchData.categoryId;
        const categorySettings = getCategoryMatchSettings(matchData.categoryId, allSettings);
        matchDurationInput.value = categorySettings.duration;
        matchBufferTimeInput.value = categorySettings.bufferTime;

        if (matchData.categoryId) {
            await populateGroupSelect(matchData.categoryId, matchGroupSelect, matchData.groupId);
            matchGroupSelect.disabled = false;
        } else {
            matchGroupSelect.innerHTML = '<option value="">-- Vyberte skupinu --</option>';
            matchGroupSelect.disabled = true;
        }

        if (matchGroupSelect.value) {
            team1NumberInput.disabled = false;
            team2NumberInput.disabled = false;
        } else {
            team1NumberInput.disabled = true;
            team2NumberInput.disabled = true;
        }

        team1NumberInput.value = matchData.team1Number || '';
        team2NumberInput.value = matchData.team2Number || '';

        if (prefillDate && prefillLocation) {
            await populatePlayingDaysSelect(matchDateSelect, prefillDate);
            await populateSportHallSelects(matchLocationSelect, prefillLocation);
            matchStartTimeInput.value = prefillStartTime;
        }

    } else { // Pridávanie nového zápasu
        matchModalTitle.textContent = 'Pridať nový zápas';
        
        // Získaj ID prvej kategórie, ak existuje, aby sa nastavili predvolené hodnoty
        const firstCategoryOption = matchCategorySelect.querySelector('option:not([value=""])');
        if (firstCategoryOption) {
            matchCategorySelect.value = firstCategoryOption.value;
        }

        // Teraz, keď je vybraná kategória, aktualizuj trvanie/buffer
        await updateMatchDurationAndBuffer(allSettings); 

        await populatePlayingDaysSelect(matchDateSelect, prefillDate); 
        await populateSportHallSelects(matchLocationSelect, prefillLocation);
        
        if (matchGroupSelect) {
            matchGroupSelect.innerHTML = '<option value="">-- Vyberte skupinu --</option>';
            matchGroupSelect.disabled = true;
        }
        
        team1NumberInput.value = '';
        team1NumberInput.disabled = true;
        team2NumberInput.value = '';
        team2NumberInput.disabled = true;
        
        await findFirstAvailableTime(allSettings);
    }
    openModal(matchModal);
}

/**
 * Otvorí modálne okno voľného intervalu na správu voľného alebo zablokovaného časového slotu.
 * @param {string} date Dátum intervalu.
 * @param {string} location Miesto intervalu.
 * @param {string} startTime Počiatočný čas intervalu.
 * @param {string} endTime Koncový čas intervalu.
 * @param {string} blockedIntervalId ID dokumentu zablokovaného intervalu alebo generované ID pre nové zástupné symboly.
 * @param {object} allSettings Všetky nastavenia turnaja, vrátane nastavení zápasov kategórií.
 */
async function openFreeIntervalModal(date, location, startTime, endTime, blockedIntervalId, allSettings) {
    console.log(`openFreeIntervalModal: Volané pre Dátum: ${date}, Miesto: ${location}, Čas: ${startTime}-${endTime}, ID intervalu: ${blockedIntervalId}`);

    const freeIntervalModal = document.getElementById('freeSlotModal');
    const freeIntervalModalTitle = document.getElementById('freeSlotModalTitle');
    const freeIntervalDateDisplay = document.getElementById('freeSlotDateDisplay');
    const freeIntervalLocationDisplay = document.getElementById('freeSlotLocationDisplay');
    const freeIntervalTimeRangeDisplay = document.getElementById('freeSlotTimeRangeDisplay');
    const freeIntervalIdInput = document.getElementById('freeSlotId');
    
    const addMatchButton = document.getElementById('addMatchFromFreeSlotButton');
    const blockButton = document.getElementById('blockFreeSlotButton'); 
    const unblockButton = document.getElementById('unblockFreeSlotButton'); 
    const deleteButton = document.getElementById('phantomSlotDeleteButton'); 

    // Odstráň existujúce poslucháče udalostí, aby sa predišlo duplikátom
    if (addMatchButton && addMatchButton._currentHandler) {
        addMatchButton.removeEventListener('click', addMatchButton._currentHandler);
        delete addMatchButton._currentHandler;
        console.log("openFreeIntervalModal: Odstránený starý poslucháč pre 'addMatchFromFreeSlotButton'.");
    }
    if (blockButton && blockButton._currentHandler) {
        blockButton.removeEventListener('click', blockButton._currentHandler);
        delete blockButton._currentHandler;
        console.log("openFreeIntervalModal: Odstránený starý poslucháč pre 'blockButton'.");
    }
    if (unblockButton && unblockButton._currentHandler) {
        unblockButton.removeEventListener('click', unblockButton._currentHandler);
        delete unblockButton._currentHandler;
        console.log("openFreeIntervalModal: Odstránený starý poslucháč pre 'unblockButton'.");
    }
    if (deleteButton && deleteButton._currentHandler) { 
        deleteButton.removeEventListener('click', deleteButton._currentHandler);
        delete deleteButton._currentHandler;
        console.log("openFreeIntervalModal: Odstránený starý poslucháč pre 'deleteButton'.");
    }


    freeIntervalIdInput.value = blockedIntervalId; 
    
    const dateObj = new Date(date);
    const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}. ${String(dateObj.getMonth() + 1).padStart(2, '0')}. ${dateObj.getFullYear()}`;

    freeIntervalDateDisplay.textContent = formattedDate;
    freeIntervalLocationDisplay.textContent = location;
    freeIntervalTimeRangeDisplay.textContent = `${startTime} - ${endTime}`;

    // Skry všetky tlačidlá predvolene
    if (addMatchButton) addMatchButton.style.display = 'none';
    if (blockButton) blockButton.style.display = 'none';
    if (unblockButton) {
        unblockButton.style.display = 'none';
        unblockButton.classList.remove('delete-button'); 
    }
    if (deleteButton) { 
        deleteButton.style.display = 'none';
        deleteButton.classList.remove('delete-button');
    }

    let isUserBlockedFromDB = false;
    let originalMatchId = null;

    if (blockedIntervalId && !blockedIntervalId.startsWith('generated-interval-') && !blockedIntervalId.startsWith('generated-initial-interval-') && !blockedIntervalId.startsWith('generated-final-interval-')) {
        try {
            const blockedIntervalDoc = await getDoc(doc(blockedSlotsCollectionRef, blockedIntervalId));
            if (blockedIntervalDoc.exists()) {
                const data = blockedIntervalDoc.data();
                isUserBlockedFromDB = data.isBlocked === true;
                originalMatchId = data.originalMatchId || null;
                console.log(`openFreeIntervalModal: Načítané dáta pre blockedIntervalId=${blockedIntervalId}: isBlocked=${isUserBlockedFromDB}, originalMatchId=${originalMatchId}`);
            } else {
                console.warn(`openFreeIntervalModal: Dokument blockedIntervalId=${blockedIntervalId} neexistuje (možno už bol odstránený?). Považujem ho za zástupný symbol.`);
                isUserBlockedFromDB = false;
            }
        } catch (error) {
            console.error(`openFreeIntervalModal: Chyba pri načítaní dokumentu pre blockedIntervalId=${blockedIntervalId}:`, error);
            isUserBlockedFromDB = false;
        }
    } else {
        isUserBlockedFromDB = false;
        console.log(`openFreeIntervalModal: Zistené generované ID intervalu (${blockedIntervalId}). Považujem ho za zástupný symbol.`);
    }

    if (isUserBlockedFromDB) { // Existujúci zablokovaný interval používateľom
        freeIntervalModalTitle.textContent = 'Upraviť zablokovaný interval';
        console.log("openFreeIntervalModal: Typ intervalu: Normálny zablokovaný interval (používateľom zablokovaný).");
        
        // Zobraz možnosti odblokovania a vymazania
        if (unblockButton) {
            unblockButton.style.display = 'inline-block';
            unblockButton.textContent = 'Odblokovať';
            unblockButton.classList.remove('delete-button'); 
            const unblockHandler = () => {
                console.log(`openFreeIntervalModal: Kliknuté 'Odblokovať' pre zablokovaný interval ID: ${blockedIntervalId}. Volám unblockBlockedInterval.`);
                unblockBlockedInterval(blockedIntervalId, date, location, allSettings); // Odovzdaj allSettings
            };
            unblockButton.addEventListener('click', unblockHandler);
            unblockButton._currentHandler = unblockHandler;
            console.log("openFreeIntervalModal: Poslucháč pridaný a tlačidlo 'Odblokovať' zobrazené.");
        }
        if (deleteButton) { 
            deleteButton.style.display = 'inline-block';
            deleteButton.textContent = 'Vymazať interval';
            deleteButton.classList.add('delete-button');
            const deleteHandler = () => {
                console.log(`openFreeIntervalModal: Kliknuté 'Vymazať interval' pre zablokovaný interval ID: ${blockedIntervalId}. Volám handleDeleteInterval.`);
                handleDeleteInterval(blockedIntervalId, date, location, allSettings); // Odovzdaj allSettings
            };
            deleteButton.addEventListener('click', deleteHandler); 
            deleteButton._currentHandler = deleteHandler; 
            console.log("openFreeIntervalModal: Poslucháč pridaný a tlačidlo 'Vymazať interval' zobrazené.");
        }

    } else if (originalMatchId) { // Toto je voľný interval vytvorený vymazaným zápasom
        freeIntervalModalTitle.textContent = 'Voľný interval po vymazanom zápase';
        console.log("openFreeIntervalModal: Typ intervalu: Voľný interval z vymazaného zápasu.");

        // Zobraz možnosti pridania zápasu, zablokovania a VYMAZANIA pre tieto špecifické zástupné symboly
        if (addMatchButton) {
            addMatchButton.style.display = 'inline-block';
            const addMatchHandler = () => {
                console.log(`openFreeIntervalModal: Kliknuté 'Pridať zápas' pre voľný interval. Volám openMatchModal.`);
                closeModal(freeIntervalModal);
                openMatchModal(null, allSettings, date, location, startTime); // Odovzdaj allSettings
            };
            addMatchButton.addEventListener('click', addMatchHandler);
            addMatchButton._currentHandler = addMatchHandler;
            console.log("openFreeIntervalModal: Poslucháč pridaný a tlačidlo 'Pridať zápas' zobrazené.");
        }
        if (blockButton) {
            blockButton.style.display = 'inline-block';
            blockButton.textContent = 'Zablokovať';
            const blockHandler = () => {
                console.log(`openFreeIntervalModal: Kliknuté 'Zablokovať' pre voľný interval z vymazaného zápasu ID: ${blockedIntervalId}. Volám blockFreeInterval.`);
                blockFreeInterval(blockedIntervalId, date, location, startTime, endTime, allSettings); // Odovzdaj allSettings
            };
            blockButton.addEventListener('click', blockHandler);
            blockButton._currentHandler = blockHandler;
            console.log("openFreeIntervalModal: Poslucháč pridaný a tlačidlo 'Zablokovať' zobrazené.");
        }
        if (deleteButton) { // Povoľ vymazanie voľných intervalov, ktoré pochádzajú z vymazaných zápasov
            deleteButton.style.display = 'inline-block';
            deleteButton.textContent = 'Vymazať interval';
            deleteButton.classList.add('delete-button'); // Pridaj štýlovanie tlačidla vymazania
            const deleteHandler = () => {
                console.log(`openFreeIntervalModal: Kliknuté 'Vymazať interval' pre voľný interval z vymazaného zápasu ID: ${blockedIntervalId}. Volám handleDeleteInterval.`);
                handleDeleteInterval(blockedIntervalId, date, location, allSettings); // Odovzdaj allSettings
            };
            deleteButton.addEventListener('click', deleteHandler); 
            deleteButton._currentHandler = deleteHandler; 
            console.log("openFreeIntervalModal: Poslucháč pridaný a tlačidlo 'Vymazať interval' zobrazené pre voľný interval z vymazaného zápasu.");
        }

    } else { // Automaticky generovaný prázdny interval (všeobecná medzera)
        const [endH, endM] = endTime.split(':').map(Number);
        if (endH === 24 && endM === 0) { // Ak ide o úplne posledný interval dňa
            console.log("openFreeIntervalModal: Interval končí o 24:00. Toto je zvyčajne koncový zástupný symbol, žiadne špecifické akcie.");
            freeIntervalModalTitle.textContent = 'Voľný interval do konca dňa';
            // Žiadne tlačidlá pre úplne posledný koncový zástupný symbol
            if (addMatchButton) { addMatchButton.style.display = 'inline-block'; } // Stále povoľ pridanie zápasu
            const addMatchHandler = () => {
                console.log(`openFreeIntervalModal: Kliknuté 'Pridať zápas' pre voľný interval. Volám openMatchModal.`);
                closeModal(freeIntervalModal);
                openMatchModal(null, allSettings, date, location, startTime); // Odovzdaj allSettings
            };
            addMatchButton.addEventListener('click', addMatchHandler);
            addMatchButton._currentHandler = addMatchHandler;
        } else {
            freeIntervalModalTitle.textContent = 'Spravovať voľný interval';
            console.log("openFreeIntervalModal: Typ intervalu: Automaticky generovaný prázdny interval.");
            
            // Zobraz možnosti pridania zápasu a zablokovania
            if (addMatchButton) {
                addMatchButton.style.display = 'inline-block';
                const addMatchHandler = () => {
                    console.log(`openFreeIntervalModal: Kliknuté 'Pridať zápas' pre voľný interval. Volám openMatchModal.`);
                    closeModal(freeIntervalModal);
                    openMatchModal(null, allSettings, date, location, startTime); // Odovzdaj allSettings
                };
                addMatchButton.addEventListener('click', addMatchHandler);
                addMatchButton._currentHandler = addMatchHandler;
                console.log("openFreeIntervalModal: Poslucháč pridaný a tlačidlo 'Pridať zápas' zobrazené.");
            }
            if (blockButton) {
                blockButton.style.display = 'inline-block';
                blockButton.textContent = 'Zablokovať';
                const blockHandler = () => {
                    console.log(`openFreeIntervalModal: Kliknuté 'Zablokovať' pre automaticky generovaný voľný interval ID: ${blockedIntervalId}. Volám blockFreeInterval.`);
                    blockFreeInterval(blockedIntervalId, date, location, startTime, endTime, allSettings); // Odovzdaj allSettings
                };
                blockButton.addEventListener('click', blockHandler);
                blockButton._currentHandler = blockHandler;
                console.log("openFreeIntervalModal: Poslucháč pridaný a tlačidlo 'Zablokovať' zobrazené pre automaticky generovaný interval.");
            }
            if (deleteButton) { // Povoľ vymazanie všeobecných automaticky generovaných voľných intervalov
                deleteButton.style.display = 'inline-block';
                deleteButton.textContent = 'Vymazať interval';
                deleteButton.classList.add('delete-button');
                const deleteHandler = () => {
                    console.log(`openFreeIntervalModal: Kliknuté 'Vymazať interval' pre automaticky generovaný voľný interval ID: ${blockedIntervalId}. Volám handleDeleteInterval.`);
                    handleDeleteInterval(blockedIntervalId, date, location, allSettings); // Odovzdaj allSettings
                };
                deleteButton.addEventListener('click', deleteHandler); 
                deleteButton._currentHandler = deleteHandler; 
                console.log("openFreeIntervalModal: Poslucháč pridaný a tlačidlo 'Vymazať interval' zobrazené pre automaticky generovaný interval.");
            }
        }
    }

    openModal(freeIntervalModal);
    console.log("openFreeIntervalModal: Modálne okno otvorené.");
}


/**
 * Zablokuje voľný interval, čím ho zneprístupní pre zápasy.
 * @param {string} intervalId ID intervalu na zablokovanie.
 * @param {string} date Dátum intervalu.
 * @param {string} location Miesto intervalu.
 * @param {string} startTime Počiatočný čas intervalu.
 * @param {string} endTime Koncový čas intervalu.
 * @param {object} allSettings Všetky nastavenia turnaja, vrátane nastavení zápasov kategórií.
 */
async function blockFreeInterval(intervalId, date, location, startTime, endTime, allSettings) {
    console.log(`blockFreeInterval: === FUNKCIA ZABLOKOVANIA VOĽNÉHO INTERVALU SPUSTENÁ ===`);
    console.log(`blockFreeInterval: ID intervalu: ${intervalId}, Dátum: ${date}, Miesto: ${location}, Začiatok: ${startTime}, Koniec: ${endTime}`);
    const freeIntervalModal = document.getElementById('freeSlotModal'); 
    const confirmed = await showConfirmation('Potvrdenie', 'Naozaj chcete zablokovať tento voľný interval?');
    console.log(`blockFreeInterval: Potvrdenie prijaté: ${confirmed}`);

    if (confirmed) {
        try {
            // Skontroluj prekrývanie s existujúcimi zápasmi pred zablokovaním
            const startInMinutes = parseTimeToMinutes(startTime);
            const endInMinutes = parseTimeToMinutes(endTime);

            // Načítaj všetky zápasy pre vybraný dátum a miesto
            const matchesQuery = query(matchesCollectionRef, where("date", "==", date), where("location", "==", location));
            const matchesSnapshot = await getDocs(matchesQuery);
            
            // Vykonaj kontrolu prekrývania v JavaScripte
            const overlappingMatch = matchesSnapshot.docs.find(matchDoc => {
                const matchData = matchDoc.data();
                // Získaj trvanie a čas medzi zápasmi z nastavení kategórie, ak sú k dispozícii, inak použi vlastné dáta zápasu alebo predvolené
                const categorySettings = allSettings.categoryMatchSettings?.[matchData.categoryId];
                const matchDuration = categorySettings?.duration || Number(matchData.duration) || 0;
                const matchBufferTime = categorySettings?.bufferTime || Number(matchData.bufferTime) || 0;

                const matchStartInMinutes = parseTimeToMinutes(matchData.startTime);
                const matchFootprintEndInMinutes = matchStartInMinutes + matchDuration + matchBufferTime; 
                
                // Skontroluj prekrývanie: interval začína pred koncom zápasu A interval končí po začiatku zápasu
                return (startInMinutes < matchFootprintEndInMinutes && endInMinutes > matchStartInMinutes);
            });

            if (overlappingMatch) {
                const formatTime = (minutes) => {
                    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
                    const m = String(minutes % 60).padStart(2, '0');
                    return `${h}:${m}`;
                };
                const matchStartTime = overlappingMatch.data().startTime;
                // Získaj trvanie a čas medzi zápasmi z nastavení kategórie pre prekrývajúci sa zápas
                const overlappingMatchCategorySettings = allSettings.categoryMatchSettings?.[overlappingMatch.data().categoryId];
                const overlappingMatchDuration = overlappingMatchCategorySettings?.duration || Number(overlappingMatch.data().duration) || 0;
                const overlappingMatchBufferTime = overlappingMatchCategorySettings?.bufferTime || Number(overlappingMatch.data().bufferTime) || 0;

                const matchFootprintEndInMinutes = parseTimeToMinutes(matchStartTime) + overlappingMatchDuration + overlappingMatchBufferTime;
                const formattedMatchEndTime = formatTime(matchFootprintEndInMinutes);

                await showMessage('Chyba', `Interval nemôže byť zablokovaný, pretože sa prekrýva s existujúcim zápasom od ${matchStartTime} do ${formattedMatchEndTime}. Prosím, najprv presuňte alebo vymažte tento zápas.`);
                return;
            }

            const isNewPlaceholderOrGenerated = intervalId.startsWith('generated-interval-') || intervalId.startsWith('generated-initial-interval-') || intervalId.startsWith('generated-final-interval-');
            let intervalDataToSave = {
                date: date,
                location: location,
                startTime: startTime,
                endTime: endTime,
                isBlocked: true,
                startInMinutes: startInMinutes,
                endInMinutes: endInMinutes,
                createdAt: new Date()
            };

            if (isNewPlaceholderOrGenerated) {
                console.log(`blockFreeInterval: Pridávam nový zablokovaný interval z generovaného zástupného symbolu:`, intervalDataToSave);
                await addDoc(blockedSlotsCollectionRef, intervalDataToSave);
            } else {
                const intervalRef = doc(blockedSlotsCollectionRef, intervalId);
                console.log(`blockFreeInterval: Aktualizujem existujúci interval ID: ${intervalId} na isBlocked: true`);
                // Pri blokovaní existujúceho zástupného symbolu odstráň originalMatchId, ak existuje
                if (intervalDataToSave.originalMatchId) {
                    intervalDataToSave.originalMatchId = deleteField();
                }
                await setDoc(intervalRef, intervalDataToSave, { merge: true });
            }
            
            await showMessage('Úspech', 'Interval bol úspešne zablokovaný!');
            closeModal(freeIntervalModal);
            console.log("blockFreeInterval: Modálne okno zatvorené.");
            await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, allSettings); // Odovzdaj allSettings
            console.log("blockFreeInterval: Prepočet rozvrhu dokončený.");
        } catch (error) {
            console.error("Chyba pri blokovaní intervalu:", error);
            await showMessage('Chyba', `Chyba pri blokovaní intervalu: ${error.message}`);
        }
    }
}

/**
 * Odblokuje predtým zablokovaný interval, čím ho sprístupní pre zápasy.
 * @param {string} intervalId ID intervalu na odblokovanie.
 * @param {string} date Dátum intervalu.
 * @param {string} location Miesto intervalu.
 * @param {object} allSettings Všetky nastavenia turnaja, vrátane nastavení zápasov kategórií.
 */
async function unblockBlockedInterval(intervalId, date, location, allSettings) {
    console.log(`unblockBlockedInterval: === FUNKCIA ODBLOKOVANIA INTERVALU SPUSTENÁ ===`);
    console.log(`unblockBlockedInterval: Interval ID: ${intervalId}, Dátum: ${date}, Miesto: ${location}`);
    const freeIntervalModal = document.getElementById('freeSlotModal'); 
    const confirmed = await showConfirmation('Potvrdenie', 'Naozaj chcete odblokovať tento interval? Zápasy môžu byť teraz naplánované počas tohto času.');
    if (confirmed) {
        try {
            const intervalRef = doc(blockedSlotsCollectionRef, intervalId);
            console.log(`unblockBlockedInterval: Pokúšam sa aktualizovať interval ID: ${intervalId} na isBlocked: false`);
            await setDoc(intervalRef, { isBlocked: false, originalMatchId: deleteField() }, { merge: true });
            console.log(`unblockBlockedInterval: Interval ID: ${intervalId} úspešne odblokovaný.`);
            await showMessage('Úspech', 'Interval bol úspešne odblokovaný!');
            closeModal(freeIntervalModal);
            await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, allSettings); // Odovzdaj allSettings
            console.log("unblockBlockedInterval: Zobrazenie rozvrhu obnovené a prepočítané.");
        }
        catch (error) {
            console.error("Chyba pri odblokovaní intervalu:", error);
            await showMessage('Chyba', `Chyba pri odblokovaní intervalu: ${error.message}`);
        }
    }
}

/**
 * Spracuje vymazanie časového intervalu (buď zablokovaného intervalu alebo zástupného symbolu).
 * Táto funkcia sa používa pri explicitnom vymazaní *používateľom vytvoreného zablokovaného intervalu* alebo *automaticky generovaného voľného intervalu*.
 * Toto by sa NEMALO používať pre voľné intervaly, ktoré boli vytvorené vymazaným zápasom (tie sú spravované automaticky).
 * @param {string} intervalId ID intervalu na vymazanie.
 * @param {string} date Dátum intervalu.
 * @param {string} location Miesto intervalu.
 * @param {object} allSettings Všetky nastavenia turnaja, vrátane nastavení zápasov kategórií.
 */
async function handleDeleteInterval(intervalId, date, location, allSettings) {
    console.log(`handleDeleteInterval: === FUNKCIA SPRACOVANIA VYMAZANIA INTERVALU SPUSTENÁ ===`);
    console.log(`handleDeleteInterval: ID intervalu: ${intervalId}, Dátum: ${date}, Miesto: ${location}`);
    const freeIntervalModal = document.getElementById('freeSlotModal');

    const confirmed = await showConfirmation('Potvrdenie vymazania', 'Naozaj chcete vymazať tento interval?');
    if (!confirmed) {
        console.log(`handleDeleteInterval: Vymazanie zrušené používateľom.`);
        return;
    }

    try {
        const intervalDocRef = doc(blockedSlotsCollectionRef, intervalId);
        const batch = writeBatch(db); 
        console.log(`handleDeleteInterval: Pokúšam sa vymazať dokument blockedInterval ID: ${intervalId}`);
        batch.delete(intervalDocRef);
        await batch.commit();
        console.log("handleDeleteInterval: Batch commit úspešný.");
        
        await showMessage('Úspech', 'Interval bol úspešne vymazaný z databázy!');
        closeModal(freeIntervalModal);
        
        // Po vymazaní spustite prepočet bez špeciálnych príznakov.
        // To umožní systému znova vytvoriť 'všeobecný' voľný interval, ak sa objaví medzera.
        await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, allSettings); // Odovzdaj allSettings
        console.log("handleDeleteInterval: Prepočet rozvrhu dokončený po vymazaní používateľom definovaného zablokovaného intervalu alebo automaticky generovaného voľného intervalu.");

    } catch (error) {
        console.error("handleDeleteInterval: Chyba pri vymazávaní intervalu:", error);
        await showMessage('Chyba', `Chyba pri vymazávaní intervalu: ${error.message}`);
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    const loggedInUsername = localStorage.getItem('username');
    if (!loggedInUsername || loggedInUsername !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    const categoriesContentSection = document.getElementById('categoriesContentSection');
    const addButton = document.getElementById('addButton');
    const addOptions = document.getElementById('addOptions');
    const addPlayingDayButton = document.getElementById('addPlayingDayButton');
    const addPlaceButton = document.getElementById('addPlaceButton');
    const addMatchButton = document.getElementById('addMatchButton');

    const matchModal = document.getElementById('matchModal');
    const closeMatchModalButton = document.getElementById('closeMatchModal');
    const matchForm = document.getElementById('matchForm');
    const matchIdInput = document.getElementById('matchId');
    const matchModalTitle = document.getElementById('matchModalTitle');
    const matchDateSelect = document.getElementById('matchDateSelect');
    const matchLocationSelect = document.getElementById('matchLocationSelect'); 
    const matchStartTimeInput = document.getElementById('matchStartTime');
    const matchDurationInput = document.getElementById('matchDuration');
    const matchBufferTimeInput = document.getElementById('matchBufferTime');
    const matchCategorySelect = document.getElementById('matchCategory');
    const matchGroupSelect = document.getElementById('matchGroup');
    const team1NumberInput = document.getElementById('team1NumberInput');
    const team2NumberInput = document.getElementById('team2NumberInput');
    const deleteMatchButtonModal = document.getElementById('deleteMatchButtonModal');


    const playingDayModal = document.getElementById('playingDayModal');
    const closePlayingDayModalButton = document.getElementById('closePlayingDayModal');
    const playingDayForm = document.getElementById('playingDayForm');
    const playingDayIdInput = document.getElementById('playingDayId');
    const playingDayDateInput = document.getElementById('playingDayDate');
    const playingDayModalTitle = document.getElementById('playingDayModalTitle');
    const deletePlayingDayButtonModal = document.getElementById('deletePlayingDayButtonModal');

    const placeModal = document.getElementById('placeModal');
    const closePlaceModalButton = document.getElementById('closePlaceModal');
    const placeForm = document.getElementById('placeForm'); 
    const placeIdInput = document.getElementById('placeId');
    const placeTypeSelect = document.getElementById('placeTypeSelect');
    const placeNameInput = document.getElementById('placeName');
    const placeAddressInput = document.getElementById('placeAddress');
    const googleMapsUrlInput = document.getElementById('placeGoogleMapsUrl');
    const deletePlaceButtonModal = document.getElementById('deletePlaceButtonModal');

    const freeIntervalModal = document.getElementById('freeSlotModal');
    const closeFreeIntervalModalButton = document.getElementById('closeFreeSlotModal');

    // Inicializuj allSettings ako prázdny objekt
    let allSettings = {};

    // Nastav poslucháč na zmeny nastavení v reálnom čase
    const settingsDocRef = doc(settingsCollectionRef, SETTINGS_DOC_ID);
    onSnapshot(settingsDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            allSettings = docSnapshot.data();
            console.log("Nastavenia aktualizované v reálnom čase:", allSettings);
        } else {
            allSettings = {}; // Resetuj, ak dokument nastavení neexistuje
            console.log("Dokument nastavení neexistuje.");
        }
        // Znova zobraz rozvrh pri každej zmene nastavení
        displayMatchesAsSchedule(allSettings);
    }, (error) => {
        console.error("Chyba pri počúvaní zmien nastavení:", error);
        showMessage('Chyba', `Chyba pri načítaní nastavení: ${error.message}`);
    });


    if (categoriesContentSection) {
        categoriesContentSection.style.display = 'block';
        const otherSections = document.querySelectorAll('main > section, main > div');
        otherSections.forEach(section => {
            if (section.id !== 'categoriesContentSection') {
                section.style.display = 'none';
            }
        });
    }

    // Počiatočné zobrazenie zápasov (bude aktualizované onSnapshot)
    // await displayMatchesAsSchedule(allSettings); // Toto počiatočné volanie môže byť redundantné, ak sa onSnapshot spustí okamžite


    if (!document.getElementById('add-options-show-style')) {
        const style = document.createElement('style');
        style.id = 'add-options-show-style';
        style.textContent = `
            .add-options-dropdown.show {
                display: flex !important;
            }
        `;
        document.head.appendChild(style);
    }
    console.log("Pravidlo CSS pre .add-options-dropdown.show vložené.");


    addButton.addEventListener('click', (event) => {
        event.stopPropagation();
        addOptions.classList.toggle('show');
        console.log(`addButton kliknuté. addOptions má teraz triedu 'show': ${addOptions.classList.contains('show')}`);
    });

    document.addEventListener('click', (event) => {
        if (!addButton.contains(event.target) && !addOptions.contains(event.target)) {
            addOptions.classList.remove('show');
            console.log("Kliknuté mimo addOptions alebo addButton. Trieda addOptions 'show' odstránená.");
        }
    });

    addPlayingDayButton.addEventListener('click', () => {
        playingDayForm.reset();
        playingDayIdInput.value = '';
        playingDayModalTitle.textContent = 'Pridať hrací deň';
        deletePlayingDayButtonModal.style.display = 'none';
        if (deletePlayingDayButtonModal && deletePlayingDayButtonModal._currentHandler) { 
            deletePlayingDayButtonModal.removeEventListener('click', deletePlayingDayButtonModal._currentHandler);
            delete deletePlayingDayButtonModal._currentHandler;
        }
        openModal(playingDayModal);
        addOptions.classList.remove('show');
    });

    addPlaceButton.addEventListener('click', () => {
        placeForm.reset();
        placeIdInput.value = '';
        placeTypeSelect.value = '';
        placeNameInput.value = '';
        placeAddressInput.value = '';
        googleMapsUrlInput.value = '';
        const placeModalTitle = document.getElementById('placeModalTitle'); // Získaj element názvu
        if (placeModalTitle) {
            placeModalTitle.textContent = 'Pridať miesto'; // Nastav názov pre nové miesto
        }
        deletePlaceButtonModal.style.display = 'none';
        if (deletePlaceButtonModal && deletePlaceButtonModal._currentHandler) {
            deletePlaceButtonModal.removeEventListener('click', deletePlaceButtonModal._currentHandler);
            delete deletePlaceButtonModal._currentHandler;
        }
        openModal(placeModal);
        addOptions.classList.remove('show');
    });

    addMatchButton.addEventListener('click', async () => {
        openMatchModal(null, allSettings); // Odovzdaj allSettings pri otváraní pre nový zápas
        addOptions.classList.remove('show');
    });

    closePlayingDayModalButton.addEventListener('click', () => {
        closeModal(playingDayModal);
        // displayMatchesAsSchedule() bude volané onSnapshot, ak sa zmenia nastavenia
    });

    closePlaceModalButton.addEventListener('click', () => {
        closeModal(placeModal);
        // displayMatchesAsSchedule() bude volané onSnapshot, ak sa zmenia nastavenia
    });

    closeMatchModalButton.addEventListener('click', () => {
        closeModal(matchModal);
        // displayMatchesAsSchedule() bude volané onSnapshot, ak sa zmenia nastavenia
    });

    closeFreeIntervalModalButton.addEventListener('click', () => {
        closeModal(freeIntervalModal);
        // displayMatchesAsSchedule() bude volané onSnapshot, ak sa zmenia nastavenia
    });

    matchCategorySelect.addEventListener('change', async () => {
        const selectedCategoryId = matchCategorySelect.value;
        if (selectedCategoryId) {
            await populateGroupSelect(selectedCategoryId, matchGroupSelect);
            matchGroupSelect.disabled = false;
            team1NumberInput.value = '';
            team1NumberInput.disabled = true;
            team2NumberInput.value = '';
            team2NumberInput.disabled = true;
            await updateMatchDurationAndBuffer(allSettings); // Odovzdaj allSettings
            await findFirstAvailableTime(allSettings); // Odovzdaj allSettings
        } else {
            matchGroupSelect.innerHTML = '<option value="">-- Vyberte skupinu --</option>';
            matchGroupSelect.disabled = true;
            team1NumberInput.value = '';
            team1NumberInput.disabled = true;
            team2NumberInput.value = '';
            team2NumberInput.disabled = true;
            matchDurationInput.value = 60;
            matchBufferTimeInput.value = 5;
            matchStartTimeInput.value = '';
        }
    });

    matchGroupSelect.addEventListener('change', () => {
        if (matchGroupSelect.value) {
            team1NumberInput.disabled = false;
            team2NumberInput.disabled = false;
            team1NumberInput.value = ''; 
            team2NumberInput.value = '';
        } else {
            team1NumberInput.value = '';
            team1NumberInput.disabled = true;
            team2NumberInput.disabled = true;
        }
    });

    matchDateSelect.addEventListener('change', () => findFirstAvailableTime(allSettings)); // Odovzdaj allSettings
    matchLocationSelect.addEventListener('change', () => findFirstAvailableTime(allSettings)); // Odovzdaj allSettings
    matchDurationInput.addEventListener('change', () => findFirstAvailableTime(allSettings)); // Odovzdaj allSettings
    matchBufferTimeInput.addEventListener('change', () => findFirstAvailableTime(allSettings)); // Odovzdaj allSettings

    matchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const matchCategory = matchCategorySelect.value;
        const matchGroup = matchGroupSelect.value;
        const team1Number = parseInt(team1NumberInput.value);
        const team2Number = parseInt(team2NumberInput.value);
        const matchDate = matchDateSelect.value;
        const matchLocationName = matchLocationSelect.value;
        const matchStartTime = matchStartTimeInput.value;
        const matchDuration = parseInt(matchDurationInput.value); // Toto je hodnota z formulára
        const matchBufferTime = parseInt(matchBufferTimeInput.value); // Toto je hodnota z formulára
        let currentMatchId = matchIdInput.value; // Použi 'let', pretože sa môže aktualizovať pre nové zápasy

        // Ak nie je vybrané žiadne miesto, nastav locationType na 'Nezadaná hala'
        let finalMatchLocationName = matchLocationName;
        let finalMatchLocationType = 'Športová hala'; // Predvolené
        if (!matchLocationName) {
            finalMatchLocationName = 'Nezadaná hala'; // Alebo prázdny reťazec, v závislosti od toho, ako to chceš spracovať v DB
            finalMatchLocationType = 'Nezadaná hala';
        }


        if (!matchCategory || !matchGroup || isNaN(team1Number) || isNaN(team2Number) || !matchDate || !matchStartTime || isNaN(matchDuration) || isNaN(matchBufferTime)) {
            await showMessage('Chyba', 'Prosím, vyplňte všetky povinné polia (Kategória, Skupina, Poradové číslo tímu 1 a 2, Dátum, Čas začiatku, Trvanie, Prestávka po zápase).');
            return;
        }

        if (team1Number === team2Number) {
            await showMessage('Chyba', 'Tím nemôže hrať sám proti sebe. Prosím, zadajte rôzne poradové čísla tímov.');
            return;
        }

        const categoriesSnapshot = await getDocs(categoriesCollectionRef);
        const categoriesMap = new Map();
        categoriesSnapshot.forEach(doc => categoriesMap.set(doc.id, doc.data().name || doc.id));

        const groupsSnapshot = await getDocs(groupsCollectionRef);
        const groupsMap = new Map();
        groupsSnapshot.forEach(doc => groupsMap.set(doc.id, doc.data().name || doc.id));

        let team1Result = null;
        let team2Result = null;
        try {
            team1Result = await getTeamName(matchCategory, matchGroup, team1Number, categoriesMap, groupsMap);
            team2Result = await getTeamName(matchCategory, matchGroup, team2Number, categoriesMap, groupsMap); 
        } catch (error) {
            console.error("Chyba pri získavaní názvov tímov:", error);
            await showMessage('Chyba', "Vyskytla sa chyba pri získavaní názvov tímov. Skúste to znova.");
            return;
        }

        if (!team1Result || !team1Result.fullDisplayName || !team2Result || !team2Result.fullDisplayName) {
            await showMessage('Chyba', 'Jeden alebo oba tímy sa nenašli. Skontrolujte poradové čísla v danej kategórii a skupine.');
            return;
        }

        let existingDuplicateMatchId = null;
        let existingDuplicateMatchDetails = null;

        try {
            const existingMatchesQuery = query(
                matchesCollectionRef,
                where("categoryId", "==", matchCategory),
                where("groupId", "==", matchGroup)
            );
            const existingMatchesSnapshot = await getDocs(existingMatchesQuery);

            existingMatchesSnapshot.docs.forEach(doc => {
                const existingMatch = doc.data();
                const existingMatchId = doc.id;

                if (currentMatchId && existingMatchId === currentMatchId) {
                    return;
                }

                const condition1 = (existingMatch.team1Number === team1Number && existingMatch.team2Number === team2Number);
                const condition2 = (existingMatch.team1Number === team2Number && existingMatch.team2Number === team1Number);

                if (condition1 || condition2) {
                    existingDuplicateMatchId = existingMatchId;
                    existingDuplicateMatchDetails = existingMatch;
                    return;
                }
            });

            if (existingDuplicateMatchId) {
                const dateObj = new Date(existingDuplicateMatchDetails.date);
                const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}. ${String(dateObj.getMonth() + 1).padStart(2, '0')}. ${dateObj.getFullYear()}`;
                const message = `Tímy ${team1Result.fullDisplayName} a ${team2Result.fullDisplayName} už proti sebe hrali v kategórii ${categoriesMap.get(matchCategory)} a v skupine ${groupsMap.get(matchGroup)} dňa ${formattedDate} o ${existingDuplicateMatchDetails.startTime}. Želáte si tento zápas vymazať a nahradiť ho novými údajmi?`;

                const confirmedReplace = await showConfirmation('Duplicita zápasu!', message);

                if (!confirmedReplace) {
                    return;
                } else {
                    console.log(`Zápas ID: ${existingDuplicateMatchId} označený na vymazanie kvôli duplicitnej kontrole.`);
                    await deleteDoc(doc(matchesCollectionRef, existingDuplicateMatchId));
                    await showMessage('Potvrdenie', `Pôvodný zápas bol vymazaný. Nový zápas bude uložený.`);
                }
            }
        } catch (error) {
            console.error("Chyba pri kontrole existujúcich zápasov a spracovaní duplicity:", error);
            await showMessage('Chyba', "Vyskytla sa chyba pri kontrole, či tímy už hrali proti sebe, alebo pri spracovaní duplicity. Skúste to znova.");
            return;
        }
        
        let matchRef;
        if (currentMatchId) {
            matchRef = doc(matchesCollectionRef, currentMatchId);
            console.log(`Ukladám existujúci zápas ID: ${currentMatchId}`);
        } else {
            matchRef = doc(matchesCollectionRef); // Vytvor novú referenciu dokumentu pre nový zápas
            currentMatchId = matchRef.id; // Získaj ID pre nový dokument
            console.log(`Pridávam nový zápas s generovaným ID: ${currentMatchId}`);
        }

        const matchData = {
            date: matchDate,
            startTime: matchStartTime,
            duration: matchDuration, // Ulož hodnoty z formulára
            bufferTime: matchBufferTime, // Ulož hodnoty z formulára
            location: finalMatchLocationName, // Použi potenciálne upravený názov miesta
            locationType: finalMatchLocationType, // Použi potenciálne upravený typ miesta
            categoryId: matchCategory,
            categoryName: categoriesMap.get(matchCategory) || matchCategory,
            groupId: matchGroup || null,
            groupName: matchGroup ? groupsMap.get(matchGroup).replace(/skupina /gi, '').trim() : null,
            team1Category: matchCategory,
            team1Group: matchGroup,
            team1Number: team1Number,
            team1DisplayName: team1Result.fullDisplayName,
            team1ClubName: team1Result.clubName,
            team1ClubId: team1Result.clubId,
            team2Category: matchCategory,
            team2Group: matchGroup,
            team2Number: team2Number,
            team2DisplayName: team2Result.fullDisplayName,
            team2ClubName: team2Result.clubName,
            team2ClubId: team2Result.clubId,
            createdAt: new Date()
        };

        try {
            await setDoc(matchRef, matchData, { merge: true });
            await showMessage('Úspech', `Zápas úspešne ${matchIdInput.value ? 'aktualizovaný' : 'pridaný'}!`);
            closeModal(matchModal);

            // Odovzdaj detaily novo vloženého/aktualizovaného zápasu funkcii prepočtu
            const insertedMatchInfo = {
                id: currentMatchId,
                date: matchDate,
                location: finalMatchLocationName,
                startTime: matchStartTime,
                duration: matchDuration,
                bufferTime: matchBufferTime
            };

            // Prepočítaj len, ak ide o konkrétne miesto
            if (finalMatchLocationName !== 'Nezadaná hala') {
                await recalculateAndSaveScheduleForDateAndLocation(matchDate, finalMatchLocationName, 'process', insertedMatchInfo, allSettings); // Odovzdaj allSettings
            } else {
                // Ak ide o nepriradený zápas, len obnov zobrazenie
                await displayMatchesAsSchedule(allSettings); // Odovzdaj allSettings
            }
        }
        catch (error) {
            console.error("Chyba pri ukladaní zápasu:", error);
            await showMessage('Chyba', `Chyba pri ukladaní zápasu. Detaily: ${error.message}`);
        }
    });

    placeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('placeId').value;
        const type = document.getElementById('placeTypeSelect').value.trim();
        const name = document.getElementById('placeName').value.trim();
        const address = document.getElementById('placeAddress').value.trim();
        const googleMapsUrl = document.getElementById('placeGoogleMapsUrl').value.trim();

        if (!type || !name || !address || !googleMapsUrl) {
            await showMessage('Chyba', 'Prosím, vyplňte všetky polia (Typ miesta, Názov miesta, Adresa, Odkaz na Google Maps).');
            return;
        }
        if (type === 'Ubytovanie') {
            await showMessage('Chyba', 'Typ miesta "Ubytovanie" nie je podporovaný. Vyberte "Športová hala" alebo "Stravovacie zariadenie".');
            return;
        }

        try {
            new URL(googleMapsUrl);
        } catch (_) {
            await showMessage('Chyba', 'Odkaz na Google Maps musí byť platná URL adresa.');
            return;
        }

        try {
            const q = query(placesCollectionRef, where("name", "==", name), where("type", "==", type));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty && querySnapshot.docs[0].id !== id) {
                await showMessage('Chyba', `Miesto s názvom "${name}" a typom "${type}" už existuje!`);
                return;
            }

            const placeData = {
                type: type,
                name: name,
                address: address,
                googleMapsUrl: googleMapsUrl,
                createdAt: new Date()
            };

            if (id) {
                console.log(`Ukladám existujúce miesto ID: ${id}`, placeData);
                await setDoc(doc(placesCollectionRef, id), placeData, { merge: true });
                await showMessage('Úspech', 'Miesto úspešne aktualizované!');
            } else {
                console.log(`Pridávam nové miesto:`, placeData);
                await addDoc(placesCollectionRef, placeData);
                await showMessage('Úspech', 'Miesto úspešne pridané!');
            }
            closeModal(placeModal);
            // onSnapshot listener pre nastavenia spustí displayMatchesAsSchedule s najnovšími nastaveniami.
        } catch (error) {
            console.error("Chyba pri ukladaní miesta:", error);
            await showMessage('Chyba', `Chyba pri ukladaní miesta. Detaily: ${error.message}`);
        }
    });

    playingDayForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('playingDayId').value;
        const date = document.getElementById('playingDayDate').value;

        if (!date) {
            await showMessage('Chyba', 'Prosím, zadajte dátum hracieho dňa.');
            return;
        }

        try {
            const q = query(playingDaysCollectionRef, where("date", "==", date));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty && querySnapshot.docs[0].id !== id) {
                await showMessage('Chyba', 'Hrací deň s týmto dátumom už existuje!');
                return;
            }

            const playingDayData = { date: date };

            if (id) {
                console.log(`Ukladám existujúci hrací deň ID: ${id}`, playingDayData);
                await setDoc(doc(playingDaysCollectionRef, id), playingDayData, { merge: true });
                await showMessage('Úspech', 'Hrací deň úspešne aktualizovaný!');
            } else {
                console.log(`Pridávam nový hrací deň:`, playingDayData);
                await addDoc(playingDaysCollectionRef, { ...playingDayData, createdAt: new Date() });
                await showMessage('Úspech', 'Hrací deň úspešne pridaný!');
            }
            closeModal(playingDayModal);
            // onSnapshot listener pre nastavenia spustí displayMatchesAsSchedule s najnovšími nastaveniami.
        } catch (error) {
            console.error("Chyba pri ukladaní hracieho dňa:", error);
            await showMessage('Chyba', `Chyba pri ukladaní hracieho dňa. Detaily: ${error.message}`);
        }
    });
});

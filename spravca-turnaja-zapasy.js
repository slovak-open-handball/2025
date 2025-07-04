import { db, categoriesCollectionRef, groupsCollectionRef, clubsCollectionRef, matchesCollectionRef, playingDaysCollectionRef, placesCollectionRef, openModal, closeModal, populateCategorySelect, populateGroupSelect, getDocs, doc, setDoc, addDoc, getDoc, query, where, orderBy, deleteDoc, writeBatch, settingsCollectionRef, showMessage, showConfirmation, parseTimeToMinutes, formatMinutesToTime, calculateFootprintEndTime, getCategoryMatchSettings, getInitialScheduleStartMinutes, recalculateAndSaveScheduleForDateAndLocation, blockedSlotsCollectionRef, SETTINGS_DOC_ID } from './spravca-turnaja-common.js';
import { collection, deleteField, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';


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
 * Aktualizuje vstupy trvania zápasu a času medzi zápasmi na základe vybraných nastavení kategórie.
 * @param {object} currentAllSettings Aktuálny objekt allSettings.
 */
async function updateMatchDurationAndBuffer(currentAllSettings) {
    console.log("[updateMatchDurationAndBuffer] Volaná.");
    const matchDurationInput = document.getElementById('matchDuration');
    const matchBufferTimeInput = document.getElementById('matchBufferTime');
    const matchCategorySelect = document.getElementById('matchCategory');

    const selectedCategoryId = matchCategorySelect.value;
    console.log(`[updateMatchDurationAndBuffer] Vybraná kategória ID: ${selectedCategoryId}`);

    if (selectedCategoryId) {
        const settings = getCategoryMatchSettings(selectedCategoryId, currentAllSettings);
        console.log(`[updateMatchDurationAndBuffer] Nastavenia získané z getCategoryMatchSettings:`, settings);
        matchDurationInput.value = settings.duration;
        matchBufferTimeInput.value = settings.bufferTime;
        console.log(`[updateMatchDurationAndBuffer] Nastavené Trvanie zápasu (minúty) na: ${matchDurationInput.value}`);
        console.log(`[updateMatchDurationAndBuffer] Nastavené Prestávka po zápase (minúty) na: ${matchBufferTimeInput.value}`);
    } else {
        console.log("[updateMatchDurationAndBuffer] Žiadna kategória nie je vybraná. Nastavujem predvolené hodnoty.");
        matchDurationInput.value = 60;
        matchBufferTimeInput.value = 5;
        console.log(`[updateMatchDurationAndBuffer] Nastavené Trvanie zápasu (minúty) na predvolené: ${matchDurationInput.value}`);
        console.log(`[updateMatchDurationAndBuffer] Nastavené Prestávka po zápase (minúty) na predvolené: ${matchBufferTimeInput.value}`);
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

    console.log("[findFirstAvailableTime] Volaná.");
    const selectedDate = matchDateSelect.value;
    const selectedLocationName = matchLocationSelect.value;
    // Použi aktuálne hodnoty z input polí, ktoré by mali byť aktualizované funkciou updateMatchDurationAndBuffer
    const proposedMatchDuration = Number(matchDurationInput.value) || 0;
    const proposedMatchBufferTime = Number(matchBufferTimeInput.value) || 0;
    const proposedMatchFootprint = proposedMatchDuration + proposedMatchBufferTime;

    console.log("[findFirstAvailableTime] Vybraný dátum:", selectedDate);
    console.log("[findFirstAvailableTime] Vybrané miesto:", selectedLocationName);
    console.log("[findFirstAvailableTime] Navrhovaná stopa zápasu (trvanie + buffer):", proposedMatchFootprint);

    if (!selectedDate || !selectedLocationName) {
        matchStartTimeInput.value = '';
        console.log("[findFirstAvailableTime] Dátum alebo miesto prázdne, vymazávam počiatočný čas a vraciam sa.");
        return;
    }

    // Preskoč hľadanie času, ak je vybraná "Nezadaná hala", pretože je nepriradená
    if (selectedLocationName === 'Nezadaná hala') {
        matchStartTimeInput.value = '00:00'; // Predvolené na 00:00 pre nepriradené zápasy
        console.log("[findFirstAvailableTime] Miesto je 'Nezadaná hala', preskakujem logiku hľadania času a nastavujem na 00:00.");
        return;
    }

    try {
        const initialScheduleStartMinutes = await getInitialScheduleStartMinutes(selectedDate, currentAllSettings);
        console.log("[findFirstAvailableTime] Počiatočné minúty ukazovateľa pre vybraný deň (z nastavení):", initialScheduleStartMinutes);

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
        console.log("[findFirstAvailableTime] Všetky načítané udalosti (zápasy a intervaly), zoradené:", allEvents.map(e => ({id: e.id, type: e.type, start: e.start, end: e.end, isBlocked: e.isBlocked, originalMatchId: e.originalMatchId})));

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
                    console.log(`[findFirstAvailableTime] Nájdený vhodný "Voľný interval dostupný" začínajúci o ${proposedStartTimeInMinutes}.`);
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
            console.log("[findFirstAvailableTime] Zlúčené pevné obsadené obdobia (zápasy + isBlocked:true + originalMatchId):", mergedFixedOccupiedPeriods);

            let currentPointer = initialScheduleStartMinutes;
            for (const occupied of mergedFixedOccupiedPeriods) {
                if (currentPointer < occupied.start) {
                    // Nájdená medzera pred obsadeným obdobím
                    if ((occupied.start - currentPointer) >= proposedMatchFootprint) {
                        proposedStartTimeInMinutes = currentPointer;
                        console.log(`[findFirstAvailableTime] Nájdená medzera pred pevným obsadeným obdobím začínajúcim o ${proposedStartTimeInMinutes}.`);
                        break;
                    }
                }
                currentPointer = Math.max(currentPointer, occupied.end);
            }

            // Ak sa stále nenašiel čas, skontroluj po poslednej pevnej udalosti až do konca dňa
            if (proposedStartTimeInMinutes === -1 && currentPointer < 24 * 60) {
                if ((24 * 60 - currentPointer) >= proposedMatchFootprint) {
                    proposedStartTimeInMinutes = currentPointer;
                    console.log(`[findFirstAvailableTime] Nájdená medzera na konci dňa začínajúca o ${proposedStartTimeInMinutes}.`);
                }
            }
        }

        // Náhradné riešenie: Ak sa čas neurčil (napr. celý deň je teoreticky zablokovaný alebo žiadne prvky)
        if (proposedStartTimeInMinutes === -1) {
            proposedStartTimeInMinutes = initialScheduleStartMinutes;
            console.log("[findFirstAvailableTime] Náhradné riešenie: Logikou sa nenašiel dostupný čas, predvolené na počiatočný čas dňa:", proposedStartTimeInMinutes);
        }

        const formattedHour = String(Math.floor(proposedStartTimeInMinutes / 60)).padStart(2, '0');
        const formattedMinute = String(proposedStartTimeInMinutes % 60).padStart(2, '0');
        matchStartTimeInput.value = `${formattedHour}:${formattedMinute}`;
        console.log("[findFirstAvailableTime] Nastavený čas začiatku zápasu:", matchStartTimeInput.value);

    } catch (error) {
        console.error("[findFirstAvailableTime] Chyba pri hľadaní prvého dostupného času:", error);
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
        console.error("[getTeamName] Chyba pri získavaní názvu tímu:", error);
        return { fullDisplayName: `Chyba`, clubName: `Chyba`, clubId: null, shortDisplayName: `Chyba` };
    }
};

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
        console.error("[getMatchData] Chyba pri získavaní dát zápasu:", error);
    }
    return null;
}

/**
 * Vymaže zápas a vytvorí na jeho mieste voľný interval.
 * @param {string} matchId ID zápasu na vymazanie.
 * @param {object} allSettings Všetky nastavenia turnaja, vrátane nastavení zápasov kategórií.
 */
async function deleteMatch(matchId, allSettings) {
    console.log(`[deleteMatch] === FUNKCIA VYMAZANIA ZÁPASU SPUSTENÁ ===`);
    console.log(`[deleteMatch] Pokúšam sa vymazať zápas s ID: ${matchId}`);
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
                console.warn('[deleteMatch] Dokument zápasu nenájdený pre ID:', matchId);
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
            console.log(`[deleteMatch] Zápas ${matchId} pridaný do batchu na vymazanie.`);

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
            console.log(`[deleteMatch] Pridaný nový voľný interval do batchu pre vymazaný zápas:`, freeIntervalData);

            await batch.commit();
            await showMessage('Úspech', 'Zápas bol úspešne vymazaný a časový interval bol označený ako voľný!');
            closeModal(matchModal);
            
            // Prepočítaj rozvrh pre dotknutý dátum a miesto
            // Tu nie sú potrebné žiadne movedMatchDetails, pretože ide o vymazanie, nie presun.
            await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, allSettings);
            console.log("[deleteMatch] Rozvrh prepočítaný a zobrazený po vymazaní zápasu.");

        } catch (error) {
            console.error("[deleteMatch] Chyba pri mazaní zápasu alebo vytváraní voľného intervalu:", error);
            await showMessage('Chyba', `Chyba pri mazaní zápasu: ${error.message}`);
        }
    } else {
        console.log("[deleteMatch] Mazanie zápasu zrušené používateľom.");
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
    console.log(`[moveAndRescheduleMatch] === SPUSTENÉ pre zápas ID: ${draggedMatchId}, cieľ: ${targetDate}, ${targetLocation}, navrhovaný čas: ${droppedProposedStartTime} ===`);
    try {
        const draggedMatchDocRef = doc(matchesCollectionRef, draggedMatchId);
        const draggedMatchDoc = await getDoc(draggedMatchDocRef);
        if (!draggedMatchDoc.exists()) {
            await showMessage('Chyba', 'Presúvaný zápas nebol nájdený.');
            console.error('[moveAndRescheduleMatch] Presúvaný zápas nenájdený!', draggedMatchId);
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
        console.log(`[moveAndRescheduleMatch] Zápas ${draggedMatchId} aktualizovaný v DB s novými dátami:`, updatedMatchData);

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
        console.log(`[moveAndRescheduleMatch] Prepočet pre cieľové miesto (${targetDate}, ${targetLocation}) dokončený.`);

        // 2. Ak sa zápas presunul na *iný* deň alebo miesto, prepočítaj aj PÔVODNÉ miesto/dátum
        if (originalDate !== targetDate || originalLocation !== targetLocation) {
            await recalculateAndSaveScheduleForDateAndLocation(
                originalDate,
                originalLocation,
                'cleanup', // Účel: vyčistiť pôvodné miesto
                movedMatchDetails, // Odovzdaj úplné detaily pre kontext, hoci vyčistenie používa len staré dáta
                allSettings // Odovzdaj allSettings
            );
            console.log(`[moveAndRescheduleMatch] Prepočet pre pôvodné miesto (${originalDate}, ${originalLocation}) dokončený.`);
        }

        await showMessage('Úspech', 'Zápas úspešne presunutý a rozvrh prepočítaný!');
        closeModal(document.getElementById('messageModal'));
    } catch (error) {
        console.error("[moveAndRescheduleMatch] Chyba pri presúvaní a prepočítavaní rozvrhu:", error);
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
            const blockedIntervalStartMinute = String(blockedInterval.startInMinutes % 60).padStart(2, '0');
            const blockedIntervalEndHour = String(Math.floor(blockedInterval.endInMinutes / 60)).padStart(2, '0');
            const blockedIntervalEndMinute = String(blockedInterval.endInMinutes % 60).padStart(2, '0');
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
        console.log("[displayMatchesAsSchedule] Zastavujem predchádzajúcu animáciu.");
    } else {
        console.log("[displayMatchesAsSchedule] Predchádzajúca _stopAnimation nebola funkcia alebo bola nedefinovaná.");
    }
    matchesContainer.innerHTML = `<p id="loadingAnimationText" style="text-align: center; font-size: 1.2em; color: #555;"></p>`;
    // Ulož novú funkciu zastavenia animácie
    matchesContainer._stopAnimation = animateLoadingText('loadingAnimationText', 'Načítavam zoznam zápasov...');
    console.log("[displayMatchesAsSchedule] Nová _stopAnimation priradená.");

    console.log('[displayMatchesAsSchedule] Spustené načítavanie dát.');

    try {
        const matchesQuery = query(matchesCollectionRef, orderBy("date", "asc"), orderBy("location", "asc"), orderBy("startTime", "asc"));
        const matchesSnapshot = await getDocs(matchesQuery);
        let allMatchesRaw = matchesSnapshot.docs.map(doc => ({ id: doc.id, type: 'match', docRef: doc.ref, ...doc.data() }));
        console.log("[displayMatchesAsSchedule] Načítané surové zápasy (po fetchData):", JSON.stringify(allMatchesRaw.map(m => ({id: m.id, date: m.date, location: m.location, startTime: m.startTime, storedDuration: m.duration, storedBufferTime: m.bufferTime}))));

        const categoriesSnapshot = await getDocs(categoriesCollectionRef);
        const categoriesMap = new Map();
        const categoryColorsMap = new Map();
        categoriesSnapshot.forEach(doc => {
            const categoryData = doc.data();
            categoriesMap.set(doc.id, categoryData.name || doc.id);
            categoryColorsMap.set(doc.id, categoryData.color || null);
        });
        console.log("[displayMatchesAsSchedule] Načítané kategórie:", Array.from(categoriesMap.entries()));
        console.log("[displayMatchesAsSchedule] Farby pre Kategórie:");
        categoriesSnapshot.docs.forEach(doc => {
            const categoryData = doc.data();
            console.log(`[displayMatchesAsSchedule] ID kategórie: ${doc.id}, Názov: ${categoryData.name}, Farba: ${categoryData.color || 'N/A'}`);
        });

        const groupsSnapshot = await getDocs(groupsCollectionRef);
        const groupsMap = new Map();
        groupsSnapshot.forEach(doc => groupsMap.set(doc.id, doc.data().name || doc.id));
        console.log("[displayMatchesAsSchedule] Načítané skupiny:", Array.from(groupsMap.entries()));

        const playingDaysSnapshot = await getDocs(query(playingDaysCollectionRef, orderBy("date", "asc")));
        const allPlayingDayDates = playingDaysSnapshot.docs.map(doc => doc.data().date);
        allPlayingDayDates.sort();
        console.log("[displayMatchesAsSchedule] Načítané hracie dni (len dátumy):", allPlayingDayDates);

        const sportHallsSnapshot = await getDocs(query(placesCollectionRef, where("type", "==", "Športová hala"), orderBy("name", "asc")));
        const allSportHalls = sportHallsSnapshot.docs.map(doc => doc.data().name);
        console.log("[displayMatchesAsSchedule] Načítané športové haly:", allSportHalls);

        const allSettings = currentAllSettings; // Použi currentAllSettings odovzdané ako parameter
        let globalFirstDayStartTime = allSettings.firstDayStartTime || '08:00';
        let globalOtherDaysStartTime = allSettings.otherDaysStartTime || '08:00';
        console.log(`[displayMatchesAsSchedule] Globálny čas začiatku (prvý deň): ${globalFirstDayStartTime}, (ostatné dni): ${globalOtherDaysStartTime}`);

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
        console.log("[displayMatchesAsSchedule] Načítané zablokované intervaly:", JSON.stringify(allBlockedIntervals.map(s => ({id: s.id, date: s.date, location: s.location, startTime: s.startTime, endTime: s.endTime, isBlocked: s.isBlocked, originalMatchId: s.originalMatchId}))));

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
                console.log(`[displayMatchesAsSchedule] Zápas ID ${match.id} má neaktuálne trvanie/buffer. Aktualizujem v DB. Staré: D=${match.duration}, B=${match.bufferTime}. Nové: D=${calculatedDuration}, B=${calculatedBufferTime}`);
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
            console.log(`[displayMatchesAsSchedule] Spúšťam batch pre aktualizáciu ${matchesToUpdateCount} zápasov.`);
            await updateMatchesBatch.commit();
            console.log(`[displayMatchesAsSchedule] Batch pre aktualizáciu zápasov úspešne dokončený.`);
        }
        
        console.log("[displayMatchesAsSchedule] Všetky zápasy s naplnenými zobrazovanými názvami a prepočítanou dĺžkou/bufferom:", JSON.stringify(allMatches.map(m => ({id: m.id, date: m.date, location: m.location, startTime: m.startTime, duration: m.duration, bufferTime: m.bufferTime, footprintEndInMinutes: m.footprintEndInMinutes}))));


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
                console.warn(`[displayMatchesAsSchedule] Zápas ${match.id} s neplatným typom miesta "${match.locationType}" bol preskočený z rozvrhu športových hál.`);
            }
        });
        console.log('[displayMatchesAsSchedule] Zoskupené zápasy (podľa miesta a dátumu):', groupedMatches);
        console.log('[displayMatchesAsSchedule] Nepriradené zápasy:', unassignedMatches); // Zaznamenaj nepriradené zápasy


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
                        console.log(`[displayMatchesAsSchedule] Udalosti pre render pre ${location} na ${date} (zoradené):`, JSON.stringify(currentEventsForRendering.map(e => ({id: e.id, type: e.type, startTime: e.startTime || e.startInMinutes, endTime: e.endTime || e.endInMinutes, isBlocked: e.isBlocked, originalMatchId: e.originalMatchId, endOfPlayInMinutes: e.endOfPlayInMinutes, footprintEndInMinutes: e.footprintEndInMinutes}))));


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
                                console.log(`[displayMatchesAsSchedule] Žiadne udalosti pre ${date} na ${location}. Pridávam počiatočný celodenný zástupný symbol.`);
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
                                        console.log(`[displayMatchesAsSchedule] Pridávam zástupný symbol medzery (${formattedGapStartTime}-${formattedGapEndTime}). Z vymazaného zápasu: ${isFromDeletedMatch}, Dlhšie ako buffer: ${isLongerThanPreviousBuffer}`);
                                    } else {
                                        console.log(`[displayMatchesAsSchedule] Preskakujem medzeru ${formattedGapStartTime}-${formattedGapEndTime}, pretože je to čisto čas medzi zápasmi alebo je príliš krátka.`);
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
                                    console.log(`[displayMatchesAsSchedule] Pridávam konečný zástupný symbol medzery: ${formattedGapStartTime}-${formattedGapEndTime}.`);
                                } else {
                                    console.log(`[displayMatchesAsSchedule] Preskakujem konečnú medzeru ${formattedGapStartTime}-${formattedGapEndTime}, pretože jej trvanie je 0.`);
                                }
                            }
                        }

                        console.log(`[displayMatchesAsSchedule] FinalEventsToRender (po vložení medzier a zástupných symbolov):`, JSON.stringify(finalEventsToRender.map(e => ({id: e.id, type: e.type, startTime: e.startTime || e.startInMinutes, endTime: e.endTime || e.endInMinutes, isBlocked: e.isBlocked, originalMatchId: e.originalMatchId, endOfPlayInMinutes: e.endOfPlayInMinutes, footprintEndInMinutes: e.footprintEndInMinutes}))));

                        
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
                                console.log(`[displayMatchesAsSchedule] Vykresľujem zápas: ID ${match.id}, Čas: ${match.startTime}-${formattedDisplayedEndTime} (zobrazený), Miesto: ${match.location}, Dátum: ${match.date}`);

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
                                    console.log(`[displayMatchesAsSchedule] Preskakujem vykreslenie čisto kozmetického/nulového zástupného symbolu: ${blockedIntervalStartHour}:${blockedIntervalStartMinute}-${blockedIntervalEndHour}:${blockedIntervalEndMinute}`);
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

                                console.log(`[displayMatchesAsSchedule] Vykresľujem zablokovaný interval: ID ${blockedInterval.id}, Čas: ${blockedIntervalStartHour}:${blockedIntervalStartMinute}-${blockedIntervalEndHour}:${blockedIntervalEndMinute}, Miesto: ${blockedInterval.location}, Dátum: ${blockedInterval.date}, isBlocked: ${isUserBlocked}, Zobrazovaný text: "${displayText}"`);

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
        console.log('[displayMatchesAsSchedule] HTML rozvrhu aktualizované.');

        matchesContainer.querySelectorAll('.match-row').forEach(row => {
            row.addEventListener('click', (event) => {
                const matchId = event.currentTarget.dataset.id;
                openMatchModal(matchId, allSettings); // Odovzdaj allSettings
            });
            row.addEventListener('dragstart', (event) => {
                console.log(`[Drag & Drop] dragstart - ID zápasu: ${event.target.dataset.id}, Cieľ:`, event.target);
                event.dataTransfer.setData('text/plain', event.target.dataset.id);
                event.dataTransfer.effectAllowed = 'move';
                event.target.classList.add('dragging');
            });

            row.addEventListener('dragend', (event) => {
                console.log(`[Drag & Drop] dragend - ID zápasu: ${event.target.dataset.id}, Cieľ:`, event.target);
                event.target.classList.remove('dragging');
            });
            // Nové obsluhy dragover a drop pre match-row
            row.addEventListener('dragover', (event) => {
                event.preventDefault(); // Povoliť pustenie
                event.dataTransfer.dropEffect = 'move';
                event.currentTarget.classList.add('drop-over-row'); // Vizuálna spätná väzba
                console.log(`[Drag & Drop] dragover na match-row - ID: ${event.currentTarget.dataset.id}, Cieľ:`, event.currentTarget);
            });

            row.addEventListener('dragleave', (event) => {
                event.currentTarget.classList.remove('drop-over-row');
                console.log(`[Drag & Drop] dragleave z match-row - ID: ${event.currentTarget.dataset.id}, Cieľ:`, event.currentTarget);
            });

            row.addEventListener('drop', async (event) => {
                event.preventDefault();
                event.currentTarget.classList.remove('drop-over-row');

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const targetMatchId = event.currentTarget.dataset.id;
                const newDate = event.currentTarget.closest('.date-group').dataset.date;
                const newLocation = event.currentTarget.closest('.date-group').dataset.location;

                console.log(`[Drag & Drop] drop na match-row - Presunutý zápas ID: ${draggedMatchId}, Cieľový zápas ID: ${targetMatchId}, Nový dátum: ${newDate}, Nové miesto: ${newLocation}, Cieľ:`, event.currentTarget);

                if (draggedMatchId === targetMatchId) {
                    console.log("[Drag & Drop] Pustené na seba, žiadna akcia.");
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
                    console.log(`[Drag & Drop] Pustené PRED cieľový zápas. Navrhovaný počiatočný čas: ${droppedProposedStartTime}`);
                } else {
                    // Pustené v druhej polovici cieľového riadku, takže umiestni ZA cieľový zápas
                    droppedProposedStartTime = event.currentTarget.dataset.footprintEndTime; // Toto je koniec hry + buffer
                    console.log(`[Drag & Drop] Pustené ZA cieľový zápas. Navrhovaný počiatočný čas: ${droppedProposedStartTime}`);
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
                console.log(`[Drag & Drop] dragover na empty-interval-row - ID: ${event.currentTarget.dataset.id}, Cieľ:`, event.currentTarget);
            });
            row.addEventListener('dragleave', (event) => {
                event.currentTarget.classList.remove('drop-over-row');
                console.log(`[Drag & Drop] dragleave z empty-interval-row - ID: ${event.currentTarget.dataset.id}, Cieľ:`, event.currentTarget);
            });
            row.addEventListener('drop', async (event) => {
                event.preventDefault(); // Kľúčové pre spracovanie pustenia
                event.currentTarget.classList.remove('drop-over-row');

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const newDate = event.currentTarget.dataset.date;
                const newLocation = event.currentTarget.dataset.location;
                const droppedProposedStartTime = event.currentTarget.dataset.startTime;
                const targetBlockedIntervalId = event.currentTarget.dataset.id;

                console.log(`[Drag & Drop] drop na empty-interval-row - Presunutý zápas ID: ${draggedMatchId}, Nový dátum: ${newDate}, Nové miesto: ${newLocation}, Navrhovaný čas: ${droppedProposedStartTime}, Cieľový interval ID: ${targetBlockedIntervalId}, Cieľ:`, event.currentTarget);
                
                if (targetBlockedIntervalId) {
                    try {
                        // Vymaž starý automaticky generovaný voľný slot, pretože je nahradený pusteným zápasom
                        // Toto je dôležité pre vyčistenie, aby recalculateAndSaveScheduleForDateAndLocation ho okamžite znova nevytvoril.
                        await deleteDoc(doc(blockedSlotsCollectionRef, targetBlockedIntervalId));
                        console.log(`[Drag & Drop] Pôvodný voľný slot ${targetBlockedIntervalId} vymazaný.`);
                    } catch (error) {
                        console.error(`[Drag & Drop] Chyba pri mazaní pôvodného voľného slotu ${targetBlockedIntervalId}:`, error);
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
                console.log(`[Drag & Drop] dragover na blocked-interval-row - ID: ${event.currentTarget.dataset.id}, Drop efekt: none, Cieľ:`, event.currentTarget);
            });
            row.addEventListener('dragleave', (event) => {
                event.currentTarget.classList.remove('drop-over-forbidden');
                console.log(`[Drag & Drop] dragleave z blocked-interval-row - ID: ${event.currentTarget.dataset.id}, Cieľ:`, event.currentTarget);
            });
            row.addEventListener('drop', async (event) => {
                event.preventDefault();
                event.currentTarget.classList.remove('drop-over-forbidden');

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const date = event.currentTarget.dataset.date;
                const location = event.currentTarget.dataset.location;
                const startTime = event.currentTarget.dataset.startTime;
                const endTime = event.currentTarget.dataset.endTime;

                console.log(`[Drag & Drop] drop na blocked-interval-row - Pokus o presun zápasu ${draggedMatchId} na zablokovaný interval: Dátum ${date}, Miesto ${location}, Čas ${startTime}-${endTime}. Presun ZAMITNUTÝ. Cieľ:`, event.currentTarget);
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
                    console.log(`[Drag & Drop] dragover na date-group (pozadie) - Drop efekt: move, Cieľ:`, event.target);
                }
            });

            dateGroupDiv.addEventListener('dragleave', (event) => {
                // Toto musí byť opatrné, aby sa neodstránila trieda, ak sa len presúva z jedného riadku na druhý v rámci tej istej dátumovej skupiny
                // Lepší spôsob je odstrániť ju len vtedy, keď myš opustí celý dateGroupDiv
                // Zatiaľ to nechajme jednoduché a uistime sa, že sa odstráni pri pustení alebo úplnom opustení.
                const relatedTarget = event.relatedTarget;
                if (!relatedTarget || !dateGroupDiv.contains(relatedTarget)) {
                    dateGroupDiv.classList.remove('drop-target-active');
                    console.log(`[Drag & Drop] dragleave z date-group (celý div), Cieľ:`, event.target);
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
                    console.log(`[Drag & Drop] Udalosť pustenia na date-group, ale cieľ je konkrétny riadok. Delegujem na obsluhu riadku.`);
                    return;
                }

                // Pôvodná logika pre pustenie na všeobecné pozadie dátumovej skupiny (prvý dostupný čas)
                console.log(`[Drag & Drop] drop na date-group (pozadie) - Presunutý zápas ID: ${draggedMatchId}, Nový dátum: ${newDate}, Nové miesto: ${newLocation}, Cieľ:`, event.target);

                if (draggedMatchId) {
                    const isUnassignedSection = (newLocation === 'Nezadaná hala');

                    if (isUnassignedSection) {
                        const draggedMatchData = (await getDoc(doc(matchesCollectionRef, draggedMatchId))).data();
                        droppedProposedStartTime = draggedMatchData.startTime;
                        console.log(`[Drag & Drop] Pustené na nepriradenú sekciu. Používam pôvodný počiatočný čas zápasu: ${droppedProposedStartTime}`);
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
                        console.log(`[Drag & Drop] Pustené na pozadie dátumovej skupiny. Vypočítaný najskorší dostupný čas: ${droppedProposedStartTime}`);
                    }

                    console.log(`[Drag & Drop] Pokúšam sa presunúť a preplánovať zápas ${draggedMatchId} na Dátum: ${newDate}, Miesto: ${newLocation}, Navrhovaný počiatočný čas: ${droppedProposedStartTime}.`);
                    await moveAndRescheduleMatch(draggedMatchId, newDate, newLocation, droppedProposedStartTime, allSettings);
                }
            });
        });

    } catch (error) {
        console.error("[displayMatchesAsSchedule] Chyba pri načítaní rozvrhu zápasov (zachytená chyba):", error);
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
            console.error("[deletePlayingDay] Chyba pri mazaní hracieho dňa:", error);
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
                console.error("[deletePlace] Chyba pri mazaní miesta:", error);
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
        console.error("[editPlayingDay] Chyba pri načítavaní dát hracieho dňa:", error);
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
        console.error("[editPlace] Chyba pri načítavaní dát miesta:", error);
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
    console.log(`[openMatchModal] Volaná. matchId: ${matchId}, prefillDate: ${prefillDate}, prefillLocation: ${prefillLocation}, prefillStartTime: ${prefillStartTime}`);
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
    console.log("[openMatchModal] Aktuálne allSettings (pred spracovaním kategórií):", allSettings);

    // Odstráň existujúce poslucháče udalostí pre tlačidlo vymazania
    if (deleteMatchButtonModal && deleteMatchButtonModal._currentHandler) {
        deleteMatchButtonModal.removeEventListener('click', deleteMatchButtonModal._currentHandler);
        delete deleteMatchButtonModal._currentHandler;
        console.log("[openMatchModal] Odstránený starý poslucháč pre tlačidlo vymazania.");
    }

    matchForm.reset(); // Resetuj formulár na začiatku
    console.log("[openMatchModal] Formulár resetovaný. Hodnoty po resete: Duration:", matchDurationInput.value, "Buffer:", matchBufferTimeInput.value);

    matchIdInput.value = matchId || '';
    deleteMatchButtonModal.style.display = matchId ? 'inline-block' : 'none';
    
    if (matchId) {
        const handler = () => deleteMatch(matchId, allSettings);
        deleteMatchButtonModal.addEventListener('click', handler);
        deleteMatchButtonModal._currentHandler = handler;
        console.log("[openMatchModal] Nastavený handler pre tlačidlo vymazania (režim úpravy).");
    } else {
        deleteMatchButtonModal._currentHandler = null; 
        console.log("[openMatchModal] Tlačidlo vymazania skryté (režim pridania).");
    }

    // Naplní výber kategórie najprv
    console.log("[openMatchModal] Volám populateCategorySelect...");
    await populateCategorySelect(matchCategorySelect);
    console.log("[openMatchModal] populateCategorySelect dokončené.");

    if (matchId) {
        matchModalTitle.textContent = 'Upraviť zápas';
        console.log(`[openMatchModal] Režim úpravy pre zápas ID: ${matchId}`);
        const matchDocRef = doc(matchesCollectionRef, matchId);
        const matchDoc = await getDoc(matchDocRef);
        if (!matchDoc.exists()) {
            await showMessage('Informácia', "Zápas sa nenašiel.");
            console.warn(`[openMatchModal] Zápas s ID ${matchId} sa nenašiel.`);
            return;
        }
        const matchData = matchDoc.data();
        console.log("[openMatchModal] Načítané dáta zápasu:", matchData);

        await populatePlayingDaysSelect(matchDateSelect, matchData.date);
        if (!matchData.location || matchData.locationType !== 'Športová hala') {
            await populateSportHallSelects(matchLocationSelect, '');
            console.log("[openMatchModal] Miesto zápasu nie je športová hala alebo je prázdne. Nastavujem predvolené miesto.");
        } else {
            await populateSportHallSelects(matchLocationSelect, matchData.location);
            console.log(`[openMatchModal] Nastavené miesto zápasu na: ${matchData.location}`);
        }
        matchStartTimeInput.value = matchData.startTime || '';
        console.log(`[openMatchModal] Nastavený počiatočný čas zápasu na: ${matchStartTimeInput.value}`);
        
        // Uisti sa, že je vybraná správna kategória v rozbaľovacom zozname PRED získaním nastavení
        matchCategorySelect.value = matchData.categoryId;
        console.log(`[openMatchModal] Nastavená vybraná kategória na: ${matchCategorySelect.value}`);
        
        // Explicitne nastav hodnoty z nastavení kategórie
        console.log("[openMatchModal] Volám getCategoryMatchSettings pre explicitné nastavenie trvania/bufferu.");
        const categorySettings = getCategoryMatchSettings(matchData.categoryId, allSettings);
        matchDurationInput.value = categorySettings.duration;
        matchBufferTimeInput.value = categorySettings.bufferTime;
        console.log(`[openMatchModal] Explicitne nastavené Trvanie zápasu (minúty) na: ${matchDurationInput.value} a Prestávka po zápase (minúty) na: ${matchBufferTimeInput.value}`);

        if (matchData.categoryId) {
            console.log(`[openMatchModal] Volám populateGroupSelect pre kategóriu: ${matchData.categoryId}`);
            await populateGroupSelect(matchData.categoryId, matchGroupSelect, matchData.groupId);
            matchGroupSelect.disabled = false;
            console.log(`[openMatchModal] Nastavená vybraná skupina na: ${matchGroupSelect.value}. Skupina povolená.`);
        } else {
            matchGroupSelect.innerHTML = '<option value="">-- Vyberte skupinu --</option>';
            matchGroupSelect.disabled = true;
            console.log("[openMatchModal] Kategória nie je vybraná. Skupina zakázaná.");
        }

        if (matchGroupSelect.value) {
            team1NumberInput.disabled = false;
            team2NumberInput.disabled = false;
            console.log("[openMatchModal] Skupina vybraná. Tímy povolené.");
        } else {
            team1NumberInput.disabled = true;
            team2NumberInput.disabled = true;
            console.log("[openMatchModal] Skupina nie je vybraná. Tímy zakázané.");
        }

        team1NumberInput.value = matchData.team1Number || '';
        team2NumberInput.value = matchData.team2Number || '';
        console.log(`[openMatchModal] Nastavené poradové čísla tímov: Tím 1: ${team1NumberInput.value}, Tím 2: ${team2NumberInput.value}`);

        if (prefillDate && prefillLocation) {
            console.log("[openMatchModal] Predvyplňujem dátum a miesto z parametrov.");
            await populatePlayingDaysSelect(matchDateSelect, prefillDate);
            await populateSportHallSelects(matchLocationSelect, prefillLocation);
            matchStartTimeInput.value = prefillStartTime;
            console.log(`[openMatchModal] Predvyplnený dátum: ${prefillDate}, Miesto: ${prefillLocation}, Čas: ${prefillStartTime}`);
        }

    } else { // Pridávanie nového zápasu
        matchModalTitle.textContent = 'Pridať nový zápas';
        console.log("[openMatchModal] Režim pridávania nového zápasu.");
        
        // Pôvodný kód na automatické nastavenie prvej kategórie bol odstránený/zakomentovaný.
        // matchCategorySelect.value = ''; // Uistite sa, že je prázdna hodnota, ak to nie je predvolené
        console.log("[openMatchModal] Kategória sa automaticky nenastavuje. Zostáva na predvolenej hodnote.");

        // Teraz, keď (prípadne) nie je vybraná kategória, aktualizuj trvanie/buffer
        console.log("[openMatchModal] Volám updateMatchDurationAndBuffer po nastavení (alebo nenastavení) kategórie.");
        await updateMatchDurationAndBuffer(allSettings); 

        console.log("[openMatchModal] Volám populatePlayingDaysSelect a populateSportHallSelects pre predvyplnenie.");
        await populatePlayingDaysSelect(matchDateSelect, prefillDate); 
        await populateSportHallSelects(matchLocationSelect, prefillLocation);
        
        if (matchGroupSelect) {
            matchGroupSelect.innerHTML = '<option value="">-- Vyberte skupinu --</option>';
            matchGroupSelect.disabled = true;
            console.log("[openMatchModal] Skupina resetovaná a zakázaná.");
        }
        
        team1NumberInput.value = '';
        team1NumberInput.disabled = true;
        team2NumberInput.value = '';
        team2NumberInput.disabled = true;
        console.log("[openMatchModal] Tímy resetované a zakázané.");
        
        console.log("[openMatchModal] Volám findFirstAvailableTime.");
        await findFirstAvailableTime(allSettings);
    }
    openModal(matchModal);
    console.log("[openMatchModal] Modálne okno otvorené.");
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
    console.log(`[openFreeIntervalModal] Volané pre Dátum: ${date}, Miesto: ${location}, Čas: ${startTime}-${endTime}, ID intervalu: ${blockedIntervalId}`);

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
        console.log("[openFreeIntervalModal] Odstránený starý poslucháč pre 'addMatchFromFreeSlotButton'.");
    }
    if (blockButton && blockButton._currentHandler) {
        blockButton.removeEventListener('click', blockButton._currentHandler);
        delete blockButton._currentHandler;
        console.log("[openFreeIntervalModal] Odstránený starý poslucháč pre 'blockButton'.");
    }
    if (unblockButton && unblockButton._currentHandler) {
        unblockButton.removeEventListener('click', unblockButton._currentHandler);
        delete unblockButton._currentHandler;
        console.log("[openFreeIntervalModal] Odstránený starý poslucháč pre 'unblockButton'.");
    }
    if (deleteButton && deleteButton._currentHandler) { 
        deleteButton.removeEventListener('click', deleteButton._currentHandler);
        delete deleteButton._currentHandler;
        console.log("[openFreeIntervalModal] Odstránený starý poslucháč pre 'deleteButton'.");
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
                console.log(`[openFreeIntervalModal] Načítané dáta pre blockedIntervalId=${blockedIntervalId}: isBlocked=${isUserBlockedFromDB}, originalMatchId=${originalMatchId}`);
            } else {
                console.warn(`[openFreeIntervalModal] Dokument blockedIntervalId=${blockedIntervalId} neexistuje (možno už bol odstránený?). Považujem ho za zástupný symbol.`);
                isUserBlockedFromDB = false;
            }
        } catch (error) {
            console.error(`[openFreeIntervalModal] Chyba pri načítaní dokumentu pre blockedIntervalId=${blockedIntervalId}:`, error);
            isUserBlockedFromDB = false;
        }
    } else {
        isUserBlockedFromDB = false;
        console.log(`[openFreeIntervalModal] Zistené generované ID intervalu (${blockedIntervalId}). Považujem ho za zástupný symbol.`);
    }

    if (isUserBlockedFromDB) { // Existujúci zablokovaný interval používateľom
        freeIntervalModalTitle.textContent = 'Upraviť zablokovaný interval';
        console.log("[openFreeIntervalModal] Typ intervalu: Normálny zablokovaný interval (používateľom zablokovaný).");
        
        // Zobraz možnosti odblokovania a vymazania
        if (unblockButton) {
            unblockButton.style.display = 'inline-block';
            unblockButton.textContent = 'Odblokovať';
            unblockButton.classList.remove('delete-button'); 
            const unblockHandler = () => {
                console.log(`[openFreeIntervalModal] Kliknuté 'Odblokovať' pre zablokovaný interval ID: ${blockedIntervalId}. Volám unblockBlockedInterval.`);
                unblockBlockedInterval(blockedIntervalId, date, location, allSettings); // Odovzdaj allSettings
            };
            unblockButton.addEventListener('click', unblockHandler);
            unblockButton._currentHandler = unblockHandler;
            console.log("[openFreeIntervalModal] Poslucháč pridaný a tlačidlo 'Odblokovať' zobrazené.");
        }
        if (deleteButton) { 
            deleteButton.style.display = 'inline-block';
            deleteButton.textContent = 'Vymazať interval';
            deleteButton.classList.add('delete-button');
            const deleteHandler = () => {
                console.log(`[openFreeIntervalModal] Kliknuté 'Vymazať interval' pre zablokovaný interval ID: ${blockedIntervalId}. Volám handleDeleteInterval.`);
                handleDeleteInterval(blockedIntervalId, date, location, allSettings); // Odovzdaj allSettings
            };
            deleteButton.addEventListener('click', deleteHandler); 
            deleteButton._currentHandler = deleteHandler; 
            console.log("[openFreeIntervalModal] Poslucháč pridaný a tlačidlo 'Vymazať interval' zobrazené.");
        }

    } else if (originalMatchId) { // Toto je voľný interval vytvorený vymazaným zápasom
        freeIntervalModalTitle.textContent = 'Voľný interval po vymazanom zápase';
        console.log("[openFreeIntervalModal] Typ intervalu: Voľný interval z vymazaného zápasu.");

        // Zobraz možnosti pridania zápasu, zablokovania a VYMAZANIA pre tieto špecifické zástupné symboly
        if (addMatchButton) {
            addMatchButton.style.display = 'inline-block';
            const addMatchHandler = () => {
                console.log(`[openFreeIntervalModal] Kliknuté 'Pridať zápas' pre voľný interval. Volám openMatchModal.`);
                closeModal(freeIntervalModal);
                openMatchModal(null, allSettings, date, location, startTime); // Odovzdaj allSettings
            };
            addMatchButton.addEventListener('click', addMatchHandler);
            addMatchButton._currentHandler = addMatchHandler;
            console.log("[openFreeIntervalModal] Poslucháč pridaný a tlačidlo 'Pridať zápas' zobrazené.");
        }
        if (blockButton) {
            blockButton.style.display = 'inline-block';
            blockButton.textContent = 'Zablokovať';
            const blockHandler = () => {
                console.log(`[openFreeIntervalModal] Kliknuté 'Zablokovať' pre voľný interval z vymazaného zápasu ID: ${blockedIntervalId}. Volám blockFreeInterval.`);
                blockFreeInterval(blockedIntervalId, date, location, startTime, endTime, allSettings); // Odovzdaj allSettings
            };
            blockButton.addEventListener('click', blockHandler);
            blockButton._currentHandler = blockHandler;
            console.log("[openFreeIntervalModal] Poslucháč pridaný a tlačidlo 'Zablokovať' zobrazené.");
        }
        if (deleteButton) { // Povoľ vymazanie voľných intervalov, ktoré pochádzajú z vymazaných zápasov
            deleteButton.style.display = 'inline-block';
            deleteButton.textContent = 'Vymazať interval';
            deleteButton.classList.add('delete-button'); // Pridaj štýlovanie tlačidla vymazania
            const deleteHandler = () => {
                console.log(`[openFreeIntervalModal] Kliknuté 'Vymazať interval' pre voľný interval z vymazaného zápasu ID: ${blockedIntervalId}. Volám handleDeleteInterval.`);
                handleDeleteInterval(blockedIntervalId, date, location, allSettings); // Odovzdaj allSettings
            };
            deleteButton.addEventListener('click', deleteHandler); 
            deleteButton._currentHandler = deleteHandler; 
            console.log("[openFreeIntervalModal] Poslucháč pridaný a tlačidlo 'Vymazať interval' zobrazené pre voľný interval z vymazaného zápasu.");
        }

    } else { // Automaticky generovaný prázdny interval (všeobecná medzera)
        const [endH, endM] = endTime.split(':').map(Number);
        if (endH === 24 && endM === 0) { // Ak ide o úplne posledný interval dňa
            console.log("[openFreeIntervalModal] Interval končí o 24:00. Toto je zvyčajne koncový zástupný symbol, žiadne špeciálne akcie.");
            freeIntervalModalTitle.textContent = 'Voľný interval';
            // Žiadne tlačidlá pre tento typ, okrem zatvorenia
        } else {
            freeIntervalModalTitle.textContent = 'Voľný interval';
            console.log("[openFreeIntervalModal] Typ intervalu: Automaticky generovaný voľný interval.");
            
            // Zobraz možnosti pridania zápasu a zablokovania
            if (addMatchButton) {
                addMatchButton.style.display = 'inline-block';
                const addMatchHandler = () => {
                    console.log(`[openFreeIntervalModal] Kliknuté 'Pridať zápas' pre voľný interval. Volám openMatchModal.`);
                    closeModal(freeIntervalModal);
                    openMatchModal(null, allSettings, date, location, startTime); // Odovzdaj allSettings
                };
                addMatchButton.addEventListener('click', addMatchHandler);
                addMatchButton._currentHandler = addMatchHandler;
                console.log("[openFreeIntervalModal] Poslucháč pridaný a tlačidlo 'Pridať zápas' zobrazené.");
            }
            if (blockButton) {
                blockButton.style.display = 'inline-block';
                blockButton.textContent = 'Zablokovať';
                const blockHandler = () => {
                    console.log(`[openFreeIntervalModal] Kliknuté 'Zablokovať' pre voľný interval. Volám blockFreeInterval.`);
                    blockFreeInterval(null, date, location, startTime, endTime, allSettings); // allSettings
                };
                blockButton.addEventListener('click', blockHandler);
                blockButton._currentHandler = blockHandler;
                console.log("[openFreeIntervalModal] Poslucháč pridaný a tlačidlo 'Zablokovať' zobrazené.");
            }
            // Tlačidlo vymazania sa pre tieto automaticky generované voľné intervaly nezobrazuje
            // pretože sa dynamicky vytvárajú a vymazávajú funkciou recalculateAndSaveScheduleForDateAndLocation.
            // Ak by ich používateľ vymazal ručne, mohli by sa hneď znova objaviť.
        }
    }

    openModal(freeIntervalModal);
    console.log("[openFreeIntervalModal] Modálne okno voľného intervalu otvorené.");
}

/**
 * Zablokuje voľný interval alebo vytvorí nový zablokovaný interval.
 * Ak je providedBlockedIntervalId null, vytvorí nový, inak aktualizuje existujúci.
 * @param {string|null} providedBlockedIntervalId ID existujúceho intervalu na aktualizáciu, alebo null pre nový.
 * @param {string} date Dátum intervalu.
 * @param {string} location Miesto intervalu.
 * @param {string} startTime Počiatočný čas intervalu.
 * @param {string} endTime Koncový čas intervalu.
 * @param {object} allSettings Všetky nastavenia turnaja.
 */
async function blockFreeInterval(providedBlockedIntervalId, date, location, startTime, endTime, allSettings) {
    console.log(`[blockFreeInterval] Volané. ID: ${providedBlockedIntervalId}, Dátum: ${date}, Miesto: ${location}, Čas: ${startTime}-${endTime}`);
    const freeIntervalModal = document.getElementById('freeSlotModal');

    try {
        const intervalData = {
            date: date,
            location: location,
            startTime: startTime,
            endTime: endTime,
            isBlocked: true, // Teraz je to zablokovaný interval
            originalMatchId: null, // Toto nie je voľný slot po vymazanom zápase
            startInMinutes: parseTimeToMinutes(startTime),
            endInMinutes: parseTimeToMinutes(endTime),
            createdAt: new Date()
        };

        if (providedBlockedIntervalId) {
            // Aktualizuj existujúci dokument
            await setDoc(doc(blockedSlotsCollectionRef, providedBlockedIntervalId), intervalData, { merge: true });
            await showMessage('Úspech', 'Interval bol úspešne zablokovaný!');
            console.log(`[blockFreeInterval] Interval ID ${providedBlockedIntervalId} aktualizovaný na zablokovaný.`);
        } else {
            // Vytvor nový dokument
            await addDoc(blockedSlotsCollectionRef, intervalData);
            await showMessage('Úspech', 'Nový interval bol úspešne zablokovaný!');
            console.log(`[blockFreeInterval] Nový zablokovaný interval vytvorený.`);
        }
        closeModal(freeIntervalModal);
        // Prepočítaj rozvrh pre daný dátum a miesto, aby sa zohľadnila zmena
        await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, allSettings);
        console.log("[blockFreeInterval] Rozvrh prepočítaný po zablokovaní intervalu.");

    } catch (error) {
        console.error("[blockFreeInterval] Chyba pri blokovaní intervalu:", error);
        await showMessage('Chyba', `Chyba pri blokovaní intervalu: ${error.message}`);
    }
}

/**
 * Odblokuje zablokovaný interval.
 * @param {string} blockedIntervalId ID zablokovaného intervalu.
 * @param {string} date Dátum intervalu.
 * @param {string} location Miesto intervalu.
 * @param {object} allSettings Všetky nastavenia turnaja.
 */
async function unblockBlockedInterval(blockedIntervalId, date, location, allSettings) {
    console.log(`[unblockBlockedInterval] Volané. ID: ${blockedIntervalId}`);
    const freeIntervalModal = document.getElementById('freeSlotModal');

    const confirmed = await showConfirmation(
        'Potvrdenie odblokovania',
        'Naozaj chcete odblokovať tento interval? Bude opäť dostupný pre zápasy.'
    );

    if (confirmed) {
        try {
            // Aktualizuj existujúci dokument tak, aby už nebol zablokovaný
            await setDoc(doc(blockedSlotsCollectionRef, blockedIntervalId), { isBlocked: false, originalMatchId: null }, { merge: true });
            await showMessage('Úspech', 'Interval bol úspešne odblokovaný!');
            console.log(`[unblockBlockedInterval] Interval ID ${blockedIntervalId} aktualizovaný na odblokovaný.`);
            closeModal(freeIntervalModal);
            // Prepočítaj rozvrh pre daný dátum a miesto, aby sa zohľadnila zmena
            await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, allSettings);
            console.log("[unblockBlockedInterval] Rozvrh prepočítaný po odblokovaní intervalu.");
        } catch (error) {
            console.error("[unblockBlockedInterval] Chyba pri odblokovaní intervalu:", error);
            await showMessage('Chyba', `Chyba pri odblokovaní intervalu: ${error.message}`);
        }
    } else {
        console.log("[unblockBlockedInterval] Odblokovanie intervalu zrušené používateľom.");
    }
}

/**
 * Vymaže zablokovaný interval.
 * @param {string} blockedIntervalId ID zablokovaného intervalu.
 * @param {string} date Dátum intervalu.
 * @param {string} location Miesto intervalu.
 * @param {object} allSettings Všetky nastavenia turnaja.
 */
async function handleDeleteInterval(blockedIntervalId, date, location, allSettings) {
    console.log(`[handleDeleteInterval] Volané. ID: ${blockedIntervalId}`);
    const freeIntervalModal = document.getElementById('freeSlotModal');

    const confirmed = await showConfirmation(
        'Potvrdenie vymazania',
        'Naozaj chcete vymazať tento interval? Ak bol vytvorený automaticky, môže sa znova objaviť.'
    );

    if (confirmed) {
        try {
            await deleteDoc(doc(blockedSlotsCollectionRef, blockedIntervalId));
            await showMessage('Úspech', 'Interval bol úspešne vymazaný!');
            console.log(`[handleDeleteInterval] Interval ID ${blockedIntervalId} vymazaný.`);
            closeModal(freeIntervalModal);
            // Prepočítaj rozvrh pre daný dátum a miesto, aby sa zohľadnila zmena
            await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, allSettings);
            console.log("[handleDeleteInterval] Rozvrh prepočítaný po vymazaní intervalu.");
        } catch (error) {
            console.error("[handleDeleteInterval] Chyba pri mazaní intervalu:", error);
            await showMessage('Chyba', `Chyba pri mazaní intervalu: ${error.message}`);
        }
    } else {
        console.log("[handleDeleteInterval] Vymazanie intervalu zrušené používateľom.");
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    // Kontrola prihláseného používateľa
    const loggedInUsername = localStorage.getItem('username');
    if (!loggedInUsername || loggedInUsername !== 'admin') {
        //window.location.href = 'login.html';
        window.location.href = 'spravca-turnaja-zapasy.html';
        return;
    }

    const addMatchButton = document.getElementById('addMatchButton');
    const addPlayingDayButton = document.getElementById('addPlayingDayButton');
    const addPlaceButton = document.getElementById('addPlaceButton');

    const matchModal = document.getElementById('matchModal');
    const closeMatchModalButton = document.getElementById('closeMatchModal');
    const matchForm = document.getElementById('matchForm');
    const matchIdInput = document.getElementById('matchId');
    const matchDateSelect = document.getElementById('matchDateSelect');
    const matchLocationSelect = document.getElementById('matchLocationSelect');
    const matchStartTimeInput = document.getElementById('matchStartTime');
    const matchDurationInput = document.getElementById('matchDuration');
    const matchBufferTimeInput = document.getElementById('matchBufferTime');
    const matchCategorySelect = document.getElementById('matchCategory');
    const matchGroupSelect = document.getElementById('matchGroup');
    const team1NumberInput = document.getElementById('team1NumberInput');
    const team2NumberInput = document.getElementById('team2NumberInput');
    const matchStatus = document.getElementById('matchStatus');

    const playingDayModal = document.getElementById('playingDayModal');
    const closePlayingDayModalButton = document.getElementById('closePlayingDayModal');
    const playingDayForm = document.getElementById('playingDayForm');
    const playingDayIdInput = document.getElementById('playingDayId');
    const playingDayDateInput = document.getElementById('playingDayDate');
    const playingDayStatus = document.getElementById('playingDayStatus');

    const placeModal = document.getElementById('placeModal');
    const closePlaceModalButton = document.getElementById('closePlaceModal');
    const placeForm = document.getElementById('placeForm');
    const placeIdInput = document.getElementById('placeId');
    const placeTypeSelect = document.getElementById('placeTypeSelect');
    const placeNameInput = document.getElementById('placeName');
    const placeAddressInput = document.getElementById('placeAddress');
    const placeGoogleMapsUrlInput = document.getElementById('placeGoogleMapsUrl');
    const placeStatus = document.getElementById('placeStatus');

    const freeSlotModal = document.getElementById('freeSlotModal');
    const closeFreeSlotModalButton = document.getElementById('closeFreeSlotModal');
    const addMatchFromFreeSlotButton = document.getElementById('addMatchFromFreeSlotButton');
    const blockFreeSlotButton = document.getElementById('blockFreeSlotButton');
    const unblockFreeSlotButton = document.getElementById('unblockFreeSlotButton');
    const phantomSlotDeleteButton = document.getElementById('phantomSlotDeleteButton');

    let currentAllSettings = {}; // Uloží globálne nastavenia a nastavenia kategórií

    // OnSnapshot listener pre nastavenia
    onSnapshot(doc(settingsCollectionRef, SETTINGS_DOC_ID), async (docSnapshot) => {
        console.log("[onSnapshot - settingsCollectionRef] Zmena v nastaveniach detekovaná.");
        currentAllSettings = docSnapshot.data() || {};
        
        // Načítaj aj nastavenia kategórií a pridaj ich do currentAllSettings
        const categoriesSnapshot = await getDocs(categoriesCollectionRef);
        const categoryMatchSettings = {};
        categoriesSnapshot.forEach(catDoc => {
            const catData = catDoc.data();
            categoryMatchSettings[catDoc.id] = {
                n: catData.n || 0,
                t: catData.t || 0,
                p: catData.p || 0,
                z: catData.z || 0,
                duration: catData.duration || 60,
                bufferTime: catData.bufferTime || 5,
                color: catData.color || '#000000'
            };
        });
        currentAllSettings.categoryMatchSettings = categoryMatchSettings;
        console.log("[onSnapshot - settingsCollectionRef] Aktualizované currentAllSettings:", currentAllSettings);

        // Znovu zobraz rozvrh s aktualizovanými nastaveniami
        await displayMatchesAsSchedule(currentAllSettings);
    }, (error) => {
        console.error("Chyba pri načítaní nastavení v onSnapshot:", error);
        document.getElementById('matchesContainer').innerHTML = `<p style="color: red; text-align: center;">Chyba pri načítaní nastavení: ${error.message}</p>`;
    });

    // OnSnapshot listener pre zápasy (pre okamžité aktualizácie po úpravách zápasov)
    onSnapshot(matchesCollectionRef, async (snapshot) => {
        console.log("[onSnapshot - matchesCollectionRef] Zmena v zápasoch detekovaná. Znovu zobrazujem rozvrh.");
        // Netreba tu volať recalculateAndSaveScheduleForDateAndLocation, pretože táto funkcia je volaná
        // priamo pri úpravách/presunoch/vymazaniach zápasov.
        // Stačí len znova zobraziť rozvrh s aktuálnymi dátami.
        await displayMatchesAsSchedule(currentAllSettings);
    }, (error) => {
        console.error("Chyba pri načítaní zápasov v onSnapshot:", error);
        document.getElementById('matchesContainer').innerHTML = `<p style="color: red; text-align: center;">Chyba pri načítaní zápasov: ${error.message}</p>`;
    });

    // OnSnapshot listener pre zablokované sloty (pre okamžité aktualizácie)
    onSnapshot(blockedSlotsCollectionRef, async (snapshot) => {
        console.log("[onSnapshot - blockedSlotsCollectionRef] Zmena v zablokovaných slotoch detekovaná. Znovu zobrazujem rozvrh.");
        await displayMatchesAsSchedule(currentAllSettings);
    }, (error) => {
        console.error("Chyba pri načítaní zablokovaných slotov v onSnapshot:", error);
        document.getElementById('matchesContainer').innerHTML = `<p style="color: red; text-align: center;">Chyba pri načítaní zablokovaných slotov: ${error.message}</p>`;
    });

    // OnSnapshot listener pre hracie dni (pre okamžité aktualizácie)
    onSnapshot(playingDaysCollectionRef, async (snapshot) => {
        console.log("[onSnapshot - playingDaysCollectionRef] Zmena v hracích dňoch detekovaná. Znovu zobrazujem rozvrh.");
        await displayMatchesAsSchedule(currentAllSettings);
    }, (error) => {
        console.error("Chyba pri načítaní hracích dní v onSnapshot:", error);
        document.getElementById('matchesContainer').innerHTML = `<p style="color: red; text-align: center;">Chyba pri načítaní hracích dní: ${error.message}</p>`;
    });

    // OnSnapshot listener pre miesta (pre okamžité aktualizácie)
    onSnapshot(placesCollectionRef, async (snapshot) => {
        console.log("[onSnapshot - placesCollectionRef] Zmena v miestach detekovaná. Znovu zobrazujem rozvrh.");
        await displayMatchesAsSchedule(currentAllSettings);
    }, (error) => {
        console.error("Chyba pri načítaní miest v onSnapshot:", error);
        document.getElementById('matchesContainer').innerHTML = `<p style="color: red; text-align: center;">Chyba pri načítaní miest: ${error.message}</p>`;
    });

    // Event Listeners pre tlačidlá
    addMatchButton.addEventListener('click', () => openMatchModal(null, currentAllSettings));
    addPlayingDayButton.addEventListener('click', () => {
        playingDayIdInput.value = '';
        playingDayDateInput.value = '';
        playingDayStatus.textContent = '';
        document.getElementById('playingDayModalTitle').textContent = 'Pridať nový hrací deň';
        document.getElementById('deletePlayingDayButtonModal').style.display = 'none';
        openModal(playingDayModal);
    });
    addPlaceButton.addEventListener('click', () => {
        placeIdInput.value = '';
        placeTypeSelect.value = '';
        placeNameInput.value = '';
        placeAddressInput.value = '';
        placeGoogleMapsUrlInput.value = '';
        placeStatus.textContent = '';
        document.getElementById('placeModalTitle').textContent = 'Pridať nové miesto';
        document.getElementById('deletePlaceButtonModal').style.display = 'none';
        openModal(placeModal);
    });

    // Zatváranie modálnych okien
    closeMatchModalButton.addEventListener('click', () => closeModal(matchModal));
    closePlayingDayModalButton.addEventListener('click', () => closeModal(playingDayModal));
    closePlaceModalButton.addEventListener('click', () => closeModal(placeModal));
    closeFreeSlotModalButton.addEventListener('click', () => closeModal(freeSlotModal));

    // Dynamické načítanie skupín na základe vybranej kategórie
    matchCategorySelect.addEventListener('change', async () => {
        const selectedCategoryId = matchCategorySelect.value;
        console.log(`[matchCategorySelect.change] Vybraná kategória: ${selectedCategoryId}`);
        await populateGroupSelect(selectedCategoryId, matchGroupSelect);
        await updateMatchDurationAndBuffer(currentAllSettings); // Aktualizuj trvanie a buffer
        await findFirstAvailableTime(currentAllSettings); // Nájdi nový dostupný čas
        
        // Povoľ/zakáž polia pre čísla tímov
        if (selectedCategoryId) {
            team1NumberInput.disabled = false;
            team2NumberInput.disabled = false;
            console.log("[matchCategorySelect.change] Kategória vybraná. Tímy povolené.");
        } else {
            team1NumberInput.disabled = true;
            team2NumberInput.disabled = true;
            team1NumberInput.value = '';
            team2NumberInput.value = '';
            console.log("[matchCategorySelect.change] Kategória nevybraná. Tímy zakázané a vymazané.");
        }
    });

    // Dynamické hľadanie prvého dostupného času pri zmene dátumu alebo miesta
    matchDateSelect.addEventListener('change', () => findFirstAvailableTime(currentAllSettings));
    matchLocationSelect.addEventListener('change', () => findFirstAvailableTime(currentAllSettings));

    // Uloženie zápasu
    matchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        matchStatus.textContent = 'Ukladám zápas...';
        matchStatus.style.color = 'orange';

        const matchId = matchIdInput.value;
        const date = matchDateSelect.value;
        const location = matchLocationSelect.value;
        const startTime = matchStartTimeInput.value;
        const duration = parseInt(matchDurationInput.value);
        const bufferTime = parseInt(matchBufferTimeInput.value);
        const categoryId = matchCategorySelect.value;
        const groupId = matchGroupSelect.value;
        const team1Number = parseInt(team1NumberInput.value);
        const team2Number = parseInt(team2NumberInput.value);

        if (!date || !location || !startTime || isNaN(duration) || isNaN(bufferTime) || !categoryId || !groupId || isNaN(team1Number) || isNaN(team2Number)) {
            matchStatus.textContent = 'Prosím, vyplňte všetky povinné polia.';
            matchStatus.style.color = 'red';
            return;
        }

        const locationType = placesCollectionRef.id; // Predpokladáme, že všetky miesta sú "Športová hala" pre zápasy

        const matchData = {
            date,
            location,
            locationType: 'Športová hala', // Explicitne nastavené na Športová hala
            startTime,
            duration,
            bufferTime,
            categoryId,
            groupId,
            team1Number,
            team2Number
        };

        try {
            if (matchId) {
                await setDoc(doc(matchesCollectionRef, matchId), matchData, { merge: true });
                matchStatus.textContent = 'Zápas úspešne aktualizovaný!';
                console.log(`[matchForm.submit] Zápas ID ${matchId} aktualizovaný.`);
            } else {
                await addDoc(matchesCollectionRef, matchData);
                matchStatus.textContent = 'Zápas úspešne pridaný!';
                console.log("[matchForm.submit] Nový zápas pridaný.");
            }
            matchStatus.style.color = 'green';
            closeModal(matchModal);
            
            // Prepočítaj rozvrh pre daný dátum a miesto
            await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, currentAllSettings);
            console.log("[matchForm.submit] Rozvrh prepočítaný po uložení zápasu.");

        } catch (error) {
            console.error("Chyba pri ukladaní zápasu: ", error);
            matchStatus.textContent = 'Chyba pri ukladaní zápasu. Pozrite si konzolu pre detaily.';
            matchStatus.style.color = 'red';
        }
    });

    // Uloženie hracieho dňa
    playingDayForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        playingDayStatus.textContent = 'Ukladám hrací deň...';
        playingDayStatus.style.color = 'orange';

        const playingDayId = playingDayIdInput.value;
        const date = playingDayDateInput.value;

        if (!date) {
            playingDayStatus.textContent = 'Prosím, zadajte dátum.';
            playingDayStatus.style.color = 'red';
            return;
        }

        try {
            const existingPlayingDayQuery = query(playingDaysCollectionRef, where("date", "==", date));
            const existingPlayingDaySnapshot = await getDocs(existingPlayingDayQuery);

            if (playingDayId) { // Úprava existujúceho
                if (!existingPlayingDaySnapshot.empty && existingPlayingDaySnapshot.docs[0].id !== playingDayId) {
                    playingDayStatus.textContent = 'Dátum už existuje pre iný hrací deň.';
                    playingDayStatus.style.color = 'red';
                    return;
                }
                await setDoc(doc(playingDaysCollectionRef, playingDayId), { date });
                playingDayStatus.textContent = 'Hrací deň úspešne aktualizovaný!';
            } else { // Pridanie nového
                if (!existingPlayingDaySnapshot.empty) {
                    playingDayStatus.textContent = 'Hrací deň s týmto dátumom už existuje.';
                    playingDayStatus.style.color = 'red';
                    return;
                }
                await addDoc(playingDaysCollectionRef, { date });
                playingDayStatus.textContent = 'Hrací deň úspešne pridaný!';
            }
            playingDayStatus.style.color = 'green';
            closeModal(playingDayModal);
        } catch (error) {
            console.error("Chyba pri ukladaní hracieho dňa: ", error);
            playingDayStatus.textContent = 'Chyba pri ukladaní hracieho dňa. Pozrite si konzolu pre detaily.';
            playingDayStatus.style.color = 'red';
        }
    });

    // Uloženie miesta
    placeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        placeStatus.textContent = 'Ukladám miesto...';
        placeStatus.style.color = 'orange';

        const placeId = placeIdInput.value;
        const type = placeTypeSelect.value;
        const name = placeNameInput.value;
        const address = placeAddressInput.value;
        const googleMapsUrl = placeGoogleMapsUrlInput.value;

        if (!type || !name) {
            placeStatus.textContent = 'Prosím, vyplňte typ a názov miesta.';
            placeStatus.style.color = 'red';
            return;
        }

        try {
            const existingPlaceQuery = query(placesCollectionRef, where("name", "==", name), where("type", "==", type));
            const existingPlaceSnapshot = await getDocs(existingPlaceQuery);

            if (placeId) { // Úprava existujúceho
                if (!existingPlaceSnapshot.empty && existingPlaceSnapshot.docs[0].id !== placeId) {
                    placeStatus.textContent = 'Miesto s týmto názvom a typom už existuje.';
                    placeStatus.style.color = 'red';
                    return;
                }
                await setDoc(doc(placesCollectionRef, placeId), { type, name, address, googleMapsUrl });
                placeStatus.textContent = 'Miesto úspešne aktualizované!';
            } else { // Pridanie nového
                if (!existingPlaceSnapshot.empty) {
                    placeStatus.textContent = 'Miesto s týmto názvom a typom už existuje.';
                    placeStatus.style.color = 'red';
                    return;
                }
                await addDoc(placesCollectionRef, { type, name, address, googleMapsUrl });
                placeStatus.textContent = 'Miesto úspešne pridané!';
            }
            placeStatus.style.color = 'green';
            closeModal(placeModal);
        } catch (error) {
            console.error("Chyba pri ukladaní miesta: ", error);
            placeStatus.textContent = 'Chyba pri ukladaní miesta. Pozrite si konzolu pre detaily.';
            placeStatus.style.color = 'red';
        }
    });
});

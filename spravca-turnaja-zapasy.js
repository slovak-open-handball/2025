import { db, categoriesCollectionRef, groupsCollectionRef, clubsCollectionRef, matchesCollectionRef, playingDaysCollectionRef, placesCollectionRef, openModal, closeModal, populateCategorySelect, populateGroupSelect, getDocs, doc, setDoc, addDoc, getDoc, query, where, orderBy, deleteDoc, writeBatch, settingsCollectionRef, showMessage, showConfirmation } from './spravca-turnaja-common.js';
import { collection, deleteField, limit } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';


const SETTINGS_DOC_ID = 'matchTimeSettings';
export const blockedSlotsCollectionRef = collection(db, 'tournamentData', 'mainTournamentData', 'blockedSlots');

/**
 * Animuje daný text tak, že ho postupne vypíše, zhrubí a potom postupne vymaže, v nekonečnej slučke.
 * @param {string} containerId ID HTML elementu, kde sa má zobraziť animovaný text.\
 * @param {string} text Reťazec textu, ktorý sa má animovať.
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
            /* Updated styles for buttons in modals */
            .modal-content button[type="submit"],
            .modal-content button.action-button,
            .modal-content button.delete-button {
                width: calc(100% - 22px); /* Extends to full width of input box */
                box-sizing: border-box; /* Includes padding and border in width */
                margin-top: 15px; /* Space above button */
            }
            .modal-content button.delete-button {
                margin-left: -1px;
            }
        `;
        document.head.appendChild(style);
    }

    let animationId;
    let charIndex = 0;
    let bolding = false;
    let typingDirection = 1; // 1 for typing, -1 for untyping

    const typeSpeed = 70;
    const unTypeSpeed = 50;
    const boldDuration = 500;
    const pauseDuration = 1000;

    const animate = () => {
        if (typingDirection === 1) { // Typing out
            if (charIndex < charElements.length) {
                charElements[charIndex].classList.add('visible');
                charIndex++;
                animationId = setTimeout(animate, typeSpeed);
            } else { // Done typing, start bolding
                bolding = true;
                charElements.forEach(span => span.classList.add('bold'));
                animationId = setTimeout(() => {
                    bolding = false;
                    typingDirection = -1; // Start untyping
                    animationId = setTimeout(animate, pauseDuration); // Pause before untyping
                }, boldDuration);
            }
        } else { // Untyping
            if (charIndex > 0) {
                charIndex--;
                charElements[charIndex].classList.remove('bold');
                charElements[charIndex].classList.remove('visible');
                animationId = setTimeout(animate, unTypeSpeed);
            } else { // Done untyping, reset and start typing again
                typingDirection = 1;
                animationId = setTimeout(animate, pauseDuration); // Pause before retyping
            }
        }
    };

    animate();

    // Return a function to stop the animation
    return () => {
        clearTimeout(animationId);
        container.innerHTML = ''; // Clear content
    };
}


/**
 * Populates a select element with playing day dates.
 * @param {HTMLSelectElement} selectElement The select element to populate.
 * @param {string} selectedDate The date to pre-select.
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
 * Populates a select element with sports hall names.
 * @param {HTMLSelectElement} selectElement The select element to populate.
 * @param {string} selectedPlaceName The name of the sports hall to pre-select.
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
 * Populates a select element with all place names.
 * @param {HTMLSelectElement} selectElement The select element to populate.
 * @param {string} selectedPlaceCombined The combined place name and type to pre-select.
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
 * Gets match settings for a specific category.
 * @param {string} categoryId The ID of the category.
 * @returns {object} An object containing duration and bufferTime.
 */
async function getCategoryMatchSettings(categoryId) {
    try {
        const settingsDocRef = doc(settingsCollectionRef, SETTINGS_DOC_ID);
        const settingsDoc = await getDoc(settingsDocRef);
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            const categorySettings = data.categoryMatchSettings && data.categoryMatchSettings[categoryId];
            if (categorySettings) {
                return {
                    duration: categorySettings.duration || 60,
                    bufferTime: categorySettings.bufferTime || 5
                };
            }
        }
    } catch (error) {
        console.error("Chyba pri načítaní nastavení kategórie:", error);
    }
    return { duration: 60, bufferTime: 5 };
}

/**
 * Updates match duration and buffer inputs based on selected category settings.
 */
async function updateMatchDurationAndBuffer() {
    const matchDurationInput = document.getElementById('matchDuration');
    const matchBufferTimeInput = document.getElementById('matchBufferTime');
    const matchCategorySelect = document.getElementById('matchCategory');

    const selectedCategoryId = matchCategorySelect.value;

    if (selectedCategoryId) {
        const settings = await getCategoryMatchSettings(selectedCategoryId);
        matchDurationInput.value = settings.duration;
        matchBufferTimeInput.value = settings.bufferTime;
    } else {
        matchDurationInput.value = 60;
        matchBufferTimeInput.value = 5;
    }
}

/**
 * Finds the first available time slot for a match based on existing matches and blocked intervals.
 * This function is designed to always suggest the earliest possible time,
 * prioritizing explicit "Voľný slot dostupný" entries if they don't overlap with fixed events.
 * It does NOT consider if the match "fits" into the suggested slot; `recalculateAndSaveScheduleForDateAndLocation`
 * handles pushing subsequent events if the match overflows.
 */
async function findFirstAvailableTime() {
    const matchDateSelect = document.getElementById('matchDateSelect');
    const matchLocationSelect = document.getElementById('matchLocationSelect');
    const matchStartTimeInput = document.getElementById('matchStartTime');
    // matchDurationInput and matchBufferTimeInput are used for overall timeline calculation,
    // but not for determining the *earliest possible start* for the suggestion itself.

    console.log("findFirstAvailableTime called.");
    const selectedDate = matchDateSelect.value;
    const selectedLocationName = matchLocationSelect.value;

    console.log("Selected Date:", selectedDate);
    console.log("Selected Location:", selectedLocationName);

    if (!selectedDate || !selectedLocationName) {
        matchStartTimeInput.value = '';
        console.log("Date or Location empty, clearing start time and returning.");
        return;
    }

    // Skip time finding if "Nezadaná hala" is selected, as it's unassigned
    if (selectedLocationName === 'Nezadaná hala') {
        matchStartTimeInput.value = '00:00'; // Default to 00:00 for unassigned matches
        console.log("Location is 'Nezadaná hala', skipping time finding logic and setting to 00:00.");
        return;
    }

    try {
        // Get initial start time for the day from settings
        const initialScheduleStartMinutes = await getInitialScheduleStartMinutes(selectedDate);
        console.log("Initial pointer minutes for selected day (from settings):", initialScheduleStartMinutes);

        // Fetch all matches for the selected date and location
        const matchesQuery = query(
            matchesCollectionRef,
            where("date", "==", selectedDate),
            where("location", "==", selectedLocationName)
        );
        const matchesSnapshot = await getDocs(matchesQuery);
        const matches = matchesSnapshot.docs.map(doc => {
            const data = doc.data();
            const startInMinutes = (parseInt(data.startTime.split(':')[0]) * 60 + parseInt(data.startTime.split(':')[1]));
            const duration = Number(data.duration) || 0;
            const bufferTime = Number(data.bufferTime) || 0;
            return {
                id: doc.id,
                start: startInMinutes,
                end: startInMinutes + duration + bufferTime, // Match's full footprint end
                type: 'match'
            };
        });
        console.log("Fetched matches for time finding:", matches.map(m => ({id: m.id, start: m.start, end: m.end})));

        // Fetch all blocked intervals (both blocked and free placeholders)
        const blockedIntervalsQuery = query(
            blockedSlotsCollectionRef,
            where("date", "==", selectedDate),
            where("location", "==", selectedLocationName)
        );
        const blockedIntervalsSnapshot = await getDocs(blockedIntervalsQuery);
        const allIntervals = blockedIntervalsSnapshot.docs.map(doc => {
            const data = doc.data();
            const startInMinutes = (parseInt(data.startTime.split(':')[0]) * 60 + parseInt(data.startTime.split(':')[1]));
            const endInMinutes = (parseInt(data.endTime.split(':')[0]) * 60 + parseInt(data.endTime.split(':')[1]));
            return {
                id: doc.id,
                start: startInMinutes,
                end: endInMinutes,
                type: 'blocked_interval',
                isBlocked: data.isBlocked === true,
                originalMatchId: data.originalMatchId || null
            };
        });
        console.log("Fetched all intervals (blocked/free) for time finding:", allIntervals.map(i => ({id: i.id, start: i.start, end: i.end, isBlocked: i.isBlocked})));

        // Separate fixed (truly occupied) periods from flexible (free) intervals
        let fixedOccupiedPeriods = [];
        matches.forEach(m => fixedOccupiedPeriods.push({ start: m.start, end: m.end }));
        allIntervals.filter(s => s.isBlocked === true || s.originalMatchId).forEach(s => fixedOccupiedPeriods.push({ start: s.start, end: s.end })); // Also include originalMatchId slots as "fixed" for finding gaps

        // Sort and merge fixed occupied periods to get a clean timeline of blocked times
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
        console.log("Merged Fixed Occupied Periods (matches + isBlocked:true + originalMatchId):", mergedFixedOccupiedPeriods);

        let proposedStartTimeInMinutes = -1;

        // Step 1: Prioritize explicit "Voľný slot dostupný" (isBlocked: false, no originalMatchId) intervals
        // This is where a subtle change is needed. These are now purely auto-generated.
        // We want to find the first *actual gap* after initial day start.

        let currentPointer = initialScheduleStartMinutes; // Start checking from the day's configured start time

        for (const occupied of mergedFixedOccupiedPeriods) {
            // If there's a gap between currentPointer and the start of an occupied period
            if (currentPointer < occupied.start) {
                proposedStartTimeInMinutes = currentPointer;
                console.log(`Step 1: Found gap starting at ${proposedStartTimeInMinutes} before fixed occupied period.`);
                break; // Found the first gap, take it
            }
            // Move the pointer past the current occupied period
            currentPointer = Math.max(currentPointer, occupied.end);
        }

        // If no suitable gap was found before any occupied period, check the remaining time after the last occupied period
        if (proposedStartTimeInMinutes === -1 && currentPointer < 24 * 60) {
            proposedStartTimeInMinutes = currentPointer;
            console.log(`Step 1: No earlier gap. Found gap starting at ${proposedStartTimeInMinutes} at the end of the day after fixed obstacles.`);
        }

        // Fallback: If no time was determined (e.g., entire day is theoretically blocked, or no elements)
        // This ensures matchStartTimeInput always gets a value.
        if (proposedStartTimeInMinutes === -1) {
            proposedStartTimeInMinutes = initialScheduleStartMinutes;
            console.log("Fallback: No available time found by logic, defaulting to initial day start time:", proposedStartTimeInMinutes);
        }

        const formattedHour = String(Math.floor(proposedStartTimeInMinutes / 60)).padStart(2, '0');
        const formattedMinute = String(proposedStartTimeInMinutes % 60).padStart(2, '0');
        matchStartTimeInput.value = `${formattedHour}:${formattedMinute}`;
        console.log("Nastavený čas začiatku zápasu:", matchStartTimeInput.value);

    } catch (error) {
        console.error("Chyba pri hľadaní prvého dostupného času:", error);
        matchStartTimeInput.value = ''; // Clear in case of error
    }
}

/**
 * Retrieves the display name, club name, and club ID for a given team.
 * @param {string} categoryId The ID of the category.
 * @param {string} groupId The ID of the group.
 * @param {number} teamNumber The team's order number within the group.
 * @param {Map<string, string>} categoriesMap A map of category IDs to names.
 * @param {Map<string, string>} groupsMap A map of group IDs to names.
 * @returns {Promise<object>} An object containing fullDisplayName, clubName, clubId, and shortDisplayName.
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
 * Recalculates and saves the schedule for a specific date and location, handling moved matches and deleted placeholders.
 * @param {string} date The date of the schedule.
 * @param {string} location The location of the schedule.
 * @param {object|null} insertedMatchInfo Information about the newly inserted/updated match {id, startTime, duration, bufferTime}.
 * @param {string|null} draggedMatchOriginalLocation Original location of the moved match (for recursive cleanup).
 */
async function recalculateAndSaveScheduleForDateAndLocation(
    date,
    location,
    insertedMatchInfo = null,
    draggedMatchOriginalLocation = null
) {
    console.log(`recalculateAndSaveScheduleForDateAndLocation: === SPUSTENÉ pre Dátum: ${date}, Miesto: ${location}. ` +
                `Vložený/Upravený zápas ID: ${insertedMatchInfo ? insertedMatchInfo.id : 'žiadny'}. ` +
                `Pôvodné miesto presunutého zápasu (ak presunutý): ${draggedMatchOriginalLocation || 'žiadny'} ===`);
    try {
        const batch = writeBatch(db); 

        // 1. Fetch all existing matches and blocked/free slots for the given date and location.
        const matchesQuery = query(matchesCollectionRef, where("date", "==", date), where("location", "==", location));
        const matchesSnapshot = await getDocs(matchesQuery);
        let currentMatches = matchesSnapshot.docs.map(doc => {
            const data = doc.data();
            const startInMinutes = (parseInt(data.startTime.split(':')[0]) * 60 + parseInt(data.startTime.split(':')[1]));
            const duration = Number(data.duration) || 0;
            const bufferTime = Number(data.bufferTime) || 0;
            return {
                id: doc.id,
                type: 'match',
                docRef: doc.ref,
                ...data,
                startInMinutes: startInMinutes,
                duration: duration,
                bufferTime: bufferTime
            };
        });

        const blockedSlotsQuery = query(blockedSlotsCollectionRef, where("date", "==", date), where("location", "==", location));
        const blockedSlotsSnapshot = await getDocs(blockedSlotsQuery);
        let currentBlockedAndFreeSlots = blockedSlotsSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'blocked_interval',
            isBlocked: doc.data().isBlocked === true,
            originalMatchId: doc.data().originalMatchId || null,
            docRef: doc.ref,
            ...doc.data(),
            startInMinutes: (parseInt(doc.data().startTime.split(':')[0]) * 60 + parseInt(doc.data().startTime.split(':')[1])),
            endInMinutes: (parseInt(doc.data().endTime.split(':')[0]) * 60 + parseInt(doc.data().endTime.split(':')[1]))
        }));

        // 2. Separate truly fixed events (matches and user-blocked intervals, and 'deleted match' permanent free slots)
        // from auto-generated flexible placeholders that will be re-created.
        let fixedEvents = [];
        let autoGeneratedPlaceholdersToDelete = [];

        currentMatches.forEach(match => fixedEvents.push(match));
        currentBlockedAndFreeSlots.forEach(slot => {
            if (slot.isBlocked === true || slot.originalMatchId) { // User-blocked or 'deleted match' permanent free slot
                fixedEvents.push(slot);
            } else { // Auto-generated temporary free slot (without originalMatchId)
                autoGeneratedPlaceholdersToDelete.push(slot);
            }
        });

        // Delete all old auto-generated free slot placeholders
        for (const placeholder of autoGeneratedPlaceholdersToDelete) {
            batch.delete(placeholder.docRef);
            console.log(`Fáza 1: Pridané do batchu na vymazanie starého auto-generovaného placeholder intervalu ID: ${placeholder.id}`);
        }

        // Add the inserted match to fixedEvents if it's new/moved here and not already in `currentMatches`
        if (insertedMatchInfo && !fixedEvents.some(e => e.id === insertedMatchInfo.id)) {
            const newMatchDoc = await getDoc(doc(matchesCollectionRef, insertedMatchInfo.id));
            if (newMatchDoc.exists()) {
                 const data = newMatchDoc.data();
                 fixedEvents.push({
                    id: newMatchDoc.id,
                    type: 'match',
                    docRef: newMatchDoc.ref,
                    ...data,
                    startInMinutes: (parseInt(data.startTime.split(':')[0]) * 60 + parseInt(data.startTime.split(':')[1])),
                    duration: Number(data.duration) || 0,
                    bufferTime: Number(data.bufferTime) || 0
                });
                console.log(`Fáza 1: Pridaný novo vložený/presunutý zápas do fixedEvents: ${insertedMatchInfo.id}.`);
            } else {
                console.warn(`Fáza 1: Vložený zápas ${insertedMatchInfo.id} sa nenašiel v DB pri opätovnom načítavaní.`)
            }
        }
        
        // Ensure the inserted match's start time in the DB reflects the droppedProposedStartTime
        // This is done BEFORE sorting and re-calculation to ensure the base data is correct.
        if (insertedMatchInfo) {
            const matchDocRef = doc(matchesCollectionRef, insertedMatchInfo.id);
            // This set ensures the `startTime` is what was dropped, regardless of overlaps here.
            // Overlaps will be handled by pushing subsequent events.
            batch.update(matchDocRef, { startTime: insertedMatchInfo.startTime });
            console.log(`Fáza 2: Zápas ID: ${insertedMatchInfo.id} aktualizovaný v batchi na pevný čas: ${insertedMatchInfo.startTime}.`);
        }

        // Sort all fixed events chronologically
        fixedEvents.sort((a, b) => {
            if (a.startInMinutes !== b.startInMinutes) {
                return a.startInMinutes - b.startInMinutes;
            }
            // Prioritize matches over blocked intervals if they start at the same time
            if (a.type === 'match' && b.type === 'blocked_interval') return -1;
            if (a.type === 'blocked_interval' && b.type === 'match') return 1;
            return 0; // Maintain original order if times and types are same
        });
        console.log(`Fáza 2: Zoradené fixedEvents pre ${date}, ${location}:`, fixedEvents.map(e => ({id: e.id, type: e.type, startInMinutes: e.startInMinutes, isBlocked: e.isBlocked || 'N/A', originalMatchId: e.originalMatchId || 'N/A'})));

        const initialScheduleStartMinutes = await getInitialScheduleStartMinutes(date);
        let currentTimePointer = initialScheduleStartMinutes;
        console.log(`Fáza 2: Počiatočný ukazovateľ času (currentTimePointer): ${currentTimePointer} minút.`);

        // 3. Iterate through sorted fixed events to build the final timeline and create new placeholders.
        for (const event of fixedEvents) {
            console.log(`Fáza 3: SPRACÚVAM udalosť: ID: ${event.id || 'N/A'}, Typ: ${event.type}, Start (min): ${event.startInMinutes}, Aktuálny currentTimePointer: ${currentTimePointer}`);

            // If there's a gap before the current fixed event, create a 'free interval available' placeholder
            if (currentTimePointer < event.startInMinutes) {
                const gapStart = currentTimePointer;
                const gapEnd = event.startInMinutes;
                const formattedGapStartTime = `${String(Math.floor(gapStart / 60)).padStart(2, '0')}:${String(gapStart % 60).padStart(2, '0')}`;
                const formattedGapEndTime = `${String(Math.floor(gapEnd / 60)).padStart(2, '0')}:${String(Math.floor(gapEnd % 60)).padStart(2, '0')}`;
                
                const newPlaceholderRef = doc(blockedSlotsCollectionRef);
                batch.set(newPlaceholderRef, {
                    date: date,
                    location: location,
                    startTime: formattedGapStartTime,
                    endTime: formattedGapEndTime,
                    isBlocked: false,
                    startInMinutes: gapStart,
                    endInMinutes: gapEnd,
                    originalMatchId: null, // This is a general gap, not from a deleted match
                    createdAt: new Date()
                });
                console.log(`Fáza 3: VYTVORENÝ nový voľný interval (medzera): ${formattedGapStartTime}-${formattedGapEndTime}.`);
            }

            // Process the current fixed event
            let eventFootprintEndInMinutes;
            if (event.type === 'match') {
                let actualMatchStartInMinutes = event.startInMinutes;
                // If this match needs to be pushed due to an earlier event or current pointer
                if (actualMatchStartInMinutes < currentTimePointer) {
                    actualMatchStartInMinutes = currentTimePointer;
                    const newStartTime = `${String(Math.floor(actualMatchStartInMinutes / 60)).padStart(2, '0')}:${String(actualMatchStartInMinutes % 60).padStart(2, '0')}`;
                    batch.update(event.docRef, { startTime: newStartTime });
                    console.log(`Fáza 3: Zápas ${event.id} POSUNUTÝ na: ${newStartTime} (z dôvodu prekrývania).`);
                }
                eventFootprintEndInMinutes = actualMatchStartInMinutes + event.duration + event.bufferTime;
            } else if (event.type === 'blocked_interval' && event.isBlocked === true) { // User-blocked interval
                // If a fixed blocked interval is now overlapped, remove it.
                if (event.startInMinutes < currentTimePointer) {
                    batch.delete(event.docRef);
                    console.log(`Fáza 3: Zablokovaný interval ${event.id} (pevný) bol prekrývaný, pridaný do batchu na vymazanie.`);
                    // This interval is effectively consumed, don't advance pointer based on it.
                    eventFootprintEndInMinutes = currentTimePointer; // Effectively, it ends where current time pointer is.
                } else {
                    eventFootprintEndInMinutes = event.endInMinutes;
                    console.log(`Fáza 3: Zablokovaný interval ID: ${event.id} je pevný, ukazovateľ posunutý na: ${eventFootprintEndInMinutes}.`);
                }
            } else if (event.type === 'blocked_interval' && event.originalMatchId) { // 'Deleted match' permanent free slot
                // These are also fixed. If overlapped, delete.
                if (event.startInMinutes < currentTimePointer) {
                     batch.delete(event.docRef);
                     console.log(`Fáza 3: Voľný interval ${event.id} (z vymazaného zápasu) bol prekrývaný, pridaný do batchu na vymazanie.`);
                     eventFootprintEndInMinutes = currentTimePointer;
                } else {
                    eventFootprintEndInMinutes = event.endInMinutes;
                    console.log(`Fáza 3: Voľný interval ID: ${event.id} (z vymazaného zápasu) je pevný, ukazovateľ posunutý na: ${eventFootprintEndInMinutes}.`);
                }
            }

            // Advance the timeline pointer
            currentTimePointer = Math.max(currentTimePointer, eventFootprintEndInMinutes);
            console.log(`Fáza 3: Po spracovaní udalosti ${event.id || 'N/A'}, currentTimePointer je teraz: ${currentTimePointer}`);
        }

        // 4. Create a final 'free interval available' placeholder if there's space until end of day
        if (currentTimePointer < 24 * 60) {
            const gapStart = currentTimePointer;
            const gapEnd = 24 * 60;
            const formattedGapStartTime = `${String(Math.floor(gapStart / 60)).padStart(2, '0')}:${String(gapStart % 60).padStart(2, '0')}`;
            const formattedGapEndTime = `${String(Math.floor(gapEnd / 60)).padStart(2, '0')}:${String(Math.floor(gapEnd % 60)).padStart(2, '0')}`;

            if (gapEnd > gapStart) { // Only create if the gap has a positive duration
                const newPlaceholderRef = doc(blockedSlotsCollectionRef);
                batch.set(newPlaceholderRef, {
                    date: date,
                    location: location,
                    startTime: formattedGapStartTime,
                    endTime: formattedGapEndTime,
                    isBlocked: false,
                    startInMinutes: gapStart,
                    endInMinutes: gapEnd,
                    originalMatchId: null, // This is a general gap
                    createdAt: new Date()
                });
                console.log(`Fáza 4: VYTVORENÝ konečný voľný interval: ${formattedGapStartTime}-${formattedGapEndTime}.`);
            }
        }
        
        await batch.commit();
        console.log(`recalculateAndSaveScheduleForDateAndLocation: Batch commit successful.`);

        // If the match was moved FROM another location, also recalculate that original location's schedule.
        if (draggedMatchOriginalLocation && draggedMatchOriginalLocation !== location) {
            console.log(`recalculateAndSaveScheduleForDateAndLocation: Rekalkulujem pôvodné miesto presunutého zápasu: ${date}, ${draggedMatchOriginalLocation}`);
            // Call this recursively, but without insertedMatchInfo, to clean up the old location.
            await recalculateAndSaveScheduleForDateAndLocation(date, draggedMatchOriginalLocation);
        }

        await displayMatchesAsSchedule();
    } catch (error) {
        console.error("recalculateAndSaveScheduleForDateAndLocation: Chyba pri prepočítavaní a ukladaní rozvrhu:", error);
        await showMessage('Chyba', `Chyba pri prepočítavaní rozvrhu: ${error.message}`);
    }
}

/**
 * Gets the initial schedule start time in minutes for a given date.
 * @param {string} date The date.
 * @returns {Promise<number>} The initial start time in minutes.
 */
async function getInitialScheduleStartMinutes(date) {
    const settingsDocRef = doc(settingsCollectionRef, SETTINGS_DOC_ID);
    const settingsDoc = await getDoc(settingsDocRef);
    let firstDayStartTime = '08:00';
    let otherDaysStartTime = '08:00';

    if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        firstDayStartTime = data.firstDayStartTime || '08:00';
        otherDaysStartTime = data.otherDaysStartTime || '08:00';
    }

    const playingDaysSnapshot = await getDocs(query(playingDaysCollectionRef, orderBy("date", "asc")));
    const sortedPlayingDays = playingDaysSnapshot.docs.map(d => d.data().date).sort();
    const isFirstPlayingDay = sortedPlayingDays.length > 0 && date === sortedPlayingDays[0];

    const initialStartTimeStr = isFirstPlayingDay ? firstDayStartTime : otherDaysStartTime;
    const [initialH, initialM] = initialStartTimeStr.split(':').map(Number);
    return initialH * 60 + initialM;
}

/**
 * Gets match data by match ID.
 * @param {string} matchId The ID of the match.
 * @returns {Promise<object|null>} The match data or null if not found.
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
 * Deletes a match and creates a free interval in its place.
 * @param {string} matchId The ID of the match to delete.
 */
async function deleteMatch(matchId) {
    console.log(`deleteMatch: === DELETE MATCH FUNCTION STARTED ===`);
    console.log(`deleteMatch: Attempting to delete match with ID: ${matchId}`);
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
                console.warn('deleteMatch: Match document not found for ID:', matchId);
                return;
            }

            const matchData = matchDoc.data();
            const date = matchData.date;
            const location = matchData.location;
            const startTime = matchData.startTime;
            const duration = Number(matchData.duration) || 0;
            const bufferTime = Number(matchData.bufferTime) || 0;

            const [startH, startM] = startTime.split(':').map(Number);
            const startInMinutes = startH * 60 + startM;
            const endInMinutes = startInMinutes + duration + bufferTime;
            const endTime = `${String(Math.floor(endInMinutes / 60)).padStart(2, '0')}:${String(endInMinutes % 60).padStart(2, '0')}`;

            const batch = writeBatch(db);
            batch.delete(matchDocRef);
            console.log(`deleteMatch: Added match ${matchId} to batch for deletion.`);

            // Create a new free interval (placeholder) in place of the deleted match
            // This placeholder will have isBlocked: false and an originalMatchId to signify it's a fixed 'empty' slot.
            const newFreeIntervalRef = doc(blockedSlotsCollectionRef);
            const freeIntervalData = {
                date: date,
                location: location,
                startTime: startTime,
                endTime: endTime,
                isBlocked: false, // It's a free interval now
                originalMatchId: matchId, // Store original match ID for reference to make it "permanent"
                startInMinutes: startInMinutes,
                endInMinutes: endInMinutes,
                createdAt: new Date()
            };
            batch.set(newFreeIntervalRef, freeIntervalData);
            console.log(`deleteMatch: Added new free interval to batch for deleted match:`, freeIntervalData);

            await batch.commit();
            await showMessage('Úspech', 'Zápas bol úspešne vymazaný a časový interval bol označený ako voľný!');
            closeModal(matchModal);
            
            // Recalculate schedule for the affected date and location
            await recalculateAndSaveScheduleForDateAndLocation(date, location);
            console.log("deleteMatch: Schedule recalculated and displayed after match deletion.");

        } catch (error) {
            console.error("deleteMatch: Chyba pri mazaní zápasu alebo vytváraní voľného intervalu:", error);
            await showMessage('Chyba', `Chyba pri mazaní zápasu: ${error.message}`);
        }
    } else {
        console.log("deleteMatch: Mazanie zápasu zrušené používateľom.");
    }
}


/**
 * Moves and reschedules a match.
 * @param {string} draggedMatchId The ID of the dragged match.
 * @param {string} targetDate The target date for the match.
 * @param {string} targetLocation The target location for the match.
 * @param {string|null} droppedProposedStartTime The proposed start time after dropping.
 */
async function moveAndRescheduleMatch(draggedMatchId, targetDate, targetLocation, droppedProposedStartTime = null) {
    console.log(`moveAndRescheduleMatch: === SPUSTENÉ pre zápas ID: ${draggedMatchId}, cieľ: ${targetDate}, ${targetLocation}, navrhovaný čas: ${droppedProposedStartTime} ===`);
    try {
        const batch = writeBatch(db);

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
        const originalMatchStartTime = draggedMatchData.startTime;


        // Prepare information for the inserted match (the dragged one)
        const insertedMatchInfo = {
            id: draggedMatchId,
            date: targetDate,
            location: targetLocation,
            startTime: droppedProposedStartTime,
            duration: Number(draggedMatchData.duration) || 0,
            bufferTime: Number(draggedMatchData.bufferTime) || 0
        };

        // Update the dragged match's location and date
        const updatedMatchData = {
            ...draggedMatchData,
            date: targetDate,
            location: targetLocation,
            startTime: droppedProposedStartTime
        };
        batch.set(draggedMatchDocRef, updatedMatchData, { merge: true });
        console.log(`moveAndRescheduleMatch: Pridané do batchu na aktualizáciu/opätovné vloženie zápasu: ${draggedMatchId} s novými dátami:`, updatedMatchData);

        await batch.commit();
        console.log("moveAndRescheduleMatch: Batch commit successful for match move.");

        // Recalculate original schedule first if location/date changed
        // This will clean up any auto-generated free slots in the original location.
        if (originalDate !== targetDate || originalLocation !== targetLocation) {
            await recalculateAndSaveScheduleForDateAndLocation(originalDate, originalLocation); 
            console.log(`moveAndRescheduleMatch: Recalculation for original location (${originalDate}, ${originalLocation}) completed.`);
        }
        // Then recalculate the target schedule with the inserted match information
        await recalculateAndSaveScheduleForDateAndLocation(
            targetDate, 
            targetLocation, 
            insertedMatchInfo, // Pass the info about the dragged match as the inserted one
            originalLocation // Pass original location for recursive cleanup (if target is different)
        ); 
        console.log(`moveAndRescheduleMatch: Recalculation for target location (${targetDate}, ${targetLocation}) completed.`);

        await showMessage('Úspech', 'Zápas úspešne presunutý a rozvrh prepočítaný!');
        closeModal(document.getElementById('messageModal'));
    } catch (error) {
        console.error("moveAndRescheduleMatch: Chyba pri presúvaní a prepočítavaní rozvrhu:", error);
        await showMessage('Chyba', `Chyba pri presúvaní zápasu: ${error.message}.`);
        await displayMatchesAsSchedule();
    }
}

/**
 * Generates a display string for a schedule event (match or blocked interval).
 * @param {object} event The event object.
 * @param {object} allSettings All tournament settings.
 * @param {Map<string, string>} categoryColorsMap A map of category IDs to colors.
 * @returns {string} The formatted display string.
 */
function getEventDisplayString(event, allSettings, categoryColorsMap) {
    if (event.type === 'match') {
        const matchDuration = event.duration || (allSettings.categoryMatchSettings?.[event.categoryId]?.duration || 60);
        const displayedMatchEndTimeInMinutes = event.endOfPlayInMinutes; 
        const formattedDisplayedEndTime = `${String(Math.floor(displayedMatchEndTimeInMinutes / 60)).padStart(2, '0')}:${String(displayedMatchEndTimeInMinutes % 60).padStart(2, '0')}`;
        
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
 * Displays matches as a schedule, grouped by location and date.
 */
async function displayMatchesAsSchedule() {
    const matchesContainer = document.getElementById('matchesContainer');
    if (!matchesContainer) return;

    // Store the stop animation function from the previous call
    if (typeof matchesContainer._stopAnimation === 'function') { // Check if it's a function
        matchesContainer._stopAnimation();
        console.log("displayMatchesAsSchedule: Zastavujem predchádzajúcu animáciu.");
    } else {
        console.log("displayMatchesAsSchedule: Predchádzajúca _stopAnimation nebola funkcia alebo bola nedefinovaná:", matchesContainer._stopAnimation);
    }
    matchesContainer.innerHTML = `<p id="loadingAnimationText" style="text-align: center; font-size: 1.2em; color: #555;"></p>`;
    // Store the new stop animation function
    matchesContainer._stopAnimation = animateLoadingText('loadingAnimationText', 'Načítavam zoznam zápasov...');
    console.log("displayMatchesAsSchedule: Nová _stopAnimation priradená:", matchesContainer._stopAnimation);


    console.log('displayMatchesAsSchedule: Spustené načítavanie dát.');

    try {
        const matchesQuery = query(matchesCollectionRef, orderBy("date", "asc"), orderBy("location", "asc"), orderBy("startTime", "asc"));
        const matchesSnapshot = await getDocs(matchesQuery);
        let allMatches = matchesSnapshot.docs.map(doc => ({ id: doc.id, type: 'match', ...doc.data() }));
        console.log("displayMatchesAsSchedule: Načítané zápasy (po fetchData):", JSON.stringify(allMatches.map(m => ({id: m.id, date: m.date, location: m.location, startTime: m.startTime}))));

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

        const updatedMatchesPromises = allMatches.map(async match => {
            const [team1Data, team2Data] = await Promise.allSettled([
                getTeamName(match.categoryId, match.groupId, match.team1Number, categoriesMap, groupsMap),
                getTeamName(match.categoryId, match.groupId, match.team2Number, categoriesMap, groupsMap)
            ]);

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
            };
        });

        allMatches = await Promise.all(updatedMatchesPromises);
        console.log("displayMatchesAsSchedule: Všetky zápasy s naplnenými zobrazovanými názvami:", JSON.stringify(allMatches.map(m => ({id: m.id, date: m.date, location: m.location, startTime: m.startTime, team1DisplayName: m.team1DisplayName}))));

        const playingDaysSnapshot = await getDocs(query(playingDaysCollectionRef, orderBy("date", "asc")));
        const allPlayingDayDates = playingDaysSnapshot.docs.map(doc => doc.data().date);
        allPlayingDayDates.sort();
        console.log("displayMatchesAsSchedule: Načítané hracie dni (len dátumy):", allPlayingDayDates);

        const sportHallsSnapshot = await getDocs(query(placesCollectionRef, where("type", "==", "Športová hala"), orderBy("name", "asc")));
        const allSportHalls = sportHallsSnapshot.docs.map(doc => doc.data().name);
        console.log("displayMatchesAsSchedule: Načítané športové haly:", allSportHalls);

        const settingsDocRef = doc(settingsCollectionRef, SETTINGS_DOC_ID);
        const settingsDoc = await getDoc(settingsDocRef);
        let globalFirstDayStartTime = '08:00';
        let globalOtherDaysStartTime = '08:00';
        let allSettings = {};
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            globalFirstDayStartTime = data.firstDayStartTime || '08:00';
            globalOtherDaysStartTime = data.otherDaysStartTime || '08:00';
            allSettings = data;
        }
        console.log(`displayMatchesAsSchedule: Globálny čas začiatku (prvý deň): ${globalFirstDayStartTime}, (ostatné dni): ${globalOtherDaysStartTime}`);

        const blockedIntervalsSnapshot = await getDocs(query(blockedSlotsCollectionRef));
        const allBlockedIntervals = blockedIntervalsSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            type: 'blocked_interval',
            isBlocked: doc.data().isBlocked === true,
            originalMatchId: doc.data().originalMatchId || null, // Keep track of original match ID
            ...doc.data(),
            startInMinutes: (parseInt(doc.data().startTime.split(':')[0]) * 60) + parseInt(doc.data().startTime.split(':')[1]),
            endInMinutes: (parseInt(doc.data().endTime.split(':')[0]) * 60) + parseInt(doc.data().endTime.split(':')[1])
        }));
        console.log("displayMatchesAsSchedule: Načítané zablokované intervaly:", JSON.stringify(allBlockedIntervals.map(s => ({id: s.id, date: s.date, location: s.location, startTime: s.startTime, endTime: s.endTime, isBlocked: s.isBlocked, originalMatchId: s.originalMatchId}))));


        const groupedMatches = new Map();
        const unassignedMatches = []; // New array for matches without a hall

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
                unassignedMatches.push(match); // Add to unassigned matches
                console.warn(`displayMatchesAsSchedule: Zápas ${match.id} s neplatným typom miesta "${match.locationType}" bol preskočený z rozvrhu športových hál.`);
            }
        });
        console.log('displayMatchesAsSchedule: Zoskupené zápasy (podľa miesta a dátumu):', groupedMatches);
        console.log('displayMatchesAsSchedule: Nezadané zápasy:', unassignedMatches); // Log unassigned matches


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
                                const startInMinutes = (parseInt(m.startTime.split(':')[0]) * 60 + parseInt(m.startTime.split(':')[1]));
                                const duration = (m.duration || (allSettings.categoryMatchSettings?.[m.categoryId]?.duration || 60));
                                const bufferTime = (m.bufferTime || (allSettings.categoryMatchSettings?.[m.categoryId]?.bufferTime || 5));
                                return {
                                    ...m,
                                    type: 'match',
                                    startInMinutes: startInMinutes,
                                    endOfPlayInMinutes: startInMinutes + duration,
                                    footprintEndInMinutes: startInMinutes + duration + bufferTime,
                                    bufferTime: bufferTime
                                };
                            }),
                            ...allBlockedIntervals.filter(bs => bs.date === date && bs.location === location)
                        ];
                        currentEventsForRendering.sort((a, b) => a.startInMinutes - b.startInMinutes);
                        console.log(`displayMatchesAsSchedule: Udalosti pre render pre ${location} na ${date} (zoradené):`, JSON.stringify(currentEventsForRendering.map(e => ({id: e.id, type: e.type, startTime: e.startTime || e.startInMinutes, endTime: e.endTime || e.endInMinutes, isBlocked: e.isBlocked, originalMatchId: e.originalMatchId, endOfPlayInMinutes: e.endOfPlayInMinutes, footprintEndInMinutes: e.footprintEndInMinutes}))));


                        const finalEventsToRender = [];
                        const initialScheduleStartMinutes = await getInitialScheduleStartMinutes(date); 
                        let currentTimePointerInMinutes = initialScheduleStartMinutes;
                        
                        // Ensure that if there are no events for the day, a placeholder from initial start to end of day is created
                        if (currentEventsForRendering.length === 0) {
                            const gapStart = initialScheduleStartMinutes;
                            const gapEnd = 24 * 60; // End of day
                            const formattedGapStartTime = `${String(Math.floor(gapStart / 60)).padStart(2, '0')}:${String(gapStart % 60).padStart(2, '0')}`;
                            const formattedGapEndTime = `${String(Math.floor(gapEnd / 60)).padStart(2, '0')}:${String(Math.floor(gapEnd % 60)).padStart(2, '0')}`;
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
                                console.log(`displayMatchesAsSchedule: No events for ${date} at ${location}. Adding initial full-day placeholder.`);
                            }
                        } else {
                            for (let i = 0; i < currentEventsForRendering.length; i++) {
                                const event = currentEventsForRendering[i];
                                const eventStart = event.startInMinutes;
                                const eventEnd = event.type === 'match' ? event.footprintEndInMinutes : event.endInMinutes;

                                // Add free interval if there's a gap between the current pointer and the event's start
                                if (currentTimePointerInMinutes < eventStart) {
                                    const gapStart = currentTimePointerInMinutes;
                                    const gapEnd = eventStart;
                                    const formattedGapStartTime = `${String(Math.floor(gapStart / 60)).padStart(2, '0')}:${String(gapStart % 60).padStart(2, '0')}`;
                                    const formattedGapEndTime = `${String(Math.floor(gapEnd / 60)).padStart(2, '0')}:${String(Math.floor(gapEnd % 60)).padStart(2, '0')}`;
                                    
                                    // Get the buffer time of the *previous* match event, if any.
                                    // It is crucial to iterate backward to find the last match to get its buffer.
                                    let previousMatchBufferTime = 0;
                                    for(let j = i - 1; j >= 0; j--) {
                                        if (currentEventsForRendering[j].type === 'match') {
                                            previousMatchBufferTime = currentEventsForRendering[j].bufferTime || 0;
                                            break; // Found the last match, get its buffer and break
                                        }
                                    }

                                    // Only add a placeholder if it was created from a deleted match,
                                    // or if its duration is greater than the buffer time of the previous match.
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
                                            originalMatchId: isFromDeletedMatch ? existingFreeInterval.originalMatchId : null // Preserve if from deleted match
                                        });
                                        console.log(`displayMatchesAsSchedule: Adding gap placeholder (${formattedGapStartTime}-${formattedGapEndTime}). From deleted match: ${isFromDeletedMatch}, Longer than buffer: ${isLongerThanPreviousBuffer}`);
                                    } else {
                                        console.log(`displayMatchesAsSchedule: Skipping gap ${formattedGapStartTime}-${formattedGapEndTime} as it's purely buffer time or too short.`);
                                    }
                                }
                                
                                // Add the actual event
                                finalEventsToRender.push(event);
                                currentTimePointerInMinutes = Math.max(currentTimePointerInMinutes, eventEnd);
                            }

                            // Add a final placeholder if there's a gap between the last event and end of day
                            if (currentTimePointerInMinutes < 24 * 60) {
                                const gapStart = currentTimePointerInMinutes;
                                const gapEnd = 24 * 60;
                                const formattedGapStartTime = `${String(Math.floor(gapStart / 60)).padStart(2, '0')}:${String(gapStart % 60).padStart(2, '0')}`;
                                const formattedGapEndTime = `${String(Math.floor(gapEnd / 60)).padStart(2, '0')}:${String(Math.floor(gapEnd % 60)).padStart(2, '0')}`;

                                if ((gapEnd - gapStart) > 0) { // Only add if duration > 0
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
                                    console.log(`displayMatchesAsSchedule: Adding final gap placeholder: ${formattedGapStartTime}-${formattedGapEndTime}.`);
                                } else {
                                    console.log(`displayMatchesAsSchedule: Skipping final gap ${formattedGapStartTime}-${formattedGapEndTime} as its duration is 0.`);
                                }
                            }
                        }

                        console.log(`displayMatchesAsSchedule: FinalEventsToRender (po vložení medzier a placeholderov):`, JSON.stringify(finalEventsToRender.map(e => ({id: e.id, type: e.type, startTime: e.startTime || e.startInMinutes, endTime: e.endTime || e.endInMinutes, isBlocked: e.isBlocked, originalMatchId: e.originalMatchId, endOfPlayInMinutes: e.endOfPlayInMinutes, footprintEndInMinutes: e.footprintEndInMinutes}))));

                        
                        scheduleHtml += `<div class="date-group" data-date="${date}" data-location="${location}" data-initial-start-time="${String(Math.floor(initialScheduleStartMinutes / 60)).padStart(2, '0')}:${String(initialScheduleStartMinutes % 60).padStart(2, '0')}">`;
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
                                const formattedDisplayedEndTime = `${String(Math.floor(displayedMatchEndTimeInMinutes / 60)).padStart(2, '0')}:${String(displayedMatchEndTimeInMinutes % 60).padStart(2, '0')}`;
                                
                                const categoryColor = categoryColorsMap.get(match.categoryId) || 'transparent';
                                let textAlignStyle = '';
                                if (match.groupId && groupAlignmentMapForLocation.has(match.groupId)) {
                                    textAlignStyle = `text-align: ${groupAlignmentMapForLocation.get(match.groupId)};`;
                                } else if (groupIdsArrayInLocation.length > 3) {
                                     textAlignStyle = `text-align: center;`;
                                }
                                console.log(`displayMatchesAsSchedule: Vykresľujem zápas: ID ${match.id}, Čas: ${match.startTime}-${formattedDisplayedEndTime} (zobrazený), Miesto: ${match.location}, Dátum: ${match.date}`);

                                scheduleHtml += `
                                    <tr draggable="true" data-id="${match.id}" class="match-row" data-start-time="${match.startTime}" data-duration="${match.duration}" data-buffer-time="${match.bufferTime}" data-footprint-end-time="${String(Math.floor(match.footprintEndInMinutes / 60)).padStart(2, '0')}:${String(match.footprintEndInMinutes % 60).padStart(2, '0')}">
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

                                // Only render this free interval if it was created from a deleted match,
                                // or if its duration is greater than 0 (i.e., not a zero-length gap).
                                // Autogenerated general gaps that are effectively 0 duration after accounting for buffer are skipped.
                                const intervalDuration = blockedInterval.endInMinutes - blockedInterval.startInMinutes;

                                if (!isUserBlocked && !blockedInterval.originalMatchId && intervalDuration === 0) {
                                    console.log(`displayMatchesAsSchedule: Skipping rendering of purely cosmetic/zero-duration placeholder: ${blockedIntervalStartHour}:${blockedIntervalStartMinute}-${blockedIntervalEndHour}:${blockedIntervalEndMinute}`);
                                    continue; // Skip rendering this row if it's a generated free interval with no actual duration
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

                                if (blockedInterval.endInMinutes === 24 * 60 && blockedInterval.startInMinutes === 0) { // Full day interval
                                    displayTimeHtml = `<td>00:00 - Koniec dňa</td>`; 
                                    textColspan = '4';
                                } else if (blockedInterval.endInMinutes === 24 * 60) { // Interval till end of day
                                    displayTimeHtml = `<td>${blockedIntervalStartHour}:${blockedIntervalStartMinute} - Koniec dňa</td>`;
                                    textColspan = '4';
                                } else if (blockedInterval.startInMinutes === 0) { // Interval from start of day
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

                                console.log(`displayMatchesAsSchedule: Vykresľujem zablokovaný interval: ID ${blockedInterval.id}, Čas: ${blockedIntervalStartHour}:${blockedIntervalStartMinute}-${blockedIntervalEndHour}:${blockedIntervalEndMinute}, Miesto: ${blockedInterval.location}, Dátum: ${blockedInterval.date}, isBlocked: ${isUserBlocked}, Display Text: "${displayText}"`);

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

            // Display unassigned matches
            if (unassignedMatches.length > 0) {
                scheduleHtml += `<div class="location-group" style="flex: 1 1 45%; min-width: 300px; margin-bottom: 0; border: 1px solid #ccc; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">`;
                scheduleHtml += `<h2 style="background-color: #6c757d; color: white; padding: 18px; margin: 0; text-align: center;">Zápasy bez zadanej haly</h2>`;
                
                // Group unassigned matches by date
                const unassignedMatchesByDate = new Map();
                unassignedMatches.forEach(match => {
                    if (!unassignedMatchesByDate.has(match.date)) {
                        unassignedMatchesByDate.set(match.date, []);
                    }
                    unassignedMatchesByDate.get(match.date).push(match);
                });

                // Sort dates for unassigned matches
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

                        scheduleHtml += `<div class="date-group" data-date="${date}" data-location="Nezadaná hala" data-initial-start-time="00:00">`; // Use dummy values for unassigned
                        scheduleHtml += `<h3 class="playing-day-header-clickable" style="background-color: #eaeaea; padding: 15px; margin: 0; border-bottom: 1px solid #ddd; cursor: pointer;">${dayName} ${formattedDisplayDate}</h3>`;
                        scheduleHtml += `<table class="data-table match-list-table compact-table" style="width: 100%; border-collapse: collapse;">`;
                        scheduleHtml += `<thead><tr>`;
                        scheduleHtml += `<th>Čas</th>`;
                        scheduleHtml += `<th>Domáci</th>`;
                        scheduleHtml += `<th>Hostia</th>`;
                        scheduleHtml += `<th>ID Domáci</th>`;
                        scheduleHtml += `<th>ID Hostia</th></tr></thead><tbody>`;

                        matchesForDate.forEach(match => {
                            const matchDuration = match.duration || (allSettings.categoryMatchSettings?.[match.categoryId]?.duration || 60);
                            const displayedMatchEndTimeInMinutes = (parseInt(match.startTime.split(':')[0]) * 60 + parseInt(match.startTime.split(':')[1])) + matchDuration; 
                            const formattedDisplayedEndTime = `${String(Math.floor(displayedMatchEndTimeInMinutes / 60)).padStart(2, '0')}:${String(displayedMatchEndTimeInMinutes % 60).padStart(2, '0')}`;
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
                openMatchModal(matchId);
            });
            row.addEventListener('dragstart', (event) => {
                event.dataTransfer.setData('text/plain', event.target.dataset.id);
                event.dataTransfer.effectAllowed = 'move';
                event.target.classList.add('dragging');
                console.log(`Drag started for match ID: ${event.target.dataset.id}`);
            });

            row.addEventListener('dragend', (event) => {
                event.target.classList.remove('dragging');
                console.log(`Drag ended for match ID: ${event.target.dataset.id}`);
            });
        });

        matchesContainer.querySelectorAll('.empty-interval-row').forEach(row => {
            row.addEventListener('click', (event) => {
                const date = event.currentTarget.dataset.date;
                const location = event.currentTarget.dataset.location;
                const startTime = event.currentTarget.dataset.startTime; 
                const endTime = event.currentTarget.dataset.endTime; 
                const blockedIntervalId = event.currentTarget.dataset.id;

                openFreeIntervalModal(date, location, startTime, endTime, blockedIntervalId); 
            });
            row.addEventListener('dragover', (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                event.currentTarget.classList.add('drop-over-row');
            });
            row.addEventListener('dragleave', (event) => {
                event.currentTarget.classList.remove('drop-over-row');
            });
            row.addEventListener('drop', async (event) => {
                event.preventDefault();
                event.currentTarget.classList.remove('drop-over-row');

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const newDate = event.currentTarget.dataset.date;
                const newLocation = event.currentTarget.dataset.location;
                const droppedProposedStartTime = event.currentTarget.dataset.startTime;
                const targetBlockedIntervalId = event.currentTarget.dataset.id;

                console.log(`Presunutý zápas ${draggedMatchId} na prázdny interval. Nový dátum: ${newDate}, nové miesto: ${newLocation}, navrhovaný čas začiatku: ${droppedProposedStartTime}. ID cieľového zablokovaného intervalu (na vymazanie): ${targetBlockedIntervalId}`);
                
                // IMPORTANT: Delete the original free slot (targetBlockedIntervalId) here, before calling moveAndRescheduleMatch.
                // This ensures the slot is removed before the recalculation rebuilds the timeline, preventing conflicts.
                if (targetBlockedIntervalId) {
                    try {
                        await deleteDoc(doc(blockedSlotsCollectionRef, targetBlockedIntervalId));
                        console.log(`Dropped: Original free slot ${targetBlockedIntervalId} deleted.`);
                    } catch (error) {
                        console.error(`Dropped: Error deleting original free slot ${targetBlockedIntervalId}:`, error);
                        // Continue even if deletion fails, the recalculation should clean up eventually
                    }
                }
                
                await moveAndRescheduleMatch(draggedMatchId, newDate, newLocation, droppedProposedStartTime);
            });
        });

        matchesContainer.querySelectorAll('.blocked-interval-row').forEach(row => {
            row.addEventListener('click', (event) => {
                const blockedIntervalId = event.currentTarget.dataset.id;
                const date = event.currentTarget.dataset.date;
                const location = event.currentTarget.dataset.location;
                const startTime = event.currentTarget.dataset.startTime;
                const endTime = event.currentTarget.dataset.endTime;
                openFreeIntervalModal(date, location, startTime, endTime, blockedIntervalId);
            });
            row.addEventListener('dragover', (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'none'; // Cannot drop on a truly blocked interval
                event.currentTarget.classList.add('drop-over-forbidden');
            });
            row.addEventListener('dragleave', (event) => {
                event.currentTarget.classList.remove('drop-over-forbidden');
            });
            row.addEventListener('drop', async (event) => {
                event.preventDefault();
                event.currentTarget.classList.remove('drop-over-forbidden');

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const date = event.currentTarget.dataset.date;
                const location = event.currentTarget.dataset.location;
                const startTime = event.currentTarget.dataset.startTime;
                const endTime = event.currentTarget.dataset.endTime;

                console.log(`Pokus o presun zápasu ${draggedMatchId} na zablokovaný interval: Dátum ${date}, Miesto ${location}, Čas ${startTime}-${endTime}. Presun ZAMITNUTÝ.`);
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
                event.dataTransfer.dropEffect = 'move';
                
                const targetRow = event.target.closest('tr');
                // Allow dropping on footer-spacer-row, but not other explicitly forbidden rows
                if (targetRow && (targetRow.classList.contains('blocked-interval-row') || targetRow.classList.contains('match-row') || targetRow.classList.contains('empty-interval-row') ) && !targetRow.classList.contains('footer-spacer-row')) {
                    event.dataTransfer.dropEffect = 'none'; // Over a match or explicitly blocked interval (not footer spacer)
                    targetRow.classList.add('drop-over-forbidden');
                } else {
                    dateGroupDiv.classList.add('drop-target-active');
                }
            });

            dateGroupDiv.addEventListener('dragleave', (event) => {
                const targetRow = event.target.closest('tr');
                if (targetRow) {
                    targetRow.classList.remove('drop-over-forbidden');
                }
                dateGroupDiv.classList.remove('drop-target-active');
            });

            dateGroupDiv.addEventListener('drop', async (event) => {
                event.preventDefault();
                const targetRow = event.target.closest('tr');
                if (targetRow) {
                    targetRow.classList.remove('drop-over-forbidden');
                }
                dateGroupDiv.classList.remove('drop-target-active');

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const newDate = dateGroupDiv.dataset.date;
                const newLocation = dateGroupDiv.dataset.location;
                let droppedProposedStartTime = null;

                if (draggedMatchId) {
                    // Prevent drop on specifically forbidden rows (already handled by dragover, but good to double check)
                    if (targetRow && (targetRow.classList.contains('blocked-interval-row') || targetRow.classList.contains('match-row') || targetRow.classList.contains('empty-interval-row') ) && !targetRow.classList.contains('footer-spacer-row')) {
                         console.log(`Attempt to drop match ${draggedMatchId} onto a forbidden row. Move DENIED.`);
                         await showMessage('Upozornenie', 'Na tento časový interval nie je možné presunúť zápas.');
                         return;
                    }

                    const isUnassignedSection = (newLocation === 'Nezadaná hala');

                    if (isUnassignedSection) {
                        // For unassigned section, proposed start time is simply the current match's start time, 
                        // as there's no fixed schedule.
                        const draggedMatchData = (await getDoc(doc(matchesCollectionRef, draggedMatchId))).data();
                        droppedProposedStartTime = draggedMatchData.startTime;
                        console.log(`Dropped onto unassigned section. Using original match start time: ${droppedProposedStartTime}`);

                    } else {
                        // For dropping onto the general date-group area (not a specific row)
                        // Find the earliest available time for this date/location.
                        // This logic needs to mirror `findFirstAvailableTime` to get the *actual* first available slot.
                        const initialScheduleStartMinutesForDrop = await getInitialScheduleStartMinutes(newDate);
                        let currentPointerForDrop = initialScheduleStartMinutesForDrop;

                        const fixedEventsQuery = query(
                            matchesCollectionRef,
                            where("date", "==", newDate),
                            where("location", "==", newLocation)
                        );
                        const fixedEventsSnapshot = await getDocs(fixedEventsQuery);
                        const fixedEvents = fixedEventsSnapshot.docs.map(doc => {
                            const data = doc.data();
                            const startInMinutes = (parseInt(data.startTime.split(':')[0]) * 60 + parseInt(data.startTime.split(':')[1]));
                            const duration = Number(data.duration) || 0;
                            const bufferTime = Number(data.bufferTime) || 0;
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
                            if (data.isBlocked === true || data.originalMatchId) { // Only fixed ones
                                const startInMinutes = (parseInt(data.startTime.split(':')[0]) * 60 + parseInt(data.startTime.split(':')[1]));
                                const endInMinutes = (parseInt(data.endTime.split(':')[0]) * 60 + parseInt(data.endTime.split(':')[1]));
                                fixedEvents.push({ id: doc.id, start: startInMinutes, end: endInMinutes, type: 'blocked_interval' });
                            }
                        });

                        fixedEvents.sort((a, b) => a.start - b.start);

                        for (const event of fixedEvents) {
                            if (currentPointerForDrop < event.start) {
                                break; // Found a gap
                            }
                            currentPointerForDrop = Math.max(currentPointerForDrop, event.end);
                        }

                        droppedProposedStartTime = `${String(Math.floor(currentPointerForDrop / 60)).padStart(2, '0')}:${String(currentPointerForDrop % 60).padStart(2, '0')}`;
                        console.log(`Dropped onto date group background. Calculated earliest available time: ${droppedProposedStartTime}`);
                    }

                    console.log(`Attempting to move and reschedule match ${draggedMatchId} to Date: ${newDate}, Location: ${newLocation}, Proposed Start Time: ${droppedProposedStartTime}.`);
                    await moveAndRescheduleMatch(draggedMatchId, newDate, newLocation, droppedProposedStartTime);
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
 * Deletes a playing day and all associated matches and blocked intervals.
 * @param {string} dateToDelete The date of the playing day to delete.
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
            const blockedIntervalsSnapshot = await getDocs(blockedSlotsCollectionRef);
            blockedIntervalsSnapshot.docs.forEach(blockedIntervalDoc => {
                batch.delete(doc(blockedSlotsCollectionRef, blockedIntervalDoc.id));
            });


            await batch.commit();
            await showMessage('Úspech', `Hrací deň ${dateToDelete} a všetky súvisiace zápasy/intervaly boli vymazané!`);
            closeModal(document.getElementById('playingDayModal'));
            await displayMatchesAsSchedule();
        } catch (error) {
            console.error("Chyba pri mazaní hracieho dňa:", error);
            await showMessage('Chyba', `Chyba pri mazaní hracieho dňa. Detail: ${error.message}`);
        }
    }
}

/**
 * Deletes a place and all associated matches.
 * @param {string} placeNameToDelete The name of the place to delete.
 * @param {string} placeTypeToDelete The type of the place to delete.
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
            const blockedIntervalsSnapshot = await getDocs(blockedSlotsCollectionRef);
            blockedIntervalsSnapshot.docs.forEach(blockedIntervalDoc => {
                batch.delete(doc(blockedSlotsCollectionRef, blockedIntervalDoc.id));
            });


            await batch.commit();
            await showMessage('Úspech', `Miesto ${placeNameToDelete} (${placeTypeToDelete}) a všetky súvisiace zápasy boli vymazané!`);
            closeModal(document.getElementById('placeModal'));
            await displayMatchesAsSchedule();
        } catch (error) {
                console.error("Chyba pri mazaní miesta:", error);
                await showMessage('Chyba', `Chyba pri mazaní miesta ${placeNameToDelete} (${placeTypeToDelete}). Detail: ${error.message}`);
        }
    }
}

/**
 * Opens the playing day modal for editing an existing playing day.
 * @param {string} dateToEdit The date of the playing day to edit.
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
 * Opens the place modal for editing an existing place.
 * @param {string} placeName The name of the place to edit.
 * @param {string} placeType The type of the place to edit.
 */
async function editPlace(placeName, placeType) {
    const placeModal = document.getElementById('placeModal');
    const placeIdInput = document.getElementById('placeId');
    const placeTypeSelect = document.getElementById('placeTypeSelect');
    const placeNameInput = document.getElementById('placeName');
    const placeAddressInput = document.getElementById('placeAddress');
    const placeGoogleMapsUrlInput = document.getElementById('placeGoogleMapsUrl');
    const deletePlaceButtonModal = document.getElementById('deletePlaceButtonModal');

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
 * Opens the match modal for adding a new match or editing an existing one.
 * @param {string|null} matchId The ID of the match to edit, or null for a new match.
 * @param {string} prefillDate Date to pre-fill the date select.
 * @param {string} prefillLocation Location to pre-fill the location select.
 * @param {string} prefillStartTime Start time to pre-fill the start time input.
 */
async function openMatchModal(matchId = null, prefillDate = '', prefillLocation = '', prefillStartTime = '') {
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

    if (deleteMatchButtonModal && deleteMatchButtonModal._currentHandler) {
        deleteMatchButtonModal.removeEventListener('click', deleteMatchButtonModal._currentHandler);
        delete deleteMatchButtonModal._currentHandler;
    }

    matchForm.reset();
    matchIdInput.value = matchId || '';
    deleteMatchButtonModal.style.display = matchId ? 'inline-block' : 'none';
    
    if (matchId) {
        const handler = () => deleteMatch(matchId);
        deleteMatchButtonModal.addEventListener('click', handler);
        deleteMatchButtonModal._currentHandler = handler;
    } else {
        deleteMatchButtonModal._currentHandler = null; 
    }


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
        // If the match has no locationType or it's not a 'Športová hala', show a default/empty option
        if (!matchData.location || matchData.locationType !== 'Športová hala') {
            await populateSportHallSelects(matchLocationSelect, ''); // Populate with empty option selected
        } else {
            await populateSportHallSelects(matchLocationSelect, matchData.location);
        }
        matchStartTimeInput.value = matchData.startTime || '';
        matchDurationInput.value = matchData.duration || '';
        matchBufferTimeInput.value = matchData.bufferTime || '';
        await populateCategorySelect(matchCategorySelect, matchData.categoryId);
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

    } else {
        matchModalTitle.textContent = 'Pridať nový zápas';
        await populateCategorySelect(matchCategorySelect);
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

        let defaultDuration = 60;
        let defaultBufferTime = 5;
        
        const settingsDocRef = doc(settingsCollectionRef, SETTINGS_DOC_ID);
        const settingsDoc = await getDoc(settingsDocRef);
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            const categorySettings = data.categoryMatchSettings;
            if (categorySettings) {
                const firstCategoryIdWithSettings = Object.keys(categorySettings)[0];
                if (firstCategoryIdWithSettings) {
                    defaultDuration = categorySettings[firstCategoryIdWithSettings].duration || defaultDuration;
                    defaultBufferTime = categorySettings[firstCategoryIdWithSettings].bufferTime || defaultBufferTime;
                }
            }
        }
        matchDurationInput.value = defaultDuration;
        matchBufferTimeInput.value = defaultBufferTime;
        
        await findFirstAvailableTime();
    }
    openModal(matchModal);
}

/**
 * Opens the free interval modal to manage a free or blocked time slot.
 * @param {string} date The date of the interval.
 * @param {string} location The location of the interval.
 * @param {string} startTime The start time of the interval.
 * @param {string} endTime The end time of the interval.
 * @param {string} blockedIntervalId The ID of the blocked interval document, or a generated ID for new placeholders.
 */
async function openFreeIntervalModal(date, location, startTime, endTime, blockedIntervalId) {
    console.log(`openFreeIntervalModal: Called for Date: ${date}, Location: ${location}, Time: ${startTime}-${endTime}, Interval ID: ${blockedIntervalId}`);

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

    // Remove existing event listeners to prevent duplicates
    if (addMatchButton && addMatchButton._currentHandler) {
        addMatchButton.removeEventListener('click', addMatchButton._currentHandler);
        delete addMatchButton._currentHandler;
        console.log("openFreeIntervalModal: Removed old listener for 'addMatchFromFreeSlotButton'.");
    }
    if (blockButton && blockButton._currentHandler) {
        blockButton.removeEventListener('click', blockButton._currentHandler);
        delete blockButton._currentHandler;
        console.log("openFreeIntervalModal: Removed old listener for 'blockButton'.");
    }
    if (unblockButton && unblockButton._currentHandler) {
        unblockButton.removeEventListener('click', unblockButton._currentHandler);
        delete unblockButton._currentHandler;
        console.log("openFreeIntervalModal: Removed old listener for 'unblockButton'.");
    }
    if (deleteButton && deleteButton._currentHandler) { 
        deleteButton.removeEventListener('click', deleteButton._currentHandler);
        delete deleteButton._currentHandler;
        console.log("openFreeIntervalModal: Removed old listener for 'deleteButton'.");
    }


    freeIntervalIdInput.value = blockedIntervalId; 
    
    const dateObj = new Date(date);
    const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}. ${String(dateObj.getMonth() + 1).padStart(2, '0')}. ${dateObj.getFullYear()}`;

    freeIntervalDateDisplay.textContent = formattedDate;
    freeIntervalLocationDisplay.textContent = location;
    freeIntervalTimeRangeDisplay.textContent = `${startTime} - ${endTime}`;

    // Hide all buttons by default
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
                console.log(`openFreeIntervalModal: Loaded data for blockedIntervalId=${blockedIntervalId}: isBlocked=${isUserBlockedFromDB}, originalMatchId=${originalMatchId}`);
            } else {
                console.warn(`openFreeIntervalModal: Document blockedIntervalId=${blockedIntervalId} does not exist (might have been removed already?). Considering it a placeholder.`);
                isUserBlockedFromDB = false;
            }
        } catch (error) {
            console.error(`openFreeIntervalModal: Error loading document for blockedIntervalId=${blockedIntervalId}:`, error);
            isUserBlockedFromDB = false;
        }
    } else {
        isUserBlockedFromDB = false;
        console.log(`openFreeIntervalModal: Detected generated interval ID (${blockedIntervalId}). Considering it a placeholder.`);
    }

    if (isUserBlockedFromDB) { // Existing blocked interval by user
        freeIntervalModalTitle.textContent = 'Upraviť zablokovaný interval';
        console.log("openFreeIntervalModal: Interval type: Normal blocked interval (user-blocked).");
        
        // Show unblock and delete options
        if (unblockButton) {
            unblockButton.style.display = 'inline-block';
            unblockButton.textContent = 'Odblokovať';
            unblockButton.classList.remove('delete-button'); 
            const unblockHandler = () => {
                console.log(`openFreeIntervalModal: Clicked 'Unblock' for blocked interval ID: ${blockedIntervalId}. Calling unblockBlockedInterval.`);
                unblockBlockedInterval(blockedIntervalId, date, location);
            };
            unblockButton.addEventListener('click', unblockHandler);
            unblockButton._currentHandler = unblockHandler;
            console.log("openFreeIntervalModal: Listener added and 'Odblokovať' button displayed.");
        }
        if (deleteButton) { 
            deleteButton.style.display = 'inline-block';
            deleteButton.textContent = 'Vymazať interval';
            deleteButton.classList.add('delete-button');
            const deleteHandler = () => {
                console.log(`openFreeIntervalModal: Clicked 'Delete interval' for blocked interval ID: ${blockedIntervalId}. Calling handleDeleteInterval.`);
                handleDeleteInterval(blockedIntervalId, date, location);
            };
            deleteButton.addEventListener('click', deleteHandler); 
            deleteButton._currentHandler = deleteHandler; 
            console.log("openFreeIntervalModal: Listener added and 'Vymazať interval' button displayed.");
        }

    } else if (originalMatchId) { // This is a free interval created by a deleted match
        freeIntervalModalTitle.textContent = 'Voľný interval po vymazanom zápase';
        console.log("openFreeIntervalModal: Interval type: Free interval from deleted match.");

        // Show add match and block options
        if (addMatchButton) {
            addMatchButton.style.display = 'inline-block';
            const addMatchHandler = () => {
                console.log(`openFreeIntervalModal: Clicked 'Add match' for free interval. Calling openMatchModal.`);
                closeModal(freeIntervalModal);
                openMatchModal(null, date, location, startTime);
            };
            addMatchButton.addEventListener('click', addMatchHandler);
            addMatchButton._currentHandler = addMatchHandler;
            console.log("openFreeIntervalModal: Listener added and 'Pridať zápas' button displayed.");
        }
        if (blockButton) {
            blockButton.style.display = 'inline-block';
            blockButton.textContent = 'Zablokovať';
            const blockHandler = () => {
                console.log(`openFreeIntervalModal: Clicked 'Block' for free interval from deleted match ID: ${blockedIntervalId}. Calling blockFreeInterval.`);
                blockFreeInterval(blockedIntervalId, date, location, startTime, endTime);
            };
            blockButton.addEventListener('click', blockHandler);
            blockButton._currentHandler = blockHandler;
            console.log("openFreeIntervalModal: Listener added and 'Zablokovať' button displayed.");
        }
        // This type of free interval (from deleted match) should NOT be explicitly deleted by the user through a button, 
        // as it represents a historical slot. It will be replaced if a match is added or blocked.
        if (deleteButton) { deleteButton.style.display = 'none'; } 


    } else { // Auto-generated empty interval (general gap)
        const [endH, endM] = endTime.split(':').map(Number);
        if (endH === 24 && endM === 0) { // If it's the very last interval of the day
            console.log("openFreeIntervalModal: Interval ends at 24:00. This is typically a trailing placeholder, no specific actions.");
            freeIntervalModalTitle.textContent = 'Voľný interval do konca dňa';
            // No buttons for the very last trailing placeholder
            if (addMatchButton) { addMatchButton.style.display = 'inline-block'; } // Still allow adding match
            const addMatchHandler = () => {
                console.log(`openFreeIntervalModal: Clicked 'Add match' for free interval. Calling openMatchModal.`);
                closeModal(freeIntervalModal);
                openMatchModal(null, date, location, startTime);
            };
            addMatchButton.addEventListener('click', addMatchHandler);
            addMatchButton._currentHandler = addMatchHandler;
        } else {
            freeIntervalModalTitle.textContent = 'Spravovať voľný interval';
            console.log("openFreeIntervalModal: Interval type: Auto-generated empty interval.");
            
            // Show add match and block options
            if (addMatchButton) {
                addMatchButton.style.display = 'inline-block';
                const addMatchHandler = () => {
                    console.log(`openFreeIntervalModal: Clicked 'Add match' for free interval. Calling openMatchModal.`);
                    closeModal(freeIntervalModal);
                    openMatchModal(null, date, location, startTime);
                };
                addMatchButton.addEventListener('click', addMatchHandler);
                addMatchButton._currentHandler = addMatchHandler;
                console.log("openFreeIntervalModal: Listener added and 'Pridať zápas' button displayed.");
            }
            if (blockButton) {
                blockButton.style.display = 'inline-block';
                blockButton.textContent = 'Zablokovať';
                const blockHandler = () => {
                    console.log(`openFreeIntervalModal: Clicked 'Block' for auto-generated free interval ID: ${blockedIntervalId}. Calling blockFreeInterval.`);
                    blockFreeInterval(blockedIntervalId, date, location, startTime, endTime);
                };
                blockButton.addEventListener('click', blockHandler);
                blockButton._currentHandler = blockHandler;
                console.log("openFreeIntervalModal: Listener added and 'Zablokovať' button displayed for auto-generated interval.");
            }
            if (deleteButton) { // Allow deleting general auto-generated free intervals
                deleteButton.style.display = 'inline-block';
                deleteButton.textContent = 'Vymazať interval';
                deleteButton.classList.add('delete-button');
                const deleteHandler = () => {
                    console.log(`openFreeIntervalModal: Clicked 'Delete interval' for auto-generated free interval ID: ${blockedIntervalId}. Calling handleDeleteInterval.`);
                    handleDeleteInterval(blockedIntervalId, date, location);
                };
                deleteButton.addEventListener('click', deleteHandler); 
                deleteButton._currentHandler = deleteHandler; 
                console.log("openFreeIntervalModal: Listener added and 'Vymazať interval' button displayed for auto-generated interval.");
            }
        }
    }

    openModal(freeIntervalModal);
    console.log("openFreeIntervalModal: Modal opened.");
}


/**
 * Blocks a free interval, making it unavailable for matches.
 * @param {string} intervalId The ID of the interval to block.
 * @param {string} date The date of the interval.
 * @param {string} location The location of the interval.
 * @param {string} startTime The start time of the interval.
 * @param {string} endTime The end time of the interval.
 */
async function blockFreeInterval(intervalId, date, location, startTime, endTime) {
    console.log(`blockFreeInterval: === BLOCK FREE INTERVAL FUNCTION STARTED ===`);
    console.log(`blockFreeInterval: Interval ID: ${intervalId}, Date: ${date}, Location: ${location}, Start: ${startTime}, End: ${endTime}`);
    const freeIntervalModal = document.getElementById('freeSlotModal'); 
    const confirmed = await showConfirmation('Potvrdenie', 'Naozaj chcete zablokovať tento voľný interval?');
    console.log(`blockFreeInterval: Confirmation received: ${confirmed}`);

    if (confirmed) {
        try {
            // Check for overlaps with existing matches before blocking
            const startInMinutes = (parseInt(startTime.split(':')[0]) * 60) + parseInt(startTime.split(':')[1]);
            const endInMinutes = (parseInt(endTime.split(':')[0]) * 60) + parseInt(endTime.split(':')[1]);

            // Fetch all matches for the selected date and location
            const matchesQuery = query(matchesCollectionRef, where("date", "==", date), where("location", "==", location));
            const matchesSnapshot = await getDocs(matchesQuery);
            
            // Perform overlap check in JavaScript
            const overlappingMatch = matchesSnapshot.docs.find(matchDoc => {
                const matchData = matchDoc.data();
                const [matchStartH, matchStartM] = matchData.startTime.split(':').map(Number);
                const matchStartInMinutes = matchStartH * 60 + matchStartM;
                const matchDuration = Number(matchData.duration) || 0; 
                const matchBufferTime = Number(matchData.bufferTime) || 0; 
                const matchFootprintEndInMinutes = matchStartInMinutes + matchDuration + matchBufferTime; 
                
                // Check for overlap: interval starts before match ends AND interval ends after match starts
                return (startInMinutes < matchFootprintEndInMinutes && endInMinutes > matchStartInMinutes);
            });

            if (overlappingMatch) {
                const formatTime = (minutes) => {
                    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
                    const m = String(minutes % 60).padStart(2, '0');
                    return `${h}:${m}`;
                };
                const matchStartTime = overlappingMatch.data().startTime;
                const matchDuration = Number(overlappingMatch.data().duration) || 0; 
                const matchBufferTime = Number(overlappingMatch.data().bufferTime) || 0; 
                const [msh,msm] = matchStartTime.split(':').map(Number);
                const matchFootprintEndInMinutes = (msh * 60) + msm + matchDuration + matchBufferTime;
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
                console.log(`blockFreeInterval: Adding new blocked interval from generated placeholder:`, intervalDataToSave);
                await addDoc(blockedSlotsCollectionRef, intervalDataToSave);
            } else {
                const intervalRef = doc(blockedSlotsCollectionRef, intervalId);
                console.log(`blockFreeInterval: Updating existing interval ID: ${intervalId} to isBlocked: true`);
                // When blocking an existing placeholder, remove originalMatchId if it exists
                if (intervalDataToSave.originalMatchId) {
                    intervalDataToSave.originalMatchId = deleteField();
                }
                await setDoc(intervalRef, intervalDataToSave, { merge: true });
            }
            
            await showMessage('Úspech', 'Interval bol úspešne zablokovaný!');
            closeModal(freeIntervalModal);
            console.log("blockFreeInterval: Modal closed.");
            await recalculateAndSaveScheduleForDateAndLocation(date, location);
            console.log("blockFreeInterval: Schedule recalculation completed.");
        } catch (error) {
            console.error("Chyba pri blokovaní intervalu:", error);
            await showMessage('Chyba', `Chyba pri blokovaní intervalu: ${error.message}`);
        }
    }
}

/**
 * Unblocks a previously blocked interval, making it available for matches.
 * @param {string} intervalId The ID of the interval to unblock.
 * @param {string} date The date of the interval.
 * @param {string} location The location of the interval.
 */
async function unblockBlockedInterval(intervalId, date, location) {
    console.log(`unblockBlockedInterval: === UNBLOCK INTERVAL FUNCTION STARTED ===`);
    console.log(`unblockBlockedInterval: Interval ID: ${intervalId}, Date: ${date}, Location: ${location}`);
    const freeIntervalModal = document.getElementById('freeSlotModal'); 
    const confirmed = await showConfirmation('Potvrdenie', 'Naozaj chcete odblokovať tento interval? Zápasy môžu byť teraz naplánované počas tohto času.');
    if (confirmed) {
        try {
            const intervalRef = doc(blockedSlotsCollectionRef, intervalId);
            console.log(`unblockBlockedInterval: Attempting to update interval ID: ${intervalId} to isBlocked: false`);
            await setDoc(intervalRef, { isBlocked: false, originalMatchId: deleteField() }, { merge: true });
            console.log(`unblockBlockedInterval: Interval ID: ${intervalId} successfully unblocked.`);
            await showMessage('Úspech', 'Interval bol úspešne odblokovaný!');
            closeModal(freeIntervalModal);
            await recalculateAndSaveScheduleForDateAndLocation(date, location); 
            console.log("unblockBlockedInterval: Schedule display refreshed and recalculated.");
        }
        catch (error) {
            console.error("Chyba pri odblokovaní intervalu:", error);
            await showMessage('Chyba', `Chyba pri odblokovaní intervalu: ${error.message}`);
        }
    }
}

/**
 * Handles the deletion of a time interval (either a blocked interval or a placeholder).
 * This function is used when explicitly deleting a *user-created blocked interval* or an *auto-generated free interval*.
 * This should NOT be used for free intervals that were created by a deleted match (those are managed automatically).
 * @param {string} intervalId The ID of the interval to delete.
 * @param {string} date The date of the interval.
 * @param {string} location The location of the interval.
 */
async function handleDeleteInterval(intervalId, date, location) {
    console.log(`handleDeleteInterval: === INTERVAL DELETION PROCESSING FUNCTION STARTED ===`);
    console.log(`handleDeleteInterval: Interval ID: ${intervalId}, Date: ${date}, Location: ${location}`);
    const freeIntervalModal = document.getElementById('freeSlotModal');

    const confirmed = await showConfirmation('Potvrdenie vymazania', 'Naozaj chcete vymazať tento interval?');
    if (!confirmed) {
        console.log(`handleDeleteInterval: Deletion cancelled by user.`);
        return;
    }

    try {
        const intervalDocRef = doc(blockedSlotsCollectionRef, intervalId);
        const batch = writeBatch(db); 
        console.log(`handleDeleteInterval: Attempting to delete blockedInterval document ID: ${intervalId}`);
        batch.delete(intervalDocRef);
        await batch.commit();
        console.log("handleDeleteInterval: Batch commit successful.");
        
        await showMessage('Úspech', 'Interval bol úspešne vymazaný z databázy!');
        closeModal(freeIntervalModal);
        
        // After deleting, trigger recalculation without any special flags.
        // This will allow the system to re-create a 'general' free interval if a gap appears.
        await recalculateAndSaveScheduleForDateAndLocation(date, location);
        console.log("handleDeleteInterval: Schedule recalculation completed after deleting a user-defined blocked interval or auto-generated free interval.");

    } catch (error) {
        console.error("handleDeleteInterval: Error deleting interval:", error);
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


    if (categoriesContentSection) {
        categoriesContentSection.style.display = 'block';
        const otherSections = document.querySelectorAll('main > section, main > div');
        otherSections.forEach(section => {
            if (section.id !== 'categoriesContentSection') {
                section.style.display = 'none';
            }
        });
    }

    // Corrected function call: displayMatchesAsSchedule instead of displayMatchesSchedule
    await displayMatchesAsSchedule();

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
    console.log("CSS rule for .add-options-dropdown.show injected.");


    addButton.addEventListener('click', (event) => {
        event.stopPropagation();
        addOptions.classList.toggle('show');
        console.log(`addButton clicked. addOptions now has class 'show': ${addOptions.classList.contains('show')}`);
    });

    document.addEventListener('click', (event) => {
        if (!addButton.contains(event.target) && !addOptions.contains(event.target)) {
            addOptions.classList.remove('show');
            console.log("Clicked outside addOptions or addButton. addOptions class 'show' removed.");
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
        deletePlaceButtonModal.style.display = 'none';
        if (deletePlaceButtonModal && deletePlaceButtonModal._currentHandler) {
            deletePlaceButtonButton.removeEventListener('click', deletePlaceButtonModal._currentHandler);
            delete deletePlaceButtonModal._currentHandler;
        }
        openModal(placeModal);
        addOptions.classList.remove('show');
    });

    addMatchButton.addEventListener('click', async () => {
        openMatchModal();
        addOptions.classList.remove('show');
    });

    closePlayingDayModalButton.addEventListener('click', () => {
        closeModal(playingDayModal);
        displayMatchesAsSchedule();
    });

    closePlaceModalButton.addEventListener('click', () => {
        closeModal(placeModal);
        displayMatchesAsSchedule();
    });

    closeMatchModalButton.addEventListener('click', () => {
        closeModal(matchModal);
        displayMatchesAsSchedule();
    });

    closeFreeIntervalModalButton.addEventListener('click', () => {
        closeModal(freeIntervalModal);
        displayMatchesAsSchedule();
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
            await updateMatchDurationAndBuffer();
            await findFirstAvailableTime();
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

    matchDateSelect.addEventListener('change', findFirstAvailableTime);
    matchLocationSelect.addEventListener('change', findFirstAvailableTime);
    matchDurationInput.addEventListener('change', findFirstAvailableTime);
    matchBufferTimeInput.addEventListener('change', findFirstAvailableTime);

    matchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const matchCategory = matchCategorySelect.value;
        const matchGroup = matchGroupSelect.value;
        const team1Number = parseInt(team1NumberInput.value);
        const team2Number = parseInt(team2NumberInput.value);
        const matchDate = matchDateSelect.value;
        const matchLocationName = matchLocationSelect.value;
        const matchStartTime = matchStartTimeInput.value;
        const matchDuration = parseInt(matchDurationInput.value);
        const matchBufferTime = parseInt(matchBufferTimeInput.value);
        let currentMatchId = matchIdInput.value; // Use 'let' as it might be updated for new matches

        // If no location is selected, set locationType to 'Nezadaná hala'
        let finalMatchLocationName = matchLocationName;
        let finalMatchLocationType = 'Športová hala'; // Default
        if (!matchLocationName) {
            finalMatchLocationName = 'Nezadaná hala'; // Or an empty string, depending on how you want to handle it in DB
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
            team2Result = await await getTeamName(matchCategory, matchGroup, team2Number, categoriesMap, groupsMap);
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
            console.log(`Saving existing match ID: ${currentMatchId}`);
        } else {
            matchRef = doc(matchesCollectionRef); // Create a new document reference for a new match
            currentMatchId = matchRef.id; // Get the ID for the new document
            console.log(`Adding new match with generated ID: ${currentMatchId}`);
        }

        const matchData = {
            date: matchDate,
            startTime: matchStartTime,
            duration: matchDuration,
            bufferTime: matchBufferTime,
            location: finalMatchLocationName, // Use the potentially modified location name
            locationType: finalMatchLocationType, // Use the potentially modified location type
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

            // Pass the details of the newly inserted/updated match to the recalculation function
            const insertedMatchInfo = {
                id: currentMatchId,
                date: matchDate,
                location: finalMatchLocationName,
                startTime: matchStartTime,
                duration: matchDuration,
                bufferTime: matchBufferTime
            };

            // Recalculate only if a specific location is involved
            if (finalMatchLocationName !== 'Nezadaná hala') {
                await recalculateAndSaveScheduleForDateAndLocation(matchDate, finalMatchLocationName, insertedMatchInfo);
            } else {
                // If it's an unassigned match, just refresh the display
                await displayMatchesAsSchedule();
            }
        }
        catch (error) {
            console.error("Error saving match:", error);
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
                console.log(`Saving existing place ID: ${id}`, placeData);
                await setDoc(doc(placesCollectionRef, id), placeData, { merge: true });
                await showMessage('Úspech', 'Miesto úspešne aktualizované!');
            } else {
                console.log(`Adding new place:`, placeData);
                await addDoc(placesCollectionRef, placeData);
                await showMessage('Úspech', 'Miesto úspešne pridané!');
            }
            closeModal(placeModal);
            await displayMatchesAsSchedule();
        } catch (error) {
            console.error("Error saving place:", error);
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
                console.log(`Saving existing playing day ID: ${id}`, playingDayData);
                await setDoc(doc(playingDaysCollectionRef, id), playingDayData, { merge: true });
                await showMessage('Úspech', 'Hrací deň úspešne aktualizovaný!');
            } else {
                console.log(`Adding new playing day:`, playingDayData);
                await addDoc(playingDaysCollectionRef, { ...playingDayData, createdAt: new Date() });
                await showMessage('Úspech', 'Hrací deň úspešne pridaný!');
            }
            closeModal(playingDayModal);
            await displayMatchesAsSchedule();
        } catch (error) {
            console.error("Error saving playing day:", error);
            await showMessage('Chyba', `Chyba pri ukladaní hracieho dňa. Detaily: ${error.message}`);
        }
    });
});

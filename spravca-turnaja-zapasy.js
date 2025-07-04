import { db, categoriesCollectionRef, groupsCollectionRef, clubsCollectionRef, matchesCollectionRef, playingDaysCollectionRef, placesCollectionRef, openModal, closeModal, populateCategorySelect, populateGroupSelect, getDocs, doc, setDoc, addDoc, getDoc, query, where, orderBy, deleteDoc, writeBatch, settingsCollectionRef, showMessage, showConfirmation } from './spravca-turnaja-common.js';
import { collection, deleteField, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';


const SETTINGS_DOC_ID = 'matchTimeSettings';
export const blockedSlotsCollectionRef = collection(db, 'tournamentData', 'mainTournamentData', 'blockedSlots');

/**
 * Helper to convert "HH:MM" to minutes from midnight.
 * @param {string} timeStr Time string in "HH:MM" format.
 * @returns {number} Minutes from midnight.
 */
function parseTimeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Helper to format minutes from midnight to "HH:MM" string.
 * @param {number} minutes Minutes from midnight.
 * @returns {string} Time string in "HH:MM" format.
 */
function formatMinutesToTime(minutes) {
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Helper to calculate the end time of a match's "footprint" (match duration + buffer time).
 * @param {string} startTimeStr Start time of the match in "HH:MM" format.
 * @param {number} duration Duration of the match in minutes.
 * @param {number} bufferTime Buffer time after the match in minutes.
 * @returns {string} Formatted end time of the match's footprint.
 */
function calculateFootprintEndTime(startTimeStr, duration, bufferTime) {
    const startInMinutes = parseTimeToMinutes(startTimeStr);
    const endInMinutes = startInMinutes + duration + bufferTime;
    return formatMinutesToTime(endInMinutes);
}

/**
 * Animates the given text by gradually typing it out, bolding it, and then gradually erasing it, in an infinite loop.
 * @param {string} containerId ID of the HTML element where the animated text should be displayed.
 * @param {string} text The string of text to animate.
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
            /* New styles for table cell borders */
            .match-list-table td {
                border-right: 1px solid #EAEAEA;
            }
            .match-list-table td:last-child {
                border-right: none;
            }
            /* Drag & Drop Styles */
            .match-row.dragging {
                opacity: 0.5;
                border: 2px dashed #007bff;
            }
            .drop-over-row {
                background-color: #e6f7ff !important; /* Light blue for droppable empty slots */
                border: 2px dashed #007bff;
            }
            .drop-target-active {
                background-color: #f0f8ff !important; /* Lighter blue for general date-group background */
                border: 2px dashed #007bff;
            }
            .drop-over-forbidden {
                background-color: #ffe6e6 !important; /* Light red for forbidden drop targets */
                border: 2px dashed #dc3545;
                cursor: not-allowed;
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
 * @param {object} currentAllSettings The current allSettings object.
 * @returns {object} An object containing duration and bufferTime.
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
 * Updates match duration and buffer inputs based on selected category settings.
 * @param {object} currentAllSettings The current allSettings object.
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
        // If no category selected, default to 60/5
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
 * @param {object} currentAllSettings The current allSettings object.
 */
async function findFirstAvailableTime(currentAllSettings) {
    const matchDateSelect = document.getElementById('matchDateSelect');
    const matchLocationSelect = document.getElementById('matchLocationSelect');
    const matchStartTimeInput = document.getElementById('matchStartTime');
    const matchDurationInput = document.getElementById('matchDuration');
    const matchBufferTimeInput = document.getElementById('matchBufferTime');

    console.log("findFirstAvailableTime called.");
    const selectedDate = matchDateSelect.value;
    const selectedLocationName = matchLocationSelect.value;
    const proposedMatchDuration = Number(matchDurationInput.value) || 0;
    const proposedMatchBufferTime = Number(matchBufferTimeInput.value) || 0;
    const proposedMatchFootprint = proposedMatchDuration + proposedMatchBufferTime;

    console.log("Selected Date:", selectedDate);
    console.log("Selected Location:", selectedLocationName);
    console.log("Proposed Match Footprint (duration + buffer):", proposedMatchFootprint);

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
        const initialScheduleStartMinutes = await getInitialScheduleStartMinutes(selectedDate, currentAllSettings);
        console.log("Initial pointer minutes for selected day (from settings):", initialScheduleStartMinutes);

        // Fetch all matches and all blocked intervals (both blocked and free placeholders)
        const [matchesSnapshot, blockedIntervalsSnapshot] = await Promise.all([
            getDocs(query(matchesCollectionRef, where("date", "==", selectedDate), where("location", "==", selectedLocationName))),
            getDocs(query(blockedSlotsCollectionRef, where("date", "==", selectedDate), where("location", "==", selectedLocationName)))
        ]);

        const allEvents = [];
        matchesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const startInMinutes = parseTimeToMinutes(data.startTime);
            // Use category settings for duration and buffer time
            const categorySettings = getCategoryMatchSettings(data.categoryId, currentAllSettings);
            const duration = categorySettings.duration;
            const bufferTime = categorySettings.bufferTime;

            allEvents.push({
                id: doc.id,
                start: startInMinutes,
                end: startInMinutes + duration + bufferTime,
                type: 'match',
                isBlocked: false // Matches are not 'blocked' intervals in this context
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

        // Sort all events by their start time
        allEvents.sort((a, b) => a.start - b.start);
        console.log("All fetched events (matches and intervals), sorted:", allEvents.map(e => ({id: e.id, type: e.type, start: e.start, end: e.end, isBlocked: e.isBlocked, originalMatchId: e.originalMatchId})));

        let proposedStartTimeInMinutes = -1;

        // Step 1: Prioritize "Voľný interval dostupný" slots (isBlocked: false, regardless of originalMatchId)
        // These are the general gaps and also the "after deleted match" gaps.
        for (const event of allEvents) {
            if (event.type === 'blocked_interval' && event.isBlocked === false) {
                const intervalStart = event.start;
                const intervalEnd = event.end;
                const intervalDuration = intervalEnd - intervalStart;

                // Ensure the interval starts at or after the initial schedule start time
                // and that the proposed match fits within this interval.
                if (intervalStart >= initialScheduleStartMinutes && intervalDuration >= proposedMatchFootprint) {
                    proposedStartTimeInMinutes = intervalStart;
                    console.log(`Found suitable "Voľný interval dostupný" starting at ${proposedStartTimeInMinutes}.`);
                    break; // Found the first suitable free interval
                }
            }
        }

        // Step 2: If no suitable "Voľný interval dostupný" was found,
        // then find the first available time after all occupied events (matches, user-blocked, or deleted match placeholders).
        if (proposedStartTimeInMinutes === -1) {
            let fixedOccupiedPeriods = [];
            allEvents.filter(e => e.type === 'match' || e.isBlocked === true || e.originalMatchId).forEach(e => {
                fixedOccupiedPeriods.push({ start: e.start, end: e.end });
            });

            // Sort and merge fixed occupied periods
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

            let currentPointer = initialScheduleStartMinutes;
            for (const occupied of mergedFixedOccupiedPeriods) {
                if (currentPointer < occupied.start) {
                    // Found a gap before an occupied period
                    if ((occupied.start - currentPointer) >= proposedMatchFootprint) {
                        proposedStartTimeInMinutes = currentPointer;
                        console.log(`Found gap before fixed occupied period starting at ${proposedStartTimeInMinutes}.`);
                        break;
                    }
                }
                currentPointer = Math.max(currentPointer, occupied.end);
            }

            // If still no time found, check after the last fixed event until end of day
            if (proposedStartTimeInMinutes === -1 && currentPointer < 24 * 60) {
                if ((24 * 60 - currentPointer) >= proposedMatchFootprint) {
                    proposedStartTimeInMinutes = currentPointer;
                    console.log(`Found gap at the end of the day starting at ${proposedStartTimeInMinutes}.`);
                }
            }
        }

        // Fallback: If no time was determined (e.g., entire day is theoretically blocked, or no elements)
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
 * This function now actively compacts the schedule by shifting events forward to fill gaps.
 * @param {string} processDate The date for which the schedule is being processed.
 * @param {string} processLocation The location for which the schedule is being processed.
 * @param {'process'|'cleanup'} purpose Indicates if this call is to 'process' the target location or 'cleanup' the original location after a move.
 * @param {object|null} movedMatchDetails Information about the match that was just moved.
 * { id, oldDate, oldLocation, oldStartTime, oldFootprintEndTime, newDate, newLocation, newStartTime, newFootprintEndTime }
 * @param {object} allSettings All tournament settings, including category match settings.
 */
async function recalculateAndSaveScheduleForDateAndLocation(
    processDate,
    processLocation,
    purpose,
    movedMatchDetails = null,
    allSettings // Pass allSettings to this function
) {
    console.log(`recalculateAndSaveScheduleForDateAndLocation: === SPUSTENÉ pre Dátum: ${processDate}, Miesto: ${processLocation}, Účel: ${purpose}. ` +
                `Presunutý zápas ID: ${movedMatchDetails ? movedMatchDetails.id : 'žiadny'} ===`);
    try {
        const batch = writeBatch(db); 

        // 1. Fetch all existing matches and blocked/free slots for the given processDate and processLocation.
        const matchesQuery = query(matchesCollectionRef, where("date", "==", processDate), where("location", "==", processLocation));
        const matchesSnapshot = await getDocs(matchesQuery);
        let currentMatches = matchesSnapshot.docs.map(doc => {
            const data = doc.data();
            // Get duration and bufferTime from category settings if available, otherwise use match's own data or default
            const categorySettings = allSettings.categoryMatchSettings?.[data.categoryId];
            const duration = categorySettings?.duration || Number(data.duration) || 60;
            const bufferTime = categorySettings?.bufferTime || Number(data.bufferTime) || 5;
            const startInMinutes = parseTimeToMinutes(data.startTime);

            return {
                id: doc.id,
                type: 'match',
                docRef: doc.ref,
                ...data,
                duration: duration, // Use updated duration
                bufferTime: bufferTime, // Use updated bufferTime
                startInMinutes: startInMinutes,
                footprintEndInMinutes: startInMinutes + duration + bufferTime // Recalculate footprint
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

        // 2. Separate truly fixed events (matches and user-blocked intervals, and 'deleted match' permanent free slots)
        // from auto-generated flexible placeholders that will be re-created.
        let fixedEvents = []; // These are events that will be positioned and potentially shifted
        let autoGeneratedPlaceholdersToDelete = []; // These will be deleted and re-created

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

        // --- Logic for creating/deleting permanent placeholders based on move type (Fáza 2.5) ---
        // Find any existing permanent placeholder for this specific moved match ID within *this* processDate/processLocation
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
                // This call is for the *original* location of a move to a different place/day.
                // Create or update a permanent free slot at the old spot.
                const freeIntervalData = {
                    date: processDate,
                    location: processLocation,
                    startTime: movedMatchDetails.oldStartTime,
                    endTime: movedMatchDetails.oldFootprintEndTime,
                    isBlocked: false,
                    originalMatchId: movedMatchDetails.id, // Mark as permanent free slot
                    startInMinutes: parseTimeToMinutes(movedMatchDetails.oldStartTime),
                    endInMinutes: parseTimeToMinutes(movedMatchDetails.oldFootprintEndTime),
                    createdAt: new Date()
                };

                if (existingPermanentPlaceholderRef) {
                    batch.update(existingPermanentPlaceholderRef, freeIntervalData);
                    console.log(`Fáza 2.5 (Cleanup): AKTUALIZOVANÝ permanentný voľný interval pre presunutý zápas ID ${movedMatchDetails.id}.`);
                } else {
                    const newPlaceholderRef = doc(blockedSlotsCollectionRef);
                    batch.set(newPlaceholderRef, freeIntervalData);
                    // Add to fixedEvents so it gets considered in the compaction loop
                    fixedEvents.push({ ...freeIntervalData, docRef: newPlaceholderRef, type: 'blocked_interval' });
                    console.log(`Fáza 2.5 (Cleanup): VYTVORENÝ permanentný voľný interval pre presunutý zápas ID ${movedMatchDetails.id}.`);
                }
            } else if (purpose === 'process') {
                // This call is for the *target* location.
                // Only consider if it's a move within the same day/location.
                const isSameDaySameLocationMove = movedMatchDetails.oldDate === processDate && movedMatchDetails.oldLocation === processLocation;

                if (isSameDaySameLocationMove) {
                    const oldStartInMinutes = parseTimeToMinutes(movedMatchDetails.oldStartTime);
                    const newStartInMinutes = parseTimeToMinutes(movedMatchDetails.newStartTime);

                    if (newStartInMinutes > oldStartInMinutes) {
                        // Case 3: Moved to a LATER time. Create or update a permanent free slot at the old spot.
                        const freeIntervalData = {
                            date: processDate,
                            location: processLocation,
                            startTime: movedMatchDetails.oldStartTime,
                            endTime: movedMatchDetails.oldFootprintEndTime,
                            isBlocked: false,
                            originalMatchId: movedMatchDetails.id, // Mark as permanent free slot
                            startInMinutes: oldStartInMinutes,
                            endInMinutes: parseTimeToMinutes(movedMatchDetails.oldFootprintEndTime),
                            createdAt: new Date()
                        };

                        if (existingPermanentPlaceholderRef) {
                            batch.update(existingPermanentPlaceholderRef, freeIntervalData);
                            console.log(`Fáza 2.5 (Process - Same Day/Loc, Moved Later): AKTUALIZOVANÝ permanentný voľný interval pre presunutý zápas ID ${movedMatchDetails.id}.`);
                        } else {
                            const newPlaceholderRef = doc(blockedSlotsCollectionRef);
                            batch.set(newPlaceholderRef, freeIntervalData);
                            fixedEvents.push({ ...freeIntervalData, docRef: newPlaceholderRef, type: 'blocked_interval' });
                            console.log(`Fáza 2.5 (Process - Same Day/Loc, Moved Later): VYTVORENÝ permanentný voľný interval pre presunutý zápas ID ${movedMatchDetails.id}.`);
                        }
                    } else {
                        // Case 2: Moved to an EARLIER time. Delete any existing permanent free slot for this match.
                        if (existingPermanentPlaceholderRef) {
                            batch.delete(existingPermanentPlaceholderRef);
                            // Remove from fixedEvents so it's not processed further in this run
                            fixedEvents = fixedEvents.filter(e => e.id !== existingPermanentPlaceholderData.id);
                            console.log(`Fáza 2.5 (Process - Same Day/Loc, Moved Earlier): VYMAZANÝ permanentný voľný interval pre presunutý zápas ID ${movedMatchDetails.id}.`);
                        }
                    }
                }
                // If purpose is 'process' but it's a cross-location/date move, no specific placeholder creation here.
                // The cleanup for the old location was handled by the 'cleanup' call.
            }
        }
        // --- End Logic for creating/deleting permanent placeholders (Fáza 2.5) ---

        // Ensure fixedEvents is sorted after adding/removing permanent placeholders
        fixedEvents.sort((a, b) => {
            if (a.startInMinutes !== b.startInMinutes) {
                return a.startInMinutes - b.startInMinutes;
            }
            // Prioritize matches over blocked intervals if they start at the same time
            if (a.type === 'match' && b.type === 'blocked_interval') return -1;
            if (a.type === 'blocked_interval' && b.type === 'match') return 1;
            return 0; 
        });
        console.log(`Fáza 2.6: Zoradené fixedEvents po spracovaní placeholderov:`, fixedEvents.map(e => ({id: e.id, type: e.type, startInMinutes: e.startInMinutes, isBlocked: e.isBlocked || 'N/A', originalMatchId: e.originalMatchId || 'N/A'})));


        const initialScheduleStartMinutes = await getInitialScheduleStartMinutes(processDate, allSettings);
        let currentTimePointer = initialScheduleStartMinutes;
        console.log(`Fáza 3 (Kompakcia): Počiatočný ukazovateľ času (currentTimePointer): ${currentTimePointer} minút.`);

        // 3. Iterate through sorted fixed events to build the final timeline and create new placeholders.
        for (let i = 0; i < fixedEvents.length; i++) {
            const event = fixedEvents[i];
            console.log(`Fáza 3 (Kompakcia): SPRACÚVAM udalosť: ID: ${event.id || 'N/A'}, Typ: ${event.type}, Pôvodný Start (min): ${event.startInMinutes}, Aktuálny currentTimePointer: ${currentTimePointer}`);

            let newEventStartInMinutes = event.startInMinutes;

            // If there's a gap before this event, pull it forward
            if (event.startInMinutes > currentTimePointer) {
                newEventStartInMinutes = currentTimePointer;
                console.log(`Fáza 3 (Kompakcia): Udalosť ${event.id} posunutá dopredu. Nový Start: ${newEventStartInMinutes}.`);
            } else if (event.startInMinutes < currentTimePointer) {
                // If the event starts before the current pointer, it means it's overlapped
                // Push it to current pointer.
                newEventStartInMinutes = currentTimePointer;
                console.log(`Fáza 3 (Kompakcia): Udalosť ${event.id} prekrýva, posunutá na currentTimePointer: ${newEventStartInMinutes}.`);
            }

            // Update the event's start time in memory
            event.startInMinutes = newEventStartInMinutes;
            const newStartTimeFormatted = formatMinutesToTime(newEventStartInMinutes);

            // Add to batch for database update
            if (event.type === 'match') {
                batch.update(event.docRef, { startTime: newStartTimeFormatted });
                event.startTime = newStartTimeFormatted; // Update in memory for next iteration's footprint
                event.endOfPlayInMinutes = event.startInMinutes + event.duration;
                event.footprintEndInMinutes = event.startInMinutes + event.duration + event.bufferTime;
            } else if (event.type === 'blocked_interval' && (event.isBlocked === true || event.originalMatchId)) {
                // For fixed blocked intervals, update their start/end times if they were shifted
                // Ensure we calculate duration based on original start/end if available, otherwise current.
                const originalDuration = (event.originalStartInMinutes && event.originalEndInMinutes) ? (event.originalEndInMinutes - event.originalStartInMinutes) : (event.endInMinutes - event.startInMinutes);
                const newEndTimeInMinutes = newEventStartInMinutes + originalDuration;
                const newEndTimeFormatted = formatMinutesToTime(newEndTimeInMinutes);
                batch.update(event.docRef, { startTime: newStartTimeFormatted, endTime: newEndTimeFormatted, startInMinutes: newEventStartInMinutes, endInMinutes: newEndTimeInMinutes });
                event.startTime = newStartTimeFormatted; // Update in memory
                event.endTime = newEndTimeFormatted; // Update in memory
                event.endInMinutes = newEndTimeInMinutes; // Update in memory
            }

            // Advance the timeline pointer based on the *new* end time of the current event
            const eventFootprintEndInMinutes = (event.type === 'match') ? event.startInMinutes + event.duration + event.bufferTime : event.endInMinutes;
            currentTimePointer = Math.max(currentTimePointer, eventFootprintEndInMinutes);
            console.log(`Fáza 3 (Kompakcia): Po spracovaní udalosti ${event.id || 'N/A'}, currentTimePointer je teraz: ${currentTimePointer}`);
        }

        // 4. Re-create all auto-generated 'free interval available' placeholders
        // Re-establish currentTimePointer to initial start for placeholder generation
        currentTimePointer = initialScheduleStartMinutes;
        
        // Sort fixedEvents again, as their start times were modified in the previous loop
        fixedEvents.sort((a, b) => a.startInMinutes - b.startInMinutes);
        console.log(`Fáza 4: Zoradené fixedEvents po kompakcii pre generovanie placeholderov:`, fixedEvents.map(e => ({id: e.id, type: e.type, startInMinutes: e.startInMinutes, isBlocked: e.isBlocked || 'N/A', originalMatchId: e.originalMatchId || 'N/A'})));


        for (const event of fixedEvents) {
            const eventFootprintEndInMinutes = (event.type === 'match') ? event.startInMinutes + event.duration + event.bufferTime : event.endInMinutes;

            // If there's a gap between the current pointer and the current fixed event, create a 'free interval available' placeholder
            if (currentTimePointer < event.startInMinutes) {
                const gapStart = currentTimePointer;
                const gapEnd = event.startInMinutes;
                const formattedGapStartTime = formatMinutesToTime(gapStart);
                const formattedGapEndTime = formatMinutesToTime(gapEnd);
                
                // Only create if the gap has a positive duration
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
                        originalMatchId: null, // This is a general gap, not from a deleted match
                        createdAt: new Date()
                    });
                    console.log(`Fáza 4: VYTVORENÝ nový voľný interval (medzera po kompakcii): ${formattedGapStartTime}-${formattedGapEndTime}.`);
                }
            }
            // Advance the timeline pointer
            currentTimePointer = Math.max(currentTimePointer, eventFootprintEndInMinutes);
            console.log(`Fáza 4: Po spracovaní udalosti ${event.id || 'N/A'}, currentTimePointer je teraz: ${currentTimePointer}`);
        }

        // Create a final 'free interval available' placeholder if there's space until end of day
        if (currentTimePointer < 24 * 60) {
            const gapStart = currentTimePointer;
            const gapEnd = 24 * 60;
            const formattedGapStartTime = formatMinutesToTime(gapStart);
            const formattedGapEndTime = formatMinutesToTime(gapEnd);

            if (gapEnd > gapStart) { // Only create if the gap has a positive duration
                const newPlaceholderRef = doc(blockedSlotsCollectionRef);
                batch.set(newPlaceholderRef, {
                    date: processDate,
                    location: processLocation,
                    startTime: formattedGapStartTime,
                    endTime: formattedGapEndTime,
                    isBlocked: false,
                    startInMinutes: gapStart,
                    endInMinutes: gapEnd,
                    originalMatchId: null, // This is a general gap
                    createdAt: new Date()
                });
                console.log(`Fáza 4: VYTVORENÝ konečný voľný interval (po kompakcii): ${formattedGapStartTime}-${formattedGapEndTime}.`);
            }
        }
        
        await batch.commit();
        console.log(`recalculateAndSaveScheduleForDateAndLocation: Batch commit successful.`);

        await displayMatchesAsSchedule(allSettings); // Pass allSettings
    } catch (error) {
        console.error("recalculateAndSaveScheduleForDateAndLocation: Chyba pri prepočítavaní a ukladaní rozvrhu:", error);
        await showMessage('Chyba', `Chyba pri prepočítavaní rozvrhu: ${error.message}`);
    }
}

/**
 * Gets the initial schedule start time in minutes for a given date.
 * @param {string} date The date.
 * @param {object} currentAllSettings The current allSettings object.
 * @returns {Promise<number>} The initial start time in minutes.
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
 * @param {object} allSettings All tournament settings, including category match settings.
 */
async function deleteMatch(matchId, allSettings) {
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
            
            // Get duration and bufferTime from category settings if available, otherwise use match's own data or default
            const categorySettings = allSettings.categoryMatchSettings?.[matchData.categoryId];
            const duration = categorySettings?.duration || Number(matchData.duration) || 60;
            const bufferTime = categorySettings?.bufferTime || Number(matchData.bufferTime) || 5;

            const startInMinutes = parseTimeToMinutes(startTime);
            const endInMinutes = startInMinutes + duration + bufferTime;
            const endTime = formatMinutesToTime(endInMinutes);

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
            // No movedMatchDetails needed here as it's a deletion, not a move.
            await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, allSettings);
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
 * @param {object} allSettings All tournament settings, including category match settings.
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

        // Get duration and bufferTime from category settings for the original footprint calculation
        const categorySettings = allSettings.categoryMatchSettings?.[draggedMatchData.categoryId];
        const originalDuration = categorySettings?.duration || Number(draggedMatchData.duration) || 60;
        const originalBufferTime = categorySettings?.bufferTime || Number(draggedMatchData.bufferTime) || 5;

        const originalFootprintEndTime = calculateFootprintEndTime(originalStartTime, originalDuration, originalBufferTime);

        // Update the match's new location and time in DB
        const updatedMatchData = {
            ...draggedMatchData,
            date: targetDate,
            location: targetLocation,
            startTime: droppedProposedStartTime
        };
        await setDoc(draggedMatchDocRef, updatedMatchData, { merge: true });
        console.log(`moveAndRescheduleMatch: Zápas ${draggedMatchId} aktualizovaný v DB s novými dátami:`, updatedMatchData);

        const newFootprintEndTime = calculateFootprintEndTime(droppedProposedStartTime, originalDuration, originalBufferTime); // Use original duration/buffer for new footprint

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

        // 1. Recalculate the TARGET location/date
        await recalculateAndSaveScheduleForDateAndLocation(
            targetDate,
            targetLocation,
            'process', // Purpose: process the target location
            movedMatchDetails,
            allSettings // Pass allSettings
        );
        console.log(`moveAndRescheduleMatch: Recalculation for target location (${targetDate}, ${targetLocation}) completed.`);

        // 2. If the match moved to a *different* day or location, also recalculate the ORIGINAL location/date
        if (originalDate !== targetDate || originalLocation !== targetLocation) {
            await recalculateAndSaveScheduleForDateAndLocation(
                originalDate,
                originalLocation,
                'cleanup', // Purpose: cleanup the original location
                movedMatchDetails, // Pass full details for context, though cleanup only uses old data
                allSettings // Pass allSettings
            );
            console.log(`moveAndRescheduleMatch: Recalculation for original location (${originalDate}, ${originalLocation}) completed.`);
        }

        await showMessage('Úspech', 'Zápas úspešne presunutý a rozvrh prepočítaný!');
        closeModal(document.getElementById('messageModal'));
    } catch (error) {
        console.error("moveAndRescheduleMatch: Chyba pri presúvaní a prepočítavaní rozvrhu:", error);
        await showMessage('Chyba', `Chyba pri presúvaní zápasu: ${error.message}.`);
        await displayMatchesAsSchedule(allSettings); // Pass allSettings
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
        // Match duration and buffer time are now directly on the event object after initial processing
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
 * Displays matches as a schedule, grouped by location and date.
 * @param {object} currentAllSettings The current allSettings object, passed from the onSnapshot listener.
 */
async function displayMatchesAsSchedule(currentAllSettings) {
    const matchesContainer = document.getElementById('matchesContainer');
    if (!matchesContainer) return;

    // Store the stop animation function from the previous call
    if (typeof matchesContainer._stopAnimation === 'function') {
        matchesContainer._stopAnimation();
        console.log("displayMatchesAsSchedule: Zastavujem predchádzajúcu animáciu.");
    } else {
        console.log("displayMatchesAsSchedule: Predchádzajúca _stopAnimation nebola funkcia alebo bola nedefinovaná.");
    }
    matchesContainer.innerHTML = `<p id="loadingAnimationText" style="text-align: center; font-size: 1.2em; color: #555;"></p>`;
    // Store the new stop animation function
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

        const allSettings = currentAllSettings; // Use the currentAllSettings passed as a parameter
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

        // --- NEW LOGIC: Update match documents with correct duration/buffer from settings ---
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

            // Check if the stored duration/buffer needs updating
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
                duration: calculatedDuration, // Use updated duration
                bufferTime: calculatedBufferTime, // Use updated bufferTime
                startInMinutes: startInMinutes,
                endOfPlayInMinutes: startInMinutes + calculatedDuration, // Recalculate end of play
                footprintEndInMinutes: startInMinutes + calculatedDuration + calculatedBufferTime // Recalculate footprint end
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
                                // Duration and bufferTime are already updated in allMatches array
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
                        
                        // Ensure that if there are no events for the day, a placeholder from initial start to end of day is created
                        if (currentEventsForRendering.length === 0) {
                            const gapStart = initialScheduleStartMinutes;
                            const gapEnd = 24 * 60; // End of day
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
                                    const formattedGapStartTime = formatMinutesToTime(gapStart);
                                    const formattedGapEndTime = formatMinutesToTime(gapEnd);
                                    
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
                                const formattedGapStartTime = formatMinutesToTime(gapStart);
                                const formattedGapEndTime = formatMinutesToTime(gapEnd);

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
                                    displayTimeHtml = `<td></td>`; 
                                    textColspan = '4';
                                } else if (blockedInterval.endInMinutes === 24 * 60) { // Interval till end of day
                                    displayTimeHtml = `<td></td>`;
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
                            // Match duration and buffer time are already updated in allMatches array
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
                openMatchModal(matchId, allSettings); // Pass allSettings
            });
            row.addEventListener('dragstart', (event) => {
                console.log(`Drag & Drop: dragstart - ID zápasu: ${event.target.dataset.id}, Target:`, event.target);
                event.dataTransfer.setData('text/plain', event.target.dataset.id);
                event.dataTransfer.effectAllowed = 'move';
                event.target.classList.add('dragging');
            });

            row.addEventListener('dragend', (event) => {
                console.log(`Drag & Drop: dragend - ID zápasu: ${event.target.dataset.id}, Target:`, event.target);
                event.target.classList.remove('dragging');
            });
            // New dragover and drop handlers for match-row
            row.addEventListener('dragover', (event) => {
                event.preventDefault(); // Allow drop
                event.dataTransfer.dropEffect = 'move';
                event.currentTarget.classList.add('drop-over-row'); // Visual feedback
                console.log(`Drag & Drop: dragover na match-row - ID: ${event.currentTarget.dataset.id}, Target:`, event.currentTarget);
            });

            row.addEventListener('dragleave', (event) => {
                event.currentTarget.classList.remove('drop-over-row');
                console.log(`Drag & Drop: dragleave z match-row - ID: ${event.currentTarget.dataset.id}, Target:`, event.currentTarget);
            });

            row.addEventListener('drop', async (event) => {
                event.preventDefault();
                event.currentTarget.classList.remove('drop-over-row');

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const targetMatchId = event.currentTarget.dataset.id;
                const newDate = event.currentTarget.closest('.date-group').dataset.date;
                const newLocation = event.currentTarget.closest('.date-group').dataset.location;

                console.log(`Drag & Drop: drop na match-row - Presunutý zápas ID: ${draggedMatchId}, Cieľový zápas ID: ${targetMatchId}, Nový dátum: ${newDate}, Nové miesto: ${newLocation}, Target:`, event.currentTarget);

                if (draggedMatchId === targetMatchId) {
                    console.log("Drag & Drop: Dropped on self, no action.");
                    return;
                }

                // Determine if dropping before or after the target match
                const rect = event.currentTarget.getBoundingClientRect();
                const dropY = event.clientY;
                const middleY = rect.top + rect.height / 2;

                let droppedProposedStartTime;
                if (dropY < middleY) {
                    // Dropped in the first half of the target row, so place BEFORE the target match
                    droppedProposedStartTime = event.currentTarget.dataset.startTime;
                    console.log(`Drag & Drop: Dropped BEFORE target match. Proposed start time: ${droppedProposedStartTime}`);
                } else {
                    // Dropped in the second half of the target row, so place AFTER the target match
                    droppedProposedStartTime = event.currentTarget.dataset.footprintEndTime; // This is end of play + buffer
                    console.log(`Drag & Drop: Dropped AFTER target match. Proposed start time: ${droppedProposedStartTime}`);
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

                openFreeIntervalModal(date, location, startTime, endTime, blockedIntervalId, allSettings); // Pass allSettings
            });
            row.addEventListener('dragover', (event) => {
                event.preventDefault(); // Crucial for allowing drop
                event.dataTransfer.dropEffect = 'move';
                event.currentTarget.classList.add('drop-over-row');
                console.log(`Drag & Drop: dragover na empty-interval-row - ID: ${event.currentTarget.dataset.id}, Target:`, event.currentTarget);
            });
            row.addEventListener('dragleave', (event) => {
                event.currentTarget.classList.remove('drop-over-row');
                console.log(`Drag & Drop: dragleave z empty-interval-row - ID: ${event.currentTarget.dataset.id}, Target:`, event.currentTarget);
            });
            row.addEventListener('drop', async (event) => {
                event.preventDefault(); // Crucial for handling drop
                event.currentTarget.classList.remove('drop-over-row');

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const newDate = event.currentTarget.dataset.date;
                const newLocation = event.currentTarget.dataset.location;
                const droppedProposedStartTime = event.currentTarget.dataset.startTime;
                const targetBlockedIntervalId = event.currentTarget.dataset.id;

                console.log(`Drag & Drop: drop na empty-interval-row - Presunutý zápas ID: ${draggedMatchId}, Nový dátum: ${newDate}, Nové miesto: ${newLocation}, Navrhovaný čas: ${droppedProposedStartTime}, Cieľový interval ID: ${targetBlockedIntervalId}, Target:`, event.currentTarget);
                
                if (targetBlockedIntervalId) {
                    try {
                        // Delete the old auto-generated free slot, as it's being replaced by the dropped match
                        // This is important for cleanup so recalculateAndSaveScheduleForDateAndLocation doesn't re-create it immediately.
                        await deleteDoc(doc(blockedSlotsCollectionRef, targetBlockedIntervalId));
                        console.log(`Drag & Drop: Original free slot ${targetBlockedIntervalId} deleted.`);
                    } catch (error) {
                        console.error(`Drag & Drop: Error deleting original free slot ${targetBlockedIntervalId}:`, error);
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
                openFreeIntervalModal(date, location, startTime, endTime, blockedIntervalId, allSettings); // Pass allSettings
            });
            row.addEventListener('dragover', (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'none'; // Cannot drop on a truly blocked interval
                event.currentTarget.classList.add('drop-over-forbidden');
                console.log(`Drag & Drop: dragover na blocked-interval-row - ID: ${event.currentTarget.dataset.id}, Drop efekt: none, Target:`, event.currentTarget);
            });
            row.addEventListener('dragleave', (event) => {
                event.currentTarget.classList.remove('drop-over-forbidden');
                console.log(`Drag & Drop: dragleave z blocked-interval-row - ID: ${event.currentTarget.dataset.id}, Target:`, event.currentTarget);
            });
            row.addEventListener('drop', async (event) => {
                event.preventDefault();
                event.currentTarget.classList.remove('drop-over-forbidden');

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const date = event.currentTarget.dataset.date;
                const location = event.currentTarget.dataset.location;
                const startTime = event.currentTarget.dataset.startTime;
                const endTime = event.currentTarget.dataset.endTime;

                console.log(`Drag & Drop: drop na blocked-interval-row - Pokus o presun zápasu ${draggedMatchId} na zablokovaný interval: Dátum ${date}, Miesto ${location}, Čas ${startTime}-${endTime}. Presun ZAMITNUTÝ. Target:`, event.currentTarget);
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
                event.dataTransfer.dropEffect = 'move'; // Default to move for the general area

                const targetRow = event.target.closest('tr');
                if (targetRow) {
                    // If over a specific row, let that row's dragover handle styling/effect.
                    // Do NOT add drop-target-active to the dateGroupDiv itself.
                    // Also, do NOT set dropEffect to 'none' here for valid rows.
                    if (targetRow.classList.contains('blocked-interval-row')) {
                        // This is a truly forbidden row, but its own dragover handles the visual.
                        // We can still set dropEffect to 'none' here to ensure it's not droppable on this level.
                        event.dataTransfer.dropEffect = 'none';
                    }
                    // For match-row and empty-interval-row, their individual dragover will handle it.
                    // No need to add 'drop-target-active' to the parent here.
                } else {
                    // If not over a specific row (i.e., over the general date-group background)
                    dateGroupDiv.classList.add('drop-target-active');
                    console.log(`Drag & Drop: dragover na date-group (pozadie) - Drop efekt: move, Target:`, event.target);
                }
            });

            dateGroupDiv.addEventListener('dragleave', (event) => {
                // This needs to be careful not to remove the class if just moving from one row to another within the same date-group
                // A better way is to remove it only when the mouse leaves the entire dateGroupDiv
                // For now, let's keep it simple and ensure it's removed on drop or full leave.
                const relatedTarget = event.relatedTarget;
                if (!relatedTarget || !dateGroupDiv.contains(relatedTarget)) {
                    dateGroupDiv.classList.remove('drop-target-active');
                    console.log(`Drag & Drop: dragleave z date-group (celý div), Target:`, event.target);
                }
            });

            dateGroupDiv.addEventListener('drop', async (event) => {
                event.preventDefault();
                dateGroupDiv.classList.remove('drop-target-active'); // Remove active class on drop

                const draggedMatchId = event.dataTransfer.getData('text/plain');
                const newDate = dateGroupDiv.dataset.date;
                const newLocation = dateGroupDiv.dataset.location;
                let droppedProposedStartTime = null;

                const targetRow = event.target.closest('tr');

                if (targetRow && (targetRow.classList.contains('match-row') || targetRow.classList.contains('empty-interval-row') || targetRow.classList.contains('blocked-interval-row'))) {
                    // If dropped on a specific row, that row's drop handler will take care of it.
                    // This parent drop handler should do nothing.
                    console.log(`Drag & Drop: Drop event on date-group, but target is a specific row. Delegating to row handler.`);
                    return;
                }

                // Original logic for dropping on general date-group background (first available time)
                console.log(`Drag & Drop: drop na date-group (pozadie) - Presunutý zápas ID: ${draggedMatchId}, Nový dátum: ${newDate}, Nové miesto: ${newLocation}, Target:`, event.target);

                if (draggedMatchId) {
                    const isUnassignedSection = (newLocation === 'Nezadaná hala');

                    if (isUnassignedSection) {
                        const draggedMatchData = (await getDoc(doc(matchesCollectionRef, draggedMatchId))).data();
                        droppedProposedStartTime = draggedMatchData.startTime;
                        console.log(`Drag & Drop: Dropped onto unassigned section. Using original match start time: ${droppedProposedStartTime}`);
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
                            // Get duration and bufferTime from category settings if available, otherwise use match's own data or default
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
                        console.log(`Drag & Drop: Dropped onto date group background. Calculated earliest available time: ${droppedProposedStartTime}`);
                    }

                    console.log(`Drag & Drop: Attempting to move and reschedule match ${draggedMatchId} to Date: ${newDate}, Location: ${newLocation}, Proposed Start Time: ${droppedProposedStartTime}.`);
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
            const blockedIntervalsSnapshot = await getDocs(blockedSlotsCollectionRef); // Corrected this line
            blockedIntervalsSnapshot.docs.forEach(blockedIntervalDoc => {
                batch.delete(doc(blockedSlotsCollectionRef, blockedIntervalDoc.id));
            });


            await batch.commit();
            await showMessage('Úspech', `Hrací deň ${dateToDelete} a všetky súvisiace zápasy/intervaly boli vymazané!`);
            closeModal(document.getElementById('playingDayModal'));
            // The onSnapshot listener for settings will trigger displayMatchesAsSchedule with latest settings.
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
            const blockedIntervalsSnapshot = await getDocs(blockedSlotsCollectionRef); // Corrected this line
            blockedIntervalsSnapshot.docs.forEach(blockedIntervalDoc => {
                batch.delete(doc(blockedSlotsCollectionRef, blockedIntervalDoc.id));
            });


            await batch.commit();
            await showMessage('Úspech', `Miesto ${placeNameToDelete} (${placeTypeToDelete}) a všetky súvisiace zápasy boli vymazané!`);
            closeModal(document.getElementById('placeModal'));
            // The onSnapshot listener for settings will trigger displayMatchesAsSchedule with latest settings.
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
    const placeModalTitle = document.getElementById('placeModalTitle'); // Get the title element

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

            placeModalTitle.textContent = 'Upraviť miesto'; // Set the title here

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
 * @param {object} currentAllSettings The current allSettings object.
 * @param {string} prefillDate Date to pre-fill the date select.
 * @param {string} prefillLocation Location to pre-fill the location select.
 * @param {string} prefillStartTime Start time to pre-fill the start time input.
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

    // Use the currentAllSettings passed as a parameter
    const allSettings = currentAllSettings;

    if (deleteMatchButtonModal && deleteMatchButtonModal._currentHandler) {
        deleteMatchButtonModal.removeEventListener('click', deleteMatchButtonModal._currentHandler);
        delete deleteMatchButtonModal._currentHandler;
    }

    matchForm.reset();
    matchIdInput.value = matchId || '';
    deleteMatchButtonModal.style.display = matchId ? 'inline-block' : 'none';
    
    if (matchId) {
        const handler = () => deleteMatch(matchId, allSettings); // Pass allSettings
        deleteMatchButtonModal.addEventListener('click', handler);
        deleteMatchButtonModal._currentHandler = handler;
    } else {
        deleteMatchButtonModal._currentHandler = null; 
    }

    // Populate category select first, as it's needed for duration/buffer
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
        // If the match has no locationType or it's not a 'Športová hala', show a default/empty option
        if (!matchData.location || matchData.locationType !== 'Športová hala') {
            await populateSportHallSelects(matchLocationSelect, ''); // Populate with empty option selected
        } else {
            await populateSportHallSelects(matchLocationSelect, matchData.location);
        }
        matchStartTimeInput.value = matchData.startTime || '';
        
        // Explicitly set duration and bufferTime from settings for display in modal
        const categorySettings = getCategoryMatchSettings(matchData.categoryId, allSettings);
        matchDurationInput.value = categorySettings.duration;
        matchBufferTimeInput.value = categorySettings.bufferTime;

        // Ensure the correct category is selected in the dropdown
        matchCategorySelect.value = matchData.categoryId;

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
        // After populating categories, update duration/buffer based on the initially selected category
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
        
        await findFirstAvailableTime(allSettings); // Pass allSettings
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
 * @param {object} allSettings All tournament settings, including category match settings.
 */
async function openFreeIntervalModal(date, location, startTime, endTime, blockedIntervalId, allSettings) {
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
                unblockBlockedInterval(blockedIntervalId, date, location, allSettings); // Pass allSettings
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
                handleDeleteInterval(blockedIntervalId, date, location, allSettings); // Pass allSettings
            };
            deleteButton.addEventListener('click', deleteHandler); 
            deleteButton._currentHandler = deleteHandler; 
            console.log("openFreeIntervalModal: Listener added and 'Vymazať interval' button displayed.");
        }

    } else if (originalMatchId) { // This is a free interval created by a deleted match
        freeIntervalModalTitle.textContent = 'Voľný interval po vymazanom zápase';
        console.log("openFreeIntervalModal: Interval type: Free interval from deleted match.");

        // Show add match, block, and DELETE options for these specific placeholders
        if (addMatchButton) {
            addMatchButton.style.display = 'inline-block';
            const addMatchHandler = () => {
                console.log(`openFreeIntervalModal: Clicked 'Add match' for free interval. Calling openMatchModal.`);
                closeModal(freeIntervalModal);
                openMatchModal(null, allSettings, date, location, startTime); // Pass allSettings
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
                blockFreeInterval(blockedIntervalId, date, location, startTime, endTime, allSettings); // Pass allSettings
            };
            blockButton.addEventListener('click', blockHandler);
            blockButton._currentHandler = blockHandler;
            console.log("openFreeIntervalModal: Listener added and 'Zablokovať' button displayed.");
        }
        if (deleteButton) { // Allow deleting free intervals that originated from deleted matches
            deleteButton.style.display = 'inline-block';
            deleteButton.textContent = 'Vymazať interval';
            deleteButton.classList.add('delete-button'); // Add delete button styling
            const deleteHandler = () => {
                console.log(`openFreeIntervalModal: Clicked 'Delete interval' for free interval from deleted match ID: ${blockedIntervalId}. Calling handleDeleteInterval.`);
                handleDeleteInterval(blockedIntervalId, date, location, allSettings); // Pass allSettings
            };
            deleteButton.addEventListener('click', deleteHandler); 
            deleteButton._currentHandler = deleteHandler; 
            console.log("openFreeIntervalModal: Listener added and 'Vymazať interval' button displayed for free interval from deleted match.");
        }

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
                openMatchModal(null, allSettings, date, location, startTime); // Pass allSettings
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
                    openMatchModal(null, allSettings, date, location, startTime); // Pass allSettings
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
                    blockFreeInterval(blockedIntervalId, date, location, startTime, endTime, allSettings); // Pass allSettings
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
                    handleDeleteInterval(blockedIntervalId, date, location, allSettings); // Pass allSettings
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
 * @param {object} allSettings All tournament settings, including category match settings.
 */
async function blockFreeInterval(intervalId, date, location, startTime, endTime, allSettings) {
    console.log(`blockFreeInterval: === BLOCK FREE INTERVAL FUNCTION STARTED ===`);
    console.log(`blockFreeInterval: Interval ID: ${intervalId}, Date: ${date}, Location: ${location}, Start: ${startTime}, End: ${endTime}`);
    const freeIntervalModal = document.getElementById('freeSlotModal'); 
    const confirmed = await showConfirmation('Potvrdenie', 'Naozaj chcete zablokovať tento voľný interval?');
    console.log(`blockFreeInterval: Confirmation received: ${confirmed}`);

    if (confirmed) {
        try {
            // Check for overlaps with existing matches before blocking
            const startInMinutes = parseTimeToMinutes(startTime);
            const endInMinutes = parseTimeToMinutes(endTime);

            // Fetch all matches for the selected date and location
            const matchesQuery = query(matchesCollectionRef, where("date", "==", date), where("location", "==", location));
            const matchesSnapshot = await getDocs(matchesQuery);
            
            // Perform overlap check in JavaScript
            const overlappingMatch = matchesSnapshot.docs.find(matchDoc => {
                const matchData = matchDoc.data();
                // Get duration and bufferTime from category settings if available, otherwise use match's own data or default
                const categorySettings = allSettings.categoryMatchSettings?.[matchData.categoryId];
                const matchDuration = categorySettings?.duration || Number(matchData.duration) || 0;
                const matchBufferTime = categorySettings?.bufferTime || Number(matchData.bufferTime) || 0;

                const matchStartInMinutes = parseTimeToMinutes(matchData.startTime);
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
                // Get duration and bufferTime from category settings for the overlapping match
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
            await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, allSettings); // Pass allSettings
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
 * @param {object} allSettings All tournament settings, including category match settings.
 */
async function unblockBlockedInterval(intervalId, date, location, allSettings) {
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
            await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, allSettings); // Pass allSettings
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
 * @param {object} allSettings All tournament settings, including category match settings.
 */
async function handleDeleteInterval(intervalId, date, location, allSettings) {
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
        await recalculateAndSaveScheduleForDateAndLocation(date, location, 'process', null, allSettings); // Pass allSettings
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

    // Initialize allSettings as an empty object
    let allSettings = {};

    // Set up real-time listener for settings
    const settingsDocRef = doc(settingsCollectionRef, SETTINGS_DOC_ID);
    onSnapshot(settingsDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            allSettings = docSnapshot.data();
            console.log("Settings updated in real-time:", allSettings);
        } else {
            allSettings = {}; // Reset if settings document doesn't exist
            console.log("Settings document does not exist.");
        }
        // Re-display the schedule whenever settings change
        displayMatchesAsSchedule(allSettings);
    }, (error) => {
        console.error("Error listening to settings changes:", error);
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

    // Initial display of matches (will be updated by onSnapshot)
    // await displayMatchesAsSchedule(allSettings); // This initial call might be redundant if onSnapshot fires immediately


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
        const placeModalTitle = document.getElementById('placeModalTitle'); // Get the title element
        if (placeModalTitle) {
            placeModalTitle.textContent = 'Pridať miesto'; // Set title for new place
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
        openMatchModal(null, allSettings); // Pass allSettings when opening for new match
        addOptions.classList.remove('show');
    });

    closePlayingDayModalButton.addEventListener('click', () => {
        closeModal(playingDayModal);
        // displayMatchesAsSchedule() will be called by onSnapshot if settings change
    });

    closePlaceModalButton.addEventListener('click', () => {
        closeModal(placeModal);
        // displayMatchesAsSchedule() will be called by onSnapshot if settings change
    });

    closeMatchModalButton.addEventListener('click', () => {
        closeModal(matchModal);
        // displayMatchesAsSchedule() will be called by onSnapshot if settings change
    });

    closeFreeIntervalModalButton.addEventListener('click', () => {
        closeModal(freeIntervalModal);
        // displayMatchesAsSchedule() will be called by onSnapshot if settings change
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
            await updateMatchDurationAndBuffer(allSettings); // Pass allSettings
            await findFirstAvailableTime(allSettings); // Pass allSettings
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

    matchDateSelect.addEventListener('change', () => findFirstAvailableTime(allSettings)); // Pass allSettings
    matchLocationSelect.addEventListener('change', () => findFirstAvailableTime(allSettings)); // Pass allSettings
    matchDurationInput.addEventListener('change', () => findFirstAvailableTime(allSettings)); // Pass allSettings
    matchBufferTimeInput.addEventListener('change', () => findFirstAvailableTime(allSettings)); // Pass allSettings

    matchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const matchCategory = matchCategorySelect.value;
        const matchGroup = matchGroupSelect.value;
        const team1Number = parseInt(team1NumberInput.value);
        const team2Number = parseInt(team2NumberInput.value);
        const matchDate = matchDateSelect.value;
        const matchLocationName = matchLocationSelect.value;
        const matchStartTime = matchStartTimeInput.value;
        const matchDuration = parseInt(matchDurationInput.value); // This is the value from the form
        const matchBufferTime = parseInt(matchBufferTimeInput.value); // This is the value from the form
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
            duration: matchDuration, // Save the values from the form
            bufferTime: matchBufferTime, // Save the values from the form
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
                await recalculateAndSaveScheduleForDateAndLocation(matchDate, finalMatchLocationName, 'process', insertedMatchInfo, allSettings); // Pass allSettings
            } else {
                // If it's an unassigned match, just refresh the display
                await displayMatchesAsSchedule(allSettings); // Pass allSettings
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
            // The onSnapshot listener for settings will trigger displayMatchesAsSchedule with latest settings.
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
            // The onSnapshot listener for settings will trigger displayMatchesAsSchedule with latest settings.
        } catch (error) {
            console.error("Error saving playing day:", error);
            await showMessage('Chyba', `Chyba pri ukladaní hracieho dňa. Detaily: ${error.message}`);
        }
    });
});

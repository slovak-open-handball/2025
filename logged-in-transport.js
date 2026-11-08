// logged-in-transport.js
import { doc, getDoc, getDocs, onSnapshot, updateDoc, addDoc, collection, Timestamp, setDoc, deleteDoc, writeBatch, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef } = React;

window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success': typeClasses = 'bg-green-500 text-white'; break;
        case 'error':   typeClasses = 'bg-red-500 text-white';   break;
        case 'info':    typeClasses = 'bg-blue-500 text-white';  break;
        default:        typeClasses = 'bg-gray-700 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

const formatDateDDMMYYYY = (ts) => {
    if (!ts) return null;
    let date;
    if (typeof ts.toDate === 'function') date = ts.toDate();
    else if (ts instanceof Date) date = ts;
    else date = new Date(ts);
    if (isNaN(date.getTime())) return null;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}. ${month}. ${year}`;
};

const formatDateTime = (ts) => {
    if (!ts) return null;
    let date;
    if (typeof ts.toDate === 'function') date = ts.toDate();
    else if (ts instanceof Date) date = ts;
    else date = new Date(ts);
    if (isNaN(date.getTime())) return null;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}. ${month}. ${year} ${hours}:${minutes}`;
};

const formatTsLocal = (ts) => {
    if (ts == null || !isFinite(ts)) return null;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}. ${month}. ${year} ${hours}:${minutes}`;
};

const cleanCategory = (cat) => String(cat || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizePlaceName = (name) => {
    if (!name) return '';
    return String(name)
        .trim()
        .replace(/^zastávka\s+/i, '')
        .replace(/^zastavka\s+/i, '')
        .replace(/^ubytovanie\s+/i, '')
        .replace(/^ubytovňa\s+/i, '')
        .replace(/^ubytovna\s+/i, '')
        .replace(/^miesto\s+zrazu\s+/i, '')
        .replace(/^miesta\s+zrazu\s+/i, '')
        .trim();
};

const resolveTeamName = (identifier) => {
    if (!identifier) return '---';

    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
        try {
            const resolved = window.teamManager.getTeamNameByDisplayIdSync(identifier);
            if (resolved && typeof resolved === 'string' && resolved.trim() !== '') {
                return resolved;
            }
        } catch (e) {
        }
    }
    return identifier;
};

const formatArrival = (arrival) => {
    if (!arrival || !arrival.type) return '---';
    const type = String(arrival.type).trim();
    const time = arrival.time ? String(arrival.time).trim() : '';
    if (!type) return '---';
    if (time) return `${type} (${time})`;
    return type;
};

const dayKeyAndSlotToTimestamp = (dayKey, slotFrom) => {
    if (!dayKey) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    let hours = 0, minutes = 0;
    if (slotFrom && /^\d{1,2}:\d{2}$/.test(slotFrom)) {
        const [h, mi] = slotFrom.split(':').map(Number);
        hours = h; minutes = mi;
    }
    return new Date(year, month, day, hours, minutes, 0, 0).getTime();
};

const placeTypeIcons = {
    sportova_hala: { icon: 'fa-futbol', color: '#dc2626', label: 'Športová hala' },
    stravovanie:   { icon: 'fa-utensils', color: '#16a34a', label: 'Stravovanie' },
    ubytovanie:    { icon: 'fa-bed', color: '#6b7280', label: 'Ubytovanie' },
    zastavka:      { icon: 'fa-bus', color: '#2563eb', label: 'Zastávka' },
};

const TRANSPORT_SETTINGS_COLLECTION = 'settings';
const TRANSPORT_SETTINGS_DOC = 'transportTravelTimes';
const TRANSPORT_TRANSFERS_FIELD = 'transfers';

const buildTransferKey = (category, teamName, when, text) => {
    return [
        cleanCategory(category || ''),
        String(teamName || '').trim(),
        String(when || '').trim(),
        String(text || '').trim(),
    ].join('||');
};

const buildDefaultSegments = (parent) => {
    if (!parent) return [];
    
    const stops = Array.isArray(parent.intermediateStopIds)
        ? parent.intermediateStopIds.filter(Boolean)
        : [];

    const fromId = parent.fromId || null;
    const toId = parent.toId || null;

    const routeIdsRaw = [fromId, ...stops, toId].filter(Boolean);
    const routeIds = [];
    routeIdsRaw.forEach((id) => {
        if (routeIds.length === 0 || routeIds[routeIds.length - 1] !== id) routeIds.push(id);
    });

    const out = [];
    for (let i = 0; i < routeIds.length - 1; i++) {
        out.push({
            fromId: routeIds[i],
            toId: routeIds[i + 1],
            startTs: null,
            endTs: null,
            when: null,
            isWalking: false,
            busAssigned: false,
            walkingSetAt: null,
            walkingSetBy: null,
        });
    }
    return out;
};

const findSegmentIndex = (segments, fromId, toId) => {
    if (!Array.isArray(segments)) return -1;
    if (!fromId || !toId) return -1;

    return segments.findIndex((s) => {
        return s.fromId === fromId && s.toId === toId;
    });
};

const TransportApp = ({ userProfileData }) => {
    const timelineGenerationRequestedRef = useRef(false);
    const placesMapRef = useRef({});    

    const teamsLookupRef = useRef({});

    function resolvePlaceNameById(placeId) {
        if (!placeId) return '';
    
        const id = String(placeId);
    
        const fromMap = placesMapRef.current[id];
        if (fromMap) return fromMap;
    
        const fromAllPlaces = (allPlacesRef.current || []).find((p) => p.id === id);
        if (fromAllPlaces) {
            console.log('[TRANSPORT][resolvePlaceNameById] Fallback cez allPlacesRef:', {
                placeId: id,
                name: fromAllPlaces.name,
            });
            return fromAllPlaces.name;
        }
    
        const fromStops = (stopsList || []).find((s) => s.id === id);
        if (fromStops) {
            console.log('[TRANSPORT][resolvePlaceNameById] Fallback cez stopsList:', {
                placeId: id,
                name: fromStops.name,
            });
            return fromStops.name;
        }
    
        console.warn('[TRANSPORT][resolvePlaceNameById] Nenájdený názov pre placeId:', {
            placeId: id,
            availableIds: Object.keys(placesMapRef.current || {}),
            allPlacesCount: (allPlacesRef.current || []).length,
            stopsListCount: (stopsList || []).length,
        });
        return id;
    }

    function resolvePlaceIdByName(placeName) {
        if (!placeName) return null;
    
        const raw = String(placeName).trim();
    
        const directById = (allPlacesRef.current || []).find((p) => p.id === raw);
        if (directById) {
            console.log('[TRANSPORT][resolvePlaceIdByName] Vstup je už ID, vraciam priamo:', {
                input: raw,
                id: directById.id,
                name: directById.name,
                type: directById.type,
            });
            return directById.id;
        }
    
        const norm = normalizePlaceName(raw);
        const found = (allPlacesRef.current || []).find(
            (p) => normalizePlaceName(p.name) === norm
        );
    
        if (!found) {
            console.warn('[TRANSPORT][resolvePlaceIdByName] Nenájdené miesto podľa názvu:', {
                placeName: raw,
                normalized: norm,
                availableNames: (allPlacesRef.current || []).map((p) => p.name),
            });
        } else {
            console.log('[TRANSPORT][resolvePlaceIdByName] Nájdené miesto podľa názvu:', {
                placeName: raw,
                normalized: norm,
                id: found.id,
                name: found.name,
                type: found.type,
            });
        }
    
        return found ? found.id : null;
    }

    const samePlace = (a, b) => {
        if (!a || !b) return false;
        const idA = resolvePlaceIdByName(a) || a;
        const idB = resolvePlaceIdByName(b) || b;
        return idA === idB;
    };

    const savedTransfersRef = useRef([]);

    const findTeamIdentifiersByName = (category, teamName) => {
        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();
        if (!cat || !name) return null;
    
        const lookup = teamsLookupRef.current || {};
        
        for (const [key, info] of Object.entries(lookup)) {
            if (!info) continue;
            if (info.teamName === name && cleanCategory(info.category) === cat) {
                return {
                    teamUid: info.userId,
                    teamIndex: info.teamIndex,
                    category: cat,
                };
            }
        }
        return null;
    };

    const logTransferDbDocument = async (transfer) => {
        if (!window.db || !transfer) {
            console.warn('[TRANSPORT] logTransferDbDocument: chýba window.db alebo transfer');
            return;
        }

        const collectionPath = TRANSPORT_SETTINGS_COLLECTION;
        const docPath = TRANSPORT_SETTINGS_DOC;
        const fieldPath = TRANSPORT_TRANSFERS_FIELD;

        const parentKey = transfer._parentKey || transfer.key;

        try {
            const docRef = doc(window.db, collectionPath, docPath);
            const snap = await getDoc(docRef);

            if (!snap.exists()) {
                console.warn('[TRANSPORT][DB-DOC] Dokument v DB neexistuje:', `${collectionPath}/${docPath}`);
                return;
            }

            const data = snap.data() || {};
            const rawTransfers = data[fieldPath] || {};
            const dbRecord = rawTransfers[parentKey] || null;

            if (!dbRecord) {
                console.warn(
                    '[TRANSPORT][DB-DOC] Záznam pre kľúč neexistuje v DB:',
                    parentKey,
                    '\nDostupné kľúče:',
                    Object.keys(rawTransfers)
                );
                return;
            }
        } catch (err) {
        }
    };

    const parseTransferWhenToRange = (when) => {
        if (!when) return null;
        const s = String(when);
        const regex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
        const found = [];
        let m;
        while ((m = regex.exec(s)) !== null) {
            const d = Number(m[1]);
            const mo = Number(m[2]) - 1;
            const y = Number(m[3]);
            const hh = m[4] != null ? Number(m[4]) : 0;
            const mi = m[5] != null ? Number(m[5]) : 0;
            const ts = new Date(y, mo, d, hh, mi, 0, 0).getTime();
            if (isFinite(ts)) found.push(ts);
        }
        if (found.length === 0) return null;
        return {
            startTs: found[0],
            endTs: found.length > 1 ? found[1] : found[0],
        };
    };

    const parseWhenRangeToTs = (when) => {
        if (!when) return null;
        const s = String(when);
        const regex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
        const found = [];
        let m;
        while ((m = regex.exec(s)) !== null) {
            const d = Number(m[1]);
            const mo = Number(m[2]) - 1;
            const y = Number(m[3]);
            const hh = m[4] != null ? Number(m[4]) : 0;
            const mi = m[5] != null ? Number(m[5]) : 0;
            const ts = new Date(y, mo, d, hh, mi, 0, 0).getTime();
            if (isFinite(ts)) found.push(ts);
        }
        if (found.length === 0) return null;
        return {
            startTs: found[0],
            endTs: found.length > 1 ? found[1] : found[0],
        };
    };

    const computeProvisionalSegmentRange = (transfer) => {
        if (!transfer) return null;
        const parentKey = transfer._parentKey || transfer.key;
        if (!parentKey) return null;
    
        const parentRec = (savedTransfersRef.current || []).find((s) => s.key === parentKey);
        if (!parentRec) return null;
    
        let parentRange = null;
        if (parentRec.when && String(parentRec.when).trim() !== '') {
            parentRange = parseTransferWhenToRange(parentRec.when);
        }
        if (!parentRange || parentRange.startTs == null || parentRange.endTs == null) {
            let earliestStart = null;
            let latestEnd = null;
            (parentRec.segments || []).forEach((s) => {
                if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) earliestStart = s.startTs;
                if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) latestEnd = s.endTs;
            });
            if (earliestStart != null && latestEnd != null) {
                parentRange = { startTs: earliestStart, endTs: latestEnd };
            }
        }
        if (!parentRange || parentRange.startTs == null || parentRange.endTs == null) {
            const dayKey = parentRec.dayKey || transfer.dayKey;
            if (dayKey) {
                const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                if (dm) {
                    const dayStart = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), 0, 0, 0, 0).getTime();
                    parentRange = { startTs: dayStart, endTs: dayStart + 24 * 60 * 60 * 1000 - 60000 };
                }
            }
        }
        if (!parentRange || parentRange.startTs == null || parentRange.endTs == null) return null;

        let PARENT_START = parentRange.startTs;
        let PARENT_END = parentRange.endTs;

        // Ak parent.when nezahŕňa celý rozsah (napr. po priradení prvého segmentu busu),
        // rozšír PARENT_END na najneskorší endTs spomedzi všetkých segmentov.
        (parentRec.segments || []).forEach((seg) => {
            if (!seg) return;
            if (seg.startTs != null && seg.startTs < PARENT_START) PARENT_START = seg.startTs;
            if (seg.endTs != null && seg.endTs > PARENT_END) PARENT_END = seg.endTs;
        });
    
        const parentSegments = [];
        if (Array.isArray(parentRec.segments) && parentRec.segments.length > 0) {
            parentRec.segments.forEach((seg, idx) => {
                const segFromId = seg.fromId || null;
                const segToId = seg.toId || null;
                if (!segFromId || !segToId) return;
    
                const isWalkingSeg = seg.isWalking === true;
    
                let range = null;
                if (isWalkingSeg) {
                    if (seg.startTs != null) {
                        range = { startTs: seg.startTs, endTs: seg.startTs };
                    } else if (seg.endTs != null) {
                        range = { startTs: seg.endTs, endTs: seg.endTs };
                    }
                } else {
                    if (seg.startTs != null && seg.endTs != null && seg.endTs > seg.startTs) {
                        range = { startTs: seg.startTs, endTs: seg.endTs };
                    } else if (seg.startTs != null) {
                        range = { startTs: seg.startTs, endTs: null };
                    } else if (seg.endTs != null) {
                        range = { startTs: null, endTs: seg.endTs };
                    }
                }
    
                // Segment je "resolved" (má reálny čas), ak je priradený busu
                const isBusAssignedWithTime =
                    !isWalkingSeg &&
                    seg.busAssigned === true &&
                    seg.busId != null &&
                    seg.boardingRowId != null &&
                    seg.alightingRowId != null &&
                    seg.startTs != null &&
                    seg.endTs != null &&
                    seg.endTs > seg.startTs;
    
                parentSegments.push({
                    idx,
                    fromId: segFromId,
                    toId: segToId,
                    isWalking: isWalkingSeg,
                    isResolvedWithTime: isBusAssignedWithTime,
                    range,
                });
            });
        }
    
        const currentFromId = transfer.fromId || null;
        const currentToId = transfer.toId || null;
        if (!currentFromId || !currentToId) return null;
    
        const isCurrentInList = parentSegments.some(
            (seg) => seg.fromId === currentFromId && seg.toId === currentToId
        );
        if (!isCurrentInList) {
            parentSegments.push({
                idx: parentSegments.length,
                fromId: currentFromId,
                toId: currentToId,
                isWalking: transfer.isWalking === true,
                isResolvedWithTime: false,
                range: null,
            });
        }
        parentSegments.sort((a, b) => (a.idx || 0) - (b.idx || 0));
    
        // Nájdi predchádzajúci segment, ktorý má aspoň endTs (akýkoľvek, nielen busom priradený)
        let prevResolvedEndTs = null;
        for (const seg of parentSegments) {
            const isCurrent = seg.fromId === currentFromId && seg.toId === currentToId;
            if (isCurrent) break;
    
            if (seg.isWalking === true) continue;
    
            if (seg.range && seg.range.endTs != null) {
                const e = seg.range.endTs;
                if (prevResolvedEndTs == null || e > prevResolvedEndTs) {
                    prevResolvedEndTs = e;
                }
            }
        }
    
        // Nájdi nasledujúci segment, ktorý má aspoň startTs (akýkoľvek, nielen busom priradený)
        let nextResolvedStartTs = null;
        let foundCurrent = false;
        for (const seg of parentSegments) {
            const isCurrent = seg.fromId === currentFromId && seg.toId === currentToId;
            if (isCurrent) { foundCurrent = true; continue; }
            if (!foundCurrent) continue;
    
            if (seg.isWalking === true) continue;
    
            if (seg.range && seg.range.startTs != null) {
                const s = seg.range.startTs;
                if (nextResolvedStartTs == null || s < nextResolvedStartTs) {
                    nextResolvedStartTs = s;
                }
            }
        }
    
        // ŠTART: koniec predchádzajúceho segmentu (akýkoľvek), inak PARENT_START
        const startTsForDisplay = prevResolvedEndTs != null ? prevResolvedEndTs : PARENT_START;
    
        // KONIEC: začiatok nasledujúceho segmentu (akýkoľvek), inak PARENT_END
        let endTsForDisplay;
        if (nextResolvedStartTs != null && nextResolvedStartTs > startTsForDisplay) {
            endTsForDisplay = nextResolvedStartTs;
        } else {
            endTsForDisplay = PARENT_END;
        }
    
        // Ak by náhodou endTs <= startTs, vráť aspoň startTs..PARENT_END
        if (endTsForDisplay <= startTsForDisplay) {
            if (PARENT_END > startTsForDisplay) {
                return { startTs: startTsForDisplay, endTs: PARENT_END };
            }
            return null;
        }
    
        return { startTs: startTsForDisplay, endTs: endTsForDisplay };
    };

    const toDbTransfer = (src, fallbackCategory, fallbackTeamName) => {
        if (!src) return src;
        const category = cleanCategory(src.category || fallbackCategory || '');
        const teamName = String(src.teamName || fallbackTeamName || '').trim();
        const ids = (src.teamUid != null && src.teamIndex != null)
            ? { teamUid: src.teamUid, teamIndex: src.teamIndex }
            : findTeamIdentifiersByName(category, teamName);

        const out = { ...src, category };
        if (ids) {
            out.teamUid = ids.teamUid;
            out.teamIndex = ids.teamIndex;
        }
        delete out.teamName;
        return out;
    };

    const matchesBufferRef = useRef([]);
    const cateringBufferRef = useRef([]);
    const teamsArrivalBufferRef = useRef([]);
    const allPlacesRef = useRef([]);
    const superstructureGroupsRef = useRef({});
    const transportColorsRef = useRef({});
    const matchesLoadedRef = useRef(false);
    const cateringLoadedRef = useRef(false);
    const teamsLoadedRef = useRef(false);
    const teamsLookupLoadedRef = useRef(false);
    const travelTimesLoadedRef = useRef(false);
    const [activeView, setActiveView] = useState('planovanie');
    const [allPlaces, setAllPlaces] = useState([]);
    const [stopsList, setStopsList] = useState([]);
    const [travelTimes, setTravelTimes] = useState({});
    const [travelTimesDraft, setTravelTimesDraft] = useState({});
    const [travelTimesSaving, setTravelTimesSaving] = useState(false);
    const [travelTimesLoaded, setTravelTimesLoaded] = useState(false);
    const [teamCounts, setTeamCounts] = useState({});
    const [buses, setBuses] = useState([]);
    const [busRows, setBusRows] = useState({});
    const [tournamentDays, setTournamentDays] = useState([]);
    const [tournamentDaysLoaded, setTournamentDaysLoaded] = useState(false);
    const [busSaving, setBusSaving] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);    
    const [stopTypeModal, setStopTypeModal] = useState(null); 
    const [selectedDayKey, setSelectedDayKey] = useState('');
    const [selectedBusId, setSelectedBusId] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
    const [savedTransfers, setSavedTransfers] = useState([]);
    const [transportColors, setTransportColors] = useState({});
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedCategoryForTimeline, setSelectedCategoryForTimeline] = useState('');
    const [showOnlyPartialTransfers, setShowOnlyPartialTransfers] = useState(false);
    const [showDeleteTransfersModal, setShowDeleteTransfersModal] = useState(false);
    const [selectedCategoryForDelete, setSelectedCategoryForDelete] = useState('');    
    const [missingTravelTimeWarning, setMissingTravelTimeWarning] = useState([]);
    const [placesLoaded, setPlacesLoaded] = useState(false);
    const [settingsTab, setSettingsTab] = useState('travelTimes');
    const [teamShortcuts, setTeamShortcuts] = useState({});
    const [teamShortcutsLoaded, setTeamShortcutsLoaded] = useState(false);
    const [showTransferTypeModal, setShowTransferTypeModal] = useState(false);
    const [showCustomTransferModal, setShowCustomTransferModal] = useState(false);
    const [customTransferCategory, setCustomTransferCategory] = useState('');
    const [customTransferTeamName, setCustomTransferTeamName] = useState('');
    const [shortcutEditModal, setShortcutEditModal] = useState(null);
    const [shortcutSaving, setShortcutSaving] = useState(false);
    const [shortcutConflict, setShortcutConflict] = useState(null);    
    const [deleteShortcutModal, setDeleteShortcutModal] = useState(null);
    const [deleteShortcutSaving, setDeleteShortcutSaving] = useState(false);
    const [editingTransfer, setEditingTransfer] = useState(null);
    const [editingTransferStops, setEditingTransferStops] = useState([]);
    const [editingTransferSaving, setEditingTransferSaving] = useState(false);
    const [transferActionModal, setTransferActionModal] = useState(null); 
    const [showAssignBusModal, setShowAssignBusModal] = useState(false);
    const [assignBusTransfer, setAssignBusTransfer] = useState(null);
    const [assignBusMatches, setAssignBusMatches] = useState([]);
    const [assignBusSelectedKey, setAssignBusSelectedKey] = useState('');
    const [assignBusSaving, setAssignBusSaving] = useState(false);
    const [removeWalkingModal, setRemoveWalkingModal] = useState(null);
    const [removeWalkingSaving, setRemoveWalkingSaving] = useState(false);
    const [deleteTransferModal, setDeleteTransferModal] = useState(null);
    const [deleteTransferSaving, setDeleteTransferSaving] = useState(false);
    const [regenTransfersModal, setRegenTransfersModal] = useState(null);
    const preloadAccommodationsForSuperstructureTeams = async () => {
        if (!window.__transport_accommodationsByGroup) {
            window.__transport_accommodationsByGroup = {};
        }

        const toLoad = new Set();
    
        (teamsArrivalBufferRef.current || []).forEach((t) => {
            if (!t.isSuperstructure) return;
            if (!t.teamName) return;
            const lastCharMatch = /\d([A-ZÁ-Ž])\s*$/.exec(String(t.teamName).trim());
            if (!lastCharMatch) return;
            const derivedGroupName = `skupina ${lastCharMatch[1].toUpperCase()}`;
            const key = `${cleanCategory(t.category)}|${derivedGroupName}`;
            toLoad.add(key);
        });

        for (const key of toLoad) {
            if (window.__transport_accommodationsByGroup[key]) continue;
            const [cat, grp] = key.split('|');
            try {
                const result = await window.listAccommodationsByCategoryAndGroup(cat, grp);
                window.__transport_accommodationsByGroup[key] = Array.isArray(result) ? result : [];
            } catch (err) {
                console.error(`[TRANSPORT] Chyba pri prednačítaní ubytovní pre ${key}:`, err);
                window.__transport_accommodationsByGroup[key] = [];
            }
        }    
    };

    const renderTeamTimeline = (category, teamName, events, options) => {
        const {
            isSuperstructureTeam,
            teamGroupName,
            getGroupLastChar,
            groupBelongsToChar,
            formatDateDDMMYYYY,
            extractDayKeyFromWhen,
        } = options;

        const lines = [];
        lines.push(`\n  [TRANSPORT] Tím: ${teamName} (počet udalostí: ${events.length})`);

        const isPavukTeam = /\b(WSF|LSF|WQF|W8F|W16F)\d*/i.test(String(teamName));
        
        if (isSuperstructureTeam && !isPavukTeam) {
            let groupChar = getGroupLastChar(teamGroupName);
            if (!groupChar) groupChar = getGroupLastChar(teamName);

            if (groupChar) {
                const datesSet = new Set();
                (matchesBufferRef.current || []).forEach((m) => {
                    if (cleanCategory(m.category) !== cleanCategory(category)) return;
                    const matchGroup = m.groupName ? String(m.groupName).trim() : null;
                    if (!matchGroup) return;
                    if (!groupBelongsToChar(matchGroup, groupChar)) return;

                    let dayKey = null;
                    if (m.scheduledTime) {
                        const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                        if (mm) {
                            const d = String(mm[1]).padStart(2, '0');
                            const mo = String(mm[2]).padStart(2, '0');
                            const y = mm[3];
                            dayKey = `${y}-${mo}-${d}`;
                        }
                    }
                    if (!dayKey && m.scheduledTs != null) {
                        const dt = new Date(m.scheduledTs);
                        dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                    }
                    if (!dayKey) return;
                    datesSet.add(dayKey);
                });

                const formattedDates = [...datesSet].sort().map((dk) => formatDateDDMMYYYY(dk) || dk);
                lines.push(`     [superstructure] Písmeno skupiny: "${groupChar}" – jedinečné dátumy zápasov v skupinách s týmto písmenom:`);
                if (formattedDates.length === 0) lines.push('       (žiadne dátumy)');
                else formattedDates.forEach((d) => lines.push(`       • ${d}`));
            }
        }

        let lastPrintedDayKey = null;
        events.forEach((ev) => {
            const currentDayKey = extractDayKeyFromWhen(ev.when);
            if (currentDayKey && currentDayKey !== lastPrintedDayKey) {
                lines.push('');
                const dayLabel = formatDateDDMMYYYY(currentDayKey) || currentDayKey;
                lines.push(`───── ${dayLabel} ─────`);
                lastPrintedDayKey = currentDayKey;
            }

            let icon = '•';
            if (ev.type === 'match') icon = '🏑';
            else if (ev.type === 'catering') icon = '🍽';
            else if (ev.type === 'arrival') icon = '🚌';
            else if (ev.type === 'accommodation') icon = '🛏';
            else if (ev.type === 'group') icon = '📂';
            else if (ev.type === 'transfer') icon = '🚐';

            const when = ev.when || '—';
            lines.push(`     ${icon} ${when}  |  ${ev.text}`);
        });

        return lines;
    };

    window.printTeamTimeline = (teamName) => {
        if (!teamName || typeof teamName !== 'string') {
            return;
        }

        const targetTeam = teamName.trim();
        const originalLog = console.log;
        const captured = [];
        let found = false;
        let captureDone = false;

        console.log = (...args) => {
            let cleanText;
            let css = null;

            const firstArg = args[0];
            if (typeof firstArg === 'string' && firstArg.startsWith('%c')) {
                cleanText = firstArg.replace(/^%c/, '');
                if (args.length > 1 && typeof args[1] === 'string') {
                    css = args[1];
                }
            } else {
                cleanText = args.map(String).join(' ');
            }

            if (!found && cleanText.includes(`Tím: ${targetTeam} `)) {
                found = true;
                captured.push({ text: cleanText, css });
                return;
            }

            if (found && !captureDone) {
                if (
                    cleanText.includes('[TRANSPORT] Tím: ') ||
                    cleanText.includes('[TRANSPORT] ██ Kategória:')
                ) {
                    captureDone = true;
                    return;
                }
                captured.push({ text: cleanText, css });
            }
        };

        try {
            rebuildAndLogTimeline(true); 
        } finally {
            console.log = originalLog;
        }

        if (!found) {
            console.warn(`[TRANSPORT] Tím "${targetTeam}" sa nenašiel v časovej osi.`);
            return;
        }

        captured.forEach(({ text, css }) => {
            if (css) {
                console.log('%c' + text, css);
            } else {
                console.log(text);
            }
        });
    };

    const rebuildAndLogTimeline = (force = false, categoryFilter = null) => {
        if (!force && !timelineGenerationRequestedRef.current) return;
        if (!matchesLoadedRef.current || !cateringLoadedRef.current || !teamsLoadedRef.current) return;
        if (!teamsLookupLoadedRef.current) return;
        if (!travelTimesLoaded) {
            return;
        }

        const normalizedFilter = categoryFilter ? cleanCategory(categoryFilter) : null;
    
        const grouped = {};
        const accommodationByTeam = {};
        const arrivalTypeByTeam = {};
        const arrivalTimeByTeam = {};
        const superstructureInfoByTeam = {};
        const teamsByGroup = {};
    
        const externalArrivalStop = (() => {
            const fromAllPlaces = (allPlacesRef.current || []).find((p) => p.isExternalArrivalStop === true);
            if (fromAllPlaces) return fromAllPlaces;
            const fromStops = (stopsList || []).find((p) => p.isExternalArrivalStop === true);
            if (fromStops) return fromStops;
            return null;
        })();

        const meetingPointStop = (() => {
            const fromAllPlaces = (allPlacesRef.current || []).find((p) => p.isMeetingPointStop === true);
            if (fromAllPlaces) return fromAllPlaces;
            const fromStops = (stopsList || []).find((p) => p.isMeetingPointStop === true);
            if (fromStops) return fromStops;
            return null;
        })();
    
        const ensure = (category, teamName) => {
            if (!grouped[category]) grouped[category] = {};
            if (!grouped[category][teamName]) grouped[category][teamName] = [];
            return grouped[category][teamName];
        };
    
        const formatFullFromTs = (ts) => {
            if (ts == null || !isFinite(ts)) return null;
            return formatDateTime(new Date(ts));
        };
    
        teamsArrivalBufferRef.current.forEach((t) => {
            const arr = ensure(t.category, t.teamName);
    
            if (t.isSuperstructure) {
                if (!superstructureInfoByTeam[t.category]) superstructureInfoByTeam[t.category] = {};
                const lastChar = t.teamName ? t.teamName.trim().slice(-1).toUpperCase() : null;
                superstructureInfoByTeam[t.category][t.teamName] = {
                    isSuperstructure: true,
                    groupName: t.groupName,
                    lastChar,
                };
            }
    
            if (t.groupName) {
                if (!teamsByGroup[t.category]) teamsByGroup[t.category] = {};
                if (!teamsByGroup[t.category][t.groupName]) teamsByGroup[t.category][t.groupName] = new Set();
                teamsByGroup[t.category][t.groupName].add(t.teamName);
            }
    
            if (t.accommodationName) {
                if (!accommodationByTeam[t.category]) accommodationByTeam[t.category] = {};
                accommodationByTeam[t.category][t.teamName] = t.accommodationName;
            }
    
            if (t.arrivalType) {
                if (!arrivalTypeByTeam[t.category]) arrivalTypeByTeam[t.category] = {};
                arrivalTypeByTeam[t.category][t.teamName] = t.arrivalType;
            }
    
            if (t.arrivalTime) {
                if (!arrivalTimeByTeam[t.category]) arrivalTimeByTeam[t.category] = {};
                arrivalTimeByTeam[t.category][t.teamName] = t.arrivalTime;
            }
    
            if (t.groupName) {
                const orderStr = t.order != null ? `, poradie ${t.order}` : '';

                const groupKey = `${cleanCategory(t.category)}|${String(t.groupName).trim()}`;
                const fromSuperstructure = superstructureGroupsRef.current[groupKey];

                const teamsInThisGroup = (() => {
                    if (fromSuperstructure && fromSuperstructure.size > 0) {
                        return [...fromSuperstructure].sort((a, b) =>
                            a.localeCompare(b, 'sk', { sensitivity: 'base' })
                        );
                    }
                    return [];
                })();
            
                let teamsListStr = '';
                if (teamsInThisGroup.length > 0) {
                    teamsListStr = '\n       • ' + teamsInThisGroup.join('\n       • ');
                } else {
                    teamsListStr = '\n       (žiadne tímy)';
                }
            
                arr.push({
                    ts: -Infinity,
                    startTs: null,
                    endTs: null,
                    when: '—',
                    type: 'group',
                    text: `Kategória: ${t.category}, Skupina: ${t.groupName}${orderStr}${teamsListStr}`,
                    location: null,
                });
            }
    
            if (t.accommodationName) {
                arr.push({
                    ts: -Infinity,
                    startTs: null,
                    endTs: null,
                    when: '—',
                    type: 'accommodation',
                    text: `Ubytovanie: ${t.accommodationName} (typ: ${t.accommodationType || 'neurčený'})`,
                    location: t.accommodationName,
                });
            }
    
            if (t.arrivalDisplay && t.arrivalDisplay !== '---') {
                arr.push({
                    ts: -Infinity,
                    startTs: null,
                    endTs: null,
                    when: '—',
                    type: 'arrival',
                    text: `Doprava / príchod: ${t.arrivalDisplay}`,
                    location: null,
                });
            }
        });
    
        matchesBufferRef.current.forEach((m) => {
            const timeRange = m.scheduledTime
                ? (m.scheduledEndTime ? `${m.scheduledTime} – ${m.scheduledEndTime}` : m.scheduledTime)
                : 'nenaplánované';
            const text = `${m.home} vs ${m.away}${m.special}${m.hallName ? ` | ${m.hallName}` : ''}`;
    
            const startTs = m.scheduledTs ?? null;
            const endTs = m.scheduledEndTs ?? startTs;
    
            ensure(m.category, m.home).push({
                ts: m.scheduledTs ?? Number.POSITIVE_INFINITY,
                startTs,
                endTs,
                when: timeRange,
                type: 'match',
                text,
                location: m.hallName || null,
            });
            if (m.away !== m.home) {
                ensure(m.category, m.away).push({
                    ts: m.scheduledTs ?? Number.POSITIVE_INFINITY,
                    startTs,
                    endTs,
                    when: timeRange,
                    type: 'match',
                    text,
                    location: m.hallName || null,
                });
            }
    
            if (m.groupName) {
                const cat = m.category;
                const grp = String(m.groupName).trim();
                if (!teamsByGroup[cat]) teamsByGroup[cat] = {};
                if (!teamsByGroup[cat][grp]) teamsByGroup[cat][grp] = new Set();
                if (m.home) teamsByGroup[cat][grp].add(m.home);
                if (m.away) teamsByGroup[cat][grp].add(m.away);
            }
        });
    
        cateringBufferRef.current.forEach((c) => {
            const flags = [];
            if (c.isPriority) flags.push('PRIORITA');
            const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
            const mealLabel = c.mealType === 'lunch' ? 'Obed' : c.mealType === 'dinner' ? 'Večera' : c.mealType;
    
            const superstructureStr = c.isSuperstructure
                ? ` ${c.superstructureTeamName}`
                : '';
    
            const formattedDay = c.dayKey ? (formatDateDDMMYYYY(c.dayKey) || c.dayKey) : '?';
            const timeRange = c.slotFrom
                ? (c.slotTo ? `${c.slotFrom} – ${c.slotTo}` : c.slotFrom)
                : '--:--';
    
            const startTs = c.ts ?? null;
            const endTs = c.slotToTs ?? startTs;
    
            ensure(c.category, c.teamName).push({
                ts: c.ts ?? Number.POSITIVE_INFINITY,
                startTs,
                endTs,
                when: ` ${formattedDay} ${timeRange}`.trim(),
                type: 'catering',
                text: `${mealLabel} (${timeRange}) → ${c.placeName}${superstructureStr}${flagStr}`,
                location: c.placeName || null,
            });
        });
    
        const extractDayKeyFromWhen = (when) => {
            if (!when) return null;
            const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(when);
            if (!m) return null;
            const d = String(m[1]).padStart(2, '0');
            const mo = String(m[2]).padStart(2, '0');
            const y = m[3];
            return `${y}-${mo}-${d}`;
        };
    
        const timestampOnDay = (dayRefTs, hh, mm) => {
            if (dayRefTs == null || !isFinite(dayRefTs)) return null;
            const d = new Date(dayRefTs);
            if (isNaN(d.getTime())) return null;
            return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0).getTime();
        };
    
        const midnightFromWhen = (when) => {
            if (!when) return null;
            const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(when);
            if (!m) return null;
            const day = Number(m[1]);
            const month = Number(m[2]) - 1;
            const year = Number(m[3]);
            const d = new Date(year, month, day, 0, 0, 0, 0);
            return isNaN(d.getTime()) ? null : d.getTime();
        };
    
        const buildTransferText = (
            fromEvent,
            toEvent,
            fromLabel,
            toLabel,
            arrivalOnly = false,
            overrideDepartureStr = null,
            overrideArrivalStr = null
        ) => {
            const arrivalTs = toEvent && toEvent.startTs != null ? toEvent.startTs : null;
            const computedArrivalStr = formatFullFromTs(arrivalTs) || '—';
            const arrivalStr = overrideArrivalStr != null ? overrideArrivalStr : computedArrivalStr;
    
            if (arrivalOnly) {
                return `Presun z ${fromLabel} do ${toLabel} (príchod: ${arrivalStr})`;
            }
    
            const departureTs = fromEvent && fromEvent.endTs != null ? fromEvent.endTs : (fromEvent ? fromEvent.startTs : null);
            const computedDepartureStr = formatFullFromTs(departureTs) || '—';
            const departureStr = overrideDepartureStr != null ? overrideDepartureStr : computedDepartureStr;
    
            return `Presun z ${fromLabel} do ${toLabel}`;
        };
    
        console.log('[TRANSPORT] ===== ČASOVÁ OS UDALOSTÍ PRE KAŽDÝ TÍM =====');
    
        const globalFirstDay = (() => {
            const keys = [];
            Object.values(grouped).forEach((teamsObj) => {
                Object.values(teamsObj).forEach((events) => {
                    events.forEach((ev) => {
                        const dk = extractDayKeyFromWhen(ev.when);
                        if (dk) keys.push(dk);
                    });
                });
            });
            if (keys.length === 0) return null;
            keys.sort();
            return keys[0];
        })();    

        const globalLastDay = (() => {
            const keys = [];
            Object.values(grouped).forEach((teamsObj) => {
                Object.values(teamsObj).forEach((events) => {
                    events.forEach((ev) => {
                        const dk = extractDayKeyFromWhen(ev.when);
                        if (dk) keys.push(dk);
                    });
                });
            });
            if (keys.length === 0) return null;
            keys.sort();
            return keys[keys.length - 1];
        })();        
        
        const getGroupLastChar = (groupNameOrTeamName) => {
            if (!groupNameOrTeamName) return null;
            const s = String(groupNameOrTeamName).trim();
            if (!s) return null;
            const m = /([A-ZÁ-Ž])(?=[^A-ZÁ-Ž]*$)/.exec(s.toUpperCase());
            if (m) return m[1];
            return null;
        };

        const groupBelongsToChar = (groupName, char) => {
            if (!groupName || !char) return false;
            const gChar = getGroupLastChar(groupName);
            return gChar === char;
        };
    
        const getGroupForSuperstructureTeam = (category, teamName) => {
            const groups = teamsByGroup[category] || {};
            for (const [gName, teamSet] of Object.entries(groups)) {
                if (teamSet.has(teamName)) return gName;
            }
            return null;
        };
    
        const categories = Object.keys(grouped).sort((a, b) =>
            a.localeCompare(b, 'sk', { sensitivity: 'base' })
        );
    
        if (categories.length === 0) {
            console.log('[TRANSPORT] Žiadne udalosti.');
        } else {
            const ssPlayDatesByTeam = {};
            const ssGroupCharByTeam = {};

            (teamsArrivalBufferRef.current || []).forEach((t) => {
                if (!t.isSuperstructure) return;
                if (!t.teamName) return;

                let char = getGroupLastChar(t.groupName);
                if (!char) char = getGroupLastChar(t.teamName);
                if (!char) return;

                const key = `${cleanCategory(t.category)}|${t.teamName}`;
                ssGroupCharByTeam[key] = char;
                if (!ssPlayDatesByTeam[key]) ssPlayDatesByTeam[key] = new Set();
            });

            const superstructureTeamNames = new Set();
            (teamsArrivalBufferRef.current || []).forEach((t) => {
                if (t.isSuperstructure && t.teamName) {
                    superstructureTeamNames.add(t.teamName);
                }
            });

            Object.keys(ssGroupCharByTeam).forEach((key) => {
                const [cat, teamName] = key.split('|');
                const char = ssGroupCharByTeam[key];
                const set = ssPlayDatesByTeam[key];
            
                matchesBufferRef.current.forEach((m) => {
                    if (cleanCategory(m.category) !== cleanCategory(cat)) return;
                    const matchGroupName = m.groupName ? String(m.groupName).trim() : null;
                    if (!matchGroupName) return;
                    if (!groupBelongsToChar(matchGroupName, char)) return;
            
                    let dayKey = null;
                    if (m.scheduledTime) {
                        const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                        if (mm) {
                            const d = String(mm[1]).padStart(2, '0');
                            const mo = String(mm[2]).padStart(2, '0');
                            const y = mm[3];
                            dayKey = `${y}-${mo}-${d}`;
                        }
                    }
                    if (!dayKey && m.scheduledTs != null) {
                        const dt = new Date(m.scheduledTs);
                        dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                    }
                    if (!dayKey) return;
            
                    set.add(dayKey);
                });
            });
    
            categories.forEach((category) => {
                if (normalizedFilter && cleanCategory(category) !== normalizedFilter) return;
                console.log(`\n[TRANSPORT] ██ Kategória: ${category} ██`);
                const teams = Object.keys(grouped[category]).sort((a, b) =>
                    a.localeCompare(b, 'sk', { sensitivity: 'base' })
                );
    
                teams.forEach((teamName) => {
                    const events = grouped[category][teamName];
    
                    events.sort((a, b) => {
                        if (a.ts !== b.ts) return a.ts - b.ts;
                        return String(a.text).localeCompare(String(b.text), 'sk');
                    });
    
                    const accommodationName =
                        (accommodationByTeam[category] && accommodationByTeam[category][teamName]) || null;
                    const teamArrivalType =
                        (arrivalTypeByTeam[category] && arrivalTypeByTeam[category][teamName]) || '';
    
                    const enriched = [];
    
                    const ssInfo = superstructureInfoByTeam[category] && superstructureInfoByTeam[category][teamName];

                    const teamGroupName = (() => {
                        if (ssInfo && ssInfo.groupName) return ssInfo.groupName;
                        const g = getGroupForSuperstructureTeam(category, teamName);
                        if (g) return g;
                        if (ssInfo && ssInfo.lastChar) return `skupina ${ssInfo.lastChar}`;
                        
                        const nameMatch = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
                        if (nameMatch) {
                            const lastChar = nameMatch[1];
                            const groups = teamsByGroup[category] || {};
                            for (const [gName, teamSet] of Object.entries(groups)) {
                                const gLastChar = gName.trim().slice(-1).toUpperCase();
                                if (gLastChar === lastChar) return gName;
                            }
                            return `skupina ${lastChar}`;
                        }
                        
                        return null;
                    })();

                    const isSuperstructureTeam = (() => {
                        if (ssInfo && ssInfo.isSuperstructure) return true;
                        const inUsers = teamsArrivalBufferRef.current.some(
                            (t) => cleanCategory(t.category) === cleanCategory(category)
                                && t.teamName === teamName
                                && t.isRegistered === true
                        );
                        if (!inUsers) return true;
                        if (/\d[A-ZÁ-Ž]\s*$/.test(String(teamName).trim())) return true;
                        return false;
                    })();

                    if (isSuperstructureTeam) {
                        const ssTeamKeyPre = `${cleanCategory(category)}|${teamName}`;
                        const groupCharPre = ssGroupCharByTeam[ssTeamKeyPre];
                    
                        if (groupCharPre && ssPlayDatesByTeam[ssTeamKeyPre]) {                    
                            const groupPlayDays = [...ssPlayDatesByTeam[ssTeamKeyPre]].sort();                            
                    
                            groupPlayDays.forEach((groupPlayDay) => {
                                const teamHasEventOnDay = (() => {
                                    const fromEvents = events.some((ev) => extractDayKeyFromWhen(ev.when) === groupPlayDay);
                                    if (fromEvents) return true;
                                    const fromMatches = (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                        if (m.home !== teamName && m.away !== teamName) return false;
                                        let dk = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) dk = `${mm[3]}-${String(mm[2]).padStart(2, '0')}-${String(mm[1]).padStart(2, '0')}`;
                                        }
                                        if (!dk && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        return dk === groupPlayDay;
                                    });
                                    if (fromMatches) return true;
                                    const fromCatering = (cateringBufferRef.current || []).some((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return false;
                                        if (c.teamName !== teamName) return false;
                                        return c.dayKey === groupPlayDay;
                                    });
                                    return fromCatering;
                                })();
                                
                                if (teamHasEventOnDay) return;

                                const firstTeamEventDay = (() => {
                                    let first = null;
                                    events.forEach((ev) => {
                                        const d = extractDayKeyFromWhen(ev.when);
                                        if (d && (first == null || d < first)) first = d;
                                    });
                                    return first;
                                })();
                                
                                if (firstTeamEventDay != null && groupPlayDay < firstTeamEventDay) {
                                    return;
                                }
                    
                                let destEvent = null;
                                const sortedTeamEvents = [...events].sort((a, b) => {
                                    if (a.ts !== b.ts) return a.ts - b.ts;
                                    return String(a.text).localeCompare(String(b.text), 'sk');
                                });
                                for (const ev of sortedTeamEvents) {
                                    const evDay = extractDayKeyFromWhen(ev.when);
                                    if (evDay && evDay > groupPlayDay) {
                                        destEvent = ev;
                                        break;
                                    }
                                }
                                if (!destEvent || !destEvent.location) return;
                    
                                const destination = destEvent.location;
                    
                                const teamBelongsToCharPre = (tn) => {
                                    if (!tn) return false;
                                    if (String(tn).startsWith('(row team:')) return false;
                                    const nameMatch = /\d([A-ZÁ-Ž])\s*$/.exec(String(tn).trim());
                                    if (nameMatch && nameMatch[1].toUpperCase() === groupCharPre) {
                                        return true;
                                    }
                                    const teamInfo = (teamsArrivalBufferRef.current || []).find(
                                        (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === tn
                                    );
                                    if (teamInfo && teamInfo.groupName) {
                                        return groupBelongsToChar(teamInfo.groupName, groupCharPre);
                                    }
                                    return false;
                                };
                    
                                const firstPlayDayPre = (() => {
                                    let firstDayKey = null;
                                    events.forEach((ev) => {
                                        const evDay = extractDayKeyFromWhen(ev.when);
                                        if (!evDay) return;
                                        if (firstDayKey == null || evDay < firstDayKey) {
                                            firstDayKey = evDay;
                                        }
                                    });
                                    return firstDayKey;
                                })();
                    
                                const isFirstPlayDayPre = firstPlayDayPre != null && groupPlayDay === firstPlayDayPre;
                    
                                const uniqueSourceLocationsPre = new Map();
                                const updateUniqueSourcePre = (loc, endTs) => {
                                    if (!loc) return;
                                    if (loc === destination) return;
                                    const existing = uniqueSourceLocationsPre.get(loc);
                                    if (!existing || (endTs != null && endTs > (existing.endTs ?? -Infinity))) {
                                        uniqueSourceLocationsPre.set(loc, { location: loc, endTs });
                                    }
                                };
                    
                                if (isFirstPlayDayPre) {
                                    matchesBufferRef.current.forEach((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return;
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                const d = String(mm[1]).padStart(2, '0');
                                                const mo = String(mm[2]).padStart(2, '0');
                                                const y = mm[3];
                                                dayKey = `${y}-${mo}-${d}`;
                                            }
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        if (!dayKey || dayKey !== groupPlayDay) return;
                                        const endTs = m.scheduledEndTs != null
                                            ? m.scheduledEndTs
                                            : (m.scheduledTs != null ? m.scheduledTs : null);
                                        [m.home, m.away].forEach((tn) => {
                                            if (!tn) return;
                                            if (tn === teamName) return;
                                            if (!isRealRegisteredTeamPre(tn)) return;
                                            if (!teamBelongsToCharPre(tn)) return;
                                            updateUniqueSourcePre(m.hallName || null, endTs);
                                        });
                                    });
                                    cateringBufferRef.current.forEach((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return;
                                        if (c.isSuperstructure === true) return;
                                        const dayKey = c.dayKey || null;
                                        if (!dayKey || dayKey !== groupPlayDay) return;
                                        const tn = c.teamName;
                                        if (!tn) return;
                                        if (tn === teamName) return;
                                        if (!isRealRegisteredTeamPre(tn)) return;
                                        if (!teamBelongsToCharPre(tn)) return;
                                        const endTs = c.slotToTs != null ? c.slotToTs : (c.ts != null ? c.ts : null);
                                        updateUniqueSourcePre(c.placeName || null, endTs);
                                    });
                                } else {
                                    (teamsArrivalBufferRef.current || []).forEach((t) => {
                                        if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                        if (!t.teamName) return;
                                        if (t.teamName === teamName) return;
                                        if (!t.accommodationName || t.accommodationName.trim() === '') return;
                                        if (!teamBelongsToCharPre(t.teamName)) return;
                                        updateUniqueSourcePre(t.accommodationName.trim(), null);
                                    });
                                }
                    
                                if (uniqueSourceLocationsPre.size === 0) return;
                    
                                const destinationArrivalStr =
                                    formatFullFromTs(destEvent.startTs) || destEvent.when;
                                const dayRefTs = destEvent.startTs != null
                                    ? destEvent.startTs
                                    : midnightFromWhen(destEvent.when);
                                const departureTs = timestampOnDay(dayRefTs, 0, 0);
                                const departureStr = formatFullFromTs(departureTs) || '00:00';
                    
                                Array.from(uniqueSourceLocationsPre.values())
                                    .sort((a, b) => {
                                        if (a.endTs != null && b.endTs != null) return a.endTs - b.endTs;
                                        return String(a.location).localeCompare(String(b.location), 'sk');
                                    })
                                    .forEach((info) => {
                                        let whenStr;
                                        if (departureStr && destinationArrivalStr) {
                                            whenStr = `${departureStr} – ${destinationArrivalStr}`;
                                        } else if (destinationArrivalStr) {
                                            whenStr = destinationArrivalStr;
                                        } else {
                                            whenStr = destEvent.when;
                                        }
                                        enriched.push({
                                            ts: destEvent.ts - 1,
                                            when: whenStr,
                                            type: 'transfer',
                                            text: `Presun z ${info.location} do ${destination}`,
                                            location: null,
                                            isTransfer: true,
                                        });
                                    });
                            });
                        }
                    }
    
                    for (let i = 0; i < events.length; i++) {
                        const current = events[i];
                        const prev = events[i - 1];
                        const next = events[i + 1];
                    
                        const currentDay = extractDayKeyFromWhen(current.when);
                        const prevDay = prev ? extractDayKeyFromWhen(prev.when) : null;
                        const nextDay = next ? extractDayKeyFromWhen(next.when) : null;
                    
                        const isFirstEventOfDay =
                            currentDay != null && (prev == null || prevDay == null || prevDay !== currentDay);
                    
                        const isLastEventOfDay =
                            currentDay != null && (next == null || nextDay == null || nextDay !== currentDay);
                    
                        const teamIsInUsers = teamsArrivalBufferRef.current.some(
                            (t) => cleanCategory(t.category) === cleanCategory(category)
                                && t.teamName === teamName
                                && t.isRegistered === true
                        );

                        const teamAccommodationsList = (() => {
                            if (teamIsInUsers) {
                                return accommodationName && accommodationName.trim() !== ''
                                    ? [accommodationName]
                                    : [];
                            }
                            if (teamGroupName) {
                                const lastCharMatch = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
                                const derivedGroupName = lastCharMatch
                                    ? `skupina ${lastCharMatch[1].toUpperCase()}`
                                    : teamGroupName;
                                if (!derivedGroupName) return [];
                                const cacheKey = `${cleanCategory(category)}|${derivedGroupName}`;
                                return (window.__transport_accommodationsByGroup || {})[cacheKey] || [];
                            }
                            return [];
                        })();

                        const shouldGenerateAccommodationTransfers = teamAccommodationsList.length > 0;  
                        
                        if (isFirstEventOfDay && current.location) {
                        
                            const ssTeamKey = `${cleanCategory(category)}|${teamName}`;
                            const groupCharForSS = ssGroupCharByTeam[ssTeamKey];
                        
                            const usersTeamHasEventsOnDay = (() => {
                                if (!groupCharForSS) return false;
                                if (!currentDay) return false;
                        
                                return (teamsArrivalBufferRef.current || []).some((t) => {
                                    if (cleanCategory(t.category) !== cleanCategory(category)) return false;
                                    if (t.isRegistered !== true) return false;
                                    if (t.isSuperstructure === true) return false;
                                    if (!t.groupName) return false;
                                    if (!groupBelongsToChar(t.groupName, groupCharForSS)) return false;
                        
                                    const hasMatch = (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                        if (m.home !== t.teamName && m.away !== t.teamName) return false;
                        
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                const d = String(mm[1]).padStart(2, '0');
                                                const mo = String(mm[2]).padStart(2, '0');
                                                const y = mm[3];
                                                dayKey = `${y}-${mo}-${d}`;
                                            }
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        return dayKey === currentDay;
                                    });
                        
                                    if (hasMatch) return true;
                        
                                    const hasCatering = (cateringBufferRef.current || []).some((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return false;
                                        if (c.isSuperstructure === true) return false;
                                        if (c.teamName !== t.teamName) return false;
                                        return c.dayKey === currentDay;
                                    });
                        
                                    return hasCatering;
                                });
                            })();
                        
                            const currentTeamHasOwnEventOnDay = (() => {
                                if (!currentDay) return false;
                            
                                const hasMatch = (matchesBufferRef.current || []).some((m) => {
                                    if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                    if (m.home !== teamName && m.away !== teamName) return false;
                            
                                    let dayKey = null;
                                    if (m.scheduledTime) {
                                        const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                        if (mm) {
                                            const d = String(mm[1]).padStart(2, '0');
                                            const mo = String(mm[2]).padStart(2, '0');
                                            const y = mm[3];
                                            dayKey = `${y}-${mo}-${d}`;
                                        }
                                    }
                                    if (!dayKey && m.scheduledTs != null) {
                                        const dt = new Date(m.scheduledTs);
                                        dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                    }
                                    return dayKey === currentDay;
                                });
                            
                                if (hasMatch) return true;
                            
                                const hasCatering = (cateringBufferRef.current || []).some((c) => {
                                    if (cleanCategory(c.category) !== cleanCategory(category)) return false;
                                    if (c.teamName !== teamName) return false;
                                    return c.dayKey === currentDay;
                                });
                            
                                return hasCatering;
                            })();
                            
                            const isSSPlayDay =
                                isSuperstructureTeam &&
                                ssPlayDatesByTeam[ssTeamKey] &&
                                currentDay != null &&
                                ssPlayDatesByTeam[ssTeamKey].has(currentDay);

                            const isSSLastDayWithUsers =
                                !isSSPlayDay &&
                                isSuperstructureTeam &&
                                currentDay != null &&
                                globalLastDay != null &&
                                currentDay === globalLastDay &&
                                groupCharForSS != null &&
                                usersTeamHasEventsOnDay;

                            const useGroupBasedMorningTransfers =
                                isSuperstructureTeam &&
                                currentDay != null &&
                                groupCharForSS != null &&
                                (
                                    isSSPlayDay ||
                                    isSSLastDayWithUsers ||
                                    usersTeamHasEventsOnDay
                                );
                        
                            const pavukTeamNextMatchInfo = (teamIdentifier, category) => {
                                if (!teamIdentifier || typeof teamIdentifier !== 'string') return null;
                                const s = teamIdentifier.toUpperCase();
                        
                                let targetMatchType = null;
                                const w16 = /W16F(\d{1,2})/.exec(s);
                                const w8 = /W8F(\d{1,2})/.exec(s);
                                const wqf = /WQF(\d{1,2})/.exec(s);
                                const wsf = /WSF(\d{1,2})/.exec(s);
                                const lsf = /LSF(\d{1,2})/.exec(s);
                        
                                if (w16) {
                                    const num = parseInt(w16[1], 10);
                                    targetMatchType = `osemfinále ${Math.ceil(num / 2)}`;
                                } else if (w8) {
                                    const num = parseInt(w8[1], 10);
                                    targetMatchType = `štvrťfinále ${Math.ceil(num / 2)}`;
                                } else if (wqf) {
                                    const num = parseInt(wqf[1], 10);
                                    targetMatchType = `semifinále ${num <= 2 ? 1 : 2}`;
                                } else if (wsf) {
                                    targetMatchType = 'finále';
                                } else if (lsf) {
                                    targetMatchType = 'o 3. miesto';
                                } else {
                                    return null;
                                }
                        
                                const nextMatch = matchesBufferRef.current.find((m) => {
                                    if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                    return m.matchType === targetMatchType;
                                });
                        
                                if (!nextMatch) {
                                    return { hasNext: false, nextHallId: null, nextHallName: null };
                                }
                        
                                return {
                                    hasNext: true,
                                    nextHallId: nextMatch.hallId || null,
                                    nextHallName: nextMatch.hallName || null,
                                };
                            };
                        
                            if (useGroupBasedMorningTransfers) {
                                const groupChar = ssGroupCharByTeam[ssTeamKey];
                                
                                const isRealRegisteredTeam = (tn, category) => {
                                    if (!tn) return false;
                                    if (String(tn).startsWith('(row team:')) return false;
                                    if (superstructureTeamNames.has(tn)) return false;
                                    const info = (teamsArrivalBufferRef.current || []).find(
                                        (t) => cleanCategory(t.category) === cleanCategory(category)
                                            && t.teamName === tn
                                    );
                                    if (!info) return false;
                                    if (info.isRegistered !== true) return false;
                                    if (info.isSuperstructure === true) return false;
                                    return true;
                                };
                            
                                const teamBelongsToChar = (tn, category) => {
                                    if (!tn) return false;
                                    if (!isRealRegisteredTeam(tn, category)) return false;
                                    const teamInfo = (teamsArrivalBufferRef.current || []).find(
                                        (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === tn
                                    );
                                    if (teamInfo && teamInfo.groupName) {
                                        return groupBelongsToChar(teamInfo.groupName, groupChar);
                                    }
                                    const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(tn).trim());
                                    if (m && m[1].toUpperCase() === groupChar) return true;
                                    return false;
                                };
                            
                                const groupHasAnyEventOnCurrentDay = (() => {
                                    const teamBelongsToCharLocal = (tn) => {
                                        if (!tn) return false;
                                        if (String(tn).startsWith('(row team:')) return false;
                                        const teamInfo = (teamsArrivalBufferRef.current || []).find(
                                            (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === tn
                                        );
                                        if (teamInfo && teamInfo.groupName) {
                                            return groupBelongsToChar(teamInfo.groupName, groupChar);
                                        }
                                        const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(tn).trim());
                                        if (m && m[1].toUpperCase() === groupChar) return true;
                                        return false;
                                    };

                                    const hasMatch = (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                const d = String(mm[1]).padStart(2, '0');
                                                const mo = String(mm[2]).padStart(2, '0');
                                                const y = mm[3];
                                                dayKey = `${y}-${mo}-${d}`;
                                            }
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        if (!dayKey || dayKey !== currentDay) return false;
                                        return [m.home, m.away].some((tn) => teamBelongsToCharLocal(tn));
                                    });
                                    if (hasMatch) return true;
                                
                                    const hasCatering = (cateringBufferRef.current || []).some((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return false;
                                        if (c.isSuperstructure === true) return false;
                                        const dayKey = c.dayKey || null;
                                        if (!dayKey || dayKey !== currentDay) return false;
                                        const tn = c.teamName;
                                        if (!tn) return false;
                                        return teamBelongsToCharLocal(tn);
                                    });
                                    return hasCatering;
                                })();
                            
                                const currentTeamHasOwnEventOnThisDay = (() => {
                                    const hasMatch = (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                        if (m.home !== teamName && m.away !== teamName) return false;
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                const d = String(mm[1]).padStart(2, '0');
                                                const mo = String(mm[2]).padStart(2, '0');
                                                const y = mm[3];
                                                dayKey = `${y}-${mo}-${d}`;
                                            }
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        return dayKey === currentDay;
                                    });
                                    if (hasMatch) return true;
                                    const hasCatering = (cateringBufferRef.current || []).some((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return false;
                                        if (c.teamName !== teamName) return false;
                                        return c.dayKey === currentDay;
                                    });
                                    return hasCatering;
                                })();
                            
                                let destinationEvent = null;
                                if (currentTeamHasOwnEventOnThisDay) {
                                    destinationEvent = current;
                                } else {
                                    const teamEvents = grouped[category][teamName] || [];
                                    const sortedEvents = [...teamEvents].sort((a, b) => {
                                        if (a.ts !== b.ts) return a.ts - b.ts;
                                        return String(a.text).localeCompare(String(b.text), 'sk');
                                    });
                                    for (const ev of sortedEvents) {
                                        const evDay = extractDayKeyFromWhen(ev.when);
                                        if (evDay && evDay > currentDay) {
                                            destinationEvent = ev;
                                            break;
                                        }
                                    }
                                    if (!destinationEvent) {
                                        destinationEvent = sortedEvents.find((ev) => ev.location) || null;
                                    }
                                }
                            
                                const useGroupEndLocationsAsSource = isSSPlayDay;

                                if (useGroupEndLocationsAsSource) {
                                    if (!destinationEvent || !destinationEvent.location) {
                                    } else {
                                        const destination = destinationEvent.location;
                            
                                        const uniqueSourceLocations = new Map();
                                        const updateUniqueSource = (loc, endTs) => {
                                            if (!loc) return;
                                            if (loc === destination) return;
                                            const existing = uniqueSourceLocations.get(loc);
                                            if (!existing || (endTs != null && endTs > (existing.endTs ?? -Infinity))) {
                                                uniqueSourceLocations.set(loc, { location: loc, endTs });
                                            }
                                        };
                            
                                        const referenceDay = currentDay;
                            
                                        matchesBufferRef.current.forEach((m) => {
                                            if (cleanCategory(m.category) !== cleanCategory(category)) return;
                            
                                            let dayKey = null;
                                            if (m.scheduledTime) {
                                                const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                                if (mm) {
                                                    const d = String(mm[1]).padStart(2, '0');
                                                    const mo = String(mm[2]).padStart(2, '0');
                                                    const y = mm[3];
                                                    dayKey = `${y}-${mo}-${d}`;
                                                }
                                            }
                                            if (!dayKey && m.scheduledTs != null) {
                                                const dt = new Date(m.scheduledTs);
                                                dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                            }
                                            if (!dayKey || dayKey !== referenceDay) return;
                            
                                            const endTs = m.scheduledEndTs != null
                                                ? m.scheduledEndTs
                                                : (m.scheduledTs != null ? m.scheduledTs : null);
                            
                                            [
                                                { name: m.home, identifier: m.homeTeamIdentifier },
                                                { name: m.away, identifier: m.awayTeamIdentifier },
                                            ].forEach(({ name: tn, identifier }) => {
                                                if (!tn) return;
                                                if (tn === teamName) return;
                                                if (!isRealRegisteredTeam(tn, category)) return;
                                                if (!teamBelongsToChar(tn, category)) return;
                            
                                                if (identifier) {
                                                    const nextInfo = pavukTeamNextMatchInfo(identifier, category);
                                                    if (nextInfo && nextInfo.hasNext) {
                                                        if (nextInfo.nextHallId != null && m.hallId != null && nextInfo.nextHallId === m.hallId) {
                                                            return;
                                                        }
                                                        if (nextInfo.nextHallId == null) {
                                                            return;
                                                        }
                                                    }
                                                }
                                                updateUniqueSource(m.hallName || null, endTs);
                                            });
                                        });
                            
                                        cateringBufferRef.current.forEach((c) => {
                                            if (cleanCategory(c.category) !== cleanCategory(category)) return;
                                            if (c.isSuperstructure === true) return;
                                            const dayKey = c.dayKey || null;
                                            if (!dayKey || dayKey !== referenceDay) return;
                            
                                            const tn = c.teamName;
                                            if (!tn) return;
                                            if (tn === teamName) return;
                                            if (!isRealRegisteredTeam(tn, category)) return;
                                            if (!teamBelongsToChar(tn, category)) return;
                            
                                            const endTs = c.slotToTs != null ? c.slotToTs : (c.ts != null ? c.ts : null);
                                            updateUniqueSource(c.placeName || null, endTs);
                                        });
                            
                                        if (!groupHasAnyEventOnCurrentDay) {
                                            (teamsArrivalBufferRef.current || []).forEach((t) => {
                                                if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                                if (!t.teamName) return;
                                                if (t.teamName === teamName) return;
                                                if (!t.accommodationName || t.accommodationName.trim() === '') return;
                                                if (!isRealRegisteredTeam(t.teamName, category)) return;
                                                if (!teamBelongsToChar(t.teamName, category)) return;
                                                updateUniqueSource(t.accommodationName.trim(), null);
                                            });
                                        }
                            
                                        const destinationArrivalStr =
                                            formatFullFromTs(destinationEvent.startTs) || destinationEvent.when;
                            
                                        const dayRefTs = destinationEvent.startTs != null
                                            ? destinationEvent.startTs
                                            : midnightFromWhen(destinationEvent.when);
                            
                                        Array.from(uniqueSourceLocations.values())
                                            .sort((a, b) => {
                                                if (a.endTs != null && b.endTs != null) return a.endTs - b.endTs;
                                                return String(a.location).localeCompare(String(b.location), 'sk');
                                            })
                                            .forEach((info) => {
                                                let departureStr;
                                                let whenStr;
                            
                                                if (info.endTs != null && currentTeamHasOwnEventOnThisDay) {
                                                    departureStr = formatFullFromTs(info.endTs) || '—';
                                                } else {
                                                    const departureTs = timestampOnDay(dayRefTs, 0, 0);
                                                    departureStr = formatFullFromTs(departureTs) || '00:00';
                                                }
                            
                                                if (departureStr && destinationArrivalStr) {
                                                    whenStr = `${departureStr} – ${destinationArrivalStr}`;
                                                } else if (destinationArrivalStr) {
                                                    whenStr = destinationArrivalStr;
                                                } else {
                                                    whenStr = destinationEvent.when;
                                                }
                            
                                                enriched.push({
                                                    ts: (currentTeamHasOwnEventOnThisDay ? current.ts : destinationEvent.ts) - 1,
                                                    when: whenStr,
                                                    type: 'transfer',
                                                    text: `Presun z ${info.location} do ${destination}`,
                                                    location: null,
                                                    isTransfer: true,
                                                });
                                            });
                                    }
                                } else {
                                    console.log(
                                        '%c[TRANSPORT][FALLBACK-ACCOM] ' + teamName + ' @ ' + currentDay + ' → groupHasAnyEventOnCurrentDay=false, generujem ranné presuny z ubytovní',
                                        'color:#dc2626;font-weight:bold;'
                                    );
                                    if (!destinationEvent || !destinationEvent.location) {
                                    } else {
                                        const destination = destinationEvent.location;
                            
                                        const uniqueSourceLocations = new Map();
                                        const updateUniqueSource = (loc, endTs) => {
                                            if (!loc) return;
                                            if (loc === destination) return;
                                            const existing = uniqueSourceLocations.get(loc);
                                            if (!existing || (endTs != null && endTs > (existing.endTs ?? -Infinity))) {
                                                uniqueSourceLocations.set(loc, { location: loc, endTs });
                                            }
                                        };
                            
                                        const derivedGroupName = `skupina ${groupCharPre}`;
                                        const cacheKey = `${cleanCategory(category)}|${derivedGroupName}`;
                                        const cacheAccoms = (window.__transport_accommodationsByGroup || {})[cacheKey] || [];

                                        if (cacheAccoms.length > 0) {
                                            cacheAccoms.forEach((accomName) => {
                                                if (!accomName) return;
                                                updateUniqueSource(accomName.trim(), null);
                                            });
                                        } else {
                                            (teamsArrivalBufferRef.current || []).forEach((t) => {
                                                if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                                if (!t.teamName) return;
                                                if (t.teamName === teamName) return;
                                                if (!t.accommodationName || t.accommodationName.trim() === '') return;
                                        
                                                let belongsToChar = false;
                                                if (t.groupName) {
                                                    belongsToChar = groupBelongsToChar(t.groupName, groupCharPre);
                                                } else {
                                                    const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(t.teamName).trim());
                                                    if (m && m[1].toUpperCase() === groupCharPre) {
                                                        belongsToChar = true;
                                                    }
                                                }
                                                if (!belongsToChar) return;

                                                updateUniqueSource(t.accommodationName.trim(), null);
                                            });
                                        }
                            
                                        const destinationArrivalStr =
                                            formatFullFromTs(destinationEvent.startTs) || destinationEvent.when;
                            
                                        const dayRefTs = destinationEvent.startTs != null
                                            ? destinationEvent.startTs
                                            : midnightFromWhen(destinationEvent.when);
                            
                                        Array.from(uniqueSourceLocations.values())
                                            .sort((a, b) => {
                                                if (a.endTs != null && b.endTs != null) return a.endTs - b.endTs;
                                                return String(a.location).localeCompare(String(b.location), 'sk');
                                            })
                                            .forEach((info) => {
                                                const departureTs = timestampOnDay(dayRefTs, 0, 0);
                                                const departureStr = formatFullFromTs(departureTs) || '00:00';
                            
                                                let whenStr;
                                                if (departureStr && destinationArrivalStr) {
                                                    whenStr = `${departureStr} – ${destinationArrivalStr}`;
                                                } else if (destinationArrivalStr) {
                                                    whenStr = destinationArrivalStr;
                                                } else {
                                                    whenStr = destinationEvent.when;
                                                }
                            
                                                enriched.push({
                                                    ts: destinationEvent.ts - 1,
                                                    when: whenStr,
                                                    type: 'transfer',
                                                    text: `Presun z ${info.location} do ${destination}`,
                                                    location: null,
                                                    isTransfer: true,
                                                });
                                            });
                                    }
                                }
                            } else {                        
                                const ssTeamKeyForGroup = `${cleanCategory(category)}|${teamName}`;
                                const groupCharForSSGroup = ssGroupCharByTeam[ssTeamKeyForGroup];
                                const ssTeamKey = ssTeamKeyForGroup;
                                
                                const isPureSuperstructureGroup = (() => {
                                    if (!isSuperstructureTeam || !groupCharForSSGroup) return false;
                        
                                    let hasUsersTeam = false;
                                    let hasAnyTeam = false;
                        
                                    (teamsArrivalBufferRef.current || []).forEach((t) => {
                                        if (cleanCategory(t.category) !== cleanCategory(category)) return;
                        
                                        let belongsToChar = false;
                                        if (t.groupName) {
                                            belongsToChar = groupBelongsToChar(t.groupName, groupCharForSSGroup);
                                        } else if (t.teamName) {
                                            const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(t.teamName).trim());
                                            if (m && m[1].toUpperCase() === groupCharForSSGroup) {
                                                belongsToChar = true;
                                            }
                                        }
                                        if (!belongsToChar) return;
                        
                                        hasAnyTeam = true;
                        
                                        if (t.isRegistered === true && t.isSuperstructure !== true) {
                                            hasUsersTeam = true;
                                        }
                                    });
                        
                                    return hasAnyTeam && !hasUsersTeam;
                                })();
                        
                                const ssTeamHasMatchOnDay = (teamNameToCheck) => {
                                    return (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                        if (m.home !== teamNameToCheck && m.away !== teamNameToCheck) return false;
                        
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                const d = String(mm[1]).padStart(2, '0');
                                                const mo = String(mm[2]).padStart(2, '0');
                                                const y = mm[3];
                                                dayKey = `${y}-${mo}-${d}`;
                                            }
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        return dayKey === currentDay;
                                    });
                                };
                        
                                const anySSGroupTeamPlaysToday = (() => {
                                    if (!isPureSuperstructureGroup || currentDay == null) return false;
                                    return (teamsArrivalBufferRef.current || []).some((t) => {
                                        if (cleanCategory(t.category) !== cleanCategory(category)) return false;
                                        if (t.isSuperstructure !== true) return false;
                                        if (!t.teamName) return false;
                        
                                        let belongsToChar = false;
                                        if (t.groupName) {
                                            belongsToChar = groupBelongsToChar(t.groupName, groupCharForSSGroup);
                                        } else {
                                            const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(t.teamName).trim());
                                            if (m && m[1].toUpperCase() === groupCharForSSGroup) {
                                                belongsToChar = true;
                                            }
                                        }
                                        if (!belongsToChar) return false;
                        
                                        return ssTeamHasMatchOnDay(t.teamName);
                                    });
                                })();
                        
                                if (isPureSuperstructureGroup && anySSGroupTeamPlaysToday && current.location && isSSPlayDay) {
                                    const destination = current.location;
                        
                                    const ssTeamLastEnd = new Map();
                        
                                    const updateSSLastEnd = (tn, location, endTs) => {
                                        if (!tn || !location || endTs == null) return;
                                        if (tn === teamName) return;
                                        const existing = ssTeamLastEnd.get(tn);
                                        if (!existing || endTs > existing.endTs) {
                                            ssTeamLastEnd.set(tn, { location, endTs });
                                        }
                                    };
                        
                                    matchesBufferRef.current.forEach((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return;
                        
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                const d = String(mm[1]).padStart(2, '0');
                                                const mo = String(mm[2]).padStart(2, '0');
                                                const y = mm[3];
                                                dayKey = `${y}-${mo}-${d}`;
                                            }
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        if (!dayKey || dayKey !== currentDay) return;
                        
                                        const endTs = m.scheduledEndTs != null
                                            ? m.scheduledEndTs
                                            : (m.scheduledTs != null ? m.scheduledTs : null);
                        
                                        [m.home, m.away].forEach((tn) => {
                                            if (!tn) return;
                                            if (tn === teamName) return;
                        
                                            const info = (teamsArrivalBufferRef.current || []).find(
                                                (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === tn
                                            );
                                            if (!info) return;
                                            if (info.isSuperstructure !== true) return;
                        
                                            let belongsToChar = false;
                                            if (info.groupName) {
                                                belongsToChar = groupBelongsToChar(info.groupName, groupCharForSSGroup);
                                            } else {
                                                const mm2 = /\d([A-ZÁ-Ž])\s*$/.exec(String(tn).trim());
                                                if (mm2 && mm2[1].toUpperCase() === groupCharForSSGroup) {
                                                    belongsToChar = true;
                                                }
                                            }
                                            if (!belongsToChar) return;
                        
                                            const identifier = tn === m.home ? m.homeTeamIdentifier : m.awayTeamIdentifier;
                                            if (identifier) {
                                                const nextInfo = pavukTeamNextMatchInfo(identifier, category);
                                                if (nextInfo && nextInfo.hasNext) {
                                                    if (nextInfo.nextHallId != null && m.hallId != null && nextInfo.nextHallId === m.hallId) {
                                                        return;
                                                    }
                                                    if (nextInfo.nextHallId == null) {
                                                        return;
                                                    }
                                                }
                                            }
                        
                                            updateSSLastEnd(tn, m.hallName || null, endTs);
                                        });
                                    });
                        
                                    cateringBufferRef.current.forEach((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return;
                                        if (c.isSuperstructure !== true) return;
                                        if (c.dayKey !== currentDay) return;
                                        if (c.teamName === teamName) return;
                        
                                        let belongsToChar = false;
                                        const info = (teamsArrivalBufferRef.current || []).find(
                                            (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === c.teamName
                                        );
                                        if (info && info.groupName) {
                                            belongsToChar = groupBelongsToChar(info.groupName, groupCharForSSGroup);
                                        } else {
                                            const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(c.teamName).trim());
                                            if (m && m[1].toUpperCase() === groupCharForSSGroup) {
                                                belongsToChar = true;
                                            }
                                        }
                                        if (!belongsToChar) return;
                        
                                        const endTs = c.slotToTs != null ? c.slotToTs : (c.ts != null ? c.ts : null);
                                        updateSSLastEnd(c.teamName, c.placeName || null, endTs);
                                    });
                        
                                    const uniqueSourceLocations = new Map();
                                    ssTeamLastEnd.forEach((info) => {
                                        if (!info || !info.location) return;
                                        if (info.location === destination) return;
                        
                                        const existing = uniqueSourceLocations.get(info.location);
                                        if (!existing || info.endTs > existing.endTs) {
                                            uniqueSourceLocations.set(info.location, info);
                                        }
                                    });
                        
                                    const destinationArrivalStr = formatFullFromTs(current.startTs) || current.when;
                        
                                    Array.from(uniqueSourceLocations.values())
                                        .sort((a, b) => a.endTs - b.endTs)
                                        .forEach((info) => {
                                            if (info.endTs != null && current.startTs != null && info.endTs >= current.startTs) {
                                                return;
                                            }
                        
                                            const departureStr = formatFullFromTs(info.endTs) || '—';
                        
                                            let whenStr;
                                            if (departureStr && destinationArrivalStr) {
                                                whenStr = `${departureStr} – ${destinationArrivalStr}`;
                                            } else if (destinationArrivalStr) {
                                                whenStr = destinationArrivalStr;
                                            } else {
                                                whenStr = current.when;
                                            }
                        
                                            enriched.push({
                                                ts: current.ts - 1,
                                                when: whenStr,
                                                type: 'transfer',
                                                text: `Presun z ${info.location} do ${destination}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        });
                                }
                        
                                const skipClassicMorningTransfers =
                                    isPureSuperstructureGroup && anySSGroupTeamPlaysToday && isSSPlayDay;
                                
                                const isSSPlayDayForSkip =
                                    isSuperstructureTeam &&
                                    ssPlayDatesByTeam[ssTeamKeyForGroup] &&
                                    currentDay != null &&
                                    ssPlayDatesByTeam[ssTeamKeyForGroup].has(currentDay); 
                                
                                if (!skipClassicMorningTransfers && !isSSPlayDayForSkip) {
                                
                                    const hasTransportType = (() => {
                                        if (!teamArrivalType) return false;
                                        const norm = String(teamArrivalType)
                                            .toLowerCase()
                                            .normalize('NFD')
                                            .replace(/[\u0300-\u036f]/g, '')
                                            .trim();
                                        if (!norm) return false;
                                        if (norm.includes('vlastn')) return false;
                                        if (norm.includes('bez dopravy')) return false;
                                        if (norm.includes('ziadna')) return false;
                                        if (norm.includes('žiadna')) return false;
                                        return true;
                                    })();
                                
                                    const isOwnOrNoTransport = (() => {
                                        if (!teamArrivalType) return false;
                                        const norm = String(teamArrivalType)
                                            .toLowerCase()
                                            .normalize('NFD')
                                            .replace(/[\u0300-\u036f]/g, '')
                                            .trim();
                                        if (!norm) return false;
                                        if (norm.includes('vlastn')) return true;
                                        if (norm.includes('bez dopravy')) return true;
                                        if (norm.includes('ziadna')) return true;
                                        if (norm.includes('žiadna')) return true;
                                        return false;
                                    })();
                                
                                    const isGlobalFirstDay =
                                        currentDay != null &&
                                        globalFirstDay != null &&
                                        currentDay === globalFirstDay;
                                
                                    const useExternalStopOnFirstDay =
                                        isGlobalFirstDay &&
                                        hasTransportType &&
                                        !!externalArrivalStop;
                                
                                    const useMeetingPointOnFirstDay =
                                        isGlobalFirstDay &&
                                        isOwnOrNoTransport &&
                                        !!meetingPointStop;
                                
                                    const useAccommodationAsSource = (() => {
                                        if (!isGlobalFirstDay) {
                                            return shouldGenerateAccommodationTransfers;
                                        }
                                        return hasTransportType
                                            && !useExternalStopOnFirstDay
                                            && shouldGenerateAccommodationTransfers;
                                    })();
                                
                                    const shouldGenerateMorningTransfer =
                                        useExternalStopOnFirstDay || useAccommodationAsSource || useMeetingPointOnFirstDay;
                                
                                    if (shouldGenerateMorningTransfer) {
                                        const morningFromLocations = (() => {
                                            if (useExternalStopOnFirstDay) {
                                                return [{
                                                    name: externalArrivalStop.name,
                                                    isExternalStop: true,
                                                    isMeetingPoint: false,
                                                }];
                                            }
                                            if (useMeetingPointOnFirstDay) {
                                                return [{
                                                    name: meetingPointStop.name,
                                                    isExternalStop: false,
                                                    isMeetingPoint: true,
                                                }];
                                            }
                                            if (useAccommodationAsSource) {
                                                return teamAccommodationsList.map((n) => ({
                                                    name: n,
                                                    isExternalStop: false,
                                                    isMeetingPoint: false,
                                                }));
                                            }
                                            return [];
                                        })();
                                
                                        morningFromLocations.forEach(({ name: fromLocationName, isExternalStop, isMeetingPoint }) => {
                                            if (!fromLocationName) return;
                                            if (fromLocationName === current.location) return;
                                
                                            const fromLabel = isExternalStop
                                                ? `zastávka ${fromLocationName}`
                                                : isMeetingPoint
                                                    ? `miesto zrazu ${fromLocationName}`
                                                    : `ubytovanie ${fromLocationName}`;
                                
                                            const dayRefTs =
                                                current.startTs != null
                                                    ? current.startTs
                                                    : midnightFromWhen(current.when);
                                
                                            const arrivalTs = current.startTs != null ? current.startTs : null;
                                            const arrivalStr =
                                                formatFullFromTs(arrivalTs) || current.when;
                                
                                            let departureTs;
                                            let departureStr;
                                            const teamArrivalTime = (arrivalTimeByTeam[category] && arrivalTimeByTeam[category][teamName]) || '';

                                            if (isExternalStop && teamArrivalTime && /^\d{1,2}:\d{2}$/.test(teamArrivalTime)) {
                                                const [h, mi] = teamArrivalTime.split(':').map(Number);
                                                departureTs = timestampOnDay(dayRefTs, h, mi);
                                                departureStr = formatFullFromTs(departureTs) || teamArrivalTime;
                                            } else if (isMeetingPoint) {
                                                const globalArrivalTs = window.__transport_tournamentArrivalDate || null;
                                            
                                                if (globalArrivalTs != null && isFinite(globalArrivalTs)) {
                                                    departureTs = globalArrivalTs;
                                                    departureStr = formatFullFromTs(departureTs) || '—';
                                                } else {
                                                    departureTs = timestampOnDay(dayRefTs, 0, 0);
                                                    departureStr = formatFullFromTs(departureTs) || '00:00';
                                                }
                                            } else {
                                                departureTs = timestampOnDay(dayRefTs, 0, 0);
                                                departureStr = formatFullFromTs(departureTs) || '00:00';
                                            }
                                
                                            if (
                                                departureTs != null &&
                                                arrivalTs != null &&
                                                departureTs >= arrivalTs
                                            ) {
                                                return;
                                            }
                                
                                            let whenStr;
                                            if (departureStr && arrivalStr) {
                                                whenStr = `${departureStr} – ${arrivalStr}`;
                                            } else if (arrivalStr) {
                                                whenStr = arrivalStr;
                                            } else {
                                                whenStr = current.when;
                                            }
                                
                                            enriched.push({
                                                ts: current.ts - 1,
                                                when: whenStr,
                                                type: 'transfer',
                                                text: buildTransferText(
                                                    null,
                                                    current,
                                                    fromLabel,
                                                    `${current.location}`,
                                                    false,
                                                    departureStr,
                                                    arrivalStr
                                                ),
                                                location: null,
                                                isTransfer: true,
                                            });
                                        });
                                    }
                                }
                            }
                        }

                        enriched.push(current);

                        const currentIsTimedEvent =
                            current.type === 'match' || current.type === 'catering';
                        
                        if (
                            next &&
                            currentIsTimedEvent &&
                            current.location &&
                            next.location &&
                            current.location !== next.location &&
                            currentDay != null &&
                            nextDay != null &&
                            currentDay === nextDay
                        ) {
                            const departureTs =
                                current.endTs != null ? current.endTs : current.startTs;
                            const arrivalTs =
                                next.startTs != null ? next.startTs : null;
                        
                            if (
                                departureTs != null &&
                                arrivalTs != null &&
                                departureTs >= arrivalTs
                            ) {
                            } else {
                                const departureStr = formatFullFromTs(departureTs);
                                const arrivalStr = formatFullFromTs(arrivalTs);
                        
                                let whenStr;
                                if (departureStr && arrivalStr) {
                                    whenStr = `${departureStr} – ${arrivalStr}`;
                                } else if (departureStr) {
                                    whenStr = departureStr;
                                } else if (arrivalStr) {
                                    whenStr = arrivalStr;
                                } else {
                                    whenStr = current.when;
                                }
                        
                                enriched.push({
                                    ts: current.ts + 0.5,
                                    when: whenStr,
                                    type: 'transfer',
                                    text: buildTransferText(
                                        current,
                                        next,
                                        `${current.location}`,
                                        `${next.location}`
                                    ),
                                    location: null,
                                    isTransfer: true,
                                });
                            }
                        }

                        const isPavukTeamName = /\b(WSF|LSF|WQF|W8F|W16F)\d*/i.test(String(teamName));
                        if (
                            isPavukTeamName &&
                            next &&
                            currentIsTimedEvent &&
                            current.location &&
                            next.location &&
                            current.location !== next.location &&
                            currentDay != null &&
                            nextDay != null &&
                            currentDay !== nextDay
                        ) {
                            const departureTs =
                                current.endTs != null ? current.endTs : current.startTs;
                            const arrivalTs =
                                next.startTs != null ? next.startTs : null;

                            if (
                                departureTs != null &&
                                arrivalTs != null &&
                                departureTs < arrivalTs
                            ) {
                                const departureStr = formatFullFromTs(departureTs);
                                const arrivalStr = formatFullFromTs(arrivalTs);

                                let whenStr;
                                if (departureStr && arrivalStr) {
                                    whenStr = `${departureStr} – ${arrivalStr}`;
                                } else if (departureStr) {
                                    whenStr = departureStr;
                                } else if (arrivalStr) {
                                    whenStr = arrivalStr;
                                } else {
                                    whenStr = current.when;
                                }

                                enriched.push({
                                    ts: current.ts + 0.5,
                                    when: whenStr,
                                    type: 'transfer',
                                    text: `Presun z ${current.location} do ${next.location}`,
                                    location: null,
                                    isTransfer: true,
                                });
                            }
                        }
                                            
                        const isVeryLastEventOfTeam = (next == null);
                    
                        if (
                            isLastEventOfDay &&
                            !isVeryLastEventOfTeam &&
                            currentDay !== globalLastDay &&
                            current.location
                        ) {
                            if (shouldGenerateAccommodationTransfers) {
                                const departureTs =
                                    current.endTs != null ? current.endTs : current.startTs;
                        
                                const dayRefTs =
                                    departureTs != null
                                        ? departureTs
                                        : midnightFromWhen(current.when);
                        
                                const departureStr =
                                    formatFullFromTs(departureTs) || current.when;
                        
                                const arrivalTs =
                                    dayRefTs != null
                                        ? timestampOnDay(dayRefTs, 23, 59)
                                        : null;
                        
                                const arrivalStr =
                                    formatFullFromTs(arrivalTs) || '23:59';
                        
                                if (
                                    departureTs != null &&
                                    arrivalTs != null &&
                                    departureTs >= arrivalTs
                                ) {
                                } else {
                                    let whenStr;
                                    if (departureStr && arrivalStr) {
                                        whenStr = `${departureStr} – ${arrivalStr}`;
                                    } else if (departureStr) {
                                        whenStr = departureStr;
                                    } else {
                                        whenStr = current.when;
                                    }
                        
                                    teamAccommodationsList.forEach((accomName) => {
                                        if (!accomName) return;
                                        if (accomName === current.location) return;
                        
                                        enriched.push({
                                            ts: current.ts + 1,
                                            when: whenStr,
                                            type: 'transfer',
                                            text: `Presun z ${current.location} do ubytovanie ${accomName}`,
                                            location: null,
                                            isTransfer: true,
                                        });
                                    });
                                }
                            }
                        }
                    }

                    enriched.sort((a, b) => {
                        if (a.ts !== b.ts) return a.ts - b.ts;
                        return String(a.text).localeCompare(String(b.text), 'sk');
                    });

                    try {
                        const transfersForTeam = enriched.filter((ev) => ev.isTransfer === true);
                        if (transfersForTeam.length > 0 && window.db) {
                            const foundTeamIdentifiers = findTeamIdentifiersByName(category, teamName);
                            const isSuperstructureTeamForDb = !foundTeamIdentifiers;
                            
                            const effectiveTeamIdentifiers = isSuperstructureTeamForDb
                                ? { teamUid: null, teamIndex: null, category }
                                : foundTeamIdentifiers;

                            if (isSuperstructureTeamForDb) {
                                console.log(
                                    '%c[TRANSPORT][SUPERSTRUCTURE] Ukladám presuny pre superstructure tím:',
                                    'color:#7c3aed;font-weight:bold;',
                                    teamName, 'v kategórii', category,
                                    '(teamUid=null, teamIndex=null, teamName="' + teamName + '")'
                                );
                            } else {
                                if (effectiveTeamIdentifiers.teamUid == null || effectiveTeamIdentifiers.teamIndex == null) {
                                    console.warn(
                                        '[TRANSPORT] Tím z users nemá platný teamUid/teamIndex – presuny sa neukladajú:',
                                        { category, teamName }
                                    );
                                    return;
                                }
                            }
                    
                            const transfersPatch = {};
                            const newKeys = new Set();

                            transfersForTeam.forEach((ev) => {
                                let fromLocationText = '';
                                let toLocationText = '';
                                const m = /^Presun z (.+?) do (.+)$/.exec(String(ev.text || ''));
                                if (m) {
                                    fromLocationText = m[1].trim();
                                    toLocationText = m[2].trim();
                                }

                                const fromId = resolvePlaceIdByName(fromLocationText);
                                const toId = resolvePlaceIdByName(toLocationText);

                                const evDayKey = extractDayKeyFromWhen(ev.when) || null;

                                const existingParentWithStops = (savedTransfersRef.current || []).find((s) => {
                                    if (cleanCategory(s.category || '') !== cleanCategory(category)) return false;
                                    if (String(s.teamName || '').trim() !== teamName) return false;
                                    const sFromId = s.fromId || null;
                                    const sToId = s.toId || null;
                                    if (sFromId !== fromId || sToId !== toId) return false;
                                    if ((s.dayKey || '') !== (evDayKey || '')) return false;
                                    if (s._parentKey && s._parentKey !== s.key) return false;
                                    if (!Array.isArray(s.intermediateStopIds) || s.intermediateStopIds.length === 0) return false;
                                    return true;
                                });
                                
                                const existingDirectParent = (savedTransfersRef.current || []).find((s) => {
                                    if (cleanCategory(s.category || '') !== cleanCategory(category)) return false;
                                    if (String(s.teamName || '').trim() !== teamName) return false;
                                    const sFromId = s.fromId || null;
                                    const sToId = s.toId || null;
                                    if (sFromId !== fromId || sToId !== toId) return false;
                                    if ((s.dayKey || '') !== (evDayKey || '')) return false;
                                    if (s._parentKey && s._parentKey !== s.key) return false;
                                    if (Array.isArray(s.intermediateStopIds) && s.intermediateStopIds.length > 0) return false;
                                    return true;
                                });
                                
                                const key = existingParentWithStops
                                    ? existingParentWithStops.key
                                    : (existingDirectParent
                                        ? existingDirectParent.key
                                        : buildTransferKey(category, teamName, ev.when, ev.text));
                                newKeys.add(key);
                                
                                const existingSaved = existingParentWithStops || existingDirectParent || (savedTransfersRef.current || []).find((s) => s.key === key);
                                
                                const baseRecord = {
                                    category: cleanCategory(category),
                                    teamUid: effectiveTeamIdentifiers.teamUid,
                                    teamIndex: effectiveTeamIdentifiers.teamIndex,
                                    when: String(ev.when || '').trim(),
                                    fromId,
                                    toId,
                                    dayKey: extractDayKeyFromWhen(ev.when) || null,
                                };
                                
                                if (isSuperstructureTeamForDb) baseRecord.teamName = teamName;
                                
                                if (existingSaved) {
                                    if (Array.isArray(existingSaved.intermediateStopIds) && existingSaved.intermediateStopIds.length > 0) {
                                        baseRecord.intermediateStopIds = [...existingSaved.intermediateStopIds];
                                    }
                                    if (existingSaved.isWalking === true) {
                                        baseRecord.isWalking = true;
                                        baseRecord.walkingSetAt = existingSaved.walkingSetAt || Timestamp.fromDate(new Date());
                                        baseRecord.walkingSetBy = existingSaved.walkingSetBy || (userProfileData && userProfileData.email) || null;
                                    }
                                }
                                
                                const draft = {
                                    ...baseRecord,
                                    key,
                                    segments: Array.isArray(existingSaved?.segments)
                                        ? existingSaved.segments.map((s) => ({ ...s }))
                                        : buildDefaultSegments(baseRecord),
                                };
                                
                                if (existingSaved && Array.isArray(existingSaved.intermediateStopIds) && existingSaved.intermediateStopIds.length > 0) {
                                    const stopsIds = existingSaved.intermediateStopIds.filter(Boolean);
                                    const routeIdsRaw = [fromId, ...stopsIds, toId].filter(Boolean);
                                    const routeIds = [];
                                    routeIdsRaw.forEach((id) => {
                                        if (routeIds.length === 0 || routeIds[routeIds.length - 1] !== id) routeIds.push(id);
                                    });
                                
                                    const existingSegs = Array.isArray(draft.segments) ? draft.segments : [];
                                    const missingSegments = [];
                                    for (let i = 0; i < routeIds.length - 1; i++) {
                                        const segFrom = routeIds[i];
                                        const segTo = routeIds[i + 1];
                                        if (segFrom === segTo) continue;
                                        const found = existingSegs.find((s) => s.fromId === segFrom && s.toId === segTo);
                                        if (!found) {
                                            missingSegments.push({ fromId: segFrom, toId: segTo });
                                        }
                                    }
                                
                                    if (missingSegments.length > 0) {
                                        const newSegments = [];
                                        for (let i = 0; i < routeIds.length - 1; i++) {
                                            const segFrom = routeIds[i];
                                            const segTo = routeIds[i + 1];
                                            if (segFrom === segTo) continue;
                                            const existingSeg = existingSegs.find((s) => s.fromId === segFrom && s.toId === segTo);
                                            if (existingSeg) {
                                                newSegments.push({ ...existingSeg });
                                            } else {
                                                newSegments.push({
                                                    fromId: segFrom,
                                                    toId: segTo,
                                                    startTs: null,
                                                    endTs: null,
                                                    when: null,
                                                    isWalking: false,
                                                    busAssigned: false,
                                                    walkingSetAt: null,
                                                    walkingSetBy: null,
                                                });
                                            }
                                        }
                                        draft.segments = newSegments;
                                        console.log(
                                            '%c[TRANSPORT][DOGENEROVANIE] Dogenerované chýbajúce segmenty pre parent:',
                                            'color:#059669;font-weight:bold;',
                                            { parentKey: key, missingSegments, allSegments: newSegments.map((s) => `${s.fromId}→${s.toId}`) }
                                        );
                                    }
                                }
                                
                                recomputeParentSegmentsInPlace(draft);

                                transfersPatch[key] = {
                                    category: draft.category,
                                    teamUid: draft.teamUid,
                                    teamIndex: draft.teamIndex,
                                    dayKey: draft.dayKey,
                                    fromId: draft.fromId,
                                    toId: draft.toId,
                                    when: draft.when,
                                    segments: draft.segments,
                                };

                                if (isSuperstructureTeamForDb) transfersPatch[key].teamName = teamName;
                                if (Array.isArray(draft.intermediateStopIds) && draft.intermediateStopIds.length > 0) {
                                    transfersPatch[key].intermediateStopIds = draft.intermediateStopIds;
                                }

                                if (draft.isWalking === true) {
                                    transfersPatch[key].isWalking = true;
                                    transfersPatch[key].walkingSetAt = draft.walkingSetAt;
                                    transfersPatch[key].walkingSetBy = draft.walkingSetBy;

                                    transfersPatch[key].when = '';
                                    transfersPatch[key].segments = (draft.segments || []).map((s) => ({
                                        ...s,
                                        startTs: null,
                                        endTs: null,
                                        when: null,
                                        busAssigned: false,
                                    }));
                                }

                                if (existingSaved) {
                                    if (existingSaved.isWalking === true) {
                                        transfersPatch[key].isWalking = true;
                                        transfersPatch[key].walkingSetAt = existingSaved.walkingSetAt || Timestamp.fromDate(new Date());
                                        transfersPatch[key].walkingSetBy = existingSaved.walkingSetBy || (userProfileData && userProfileData.email) || null;
                                    }
                                }
                            });

                            const categoryClean = cleanCategory(category);
                            (savedTransfersRef.current || []).forEach((s) => {
                                if (cleanCategory(s.category || '') !== categoryClean) return;

                                const sameTeam =
                                    (effectiveTeamIdentifiers.teamUid != null
                                        && s.teamUid === effectiveTeamIdentifiers.teamUid
                                        && s.teamIndex === effectiveTeamIdentifiers.teamIndex)
                                    || (effectiveTeamIdentifiers.teamUid == null
                                        && String(s.teamName || '').trim() === teamName);

                                if (!sameTeam) return;
                                if (newKeys.has(s.key)) return;
                                if (Array.isArray(s.intermediateStopIds) && s.intermediateStopIds.length > 0) return;
                                if (s._parentKey && s._parentKey !== s.key) {
                                    const parentExists = (savedTransfersRef.current || []).some(
                                        (p) => p.key === s._parentKey && Array.isArray(p.intermediateStopIds) && p.intermediateStopIds.length > 0
                                    );
                                    if (parentExists) return;
                                }
                                transfersPatch[s.key] = deleteField();
                            });

                            if (Object.keys(transfersPatch).length > 0) {
                                setDoc(
                                    doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC),
                                    { [TRANSPORT_TRANSFERS_FIELD]: transfersPatch },
                                    { merge: true }
                                ).catch((err) => {
                                    console.error('[TRANSPORT] Chyba pri ukladaní presunov do DB:', err);
                                });
                            }
                        }
                    } catch (e) {
                        console.error('[TRANSPORT] Chyba pri príprave presunov na uloženie:', e);
                    }
    
                    const timelineLines = renderTeamTimeline(category, teamName, enriched, {
                        isSuperstructureTeam,
                        teamGroupName,
                        getGroupLastChar,
                        groupBelongsToChar,
                        formatDateDDMMYYYY,
                        extractDayKeyFromWhen,
                    });

                    timelineLines.forEach((line) => {
                        if (line.includes('🚐')) {
                            console.log('%c' + line, 'font-weight: bold; color: #2563eb;');
                        } else if (line.startsWith('─────')) {
                            console.log('%c' + line, 'color: #16a34a; font-weight: bold;');
                        } else if (line.includes('[superstructure]')) {
                            console.log('%c' + line, 'color:#7c3aed;font-weight:bold;');
                        } else {
                            console.log(line);
                        }
                    });
                });
            });
        }
        
        console.log('[TRANSPORT] ===============================================');
    };

    useEffect(() => {
        if (!window.db) return;

        let unsubscribeRegistration = null;
        let unsubscribeMatches = null;
        let unsubscribeCatering = null;
        let unsubscribePlaces = null;
        let unsubscribeAllPlaces = null;
        let unsubscribeCateringSettings = null;
        let unsubscribeCategorySettings = null;

        try {
            const placesRef = collection(window.db, 'places');
            unsubscribePlaces = onSnapshot(placesRef, (snapshot) => {
                const map = {};
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    map[docSnap.id] = data.name || '(bez názvu)';
                });
                placesMapRef.current = map;
        
                console.log('[TRANSPORT][places-map] Načítaná mapa placeId → názov:', {
                    count: Object.keys(map).length,
                    map,
                });
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(places) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na places:', e);
        }

        try {
            const placesRef = collection(window.db, 'places');
            unsubscribeAllPlaces = onSnapshot(placesRef, (snapshot) => {
                const list = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    const loc = data.location;
                    list.push({
                        id: docSnap.id,
                        name: data.name || '(bez názvu)',
                        type: data.type || '(neznámy typ)',
                        capacity: data.capacity ?? null,
                        accommodationType: data.accommodationType || null,
                        note: data.note || null,
                        lat: loc?.latitude ?? data.lat ?? null,
                        lng: loc?.longitude ?? data.lng ?? null,
                        headerColor: data.headerColor || '#1e40af',
                        headerTextColor: data.headerTextColor || '#000000',
                        isExternalArrivalStop: data.isExternalArrivalStop === true,
                        isMeetingPointStop: data.isMeetingPointStop === true,
                    });
                });
                list.sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));
                setAllPlaces(list);
                allPlacesRef.current = list;
                setPlacesLoaded(true);
        
                const stopsOnly = list.filter((p) => p.type === 'zastavka');
                console.log('[TRANSPORT][places-all] Načítané všetky miesta:', {
                    total: list.length,
                    stopsCount: stopsOnly.length,
                    stops: stopsOnly.map((s) => ({
                        id: s.id,
                        name: s.name,
                        isExternalArrivalStop: s.isExternalArrivalStop,
                        isMeetingPointStop: s.isMeetingPointStop,
                    })),
                    types: list.reduce((acc, p) => {
                        acc[p.type] = (acc[p.type] || 0) + 1;
                        return acc;
                    }, {}),
                });
        
                if (matchesLoadedRef.current && cateringLoadedRef.current && teamsLoadedRef.current) {
                    rebuildAndLogTimeline();
                }
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(places) pre záložku Nastavenia error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na places (Nastavenia):', e);
        }

        let unsubscribeTravelTimes = null;
        try {
            const ttRef = doc(window.db, 'settings', 'transportTravelTimes');
            unsubscribeTravelTimes = onSnapshot(ttRef, (snap) => {
                const map = {};
                const transfers = [];
                if (snap.exists()) {
                    const data = snap.data() || {};
                    const raw = data.times || {};
                    Object.entries(raw).forEach(([key, v]) => {
                        if (v == null) return;
                        map[key] = {
                            fromId: v.fromId || null,
                            fromName: v.fromName || null,
                            toId: v.toId || null,
                            toName: v.toName || null,
                            minutes: Number(v.minutes) || 0,
                        };
                    });
                
                    const rawTransfers = data[TRANSPORT_TRANSFERS_FIELD] || {};
                    Object.entries(rawTransfers).forEach(([key, v]) => {
                        if (!v) return;
                        transfers.push({
                            key,
                            category: v.category || '',
                            teamUid: v.teamUid || null,
                            teamIndex: v.teamIndex ?? null,
                            teamName: v.teamName || null,
                            when: v.when || '',
                            fromId: v.fromId || resolvePlaceIdByName(v.fromLocation),
                            toId: v.toId || resolvePlaceIdByName(v.toLocation),
                            fromLocation: resolvePlaceNameById(v.fromId) || v.fromLocation || '',
                            toLocation: resolvePlaceNameById(v.toId) || v.toLocation || '',
                            text: v.text || (v.fromId && v.toId
                                ? `Presun z ${resolvePlaceNameById(v.fromId)} do ${resolvePlaceNameById(v.toId)}`
                                : ''),
                            dayKey: v.dayKey || null,
                            isWalking: v.isWalking === true,
                            walkingSetAt: v.walkingSetAt || null,
                            walkingSetBy: v.walkingSetBy || null,
                            intermediateStopIds: Array.isArray(v.intermediateStopIds)
                                ? v.intermediateStopIds
                                : (Array.isArray(v.intermediateStops)
                                    ? v.intermediateStops.map(resolvePlaceIdByName).filter(Boolean)
                                    : []),
                            intermediateStops: Array.isArray(v.intermediateStopIds)
                                ? v.intermediateStopIds.map(resolvePlaceNameById)
                                : (Array.isArray(v.intermediateStops) ? v.intermediateStops : []),
                            segments: (v.segments || []).map((s) => ({
                                ...s,
                                fromId: s.fromId || resolvePlaceIdByName(s.from),
                                toId: s.toId || resolvePlaceIdByName(s.to),
                                from: resolvePlaceNameById(s.fromId) || s.from,
                                to: resolvePlaceNameById(s.toId) || s.to,
                            })),
                        });
                    });

                    console.log('[TRANSPORT][travelTimes] Načítané trvania:', Object.keys(map).length, map);
                
                    const lookup = teamsLookupRef.current || {};
                    transfers.forEach((t) => {
                        if (t.teamName && t.teamName.trim() !== '') return;
                        if (t.teamUid == null || t.teamIndex == null) return;
                        const cat = cleanCategory(t.category);
                        const key = `${t.teamUid}|${cat}|${t.teamIndex}`;
                        const info = lookup[key];
                        if (info && info.teamName) {
                            t.teamName = info.teamName;
                        }
                    });
                
                    transfers.sort((a, b) => {
                        const catA = String(a.category || '');
                        const catB = String(b.category || '');
                        if (catA !== catB) {
                            return catA.localeCompare(catB, 'sk', { sensitivity: 'base' });
                        }
                        const teamA = String(a.teamName || '');
                        const teamB = String(b.teamName || '');
                        if (teamA !== teamB) {
                            return teamA.localeCompare(teamB, 'sk', { sensitivity: 'base' });
                        }
                        return String(a.when || '').localeCompare(String(b.when || ''), 'sk');
                    });
                }
                
                setTravelTimes(map);
                savedTransfersRef.current = transfers;
                setSavedTransfers(transfers);
                setTravelTimesLoaded(true);
                travelTimesLoadedRef.current = true;
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/transportTravelTimes) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na transportTravelTimes:', e);
        }

        let unsubscribeBuses = null;
        try {
            const transportRef = collection(window.db, 'transport');
            unsubscribeBuses = onSnapshot(transportRef, (snapshot) => {
                const busesList = [];
                const rowsGrouped = {};
        
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
        
                    if (data.type === 'bus') {
                        const num = Number(data.number);
                        busesList.push({
                            id: docSnap.id,
                            name: data.name || (Number.isFinite(num) ? `Bus ${num}` : 'Bus'),
                            number: Number.isFinite(num) ? num : 0,
                        });
                        return;
                    }
        
                    if (data.type === 'busRow') {
                        if (!data.busId || !data.dayKey) return;
                        const key = `${data.busId}|${data.dayKey}`;
                        if (!rowsGrouped[key]) rowsGrouped[key] = [];

                        const placeFromId = data.placeFromId || null;
                        const placeToId = data.placeToId || null;

                        const order = Number(data.order) || 0;
                        const rowId = data.rowId || buildRowId(data.busId, data.dayKey, order);

                        rowsGrouped[key].push({
                            id: docSnap.id,
                            order,
                            rowId,
                            timeFrom: data.timeFrom || '',
                            timeTo: data.timeTo || '',
                            placeFromId,
                            placeToId,
                            placeFrom: placeFromId ? (resolvePlaceNameById(placeFromId) || '') : '',
                            placeTo: placeToId ? (resolvePlaceNameById(placeToId) || '') : '',
                            count: data.count ?? null,
                        });
                    }
                });
        
                busesList.sort((a, b) => a.number - b.number);
                Object.values(rowsGrouped).forEach(arr => arr.sort((a, b) => a.order - b.order));
        
                setBuses(busesList);
                setBusRows(rowsGrouped);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(transport) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na transport:', e);
        }

        let unsubscribeTeamShortcuts = null;
        try {
            const transportRef = collection(window.db, 'transport');
            unsubscribeTeamShortcuts = onSnapshot(transportRef, (snapshot) => {
                const map = {};
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    if (data.type !== 'teamShortcut') return;
                    if (!data.category) return;
                    if (!data.shortcut) return;
        
                    const cat = cleanCategory(data.category);
                    const shortcut = String(data.shortcut).trim();
                    const docTeamUid = data.teamUid || null;
                    const docTeamIndex = data.teamIndex ?? null;
                    const docTeamName = data.teamName ? String(data.teamName).trim() : null;
        
                    let resolvedTeamName = null;
        
                    if (docTeamUid != null && docTeamIndex != null) {
                        const lookupKey = `${docTeamUid}|${cat}|${docTeamIndex}`;
                        const info = (teamsLookupRef.current || {})[lookupKey];
                        if (info && info.teamName) {
                            resolvedTeamName = info.teamName;
                        }
                    }
        
                    if (!resolvedTeamName && docTeamName) {
                        resolvedTeamName = docTeamName;
                    }
        
                    if (!resolvedTeamName) return;
        
                    const key = `${cat}|${resolvedTeamName}`;
                    map[key] = shortcut;
                });
                setTeamShortcuts(map);
                setTeamShortcutsLoaded(true);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(transport – teamShortcuts) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na transport (teamShortcuts):', e);
        }
        
        try {
            const cateringSettingsRef = doc(window.db, 'settings', 'catering');
            unsubscribeCateringSettings = onSnapshot(cateringSettingsRef, (snap) => {
                if (!snap.exists()) {
                    window.__transport_unitMinutes = null;
                    return;
                }
                const data = snap.data() || {};
                const parsed = data.unitMinutes != null
                    ? parseInt(String(data.unitMinutes), 10)
                    : null;
                window.__transport_unitMinutes = (!isNaN(parsed) && parsed > 0) ? parsed : null;
                if (cateringLoadedRef.current) rebuildAndLogTimeline();
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/catering) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na settings/catering:', e);
        }

        let unsubscribeSuperstructureGroups = null;
        try {
            const ssgRef = doc(window.db, 'settings', 'superstructureGroups');
            unsubscribeSuperstructureGroups = onSnapshot(ssgRef, (snap) => {
                const map = {};
                if (snap.exists()) {
                    const data = snap.data() || {};
                    console.log('[TRANSPORT][SSG-RAW] Raw data zo settings/superstructureGroups:', data);
                    Object.entries(data).forEach(([categoryName, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;
                        teamArray.forEach((team) => {
                            if (!team || !team.teamName) return;
                            if (!team.groupName) return;
                            const cat = cleanCategory(categoryName);
                            const grp = String(team.groupName).trim();
                            const key = `${cat}|${grp}`;
                            if (!map[key]) map[key] = new Set();
                            map[key].add(String(team.teamName).trim());
                        });
                    });
                } else {
                    console.warn('[TRANSPORT][SSG-RAW] Dokument settings/superstructureGroups NEEXISTUJE!');
                }
                superstructureGroupsRef.current = map;
                console.log('[TRANSPORT][SSG-MAP] Vytvorená mapa:', 
                    Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v]]))
                );
                if (matchesLoadedRef.current && cateringLoadedRef.current && teamsLoadedRef.current) {
                    rebuildAndLogTimeline();
                }
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/superstructureGroups) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na superstructureGroups:', e);
        }

        try {
            const catRef = doc(window.db, 'settings', 'categories');
            unsubscribeCategorySettings = onSnapshot(catRef, (snap) => {
                const map = {};
                const colorMap = {};
                if (snap.exists()) {
                    const data = snap.data() || {};
                    Object.entries(data).forEach(([catId, catData]) => {
                        if (!catData) return;
                        const periods = catData.periods ?? 2;
                        const periodDuration = catData.periodDuration ?? 20;
                        const breakDuration = catData.breakDuration ?? 2;
                        const matchBreak = catData.matchBreak ?? 5;
                        const matchDuration = (periodDuration + breakDuration) * periods - breakDuration;
                        const info = { matchDuration, matchBreak };
                        if (catData.name) map[catData.name] = info;
                        map[catId] = info;

                        const transportColor = catData.transportColor || null;
                        const drawColor = catData.drawColor || null;
                        if (transportColor) {
                            if (catData.name) colorMap[String(catData.name).trim()] = transportColor;
                            colorMap[catId] = transportColor;
                        }
                        if (drawColor) {
                            if (catData.name) colorMap[`__draw__|${String(catData.name).trim()}`] = drawColor;
                            colorMap[`__draw__|${catId}`] = drawColor;
                        }
                    });
                }
                window.__transport_categories = map;
                transportColorsRef.current = colorMap;
                setTransportColors(colorMap);
                if (matchesLoadedRef.current) rebuildAndLogTimeline();
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/categories) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na settings/categories:', e);
        }

        const loadTeamsLookup = async () => {
            try {
                const usersRef = collection(window.db, 'users');
                const usersSnap = await getDocs(usersRef);
                const lookup = {};
        
                usersSnap.forEach((userDoc) => {
                    const userData = userDoc.data() || {};
                    const teams = userData.teams;
                    if (!teams || typeof teams !== 'object') return;
        
                    Object.entries(teams).forEach(([category, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;
                        teamArray.forEach((team, teamIndex) => {
                            if (!team || !team.teamName) return;
                            const cat = cleanCategory(category);
                            const key = `${userDoc.id}|${cat}|${teamIndex}`;
                            lookup[key] = {
                                teamName: team.teamName,
                                category: cat,
                                teamIndex,
                                userId: userDoc.id,
                            };
                        });
                    });
                });
        
                teamsLookupRef.current = lookup;
                teamsLookupLoadedRef.current = true;

                try {
                    const transportRef = collection(window.db, 'transport');
                    const shortcutsSnap = await getDocs(transportRef);
                    const map = {};
                    shortcutsSnap.forEach((docSnap) => {
                        const data = docSnap.data() || {};
                        if (data.type !== 'teamShortcut') return;
                        if (!data.category) return;
                        if (!data.shortcut) return;
                
                        const cat = cleanCategory(data.category);
                        const shortcut = String(data.shortcut).trim();
                        const docTeamUid = data.teamUid || null;
                        const docTeamIndex = data.teamIndex ?? null;
                        const docTeamName = data.teamName ? String(data.teamName).trim() : null;
                
                        let resolvedTeamName = null;
                        if (docTeamUid != null && docTeamIndex != null) {
                            const lookupKey = `${docTeamUid}|${cat}|${docTeamIndex}`;
                            const info = lookup[lookupKey];
                            if (info && info.teamName) resolvedTeamName = info.teamName;
                        }
                        if (!resolvedTeamName && docTeamName) resolvedTeamName = docTeamName;
                        if (!resolvedTeamName) return;
                
                        map[`${cat}|${resolvedTeamName}`] = shortcut;
                    });
                    setTeamShortcuts(map);
                    setTeamShortcutsLoaded(true);
                } catch (err) {
                    console.error('[TRANSPORT] Chyba pri načítaní skratiek tímov po lookupe:', err);
                }
        
                setSavedTransfers((prev) => {
                    const updated = prev.map((t) => {
                        if (t.teamName && t.teamName.trim() !== '') return t;
                        if (t.teamUid == null || t.teamIndex == null) return t;
                        const cat = cleanCategory(t.category);
                        const k = `${t.teamUid}|${cat}|${t.teamIndex}`;
                        const info = lookup[k];
                        return info && info.teamName ? { ...t, teamName: info.teamName } : t;
                    });
                    savedTransfersRef.current = updated;
                    return updated;
                });
        
                if (matchesLoadedRef.current && cateringLoadedRef.current && teamsLoadedRef.current) {
                    rebuildAndLogTimeline();
                }
            } catch (err) {
                console.error('[TRANSPORT] Chyba pri načítaní lookup tímov:', err);
            }
        };
        
        loadTeamsLookup();

        let unsubscribeTeamCounts = null;
        try {
            const usersRef = collection(window.db, 'users');
            unsubscribeTeamCounts = onSnapshot(usersRef, (snapshot) => {
                const map = {};
                snapshot.forEach((userDoc) => {
                    const userData = userDoc.data() || {};
                    const teams = userData.teams;
                    if (!teams || typeof teams !== 'object') return;
        
                    Object.entries(teams).forEach(([category, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;
                        const cat = cleanCategory(category);
                        teamArray.forEach((team) => {
                            if (!team || !team.teamName) return;
                            const teamName = String(team.teamName).trim();
                            const key = `${cat}|${teamName}`;
                            map[key] = {
                                players: Array.isArray(team.playerDetails) ? team.playerDetails.length : 0,
                                menRT: Array.isArray(team.menTeamMemberDetails) ? team.menTeamMemberDetails.length : 0,
                                womenRT: Array.isArray(team.womenTeamMemberDetails) ? team.womenTeamMemberDetails.length : 0,
                                menDrivers: Array.isArray(team.driverDetailsMale) ? team.driverDetailsMale.length : 0,
                                womenDrivers: Array.isArray(team.driverDetailsFemale) ? team.driverDetailsFemale.length : 0,
                            };
                        });
                    });
                });
                setTeamCounts(map);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(users – team counts) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na users (team counts):', e);
        }

        try {
            const regRef = doc(window.db, 'settings', 'registration');
            unsubscribeRegistration = onSnapshot(regRef, (snap) => {
                if (!snap.exists()) {
                    setTournamentDays([]);
                    setTournamentDaysLoaded(true);
                    return;
                }
                const data = snap.data() || {};

                const toDate = (ts) => {
                    if (!ts) return null;
                    if (typeof ts.toDate === 'function') return ts.toDate();
                    if (ts instanceof Date) return ts;
                    const d = new Date(ts);
                    return isNaN(d.getTime()) ? null : d;
                };

                const start = toDate(data.tournamentStart);
                const end = toDate(data.tournamentEnd);

                if (!start || !end) {
                    setTournamentDays([]);
                    setTournamentDaysLoaded(true);
                    return;
                }

                const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

                const days = [];
                const cursor = new Date(startDay);
                while (cursor <= endDay) {
                    const dateObj = new Date(cursor);
                    const dayKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                    days.push({
                        dayKey,
                        dateLabel: formatDateDDMMYYYY(dateObj),
                        dayName: dateObj.toLocaleDateString('sk-SK', { weekday: 'long' }),
                    });
                    cursor.setDate(cursor.getDate() + 1);
                }
                if (data.arrivalDate) {
                    try {
                        window.__transport_tournamentArrivalDate = typeof data.arrivalDate.toDate === 'function'
                            ? data.arrivalDate.toDate().getTime()
                            : new Date(data.arrivalDate).getTime();
                    } catch (e) {
                        window.__transport_tournamentArrivalDate = null;
                    }
                } else {
                    window.__transport_tournamentArrivalDate = null;
                }
                setTournamentDays(days);
                setTournamentDaysLoaded(true);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/registration) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na settings/registration:', e);
        }

        const loadTeamsWithAccommodation = async () => {
            try {
                const usersRef = collection(window.db, 'users');
                const usersSnap = await getDocs(usersRef);

                const buffer = [];

                const processTeam = (team, cat, isSuperstructureTeam, isRegistered = false) => {
                    if (!team || !team.teamName) return;
                    const trimmedName = team.teamName.trim();
                    const accomType = team.accommodation?.type?.trim?.() || '';
                    const accomName = team.accommodation?.name?.trim?.() || '';

                    let arrivalTypeRaw = '';
                    let arrivalDisplayRaw = '---';
                    let arrivalTimeRaw = '';
                    if (team.arrival) {
                        if (typeof team.arrival === 'string') {
                            arrivalTypeRaw = team.arrival.trim();
                            arrivalDisplayRaw = arrivalTypeRaw || '---';
                        } else if (typeof team.arrival === 'object') {
                            if (team.arrival.type) {
                                arrivalTypeRaw = String(team.arrival.type).trim();
                            }
                            if (team.arrival.time) {
                                arrivalTimeRaw = String(team.arrival.time).trim();
                            }
                            arrivalDisplayRaw = formatArrival(team.arrival);
                        }
                    }

                    const isSS = isSuperstructureTeam === true || team.isSuperstructure === true;

                    buffer.push({
                        category: cat,
                        teamName: trimmedName,
                        accommodationType: accomType || '(nešpecifikovaný)',
                        accommodationName: accomName,
                        arrivalDisplay: arrivalDisplayRaw,
                        arrivalType: arrivalTypeRaw,
                        arrivalTime: arrivalTimeRaw,
                        groupName: team.groupName ? String(team.groupName).trim() : null,
                        order: (typeof team.order === 'number' && team.order > 0) ? team.order : null,
                        isSuperstructure: isSS,
                        isRegistered: isRegistered,
                    });
                };

                const registeredTeamNamesByCategory = {};
                usersSnap.forEach((userDoc) => {
                    const userData = userDoc.data() || {};
                    const teams = userData.teams;
                    if (!teams || typeof teams !== 'object') return;

                    Object.entries(teams).forEach(([category, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;
                        const cat = cleanCategory(category);
                        if (!registeredTeamNamesByCategory[cat]) {
                            registeredTeamNamesByCategory[cat] = new Set();
                        }
                        teamArray.forEach((team) => {
                            if (!team || !team.teamName) return;
                            const trimmed = team.teamName.trim();
                            registeredTeamNamesByCategory[cat].add(trimmed);
                            processTeam(team, cat, false, true);
                        });
                    });
                });

                const ssTeamsFromMatches = new Map();

                (matchesBufferRef.current || []).forEach((m) => {
                    [m.home, m.away].forEach((teamName) => {
                        if (!teamName) return;
                        const cat = m.category;
                        const registeredSet = registeredTeamNamesByCategory[cat];
                        const isRegistered = registeredSet && registeredSet.has(teamName);
        
                        const looksLikeSuperstructure = /\d[A-ZÁ-Ž]\s*$/.test(String(teamName).trim());
        
                        if (isRegistered && !looksLikeSuperstructure) return;
                        
                        const key = `${cat}|${teamName}`;
                        if (!ssTeamsFromMatches.has(key)) {
                            ssTeamsFromMatches.set(key, { category: cat, teamName });
                        }
                    });
                });

                try {
                    const ssRef = collection(window.db, 'superstructure');
                    const ssSnap = await getDocs(ssRef);
                    ssSnap.forEach((docSnap) => {
                        const data = docSnap.data() || {};
                        const cat = cleanCategory(
                            data.category || data.categoryName || '(bez kategórie)'
                        );
                        if (Array.isArray(data.teams)) {
                            data.teams.forEach((team) => {
                                if (!team || !team.teamName) return;
                                const trimmedName = team.teamName.trim();
                                const key = `${cat}|${trimmedName}`;
                                if (!ssTeamsFromMatches.has(key)) {
                                    ssTeamsFromMatches.set(key, { category: cat, teamName: trimmedName });
                                }
                            });
                        } else if (data.teams && typeof data.teams === 'object') {
                            Object.entries(data.teams).forEach(([catKey, teamArray]) => {
                                if (!Array.isArray(teamArray)) return;
                                const c = cleanCategory(catKey);
                                teamArray.forEach((team) => {
                                    if (!team || !team.teamName) return;
                                    const trimmedName = team.teamName.trim();
                                    const key = `${c}|${trimmedName}`;
                                    if (!ssTeamsFromMatches.has(key)) {
                                        ssTeamsFromMatches.set(key, { category: c, teamName: trimmedName });
                                    }
                                });
                            });
                        } else if (data.teamName) {
                            const trimmedName = data.teamName.trim();
                            const key = `${cat}|${trimmedName}`;
                            if (!ssTeamsFromMatches.has(key)) {
                                ssTeamsFromMatches.set(key, { category: cat, teamName: trimmedName });
                            }
                        }
                    });
                } catch (ssErr) {
                }

                const existingByKey = new Map();
                buffer.forEach((b) => {
                    existingByKey.set(`${b.category}|${b.teamName}`, b);
                });

                ssTeamsFromMatches.forEach(({ category: cat, teamName: trimmedName }) => {
                    const key = `${cat}|${trimmedName}`;
                    if (existingByKey.has(key)) {
                        const existing = existingByKey.get(key);
                        existing.isSuperstructure = true;
                        existing.isRegistered = false;
                    } else {
                        let derivedGroupName = null;
                        const nameMatch = /\d([A-ZÁ-Ž])\s*$/.exec(String(trimmedName).trim());
                        if (nameMatch) {
                            const lastChar = nameMatch[1];
                            const candidateGroups = new Set();
                            buffer.forEach((b) => {
                                if (b.category === cat && b.groupName) {
                                    const gLastChar = String(b.groupName).trim().slice(-1).toUpperCase();
                                    if (gLastChar === lastChar) candidateGroups.add(b.groupName);
                                }
                            });
                            if (candidateGroups.size > 0) {
                                derivedGroupName = [...candidateGroups][0];
                            } else {
                                derivedGroupName = `skupina ${lastChar}`;
                            }
                        }
                        
                        buffer.push({
                            category: cat,
                            teamName: trimmedName,
                            accommodationType: '(nešpecifikovaný)',
                            accommodationName: '',
                            arrivalDisplay: '---',
                            arrivalType: '',
                            groupName: derivedGroupName, 
                            order: null,
                            isSuperstructure: true,
                            isRegistered: false,
                        });
                    }
                });
                
                teamsArrivalBufferRef.current = buffer;
                teamsLoadedRef.current = true;

                preloadAccommodationsForSuperstructureTeams().then(() => {
                    rebuildAndLogTimeline();
                });

            } catch (err) {
                console.error('[TRANSPORT] Chyba pri načítaní tímov s ubytovaním:', err);
            }
        };

        const buildMatchesBuffer = (snapshot) => {
            const buffer = [];

            snapshot.forEach((docSnap) => {
                const data = docSnap.data() || {};
                const category = cleanCategory(data.categoryName || data.categoryId || '(neznáma kategória)');

                const homeDisplayName = resolveTeamName(data.homeTeamIdentifier);
                const awayDisplayName = resolveTeamName(data.awayTeamIdentifier);

                const hallId = data.hallId || null;
                const hallName = hallId
                    ? (placesMapRef.current[hallId] || `(neznáma hala: ${hallId})`)
                    : null;

                let scheduledTs = null;
                if (data.scheduledTime) {
                    try {
                        scheduledTs = data.scheduledTime.toDate
                            ? data.scheduledTime.toDate().getTime()
                            : new Date(data.scheduledTime).getTime();
                    } catch (e) {
                        scheduledTs = null;
                    }
                }

                const special = data.isPlacementMatch
                    ? ` [o ${data.placementRank}. miesto]`
                    : data.matchType
                        ? ` [${data.matchType}]`
                        : '';

                let scheduledEndTs = null;
                let scheduledEndTime = null;
                if (scheduledTs != null) {
                    const catInfo = window.__transport_categories
                        ? (window.__transport_categories[category] || window.__transport_categories[data.categoryId])
                        : null;
                    const matchDuration = catInfo?.matchDuration ?? 0;
                    if (matchDuration > 0) {
                        scheduledEndTs = scheduledTs + matchDuration * 60000;
                        scheduledEndTime = formatDateTime(new Date(scheduledEndTs));
                    }
                }

                const groupName = cleanCategory(data.groupName || '');

                buffer.push({
                    category,
                    home: homeDisplayName,
                    away: awayDisplayName,
                    scheduledTs,
                    scheduledTime: data.scheduledTime ? formatDateTime(data.scheduledTime) : null,
                    scheduledEndTs,
                    scheduledEndTime,
                    hallName,
                    hallId,
                    special,
                    groupName: groupName || null,
                    matchType: data.matchType || null,
                    homeTeamIdentifier: data.homeTeamIdentifier || null,
                    awayTeamIdentifier: data.awayTeamIdentifier || null,
                });
            });

            matchesBufferRef.current = buffer;
            matchesLoadedRef.current = true;

            if (typeof loadTeamsWithAccommodation === 'function') {
                loadTeamsWithAccommodation();
            }
        };

        try {
            const matchesRef = collection(window.db, 'matches');
            unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
                buildMatchesBuffer(snapshot);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(matches) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na matches:', e);
        }

        const getRowTeamName = (a) => {
            const lookup = teamsLookupRef.current;

            if (a.isSuperstructure === true) {
                const cat = cleanCategory(a.clickedTeamCategory || '');
                const key = `${a.clickedTeamUid}|${cat}|${a.clickedTeamIndex}`;
                const found = lookup[key];
                if (found) return found.teamName;
                return `(row team: ${a.clickedTeamUid || '?'} / ${a.clickedTeamCategory || '?'} / ${a.clickedTeamIndex ?? '?'})`;
            }

            const cat = cleanCategory(a.category || a.categoryName || '');
            const key = `${a.teamUid}|${cat}|${a.teamIndex}`;
            const found = lookup[key];
            if (found) return found.teamName;
            return a.teamName || '---';
        };

        const buildCateringBuffer = (snapshot) => {
            const buffer = [];

            snapshot.forEach((docSnap) => {
                const data = docSnap.data() || {};

                const dayKey = data.dayKey || null;
                const mealType = data.mealType || null;
                const slotFrom = data.slotFrom || null;
                const placeName = data.placeName || data.placeId || '(bez miesta)';
                let category;
                let teamName;

                if (data.isSuperstructure === true) {
                    category = cleanCategory(data.categoryName || data.category || '(bez kategórie)');
                    teamName = (data.teamName || '').trim() || '(neznámy superstructure tím)';
                } else {
                    category = cleanCategory(data.category || data.categoryName || '(bez kategórie)');
                    teamName = getRowTeamName(data);
                }

                const ts = dayKeyAndSlotToTimestamp(dayKey, slotFrom);

                let slotTo = null;
                let slotToTs = null;
                const unitMin = window.__transport_unitMinutes;
                if (slotFrom && unitMin && unitMin > 0) {
                    const [h, mi] = slotFrom.split(':').map(Number);
                    const startMin = h * 60 + mi;
                    const endMin = startMin + unitMin;
                    const endH = String(Math.floor(endMin / 60)).padStart(2, '0');
                    const endM = String(endMin % 60).padStart(2, '0');
                    slotTo = `${endH}:${endM}`;
                    slotToTs = ts != null ? ts + unitMin * 60000 : null;
                }

                buffer.push({
                    category,
                    teamName,
                    ts,
                    dayKey,
                    slotFrom,
                    slotTo,
                    slotToTs,
                    mealType,
                    placeName,
                    isSuperstructure: data.isSuperstructure === true,
                    isPriority: data.isPriority === true,
                    superstructureTeamName: data.isSuperstructure === true
                        ? (data.teamName || '').trim() || null
                        : null,
                });
            });

            cateringBufferRef.current = buffer;
            cateringLoadedRef.current = true;

            rebuildAndLogTimeline();
        };

        try {
            const cateringRef = collection(window.db, 'catering');
            unsubscribeCatering = onSnapshot(cateringRef, (snapshot) => {
                buildCateringBuffer(snapshot);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(catering) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na catering:', e);
        }

        return () => {
            if (unsubscribeRegistration) unsubscribeRegistration();
            if (unsubscribeMatches) unsubscribeMatches();
            if (unsubscribeCatering) unsubscribeCatering();
            if (unsubscribePlaces) unsubscribePlaces();
            if (unsubscribeAllPlaces) unsubscribeAllPlaces();
            if (unsubscribeCateringSettings) unsubscribeCateringSettings();
            if (unsubscribeCategorySettings) unsubscribeCategorySettings();
            if (unsubscribeTravelTimes) unsubscribeTravelTimes();
            if (unsubscribeSuperstructureGroups) unsubscribeSuperstructureGroups();
            if (unsubscribeBuses) unsubscribeBuses();
            if (unsubscribeTeamCounts) unsubscribeTeamCounts();
            if (unsubscribeTeamShortcuts) unsubscribeTeamShortcuts();
        };
    }, []);

    useEffect(() => {
        allPlacesRef.current = allPlaces;
    }, [allPlaces]);

    useEffect(() => {
        const normalizeType = (t) => String(t || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        const stops = allPlaces
            .filter((p) => normalizeType(p.type) === 'zastavka')
            .sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));

        console.log('[TRANSPORT][stopsList] Načítané zastávky:', {
            allPlacesCount: allPlaces.length,
            stopsCount: stops.length,
            stops: stops.map(s => ({ id: s.id, name: s.name, type: s.type })),
            allTypes: allPlaces.map(p => ({ name: p.name, type: p.type })),
        });
        
        setStopsList(stops);
    }, [allPlaces]);

    useEffect(() => {
        const draft = {};
        Object.entries(travelTimes).forEach(([key, v]) => {
            draft[key] = v.minutes != null ? String(v.minutes) : '';
        });
        setTravelTimesDraft(draft);
    }, [travelTimes]);

    useEffect(() => {
        if (!window.db) return;
        if (!travelTimesLoaded) return;
        if (!busRows || Object.keys(busRows).length === 0) return;
    
        Object.values(busRows).forEach((rows) => {
            (rows || []).forEach((row) => {
                const placeFromId = row.placeFromId || null;
                const placeToId = row.placeToId || null;
                if (!placeFromId || !placeToId) return;
    
                const minutes = getTravelMinutes(placeFromId, placeToId);
                if (minutes == null) return;
                if (!row.timeFrom || !/^\d{1,2}:\d{2}$/.test(row.timeFrom)) return;
    
                const [h, m] = row.timeFrom.split(':').map(Number);
                const total = h * 60 + m + minutes;
                const endH = Math.floor(total / 60) % 24;
                const endM = total % 60;
                const computed = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    
                if (computed !== (row.timeTo || '')) {
                    updateBusRowField(row.id, 'timeTo', computed);
                }
            });
        });
    }, [busRows, travelTimes, stopsList, travelTimesLoaded]);

    useEffect(() => {
        if (!window.db) return;
        if (!travelTimesLoaded) return;
        if (!busRows || Object.keys(busRows).length === 0) return;

        Object.values(busRows).forEach((rows) => {
            const sorted = (rows || [])
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            for (let i = 1; i < sorted.length; i++) {
                const prevRow = sorted[i - 1];
                const currRow = sorted[i];

                if (!prevRow.placeToId) continue;
                if (currRow.placeFromId === prevRow.placeToId) continue;

                updateBusRowField(currRow.id, 'placeFrom', prevRow.placeToId);
            }
        });
    }, [busRows, travelTimesLoaded]);

    useEffect(() => {
        if (!travelTimesLoaded) {
            setMissingTravelTimeWarning([]);
            return;
        }

        if (!placesLoaded || !stopsList || stopsList.length === 0) {
            setMissingTravelTimeWarning([]);
            return;
        }
    
        if (!busRows || Object.keys(busRows).length === 0) {
            setMissingTravelTimeWarning([]);
            return;
        }
    
        const missing = [];
        const seen = new Set();
    
        Object.values(busRows).forEach((rows) => {
            (rows || []).forEach((row) => {
                const placeFromId = row.placeFromId;
                const placeToId = row.placeToId;
                if (!placeFromId || !placeToId) return;
        
                const key = `${placeFromId}|${placeToId}`;
                const exists = travelTimes[key] && travelTimes[key].minutes != null;
                if (exists) return;

                const dedupKey = `${placeFromId}|${placeToId}`;
                if (seen.has(dedupKey)) return;
                seen.add(dedupKey);
        
                missing.push({
                    from: row.placeFrom || placeFromId,
                    to: row.placeTo || placeToId,
                    fromId: placeFromId,
                    toId: placeToId,
                    rowId: row.id,
                });
            });
        });
    
        setMissingTravelTimeWarning(missing);
    }, [busRows, travelTimes, stopsList, travelTimesLoaded, placesLoaded]);

    useEffect(() => {
        // Ak je zapnutý filter "Iba časti presunov", ale pre aktuálny výber
        // (deň / kategória) neexistuje žiadna NEPRIradená časť presunu,
        // automaticky filter vypneme, aby sa zobrazili všetky presuny.
        if (!showOnlyPartialTransfers) return;

        const hasAnyVisiblePartialTransfer = (savedTransfers || []).some((t) => {
            if (selectedDayKey && t.dayKey !== selectedDayKey) return false;
            if (selectedCategoryFilter && cleanCategory(t.category || '') !== cleanCategory(selectedCategoryFilter)) return false;

            // Musí ísť o parent s medzizastávkami (inak to nie je "časť presunu")
            if (!Array.isArray(t.intermediateStopIds) || t.intermediateStopIds.length === 0) return false;

            // Parent musí mať aspoň jeden segment, ktorý NIE je priradený busu
            // a NIE je označený ako peši (tie sa v zozname nezobrazujú).
            const segments = Array.isArray(t.segments) ? t.segments : [];
            if (segments.length === 0) return false;

            const hasVisibleSegment = segments.some((seg) => {
                if (!seg) return false;
                if (seg.isWalking === true) return false;
                if (seg.busId && seg.boardingRowId && seg.alightingRowId) return false;
                return true;
            });

            return hasVisibleSegment;
        });

        if (!hasAnyVisiblePartialTransfer) {
            setShowOnlyPartialTransfers(false);
        }
    }, [savedTransfers, selectedDayKey, selectedCategoryFilter, showOnlyPartialTransfers]);
    
    const buildRowId = (busId, dayKey, order) => {
        return `${busId}__${dayKey}__${order}`;
    };

    const parseOrderFromRowId = (rowId) => {
        if (!rowId) return null;
        const parts = String(rowId).split('__');
        const last = parts[parts.length - 1];
        const n = Number(last);
        return Number.isFinite(n) ? n : null;
    };
    
    const addBusRow = async (bus, dayKey) => {
        if (!window.db || !bus || !dayKey) return;
        try {
            const existing = busRows[`${bus.id}|${dayKey}`] || [];
            const nextOrder = existing.length > 0
                ? Math.max(...existing.map(r => r.order || 0)) + 1
                : 1;
    
            let initialPlaceFromId = null;
            let initialTimeFrom = '';
    
            if (existing.length > 0) {
                const lastRow = existing.reduce((a, b) => (a.order > b.order ? a : b));
                if (lastRow.placeToId) initialPlaceFromId = lastRow.placeToId;
    
                if (lastRow.timeTo && /^\d{1,2}:\d{2}$/.test(lastRow.timeTo)) {
                    const [h, m] = lastRow.timeTo.split(':').map(Number);
                    const total = h * 60 + m + 2;
                    const endH = Math.floor(total / 60) % 24;
                    const endM = total % 60;
                    initialTimeFrom = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                }
            }
    
            const newRowRef = doc(collection(window.db, 'transport'));
            await setDoc(newRowRef, {
                type: 'busRow',
                busId: bus.id,
                busName: bus.name,
                dayKey,
                order: nextOrder,
                rowId: buildRowId(bus.id, dayKey, nextOrder),
                timeFrom: initialTimeFrom,
                timeTo: '',
                placeFromId: initialPlaceFromId,
                placeToId: null,
            });
            window.showGlobalNotification('Riadok pridaný.', 'success');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri pridávaní riadku:', err);
            window.showGlobalNotification('Nepodarilo sa pridať riadok.', 'error');
        }
    };

    const insertBusRowBetween = async (bus, dayKey, prevRow, nextRow) => {
        if (!window.db || !bus || !dayKey || !prevRow || !nextRow) return;
    
        try {
            const rowsKey = `${bus.id}|${dayKey}`;
            const allRows = (busRows[rowsKey] || [])
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0));
    
            const prevIdx = allRows.findIndex((r) => r.id === prevRow.id);
            const nextIdx = allRows.findIndex((r) => r.id === nextRow.id);
            if (prevIdx === -1 || nextIdx === -1 || nextIdx !== prevIdx + 1) return;
    
            const placeFromId = prevRow.placeToId || null;
            const placeToId = nextRow.placeFromId || null;
    
            let initialTimeFrom = '';
            if (prevRow.timeTo && /^\d{1,2}:\d{2}$/.test(prevRow.timeTo)) {
                const [h, m] = prevRow.timeTo.split(':').map(Number);
                let total = h * 60 + m + 2;
                total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
                const endH = Math.floor(total / 60);
                const endM = total % 60;
                initialTimeFrom = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
            }
    
            const newOrder = (prevRow.order || 0) + 1;

            const rowIdMap = {};
            const shiftPromises = [];
            for (let i = nextIdx; i < allRows.length; i++) {
                const r = allRows[i];
                const newOrderValue = (r.order || 0) + 1;
                const newRowId = buildRowId(bus.id, dayKey, newOrderValue);
                if (r.rowId) rowIdMap[r.rowId] = newRowId;
                if (newOrderValue !== r.order || newRowId !== r.rowId) {
                    shiftPromises.push(
                        updateDoc(doc(window.db, 'transport', r.id), {
                            order: newOrderValue,
                            rowId: newRowId,
                        })
                    );
                }
            }
            await Promise.all(shiftPromises);
            
            if (Object.keys(rowIdMap).length > 0) {
                try {
                    const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const data = snap.data() || {};
                        const rawTransfers = data[TRANSPORT_TRANSFERS_FIELD] || {};
                        const tUpdates = {};
                        Object.entries(rawTransfers).forEach(([key, v]) => {
                            if (!v || !Array.isArray(v.segments)) return;
                            let changed = false;
                            const newSegments = v.segments.map((s) => {
                                if (s.busId !== bus.id) return s;
                                if (s.boardingRowId && rowIdMap[s.boardingRowId]) {
                                    changed = true;
                                    s = { ...s, boardingRowId: rowIdMap[s.boardingRowId] };
                                }
                                if (s.alightingRowId && rowIdMap[s.alightingRowId]) {
                                    changed = true;
                                    s = { ...s, alightingRowId: rowIdMap[s.alightingRowId] };
                                }
                                return s;
                            });
                            if (changed) tUpdates[key] = { ...v, segments: newSegments };
                        });
                        if (Object.keys(tUpdates).length > 0) {
                            await setDoc(docRef, { [TRANSPORT_TRANSFERS_FIELD]: tUpdates }, { merge: true });
                        }
                    }
                } catch (e) {
                    console.error('[TRANSPORT] Chyba pri premapovaní rowId v presunoch:', e);
                }
            }
            
            const newRowRef = doc(collection(window.db, 'transport'));
            await setDoc(newRowRef, {
                type: 'busRow',
                busId: bus.id,
                busName: bus.name,
                dayKey,
                order: newOrder,
                rowId: buildRowId(bus.id, dayKey, newOrder), 
                timeFrom: initialTimeFrom,
                timeTo: '',
                placeFromId,
                placeToId,
            });
    
            window.showGlobalNotification('Riadok vložený medzi existujúce riadky.', 'success');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri vkladaní riadku medzi riadky:', err);
            window.showGlobalNotification('Nepodarilo sa vložiť riadok.', 'error');
        }
    };

    const syncAssignedSegmentsForBusRow = async (busId, dayKey, rowId) => {
        if (!window.db || !busId || !dayKey || !rowId) return;
    
        const rowsKey = `${busId}|${dayKey}`;
        let allRows = [];
        try {
            const transportRef = collection(window.db, 'transport');
            const rowsSnap = await getDocs(transportRef);
            rowsSnap.forEach((docSnap) => {
                const data = docSnap.data() || {};
                if (data.type !== 'busRow') return;
                if (data.busId !== busId) return;
                if (data.dayKey !== dayKey) return;
                const order = Number(data.order) || 0;
                const rowId = data.rowId || buildRowId(data.busId, data.dayKey, order);
                allRows.push({
                    id: docSnap.id,
                    order,
                    rowId,
                    timeFrom: data.timeFrom || '',
                    timeTo: data.timeTo || '',
                    placeFromId: data.placeFromId || null,
                    placeToId: data.placeToId || null,
                });
            });
            allRows.sort((a, b) => (a.order || 0) - (b.order || 0));
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri načítaní busRows z Firestore v sync:', err);
            return;
        }
    
        const targetRow = allRows.find((r) => r.id === rowId);
        if (!targetRow) return;
        const targetRowId = targetRow.rowId;
        if (!targetRowId) return;
    
        const parentsToUpdate = [];
        const parentsToRemoveSegmentFrom = new Map();
    
        (savedTransfersRef.current || []).forEach((parent) => {
            if (parent.dayKey !== dayKey) return;
            if (!Array.isArray(parent.segments)) return;
    
            let effectiveParentRange = null;
            {
                const segs = parent.segments;
                let earliestStart = null;
                let latestEnd = null;
                segs.forEach((s) => {
                    if (!s) return;
                    if (s.isWalking === true) return;
                    if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                        earliestStart = s.startTs;
                    }
                    if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                        latestEnd = s.endTs;
                    }
                });
                if (earliestStart != null && latestEnd != null && latestEnd > earliestStart) {
                    effectiveParentRange = { startTs: earliestStart, endTs: latestEnd };
                } else {
                    effectiveParentRange = parseTransferWhenToRange(parent.when);
                }
            }
    
            let changed = false;
            const newSegments = parent.segments.map((seg) => {
                if (!seg || seg.busId !== busId) return seg;
                if (seg.isWalking === true) return seg;

                const boardingRow = allRows.find((r) => r.rowId === seg.boardingRowId);
                const alightingRow = allRows.find((r) => r.rowId === seg.alightingRowId);
            
                const boardingTs = boardingRow && boardingRow.timeFrom
                    ? timeOnDayKeyToTs(dayKey, boardingRow.timeFrom)
                    : null;
                const alightingTs = alightingRow && alightingRow.timeTo
                    ? timeOnDayKeyToTs(dayKey, alightingRow.timeTo)
                    : null;
    
                if (boardingTs == null || alightingTs == null || alightingTs <= boardingTs) {
                    changed = true;
                    const removeKey = `${parent.key}|${seg.fromId}|${seg.toId}`;
                    if (!parentsToRemoveSegmentFrom.has(removeKey)) {
                        parentsToRemoveSegmentFrom.set(removeKey, {
                            parentKey: parent.key,
                            fromId: seg.fromId,
                            toId: seg.toId,
                        });
                    }
                    return {
                        ...seg,
                        busAssigned: false,
                        busId: null,
                        boardingRowId: null,
                        alightingRowId: null,
                        startTs: null,
                        endTs: null,
                        when: null,
                    };
                }
    
                if (effectiveParentRange) {
                    const outsideParent =
                        boardingTs < effectiveParentRange.startTs ||
                        alightingTs > effectiveParentRange.endTs ||
                        alightingTs <= boardingTs;

                    if (outsideParent) {
                        const wasAssignedToThisBus =
                            seg.busId === busId &&
                            seg.boardingRowId &&
                            seg.alightingRowId &&
                            seg.startTs != null &&
                            seg.endTs != null &&
                            seg.endTs > seg.startTs;

                        if (!wasAssignedToThisBus) {
                            changed = true;
                            const removeKey = `${parent.key}|${seg.fromId}|${seg.toId}`;
                            if (!parentsToRemoveSegmentFrom.has(removeKey)) {
                                parentsToRemoveSegmentFrom.set(removeKey, {
                                    parentKey: parent.key,
                                    fromId: seg.fromId,
                                    toId: seg.toId,
                                });
                            }
                            return {
                                ...seg,
                                busAssigned: false,
                                busId: null,
                                boardingRowId: null,
                                alightingRowId: null,
                                startTs: null,
                                endTs: null,
                                when: null,
                            };
                        }
                    }
                }
    
                const newStartTs = boardingTs;
                const newEndTs = alightingTs;
                const newWhen = `${formatTsLocal(newStartTs)} – ${formatTsLocal(newEndTs)}`;
    
                if (
                    seg.startTs !== newStartTs ||
                    seg.endTs !== newEndTs ||
                    seg.when !== newWhen
                ) {
                    changed = true;
                    return {
                        ...seg,
                        startTs: newStartTs,
                        endTs: newEndTs,
                        when: newWhen,
                    };
                }
                return seg;
            });
    
            const parentSegmentsAfterSync = newSegments.map((s) => ({ ...s }));
    
            const changedIdxSet = new Set();
            newSegments.forEach((s, idx) => {
                const orig = parent.segments[idx];
                if (!orig) return;
                if (s.startTs !== orig.startTs || s.endTs !== orig.endTs) {
                    changedIdxSet.add(idx);
                }
            });
    
            if (changedIdxSet.size > 0) {
                changedIdxSet.forEach((changedIdx) => {
                    const changedSeg = parentSegmentsAfterSync[changedIdx];
                    if (!changedSeg || changedSeg.startTs == null || changedSeg.endTs == null) return;
                    if (changedSeg.isWalking === true) return;
    
                    for (let i = changedIdx - 1; i >= 0; i--) {
                        const prev = parentSegmentsAfterSync[i];
                        if (!prev) continue;
                        if (prev.isWalking === true) break;
                        if (prev.toId !== changedSeg.fromId) break;
                        if (prev.busId && prev.boardingRowId && prev.alightingRowId) break;
                        if (prev.startTs != null && prev.endTs == null) {
                            prev.endTs = changedSeg.startTs;
                            prev.when = `${formatTsLocal(prev.startTs)} – ${formatTsLocal(prev.endTs)}`;
                            changed = true;
                        }
                        break;
                    }
    
                    for (let i = changedIdx + 1; i < parentSegmentsAfterSync.length; i++) {
                        const next = parentSegmentsAfterSync[i];
                        if (!next) continue;
                        if (next.isWalking === true) break;
                        if (next.fromId !== changedSeg.toId) break;
                        if (next.busId && next.boardingRowId && next.alightingRowId) break;
                        if (next.endTs != null && next.startTs == null) {
                            next.startTs = changedSeg.endTs;
                            next.when = `${formatTsLocal(next.startTs)} – ${formatTsLocal(next.endTs)}`;
                            changed = true;
                        }
                        break;
                    }
                });
            }
    
            if (changed) {
                parentsToUpdate.push({ parentKey: parent.key, newSegments: parentSegmentsAfterSync });
            }
        });
    
        if (parentsToRemoveSegmentFrom.size > 0) {
            const byParent = new Map();
            parentsToRemoveSegmentFrom.forEach((item) => {
                if (!byParent.has(item.parentKey)) byParent.set(item.parentKey, []);
                byParent.get(item.parentKey).push(item);
            });
    
            for (const [parentKey, items] of byParent.entries()) {
                const parentExists = savedTransfersRef.current.some((s) => s.key === parentKey);
                if (!parentExists) continue;
    
                try {
                    await updateParentTransfer(parentKey, (draft) => {
                        draft.segments = draft.segments.map((s) => {
                            if (s.busId !== busId) return s;
                            const shouldRemove = items.some(
                                (item) => item.fromId === s.fromId && item.toId === s.toId
                            );
                            if (!shouldRemove) return s;
                            return {
                                ...s,
                                busAssigned: false,
                                busId: null,
                                boardingRowId: null,
                                alightingRowId: null,
                                startTs: null,
                                endTs: null,
                                when: null,
                            };
                        });
                    });
                } catch (err) {
                    console.error('[TRANSPORT] Chyba pri odstraňovaní segmentu z busu (sync):', err);
                }
            }
        }
    
        const refreshedParentsForDay = (savedTransfersRef.current || []).filter(
            (p) => p.dayKey === dayKey && Array.isArray(p.segments) && p.segments.length > 0
        );
    
        if (parentsToUpdate.length === 0) {
            return;
        }
    
        const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
        const tUpdates = {};
        parentsToUpdate.forEach(({ parentKey, newSegments }) => {
            // NOVÉ: `when` sa už NEAKTUALIZUJE v rámci sync-u – zostáva z generovania.
            // Do DB zapisujeme iba `segments` (reálne časy z busu).
            tUpdates[parentKey] = { segments: newSegments };
        });
    
        try {
            await setDoc(docRef, { [TRANSPORT_TRANSFERS_FIELD]: tUpdates }, { merge: true });
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri synchronizácii segmentov s busom:', err);
            return;
        }
    
        await new Promise((r) => setTimeout(r, 100));
    
        const updatedParents = (savedTransfersRef.current || []).map((parent) => {
            const patch = parentsToUpdate.find((p) => p.parentKey === parent.key);
            if (!patch) return parent;
    
            const draft = {
                ...parent,
                when: null,
                segments: patch.newSegments.map((s) => ({ ...s })),
            };
            try {
                recomputeParentSegmentsInPlace(draft);
            } catch (e) {
                console.error('[TRANSPORT] Chyba pri recomputeParentSegmentsInPlace v sync:', e);
                draft.when = parent.when;
            }
            return draft;
        });
    
        savedTransfersRef.current = updatedParents;
        setSavedTransfers(updatedParents);
    };

    const updateBusRowField = async (rowId, field, value) => {
        if (!window.db || !rowId) return;
        try {
            if (field === 'placeFrom' || field === 'placeTo') {
                const idField = field === 'placeFrom' ? 'placeFromId' : 'placeToId';
                const placeId = value || null;
                const patch = {
                    [idField]: placeId,
                    [field]: deleteField(),
                };
                let currentRow = null;
                Object.values(busRows || {}).forEach((rows) => {
                    if (currentRow) return;
                    const found = (rows || []).find((r) => r.id === rowId);
                    if (found) currentRow = found;
                });

                if (currentRow) {
                    const newPlaceFromId = field === 'placeFrom' ? placeId : (currentRow.placeFromId || null);
                    const newPlaceToId = field === 'placeTo' ? placeId : (currentRow.placeToId || null);
                    const travelMinutes = getTravelMinutes(newPlaceFromId, newPlaceToId);
                    const timeFrom = currentRow.timeFrom || '';
                    if (travelMinutes != null && timeFrom && /^\d{1,2}:\d{2}$/.test(timeFrom)) {
                        const [h, m] = timeFrom.split(':').map(Number);
                        let total = h * 60 + m + travelMinutes;
                        total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
                        const endH = Math.floor(total / 60);
                        const endM = total % 60;
                        const newTimeTo = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                        console.log('[TRANSPORT][updateBusRowField] Nový timeTo =', newTimeTo);
                        if (newTimeTo !== (currentRow.timeTo || '')) {
                            patch.timeTo = newTimeTo;
                        }
                    }
                }
                await updateDoc(doc(window.db, 'transport', rowId), patch);

                try {
                    let busIdForSync = null;
                    let dayKeyForSync = null;
                    Object.entries(busRows || {}).forEach(([busKey, rows]) => {
                        if (busIdForSync) return;
                        const [bId, dK] = busKey.split('|');
                        const found = (rows || []).find((r) => r.id === rowId);
                        if (found) {
                            busIdForSync = bId;
                            dayKeyForSync = dK;
                        }
                    });
                    if (busIdForSync && dayKeyForSync) {
                        const overrideFields = {};
                        if (patch.placeFromId !== undefined) overrideFields.placeFromId = patch.placeFromId;
                        if (patch.placeToId !== undefined) overrideFields.placeToId = patch.placeToId;
                        if (patch.timeTo !== undefined) overrideFields.timeTo = patch.timeTo;
                        await syncAssignedSegmentsForBusRow(busIdForSync, dayKeyForSync, rowId);
                    }
                } catch (e) {
                    console.error('[TRANSPORT] Chyba pri sync po zmene place:', e);
                }

                return;
            }
            
            await updateDoc(doc(window.db, 'transport', rowId), { [field]: value });

            try {
                let busIdForSync = null;
                let dayKeyForSync = null;
                Object.entries(busRows || {}).forEach(([busKey, rows]) => {
                    if (busIdForSync) return;
                    const [bId, dK] = busKey.split('|');
                    const found = (rows || []).find((r) => r.id === rowId);
                    if (found) {
                        busIdForSync = bId;
                        dayKeyForSync = dK;
                    }
                });
                if (busIdForSync && dayKeyForSync) {
                    await syncAssignedSegmentsForBusRow(busIdForSync, dayKeyForSync, rowId);
                }
            } catch (e) {
                console.error('[TRANSPORT] Chyba pri sync po zmene času:', e);
            }
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri aktualizácii riadku:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť zmenu.', 'error');
        }
    };

    const shiftBusRowsAfterChange = async (busId, dayKey, currentRowId, deltaMinutes) => {
        if (!window.db || !busId || !dayKey) return;
        if (!deltaMinutes || isNaN(deltaMinutes) || deltaMinutes === 0) return;
    
        const rowsKey = `${busId}|${dayKey}`;
        const allRows = (busRows[rowsKey] || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    
        const currentIdx = allRows.findIndex((r) => r.id === currentRowId);
        if (currentIdx === -1) return;
    
        const shiftTime = (timeStr, delta) => {
            if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return timeStr;
            const [h, m] = timeStr.split(':').map(Number);
            let total = h * 60 + m + Number(delta);
            total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
            const endH = Math.floor(total / 60);
            const endM = total % 60;
            return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        };
    
        const updates = [];
    
        for (let i = currentIdx + 1; i < allRows.length; i++) {
            const prev = allRows[i - 1];
            const curr = allRows[i];
            if (i > currentIdx + 1) {
                const gap = getGapMinutes(prev.timeTo, curr.timeFrom);
                if (gap != null && gap > 2) {
                    break;
                }
            }
    
            const newTimeFrom = shiftTime(curr.timeFrom, deltaMinutes);
            const newTimeTo = shiftTime(curr.timeTo, deltaMinutes);
    
            const patch = {};
            if (newTimeFrom !== curr.timeFrom) patch.timeFrom = newTimeFrom;
            if (newTimeTo !== curr.timeTo) patch.timeTo = newTimeTo;
    
            if (Object.keys(patch).length > 0) {
                updates.push({ id: curr.id, patch });
            }
        }
    
        if (updates.length === 0) return;
    
        try {
            await Promise.all(
                updates.map(({ id, patch }) =>
                    updateDoc(doc(window.db, 'transport', id), patch)
                )
            );

            try {
                await Promise.all(
                    updates.map(({ id }) => syncAssignedSegmentsForBusRow(busId, dayKey, id))
                );
            } catch (e) {
                console.error('[TRANSPORT] Chyba pri sync segmentov po posune:', e);
            }

            window.showGlobalNotification(
                `Posunutých ${updates.length} nasledujúcich riadkov o ${deltaMinutes} min.`,
                'info'
            );
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri posune nasledujúcich riadkov:', err);
            window.showGlobalNotification('Nepodarilo sa posunúť nasledujúce riadky.', 'error');
        }
    };

    const resyncFollowingRowsAfterPlaceToChange = async (busId, dayKey, currentRowId) => {
        if (!window.db || !busId || !dayKey || !currentRowId) return;

        const rowsKey = `${busId}|${dayKey}`;
        const allRows = (busRows[rowsKey] || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const currentIdx = allRows.findIndex((r) => r.id === currentRowId);
        if (currentIdx === -1) return;

        const currentRow = allRows[currentIdx];
    
        const travelMinutes = getTravelMinutes(currentRow.placeFromId, currentRow.placeToId);
        if (travelMinutes == null) return;
        if (!currentRow.timeFrom || !/^\d{1,2}:\d{2}$/.test(currentRow.timeFrom)) return;
    
        const [ch, cm] = currentRow.timeFrom.split(':').map(Number);
        const currentStartMin = ch * 60 + cm;
        let newCurrentEndMin = currentStartMin + travelMinutes;
        newCurrentEndMin = ((newCurrentEndMin % (24 * 60)) + (24 * 60)) % (24 * 60);
    
        const toMinutes = (timeStr) => {
            if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };
    
        const fromMinutes = (totalMin) => {
            const norm = ((totalMin % (24 * 60)) + (24 * 60)) % (24 * 60);
            const h = Math.floor(norm / 60);
            const m = norm % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };
    
        const shiftTime = (timeStr, delta) => {
            const min = toMinutes(timeStr);
            if (min == null) return timeStr;
            return fromMinutes(min + delta);
        };
    
        const updates = [];
        let prevRow = currentRow;
        let prevEndMin = newCurrentEndMin;
    
        for (let i = currentIdx + 1; i < allRows.length; i++) {
            const curr = allRows[i];
    
            const prevTimeToMin = prevEndMin;
            const currTimeFromMin = toMinutes(curr.timeFrom);
    
            if (prevTimeToMin == null || currTimeFromMin == null) {
                break;
            }
    
            const originalPrevTimeToMin = toMinutes(allRows[i - 1].timeTo);
            const originalCurrTimeFromMin = currTimeFromMin;
    
            let originalGap = null;
            if (originalPrevTimeToMin != null && originalCurrTimeFromMin != null) {
                originalGap = originalCurrTimeFromMin - originalPrevTimeToMin;
                if (originalGap < 0) originalGap += 24 * 60;
            }
    
            if (originalGap != null && originalGap > 2) {
                break;
            }
    
            const gapToPreserve = originalGap != null && originalGap > 0 ? originalGap : 0;
            const newTimeFromMin = prevEndMin + gapToPreserve;
            const newTimeFromStr = fromMinutes(newTimeFromMin);
    
            const currTravelMinutes = getTravelMinutes(curr.placeFromId, curr.placeToId);
            let newTimeToStr = curr.timeTo || '';
            let newEndMin = null;
    
            if (currTravelMinutes != null) {
                newEndMin = newTimeFromMin + currTravelMinutes;
                newTimeToStr = fromMinutes(newEndMin);
            }
    
            const patch = {};
            if (newTimeFromStr !== curr.timeFrom) patch.timeFrom = newTimeFromStr;
            if (currTravelMinutes != null && newTimeToStr !== curr.timeTo) patch.timeTo = newTimeToStr;
    
            if (Object.keys(patch).length > 0) {
                updates.push({ id: curr.id, patch });
            }
    
            prevEndMin = (newEndMin != null) ? newEndMin : newTimeFromMin;
        }
    
        if (updates.length === 0) return;
    
        try {
            await Promise.all(
                updates.map(({ id, patch }) =>
                    updateDoc(doc(window.db, 'transport', id), patch)
                )
            );

            try {
                const syncPromises = [currentRowId];
                updates.forEach(({ id }) => syncPromises.push(id));
                await Promise.all(
                    syncPromises.map((id) => syncAssignedSegmentsForBusRow(busId, dayKey, id))
                );
            } catch (e) {
                console.error('[TRANSPORT] Chyba pri sync segmentov po resync placeTo:', e);
            }

            window.showGlobalNotification(
                `Zosúladených ${updates.length} nasledujúcich riadkov.`,
                'info'
            );
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri zosúlaďovaní nasledujúcich riadkov:', err);
            window.showGlobalNotification('Nepodarilo sa zosúladiť nasledujúce riadky.', 'error');
        }
    };

    const cascadeFollowingRowsAfterTimeFromChange = async (busId, dayKey, currentRowId, newTimeFrom, newTimeTo) => {
        if (!window.db || !busId || !dayKey || !currentRowId) return;
        if (!newTimeFrom || !/^\d{1,2}:\d{2}$/.test(newTimeFrom)) return;
        if (!newTimeTo || !/^\d{1,2}:\d{2}$/.test(newTimeTo)) return;
    
        const rowsKey = `${busId}|${dayKey}`;
        const allRows = (busRows[rowsKey] || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    
        const currentIdx = allRows.findIndex((r) => r.id === currentRowId);
        if (currentIdx === -1) return;
    
        const toMinutes = (timeStr) => {
            if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };
    
        const fromMinutes = (totalMin) => {
            const norm = ((totalMin % (24 * 60)) + (24 * 60)) % (24 * 60);
            const h = Math.floor(norm / 60);
            const m = norm % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };
    
        let prevEndMin = toMinutes(newTimeTo);
        if (prevEndMin == null) return;
    
        const updates = [];
    
        for (let i = currentIdx + 1; i < allRows.length; i++) {
            const curr = allRows[i];
    
            const originalPrevTimeToMin = toMinutes(allRows[i - 1].timeTo);
            const originalCurrTimeFromMin = toMinutes(curr.timeFrom);
    
            let originalGap = null;
            if (originalPrevTimeToMin != null && originalCurrTimeFromMin != null) {
                originalGap = originalCurrTimeFromMin - originalPrevTimeToMin;
                if (originalGap < 0) originalGap += 24 * 60;
            }
    
            if (originalGap != null && originalGap > 2) {
                break;
            }
    
            const newTimeFromMin = prevEndMin + 2;
            const newTimeFromStr = fromMinutes(newTimeFromMin);
    
            const currTravelMinutes = getTravelMinutes(curr.placeFromId, curr.placeToId);
            let newTimeToStr = curr.timeTo || '';
            let newEndMin = null;
    
            if (currTravelMinutes != null) {
                newEndMin = newTimeFromMin + currTravelMinutes;
                newTimeToStr = fromMinutes(newEndMin);
            }
    
            const patch = {};
            if (newTimeFromStr !== curr.timeFrom) patch.timeFrom = newTimeFromStr;
            if (currTravelMinutes != null && newTimeToStr !== curr.timeTo) patch.timeTo = newTimeToStr;
    
            if (Object.keys(patch).length > 0) {
                updates.push({ id: curr.id, patch });
            }
    
            prevEndMin = (newEndMin != null) ? newEndMin : newTimeFromMin;
        }
    
        if (updates.length === 0) return;
    
        try {
            await Promise.all(
                updates.map(({ id, patch }) =>
                    updateDoc(doc(window.db, 'transport', id), patch)
                )
            );

            try {
                await Promise.all(
                    updates.map(({ id }) => syncAssignedSegmentsForBusRow(busId, dayKey, id))
                );
            } catch (e) {
                console.error('[TRANSPORT] Chyba pri sync segmentov po cascade:', e);
            }

            window.showGlobalNotification(
                `Zosúladených ${updates.length} nasledujúcich riadkov.`,
                'info'
            );
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri zosúlaďovaní nasledujúcich riadkov:', err);
            window.showGlobalNotification('Nepodarilo sa zosúladiť nasledujúce riadky.', 'error');
        }
    };

    const shiftFollowingRowsAfterInvertedGap = async (busId, dayKey, gapRowPrevId, gapRowNextId) => {
        if (!window.db || !busId || !dayKey || !gapRowPrevId || !gapRowNextId) return;
    
        const rowsKey = `${busId}|${dayKey}`;
        const allRows = (busRows[rowsKey] || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    
        const prevIdx = allRows.findIndex((r) => r.id === gapRowPrevId);
        const nextIdx = allRows.findIndex((r) => r.id === gapRowNextId);
        if (prevIdx === -1 || nextIdx === -1 || nextIdx <= prevIdx) return;
    
        const prevRow = allRows[prevIdx];
        const nextRow = allRows[nextIdx];
    
        const toMinutes = (timeStr) => {
            if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };
        
        const prevToMin = toMinutes(prevRow.timeTo);
        const nextFromMin = toMinutes(nextRow.timeFrom);
        if (prevToMin == null || nextFromMin == null) return;
        
        const gap = Math.abs(nextFromMin - prevToMin);
        if (gap <= 2) return;        
        const deltaMinutes = gap + 2;    
        const shiftTime = (timeStr, delta) => {
            if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return timeStr;
            const [h, m] = timeStr.split(':').map(Number);
            let total = h * 60 + m + Number(delta);
            total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
            const endH = Math.floor(total / 60);
            const endM = total % 60;
            return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        };
    
        const updates = [];
        for (let i = nextIdx; i < allRows.length; i++) {
            const curr = allRows[i];
    
            if (i > nextIdx) {
                const prev = allRows[i - 1];
                const betweenGap = getGapMinutes(prev.timeTo, curr.timeFrom);
                if (betweenGap != null && betweenGap > 2) {
                    break;
                }
            }
    
            const newTimeFrom = shiftTime(curr.timeFrom, deltaMinutes);
            const newTimeTo = shiftTime(curr.timeTo, deltaMinutes);
    
            const patch = {};
            if (newTimeFrom !== curr.timeFrom) patch.timeFrom = newTimeFrom;
            if (newTimeTo !== curr.timeTo) patch.timeTo = newTimeTo;
    
            if (Object.keys(patch).length > 0) {
                updates.push({ id: curr.id, patch });
            }
        }
    
        if (updates.length === 0) return;
    
        try {
            await Promise.all(
                updates.map(({ id, patch }) =>
                    updateDoc(doc(window.db, 'transport', id), patch)
                )
            );

            try {
                const syncPromises = [gapRowPrevId, gapRowNextId];
                updates.forEach(({ id }) => syncPromises.push(id));
                await Promise.all(
                    syncPromises.map((id) => syncAssignedSegmentsForBusRow(busId, dayKey, id))
                );
            } catch (e) {
                console.error('[TRANSPORT] Chyba pri sync segmentov po posune (inverted):', e);
            }

            window.showGlobalNotification(
                `Posunutých ${updates.length} nasledujúcich riadkov o ${deltaMinutes} min (medzera ${gap} + 2).`,
                'info'
            );
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri posune riadkov po obrátenom červenom riadku:', err);
            window.showGlobalNotification('Nepodarilo sa posunúť nasledujúce riadky.', 'error');
        }
    };

    const removeBusRow = async (rowId) => {
        if (!window.db || !rowId) return;
        try {
            let busId = null;
            let dayKey = null;
            Object.entries(busRows || {}).forEach(([k, rows]) => {
                if (busId) return;
                const [bId, dK] = k.split('|');
                const r = (rows || []).find((x) => x.id === rowId);
                if (r) { busId = bId; dayKey = dK; }
            });
    
            if (!busId || !dayKey) {
                await deleteDoc(doc(window.db, 'transport', rowId));
                window.showGlobalNotification('Riadok odstránený.', 'info');
                return;
            }

            const rowsKey = `${busId}|${dayKey}`;
            const removedRow = (busRows[rowsKey] || []).find((r) => r.id === rowId);
            const removedOrder = removedRow ? Number(removedRow.order) || 0 : null;

            await deleteDoc(doc(window.db, 'transport', rowId));
    
            const remaining = (busRows[rowsKey] || [])
                .filter((r) => r.id !== rowId)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
    
            const rowIdMap = {};
            const updates = [];
            remaining.forEach((r, i) => {
                const newOrder = i + 1;
                const newRowId = buildRowId(busId, dayKey, newOrder);
                if (r.order !== newOrder || r.rowId !== newRowId) {
                    updates.push(updateDoc(doc(window.db, 'transport', r.id), {
                        order: newOrder,
                        rowId: newRowId,
                    }));
                    if (r.rowId) rowIdMap[r.rowId] = newRowId;
                }
            });
            await Promise.all(updates);

            // Mapa nových riadkov podľa nového rowId (aby sme vedeli overiť časy)
            const newRowsByRowId = new Map();
            remaining.forEach((r, i) => {
                const newOrder = i + 1;
                const newRowId = buildRowId(busId, dayKey, newOrder);
                newRowsByRowId.set(newRowId, {
                    ...r,
                    order: newOrder,
                    rowId: newRowId,
                });
            });

            if (removedOrder != null) {
                try {
                    const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const data = snap.data() || {};
                        const rawTransfers = data[TRANSPORT_TRANSFERS_FIELD] || {};
                        const tUpdates = {};

                        const shiftRowId = (rowIdStr) => {
                            if (!rowIdStr) return rowIdStr;
                            const parts = String(rowIdStr).split('__');
                            if (parts.length < 3) return rowIdStr;
                            const orderNum = Number(parts[parts.length - 1]);
                            if (!Number.isFinite(orderNum)) return rowIdStr;
                            if (orderNum < removedOrder) return rowIdStr;
                            const newOrderNum = orderNum - 1;
                            if (newOrderNum < 1) return rowIdStr;
                            parts[parts.length - 1] = String(newOrderNum);
                            return parts.join('__');
                        };

                        Object.entries(rawTransfers).forEach(([key, v]) => {
                            if (!v || !Array.isArray(v.segments)) return;
                            let changed = false;
                            const newSegments = v.segments.map((s) => {
                                if (s.busId !== busId) return s;
                                if (s.isWalking === true) return s;

                                const oldBoardingRowId = s.boardingRowId || null;
                                const oldAlightingRowId = s.alightingRowId || null;

                                let newBoardingRowId = oldBoardingRowId;
                                let newAlightingRowId = oldAlightingRowId;

                                if (oldBoardingRowId) {
                                    if (rowIdMap[oldBoardingRowId]) {
                                        newBoardingRowId = rowIdMap[oldBoardingRowId];
                                    } else {
                                        newBoardingRowId = shiftRowId(oldBoardingRowId);
                                    }
                                }
                                if (oldAlightingRowId) {
                                    if (rowIdMap[oldAlightingRowId]) {
                                        newAlightingRowId = rowIdMap[oldAlightingRowId];
                                    } else {
                                        newAlightingRowId = shiftRowId(oldAlightingRowId);
                                    }
                                }

                                const boardingRow = newBoardingRowId ? newRowsByRowId.get(newBoardingRowId) : null;
                                const alightingRow = newAlightingRowId ? newRowsByRowId.get(newAlightingRowId) : null;

                                const boardingTs = boardingRow && boardingRow.timeFrom
                                    ? timeOnDayKeyToTs(dayKey, boardingRow.timeFrom)
                                    : null;
                                const alightingTs = alightingRow && alightingRow.timeTo
                                    ? timeOnDayKeyToTs(dayKey, alightingRow.timeTo)
                                    : null;

                                // Ak nové riadky neexistujú alebo časy nesedia → odobrať tím z busu
                                const timesValid =
                                    boardingTs != null &&
                                    alightingTs != null &&
                                    alightingTs > boardingTs;

                                if (!timesValid) {
                                    changed = true;
                                    return {
                                        ...s,
                                        busAssigned: false,
                                        busId: null,
                                        boardingRowId: null,
                                        alightingRowId: null,
                                        startTs: null,
                                        endTs: null,
                                        when: null,
                                    };
                                }

                                const newWhen = `${formatTsLocal(boardingTs)} – ${formatTsLocal(alightingTs)}`;

                                if (
                                    newBoardingRowId !== oldBoardingRowId ||
                                    newAlightingRowId !== oldAlightingRowId ||
                                    s.startTs !== boardingTs ||
                                    s.endTs !== alightingTs ||
                                    s.when !== newWhen
                                ) {
                                    changed = true;
                                    return {
                                        ...s,
                                        boardingRowId: newBoardingRowId,
                                        alightingRowId: newAlightingRowId,
                                        startTs: boardingTs,
                                        endTs: alightingTs,
                                        when: newWhen,
                                    };
                                }
                                return s;
                            });
                            if (changed) tUpdates[key] = { ...v, segments: newSegments };
                        });

                        if (Object.keys(tUpdates).length > 0) {
                            await setDoc(docRef, { [TRANSPORT_TRANSFERS_FIELD]: tUpdates }, { merge: true });
                        }
                    }
                } catch (e) {
                    console.error('[TRANSPORT] Chyba pri aktualizácii presunov po odstránení riadku:', e);
                }
            }
    
            window.showGlobalNotification('Riadok odstránený.', 'info');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri odstraňovaní riadku:', err);
            window.showGlobalNotification('Nepodarilo sa odstrániť riadok.', 'error');
        }
    
        try {
            let busIdForCleanup = null;
            let dayKeyForCleanup = null;
            Object.entries(busRows || {}).forEach(([k, rows]) => {
                if (busIdForCleanup) return;
                const [bId, dK] = k.split('|');
                const r = (rows || []).find((x) => x.id === rowId);
                if (r) { busIdForCleanup = bId; dayKeyForCleanup = dK; }
            });
    
            const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return;
    
            const data = snap.data() || {};
            const rawTransfers = data[TRANSPORT_TRANSFERS_FIELD] || {};
            const tUpdates = {};
    
            const existingRowIds = new Set();
            Object.entries(busRows || {}).forEach(([busKey, rows]) => {
                const [bId] = busKey.split('|');
                (rows || []).forEach((r) => {
                    if (r.id === rowId) return;
                    if (r.rowId) existingRowIds.add(`${bId}__${r.rowId}`);
                });
            });
    
            Object.entries(rawTransfers).forEach(([key, v]) => {
                if (!v || !Array.isArray(v.segments)) return;
                let changed = false;
                const newSegments = v.segments.map((s) => {
                    if (!s.busId) return s;
                    const bRowKey = s.boardingRowId ? `${s.busId}__${s.boardingRowId}` : null;
                    const aRowKey = s.alightingRowId ? `${s.busId}__${s.alightingRowId}` : null;
    
                    const bMissing = bRowKey && !existingRowIds.has(bRowKey);
                    const aMissing = aRowKey && !existingRowIds.has(aRowKey);
    
                    if (bMissing || aMissing) {
                        changed = true;
                        return {
                            ...s,
                            busAssigned: false,
                            busId: null,
                            boardingRowId: null,
                            alightingRowId: null,
                            startTs: null,
                            endTs: null,
                            when: null,
                        };
                    }
                    return s;
                });
                if (changed) tUpdates[key] = { ...v, segments: newSegments };
            });
    
            if (Object.keys(tUpdates).length > 0) {
                await setDoc(docRef, { [TRANSPORT_TRANSFERS_FIELD]: tUpdates }, { merge: true });
            }
        } catch (e) {
            console.error('[TRANSPORT] Chyba pri čistení segmentov po odstránení riadku:', e);
        }
    };

    const addMinutesToTime = (timeStr, minutes) => {
        if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return '';
        if (minutes == null || isNaN(minutes)) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const total = h * 60 + m + Number(minutes);
        const endH = Math.floor(total / 60) % 24;
        const endM = total % 60;
        return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    };
    
    function getTravelMinutes(placeFrom, placeTo) {
        if (!placeFrom || !placeTo) {
            return null;
        }
    
        const resolveToId = (val) => {
            if (!val) return null;
            const raw = String(val).trim();
    
            if ((allPlacesRef.current || []).some((p) => p.id === raw)) {
                return raw;
            }
            return resolvePlaceIdByName(raw);
        };
    
        const fromId = resolveToId(placeFrom);
        const toId = resolveToId(placeTo);
    
        const keyId = `${fromId}|${toId}`;
        const found = travelTimes[keyId];
    
        if (found && found.minutes != null) {
            return Number(found.minutes);
        }
    
        const reverseKey = `${toId}|${fromId}`;
        const reverseFound = travelTimes[reverseKey];
        if (reverseFound && reverseFound.minutes != null) {
            return Number(reverseFound.minutes);
        }
    
        return null;
    }

    const renderBusRowsHeader = () => React.createElement(
        'thead',
        null,
        React.createElement(
            'tr',
            { className: 'bg-gray-100 text-xs font-semibold text-gray-700' },
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '70px' } }, 'Od'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '70px' } }, 'Do'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '200px' } }, 'Miesto od'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '200px' } }, 'Miesto do'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1' }, 'Nástup'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1' }, 'Výstup'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '60px' } }, 'Počet'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '60px' } }, 'Min'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '36px' } }, '')
        )
    );

    const getTeamMembersCount = (teamKey) => {
        const parts = String(teamKey).split('|');
        const teamName = (parts[0] || '').trim();
        const category = (parts[1] || '').trim();
        if (!teamName || !category) return 0;

        const counts = getTeamCountsForTransfer(category, teamName);
        if (counts) {
            const total =
                (counts.players || 0) +
                (counts.menRT || 0) +
                (counts.womenRT || 0) +
                (counts.menDrivers || 0) +
                (counts.womenDrivers || 0);
            if (total > 0) return total;
        }

        const avg = getCategoryAverageForTransfer(category);
        if (avg != null) return avg;

        return 0;
    };

    const getTeamTooltipLabel = (teamKey) => {
        const parts = String(teamKey).split('|');
        const teamName = (parts[0] || '').trim();
        const category = (parts[1] || '').trim();
    
        const counts = getTeamCountsForTransfer(category, teamName);
        let membersText = null;
    
        if (counts) {
            const total =
                (counts.players || 0) +
                (counts.menRT || 0) +
                (counts.womenRT || 0) +
                (counts.menDrivers || 0) +
                (counts.womenDrivers || 0);
            membersText = `${total}`;
        } else {
            const avg = getCategoryAverageForTransfer(category);
            if (avg != null) {
                membersText = `${avg}`;
            }
        }
    
        if (membersText != null) {
            return `${teamName} • ${membersText} členov`;
        }
    
        return `${teamName}`;
    };

    const getTeamMembersInBusBetween = (busId, dayKey, boardingOrderInclusive, alightingOrderExclusive) => {
        if (!busId || !dayKey) return { teams: [], total: 0 };
        if (boardingOrderInclusive == null || alightingOrderExclusive == null) {
            return { teams: [], total: 0 };
        }
    
        const inBus = new Set();
    
        (savedTransfersRef.current || []).forEach((parent) => {
            if (parent.dayKey !== dayKey) return;
            if (parent.isWalking === true) return;
    
            const effectiveCategory = cleanCategory(parent.category || '');
    
            let effectiveTeamName = String(parent.teamName || '').trim();
            if (!effectiveTeamName && parent.teamUid != null && parent.teamIndex != null) {
                const lookupKey = `${parent.teamUid}|${effectiveCategory}|${parent.teamIndex}`;
                const info = (teamsLookupRef.current || {})[lookupKey];
                if (info && info.teamName) effectiveTeamName = info.teamName;
            }
            if (!effectiveTeamName) {
                const parts = String(parent.key || '').split('||');
                if (parts.length >= 2) {
                    const keyTeamName = String(parts[1] || '').trim();
                    if (keyTeamName) effectiveTeamName = keyTeamName;
                }
            }
            if (!effectiveTeamName) return;
    
            (parent.segments || []).forEach((seg) => {
                if (seg.busId !== busId) return;
                if (seg.isWalking === true) return;
    
                const bOrder = parseOrderFromRowId(seg.boardingRowId);
                const aOrder = parseOrderFromRowId(seg.alightingRowId);
                if (bOrder == null || aOrder == null) return;
    
                let isInBus = false;
                if (bOrder === aOrder) {
                    isInBus = (boardingOrderInclusive === bOrder && alightingOrderExclusive === aOrder);
                } else {
                    isInBus = (bOrder <= boardingOrderInclusive && boardingOrderInclusive < aOrder);
                }
    
                if (isInBus) {
                    inBus.add(`${effectiveTeamName}|${effectiveCategory}`);
                }
            });
        });
    
        const teams = [...inBus];
        const total = teams.reduce((sum, tk) => sum + getTeamMembersCount(tk), 0);
        return { teams, total };
    };

    const getTeamsInBusAfterRow = (busId, dayKey, rowId) => {
        const rowsKey = `${busId}|${dayKey}`;
        const allRows = (busRows[rowsKey] || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    
        const currentRow = allRows.find((r) => r.id === rowId);
        if (!currentRow) return [];

        const currentOrder = parseOrderFromRowId(currentRow.rowId);
        if (currentOrder == null) return [];

        const { teams } = getTeamMembersInBusBetween(busId, dayKey, currentOrder, currentOrder);

        const result = teams.filter((teamKey) => {
            if (!selectedCategoryFilter) return true;
            const parts = String(teamKey).split('|');
            const cat = cleanCategory(parts[1] || '');
            return cat === cleanCategory(selectedCategoryFilter);
        });

        return result;
    };

    const getGapMinutes = (timeTo, timeFrom) => {
        if (!timeTo || !timeFrom) return null;
        const re = /^(\d{1,2}):(\d{2})$/;
        const a = re.exec(String(timeTo));
        const b = re.exec(String(timeFrom));
        if (!a || !b) return null;
        const toMin = Number(a[1]) * 60 + Number(a[2]);
        const fromMin = Number(b[1]) * 60 + Number(b[2]);
        let diff = fromMin - toMin;
        if (diff < 0) diff += 24 * 60;
        return diff;
    };

    const isSegmentCoveredByBusPath = (dayKey, teamName, category, fromId, toId) => {
        if (!fromId || !toId) return false;
        if (fromId === toId) return false;
        const parent = (savedTransfersRef.current || []).find((p) => {
            if (p.dayKey !== dayKey) return false;
            if (String(p.teamName || '').trim() !== String(teamName || '').trim()) return false;
            if (cleanCategory(p.category || '') !== cleanCategory(category || '')) return false;
            return (p.segments || []).some(
                (s) => s.fromId === fromId && s.toId === toId && s.busId && s.boardingRowId && s.alightingRowId
            );
        });

        return !!parent;
    };

    const renderBusRow = (row, busId, dayKey) => {
        const travelMinutes = getTravelMinutes(row.placeFromId, row.placeToId);
        const computedTimeTo = (() => {
            if (row.timeTo && /^\d{1,2}:\d{2}$/.test(row.timeTo)) {
                return row.timeTo;
            }
            if (row.timeFrom && travelMinutes != null) {
                const [h, m] = row.timeFrom.split(':').map(Number);
                let total = h * 60 + m + travelMinutes;
                total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
                const endH = Math.floor(total / 60);
                const endM = total % 60;
                return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
            }
            return '';
        })();

        const rowsKey = `${busId}|${dayKey}`;
        const allRows = (busRows[rowsKey] || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        const currentIdx = allRows.findIndex((r) => r.id === row.id);
        const prevRow = currentIdx > 0 ? allRows[currentIdx - 1] : null;

        const lockedPlaceFromId =
            prevRow && prevRow.placeToId ? prevRow.placeToId : null;
        const lockedPlaceFrom = lockedPlaceFromId
            ? (resolvePlaceNameById(lockedPlaceFromId) || '')
            : null;

        const inputCls = 'w-full px-1 py-1 text-sm border border-gray-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-green-500';
        const selectCls = 'w-full px-1 py-1 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:ring-2 focus:ring-green-500';

        const filterTeamsByCategory = (teams) => {
            if (!Array.isArray(teams)) return [];
            if (!selectedCategoryFilter) return teams;
            const targetCat = cleanCategory(selectedCategoryFilter);
            return teams.filter((teamKey) => {
                const parts = String(teamKey).split('|');
                const cat = cleanCategory(parts[1] || '');
                return cat === targetCat;
            });
        };

        const stopOptionsFrom = stopsList.map((s) =>
            React.createElement('option', { key: s.id, value: s.id }, s.name)
        );

        const stopOptionsTo = stopsList
            .filter((s) => s.id !== row.placeFromId)
            .map((s) =>
                React.createElement('option', { key: s.id, value: s.id }, s.name)
            );
        
        const removeTeamSegment = async (teamKeyToRemove, clickSide, rowObj) => {
            if (!window.db || !busId || !dayKey || !rowObj?.id) return;
        
            const [teamName, category] = String(teamKeyToRemove).split('|');
            const tn = String(teamName).trim();
            const cat = cleanCategory(category || '');
        
            const targetParent = (savedTransfersRef.current || []).find((p) => {
                if (p.dayKey !== dayKey) return false;
                if (String(p.teamName || '').trim() !== tn) return false;
                if (cleanCategory(p.category || '') !== cat) return false;
                return (p.segments || []).some((s) => {
                    if (s.busId !== busId) return false;
                    if (clickSide === 'in') return s.boardingRowId === rowObj.rowId;
                    return s.alightingRowId === rowObj.rowId;
                });
            });
        
            if (!targetParent) {
                window.showGlobalNotification('Segment sa nenašiel.', 'error');
                return;
            }
        
            const originalParentWhen = targetParent.when && String(targetParent.when).trim() !== ''
                ? targetParent.when
                : null;
        
            try {
                await updateParentTransfer(targetParent.key, (draft) => {
                    draft.segments = draft.segments.map((s) => {
                        if (s.busId !== busId) return s;
                        if (clickSide === 'in' && s.boardingRowId === rowObj.rowId) {
                            return {
                                ...s,
                                busAssigned: false,
                                busId: null,
                                boardingRowId: null,
                                alightingRowId: null,
                                startTs: null,
                                endTs: null,
                                when: null,
                            };
                        }
                        if (clickSide === 'out' && s.alightingRowId === rowObj.rowId) {
                            return {
                                ...s,
                                busAssigned: false,
                                busId: null,
                                boardingRowId: null,
                                alightingRowId: null,
                                startTs: null,
                                endTs: null,
                                when: null,
                            };
                        }
                        return s;
                    });
        
                    if (originalParentWhen) {
                        draft.when = originalParentWhen;
                    }
                });
        
                window.showGlobalNotification('Tím bol odstránený z autobusu.', 'info');
            } catch (err) {
                console.error('[TRANSPORT] Chyba pri odstraňovaní tímu z busu:', err);
                window.showGlobalNotification('Nepodarilo sa odstrániť tím z busu.', 'error');
            }
        };
    
        return React.createElement(
            'tr',
            { key: row.id, className: 'hover:bg-gray-50 group relative' },
            React.createElement('td', { className: 'border border-gray-300 p-1' },
                React.createElement('input', {
                    type: 'time',
                    key: `timeFrom-${row.id}-${row.timeFrom || ''}`,
                    defaultValue: row.timeFrom || '',
                    onBlur: async (e) => {
                        const newValue = e.target.value;
                        const oldValue = row.timeFrom || '';
                        if (newValue === oldValue) return;
                    
                        if (!newValue) {
                            await updateBusRowField(row.id, 'timeFrom', newValue);
                            return;
                        }
                    
                        await updateBusRowField(row.id, 'timeFrom', newValue);
                    
                        let newTimeTo = null;
                        const travelMinutes = getTravelMinutes(row.placeFromId, row.placeToId);
                        if (travelMinutes != null && /^\d{1,2}:\d{2}$/.test(newValue)) {
                            const [h, m] = newValue.split(':').map(Number);
                            let total = h * 60 + m + travelMinutes;
                            total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
                            const endH = Math.floor(total / 60);
                            const endM = total % 60;
                            newTimeTo = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                            if (newTimeTo !== (row.timeTo || '')) {
                                await updateBusRowField(row.id, 'timeTo', newTimeTo);
                            }
                        }
                    
                        if (newTimeTo != null) {
                            cascadeFollowingRowsAfterTimeFromChange(busId, dayKey, row.id, newValue, newTimeTo);
                        }
                    },
                    onKeyDown: async (e) => {
                        if (e.key === 'Enter') {
                            e.target.blur();
                        }
                    },
                    className: inputCls,
                })
            ),
            React.createElement('td', { className: 'border border-gray-300 p-1' },
                React.createElement('input', {
                    type: 'time',
                    value: computedTimeTo || '',
                    readOnly: true,
                    disabled: true,
                    title: travelMinutes != null
                        ? `Vypočítané: ${row.timeFrom || '—'} + ${travelMinutes} min`
                        : 'Chýba trvanie jazdy medzi zastávkami',
                    className: inputCls + ' bg-gray-100 cursor-not-allowed text-center font-semibold',
                    style: { color: computedTimeTo ? '#1d4ed8' : '#9ca3af' },
                })
            ),
            React.createElement('td', { className: 'border border-gray-300 p-1' },
                lockedPlaceFrom != null
                    ? React.createElement(
                        'div',
                        {
                            className: 'w-full px-1 py-1 text-sm text-left font-semibold bg-gray-100 border border-gray-300 rounded text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis',
                            title: `Miesto od je automaticky nastavené z predchádzajúceho riadku (${lockedPlaceFrom}). Nedá sa meniť.`,
                        },
                        lockedPlaceFrom
                    )
                    : React.createElement('select', {
                        value: row.placeFromId || '',
                        onChange: async (e) => {
                            const newPlaceFromId = e.target.value;
                            const oldPlaceFromId = row.placeFromId || '';
                            if (newPlaceFromId === oldPlaceFromId) return;

                            await updateBusRowField(row.id, 'placeFrom', newPlaceFromId);

                            const currentPlaceToId = row.placeToId || null;

                            if (newPlaceFromId && currentPlaceToId && row.timeFrom && /^\d{1,2}:\d{2}$/.test(row.timeFrom)) {
                                const travelMinutes = getTravelMinutes(newPlaceFromId, currentPlaceToId);
                                if (travelMinutes != null) {
                                    const [h, m] = row.timeFrom.split(':').map(Number);
                                    let total = h * 60 + m + travelMinutes;
                                    total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
                                    const endH = Math.floor(total / 60);
                                    const endM = total % 60;
                                    const newTimeTo = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                                    if (newTimeTo !== (row.timeTo || '')) {
                                        await updateBusRowField(row.id, 'timeTo', newTimeTo);
                                    }
                                }
                            }
                        },
                        className: selectCls,
                    },
                        React.createElement('option', { value: '' }, '— vyber zastávku —'),
                        stopOptionsFrom
                    )
            ),
            React.createElement('td', { className: 'border border-gray-300 p-1' },
                React.createElement('select', {
                    value: row.placeToId || '',
                    onChange: async (e) => {
                        const newPlaceToId = e.target.value;
                        const oldPlaceToId = row.placeToId || '';
                        if (newPlaceToId === oldPlaceToId) return;
                        await updateBusRowField(row.id, 'placeTo', newPlaceToId);
                        const currentPlaceFromId = row.placeFromId || null;
                        if (currentPlaceFromId && newPlaceToId && row.timeFrom && /^\d{1,2}:\d{2}$/.test(row.timeFrom)) {
                            const travelMinutes = getTravelMinutes(currentPlaceFromId, newPlaceToId);
                            if (travelMinutes != null) {
                                const [h, m] = row.timeFrom.split(':').map(Number);
                                let total = h * 60 + m + travelMinutes;
                                total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
                                const endH = Math.floor(total / 60);
                                const endM = total % 60;
                                const newTimeTo = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                                if (newTimeTo !== (row.timeTo || '')) {
                                    await updateBusRowField(row.id, 'timeTo', newTimeTo);
                                }
                            }
                        }
                        setTimeout(() => {
                            resyncFollowingRowsAfterPlaceToChange(busId, dayKey, row.id);
                        }, 300);
                    },
                    className: selectCls,
                },
                    React.createElement('option', { value: '' }, '— vyber zastávku —'),
                    stopOptionsTo
                )
            ),            
            React.createElement('td', { className: 'border border-gray-300 p-1 align-middle whitespace-nowrap' },
                (() => {
                    const teamsBoardingHere = [];
                    (savedTransfersRef.current || []).forEach((parent) => {
                        if (parent.dayKey !== dayKey) return;
                        if (parent.isWalking === true) return;
                        const effectiveCategory = cleanCategory(parent.category || '');
                        let effectiveTeamName = String(parent.teamName || '').trim();
                        if (!effectiveTeamName && parent.teamUid != null && parent.teamIndex != null) {
                            const lookupKey = `${parent.teamUid}|${effectiveCategory}|${parent.teamIndex}`;
                            const info = (teamsLookupRef.current || {})[lookupKey];
                            if (info && info.teamName) effectiveTeamName = info.teamName;
                        }
                        if (!effectiveTeamName) return;
                        (parent.segments || []).forEach((seg) => {
                            if (seg.busId !== busId) return;
                            if (seg.isWalking === true) return;
                            if (seg.boardingRowId === row.rowId) {
                                teamsBoardingHere.push(`${effectiveTeamName}|${effectiveCategory}`);
                            }
                        });
                    });
                    const filteredTeamsIn = filterTeamsByCategory(teamsBoardingHere);
            
                    if (filteredTeamsIn.length === 0) {
                        return React.createElement('span', { className: 'text-xs text-gray-400 italic' }, '—');
                    }
                    return React.createElement(
                        'div',
                        { className: 'flex flex-nowrap gap-2 items-center' },
                        filteredTeamsIn.map((tn, i) => {
                            const parts = String(tn).split('|');
                            const teamName = parts[0] || tn;
                            const teamCategory = parts[1] || '';
                            const shortcut = getTeamShortcut(teamCategory, teamName);
                            const teamLabel = shortcut || teamName;
                            const textColor = getCategoryTextColor(teamCategory);
                            return React.createElement(
                                'span',
                                {
                                    key: `in-${i}`,
                                    onClick: () => removeTeamSegment(tn, 'in', row),
                                    title: getTeamTooltipLabel(tn),
                                    className: 'inline-flex items-center gap-1 text-sm font-semibold cursor-pointer hover:underline whitespace-nowrap',
                                    style: { color: textColor }
                                },
                                teamLabel
                            );
                        })
                    );
                })()
            ),
            React.createElement('td', { className: 'border border-gray-300 p-1 align-middle whitespace-nowrap' },
                (() => {
                    const teamsAlightingHere = [];
                    (savedTransfersRef.current || []).forEach((parent) => {
                        if (parent.dayKey !== dayKey) return;
                        if (parent.isWalking === true) return;
                        const effectiveCategory = cleanCategory(parent.category || '');
                        let effectiveTeamName = String(parent.teamName || '').trim();
                        if (!effectiveTeamName && parent.teamUid != null && parent.teamIndex != null) {
                            const lookupKey = `${parent.teamUid}|${effectiveCategory}|${parent.teamIndex}`;
                            const info = (teamsLookupRef.current || {})[lookupKey];
                            if (info && info.teamName) effectiveTeamName = info.teamName;
                        }
                        if (!effectiveTeamName) return;
                        (parent.segments || []).forEach((seg) => {
                            if (seg.busId !== busId) return;
                            if (seg.isWalking === true) return;
                            if (seg.alightingRowId === row.rowId) {
                                teamsAlightingHere.push(`${effectiveTeamName}|${effectiveCategory}`);
                            }
                        });
                    });
                    const filteredTeamsOut = filterTeamsByCategory(teamsAlightingHere);
                    if (filteredTeamsOut.length === 0) {
                        return React.createElement('span', { className: 'text-xs text-gray-400 italic' }, '—');
                    }
                    return React.createElement(
                        'div',
                        { className: 'flex flex-nowrap gap-2 items-center' },
                        filteredTeamsOut.map((tn, i) => {
                            const parts = String(tn).split('|');
                            const teamName = parts[0] || tn;
                            const teamCategory = parts[1] || '';
                            const shortcut = getTeamShortcut(teamCategory, teamName);
                            const teamLabel = shortcut || teamName;
                            const textColor = getCategoryTextColor(teamCategory);
                            return React.createElement(
                                'span',
                                {
                                    key: `out-${i}`,
                                    onClick: () => removeTeamSegment(tn, 'out', row),
                                    title: getTeamTooltipLabel(tn),
                                    className: 'inline-flex items-center gap-1 text-sm font-semibold cursor-pointer hover:underline whitespace-nowrap',
                                    style: { color: textColor }
                                },
                                teamLabel
                            );
                        })
                    );
                })()
            ),
            React.createElement('td', {
                className: 'border border-gray-300 px-2 py-1 text-center text-sm font-semibold',
                style: { color: '#1d4ed8' },
                title: 'Automaticky vypočítaný počet členov tímov, ktoré sú práve v autobuse (medzi zastávkami). Ak tím nie je v users, použije sa priemer kategórie.',
            },
                (() => {
                    const teamsInBus = getTeamsInBusAfterRow(busId, dayKey, row.id);
                    if (teamsInBus.length === 0) {
                        return React.createElement('span', { className: 'text-gray-400' }, '—');
                    }
                    const total = teamsInBus.reduce((sum, tk) => sum + getTeamMembersCount(tk), 0);
                    return total > 0 ? total : React.createElement('span', { className: 'text-gray-400' }, '—');
                })()
            ),
            React.createElement('td', {
                className: 'border border-gray-300 px-2 py-1 text-center text-sm font-semibold',
                style: {
                    color: (() => {
                        if (travelMinutes != null) {
                            return '#b45309';
                        }
                        const timeRe = /^\d{1,2}:\d{2}$/;
                        if (!row.timeFrom || !row.timeTo ||
                            !timeRe.test(row.timeFrom) || !timeRe.test(row.timeTo)) {
                            return '#9ca3af';
                        }
                        const [fh, fm] = row.timeFrom.split(':').map(Number);
                        const [th, tm] = row.timeTo.split(':').map(Number);
                        const fromMin = fh * 60 + fm;
                        const toMin = th * 60 + tm;
                        if (fromMin > toMin) return '#dc2626';
                        return '#b45309';
                    })(),
                },
                title: (() => {
                    if (travelMinutes != null) {
                        return `Trvanie jazdy nastavené v Nastaveniach: ${travelMinutes} min`;
                    }
                    const timeRe = /^\d{1,2}:\d{2}$/;
                    if (!row.timeFrom || !row.timeTo ||
                        !timeRe.test(row.timeFrom) || !timeRe.test(row.timeTo)) {
                        return 'Trvanie sa počíta zo zobrazených časov Od a Do – jeden z nich chýba';
                    }
                    const [fh, fm] = row.timeFrom.split(':').map(Number);
                    const [th, tm] = row.timeTo.split(':').map(Number);
                    if (fh * 60 + fm > th * 60 + tm) {
                        return `Chyba: čas od (${row.timeFrom}) je neskorší ako čas do (${row.timeTo})`;
                    }
                    return `Trvanie vypočítané zo zobrazených časov: ${row.timeFrom} → ${row.timeTo}`;
                })(),
            }, (() => {
                if (travelMinutes != null) {
                    return travelMinutes;
                }
                const timeRe = /^\d{1,2}:\d{2}$/;
                if (!row.timeFrom || !row.timeTo ||
                    !timeRe.test(row.timeFrom) || !timeRe.test(row.timeTo)) {
                    return '—';
                }
                const [fh, fm] = row.timeFrom.split(':').map(Number);
                const [th, tm] = row.timeTo.split(':').map(Number);
                const fromMin = fh * 60 + fm;
                const toMin = th * 60 + tm;
                if (fromMin > toMin) {
                    return 'chyba';
                }
                let diff = toMin - fromMin;
                if (diff < 0) diff += 24 * 60;
                return diff;
            })()),
            React.createElement('td', { className: 'border border-gray-300 p-1 text-center' },
                React.createElement('button', {
                    type: 'button',
                    onClick: () => removeBusRow(row.id),
                    className: 'text-red-600 hover:text-red-800 hover:bg-red-50 rounded w-7 h-7 flex items-center justify-center mx-auto',
                    title: 'Odstrániť riadok',
                }, React.createElement('i', { className: 'fa-solid fa-xmark' })),            
                (() => {
                    // Zelené "plus" zobrazíme len ak sú vyplnené miesta potrebné na vloženie riadku.
                    // placeFrom môže byť uzamknuté z predchádzajúceho riadku (lockedPlaceFrom),
                    // takže kontrolujeme efektívne miesto od (uzamknuté alebo vybrané) a miesto do.
                    const effectivePlaceFromId = lockedPlaceFromId || row.placeFromId || null;
                    const hasPlaceFrom = !!effectivePlaceFromId;
                    const hasPlaceTo = !!row.placeToId;
                    const canInsertRow = hasPlaceFrom && hasPlaceTo;

                    if (!canInsertRow) {
                        return null;
                    }

                    return React.createElement(
                        'div',
                        {
                            className: 'absolute left-1/2 -translate-x-1/2 pointer-events-none',
                            style: {
                                bottom: '-12px',
                                zIndex: 100,
                            }
                        },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: async () => {
                                    const rowsKey = `${busId}|${dayKey}`;
                                    const allRows = (busRows[rowsKey] || [])
                                        .slice()
                                        .sort((a, b) => (a.order || 0) - (b.order || 0));
                                    const idx = allRows.findIndex((r) => r.id === row.id);
                                    if (idx === -1) return;
                                    const nextRow = allRows[idx + 1];
                                    const realBus = buses.find((b) => b.id === busId) || { id: busId, name: '' };
                                    if (!nextRow) {
                                        await addBusRow(realBus, dayKey);
                                        return;
                                    }
                                    await insertBusRowBetween(realBus, dayKey, row, nextRow);
                                },
                                className:
                                    'pointer-events-auto w-6 h-6 rounded-full bg-green-600 text-white shadow-md ' +
                                    'hover:bg-green-700 active:scale-95 transition-all duration-150 ' +
                                    'flex items-center justify-center opacity-0 group-hover:opacity-100',
                            },
                            React.createElement('i', { className: 'fa-solid fa-plus text-[10px]' })
                        )
                    );
                })()
            )
        );
    };
    
    const addNewBus = async () => {
        if (!window.db || busSaving) return;
        setBusSaving(true);
        try {
            const existingNumbers = new Set(
                buses
                    .map((b) => Number(b.number))
                    .filter((n) => Number.isFinite(n) && n > 0)
                    .map((n) => Math.floor(n))
            );
    
            let nextNumber = 1;
            while (existingNumbers.has(nextNumber)) {
                nextNumber += 1;
            }

            const docRef = doc(collection(window.db, 'transport'));
            await setDoc(docRef, {
                type: 'bus',
                number: nextNumber,
                name: `Bus ${nextNumber}`,
            });
    
            window.showGlobalNotification(`Pridaný Bus ${nextNumber}.`, 'success');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri pridávaní autobusu:', err);
            window.showGlobalNotification('Nepodarilo sa pridať autobus.', 'error');
        } finally {
            setBusSaving(false);
        }
    };

    const removeBus = async (bus) => {
        if (!window.db || !bus) return;
        try {
            await deleteDoc(doc(window.db, 'transport', bus.id));
            window.showGlobalNotification(`${bus.name} bol odstránený.`, 'info');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri odstraňovaní autobusu:', err);
            window.showGlobalNotification('Nepodarilo sa odstrániť autobus.', 'error');
        }
    };

    const deleteTransfers = async ({ categoryId, categoryName }) => {
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }
        try {
            const targetCat = cleanCategory(categoryName);

            const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
            const snap = await getDoc(docRef);

            let keysToDelete = [];
            if (snap.exists()) {
                const data = snap.data() || {};
                const rawTransfers = data[TRANSPORT_TRANSFERS_FIELD] || {};
                Object.entries(rawTransfers).forEach(([key, v]) => {
                    if (!v) return;
                    if (cleanCategory(v.category) === targetCat) {
                        keysToDelete.push(key);
                    }
                });
            }

            if (keysToDelete.length > 0) {
                const transfersPatch = {};
                keysToDelete.forEach((key) => {
                    transfersPatch[key] = deleteField();
                });
                await setDoc(
                    docRef,
                    {
                        [TRANSPORT_TRANSFERS_FIELD]: transfersPatch,
                    },
                    { merge: true }
                );
            }

            const rowsUpdates = {};
            let rowsTouchedCount = 0;

            Object.entries(busRows || {}).forEach(([busKey, rows]) => {
                (rows || []).forEach((row) => {
                    const currentTeamsIn = Array.isArray(row.teamsIn) ? row.teamsIn : [];
                    const currentTeamsOut = Array.isArray(row.teamsOut) ? row.teamsOut : [];

                    const isFromTargetCategory = (teamKey) => {
                        const [tn, cat] = String(teamKey).split('|');
                        return cleanCategory(cat || '') === targetCat;
                    };

                    const newTeamsIn = currentTeamsIn.filter((tk) => !isFromTargetCategory(tk));
                    const newTeamsOut = currentTeamsOut.filter((tk) => !isFromTargetCategory(tk));

                    const teamsInChanged = newTeamsIn.length !== currentTeamsIn.length;
                    const teamsOutChanged = newTeamsOut.length !== currentTeamsOut.length;

                    if (teamsInChanged || teamsOutChanged) {
                        const patch = {};
                        if (teamsInChanged) patch.teamsIn = newTeamsIn;
                        if (teamsOutChanged) patch.teamsOut = newTeamsOut;
                        rowsUpdates[row.id] = patch;
                        rowsTouchedCount += 1;
                    }
                });
            });

            if (rowsTouchedCount > 0) {
                const promises = Object.entries(rowsUpdates).map(([rid, patch]) =>
                    updateDoc(doc(window.db, 'transport', rid), patch)
                );
                await Promise.all(promises);
            }

            if (keysToDelete.length === 0 && rowsTouchedCount === 0) {
                window.showGlobalNotification(
                    `Pre kategóriu ${categoryName} neexistujú žiadne presuny ani priradenia na zmazanie.`,
                    'info'
                );
                return;
            }

            const parts = [];
            if (keysToDelete.length > 0) {
                parts.push(`${keysToDelete.length} presunov`);
            }
            if (rowsTouchedCount > 0) {
                parts.push(`${rowsTouchedCount} priradení v autobusoch`);
            }

            window.showGlobalNotification(
                `Zmazané pre kategóriu ${categoryName}: ${parts.join(', ')}.`,
                'success'
            );
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri mazaní presunov:', err);
            window.showGlobalNotification('Nepodarilo sa zmazať presuny.', 'error');
        }
    };

    const deleteSingleTransfer = async (transfer) => {
        if (!window.db || !transfer) return;
        setDeleteTransferSaving(true);
        try {
            const isSegment = !!transfer._parentKey;
    
            if (isSegment) {
                const parentKey = transfer._parentKey;
                const parent = savedTransfersRef.current.find((s) => s.key === parentKey);
                if (!parent) {
                    window.showGlobalNotification('Parent presun sa nenašiel.', 'error');
                    setDeleteTransferModal(null);
                    return;
                }
    
                const segFromId = transfer.fromId || null;
                const segToId = transfer.toId || null;
    
                const draft = {
                    ...parent,
                    segments: Array.isArray(parent.segments)
                        ? parent.segments.map((s) => ({ ...s }))
                        : buildDefaultSegments(parent),
                    intermediateStopIds: Array.isArray(parent.intermediateStopIds)
                        ? [...parent.intermediateStopIds]
                        : [],
                };
    
                const segIdx = findSegmentIndex(draft.segments, segFromId, segToId);
                if (segIdx === -1) {
                    window.showGlobalNotification('Segment sa nenašiel v parentovi.', 'error');
                    setDeleteTransferModal(null);
                    return;
                }
    
                draft.segments.splice(segIdx, 1);
    
                const fromId = draft.fromId || null;
                const toId = draft.toId || null;
                const routeIds = [];
                if (draft.segments.length === 0) {
                    routeIds.push(fromId, toId);
                } else {
                    routeIds.push(draft.segments[0].fromId);
                    draft.segments.forEach((s) => routeIds.push(s.toId));
                    if (routeIds[0] !== fromId) routeIds.unshift(fromId);
                    if (routeIds[routeIds.length - 1] !== toId) routeIds.push(toId);
                }
    
                const newIntermediateStops = routeIds
                    .slice(1, -1)
                    .filter((id) => id && id !== fromId && id !== toId);
    
                draft.intermediateStopIds = newIntermediateStops;
    
                if (draft.segments.length <= 1) {
                    draft.intermediateStopIds = [];
                }
    
                recomputeParentSegmentsInPlace(draft);

                const parentOriginalWhen = parent.when && String(parent.when).trim() !== '' ? parent.when : '';
                if ((!draft.when || String(draft.when).trim() === '') && parentOriginalWhen) {
                    draft.when = parentOriginalWhen;
                }

                if (draft.segments.length === 0) {
                    const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
                    await setDoc(
                        docRef,
                        { [TRANSPORT_TRANSFERS_FIELD]: { [parentKey]: deleteField() } },
                        { merge: true }
                    );
                } else {
                    await updateParentTransfer(parentKey, (d) => {
                        d.segments = draft.segments.map((s) => ({ ...s }));
                        d.intermediateStopIds = draft.intermediateStopIds;
                        if (draft.when && String(draft.when).trim() !== '') {
                            d.when = draft.when;
                        }
                    });
                }
    
                const fromName = resolvePlaceNameById(segFromId) || '';
                const toName = resolvePlaceNameById(segToId) || '';
                window.showGlobalNotification(
                    `Časť presunu ${fromName} → ${toName} bola odstránená.`,
                    'success'
                );
                setDeleteTransferModal(null);
                return;
            }
    
            const parentKey = transfer.key;
            const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
            await setDoc(
                docRef,
                { [TRANSPORT_TRANSFERS_FIELD]: { [parentKey]: deleteField() } },
                { merge: true }
            );
            const fromName = resolvePlaceNameById(transfer.fromId) || '';
            const toName = resolvePlaceNameById(transfer.toId) || '';
            window.showGlobalNotification(
                `Presun ${fromName} → ${toName} bol odstránený.`,
                'success'
            );
            setDeleteTransferModal(null);
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri mazaní presunu:', err);
            window.showGlobalNotification('Nepodarilo sa odstrániť presun.', 'error');
        } finally {
            setDeleteTransferSaving(false);
        }
    };

    const saveEditedTransfer = async () => {
        if (!window.db || !editingTransfer) return;
        const original = editingTransfer;
    
        const stopIds = (editingTransferStops || [])
            .map((s) => resolvePlaceIdByName(s))
            .filter(Boolean);
    
        const parentKey = original._parentKey || original.key;
    
        const originalWhen = (() => {
            const parentRec = savedTransfersRef.current.find((s) => s.key === parentKey);
            if (parentRec && parentRec.when && String(parentRec.when).trim() !== '') {
                return parentRec.when;
            }
    
            if (original.when && String(original.when).trim() !== '') {
                return original.when;
            }
    
            if (parentRec && Array.isArray(parentRec.segments) && parentRec.segments.length > 0) {
                let earliestStart = null;
                let latestEnd = null;
                parentRec.segments.forEach((s) => {
                    if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                        earliestStart = s.startTs;
                    }
                    if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                        latestEnd = s.endTs;
                    }
                });
                if (earliestStart != null && latestEnd != null) {
                    return `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                } else if (earliestStart != null) {
                    return formatTsLocal(earliestStart);
                } else if (latestEnd != null) {
                    return formatTsLocal(latestEnd);
                }
            }
    
            if (Array.isArray(original.segments) && original.segments.length > 0) {
                let earliestStart = null;
                let latestEnd = null;
                original.segments.forEach((s) => {
                    if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                        earliestStart = s.startTs;
                    }
                    if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                        latestEnd = s.endTs;
                    }
                });
                if (earliestStart != null && latestEnd != null) {
                    return `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                } else if (earliestStart != null) {
                    return formatTsLocal(earliestStart);
                } else if (latestEnd != null) {
                    return formatTsLocal(latestEnd);
                }
            }
    
            return null;
        })();
    
        setEditingTransferSaving(true);
        try {
            const parentRec = savedTransfersRef.current.find((s) => s.key === parentKey);
            if (!parentRec) {
                throw new Error('Parent presun sa nenašiel');
            }

            const draft = {
                ...parentRec,
                segments: Array.isArray(parentRec.segments)
                    ? parentRec.segments.map((s) => ({ ...s }))
                    : buildDefaultSegments(parentRec),
            };

            if (stopIds.length === 0) {
                draft.intermediateStopIds = [];
                draft.segments = buildDefaultSegments({
                    ...draft,
                    intermediateStopIds: [],
                });

                const oldSegments = Array.isArray(original.segments) ? original.segments : [];
                draft.segments.forEach((s) => {
                    const old = oldSegments.find(
                        (o) => o.fromId === s.fromId && o.toId === s.toId
                    );
                    if (old) {
                        s.isWalking = old.isWalking === true;
                        s.walkingSetAt = old.walkingSetAt || null;
                        s.walkingSetBy = old.walkingSetBy || null;
                    }
                });
            } else {
                draft.intermediateStopIds = stopIds;
                draft.segments = buildDefaultSegments({ ...draft, intermediateStopIds: stopIds });

                const oldSegments = Array.isArray(original.segments) ? original.segments : [];
                draft.segments.forEach((s) => {
                    const old = oldSegments.find(
                        (o) => o.fromId === s.fromId && o.toId === s.toId
                    );
                    if (old) {
                        s.isWalking = old.isWalking === true;
                        s.walkingSetAt = old.walkingSetAt || null;
                        s.walkingSetBy = old.walkingSetBy || null;
                    }
                });
            }

            if (originalWhen && originalWhen.trim() !== '') {
                draft.when = originalWhen;
            }

            recomputeParentSegmentsInPlace(draft);

            await updateParentTransfer(parentKey, (d) => {
                d.intermediateStopIds = draft.intermediateStopIds;
                d.segments = draft.segments.map((s) => ({ ...s }));
                d.when = draft.when;
            });

            const updatedTransfer = {
                ...parentRec,
                intermediateStopIds: Array.isArray(draft.intermediateStopIds) ? [...draft.intermediateStopIds] : [],
                segments: (draft.segments || []).map((s) => ({ ...s })),
                when: draft.when,
                intermediateStops: Array.isArray(draft.intermediateStopIds)
                    ? draft.intermediateStopIds.map(resolvePlaceNameById)
                    : [],
            };

            const updatedTransfers = (savedTransfersRef.current || []).map((t) =>
                t.key === parentKey ? updatedTransfer : t
            );
            savedTransfersRef.current = updatedTransfers;
            setSavedTransfers(updatedTransfers);
    
            window.showGlobalNotification(
                stopIds.length > 0
                    ? `Presun bol upravený (${stopIds.length} medzizastávok).`
                    : 'Medzizastávky boli odstránené.',
                'success'
            );
            setEditingTransfer(null);
            setEditingTransferStops([]);
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri ukladaní upraveného presunu:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť úpravu presunu.', 'error');
        } finally {
            setEditingTransferSaving(false);
        }
    };

    const isSegmentCoveredByBus = (segment) => {
        if (!segment) return false;

        const fromId = segment.fromId || null;
        const toId = segment.toId || null;
        if (!fromId || !toId) return false;

        const parentKey = segment._parentKey || segment.key;
        const parent = (savedTransfersRef.current || []).find((p) => p.key === parentKey);
        if (!parent || !Array.isArray(parent.segments)) return false;

        const segIdx = findSegmentIndex(parent.segments, fromId, toId);
        if (segIdx === -1) return false;
        const seg = parent.segments[segIdx];
        return !!(seg && seg.busId && seg.boardingRowId && seg.alightingRowId);
    };

    
    const arePreviousSegmentsResolved = (transfer) => {
        if (!transfer) return true;

        const parentKey = transfer._parentKey || transfer.key;
        const currentParent = (savedTransfersRef.current || []).find(
            (s) => s.key === parentKey
        );

        let effectiveTransfer = transfer;
        if (currentParent) {
            if (transfer._parentKey) {
                const segIdx = findSegmentIndex(
                    currentParent.segments || [],
                    transfer.fromId,
                    transfer.toId
                );
                const seg = segIdx !== -1 ? currentParent.segments[segIdx] : null;
                effectiveTransfer = {
                    ...transfer,
                    segments: currentParent.segments,
                    isWalking: seg ? seg.isWalking === true : false,
                };
            } else {
                effectiveTransfer = {
                    ...transfer,
                    segments: currentParent.segments,
                };
            }
        }

        const teamName = String(effectiveTransfer.teamName || '').trim();
        const category = cleanCategory(effectiveTransfer.category || '');
        const dayKey = effectiveTransfer.dayKey || '';

        let effectiveWhen = effectiveTransfer.when;

        if (!effectiveWhen || String(effectiveWhen).trim() === '') {
            const segs = Array.isArray(effectiveTransfer.segments) ? effectiveTransfer.segments : [];
            let earliestStart = null;
            let latestEnd = null;
            segs.forEach((s) => {
                if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) earliestStart = s.startTs;
                if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) latestEnd = s.endTs;
            });
            if (earliestStart != null && latestEnd != null) {
                effectiveWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
            } else if (earliestStart != null) {
                effectiveWhen = formatTsLocal(earliestStart);
            } else if (latestEnd != null) {
                effectiveWhen = formatTsLocal(latestEnd);
            }
        }

        if (!effectiveWhen || String(effectiveWhen).trim() === '') {
            if (parentKey) {
                const parentRec = (savedTransfersRef.current || []).find((s) => s.key === parentKey);
                if (parentRec && parentRec.when && String(parentRec.when).trim() !== '') {
                    effectiveWhen = parentRec.when;
                } else if (parentRec && Array.isArray(parentRec.segments) && parentRec.segments.length > 0) {
                    let earliestStart = null;
                    let latestEnd = null;
                    parentRec.segments.forEach((s) => {
                        if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) earliestStart = s.startTs;
                        if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) latestEnd = s.endTs;
                    });
                    if (earliestStart != null && latestEnd != null) {
                        effectiveWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                    }
                }
            }
        }

        const trRange = parseTransferWhenToRange(effectiveWhen);
        if (!trRange) {
            console.warn('[TRANSPORT][arePreviousSegmentsResolved] Žiadny trRange pre:', { transfer: effectiveTransfer, effectiveWhen });
            return true;
        }

        const targetParentKey = effectiveTransfer._parentKey || effectiveTransfer.key;
        const allSegments = [];

        savedTransfers
            .filter((t) =>
                String(t.teamName || '').trim() === teamName &&
                cleanCategory(t.category || '') === category &&
                t.dayKey === dayKey &&
                t.key === targetParentKey
            )
            .forEach((t) => {
                const stopsIds = Array.isArray(t.intermediateStopIds) ? t.intermediateStopIds : [];

                if (stopsIds.length === 0) {
                    const range = parseTransferWhenToRange(t.when);
                    if (range) {
                        allSegments.push({
                            ...t,
                            range,
                            fromId: t.fromId,
                            toId: t.toId,
                            isWalking: t.isWalking === true,
                            _parentKey: t.key,
                        });
                    }
                    return;
                }

                const routeIdsRaw = [t.fromId, ...stopsIds, t.toId].filter(Boolean);
                const routeIds = [];
                routeIdsRaw.forEach((id) => {
                    if (routeIds.length === 0 || routeIds[routeIds.length - 1] !== id) routeIds.push(id);
                });

                if (routeIds.length < 2) return;

                const timeRange = parseTransferWhenToRange(t.when);
                if (!timeRange) return;

                const teamKey = `${teamName}|${category}`;
                const allBusRowsForDay = [];
                Object.entries(busRows || {}).forEach(([busKey, rows]) => {
                    const bDayKey = busKey.split('|')[1];
                    if (bDayKey !== dayKey) return;
                    (rows || []).forEach((row) => {
                        allBusRowsForDay.push(row);
                    });
                });

                const matchesTeam = (rowTeams) => {
                    if (!Array.isArray(rowTeams)) return false;
                    return rowTeams.some((tk) => {
                        const s = String(tk).trim();
                        if (s === teamKey) return true;
                        const [tn, cat] = s.split('|');
                        return String(tn).trim() === teamName && cleanCategory(cat) === category;
                    });
                };

                for (let i = 0; i < routeIds.length - 1; i++) {
                    const segFromId = routeIds[i];
                    const segToId = routeIds[i + 1];

                    let boardingTs = null;
                    let alightingTs = null;

                    allBusRowsForDay.forEach((row) => {
                        const rowFromId = row.placeFromId || null;
                        const rowToId = row.placeToId || null;
                        const hasTeamIn = matchesTeam(row.teamsIn);
                        const hasTeamOut = matchesTeam(row.teamsOut);

                        if (hasTeamIn && rowFromId === segFromId && row.timeFrom && boardingTs == null) {
                            const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                            if (dm) {
                                const [h, mi] = row.timeFrom.split(':').map(Number);
                                boardingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                            }
                        }
                        if (hasTeamOut && rowToId === segToId && row.timeTo && alightingTs == null) {
                            const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                            if (dm) {
                                const [h, mi] = row.timeTo.split(':').map(Number);
                                alightingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                            }
                        }
                    });

                    const parentSegForThisIdx = Array.isArray(t.segments)
                        ? t.segments.find((s) => s.fromId === segFromId && s.toId === segToId)
                        : null;
                    const isWalkingInParent = parentSegForThisIdx && parentSegForThisIdx.isWalking === true;
                    const isSegmentWalking = t.isWalking === true || isWalkingInParent;

                    let segStartTs, segEndTs;
                    if (isSegmentWalking) {
                        if (boardingTs != null) {
                            segStartTs = boardingTs;
                            segEndTs = boardingTs;
                        } else if (alightingTs != null) {
                            segStartTs = alightingTs;
                            segEndTs = alightingTs;
                        } else {
                            segStartTs = timeRange.startTs;
                            segEndTs = timeRange.startTs;
                        }
                    } else if (boardingTs != null && alightingTs != null) {
                        segStartTs = boardingTs;
                        segEndTs = alightingTs;
                    } else if (boardingTs != null) {
                        segStartTs = boardingTs;
                        segEndTs = timeRange.endTs;
                    } else if (alightingTs != null) {
                        segStartTs = timeRange.startTs;
                        segEndTs = alightingTs;
                    } else {
                        segStartTs = (i > 0 && allSegments.length > 0)
                            ? allSegments[allSegments.length - 1].range.endTs
                            : timeRange.startTs;
                        segEndTs = timeRange.endTs;
                    }

                    allSegments.push({
                        ...t,
                        key: buildTransferKey(
                            t.category,
                            t.teamName,
                            `${formatTsLocal(segStartTs)} – ${formatTsLocal(segEndTs)}`,
                            `Presun z ${resolvePlaceNameById(segFromId)} do ${resolvePlaceNameById(segToId)}`
                        ),
                        range: { startTs: segStartTs, endTs: segEndTs },
                        fromId: segFromId,
                        toId: segToId,
                        isWalking: isSegmentWalking,
                        _parentKey: t.key,
                        _isAssigned: boardingTs != null || alightingTs != null,
                    });
                }
            });

        allSegments.sort((a, b) => a.range.startTs - b.range.startTs);

        const transferFromId = effectiveTransfer.fromId || null;
        const transferToId = effectiveTransfer.toId || null;

        for (const seg of allSegments) {
            const segFromId = seg.fromId || null;
            const segToId = seg.toId || null;
            if (segFromId === transferFromId && segToId === transferToId) continue;

            if (seg.isWalking === true) continue;

            if (seg._parentKey) {
                const parent = savedTransfers.find(p => p.key === seg._parentKey);
                if (parent) {
                    const pFromId = parent.fromId || null;
                    if (segFromId === pFromId) {
                        continue;
                    }
                }
            }

            if (seg.range.startTs >= trRange.startTs) continue;

            if (seg._isAssigned === true) continue;

            if (!isSegmentCoveredByBus(seg)) {
                console.warn('[TRANSPORT][arePreviousSegmentsResolved] BLOKUJÚCI segment:', {
                    seg,
                    trRange,
                    effectiveTransfer: {
                        key: effectiveTransfer.key,
                        _parentKey: effectiveTransfer._parentKey,
                        fromId: effectiveTransfer.fromId,
                        toId: effectiveTransfer.toId,
                        when: effectiveTransfer.when,
                    },
                    allSegments: allSegments.map((s) => ({
                        fromId: s.fromId,
                        toId: s.toId,
                        isWalking: s.isWalking,
                        _isAssigned: s._isAssigned,
                        _parentKey: s._parentKey,
                        range: s.range,
                    })),
                });
                return false;
            }
        }

        return true;
    };

    const timeOnDayKeyToTs = (dayKey, timeStr) => {
        if (!dayKey || !timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
        const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
        if (!dm) return null;
        const [h, mi] = timeStr.split(':').map(Number);
        return new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
    };

    const findMatchingBusRows = (transfer) => {
        if (!transfer) return [];

        let effectiveWhen = null;
        let trRange = null;

        // Priorita 1: parent segment pre tento konkrétny segment (ak je priradený busu)
        const parentKeyForRange = transfer._parentKey || transfer.key;
        const parentRecForRange = (savedTransfersRef.current || []).find((s) => s.key === parentKeyForRange);
        
        // Priorita 1a: ak je segment už priradený busu, použi jeho reálny čas
        if (parentRecForRange && Array.isArray(parentRecForRange.segments)) {
            const segIdx = findSegmentIndex(parentRecForRange.segments, transfer.fromId, transfer.toId);
            if (segIdx !== -1) {
                const seg = parentRecForRange.segments[segIdx];
                if (seg && seg.busId && seg.boardingRowId && seg.alightingRowId
                    && seg.startTs != null && seg.endTs != null && seg.endTs > seg.startTs) {
                    trRange = { startTs: seg.startTs, endTs: seg.endTs };
                    effectiveWhen = `${formatTsLocal(seg.startTs)} – ${formatTsLocal(seg.endTs)}`;
                }
            }
        }

        // Priorita 1b: provizórny výpočet segmentu (TOTO je to, čo sa zobrazuje v modálnom okne)
        if (!trRange) {
            const provisional = computeProvisionalSegmentRange(transfer);
            if (provisional && provisional.startTs != null && provisional.endTs != null && provisional.endTs > provisional.startTs) {
                trRange = { startTs: provisional.startTs, endTs: provisional.endTs };
                effectiveWhen = `${formatTsLocal(provisional.startTs)} – ${formatTsLocal(provisional.endTs)}`;
            }
        }

        // Priorita 2: parent.when (širší interval)
        if (!trRange && parentRecForRange && parentRecForRange.when && String(parentRecForRange.when).trim() !== '') {
            effectiveWhen = String(parentRecForRange.when).trim();
            trRange = parseTransferWhenToRange(effectiveWhen);
        }

        // Priorita 3: transfer.when
        if (!trRange && transfer.when && String(transfer.when).trim() !== '') {
            effectiveWhen = String(transfer.when).trim();
            trRange = parseTransferWhenToRange(effectiveWhen);
        }

        // Priorita 4: z parent.segments (min startTs / max endTs)
        if (!trRange && parentRecForRange && Array.isArray(parentRecForRange.segments) && parentRecForRange.segments.length > 0) {
            let earliestStart = null;
            let latestEnd = null;
            parentRecForRange.segments.forEach((s) => {
                if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) earliestStart = s.startTs;
                if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) latestEnd = s.endTs;
            });
            if (earliestStart != null && latestEnd != null && latestEnd > earliestStart) {
                trRange = { startTs: earliestStart, endTs: latestEnd };
                effectiveWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
            }
        }

        // Priorita 5: dayKey ako fallback
        if (!trRange) {
            let effectiveDayKeyForFallback = transfer.dayKey || null;
            if (!effectiveDayKeyForFallback && parentRecForRange && parentRecForRange.dayKey) {
                effectiveDayKeyForFallback = parentRecForRange.dayKey;
            }
            if (effectiveDayKeyForFallback) {
                const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effectiveDayKeyForFallback);
                if (dm) {
                    const dayStart = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), 0, 0, 0, 0).getTime();
                    trRange = { startTs: dayStart, endTs: dayStart + 24 * 60 * 60 * 1000 - 60000 };
                    effectiveWhen = `${formatTsLocal(trRange.startTs)} – ${formatTsLocal(trRange.endTs)}`;
                }
            }
        }

        const trFromId = transfer.fromId || null;
        const trToId = transfer.toId || null;
        const trDayKey = transfer.dayKey || (parentRecForRange ? parentRecForRange.dayKey : null);

        if (!trRange || !trFromId || !trToId || !trDayKey) {
            return [];
        }

        // OPRAVA: výpočet timeTo s fallbackom na travelMinutes z parent segmentu
        const getEffectiveTravelMinutes = (row) => {
            if (!row) return null;
            const direct = getTravelMinutes(row.placeFromId, row.placeToId);
            if (direct != null) return direct;

            for (const parent of (savedTransfersRef.current || [])) {
                if (parent.dayKey !== trDayKey) continue;
                for (const seg of (parent.segments || [])) {
                    if (!seg || seg.isWalking === true) continue;
                    if (seg.busId !== null && seg.busId !== undefined) continue;
                    if (seg.fromId === row.placeFromId && seg.toId === row.placeToId) {
                        const mins = getTravelMinutes(seg.fromId, seg.toId);
                        if (mins != null) return mins;
                    }
                }
            }
            return null;
        };

        const computeRowTimeToStr = (row) => {
            if (!row) return null;
            if (row.timeTo && /^\d{1,2}:\d{2}$/.test(row.timeTo)) return row.timeTo;
            if (!row.timeFrom || !/^\d{1,2}:\d{2}$/.test(row.timeFrom)) return null;
            if (!row.placeFromId || !row.placeToId) return null;
            const mins = getEffectiveTravelMinutes(row);
            if (mins == null) return null;
            const [h, m] = row.timeFrom.split(':').map(Number);
            let total = h * 60 + m + Number(mins);
            total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
            const endH = Math.floor(total / 60);
            const endM = total % 60;
            return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        };

        const results = [];

        Object.entries(busRows || {}).forEach(([key, rows]) => {
            const [busId, dayKey] = key.split('|');
            if (dayKey !== trDayKey) return;

            const bus = buses.find((b) => b.id === busId);
            if (!bus) return;
            if (!rows || rows.length === 0) return;

            const sortedRows = [...rows].sort((a, b) => (a.order || 0) - (b.order || 0));

            const rangeStart = trRange.startTs;
            const rangeEnd = trRange.endTs;

            const boardingCandidates = [];
            const alightingCandidates = [];

            const normalizeNameForCompare = (name) => {
                if (!name) return '';
                return String(name)
                    .trim()
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/^zastavka\s+/i, '')
                    .replace(/^ubytovanie\s+/i, '')
                    .replace(/^ubytovna\s+/i, '')
                    .replace(/^miesto\s+zrazu\s+/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            };

            const getPlaceNameById = (id) => {
                if (!id) return '';
                const fromMap = (placesMapRef.current || {})[id];
                if (fromMap) return fromMap;
                const fromAll = (allPlacesRef.current || []).find((p) => p.id === id);
                if (fromAll) return fromAll.name;
                return '';
            };

            const resolveTransferNameToId = (rawName) => {
                if (!rawName) return null;
                const raw = String(rawName).trim();
                const directById = (allPlacesRef.current || []).find((p) => p.id === raw);
                if (directById) return directById.id;
                const norm = normalizeNameForCompare(raw);
                const found = (allPlacesRef.current || []).find(
                    (p) => normalizeNameForCompare(p.name) === norm
                );
                return found ? found.id : null;
            };

            const getTransferPlaceName = (transfer, which) => {
                if (!transfer) return '';
                const id = which === 'from' ? (transfer.fromId || null) : (transfer.toId || null);
                const fromIdName = getPlaceNameById(id);
                if (fromIdName) return fromIdName;
                if (transfer.text) {
                    const m = /^Presun z (.+?) do (.+)$/.exec(String(transfer.text).trim());
                    if (m) {
                        return which === 'from' ? m[1].trim() : m[2].trim();
                    }
                }
                return '';
            };

            const transferFromName = getTransferPlaceName(transfer, 'from');
            const transferToName = getTransferPlaceName(transfer, 'to');
            const transferFromIdResolved = trFromId || resolveTransferNameToId(transferFromName);
            const transferToIdResolved = trToId || resolveTransferNameToId(transferToName);

            if (!transferFromIdResolved || !transferToIdResolved) {
                return;
            }

            sortedRows.forEach((row) => {
                const rowFromId = row.placeFromId || null;
                const rowToId = row.placeToId || null;
                const rowFromName = row.placeFrom || getPlaceNameById(rowFromId) || '';
                const rowToName = row.placeTo || getPlaceNameById(rowToId) || '';

                const rowTimeFromStr = (row.timeFrom && /^\d{1,2}:\d{2}$/.test(row.timeFrom))
                    ? row.timeFrom
                    : null;
                const rowTimeToStr = computeRowTimeToStr(row);

                const rowTimeFromTs = rowTimeFromStr
                    ? timeOnDayKeyToTs(dayKey, rowTimeFromStr)
                    : null;
                const rowTimeToTs = rowTimeToStr
                    ? timeOnDayKeyToTs(dayKey, rowTimeToStr)
                    : null;

                let fromMatches = false;
                let toMatches = false;

                if (rowFromId != null && transferFromIdResolved != null && rowFromId === transferFromIdResolved) {
                    fromMatches = true;
                }
                if (rowToId != null && transferToIdResolved != null && rowToId === transferToIdResolved) {
                    toMatches = true;
                }

                if (!fromMatches && rowFromName && transferFromName) {
                    const a = normalizeNameForCompare(rowFromName);
                    const b = normalizeNameForCompare(transferFromName);
                    if (a && b && a === b) fromMatches = true;
                }
                if (!toMatches && rowToName && transferToName) {
                    const a = normalizeNameForCompare(rowToName);
                    const b = normalizeNameForCompare(transferToName);
                    if (a && b && a === b) toMatches = true;
                }

                const rangeStart = trRange.startTs;
                const rangeEnd = trRange.endTs;

                // Nástupný riadok musí začínať PO alebo V ČASE začiatku presunu
                // a zároveň nesmie začínať po konci presunu
                if (fromMatches && rowTimeFromTs != null) {
                    if (rowTimeFromTs >= rangeStart && rowTimeFromTs <= rangeEnd) {
                        boardingCandidates.push({ row, timeTs: rowTimeFromTs });
                    }
                }
                // Výstupný riadok musí končiť PRED alebo V ČASE konca presunu
                // a zároveň nesmie končiť pred začiatkom presunu
                if (toMatches && rowTimeToTs != null) {
                    if (rowTimeToTs >= rangeStart && rowTimeToTs <= rangeEnd) {
                        alightingCandidates.push({ row, timeTs: rowTimeToTs });
                    }
                }
            });

            boardingCandidates.forEach((board) => {
                alightingCandidates.forEach((alight) => {
                    if ((alight.row.order || 0) < (board.row.order || 0)) {
                        return;
                    }

                    const boardTimeStr = (board.row.timeFrom && /^\d{1,2}:\d{2}$/.test(board.row.timeFrom))
                        ? board.row.timeFrom
                        : null;
                    const alightTimeStr = computeRowTimeToStr(alight.row);

                    const boardTs = boardTimeStr ? timeOnDayKeyToTs(dayKey, boardTimeStr) : null;
                    const alightTs = alightTimeStr ? timeOnDayKeyToTs(dayKey, alightTimeStr) : null;

                    if (boardTs != null && alightTs != null && alightTs < boardTs) {
                        return;
                    }

                    // overenie, že celý bus riadok je v rámci časového okna presunu
                    if (boardTs != null && boardTs < rangeStart) {
                        return;
                    }
                    if (alightTs != null && alightTs > rangeEnd) {
                        return;
                    }

                    const segmentFromId = board.row.placeFromId || trFromId;
                    const segmentToId = alight.row.placeToId || trToId;

                    const segmentFromName = resolvePlaceNameById(segmentFromId);
                    const segmentToName = resolvePlaceNameById(segmentToId);

                    results.push({
                        bus,
                        trip: {
                            bus,
                            dayKey,
                            fromPlace: segmentFromName,
                            toPlace: segmentToName,
                            fromPlaceId: segmentFromId,
                            toPlaceId: segmentToId,
                            timeFrom: boardTimeStr || '',
                            timeTo: alightTimeStr || '',
                            firstRowId: board.row.id,
                            lastRowId: alight.row.id,
                            rows: sortedRows,
                        },
                        boardingRow: board.row,
                        alightingRow: alight.row,
                        side: 'in',
                        boardingTime: boardTimeStr || '',
                        alightingTime: alightTimeStr || '',
                    });
                });
            });
        });

        const computeTripDurationMinutes = (boardingRow, alightingRow) => {
            const timeRe = /^\d{1,2}:\d{2}$/;
            if (!boardingRow || !alightingRow) return null;

            const boardStr = (boardingRow.timeFrom && timeRe.test(boardingRow.timeFrom)) ? boardingRow.timeFrom : null;
            const alightStr = computeRowTimeToStr(alightingRow);

            if (!boardStr || !alightStr) return null;
            const [bh, bm] = boardStr.split(':').map(Number);
            const [ah, am] = alightStr.split(':').map(Number);
            let diff = (ah * 60 + am) - (bh * 60 + bm);
            if (diff < 0) diff += 24 * 60;
            return diff;
        };

        const getEffectiveDuration = (r) => {
            const d = computeTripDurationMinutes(r.boardingRow, r.alightingRow);
            return d != null ? d : Number.POSITIVE_INFINITY;
        };

        const pickShortestDuration = (group) => {
            if (!group || group.length === 0) return null;
            if (group.length === 1) return group[0];
            let best = group[0];
            let bestDuration = getEffectiveDuration(best);
            for (let i = 1; i < group.length; i++) {
                const r = group[i];
                const d = getEffectiveDuration(r);
                if (d < bestDuration) { best = r; bestDuration = d; }
            }
            return best;
        };

        const groupedByBoarding = new Map();
        results.forEach((r) => {
            const busId = r.bus?.id || '';
            const dayKey = r.trip?.dayKey || '';
            const boardingTime = r.boardingTime || '';
            const fromPlaceId = r.trip?.fromPlaceId || null;
            const key = `${busId}|${dayKey}|${boardingTime}|${fromPlaceId}`;
            if (!groupedByBoarding.has(key)) groupedByBoarding.set(key, []);
            groupedByBoarding.get(key).push(r);
        });

        const afterBoardingDedup = [];
        groupedByBoarding.forEach((group) => {
            const best = pickShortestDuration(group);
            if (best) afterBoardingDedup.push(best);
        });

        const groupedByAlighting = new Map();
        afterBoardingDedup.forEach((r) => {
            const busId = r.bus?.id || '';
            const dayKey = r.trip?.dayKey || '';
            const alightingTime = r.alightingTime || '';
            const toPlaceId = r.trip?.toPlaceId || null;
            const key = `${busId}|${dayKey}|${alightingTime}|${toPlaceId}`;
            if (!groupedByAlighting.has(key)) groupedByAlighting.set(key, []);
            groupedByAlighting.get(key).push(r);
        });

        const dedupedResults = [];
        groupedByAlighting.forEach((group) => {
            const best = pickShortestDuration(group);
            if (best) dedupedResults.push(best);
        });

        const MAX_TRIP_DURATION_MINUTES = 120;
        const filteredByDuration = dedupedResults.filter((r) => {
            const duration = computeTripDurationMinutes(r.boardingRow, r.alightingRow);
            if (duration == null) return true;
            return duration <= MAX_TRIP_DURATION_MINUTES;
        });

        filteredByDuration.sort((a, b) => {
            const timeA = a.boardingTime || a.alightingTime || '';
            const timeB = b.boardingTime || b.alightingTime || '';
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            return String(a.bus.name).localeCompare(String(b.bus.name), 'sk');
        });
        return filteredByDuration;
    };

    const recomputeParentSegmentsInPlace = (draft) => {
        if (!draft) return;
        const originalWhenFromDraft = draft.when;
        const stops = Array.isArray(draft.intermediateStopIds) ? draft.intermediateStopIds : [];
        const fromId = draft.fromId || null;
        const toId = draft.toId || null;
        const routeIdsRaw = [fromId, ...stops, toId].filter(Boolean);
        const routeIds = [];
        routeIdsRaw.forEach((id) => {
            if (routeIds.length === 0 || routeIds[routeIds.length - 1] !== id) routeIds.push(id);
        });
        if (routeIds.length < 2) return;
    
        if (!Array.isArray(draft.segments) || draft.segments.length !== routeIds.length - 1) {
            draft.segments = routeIds.slice(0, -1).map((id, i) => ({
                fromId: id,
                toId: routeIds[i + 1],
                startTs: null, endTs: null, when: null,
                isWalking: false, busAssigned: false,
                walkingSetAt: null, walkingSetBy: null,
            }));
        } else {
            draft.segments = draft.segments.map((s, i) => ({
                ...s,
                fromId: routeIds[i],
                toId: routeIds[i + 1],
            }));
        }
    
        const dayKey = draft.dayKey || '';
        const teamName = String(draft.teamName || '').trim();
        const category = cleanCategory(draft.category || '');
    
        const allBusRowsForDay = [];
        Object.entries(busRows || {}).forEach(([busKey, rows]) => {
            const bDayKey = busKey.split('|')[1];
            if (bDayKey !== dayKey) return;
            (rows || []).forEach((row) => allBusRowsForDay.push({ ...row, _busKey: busKey }));
        });
        allBusRowsForDay.sort((a, b) => (a.timeFrom || '').localeCompare(b.timeFrom || ''));
    
        const teamKey = `${teamName}|${category}`;
        const matchesTeam = (rowTeams) => {
            if (!Array.isArray(rowTeams)) return false;
            return rowTeams.some((tk) => {
                const s = String(tk).trim();
                if (s === teamKey) return true;
                const [tn, cat] = s.split('|');
                return String(tn).trim() === teamName && cleanCategory(cat) === category;
            });
        };
    
        const findBusTimesForSegment = (fromIdSeg, toIdSeg) => {
            const parentSeg = draft.segments.find(
                (s) => s.fromId === fromIdSeg && s.toId === toIdSeg
            );
            if (!parentSeg || !parentSeg.busId) return { boardingTs: null, alightingTs: null, busId: null };        
            const boardingRow = allBusRowsForDay.find(
                (r) => r.rowId === parentSeg.boardingRowId && String(r._busKey).split('|')[0] === parentSeg.busId
            );
            const alightingRow = allBusRowsForDay.find(
                (r) => r.rowId === parentSeg.alightingRowId && String(r._busKey).split('|')[0] === parentSeg.busId
            );        
            let boardingTs = null;
            let alightingTs = null;
            const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
            if (dm) {
                if (boardingRow && boardingRow.timeFrom) {
                    const [h, mi] = boardingRow.timeFrom.split(':').map(Number);
                    boardingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                }
                if (alightingRow && alightingRow.timeTo) {
                    const [h, mi] = alightingRow.timeTo.split(':').map(Number);
                    alightingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                }
            }
            return { boardingTs, alightingTs, busId: parentSeg.busId };
        };
        draft.segments = draft.segments.map((seg) => {
            if (
                seg.busAssigned === true &&
                seg.busId != null &&
                seg.startTs != null &&
                seg.endTs != null &&
                seg.endTs > seg.startTs
            ) {
                return {
                    ...seg,
                    isWalking: false,
                    when: `${formatTsLocal(seg.startTs)} – ${formatTsLocal(seg.endTs)}`,
                };
            }
            const busTimes = findBusTimesForSegment(
                seg.fromId || null,
                seg.toId || null
            );
            if (busTimes.boardingTs != null && busTimes.alightingTs != null && busTimes.alightingTs > busTimes.boardingTs) {
                return {
                    ...seg,
                    startTs: busTimes.boardingTs,
                    endTs: busTimes.alightingTs,
                    when: `${formatTsLocal(busTimes.boardingTs)} – ${formatTsLocal(busTimes.alightingTs)}`,
                    isWalking: false,
                    busAssigned: true,
                    busId: busTimes.busId || seg.busId || null,
                };
            }
            const hadRealBusTimes =
                seg.busAssigned === true &&
                seg.busId != null &&
                seg.startTs != null &&
                seg.endTs != null &&
                seg.endTs > seg.startTs;
            if (hadRealBusTimes) {
                return {
                    ...seg,
                    isWalking: false,
                    when: `${formatTsLocal(seg.startTs)} – ${formatTsLocal(seg.endTs)}`,
                };
            }
            return {
                ...seg,
                startTs: null,
                endTs: null,
                when: null,
                busAssigned: false,
                busId: null,
            };
        });
    
        const nonWalkingSegments = draft.segments.filter((s) => s.isWalking !== true);
        const busSegments = nonWalkingSegments.filter((s) => s.busAssigned === true);
    
        const parentIsFullyWalking =
            draft.segments.length > 0 &&
            draft.segments.every((s) => s.isWalking === true);
    
        const savedParentWhen = (() => {
            if (!draft.key) return null;
            const savedRec = (savedTransfersRef.current || []).find((s) => s.key === draft.key);
            if (savedRec && savedRec.when && String(savedRec.when).trim() !== '') {
                return savedRec.when;
            }
            return null;
        })();

        // NOVÉ: Ak má parent už uložený `when` v DB, NIKDY ho neprepisuj.
        // `when` sa nastavuje iba pri generovaní časovej osi a odvtedy je nemenný.
        const parentHasSavedWhen = !!(savedParentWhen && String(savedParentWhen).trim() !== '');
    
        const segStartList = [];
        const segEndList = [];
        draft.segments.forEach((s) => {
            if (s.startTs != null) segStartList.push(s.startTs);
            if (s.endTs != null) {
                segEndList.push(s.endTs);
            } else if (s.isWalking === true && s.startTs != null) {
                segEndList.push(s.startTs + 60 * 1000);
            }
        });
        
        const hasUnassignedSegments = draft.segments.some(
            (s) => s.isWalking !== true && (
                s.startTs == null || s.endTs == null
            )
        );
        
        const savedParentWhenFallback = (() => {
            if (savedParentWhen && String(savedParentWhen).trim() !== '') return savedParentWhen;
            if (originalWhenFromDraft && String(originalWhenFromDraft).trim() !== '') return String(originalWhenFromDraft).trim();
            return null;
        })();
        
        if (busSegments.length > 0 && busSegments.some((s) => s.startTs != null && s.endTs != null) && !hasUnassignedSegments) {
            const busStart = busSegments.map((s) => s.startTs).filter((ts) => ts != null);
            const busEnd = busSegments.map((s) => {
                if (s.endTs != null) return s.endTs;
                if (s.isWalking === true && s.startTs != null) return s.startTs + 60 * 1000;
                return null;
            }).filter((ts) => ts != null);
            if (busStart.length > 0 && busEnd.length > 0) {
                draft.when = `${formatTsLocal(Math.min(...busStart))} – ${formatTsLocal(Math.max(...busEnd))}`;
            } else if (busStart.length > 0) {
                draft.when = formatTsLocal(Math.min(...busStart));
            } else if (busEnd.length > 0) {
                draft.when = formatTsLocal(Math.max(...busEnd));
            } else {
                draft.when = savedParentWhenFallback || '';
            }
        } else if (segStartList.length > 0 && segEndList.length > 0 && !hasUnassignedSegments) {
            draft.when = `${formatTsLocal(Math.min(...segStartList))} – ${formatTsLocal(Math.max(...segEndList))}`;
        } else if (segStartList.length > 0 || segEndList.length > 0) {
            const allStarts = segStartList.filter((ts) => ts != null);
            const allEnds = segEndList.filter((ts) => ts != null);
            if (allStarts.length > 0 && allEnds.length > 0) {
                draft.when = `${formatTsLocal(Math.min(...allStarts))} – ${formatTsLocal(Math.max(...allEnds))}`;
            } else if (allStarts.length > 0) {
                draft.when = formatTsLocal(Math.min(...allStarts));
            } else if (allEnds.length > 0) {
                draft.when = formatTsLocal(Math.max(...allEnds));
            } else {
                draft.when = savedParentWhenFallback || '';
            }
         } else {
            draft.when = savedParentWhenFallback || '';
        }

        // NOVÉ: Ak parent už mal uložený `when`, vráť ho späť – nech sa nemení.
        // `when` sa nastavuje iba pri generovaní časovej osi (rebuildAndLogTimeline).
        if (parentHasSavedWhen) {
            draft.when = savedParentWhen;
        }
    };
    
    const recomputeParentSegments = async (parent) => {
        if (!window.db || !parent) return;
        const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
        const draft = {
            ...parent,
            segments: Array.isArray(parent.segments)
                ? parent.segments.map((s) => ({ ...s }))
                : buildDefaultSegments(parent),
        };
        recomputeParentSegmentsInPlace(draft);

        const payload = {
            category: draft.category,
            teamUid: draft.teamUid,
            teamIndex: draft.teamIndex,
            dayKey: draft.dayKey,
            fromId: draft.fromId || null,
            toId: draft.toId || null,
            when: draft.when,
            segments: draft.segments,
        };
        if (draft.teamName && String(draft.teamName).trim() !== '') {
            payload.teamName = String(draft.teamName).trim();
        }
        if (Array.isArray(draft.intermediateStopIds) && draft.intermediateStopIds.length > 0) {
            payload.intermediateStopIds = draft.intermediateStopIds;
        }
        if (draft.isWalking === true) {
            payload.isWalking = true;
            payload.walkingSetAt = draft.walkingSetAt || Timestamp.fromDate(new Date());
            payload.walkingSetBy = draft.walkingSetBy || (userProfileData && userProfileData.email) || null;
        }

        await setDoc(docRef, { [TRANSPORT_TRANSFERS_FIELD]: { [parent.key]: payload } }, { merge: true });
    };

    const updateParentTransfer = async (parentKey, mutator) => {
        if (!window.db || !parentKey) return;
        const parent = savedTransfersRef.current.find((s) => s.key === parentKey);
        if (!parent) {
            console.warn('[TRANSPORT] updateParentTransfer: parent sa nenašiel', parentKey);
            return;
        }

        const draft = {
            ...parent,
            segments: Array.isArray(parent.segments)
                ? parent.segments.map((s) => ({ ...s }))
                : buildDefaultSegments(parent),
        };

        mutator(draft);
        recomputeParentSegmentsInPlace(draft);

        const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
        const payload = {
            category: draft.category,
            teamUid: draft.teamUid,
            teamIndex: draft.teamIndex,
            dayKey: draft.dayKey,
            fromId: draft.fromId || null,
            toId: draft.toId || null,
            when: draft.when,
            segments: draft.segments,
        };

        if (draft.teamName && String(draft.teamName).trim() !== '') {
            payload.teamName = String(draft.teamName).trim();
        }

        if (Array.isArray(draft.intermediateStopIds) && draft.intermediateStopIds.length > 0) {
            payload.intermediateStopIds = draft.intermediateStopIds;
        } else {
        }

        if (draft.isWalking === true) {
            payload.when = (draft.when && String(draft.when).trim() !== '')
                ? draft.when
                : (parent.when && String(parent.when).trim() !== '' ? parent.when : '');
            payload.segments = (draft.segments || []).map((s) => ({
                ...s,
                startTs: null,
                endTs: null,
                when: null,
                busAssigned: false,
            }));
            payload.isWalking = true;
            payload.walkingSetAt = draft.walkingSetAt || Timestamp.fromDate(new Date());
            payload.walkingSetBy = draft.walkingSetBy || (userProfileData && userProfileData.email) || null;
        } else {
            payload.isWalking = deleteField();
            payload.walkingSetAt = deleteField();
            payload.walkingSetBy = deleteField();
        }

        await setDoc(docRef, { [TRANSPORT_TRANSFERS_FIELD]: { [parentKey]: payload } }, { merge: true });
    };

    const setTransferAsWalking = async (transfer) => {
        if (!window.db || !transfer) return;
        try {
            const parentKey = transfer._parentKey || transfer.key;
            const parent = savedTransfersRef.current.find((s) => s.key === parentKey);
            if (!parent) {
                window.showGlobalNotification('Parent presun sa nenašiel.', 'error');
                return;
            }
            
            await updateParentTransfer(parentKey, (draft) => {
                const segIdx = transfer._parentKey
                    ? findSegmentIndex(draft.segments, transfer.fromId, transfer.toId)
                    : -1;
                if (segIdx !== -1) {
                    draft.segments[segIdx].isWalking = true;
                    draft.segments[segIdx].busAssigned = false;
                    draft.segments[segIdx].busId = null;
                    draft.segments[segIdx].boardingRowId = null;
                    draft.segments[segIdx].alightingRowId = null;
                    draft.segments[segIdx].startTs = null;
                    draft.segments[segIdx].endTs = null;
                    draft.segments[segIdx].when = null;
                    draft.segments[segIdx].walkingSetAt = Timestamp.fromDate(new Date());
                    draft.segments[segIdx].walkingSetBy = (userProfileData && userProfileData.email) || null;
                } else {
                    draft.segments.forEach((s) => {
                        s.isWalking = true;
                        s.busAssigned = false;
                        s.busId = null;
                        s.boardingRowId = null;
                        s.alightingRowId = null;
                        s.startTs = null;
                        s.endTs = null;
                        s.when = null;
                        s.walkingSetAt = Timestamp.fromDate(new Date());
                        s.walkingSetBy = (userProfileData && userProfileData.email) || null;
                    });
                    if (draft.when && String(draft.when).trim() !== '') {
                    } else if (parent.when && String(parent.when).trim() !== '') {
                        draft.when = parent.when;
                    }
                    draft.isWalking = true;
                    draft.walkingSetAt = Timestamp.fromDate(new Date());
                    draft.walkingSetBy = (userProfileData && userProfileData.email) || null;
                }
            });

            await updateParentTransfer(parentKey, (draft) => {
                const segIdx = transfer._parentKey
                    ? findSegmentIndex(draft.segments, transfer.fromId, transfer.toId)
                    : -1;
                if (segIdx !== -1) {
                    draft.segments[segIdx].isWalking = true;
                    draft.segments[segIdx].busAssigned = false;
                    draft.segments[segIdx].walkingSetAt = Timestamp.fromDate(new Date());
                    draft.segments[segIdx].walkingSetBy = (userProfileData && userProfileData.email) || null;
                } else {
                    draft.segments.forEach((s) => {
                        s.isWalking = true;
                        s.busAssigned = false;
                        s.walkingSetAt = Timestamp.fromDate(new Date());
                        s.walkingSetBy = (userProfileData && userProfileData.email) || null;
                    });
                    if (draft.when && String(draft.when).trim() !== '') {
                    } else if (parent.when && String(parent.when).trim() !== '') {
                        draft.when = parent.when;
                    }
                    draft.isWalking = true;
                    draft.walkingSetAt = Timestamp.fromDate(new Date());
                    draft.walkingSetBy = (userProfileData && userProfileData.email) || null;
                }
            });

            window.showGlobalNotification('Presun bol označený ako „peši".', 'success');
            setTransferActionModal(null);
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri označení presunu ako peši:', err);
            window.showGlobalNotification('Nepodarilo sa označiť presun ako peši.', 'error');
        }
    };

    const removeWalkingFlag = async () => {
        if (!window.db || !removeWalkingModal?.transfer) return;
        const transfer = removeWalkingModal.transfer;
        setRemoveWalkingSaving(true);
        try {
            const parentKey = transfer._parentKey || transfer.key;
            const parentRec = savedTransfersRef.current.find((s) => s.key === parentKey);
            const originalParentWhen = parentRec && parentRec.when && String(parentRec.when).trim() !== ''
                ? parentRec.when
                : null;
    
            await updateParentTransfer(parentKey, (draft) => {
                const segIdx = transfer._parentKey
                    ? findSegmentIndex(draft.segments, transfer.fromId, transfer.toId)
                    : -1;
                if (segIdx !== -1) {
                    const seg = draft.segments[segIdx];
                    seg.isWalking = false;
                    seg.walkingSetAt = null;
                    seg.walkingSetBy = null;
                    seg.busId = null;
                    seg.boardingRowId = null;
                    seg.alightingRowId = null;
    
                    if (seg.startTs == null) {
                        for (let i = segIdx - 1; i >= 0; i--) {
                            const prev = draft.segments[i];
                            if (!prev) continue;
                            if (prev.endTs != null) { seg.startTs = prev.endTs; break; }
                            if (prev.startTs != null) { seg.startTs = prev.startTs; break; }
                        }
                    }
                    if (seg.endTs == null) {
                        let nextStart = null;
                        for (let i = segIdx + 1; i < draft.segments.length; i++) {
                            const next = draft.segments[i];
                            if (!next) continue;
                            if (next.startTs != null) { nextStart = next.startTs; break; }
                            if (next.endTs != null) { nextStart = next.endTs; break; }
                        }
                        if (nextStart != null && seg.startTs != null && nextStart > seg.startTs) {
                            seg.endTs = nextStart;
                        } else if (seg.startTs != null) {
                            const parentRange = parseTransferWhenToRange(draft.when);
                            if (parentRange && parentRange.endTs != null && parentRange.endTs > seg.startTs) {
                                seg.endTs = parentRange.endTs;
                            } else {
                                seg.endTs = seg.startTs + 60 * 1000;
                            }
                        }
                    }
                    if (seg.startTs != null && seg.endTs != null) {
                        seg.when = `${formatTsLocal(seg.startTs)} – ${formatTsLocal(seg.endTs)}`;
                    }
                } else {
                    draft.segments.forEach((s) => {
                        s.isWalking = false;
                        s.walkingSetAt = null;
                        s.walkingSetBy = null;
                        s.busId = null;
                        s.boardingRowId = null;
                        s.alightingRowId = null;
                    });
                    draft.isWalking = false;
                    draft.walkingSetAt = null;
                    draft.walkingSetBy = null;
                }
    
                if (originalParentWhen) {
                    draft.when = originalParentWhen;
                }
            });
            window.showGlobalNotification('Príznak „peši" bol odstránený.', 'success');
            setRemoveWalkingModal(null);
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri odstraňovaní príznaku peši:', err);
            window.showGlobalNotification('Nepodarilo sa odstrániť príznak peši.', 'error');
        } finally {
            setRemoveWalkingSaving(false);
        }
    };

    const assignTransferToBus = async () => {
        if (!window.db || !assignBusTransfer) return;
        const parentKeyForFresh = assignBusTransfer._parentKey || assignBusTransfer.key;
        const freshParent = savedTransfersRef.current.find((s) => s.key === parentKeyForFresh);

        const transfer = (() => {
            if (!freshParent) return assignBusTransfer;
            if (assignBusTransfer._parentKey) {
                const segIdx = findSegmentIndex(
                    freshParent.segments || [],
                    assignBusTransfer.fromId,
                    assignBusTransfer.toId
                );
                const seg = segIdx !== -1 ? freshParent.segments[segIdx] : null;
                return {
                    ...assignBusTransfer,
                    segments: freshParent.segments,
                    isWalking: seg ? seg.isWalking === true : false,
                };
            }
            return {
                ...assignBusTransfer,
                segments: freshParent.segments,
            };
        })();

        if (!assignBusSelectedKey) {
            window.showGlobalNotification('Vyberte autobus/riadok.', 'error');
            return;
        }

        const [busId, boardingRowId, alightingRowId, side] = assignBusSelectedKey.split('|');

        const teamKey = `${transfer.teamName}|${transfer.category || ''}`;

        const trFromId = transfer.fromId || null;
        const trToId = transfer.toId || null;
        const trDayKey = transfer.dayKey || null;

        const busRowsKey = `${busId}|${trDayKey}`;
        const rows = busRows[busRowsKey] || [];

        let boardingRow = null;
        let alightingRow = null;

        if (boardingRowId) {
            boardingRow = rows.find((r) => r.id === boardingRowId) || null;
        }
        if (alightingRowId) {
            alightingRow = rows.find((r) => r.id === alightingRowId) || null;
        }

        if (!boardingRow || !alightingRow) {
            rows.forEach((row) => {
                const rowFromId = row.placeFromId || null;
                const rowToId = row.placeToId || null;
                if (!boardingRow && rowFromId && rowFromId === trFromId) boardingRow = row;
                if (!alightingRow && rowToId && rowToId === trToId) alightingRow = row;
            });
        }

        setAssignBusSaving(true);
        try {
            const computeSegmentTimesFromRows = () => {
                let startTs = null;
                let endTs = null;
        
                if (boardingRow && boardingRow.timeFrom) {
                    startTs = timeOnDayKeyToTs(trDayKey, boardingRow.timeFrom);
                }
                if (alightingRow && alightingRow.timeTo) {
                    endTs = timeOnDayKeyToTs(trDayKey, alightingRow.timeTo);
                }
        
                if (startTs != null && endTs == null) {
                    const mins = getTravelMinutes(trFromId, trToId);
                    if (mins != null) endTs = startTs + mins * 60000;
                }
                if (endTs != null && startTs == null) {
                    const mins = getTravelMinutes(trFromId, trToId);
                    if (mins != null) startTs = endTs - mins * 60000;
                }
        
                return { startTs, endTs };
            };
        
            const segTimes = computeSegmentTimesFromRows();
        
            const parentKey = transfer._parentKey || transfer.key;
            await updateParentTransfer(parentKey, (draft) => {
                const segIdx = findSegmentIndex(draft.segments, transfer.fromId, transfer.toId);
                if (segIdx !== -1) {
                    draft.segments[segIdx].busAssigned = true;
                    draft.segments[segIdx].isWalking = false;
                    draft.segments[segIdx].busId = busId || null;
                    draft.segments[segIdx].boardingRowId = boardingRow?.rowId || null;
                    draft.segments[segIdx].alightingRowId = alightingRow?.rowId || null;
        
                    if (segTimes.startTs != null && segTimes.endTs != null) {
                        draft.segments[segIdx].startTs = segTimes.startTs;
                        draft.segments[segIdx].endTs = segTimes.endTs;
                        draft.segments[segIdx].when = `${formatTsLocal(segTimes.startTs)} – ${formatTsLocal(segTimes.endTs)}`;
                    } else if (segTimes.startTs != null) {
                        draft.segments[segIdx].startTs = segTimes.startTs;
                        draft.segments[segIdx].endTs = null;
                        draft.segments[segIdx].when = formatTsLocal(segTimes.startTs);
                    } else if (segTimes.endTs != null) {
                        draft.segments[segIdx].startTs = null;
                        draft.segments[segIdx].endTs = segTimes.endTs;
                        draft.segments[segIdx].when = formatTsLocal(segTimes.endTs);
                    }
                }
            });

            const parent = savedTransfersRef.current.find((s) => s.key === parentKey);
            if (parent) {
                await recomputeParentSegments(parent);
            }

            const parts = [];
            if (boardingRow) parts.push('nástup');
            if (alightingRow) parts.push('výstup');
            if (parts.length === 0) parts.push(side === 'in' ? 'nástup' : 'výstup');

            window.showGlobalNotification(
                `Tím "${transfer.teamName}" bol priradený (${parts.join(' + ')}).`,
                'success'
            );

            setShowAssignBusModal(false);
            setTransferActionModal(null);
            setAssignBusTransfer(null);
            setAssignBusMatches([]);
            setAssignBusSelectedKey('');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri priraďovaní presunu k autobusu:', err);
            window.showGlobalNotification('Nepodarilo sa priradiť presun k autobusu.', 'error');
        } finally {
            setAssignBusSaving(false);
        }
    };

    const saveTravelTime = async (fromStop, toStop, rawValue) => {
        console.log('[TRANSPORT][saveTravelTime] Volané:', {
            fromStop: fromStop?.name,
            fromId: fromStop?.id,
            toStop: toStop?.name,
            toId: toStop?.id,
            rawValue,
        });
        if (!window.db || !fromStop || !toStop) return;
    
        const key = `${fromStop.id}|${toStop.id}`;
        const rawStr = rawValue == null ? '' : String(rawValue).trim();
        const minutes = rawStr === '' ? null : parseInt(rawStr, 10);
    
        if (minutes != null && (isNaN(minutes) || minutes < 0)) {
            window.showGlobalNotification('Trvanie musí byť nezáporné číslo (minúty).', 'error');
            return;
        }
    
        setTravelTimesSaving(true);
        try {
            const docRef = doc(window.db, 'settings', 'transportTravelTimes');
    
            if (minutes == null) {
                await setDoc(docRef, {
                    times: { [key]: deleteField() },
                }, { merge: true });
    
                window.showGlobalNotification(
                    `Trvanie ${fromStop.name} → ${toStop.name} bolo odstránené.`,
                    'success'
                );
            } else {
                await setDoc(docRef, {
                    times: {
                        [key]: {
                            fromId: fromStop.id,
                            toId: toStop.id,
                            minutes,
                        },
                    },
                }, { merge: true });
    
                window.showGlobalNotification(
                    `Trvanie ${fromStop.name} → ${toStop.name} = ${minutes} min.`,
                    'success'
                );
            }
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri ukladaní trvania jazdy:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť trvanie.', 'error');
        } finally {
            setTravelTimesSaving(false);
        }
    };

    const saveTeamShortcut = async (category, teamName, newShortcutRaw) => {
        if (!window.db) return;
        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();
        if (!cat || !name) return;    
        const teamIds = findTeamIdentifiersByName(cat, name);
        if (!teamIds || teamIds.teamUid == null || teamIds.teamIndex == null) {
            window.showGlobalNotification(
                `Tím "${name}" sa nenašiel v kolekcii users – skratku nie je možné uložiť.`,
                'error'
            );
            return;
        }    
        const docKey = `${cat}||${teamIds.teamUid}||${teamIds.teamIndex}`;    
        const newShortcut = String(newShortcutRaw || '')
            .trim()
            .toLocaleUpperCase('sk-SK');    
        setShortcutSaving(true);
        try {
            const transportRef = collection(window.db, 'transport');
            const snap = await getDocs(transportRef);    
            let existingDocId = null;
            let conflictingTeamUid = null;
            let conflictingTeamIndex = null;    
            snap.forEach((docSnap) => {
                const data = docSnap.data() || {};
                if (data.type !== 'teamShortcut') return;
                if (cleanCategory(data.category) !== cat) return;    
                const docTeamUid = data.teamUid || null;
                const docTeamIndex = data.teamIndex ?? null;
                const docShortcut = String(data.shortcut || '').trim().toLocaleUpperCase('sk-SK');    
                if (docTeamUid === teamIds.teamUid && docTeamIndex === teamIds.teamIndex) {
                    existingDocId = docSnap.id;
                    return;
                }    
                if (newShortcut && docShortcut && docShortcut === newShortcut) {
                    conflictingTeamUid = docTeamUid;
                    conflictingTeamIndex = docTeamIndex;
                }
            });    
            if (newShortcut && conflictingTeamUid != null) {
                const conflictInfo = (teamsLookupRef.current || {})[
                    `${conflictingTeamUid}|${cat}|${conflictingTeamIndex}`
                ];
                const conflictName = conflictInfo?.teamName || '(neznámy tím)';
                window.showGlobalNotification(
                    `Skratka "${newShortcut}" je už použitá pre tím "${conflictName}" v kategórii "${cat}". Zvoľte inú skratku.`,
                    'error'
                );
                return;
            }    
            if (!newShortcut) {
                if (existingDocId) {
                    await deleteDoc(doc(window.db, 'transport', existingDocId));
                    window.showGlobalNotification(`Skratka pre tím ${name} bola odstránená.`, 'info');
                }
            } else {
                if (existingDocId) {
                    await updateDoc(doc(window.db, 'transport', existingDocId), {
                        shortcut: newShortcut,
                        teamName: deleteField(),
                        docKey: docKey,
                    });
                } else {
                    await setDoc(doc(transportRef, docKey), {
                        type: 'teamShortcut',
                        docKey,
                        category: cat,
                        teamUid: teamIds.teamUid,
                        teamIndex: teamIds.teamIndex,
                        shortcut: newShortcut,
                        createdAt: Timestamp.fromDate(new Date()),
                        createdBy: (userProfileData && userProfileData.email) || null,
                    });
                }
                window.showGlobalNotification(`Skratka pre tím ${name} bola uložená: ${newShortcut}.`, 'success');
            }
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri ukladaní skratky tímu:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť skratku tímu.', 'error');
        } finally {
            setShortcutSaving(false);
        }
    };

    const deleteTeamShortcut = async (category, teamName) => {
        if (!window.db) return;
        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();
        if (!cat || !name) return;    
        const teamIds = findTeamIdentifiersByName(cat, name);
        if (!teamIds || teamIds.teamUid == null || teamIds.teamIndex == null) {
            window.showGlobalNotification(
                `Tím "${name}" sa nenašiel v kolekcii users.`,
                'info'
            );
            setDeleteShortcutModal(null);
            return;
        }    
        const docKey = `${cat}||${teamIds.teamUid}||${teamIds.teamIndex}`;    
        setDeleteShortcutSaving(true);
        try {
            const directDocRef = doc(window.db, 'transport', docKey);
            const directSnap = await getDoc(directDocRef);
    
            let existingDocId = null;
    
            if (directSnap.exists()) {
                const data = directSnap.data() || {};
                if (data.type === 'teamShortcut') {
                    existingDocId = directSnap.id;
                }
            }    
            if (!existingDocId) {
                const transportRef = collection(window.db, 'transport');
                const snap = await getDocs(transportRef);
                snap.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    if (data.type !== 'teamShortcut') return;
                    if (cleanCategory(data.category) !== cat) return;
                    if (data.teamUid !== teamIds.teamUid) return;
                    if ((data.teamIndex ?? null) !== teamIds.teamIndex) return;
                    existingDocId = docSnap.id;
                });
            }    
            if (!existingDocId) {
                window.showGlobalNotification(
                    `Skratka pre tím ${name} sa nenašla.`,
                    'info'
                );
                setDeleteShortcutModal(null);
                return;
            }    
            await deleteDoc(doc(window.db, 'transport', existingDocId));
            window.showGlobalNotification(
                `Skratka pre tím ${name} bola odstránená.`,
                'success'
            );
            setDeleteShortcutModal(null);
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri mazaní skratky tímu:', err);
            window.showGlobalNotification('Nepodarilo sa odstrániť skratku tímu.', 'error');
        } finally {
            setDeleteShortcutSaving(false);
        }
    };
    const askConfirm = (message) => {
        return new Promise((resolve) => {
            setConfirmModal({ message, resolve });
        });
    };
    const closeConfirmModal = (result) => {
        if (confirmModal && typeof confirmModal.resolve === 'function') {
            confirmModal.resolve(result);
        }
        setConfirmModal(null);
    };
    const setExternalArrivalStop = async (placeId) => {
        if (!window.db) return;
        try {
            const batch = writeBatch(window.db);
    
            for (const p of allPlaces) {
                if (p.type !== 'zastavka') continue;
                const shouldBe = p.id === placeId;
                if (p.isExternalArrivalStop !== shouldBe) {
                    batch.update(doc(window.db, 'places', p.id), {
                        isExternalArrivalStop: shouldBe,
                    });
                }
            }
    
            await batch.commit();
            window.showGlobalNotification('Nástupná/výstupná zastávka bola zmenená.', 'success');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri nastavovaní nástupnej zastávky:', err);
            window.showGlobalNotification('Nepodarilo sa zmeniť nástupnú zastávku.', 'error');
        }
    };
    const setMeetingPointStop = async (placeId) => {
        if (!window.db) return;
        try {
            const batch = writeBatch(window.db);
    
            for (const p of allPlaces) {
                if (p.type !== 'zastavka') continue;
                const shouldBe = p.id === placeId;
                if (p.isMeetingPointStop !== shouldBe) {
                    batch.update(doc(window.db, 'places', p.id), {
                        isMeetingPointStop: shouldBe,
                    });
                }
            }    
            await batch.commit();
            window.showGlobalNotification('Miesto zrazu bolo zmenené.', 'success');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri nastavovaní miesta zrazu:', err);
            window.showGlobalNotification('Nepodarilo sa zmeniť miesto zrazu.', 'error');
        }
    };    
    const renderTravelTimes = () => {
        if (stopsList.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-gray-400 italic text-sm px-1' },
                'Žiadne zastávky.'
            );
        }
        if (stopsList.length === 1) {
            return React.createElement(
                'div',
                { className: 'text-gray-500 italic text-sm px-1' },
                'Pre výpočet trvania jázd sú potrebné aspoň 2 zastávky.'
            );
        }
        const getInputValue = (fromId, toId) => {
            const key = `${fromId}|${toId}`;
            return travelTimesDraft[key] != null ? travelTimesDraft[key] : '';
        };

        const handleDraftChange = (fromId, toId, value) => {
            const key = `${fromId}|${toId}`;
            setTravelTimesDraft((prev) => ({ ...prev, [key]: value }));
        };

        const handleBlur = (fromStop, toStop) => {
            const key = `${fromStop.id}|${toStop.id}`;
            const raw = travelTimesDraft[key] != null ? travelTimesDraft[key] : '';
            const existing = travelTimes[key];
            const existingMinutes = existing ? String(existing.minutes) : '';
            console.log('[TRANSPORT][handleBlur]', {
                fromId: fromStop.id,
                fromName: fromStop.name,
                toId: toStop.id,
                toName: toStop.name,
                key,
                raw,
                existingMinutes,
                skip: raw === existingMinutes,
            });
            if (raw === existingMinutes) return;
            saveTravelTime(fromStop, toStop, raw);
        };
        const handleStopHeaderClick = (stop) => {
            setStopTypeModal({ stop });
        };
        const renderStopLabel = (stop) => {
            const isExternal = stop.isExternalArrivalStop === true;
            const isMeeting = stop.isMeetingPointStop === true;
            return React.createElement(
                'span',
                { className: 'inline-flex flex-col items-center gap-1' },
                React.createElement(
                    'span',
                    { className: 'inline-flex items-center' },
                    React.createElement('i', { className: 'fa-solid fa-bus text-blue-600 mr-1' }),
                    stop.name
                ),
                isExternal &&
                    React.createElement(
                        'span',
                        {
                            className:
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300',
                            title: 'Nástupná/výstupná zastávka pre externé tímy'
                        },
                        React.createElement('i', { className: 'fa-solid fa-right-to-bracket' }),
                        'NÁSTUPNÁ/VÝSTUPNÁ'
                    ),
                isMeeting &&
                    React.createElement(
                        'span',
                        {
                            className:
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300',
                            title: 'Miesto zrazu'
                        },
                        React.createElement('i', { className: 'fa-solid fa-people-group' }),
                        'MIESTO ZRAZU'
                    )
            );
        };
        const isMissingTravelTime = (fromStop, toStop) => {
            if (!fromStop?.id || !toStop?.id) return false;
            return missingTravelTimeWarning.some((m) => {
                return m.fromId === fromStop.id && m.toId === toStop.id;
            });
        };
        return React.createElement(
            'div',
            { className: 'w-full overflow-x-auto' },
            React.createElement(
                'p',
                { className: 'text-xs text-gray-500 mb-3 italic' },
                'Hodnota predstavuje počet minút jazdy z riadkovej zastávky (z) do stĺpcovej zastávky (do). Prázdne pole = nezadané. Kliknutím na názov zastávky v hlavičke ju označíte ako nástupnú/výstupnú.'
            ),
            React.createElement(
                'table',
                { className: 'min-w-max border-collapse text-sm' },
                React.createElement(
                    'thead',
                    null,
                    React.createElement(
                        'tr',
                        null,
                        React.createElement(
                            'th',
                            {
                                className: 'border border-gray-300 bg-gray-100 p-0 whitespace-nowrap sticky left-0 z-[1]',
                                style: { width: '90px', minWidth: '90px', height: '48px', position: 'relative' }
                            },
                            React.createElement(
                                'div',
                                {
                                    style: {
                                        position: 'relative',
                                        width: '100%',
                                        height: '100%',
                                        background: `linear-gradient(to bottom left, transparent calc(50% - 1px), #9ca3af calc(50% - 1px), #9ca3af calc(50% + 1px), transparent calc(50% + 1px))`,
                                    }
                                },
                                React.createElement(
                                    'span',
                                    {
                                        style: {
                                            position: 'absolute',
                                            bottom: '4px',
                                            left: '6px',
                                            fontWeight: 'bold',
                                            color: '#374151',
                                            fontSize: '12px',
                                        }
                                    },
                                    'Odkiaľ'
                                ),
                                React.createElement(
                                    'span',
                                    {
                                        style: {
                                            position: 'absolute',
                                            top: '4px',
                                            right: '6px',
                                            fontWeight: 'bold',
                                            color: '#374151',
                                            fontSize: '12px',
                                        }
                                    },
                                    'Kam'
                                )
                            )
                        ),
                        stopsList.map((toStop) =>
                            React.createElement(
                                'th',
                                {
                                    key: `th-${toStop.id}`,
                                    onClick: () => handleStopHeaderClick(toStop),
                                    className: `border border-gray-300 bg-gray-100 px-3 py-2 text-center font-bold text-gray-700 whitespace-nowrap min-w-[110px] ${
                                        toStop.isExternalArrivalStop
                                            ? ''
                                            : 'cursor-pointer hover:bg-gray-200'
                                    }`,
                                    title: toStop.isExternalArrivalStop
                                        ? 'Táto zastávka je nástupná/výstupná'
                                        : 'Kliknutím nastaviť ako nástupnú/výstupnú zastávku'
                                },
                                renderStopLabel(toStop)
                            )
                        )
                    )
                ),
                React.createElement(
                    'tbody',
                    null,
                    stopsList.map((fromStop, rowIdx) =>
                        React.createElement(
                            'tr',
                            {
                                key: `tr-${fromStop.id}`,
                                className: rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            },
                            React.createElement(
                                'th',
                                {
                                    onClick: () => handleStopHeaderClick(fromStop),
                                    className: `border border-gray-300 bg-gray-100 px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap sticky left-0 z-[1] ${
                                        fromStop.isExternalArrivalStop
                                            ? ''
                                            : 'cursor-pointer hover:bg-gray-200'
                                    }`,
                                    title: fromStop.isExternalArrivalStop
                                        ? 'Táto zastávka je nástupná/výstupná'
                                        : 'Kliknutím nastaviť ako nástupnú/výstupnú zastávku'
                                },
                                renderStopLabel(fromStop)
                            ),
                            stopsList.map((toStop) => {
                                const isDiagonal = fromStop.id === toStop.id;
                                if (isDiagonal) {
                                    return React.createElement(
                                        'td',
                                        {
                                            key: `td-${fromStop.id}-${toStop.id}`,
                                            className: 'border border-gray-300 px-2 py-1 text-center text-gray-400 bg-gray-100'
                                        },
                                        ''
                                    );
                                }
                                const value = getInputValue(fromStop.id, toStop.id);
                                const key = `${fromStop.id}|${toStop.id}`;
                                const existing = travelTimes[key];
                                const changed = (value || '') !== (existing ? String(existing.minutes) : '');

                                const missing = isMissingTravelTime(fromStop, toStop);

                                return React.createElement(
                                    'td',
                                    {
                                        key: `td-${fromStop.id}-${toStop.id}`,
                                        className: 'border border-gray-300 px-1 py-1 text-center',
                                        style: missing ? { backgroundColor: '#FECACA' } : undefined,
                                    },
                                    React.createElement('input', {
                                        type: 'number',
                                        min: '0',
                                        step: '1',
                                        value: value,
                                        onChange: (e) => handleDraftChange(fromStop.id, toStop.id, e.target.value),
                                        onBlur: () => handleBlur(fromStop, toStop),
                                        onKeyDown: (e) => { if (e.key === 'Enter') e.target.blur(); },
                                        placeholder: '—',
                                        title: missing ? 'Chýba trvanie jazdy – je potrebné pre výpočet trasy autobusu.' : '',
                                        className: `w-24 px-2 py-1 border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
                                            missing
                                                ? 'border-red-500 bg-red-100'
                                                : changed
                                                    ? 'border-amber-400 bg-amber-50'
                                                    : 'border-gray-300 bg-white'
                                        }`
                                    })
                                );
                            })
                        )
                    )
                )
            ),
            travelTimesSaving && React.createElement(
                'div',
                { className: 'text-xs text-blue-600 mt-2 italic' },
                'Ukladám...'
            )
        );
    };
    const renderTeamShortcuts = () => {
        const categories = (() => {
            const set = new Set();
            (teamsArrivalBufferRef.current || []).forEach((t) => {
                if (t.category && t.isRegistered === true) set.add(cleanCategory(t.category));
            });
            return [...set].sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }));
        })();

        if (categories.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-gray-400 italic text-sm px-1' },
                'Žiadne registrované tímy v users.'
            );
        }

        return React.createElement(
            'div',
            { className: 'space-y-6', style: { maxWidth: '760px' } },
            React.createElement(
                'p',
                { className: 'text-xs text-gray-500 italic' },
                'Pre každý tím môžete nastaviť skratku, ktorá sa zobrazí v stĺpcoch Nástup / Výstup v Plánovaní. Ak skratka nie je nastavená, zobrazí sa plný názov tímu.'
            ),
            categories.map((category) => {
                const teams = (teamsArrivalBufferRef.current || [])
                    .filter((t) => cleanCategory(t.category) === category && t.isRegistered === true)
                    .map((t) => String(t.teamName || '').trim())
                    .filter(Boolean)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }));

                if (teams.length === 0) return null;

                return React.createElement(
                    'div',
                    { key: category, className: 'border border-gray-200 rounded-lg overflow-hidden' },
                    React.createElement(
                        'div',
                        {
                            className: 'px-4 py-2 font-semibold text-gray-800 text-sm flex items-center gap-2',
                            style: {
                                backgroundColor: lightenHex(getTransportColorForCategory(category), 0.15) || '#f3f4f6',
                                borderLeft: `6px solid ${getTransportColorForCategory(category) || '#9ca3af'}`,
                            }
                        },
                        React.createElement('i', { className: 'fa-solid fa-layer-group' }),
                        `Kategória: ${category}`,
                        React.createElement(
                            'span',
                            { className: 'ml-auto text-xs text-gray-500 font-normal' },
                            `${teams.length} tímov`
                        )
                    ),
                    React.createElement(
                        'table',
                        { className: 'w-full border-collapse text-sm' },
                        React.createElement(
                            'thead',
                            null,
                            React.createElement(
                                'tr',
                                { className: 'bg-gray-100 text-xs font-semibold text-gray-700' },
                                React.createElement('th', { className: 'border border-gray-300 px-3 py-2 text-left', style: { width: '200px', maxWidth: '200px' } }, 'Tím'),
                                React.createElement('th', { className: 'border border-gray-300 px-3 py-2 text-left', style: { width: '200px' } }, 'Skratka'),
                                React.createElement('th', { className: 'border border-gray-300 px-3 py-2 text-center', style: { width: '80px' } }, '')
                            )
                        ),
                        React.createElement(
                            'tbody',
                            null,
                            teams.map((teamName) => {
                                const shortcut = getTeamShortcut(category, teamName);
                                return React.createElement(
                                    'tr',
                                    { key: teamName, className: 'hover:bg-gray-50' },
                                    React.createElement(
                                        'td',
                                        {
                                            className: 'border border-gray-300 px-3 py-1 text-gray-800',
                                            style: { width: '200px', maxWidth: '200px' },
                                            title: teamName,
                                        },
                                        React.createElement(
                                            'div',
                                            {
                                                style: {
                                                    maxWidth: '200px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }
                                            },
                                            teamName
                                        )
                                    ),
                                    React.createElement(
                                        'td',
                                        { className: 'border border-gray-300 px-3 py-1' },
                                        shortcut
                                            ? React.createElement(
                                                'span',
                                                {
                                                    className: 'font-semibold',
                                                    style: { color: getCategoryTextColor(category) },
                                                },
                                                shortcut
                                            )
                                            : React.createElement('span', { className: 'text-gray-400 italic' }, '—')
                                    ),
                                    React.createElement(
                                        'td',
                                        { className: 'border border-gray-300 px-3 py-1 text-center' },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center justify-center gap-2' },
                                            React.createElement(
                                                'button',
                                                {
                                                    type: 'button',
                                                    onClick: () => {
                                                        setShortcutConflict(null);
                                                        setShortcutEditModal({
                                                            category,
                                                            teamName,
                                                            shortcut: shortcut || '',
                                                        });
                                                    },
                                                    title: shortcut ? 'Upraviť skratku' : 'Pridať skratku',
                                                    className: 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded w-7 h-7 flex items-center justify-center transition-colors',
                                                },
                                                React.createElement('i', { className: 'fa-solid fa-pen' })
                                            ),
                                            shortcut &&
                                                React.createElement(
                                                    'button',
                                                    {
                                                        type: 'button',
                                                        onClick: () => {
                                                            setDeleteShortcutModal({
                                                                category,
                                                                teamName,
                                                                shortcut,
                                                            });
                                                        },
                                                        title: 'Odstrániť skratku',
                                                        className: 'text-red-600 hover:text-red-800 hover:bg-red-50 rounded w-7 h-7 flex items-center justify-center transition-colors',
                                                    },
                                                    React.createElement('i', { className: 'fa-solid fa-trash' })
                                                )
                                        )
                                    )
                                );
                            })
                        )
                    )
                );
            })
        );
    };
    const getAvailableCategories = () => {
        const set = new Set();

        (teamsArrivalBufferRef.current || []).forEach((t) => {
            if (t.category) set.add(cleanCategory(t.category));
        });
        (matchesBufferRef.current || []).forEach((m) => {
            if (m.category) set.add(cleanCategory(m.category));
        });
        (cateringBufferRef.current || []).forEach((c) => {
            if (c.category) set.add(cleanCategory(c.category));
        });

        return [...set]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }));
    };
    const getTransportColorForCategory = (categoryName) => {
        const map = transportColorsRef.current || {};
        const raw = String(categoryName || '').trim();
        if (!raw) return null;
        if (map[raw]) return map[raw];
        const cleaned = cleanCategory(raw);
        if (map[cleaned]) return map[cleaned];
        const lower = raw.toLowerCase();
        for (const [k, v] of Object.entries(map)) {
            if (k.startsWith('__draw__|')) continue;
            if (k.toLowerCase() === lower) return v;
        }
        return null;
    };
    const getTeamCountsForTransfer = (category, teamName) => {
        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();
        if (!cat || !name) return null;
        return teamCounts[`${cat}|${name}`] || null;
    };
    const getCategoryAverageForTransfer = (category) => {
        const cat = cleanCategory(category);
        if (!cat) return null;
        let total = 0;
        let count = 0;
        Object.entries(teamCounts || {}).forEach(([key, counts]) => {
            const [kCat] = key.split('|');
            if (cleanCategory(kCat) !== cat) return;
            if (!counts) return;
            const sum =
                (counts.players || 0) +
                (counts.menRT || 0) +
                (counts.womenRT || 0) +
                (counts.menDrivers || 0) +
                (counts.womenDrivers || 0);
            total += sum;
            count += 1;
        });
    
        if (count === 0) return null;
        return Math.ceil(total / count);
    };
    const getDrawColorForCategory = (categoryName) => {
        const map = transportColorsRef.current || {};
        const raw = String(categoryName || '').trim();
        if (!raw) return null;
        if (map[`__draw__|${raw}`]) return map[`__draw__|${raw}`];
        const cleaned = cleanCategory(raw);
        if (map[`__draw__|${cleaned}`]) return map[`__draw__|${cleaned}`];
        return null;
    };
    const lightenHex = (hex, ratio = 0.15) => {
        if (!hex) return null;
        let h = String(hex).trim().replace(/^#/, '');
        if (h.length === 3) {
            h = h.split('').map((c) => c + c).join('');
        }
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const mix = (c) => Math.round(c * ratio + 255 * (1 - ratio));
        const toHex = (c) => c.toString(16).padStart(2, '0');
        return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
    };    
    const getCategoryTextColor = (categoryName) => {
        const hex = getTransportColorForCategory(categoryName);
        return hex || '#374151';
    };
    const getTeamShortcut = (category, teamName) => {
        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();
        if (!cat || !name) return null;
        const raw = teamShortcuts[`${cat}|${name}`];
        if (!raw) return null;
        return String(raw).trim().toLocaleUpperCase('sk-SK');
    };
    const getTeamDisplayLabel = (teamKey) => {
        const parts = String(teamKey).split('|');
        const teamName = (parts[0] || '').trim();
        const category = (parts[1] || '').trim();
        const shortcut = getTeamShortcut(category, teamName);
        return shortcut || teamName;
    };
    const renderPlanning = () => {
        const daysToRender = selectedDayKey
            ? tournamentDays.filter((d) => d.dayKey === selectedDayKey)
            : tournamentDays;        
        const filteredBuses = selectedBusId
            ? buses.filter((b) => b.id === selectedBusId)
            : buses;    
        const hasAnythingToRender =
            filteredBuses.length > 0 ||
            savedTransfers.some((t) => t.isWalking === true && (!selectedDayKey || t.dayKey === selectedDayKey));    
        return React.createElement(
            'div',
            { className: 'w-full flex flex-col items-start justify-start py-6 relative min-h-[400px]' },    
            !hasAnythingToRender
                ? React.createElement(
                    'div',
                    { className: 'w-full flex flex-col items-center justify-center py-16 text-gray-500' },
                    React.createElement('i', { className: 'fa-solid fa-bus text-6xl mb-4 opacity-30' }),
                    React.createElement('p', { className: 'text-lg font-medium' }, 'Plánovanie'),
                    React.createElement(
                        'p',
                        { className: 'text-sm mt-1' },
                        'Kliknutím na tlačidlo "+" pridáte prvý autobus.'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: addNewBus,
                            disabled: busSaving,
                            className: `mt-6 w-14 h-14 rounded-full bg-green-600 text-white shadow-xl hover:bg-green-700 active:scale-95 transition-all duration-200 flex items-center justify-center text-2xl font-bold ${busSaving ? 'opacity-60 cursor-not-allowed' : ''}`,
                            title: 'Pridať autobus'
                        },
                        React.createElement('i', {
                            className: busSaving ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-plus'
                        })
                    )
                )
                : React.createElement(
                    'div',
                    { className: 'w-full flex flex-row flex-nowrap gap-6 pb-24 overflow-visible items-start' },                
                    renderSavedTransfers(),    
                    filteredBuses.map((bus) =>
                        React.createElement(
                            'div',
                            {
                                key: bus.id,
                                className: 'bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex-shrink-0',
                                style: { minWidth: '1000px', width: 'max-content' }
                            },
                            React.createElement(
                                'div',
                                {
                                    className: 'relative px-5 py-3 flex items-center justify-center text-gray-900',
                                    style: { backgroundColor: '#39D4F3' }
                                },
                                React.createElement('i', { className: 'fa-solid fa-bus mr-2' }),
                                React.createElement('h3', { className: 'text-lg font-bold text-center' }, bus.name),
                                (() => {
                                    let hasAnyRowWithData = false;
                                    Object.entries(busRows || {}).forEach(([key, rows]) => {
                                        if (hasAnyRowWithData) return;
                                        const [bId] = key.split('|');
                                        if (bId !== bus.id) return;
                                        if ((rows || []).length > 0) {
                                            hasAnyRowWithData = true;
                                        }
                                    });                            
                                    const isDisabled = hasAnyRowWithData;                            
                                    return React.createElement(
                                        'button',
                                        {
                                            type: 'button',
                                            onClick: isDisabled ? undefined : () => removeBus(bus),
                                            disabled: isDisabled,
                                            className: isDisabled
                                                ? 'absolute right-3 rounded-full w-8 h-8 flex items-center justify-center transition-colors cursor-not-allowed border-2 border-red-600 bg-white'
                                                : 'absolute right-3 rounded-full w-8 h-8 flex items-center justify-center transition-colors bg-red-600 text-white hover:bg-red-700',
                                            title: isDisabled
                                                ? 'Najprv odstráňte všetky riadky s časmi a miestami v tomto autobuse'
                                                : 'Odstrániť autobus',
                                            style: isDisabled ? { color: '#dc2626' } : undefined,
                                        },
                                        React.createElement('i', { className: 'fa-solid fa-trash' })
                                    );
                                })()
                            ),
                            tournamentDays.length === 0
                                ? React.createElement(
                                    'p',
                                    { className: 'text-center text-gray-500 py-6 text-sm italic' },
                                    tournamentDaysLoaded
                                        ? 'Žiadne dátumy turnaja (skontrolujte nastavenie registrácie).'
                                        : 'Načítavam dátumy turnaja...'
                                )
                                : daysToRender.length === 0
                                    ? React.createElement(
                                        'p',
                                        { className: 'text-center text-gray-500 py-6 text-sm italic' },
                                        'Pre zvolený deň nie sú žiadne dátumy.'
                                    )
                                    : React.createElement(
                                        'table',
                                        { className: 'w-full border-collapse text-sm' },
                                        React.createElement(
                                            'tbody',
                                            null,
                                            daysToRender.map((day, idx) =>
                                                React.createElement(
                                                    React.Fragment,
                                                    { key: day.dayKey },
                                                    React.createElement(
                                                        'tr',
                                                        { className: idx % 2 === 0 ? 'bg-white' : 'bg-gray-50' },
                                                        React.createElement(
                                                            'td',
                                                            { className: 'border border-gray-200 px-4 py-2 text-gray-800 text-center text-sm' },
                                                            React.createElement('span', { className: 'font-semibold capitalize' }, day.dayName),
                                                            React.createElement('span', { className: 'text-gray-500 mx-2' }, '–'),
                                                            React.createElement('span', null, day.dateLabel)
                                                        )
                                                    ),                                            
                                                    (() => {
                                                        const key = `${bus.id}|${day.dayKey}`;
                                                        const rows = (busRows[key] || []);
                                                        if (rows.length === 0) return null;
                                                        const sortedRows = [...rows].sort(
                                                            (a, b) => (a.order || 0) - (b.order || 0)
                                                        );
                                                        const rowElements = [];
                                                        sortedRows.forEach((r, idx) => {
                                                            if (idx > 0) {
                                                                const prev = sortedRows[idx - 1];
                                                                const rawGap = getGapMinutes(prev.timeTo, r.timeFrom);
                                                                if (rawGap != null && rawGap > 2) {
                                                                    const prevRow = prev;
                                                                    const nextRow = r;
                                                                    const gapRowKey = `gap-${prevRow.id}-${nextRow.id}`;                                                                
                                                                    const timeReLocal = /^\d{1,2}:\d{2}$/;
                                                                    let isInverted = false;
                                                                    let gap = rawGap;                                                                
                                                                    if (timeReLocal.test(prevRow.timeTo || '') && timeReLocal.test(nextRow.timeFrom || '')) {
                                                                        const [fh, fm] = prevRow.timeTo.split(':').map(Number);
                                                                        const [th, tm] = nextRow.timeFrom.split(':').map(Number);
                                                                        const fromMin = fh * 60 + fm;
                                                                        const toMin = th * 60 + tm;
                                                                        if (fromMin > toMin) {
                                                                            isInverted = true;
                                                                            gap = fromMin - toMin;
                                                                        }
                                                                    }                                                                                                                        
                                                                    const timeRe = /^\d{1,2}:\d{2}$/;
                                                                    const sameFromTo =
                                                                        normalizePlaceName(prevRow.placeTo) !== '' &&
                                                                        normalizePlaceName(prevRow.placeTo) === normalizePlaceName(nextRow.placeFrom);                                                        
                                                                    let isInvertedGap = false;
                                                                    if (
                                                                        sameFromTo &&
                                                                        prevRow.timeTo && nextRow.timeFrom &&
                                                                        timeRe.test(prevRow.timeTo) && timeRe.test(nextRow.timeFrom)
                                                                    ) {
                                                                        const [fh, fm] = prevRow.timeTo.split(':').map(Number);
                                                                        const [th, tm] = nextRow.timeFrom.split(':').map(Number);
                                                                        if (fh * 60 + fm > th * 60 + tm) {
                                                                            isInvertedGap = true;
                                                                        }
                                                                    }                                                        
                                                                    rowElements.push(
                                                                        React.createElement(
                                                                            'tr',
                                                                            {
                                                                                key: gapRowKey,
                                                                                className: 'group gap-row',
                                                                                style: { backgroundColor: '#FC9A9C' }
                                                                            },
                                                                            React.createElement(
                                                                                'td',
                                                                                { className: 'border border-gray-300 px-2 py-1 text-center text-sm font-semibold text-gray-800' },
                                                                                prevRow.timeTo || '—'
                                                                            ),
                                                                            React.createElement(
                                                                                'td',
                                                                                { className: 'border border-gray-300 px-2 py-1 text-center text-sm font-semibold text-gray-800' },
                                                                                nextRow.timeFrom || '—'
                                                                            ),
                                                                            (() => {
                                                                                const placeFromNorm = normalizePlaceName(prevRow.placeTo || '');
                                                                                const placeToNorm = normalizePlaceName(nextRow.placeFrom || '');
                                                                                const samePlace = placeFromNorm !== '' && placeFromNorm === placeToNorm;
                                                                            
                                                                                if (samePlace) {
                                                                                    return React.createElement(
                                                                                        'td',
                                                                                        {
                                                                                            colSpan: 2,
                                                                                            className: 'border border-gray-300 px-2 py-1 text-sm text-gray-800 font-semibold text-center',
                                                                                            title: 'Miesto od a miesto do sú rovnaké',
                                                                                        },
                                                                                        prevRow.placeTo || nextRow.placeFrom || '—'
                                                                                    );
                                                                                }
                                                                            
                                                                                return [
                                                                                    React.createElement(
                                                                                        'td',
                                                                                        { key: 'gap-from', className: 'border border-gray-300 px-2 py-1 text-sm text-gray-800 font-medium' },
                                                                                        prevRow.placeTo || '—'
                                                                                    ),
                                                                                    React.createElement(
                                                                                        'td',
                                                                                        { key: 'gap-to', className: 'border border-gray-300 px-2 py-1 text-sm text-gray-800 font-medium' },
                                                                                        nextRow.placeFrom || '—'
                                                                                    ),
                                                                                ];
                                                                            })(),
                                                                            React.createElement('td', { className: 'border border-gray-300 px-2 py-1' }, ''),
                                                                            React.createElement('td', { className: 'border border-gray-300 px-2 py-1' }, ''),
                                                                            React.createElement('td', { className: 'border border-gray-300 px-2 py-1' }, ''),
                                                                            React.createElement(
                                                                                'td',
                                                                                {
                                                                                    className: 'border border-gray-300 px-2 py-1 text-center text-sm font-semibold',
                                                                                    style: { color: '#7f1d1d' },
                                                                                    title: 'Voľný čas (prestoj)'
                                                                                },
                                                                                (() => {
                                                                                    const fromOk = prevRow.timeTo && timeRe.test(prevRow.timeTo);
                                                                                    const toOk = nextRow.timeFrom && timeRe.test(nextRow.timeFrom);
                                                                                    if (!fromOk || !toOk) return '—';
                                                        
                                                                                    const [fh, fm] = prevRow.timeTo.split(':').map(Number);
                                                                                    const [th, tm] = nextRow.timeFrom.split(':').map(Number);
                                                                                    const fromMin = fh * 60 + fm;
                                                                                    const toMin = th * 60 + tm;
                                                        
                                                                                    if (fromMin > toMin) return 'chyba';
                                                                                    return gap;
                                                                                })()
                                                                            ),
                                                                            React.createElement(
                                                                                'td',
                                                                                { className: 'border border-gray-300 px-2 py-1 text-center relative' },
                                                                                isInvertedGap &&
                                                                                    React.createElement(
                                                                                        'button',
                                                                                        {
                                                                                            type: 'button',
                                                                                            onClick: async () => {
                                                                                                const ok = await askConfirm(
                                                                                                    `Posunúť všetky nasledujúce riadky (až po prvý ďalší červený riadok) o ${gap + 2} minút?`
                                                                                                );
                                                                                                if (!ok) return;
                                                                                                await shiftFollowingRowsAfterInvertedGap(
                                                                                                    bus.id,
                                                                                                    day.dayKey,
                                                                                                    prevRow.id,
                                                                                                    nextRow.id
                                                                                                );
                                                                                            },
                                                                                            className:
                                                                                                'w-7 h-7 rounded-full bg-red-700 text-white shadow hover:bg-red-800 active:scale-95 transition-all duration-150 flex items-center justify-center mx-auto mr-1',
                                                                                            title: `Posunúť nasledujúce riadky o ${gap + 2} min (medzera ${gap} + 2)`
                                                                                        },
                                                                                        React.createElement('i', { className: 'fa-solid fa-arrows-down-to-line text-[10px]' })
                                                                                    ),
                                                                                React.createElement(
                                                                                    'button',
                                                                                    {
                                                                                        type: 'button',
                                                                                        onClick: () => insertBusRowBetween(bus, day.dayKey, prevRow, nextRow),
                                                                                        className:
                                                                                            'w-7 h-7 rounded-full bg-green-600 text-white shadow hover:bg-green-700 active:scale-95 transition-all duration-150 flex items-center justify-center mx-auto ' +
                                                                                            'opacity-0 group-hover:opacity-100 focus:opacity-100',
                                                                                    },
                                                                                    React.createElement('i', { className: 'fa-solid fa-plus text-xs' })
                                                                                )
                                                                            )
                                                                        )
                                                                    );
                                                                }
                                                            }                                                        
                                                            rowElements.push(renderBusRow(r, bus.id, day.dayKey));
                                                            });                                                            
                                                            if (rowElements.length > 0) {
                                                                rowElements.push(
                                                                    React.createElement(
                                                                        'tr',
                                                                        { key: 'bus-bottom-spacer' },
                                                                        React.createElement(
                                                                            'td',
                                                                            {
                                                                                colSpan: 9,
                                                                                style: {
                                                                                    height: '20px',
                                                                                    padding: 0,
                                                                                    border: 'none',
                                                                                    background: 'transparent',
                                                                                },
                                                                            }
                                                                        )
                                                                    )
                                                                );
                                                            }

                                                            return React.createElement(
                                                                'tr',
                                                                null,
                                                                React.createElement(
                                                                    'td',
                                                                    { colSpan: 1, className: 'border border-gray-200 p-0' },
                                                                    React.createElement(
                                                                        'table',
                                                                        { className: 'w-full border-collapse text-xs', style: { tableLayout: 'auto', minWidth: '100%' } },
                                                                        renderBusRowsHeader(),
                                                                        React.createElement('tbody', null, rowElements)
                                                                    )
                                                                )
                                                            );
                                                    })(),
                                                    (() => {
                                                        const rowsKey = `${bus.id}|${day.dayKey}`;
                                                        const existingRows = busRows[rowsKey] || [];
                                                        if (existingRows.length > 0) return null;
                                                    
                                                        return React.createElement(
                                                            'tr',
                                                            { className: idx % 2 === 0 ? 'bg-white' : 'bg-gray-50' },
                                                            React.createElement(
                                                                'td',
                                                                { className: 'border border-gray-200 px-4 py-2 text-center' },
                                                                React.createElement(
                                                                    'button',
                                                                    {
                                                                        type: 'button',
                                                                        onClick: () => addBusRow(bus, day.dayKey),
                                                                        className: 'w-9 h-9 rounded-full bg-green-600 text-white shadow hover:bg-green-700 active:scale-95 transition-all duration-150 flex items-center justify-center text-lg font-bold mx-auto',
                                                                        title: `Pridať prvý riadok pre deň ${day.dateLabel}`
                                                                    },
                                                                    React.createElement('i', { className: 'fa-solid fa-plus' })
                                                                )
                                                            )
                                                        );
                                                    })()
                                                )
                                            )
                                        )
                                    )
                        )
                    ),    
                    renderWalkingTransfersBox(),                
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: addNewBus,
                            disabled: busSaving,
                            className: `flex-shrink-0 mt-4 w-14 h-14 rounded-full bg-green-600 text-white shadow-md hover:bg-green-700 active:scale-95 transition-all duration-200 flex items-center justify-center text-2xl font-bold ${busSaving ? 'opacity-60 cursor-not-allowed' : ''}`,
                            title: 'Pridať ďalší autobus'
                        },
                        React.createElement('i', {
                            className: busSaving ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-plus'
                        })
                    )
                )
        );
    };
    const renderSavedTransfers = () => {
        if (!travelTimesLoaded) {
            return React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex-shrink-0',
                    style: { width: '420px', maxWidth: '100%' }
                },
                React.createElement(
                    'div',
                    {
                        className: 'relative px-5 py-3 flex items-center justify-center text-white',
                        style: { backgroundColor: '#7c3aed' }
                    },
                    React.createElement('i', { className: 'fa-solid fa-bus mr-2' }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-bold text-center' },
                        'Vygenerované presuny'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-center text-gray-500 py-6 text-sm italic px-3' },
                    'Načítavam presuny...'
                )
            );
        }
        const filteredByDay = savedTransfers.filter((t) => {
            if (selectedDayKey && t.dayKey !== selectedDayKey) return false;
            if (selectedCategoryFilter && cleanCategory(t.category || '') !== cleanCategory(selectedCategoryFilter)) return false;
            return true;
        });
        const parseWhenRangeFull = (when) => {
            if (!when) return null;
            const s = String(when);
            const regex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
            const found = [];
            let m;
            while ((m = regex.exec(s)) !== null) {
                const d = String(m[1]).padStart(2, '0');
                const mo = String(m[2]).padStart(2, '0');
                const y = m[3];
                const hh = m[4] != null ? String(m[4]).padStart(2, '0') : null;
                const mi = m[5] != null ? String(m[5]).padStart(2, '0') : null;
                found.push({
                    dayKey: `${y}-${mo}-${d}`,
                    label: `${d}. ${mo}. ${y}`,
                    time: (hh != null && mi != null) ? `${hh}:${mi}` : null,
                });
            }
            if (found.length === 0) return null;
            if (found.length === 1) {
                return {
                    startDayKey: found[0].dayKey,
                    endDayKey: found[0].dayKey,
                    startLabel: found[0].label,
                    endLabel: found[0].label,
                    startTime: found[0].time,
                    endTime: found[0].time,
                };
            }
            return {
                startDayKey: found[0].dayKey,
                endDayKey: found[1].dayKey,
                startLabel: found[0].label,
                endLabel: found[1].label,
                startTime: found[0].time,
                endTime: found[1].time,
            };
        };    
        const parseTransferText = (text) => {
            if (!text) return null;
            const s = String(text).trim();
            const m = /^Presun z (.+?) do (.+)$/.exec(s);
            if (!m) return null;    
            const normalizePlace = (str) => String(str)
                .replace(/\bubytovania\b/gi, 'ubytovňa')
                .replace(/\bubytovanie\b/gi, 'ubytovňa')
                .replace(/\bzastávky\b/gi, 'zastávka')
                .replace(/\bzastávok\b/gi, 'zastávka')
                .replace(/\bmiesta zrazu\b/gi, 'miesto zrazu')
                .replace(/\bmiesto zrazu\b/gi, 'miesto zrazu');    
            return {
                from: normalizePlace(m[1].trim()),
                to: normalizePlace(m[2].trim()),
            };
        };        
        const isSegmentAssigned = (t) => {
            const tn = String(t.teamName || '').trim();
            const cat = cleanCategory(t.category || '');
            const dayKey = t.dayKey || '';
            const fromId = t.fromId || null;
            const toId = t.toId || null;
            if (!fromId || !toId) return false;
            const parentKey = t._parentKey || t.key;
            const parent = (savedTransfersRef.current || []).find((s) => s.key === parentKey);
            if (parent && Array.isArray(parent.segments)) {
                const segIdx = findSegmentIndex(parent.segments, fromId, toId);
                if (segIdx !== -1) {
                    const seg = parent.segments[segIdx];
                    if (seg && seg.busId && seg.boardingRowId && seg.alightingRowId) {
                        return true;
                    }
                    if (seg && seg.isWalking === true) {
                        return true;
                    }
                }
            }
            return false;
        };    
        const expandedTransfers = [];
        filteredByDay.forEach((t) => {
            const stopsIds = Array.isArray(t.intermediateStopIds) ? t.intermediateStopIds : [];
            if (stopsIds.length === 0) {
                const isAssigned = isSegmentAssigned(t);
                let displayWhen = t.when;
                if (!displayWhen || String(displayWhen).trim() === '') {
                    const parentRec = savedTransfers.find((s) => s.key === t.key);
                    if (parentRec && parentRec.when && String(parentRec.when).trim() !== '') {
                        displayWhen = parentRec.when;
                    } else if (Array.isArray(t.segments) && t.segments.length > 0) {
                        let earliestStart = null;
                        let latestEnd = null;
                        t.segments.forEach((s) => {
                            if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                                earliestStart = s.startTs;
                            }
                            if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                                latestEnd = s.endTs;
                            }
                        });
                        if (earliestStart != null && latestEnd != null) {
                            displayWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                        } else if (earliestStart != null) {
                            displayWhen = formatTsLocal(earliestStart);
                        } else if (latestEnd != null) {
                            displayWhen = formatTsLocal(latestEnd);
                        }
                    }
                }
                expandedTransfers.push({
                    ...t,
                    when: displayWhen,
                    _isAssigned: isAssigned,
                    _hasRealTime: !!(displayWhen && String(displayWhen).trim() !== ''),
                });
                return;
            }
            const routeIdsRaw = [t.fromId, ...stopsIds, t.toId].filter(Boolean);
            const routeIds = [];
            routeIdsRaw.forEach((id) => {
                if (routeIds.length === 0 || routeIds[routeIds.length - 1] !== id) routeIds.push(id);
            });
            if (routeIds.length < 2) {
                expandedTransfers.push(t);
                return;
            }
            const timeRange = parseWhenRangeToTs(t.when);
            if (!timeRange || timeRange.startTs == null || timeRange.endTs == null || timeRange.endTs <= timeRange.startTs) {
                for (let i = 0; i < routeIds.length - 1; i++) {
                    const fromId = routeIds[i];
                    const toId = routeIds[i + 1];
                    if (fromId === toId) continue;
                    const parentSegmentForThisIdx = (() => {
                        if (!Array.isArray(t.segments)) return null;
                        return t.segments.find((s) => s.fromId === fromId && s.toId === toId) || null;
                    })();
                    const isSegmentWalking = (parentSegmentForThisIdx && parentSegmentForThisIdx.isWalking === true) || t.isWalking === true;
                    if (isSegmentWalking) continue;
            
                    let hasRealTime = false;
                    let whenStr = null;
            
                    // NOVÉ: Pre priradený segment použi reálny čas z parent.segments
                    if (parentSegmentForThisIdx && parentSegmentForThisIdx.startTs != null && parentSegmentForThisIdx.endTs != null && parentSegmentForThisIdx.endTs > parentSegmentForThisIdx.startTs) {
                        hasRealTime = true;
                        whenStr = `${formatTsLocal(parentSegmentForThisIdx.startTs)} – ${formatTsLocal(parentSegmentForThisIdx.endTs)}`;
                    }
            
                    // NOVÉ: Pre nepriradený segment VŽDY použi computeProvisionalSegmentRange
                    if (!whenStr) {
                        const provisional = computeProvisionalSegmentRange({
                            ...t,
                            fromId: fromId,
                            toId: toId,
                            _parentKey: t.key,
                        });
                        if (provisional) {
                            whenStr = `${formatTsLocal(provisional.startTs)} – ${formatTsLocal(provisional.endTs)}`;
                            hasRealTime = false;
                        }
                    }
            
                    const text = `Presun z ${resolvePlaceNameById(fromId)} do ${resolvePlaceNameById(toId)}`;
                    const key = buildTransferKey(t.category, t.teamName, whenStr || '', text);
            
                    expandedTransfers.push({
                        ...t,
                        key,
                        when: whenStr,
                        text,
                        fromId: fromId,
                        toId: toId,
                        intermediateStopIds: [],
                        _parentKey: t.key,
                        _parentRoute: `${resolvePlaceNameById(t.fromId)} → ${resolvePlaceNameById(t.toId)}`,
                        _remainingMinutes: remainingMinutes,
                        _isAssigned: segmentAssigned[i],
                        _hasRealTime: hasRealTime,
                        isWalking: false,
                        _displayStartTs: ft.startTs,
                        _displayEndTs: ft.endTs,
                    });
                }
                return;
            }

            const teamName = String(t.teamName || '').trim();
            const category = cleanCategory(t.category || '');
            const dayKey = t.dayKey || '';
            const teamKey = `${teamName}|${category}`;

            const allBusRowsForDay = [];
            Object.entries(busRows || {}).forEach(([busKey, rows]) => {
                const bDayKey = busKey.split('|')[1];
                if (bDayKey !== dayKey) return;
                (rows || []).forEach((row) => {
                    allBusRowsForDay.push({ ...row, _busKey: busKey });
                });
            });
            allBusRowsForDay.sort((a, b) => {
                const ta = a.timeFrom || '';
                const tb = b.timeFrom || '';
                return ta.localeCompare(tb);
            });

            const matchesTeam = (rowTeams) => {
                if (!Array.isArray(rowTeams)) return false;
                return rowTeams.some((tk) => {
                    const s = String(tk).trim();
                    if (s === teamKey) return true;
                    const [tn, cat] = s.split('|');
                    return String(tn).trim() === teamName && cleanCategory(cat) === category;
                });
            };

            const segmentRealTimes = [];
            const segmentAssigned = [];

            for (let i = 0; i < routeIds.length - 1; i++) {
                const segFromId = routeIds[i];
                const segToId = routeIds[i + 1];
                let boardingTs = null;
                let alightingTs = null;

                allBusRowsForDay.forEach((row) => {
                    const rowFromId = row.placeFromId || null;
                    const rowToId = row.placeToId || null;
                    const hasTeamIn = matchesTeam(row.teamsIn);
                    const hasTeamOut = matchesTeam(row.teamsOut);

                    if (hasTeamIn && rowFromId === segFromId && row.timeFrom && boardingTs == null) {
                        const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                        if (dm) {
                            const [h, mi] = row.timeFrom.split(':').map(Number);
                            boardingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                        }
                    }
                    if (hasTeamOut && rowToId === segToId && row.timeTo && alightingTs == null) {
                        const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                        if (dm) {
                            const [h, mi] = row.timeTo.split(':').map(Number);
                            alightingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                        }
                    }
                });

                if (boardingTs != null && alightingTs != null && alightingTs > boardingTs) {
                    segmentRealTimes.push({ startTs: boardingTs, endTs: alightingTs });
                    segmentAssigned.push(true);
                } else if (boardingTs != null) {
                    segmentRealTimes.push({ startTs: boardingTs, endTs: null });
                    segmentAssigned.push(true);
                } else if (alightingTs != null) {
                    segmentRealTimes.push({ startTs: null, endTs: alightingTs });
                    segmentAssigned.push(true);
                } else {
                    segmentRealTimes.push(null);
                    segmentAssigned.push(false);
                }
            }

            const finalTimes = new Array(routeIds.length - 1).fill(null);

            for (let i = 0; i < routeIds.length - 1; i++) {
                const rt = segmentRealTimes[i];
                if (rt && rt.startTs != null && rt.endTs != null) {
                    finalTimes[i] = { startTs: rt.startTs, endTs: rt.endTs };
                    continue;
                }
            }

            for (let i = 0; i < routeIds.length - 1; i++) {
                if (finalTimes[i]) continue;
                const rt = segmentRealTimes[i];
                if (rt) {
                    const startTs = rt.startTs != null ? rt.startTs : timeRange.startTs;
                    const endTs = rt.endTs != null ? rt.endTs : timeRange.endTs;
                    finalTimes[i] = { startTs, endTs };
                }
            }

            for (let i = 0; i < routeIds.length - 1; i++) {
                if (finalTimes[i]) continue;

                let startTs = null;
                for (let k = i - 1; k >= 0; k--) {
                    if (finalTimes[k] && finalTimes[k].endTs != null) {
                        startTs = finalTimes[k].endTs;
                        break;
                    }
                }
                if (startTs == null) startTs = timeRange.startTs;

                let endTs = null;
                for (let k = i + 1; k < routeIds.length - 1; k++) {
                    if (finalTimes[k] && finalTimes[k].startTs != null) {
                        endTs = finalTimes[k].startTs;
                        break;
                    }
                }
                if (endTs == null) endTs = timeRange.endTs;

                if (startTs != null && endTs != null && endTs > startTs) {
                    finalTimes[i] = { startTs, endTs };
                } else {
                    finalTimes[i] = { startTs: null, endTs: null };
                }
            }

            for (let i = 0; i < routeIds.length - 1; i++) {
                const ft = finalTimes[i];
                if (!ft) continue;

                const fromId = routeIds[i];
                const toId = routeIds[i + 1];
                if (fromId === toId) continue;

                const parentSegmentForThisIdx = (() => {
                    if (!Array.isArray(t.segments)) return null;
                    return t.segments.find(
                        (s) => s.fromId === fromId && s.toId === toId
                    ) || null;
                })();

                const isSegmentWalking =
                    (parentSegmentForThisIdx && parentSegmentForThisIdx.isWalking === true) ||
                    t.isWalking === true;

                if (isSegmentWalking) {
                    continue;
                }

                const hasRealTime = ft.startTs != null && ft.endTs != null;
                let whenStr = hasRealTime
                    ? `${formatTsLocal(ft.startTs)} – ${formatTsLocal(ft.endTs)}`
                    : null;

                const text = `Presun z ${resolvePlaceNameById(fromId)} do ${resolvePlaceNameById(toId)}`;
                const key = buildTransferKey(
                    t.category,
                    t.teamName,
                    whenStr || '',
                    text
                );

                let remainingMinutes = null;

                if (hasRealTime && !segmentAssigned[i]) {
                    let endTs = null;
                    for (let k = i + 1; k < routeIds.length - 1; k++) {
                        if (segmentAssigned[k] && finalTimes[k] && finalTimes[k].startTs != null) {
                            endTs = finalTimes[k].startTs;
                            break;
                        }
                    }
                    if (endTs == null) endTs = timeRange.endTs;

                    if (endTs != null && ft.startTs != null && endTs > ft.startTs) {
                        remainingMinutes = Math.round((endTs - ft.startTs) / 60000);
                    }
                }

                expandedTransfers.push({
                    ...t,
                    key,
                    when: whenStr,
                    text,
                    fromId: fromId,
                    toId: toId,
                    intermediateStopIds: [],
                    _parentKey: t.key,
                    _parentRoute: `${resolvePlaceNameById(t.fromId)} → ${resolvePlaceNameById(t.toId)}`,
                    _remainingMinutes: remainingMinutes,
                    _isAssigned: segmentAssigned[i],
                    _hasRealTime: hasRealTime,
                    isWalking: false,
                });
            }
        });
    
        const fullyAssignedParentKeys = new Set();

        const parentKeysInExpanded = new Set();
        expandedTransfers.forEach((t) => {
            if (t._parentKey) parentKeysInExpanded.add(t._parentKey);
        });

        parentKeysInExpanded.forEach((parentKey) => {
            const parent = savedTransfers.find((s) => s.key === parentKey);
            if (!parent || !Array.isArray(parent.segments)) return;

            const allAssigned = parent.segments.every((seg) => {
                if (!seg) return false;
                if (seg.isWalking === true) return true;
                if (seg.busAssigned === true && seg.startTs != null && seg.endTs != null) return true;
                return false;
            });
            if (allAssigned) fullyAssignedParentKeys.add(parentKey);
        });

        const baseFiltered = expandedTransfers.filter((t) => {
            if (t.isWalking === true) return false;

            if (t._parentKey) {
                const parent = savedTransfers.find((s) => s.key === t._parentKey);
                if (parent && Array.isArray(parent.segments)) {
                    const segIdx = findSegmentIndex(parent.segments, t.fromId, t.toId);
                    if (segIdx !== -1) {
                        const seg = parent.segments[segIdx];
                        if (seg && seg.isWalking === true) {
                            return false;
                        }
                    }
                }

                if (isSegmentAssigned(t)) return false;

                if (t._parentKey && fullyAssignedParentKeys.has(t._parentKey)) return false;
                return true;
            }
            const parentRec = savedTransfers.find((s) => s.key === t.key);
            if (parentRec && Array.isArray(parentRec.segments)) {
                const segIdx = findSegmentIndex(parentRec.segments, t.fromId, t.toId);
                if (segIdx !== -1) {
                    const seg = parentRec.segments[segIdx];
                    if (seg && seg.isWalking === true) {
                        return false;
                    }
                }
            }
            if (isSegmentAssigned(t)) return false;
            if (t._remainingMinutes != null && t._remainingMinutes <= 0) {
                return false;
            }
            return true;
        });        
        const firstSegmentPerParent = new Map();
        const getParentSegmentIndex = (t) => {
            if (!t._parentKey) return Number.POSITIVE_INFINITY;
            const parent = savedTransfers.find((s) => s.key === t._parentKey);
            if (!parent || !Array.isArray(parent.segments)) return Number.POSITIVE_INFINITY;
            const idx = findSegmentIndex(parent.segments, t.fromId, t.toId);
            return idx === -1 ? Number.POSITIVE_INFINITY : idx;
        };

        baseFiltered.forEach((t) => {
            const blockKey = t._parentKey
                ? `${t._parentKey}||${cleanCategory(t.category || '')}||${String(t.teamName || '').trim()}`
                : `solo||${t.key}`;
            const segmentIdx = getParentSegmentIndex(t);
            const existing = firstSegmentPerParent.get(blockKey);
            if (!existing) {
                firstSegmentPerParent.set(blockKey, { segment: t, segmentIdx });
                return;
            }
            if (segmentIdx < existing.segmentIdx) {
                firstSegmentPerParent.set(blockKey, { segment: t, segmentIdx });
            }
        });

        const allowedKeys = new Set();
        firstSegmentPerParent.forEach(({ segment }) => {
            allowedKeys.add(segment.key);
        });

        const baseFilteredFirstOnlyRaw = baseFiltered.filter((t) => allowedKeys.has(t.key));

        const baseFilteredFirstOnly = baseFilteredFirstOnlyRaw;

        const hasAnyPartialTransfer = baseFilteredFirstOnly.some(
            (t) => t._parentKey && t._parentRoute
        );

        // Ak nie je žiadna časť presunu, filter sa nesmie uplatniť (inak by sme skryli všetko).
        const effectiveShowOnlyPartialTransfers =
            showOnlyPartialTransfers && hasAnyPartialTransfer;

        const filtered = effectiveShowOnlyPartialTransfers
            ? baseFilteredFirstOnly.filter((t) => t._parentKey && t._parentRoute)
            : baseFilteredFirstOnly;
        
        const buildStartSortKey = (t) => {
            const r = parseWhenRangeFull(t.when);
            const dayKey = r ? r.startDayKey : (t.dayKey || '');
            const time = r && r.startTime ? r.startTime : '00:00';
            const datePart = String(dayKey || '').replace(/-/g, '');
            const timePart = String(time || '').replace(':', '');
            return `${datePart}${timePart}`;
        };
    
        const buildEndSortKey = (t) => {
            const r = parseWhenRangeFull(t.when);
            const dayKey = r ? r.endDayKey : (t.dayKey || '');
            const time = r && r.endTime ? r.endTime : '23:59';
            const datePart = String(dayKey || '').replace(/-/g, '');
            const timePart = String(time || '').replace(':', '');
            return `${datePart}${timePart}`;
        };
    
        const sortedTransfers = [...filtered].sort((a, b) => {
            const startA = buildStartSortKey(a);
            const startB = buildStartSortKey(b);
            if (startA !== startB) return startA.localeCompare(startB);
    
            const endA = buildEndSortKey(a);
            const endB = buildEndSortKey(b);
            if (endA !== endB) return endA.localeCompare(endB);
    
            const ca = cleanCategory(a.category) || '';
            const cb = cleanCategory(b.category) || '';
            if (ca !== cb) return ca.localeCompare(cb, 'sk', { sensitivity: 'base' });
    
            const ta = String(a.teamName || '');
            const tb = String(b.teamName || '');
            return ta.localeCompare(tb, 'sk', { sensitivity: 'base' });
        });
    
        return React.createElement(
            'div',
            {
                className: 'bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex-shrink-0',
                style: { width: '420px', maxWidth: '100%' }
            },
            React.createElement(
                'div',
                {
                    className: 'relative px-5 py-3 flex items-center justify-center text-white',
                    style: { backgroundColor: '#7c3aed' }
                },
                React.createElement('i', { className: 'fa-solid fa-bus mr-2' }),
                React.createElement(
                    'h3',
                    { className: 'text-lg font-bold text-center' },
                    'Vygenerované presuny'
                ),
                React.createElement(
                    'span',
                    { className: 'absolute right-3 text-xs bg-white/20 rounded-full px-2 py-0.5' },
                    `${filtered.length}`
                )
            ),
            (() => {
                // Checkbox "Iba časti presunov" zobrazíme len ak existuje aspoň jeden
                // presun, ktorý je časťou väčšieho presunu (má _parentKey a _parentRoute).
                if (!hasAnyPartialTransfer) {
                    return null;
                }

                return React.createElement(
                    'div',
                    { className: 'px-3 pt-2 pb-1 border-b border-gray-100 flex items-center justify-end' },
                    React.createElement(
                        'label',
                        {
                            className: 'flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none',
                            title: 'Zobraziť iba tie presuny, ktoré sú časťou väčšieho presunu (majú medzizastávky)',
                        },
                        React.createElement('input', {
                            type: 'checkbox',
                            checked: showOnlyPartialTransfers,
                            onChange: (e) => setShowOnlyPartialTransfers(e.target.checked),
                            className: 'w-4 h-4 rounded accent-violet-600 cursor-pointer',
                        }),
                        React.createElement('span', { className: 'whitespace-nowrap' }, 'Iba časti presunov')
                    )
                );
            })(),
            filtered.length === 0
                ? React.createElement(
                    'p',
                    { className: 'text-center text-gray-500 py-6 text-sm italic px-3' },
                    showOnlyPartialTransfers
                        ? 'Žiadne presuny, ktoré by boli časťou väčšieho presunu (s medzizastávkami).'
                        : 'Zatiaľ žiadne vygenerované presuny. Kliknite na "+" vpravo dole a vygenerujte časovú os.'
                )
                : React.createElement(
                    'div',
                    { className: 'p-3' },
                    React.createElement(
                        'ul',
                        { className: 'space-y-2' },
                        sortedTransfers.map((t) => {
                            const rangeInfo = parseWhenRangeFull(t.when);
                            const transferInfo = parseTransferText(t.text);
    
                            const transportColor = getTransportColorForCategory(t.category);
                            const boxBg = transportColor
                                ? lightenHex(transportColor, 0.15)
                                : null;
    
                            let dateLabel = null;
                            if (rangeInfo) {
                                dateLabel = (rangeInfo.startDayKey === rangeInfo.endDayKey)
                                    ? rangeInfo.startLabel
                                    : `${rangeInfo.startLabel} – ${rangeInfo.endLabel}`;
                            } else if (t.dayKey) {
                                dateLabel = formatDateDDMMYYYY(t.dayKey) || t.dayKey;
                            }                            
                            const extractTimesOnly = (whenStr) => {
                                if (!whenStr) return null;
                                const s = String(whenStr);
                                const regex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
                                const times = [];
                                let m;
                                while ((m = regex.exec(s)) !== null) {
                                    if (m[4] != null && m[5] != null) {
                                        times.push(`${String(m[4]).padStart(2, '0')}:${String(m[5]).padStart(2, '0')}`);
                                    }
                                }
                                if (times.length === 0) return null;
                                if (times.length === 1) return times[0];
                                return `${times[0]} – ${times[1]}`;
                            };                            
                            let timeLabel = null;

                            if (t._parentKey) {
                                // 1) Priorita: dopočítaný čas z finalTimes (pokrýva aj nepriradené segmenty,
                                //    keď je predchádzajúci segment priradený busu)
                                if (t._displayStartTs != null || t._displayEndTs != null) {
                                    const startFmt = t._displayStartTs != null ? formatTsLocal(t._displayStartTs) : null;
                                    const endFmt = t._displayEndTs != null ? formatTsLocal(t._displayEndTs) : null;
                                    const startTime = startFmt ? /(\d{2}:\d{2})$/.exec(startFmt)?.[1] : null;
                                    const endTime = endFmt ? /(\d{2}:\d{2})$/.exec(endFmt)?.[1] : null;
                                    if (startTime && endTime) timeLabel = `${startTime} – ${endTime}`;
                                    else if (startTime) timeLabel = startTime;
                                    else if (endTime) timeLabel = endTime;
                                }
                            
                                // 2) Fallback: reálny čas segmentu z parenta / provizórny výpočet
                                if (!timeLabel) {
                                    const parentRec = savedTransfersRef.current.find((s) => s.key === t._parentKey);
                                    let parentSeg = null;
                                    if (parentRec && Array.isArray(parentRec.segments)) {
                                        const idx = findSegmentIndex(parentRec.segments, t.fromId, t.toId);
                                        if (idx !== -1) parentSeg = parentRec.segments[idx];
                                    }
                                    const hasRealBusTime =
                                        parentSeg &&
                                        parentSeg.busId &&
                                        parentSeg.boardingRowId &&
                                        parentSeg.alightingRowId &&
                                        parentSeg.startTs != null &&
                                        parentSeg.endTs != null &&
                                        parentSeg.endTs > parentSeg.startTs;
                            
                                    if (hasRealBusTime) {
                                        const startFmt = formatTsLocal(parentSeg.startTs);
                                        const endFmt = formatTsLocal(parentSeg.endTs);
                                        const startTime = startFmt ? /(\d{2}:\d{2})$/.exec(startFmt)?.[1] : null;
                                        const endTime = endFmt ? /(\d{2}:\d{2})$/.exec(endFmt)?.[1] : null;
                                        if (startTime && endTime) timeLabel = `${startTime} – ${endTime}`;
                                        else if (startTime) timeLabel = startTime;
                                        else if (endTime) timeLabel = endTime;
                                    } else {
                                        const provisional = computeProvisionalSegmentRange(t);
                                        if (provisional) {
                                            const startFmt = formatTsLocal(provisional.startTs);
                                            const endFmt = formatTsLocal(provisional.endTs);
                                            const startTime = startFmt ? /(\d{2}:\d{2})$/.exec(startFmt)?.[1] : null;
                                            const endTime = endFmt ? /(\d{2}:\d{2})$/.exec(endFmt)?.[1] : null;
                                            if (startTime && endTime) timeLabel = `${startTime} – ${endTime}`;
                                            else if (startTime) timeLabel = startTime;
                                            else if (endTime) timeLabel = endTime;
                                        }
                                    }
                                }
                            } else {
                                // Non-segment presun
                                if (t.when && String(t.when).trim() !== '') {
                                    timeLabel = extractTimesOnly(t.when) || String(t.when).trim();
                                }
                                if (!timeLabel && rangeInfo && (rangeInfo.startTime || rangeInfo.endTime)) {
                                    const st = rangeInfo.startTime;
                                    const et = rangeInfo.endTime;
                                    if (st && et) timeLabel = `${st} – ${et}`;
                                    else if (st) timeLabel = st;
                                    else if (et) timeLabel = et;
                                }
                            }
                            
                            if (!timeLabel && t.dayKey) {
                                const dayLabel = formatDateDDMMYYYY(t.dayKey) || t.dayKey;
                                timeLabel = `${dayLabel} (čas neurčený)`;
                            }
                            
                            let routeLabel = null;
                            if (transferInfo) {
                                const stopsIds = Array.isArray(t.intermediateStopIds) ? t.intermediateStopIds : [];
                                if (stopsIds.length > 0) {
                                    const routeIds = [t.fromId, ...stopsIds, t.toId].filter(Boolean);
                                    routeLabel = routeIds
                                        .map((id) => resolvePlaceNameById(id))
                                        .filter(Boolean)
                                        .join(' → ');
                                } else {
                                    routeLabel = `${transferInfo.from} → ${transferInfo.to}`;
                                }
                            } else if (t.fromId && t.toId) {
                                routeLabel = `${resolvePlaceNameById(t.fromId)} → ${resolvePlaceNameById(t.toId)}`;
                            }    
                            const parentInfoLabel = t._parentKey && t._parentRoute
                                ? `časť presunu ${t._parentRoute}`
                                : null;

                            // Zvyšný čas na presun sa počíta ZO ZOBRAZENÉHO ČASU PRESUNU (timeLabel),
                            // t.j. z 3. riadku v boxe. Ak čas chýba, dopočíta sa cez _remainingMinutes
                            // (alebo sa nezobrazí).
                            const parseTimeLabelRange = (label) => {
                                if (!label) return null;
                                const s = String(label);
                                const timeRe = /(\d{1,2}):(\d{2})/g;
                                const found = [];
                                let m;
                                while ((m = timeRe.exec(s)) !== null) {
                                    const hh = Number(m[1]);
                                    const mi = Number(m[2]);
                                    if (hh >= 0 && hh <= 23 && mi >= 0 && mi <= 59) {
                                        found.push(hh * 60 + mi);
                                    }
                                }
                                if (found.length === 0) return null;
                                if (found.length === 1) return { startMin: found[0], endMin: found[0] };
                                return { startMin: found[0], endMin: found[1] };
                            };

                            const computeRemainingMinutesFromLabel = () => {
                                const parsed = parseTimeLabelRange(timeLabel);
                                if (!parsed) return null;

                                // Pre segmenty: koniec = začiatok nasledujúceho priradeného segmentu
                                // (alebo koniec parent timeRange). Pre non-segmenty: endMin - startMin.
                                let endMin = parsed.endMin;

                                if (t._parentKey) {
                                    const parentRec = savedTransfersRef.current.find((s) => s.key === t._parentKey);
                                    if (parentRec && Array.isArray(parentRec.segments)) {
                                        const segIdx = findSegmentIndex(parentRec.segments, t.fromId, t.toId);
                                        // Nájdi najbližší nasledujúci priradený segment
                                        let nextAssignedStartMin = null;
                                        for (let i = segIdx + 1; i < parentRec.segments.length; i++) {
                                            const seg = parentRec.segments[i];
                                            if (!seg) continue;
                                            if (seg.isWalking === true) continue;
                                            if (!(seg.busId && seg.boardingRowId && seg.alightingRowId)) continue;
                                            if (seg.startTs == null) continue;
                                            // Prepočítaj na minúty v rámci dňa – potrebujeme len časť HH:MM
                                            const startFmt = formatTsLocal(seg.startTs);
                                            const startTime = startFmt ? /(\d{2}):(\d{2})$/.exec(startFmt) : null;
                                            if (startTime) {
                                                nextAssignedStartMin = Number(startTime[1]) * 60 + Number(startTime[2]);
                                                break;
                                            }
                                        }
                                        if (nextAssignedStartMin != null) {
                                            endMin = nextAssignedStartMin;
                                        }
                                    }
                                }

                                let diff = endMin - parsed.startMin;
                                if (diff < 0) diff += 24 * 60;
                                return diff;
                            };

                            const remainingMinutesFromLabel = computeRemainingMinutesFromLabel();

                            const remainingLabel = (remainingMinutesFromLabel != null)
                                ? `zvyšný čas na presun: ${remainingMinutesFromLabel} min`
                                : null;
    
                            return React.createElement(
                                'li',
                                {
                                    key: t.key,
                                    onClick: () => {
                                        logTransferDbDocument(t);
                                        setTransferActionModal({ transfer: t });
                                    },
                                    className: 'relative text-sm text-gray-700 flex flex-col leading-snug rounded-md px-2 py-1.5 cursor-pointer hover:shadow-md transition-shadow' +
                                        (boxBg ? '' : ' bg-violet-50/40'),
                                    style: {
                                        position: 'relative',
                                        borderLeft: transportColor
                                            ? `6px solid ${transportColor}`
                                            : '2px solid #c4b5fd',
                                        ...(boxBg ? { backgroundColor: boxBg } : {}),
                                    }
                                },
                                (() => {
                                    const counts = getTeamCountsForTransfer(t.category, t.teamName);
                                    const totalMembers = counts
                                        ? counts.players + counts.menRT + counts.womenRT + counts.menDrivers + counts.womenDrivers
                                        : null;
    
                                    let valueText = null;
                                    let displayTitle = null;
    
                                    if (totalMembers != null) {
                                        valueText = `${totalMembers}`;
                                    } else {
                                        const avg = getCategoryAverageForTransfer(t.category);
                                        if (avg != null) {
                                            valueText = `${avg}`;
                                            displayTitle = `Priemer členov tímu v kategórii ${t.category} (zaokrúhlené nahor)`;
                                        }
                                    }    
                                    const teamLabel = t.teamName || '(neznámy tím)';
                                    const fullText = valueText ? `${teamLabel} ● ${valueText} členov` : teamLabel;    
                                    return React.createElement(
                                        'span',
                                        {
                                            className: 'font-semibold',
                                            style: { color: transportColor || '#5b21b6' },
                                            title: displayTitle || ''
                                        },
                                        fullText
                                    );
                                })(),
                                dateLabel &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-gray-500' },
                                        dateLabel
                                    ),
                                timeLabel &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-gray-600' },
                                        timeLabel
                                    ),
                                routeLabel &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-gray-900 font-medium' },
                                        routeLabel
                                    ),
                                parentInfoLabel &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-violet-600 italic mt-0.5 inline-flex items-center gap-1' },
                                        parentInfoLabel
                                    ),
                                remainingLabel &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-xs text-amber-700 font-semibold mt-0.5 inline-flex items-center gap-1' },
                                        React.createElement('i', { className: 'fa-solid fa-hourglass-half' }),
                                        remainingLabel
                                    ),
                                t.isWalking === true &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-xs font-semibold text-emerald-700 mt-0.5 inline-flex items-center gap-1' },
                                        React.createElement('i', { className: 'fa-solid fa-person-walking' }),
                                        'PEŠI'
                                    ),
                                React.createElement(
                                    'button',
                                    {
                                        type: 'button',
                                        onClick: (e) => {
                                            e.stopPropagation();
                                            setDeleteTransferModal({ transfer: t });
                                        },
                                        title: 'Odstrániť tento presun',
                                        className: 'absolute top-1.5 right-1.5 rounded-full w-8 h-8 flex items-center justify-center transition-colors bg-red-600 text-white hover:bg-red-700',
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-trash' })
                                ),
                                (!dateLabel && !timeLabel && !routeLabel) &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-gray-800' },
                                        String(t.text || '')
                                            .replace(/^Presun z /, '')
                                            .replace(/\bubytovania\b/gi, 'ubytovňa')
                                            .replace(/\bubytovanie\b/gi, 'ubytovňa')
                                            .replace(/\bzastávky\b/gi, 'zastávka')
                                            .replace(/\bzastávok\b/gi, 'zastávka')
                                    ),
                            );
                        })
                    )
                )
        );
    };

    const getTeamEventsForCustomTransfer = (category, teamName) => {
        if (!category || !teamName) return [];
        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();
        const events = [];
        (matchesBufferRef.current || []).forEach((m) => {
            if (cleanCategory(m.category) !== cat) return;
            if (m.home !== name && m.away !== name) return;
            const startTs = m.scheduledTs ?? null;
            const endTs = m.scheduledEndTs ?? startTs;
            const timeRange = m.scheduledTime
                ? (m.scheduledEndTime ? `${m.scheduledTime} – ${m.scheduledEndTime}` : m.scheduledTime)
                : 'nenaplánované';
            const text = `${m.home} vs ${m.away}${m.special}${m.hallName ? ` | ${m.hallName}` : ''}`;
            events.push({
                ts: m.scheduledTs ?? Number.POSITIVE_INFINITY,
                startTs,
                endTs,
                when: timeRange,
                type: 'match',
                text,
                location: m.hallName || null,
            });
        });

        (cateringBufferRef.current || []).forEach((c) => {
            if (cleanCategory(c.category) !== cat) return;
            if (c.teamName !== name) return;

            const mealLabel = c.mealType === 'lunch' ? 'Obed' : c.mealType === 'dinner' ? 'Večera' : c.mealType;
            const formattedDay = c.dayKey ? (formatDateDDMMYYYY(c.dayKey) || c.dayKey) : '?';
            const timeRange = c.slotFrom
                ? (c.slotTo ? `${c.slotFrom} – ${c.slotTo}` : c.slotFrom)
                : '--:--';

            const startTs = c.ts ?? null;
            const endTs = c.slotToTs ?? startTs;

            events.push({
                ts: c.ts ?? Number.POSITIVE_INFINITY,
                startTs,
                endTs,
                when: ` ${formattedDay} ${timeRange}`.trim(),
                type: 'catering',
                text: `${mealLabel} (${timeRange}) → ${c.placeName}`,
                location: c.placeName || null,
            });
        });

        const teamInfo = (teamsArrivalBufferRef.current || []).find(
            (t) => cleanCategory(t.category) === cat && t.teamName === name
        );

        if (teamInfo) {
            if (teamInfo.accommodationName) {
                events.push({
                    ts: -Infinity,
                    startTs: null,
                    endTs: null,
                    when: '—',
                    type: 'accommodation',
                    text: `Ubytovanie: ${teamInfo.accommodationName} (typ: ${teamInfo.accommodationType || 'neurčený'})`,
                    location: teamInfo.accommodationName,
                });
            }
        }
        (savedTransfersRef.current || []).forEach((t) => {
            if (cleanCategory(t.category || '') !== cat) return;
            if (String(t.teamName || '').trim() !== name) return;
            if (t._parentKey && t._parentKey !== t.key) return;
            const stopsIds = Array.isArray(t.intermediateStopIds) ? t.intermediateStopIds : [];
            const routeIdsRaw = [t.fromId, ...stopsIds, t.toId].filter(Boolean);
            const routeIds = [];
            routeIdsRaw.forEach((id) => {
                if (routeIds.length === 0 || routeIds[routeIds.length - 1] !== id) routeIds.push(id);
            });
            if (routeIds.length < 2) return;
            const parentSegments = Array.isArray(t.segments) ? t.segments : [];
            const parentWhenRange = parseTransferWhenToRange(t.when);
            const parentRoutePlaces = routeIds.map((id) => resolvePlaceNameById(id));
            for (let i = 0; i < routeIds.length - 1; i++) {
                const fromId = routeIds[i];
                const toId = routeIds[i + 1];
                if (fromId === toId) continue;
                const segIdx = findSegmentIndex(parentSegments, fromId, toId);
                const seg = segIdx !== -1 ? parentSegments[segIdx] : null;
                const isWalking = !!(seg && seg.isWalking === true);
                const hasRealTimes = !!(seg && seg.startTs != null && seg.endTs != null && seg.endTs > seg.startTs);
                const busId = seg && seg.busId ? String(seg.busId) : null;
                const busName = busId
                    ? (buses.find((b) => b.id === busId)?.name || `Bus ${busId}`)
                    : null;
                let startTs = null;
                let endTs = null;
                let timeLabel = '';
                if (isWalking) {
                    // Pre walking segmenty použi rovnakú logiku ako v boxe "Peši":
                    // displayStartTs = koniec predchádzajúceho segmentu (alebo parent start)
                    // displayEndTs   = začiatok nasledujúceho segmentu (alebo parent end)
                    const parentRange = (() => {
                        const parsedFromWhen = parseWhenRangeToTs(t.when);
                        if (parsedFromWhen && parsedFromWhen.startTs != null && parsedFromWhen.endTs != null) {
                            if (parsedFromWhen.endTs > parsedFromWhen.startTs) {
                                return { startTs: parsedFromWhen.startTs, endTs: parsedFromWhen.endTs };
                            }
                        }
                        let earliestStart = null;
                        let latestEnd = null;
                        parentSegments.forEach((s) => {
                            if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                                earliestStart = s.startTs;
                            }
                            if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                                latestEnd = s.endTs;
                            } else if (s.isWalking === true && s.startTs != null) {
                                const candidateEnd = s.startTs + 60 * 1000;
                                if (latestEnd == null || candidateEnd > latestEnd) {
                                    latestEnd = candidateEnd;
                                }
                            }
                        });
                        if (earliestStart != null && latestEnd != null) {
                            return { startTs: earliestStart, endTs: latestEnd };
                        }
                        if (parsedFromWhen && parsedFromWhen.startTs != null) {
                            return { startTs: parsedFromWhen.startTs, endTs: parsedFromWhen.endTs };
                        }
                        return null;
                    })();

                    let prevSegmentEndTs = null;
                    for (let k = i - 1; k >= 0; k--) {
                        const s2 = parentSegments[k];
                        if (!s2) continue;
                        if (s2.endTs != null) { prevSegmentEndTs = s2.endTs; break; }
                        if (s2.startTs != null) { prevSegmentEndTs = s2.startTs; break; }
                    }

                    let nextSegmentStartTs = null;
                    for (let k = i + 1; k < parentSegments.length; k++) {
                        const s2 = parentSegments[k];
                        if (!s2) continue;
                        if (s2.startTs != null) { nextSegmentStartTs = s2.startTs; break; }
                        if (s2.endTs != null) { nextSegmentStartTs = s2.endTs; break; }
                    }

                    const parentStartTs = parentRange && parentRange.startTs != null ? parentRange.startTs : null;
                    const parentEndTs = parentRange && parentRange.endTs != null ? parentRange.endTs : null;

                    let displayStartTs = null;
                    let displayEndTs = null;

                    if (prevSegmentEndTs != null) {
                        displayStartTs = prevSegmentEndTs;
                    } else if (parentStartTs != null) {
                        displayStartTs = parentStartTs;
                    }

                    if (nextSegmentStartTs != null) {
                        displayEndTs = nextSegmentStartTs;
                    } else if (parentEndTs != null && parentEndTs > (displayStartTs || 0)) {
                        displayEndTs = parentEndTs;
                    } else if (displayStartTs != null) {
                        displayEndTs = displayStartTs + 60 * 1000;
                    }

                    if (
                        parentSegments.length === 1 &&
                        parentStartTs != null &&
                        parentEndTs != null
                    ) {
                        displayStartTs = parentStartTs;
                        displayEndTs = parentEndTs;
                    }

                    if (
                        displayStartTs != null &&
                        (displayEndTs == null || displayEndTs <= displayStartTs) &&
                        parentEndTs != null &&
                        parentEndTs > displayStartTs
                    ) {
                        displayEndTs = parentEndTs;
                    }

                    if (
                        displayStartTs != null &&
                        (displayEndTs == null || displayEndTs <= displayStartTs)
                    ) {
                        displayEndTs = displayStartTs + 60 * 1000;
                    }

                    startTs = displayStartTs;
                    endTs = displayEndTs;

                    const fmtTime = (ts) => {
                        if (ts == null) return null;
                        const f = formatTsLocal(ts);
                        return f ? /(\d{2}:\d{2})$/.exec(f)?.[1] || null : null;
                    };
                    const startTime = fmtTime(displayStartTs);
                    const endTime = fmtTime(displayEndTs);
                    if (startTime && endTime) timeLabel = `${startTime} – ${endTime}`;
                    else if (startTime) timeLabel = startTime;
                    else if (endTime) timeLabel = endTime;
                    else timeLabel = 'PEŠI';
                } else if (hasRealTimes) {
                    startTs = seg.startTs;
                    endTs = seg.endTs;
                    const startTime = /(\d{2}:\d{2})$/.exec(formatTsLocal(startTs) || '')?.[1] || '';
                    const endTime = /(\d{2}:\d{2})$/.exec(formatTsLocal(endTs) || '')?.[1] || '';
                    timeLabel = `${startTime} – ${endTime}`;
                } else {
                    try {
                        const provisional = computeProvisionalSegmentRange({
                            ...t,
                            fromId: fromId,
                            toId: toId,
                            _parentKey: t.key,
                        });
                        if (provisional && provisional.startTs != null) {
                            const startTime = /(\d{2}:\d{2})$/.exec(formatTsLocal(provisional.startTs) || '')?.[1] || '';
                            const endTime = provisional.endTs != null
                                ? /(\d{2}:\d{2})$/.exec(formatTsLocal(provisional.endTs) || '')?.[1] || ''
                                : '';
                            timeLabel = endTime ? `${startTime} – ${endTime}` : startTime;
                        }
                    } catch (e) { 
                    }
                    if (!timeLabel) timeLabel = 'nepriradený';
                }
                let dayKey = t.dayKey || null;
                if (!dayKey) {
                    if (startTs != null) {
                        const d = new Date(startTs);
                        dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    } else if (parentWhenRange && parentWhenRange.startTs != null) {
                        const d = new Date(parentWhenRange.startTs);
                        dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    } else if (t.when) {
                        const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(String(t.when));
                        if (m) {
                            const d = String(m[1]).padStart(2, '0');
                            const mo = String(m[2]).padStart(2, '0');
                            const y = m[3];
                            dayKey = `${y}-${mo}-${d}`;
                        }
                    }
                }
                const sortTs = startTs != null
                    ? startTs
                    : (parentWhenRange && parentWhenRange.startTs != null ? parentWhenRange.startTs : Number.POSITIVE_INFINITY);
                const fromName = resolvePlaceNameById(fromId);
                const toName = resolvePlaceNameById(toId);
                const routeLabel = `${fromName} → ${toName}`;
                events.push({
                    ts: sortTs,
                    startTs: startTs,
                    endTs: endTs,
                    when: timeLabel,
                    type: 'transfer',
                    text: `Presun: ${routeLabel}${busName ? ` (${busName})` : ''}`,
                    location: null,
                    _isAssigned: hasRealTimes,
                    _isWalking: isWalking,
                    _busName: busName,
                    _routeLabel: routeLabel,
                    _fromId: fromId,
                    _toId: toId,
                    _fromLocation: fromName,
                    _toLocation: toName,
                    _dayKey: dayKey,
                    _isTransferRow: true,
                    _routePlaces: parentRoutePlaces,
                });
            }
        });
        events.sort((a, b) => {
            if (a.ts !== b.ts) return a.ts - b.ts;
            return String(a.text).localeCompare(String(b.text), 'sk');
        });

        return events;
    };
    const renderWalkingTransfersBox = () => {
        const walkingTransfers = [];
        savedTransfers.forEach((t) => {
            if (selectedDayKey && t.dayKey !== selectedDayKey) return;
            if (selectedCategoryFilter && cleanCategory(t.category || '') !== cleanCategory(selectedCategoryFilter)) return;
            const stopsIds = Array.isArray(t.intermediateStopIds) ? t.intermediateStopIds : [];
            const segments = Array.isArray(t.segments) ? t.segments : [];
            if (t.isWalking === true && stopsIds.length === 0) {
                walkingTransfers.push({
                    ...t,
                    _displayFromId: t.fromId || null,
                    _displayToId: t.toId || null,
                    _displayFromLocation: resolvePlaceNameById(t.fromId) || '',
                    _displayToLocation: resolvePlaceNameById(t.toId) || '',
                    _segmentIndex: -1,
                });
                return;
            }
            if (stopsIds.length > 0 && segments.length > 0) {
                const routeIdsRaw = [t.fromId, ...stopsIds, t.toId].filter(Boolean);
                const routeIds = [];
                routeIdsRaw.forEach((id) => {
                    if (routeIds.length === 0 || routeIds[routeIds.length - 1] !== id) routeIds.push(id);
                });
                segments.forEach((seg, segIdx) => {
                    if (seg.isWalking !== true) return;
                    if (segIdx < 0 || segIdx >= routeIds.length - 1) return;
                    const fromId = routeIds[segIdx];
                    const toId = routeIds[segIdx + 1];
                    const fromName = resolvePlaceNameById(fromId);
                    const toName = resolvePlaceNameById(toId);
                    walkingTransfers.push({
                        ...t,
                        key: `${t.key}||walking||${segIdx}`,
                        fromId: fromId,
                        toId: toId,
                        fromLocation: fromName,
                        toLocation: toName,
                        text: `Presun z ${fromName} do ${toName}`,
                        isWalking: true,
                        _parentKey: t.key,
                        _parentRoute: `${resolvePlaceNameById(t.fromId)} → ${resolvePlaceNameById(t.toId)}`,
                        _segmentIndex: segIdx,
                        _displayFromId: fromId,
                        _displayToId: toId,
                        _displayFromLocation: fromName,
                        _displayToLocation: toName,
                        intermediateStopIds: [],
                    });
                });
            }
        });
        const parseTransferText = (text) => {
            if (!text) return null;
            const m = /^Presun z (.+?) do (.+)$/.exec(String(text).trim());
            if (!m) return null;
            const normalizePlace = (str) => String(str)
                .replace(/\bubytovania\b/gi, 'ubytovňa')
                .replace(/\bubytovanie\b/gi, 'ubytovňa')
                .replace(/\bzastávky\b/gi, 'zastávka')
                .replace(/\bzastávok\b/gi, 'zastávka');
            return {
                from: normalizePlace(m[1].trim()),
                to: normalizePlace(m[2].trim()),
            };
        };
        const getDayNameFromDayKey = (dayKey) => {
            if (!dayKey) return '';
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
            if (!m) return '';
            const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('sk-SK', { weekday: 'long' });
        };
        const enrichedWalking = walkingTransfers.map((t) => {
            if (!t._parentKey) {
                const parentRec = savedTransfers.find((s) => s.key === t.key) || t;

                let parsed = parseWhenRangeToTs(parentRec.when);

                if (!parsed && Array.isArray(parentRec.segments) && parentRec.segments.length > 0) {
                    let earliestStart = null;
                    let latestEnd = null;
                    parentRec.segments.forEach((s) => {
                        if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                            earliestStart = s.startTs;
                        }
                        if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                            latestEnd = s.endTs;
                        }
                    });
                    if (earliestStart != null && latestEnd != null) {
                        parsed = { startTs: earliestStart, endTs: latestEnd };
                    } else if (earliestStart != null) {
                        parsed = { startTs: earliestStart, endTs: earliestStart };
                    } else if (latestEnd != null) {
                        parsed = { startTs: latestEnd, endTs: latestEnd };
                    }
                }

                if (!parsed && parentRec.dayKey) {
                    const dayTs = dayKeyAndSlotToTimestamp(parentRec.dayKey, '00:00');
                    if (dayTs != null) {
                        parsed = { startTs: dayTs, endTs: dayTs + 24 * 60 * 60 * 1000 - 60000 };
                    }
                }

                const startTs = parsed && parsed.startTs != null ? parsed.startTs : null;
                const endTs = parsed && parsed.endTs != null ? parsed.endTs : null;
                let whenStr = null;
                if (startTs != null && endTs != null) {
                    whenStr = `${formatTsLocal(startTs)} – ${formatTsLocal(endTs)}`;
                } else if (startTs != null) {
                    whenStr = formatTsLocal(startTs);
                } else if (endTs != null) {
                    whenStr = formatTsLocal(endTs);
                }
                const remainingMinutes =
                    startTs != null && endTs != null && endTs > startTs
                        ? Math.round((endTs - startTs) / 60000)
                        : null;
                return {
                    ...t,
                    when: whenStr,
                    _displayStartTs: startTs,
                    _displayEndTs: endTs,
                    _displayRemainingMinutes: remainingMinutes,
                    _hasAnyBus: true,
                };
            }
            const parentKey = t._parentKey;
            const parent = savedTransfers.find((s) => s.key === parentKey);

            if (!parent) {
                return {
                    ...t,
                    when: null,
                    _displayStartTs: null,
                    _displayEndTs: null,
                    _displayRemainingMinutes: null,
                    _hasAnyBus: false,
                };
            }
            const parentSegments = Array.isArray(parent.segments) ? parent.segments : [];
            const segmentIndex = t._segmentIndex;
            
            const parentRange = (() => {
                const parsedFromWhen = parseWhenRangeToTs(parent.when);
                if (parsedFromWhen && parsedFromWhen.startTs != null && parsedFromWhen.endTs != null) {
                    if (parsedFromWhen.endTs > parsedFromWhen.startTs) {
                        return { startTs: parsedFromWhen.startTs, endTs: parsedFromWhen.endTs };
                    }
                }
            
                let earliestStart = null;
                let latestEnd = null;
                parentSegments.forEach((s) => {
                    if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                        earliestStart = s.startTs;
                    }
                    if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                        latestEnd = s.endTs;
                    } else if (s.isWalking === true && s.startTs != null) {
                        const candidateEnd = s.startTs + 60 * 1000;
                        if (latestEnd == null || candidateEnd > latestEnd) {
                            latestEnd = candidateEnd;
                        }
                    }
                });
                if (earliestStart != null && latestEnd != null) {
                    return { startTs: earliestStart, endTs: latestEnd };
                }
            
                if (parsedFromWhen && parsedFromWhen.startTs != null) {
                    return { startTs: parsedFromWhen.startTs, endTs: parsedFromWhen.endTs };
                }
            
                return null;
            })();
            
            let prevSegmentEndTs = null;
            for (let i = segmentIndex - 1; i >= 0; i--) {
                const seg = parentSegments[i];
                if (!seg) continue;
                if (seg.endTs != null) {
                    prevSegmentEndTs = seg.endTs;
                    break;
                }
                if (seg.startTs != null) {
                    prevSegmentEndTs = seg.startTs;
                    break;
                }
            }
            
            let nextSegmentStartTs = null;
            for (let i = segmentIndex + 1; i < parentSegments.length; i++) {
                const seg = parentSegments[i];
                if (!seg) continue;
                if (seg.startTs != null) {
                    nextSegmentStartTs = seg.startTs;
                    break;
                }
                if (seg.endTs != null) {
                    nextSegmentStartTs = seg.endTs;
                    break;
                }
            }
            
            const parentStartTs = parentRange && parentRange.startTs != null ? parentRange.startTs : null;
            const parentEndTs = parentRange && parentRange.endTs != null ? parentRange.endTs : null;
            
            const isFirstWalkingSegment = prevSegmentEndTs == null && parentStartTs != null;
            const isLastWalkingSegment = nextSegmentStartTs == null && parentEndTs != null;
            
            let displayStartTs = null;
            let displayEndTs = null;
            
            if (isFirstWalkingSegment) {
                displayStartTs = parentStartTs;
            } else if (prevSegmentEndTs != null) {
                displayStartTs = prevSegmentEndTs;
            } else if (parentStartTs != null) {
                displayStartTs = parentStartTs;
            }
            
            if (nextSegmentStartTs != null) {
                displayEndTs = nextSegmentStartTs;
            } else if (parentEndTs != null && parentEndTs > (displayStartTs || 0)) {
                displayEndTs = parentEndTs;
            } else if (displayStartTs != null) {
                const parentWhenRange = parseWhenRangeToTs(parent.when);
                if (parentWhenRange && parentWhenRange.endTs != null && parentWhenRange.endTs > displayStartTs) {
                    displayEndTs = parentWhenRange.endTs;
                } else {
                    displayEndTs = displayStartTs + 60 * 1000;
                }
            }
            
            if (
                parentSegments.length === 1 &&
                parentStartTs != null &&
                parentEndTs != null
            ) {
                displayStartTs = parentStartTs;
                displayEndTs = parentEndTs;
            }
            
            if (
                displayStartTs != null &&
                (displayEndTs == null || displayEndTs <= displayStartTs) &&
                parentEndTs != null &&
                parentEndTs > displayStartTs
            ) {
                displayEndTs = parentEndTs;
            }
            
            if (
                displayStartTs != null &&
                (displayEndTs == null || displayEndTs <= displayStartTs)
            ) {
                const parentWhenRange = parseWhenRangeToTs(parent.when);
                if (parentWhenRange && parentWhenRange.endTs != null && parentWhenRange.endTs > displayStartTs) {
                    displayEndTs = parentWhenRange.endTs;
                }
            }
            
            if (
                displayStartTs != null &&
                (displayEndTs == null || displayEndTs <= displayStartTs)
            ) {
                displayEndTs = displayStartTs + 60 * 1000;
            }
            
            let whenStr = null;
            if (displayStartTs != null && displayEndTs != null) {
                whenStr = `${formatTsLocal(displayStartTs)} – ${formatTsLocal(displayEndTs)}`;
            } else if (displayStartTs != null) {
                whenStr = formatTsLocal(displayStartTs);
            } else if (displayEndTs != null) {
                whenStr = formatTsLocal(displayEndTs);
            }
            
            let remainingMinutes = null;
            if (
                displayStartTs != null &&
                displayEndTs != null &&
                displayEndTs > displayStartTs
            ) {
                remainingMinutes = Math.round((displayEndTs - displayStartTs) / 60000);
            }
            
            return {
                ...t,
                when: whenStr,
                _displayStartTs: displayStartTs,
                _displayEndTs: displayEndTs,
                _displayRemainingMinutes: remainingMinutes,
                _hasAnyBus: true,
            };            
        });
        const filteredWalking = enrichedWalking;
        const sorted = [...filteredWalking].sort((a, b) => {
            const aStart = a._displayStartTs != null ? a._displayStartTs : Number.POSITIVE_INFINITY;
            const bStart = b._displayStartTs != null ? b._displayStartTs : Number.POSITIVE_INFINITY;
            if (aStart !== bStart) return aStart - bStart;

            const aTeam = String(a.teamName || '');
            const bTeam = String(b.teamName || '');
            return aTeam.localeCompare(bTeam, 'sk', { sensitivity: 'base' });
        });
        return React.createElement(
            'div',
            {
                className: 'bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex-shrink-0 pb-4',
                style: { width: '720px', maxWidth: '100%' }
            },
            React.createElement(
                'div',
                {
                    className: 'relative px-5 py-3 flex items-center justify-center text-white',
                    style: { backgroundColor: '#059669' }
                },
                React.createElement('i', { className: 'fa-solid fa-person-walking mr-2' }),
                React.createElement(
                    'h3',
                    { className: 'text-lg font-bold text-center' },
                    'Peši'
                ),
                React.createElement(
                    'span',
                    { className: 'absolute right-3 text-xs bg-white/20 rounded-full px-2 py-0.5' },
                    `${sorted.length}`
                )
            ),
            sorted.length === 0
                ? React.createElement(
                    'p',
                    { className: 'text-center text-gray-500 py-6 text-sm italic px-3' },
                    'Žiadne pešie presuny pre zvolený deň.'
                )
                : React.createElement(
                    'div',
                    { className: 'w-full' },
                    React.createElement(
                        'table',
                        { className: 'w-full border-collapse text-sm' },
                        React.createElement(
                            'tbody',
                            null,
                            (() => {
                                const groupsByDay = new Map();
                                sorted.forEach((t) => {
                                    const dayKey = t.dayKey || '';
                                    if (!groupsByDay.has(dayKey)) groupsByDay.set(dayKey, []);
                                    groupsByDay.get(dayKey).push(t);
                                });

                                const sortedDayKeys = [...groupsByDay.keys()].sort();

                                const elements = [];

                                sortedDayKeys.forEach((dayKey, dayIdx) => {
                                    const items = groupsByDay.get(dayKey) || [];

                                    const dateLabel = dayKey
                                        ? (formatDateDDMMYYYY(dayKey) || dayKey)
                                        : '—';
                                    const dayName = dayKey ? getDayNameFromDayKey(dayKey) : '';
                                    const capitalizedDayName = dayName
                                        ? dayName.charAt(0).toUpperCase() + dayName.slice(1)
                                        : '';

                                    elements.push(
                                        React.createElement(
                                            'tr',
                                            {
                                                key: `day-${dayKey || 'unknown'}`,
                                                className: dayIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                            },
                                            React.createElement(
                                                'td',
                                                {
                                                    colSpan: 7,
                                                    className: 'border border-gray-200 px-4 py-2 text-gray-800 text-center text-sm'
                                                },
                                                capitalizedDayName &&
                                                    React.createElement(
                                                        'span',
                                                        { className: 'font-semibold capitalize' },
                                                        capitalizedDayName
                                                    ),
                                                capitalizedDayName &&
                                                    React.createElement(
                                                        'span',
                                                        { className: 'text-gray-500 mx-2' },
                                                        '–'
                                                    ),
                                                React.createElement(
                                                    'span',
                                                    null,
                                                    dateLabel
                                                )
                                            )
                                        )
                                    );

                                    elements.push(
                                        React.createElement(
                                            'tr',
                                            {
                                                key: `header-${dayKey || 'unknown'}`,
                                                className: 'bg-gray-100 text-xs font-semibold text-gray-700'
                                            },
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '70px' } }, 'Od'),
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '70px' } }, 'Do'),
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '200px' } }, 'Miesto od'),
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '200px' } }, 'Miesto do'),
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1' }, 'Tím'),
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '80px' } }, 'Min'),
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '36px' } }, '')
                                        )
                                    );

                                    items.forEach((t) => {
                                        const info = parseTransferText(t.text);

                                        let timeFrom = '';
                                        let timeTo = '';

                                        if (t._displayStartTs != null) {
                                            const startFmt = formatTsLocal(t._displayStartTs);
                                            const startTimeMatch = startFmt ? /(\d{2}:\d{2})$/.exec(startFmt) : null;
                                            if (startTimeMatch) timeFrom = startTimeMatch[1];
                                        }
                                        if (t._displayEndTs != null) {
                                            const endFmt = formatTsLocal(t._displayEndTs);
                                            const endTimeMatch = endFmt ? /(\d{2}:\d{2})$/.exec(endFmt) : null;
                                            if (endTimeMatch) timeTo = endTimeMatch[1];
                                        }
                                        const placeFrom = info?.from || t._displayFromLocation || '';
                                        const placeTo = info?.to || t._displayToLocation || '';
                                        const textColor = getCategoryTextColor(t.category);
                                        const remainingMinutes = t._displayRemainingMinutes;
                                        elements.push(
                                            React.createElement(
                                                'tr',
                                                { key: t.key, className: 'hover:bg-gray-50' },
                                                React.createElement(
                                                    'td',
                                                    { className: 'border border-gray-300 p-1 text-center text-sm font-semibold text-blue-700' },
                                                    timeFrom || '—'
                                                ),
                                                React.createElement(
                                                    'td',
                                                    { className: 'border border-gray-300 p-1 text-center text-sm font-semibold text-blue-700' },
                                                    timeTo || '—'
                                                ),
                                                React.createElement(
                                                    'td',
                                                    { className: 'border border-gray-300 p-1 text-sm text-gray-800' },
                                                    placeFrom || '—'
                                                ),
                                                React.createElement(
                                                    'td',
                                                    { className: 'border border-gray-300 p-1 text-sm text-gray-800' },
                                                    placeTo || '—'
                                                ),
                                                React.createElement(
                                                    'td',
                                                    {
                                                        className: 'border border-gray-300 p-1 text-sm font-semibold align-middle whitespace-nowrap',
                                                        style: { color: textColor }
                                                    },
                                                    (() => {
                                                        const shortcut = getTeamShortcut(t.category, t.teamName);
                                                        return shortcut || t.teamName || '(neznámy tím)';
                                                    })()
                                                ),
                                                React.createElement(
                                                    'td',
                                                    {
                                                        className: 'border border-gray-300 p-1 text-center text-xs font-semibold',
                                                        style: { color: remainingMinutes != null ? '#b45309' : '#9ca3af' },
                                                        title: 'Zvyšný čas na presun (od konca predchádzajúceho busu po začiatok nasledujúceho busu)'
                                                    },
                                                    remainingMinutes != null ? `${remainingMinutes}` : '—'
                                                ),
                                                React.createElement(
                                                    'td',
                                                    { className: 'border border-gray-300 p-1 text-center' },
                                                    React.createElement(
                                                        'button',
                                                        {
                                                            type: 'button',
                                                            onClick: () => setRemoveWalkingModal({ transfer: t }),
                                                            title: 'Odstrániť príznak „peši" (presun sa vráti medzi vygenerované)',
                                                            className: 'text-red-600 hover:text-red-800 hover:bg-red-50 rounded w-7 h-7 inline-flex items-center justify-center'
                                                        },
                                                        React.createElement('i', { className: 'fa-solid fa-xmark' })
                                                    )
                                                )
                                            )
                                        );
                                    });
                                });

                                return elements;
                            })()
                        )
                    )
                )
        );
    };    
    return React.createElement(
        'div',
        { className: 'w-full flex-1 flex flex-col' },
        missingTravelTimeWarning.length > 0 &&
            React.createElement(
                'div',
                {
                    className: 'fixed top-0 left-0 right-0 z-[99999] bg-red-600 text-white shadow-xl px-4 py-2 flex items-start gap-3',
                    role: 'alert'
                },
                React.createElement('i', {
                    className: 'fa-solid fa-triangle-exclamation text-xl mt-0.5 flex-shrink-0'
                }),
                React.createElement(
                    'div',
                    { className: 'flex-1 text-sm' },
                    React.createElement(
                        'div',
                        { className: 'font-bold mb-1' },
                        'Chýba trvanie jazdy autobusu medzi zastávkami:'
                    ),
                    React.createElement(
                        'ul',
                        { className: 'list-disc list-inside space-y-0.5' },
                        missingTravelTimeWarning.map((m, idx) =>
                            React.createElement(
                                'li',
                                { key: `${m.from}|${m.to}|${idx}` },
                                `Medzi zastávkami „${m.from}" a „${m.to}" nie je nastavené trvanie jazdy autobusu.`
                            )
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'mt-1 text-xs opacity-90 italic' },
                        'Nastavte trvanie v záložke „Nastavenia" → „Trvania jazdy medzi zastávkami".'
                    )
                )
            ),
        React.createElement(
            'div',
            {
                className: 'bg-white rounded-xl shadow-xl p-8 flex flex-col items-start justify-start w-max min-w-full transition-all duration-500'
            },
            React.createElement(
                'div',
                { className: 'w-full flex flex-col items-center mb-6' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center mb-4' }, 'Doprava')
            ),
            React.createElement(
                'div',
                { className: 'w-full flex flex-wrap items-center justify-center gap-3 mb-6' },
                React.createElement(
                    'button',
                    {
                        onClick: () => setActiveView('planovanie'),
                        className: `px-5 py-2.5 rounded-lg font-medium border-2 transition-colors duration-200 flex items-center gap-2 ${
                            activeView === 'planovanie'
                                ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                                : 'bg-white text-green-600 border-green-600 hover:bg-green-50'
                        }`
                    },
                    React.createElement('i', { className: 'fa-solid fa-calendar-days' }),
                    'Plánovanie'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => setActiveView('nastavenia'),
                        className: `px-5 py-2.5 rounded-lg font-medium border-2 transition-colors duration-200 flex items-center gap-2 ${
                            activeView === 'nastavenia'
                                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                        }`
                    },
                    React.createElement('i', { className: 'fa-solid fa-gear' }),
                    'Nastavenia'
                )
            ),
            activeView === 'planovanie' && React.createElement(
                'div',
                { className: 'w-full flex flex-wrap items-center justify-center gap-3 mb-6' },            
                React.createElement(
                    'select',
                    {
                        value: selectedBusId,
                        onChange: (e) => setSelectedBusId(e.target.value),
                        disabled: buses.length === 0,
                        className: 'px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                    },
                    React.createElement('option', { value: '' }, 'Všetky autobusy'),
                    buses.map((bus) =>
                        React.createElement(
                            'option',
                            { key: bus.id, value: bus.id },
                            bus.name
                        )
                    )
                ),            
                React.createElement(
                    'select',
                    {
                        value: selectedCategoryFilter,
                        onChange: (e) => setSelectedCategoryFilter(e.target.value),
                        disabled: getAvailableCategories().length === 0,
                        className: 'px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                    },
                    React.createElement('option', { value: '' }, 'Všetky kategórie'),
                    getAvailableCategories().map((cat) =>
                        React.createElement(
                            'option',
                            { key: cat, value: cat },
                            cat
                        )
                    )
                ),            
                React.createElement(
                    'select',
                    {
                        value: selectedDayKey,
                        onChange: (e) => setSelectedDayKey(e.target.value),
                        disabled: tournamentDays.length === 0,
                        className: 'px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                    },
                    React.createElement('option', { value: '' }, 'Všetky dni'),
                    tournamentDays.map((day) =>
                        React.createElement(
                            'option',
                            { key: day.dayKey, value: day.dayKey },
                            `${day.dayName.charAt(0).toUpperCase() + day.dayName.slice(1)} – ${day.dateLabel}`
                        )
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'w-full flex-1' },
                activeView === 'nastavenia'
                    ? React.createElement(
                        'div',
                        { className: 'w-full' },
                        React.createElement(
                            'div',
                            { className: 'flex flex-wrap items-center justify-center gap-3 mb-6' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => setSettingsTab('travelTimes'),
                                    className: `px-4 py-2 rounded-lg font-medium border-2 transition-colors duration-200 flex items-center gap-2 ${
                                        settingsTab === 'travelTimes'
                                            ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                                            : 'bg-white text-purple-600 border-purple-600 hover:bg-purple-50'
                                    }`
                                },
                                React.createElement('i', { className: 'fa-solid fa-clock' }),
                                'Trvania jazdy medzi zastávkami'
                            ),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => setSettingsTab('teamShortcuts'),
                                    className: `px-4 py-2 rounded-lg font-medium border-2 transition-colors duration-200 flex items-center gap-2 ${
                                        settingsTab === 'teamShortcuts'
                                            ? 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700'
                                            : 'bg-white text-orange-600 border-orange-600 hover:bg-orange-50'
                                    }`
                                },
                                React.createElement('i', { className: 'fa-solid fa-tag' }),
                                'Skratky názvov tímov'
                            )
                        ),
                        settingsTab === 'travelTimes'
                            ? React.createElement(
                                'div',
                                { className: 'w-full' },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center justify-between mb-4 pb-3 border-b border-gray-200' },
                                    React.createElement('h3', { className: 'text-xl font-semibold text-gray-700' }, 'Trvania jazdy medzi zastávkami'),
                                    React.createElement('span', { className: 'text-sm text-gray-500' }, `Zastávok: ${stopsList.length}`)
                                ),
                                renderTravelTimes()
                            )
                            : React.createElement(
                                'div',
                                { className: 'w-full' },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center justify-between mb-4 pb-3 border-b border-gray-200' },
                                    React.createElement('h3', { className: 'text-xl font-semibold text-gray-700' }, 'Skratky názvov tímov'),
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-gray-500' },
                                        `Definovaných skratiek: ${Object.keys(teamShortcuts).length}`
                                    )
                                ),
                                renderTeamShortcuts()
                            )
                    )
                    : renderPlanning()
            ),
        ),
        activeView === 'planovanie' && React.createElement(
            'div',
            {
                className: 'fixed bottom-8 right-8 z-[9999]',
                style: {
                    filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.2))',
                    width: '64px',
                    height: '64px'
                }
            },
            React.createElement(
                'div',
                {
                    className: 'absolute rounded-full overflow-hidden',
                    style: {
                        width: '64px',
                        height: '64px',
                        clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                        top: 0,
                        left: 0
                    }
                },
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            const cats = getAvailableCategories();
                            if (cats.length === 0) {
                                window.showGlobalNotification('Nie sú dostupné žiadne kategórie.', 'error');
                                return;
                            }
                            setShowTransferTypeModal(true);
                        },
                        className: 'w-full h-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all duration-200 outline-none ring-0 focus:outline-none focus:ring-0',
                        title: 'Vygenerovať presuny'
                    },
                    React.createElement(
                        'div',
                        {
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                height: '100%',
                                position: 'relative'
                            }
                        },
                        React.createElement('i', {
                            className: 'fa-solid fa-plus text-2xl text-white',
                            style: {
                                position: 'absolute',
                                top: '30%',
                                left: '30%',
                                transform: 'translate(-50%, -50%)'
                            }
                        })
                    )
                )
            ),
            React.createElement(
                'div',
                {
                    className: 'absolute rounded-full overflow-hidden',
                    style: {
                        width: '64px',
                        height: '64px',
                        clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                        top: 0,
                        left: 0
                    }
                },
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            const cats = getAvailableCategories();
                            if (cats.length === 0) {
                                window.showGlobalNotification('Nie sú dostupné žiadne kategórie.', 'error');
                                return;
                            }
                            setSelectedCategoryForDelete(cats[0]);
                            setShowDeleteTransfersModal(true);
                        },
                        className: 'w-full h-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-200 outline-none ring-0 focus:outline-none focus:ring-0',
                        title: 'Zmazať presuny'
                    },
                    React.createElement(
                        'div',
                        {
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                height: '100%',
                                position: 'relative'
                            }
                        },
                        React.createElement('i', {
                            className: 'fa-solid fa-minus text-2xl text-white',
                            style: {
                                position: 'absolute',
                                bottom: '30%',
                                right: '30%',
                                transform: 'translate(50%, 50%)'
                            }
                        })
                    )
                )
            )
        ),
        confirmModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => closeConfirmModal(false)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-circle-question text-blue-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Potvrdenie'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-6 whitespace-pre-line' },
                    confirmModal.message
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => closeConfirmModal(false),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => closeConfirmModal(true),
                            className: 'px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors'
                        },
                        'Potvrdiť'
                    )
                )
            )
        ),
        stopTypeModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => setStopTypeModal(null)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-bus text-blue-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Nastaviť typ zastávky'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-4 text-sm' },
                    `Zastávka: „${stopTypeModal.stop.name}"`
                ),
                React.createElement(
                    'div',
                    { className: 'space-y-2 mb-4' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            disabled: stopTypeModal.stop.isExternalArrivalStop === true,
                            onClick: async () => {
                                const stop = stopTypeModal.stop;
                                setStopTypeModal(null);
                                const ok = await askConfirm(
                                    `Nastaviť zastávku „${stop.name}" ako nástupnú/výstupnú pre externé tímy?`
                                );
                                if (!ok) return;
                                setExternalArrivalStop(stop.id);
                            },
                            className: `w-full text-left px-4 py-3 rounded-lg border-2 transition-colors flex items-center gap-3 ${
                                stopTypeModal.stop.isExternalArrivalStop === true
                                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                                    : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                            }`
                        },
                        React.createElement('i', { className: 'fa-solid fa-right-to-bracket text-amber-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Nástupná/výstupná zastávka'),
                            React.createElement(
                                'div',
                                { className: 'text-xs text-gray-500' },
                                stopTypeModal.stop.isExternalArrivalStop === true
                                    ? 'Táto zastávka je už nastavená ako nástupná/výstupná.'
                                    : 'Pre externé tímy (príchod/odchod).'
                            )
                        )
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            disabled: stopTypeModal.stop.isMeetingPointStop === true,
                            onClick: async () => {
                                const stop = stopTypeModal.stop;
                                setStopTypeModal(null);
                                const ok = await askConfirm(
                                    `Nastaviť zastávku „${stop.name}" ako miesto zrazu?`
                                );
                                if (!ok) return;
                                setMeetingPointStop(stop.id);
                            },
                            className: `w-full text-left px-4 py-3 rounded-lg border-2 transition-colors flex items-center gap-3 ${
                                stopTypeModal.stop.isMeetingPointStop === true
                                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                                    : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                            }`
                        },
                        React.createElement('i', { className: 'fa-solid fa-people-group text-emerald-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Miesto zrazu'),
                            React.createElement(
                                'div',
                                { className: 'text-xs text-gray-500' },
                                stopTypeModal.stop.isMeetingPointStop === true
                                    ? 'Táto zastávka je už nastavená ako miesto zrazu.'
                                    : 'Miesto, kde sa tím/tímy stretávajú.'
                            )
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setStopTypeModal(null),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zatvoriť'
                    )
                )
            )
        ),
        showDeleteTransfersModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => setShowDeleteTransfersModal(false)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-trash-can text-red-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Zmazať presuny'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-4 text-sm' },
                    'Vyberte kategóriu, pre ktorú sa majú zmazať všetky vygenerované presuny z databázy.'
                ),
                React.createElement(
                    'label',
                    { className: 'block text-sm font-medium text-gray-700 mb-1' },
                    'Kategória'
                ),
                React.createElement(
                    'select',
                    {
                        value: selectedCategoryForDelete,
                        onChange: (e) => setSelectedCategoryForDelete(e.target.value),
                        className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors mb-4'
                    },
                    getAvailableCategories().map((cat) =>
                        React.createElement(
                            'option',
                            { key: cat, value: cat },
                            cat
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-red-50 border border-red-200 rounded-lg' },
                    React.createElement(
                        'p',
                        { className: 'text-xs text-red-600 flex items-center gap-2' },
                        React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }),
                        'Táto akcia je nenávratná. Všetky presuny pre vybranú kategóriu budú natrvalo odstránené z databázy.'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setShowDeleteTransfersModal(false),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: async () => {
                                const cat = selectedCategoryForDelete;
                                if (!cat) {
                                    window.showGlobalNotification('Najprv vyberte kategóriu.', 'error');
                                    return;
                                }
                                await deleteTransfers({ categoryName: cat });
                                setShowDeleteTransfersModal(false);
                            },
                            className: 'px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors'
                        },
                        'Zmazať presuny'
                    )
                )
            )
        ),
        showCategoryModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => setShowCategoryModal(false)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-list-check text-green-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Vygenerovať presuny'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-4 text-sm' },
                    'Vyberte kategóriu, pre ktorú sa majú vygenerovať presuny.'
                ),
                React.createElement(
                    'label',
                    { className: 'block text-sm font-medium text-gray-700 mb-1' },
                    'Kategória'
                ),
                React.createElement(
                    'select',
                    {
                        value: selectedCategoryForTimeline,
                        onChange: (e) => setSelectedCategoryForTimeline(e.target.value),
                        className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors mb-6'
                    },
                    getAvailableCategories().map((cat) =>
                        React.createElement(
                            'option',
                            { key: cat, value: cat },
                            cat
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setShowCategoryModal(false),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: async () => {
                                const cat = selectedCategoryForTimeline;
                                if (!cat) {
                                    window.showGlobalNotification('Najprv vyberte kategóriu.', 'error');
                                    return;
                                }
                            
                                const existingForCat = savedTransfers.filter(
                                    (t) => cleanCategory(t.category || '') === cleanCategory(cat)
                                );
                            
                                if (existingForCat.length > 0) {
                                    setRegenTransfersModal({
                                        category: cat,
                                        existingCount: existingForCat.length,
                                    });
                                    setShowCategoryModal(false);
                                    return;
                                }
                            
                                timelineGenerationRequestedRef.current = true;
                                rebuildAndLogTimeline(true, cat);
                                setShowCategoryModal(false);
                                window.showGlobalNotification(
                                    `Časová os pre kategóriu ${cat} bola vygenerovaná.`,
                                    'success'
                                );
                            },
                            className: 'px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors'
                        },
                        'Vygenerovať'
                    )
                )
            )
        ),
        showTransferTypeModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                onClick: () => setShowTransferTypeModal(false)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-plus text-green-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Vyberte typ presunu'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'space-y-2 mb-4' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => {
                                setShowTransferTypeModal(false);
                                const cats = getAvailableCategories();
                                if (cats.length === 0) {
                                    window.showGlobalNotification('Nie sú dostupné žiadne kategórie.', 'error');
                                    return;
                                }
                                setSelectedCategoryForTimeline(cats[0]);
                                setShowCategoryModal(true);
                            },
                            className: 'w-full text-left px-4 py-3 rounded-lg border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-colors flex items-center gap-3'
                        },
                        React.createElement('i', { className: 'fa-solid fa-wand-magic-sparkles text-green-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Generovanie potrebných presunov'),
                            React.createElement('div', { className: 'text-xs text-gray-500' }, 'Automaticky vygeneruje presuny z časovej osi')
                        )
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => {
                                setShowTransferTypeModal(false);
                                const cats = getAvailableCategories();
                                setCustomTransferCategory(cats.length > 0 ? cats[0] : '');
                                setCustomTransferTeamName('');
                                setShowCustomTransferModal(true);
                            },
                            className: 'w-full text-left px-4 py-3 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-3'
                        },
                        React.createElement('i', { className: 'fa-solid fa-pen-to-square text-blue-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Vytvoriť vlastný presun'),
                            React.createElement('div', { className: 'text-xs text-gray-500' }, 'Manuálne zadáte trasu a čas presunu')
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setShowTransferTypeModal(false),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zrušiť'
                    )
                )
            )
        ),
        showCustomTransferModal && (() => {
            const teamsInCategory = (() => {
                const cat = cleanCategory(customTransferCategory);
                if (!cat) return [];
                const set = new Set();
                (teamsArrivalBufferRef.current || []).forEach((t) => {
                    if (cleanCategory(t.category) !== cat) return;
                    if (!t.teamName) return;
                    set.add(String(t.teamName).trim());
                });
                return [...set].sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }));
            })();        
            const teamEvents = customTransferTeamName
                ? getTeamEventsForCustomTransfer(customTransferCategory, customTransferTeamName)
                : [];        
            const arrivalTextForSelectedTeam = (() => {
                if (!customTransferCategory || !customTransferTeamName) return null;
                const cat = cleanCategory(customTransferCategory);
                const name = String(customTransferTeamName || '').trim();
                const teamInfo = (teamsArrivalBufferRef.current || []).find(
                    (t) => cleanCategory(t.category) === cat && String(t.teamName || '').trim() === name
                );
                if (!teamInfo) return null;
                const display = String(teamInfo.arrivalDisplay || '').trim();
                if (!display || display === '---') return null;
                return display;
            })();        
            return React.createElement(
                'div',
                {
                    className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100002] p-4',
                    onClick: () => setShowCustomTransferModal(false)
                },
                React.createElement(
                    'div',
                    {
                        className: 'bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto',
                        onClick: (e) => e.stopPropagation()
                    },
                    React.createElement(
                        'div',
                        { className: 'flex items-start gap-3 mb-4' },
                        React.createElement('i', {
                            className: 'fa-solid fa-pen-to-square text-blue-600 text-2xl mt-0.5'
                        }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement(
                                'h3',
                                { className: 'text-lg font-semibold text-gray-800' },
                                'Vytvoriť vlastný presun'
                            ),
                            React.createElement(
                                'p',
                                { className: 'text-xs text-gray-500 mt-0.5' },
                                'Zvoľte kategóriu a tím. Zobrazí sa zoznam udalostí tímu.'
                            )
                        )
                    ),
                    React.createElement(
                        'label',
                        { className: 'block text-sm font-medium text-gray-700 mb-1' },
                        'Kategória'
                    ),
                    React.createElement(
                        'select',
                        {
                            value: customTransferCategory,
                            onChange: (e) => {
                                setCustomTransferCategory(e.target.value);
                                setCustomTransferTeamName('');
                            },
                            className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors mb-4'
                        },
                        React.createElement('option', { value: '' }, '— vyber kategóriu —'),
                        getAvailableCategories().map((cat) =>
                            React.createElement(
                                'option',
                                { key: cat, value: cat },
                                cat
                            )
                        )
                    ),
                    React.createElement(
                        'label',
                        { className: 'block text-sm font-medium text-gray-700 mb-1' },
                        'Tím'
                    ),
                    React.createElement(
                        'select',
                        {
                            value: customTransferTeamName,
                            onChange: (e) => setCustomTransferTeamName(e.target.value),
                            disabled: !customTransferCategory || teamsInCategory.length === 0,
                            className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors mb-4 disabled:opacity-60 disabled:cursor-not-allowed'
                        },
                        React.createElement('option', { value: '' }, '— vyber tím —'),
                        teamsInCategory.map((tn) =>
                            React.createElement(
                                'option',
                                { key: tn, value: tn },
                                tn
                            )
                        )
                    ),
                    customTransferTeamName && React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement(
                            'div',
                            { className: 'text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2' },
                            React.createElement('i', { className: 'fa-solid fa-list-ul text-blue-600' }),
                            'Udalosti tímu:',
                            React.createElement(
                                'span',
                                { className: 'text-xs font-normal text-gray-500' },
                                `(${teamEvents.length})`
                            )
                        ),
                        teamEvents.length === 0
                            ? React.createElement(
                                'p',
                                { className: 'text-xs text-gray-400 italic px-1' },
                                'Tím nemá žiadne udalosti.'
                            )
                            : (() => {
                                const extractDayKey = (when) => {
                                    if (!when) return null;
                                    const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(String(when));
                                    if (!m) return null;
                                    const d = String(m[1]).padStart(2, '0');
                                    const mo = String(m[2]).padStart(2, '0');
                                    const y = m[3];
                                    return `${y}-${mo}-${d}`;
                                };        
                                const extractTimeLabel = (when) => {
                                    if (!when) return '';
                                    const s = String(when);
                                    const times = [];
                                    const regex = /(\d{1,2}):(\d{2})/g;
                                    let m;
                                    while ((m = regex.exec(s)) !== null) {
                                        times.push(`${String(m[1]).padStart(2, '0')}:${m[2]}`);
                                    }
                                    if (times.length === 0) return '';
                                    if (times.length === 1) return times[0];
                                    return `${times[0]} – ${times[1]}`;
                                };
                                const getEventMeta = (type, ev) => {
                                    switch (type) {
                                        case 'match':
                                            return { icon: 'fa-futbol', color: '#2563eb', label: 'Zápas', bg: '#eff6ff', border: '#bfdbfe', placeIcon: 'fa-location-dot' };
                                        case 'catering':
                                            return { icon: 'fa-utensils', color: '#16a34a', label: 'Stravovanie', bg: '#f0fdf4', border: '#bbf7d0', placeIcon: 'fa-location-dot' };
                                        case 'arrival':
                                            return { icon: 'fa-bus', color: '#ea580c', label: 'Príchod', bg: '#fff7ed', border: '#fed7aa', placeIcon: 'fa-location-dot' };
                                        case 'accommodation':
                                            return { icon: 'fa-bed', color: '#7c3aed', label: 'Ubytovanie', bg: '#f5f3ff', border: '#ddd6fe', placeIcon: 'fa-location-dot' };
                                        case 'transfer': {
                                            if (ev && ev._isWalking) {
                                                return { icon: 'fa-person-walking', color: '#ea580c', label: 'Presun', bg: '#fff7ed', border: '#fed7aa', placeIcon: 'fa-location-dot' };
                                            }
                                            if (ev && ev._isAssigned) {
                                                return { icon: 'fa-bus', color: '#ea580c', label: 'Presun', bg: '#fff7ed', border: '#fed7aa', placeIcon: 'fa-location-dot' };
                                            }
                                            return { icon: 'fa-bus', color: '#ea580c', label: 'Presun', bg: '#fff7ed', border: '#fed7aa', placeIcon: 'fa-location-dot' };
                                        }
                                        default:
                                            return { icon: 'fa-circle-dot', color: '#6b7280', label: 'Udalosť', bg: '#f9fafb', border: '#e5e7eb', placeIcon: 'fa-location-dot' };
                                    }
                                };
                                const extractPlaceFromEvent = (ev) => {
                                    if (!ev) return null;
                                    const text = String(ev.text || '').trim();
                                    if (!text) return null;        
                                    if (ev.type === 'match') {
                                        const idx = text.lastIndexOf('|');
                                        if (idx !== -1) {
                                            const hall = text.slice(idx + 1).trim();
                                            if (hall) return hall;
                                        }
                                        return ev.location || null;
                                    }        
                                    if (ev.type === 'catering') {
                                        const idx = text.lastIndexOf('→');
                                        if (idx !== -1) {
                                            const place = text.slice(idx + 1).trim();
                                            if (place) return place;
                                        }
                                        return ev.location || null;
                                    }        
                                    if (ev.type === 'accommodation') {
                                        const m = /^Ubytovanie:\s*(.+?)(?:\s*\(typ:.*\))?$/i.exec(text);
                                        if (m && m[1]) return m[1].trim();
                                        return ev.location || null;
                                    }        
                                    return ev.location || null;
                                };        
                                const extractMealTypeLabel = (ev) => {
                                    if (!ev || ev.type !== 'catering') return null;
                                    const raw = String(ev.text || '').trim();
                                    if (!raw) return null;
                                    let s = raw;
                                    const arrowIdx = s.lastIndexOf('→');
                                    if (arrowIdx !== -1) s = s.slice(0, arrowIdx).trim();
                                    s = s.replace(/\s*\(\s*\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?\s*\)\s*$/, '').trim();
                                    return s || null;
                                };        
                                const extractPlacesForTransferEvent = (ev) => {
                                    if (!ev || ev.type !== 'transfer') return [];
                                    const places = [];                                
                                    if (ev._isWalking === true) {
                                        const fromLoc = String(ev._fromLocation || '').trim();
                                        const toLoc = String(ev._toLocation || '').trim();
                                        if (fromLoc) places.push(fromLoc);
                                        if (toLoc) places.push(toLoc);
                                        return places;
                                    }                                
                                    const isAssignedToBus = ev._isAssigned === true;
                                    if (isAssignedToBus) {
                                        const fromLoc = String(ev._fromLocation || '').trim();
                                        const toLoc = String(ev._toLocation || '').trim();
                                        if (fromLoc) places.push(fromLoc);
                                        if (toLoc) places.push(toLoc);
                                        return places;
                                    }
                                    const routePlaces = Array.isArray(ev._routePlaces) ? ev._routePlaces : [];
                                    if (routePlaces.length > 0) {
                                        routePlaces.forEach((p) => {
                                            const v = String(p || '').trim();
                                            if (v) places.push(v);
                                        });
                                        return places;
                                    }                                
                                    const fromLoc = String(ev._fromLocation || '').trim();
                                    const toLoc = String(ev._toLocation || '').trim();
                                    if (fromLoc) places.push(fromLoc);
                                    if (toLoc) places.push(toLoc);
                                    return places;
                                };        
                                const buildEventDescription = (ev) => {
                                    if (!ev) return '';
                                    const raw = String(ev.text || '').trim();        
                                    if (ev.type === 'match') {
                                        const idx = raw.lastIndexOf('|');
                                        if (idx !== -1) return raw.slice(0, idx).trim();
                                        return raw;
                                    }        
                                    if (ev.type === 'catering') {
                                        let s = raw;
                                        const arrowIdx = s.lastIndexOf('→');
                                        if (arrowIdx !== -1) s = s.slice(0, arrowIdx).trim();        
                                        s = s.replace(/\s*\(\s*\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?\s*\)\s*$/, '').trim();        
                                        return s;
                                    }        
                                    if (ev.type === 'accommodation') {
                                        const m = /^Ubytovanie:\s*(.+?)\s*\(typ:\s*(.+?)\)\s*$/i.exec(raw);
                                        if (m) {
                                            return `Ubytovanie (typ: ${m[2].trim()})`;
                                        }
                                        const m2 = /^Ubytovanie:\s*(.+)$/i.exec(raw);
                                        if (m2) {
                                            const typMatch = /\(typ:\s*(.+?)\)/i.exec(m2[1]);
                                            if (typMatch) {
                                                return `Ubytovanie (typ: ${typMatch[1].trim()})`;
                                            }
                                            return 'Ubytovanie';
                                        }
                                        return raw;
                                    }        
                                    return raw;
                                };        
                                const parseMatchTeams = (ev) => {
                                    if (!ev || ev.type !== 'match') return null;
                                    const raw = String(ev.text || '').trim();
                                    let s = raw;
                                    const pipeIdx = s.lastIndexOf('|');
                                    if (pipeIdx !== -1) s = s.slice(0, pipeIdx).trim();        
                                    const vsMatch = /\s+vs\.?\s+/i.exec(s);
                                    if (!vsMatch) return null;        
                                    const home = s.slice(0, vsMatch.index).trim();
                                    const away = s.slice(vsMatch.index + vsMatch[0].length).trim();
                                    return { home, away };
                                };        
                                const groups = new Map();
                                const order = [];
                                teamEvents.forEach((ev) => {
                                    const dk = ev._dayKey || extractDayKey(ev.when) || '__none__';
                                    if (!groups.has(dk)) {
                                        groups.set(dk, []);
                                        order.push(dk);
                                    }
                                    groups.get(dk).push(ev);
                                });
                                return React.createElement(
                                    'div',
                                    {
                                        className: 'bg-gray-50 border border-gray-200 rounded-lg p-2 max-h-[340px] overflow-y-auto'
                                    },
                                    order.map((dk) => {
                                        const items = groups.get(dk) || [];
                                        const dayLabel = dk !== '__none__'
                                            ? (formatDateDDMMYYYY(dk) || dk)
                                            : 'Bez dátumu';
                                        const isFirstDayGroup = dk === order[0];        
                                        return React.createElement(
                                            'div',
                                            { key: dk, className: 'mb-2 last:mb-0' },
                                            React.createElement(
                                                'div',
                                                {
                                                    className: 'flex items-center gap-2 px-2 py-1 mb-1 rounded bg-gray-200/70'
                                                },
                                                React.createElement('i', { className: 'fa-regular fa-calendar text-gray-600 text-xs' }),
                                                React.createElement(
                                                    'span',
                                                    { className: 'text-xs font-bold text-gray-700' },
                                                    dayLabel
                                                ),
                                                React.createElement(
                                                    'span',
                                                    { className: 'text-[10px] text-gray-500 ml-2' },
                                                    `${items.length} udalostí`
                                                ),
                                                React.createElement(
                                                    'span',
                                                    {
                                                        className: 'ml-auto text-[10px] font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1'
                                                    },
                                                    React.createElement('i', { className: 'fa-solid fa-location-dot' }),
                                                    'Miesto'
                                                )
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'space-y-1' },
                                                isFirstDayGroup && arrivalTextForSelectedTeam &&
                                                    React.createElement(
                                                        'div',
                                                        {
                                                            className: 'flex items-start gap-2 px-2 py-1.5 rounded border text-xs',
                                                            style: {
                                                                backgroundColor: '#fff7ed',
                                                                borderColor: '#fed7aa',
                                                            },
                                                            title: `Príchod: ${arrivalTextForSelectedTeam}`
                                                        },
                                                        React.createElement(
                                                            'div',
                                                            {
                                                                className: 'flex flex-col items-center justify-start flex-shrink-0 pt-0.5',
                                                                style: { width: '54px', minWidth: '54px' }
                                                            },
                                                            React.createElement(
                                                                'div',
                                                                {
                                                                    className: 'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                                                                    style: {
                                                                        backgroundColor: '#ea580c22',
                                                                        color: '#ea580c',
                                                                    }
                                                                },
                                                                React.createElement('i', { className: 'fa-solid fa-bus text-[11px]' })
                                                            ),
                                                            React.createElement(
                                                                'span',
                                                                {
                                                                    className: 'text-[9px] font-semibold mt-0.5 text-center leading-tight',
                                                                    style: { color: '#ea580c' }
                                                                },
                                                                'Príchod'
                                                            )
                                                        ),
                                                        React.createElement(
                                                            'div',
                                                            {
                                                                className: 'flex-1 flex items-center justify-center pt-0.5',
                                                                style: { minWidth: 0, color: '#000000' }
                                                            },
                                                            React.createElement(
                                                                'span',
                                                                {
                                                                    className: 'text-[11px] font-semibold text-center px-1.5 py-0.5 rounded',
                                                                    style: {
                                                                        color: '#000000',
                                                                        backgroundColor: '#fed7aa66',
                                                                        maxWidth: '100%',
                                                                        whiteSpace: 'normal',
                                                                    }
                                                                },
                                                                arrivalTextForSelectedTeam
                                                            )
                                                        )
                                                    ),
                                                items.map((ev, idx) => {
                                                    const meta = getEventMeta(ev.type, ev);
                                                    const timeLabel = extractTimeLabel(ev.when);
                                                    const text = buildEventDescription(ev);        
                                                    const isTransferEvent = ev.type === 'transfer';
                                                    const isCateringEvent = ev.type === 'catering';
                                                    const transferPlaces = isTransferEvent ? extractPlacesForTransferEvent(ev) : [];
                                                    const placeName = !isTransferEvent ? extractPlaceFromEvent(ev) : null;
                                                    const hasAnyPlace = isTransferEvent
                                                        ? transferPlaces.length > 0
                                                        : !!placeName;        
                                                    const mealTypeLabel = isCateringEvent ? extractMealTypeLabel(ev) : null;        
                                                    const textColor = isTransferEvent ? '#ea580c' : '#1f2937';
                                                    const metaTextColor = isTransferEvent ? '#ea580c' : meta.color;        
                                                    const matchTeamsForRow = ev.type === 'match' ? parseMatchTeams(ev) : null;        
                                                    return React.createElement(
                                                        'div',
                                                        {
                                                            key: `${dk}-${idx}`,
                                                            className: 'flex items-start gap-2 px-2 py-1.5 rounded border text-xs',
                                                            style: {
                                                                backgroundColor: meta.bg,
                                                                borderColor: meta.border,
                                                            },
                                                            title: `${meta.label}: ${text}`
                                                        },
                                                        React.createElement(
                                                            'div',
                                                            {
                                                                className: 'flex flex-col items-center justify-start flex-shrink-0 pt-0.5',
                                                                style: { width: '54px', minWidth: '54px' }
                                                            },
                                                            React.createElement(
                                                                'div',
                                                                {
                                                                    className: 'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                                                                    style: {
                                                                        backgroundColor: isTransferEvent ? '#ea580c22' : meta.color + '22',
                                                                        color: metaTextColor,
                                                                    }
                                                                },
                                                                React.createElement('i', { className: `fa-solid ${meta.icon} text-[11px]` })
                                                            ),
                                                            React.createElement(
                                                                'span',
                                                                {
                                                                    className: 'text-[9px] font-semibold mt-0.5 text-center leading-tight',
                                                                    style: { color: metaTextColor }
                                                                },
                                                                meta.label
                                                            )
                                                        ),
                                                        timeLabel
                                                            ? React.createElement(
                                                                'div',
                                                                {
                                                                    className: 'flex-shrink-0 font-mono font-semibold pt-0.5 whitespace-nowrap text-center',
                                                                    style: {
                                                                        width: '84px',
                                                                        minWidth: '84px',
                                                                        color: textColor,
                                                                    }
                                                                },
                                                                timeLabel
                                                            )
                                                            : React.createElement(
                                                                'div',
                                                                {
                                                                    className: 'flex-shrink-0 pt-0.5',
                                                                    style: { width: '84px', minWidth: '84px' }
                                                                }
                                                            ),
                                                        React.createElement(
                                                            'div',
                                                            {
                                                                className: 'flex-1 flex items-start gap-2 pt-0.5',
                                                                style: { minWidth: 0, color: textColor },
                                                            },
                                                            (() => {
                                                                if (ev.type === 'match') {
                                                                    const teams = matchTeamsForRow;
                                                                    if (teams) {
                                                                        const selectedTeam = String(customTransferTeamName || '').trim();
                                                                        const isHomeSelected = teams.home === selectedTeam;
                                                                        const isAwaySelected = teams.away === selectedTeam;        
                                                                        const hallName = (() => {
                                                                            const raw = String(ev.text || '').trim();
                                                                            const idx = raw.lastIndexOf('|');
                                                                            if (idx !== -1) {
                                                                                const hall = raw.slice(idx + 1).trim();
                                                                                if (hall) return hall;
                                                                            }
                                                                            return ev.location || null;
                                                                        })();        
                                                                        return React.createElement(
                                                                            React.Fragment,
                                                                            null,
                                                                            React.createElement(
                                                                                'div',
                                                                                {
                                                                                    className: 'flex-1 text-right truncate',
                                                                                    style: {
                                                                                        fontWeight: isHomeSelected ? '700' : '400',
                                                                                        minWidth: 0,
                                                                                    },
                                                                                    title: teams.home,
                                                                                },
                                                                                teams.home
                                                                            ),
                                                                            React.createElement(
                                                                                'div',
                                                                                {
                                                                                    className: 'flex-1 text-left truncate',
                                                                                    style: {
                                                                                        fontWeight: isAwaySelected ? '700' : '400',
                                                                                        minWidth: 0,
                                                                                    },
                                                                                    title: teams.away,
                                                                                },
                                                                                teams.away
                                                                            ),
                                                                            hallName &&
                                                                                React.createElement(
                                                                                    'span',
                                                                                    {
                                                                                        className: 'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0',
                                                                                        style: {
                                                                                            color: '#1f2937',
                                                                                            backgroundColor: meta.color + '11',
                                                                                            maxWidth: '140px',
                                                                                        },
                                                                                        title: hallName,
                                                                                    },
                                                                                    React.createElement(
                                                                                        'span',
                                                                                        { className: 'truncate', style: { maxWidth: '140px' } },
                                                                                        hallName
                                                                                    )
                                                                                )
                                                                        );
                                                                    }
                                                                }
                                                                if (isCateringEvent) {
                                                                    return React.createElement(
                                                                        'div',
                                                                        {
                                                                            className: 'flex-1 flex items-center justify-center relative',
                                                                            style: { minWidth: 0 }
                                                                        },
                                                                        mealTypeLabel &&
                                                                            React.createElement(
                                                                                'span',
                                                                                {
                                                                                    className: 'inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded',
                                                                                    style: {
                                                                                        backgroundColor: '#bbf7d0',
                                                                                        color: '#15803d',
                                                                                        maxWidth: '160px',
                                                                                    },
                                                                                    title: `Typ stravovania: ${mealTypeLabel}`
                                                                                },
                                                                                React.createElement(
                                                                                    'span',
                                                                                    { className: 'truncate', style: { maxWidth: '160px' } },
                                                                                    mealTypeLabel
                                                                                )
                                                                            ),
                                                                        hasAnyPlace &&
                                                                            React.createElement(
                                                                                'span',
                                                                                {
                                                                                    className: 'inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded',
                                                                                    style: {
                                                                                        position: 'absolute',
                                                                                        right: 0,
                                                                                        transform: 'translateY(20%)',
                                                                                        color: '#1f2937',
                                                                                        backgroundColor: meta.color + '11',
                                                                                        maxWidth: '220px',
                                                                                    },
                                                                                    title: placeName || ''
                                                                                },
                                                                                React.createElement(
                                                                                    'span',
                                                                                    { className: 'truncate', style: { maxWidth: '220px' } },
                                                                                    placeName
                                                                                )
                                                                            )
                                                                    );
                                                                }
                                                                if (ev.type === 'transfer') {
                                                                    const places = extractPlacesForTransferEvent(ev);                                                                
                                                                    return React.createElement(
                                                                        'div',
                                                                        {
                                                                            className: 'flex-1 flex items-center justify-center relative',
                                                                            style: { minWidth: 0 }
                                                                        },
                                                                        React.createElement(
                                                                            'div',
                                                                            {
                                                                                className: 'flex items-center justify-center gap-1',
                                                                                style: { minWidth: 0 }
                                                                            },
                                                                            ev._busName &&
                                                                                React.createElement(
                                                                                    'span',
                                                                                    {
                                                                                        className: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold',
                                                                                        style: { backgroundColor: '#fed7aa', color: '#9a3412' },
                                                                                        title: 'Priradené k autobusu'
                                                                                    },
                                                                                    React.createElement('i', { className: 'fa-solid fa-bus text-[9px]' }),
                                                                                    ev._busName
                                                                                ),
                                                                            ev._isWalking &&
                                                                                React.createElement(
                                                                                    'span',
                                                                                    {
                                                                                        className: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold',
                                                                                        style: { backgroundColor: '#fed7aa', color: '#9a3412' },
                                                                                        title: 'Peší presun'
                                                                                    },
                                                                                    React.createElement('i', { className: 'fa-solid fa-person-walking text-[9px]' }),
                                                                                    'PEŠI'
                                                                                ),
                                                                            !ev._isWalking && !ev._isAssigned &&
                                                                                React.createElement(
                                                                                    'span',
                                                                                    {
                                                                                        className: 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold',
                                                                                        style: { backgroundColor: '#fef3c7', color: '#92400e' },
                                                                                    },
                                                                                    'nepriradený'
                                                                                )
                                                                        ),
                                                                        places.length > 0 &&
                                                                            React.createElement(
                                                                                'div',
                                                                                {
                                                                                    className: 'flex flex-col items-end gap-0.5',
                                                                                    style: {
                                                                                        position: 'absolute',
                                                                                        right: 0,
                                                                                        transform: 'translateY(20%)',
                                                                                        minWidth: 0,
                                                                                        maxWidth: '220px',
                                                                                    }
                                                                                },
                                                                                places.map((place, placeIdx) =>
                                                                                    React.createElement(
                                                                                        'span',
                                                                                        {
                                                                                            key: `place-${placeIdx}`,
                                                                                            className: 'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded',
                                                                                            style: {
                                                                                                color: '#1f2937',
                                                                                                backgroundColor: '#fed7aa66',
                                                                                                maxWidth: '220px',
                                                                                            },
                                                                                            title: place,
                                                                                        },
                                                                                        React.createElement(
                                                                                            'span',
                                                                                            { className: 'truncate', style: { maxWidth: '220px' } },
                                                                                            place
                                                                                        )
                                                                                    )
                                                                                )
                                                                            )
                                                                    );
                                                                }
                                                                return React.createElement(
                                                                    'div',
                                                                    {
                                                                        className: 'flex-1 flex items-center justify-end gap-2',
                                                                        style: { minWidth: 0 }
                                                                    },
                                                                    hasAnyPlace
                                                                        ? React.createElement(
                                                                            'span',
                                                                            {
                                                                                className: 'inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0',
                                                                                style: {
                                                                                    color: '#1f2937',
                                                                                    backgroundColor: meta.color + '11',
                                                                                    maxWidth: '220px',
                                                                                },
                                                                                title: placeName || ''
                                                                            },
                                                                            React.createElement(
                                                                                'span',
                                                                                { className: 'truncate', style: { maxWidth: '220px' } },
                                                                                placeName
                                                                            )
                                                                        )
                                                                        : React.createElement(
                                                                            'span',
                                                                            { className: 'text-[11px] italic', style: { color: '#9ca3af' } },
                                                                            '—'
                                                                        )
                                                                );
                                                            })()
                                                        ),
                                                    );
                                                })
                                            )
                                        );
                                    })
                                );
                            })()
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex justify-end gap-3' },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => {
                                    setShowCustomTransferModal(false);
                                },
                                className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                            },
                            'Zatvoriť'
                        )
                    )
                )
            );
        })(),
        editingTransfer && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => {
                    setEditingTransfer(null);
                    setEditingTransferStops([]);
                }
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-route text-blue-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        React.createElement(
                            'h3',
                            { className: 'text-lg font-semibold text-gray-800' },
                            'Upraviť presun'
                        )
                    )
                ),
                (() => {
                    const tr = editingTransfer;
                    const parentKeyForTotal = tr._parentKey || tr.key;
                    const parentRecForTotal = savedTransfersRef.current.find((s) => s.key === parentKeyForTotal);

                    try {
                        console.log('%c[TRANSPORT][MODAL:editingTransfer] Otvorené', 'color:#2563eb;font-weight:bold;', {
                            transfer: tr,
                            editingTransferStops: Array.isArray(editingTransferStops) ? [...editingTransferStops] : null,
                            parentKeyForTotal,
                            parentRecForTotal: parentRecForTotal || null,
                            parentWhen: parentRecForTotal ? parentRecForTotal.when : null,
                            parentFromId: parentRecForTotal ? parentRecForTotal.fromId : null,
                            parentFromName: parentRecForTotal ? resolvePlaceNameById(parentRecForTotal.fromId) : null,
                            parentToId: parentRecForTotal ? parentRecForTotal.toId : null,
                            parentToName: parentRecForTotal ? resolvePlaceNameById(parentRecForTotal.toId) : null,
                            parentDayKey: parentRecForTotal ? parentRecForTotal.dayKey : null,
                            parentIntermediateStopIds: parentRecForTotal ? (parentRecForTotal.intermediateStopIds || []) : null,
                            parentIntermediateStops: parentRecForTotal ? (parentRecForTotal.intermediateStopIds || []).map((id) => resolvePlaceNameById(id)) : null,
                            parentSegments: parentRecForTotal ? (parentRecForTotal.segments || []).map((s, i) => ({
                                idx: i,
                                fromId: s.fromId,
                                toId: s.toId,
                                fromName: resolvePlaceNameById(s.fromId),
                                toName: resolvePlaceNameById(s.toId),
                                startTs: s.startTs,
                                endTs: s.endTs,
                                startTime: s.startTs != null ? formatTsLocal(s.startTs) : null,
                                endTime: s.endTs != null ? formatTsLocal(s.endTs) : null,
                                when: s.when,
                                isWalking: s.isWalking === true,
                                busAssigned: s.busAssigned === true,
                                busId: s.busId || null,
                                busName: s.busId ? (buses.find((b) => b.id === s.busId)?.name || null) : null,
                                boardingRowId: s.boardingRowId || null,
                                alightingRowId: s.alightingRowId || null,
                                walkingSetAt: s.walkingSetAt || null,
                                walkingSetBy: s.walkingSetBy || null,
                            })) : null,
                        });
                    } catch (e) {
                        console.warn('[TRANSPORT][MODAL:editingTransfer] log error:', e);
                    }
                    
                    let totalWhenLabel = null;
                    
                    // 1) Priorita: parent.when z DB – to je celkový čas presunu, ktorý sa uložil pri generovaní
                    if (parentRecForTotal && parentRecForTotal.when && String(parentRecForTotal.when).trim() !== '') {
                        totalWhenLabel = String(parentRecForTotal.when).trim();
                    }
                    
                    // 2) Fallback: tr.when (ak parent nemá when)
                    if (!totalWhenLabel && tr.when && String(tr.when).trim() !== '') {
                        totalWhenLabel = String(tr.when).trim();
                    }
                    
                    // 3) Fallback: spočítaj min/max zo VŠETKÝCH segmentov (aj z tých, ktoré nemajú startTs/endTs,
                    //    cez computeProvisionalSegmentRange), aby to pokrylo celý presun
                    if (!totalWhenLabel && parentRecForTotal && Array.isArray(parentRecForTotal.segments) && parentRecForTotal.segments.length > 0) {
                        let earliestStart = null;
                        let latestEnd = null;
                    
                        parentRecForTotal.segments.forEach((s) => {
                            let segStartTs = s.startTs != null ? s.startTs : null;
                            let segEndTs = s.endTs != null ? s.endTs : null;
                    
                            if (segStartTs == null && segEndTs == null) {
                                try {
                                    const provisional = computeProvisionalSegmentRange({
                                        ...parentRecForTotal,
                                        fromId: s.fromId,
                                        toId: s.toId,
                                        _parentKey: parentKeyForTotal,
                                    });
                                    if (provisional) {
                                        if (provisional.startTs != null) segStartTs = provisional.startTs;
                                        if (provisional.endTs != null) segEndTs = provisional.endTs;
                                    }
                                } catch (e) { /* ignore */ }
                            }
                    
                            if (segStartTs != null && (earliestStart == null || segStartTs < earliestStart)) {
                                earliestStart = segStartTs;
                            }
                            if (segEndTs != null && (latestEnd == null || segEndTs > latestEnd)) {
                                latestEnd = segEndTs;
                            }
                        });
                    
                        if (earliestStart != null && latestEnd != null) {
                            totalWhenLabel = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                        } else if (earliestStart != null) {
                            totalWhenLabel = formatTsLocal(earliestStart);
                        } else if (latestEnd != null) {
                            totalWhenLabel = formatTsLocal(latestEnd);
                        }
                    }
                    
                    // 4) Fallback: tr.segments (ak by parent nemal segments)
                    if (!totalWhenLabel && Array.isArray(tr.segments) && tr.segments.length > 0) {
                        let earliestStart = null;
                        let latestEnd = null;
                        tr.segments.forEach((s) => {
                            if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                                earliestStart = s.startTs;
                            }
                            if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                                latestEnd = s.endTs;
                            }
                        });
                        if (earliestStart != null && latestEnd != null) {
                            totalWhenLabel = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                        } else if (earliestStart != null) {
                            totalWhenLabel = formatTsLocal(earliestStart);
                        } else if (latestEnd != null) {
                            totalWhenLabel = formatTsLocal(latestEnd);
                        }
                    }
                    
                    // 5) Fallback: provizórny výpočet pre celý parent
                    if (!totalWhenLabel) {
                        const provisionalForTotal = computeProvisionalSegmentRange({
                            ...tr,
                            _parentKey: parentKeyForTotal,
                        });
                        if (provisionalForTotal) {
                            totalWhenLabel = `${formatTsLocal(provisionalForTotal.startTs)} – ${formatTsLocal(provisionalForTotal.endTs)}`;
                        }
                    }
                                        
                    const counts = getTeamCountsForTransfer(tr.category, tr.teamName);
                    let membersCount = null;
                    let membersTitle = '';
                    if (counts) {
                        membersCount =
                            (counts.players || 0) +
                            (counts.menRT || 0) +
                            (counts.womenRT || 0) +
                            (counts.menDrivers || 0) +
                            (counts.womenDrivers || 0);
                        membersTitle = 'Počet členov tímu';
                    } else {
                        const avg = getCategoryAverageForTransfer(tr.category);
                        if (avg != null) {
                            membersCount = avg;
                            membersTitle = `Priemer členov tímu v kategórii ${tr.category} (zaokrúhlené nahor)`;
                        }
                    }
        
                    const transportColor = getTransportColorForCategory(tr.category);
                    const boxBg = transportColor ? lightenHex(transportColor, 0.15) : null;
        
                    return React.createElement(
                        'div',
                        {
                            className: 'mb-4 text-sm text-gray-700 flex flex-col leading-snug rounded-md px-3 py-2',
                            style: {
                                position: 'relative',
                                borderLeft: transportColor ? `6px solid ${transportColor}` : '2px solid #c4b5fd',
                                ...(boxBg ? { backgroundColor: boxBg } : { backgroundColor: '#f5f3ff' }),
                            },
                        },
                        tr.category &&
                            React.createElement(
                                'span',
                                {
                                    className: 'text-xs font-semibold uppercase tracking-wide mb-0.5',
                                    style: { color: transportColor || '#5b21b6', opacity: 0.8 },
                                },
                                tr.category
                            ),
                        React.createElement(
                            'div',
                            { className: 'flex flex-wrap items-center gap-x-2 gap-y-1' },
                            tr.teamName &&
                                React.createElement(
                                    'span',
                                    {
                                        className: 'text-sm font-semibold',
                                        style: { color: transportColor || '#5b21b6' },
                                        title: 'Tím',
                                    },
                                    tr.teamName
                                ),
                            membersCount != null &&
                                React.createElement(
                                    'span',
                                    {
                                        className: 'text-sm font-semibold',
                                        style: { color: transportColor || '#5b21b6' },
                                        title: membersTitle,
                                    },
                                    `• ${membersCount} členov`
                                )
                        ),
                        React.createElement(
                            'span',
                            { className: 'text-sm text-gray-900 font-medium' },
                            `${resolvePlaceNameById(tr.fromId) || '?'} → ${resolvePlaceNameById(tr.toId) || '?'}`
                        ),
                        React.createElement(
                            'span',
                            { className: 'text-sm text-gray-600 inline-flex items-center gap-1 mt-0.5' },
                            React.createElement('span', { className: 'font-semibold' }, 'Celkový čas:'),
                            React.createElement(
                                'span',
                                null,
                                totalWhenLabel || '— (čas neurčený)'
                            )
                        )
                    );
                })(),
                editingTransferStops.length > 0 && React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm' },
                    React.createElement(
                        'div',
                        { className: 'font-medium text-indigo-700 mb-1' },
                        'Medzizastávky:'
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-indigo-800' },
                        editingTransferStops.join(', ')
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'label',
                        { className: 'block text-sm font-medium text-gray-700 mb-2' },
                        'Medzizastávky (voliteľné)'
                    ),
                    editingTransferStops.length === 0 &&
                        React.createElement(
                            'p',
                            { className: 'text-xs text-gray-400 italic mb-2' },
                            'Žiadne medzizastávky. Presun pôjde priamo z „' + (resolvePlaceNameById(editingTransfer.fromId) || '?') + '" do „' + (resolvePlaceNameById(editingTransfer.toId) || '?') + '".'
                        ),
                    editingTransferStops.length > 0 &&
                        React.createElement(
                            'ul',
                            { className: 'space-y-2' },
                            editingTransferStops.map((stopValue, idx) => {
                                const selectedElsewhere = new Set(
                                    editingTransferStops
                                        .filter((_, i) => i !== idx)
                                        .map((s) => String(s || '').trim())
                                        .filter(Boolean)
                                );
                                const availableStops = stopsList.filter((s) => {
                                    if (s.name === stopValue) return true;
                                    return !selectedElsewhere.has(s.name);
                                });
                                return React.createElement(
                                    'li',
                                    {
                                        key: `stop-${idx}`,
                                        className: 'flex items-center gap-2'
                                    },
                                    React.createElement(
                                        'span',
                                        { className: 'text-xs text-gray-500 w-6 text-right' },
                                        `${idx + 1}.`
                                    ),
                                    React.createElement(
                                        'select',
                                        {
                                            value: stopValue,
                                            onChange: (e) => {
                                                const v = e.target.value;
                                                setEditingTransferStops((prev) => {
                                                    const copy = [...prev];
                                                    copy[idx] = v;
                                                    return copy;
                                                });
                                            },
                                            className: 'flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                        },
                                        React.createElement('option', { value: '' }, '— vyber zastávku —'),
                                        availableStops.map((s) =>
                                            React.createElement(
                                                'option',
                                                { key: s.id, value: s.name },
                                                s.name
                                            )
                                        )
                                    ),
                                    React.createElement(
                                        'button',
                                        {
                                            type: 'button',
                                            onClick: () => {
                                                setEditingTransferStops((prev) => {
                                                    const copy = [...prev];
                                                    copy.splice(idx + 1, 0, '');
                                                    return copy;
                                                });
                                            },
                                            className: 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded w-7 h-7 flex items-center justify-center',
                                            title: 'Vložiť medzizastávku pod tento riadok'
                                        },
                                        React.createElement('i', { className: 'fa-solid fa-plus text-xs' })
                                    ),
                                    React.createElement(
                                        'button',
                                        {
                                            type: 'button',
                                            onClick: () => {
                                                setEditingTransferStops((prev) => prev.filter((_, i) => i !== idx));
                                            },
                                            className: 'text-red-600 hover:text-red-800 hover:bg-red-50 rounded w-7 h-7 flex items-center justify-center',
                                            title: 'Odstrániť medzizastávku'
                                        },
                                        React.createElement('i', { className: 'fa-solid fa-xmark' })
                                    )
                                );
                            })
                        ),
                    editingTransferStops.length === 0 &&
                        React.createElement(
                            'div',
                            { className: 'mt-3 flex justify-center' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => setEditingTransferStops((prev) => [...prev, '']),
                                    className: 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded w-7 h-7 flex items-center justify-center',
                                    title: 'Pridať medzizastávku'
                                },
                                React.createElement('i', { className: 'fa-solid fa-plus text-xs' })
                            )
                        )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm' },
                    React.createElement(
                        'div',
                        { className: 'font-medium text-blue-700 mb-1' },
                        'Nová trasa:'
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-blue-800' },
                        [resolvePlaceNameById(editingTransfer.fromId), ...(editingTransferStops || []).filter(Boolean), resolvePlaceNameById(editingTransfer.toId)]
                            .filter(Boolean)
                            .join(' → ')
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => {
                                setEditingTransfer(null);
                                setEditingTransferStops([]);
                            },
                            disabled: editingTransferSaving,
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                        },
                        'Zrušiť'
                    ),
                    (() => {
                        const hasEmptyStop = Array.isArray(editingTransferStops) &&
                            editingTransferStops.some((s) => !String(s || '').trim());
                        const isBlocked = editingTransferSaving || hasEmptyStop;
                        const baseCls = 'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2';
                        const enabledCls = 'bg-blue-600 text-white hover:bg-blue-700';
                        const blockedCls = 'bg-white border-2 border-blue-600 text-blue-600 cursor-not-allowed';
                        return React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: saveEditedTransfer,
                                disabled: isBlocked,
                                title: hasEmptyStop
                                    ? 'Najprv vyberte medzizastávku vo všetkých selectboxoch.'
                                    : undefined,
                                className: `${baseCls} ${isBlocked ? blockedCls : enabledCls}`,
                                style: isBlocked ? { cursor: 'not-allowed' } : undefined,
                            },
                            editingTransferSaving &&
                                React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                            'Uložiť'
                        );
                    })()
                )
            )
        ),
        transferActionModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => setTransferActionModal(null)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex-1' },
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Upraviť presun'
                    )
                ),
                (() => {
                    const tr = transferActionModal.transfer;

                    try {
                        const dbgParentKey = tr._parentKey || tr.key;
                        const dbgParent = (savedTransfersRef.current || []).find((s) => s.key === dbgParentKey);
                        console.log('%c[TRANSPORT][MODAL:transferActionModal] Otvorené', 'color:#7c3aed;font-weight:bold;', {
                            transfer: tr,
                            parentKey: dbgParentKey,
                            parent: dbgParent || null,
                            parentSegments: dbgParent ? (dbgParent.segments || []).map((s, i) => ({
                                idx: i,
                                fromId: s.fromId,
                                toId: s.toId,
                                fromName: resolvePlaceNameById(s.fromId),
                                toName: resolvePlaceNameById(s.toId),
                                startTs: s.startTs,
                                endTs: s.endTs,
                                startTime: s.startTs != null ? formatTsLocal(s.startTs) : null,
                                endTime: s.endTs != null ? formatTsLocal(s.endTs) : null,
                                when: s.when,
                                isWalking: s.isWalking === true,
                                busAssigned: s.busAssigned === true,
                                busId: s.busId || null,
                                busName: s.busId ? (buses.find((b) => b.id === s.busId)?.name || null) : null,
                                boardingRowId: s.boardingRowId || null,
                                alightingRowId: s.alightingRowId || null,
                            })) : null,
                            parentWhen: dbgParent ? dbgParent.when : null,
                            parentIntermediateStopIds: dbgParent ? (dbgParent.intermediateStopIds || []) : null,
                            parentIntermediateStops: dbgParent ? (dbgParent.intermediateStopIds || []).map((id) => resolvePlaceNameById(id)) : null,
                        });
                    } catch (e) {
                        console.warn('[TRANSPORT][MODAL:transferActionModal] log error:', e);
                    }
                    
                    let displayWhen = null;
                    if (tr._parentKey) {
                        const parentRec = savedTransfersRef.current.find((s) => s.key === tr._parentKey);
                        const segFromId = tr.fromId || null;
                        const segToId = tr.toId || null;

                        const parentSeg = (() => {
                            if (!parentRec || !Array.isArray(parentRec.segments)) return null;
                            if (!segFromId || !segToId) return null;
                            const idx = findSegmentIndex(parentRec.segments, segFromId, segToId);
                            return idx !== -1 ? parentRec.segments[idx] : null;
                        })();
                        if (parentSeg && parentSeg.busId && parentSeg.boardingRowId && parentSeg.alightingRowId
                            && parentSeg.startTs != null && parentSeg.endTs != null && parentSeg.endTs > parentSeg.startTs) {
                            displayWhen = `${formatTsLocal(parentSeg.startTs)} – ${formatTsLocal(parentSeg.endTs)}`;
                        }
                        if (!displayWhen) {
                            const provisional = computeProvisionalSegmentRange(tr);
                            if (provisional) {
                                displayWhen = `${formatTsLocal(provisional.startTs)} – ${formatTsLocal(provisional.endTs)}`;
                            }
                        }
                    } else {
                        if (tr.when && String(tr.when).trim() !== '') {
                            displayWhen = tr.when;
                        }
                        if (!displayWhen && Array.isArray(tr.segments) && tr.segments.length > 0) {
                            let earliestStart = null;
                            let latestEnd = null;
                            tr.segments.forEach((s) => {
                                if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                                    earliestStart = s.startTs;
                                }
                                if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                                    latestEnd = s.endTs;
                                }
                            });
                            if (earliestStart != null && latestEnd != null) {
                                displayWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                            } else if (earliestStart != null) {
                                displayWhen = formatTsLocal(earliestStart);
                            } else if (latestEnd != null) {
                                displayWhen = formatTsLocal(latestEnd);
                            }
                        }
                        if (!displayWhen) {
                            const provisional = computeProvisionalSegmentRange(tr);
                            if (provisional) {
                                displayWhen = `${formatTsLocal(provisional.startTs)} – ${formatTsLocal(provisional.endTs)}`;
                            }
                        }
                    }                
                    const counts = getTeamCountsForTransfer(tr.category, tr.teamName);
                    let membersCount = null;
                    let membersTitle = '';
                    if (counts) {
                        membersCount =
                            (counts.players || 0) +
                            (counts.menRT || 0) +
                            (counts.womenRT || 0) +
                            (counts.menDrivers || 0) +
                            (counts.womenDrivers || 0);
                        membersTitle = 'Počet členov tímu';
                    } else {
                        const avg = getCategoryAverageForTransfer(tr.category);
                        if (avg != null) {
                            membersCount = avg;
                            membersTitle = `Priemer členov tímu v kategórii ${tr.category} (zaokrúhlené nahor)`;
                        }
                    }                
                    const transportColor = getTransportColorForCategory(tr.category);
                    const boxBg = transportColor ? lightenHex(transportColor, 0.15) : null;                
                    return React.createElement(
                        'div',
                        {
                            className: 'mb-4 text-sm text-gray-700 flex flex-col leading-snug rounded-md px-3 py-2',
                            style: {
                                position: 'relative',
                                borderLeft: transportColor ? `6px solid ${transportColor}` : '2px solid #c4b5fd',
                                ...(boxBg ? { backgroundColor: boxBg } : { backgroundColor: '#f5f3ff' }),
                            },
                        },
                        React.createElement(
                            'div',
                            { className: 'flex flex-wrap items-center gap-x-2 gap-y-1' },
                            tr.teamName &&
                                React.createElement(
                                    'span',
                                    {
                                        className: 'text-sm font-semibold',
                                        style: { color: transportColor || '#5b21b6' },
                                        title: 'Tím',
                                    },
                                    tr.teamName
                                ),
                            membersCount != null &&
                                React.createElement(
                                    'span',
                                    {
                                        className: 'text-sm font-semibold',
                                        style: { color: transportColor || '#5b21b6' },
                                        title: membersTitle,
                                    },
                                    `• ${membersCount} členov`
                                )
                        ),
                        React.createElement(
                            'span',
                            { className: 'text-sm text-gray-900 font-medium' },
                            `${resolvePlaceNameById(tr.fromId) || '?'} → ${resolvePlaceNameById(tr.toId) || '?'}`
                        ),
                        displayWhen &&
                            React.createElement(
                                'span',
                                { className: 'text-sm text-gray-600' },
                                displayWhen
                            )
                    );
                })(),
                React.createElement(
                    'div',
                    { className: 'space-y-2 mb-4' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => {
                                const t = transferActionModal.transfer;                                
                                let transferToEdit = t;
                                let existingStops = [];    
                                if (t._parentKey) {
                                    const parent = savedTransfers.find((s) => s.key === t._parentKey);
                                    if (parent) {
                                        transferToEdit = {
                                            ...parent,
                                            _parentKey: undefined,
                                        };
                                        if (Array.isArray(parent.intermediateStops)) {
                                            existingStops = [...parent.intermediateStops];
                                        }
                                    }
                                } else if (Array.isArray(t.intermediateStops)) {
                                    existingStops = [...t.intermediateStops];
                                }    
                                setEditingTransfer(transferToEdit);
                                setEditingTransferStops(existingStops);
                                setTransferActionModal(null);
                            },
                            className: 'w-full text-left px-4 py-3 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-3'
                        },
                        React.createElement('i', { className: 'fa-solid fa-route text-blue-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Upraviť presun'),
                            React.createElement('div', { className: 'text-xs text-gray-500' }, 'Rozdeliť trasu na viac segmentov')
                        )
                    ),
                    (() => {
                        const matchingBusRows = findMatchingBusRows(transferActionModal.transfer);

                        // Ak neexistuje žiadny vhodný riadok busu, tlačidlo sa vôbec nezobrazí.
                        const hasMatches = Array.isArray(matchingBusRows) && matchingBusRows.length > 0;

                        if (!hasMatches) {
                            return null;
                        }

                        return React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => {
                                    const transferToAssign = transferActionModal.transfer;
                                    // Pri kliknutí znova prepočítame matches, aby sme mali aktuálne dáta
                                    const matches = findMatchingBusRows(transferToAssign);
                                    setAssignBusMatches(matches);
                                    setAssignBusSelectedKey('');
                                    setAssignBusTransfer(transferToAssign);
                                    setTransferActionModal(null);
                                    setShowAssignBusModal(true);
                                },
                                className: 'w-full text-left px-4 py-3 rounded-lg border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center gap-3'
                            },
                            React.createElement('i', { className: 'fa-solid fa-bus text-amber-600 text-xl w-6 text-center' }),
                            React.createElement(
                                'div',
                                { className: 'flex-1' },
                                React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Priradiť presun autobusu'),
                                React.createElement('div', { className: 'text-xs text-gray-500' }, 'Vytvoriť riadok v plánovaní autobusu')
                            )
                        );
                    })(),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setTransferAsWalking(transferActionModal.transfer),
                            className: 'w-full text-left px-4 py-3 rounded-lg border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center gap-3'
                        },
                        React.createElement('i', { className: 'fa-solid fa-person-walking text-emerald-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Nastaviť presun peši'),
                            React.createElement('div', { className: 'text-xs text-gray-500' }, 'Označiť, že tím ide peši')
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setTransferActionModal(null),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zatvoriť'
                    )
                )
            )
        ),
        showAssignBusModal && assignBusTransfer && (() => {
            const parentKey = assignBusTransfer._parentKey || assignBusTransfer.key;
            const currentParent = savedTransfers.find((s) => s.key === parentKey);

            try {
                console.log('%c[TRANSPORT][MODAL:showAssignBusModal] Otvorené', 'color:#ea580c;font-weight:bold;', {
                    assignBusTransfer,
                    parentKey,
                    currentParent: currentParent || null,
                    currentParentWhen: currentParent ? currentParent.when : null,
                    currentParentSegments: currentParent ? (currentParent.segments || []).map((s, i) => ({
                        idx: i,
                        fromId: s.fromId,
                        toId: s.toId,
                        fromName: resolvePlaceNameById(s.fromId),
                        toName: resolvePlaceNameById(s.toId),
                        startTs: s.startTs,
                        endTs: s.endTs,
                        startTime: s.startTs != null ? formatTsLocal(s.startTs) : null,
                        endTime: s.endTs != null ? formatTsLocal(s.endTs) : null,
                        when: s.when,
                        isWalking: s.isWalking === true,
                        busAssigned: s.busAssigned === true,
                        busId: s.busId || null,
                        busName: s.busId ? (buses.find((b) => b.id === s.busId)?.name || null) : null,
                        boardingRowId: s.boardingRowId || null,
                        alightingRowId: s.alightingRowId || null,
                    })) : null,
                    assignBusMatches: Array.isArray(assignBusMatches) ? assignBusMatches.map((m) => ({
                        busId: m?.bus?.id || null,
                        busName: m?.bus?.name || null,
                        boardingRowId: m?.boardingRow?.id || null,
                        boardingRowIdFull: m?.boardingRow?.rowId || null,
                        boardingTime: m?.boardingTime || null,
                        alightingRowId: m?.alightingRow?.id || null,
                        alightingRowIdFull: m?.alightingRow?.rowId || null,
                        alightingTime: m?.alightingTime || null,
                        side: m?.side || null,
                    })) : null,
                    assignBusSelectedKey: assignBusSelectedKey || null,
                    busesCount: (buses || []).length,
                    busRowsKeys: Object.keys(busRows || {}),
                });
            } catch (e) {
                console.warn('[TRANSPORT][MODAL:showAssignBusModal] log error:', e);
            }
            
            const currentTransfer = (() => {
                if (!currentParent) return assignBusTransfer;
                if (assignBusTransfer._parentKey) {
                    const segIdx = findSegmentIndex(
                        currentParent.segments || [],
                        assignBusTransfer.fromId,
                        assignBusTransfer.toId
                    );
                    const seg = segIdx !== -1 ? currentParent.segments[segIdx] : null;
                    return {
                        ...assignBusTransfer,
                        segments: currentParent.segments,
                        isWalking: seg ? seg.isWalking === true : false,
                    };
                }
                return {
                    ...assignBusTransfer,
                    segments: currentParent.segments,
                };
            })();        
            return React.createElement(
                'div',
                {
                    className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                    onClick: () => {
                        setShowAssignBusModal(false);
                        setAssignBusTransfer(null);
                    },
                },
                React.createElement(
                    'div',
                    {
                        className: 'bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto',
                        onClick: (e) => e.stopPropagation()
                    },
                    React.createElement(
                        'div',
                        { className: 'flex items-start gap-3 mb-4' },
                        React.createElement('i', {
                            className: 'fa-solid fa-bus text-amber-600 text-2xl mt-0.5'
                        }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement(
                                'h3',
                                { className: 'text-lg font-semibold text-gray-800' },
                                'Priradiť presun k autobusu'
                            ),
                            React.createElement(
                                'p',
                                { className: 'text-xs text-gray-500 mt-0.5' },
                                'Zobrazujú sa len autobusy s riadkom, ktorý zodpovedá trase a času presunu.'
                            )
                        )
                    ),
                    (() => {
                        const tr = currentTransfer;
                        let displayWhen = null;
                        if (tr._parentKey) {
                            const parentRec = savedTransfersRef.current.find((s) => s.key === tr._parentKey);
                            const segFromId = tr.fromId || null;
                            const segToId = tr.toId || null;

                            const parentSeg = (() => {
                                if (!parentRec || !Array.isArray(parentRec.segments)) return null;
                                if (!segFromId || !segToId) return null;
                                const idx = findSegmentIndex(parentRec.segments, segFromId, segToId);
                                return idx !== -1 ? parentRec.segments[idx] : null;
                            })();
                            if (parentSeg && parentSeg.busId && parentSeg.boardingRowId && parentSeg.alightingRowId
                                && parentSeg.startTs != null && parentSeg.endTs != null && parentSeg.endTs > parentSeg.startTs) {
                                displayWhen = `${formatTsLocal(parentSeg.startTs)} – ${formatTsLocal(parentSeg.endTs)}`;
                            }
                            if (!displayWhen) {
                                const provisional = computeProvisionalSegmentRange(tr);
                                if (provisional) {
                                    displayWhen = `${formatTsLocal(provisional.startTs)} – ${formatTsLocal(provisional.endTs)}`;
                                }
                            }
                        } else {
                            if (tr.when && String(tr.when).trim() !== '') {
                                displayWhen = tr.when;
                            }
                            if (!displayWhen && Array.isArray(tr.segments) && tr.segments.length > 0) {
                                let earliestStart = null;
                                let latestEnd = null;
                                tr.segments.forEach((s) => {
                                    if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                                        earliestStart = s.startTs;
                                    }
                                    if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                                        latestEnd = s.endTs;
                                    }
                                });
                                if (earliestStart != null && latestEnd != null) {
                                    displayWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                                } else if (earliestStart != null) {
                                    displayWhen = formatTsLocal(earliestStart);
                                } else if (latestEnd != null) {
                                    displayWhen = formatTsLocal(latestEnd);
                                }
                            }

                            if (!displayWhen) {
                                const provisional = computeProvisionalSegmentRange(tr);
                                if (provisional) {
                                    displayWhen = `${formatTsLocal(provisional.startTs)} – ${formatTsLocal(provisional.endTs)}`;
                                }
                            }
                        }        
                        const counts = getTeamCountsForTransfer(tr.category, tr.teamName);
                        let membersCount = null;
                        let membersTitle = '';
                        if (counts) {
                            membersCount =
                                (counts.players || 0) +
                                (counts.menRT || 0) +
                                (counts.womenRT || 0) +
                                (counts.menDrivers || 0) +
                                (counts.womenDrivers || 0);
                            membersTitle = 'Počet členov tímu';
                        } else {
                            const avg = getCategoryAverageForTransfer(tr.category);
                            if (avg != null) {
                                membersCount = avg;
                                membersTitle = `Priemer členov tímu v kategórii ${tr.category} (zaokrúhlené nahor)`;
                            }
                        }        
                        const transportColor = getTransportColorForCategory(tr.category);
                        const boxBg = transportColor ? lightenHex(transportColor, 0.15) : null;        
                        return React.createElement(
                            'div',
                            {
                                className: 'mb-4 text-sm text-gray-700 flex flex-col leading-snug rounded-md px-3 py-2',
                                style: {
                                    position: 'relative',
                                    borderLeft: transportColor ? `6px solid ${transportColor}` : '2px solid #c4b5fd',
                                    ...(boxBg ? { backgroundColor: boxBg } : { backgroundColor: '#f5f3ff' }),
                                },
                            },
                            React.createElement(
                                'div',
                                { className: 'flex flex-wrap items-center gap-x-2 gap-y-1' },
                                tr.teamName &&
                                    React.createElement(
                                        'span',
                                        {
                                            className: 'text-sm font-semibold',
                                            style: { color: transportColor || '#5b21b6' },
                                            title: 'Tím',
                                        },
                                        tr.teamName
                                    ),
                                membersCount != null &&
                                    React.createElement(
                                        'span',
                                        {
                                            className: 'text-sm font-semibold',
                                            style: { color: transportColor || '#5b21b6' },
                                            title: membersTitle,
                                        },
                                        `• ${membersCount} členov`
                                    )
                            ),
                            React.createElement(
                                'span',
                                { className: 'text-sm text-gray-900 font-medium' },
                                `${resolvePlaceNameById(tr.fromId) || '?'} → ${resolvePlaceNameById(tr.toId) || '?'}`
                            ), 
                            displayWhen &&
                                React.createElement(
                                    'span',
                                    { className: 'text-sm text-gray-600' },
                                    displayWhen
                                )
                        );
                    })(),
                    (() => {
                        const currentMatches = findMatchingBusRows(currentTransfer);        
                        if (currentMatches.length === 0) {
                            return React.createElement(
                                'div',
                                { className: 'mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm' },
                                React.createElement(
                                    'p',
                                    { className: 'text-red-700 flex items-start gap-2' },
                                    React.createElement('i', { className: 'fa-solid fa-triangle-exclamation mt-0.5' }),
                                    React.createElement(
                                        'span',
                                        null,
                                        'Pre tento presun neexistuje žiadny autobus s trasou, ktorá by zodpovedala miestam a času presunu. ',
                                        'Najprv pridajte riadky do autobusu (v Plánovaní) tak, aby trasa autobusu obsahovala miesto odchodu a príchodu presunu.'
                                    )
                                )
                            );
                        }        
                        return React.createElement(
                            'div',
                            { className: 'mb-4' },
                            React.createElement(
                                'label',
                                { className: 'block text-sm font-medium text-gray-700 mb-2' },
                                'Vyberte autobus / trasu:'
                            ),
                            React.createElement(
                                'ul',
                                { className: 'space-y-2' },
                                currentMatches.map((m, idx) => {
                                    if (!m || !m.bus || !m.trip) {
                                        console.warn('[TRANSPORT] Neplatný výsledok v currentMatches:', m);
                                        return null;
                                    }        
                                    const key = `${m.bus.id}|${m.boardingRow?.id || ''}|${m.alightingRow?.id || ''}|${m.side}`;
                                    const isSelected = assignBusSelectedKey === key;        
                                    const hasBoarding = !!m.boardingRow;
                                    const hasAlighting = !!m.alightingRow;        
                                    const teamKey = `${currentTransfer.teamName}|${currentTransfer.category || ''}`;        
                                    return React.createElement(
                                        'li',
                                        { key },
                                        React.createElement(
                                            'button',
                                            {
                                                type: 'button',
                                                onClick: () => setAssignBusSelectedKey(key),
                                                className: `w-full text-left px-3 py-2 rounded-lg border-2 transition-colors ${
                                                    isSelected
                                                        ? 'border-amber-500 bg-amber-50'
                                                        : 'border-gray-200 bg-white hover:bg-gray-50'
                                                }`
                                            },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center justify-between gap-2' },
                                                React.createElement(
                                                    'div',
                                                    { className: 'flex-1' },
                                                    React.createElement(
                                                        'div',
                                                        { className: 'font-semibold text-gray-800 text-sm' },
                                                        m.bus.name
                                                    ),
                                                    React.createElement(
                                                        'div',
                                                        { className: 'text-xs text-gray-600 mt-0.5' },
                                                        `${m.trip.fromPlace} → ${m.trip.toPlace}`
                                                    ),
                                                    React.createElement(
                                                        'div',
                                                        { className: 'text-xs text-gray-500 mt-0.5' },
                                                        `Odchod: ${m.boardingTime || '—'}${m.alightingTime ? ` · Príchod: ${m.alightingTime}` : ''}`
                                                    )
                                                ),
                                                React.createElement(
                                                    'div',
                                                    { className: 'flex flex-row items-center gap-6 text-xs font-semibold' },
                                                    (() => {
                                                        const busId = m.bus.id;
                                                        const dayKey = m.trip?.dayKey;
                                                        const boardingRow = m.boardingRow;
                                                        const alightingRow = m.alightingRow;
                                                        if (!busId || !dayKey || !boardingRow || !alightingRow) return null;
                                                
                                                        const computeTripDuration = () => {
                                                            const timeRe = /^\d{1,2}:\d{2}$/;
                                                            const boardStr = String(m.boardingTime || '').trim();
                                                            const alightStr = String(m.alightingTime || '').trim();
                                                            if (!timeRe.test(boardStr) || !timeRe.test(alightStr)) return null;
                                                            const [bh, bm] = boardStr.split(':').map(Number);
                                                            const [ah, am] = alightStr.split(':').map(Number);
                                                            let diff = (ah * 60 + am) - (bh * 60 + bm);
                                                            if (diff < 0) diff += 24 * 60;
                                                            return diff > 0 ? diff : null;
                                                        };
                                                
                                                        const tripDurationMin = computeTripDuration();

                                                        // NOVÉ: počet ľudí v buse = MAX(
                                                        //   počet ľudí, ktorí nastupujú na začiatku presunu ALEBO už sú v buse (medzi nástupom a výstupom),
                                                        //   počet ľudí, ktorí vystupujú na konci presunu ALEBO ešte ostávajú v buse
                                                        // )
                                                        // + ak je tento konkrétny riadok vybratý (assignBusSelectedKey), pripočíta sa počet členov aktuálneho tímu.
                                                        const computeBusOccupancy = () => {
                                                            const bOrder = parseOrderFromRowId(boardingRow.rowId);
                                                            const aOrder = parseOrderFromRowId(alightingRow.rowId);
                                                            if (bOrder == null || aOrder == null) return 0;

                                                            // Množina tímov, ktoré sú v buse na nástupnej zastávke:
                                                            // - tí, ktorí tu nastupujú (boardingRowId === boardingRow.rowId)
                                                            // - tí, ktorí už boli v buse pred touto zastávkou (boarding order < bOrder a alighting order > bOrder)
                                                            const teamsAtBoarding = new Set();
                                                            // Množina tímov, ktoré sú v buse na výstupnej zastávke:
                                                            // - tí, ktorí tu vystupujú (alightingRowId === alightingRow.rowId)
                                                            // - tí, ktorí ešte ostávajú v buse po tejto zastávke (boarding order < aOrder a alighting order > aOrder)
                                                            const teamsAtAlighting = new Set();

                                                            (savedTransfersRef.current || []).forEach((parent) => {
                                                                if (parent.dayKey !== dayKey) return;
                                                                if (parent.isWalking === true) return;

                                                                const effectiveCategory = cleanCategory(parent.category || '');
                                                                let effectiveTeamName = String(parent.teamName || '').trim();
                                                                if (!effectiveTeamName && parent.teamUid != null && parent.teamIndex != null) {
                                                                    const lookupKey = `${parent.teamUid}|${effectiveCategory}|${parent.teamIndex}`;
                                                                    const info = (teamsLookupRef.current || {})[lookupKey];
                                                                    if (info && info.teamName) effectiveTeamName = info.teamName;
                                                                }
                                                                if (!effectiveTeamName) {
                                                                    const parts = String(parent.key || '').split('||');
                                                                    if (parts.length >= 2) {
                                                                        const keyTeamName = String(parts[1] || '').trim();
                                                                        if (keyTeamName) effectiveTeamName = keyTeamName;
                                                                    }
                                                                }
                                                                if (!effectiveTeamName) return;

                                                                const teamKeyStr = `${effectiveTeamName}|${effectiveCategory}`;

                                                                (parent.segments || []).forEach((seg) => {
                                                                    if (seg.busId !== busId) return;
                                                                    if (seg.isWalking === true) return;

                                                                    const segBOrder = parseOrderFromRowId(seg.boardingRowId);
                                                                    const segAOrder = parseOrderFromRowId(seg.alightingRowId);
                                                                    if (segBOrder == null || segAOrder == null) return;

                                                                    // Je tím v buse na nástupnej zastávke?
                                                                    const isAtBoarding =
                                                                        (segBOrder === bOrder) || // nastupuje tu
                                                                        (segBOrder < bOrder && segAOrder > bOrder); // už bol v buse a ešte nevystúpil
                                                                    if (isAtBoarding) teamsAtBoarding.add(teamKeyStr);

                                                                    // Je tím v buse na výstupnej zastávke?
                                                                    const isAtAlighting =
                                                                        (segAOrder === aOrder) || // vystupuje tu
                                                                        (segBOrder < aOrder && segAOrder > aOrder); // ešte ostáva v buse po tejto zastávke
                                                                    if (isAtAlighting) teamsAtAlighting.add(teamKeyStr);
                                                                });
                                                            });

                                                            const totalAtBoarding = [...teamsAtBoarding].reduce((sum, tk) => sum + getTeamMembersCount(tk), 0);
                                                            const totalAtAlighting = [...teamsAtAlighting].reduce((sum, tk) => sum + getTeamMembersCount(tk), 0);

                                                            let total = Math.max(totalAtBoarding, totalAtAlighting);

                                                            // NOVÉ: Ak je TENTO konkrétny riadok vybratý, pripočítame počet členov
                                                            // aktuálneho tímu (ten sa do počtu v buse ešte nezapočítal, lebo ešte nie je
                                                            // priradený). Pri výbere iného riadku sa tento dodatok automaticky "resetuje",
                                                            // pretože sa počíta len pre riadok, ktorý je práve vybratý.
                                                            const isThisRowSelected =
                                                                assignBusSelectedKey &&
                                                                assignBusSelectedKey.startsWith(`${busId}|${boardingRow.id}|${alightingRow.id}|`);
                                                            if (isThisRowSelected) {
                                                                const currentTeamKeyStr = `${String(currentTransfer.teamName || '').trim()}|${cleanCategory(currentTransfer.category || '')}`;
                                                                const alreadyCounted =
                                                                    teamsAtBoarding.has(currentTeamKeyStr) ||
                                                                    teamsAtAlighting.has(currentTeamKeyStr);
                                                                if (!alreadyCounted) {
                                                                    total += getTeamMembersCount(currentTeamKeyStr);
                                                                }
                                                            }

                                                            return total;
                                                        };

                                                        const total = computeBusOccupancy();
                                                
                                                        return React.createElement(
                                                            React.Fragment,
                                                            null,
                                                            total > 0 &&
                                                                React.createElement(
                                                                    'span',
                                                                    {
                                                                        className: 'flex items-center gap-1 text-blue-700',
                                                                        title: `V autobuse v tomto čase (maximum z nástupu a výstupu): ${total} členov`,
                                                                    },
                                                                    React.createElement('i', { className: 'fa-solid fa-users' }),
                                                                    `${total}`
                                                                ),
                                                            tripDurationMin != null &&
                                                                React.createElement(
                                                                    'span',
                                                                    {
                                                                        className: 'flex items-center gap-1 text-amber-700',
                                                                        title: `Dĺžka jazdy: ${tripDurationMin} min (${boardingRow.timeFrom} → ${alightingRow.timeTo})`,
                                                                    },
                                                                    React.createElement('i', { className: 'fa-solid fa-clock' }),
                                                                    `${tripDurationMin} min`
                                                                )
                                                        );
                                                    })(),
                                                    React.createElement(
                                                        'div',
                                                        { className: 'flex flex-col items-end gap-1' },
                                                        hasBoarding && React.createElement(
                                                            'span',
                                                            { className: 'flex items-center gap-1 text-emerald-600' },
                                                            React.createElement('i', { className: 'fa-solid fa-right-to-bracket' }),
                                                            'Nástup'
                                                        ),
                                                        hasAlighting && React.createElement(
                                                            'span',
                                                            { className: 'flex items-center gap-1 text-red-600' },
                                                            React.createElement('i', { className: 'fa-solid fa-right-from-bracket' }),
                                                            'Výstup'
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    );
                                }).filter(Boolean)
                            )
                        );
                    })(),
                    React.createElement(
                        'div',
                        { className: 'flex justify-end gap-3' },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => {
                                    setShowAssignBusModal(false);
                                    setAssignBusTransfer(null);
                                },
                                disabled: assignBusSaving,
                                className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                            },
                            'Zrušiť'
                        ),
                        (() => {
                            const isBlocked =
                                assignBusSaving ||
                                !assignBusSelectedKey ||
                                assignBusMatches.length === 0;                        
                            const baseCls =
                                'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2';
                            const enabledCls = 'bg-amber-600 text-white hover:bg-amber-700';
                            const blockedCls =
                                'bg-white border-2 border-amber-600 text-amber-600 cursor-not-allowed';                        
                            return React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: assignTransferToBus,
                                    disabled: isBlocked,
                                    title: isBlocked
                                        ? 'Najprv vyberte autobus.'
                                        : undefined,
                                    className: `${baseCls} ${isBlocked ? blockedCls : enabledCls}`,
                                },
                                assignBusSaving && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                                'Priradiť'
                            );
                        })()
                    )
                )
            );
        })() || null,
        removeWalkingModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                onClick: () => setRemoveWalkingModal(null)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-person-walking text-emerald-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Odstrániť príznak „peši"'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700' },
                    React.createElement('div', { className: 'font-medium' },
                        `${resolvePlaceNameById(removeWalkingModal.transfer.fromId) || '?'} → ${resolvePlaceNameById(removeWalkingModal.transfer.toId) || '?'}`),
                    React.createElement('div', { className: 'text-xs text-gray-500 mt-1' },
                        `${removeWalkingModal.transfer.teamName || ''}${removeWalkingModal.transfer.when ? ' • ' + removeWalkingModal.transfer.when : ''}`)
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm text-gray-600 mb-4' },
                    'Presun sa tým vráti späť medzi vygenerované presuny a bude ho možné znova upraviť, priradiť autobusu alebo označiť ako peši.'
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setRemoveWalkingModal(null),
                            disabled: removeWalkingSaving,
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: removeWalkingFlag,
                            disabled: removeWalkingSaving,
                            className: 'px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2'
                        },
                        removeWalkingSaving && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                        'Odstrániť'
                    )
                )
            )
        ),
        deleteTransferModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                onClick: () => setDeleteTransferModal(null)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-trash text-red-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Odstrániť presun'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700' },
                    React.createElement('div', { className: 'font-medium' },
                        `${resolvePlaceNameById(deleteTransferModal.transfer.fromId) || '?'} → ${resolvePlaceNameById(deleteTransferModal.transfer.toId) || '?'}`),
                    React.createElement('div', { className: 'text-xs text-gray-500 mt-1' },
                        `${deleteTransferModal.transfer.teamName || ''}${deleteTransferModal.transfer.when ? ' • ' + deleteTransferModal.transfer.when : ''}`)
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm text-gray-600 mb-4' },
                    'Naozaj chcete odstrániť tento konkrétny presun? Táto akcia je nenávratná.'
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setDeleteTransferModal(null),
                            disabled: deleteTransferSaving,
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => deleteSingleTransfer(deleteTransferModal.transfer),
                            disabled: deleteTransferSaving,
                            className: 'px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2'
                        },
                        deleteTransferSaving && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                        'Odstrániť'
                    )
                )
            )
        ),
        regenTransfersModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                onClick: () => setRegenTransfersModal(null)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-triangle-exclamation text-amber-500 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Presuny už boli vygenerované'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm text-gray-700 mb-4' },
                    `Pre kategóriu „${regenTransfersModal.category}" už existuje ${regenTransfersModal.existingCount} presunov.`,
                    ' ',
                    'Chcete časovú os vygenerovať znova?',
                    ' ',
                    'Existujúce presuny (s rovnakým tímom, časom a trasou) zostanú zachované a dogenerujú sa len tie, ktoré chýbajú.'
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg' },
                    React.createElement(
                        'p',
                        { className: 'text-xs text-amber-700 flex items-start gap-2' },
                        React.createElement('i', { className: 'fa-solid fa-circle-info mt-0.5' }),
                        React.createElement(
                            'span',
                            null,
                            'Presuny, ktoré ste už manuálne upravili (označili ako „peši", pridali medzizastávky alebo ich priradili autobusu), zostanú nedotknuté.'
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setRegenTransfersModal(null),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: async () => {
                                const cat = regenTransfersModal.category;
                                setRegenTransfersModal(null);
                                timelineGenerationRequestedRef.current = true;
                                rebuildAndLogTimeline(true, cat);
                                window.showGlobalNotification(
                                    `Časová os pre kategóriu ${cat} bola znova vygenerovaná (dogenerované len chýbajúce).`,
                                    'success'
                                );
                            },
                            className: 'px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors'
                        },
                        'Vygenerovať znova'
                    )
                )
            )
        ),
        shortcutEditModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                onClick: () => setShortcutEditModal(null)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-tag text-orange-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        React.createElement(
                            'h3',
                            { className: 'text-lg font-semibold text-gray-800' },
                            shortcutEditModal.shortcut ? 'Upraviť skratku tímu' : 'Pridať skratku tímu'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-xs text-gray-500 mt-0.5' },
                            `${shortcutEditModal.category} • ${shortcutEditModal.teamName}`
                        )
                    )
                ),
                React.createElement(
                    'label',
                    { className: 'block text-sm font-medium text-gray-700 mb-1' },
                    'Skratka'
                ),
                React.createElement('input', {
                    type: 'text',
                    autoFocus: true,
                    value: shortcutEditModal.shortcut || '',
                    onChange: (e) => {
                        const input = e.target;
                        const selectionStart = input.selectionStart;
                        const rawValue = input.value;
                        const v = rawValue.toLocaleUpperCase('sk-SK');
                        setShortcutEditModal((prev) => prev ? { ...prev, shortcut: v } : prev);
                        const lengthDelta = v.length - rawValue.length;
                        const newPos = Math.max(0, selectionStart + lengthDelta);
                        requestAnimationFrame(() => {
                            try {
                                input.setSelectionRange(newPos, newPos);
                            } catch (err) {
                            }
                        });
                        const trimmed = String(v || '').trim();
                        if (!trimmed) {
                            setShortcutConflict(null);
                            return;
                        }
                        const cat = cleanCategory(shortcutEditModal.category || '');
                        const currentTeam = String(shortcutEditModal.teamName || '').trim();
                        let conflict = null;
                        Object.entries(teamShortcuts || {}).forEach(([key, shortcutVal]) => {
                            const [kCat, kTeam] = String(key).split('|');
                            if (cleanCategory(kCat) !== cat) return;
                            if (String(kTeam || '').trim() === currentTeam) return;
                            const normalized = String(shortcutVal || '').trim().toLocaleUpperCase('sk-SK');
                            if (normalized && normalized === trimmed) {
                                conflict = {
                                    conflictingTeamName: String(kTeam || '').trim(),
                                    conflictingCategory: cleanCategory(kCat),
                                };
                            }
                        });
                        setShortcutConflict(conflict);
                    },
                    onKeyDown: async (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (shortcutConflict) return;
                            const m = shortcutEditModal;
                            if (!m) return;
                            await saveTeamShortcut(m.category, m.teamName, m.shortcut);
                            setShortcutEditModal(null);
                            setShortcutConflict(null);
                        }
                    },
                    className: 'w-full px-3 py-2 text-sm border border-gray-300 rounded text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4'
                }),
                shortcutConflict &&
                    React.createElement(
                        'div',
                        {
                            className: 'mb-3 p-2 rounded-md bg-red-50 border border-red-300 text-sm text-red-700 flex items-start gap-2'
                        },
                        React.createElement('i', { className: 'fa-solid fa-triangle-exclamation mt-0.5' }),
                        React.createElement(
                            'span',
                            null,
                            'Táto skratka „',
                            String(shortcutEditModal.shortcut || '').trim(),
                            '" už existuje pre tím „',
                            shortcutConflict.conflictingTeamName,
                            '" v kategórii „',
                            shortcutConflict.conflictingCategory,
                            '". Zvoľte inú skratku.'
                        )
                    ),
                React.createElement(
                    'p',
                    { className: 'text-xs text-gray-500 mb-4 italic' },
                    'Prázdna hodnota skratku odstráni (zobrazí sa plný názov tímu).'
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => {
                                setShortcutEditModal(null);
                                setShortcutConflict(null);
                            },
                            disabled: shortcutSaving,
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                        },
                        'Zrušiť'
                    ),
                    (() => {
                        const isBlocked = shortcutSaving || !!shortcutConflict;        
                        const baseCls = 'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2';
                        const enabledCls = 'bg-orange-600 text-white hover:bg-orange-700';
                        const blockedCls = 'bg-white border-2 border-orange-600 text-orange-600 cursor-not-allowed';        
                        return React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: async () => {
                                    if (isBlocked) return;
                                    const m = shortcutEditModal;
                                    if (!m) return;
                                    await saveTeamShortcut(m.category, m.teamName, m.shortcut);
                                    setShortcutEditModal(null);
                                },
                                disabled: isBlocked,
                                title: shortcutConflict
                                    ? 'Skratka už existuje pre iný tím v tejto kategórii.'
                                    : undefined,
                                className: `${baseCls} ${isBlocked ? blockedCls : enabledCls}`,
                            },
                            shortcutSaving && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                            'Uložiť'
                        );
                    })()
                )
            )
        ),
        deleteShortcutModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100002] p-4',
                onClick: () => {
                    if (deleteShortcutSaving) return;
                    setDeleteShortcutModal(null);
                }
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-tag text-red-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Odstrániť skratku tímu'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700' },
                    React.createElement(
                        'div',
                        { className: 'font-medium' },
                        `${deleteShortcutModal.teamName}`
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-xs text-gray-500 mt-1' },
                        `Kategória: ${deleteShortcutModal.category}`
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-xs text-gray-500 mt-1' },
                        `Aktuálna skratka: `,
                        React.createElement(
                            'span',
                            { className: 'font-semibold text-orange-600' },
                            deleteShortcutModal.shortcut
                        )
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm text-gray-600 mb-4' },
                    'Naozaj chcete odstrániť túto skratku? V plánovaní sa potom pre tím zobrazí plný názov. Táto akcia je nenávratná.'
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setDeleteShortcutModal(null),
                            disabled: deleteShortcutSaving,
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => deleteTeamShortcut(
                                deleteShortcutModal.category,
                                deleteShortcutModal.teamName
                            ),
                            disabled: deleteShortcutSaving,
                            className: 'px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2'
                        },
                        deleteShortcutSaving && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                        'Odstrániť'
                    )
                )
            )
        )
    );
};
let isEmailSyncListenerSetup = false;
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');
    if (userProfileData) {
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userPrivateRef = doc(window.db, 'usersprivate', user.uid);
                        const privateSnap = await getDoc(userPrivateRef);
                        if (privateSnap.exists()) {
                            const privateFirestoreEmail = privateSnap.data().email;
                            if (user.email !== privateFirestoreEmail) {
                                await updateDoc(userPrivateRef, { email: user.email });
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${privateFirestoreEmail || '-'}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná v usersprivate.', 'success');
                            }
                        } else {
                            await setDoc(userPrivateRef, { email: user.email }, { merge: true });
                        }
                    } catch (error) {
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(TransportApp, { userProfileData }));
        }
    } else {
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center h-full pt-16' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
                )
            );
        }
    }
};
window.listAccommodationsByCategoryAndGroup = async (categoryName, groupName, visitedGroups = new Set()) => {
    if (!window.db) {
        return;
    }
    if (!categoryName || !groupName) {
        return;
    }
    const targetCategory = cleanCategory(categoryName);
    const targetGroup = String(groupName).trim();
    const groupKey = `${targetCategory}|${targetGroup}`;
    if (visitedGroups.has(groupKey)) {
        return [];
    }
    visitedGroups.add(groupKey);
    const targetGroupLastChar = targetGroup.replace(/\s+/g, '').slice(-1).toUpperCase();
    const nameEndsWithTargetChar = (teamName) => {
        if (!targetGroupLastChar) return false;
        const match = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
        if (!match) return false;
        return match[1].toUpperCase() === targetGroupLastChar;
    };
    try {
        const usersRef = collection(window.db, 'users');
        const usersSnap = await getDocs(usersRef);
        const teamsByGroupName = {};
        const accommodationByTeamName = {};
        usersSnap.forEach((userDoc) => {
            const userData = userDoc.data() || {};
            const teams = userData.teams;
            if (!teams || typeof teams !== 'object') return;
            Object.entries(teams).forEach(([category, teamArray]) => {
                if (!Array.isArray(teamArray)) return;
                if (cleanCategory(category) !== targetCategory) return;
                teamArray.forEach((team) => {
                    if (!team || !team.teamName) return;
                    const trimmedName = team.teamName.trim();
                    const teamGroup = team.groupName ? String(team.groupName).trim() : null;
                    const accomName = team.accommodation?.name?.trim?.() || '';
                    if (teamGroup) {
                        if (!teamsByGroupName[teamGroup]) teamsByGroupName[teamGroup] = new Set();
                        teamsByGroupName[teamGroup].add(trimmedName);
                    }
                    if (accomName) {
                        if (!accommodationByTeamName[trimmedName]) {
                            accommodationByTeamName[trimmedName] = new Set();
                        }
                        accommodationByTeamName[trimmedName].add(accomName);
                    }
                });
            });
        });
        if (teamsByGroupName[targetGroup] && teamsByGroupName[targetGroup].size > 0) {
            const directAccommodations = new Set();
            teamsByGroupName[targetGroup].forEach((teamName) => {
                const accoms = accommodationByTeamName[teamName];
                if (accoms) accoms.forEach((a) => directAccommodations.add(a));
            });
            const sorted = [...directAccommodations].sort((a, b) =>
                a.localeCompare(b, 'sk', { sensitivity: 'base' })
            );
            return sorted;
        }
        const matchesRef = collection(window.db, 'matches');
        const matchesSnap = await getDocs(matchesRef);
        const allCategoryMatches = [];
        matchesSnap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const matchCategory = cleanCategory(data.categoryName || data.categoryId || '');
            if (matchCategory !== targetCategory) return;
            allCategoryMatches.push(data);
        });
        const teamsInTargetGroup = new Set();
        allCategoryMatches.forEach((data) => {
            const matchGroupName = data.groupName ? String(data.groupName).trim() : null;
            const candidates = [];
            if (data.homeTeamIdentifier) candidates.push(data.homeTeamIdentifier);
            if (data.awayTeamIdentifier) candidates.push(data.awayTeamIdentifier);
            candidates.forEach((identifier) => {
                const teamName = resolveTeamName(identifier);
                if (!teamName || teamName === '---') return;
                const trimmed = String(teamName).trim();
                if (!trimmed) return;
                if (nameEndsWithTargetChar(trimmed)) return;
                const matchesGroupByField =
                    matchGroupName && matchGroupName === targetGroup;
                if (matchesGroupByField) {
                    teamsInTargetGroup.add(trimmed);
                }
            });
        });
        const findGroupsInUsersByChar = (char) => {
            const result = new Set();
            Object.keys(teamsByGroupName).forEach((gName) => {
                const gLastChar = gName.trim().slice(-1).toUpperCase();
                if (gLastChar === char) result.add(gName);
            });
            return result;
        };
        const fallbackAccommodations = new Set();
        const visitedChars = new Set();
        teamsInTargetGroup.forEach((teamName) => {
            const accoms = accommodationByTeamName[teamName];
            if (accoms) accoms.forEach((a) => fallbackAccommodations.add(a));
        });
        const initialChars = new Set();
        teamsInTargetGroup.forEach((teamName) => {
            const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
            if (m) initialChars.add(m[1].toUpperCase());
        });
        const queue = [...initialChars];
        while (queue.length > 0) {
            const char = queue.shift();
            if (visitedChars.has(char)) continue;
            visitedChars.add(char);
            const groupsInUsers = findGroupsInUsersByChar(char);
            if (groupsInUsers.size > 0) {
                groupsInUsers.forEach((gName) => {
                    const teamsInGroup = teamsByGroupName[gName];
                    if (!teamsInGroup) return;
                    teamsInGroup.forEach((teamName) => {
                        const accoms = accommodationByTeamName[teamName];
                        if (accoms) accoms.forEach((a) => fallbackAccommodations.add(a));
                    });
                });
                continue;
            }
            const derivedGroupName = `skupina ${char}`;
            try {
                const recursiveResult = await window.listAccommodationsByCategoryAndGroup(
                    targetCategory,
                    derivedGroupName,
                    visitedGroups
                );
                if (Array.isArray(recursiveResult)) {
                    recursiveResult.forEach((a) => fallbackAccommodations.add(a));
                }
            } catch (recursiveErr) {
            }
        }
        const sorted = [...fallbackAccommodations].sort((a, b) =>
            a.localeCompare(b, 'sk', { sensitivity: 'base' })
        );
        return sorted;
    } catch (err) {
        return [];
    }
};
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);
if (window.globalUserProfileData) {
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            React.createElement(
                'div',
                { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
}
window.listTeamsByCategoryAndGroup = async (categoryName, groupName) => {
    if (!window.db) {
        console.error('[TRANSPORT] Firebase nie je inicializovaný (window.db chýba).');
        return;
    }
    if (!categoryName || !groupName) {
        console.error('[TRANSPORT] Zadajte dva parametre: názov kategórie a názov skupiny.');
        console.error('  Príklad: listTeamsByCategoryAndGroup("U12 D", "skupina D")');
        return;
    }
    const targetCategory = cleanCategory(categoryName);
    const targetGroup = String(groupName).trim();
    try {
        const usersRef = collection(window.db, 'users');
        const usersSnap = await getDocs(usersRef);
        const teamsSet = new Set();
        const registeredTeamNames = new Set();
        usersSnap.forEach((userDoc) => {
            const userData = userDoc.data() || {};
            const teams = userData.teams;
            if (!teams || typeof teams !== 'object') return;
            Object.entries(teams).forEach(([category, teamArray]) => {
                if (!Array.isArray(teamArray)) return;
                if (cleanCategory(category) !== targetCategory) return;
                teamArray.forEach((team) => {
                    if (!team || !team.teamName) return;
                    const teamGroup = team.groupName ? String(team.groupName).trim() : null;
                    if (!teamGroup || teamGroup !== targetGroup) return;
                    const trimmed = team.teamName.trim();
                    teamsSet.add(trimmed);
                    registeredTeamNames.add(trimmed);
                });
            });
        });
        const matchesRef = collection(window.db, 'matches');
        const matchesSnap = await getDocs(matchesRef);
        matchesSnap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const matchCategory = cleanCategory(data.categoryName || data.categoryId || '');
            if (matchCategory !== targetCategory) return;
            const matchGroupName = data.groupName ? String(data.groupName).trim() : null;
            if (!matchGroupName || matchGroupName !== targetGroup) return;
            const candidates = [];
            if (data.homeTeamIdentifier) candidates.push(data.homeTeamIdentifier);
            if (data.awayTeamIdentifier) candidates.push(data.awayTeamIdentifier);
            candidates.forEach((identifier) => {
                const teamName = resolveTeamName(identifier);
                if (!teamName || teamName === '---') return;
                const trimmed = String(teamName).trim();
                if (!trimmed) return;
                if (registeredTeamNames.has(trimmed)) return;
                teamsSet.add(trimmed);
            });
        });
        const sortedTeams = [...teamsSet].sort((a, b) =>
            a.localeCompare(b, 'sk', { sensitivity: 'base' })
        );
        if (sortedTeams.length === 0) {
        } else {
            sortedTeams.forEach((name) => {
                const isRegistered = registeredTeamNames.has(name);
                const tag = isRegistered ? '' : ' [superstructure]';
            });
        }
        return sortedTeams;
    } catch (err) {
        return [];
    }
};

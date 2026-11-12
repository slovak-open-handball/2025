// logged-in-transport-generator.js
import { doc, getDocs, setDoc, collection, Timestamp, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ============================================================
// POMOCNÉ FUNKCIE (zdieľané s hlavným súborom, duplikované tu)
// ============================================================

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

const SPIDER_IDENTIFIER_PREFIXES = [
    'W32F', 'L32F', 'W16F', 'L16F', 'W8F', 'L8F', 'WQF', 'LQF', 'WSF', 'LSF',
];

const SPIDER_IDENTIFIER_REGEX = new RegExp(
    '\\b(' + SPIDER_IDENTIFIER_PREFIXES.join('|') + ')\\d*',
    'i'
);

const isSpiderTeamName = (teamName) => {
    if (!teamName) return false;
    return SPIDER_IDENTIFIER_REGEX.test(String(teamName));
};

const isSuperstructureTeamName = (teamName, category) => {
    if (!teamName) return false;
    const tn = String(teamName).trim();
    if (!tn) return false;
    const cat = cleanCategory(category || '');
    if (cat && tn.startsWith(cat + ' ')) return true;
    if (isSpiderTeamName(tn)) return true;
    const info = (window.__transport_teamsArrivalBuffer || []).find(
        (t) => cleanCategory(t.category) === cat && String(t.teamName || '').trim() === tn
    );
    if (info && info.isSuperstructure === true) return true;
    if (info && info.isRegistered !== true) return true;
    return false;
};

const getGroupCharFromTeamName = (teamName, category) => {
    if (!teamName) return null;
    const tn = String(teamName).trim();
    if (!tn) return null;
    if (isSuperstructureTeamName(tn, category)) return null;
    const m = /\d([A-ZÁ-Ž])\s*$/.exec(tn);
    if (m) return m[1].toUpperCase();
    const m2 = /([A-ZÁ-Ž])(?=[^A-ZÁ-Ž]*$)/.exec(tn.toUpperCase());
    return m2 ? m2[1] : null;
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
    return segments.findIndex((s) => s.fromId === fromId && s.toId === toId);
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

const computeEffectiveParentRange = (parent) => {
    if (!parent) return null;
    const whenRange = parseTransferWhenToRange(parent.when);
    if (!whenRange) return null;
    return { startTs: whenRange.startTs, endTs: whenRange.endTs };
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

// ============================================================
// GENERÁTOR – HLAVNÁ TRIEDA
// ============================================================

class TransportGenerator {
    constructor() {
        // Referencie na dáta – nastaví ich hlavný súbor cez setContext()
        this.ctx = null;
    }

    setContext(context) {
        this.ctx = context;
    }

    // Resolver názvov/miest (používa context z hlavného súboru)
    resolvePlaceNameById(placeId) {
        if (!placeId || !this.ctx) return '';
        const id = String(placeId);
        const fromMap = (this.ctx.placesMapRef?.current || {})[id];
        if (fromMap) return fromMap;
        const fromAllPlaces = (this.ctx.allPlacesRef?.current || []).find((p) => p.id === id);
        if (fromAllPlaces) return fromAllPlaces.name;
        const fromStops = (this.ctx.stopsList || []).find((s) => s.id === id);
        if (fromStops) return fromStops.name;
        return id;
    }

    resolvePlaceIdByName(placeName) {
        if (!placeName || !this.ctx) return null;
        const raw = String(placeName).trim();
        const directById = (this.ctx.allPlacesRef?.current || []).find((p) => p.id === raw);
        if (directById) return directById.id;
        const norm = normalizePlaceName(raw);
        const found = (this.ctx.allPlacesRef?.current || []).find(
            (p) => normalizePlaceName(p.name) === norm
        );
        return found ? found.id : null;
    }

    isSamePlaceForTransfer(a, b) {
        if (!a || !b) return false;
        const na = normalizePlaceName(a);
        const nb = normalizePlaceName(b);
        if (!na || !nb) return false;
        if (na === nb) return true;
        const idA = this.resolvePlaceIdByName(a) || null;
        const idB = this.resolvePlaceIdByName(b) || null;
        if (idA && idB && idA === idB) return true;
        return false;
    }

    findTeamIdentifiersByName(category, teamName) {
        if (!this.ctx) return null;
        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();
        if (!cat || !name) return null;
        const lookup = this.ctx.teamsLookupRef?.current || {};
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
    }

    computeProvisionalSegmentRange(transfer) {
        if (!transfer || !this.ctx) return null;
        const parentKey = transfer._parentKey || transfer.key;
        if (!parentKey) return null;
        const parentRec = (this.ctx.savedTransfersRef?.current || []).find((s) => s.key === parentKey);
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
                    if (seg.startTs != null) range = { startTs: seg.startTs, endTs: seg.startTs };
                    else if (seg.endTs != null) range = { startTs: seg.endTs, endTs: seg.endTs };
                } else {
                    if (seg.startTs != null && seg.endTs != null && seg.endTs > seg.startTs) {
                        range = { startTs: seg.startTs, endTs: seg.endTs };
                    } else if (seg.startTs != null) {
                        range = { startTs: seg.startTs, endTs: null };
                    } else if (seg.endTs != null) {
                        range = { startTs: null, endTs: seg.endTs };
                    }
                }
                parentSegments.push({
                    idx,
                    fromId: segFromId,
                    toId: segToId,
                    isWalking: isWalkingSeg,
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
                range: null,
            });
        }
        parentSegments.sort((a, b) => (a.idx || 0) - (b.idx || 0));

        let prevResolvedEndTs = null;
        for (const seg of parentSegments) {
            const isCurrent = seg.fromId === currentFromId && seg.toId === currentToId;
            if (isCurrent) break;
            if (seg.isWalking === true) continue;
            if (seg.range && seg.range.endTs != null) {
                const e = seg.range.endTs;
                if (prevResolvedEndTs == null || e > prevResolvedEndTs) prevResolvedEndTs = e;
            }
        }

        let nextResolvedStartTs = null;
        let foundCurrent = false;
        for (const seg of parentSegments) {
            const isCurrent = seg.fromId === currentFromId && seg.toId === currentToId;
            if (isCurrent) { foundCurrent = true; continue; }
            if (!foundCurrent) continue;
            if (seg.isWalking === true) continue;
            if (seg.range && seg.range.startTs != null) {
                const s = seg.range.startTs;
                if (nextResolvedStartTs == null || s < nextResolvedStartTs) nextResolvedStartTs = s;
            }
        }

        const startTsForDisplay = prevResolvedEndTs != null ? prevResolvedEndTs : PARENT_START;
        let endTsForDisplay;
        if (nextResolvedStartTs != null && nextResolvedStartTs > startTsForDisplay) {
            endTsForDisplay = nextResolvedStartTs;
        } else {
            endTsForDisplay = PARENT_END;
        }

        if (endTsForDisplay <= startTsForDisplay) {
            if (PARENT_END > startTsForDisplay) {
                return { startTs: startTsForDisplay, endTs: PARENT_END };
            }
            return null;
        }
        return { startTs: startTsForDisplay, endTs: endTsForDisplay };
    }

    recomputeParentSegmentsInPlace(draft) {
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
        const busRows = this.ctx?.busRows || {};
        Object.entries(busRows).forEach(([busKey, rows]) => {
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
            const busTimes = findBusTimesForSegment(seg.fromId || null, seg.toId || null);
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
            const hasBusAssignmentMarkers =
                (seg.busId != null && seg.boardingRowId && seg.alightingRowId)
                || (seg.busAssigned === true && seg.boardingRowId && seg.alightingRowId);
            if (hasBusAssignmentMarkers) {
                return {
                    ...seg,
                    isWalking: false,
                    busAssigned: true,
                    busId: seg.busId || null,
                    when: seg.startTs != null && seg.endTs != null
                        ? `${formatTsLocal(seg.startTs)} – ${formatTsLocal(seg.endTs)}`
                        : (seg.startTs != null ? formatTsLocal(seg.startTs) : (seg.endTs != null ? formatTsLocal(seg.endTs) : null)),
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

        const savedParentWhen = (() => {
            if (!draft.key) return null;
            const savedRec = (this.ctx?.savedTransfersRef?.current || []).find((s) => s.key === draft.key);
            if (savedRec && savedRec.when && String(savedRec.when).trim() !== '') {
                return savedRec.when;
            }
            return null;
        })();

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
            (s) => s.isWalking !== true && (s.startTs == null || s.endTs == null)
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

        if (parentHasSavedWhen) {
            draft.when = savedParentWhen;
        }
    }

        const rebuildAndLogTimeline = (force = false, categoryFilter = null) => {
        if (!force && !timelineGenerationRequestedRef.current) return;

        const meetingPointDayKey = meetingPointDayKeyRef.current || '';
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
        
        const teamBelongsToGroupChar = (team, groupChar) => {
            if (!team || !team.teamName || !groupChar) return false;
            const tn = String(team.teamName).trim();
            if (!tn) return false;
        
            // Pavúkový tím sa nikdy nezaraduje podľa posledného písmena názvu.
            if (isSpiderTeamName(tn)) return false;
        
            const cat = cleanCategory(team.category || '');
        
            // NOVÉ: Skupina sa určuje VÝHRADNE z groupName – pre VŠETKY tímy
            // (users aj superstructure), ak je groupName dostupný.
            if (team.groupName) {
                const gChar = getGroupLastChar(team.groupName);
                return gChar === groupChar;
            }
        
            // Ak tím nemá groupName v bufferi, skúsime nájsť groupName
            // priamo v settings/superstructureGroups.
            const ssGroups = superstructureGroupsRef.current || {};
            for (const [groupKey, teamNames] of Object.entries(ssGroups)) {
                const [keyCat, keyGroup] = String(groupKey).split('|');
                if (cleanCategory(keyCat) !== cat) continue;
                if (!Array.isArray(teamNames)) continue;
                const isInGroup = teamNames.some(
                    (n) => String(n || '').trim() === tn
                );
                if (isInGroup) {
                    const gChar = getGroupLastChar(keyGroup);
                    return gChar === groupChar;
                }
            }
        
            // Ak tím nemá groupName ani v bufferi, ani v settings/superstructureGroups,
            // skúsime fallback na posledné písmeno názvu tímu – LEN pre users tímy.
            // (Pre superstructure tímy bez groupName je to nespoľahlivé.)
            if (team.isSuperstructure !== true) {
                const m = /\d([A-ZÁ-Ž])\s*$/.exec(tn);
                if (m) return m[1].toUpperCase() === groupChar;
            }
        
            // Ak ani to nepomohlo, do konzoly vypíšeme, že pre tím sa nenašiel groupName.
            try {
                const msg = `[TRANSPORT][GROUP-MEMBERS] Pre tím "${tn}" (kategória: ${cat}) sa nenašiel groupName – nie je možné ho zaradiť do skupiny "${groupChar}".`;
                if (!window.__transport_missingGroupNameLogged) {
                    window.__transport_missingGroupNameLogged = new Set();
                }
                const dedupKey = `${cat}|${tn}|${groupChar}`;
                if (!window.__transport_missingGroupNameLogged.has(dedupKey)) {
                    window.__transport_missingGroupNameLogged.add(dedupKey);
                    console.log('%c' + msg, 'color: #b91c1c; font-weight: bold;');
                }
            } catch (e) {
            }
        
            return false;
        };
        
        const getTeamsInGroupByChar = (category, groupChar) => {
            if (!category || !groupChar) return new Set();
            const cat = cleanCategory(category);
            const char = String(groupChar).toUpperCase();
            const result = new Set();
        
            (teamsArrivalBufferRef.current || []).forEach((t) => {
                if (cleanCategory(t.category) !== cat) return;
                if (!t.teamName) return;
                const tn = String(t.teamName).trim();
        
                // Pavúkový tím sa NIKDY nezaradzuje do skupiny podľa posledného
                // písmena názvu.
                if (isSpiderTeamName(tn)) return;
        
                // NOVÉ: Skupina sa určuje VÝHRADNE z groupName – pre VŠETKY tímy.
                const gChar = getGroupLastChar(t.groupName);
                if (gChar === char) {
                    result.add(tn);
                }
            });
        
            return result;
        };

        const getGroupForSuperstructureTeam = (category, teamName) => {
            const cat = cleanCategory(category);
            const tn = String(teamName || '').trim();
            if (!cat || !tn) return null;

            // 1) Skús buffer
            const fromBuffer = (teamsArrivalBufferRef.current || []).find(
                (t) => cleanCategory(t.category) === cat && String(t.teamName || '').trim() === tn
            );
            if (fromBuffer && fromBuffer.groupName) {
                return String(fromBuffer.groupName).trim();
            }

            // 2) Skús settings/superstructureGroups
            const ssGroups = superstructureGroupsRef.current || {};
            for (const [groupKey, teamNames] of Object.entries(ssGroups)) {
                const [keyCat, keyGroup] = String(groupKey).split('|');
                if (cleanCategory(keyCat) !== cat) continue;
                if (!Array.isArray(teamNames)) continue;
                if (teamNames.some((n) => String(n || '').trim() === tn)) {
                    return keyGroup;
                }
            }
            return null;
        };
        
        // NOVÉ: Logovanie všetkých skupín a tímov v nich pre danú kategóriu
        // + pre každý superstructure tím (tím, ktorého názov obsahuje názov kategórie)
        //   vypíšeme všetky tímy, ktoré sú v skupine určenej POSLEDNÝM PÍSMENOM názvu tímu.
        //
        // DÔLEŽITÉ:
        //  - Pre BEŽNÝ superstructure tím (napr. "U12 D 1F", "U12 D 5A") je posledné
        //    písmeno názvu tímu označením skupiny (F, A, ...). Vypíšeme všetky tímy
        //    z tejto skupiny.
        //  - Pre PAVÚKOVÝ tím (napr. "U12 D LSF01", "U12 D WSF02", "U12 D WQF01")
        //    posledné písmeno "F" NIE JE označením skupiny – je súčasťou pavúkového
        //    identifikátora. Preto pre pavúkové tímy NEVYPISUJEME skupinu, ale
        //    iba označíme, že ide o pavúkový tím (spider team).
        const logGroupsAndTeamsForCategory = (category) => {
            const cat = cleanCategory(category);
        
            // Pomocná: vráti posledné písmeno názvu BEŽNÉHO superstructure tímu
            // (napr. "U12 D 1F" → "F", "U12 D 5A" → "A").
            // Pre pavúkové tímy vráti null – tie sa nepovažujú za skupinu.
            const getTeamNameLastChar = (teamName) => {
                if (!teamName) return null;
                return getGroupCharFromTeamName(teamName, cat);
            };
        
            // ============================================================
            // 1. ČASŤ: Vypíš všetky skupiny a tímy v nich (ako doteraz)
            // ============================================================
            const groupsMap = new Map(); // groupName -> Set(teamNames)
        
            (teamsArrivalBufferRef.current || []).forEach((t) => {
                if (cleanCategory(t.category) !== cat) return;
                if (!t.teamName) return;
                const tn = String(t.teamName).trim();
                const gName = t.groupName ? String(t.groupName).trim() : '(bez groupName)';
                if (!groupsMap.has(gName)) groupsMap.set(gName, new Set());
                groupsMap.get(gName).add(tn);
            });
        
            console.log(`\n[TRANSPORT][GROUPS] ██ Skupiny v kategórii ${cat} ██`);
            const sortedGroupNames = [...groupsMap.keys()].sort((a, b) =>
                a.localeCompare(b, 'sk', { sensitivity: 'base' })
            );
            if (sortedGroupNames.length === 0) {
                console.log(`  (žiadne tímy v kategórii ${cat})`);
            } else {
                sortedGroupNames.forEach((gName) => {
                    const teams = [...groupsMap.get(gName)].sort((a, b) =>
                        a.localeCompare(b, 'sk', { sensitivity: 'base' })
                    );
                    const gChar = getGroupLastChar(gName);
                    console.log(
                        `%c  Skupina: "${gName}" (písmeno: ${gChar || '—'}) – ${teams.length} tímov:`,
                        'font-weight: bold; color: #7c3aed;'
                    );
                    teams.forEach((tn) => {
                        const nameChar = (() => {
                            if (isSpiderTeamName(tn)) return 'SPIDER';
                            return getGroupCharFromTeamName(tn, cat) || '—';
                        })();

                        // NOVÉ: Vypíš groupName tímu (alebo upozornenie, že chýba) – pre VŠETKY tímy.
                        const teamRecord = (teamsArrivalBufferRef.current || []).find(
                            (t) => cleanCategory(t.category) === cat && String(t.teamName || '').trim() === tn
                        );
                        const teamGroupName = teamRecord && teamRecord.groupName
                            ? String(teamRecord.groupName).trim()
                            : null;
                        const groupNameLabel = teamGroupName
                            ? `groupName: "${teamGroupName}"`
                            : `groupName: (chýba!)`;

                        if (teamGroupName) {
                            console.log(`    • ${tn}  [písmeno názvu: ${nameChar}]  [${groupNameLabel}]`);
                        } else {
                            console.log(
                                '%c' + `    • ${tn}  [písmeno názvu: ${nameChar}]  [${groupNameLabel}]`,
                                'color: #b91c1c;'
                            );
                        }
                    });
                });
            }
            console.log('[TRANSPORT][GROUPS] ─────────────────────────────');

            const teamsWithGroupInfo = (teamsArrivalBufferRef.current || []).filter(
                (t) => cleanCategory(t.category) === cat && t.teamName
            );
            if (teamsWithGroupInfo.length > 0) {
                console.log(`%c[TRANSPORT][GROUPS] ██ Tímy v kategórii ${cat} a ich skupiny ██`, 'font-weight: bold; color: #ea580c;');
                teamsWithGroupInfo.forEach((t) => {
                    const tn = String(t.teamName).trim();
                    if (isSpiderTeamName(tn)) {
                        return; // pavúkový tím – preskočiť
                    }
                    let lastCharFromName = getGroupLastChar(t.groupName);
                    let lastCharSource = 'groupName';
                    if (!lastCharFromName && t.isSuperstructure !== true) {
                        const m = /\d([A-ZÁ-Ž])\s*$/.exec(tn);
                        if (m) {
                            lastCharFromName = m[1].toUpperCase();
                            lastCharSource = 'posledné písmeno názvu tímu (bez groupName)';
                        }
                    }
                    if (!lastCharFromName) return;
                    console.log(`%c  Tím: "${tn}"`, 'font-weight: bold; color: #ea580c;');
                    console.log(`    • groupName: ${t.groupName ? String(t.groupName).trim() : '(žiadny)'}`);
                    console.log(`    • písmeno skupiny: ${lastCharFromName} (zdroj: ${lastCharSource})`);
                    console.log('    ─────────────────────────────');
                });
            }
        
            // ============================================================
            // 2. ČASŤ: Pre každý superstructure tím vypíš info o skupine
            // ============================================================
            const superstructureTeamsInCategory = (teamsArrivalBufferRef.current || []).filter(
                (t) => cleanCategory(t.category) === cat
                    && t.isSuperstructure === true
                    && t.teamName
            );
        
            if (superstructureTeamsInCategory.length > 0) {
                console.log(
                    `%c[TRANSPORT][SUPERSTRUCTURE] ██ Superstructure tímy v kategórii ${cat} a ich skupiny ██`,
                    'font-weight: bold; color: #ea580c;'
                );
        
                superstructureTeamsInCategory.forEach((t) => {
                    const tn = String(t.teamName).trim();
        
                    // NOVÉ: Pavúkový tím – nevypisujeme skupinu, iba označíme, že ide o spider team
                    if (isSpiderTeamName(tn)) {
                        console.log(
                            `%c  Superstructure tím: "${tn}"`,
                            'font-weight: bold; color: #ea580c;'
                        );
                        console.log(
                            `%c    → SPIDER TEAM (pavúkový tím) – nepatrí do žiadnej skupiny podľa posledného písmena.`,
                            'font-weight: bold; color: #7c3aed;'
                        );
                        console.log(`    • groupName: ${t.groupName ? String(t.groupName).trim() : '(žiadny)'}`);
                        console.log('    ─────────────────────────────');
                        return;
                    }
        
                    // Písmeno skupiny:
                    //  - ak má tím groupName → písmeno z groupName
                    //  - ak nemá groupName a nie je pavúkový → písmeno z posledného
                    //    písmena názvu tímu (napr. "U12 CH 1D" → "D").
                    // POZOR: Toto písmeno NIE JE skupina, do ktorej tím patrí.
                    // Používa sa len na to, aby sme vypísali tímy, ktoré patria
                    // do skupiny s týmto písmenom (t.j. skupina "skupina D").
                    if (isSpiderTeamName(tn)) {
                        console.log(`    → PAVÚKOVÝ TÍM – skupina sa neurčuje podľa posledného písmena názvu.`);
                        console.log('    ─────────────────────────────');
                        return;
                    }

                    // NOVÉ: Skupina sa určuje VÝHRADNE z groupName.
                    let lastCharFromName = getGroupLastChar(t.groupName);
                    let lastCharSource = 'groupName';

                    console.log(
                        `%c  Superstructure tím: "${tn}"`,
                        'font-weight: bold; color: #ea580c;'
                    );
                    console.log(`    • groupName: ${t.groupName ? String(t.groupName).trim() : '(žiadny)'}`);
                    console.log(`    • posledné písmeno názvu tímu: ${(() => {
                        const m = /\d([A-ZÁ-Ž])\s*$/.exec(tn);
                        return m ? m[1].toUpperCase() : '—';
                    })()}`);

                    if (!lastCharFromName) {
                        console.log(`    → (nepodarilo sa určiť písmeno skupiny z groupName – tím nie je zaradený do žiadnej skupiny)`);
                        console.log('    ─────────────────────────────');
                        return;
                    }

                    console.log(`    • písmeno skupiny: ${lastCharFromName} (zdroj: ${lastCharSource})`);
        
                    const teamsInSameGroupUsers = [];
                    const teamsInSameGroupSuperstructure = [];
                    
                    (teamsArrivalBufferRef.current || []).forEach((other) => {
                        if (cleanCategory(other.category) !== cat) return;
                        if (!other.teamName) return;
                        const otherTn = String(other.teamName).trim();
                        if (otherTn === tn) return;

                        if (!teamBelongsToGroupChar(other, lastCharFromName)) return;
                    
                        if (other.isRegistered === true) {
                            teamsInSameGroupUsers.push(otherTn);
                            return;
                        }

                        if (other.isSuperstructure === true) {
                            teamsInSameGroupSuperstructure.push(otherTn);
                        }
                    });
                    
                    // NOVÉ: Ak sa našli users tímy, použijeme len ich.
                    // Ak sa nenašli, použijeme superstructure tímy (zaradené výhradne podľa groupName).
                    const teamsInSameGroup = teamsInSameGroupUsers.length > 0
                        ? teamsInSameGroupUsers
                        : teamsInSameGroupSuperstructure;
                    
                    // Deduplikácia a zoradenie
                    const uniqueTeams = [...new Set(teamsInSameGroup)].sort((a, b) =>
                        a.localeCompare(b, 'sk', { sensitivity: 'base' })
                    );
                    
                    if (uniqueTeams.length > 0) {
                        console.log(
                            `%c    → Tímy v skupine "${lastCharFromName}" (${uniqueTeams.length}):`,
                            'font-weight: bold; color: #16a34a;'
                        );
                        uniqueTeams.forEach((otherTn) => {
                            console.log(`        • ${otherTn}`);
                        });
                    } else {
                        console.log(
                            `    → (žiadne iné tímy v skupine "${lastCharFromName}")`
                        );
                    }
                    console.log('    ─────────────────────────────');
                });
        
                console.log(
                    '%c[TRANSPORT][SUPERSTRUCTURE] ─────────────────────────────',
                    'color: #ea580c;'
                );
            }
        };
    
        const categories = Object.keys(grouped).sort((a, b) =>
            a.localeCompare(b, 'sk', { sensitivity: 'base' })
        );
    
        if (categories.length === 0) {
        } else {
            const ssPlayDatesByTeam = {};
            const ssGroupCharByTeam = {};

            (teamsArrivalBufferRef.current || []).forEach((t) => {
                if (!t.teamName) return;

                // NOVÉ: Pre AKÝKOĽVEK tím (users aj superstructure) určujeme písmeno
                // skupiny VÝHRADNE z groupName, ak je dostupný.
                let char = getGroupLastChar(t.groupName);

                // Ak tím nemá groupName a NIE JE superstructure, skúsime fallback
                // na posledné písmeno názvu tímu (napr. "U12 D 5A" → A).
                // Pre superstructure tímy bez groupName je to nespoľahlivé (LSF02 → F).
                if (!char && t.isSuperstructure !== true && !isSpiderTeamName(t.teamName)) {
                    char = getGroupLastChar(t.teamName);
                }

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

            const getTeamGroupCharFromName = (teamName, categoryOverride) => {
                if (!teamName) return null;
                const s = String(teamName).trim();
                const cat = cleanCategory(categoryOverride || '');
            
                const teamInfo = (teamsArrivalBufferRef.current || []).find(
                    (t) => String(t.teamName || '').trim() === s
                );
            
                // NOVÉ: Priorita 1 – groupName z bufferu (pre VŠETKY tímy).
                if (teamInfo && teamInfo.groupName) {
                    const gChar = getGroupLastChar(teamInfo.groupName);
                    if (gChar) return gChar;
                }
            
                // NOVÉ: Priorita 2 – groupName zo settings/superstructureGroups
                // (pre VŠETKY tímy).
                const ssGroups = superstructureGroupsRef.current || {};
                for (const [groupKey, teamNames] of Object.entries(ssGroups)) {
                    const [keyCat, keyGroup] = String(groupKey).split('|');
                    if (cleanCategory(keyCat) !== cat) continue;
                    if (!Array.isArray(teamNames)) continue;
                    if (teamNames.some((n) => String(n || '').trim() === s)) {
                        const gChar = getGroupLastChar(keyGroup);
                        if (gChar) return gChar;
                    }
                }
            
                // NOVÉ: Priorita 3 – fallback na posledné písmeno názvu tímu
                // LEN pre users tímy (registrované) – pre superstructure tímy je to
                // nespoľahlivé (LSF02 → F).
                const isSuperstructureTeam = (() => {
                    if (teamInfo && teamInfo.isSuperstructure === true) return true;
                    if (cat && s.startsWith(cat + ' ')) return true;
                    if (!teamInfo && cat && s.startsWith(cat + ' ')) return true;
                    return false;
                })();
            
                if (!isSuperstructureTeam && !isSpiderTeamName(s)) {
                    const m = /\d([A-ZÁ-Ž])\s*$/.exec(s);
                    if (m) return m[1].toUpperCase();
            
                    const m2 = /([A-ZÁ-Ž])(?=[^A-ZÁ-Ž]*$)/.exec(s.toUpperCase());
                    return m2 ? m2[1] : null;
                }
            
                return null;
            };
                
            categories.forEach((category) => {
                if (normalizedFilter && cleanCategory(category) !== normalizedFilter) return;
                console.log(`\n[TRANSPORT] ██ Kategória: ${category} ██`);

                // NOVÉ: Vypíš všetky skupiny a tímy v nich pre túto kategóriu
                logGroupsAndTeamsForCategory(category);

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
                    
                    // NOVÉ: Ak ide o superstructure tím (názov obsahuje kategóriu), vypíš všetky tímy v jeho skupine
                    if (isSuperstructureTeam && teamGroupName) {
                        const groupCharForLog = getGroupLastChar(teamGroupName);
                        if (groupCharForLog) {
                            // NOVÉ: Zisti deň (dayKey) pre tento tím – použijeme deň z udalostí tímu.
                            // Ak tím nemá žiadne udalosti, log preskočíme (nemá zmysel).
                            const currentDayForLog = (() => {
                                const dayKeys = (events || [])
                                    .map((ev) => extractDayKeyFromWhen(ev.when))
                                    .filter(Boolean)
                                    .sort();
                                if (dayKeys.length === 0) return null;
                                // Ak má tím viac dní, vezmeme prvý (najskorší) – log sa vykoná pre tento deň.
                                return dayKeys[0];
                            })();
                    
                            if (!currentDayForLog) {
                                // Tím nemá žiadne udalosti – log [GROUP-MEMBERS] sa nevykoná.
                            } else {
                                // NOVÉ: Zisti, či sa v udalostiach tímu v danom dni (zápas alebo stravovanie)
                                // nachádza názov tímu obsahujúci niektorý z SPIDER_IDENTIFIER_PREFIXES.
                                const spiderMatchInEvents = (() => {
                                    // Prejdi udalosti tímu v tomto dni
                                    const dayEvents = events
                                        .filter((ev) => {
                                            const evDay = extractDayKeyFromWhen(ev.when);
                                            return evDay != null && evDay === currentDayForLog;
                                        })
                                        .sort((a, b) => {
                                            const ta = a.startTs != null ? a.startTs : (a.ts != null ? a.ts : Number.POSITIVE_INFINITY);
                                            const tb = b.startTs != null ? b.startTs : (b.ts != null ? b.ts : Number.POSITIVE_INFINITY);
                                            return ta - tb;
                                        });
                    
                                    for (const ev of dayEvents) {
                                        // Zápas – z textu "Home vs Away [o X. miesto] | Hala"
                                        if (ev.type === 'match') {
                                            const matchParts = /^(.+?) vs (.+?)(?:\s*\[.*?\])?(?:\s*\|.*)?$/.exec(String(ev.text || ''));
                                            if (matchParts) {
                                                const homeName = matchParts[1].trim();
                                                const awayName = matchParts[2].trim();
                                                const spiderTeam = isSpiderTeamName(homeName) ? homeName
                                                    : (isSpiderTeamName(awayName) ? awayName : null);
                                                if (spiderTeam) {
                                                    // Zisti, či ide o pavúkový zápas (WSF/LSF/WQF/LQF/...)
                                                    const spiderPrefixMatch = new RegExp(
                                                        '\\b(' + SPIDER_IDENTIFIER_PREFIXES.join('|') + ')',
                                                        'i'
                                                    ).exec(spiderTeam);
                                                    const spiderPrefix = spiderPrefixMatch ? spiderPrefixMatch[1].toUpperCase() : null;
                                                    return {
                                                        event: ev,
                                                        spiderTeam,
                                                        spiderPrefix,
                                                        homeName,
                                                        awayName,
                                                    };
                                                }
                                            }
                                        }
                                    }
                                    return null;
                                })();
                    
                                // NOVÉ: Ak sa v udalostiach tímu v danom dni nachádza pavúkový tím,
                                // vypíš informáciu o pavúkovom zápase a tímy, ktoré doň patria podľa chronológie
                                // (tím z predchádzajúcej udalosti).
                                if (spiderMatchInEvents) {
                                    const { event: spiderEvent, spiderTeam, spiderPrefix, homeName, awayName } = spiderMatchInEvents;
                    
                                    // Zisti typ pavúkového zápasu podľa prefixu
                                    const spiderTypeLabel = (() => {
                                        if (!spiderPrefix) return 'pavúkový zápas';
                                        if (spiderPrefix === 'WSF' || spiderPrefix === 'LSF') return 'semifinále';
                                        if (spiderPrefix === 'WQF' || spiderPrefix === 'LQF') return 'štvrťfinále';
                                        if (spiderPrefix === 'W16F' || spiderPrefix === 'L16F') return 'osemfinále';
                                        if (spiderPrefix === 'W8F' || spiderPrefix === 'L8F') return 'osemnásťfinále';
                                        if (spiderPrefix === 'W32F' || spiderPrefix === 'L32F') return '32-finále';
                                        return 'pavúkový zápas';
                                    })();
                    
                                    // Nájdi predchádzajúcu udalosť pre tím, ktorý patrí do tohto pavúkového zápasu
                                    // podľa chronológie (pred spiderEvent).
                                    const spiderEventStartTs = spiderEvent.startTs != null
                                        ? spiderEvent.startTs
                                        : (spiderEvent.ts != null ? spiderEvent.ts : Number.POSITIVE_INFINITY);
                    
                                    const prevEventsForTeams = events
                                        .filter((ev) => {
                                            if (ev === spiderEvent) return false;
                                            const evDay = extractDayKeyFromWhen(ev.when);
                                            if (evDay !== currentDayForLog) return false;
                                            const evStartTs = ev.startTs != null ? ev.startTs : (ev.ts != null ? ev.ts : Number.POSITIVE_INFINITY);
                                            if (evStartTs >= spiderEventStartTs) return false;
                                            // Zisti, či sa udalosť týka niektorého z tímov v pavúkovom zápase
                                            if (ev.type === 'match') {
                                                const mp = /^(.+?) vs (.+?)(?:\s*\[.*?\])?(?:\s*\|.*)?$/.exec(String(ev.text || ''));
                                                if (mp) {
                                                    const h = mp[1].trim();
                                                    const a = mp[2].trim();
                                                    return h === homeName || a === homeName || h === awayName || a === awayName;
                                                }
                                            }
                                            return false;
                                        })
                                        .sort((a, b) => {
                                            const ta = a.endTs != null ? a.endTs : (a.startTs != null ? a.startTs : (a.ts != null ? a.ts : Number.POSITIVE_INFINITY));
                                            const tb = b.endTs != null ? b.endTs : (b.startTs != null ? b.startTs : (b.ts != null ? b.ts : Number.POSITIVE_INFINITY));
                                            return tb - ta;
                                        });
                    
                                    const lastPrevEvent = prevEventsForTeams.length > 0 ? prevEventsForTeams[0] : null;
                                    const prevTeams = (() => {
                                        if (!lastPrevEvent) return [];
                                        if (lastPrevEvent.type === 'match') {
                                            const mp = /^(.+?) vs (.+?)(?:\s*\[.*?\])?(?:\s*\|.*)?$/.exec(String(lastPrevEvent.text || ''));
                                            if (mp) {
                                                return [mp[1].trim(), mp[2].trim()].filter(Boolean);
                                            }
                                        }
                                        return [];
                                    })();
                    
                                    console.log(
                                        `%c[TRANSPORT][GROUP-MEMBERS] Pavúkový zápas (${spiderTypeLabel}): "${spiderTeam}" – tímy v zápase podľa chronológie:`,
                                        'font-weight: bold; color: #ea580c;'
                                    );
                                    if (prevTeams.length > 0) {
                                        console.log(`    • Predchádzajúca udalosť: ${lastPrevEvent.when || '—'} | ${lastPrevEvent.text || ''}`);
                                        prevTeams.forEach((tn) => console.log(`    • ${tn}`));
                                    } else {
                                        console.log('    (žiadna predchádzajúca udalosť pre tímy v pavúkovom zápase)');
                                    }
                                } else {
                                    // Pôvodné správanie – ak nie je pavúkový tím v udalostiach,
                                    // vypíš tímy v skupine podľa posledného písmena.
                                    // NOVÉ: tím sa zahrnie do vlastného zoznamu LEN vtedy,
                                    // ak jeho posledné písmeno názvu NIE JE rovnaké ako
                                    // písmeno skupiny (t.j. nie je to "seba-zaradenie"
                                    // podľa posledného písmena názvu).
                                    const currentTeamLastChar = (() => {
                                        const s = String(teamName || '').trim();
                                        if (!s) return null;
                                        if (isSpiderTeamName(s)) return null;
                                        const m = /\d([A-ZÁ-Ž])\s*$/.exec(s);
                                        if (m) return m[1].toUpperCase();
                                        const m2 = /([A-ZÁ-Ž])(?=[^A-ZÁ-Ž]*$)/.exec(s.toUpperCase());
                                        return m2 ? m2[1] : null;
                                    })();

                                    const includeSelf =
                                        !currentTeamLastChar ||
                                        currentTeamLastChar !== groupCharForLog;

                                    const teamsInGroupForLog = [];
                                    (teamsArrivalBufferRef.current || []).forEach((other) => {
                                        if (cleanCategory(other.category) !== cleanCategory(category)) return;
                                        if (!other.teamName) return;

                                        const otherTn = String(other.teamName).trim();
                                        const isSelf = otherTn === String(teamName).trim();
                                        if (isSelf && !includeSelf) return;

                                        if (!teamBelongsToGroupChar(other, groupCharForLog)) return;
                                        teamsInGroupForLog.push(otherTn);
                                    });
                                    const uniqueTeamsForLog = [...new Set(teamsInGroupForLog)].sort((a, b) =>
                                        a.localeCompare(b, 'sk', { sensitivity: 'base' })
                                    );
                                    console.log(
                                        `%c[TRANSPORT][GROUP-MEMBERS] Tím "${teamName}" (skupina "${teamGroupName}", písmeno ${groupCharForLog}) – tímy v skupine (${uniqueTeamsForLog.length}):`,
                                        'font-weight: bold; color: #7c3aed;'
                                    );
                                    if (uniqueTeamsForLog.length === 0) {
                                        console.log('    (žiadne iné tímy v skupine)');
                                    } else {
                                        uniqueTeamsForLog.forEach((tn) => console.log(`    • ${tn}`));
                                    }
                                }
                            }
                        }
                    }

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
                                    if (isSamePlaceForTransfer(loc, destination)) return;
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
                                        // NOVÉ: defensívna kontrola – nevygeneruj ak sa miesto rovná cieľu
                                        if (isSamePlaceForTransfer(info.location, destination)) return;

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
                            const teamIsInUsers = teamsArrivalBufferRef.current.some(
                                (t) => cleanCategory(t.category) === cleanCategory(category)
                                    && t.teamName === teamName
                                    && t.isRegistered === true
                            );
                            const teamIsSuperstructure = !teamIsInUsers;

                            const isPlacementMatchEvent = (() => {
                                if (current.type !== 'match') return false;
                                // Detekcia z textu – "[o X. miesto]"
                                if (/\[o\s+\d+\.\s*miesto\]/i.test(String(current.text || ''))) return true;
                                // Detekcia z bufferu
                                const matchRec = (matchesBufferRef.current || []).find((m) => {
                                    if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                    if (m.home !== teamName && m.away !== teamName) return false;
                                    return m.isPlacementMatch === true;
                                });
                                return !!matchRec;
                            })();
                            
                            if (isPlacementMatchEvent && current.location) {
                                const teamGroupChar = getTeamGroupCharFromName(teamName, category);
                                if (teamGroupChar) {
                                    // NOVÉ: Použi helper na zistenie tímov v skupine
                                    const teamsInGroupWithChar = getTeamsInGroupByChar(category, teamGroupChar);

                                    // NOVÉ: Log – pre tím, ktorý je v zápase o umiestnenie, vypíš, čo sa našlo
                                    console.log(
                                        `%c[TRANSPORT][PLACEMENT] Tím "${teamName}" (písmeno skupiny: ${teamGroupChar}) – nájdených ${teamsInGroupWithChar.size} tímov v skupine "${teamGroupChar}":`,
                                        'font-weight: bold; color: #ea580c;'
                                    );
                                    [...teamsInGroupWithChar]
                                        .sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }))
                                        .forEach((tn) => console.log(`    • ${tn}`));
                            
                                    const dayForMatch = currentDay;
                                    const currentMatchStartTs = current.startTs;
                            
                                    if (dayForMatch && teamsInGroupWithChar.size > 0) {
                                        // NOVÉ: Pre každé miesto poslednej udalosti skupiny (match alebo catering)
                                        // v danom dni nájdeme NAJSKORŠÍ koniec (endTs), aby sme mali
                                        // jednotný "posledný koniec skupiny" pre každé miesto.
                                        const lastEndByPlace = new Map(); // placeName -> endTs (najneskorší koniec)
                            
                                        matchesBufferRef.current.forEach((m) => {
                                            if (cleanCategory(m.category) !== cleanCategory(category)) return;
                                            let dayKey = null;
                                            if (m.scheduledTime) {
                                                const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                                if (mm) {
                                                    dayKey = `${mm[3]}-${String(mm[2]).padStart(2, '0')}-${String(mm[1]).padStart(2, '0')}`;
                                                }
                                            }
                                            if (!dayKey && m.scheduledTs != null) {
                                                const dt = new Date(m.scheduledTs);
                                                dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                            }
                                            if (dayKey !== dayForMatch) return;
                                            if (!m.hallName) return;
                            
                                            [m.home, m.away].forEach((tn) => {
                                                if (!tn) return;
                                                if (!teamsInGroupWithChar.has(tn)) return;
                                                // Neberieme do úvahy samotný zápas o umiestnenie (aktuálny)
                                                if (tn === teamName && m.scheduledTs === current.startTs) return;
                                                const endTs = m.scheduledEndTs != null ? m.scheduledEndTs : m.scheduledTs;
                                                if (endTs == null) return;
                                                const existing = lastEndByPlace.get(m.hallName);
                                                if (!existing || endTs > existing) {
                                                    lastEndByPlace.set(m.hallName, endTs);
                                                }
                                            });
                                        });
                            
                                        cateringBufferRef.current.forEach((c) => {
                                            if (cleanCategory(c.category) !== cleanCategory(category)) return;
                                            if (c.isSuperstructure === true) return;
                                            if (c.dayKey !== dayForMatch) return;
                                            if (!c.placeName) return;
                                            if (!teamsInGroupWithChar.has(c.teamName)) return;
                                            const endTs = c.slotToTs != null ? c.slotToTs : c.ts;
                                            if (endTs == null) return;
                                            const existing = lastEndByPlace.get(c.placeName);
                                            if (!existing || endTs > existing) {
                                                lastEndByPlace.set(c.placeName, endTs);
                                            }
                                        });
                            
                                        // NOVÉ: Nájdeme miesto s najneskorším koncom – to je "posledná udalosť skupiny".
                                        let latestPlace = null;
                                        let latestEndTs = -Infinity;
                                        lastEndByPlace.forEach((endTs, placeName) => {
                                            if (endTs > latestEndTs) {
                                                latestEndTs = endTs;
                                                latestPlace = placeName;
                                            }
                                        });
                            
                                        // Ak sme našli aspoň jedno miesto, vygeneruj JEDEN presun
                                        // z miesta s najneskorším koncom na miesto zápasu o umiestnenie.
                                        if (latestPlace && latestEndTs != null && isFinite(latestEndTs)) {
                                            if (!isSamePlaceForTransfer(latestPlace, current.location)) {
                                                const departureTs = latestEndTs;
                                                const departureStr = formatFullFromTs(departureTs) || current.when;
                                                const arrivalStr = formatFullFromTs(currentMatchStartTs) || current.when;
                            
                                                if (
                                                    !(departureTs != null &&
                                                      currentMatchStartTs != null &&
                                                      departureTs >= currentMatchStartTs)
                                                ) {
                                                    let whenStr;
                                                    if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                                    else if (arrivalStr) whenStr = arrivalStr;
                                                    else whenStr = current.when;
                            
                                                    enriched.push({
                                                        ts: current.ts - 1,
                                                        when: whenStr,
                                                        type: 'transfer',
                                                        text: `Presun z ${latestPlace} do ${current.location}`,
                                                        location: null,
                                                        isTransfer: true,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            const isPavukMatchNoIdentifier = (() => {
                                if (current.type !== 'match') return false;

                                // Zisti, či ide o pavúkový zápas podľa názvu (WSF/LSF/WQF/W8F/W16F)
                                const isPavukTeamName = isSpiderTeamName(teamName);
                                if (!isPavukTeamName) return false;
                            
                                // Zisti, či ide o zápas s neidentifikovateľným tímom
                                // (domáci aj hostia nemajú pavúkový identifikátor)
                                const matchParts = /^(.+?) vs (.+?)(?:\s*\[.*?\])?(?:\s*\|.*)?$/.exec(String(current.text || ''));
                                if (!matchParts) return false;
                            
                                const homeName = matchParts[1].trim();
                                const awayName = matchParts[2].trim();
                            
                                const hasPavukIdentifier = (name) => isSpiderTeamName(name);
                                if (hasPavukIdentifier(homeName) || hasPavukIdentifier(awayName)) {
                                    // Aspoň jeden tím má pavúkový identifikátor – nie je to tento prípad
                                    return false;
                                }
                            
                                return true;
                            })();

                            // NOVÉ: Ak ide o pavúkový zápas s neidentifikovateľnými tímami,
                            // zisti miesto poslednej udalosti skupiny (podľa posledného písmena názvu tímu)
                            // a vygeneruj presun z tohto miesta na miesto aktuálneho zápasu.
                            if (isPavukMatchNoIdentifier && current.location) {
                                // Zisti posledné písmeno názvu tímu (napr. "U12 CH LSF01" → "F")
                                const teamNameLastChar = (() => {
                                    const nameMatch = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
                                    if (nameMatch) return nameMatch[1].toUpperCase();
                                    return getGroupLastChar(String(teamName).trim());
                                })();
                            
                                if (teamNameLastChar) {
                                    // Nájdi všetky tímy v skupine, ktorá končí na toto písmeno
                                    const teamsInGroupWithChar = new Set();
                                    (teamsArrivalBufferRef.current || []).forEach((t) => {
                                        if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                        if (!t.teamName) return;
                                        // NOVÉ: Skupina sa určuje VÝHRADNE z groupName, NIE z posledného písmena názvu tímu.
                                        const tGroupChar = getGroupLastChar(t.groupName);
                                        if (tGroupChar === teamNameLastChar) {
                                            teamsInGroupWithChar.add(t.teamName);
                                        }
                                    });
                            
                                    // Nájdi poslednú udalosť (match alebo catering) pre každý tím v skupine
                                    // v deň aktuálneho zápasu a zisti miesto
                                    const dayForMatch = currentDay;
                                    const lastPlacesByTeam = new Map(); // teamName -> { location, endTs }
                            
                                    if (dayForMatch) {
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
                                            if (dayKey !== dayForMatch) return;
                                            if (!m.hallName) return;
                            
                                            [m.home, m.away].forEach((tn) => {
                                                if (!tn) return;
                                                if (!teamsInGroupWithChar.has(tn)) return;
                                                const endTs = m.scheduledEndTs != null ? m.scheduledEndTs : m.scheduledTs;
                                                const existing = lastPlacesByTeam.get(tn);
                                                if (!existing || (endTs != null && endTs > (existing.endTs ?? -Infinity))) {
                                                    lastPlacesByTeam.set(tn, { location: m.hallName, endTs });
                                                }
                                            });
                                        });
                            
                                        cateringBufferRef.current.forEach((c) => {
                                            if (cleanCategory(c.category) !== cleanCategory(category)) return;
                                            if (c.isSuperstructure === true) return;
                                            if (c.dayKey !== dayForMatch) return;
                                            if (!c.placeName) return;
                                            if (!teamsInGroupWithChar.has(c.teamName)) return;
                                            const endTs = c.slotToTs != null ? c.slotToTs : c.ts;
                                            const existing = lastPlacesByTeam.get(c.teamName);
                                            if (!existing || (endTs != null && endTs > (existing.endTs ?? -Infinity))) {
                                                lastPlacesByTeam.set(c.teamName, { location: c.placeName, endTs });
                                            }
                                        });
                                    }
                            
                                    // Pre každý tím v skupine s poslednou udalosťou na inom mieste ako current.location
                                    // vygeneruj presun
                                    if (lastPlacesByTeam.size > 0) {
                                        const currentMatchStartTs = current.startTs;
                            
                                        lastPlacesByTeam.forEach((info, tn) => {
                                            if (!info.location) return;
                                            if (isSamePlaceForTransfer(info.location, current.location)) return;
                            
                                            const departureTs = info.endTs;
                                            const departureStr = formatFullFromTs(departureTs) || current.when;
                                            const arrivalStr = formatFullFromTs(currentMatchStartTs) || current.when;
                            
                                            if (
                                                departureTs != null &&
                                                currentMatchStartTs != null &&
                                                departureTs >= currentMatchStartTs
                                            ) {
                                                return;
                                            }
                            
                                            let whenStr;
                                            if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                            else if (arrivalStr) whenStr = arrivalStr;
                                            else whenStr = current.when;
                            
                                            enriched.push({
                                                ts: current.ts - 1,
                                                when: whenStr,
                                                type: 'transfer',
                                                text: `Presun z ${info.location} do ${current.location}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        });
                                    }
                                }
                            }
                        
                            const isGlobalFirstDay =
                                currentDay != null &&
                                globalFirstDay != null &&
                                currentDay === globalFirstDay;
                        
                            // NOVÉ: Zisti, či ide o pavúkový tím
                            const isPavukTeamNameForMorning = isSpiderTeamName(teamName);
                        
                            // NOVÉ: Zisti, či aktuálna udalosť je prvý pavúkový zápas tímu v danom dni.
                            // Ak tím má v ten istý deň skôr iný pavúkový zápas, aktuálna udalosť
                            // nie je prvá a ranné presuny sa negenerujú (tím už je na mieste).
                            const isFirstPavukMatchOfDay = (() => {
                                if (!isPavukTeamNameForMorning) return true;
                                if (!currentDay) return true;
                                if (current.type !== 'match') return true;
                        
                                const currentTs =
                                    current.ts ?? current.startTs ?? Number.POSITIVE_INFINITY;
                        
                                const earlierSameDayMatches = events.filter((ev) => {
                                    if (ev === current) return false;
                                    if (ev.type !== 'match') return false;
                                    const evDay = extractDayKeyFromWhen(ev.when);
                                    if (evDay !== currentDay) return false;
                                    const evTs =
                                        ev.ts ?? ev.startTs ?? Number.POSITIVE_INFINITY;
                                    return evTs < currentTs;
                                });
                        
                                return earlierSameDayMatches.length === 0;
                            })();
                        
                            // Pomocná: existuje aspoň jeden users tím v kategórii, ktorý má v tento deň udalosť?
                            const anyUsersTeamHasEventToday = (() => {
                                if (!currentDay) return false;
                                const categoryClean = cleanCategory(category);
                                return (teamsArrivalBufferRef.current || []).some((t) => {
                                    if (cleanCategory(t.category) !== categoryClean) return false;
                                    if (t.isRegistered !== true) return false;
                                    if (t.isSuperstructure === true) return false;
                                    const hasMatch = (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== categoryClean) return false;
                                        if (m.home !== t.teamName && m.away !== t.teamName) return false;
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) dayKey = `${mm[3]}-${String(mm[2]).padStart(2, '0')}-${String(mm[1]).padStart(2, '0')}`;
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        return dayKey === currentDay;
                                    });
                                    if (hasMatch) return true;
                                    return (cateringBufferRef.current || []).some((c) => {
                                        if (cleanCategory(c.category) !== categoryClean) return false;
                                        if (c.teamName !== t.teamName) return false;
                                        return c.dayKey === currentDay;
                                    });
                                });
                            })();
                        
                            // Pomocná: existuje aspoň jeden superstructure tím v kategórii, ktorý má v tento deň udalosť?
                            const anySuperstructureTeamHasEventToday = (() => {
                                if (!currentDay) return false;
                                const categoryClean = cleanCategory(category);
                                return (teamsArrivalBufferRef.current || []).some((t) => {
                                    if (cleanCategory(t.category) !== categoryClean) return false;
                                    if (t.isSuperstructure !== true) return false;
                                    return (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== categoryClean) return false;
                                        if (m.home !== t.teamName && m.away !== t.teamName) return false;
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) dayKey = `${mm[3]}-${String(mm[2]).padStart(2, '0')}-${String(mm[1]).padStart(2, '0')}`;
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        return dayKey === currentDay;
                                    });
                                });
                            })();
                        
                            // ============ VETVA PRE USERS TÍM ============
                            if (teamIsInUsers) {
                                // NOVÉ: Ak je aktuálna udalosť pavúkový zápas (tím má v názve
                                // identifikátor WSF/LSF/WQF/W8F/W16F), negeneruj ranný presun
                                // z miesta zrazu pred touto udalosťou.
                                const isPavukMatchEvent =
                                    current.type === 'match' &&
                                    isSpiderTeamName(teamName);

                                // NOVÉ: Zisti, či je tento pavúkový zápas "nadväzujúci" – t.j.
                                // tím už odohral v ten istý deň skôr iný pavúkový zápas, alebo
                                // je miesto poslednej udalosti skupiny (kde tím hral) rovnaké
                                // ako miesto aktuálneho zápasu.
                                //
                                // V takom prípade sa NESMIE generovať ani ranný presun
                                // z miesta zrazu (tím už je na mieste).
                                const isPavukFollowUpMatchSamePlace = (() => {
                                    if (!isPavukMatchEvent) return false;
                                    if (!currentDay) return false;
                                    if (!current.location) return false;

                                    const currentStartTs =
                                        current.startTs ?? current.ts ?? Number.POSITIVE_INFINITY;

                                    // (a) Existuje skôr iný pavúkový zápas tímu v ten istý deň?
                                    const hasEarlierPavukMatchSameDay = events.some((ev) => {
                                        if (ev === current) return false;
                                        if (ev.type !== 'match') return false;
                                        const evDay = extractDayKeyFromWhen(ev.when);
                                        if (evDay !== currentDay) return false;
                                        const evTs =
                                            ev.startTs ?? ev.ts ?? Number.POSITIVE_INFINITY;
                                        return evTs < currentStartTs;
                                    });
                                    if (hasEarlierPavukMatchSameDay) return true;

                                    // (b) Je miesto poslednej udalosti v ten istý deň (match alebo
                                    // catering kohokoľvek v kategórii) rovnaké ako current.location?
                                    let lastPlaceForCategoryOnDay = null;
                                    let lastPlaceEndTs = -Infinity;

                                    matchesBufferRef.current.forEach((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return;
                                        let dk = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                dk = `${mm[3]}-${String(mm[2]).padStart(2, '0')}-${String(mm[1]).padStart(2, '0')}`;
                                            }
                                        }
                                        if (!dk && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        if (dk !== currentDay) return;
                                        if (!m.hallName) return;
                                        const endTs = m.scheduledEndTs != null
                                            ? m.scheduledEndTs
                                            : (m.scheduledTs != null ? m.scheduledTs : null);
                                        if (endTs == null) return;
                                        if (endTs > lastPlaceEndTs) {
                                            lastPlaceEndTs = endTs;
                                            lastPlaceForCategoryOnDay = m.hallName;
                                        }
                                    });

                                    cateringBufferRef.current.forEach((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return;
                                        if (c.dayKey !== currentDay) return;
                                        if (!c.placeName) return;
                                        const endTs = c.slotToTs != null ? c.slotToTs : c.ts;
                                        if (endTs == null) return;
                                        if (endTs > lastPlaceEndTs) {
                                            lastPlaceEndTs = endTs;
                                            lastPlaceForCategoryOnDay = c.placeName;
                                        }
                                    });

                                    if (
                                        lastPlaceForCategoryOnDay &&
                                        isSamePlaceForTransfer(lastPlaceForCategoryOnDay, current.location)
                                    ) {
                                        return true;
                                    }

                                    return false;
                                })();

                                if (isPlacementMatchEvent) {
                                    // skip – presun už bol vygenerovaný z poslednej udalosti skupiny
                                } else if (isPavukMatchEvent && isPavukFollowUpMatchSamePlace) {
                                    // skip – nadväzujúci pavúkový zápas na tom istom mieste
                                    // nemá ranný presun z miesta zrazu
                                } else if (isPavukMatchEvent) {
                                    // skip – pavúkový zápas nemá ranný presun z miesta zrazu
                                } else if (anySuperstructureTeamHasEventToday) {
                                    // Ak v tento deň hrá superstructure tím:
                                    // - users tím S ubytovaním → ranný presun Z UBYTOVANIA na prvú udalosť dňa
                                    // - users tím BEZ ubytovania → ranný presun Z MIESTA ZRAZU na prvú udalosť dňa
                                    const hasAccommodationForMorning =
                                        accommodationName && accommodationName.trim() !== '';

                                    let fromLocationName = null;
                                    let fromLabel = null;

                                    if (hasAccommodationForMorning) {
                                        fromLocationName = accommodationName.trim();
                                        fromLabel = `ubytovanie ${accommodationName.trim()}`;
                                    } else if (meetingPointStop) {
                                        fromLocationName = meetingPointStop.name;
                                        fromLabel = `miesto zrazu ${meetingPointStop.name}`;
                                    }

                                    if (fromLocationName && !isSamePlaceForTransfer(fromLocationName, current.location)) {
                                        const arrivalTs = current.startTs;
                                        const arrivalStr = formatFullFromTs(arrivalTs) || current.when;
                                        const departureTs = timestampOnDay(arrivalTs, 0, 0);
                                        const departureStr = formatFullFromTs(departureTs) || '00:00';

                                        if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                            let whenStr;
                                            if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                            else if (arrivalStr) whenStr = arrivalStr;
                                            else whenStr = current.when;
                                            enriched.push({
                                                ts: current.ts - 1,
                                                when: whenStr,
                                                type: 'transfer',
                                                text: `Presun z ${fromLabel} do ${current.location}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        }
                                    }
                                } else if (isGlobalFirstDay) {
                                    // PRVÝ DEŇ: ranný presun pred prvou udalosťou
                                    const arrivalTypeNorm = String(teamArrivalType || '')
                                        .toLowerCase()
                                        .normalize('NFD')
                                        .replace(/[\u0300-\u036f]/g, '')
                                        .trim();
                                    const hasPublicTransport = arrivalTypeNorm.includes('verejn') || arrivalTypeNorm.includes('autobus') || arrivalTypeNorm.includes('vlak');
                                    const hasOwnOrNoTransport = arrivalTypeNorm.includes('vlastn') || arrivalTypeNorm.includes('bez dopravy') || arrivalTypeNorm.includes('ziadna') || arrivalTypeNorm.includes('žiadna');
                        
                                    let fromLocationName = null;
                                    let fromLabel = null;
                        
                                    if (hasPublicTransport && externalArrivalStop) {
                                        fromLocationName = externalArrivalStop.name;
                                        fromLabel = `zastávka ${externalArrivalStop.name}`;
                                    } else if (hasOwnOrNoTransport && meetingPointStop) {
                                        fromLocationName = meetingPointStop.name;
                                        fromLabel = `miesto zrazu ${meetingPointStop.name}`;
                                    }
                        
                                    if (fromLocationName && !isSamePlaceForTransfer(fromLocationName, current.location)) {
                                        const arrivalTs = current.startTs;
                                        const arrivalStr = formatFullFromTs(arrivalTs) || current.when;
                                        let departureTs;
                                        let departureStr;
                                        if (hasPublicTransport) {
                                            const teamArrivalTime = (arrivalTimeByTeam[category] && arrivalTimeByTeam[category][teamName]) || '';
                                            if (teamArrivalTime && /^\d{1,2}:\d{2}$/.test(teamArrivalTime)) {
                                                const [h, mi] = teamArrivalTime.split(':').map(Number);
                                                departureTs = timestampOnDay(arrivalTs || midnightFromWhen(current.when), h, mi);
                                                departureStr = formatFullFromTs(departureTs) || teamArrivalTime;
                                            } else {
                                                departureTs = timestampOnDay(arrivalTs, 0, 0);
                                                departureStr = formatFullFromTs(departureTs) || '00:00';
                                            }
                                        } else {
                                            const globalArrivalTs = window.__transport_tournamentArrivalDate || null;
                                            if (globalArrivalTs != null && isFinite(globalArrivalTs)) {
                                                departureTs = globalArrivalTs;
                                                departureStr = formatFullFromTs(departureTs) || '—';
                                            } else {
                                                departureTs = timestampOnDay(arrivalTs, 0, 0);
                                                departureStr = formatFullFromTs(departureTs) || '00:00';
                                            }
                                        }
                                        const skip = departureTs != null && arrivalTs != null && departureTs >= arrivalTs;
                                        if (!skip) {
                                            let whenStr;
                                            if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                            else if (arrivalStr) whenStr = arrivalStr;
                                            else whenStr = current.when;
                                            enriched.push({
                                                ts: current.ts - 1,
                                                when: whenStr,
                                                type: 'transfer',
                                                text: `Presun z ${fromLabel} do ${current.location}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        }
                                    }
                                } else {
                                    // ĎALŠÍ DEŇ: ranný presun z ubytovne, inak z miesta zrazu
                                    let fromLocationName = null;
                                    let fromLabel = null;
                                    if (accommodationName && accommodationName.trim() !== '') {
                                        fromLocationName = accommodationName.trim();
                                        fromLabel = `ubytovanie ${accommodationName.trim()}`;
                                    } else if (meetingPointStop) {
                                        fromLocationName = meetingPointStop.name;
                                        fromLabel = `miesto zrazu ${meetingPointStop.name}`;
                                    }
                                    if (fromLocationName && !isSamePlaceForTransfer(fromLocationName, current.location)) {
                                        const arrivalTs = current.startTs;
                                        const arrivalStr = formatFullFromTs(arrivalTs) || current.when;
                                        const departureTs = timestampOnDay(arrivalTs, 0, 0);
                                        const departureStr = formatFullFromTs(departureTs) || '00:00';
                                        if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                            let whenStr;
                                            if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                            else if (arrivalStr) whenStr = arrivalStr;
                                            else whenStr = current.when;
                                            enriched.push({
                                                ts: current.ts - 1,
                                                when: whenStr,
                                                type: 'transfer',
                                                text: `Presun z ${fromLabel} do ${current.location}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        }
                                    }
                                }
                            } else {
                                // ============ VETVA PRE SUPERSTRUCTURE TÍM ============
                                // NOVÉ: Zisti, či je aktuálna udalosť pavúkový zápas
                                const isPavukMatchEventForSS =
                                    current.type === 'match' &&
                                    isSpiderTeamName(teamName);
                            
                                // NOVÉ: Pre superstructure tím (nie pavúkový) vždy, keď má v danom dni
                                // prvú udalosť, vygeneruj presuny z miest posledných udalostí tímov
                                // v skupine určenej posledným písmenom názvu superstructure tímu.
                                const isSuperstructureTeamForDailyTransfer =
                                    !teamIsInUsers && !isSpiderTeamName(teamName) && currentDay != null && current.location;
                            
                                if (isSuperstructureTeamForDailyTransfer) {
                                    // Zisti písmeno skupiny z posledného písmena názvu superstructure tímu
                                    // (napr. "U12 CH 1A" → "A", "U12 D 3G" → "G").
                                    const ssTeamLastChar = (() => {
                                        const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
                                        if (m) return m[1].toUpperCase();
                                        return getGroupLastChar(String(teamName).trim());
                                    })();
                            
                                    if (ssTeamLastChar) {
                                        // Zisti, či je aktuálna udalosť PRVÁ udalosť superstructure tímu v danom dni.
                                        const currentStartTsForFirst =
                                            current.startTs ?? current.ts ?? Number.POSITIVE_INFINITY;
                                        const hasEarlierSameDayEventForSS = events.some((ev) => {
                                            if (ev === current) return false;
                                            const evDay = extractDayKeyFromWhen(ev.when);
                                            if (evDay !== currentDay) return false;
                                            const evTs =
                                                ev.startTs ?? ev.ts ?? Number.POSITIVE_INFINITY;
                                            return evTs < currentStartTsForFirst;
                                        });
                            
                                        if (!hasEarlierSameDayEventForSS) {
                                            // NOVÉ: Nájdi všetky INÉ tímy v rovnakej skupine (podľa groupName).
                                            // Pre tieto tímy budeme zisťovať, kde končia svoj posledný deň.
                                            const otherTeamsInSameGroup = (teamsArrivalBufferRef.current || []).filter((t) => {
                                                if (cleanCategory(t.category) !== cleanCategory(category)) return false;
                                                if (!t.teamName) return false;
                                                if (String(t.teamName).trim() === String(teamName).trim()) return false;
                                                return teamBelongsToGroupChar(t, ssTeamLastChar);
                                            });
                            
                                            // NOVÉ: Pre každý iný tím v skupine zisti miesto jeho POSLEDNEJ udalosti
                                            // (match alebo catering) v daný deň.
                                            const lastPlaceByTeamInGroup = (() => {
                                                if (!currentDay) return new Map();
                                                const result = new Map(); // teamName -> { location, endTs }
                                                const categoryClean = cleanCategory(category);
                            
                                                // 1) Zápasy tímov v skupine
                                                matchesBufferRef.current.forEach((m) => {
                                                    if (cleanCategory(m.category) !== categoryClean) return;
                                                    let dayKey = null;
                                                    if (m.scheduledTime) {
                                                        const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                                        if (mm) {
                                                            dayKey = `${mm[3]}-${String(mm[2]).padStart(2, '0')}-${String(mm[1]).padStart(2, '0')}`;
                                                        }
                                                    }
                                                    if (!dayKey && m.scheduledTs != null) {
                                                        const dt = new Date(m.scheduledTs);
                                                        dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                                    }
                                                    if (dayKey !== currentDay) return;
                                                    if (!m.hallName) return;
                            
                                                    [m.home, m.away].forEach((tn) => {
                                                        if (!tn) return;
                                                        const otherTn = String(tn).trim();
                                                        if (otherTn === String(teamName || '').trim()) return;
                                                        if (!otherTeamsInSameGroup.some(t => String(t.teamName).trim() === otherTn)) return;
                            
                                                        const endTs = m.scheduledEndTs != null ? m.scheduledEndTs : m.scheduledTs;
                                                        if (endTs == null) return;
                            
                                                        const existing = result.get(otherTn);
                                                        if (!existing || endTs > existing.endTs) {
                                                            result.set(otherTn, { location: m.hallName, endTs });
                                                        }
                                                    });
                                                });
                            
                                                // 2) Stravovanie tímov v skupine
                                                cateringBufferRef.current.forEach((c) => {
                                                    if (cleanCategory(c.category) !== categoryClean) return;
                                                    if (c.dayKey !== currentDay) return;
                                                    if (!c.placeName) return;
                            
                                                    const otherTn = String(c.teamName || '').trim();
                                                    if (!otherTn) return;
                                                    if (otherTn === String(teamName || '').trim()) return;
                                                    if (!otherTeamsInSameGroup.some(t => String(t.teamName).trim() === otherTn)) return;
                            
                                                    const endTs = c.slotToTs != null ? c.slotToTs : c.ts;
                                                    if (endTs == null) return;
                            
                                                    const existing = result.get(otherTn);
                                                    if (!existing || endTs > existing.endTs) {
                                                        result.set(otherTn, { location: c.placeName, endTs });
                                                    }
                                                });
                            
                                                return result;
                                            })();
                            
                                            const anyOtherTeamHasEvent = lastPlaceByTeamInGroup.size > 0;
                            
                                            if (anyOtherTeamHasEvent) {
                                                // NOVÉ: Zisti, či existuje aspoň jedno miesto poslednej udalosti iného tímu v skupine,
                                                // ktoré je INÉ ako miesto prvej udalosti aktuálneho tímu (current.location).
                                                // Ak áno, vygeneruj presun LEN z týchto odlišných miest.
                                                // Ak nie (všetky posledné miesta sú rovnaké ako current.location), ranné presuny sa negenerujú.
                                                const lastPlacesDifferentFromCurrent = new Map(); // placeName -> endTs (najneskorší)
                                                lastPlaceByTeamInGroup.forEach((info) => {
                                                    if (!info.location) return;
                                                    if (isSamePlaceForTransfer(info.location, current.location)) return;
                                                    const existing = lastPlacesDifferentFromCurrent.get(info.location);
                                                    if (!existing || info.endTs > existing) {
                                                        lastPlacesDifferentFromCurrent.set(info.location, info.endTs);
                                                    }
                                                });
                            
                                                const hasAnyDifferentLastPlace = lastPlacesDifferentFromCurrent.size > 0;
                            
                                                if (hasAnyDifferentLastPlace) {
                                                    // Vygeneruj presun LEN z tých odlišných miest na current.location.
                                                    const currentEventStartTs = current.startTs ?? current.ts ?? null;
                                                    const arrivalStr = formatFullFromTs(currentEventStartTs) || current.when;
                            
                                                    lastPlacesDifferentFromCurrent.forEach((endTs, placeName) => {
                                                        if (!placeName) return;
                                                        if (isSamePlaceForTransfer(placeName, current.location)) return;
                            
                                                        const departureTs = endTs;
                                                        const departureStr = formatFullFromTs(departureTs) || current.when;
                            
                                                        if (
                                                            departureTs != null &&
                                                            currentEventStartTs != null &&
                                                            departureTs >= currentEventStartTs
                                                        ) {
                                                            return;
                                                        }
                            
                                                        let whenStr;
                                                        if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                                        else if (arrivalStr) whenStr = arrivalStr;
                                                        else whenStr = current.when;
                            
                                                        enriched.push({
                                                            ts: current.ts - 1,
                                                            when: whenStr,
                                                            type: 'transfer',
                                                            text: `Presun z ${placeName} do ${current.location}`,
                                                            location: null,
                                                            isTransfer: true,
                                                        });
                                                    });
                                                }
                                                // Ak hasAnyDifferentLastPlace === false → negeneruj nič (všetci už sú na mieste).
                                            } else {
                                                // Žiadny iný tím v skupine nemá v tento deň udalosť.
                                                // Pokračuj pôvodnou logikou pre generovanie ranných presunov.
                                                if (anyUsersTeamHasEventToday) {
                                                    // skip – pravidlo: ak hrá users tím, SS tím nemá ranné presuny
                                                } else if (isPavukMatchEventForSS && isPavukFollowUpMatchSamePlaceForSS) {
                                                    // skip – nadväzujúci pavúkový zápas na tom istom mieste
                                                    // nemá ranný presun z miesta zrazu
                                                } else if (isPavukMatchEventForSS && categoryAlreadyPlayedAtSamePlaceTodayForSS) {
                                                    // NOVÉ: V kategórii sa v ten istý deň už hral zápas v tej istej
                                                    // hale (napr. semifinále v UNIZA) – pavúkový tím (LSF/WSF)
                                                    // je už na mieste, ranný presun z miesta zrazu sa negeneruje.
                                                } else if (!isFirstPavukMatchOfDay) {
                                                    // NOVÉ: Ak ide o pavúkový tím a má v ten deň skôr iný pavúkový zápas,
                                                    // negeneruj ranné presuny (ani z miesta zrazu).
                                                    // Tím už je na mieste z predchádzajúceho zápasu.
                                                } else if (isGlobalFirstDay) {
                                                    // NOVÉ: pavúkový zápas – negenerovať ani presun z miesta zrazu
                                                    if (isPavukTeamNameForMorning) {
                                                        // skip – pavúkový tím nemá ranný presun z miesta zrazu
                                                    } else if (meetingPointStop && !isSamePlaceForTransfer(meetingPointStop.name, current.location)) {
                                                        const arrivalTs = current.startTs;
                                                        const arrivalStr = formatFullFromTs(arrivalTs) || current.when;
                                                        const globalArrivalTs = window.__transport_tournamentArrivalDate || null;
                                                        const departureTs = globalArrivalTs != null && isFinite(globalArrivalTs)
                                                            ? globalArrivalTs
                                                            : timestampOnDay(arrivalTs, 0, 0);
                                                        const departureStr = formatFullFromTs(departureTs) || '00:00';
                                                        if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                                            let whenStr;
                                                            if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                                            else if (arrivalStr) whenStr = arrivalStr;
                                                            else whenStr = current.when;
                                                            enriched.push({
                                                                ts: current.ts - 1,
                                                                when: whenStr,
                                                                type: 'transfer',
                                                                text: `Presun z miesto zrazu ${meetingPointStop.name} do ${current.location}`,
                                                                location: null,
                                                                isTransfer: true,
                                                            });
                                                        }
                                                    }
                                                } else {
                                                    // ďalší deň: ranný presun z ubytovní skupiny (ak sú) + z miesta zrazu
                                                    const groupChar = groupCharForSS;
                                                    if (groupChar) {
                                                        const groupAccommodations = (() => {
                                                            const cacheKey = `${cleanCategory(category)}|skupina ${groupChar}`;
                                                            return (window.__transport_accommodationsByGroup || {})[cacheKey] || [];
                                                        })();
                                                        const sources = new Set();
                                                        groupAccommodations.forEach((a) => {
                                                            if (a && a.trim()) sources.add(a.trim());
                                                        });
                                                        if (meetingPointStop) {
                                                            sources.add(meetingPointStop.name);
                                                        }
                                                        // NOVÉ: vyhoď zdroje, ktoré sú rovnaké ako cieľ
                                                        const filteredSources = [...sources].filter(
                                                            (src) => !isSamePlaceForTransfer(src, current.location)
                                                        );
                            
                                                        const arrivalTs = current.startTs;
                                                        const arrivalStr = formatFullFromTs(arrivalTs) || current.when;
                                                        const departureTs = timestampOnDay(arrivalTs, 0, 0);
                                                        const departureStr = formatFullFromTs(departureTs) || '00:00';
                                                        if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                                            filteredSources.forEach((src) => {
                                                                const isMP = meetingPointStop && src === meetingPointStop.name;
                                                                const fromLabel = isMP ? `miesto zrazu ${src}` : `ubytovanie ${src}`;
                                                                let whenStr;
                                                                if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                                                else if (arrivalStr) whenStr = arrivalStr;
                                                                else whenStr = current.when;
                                                                enriched.push({
                                                                    ts: current.ts - 1,
                                                                    when: whenStr,
                                                                    type: 'transfer',
                                                                    text: `Presun z ${fromLabel} do ${current.location}`,
                                                                    location: null,
                                                                    isTransfer: true,
                                                                });
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            
                                // NOVÉ: Zisti, či je tento pavúkový zápas "nadväzujúci" – t.j.
                                // tím už odohral v ten istý deň skôr iný pavúkový zápas, alebo
                                // je miesto poslednej udalosti v kategórii v ten istý deň rovnaké
                                // ako miesto aktuálneho zápasu.
                                //
                                // V takom prípade sa NESMIE generovať ani ranný presun
                                // z miesta zrazu (tím už je na mieste).
                                const isPavukFollowUpMatchSamePlaceForSS = (() => {
                                    if (!isPavukMatchEventForSS) return false;
                                    if (!currentDay) return false;
                                    if (!current.location) return false;
                            
                                    const currentStartTs =
                                        current.startTs ?? current.ts ?? Number.POSITIVE_INFINITY;
                            
                                    // (a) Existuje skôr iný pavúkový zápas tímu v ten istý deň?
                                    const hasEarlierPavukMatchSameDay = events.some((ev) => {
                                        if (ev === current) return false;
                                        if (ev.type !== 'match') return false;
                                        const evDay = extractDayKeyFromWhen(ev.when);
                                        if (evDay !== currentDay) return false;
                                        const evTs =
                                            ev.startTs ?? ev.ts ?? Number.POSITIVE_INFINITY;
                                        return evTs < currentStartTs;
                                    });
                                    if (hasEarlierPavukMatchSameDay) return true;
                            
                                    // (b) Je miesto poslednej udalosti v ten istý deň (match alebo
                                    // catering kohokoľvek v kategórii) rovnaké ako current.location?
                                    let lastPlaceForCategoryOnDay = null;
                                    let lastPlaceEndTs = -Infinity;
                            
                                    matchesBufferRef.current.forEach((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return;
                                        let dk = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                dk = `${mm[3]}-${String(mm[2]).padStart(2, '0')}-${String(mm[1]).padStart(2, '0')}`;
                                            }
                                        }
                                        if (!dk && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        if (dk !== currentDay) return;
                                        if (!m.hallName) return;
                                        const endTs = m.scheduledEndTs != null
                                            ? m.scheduledEndTs
                                            : (m.scheduledTs != null ? m.scheduledTs : null);
                                        if (endTs == null) return;
                                        if (endTs > lastPlaceEndTs) {
                                            lastPlaceEndTs = endTs;
                                            lastPlaceForCategoryOnDay = m.hallName;
                                        }
                                    });
                            
                                    cateringBufferRef.current.forEach((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return;
                                        if (c.dayKey !== currentDay) return;
                                        if (!c.placeName) return;
                                        const endTs = c.slotToTs != null ? c.slotToTs : c.ts;
                                        if (endTs == null) return;
                                        if (endTs > lastPlaceEndTs) {
                                            lastPlaceEndTs = endTs;
                                            lastPlaceForCategoryOnDay = c.placeName;
                                        }
                                    });
                            
                                    if (
                                        lastPlaceForCategoryOnDay &&
                                        isSamePlaceForTransfer(lastPlaceForCategoryOnDay, current.location)
                                    ) {
                                        return true;
                                    }
                            
                                    return false;
                                })();
                            
                                // NOVÉ: Ak v tento deň má udalosť aspoň jeden users tím, negeneruj ranné presuny pre SS tím
                                const categoryAlreadyPlayedAtSamePlaceTodayForSS = (() => {
                                    if (!currentDay) return false;
                                    if (!current.location) return false;
                                    if (current.type !== 'match') return false;
                            
                                    const currentStartTs =
                                        current.startTs ?? current.ts ?? Number.POSITIVE_INFINITY;
                            
                                    return matchesBufferRef.current.some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                        if (!m.hallName) return false;
                                        if (!isSamePlaceForTransfer(m.hallName, current.location)) return false;
                            
                                        let dk = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                dk = `${mm[3]}-${String(mm[2]).padStart(2, '0')}-${String(mm[1]).padStart(2, '0')}`;
                                            }
                                        }
                                        if (!dk && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        if (dk !== currentDay) return false;
                            
                                        const mEndTs =
                                            m.scheduledEndTs != null
                                                ? m.scheduledEndTs
                                                : (m.scheduledTs != null ? m.scheduledTs : null);
                                        if (mEndTs == null) return false;
                                        return mEndTs <= currentStartTs;
                                    });
                                })();
                            
                                const anyTeamInSameGroupAlreadyAtSamePlaceToday = (() => {
                                    if (!currentDay) return false;
                                    const categoryClean = cleanCategory(category);
                                
                                    // Pre pavúkový tím nemá zmysel – pavúkový tím nemá skupinu podľa groupName.
                                    if (isSpiderTeamName(teamName)) return false;
                                
                                    // Zisti groupName aktuálneho tímu (z bufferu alebo zo settings/superstructureGroups)
                                    const currentTeamInfo = (teamsArrivalBufferRef.current || []).find(
                                        (t) => cleanCategory(t.category) === categoryClean
                                            && String(t.teamName || '').trim() === String(teamName || '').trim()
                                    );
                                    let currentTeamGroupName = currentTeamInfo && currentTeamInfo.groupName
                                        ? String(currentTeamInfo.groupName).trim()
                                        : null;
                                
                                    // Fallback: ak tím nemá groupName v bufferi, skúsime settings/superstructureGroups
                                    if (!currentTeamGroupName) {
                                        const ssGroups = superstructureGroupsRef.current || {};
                                        for (const [groupKey, teamNames] of Object.entries(ssGroups)) {
                                            const [keyCat, keyGroup] = String(groupKey).split('|');
                                            if (cleanCategory(keyCat) !== categoryClean) continue;
                                            if (!Array.isArray(teamNames)) continue;
                                            if (teamNames.some((n) => String(n || '').trim() === String(teamName || '').trim())) {
                                                currentTeamGroupName = keyGroup;
                                                break;
                                            }
                                        }
                                    }
                                
                                    if (!currentTeamGroupName) return false;
                                
                                    // Miesto prvej udalosti aktuálneho tímu v danom dni
                                    const currentEventPlace = current.location || null;
                                    if (!currentEventPlace) return false;
                                
                                    // Prejdi všetky tímy v rovnakej skupine (okrem aktuálneho) a zisti,
                                    // či niektorý už v ten deň hral/bol na ROVNAKOM mieste.
                                    return (teamsArrivalBufferRef.current || []).some((other) => {
                                        if (cleanCategory(other.category) !== categoryClean) return false;
                                        if (!other.teamName) return false;
                                        const otherTn = String(other.teamName).trim();
                                        if (otherTn === String(teamName || '').trim()) return false;
                                
                                        // Musí ísť o tím v rovnakej skupine
                                        const otherGroupName = other.groupName ? String(other.groupName).trim() : null;
                                        if (!otherGroupName || otherGroupName !== currentTeamGroupName) return false;
                                
                                        // 1) Zápasy iného tímu v ten istý deň – hľadaj, či hral na rovnakom mieste
                                        const hasMatchAtSamePlace = (matchesBufferRef.current || []).some((m) => {
                                            if (cleanCategory(m.category) !== categoryClean) return false;
                                            if (m.home !== otherTn && m.away !== otherTn) return false;
                                            let dayKey = null;
                                            if (m.scheduledTime) {
                                                const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                                if (mm) dayKey = `${mm[3]}-${String(mm[2]).padStart(2, '0')}-${String(mm[1]).padStart(2, '0')}`;
                                            }
                                            if (!dayKey && m.scheduledTs != null) {
                                                const dt = new Date(m.scheduledTs);
                                                dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                            }
                                            if (dayKey !== currentDay) return false;
                                            if (!m.hallName) return false;
                                            return isSamePlaceForTransfer(m.hallName, currentEventPlace);
                                        });
                                        if (hasMatchAtSamePlace) return true;
                                
                                        // 2) Stravovanie iného tímu v ten istý deň – hľadaj, či bolo na rovnakom mieste
                                        return (cateringBufferRef.current || []).some((c) => {
                                            if (cleanCategory(c.category) !== categoryClean) return false;
                                            if (String(c.teamName || '').trim() !== otherTn) return false;
                                            if (c.dayKey !== currentDay) return false;
                                            if (!c.placeName) return false;
                                            return isSamePlaceForTransfer(c.placeName, currentEventPlace);
                                        });
                                    });
                                })();
                            
                                // NOVÉ: Ak v tento deň má udalosť aspoň jeden users tím, negeneruj ranné presuny pre SS tím
                                if (isPlacementMatchEvent) {
                                    // skip – presun už bol vygenerovaný z poslednej udalosti skupiny
                                } else if (anyTeamInSameGroupAlreadyAtSamePlaceToday) {
                                    // NOVÉ: Ak v tento deň hrá aspoň jeden INÝ tím v rovnakej skupine,
                                    // ranné presuny z ubytovní/miesta zrazu sa NEGENERUJÚ.
                                    // Presuny sa generujú z miesta poslednej udalosti skupiny
                                    // (blok isSuperstructureTeamForDailyTransfer vyššie).
                                } else if (anyUsersTeamHasEventToday) {
                                    // skip – pravidlo: ak hrá users tím, SS tím nemá ranné presuny
                                } else if (isPavukMatchEventForSS && isPavukFollowUpMatchSamePlaceForSS) {
                                    // skip – nadväzujúci pavúkový zápas na tom istom mieste
                                    // nemá ranný presun z miesta zrazu
                                } else if (isPavukMatchEventForSS && categoryAlreadyPlayedAtSamePlaceTodayForSS) {
                                    // NOVÉ: V kategórii sa v ten istý deň už hral zápas v tej istej
                                    // hale (napr. semifinále v UNIZA) – pavúkový tím (LSF/WSF)
                                    // je už na mieste, ranný presun z miesta zrazu sa negeneruje.
                                } else if (!isFirstPavukMatchOfDay) {
                                    // NOVÉ: Ak ide o pavúkový tím a má v ten deň skôr iný pavúkový zápas,
                                    // negeneruj ranné presuny (ani z miesta zrazu).
                                    // Tím už je na mieste z predchádzajúceho zápasu.
                                } else if (isGlobalFirstDay) {
                                    // NOVÉ: pavúkový zápas – negenerovať ani presun z miesta zrazu
                                    if (isPavukTeamNameForMorning) {
                                        // skip – pavúkový tím nemá ranný presun z miesta zrazu
                                    } else if (anyTeamInSameGroupAlreadyAtSamePlaceToday) {
                                        // NOVÉ: Ak niektorý iný tím z rovnakej skupiny už v ten istý deň
                                        // hral/bol na ROVNAKOM mieste, aktuálny superstructure tím je už
                                        // "na mieste" → negeneruj ani ranný presun z miesta zrazu.
                                    } else if (meetingPointStop && !isSamePlaceForTransfer(meetingPointStop.name, current.location)) {
                                        const arrivalTs = current.startTs;
                                        const arrivalStr = formatFullFromTs(arrivalTs) || current.when;
                                        const globalArrivalTs = window.__transport_tournamentArrivalDate || null;
                                        const departureTs = globalArrivalTs != null && isFinite(globalArrivalTs)
                                            ? globalArrivalTs
                                            : timestampOnDay(arrivalTs, 0, 0);
                                        const departureStr = formatFullFromTs(departureTs) || '00:00';
                                        if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                            let whenStr;
                                            if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                            else if (arrivalStr) whenStr = arrivalStr;
                                            else whenStr = current.when;
                                            enriched.push({
                                                ts: current.ts - 1,
                                                when: whenStr,
                                                type: 'transfer',
                                                text: `Presun z miesto zrazu ${meetingPointStop.name} do ${current.location}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        }
                                    }
                                } else {
                                    // ďalší deň: ranný presun z ubytovní skupiny (ak sú) + z miesta zrazu
                                    const groupChar = groupCharForSS;
                                    if (groupChar) {
                                        const groupAccommodations = (() => {
                                            const cacheKey = `${cleanCategory(category)}|skupina ${groupChar}`;
                                            return (window.__transport_accommodationsByGroup || {})[cacheKey] || [];
                                        })();
                                        const sources = new Set();
                                        groupAccommodations.forEach((a) => {
                                            if (a && a.trim()) sources.add(a.trim());
                                        });
                                        if (meetingPointStop) {
                                            sources.add(meetingPointStop.name);
                                        }
                                        // NOVÉ: vyhoď zdroje, ktoré sú rovnaké ako cieľ
                                        const filteredSources = [...sources].filter(
                                            (src) => !isSamePlaceForTransfer(src, current.location)
                                        );

                                        const arrivalTs = current.startTs;
                                        const arrivalStr = formatFullFromTs(arrivalTs) || current.when;
                                        const departureTs = timestampOnDay(arrivalTs, 0, 0);
                                        const departureStr = formatFullFromTs(departureTs) || '00:00';
                                        if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                            filteredSources.forEach((src) => {
                                                const isMP = meetingPointStop && src === meetingPointStop.name;
                                                const fromLabel = isMP ? `miesto zrazu ${src}` : `ubytovanie ${src}`;
                                                let whenStr;
                                                if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                                else if (arrivalStr) whenStr = arrivalStr;
                                                else whenStr = current.when;
                                                enriched.push({
                                                    ts: current.ts - 1,
                                                    when: whenStr,
                                                    type: 'transfer',
                                                    text: `Presun z ${fromLabel} do ${current.location}`,
                                                    location: null,
                                                    isTransfer: true,
                                                });
                                            });
                                        }
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
                            currentDay != null &&
                            nextDay != null &&
                            currentDay === nextDay
                        ) {
                            // NOVÉ: negenerovať presun, ak je miesto odkiaľ rovnaké ako miesto kam
                            if (isSamePlaceForTransfer(current.location, next.location)) {
                                // preskočiť – to isté miesto
                            } else {
                                const departureTs =
                                    current.endTs != null ? current.endTs : current.startTs;
                                const arrivalTs =
                                    next.startTs != null ? next.startTs : null;
                        
                                if (
                                    departureTs != null &&
                                    arrivalTs != null &&
                                    departureTs >= arrivalTs
                                ) {
                                    // neplatný čas – negenerovať
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
                        }

                        const isPavukTeamName = isSpiderTeamName(teamName);
                        if (
                            isPavukTeamName &&
                            next &&
                            currentIsTimedEvent &&
                            current.location &&
                            next.location &&
                            currentDay != null &&
                            nextDay != null &&
                            currentDay !== nextDay
                        ) {
                            // NOVÉ: negenerovať presun, ak je miesto odkiaľ rovnaké ako miesto kam
                            if (isSamePlaceForTransfer(current.location, next.location)) {
                                // preskočiť
                            } else {
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
                        }
                                            
                        const isVeryLastEventOfTeam = (next == null);

                        // Zisti, či je aktuálny deň dňom, kedy sa majú večerné presuny
                        // namiesto na ubytovanie generovať na miesto zrazu.
                        const isMeetingPointDay =
                            meetingPointDayKey != null &&
                            meetingPointDayKey !== '' &&
                            currentDay != null &&
                            currentDay === meetingPointDayKey;
                        
                        const meetingPointStopForDay = (() => {
                            if (!isMeetingPointDay) return null;
                            const fromAllPlaces = (allPlacesRef.current || []).find((p) => p.isMeetingPointStop === true);
                            if (fromAllPlaces) return fromAllPlaces;
                            const fromStops = (stopsList || []).find((p) => p.isMeetingPointStop === true);
                            return fromStops || null;
                        })();
                        
                        if (isLastEventOfDay && !isVeryLastEventOfTeam && current.location) {
                            const teamIsInUsers = teamsArrivalBufferRef.current.some(
                                (t) => cleanCategory(t.category) === cleanCategory(category)
                                    && t.teamName === teamName
                                    && t.isRegistered === true
                            );
                            const hasAccommodation = accommodationName && accommodationName.trim() !== '';
                        
                            const isMeetingPointDay =
                                meetingPointDayKey != null && meetingPointDayKey !== '' &&
                                currentDay != null && currentDay === meetingPointDayKey;
                        
                            const isGlobalLastDay = currentDay === globalLastDay;
                        
                            // Pomocná: existuje aspoň jeden superstructure tím v kategórii, ktorý má v tento deň udalosť?
                            const anySuperstructureTeamHasEventToday = (() => {
                                if (!currentDay) return false;
                                const categoryClean = cleanCategory(category);
                                return (teamsArrivalBufferRef.current || []).some((t) => {
                                    if (cleanCategory(t.category) !== categoryClean) return false;
                                    if (t.isSuperstructure !== true) return false;
                                    return (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== categoryClean) return false;
                                        if (m.home !== t.teamName && m.away !== t.teamName) return false;
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) dayKey = `${mm[3]}-${String(mm[2]).padStart(2, '0')}-${String(mm[1]).padStart(2, '0')}`;
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        return dayKey === currentDay;
                                    });
                                });
                            })();
                        
                            const meetingPointStopForDay = (() => {
                                if (!isMeetingPointDay) return null;
                                const fromAllPlaces = (allPlacesRef.current || []).find((p) => p.isMeetingPointStop === true);
                                if (fromAllPlaces) return fromAllPlaces;
                                const fromStops = (stopsList || []).find((p) => p.isMeetingPointStop === true);
                                return fromStops || null;
                            })();
                        
                            const externalArrivalStopForDay = (() => {
                                const fromAllPlaces = (allPlacesRef.current || []).find((p) => p.isExternalArrivalStop === true);
                                if (fromAllPlaces) return fromAllPlaces;
                                const fromStops = (stopsList || []).find((p) => p.isExternalArrivalStop === true);
                                return fromStops || null;
                            })();
                        
                            const groupCharForSS = ssGroupCharByTeam[`${cleanCategory(category)}|${teamName}`];
                        
                            // === DEŇ MIESTA ZRAZU ===
                            if (isMeetingPointDay) {
                                const returnMP = meetingPointStop;
                                // NOVÉ: presun na miesto zrazu – iba ak sa líši od current.location
                                if (returnMP && !isSamePlaceForTransfer(current.location, returnMP.name)) {
                                    const departureTs = current.endTs != null ? current.endTs : current.startTs;
                                    const departureStr = formatFullFromTs(departureTs) || current.when;
                                    const arrivalTs = timestampOnDay(departureTs, 23, 59);
                                    const arrivalStr = formatFullFromTs(arrivalTs) || '23:59';
                                    if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                        enriched.push({
                                            ts: current.ts + 1,
                                            when: `${departureStr} – ${arrivalStr}`,
                                            type: 'transfer',
                                            text: `Presun z ${current.location} do miesto zrazu ${returnMP.name}`,
                                            location: null,
                                            isTransfer: true,
                                        });
                                    }
                                }
                                // NOVÉ: z miesta zrazu na ubytovanie – iba ak sa líši
                                if (
                                    teamIsInUsers &&
                                    hasAccommodation &&
                                    returnMP &&
                                    !anySuperstructureTeamHasEventToday
                                ) {
                                    const dest = accommodationName.trim();
                                    if (!isSamePlaceForTransfer(returnMP.name, dest)) {
                                        const departureTs = timestampOnDay(current.endTs || current.startTs, 23, 0);
                                        const departureStr = formatFullFromTs(departureTs) || '23:00';
                                        const arrivalTs = timestampOnDay(departureTs, 23, 59);
                                        const arrivalStr = formatFullFromTs(arrivalTs) || '23:59';
                                        if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                            enriched.push({
                                                ts: current.ts + 1.5,
                                                when: `${departureStr} – ${arrivalStr}`,
                                                type: 'transfer',
                                                text: `Presun z miesto zrazu ${returnMP.name} do ubytovanie ${dest}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        }
                                    }
                                }
                                // NOVÉ: z miesta zrazu na externú zastávku – iba ak sa líši
                                if (isGlobalLastDay && returnMP && externalArrivalStop && !isSamePlaceForTransfer(returnMP.name, externalArrivalStop.name)) {
                                    const departureTs = timestampOnDay(current.endTs || current.startTs, 23, 0);
                                    const departureStr = formatFullFromTs(departureTs) || '23:00';
                                    const arrivalTs = timestampOnDay(departureTs, 23, 59);
                                    const arrivalStr = formatFullFromTs(arrivalTs) || '23:59';
                                    if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                        enriched.push({
                                            ts: current.ts + 2,
                                            when: `${departureStr} – ${arrivalStr}`,
                                            type: 'transfer',
                                            text: `Presun z miesto zrazu ${returnMP.name} do zastávka ${externalArrivalStop.name}`,
                                            location: null,
                                            isTransfer: true,
                                        });
                                    }
                                }
                            } else {
                                // === BEŽNÝ DEŇ ===
                                const usersEveningBlocked = teamIsInUsers && anySuperstructureTeamHasEventToday;
                        
                                if (teamIsInUsers && !usersEveningBlocked) {
                                    const departureTs = current.endTs != null ? current.endTs : current.startTs;
                                    const departureStr = formatFullFromTs(departureTs) || current.when;
                                    const arrivalTs = timestampOnDay(departureTs, 23, 59);
                                    const arrivalStr = formatFullFromTs(arrivalTs) || '23:59';
                                    if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                        if (hasAccommodation) {
                                            const dest = accommodationName.trim();
                                            // NOVÉ: iba ak sa miesto líši
                                            if (!isSamePlaceForTransfer(current.location, dest)) {
                                                enriched.push({
                                                    ts: current.ts + 1,
                                                    when: `${departureStr} – ${arrivalStr}`,
                                                    type: 'transfer',
                                                    text: `Presun z ${current.location} do ubytovanie ${dest}`,
                                                    location: null,
                                                    isTransfer: true,
                                                });
                                            }
                                        } else if (meetingPointStop && !isSamePlaceForTransfer(current.location, meetingPointStop.name)) {
                                            enriched.push({
                                                ts: current.ts + 1,
                                                when: `${departureStr} – ${arrivalStr}`,
                                                type: 'transfer',
                                                text: `Presun z ${current.location} do miesto zrazu ${meetingPointStop.name}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        }
                                    }
                                } else if (!teamIsInUsers) {
                                    const departureTs = current.endTs != null ? current.endTs : current.startTs;
                                    const departureStr = formatFullFromTs(departureTs) || current.when;
                                    const arrivalTs = timestampOnDay(departureTs, 23, 59);
                                    const arrivalStr = formatFullFromTs(arrivalTs) || '23:59';
                                    if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                        const groupChar = groupCharForSS;
                                        const groupAccommodations = (() => {
                                            if (!groupChar) return [];
                                            const cacheKey = `${cleanCategory(category)}|skupina ${groupChar}`;
                                            return (window.__transport_accommodationsByGroup || {})[cacheKey] || [];
                                        })();
                        
                                        groupAccommodations.forEach((a) => {
                                            if (!a || !a.trim()) return;
                                            const dest = a.trim();
                                            // NOVÉ: iba ak sa miesto líši
                                            if (isSamePlaceForTransfer(current.location, dest)) return;
                                            enriched.push({
                                                ts: current.ts + 1,
                                                when: `${departureStr} – ${arrivalStr}`,
                                                type: 'transfer',
                                                text: `Presun z ${current.location} do ubytovanie ${dest}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        });
                                        // NOVÉ: miesto zrazu – iba ak sa líši
                                        if (meetingPointStop && !isSamePlaceForTransfer(current.location, meetingPointStop.name)) {
                                            enriched.push({
                                                ts: current.ts + 1.5,
                                                when: `${departureStr} – ${arrivalStr}`,
                                                type: 'transfer',
                                                text: `Presun z ${current.location} do miesto zrazu ${meetingPointStop.name}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                        
                        // === DEŇ MIESTA ZRAZU – návrat z miesta zrazu na ubytovanie (používateľský tím) ===
                        // (Táto časť zostáva nezmenená, len je vizuálne oddelená.)
                        if (
                            meetingPointDayKey &&
                            meetingPointDayKey !== '' &&
                            isLastEventOfDay &&
                            currentDay != null &&
                            currentDay === meetingPointDayKey
                        ) {
                            const teamIsInUsersForMeetingPoint = teamsArrivalBufferRef.current.some(
                                (t) => cleanCategory(t.category) === cleanCategory(category)
                                    && t.teamName === teamName
                                    && t.isRegistered === true
                            );
                        
                            const meetingPointStopForReturn = (() => {
                                const fromAllPlaces = (allPlacesRef.current || []).find((p) => p.isMeetingPointStop === true);
                                if (fromAllPlaces) return fromAllPlaces;
                                const fromStops = (stopsList || []).find((p) => p.isMeetingPointStop === true);
                                return fromStops || null;
                            })();
                        
                            if (
                                teamIsInUsersForMeetingPoint &&
                                meetingPointStopForReturn &&
                                teamAccommodationsList.length > 0
                            ) {
                                const categoryClean = cleanCategory(category);
                                let latestEndTsForCategoryOnDay = null;
                            
                                Object.values(grouped[categoryClean] || {}).forEach((teamEvents) => {
                                    (teamEvents || []).forEach((ev) => {
                                        const evDay = extractDayKeyFromWhen(ev.when);
                                        if (evDay !== currentDay) return;
                                        if (ev.endTs != null) {
                                            if (latestEndTsForCategoryOnDay == null || ev.endTs > latestEndTsForCategoryOnDay) {
                                                latestEndTsForCategoryOnDay = ev.endTs;
                                            }
                                        } else if (ev.startTs != null) {
                                            if (latestEndTsForCategoryOnDay == null || ev.startTs > latestEndTsForCategoryOnDay) {
                                                latestEndTsForCategoryOnDay = ev.startTs;
                                            }
                                        }
                                    });
                                });
                            
                                if (latestEndTsForCategoryOnDay == null) {
                                    latestEndTsForCategoryOnDay =
                                        current.endTs != null ? current.endTs : current.startTs;
                                }
                            
                                if (latestEndTsForCategoryOnDay != null) {
                                    const departureTs = latestEndTsForCategoryOnDay;
                                    const dayRefTs = departureTs;
                            
                                    const arrivalTs = timestampOnDay(dayRefTs, 23, 59);
                                    const departureStr = formatFullFromTs(departureTs) || current.when;
                                    const arrivalStr = formatFullFromTs(arrivalTs) || '23:59';
                            
                                    if (
                                        departureTs != null &&
                                        arrivalTs != null &&
                                        departureTs < arrivalTs
                                    ) {
                                        const whenStr = `${departureStr} – ${arrivalStr}`;
                            
                                        teamAccommodationsList.forEach((accomName) => {
                                            if (!accomName) return;
                                            // NOVÉ: nevygeneruj, ak sa miesto zrazu rovná ubytovaniu
                                            if (isSamePlaceForTransfer(meetingPointStopForReturn.name, accomName)) return;
                                            enriched.push({
                                                ts: current.ts + 1.5,
                                                when: whenStr,
                                                type: 'transfer',
                                                text: `Presun z miesto zrazu ${meetingPointStopForReturn.name} do ubytovanie ${accomName}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        });
                                    }
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
                            } else {
                                if (effectiveTeamIdentifiers.teamUid == null || effectiveTeamIdentifiers.teamIndex == null) {
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
                            
                                // NOVÉ: preskočiť, ak ide o to isté miesto
                                if (fromLocationText && toLocationText && isSamePlaceForTransfer(fromLocationText, toLocationText)) {
                                    return;
                                }

                                const fromId = resolvePlaceIdByName(fromLocationText);
                                const toId = resolvePlaceIdByName(toLocationText);
                            
                                // NOVÉ: ak sa nepodarilo rozpoznať názvy alebo id sú rovnaké, preskočiť
                                if (fromId && toId && fromId === toId) {
                                    return;
                                }

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
                                });
                            }
                        }
                    } catch (e) {
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

    async applyWalkingRulesToParent(parentKey) {
        if (!this.ctx) return;
        const walkingRules = this.ctx.walkingRules || [];
        if (!Array.isArray(walkingRules) || walkingRules.length === 0) return;
        const savedTransfersRef = this.ctx.savedTransfersRef;
        const parent = (savedTransfersRef?.current || []).find((s) => s.key === parentKey);
        if (!parent) return;
        const rulePairs = new Set(
            walkingRules.map((r) => `${r.fromPlaceNameNorm}||${r.toPlaceNameNorm}`)
        );
        const isPairWalking = (fromId, toId) => {
            if (!fromId || !toId) return false;
            const fromNameNorm = normalizePlaceName(this.resolvePlaceNameById(fromId) || '');
            const toNameNorm = normalizePlaceName(this.resolvePlaceNameById(toId) || '');
            if (!fromNameNorm || !toNameNorm) return false;
            return rulePairs.has(`${fromNameNorm}||${toNameNorm}`);
        };
        const stopsIds = Array.isArray(parent.intermediateStopIds) ? parent.intermediateStopIds : [];
        const isDirectTransfer = stopsIds.length === 0;
        let hasAnyMatchingNonWalkingSegment = false;
        let shouldMarkParentWalking = false;
        if (isDirectTransfer) {
            if (parent.isWalking === true) return;
            const fromId = parent.fromId || null;
            const toId = parent.toId || null;
            if (!isPairWalking(fromId, toId)) return;
            const segIdx = findSegmentIndex(parent.segments || [], fromId, toId);
            if (segIdx === -1) return;
            const seg = parent.segments[segIdx];
            if (!seg || seg.isWalking === true) return;
            shouldMarkParentWalking = true;
            hasAnyMatchingNonWalkingSegment = true;
        } else {
            (parent.segments || []).forEach((seg) => {
                if (!seg || seg.isWalking === true) return;
                if (!isPairWalking(seg.fromId, seg.toId)) return;
                hasAnyMatchingNonWalkingSegment = true;
            });
        }
        if (!hasAnyMatchingNonWalkingSegment) return;
        try {
            if (typeof this.ctx.updateParentTransferImpl === 'function') {
                await this.ctx.updateParentTransferImpl(parentKey, (draft) => {
                    if (shouldMarkParentWalking) {
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
                            s.walkingSetBy = (this.ctx.userProfileData && this.ctx.userProfileData.email) || null;
                        });
                        draft.isWalking = true;
                        draft.walkingSetAt = Timestamp.fromDate(new Date());
                        draft.walkingSetBy = (this.ctx.userProfileData && this.ctx.userProfileData.email) || null;
                        if (!draft.when || String(draft.when).trim() === '') {
                            if (parent.when && String(parent.when).trim() !== '') draft.when = parent.when;
                        }
                        return;
                    }
                    draft.segments = draft.segments.map((seg) => {
                        if (!seg || seg.isWalking === true) return seg;
                        if (!isPairWalking(seg.fromId, seg.toId)) return seg;
                        return {
                            ...seg,
                            isWalking: true,
                            busAssigned: false,
                            busId: null,
                            boardingRowId: null,
                            alightingRowId: null,
                            startTs: null,
                            endTs: null,
                            when: null,
                            walkingSetAt: Timestamp.fromDate(new Date()),
                            walkingSetBy: (this.ctx.userProfileData && this.ctx.userProfileData.email) || null,
                        };
                    });
                });
            }
        } catch (err) { /* ignore */ }
    }

    async setAllWalkingTransfersAsWalking(opts = {}) {
        if (!this.ctx) return;
        const walkingRules = this.ctx.walkingRules || [];
        if (!Array.isArray(walkingRules) || walkingRules.length === 0) {
            window.showGlobalNotification?.('Nie sú definované žiadne pravidlá "peši". Najprv ich pridajte v Nastavenia → Peši.', 'info');
            return;
        }
        const dayKeyFilter = opts.dayKey || null;
        const categoryFilter = opts.category ? cleanCategory(opts.category) : null;
        const rulePairs = new Set(
            walkingRules.map((r) => `${r.fromPlaceNameNorm}||${r.toPlaceNameNorm}`)
        );
        const isPairWalking = (fromId, toId) => {
            if (!fromId || !toId) return false;
            const fromNameNorm = normalizePlaceName(this.resolvePlaceNameById(fromId) || '');
            const toNameNorm = normalizePlaceName(this.resolvePlaceNameById(toId) || '');
            if (!fromNameNorm || !toNameNorm) return false;
            return rulePairs.has(`${fromNameNorm}||${toNameNorm}`);
        };
        const parentsToUpdate = new Set();
        const directParentsToMarkWalking = new Set();
        (this.ctx.savedTransfersRef?.current || []).forEach((parent) => {
            if (!Array.isArray(parent.segments)) return;
            if (dayKeyFilter && parent.dayKey !== dayKeyFilter) return;
            if (categoryFilter && cleanCategory(parent.category || '') !== categoryFilter) return;
            const stopsIds = Array.isArray(parent.intermediateStopIds) ? parent.intermediateStopIds : [];
            const isDirectTransfer = stopsIds.length === 0;
            if (isDirectTransfer) {
                if (parent.isWalking === true) return;
                const fromId = parent.fromId || null;
                const toId = parent.toId || null;
                if (!isPairWalking(fromId, toId)) return;
                const segIdx = findSegmentIndex(parent.segments, fromId, toId);
                if (segIdx === -1) return;
                const seg = parent.segments[segIdx];
                if (!seg || seg.isWalking === true) return;
                parentsToUpdate.add(parent.key);
                directParentsToMarkWalking.add(parent.key);
                return;
            }
            let hasAnyMatchingNonWalkingSegment = false;
            parent.segments.forEach((seg) => {
                if (!seg || seg.isWalking === true) return;
                const segFromId = seg.fromId || null;
                const segToId = seg.toId || null;
                if (!isPairWalking(segFromId, segToId)) return;
                hasAnyMatchingNonWalkingSegment = true;
            });
            if (hasAnyMatchingNonWalkingSegment) parentsToUpdate.add(parent.key);
        });
        if (parentsToUpdate.size === 0) {
            window.showGlobalNotification?.('Nenašli sa žiadne presuny, ktoré by zodpovedali pravidlám "peši".', 'info');
            return;
        }
        try {
            let updatedParentsCount = 0;
            for (const parentKey of parentsToUpdate) {
                const parent = (this.ctx.savedTransfersRef?.current || []).find((s) => s.key === parentKey);
                if (!parent) continue;
                const stopsIds = Array.isArray(parent.intermediateStopIds) ? parent.intermediateStopIds : [];
                const isDirectTransfer = stopsIds.length === 0;
                const shouldMarkParentWalking = directParentsToMarkWalking.has(parentKey);
                if (typeof this.ctx.updateParentTransferImpl !== 'function') continue;
                await this.ctx.updateParentTransferImpl(parentKey, (draft) => {
                    if (shouldMarkParentWalking) {
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
                            s.walkingSetBy = (this.ctx.userProfileData && this.ctx.userProfileData.email) || null;
                        });
                        draft.isWalking = true;
                        draft.walkingSetAt = Timestamp.fromDate(new Date());
                        draft.walkingSetBy = (this.ctx.userProfileData && this.ctx.userProfileData.email) || null;
                        if (!draft.when || String(draft.when).trim() === '') {
                            if (parent.when && String(parent.when).trim() !== '') draft.when = parent.when;
                        }
                        return;
                    }
                    draft.segments = draft.segments.map((seg) => {
                        if (!seg) return seg;
                        if (!isPairWalking(seg.fromId, seg.toId)) return seg;
                        if (seg.isWalking === true) return seg;
                        return {
                            ...seg,
                            isWalking: true,
                            busAssigned: false,
                            busId: null,
                            boardingRowId: null,
                            alightingRowId: null,
                            startTs: null,
                            endTs: null,
                            when: null,
                            walkingSetAt: Timestamp.fromDate(new Date()),
                            walkingSetBy: (this.ctx.userProfileData && this.ctx.userProfileData.email) || null,
                        };
                    });
                });
                updatedParentsCount += 1;
            }
            window.showGlobalNotification?.(`Označených ako peši: ${updatedParentsCount} presunov (vrátane častí rozdelených presunov).`, 'success');
        } catch (err) {
            window.showGlobalNotification?.('Nepodarilo sa označiť presuny ako peši.', 'error');
        }
    }

    waitForTransfersUpdate(categoryName, timeoutMs = 5000) {
        const cat = cleanCategory(categoryName);
        const startCount = (this.ctx?.savedTransfersRef?.current || []).filter(
            (t) => cleanCategory(t.category || '') === cat
        ).length;
        return new Promise((resolve) => {
            const start = Date.now();
            const tick = () => {
                const currentCount = (this.ctx?.savedTransfersRef?.current || []).filter(
                    (t) => cleanCategory(t.category || '') === cat
                ).length;
                if (currentCount !== startCount || Date.now() - start > timeoutMs) {
                    resolve(currentCount);
                    return;
                }
                setTimeout(tick, 100);
            };
            tick();
        });
    }

    // ============================================================
    // VEREJNÉ API – volá ho hlavný súbor
    // ============================================================
    async generateTransfers({ category, meetingPointDayKey = '', isRegen = false }) {
        if (!category) {
            window.showGlobalNotification?.('Najprv vyberte kategóriu.', 'error');
            return;
        }
        if (!this.ctx) {
            window.showGlobalNotification?.('Generátor nie je inicializovaný.', 'error');
            return;
        }

        // Nastav deň miesta zrazu
        if (this.ctx.meetingPointDayKeyRef) {
            this.ctx.meetingPointDayKeyRef.current = meetingPointDayKey || '';
        }

        // Spusti generovanie
        if (typeof this.ctx.rebuildAndLogTimelineImpl === 'function') {
            this.ctx.rebuildAndLogTimelineImpl(true, category);
        }

        // Počkaj na update savedTransfers
        await this.waitForTransfersUpdate(category);

        // Aplikuj walking pravidlá
        try {
            await this.setAllWalkingTransfersAsWalking({ category });
        } catch (e) { /* ignore */ }

        window.showGlobalNotification?.(
            isRegen
                ? `Časová os pre kategóriu ${category} bola znova vygenerovaná (dogenerované len chýbajúce).`
                : `Časová os pre kategóriu ${category} bola vygenerovaná.`,
            'success'
        );
    }
}

// Globálna inštancia
const generator = new TransportGenerator();
window.TransportGenerator = generator;
export default generator;

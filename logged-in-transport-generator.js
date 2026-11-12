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

    // Hlavná generátorová funkcia – obsahuje celú logiku z pôvodného rebuildAndLogTimeline.
    // Poznámka: pre stručnosť tu volá pôvodnú implementáciu z hlavného súboru cez ctx.rebuildAndLogTimelineImpl,
    // ktorú sem hlavný súbor vloží pri inicializácii. V plnej verzii sem skopírujte telo rebuildAndLogTimeline.
    async rebuildAndLogTimeline(force = false, categoryFilter = null) {
        if (!this.ctx) return;
        // Delegácia na implementáciu z hlavného súboru (pozri nižšie "Poznámka k migrácii")
        if (typeof this.ctx.rebuildAndLogTimelineImpl === 'function') {
            return await this.ctx.rebuildAndLogTimelineImpl(force, categoryFilter);
        }
    }

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

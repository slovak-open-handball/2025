// logged-in-transport-generator.js
import { doc, getDocs, setDoc, collection, Timestamp, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const MIN_TEAMS_FOR_SS_TRANSFER = 2;

// ============================================================
// POMOCNÉ FUNKCIE (globálne v generátore)
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
        this.ctx = null;
    }

    setContext(context) {
        this.ctx = context;
    }

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

    renderTeamTimeline(category, teamName, events, options) {
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

        const isPavukTeam = isSpiderTeamName(teamName);

        if (isSuperstructureTeam && !isPavukTeam) {
            let groupChar = getGroupLastChar(teamGroupName);
            if (!groupChar) groupChar = getGroupLastChar(teamName);

            if (groupChar) {
                const datesSet = new Set();
                (this.ctx.matchesBufferRef?.current || []).forEach((m) => {
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
                lines.push(`     [superstructure] Písmeno skupiny: ${groupChar} – jedinečné dátumy zápasov v skupinách s týmto písmenom:`);
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
    }

    // ============================================================
    // HLAVNÁ GENERÁTOROVÁ FUNKCIA – CELÉ TELO
    // ============================================================
    rebuildAndLogTimeline(force = false, categoryFilter = null) {
        if (!this.ctx) return;
        if (!force && !this.ctx.timelineGenerationRequestedRef?.current) return;

        const meetingPointDayKey = this.ctx.meetingPointDayKeyRef?.current || '';
        if (!this.ctx.matchesLoadedRef?.current || !this.ctx.cateringLoadedRef?.current || !this.ctx.teamsLoadedRef?.current) return;
        if (!this.ctx.teamsLookupLoadedRef?.current) return;
        if (!this.ctx.travelTimesLoaded) {
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
            const fromAllPlaces = (this.ctx.allPlacesRef?.current || []).find((p) => p.isExternalArrivalStop === true);
            if (fromAllPlaces) return fromAllPlaces;
            const fromStops = (this.ctx.stopsList || []).find((p) => p.isExternalArrivalStop === true);
            if (fromStops) return fromStops;
            return null;
        })();

        const meetingPointStop = (() => {
            const fromAllPlaces = (this.ctx.allPlacesRef?.current || []).find((p) => p.isMeetingPointStop === true);
            if (fromAllPlaces) return fromAllPlaces;
            const fromStops = (this.ctx.stopsList || []).find((p) => p.isMeetingPointStop === true);
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

        (this.ctx.teamsArrivalBufferRef?.current || []).forEach((t) => {
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
                const fromSuperstructure = this.ctx.superstructureGroupsRef?.current?.[groupKey];

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

        (this.ctx.matchesBufferRef?.current || []).forEach((m) => {
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

        (this.ctx.cateringBufferRef?.current || []).forEach((c) => {
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

            if (isSpiderTeamName(tn)) return false;

            const cat = cleanCategory(team.category || '');

            if (team.groupName) {
                const gChar = getGroupLastChar(team.groupName);
                return gChar === groupChar;
            }

            const ssGroups = this.ctx.superstructureGroupsRef?.current || {};
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

            if (team.isSuperstructure !== true) {
                const m = /\d([A-ZÁ-Ž])\s*$/.exec(tn);
                if (m) return m[1].toUpperCase() === groupChar;
            }

            try {
                if (!window.__transport_missingGroupNameLogged) {
                    window.__transport_missingGroupNameLogged = new Set();
                }
                const dedupKey = `${cat}|${tn}|${groupChar}`;
                if (!window.__transport_missingGroupNameLogged.has(dedupKey)) {
                    window.__transport_missingGroupNameLogged.add(dedupKey);
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

            (this.ctx.teamsArrivalBufferRef?.current || []).forEach((t) => {
                if (cleanCategory(t.category) !== cat) return;
                if (!t.teamName) return;
                const tn = String(t.teamName).trim();

                if (isSpiderTeamName(tn)) return;

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

            const fromBuffer = (this.ctx.teamsArrivalBufferRef?.current || []).find(
                (t) => cleanCategory(t.category) === cat && String(t.teamName || '').trim() === tn
            );
            if (fromBuffer && fromBuffer.groupName) {
                return String(fromBuffer.groupName).trim();
            }

            const ssGroups = this.ctx.superstructureGroupsRef?.current || {};
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

        const logGroupsAndTeamsForCategory = (category) => {
            const cat = cleanCategory(category);

            const getTeamNameLastChar = (teamName) => {
                if (!teamName) return null;
                return getGroupCharFromTeamName(teamName, cat);
            };

            const groupsMap = new Map();

            (this.ctx.teamsArrivalBufferRef?.current || []).forEach((t) => {
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

                        const teamRecord = (this.ctx.teamsArrivalBufferRef?.current || []).find(
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

            const teamsWithGroupInfo = (this.ctx.teamsArrivalBufferRef?.current || []).filter(
                (t) => cleanCategory(t.category) === cat && t.teamName
            );
            if (teamsWithGroupInfo.length > 0) {
                console.log(`%c[TRANSPORT][GROUPS] ██ Tímy v kategórii ${cat} a ich skupiny ██`, 'font-weight: bold; color: #ea580c;');
                teamsWithGroupInfo.forEach((t) => {
                    const tn = String(t.teamName).trim();
                    if (isSpiderTeamName(tn)) {
                        return;
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

            const superstructureTeamsInCategory = (this.ctx.teamsArrivalBufferRef?.current || []).filter(
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

                    if (isSpiderTeamName(tn)) {
                        console.log(`    → PAVÚKOVÝ TÍM – skupina sa neurčuje podľa posledného písmena názvu.`);
                        console.log('    ─────────────────────────────');
                        return;
                    }

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

                    (this.ctx.teamsArrivalBufferRef?.current || []).forEach((other) => {
                        if (cleanCategory(other.category) !== cat) return;
                        if (!other.teamName) return;
                        const otherTn = String(other.teamName).trim();

                        if (!teamBelongsToGroupChar(other, lastCharFromName)) return;

                        if (other.isRegistered === true) {
                            teamsInSameGroupUsers.push(otherTn);
                            return;
                        }

                        if (other.isSuperstructure === true) {
                            teamsInSameGroupSuperstructure.push(otherTn);
                        }
                    });

                    const teamsInSameGroup = teamsInSameGroupUsers.length > 0
                        ? teamsInSameGroupUsers
                        : teamsInSameGroupSuperstructure;

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

            (this.ctx.teamsArrivalBufferRef?.current || []).forEach((t) => {
                if (!t.teamName) return;

                let char = getGroupLastChar(t.groupName);

                if (!char && t.isSuperstructure !== true && !isSpiderTeamName(t.teamName)) {
                    char = getGroupLastChar(t.teamName);
                }

                if (!char) return;

                const key = `${cleanCategory(t.category)}|${t.teamName}`;
                ssGroupCharByTeam[key] = char;
                if (!ssPlayDatesByTeam[key]) ssPlayDatesByTeam[key] = new Set();
            });

            const superstructureTeamNames = new Set();
            (this.ctx.teamsArrivalBufferRef?.current || []).forEach((t) => {
                if (t.isSuperstructure && t.teamName) {
                    superstructureTeamNames.add(t.teamName);
                }
            });

            Object.keys(ssGroupCharByTeam).forEach((key) => {
                const [cat, teamName] = key.split('|');
                const char = ssGroupCharByTeam[key];
                const set = ssPlayDatesByTeam[key];

                (this.ctx.matchesBufferRef?.current || []).forEach((m) => {
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

                const teamInfo = (this.ctx.teamsArrivalBufferRef?.current || []).find(
                    (t) => String(t.teamName || '').trim() === s
                );

                if (teamInfo && teamInfo.groupName) {
                    const gChar = getGroupLastChar(teamInfo.groupName);
                    if (gChar) return gChar;
                }

                const ssGroups = this.ctx.superstructureGroupsRef?.current || {};
                for (const [groupKey, teamNames] of Object.entries(ssGroups)) {
                    const [keyCat, keyGroup] = String(groupKey).split('|');
                    if (cleanCategory(keyCat) !== cat) continue;
                    if (!Array.isArray(teamNames)) continue;
                    if (teamNames.some((n) => String(n || '').trim() === s)) {
                        const gChar = getGroupLastChar(keyGroup);
                        if (gChar) return gChar;
                    }
                }

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
                        const inUsers = (this.ctx.teamsArrivalBufferRef?.current || []).some(
                            (t) => cleanCategory(t.category) === cleanCategory(category)
                                && t.teamName === teamName
                                && t.isRegistered === true
                        );
                        if (!inUsers) return true;
                        if (/\d[A-ZÁ-Ž]\s*$/.test(String(teamName).trim())) return true;
                        return false;
                    })();

                    if (isSuperstructureTeam && teamGroupName) {
                        const groupCharForLog = getGroupLastChar(teamGroupName);
                        if (groupCharForLog) {
                            const currentDayForLog = (() => {
                                const dayKeys = (events || [])
                                    .map((ev) => extractDayKeyFromWhen(ev.when))
                                    .filter(Boolean)
                                    .sort();
                                if (dayKeys.length === 0) return null;
                                return dayKeys[0];
                            })();

                            if (!currentDayForLog) {
                            } else {
                                const spiderMatchInEvents = (() => {
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
                                        if (ev.type === 'match') {
                                            const matchParts = /^(.+?) vs (.+?)(?:\s*\[.*?\])?(?:\s*\|.*)?$/.exec(String(ev.text || ''));
                                            if (matchParts) {
                                                const homeName = matchParts[1].trim();
                                                const awayName = matchParts[2].trim();
                                                const spiderTeam = isSpiderTeamName(homeName) ? homeName
                                                    : (isSpiderTeamName(awayName) ? awayName : null);
                                                if (spiderTeam) {
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

                                if (spiderMatchInEvents) {
                                    const { event: spiderEvent, spiderTeam, spiderPrefix, homeName, awayName } = spiderMatchInEvents;

                                    const spiderTypeLabel = (() => {
                                        if (!spiderPrefix) return 'pavúkový zápas';
                                        if (spiderPrefix === 'WSF' || spiderPrefix === 'LSF') return 'semifinále';
                                        if (spiderPrefix === 'WQF' || spiderPrefix === 'LQF') return 'štvrťfinále';
                                        if (spiderPrefix === 'W16F' || spiderPrefix === 'L16F') return 'osemfinále';
                                        if (spiderPrefix === 'W8F' || spiderPrefix === 'L8F') return 'osemnásťfinále';
                                        if (spiderPrefix === 'W32F' || spiderPrefix === 'L32F') return '32-finále';
                                        return 'pavúkový zápas';
                                    })();

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
                                    (this.ctx.teamsArrivalBufferRef?.current || []).forEach((other) => {
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
                                        uniqueTeamsForLog.forEach((tn) => {
                                            console.log(`    • ${tn}`);
                                    
                                            // Získame udalosti pre tento tím z grouped[category][tn]
                                            const teamEvents = (grouped[cleanCategory(category)] && grouped[cleanCategory(category)][tn]) || [];
                                    
                                            // Zoskupíme udalosti podľa dňa (dayKey)
                                            const eventsByDay = new Map();
                                            teamEvents.forEach((ev) => {
                                                const dayKey = extractDayKeyFromWhen(ev.when);
                                                if (!dayKey) return;
                                                if (!eventsByDay.has(dayKey)) eventsByDay.set(dayKey, []);
                                                eventsByDay.get(dayKey).push(ev);
                                            });
                                    
                                            // Pre každý deň nájdeme prvú a poslednú udalosť
                                            const sortedDays = [...eventsByDay.keys()].sort();
                                            sortedDays.forEach((dayKey) => {
                                                const dayEvents = eventsByDay.get(dayKey);
                                                // Zoradíme udalosti podľa času (startTs alebo ts)
                                                dayEvents.sort((a, b) => {
                                                    const ta = a.startTs != null ? a.startTs : (a.ts != null ? a.ts : Number.POSITIVE_INFINITY);
                                                    const tb = b.startTs != null ? b.startTs : (b.ts != null ? b.ts : Number.POSITIVE_INFINITY);
                                                    if (ta !== tb) return ta - tb;
                                                    return String(a.text).localeCompare(String(b.text), 'sk');
                                                });
                                    
                                                const firstEvent = dayEvents[0];
                                                const lastEvent = dayEvents[dayEvents.length - 1];
                                    
                                                const formatEventInfo = (ev) => {
                                                    const timeStr = ev.when ? ev.when.split(' – ')[0] : '—';
                                                    const place = ev.location || '(bez miesta)';
                                                    return `${timeStr} | ${place}`;
                                                };
                                    
                                                console.log(`        ${formatDateDDMMYYYY(dayKey) || dayKey}:`);
                                                console.log(`          Prvá: ${formatEventInfo(firstEvent)}`);
                                                console.log(`          Posledná: ${formatEventInfo(lastEvent)}`);
                                            });
                                        });
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
                                const anyUserTeamHasEventOnDay = (this.ctx.teamsArrivalBufferRef?.current || []).some((t) => {
                                    if (cleanCategory(t.category) !== cleanCategory(category)) return false;
                                    if (t.isRegistered !== true) return false;
                                    if (t.isSuperstructure === true) return false;
                                
                                    const hasMatch = (this.ctx.matchesBufferRef?.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
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
                                        return dayKey === groupPlayDay;
                                    });
                                    if (hasMatch) return true;
                                
                                    return (this.ctx.cateringBufferRef?.current || []).some((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return false;
                                        if (c.teamName !== t.teamName) return false;
                                        return c.dayKey === groupPlayDay;
                                    });
                                });

                                if (!anyUserTeamHasEventOnDay) {
                                    // V tento deň nehrá žiadny user tím – pre superstructure tím negenerujeme
                                    // presuny z ubytovne ani z miesta zrazu na miesto prvej udalosti.
                                    return;
                                }
                                
                                const teamHasEventOnDay = (() => {
                                    const fromEvents = events.some((ev) => extractDayKeyFromWhen(ev.when) === groupPlayDay);
                                    if (fromEvents) return true;
                                    const fromMatches = (this.ctx.matchesBufferRef?.current || []).some((m) => {
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
                                    const fromCatering = (this.ctx.cateringBufferRef?.current || []).some((c) => {
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
                                    const teamInfo = (this.ctx.teamsArrivalBufferRef?.current || []).find(
                                        (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === tn
                                    );
                                    if (teamInfo && teamInfo.groupName) {
                                        return groupBelongsToChar(teamInfo.groupName, groupCharPre);
                                    }
                                    return false;
                                };

                                const isRealRegisteredTeamPre = (tn) => {
                                    if (!tn) return false;
                                    const info = (this.ctx.teamsArrivalBufferRef?.current || []).find(
                                        (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === tn
                                    );
                                    return !!(info && info.isRegistered === true);
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
                                    if (this.isSamePlaceForTransfer(loc, destination)) return;
                                    const existing = uniqueSourceLocationsPre.get(loc);
                                    if (!existing || (endTs != null && endTs > (existing.endTs ?? -Infinity))) {
                                        uniqueSourceLocationsPre.set(loc, { location: loc, endTs });
                                    }
                                };

                                if (isFirstPlayDayPre) {
                                    (this.ctx.matchesBufferRef?.current || []).forEach((m) => {
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
                                    (this.ctx.cateringBufferRef?.current || []).forEach((c) => {
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
                                    (this.ctx.teamsArrivalBufferRef?.current || []).forEach((t) => {
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
                                        if (this.isSamePlaceForTransfer(info.location, destination)) return;

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

                    const teamIsInUsers = (this.ctx.teamsArrivalBufferRef?.current || []).some(
                        (t) => cleanCategory(t.category) === cleanCategory(category)
                            && t.teamName === teamName
                            && t.isRegistered === true
                    );

                    if (teamIsInUsers) {
                        // Pre user tím zisti groupName a jeho posledné písmeno
                        const userTeamInfo = (this.ctx.teamsArrivalBufferRef?.current || []).find(
                            (t) => cleanCategory(t.category) === cleanCategory(category)
                                && String(t.teamName || '').trim() === String(teamName || '').trim()
                                && t.isRegistered === true
                        );
                        const userTeamGroupName = userTeamInfo && userTeamInfo.groupName
                            ? String(userTeamInfo.groupName).trim()
                            : teamGroupName;
                        const userTeamGroupChar = userTeamGroupName ? getGroupLastChar(userTeamGroupName) : null;

                        if (userTeamGroupChar) {
                            // Zisti dni, v ktorých má user tím udalosti
                            const userTeamDays = new Set();
                            events.forEach((ev) => {
                                const dk = extractDayKeyFromWhen(ev.when);
                                if (dk) userTeamDays.add(dk);
                            });

                            const groupCharToContinuationChars = new Map(); // groupChar -> Set<originalChar>
                            (this.ctx.teamsArrivalBufferRef?.current || []).forEach((t) => {
                                if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                if (!t.teamName) return;
                                if (t.isSuperstructure !== true) return;
                                if (isSpiderTeamName(t.teamName)) return;
                                const tn = String(t.teamName).trim();
                                const lastCharMatch = /\d([A-ZÁ-Ž])\s*$/.exec(tn);
                                const nameChar = lastCharMatch ? lastCharMatch[1].toUpperCase() : null;
                                if (!nameChar) return;
                                
                                // Skús získať groupChar z groupName, ak existuje
                                let groupChar = getGroupLastChar(t.groupName);
                                
                                // Ak nemá groupName, použi posledné písmeno názvu ako groupChar
                                // (podľa pravidla "posledné písmeno názvu = písmeno skupiny")
                                if (!groupChar) {
                                    groupChar = nameChar;
                                }
                                
                                if (!groupChar) return;
                                
                                if (!groupCharToContinuationChars.has(groupChar)) {
                                    groupCharToContinuationChars.set(groupChar, new Set());
                                }
                                groupCharToContinuationChars.get(groupChar).add(nameChar);
                            });
                            
                            // Zisti, ktoré skupiny sú pokračovaním userTeamGroupChar
                            const continuationGroupCharsSet = new Set([userTeamGroupChar]);
                            groupCharToContinuationChars.forEach((originalChars, groupChar) => {
                                if (originalChars.has(userTeamGroupChar)) {
                                    continuationGroupCharsSet.add(groupChar);
                                }
                            });
                            
                            console.log('\n\n\n\n\n\n');
                            
                            console.log(
                                `%c[TRANSPORT][SS-DAYS] Tím "${teamName}" (skupina "${userTeamGroupName}", písmeno ${userTeamGroupChar}):`,
                                'font-weight: bold; color: #7c3aed;'
                            );
                            console.log(`  Skupiny, ktoré sú pokračovaním "${userTeamGroupChar}": ${[...continuationGroupCharsSet].filter(c => c !== userTeamGroupChar).join(', ') || '(žiadne)'}`);
                            
                            const superstructureTeamsWithSameChar = (this.ctx.teamsArrivalBufferRef?.current || []).filter((t) => {
                                if (cleanCategory(t.category) !== cleanCategory(category)) return false;
                                if (!t.teamName) return false;
                                if (t.isSuperstructure !== true) return false;
                                if (isSpiderTeamName(t.teamName)) return false;
                                const tn = String(t.teamName).trim();
                                const lastCharMatch = /\d([A-ZÁ-Ž])\s*$/.exec(tn);
                                const nameChar = lastCharMatch ? lastCharMatch[1].toUpperCase() : null;

                                // 1. Priamo: posledné písmeno názvu = userTeamGroupChar
                                if (nameChar === userTeamGroupChar) return true;
                            
                                // 2. Posledné písmeno názvu je v continuationGroupCharsSet
                                //    (napr. 3E, 4E, 1E – posledné písmeno E, ktoré je pokračovaním C)
                                if (nameChar && continuationGroupCharsSet.has(nameChar)) return true;
                            
                                // 3. Skupina je pokračovaním: groupName končí na písmeno, ktoré je v continuationGroupCharsSet
                                const groupChar = getGroupLastChar(t.groupName);
                                if (groupChar && continuationGroupCharsSet.has(groupChar)) {
                                    return true;
                                }
                            
                                return false;
                            });

                            if (superstructureTeamsWithSameChar.length > 0) {
                                // Pre každý superstructure tím nájdi jeho prvú udalosť v každom dni
                                // a zoskup podľa dňa -> množina miest prvých udalostí
                                const superstructureFirstPlacesByDay = new Map();
                            
                                superstructureTeamsWithSameChar.forEach((ssTeam) => {
                                    const ssTeamName = String(ssTeam.teamName).trim();
                                    const ssTeamEvents = grouped[cleanCategory(category)]?.[ssTeamName] || [];
                            
                                    const ssEventsByDay = new Map();
                                    ssTeamEvents.forEach((ev) => {
                                        const dk = extractDayKeyFromWhen(ev.when);
                                        if (!dk) return;
                                        if (!ev.location) return;
                                        if (!ssEventsByDay.has(dk)) ssEventsByDay.set(dk, []);
                                        ssEventsByDay.get(dk).push(ev);
                                    });
                            
                                    ssEventsByDay.forEach((dayEvents, dayKey) => {
                                        dayEvents.sort((a, b) => {
                                            const ta = a.startTs != null ? a.startTs : (a.ts != null ? a.ts : Number.POSITIVE_INFINITY);
                                            const tb = b.startTs != null ? b.startTs : (b.ts != null ? b.ts : Number.POSITIVE_INFINITY);
                                            if (ta !== tb) return ta - tb;
                                            return String(a.text).localeCompare(String(b.text), 'sk');
                                        });
                            
                                        const firstEvent = dayEvents[0];
                                        if (!firstEvent || !firstEvent.location) return;
                            
                                        if (!superstructureFirstPlacesByDay.has(dayKey)) {
                                            superstructureFirstPlacesByDay.set(dayKey, new Map());
                                        }
                                        const placesMap = superstructureFirstPlacesByDay.get(dayKey);
                                        const existing = placesMap.get(firstEvent.location);
                                        const firstTs = firstEvent.startTs != null ? firstEvent.startTs : (firstEvent.ts != null ? firstEvent.ts : Number.POSITIVE_INFINITY);
                                        if (!existing || firstTs < existing.firstEventTs) {
                                            placesMap.set(firstEvent.location, {
                                                firstEventTs: firstTs,
                                                firstEvent,
                                                ssTeamName,
                                            });
                                        }
                                    });
                                });
                            
                                // ─────────────────────────────────────────────────────────────
                                // Detailný výpis udalostí
                                // - pre USER TÍM: len udalosti TOHTO tímu
                                // - pre SUPERSTRUCTURE TÍM: udalosti všetkých relevantných tímov
                                // ─────────────────────────────────────────────────────────────
                                const allRelevantChars = new Set(continuationGroupCharsSet);
                                allRelevantChars.add(userTeamGroupChar);
                                
                                console.log(
                                    `  → Detailný výpis udalostí pre tímy s písmenami ${[...allRelevantChars].sort().join(', ')}:`
                                );
                                
                                if (teamIsInUsers) {
                                    // Pre user tím vypíš len udalosti TOHTO tímu
                                    const thisTeamEvents = grouped[cleanCategory(category)]?.[teamName] || [];
                                    const eventsByDayThisTeam = new Map();
                                    thisTeamEvents.forEach((ev) => {
                                        const dk = extractDayKeyFromWhen(ev.when);
                                        if (!dk) return;
                                        if (!eventsByDayThisTeam.has(dk)) eventsByDayThisTeam.set(dk, []);
                                        eventsByDayThisTeam.get(dk).push(ev);
                                    });
                                
                                    [...eventsByDayThisTeam.keys()].sort().forEach((dayKey) => {
                                        const evs = eventsByDayThisTeam.get(dayKey);
                                        evs.sort((a, b) => {
                                            const ta = a.startTs != null ? a.startTs : (a.ts != null ? a.ts : Number.POSITIVE_INFINITY);
                                            const tb = b.startTs != null ? b.startTs : (b.ts != null ? b.ts : Number.POSITIVE_INFINITY);
                                            if (ta !== tb) return ta - tb;
                                            return String(a.text).localeCompare(String(b.text), 'sk');
                                        });
                                        const dayLabel = formatDateDDMMYYYY(dayKey) || dayKey;
                                        console.log(`  → Deň ${dayLabel}:`);
                                        console.log(`      • ${teamName}:`);
                                        evs.forEach((ev) => {
                                            const place = ev.location || '(bez miesta)';
                                            const timeStr = ev.when || '—';
                                            console.log(`          ${timeStr} | ${place} | ${ev.text || ''}`);
                                        });
                                    });
                                } else {
                                    // Pre superstructure tím vypíš udalosti všetkých relevantných tímov
                                    const allRelevantTeams = (this.ctx.teamsArrivalBufferRef?.current || []).filter((t) => {
                                        if (cleanCategory(t.category) !== cleanCategory(category)) return false;
                                        if (!t.teamName) return false;
                                        if (isSpiderTeamName(t.teamName)) return false;
                                
                                        const tn = String(t.teamName).trim();
                                        const isUserTeam = t.isRegistered === true;
                                
                                        if (isUserTeam) {
                                            // USER TÍM → kontroluj groupName
                                            const groupChar = getGroupLastChar(t.groupName);
                                            return !!(groupChar && allRelevantChars.has(groupChar));
                                        } else {
                                            // SUPERSTRUCTURE TÍM → kontroluj názov tímu (posledné písmeno)
                                            const nameCharMatch = /\d([A-ZÁ-Ž])\s*$/.exec(tn);
                                            const nameChar = nameCharMatch ? nameCharMatch[1].toUpperCase() : null;
                                            return !!(nameChar && allRelevantChars.has(nameChar));
                                        }
                                    });
                                
                                    const eventsByDayForAllRelevant = new Map();
                                    allRelevantTeams.forEach((t) => {
                                        const tn = String(t.teamName).trim();
                                        const teamEvents = grouped[cleanCategory(category)]?.[tn] || [];
                                
                                        teamEvents.forEach((ev) => {
                                            const dk = extractDayKeyFromWhen(ev.when);
                                            if (!dk) return;
                                            if (!eventsByDayForAllRelevant.has(dk)) eventsByDayForAllRelevant.set(dk, new Map());
                                            const teamsMap = eventsByDayForAllRelevant.get(dk);
                                            if (!teamsMap.has(tn)) teamsMap.set(tn, []);
                                            teamsMap.get(tn).push(ev);
                                        });
                                    });
                                
                                    [...eventsByDayForAllRelevant.keys()].sort().forEach((dayKey) => {
                                        const teamsMap = eventsByDayForAllRelevant.get(dayKey);
                                        const dayLabel = formatDateDDMMYYYY(dayKey) || dayKey;
                                        console.log(`  → Deň ${dayLabel}:`);
                                        [...teamsMap.keys()].sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' })).forEach((tn) => {
                                            const evs = teamsMap.get(tn);
                                            evs.sort((a, b) => {
                                                const ta = a.startTs != null ? a.startTs : (a.ts != null ? a.ts : Number.POSITIVE_INFINITY);
                                                const tb = b.startTs != null ? b.startTs : (b.ts != null ? b.ts : Number.POSITIVE_INFINITY);
                                                if (ta !== tb) return ta - tb;
                                                return String(a.text).localeCompare(String(b.text), 'sk');
                                            });
                                            console.log(`      • ${tn}:`);
                                            evs.forEach((ev) => {
                                                const place = ev.location || '(bez miesta)';
                                                const timeStr = ev.when || '—';
                                                console.log(`          ${timeStr} | ${place} | ${ev.text || ''}`);
                                            });
                                        });
                                    });
                                }
                            
                                // Pôvodný výpis (miesta prvých udalostí SS tímov) – zachovaný
                                superstructureFirstPlacesByDay.forEach((placesMap, dayKey) => {
                                    console.log(`  → Deň ${dayKey}: miesta prvých udalostí SS tímov:`);
                                    placesMap.forEach((info, loc) => {
                                        console.log(`      • ${loc} (SS tím: ${info.ssTeamName}, čas: ${info.firstEvent.when})`);
                                    });
                                });
                            
                                // Pôvodná logika generovania presunov (upravená)
                                superstructureFirstPlacesByDay.forEach((placesMap, dayKey) => {
                                    if (userTeamDays.has(dayKey)) return;
                                
                                    const userTeamHasEventOnDay = events.some((ev) => {
                                        const evDay = extractDayKeyFromWhen(ev.when);
                                        return evDay === dayKey && ev.location;
                                    });
                                    if (userTeamHasEventOnDay) return;
                                
                                    // ─────────────────────────────────────────────────────────────
                                    // Zisti, koľko tímov z tej istej skupiny (rovnaké groupName
                                    // ako user tím) býva v konkrétnej ubytovni.
                                    // Kľúč: normalized accommodation name → Set<teamName>
                                    // ─────────────────────────────────────────────────────────────
                                    const teamsByAccommodationInGroup = new Map();
                                    if (userTeamGroupName) {
                                        (this.ctx.teamsArrivalBufferRef?.current || []).forEach((t) => {
                                            if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                            if (!t.teamName) return;
                                            const otherGroupName = t.groupName ? String(t.groupName).trim() : null;
                                            if (!otherGroupName || otherGroupName !== String(userTeamGroupName).trim()) return;
                                            const accName = t.accommodationName && String(t.accommodationName).trim() !== ''
                                                ? String(t.accommodationName).trim()
                                                : null;
                                            if (!accName) return;
                                            const key = normalizePlaceName(accName);
                                            if (!key) return;
                                            if (!teamsByAccommodationInGroup.has(key)) {
                                                teamsByAccommodationInGroup.set(key, { location: accName, teams: new Set() });
                                            }
                                            teamsByAccommodationInGroup.get(key).teams.add(String(t.teamName).trim());
                                        });
                                    }
                                
                                    // Urči, či user tím býva v ubytovni, kde je v rámci jeho skupiny
                                    // menej ako MIN_TEAMS_FOR_SS_TRANSFER tímov.
                                    const userTeamAccommodationKey = accommodationName && String(accommodationName).trim() !== ''
                                        ? normalizePlaceName(accommodationName.trim())
                                        : null;
                                    const userTeamAccommodationEntry = userTeamAccommodationKey
                                        ? teamsByAccommodationInGroup.get(userTeamAccommodationKey)
                                        : null;
                                    const userTeamAccommodationTeamCount = userTeamAccommodationEntry
                                        ? userTeamAccommodationEntry.teams.size
                                        : 0;
                                
                                    const userTeamInSmallAccommodation =
                                        userTeamAccommodationKey != null &&
                                        userTeamAccommodationTeamCount < MIN_TEAMS_FOR_SS_TRANSFER;
                                
                                    // ─────────────────────────────────────────────────────────────
                                    // Prípad A: user tím býva v ubytovni s menej ako
                                    // MIN_TEAMS_FOR_SS_TRANSFER tímami zo svojej skupiny
                                    // (alebo nemá ubytovanie) → generuj ranný presun pre user tím
                                    // z ubytovania / miesta zrazu na miesto prvej udalosti SS tímu.
                                    // ─────────────────────────────────────────────────────────────
                                    if (userTeamInSmallAccommodation || !userTeamAccommodationKey) {
                                        const hasAccommodation = accommodationName && accommodationName.trim() !== '';
                                        const fromLocationName = hasAccommodation
                                            ? accommodationName.trim()
                                            : (meetingPointStop ? meetingPointStop.name : null);
                                        const fromLabel = hasAccommodation
                                            ? `ubytovanie ${accommodationName.trim()}`
                                            : (meetingPointStop ? `miesto zrazu ${meetingPointStop.name}` : null);
                                
                                        if (!fromLocationName) return;
                                
                                        placesMap.forEach((info, destinationLocation) => {
                                            if (!destinationLocation) return;
                                            if (this.isSamePlaceForTransfer(fromLocationName, destinationLocation)) return;
                                
                                            const arrivalTs = info.firstEventTs;
                                            if (arrivalTs == null || !isFinite(arrivalTs)) return;
                                
                                            const arrivalStr = formatFullFromTs(arrivalTs) || info.firstEvent.when || '—';
                                            const departureTs = timestampOnDay(arrivalTs, 0, 0);
                                            const departureStr = formatFullFromTs(departureTs) || '00:00';
                                
                                            if (departureTs != null && arrivalTs != null && departureTs >= arrivalTs) return;
                                
                                            let whenStr;
                                            if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                            else if (arrivalStr) whenStr = arrivalStr;
                                            else whenStr = info.firstEvent.when || '—';
                                
                                            enriched.push({
                                                ts: info.firstEventTs - 1,
                                                when: whenStr,
                                                type: 'transfer',
                                                text: `Presun z ${fromLabel} do ${destinationLocation}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        });
                                        return;
                                    }
                                
                                    // ─────────────────────────────────────────────────────────────
                                    // Prípad B: user tím býva v ubytovni s >= MIN_TEAMS_FOR_SS_TRANSFER
                                    // tímami zo svojej skupiny → negeneruj ranný presun pre user tím.
                                    // Namiesto toho vygeneruj presun pre KAŽDÝ superstructure tím
                                    // (v tej istej skupine) z KAŽDEJ ubytovne VŠETKÝCH tímov v tejto
                                    // skupine (user aj SS) na miesto prvej udalosti tohto SS tímu.
                                    // ─────────────────────────────────────────────────────────────
                                
                                    // Zozbieraj ubytovne VŠETKÝCH tímov v skupine (user aj SS),
                                    // nielen tých, ktoré patria user tímu.
                                    const allAccommodationsInGroupMap = new Map(); // normalizedName -> { location }
                                    (this.ctx.teamsArrivalBufferRef?.current || []).forEach((t) => {
                                        if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                        if (!t.teamName) return;
                                        const otherGroupName = t.groupName ? String(t.groupName).trim() : null;
                                        if (!otherGroupName || otherGroupName !== String(userTeamGroupName).trim()) return;
                                        const accName = t.accommodationName && String(t.accommodationName).trim() !== ''
                                            ? String(t.accommodationName).trim()
                                            : null;
                                        if (!accName) return;
                                        const key = normalizePlaceName(accName);
                                        if (!key) return;
                                        if (!allAccommodationsInGroupMap.has(key)) {
                                            allAccommodationsInGroupMap.set(key, { location: accName });
                                        }
                                    });
                                    const allAccommodationsInGroup = [...allAccommodationsInGroupMap.values()].map(
                                        (entry) => entry.location
                                    );
                                
                                    if (allAccommodationsInGroup.length === 0) return;
                                
                                    // Nájdi všetky superstructure tímy v tejto skupine (rovnaké groupName
                                    // ako user tím), ktoré majú v tento deň udalosť s miestom.
                                    const ssTeamsInGroup = (this.ctx.teamsArrivalBufferRef?.current || []).filter((t) => {
                                        if (cleanCategory(t.category) !== cleanCategory(category)) return false;
                                        if (!t.teamName) return false;
                                        if (t.isSuperstructure !== true) return false;
                                        if (isSpiderTeamName(t.teamName)) return false;
                                        const otherGroupName = t.groupName ? String(t.groupName).trim() : null;
                                        if (!otherGroupName || otherGroupName !== String(userTeamGroupName).trim()) return false;
                                        return true;
                                    });
                                
                                    if (ssTeamsInGroup.length === 0) return;
                                
                                    ssTeamsInGroup.forEach((ssTeam) => {
                                        const ssTeamName = String(ssTeam.teamName).trim();
                                        const ssTeamEvents = grouped[cleanCategory(category)]?.[ssTeamName] || [];
                                
                                        // Prvá udalosť SS tímu v danom dni s miestom
                                        const ssFirstEventOnDay = ssTeamEvents
                                            .filter((ev) => {
                                                const evDay = extractDayKeyFromWhen(ev.when);
                                                return evDay === dayKey && ev.location;
                                            })
                                            .sort((a, b) => {
                                                const ta = a.startTs != null ? a.startTs : (a.ts != null ? a.ts : Number.POSITIVE_INFINITY);
                                                const tb = b.startTs != null ? b.startTs : (b.ts != null ? b.ts : Number.POSITIVE_INFINITY);
                                                if (ta !== tb) return ta - tb;
                                                return String(a.text).localeCompare(String(b.text), 'sk');
                                            })[0];
                                
                                        if (!ssFirstEventOnDay || !ssFirstEventOnDay.location) return;
                                
                                        const destination = ssFirstEventOnDay.location;
                                        const arrivalTs = ssFirstEventOnDay.startTs != null
                                            ? ssFirstEventOnDay.startTs
                                            : (ssFirstEventOnDay.ts != null && isFinite(ssFirstEventOnDay.ts)
                                                ? ssFirstEventOnDay.ts
                                                : null);
                                
                                        const arrivalStr = formatFullFromTs(arrivalTs) || ssFirstEventOnDay.when || '—';
                                        const departureTs = timestampOnDay(arrivalTs, 0, 0);
                                        const departureStr = formatFullFromTs(departureTs) || '00:00';
                                
                                        if (departureTs != null && arrivalTs != null && departureTs >= arrivalTs) return;
                                
                                        allAccommodationsInGroup.forEach((accName) => {
                                            if (!accName) return;
                                            if (this.isSamePlaceForTransfer(accName, destination)) return;
                                
                                            let whenStr;
                                            if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                            else if (arrivalStr) whenStr = arrivalStr;
                                            else whenStr = ssFirstEventOnDay.when || '—';
                                
                                            enriched.push({
                                                ts: (arrivalTs != null ? arrivalTs : ssFirstEventOnDay.ts) - 1,
                                                when: whenStr,
                                                type: 'transfer',
                                                text: `Presun z ${accName} do ${destination}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        });
                                    });
                                });
                            }
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

                        const teamIsInUsers = (this.ctx.teamsArrivalBufferRef?.current || []).some(
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
                            const teamIsInUsers = (this.ctx.teamsArrivalBufferRef?.current || []).some(
                                (t) => cleanCategory(t.category) === cleanCategory(category)
                                    && t.teamName === teamName
                                    && t.isRegistered === true
                            );
                            const teamIsSuperstructure = !teamIsInUsers;
                        
                            const isPlacementMatchEvent = (() => {
                                if (current.type !== 'match') return false;
                                if (/\[o\s+\d+\.\s*miesto\]/i.test(String(current.text || ''))) return true;
                                const matchRec = (this.ctx.matchesBufferRef?.current || []).find((m) => {
                                    if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                    if (m.home !== teamName && m.away !== teamName) return false;
                                    return m.isPlacementMatch === true;
                                });
                                return !!matchRec;
                            })();
                        
                            if (isPlacementMatchEvent && current.location) {
                                const teamGroupChar = getTeamGroupCharFromName(teamName, category);
                                if (teamGroupChar) {
                                    const teamsInGroupWithChar = getTeamsInGroupByChar(category, teamGroupChar);
                        
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
                                        const lastEndByPlace = new Map();
                        
                                        (this.ctx.matchesBufferRef?.current || []).forEach((m) => {
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
                                                if (tn === teamName && m.scheduledTs === current.startTs) return;
                                                const endTs = m.scheduledEndTs != null ? m.scheduledEndTs : m.scheduledTs;
                                                if (endTs == null) return;
                                                const existing = lastEndByPlace.get(m.hallName);
                                                if (!existing || endTs > existing) {
                                                    lastEndByPlace.set(m.hallName, endTs);
                                                }
                                            });
                                        });
                        
                                        (this.ctx.cateringBufferRef?.current || []).forEach((c) => {
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
                        
                                        let latestPlace = null;
                                        let latestEndTs = -Infinity;
                                        lastEndByPlace.forEach((endTs, placeName) => {
                                            if (endTs > latestEndTs) {
                                                latestEndTs = endTs;
                                                latestPlace = placeName;
                                            }
                                        });
                        
                                        if (latestPlace && latestEndTs != null && isFinite(latestEndTs)) {
                                            if (!this.isSamePlaceForTransfer(latestPlace, current.location)) {
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
                        
                                const isPavukTeamName = isSpiderTeamName(teamName);
                                if (!isPavukTeamName) return false;
                        
                                const matchParts = /^(.+?) vs (.+?)(?:\s*\[.*?\])?(?:\s*\|.*)?$/.exec(String(current.text || ''));
                                if (!matchParts) return false;
                        
                                const homeName = matchParts[1].trim();
                                const awayName = matchParts[2].trim();
                        
                                const hasPavukIdentifier = (name) => isSpiderTeamName(name);
                                if (hasPavukIdentifier(homeName) || hasPavukIdentifier(awayName)) {
                                    return false;
                                }
                        
                                return true;
                            })();
                        
                            if (isPavukMatchNoIdentifier && current.location) {
                                const teamNameLastChar = (() => {
                                    const nameMatch = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
                                    if (nameMatch) return nameMatch[1].toUpperCase();
                                    return getGroupLastChar(String(teamName).trim());
                                })();
                        
                                if (teamNameLastChar) {
                                    const teamsInGroupWithChar = new Set();
                                    (this.ctx.teamsArrivalBufferRef?.current || []).forEach((t) => {
                                        if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                        if (!t.teamName) return;
                                        const tGroupChar = getGroupLastChar(t.groupName);
                                        if (tGroupChar === teamNameLastChar) {
                                            teamsInGroupWithChar.add(t.teamName);
                                        }
                                    });
                        
                                    const dayForMatch = currentDay;
                                    const lastPlacesByTeam = new Map();
                        
                                    if (dayForMatch) {
                                        (this.ctx.matchesBufferRef?.current || []).forEach((m) => {
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
                        
                                        (this.ctx.cateringBufferRef?.current || []).forEach((c) => {
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
                        
                                    if (lastPlacesByTeam.size > 0) {
                                        const currentMatchStartTs = current.startTs;
                        
                                        lastPlacesByTeam.forEach((info, tn) => {
                                            if (!info.location) return;
                                            if (this.isSamePlaceForTransfer(info.location, current.location)) return;
                        
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
                        
                            const isPavukTeamNameForMorning = isSpiderTeamName(teamName);
                        
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
                        
                            const anyUsersTeamHasEventToday = (() => {
                                if (!currentDay) return false;
                                const categoryClean = cleanCategory(category);
                                return (this.ctx.teamsArrivalBufferRef?.current || []).some((t) => {
                                    if (cleanCategory(t.category) !== categoryClean) return false;
                                    if (t.isRegistered !== true) return false;
                                    if (t.isSuperstructure === true) return false;
                                    const hasMatch = (this.ctx.matchesBufferRef?.current || []).some((m) => {
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
                                    return (this.ctx.cateringBufferRef?.current || []).some((c) => {
                                        if (cleanCategory(c.category) !== categoryClean) return false;
                                        if (c.teamName !== t.teamName) return false;
                                        return c.dayKey === currentDay;
                                    });
                                });
                            })();
                        
                            const anySuperstructureTeamHasEventToday = (() => {
                                if (!currentDay) return false;
                                const categoryClean = cleanCategory(category);
                                return (this.ctx.teamsArrivalBufferRef?.current || []).some((t) => {
                                    if (cleanCategory(t.category) !== categoryClean) return false;
                                    if (t.isSuperstructure !== true) return false;
                                    return (this.ctx.matchesBufferRef?.current || []).some((m) => {
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
                        
                            if (teamIsInUsers) {
                                const isPavukMatchEvent =
                                    current.type === 'match' &&
                                    isSpiderTeamName(teamName);
                        
                                const isPavukFollowUpMatchSamePlace = (() => {
                                    if (!isPavukMatchEvent) return false;
                                    if (!currentDay) return false;
                                    if (!current.location) return false;
                        
                                    const currentStartTs =
                                        current.startTs ?? current.ts ?? Number.POSITIVE_INFINITY;
                        
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
                        
                                    let lastPlaceForCategoryOnDay = null;
                                    let lastPlaceEndTs = -Infinity;
                        
                                    (this.ctx.matchesBufferRef?.current || []).forEach((m) => {
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
                        
                                    (this.ctx.cateringBufferRef?.current || []).forEach((c) => {
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
                                        this.isSamePlaceForTransfer(lastPlaceForCategoryOnDay, current.location)
                                    ) {
                                        return true;
                                    }
                        
                                    return false;
                                })();
                        
                                if (isPlacementMatchEvent) {
                                } else if (isPavukMatchEvent && isPavukFollowUpMatchSamePlace) {
                                } else if (isPavukMatchEvent) {
                                } else if (isGlobalFirstDay) {
                                    // ═══════════════════════════════════════════════════════════
                                    // ← ZMENA: Prvý deň turnaja – pre USER TÍM:
                                    //   • ak MÁ verejnú dopravu → presun zo zastávky
                                    //   • inak (vlastná doprava, bez dopravy, alebo
                                    //     nemá nastavenú dopravu) → presun z miesta zrazu
                                    // ═══════════════════════════════════════════════════════════
                                    const arrivalTypeNorm = String(teamArrivalType || '')
                                        .toLowerCase()
                                        .normalize('NFD')
                                        .replace(/[\u0300-\u036f]/g, '')
                                        .trim();
                                    const hasPublicTransport = arrivalTypeNorm.includes('verejn') || arrivalTypeNorm.includes('autobus') || arrivalTypeNorm.includes('vlak');
                                    // ← ZMENA: všetko ostatné (vrátane vlastnej dopravy) → miesto zrazu
                                    const useMeetingPoint = !hasPublicTransport;
                        
                                    let fromLocationName = null;
                                    let fromLabel = null;
                        
                                    if (hasPublicTransport && externalArrivalStop) {
                                        fromLocationName = externalArrivalStop.name;
                                        fromLabel = `zastávka ${externalArrivalStop.name}`;
                                    } else if (useMeetingPoint && meetingPointStop) {
                                        // ← ZMENA: vlastná doprava / bez dopravy / nemá nastavenú dopravu
                                        //   → presun z miesta zrazu
                                        fromLocationName = meetingPointStop.name;
                                        fromLabel = `miesto zrazu ${meetingPointStop.name}`;
                                    }
                        
                                    if (fromLocationName && !this.isSamePlaceForTransfer(fromLocationName, current.location)) {
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
                                    // NOVÉ: Pre user tím – zisti, či aspoň jeden INÝ tím v jeho skupine
                                    // má v ten deň udalosť. Ak nie, vygeneruj presun z ubytovania
                                    // (alebo z miesta zrazu, ak nemá ubytovanie) na miesto udalosti.
                                    const userTeamGroupCharForCheck = (() => {
                                        const userInfo = (this.ctx.teamsArrivalBufferRef?.current || []).find(
                                            (t) => cleanCategory(t.category) === cleanCategory(category)
                                                && String(t.teamName || '').trim() === String(teamName || '').trim()
                                                && t.isRegistered === true
                                        );
                                        const gName = userInfo && userInfo.groupName ? String(userInfo.groupName).trim() : null;
                                        return gName ? getGroupLastChar(gName) : null;
                                    })();
                        
                                    const anyOtherTeamInGroupHasEventToday = (() => {
                                        if (!currentDay || !userTeamGroupCharForCheck) return false;
                                        const categoryClean = cleanCategory(category);
                                        return (this.ctx.teamsArrivalBufferRef?.current || []).some((t) => {
                                            if (cleanCategory(t.category) !== categoryClean) return false;
                                            if (!t.teamName) return false;
                                            if (String(t.teamName).trim() === String(teamName).trim()) return false;
                                            if (t.isRegistered !== true) return false;
                                            if (!teamBelongsToGroupChar(t, userTeamGroupCharForCheck)) return false;
                        
                                            const hasMatch = (this.ctx.matchesBufferRef?.current || []).some((m) => {
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
                        
                                            return (this.ctx.cateringBufferRef?.current || []).some((c) => {
                                                if (cleanCategory(c.category) !== categoryClean) return false;
                                                if (c.teamName !== t.teamName) return false;
                                                return c.dayKey === currentDay;
                                            });
                                        });
                                    })();
                        
                                    let fromLocationName = null;
                                    let fromLabel = null;
                                    if (accommodationName && accommodationName.trim() !== '') {
                                        fromLocationName = accommodationName.trim();
                                        fromLabel = `ubytovanie ${accommodationName.trim()}`;
                                    } else if (meetingPointStop) {
                                        fromLocationName = meetingPointStop.name;
                                        fromLabel = `miesto zrazu ${meetingPointStop.name}`;
                                    }
                        
                                    if (
                                        !anyOtherTeamInGroupHasEventToday &&
                                        fromLocationName &&
                                        !this.isSamePlaceForTransfer(fromLocationName, current.location)
                                    ) {
                                        // Žiadny iný tím v skupine nemá dnes udalosť → user tím ide
                                        // z ubytovania (alebo miesta zrazu) na miesto udalosti.
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
                                    } else if (fromLocationName && !this.isSamePlaceForTransfer(fromLocationName, current.location)) {
                                        // Pôvodná logika pre user tím v deň, kedy iný tím v skupine má udalosť
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
                                const isPavukMatchEventForSS =
                                    current.type === 'match' &&
                                    isSpiderTeamName(teamName);
                        
                                const isSuperstructureTeamForDailyTransfer =
                                    !teamIsInUsers && !isSpiderTeamName(teamName) && currentDay != null && current.location;
                        
                                if (isSuperstructureTeamForDailyTransfer) {
                                    const ssTeamLastChar = (() => {
                                        const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
                                        if (m) return m[1].toUpperCase();
                                        return getGroupLastChar(String(teamName).trim());
                                    })();
                        
                                    if (ssTeamLastChar) {
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
                        
                                        // OPRAVENÉ: nevyžaduj isRegistered === true ani isSuperstructure !== true.
                                        const anyUserTeamHasEventTodayForSS = (() => {
                                            if (!currentDay) return false;
                                            const categoryClean = cleanCategory(category);
                                            const allOtherTeamsInCategory = (this.ctx.teamsArrivalBufferRef?.current || [])
                                                .filter((t) => {
                                                    if (cleanCategory(t.category) !== categoryClean) return false;
                                                    if (!t.teamName) return false;
                                                    if (String(t.teamName).trim() === String(teamName).trim()) return false;
                                                    return true;
                                                });
                        
                                            return allOtherTeamsInCategory.some((t) => {
                                                const hasMatch = (this.ctx.matchesBufferRef?.current || []).some((m) => {
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
                        
                                                return (this.ctx.cateringBufferRef?.current || []).some((c) => {
                                                    if (cleanCategory(c.category) !== categoryClean) return false;
                                                    if (c.teamName !== t.teamName) return false;
                                                    return c.dayKey === currentDay;
                                                });
                                            });
                                        })();
                        
                                        console.log(
                                            `%c[TRANSPORT][SS-DIAG] Tím "${teamName}", deň ${currentDay}: ssTeamLastChar=${ssTeamLastChar}, hasEarlierSameDayEventForSS=${hasEarlierSameDayEventForSS}, anyUserTeamHasEventTodayForSS=${anyUserTeamHasEventTodayForSS}`,
                                            'color: #b91c1c; font-weight: bold;'
                                        );
                        
                                        if (!hasEarlierSameDayEventForSS && anyUserTeamHasEventTodayForSS) {
                                            const allUserTeamsInCategory = (this.ctx.teamsArrivalBufferRef?.current || []).filter((t) => {
                                                if (cleanCategory(t.category) !== cleanCategory(category)) return false;
                                                if (!t.teamName) return false;
                                                if (String(t.teamName).trim() === String(teamName).trim()) return false;
                                                return true;
                                            });
                        
                                            let otherTeamsInSameGroup = allUserTeamsInCategory.filter((t) =>
                                                teamBelongsToGroupChar(t, ssTeamLastChar)
                                            );
                        
                                            if (otherTeamsInSameGroup.length === 0) {
                                                console.log(
                                                    `%c[TRANSPORT][SS-DIAG] Fallback: žiadne tímy v skupine "${ssTeamLastChar}", používam všetky user tímy v kategórii (${allUserTeamsInCategory.length}).`,
                                                    'color: #b91c1c;'
                                                );
                                                otherTeamsInSameGroup = allUserTeamsInCategory;
                                            } else {
                                                console.log(
                                                    `%c[TRANSPORT][SS-DIAG] Nájdených ${otherTeamsInSameGroup.length} user tímov v skupine "${ssTeamLastChar}".`,
                                                    'color: #b91c1c;'
                                                );
                                            }
                        
                                            const lastPlaceByTeamInGroup = (() => {
                                                if (!currentDay) return new Map();
                                                const result = new Map();
                                                const categoryClean = cleanCategory(category);
                        
                                                (this.ctx.matchesBufferRef?.current || []).forEach((m) => {
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
                        
                                                (this.ctx.cateringBufferRef?.current || []).forEach((c) => {
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
                        
                                            console.log(
                                                `%c[TRANSPORT][SS-DIAG] lastPlaceByTeamInGroup: ${lastPlaceByTeamInGroup.size} záznamov`,
                                                'color: #b91c1c;'
                                            );
                        
                                            if (anyOtherTeamHasEvent) {
                                                // VÝPIS POSLEDNÝCH UDALOSTÍ
                                                const ssTeamNameForLog = String(teamName).trim();
                                                const groupCharForLog = ssTeamLastChar;
                        
                                                const sortedUserTeamsForLog = [...otherTeamsInSameGroup]
                                                    .map((t) => String(t.teamName || '').trim())
                                                    .filter(Boolean)
                                                    .sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }));
                        
                                                console.log(
                                                    `%c[TRANSPORT][SS-LAST-EVENTS] Deň ${currentDay} – SS tím "${ssTeamNameForLog}" (skupina ${groupCharForLog}) – posledné udalosti user tímov v skupine:`,
                                                    'font-weight: bold; color: #7c3aed;'
                                                );
                        
                                                const lastEventByUserTeam = new Map();
                                                sortedUserTeamsForLog.forEach((otherTn) => {
                                                    const teamEventsOnDay = (grouped[cleanCategory(category)]?.[otherTn] || [])
                                                        .filter((ev) => {
                                                            const evDay = extractDayKeyFromWhen(ev.when);
                                                            return evDay === currentDay && ev.location;
                                                        })
                                                        .sort((a, b) => {
                                                            const ta = a.endTs != null ? a.endTs : (a.startTs != null ? a.startTs : (a.ts != null ? a.ts : Number.POSITIVE_INFINITY));
                                                            const tb = b.endTs != null ? b.endTs : (b.startTs != null ? b.startTs : (b.ts != null ? b.ts : Number.POSITIVE_INFINITY));
                                                            return tb - ta;
                                                        });
                        
                                                    if (teamEventsOnDay.length === 0) {
                                                        console.log(`    • ${otherTn}: (žiadna udalosť s miestom v tento deň)`);
                                                        return;
                                                    }
                        
                                                    const lastEv = teamEventsOnDay[0];
                                                    const lastEndTs =
                                                        lastEv.endTs != null
                                                            ? lastEv.endTs
                                                            : (lastEv.startTs != null ? lastEv.startTs : (lastEv.ts != null ? lastEv.ts : null));
                                                    const lastTimeStr =
                                                        lastEndTs != null
                                                            ? (formatFullFromTs(lastEndTs) || lastEv.when || '—')
                                                            : (lastEv.when || '—');
                        
                                                    lastEventByUserTeam.set(otherTn, {
                                                        location: lastEv.location,
                                                        endTs: lastEndTs,
                                                        when: lastEv.when,
                                                        text: lastEv.text,
                                                    });
                        
                                                    console.log(
                                                        `    • ${otherTn}: ${lastTimeStr} | ${lastEv.location} | ${lastEv.text || ''}`
                                                    );
                                                });
                                                console.log('[TRANSPORT][SS-LAST-EVENTS] ─────────────────────────────');
                        
                                                let globalLatestEndTs = -Infinity;
                                                lastEventByUserTeam.forEach((info) => {
                                                    if (info.endTs != null && isFinite(info.endTs) && info.endTs > globalLatestEndTs) {
                                                        globalLatestEndTs = info.endTs;
                                                    }
                                                });
                        
                                                if (globalLatestEndTs !== -Infinity) {
                                                    const uniquePlaces = new Set();
                                                    lastEventByUserTeam.forEach((info) => {
                                                        if (!info.location) return;
                                                        if (this.isSamePlaceForTransfer(info.location, current.location)) return;
                                                        uniquePlaces.add(info.location);
                                                    });
                        
                                                    const currentEventStartTs = current.startTs ?? current.ts ?? null;
                        
                                                    if (uniquePlaces.size > 0 &&
                                                        !(currentEventStartTs != null && globalLatestEndTs >= currentEventStartTs)) {
                                                        const departureStr = formatFullFromTs(globalLatestEndTs) || current.when;
                                                        const arrivalStr = formatFullFromTs(currentEventStartTs) || current.when;
                        
                                                        let whenStr;
                                                        if (departureStr && arrivalStr) whenStr = `${departureStr} – ${arrivalStr}`;
                                                        else if (arrivalStr) whenStr = arrivalStr;
                                                        else whenStr = current.when;
                        
                                                        uniquePlaces.forEach((placeName) => {
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
                                                }
                                            } else if (
                                                !isPavukTeamNameForMorning &&
                                                meetingPointStop &&
                                                !this.isSamePlaceForTransfer(meetingPointStop.name, current.location)
                                            ) {
                                                // ═══════════════════════════════════════════════════════════
                                                // ← ZMENA: Presun z miesta zrazu sa generuje pre SS tím
                                                //   vždy, keď v jeho skupine (podľa posledného písmena)
                                                //   nemá udalosť žiadny user tím s miestom.
                                                //   Generuje sa len raz za deň – pre prvú udalosť dňa.
                                                //
                                                //   DÔLEŽITÉ: departureTs musí byť POLNOC DŇA PRÍCHODU
                                                //   (nie globalArrivalTs), inak sa presun zobrazí pod
                                                //   nesprávnym dňom v časovej osi.
                                                // ═══════════════════════════════════════════════════════════
                                                const arrivalTs = current.startTs;
                                                const arrivalStr = formatFullFromTs(arrivalTs) || current.when;
                                                // ← KĽÚČOVÁ ZMENA: vždy použiť polnoc dňa príchodu,
                                                //   aby `when` začínal dňom príchodu (a presun sa
                                                //   zobrazil pod správnym dňom).
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
                                                        text: `Presun z miesta zrazu ${meetingPointStop.name} do ${current.location}`,
                                                        location: null,
                                                        isTransfer: true,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                        
                                const isPavukFollowUpMatchSamePlaceForSS = (() => {
                                    if (!isPavukMatchEventForSS) return false;
                                    if (!currentDay) return false;
                                    if (!current.location) return false;
                        
                                    const currentStartTs =
                                        current.startTs ?? current.ts ?? Number.POSITIVE_INFINITY;
                        
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
                        
                                    let lastPlaceForCategoryOnDay = null;
                                    let lastPlaceEndTs = -Infinity;
                        
                                    (this.ctx.matchesBufferRef?.current || []).forEach((m) => {
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
                        
                                    (this.ctx.cateringBufferRef?.current || []).forEach((c) => {
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
                                        this.isSamePlaceForTransfer(lastPlaceForCategoryOnDay, current.location)
                                    ) {
                                        return true;
                                    }
                        
                                    return false;
                                })();
                        
                                const categoryAlreadyPlayedAtSamePlaceTodayForSS = (() => {
                                    if (!currentDay) return false;
                                    if (!current.location) return false;
                                    if (current.type !== 'match') return false;
                        
                                    const currentStartTs =
                                        current.startTs ?? current.ts ?? Number.POSITIVE_INFINITY;
                        
                                    return (this.ctx.matchesBufferRef?.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                        if (!m.hallName) return false;
                                        if (!this.isSamePlaceForTransfer(m.hallName, current.location)) return false;
                        
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
                        
                                    if (isSpiderTeamName(teamName)) return false;
                        
                                    const currentTeamInfo = (this.ctx.teamsArrivalBufferRef?.current || []).find(
                                        (t) => cleanCategory(t.category) === categoryClean
                                            && String(t.teamName || '').trim() === String(teamName || '').trim()
                                    );
                                    let currentTeamGroupName = currentTeamInfo && currentTeamInfo.groupName
                                        ? String(currentTeamInfo.groupName).trim()
                                        : null;
                        
                                    if (!currentTeamGroupName) {
                                        const ssGroups = this.ctx.superstructureGroupsRef?.current || {};
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
                        
                                    const currentEventPlace = current.location || null;
                                    if (!currentEventPlace) return false;
                        
                                    return (this.ctx.teamsArrivalBufferRef?.current || []).some((other) => {
                                        if (cleanCategory(other.category) !== categoryClean) return false;
                                        if (!other.teamName) return false;
                                        const otherTn = String(other.teamName).trim();
                                        if (otherTn === String(teamName || '').trim()) return false;
                        
                                        const otherGroupName = other.groupName ? String(other.groupName).trim() : null;
                                        if (!otherGroupName || otherGroupName !== currentTeamGroupName) return false;
                        
                                        const hasMatchAtSamePlace = (this.ctx.matchesBufferRef?.current || []).some((m) => {
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
                                            return this.isSamePlaceForTransfer(m.hallName, currentEventPlace);
                                        });
                                        if (hasMatchAtSamePlace) return true;
                        
                                        return (this.ctx.cateringBufferRef?.current || []).some((c) => {
                                            if (cleanCategory(c.category) !== categoryClean) return false;
                                            if (String(c.teamName || '').trim() !== otherTn) return false;
                                            if (c.dayKey !== currentDay) return false;
                                            if (!c.placeName) return false;
                                            return this.isSamePlaceForTransfer(c.placeName, currentEventPlace);
                                        });
                                    });
                                })();
                        
                                // ═══════════════════════════════════════════════════════════════
                                // ← ZMENA: Pre SUPERSTRUCTURE tím:
                                //  • ranný presun z ubytovní sa NEGENERUJE nikdy
                                //  • ranný presun z miesta zrazu na miesto prvej udalosti sa
                                //    generuje LEN ak v ten deň nemá udalosť s miestom žiadny
                                //    iný tím v jeho skupine (rovnaký groupName).
                                // ═══════════════════════════════════════════════════════════════
                                if (isPlacementMatchEvent) {
                                    // placement match – bez ranného presunu
                                } else if (anyTeamInSameGroupAlreadyAtSamePlaceToday) {
                                    // už niekto zo skupiny je na tom istom mieste – netreba presun
                                } else if (
                                    !isPavukTeamNameForMorning &&
                                    meetingPointStop &&
                                    !this.isSamePlaceForTransfer(meetingPointStop.name, current.location)
                                ) {
                                    // Skontroluj, či v ten deň má nejaký iný tím v skupine udalosť s miestom
                                    const currentTeamInfoForGroupCheck = (this.ctx.teamsArrivalBufferRef?.current || []).find(
                                        (t) => cleanCategory(t.category) === cleanCategory(category)
                                            && String(t.teamName || '').trim() === String(teamName || '').trim()
                                    );
                                    const currentTeamGroupNameForCheck = currentTeamInfoForGroupCheck && currentTeamInfoForGroupCheck.groupName
                                        ? String(currentTeamInfoForGroupCheck.groupName).trim()
                                        : null;

                                    const anyOtherTeamInSameGroupHasEventToday = (() => {
                                        if (!currentDay || !currentTeamGroupNameForCheck) return false;
                                        const categoryClean = cleanCategory(category);
                                        return (this.ctx.teamsArrivalBufferRef?.current || []).some((other) => {
                                            if (cleanCategory(other.category) !== categoryClean) return false;
                                            if (!other.teamName) return false;
                                            const otherTn = String(other.teamName).trim();
                                            if (otherTn === String(teamName || '').trim()) return false;
                                            const otherGroupName = other.groupName ? String(other.groupName).trim() : null;
                                            if (!otherGroupName || otherGroupName !== currentTeamGroupNameForCheck) return false;

                                            const hasMatch = (this.ctx.matchesBufferRef?.current || []).some((m) => {
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
                                                return dayKey === currentDay;
                                            });
                                            if (hasMatch) return true;

                                            return (this.ctx.cateringBufferRef?.current || []).some((c) => {
                                                if (cleanCategory(c.category) !== categoryClean) return false;
                                                if (c.teamName !== otherTn) return false;
                                                return c.dayKey === currentDay;
                                            });
                                        });
                                    })();

                                    if (anyOtherTeamInSameGroupHasEventToday) {
                                        // Negeneruj presun z miesta zrazu – iné tímy v skupine už majú udalosť v ten deň
                                        // (tím by mal ísť z miesta, kde sú ony, nie z miesta zrazu)
                                    } else {
                                        // ═══════════════════════════════════════════════════════════════
                                        // ← NOVÁ ZMENA: Skontroluj, či tímy v skupinách, ktoré sú
                                        //   "pokračovaním" tejto skupiny (napr. F pokračuje z A, C, E),
                                        //   nemajú poslednú udalosť dňa na rovnakom mieste, ako je
                                        //   miesto prvej udalosti tohto SS tímu. Ak áno → negeneruj
                                        //   ranný presun z miesta zrazu.
                                        // ═══════════════════════════════════════════════════════════════
                                        const ssTeamLastCharForCheck = (() => {
                                            const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
                                            if (m) return m[1].toUpperCase();
                                            return getGroupLastChar(String(teamName).trim());
                                        })();

                                        // Zisti, ktoré skupiny sú "pokračovaním" tejto skupiny
                                        // (rovnaká logika ako pri user tímoch – mapovanie groupChar -> originalChars)
                                        const groupCharToOriginalChars = new Map();
                                        (this.ctx.teamsArrivalBufferRef?.current || []).forEach((t) => {
                                            if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                            if (!t.teamName) return;
                                            if (t.isSuperstructure !== true) return;
                                            if (isSpiderTeamName(t.teamName)) return;
                                            const tn = String(t.teamName).trim();
                                            const lastCharMatch = /\d([A-ZÁ-Ž])\s*$/.exec(tn);
                                            const nameChar = lastCharMatch ? lastCharMatch[1].toUpperCase() : null;
                                            if (!nameChar) return;
                                            let groupChar = getGroupLastChar(t.groupName);
                                            if (!groupChar) groupChar = nameChar;
                                            if (!groupChar) return;
                                            if (!groupCharToOriginalChars.has(groupChar)) {
                                                groupCharToOriginalChars.set(groupChar, new Set());
                                            }
                                            groupCharToOriginalChars.get(groupChar).add(nameChar);
                                        });

                                        const continuationGroupCharsSetForSS = new Set();
                                        if (ssTeamLastCharForCheck) {
                                            continuationGroupCharsSetForSS.add(ssTeamLastCharForCheck);
                                            groupCharToOriginalChars.forEach((originalChars, groupChar) => {
                                                if (originalChars.has(ssTeamLastCharForCheck)) {
                                                    continuationGroupCharsSetForSS.add(groupChar);
                                                }
                                            });
                                        }

                                        // Nájdi posledné udalosti dňa user tímov v týchto skupinách
                                        const userTeamsInContinuationGroups = (this.ctx.teamsArrivalBufferRef?.current || []).filter((t) => {
                                            if (cleanCategory(t.category) !== cleanCategory(category)) return false;
                                            if (!t.teamName) return false;
                                            if (t.isRegistered !== true) return false;
                                            if (t.isSuperstructure === true) return false;
                                            if (isSpiderTeamName(t.teamName)) return false;
                                            const gName = t.groupName ? String(t.groupName).trim() : null;
                                            if (!gName) return false;
                                            const gChar = getGroupLastChar(gName);
                                            if (!gChar) return false;
                                            return continuationGroupCharsSetForSS.has(gChar);
                                        });

                                        const lastPlacesOfUserTeamsInContinuationGroups = new Map();
                                        userTeamsInContinuationGroups.forEach((t) => {
                                            const tn = String(t.teamName).trim();
                                            const teamEventsOnDay = (grouped[cleanCategory(category)]?.[tn] || [])
                                                .filter((ev) => {
                                                    const evDay = extractDayKeyFromWhen(ev.when);
                                                    return evDay === currentDay && ev.location;
                                                })
                                                .sort((a, b) => {
                                                    const ta = a.endTs != null ? a.endTs : (a.startTs != null ? a.startTs : (a.ts != null ? a.ts : Number.POSITIVE_INFINITY));
                                                    const tb = b.endTs != null ? b.endTs : (b.startTs != null ? b.startTs : (b.ts != null ? b.ts : Number.POSITIVE_INFINITY));
                                                    return tb - ta;
                                                });
                                            if (teamEventsOnDay.length === 0) return;
                                            const lastEv = teamEventsOnDay[0];
                                            const lastEndTs = lastEv.endTs != null
                                                ? lastEv.endTs
                                                : (lastEv.startTs != null ? lastEv.startTs : (lastEv.ts != null ? lastEv.ts : null));
                                            const existing = lastPlacesOfUserTeamsInContinuationGroups.get(tn);
                                            if (!existing || (lastEndTs != null && lastEndTs > (existing.endTs ?? -Infinity))) {
                                                lastPlacesOfUserTeamsInContinuationGroups.set(tn, {
                                                    location: lastEv.location,
                                                    endTs: lastEndTs,
                                                });
                                            }
                                        });

                                        // Skontroluj, či aspoň jeden z týchto tímov skončil na rovnakom mieste,
                                        // ako je miesto prvej udalosti tohto SS tímu
                                        const anyContinuationTeamEndsAtSamePlace = (() => {
                                            if (!current.location) return false;
                                            for (const info of lastPlacesOfUserTeamsInContinuationGroups.values()) {
                                                if (!info.location) continue;
                                                if (this.isSamePlaceForTransfer(info.location, current.location)) {
                                                    return true;
                                                }
                                            }
                                            return false;
                                        })();

                                        // ═══════════════════════════════════════════════════════════════
                                        // ← NOVÁ LOGIKA:
                                        //  • Ak VŠETKY pokračujúce tímy skončili na rovnakom mieste,
                                        //    ako je miesto prvej udalosti SS tímu → negeneruj nič.
                                        //  • Ak NIEKTORÝ pokračujúci tím skončil INADE → vygeneruj
                                        //    presun z miesta poslednej udalosti ľubovoľného
                                        //    pokračujúceho tímu (toho, ktorý skončil inde) na
                                        //    miesto prvej udalosti SS tímu.
                                        // ═══════════════════════════════════════════════════════════════
                                        const placesOfContinuationTeams = [];
                                        lastPlacesOfUserTeamsInContinuationGroups.forEach((info) => {
                                            if (!info.location) return;
                                            if (this.isSamePlaceForTransfer(info.location, current.location)) return;
                                            placesOfContinuationTeams.push({
                                                location: info.location,
                                                endTs: info.endTs,
                                            });
                                        });

                                        if (anyContinuationTeamEndsAtSamePlace && placesOfContinuationTeams.length === 0) {
                                            // Všetky pokračujúce tímy skončili na rovnakom mieste
                                            // → negeneruj ranný presun z miesta zrazu.
                                        } else if (placesOfContinuationTeams.length > 0) {
                                            // Aspoň jeden pokračujúci tím skončil inde →
                                            // vygeneruj presun z miesta poslednej udalosti
                                            // pokračujúceho tímu na miesto prvej udalosti SS tímu.
                                            // Ak ich je viac, vygeneruj presun pre každé unikátne miesto.
                                            // Zjednoť miesta pokračujúcich tímov (unikátne miesta)
                                            const uniquePlacesMap = new Map();
                                            placesOfContinuationTeams.forEach((info) => {
                                                const key = normalizePlaceName(info.location);
                                                if (!key) return;
                                                const existing = uniquePlacesMap.get(key);
                                                if (!existing || (info.endTs != null && info.endTs > (existing.endTs ?? -Infinity))) {
                                                    uniquePlacesMap.set(key, info);
                                                }
                                            });

                                            // ═══════════════════════════════════════════════════════════════
                                            // ← NOVÁ ZMENA: Čas odchodu = NAJNESKORŠÍ endTs zo VŠETKÝCH
                                            //   posledných udalostí pokračujúcich tímov (nielen z tých,
                                            //   ktoré skončili inde). Tak sa zabezpečí, že tím odíde až
                                            //   vtedy, keď skončila posledná udalosť ktoréhokoľvek
                                            //   pokračujúceho tímu.
                                            // ═══════════════════════════════════════════════════════════════
                                            let latestEndTsAcrossAll = null;
                                            lastPlacesOfUserTeamsInContinuationGroups.forEach((info) => {
                                                if (info.endTs == null) return;
                                                if (latestEndTsAcrossAll == null || info.endTs > latestEndTsAcrossAll) {
                                                    latestEndTsAcrossAll = info.endTs;
                                                }
                                            });
                                            // Zahrň aj prípad, že niektoré miesto má endTs z placesOfContinuationTeams
                                            placesOfContinuationTeams.forEach((info) => {
                                                if (info.endTs == null) return;
                                                if (latestEndTsAcrossAll == null || info.endTs > latestEndTsAcrossAll) {
                                                    latestEndTsAcrossAll = info.endTs;
                                                }
                                            });

                                            const arrivalTs = current.startTs;
                                            const arrivalStr = formatFullFromTs(arrivalTs) || current.when;

                                            uniquePlacesMap.forEach((info) => {
                                                if (this.isSamePlaceForTransfer(info.location, current.location)) return;

                                                // ← Čas odchodu = najneskorší endTs zo všetkých
                                                //   posledných udalostí pokračujúcich tímov.
                                                const departureTs = latestEndTsAcrossAll != null
                                                    ? latestEndTsAcrossAll
                                                    : timestampOnDay(arrivalTs, 0, 0);
                                                const departureStr = formatFullFromTs(departureTs) || '00:00';

                                                if (departureTs != null && arrivalTs != null && departureTs >= arrivalTs) {
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
                            if (this.isSamePlaceForTransfer(current.location, next.location)) {
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
                            if (this.isSamePlaceForTransfer(current.location, next.location)) {
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

                        const isMeetingPointDay =
                            meetingPointDayKey != null &&
                            meetingPointDayKey !== '' &&
                            currentDay != null &&
                            currentDay === meetingPointDayKey;

                        const meetingPointStopForDay = (() => {
                            if (!isMeetingPointDay) return null;
                            const fromAllPlaces = (this.ctx.allPlacesRef?.current || []).find((p) => p.isMeetingPointStop === true);
                            if (fromAllPlaces) return fromAllPlaces;
                            const fromStops = (this.ctx.stopsList || []).find((p) => p.isMeetingPointStop === true);
                            return fromStops || null;
                        })();

                        if (isLastEventOfDay && !isVeryLastEventOfTeam && current.location) {
                            const teamIsInUsers = (this.ctx.teamsArrivalBufferRef?.current || []).some(
                                (t) => cleanCategory(t.category) === cleanCategory(category)
                                    && t.teamName === teamName
                                    && t.isRegistered === true
                            );
                            const hasAccommodation = accommodationName && accommodationName.trim() !== '';

                            const isMeetingPointDay =
                                meetingPointDayKey != null && meetingPointDayKey !== '' &&
                                currentDay != null && currentDay === meetingPointDayKey;

                            const isGlobalLastDay = currentDay === globalLastDay;

                            const anySuperstructureTeamHasEventToday = (() => {
                                if (!currentDay) return false;
                                const categoryClean = cleanCategory(category);
                                return (this.ctx.teamsArrivalBufferRef?.current || []).some((t) => {
                                    if (cleanCategory(t.category) !== categoryClean) return false;
                                    if (t.isSuperstructure !== true) return false;
                                    return (this.ctx.matchesBufferRef?.current || []).some((m) => {
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
                                const fromAllPlaces = (this.ctx.allPlacesRef?.current || []).find((p) => p.isMeetingPointStop === true);
                                if (fromAllPlaces) return fromAllPlaces;
                                const fromStops = (this.ctx.stopsList || []).find((p) => p.isMeetingPointStop === true);
                                return fromStops || null;
                            })();

                            const externalArrivalStopForDay = (() => {
                                const fromAllPlaces = (this.ctx.allPlacesRef?.current || []).find((p) => p.isExternalArrivalStop === true);
                                if (fromAllPlaces) return fromAllPlaces;
                                const fromStops = (this.ctx.stopsList || []).find((p) => p.isExternalArrivalStop === true);
                                return fromStops || null;
                            })();

                            const groupCharForSS = ssGroupCharByTeam[`${cleanCategory(category)}|${teamName}`];

                            if (isMeetingPointDay) {
                                const returnMP = meetingPointStop;
                                if (returnMP && !this.isSamePlaceForTransfer(current.location, returnMP.name)) {
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
                                if (
                                    teamIsInUsers &&
                                    hasAccommodation &&
                                    returnMP &&
                                    !anySuperstructureTeamHasEventToday
                                ) {
                                    const dest = accommodationName.trim();
                                    if (!this.isSamePlaceForTransfer(returnMP.name, dest)) {
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
                                if (isGlobalLastDay && returnMP && externalArrivalStop && !this.isSamePlaceForTransfer(returnMP.name, externalArrivalStop.name)) {
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
                                const usersEveningBlocked = teamIsInUsers && anySuperstructureTeamHasEventToday;

                                if (teamIsInUsers && !usersEveningBlocked) {
                                    const departureTs = current.endTs != null ? current.endTs : current.startTs;
                                    const departureStr = formatFullFromTs(departureTs) || current.when;
                                    const arrivalTs = timestampOnDay(departureTs, 23, 59);
                                    const arrivalStr = formatFullFromTs(arrivalTs) || '23:59';
                                    if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                        if (hasAccommodation) {
                                            const dest = accommodationName.trim();
                                            if (!this.isSamePlaceForTransfer(current.location, dest)) {
                                                enriched.push({
                                                    ts: current.ts + 1,
                                                    when: `${departureStr} – ${arrivalStr}`,
                                                    type: 'transfer',
                                                    text: `Presun z ${current.location} do ubytovanie ${dest}`,
                                                    location: null,
                                                    isTransfer: true,
                                                });
                                            }
                                        } else if (meetingPointStop && !this.isSamePlaceForTransfer(current.location, meetingPointStop.name)) {
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
                                            if (this.isSamePlaceForTransfer(current.location, dest)) return;
                                            enriched.push({
                                                ts: current.ts + 1,
                                                when: `${departureStr} – ${arrivalStr}`,
                                                type: 'transfer',
                                                text: `Presun z ${current.location} do ubytovanie ${dest}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        });
                                        if (meetingPointStop && !this.isSamePlaceForTransfer(current.location, meetingPointStop.name)) {
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

                        // ═══════════════════════════════════════════════════════════════════════
                        // NOVÉ: Pre SUPERSTRUCTURE tím – posledná udalosť tímu v posledný deň
                        // turnaja → presun na miesto nástupu/výstupu s miestom zrazu ako
                        // medzizastávkou.
                        //
                        // • Pre NEPAVÚKOVÉ tímy s budúcim pavúkovým zápasom (napr. 4C môže hrať
                        //   1I, 2I, 3I, ...) sa presun NEGENERUJE.
                        // • Pre PAVÚKOVÉ tímy (1F, 2F, 1G, 2G, 4I, 5I, ...), ktoré ešte budú hrať
                        //   finále / o 3. miesto (LSF01, WSF01, ...), sa presun GENERUJE, ale
                        //   s časom odchodu = čas konca poslednej teoretickej pavúkovej udalosti,
                        //   ktorá začína po ich poslednej udalosti.
                        // ═══════════════════════════════════════════════════════════════════════
                        if (
                            isVeryLastEventOfTeam &&
                            current.location &&
                            currentDay != null &&
                            globalLastDay != null &&
                            currentDay === globalLastDay
                        ) {
                            const teamIsInUsersForLastDay = (this.ctx.teamsArrivalBufferRef?.current || []).some(
                                (t) => cleanCategory(t.category) === cleanCategory(category)
                                    && t.teamName === teamName
                                    && t.isRegistered === true
                            );
                            const isSuperstructureTeamForLastDay = !teamIsInUsersForLastDay;
                            const isPavukTeamForLastDay = isSpiderTeamName(teamName);
                        
                            // Pomocná funkcia na odstránenie prefixu kategórie z názvu tímu.
                            const stripCategoryPrefix = (tn, cat) => {
                                if (!tn) return '';
                                const s = String(tn).trim();
                                const c = String(cat || '').trim();
                                if (!c) return s;
                                if (s === c) return '';
                                if (s.startsWith(c + ' ')) return s.slice(c.length + 1).trim();
                                return s;
                            };
                        
                            // ───────────────────────────────────────────────────────────────────
                            // Zisti, či tím ešte bude hrať ďalší zápas v pavúku.
                            //   • Pre pavúkový tím (napr. "U10 D 4C") zisti písmeno skupiny
                            //     (posledné písmeno názvu = "C").
                            //   • Zisti všetky "pokračujúce" skupiny (rovnaká logika ako pri
                            //     user tímoch – mapovanie groupChar -> continuation chars).
                            //   • Skontroluj, či v kategórii existuje zápas typu
                            //     "<číslo><X>" (kde X je písmeno skupiny alebo jej pokračovania)
                            //     na deň > currentDay. Počet zápasov NIE JE obmedzený.
                            // ───────────────────────────────────────────────────────────────────
                            const pavukFutureMatchExists = (() => {
                                const teamNameStr = String(teamName || '').trim();
                                const bareTeamName = stripCategoryPrefix(teamNameStr, category);
                                const nameCharMatch = /\d([A-ZÁ-Ž])\s*$/.exec(bareTeamName);
                                const nameChar = nameCharMatch ? nameCharMatch[1].toUpperCase() : null;
                        
                                const teamInfo = (this.ctx.teamsArrivalBufferRef?.current || []).find(
                                    (t) => cleanCategory(t.category) === cleanCategory(category)
                                        && String(t.teamName || '').trim() === teamNameStr
                                );
                                const groupCharFromGroupName = teamInfo && teamInfo.groupName
                                    ? getGroupLastChar(teamInfo.groupName)
                                    : null;
                        
                                // ───────────────────────────────────────────────────────────────
                                // NOVÉ: Ak je tím pavúkový (napr. 1F, 2F, 1G, 2G, 4I, 5I) a NEMÁ
                                // groupName, musíme skontrolovať, či v kategórii existuje budúci
                                // pavúkový zápas (LSF, WSF, WQF, W16F, ...), ktorý začína neskôr
                                // ako posledná udalosť tímu. Ak áno, presun sa negeneruje (bude
                                // sa generovať s časom odchodu = koniec pavúkového zápasu).
                                // ───────────────────────────────────────────────────────────────
                                const isPavukTeamPattern = /^\s*\d+[A-ZÁ-Ž]\s*$/i.test(bareTeamName);
                                if (isPavukTeamPattern && !groupCharFromGroupName) {
                                    const currentLastTsForPavuk = current.endTs != null ? current.endTs : current.startTs;
                                    const pavukRegexForFuture = /^(W|L)(32F|16F|8F|QF|SF)\d+$/i;
                                    let hasFuturePavukMatch = false;
                        
                                    (this.ctx.matchesBufferRef?.current || []).forEach((m) => {
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
                                        if (!dayKey) return;
                        
                                        if (dayKey < currentDay) return;
                                        if (dayKey === currentDay) {
                                            const matchStartTs = m.scheduledTs != null ? m.scheduledTs : null;
                                            if (matchStartTs != null && currentLastTsForPavuk != null && matchStartTs <= currentLastTsForPavuk) {
                                                return;
                                            }
                                        }
                        
                                        [m.home, m.away].forEach((tn) => {
                                            if (!tn) return;
                                            const s = stripCategoryPrefix(tn, category);
                                            if (pavukRegexForFuture.test(s)) {
                                                hasFuturePavukMatch = true;
                                            }
                                        });
                                    });
                        
                                    if (hasFuturePavukMatch) {
                                        console.log(
                                            `%c[TRANSPORT][SS-FUTURE-CHECK] Tím "${teamNameStr}" je pavúkový tím a má budúci pavúkový zápas → presun sa negeneruje hneď, ale až po skončení pavúkového zápasu.`,
                                            'color: #b91c1c; font-weight: bold;'
                                        );
                                        return true;
                                    }
                        
                                    console.log(
                                        `%c[TRANSPORT][SS-FUTURE-CHECK] Tím "${teamNameStr}" je pavúkový tím bez budúceho pavúkového zápasu → presun sa VŽDY generuje.`,
                                        'color: #16a34a; font-weight: bold;'
                                    );
                                    return false;
                                }
                        
                                // Pôvodná kontrola pre tímy s groupName (4A, 4C, 4E, ...)
                                if (!groupCharFromGroupName) {
                                    console.log(
                                        `%c[TRANSPORT][SS-FUTURE-CHECK] Tím "${teamNameStr}" nemá groupName (pavúkový tím) → presun sa VŽDY generuje.`,
                                        'color: #16a34a; font-weight: bold;'
                                    );
                                    return false;
                                }
                        
                                // Pre hľadanie budúcich zápasov použi LEN skupinu, do ktorej tím patrí.
                                const baseChars = new Set();
                                baseChars.add(groupCharFromGroupName);
                                if (baseChars.size === 0) return false;
                        
                                // Zisti mapovanie groupChar -> Set<nameChar> pre všetky SS tímy
                                const groupCharToContinuationChars = new Map();
                                (this.ctx.teamsArrivalBufferRef?.current || []).forEach((t) => {
                                    if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                    if (!t.teamName) return;
                                    if (t.isSuperstructure !== true) return;
                                    if (isSpiderTeamName(t.teamName)) return;
                                    const tn = String(t.teamName).trim();
                                    const bareTn = stripCategoryPrefix(tn, category);
                                    const lastCharMatch = /\d([A-ZÁ-Ž])\s*$/.exec(bareTn);
                                    const tNameChar = lastCharMatch ? lastCharMatch[1].toUpperCase() : null;
                                    if (!tNameChar) return;
                                    let tGroupChar = getGroupLastChar(t.groupName);
                                    if (!tGroupChar) tGroupChar = tNameChar;
                                    if (!tGroupChar) return;
                                    if (!groupCharToContinuationChars.has(tGroupChar)) {
                                        groupCharToContinuationChars.set(tGroupChar, new Set());
                                    }
                                    groupCharToContinuationChars.get(tGroupChar).add(tNameChar);
                                });
                        
                                const continuationCharsSet = new Set(baseChars);
                                groupCharToContinuationChars.forEach((originalChars, groupChar) => {
                                    for (const baseChar of baseChars) {
                                        if (originalChars.has(baseChar)) {
                                            continuationCharsSet.add(groupChar);
                                        }
                                    }
                                });
                        
                                console.log(
                                    `%c[TRANSPORT][SS-FUTURE-CHECK] Tím "${teamNameStr}": bareName="${bareTeamName}", nameChar=${nameChar || '—'}, groupChar=${groupCharFromGroupName || '—'}, continuationCharsSet={${[...continuationCharsSet].sort().join(', ')}}`,
                                    'color: #ea580c; font-weight: bold;'
                                );
                        
                                // Pracujeme s holým označením tímu (bez prefixu kategórie),
                                // takže regex môže byť presný: "1I", "4C", "10I", "32I", ...
                                const pavukNumberedRegex = /^\s*(\d+)([A-ZÁ-Ž])\d*\s*$/i;
                                let foundNumbered = false;
                        
                                const isSpecialPavukTeam = (tn) => {
                                    if (!tn) return false;
                                    const s = stripCategoryPrefix(tn, category);
                                    return /^(W|L)(32F|16F|8F|QF|SF)\d+$/i.test(s);
                                };
                        
                                const teamBelongsToContinuation = (tn) => {
                                    if (!tn) return false;
                                    const s = stripCategoryPrefix(tn, category);
                                    const m = /^\s*(\d+)([A-ZÁ-Ž])\d*\s*$/i.exec(s);
                                    if (m && continuationCharsSet.has(m[2].toUpperCase())) return true;
                                    const info = (this.ctx.teamsArrivalBufferRef?.current || []).find(
                                        (t) => cleanCategory(t.category) === cleanCategory(category)
                                            && String(t.teamName || '').trim() === String(tn).trim()
                                    );
                                    if (info && info.groupName) {
                                        const gChar = getGroupLastChar(info.groupName);
                                        if (gChar && continuationCharsSet.has(gChar)) return true;
                                    }
                                    return false;
                                };
                        
                                const currentLastTs = current.endTs != null ? current.endTs : current.startTs;
                        
                                (this.ctx.matchesBufferRef?.current || []).forEach((m) => {
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
                                    if (!dayKey) return;
                        
                                    if (dayKey < currentDay) return;
                                    if (dayKey === currentDay) {
                                        const matchStartTs = m.scheduledTs != null ? m.scheduledTs : null;
                                        if (matchStartTs != null && currentLastTs != null && matchStartTs <= currentLastTs) {
                                            return;
                                        }
                                    }
                        
                                    [m.home, m.away].forEach((tn) => {
                                        if (!tn) return;
                                        const s = stripCategoryPrefix(tn, category);
                        
                                        const matchNumbered = pavukNumberedRegex.exec(s);
                                        if (matchNumbered) {
                                            const char = matchNumbered[2].toUpperCase();
                                            if (continuationCharsSet.has(char)) {
                                                foundNumbered = true;
                                            }
                                        }
                        
                                        if (isSpecialPavukTeam(tn)) {
                                            const otherTn = (String(m.home).trim() === String(tn).trim() ? m.away : m.home);
                                            if (otherTn && teamBelongsToContinuation(otherTn)) {
                                                foundNumbered = true;
                                            }
                                        }
                                    });
                                });
                        
                                if (foundNumbered) {
                                    console.log(
                                        `%c[TRANSPORT][SS-FUTURE-CHECK] Tím "${teamNameStr}" MÁ budúci pavúkový zápas → presun sa negeneruje.`,
                                        'color: #b91c1c; font-weight: bold;'
                                    );
                                } else {
                                    console.log(
                                        `%c[TRANSPORT][SS-FUTURE-CHECK] Tím "${teamNameStr}" NEMÁ budúci pavúkový zápas → presun sa vygeneruje.`,
                                        'color: #16a34a; font-weight: bold;'
                                    );
                                }
                        
                                return foundNumbered;
                            })();
                        
                            // ───────────────────────────────────────────────────────────────────
                            // NOVÉ: Pre pavúkové tímy (1F, 2F, 1G, 2G, ...), ktoré ešte budú hrať
                            // finále / o 3. miesto, sa presun generuje, ale s časom odchodu =
                            // čas konca poslednej teoretickej pavúkovej udalosti, ktorá začína
                            // po ich poslednej udalosti.
                            // ───────────────────────────────────────────────────────────────────
                            let effectiveDepartureTs = current.endTs != null ? current.endTs : current.startTs;
                            let effectiveDepartureStr = formatFullFromTs(effectiveDepartureTs) || current.when;
                        
                            if (isPavukTeamForLastDay) {
                                const currentLastTsForPavuk = current.endTs != null ? current.endTs : current.startTs;
                                const pavukRegexForFuture = /^(W|L)(32F|16F|8F|QF|SF)\d+$/i;
                                let latestPavukEndTs = null;
                        
                                (this.ctx.matchesBufferRef?.current || []).forEach((m) => {
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
                                    if (!dayKey) return;
                        
                                    if (dayKey < currentDay) return;
                                    if (dayKey === currentDay) {
                                        const matchStartTs = m.scheduledTs != null ? m.scheduledTs : null;
                                        if (matchStartTs != null && currentLastTsForPavuk != null && matchStartTs <= currentLastTsForPavuk) {
                                            return;
                                        }
                                    }
                        
                                    let isPavukMatch = false;
                                    [m.home, m.away].forEach((tn) => {
                                        if (!tn) return;
                                        const s = stripCategoryPrefix(tn, category);
                                        if (pavukRegexForFuture.test(s)) {
                                            isPavukMatch = true;
                                        }
                                    });
                                    if (!isPavukMatch) return;
                        
                                    const matchEndTs = m.scheduledEndTs != null
                                        ? m.scheduledEndTs
                                        : (m.scheduledTs != null ? m.scheduledTs : null);
                                    if (matchEndTs == null) return;
                        
                                    if (latestPavukEndTs == null || matchEndTs > latestPavukEndTs) {
                                        latestPavukEndTs = matchEndTs;
                                    }
                                });
                        
                                if (latestPavukEndTs != null) {
                                    effectiveDepartureTs = latestPavukEndTs;
                                    effectiveDepartureStr = formatFullFromTs(latestPavukEndTs) || current.when;
                                    console.log(
                                        `%c[TRANSPORT][SS-PAVUK] Tím "${teamName}" – presun sa generuje s časom odchodu = koniec pavúkového zápasu: ${effectiveDepartureStr}`,
                                        'color: #16a34a; font-weight: bold;'
                                    );
                                }
                            }
                        
                            if (pavukFutureMatchExists && !isPavukTeamForLastDay) {
                                // Pre ne-pavúkové tímy s budúcim pavúkovým zápasom sa presun negeneruje
                                console.log(
                                    `%c[TRANSPORT][SS-FUTURE] Tím "${teamName}" má budúci pavúkový zápas – presun na miesto nástupu/výstupu sa negeneruje.`,
                                    'color: #b91c1c; font-weight: bold;'
                                );
                            } else {
                                // Presun na miesto nástupu/výstupu s medzizastávkou
                                const meetingPointStopForLastDay = (() => {
                                    const fromAllPlaces = (this.ctx.allPlacesRef?.current || []).find((p) => p.isMeetingPointStop === true);
                                    if (fromAllPlaces) return fromAllPlaces;
                                    const fromStops = (this.ctx.stopsList || []).find((p) => p.isMeetingPointStop === true);
                                    return fromStops || null;
                                })();
                        
                                const externalArrivalStopForLastDay = (() => {
                                    const fromAllPlaces = (this.ctx.allPlacesRef?.current || []).find((p) => p.isExternalArrivalStop === true);
                                    if (fromAllPlaces) return fromAllPlaces;
                                    const fromStops = (this.ctx.stopsList || []).find((p) => p.isExternalArrivalStop === true);
                                    return fromStops || null;
                                })();
                        
                                const canGeneratePavukTransfer =
                                    isPavukTeamForLastDay &&
                                    meetingPointStopForLastDay &&
                                    externalArrivalStopForLastDay &&
                                    !this.isSamePlaceForTransfer(current.location, externalArrivalStopForLastDay.name);
                        
                                const canGenerateSuperstructureTransfer =
                                    isSuperstructureTeamForLastDay &&
                                    !isPavukTeamForLastDay &&
                                    meetingPointStopForLastDay &&
                                    externalArrivalStopForLastDay &&
                                    !this.isSamePlaceForTransfer(current.location, externalArrivalStopForLastDay.name);
                        
                                if (canGeneratePavukTransfer || canGenerateSuperstructureTransfer) {
                                    const departureTs = canGeneratePavukTransfer
                                        ? effectiveDepartureTs
                                        : (current.endTs != null ? current.endTs : current.startTs);
                                    const departureStr = canGeneratePavukTransfer
                                        ? effectiveDepartureStr
                                        : (formatFullFromTs(departureTs) || current.when);
                        
                                    const arrivalTs = timestampOnDay(departureTs, 23, 59);
                                    const arrivalStr = formatFullFromTs(arrivalTs) || '23:59';
                        
                                    if (!(departureTs != null && arrivalTs != null && departureTs >= arrivalTs)) {
                                        const mpIsSameAsFrom = this.isSamePlaceForTransfer(
                                            meetingPointStopForLastDay.name,
                                            current.location
                                        );
                                        const mpIsSameAsTo = this.isSamePlaceForTransfer(
                                            meetingPointStopForLastDay.name,
                                            externalArrivalStopForLastDay.name
                                        );
                        
                                        const intermediateStopIds = mpIsSameAsFrom || mpIsSameAsTo
                                            ? []
                                            : [meetingPointStopForLastDay.id];
                        
                                        const textParts = [`Presun z ${current.location}`];
                                        if (intermediateStopIds.length > 0) {
                                            textParts.push(`cez miesto zrazu ${meetingPointStopForLastDay.name}`);
                                        }
                                        textParts.push(`do ${externalArrivalStopForLastDay.name}`);
                        
                                        enriched.push({
                                            ts: current.ts + 1,
                                            when: `${departureStr} – ${arrivalStr}`,
                                            type: 'transfer',
                                            text: textParts.join(' '),
                                            location: null,
                                            isTransfer: true,
                                            _fromPlaceName: current.location,
                                            _toPlaceName: externalArrivalStopForLastDay.name,
                                            _intermediateStopIds: intermediateStopIds,
                                        });
                                    }
                                }
                            }
                        }

                        if (
                            meetingPointDayKey &&
                            meetingPointDayKey !== '' &&
                            isLastEventOfDay &&
                            currentDay != null &&
                            currentDay === meetingPointDayKey
                        ) {
                            const teamIsInUsersForMeetingPoint = (this.ctx.teamsArrivalBufferRef?.current || []).some(
                                (t) => cleanCategory(t.category) === cleanCategory(category)
                                    && t.teamName === teamName
                                    && t.isRegistered === true
                            );

                            const meetingPointStopForReturn = (() => {
                                const fromAllPlaces = (this.ctx.allPlacesRef?.current || []).find((p) => p.isMeetingPointStop === true);
                                if (fromAllPlaces) return fromAllPlaces;
                                const fromStops = (this.ctx.stopsList || []).find((p) => p.isMeetingPointStop === true);
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
                                            if (this.isSamePlaceForTransfer(meetingPointStopForReturn.name, accomName)) return;
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
                            const foundTeamIdentifiers = this.findTeamIdentifiersByName(category, teamName);
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
                            
                                // ───────────────────────────────────────────────────────────────
                                // NOVÉ: preferuj explicitné polia z enriched udalosti
                                // (obsahujú ich presuny s medzizastávkou – napr. posledný deň
                                // turnaja pre SS tím: z miesta udalosti cez miesto zrazu
                                // na miesto nástupu/výstupu).
                                // ───────────────────────────────────────────────────────────────
                                if (ev._fromPlaceName && ev._toPlaceName) {
                                    fromLocationText = String(ev._fromPlaceName).trim();
                                    toLocationText = String(ev._toPlaceName).trim();
                                } else {
                                    const m = /^Presun z (.+?)(?: cez miesto zrazu .+?)? do (.+)$/.exec(String(ev.text || ''));
                                    if (m) {
                                        fromLocationText = m[1].trim();
                                        toLocationText = m[2].trim();
                                    }
                                }
                            
                                if (fromLocationText && toLocationText && this.isSamePlaceForTransfer(fromLocationText, toLocationText)) {
                                    return;
                                }
                            
                                const fromId = this.resolvePlaceIdByName(fromLocationText);
                                const toId = this.resolvePlaceIdByName(toLocationText);
                            
                                if (fromId && toId && fromId === toId) {
                                    return;
                                }
                            
                                const evDayKey = extractDayKeyFromWhen(ev.when) || null;
                            
                                const existingParentWithStops = (this.ctx.savedTransfersRef?.current || []).find((s) => {
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
                            
                                const existingDirectParent = (this.ctx.savedTransfersRef?.current || []).find((s) => {
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
                            
                                const existingSaved = existingParentWithStops || existingDirectParent || (this.ctx.savedTransfersRef?.current || []).find((s) => s.key === key);
                            
                                const baseRecord = {
                                    category: cleanCategory(category),
                                    teamUid: effectiveTeamIdentifiers.teamUid,
                                    teamIndex: effectiveTeamIdentifiers.teamIndex,
                                    when: String(ev.when || '').trim(),
                                    fromId,
                                    toId,
                                    dayKey: extractDayKeyFromWhen(ev.when) || null,
                                };
                            
                                // ───────────────────────────────────────────────────────────────
                                // NOVÉ: Prenes medzizastávky z enriched udalosti (ak existujú).
                                // Priorita:
                                //   1) explicitné ev._intermediateStopIds (nový posledný presun dňa)
                                //   2) existujúce medzizastávky v existingSaved (zachovanie stavu)
                                // ───────────────────────────────────────────────────────────────
                                if (Array.isArray(ev._intermediateStopIds) && ev._intermediateStopIds.length > 0) {
                                    baseRecord.intermediateStopIds = [...ev._intermediateStopIds];
                                } else if (existingSaved && Array.isArray(existingSaved.intermediateStopIds) && existingSaved.intermediateStopIds.length > 0) {
                                    baseRecord.intermediateStopIds = [...existingSaved.intermediateStopIds];
                                }
                            
                                if (isSuperstructureTeamForDb) baseRecord.teamName = teamName;
                            
                                if (existingSaved) {
                                    if (existingSaved.isWalking === true) {
                                        baseRecord.isWalking = true;
                                        baseRecord.walkingSetAt = existingSaved.walkingSetAt || Timestamp.fromDate(new Date());
                                        baseRecord.walkingSetBy = existingSaved.walkingSetBy || (this.ctx.userProfileData && this.ctx.userProfileData.email) || null;
                                    }
                                }
                            
                                const draft = {
                                    ...baseRecord,
                                    key,
                                    segments: Array.isArray(existingSaved?.segments)
                                        ? existingSaved.segments.map((s) => ({ ...s }))
                                        : buildDefaultSegments(baseRecord),
                                };
                            
                                // ───────────────────────────────────────────────────────────────
                                // Ak existuje záznam s medzizastávkami, dogeneruj chýbajúce
                                // segmenty podľa aktuálneho poradia routeIds.
                                // ───────────────────────────────────────────────────────────────
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
                            
                                // ───────────────────────────────────────────────────────────────
                                // Ak existujú nové medzizastávky z ev._intermediateStopIds,
                                // zabezpeč, že draft.segments zodpovedajú routeIds
                                // (fromId → ...medzizastávky... → toId).
                                // ───────────────────────────────────────────────────────────────
                                if (Array.isArray(ev._intermediateStopIds) && ev._intermediateStopIds.length > 0) {
                                    const stopsIds = ev._intermediateStopIds.filter(Boolean);
                                    const routeIdsRaw = [fromId, ...stopsIds, toId].filter(Boolean);
                                    const routeIds = [];
                                    routeIdsRaw.forEach((id) => {
                                        if (routeIds.length === 0 || routeIds[routeIds.length - 1] !== id) routeIds.push(id);
                                    });
                            
                                    const existingSegs = Array.isArray(draft.segments) ? draft.segments : [];
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
                            
                                this.recomputeParentSegmentsInPlace(draft);
                            
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
                                        transfersPatch[key].walkingSetBy = existingSaved.walkingSetBy || (this.ctx.userProfileData && this.ctx.userProfileData.email) || null;
                                    }
                                }
                            });

                            const categoryClean = cleanCategory(category);
                            (this.ctx.savedTransfersRef?.current || []).forEach((s) => {
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
                                    const parentExists = (this.ctx.savedTransfersRef?.current || []).some(
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

                    const timelineLines = this.renderTeamTimeline(category, teamName, enriched, {
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
        const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
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
    
        // Spočítaj VŠETKY kandidátske segmenty
        const countCandidates = () => {
            let total = 0;
            (this.ctx.savedTransfersRef?.current || []).forEach((parent) => {
                if (!Array.isArray(parent.segments)) return;
                if (dayKeyFilter && parent.dayKey !== dayKeyFilter) return;
                if (categoryFilter && cleanCategory(parent.category || '') !== categoryFilter) return;
                const stopsIds = Array.isArray(parent.intermediateStopIds) ? parent.intermediateStopIds : [];
                const isDirectTransfer = stopsIds.length === 0;
                if (isDirectTransfer) {
                    if (parent.isWalking === true) return;
                    if (!isPairWalking(parent.fromId, parent.toId)) return;
                    const segIdx = findSegmentIndex(parent.segments, parent.fromId, parent.toId);
                    if (segIdx === -1) return;
                    const seg = parent.segments[segIdx];
                    if (!seg || seg.isWalking === true) return;
                    total += 1;
                } else {
                    parent.segments.forEach((seg) => {
                        if (!seg || seg.isWalking === true) return;
                        if (!isPairWalking(seg.fromId, seg.toId)) return;
                        total += 1;
                    });
                }
            });
            return total;
        };
    
        const initialCandidateCount = countCandidates();

        // ① POČIATOČNÝ PROGRESS – zavoláme LEN ak máme nenulový počet kandidátov.
        // Ak je initialCandidateCount === 0, počiatočný progress NEZAVOLÁME,
        // aby neprepísal hodnotu, ktorú nastavil render (candidateCount z UI).
        if (onProgress && initialCandidateCount > 0) {
            try {
                onProgress({ remaining: initialCandidateCount, total: initialCandidateCount, processed: 0 });
            } catch (e) { /* ignore */ }
        }
    
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
            // Nevoláme onProgress s remaining: 0, processed: 0 – to by v UI
            // prepísalo počiatočnú hodnotu candidateCount na 0 a tlačidlo by
            // zobrazilo "Počet presunov, ktoré ostáva priradiť: 0".
            // Namiesto toho necháme UI zobraziť pôvodnú hodnotu candidateCount.
            window.showGlobalNotification?.('Nenašli sa žiadne presuny, ktoré by zodpovedali pravidlám "peši".', 'info');
            return;
        }
    
        try {
            let updatedParentsCount = 0;
            const parentKeysArr = [...parentsToUpdate];
    
            for (let idx = 0; idx < parentKeysArr.length; idx++) {
                const parentKey = parentKeysArr[idx];
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
    
                // ③ PRIEBEŽNÝ PROGRESS po každom parentovi
                if (onProgress) {
                    const stillRemaining = countCandidates();
                    try {
                        onProgress({
                            remaining: stillRemaining,
                            total: initialCandidateCount,
                            processed: idx + 1,
                        });
                    } catch (e) { /* ignore */ }
                }
            }
    
            if (onProgress) {
                try {
                    onProgress({ remaining: 0, total: initialCandidateCount, processed: parentKeysArr.length });
                } catch (e) { /* ignore */ }
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

    async generateTransfers({ category, meetingPointDayKey = '', isRegen = false, onWalkingProgress = null }) {
        if (!category) {
            window.showGlobalNotification?.('Najprv vyberte kategóriu.', 'error');
            return;
        }
        if (!this.ctx) {
            window.showGlobalNotification?.('Generátor nie je inicializovaný.', 'error');
            return;
        }

        if (this.ctx.meetingPointDayKeyRef) {
            this.ctx.meetingPointDayKeyRef.current = meetingPointDayKey || '';
        }

        this.rebuildAndLogTimeline(true, category);

        await this.waitForTransfersUpdate(category);

        try {
            await this.setAllWalkingTransfersAsWalking({ category, onProgress: onWalkingProgress });
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

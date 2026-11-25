// transport.js
// Modul zobrazuje PRESUNY tímov (transfery) v rovnakom vizuálnom štýle.
//
// Dáta čerpá z Firestore kolekcií:
//   - settings/transportTravelTimes  (times, transfers)
//   - transport                      (bus, busRow, teamShortcut, walkingRule)
//   - places, users
//   - settings/categories, settings/registration,
//     settings/superstructureGroups
//
// Renderovanie je plne cez React.createElement (žiadne JSX).

import {
  doc, getDoc, getDocs, onSnapshot, collection, Timestamp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef, useMemo } = React;

/* ------------------------------------------------------------------ */
/* Buffer pre per-tím timeline (zápasy + stravovanie)                 */
/* ------------------------------------------------------------------ */

const __transportPerTeamBuffer = {
  matches: [],
  catering: [],
  transfers: [],
  matchesReady: false,
  cateringReady: false,
  transfersReady: false,
  lastPrintedSignature: '',
  accommodationByKey: new Map(),
  accommodationReady: false,
};

window.__transportPerTeamBuffer = __transportPerTeamBuffer;

// ─── Doplnenie chýbajúcich časov pre presun PEŠI medzi dvomi rôznymi miestami ───
const applyImpliedWalkingTimesFromEvents = (events) => {
  if (!Array.isArray(events) || events.length < 2) return events;

  const normPlace = (s) => normalizePlaceName(String(s || ''));

  const getDayKeyFromTs = (ts) => {
    if (ts == null || !isFinite(ts)) return '';
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const extractDayKeyFromLabel = (label) => {
    const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(String(label || ''));
    if (!m) return '';
    return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  };

  const getEventStartEndTs = (ev) => {
    if (!ev) return null;
    if (ev.kind === 'match') {
      const s = ev.startTs != null && isFinite(ev.startTs)
        ? ev.startTs
        : (ev.ts != null && isFinite(ev.ts) ? ev.ts : null);
      if (s == null) return null;
      const e = ev.endTs != null && isFinite(ev.endTs) && ev.endTs > s ? ev.endTs : s;
      return { startTs: s, endTs: e };
    }
    if (ev.kind === 'catering') {
      const m = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(String(ev.label || ''));
      const baseTs = ev.ts != null && isFinite(ev.ts) ? ev.ts : null;
      if (m && baseTs != null) {
        const d = new Date(baseTs);
        const startTs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(m[1]), Number(m[2]), 0, 0).getTime();
        const endTs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(m[3]), Number(m[4]), 0, 0).getTime();
        return { startTs, endTs };
      }
      return baseTs != null ? { startTs: baseTs, endTs: baseTs } : null;
    }
    if (ev.kind === 'transfer') {
      const legs = Array.isArray(ev.legs) ? ev.legs : [];
      let s = null;
      let e = null;
      for (const leg of legs) {
        if (leg.startTs != null && isFinite(leg.startTs)) {
          s = s == null ? leg.startTs : Math.min(s, leg.startTs);
        }
        if (leg.endTs != null && isFinite(leg.endTs)) {
          e = e == null ? leg.endTs : Math.max(e, leg.endTs);
        }
      }
      if (s == null && ev.startTs != null && isFinite(ev.startTs)) s = ev.startTs;
      if (s == null && ev.ts != null && isFinite(ev.ts)) s = ev.ts;
      if (e == null && ev.endTs != null && isFinite(ev.endTs)) e = ev.endTs;
      if (e == null) e = s;
      if (s == null && e == null) return null;
      return { startTs: s ?? e, endTs: e ?? s };
    }
    return null;
  };

  const getEventPlaces = (ev) => {
    if (!ev) return { from: null, to: null };
    if (ev.kind === 'match') {
      const parts = String(ev.label || '').split('|').map((p) => p.trim());
      const place = parts[1] || null;
      return { from: place, to: place };
    }
    if (ev.kind === 'catering') {
      const parts = String(ev.label || '').split('|').map((p) => p.trim());
      const place = parts[2] || null;
      return { from: place, to: place };
    }
    if (ev.kind === 'transfer') {
      const legs = ev.legs || [];
      const from = legs[0]?.fromName || ev.fromName || null;
      const to = legs[legs.length - 1]?.toName || ev.toName || null;
      return { from, to };
    }
    return { from: null, to: null };
  };

  const isWalkingTransferWithoutTime = (ev) => {
    if (!ev || ev.kind !== 'transfer') return false;
    const legs = ev.legs || [];
    if (legs.length === 0) return Boolean(ev.isWalking) && !ev.startTs && !ev.endTs;
    const allWalking = legs.every((l) => l.isWalking === true);
    const hasAnyTime = legs.some((l) => l.startTs != null && l.endTs != null && l.endTs > l.startTs);
    return allWalking && !hasAnyTime;
  };

  const getEffectiveDayKey = (ev) => {
    if (ev.dayKey) return String(ev.dayKey);
    const range = getEventStartEndTs(ev);
    if (range?.startTs != null && isFinite(range.startTs)) return getDayKeyFromTs(range.startTs);
    const fromLabel = extractDayKeyFromLabel(ev.label);
    if (fromLabel) return fromLabel;
    if (ev.when) {
      const fromWhen = extractDayKeyFromLabel(ev.when);
      if (fromWhen) return fromWhen;
    }
    return '';
  };

  const isFirstTournamentDay = (dk) => {
    const firstDay = window.__transportPerTeamBuffer?.firstTournamentDayKey;
    const arrivalTs = window.__transportPerTeamBuffer?.arrivalTimestamp;

    // Ak je známy prvý deň turnaja, porovnávame s ním
    if (firstDay && dk) return dk === firstDay;
  
    // Fallback: ak nie je firstDay, ale je arrivalTimestamp, berieme deň príchodu
    if (arrivalTs && dk) {
      return dk === getDayKeyFromTs(arrivalTs);
    }
    return false;
  };

  const getArrivalStartTsForDay = (dk, fallbackEndTs) => {
    const arrTs = window.__transportPerTeamBuffer?.arrivalTimestamp;
    if (!arrTs || !isFinite(arrTs) || !isFirstTournamentDay(dk)) return null;
    const arrDate = new Date(arrTs);
    const baseDate = fallbackEndTs ? new Date(fallbackEndTs) : arrDate;
    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      arrDate.getHours(),
      arrDate.getMinutes(),
      0,
      0
    ).getTime();
  };

  const buildUpdatedWalkingTransfer = (ev, startTs, endTs, dayKeyStr) => {
    const { from: walkFrom, to: walkTo } = getEventPlaces(ev);
    const startTimeStr = formatTimeOnly(startTs);
    const endTimeStr = formatTimeOnly(endTs);
    const timeRangeStr = `${startTimeStr} – ${endTimeStr}`;
    const dateStr = formatDateDDMMYYYY(startTs) || '';
    const catStr = ev.category || '-';

    const updatedLegs = (ev.legs && ev.legs.length > 0)
      ? ev.legs.map((l) => ({
          ...l,
          startTs,
          endTs,
          startTime: startTimeStr,
          endTime: endTimeStr,
          timeLabel: timeRangeStr,
          hasTimes: true,
        }))
      : [{
          fromName: walkFrom,
          toName: walkTo,
          isWalking: true,
          busName: null,
          startTs,
          endTs,
          startTime: startTimeStr,
          endTime: endTimeStr,
          timeLabel: timeRangeStr,
          hasTimes: true,
        }];

    const updatedLegLabels = updatedLegs.map(
      (l) => `🚌 PEŠI ${dateStr ? `${dateStr} ` : ''}${timeRangeStr} | ${l.fromName} → ${l.toName} | ${catStr}`
    );

    return {
      ...ev,
      ts: startTs,
      startTs,
      endTs,
      sortTs: startTs,
      dayKey: dayKeyStr || ev.dayKey || null,
      timeLabel: timeRangeStr,
      hasRealTimes: true,
      isWalking: true,
      busName: null,
      title: `${walkFrom} → ${walkTo}`,
      fromName: walkFrom,
      toName: walkTo,
      legs: updatedLegs,
      legLabels: updatedLegLabels,
      label: `🚌 PRESUN PEŠI ${dateStr ? `${dateStr} ` : ''}${timeRangeStr} | ${walkFrom} → ${walkTo} | ${catStr}`,
    };
  };

  const KIND_PRIORITY = { match: 0, transfer: 1, catering: 2 };

  const sorted = events.slice().sort((a, b) => {
    const aTs = a.ts != null && isFinite(a.ts) ? a.ts : Number.POSITIVE_INFINITY;
    const bTs = b.ts != null && isFinite(b.ts) ? b.ts : Number.POSITIVE_INFINITY;
    if (aTs !== bTs) return aTs - bTs;
    return (KIND_PRIORITY[a.kind] ?? 9) - (KIND_PRIORITY[b.kind] ?? 9);
  });

  const sampleEv = sorted[0] || {};
  const accomKey = `${cleanCategory(sampleEv.category || '')}|${String(sampleEv.teamName || '').trim()}`;
  const accommodationName = __transportPerTeamBuffer.accommodationByKey.get(accomKey) || 'bez ubytovania';
  const isWithoutAccommodation = !accommodationName || accommodationName === 'bez ubytovania';

  const usedWalkingIndexes = new Set();
  const excludedTransferIndexes = new Set();
  const assignments = new Map();

  // Pre tímy bez ubytovania: presun na miesto prvej udalosti dňa a po poslednej udalosti dňa
  if (isWithoutAccommodation) {
    const timedByDay = new Map();
    sorted.forEach((ev, idx) => {
      if (isWalkingTransferWithoutTime(ev)) return;
      const range = getEventStartEndTs(ev);
      if (!range || range.startTs == null || range.endTs == null) return;
      const dk = getEffectiveDayKey(ev) || getDayKeyFromTs(range.startTs);
      if (!dk) return;
      if (!timedByDay.has(dk)) timedByDay.set(dk, []);
      timedByDay.get(dk).push({ ev, idx, range, places: getEventPlaces(ev) });
    });

    timedByDay.forEach((dayTimed, dk) => {
      dayTimed.sort((a, b) => a.range.startTs - b.range.startTs || a.range.endTs - b.range.endTs);
      const firstItem = dayTimed[0];
      const lastItem = dayTimed[dayTimed.length - 1];

      if (firstItem) {
        const firstPlace = normPlace(firstItem.places.from || firstItem.places.to);
        const startWalkIdx = sorted.findIndex((cand, k) => {
          if (usedWalkingIndexes.has(k) || !isWalkingTransferWithoutTime(cand)) return false;
          const candDk = getEffectiveDayKey(cand);
          if (candDk && candDk !== dk) return false;
          const { from: wFrom, to: wTo } = getEventPlaces(cand);
          const nFrom = normPlace(wFrom);
          const nTo = normPlace(wTo);
          // ─── NOVÉ: ak nemení miesto, nemá zmysel ───
          if (!nFrom || !nTo || nFrom === nTo) return false;
          return Boolean(nFrom) && nTo === firstPlace;
        });

        if (startWalkIdx !== -1) {
          const endTs = firstItem.range.startTs;
          const arrivalStartTs = getArrivalStartTsForDay(dk, endTs);
          const dObj = new Date(endTs);
          const startTs = arrivalStartTs != null && arrivalStartTs < endTs
            ? arrivalStartTs
            : new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate(), 0, 0, 0, 0).getTime();
          if (endTs > startTs) {
            usedWalkingIndexes.add(startWalkIdx);
            assignments.set(startWalkIdx, { startTs, endTs, dayKey: dk });
          }
        }
      }

      if (lastItem) {
        const lastPlace = normPlace(lastItem.places.to || lastItem.places.from);
        const endWalkIdx = sorted.findIndex((cand, k) => {
          if (usedWalkingIndexes.has(k) || !isWalkingTransferWithoutTime(cand)) return false;
          const candDk = getEffectiveDayKey(cand);
          if (candDk && candDk !== dk) return false;
          const { from: wFrom, to: wTo } = getEventPlaces(cand);
          const nFrom = normPlace(wFrom);
          const nTo = normPlace(wTo);
          // ─── NOVÉ: ak nemení miesto, nemá zmysel ───
          if (!nFrom || !nTo || nFrom === nTo) return false;
          return nFrom === lastPlace && Boolean(nTo);
        });
      
        // ─── NOVÉ: end-of-day walking pridáme LEN ak nie je v ten deň už žiadna
        // neskoršia udalosť na mieste, kam by mal presun viesť (t.j. tím sa naozaj
        // niekam presúva po skončení poslednej udalosti). Ak posledná udalosť dňa
        // je zároveň poslednou udalosťou pobytu (napr. večera na ubytovaní a tím
        // nemá kam ísť), end-of-day walking je zbytočný.
        // ⬅️ ZMENA: NEKONTROLUJEME, či existuje budúca udalosť na cieľovom mieste.
        // Všetky pešie presuny bez časov dostanú časový interval, aby sa zobrazili.
        if (endWalkIdx !== -1) {
          const startTs = lastItem.range.endTs;
          const dObj = new Date(startTs);
          const endOfDayTs = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate(), 23, 59, 0, 0).getTime();
          if (endOfDayTs > startTs) {
            usedWalkingIndexes.add(endWalkIdx);
            assignments.set(endWalkIdx, { startTs, endTs: endOfDayTs, dayKey: dk });
          }
        }
      }
    });
  }

  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i];
    if (isWalkingTransferWithoutTime(first)) continue;
    const firstRange = getEventStartEndTs(first);
    if (!firstRange || firstRange.endTs == null) continue;
    const firstPlaces = getEventPlaces(first);
    const firstPlace = normPlace(firstPlaces.to || firstPlaces.from);
    if (!firstPlace) continue;

    let hasLaterEventOnSamePlace = false;
    for (let k = i + 1; k < sorted.length; k++) {
      const later = sorted[k];
      if (isWalkingTransferWithoutTime(later)) continue;
      const laterRange = getEventStartEndTs(later);
      if (!laterRange || laterRange.startTs == null) continue;
      const laterPlaces = getEventPlaces(later);
      const laterPlace = normPlace(laterPlaces.from || laterPlaces.to);
      if (laterPlace === firstPlace && laterRange.endTs > firstRange.endTs) {
        hasLaterEventOnSamePlace = true;
        break;
      }
      if (laterPlace && laterPlace !== firstPlace) break;
    }
    if (hasLaterEventOnSamePlace) continue;

    for (let j = i + 1; j < sorted.length; j++) {
      const second = sorted[j];
      if (isWalkingTransferWithoutTime(second)) continue;
      const secondRange = getEventStartEndTs(second);
      if (!secondRange || secondRange.startTs == null) continue;
      if (!(secondRange.startTs > firstRange.endTs)) continue;

      const secondPlaces = getEventPlaces(second);
      const secondFrom = normPlace(secondPlaces.from);
      const secondPlace = normPlace(secondPlaces.from || secondPlaces.to);
      if (!secondPlace || firstPlace === secondPlace) continue;

      const gapDayKey = getEffectiveDayKey(first) || getEffectiveDayKey(second) || getDayKeyFromTs(firstRange.endTs);

      const secondIsMismatchedTransfer =
        second.kind === 'transfer' && secondFrom && secondFrom !== firstPlace;

      const walkIdx = sorted.findIndex((cand, k) => {
        if (usedWalkingIndexes.has(k)) return false;
        if (!isWalkingTransferWithoutTime(cand)) return false;
        const candDayKey = getEffectiveDayKey(cand);
        // ⬅️ ZMENA: NEKONTROLUJEME deň — presun môže preklenúť polnoc
        // if (gapDayKey && candDayKey && candDayKey !== gapDayKey) return false;
        const { from: wFrom, to: wTo } = getEventPlaces(cand);
        const nFrom = normPlace(wFrom);
        const nTo = normPlace(wTo);
        if (!nFrom || !nTo || nFrom === nTo) return false;
        // ⬅️ ZMENA: NEKONTROLUJEME zhodu miesta s kotvami — stačí, že transfer existuje
        return true;
      });

      if (walkIdx !== -1) {
        usedWalkingIndexes.add(walkIdx);
        if (secondIsMismatchedTransfer) {
          excludedTransferIndexes.add(j);
        }
        assignments.set(walkIdx, {
          startTs: firstRange.endTs,
          endTs: secondRange.startTs,
          dayKey: gapDayKey,
        });
      }
      break;
    }
  }

  if (sampleEv.teamName === 'ŠŠK pri SLŠ Prešov') {
    console.log('🚫 excludedTransferIndexes:', [...excludedTransferIndexes]);
    console.log('📋 sorted (label + kind + dayKey + ts):', sorted.map((e, i) => ({
      i, kind: e.kind, dayKey: e.dayKey, ts: e.ts,
      from: e.legs?.[0]?.fromName, to: e.legs?.[e.legs.length-1]?.toName,
      label: e.label?.slice(0, 80),
    })));
  }

  return sorted
    .map((ev, origIdx) => ({ ev, origIdx }))
    .filter(({ origIdx }) => !excludedTransferIndexes.has(origIdx))
    .map(({ ev, origIdx }) => {
      const assigned = assignments.get(origIdx);
      if (!assigned) return ev;
      return buildUpdatedWalkingTransfer(ev, assigned.startTs, assigned.endTs, assigned.dayKey);
    })
    // ─── NOVÉ: zahodiť akýkoľvek transfer, ktorý nemení miesto ───
    .filter((ev) => {
      if (!ev || ev.kind !== 'transfer') return true;
      const legs = ev.legs || [];
      if (legs.length === 0) {
        const p = getEventPlaces(ev);
        return normPlace(p.from) !== normPlace(p.to) || !p.from || !p.to;
      }
      const firstFrom = normPlace(legs[0]?.fromName);
      const lastTo = normPlace(legs[legs.length - 1]?.toName);
      if (!firstFrom || !lastTo) return true;
      return firstFrom !== lastTo;
    })
    .sort((a, b) => {
      const aTs = a.ts != null && isFinite(a.ts) ? a.ts : Number.POSITIVE_INFINITY;
      const bTs = b.ts != null && isFinite(b.ts) ? b.ts : Number.POSITIVE_INFINITY;
      if (aTs !== bTs) return aTs - bTs;
      return (KIND_PRIORITY[a.kind] ?? 9) - (KIND_PRIORITY[b.kind] ?? 9);
    });
};

const tryPrintPerTeamTimeline = () => {
  if (
    !__transportPerTeamBuffer.matchesReady ||
    !__transportPerTeamBuffer.cateringReady ||
    !__transportPerTeamBuffer.transfersReady
  ) return;

  const all = [
    ...__transportPerTeamBuffer.matches,
    ...__transportPerTeamBuffer.catering,
    ...__transportPerTeamBuffer.transfers,
  ];

  // Zoskupenie podľa KATEGÓRIA + TÍM (aby sa tímy s rovnakým menom v rôznych kategóriách nemiešali)
  const byTeam = new Map();
  for (const ev of all) {
    const rawTeam = String(ev.teamName || '').trim();
    if (!rawTeam) continue;
    // ⬅️ NOVÉ: použi mapovaný názov, ak existuje (rovnako ako v MAPPED výpise)
    const team = __transportPerTeamBuffer.resolvedNames?.[rawTeam] || rawTeam;
    const cat = cleanCategory(ev.category || '');  // ⬅️ cleanCategory namiesto trim
    const key = `${cat}|${team}`;
    if (!byTeam.has(key)) byTeam.set(key, []);
    byTeam.get(key).push(ev);
  }

  // Zoradenie tímov: najprv podľa kategórie, potom podľa názvu tímu
  const teamsSorted = [...byTeam.keys()].sort((a, b) => {
    const [catA, teamA] = a.split('|');
    const [catB, teamB] = b.split('|');
    const c = String(catA).localeCompare(String(catB), 'sk', { sensitivity: 'base' });
    if (c !== 0) return c;
    return String(teamA).localeCompare(String(teamB), 'sk', { sensitivity: 'base' });
  });

  // Zoradenie udalostí v rámci tímu chronologicky
  const output = {};
  
  console.log('🔍 Všetky transfery v buffery pre tím ŠŠK:', 
    __transportPerTeamBuffer.transfers.filter(t => 
      String(t.teamName||'').includes('ŠŠK') || String(t.teamName||'').includes('Prešov')
    ).map(t => ({
      key: t.key, teamName: t.teamName, category: t.category, 
      dayKey: t.dayKey, ts: t.ts, 
      from: t.legs?.[0]?.fromName, to: t.legs?.[t.legs.length-1]?.toName
    }))
  );

  console.log('🔍 byTeam keys obsahujúce ŠŠK:', 
    [...byTeam.keys()].filter(k => k.includes('ŠŠK') || k.includes('Prešov'))
  );
  
  for (const key of teamsSorted) {
    const [cat, team] = key.split('|');
    const KIND_PRIORITY = { match: 0, transfer: 1, catering: 2 };

    const list = byTeam.get(key).slice().sort((a, b) => {
      if (a.ts !== b.ts) return a.ts - b.ts;
      // pri rovnakom čase: zápas → transfer → stravovanie
      const aP = KIND_PRIORITY[a.kind] ?? 9;
      const bP = KIND_PRIORITY[b.kind] ?? 9;
      if (aP !== bP) return aP - bP;
      return String(a.sortKey || '').localeCompare(String(b.sortKey || ''), 'sk');
    });

    const enrichTransfersWithImpliedWalking = (events) => {
      if (!Array.isArray(events) || events.length < 2) return events;
    
      // Pomocná funkcia: vytiahne miesto z eventu (match/catering/transfer)
      const getEventPlace = (ev) => {
        if (!ev) return null;
        if (ev.kind === 'match') {
          const parts = String(ev.label || '').split('|').map((s) => s.trim());
          return parts[1] || null;
        }
        if (ev.kind === 'catering') {
          const parts = String(ev.label || '').split('|').map((s) => s.trim());
          return parts[2] || null;
        }
        if (ev.kind === 'transfer') {
          const legs = ev.legs || [];
          if (legs.length === 0) return null;
          return legs[legs.length - 1].toName || null;
        }
        return null;
      };
    
      const getTransferFrom = (ev) => {
        const legs = ev?.legs || [];
        if (legs.length === 0) return null;
        return legs[0].fromName || null;
      };
    
      const norm = (s) => normalizePlaceName(String(s || ''));
    
      const transferHasTimes = (transferEv) => {
        const legs = transferEv?.legs || [];
        if (legs.length > 0) {
          if (legs.some((l) => l.startTs != null && l.endTs != null)) return true;
        }
        if (transferEv?.ts != null && isFinite(transferEv.ts)) return true;
        if (transferEv?.endTs != null && isFinite(transferEv.endTs)) return true;
        return false;
      };
    
      const getTransferTimeRange = (transferEv) => {
        const legs = transferEv?.legs || [];
        let startTs = null;
        let endTs = null;
        for (const leg of legs) {
          if (leg.startTs != null && isFinite(leg.startTs)) {
            startTs = startTs == null ? leg.startTs : Math.min(startTs, leg.startTs);
          }
          if (leg.endTs != null && isFinite(leg.endTs)) {
            endTs = endTs == null ? leg.endTs : Math.max(endTs, leg.endTs);
          }
        }
        if (startTs == null && transferEv?.ts != null && isFinite(transferEv.ts)) {
          startTs = transferEv.ts;
        }
        if (endTs == null && transferEv?.endTs != null && isFinite(transferEv.endTs)) {
          endTs = transferEv.endTs;
        }
        if (startTs == null && transferEv?.when) {
          const r = parseWhenRangeToTs(transferEv.when);
          if (r) {
            startTs = r.startTs;
            if (endTs == null) endTs = r.endTs;
          }
        }
        if (endTs == null) endTs = startTs;
        return { startTs, endTs };
      };
    
      const getEventTimeRange = (ev) => {
        if (!ev || ev.ts == null || !isFinite(ev.ts)) return null;
        let startTs = ev.ts;
        let endTs = ev.ts;
    
        if (ev.endTs != null && isFinite(ev.endTs) && ev.endTs > startTs) {
          endTs = ev.endTs;
        }
    
        if (ev.kind === 'catering') {
          const m = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(String(ev.label || ''));
          if (m) {
            const d = new Date(startTs);
            startTs = new Date(
              d.getFullYear(), d.getMonth(), d.getDate(),
              Number(m[1]), Number(m[2]), 0, 0
            ).getTime();
            endTs = new Date(
              d.getFullYear(), d.getMonth(), d.getDate(),
              Number(m[3]), Number(m[4]), 0, 0
            ).getTime();
          }
        }
        return { startTs, endTs };
      };
    
      const KIND_PRIORITY = { match: 0, transfer: 1, catering: 2 };
    
      const sorted = events.slice().sort((a, b) => {
        const aTs = a.ts != null && isFinite(a.ts) ? a.ts : Number.POSITIVE_INFINITY;
        const bTs = b.ts != null && isFinite(b.ts) ? b.ts : Number.POSITIVE_INFINITY;
        if (aTs !== bTs) return aTs - bTs;
        const aP = KIND_PRIORITY[a.kind] ?? 9;
        const bP = KIND_PRIORITY[b.kind] ?? 9;
        if (aP !== bP) return aP - bP;
        return String(a.sortKey || '').localeCompare(String(b.sortKey || ''), 'sk');
      });
    
      // ─── KROK 1: Rozdeľ eventy na "kotvy" (match/catering) a transfery ───
      const anchors = sorted.filter((ev) => ev.kind === 'match' || ev.kind === 'catering');
      const transfers = sorted.filter((ev) => ev.kind === 'transfer');
    
      // ─── KROK 2: Pre každú medzeru medzi susednými kotvami nájdi vhodný transfer ───
      const usedTransfers = new Set();
      const gapAssignments = new Map(); // index kotvy (prev) -> transfer event
    
      const transferMatchesPlaces = (t, fromPlace, toPlace) => {
        const legs = t?.legs || [];
        if (legs.length === 0) return false;
        const firstFrom = norm(legs[0].fromName);
        const lastTo = norm(legs[legs.length - 1].toName);
        const nFrom = norm(fromPlace);
        const nTo = norm(toPlace);
        if (!nFrom || !nTo) return false;
        return firstFrom === nFrom && lastTo === nTo;
      };
    
      const transferFitsGap = (t, gapStart, gapEnd) => {
        const { startTs, endTs } = getTransferTimeRange(t);
        if (startTs == null || endTs == null) return true;
        const TOL = 5 * 60 * 1000;
        if (gapStart != null && startTs < gapStart - TOL) return false;
        if (gapEnd != null && endTs > gapEnd + TOL) return false;
        return true;
      };
    
      for (let i = 0; i < anchors.length - 1; i++) {
        const prev = anchors[i];
        const next = anchors[i + 1];
        const prevPlace = getEventPlace(prev);
        const nextPlace = getEventPlace(next);
        if (!prevPlace || !nextPlace) continue;
        if (norm(prevPlace) === norm(nextPlace)) continue;
    
        const prevRange = getEventTimeRange(prev);
        const nextRange = getEventTimeRange(next);
        if (!prevRange || !nextRange) continue;
    
        let bestTransfer = null;
        let bestScore = -Infinity;
        for (const t of transfers) {
          if (usedTransfers.has(t)) continue;
          if (!transferMatchesPlaces(t, prevPlace, nextPlace)) continue;
          if (!transferFitsGap(t, prevRange.endTs, nextRange.startTs)) continue;
          const hasTimes = transferHasTimes(t);
          const score = hasTimes ? 10 : 5;
          if (score > bestScore) {
            bestScore = score;
            bestTransfer = t;
          }
        }
    
        if (bestTransfer) {
          usedTransfers.add(bestTransfer);
          gapAssignments.set(i, bestTransfer);
        }
      }
    
      // ─── KROK 3: Zostav výsledok – kotvy + priradené reálne transfery ───
      // (žiadne syntetické pešie presuny)
      const result = [];
    
      for (let i = 0; i < anchors.length; i++) {
        const ev = anchors[i];
        result.push(ev);
    
        if (i === anchors.length - 1) continue;
    
        const next = anchors[i + 1];
        const prevPlace = getEventPlace(ev);
        const nextPlace = getEventPlace(next);
        if (!prevPlace || !nextPlace) continue;
        if (norm(prevPlace) === norm(nextPlace)) continue;
    
        const assignedTransfer = gapAssignments.get(i);
        if (assignedTransfer) {
          // Použijeme existujúci transfer; ak nemá časy, doplníme mu ich
          if (!transferHasTimes(assignedTransfer)) {
            const prevRange = getEventTimeRange(ev);
            const nextRange = getEventTimeRange(next);
            if (prevRange && nextRange) {
              const startTs = prevRange.endTs;
              const endTs = nextRange.startTs;
              if (endTs > startTs) {
                const patchedLegs = (assignedTransfer.legs || []).map((l, li) => {
                  const isFirst = li === 0;
                  const isLast = li === (assignedTransfer.legs || []).length - 1;
                  return {
                    ...l,
                    startTs: l.startTs != null ? l.startTs : (isFirst ? startTs : null),
                    endTs: l.endTs != null ? l.endTs : (isLast ? endTs : null),
                  };
                });
                const patchedLegLabels = patchedLegs.map((l) => {
                  const legTimeLabel = (l.startTs != null && l.endTs != null)
                    ? `${formatTimeOnly(l.startTs)} – ${formatTimeOnly(l.endTs)}`
                    : (l.isWalking ? 'PEŠI' : 'nepriradený');
                  const legTypeLabel = l.isWalking ? 'PEŠI' : (l.busName || 'PRESUN');
                  const dateLabel = formatDateDDMMYYYY(l.startTs) || '';
                  return `🚌 ${legTypeLabel} ${dateLabel ? dateLabel + ' ' : ''}${legTimeLabel} | ${l.fromName} → ${l.toName} | ${ev.category || '-'}`;
                });
                result.push({
                  ...assignedTransfer,
                  ts: startTs,
                  legs: patchedLegs,
                  legLabels: patchedLegLabels,
                });
                continue;
              }
            }
            // Ak sa nedá doplniť čas, transfer preskočíme (žiadny syntetický presun)
          } else {
            result.push(assignedTransfer);
            continue;
          }
        }
        // Žiadny vhodný transfer → nič nevkladáme (žiadny syntetický presun)
      }
    
      // ─── KROK 4: Pridaj zostávajúce nepoužité transfery ───
      const lastAnchor = anchors[anchors.length - 1];
      const lastAnchorRange = lastAnchor ? getEventTimeRange(lastAnchor) : null;
      const lastAnchorPlace = lastAnchor ? getEventPlace(lastAnchor) : null;

      // ─── Ubytovanie pre daný tím – skúsime VIACERO kľúčov ───
      const teamCategory = String(events[0]?.category || '').trim();
      const teamName = String(events[0]?.teamName || '').trim();

      // 1) namapovaný názov tímu
      const accomKeyForTeam = `${cleanCategory(teamCategory)}|${teamName}`;
      let teamAccommodation =
        __transportPerTeamBuffer.accommodationByKey.get(accomKeyForTeam) || '';

      // 2) fallback: surové názvy z transferov (tie sú v accommodationByKey pod surovým kľúčom)
      if (!teamAccommodation) {
        for (const t of transfers) {
          const rawName = String(t.teamName || '').trim();
          if (!rawName) continue;
          const rawKey = `${cleanCategory(t.category || teamCategory)}|${rawName}`;
          const accom = __transportPerTeamBuffer.accommodationByKey.get(rawKey);
          if (accom && accom !== 'bez ubytovania') {
            teamAccommodation = accom;
            break;
          }
        }
      }

      for (const t of transfers) {
        if (usedTransfers.has(t)) continue;

        // DOPLNIŤ ČASY Z `when`, ak transfer nemá žiadne časy
        if (!transferHasTimes(t)) {
          const r = t.when ? parseWhenRangeToTs(t.when) : null;
          if (!r) continue;

          const tLegs = t.legs || [];
          if (tLegs.length > 0) {
            if (tLegs[0].startTs == null) tLegs[0].startTs = r.startTs;
            if (tLegs[tLegs.length - 1].endTs == null) tLegs[tLegs.length - 1].endTs = r.endTs;
          } else {
            const fromN = t.fromLocation || t.fromName || null;
            const toN = t.toLocation || t.toName || null;
            if (!fromN || !toN) continue;
            t.legs = [{
              fromName: fromN,
              toName: toN,
              isWalking: t.isWalking === true,
              busName: t.text || null,
              startTs: r.startTs,
              endTs: r.endTs,
            }];
          }
          if (t.ts == null) t.ts = r.startTs;
          if (t.endTs == null) t.endTs = r.endTs;

          t.legLabels = (t.legs || []).map((l) => {
            const timeLabel =
              l.startTs != null && l.endTs != null
                ? `${formatTimeOnly(l.startTs)} – ${formatTimeOnly(l.endTs)}`
                : l.isWalking
                  ? 'PEŠI'
                  : 'nepriradený';
            const dateLabel = formatDateDDMMYYYY(l.startTs) || '';
            const legTypeLabel = l.isWalking ? 'PEŠI' : (l.busName || 'PRESUN');
            return `🚌 ${legTypeLabel} ${dateLabel ? dateLabel + ' ' : ''}${timeLabel} | ${l.fromName} → ${l.toName} | ${t.category || '-'}`;
          });
        }

        const { startTs, endTs } = getTransferTimeRange(t);
        if (startTs == null) continue;

        const tFromPlace = getTransferFrom(t);
        const tToPlace = getEventPlace(t);
        const nFrom = norm(tFromPlace);
        const nTo = norm(tToPlace);

        if (!nFrom || !nTo || nFrom === nTo) continue;

        // Nájdi najbližšiu kotvu pred a po transfere
        let prevAnchor = null;
        let nextAnchor = null;
        for (const a of anchors) {
          const aRange = getEventTimeRange(a);
          if (!aRange) continue;
          if (aRange.endTs != null && aRange.endTs <= startTs) {
            if (!prevAnchor || aRange.endTs > (getEventTimeRange(prevAnchor)?.endTs ?? -Infinity)) {
              prevAnchor = a;
            }
          }
          if (aRange.startTs != null && aRange.startTs >= endTs) {
            if (!nextAnchor || aRange.startTs < (getEventTimeRange(nextAnchor)?.startTs ?? Infinity)) {
              nextAnchor = a;
            }
          }
        }
        const prevPlace = prevAnchor ? norm(getEventPlace(prevAnchor)) : null;
        const nextPlace = nextAnchor ? norm(getEventPlace(nextAnchor)) : null;

        // Zbytočný presun z A do A
        if (prevPlace && nextPlace && prevPlace === nextPlace && nFrom === prevPlace && nTo === prevPlace) {
          continue;
        }

        // Ubytovanie tímu – prijmeme transfer, ak ide na/ubytovania tímu
        const isAccommodationTransfer =
          teamAccommodation &&
          teamAccommodation !== 'bez ubytovania' &&
          (norm(teamAccommodation) === nTo || norm(teamAccommodation) === nFrom);

        if (
          prevPlace && nextPlace &&
          nFrom !== prevPlace && nTo !== nextPlace &&
          !isAccommodationTransfer
        ) {
          continue;
        }

        // Transfer po poslednej kotve, ktorý končí tam, kde už tím bol → zbytočný
        if (lastAnchorRange && lastAnchorRange.endTs != null && startTs >= lastAnchorRange.endTs) {
          const lastAnchorNorm = norm(lastAnchorPlace);
          if (lastAnchorNorm && nTo === lastAnchorNorm && nFrom === lastAnchorNorm) {
            continue;
          }
        }

        result.push(t);
        usedTransfers.add(t);
      }
      
      // ─── KROK 5: Záverečné zoradenie ───
      return result.sort((a, b) => {
        const aTs = a.ts != null && isFinite(a.ts) ? a.ts : Number.POSITIVE_INFINITY;
        const bTs = b.ts != null && isFinite(b.ts) ? b.ts : Number.POSITIVE_INFINITY;
        if (aTs !== bTs) return aTs - bTs;
        return (KIND_PRIORITY[a.kind] ?? 9) - (KIND_PRIORITY[b.kind] ?? 9);
      });
    };

    if (team === 'ŠŠK pri SLŠ Prešov' && cat === 'U12 D') {
      console.log('🔍 DEBUG list (pred applyImpliedWalking):', list.map(e => ({
        kind: e.kind,
        ts: e.ts,
        dayKey: e.dayKey,
        teamName: e.teamName,
        category: e.category,
        from: e.legs?.[0]?.fromName,
        to: e.legs?.[e.legs.length-1]?.toName,
        hasRealTimes: (Array.isArray(e.legs) && e.legs.some(l => l.startTs != null && l.endTs != null)) || (e.ts != null && isFinite(e.ts)),
      })));
    }
    
    // ⬅️ ZMENA: reálne transfery z DB necháme tak ako sú (majú časy aj miesta),
    // applyImpliedWalkingTimesFromEvents aplikujeme len na tie, ktoré naozaj nemajú časy.
    const listWithRealTransfers = list.map((ev) => {
      if (ev.kind !== 'transfer') return ev;
      const hasRealTimes =
        (Array.isArray(ev.legs) && ev.legs.some((l) => l.startTs != null && l.endTs != null)) ||
        (ev.ts != null && isFinite(ev.ts));
      if (!hasRealTimes) return ev; // necháme applyImpliedWalkingTimesFromEvents doplniť
      return ev;
    });

    // ⬅️ ZMENA: enrichTransfersWithImpliedWalking už NEVOLÁME — spôsoboval,
    // že sa reálne transfery zahadzovali podľa zhody miesta medzi kotvami.
    // Namiesto toho všetky reálne transfery pridáme priamo do zoznamu
    // a applyImpliedWalkingTimesFromEvents sa postará len o pešie presuny bez časov.
    const enrichedList = applyImpliedWalkingTimesFromEvents(listWithRealTransfers);
    // ─── koniec doplnenia ───
    
    // kľúč výstupu = "TÍM (KATEGÓRIA)"
    const displayKey = cat ? `${team} (${cat})` : team;

    if (team === 'ŠŠK pri SLŠ Prešov' && cat === 'U12 D') {
      console.log('🔍 enrichedList pre tím:', enrichedList.map(e => ({
        kind: e.kind,
        ts: e.ts,
        dayKey: e.dayKey,
        label: e.label,
        legs: (e.legs||[]).map(l => ({from: l.fromName, to: l.toName, isWalking: l.isWalking, startTs: l.startTs, endTs: l.endTs})),
      })));
    }

    // Pre každú udalosť: ak má legLabels (transfer), rozbalíme na samostatné riadky.
    // ─── NOVÉ: pre transfery doplníme do riadku aj dátum, ak tam ešte nie je ───
    const rows = [];
    for (const ev of enrichedList) {
      if (ev.kind === 'transfer' && Array.isArray(ev.legLabels) && ev.legLabels.length > 0) {
        // Zistíme dátum transferu: primárne z ev.dayKey, inak z ev.ts
        let transferDayLabel = '';
        if (ev.dayKey) {
          const parts = String(ev.dayKey).split('-');
          if (parts.length === 3) {
            transferDayLabel = `${parts[2]}. ${parts[1]}. ${parts[0]}`;
          }
        }
        if (!transferDayLabel && ev.ts != null && isFinite(ev.ts)) {
          transferDayLabel = formatDateDDMMYYYY(ev.ts) || '';
        }
        // ─── NOVÉ: fallback z legs (každý leg má startTs/endTs, ak má reálne časy) ───
        if (!transferDayLabel && Array.isArray(ev.legs)) {
          for (const leg of ev.legs) {
            if (leg.startTs != null && isFinite(leg.startTs)) {
              transferDayLabel = formatDateDDMMYYYY(leg.startTs) || '';
              if (transferDayLabel) break;
            }
            if (leg.endTs != null && isFinite(leg.endTs)) {
              transferDayLabel = formatDateDDMMYYYY(leg.endTs) || '';
              if (transferDayLabel) break;
            }
          }
        }

        for (const legLine of ev.legLabels) {
          // Ak legLine už obsahuje dátum (napr. "🚌 Bus 2 25. 12. 2026 11:15 – 11:30 | ..."),
          // nepridávame ho znova.
          const hasDateInLine = /\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/.test(String(legLine));
          if (hasDateInLine || !transferDayLabel) {
            rows.push(legLine);
          } else {
            // Vložíme dátum za ikonu/typ (za prvú medzeru po "🚌")
            // Formát: "🚌 <TYP> | <dátum> <zvyšok>"
            // Alebo jednoduchšie: prefix pred celý riadok
            rows.push(`📅 ${transferDayLabel} | ${legLine}`);
          }
        }
      } else {
        // ─── NOVÉ: pre eventy bez legLabels (napr. peší presun bez časov)
        let evDayLabel = '';
        if (ev.dayKey) {
          const parts = String(ev.dayKey).split('-');
          if (parts.length === 3) {
            evDayLabel = `${parts[2]}. ${parts[1]}. ${parts[0]}`;
          }
        }
        if (!evDayLabel && ev.ts != null && isFinite(ev.ts)) {
          evDayLabel = formatDateDDMMYYYY(ev.ts) || '';
        }
        // ─── NOVÉ: fallback z legs ───
        if (!evDayLabel && Array.isArray(ev.legs)) {
          for (const leg of ev.legs) {
            if (leg.startTs != null && isFinite(leg.startTs)) {
              evDayLabel = formatDateDDMMYYYY(leg.startTs) || '';
              if (evDayLabel) break;
            }
            if (leg.endTs != null && isFinite(leg.endTs)) {
              evDayLabel = formatDateDDMMYYYY(leg.endTs) || '';
              if (evDayLabel) break;
            }
          }
        }
        const hasDateInLabel = /\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/.test(String(ev.label || ''));
        if (evDayLabel && !hasDateInLabel) {
          rows.push(`📅 ${evDayLabel} | ${ev.label}`);
        } else {
          rows.push(ev.label);
        }
      }
    }
    
    // ─── Oddeľovacia čiara medzi rôznymi dňami v chronologickom výpise tímu ───
    const extractRowDayKey = (rowStr) => {
      const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(String(rowStr || ''));
      if (!m) return '';
      return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    };

    const separatedRows = [];
    let prevRowDayKey = '';
    for (const row of rows) {
      const rowDayKey = extractRowDayKey(row);
      if (prevRowDayKey && rowDayKey && rowDayKey !== prevRowDayKey) {
        separatedRows.push('────────────────────────────────────────────────────────────');
      }
      if (rowDayKey) {
        prevRowDayKey = rowDayKey;
      }
      separatedRows.push(row);
    }

    output[displayKey] = separatedRows;
  }

  const sig = JSON.stringify(output);
  if (sig === __transportPerTeamBuffer.lastPrintedSignature) return;
  __transportPerTeamBuffer.lastPrintedSignature = sig;

  console.log('📅 TRANSPORT.JS – CHRONOLOGICKÝ PREHĽAD UDALOSTÍ PRE KAŽDÝ TÍM (zápasy + stravovanie + ubytovanie):');
  Object.entries(output).forEach(([displayKey, items]) => {
    // Zistíme kategóriu + názov tímu z displayKey ("TÍM (KATEGÓRIA)" alebo len "TÍM")
    let teamName = displayKey;
    let category = '';
    const m = /^(.*)\s+\(([^()]+)\)$/.exec(displayKey);
    if (m) {
      teamName = m[1].trim();
      category = m[2].trim();
    }
    const accomKey = `${category}|${teamName}`;
    const accommodationName = __transportPerTeamBuffer.accommodationByKey.get(accomKey) || 'bez ubytovania';

    console.groupCollapsed(`👥 ${displayKey} (${items.length}) – 🏠 ${accommodationName}`);
    items.forEach((line, i) => console.log(`${i + 1}. ${line}`));
    console.groupEnd();
  });

  /* ------------------------------------------------------------------ */
  /* NOVÉ: Výpis VŠETKÝCH presunov (transferov) pre každý tím v kategórii */
  /* – aj bez mapovania názvu tímu, aj s mapovaním názvu tímu            */
  /* ------------------------------------------------------------------ */
  const allTransfers = __transportPerTeamBuffer.transfers || [];

  // Pomocná: vytiahne "surový" identifikátor tímu z transferu (bez mapovania)
  const getRawTransferTeamKey = (t) => {
    const teamName = String(t.teamName || '').trim();
    const cat = String(t.category || '').trim();
    const uid = t.teamUid != null ? String(t.teamUid) : '';
    const idx = t.teamIndex != null ? String(t.teamIndex) : '';
    // Preferujeme teamUid|teamIndex|cat, ak sú dostupné; inak teamName|cat
    if (uid || idx) return `${cat}|${uid}|${idx}|${teamName}`;
    return `${cat}|${teamName}`;
  };

  // Pomocná: vytiahne "mapovaný" identifikátor tímu z transferu (cez resolveTeamNameForDisplay)
  const resolveMappedTeamKey = async (t) => {
    const rawName = String(t.teamName || '').trim();
    const cat = String(t.category || '').trim();
    if (!rawName) return `${cat}|`;
    try {
      const mapped = await resolveTeamNameForDisplay(rawName, cat);
      const mappedStr = String(mapped || '').trim();
      if (mappedStr && mappedStr !== 'null') return `${cat}|${mappedStr}`;
    } catch (e) {}
    return `${cat}|${rawName}`;
  };

  // Zoskupenie transferov podľa surového kľúča (bez mapovania)
  const transfersByRawKey = new Map();
  // Zoskupenie transferov podľa mapovaného kľúča (s mapovaním)
  const transfersByMappedKey = new Map();

  (async () => {
    // Pre mapovaný výpis potrebujeme async resolve
    for (const t of allTransfers) {
      const rawKey = getRawTransferTeamKey(t);
      if (!transfersByRawKey.has(rawKey)) transfersByRawKey.set(rawKey, []);
      transfersByRawKey.get(rawKey).push(t);

      const mappedKey = await resolveMappedTeamKey(t);
      if (!transfersByMappedKey.has(mappedKey)) transfersByMappedKey.set(mappedKey, []);
      transfersByMappedKey.get(mappedKey).push(t);
    }

    const sortTransfers = (arr) => arr.slice().sort((a, b) => {
      const aTs = a.ts != null && isFinite(a.ts) ? a.ts : Number.POSITIVE_INFINITY;
      const bTs = b.ts != null && isFinite(b.ts) ? b.ts : Number.POSITIVE_INFINITY;
      if (aTs !== bTs) return aTs - bTs;
      return String(a.sortKey || '').localeCompare(String(b.sortKey || ''), 'sk');
    });

    const formatTransferLine = (t) => {
      // Preferujeme legLabels (rozbalené na riadky), inak label
      if (Array.isArray(t.legLabels) && t.legLabels.length > 0) {
        return t.legLabels.join('\n      ');
      }
      return t.label || '(bez popisu)';
    };

    console.log('══════════════════════════════════════════════════════════════');
    console.log('🚌 TRANSPORT.JS – VÝPIS VŠETKÝCH PRESUNOV PRE KAŽDÝ TÍM V KATEGÓRII');
    console.log('   (bez mapovania názvu tímu)');
    console.log('══════════════════════════════════════════════════════════════');

    const rawKeysSorted = [...transfersByRawKey.keys()].sort((a, b) => {
      return String(a).localeCompare(String(b), 'sk', { sensitivity: 'base' });
    });

    for (const rawKey of rawKeysSorted) {
      const list = sortTransfers(transfersByRawKey.get(rawKey));
      if (list.length === 0) continue;

      // Rozparsujeme rawKey na kategóriu + tím (pre label)
      const parts = rawKey.split('|');
      const cat = parts[0] || '';
      const uid = parts[1] || '';
      const idx = parts[2] || '';
      const teamName = parts.slice(3).join('|') || '';

      const rawLabel = [
        teamName ? `tím="${teamName}"` : 'tím=?',
        cat ? `kategória="${cat}"` : 'kategória=?',
        uid ? `uid=${uid}` : null,
        idx ? `index=${idx}` : null,
      ].filter(Boolean).join(' ');

      console.groupCollapsed(`🚌 [RAW] ${rawLabel} — ${list.length} presunov`);
      list.forEach((t, i) => {
        const line = formatTransferLine(t);
        console.log(`${i + 1}. ${line}`);
      });
      console.groupEnd();
    }

    console.log('══════════════════════════════════════════════════════════════');
    console.log('🚌 TRANSPORT.JS – VÝPIS VŠETKÝCH PRESUNOV PRE KAŽDÝ TÍM V KATEGÓRII');
    console.log('   (s mapovaním názvu tímu)');
    console.log('══════════════════════════════════════════════════════════════');

    const mappedKeysSorted = [...transfersByMappedKey.keys()].sort((a, b) => {
      return String(a).localeCompare(String(b), 'sk', { sensitivity: 'base' });
    });

    for (const mappedKey of mappedKeysSorted) {
      const list = sortTransfers(transfersByMappedKey.get(mappedKey));
      if (list.length === 0) continue;

      const parts = mappedKey.split('|');
      const cat = parts[0] || '';
      const mappedTeam = parts.slice(1).join('|') || '';

      const mappedLabel = [
        mappedTeam ? `tím="${mappedTeam}"` : 'tím=?',
        cat ? `kategória="${cat}"` : 'kategória=?',
      ].filter(Boolean).join(' ');

      // Zistíme ubytovanie pre mapovaný tím (ak existuje)
      const accomKey = `${cat}|${mappedTeam}`;
      const accomName = __transportPerTeamBuffer.accommodationByKey.get(accomKey) || 'bez ubytovania';

      console.groupCollapsed(`🚌 [MAPPED] ${mappedLabel} — ${list.length} presunov – 🏠 ${accomName}`);
      list.forEach((t, i) => {
        const line = formatTransferLine(t);
        console.log(`${i + 1}. ${line}`);
      });
      console.groupEnd();
    }
  })().catch((e) => {
    console.error('transport.js: výpis presunov pre tím zlyhal', e);
  });
};

/* ------------------------------------------------------------------ */
/* Okamžitý záchyt udalostí mapovania (aj pred mountom komponenty)    */
/* ------------------------------------------------------------------ */

const MAPPING_READY_EVENTS = [
  'teamNameMappingReady',
  'teamNamesReplaced',
  'mappingReady',
];

if (!window.__transportEarlyMappingHookInstalled) {
  window.__transportEarlyMappingHookInstalled = true;
  window.__transportMappingSeen = Boolean(window.__transportMappingSeen);

  MAPPING_READY_EVENTS.forEach((evName) => {
    window.addEventListener(evName, (event) => {
      const detail = event?.detail;
      if (detail && detail.ready === false) return;
      window.__transportMappingSeen = true;
      window.dispatchEvent(new CustomEvent('transport:mappingReadyInternal', { detail }));
    });
  });
}

/* ------------------------------------------------------------------ */
/* Pomocné funkcie                                                     */
/* ------------------------------------------------------------------ */

window.showGlobalNotification = (message, type = 'success') => {
  let el = document.getElementById('global-notification');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-notification';
    el.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
    document.body.appendChild(el);
  }
  const base = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
  const map = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white',
  };
  el.className = `${base} ${map[type] || 'bg-gray-700 text-white'} opacity-0 scale-95`;
  el.textContent = message;
  setTimeout(() => { el.className = `${base} ${map[type] || 'bg-gray-700 text-white'} opacity-100 scale-100`; }, 10);
  setTimeout(() => { el.className = `${base} ${map[type] || 'bg-gray-700 text-white'} opacity-0 scale-95`; }, 5000);
};

const formatDateDDMMYYYY = (ts) => {
  if (!ts) return null;
  let d;
  if (typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  else d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${d.getFullYear()}`;
};

const formatDateTime = (ts) => {
  if (!ts) return null;
  let d;
  if (typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  else d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatTsLocal = (ts) => {
  if (ts == null || !isFinite(ts)) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatTimeOnly = (ts) => {
  if (ts == null || !isFinite(ts)) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const cleanCategory = (cat) => String(cat || '')
  .replace(/\u00A0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizePlaceName = (name) => {
  if (!name) return '';
  return String(name).trim()
    .replace(/^zastávka\s+/i, '')
    .replace(/^zastavka\s+/i, '')
    .replace(/^ubytovanie\s+/i, '')
    .replace(/^ubytovňa\s+/i, '')
    .replace(/^ubytovna\s+/i, '')
    .replace(/^miesto\s+zrazu\s+/i, '')
    .replace(/^miesta\s+zrazu\s+/i, '')
    .trim();
};

const parseWhenRangeToTs = (when) => {
  if (!when) return null;
  const s = String(when);
  const regex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
  const found = [];
  let m;
  while ((m = regex.exec(s)) !== null) {
    const ts = new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      m[4] != null ? Number(m[4]) : 0,
      m[5] != null ? Number(m[5]) : 0,
      0, 0
    ).getTime();
    if (isFinite(ts)) found.push(ts);
  }
  if (!found.length) return null;
  return { startTs: found[0], endTs: found.length > 1 ? found[1] : found[0] };
};

const getGroupCharFromTeamName = (teamName) => {
  if (!teamName) return null;
  const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
  return m ? m[1].toUpperCase() : null;
};

const buildRowId = (busId, dayKey, order) => `${busId}__${dayKey}__${order}`;

const computeMatchDurationMs = (cat) => {
  if (!cat) return null;
  const periods = Number(cat.periods ?? 2);
  const periodDuration = Number(cat.periodDuration ?? 20);
  const breakDuration = Number(cat.breakDuration ?? 2);
  const matchBreak = Number(cat.matchBreak ?? 5);

  const playingTime = periods * periodDuration;
  const breaksBetweenPeriods = (periods - 1) * breakDuration;
  const totalMinutes = playingTime + breaksBetweenPeriods + matchBreak;

  if (!isFinite(totalMinutes) || totalMinutes <= 0) return null;
  return totalMinutes * 60 * 1000;
};

/* ------------------------------------------------------------------ */
/* Resolve názvu tímu cez teamManager + matchTracker                   */
/* ------------------------------------------------------------------ */

const isLetterDigitCode = (s) => /^[A-ZÁ-Ž]\d+$/.test(String(s || '').trim());
const isDigitLetterCode = (s) => /^\d+[A-ZÁ-Ž]$/.test(String(s || '').trim());

const detectGroupCodeType = (teamName, categoryName) => {
  if (!teamName || !categoryName) return null;
  const tn = String(teamName).trim();
  const cat = String(categoryName).trim();
  if (!cat || !tn.includes(cat)) return null;

  const withoutCategory = tn.split(cat).join('').replace(/\s+/g, '').trim();
  if (!withoutCategory) return null;

  if (isLetterDigitCode(withoutCategory)) return 'letter-digit';
  if (isDigitLetterCode(withoutCategory)) return 'digit-letter';
  return null;
};

const resolveTeamNameForDisplay = async (identifier, categoryName) => {
  if (!identifier) return identifier;

  const original = String(identifier).trim();
  const cat = categoryName ? String(categoryName).trim() : '';

  // 1) teamManager sync
  let intermediate = original;
  try {
    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
      const syncRes = window.teamManager.getTeamNameByDisplayIdSync(original);
      if (syncRes && String(syncRes).trim() !== '' && String(syncRes).trim() !== 'null') {
        intermediate = String(syncRes).trim();
      }
    }
  } catch (e) {}

  // 2) VŽDY skús matchTracker (nielen keď shouldCallMatchTracker)
  try {
    if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
      const asyncRes = await window.matchTracker.getTeamNameByDisplayId(intermediate);
      if (
        asyncRes &&
        String(asyncRes).trim() !== '' &&
        String(asyncRes).trim() !== 'null' &&
        String(asyncRes).trim() !== intermediate
      ) {
        return String(asyncRes).trim();
      }
    }
  } catch (e) {}

  // 3) fallback na intermediate
  return intermediate;
};

/* ------------------------------------------------------------------ */
/* Čakanie na pripravenosť mapovania – s podporou skorých udalostí   */
/* ------------------------------------------------------------------ */

const isMappingReady = () => {
  if (window.__transportMappingSeen === true) return true;
  if (window.mappingReady === true) return true;
  if (window.isMappingReady === true) return true;
  if (window.teamNameMappingReady === true) return true;
  if (window.mappingCompleted === true) return true;
  if (window.teamManagerReady === true) return true;

  try {
    if (window.teamNameReplacer && typeof window.teamNameReplacer.isMappingReady === 'function') {
      if (window.teamNameReplacer.isMappingReady() === true) return true;
    }
  } catch (e) {}

  try {
    if (window.teamNameReplacer && typeof window.teamNameReplacer.hasReplacedAnyTeams === 'function') {
      if (window.teamNameReplacer.hasReplacedAnyTeams() === true) return true;
    }
  } catch (e) {}

  try {
    if (window.__teamNameMapping && Object.keys(window.__teamNameMapping).length > 0) {
      return true;
    }
  } catch (e) {}

  try {
    if (window.matchTracker && typeof window.matchTracker.isDataReady === 'function') {
      if (window.matchTracker.isDataReady() === true) return true;
    }
  } catch (e) {}

  try {
    if (window.teamManager && typeof window.teamManager.isReady === 'function') {
      if (window.teamManager.isReady()) return true;
    }
  } catch (e) {}

  return false;
};

const waitForMappingReady = (eventTimeoutMs = 1500, pollMs = 50, maxWaitMs = 4000) => {
  return new Promise((resolve) => {
    if (isMappingReady()) {
      resolve(true);
      return;
    }

    let done = false;
    let pollTimer = null;
    let fallbackStartTimer = null;
    let maxWaitTimer = null;

    const cleanup = () => {
      MAPPING_READY_EVENTS.forEach((evName) => {
        window.removeEventListener(evName, onReadyEvent);
      });
      window.removeEventListener('transport:mappingReadyInternal', onReadyEvent);
      if (pollTimer) clearInterval(pollTimer);
      if (fallbackStartTimer) clearTimeout(fallbackStartTimer);
      if (maxWaitTimer) clearTimeout(maxWaitTimer);
    };

    const finish = (val) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(val);
    };

    const onReadyEvent = (event) => {
      const detail = event?.detail;
      if (detail && detail.ready === false) return;
      window.__transportMappingSeen = true;
      finish(true);
    };

    MAPPING_READY_EVENTS.forEach((evName) => {
      window.addEventListener(evName, onReadyEvent);
    });
    window.addEventListener('transport:mappingReadyInternal', onReadyEvent);

    // Opätovná kontrola hneď po zaregistrovaní poslúchačov
    if (isMappingReady()) {
      finish(true);
      return;
    }

    fallbackStartTimer = setTimeout(() => {
      if (done) return;
      if (isMappingReady()) {
        finish(true);
        return;
      }
      pollTimer = setInterval(() => {
        if (isMappingReady()) finish(true);
      }, pollMs);
    }, eventTimeoutMs);

    if (maxWaitMs > 0) {
      maxWaitTimer = setTimeout(() => {
        finish(true);
      }, maxWaitMs);
    }
  });
};

/* ------------------------------------------------------------------ */
/* Ikonky pre typy miest                                              */
/* ------------------------------------------------------------------ */

const placeTypeIcons = {
  sportova_hala: { icon: 'fa-futbol', color: '#dc2626', label: 'Športová hala' },
  stravovanie:   { icon: 'fa-utensils', color: '#16a34a', label: 'Stravovanie' },
  ubytovanie:    { icon: 'fa-bed', color: '#6b7280', label: 'Ubytovanie' },
  zastavka:      { icon: 'fa-bus', color: '#2563eb', label: 'Zastávka' },
};

/* ------------------------------------------------------------------ */
/* Farby pre typy udalostí (catering aj zápasy odstránené)            */
/* ------------------------------------------------------------------ */

const EVENT_COLORS = {
  transfer_bus:        { bg: 'bg-blue-50',   text: 'text-blue-800',   icon: 'fa-bus',             label: 'Presun busom' },
  transfer_walking:    { bg: 'bg-amber-50',  text: 'text-amber-800',  icon: 'fa-person-walking',  label: 'Peší presun' },
  transfer_unassigned: { bg: 'bg-gray-50',   text: 'text-gray-700',   icon: 'fa-question-circle', label: 'Nepriradený presun' },
  accommodation:       { bg: 'bg-purple-50', text: 'text-purple-800', icon: 'fa-bed',             label: 'Ubytovanie' },
};

/* ------------------------------------------------------------------ */
/* Výpis stravovania iba do konzoly (na základe logged-in-catering.js) */
/* ------------------------------------------------------------------ */

const useCateringConsoleLog = (
  db,
  { trackerResolvedNames, resolvePlaceNameById }
) => {
  const loggedSignatureRef = useRef('');

  // Ref na najnovšie hodnoty, aby log vždy používal aktuálne dáta
  // bez toho, aby sa effect re-subscriboval pri každej zmene.
  const trackerResolvedNamesRef = useRef(trackerResolvedNames);
  const resolvePlaceNameByIdRef = useRef(resolvePlaceNameById);

  useEffect(() => {
    trackerResolvedNamesRef.current = trackerResolvedNames;
  }, [trackerResolvedNames]);

  useEffect(() => {
    resolvePlaceNameByIdRef.current = resolvePlaceNameById;
  });

  useEffect(() => {
    if (!db) return;

    let cancelled = false;
    let cateringDocs = [];
    let placesMap = new Map();
    let usersByKey = new Map();
    let usersByCategory = new Map();

    const memberHasMeal = (member, dayKey, mealType, teamPackageDetails) => {
      const memberMealSetting = member?.packageDetails?.meals?.[dayKey]?.[mealType];
      if (memberMealSetting !== undefined) {
        return memberMealSetting === 1 || memberMealSetting === true;
      }
      const teamMealSetting = teamPackageDetails?.meals?.[dayKey]?.[mealType];
      if (teamMealSetting !== undefined) {
        return teamMealSetting === 1 || teamMealSetting === true;
      }
      return true;
    };

    const countMembersWithMeal = (teamData, dayKey, mealType) => {
      if (!teamData) return 0;
      const teamPackageDetails = teamData.packageDetails || null;
      const countArr = (arr) =>
        Array.isArray(arr)
          ? arr.filter((m) => memberHasMeal(m, dayKey, mealType, teamPackageDetails)).length
          : 0;

      return (
        countArr(teamData.playerDetails) +
        countArr(teamData.menTeamMemberDetails) +
        countArr(teamData.womenTeamMemberDetails) +
        countArr(teamData.driverDetailsMale) +
        countArr(teamData.driverDetailsFemale)
      );
    };

    const getSuperstructureAvg = (category, dayKey, mealType) => {
      const cat = cleanCategory(category);
      const list = usersByCategory.get(cat) || [];
      if (list.length === 0) return null;

      const total = list.reduce((acc, t) => {
        const cnt = dayKey && mealType
          ? countMembersWithMeal(t.rawTeamData, dayKey, mealType)
          : t.fallbackTotal;
        return acc + cnt;
      }, 0);

      return Math.ceil(total / list.length);
    };

    const logCatering = async () => {
      if (cancelled) return;

      // Rovnako ako pri zápasoch: počkáme, kým je mapovanie pripravené,
      // aby matchTracker.getTeamNameByDisplayId mal naplnené mapovanie
      // (inak by sa superstructure tímy ako "U12 D 1E" nezmapovali správne).
      if (!isMappingReady()) {
        await waitForMappingReady(1500, 50, 4000);
      }
      if (!__transportPerTeamBuffer.matchesReady || !__transportPerTeamBuffer.cateringReady) {
        await new Promise((res) => {
          const t = setInterval(() => {
            if (__transportPerTeamBuffer.matchesReady && __transportPerTeamBuffer.cateringReady) {
              clearInterval(t); res();
            }
          }, 100);
          setTimeout(() => { clearInterval(t); res(); }, 4000);
        });
      }
      if (cancelled) return;

      const mappedCatering = await Promise.all(cateringDocs.map(async (a) => {
        const cat = cleanCategory(a.categoryName || a.category || a.clickedTeamCategory || '');
        const dayKey = a.dayKey || null;
        const mealType = a.mealType || '';
        const mealLabel =
          mealType === 'lunch' ? 'Obed' :
          mealType === 'dinner' ? 'Večera' :
          (mealType || '-');

        const placeName = a.placeId
          ? (resolvePlaceNameByIdRef.current?.(a.placeId) || placesMap.get(a.placeId) || a.placeName || '-')
          : (a.placeName || '-');

        const timeRange = a.slotFrom && a.slotTo
          ? `${a.slotFrom} – ${a.slotTo}`
          : (a.slotFrom || '-');

        let rawTeamName = a.teamName || '';
        let headcount = '-';

        if (a.isSuperstructure === true) {
          rawTeamName = a.teamName || cat || '-';
          const avg = getSuperstructureAvg(cat, dayKey, mealType);
          if (avg != null) headcount = avg;
        } else {
          const team =
            usersByKey.get(`${a.teamUid}|${a.teamIndex}|${cat}`) ||
            Array.from(usersByKey.values()).find(
              (t) => String(t.uid) === String(a.teamUid) && Number(t.teamIndex) === Number(a.teamIndex)
            );
          if (team) {
            rawTeamName = team.teamName;
            headcount = dayKey && mealType
              ? countMembersWithMeal(team.rawTeamData, dayKey, mealType)
              : team.fallbackTotal;
          }
        }

        const trimmedRawTeam = String(rawTeamName || '').trim();

        // ROVNAKÉ mapovanie ako v tabuľke zápasov:
        // resolveTeamNameForDisplay(identifier, categoryName)
        // - najprv teamManager.getTeamNameByDisplayIdSync
        // - potom matchTracker.getTeamNameByDisplayId
        // Voláme ho VŽDY, keď názov tímu obsahuje kategóriu (rovnako ako pri zápasoch),
        // aby sa aj superstructure tímy (napr. "U12 D 1E") namapovali rovnako.
        let resolvedTeamName = trimmedRawTeam || '-';
        if (trimmedRawTeam) {
          try {
            const viaDisplay = await resolveTeamNameForDisplay(trimmedRawTeam, cat);
            if (
              viaDisplay &&
              String(viaDisplay).trim() !== '' &&
              String(viaDisplay).trim() !== 'null'
            ) {
              resolvedTeamName = String(viaDisplay).trim();
            } else if (trackerResolvedNamesRef.current?.[trimmedRawTeam]) {
              // fallback na cache, ak resolver nič nevrátil
              resolvedTeamName = trackerResolvedNamesRef.current[trimmedRawTeam];
            }
          } catch (e) {
            // ak resolver zlyhá, skúsime cache
            if (trackerResolvedNamesRef.current?.[trimmedRawTeam]) {
              resolvedTeamName = trackerResolvedNamesRef.current[trimmedRawTeam];
            }
          }
        }
        
        return {
          id: a.id,
          dátum: a.dayLabel || dayKey || '-',
          jedlo: mealLabel,
          čas: timeRange,
          kategória: cat || '-',
          tím: resolvedTeamName,
          typ: a.isSuperstructure ? (a.isPriority ? 'superstructure (priorita)' : 'superstructure') : 'tím',
          miesto: placeName,
          počet: headcount,
        };
      }));

      mappedCatering.sort((x, y) => {
        const dCmp = String(x.dátum).localeCompare(String(y.dátum), 'sk');
        if (dCmp !== 0) return dCmp;
        const tCmp = String(x.čas).localeCompare(String(y.čas), 'sk');
        if (tCmp !== 0) return tCmp;
        return String(x.tím).localeCompare(String(y.tím), 'sk', { sensitivity: 'base' });
      });

      const sig = JSON.stringify(mappedCatering);
      if (sig === loggedSignatureRef.current) return;
      loggedSignatureRef.current = sig;

      console.log(`🍽️ TRANSPORT.JS – načítaných ${mappedCatering.length} záznamov stravovania z kolekcie 'catering':`);
      if (console.table) {
        console.table(mappedCatering);
      } else {
        console.log(mappedCatering);
      }

      // Naplnenie bufferu pre per-tím timeline (stravovanie)
      const cateringEventsForBuffer = [];
      for (const row of mappedCatering) {
        const teamName = String(row.tím || '').trim();
        if (!teamName || teamName === '-') continue;

        // Získame timestamp zo dňa + času (slotFrom)
        // row.čas je formát "17:00 – 17:30", row.dátum je "25. 12. 2026"
        const ts = (() => {
          const dateMatch = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(String(row.dátum || ''));
          const timeMatch = /(\d{1,2}):(\d{2})/.exec(String(row.čas || ''));
          if (!dateMatch || !timeMatch) return Number.POSITIVE_INFINITY;
          const d = new Date(
            Number(dateMatch[3]),
            Number(dateMatch[2]) - 1,
            Number(dateMatch[1]),
            Number(timeMatch[1]),
            Number(timeMatch[2]),
            0, 0
          );
          return isNaN(d.getTime()) ? Number.POSITIVE_INFINITY : d.getTime();
        })();

        cateringEventsForBuffer.push({
          kind: 'catering',
          teamName,
          category: String(row.kategória || '').trim(),
          ts,
          sortKey: `${row.dátum}|${row.čas}|${row.jedlo}|${row.miesto}`,
          label: `🍽️ STRAVOVANIE ${row.dátum} ${row.čas} | ${row.jedlo} | ${row.miesto} | ${row.kategória}${row.typ && row.typ !== 'tím' ? ` | ${row.typ}` : ''}`,
        });
      }

      __transportPerTeamBuffer.catering = cateringEventsForBuffer;
      __transportPerTeamBuffer.cateringReady = true;
      tryPrintPerTeamTimeline();
    };

    const unsubCatering = onSnapshot(collection(db, 'catering'), (snap) => {
      cateringDocs = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      logCatering().catch((e) => console.error('useCateringConsoleLog: logCatering error', e));
    }, () => {});

    const unsubPlaces = onSnapshot(collection(db, 'places'), (snap) => {
      const nextMap = new Map();
      snap.forEach((d) => {
        const data = d.data() || {};
        if (data.type === 'stravovanie') {
          nextMap.set(d.id, data.name || '(bez názvu)');
        }
      });
      placesMap = nextMap;
      logCatering().catch((e) => console.error('useCateringConsoleLog: logCatering error', e));
    }, () => {});

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const nextByKey = new Map();
      const nextByCat = new Map();

      snap.forEach((userDoc) => {
        const userTeams = userDoc.data()?.teams;
        if (!userTeams || typeof userTeams !== 'object') return;

        Object.entries(userTeams).forEach(([categoryName, teamArray]) => {
          if (!Array.isArray(teamArray)) return;
          const cat = cleanCategory(categoryName);

          teamArray.forEach((team, teamIndex) => {
            if (!team?.teamName) return;
            const entry = {
              uid: userDoc.id,
              teamIndex,
              teamName: String(team.teamName).trim(),
              category: cat,
              rawTeamData: team,
              fallbackTotal:
                (Array.isArray(team.playerDetails) ? team.playerDetails.length : 0) +
                (Array.isArray(team.menTeamMemberDetails) ? team.menTeamMemberDetails.length : 0) +
                (Array.isArray(team.womenTeamMemberDetails) ? team.womenTeamMemberDetails.length : 0) +
                (Array.isArray(team.driverDetailsMale) ? team.driverDetailsMale.length : 0) +
                (Array.isArray(team.driverDetailsFemale) ? team.driverDetailsFemale.length : 0),
            };
            nextByKey.set(`${userDoc.id}|${teamIndex}|${cat}`, entry);
            if (!nextByCat.has(cat)) nextByCat.set(cat, []);
            nextByCat.get(cat).push(entry);
          });
        });
      });

      usersByKey = nextByKey;
      usersByCategory = nextByCat;
      logCatering().catch((e) => console.error('useCateringConsoleLog: logCatering error', e));
    }, () => {});

    return () => {
      cancelled = true;
      unsubCatering();
      unsubPlaces();
      unsubUsers();
    };
  }, [db]);
};

/* ------------------------------------------------------------------ */
/* Hlavná komponenta                                                  */
/* ------------------------------------------------------------------ */

const TransportApp = ({ userProfileData }) => {
  /* -------------------- Refs -------------------- */
  const placesMapRef = useRef({});
  const allPlacesRef = useRef([]);
  const teamsLookupRef = useRef({});
  const teamsArrivalBufferRef = useRef([]);
  const savedTransfersRef = useRef([]);
  const superstructureGroupsRef = useRef({});
  const transportColorsRef = useRef({});
  const teamsLoadedRef = useRef(false);
  const travelTimesLoadedRef = useRef(false);
  const completedTeamsRef = useRef(new Set());
  const matchesLoadedRef = useRef(false);
  const categoryMatchDurationsRef = useRef({}); 
  const categoryMatchDurationsByNameRef = useRef({});

  /* -------------------- State -------------------- */
  const [loading, setLoading] = useState(true);
  const [allPlaces, setAllPlaces] = useState([]);
  const [stopsList, setStopsList] = useState([]);
  const [buses, setBuses] = useState([]);
  const [busRows, setBusRows] = useState({});
  const [savedTransfers, setSavedTransfers] = useState([]);
  const [tournamentDays, setTournamentDays] = useState([]);
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [availableTeams, setAvailableTeams] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [matchesVersion, setMatchesVersion] = useState(0);
  const matchStatusesRef = useRef({});
  const trackerResolvedNamesRef = useRef({});
  const [trackerResolvedNames, setTrackerResolvedNames] = useState({});

  const arrivalTimestampRef = useRef(null);
  const firstTournamentDayKeyRef = useRef(null);

  useEffect(() => {
      trackerResolvedNamesRef.current = trackerResolvedNames;
      __transportPerTeamBuffer.resolvedNames = trackerResolvedNames;
  }, [trackerResolvedNames]);

  /* -------------------- Pomocné resolve funkcie -------------------- */
  const resolvePlaceNameById = (placeId) => {
    if (!placeId) return '';
    const id = String(placeId);
    const fromMap = placesMapRef.current[id];
    if (fromMap) return fromMap;
    const fromAll = (allPlacesRef.current || []).find((p) => p.id === id);
    if (fromAll) return fromAll.name;
    const fromStops = (stopsList || []).find((s) => s.id === id);
    if (fromStops) return fromStops.name;
    return id;
  };

  const getMatchDurationMsForMatch = (m) => {
    // 1) podľa categoryId
    if (m?.categoryId) {
      const byId = categoryMatchDurationsRef.current[m.categoryId];
      if (byId != null) return byId;
    }
    // 2) podľa categoryName
    const catName = String(m?.categoryName || '').trim();
    if (catName) {
      const byName = categoryMatchDurationsByNameRef.current[catName];
      if (byName != null) return byName;
    }
    // 3) fallback – skús window.categoriesData
    try {
      const catId = m?.categoryId;
      const catData = catId && window.categoriesData ? window.categoriesData[catId] : null;
      if (catData) {
        const ms = computeMatchDurationMs(catData);
        if (ms != null) return ms;
      }
    } catch (e) {}
    return null;
  };

  useCateringConsoleLog(window.db, {
    trackerResolvedNames,
    resolvePlaceNameById,
  });

  const cateringEvents = [];

  const resolvePlaceIdByName = (placeName) => {
    if (!placeName) return null;
    const raw = String(placeName).trim();
    const direct = (allPlacesRef.current || []).find((p) => p.id === raw);
    if (direct) return direct.id;
    const norm = normalizePlaceName(raw);
    const found = (allPlacesRef.current || []).find((p) => normalizePlaceName(p.name) === norm);
    return found ? found.id : null;
  };

  const getPlaceIconForName = (placeName) => {
    if (!placeName) return null;
    const norm = normalizePlaceName(placeName);
    const found = (allPlacesRef.current || []).find((p) => normalizePlaceName(p.name) === norm)
      || (stopsList || []).find((s) => normalizePlaceName(s.name) === norm);
    if (!found) return null;
    const meta = placeTypeIcons[found.type] || { icon: 'fa-circle-dot', color: '#6b7280' };
    return React.createElement('i', {
      className: `fa-solid ${meta.icon}`,
      style: { color: meta.color, marginRight: '4px' },
      title: meta.label || found.type || '',
    });
  };

  /* -------------------- Výpočet zobrazenia pešieho segmentu -------------------- */
  const getWalkingSegmentDisplayRange = (parent, segmentIndex) => {
    if (!parent || !Array.isArray(parent.segments)) return null;

    const segments = parent.segments;
    const currentSegment = segments[segmentIndex];
    if (!currentSegment || currentSegment.isWalking !== true) return null;

    const parentRange = parseWhenRangeToTs(parent.when);

    let previousBusIndex = -1;
    let previousBusEndTs = null;
    for (let i = segmentIndex - 1; i >= 0; i--) {
      const segment = segments[i];
      if (!segment || segment.isWalking === true) continue;
      if (segment.endTs != null) {
        previousBusIndex = i;
        previousBusEndTs = segment.endTs;
        break;
      }
      if (segment.startTs != null) {
        previousBusIndex = i;
        previousBusEndTs = segment.startTs;
        break;
      }
    }

    let nextBusIndex = segments.length;
    let nextBusStartTs = null;
    for (let i = segmentIndex + 1; i < segments.length; i++) {
      const segment = segments[i];
      if (!segment || segment.isWalking === true) continue;
      if (segment.startTs != null) {
        nextBusIndex = i;
        nextBusStartTs = segment.startTs;
        break;
      }
      if (segment.endTs != null) {
        nextBusIndex = i;
        nextBusStartTs = segment.endTs;
        break;
      }
    }

    const intervalStartTs = previousBusEndTs != null
      ? previousBusEndTs
      : (parentRange?.startTs ?? null);

    const intervalEndTs = nextBusStartTs != null
      ? nextBusStartTs
      : (parentRange?.endTs ?? null);

    if (
      intervalStartTs == null ||
      intervalEndTs == null ||
      intervalEndTs <= intervalStartTs
    ) {
      return null;
    }

    const walkingIndexes = [];
    for (let i = previousBusIndex + 1; i < nextBusIndex; i++) {
      if (segments[i] && segments[i].isWalking === true) {
        walkingIndexes.push(i);
      }
    }

    const walkingCount = walkingIndexes.length || 1;
    const walkingPosition = Math.max(0, walkingIndexes.indexOf(segmentIndex));

    const intervalDuration = intervalEndTs - intervalStartTs;
    const walkingPartDuration = intervalDuration / walkingCount;

    const displayStartTs = intervalStartTs + walkingPosition * walkingPartDuration;
    const displayEndTs = walkingPosition === walkingCount - 1
      ? intervalEndTs
      : displayStartTs + walkingPartDuration;

    return { startTs: displayStartTs, endTs: displayEndTs };
  };

  /* -------------------- Rozdelenie celkového času medzi segmenty bez vlastných časov -------------------- */
  const getUnassignedSegmentDisplayRange = (parent, segmentIndex, routeIds, parentSegments) => {
    if (!parent) return null;
    const parentRange = parseWhenRangeToTs(parent.when);
    if (!parentRange || parentRange.startTs == null || parentRange.endTs == null) return null;
    if (parentRange.endTs <= parentRange.startTs) return null;

    const unassignedIndexes = [];
    for (let i = 0; i < routeIds.length - 1; i++) {
      const fromId = routeIds[i];
      const toId = routeIds[i + 1];
      if (fromId === toId) continue;
      const seg = parentSegments.find((s) => s && s.fromId === fromId && s.toId === toId) || null;
      const isWalking = !!(seg && seg.isWalking === true);
      const hasTimes = !!(seg && seg.startTs != null && seg.endTs != null && seg.endTs > seg.startTs);
      if (!isWalking && !hasTimes) {
        unassignedIndexes.push(i);
      }
    }

    if (unassignedIndexes.length === 0) return null;
    const position = unassignedIndexes.indexOf(segmentIndex);
    if (position === -1) return null;

    const count = unassignedIndexes.length;
    const isOnlySegment = (routeIds.length - 1) === 1;
    if (count === 1 && isOnlySegment) {
      return { startTs: parentRange.startTs, endTs: parentRange.endTs };
    }

    const intervalDuration = parentRange.endTs - parentRange.startTs;
    const partDuration = intervalDuration / count;

    const displayStartTs = parentRange.startTs + position * partDuration;
    const displayEndTs = displayStartTs + partDuration;

    return { startTs: displayStartTs, endTs: displayEndTs };
  };

  /* -------------------- Firestore subscriptions -------------------- */
  useEffect(() => {
    if (!window.db) {
      console.error('transport.js: window.db nie je inicializované.');
      setLoading(false);
      return;
    }
    const unsubs = [];

    // Reakcia na window správu o dokončení mapovania (vrátane už zachytených skorých udalostí)
    const handleMappingCompleted = (event) => {
      const detail = event?.detail;
      if (detail && detail.ready === false) return;
      window.__transportMappingSeen = true;
      resolveTransfersViaMatchTracker(savedTransfersRef.current);
      setMatchesVersion((v) => v + 1);
    };

    MAPPING_READY_EVENTS.forEach((evName) => {
      window.addEventListener(evName, handleMappingCompleted);
      unsubs.push(() => window.removeEventListener(evName, handleMappingCompleted));
    });
    window.addEventListener('transport:mappingReadyInternal', handleMappingCompleted);
    unsubs.push(() => window.removeEventListener('transport:mappingReadyInternal', handleMappingCompleted));

    // Ak už mapovanie zbehlo pred pripojením effect-u, spracuj ho okamžite
    if (isMappingReady()) {
      resolveTransfersViaMatchTracker(savedTransfersRef.current);
      setMatchesVersion((v) => v + 1);
    }

    // places (map + list)
    try {
      const placesRef = collection(window.db, 'places');
      unsubs.push(onSnapshot(placesRef, (snap) => {
        const map = {};
        const list = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          map[d.id] = data.name || '(bez názvu)';
          list.push({
            id: d.id,
            name: data.name || '(bez názvu)',
            type: data.type || '(neznámy typ)',
            capacity: data.capacity ?? null,
            accommodationType: data.accommodationType || null,
            lat: data.location?.latitude ?? data.lat ?? null,
            lng: data.location?.longitude ?? data.lng ?? null,
          });
        });
        list.sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));
        placesMapRef.current = map;
        allPlacesRef.current = list;
        setAllPlaces(list);
        setStopsList(list.filter((p) => p.type === 'zastavka'));
      }, (e) => {}));
    } catch (e) {}

    // settings/transportTravelTimes → times + transfers
    try {
      const ttRef = doc(window.db, 'settings', 'transportTravelTimes');
      unsubs.push(onSnapshot(ttRef, (snap) => {
        const transfers = [];
        if (snap.exists()) {
          const data = snap.data() || {};
          const rawTransfers = data.transfers || {};
          Object.entries(rawTransfers).forEach(([key, v]) => {
            if (!v) return;
            transfers.push({
              key,
              category: v.category || '',
              categoryId: v.categoryId || null,
              teamUid: v.teamUid || null,
              teamIndex: v.teamIndex ?? null,
              teamName: v.teamName || null,
              when: v.when || '',
              fromId: v.fromId || resolvePlaceIdByName(v.fromLocation),
              toId: v.toId || resolvePlaceIdByName(v.toLocation),
              fromLocation: resolvePlaceNameById(v.fromId) || v.fromLocation || '',
              toLocation: resolvePlaceNameById(v.toId) || v.toLocation || '',
              text: v.text || '',
              dayKey: v.dayKey || null,
              isWalking: v.isWalking === true,
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
              })),
            });
          });
          transfers.sort((a, b) => {
            const c = String(a.category || '').localeCompare(String(b.category || ''), 'sk');
            if (c !== 0) return c;
            const t = String(a.teamName || '').localeCompare(String(b.teamName || ''), 'sk');
            if (t !== 0) return t;
            return String(a.when || '').localeCompare(String(b.when || ''), 'sk');
          });
        }
        savedTransfersRef.current = transfers;
        setSavedTransfers(transfers);
        travelTimesLoadedRef.current = true;
        setLoading(false);

        const transfersForBuffer = transfers.map((t) => {
          // ⬅️ NOVÉ: definuj mappedTeamName
          const rawTeamName = String(t.teamName || '').trim();
          const mappedTeamName = trackerResolvedNamesRef.current?.[rawTeamName] || rawTeamName;
  
          const legStops = [
            { id: t.fromId, name: t.fromLocation },
            ...(Array.isArray(t.intermediateStopIds)
              ? t.intermediateStopIds.map((id, i) => ({
                  id,
                  name: (t.intermediateStops && t.intermediateStops[i]) || resolvePlaceNameById(id),
                }))
              : []),
            { id: t.toId, name: t.toLocation },
          ].filter((s) => s.name);
        
          const whenRange = parseWhenRangeToTs(t.when);
        
          const legs = [];
          for (let i = 0; i < legStops.length - 1; i++) {
            const fromStop = legStops[i];
            const toStop = legStops[i + 1];
            if (!fromStop.name || !toStop.name) continue;
            const seg = (t.segments || []).find(
              (s) => s && s.fromId === fromStop.id && s.toId === toStop.id
            ) || null;
            const isWalking = t.isWalking === true || !!(seg && seg.isWalking === true);
        
            // ⬅️ ZMENA: časy z `segments` (ak sú timestampy) ALEBO z `segments` stringu ("10:50 – 10:57")
            let startTs = seg?.startTs != null && isFinite(seg.startTs) ? seg.startTs : null;
            let endTs = seg?.endTs != null && isFinite(seg.endTs) ? seg.endTs : null;
        
            // ⬅️ ZMENA: ak segment nemá timestampy, skúsime parsovať stringové časy
            if ((startTs == null || endTs == null) && seg) {
              const segText = String(seg.text || seg.label || '').match(
                /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/
              );
              if (segText && whenRange?.startTs != null) {
                const base = new Date(whenRange.startTs);
                startTs = startTs ?? new Date(
                  base.getFullYear(), base.getMonth(), base.getDate(),
                  Number(segText[1]), Number(segText[2]), 0, 0
                ).getTime();
                endTs = endTs ?? new Date(
                  base.getFullYear(), base.getMonth(), base.getDate(),
                  Number(segText[3]), Number(segText[4]), 0, 0
                ).getTime();
              }
            }
        
            legs.push({
              fromName: fromStop.name,
              toName: toStop.name,
              isWalking,
              busName: t.text || null,
              startTs,
              endTs,
            });
          }
        
          // ⬅️ ZMENA: doplniť chýbajúce okraje z `when` (aj keď už niektoré legy majú časy)
          if (whenRange) {
            if (legs.length > 0) {
              if (legs[0].startTs == null) legs[0].startTs = whenRange.startTs;
              if (legs[legs.length - 1].endTs == null) legs[legs.length - 1].endTs = whenRange.endTs;
              // ak legy nemajú vôbec časy, rozdeľme interval rovnomerne (aby mali aspoň niečo)
              const anyTime = legs.some((l) => l.startTs != null && l.endTs != null);
              if (!anyTime) {
                const total = whenRange.endTs - whenRange.startTs;
                const step = total / legs.length;
                legs.forEach((l, i) => {
                  l.startTs = whenRange.startTs + i * step;
                  l.endTs = whenRange.startTs + (i + 1) * step;
                });
              }
            }
          }
        
          const startTs =
            legs.find((l) => l.startTs != null && isFinite(l.startTs))?.startTs ??
            whenRange?.startTs ??
            Number.POSITIVE_INFINITY;
          const endTs =
            [...legs].reverse().find((l) => l.endTs != null && isFinite(l.endTs))?.endTs ??
            whenRange?.endTs ??
            startTs;
        
          const dayKeyFromTs =
            startTs !== Number.POSITIVE_INFINITY && isFinite(startTs)
              ? (() => {
                  const d = new Date(startTs);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })()
              : null;
        
          const legLabels = legs.map((l) => {
            const timeLabel =
              l.startTs != null && l.endTs != null
                ? `${formatTimeOnly(l.startTs)} – ${formatTimeOnly(l.endTs)}`
                : l.isWalking
                  ? 'PEŠI'
                  : 'nepriradený';
            const dateLabel = formatDateDDMMYYYY(l.startTs) || '';
            const legTypeLabel = l.isWalking ? 'PEŠI' : (l.busName || 'PRESUN');
            return `🚌 ${legTypeLabel} ${dateLabel ? dateLabel + ' ' : ''}${timeLabel} | ${l.fromName} → ${l.toName} | ${t.category || '-'}`;
          });
        
          const fromName = legs[0]?.fromName || t.fromLocation || null;
          const toName = legs[legs.length - 1]?.toName || t.toLocation || null;
        
          return {
            kind: 'transfer',
            key: t.key,
            teamName: t.teamName || null,
            teamUid: t.teamUid || null,
            teamIndex: t.teamIndex ?? null,
            category: t.category || '',
            dayKey: t.dayKey || dayKeyFromTs,
            ts: startTs,
            endTs,
            isWalking: t.isWalking === true,
            busName: t.text || null,
            fromName,
            toName,
            title: fromName && toName ? `${fromName} → ${toName}` : (t.text || ''),
            legs,
            legLabels,
            label: `🚌 PRESUN ${formatDateDDMMYYYY(startTs) || ''} ${formatTimeOnly(startTs)} – ${formatTimeOnly(endTs)} | ${fromName || '?'} → ${toName || '?'} | ${t.category || '-'}`,
            sortKey: `${t.dayKey || dayKeyFromTs || ''}|${startTs}|${t.key || ''}`,
          };
        });

        __transportPerTeamBuffer.transfers = transfersForBuffer;
        __transportPerTeamBuffer.transfersReady = true;
        // Reset signatúry, aby sa výpis prekreslil s reálnymi transfermi
        __transportPerTeamBuffer.lastPrintedSignature = '';

        tryPrintPerTeamTimeline();
        resolveTransfersViaMatchTracker(transfers);
      }, (e) => {
        console.error('transportTravelTimes error', e);
        travelTimesLoadedRef.current = true;
        setLoading(false);
        // Aj pri chybe nastavíme transfersReady, aby sa per-tím timeline
        // aspoň raz skúsil vykresliť (napr. so syntetickými presunmi).
        __transportPerTeamBuffer.transfers = __transportPerTeamBuffer.transfers || [];
        __transportPerTeamBuffer.transfersReady = true;
        tryPrintPerTeamTimeline();
      }));
    } catch (e) {}

    // transport → bus + busRow
    try {
      const transportRef = collection(window.db, 'transport');
      unsubs.push(onSnapshot(transportRef, (snap) => {
        const busesList = [];
        const rowsGrouped = {};
        snap.forEach((d) => {
          const data = d.data() || {};
          if (data.type === 'bus') {
            const num = Number(data.number);
            busesList.push({
              id: d.id,
              name: data.name || (isFinite(num) ? `Bus ${num}` : 'Bus'),
              number: isFinite(num) ? num : 0,
            });
            return;
          }
          if (data.type === 'busRow') {
            if (!data.busId || !data.dayKey) return;
            const key = `${data.busId}|${data.dayKey}`;
            if (!rowsGrouped[key]) rowsGrouped[key] = [];
            const order = Number(data.order) || 0;
            rowsGrouped[key].push({
              id: d.id,
              order,
              rowId: data.rowId || buildRowId(data.busId, data.dayKey, order),
              timeFrom: data.timeFrom || '',
              timeTo: data.timeTo || '',
              placeFromId: data.placeFromId || null,
              placeToId: data.placeToId || null,
              placeFrom: data.placeFromId ? resolvePlaceNameById(data.placeFromId) : '',
              placeTo: data.placeToId ? resolvePlaceNameById(data.placeToId) : '',
            });
          }
        });
        busesList.sort((a, b) => a.number - b.number);
        Object.values(rowsGrouped).forEach((arr) => arr.sort((a, b) => a.order - b.order));
        setBuses(busesList);
        setBusRows(rowsGrouped);
      }, (e) => {}));
    } catch (e) {}

    // users → teams lookup + arrival buffer + kategórie
    const loadTeams = async () => {
      try {
        const usersSnap = await getDocs(collection(window.db, 'users'));
        const lookup = {};
        const buffer = [];
        const cats = new Set();
        const teamsSet = new Set();

        usersSnap.forEach((userDoc) => {
          const ud = userDoc.data() || {};
          const teams = ud.teams;
          if (!teams || typeof teams !== 'object') return;
          Object.entries(teams).forEach(([category, arr]) => {
            if (!Array.isArray(arr)) return;
            const cat = cleanCategory(category);
            cats.add(cat);
            arr.forEach((team, idx) => {
              if (!team || !team.teamName) return;
              const tn = String(team.teamName).trim();
              teamsSet.add(`${cat}|${tn}`);
              lookup[`${userDoc.id}|${cat}|${idx}`] = { teamName: tn, category: cat, teamIndex: idx, userId: userDoc.id };
              buffer.push({
                category: cat,
                teamName: tn,
                accommodationName: team.accommodation?.name || '',
                accommodationType: team.accommodation?.type || '(nešpecifikovaný)',
                isRegistered: true,
                isSuperstructure: false,
              });
            });
          });
        });

        teamsLookupRef.current = lookup;
        teamsArrivalBufferRef.current = buffer;
        teamsLoadedRef.current = true;
        setAvailableCategories([...cats].sort((a, b) => a.localeCompare(b, 'sk')));
        setAvailableTeams(
          [...teamsSet].sort((a, b) => {
            const [catA, nameA] = a.split('|');
            const [catB, nameB] = b.split('|');
            const c = catA.localeCompare(catB, 'sk', { sensitivity: 'base' });
            if (c !== 0) return c;
            return nameA.localeCompare(nameB, 'sk', { sensitivity: 'base' });
          })
        );
      } catch (e) {}
    };
    loadTeams();

    // users → mapa (kategória|tím) -> názov ubytovne (alebo 'bez ubytovania')
    try {
      const usersRef = collection(window.db, 'users');
      unsubs.push(onSnapshot(usersRef, (snap) => {
        const nextMap = new Map();
        snap.forEach((userDoc) => {
          const userTeams = userDoc.data()?.teams;
          if (!userTeams || typeof userTeams !== 'object') return;

          Object.entries(userTeams).forEach(([categoryName, teamArray]) => {
            if (!Array.isArray(teamArray)) return;
            const cat = cleanCategory(categoryName);

            teamArray.forEach((team) => {
              if (!team?.teamName) return;
              const teamName = String(team.teamName).trim();
              const accomType = String(team.accommodation?.type || '').trim();
              const accomName = String(team.accommodation?.name || '').trim();

              const hasAccommodation = accomType !== '' && accomType.toLowerCase() !== 'bez ubytovania';
              const displayAccommodation = (hasAccommodation && accomName)
                ? accomName
                : 'bez ubytovania';

              nextMap.set(`${cat}|${teamName}`, displayAccommodation);
            });
          });
        });

        __transportPerTeamBuffer.accommodationByKey = nextMap;
        __transportPerTeamBuffer.accommodationReady = true;

        // Reset signatúry, aby sa výpis prekreslil aj keď sa zmenilo len ubytovanie
        __transportPerTeamBuffer.lastPrintedSignature = '';

        // Ak už máme zápasy aj stravovanie, prekreslíme výpis s ubytovaním
        tryPrintPerTeamTimeline();
      }, () => {}));
    } catch (e) {}

    // settings/registration → tournament days
    try {
      const regRef = doc(window.db, 'settings', 'registration');
      unsubs.push(onSnapshot(regRef, (snap) => {
        if (!snap.exists()) { setTournamentDays([]); return; }
        const data = snap.data() || {};
        const toDate = (ts) => {
          if (!ts) return null;
          if (typeof ts.toDate === 'function') return ts.toDate();
          if (ts instanceof Date) return ts;
          const d = new Date(ts);
          return isNaN(d.getTime()) ? null : d;
        };
    
        // OPRAVA: bezpečný prístup k window bufferu
        if (!window.__transportPerTeamBuffer) {
          window.__transportPerTeamBuffer = __transportPerTeamBuffer;
        }
    
        const arrivalDt = toDate(data.arrivalDate);
        window.__transportPerTeamBuffer.arrivalTimestamp = arrivalDt && !isNaN(arrivalDt.getTime())
          ? arrivalDt.getTime()
          : null;
    
        const start = toDate(data.tournamentStart);
        const end = toDate(data.tournamentEnd);
    
        const startDayKey = start && !isNaN(start.getTime())
          ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
          : null;
    
        window.__transportPerTeamBuffer.firstTournamentDayKey = startDayKey;
        firstTournamentDayKeyRef.current = startDayKey;
    
        // Prekresliť per-tím timeline, keď sa zmenil arrival / prvý deň
        __transportPerTeamBuffer.lastPrintedSignature = '';
        tryPrintPerTeamTimeline();
    
        if (!start || !end) { setTournamentDays([]); return; }
        const days = [];
        const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        while (cursor <= endDay) {
          const d = new Date(cursor);
          const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          days.push({
            dayKey,
            dateLabel: formatDateDDMMYYYY(d),
            dayName: d.toLocaleDateString('sk-SK', { weekday: 'long' }),
          });
          cursor.setDate(cursor.getDate() + 1);
        }
        setTournamentDays(days);
      }, (e) => {}));
    } catch (e) {}

    // settings/categories → drawColors + durations
    try {
      const catRef = doc(window.db, 'settings', 'categories');
      unsubs.push(onSnapshot(catRef, (snap) => {
        const colorMap = {};
        const durById = {};
        const durByName = {};
        if (snap.exists()) {
          const data = snap.data() || {};
          Object.entries(data).forEach(([catId, catData]) => {
            if (!catData) return;

            // farby (pôvodná logika)
            const dc = catData.drawColor || null;
            if (dc) {
              if (catData.name) colorMap[String(catData.name).trim()] = dc;
              colorMap[catId] = dc;
            }

            // ─── NOVÉ: trvanie zápasu pre kategóriu ───
            const durationMs = computeMatchDurationMs(catData);
            if (durationMs != null) {
              durById[catId] = durationMs;
              if (catData.name) {
                durByName[String(catData.name).trim()] = durationMs;
              }
            }
          });
        }
        transportColorsRef.current = colorMap;
        categoryMatchDurationsRef.current = durById;
        categoryMatchDurationsByNameRef.current = durByName;
      }, (e) => {}));
    } catch (e) {}

    // settings/superstructureGroups
    try {
      const ssgRef = doc(window.db, 'settings', 'superstructureGroups');
      unsubs.push(onSnapshot(ssgRef, (snap) => {
        const map = {};
        if (snap.exists()) {
          const data = snap.data() || {};
          Object.entries(data).forEach(([catName, arr]) => {
            if (!Array.isArray(arr)) return;
            arr.forEach((team) => {
              if (!team?.teamName || !team?.groupName) return;
              const cat = cleanCategory(catName);
              const grp = String(team.groupName).trim();
              const key = `${cat}|${grp}`;
              if (!map[key]) map[key] = new Set();
              map[key].add(String(team.teamName).trim());
            });
          });
        }
        superstructureGroupsRef.current = Object.fromEntries(
          Object.entries(map).map(([k, v]) => [k, [...v]])
        );
      }, (e) => {}));
    } catch (e) {}

    // matches → sledovanie VŠETKÝCH zápasov + completed stavov + matchTracker mapovanie
    try {
      const matchesRef = collection(window.db, 'matches');
      unsubs.push(onSnapshot(matchesRef, (snap) => {
        const completedTeams = new Set();
        let anyMatchCompletedNow = false;
        let anyChangeDetected = false;

        snap.docChanges().forEach((change) => {
          const data = change.doc.data() || {};
          const prevStatus = matchStatusesRef.current[change.doc.id];
          const currStatus = data.status || 'scheduled';
          matchStatusesRef.current[change.doc.id] = currStatus;

          if (change.type !== 'removed') {
            anyChangeDetected = true;
          }

          if (currStatus === 'completed' && prevStatus !== 'completed') {
            anyMatchCompletedNow = true;
          }
        });

        // 2) Zozbieranie VŠETKÝCH zápasov (nielen completed)
        const allMatches = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          const placeName = data.hallId
            ? (resolvePlaceNameById(data.hallId) || data.hallName || data.placeName || '-')
            : (data.hallName || data.placeName || '-');

          allMatches.push({
            id: d.id,
            status: data.status || 'scheduled',
            categoryId: data.categoryId || null,
            categoryName: data.categoryName || null,
            groupName: data.groupName || null,
            matchType: data.matchType || null,
            isPlacementMatch: data.isPlacementMatch === true,
            hallId: data.hallId || null,
            placeName,
            homeTeamIdentifier: data.homeTeamIdentifier || null,
            awayTeamIdentifier: data.awayTeamIdentifier || null,
            homeTeamName: data.homeTeamName || null,
            awayTeamName: data.awayTeamName || null,
            homeTeam: data.homeTeam || null,
            awayTeam: data.awayTeam || null,
            homeScore: data.homeScore ?? null,
            awayScore: data.awayScore ?? null,
            scheduledTime: data.scheduledTime || data.matchDate || null,
          });
          
          if (data.status === 'completed') {
            const candidates = [
              data.homeTeamIdentifier,
              data.awayTeamIdentifier,
              data.homeTeamName,
              data.awayTeamName,
              data.homeTeam,
              data.awayTeam,
            ].filter(Boolean).map((v) => String(v).trim());

            candidates.forEach((name) => {
              completedTeams.add(name);
              completedTeams.add(name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
            });
          }
        });

        if (anyChangeDetected || matchesLoadedRef.current === false) {
          (async () => {
            await waitForMappingReady(1500, 50, 4000);

            const mappedMatches = [];
            for (const m of allMatches) {
              const categoryName = m.categoryName
                || (m.categoryId && window.categoriesData ? window.categoriesData[m.categoryId] : null)
                || null;

              const homeRaw = m.homeTeamName || m.homeTeamIdentifier || m.homeTeam || '?';
              const awayRaw = m.awayTeamName || m.awayTeamIdentifier || m.awayTeam || '?';

              const homeMapped = await resolveTeamNameForDisplay(homeRaw, categoryName);
              const awayMapped = await resolveTeamNameForDisplay(awayRaw, categoryName);
              const formattedScheduled = m.scheduledTime
                ? (formatDateTime(m.scheduledTime) || String(m.scheduledTime))
                : '-';

              mappedMatches.push({
                id: m.id,
                dátum_a_čas: formattedScheduled,
                status: m.status,
                kategória: m.categoryName || m.categoryId || '-',
                skupina: m.groupName || '-',
                typ: m.matchType || '-',
                miesto: m.hallId ? (resolvePlaceNameById(m.hallId) || m.placeName) : m.placeName,
                domáci: homeMapped,
                hostia: awayMapped,
                skóre: (m.homeScore ?? '-') + ':' + (m.awayScore ?? '-'),
              });
            }

            console.log(`📋 TRANSPORT.JS – načítaných ${mappedMatches.length} zápasov z kolekcie 'matches':`);
            if (console.table) {
              console.table(mappedMatches);
            } else {
              console.log(mappedMatches);
            }

            // Naplnenie bufferu pre per-tím timeline (zápasy)
            const matchEventsForBuffer = [];
            for (const m of allMatches) {
              const categoryName = m.categoryName
                || (m.categoryId && window.categoriesData ? window.categoriesData[m.categoryId] : null)
                || null;

              const homeRaw = m.homeTeamName || m.homeTeamIdentifier || m.homeTeam || '?';
              const awayRaw = m.awayTeamName || m.awayTeamIdentifier || m.awayTeam || '?';

              const homeMapped = await resolveTeamNameForDisplay(homeRaw, categoryName);
              const awayMapped = await resolveTeamNameForDisplay(awayRaw, categoryName);

              const ts = m.scheduledTime
                ? (() => {
                    const d = typeof m.scheduledTime.toDate === 'function'
                      ? m.scheduledTime.toDate()
                      : (m.scheduledTime instanceof Date ? m.scheduledTime : new Date(m.scheduledTime));
                    return isNaN(d.getTime()) ? Number.POSITIVE_INFINITY : d.getTime();
                  })()
                : Number.POSITIVE_INFINITY;

              const whenLabel = m.scheduledTime
                ? (formatDateTime(m.scheduledTime) || String(m.scheduledTime))
                : '-';

              const placeLabel = m.hallId
                ? (resolvePlaceNameById(m.hallId) || m.placeName || '-')
                : (m.placeName || '-');

              const matchCategory = String(m.categoryName || m.categoryId || '').trim();

              // ─── NOVÉ: dopočítanie konca zápasu z trvania kategórie ───
              const durationMs = getMatchDurationMsForMatch(m);
              const startTsForMatch =
                m.scheduledTime
                  ? (() => {
                      const d = typeof m.scheduledTime.toDate === 'function'
                        ? m.scheduledTime.toDate()
                        : (m.scheduledTime instanceof Date ? m.scheduledTime : new Date(m.scheduledTime));
                      return isNaN(d.getTime()) ? null : d.getTime();
                    })()
                  : null;
              const endTsForMatch =
                startTsForMatch != null && durationMs != null
                  ? startTsForMatch + durationMs
                  : null;

              const whenLabelWithEnd = (() => {
                if (startTsForMatch == null) return whenLabel;
                const startDate = formatDateDDMMYYYY(startTsForMatch) || '';
                const startTime = formatTimeOnly(startTsForMatch);
                if (endTsForMatch != null) {
                  const endTime = formatTimeOnly(endTsForMatch);
                  return `${startDate} ${startTime} – ${endTime}`.trim();
                }
                return `${startDate} ${startTime}`.trim();
              })();
              
              // pre domáci tím
              if (homeMapped && homeMapped !== '?') {
                matchEventsForBuffer.push({
                  kind: 'match',
                  teamName: String(homeMapped).trim(),
                  category: matchCategory,
                  ts,
                  endTs: endTsForMatch,
                  sortKey: `${whenLabel}|vs ${awayMapped}|${m.id}`,
                  label: `⚽ ZÁPAS ${whenLabelWithEnd} | ${placeLabel} | ${homeMapped} vs ${awayMapped} | ${m.categoryName || m.categoryId || '-'}${m.groupName ? ` | ${m.groupName}` : ''} | ${m.status === 'completed' ? `výsledok ${(m.homeScore ?? '-')}:${(m.awayScore ?? '-')}` : 'naplánovaný'}`,
                });
              }
              // pre hostí
              if (awayMapped && awayMapped !== '?') {
                matchEventsForBuffer.push({
                  kind: 'match',
                  teamName: String(awayMapped).trim(),
                  category: matchCategory,
                  ts,
                  endTs: endTsForMatch,
                  sortKey: `${whenLabel}|vs ${homeMapped}|${m.id}`,
                  label: `⚽ ZÁPAS ${whenLabelWithEnd} | ${placeLabel} | ${awayMapped} vs ${homeMapped} | ${m.categoryName || m.categoryId || '-'}${m.groupName ? ` | ${m.groupName}` : ''} | ${m.status === 'completed' ? `výsledok ${(m.awayScore ?? '-')}:${(m.homeScore ?? '-')}` : 'naplánovaný'}`,
                });
              }
            }

            __transportPerTeamBuffer.matches = matchEventsForBuffer;
            __transportPerTeamBuffer.matchesReady = true;
            tryPrintPerTeamTimeline();
          })();
        }

        completedTeamsRef.current = completedTeams;
        matchesLoadedRef.current = true;
        setMatchesVersion((v) => v + 1);

        if (anyChangeDetected || anyMatchCompletedNow) {
          resolveTransfersViaMatchTracker(savedTransfersRef.current);
        }
      }, (e) => {
        console.error('transport.js: matches snapshot error', e);
        matchesLoadedRef.current = true;
      }));
    } catch (e) {
      console.error('transport.js: nepodarilo sa prihlásiť na matches', e);
    }

    return () => unsubs.forEach((u) => u && u());
  }, []);

  const resolveTransfersViaMatchTracker = async (transfersList) => {
    if (typeof resolveTeamNameForDisplay !== 'function') return;

    const sourceList = Array.isArray(transfersList) ? transfersList : savedTransfersRef.current;
    if (!Array.isArray(sourceList) || sourceList.length === 0) return;

    if (!isMappingReady()) {
      await waitForMappingReady(1500, 50, 4000);
    }

    const updates = {};
    let hasChanges = false;

    for (const tr of sourceList) {
      const rawTeamName = tr?.teamName != null ? String(tr.teamName).trim() : '';
      const rawCategory = tr?.category != null ? cleanCategory(tr.category) : '';

      if (!rawTeamName) continue;

      try {
        // Rovnaké mapovanie ako pri zápasoch: resolveTeamNameForDisplay
        const result = await resolveTeamNameForDisplay(rawTeamName, rawCategory);
        if (
          result !== undefined &&
          result !== null &&
          String(result).trim() !== '' &&
          String(result).trim() !== 'null' &&
          String(result).trim() !== rawTeamName
        ) {
          const cleanResult = String(result).trim();
          if (trackerResolvedNamesRef.current[rawTeamName] !== cleanResult) {
            updates[rawTeamName] = cleanResult;
            hasChanges = true;
          }
        }
      } catch (e) {
        // ignorovať chybu pri jednotlivých názvoch
      }
    }

    if (hasChanges) {
      const nextMap = { ...trackerResolvedNamesRef.current, ...updates };
      trackerResolvedNamesRef.current = nextMap;
      setTrackerResolvedNames(nextMap);
      setMatchesVersion((v) => v + 1);
    }
  };

  useEffect(() => {
    if (!savedTransfers || savedTransfers.length === 0) return;

    resolveTransfersViaMatchTracker(savedTransfers);

    const retryTimer = setTimeout(() => {
      resolveTransfersViaMatchTracker(savedTransfersRef.current);
    }, 800);

    return () => clearTimeout(retryTimer);
  }, [savedTransfers]);

  useEffect(() => {
    if (Object.keys(trackerResolvedNamesRef.current).length === 0) return;
    if (!__transportPerTeamBuffer.transfers || __transportPerTeamBuffer.transfers.length === 0) return;
  
    __transportPerTeamBuffer.transfers = __transportPerTeamBuffer.transfers.map((t) => {
      if (t.kind !== 'transfer') return t;
      const rawTeamName = String(t.teamName || '').trim();
      const mappedTeamName = trackerResolvedNamesRef.current?.[rawTeamName];
      if (!mappedTeamName || mappedTeamName === rawTeamName) return t;
      return { ...t, teamName: mappedTeamName };
    });

    __transportPerTeamBuffer.lastPrintedSignature = '';
    tryPrintPerTeamTimeline();
  }, [trackerResolvedNames]);

  /* ------------------------------------------------------------------ */
  /* Filter presunov: ak je tím ubytovaný, v deň s viacerými presunmi    */
  /* pred prvou udalosťou (zápas/stravovanie) zobraz iba logický presun  */
  /* (začína na ubytovaní, končí na mieste prvej udalosti).              */
  /* Ak tím nie je ubytovaný, ber miesto zrazu z parent (už je v dátach).*/
  /* ------------------------------------------------------------------ */
  
  const pickFirstEventOfDayForTeam = (category, teamName, dayKey) => {
    const cat = cleanCategory(category || '');
    const team = String(teamName || '').trim();
    if (!cat || !team || !dayKey) return null;
  
    const candidates = [
      ...__transportPerTeamBuffer.matches,
      ...__transportPerTeamBuffer.catering,
    ].filter(
      (ev) =>
        String(ev.teamName || '').trim() === team &&
        cleanCategory(ev.category || '') === cat &&
        ev.ts != null &&
        isFinite(ev.ts) &&
        // dayKey z ts
        (() => {
          const d = new Date(ev.ts);
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return k === dayKey;
        })()
    );
  
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.ts - b.ts);
    return candidates[0];
  };
  
  const getPlaceNameFromEventLabel = (ev) => {
    // label formát:
    //   ⚽ ZÁPAS <when> | <place> | ...
    //   🍽️ STRAVOVANIE <dátum> <čas> | <jedlo> | <miesto> | ...
    if (!ev || !ev.label) return null;
    const parts = String(ev.label).split('|').map((s) => s.trim());
    if (ev.kind === 'match') {
      return parts[1] || null; // place je druhý segment
    }
    if (ev.kind === 'catering') {
      return parts[2] || null; // miesto je tretí segment
    }
    return null;
  };
  
  const isTransferRelevantForFirstEvent = (transferLegs, accommodationName, firstEventPlaceName) => {
    if (!Array.isArray(transferLegs) || transferLegs.length === 0) return false;
  
    const firstFrom = transferLegs[0]?.fromName;
    const lastTo = transferLegs[transferLegs.length - 1]?.toName;
    if (!firstFrom || !lastTo) return false;
  
    const startOk = accommodationName
      ? normalizePlaceName(firstFrom) === normalizePlaceName(accommodationName)
      : true; // bez ubytovania → necháme (miesto zrazu je už z parent)
  
    const endOk = firstEventPlaceName
      ? normalizePlaceName(lastTo) === normalizePlaceName(firstEventPlaceName)
      : true;
  
    return startOk && endOk;
  };

  // Naplnenie bufferu pre per-tím timeline (transfery)
  useEffect(() => {
    if (!savedTransfers || savedTransfers.length === 0) {
      __transportPerTeamBuffer.transfers = [];
      __transportPerTeamBuffer.transfersReady = true;
      tryPrintPerTeamTimeline();
      return;
    }

    let cancelled = false;

    (async () => {
      // Počkáme na mapovanie (rovnako ako pri zápasoch a stravovaní)
      if (!isMappingReady()) {
        await waitForMappingReady(1500, 50, 4000);
      }
      if (cancelled) return;

      const rawEvents = [];

      for (const parent of savedTransfers) {
        if (parent._parentKey && parent._parentKey !== parent.key) continue;

        const parentCategory = cleanCategory(parent.category || '');
        const rawTeamName = String(parent.teamName || '').trim();
        if (!rawTeamName) continue;

        // Mapovanie názvu tímu rovnako ako pri zápasoch.
        // Priorita: cache z resolveTransfersViaMatchTracker (rovnaká ako timelineEvents),
        // fallback: resolveTeamNameForDisplay.
        let mappedTeamName = rawTeamName;
        const cachedMapped = trackerResolvedNamesRef.current?.[rawTeamName];
        if (cachedMapped) {
          mappedTeamName = cachedMapped;
        } else {
          try {
            const viaDisplay = await resolveTeamNameForDisplay(rawTeamName, parentCategory);
            if (viaDisplay && String(viaDisplay).trim() !== '' && String(viaDisplay).trim() !== 'null') {
              mappedTeamName = String(viaDisplay).trim();
            }
          } catch (e) {}
        }
        
        const parentSegments = Array.isArray(parent.segments) ? parent.segments : [];
        const parentRange = parseWhenRangeToTs(parent.when);

        // Zostavíme trasu z fromId + intermediateStopIds + toId
        const stopsIds = Array.isArray(parent.intermediateStopIds)
          ? parent.intermediateStopIds.filter(Boolean)
          : [];
        const routeIdsRaw = [parent.fromId, ...stopsIds, parent.toId].filter(Boolean);
        const routeIds = [];
        routeIdsRaw.forEach((id) => {
          if (routeIds.length === 0 || routeIds[routeIds.length - 1] !== id) routeIds.push(id);
        });
        if (routeIds.length < 2) continue;

        // Pre každý leg vypočítame čas ROVNAKO ako v UI (timelineEvents)
        const legs = [];
        let startTs = null;
        let endTs = null;
        let hasRealTimes = false;
        let anyWalking = false;
        let allWalking = true;
        let busName = null;

        for (let i = 0; i < routeIds.length - 1; i++) {
          const fromId = routeIds[i];
          const toId = routeIds[i + 1];
          if (fromId === toId) continue;

          const seg = parentSegments.find((s) => s && s.fromId === fromId && s.toId === toId) || null;
          const legWalking = !!(seg && seg.isWalking === true);
          const legHasTimes = !!(seg && seg.startTs != null && seg.endTs != null && seg.endTs > seg.startTs);

          let legStartTs = null;
          let legEndTs = null;

          if (legWalking) {
            // ROVNAKÁ logika ako v UI: dopočítať peší segment z okolitých bus segmentov
            const walkingRange = getWalkingSegmentDisplayRange(parent, i);
            if (walkingRange) {
              legStartTs = walkingRange.startTs;
              legEndTs = walkingRange.endTs;
            } else if (seg?.startTs != null) {
              legStartTs = seg.startTs;
              legEndTs = seg.endTs != null ? seg.endTs : seg.startTs + 60 * 1000;
            }
          } else if (legHasTimes) {
            legStartTs = seg.startTs;
            legEndTs = seg.endTs;
          } else {
            // ROVNAKÁ logika ako v UI: dopočítať nepriradený segment z parent.when
            const unassignedRange = getUnassignedSegmentDisplayRange(parent, i, routeIds, parentSegments);
            if (unassignedRange) {
              legStartTs = unassignedRange.startTs;
              legEndTs = unassignedRange.endTs;
            }
          }

          if (legStartTs != null && (startTs == null || legStartTs < startTs)) startTs = legStartTs;
          if (legEndTs != null && (endTs == null || legEndTs > endTs)) endTs = legEndTs;
          if (legHasTimes) hasRealTimes = true;
          if (legWalking) anyWalking = true;
          if (!legWalking) allWalking = false;

          if (!busName && seg?.busId) {
            const b = buses.find((x) => x.id === String(seg.busId));
            busName = b?.name || `Bus ${seg.busId}`;
          }

          legs.push({
            fromName: resolvePlaceNameById(fromId),
            toName: resolvePlaceNameById(toId),
            isWalking: legWalking,
            busName: seg?.busId ? (buses.find((x) => x.id === String(seg.busId))?.name || `Bus ${seg.busId}`) : null,
            startTs: legStartTs,
            endTs: legEndTs,
            hasTimes: legHasTimes,
          });
        }

        if (legs.length === 0) continue;

        const overallIsWalking = legs.every((l) => l.isWalking);

        // Zostavíme timeLabel ROVNAKO ako v UI
        let timeLabel = '';
        if (overallIsWalking) {
          if (startTs != null) {
            if (endTs == null) endTs = startTs + 60 * 1000;
            timeLabel = `${formatTimeOnly(startTs)} – ${formatTimeOnly(endTs)}`;
          } else {
            timeLabel = 'PEŠI';
          }
        } else if (startTs != null) {
          timeLabel = endTs != null
            ? `${formatTimeOnly(startTs)} – ${formatTimeOnly(endTs)}`
            : formatTimeOnly(startTs);
        } else {
          timeLabel = 'nepriradený';
        }

        // Určenie typu presunu
        let typeLabel = 'PRESUN';
        if (overallIsWalking) typeLabel = 'PRESUN PEŠI';
        else if (hasRealTimes) typeLabel = 'PRESUN BUSOM';
        else typeLabel = 'PRESUN (nepriradený)';

        // Dátum (pre label aj dayKey) – z parent.when alebo z dopočítaného startTs
        let dayKey = parent.dayKey || null;
        if (!dayKey && startTs != null) {
          const d = new Date(startTs);
          dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        if (!dayKey && parentRange?.startTs) {
          const d = new Date(parentRange.startTs);
          dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        // ─── NOVÉ: pre peší presun BEZ časov zistiť dátum aspoň z parent.when ───
        // Ak je celý presun peší a nemá startTs, ale parent.when obsahuje dátum,
        // použijeme tento dátum (aspoň pre zobrazenie v labeli a pre dayKey).
        let fallbackDayLabel = '';
        if (startTs == null && parent.when) {
          // Skúsime z parent.when vytiahnuť dátum (aj bez času)
          const dateMatch = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(String(parent.when));
          if (dateMatch) {
            fallbackDayLabel = `${String(dateMatch[1]).padStart(2, '0')}. ${String(dateMatch[2]).padStart(2, '0')}. ${dateMatch[3]}`;
            if (!dayKey) {
              dayKey = `${dateMatch[3]}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[1]).padStart(2, '0')}`;
            }
          }
        }

        // whenLabel – ak sú reálne časy, použiť dopočítaný timeLabel s dátumom;
        // inak parent.when alebo "-"
        let whenLabel = '';
        if (startTs != null) {
          const startDateLabel = formatDateDDMMYYYY(startTs) || '';
          const startTimeLabel = formatTimeOnly(startTs);
          const endTimeLabel = endTs != null ? formatTimeOnly(endTs) : '';
          whenLabel = endTimeLabel
            ? `${startDateLabel} ${startTimeLabel} – ${endTimeLabel}`
            : `${startDateLabel} ${startTimeLabel}`.trim();
        } else if (parent.when) {
          whenLabel = String(parent.when);
        } else if (fallbackDayLabel) {
          whenLabel = fallbackDayLabel;
        } else {
          whenLabel = '-';
        }

        // Pre sortTs použijeme startTs (dopočítaný), inak parent.when
        const ts = startTs != null ? startTs : (parentRange?.startTs ?? Number.POSITIVE_INFINITY);

        // ─── NOVÉ: robustný fallback pre dátum z parent.when (aj pre peší presun bez časov) ───
        let robustFallbackDayLabel = '';
        if (parent.when) {
          const dateMatch = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(String(parent.when));
          if (dateMatch) {
            robustFallbackDayLabel = `${String(dateMatch[1]).padStart(2, '0')}. ${String(dateMatch[2]).padStart(2, '0')}. ${dateMatch[3]}`;
          }
        }
        // Ak dayKey chýba, ale parent.when obsahuje dátum, dopočítame ho
        if (!dayKey && robustFallbackDayLabel) {
          const dm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(String(parent.when));
          if (dm) {
            dayKey = `${dm[3]}-${String(dm[2]).padStart(2, '0')}-${String(dm[1]).padStart(2, '0')}`;
          }
        }
        
        const legLabels = legs.map((l) => {
          const legTimeLabel = l.startTs != null
            ? (l.endTs != null
                ? `${formatTimeOnly(l.startTs)} – ${formatTimeOnly(l.endTs)}`
                : formatTimeOnly(l.startTs))
            : (l.isWalking ? 'PEŠI' : 'nepriradený');

          const legTypeLabel = l.isWalking
            ? 'PEŠI'
            : (l.busName || 'PRESUN');
        
          // Dátum legu – z jeho vlastného startTs, inak z parent dňa
          let legDateLabel = '';
          if (l.startTs != null) {
            legDateLabel = formatDateDDMMYYYY(l.startTs) || '';
          } else if (dayKey) {
            const parts = String(dayKey).split('-');
            if (parts.length === 3) {
              legDateLabel = `${parts[2]}. ${parts[1]}. ${parts[0]}`;
            }
          } else if (parentRange?.startTs) {
            legDateLabel = formatDateDDMMYYYY(parentRange.startTs) || '';
          } else if (robustFallbackDayLabel) {
            // ─── NOVÉ: robustný fallback z parent.when ───
            legDateLabel = robustFallbackDayLabel;
          }

          // ─── NOVÉ: pre peší presun bez časov nezobrazovať "PEŠI" dvakrát ───
          const timeAndType = (l.isWalking && l.startTs == null && !legTimeLabel.includes('–'))
            ? 'PEŠI'
            : `${legTimeLabel}`;
        
          // ─── NOVÉ: ak je PEŠI bez časov, nepridávame typ dvakrát ───
          const typePart = (l.isWalking && l.startTs == null && !legTimeLabel.includes('–'))
            ? ''
            : `${legTypeLabel} `;
        
          return `🚌 ${typePart}${legDateLabel ? legDateLabel + ' ' : ''}${timeAndType} | ${l.fromName} → ${l.toName} | ${parentCategory || '-'}`;
        });

        const segmentsLabel = legs
          .map((l) => `${l.fromName} → ${l.toName}`)
          .join(' | ');

        const busLabel = busName ? ` | ${busName}` : '';

        rawEvents.push({
          kind: 'transfer',
          teamName: mappedTeamName,
          category: parentCategory,
          ts,
          dayKey,
          sortKey: `${dayKey || ''}|${whenLabel}|${segmentsLabel}`,
          label: `🚌 ${typeLabel} ${whenLabel} | ${segmentsLabel}${busLabel} | ${parentCategory || '-'}`,
          legLabels,
          legs: legs.map((l) => ({
            fromName: l.fromName,
            toName: l.toName,
            isWalking: l.isWalking,
            busName: l.busName,
            startTs: l.startTs,
            endTs: l.endTs,
            timeLabel: l.startTs != null
              ? (l.endTs != null
                  ? `${formatTimeOnly(l.startTs)} – ${formatTimeOnly(l.endTs)}`
                  : formatTimeOnly(l.startTs))
              : (l.isWalking ? 'PEŠI' : 'nepriradený'),
          })),
        });
      }

      if (cancelled) return;

      const transfersEventsForBuffer = [];

      // ─── NOVÉ: filter podľa ubytovania a prvej udalosti dňa ───
      const grouped = new Map();
      for (const ev of rawEvents) {
        const key = `${cleanCategory(ev.category)}|${String(ev.teamName).trim()}|${ev.dayKey || ''}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(ev);
      }

      for (const [key, events] of grouped.entries()) {
        const [cat, team, dk] = key.split('|');

        const firstEvent = pickFirstEventOfDayForTeam(cat, team, dk);
        const firstEventPlace = firstEvent ? getPlaceNameFromEventLabel(firstEvent) : null;

        const accomKey = `${cat}|${team}`;
        const accommodationName =
          __transportPerTeamBuffer.accommodationByKey.get(accomKey) || null;
        const hasAccommodation =
          accommodationName && accommodationName !== 'bez ubytovania';

        if (!firstEvent && !hasAccommodation) {
          transfersEventsForBuffer.push(...events);
          continue;
        }

        const firstEventTs = firstEvent?.ts ?? Number.POSITIVE_INFINITY;

        const beforeFirst = [];
        const afterFirst = [];
        for (const ev of events) {
          if (ev.ts < firstEventTs) beforeFirst.push(ev);
          else afterFirst.push(ev);
        }

        if (beforeFirst.length <= 1) {
          transfersEventsForBuffer.push(...events);
          continue;
        }

        const matching = beforeFirst.filter((ev) =>
          isTransferRelevantForFirstEvent(
            ev.legs,
            hasAccommodation ? accommodationName : null,
            firstEventPlace
          )
        );

        if (matching.length > 0) {
          matching.sort((a, b) => a.ts - b.ts);
          transfersEventsForBuffer.push(matching[0], ...afterFirst);
        } else {
          transfersEventsForBuffer.push(...events);
        }
      }
      // ─── koniec filtra ───

      __transportPerTeamBuffer.transfers = transfersEventsForBuffer;
      __transportPerTeamBuffer.transfersReady = true;
      __transportPerTeamBuffer.lastPrintedSignature = '';
      tryPrintPerTeamTimeline();
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTransfers, trackerResolvedNames, buses, allPlaces]);

  const isTeamNameResolved = (teamName, categoryName) => {
    if (!teamName) return false;
    const tn = String(teamName).trim();
    const cat = categoryName ? cleanCategory(categoryName) : '';

    // Ak už máme namapovaný názov v cache, je vyriešený
    const mapped = trackerResolvedNamesRef.current[tn] ?? trackerResolvedNames[tn];
    if (
      mapped !== undefined &&
      mapped !== null &&
      String(mapped).trim() !== '' &&
      String(mapped).trim() !== 'null' &&
      String(mapped).trim() !== tn
    ) {
      return true;
    }

    // Ak názov neobsahuje kategóriu, netreba mapovať
    if (!cat || !tn.includes(cat)) return true;

    return false;
  };

  /* ------------------------------------------------------------------ */
  /* Filter presunov pre UI (rovnaká logika ako v tryPrintPerTeamTimeline) */
  /* ------------------------------------------------------------------ */
  const pickFirstEventOfDayForTeamUi = (category, teamName, dayKey) => {
    const cat = cleanCategory(category || '');
    const team = String(teamName || '').trim();
    if (!cat || !team || !dayKey) return null;

    const candidates = [
      ...__transportPerTeamBuffer.matches,
      ...__transportPerTeamBuffer.catering,
    ].filter(
      (ev) =>
        String(ev.teamName || '').trim() === team &&
        cleanCategory(ev.category || '') === cat &&
        ev.ts != null &&
        isFinite(ev.ts) &&
        (() => {
          const d = new Date(ev.ts);
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return k === dayKey;
        })()
    );

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.ts - b.ts);
    return candidates[0];
  };

  const getPlaceNameFromEventLabelUi = (ev) => {
    if (!ev || !ev.label) return null;
    const parts = String(ev.label).split('|').map((s) => s.trim());
    if (ev.kind === 'match') return parts[1] || null;
    if (ev.kind === 'catering') return parts[2] || null;
    return null;
  };

  const isTransferRelevantForFirstEventUi = (transferLegs, accommodationName, firstEventPlaceName) => {
    if (!Array.isArray(transferLegs) || transferLegs.length === 0) return false;

    const firstFrom = transferLegs[0]?.fromName;
    const lastTo = transferLegs[transferLegs.length - 1]?.toName;
    if (!firstFrom || !lastTo) return false;

    const startOk = accommodationName
      ? normalizePlaceName(firstFrom) === normalizePlaceName(accommodationName)
      : true;

    const endOk = firstEventPlaceName
      ? normalizePlaceName(lastTo) === normalizePlaceName(firstEventPlaceName)
      : true;

    return startOk && endOk;
  };

  /* -------------------- Zostavenie timeline eventov -------------------- */
  const timelineEvents = useMemo(() => {
    if (!travelTimesLoadedRef.current) return [];
    const rawEvents = [];

    const dayFilter = selectedDayKey || null;
    const catFilter = selectedCategory ? cleanCategory(selectedCategory) : null;

    // selectedTeam teraz obsahuje "Kategória|Názov tímu" (alebo prázdny string)
    let teamFilterName = null;
    let teamFilterCategory = null;
    if (selectedTeam) {
      const sepIdx = selectedTeam.indexOf('|');
      if (sepIdx >= 0) {
        teamFilterCategory = cleanCategory(selectedTeam.slice(0, sepIdx));
        teamFilterName = selectedTeam.slice(sepIdx + 1).trim();
      } else {
        // fallback – keby náhodou prišla len samotná hodnota
        teamFilterName = selectedTeam.trim();
      }
    }

    (savedTransfers || []).forEach((parent) => {
      if (parent._parentKey && parent._parentKey !== parent.key) return;
      // ─── NOVÉ: namapovaný názov tímu (rovnako ako v zápasoch) ───
      const rawTeamNameForFilter = String(parent.teamName || '').trim();
      const mappedTeamNameForFilter =
        trackerResolvedNamesRef.current[rawTeamNameForFilter] ??
        trackerResolvedNames[rawTeamNameForFilter] ??
        rawTeamNameForFilter;
      if (catFilter && cleanCategory(parent.category || '') !== catFilter) return;
      if (teamFilterName && mappedTeamNameForFilter !== teamFilterName) return;
      if (teamFilterCategory && cleanCategory(parent.category || '') !== teamFilterCategory) return;

      if (!isTeamNameResolved(parent.teamName, parent.category)) return;

      const stopsIds = Array.isArray(parent.intermediateStopIds) ? parent.intermediateStopIds.filter(Boolean) : [];
      const parentSegments = Array.isArray(parent.segments) ? parent.segments : [];

      const routeIdsRaw = [parent.fromId, ...stopsIds, parent.toId].filter(Boolean);
      const routeIds = [];
      routeIdsRaw.forEach((id) => {
        if (routeIds.length === 0 || routeIds[routeIds.length - 1] !== id) routeIds.push(id);
      });
      if (routeIds.length < 2) return;

      const parentWhenRange = parseWhenRangeToTs(parent.when);

      const legs = [];
      let startTs = null, endTs = null;
      let hasRealTimes = false;
      let busId = null;
      let busName = null;
      let anyWalking = false;
      let allWalking = true;

      for (let i = 0; i < routeIds.length - 1; i++) {
        const fromId = routeIds[i];
        const toId = routeIds[i + 1];
        if (fromId === toId) continue;

        const seg = parentSegments.find((s) => s && s.fromId === fromId && s.toId === toId) || null;
        const legWalking = !!(seg && seg.isWalking === true);
        const legHasTimes = !!(seg && seg.startTs != null && seg.endTs != null && seg.endTs > seg.startTs);

        const legFromName = resolvePlaceNameById(fromId);
        const legToName = resolvePlaceNameById(toId);

        let legStartTs = null, legEndTs = null, legTimeLabel = '';
        if (legWalking) {
          const walkingRange = getWalkingSegmentDisplayRange(parent, i);

          if (walkingRange) {
            legStartTs = walkingRange.startTs;
            legEndTs = walkingRange.endTs;
            legTimeLabel = `${formatTimeOnly(legStartTs)} – ${formatTimeOnly(legEndTs)}`;
          } else if (seg?.startTs != null) {
            legStartTs = seg.startTs;
            legEndTs = seg.endTs != null ? seg.endTs : seg.startTs + 60 * 1000;
            legTimeLabel = `${formatTimeOnly(legStartTs)} – ${formatTimeOnly(legEndTs)}`;
          } else {
            legTimeLabel = 'PEŠI';
          }
        } else if (legHasTimes) {
          legStartTs = seg.startTs;
          legEndTs = seg.endTs;
          legTimeLabel = `${formatTimeOnly(legStartTs)} – ${formatTimeOnly(legEndTs)}`;
        } else {
          const unassignedRange = getUnassignedSegmentDisplayRange(parent, i, routeIds, parentSegments);
          if (unassignedRange) {
            legStartTs = unassignedRange.startTs;
            legEndTs = unassignedRange.endTs;
            legTimeLabel = `${formatTimeOnly(legStartTs)} – ${formatTimeOnly(legEndTs)}`;
          } else {
            legTimeLabel = 'nepriradený';
          }
        }

        const legBusId = seg?.busId ? String(seg.busId) : null;
        const legBusName = legBusId
          ? (buses.find((b) => b.id === legBusId)?.name || `Bus ${legBusId}`)
          : null;

        if (legStartTs != null && (startTs == null || legStartTs < startTs)) startTs = legStartTs;
        if (legEndTs != null && (endTs == null || legEndTs > endTs)) endTs = legEndTs;
        if (legHasTimes) hasRealTimes = true;
        if (!busId && legBusId) { busId = legBusId; busName = legBusName; }
        if (legWalking) anyWalking = true;
        if (!legWalking) allWalking = false;

        legs.push({
          fromName: legFromName,
          toName: legToName,
          isWalking: legWalking,
          busName: legBusName,
          timeLabel: legTimeLabel,
          startTime: legStartTs != null ? formatTimeOnly(legStartTs) : '',
          endTime: legEndTs != null ? formatTimeOnly(legEndTs) : '',
          startTs: legStartTs,
          endTs: legEndTs,
          hasTimes: legHasTimes,
        });
      }

      if (legs.length === 0) return;

      const overallIsWalking = legs.every((l) => l.isWalking);

      let timeLabel = '';
      if (overallIsWalking) {
        if (startTs != null) {
          if (endTs == null) endTs = startTs + 60 * 1000;
          timeLabel = `${formatTimeOnly(startTs)} – ${formatTimeOnly(endTs)}`;
        } else {
          timeLabel = 'PEŠI';
        }
      } else if (hasRealTimes && startTs != null) {
        timeLabel = endTs != null
          ? `${formatTimeOnly(startTs)} – ${formatTimeOnly(endTs)}`
          : formatTimeOnly(startTs);
      } else {
        timeLabel = 'nepriradený';
      }

      let dayKey = parent.dayKey || null;
      if (!dayKey && startTs != null) {
        const d = new Date(startTs);
        dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      if (!dayKey && parentWhenRange) {
        const d = new Date(parentWhenRange.startTs);
        dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      if (dayFilter && dayKey !== dayFilter) return;

      const fromName = resolvePlaceNameById(routeIds[0]);
      const toName = resolvePlaceNameById(routeIds[routeIds.length - 1]);

      const sortTs = startTs != null
        ? startTs
        : (parentWhenRange?.startTs ?? Number.POSITIVE_INFINITY);

      let typeKey;
      if (overallIsWalking) typeKey = 'transfer_walking';
      else if (hasRealTimes) typeKey = 'transfer_bus';
      else typeKey = 'transfer_unassigned';

      rawEvents.push({
        id: parent.key,
        dayKey,
        sortTs,
        startTs,
        endTs,
        timeLabel,
        typeKey,
        title: `${fromName} → ${toName}`,
        category: cleanCategory(parent.category || ''),
        categoryId: parent.categoryId || null,
        teamName: mappedTeamNameForFilter,
        fromName,
        toName,
        busName,
        isWalking: overallIsWalking,
        hasRealTimes,
        placeIcon: getPlaceIconForName(fromName),
        legs,
        extra: null,
      });
    });

    // ─── ROVNAKÁ LOGIKA FILTROVANIA AKO V tryPrintPerTeamTimeline ───
    // Ak je tím ubytovaný a v deň má viac presunov pred prvou udalosťou (zápas/stravovanie),
    // zobrazí sa iba logický presun z ubytovania na miesto prvej udalosti.
    const groupedUi = new Map();
    for (const ev of rawEvents) {
      const key = `${cleanCategory(ev.category)}|${String(ev.teamName).trim()}|${ev.dayKey || ''}`;
      if (!groupedUi.has(key)) groupedUi.set(key, []);
      groupedUi.get(key).push(ev);
    }

    const filteredUiEvents = [];
    for (const [key, events] of groupedUi.entries()) {
      const [cat, team, dk] = key.split('|');

      const firstEvent = pickFirstEventOfDayForTeamUi(cat, team, dk);
      const firstEventPlace = firstEvent ? getPlaceNameFromEventLabelUi(firstEvent) : null;

      const accomKey = `${cat}|${team}`;
      const accommodationName =
        __transportPerTeamBuffer.accommodationByKey.get(accomKey) || null;
      const hasAccommodation =
        accommodationName && accommodationName !== 'bez ubytovania';

      if (!firstEvent && !hasAccommodation) {
        filteredUiEvents.push(...events);
        continue;
      }

      const firstEventTs = firstEvent?.ts ?? Number.POSITIVE_INFINITY;

      const beforeFirst = [];
      const afterFirst = [];
      for (const ev of events) {
        if (ev.sortTs < firstEventTs) beforeFirst.push(ev);
        else afterFirst.push(ev);
      }

      if (beforeFirst.length <= 1) {
        filteredUiEvents.push(...events);
        continue;
      }

      const matching = beforeFirst.filter((ev) =>
        isTransferRelevantForFirstEventUi(
          ev.legs,
          hasAccommodation ? accommodationName : null,
          firstEventPlace
        )
      );

      if (matching.length > 0) {
        matching.sort((a, b) => a.sortTs - b.sortTs);
        filteredUiEvents.push(matching[0], ...afterFirst);
      } else {
        filteredUiEvents.push(...events);
      }
    }
    // ─── koniec filtra ───

    // Spojíme zápasy + stravovanie z buffra s presunmi pre UI, aby sa doplnili časy pre PEŠI
    const transferWrappers = filteredUiEvents.map((ev) => ({
      ...ev,
      kind: 'transfer',
      ts: ev.sortTs,
    }));

    const byTeamForUi = new Map();
    for (const ev of [
      ...(__transportPerTeamBuffer.matches || []),
      ...(__transportPerTeamBuffer.catering || []),
      ...transferWrappers,
    ]) {
      const k = `${cleanCategory(ev.category || '')}|${String(ev.teamName || '').trim()}`;
      if (!byTeamForUi.has(k)) byTeamForUi.set(k, []);
      byTeamForUi.get(k).push(ev);
    }

    const updatedTransfers = [];
    for (const teamEvents of byTeamForUi.values()) {
      const resolved = applyImpliedWalkingTimesFromEvents(teamEvents);
      for (const item of resolved) {
        if (item.kind === 'transfer') {
          updatedTransfers.push(item);
        }
      }
    }

    updatedTransfers.sort((a, b) => {
      if (a.sortTs !== b.sortTs) return a.sortTs - b.sortTs;
      return String(a.title).localeCompare(String(b.title), 'sk');
    });

    return updatedTransfers;
  }, [savedTransfers, buses, selectedDayKey, selectedCategory, selectedTeam, allPlaces, matchesVersion, trackerResolvedNames]);
  
  useEffect(() => {
    const hasAny =
      (timelineEvents && timelineEvents.length > 0) ||
      (__transportPerTeamBuffer.matches && __transportPerTeamBuffer.matches.length > 0) ||
      (__transportPerTeamBuffer.catering && __transportPerTeamBuffer.catering.length > 0);
    if (!hasAny) return;

    // 1) Transfery z UI (už prefiltrované podľa zvolených filtrov)
    const transferEvents = (timelineEvents || []).map((ev) => ({
      kind: 'transfer',
      teamName: String(ev.teamName || '').trim(),
      category: String(ev.category || '').trim(),
      dayKey: ev.dayKey || null,
      ts: ev.sortTs != null && isFinite(ev.sortTs) ? ev.sortTs : Number.POSITIVE_INFINITY,
      sortKey: `${ev.dayKey || ''}|${ev.timeLabel || ''}|${ev.title || ''}`,
      label: `${ev.timeLabel || ''} | ${ev.title || ''} | ${ev.busName || ''}`.trim(),
      legs: ev.legs || [],
      _fromUi: true,
    }));

    // 2) Zápasy a stravovanie z globálneho buffra
    //    Aby rešpektovali filtre (deň / kategória / tím), aplikujeme ich tu.
    const dayFilter = selectedDayKey || null;
    const catFilter = selectedCategory ? cleanCategory(selectedCategory) : null;

    let teamFilterName = null;
    let teamFilterCategory = null;
    if (selectedTeam) {
      const sepIdx = selectedTeam.indexOf('|');
      if (sepIdx >= 0) {
        teamFilterCategory = cleanCategory(selectedTeam.slice(0, sepIdx));
        teamFilterName = selectedTeam.slice(sepIdx + 1).trim();
      } else {
        teamFilterName = selectedTeam.trim();
      }
    }

    const matchesFilter = (ev) => {
      if (catFilter && cleanCategory(ev.category || '') !== catFilter) return false;
      if (teamFilterName && String(ev.teamName || '').trim() !== teamFilterName) return false;
      if (teamFilterCategory && cleanCategory(ev.category || '') !== teamFilterCategory) return false;
      if (dayFilter) {
        if (ev.ts == null || !isFinite(ev.ts)) return false;
        const d = new Date(ev.ts);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (k !== dayFilter) return false;
      }
      return true;
    };

    const matchEvents = (__transportPerTeamBuffer.matches || [])
      .filter(matchesFilter)
      .map((ev) => ({ ...ev, _fromBuffer: true }));

    const cateringEvents = (__transportPerTeamBuffer.catering || [])
      .filter(matchesFilter)
      .map((ev) => ({ ...ev, _fromBuffer: true }));

    const all = [...matchEvents, ...cateringEvents, ...transferEvents];

    // 3) Zoskupenie podľa KATEGÓRIA|TÍM
    const byTeam = new Map();
    for (const ev of all) {
      const rawTeam = String(ev.teamName || '').trim();
      if (!rawTeam) continue;
      // ⬅️ NOVÉ: použi mapovaný názov, ak existuje (rovnako ako v MAPPED výpise)
      const team = __transportPerTeamBuffer.resolvedNames?.[rawTeam] || rawTeam;
      const cat = cleanCategory(ev.category || '');  // ⬅️ cleanCategory namiesto trim
      const key = `${cat}|${team}`;
      if (!byTeam.has(key)) byTeam.set(key, []);
      byTeam.get(key).push(ev);
    }

    // 4) Zoradenie tímov
    const teamsSorted = [...byTeam.keys()].sort((a, b) => {
      const [catA, teamA] = a.split('|');
      const [catB, teamB] = b.split('|');
      const c = String(catA).localeCompare(String(catB), 'sk', { sensitivity: 'base' });
      if (c !== 0) return c;
      return String(teamA).localeCompare(String(teamB), 'sk', { sensitivity: 'base' });
    });

    // 5) Zoradenie udalostí v rámci tímu
    const KIND_PRIORITY = { match: 0, transfer: 1, catering: 2 };
    const output = {};
    for (const key of teamsSorted) {
      const list = byTeam.get(key).slice().sort((a, b) => {
        const aTs = a.ts != null && isFinite(a.ts) ? a.ts : Number.POSITIVE_INFINITY;
        const bTs = b.ts != null && isFinite(b.ts) ? b.ts : Number.POSITIVE_INFINITY;
        if (aTs !== bTs) return aTs - bTs;
        const aP = KIND_PRIORITY[a.kind] ?? 9;
        const bP = KIND_PRIORITY[b.kind] ?? 9;
        if (aP !== bP) return aP - bP;
        return String(a.sortKey || '').localeCompare(String(b.sortKey || ''), 'sk');
      });
      output[key] = list;
    }

    // 6) Signatúra (aby sa výpis zbytočne neopakoval)
    const sig = JSON.stringify(
      Object.fromEntries(
        Object.entries(output).map(([k, list]) => [
          k,
          list.map((ev) => ({
            k: ev.kind,
            ts: ev.ts,
            label: ev.label,
            legs: ev.legs ? ev.legs.map((l) => [l.fromName, l.toName, l.startTime, l.endTime]) : null,
          })),
        ])
      )
    );
    if (sig === window.__lastUiConsoleSig) return;
    window.__lastUiConsoleSig = sig;

    // 7) Výpis
    const filterLabel =
      `deň=${selectedDayKey || 'všetky'} | kategória=${selectedCategory || 'všetky'} | tím=${selectedTeam ? selectedTeam.split('|').slice(-1)[0] : 'všetky'}`;
    console.log(`📅 UI TIMELINE — zápasy + stravovanie + transfery (${filterLabel}):`);

    for (const key of teamsSorted) {
      const list = output[key];
      if (!list || list.length === 0) continue;
      const [cat, team] = key.split('|');
      const accomKey = `${cat}|${team}`;
      const accommodationName =
        __transportPerTeamBuffer.accommodationByKey.get(accomKey) || 'bez ubytovania';

      console.groupCollapsed(`👥 ${team}${cat ? ` (${cat})` : ''} — ${list.length} udalostí — 🏠 ${accommodationName}`);

      const getEventDayKeyForLog = (ev) => {
        if (ev?.dayKey) return String(ev.dayKey);
        if (ev?.ts != null && isFinite(ev.ts)) {
          const d = new Date(ev.ts);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(String(ev?.label || ''));
        if (m) {
          return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
        }
        return '';
      };

      let prevDayKey = '';

      list.forEach((ev, i) => {
        const currDayKey = getEventDayKeyForLog(ev);
        if (prevDayKey && currDayKey && currDayKey !== prevDayKey) {
          console.log('────────────────────────────────────────────────────────────');
        }
        if (currDayKey) {
          prevDayKey = currDayKey;
        }

        if (ev.kind === 'match' || ev.kind === 'catering') {
          console.log(`${i + 1}. ${ev.label}`);
        } else if (ev.kind === 'transfer') {
          const dayDateLabel = (() => {
            if (!ev.dayKey) return '';
            const parts = String(ev.dayKey).split('-');
            if (parts.length !== 3) return String(ev.dayKey);
            return `${parts[2]}. ${parts[1]}. ${parts[0]}`;
          })();

          const head = ev.timeLabel
            ? `${i + 1}. 🚌 ${dayDateLabel ? `${dayDateLabel} | ` : ''}${ev.timeLabel} | ${ev.title}${ev.busName ? ` | ${ev.busName}` : ''}`
            : `${i + 1}. ${ev.label}`;
          console.log(head);

          for (const leg of ev.legs || []) {
            const icon = leg.isWalking ? '🚶' : '🚌';
            const busTxt = leg.isWalking ? 'PEŠI' : (leg.busName || 'PRESUN');
            const t1 = leg.startTime || '--:--';
            const t2 = leg.endTime || '--:--';
            const datePart = dayDateLabel ? `${dayDateLabel} ` : '';
            console.log(`     ${icon} ${busTxt} ${datePart}${t1}–${t2} | ${leg.fromName} → ${leg.toName}`);
          }
        }
      });

      console.groupEnd();
    }
  }, [
    timelineEvents,
    selectedDayKey,
    selectedCategory,
    selectedTeam,
    matchesVersion,
    trackerResolvedNames,
    // signatúra buffrov sa mení pri každom naplnení — aby sa výpis obnovil
    __transportPerTeamBuffer.matches.length,
    __transportPerTeamBuffer.catering.length,
    __transportPerTeamBuffer.accommodationByKey.size,
  ]);

  /* --- Skupiny podľa dňa --- */
  const eventsByDay = useMemo(() => {
    const map = {};
    timelineEvents.forEach((e) => {
      const dk = e.dayKey || 'neznamy';
      if (!map[dk]) map[dk] = [];
      map[dk].push(e);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.sortTs - b.sortTs));
    return map;
  }, [timelineEvents]);

  /* -------------------- Render: loading -------------------- */
  if (loading) {
    return React.createElement('div', { className: 'flex justify-center pt-16' },
      React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
    );
  }

  const dayKeys = Object.keys(eventsByDay).sort();

  /* -------------------- Render: hlavička -------------------- */
  const headerSection = React.createElement('div', { className: 'mb-6' },
    React.createElement('h1', { className: 'text-2xl font-bold text-gray-800 flex items-center gap-2' },
      React.createElement('i', { className: 'fa-solid fa-bus text-blue-600' }),
      'Doprava'
    )
  );

  /* -------------------- Render: filtre -------------------- */
  const filtersSection = React.createElement('div', { className: 'bg-white rounded-lg shadow p-4 mb-6 border border-gray-200' },
    React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
      React.createElement('div', null,
        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Deň'),
        React.createElement('select', {
          className: 'w-full border border-gray-300 rounded px-3 py-2 text-sm',
          value: selectedDayKey,
          onChange: (e) => setSelectedDayKey(e.target.value),
        },
          React.createElement('option', { value: '' }, 'Všetky dni'),
          ...tournamentDays.map((d) =>
            React.createElement('option', { key: d.dayKey, value: d.dayKey }, `${d.dateLabel} (${d.dayName})`)
          )
        )
      ),
      React.createElement('div', null,
        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Kategória'),
        React.createElement('select', {
          className: 'w-full border border-gray-300 rounded px-3 py-2 text-sm',
          value: selectedCategory,
          onChange: (e) => setSelectedCategory(e.target.value),
        },
          React.createElement('option', { value: '' }, 'Všetky kategórie'),
          ...availableCategories.map((c) => React.createElement('option', { key: c, value: c }, c))
        )
      ),
      React.createElement('div', null,
        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Tím'),
        React.createElement('select', {
          className: 'w-full border border-gray-300 rounded px-3 py-2 text-sm',
          value: selectedTeam,
          onChange: (e) => setSelectedTeam(e.target.value),
        },
          React.createElement('option', { value: '' }, 'Všetky tímy'),
          ...availableTeams.map((t) => {
            const [cat, name] = t.split('|');
            return React.createElement('option', { key: t, value: t }, `${name} (${cat})`);
          })
        )
      )
    )
  );

  /* -------------------- Render: prázdny stav -------------------- */
  const emptySection = React.createElement('div', { className: 'bg-white rounded-lg shadow p-12 text-center text-gray-500' },
    React.createElement('i', { className: 'fa-solid fa-inbox text-4xl mb-3 text-gray-300' }),
    React.createElement('p', null, 'Žiadne udalosti pre zvolené filtre.')
  );

  /* -------------------- Render: jedna udalosť -------------------- */
  const renderEvent = (ev) => {
    const color = EVENT_COLORS[ev.typeKey] || EVENT_COLORS.transfer_unassigned;

    const hasWalkingLeg = !!(ev.legs && ev.legs.some((l) => l.isWalking));

    const isSingleWalkingNoTime =
      ev.legs &&
      ev.legs.length === 1 &&
      ev.legs[0].isWalking === true &&
      !ev.legs[0].startTime &&
      !ev.legs[0].endTime;

    const legsBlock = (ev.legs && ev.legs.length > 0)
      ? React.createElement('div', { className: 'mt-2 pl-2 border-l-2 border-gray-200 space-y-1' },
          React.createElement('div', { className: 'flex items-center gap-2 text-[10px] uppercase tracking-wide text-gray-400 pb-1' },
            React.createElement('span', { className: 'w-4 flex-shrink-0' }, ''),
            React.createElement('span', { className: 'w-20 flex-shrink-0' }, 'Typ'),
            React.createElement('span', { className: 'w-16 flex-shrink-0' }, isSingleWalkingNoTime ? '' : 'Čas'),
            React.createElement('span', { className: 'w-1/3 min-w-0' }, 'Odkiaľ'),
            React.createElement('span', { className: 'w-16 flex-shrink-0' }, isSingleWalkingNoTime ? '' : 'Čas'),
            React.createElement('span', { className: 'w-1/3 min-w-0' }, 'Kam'),
            React.createElement('span', { className: 'w-1/3 min-w-0' }, (hasWalkingLeg && !isSingleWalkingNoTime) ? 'Poznámka' : '')
          ),
          ...ev.legs.map((leg, idx) => {
            const legIcon = leg.isWalking ? 'fa-person-walking text-amber-600' : 'fa-bus text-blue-600';

            const legBusLabelText = leg.isWalking
              ? 'PEŠI'
              : (leg.busName || '');

            const startTimeText = leg.startTime || '';
            const endTimeText = leg.endTime || '';

            const isSingleWalkingNoTimeRow =
              ev.legs.length === 1 &&
              leg.isWalking === true &&
              !leg.startTime &&
              !leg.endTime;

            const displayStartTime = isSingleWalkingNoTimeRow ? '' : (startTimeText || '--:--');
            const displayEndTime = isSingleWalkingNoTimeRow ? '' : (endTimeText || '--:--');

            const legBusLabel = React.createElement('span', {
              className: `text-xs font-medium w-20 flex-shrink-0 truncate ${leg.isWalking ? 'text-amber-700 italic' : 'text-blue-700'}`,
            }, legBusLabelText);

            const noteText = (leg.isWalking && !isSingleWalkingNoTimeRow)
              ? 'Disponibilný čas na presun peši'
              : '';

            return React.createElement('div', {
              key: idx,
              className: 'flex items-center gap-2 text-xs text-gray-600',
            },
              React.createElement('span', { className: 'w-4 flex-shrink-0 text-center' },
                React.createElement('i', { className: `fa-solid ${legIcon}` })
              ),
              legBusLabel,
              React.createElement('span', { className: 'font-mono w-16 flex-shrink-0 text-gray-700' }, displayStartTime),
              React.createElement('span', { className: 'text-gray-500 w-1/3 min-w-0 truncate' }, leg.fromName),
              React.createElement('span', { className: 'font-mono w-16 flex-shrink-0 text-gray-700' }, displayEndTime),
              React.createElement('span', { className: 'text-gray-500 w-1/3 min-w-0 truncate' }, leg.toName),
              React.createElement('span', { className: 'text-gray-400 italic w-1/3 min-w-0 truncate' }, noteText)
            );
          })
        )
      : null;

    return React.createElement('div', {
      key: ev.id,
      className: 'px-5 py-3 hover:bg-gray-50 transition-colors',
    },
      React.createElement('div', { className: 'flex-1 min-w-0' },
        (() => {
          const catColor = ev.category
            ? (transportColorsRef.current[ev.category] || transportColorsRef.current[ev.categoryId] || null)
            : null;

          let badgeBg = undefined;
          if (catColor) {
            const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(catColor.trim());
            badgeBg = isHex ? `${catColor.trim()}20` : `color-mix(in srgb, ${catColor} 12%, white)`;
          }

          const badgeStyle = catColor
            ? { color: catColor, backgroundColor: badgeBg }
            : undefined;

          return (ev.category || ev.teamName)
            ? React.createElement('div', { className: 'flex items-center gap-2 flex-wrap mb-1' },
                ev.category
                  ? React.createElement('span', {
                      className: 'text-xs px-2 py-0.5 rounded font-medium border',
                      style: badgeStyle
                        ? { ...badgeStyle, borderColor: catColor }
                        : { backgroundColor: '#f3f4f6', color: '#4b5563', borderColor: '#e5e7eb' },
                    }, ev.category)
                  : null,
                ev.teamName
                  ? React.createElement('span', {
                      className: 'text-xs px-2 py-0.5 rounded font-medium border',
                      style: badgeStyle
                        ? { ...badgeStyle, borderColor: catColor }
                        : { backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#dbeafe' },
                    }, ev.teamName)
                  : null
              )
            : null;
        })(),
        React.createElement('div', { className: `font-medium ${color.text}` }, ev.title),
        legsBlock
      )
    );
  };

  /* -------------------- Render: jeden deň -------------------- */
  const renderDay = (dayKey) => {
    const dayMeta = tournamentDays.find((d) => d.dayKey === dayKey);
    const dayLabel = dayMeta ? `${dayMeta.dateLabel} (${dayMeta.dayName})` : dayKey;
    const dayEvents = eventsByDay[dayKey];

    return React.createElement('div', {
      key: dayKey,
      className: 'bg-white rounded-lg shadow border border-gray-200 overflow-hidden',
    },
      React.createElement('div', { className: 'bg-gradient-to-r from-blue-600 to-blue-500 text-white px-5 py-3 flex items-center justify-between' },
        React.createElement('h2', { className: 'text-lg font-semibold flex items-center gap-2' },
          React.createElement('i', { className: 'fa-regular fa-calendar' }),
          dayLabel
        )
      ),
      React.createElement('div', { className: 'divide-y divide-gray-100' },
        ...dayEvents.map((ev) => renderEvent(ev))
      )
    );
  };

  /* -------------------- Render: timeline -------------------- */
  const timelineSection = dayKeys.length === 0
    ? emptySection
    : React.createElement('div', { className: 'space-y-8' },
        ...dayKeys.map(renderDay)
      );

  /* -------------------- Render: root -------------------- */
  return React.createElement('div', { className: 'p-4 max-w-7xl mx-auto' },
    headerSection,
    filtersSection,
    timelineSection
  );
};

/* ------------------------------------------------------------------ */
/* Export / mount                                                     */
/* ------------------------------------------------------------------ */

export default function Transport({ userProfileData }) {
  return React.createElement(TransportApp, { userProfileData });
}

/* ------------------------------------------------------------------ */
/* Auto-mount do #root (ak ešte nie je namountovaný)                  */
/* ------------------------------------------------------------------ */

const rootEl = document.getElementById('root');

if (rootEl && !rootEl.dataset.reactMounted) {
  const tryMount = () => {
    if (!window.db) {
      setTimeout(tryMount, 200);
      return;
    }

    const userProfileData = window.currentUserProfile || window.userProfileData || null;

    rootEl.dataset.reactMounted = 'true';

    const root = ReactDOM.createRoot(rootEl);
    root.render(React.createElement(Transport, { userProfileData }));
  };

  tryMount();
}

// ========== LOKÁLNY PREPÍNAČ PRE LOGOVANIE LEN PRE TENTO SÚBOR ==========
const DEBUG_MODE = true;  // false = nevypisuje sa, true = vypisuje sa

// Uložíme pôvodné globálne funkcie PREDTÝM, než ich niekto prepíše
const originalConsoleLog = console.log;
const originalConsoleDebug = console.debug;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Vytvoríme LOKÁLNE aliasy, ktoré budeme používať v tomto súbore
let localLog = originalConsoleLog;
let localDebug = originalConsoleDebug;
let localInfo = originalConsoleInfo;
let localWarn = originalConsoleWarn;
let localError = originalConsoleError;

// Podľa DEBUG_MODE prepíšeme LOKÁLNE funkcie, nie globálne
if (!DEBUG_MODE) {
    localLog = function() {};
    localDebug = function() {};
    localInfo = function() {};
    // localWarn a localError nechávame pre dôležité chyby
}

// Pomocné funkcie pre jednoduchšie používanie (volajú LOKÁLNE verzie)
// DÔLEŽITÉ: Používame FUNCTION DECLARATIONS, nie ARROW FUNCTIONS
// a voláme IBA lokálne premenné, nie rekurzívne samých seba
function log(...args) { 
    if (localLog) localLog(...args); 
}
function debug(...args) { 
    if (localDebug) localDebug(...args); 
}
function info(...args) { 
    if (localInfo) localInfo(...args); 
}
function warn(...args) { 
    if (localWarn) localWarn(...args); 
}
function error(...args) { 
    if (localError) localError(...args); 
}

// ============================================================
// OD TOHTO MIESTA POKRAČUJE PÔVODNÝ KÓD, ALE VŠETKY log
// TREBA NAHRADIŤ ZA log(), warn ZA warn(), atď.
// ============================================================

// Teraz v celom kóde používame tieto funkcie namiesto priamo log ---------------- všetko pred týmto riadkom vymaž

// Premenné pre nahrádzanie
let hasReplacedAnyTeams = false;
let mappingCompleted = false;
let initialMappingDone = false;
const replacementCallbacks = [];

// Cache pre skupiny
let groupCheckCache = new Set();
let processedCarryOverGroups = new Set();
let isInitialDataLoaded = false;
let processedGroupsInitial = new Set();

// Premenné pre periodické úlohy
let periodicReplaceInterval = null;
let periodicReplaceActive = true;
let groupMonitorInterval = null;
let isReplacingInProgress = false;

// Cache pre mapovanie
let processedGroups = new Map();
let pendingReplaceTimeout = null;
let replacedIdentifiers = new Set();
let checkedGroupsCache = new Set();

// Snapshot pre sledovanie
let groupCompletionSnapshot = new Map();

let isMappingNotificationSent = false;
let isTeamNameReplacerInitialized = false;

(function() {
    'use strict';
    
    log('=== SPÚŠŤAM SLEDOVANIE ZÁPASOV (MÓD: TABUĽKA SKUPÍN) ===');
    
    let unsubscribeMatches = null;
    let unsubscribeEvents = {};
    let matchesData = {};
    let eventsData = {};
    let tableSettings = { sortingConditions: [] }; // Uloženie nastavení poradia

    function looksLikeIdentifier(str) {
        if (!str || typeof str !== 'string') return false;
        return /[0-9]+[A-Za-z]+|[A-Za-z]+[0-9]+/.test(str);
    }
    
    // Funkcia na formátovanie času
    function formatMatchTime(seconds) {
        if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
            return '00:00';
        }
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Funkcia na získanie stavu zápasu v slovenčine
    function getStatusText(status) {
        switch (status) {
            case 'scheduled': return '📅 Naplánované';
            case 'in-progress': return '▶️ Prebieha';
            case 'paused': return '⏸️ Pozastavené';
            case 'completed': return '✅ Odohrané';
            default: return '❓ Neznámy';
        }
    }
    
    // Funkcia na získanie aktuálneho skóre z udalostí (pomocou scoreAfter)
    function getCurrentScore(events) {
        if (!events || events.length === 0) {
            return { home: 0, away: 0 };
        }
        
        const sortedEvents = [...events].sort((a, b) => {
            if (a.minute !== b.minute) return (a.minute || 0) - (b.minute || 0);
            return (a.second || 0) - (b.second || 0);
        });
        
        const lastEvent = sortedEvents[sortedEvents.length - 1];
        
        if (lastEvent.scoreAfter) {
            return {
                home: lastEvent.scoreAfter.home || 0,
                away: lastEvent.scoreAfter.away || 0
            };
        }
        
        let homeScore = 0;
        let awayScore = 0;
        
        sortedEvents.forEach(event => {
            if (event.type === 'goal') {
                if (event.team === 'home') homeScore++;
                else if (event.team === 'away') awayScore++;
            } else if (event.type === 'penalty' && event.subType === 'scored') {
                if (event.team === 'home') homeScore++;
                else if (event.team === 'away') awayScore++;
            }
        });
        
        return { home: homeScore, away: awayScore };
    }
    
    // Funkcia na získanie podrobného detailu zápasu
    function getMatchDetails(matchId) {
        const match = matchesData[matchId];
        if (!match) {
            return null;
        }
        
        const events = eventsData[matchId] || [];
        const { home: homeScore, away: awayScore } = getCurrentScore(events);
        const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null;
        
        const homeTeamName = window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier;
        const awayTeamName = window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier;
        
        return {
            id: match.id,
            homeTeamId: match.homeTeamIdentifier,
            homeTeamName: homeTeamName,
            awayTeamId: match.awayTeamIdentifier,
            awayTeamName: awayTeamName,
            homeScore: homeScore,
            awayScore: awayScore,
            category: match.categoryName || 'neurčená',
            group: match.groupName || 'neurčená',
            date: matchDate,
            dateStr: matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený',
            status: match.status,
            isCompleted: match.status === 'completed'
        };
    }
    
    // Funkcia na získanie všetkých zápasov (aj neodohraných)
    function getAllMatches() {
        return Object.values(matchesData);
    }
    
    // Funkcia na získanie odohraných zápasov
    function getCompletedMatches() {
        return Object.values(matchesData).filter(m => m.status === 'completed');
    }
    
    function getCompletedGroupMatches(categoryName, groupName) {
        return Object.values(matchesData).filter(match => 
            match.categoryName === categoryName && 
            match.groupName === groupName && 
            match.status === 'completed' &&
            !match.isPlacementMatch  // ← PRIDANÉ: VYNECHÁME ZÁPASY O UMIESTNENIE
        );
    }
    
    // Funkcia na výpočet vzájomného zápasu medzi dvoma tímami
    function calculateHeadToHead(teamAId, teamBId, groupMatches) {
        // 🔥 KONTROLA TYPOV - ak sú to objekty, extrahujeme id alebo name
        let teamAIdentifier = teamAId;
        let teamBIdentifier = teamBId;
        
        if (typeof teamAId === 'object' && teamAId !== null) {
            teamAIdentifier = teamAId.id || teamAId.name || String(teamAId);
        }
        if (typeof teamBId === 'object' && teamBId !== null) {
            teamBIdentifier = teamBId.id || teamBId.name || String(teamBId);
        }
        
        // Konverzia na string a ošetrenie null/undefined
        const strA = String(teamAIdentifier || '');
        const strB = String(teamBIdentifier || '');
        
        if (!strA || !strB) {
            return { teamAScore: 0, teamBScore: 0, teamAWins: 0, teamBWins: 0 };
        }
        
        let teamAScore = 0;
        let teamBScore = 0;
        let teamAWins = 0;
        let teamBWins = 0;
        
        // Odstránenie bielych znakov pre porovnanie
        const cleanA = strA.trim();
        const cleanB = strB.trim();
        
        groupMatches.forEach(match => {
            // Preskočíme zápasy o umiestnenie
            if (match.isPlacementMatch) return;
            
            const homeId = match.homeTeamIdentifier ? String(match.homeTeamIdentifier).trim() : '';
            const awayId = match.awayTeamIdentifier ? String(match.awayTeamIdentifier).trim() : '';
            
            // Kontrola, či zápas obsahuje oba tímy (podľa identifikátorov ALEBO podľa mien)
            const hasTeamA = (homeId === cleanA || awayId === cleanA || 
                              match.homeTeamName === cleanA || match.awayTeamName === cleanA);
            const hasTeamB = (homeId === cleanB || awayId === cleanB ||
                              match.homeTeamName === cleanB || match.awayTeamName === cleanB);
            
            if (hasTeamA && hasTeamB) {
                let homeScore = 0, awayScore = 0;
                
                // Najprv skús manuálny výsledok
                if (match.finalScore && !match.forfeitResult) {
                    homeScore = match.finalScore.home || 0;
                    awayScore = match.finalScore.away || 0;
                } else if (match.forfeitResult?.isForfeit) {
                    homeScore = match.forfeitResult.home || 0;
                    awayScore = match.forfeitResult.away || 0;
                } else {
                    const events = eventsData[match.id] || [];
                    const score = getCurrentScore(events);
                    homeScore = score.home;
                    awayScore = score.away;
                }
                
                // Zistíme, ktorý tím je domáci a ktorý hosť
                const isTeamADomaci = (homeId === cleanA || match.homeTeamName === cleanA);
                
                if (isTeamADomaci) {
                    teamAScore = homeScore;
                    teamBScore = awayScore;
                } else {
                    teamAScore = awayScore;
                    teamBScore = homeScore;
                }
                
                if (teamAScore > teamBScore) {
                    teamAWins = 1;
                    teamBWins = 0;
                } else if (teamBScore > teamAScore) {
                    teamAWins = 0;
                    teamBWins = 1;
                } else {
                    teamAWins = 0;
                    teamBWins = 0;
                }
            }
        });
        
        return { teamAScore, teamBScore, teamAWins, teamBWins };
    }
    
    // Funkcia na porovnanie dvoch tímov podľa nastavených kritérií (až po zohľadnení bodov)
    function compareTeams(teamA, teamB, groupMatches, sortingConditions) {
        // 🔥 KONTROLA TYPOV - ak sú to objekty, extrahujeme potrebné hodnoty
        let teamAPoints = teamA.points || 0;
        let teamBPoints = teamB.points || 0;
        
        let teamAGoalDiff = teamA.goalDifference !== undefined ? teamA.goalDifference : (teamA.goalsFor - teamA.goalsAgainst);
        let teamBGoalDiff = teamB.goalDifference !== undefined ? teamB.goalDifference : (teamB.goalsFor - teamB.goalsAgainst);
        
        let teamAGoalsFor = teamA.goalsFor || 0;
        let teamBGoalsFor = teamB.goalsFor || 0;
        
        let teamAGoalsAgainst = teamA.goalsAgainst || 0;
        let teamBGoalsAgainst = teamB.goalsAgainst || 0;
        
        let teamAWins = teamA.wins || 0;
        let teamBWins = teamB.wins || 0;
        
        let teamALosses = teamA.losses || 0;
        let teamBLosses = teamB.losses || 0;
        
        // Pre vzájomný zápas potrebujeme identifikátory
        let teamAId = teamA.id || teamA.name || String(teamA);
        let teamBId = teamB.id || teamB.name || String(teamB);
        
        // 1. Najprv porovnáme podľa bodov
        if (teamAPoints !== teamBPoints) {
            return teamBPoints - teamAPoints; // Viac bodov = lepšie
        }
    
        // 2. Ak sú body rovnaké, použijeme nastavené kritériá
        if (sortingConditions && sortingConditions.length > 0) {
            for (const condition of sortingConditions) {
                const { parameter, direction } = condition;
                let comparison = 0;
                
                switch (parameter) {
                    case 'headToHead':
                        const { teamAScore, teamBScore, teamAWins: h2hWinsA, teamBWins: h2hWinsB } = 
                            calculateHeadToHead(teamAId, teamBId, groupMatches);
                        
                        if (h2hWinsA !== h2hWinsB) {
                            if (direction === 'desc') {
                                comparison = h2hWinsB - h2hWinsA;
                            } else {
                                comparison = h2hWinsA - h2hWinsB;
                            }
                        } else if (teamAScore !== teamBScore) {
                            if (direction === 'desc') {
                                comparison = teamBScore - teamAScore;
                            } else {
                                comparison = teamAScore - teamBScore;
                            }
                        }
                        break;
                    
                    case 'scoreDifference':
                        if (direction === 'desc') {
                            comparison = teamBGoalDiff - teamAGoalDiff;
                        } else {
                            comparison = teamAGoalDiff - teamBGoalDiff;
                        }
                        break;
                        
                    case 'goalsScored':
                        if (direction === 'desc') {
                            comparison = teamBGoalsFor - teamAGoalsFor;
                        } else {
                            comparison = teamAGoalsFor - teamBGoalsFor;
                        }
                        break;
                        
                    case 'goalsConceded':
                        if (direction === 'asc') {
                            comparison = teamAGoalsAgainst - teamBGoalsAgainst;
                        } else {
                            comparison = teamBGoalsAgainst - teamAGoalsAgainst;
                        }
                        break;
                    
                    case 'wins':
                        if (direction === 'desc') {
                            comparison = teamBWins - teamAWins;
                        } else {
                            comparison = teamAWins - teamBWins;
                        }
                        break;
                    
                    case 'losses':
                        if (direction === 'asc') {
                            comparison = teamALosses - teamBLosses;
                        } else {
                            comparison = teamBLosses - teamALosses;
                        }
                        break;
                    
                    case 'draw':
                        comparison = 0;
                        break;
                        
                    default:
                        comparison = 0;
                }
            
                if (comparison !== 0) return comparison;
            }
        }
        
        // 3. Ak sú všetky kritériá rovnaké, použijeme abecedné poradie
        const nameA = teamA.name || String(teamA);
        const nameB = teamB.name || String(teamB);
        return nameA.localeCompare(nameB);
    }

    let cachedPointsForWin = 3; // Predvolená hodnota (pre prípad, že sa nenájde v DB)
    let pointsForWinLoaded = false;

    async function loadPointsForWin() {
        if (!window.db) return 3;
        
        try {
            const { doc, getDoc } = window.firebaseModules || await importFirebaseModules();
            if (!doc) return 3;
            
            const settingsDocRef = doc(window.db, 'settings', 'table');
            const settingsDoc = await getDoc(settingsDocRef);
            
            if (settingsDoc.exists()) {
                const data = settingsDoc.data();
                cachedPointsForWin = data.pointsForWin || 3;
            } else {
                cachedPointsForWin = 3;
            }
        
            pointsForWinLoaded = true;
            log(`📋 Načítané body za výhru z databázy: ${cachedPointsForWin} bodov`);
            return cachedPointsForWin;
        } catch (error) {
            error('❌ Chyba pri načítaní bodov za výhru:', error);
            return 3;
        }
    }

    // Synchronná verzia pre prípady, keď už je hodnota načítaná
    function getPointsForWinSync() {
        return cachedPointsForWin;
    }

    // Spustíme načítanie hneď
    loadPointsForWin().catch(error);

    // ============================================================
    // OPRAVENÁ FUNKCIA: findMatchBetweenTeamsInOtherGroup - S KONTROLOU SKUPINY
    // ============================================================
    function findMatchBetweenTeamsInOtherGroup(teamAName, teamBName, currentCategory, currentGroupName, excludeGroupName) {
        if (!window.matchTracker) {
            return null;
        }
        
        log(`   🔍 Hľadám zápas medzi: "${teamAName}" vs "${teamBName}"`);
        
        // 🔥 KROK 0: Extrahujeme písmeno skupiny z názvov tímov
        // Očakávaný formát: "Kategória X Y" kde posledná časť je "3A" alebo "A3"
        function extractGroupLetter(teamName) {
            if (!teamName) return null;
            
            const parts = teamName.trim().split(' ');
            if (parts.length < 2) return null;
            
            const lastPart = parts[parts.length - 1];
            
            // Formát "3A" (číslo + písmeno)
            const numberFirstMatch = lastPart.match(/^(\d+)([A-Za-z]+)$/);
            if (numberFirstMatch) {
                return numberFirstMatch[2].toUpperCase();
            }
            
            // Formát "A3" (písmeno + číslo)
            const letterFirstMatch = lastPart.match(/^([A-Za-z]+)(\d+)$/);
            if (letterFirstMatch) {
                return letterFirstMatch[1].toUpperCase();
            }
            
            return null;
        }
        
        const groupLetterA = extractGroupLetter(teamAName);
        const groupLetterB = extractGroupLetter(teamBName);
        
        log(`   📍 Skupina A: "${groupLetterA}", Skupina B: "${groupLetterB}"`);
        
        // 🔥 KONTROLA: Ak tímy pochádzajú z rôznych základných skupín, nemôže medzi nimi byť zápas
        if (groupLetterA && groupLetterB && groupLetterA !== groupLetterB) {
            log(`   ⚠️ Tímy pochádzajú z RÔZNYCH základných skupín (${groupLetterA} vs ${groupLetterB}) - zápas neexistuje!`);
            return null;
        }
        
        // Ak je skupina rovnaká alebo nevieme určiť, pokračujeme v hľadaní
        log(`   ✅ Tímy pochádzajú z rovnakej skupiny (${groupLetterA || 'neznáma'}), pokračujem v hľadaní...`);
        
        // 🔥 KROK 1: Najprv zmapujeme vstupné názvy na reálne názvy tímov
        let mappedTeamA = teamAName;
        let mappedTeamB = teamBName;        
        
        if (looksLikeIdentifier(teamAName)) {
            const mapped = getTeamNameByDisplayId(teamAName);
            if (mapped && mapped !== teamAName) {
                mappedTeamA = mapped;
                log(`   🔄 Mapovanie A: "${teamAName}" → "${mappedTeamA}"`);
            }
        }
        
        if (looksLikeIdentifier(teamBName)) {
            const mapped = getTeamNameByDisplayId(teamBName);
            if (mapped && mapped !== teamBName) {
                mappedTeamB = mapped;
                log(`   🔄 Mapovanie B: "${teamBName}" → "${mappedTeamB}"`);
            }
        }
        
        // Získame všetky zápasy
        const allMatches = window.matchTracker.getAllMatches?.() || [];
        
        // Pre každý zápas si predpočítame mapované názvy tímov
        for (const match of allMatches) {
            // Preskočíme zápasy o umiestnenie
            if (match.isPlacementMatch) continue;
            
            // Preskočíme aktuálnu skupinu (ak je zadaná)
            if (excludeGroupName && match.categoryName === currentCategory && match.groupName === excludeGroupName) continue;
            
            // Získame pôvodné identifikátory
            let homeIdentifier = match.homeTeamIdentifier;
            let awayIdentifier = match.awayTeamIdentifier;
            
            // Mapujeme na reálne názvy pre porovnanie
            let homeTeamName = homeIdentifier;
            let awayTeamName = awayIdentifier;
            
            if (window.matchTracker.getTeamNameByDisplayId) {
                const mappedHome = window.matchTracker.getTeamNameByDisplayId(homeIdentifier);
                if (mappedHome && mappedHome !== homeIdentifier) {
                    homeTeamName = mappedHome;
                }
                
                const mappedAway = window.matchTracker.getTeamNameByDisplayId(awayIdentifier);
                if (mappedAway && mappedAway !== awayIdentifier) {
                    awayTeamName = mappedAway;
                }
            }
            
            // Porovnávame pomocou zmapovaných názvov
            const hasTeamA = (homeTeamName === mappedTeamA || awayTeamName === mappedTeamA);
            const hasTeamB = (homeTeamName === mappedTeamB || awayTeamName === mappedTeamB);
            
            if (hasTeamA && hasTeamB) {
                log(`      ✅ Nájdený zápas v skupine: ${match.groupName} (stav: ${match.status})`);
                log(`         Domáci: ${homeTeamName} (${homeIdentifier})`);
                log(`         Hostia: ${awayTeamName} (${awayIdentifier})`);
                
                if (match.status === 'completed') {
                    const events = window.matchTracker.getEvents?.(match.id) || [];
                    const { home: homeScore, away: awayScore } = getCurrentScore(events);
                    
                    let teamAScore = 0;
                    let teamBScore = 0;
                    
                    if (homeTeamName === mappedTeamA) {
                        teamAScore = homeScore;
                        teamBScore = awayScore;
                    } else {
                        teamAScore = awayScore;
                        teamBScore = homeScore;
                    }
                    
                    log(`      ✅ POUŽITÝ výsledok: ${teamAScore}:${teamBScore}`);
                    
                    return {
                        matchId: match.id,
                        fromGroup: match.groupName,
                        homeScore: teamAScore,
                        awayScore: teamBScore,
                        homeTeam: homeTeamName,
                        awayTeam: awayTeamName,
                        isTransferred: true
                    };
                } else {
                    log(`      ⏳ Zápas nie je dokončený (stav: ${match.status})`);
                    return null;
                }
            }
        }
        
        log(`      ❌ Žiadny dokončený zápas medzi "${teamAName}" a "${teamBName}" nebol nájdený.`);
        return null;
    }

    function findCrossGroupMatch(teamAName, teamBName, categoryName) {
        // 🔥 POUŽIJEME LOKÁLNU getAllMatches() NIE window.matchTracker.getAllMatches()
        const allMatches = getAllMatches();  // ← TOTO JE SPRÁVNE
        
        if (!allMatches || allMatches.length === 0) {
            log(`   ⚠️ [findCrossGroupMatch] Žiadne zápasy v databáze`);
            return null;
        }
        
        log(`   🔍 [findCrossGroupMatch] Hľadám zápas medzi: "${teamAName}" a "${teamBName}" v kategórii ${categoryName}`);
        
        for (const match of allMatches) {
            // Preskočíme zápasy o umiestnenie
            if (match.isPlacementMatch) continue;
            
            // Kontrola kategórie
            if (match.categoryName !== categoryName) continue;
            
            // Získame názvy tímov v zápase (mapped)
            let homeName = match.homeTeamIdentifier;
            let awayName = match.awayTeamIdentifier;
            
            // 🔥 POUŽIJEME getTeamNameByDisplayId (dostupná cez closure)
            if (typeof getTeamNameByDisplayId === 'function') {
                const mappedHome = getTeamNameByDisplayId(match.homeTeamIdentifier);
                if (mappedHome && mappedHome !== match.homeTeamIdentifier) {
                    homeName = mappedHome;
                }
                
                const mappedAway = getTeamNameByDisplayId(match.awayTeamIdentifier);
                if (mappedAway && mappedAway !== match.awayTeamIdentifier) {
                    awayName = mappedAway;
                }
            }
            
            // Kontrola, či zápas obsahuje oba hľadané kluby
            const hasTeamA = (homeName === teamAName || awayName === teamAName);
            const hasTeamB = (homeName === teamBName || awayName === teamBName);
            
            if (hasTeamA && hasTeamB) {
                log(`   ✅ [findCrossGroupMatch] Nájdený zápas: ${homeName} vs ${awayName} (skupina: ${match.groupName}, stav: ${match.status})`);
                
                if (match.status === 'completed') {
                    let homeScore = 0, awayScore = 0;
                    
                    if (match.finalScore && !match.forfeitResult) {
                        homeScore = match.finalScore.home || 0;
                        awayScore = match.finalScore.away || 0;
                    } else if (match.forfeitResult?.isForfeit) {
                        homeScore = match.forfeitResult.home || 0;
                        awayScore = match.forfeitResult.away || 0;
                    } else {
                        // 🔥 POUŽIJEME LOKÁLNE eventsData
                        const events = eventsData[match.id] || [];
                        const score = getCurrentScore(events);
                        homeScore = score.home;
                        awayScore = score.away;
                    }
                    
                    const isTeamADomaci = (homeName === teamAName);
                    
                    log(`   ✅ [findCrossGroupMatch] Výsledok: ${isTeamADomaci ? homeScore : awayScore}:${isTeamADomaci ? awayScore : homeScore}`);
                    
                    return {
                        groupName: match.groupName,
                        status: match.status,
                        homeTeamName: homeName,
                        awayTeamName: awayName,
                        homeScore: isTeamADomaci ? homeScore : awayScore,
                        awayScore: isTeamADomaci ? awayScore : homeScore
                    };
                } else {
                    log(`   ⏳ [findCrossGroupMatch] Zápas nie je dokončený (stav: ${match.status})`);
                    return null;
                }
            }
        }
        
        log(`   ❌ [findCrossGroupMatch] Žiadny dokončený zápas medzi "${teamAName}" a "${teamBName}" nebol nájdený.`);
        return null;
    }

    function getTeamsInGroupFromAllMatchesWithPairTracking(groupMatches, categoryName, groupName) {
        const teamsMap = new Map();
        const teamPairsPlayed = new Set(); // Sledujeme, ktoré páry už mali zápas v tejto skupine
        
        groupMatches.forEach(match => {
            // PRESKOČÍME ZÁPASY O UMIESTNENIE
            if (match.isPlacementMatch) return;
            
            const homeTeamId = match.homeTeamIdentifier;
            const awayTeamId = match.awayTeamIdentifier;
            
            // Zaznamenáme, že tento pár tímov už hral v tejto skupine
            const pairKey = `${homeTeamId}|${awayTeamId}`;
            const reversePairKey = `${awayTeamId}|${homeTeamId}`;
            teamPairsPlayed.add(pairKey);
            teamPairsPlayed.add(reversePairKey);
            
            if (!teamsMap.has(homeTeamId)) {
                teamsMap.set(homeTeamId, {
                    id: homeTeamId,
                    name: window.teamManager?.getTeamNameByDisplayIdSync?.(homeTeamId) || homeTeamId,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0,
                    // PRIDANÉ: Zoznam tímov, proti ktorým už hral v tejto skupine
                    opponentsInThisGroup: new Set()
                });
            }
            
            if (!teamsMap.has(awayTeamId)) {
                teamsMap.set(awayTeamId, {
                    id: awayTeamId,
                    name: window.teamManager?.getTeamNameByDisplayIdSync?.(awayTeamId) || awayTeamId,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0,
                    opponentsInThisGroup: new Set()
                });
            }
            
            // Pridáme súperov do zoznamu
            teamsMap.get(homeTeamId).opponentsInThisGroup.add(awayTeamId);
            teamsMap.get(awayTeamId).opponentsInThisGroup.add(homeTeamId);
        });
        
        return {
            teams: Array.from(teamsMap.values()),
            teamPairsPlayed: teamPairsPlayed
        };
    }

    function getTeamsBaseOrder(categoryName, groupName) {
        // Získame tímy z globálneho stavu (z druhého kódu)
        const allTeams = window.__allTeamsState || [];
    
        // Vyfiltrujeme tímy v danej kategórii a skupine
        const teamsInGroup = allTeams.filter(team => 
            team.category === categoryName && 
            team.groupName === groupName &&
            typeof team.order === 'number' && team.order > 0
        );
    
        // Zoradíme podľa order
        const sortedTeams = [...teamsInGroup].sort((a, b) => a.order - b.order);
        
        // Transformujeme do formátu, ktorý používa tabuľka
        return sortedTeams.map(team => ({
            id: team.id,
            name: team.teamName,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0,
            goalDifference: 0,
            // Uložíme pôvodné poradie pre prípad potreby
            baseOrder: team.order
        }));
    }
    
    // Funkcia na získanie všetkých tímov v skupine (na základe všetkých zápasov, okrem zápasov o umiestnenie)
    function getTeamsInGroupFromAllMatches(groupMatches, categoryName, groupName, useBaseOrderIfNoMatches = true) {
        const teamsMap = new Map();
    
        // Zistíme, či sú v skupine nejaké DOKONČENÉ zápasy
        const hasAnyCompletedMatches = groupMatches.some(match => match.status === 'completed');
        
        // Ak nie sú žiadne dokončené zápasy a chceme použiť base order
        if (!hasAnyCompletedMatches && useBaseOrderIfNoMatches) {
            const baseOrderTeams = getTeamsBaseOrder(categoryName, groupName);
            if (baseOrderTeams.length > 0) {
                log(`📋 [${categoryName} - ${groupName}] Žiadne dokončené zápasy, používam preddefinované poradie (${baseOrderTeams.length} tímov)`);
                return baseOrderTeams;
            }
        }
    
        // Inak pôvodná logika
        groupMatches.forEach(match => {
            // PRESKOČÍME ZÁPASY O UMIESTNENIE
            if (match.isPlacementMatch) return;
        
            const homeTeamId = match.homeTeamIdentifier;
            const awayTeamId = match.awayTeamIdentifier;
            
            if (!teamsMap.has(homeTeamId)) {
                teamsMap.set(homeTeamId, {
                    id: homeTeamId,
                    name: window.teamManager?.getTeamNameByDisplayIdSync?.(homeTeamId) || homeTeamId,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0,
                    baseOrder: null
                });
            }
        
            if (!teamsMap.has(awayTeamId)) {
                teamsMap.set(awayTeamId, {
                    id: awayTeamId,
                    name: window.teamManager?.getTeamNameByDisplayIdSync?.(awayTeamId) || awayTeamId,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0,
                    baseOrder: null
                });
            }
        });
    
        let teamsArray = Array.from(teamsMap.values());
    
        // Pokúsime sa doplniť baseOrder z globálneho stavu
        const allTeamsGlobal = window.__allTeamsState || [];
        for (const team of teamsArray) {
            const globalTeam = allTeamsGlobal.find(t => 
                t.category === categoryName && 
                t.groupName === groupName &&
                (t.teamName === team.name || t.id === team.id)
            );
            if (globalTeam && typeof globalTeam.order === 'number') {
                team.baseOrder = globalTeam.order;
            }
        }
        
        return teamsArray;
    }
    
    // Funkcia na získanie všetkých zápasov v skupine (vrátane neodohraných) - VYNEChÁ ZÁPASY O UMIESTNENIE
    function getGroupMatches(categoryName, groupName) {
        return Object.values(matchesData).filter(match => 
            match.categoryName === categoryName && 
            match.groupName === groupName &&
            !match.isPlacementMatch  // ← PRIDANÉ: VYNEChÁME ZÁPASY O UMIESTNENIE
        );
    }
    
    // Funkcia na získanie odohraných zápasov v skupine - VYNEChÁ ZÁPASY O UMIESTNENIE
    function getCompletedGroupMatches(categoryName, groupName) {
        return Object.values(matchesData).filter(match => 
            match.categoryName === categoryName && 
            match.groupName === groupName && 
            match.status === 'completed' &&
            !match.isPlacementMatch  // ← PRIDANÉ: VYNEChÁME ZÁPASY O UMIESTNENIE
        );
    }
    
    // Funkcia na získanie všetkých tímov v skupine (na základe všetkých zápasov, okrem zápasov o umiestnenie)
    function getTeamsInGroupFromAllMatches(groupMatches) {
        const teamsMap = new Map();
        
        groupMatches.forEach(match => {
            // PRESKOČÍME ZÁPASY O UMIESTNENIE
            if (match.isPlacementMatch) return;
            
            const homeTeamId = match.homeTeamIdentifier;
            const awayTeamId = match.awayTeamIdentifier;
            
            if (!teamsMap.has(homeTeamId)) {
                teamsMap.set(homeTeamId, {
                    id: homeTeamId,
                    name: window.teamManager?.getTeamNameByDisplayIdSync?.(homeTeamId) || homeTeamId,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0
                });
            }
            
            if (!teamsMap.has(awayTeamId)) {
                teamsMap.set(awayTeamId, {
                    id: awayTeamId,
                    name: window.teamManager?.getTeamNameByDisplayIdSync?.(awayTeamId) || awayTeamId,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0
                });
            }
        });
        
        return Array.from(teamsMap.values());
    }

    
        
    let groupTableCache = new Map();  // Cache pre tabuľky skupín
    let lastGroupTableUpdate = new Map();  // Kedy bola naposledy aktualizovaná

    function createGroupTable(categoryName, groupName, forceRefresh = false) {
        const cacheKey = `${categoryName}|${groupName}`;
        const now = Date.now();
        
        // Ak nevyžadujeme refresh a cache je menej ako 5 sekúnd stará, vrátime cached
        if (!forceRefresh && groupTableCache.has(cacheKey)) {
            const lastUpdate = lastGroupTableUpdate.get(cacheKey) || 0;
            if (now - lastUpdate < 5000) {
                return groupTableCache.get(cacheKey);
            }
        }
        
        // Získame VŠETKY zápasy v skupine (aj neodohrané)
        const allGroupMatches = getGroupMatches(categoryName, groupName);
        
        if (allGroupMatches.length === 0) {
            return null;
        }
        
        // Získame len ODOHRANÉ zápasy pre výpočet štatistík
        const completedGroupMatches = allGroupMatches.filter(match => match.status === 'completed');
        
        // Zistíme, či máme nejaké dokončené zápasy
        const hasAnyCompletedMatches = completedGroupMatches.length > 0;
        
        // Získame všetky tímy v skupine (s podporou base order ak nie sú dokončené zápasy)
        let teamsInGroup;
        if (!hasAnyCompletedMatches) {
            // Použijeme preddefinované poradie z globálneho stavu
            teamsInGroup = getTeamsBaseOrder(categoryName, groupName);
            if (teamsInGroup.length === 0) {
                // Fallback na pôvodnú metódu
                teamsInGroup = getTeamsInGroupFromAllMatches(allGroupMatches, categoryName, groupName, false);
            }
        } else {
            teamsInGroup = getTeamsInGroupFromAllMatches(allGroupMatches, categoryName, groupName, false);
        }
        
        if (teamsInGroup.length === 0) {
            return null;
        }
        
        // Získame aktuálny počet bodov za výhru z cache
        const pointsForWin = getPointsForWinSync();
        
        // Spracujeme výsledky LEN z ODOHRANÝCH ZÁPASOV v tejto skupine
        completedGroupMatches.forEach(match => {
            let homeScore = 0;
            let awayScore = 0;
            
            // Kontrola na manuálny výsledok (finalScore)
            if (match.finalScore && !match.forfeitResult) {
                homeScore = match.finalScore.home || 0;
                awayScore = match.finalScore.away || 0;
            } 
            // Kontrola na kontumáciu
            else if (match.forfeitResult && match.forfeitResult.isForfeit) {
                homeScore = match.forfeitResult.home || 0;
                awayScore = match.forfeitResult.away || 0;
            }
            // Inak normálne udalosti
            else {
                const events = eventsData[match.id] || [];
                const score = getCurrentScore(events);
                homeScore = score.home;
                awayScore = score.away;
            }
            
            const homeTeamStats = teamsInGroup.find(t => t.id === match.homeTeamIdentifier);
            const awayTeamStats = teamsInGroup.find(t => t.id === match.awayTeamIdentifier);
    
            if (homeTeamStats && awayTeamStats) {
                homeTeamStats.played++;
                awayTeamStats.played++;
                
                homeTeamStats.goalsFor += homeScore;
                homeTeamStats.goalsAgainst += awayScore;
                awayTeamStats.goalsFor += awayScore;
                awayTeamStats.goalsAgainst += homeScore;
                
                if (homeScore > awayScore) {
                    homeTeamStats.wins++;
                    homeTeamStats.points += pointsForWin;
                    awayTeamStats.losses++;
                } else if (awayScore > homeScore) {
                    awayTeamStats.wins++;
                    awayTeamStats.points += pointsForWin;
                    homeTeamStats.losses++;
                } else {
                    homeTeamStats.draws++;
                    homeTeamStats.points += 1;
                    awayTeamStats.draws++;
                    awayTeamStats.points += 1;
                }
            }
        });
        
        const totalMatches = allGroupMatches.length;
        const completedMatches = completedGroupMatches.length;
        const completionPercentage = totalMatches > 0 ? (completedMatches / totalMatches * 100) : 0;
        
        // Vypočítame rozdiel skóre
        teamsInGroup.forEach(team => {
            team.goalDifference = team.goalsFor - team.goalsAgainst;
        });
        
        // ============================================================
        // 🔥 ZORADENIE TÍMOV
        // ============================================================
        let sortedTeams;
        
        if (!hasAnyCompletedMatches && teamsInGroup.length > 0 && teamsInGroup[0].baseOrder) {
            // Ak nie sú žiadne dokončené zápasy a máme baseOrder, zoradíme podľa baseOrder
            sortedTeams = [...teamsInGroup].sort((a, b) => (a.baseOrder || 999) - (b.baseOrder || 999));
            log(`📋 [${categoryName} - ${groupName}] Zoradené podľa preddefinovaného poradia (baseOrder)`);
        } else {
            // Inak použijeme štandardné porovnávanie
            sortedTeams = [...teamsInGroup].sort((a, b) => {
                return compareTeams(a, b, allGroupMatches, tableSettings.sortingConditions);
            });
        }
        
        // ============================================================
        // Vytvoríme zoznam zápasov so SPRÁVNYM skóre A ZMAPOVANÝMI NÁZVAMI
        // ============================================================
        const allMatchesForDisplay = [];
        
        for (const match of allGroupMatches) {
            let homeScore = 0;
            let awayScore = 0;
            
            // Načítame skóre pre dokončené zápasy
            if (match.status === 'completed') {
                if (match.finalScore && !match.forfeitResult) {
                    homeScore = match.finalScore.home || 0;
                    awayScore = match.finalScore.away || 0;
                } else if (match.forfeitResult?.isForfeit) {
                    homeScore = match.forfeitResult.home || 0;
                    awayScore = match.forfeitResult.away || 0;
                } else {
                    const events = eventsData[match.id] || [];
                    const score = getCurrentScore(events);
                    homeScore = score.home;
                    awayScore = score.away;
                }
            }
            
            // Nájdeme zmapované názvy tímov zo zoradeného zoznamu
            const homeTeam = sortedTeams.find(t => t.id === match.homeTeamIdentifier);
            const awayTeam = sortedTeams.find(t => t.id === match.awayTeamIdentifier);
            
            allMatchesForDisplay.push({
                id: match.id,
                homeTeamIdentifier: match.homeTeamIdentifier,
                awayTeamIdentifier: match.awayTeamIdentifier,
                homeTeamName: homeTeam ? homeTeam.name : match.homeTeamIdentifier,
                awayTeamName: awayTeam ? awayTeam.name : match.awayTeamIdentifier,
                homeScore: homeScore,
                awayScore: awayScore,
                status: match.status,
                scheduledTime: match.scheduledTime,
                isTransferred: false
            });
        }
    
        const result = {
            category: categoryName,
            group: groupName,
            teams: sortedTeams,
            matches: allMatchesForDisplay,
            completedMatches: [...completedGroupMatches],
            totalMatches: totalMatches,
            completedCount: completedMatches,
            remainingCount: totalMatches - completedMatches,
            completionPercentage: completionPercentage,
            transferredMatches: [],
            pointsForWin: pointsForWin,
            // Pridáme informáciu, či bolo použité preddefinované poradie
            usedBaseOrder: !hasAnyCompletedMatches && teamsInGroup.some(t => t.baseOrder)
        };
        
        groupTableCache.set(cacheKey, result);
        lastGroupTableUpdate.set(cacheKey, now);
    
        return result;
    }

    // Pomocná funkcia na získanie názvu tímu pre nadstavbovú skupinu
    function getTeamNameForAdvancedGroup(teamNameFromGroup, category, groupLetter, position) {
        // 🔥 KONTROLA: Či vôbec ide o identifikátor (obsahuje číslo a písmeno)
        const looksLikeIdentifier = /[0-9]+[A-Za-z]+|[A-Za-z]+[0-9]+/.test(teamNameFromGroup);
        
        if (!looksLikeIdentifier) {
            // Toto nie je identifikátor, ale normálny názov tímu
            log(`   ℹ️ "${teamNameFromGroup}" nie je identifikátor (nemá formát A2 alebo 2A), používam pôvodný názov`);
            return teamNameFromGroup;
        }
        
        log(`   📛 Spracovávam identifikátor: "${teamNameFromGroup}"`);
        log(`   📍 Volám window.matchTracker.getTeamNameByDisplayId("${teamNameFromGroup}")...`);
        
        const mappedName = window.matchTracker.getTeamNameByDisplayId(teamNameFromGroup);
        
        if (mappedName && mappedName !== teamNameFromGroup) {
            log(`   ✅ Mapovanie tímu: "${teamNameFromGroup}" → "${mappedName}"`);
            return mappedName;
        }
        
        // Ak funkcia vrátila null alebo rovnaký názov, použijeme pôvodný
        if (!mappedName) {
            log(`   ⚠️ getTeamNameByDisplayId vrátila null pre "${teamNameFromGroup}", používam pôvodný názov`);
        } else if (mappedName === teamNameFromGroup) {
            log(`   ℹ️ Názov zostáva rovnaký: "${teamNameFromGroup}"`);
        }
        return teamNameFromGroup;
    }

    // ============================================================
    // OPRAVENÁ FUNKCIA: createAdvancedGroupTable - POUŽÍVA PÔVODNÉ NÁZVY TÍMOV Z team.name
    // ============================================================
    function createAdvancedGroupTable(categoryName, groupName, baseGroupName, forceRefresh = false) {
        if (forceRefresh) {
            const cacheKey = `${categoryName}|${groupName}`;
            processedCarryOverGroups.delete(cacheKey);
        }
        
        const groupsData = window.groupsData || {};
        const categoryId = window.categoryIdMap?.[categoryName] || null;
        
        let allBaseGroups = [];
        
        if (baseGroupName) {
            allBaseGroups = [baseGroupName];
        } 
        else if (categoryId && groupsData[categoryId]) {
            allBaseGroups = groupsData[categoryId]
                .filter(g => g.type === 'základná skupina')
                .map(g => g.name);
        }
        
        if (allBaseGroups.length === 0 && baseGroupName) {
            allBaseGroups = [baseGroupName];
        }
        
        if (allBaseGroups.length === 0) {
            return null;
        }
        
        // Kontrola dokončenosti základných skupín
        const allBaseGroupsFullyCompleted = [];
        const missingBaseGroups = [];
        
        for (const baseGroup of allBaseGroups) {
            const baseGroupTable = createGroupTable(categoryName, baseGroup);
            
            if (!baseGroupTable) {
                missingBaseGroups.push(baseGroup);
                continue;
            }
            
            const isFullyCompleted = baseGroupTable.completionPercentage === 100;
            
            if (isFullyCompleted) {
                allBaseGroupsFullyCompleted.push(baseGroup);
            } else {
                missingBaseGroups.push(baseGroup);
            }
        }
        
        if (missingBaseGroups.length > 0) {
            return null;
        }
        
        const categorySetting = categorySettingsCache[categoryName];
        const carryOverEnabled = categorySetting?.carryOverPoints ?? false;
        
        const advancedMatches = getGroupMatches(categoryName, groupName);
        if (advancedMatches.length === 0) {
            return null;
        }
        
        // Získame tímy v nadstavbovej skupine
        let teamsInAdvanced = getTeamsInGroupFromAllMatches(advancedMatches);
        
        // ============================================================
        // 🔥 KROK 1: VYTVORENIE MAPY REÁLNYCH NÁZVOV TÍMOV ZO ZÁKLADNÝCH SKUPÍN
        // ============================================================
        log(`\n📋 MAPOVANIE TÍMOV V NADSTAVBOVEJ SKUPINE: ${categoryName} - ${groupName}`);
        log('='.repeat(80));
        
        // Vytvoríme mapu: názov tímu v nadstavbe (napr. "U12 D 1A") → objekt tímu
        const teamByAdvancedName = new Map();     // názov z nadstavby (napr. "U12 D 1A") → objekt tímu
        const nameToIdentifierMap = new Map();    // názov z nadstavby → pôvodný identifikátor
        
        log(`\n📋 PÔVODNÉ NÁZVY TÍMOV V NADSTAVBOVEJ SKUPINE (PODĽA team.name):`);
        for (const team of teamsInAdvanced) {
            // DÔLEŽITÉ: Používame PÔVODNÝ team.name (napr. "U12 D 1A", "U12 D 2B", atď.)
            const advancedTeamName = team.name;
            const identifier = team.id;
            
            log(`   - Názov: "${advancedTeamName}" (identifikátor: ${identifier})`);
            
            teamByAdvancedName.set(advancedTeamName, team);
            nameToIdentifierMap.set(advancedTeamName, identifier);
        }
        
        // ============================================================
        // 🔥 KROK 2: PRÍPRAVA MÁP PRE VYHĽADÁVANIE V ZÁKLADNÝCH SKUPINÁCH
        // ============================================================
        // Vytvoríme mapu: reálny názov klubu → názov v nadstavbe (napr. "SPORT CLUB Senec" → "U12 D 3A")
        // Toto potrebujeme na to, aby sme vedeli, ktoré tímy zo základných skupín patria do nadstavby
        
        const baseTeamToAdvancedName = new Map(); // reálny názov klubu → názov v nadstavbe
        const advancedNameToBaseTeam = new Map(); // názov v nadstavbe → reálny názov klubu
        
        for (const baseGroup of allBaseGroupsFullyCompleted) {
            const baseGroupTable = createGroupTable(categoryName, baseGroup);
            if (!baseGroupTable) continue;
            
            const groupLetter = baseGroup.replace('skupina ', '').toUpperCase();
            
            baseGroupTable.teams.forEach((team, idx) => {
                const position = idx + 1;
                // Toto je názov, ktorý by sa mal objaviť v nadstavbe (napr. "U12 D 1A")
                const advancedTeamName = `${cleanCategoryName(categoryName)} ${position}${groupLetter}`;
                
                // Uložíme mapovanie
                baseTeamToAdvancedName.set(team.name, advancedTeamName);
                advancedNameToBaseTeam.set(advancedTeamName, team.name);
                
                log(`   📝 Mapovanie: "${team.name}" (základná) → "${advancedTeamName}" (nadstavbový názov)`);
            });
        }
        
        log(`\n📋 ZOZNAM OČAKÁVANÝCH NÁZVOV V NADSTAVBE:`);
        for (const [advancedName, baseTeamName] of advancedNameToBaseTeam) {
            log(`   - "${advancedName}" → reprezentuje klub: "${baseTeamName}"`);
        }
        
        // ============================================================
        // 🔥 KROK 3: VYTVORENIE VÝSLEDNÝCH ŠTRUKTÚR PRE TABUĽKU
        // ============================================================
        // Teraz vytvoríme finálne mapy pre tabuľku:
        // - teamStatsMap: reálny názov klubu → štatistiky
        // - identifierToRealName: identifikátor z nadstavby → reálny názov klubu
        
        const teamStatsMap = new Map();      // reálny názov klubu → objekt štatistík
        const identifierToRealName = new Map(); // identifikátor (napr. "U12 D F3") → reálny názov klubu
        const advancedNameToRealName = new Map(); // názov v nadstavbe (napr. "U12 D 1A") → reálny názov klubu

        console.log('🔍 DEBUG teamStatsMap keys:', Array.from(teamStatsMap.keys()));
        console.log('🔍 DEBUG allBaseGroupsFullyCompleted:', allBaseGroupsFullyCompleted);
        
        for (const [advancedTeamName, teamObject] of teamByAdvancedName.entries()) {
            // Zistíme, ktorý reálny klub patrí k tomuto názvu v nadstavbe
            const realClubName = advancedNameToBaseTeam.get(advancedTeamName);
            
            if (realClubName) {
                log(`   ✅ Mapovanie: "${advancedTeamName}" → klub: "${realClubName}"`);
                
                // Vytvoríme štatistiky pre klub
                const stats = {
                    name: realClubName,
                    originalAdvancedName: advancedTeamName,
                    identifier: teamObject.id,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0,
                    goalDifference: 0
                };
                
                teamStatsMap.set(realClubName, stats);
                advancedNameToRealName.set(advancedTeamName, realClubName);
                identifierToRealName.set(teamObject.id, realClubName);
            } else {
                log(`   ⚠️ NEMAPOVANÉ: "${advancedTeamName}" - nebol nájdený v základných skupinách`);
                // Aj tak ho pridáme, ale s pôvodným názvom
                const stats = {
                    name: advancedTeamName,
                    originalAdvancedName: advancedTeamName,
                    identifier: teamObject.id,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0,
                    goalDifference: 0
                };
                teamStatsMap.set(advancedTeamName, stats);
                identifierToRealName.set(teamObject.id, advancedTeamName);
            }
        }
        
        // Kontrola: vypíšeme všetky namapované kluby
        log(`\n📋 VÝSLEDNÉ MAPOVANIE PRE TABUĽKU NADSTAVBY:`);
        for (const [realClubName, stats] of teamStatsMap) {
            log(`   - Klub: "${realClubName}" (pôvodný nadstavbový názov: ${stats.originalAdvancedName})`);
        }
        
        log('='.repeat(80) + '\n');
        
        const pointsForWin = getPointsForWinSync();
        
        // Zber prenesených výsledkov
        const transferredMatches = [];
        const processedPairs = new Set();
        
        // ============================================================
        // KROK 4: ZBER PRENESENÝCH VÝSLEDKOV ZO ZÁKLADNÝCH SKUPÍN
        // 🔥 POROVNÁVAME PODĽA REÁLNYCH NÁZVOV KLUBOV
        // ============================================================
        if (carryOverEnabled) {
            log(`   🔄 Zbieram výsledky zo základných skupín (CARRY OVER ZAPNUTÝ)...`);
    
            const baseMatchResults = new Map();
            const clubsInAdvanced = Array.from(teamStatsMap.keys());
            
            // 1. Najprv hľadáme zápasy v ROVNAKEJ základnej skupine (pôvodná logika)
            for (const baseGroupName of allBaseGroupsFullyCompleted) {
                const baseGroupTable = createGroupTable(categoryName, baseGroupName);
                if (!baseGroupTable) continue;
                
                for (const match of baseGroupTable.matches) {
                    if (match.status !== 'completed') continue;
                    
                    const homeClubName = match.homeTeamName;
                    const awayClubName = match.awayTeamName;
                    const homeInAdvanced = teamStatsMap.has(homeClubName);
                    const awayInAdvanced = teamStatsMap.has(awayClubName);

                    console.log(`🔍 Hľadám v skupine ${baseGroupName}:`);
                    console.log(`   homeClubName: ${homeClubName}, awayClubName: ${awayClubName}`);
                    console.log(`   homeInAdvanced: ${homeInAdvanced}, awayInAdvanced: ${awayInAdvanced}`);
                    
                    if (homeInAdvanced && awayInAdvanced) {
                        const key = homeClubName < awayClubName ? 
                            `${homeClubName}|${awayClubName}` : `${awayClubName}|${homeClubName}`;
                        
                        if (!baseMatchResults.has(key)) {
                            baseMatchResults.set(key, {
                                homeTeam: homeClubName,
                                awayTeam: awayClubName,
                                homeScore: match.homeScore,
                                awayScore: match.awayScore,
                                fromGroup: baseGroupName
                            });
                            log(`      ✅ PRENESENÝ (rovnaká skupina): ${homeClubName} ${match.homeScore}:${match.awayScore} ${awayClubName}`);
                        }
                    }
                }
            }
            
            // 🔥 2. TERAZ HĽADÁME ZÁPASY MEDZI TÍMMI Z RÔZNYCH SKUPÍN
            log(`   🔍 Hľadám zápasy medzi tímami z RÔZNYCH základných skupín...`);
            
            // Získame všetky možné dvojice tímov v nadstavbe
            const clubsList = Array.from(teamStatsMap.keys());
            
            for (let i = 0; i < clubsList.length; i++) {
                for (let j = i + 1; j < clubsList.length; j++) {
                    const clubA = clubsList[i];
                    const clubB = clubsList[j];
                    const pairKey = clubA < clubB ? `${clubA}|${clubB}` : `${clubB}|${clubA}`;
                    
                    // Ak už máme výsledok z rovnakej skupiny, preskočíme
                    if (baseMatchResults.has(pairKey)) continue;
                    
                    log(`      🔎 Hľadám zápas medzi: "${clubA}" a "${clubB}" (rôzne skupiny)...`);
                    
                    // Tu potrebujeme funkciu, ktorá nájde zápas medzi týmito dvoma klubmi
                    // Naprieč VŠETKÝMI skupinami (nielen základnými)
                    const crossGroupMatch = findCrossGroupMatch(clubA, clubB, categoryName);
                    
                    if (crossGroupMatch && crossGroupMatch.status === 'completed') {
                        log(`         ✅ Nájdený zápas v skupine: ${crossGroupMatch.groupName}`);
                        log(`         ✅ Výsledok: ${crossGroupMatch.homeScore}:${crossGroupMatch.awayScore}`);
                        
                        baseMatchResults.set(pairKey, {
                            homeTeam: crossGroupMatch.homeTeamName,
                            awayTeam: crossGroupMatch.awayTeamName,
                            homeScore: crossGroupMatch.homeScore,
                            awayScore: crossGroupMatch.awayScore,
                            fromGroup: crossGroupMatch.groupName,
                            isCrossGroup: true
                        });
                    } else {
                        log(`         ❌ Žiadny dokončený zápas medzi týmito klubmi`);
                    }
                }
            }
            
            // Spracovanie prenesených výsledkov do štatistík (rovnaké ako pôvodne)
            for (const [key, baseResult] of baseMatchResults.entries()) {
                const { homeTeam: homeClubName, awayTeam: awayClubName, homeScore, awayScore, fromGroup } = baseResult;
                
                const teamAStats = teamStatsMap.get(homeClubName);
                const teamBStats = teamStatsMap.get(awayClubName);
                
                if (!teamAStats || !teamBStats) {
                    log(`   ⚠️ Tímy neboli nájdené v mape: ${homeClubName}, ${awayClubName}`);
                    continue;
                }
                
                const pairKey = `${teamAStats.name}|${teamBStats.name}`;
                
                if (processedPairs.has(pairKey)) {
                    log(`   ⏭️ Preskakujem duplicitný pár: ${teamAStats.name} vs ${teamBStats.name}`);
                    continue;
                }
                
                processedPairs.add(pairKey);
                
                log(`   ✅ PRIDÁVAM PRENESENÝ ZÁPAS: ${teamAStats.name} ${homeScore}:${awayScore} ${teamBStats.name}`);
                
                // Aktualizujeme štatistiky
                teamAStats.played++;
                teamBStats.played++;
                teamAStats.goalsFor += homeScore;
                teamAStats.goalsAgainst += awayScore;
                teamBStats.goalsFor += awayScore;
                teamBStats.goalsAgainst += homeScore;
                
                if (homeScore > awayScore) {
                    teamAStats.wins++;
                    teamBStats.losses++;
                    teamAStats.points += pointsForWin;
                } else if (awayScore > homeScore) {
                    teamBStats.wins++;
                    teamAStats.losses++;
                    teamBStats.points += pointsForWin;
                } else {
                    teamAStats.draws++;
                    teamBStats.draws++;
                    teamAStats.points += 1;
                    teamBStats.points += 1;
                }
                
                transferredMatches.push({
                    homeTeam: teamAStats.name,
                    awayTeam: teamBStats.name,
                    homeScore: homeScore,
                    awayScore: awayScore,
                    fromGroup: fromGroup,
                    isTransferred: true
                });
            }
        }
        
        // ============================================================
        // KROK 5: SPRACOVANIE ZÁPASOV V NADSTAVBOVEJ SKUPINE
        // 🔥 POUŽÍVAME REÁLNE NÁZVY KLUBOV Z identifierToRealName
        // ============================================================
        const completedAdvancedMatches = advancedMatches.filter(m => m.status === 'completed');
        
        for (const match of completedAdvancedMatches) {
            let homeScore = 0, awayScore = 0;
            
            if (match.finalScore && !match.forfeitResult) {
                homeScore = match.finalScore.home || 0;
                awayScore = match.finalScore.away || 0;
            } else if (match.forfeitResult && match.forfeitResult.isForfeit) {
                homeScore = match.forfeitResult.home || 0;
                awayScore = match.forfeitResult.away || 0;
            } else {
                const events = eventsData[match.id] || [];
                const score = getCurrentScore(events);
                homeScore = score.home;
                awayScore = score.away;
            }
            
            // Získame reálne názvy klubov z našej mapy
            const homeClubName = identifierToRealName.get(match.homeTeamIdentifier);
            const awayClubName = identifierToRealName.get(match.awayTeamIdentifier);
            
            if (!homeClubName || !awayClubName) {
                log(`   ⚠️ Zápas ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}: nepodarilo sa namapovať na kluby`);
                continue;
            }
            
            const homeTeamStats = teamStatsMap.get(homeClubName);
            const awayTeamStats = teamStatsMap.get(awayClubName);
            
            if (homeTeamStats && awayTeamStats) {
                const matchKey = homeTeamStats.name < awayTeamStats.name ? 
                    `${homeTeamStats.name}|${awayTeamStats.name}` : `${awayTeamStats.name}|${homeTeamStats.name}`;
                
                // Preskočíme, ak sme už tento pár spracovali cez prenesené výsledky
                if (!processedPairs.has(matchKey)) {
                    processedPairs.add(matchKey);
                    
                    homeTeamStats.played++;
                    awayTeamStats.played++;
                    homeTeamStats.goalsFor += homeScore;
                    homeTeamStats.goalsAgainst += awayScore;
                    awayTeamStats.goalsFor += awayScore;
                    awayTeamStats.goalsAgainst += homeScore;
                    
                    if (homeScore > awayScore) {
                        homeTeamStats.wins++;
                        awayTeamStats.losses++;
                        homeTeamStats.points += pointsForWin;
                    } else if (awayScore > homeScore) {
                        awayTeamStats.wins++;
                        homeTeamStats.losses++;
                        awayTeamStats.points += pointsForWin;
                    } else {
                        homeTeamStats.draws++;
                        awayTeamStats.draws++;
                        homeTeamStats.points += 1;
                        awayTeamStats.points += 1;
                    }
                }
            } else {
                log(`   ⚠️ Zápas: jeden z tímov nebol nájdený v mape`);
                log(`      home: ${homeClubName}, away: ${awayClubName}`);
            }
        }
        
        // Výpočet rozdielu skóre a zoradenie
        const teamsArray = Array.from(teamStatsMap.values());
        teamsArray.forEach(team => {
            team.goalDifference = team.goalsFor - team.goalsAgainst;
        });
        
        const sortedTeams = [...teamsArray].sort((a, b) => {
            return compareTeams(a, b, advancedMatches, tableSettings.sortingConditions);
        });
        
        // ============================================================
        // KROK 6: PRÍPRAVA ZOZNAMU ZÁPASOV NA ZOBRAZENIE
        // ============================================================
        const allMatchesForDisplay = [];
    
        // Prenesené zápasy
        for (const transferred of transferredMatches) {
            allMatchesForDisplay.push({
                id: `transferred_${Date.now()}_${Math.random()}`,
                homeTeamIdentifier: transferred.homeTeam,
                awayTeamIdentifier: transferred.awayTeam,
                homeTeamName: transferred.homeTeam,
                awayTeamName: transferred.awayTeam,
                homeScore: transferred.homeScore,
                awayScore: transferred.awayScore,
                status: 'completed',
                scheduledTime: null,
                isTransferred: true,
                fromGroup: transferred.fromGroup
            });
        }
        
        // Zápasy z nadstavbovej skupiny
        for (const match of advancedMatches) {
            let homeScore = 0, awayScore = 0;
            
            if (match.status === 'completed') {
                if (match.finalScore && !match.forfeitResult) {
                    homeScore = match.finalScore.home || 0;
                    awayScore = match.finalScore.away || 0;
                } else if (match.forfeitResult?.isForfeit) {
                    homeScore = match.forfeitResult.home || 0;
                    awayScore = match.forfeitResult.away || 0;
                } else {
                    const events = eventsData[match.id] || [];
                    const score = getCurrentScore(events);
                    homeScore = score.home;
                    awayScore = score.away;
                }
            }
            
            // Získame reálne názvy klubov
            const homeDisplayName = identifierToRealName.get(match.homeTeamIdentifier) || match.homeTeamIdentifier;
            const awayDisplayName = identifierToRealName.get(match.awayTeamIdentifier) || match.awayTeamIdentifier;
            
            allMatchesForDisplay.push({
                id: match.id,
                homeTeamIdentifier: match.homeTeamIdentifier,
                awayTeamIdentifier: match.awayTeamIdentifier,
                homeTeamName: homeDisplayName,
                awayTeamName: awayDisplayName,
                homeScore: homeScore,
                awayScore: awayScore,
                status: match.status,
                scheduledTime: match.scheduledTime,
                isTransferred: false
            });
        }
        
        log(`\n📊 VÝSLEDOK NADSTAVBOVEJ SKUPINY ${groupName}:`);
        log(`   Prenesených zápasov: ${transferredMatches.length}`);
        log(`   Odohraných v nadstavbe: ${completedAdvancedMatches.length}/${advancedMatches.length}`);
        log(`   Celkom klubov: ${teamsArray.length}`);
        
        return {
            category: categoryName,
            group: groupName,
            baseGroup: allBaseGroupsFullyCompleted.join(', '),
            carryOverPoints: carryOverEnabled,
            teams: sortedTeams,
            matches: allMatchesForDisplay,
            transferredMatches: transferredMatches,
            totalMatches: allMatchesForDisplay.length,
            completedCount: allMatchesForDisplay.filter(m => m.status === 'completed').length,
            completionPercentage: (allMatchesForDisplay.filter(m => m.status === 'completed').length / allMatchesForDisplay.length * 100) || 0,
            pointsForWin: pointsForWin
        };
    }

    function mapAdvancedGroupTeamsGeneral(teamsInAdvanced, categoryName, allBaseGroupTables) {
        const cleanCategory = cleanCategoryName(categoryName);
        
        log(`\n📋 MAPOVANIE TÍMOV PRE NADSTAVBOVÚ SKUPINU: ${categoryName}`);
        log('='.repeat(80));
        
        const mappedTeams = new Map();
        
        for (const team of teamsInAdvanced) {
            // Skúsime nájsť tím v ktorejkoľvek základnej skupine
            let foundTeam = null;
            let foundGroupLetter = '';
            let foundPosition = 0;
            
            for (const baseGroupTable of allBaseGroupTables) {
                const baseTeamIndex = baseGroupTable.teams.findIndex(t => t.id === team.id);
                if (baseTeamIndex !== -1) {
                    foundTeam = baseGroupTable.teams[baseTeamIndex];
                    foundGroupLetter = baseGroupTable.group.replace('skupina ', '').toUpperCase();
                    foundPosition = baseTeamIndex + 1;
                    break;
                }
            }
            
            if (foundTeam) {
                const displayId = `${cleanCategory} ${foundPosition}${foundGroupLetter}`;
                log(`\n🔄 Spracovávam tím: "${team.name}"`);
                log(`   📍 Pozícia v základnej skupine ${foundGroupLetter}: ${foundPosition}. miesto`);
                log(`   📍 Volám window.matchTracker.getTeamNameByDisplayId("${displayId}")...`);
                
                const mappedName = window.matchTracker.getTeamNameByDisplayId(displayId);
                
                if (mappedName && mappedName !== team.name && mappedName !== displayId) {
                    log(`   ✅ MAPOVANÝ NÁZOV: "${team.name}" → "${mappedName}"`);
                    mappedTeams.set(team.id, mappedName);
                } else if (!mappedName) {
                    log(`   ⚠️ getTeamNameByDisplayId vrátila null pre "${displayId}", používam pôvodný názov: "${team.name}"`);
                } else if (mappedName === team.name) {
                    log(`   ℹ️ Názov zostáva rovnaký: "${team.name}"`);
                }
            } else {
                log(`   ⚠️ Tím "${team.name}" nebol nájdený v žiadnej základnej skupine`);
            }
        }
        
        // Aplikujeme mapované názvy
        for (const team of teamsInAdvanced) {
            if (mappedTeams.has(team.id)) {
                const oldName = team.name;
                team.name = mappedTeams.get(team.id);
                log(`\n📛 PREMAPOVANIE: "${oldName}" → "${team.name}"`);
            }
        }
        
        log('\n' + '='.repeat(80));
        log('✅ MAPOVANIE TÍMOV DOKONČENÉ\n');
        
        return teamsInAdvanced;
    }

    function isGroupFullyCompleted(categoryName, groupName) {
        const groupMatches = getGroupMatches(categoryName, groupName);
        if (groupMatches.length === 0) return false;
    
        const completedMatches = groupMatches.filter(m => m.status === 'completed');
        const percentage = (completedMatches.length / groupMatches.length) * 100;
        
        return percentage === 100;
    }
    
    // Funkcia na načítanie nastavení poradia z Firestore
    async function loadTableSettings() {
        if (!window.db) return;
        
        try {
            const { doc, getDoc } = window.firebaseModules || await importFirebaseModules();
            if (!doc) return;
            
            const settingsDocRef = doc(window.db, 'settings', 'table');
            const settingsDoc = await getDoc(settingsDocRef);
            
            if (settingsDoc.exists()) {
                const data = settingsDoc.data();
                tableSettings.sortingConditions = data.sortingConditions || [];
                log('📋 Načítané kritériá poradia:', tableSettings.sortingConditions);
            } else {
                tableSettings.sortingConditions = [];
                log('📋 Používam predvolené kritériá poradia (len podľa bodov)');
            }
        } catch (error) {
            error('❌ Chyba pri načítaní nastavení poradia:', error);
            tableSettings.sortingConditions = [];
        }
    }

    // Cache pre nastavenia kategórií (vrátane carryOverPoints)
    let categorySettingsCache = {};

    // Funkcia na načítanie nastavení kategórie z Firestore
    async function loadCategorySettings() {
        if (!window.db) return;
        try {
            const { doc, getDoc } = window.firebaseModules || await importFirebaseModules();
            const categoriesRef = doc(window.db, 'settings', 'categories');
            const categoriesSnap = await getDoc(categoriesRef);
            if (categoriesSnap.exists()) {
                const data = categoriesSnap.data();
                for (const [catId, catData] of Object.entries(data)) {
                    // DÔLEŽITÉ: carryOverPoints je hodnota z databázy
                    // true = prenášanie výsledkov vzájomných zápasov
                    // false = žiadne prenášanie
                    categorySettingsCache[catData.name] = {
                        carryOverPoints: catData.carryOverPoints ?? false,
                        id: catId
                    };
                }
                log('📋 Načítané nastavenia kategórií (carryOverPoints = prenášanie výsledkov vzájomných zápasov):', 
                    Object.fromEntries(Object.entries(categorySettingsCache).map(([k,v]) => [k, v.carryOverPoints])));
            }
        } catch (error) {
            error('❌ Chyba pri načítaní nastavení kategórií:', error);
        }
    }
    
    // Funkcia na sledovanie zmien nastavení poradia v reálnom čase
    function subscribeToTableSettings() {
        if (!window.db) return;
        
        const { doc, onSnapshot } = window.firebaseModules;
        if (!doc || !onSnapshot) return;
        
        const settingsDocRef = doc(window.db, 'settings', 'table');
        
        return onSnapshot(settingsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Aktualizácia kritérií poradia
                const newSortingConditions = data.sortingConditions || [];
                const sortingChanged = JSON.stringify(tableSettings.sortingConditions) !== JSON.stringify(newSortingConditions);
                if (sortingChanged) {
                    tableSettings.sortingConditions = newSortingConditions;
                    log('🔄 Aktualizované kritériá poradia:', tableSettings.sortingConditions);
                }
                
                // 🔥 AKTUALIZÁCIA BODOV ZA VÝHRU
                const newPointsForWin = data.pointsForWin !== undefined ? data.pointsForWin : 3;
                if (cachedPointsForWin !== newPointsForWin) {
                    const oldPoints = cachedPointsForWin;
                    cachedPointsForWin = newPointsForWin;
                    log(`🔄 Aktualizované body za výhru: ${oldPoints} → ${cachedPointsForWin}`);
                }
                
                // Ak sa zmenilo čokoľvek, prepočítame tabuľky
                if (sortingChanged || cachedPointsForWin !== newPointsForWin) {
                    log('🔄 Zmena v nastaveniach tabuľky, prepočítavam...');
                    printAllGroupTables();
                }
            }
        }, (error) => {
            error('❌ Chyba pri sledovaní nastavení poradia:', error);
        });
    }
    
    // ============================================================
    // OPRAVENÁ FUNKCIA: printGroupTable - POUŽÍVA NÁZVY, NIE IDENTIFIKÁTORY
    // ============================================================
    function printGroupTable(categoryName, groupName, baseGroupName = null) {
        console.log(`🔍 printGroupTable called: ${categoryName} - ${groupName}`);
    
        let table;
        const groupsData = window.groupsData || {};
        const categoryId = window.categoryIdMap?.[categoryName] || null;
        let isAdvancedGroup = false;
        
        console.log(`   categoryId: ${categoryId}`);
        console.log(`   groupsData[categoryId]:`, groupsData[categoryId]);
        
        if (categoryId && groupsData[categoryId]) {
            const groupInfo = groupsData[categoryId].find(g => g.name === groupName);
            console.log(`   groupInfo:`, groupInfo);
            if (groupInfo && groupInfo.type === 'nadstavbová skupina') {
                isAdvancedGroup = true;
                console.log(`   ✅ ${groupName} je nadstavbová skupina`);
            }
        }
        
        if (isAdvancedGroup) {
            console.log(`   🔧 Volám createAdvancedGroupTable pre ${groupName}`);
            table = createAdvancedGroupTable(categoryName, groupName, null);
        } else {
            console.log(`   📋 Volám createGroupTable pre ${groupName}`);
            table = createGroupTable(categoryName, groupName);
        }
        
        if (!table) return;
        
        for (const team of table.teams) {
            if (looksLikeIdentifier(team.name)) {
                const mappedName = getTeamNameByDisplayId(team.name);
                if (mappedName && mappedName !== team.name) {
                    team.name = mappedName;
                }
            }
        }
        
        log('\n' + '='.repeat(120));
        log(`📊 TABUĽKA SKUPINY: ${table.category} - ${table.group}`);
        if (table.baseGroup) {
            log(`   📌 Základná skupina: ${table.baseGroup}`);
            log(`   📌 Prenášanie bodov: ${table.carryOverPoints ? 'ZAPNUTÉ ✅' : 'VYPNUTÉ ❌'}`);
        }
        log('='.repeat(120));
        
        const progressBar = generateProgressBar(table.completionPercentage);
        
        if (isAdvancedGroup) {
            log(`📋 Zápasy v nadstavbe: ${table.completedCount} / ${table.totalMatches} odohraných (${table.completionPercentage}%)`);
            if (table.transferredMatches && table.transferredMatches.length > 0) {
                log(`📋 Prenesené zápasy: ${table.transferredMatches.length} (zo základných skupín)`);
            }
            log(`📋 Celkový stav: ${table.isFullyCompleted ? '✅ VŠETKY ZÁPASY ODOHRANÉ' : '⏳ ČAKÁ SA NA DOHRANIE ZÁPASOV'}`);
        } else {
            log(`📋 Zápasy: ${table.completedCount} / ${table.totalMatches} odohraných (${table.completionPercentage}%) ${progressBar}`);
        }
        
        log('-'.repeat(120));
        log(' '.padEnd(4) + 'TÍM'.padEnd(30) + 'Z'.padEnd(5) + 'V'.padEnd(5) + 'R'.padEnd(5) + 'P'.padEnd(5) + 'Skóre'.padEnd(12) + '+/-'.padEnd(6) + 'Body');
        log('-'.repeat(120));
    
        table.teams.forEach((team, index) => {
            const position = (index + 1).toString().padEnd(4);
            const name = team.name.substring(0, 28).padEnd(30);
            const played = team.played.toString().padEnd(5);
            const wins = team.wins.toString().padEnd(5);
            const draws = team.draws.toString().padEnd(5);
            const losses = team.losses.toString().padEnd(5);
            const score = `${team.goalsFor}:${team.goalsAgainst}`.padEnd(12);
            let diffDisplay = team.goalDifference.toString().padEnd(6);
            if (team.goalDifference > 0) {
                diffDisplay = `+${team.goalDifference}`.padEnd(6);
            }
            const points = team.points.toString().padEnd(4);
            
            log(`${position}${name}${played}${wins}${draws}${losses}${score}${diffDisplay}${points}`);
        });
        
        log('-'.repeat(120));
        
        // ============================================================
        // 🔥 VÝPIS VŠETKÝCH ZÁPASOV - POUŽÍVAME homeTeamName a awayTeamName
        // ============================================================
        if (table.matches && table.matches.length > 0) {
            log(`\n📅 VŠETKY ZÁPASY V SKUPINE (${table.matches.length}):`);
            log('='.repeat(80));
            
            // Rozdelíme na prenesené a normálne
            const transferred = table.matches.filter(m => m.isTransferred);
            const normal = table.matches.filter(m => !m.isTransferred);
            
            // 1. Normálne zápasy (v nadstavbovej skupine)
            if (normal.length > 0) {
                log(`\n🏆 ZÁPASY V SKUPINE (${normal.length}):`);
                normal.forEach((match, idx) => {
                    // 🔥 DÔLEŽITÉ: Používame homeTeamName a awayTeamName, nie homeTeamIdentifier
                    // Tieto vlastnosti musíme nastaviť už v createAdvancedGroupTable
                    let homeTeam = match.homeTeamName || match.homeTeamIdentifier;
                    let awayTeam = match.awayTeamName || match.awayTeamIdentifier;
                    
                    // Pre istotu ešte skúsime namapovať, ak náhodou nie sú
                    if (looksLikeIdentifier(homeTeam)) {
                        const mapped = getTeamNameByDisplayId(homeTeam);
                        if (mapped && mapped !== homeTeam) homeTeam = mapped;
                    }
                    if (looksLikeIdentifier(awayTeam)) {
                        const mapped = getTeamNameByDisplayId(awayTeam);
                        if (mapped && mapped !== awayTeam) awayTeam = mapped;
                    }
                    
                    const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null;
                    const dateStr = matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený';
                    
                    if (match.status === 'completed') {
                        log(`   ${idx+1}. ✅ ${homeTeam} ${match.homeScore}:${match.awayScore} ${awayTeam} (${dateStr})`);
                    } else {
                        log(`   ${idx+1}. ⏳ ${homeTeam} vs ${awayTeam} (${dateStr}) - ${getStatusText(match.status)}`);
                    }
                });
            }
            
            // 2. Prenesené zápasy (zo základných skupín)
            if (transferred.length > 0) {
                log(`\n🔄 PRENESENÉ ZÁPASY (zo základných skupín):`);
                transferred.forEach((match, idx) => {
                    // Prenesené zápasy už majú homeTeam a awayTeam ako názvy
                    const homeTeam = match.homeTeamName || match.homeTeamIdentifier;
                    const awayTeam = match.awayTeamName || match.awayTeamIdentifier;
                    log(`   ${idx+1}. ${homeTeam} ${match.homeScore}:${match.awayScore} ${awayTeam} (z ${match.fromGroup || 'základnej skupiny'})`);
                });
            }
            
            log('='.repeat(80));
        }
        
        // Výpis kritérií poradia
        if (tableSettings.sortingConditions.length > 0) {
            log(`\n📋 Kritériá poradia: ${tableSettings.sortingConditions.map((c, i) => {
                const param = c.parameter === 'headToHead' ? 'vzájomný zápas' :
                             c.parameter === 'scoreDifference' ? '+/-' :
                             c.parameter === 'goalsScored' ? 'strelené góly' :
                             c.parameter === 'goalsConceded' ? 'inkasované góly' :
                             c.parameter === 'wins' ? 'výhry' :
                             c.parameter === 'losses' ? 'prehry' :
                             c.parameter === 'draw' ? 'losovanie' : c.parameter;
                const dir = c.direction === 'asc' ? 'vzostupne' : 'zostupne';
                return `${i+1}. ${param}${c.parameter !== 'draw' && c.parameter !== 'headToHead' ? ` (${dir})` : ''}`;
            }).join(', ')}`);
        } else {
            log(`\n📋 Kritériá poradia: predvolené (body, +/-, strelené góly, abeceda)`);
        }
        
        log('='.repeat(120) + '\n');
    }
    
    // Pomocná funkcia na generovanie progress baru
    function generateProgressBar(percentage) {
        const barLength = 20;
        const filledLength = Math.round(percentage / 100 * barLength);
        const emptyLength = barLength - filledLength;
        const filled = '█'.repeat(filledLength);
        const empty = '░'.repeat(emptyLength);
        return `[${filled}${empty}]`;
    }
    
    // Funkcia na výpis všetkých tabuliek skupín
    function printAllGroupTables() {
        const allMatches = getAllMatches();
        
        if (allMatches.length === 0) {
            log('Žiadne zápasy v databáze');
            return;
        }
        
        // Získame unikátne kombinácie kategória + skupina, ALE VYNEChÁME ZÁPASY O UMIESTNENIE
        const uniqueGroups = new Set();
        allMatches.forEach(match => {
            // PRESKOČÍME ZÁPASY O UMIESTNENIE
            if (match.isPlacementMatch) return;
            
            if (match.categoryName && match.groupName) {
                uniqueGroups.add(`${match.categoryName}|${match.groupName}`);
            }
        });
        
        if (uniqueGroups.size === 0) {
            log('Nenašli sa žiadne skupiny');
            return;
        }
        
        log('\n' + '='.repeat(100));
        log(`📊 VŠETKY TABUĽKY SKUPÍN (${uniqueGroups.size} skupín)`);
        log('='.repeat(100));
        
        const sortedGroups = Array.from(uniqueGroups).sort();
        
        sortedGroups.forEach(groupKey => {
            const [category, group] = groupKey.split('|');
            printGroupTable(category, group);
        });
    }
    
    // Funkcia na výpis všetkých odohraných zápasov
    function printCompletedMatches() {
        const completedMatches = getCompletedMatches();
        
        if (completedMatches.length === 0) {
            log('Žiadne odohrané zápasy');
            return;
        }
        
        log('\n' + '='.repeat(90));
        log(`✅ ODOHRANÉ ZÁPASY (${completedMatches.length}) - ${new Date().toLocaleTimeString()}`);
        log('='.repeat(90));
        
        const sortedMatches = [...completedMatches].sort((a, b) => {
            if (!a.scheduledTime && !b.scheduledTime) return 0;
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return b.scheduledTime.toDate() - a.scheduledTime.toDate();
        });
        
        sortedMatches.forEach((match, index) => {
            const details = getMatchDetails(match.id);
            if (!details) return;
            
            log(`\n${index + 1}. 🏁 ${details.homeTeamName} vs ${details.awayTeamName}`);
            log(`   📅 ${details.dateStr}`);
            log(`   🏷️ Kategória: ${details.category}`);
            log(`   👥 Skupina: ${details.group}`);
            log(`   🥅 Konečné skóre: ${details.homeScore} : ${details.awayScore}`);
            log(`   🆔 Domáci ID: ${details.homeTeamId}`);
            log(`   🆔 Hostia ID: ${details.awayTeamId}`);
        });
        
        log('\n' + '='.repeat(90) + '\n');
    }    
    
    // Funkcia na výpis prehľadu všetkých skupín
    function printGroupsOverview() {
        const allMatches = getAllMatches();
        
        if (allMatches.length === 0) {
            log('Žiadne zápasy v databáze');
            return;
        }
        
        const groupsMap = new Map();
        
        allMatches.forEach(match => {
            if (match.categoryName && match.groupName) {
                const key = `${match.categoryName}|${match.groupName}`;
                if (!groupsMap.has(key)) {
                    groupsMap.set(key, {
                        category: match.categoryName,
                        group: match.groupName,
                        total: 0,
                        completed: 0,
                        inProgress: 0,
                        scheduled: 0
                    });
                }
                
                const group = groupsMap.get(key);
                group.total++;
                
                switch (match.status) {
                    case 'completed':
                        group.completed++;
                        break;
                    case 'in-progress':
                    case 'paused':
                        group.inProgress++;
                        break;
                    case 'scheduled':
                        group.scheduled++;
                        break;
                }
            }
        });
        
        log('\n' + '='.repeat(80));
        log('📊 PREHĽAD SKUPÍN');
        log('='.repeat(80));
        
        const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return a.group.localeCompare(b.group);
        });
        
        sortedGroups.forEach(group => {
            const completedPercent = group.total > 0 ? (group.completed / group.total * 100).toFixed(1) : 0;
            const progressBar = generateProgressBar(completedPercent);
            log(`\n📌 ${group.category} - ${group.group}`);
            log(`   Zápasy: ${group.completed}/${group.total} odohraných (${completedPercent}%) ${progressBar}`);
            log(`   📅 Naplánované: ${group.scheduled} | ▶️ Prebieha: ${group.inProgress} | ✅ Odohrané: ${group.completed}`);
        });
        
        log('\n' + '='.repeat(80) + '\n');
    }
    
    // Hlavná funkcia na inicializáciu sledovania
    async function initializeMatchTracker() {
        processedCarryOverGroups.clear();
        log('🗑️ Cache prenášania výsledkov bola resetovaná');
        
        if (!window.db) {
            log('⏳ Čakám na inicializáciu Firebase...');
            for (let i = 0; i < 50; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                if (window.db) break;
            }
            if (!window.db) {
                error('❌ Firebase nebol inicializovaný!');
                return;
            }
        }
        
        log('✅ Firebase inicializovaný, spúšťam sledovanie...');
        
        const { collection, query, where, onSnapshot, getDocs } = window.firebaseModules || 
            await importFirebaseModules();
        
        if (!collection) {
            error('❌ Firebase moduly neboli načítané!');
            return;
        }
        
        // Načítame nastavenia poradia
        await loadTableSettings();
        
        // Spustíme sledovanie zmien nastavení poradia
        const unsubscribeSettings = subscribeToTableSettings();
        
        const matchesRef = collection(window.db, 'matches');
        
        // Spočítame celkový počet zápasov pre prvotné načítanie
        const initialSnapshot = await getDocs(matchesRef);
        const totalMatchesCount = initialSnapshot.size;
        let loadedMatchesCount = 0;
        
        log(`📊 Celkový počet zápasov v databáze: ${totalMatchesCount}`);
        
        unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
            log(`🔄 Zmena v databáze: ${snapshot.size} zápasov celkom`);
            
            let completedMatchChanged = false;
            let changedMatches = []; // Ukladá zmenené zápasy pre neskoršie spracovanie
            
            snapshot.docChanges().forEach(change => {
                const match = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'added') {
                    matchesData[match.id] = match;
                    subscribeToMatchEvents(match.id);
                    loadedMatchesCount++;
                    log(`📊 Priebeh načítavania: ${loadedMatchesCount}/${totalMatchesCount} zápasov`);
                    
                } else if (change.type === 'modified') {
                    const oldMatch = matchesData[match.id];
                    matchesData[match.id] = match;
                    
                    // 🔥 KĽÚČOVÉ: Sledujeme zmenu stavu na "completed"
                    if (oldMatch && oldMatch.status !== match.status && match.status === 'completed') {
                        log(`✅ Zápas DOHRANÝ! Zmena stavu: ${getStatusText(oldMatch.status)} → ${getStatusText(match.status)}`);
                        completedMatchChanged = true;
                        changedMatches.push({
                            matchId: match.id,
                            category: match.categoryName,
                            group: match.groupName,
                            homeTeam: match.homeTeamIdentifier,
                            awayTeam: match.awayTeamIdentifier
                        });
                    } else if (oldMatch && oldMatch.status !== match.status) {
                        log(`🔄 Zmena stavu zápasu: ${getStatusText(oldMatch.status)} → ${getStatusText(match.status)} (nie je completed, ignorujem)`);
                    }
                    
                } else if (change.type === 'removed') {
                    log(`❌ Odstránený zápas: ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}`);
                    delete matchesData[match.id];
                    
                    if (unsubscribeEvents[match.id]) {
                        unsubscribeEvents[match.id]();
                        delete unsubscribeEvents[match.id];
                    }
                    delete eventsData[match.id];
                }
            });
            
            // ========== PRVOTNÉ NAČÍTANIE: AŽ KEĎ SÚ VŠETKY ZÁPASY NAČÍTANÉ ==========
            if (!isInitialDataLoaded && loadedMatchesCount === totalMatchesCount) {
                isInitialDataLoaded = true;
                log('🎉 VŠETKY ZÁPASY BOLI NAČÍTANÉ! Spúšťam prvotné vyhodnotenie...');
                log('📋 Najprv spracujem ZÁKLADNÉ SKUPINY...');
                
                // 1. Najprv spracujeme ZÁKLADNÉ SKUPINY (tie, ktoré nie sú nadstavbové)
                const allMatchesArray = Object.values(matchesData);
                const baseGroups = new Set();
                
                allMatchesArray.forEach(match => {
                    if (match.isPlacementMatch) return;
                    const isAdvancedGroup = match.groupName && match.groupName.toLowerCase().includes('nadstavbová');
                    if (!isAdvancedGroup && match.categoryName && match.groupName) {
                        baseGroups.add(`${match.categoryName}|${match.groupName}`);
                    }
                });
                
                log(`📊 Nájdených ${baseGroups.size} základných skupín`);
                
                for (const groupKey of baseGroups) {
                    const [category, group] = groupKey.split('|');
                    const groupTable = createGroupTable(category, group);
                    if (groupTable) {
                        const completionPercentage = groupTable.completionPercentage;
                        log(`   📊 ${category} - ${group}: ${completionPercentage}% dokončených`);
                        if (completionPercentage == 100) {
                            log(`   ✅ ${category} - ${group} je KOMPLETNÁ (100%)`);
                            processedGroupsInitial.add(groupKey);
                        }
                    }
                }
                
                log('📋 Teraz spracujem NADSTAVBOVÉ SKUPINY...');
                
                const advancedGroups = new Set();
                allMatchesArray.forEach(match => {
                    if (match.isPlacementMatch) return;
                    const isAdvancedGroup = match.groupName && match.groupName.toLowerCase().includes('nadstavbová');
                    if (isAdvancedGroup && match.categoryName && match.groupName) {
                        advancedGroups.add(`${match.categoryName}|${match.groupName}`);
                    }
                });
                
                log(`📊 Nájdených ${advancedGroups.size} nadstavbových skupín`);
                
                for (const groupKey of advancedGroups) {
                    const [category, group] = groupKey.split('|');
                    let baseGroupName = null;
                    const groupLower = group.toLowerCase();
                    const matchGroupLetter = groupLower.replace('nadstavbová', '').trim().toUpperCase();
                    
                    if (matchGroupLetter) {
                        baseGroupName = `skupina ${matchGroupLetter}`;
                    }
                    
                    if (baseGroupName) {
                        const baseGroupKey = `${category}|${baseGroupName}`;
                        if (processedGroupsInitial.has(baseGroupKey)) {
                            log(`   ✅ ${category} - ${group} (základná ${baseGroupName} je hotová) - vyhodnocujem...`);
                            createAdvancedGroupTable(category, group, baseGroupName);
                        } else {
                            log(`   ⏳ ${category} - ${group} čaká na dokončenie základnej skupiny ${baseGroupName}`);
                        }
                    }
                }
            }
            
            // ========== SPRACOVANIE ZMENY: IBA KEĎ SA ZÁPAS UKONČIL ==========
            if (isInitialDataLoaded && completedMatchChanged && changedMatches.length > 0) {
                log(`🏁 Spúšťam prepočet tabuliek (${changedMatches.length} zápasov bolo dohraných)...`);
                
                const affectedGroups = new Set();
                const affectedCategories = new Set();
                
                for (const changedMatch of changedMatches) {
                    if (changedMatch.category && changedMatch.group) {
                        const groupKey = `${changedMatch.category}|${changedMatch.group}`;
                        affectedGroups.add(groupKey);
                        affectedCategories.add(changedMatch.category);
                    }
                }
                
                log(`📋 Ovplyvnené skupiny: ${Array.from(affectedGroups).join(', ')}`);
                
                // 1. Najprv prepočítame ovplyvnené ZÁKLADNÉ SKUPINY
                const groupsToPrint = new Set();  // ✅ NOVÉ: skupiny, ktoré naozaj potrebujeme vytlačiť
                
                for (const groupKey of affectedGroups) {
                    const [category, group] = groupKey.split('|');
                    const isAdvancedGroup = group.toLowerCase().includes('nadstavbová');
                    
                    if (!isAdvancedGroup) {
                        log(`   🔄 Prepočítavam základnú skupinu: ${category} - ${group}`);
                        const groupTable = createGroupTable(category, group);
                        groupsToPrint.add(groupKey);  // ✅ PRIDÁME túto skupinu na výpis
                        
                        if (groupTable && groupTable.completionPercentage == 100) {
                            log(`   ✅ ${category} - ${group} je teraz KOMPLETNÁ (100%)`);
                            processedGroupsInitial.add(groupKey);
                            
                            const advancedDependentGroups = findAdvancedGroupsDependingOn(category, group);
                            for (const advGroup of advancedDependentGroups) {
                                log(`   🔄 Prepočítavam nadstavbovú skupinu (závisí na ${group}): ${category} - ${advGroup}`);
                                createAdvancedGroupTable(category, advGroup, group);
                                groupsToPrint.add(`${category}|${advGroup}`);  // ✅ PRIDÁME nadstavbovú skupinu
                            }
                        }
                    }
                }
                
                // 2. Potom prepočítame NADSTAVBOVÉ SKUPINY
                for (const groupKey of affectedGroups) {
                    const [category, group] = groupKey.split('|');
                    const isAdvancedGroup = group.toLowerCase().includes('nadstavbová');
                    
                    if (isAdvancedGroup) {
                        const groupLetter = group.replace('nadstavbová', '').trim().toUpperCase();
                        const baseGroupName = `skupina ${groupLetter}`;
                        const baseGroupKey = `${category}|${baseGroupName}`;
                        
                        if (processedGroupsInitial.has(baseGroupKey)) {
                            log(`   🔄 Prepočítavam nadstavbovú skupinu: ${category} - ${group}`);
                            createAdvancedGroupTable(category, group, baseGroupName);
                            groupsToPrint.add(groupKey);  // ✅ PRIDÁME túto skupinu
                        }
                    }
                }
                
                // ✅ TERAZ VYPRINTUJEME LEN OVPLYVNENÉ SKUPINY, NIE VŠETKY
                log(`📋 Vypisujem len ovplyvnené skupiny (${groupsToPrint.size}):`);
                for (const groupKey of groupsToPrint) {
                    const [category, group] = groupKey.split('|');
                    printGroupTable(category, group);
                }
                
                // Vyvoláme udalosť pre ostatné časti systému
                if (window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('groupTablesUpdated', {
                        detail: { 
                            reason: 'match_completed', 
                            timestamp: Date.now(),
                            affectedGroups: Array.from(affectedGroups),
                            affectedCategories: Array.from(affectedCategories),
                            printedGroups: Array.from(groupsToPrint)
                        }
                    }));
                }
            }
            
        }, (error) => {
            error('❌ Chyba pri sledovaní zápasov:', error);
        });
        
        const matchesSnapshot = await getDocs(matchesRef);
        for (const doc of matchesSnapshot.docs) {
            const matchId = doc.id;
            subscribeToMatchEvents(matchId);
        }
        
        window.__unsubscribeTableSettings = unsubscribeSettings;
        await loadCategorySettings();
        const unsubscribeCategorySettings = subscribeToCategorySettingsChanges();
        window.__unsubscribeCategorySettings = unsubscribeCategorySettings;
    }

    // ========== POMOCNÁ FUNKCIA: Nájdenie nadstavbových skupín závislých na základnej ==========
    function findAdvancedGroupsDependingOn(category, baseGroupName) {
        const advancedGroups = new Set();
        const allMatches = Object.values(matchesData);
        
        // Extrahujeme písmeno základnej skupiny (napr. "skupina A" -> "A")
        const baseGroupLetter = baseGroupName.replace('skupina ', '').toUpperCase();
    
        for (const match of allMatches) {
            if (match.isPlacementMatch) continue;
            
            if (match.categoryName === category && match.groupName) {
                const groupLower = match.groupName.toLowerCase();
                // Hľadáme nadstavbové skupiny, ktoré obsahujú rovnaké písmeno
                if (groupLower.includes('nadstavbová') && groupLower.includes(baseGroupLetter.toLowerCase())) {
                    advancedGroups.add(match.groupName);
                }
            }
        }
        
        return Array.from(advancedGroups);
    }
    
    // Sledovanie udalostí pre konkrétny zápas
    function subscribeToMatchEvents(matchId) {
        if (!window.db) return;
        
        const { collection, query, where, onSnapshot } = window.firebaseModules;
        
        if (!collection) return;
        
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('matchId', '==', matchId));
        
        if (unsubscribeEvents[matchId]) {
            unsubscribeEvents[matchId]();
        }
        
        unsubscribeEvents[matchId] = onSnapshot(q, (snapshot) => {
            const events = [];
            snapshot.forEach(doc => {
                events.push({ id: doc.id, ...doc.data() });
            });
            
            events.sort((a, b) => {
                if (a.minute !== b.minute) return (a.minute || 0) - (b.minute || 0);
                return (a.second || 0) - (b.second || 0);
            });
            
            const oldEventsCount = eventsData[matchId]?.length || 0;
            eventsData[matchId] = events;
            
            const match = matchesData[matchId];
            if (match && match.status === 'completed' && events.length !== oldEventsCount) {
//                log(`🔄 Aktualizácia udalostí pre zápas ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}`);
            }
            
        }, (error) => {
            error(`❌ Chyba pri sledovaní udalostí pre zápas ${matchId}:`, error);
        });
    }
    
    // Pomocná funkcia na import Firebase modulov
    async function importFirebaseModules() {
        try {
            const module = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
            window.firebaseModules = {
                collection: module.collection,
                query: module.query,
                where: module.where,
                onSnapshot: module.onSnapshot,
                doc: module.doc,
                getDoc: module.getDoc,
                getDocs: module.getDocs
            };
            return window.firebaseModules;
        } catch (error) {
            error('❌ Chyba pri načítaní Firebase modulov:', error);
            return {};
        }
    }
    
    // Funkcie pre manuálne ovládanie
    function refresh() {
        printAllGroupTables();
    }
    
    function stop() {
        if (unsubscribeMatches) {
            unsubscribeMatches();
            unsubscribeMatches = null;
        }
        
        Object.values(unsubscribeEvents).forEach(unsubscribe => {
            if (unsubscribe) unsubscribe();
        });
        unsubscribeEvents = {};
        
        if (window.__unsubscribeTableSettings) {
            window.__unsubscribeTableSettings();
            window.__unsubscribeTableSettings = null;
        }
        
        matchesData = {};
        eventsData = {};
        
        log('⏹️ Sledovanie zápasov zastavené');
    }

    function subscribeToCategorySettingsChanges() {
        if (!window.db) return;
        
        const { doc, onSnapshot } = window.firebaseModules;
        if (!doc || !onSnapshot) return;
        
        const categoriesRef = doc(window.db, 'settings', 'categories');
        
        return onSnapshot(categoriesRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                let cacheResetNeeded = false;
                
                for (const [catId, catData] of Object.entries(data)) {
                    const categoryName = catData.name;
                    const oldSetting = categorySettingsCache[categoryName]?.carryOverMatches;
                    const newSetting = catData.carryOverPoints ?? false;
                    
                    if (oldSetting !== undefined && oldSetting !== newSetting) {
                        log(`🔄 Zmena carryOverPoints pre kategóriu ${categoryName}: ${oldSetting} → ${newSetting}`);
                        cacheResetNeeded = true;
                        
                        // Vynulujeme cache pre všetky skupiny v tejto kategórii
                        for (const groupKey of processedCarryOverGroups) {
                            if (groupKey.startsWith(`${categoryName}|`)) {
                                processedCarryOverGroups.delete(groupKey);
                                log(`   🗑️ Vymazaná cache pre ${groupKey}`);
                            }
                        }
                    }
                    
                    // Aktualizujeme cache
                    categorySettingsCache[categoryName] = {
                        carryOverPoints: newSetting,
                        carryOverMatches: newSetting,
                        id: catId
                    };
                }
                
                if (cacheResetNeeded) {
                    log('🔄 Cache prenášania bola vynulovaná kvôli zmene nastavení');
                    // Spustíme opätovné vyhodnotenie tabuliek
                    printAllGroupTables();
                }
            }
        }, (error) => {
            error('❌ Chyba pri sledovaní zmien kategórií:', error);
        });
    }
    
    // Export funkcií do window
    window.matchTracker = {
        start: initializeMatchTracker,
        stop: stop,
        refresh: refresh,
        printCompleted: printCompletedMatches,
        printGroupTable: printGroupTable,
        printAllGroupTables: printAllGroupTables,
        printGroupsOverview: printGroupsOverview,
        createGroupTable: createGroupTable,
        getMatchDetails: getMatchDetails,
        getCompletedMatches: getCompletedMatches,
        getAllMatches: getAllMatches,
        getSortingConditions: () => tableSettings.sortingConditions,
        getMatches: () => matchesData,
        getEvents: (matchId) => eventsData[matchId] || [],
        createAdvancedGroupTable: createAdvancedGroupTable,
        getCategorySettings: () => categorySettingsCache,
        getCarryOverPoints: (categoryName) => categorySettingsCache[categoryName]?.carryOverPoints ?? false,
        getTeamNameByDisplayId: getTeamNameByDisplayId,
        findTeamInUsers: findTeamInUsersByGroupAndOrder,
        isGroupFullyCompleted: isGroupFullyCompleted,
        findAdvancedGroupsDependingOn: findAdvancedGroupsDependingOn,
        isInitialDataLoaded: () => isInitialDataLoaded,
        resetCarryOverCache: resetCarryOverCache,
        getGroupMatches: getGroupMatches
    };
    
    // Spustenie sledovania
    initializeMatchTracker();
    
    log('📡 MatchTracker inicializovaný. Dostupné funkcie:');
    log('   • window.matchTracker.printAllGroupTables() - výpis všetkých tabuliek skupín');
    log('   • window.matchTracker.printGroupTable("kategória", "skupina") - výpis tabuľky pre konkrétnu skupinu');
    log('   • window.matchTracker.printGroupsOverview() - výpis prehľadu všetkých skupín');
    log('   • window.matchTracker.printCompleted() - výpis odohraných zápasov');
    log('   • window.matchTracker.createGroupTable("kategória", "skupina") - získanie tabuľky ako objekt');
    log('   • window.matchTracker.getSortingConditions() - získanie aktuálnych kritérií poradia');
    log('   • window.matchTracker.refresh() - obnovenie výpisu');
    log('   • window.matchTracker.stop() - zastavenie sledovania');
    
})();

// --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


// Pomocná funkcia na odstránenie "VS" z názvu kategórie
function cleanCategoryName(categoryName) {
    if (!categoryName) return categoryName;
    
    // Odstránime "VS" s medzerami (napr. "U12 D VS" -> "U12 D", "U12 VS D" -> "U12 D")
    let cleaned = categoryName.replace(/\s+VS\s+/g, ' ').replace(/\s+VS$/g, '').replace(/^VS\s+/g, '');
    
    // Odstránime viacnásobné medzery
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
}

// ** LOKÁLNE ÚLOŽISKO PRE NAHRADENÉ IDENTIFIKÁTORY **
const STORAGE_KEY = 'teamNameReplacer_cache';
const CACHE_VERSION = '1.0';

// Načítanie cache z localStorage
function loadReplacementCache() {
    try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            if (data.version === CACHE_VERSION) {
                log(`📦 Načítaná cache z localStorage: ${Object.keys(data.mappings).length} položiek`);
                return new Map(Object.entries(data.mappings));
            } else {
                log('🔄 Verzia cache sa líši, vytváram novú...');
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    } catch (error) {
        error('❌ Chyba pri načítaní cache:', error);
    }
    return new Map();
}

// Uloženie cache do localStorage
function saveReplacementCache(cacheMap) {
    try {
        const data = {
            version: CACHE_VERSION,
            mappings: Object.fromEntries(cacheMap),
            lastUpdated: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        log(`💾 Uložená cache do localStorage: ${cacheMap.size} položiek`);
    } catch (error) {
        error('❌ Chyba pri ukladaní cache:', error);
    }
}

// Inicializácia cache
let replacementCache = loadReplacementCache();
window.__internalReplacementCache = {
    get: () => replacementCache,
    clear: () => {
        replacementCache.clear();
        replacementCache = new Map();
        localStorage.removeItem('teamNameReplacer_cache');
    }
};

// Funkcia na získanie názvu tímu (najskôr z cache, potom z databázy)
function getTeamNameWithCache(displayId, category, groupLetter, position) {
    const cacheKey = `${cleanCategoryName(category)}|${groupLetter.toUpperCase()}|${position}`;
    
    // 1. Skúsime nájsť v cache
    if (replacementCache.has(cacheKey)) {
        const cached = replacementCache.get(cacheKey);
        log(`💿 POUŽITÉ Z CACHE: "${displayId}" → "${cached.teamName}" (uložené ${new Date(cached.timestamp).toLocaleTimeString()})`);
        return cached.teamName;
    }
    
    // 2. Nie je v cache - načítame z databázy
    log(`🔄 NAČÍTAM Z DATABÁZY: "${displayId}"`);
    const teamName = getTeamNameByDisplayIdFromDB(displayId);
    
    // 3. Ak sa podarilo načítať, uložíme do cache
    if (teamName && teamName !== displayId) {
        replacementCache.set(cacheKey, {
            teamName: teamName,
            displayId: displayId,
            category: category,
            groupLetter: groupLetter,
            position: position,
            timestamp: Date.now()
        });
        saveReplacementCache(replacementCache);
        log(`💾 ULOŽENÉ DO CACHE: "${displayId}" → "${teamName}"`);
    }
    
    return teamName;
}

// Pôvodná funkcia getTeamNameByDisplayId premenovaná na getTeamNameByDisplayIdFromDB
function getTeamNameByDisplayIdFromDB(displayId) {
    if (!displayId) {
        log('❌ Nebol zadaný identifikátor tímu');
        return null;
    }
    
    // Parsovanie identifikátora
    const parts = displayId.trim().split(' ');
    
    if (parts.length < 2) {
        log(`❌ Neplatný formát identifikátora: ${displayId}`);
        return null;
    }
    
    const positionAndGroup = parts.pop();
    let category = parts.join(' ');
    const originalCategory = category;
    category = cleanCategoryName(category);
    
    // Extrahujeme pozíciu a písmeno skupiny
    let position = '';
    let groupLetter = '';
    
    for (let i = 0; i < positionAndGroup.length; i++) {
        const char = positionAndGroup[i];
        if (char >= '0' && char <= '9') {
            position += char;
        } else if (/[A-Za-z]/.test(char)) {
            groupLetter += char;
        }
    }
    
    if (!position || !groupLetter) {
        log(`❌ Neplatný formát pozície/skupiny: ${positionAndGroup}`);
        return null;
    }
    
    const positionNum = parseInt(position, 10);
    const fullGroupName = `skupina ${groupLetter.toUpperCase()}`;
    
    // Kontrola pripravenosti skupiny
    const isReady = isGroupReadyForReplacement(category, groupLetter);
    
    if (!isReady) {
//        log(`⛔ [${category} - ${fullGroupName}] Skupina NIE JE pripravená`);
        return null;
    }
    
    log(`✅ [${category} - ${fullGroupName}] Skupina je pripravená, hľadám tím na pozícii ${positionNum}`);
    
    const groupTable = window.matchTracker?.createGroupTable(category, fullGroupName);
    
    if (!groupTable || !groupTable.teams || groupTable.teams.length === 0) {
        log(`❌ Tabuľka pre skupinu ${fullGroupName} neexistuje`);
        return null;
    }
    
    const teamIndex = positionNum - 1;
    
    if (teamIndex >= 0 && teamIndex < groupTable.teams.length) {
        const team = groupTable.teams[teamIndex];
        log(`🎉 NAJDENÝ V DB: "${displayId}" → "${team.name}"`);
        return team.name;
    } else {
        log(`❌ Pozícia ${positionNum} neexistuje (skupina má ${groupTable.teams.length} tímov)`);
        return null;
    }
}



// Prepíšeme pôvodnú getTeamNameByDisplayId na verziu s cache
// Funkcia na získanie názvu tímu LEN Z CACHE (bez kontroly pripravenosti)
function getTeamNameFromCacheOnly(displayId) {
    const parts = displayId.trim().split(' ');
    if (parts.length < 2) return null;
    
    const positionAndGroup = parts.pop();
    let category = parts.join(' ');
    category = cleanCategoryName(category);
    
    let position = '';
    let groupLetter = '';
    for (let i = 0; i < positionAndGroup.length; i++) {
        const char = positionAndGroup[i];
        if (char >= '0' && char <= '9') {
            position += char;
        } else if (/[A-Za-z]/.test(char)) {
            groupLetter += char;
        }
    }
    
    if (!position || !groupLetter) return null;
    const positionNum = parseInt(position, 10);
    const cacheKey = `${category}|${groupLetter.toUpperCase()}|${positionNum}`;
    
    // Iba z cache, žiadne volanie do databázy
    if (replacementCache.has(cacheKey)) {
        const cached = replacementCache.get(cacheKey);
//        log(`💿 POUŽITÉ Z CACHE (rýchle): "${displayId}" → "${cached.teamName}"`);
        return cached.teamName;
    }
    
    return null;
}

// Funkcia na získanie názvu tímu z databázy (s kontrolou pripravenosti)
function getTeamNameFromDatabase(displayId) {
    log(`🔄 NAČÍTAM Z DATABÁZY: "${displayId}"`);
    
    // Parsovanie identifikátora
    const parts = displayId.trim().split(' ');
    if (parts.length < 2) return null;
    
    const positionAndGroup = parts.pop();
    let category = parts.join(' ');
    category = cleanCategoryName(category);
    
    let position = '';
    let groupLetter = '';
    for (let i = 0; i < positionAndGroup.length; i++) {
        const char = positionAndGroup[i];
        if (char >= '0' && char <= '9') {
            position += char;
        } else if (/[A-Za-z]/.test(char)) {
            groupLetter += char;
        }
    }
    
    if (!position || !groupLetter) return null;
    const positionNum = parseInt(position, 10);
    const fullGroupName = `skupina ${groupLetter.toUpperCase()}`;
    
    // 🔴 KONTROLA PRIPRAVENOSTI - BEZ TOHO NENAČÍTAME Z DB
    const isReady = isGroupReadyForReplacement(category, groupLetter);
    if (!isReady) {
//        log(`⛔ [${category} - ${fullGroupName}] Skupina NIE JE pripravená, nenačítam z DB`);
        return null;
    }
    
    const groupTable = window.matchTracker?.createGroupTable(category, fullGroupName);
    if (!groupTable || !groupTable.teams || groupTable.teams.length === 0) {
        log(`❌ Tabuľka pre skupinu ${fullGroupName} neexistuje`);
        return null;
    }
    
    const teamIndex = positionNum - 1;
    if (teamIndex >= 0 && teamIndex < groupTable.teams.length) {
        const team = groupTable.teams[teamIndex];
        log(`🎉 NAJDENÝ V DB: "${displayId}" → "${team.name}"`);
        
        // Uložíme do cache
        const cacheKey = `${category}|${groupLetter.toUpperCase()}|${positionNum}`;
        replacementCache.set(cacheKey, {
            teamName: team.name,
            displayId: displayId,
            category: category,
            groupLetter: groupLetter.toUpperCase(),
            position: positionNum,
            timestamp: Date.now()
        });
        saveReplacementCache(replacementCache);
        
        return team.name;
    }
    
    return null;
}

// ============================================================
// OPRAVENÁ FUNKCIA: getTeamNameByDisplayId - SPRÁVNE SPRACOVANIE FORMÁTOV
// ============================================================

function getTeamNameByDisplayId(displayId, forceRefresh = false) {
    if (!displayId) {
        return null;
    }
    
    // Parsovanie identifikátora
    const parts = displayId.trim().split(' ');
    
    if (parts.length < 2) {
        return null;
    }
    
    const lastPart = parts[parts.length - 1];
    let category = parts.slice(0, -1).join(' ');
    category = cleanCategoryName(category);
    
    // 🔥 KONTROLA: Ak posledná časť neobsahuje ŽIADNU ČÍSLICU, nie je to platný identifikátor
    if (!/\d/.test(lastPart)) {
        return null;
    }
    
    // Rozlíšenie formátu:
    // "A1" = písmeno + číslo → PREDBEŽNÉ poradie (berie aktuálne poradie podľa mien, nie podľa výsledkov)
    // "1A" = číslo + písmeno → KONEČNÉ poradie (vyžaduje 100% odohrané zápasy)
    let isPreliminaryFormat = false;  // "A1" - písmeno PRED číslom
    let isFinalFormat = false;        // "1A" - číslo PRED písmenom
    let order = null;
    let groupLetter = null;
    
    // Kontrola, či začína písmenom (formát "A1")
    const startsWithLetter = /^[A-Za-z]/.test(lastPart);
    // Kontrola, či začína číslom (formát "1A")
    const startsWithNumber = /^\d/.test(lastPart);
    
    if (startsWithLetter) {
        // Formát "A1" - PREDBEŽNÉ poradie
        isPreliminaryFormat = true;
        const letterMatch = lastPart.match(/^([A-Za-z]+)/);
        const numberMatch = lastPart.match(/\d+$/);
        if (letterMatch && numberMatch) {
            groupLetter = letterMatch[0].toUpperCase();
            order = parseInt(numberMatch[0], 10);
        }
    } else if (startsWithNumber) {
        // Formát "1A" - KONEČNÉ poradie
        isFinalFormat = true;
        const numberMatch = lastPart.match(/^\d+/);
        const letterMatch = lastPart.match(/[A-Za-z]+$/);
        if (numberMatch && letterMatch) {
            order = parseInt(numberMatch[0], 10);
            groupLetter = letterMatch[0].toUpperCase();
        }
    }
    
    if (!order || !groupLetter) {
        return null;
    }
    
    // ============================================================
    // PRÍPAD 1: Formát "A1" (písmeno PRED číslom) - PREDBEŽNÉ PORADIE
    // Vracia tím podľa PÔVODNÉHO poradia (podľa názvov, nie podľa výsledkov)
    // ============================================================
    if (isPreliminaryFormat) {
        const fullGroupName = `skupina ${groupLetter}`;
        
        // Skúsime nájsť tím v pôvodnom poradí z groupsData
        const preliminaryTeam = getTeamFromPreliminaryOrder(category, groupLetter, order);
        if (preliminaryTeam) {
            return preliminaryTeam;
        }
        
        // Fallback: použijeme createGroupTable ale zoradíme podľa ID (nie podľa bodov)
        const groupTable = window.matchTracker?.createGroupTable(category, fullGroupName);
        if (groupTable && groupTable.teams && groupTable.teams.length >= order) {
            // Zoradíme tímy podľa pôvodného poradia (extrahované číslo z názvu)
            const sortedByOriginalOrder = [...groupTable.teams].sort((a, b) => {
                const aNum = extractNumberFromTeamName(a.name) || extractNumberFromTeamName(a.id) || 999;
                const bNum = extractNumberFromTeamName(b.name) || extractNumberFromTeamName(b.id) || 999;
                if (aNum !== bNum) return aNum - bNum;
                return a.name.localeCompare(b.name);
            });
            
            const teamIndex = order - 1;
            if (teamIndex >= 0 && teamIndex < sortedByOriginalOrder.length) {
                return sortedByOriginalOrder[teamIndex].name;
            }
        }
        
        // Posledná možnosť: z userTeams
        const userTeam = findTeamInUsersByGroupAndOrder(category, groupLetter, order);
        if (userTeam && userTeam.teamName) {
            return userTeam.teamName;
        }
        
        return null;
    }
    
    // ============================================================
    // PRÍPAD 2: Formát "1A" (číslo PRED písmenom) - KONEČNÉ PORADIE
    // VYŽADUJE 100% ODOHRANÝCH ZÁPASOV
    // ============================================================
    if (isFinalFormat) {
        const baseGroupName = `skupina ${groupLetter}`;
        // 🔥 OPRAVA: Skúsime oba možné názvy nadstavbovej skupiny
        const advancedGroupName1 = `nadstavbová skupina ${groupLetter}`;
        const advancedGroupName2 = `skupina ${groupLetter}`;  // Niektoré skupiny sa volajú len "skupina G"
        
        // 1. SKÚSIME NADSTAVBOVÚ SKUPINU (ak existuje a je 100%)
        let advancedGroupTable = null;
        
        // Skúsime prvý variant názvu
        if (forceRefresh) {
            advancedGroupTable = window.matchTracker?.createAdvancedGroupTable?.(category, advancedGroupName1, null, true);
        } else {
            advancedGroupTable = window.matchTracker?.createAdvancedGroupTable?.(category, advancedGroupName1, null);
        }
        
        // Ak prvý variant nefunguje, skúsime druhý
        if (!advancedGroupTable || advancedGroupTable.teams.length === 0) {
            if (forceRefresh) {
                advancedGroupTable = window.matchTracker?.createAdvancedGroupTable?.(category, advancedGroupName2, null, true);
            } else {
                advancedGroupTable = window.matchTracker?.createAdvancedGroupTable?.(category, advancedGroupName2, null);
            }
        }
        
        const advancedExists = advancedGroupTable && advancedGroupTable.teams && advancedGroupTable.teams.length > 0;
        const isAdvancedComplete = advancedExists ? advancedGroupTable.completionPercentage === 100 : false;
        
        if (advancedExists && isAdvancedComplete) {
            const teamIndex = order - 1;
            if (teamIndex >= 0 && teamIndex < advancedGroupTable.teams.length) {
                let team = advancedGroupTable.teams[teamIndex];
                
                // Ak je názov stále identifikátor, skúsime ho ešte raz namapovať
                if (/[0-9]+[A-Za-z]+|[A-Za-z]+[0-9]+/.test(team.name)) {
                    const recursiveResult = getTeamNameByDisplayId(team.name, true);
                    if (recursiveResult && recursiveResult !== team.name) {
                        return recursiveResult;
                    }
                }
                
                log(`✅ getTeamNameByDisplayId("${displayId}") → "${team.name}" (z nadstavbovej skupiny ${advancedGroupTable.group})`);
                return team.name;
            }
        }
        
        // 2. INÁK SKÚSIME ZÁKLADNÚ SKUPINU (ak je 100%)
        const baseGroupTable = window.matchTracker?.createGroupTable(category, baseGroupName);
        const isBaseComplete = baseGroupTable ? baseGroupTable.completionPercentage === 100 : false;
        
        if (isBaseComplete) {
            const teamIndex = order - 1;
            if (teamIndex >= 0 && teamIndex < baseGroupTable.teams.length) {
                let team = baseGroupTable.teams[teamIndex];
                
                // Ak je názov stále identifikátor, skúsime ho ešte raz namapovať
                if (/[0-9]+[A-Za-z]+|[A-Za-z]+[0-9]+/.test(team.name)) {
                    const recursiveResult = getTeamNameByDisplayId(team.name, true);
                    if (recursiveResult && recursiveResult !== team.name) {
                        return recursiveResult;
                    }
                }
                
                log(`✅ getTeamNameByDisplayId("${displayId}") → "${team.name}" (zo základnej skupiny ${baseGroupName})`);
                return team.name;
            }
        }
        
        // 3. NIE JE 100% DOKONČENÉ - VRAĆAME NULL
        const basePercent = baseGroupTable?.completionPercentage || 0;
        const advPercent = advancedGroupTable?.completionPercentage || 0;
//        log(`⏳ KONEČNÉ poradie (${order}${groupLetter}) nie je k dispozícii: základná skupina ${basePercent}%, nadstavbová ${advPercent}%`);
        return null;
    }
    
    return null;
}

// ============================================================
// POMOCNÁ FUNKCIA: Získanie tímu z pôvodného poradia (z groupsData)
// ============================================================
function getTeamFromPreliminaryOrder(category, groupLetter, order) {
    // 1. Skúsime nájsť v používateľských dátach
    const userTeam = findTeamInUsersByGroupAndOrder(category, groupLetter, order);
    if (userTeam && userTeam.teamName) {
        return userTeam.teamName;
    }
    
    // 2. Skúsime získať z groupsData
    const groupsData = window.groupsData || {};
    const categoryId = window.categoryIdMap?.[category] || null;
    
    if (categoryId && groupsData[categoryId]) {
        const fullGroupName = `skupina ${groupLetter}`;
        const groupInfo = groupsData[categoryId].find(g => g.name === fullGroupName);
        if (groupInfo && groupInfo.teams && groupInfo.teams[order - 1]) {
            return groupInfo.teams[order - 1].name;
        }
    }
    
    return null;
}

// ============================================================
// POMOCNÁ FUNKCIA: Extrahovanie čísla z názvu tímu
// ============================================================
function extractNumberFromTeamName(teamName) {
    if (!teamName) return null;
    const match = teamName.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}

// Náhradná funkcia pre prípady, keď potrebujete explicitne rozlíšiť formáty
function getTeamNameByFormat(displayId, requireComplete = false) {
    // requireComplete = true  -> vyžaduje 100% (formát "1A")
    // requireComplete = false -> aktuálne poradie (formát "A1")
    
    const parts = displayId.trim().split(' ');
    if (parts.length < 2) return null;
    
    const lastPart = parts[parts.length - 1];
    let category = parts.slice(0, -1).join(' ');
    category = cleanCategoryName(category);
    
    let order = null;
    let groupLetter = null;
    
    // Automatické rozlíšenie formátu
    const startsWithLetter = /^[A-Za-z]/.test(lastPart);
    const startsWithNumber = /^\d/.test(lastPart);
    
    if (startsWithLetter) {
        // Formát "A1" - písmeno pred číslom
        const letterMatch = lastPart.match(/^([A-Za-z]+)/);
        const numberMatch = lastPart.match(/\d+$/);
        if (letterMatch && numberMatch) {
            groupLetter = letterMatch[0].toUpperCase();
            order = parseInt(numberMatch[0], 10);
        }
        // Pre formát "A1" ignorujeme requireComplete - vždy berieme aktuálne poradie
        return getTeamNameFromBaseGroup(category, groupLetter, order);
        
    } else if (startsWithNumber) {
        // Formát "1A" - číslo pred písmenom
        const numberMatch = lastPart.match(/^\d+/);
        const letterMatch = lastPart.match(/[A-Za-z]+$/);
        if (numberMatch && letterMatch) {
            order = parseInt(numberMatch[0], 10);
            groupLetter = letterMatch[0].toUpperCase();
        }
        // Pre formát "1A" vyžadujeme 100% kompletnosť
        return getTeamNameFromCompleteGroup(category, groupLetter, order);
    }
    
    return null;
}

function getTeamNameFromBaseGroup(category, groupLetter, order) {
    const fullGroupName = `skupina ${groupLetter}`;
    const groupTable = window.matchTracker?.createGroupTable(category, fullGroupName);
    
    if (!groupTable || !groupTable.teams || groupTable.teams.length === 0) {
        return null;
    }
    
    const teamIndex = order - 1;
    if (teamIndex >= 0 && teamIndex < groupTable.teams.length) {
        return groupTable.teams[teamIndex].name;
    }
    return null;
}

function getTeamNameFromCompleteGroup(category, groupLetter, order) {
    const fullGroupName = `skupina ${groupLetter}`;
    const advancedGroupName = `nadstavbová skupina ${groupLetter}`;
    
    // Skúsime najprv nadstavbovú skupinu
    const advancedTable = window.matchTracker?.createAdvancedGroupTable?.(category, advancedGroupName, null);
    if (advancedTable && advancedTable.completionPercentage === 100) {
        const teamIndex = order - 1;
        if (teamIndex >= 0 && teamIndex < advancedTable.teams.length) {
            return advancedTable.teams[teamIndex].name;
        }
    }
    
    // Inak základnú skupinu (musí byť 100%)
    const baseTable = window.matchTracker?.createGroupTable(category, fullGroupName);
    if (baseTable && baseTable.completionPercentage === 100) {
        const teamIndex = order - 1;
        if (teamIndex >= 0 && teamIndex < baseTable.teams.length) {
            return baseTable.teams[teamIndex].name;
        }
    }
    
    return null;
}


function clearCheckedGroupsCache() {
    checkedGroupsCache.clear();
    log('🗑️ Cache kontrolovaných skupín bola vymazaná');
}

// ============================================================
// POMOCNÁ FUNKCIA: Vyhľadanie tímu v používateľských dátach
// ============================================================

function findTeamInUsersByGroupAndOrder(category, groupLetter, order) {
    if (!window.db) return null;
    
    // Získame všetkých používateľov z globálneho stavu
    const users = window.__reactUsersState || [];
    
    for (const user of users) {
        if (!user.teams) continue;
        
        const userTeams = user.teams[category];
        if (!userTeams || !Array.isArray(userTeams)) continue;
        
        const fullGroupName = `skupina ${groupLetter}`;
        
        const team = userTeams.find(t => 
            t.groupName === fullGroupName && 
            t.order === order
        );
        
        if (team && team.teamName) {
            return {
                teamName: team.teamName,
                userId: user.id,
                userEmail: user.email,
                teamData: team
            };
        }
    }
    
    return null;
}

// Funkcia na vymazanie cache (napr. pri aktualizácii dát)
function clearReplacementCache() {
    replacementCache.clear();
    localStorage.removeItem(STORAGE_KEY);
    log('🗑️ Cache bola vymazaná');
}

// Funkcia na zobrazenie obsahu cache
function showCache() {
    log('\n📦 OBSAH CACHE:');
    log('='.repeat(60));
    for (const [key, value] of replacementCache.entries()) {
        log(`   ${key}:`);
        log(`      → ${value.teamName}`);
        log(`      📅 Uložené: ${new Date(value.timestamp).toLocaleString()}`);
    }
    log('='.repeat(60));
    log(`Celkom: ${replacementCache.size} položiek\n`);
}

// Funkcia na aktualizáciu cache z aktuálneho stavu stránky
function updateCacheFromPage() {
    log('🔄 Aktualizujem cache z aktuálneho stavu stránky...');
    const elements = document.querySelectorAll('[data-replaced-100-percent="true"]');
    let updated = 0;
    
    for (const element of elements) {
        const originalId = element.getAttribute('data-original-identifier');
        const teamName = element.getAttribute('data-team-name');
        const category = element.getAttribute('data-team-category');
        const groupLetter = element.getAttribute('data-team-group');
        const position = element.getAttribute('data-team-position');
        
        if (originalId && teamName && category && groupLetter && position) {
            const cacheKey = `${category}|${groupLetter}|${position}`;
            if (!replacementCache.has(cacheKey)) {
                replacementCache.set(cacheKey, {
                    teamName: teamName,
                    displayId: originalId,
                    category: category,
                    groupLetter: groupLetter,
                    position: parseInt(position, 10),
                    timestamp: Date.now()
                });
                updated++;
            }
        }
    }
    
    if (updated > 0) {
        saveReplacementCache(replacementCache);
        log(`✅ Aktualizovaných ${updated} položiek v cache`);
    } else {
        log('ℹ️ Žiadne nové položky na aktualizáciu');
    }
}

// Pridáme aj funkciu na vyhľadávanie podľa samostatných parametrov
function getTeamNameByParams(category, groupLetter, position) {
    // Odstránime "VS" z kategórie
    const cleanCategory = cleanCategoryName(category);
    const displayId = `${cleanCategory} ${position}${groupLetter.toUpperCase()}`;
    return getTeamNameByDisplayId(displayId);
}

// Pridáme funkciu na získanie kompletných informácií o tíme (vrátane štatistík) - LEN PRI 100%
function getTeamInfoByDisplayId(displayId) {
    if (!displayId) {
        log('❌ Nebol zadaný identifikátor tímu');
        return null;
    }
    
    const parts = displayId.trim().split(' ');
    if (parts.length < 2) {
        log(`❌ Neplatný formát identifikátora: ${displayId}`);
        return null;
    }
    
    const positionAndGroup = parts.pop();
    let category = parts.join(' ');
    
    // ODSTRÁNIME "VS" Z NÁZVU KATEGÓRIE
    const originalCategory = category;
    category = cleanCategoryName(category);
    
    if (category !== originalCategory) {
        log(`🔧 Upravený názov kategórie: "${originalCategory}" → "${category}"`);
    }
    
    let position = '';
    let groupLetter = '';
    
    for (let i = 0; i < positionAndGroup.length; i++) {
        const char = positionAndGroup[i];
        if (char >= '0' && char <= '9') {
            position += char;
        } else if (/[A-Za-z]/.test(char)) {
            groupLetter += char;
        }
    }
    
    if (!position || !groupLetter) {
        log(`❌ Neplatný formát pozície/skupiny: ${positionAndGroup}`);
        return null;
    }
    
    const positionNum = parseInt(position, 10);
    const fullGroupName = `skupina ${groupLetter.toUpperCase()}`;
    
    const groupTable = window.matchTracker?.createGroupTable(category, fullGroupName);
    
    if (groupTable && groupTable.teams && groupTable.teams.length > 0) {
        const totalMatches = groupTable.totalMatches || 0;
        const completedMatches = groupTable.completedCount || 0;
        const completionPercentage = totalMatches > 0 ? (completedMatches / totalMatches * 100) : 0;
        
        log(`📊 Stav skupiny: ${completedMatches}/${totalMatches} odohraných (${completionPercentage}%)`);
        
        if (completionPercentage < 100) {
            log(`❌ Zápasy v skupine nie sú kompletne odohrané! (${completionPercentage}% dokončených)`);
            log(`   Pre zobrazenie konečného poradia je potrebné odohrať všetkých ${totalMatches} zápasov.`);
            return null;
        }
        
        const teamIndex = positionNum - 1;
        if (teamIndex >= 0 && teamIndex < groupTable.teams.length) {
            const team = groupTable.teams[teamIndex];
            log(`✅ Nájdený tím: ${team.name}`);
            log(`   📊 Štatistiky: Zápasy: ${team.played}, Výhry: ${team.wins}, Remízy: ${team.draws}, Prehry: ${team.losses}`);
            log(`   🥅 Skóre: ${team.goalsFor}:${team.goalsAgainst} (${team.goalDifference > 0 ? '+' : ''}${team.goalDifference})`);
            log(`   📈 Body: ${team.points}`);
            return team;
        }
    }
    
    log(`❌ Tím nebol nájdený: ${displayId}`);
    return null;
}

// Aktualizovaná funkcia extractIdentifiersFromText - lepšie filtrovanie a vždy vracia pole
function extractIdentifiersFromText(text) {
    // Ak text nie je reťazec, vrátime prázdne pole
    if (typeof text !== 'string' || !text) {
        log('ℹ️ extractIdentifiersFromText: text nie je platný reťazec');
        return [];
    }
    
    // Regulárny výraz na nájdenie identifikátorov - musí začínať písmenom a obsahovať medzeru pred číslom+písmenom
    const teamIdPattern = /(?<![A-Za-z0-9])([A-Za-z][A-Za-z0-9\s]*?)\s+(\d+[A-Za-z])(?![A-Za-z0-9])/g;
    const identifiers = [];
    let match;
    
    // Rozdelíme text na riadky a spracujeme každý zvlášť
    const lines = text.split(/\r?\n/);
    
    for (const line of lines) {
        // Preskočíme prázdne riadky
        if (!line || line.trim() === '') continue;
        
        teamIdPattern.lastIndex = 0;
        while ((match = teamIdPattern.exec(line)) !== null) {
            let categoryPart = match[1].trim();
            const numberLetter = match[2];
            
            // Kontrola, či categoryPart neobsahuje nežiaduce slová
            const unwantedWords = ['zápas', 'udalosti', 'priebeh', 'skupina', 'tím', 'kategória', 'vs', 'VS', 'gól', 'červená', 'žltá'];
            let skip = false;
            for (const word of unwantedWords) {
                if (categoryPart.toLowerCase().includes(word.toLowerCase())) {
                    skip = true;
                    break;
                }
            }
            if (skip) continue;
            
            // Kontrola, či categoryPart vyzerá ako platná kategória (začína písmenom a číslom)
            if (!/^[A-Za-z]+\d+/.test(categoryPart) && !/^[A-Za-z]+\s+[A-Za-z]+\d+/.test(categoryPart)) {
                // Možno je to ešte validný formát (napr. "U12 D")
                if (!/^[A-Za-z0-9\s]+$/.test(categoryPart)) {
                    continue;
                }
            }
            
            // Odstránime "VS" z názvu kategórie
            const originalCategory = categoryPart;
            categoryPart = cleanCategoryName(categoryPart);
            
            // Kontrola, či po očistení nie je prázdny reťazec
            if (!categoryPart || categoryPart.length < 2) continue;
            
            const identifier = `${categoryPart} ${numberLetter}`;
            
            // Extrahujeme pozíciu a písmeno skupiny
            let position = '';
            let groupLetter = '';
            for (let i = 0; i < numberLetter.length; i++) {
                const char = numberLetter[i];
                if (char >= '0' && char <= '9') {
                    position += char;
                } else if (/[A-Za-z]/.test(char)) {
                    groupLetter += char;
                }
            }
            
            if (!position || !groupLetter) continue;
            
            identifiers.push({
                identifier: identifier,
                originalIdentifier: `${originalCategory} ${numberLetter}`,
                category: categoryPart,
                originalCategory: originalCategory,
                position: parseInt(position, 10),
                groupLetter: groupLetter.toUpperCase(),
                fullMatch: match[0],
                startIndex: match.index,
                endIndex: match.index + match[0].length
            });
        }
    }
    
    // Odstránime duplicitné identifikátory
    const uniqueIdentifiers = [];
    const seen = new Set();
    for (const id of identifiers) {
        const key = `${id.category}|${id.groupLetter}|${id.position}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueIdentifiers.push(id);
        }
    }
    
    return uniqueIdentifiers;
}

let groupStabilityCheck = new Map(); // Ukladá timeouty pre každú skupinu
let lastGroupMatchCount = new Map(); // Ukladá posledný počet zápasov pre každú skupinu
let notReadyGroupsLogged = new Set();

function isGroupReadyForReplacement(category, groupLetter) {
    const cleanCategory = cleanCategoryName(category);
    const fullGroupName = `skupina ${groupLetter.toUpperCase()}`;
    const groupKey = `${cleanCategory}|${groupLetter.toUpperCase()}`;
    
    // Cache
    if (groupCheckCache.has(groupKey)) {
        return true;
    }
    
    // Použijeme priamo createGroupTable namiesto getGroupMatches
    const groupTable = window.matchTracker?.createGroupTable(cleanCategory, fullGroupName);
    
    if (!groupTable) {
        return false;
    }
    
    // Kontrola, či je 100% dokončená (rovnaká logika ako v tabuľke)
    const isFullyCompleted = groupTable.completionPercentage === 100;
    
    if (isFullyCompleted) {
        log(`✅ [${cleanCategory} - ${fullGroupName}] SKUPINA JE PRIPRAVENÁ! (${groupTable.completionPercentage}%)`);
        groupCheckCache.add(groupKey);
        return true;
    }
    
//    log(`⏳ [${cleanCategory} - ${fullGroupName}] Len ${groupTable.completedCount}/${groupTable.totalMatches} odohraných → NIE JE PRIPRAVENÁ`);
    groupCheckCache.add(`${groupKey}_false`);
    return false;
}

function getCurrentScoreFromEvents(events) {
    if (!events || events.length === 0) {
        return { home: 0, away: 0 };
    }
    
    const sortedEvents = [...events].sort((a, b) => {
        if (a.minute !== b.minute) return (a.minute || 0) - (b.minute || 0);
        return (a.second || 0) - (b.second || 0);
    });
    
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    
    if (lastEvent && lastEvent.scoreAfter) {
        return {
            home: lastEvent.scoreAfter.home || 0,
            away: lastEvent.scoreAfter.away || 0
        };
    }
    
    let homeScore = 0;
    let awayScore = 0;
    
    sortedEvents.forEach(event => {
        if (event.type === 'goal') {
            if (event.team === 'home') homeScore++;
            else if (event.team === 'away') awayScore++;
        } else if (event.type === 'penalty' && event.subType === 'scored') {
            if (event.team === 'home') homeScore++;
            else if (event.team === 'away') awayScore++;
        }
    });
    
    return { home: homeScore, away: awayScore };
}

// ** POSILNENÁ FUNKCIA: performPartialReplacement - BEZ BLOKOVANIA UŽ NAHRADENÝCH **
function performPartialReplacement(identifiersToReplace) {
    if (isReplacingInProgress) {
        log('⏳ Nahrádzanie už prebieha, preskakujem...');
        return;
    }
    
    isReplacingInProgress = true;
    
    log(`🔍 Spúšťam čiastočné nahrádzanie (${identifiersToReplace.length} identifikátorov)...`);
    
    let replacedCount = 0;
    let failedCount = 0;
    let fromCacheCount = 0;
    let fromDbCount = 0;
    const failedIdentifiers = [];
    
    for (const idInfo of identifiersToReplace) {
        // 🔴 ODSTRÁNENÁ KONTROLA replacedIdentifiers - nahrádzame VŽDY
        
        // Najprv skúsime cache (rýchle)
        let teamName = getTeamNameFromCacheOnly(idInfo.identifier);
        let fromCache = true;
        
        if (!teamName) {
            teamName = getTeamNameFromCacheOnly(idInfo.originalIdentifier);
        }
        
        // Ak nie je v cache, načítame z databázy
        if (!teamName) {
            fromCache = false;
            teamName = getTeamNameFromDatabase(idInfo.identifier);
            if (!teamName) {
                teamName = getTeamNameFromDatabase(idInfo.originalIdentifier);
            }
        }
        
        if (teamName && teamName !== idInfo.identifier && teamName !== idInfo.originalIdentifier) {
            const escapedIdentifier = idInfo.originalIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedIdentifier, 'g');
            
            const elements = document.querySelectorAll('*');
            let anyFound = false;
            
            for (const element of elements) {
                if (element.children.length > 0) continue;
                
                const text = element.textContent;
                if (text && text.includes(idInfo.originalIdentifier)) {
                    const newText = text.replace(regex, teamName);
                    if (newText !== text) {
                        element.textContent = newText;
                        anyFound = true;
                        const source = fromCache ? 'CACHE' : 'DB';
                        if (fromCache) fromCacheCount++;
                        else fromDbCount++;
                        log(`✅ NAHRADENÝ (${source}): "${idInfo.originalIdentifier}" → "${teamName}" v elemente: ${element.tagName}`);
                        
                        // Uložíme atribúty pre prípadnú potrebu
                        element.setAttribute('data-original-identifier', idInfo.identifier);
                        element.setAttribute('data-original-category', idInfo.originalCategory);
                        element.setAttribute('data-team-category', idInfo.category);
                        element.setAttribute('data-team-position', idInfo.position);
                        element.setAttribute('data-team-group', idInfo.groupLetter);
                        element.setAttribute('data-team-name', teamName);
                        element.setAttribute('data-replaced-at', Date.now());
                        element.setAttribute('data-replaced-100-percent', 'true');
                    }
                }
            }
            
            if (anyFound) {
                replacedCount++;
                // 🔴 ODSTRÁNILI SME replacedIdentifiers.add(replaceKey)
                log(`🎉 Kompletne nahradený identifikátor: "${idInfo.originalIdentifier}" (všetky výskyty)`);
            } else {
                failedCount++;
                failedIdentifiers.push(idInfo.originalIdentifier);
                log(`❌ NENAHRADENÝ: "${idInfo.originalIdentifier}" (žiadny element neobsahoval tento text)`);
            }
        } else if (!teamName) {
            failedCount++;
            failedIdentifiers.push(idInfo.originalIdentifier);
            log(`❌ NENAHRADENÝ: "${idInfo.originalIdentifier}" (tím nebol nájdený - skupina nie je na 100%)`);
        }
    }
    
    log('\n' + '='.repeat(60));
    log('📊 SÚHRN NAHRADENIA:');
    log(`   ✅ Úspešne nahradených: ${replacedCount} (z cache: ${fromCacheCount}, z DB: ${fromDbCount})`);
    log(`   ❌ Neúspešných: ${failedCount}`);
    if (failedIdentifiers.length > 0) {
        log(`   ❌ Neúspešné identifikátory: ${failedIdentifiers.join(', ')}`);
    }
    log('='.repeat(60) + '\n');
    
    isReplacingInProgress = false;
    
    return {
        replaced: replacedCount,
        fromCache: fromCacheCount,
        fromDb: fromDbCount,
        failed: failedCount,
        failedIdentifiers: failedIdentifiers
    };
}

// Funkcia na manuálne vymazanie logov nepripravených skupín (napr. po obnovení stránky)
function clearNotReadyGroupsLog() {
    notReadyGroupsLogged.clear();
    log('🗑️ Vyčistený záznam nepripravených skupín');
}

function clearGroupCheckCache() {
    groupCheckCache.clear();
    log('🗑️ Cache kontrolovaných skupín (isGroupReadyForReplacement) bola vymazaná');
}

// Pridajte do window.teamNameReplacer
if (window.teamNameReplacer) {
    window.teamNameReplacer.clearNotReadyGroupsLog = clearNotReadyGroupsLog;
    window.teamNameReplacer.clearCheckedGroupsCache = clearCheckedGroupsCache;
    window.teamNameReplacer.clearGroupCheckCache = clearGroupCheckCache;
}

// Pomocná funkcia na získanie udalostí pre zápas (pridáme do matchTracker)
if (window.matchTracker && !window.matchTracker.getEvents) {
    window.matchTracker.getEvents = (matchId) => {
        // Toto by malo byť dostupné z pôvodného matchTracker
        return window.matchTracker._getEvents?.(matchId) || [];
    };
}

function resetCarryOverCacheForGroup(categoryName, groupName) {
    const groupKey = `${categoryName}|${groupName}`;
    if (processedCarryOverGroups.has(groupKey)) {
        processedCarryOverGroups.delete(groupKey);
        log(`🗑️ Cache prenášania pre skupinu ${groupKey} bola vymazaná`);
    }
}

// Export funkcie
window.matchTracker.resetCarryOverCacheForGroup = resetCarryOverCacheForGroup;
window.matchTracker.resetCarryOverCache = () => {
    processedCarryOverGroups.clear();
    log('🗑️ Celá cache prenášania výsledkov bola vymazaná');
};

// Úplné nahradenie
function performFullReplacement() {
    const allText = document.body.innerText;
    const identifiers = extractIdentifiersFromText(allText);
    
    if (identifiers.length > 0) {
        performPartialReplacement(identifiers);
    } else {
        log('ℹ️ Žiadne identifikátory na nahradenie');
    }
}

window.getTeamNameByDisplayId = getTeamNameByDisplayId;
window.findTeamInUsersByGroupAndOrder = findTeamInUsersByGroupAndOrder;

function replaceAllIdentifiersNow() {
    log('🔄 Spúšťam okamžité nahrádzanie všetkých identifikátorov...');
    
    const allText = document.body.innerText;
    const identifiers = extractIdentifiersFromText(allText);
    
    if (identifiers.length === 0) {
        log('ℹ️ Žiadne identifikátory na nahrádzanie');
        return;
    }
    
    log(`📋 Nájdených ${identifiers.length} identifikátorov`);
    
    // Rozdelíme na pripravené a nepripravené
    const readyIdentifiers = [];
    const notReadyIdentifiers = [];
    
    for (const id of identifiers) {
        if (!id || !id.category || !id.groupLetter) continue;
        
        const isReady = isGroupReadyForReplacement(id.category, id.groupLetter);
        if (isReady) {
            readyIdentifiers.push(id);
        } else {
            notReadyIdentifiers.push(id);
        }
    }
    
    if (readyIdentifiers.length > 0) {
        log(`✅ Nahrádzam ${readyIdentifiers.length} pripravených identifikátorov...`);
        performPartialReplacement(readyIdentifiers);
    } else {
        log(`ℹ️ Žiadne identifikátory nie sú pripravené na nahradenie`);
    }
    
    if (notReadyIdentifiers.length > 0) {
//        log(`⏳ ${notReadyIdentifiers.length} identifikátorov nie je pripravených (skupiny nemajú 100%):`);
        notReadyIdentifiers.forEach(id => {
            log(`   - ${id.originalIdentifier} (skupina ${id.groupLetter})`);
        });
    }
}

// ** OPRAVENÁ FUNKCIA: replaceTeamIdentifiersWhenReady - BEZ PERIODICKÝCH KONTROL **
function replaceTeamIdentifiersWhenReady() {
    // Kontrola, či už neprebieha nahrádzanie
    if (isReplacingInProgress) {
        log('⏳ Nahrádzanie už prebieha, preskakujem...');
        return;
    }
    
    log('🔍 Kontrolujem pripravenosť skupín na nahrádzanie (spustené kvôli dokončenému zápasu)...');
    
    // Bezpečnostná kontrola
    if (!document || !document.body) {
        log('⚠️ document.body nie je dostupný, čakám...');
        return;
    }
    
    const allText = document.body.innerText;
    const identifiers = extractIdentifiersFromText(allText);
    
    if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
        log('ℹ️ Žiadne identifikátory tímov neboli nájdené na stránke');
        return;
    }
    
    const readyIdentifiers = [];
    
    for (const id of identifiers) {
        if (!id || !id.category || !id.groupLetter) continue;
        
        const isReady = isGroupReadyForReplacement(id.category, id.groupLetter);
        if (isReady) {
            readyIdentifiers.push(id);
        }
    }
    
    if (readyIdentifiers.length > 0) {
        log(`✅ Nahrádzam ${readyIdentifiers.length} pripravených identifikátorov...`);
        performPartialReplacement(readyIdentifiers);
    } else {
        log('ℹ️ Žiadna skupina ešte nie je pripravená na nahradenie');
    }
    
    // ❌ ODSTRÁNENÉ: Žiadne periodické kontroly (window._readyCheckInterval)
}

function stopPeriodicReplacement() {
    if (periodicReplaceInterval) {
        clearInterval(periodicReplaceInterval);
        periodicReplaceInterval = null;
        log('⏹️ Periodické nahrádzanie zastavené');
    }
}

// ** FUNKCIA NA OBSLUHU KLIKNUTÍ NA TLAČIDLÁ **
function attachClickHandlersForReplacement() {
    log('🖱️ Nastavujem poslúchače na tlačidlá pre opätovné nahrádzanie...');
    
    // Funkcia na spustenie nahrádzania po krátkom oneskorení
    const scheduleReplacement = () => {
        setTimeout(() => {
            log('🔄 Kliknutie na tlačidlo, spúšťam nahrádzanie...');
            replaceAllIdentifiersNow();
        }, 300);
    };
    
    // Sledujeme kliknutia na celom dokumente
    document.body.addEventListener('click', (event) => {
        // Hľadáme tlačidlá, ktoré menia view
        const button = event.target.closest('button');
        if (button) {
            const buttonText = button.textContent || '';
            // Tlačidlá, ktoré menia obsah
            if (buttonText.includes('Všetky zápasy') || 
                buttonText.includes('Detail') ||
                buttonText.includes('Predchádzajúci') ||
                buttonText.includes('Nasledujúci') ||
                button.closest('.cursor-pointer')?.getAttribute('onclick')?.includes('selectMatch')) {
                scheduleReplacement();
            }
        }
        
        // Kliknutie na div so zápasom (selectMatch)
        const matchDiv = event.target.closest('[class*="cursor-pointer"]');
        if (matchDiv && matchDiv.closest('.divide-y')) {
            scheduleReplacement();
        }
    });
}

async function startTeamNameReplacement() {
    if (isTeamNameReplacerInitialized) {
        log('⚠️ teamNameReplacer už bol inicializovaný, preskakujem...');
        return;
    }
    isTeamNameReplacerInitialized = true;
    
    mappingCompleted = false;
    initialMappingDone = false;
    window.__mappingNotified = false;
    hasReplacedAnyTeams = false;
    
    // 🔥 VYPNUTIE VŠETKÝCH PERIODICKÝCH ÚLOH PRED ŠTARTOM
    if (periodicReplaceInterval) {
        clearInterval(periodicReplaceInterval);
        periodicReplaceInterval = null;
    }
    if (groupMonitorInterval) {
        clearInterval(groupMonitorInterval);
        groupMonitorInterval = null;
    }
    
    log('🚀 Spúšťam automatické nahrádzanie identifikátorov tímov...');
    log('📌 Nahrádzanie sa spustí LEN keď sa zápas dokončí (status → completed)');
    log('❌ Žiadne periodické kontroly nebežia!');
    
    let checkInterval = setInterval(() => {
        if (window.matchTracker && typeof window.matchTracker.createGroupTable === 'function') {
            clearInterval(checkInterval);
            log('✅ MatchTracker je pripravený');
            
            // 🔥 IBA JEDNO ÚVODNÉ NAHRADENIE
            log('🔄 Spúšťam prvé (a posledné automatické) kolo nahrádzania...');
            replaceTeamIdentifiersWhenReady();
            
            // 🔥 HLAVNÉ: Počúvame LEN na udalosť, že sa zmenili tabuľky
            window.addEventListener('groupTablesUpdated', () => {
                log('📢 groupTablesUpdated (zápas dokončený) - spúšťam nahrádzanie...');
                replaceTeamIdentifiersWhenReady();
            });
        }
    }, 10000);
    
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.matchTracker) {
            log('⚠️ MatchTracker nie je dostupný');
            replaceTeamIdentifiersWhenReady();
            window.addEventListener('groupTablesUpdated', () => {
                replaceTeamIdentifiersWhenReady();
            });
        }
    }, 10000);
}

// Jednorazové spustenie
function replaceNow() {
    replaceTeamIdentifiersWhenReady();
}

// Export funkcií
window.teamNameReplacer = {
    start: startTeamNameReplacement,
    replaceNow: replaceNow,
    replaceOnce: replaceTeamIdentifiersWhenReady,
    stop: () => {
        if (window._teamNameObserver) {
            window._teamNameObserver.disconnect();
            window._teamNameObserver = null;
            log('⏹️ Sledovanie zmien na stránke zastavené');
        }
        if (window._readyCheckInterval) {
            clearInterval(window._readyCheckInterval);
            window._readyCheckInterval = null;
        }
        stopPeriodicReplacement();
        for (const timeout of groupStabilityCheck.values()) {
            clearTimeout(timeout);
        }
        groupStabilityCheck.clear();
    },
    checkGroupStatus: (category, groupLetter) => {
        const isReady = isGroupReadyForReplacement(category, groupLetter);
        const groupKey = `${category}|${groupLetter.toUpperCase()}`;
        const cached = processedGroups.get(groupKey);
        return {
            isReady: isReady,
            percentage: cached?.percentage || 0,
            lastCheck: cached?.lastCheck || null,
            totalMatches: cached?.totalMatches || 0,
            completedMatches: cached?.completedMatches || 0
        };
    },
    getReadyGroups: () => {
        const ready = [];
        for (const [key, value] of processedGroups.entries()) {
            if (value.isReady) {
                const [category, groupLetter] = key.split('|');
                ready.push({ category, groupLetter, percentage: value.percentage });
            }
        }
        return ready;
    },
    clearCache: clearReplacementCache,
    showCache: showCache,
    updateCacheFromPage: updateCacheFromPage,
    getCacheSize: () => replacementCache.size,
    getCacheStats: () => {
        const stats = {
            size: replacementCache.size,
            version: CACHE_VERSION,
            lastUpdated: null
        };
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) {
                const data = JSON.parse(cached);
                stats.lastUpdated = new Date(data.lastUpdated).toLocaleString();
            }
        } catch (e) {}
        return stats;
    },
    addToCache: addToCache,
    // 🔴 NOVÉ FUNKCIE
    replaceAllNow: replaceAllIdentifiersNow,
    startPeriodic: (intervalSeconds = 30) => {
        periodicReplaceActive = true;
    },
    stopPeriodic: () => {
        periodicReplaceActive = false;
        stopPeriodicReplacement();
    },
    isPeriodicActive: () => periodicReplaceInterval !== null && periodicReplaceActive
};

log('📋 Pridané funkcie pre nahrádzanie identifikátorov:');
log('   • window.teamNameReplacer.start() - spustí automatické nahrádzanie');
log('   • window.teamNameReplacer.replaceNow() - jednorazové nahradenie');
log('   • window.teamNameReplacer.checkGroupStatus("U12 D", "B") - kontrola stavu skupiny');
log('   • window.teamNameReplacer.getReadyGroups() - zoznam pripravených skupín');
log('   • window.teamNameReplacer.stop() - zastaví sledovanie');
log('   • window.matchTracker.getTeamNameByDisplayId("U12 D 1E") - priamy prístup k funkcii');

// Automatické spustenie
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof startTeamNameReplacement === 'function') {
            startTeamNameReplacement();
        } else {
            console.error('❌ startTeamNameReplication nie je definovaná!');
        }
    });
} else {
    if (typeof startTeamNameReplacement === 'function') {
        startTeamNameReplacement();
    } else {
        console.error('❌ startTeamNameReplication nie je definovaná!');
    }
}

// Pridanie funkcie na manuálne pridanie do cache
function addToCache(displayId, teamName) {
    const parts = displayId.trim().split(' ');
    if (parts.length < 2) return false;
    
    const positionAndGroup = parts.pop();
    let category = parts.join(' ');
    category = cleanCategoryName(category);
    
    let position = '';
    let groupLetter = '';
    for (let i = 0; i < positionAndGroup.length; i++) {
        const char = positionAndGroup[i];
        if (char >= '0' && char <= '9') {
            position += char;
        } else if (/[A-Za-z]/.test(char)) {
            groupLetter += char;
        }
    }
    
    if (!position || !groupLetter) return false;
    const positionNum = parseInt(position, 10);
    const cacheKey = `${category}|${groupLetter.toUpperCase()}|${positionNum}`;
    
    replacementCache.set(cacheKey, {
        teamName: teamName,
        displayId: displayId,
        category: category,
        groupLetter: groupLetter.toUpperCase(),
        position: positionNum,
        timestamp: Date.now()
    });
    saveReplacementCache(replacementCache);
    log(`💾 Manuálne pridané do cache: "${displayId}" → "${teamName}"`);
    return true;
}

window.teamNameReplacer.addToCache = addToCache;



// --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function checkForCompletionLoss() {
    if (!window.matchTracker) return false;
    
    const allMatches = window.matchTracker.getAllMatches?.() || [];
    const groupsWithLoss = [];
    
    const currentCompletion = new Map();
    
    allMatches.forEach(match => {
        if (match.isPlacementMatch) return;
        if (match.categoryName && match.groupName) {
            const key = `${match.categoryName}|${match.groupName}`;
            if (!currentCompletion.has(key)) {
                currentCompletion.set(key, {
                    category: match.categoryName,
                    group: match.groupName,
                    total: 0,
                    completed: 0
                });
            }
            const group = currentCompletion.get(key);
            group.total++;
            if (match.status === 'completed') {
                group.completed++;
            }
        }
    });
    
    for (const [key, data] of currentCompletion.entries()) {
        const percentage = data.total > 0 ? (data.completed / data.total * 100) : 0;
        const was100 = groupCompletionSnapshot.get(key) === 100;
        const isNow100 = percentage === 100;
        
        if (was100 && !isNow100) {
            groupsWithLoss.push({
                key: key,
                category: data.category,
                group: data.group,
                oldPercentage: 100,
                newPercentage: percentage,
                completedBefore: groupCompletionSnapshot.get(`${key}_completed`) || 0,
                completedNow: data.completed,
                total: data.total
            });
        }
        
        groupCompletionSnapshot.set(key, percentage);
        groupCompletionSnapshot.set(`${key}_completed`, data.completed);
        groupCompletionSnapshot.set(`${key}_total`, data.total);
    }
    
    return groupsWithLoss;
}

function clearAllTeamNameCache() {    
    if (window.__internalReplacementCache) {
        window.__internalReplacementCache.clear();
    }
    
    // Pre istotu aj localStorage
    try {
        localStorage.removeItem('teamNameReplacer_cache');
    } catch (error) {}
    
    if (window.__teamNameMapping) {
        window.__teamNameMapping = {};
    }
}

let isReloading = false; 

function stopGroupMonitoring() {
    if (groupMonitorInterval) {
        clearInterval(groupMonitorInterval);
        groupMonitorInterval = null;
    }
}

// Funkcia na získanie aktuálneho stavu skupín
function getGroupCompletionStatus() {
    const status = [];
    for (const [key, percentage] of groupCompletionSnapshot.entries()) {
        if (!key.includes('_completed') && !key.includes('_total')) {
            const [category, group] = key.split('|');
            status.push({
                category: category,
                group: group,
                percentage: percentage,
                completed: groupCompletionSnapshot.get(`${key}_completed`) || 0,
                total: groupCompletionSnapshot.get(`${key}_total`) || 0
            });
        }
    }
    return status;
}

// Funkcia na funkciu na získanie názvu tímu (z mapovania)
function getTeamNameFromMapping(originalIdentifier) {
    if (!originalIdentifier) return null;
    
    const mapping = window.__teamNameMapping[originalIdentifier];
    if (mapping && mapping.teamName) {
        // Kontrola, či mapovanie nie je príliš staré (napr. viac ako 1 hodinu)
        if (Date.now() - mapping.timestamp < 3600000) {
            return mapping.teamName;
        }
    }
    return null;
}

// Funkcia na získanie všetkých mapovaní
function getAllTeamMappings() {
    return window.__teamNameMapping;
}

// Funkcia na registráciu callbacku, ktorý sa zavolá po nahradení tímov
function onTeamNamesReplaced(callback) {
    if (typeof callback === 'function') {
        replacementCallbacks.push(callback);
        
        // Ak už boli nejaké tímy nahradené, zavoláme callback okamžite
        if (hasReplacedAnyTeams) {
            callback();
        }
    }
}

// Funkcia na vyžiadanie aktuálneho stavu nahradených tímov
function getReplacedTeams() {
    const replacedTeams = [];
    const elements = document.querySelectorAll('[data-replaced-100-percent="true"]');
    
    for (const element of elements) {
        const originalId = element.getAttribute('data-original-identifier');
        const teamName = element.getAttribute('data-team-name');
        const category = element.getAttribute('data-team-category');
        
        if (originalId && teamName) {
            replacedTeams.push({
                originalIdentifier: originalId,
                teamName: teamName,
                category: category
            });
        }
    }
    
    return replacedTeams;
}

// ============================================================
// GLOBÁLNE MAPOVANIE IDENTIFIKÁTOROV NA NÁZVY TÍMOV
// ============================================================

// Globálny objekt pre mapovanie identifikátorov na názvy tímov
window.__teamNameMapping = window.__teamNameMapping || {};

// Funkcia na registráciu mapovania
function registerTeamNameMapping(originalIdentifier, teamName, category, groupLetter, position) {
    if (!originalIdentifier || !teamName) return;
    
    // 🔥 KONTROLA - ak už mapovanie existuje, neaktualizujeme
    if (window.__teamNameMapping[originalIdentifier]) {
        return;  // Už existuje, preskočíme
    }
    
    window.__teamNameMapping[originalIdentifier] = {
        teamName: teamName,
        category: category,
        groupLetter: groupLetter,
        position: position,
        timestamp: Date.now()
    };
    
    // 🔥 PRIDAJTE AJ DO CACHE
    const cacheKey = `${category}|${groupLetter.toUpperCase()}|${position}`;
    if (!replacementCache.has(cacheKey)) {
        replacementCache.set(cacheKey, {
            teamName: teamName,
            displayId: originalIdentifier,
            category: category,
            groupLetter: groupLetter.toUpperCase(),
            position: position,
            timestamp: Date.now()
        });
        saveReplacementCache(replacementCache);
    }
}

// ============================================================
// OPRAVENÁ FUNKCIA performPartialReplacement - LEPŠIE VYHĽADÁVANIE + MAPOVANIE
// ============================================================

// Uložíme pôvodnú funkciu (ak existuje)
const existingPerformPartialReplacement = window.performPartialReplacement || performPartialReplacement;

// Prepíšeme funkciu - NOVÁ VERZIA (bez duplicitnej deklarácie)
window.performPartialReplacement = function(identifiersToReplace) {
    if (isReplacingInProgress) {
        return;
    }
    
    isReplacingInProgress = true;
    
    let replacedCount = 0;
    let failedCount = 0;
    let fromCacheCount = 0;
    let fromDbCount = 0;
    const failedIdentifiers = [];
    
    for (const idInfo of identifiersToReplace) {
        // Najprv skúsime cache (rýchle)
        let teamName = getTeamNameFromCacheOnly(idInfo.identifier);
        let fromCache = true;
        
        if (!teamName) {
            teamName = getTeamNameFromCacheOnly(idInfo.originalIdentifier);
        }
        
        // Ak nie je v cache, načítame z databázy
        if (!teamName) {
            fromCache = false;
            teamName = getTeamNameFromDatabase(idInfo.identifier);
            if (!teamName) {
                teamName = getTeamNameFromDatabase(idInfo.originalIdentifier);
            }
        }
        
        if (teamName && teamName !== idInfo.identifier && teamName !== idInfo.originalIdentifier) {
            // REGISTRÁCIA MAPOVANIA - vždy, aj keď nenahradíme text
            const mappingKey = idInfo.originalIdentifier;
            if (!window.__teamNameMapping[mappingKey]) {
                registerTeamNameMapping(
                    mappingKey, 
                    teamName, 
                    idInfo.category, 
                    idInfo.groupLetter, 
                    idInfo.position
                );
            }
            
            const escapedIdentifier = idInfo.originalIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedIdentifier, 'g');
            
            // Prehľadávanie textových uzlov
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        if (node.parentElement && 
                            (node.parentElement.tagName === 'SCRIPT' || 
                             node.parentElement.tagName === 'STYLE' ||
                             node.parentElement.tagName === 'CODE')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );
            
            const textNodes = [];
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent && node.textContent.includes(idInfo.originalIdentifier)) {
                    textNodes.push(node);
                }
            }
            
            let anyFound = false;
            
            for (const textNode of textNodes) {
                const newText = textNode.textContent.replace(regex, teamName);
                if (newText !== textNode.textContent) {
                    textNode.textContent = newText;
                    anyFound = true;
                }
            }
            
            // Kontrola input elementov
            const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
            for (const input of inputs) {
                let value = input.value || input.textContent;
                if (value && value.includes(idInfo.originalIdentifier)) {
                    const newValue = value.replace(regex, teamName);
                    if (input.value !== undefined) {
                        input.value = newValue;
                    } else {
                        input.textContent = newValue;
                    }
                    anyFound = true;
                }
            }
            
            if (anyFound) {
                replacedCount++;
                if (fromCache) fromCacheCount++;
                else fromDbCount++;
                
                // Uložíme atribúty na rodičovské elementy
                const parentElements = document.querySelectorAll(`*`);
                for (const element of parentElements) {
                    if (element.textContent && element.textContent.includes(teamName) && 
                        !element.hasAttribute('data-original-identifier')) {
                        element.setAttribute('data-original-identifier', idInfo.identifier);
                        element.setAttribute('data-team-category', idInfo.category);
                        element.setAttribute('data-team-position', idInfo.position);
                        element.setAttribute('data-team-group', idInfo.groupLetter);
                        element.setAttribute('data-team-name', teamName);
                        element.setAttribute('data-replaced-100-percent', 'true');
                        element.setAttribute('data-replaced-at', Date.now());
                        break;
                    }
                }
            }
        } else if (!teamName) {
            failedCount++;
            failedIdentifiers.push(idInfo.originalIdentifier);
        }
    }
    
    // VYSIELAME UDALOSŤ S MAPOVANÍM
    if (Object.keys(window.__teamNameMapping).length > 0 && !hasReplacedAnyTeams) {
        hasReplacedAnyTeams = true;
        
        const event = new CustomEvent('teamNamesReplaced', {
            detail: {
                replacedCount: replacedCount,
                fromCache: fromCacheCount,
                fromDb: fromDbCount,
                replacedTeams: Object.entries(window.__teamNameMapping).map(([id, data]) => ({
                    originalIdentifier: id,
                    teamName: data.teamName,
                    category: data.category
                })),
                mappings: window.__teamNameMapping,
                timestamp: Date.now()
            }
        });
        window.dispatchEvent(event);
        
        replacementCallbacks.forEach(callback => {
            try {
                callback(Object.entries(window.__teamNameMapping).map(([id, data]) => ({
                    originalIdentifier: id,
                    teamName: data.teamName,
                    category: data.category
                })));
            } catch (error) {
                error('❌ Chyba v callbacku:', error);
            }
        });
    }
    
    isReplacingInProgress = false;
    
    return {
        replaced: replacedCount,
        fromCache: fromCacheCount,
        fromDb: fromDbCount,
        failed: failedCount,
        failedIdentifiers: failedIdentifiers
    };
};

// Nahradíme pôvodnú funkciu novou
const originalPerformPartialReplacementFunc = performPartialReplacement;
performPartialReplacement = window.performPartialReplacement;

// PRIDANÉ: Funkcia na manuálne spustenie eventu (pre prípad, že už boli nahradené tímy pred registráciou)
function notifyReplacedTeams() {
    if (hasReplacedAnyTeams) {
        const replacedTeams = getReplacedTeams();
        const event = new CustomEvent('teamNamesReplaced', {
            detail: {
                replacedCount: replacedTeams.length,
                replacedTeams: replacedTeams,
                timestamp: Date.now(),
                isManual: true
            }
        });
        window.dispatchEvent(event);
        
        replacementCallbacks.forEach(callback => {
            try {
                callback(replacedTeams);
            } catch (error) {
                error('❌ Chyba v callbacku:', error);
            }
        });
    }
}

function notifyMappingReady() {
    if (mappingCompleted) return;
    if (isMappingNotificationSent) return;  // 🔥 NOVÁ OCHRANA
    
    mappingCompleted = true;
    isMappingNotificationSent = true;  // 🔥 NASTAVÍME FLAG
    
    const mappings = getAllTeamMappings();
    const mappingsCount = Object.keys(mappings).length;
    
    console.log('%c🎉 MAPOVANIE TÍMOV JE PRIPRAVENÉ! 🎉', 'color: #00ff00; font-size: 16px; font-weight: bold; background: #1a1a1a; padding: 4px 12px; border-radius: 8px;');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #888888;');
    console.log(`📊 Počet mapovaní: ${mappingsCount}`);
    
    if (mappingsCount > 0) {
        console.log('📋 Zoznam mapovaní:');
        for (const [id, data] of Object.entries(mappings)) {
            console.log(`   • ${id} → "${data.teamName}" (kategória: ${data.category || 'N/A'})`);
        }
    }
    console.log('==========================================');
    
    const event = new CustomEvent('teamNameMappingReady', {
        detail: { mappings, mappingsCount, timestamp: Date.now(), ready: true }
    });
    window.dispatchEvent(event);
}

// TOTO JE DÔLEŽITÉ - po načítaní existujúcich mapovaní
if (Object.keys(window.__teamNameMapping).length > 0 && !hasReplacedAnyTeams) {
    console.log('✅ Mapovanie už existuje, odosielam udalosť okamžite...');
    notifyMappingReady();
}

// TIEŽ po každom úspešnom načítaní z databázy
const originalGetTeamNameFromDatabaseWrapper = getTeamNameFromDatabase;
window.getTeamNameFromDatabase = function(displayId) {
    const result = originalGetTeamNameFromDatabaseWrapper(displayId);
    
    if (!initialMappingDone && result && window.__teamNameMapping && Object.keys(window.__teamNameMapping).length > 0) {
        initialMappingDone = true;
        notifyMappingReady();
    }
    
    return result;
};

// Funkcia na manuálne ohlásenie pripravenosti
function announceMappingReady() {
    if (mappingCompleted) return;
    if (Object.keys(window.__teamNameMapping).length > 0 && !hasReplacedAnyTeams) {
        notifyMappingReady();
    } else {
        setTimeout(announceMappingReady, 500);
    }
}

// Funkcia na resetovanie cache prenášania (napr. pri manuálnom obnovení)
function resetCarryOverCache() {
    processedCarryOverGroups.clear();
    log('🗑️ Cache prenášania výsledkov bola vymazaná');
}

// ============================================================
// ŠTARTOVACIA FUNKCIA S MONITOROVANÍM SKUPÍN
// ============================================================

// Uložíme pôvodnú štartovaciu funkciu
const originalStartTeamNameReplacement = startTeamNameReplacement;

// Export funkcií - ROZŠÍRENIE existujúceho objektu
if (window.teamNameReplacer) {
    window.teamNameReplacer.onTeamNamesReplaced = onTeamNamesReplaced;
    window.teamNameReplacer.getReplacedTeams = getReplacedTeams;
    window.teamNameReplacer.notifyReplacedTeams = notifyReplacedTeams;
    window.teamNameReplacer.hasReplacedAnyTeams = () => hasReplacedAnyTeams;
    window.teamNameReplacer.registerTeamNameMapping = registerTeamNameMapping;
    window.teamNameReplacer.getTeamNameFromMapping = getTeamNameFromMapping;
    window.teamNameReplacer.getAllTeamMappings = getAllTeamMappings;
    window.teamNameReplacer.isMappingReady = () => mappingCompleted;
    window.teamNameReplacer.getMappings = () => window.__teamNameMapping;
    window.teamNameReplacer.announceReady = announceMappingReady;
    window.teamNameReplacer.forceNotify = notifyMappingReady;
    // NOVÉ FUNKCIE PRE SLEDOVANIE SKUPÍN
    window.teamNameReplacer.stopGroupMonitoring = stopGroupMonitoring;
    window.teamNameReplacer.getGroupCompletionStatus = getGroupCompletionStatus;
    window.teamNameReplacer.clearAllTeamNameCache = clearAllTeamNameCache;
} else {
    window.teamNameReplacer = {
        ...window.teamNameReplacer,
        onTeamNamesReplaced: onTeamNamesReplaced,
        getReplacedTeams: getReplacedTeams,
        notifyReplacedTeams: notifyReplacedTeams,
        hasReplacedAnyTeams: () => hasReplacedAnyTeams,
        registerTeamNameMapping: registerTeamNameMapping,
        getTeamNameFromMapping: getTeamNameFromMapping,
        getAllTeamMappings: getAllTeamMappings,
        isMappingReady: () => mappingCompleted,
        getMappings: () => window.__teamNameMapping,
        announceReady: announceMappingReady,
        forceNotify: notifyMappingReady,
        stopGroupMonitoring: stopGroupMonitoring,
        getGroupCompletionStatus: getGroupCompletionStatus,
        clearAllTeamNameCache: clearAllTeamNameCache
    };
}

// OKAMŽITÁ KONTROLA – ak už náhodou máme mapovanie, pošleme udalosť hneď
if (Object.keys(window.__teamNameMapping).length > 0 && !hasReplacedAnyTeams) {
    notifyMappingReady();
}

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

let groupCheckCache = new Set();  // Cache pre kontrolu pripravenosti skupín
let processedCarryOverGroups = new Set();  // Cache pre prenášanie výsledkov
let isInitialDataLoaded = false;  // Prvotné načítanie dát
let processedGroupsInitial = new Set();  // Spracované skupiny pri inicializácii

(function() {
    'use strict';
    
    log('=== SPÚŠŤAM SLEDOVANIE ZÁPASOV (MÓD: TABUĽKA SKUPÍN) ===');
    
    let unsubscribeMatches = null;
    let unsubscribeEvents = {};
    let matchesData = {};
    let eventsData = {};
    let tableSettings = { sortingConditions: [] }; // Uloženie nastavení poradia
    
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
        let teamAScore = 0;
        let teamBScore = 0;
        let teamAWins = 0;
        let teamBWins = 0;
        
        groupMatches.forEach(match => {
            if ((match.homeTeamIdentifier === teamAId && match.awayTeamIdentifier === teamBId) ||
                (match.homeTeamIdentifier === teamBId && match.awayTeamIdentifier === teamAId)) {
                const events = eventsData[match.id] || [];
                const { home: homeScore, away: awayScore } = getCurrentScore(events);
                
                let teamAGet = 0;
                let teamBGet = 0;
                
                if (match.homeTeamIdentifier === teamAId) {
                    teamAGet = homeScore;
                    teamBGet = awayScore;
                } else {
                    teamAGet = awayScore;
                    teamBGet = homeScore;
                }
                
                teamAScore = teamAGet;
                teamBScore = teamBGet;
                
                if (teamAGet > teamBGet) teamAWins++;
                else if (teamBGet > teamAGet) teamBWins++;
            }
        });
        
        return { teamAScore, teamBScore, teamAWins, teamBWins };
    }
    
    // Funkcia na porovnanie dvoch tímov podľa nastavených kritérií (až po zohľadnení bodov)
    function compareTeams(teamA, teamB, groupMatches, sortingConditions) {
        // 1. Najprv porovnáme podľa bodov
        if (teamA.points !== teamB.points) {
            return teamB.points - teamA.points; // Viac bodov = lepšie
        }
    
        // 2. Ak sú body rovnaké, použijeme nastavené kritériá
        if (sortingConditions && sortingConditions.length > 0) {
            for (const condition of sortingConditions) {
                const { parameter, direction } = condition;
                let comparison = 0;
                
                switch (parameter) {
                    case 'headToHead':
                        const { teamAScore, teamBScore, teamAWins, teamBWins } = calculateHeadToHead(teamA.id, teamB.id, groupMatches);
                        // Najprv podľa výhier vo vzájomných zápasoch
                        if (teamAWins !== teamBWins) {
                            comparison = teamBWins - teamAWins;
                        } else if (teamAScore !== teamBScore) {
                            // Potom podľa skóre vo vzájomných zápasoch
                            comparison = teamBScore - teamAScore;
                        }
                        break;
                        
                    case 'scoreDifference':
                        comparison = (direction === 'desc' ? teamB.goalDifference - teamA.goalDifference : teamA.goalDifference - teamB.goalDifference);
                        break;
                        
                    case 'goalsScored':
                        comparison = (direction === 'desc' ? teamB.goalsFor - teamA.goalsFor : teamA.goalsFor - teamB.goalsFor);
                        break;
                        
                    case 'goalsConceded':
                        comparison = (direction === 'asc' ? teamA.goalsAgainst - teamB.goalsAgainst : teamB.goalsAgainst - teamA.goalsAgainst);
                        break;
                        
                    case 'wins':
                        comparison = (direction === 'desc' ? teamB.wins - teamA.wins : teamA.wins - teamB.wins);
                        break;
                    
                    case 'losses':
                        comparison = (direction === 'asc' ? teamA.losses - teamB.losses : teamB.losses - teamA.losses);
                        break;
                    
                    case 'draw':
                        // Losovanie - vrátime 0, čo znamená, že sa tímy považujú za rovnaké
                        comparison = 0;
                        break;
                        
                    default:
                        comparison = 0;
                }
                
                if (comparison !== 0) return comparison;
            }
        }
        
        // 3. Ak sú všetky kritériá rovnaké, použijeme abecedné poradie
        return teamA.name.localeCompare(teamB.name);
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
        
        const looksLikeIdentifier = (str) => /[0-9]+[A-Za-z]+|[A-Za-z]+[0-9]+/.test(str);
        
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
        
    function createGroupTable(categoryName, groupName) {
        // Získame VŠETKY zápasy v skupine (aj neodohrané)
        const allGroupMatches = getGroupMatches(categoryName, groupName);
        
        if (allGroupMatches.length === 0) {
            log(`Žiadne zápasy pre skupinu ${groupName} v kategórii ${categoryName}`);
            return null;
        }
        
        // Získame len ODOHRANÉ zápasy pre výpočet štatistík
        const completedGroupMatches = allGroupMatches.filter(match => match.status === 'completed');
        
        // Získame všetky tímy v skupine
        const teamsInGroup = getTeamsInGroupFromAllMatches(allGroupMatches);
        
        // Mapovanie názvov tímov
        const looksLikeIdentifier = (str) => /[0-9]+[A-Za-z]+|[A-Za-z]+[0-9]+/.test(str);
        
        for (const team of teamsInGroup) {
            if (looksLikeIdentifier(team.name)) {
                const mappedName = window.matchTracker?.getTeamNameByDisplayIdSync?.(team.name);
                if (mappedName && mappedName !== team.name) {
                    team.name = mappedName;
                }
            }
        }
        
        // Získame aktuálny počet bodov za výhru z cache
        const pointsForWin = getPointsForWinSync();
        
        // Spracujeme výsledky LEN z ODOHRANÝCH ZÁPASOV v tejto skupine
        completedGroupMatches.forEach(match => {
            let homeScore = 0;
            let awayScore = 0;
            
            // 🔥 PRIDANÉ: KONTROLA NA MANUÁLNY VÝSLEDOK (finalScore)
            if (match.finalScore && !match.forfeitResult) {
                // Manuálne zadaný výsledok
                homeScore = match.finalScore.home || 0;
                awayScore = match.finalScore.away || 0;
                log(`📋 Manuálny výsledok pre ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}: ${homeScore}:${awayScore}`);
            } 
            // 🔥 KONTROLA NA KONTUMÁCIU
            else if (match.forfeitResult && match.forfeitResult.isForfeit) {
                homeScore = match.forfeitResult.home || 0;
                awayScore = match.forfeitResult.away || 0;
                log(`📋 Kontumovaný výsledok pre ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}: ${homeScore}:${awayScore}`);
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
                    // 🔥 POUŽIJEME DYNAMICKÉ BODY ZA VÝHRU
                    homeTeamStats.points += pointsForWin;
                    awayTeamStats.losses++;
                } else if (awayScore > homeScore) {
                    awayTeamStats.wins++;
                    // 🔥 POUŽIJEME DYNAMICKÉ BODY ZA VÝHRU
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
        
        // Zoradenie tímov
        const sortedTeams = [...teamsInGroup].sort((a, b) => {
            return compareTeams(a, b, allGroupMatches, tableSettings.sortingConditions);
        });
        
        // Vytvoríme zoznam zápasov na zobrazenie
        const allMatchesForDisplay = [...allGroupMatches];
        
        return {
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
            pointsForWin: pointsForWin  // PRIDANÉ: pre informáciu
        };
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

    function createAdvancedGroupTable(categoryName, groupName, baseGroupName) {
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
            log(`🎯 Nadstavbová skupina ${groupName} - základné skupiny: ${allBaseGroups.join(', ')}`);
        }
        
        if (allBaseGroups.length === 0 && baseGroupName) {
            allBaseGroups = [baseGroupName];
        }
        
        if (allBaseGroups.length === 0) {
            log(`❌ Žiadne základné skupiny neboli nájdené pre nadstavbovú skupinu ${groupName}`);
            return null;
        }
        
        // Načítame všetky základné skupiny, ktoré sú 100% dokončené
        const completedBaseGroups = [];
        const allBaseGroupTables = [];
        
        for (const baseGroup of allBaseGroups) {
            const baseGroupTable = createGroupTable(categoryName, baseGroup);
            if (baseGroupTable && baseGroupTable.completionPercentage === 100) {
                completedBaseGroups.push(baseGroup);
                allBaseGroupTables.push(baseGroupTable);
                log(`   ✅ Základná skupina ${baseGroup} je 100% dokončená, načítaných ${baseGroupTable.teams.length} tímov`);
            } else if (baseGroupTable) {
                log(`   ⏳ Základná skupina ${baseGroup} má len ${baseGroupTable.completionPercentage}% dokončených`);
            } else {
                log(`   ⚠️ Základná skupina ${baseGroup} neexistuje`);
            }
        }
        
        if (completedBaseGroups.length === 0) {
            log(`❌ Žiadna základná skupina nie je 100% dokončená, nemôžem vyhodnotiť nadstavbovú skupinu ${groupName}`);
            return null;
        }
        
        log(`✅ Základné skupiny ${completedBaseGroups.join(', ')} sú 100% dokončené, vyhodnocujem nadstavbovú skupinu ${groupName}...`);
        
        // Načítanie nastavenia prenášania
        const categorySetting = categorySettingsCache[categoryName];
        const carryOverEnabled = categorySetting?.carryOverPoints ?? false;
        
        log(`   📌 Prenášanie výsledkov vzájomných zápasov: ${carryOverEnabled ? 'ZAPNUTÉ ✅' : 'VYPNUTÉ ❌'}`);
        
        // Získame zápasy v nadstavbovej skupine
        const advancedMatches = getGroupMatches(categoryName, groupName);
        if (advancedMatches.length === 0) {
            log(`❌ Žiadne zápasy pre nadstavbovú skupinu ${groupName}`);
            return null;
        }
        
        // Získame tímy v nadstavbovej skupine (pôvodné ID)
        let teamsInAdvanced = getTeamsInGroupFromAllMatches(advancedMatches);
        
        // Mapovanie názvov tímov
        teamsInAdvanced = mapAdvancedGroupTeamsGeneral(teamsInAdvanced, categoryName, allBaseGroupTables);
        
        // Získame aktuálny počet bodov za výhru z cache
        const pointsForWin = getPointsForWinSync();
        
        // PRENÁŠANIE VÝSLEDKOV
        const transferredMatches = [];
        const processedPairs = new Set();
        
        if (carryOverEnabled) {
            log(`   🔄 Prenášam výsledky vzájomných zápasov zo základných skupín...`);
            
            // Vytvoríme mapu pre rýchle vyhľadanie výsledkov základných zápasov
            const baseMatchResults = new Map();
            
            // Prechádzame všetky základné skupiny
            for (const baseGroupTable of allBaseGroupTables) {
                const baseGroupMatches = getGroupMatches(categoryName, baseGroupTable.group);
                const completedBaseMatches = baseGroupMatches.filter(m => m.status === 'completed');
                
                for (const match of completedBaseMatches) {
                    // 🔥 ZÍSKAME SKÓRE (aj z manuálneho výsledku)
                    let homeScore = 0;
                    let awayScore = 0;
                    
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
                    
                    // Získame pôvodné identifikátory
                    let homeId = match.homeTeamIdentifier;
                    let awayId = match.awayTeamIdentifier;
                    
                    // MAPUJEME na reálne názvy tímov
                    let homeTeamName = homeId;
                    let awayTeamName = awayId;
                    
                    const mappedHome = getTeamNameByDisplayId(homeId);
                    if (mappedHome && mappedHome !== homeId) homeTeamName = mappedHome;
                    
                    const mappedAway = getTeamNameByDisplayId(awayId);
                    if (mappedAway && mappedAway !== awayId) awayTeamName = mappedAway;
                    
                    // Uložíme výsledok do mapy (abecedne zoradený kľúč)
                    const teamA = homeTeamName;
                    const teamB = awayTeamName;
                    const key = teamA < teamB ? `${teamA}|${teamB}` : `${teamB}|${teamA}`;
                    
                    let teamAScore, teamBScore;
                    if (teamA === homeTeamName) {
                        teamAScore = homeScore;
                        teamBScore = awayScore;
                    } else {
                        teamAScore = awayScore;
                        teamBScore = homeScore;
                    }
                    
                    baseMatchResults.set(key, {
                        homeTeam: teamA,
                        awayTeam: teamB,
                        homeScore: teamAScore,
                        awayScore: teamBScore,
                        fromGroup: baseGroupTable.group,
                        originalHomeId: homeId,
                        originalAwayId: awayId
                    });
                    
                    log(`   📋 Základný zápas (mapovaný): ${teamA} ${teamAScore}:${teamBScore} ${teamB} (skupina ${baseGroupTable.group})`);
                }
            }
            
            // Teraz pre každú dvojicu tímov v nadstavbovej skupine
            for (let i = 0; i < teamsInAdvanced.length; i++) {
                for (let j = i + 1; j < teamsInAdvanced.length; j++) {
                    const teamA = teamsInAdvanced[i];
                    const teamB = teamsInAdvanced[j];
                    
                    const pairKey = `${teamA.id}|${teamB.id}`;
                    if (processedPairs.has(pairKey)) continue;
                    
                    const searchKey = teamA.name < teamB.name ? 
                        `${teamA.name}|${teamB.name}` : `${teamB.name}|${teamA.name}`;
                    
                    log(`   🔍 Hľadám zápas medzi: "${teamA.name}" a "${teamB.name}"`);
                    let baseResult = baseMatchResults.get(searchKey);
                    
                    if (!baseResult) {
                        log(`   🔄 Nenašiel sa v základných výsledkoch, skúšam cez findMatchBetweenTeamsInOtherGroup...`);
                        const foundMatch = findMatchBetweenTeamsInOtherGroup(
                            teamA.name, 
                            teamB.name, 
                            categoryName, 
                            groupName, 
                            null
                        );
                        
                        if (foundMatch && foundMatch.isTransferred) {
                            baseResult = {
                                homeTeam: foundMatch.homeTeam,
                                awayTeam: foundMatch.awayTeam,
                                homeScore: foundMatch.homeScore,
                                awayScore: foundMatch.awayScore,
                                fromGroup: foundMatch.fromGroup
                            };
                            log(`   ✅ Nájdený zápas cez vyhľadávanie: ${foundMatch.homeTeam} ${foundMatch.homeScore}:${foundMatch.awayScore} ${foundMatch.awayTeam}`);
                        }
                    }
                    
                    if (baseResult) {
                        let teamAScore, teamBScore;
                        if (baseResult.homeTeam === teamA.name) {
                            teamAScore = baseResult.homeScore;
                            teamBScore = baseResult.awayScore;
                        } else {
                            teamAScore = baseResult.awayScore;
                            teamBScore = baseResult.homeScore;
                        }
                        
                        log(`   ✅ Prenesený výsledok: ${teamA.name} ${teamAScore}:${teamBScore} ${teamB.name} (zo skupiny ${baseResult.fromGroup})`);
                        
                        // PRIDÁME PRENESENÝ VÝSLEDOK DO ŠTATISTÍK
                        teamA.played++;
                        teamB.played++;
                        teamA.goalsFor += teamAScore;
                        teamA.goalsAgainst += teamBScore;
                        teamB.goalsFor += teamBScore;
                        teamB.goalsAgainst += teamAScore;
                        
                        if (teamAScore > teamBScore) {
                            teamA.wins++;
                            teamB.losses++;
                            // 🔥 POUŽIJEME DYNAMICKÉ BODY ZA VÝHRU
                            teamA.points += pointsForWin;
                        } else if (teamBScore > teamAScore) {
                            teamB.wins++;
                            teamA.losses++;
                            // 🔥 POUŽIJEME DYNAMICKÉ BODY ZA VÝHRU
                            teamB.points += pointsForWin;
                        } else {
                            teamA.draws++;
                            teamB.draws++;
                            teamA.points += 1;
                            teamB.points += 1;
                        }
                        
                        transferredMatches.push({
                            homeTeam: teamA.name,
                            awayTeam: teamB.name,
                            homeScore: teamAScore,
                            awayScore: teamBScore,
                            fromGroup: baseResult.fromGroup
                        });
                        
                        processedPairs.add(pairKey);
                    } else {
                        log(`   ⚠️ Žiadny základný zápas medzi ${teamA.name} a ${teamB.name}`);
                    }
                }
            }
        } else {
            log(`   ❌ Prenášanie výsledkov je VYPNUTÉ, používam iba zápasy z nadstavbovej skupiny`);
        }
        
        // SPRACOVANIE ZÁPASOV V NADSTAVBOVEJ SKUPINE
        const completedAdvancedMatches = advancedMatches.filter(m => m.status === 'completed');
        
        for (const match of completedAdvancedMatches) {
            // 🔥 ZÍSKAME SKÓRE (aj z manuálneho výsledku)
            let homeScore = 0;
            let awayScore = 0;
            
            if (match.finalScore && !match.forfeitResult) {
                homeScore = match.finalScore.home || 0;
                awayScore = match.finalScore.away || 0;
                log(`📋 Manuálny výsledok v nadstavbe pre ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}: ${homeScore}:${awayScore}`);
            } else if (match.forfeitResult && match.forfeitResult.isForfeit) {
                homeScore = match.forfeitResult.home || 0;
                awayScore = match.forfeitResult.away || 0;
                log(`📋 Kontumovaný výsledok v nadstavbe: ${homeScore}:${awayScore}`);
            } else {
                const events = eventsData[match.id] || [];
                const score = getCurrentScore(events);
                homeScore = score.home;
                awayScore = score.away;
            }
            
            // Mapujeme názvy tímov pre tento zápas
            let homeTeamName = match.homeTeamIdentifier;
            let awayTeamName = match.awayTeamIdentifier;
            
            const mappedHome = getTeamNameByDisplayId(homeTeamName);
            if (mappedHome && mappedHome !== homeTeamName) homeTeamName = mappedHome;
            
            const mappedAway = getTeamNameByDisplayId(awayTeamName);
            if (mappedAway && mappedAway !== awayTeamName) awayTeamName = mappedAway;
            
            const homeTeamStats = teamsInAdvanced.find(t => t.name === homeTeamName);
            const awayTeamStats = teamsInAdvanced.find(t => t.name === awayTeamName);
            
            if (homeTeamStats && awayTeamStats) {
                homeTeamStats.played++;
                awayTeamStats.played++;
                homeTeamStats.goalsFor += homeScore;
                homeTeamStats.goalsAgainst += awayScore;
                awayTeamStats.goalsFor += awayScore;
                awayTeamStats.goalsAgainst += homeScore;
                
                if (homeScore > awayScore) {
                    homeTeamStats.wins++;
                    awayTeamStats.losses++;
                    // 🔥 POUŽIJEME DYNAMICKÉ BODY ZA VÝHRU
                    homeTeamStats.points += pointsForWin;
                } else if (awayScore > homeScore) {
                    awayTeamStats.wins++;
                    homeTeamStats.losses++;
                    // 🔥 POUŽIJEME DYNAMICKÉ BODY ZA VÝHRU
                    awayTeamStats.points += pointsForWin;
                } else {
                    homeTeamStats.draws++;
                    awayTeamStats.draws++;
                    homeTeamStats.points += 1;
                    awayTeamStats.points += 1;
                }
                
                log(`   📋 Nadstavbový zápas: ${homeTeamName} ${homeScore}:${awayScore} ${awayTeamName}`);
            }
        }
        
        // VÝPOČET ROZDIELU SKÓRE A ZORADENIE
        teamsInAdvanced.forEach(team => {
            team.goalDifference = team.goalsFor - team.goalsAgainst;
        });
        
        const sortedTeams = [...teamsInAdvanced].sort((a, b) => {
            return compareTeams(a, b, advancedMatches, tableSettings.sortingConditions);
        });
        
        // PRÍPRAVA ZÁPASOV NA ZOBRAZENIE
        const allMatchesForDisplay = [...advancedMatches];
        for (const transferred of transferredMatches) {
            allMatchesForDisplay.push({
                id: `transferred_${Date.now()}_${Math.random()}`,
                homeTeamIdentifier: transferred.homeTeam,
                awayTeamIdentifier: transferred.awayTeam,
                status: 'completed',
                scheduledTime: null,
                isTransferred: true,
                transferredScore: `${transferred.homeScore}:${transferred.awayScore}`,
                fromGroup: transferred.fromGroup
            });
        }
        
        const totalMatches = advancedMatches.length;
        const completedCount = completedAdvancedMatches.length;
        const completionPercentage = totalMatches > 0 ? (completedCount / totalMatches * 100) : 0;
        
        log(`\n📊 VÝSLEDOK NADSTAVBOVEJ SKUPINY ${groupName}:`);
        log(`   Prenesených zápasov: ${transferredMatches.length}`);
        log(`   Odohraných v nadstavbe: ${completedAdvancedMatches.length}`);
        log(`   Celkom dokončených: ${completedCount}/${totalMatches} (${completionPercentage}%)`);
        log(`   Body za výhru: ${pointsForWin}`);
        
        return {
            category: categoryName,
            group: groupName,
            baseGroup: completedBaseGroups.join(', '),
            carryOverPoints: carryOverEnabled,
            teams: sortedTeams,
            matches: allMatchesForDisplay,
            completedMatches: [...completedAdvancedMatches],
            totalMatches: totalMatches,
            completedCount: completedCount,
            remainingCount: totalMatches - completedAdvancedMatches.length,
            completionPercentage: completionPercentage,
            transferredMatches: transferredMatches,
            pointsForWin: pointsForWin  // PRIDANÉ: pre informáciu
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
    
    // UPRAVENÁ FUNKCIA: printGroupTable - mapuje názvy pre VŠETKY tabuľky
    function printGroupTable(categoryName, groupName, baseGroupName = null) {
        let table;
    
        // 🔥 NOVÉ: Zistíme, či je skupina nadstavbová podľa groupsData
        const groupsData = window.groupsData || {};
        const categoryId = window.categoryIdMap?.[categoryName] || null;
        let isAdvancedGroup = false;
        
    if (categoryId && groupsData[categoryId]) {
            const groupInfo = groupsData[categoryId].find(g => g.name === groupName);
            if (groupInfo && groupInfo.type === 'nadstavbová skupina') {
                isAdvancedGroup = true;
            }
        }
        
        // Ak je skupina nadstavbová, použijeme createAdvancedGroupTable
        if (isAdvancedGroup) {
            // Pre nadstavbovú skupinu potrebujeme baseGroupName - zistíme ho z groupsData?
            // Alebo použijeme createAdvancedGroupTable bez baseGroupName, ktoré si nájde samo
            table = createAdvancedGroupTable(categoryName, groupName, null);
        } else {
            table = createGroupTable(categoryName, groupName);
        }
    
    if (!table) return;
        
        // ============================================================
        // 🔥 MAPOVANIE NÁZVOV TÍMOV PRE VŠETKY TABUĽKY (nielen nadstavbové)
        // ============================================================
        log(`\n📋 MAPOVANIE NÁZVOV PRED VÝPISOM TABUĽKY: ${table.category} - ${table.group}`);
    
        // Pomocná funkcia na kontrolu, či ide o identifikátor
        const looksLikeIdentifier = (str) => /[0-9]+[A-Za-z]+|[A-Za-z]+[0-9]+/.test(str);
        
        for (const team of table.teams) {
            // Iba ak to vyzerá ako identifikátor, skúsime mapovať
            if (looksLikeIdentifier(team.name)) {
                const mappedName = window.matchTracker.getTeamNameByDisplayId(team.name);
                if (mappedName && mappedName !== team.name) {
                    log(`   🔄 Mapovanie pre výpis: "${team.name}" → "${mappedName}"`);
                    team.name = mappedName;
                } else if (!mappedName) {
                    log(`   ⚠️ Žiadne mapovanie pre: "${team.name}" (funkcia vrátila null)`);
                }
            } else {
                log(`   ℹ️ "${team.name}" nie je identifikátor, preskakujem mapovanie`);
            }
        }
        // ============================================================
        
        log('\n' + '='.repeat(120));
        log(`📊 TABUĽKA SKUPINY: ${table.category} - ${table.group}`);
        if (table.baseGroup) {
            log(`   📌 Základná skupina: ${table.baseGroup}`);
            log(`   📌 Prenášanie bodov: ${table.carryOverPoints ? 'ZAPNUTÉ ✅' : 'VYPNUTÉ ❌'}`);
        }
        log('='.repeat(120));
        
        // Informácia o počte odohraných zápasov
        const progressBar = generateProgressBar(table.completionPercentage);
        log(`📋 Zápasy: ${table.completedCount} / ${table.totalMatches} odohraných (${table.completionPercentage}%)`);
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
        
        // Výpis neodohraných zápasov - aj tu mapujeme názvy
        const upcomingMatches = table.matches.filter(m => m.status !== 'completed');
        if (upcomingMatches.length > 0) {
            log(`\n📅 NEODOHRANÉ ZÁPASY (${upcomingMatches.length}):`);
            upcomingMatches.forEach((match, idx) => {
                let homeTeam = window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier;
                let awayTeam = window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier;
                
                // 🔥 KONTROLA: Či vôbec ide o identifikátor pred volaním getTeamNameByDisplayId
                const looksLikeIdentifier = (str) => /[0-9]+[A-Za-z]+|[A-Za-z]+[0-9]+/.test(str);
                
                let mappedHome = homeTeam;
                let mappedAway = awayTeam;
                
                if (looksLikeIdentifier(homeTeam)) {
                    const result = window.matchTracker.getTeamNameByDisplayId(homeTeam);
                    if (result && result !== homeTeam) mappedHome = result;
                }
                
                if (looksLikeIdentifier(awayTeam)) {
                    const result = window.matchTracker.getTeamNameByDisplayId(awayTeam);
                    if (result && result !== awayTeam) mappedAway = result;
                }
                
                const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null;
                const dateStr = matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený';
                log(`   ${idx+1}. ${mappedHome} vs ${mappedAway} (${dateStr}) - ${getStatusText(match.status)}`);
            });
        }
        if (table.transferredMatches && table.transferredMatches.length > 0) {
            log(`\n🔄 PRENESENÉ ZÁPASY (zo základnej skupiny ${table.baseGroup}):`);
            table.transferredMatches.forEach((match, idx) => {
                log(`   ${idx+1}. ${match.homeTeam} ${match.homeScore}:${match.awayScore} ${match.awayTeam} (prenesené)`);
            });
        }
        // Výpis použitých kritérií poradia
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
                for (const groupKey of affectedGroups) {
                    const [category, group] = groupKey.split('|');
                    const isAdvancedGroup = group.toLowerCase().includes('nadstavbová');
                    
                    if (!isAdvancedGroup) {
                        log(`   🔄 Prepočítavam základnú skupinu: ${category} - ${group}`);
                        const groupTable = createGroupTable(category, group);
                        
                        if (groupTable && groupTable.completionPercentage == 100) {
                            log(`   ✅ ${category} - ${group} je teraz KOMPLETNÁ (100%)`);
                            processedGroupsInitial.add(groupKey);
                            
                            const advancedDependentGroups = findAdvancedGroupsDependingOn(category, group);
                            for (const advGroup of advancedDependentGroups) {
                                log(`   🔄 Prepočítavam nadstavbovú skupinu (závisí na ${group}): ${category} - ${advGroup}`);
                                createAdvancedGroupTable(category, advGroup, group);
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
                        }
                    }
                }
                
                printAllGroupTables();
                
                if (window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('groupTablesUpdated', {
                        detail: { 
                            reason: 'match_completed', 
                            timestamp: Date.now(),
                            affectedGroups: Array.from(affectedGroups),
                            affectedCategories: Array.from(affectedCategories)
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
                log(`🔄 Aktualizácia udalostí pre zápas ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}`);
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
        resetCarryOverCache: resetCarryOverCache 
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

// ** GLOBÁLNE PREMENNÉ PRE SLEDOVANIE PRIPRAVENOSTI SKUPÍN **
let processedGroups = new Map();
let pendingReplaceTimeout = null;
let replacedIdentifiers = new Set();
let isReplacingInProgress = false;

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
        log(`⛔ [${category} - ${fullGroupName}] Skupina NIE JE pripravená`);
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
        log(`⛔ [${category} - ${fullGroupName}] Skupina NIE JE pripravená, nenačítam z DB`);
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

// Hlavná funkcia - najprv cache, potom databáza
// ============================================================
// OPRAVENÁ FUNKCIA: getTeamNameByDisplayId - rozpoznáva dva formáty
// ============================================================

let checkedGroupsCache = new Set();

function getTeamNameByDisplayId(displayId) {
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
    
    const lastPart = parts[parts.length - 1];
    let category = parts.slice(0, -1).join(' ');
    category = cleanCategoryName(category);
    
    // ============================================================
    // FORMÁT: PÍSMENO PRED ČÍSLICOU (napr. "A2")
    // ============================================================
    const letterFirstMatch = lastPart.match(/^([A-Za-z]+)(\d+)$/);
    
    if (letterFirstMatch) {
        const groupLetter = letterFirstMatch[1].toUpperCase();
        const order = parseInt(letterFirstMatch[2], 10);
        
        // 🔥 KONTROLA CACHE - ak sme už túto skupinu kontrolovali, preskočíme logy
        const groupKey = `${category}|${groupLetter}`;
        if (!checkedGroupsCache.has(groupKey)) {
            log(`🔍 Formát "písmeno+číslo" (${lastPart}) → skupina: ${groupLetter}, poradie: ${order}`);
            log(`   Hľadám tím v používateľských dátach (users)...`);
            checkedGroupsCache.add(groupKey);
        }
        
        const teamInfo = findTeamInUsersByGroupAndOrder(category, groupLetter, order);
        
        if (teamInfo && teamInfo.teamName) {
            if (!checkedGroupsCache.has(`${groupKey}_found`)) {
                log(`✅ Nájdený tím v users: "${teamInfo.teamName}"`);
                checkedGroupsCache.add(`${groupKey}_found`);
            }
            return teamInfo.teamName;
        } else {
            if (!checkedGroupsCache.has(`${groupKey}_not_found`)) {
                log(`❌ Tím nebol nájdený v users: ${category} skupina ${groupLetter} poradie ${order}`);
                checkedGroupsCache.add(`${groupKey}_not_found`);
            }
            return null;
        }
    }
    
    // ============================================================
    // FORMÁT: ČÍSLICA PRED PÍSMENOM (napr. "2A")
    // ============================================================
    const numberFirstMatch = lastPart.match(/^(\d+)([A-Za-z]+)$/);
    
    if (numberFirstMatch) {
        const order = parseInt(numberFirstMatch[1], 10);
        const groupLetter = numberFirstMatch[2].toUpperCase();
        
        // 🔥 KONTROLA CACHE - ak sme už túto skupinu kontrolovali, preskočíme logy
        const groupKey = `${category}|${groupLetter}`;
        if (!checkedGroupsCache.has(groupKey)) {
            log(`🔍 Formát "číslo+písmeno" (${lastPart}) → poradie: ${order}, skupina: ${groupLetter}`);
            log(`   Kontrolujem tabuľku skupiny (vyžaduje 100% odohraných zápasov)...`);
        }
        
        const fullGroupName = `skupina ${groupLetter}`;
        
        // 🔥 POUŽIJEME CACHE PRE KONTROLU PRIPRAVENOSTI
        let isReady;
        if (checkedGroupsCache.has(`${groupKey}_ready`)) {
            isReady = true;
        } else if (checkedGroupsCache.has(`${groupKey}_not_ready`)) {
            isReady = false;
        } else {
            isReady = isGroupReadyForReplacement(category, groupLetter);
            if (isReady) {
                checkedGroupsCache.add(`${groupKey}_ready`);
            } else {
                checkedGroupsCache.add(`${groupKey}_not_ready`);
            }
        }
        
        if (!isReady) {
            if (!checkedGroupsCache.has(`${groupKey}_not_ready_logged`)) {
                log(`⛔ Skupina ${category} - ${fullGroupName} NIE JE pripravená (nemá 100% odohraných zápasov)`);
                checkedGroupsCache.add(`${groupKey}_not_ready_logged`);
            }
            return null;
        }
        
        // Skupina je pripravená, získame tabuľku
        const groupTable = window.matchTracker?.createGroupTable(category, fullGroupName);
        
        if (!groupTable || !groupTable.teams || groupTable.teams.length === 0) {
            if (!checkedGroupsCache.has(`${groupKey}_no_table`)) {
                log(`❌ Tabuľka pre skupinu ${fullGroupName} neexistuje`);
                checkedGroupsCache.add(`${groupKey}_no_table`);
            }
            return null;
        }
        
        const teamIndex = order - 1;
        
        if (teamIndex >= 0 && teamIndex < groupTable.teams.length) {
            const team = groupTable.teams[teamIndex];
            if (!checkedGroupsCache.has(`${groupKey}_team_found_${order}`)) {
                log(`✅ Nájdený v tabuľke: "${team.name}" (pozícia ${order} v skupine ${groupLetter})`);
                checkedGroupsCache.add(`${groupKey}_team_found_${order}`);
            }
            return team.name;
        } else {
            if (!checkedGroupsCache.has(`${groupKey}_invalid_position_${order}`)) {
                log(`❌ Pozícia ${order} neexistuje (skupina má ${groupTable.teams.length} tímov)`);
                checkedGroupsCache.add(`${groupKey}_invalid_position_${order}`);
            }
            return null;
        }
    }
    
    log(`❌ Neznámy formát poslednej časti: ${lastPart} (očakáva sa "A2" alebo "2A")`);
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
    
    // 🔥 KONTROLA CACHE - ak sme už túto skupinu kontrolovali, vrátime rovnaký výsledok
    if (groupCheckCache.has(groupKey)) {
        return true;
    }
    if (groupCheckCache.has(`${groupKey}_false`)) {
        return false;
    }
    
    // 1. Skúsime získať tabuľku skupiny
    let groupTable = window.matchTracker?.createGroupTable(cleanCategory, fullGroupName);
    
    if (!groupTable) {
        if (!notReadyGroupsLogged.has(`${groupKey}_no_table`)) {
            log(`⏳ [${cleanCategory} - ${fullGroupName}] Tabuľka neexistuje → NIE JE PRIpravená`);
            notReadyGroupsLogged.add(`${groupKey}_no_table`);
        }
        groupCheckCache.add(`${groupKey}_false`);
        return false;
    }
    
    const totalMatches = groupTable.totalMatches || 0;
    const completedMatches = groupTable.completedCount || 0;
    const completionPercentage = totalMatches > 0 ? (completedMatches / totalMatches * 100) : 0;
    
    // 2. Podmienka 1: Všetky zápasy musia byť odohrané (100%)
    if (completionPercentage < 100) {
        const logKey = `${groupKey}_${Math.floor(completionPercentage)}`;
        if (!notReadyGroupsLogged.has(logKey)) {
            log(`⏳ [${cleanCategory} - ${fullGroupName}] Len ${completedMatches}/${totalMatches} (${completionPercentage}%) odohraných → NIE JE PRIpravená (čakám na dokončenie...)`);
            notReadyGroupsLogged.add(logKey);
        }
        groupCheckCache.add(`${groupKey}_false`);
        return false;
    }
    
    // 3. Podmienka 2: Všetky zápasy musia mať načítané udalosti (events)
    const allGroupMatches = window.matchTracker?.getGroupMatches?.(cleanCategory, fullGroupName) || [];
    const completedMatchesList = allGroupMatches.filter(m => m.status === 'completed');
    
    let allEventsLoaded = true;
    let missingEventsMatchId = null;
    
    for (const match of completedMatchesList) {
        const events = window.matchTracker?.getEvents?.(match.id) || [];
        if (events.length === 0) {
            allEventsLoaded = false;
            missingEventsMatchId = match.id;
            break;
        }
        
        const { home, away } = getCurrentScoreFromEvents(events);
        if (home === 0 && away === 0 && events.length > 0) {
            allEventsLoaded = false;
            missingEventsMatchId = match.id;
            break;
        }
    }
    
    if (!allEventsLoaded) {
        if (!notReadyGroupsLogged.has(`${groupKey}_no_events`)) {
            log(`⏳ [${cleanCategory} - ${fullGroupName}] Zápas ${missingEventsMatchId} nemá načítané udalosti → NIE JE PRIpravená (čakám na načítanie...)`);
            notReadyGroupsLogged.add(`${groupKey}_no_events`);
        }
        groupCheckCache.add(`${groupKey}_false`);
        return false;
    }
    
    // 4. Dodatočná kontrola: Žiadny zápas by nemal byť v stave 'in-progress' alebo 'paused'
    const hasInProgressMatches = allGroupMatches.some(m => m.status === 'in-progress' || m.status === 'paused');
    if (hasInProgressMatches) {
        if (!notReadyGroupsLogged.has(`${groupKey}_in_progress`)) {
            log(`⏳ [${cleanCategory} - ${fullGroupName}] Sú tam zápasy, ktoré ešte prebiehajú → NIE JE PRIpravenÁ`);
            notReadyGroupsLogged.add(`${groupKey}_in_progress`);
        }
        groupCheckCache.add(`${groupKey}_false`);
        return false;
    }
    
    // ========== SKUPINA JE PRIPRAVENÁ ==========
    // 🔥 TENTO LOG SA VYPIŠE IBA RAZ!
    if (!groupCheckCache.has(groupKey)) {
        log(`✅ [${cleanCategory} - ${fullGroupName}] SKUPINA JE PRIPRAVENÁ! 100% zápasov odohraných, všetky udalosti načítané.`);
        groupCheckCache.add(groupKey);
    }
    
    // Vyčistíme záznamy o nepripravenosti pre túto skupinu
    for (const key of notReadyGroupsLogged) {
        if (key.startsWith(groupKey)) {
            notReadyGroupsLogged.delete(key);
        }
    }
    
    if (!processedGroups.has(groupKey) || !processedGroups.get(groupKey).isReady) {
        processedGroups.set(groupKey, {
            isReady: true,
            percentage: 100,
            lastCheck: Date.now(),
            totalMatches: totalMatches,
            completedMatches: completedMatches,
            allEventsLoaded: true
        });
        
        // Spustíme nahradenie pre túto skupinu IBA RAZ
        const allText = document.body.innerText;
        const identifiers = extractIdentifiersFromText(allText);
        const readyForThisGroup = identifiers.filter(id => 
            id.category === cleanCategory && id.groupLetter === groupLetter.toUpperCase()
        );
        
        if (readyForThisGroup.length > 0) {
            log(`🎉 Spúšťam nahradenie pre skupinu ${fullGroupName}...`);
            performPartialReplacement(readyForThisGroup);
        }
    }
    
    return true;
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

// Funkcia na sledovanie zmien na stránke
function observePageChanges() {
    log('👁️ Spúšťam sledovanie zmien na stránke...');
    
    setTimeout(() => {
        replaceTeamIdentifiersWhenReady();
    }, 1000);
    
    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldCheck = true;
                break;
            }
            if (mutation.type === 'characterData') {
                shouldCheck = true;
                break;
            }
        }
        
        if (shouldCheck) {
            clearTimeout(window._replaceTimeout);
            window._replaceTimeout = setTimeout(() => {
                replaceTeamIdentifiersWhenReady();
            }, 1000);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
    
    return observer;
}

window.getTeamNameByDisplayId = getTeamNameByDisplayId;
window.findTeamInUsersByGroupAndOrder = findTeamInUsersByGroupAndOrder;

// ** UPRAVENÁ FUNKCIA: Periodické nahrádzanie - vždy kontroluje všetky identifikátory **
let periodicReplaceInterval = null;
let periodicReplaceActive = true;

function startPeriodicReplacement(intervalSeconds = 1) {
    if (periodicReplaceInterval) {
        clearInterval(periodicReplaceInterval);
    }
    
    log(`🔄 Spúšťam periodické nahrádzanie každých ${intervalSeconds} sekúnd...`);
    
    periodicReplaceInterval = setInterval(() => {
        if (!periodicReplaceActive) return;
        
        // Tichšie logovanie (voliteľné)
        // log(`⏰ Periodické nahrádzanie (každých ${intervalSeconds}s)...`);
        
        const allText = document.body.innerText;
        const identifiers = extractIdentifiersFromText(allText);
        
        if (identifiers.length === 0) return;
        
        const readyIdentifiers = [];
        
        for (const id of identifiers) {
            if (!id || !id.category || !id.groupLetter) continue;
            
            const isReady = isGroupReadyForReplacement(id.category, id.groupLetter);
            if (isReady) {
                readyIdentifiers.push(id);
            }
        }
        
        if (readyIdentifiers.length > 0) {
            log(`🔄 Periodické nahrádzanie: ${readyIdentifiers.length} identifikátorov`);
            performPartialReplacement(readyIdentifiers);
        }
    }, intervalSeconds * 1000);
}

// ** NOVÁ FUNKCIA: Okamžité nahrádzanie všetkých identifikátorov (bez čakania) **
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
        log(`⏳ ${notReadyIdentifiers.length} identifikátorov nie je pripravených (skupiny nemajú 100%):`);
        notReadyIdentifiers.forEach(id => {
            log(`   - ${id.originalIdentifier} (skupina ${id.groupLetter})`);
        });
    }
}

// ** OPRAVENÁ FUNKCIA: replaceTeamIdentifiersWhenReady - s oneskorením pre istotu **
function replaceTeamIdentifiersWhenReady() {
    log('🔍 Kontrolujem pripravenosť skupín na nahrádzanie...');
    
    // Bezpečnostná kontrola - či existuje document.body
    if (!document || !document.body) {
        log('⚠️ document.body nie je dostupný, čakám...');
        return;
    }
    
    const allText = document.body.innerText;
    const identifiers = extractIdentifiersFromText(allText);
    
    if (!identifiers || !Array.isArray(identifiers)) {
        log('⚠️ extractIdentifiersFromText nevrátil platné pole, čakám...');
        return;
    }
    
    if (identifiers.length === 0) {
        log('ℹ️ Žiadne identifikátory tímov neboli nájdené na stránke');
        return;
    }
    
    const readyIdentifiers = [];
    const notReadyIdentifiers = [];
    
    for (const id of identifiers) {
        if (!id || !id.category || !id.groupLetter) {
            log('⚠️ Neplatný identifikátor, preskakujem:', id);
            continue;
        }
        
        const isReady = isGroupReadyForReplacement(id.category, id.groupLetter);
        if (isReady) {
            readyIdentifiers.push(id);
        } else {
            notReadyIdentifiers.push(id);
        }
    }
    
    log(`📋 Nájdených identifikátorov: ${identifiers.length}`);
    log(`   ✅ Pripravené na nahradenie: ${readyIdentifiers.map(i => i.identifier).join(', ') || 'žiadne'}`);
    log(`   ⏳ Čakajú na dokončenie: ${notReadyIdentifiers.map(i => i.identifier).join(', ') || 'žiadne'}`);
    
    if (readyIdentifiers.length > 0) {
        // PRIDANÉ ONESKORENIE - počkáme ešte 2 sekundy pre istotu, že všetky dáta sú stabilné
        log('✅ Vykonávam nahradenie pre pripravené skupiny...');
        performPartialReplacement(readyIdentifiers);
    } else {
        log('ℹ️ Žiadna skupina ešte nie je pripravená na nahradenie');
    }
    
    // Pokračujeme v kontrolách pre nepripravené skupiny...
    if (notReadyIdentifiers.length > 0) {
        log(`⏳ Nastavujem pravidelné kontroly pre ${notReadyIdentifiers.length} skupín...`);
        
        if (window._readyCheckInterval) {
            clearInterval(window._readyCheckInterval);
        }
        
        // Predĺžime interval na 10 sekúnd, aby sme dali čas na načítanie
        window._readyCheckInterval = setInterval(() => {
            const nowReady = [];
            for (const id of notReadyIdentifiers) {
                if (isGroupReadyForReplacement(id.category, id.groupLetter)) {
                    nowReady.push(id);
                }
            }
            
            if (nowReady.length > 0) {
                log(`✅ Ďalších ${nowReady.length} skupín je pripravených, vykonávam nahradenie...`);
                clearInterval(window._readyCheckInterval);
                window._readyCheckInterval = null;
                performPartialReplacement(nowReady);
            }
        }, 1000); // Kontrola každých 1 sekúnd
    }
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

// Nahraďte existujúcu funkciu startTeamNameReplacement touto verziou

async function startTeamNameReplacement() {
    log('🚀 Spúšťam automatické nahrádzanie identifikátorov tímov...');
    log('📌 Nahrádzajú sa len skupiny, ktoré majú 100% odohraných zápasov a všetky zápasy sú spracované.');
    
    let checkInterval = setInterval(() => {
        if (window.matchTracker && typeof window.matchTracker.createGroupTable === 'function') {
            clearInterval(checkInterval);
            log('✅ MatchTracker je pripravený');
            
            // ========== ZMENENÉ: Sledovanie zmien namiesto periodického behu ==========
            // Spustíme sledovanie zmien na stránke (napr. pri kliknutí)
            const observer = observePageChanges();
            window._teamNameObserver = observer;
            
            // Jedno úvodné nahradenie (pre prípad, že už sú nejaké skupiny hotové)
            log('🔄 Spúšťam prvé kolo nahrádzania...');
            replaceTeamIdentifiersWhenReady();
            
            // 🔥 NOVÉ: Počúvame na udalosť, že sa zmenili tabuľky (dohraný zápas)
            window.addEventListener('groupTablesUpdated', () => {
                log('📢 Prijatá udalosť: groupTablesUpdated - kontrolujem pripravenosť skupín...');
                replaceTeamIdentifiersWhenReady();
            });
            
            // 🔥 VOLITEĽNÉ: Môžeme pridať aj počúvanie na kliknutia (pre prípad manuálnej zmeny view)
            attachClickHandlersForReplacement();
            // ========================================================================
        }
    }, 500);
    
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.matchTracker) {
            log('⚠️ MatchTracker nie je dostupný');
            replaceTeamIdentifiersWhenReady();
            // Namiesto periodického, len raz a potom už len na udalosť
            window.addEventListener('groupTablesUpdated', () => {
                replaceTeamIdentifiersWhenReady();
            });
        }
    }, 10000);
    
    // attachClickHandlersForReplacement už je volané vyššie
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
        startPeriodicReplacement(intervalSeconds);
    },
    stopPeriodic: () => {
        periodicReplaceActive = false;
        stopPeriodicReplacement();
    },
    setPeriodicInterval: (intervalSeconds) => {
        if (periodicReplaceInterval) {
            startPeriodicReplacement(intervalSeconds);
        } else {
            startPeriodicReplacement(intervalSeconds);
        }
        log(`📊 Interval periodického nahrádzania nastavený na ${intervalSeconds} sekúnd`);
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
    document.addEventListener('DOMContentLoaded', startTeamNameReplacement);
} else {
    startTeamNameReplacement();
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

// ============================================================
// PRIDAJTE TÚTO ČASŇ NA KONIEC SUBORU func-tables.js
// ============================================================

// Premenná pre sledovanie, či už boli nahradené nejaké tímy
let hasReplacedAnyTeams = false;

// Zoznam callback funkcií, ktoré sa majú zavolať po nahradení
const replacementCallbacks = [];

// ** NOVÉ: Sledovanie percentuálneho zastúpenia skupín **
let groupCompletionSnapshot = new Map(); // Ukladá posledné známe percentá skupín

// Funkcia na kontrolu, či niektorá skupina stratila 100% (napr. pri zmazaní výsledku)
function checkForCompletionLoss() {
    if (!window.matchTracker) return false;
    
    const allMatches = window.matchTracker.getAllMatches?.() || [];
    const groupsWithLoss = [];
    
    // Získame aktuálne percentá pre všetky skupiny
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
    
    // Vypočítame percentá a porovnáme s posledným známym stavom
    for (const [key, data] of currentCompletion.entries()) {
        const percentage = data.total > 0 ? (data.completed / data.total * 100) : 0;
        const was100 = groupCompletionSnapshot.get(key) === 100;
        const isNow100 = percentage === 100;
        
        // Ak bola skupina na 100% a teraz už nie je -> treba obnoviť stránku
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
        
        // Aktualizujeme snapshot
        groupCompletionSnapshot.set(key, percentage);
        groupCompletionSnapshot.set(`${key}_completed`, data.completed);
        groupCompletionSnapshot.set(`${key}_total`, data.total);
    }
    
    return groupsWithLoss;
}

// ** FUNKCIA NA VYMAZANIE CACHE (LOCAL STORAGE + PAMÄŤ) **
function clearAllTeamNameCache() {
    log('🗑️ VYMAZÁVAM CACHE názvov tímov...');
    
    // 🔥 POUŽIJEME GLOBÁLNY PRÍSTUP K CACHE
    if (window.__internalReplacementCache) {
        window.__internalReplacementCache.clear();
        log('   ✅ replacementCache vymazaná cez window.__internalReplacementCache');
    }
    
    // Pre istotu aj localStorage
    try {
        localStorage.removeItem('teamNameReplacer_cache');
        log('   ✅ localStorage cache vymazaná');
    } catch (error) {}
    
    if (window.__teamNameMapping) {
        window.__teamNameMapping = {};
        log('   ✅ Globálne mapovanie vymazané');
    }
    
    log('✅ Všetky cache boli úspešne vymazané');
}

// ** NOVÉ: Sledovanie zmien v skupinách (napr. pri zmazaní výsledku) **
let groupMonitorInterval = null;
let isReloading = false; // Zabráni nekonečnému reštartovaniu

function startGroupMonitoring(intervalSeconds = 5) {
    if (groupMonitorInterval) {
        clearInterval(groupMonitorInterval);
    }
    
    // Najprv naplníme snapshot aktuálnymi hodnotami
    const allMatches = window.matchTracker?.getAllMatches?.() || [];
    allMatches.forEach(match => {
        if (match.isPlacementMatch) return;
        if (match.categoryName && match.groupName) {
            const key = `${match.categoryName}|${match.groupName}`;
            if (!groupCompletionSnapshot.has(key)) {
                groupCompletionSnapshot.set(key, 0);
            }
        }
    });
    
    // Prvé naplnenie percentami
    const initialGroups = new Map();
    allMatches.forEach(match => {
        if (match.isPlacementMatch) return;
        if (match.categoryName && match.groupName) {
            const key = `${match.categoryName}|${match.groupName}`;
            if (!initialGroups.has(key)) {
                initialGroups.set(key, {
                    total: 0,
                    completed: 0
                });
            }
            const group = initialGroups.get(key);
            group.total++;
            if (match.status === 'completed') {
                group.completed++;
            }
        }
    });
    
    for (const [key, data] of initialGroups.entries()) {
        const percentage = data.total > 0 ? (data.completed / data.total * 100) : 0;
        groupCompletionSnapshot.set(key, percentage);
        groupCompletionSnapshot.set(`${key}_completed`, data.completed);
        groupCompletionSnapshot.set(`${key}_total`, data.total);
    }
    
    // Spustíme monitorovanie
    groupMonitorInterval = setInterval(() => {
        if (isReloading) return; // Už sa reštartuje
        
        const groupsWithLoss = checkForCompletionLoss();
        
        if (groupsWithLoss && groupsWithLoss.length > 0) {
            warn('⚠️ VAROVANIE: Skupina(y) stratili 100% dokončených zápasov!');
            groupsWithLoss.forEach(group => {
                warn(`   📉 ${group.category} - ${group.group}: 100% → ${group.newPercentage.toFixed(1)}% (bolo ${group.completedBefore}/${group.total}, teraz ${group.completedNow}/${group.total})`);
            });
            
            // 🔥 VYMAŽEME CACHE PRED OBNOVENÍM STRÁNKY
            clearAllTeamNameCache();
            
            // Obnovíme stránku
            isReloading = true;
            log('🔄 Obnovujem stránku kvôli zmene stavu skupiny (cache bola vymazaná)...');
            
            // Krátke oneskorenie pre istotu, že sa zapíšu logy a vymaže cache
            setTimeout(() => {
                location.reload();
            }, 500);
        }
    }, intervalSeconds * 1000);
}

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
    
    window.__teamNameMapping[originalIdentifier] = {
        teamName: teamName,
        category: category,
        groupLetter: groupLetter,
        position: position,
        timestamp: Date.now()
    };
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
            registerTeamNameMapping(
                idInfo.originalIdentifier, 
                teamName, 
                idInfo.category, 
                idInfo.groupLetter, 
                idInfo.position
            );
            
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
    if (Object.keys(window.__teamNameMapping).length > 0) {
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

// ============================================================
// NOTIFIKÁCIA O DOKONČENÍ MAPOVANIA – OKAMŽITÁ
// ============================================================

// Premenná na sledovanie, či už bolo mapovanie dokončené
let mappingCompleted = false;
let initialMappingDone = false;

// Funkcia na odoslanie udalosti, že mapovanie je pripravené
function notifyMappingReady() {
    if (mappingCompleted) return;
    mappingCompleted = true;
    const mappings = getAllTeamMappings();
    const mappingsCount = Object.keys(mappings).length;
    log(`🎉 MAPOVANIE DOKONČENÉ! Počet mapovaní: ${mappingsCount}`);
    const event = new CustomEvent('teamNameMappingReady', {
        detail: { mappings, mappingsCount, timestamp: Date.now(), ready: true }
    });
    window.dispatchEvent(event);
}

// TOTO JE DÔLEŽITÉ - po načítaní existujúcich mapovaní
if (Object.keys(window.__teamNameMapping).length > 0) {
    log('✅ Mapovanie už existuje, odosielam udalosť okamžite...');
    notifyMappingReady();
}

// DÔLEŽITÉ: Po každom úspešnom nahradení skontrolujeme, či už máme mapovanie
const originalPerformPartialReplacementWrapper = window.performPartialReplacement || performPartialReplacement;

window.performPartialReplacement = function(identifiersToReplace) {
    const result = originalPerformPartialReplacementWrapper(identifiersToReplace);
    
    // Ak máme aspoň jedno mapovanie a ešte sme neodoslali udalosť
    if (!initialMappingDone && Object.keys(window.__teamNameMapping).length > 0) {
        initialMappingDone = true;
        notifyMappingReady();
    }
    
    return result;
};

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

// AKTUALIZOVANÁ FUNKCIA pre periodické nahrádzanie – po prvom nahradení odoslať udalosť
const originalStartPeriodicReplacementWrapper = startPeriodicReplacement;
window.startPeriodicReplacement = function(intervalSeconds = 1) {
    const result = originalStartPeriodicReplacementWrapper(intervalSeconds);
    
    // Skontrolujeme, či už náhodou nemáme mapovanie
    if (!initialMappingDone && Object.keys(window.__teamNameMapping).length > 0) {
        initialMappingDone = true;
        notifyMappingReady();
    }
    
    return result;
};

// Funkcia na manuálne ohlásenie pripravenosti
function announceMappingReady() {
    if (mappingCompleted) return;
    if (Object.keys(window.__teamNameMapping).length > 0) {
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

// Prepíšeme štartovaciu funkciu, aby spustila aj monitorovanie skupín
window.startTeamNameReplacement = async function() {
    // Spustíme pôvodnú funkcionalitu
    if (originalStartTeamNameReplacement) {
        await originalStartTeamNameReplacement();
    }
    
    // Počkáme na matchTracker a potom spustíme monitorovanie skupín
    let checkInterval = setInterval(() => {
        if (window.matchTracker && typeof window.matchTracker.getAllMatches === 'function') {
            clearInterval(checkInterval);
            log('✅ MatchTracker je pripravený, spúšťam monitorovanie skupín...');
            
            // Spustíme monitorovanie zmien v skupinách (kontrola každých 3 sekúnd)
            startGroupMonitoring(3);
            
            // Taktiež sledujeme zmeny v databáze cez matchTracker
            if (window.matchTracker && window.matchTracker.stop === 'function') {
                // Uložíme pôvodný unsubscribe
                const originalUnsubscribe = window.matchTracker.stop;
            }
        }
    }, 500);
};

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
    window.teamNameReplacer.startGroupMonitoring = startGroupMonitoring;
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
        startGroupMonitoring: startGroupMonitoring,
        stopGroupMonitoring: stopGroupMonitoring,
        getGroupCompletionStatus: getGroupCompletionStatus,
        clearAllTeamNameCache: clearAllTeamNameCache
    };
}

// OKAMŽITÁ KONTROLA – ak už náhodou máme mapovanie, pošleme udalosť hneď
if (Object.keys(window.__teamNameMapping).length > 0) {
    notifyMappingReady();
}

// Spustíme upravenú verziu štartovacej funkcie
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.startTeamNameReplacement();
    });
} else {
    window.startTeamNameReplacement();
}

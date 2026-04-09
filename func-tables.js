// ========== GLOBÁLNY PREPÍNAČ PRE LOGOVANIE ==========
const DEBUG_MODE = true;  // false = nevypisuje sa (len tento skript), true = vypisuje sa

// Uložíme pôvodné konzolové funkcie
const originalConsoleLog = console.log;
const originalConsoleDebug = console.debug;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Vytvoríme vlastné funkcie pre tento skript
let myConsoleLog = originalConsoleLog;
let myConsoleDebug = originalConsoleDebug;
let myConsoleInfo = originalConsoleInfo;
let myConsoleWarn = originalConsoleWarn;
let myConsoleError = originalConsoleError;

// Ak je DEBUG_MODE vypnutý, prepíšeme lokálne funkcie na noop
if (!DEBUG_MODE) {
    const noop = () => {};
    myConsoleLog = noop;
    myConsoleDebug = noop;
    myConsoleInfo = noop;
}

// Pomocné funkcie pre lokálne logovanie
function log(...args) {
    myConsoleLog(...args);
}

function debug(...args) {
    myConsoleDebug(...args);
}

function info(...args) {
    myConsoleInfo(...args);
}

function warn(...args) {
    myConsoleWarn(...args);
}

function error(...args) {
    myConsoleError(...args);
}

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
    
    // ========== JEDINÁ DEFINÍCIA FUNKCIE getGroupMatches ==========
    function getGroupMatches(categoryName, groupName) {
        return Object.values(matchesData).filter(match => 
            match.categoryName === categoryName && 
            match.groupName === groupName &&
            !match.isPlacementMatch  // VYNEChÁME ZÁPASY O UMIESTNENIE
        );
    }
    
    // ========== JEDINÁ DEFINÍCIA FUNKCIE getCompletedGroupMatches ==========
    function getCompletedGroupMatches(categoryName, groupName) {
        return Object.values(matchesData).filter(match => 
            match.categoryName === categoryName && 
            match.groupName === groupName && 
            match.status === 'completed' &&
            !match.isPlacementMatch  // VYNEChÁME ZÁPASY O UMIESTNENIE
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
    
    // Funkcia na porovnanie dvoch tímov podľa nastavených kritérií
    function compareTeams(teamA, teamB, groupMatches, sortingConditions) {
        // 1. Najprv porovnáme podľa bodov
        if (teamA.points !== teamB.points) {
            return teamB.points - teamA.points;
        }
    
        // 2. Ak sú body rovnaké, použijeme nastavené kritériá
        if (sortingConditions && sortingConditions.length > 0) {
            for (const condition of sortingConditions) {
                const { parameter, direction } = condition;
                let comparison = 0;
                
                switch (parameter) {
                    case 'headToHead':
                        const { teamAScore, teamBScore, teamAWins, teamBWins } = calculateHeadToHead(teamA.id, teamB.id, groupMatches);
                        if (teamAWins !== teamBWins) {
                            comparison = teamBWins - teamAWins;
                        } else if (teamAScore !== teamBScore) {
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
    
    // Funkcia na získanie všetkých tímov v skupine (na základe všetkých zápasov)
    function getTeamsInGroupFromAllMatches(groupMatches) {
        const teamsMap = new Map();
        
        groupMatches.forEach(match => {
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
    
    // Funkcia na vytvorenie tabuľky skupiny zo všetkých zápasov (aj neodohraných)
    function createGroupTable(categoryName, groupName) {
        const allGroupMatches = getGroupMatches(categoryName, groupName);
        
        if (allGroupMatches.length === 0) {
            log(`Žiadne zápasy pre skupinu ${groupName} v kategórii ${categoryName}`);
            return null;
        }
        
        const completedGroupMatches = allGroupMatches.filter(match => match.status === 'completed');
        const teamsInGroup = getTeamsInGroupFromAllMatches(allGroupMatches);
        
        const categorySetting = categorySettingsCache[categoryName];
        const carryOverPoints = categorySetting?.carryOverPoints ?? false;

        log(`📋 Kategória ${categoryName}: carryOverPoints = ${carryOverPoints}`);

        completedGroupMatches.forEach(match => {
            const events = eventsData[match.id] || [];
            const { home: homeScore, away: awayScore } = getCurrentScore(events);
            
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
                    homeTeamStats.points += 2;
                    awayTeamStats.losses++;
                } else if (awayScore > homeScore) {
                    awayTeamStats.wins++;
                    awayTeamStats.points += 2;
                    homeTeamStats.losses++;
                } else {
                    homeTeamStats.draws++;
                    homeTeamStats.points += 1;
                    awayTeamStats.draws++;
                    awayTeamStats.points += 1;
                }
            }
        });

        if (!carryOverPoints && groupName && groupName.toLowerCase().includes('nadstavbová')) {
            log(`⚠️ Pre kategóriu ${categoryName} je carryOverPoints = false, body zo základnej skupiny sa NEBUDÚ prenášať do nadstavbovej`);
        }
        
        teamsInGroup.forEach(team => {
            team.goalDifference = team.goalsFor - team.goalsAgainst;
        });
        
        const sortedTeams = [...teamsInGroup].sort((a, b) => {
            return compareTeams(a, b, allGroupMatches, tableSettings.sortingConditions);
        });
        
        const totalMatches = allGroupMatches.length;
        const completedMatches = completedGroupMatches.length;
        
        return {
            category: categoryName,
            group: groupName,
            teams: sortedTeams,
            matches: allGroupMatches,
            completedMatches: completedGroupMatches,
            totalMatches: totalMatches,
            completedCount: completedMatches,
            remainingCount: totalMatches - completedMatches,
            completionPercentage: totalMatches > 0 ? (completedMatches / totalMatches * 100).toFixed(1) : 0
        };
    }

    // Pomocná funkcia na získanie názvu tímu pre nadstavbovú skupinu
    function getTeamNameForAdvancedGroup(teamNameFromGroup, category, groupLetter, position) {
        const looksLikeIdentifier = /[0-9]+[A-Za-z]+|[A-Za-z]+[0-9]+/.test(teamNameFromGroup);
        
        if (!looksLikeIdentifier) {
            return teamNameFromGroup;
        }
        
        const mappedName = window.matchTracker.getTeamNameByDisplayId(teamNameFromGroup);
        
        if (mappedName && mappedName !== teamNameFromGroup) {
            return mappedName;
        }
        
        return teamNameFromGroup;
    }

    function createAdvancedGroupTable(categoryName, groupName, baseGroupName) {
        const baseGroupTable = createGroupTable(categoryName, baseGroupName);
        if (!baseGroupTable || !baseGroupTable.teams || baseGroupTable.teams.length === 0) {
            log(`❌ Základná skupina ${baseGroupName} neexistuje alebo nemá dáta`);
            return null;
        }
        
        const categorySetting = categorySettingsCache[categoryName];
        const carryOverPoints = categorySetting?.carryOverPoints ?? false;
        const carryOverMatches = categorySetting?.carryOverMatches ?? true;
        
        const advancedMatches = getGroupMatches(categoryName, groupName);
        if (advancedMatches.length === 0) {
            log(`❌ Žiadne zápasy pre nadstavbovú skupinu ${groupName}`);
            return null;
        }
        
        let teamsInAdvanced = getTeamsInGroupFromAllMatches(advancedMatches);
        teamsInAdvanced = mapAdvancedGroupTeams(teamsInAdvanced, categoryName, baseGroupTable, baseGroupName);
        
        const basePointsMap = new Map();
        const baseMatchesMap = new Map();
        
        if (carryOverPoints) {
            for (const baseTeam of baseGroupTable.teams) {
                const baseTeamIndex = baseGroupTable.teams.findIndex(t => t.id === baseTeam.id);
                const position = baseTeamIndex + 1;
                const baseGroupLetter = baseGroupName.replace('skupina ', '').toUpperCase();
                const displayId = `${cleanCategoryName(categoryName)} ${position}${baseGroupLetter}`;
                
                const looksLikeIdentifier = /[0-9]+[A-Za-z]+|[A-Za-z]+[0-9]+/.test(displayId);
                let finalBaseName = baseTeam.name;
                
                if (looksLikeIdentifier) {
                    const mappedBaseName = window.matchTracker.getTeamNameByDisplayId(displayId);
                    finalBaseName = (mappedBaseName && mappedBaseName !== displayId) ? mappedBaseName : baseTeam.name;
                } else {
                    finalBaseName = baseTeam.name;
                }
                
                basePointsMap.set(finalBaseName, baseTeam.points);
            }
        }
        
        const allBaseMatches = getGroupMatches(categoryName, baseGroupName);
        const completedBaseMatches = allBaseMatches.filter(m => m.status === 'completed');
        
        const advancedTeamIdToBaseId = new Map();
        for (const advancedTeam of teamsInAdvanced) {
            const baseTeam = baseGroupTable.teams.find(t => t.name === advancedTeam.name || 
                (window.teamManager?.getTeamNameByDisplayIdSync?.(t.id) === advancedTeam.name));
            if (baseTeam) {
                advancedTeamIdToBaseId.set(advancedTeam.id, baseTeam.id);
            }
        }
        
        const transferredMatches = [];
        
        if (carryOverMatches) {
            for (let i = 0; i < teamsInAdvanced.length; i++) {
                for (let j = i + 1; j < teamsInAdvanced.length; j++) {
                    const teamA = teamsInAdvanced[i];
                    const teamB = teamsInAdvanced[j];
                    
                    const baseTeamAId = advancedTeamIdToBaseId.get(teamA.id);
                    const baseTeamBId = advancedTeamIdToBaseId.get(teamB.id);
                    
                    if (!baseTeamAId || !baseTeamBId) continue;
                    
                    const baseMatch = completedBaseMatches.find(m => 
                        (m.homeTeamIdentifier === baseTeamAId && m.awayTeamIdentifier === baseTeamBId) ||
                        (m.homeTeamIdentifier === baseTeamBId && m.awayTeamIdentifier === baseTeamAId)
                    );
                    
                    if (baseMatch) {
                        const events = eventsData[baseMatch.id] || [];
                        const { home: homeScore, away: awayScore } = getCurrentScore(events);
                        
                        let teamAScore = 0;
                        let teamBScore = 0;
                        
                        if (baseMatch.homeTeamIdentifier === baseTeamAId) {
                            teamAScore = homeScore;
                            teamBScore = awayScore;
                        } else {
                            teamAScore = awayScore;
                            teamBScore = homeScore;
                        }
                        
                        teamA.played++;
                        teamB.played++;
                        
                        teamA.goalsFor += teamAScore;
                        teamA.goalsAgainst += teamBScore;
                        teamB.goalsFor += teamBScore;
                        teamB.goalsAgainst += teamAScore;
                        
                        if (teamAScore > teamBScore) {
                            teamA.wins++;
                            teamB.losses++;
                            if (!carryOverPoints) {
                                teamA.points += 2;
                            }
                        } else if (teamBScore > teamAScore) {
                            teamB.wins++;
                            teamA.losses++;
                            if (!carryOverPoints) {
                                teamB.points += 2;
                            }
                        } else {
                            teamA.draws++;
                            teamB.draws++;
                            if (!carryOverPoints) {
                                teamA.points += 1;
                                teamB.points += 1;
                            }
                        }
                        
                        transferredMatches.push({
                            homeTeam: teamA.name,
                            awayTeam: teamB.name,
                            homeScore: teamAScore,
                            awayScore: teamBScore,
                            fromGroup: baseGroupName
                        });
                    }
                }
            }
        }
        
        const completedAdvancedMatches = advancedMatches.filter(m => m.status === 'completed');
        
        completedAdvancedMatches.forEach(match => {
            const events = eventsData[match.id] || [];
            const { home: homeScore, away: awayScore } = getCurrentScore(events);
            
            const homeTeamStats = teamsInAdvanced.find(t => t.id === match.homeTeamIdentifier);
            const awayTeamStats = teamsInAdvanced.find(t => t.id === match.awayTeamIdentifier);
            
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
                } else if (awayScore > homeScore) {
                    awayTeamStats.wins++;
                    homeTeamStats.losses++;
                } else {
                    homeTeamStats.draws++;
                    awayTeamStats.draws++;
                }
            }
        });
        
        if (carryOverPoints) {
            teamsInAdvanced.forEach(team => {
                const basePoints = basePointsMap.get(team.name) || 0;
                team.basePoints = basePoints;
                if (!carryOverMatches) {
                    team.points = (team.wins * 2) + team.draws + basePoints;
                } else {
                    team.basePoints = basePoints;
                }
            });
        } else {
            teamsInAdvanced.forEach(team => {
                team.points = (team.wins * 2) + team.draws;
            });
        }
        
        teamsInAdvanced.forEach(team => {
            team.goalDifference = team.goalsFor - team.goalsAgainst;
        });
        
        const sortedTeams = [...teamsInAdvanced].sort((a, b) => {
            return compareTeams(a, b, advancedMatches, tableSettings.sortingConditions);
        });
        
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
        
        return {
            category: categoryName,
            group: groupName,
            baseGroup: baseGroupName,
            carryOverPoints: carryOverPoints,
            carryOverMatches: carryOverMatches,
            teams: sortedTeams,
            matches: allMatchesForDisplay,
            completedMatches: [...completedAdvancedMatches, ...transferredMatches],
            totalMatches: advancedMatches.length,
            completedCount: completedAdvancedMatches.length + transferredMatches.length,
            remainingCount: advancedMatches.length - completedAdvancedMatches.length,
            completionPercentage: advancedMatches.length > 0 ? ((completedAdvancedMatches.length + transferredMatches.length) / advancedMatches.length * 100).toFixed(1) : 0,
            transferredMatches: transferredMatches
        };
    }
    
    // Cache pre nastavenia kategórií
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
                    categorySettingsCache[catData.name] = {
                        carryOverPoints: catData.carryOverPoints ?? false,
                        id: catId
                    };
                }
                log('📋 Načítané nastavenia kategórií (carryOverPoints):', categorySettingsCache);
            }
        } catch (error) {
            console.error('❌ Chyba pri načítaní nastavení kategórií:', error);
        }
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
            console.error('❌ Chyba pri načítaní nastavení poradia:', error);
            tableSettings.sortingConditions = [];
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
                tableSettings.sortingConditions = data.sortingConditions || [];
                log('🔄 Aktualizované kritériá poradia:', tableSettings.sortingConditions);
                printAllGroupTables();
            }
        }, (error) => {
            console.error('❌ Chyba pri sledovaní nastavení poradia:', error);
        });
    }
    
    // Funkcia na mapovanie všetkých tímov v nadstavbovej skupine
    function mapAdvancedGroupTeams(teamsInAdvanced, categoryName, baseGroupTable, baseGroupName) {
        const cleanCategory = cleanCategoryName(categoryName);
        const baseGroupLetter = baseGroupName.replace('skupina ', '').toUpperCase();
        
        const mappedTeams = new Map();
        
        for (const team of teamsInAdvanced) {
            const baseTeamIndex = baseGroupTable.teams.findIndex(t => t.id === team.id);
            const position = baseTeamIndex + 1;
            const displayId = `${cleanCategory} ${position}${baseGroupLetter}`;
            
            const mappedName = window.matchTracker.getTeamNameByDisplayId(displayId);
            
            if (mappedName && mappedName !== team.name && mappedName !== displayId) {
                mappedTeams.set(team.id, mappedName);
            }
        }
        
        for (const team of teamsInAdvanced) {
            if (mappedTeams.has(team.id)) {
                team.name = mappedTeams.get(team.id);
            }
        }
        
        return teamsInAdvanced;
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
    
    // Funkcia na výpis tabuľky skupiny
    function printGroupTable(categoryName, groupName, baseGroupName = null) {
        let table;
    
        if (baseGroupName && groupName.toLowerCase().includes('nadstavbová')) {
            table = createAdvancedGroupTable(categoryName, groupName, baseGroupName);
        } else {
            table = createGroupTable(categoryName, groupName);
        }
    
        if (!table) return;
        
        const looksLikeIdentifier = (str) => /[0-9]+[A-Za-z]+|[A-Za-z]+[0-9]+/.test(str);
        
        for (const team of table.teams) {
            if (looksLikeIdentifier(team.name)) {
                const mappedName = window.matchTracker.getTeamNameByDisplayId(team.name);
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
        
        const upcomingMatches = table.matches.filter(m => m.status !== 'completed');
        if (upcomingMatches.length > 0) {
            log(`\n📅 NEODOHRANÉ ZÁPASY (${upcomingMatches.length}):`);
            upcomingMatches.forEach((match, idx) => {
                let homeTeam = window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier;
                let awayTeam = window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier;
                
                const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null;
                const dateStr = matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený';
                log(`   ${idx+1}. ${homeTeam} vs ${awayTeam} (${dateStr}) - ${getStatusText(match.status)}`);
            });
        }
        if (table.transferredMatches && table.transferredMatches.length > 0) {
            log(`\n🔄 PRENESENÉ ZÁPASY (zo základnej skupiny ${table.baseGroup}):`);
            table.transferredMatches.forEach((match, idx) => {
                log(`   ${idx+1}. ${match.homeTeam} ${match.homeScore}:${match.awayScore} ${match.awayTeam} (prenesené)`);
            });
        }
        
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
    
    // Funkcia na výpis všetkých tabuliek skupín
    function printAllGroupTables() {
        const allMatches = getAllMatches();
        
        if (allMatches.length === 0) {
            log('Žiadne zápasy v databáze');
            return;
        }
        
        const uniqueGroups = new Set();
        allMatches.forEach(match => {
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
        if (!window.db) {
            log('⏳ Čakám na inicializáciu Firebase...');
            for (let i = 0; i < 50; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                if (window.db) break;
            }
            if (!window.db) {
                console.error('❌ Firebase nebol inicializovaný!');
                return;
            }
        }
        
        log('✅ Firebase inicializovaný, spúšťam sledovanie...');
        
        const { collection, query, where, onSnapshot, getDocs } = window.firebaseModules || 
            await importFirebaseModules();
        
        if (!collection) {
            console.error('❌ Firebase moduly neboli načítané!');
            return;
        }
        
        await loadTableSettings();
        const unsubscribeSettings = subscribeToTableSettings();
        
        const matchesRef = collection(window.db, 'matches');
        
        unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
            log(`🔄 Zmena v databáze: ${snapshot.size} zápasov celkom`);
            
            let completedMatchChanged = false;
        
            snapshot.docChanges().forEach(change => {
                const match = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'added') {
                    matchesData[match.id] = match;
                    subscribeToMatchEvents(match.id);
                    
                } else if (change.type === 'modified') {
                    const oldMatch = matchesData[match.id];
                    matchesData[match.id] = match;
                    
                    if (oldMatch && oldMatch.status !== match.status && match.status === 'completed') {
                        log(`✅ Zápas DOHRANÝ! Zmena stavu: ${getStatusText(oldMatch.status)} → ${getStatusText(match.status)}`);
                        completedMatchChanged = true;
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
            
            if (completedMatchChanged) {
                log('🏁 Spúšťam prepočet tabuliek skupín (zápas bol dohraný)...');
                printAllGroupTables();
                
                if (window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('groupTablesUpdated', {
                        detail: { reason: 'match_completed', timestamp: Date.now() }
                    }));
                }
            }
            
        }, (error) => {
            console.error('❌ Chyba pri sledovaní zápasov:', error);
        });
        
        const matchesSnapshot = await getDocs(matchesRef);
        for (const doc of matchesSnapshot.docs) {
            const matchId = doc.id;
            subscribeToMatchEvents(matchId);
        }
        
        setTimeout(() => {
            printAllGroupTables();
        }, 2000);
        
        window.__unsubscribeTableSettings = unsubscribeSettings;
        
        await loadCategorySettings();
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
                printAllGroupTables();
            }
            
        }, (error) => {
            console.error(`❌ Chyba pri sledovaní udalostí pre zápas ${matchId}:`, error);
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
            console.error('❌ Chyba pri načítaní Firebase modulov:', error);
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
    
    // Pomocná funkcia na odstránenie "VS" z názvu kategórie
    function cleanCategoryName(categoryName) {
        if (!categoryName) return categoryName;
        let cleaned = categoryName.replace(/\s+VS\s+/g, ' ').replace(/\s+VS$/g, '').replace(/^VS\s+/g, '');
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
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
        getGroupMatches: getGroupMatches,
        getCompletedGroupMatches: getCompletedGroupMatches,
        getSortingConditions: () => tableSettings.sortingConditions,
        getMatches: () => matchesData,
        getEvents: (matchId) => eventsData[matchId] || [],
        createAdvancedGroupTable: createAdvancedGroupTable,
        getCategorySettings: () => categorySettingsCache,
        getCarryOverPoints: (categoryName) => categorySettingsCache[categoryName]?.carryOverPoints ?? false,
        getCurrentScore: getCurrentScore,
        getTeamNameByDisplayId: null, // Bude nastavené neskôr
        cleanCategoryName: cleanCategoryName
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

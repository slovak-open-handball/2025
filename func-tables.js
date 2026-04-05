(function() {
    'use strict';
    
    console.log('=== SPÚŠŤAM SLEDOVANIE ZÁPASOV (MÓD: TABUĽKA SKUPÍN) ===');
    
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
    
    // Funkcia na získanie všetkých zápasov v skupine (vrátane neodohraných)
    function getGroupMatches(categoryName, groupName) {
        return Object.values(matchesData).filter(match => 
            match.categoryName === categoryName && match.groupName === groupName
        );
    }
    
    // Funkcia na získanie odohraných zápasov v skupine
    function getCompletedGroupMatches(categoryName, groupName) {
        return Object.values(matchesData).filter(match => 
            match.categoryName === categoryName && match.groupName === groupName && match.status === 'completed'
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
    
    // Funkcia na získanie všetkých tímov v skupine (na základe všetkých zápasov, nielen odohraných)
    function getTeamsInGroupFromAllMatches(groupMatches) {
        const teamsMap = new Map();
        
        groupMatches.forEach(match => {
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
        // Získame VŠETKY zápasy v skupine (aj neodohrané)
        const allGroupMatches = getGroupMatches(categoryName, groupName);
        
        if (allGroupMatches.length === 0) {
            console.log(`Žiadne zápasy pre skupinu ${groupName} v kategórii ${categoryName}`);
            return null;
        }
        
        // Získame len ODOHRANÉ zápasy pre výpočet štatistík
        const completedGroupMatches = allGroupMatches.filter(match => match.status === 'completed');
        
        // Získame všetky tímy v skupine (na základe všetkých zápasov)
        const teamsInGroup = getTeamsInGroupFromAllMatches(allGroupMatches);
        
        // Spracujeme výsledky LEN z ODOHRANÝCH zápasov
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
        
        // Vypočítame rozdiel skóre
        teamsInGroup.forEach(team => {
            team.goalDifference = team.goalsFor - team.goalsAgainst;
        });
        
        // Zoradenie tímov v tabuľke podľa nastavených kritérií
        const sortedTeams = [...teamsInGroup].sort((a, b) => {
            return compareTeams(a, b, allGroupMatches, tableSettings.sortingConditions);
        });
        
        // Výpočet celkového počtu zápasov v skupine a odohraných
        const totalMatches = allGroupMatches.length;
        const completedMatches = completedGroupMatches.length;
        const remainingMatches = totalMatches - completedMatches;
        
        return {
            category: categoryName,
            group: groupName,
            teams: sortedTeams,
            matches: allGroupMatches,
            completedMatches: completedGroupMatches,
            totalMatches: totalMatches,
            completedCount: completedMatches,
            remainingCount: remainingMatches,
            completionPercentage: totalMatches > 0 ? (completedMatches / totalMatches * 100).toFixed(1) : 0
        };
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
                console.log('📋 Načítané kritériá poradia:', tableSettings.sortingConditions);
            } else {
                tableSettings.sortingConditions = [];
                console.log('📋 Používam predvolené kritériá poradia (len podľa bodov)');
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
                console.log('🔄 Aktualizované kritériá poradia:', tableSettings.sortingConditions);
                // Po zmene kritérií prepočítame tabuľky
                printAllGroupTables();
            }
        }, (error) => {
            console.error('❌ Chyba pri sledovaní nastavení poradia:', error);
        });
    }
    
    // Funkcia na výpis tabuľky skupiny
    function printGroupTable(categoryName, groupName) {
        const table = createGroupTable(categoryName, groupName);
        
        if (!table) return;
        
        console.log('\n' + '='.repeat(120));
        console.log(`📊 TABUĽKA SKUPINY: ${table.category} - ${table.group}`);
        console.log('='.repeat(120));
        
        // Informácia o počte odohraných zápasov
        const progressBar = generateProgressBar(table.completionPercentage);
        console.log(`📋 Zápasy: ${table.completedCount} / ${table.totalMatches} odohraných (${table.completionPercentage}%)`);
        console.log('-'.repeat(120));
        console.log(' '.padEnd(4) + 'TÍM'.padEnd(30) + 'Z'.padEnd(5) + 'V'.padEnd(5) + 'R'.padEnd(5) + 'P'.padEnd(5) + 'Skóre'.padEnd(12) + '+/-'.padEnd(6) + 'Body');
        console.log('-'.repeat(120));
    
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
            
            console.log(`${position}${name}${played}${wins}${draws}${losses}${score}${diffDisplay}${points}`);
        });
        
        console.log('-'.repeat(120));
        
        // Výpis neodohraných zápasov
        const upcomingMatches = table.matches.filter(m => m.status !== 'completed');
        if (upcomingMatches.length > 0) {
            console.log(`\n📅 NEODOHRANÉ ZÁPASY (${upcomingMatches.length}):`);
            upcomingMatches.forEach((match, idx) => {
                const homeTeam = window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier;
                const awayTeam = window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier;
                const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null;
                const dateStr = matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený';
                console.log(`   ${idx+1}. ${homeTeam} vs ${awayTeam} (${dateStr}) - ${getStatusText(match.status)}`);
            });
        }
        
        // Výpis použitých kritérií poradia
        if (tableSettings.sortingConditions.length > 0) {
            console.log(`\n📋 Kritériá poradia: ${tableSettings.sortingConditions.map((c, i) => {
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
            console.log(`\n📋 Kritériá poradia: predvolené (body, +/-, strelené góly, abeceda)`);
        }
        
        console.log('='.repeat(120) + '\n');
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
            console.log('Žiadne zápasy v databáze');
            return;
        }
        
        // Získame unikátne kombinácie kategória + skupina
        const uniqueGroups = new Set();
        allMatches.forEach(match => {
            if (match.categoryName && match.groupName) {
                uniqueGroups.add(`${match.categoryName}|${match.groupName}`);
            }
        });
        
        if (uniqueGroups.size === 0) {
            console.log('Nenašli sa žiadne skupiny');
            return;
        }
        
        console.log('\n' + '='.repeat(100));
        console.log(`📊 VŠETKY TABUĽKY SKUPÍN (${uniqueGroups.size} skupín)`);
        console.log('='.repeat(100));
        
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
            console.log('Žiadne odohrané zápasy');
            return;
        }
        
        console.log('\n' + '='.repeat(90));
        console.log(`✅ ODOHRANÉ ZÁPASY (${completedMatches.length}) - ${new Date().toLocaleTimeString()}`);
        console.log('='.repeat(90));
        
        const sortedMatches = [...completedMatches].sort((a, b) => {
            if (!a.scheduledTime && !b.scheduledTime) return 0;
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return b.scheduledTime.toDate() - a.scheduledTime.toDate();
        });
        
        sortedMatches.forEach((match, index) => {
            const details = getMatchDetails(match.id);
            if (!details) return;
            
            console.log(`\n${index + 1}. 🏁 ${details.homeTeamName} vs ${details.awayTeamName}`);
            console.log(`   📅 ${details.dateStr}`);
            console.log(`   🏷️ Kategória: ${details.category}`);
            console.log(`   👥 Skupina: ${details.group}`);
            console.log(`   🥅 Konečné skóre: ${details.homeScore} : ${details.awayScore}`);
            console.log(`   🆔 Domáci ID: ${details.homeTeamId}`);
            console.log(`   🆔 Hostia ID: ${details.awayTeamId}`);
        });
        
        console.log('\n' + '='.repeat(90) + '\n');
    }
    
    // Funkcia na výpis prehľadu všetkých skupín
    function printGroupsOverview() {
        const allMatches = getAllMatches();
        
        if (allMatches.length === 0) {
            console.log('Žiadne zápasy v databáze');
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
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 PREHĽAD SKUPÍN');
        console.log('='.repeat(80));
        
        const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return a.group.localeCompare(b.group);
        });
        
        sortedGroups.forEach(group => {
            const completedPercent = group.total > 0 ? (group.completed / group.total * 100).toFixed(1) : 0;
            const progressBar = generateProgressBar(completedPercent);
            console.log(`\n📌 ${group.category} - ${group.group}`);
            console.log(`   Zápasy: ${group.completed}/${group.total} odohraných (${completedPercent}%) ${progressBar}`);
            console.log(`   📅 Naplánované: ${group.scheduled} | ▶️ Prebieha: ${group.inProgress} | ✅ Odohrané: ${group.completed}`);
        });
        
        console.log('\n' + '='.repeat(80) + '\n');
    }
    
    // Hlavná funkcia na inicializáciu sledovania
    async function initializeMatchTracker() {
        if (!window.db) {
            console.log('⏳ Čakám na inicializáciu Firebase...');
            for (let i = 0; i < 50; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                if (window.db) break;
            }
            if (!window.db) {
                console.error('❌ Firebase nebol inicializovaný!');
                return;
            }
        }
        
        console.log('✅ Firebase inicializovaný, spúšťam sledovanie...');
        
        const { collection, query, where, onSnapshot, getDocs } = window.firebaseModules || 
            await importFirebaseModules();
        
        if (!collection) {
            console.error('❌ Firebase moduly neboli načítané!');
            return;
        }
        
        // Načítame nastavenia poradia
        await loadTableSettings();
        
        // Spustíme sledovanie zmien nastavení poradia
        const unsubscribeSettings = subscribeToTableSettings();
        
        const matchesRef = collection(window.db, 'matches');
        
        unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
            console.log(`🔄 Zmena v databáze: ${snapshot.size} zápasov celkom`);
            
            snapshot.docChanges().forEach(change => {
                const match = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'added') {
                    console.log(`➕ Pridaný zápas: ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier} (${match.status})`);
                    matchesData[match.id] = match;
                    subscribeToMatchEvents(match.id);
                    
                } else if (change.type === 'modified') {
                    const oldMatch = matchesData[match.id];
                    matchesData[match.id] = match;
                    
                    if (oldMatch && oldMatch.status !== match.status) {
                        console.log(`🔄 Zmena stavu zápasu: ${getStatusText(oldMatch.status)} → ${getStatusText(match.status)}`);
                    }
                    
                } else if (change.type === 'removed') {
                    console.log(`❌ Odstránený zápas: ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}`);
                    delete matchesData[match.id];
                    
                    if (unsubscribeEvents[match.id]) {
                        unsubscribeEvents[match.id]();
                        delete unsubscribeEvents[match.id];
                    }
                    delete eventsData[match.id];
                }
            });
            
            // Po každej zmene vypíšeme tabuľky skupín
            printAllGroupTables();
            
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
        
        // Uložíme unsubscribe pre prípad potreby
        window.__unsubscribeTableSettings = unsubscribeSettings;
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
                console.log(`🔄 Aktualizácia udalostí pre zápas ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}`);
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
        
        console.log('⏹️ Sledovanie zápasov zastavené');
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
        getEvents: (matchId) => eventsData[matchId] || []
    };
    
    // Spustenie sledovania
    initializeMatchTracker();
    
    console.log('📡 MatchTracker inicializovaný. Dostupné funkcie:');
    console.log('   • window.matchTracker.printAllGroupTables() - výpis všetkých tabuliek skupín');
    console.log('   • window.matchTracker.printGroupTable("kategória", "skupina") - výpis tabuľky pre konkrétnu skupinu');
    console.log('   • window.matchTracker.printGroupsOverview() - výpis prehľadu všetkých skupín');
    console.log('   • window.matchTracker.printCompleted() - výpis odohraných zápasov');
    console.log('   • window.matchTracker.createGroupTable("kategória", "skupina") - získanie tabuľky ako objekt');
    console.log('   • window.matchTracker.getSortingConditions() - získanie aktuálnych kritérií poradia');
    console.log('   • window.matchTracker.refresh() - obnovenie výpisu');
    console.log('   • window.matchTracker.stop() - zastavenie sledovania');
    
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
                console.log(`📦 Načítaná cache z localStorage: ${Object.keys(data.mappings).length} položiek`);
                return new Map(Object.entries(data.mappings));
            } else {
                console.log('🔄 Verzia cache sa líši, vytváram novú...');
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    } catch (error) {
        console.error('❌ Chyba pri načítaní cache:', error);
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
        console.log(`💾 Uložená cache do localStorage: ${cacheMap.size} položiek`);
    } catch (error) {
        console.error('❌ Chyba pri ukladaní cache:', error);
    }
}

// Inicializácia cache
let replacementCache = loadReplacementCache();

// Funkcia na získanie názvu tímu (najskôr z cache, potom z databázy)
function getTeamNameWithCache(displayId, category, groupLetter, position) {
    const cacheKey = `${cleanCategoryName(category)}|${groupLetter.toUpperCase()}|${position}`;
    
    // 1. Skúsime nájsť v cache
    if (replacementCache.has(cacheKey)) {
        const cached = replacementCache.get(cacheKey);
        console.log(`💿 POUŽITÉ Z CACHE: "${displayId}" → "${cached.teamName}" (uložené ${new Date(cached.timestamp).toLocaleTimeString()})`);
        return cached.teamName;
    }
    
    // 2. Nie je v cache - načítame z databázy
    console.log(`🔄 NAČÍTAM Z DATABÁZY: "${displayId}"`);
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
        console.log(`💾 ULOŽENÉ DO CACHE: "${displayId}" → "${teamName}"`);
    }
    
    return teamName;
}

// Pôvodná funkcia getTeamNameByDisplayId premenovaná na getTeamNameByDisplayIdFromDB
function getTeamNameByDisplayIdFromDB(displayId) {
    if (!displayId) {
        console.log('❌ Nebol zadaný identifikátor tímu');
        return null;
    }
    
    // Parsovanie identifikátora
    const parts = displayId.trim().split(' ');
    
    if (parts.length < 2) {
        console.log(`❌ Neplatný formát identifikátora: ${displayId}`);
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
        console.log(`❌ Neplatný formát pozície/skupiny: ${positionAndGroup}`);
        return null;
    }
    
    const positionNum = parseInt(position, 10);
    const fullGroupName = `skupina ${groupLetter.toUpperCase()}`;
    
    // Kontrola pripravenosti skupiny
    const isReady = isGroupReadyForReplacement(category, groupLetter);
    
    if (!isReady) {
        console.log(`⛔ [${category} - ${fullGroupName}] Skupina NIE JE pripravená`);
        return null;
    }
    
    console.log(`✅ [${category} - ${fullGroupName}] Skupina je pripravená, hľadám tím na pozícii ${positionNum}`);
    
    const groupTable = window.matchTracker?.createGroupTable(category, fullGroupName);
    
    if (!groupTable || !groupTable.teams || groupTable.teams.length === 0) {
        console.log(`❌ Tabuľka pre skupinu ${fullGroupName} neexistuje`);
        return null;
    }
    
    const teamIndex = positionNum - 1;
    
    if (teamIndex >= 0 && teamIndex < groupTable.teams.length) {
        const team = groupTable.teams[teamIndex];
        console.log(`🎉 NAJDENÝ V DB: "${displayId}" → "${team.name}"`);
        return team.name;
    } else {
        console.log(`❌ Pozícia ${positionNum} neexistuje (skupina má ${groupTable.teams.length} tímov)`);
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
        console.log(`💿 POUŽITÉ Z CACHE (rýchle): "${displayId}" → "${cached.teamName}"`);
        return cached.teamName;
    }
    
    return null;
}

// Funkcia na získanie názvu tímu z databázy (s kontrolou pripravenosti)
function getTeamNameFromDatabase(displayId) {
    console.log(`🔄 NAČÍTAM Z DATABÁZY: "${displayId}"`);
    
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
    
    // 🔴 KONTROLA PRIPRAVENOSTI - IBA PRI NAČÍTANÍ Z DB
    const isReady = isGroupReadyForReplacement(category, groupLetter);
    if (!isReady) {
        console.log(`⛔ [${category} - ${fullGroupName}] Skupina NIE JE pripravená, nenačítam z DB`);
        return null;
    }
    
    const groupTable = window.matchTracker?.createGroupTable(category, fullGroupName);
    if (!groupTable || !groupTable.teams || groupTable.teams.length === 0) {
        console.log(`❌ Tabuľka pre skupinu ${fullGroupName} neexistuje`);
        return null;
    }
    
    const teamIndex = positionNum - 1;
    if (teamIndex >= 0 && teamIndex < groupTable.teams.length) {
        const team = groupTable.teams[teamIndex];
        console.log(`🎉 NAJDENÝ V DB: "${displayId}" → "${team.name}"`);
        
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
function getTeamNameByDisplayId(displayId) {
    // 1. Najprv skúsime cache (rýchle, bez kontroly pripravenosti)
    const cachedName = getTeamNameFromCacheOnly(displayId);
    if (cachedName) {
        return cachedName;
    }
    
    // 2. Nie je v cache - načítame z databázy (s kontrolou pripravenosti)
    return getTeamNameFromDatabase(displayId);
}

// Funkcia na vymazanie cache (napr. pri aktualizácii dát)
function clearReplacementCache() {
    replacementCache.clear();
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ Cache bola vymazaná');
}

// Funkcia na zobrazenie obsahu cache
function showCache() {
    console.log('\n📦 OBSAH CACHE:');
    console.log('='.repeat(60));
    for (const [key, value] of replacementCache.entries()) {
        console.log(`   ${key}:`);
        console.log(`      → ${value.teamName}`);
        console.log(`      📅 Uložené: ${new Date(value.timestamp).toLocaleString()}`);
    }
    console.log('='.repeat(60));
    console.log(`Celkom: ${replacementCache.size} položiek\n`);
}

// Funkcia na aktualizáciu cache z aktuálneho stavu stránky
function updateCacheFromPage() {
    console.log('🔄 Aktualizujem cache z aktuálneho stavu stránky...');
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
        console.log(`✅ Aktualizovaných ${updated} položiek v cache`);
    } else {
        console.log('ℹ️ Žiadne nové položky na aktualizáciu');
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
        console.log('❌ Nebol zadaný identifikátor tímu');
        return null;
    }
    
    const parts = displayId.trim().split(' ');
    if (parts.length < 2) {
        console.log(`❌ Neplatný formát identifikátora: ${displayId}`);
        return null;
    }
    
    const positionAndGroup = parts.pop();
    let category = parts.join(' ');
    
    // ODSTRÁNIME "VS" Z NÁZVU KATEGÓRIE
    const originalCategory = category;
    category = cleanCategoryName(category);
    
    if (category !== originalCategory) {
        console.log(`🔧 Upravený názov kategórie: "${originalCategory}" → "${category}"`);
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
        console.log(`❌ Neplatný formát pozície/skupiny: ${positionAndGroup}`);
        return null;
    }
    
    const positionNum = parseInt(position, 10);
    const fullGroupName = `skupina ${groupLetter.toUpperCase()}`;
    
    const groupTable = window.matchTracker?.createGroupTable(category, fullGroupName);
    
    if (groupTable && groupTable.teams && groupTable.teams.length > 0) {
        const totalMatches = groupTable.totalMatches || 0;
        const completedMatches = groupTable.completedCount || 0;
        const completionPercentage = totalMatches > 0 ? (completedMatches / totalMatches * 100) : 0;
        
        console.log(`📊 Stav skupiny: ${completedMatches}/${totalMatches} odohraných (${completionPercentage}%)`);
        
        if (completionPercentage < 100) {
            console.log(`❌ Zápasy v skupine nie sú kompletne odohrané! (${completionPercentage}% dokončených)`);
            console.log(`   Pre zobrazenie konečného poradia je potrebné odohrať všetkých ${totalMatches} zápasov.`);
            return null;
        }
        
        const teamIndex = positionNum - 1;
        if (teamIndex >= 0 && teamIndex < groupTable.teams.length) {
            const team = groupTable.teams[teamIndex];
            console.log(`✅ Nájdený tím: ${team.name}`);
            console.log(`   📊 Štatistiky: Zápasy: ${team.played}, Výhry: ${team.wins}, Remízy: ${team.draws}, Prehry: ${team.losses}`);
            console.log(`   🥅 Skóre: ${team.goalsFor}:${team.goalsAgainst} (${team.goalDifference > 0 ? '+' : ''}${team.goalDifference})`);
            console.log(`   📈 Body: ${team.points}`);
            return team;
        }
    }
    
    console.log(`❌ Tím nebol nájdený: ${displayId}`);
    return null;
}

// Aktualizovaná funkcia extractIdentifiersFromText - lepšie filtrovanie a vždy vracia pole
function extractIdentifiersFromText(text) {
    // Ak text nie je reťazec, vrátime prázdne pole
    if (typeof text !== 'string' || !text) {
        console.log('ℹ️ extractIdentifiersFromText: text nie je platný reťazec');
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

function isGroupReadyForReplacement(category, groupLetter) {
    const cleanCategory = cleanCategoryName(category);
    const fullGroupName = `skupina ${groupLetter.toUpperCase()}`;
    
    // 1. Skúsime získať tabuľku skupiny
    let groupTable = window.matchTracker?.createGroupTable(cleanCategory, fullGroupName);
    
    if (!groupTable) {
        console.log(`⏳ [${cleanCategory} - ${fullGroupName}] Tabuľka neexistuje → NIE JE PRIpravená`);
        return false;
    }
    
    const totalMatches = groupTable.totalMatches || 0;
    const completedMatches = groupTable.completedCount || 0;
    const completionPercentage = totalMatches > 0 ? (completedMatches / totalMatches * 100) : 0;
    
    // 2. Podmienka 1: Všetky zápasy musia byť odohrané (100%)
    if (completionPercentage < 100) {
//        console.log(`⏳ [${cleanCategory} - ${fullGroupName}] Len ${completedMatches}/${totalMatches} (${completionPercentage}%) odohraných → NIE JE PRIpravená`);
        return false;
    }
    
    console.log(`✅ [${cleanCategory} - ${fullGroupName}] 100% zápasov odohraných (${completedMatches}/${totalMatches})`);
    
    // 3. Podmienka 2: Všetky zápasy musia mať načítané udalosti (events)
    const allGroupMatches = window.matchTracker?.getGroupMatches?.(cleanCategory, fullGroupName) || [];
    const completedMatchesList = allGroupMatches.filter(m => m.status === 'completed');
    
    let allEventsLoaded = true;
    for (const match of completedMatchesList) {
        const events = window.matchTracker?.getEvents?.(match.id) || [];
        if (events.length === 0) {
            console.log(`⏳ [${cleanCategory} - ${fullGroupName}] Zápas ${match.id} nemá načítané udalosti → NIE JE PRIpravená`);
            allEventsLoaded = false;
            break;
        }
        
        const { home, away } = getCurrentScoreFromEvents(events);
        if (home === 0 && away === 0 && events.length > 0) {
            console.log(`⏳ [${cleanCategory} - ${fullGroupName}] Zápas ${match.id} má udalosti ale skóre je 0:0 → NIE JE PRIpravená`);
            allEventsLoaded = false;
            break;
        }
    }
    
    if (!allEventsLoaded) {
        return false;
    }
    
    console.log(`✅ [${cleanCategory} - ${fullGroupName}] Všetky udalosti načítané`);
    
    // 4. Dodatočná kontrola: Žiadny zápas by nemal byť v stave 'in-progress' alebo 'paused'
    const hasInProgressMatches = allGroupMatches.some(m => m.status === 'in-progress' || m.status === 'paused');
    if (hasInProgressMatches) {
        console.log(`⏳ [${cleanCategory} - ${fullGroupName}] Sú tam zápasy, ktoré ešte prebiehajú → NIE JE PRIpravenÁ`);
        return false;
    }
    
    // 🔴 5. KONTROLA STABILITY: Počkáme, či sa počet zápasov už nemení
    const groupKey = `${cleanCategory}|${groupLetter.toUpperCase()}`;
    const currentMatchCount = totalMatches;
    const lastCount = lastGroupMatchCount.get(groupKey);
    
    // Ak sa počet zápasov zmenil, resetujeme timeout
    if (lastCount !== currentMatchCount) {
        lastGroupMatchCount.set(groupKey, currentMatchCount);
        
        // Zrušíme existujúci timeout pre túto skupinu
        if (groupStabilityCheck.has(groupKey)) {
            clearTimeout(groupStabilityCheck.get(groupKey));
            console.log(`🔄 [${cleanCategory} - ${fullGroupName}] Počet zápasov sa zmenil (${lastCount} → ${currentMatchCount}), resetujem čakanie...`);
        }
        
        // Nastavíme nový timeout (5 sekúnd bez zmeny = stabilné)
        const timeout = setTimeout(() => {
            console.log(`✅ [${cleanCategory} - ${fullGroupName}] Počet zápasov je stabilný (${currentMatchCount}), skupina je pripravená!`);
            
            // Uložíme do processedGroups
            processedGroups.set(groupKey, {
                isReady: true,
                percentage: 100,
                lastCheck: Date.now(),
                totalMatches: totalMatches,
                completedMatches: completedMatches,
                allEventsLoaded: true
            });
            
            groupStabilityCheck.delete(groupKey);
            
            // Spustíme nahradenie pre túto skupinu
            const allText = document.body.innerText;
            const identifiers = extractIdentifiersFromText(allText);
            const readyForThisGroup = identifiers.filter(id => 
                id.category === cleanCategory && id.groupLetter === groupLetter.toUpperCase()
            );
            
            if (readyForThisGroup.length > 0) {
                console.log(`🎉 Spúšťam nahradenie pre skupinu ${fullGroupName}...`);
                performPartialReplacement(readyForThisGroup);
            }
        }, 5000); // 5 sekúnd bez zmeny
        
        groupStabilityCheck.set(groupKey, timeout);
        console.log(`⏳ [${cleanCategory} - ${fullGroupName}] Čakám na stabilitu (aktuálne ${currentMatchCount} zápasov)...`);
        return false;
    }
    
    // Ak už máme stabilný počet a skupina je v processedGroups
    if (processedGroups.has(groupKey) && processedGroups.get(groupKey).isReady) {
        console.log(`✅ [${cleanCategory} - ${fullGroupName}] Skupina je už pripravená (stabilná)`);
        return true;
    }
    
    // Čakáme na stabilitu
    console.log(`⏳ [${cleanCategory} - ${fullGroupName}] Čakám na stabilitu počtu zápasov...`);
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
        console.log('⏳ Nahrádzanie už prebieha, preskakujem...');
        return;
    }
    
    isReplacingInProgress = true;
    
    console.log(`🔍 Spúšťam čiastočné nahrádzanie (${identifiersToReplace.length} identifikátorov)...`);
    
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
                        console.log(`✅ NAHRADENÝ (${source}): "${idInfo.originalIdentifier}" → "${teamName}" v elemente: ${element.tagName}`);
                        
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
                console.log(`🎉 Kompletne nahradený identifikátor: "${idInfo.originalIdentifier}" (všetky výskyty)`);
            } else {
                failedCount++;
                failedIdentifiers.push(idInfo.originalIdentifier);
                console.log(`❌ NENAHRADENÝ: "${idInfo.originalIdentifier}" (žiadny element neobsahoval tento text)`);
            }
        } else if (!teamName) {
            failedCount++;
            failedIdentifiers.push(idInfo.originalIdentifier);
            console.log(`❌ NENAHRADENÝ: "${idInfo.originalIdentifier}" (tím nebol nájdený - skupina nie je na 100%)`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SÚHRN NAHRADENIA:');
    console.log(`   ✅ Úspešne nahradených: ${replacedCount} (z cache: ${fromCacheCount}, z DB: ${fromDbCount})`);
    console.log(`   ❌ Neúspešných: ${failedCount}`);
    if (failedIdentifiers.length > 0) {
        console.log(`   ❌ Neúspešné identifikátory: ${failedIdentifiers.join(', ')}`);
    }
    console.log('='.repeat(60) + '\n');
    
    isReplacingInProgress = false;
    
    return {
        replaced: replacedCount,
        fromCache: fromCacheCount,
        fromDb: fromDbCount,
        failed: failedCount,
        failedIdentifiers: failedIdentifiers
    };
}

// Pomocná funkcia na získanie udalostí pre zápas (pridáme do matchTracker)
if (window.matchTracker && !window.matchTracker.getEvents) {
    window.matchTracker.getEvents = (matchId) => {
        // Toto by malo byť dostupné z pôvodného matchTracker
        return window.matchTracker._getEvents?.(matchId) || [];
    };
}

// Úplné nahradenie
function performFullReplacement() {
    const allText = document.body.innerText;
    const identifiers = extractIdentifiersFromText(allText);
    
    if (identifiers.length > 0) {
        performPartialReplacement(identifiers);
    } else {
        console.log('ℹ️ Žiadne identifikátory na nahradenie');
    }
}

// Funkcia na sledovanie zmien na stránke
function observePageChanges() {
    console.log('👁️ Spúšťam sledovanie zmien na stránke...');
    
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

// Pridáme funkciu getTeamNameByDisplayId do matchTracker pre prístup z iných častí
if (window.matchTracker) {
    window.matchTracker.getTeamNameByDisplayId = getTeamNameByDisplayId;
    window.matchTracker.getTeamNameByParams = getTeamNameByParams;
    window.matchTracker.getTeamInfoByDisplayId = getTeamInfoByDisplayId;
    window.matchTracker.cleanCategoryName = cleanCategoryName;
}

// ** UPRAVENÁ FUNKCIA: Periodické nahrádzanie - vždy kontroluje všetky identifikátory **
let periodicReplaceInterval = null;
let periodicReplaceActive = true;

function startPeriodicReplacement(intervalSeconds = 1) {
    if (periodicReplaceInterval) {
        clearInterval(periodicReplaceInterval);
    }
    
    console.log(`🔄 Spúšťam periodické nahrádzanie každých ${intervalSeconds} sekúnd...`);
    
    periodicReplaceInterval = setInterval(() => {
        if (!periodicReplaceActive) return;
        
        // Tichšie logovanie (voliteľné)
        // console.log(`⏰ Periodické nahrádzanie (každých ${intervalSeconds}s)...`);
        
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
            console.log(`🔄 Periodické nahrádzanie: ${readyIdentifiers.length} identifikátorov`);
            performPartialReplacement(readyIdentifiers);
        }
    }, intervalSeconds * 1000);
}

// ** NOVÁ FUNKCIA: Okamžité nahrádzanie všetkých identifikátorov (bez čakania) **
function replaceAllIdentifiersNow() {
    console.log('🔄 Spúšťam okamžité nahrádzanie všetkých identifikátorov...');
    
    const allText = document.body.innerText;
    const identifiers = extractIdentifiersFromText(allText);
    
    if (identifiers.length === 0) {
        console.log('ℹ️ Žiadne identifikátory na nahrádzanie');
        return;
    }
    
    console.log(`📋 Nájdených ${identifiers.length} identifikátorov`);
    
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
        console.log(`✅ Nahrádzam ${readyIdentifiers.length} pripravených identifikátorov...`);
        performPartialReplacement(readyIdentifiers);
    } else {
        console.log(`ℹ️ Žiadne identifikátory nie sú pripravené na nahradenie`);
    }
    
    if (notReadyIdentifiers.length > 0) {
        console.log(`⏳ ${notReadyIdentifiers.length} identifikátorov nie je pripravených (skupiny nemajú 100%):`);
        notReadyIdentifiers.forEach(id => {
            console.log(`   - ${id.originalIdentifier} (skupina ${id.groupLetter})`);
        });
    }
}

// ** OPRAVENÁ FUNKCIA: replaceTeamIdentifiersWhenReady - s oneskorením pre istotu **
function replaceTeamIdentifiersWhenReady() {
    console.log('🔍 Kontrolujem pripravenosť skupín na nahrádzanie...');
    
    // Bezpečnostná kontrola - či existuje document.body
    if (!document || !document.body) {
        console.log('⚠️ document.body nie je dostupný, čakám...');
        return;
    }
    
    const allText = document.body.innerText;
    const identifiers = extractIdentifiersFromText(allText);
    
    if (!identifiers || !Array.isArray(identifiers)) {
        console.log('⚠️ extractIdentifiersFromText nevrátil platné pole, čakám...');
        return;
    }
    
    if (identifiers.length === 0) {
        console.log('ℹ️ Žiadne identifikátory tímov neboli nájdené na stránke');
        return;
    }
    
    const readyIdentifiers = [];
    const notReadyIdentifiers = [];
    
    for (const id of identifiers) {
        if (!id || !id.category || !id.groupLetter) {
            console.log('⚠️ Neplatný identifikátor, preskakujem:', id);
            continue;
        }
        
        const isReady = isGroupReadyForReplacement(id.category, id.groupLetter);
        if (isReady) {
            readyIdentifiers.push(id);
        } else {
            notReadyIdentifiers.push(id);
        }
    }
    
    console.log(`📋 Nájdených identifikátorov: ${identifiers.length}`);
    console.log(`   ✅ Pripravené na nahradenie: ${readyIdentifiers.map(i => i.identifier).join(', ') || 'žiadne'}`);
    console.log(`   ⏳ Čakajú na dokončenie: ${notReadyIdentifiers.map(i => i.identifier).join(', ') || 'žiadne'}`);
    
    if (readyIdentifiers.length > 0) {
        // PRIDANÉ ONESKORENIE - počkáme ešte 2 sekundy pre istotu, že všetky dáta sú stabilné
        console.log('✅ Vykonávam nahradenie pre pripravené skupiny...');
        performPartialReplacement(readyIdentifiers);
    } else {
        console.log('ℹ️ Žiadna skupina ešte nie je pripravená na nahradenie');
    }
    
    // Pokračujeme v kontrolách pre nepripravené skupiny...
    if (notReadyIdentifiers.length > 0) {
        console.log(`⏳ Nastavujem pravidelné kontroly pre ${notReadyIdentifiers.length} skupín...`);
        
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
                console.log(`✅ Ďalších ${nowReady.length} skupín je pripravených, vykonávam nahradenie...`);
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
        console.log('⏹️ Periodické nahrádzanie zastavené');
    }
}

// ** FUNKCIA NA OBSLUHU KLIKNUTÍ NA TLAČIDLÁ **
function attachClickHandlersForReplacement() {
    console.log('🖱️ Nastavujem poslúchače na tlačidlá pre opätovné nahrádzanie...');
    
    // Funkcia na spustenie nahrádzania po krátkom oneskorení
    const scheduleReplacement = () => {
        setTimeout(() => {
            console.log('🔄 Kliknutie na tlačidlo, spúšťam nahrádzanie...');
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

// Funkcia na spustenie sledovania - BEZ čakania na všetky skupiny
async function startTeamNameReplacement() {
    console.log('🚀 Spúšťam automatické nahrádzanie identifikátorov tímov...');
    console.log('📌 Nahrádzajú sa len skupiny, ktoré majú 100% odohraných zápasov a všetky zápasy sú spracované.');
    
    let checkInterval = setInterval(() => {
        if (window.matchTracker && typeof window.matchTracker.createGroupTable === 'function') {
            clearInterval(checkInterval);
            console.log('✅ MatchTracker je pripravený');
            
            const observer = observePageChanges();
            window._teamNameObserver = observer;
            
            // Jedno okamžité nahradenie hneď po spustení
            console.log('🔄 Spúšťam prvé kolo nahrádzania...');
            replaceTeamIdentifiersWhenReady();
            
            // 🔴 SPUSTENIE PERIODICKÉHO NAHRÁDZANIA (každých 30 sekúnd)
            startPeriodicReplacement(1);
        }
    }, 500);
    
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.matchTracker) {
            console.log('⚠️ MatchTracker nie je dostupný');
            replaceTeamIdentifiersWhenReady();
            startPeriodicReplacement(1);
        }
    }, 10000);
    attachClickHandlersForReplacement();
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
            console.log('⏹️ Sledovanie zmien na stránke zastavené');
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
        console.log(`📊 Interval periodického nahrádzania nastavený na ${intervalSeconds} sekúnd`);
    },
    isPeriodicActive: () => periodicReplaceInterval !== null && periodicReplaceActive
};

console.log('📋 Pridané funkcie pre nahrádzanie identifikátorov:');
console.log('   • window.teamNameReplacer.start() - spustí automatické nahrádzanie');
console.log('   • window.teamNameReplacer.replaceNow() - jednorazové nahradenie');
console.log('   • window.teamNameReplacer.checkGroupStatus("U12 D", "B") - kontrola stavu skupiny');
console.log('   • window.teamNameReplacer.getReadyGroups() - zoznam pripravených skupín');
console.log('   • window.teamNameReplacer.stop() - zastaví sledovanie');
console.log('   • window.matchTracker.getTeamNameByDisplayId("U12 D 1E") - priamy prístup k funkcii');

startTeamNameReplacement();

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
    console.log(`💾 Manuálne pridané do cache: "${displayId}" → "${teamName}"`);
    return true;
}

window.teamNameReplacer.addToCache = addToCache;



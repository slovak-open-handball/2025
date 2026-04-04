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
        if (!match || match.status !== 'completed') {
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
            dateStr: matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený'
        };
    }
    
    // Funkcia na získanie všetkých zápasov (všetky stavy)
    function getAllMatches() {
        return Object.values(matchesData);
    }
    
    // Funkcia na získanie odohraných zápasov
    function getCompletedMatches() {
        return Object.values(matchesData).filter(m => m.status === 'completed');
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
    
    // Funkcia na vytvorenie tabuľky skupiny (POUŽÍVA LEN ODOHRANÉ ZÁPASY pre štatistiky, ale zobrazuje aj naplánované)
    function createGroupTable(categoryName, groupName) {
        // Získame VŠETKY zápasy pre danú skupinu (pre zoznam)
        const allGroupMatches = Object.values(matchesData).filter(match => 
            match.categoryName === categoryName && match.groupName === groupName
        );
        
        if (allGroupMatches.length === 0) {
            console.log(`Žiadne zápasy pre skupinu ${groupName} v kategórii ${categoryName}`);
            return null;
        }
        
        // Získame len ODOHRANÉ zápasy pre štatistiky (tak ako v pôvodnom kóde)
        const completedGroupMatches = allGroupMatches.filter(match => match.status === 'completed');
        
        if (completedGroupMatches.length === 0) {
            console.log(`Žiadne odohrané zápasy pre skupinu ${groupName} v kategórii ${categoryName}`);
            // Vrátime len základné info bez štatistík
            return {
                category: categoryName,
                group: groupName,
                teams: [],
                matches: allGroupMatches,
                completedMatches: completedGroupMatches,
                totalMatches: allGroupMatches.length,
                completedCount: 0,
                teamsCount: 0,
                hasNoCompletedMatches: true
            };
        }
        
        // Získame všetky tímy v skupine z ODOHRANÝCH zápasov (ako v pôvodnom kóde)
        const teamsInGroup = [];
        
        completedGroupMatches.forEach(match => {
            const homeTeam = {
                id: match.homeTeamIdentifier,
                name: window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier,
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                points: 0
            };
            
            const awayTeam = {
                id: match.awayTeamIdentifier,
                name: window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier,
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                points: 0
            };
            
            if (!teamsInGroup.find(t => t.id === homeTeam.id)) {
                teamsInGroup.push(homeTeam);
            }
            if (!teamsInGroup.find(t => t.id === awayTeam.id)) {
                teamsInGroup.push(awayTeam);
            }
        });
        
        // Spracujeme výsledky ODOHRANÝCH zápasov (tak ako v pôvodnom kóde)
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
            return compareTeams(a, b, completedGroupMatches, tableSettings.sortingConditions);
        });
        
        return {
            category: categoryName,
            group: groupName,
            teams: sortedTeams,
            matches: allGroupMatches,
            completedMatches: completedGroupMatches,
            totalMatches: allGroupMatches.length,
            completedCount: completedGroupMatches.length,
            teamsCount: teamsInGroup.length,
            hasNoCompletedMatches: false
        };
    }
    
    // Funkcia na získanie stavu skupiny (koľko zápasov odohraných)
    function getGroupProgress(categoryName, groupName) {
        const table = createGroupTable(categoryName, groupName);
        if (!table) return null;
        
        const progressPercent = table.totalMatches > 0 ? (table.completedCount / table.totalMatches * 100).toFixed(1) : 0;
        
        return {
            category: categoryName,
            group: groupName,
            totalMatches: table.totalMatches,
            completedMatches: table.completedCount,
            remainingMatches: table.totalMatches - table.completedCount,
            progressPercent: progressPercent,
            teamsCount: table.teamsCount
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
        
        // Informácia o priebehu skupiny
        const progressPercent = table.totalMatches > 0 ? (table.completedCount / table.totalMatches * 100).toFixed(1) : 0;
        console.log(`📊 Stav skupiny: ${table.completedCount} / ${table.totalMatches} zápasov odohraných (${progressPercent}%)`);
        console.log(`👥 Počet tímov: ${table.teamsCount}`);
        
        if (table.hasNoCompletedMatches) {
            console.log('⚠️ Zatiaľ neboli odohrané žiadne zápasy v tejto skupine');
            console.log('='.repeat(120) + '\n');
            return;
        }
        
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
        
        console.log('='.repeat(120));
        
        // Výpis zoznamu zápasov a ich stavov
        if (table.matches.length > 0) {
            console.log('\n📋 Zoznam zápasov v skupine:');
            console.log('-'.repeat(80));
            
            table.matches.forEach((match, idx) => {
                const homeTeam = window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier;
                const awayTeam = window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier;
                const status = getStatusText(match.status);
                let scoreDisplay = '';
                
                if (match.status === 'completed') {
                    const events = eventsData[match.id] || [];
                    const { home, away } = getCurrentScore(events);
                    scoreDisplay = ` [${home}:${away}]`;
                } else if (match.status === 'in-progress') {
                    const events = eventsData[match.id] || [];
                    const { home, away } = getCurrentScore(events);
                    scoreDisplay = ` [${home}:${away} - prebieha]`;
                }
                
                console.log(`${(idx+1).toString().padStart(2)}. ${homeTeam} vs ${awayTeam} - ${status}${scoreDisplay}`);
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
            console.log('Nenašli sa žiadne skupiny so zápasmi');
            return;
        }
        
        console.log('\n' + '='.repeat(120));
        console.log(`📊 VŠETKY TABUĽKY SKUPÍN (${uniqueGroups.size} skupín)`);
        console.log(`📊 Celkový počet zápasov v databáze: ${allMatches.length} (odohraných: ${getCompletedMatches().length})`);
        console.log('='.repeat(120));
        
        const sortedGroups = Array.from(uniqueGroups).sort();
        
        sortedGroups.forEach(groupKey => {
            const [category, group] = groupKey.split('|');
            printGroupTable(category, group);
        });
    }
    
    // Funkcia na výpis prehľadu priebehu všetkých skupín
    function printGroupsProgress() {
        const allMatches = getAllMatches();
        
        if (allMatches.length === 0) {
            console.log('Žiadne zápasy v databáze');
            return;
        }
        
        const uniqueGroups = new Set();
        allMatches.forEach(match => {
            if (match.categoryName && match.groupName) {
                uniqueGroups.add(`${match.categoryName}|${match.groupName}`);
            }
        });
        
        console.log('\n' + '='.repeat(80));
        console.log(`📊 PREHĽAD PRIEBEHU SKUPÍN`);
        console.log('='.repeat(80));
        
        Array.from(uniqueGroups).sort().forEach(groupKey => {
            const [category, group] = groupKey.split('|');
            const progress = getGroupProgress(category, group);
            if (progress) {
                const progressBar = createProgressBar(progress.progressPercent);
                console.log(`${category} - ${group}: ${progress.completedMatches}/${progress.totalMatches} (${progress.progressPercent}%) ${progressBar}`);
            }
        });
        
        console.log('='.repeat(80) + '\n');
    }
    
    // Pomocná funkcia na vytvorenie progress baru
    function createProgressBar(percent, width = 20) {
        const percentNum = parseFloat(percent);
        const filled = Math.round(width * percentNum / 100);
        const empty = width - filled;
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
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
        printGroupsProgress: printGroupsProgress,
        getGroupProgress: getGroupProgress,
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
    console.log('   • window.matchTracker.printGroupsProgress() - výpis prehľadu priebehu skupín');
    console.log('   • window.matchTracker.getGroupProgress("kategória", "skupina") - získanie stavu skupiny');
    console.log('   • window.matchTracker.printCompleted() - výpis odohraných zápasov');
    console.log('   • window.matchTracker.createGroupTable("kategória", "skupina") - získanie tabuľky ako objekt');
    console.log('   • window.matchTracker.getSortingConditions() - získanie aktuálnych kritérií poradia');
    console.log('   • window.matchTracker.getAllMatches() - získanie všetkých zápasov');
    console.log('   • window.matchTracker.refresh() - obnovenie výpisu');
    console.log('   • window.matchTracker.stop() - zastavenie sledovania');
    
})();

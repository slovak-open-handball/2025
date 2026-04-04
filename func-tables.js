(function() {
    'use strict';
    
    console.log('=== SPÚŠŤAM SLEDOVANIE ZÁPASOV ===');
    
    let unsubscribeMatches = null;
    let unsubscribeEvents = {};
    let matchesData = {};
    let eventsData = {};
    
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
        
        // Zoradíme udalosti chronologicky
        const sortedEvents = [...events].sort((a, b) => {
            if (a.minute !== b.minute) return (a.minute || 0) - (b.minute || 0);
            return (a.second || 0) - (b.second || 0);
        });
        
        // Posledná udalosť má konečné skóre
        const lastEvent = sortedEvents[sortedEvents.length - 1];
        
        if (lastEvent.scoreAfter) {
            return {
                home: lastEvent.scoreAfter.home || 0,
                away: lastEvent.scoreAfter.away || 0
            };
        }
        
        // Fallback - prepočítame z udalostí
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
    
    // Funkcia na získanie konečného času zápasu
    function getMatchEndTime(events) {
        if (!events || events.length === 0) return 0;
        
        let maxTime = 0;
        events.forEach(event => {
            const eventTime = (event.minute || 0) * 60 + (event.second || 0);
            if (eventTime > maxTime) maxTime = eventTime;
        });
        return maxTime;
    }
    
    // Funkcia na výpis všetkých zápasov do konzoly
    function printAllMatches() {
        if (Object.keys(matchesData).length === 0) {
            console.log('Žiadne zápasy neboli načítané');
            return;
        }
        
        console.log('\n' + '='.repeat(80));
        console.log(`📊 PREHĽAD VŠETKÝCH ZÁPASOV (${Object.keys(matchesData).length} zápasov)`);
        console.log('='.repeat(80));
        
        // Zoradenie zápasov podľa dátumu a času
        const sortedMatches = Object.values(matchesData).sort((a, b) => {
            if (!a.scheduledTime && !b.scheduledTime) return 0;
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return a.scheduledTime.toDate() - b.scheduledTime.toDate();
        });
        
        sortedMatches.forEach((match, index) => {
            const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null;
            const dateStr = matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený';
            const timeStr = matchDate ? matchDate.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }) : '--:--';
            
            // Získanie aktuálneho skóre z udalostí pomocou scoreAfter
            const events = eventsData[match.id] || [];
            const { home: homeScore, away: awayScore } = getCurrentScore(events);
            
            // Výpočet aktuálneho času pre prebiehajúce zápasy
            let currentTime = null;
            let timeDisplay = '';
            
            if (match.status === 'in-progress' && match.startedAt) {
                const now = new Date();
                const startedAt = match.startedAt.toDate();
                const elapsedSeconds = Math.floor((now - startedAt) / 1000) + (match.manualTimeOffset || 0);
                currentTime = elapsedSeconds;
                timeDisplay = `⏱️ Čas: ${formatMatchTime(currentTime)}`;
            } else if (match.status === 'paused' && match.pausedAt && match.startedAt) {
                const pausedAt = match.pausedAt.toDate();
                const startedAt = match.startedAt.toDate();
                const elapsedSeconds = Math.floor((pausedAt - startedAt) / 1000) + (match.manualTimeOffset || 0);
                currentTime = elapsedSeconds;
                timeDisplay = `⏸️ Čas: ${formatMatchTime(currentTime)} (pozastavené)`;
            } else if (match.status === 'completed' && events.length > 0) {
                const endTime = getMatchEndTime(events);
                timeDisplay = `🏁 Konečný čas: ${formatMatchTime(endTime)}`;
            }
            
            // Získanie názvov tímov
            const homeTeamName = window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier;
            const awayTeamName = window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier;
            
            console.log(`\n${index + 1}. 🆔 ${match.id}`);
            console.log(`   📅 ${dateStr} ${timeStr}`);
            console.log(`   🏷️ Kategória: ${match.categoryName || 'neurčená'}`);
            console.log(`   👥 Skupina: ${match.groupName || 'neurčená'}`);
            console.log(`   ⚽ ${homeTeamName} (${match.homeTeamIdentifier}) vs ${awayTeamName} (${match.awayTeamIdentifier})`);
            console.log(`   📊 Stav: ${getStatusText(match.status)}`);
            console.log(`   🥅 Skóre: ${homeScore} : ${awayScore}`);
            if (timeDisplay) console.log(`   ${timeDisplay}`);
            if (match.currentPeriod) console.log(`   🔄 Perióda: ${match.currentPeriod}`);
            console.log(`   📈 Počet udalostí: ${events.length}`);
            
            // Výpis posledných 5 udalostí
            if (events.length > 0) {
                const lastEvents = [...events].sort((a, b) => {
                    if (a.minute !== b.minute) return (b.minute || 0) - (a.minute || 0);
                    return (b.second || 0) - (a.second || 0);
                }).slice(0, 5);
                
                console.log(`   📋 Posledné udalosti:`);
                lastEvents.forEach(event => {
                    const time = `${String(event.minute || 0).padStart(2, '0')}:${String(event.second || 0).padStart(2, '0')}`;
                    let eventText = '';
                    switch (event.type) {
                        case 'goal': eventText = `⚽ GÓL (${event.team === 'home' ? 'domáci' : 'hostia'})`; break;
                        case 'penalty': eventText = `🎯 7m ${event.subType === 'scored' ? 'PREMENENÁ' : 'NEPREMENENÁ'} (${event.team === 'home' ? 'domáci' : 'hostia'})`; break;
                        case 'yellow': eventText = `🟨 ŽK (${event.team === 'home' ? 'domáci' : 'hostia'})`; break;
                        case 'red': eventText = `🟥 ČK (${event.team === 'home' ? 'domáci' : 'hostia'})`; break;
                        case 'blue': eventText = `🔵 MK (${event.team === 'home' ? 'domáci' : 'hostia'})`; break;
                        case 'exclusion': eventText = `⏱️ Vylúčenie (${event.team === 'home' ? 'domáci' : 'hostia'})`; break;
                        default: eventText = event.type;
                    }
                    const scoreInfo = event.scoreAfter ? ` (${event.scoreAfter.home}:${event.scoreAfter.away})` : '';
                    console.log(`      • ${time} - ${eventText}${scoreInfo}`);
                });
            }
        });
        
        console.log('\n' + '='.repeat(80));
        
        // Štatistika podľa stavov
        const stats = {
            scheduled: 0,
            'in-progress': 0,
            paused: 0,
            completed: 0
        };
        
        Object.values(matchesData).forEach(match => {
            if (stats[match.status] !== undefined) stats[match.status]++;
            else stats.unknown = (stats.unknown || 0) + 1;
        });
        
        console.log('\n📈 ŠTATISTIKA ZÁPASOV:');
        console.log(`   📅 Naplánované: ${stats.scheduled}`);
        console.log(`   ▶️ Prebieha: ${stats['in-progress']}`);
        console.log(`   ⏸️ Pozastavené: ${stats.paused}`);
        console.log(`   ✅ Odohrané: ${stats.completed}`);
        console.log('='.repeat(80) + '\n');
    }
    
    // Funkcia na výpis iba prebiehajúcich zápasov
    function printLiveMatches() {
        const liveMatches = Object.values(matchesData).filter(m => 
            m.status === 'in-progress' || m.status === 'paused'
        );
        
        if (liveMatches.length === 0) {
            console.log('Žiadne prebiehajúce zápasy');
            return;
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`🔥 ŽIVÉ ZÁPASY (${liveMatches.length})`);
        console.log('='.repeat(60));
        
        liveMatches.forEach(match => {
            const events = eventsData[match.id] || [];
            const { home: homeScore, away: awayScore } = getCurrentScore(events);
            
            let currentTime = 0;
            if (match.startedAt) {
                const now = new Date();
                const startedAt = match.startedAt.toDate();
                let elapsed = Math.floor((now - startedAt) / 1000) + (match.manualTimeOffset || 0);
                if (match.status === 'paused' && match.pausedAt) {
                    const pausedAt = match.pausedAt.toDate();
                    elapsed = Math.floor((pausedAt - startedAt) / 1000) + (match.manualTimeOffset || 0);
                }
                currentTime = elapsed;
            }
            
            const homeTeamName = window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier;
            const awayTeamName = window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier;
            
            console.log(`\n⚽ ${homeTeamName} vs ${awayTeamName}`);
            console.log(`   🥅 ${homeScore} : ${awayScore} | ⏱️ ${formatMatchTime(currentTime)} | ${match.status === 'paused' ? '⏸️ POZASTAVENÉ' : '▶️ PREBIEHA'}`);
        });
        console.log('='.repeat(60) + '\n');
    }
    
    // Funkcia na výpis podrobností jedného zápasu
    function printMatchDetails(matchId) {
        const match = matchesData[matchId];
        if (!match) {
            console.log(`Zápas s ID "${matchId}" nebol nájdený`);
            return;
        }
        
        const events = eventsData[matchId] || [];
        const { home: homeScore, away: awayScore } = getCurrentScore(events);
        
        // Zoradenie udalostí chronologicky
        const sortedEvents = [...events].sort((a, b) => {
            if (a.minute !== b.minute) return (a.minute || 0) - (b.minute || 0);
            return (a.second || 0) - (b.second || 0);
        });
        
        const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null;
        const homeTeamName = window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier;
        const awayTeamName = window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier;
        
        console.log('\n' + '='.repeat(70));
        console.log(`📋 DETAIL ZÁPASU: ${homeTeamName} vs ${awayTeamName}`);
        console.log('='.repeat(70));
        console.log(`🆔 ID: ${match.id}`);
        console.log(`📅 Dátum: ${matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený'} ${matchDate ? matchDate.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }) : ''}`);
        console.log(`🏷️ Kategória: ${match.categoryName || 'neurčená'}`);
        console.log(`👥 Skupina: ${match.groupName || 'neurčená'}`);
        console.log(`📊 Stav: ${getStatusText(match.status)}`);
        console.log(`🥅 Skóre: ${homeScore} : ${awayScore}`);
        console.log(`📈 Počet udalostí: ${events.length}`);
        
        if (events.length > 0) {
            console.log(`\n📋 VŠETKY UDALOSTI (chronologicky):`);
            sortedEvents.forEach((event, idx) => {
                const time = `${String(event.minute || 0).padStart(2, '0')}:${String(event.second || 0).padStart(2, '0')}`;
                let eventText = '';
                switch (event.type) {
                    case 'goal': eventText = `⚽ GÓL - ${event.team === 'home' ? 'DOMÁCI' : 'HOSTIA'}`; break;
                    case 'penalty': eventText = `🎯 7m ${event.subType === 'scored' ? 'PREMENENÁ' : 'NEPREMENENÁ'} - ${event.team === 'home' ? 'DOMÁCI' : 'HOSTIA'}`; break;
                    case 'yellow': eventText = `🟨 ŽLTÁ KARTA - ${event.team === 'home' ? 'DOMÁCI' : 'HOSTIA'}`; break;
                    case 'red': eventText = `🟥 ČERVENÁ KARTA - ${event.team === 'home' ? 'DOMÁCI' : 'HOSTIA'}`; break;
                    case 'blue': eventText = `🔵 MODRÁ KARTA - ${event.team === 'home' ? 'DOMÁCI' : 'HOSTIA'}`; break;
                    case 'exclusion': eventText = `⏱️ VYLÚČENIE - ${event.team === 'home' ? 'DOMÁCI' : 'HOSTIA'}`; break;
                    default: eventText = `❓ ${event.type}`;
                }
                const scoreInfo = event.scoreAfter ? ` (${event.scoreAfter.home}:${event.scoreAfter.away})` : '';
                console.log(`   ${String(idx + 1).padStart(2)}. ${time} - ${eventText}${scoreInfo}`);
            });
        }
        console.log('='.repeat(70) + '\n');
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
        
        console.log('✅ Firebase inicializovaný, spúšťam sledovanie zápasov...');
        
        const { collection, query, where, onSnapshot, getDocs } = window.firebaseModules || 
            await importFirebaseModules();
        
        if (!collection) {
            console.error('❌ Firebase moduly neboli načítané!');
            return;
        }
        
        // Sledovanie všetkých zápasov
        const matchesRef = collection(window.db, 'matches');
        
        unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
            console.log(`🔄 Načítaných ${snapshot.size} zápasov`);
            
            snapshot.docChanges().forEach(change => {
                const match = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'added') {
                    console.log(`➕ Pridaný zápas: ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}`);
                    matchesData[match.id] = match;
                    subscribeToMatchEvents(match.id);
                    
                } else if (change.type === 'modified') {
                    const oldMatch = matchesData[match.id];
                    matchesData[match.id] = match;
                    
                    if (oldMatch && oldMatch.status !== match.status) {
                        console.log(`🔄 Zmena stavu zápasu ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}: ${getStatusText(oldMatch.status)} → ${getStatusText(match.status)}`);
                    } else {
                        console.log(`✏️ Upravený zápas: ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}`);
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
            
            printAllMatches();
            
        }, (error) => {
            console.error('❌ Chyba pri sledovaní zápasov:', error);
        });
        
        // Načítame existujúce zápasy a ich udalosti
        const matchesSnapshot = await getDocs(matchesRef);
        for (const doc of matchesSnapshot.docs) {
            const matchId = doc.id;
            subscribeToMatchEvents(matchId);
        }
    }

    // Funkcia na výpis iba odohraných zápasov (completed)
    function printCompletedMatches() {
        const completedMatches = Object.values(matchesData).filter(m => m.status === 'completed');
        
        if (completedMatches.length === 0) {
            console.log('Žiadne odohrané zápasy');
            return;
        }
        
        console.log('\n' + '='.repeat(80));
        console.log(`✅ ODOHRANÉ ZÁPASY (${completedMatches.length})`);
        console.log('='.repeat(80));
        
        // Zoradenie podľa dátumu (najnovšie na začiatok)
        const sortedMatches = [...completedMatches].sort((a, b) => {
            if (!a.scheduledTime && !b.scheduledTime) return 0;
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return b.scheduledTime.toDate() - a.scheduledTime.toDate();
        });
        
        sortedMatches.forEach((match, index) => {
            const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null;
            const dateStr = matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený';
            const timeStr = matchDate ? matchDate.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }) : '--:--';
            
            // Získanie konečného skóre z udalostí
            const events = eventsData[match.id] || [];
            const { home: homeScore, away: awayScore } = getCurrentScore(events);
            
            // Získanie konečného času
            const endTime = getMatchEndTime(events);
            
            // Získanie názvov tímov
            const homeTeamName = window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier;
            const awayTeamName = window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier;
            
            console.log(`\n${index + 1}. 🏁 ${homeTeamName} vs ${awayTeamName}`);
            console.log(`   📅 ${dateStr} ${timeStr}`);
            console.log(`   🏷️ Kategória: ${match.categoryName || 'neurčená'}`);
            console.log(`   👥 Skupina: ${match.groupName || 'neurčená'}`);
            console.log(`   🥅 Konečné skóre: ${homeScore} : ${awayScore}`);
            console.log(`   ⏱️ Trvanie zápasu: ${formatMatchTime(endTime)}`);
            console.log(`   📈 Počet udalostí: ${events.length}`);
            
            // Výpis gólových strelcov (ak existujú)
            if (events.length > 0) {
                const goals = events.filter(e => e.type === 'goal' || (e.type === 'penalty' && e.subType === 'scored'));
                if (goals.length > 0) {
                    console.log(`   ⚽ Góly:`);
                    goals.forEach(goal => {
                        const time = `${String(goal.minute || 0).padStart(2, '0')}:${String(goal.second || 0).padStart(2, '0')}`;
                        const team = goal.team === 'home' ? 'DOMÁCI' : 'HOSTIA';
                        console.log(`      • ${time} - ${team} (${goal.type === 'penalty' ? '7m' : 'akcia'})`);
                    });
                }
            }
        });
        
        console.log('\n' + '='.repeat(80));
        
        // Štatistika odohraných zápasov podľa kategórií
        const categoryStats = {};
        completedMatches.forEach(match => {
            const category = match.categoryName || 'Bez kategórie';
            if (!categoryStats[category]) {
                categoryStats[category] = { count: 0, totalGoals: 0 };
            }
            categoryStats[category].count++;
            
            const events = eventsData[match.id] || [];
            const { home: homeScore, away: awayScore } = getCurrentScore(events);
            categoryStats[category].totalGoals += homeScore + awayScore;
        });
        
        console.log('\n📊 ŠTATISTIKA ODOHRANÝCH ZÁPASOV PODĽA KATEGÓRIÍ:');
        Object.entries(categoryStats).forEach(([category, stats]) => {
            const avgGoals = (stats.totalGoals / stats.count).toFixed(1);
            console.log(`   • ${category}: ${stats.count} zápasov, priemer ${avgGoals} gólov na zápas`);
        });
        console.log('='.repeat(80) + '\n');
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
            
            // Zoradíme udalosti podľa času pre správne scoreAfter
            events.sort((a, b) => {
                if (a.minute !== b.minute) return (a.minute || 0) - (b.minute || 0);
                return (a.second || 0) - (b.second || 0);
            });
            
            eventsData[matchId] = events;
            
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
    
    // Funkcia na manuálne obnovenie výpisu
    function refresh() {
        printAllMatches();
    }
    
    // Funkcia na zastavenie sledovania
    function stop() {
        if (unsubscribeMatches) {
            unsubscribeMatches();
            unsubscribeMatches = null;
        }
        
        Object.values(unsubscribeEvents).forEach(unsubscribe => {
            if (unsubscribe) unsubscribe();
        });
        unsubscribeEvents = {};
        
        matchesData = {};
        eventsData = {};
        
        console.log('⏹️ Sledovanie zápasov zastavené');
    }
    
    // Export funkcií do window
    window.matchTracker = {
        start: initializeMatchTracker,
        stop: stop,
        refresh: refresh,
        printAll: printAllMatches,
        printLive: printLiveMatches,
        printCompleted: printCompletedMatches,
        printMatch: printMatchDetails,
        getMatches: () => matchesData,
        getEvents: (matchId) => eventsData[matchId] || []
    };
    
    // Spustenie sledovania
    initializeMatchTracker();
    
    console.log('📡 MatchTracker inicializovaný. Dostupné funkcie:');
    console.log('   • window.matchTracker.printAll() - výpis všetkých zápasov');
    console.log('   • window.matchTracker.printLive() - výpis živých zápasov');
    console.log('   • window.matchTracker.printMatch("ID") - detail zápasu');
    console.log('   • window.matchTracker.refresh() - obnovenie výpisu');
    console.log('   • window.matchTracker.stop() - zastavenie sledovania');
    
})();

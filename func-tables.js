(function() {
    'use strict';
    
    console.log('=== SPÚŠŤAM SLEDOVANIE ZÁPASOV (MÓD: LEN UKONČENÉ) ===');
    
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
    
    // Funkcia na získanie podrobného detailu zápasu
    function getMatchDetails(matchId) {
        const match = matchesData[matchId];
        if (!match) {
            return null;
        }
        
        const events = eventsData[matchId] || [];
        const { home: homeScore, away: awayScore } = getCurrentScore(events);
        const endTime = getMatchEndTime(events);
        const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null;
        
        // Získanie názvov tímov a ich ID
        const homeTeamName = window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier;
        const awayTeamName = window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier;
        
        // Zoradenie udalostí chronologicky
        const sortedEvents = [...events].sort((a, b) => {
            if (a.minute !== b.minute) return (a.minute || 0) - (b.minute || 0);
            return (a.second || 0) - (b.second || 0);
        });
        
        // Získanie gólov
        const goals = events.filter(e => e.type === 'goal' || (e.type === 'penalty' && e.subType === 'scored'));
        
        return {
            id: match.id,
            homeTeamId: match.homeTeamIdentifier,
            homeTeamName: homeTeamName,
            awayTeamId: match.awayTeamIdentifier,
            awayTeamName: awayTeamName,
            homeScore: homeScore,
            awayScore: awayScore,
            status: match.status,
            category: match.categoryName || 'neurčená',
            group: match.groupName || 'neurčená',
            date: matchDate,
            dateStr: matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený',
            timeStr: matchDate ? matchDate.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }) : '--:--',
            endTime: endTime,
            eventsCount: events.length,
            events: sortedEvents,
            goals: goals
        };
    }
    
    // Funkcia na výpis iba odohraných zápasov (completed)
    function printCompletedMatches() {
        const completedMatches = Object.values(matchesData).filter(m => m.status === 'completed');
        
        if (completedMatches.length === 0) {
            console.log('Žiadne odohrané zápasy');
            return;
        }
        
        console.log('\n' + '='.repeat(90));
        console.log(`✅ ODOHRANÉ ZÁPASY (${completedMatches.length}) - ${new Date().toLocaleTimeString()}`);
        console.log('='.repeat(90));
        
        // Zoradenie podľa dátumu (najnovšie na začiatok)
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
            console.log(`   📅 ${details.dateStr} ${details.timeStr}`);
            console.log(`   🏷️ Kategória: ${details.category}`);
            console.log(`   👥 Skupina: ${details.group}`);
            console.log(`   🥅 Konečné skóre: ${details.homeScore} : ${details.awayScore}`);
            console.log(`   ⏱️ Trvanie zápasu: ${formatMatchTime(details.endTime)}`);
            console.log(`   📈 Počet udalostí: ${details.eventsCount}`);
            console.log(`   🆔 Domáci ID: ${details.homeTeamId}`);
            console.log(`   🆔 Hostia ID: ${details.awayTeamId}`);
            
            // Výpis gólov (ak existujú)
            if (details.goals.length > 0) {
                console.log(`   ⚽ Góly:`);
                details.goals.forEach(goal => {
                    const time = `${String(goal.minute || 0).padStart(2, '0')}:${String(goal.second || 0).padStart(2, '0')}`;
                    const team = goal.team === 'home' ? 'DOMÁCI' : 'HOSTIA';
                    const type = goal.type === 'penalty' ? '7m' : 'akcia';
                    console.log(`      • ${time} - ${team} (${type})`);
                });
            }
        });
        
        console.log('\n' + '='.repeat(90));
        
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
        console.log('='.repeat(90) + '\n');
    }
    
    // Funkcia na výpis detailu konkrétneho odohraného zápasu
    function printMatchDetails(matchId) {
        const details = getMatchDetails(matchId);
        
        if (!details) {
            console.log(`Zápas s ID "${matchId}" nebol nájdený alebo nie je odohraný`);
            return;
        }
        
        console.log('\n' + '='.repeat(80));
        console.log(`📋 DETAIL ZÁPASU: ${details.homeTeamName} vs ${details.awayTeamName}`);
        console.log('='.repeat(80));
        console.log(`🆔 ID zápasu: ${details.id}`);
        console.log(`📅 Dátum: ${details.dateStr} ${details.timeStr}`);
        console.log(`🏷️ Kategória: ${details.category}`);
        console.log(`👥 Skupina: ${details.group}`);
        console.log(`📊 Stav: ${getStatusText(details.status)}`);
        console.log(`🥅 Konečné skóre: ${details.homeScore} : ${details.awayScore}`);
        console.log(`⏱️ Trvanie zápasu: ${formatMatchTime(details.endTime)}`);
        console.log(`📈 Počet udalostí: ${details.eventsCount}`);
        
        console.log(`\n🆔 Domáci tím:`);
        console.log(`   • Názov: ${details.homeTeamName}`);
        console.log(`   • Identifikátor: ${details.homeTeamId}`);
        
        console.log(`\n🆔 Hosťovský tím:`);
        console.log(`   • Názov: ${details.awayTeamName}`);
        console.log(`   • Identifikátor: ${details.awayTeamId}`);
        
        if (details.events.length > 0) {
            console.log(`\n📋 VŠETKY UDALOSTI (chronologicky):`);
            details.events.forEach((event, idx) => {
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
        console.log('='.repeat(80) + '\n');
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
        
        console.log('✅ Firebase inicializovaný, spúšťam sledovanie ukončených zápasov...');
        
        const { collection, query, where, onSnapshot, getDocs } = window.firebaseModules || 
            await importFirebaseModules();
        
        if (!collection) {
            console.error('❌ Firebase moduly neboli načítané!');
            return;
        }
        
        // Sledovanie všetkých zápasov
        const matchesRef = collection(window.db, 'matches');
        
        unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
            console.log(`🔄 Zmena v databáze: ${snapshot.size} zápasov celkom`);
            
            let hasChanges = false;
            
            snapshot.docChanges().forEach(change => {
                const match = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'added') {
                    console.log(`➕ Pridaný zápas: ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier} (${match.status})`);
                    matchesData[match.id] = match;
                    subscribeToMatchEvents(match.id);
                    hasChanges = true;
                    
                } else if (change.type === 'modified') {
                    const oldMatch = matchesData[match.id];
                    const oldStatus = oldMatch?.status;
                    matchesData[match.id] = match;
                    
                    if (oldStatus !== match.status) {
                        console.log(`🔄 Zmena stavu zápasu ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}: ${getStatusText(oldStatus)} → ${getStatusText(match.status)}`);
                        hasChanges = true;
                    } else {
                        console.log(`✏️ Upravený zápas: ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}`);
                        hasChanges = true;
                    }
                    
                } else if (change.type === 'removed') {
                    console.log(`❌ Odstránený zápas: ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}`);
                    delete matchesData[match.id];
                    
                    if (unsubscribeEvents[match.id]) {
                        unsubscribeEvents[match.id]();
                        delete unsubscribeEvents[match.id];
                    }
                    delete eventsData[match.id];
                    hasChanges = true;
                }
            });
            
            // Ak nastala akákoľvek zmena, vypíšeme ukončené zápasy
            if (hasChanges) {
                printCompletedMatches();
            }
            
        }, (error) => {
            console.error('❌ Chyba pri sledovaní zápasov:', error);
        });
        
        // Načítame existujúce zápasy a ich udalosti
        const matchesSnapshot = await getDocs(matchesRef);
        for (const doc of matchesSnapshot.docs) {
            const matchId = doc.id;
            subscribeToMatchEvents(matchId);
        }
        
        // Prvé načítanie - vypíšeme ukončené zápasy
        setTimeout(() => {
            printCompletedMatches();
        }, 1000);
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
            
            const oldEventsCount = eventsData[matchId]?.length || 0;
            eventsData[matchId] = events;
            
            // Ak pribudli nové udalosti a zápas je ukončený, aktualizujeme výpis
            const match = matchesData[matchId];
            if (match && match.status === 'completed' && events.length !== oldEventsCount) {
                console.log(`🔄 Aktualizácia udalostí pre ukončený zápas ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}`);
                printCompletedMatches();
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
    
    // Funkcia na manuálne obnovenie výpisu
    function refresh() {
        printCompletedMatches();
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
        printCompleted: printCompletedMatches,
        printMatch: printMatchDetails,
        getMatchDetails: getMatchDetails,
        getMatches: () => matchesData,
        getEvents: (matchId) => eventsData[matchId] || []
    };
    
    // Spustenie sledovania
    initializeMatchTracker();
    
    console.log('📡 MatchTracker inicializovaný v móde "Len ukončené zápasy". Dostupné funkcie:');
    console.log('   • window.matchTracker.printCompleted() - výpis ukončených zápasov');
    console.log('   • window.matchTracker.printMatch("ID") - detail konkrétneho zápasu (aj s ID tímov)');
    console.log('   • window.matchTracker.getMatchDetails("ID") - získanie detailu ako objekt');
    console.log('   • window.matchTracker.refresh() - obnovenie výpisu');
    console.log('   • window.matchTracker.stop() - zastavenie sledovania');
    
})();

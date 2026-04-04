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
    
    // Funkcia na výpis iba odohraných zápasov (completed)
    function printCompletedMatches() {
        const completedMatches = Object.values(matchesData).filter(m => m.status === 'completed');
        
        if (completedMatches.length === 0) {
            console.log('Žiadne odohrané zápasy');
            return;
        }
        
        // Vymažeme konzolu pre lepšiu prehľadnosť (voliteľné)
        // console.clear();
        
        console.log('\n' + '='.repeat(80));
        console.log(`✅ ODOHRANÉ ZÁPASY (${completedMatches.length}) - ${new Date().toLocaleTimeString()}`);
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
        getMatches: () => matchesData,
        getEvents: (matchId) => eventsData[matchId] || []
    };
    
    // Spustenie sledovania
    initializeMatchTracker();
    
    console.log('📡 MatchTracker inicializovaný v móde "Len ukončené zápasy". Dostupné funkcie:');
    console.log('   • window.matchTracker.printCompleted() - výpis ukončených zápasov');
    console.log('   • window.matchTracker.refresh() - obnovenie výpisu');
    console.log('   • window.matchTracker.stop() - zastavenie sledovania');
    
})();

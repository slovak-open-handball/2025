// simple-matches-loader.js
// Jednoduchý skript na načítanie zápasov pre konkrétnu halu

// Funkcia na načítanie zápasov podľa ID haly
async function loadMatchesForHall(hallId) {
    // Kontrola, či je databáza dostupná
    if (!window.db) {
        console.error('Databáza nie je inicializovaná');
        return [];
    }

    if (!hallId) {
        console.error('Nie je zadané ID haly');
        return [];
    }

    console.log(`Načítavam zápasy pre halu s ID: ${hallId}`);

    try {
        // Referencia na kolekciu matches
        const matchesRef = collection(window.db, 'matches');
        
        // Získame všetky dokumenty
        const querySnapshot = await getDocs(matchesRef);
        
        // Filtrujeme zápasy podľa ID haly
        const hallMatches = [];
        
        querySnapshot.forEach((doc) => {
            const match = {
                id: doc.id,
                ...doc.data()
            };
            
            // Pridáme len zápasy, ktoré patria do danej haly
            if (match.hallId === hallId) {
                hallMatches.push(match);
            }
        });
        
        // Zoradenie zápasov podľa času (ak existuje)
        hallMatches.sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            try {
                const timeA = a.scheduledTime.toDate().getTime();
                const timeB = b.scheduledTime.toDate().getTime();
                return timeA - timeB;
            } catch (e) {
                return 0;
            }
        });
        
        console.log(`Našlo sa ${hallMatches.length} zápasov pre halu ${hallId}`);
        
        // Výpis do konzoly pre kontrolu
        hallMatches.forEach((match, index) => {
            let timeStr = 'neurčený čas';
            if (match.scheduledTime) {
                try {
                    const date = match.scheduledTime.toDate();
                    timeStr = `${date.getDate()}.${date.getMonth()+1}. ${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')}`;
                } catch(e) {}
            }
            console.log(`${index+1}. ${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier} (${timeStr})`);
        });
        
        return hallMatches;
        
    } catch (error) {
        console.error('Chyba pri načítaní zápasov:', error);
        return [];
    }
}

// Príklad použitia - nahraďte 'ID_VASEJ_HALY' skutočným ID
// const hallId = 'ID_VASEJ_HALY';
// loadMatchesForHall(hallId).then(matches => {
//     console.log('Načítané zápasy:', matches);
// });

// Ak chcete, aby sa skript spustil automaticky po načítaní stránky,
// odkomentujte nasledujúce riadky a nahraďte ID_VASEJ_HALY
/*
window.addEventListener('DOMContentLoaded', () => {
    // Počkáme chvíľu, kým sa inicializuje databáza
    setTimeout(() => {
        const hallId = 'ID_VASEJ_HALY'; // SEM VLOŽTE SKUTOČNÉ ID HALY
        loadMatchesForHall(hallId);
    }, 1000);
});
*/

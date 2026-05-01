// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, deleteDoc, collection, Timestamp, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Pridanie štýlov pre zvýraznenie riadkov
const style = document.createElement('style');
style.textContent = `
    /* Zrušíme pôvodné štýly */
    .row-highlighted > div {
        position: static;
    }
    
    .row-highlighted > div::before {
        display: none;
    }
    
    /* Nové orámovanie pre celý riadok */
    .row-highlighted {
        position: relative;
        outline: none !important;
    }
    
    .row-highlighted::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border: 2px solid #3B82F6;
        border-radius: 8px;
        pointer-events: none;
        z-index: 10;
        margin: -2px;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }
    
    /* Zabezpečíme, že riadok má relatívnu pozíciu pre orámovanie */
    .grid {
        position: relative;
    }
    
    /* Upravíme pozíciu pre kontajner riadkov */
    .grid > .contents {
        display: contents;
        position: relative;
    }
`;
document.head.appendChild(style);

// Nahraďte existujúci floatingBoxStyle týmto:
const floatingBoxStyle = document.createElement('style');
floatingBoxStyle.textContent = `
    .floating-score-box {
        position: fixed;
        top: 55px;
        left: 50%;
        transform: translateX(-50%) translateY(-150px);
        background: white;
        border-radius: 50px;
        padding: 8px 24px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 20px;
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
        border: 1px solid #e5e7eb;
        pointer-events: none;
        backdrop-filter: blur(4px);
        background-color: rgba(255, 255, 255, 0.95);
    }
    
    .floating-score-box.visible {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
    }
    
    .floating-score-box .team-name {
        font-weight: 600;
        font-size: 14px;
        color: #374151;
        max-width: 180px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .floating-score-box .score {
        font-weight: 700;
        font-size: 24px;
        color: #1f2937;
        min-width: 30px;
        text-align: center;
    }
    
    .floating-score-box .vs {
        font-weight: 600;
        font-size: 14px;
        color: #9ca3af;
    }
    
    .floating-score-box .match-time {
        font-family: monospace;
        font-weight: 700;
        font-size: 18px;
        color: #3b82f6;
        background: #eff6ff;
        padding: 4px 12px;
        border-radius: 30px;
        margin-left: 10px;
    }
    
    .floating-score-box .separator {
        width: 1px;
        height: 30px;
        background: #e5e7eb;
        margin: 0 10px;
    }
    
    @media (max-width: 768px) {
        .floating-score-box {
            padding: 6px 16px;
            gap: 10px;
        }
        .floating-score-box .team-name {
            max-width: 100px;
            font-size: 12px;
        }
        .floating-score-box .score {
            font-size: 18px;
            min-width: 45px;
        }
        .floating-score-box .match-time {
            font-size: 14px;
            padding: 2px 8px;
        }
        .floating-score-box .separator {
            height: 25px;
            margin: 0 5px;
        }
    }
`;
document.head.appendChild(floatingBoxStyle);

const exclusionTimerStyle = document.createElement('style');
exclusionTimerStyle.textContent = `
    .exclusion-timer {
        font-size: 10px;
        font-family: monospace;
        background: #fed7aa;
        color: #9b2c1d;
        padding: 2px 6px;
        border-radius: 12px;
        font-weight: bold;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
    }
    
    .excluded-player {
        background-color: #fff7ed;
        border-left: 3px solid #ea580c;
    }
    
    .excluded-player .excluded-label {
        color: #ea580c;
        font-weight: bold;
        font-size: 11px;
    }
`;
document.head.appendChild(exclusionTimerStyle);

const { useState, useEffect } = React;

// Funkcia na formátovanie dátumu s dňom v týždni
const getDayName = (date) => {
    const days = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
    return days[date.getDay()];
};

const formatDateWithDay = (date) => {
    const dayName = getDayName(date);
    const formattedDate = date.toLocaleDateString('sk-SK', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    return `${dayName} ${formattedDate}`;
};

const formatTime = (timestamp) => {
    if (!timestamp) return '-- : --';
    try {
        const date = timestamp.toDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) {
        return '-- : --';
    }
};

const getLocalDateStr = (date) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getUrlParameter = (name) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
};

// Funkcia na aktualizáciu URL bez reloadu
const updateUrlParameters = (homeIdentifier, awayIdentifier) => {
    const url = new URL(window.location.href);
    if (homeIdentifier && awayIdentifier) {
        url.searchParams.set('domaci', homeIdentifier);
        url.searchParams.set('hostia', awayIdentifier);
        // Odstránime starý parameter match ak existuje
        url.searchParams.delete('match');
    } else {
        url.searchParams.delete('domaci');
        url.searchParams.delete('hostia');
    }
    window.history.replaceState({}, '', url);
};

// ============================================================================
// POMOCNÉ FUNKCIE PRE KONTROLU MODRÝCH KARIET A VYLÚČENÍ
// ============================================================================

const findAllBlueCardsForBothTeams = async () => {
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    
    // Definícia funkcie na získanie počtu zápasov trestu
    const getSuspensionMatches = () => {
        let suspensionMatches = 1;
        try {
            const storedTableSettings = localStorage.getItem('tableSettings');
            if (storedTableSettings) {
                const settings = JSON.parse(storedTableSettings);
                if (settings.blueCardSuspensionMatches !== undefined) {
                    suspensionMatches = settings.blueCardSuspensionMatches;
                }
            }
        } catch (e) {
            console.warn('Chyba pri načítaní nastavení z localStorage:', e);
        }
        return suspensionMatches;
    };
    
    // Získame identifikátory tímov z URL
    const urlParams = new URLSearchParams(window.location.search);
    const homeId = urlParams.get('domaci');
    const awayId = urlParams.get('hostia');
    
    console.log(`🏠 Domáci identifikátor: ${homeId}`);
    console.log(`✈️ Hosťovský identifikátor: ${awayId}`);
    
    const teamIdentifiers = [homeId, awayId];
    const teamNames = { [homeId]: 'DOMÁCI', [awayId]: 'HOSŤOVSKÍ' };
    
    // Získame aktuálny match ID
    const matchesRef = collection(window.db, 'matches');
    const currentMatchQuery = query(matchesRef, where("homeTeamIdentifier", "==", homeId), where("awayTeamIdentifier", "==", awayId));
    const currentMatchSnap = await getDocs(currentMatchQuery);
    let currentMatchId = null;
    currentMatchSnap.forEach(doc => { currentMatchId = doc.id; });
    
    console.log(`\n📌 Aktuálny zápas ID: ${currentMatchId}`);
    console.log(`\n🔍 Vyhľadávam modré karty pre oba tímy (okrem aktuálneho zápasu)...\n`);
    
    let totalBlueCards = 0;
    const blueCardsList = [];
    
    for (const teamIdentifier of teamIdentifiers) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📋 Prehľadávam tím: ${teamNames[teamIdentifier]} (${teamIdentifier})`);
        console.log(`${'='.repeat(80)}`);
        
        // Nájdenie všetkých zápasov tímu a zoradenie podľa dátumu a času
        const q1 = query(matchesRef, where("homeTeamIdentifier", "==", teamIdentifier));
        const q2 = query(matchesRef, where("awayTeamIdentifier", "==", teamIdentifier));
        
        const [homeSnap, awaySnap] = await Promise.all([getDocs(q1), getDocs(q2)]);
        
        const allMatches = [];
        homeSnap.forEach(doc => allMatches.push({ id: doc.id, ...doc.data() }));
        awaySnap.forEach(doc => allMatches.push({ id: doc.id, ...doc.data() }));
        
        // Zoradenie podľa dátumu a času (najstaršie prvé)
        allMatches.sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return a.scheduledTime.toDate() - b.scheduledTime.toDate();
        });
        
        console.log(`   Celkovo zápasov: ${allMatches.length}`);
        
        // Pomocná funkcia na formátovanie času
        const formatMatchDateTime = (scheduledTime) => {
            if (!scheduledTime) return 'neurčený dátum/čas';
            const date = scheduledTime.toDate();
            const dayName = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'][date.getDay()];
            const formattedDate = date.toLocaleDateString('sk-SK');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${dayName} ${formattedDate} ${hours}:${minutes}`;
        };
        
        // Vypíšeme všetky zápasy s poradím a časom
        console.log(`\n   📅 Zoznam všetkých zápasov tímu (zoradených podľa dátumu a času):`);
        console.log(`   ${'─'.repeat(75)}`);
        allMatches.forEach((match, idx) => {
            const isCurrent = match.id === currentMatchId;
            const dateTimeStr = formatMatchDateTime(match.scheduledTime);
            console.log(`   ${idx.toString().padStart(2, '0')}. ${isCurrent ? '🟢 AKTUÁLNY' : '    '} | ${dateTimeStr} | ${match.status || '?'}`);
            console.log(`        ID: ${match.id}`);
            console.log(`        Domáci: ${match.homeTeamIdentifier} vs Hostia: ${match.awayTeamIdentifier}`);
        });
        console.log(`   ${'─'.repeat(75)}`);
        
        let teamBlueCards = 0;
        
        for (const match of allMatches) {
            if (match.id === currentMatchId) {
                console.log(`\n   ⏭️ Preskakujem aktuálny zápas (poradie ${allMatches.findIndex(m => m.id === match.id)}): ${match.id}`);
                continue;
            }

             if (match.status !== 'completed') {
                console.log(`   ⏭️ Preskakujem zápas ${match.id} (stav: ${match.status}) - nie je ukončený`);
                continue;
            }
            
            const eventsRef = collection(window.db, 'matchEvents');
            const blueQuery = query(eventsRef, where("matchId", "==", match.id), where("type", "==", "blue"));
            const blueSnap = await getDocs(blueQuery);
            
            if (blueSnap.size > 0) {
                teamBlueCards++;
                totalBlueCards++;
                
                const matchOrder = allMatches.findIndex(m => m.id === match.id);
                const currentOrder = allMatches.findIndex(m => m.id === currentMatchId);
                const matchesPassed = currentOrder - matchOrder;
                const dateTimeStr = formatMatchDateTime(match.scheduledTime);
                
                console.log(`\n   🔵 Zápas č. ${matchOrder} (poradie v zozname):`);
                console.log(`      📅 Dátum a čas: ${dateTimeStr}`);
                console.log(`      🆔 ID: ${match.id}`);
                console.log(`      🏠 Domáci: ${match.homeTeamIdentifier}`);
                console.log(`      ✈️ Hostia: ${match.awayTeamIdentifier}`);
                console.log(`      📊 Stav: ${match.status}`);
                console.log(`      ➡️ Počet zápasov od tohto zápasu po aktuálny: ${matchesPassed}`);
                
                blueSnap.forEach(doc => {
                    const event = doc.data();
                    console.log(`\n      🃏 MODRÁ KARTA:`);
                    console.log(`         👤 userId: ${event.playerRef?.userId}`);
                    console.log(`         🏷️ teamIdentifier: ${event.playerRef?.teamIdentifier}`);
                    console.log(`         🔢 playerIndex: ${event.playerRef?.playerIndex}`);
                    console.log(`         🆔 playerId: ${event.playerRef?.playerId || 'CHÝBA'}`);
                    console.log(`         📛 playerName: ${event.playerRef?.playerName}`);
                    
                    // Uloženie do zoznamu pre neskoršie vyhodnotenie
                    blueCardsList.push({
                        matchOrder: matchOrder,
                        currentOrder: currentOrder,
                        matchesPassed: matchesPassed,
                        matchDateTime: dateTimeStr,
                        matchId: match.id,
                        playerName: event.playerRef?.playerName,
                        playerId: event.playerRef?.playerId,
                        playerIndex: event.playerRef?.playerIndex,
                        teamIdentifier: teamIdentifier,
                        teamSide: teamNames[teamIdentifier]
                    });
                });
            }
        }
        
        if (teamBlueCards === 0) {
            console.log(`\n   ✅ Žiadne modré karty pre tento tím v minulých zápasoch.`);
        } else {
            console.log(`\n   📊 Celkovo modrých kariet pre tento tím: ${teamBlueCards}`);
        }
    }
    
    const suspensionMatches = getSuspensionMatches();
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 CELKOVO MODRÝCH KARIET V MINULÝCH ZÁPASOCH: ${totalBlueCards}`);
    console.log(`${'='.repeat(80)}`);
    
    if (totalBlueCards === 0) {
        console.log(`\n❌ Žiadne modré karty v minulých zápasoch pre žiadny tím.`);
        console.log(`   Žiadny hráč NEBUDE suspendovaný.`);
    } else {
        console.log(`\n⚠️ EXISTUJÚ MODRÉ KARTY V MINULÝCH ZÁPASOCH:`);
        console.log(`\n📋 Vyhodnotenie suspendovania:`);
        console.log(`   Poznámka: Trest je na ${suspensionMatches} zápas(ov)\n`);
        
        for (const card of blueCardsList) {
            const isSuspended = card.matchesPassed > 0 && card.matchesPassed <= suspensionMatches;
            console.log(`   ${isSuspended ? '🔴 SUSPENDOVANÝ' : '🟢 NIE JE SUSPENDOVANÝ'} - Hráč: ${card.playerName || 'Neznámy'}`);
            console.log(`      🏷️ Tím: ${card.teamSide} (${card.teamIdentifier})`);
            console.log(`      📅 Dátum/čas MK: ${card.matchDateTime}`);
            console.log(`      🔢 Poradie zápasu s MK: ${card.matchOrder}`);
            console.log(`      🔢 Aktuálne poradie: ${card.currentOrder}`);
            console.log(`      📊 Zápasov od MK: ${card.matchesPassed}`);
            console.log(`      ⚖️ Trest: ${card.matchesPassed > 0 && card.matchesPassed <= suspensionMatches ? `ÁNO (${card.matchesPassed}/${suspensionMatches})` : 'NIE'}`);
            console.log('');
        }
    }
};

// ============================================================================
// OPRAVENÉ FUNKCIE - Pridané chýbajúce async
// ============================================================================

/**
 * Získa všetky zápasy pre daný tím na základe NÁZVU TÍMU a KATEGÓRIE.
 * Táto verzia prehľadáva VŠETKY zápasy v kategórii a porovnáva MAPOVANÉ názvy.
 * @param {string} teamDisplayName - Zobrazovací názov tímu (napr. "MHC Štart Nové Zámky")
 * @param {string} categoryName - Názov kategórie (napr. "U12 CH")
 * @returns {Promise<Array>} - Zoznam zápasov tímu v danej kategórii
 */
const getTeamMatchesByNameAndCategory = async (teamDisplayName, categoryName) => {
    if (!window.db || !teamDisplayName) return [];
    
    console.log('\n' + '='.repeat(80));
    console.log(`🔍 VYHĽADÁVAM ZÁPASY PRE TÍM: "${teamDisplayName}"`);
    console.log(`📂 Kategória: "${categoryName}"`);
    console.log('='.repeat(80));
    
    try {
        const matchesRef = collection(window.db, 'matches');
        // 🔥 DÔLEŽITÉ: Načítame VŠETKY zápasy (bez filtrovania podľa identifikátora)
        const allMatchesSnap = await getDocs(matchesRef);
        const teamMatches = [];
        
        console.log(`📊 Celkový počet zápasov v databáze: ${allMatchesSnap.size}`);
        console.log('-'.repeat(80));
        
        for (const doc of allMatchesSnap.docs) {
            const match = { id: doc.id, ...doc.data() };
            
            // 🔥 1. Najprv skontrolujeme, či zápas patrí do rovnakej kategórie
            if (match.categoryName !== categoryName) {
                continue;
            }
            
            // 🔥 2. Získame MAPOVANÉ názvy pre oba tímy v zápase
            let homeMappedName = match.homeTeamIdentifier;
            let awayMappedName = match.awayTeamIdentifier;
            
            if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                const homeResult = window.matchTracker.getTeamNameByDisplayId(match.homeTeamIdentifier);
                homeMappedName = (homeResult && typeof homeResult.then === 'function') ? await homeResult : homeResult;
                if (!homeMappedName) homeMappedName = match.homeTeamIdentifier;
                
                const awayResult = window.matchTracker.getTeamNameByDisplayId(match.awayTeamIdentifier);
                awayMappedName = (awayResult && typeof awayResult.then === 'function') ? await awayResult : awayResult;
                if (!awayMappedName) awayMappedName = match.awayTeamIdentifier;
            }
            
            // 🔥 3. KRITICKÉ: Porovnávame MAPOVANÉ NÁZVY s hľadaným názvom tímu
            const isHomeTeam = (homeMappedName === teamDisplayName);
            const isAwayTeam = (awayMappedName === teamDisplayName);
            
            if (isHomeTeam || isAwayTeam) {
                // 🔥 4. Uložíme zápas do zoznamu histórie
                teamMatches.push({
                    ...match,
                    teamSide: isHomeTeam ? 'home' : 'away',
                    homeMappedName: homeMappedName,
                    awayMappedName: awayMappedName,
                    homeOriginalName: match.homeTeamIdentifier,
                    awayOriginalName: match.awayTeamIdentifier
                });
                
                // Výpis pre debug (voliteľné)
                const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null;
                const formattedDate = matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený';
                console.log(`   ✅ Nájdený zápas: ${formattedDate} - ${homeMappedName} vs ${awayMappedName} (${match.id})`);
            }
        }
        
        // 🔥 5. Zoradenie podľa dátumu (najstaršie prvé)
        teamMatches.sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return a.scheduledTime.toDate() - b.scheduledTime.toDate();
        });
        
        console.log('\n' + '='.repeat(80));
        console.log(`📊 SÚHRN PRE TÍM "${teamDisplayName}" v kategórii "${categoryName}":`);
        console.log('='.repeat(80));
        console.log(`   ✅ Nájdených zápasov: ${teamMatches.length}`);
        
        // Výpis zoznamu všetkých zápasov s poradím
        console.log('\n📋 ZOZNAM ZÁPASOV (zoradených podľa dátumu):');
        console.log('─'.repeat(60));
        teamMatches.forEach((match, idx) => {
            const date = match.scheduledTime ? match.scheduledTime.toDate().toLocaleDateString('sk-SK') : 'neznámy';
            const isCurrent = match.id === window.currentMatchId;
            const statusIcon = match.status === 'completed' ? '✅' : match.status === 'in-progress' ? '▶️' : match.status === 'paused' ? '⏸️' : '📅';
            const displayName = match.teamSide === 'home' ? match.homeMappedName : match.awayMappedName;
            console.log(`   ${idx.toString().padStart(2, '0')}. ${isCurrent ? '🟢 AKTUÁLNY' : '    '} | ${statusIcon} | ${date} | ${displayName} (ID: ${match.id})`);
        });
        console.log('='.repeat(80) + '\n');
        
        return teamMatches;
    } catch (error) {
        console.error('❌ Chyba pri načítaní zápasov tímu:', error);
        return [];
    }
};

const logAllEventsForMatch = async (matchId) => {
    if (!window.db || !matchId) {
        console.log('❌ Databáza nie je inicializovaná alebo chýba ID zápasu');
        return;
    }
    
    try {
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where("matchId", "==", matchId));
        const eventsSnap = await getDocs(q);
        
        console.log(`\n📋 UDALOSTI PRE ZÁPAS ${matchId}:`);
        console.log(`   Celkový počet udalostí: ${eventsSnap.size}`);
        console.log(`   ${'─'.repeat(60)}`);
        
        eventsSnap.forEach((doc) => {
            const event = doc.data();
            console.log(`   🕐 ${event.minute}:${event.second?.toString().padStart(2, '0') || '00'} | ${event.type}${event.subType ? ` (${event.subType})` : ''} | tím: ${event.team} | hráč: ${event.playerRef?.playerName || 'Neznámy'}`);
        });
        
        console.log(`   ${'─'.repeat(60)}\n`);
    } catch (error) {
        console.error('Chyba pri načítaní udalostí:', error);
    }
};

/**
 * Získa modré karty pre hráča s použitím kategórie na filtráciu.
 * @param {Array} matches - Zoznam zápasov tímu
 * @param {Object} playerIdentifier - Identifikátor hráča
 * @param {string} currentMatchId - ID aktuálneho zápasu
 * @returns {Promise<Array>} - Zoznam modrých kariet
 */
const getBlueCardEventsForPlayerByNameAndCategory = async (matches, playerIdentifier, currentMatchId, getTeamDetailsFromIdentifier) => {
    if (!window.db || !matches.length || !playerIdentifier) return [];
    
    const blueCardEvents = [];
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 VYHĽADÁVAM MODRÉ KARTY PRE HRÁČA: ${playerIdentifier.playerName || playerIdentifier.playerId || 'Neznámy'}`);
    console.log(`   🏷️ Tím: ${playerIdentifier.teamName || 'Neznámy'}`);
    console.log(`   📂 Kategória: ${playerIdentifier.categoryName || 'Neznáma'}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📊 Celkový počet zápasov na kontrolu: ${matches.length}`);
    console.log(`📌 Aktuálny zápas ID: ${currentMatchId}`);
    console.log(`${'─'.repeat(80)}`);
    
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        
        // ====================================================================
        // 🔥 ZÁKLADNÉ INFORMÁCIE O ZÁPASE - VYPRACOVANÉ VŽDY
        // ====================================================================
        const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null;
        const formattedDate = matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený';
        const formattedTime = matchDate ? matchDate.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const dayName = matchDate ? ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'][matchDate.getDay()] : '?';
        const statusIcon = match.status === 'completed' ? '✅' : match.status === 'in-progress' ? '▶️' : match.status === 'paused' ? '⏸️' : '📅';
        
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`📋 [${i}/${matches.length}] KONTROLA ZÁPASU č. ${i}`);
        console.log(`${'═'.repeat(60)}`);
        console.log(`   🆔 ID: ${match.id}`);
        console.log(`   📅 Dátum: ${dayName} ${formattedDate} ${formattedTime}`);
        console.log(`   📊 Status: ${statusIcon} (${match.status})`);
        console.log(`   🏷️ Kategória: ${match.categoryName || 'neurčená'}`);
        console.log(`   👥 Skupina: ${match.groupName || 'neurčená'}`);
        console.log(`   🥅 Naša strana: ${match.teamSide === 'home' ? '🏠 DOMÁCI' : '✈️ HOSTIA'}`);
        console.log(`   🏠 Domáci (pôvodný): ${match.homeTeamIdentifier}`);
        if (match.homeMappedName) console.log(`         (mapovaný): ${match.homeMappedName}`);
        console.log(`   ✈️ Hostia (pôvodný): ${match.awayTeamIdentifier}`);
        if (match.awayMappedName) console.log(`         (mapovaný): ${match.awayMappedName}`);
        
        // ====================================================================
        // 🔥 VÝPIS VÝSLEDKU ZÁPASU (ak je k dispozícii)
        // ====================================================================
        if (match.status === 'completed') {
            console.log(`\n   🎯 VÝSLEDOK ZÁPASU:`);
            
            // Kontumácia
            if (match.forfeitResult && match.forfeitResult.isForfeit) {
                console.log(`      ⚠️ KONTUMÁCIA: ${match.forfeitResult.home}:${match.forfeitResult.away}`);
                console.log(`      🏆 Víťaz: ${match.forfeitResult.winner === 'home' ? 'DOMÁCI' : 'HOSTIA'}`);
            }
            // Manuálny výsledok
            else if (match.finalScore && !match.forfeitResult) {
                console.log(`      ✏️ MANUÁLNY VÝSLEDOK: ${match.finalScore.home}:${match.finalScore.away}`);
            }
            // Inak sa pokúsime vypočítať z udalostí
            else {
                try {
                    const eventsRef = collection(window.db, 'matchEvents');
                    const q = query(eventsRef, where("matchId", "==", match.id));
                    const eventsSnap = await getDocs(q);
                    
                    let homeScore = 0;
                    let awayScore = 0;
                    eventsSnap.forEach(eventDoc => {
                        const event = eventDoc.data();
                        if (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) {
                            if (event.team === 'home') homeScore++;
                            else if (event.team === 'away') awayScore++;
                        }
                    });
                    console.log(`      🥅 SKÓRE (z udalostí): ${homeScore}:${awayScore}`);
                } catch (error) {
                    console.log(`      ❌ Nepodarilo sa načítať skóre: ${error.message}`);
                }
            }
        }
        
        // ====================================================================
        // 🔥 PRESKAKOVANIE ZÁPASOV (aktuálny a neukončené)
        // ====================================================================
        if (match.id === currentMatchId) {
            console.log(`\n   ⏭️ PRESKAKUJEM (aktuálny zápas)`);
            console.log(`${'─'.repeat(40)}`);
            continue;
        }
        
        if (match.status !== 'completed') {
            console.log(`\n   ⏭️ PRESKAKUJEM (stav: ${match.status} - nie je ukončený)`);
            console.log(`${'─'.repeat(40)}`);
            continue;
        }
        
        // ====================================================================
        // 🔥 VYHĽADÁVANIE MODRÝCH KARIET V ZÁPASE
        // ====================================================================
        try {
            const eventsRef = collection(window.db, 'matchEvents');
            const q = query(eventsRef, where("matchId", "==", match.id));
            const eventsSnap = await getDocs(q);
            
            console.log(`\n   🃏 VYHĽADÁVAM MODRÉ KARTY v tomto zápase...`);
            console.log(`      📊 Počet udalostí v zápase: ${eventsSnap.size}`);
            
            let foundBlueCards = 0;
            
            for (const doc of eventsSnap.docs) {
                const event = doc.data();
                if (event.type === 'blue' && event.playerRef) {
                    let isSamePlayer = false;
                    
                    // 🔥 1. ZÍSKAME MENO HRÁČA Z TÍMU
                    let actualPlayerName = null;
                    if (event.playerRef.userId && event.playerRef.teamIdentifier && event.playerRef.playerIndex !== undefined) {
                        const teamDetails = getTeamDetailsFromIdentifier(event.playerRef.teamIdentifier);
                        if (teamDetails && teamDetails.team.playerDetails && teamDetails.team.playerDetails[event.playerRef.playerIndex]) {
                            const player = teamDetails.team.playerDetails[event.playerRef.playerIndex];
                            if (player && player.firstName && player.lastName) {
                                actualPlayerName = `${player.lastName} ${player.firstName}`;
                            }
                        }
                    }
                    
                    // 2. Porovnanie podľa unikátneho ID hráča
                    if (playerIdentifier.playerId && event.playerRef.playerId) {
                        isSamePlayer = event.playerRef.playerId === playerIdentifier.playerId;
                        if (isSamePlayer) console.log(`         ✅ Nájdená MK podľa ID hráča`);
                    }
                    
                    // 3. Porovnanie podľa userId + teamIdentifier + playerIndex
                    if (!isSamePlayer && !playerIdentifier.playerId) {
                        isSamePlayer = event.playerRef.userId === playerIdentifier.userId &&
                                       event.playerRef.teamIdentifier === playerIdentifier.teamIdentifier &&
                                       event.playerRef.playerIndex === playerIdentifier.playerIndex;
                        if (isSamePlayer) console.log(`         ✅ Nájdená MK podľa userId+teamIdentifier+index`);
                    }
                    
                    // 4. Porovnanie podľa mena získaného z tímu
                    if (!isSamePlayer && actualPlayerName && playerIdentifier.playerName) {
                        isSamePlayer = actualPlayerName === playerIdentifier.playerName;
                        if (isSamePlayer) console.log(`         ✅ Nájdená MK podľa mena (z tímu)`);
                    }
                    
                    // 5. Porovnanie podľa mena z eventu (fallback)
                    if (!isSamePlayer && playerIdentifier.playerName && event.playerRef.playerName) {
                        isSamePlayer = event.playerRef.playerName === playerIdentifier.playerName;
                        if (isSamePlayer) console.log(`         ✅ Nájdená MK podľa mena z eventu`);
                    }
                    
                    if (isSamePlayer) {
                        foundBlueCards++;
                        const matchIndex = matches.findIndex(m => m.id === match.id);
                        blueCardEvents.push({
                            matchId: match.id,
                            matchDate: match.scheduledTime,
                            eventTimestamp: event.timestamp,
                            matchStatus: match.status,
                            matchOrder: matchIndex,
                            categoryName: match.categoryName,
                            eventMinute: event.minute,
                            eventSecond: event.second
                        });
                        console.log(`         🃏 MODRÁ KARTA č. ${foundBlueCards} ZAZNAMENANÁ!`);
                        console.log(`            ⏱️ Čas: ${event.minute}:${event.second?.toString().padStart(2, '0') || '00'}`);
                        console.log(`            👤 Hráč: ${event.playerRef.playerName || actualPlayerName || 'Neznámy'}`);
                        if (event.playerRef.playerId) console.log(`            🆔 playerId: ${event.playerRef.playerId}`);
                    }
                }
            }
            
            if (foundBlueCards === 0) {
                console.log(`\n   ✅ ŽIADNE MODRÉ KARTY pre tohto hráča v tomto zápase.`);
            } else {
                console.log(`\n   📊 Celkom modrých kariet v tomto zápase pre tohto hráča: ${foundBlueCards}`);
            }
            
        } catch (error) {
            console.error(`      ❌ Chyba pri načítaní udalostí zápasu ${match.id}:`, error);
        }
        
        console.log(`${'─'.repeat(40)}`);
    }
    
    // ====================================================================
    // 🔥 SÚHRNNÝ VÝPIS
    // ====================================================================
    blueCardEvents.sort((a, b) => b.matchOrder - a.matchOrder);
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 SÚHRN MODRÝCH KARIET PRE HRÁČA ${playerIdentifier.playerName || playerIdentifier.playerId || 'Neznámy'}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`   Celkový počet nájdených MK: ${blueCardEvents.length}`);
    
    if (blueCardEvents.length > 0) {
        console.log(`   Zoznam MK (zoradených od najnovšej po najstaršiu):`);
        blueCardEvents.forEach((card, idx) => {
            const date = card.matchDate ? card.matchDate.toDate().toLocaleDateString('sk-SK') : 'neznámy dátum';
            console.log(`   ${idx + 1}. Zápas č. ${card.matchOrder} - ${date} (ID: ${card.matchId}) - Čas: ${card.eventMinute}:${(card.eventSecond || 0).toString().padStart(2, '0')}`);
        });
    } else {
        console.log(`   ✅ Hráč nemá žiadne modré karty v histórii (v danej kategórii).`);
    }
    console.log(`${'='.repeat(80)}\n`);
    
    return blueCardEvents;
};

// Funkcia na získanie počtu zápasov vylúčenia za modrú kartu z Nastavení tabuľky
const getBlueCardSuspensionMatches = () => {
    let suspensionMatches = 1;
    try {
        const storedTableSettings = localStorage.getItem('tableSettings');
        if (storedTableSettings) {
            const settings = JSON.parse(storedTableSettings);
            if (settings.blueCardSuspensionMatches !== undefined) {
                suspensionMatches = settings.blueCardSuspensionMatches;
            }
        }
    } catch (e) {
        console.warn('Chyba pri načítaní nastavení z localStorage:', e);
    }
    return suspensionMatches;
};

const getCleanTeamNameForBlueCardSearch = (identifier) => {
    if (!identifier) return null;
    
    // Prvá konverzia: identifikátor -> zobrazovací názov
    let firstPass = null;
    if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
        firstPass = window.matchTracker.getTeamNameByDisplayId(identifier);
        console.log(`   🔄 Prvá konverzia: "${identifier}" -> "${firstPass}"`);
    }
    
    if (!firstPass || firstPass === identifier) {
        console.log(`   ⚠️ Prvá konverzia zlyhala, používam pôvodný identifikátor: "${identifier}"`);
        return identifier;
    }
    
    // Druhá konverzia: zobrazovací názov -> čistý názov
    let cleanName = null;
    if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
        cleanName = window.matchTracker.getTeamNameByDisplayId(firstPass);
        console.log(`   🔄 Druhá konverzia: "${firstPass}" -> "${cleanName}"`);
    }
    
    if (!cleanName || cleanName === firstPass) {
        console.log(`   ⚠️ Druhá konverzia zlyhala, používam prvý výsledok: "${firstPass}"`);
        return firstPass;
    }
    
    return cleanName;
};

const getTeamMatchesByCleanName = async (cleanTeamName) => {
    if (!window.db || !cleanTeamName) return [];
    
    try {
        const matchesRef = collection(window.db, 'matches');
        const allMatchesSnap = await getDocs(matchesRef);
        const teamMatches = [];
        
        for (const doc of allMatchesSnap.docs) {
            const match = { id: doc.id, ...doc.data() };
            
            // Skontrolujeme domáci tím
            let homeMatch = false;
            if (match.homeTeamIdentifier) {
                const homeCleanName = getCleanTeamNameForBlueCardSearch(match.homeTeamIdentifier);
                if (homeCleanName === cleanTeamName) {
                    homeMatch = true;
                }
            }
            
            // Skontrolujeme hosťovský tím
            let awayMatch = false;
            if (match.awayTeamIdentifier) {
                const awayCleanName = getCleanTeamNameForBlueCardSearch(match.awayTeamIdentifier);
                if (awayCleanName === cleanTeamName) {
                    awayMatch = true;
                }
            }
            
            if (homeMatch || awayMatch) {
                teamMatches.push({
                    ...match,
                    teamSide: homeMatch ? 'home' : 'away'
                });
            }
        }
        
        // Zoradenie podľa dátumu (najstaršie prvé)
        teamMatches.sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return a.scheduledTime.toDate() - b.scheduledTime.toDate();
        });
        
        return teamMatches;
    } catch (error) {
        console.error('Chyba pri načítaní zápasov tímu:', error);
        return [];
    }
};

// ============================================================================
// FUNKCIA NA ZÍSKANIE VŠETKÝCH ZÁPASOV TÍMU PODĽA NÁZVU (NIE IDENTIFIKÁTORA)
// ============================================================================

/**
 * Získa všetky zápasy pre daný tím na základe názvu tímu.
 * @param {string} teamName - Názov tímu
 * @returns {Promise<Array>} - Zoznam zápasov tímu
 */
const getTeamMatchesByName = async (teamName) => {
    if (!window.db || !teamName) return [];
    
    try {
        const matchesRef = collection(window.db, 'matches');
        const allMatchesSnap = await getDocs(matchesRef);
        const teamMatches = [];
        
        for (const doc of allMatchesSnap.docs) {
            const match = { id: doc.id, ...doc.data() };
            
            // 🔥 POUŽIJEME ROVNAKÚ FUNKCIU AKO PRE SÚPISKY
            const homeTeamName = await getTeamNameFromIdentifier(match.homeTeamIdentifier);
            const awayTeamName = await getTeamNameFromIdentifier(match.awayTeamIdentifier);
            
            if (homeTeamName === teamName || awayTeamName === teamName) {
                teamMatches.push({
                    ...match,
                    teamSide: homeTeamName === teamName ? 'home' : 'away'
                });
            }
        }
        
        // Zoradenie podľa dátumu (najstaršie prvé)
        teamMatches.sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return a.scheduledTime.toDate() - b.scheduledTime.toDate();
        });
        
        return teamMatches;
    } catch (error) {
        console.error('Chyba pri načítaní zápasov tímu:', error);
        return [];
    }
};

const getTeamMatchesByDisplayName = async (teamDisplayName, categoryName) => {
    if (!window.db || !teamDisplayName) return [];
    
    console.log('\n' + '='.repeat(80));
    console.log(`🔍 VYHĽADÁVAM ZÁPASY PRE TÍM: "${teamDisplayName}"`);
    console.log(`📂 Kategória: "${categoryName}"`);
    console.log('='.repeat(80));
    
    try {
        const matchesRef = collection(window.db, 'matches');
        const allMatchesSnap = await getDocs(matchesRef);
        const teamMatches = [];
        
        console.log(`📊 Celkový počet zápasov v databáze: ${allMatchesSnap.size}`);
        console.log('-'.repeat(80));
        
        for (const doc of allMatchesSnap.docs) {
            const match = { id: doc.id, ...doc.data() };
            
            // Kontrola kategórie
            if (match.categoryName !== categoryName) {
                continue;
            }
            
            // ============================================================
            // 🔥 ZÍSKAME ZOBRAZOVACIE NÁZVY TÍMOV V ZÁPASE
            // ============================================================
            
            // Pre domáci tím - najprv skúsime získať zobrazovací názov
            let homeDisplayName = match.homeTeamIdentifier;
            if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                const result = window.matchTracker.getTeamNameByDisplayId(match.homeTeamIdentifier);
                homeDisplayName = (result && typeof result.then === 'function') ? await result : result;
                if (!homeDisplayName) homeDisplayName = match.homeTeamIdentifier;
            }
            
            // Pre hosťovský tím
            let awayDisplayName = match.awayTeamIdentifier;
            if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                const result = window.matchTracker.getTeamNameByDisplayId(match.awayTeamIdentifier);
                awayDisplayName = (result && typeof result.then === 'function') ? await result : result;
                if (!awayDisplayName) awayDisplayName = match.awayTeamIdentifier;
            }
            
            // 🔥 DÔLEŽITÉ: Porovnávame ZOBRAZOVACIE NÁZVY
            const isHomeTeam = (homeDisplayName === teamDisplayName);
            const isAwayTeam = (awayDisplayName === teamDisplayName);
            
            if (isHomeTeam || isAwayTeam) {
                const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null;
                const formattedDate = matchDate ? matchDate.toLocaleDateString('sk-SK') : 'neurčený';
                const formattedTime = matchDate ? matchDate.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                const dayName = matchDate ? ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'][matchDate.getDay()] : '?';
                
                console.log('\n' + '─'.repeat(60));
                console.log(`🏟️ ZÁPAS č. ${teamMatches.length + 1}`);
                console.log('─'.repeat(60));
                console.log(`   🆔 ID: ${match.id}`);
                console.log(`   📅 Dátum: ${dayName} ${formattedDate} ${formattedTime}`);
                console.log(`   📊 Status: ${match.status === 'completed' ? '✅ ODOHRANÝ' : match.status === 'in-progress' ? '▶️ PREBIEHA' : match.status === 'paused' ? '⏸️ POZASTAVENÝ' : '📅 NAplánOVANÝ'}`);
                console.log(`   🏠 Domáci (zobrazovací): ${homeDisplayName}`);
                console.log(`      🔑 Identifikátor: ${match.homeTeamIdentifier}`);
                console.log(`   ✈️ Hostia (zobrazovací): ${awayDisplayName}`);
                console.log(`      🔑 Identifikátor: ${match.awayTeamIdentifier}`);
                console.log(`   🏷️ Kategória: ${match.categoryName || 'neurčená'}`);
                console.log(`   👥 Skupina: ${match.groupName || 'neurčená'}`);
                console.log(`   🥅 Naša strana: ${isHomeTeam ? '🏠 DOMÁCI' : '✈️ HOSTIA'}`);
                
                // Výpis výsledku ak je zápas odohraný
                if (match.status === 'completed') {
                    console.log(`\n   🎯 VÝSLEDOK ZÁPASU:`);
                    
                    if (match.forfeitResult && match.forfeitResult.isForfeit) {
                        console.log(`      ⚠️ KONTUMÁCIA: ${match.forfeitResult.home}:${match.forfeitResult.away}`);
                    } else if (match.finalScore && !match.forfeitResult) {
                        console.log(`      ✏️ MANUÁLNY VÝSLEDOK: ${match.finalScore.home}:${match.finalScore.away}`);
                    } else {
                        const eventsRef = collection(window.db, 'matchEvents');
                        const q = query(eventsRef, where("matchId", "==", match.id));
                        const eventsSnap = await getDocs(q);
                        
                        let homeScore = 0, awayScore = 0;
                        eventsSnap.forEach(eventDoc => {
                            const event = eventDoc.data();
                            if (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) {
                                if (event.team === 'home') homeScore++;
                                else if (event.team === 'away') awayScore++;
                            }
                        });
                        console.log(`      🥅 SKÓRE: ${homeScore}:${awayScore}`);
                    }
                }
                
                // Výpis modrých kariet
                const eventsRef = collection(window.db, 'matchEvents');
                const blueQuery = query(eventsRef, where("matchId", "==", match.id), where("type", "==", "blue"));
                const blueSnap = await getDocs(blueQuery);
                
                if (blueSnap.size > 0) {
                    console.log(`\n   🔵 MODRÉ KARTY V TOMTO ZÁPASE (${blueSnap.size}):`);
                    blueSnap.forEach((blueDoc, idx) => {
                        const blueEvent = blueDoc.data();
                        console.log(`      ${idx + 1}. Hráč: ${blueEvent.playerRef?.playerName || 'Neznámy'}`);
                        console.log(`         Čas: ${blueEvent.minute}:${blueEvent.second?.toString().padStart(2, '0') || '00'}`);
                        console.log(`         Tím: ${blueEvent.team === 'home' ? 'DOMÁCI' : 'HOSTIA'}`);
                        if (blueEvent.playerRef?.userId) {
                            console.log(`         userId: ${blueEvent.playerRef.userId}`);
                        }
                        if (blueEvent.playerRef?.playerIndex !== undefined) {
                            console.log(`         playerIndex: ${blueEvent.playerRef.playerIndex}`);
                        }
                    });
                } else {
                    console.log(`\n   ✅ Žiadne modré karty v tomto zápase.`);
                }
                
                console.log('─'.repeat(60));
                
                teamMatches.push({
                    ...match,
                    teamSide: isHomeTeam ? 'home' : 'away',
                    homeDisplayName: homeDisplayName,
                    awayDisplayName: awayDisplayName
                });
            }
        }
        
        // Zoradenie podľa dátumu
        teamMatches.sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return a.scheduledTime.toDate() - b.scheduledTime.toDate();
        });
        
        console.log('\n' + '='.repeat(80));
        console.log(`📊 SÚHRN PRE TÍM "${teamDisplayName}" v kategórii "${categoryName}":`);
        console.log('='.repeat(80));
        console.log(`   ✅ Nájdených zápasov: ${teamMatches.length}`);
        console.log(`   🏁 Ukončených: ${teamMatches.filter(m => m.status === 'completed').length}`);
        console.log(`   ▶️ Prebiehajúcich: ${teamMatches.filter(m => m.status === 'in-progress' || m.status === 'paused').length}`);
        console.log(`   📅 Naplánovaných: ${teamMatches.filter(m => m.status === 'scheduled').length}`);
        
        console.log('\n📋 ZOZNAM ZÁPASOV (zoradených podľa dátumu):');
        console.log('─'.repeat(60));
        teamMatches.forEach((match, idx) => {
            const date = match.scheduledTime ? match.scheduledTime.toDate().toLocaleDateString('sk-SK') : 'neznámy';
            const statusIcon = match.status === 'completed' ? '✅' : match.status === 'in-progress' ? '▶️' : match.status === 'paused' ? '⏸️' : '📅';
            const ourDisplayName = match.teamSide === 'home' ? match.homeDisplayName : match.awayDisplayName;
            console.log(`   ${idx.toString().padStart(2, '0')}. ${statusIcon} | ${date} | ${ourDisplayName}`);
            console.log(`       🆔 ID: ${match.id}`);
            console.log(`       🏠 ${match.homeDisplayName} vs ✈️ ${match.awayDisplayName}`);
        });
        console.log('='.repeat(80) + '\n');
        
        return teamMatches;
    } catch (error) {
        console.error('❌ Chyba pri načítaní zápasov tímu:', error);
        return [];
    }
};

const getBlueCardEventsForPlayerByDisplayName = async (matches, playerIdentifier, currentMatchId) => {
    if (!window.db || !matches.length || !playerIdentifier) return [];
    
    const blueCardEvents = [];
    
    console.log(`\n🔍 Vyhľadávam modré karty pre hráča ${playerIdentifier.playerName || playerIdentifier.playerId}...`);
    console.log(`   Tím: ${playerIdentifier.teamDisplayName}`);
    console.log(`   Kategória: ${playerIdentifier.categoryName}`);
    console.log(`   Celkovo zápasov na kontrolu: ${matches.length}`);
    console.log('─'.repeat(60));
    
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        
        if (match.id === currentMatchId) {
            console.log(`\n   ⏭️ [${i}] Zápas ${match.id} - PRESKAKUJEM (aktuálny zápas)`);
            continue;
        }
        
        if (match.status !== 'completed') {
            console.log(`\n   ⏭️ [${i}] Zápas ${match.id} - PRESKAKUJEM (stav: ${match.status} - nie je ukončený)`);
            continue;
        }
        
        // 🔥 ZOBRAZÍME DETAIL ZÁPASU PRED KONTROLOU
        const matchDate = match.scheduledTime ? match.scheduledTime.toDate().toLocaleDateString('sk-SK') : 'neznámy dátum';
        console.log(`\n   ┌─────────────────────────────────────────────────────────────`);
        console.log(`   │ [${i}] 📋 KONTROLA ZÁPASU:`);
        console.log(`   │    🆔 ID: ${match.id}`);
        console.log(`   │    📅 Dátum: ${matchDate}`);
        console.log(`   │    🏠 Domáci (zobrazovací): ${match.homeDisplayName || match.homeTeamIdentifier}`);
        console.log(`   │       🔑 Identifikátor: ${match.homeTeamIdentifier}`);
        console.log(`   │    ✈️ Hostia (zobrazovací): ${match.awayDisplayName || match.awayTeamIdentifier}`);
        console.log(`   │       🔑 Identifikátor: ${match.awayTeamIdentifier}`);
        console.log(`   │    🥅 Naša strana: ${match.teamSide === 'home' ? 'DOMÁCI' : 'HOSTIA'}`);
        console.log(`   └─────────────────────────────────────────────────────────────`);
        
        try {
            const eventsRef = collection(window.db, 'matchEvents');
            const q = query(eventsRef, where("matchId", "==", match.id));
            const eventsSnap = await getDocs(q);
            
            console.log(`      📊 Počet udalostí v zápase: ${eventsSnap.size}`);
            
            let foundBlueCards = 0;
            
            for (const doc of eventsSnap.docs) {
                const event = doc.data();
                if (event.type === 'blue' && event.playerRef) {
                    let isSamePlayer = false;
                    
                    // Porovnanie podľa playerId
                    if (playerIdentifier.playerId && event.playerRef.playerId) {
                        isSamePlayer = event.playerRef.playerId === playerIdentifier.playerId;
                        if (isSamePlayer) console.log(`         ✅ Nájdená MK podľa playerId`);
                    }
                    
                    // Porovnanie podľa userId + teamIdentifier + playerIndex
                    if (!isSamePlayer && !playerIdentifier.playerId) {
                        isSamePlayer = event.playerRef.userId === playerIdentifier.userId &&
                                       event.playerRef.teamIdentifier === playerIdentifier.teamIdentifier &&
                                       event.playerRef.playerIndex === playerIdentifier.playerIndex;
                        if (isSamePlayer) console.log(`         ✅ Nájdená MK podľa userId+teamIdentifier+index`);
                    }
                    
                    // Porovnanie podľa mena
                    if (!isSamePlayer && playerIdentifier.playerName) {
                        const playerFullName = `${playerIdentifier.lastName} ${playerIdentifier.firstName}`;
                        isSamePlayer = event.playerRef.playerName === playerFullName;
                        if (isSamePlayer) console.log(`         ✅ Nájdená MK podľa mena`);
                    }
                    
                    if (isSamePlayer) {
                        foundBlueCards++;
                        blueCardEvents.push({
                            matchId: match.id,
                            matchDate: match.scheduledTime,
                            matchOrder: i,
                            match: match
                        });
                        console.log(`         🃏 MODRÁ KARTA č. ${foundBlueCards} - ZAZNAMENANÁ!`);
                    }
                }
            }
            
            if (foundBlueCards === 0) {
                console.log(`      ✅ Žiadne modré karty pre tohto hráča v tomto zápase.`);
            } else {
                console.log(`      📊 Celkom modrých kariet v tomto zápase pre tohto hráča: ${foundBlueCards}`);
            }
            
        } catch (error) {
            console.error(`      ❌ Chyba pri načítaní udalostí zápasu ${match.id}:`, error);
        }
    }
    
    // Zoradenie podľa poradia (najnovšie prvé)
    blueCardEvents.sort((a, b) => b.matchOrder - a.matchOrder);
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 SÚHRN MODRÝCH KARIET PRE HRÁČA ${playerIdentifier.playerName || playerIdentifier.playerId}:`);
    console.log('='.repeat(60));
    console.log(`   Celkový počet nájdených MK: ${blueCardEvents.length}`);
    
    if (blueCardEvents.length > 0) {
        console.log(`   Zoznam MK (zoradených od najnovšej):`);
        blueCardEvents.forEach((card, idx) => {
            const date = card.matchDate ? card.matchDate.toDate().toLocaleDateString('sk-SK') : 'neznámy';
            console.log(`   ${idx + 1}. Zápas č. ${card.matchOrder} - ${date} (ID: ${card.matchId})`);
        });
    }
    console.log('='.repeat(60) + '\n');
    
    return blueCardEvents;
};

const getBlueCardEventsForPlayerByName = async (matches, playerIdentifier, currentMatchId) => {
    if (!window.db || !matches.length || !playerIdentifier) return [];
    
    const blueCardEvents = [];
    
    for (const match of matches) {
        if (match.id === currentMatchId) continue;
        
        try {
            const eventsRef = collection(window.db, 'matchEvents');
            const q = query(eventsRef, where("matchId", "==", match.id));
            const eventsSnap = await getDocs(q);
            
            eventsSnap.forEach((doc) => {
                const event = doc.data();
                if (event.type === 'blue' && event.playerRef) {
                    let isSamePlayer = false;
                    
                    // 1. NAJLEPŠIE: Porovnanie podľa unikátneho ID hráča (ak existuje)
                    if (playerIdentifier.playerId && event.playerRef.playerId) {
                        isSamePlayer = event.playerRef.playerId === playerIdentifier.playerId;
                    }
                    
                    // 2. Porovnanie podľa userId + názov tímu + playerIndex
                    //    TOTO JE KĽÚČOVÉ PRE NADSTAVBOVÉ ZÁPASY A PAVÚK
                    if (!isSamePlayer && !playerIdentifier.playerId) {
                        // Získame názov tímu z identifikátora v udalosti
                        const eventTeamName = getTeamNameFromIdentifier(event.playerRef.teamIdentifier);
                        
                        // Porovnáme: userId, názov tímu a playerIndex
                        isSamePlayer = event.playerRef.userId === playerIdentifier.userId &&
                                       eventTeamName === playerIdentifier.teamName &&
                                       event.playerRef.playerIndex === playerIdentifier.playerIndex;
                    }
                    
                    // 3. Fallback: Porovnanie podľa mena (najmenej spoľahlivé)
                    if (!isSamePlayer && playerIdentifier.playerName) {
                        const playerFullName = `${playerIdentifier.lastName} ${playerIdentifier.firstName}`;
                        isSamePlayer = event.playerRef.playerName === playerFullName;
                    }
                    
                    if (isSamePlayer) {
                        const matchIndex = matches.findIndex(m => m.id === match.id);
                        blueCardEvents.push({
                            matchId: match.id,
                            matchDate: match.scheduledTime,
                            eventTimestamp: event.timestamp,
                            matchStatus: match.status,
                            matchOrder: matchIndex  // Poradie zápasu v histórii tímu
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Chyba pri načítaní udalostí zápasu:', error);
        }
    }
    
    // Zoradenie podľa poradia (najnovšie prvé)
    blueCardEvents.sort((a, b) => b.matchOrder - a.matchOrder);
    
    return blueCardEvents;
};

const getBlueCardEventsForPlayerByMatches = async (matches, playerIdentifier, currentMatchId) => {
    if (!window.db || !matches.length || !playerIdentifier) return [];
    
    const blueCardEvents = [];
    
    for (const match of matches) {
        if (match.id === currentMatchId) continue;
        
        try {
            const eventsRef = collection(window.db, 'matchEvents');
            const q = query(eventsRef, where("matchId", "==", match.id));
            const eventsSnap = await getDocs(q);
            
            eventsSnap.forEach((doc) => {
                const event = doc.data();
                if (event.type === 'blue' && event.playerRef) {
                    let isSamePlayer = false;
                    
                    // Porovnanie podľa unikátneho ID hráča
                    if (playerIdentifier.playerId && event.playerRef.playerId) {
                        isSamePlayer = event.playerRef.playerId === playerIdentifier.playerId;
                    }
                    
                    // Porovnanie podľa userId + teamIdentifier + playerIndex
                    if (!isSamePlayer && !playerIdentifier.playerId) {
                        isSamePlayer = event.playerRef.userId === playerIdentifier.userId &&
                                       event.playerRef.teamIdentifier === playerIdentifier.teamIdentifier &&
                                       event.playerRef.playerIndex === playerIdentifier.playerIndex;
                    }
                    
                    // Porovnanie podľa mena
                    if (!isSamePlayer && playerIdentifier.playerName) {
                        const playerFullName = `${playerIdentifier.lastName} ${playerIdentifier.firstName}`;
                        isSamePlayer = event.playerRef.playerName === playerFullName;
                    }
                    
                    if (isSamePlayer) {
                        const matchIndex = matches.findIndex(m => m.id === match.id);
                        blueCardEvents.push({
                            matchId: match.id,
                            matchDate: match.scheduledTime,
                            eventTimestamp: event.timestamp,
                            matchStatus: match.status,
                            matchOrder: matchIndex
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Chyba pri načítaní udalostí zápasu:', error);
        }
    }
    
    // Zoradenie podľa dátumu (najnovšie prvé)
    blueCardEvents.sort((a, b) => {
        if (!a.matchDate) return 1;
        if (!b.matchDate) return -1;
        return b.matchDate.toDate() - a.matchDate.toDate();
    });
    
    return blueCardEvents;
};

// Funkcia na získanie všetkých zápasov pre daný tím (na zistenie histórie modrých kariet)
const getTeamMatches = async (teamIdentifier) => {
    if (!window.db || !teamIdentifier) return [];
    
    try {
        const matchesRef = collection(window.db, 'matches');
        const q = query(
            matchesRef,
            where("homeTeamIdentifier", "==", teamIdentifier)
        );
        const homeMatchesSnap = await getDocs(q);
        
        const q2 = query(
            matchesRef,
            where("awayTeamIdentifier", "==", teamIdentifier)
        );
        const awayMatchesSnap = await getDocs(q2);
        
        const allMatches = [];
        
        homeMatchesSnap.forEach((doc) => {
            allMatches.push({ id: doc.id, ...doc.data(), teamSide: 'home' });
        });
        
        awayMatchesSnap.forEach((doc) => {
            allMatches.push({ id: doc.id, ...doc.data(), teamSide: 'away' });
        });
        
        // Zoradenie podľa dátumu (najstaršie prvé)
        allMatches.sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return a.scheduledTime.toDate() - b.scheduledTime.toDate();
        });
        
        return allMatches;
    } catch (error) {
        console.error('Chyba pri načítaní zápasov tímu:', error);
        return [];
    }
};

const getBlueCardEventsForPlayer = async (matches, playerIdentifier, currentMatchId) => {
    if (!window.db || !matches.length || !playerIdentifier) return [];
    
    const blueCardEvents = [];
    
    for (const match of matches) {
        if (match.id === currentMatchId) continue;

        if (match.status !== 'completed') {
            console.log(`   ⏭️ Preskakujem zápas ${match.id} (stav: ${match.status}) - nie je ukončený`);
            continue;
        }
        
        try {
            const eventsRef = collection(window.db, 'matchEvents');
            const q = query(eventsRef, where("matchId", "==", match.id));
            const eventsSnap = await getDocs(q);
            
            eventsSnap.forEach((doc) => {
                const event = doc.data();
                if (event.type === 'blue' && event.playerRef) {
                    let isSamePlayer = false;
                    
                    // 🔥 1. NAJLEPŠIE: Porovnanie podľa unikátneho ID hráča
                    if (playerIdentifier.playerId && event.playerRef.playerId) {
                        isSamePlayer = event.playerRef.playerId === playerIdentifier.playerId;
                    }
                    
                    // 2. Porovnanie podľa userId + teamIdentifier + playerIndex (ak nemáme ID)
                    if (!isSamePlayer && !playerIdentifier.playerId) {
                        isSamePlayer = event.playerRef.userId === playerIdentifier.userId &&
                                       event.playerRef.teamIdentifier === playerIdentifier.teamIdentifier &&
                                       event.playerRef.playerIndex === playerIdentifier.playerIndex;
                    }
                    
                    // 3. Porovnanie podľa mena (najmenej spoľahlivé)
                    if (!isSamePlayer && playerIdentifier.playerName) {
                        const playerFullName = `${playerIdentifier.lastName} ${playerIdentifier.firstName}`;
                        isSamePlayer = event.playerRef.playerName === playerFullName;
                    }
                    
                    if (isSamePlayer) {
                        // Získame poradie zápasu (index v zoradenom zozname)
                        const matchIndex = matches.findIndex(m => m.id === match.id);
                        
                        blueCardEvents.push({
                            matchId: match.id,
                            matchDate: match.scheduledTime,
                            eventTimestamp: event.timestamp,
                            matchStatus: match.status,
                            matchOrder: matchIndex
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Chyba pri načítaní udalostí zápasu:', error);
        }
    }
    
    // Zoradenie podľa dátumu (najnovšie prvé)
    blueCardEvents.sort((a, b) => {
        if (!a.matchDate) return 1;
        if (!b.matchDate) return -1;
        return b.matchDate.toDate() - a.matchDate.toDate();
    });
    
    return blueCardEvents;
};

// Funkcia na zistenie, či je hráč v aktívnom treste za modrú kartu
const isPlayerSuspendedForBlueCard = (blueCardEvents, suspensionMatchesCount, currentMatchOrder) => {
    if (!blueCardEvents.length) return false;
    
    const latestBlueCard = blueCardEvents[0];
    const blueCardMatchOrder = latestBlueCard.matchOrder;
    
    console.log(`📊 Kontrola suspendovania: currentMatchOrder=${currentMatchOrder}, blueCardMatchOrder=${blueCardMatchOrder}, suspensionMatchesCount=${suspensionMatchesCount}`);
    
    if (currentMatchOrder !== undefined && blueCardMatchOrder !== undefined) {
        const matchesPassed = currentMatchOrder - blueCardMatchOrder;
        console.log(`   Zápasy od modrej karty: ${matchesPassed}`);
        
        if (matchesPassed > 0 && matchesPassed <= suspensionMatchesCount) {
            console.log(`   ✅ HRÁČ JE SUSPENDOVANÝ (musí odohrať ${suspensionMatchesCount} zápasov, aktuálne ${matchesPassed} odohraných)`);
            return true;
        } else {
            console.log(`   ❌ HRÁČ NIE JE SUSPENDOVANÝ (trest vypršal alebo ešte nezačal)`);
        }
    }
    
    return false;
};

window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success':
            typeClasses = 'bg-green-500 text-white';
            break;
        case 'error':
            typeClasses = 'bg-red-500 text-white';
            break;
        case 'info':
            typeClasses = 'bg-blue-500 text-white';
            break;
        default:
            typeClasses = 'bg-gray-700 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

// 🔴 NOVÁ FUNKCIA: createPlayerReference - vytvorenie referencie bez mien
const createPlayerReference = (teamDetails, teamIdentifier, player, isStaff = false, staffType = null, staffIndex = null) => {
    if (!teamDetails || !teamIdentifier || !player) return null;
    
    if (isStaff) {
        return {
            userId: teamDetails.userId,
            teamIdentifier: teamIdentifier,
            staffType: staffType,
            staffIndex: staffIndex !== null ? staffIndex : player.staffIndex,
            // Pridáme aj ID pre realizacny tim ak existuje
            staffId: player.id || null
        };
    } else {
        return {
            userId: teamDetails.userId,
            teamIdentifier: teamIdentifier,
            playerIndex: player.index,
            // 🔥 DÔLEŽITÉ: Pridáme unikátne ID hráča
            playerId: player.id || null,
            // Pre kompatibilitu so staršími záznamami
            playerName: `${player.lastName} ${player.firstName}`
        };
    }
};

const matchesHallApp = ({ userProfileData }) => {
    // Extrahujeme hallId z userProfileData
    const hallId = userProfileData?.hallId;
    const [hallName, setHallName] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [groupedMatches, setGroupedMatches] = useState({});
    const [categories, setCategories] = useState([]);
    const [users, setUsers] = useState([]);
    // NOVÝ STAV PRE VYBRANÝ ZÁPAS
    const [selectedMatch, setSelectedMatch] = useState(null);    

    const [matchEvents, setMatchEvents] = useState([]);
    const [matchScore, setMatchScore] = useState({ home: 0, away: 0 });
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [selectedPlayerForEvent, setSelectedPlayerForEvent] = useState(null);
    const [eventType, setEventType] = useState(null);
    const [eventTeam, setEventTeam] = useState(null); // 'home' alebo 'away'
    const [eventSubType, setEventSubType] = useState(null); // pre 7m hody: 'scored' alebo 'missed'
    const [matchPaused, setMatchPaused] = useState(false);
    const [matchTime, setMatchTime] = useState(0); // čas v sekundách
    const [timerInterval, setTimerInterval] = useState(null);
    const [manualTimeOffset, setManualTimeOffset] = useState(0); 
    const [cleanPlayingTime, setCleanPlayingTime] = useState(0);

    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [eventToDelete, setEventToDelete] = useState(null);
    
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [resetMatchId, setResetMatchId] = useState(null);    

    const [endMatchModalOpen, setEndMatchModalOpen] = useState(false);
    const [endMatchId, setEndMatchId] = useState(null);

    const [liveMatchData, setLiveMatchData] = useState({});
    const [completedMatchData, setCompletedMatchData] = useState({});
    const [highlightedEventId, setHighlightedEventId] = useState(null);
    const [showPlayerStats, setShowPlayerStats] = useState(false);
    const [playerStats, setPlayerStats] = useState({});

    const [editPlayerModalOpen, setEditPlayerModalOpen] = useState(false);
    const [playerToEdit, setPlayerToEdit] = useState(null);
    const [playerTeam, setPlayerTeam] = useState(null); // 'home' alebo 'away'
    const [playerTeamDetails, setPlayerTeamDetails] = useState(null);
    const [editPlayerFirstName, setEditPlayerFirstName] = useState('');
    const [editPlayerLastName, setEditPlayerLastName] = useState('');
    const [editPlayerJerseyNumber, setEditPlayerJerseyNumber] = useState('');
    const [playerTeamObject, setPlayerTeamObject] = useState(null);

    const [editStaffModalOpen, setEditStaffModalOpen] = useState(false);
    const [staffToEdit, setStaffToEdit] = useState(null);
    const [staffTeam, setStaffTeam] = useState(null); // 'home' alebo 'away'
    const [staffTeamDetails, setStaffTeamDetails] = useState(null);
    const [editStaffFirstName, setEditStaffFirstName] = useState('');
    const [editStaffLastName, setEditStaffLastName] = useState('');
    const [editStaffIsMen, setEditStaffIsMen] = useState(true); // true = men, false = women

    const [showFloatingScore, setShowFloatingScore] = useState(false);
    const [teamManagerReady, setTeamManagerReady] = useState(false);
    const [superstructureTeams, setSuperstructureTeams] = useState({});

    const [forfeitModalOpen, setForfeitModalOpen] = useState(false);
    const [forfeitMatchId, setForfeitMatchId] = useState(null);
    const [forfeitTeam, setForfeitTeam] = useState(null);
    const [groupsData, setGroupsData] = useState({});
    const [categoryIdMap, setCategoryIdMap] = useState({});
    const [forceUpdate, setForceUpdate] = useState(0);

    const [manualScoreModalOpen, setManualScoreModalOpen] = useState(false);
    const [manualHomeScore, setManualHomeScore] = useState('');
    const [manualAwayScore, setManualAwayScore] = useState('');
    const [manualScoreMatchId, setManualScoreMatchId] = useState(null);

    const [suspendedPlayersHome, setSuspendedPlayersHome] = useState({});
    const [suspendedPlayersAway, setSuspendedPlayersAway] = useState({});
    const [isLoadingSuspensionsHome, setIsLoadingSuspensionsHome] = useState(true);
    const [isLoadingSuspensionsAway, setIsLoadingSuspensionsAway] = useState(true);

    const [homeTeamNameReady, setHomeTeamNameReady] = useState(false);
    const [awayTeamNameReady, setAwayTeamNameReady] = useState(false);
    const [homeTeamResolvedName, setHomeTeamResolvedName] = useState(null);
    const [awayTeamResolvedName, setAwayTeamResolvedName] = useState(null);

    // ============================================================================
    // OPRAVENÝ useEffect PRE NAČÍTANIE SÚPISIEK - používa NÁZOV TÍMU (homeTeamResolvedName)
    // ============================================================================
    
    useEffect(() => {
        const loadTeamDetails = async () => {
            // Čakáme na zmapované názvy tímov
            if (!homeTeamResolvedName || !awayTeamResolvedName) {
                console.log('⏳ [SÚPISKY] Čakám na zmapovanie názvov tímov...');
                return;
            }
            
            if (!selectedMatch) return;
            
            console.log('⏳ [SÚPISKY] Spúšťam oneskorené načítanie detailov tímov (10 sekúnd)...');
            console.log(`   Domáci názov: "${homeTeamResolvedName}"`);
            console.log(`   Hosťovský názov: "${awayTeamResolvedName}"`);
            
            // Počkáme 10 sekúnd pred samotným načítaním
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            if (!selectedMatch) return;
            
            console.log('🔄 [SÚPISKY] Začínam načítavať detaily tímov podľa NÁZOV...');
            
            // ====================================================================
            // POUŽIJEME UŽ ZMAPOVANÉ NÁZVY TÍMOV (NIE IDENTIFIKÁTORY!)
            // ====================================================================
            
            // Získame detaily pre domáci tím - použijeme homeTeamResolvedName
            if (homeTeamResolvedName) {
                const homeDetails = await getTeamDetailsByDisplayName(homeTeamResolvedName, selectedMatch.categoryName);
                if (homeDetails && homeDetails.team) {
                    console.log(`✅ [SÚPISKY] Domáci tím načítaný: ${homeDetails.team.teamName}`);
                    console.log(`   Hráčov: ${homeDetails.team.playerDetails?.length || 0}`);
                    console.log(`   RT muži: ${homeDetails.team.menTeamMemberDetails?.length || 0}`);
                    console.log(`   RT ženy: ${homeDetails.team.womenTeamMemberDetails?.length || 0}`);
                    setHomeTeamNameReady(true);
                } else {
                    console.log(`⚠️ [SÚPISKY] Domáci tím sa nepodarilo načítať podľa názvu: "${homeTeamResolvedName}"`);
                    setHomeTeamNameReady(true);
                }
            }
            
            // Získame detaily pre hosťovský tím - použijeme awayTeamResolvedName
            if (awayTeamResolvedName) {
                const awayDetails = await getTeamDetailsByDisplayName(awayTeamResolvedName, selectedMatch.categoryName);
                if (awayDetails && awayDetails.team) {
                    console.log(`✅ [SÚPISKY] Hosťovský tím načítaný: ${awayDetails.team.teamName}`);
                    console.log(`   Hráčov: ${awayDetails.team.playerDetails?.length || 0}`);
                    console.log(`   RT muži: ${awayDetails.team.menTeamMemberDetails?.length || 0}`);
                    console.log(`   RT ženy: ${awayDetails.team.womenTeamMemberDetails?.length || 0}`);
                    setAwayTeamNameReady(true);
                } else {
                    console.log(`⚠️ [SÚPISKY] Hosťovský tím sa nepodarilo načítať podľa názvu: "${awayTeamResolvedName}"`);
                    setAwayTeamNameReady(true);
                }
            }
            
            console.log('✅ [SÚPISKY] Načítavanie detailov tímov dokončené.');
            setForceUpdate(prev => prev + 1);
        };
        
        // Spustíme až keď máme zmapované názvy
        const timer = setTimeout(() => {
            loadTeamDetails();
        }, 500);
        
        return () => clearTimeout(timer);
    }, [homeTeamResolvedName, awayTeamResolvedName, selectedMatch?.id, selectedMatch?.categoryName]);

    // Pridajte tento useEffect do matchesHallApp komponentu (napr. vedľa existujúcich useEffectov)
    // Tento useEffect zabezpečí, že pri každej zmene matches sa prepočítajú zobrazené názvy tímov
    
    useEffect(() => {
        if (!matches.length || !teamManagerReady) return;
        
        const updateTeamNamesInMatches = async () => {
            console.log('🔄 Aktualizujem mapovanie názvov tímov v zozname zápasov...');
            
            // Vytvoríme kópiu matches
            const updatedMatches = [...matches];
            let hasChanges = false;
            
            for (let i = 0; i < updatedMatches.length; i++) {
                const match = updatedMatches[i];
                
                // Získame pôvodné identifikátory
                const homeIdentifier = match.homeTeamIdentifier;
                const awayIdentifier = match.awayTeamIdentifier;
                
                // Ak už máme zmapované názvy uložené v match objekte, nemusíme ich prepočítavať
                // (môžeme si ich uložiť ako homeDisplayName a awayDisplayName)
                if (match.homeDisplayName && match.awayDisplayName) {
                    // Už máme zmapované názvy
                    continue;
                }
                
                // Získame zmapované názvy
                let homeDisplayName = homeIdentifier;
                let awayDisplayName = awayIdentifier;
                
                if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                    const homeResult = window.matchTracker.getTeamNameByDisplayId(homeIdentifier);
                    homeDisplayName = (homeResult && typeof homeResult.then === 'function') ? await homeResult : (homeResult || homeIdentifier);
                    
                    const awayResult = window.matchTracker.getTeamNameByDisplayId(awayIdentifier);
                    awayDisplayName = (awayResult && typeof awayResult.then === 'function') ? await awayResult : (awayResult || awayIdentifier);
                } else if (teamManagerReady && window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                    homeDisplayName = window.teamManager.getTeamNameByDisplayIdSync(homeIdentifier) || homeIdentifier;
                    awayDisplayName = window.teamManager.getTeamNameByDisplayIdSync(awayIdentifier) || awayIdentifier;
                }
                
                // Ak sa názvy zmenili, uložíme ich do match objektu
                if (homeDisplayName !== homeIdentifier || awayDisplayName !== awayIdentifier) {
                    updatedMatches[i] = {
                        ...match,
                        homeDisplayName: homeDisplayName,
                        awayDisplayName: awayDisplayName
                    };
                    hasChanges = true;
                } else {
                    // Aj keď sa nezmenili, uložíme pôvodné ako zobrazenie
                    updatedMatches[i] = {
                        ...match,
                        homeDisplayName: homeIdentifier,
                        awayDisplayName: awayIdentifier
                    };
                }
            }
            
            if (hasChanges) {
                setMatches(updatedMatches);
                console.log('✅ Zoznam zápasov bol aktualizovaný so zmapovanými názvami tímov');
            }
        };
        
        updateTeamNamesInMatches();
    }, [matches.length, teamManagerReady]); // Spustí sa pri zmene dĺžky matches alebo ready stavu

    // OPRAVENÝ useEffect pre mapovanie názvov tímov - používa matchTracker
    useEffect(() => {
        if (!selectedMatch) return;
        
        const mapTeamNames = async () => {
            // Počkáme na pripravenosť matchTracker (max 10 sekúnd)
            let waitCount = 0;
            while (!window.matchTracker || !window.matchTracker.isInitialDataLoaded?.()) {
                if (waitCount >= 100) {
                    console.warn('⚠️ Timeout: matchTracker sa nenačítal do 10 sekúnd');
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                waitCount++;
            }
            
            // 🔥 Získame NÁZVY TÍMOV priamo z matchTracker
            let homeName = selectedMatch.homeTeamIdentifier;
            let awayName = selectedMatch.awayTeamIdentifier;
            
            if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                const homeResult = window.matchTracker.getTeamNameByDisplayId(selectedMatch.homeTeamIdentifier);
                homeName = (homeResult && typeof homeResult.then === 'function') ? await homeResult : (homeResult || selectedMatch.homeTeamIdentifier);
                
                const awayResult = window.matchTracker.getTeamNameByDisplayId(selectedMatch.awayTeamIdentifier);
                awayName = (awayResult && typeof awayResult.then === 'function') ? await awayResult : (awayResult || selectedMatch.awayTeamIdentifier);
            }
            
            console.log(`🏠 Domáci: "${selectedMatch.homeTeamIdentifier}" -> "${homeName}"`);
            console.log(`✈️ Hosťovský: "${selectedMatch.awayTeamIdentifier}" -> "${awayName}"`);
            
            setHomeTeamResolvedName(homeName);
            setAwayTeamResolvedName(awayName);
            // NENASTAVUJEME homeTeamNameReady a awayTeamNameReady - to urobí druhý useEffect
        };
        
        mapTeamNames();
    }, [selectedMatch?.homeTeamIdentifier, selectedMatch?.awayTeamIdentifier, selectedMatch?.id]);

    // ============================================================================
    // NAČÍTANIE SUSPENDOVANÝCH HRÁČOV ZA MODRÚ KARTU PRE DOMÁCICH (OPRAVENÉ S ONESKORENÍM)
    // ============================================================================
    
    useEffect(() => {
        const loadSuspensions = async () => {
            console.log('⏳ [DOMÁCI] Spúšťam kontrolu modrých kariet...');
            
            // 🔥 1. POČKÁME NA INICIALIZÁCIU matchTracker (max 10 sekúnd)
            let waitCount = 0;
            while (!window.matchTracker || !window.matchTracker.isInitialDataLoaded?.()) {
                if (waitCount >= 100) {
                    console.warn('⚠️ [DOMÁCI] Timeout: matchTracker sa nenačítal do 10 sekúnd, pokračujem napriek tomu...');
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                waitCount++;
            }
            
            // 🔥 2. ONESKORENIE 5 SEKÚND PRED SPUSTENÍM KONTROLY
            console.log('⏳ [DOMÁCI] Čakám 10 sekúnd pred kontrolou modrých kariet...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // 🔥 3. POČKÁME, KÝM SA NENAČÍTAJÚ USERS A SUPERSTRUCTURE TEAMS
            if (users.length === 0 || Object.keys(superstructureTeams).length === 0) {
                console.log('⏳ [DOMÁCI] Čakám na načítanie používateľov a superstructureTeams...');
                let userWaitCount = 0;
                while ((users.length === 0 || Object.keys(superstructureTeams).length === 0) && userWaitCount < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    userWaitCount++;
                }
            }
            
            const teamIdentifier = selectedMatch?.homeTeamIdentifier;
            const teamDetails = getTeamDetailsFromIdentifier(teamIdentifier);
            const teamData = teamDetails?.team;
                        
            if (!teamIdentifier || !selectedMatch || !teamData?.playerDetails?.length) {
                console.log(`⚠️ [DOMÁCI] Tím nemá hráčov alebo nie je vybraný zápas, preskakujem kontrolu MK`);
                setIsLoadingSuspensionsHome(false);
                return;
            }
            
            setIsLoadingSuspensionsHome(true);
            const newSuspendedPlayers = {};
            
            // 🔥 DÔLEŽITÉ: Získame zobrazovací názov tímu
            const teamDisplayName = await getTeamNameByIdentifier(teamIdentifier);
            
            // 🔥 KRITICKÉ: Získame ČISTÝ NÁZOV TÍMU cez matchTracker
            let actualTeamName = teamDisplayName;
            if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                const result = window.matchTracker.getTeamNameByDisplayId(teamDisplayName);
                if (result && typeof result.then === 'function') {
                    actualTeamName = await result;
                } else {
                    actualTeamName = result;
                }
                if (!actualTeamName) actualTeamName = teamDisplayName;
            }
            
            const currentCategoryName = selectedMatch.categoryName;
            
            console.log(`🔍 [DOMÁCI] Domáci tím: identifikátor="${teamIdentifier}"`);
            console.log(`   Názov tímu z databázy: "${teamDisplayName}"`);
            console.log(`   🔄 KONVERTOVANÝ názov cez matchTracker: "${actualTeamName}"`);
            console.log(`   Kategória zápasu: "${currentCategoryName}"`);
            
            if (!actualTeamName) {
                console.log(`⚠️ [DOMÁCI] Nepodarilo sa získať názov pre domáci tím, preskakujem kontrolu MK`);
                setIsLoadingSuspensionsHome(false);
                return;
            }
            
            // 🔥 POUŽIJEME KONVERTOVANÝ NÁZOV TÍMU NA VYHĽADÁVANIE ZÁPASOV
            const teamMatches = await getTeamMatchesByNameAndCategory(actualTeamName, currentCategoryName);
            console.log(`📊 [DOMÁCI] Nájdených zápasov pre tím "${actualTeamName}" v kategórii "${currentCategoryName}": ${teamMatches.length}`);
            
            // Nájdenie poradia aktuálneho zápasu v histórii
            let currentMatchOrder = -1;
            for (let i = 0; i < teamMatches.length; i++) {
                if (teamMatches[i].id === selectedMatch.id) {
                    currentMatchOrder = i;
                    break;
                }
            }
            
            const blueCardSuspensionMatches = getBlueCardSuspensionMatches();
            console.log(`   [DOMÁCI] Aktuálny zápas je na poradí: ${currentMatchOrder}`);
            console.log(`   [DOMÁCI] Trest trvá ${blueCardSuspensionMatches} zápasov\n`);
            
            // Pre každého hráča v tíme
            for (let i = 0; i < teamData.playerDetails.length; i++) {
                const player = teamData.playerDetails[i];
                if (!player) continue;
                
                if (player.removedForMatch === selectedMatch.id) {
                    console.log(`   ⏭️ [DOMÁCI] Hráč ${player.lastName} ${player.firstName} je odstránený pre tento zápas, preskakujem`);
                    continue;
                }
                
                const playerIdentifier = {
                    userId: teamDetails.userId,
                    teamName: actualTeamName,
                    playerIndex: i,
                    playerId: player.id,
                    firstName: player.firstName,
                    lastName: player.lastName,
                    playerName: `${player.lastName} ${player.firstName}`
                };
                
                const blueCardEvents = await getBlueCardEventsForPlayerByNameAndCategory(
                    teamMatches, 
                    playerIdentifier, 
                    selectedMatch.id, 
                    getTeamDetailsFromIdentifier
                );
                
                if (blueCardEvents.length > 0) {
                    const latestBlueCard = blueCardEvents[0];
                    
                    // 🔥 OPRAVENÝ VÝPOČET: Ak je currentMatchOrder = -1, znamená to, že aktuálny zápas
                    // nie je v histórii (napr. prvý zápas v nadstavbe). Vtedy trest platí.
                    let matchesPassed;
                    let isSuspended = false;
                    
                    if (currentMatchOrder === -1) {
                        // Aktuálny zápas nie je v histórii - to je prvý zápas v novej fáze
                        // Trest by mal platiť, ak je modrá karta z posledného zápasu
                        matchesPassed = 1; // Predpokladáme, že toto je prvý zápas po MK
                        isSuspended = true;
                        console.log(`   ⚠️ [DOMÁCI] Aktuálny zápas nie je v histórii tímu (prvý zápas v nadstavbe?)`);
                    } else {
                        matchesPassed = currentMatchOrder - latestBlueCard.matchOrder;
                        isSuspended = (matchesPassed > 0 && matchesPassed <= blueCardSuspensionMatches);
                    }
                    
                    console.log(`   🃏 [DOMÁCI] Hráč ${player.lastName} ${player.firstName}:`);
                    console.log(`      - Najnovšia MK v zápase č. ${latestBlueCard.matchOrder} (ID: ${latestBlueCard.matchId})`);
                    console.log(`      - Dátum MK: ${latestBlueCard.matchDate ? latestBlueCard.matchDate.toDate().toLocaleDateString('sk-SK') : 'neznámy'}`);
                    console.log(`      - Zápasov od MK: ${matchesPassed}`);
                    console.log(`      - Trest: ${blueCardSuspensionMatches} zápasov`);
                    console.log(`      - Suspendovaný: ${isSuspended ? 'ÁNO ✅' : 'NIE ❌'}`);
                    
                    if (isSuspended) {
                        newSuspendedPlayers[i] = {
                            player: player,
                            reason: `Vylúčený na ${blueCardSuspensionMatches} ${blueCardSuspensionMatches === 1 ? 'zápas' : (blueCardSuspensionMatches < 5 ? 'zápasy' : 'zápasov')} za modrú kartu`,
                            blueCardMatchOrder: latestBlueCard.matchOrder,
                            matchesPassed: matchesPassed
                        };
                    }
                } else {
                    console.log(`   ✅ [DOMÁCI] Hráč ${player.lastName} ${player.firstName}: žiadne modré karty v histórii`);
                }
            }
            
            setSuspendedPlayersHome(newSuspendedPlayers);
            setIsLoadingSuspensionsHome(false);
            console.log(`✅ [DOMÁCI] Kontrola modrých kariet dokončená. Nájdených suspendovaných: ${Object.keys(newSuspendedPlayers).length}`);
        };
        
        // 🔥 ONESKORENIE 500ms PRED SPUSTENÍM CELÉHO PROCESU (aby sa stihli načítať základné dáta)
        const timer = setTimeout(() => {
            loadSuspensions();
        }, 500);
        
        return () => clearTimeout(timer);
    }, [selectedMatch?.homeTeamIdentifier, selectedMatch?.id, selectedMatch?.categoryName, users, superstructureTeams]);

    // ============================================================================
    // NAČÍTANIE SUSPENDOVANÝCH HRÁČOV ZA MODRÚ KARTU PRE HOSŤOVSKÝCH (OPRAVENÉ S ONESKORENÍM)
    // ============================================================================
    
    useEffect(() => {
        const loadSuspensions = async () => {
            console.log('⏳ [HOSŤOVSKÍ] Spúšťam kontrolu modrých kariet...');
            
            // 🔥 1. POČKÁME NA INICIALIZÁCIU matchTracker (max 10 sekúnd)
            let waitCount = 0;
            while (!window.matchTracker || !window.matchTracker.isInitialDataLoaded?.()) {
                if (waitCount >= 100) {
                    console.warn('⚠️ [HOSŤOVSKÍ] Timeout: matchTracker sa nenačítal do 10 sekúnd, pokračujem napriek tomu...');
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                waitCount++;
            }
            
            // 🔥 2. ONESKORENIE 5 SEKÚND PRED SPUSTENÍM KONTROLY
            console.log('⏳ [HOSŤOVSKÍ] Čakám 10 sekúnd pred kontrolou modrých kariet...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // 🔥 3. POČKÁME, KÝM SA NENAČÍTAJÚ USERS A SUPERSTRUCTURE TEAMS
            if (users.length === 0 || Object.keys(superstructureTeams).length === 0) {
                console.log('⏳ [HOSŤOVSKÍ] Čakám na načítanie používateľov a superstructureTeams...');
                let userWaitCount = 0;
                while ((users.length === 0 || Object.keys(superstructureTeams).length === 0) && userWaitCount < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    userWaitCount++;
                }
            }
            
            const teamIdentifier = selectedMatch?.awayTeamIdentifier;
            const teamDetails = getTeamDetailsFromIdentifier(teamIdentifier);
            const teamData = teamDetails?.team;
                        
            if (!teamIdentifier || !selectedMatch || !teamData?.playerDetails?.length) {
                console.log(`⚠️ [HOSŤOVSKÍ] Tím nemá hráčov alebo nie je vybraný zápas, preskakujem kontrolu MK`);
                setIsLoadingSuspensionsAway(false);
                return;
            }
            
            setIsLoadingSuspensionsAway(true);
            const newSuspendedPlayers = {};
            
            // 🔥 DÔLEŽITÉ: Získame zobrazovací názov tímu
            const teamDisplayName = await getTeamNameByIdentifier(teamIdentifier);
            
            // 🔥 KRITICKÉ: Získame ČISTÝ NÁZOV TÍMU cez matchTracker
            let actualTeamName = teamDisplayName;
            if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                const result = window.matchTracker.getTeamNameByDisplayId(teamDisplayName);
                if (result && typeof result.then === 'function') {
                    actualTeamName = await result;
                } else {
                    actualTeamName = result;
                }
                if (!actualTeamName) actualTeamName = teamDisplayName;
            }
            
            const currentCategoryName = selectedMatch.categoryName;
            
            console.log(`🔍 [HOSŤOVSKÍ] Hosťovský tím: identifikátor="${teamIdentifier}"`);
            console.log(`   Názov tímu z databázy: "${teamDisplayName}"`);
            console.log(`   🔄 KONVERTOVANÝ názov cez matchTracker: "${actualTeamName}"`);
            console.log(`   Kategória zápasu: "${currentCategoryName}"`);
            
            if (!actualTeamName) {
                console.log(`⚠️ [HOSŤOVSKÍ] Nepodarilo sa získať názov pre hosťovský tím, preskakujem kontrolu MK`);
                setIsLoadingSuspensionsAway(false);
                return;
            }
            
            // 🔥 POUŽIJEME KONVERTOVANÝ NÁZOV TÍMU NA VYHĽADÁVANIE ZÁPASOV
            const teamMatches = await getTeamMatchesByNameAndCategory(actualTeamName, currentCategoryName);
            console.log(`📊 [HOSŤOVSKÍ] Nájdených zápasov pre tím "${actualTeamName}" v kategórii "${currentCategoryName}": ${teamMatches.length}`);
            
            // Nájdenie poradia aktuálneho zápasu v histórii
            let currentMatchOrder = -1;
            for (let i = 0; i < teamMatches.length; i++) {
                if (teamMatches[i].id === selectedMatch.id) {
                    currentMatchOrder = i;
                    break;
                }
            }
            
            const blueCardSuspensionMatches = getBlueCardSuspensionMatches();
            console.log(`   [HOSŤOVSKÍ] Aktuálny zápas je na poradí: ${currentMatchOrder}`);
            console.log(`   [HOSŤOVSKÍ] Trest trvá ${blueCardSuspensionMatches} zápasov\n`);
            
            // Pre každého hráča v tíme
            for (let i = 0; i < teamData.playerDetails.length; i++) {
                const player = teamData.playerDetails[i];
                if (!player) continue;
                
                if (player.removedForMatch === selectedMatch.id) {
                    console.log(`   ⏭️ [HOSŤOVSKÍ] Hráč ${player.lastName} ${player.firstName} je odstránený pre tento zápas, preskakujem`);
                    continue;
                }
                
                const playerIdentifier = {
                    userId: teamDetails.userId,
                    teamName: actualTeamName,
                    playerIndex: i,
                    playerId: player.id,
                    firstName: player.firstName,
                    lastName: player.lastName,
                    playerName: `${player.lastName} ${player.firstName}`
                };
                
                const blueCardEvents = await getBlueCardEventsForPlayerByNameAndCategory(
                    teamMatches, 
                    playerIdentifier, 
                    selectedMatch.id, 
                    getTeamDetailsFromIdentifier
                );
                
                if (blueCardEvents.length > 0) {
                    const latestBlueCard = blueCardEvents[0];
                    
                    // 🔥 OPRAVENÝ VÝPOČET
                    let matchesPassed;
                    let isSuspended = false;
                    
                    if (currentMatchOrder === -1) {
                        matchesPassed = 1;
                        isSuspended = true;
                        console.log(`   ⚠️ [HOSŤOVSKÍ] Aktuálny zápas nie je v histórii tímu (prvý zápas v nadstavbe?)`);
                    } else {
                        matchesPassed = currentMatchOrder - latestBlueCard.matchOrder;
                        isSuspended = (matchesPassed > 0 && matchesPassed <= blueCardSuspensionMatches);
                    }
                    
                    console.log(`   🃏 [HOSŤOVSKÍ] Hráč ${player.lastName} ${player.firstName}:`);
                    console.log(`      - Najnovšia MK v zápase č. ${latestBlueCard.matchOrder} (ID: ${latestBlueCard.matchId})`);
                    console.log(`      - Dátum MK: ${latestBlueCard.matchDate ? latestBlueCard.matchDate.toDate().toLocaleDateString('sk-SK') : 'neznámy'}`);
                    console.log(`      - Zápasov od MK: ${matchesPassed}`);
                    console.log(`      - Trest: ${blueCardSuspensionMatches} zápasov`);
                    console.log(`      - Suspendovaný: ${isSuspended ? 'ÁNO ✅' : 'NIE ❌'}`);
                    
                    if (isSuspended) {
                        newSuspendedPlayers[i] = {
                            player: player,
                            reason: `Vylúčený na ${blueCardSuspensionMatches} ${blueCardSuspensionMatches === 1 ? 'zápas' : (blueCardSuspensionMatches < 5 ? 'zápasy' : 'zápasov')} za modrú kartu`,
                            blueCardMatchOrder: latestBlueCard.matchOrder,
                            matchesPassed: matchesPassed,
                            blueCardDate: latestBlueCard.matchDate
                        };
                    }
                } else {
                    console.log(`   ✅ [HOSŤOVSKÍ] Hráč ${player.lastName} ${player.firstName}: žiadne modré karty v histórii`);
                }
            }
            
            setSuspendedPlayersAway(newSuspendedPlayers);
            setIsLoadingSuspensionsAway(false);
            console.log(`✅ [HOSŤOVSKÍ] Kontrola modrých kariet dokončená. Nájdených suspendovaných: ${Object.keys(newSuspendedPlayers).length}`);
        };
        
        // 🔥 ONESKORENIE 500ms PRED SPUSTENÍM CELÉHO PROCESU
        const timer = setTimeout(() => {
            loadSuspensions();
        }, 500);
        
        return () => clearTimeout(timer);
    }, [selectedMatch?.awayTeamIdentifier, selectedMatch?.id, selectedMatch?.categoryName, users, superstructureTeams]);

    // Načítanie nastavení tabuľky do localStorage pre rýchly prístup
    useEffect(() => {
        if (!window.db) return;
        
        const loadTableSettings = async () => {
            try {
                const settingsDocRef = doc(window.db, 'settings', 'table');
                const settingsDoc = await getDoc(settingsDocRef);
                
                if (settingsDoc.exists()) {
                    const data = settingsDoc.data();
                    localStorage.setItem('tableSettings', JSON.stringify({
                        pointsForWin: data.pointsForWin || 3,
                        blueCardSuspensionMatches: data.blueCardSuspensionMatches || 1
                    }));
                } else {
                    localStorage.setItem('tableSettings', JSON.stringify({
                        pointsForWin: 3,
                        blueCardSuspensionMatches: 1
                    }));
                }
            } catch (error) {
                console.error('Chyba pri načítaní nastavení tabuľky:', error);
            }
        };
        
        loadTableSettings();
        
        // Nastavíme aj listener na zmeny v nastaveniach
        const settingsDocRef = doc(window.db, 'settings', 'table');
        const unsubscribe = onSnapshot(settingsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                localStorage.setItem('tableSettings', JSON.stringify({
                    pointsForWin: data.pointsForWin || 3,
                    blueCardSuspensionMatches: data.blueCardSuspensionMatches || 1
                }));
            }
        });
        
        return () => unsubscribe();
    }, []);

    // Automatická aktualizácia vylúčení každú sekundu
    useEffect(() => {
        // Skontrolujeme, či máme vybraný zápas a či beží/prebieha
        if (!selectedMatch) return;
        
        const isMatchInProgress = selectedMatch.status === 'in-progress' || selectedMatch.status === 'paused';
        if (!isMatchInProgress) return;
        
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return;
        
        // Skontrolujeme, či existujú aktívne vylúčenia pre niektorý z tímov
        const excludeDuration = (currentCategory.exclusionTime || 2) * 60;
        
        // Pomocná funkcia na kontrolu aktívnych vylúčení
        const hasActiveExclusions = () => {
            if (!matchEvents.length) return false;
            
            return matchEvents.some(event => {
                if (event.type !== 'exclusion') return false;
                const eventTime = (event.minute || 0) * 60 + (event.second || 0);
                return (matchTime - eventTime) < excludeDuration;
            });
        };
        
        // Spustíme interval len ak sú aktívne vylúčenia
        if (!hasActiveExclusions()) return;
        
        const interval = setInterval(() => {
            // Vynútime prekreslenie
            setForceUpdate(prev => prev + 1);
        }, 1000);
        
        return () => clearInterval(interval);
    }, [selectedMatch, matchEvents, matchTime, categories]);

    // Tento useEffect zabezpečí, že keď sa zmenia users, selectedMatch sa prekreslí
    useEffect(() => {
        // Ak máme vybraný zápas, vynútime prekreslenie detailu
        if (selectedMatch && users.length > 0) {
            // Malé oneskorenie, aby sa stihli načítať dáta
            const timer = setTimeout(() => {
                // Vynútime aktualizáciu selectedMatch (prekopírujeme ho)
                setSelectedMatch(prev => ({ ...prev }));
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [users]); // Tento useEffect sa spustí pri každej zmene users

    // Funkcia na pridanie unikátnych ID pre všetkých hráčov a členov RT, ktorí ich nemajú
    const ensureUniqueIds = (teamData) => {
        if (!teamData) return teamData;
        
        // Pridanie ID pre hráčov
        if (teamData.playerDetails && Array.isArray(teamData.playerDetails)) {
            teamData.playerDetails = teamData.playerDetails.map(player => {
                if (!player.id) {
                    return {
                        ...player,
                        id: `player_${Date.now()}_${Math.random()}_${Math.random()}`
                    };
                }
                return player;
            });
        }
        
        // Pridanie ID pre mužov v RT
        if (teamData.menTeamMemberDetails && Array.isArray(teamData.menTeamMemberDetails)) {
            teamData.menTeamMemberDetails = teamData.menTeamMemberDetails.map(member => {
                if (!member.id) {
                    return {
                        ...member,
                        id: `staff_men_${Date.now()}_${Math.random()}_${Math.random()}`
                    };
                }
                return member;
            });
        }
        
        // Pridanie ID pre ženy v RT
        if (teamData.womenTeamMemberDetails && Array.isArray(teamData.womenTeamMemberDetails)) {
            teamData.womenTeamMemberDetails = teamData.womenTeamMemberDetails.map(member => {
                if (!member.id) {
                    return {
                        ...member,
                        id: `staff_women_${Date.now()}_${Math.random()}_${Math.random()}`
                    };
                }
                return member;
            });
        }
        
        return teamData;
    };

    // Funkcia na otvorenie modálneho okna pre úpravu člena realizačného tímu
    const openEditStaffModal = (member, team, teamDetails, staffType, staffIndex) => {
        if (selectedMatch?.status !== 'scheduled') {
            window.showGlobalNotification('Úprava členov RT je možná len pri naplánovaných zápasoch', 'error');
            return;
        }
    
        // 🔥 ULOŽÍME SI ORIGINÁLNY OBJEKT PRE PRÍPAD, ŽE BY SME HO POTREBOVALI NÁJSŤ NESKÔR
        const staffArray = staffType === 'men' ? teamDetails.team.menTeamMemberDetails : teamDetails.team.womenTeamMemberDetails;
        const originalMember = staffIndex !== undefined && staffIndex < staffArray.length ? staffArray[staffIndex] : null;
        
        const memberWithIndex = {
            ...member,
            tempIndex: staffIndex,
            originalMember: originalMember
        };
        
        setStaffToEdit(memberWithIndex);
        setStaffTeam(team);
        setStaffTeamDetails(teamDetails);
        setEditStaffFirstName(member.firstName || '');
        setEditStaffLastName(member.lastName || '');
        setEditStaffIsMen(staffType === 'men');
        setEditStaffModalOpen(true);
    };

    // Funkcia na uloženie úprav člena RT (OPRAVENÁ)
    const saveStaffEdit = async () => {
        if (!staffToEdit || !staffTeamDetails || !staffTeam) return;
        
        try {
            const userRef = doc(window.db, 'users', staffTeamDetails.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                window.showGlobalNotification('Používateľ neexistuje', 'error');
                return;
            }
            
            const userData = userSnap.data();
            let teams = userData.teams || {};
            const category = selectedMatch.categoryName;
            
            const teamIdentifier = staffTeam === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
            const parts = teamIdentifier.split(' ');
            const groupAndOrder = parts.pop();
            const categoryName = parts.join(' ');
            
            let groupLetter = '';
            let order = '';
            for (let i = 0; i < groupAndOrder.length; i++) {
                const char = groupAndOrder[i];
                if (char >= '0' && char <= '9') {
                    order = groupAndOrder.substring(i);
                    groupLetter = groupAndOrder.substring(0, i);
                    break;
                }
            }
            
            const fullGroupName = `skupina ${groupLetter}`;
            const orderNum = parseInt(order, 10);
            
            const userTeams = teams[categoryName] || [];
            const teamIndex = userTeams.findIndex(t => t.groupName === fullGroupName && t.order === orderNum);
            
            if (teamIndex === -1) {
                window.showGlobalNotification('Tím nebol nájdený', 'error');
                return;
            }
            
            const updatedTeams = JSON.parse(JSON.stringify(userTeams));
            let team = updatedTeams[teamIndex];
            
            // 🔥 DÔLEŽITÉ: Pridáme ID všetkým členom RT, ktorí ich nemajú
            team = ensureUniqueIds(team);
            
            const staffArrayName = editStaffIsMen ? 'menTeamMemberDetails' : 'womenTeamMemberDetails';
            let staffIndex = -1;
            
            // 1. Najprv podľa ID
            if (staffToEdit.id) {
                staffIndex = team[staffArrayName].findIndex(m => m.id === staffToEdit.id);
            }
            
            // 2. Skúsime podľa dočasného indexu
            if (staffIndex === -1 && staffToEdit.tempIndex !== undefined && staffToEdit.tempIndex >= 0) {
                if (staffToEdit.tempIndex < team[staffArrayName].length) {
                    const memberAtPosition = team[staffArrayName][staffToEdit.tempIndex];
                    if (memberAtPosition && (!memberAtPosition.id ||
                        (memberAtPosition.firstName === staffToEdit.firstName && 
                         memberAtPosition.lastName === staffToEdit.lastName))) {
                        staffIndex = staffToEdit.tempIndex;
                    }
                }
            }
            
            // 3. Skúsime podľa mena a priezviska
            if (staffIndex === -1) {
                staffIndex = team[staffArrayName].findIndex(m => 
                    (m.firstName || '') === (editStaffFirstName || '') && 
                    (m.lastName || '') === (editStaffLastName || '')
                );
            }
            
            // 4. Ak nenašli, pridáme nového
            if (staffIndex === -1) {
                const newMember = {
                    id: `staff_${editStaffIsMen ? 'men' : 'women'}_${Date.now()}_${Math.random()}`,
                    firstName: editStaffFirstName,
                    lastName: editStaffLastName
                };
                team[staffArrayName].push(newMember);
                staffIndex = team[staffArrayName].length - 1;
            } else {
                // Aktualizujeme existujúceho
                const updatedMember = {
                    ...team[staffArrayName][staffIndex],
                    firstName: editStaffFirstName,
                    lastName: editStaffLastName
                };
                
                if (!updatedMember.id) {
                    updatedMember.id = `staff_${editStaffIsMen ? 'men' : 'women'}_${Date.now()}_${Math.random()}`;
                }
                
                team[staffArrayName][staffIndex] = updatedMember;
            }
            
            updatedTeams[teamIndex] = team;
            teams[categoryName] = updatedTeams;
            
            await updateDoc(userRef, { teams });
            
            setUsers(prevUsers => {
                return prevUsers.map(user => {
                    if (user.id === staffTeamDetails.userId) {
                        return {
                            ...user,
                            teams: JSON.parse(JSON.stringify(teams))
                        };
                    }
                    return user;
                });
            });
            
            window.showGlobalNotification('Údaje člena RT boli uložené', 'success');
            
            setEditStaffModalOpen(false);
            setStaffToEdit(null);
            
        } catch (error) {
            console.error('Chyba pri ukladaní údajov člena RT:', error);
            window.showGlobalNotification('Chyba pri ukladaní údajov člena RT', 'error');
        }
    };

    const openEditPlayerModal = (player, team, teamDetails, isStaff = false) => {
        if (selectedMatch?.status !== 'scheduled') {
            window.showGlobalNotification('Úprava hráčov je možná len pri naplánovaných zápasoch', 'error');
            return;
        }
        
        // Nájdeme index hráča v poli
        const teamData = teamDetails.team;
        let playerIndex = -1;
        
        if (player.id) {
            playerIndex = teamData.playerDetails.findIndex(p => p.id === player.id);
        }
        if (playerIndex === -1) {
            playerIndex = teamData.playerDetails.findIndex(p => 
                (p.firstName || '') === (player.firstName || '') && 
                (p.lastName || '') === (player.lastName || '') && 
                (p.jerseyNumber || '') === (player.jerseyNumber || '')
            );
        }
        
        // 🔥 ULOŽÍME SI ORIGINÁLNY OBJEKT PRE PRÍPAD, ŽE BY SME HO POTREBOVALI NÁJSŤ NESKÔR
        const playerWithIndex = {
            ...player,
            tempIndex: playerIndex,
            originalPlayer: playerIndex !== -1 ? teamData.playerDetails[playerIndex] : null
        };
        
        setPlayerToEdit(playerWithIndex);
        setPlayerTeam(team);
        setPlayerTeamDetails(teamDetails);
        setPlayerTeamObject(teamDetails.team);
        setEditPlayerFirstName(player.firstName || '');
        setEditPlayerLastName(player.lastName || '');
        setEditPlayerJerseyNumber(player.jerseyNumber || '');
        setEditPlayerModalOpen(true);
    };
    
    // Funkcia na uloženie úprav hráča (OPRAVENÁ - používa ID)
    const savePlayerEdit = async () => {
        if (!playerToEdit || !playerTeamDetails || !playerTeam) return;
        
        try {
            const userRef = doc(window.db, 'users', playerTeamDetails.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                window.showGlobalNotification('Používateľ neexistuje', 'error');
                return;
            }
            
            const userData = userSnap.data();
            let teams = userData.teams || {};
            const category = selectedMatch.categoryName;
            
            // Nájdeme správny tím podľa identifikátora
            const teamIdentifier = playerTeam === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
            const parts = teamIdentifier.split(' ');
            const groupAndOrder = parts.pop();
            const categoryName = parts.join(' ');
            
            let groupLetter = '';
            let order = '';
            for (let i = 0; i < groupAndOrder.length; i++) {
                const char = groupAndOrder[i];
                if (char >= '0' && char <= '9') {
                    order = groupAndOrder.substring(i);
                    groupLetter = groupAndOrder.substring(0, i);
                    break;
                }
            }
            
            const fullGroupName = `skupina ${groupLetter}`;
            const orderNum = parseInt(order, 10);
            
            const userTeams = teams[categoryName] || [];
            const teamIndex = userTeams.findIndex(t => t.groupName === fullGroupName && t.order === orderNum);
            
            if (teamIndex === -1) {
                window.showGlobalNotification('Tím nebol nájdený', 'error');
                return;
            }
            
            // Vytvoríme hlbokú kópiu
            const updatedTeams = JSON.parse(JSON.stringify(userTeams));
            let team = updatedTeams[teamIndex];
            
            // 🔥 DÔLEŽITÉ: Najprv pridáme ID všetkým hráčom, ktorí ho nemajú
            team = ensureUniqueIds(team);
            
            // Nájdeme hráča podľa ID (priorita) alebo podľa kombinácie
            let playerIndex = -1;
            
            // 1. Najprv skúsime podľa ID (ak existuje)
            if (playerToEdit.id) {
                playerIndex = team.playerDetails.findIndex(p => p.id === playerToEdit.id);
            }
            
            // 2. Ak nemá ID, skúsime podľa dočasného indexu (len pre prázdnych hráčov)
            if (playerIndex === -1 && playerToEdit.tempIndex !== undefined && playerToEdit.tempIndex >= 0) {
                if (playerToEdit.tempIndex < team.playerDetails.length) {
                    const playerAtPosition = team.playerDetails[playerToEdit.tempIndex];
                    // Ak je na tej pozícii hráč bez ID alebo s rovnakými údajmi
                    if (playerAtPosition && (!playerAtPosition.id || 
                        (playerAtPosition.firstName === playerToEdit.firstName && 
                         playerAtPosition.lastName === playerToEdit.lastName &&
                         playerAtPosition.jerseyNumber === playerToEdit.jerseyNumber))) {
                        playerIndex = playerToEdit.tempIndex;
                    }
                }
            }
            
            // 3. Skúsime podľa kombinácie vlastností
            if (playerIndex === -1) {
                playerIndex = team.playerDetails.findIndex(p => 
                    (p.firstName || '') === (playerToEdit.firstName || '') && 
                    (p.lastName || '') === (playerToEdit.lastName || '') && 
                    (p.jerseyNumber || '') === (playerToEdit.jerseyNumber || '')
                );
            }
            
            // 4. Ak stále nenašli, vytvoríme nového hráča
            if (playerIndex === -1) {
                // Pridáme nového hráča na koniec
                const newPlayer = {
                    id: `player_${Date.now()}_${Math.random()}`,
                    firstName: editPlayerFirstName,
                    lastName: editPlayerLastName,
                    jerseyNumber: editPlayerJerseyNumber
                };
                team.playerDetails.push(newPlayer);
                playerIndex = team.playerDetails.length - 1;
            } else {
                // Aktualizujeme existujúceho hráča
                const existingPlayer = team.playerDetails[playerIndex];
                const updatedPlayer = {
                    ...existingPlayer,
                    firstName: editPlayerFirstName,
                    lastName: editPlayerLastName,
                    jerseyNumber: editPlayerJerseyNumber
                };
                
                // Zachováme pôvodné ID ak existuje
                if (!updatedPlayer.id) {
                    updatedPlayer.id = `player_${Date.now()}_${Math.random()}`;
                }
                
                team.playerDetails[playerIndex] = updatedPlayer;
            }
            
            updatedTeams[teamIndex] = team;
            teams[categoryName] = updatedTeams;
            
            await updateDoc(userRef, { teams });
            
            // Aktualizácia stavu
            setUsers(prevUsers => {
                return prevUsers.map(user => {
                    if (user.id === playerTeamDetails.userId) {
                        return {
                            ...user,
                            teams: JSON.parse(JSON.stringify(teams))
                        };
                    }
                    return user;
                });
            });
            
            window.showGlobalNotification('Údaje hráča boli uložené', 'success');
            
            setEditPlayerModalOpen(false);
            setPlayerToEdit(null);
            
        } catch (error) {
            console.error('Chyba pri ukladaní údajov hráča:', error);
            window.showGlobalNotification('Chyba pri ukladaní údajov hráča: ' + error.message, 'error');
        }
    };
    
    // Funkcia na odstránenie hráča zo súpisky (UPRAVENÁ)
    const removePlayerFromRoster = async () => {
        if (!playerToEdit || !playerTeamDetails || !playerTeam) {
            return;
        }
                
        try {
            const userRef = doc(window.db, 'users', playerTeamDetails.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                window.showGlobalNotification('Používateľ neexistuje', 'error');
                return;
            }
            
            const userData = userSnap.data();
            const teams = userData.teams || {};
            const category = selectedMatch.categoryName;
            
            const teamIdentifier = playerTeam === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
            const parts = teamIdentifier.split(' ');
            const groupAndOrder = parts.pop();
            const categoryName = parts.join(' ');
            
            let groupLetter = '';
            let order = '';
            for (let i = 0; i < groupAndOrder.length; i++) {
                const char = groupAndOrder[i];
                if (char >= '0' && char <= '9') {
                    order = groupAndOrder.substring(i);
                    groupLetter = groupAndOrder.substring(0, i);
                    break;
                }
            }
            
            const fullGroupName = `skupina ${groupLetter}`;
            const orderNum = parseInt(order, 10);
            
            const userTeams = teams[categoryName] || [];
            const teamIndex = userTeams.findIndex(t => t.groupName === fullGroupName && t.order === orderNum);
            
            if (teamIndex === -1) {
                window.showGlobalNotification('Tím nebol nájdený', 'error');
                return;
            }
            
            const updatedTeams = [...userTeams];
            const team = updatedTeams[teamIndex];
            
            // Nájdeme index hráča v poli playerDetails podľa jeho vlastností (nie podľa referencie)
            const playerIndex = team.playerDetails.findIndex(p => 
                p.firstName === playerToEdit.firstName && 
                p.lastName === playerToEdit.lastName && 
                p.jerseyNumber === playerToEdit.jerseyNumber
            );
            
            if (playerIndex === -1) {
                window.showGlobalNotification('Hráč nebol nájdený v súpiske', 'error');
                return;
            }
            
            const removedPlayer = { ...team.playerDetails[playerIndex] };
            
            // PRIDANÉ: Uložíme informáciu o odstránení pre konkrétny zápas
            if (!team.matchSpecificRemovals) {
                team.matchSpecificRemovals = {};
            }
            
            if (!team.matchSpecificRemovals[selectedMatch.id]) {
                team.matchSpecificRemovals[selectedMatch.id] = {
                    removedPlayersForMatch: [],
                    removedStaff: []
                };
            }
            
            // Uložíme hráča s informáciou o zápase
            team.matchSpecificRemovals[selectedMatch.id].removedPlayersForMatch.push({
                ...removedPlayer,
                removedAt: Timestamp.now(),
                matchId: selectedMatch.id,
                team: playerTeam
            });
        
            // Odstránime hráča z aktívneho zoznamu pre tento zápas
            team.playerDetails[playerIndex].removedForMatch = selectedMatch.id;
            
            updatedTeams[teamIndex] = team;
            teams[categoryName] = updatedTeams;
            
            await updateDoc(userRef, { teams });
            
            // AKTUALIZUJEME LOKÁLNY STAV users
            setUsers(prevUsers => {
                return prevUsers.map(user => {
                    if (user.id === playerTeamDetails.userId) {
                        return {
                            ...user,
                            teams: teams
                        };
                    }
                    return user;
                });
            });
            
            window.showGlobalNotification('Hráč bol odstránený zo súpisky pre tento zápas', 'success');
            
            setEditPlayerModalOpen(false);
            setPlayerToEdit(null);
            
        } catch (error) {
            console.error('Chyba pri odstraňovaní hráča:', error);
            window.showGlobalNotification('Chyba pri odstraňovaní hráča: ' + error.message, 'error');
        }
    };

    // Funkcia na obnovenie člena RT do súpisky
    const restoreStaffToRoster = async (member, team, teamDetails, staffType) => {
        if (!member || !teamDetails || !team || selectedMatch?.status !== 'scheduled') return;
        
        try {
            const userRef = doc(window.db, 'users', teamDetails.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                window.showGlobalNotification('Používateľ neexistuje', 'error');
                return;
            }
            
            const userData = userSnap.data();
            const teams = userData.teams || {};
            const category = selectedMatch.categoryName;
            
            const teamIdentifier = team === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
            const parts = teamIdentifier.split(' ');
            const groupAndOrder = parts.pop();
            const categoryName = parts.join(' ');
            
            let groupLetter = '';
            let order = '';
            for (let i = 0; i < groupAndOrder.length; i++) {
                const char = groupAndOrder[i];
                if (char >= '0' && char <= '9') {
                    order = groupAndOrder.substring(i);
                    groupLetter = groupAndOrder.substring(0, i);
                    break;
                }
            }
            
            const fullGroupName = `skupina ${groupLetter}`;
            const orderNum = parseInt(order, 10);
            
            const userTeams = teams[categoryName] || [];
            const teamIndex = userTeams.findIndex(t => t.groupName === fullGroupName && t.order === orderNum);
            
            if (teamIndex === -1) {
                window.showGlobalNotification('Tím nebol nájdený', 'error');
                return;
            }
            
            const updatedTeams = [...userTeams];
            const teamData = updatedTeams[teamIndex];
            
            // Nájdeme člena RT v príslušnom poli podľa údajov
            const staffArray = staffType === 'men' ? teamData.menTeamMemberDetails : teamData.womenTeamMemberDetails;
            const staffIndex = staffArray.findIndex(m => 
                m.firstName === member.firstName && 
                m.lastName === member.lastName
            );
            
            if (staffIndex !== -1) {
                // Odstránime označenie pre tento zápas
                delete staffArray[staffIndex].removedForMatch?.[selectedMatch.id];
                if (staffArray[staffIndex].removedForMatch && Object.keys(staffArray[staffIndex].removedForMatch).length === 0) {
                    delete staffArray[staffIndex].removedForMatch;
                }
                
                // Odstránime zo zoznamu odstránených pre tento zápas
                if (teamData.matchSpecificRemovals && teamData.matchSpecificRemovals[selectedMatch.id]) {
                    teamData.matchSpecificRemovals[selectedMatch.id].removedStaff = 
                        teamData.matchSpecificRemovals[selectedMatch.id].removedStaff.filter(
                            removed => !(removed.firstName === member.firstName && 
                                       removed.lastName === member.lastName)
                        );
                    
                    // Ak je pole prázdne, odstránime celý záznam pre tento zápas
                    if (teamData.matchSpecificRemovals[selectedMatch.id].removedPlayersForMatch.length === 0 &&
                        teamData.matchSpecificRemovals[selectedMatch.id].removedStaff.length === 0) {
                        delete teamData.matchSpecificRemovals[selectedMatch.id];
                    }
                    
                    // Ak je objekt matchSpecificRemovals prázdny, odstránime ho
                    if (Object.keys(teamData.matchSpecificRemovals).length === 0) {
                        delete teamData.matchSpecificRemovals;
                    }
                }
                
                updatedTeams[teamIndex] = teamData;
                teams[categoryName] = updatedTeams;
                
                await updateDoc(userRef, { teams });
                
                // AKTUALIZUJEME LOKÁLNY STAV users
                setUsers(prevUsers => {
                    return prevUsers.map(user => {
                        if (user.id === teamDetails.userId) {
                            return {
                                ...user,
                                teams: teams
                            };
                        }
                        return user;
                    });
                });
                
                window.showGlobalNotification('Člen RT bol obnovený do súpisky', 'success');
            }
            
        } catch (error) {
            console.error('Chyba pri obnovovaní člena RT:', error);
            window.showGlobalNotification('Chyba pri obnovovaní člena RT', 'error');
        }
    };
    
    // Funkcia na odstránenie člena RT zo súpisky (NOVÁ)
    const removeStaffFromRoster = async () => {
        if (!staffToEdit || !staffTeamDetails || !staffTeam) {
            return;
        }
                
        try {
            const userRef = doc(window.db, 'users', staffTeamDetails.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                window.showGlobalNotification('Používateľ neexistuje', 'error');
                return;
            }
            
            const userData = userSnap.data();
            const teams = userData.teams || {};
            const category = selectedMatch.categoryName;
            
            const teamIdentifier = staffTeam === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
            const parts = teamIdentifier.split(' ');
            const groupAndOrder = parts.pop();
            const categoryName = parts.join(' ');
            
            let groupLetter = '';
            let order = '';
            for (let i = 0; i < groupAndOrder.length; i++) {
                const char = groupAndOrder[i];
                if (char >= '0' && char <= '9') {
                    order = groupAndOrder.substring(i);
                    groupLetter = groupAndOrder.substring(0, i);
                    break;
                }
            }
            
            const fullGroupName = `skupina ${groupLetter}`;
            const orderNum = parseInt(order, 10);
            
            const userTeams = teams[categoryName] || [];
            const teamIndex = userTeams.findIndex(t => t.groupName === fullGroupName && t.order === orderNum);
            
            if (teamIndex === -1) {
                window.showGlobalNotification('Tím nebol nájdený', 'error');
                return;
            }
            
            const updatedTeams = [...userTeams];
            const team = updatedTeams[teamIndex];
            
            // Nájdeme index člena RT v príslušnom poli podľa vlastností (nie podľa referencie)
            const staffArray = editStaffIsMen ? team.menTeamMemberDetails : team.womenTeamMemberDetails;
            const staffIndex = staffArray.findIndex(m => 
                m.firstName === staffToEdit.firstName && 
                m.lastName === staffToEdit.lastName
            );
            
            if (staffIndex === -1) {
                window.showGlobalNotification('Člen RT nebol nájdený v súpiske', 'error');
                return;
            }
            
            const removedStaff = { ...staffArray[staffIndex] };
            
            // PRIDANÉ: Uložíme informáciu o odstránení pre konkrétny zápas
            if (!team.matchSpecificRemovals) {
                team.matchSpecificRemovals = {};
            }
            
            if (!team.matchSpecificRemovals[selectedMatch.id]) {
                team.matchSpecificRemovals[selectedMatch.id] = {
                    removedPlayersForMatch: [],
                    removedStaff: []
                };
            }
            
            // Uložíme člena RT s informáciou o zápase
            team.matchSpecificRemovals[selectedMatch.id].removedStaff.push({
                ...removedStaff,
                removedAt: Timestamp.now(),
                matchId: selectedMatch.id,
                team: staffTeam,
                staffType: editStaffIsMen ? 'men' : 'women'
            });
            
            // Označíme člena RT ako odstráneného pre tento zápas
            if (editStaffIsMen) {
                if (!team.menTeamMemberDetails[staffIndex].removedForMatch) {
                    team.menTeamMemberDetails[staffIndex].removedForMatch = {};
                }
                team.menTeamMemberDetails[staffIndex].removedForMatch[selectedMatch.id] = true;
            } else {
                if (!team.womenTeamMemberDetails[staffIndex].removedForMatch) {
                    team.womenTeamMemberDetails[staffIndex].removedForMatch = {};
                }
                team.womenTeamMemberDetails[staffIndex].removedForMatch[selectedMatch.id] = true;
            }
            
            updatedTeams[teamIndex] = team;
            teams[categoryName] = updatedTeams;
            
            await updateDoc(userRef, { teams });
            
            // AKTUALIZUJEME LOKÁLNY STAV users
            setUsers(prevUsers => {
                return prevUsers.map(user => {
                    if (user.id === staffTeamDetails.userId) {
                        return {
                            ...user,
                            teams: teams
                        };
                    }
                    return user;
                });
            });
            
            window.showGlobalNotification('Člen RT bol odstránený zo súpisky pre tento zápas', 'success');
            
            setEditStaffModalOpen(false);
            setStaffToEdit(null);
            
        } catch (error) {
            console.error('Chyba pri odstraňovaní člena RT:', error);
            window.showGlobalNotification('Chyba pri odstraňovaní člena RT: ' + error.message, 'error');
        }
    };
    
    // Funkcia na obnovenie hráča do súpisky (NOVÁ)
    const restorePlayerToRoster = async (player, team, teamDetails) => {
        if (!player || !teamDetails || !team || selectedMatch?.status !== 'scheduled') return;
        
        try {
            const userRef = doc(window.db, 'users', teamDetails.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                window.showGlobalNotification('Používateľ neexistuje', 'error');
                return;
            }
            
            const userData = userSnap.data();
            const teams = userData.teams || {};
            const category = selectedMatch.categoryName;
            
            const teamIdentifier = team === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
            const parts = teamIdentifier.split(' ');
            const groupAndOrder = parts.pop();
            const categoryName = parts.join(' ');
            
            let groupLetter = '';
            let order = '';
            for (let i = 0; i < groupAndOrder.length; i++) {
                const char = groupAndOrder[i];
                if (char >= '0' && char <= '9') {
                    order = groupAndOrder.substring(i);
                    groupLetter = groupAndOrder.substring(0, i);
                    break;
                }
            }
            
            const fullGroupName = `skupina ${groupLetter}`;
            const orderNum = parseInt(order, 10);
            
            const userTeams = teams[categoryName] || [];
            const teamIndex = userTeams.findIndex(t => t.groupName === fullGroupName && t.order === orderNum);
            
            if (teamIndex === -1) {
                window.showGlobalNotification('Tím nebol nájdený', 'error');
                return;
            }
            
            const updatedTeams = [...userTeams];
            const teamData = updatedTeams[teamIndex];
            
            // Nájdeme hráča v poli playerDetails podľa jeho ID
            const playerIndex = teamData.playerDetails.findIndex(p => 
                p.firstName === player.firstName && 
                p.lastName === player.lastName && 
                p.jerseyNumber === player.jerseyNumber
            );
            
            if (playerIndex !== -1) {
                // Odstránime označenie pre tento zápas
                delete teamData.playerDetails[playerIndex].removedForMatch;
                
                // Odstránime zo zoznamu odstránených pre tento zápas
                if (teamData.matchSpecificRemovals && teamData.matchSpecificRemovals[selectedMatch.id]) {
                    teamData.matchSpecificRemovals[selectedMatch.id].removedPlayersForMatch = 
                        teamData.matchSpecificRemovals[selectedMatch.id].removedPlayersForMatch.filter(
                            removed => !(removed.firstName === player.firstName && 
                                       removed.lastName === player.lastName && 
                                       removed.jerseyNumber === player.jerseyNumber)
                        );
                    
                    // Ak je pole prázdne, odstránime celý záznam pre tento zápas
                    if (teamData.matchSpecificRemovals[selectedMatch.id].removedPlayersForMatch.length === 0 &&
                        teamData.matchSpecificRemovals[selectedMatch.id].removedStaff.length === 0) {
                        delete teamData.matchSpecificRemovals[selectedMatch.id];
                    }
                    
                    // Ak je objekt matchSpecificRemovals prázdny, odstránime ho
                    if (Object.keys(teamData.matchSpecificRemovals).length === 0) {
                        delete teamData.matchSpecificRemovals;
                    }
                }
                
                updatedTeams[teamIndex] = teamData;
                teams[categoryName] = updatedTeams;
                
                await updateDoc(userRef, { teams });
                
                // AKTUALIZUJEME LOKÁLNY STAV users
                setUsers(prevUsers => {
                    return prevUsers.map(user => {
                        if (user.id === teamDetails.userId) {
                            return {
                                ...user,
                                teams: teams
                            };
                        }
                        return user;
                    });
                });
                
                window.showGlobalNotification('Hráč bol obnovený do súpisky', 'success');
            }
            
        } catch (error) {
            console.error('Chyba pri obnovovaní hráča:', error);
            window.showGlobalNotification('Chyba pri obnovovaní hráča', 'error');
        }
    };

    // Funkcia na prepínanie zobrazenia štatistík hráčov
    const togglePlayerStats = () => {
        setShowPlayerStats(!showPlayerStats);
    };

    // Funkcia na výpočet štatistík hráčov z udalostí zápasu
    const calculatePlayerStats = (events) => {
        const stats = {};
        
        events.forEach(event => {
            if (!event.playerRef) return;
            
            // Vytvoríme unikátny kľúč pre hráča (userId + teamIdentifier + playerIndex/staffIndex)
            let playerKey;
            if (event.playerRef.staffType) {
                playerKey = `${event.playerRef.userId}_${event.playerRef.teamIdentifier}_staff_${event.playerRef.staffType}_${event.playerRef.staffIndex}`;
            } else {
                playerKey = `${event.playerRef.userId}_${event.playerRef.teamIdentifier}_player_${event.playerRef.playerIndex}`;
            }
            
            if (!stats[playerKey]) {
                // Získame meno hráča
                const playerName = getPlayerNameFromRef(event.playerRef);
                
                // Získame číslo dresu
                let jerseyNumber = '';
                if (!event.playerRef.staffType) {
                    const user = users.find(u => u.id === event.playerRef.userId);
                    if (user) {
                        const parts = event.playerRef.teamIdentifier.split(' ');
                        const groupAndOrder = parts.pop();
                        const category = parts.join(' ');
                        
                        let groupLetter = '';
                        let order = '';
                        for (let i = 0; i < groupAndOrder.length; i++) {
                            const char = groupAndOrder[i];
                            if (char >= '0' && char <= '9') {
                                order = groupAndOrder.substring(i);
                                groupLetter = groupAndOrder.substring(0, i);
                                break;
                            }
                        }
                        
                        const fullGroupName = `skupina ${groupLetter}`;
                        const orderNum = parseInt(order, 10);
                        
                        const userTeams = user.teams?.[category];
                        if (userTeams && Array.isArray(userTeams)) {
                            const team = userTeams.find(t => t.groupName === fullGroupName && t.order === orderNum);
                            if (team && team.playerDetails && event.playerRef.playerIndex !== undefined) {
                                const player = team.playerDetails[event.playerRef.playerIndex];
                                if (player && player.jerseyNumber) {
                                    jerseyNumber = player.jerseyNumber;
                                }
                            }
                        }
                    }
                }
                
                stats[playerKey] = {
                    playerRef: event.playerRef,
                    playerName: playerName,
                    jerseyNumber: jerseyNumber,
                    team: event.team, // 'home' alebo 'away'
                    isStaff: !!event.playerRef.staffType,
                    goals: 0,
                    penaltiesScored: 0,
                    penaltiesMissed: 0,
                    yellowCards: 0,
                    redCards: 0,
                    blueCards: 0,
                    exclusions: 0
                };
            }
            
            // Počítame štatistiky podľa typu udalosti
            if (event.type === 'goal') {
                stats[playerKey].goals++;
            } else if (event.type === 'penalty') {
                if (event.subType === 'scored') {
                    stats[playerKey].penaltiesScored++;
                } else if (event.subType === 'missed') {
                    stats[playerKey].penaltiesMissed++;
                }
            } else if (event.type === 'yellow') {
                stats[playerKey].yellowCards++;
            } else if (event.type === 'red') {
                stats[playerKey].redCards++;
            } else if (event.type === 'blue') {
                stats[playerKey].blueCards++;
            } else if (event.type === 'exclusion') {
                stats[playerKey].exclusions++;
            }
        });
        
        return stats;
    };

    // Funkcia na získanie štatistík pre konkrétneho hráča
    const getPlayerStats = (playerIdentifier) => {
        if (!playerIdentifier || !playerStats) return null;
        
        // Vytvoríme kľúč pre hráča
        let playerKey;
        if (playerIdentifier.isStaff) {
            playerKey = `${playerIdentifier.userId}_${playerIdentifier.teamIdentifier}_staff_${playerIdentifier.staffType}_${playerIdentifier.staffIndex}`;
        } else {
            playerKey = `${playerIdentifier.userId}_${playerIdentifier.teamIdentifier}_player_${playerIdentifier.index}`;
        }
        
        return playerStats[playerKey] || null;
    };

    // Komponent pre hlavičku tabuľky štatistík
    const StatsTableHeader = ({ showForPlayers = true, showForStaff = false }) => {
        if (!showPlayerStats) return null;
    
        return React.createElement(
            'div',
            { className: 'grid grid-cols-12 gap-1 mb-2 px-2 text-xs font-semibold text-gray-600 bg-gray-100 py-2 rounded' },
            
            // Pre hráčov - 5 stĺpcov
            showForPlayers && React.createElement(
                React.Fragment,
                null,
                React.createElement('div', { className: 'col-span-5 text-left' }, 'Meno'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'G'),
                React.createElement('div', { className: 'col-span-2 text-center' }, '7m'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'ŽK'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'ČK'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'MK'),
                React.createElement('div', { className: 'col-span-1 text-center' }, '2\'')
            ),
            
            // Pre realizačný tím - 5 stĺpcov (vrátane MK)
            showForStaff && React.createElement(
                React.Fragment,
                null,
                React.createElement('div', { className: 'col-span-8 text-left' }, 'Meno'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'ŽK'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'ČK'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'MK'),
                React.createElement('div', { className: 'col-span-1 text-center' }, '2\'')
            )
        );
    };

    const highlightEventRow = (eventId) => {
        // Ak je už rovnaký riadok zvýraznený, zrušíme zvýraznenie
        if (highlightedEventId === eventId) {
            setHighlightedEventId(null);
        } else {
            // Inak nastavíme nový zvýraznený riadok
            setHighlightedEventId(eventId);
        }
    };

    const formatMatchTime = (seconds) => {
        // Ochrana proti nečíselným hodnotám
        if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
            return '00:00';
        }
        
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Funkcie pre ovládanie času a periód
    const startMatchTimer = async (matchId) => {
        if (!window.db || !matchId) return;
        
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            await updateDoc(matchRef, {
                status: 'in-progress',
                startedAt: Timestamp.now(),
                currentPeriod: 1
            });
            window.showGlobalNotification('Čas zápasu spustený', 'success');
        } catch (error) {
//            console.error('Chyba pri spúšťaní časovača:', error);
            window.showGlobalNotification('Chyba pri spúšťaní časovača', 'error');
        }
    };
    
    const stopMatchTimer = async (matchId) => {
        if (!window.db || !matchId) return;
    
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            
            await updateDoc(matchRef, {
                status: 'paused',
                pausedAt: Timestamp.now()
            });
        
            // Zastavíme interval
            if (timerInterval) {
                clearInterval(timerInterval);
                setTimerInterval(null);
            }
        
            setMatchPaused(true);
            window.showGlobalNotification('Čas zápasu pozastavený', 'success');
        } catch (error) {
//            console.error('Chyba pri pozastavovaní časovača:', error);
            window.showGlobalNotification('Chyba pri pozastavovaní časovača', 'error');
        }
    };
    
    const resumeMatchTimer = async (matchId) => {
        if (!window.db || !matchId) return;
    
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            
            if (selectedMatch && selectedMatch.pausedAt && selectedMatch.startedAt) {
                const now = Timestamp.now();
                const pausedAt = selectedMatch.pausedAt;
                const startedAt = selectedMatch.startedAt;
                
                // Čas, ktorý uplynul do pozastavenia
                const elapsedBeforePause = pausedAt.seconds - startedAt.seconds;
                
                // Nový startedAt nastavíme tak, aby elapsedSeconds od nového startedAt do now
                // bol rovný elapsedBeforePause
                const newStartedAtSeconds = now.seconds - elapsedBeforePause;
                
                await updateDoc(matchRef, {
                    status: 'in-progress',
                    pausedAt: null,
                    startedAt: new Timestamp(newStartedAtSeconds, 0)
                });
            } else {
                await updateDoc(matchRef, {
                    status: 'in-progress',
                    pausedAt: null
                });
            }
            
            setMatchPaused(false);
            window.showGlobalNotification('Čas zápasu obnovený', 'success');
        } catch (error) {
//            console.error('Chyba pri obnovovaní časovača:', error);
            window.showGlobalNotification('Chyba pri obnovovaní časovača', 'error');
        }
    };

    const endMatch = async (matchId) => {
        setEndMatchId(matchId);
        setEndMatchModalOpen(true);
    };

    const revertMatchToInProgress = async (matchId) => {
        if (!window.db || !matchId) return;
        
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = categories.find(c => c.name === selectedMatch?.categoryName);
        
        // Vypočítame maximálny možný čas zápasu (v sekundách)
        const maxMatchTime = (currentCategory?.periods || 2) * (currentCategory?.periodDuration || 20) * 60;
        
        let newOffset = 0;
        let startedAtValue = null;
        
        // Ak máme selectedMatch a startedAt, vypočítame offset
        if (selectedMatch && selectedMatch.startedAt) {
            const now = Timestamp.now();
            const startedAt = selectedMatch.startedAt;
            const baseSeconds = Math.floor((now.seconds - startedAt.seconds));
            newOffset = maxMatchTime - baseSeconds;
            startedAtValue = selectedMatch.startedAt;
        } else {
            // Ak nemáme startedAt, nastavíme startedAt na aktuálny čas a offset = maxMatchTime
            startedAtValue = Timestamp.now();
            newOffset = maxMatchTime;
        }
        
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            const updateData = {
                status: 'paused',        // ZMENENÉ: z 'in-progress' na 'paused'
                endedAt: null,
                pausedAt: Timestamp.now(), // Nastavíme čas pozastavenia na aktuálny čas
                manualTimeOffset: newOffset,
                updatedAt: Timestamp.now()
            };
            
            // Ak nemáme startedAt, nastavíme ho
            if (!selectedMatch?.startedAt) {
                updateData.startedAt = startedAtValue;
            }
            
            await updateDoc(matchRef, updateData);
            
            // Aktualizujeme lokálne stavy
            setMatchTime(maxMatchTime);
            setCleanPlayingTime(maxMatchTime);
            setManualTimeOffset(newOffset);
            setMatchPaused(true);  // Nastavíme, že zápas je pozastavený
            
            window.showGlobalNotification('Zápas bol obnovený do stavu "Pozastavené" s maximálnym časom', 'success');
        } catch (error) {
            console.error('Chyba pri obnovovaní zápasu:', error);
            window.showGlobalNotification('Chyba pri obnovovaní zápasu', 'error');
        }
    };

    // ============================================================================
    // OPRAVA 1: UPRAVIŤ FUNKCIU confirmForfeitMatch
    // ============================================================================
    
    const confirmForfeitMatch = async () => {
        if (!window.db || !forfeitMatchId || !forfeitTeam) return;
        
        try {
            const matchRef = doc(window.db, 'matches', forfeitMatchId);
            
            // Nastavíme výsledok 10:0 pre vybraný tím
            let homeScore = 0;
            let awayScore = 0;
            
            if (forfeitTeam === 'home') {
                homeScore = 10;
                awayScore = 0;
            } else {
                homeScore = 0;
                awayScore = 10;
            }
            
            await updateDoc(matchRef, {
                status: 'completed',
                endedAt: Timestamp.now(),
                forfeitResult: {
                    winner: forfeitTeam,
                    home: homeScore,
                    away: awayScore,
                    isForfeit: true
                },
                finalScore: {
                    home: homeScore,
                    away: awayScore
                }
            });
            
            // Vymažeme všetky existujúce udalosti zápasu (ak nejaké sú)
            const eventsRef = collection(window.db, 'matchEvents');
            const q = query(eventsRef, where("matchId", "==", forfeitMatchId));
            const querySnapshot = await getDocs(q);
            
            const deletePromises = [];
            querySnapshot.forEach((doc) => {
                deletePromises.push(deleteDoc(doc.ref));
            });
            
            await Promise.all(deletePromises);
            
            // Získame názvy tímov pre zobrazenie v udalosti
            const homeTeamName = getTeamNameByIdentifier(selectedMatch?.homeTeamIdentifier);
            const awayTeamName = getTeamNameByIdentifier(selectedMatch?.awayTeamIdentifier);
            
            // Pridáme udalosť o kontumácii
            await addDoc(eventsRef, {
                matchId: forfeitMatchId,
                type: 'forfeit',
                team: forfeitTeam,
                minute: 0,
                second: 0,
                formattedTime: '00:00',
                timestamp: Timestamp.now(),
                createdBy: userProfileData?.email || 'unknown',
                createdByUid: userProfileData?.uid || null,
                scoreBefore: { home: 0, away: 0 },
                scoreAfter: { home: homeScore, away: awayScore },
                forfeitInfo: {
                    winnerTeam: forfeitTeam === 'home' ? homeTeamName : awayTeamName,
                    loserTeam: forfeitTeam === 'home' ? awayTeamName : homeTeamName,
                    result: `${homeScore}:${awayScore}`,
                    reason: 'Kontumácia zápasu'
                }
            });
            
            const winnerName = forfeitTeam === 'home' ? homeTeamName : awayTeamName;
            window.showGlobalNotification(`Zápas bol kontumovaný 10:0 v prospech tímu ${winnerName}`, 'success');
            
            // Aktualizujeme lokálne stavy
            setMatchScore({ home: homeScore, away: awayScore });
            setMatchEvents([]);
            
            // Aktualizujeme selectedMatch v React stave
            if (window.__reactSelectedMatchSetter && typeof window.__reactSelectedMatchSetter === 'function') {
                const updatedMatchSnap = await getDoc(matchRef);
                if (updatedMatchSnap.exists()) {
                    window.__reactSelectedMatchSetter({ id: forfeitMatchId, ...updatedMatchSnap.data() });
                }
            }
            
        } catch (error) {
            console.error('Chyba pri kontumácii zápasu:', error);
            window.showGlobalNotification('Chyba pri kontumácii zápasu', 'error');
        }
    };

    const confirmManualScore = async () => {
        if (!window.db || !manualScoreMatchId) return;
        
        const homeScoreNum = parseInt(manualHomeScore, 10);
        const awayScoreNum = parseInt(manualAwayScore, 10);
        
        if (isNaN(homeScoreNum) || isNaN(awayScoreNum)) {
            window.showGlobalNotification('Zadajte platné čísla pre výsledok', 'error');
            return;
        }
        
        if (homeScoreNum < 0 || awayScoreNum < 0) {
            window.showGlobalNotification('Skóre nemôže byť záporné', 'error');
            return;
        }
        
        try {
            const matchRef = doc(window.db, 'matches', manualScoreMatchId);
            
            // Získame aktuálne dáta zápasu
            const matchSnap = await getDoc(matchRef);
            const matchData = matchSnap.exists() ? matchSnap.data() : {};
            
            // Ak už zápas má udalosti, nezabudneme na ne
            const hasEvents = matchEvents.length > 0;
            
            // Aktualizujeme zápas
            await updateDoc(matchRef, {
                status: 'completed',
                endedAt: Timestamp.now(),
                finalScore: {
                    home: homeScoreNum,
                    away: awayScoreNum
                },
                // Ak bol zápas kontumovaný, odstránime kontumačné polia
                forfeitResult: null,
                updatedAt: Timestamp.now()
            });
            
            // Ak nemáme udalosti, vytvoríme aspoň základnú udalosť o výsledku
            if (!hasEvents) {
                const eventsRef = collection(window.db, 'matchEvents');
                await addDoc(eventsRef, {
                    matchId: manualScoreMatchId,
                    type: 'manual_result',
                    minute: 0,
                    second: 0,
                    formattedTime: '00:00',
                    timestamp: Timestamp.now(),
                    createdBy: userProfileData?.email || 'unknown',
                    createdByUid: userProfileData?.uid || null,
                    manualResult: {
                        home: homeScoreNum,
                        away: awayScoreNum
                    }
                });
            }
            
            // Aktualizujeme lokálny stav
            setMatchScore({ home: homeScoreNum, away: awayScoreNum });
            
            // Aktualizujeme selectedMatch v React stave
            if (window.__reactSelectedMatchSetter && typeof window.__reactSelectedMatchSetter === 'function') {
                const updatedMatchSnap = await getDoc(matchRef);
                if (updatedMatchSnap.exists()) {
                    window.__reactSelectedMatchSetter({ id: manualScoreMatchId, ...updatedMatchSnap.data() });
                }
            }
            
            window.showGlobalNotification(`Výsledok ${homeScoreNum}:${awayScoreNum} bol uložený`, 'success');
            
        } catch (error) {
            console.error('Chyba pri ukladaní manuálneho výsledku:', error);
            window.showGlobalNotification('Chyba pri ukladaní výsledku', 'error');
        }
    };

    const confirmEndMatch = async () => {
        if (!window.db || !endMatchId) return;
        
        try {
            const matchRef = doc(window.db, 'matches', endMatchId);
            await updateDoc(matchRef, {
                status: 'completed',
                endedAt: Timestamp.now()
            });
            window.showGlobalNotification('Zápas bol ukončený', 'success');
        } catch (error) {
//            console.error('Chyba pri ukončovaní zápasu:', error);
            window.showGlobalNotification('Chyba pri ukončovaní zápasu', 'error');
        }
    };
    
    const resetMatchTimer = async (matchId, deleteEvents = false) => {
        if (!window.db || !matchId) return;
        
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            
            // Získame aktuálne dáta zápasu pred resetom
            const matchSnap = await getDoc(matchRef);
            const matchData = matchSnap.exists() ? matchSnap.data() : {};
            
            // Príprava update dát - základné resetovanie
            const updateData = {
                status: 'scheduled',
                startedAt: null,
                endedAt: null,
                pausedAt: null,
                currentPeriod: 1,
                manualTimeOffset: 0,
                updatedAt: Timestamp.now()
            };
            
            // AK BOL ZÁPAS KONTUMOVANÝ, ODSTRÁNIME KONTUMAČNÉ POLIA
            if (matchData.forfeitResult) {
                updateData.forfeitResult = null;
            }
            
            // Odstránime aj finalScore ak existuje (kontumácia ho vytvorila)
            if (matchData.finalScore) {
                updateData.finalScore = null;
            }
            
            await updateDoc(matchRef, updateData);
            
            // Vynulujeme lokálne stavy
            setMatchTime(0);
            setManualTimeOffset(0);
            setMatchScore({ home: 0, away: 0 });
            
            // Zastavíme interval
            if (timerInterval) {
                clearInterval(timerInterval);
                setTimerInterval(null);
            }
            
            // Vymažeme aj všetky udalosti zápasu (voliteľné)
            if (deleteEvents) {
                const eventsRef = collection(window.db, 'matchEvents');
                const q = query(eventsRef, where("matchId", "==", matchId));
                const querySnapshot = await getDocs(q);
                
                const deletePromises = [];
                querySnapshot.forEach((doc) => {
                    deletePromises.push(deleteDoc(doc.ref));
                });
                
                await Promise.all(deletePromises);
                window.showGlobalNotification('Všetky udalosti zápasu boli vymazané', 'success');
            }
            
            setMatchPaused(false);
            window.showGlobalNotification('Čas zápasu resetovaný' + (matchData.forfeitResult ? ' (kontumácia zrušená)' : ''), 'success');
            
            // Ak máme React setter pre selectedMatch, aktualizujeme ho
            if (window.__reactSelectedMatchSetter && typeof window.__reactSelectedMatchSetter === 'function') {
                const updatedMatchSnap = await getDoc(matchRef);
                if (updatedMatchSnap.exists()) {
                    window.__reactSelectedMatchSetter({ id: matchId, ...updatedMatchSnap.data() });
                }
            }
            
        } catch (error) {
            console.error('Chyba pri resetovaní časovača:', error);
            window.showGlobalNotification('Chyba pri resetovaní časovača', 'error');
        }
    };
    
    // Pridajte funkciu pre otvorenie reset modálneho okna
    const openResetModal = (matchId) => {
        setResetMatchId(matchId);
        setResetModalOpen(true);
    };
    
    const increasePeriod = async (matchId, maxPeriods) => {
        if (!window.db || !matchId || !selectedMatch) return;
        
        const currentPeriod = selectedMatch.currentPeriod || 1;
        if (currentPeriod >= maxPeriods) {
            window.showGlobalNotification('Posledná perióda', 'info');
            return;
        }
        
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            await updateDoc(matchRef, {
                currentPeriod: currentPeriod + 1
            });
            window.showGlobalNotification(`Perióda zmenená na ${currentPeriod + 1}`, 'success');
        } catch (error) {
//            console.error('Chyba pri zvyšovaní periódy:', error);
            window.showGlobalNotification('Chyba pri zmene periódy', 'error');
        }
    };
    
    const decreasePeriod = async (matchId) => {
        if (!window.db || !matchId || !selectedMatch) return;
        
        const currentPeriod = selectedMatch.currentPeriod || 1;
        if (currentPeriod <= 1) {
            window.showGlobalNotification('Prvá perióda', 'info');
            return;
        }
        
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            await updateDoc(matchRef, {
                currentPeriod: currentPeriod - 1
            });
            window.showGlobalNotification(`Perióda zmenená na ${currentPeriod - 1}`, 'success');
        } catch (error) {
//            console.error('Chyba pri znižovaní periódy:', error);
            window.showGlobalNotification('Chyba pri zmene periódy', 'error');
        }
    };
    
    // ZJEDNODUŠENÁ FUNKCIA: Konverzia (už nie je potrebná, ale ponecháme pre kompatibilitu)
    const convertTotalToCleanTime = (totalSeconds, category) => {
        return totalSeconds; // Čistý čas = celkový čas
    };

    // ZJEDNODUŠENÁ FUNKCIA: addMinute
    const addMinute = () => {
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = selectedMatch ? categories.find(c => c.name === selectedMatch.categoryName) : null;
        
        if (!currentCategory) {
            window.showGlobalNotification('Nie je možné určiť kategóriu zápasu', 'error');
            return;
        }
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
        
        // Vypočítame, koľko sekúnd uplynulo od začiatku aktuálnej periódy
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Skontrolujeme, či po pridaní minúty nepresiahneme koniec periódy
        if (elapsedInPeriod + 60 > periodDuration) {
            const remainingSeconds = periodDuration - elapsedInPeriod;
            const remainingMinutes = Math.floor(remainingSeconds / 60);
            const remainingSecs = remainingSeconds % 60;
            
            let message = `Nie je možné pridať celú minútu - do konca ${currentPeriod}. periódy zostáva len ${remainingMinutes}:${remainingSecs.toString().padStart(2, '0')}`;
            window.showGlobalNotification(message, 'error');
            return;
        }
        
        // Vypočítame nový čas
        const newTotalTime = matchTime + 60;
        
        // Vypočítame nový offset
        let newOffset;
        if (selectedMatch) {
            if (selectedMatch.status === 'paused' && selectedMatch.pausedAt && selectedMatch.startedAt) {
                const pausedAt = selectedMatch.pausedAt;
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((pausedAt.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            } else if (selectedMatch.startedAt) {
                const now = Timestamp.now();
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((now.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            }
        }
        
        // Uložíme do databázy
        if (selectedMatch && window.db && newOffset !== undefined) {
            const matchRef = doc(window.db, 'matches', selectedMatch.id);
            updateDoc(matchRef, {
                manualTimeOffset: newOffset
            }).catch(error => {
//                console.error('Chyba pri ukladaní offsetu:', error)
            });
        }
        
        // Aktualizujeme stavy
        setMatchTime(newTotalTime);
        setCleanPlayingTime(newTotalTime);
        if (newOffset !== undefined) {
            setManualTimeOffset(newOffset);
        }
    };
    
    // UPRAVENÁ FUNKCIA: subtractMinute
    const subtractMinute = () => {
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = selectedMatch ? categories.find(c => c.name === selectedMatch.categoryName) : null;
        
        if (!currentCategory) {
            window.showGlobalNotification('Nie je možné určiť kategóriu zápasu', 'error');
            return;
        }
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
        
        // Vypočítame, koľko sekúnd uplynulo od začiatku aktuálnej periódy
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Skontrolujeme, či po odčítaní minúty neklesneme pod začiatok aktuálnej periódy
        if (elapsedInPeriod < 60) {
            if (elapsedInPeriod === 0) {
                window.showGlobalNotification(`Nie je možné odčítať minútu - sme na začiatku ${currentPeriod}. periódy`, 'error');
            } else {
                window.showGlobalNotification(`Nie je možné odčítať celú minútu - od začiatku ${currentPeriod}. periódy uplynulo len ${formatMatchTime(elapsedInPeriod)}`, 'error');
            }
            return;
        }
        
        // Vypočítame nový čas
        const newTotalTime = matchTime - 60;
        
        // Vypočítame nový offset
        let newOffset;
        if (selectedMatch) {
            if (selectedMatch.status === 'paused' && selectedMatch.pausedAt && selectedMatch.startedAt) {
                const pausedAt = selectedMatch.pausedAt;
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((pausedAt.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            } else if (selectedMatch.startedAt) {
                const now = Timestamp.now();
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((now.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            }
        }
        
        // Uložíme do databázy
        if (selectedMatch && window.db && newOffset !== undefined) {
            const matchRef = doc(window.db, 'matches', selectedMatch.id);
            updateDoc(matchRef, {
                manualTimeOffset: newOffset
            }).catch(error => {
//                 console.error('Chyba pri ukladaní offsetu:', error)
            });
        }
        
        // Aktualizujeme stavy
        setMatchTime(newTotalTime);
        setCleanPlayingTime(newTotalTime);
        if (newOffset !== undefined) {
            setManualTimeOffset(newOffset);
        }
    };
    
    // UPRAVENÁ FUNKCIA: addSecond
    const addSecond = () => {
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = selectedMatch ? categories.find(c => c.name === selectedMatch.categoryName) : null;
        
        if (!currentCategory) {
            window.showGlobalNotification('Nie je možné určiť kategóriu zápasu', 'error');
            return;
        }
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
        
        // Vypočítame, koľko sekúnd uplynulo od začiatku aktuálnej periódy
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Skontrolujeme, či po pridaní sekundy nepresiahneme koniec periódy
        if (elapsedInPeriod + 1 > periodDuration) {
            const remainingSeconds = periodDuration - elapsedInPeriod;
            window.showGlobalNotification(`Nie je možné pridať sekundu - do konca ${currentPeriod}. periódy zostáva už len ${remainingSeconds} sekúnd`, 'error');
            return;
        }
        
        // Vypočítame nový čas
        const newTotalTime = matchTime + 1;
        
        // Vypočítame nový offset
        let newOffset;
        if (selectedMatch) {
            if (selectedMatch.status === 'paused' && selectedMatch.pausedAt && selectedMatch.startedAt) {
                const pausedAt = selectedMatch.pausedAt;
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((pausedAt.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            } else if (selectedMatch.startedAt) {
                const now = Timestamp.now();
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((now.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            }
        }
        
        // Uložíme do databázy
        if (selectedMatch && window.db && newOffset !== undefined) {
            const matchRef = doc(window.db, 'matches', selectedMatch.id);
            updateDoc(matchRef, {
                manualTimeOffset: newOffset
            }).catch(error => {
//                console.error('Chyba pri ukladaní offsetu:', error)
            });
        }
        
        // Aktualizujeme stavy
        setMatchTime(newTotalTime);
        setCleanPlayingTime(newTotalTime);
        if (newOffset !== undefined) {
            setManualTimeOffset(newOffset);
        }
    };
    
    // UPRAVENÁ FUNKCIA: subtractSecond
    const subtractSecond = () => {
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = selectedMatch ? categories.find(c => c.name === selectedMatch.categoryName) : null;
        
        if (!currentCategory) {
            window.showGlobalNotification('Nie je možné určiť kategóriu zápasu', 'error');
            return;
        }
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
        
        // Vypočítame, koľko sekúnd uplynulo od začiatku aktuálnej periódy
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Skontrolujeme, či po odčítaní sekundy neklesneme pod začiatok aktuálnej periódy
        if (elapsedInPeriod < 1) {
            window.showGlobalNotification(`Nie je možné odčítať sekundu - sme na začiatku ${currentPeriod}. periódy`, 'error');
            return;
        }
        
        // Vypočítame nový čas
        const newTotalTime = matchTime - 1;
        
        // Vypočítame nový offset
        let newOffset;
        if (selectedMatch) {
            if (selectedMatch.status === 'paused' && selectedMatch.pausedAt && selectedMatch.startedAt) {
                const pausedAt = selectedMatch.pausedAt;
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((pausedAt.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            } else if (selectedMatch.startedAt) {
                const now = Timestamp.now();
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((now.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            }
        }
        
        // Uložíme do databázy
        if (selectedMatch && window.db && newOffset !== undefined) {
            const matchRef = doc(window.db, 'matches', selectedMatch.id);
            updateDoc(matchRef, {
                manualTimeOffset: newOffset
            }).catch(error => {
//                console.error('Chyba pri ukladaní offsetu:', error)
            });
        }
        
        // Aktualizujeme stavy
        setMatchTime(newTotalTime);
        setCleanPlayingTime(newTotalTime);
        if (newOffset !== undefined) {
            setManualTimeOffset(newOffset);
        }
    };

    // NOVÁ FUNKCIA PRE KONTROLU, ČI JE ZÁPAS V STAVE POVOĽUJÚCOM AKCIE
    const isMatchActionAllowed = () => {
        if (!selectedMatch) return false;
        // Akcie sú povolené len keď je zápas v priebehu (in-progress) alebo pozastavený (paused)
        return selectedMatch.status === 'in-progress' || selectedMatch.status === 'paused';
    };

    // UPRAVENÁ FUNKCIA PRE KONTROLU POVOLENIA TLAČIDLA POKRAČOVAŤ
    const isResumeAllowed = () => {
        if (!selectedMatch) return false;
    
        // Ak je zápas ukončený, tlačidlo nie je povolené
        if (selectedMatch.status === 'completed') return false;
    
        // Kontrola, či je zápas v stave 'paused'
        if (selectedMatch.status !== 'paused') return false;
    
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
    
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
    
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
    
        // Povolené, ak nie sme na konci periódy (ak by po pridaní 1 sekundy nepresiahli koniec)
        return elapsedInPeriod < periodDuration;
    };

    // UPRAVENÉ FUNKCIE PRE KONTROLU POVOLENIA TLAČIDIEL PRE PERIÓDU
    const isDecreasePeriodAllowed = () => {
        if (!selectedMatch) return false;
        
        const currentPeriod = selectedMatch.currentPeriod || 1;
        if (currentPeriod <= 1) return false; // Už sme v prvej perióde
        
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Povolené len ak sme na začiatku aktuálnej periódy (elapsedInPeriod === 0)
        // ALEBO na konci predchádzajúcej periódy (čo je vlastne začiatok aktuálnej)
        return elapsedInPeriod === 0;
    };
    
    const isIncreasePeriodAllowed = () => {
        if (!selectedMatch) return false;
        
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
        
        const currentPeriod = selectedMatch.currentPeriod || 1;
        const maxPeriods = currentCategory.periods || 2;
        
        if (currentPeriod >= maxPeriods) return false; // Už sme v poslednej perióde
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Povolené len ak sme na konci aktuálnej periódy (elapsedInPeriod === periodDuration)
        return elapsedInPeriod === periodDuration;
    };

    const isAddMinuteAllowed = () => {
        if (!selectedMatch) return false;
        
        // Ak je zápas ukončený, tlačidlo nie je povolené
        if (selectedMatch.status === 'completed') return false;
        
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
    
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Povolené, ak po pridaní minúty nepresiahneme koniec periódy
        return elapsedInPeriod + 60 <= periodDuration;
    };
    
    const isSubtractMinuteAllowed = () => {
        if (!selectedMatch) return false;
    
        // Ak je zápas ukončený, tlačidlo nie je povolené
        if (selectedMatch.status === 'completed') return false;
    
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
    
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
        
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Povolené, ak po odčítaní minúty neklesneme pod začiatok periódy
        return elapsedInPeriod >= 60;
    };
    
    const isAddSecondAllowed = () => {
        if (!selectedMatch) return false;
    
        // Ak je zápas ukončený, tlačidlo nie je povolené
        if (selectedMatch.status === 'completed') return false;
        
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
    
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Povolené, ak po pridaní sekundy nepresiahneme koniec periódy
        return elapsedInPeriod + 1 <= periodDuration;
    };
    
    const isSubtractSecondAllowed = () => {
        if (!selectedMatch) return false;
    
        // Ak je zápas ukončený, tlačidlo nie je povolené
        if (selectedMatch.status === 'completed') return false;
        
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
        
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Povolené, ak po odčítaní sekundy neklesneme pod začiatok periódy
        return elapsedInPeriod >= 1;
    };

    const isStartTimerAllowed = () => {
        if (!selectedMatch) return false;
    
        // Povolené len pre zápasy v stave 'scheduled' (Naplánované)
        return selectedMatch.status === 'scheduled';
    };

    // Načítanie skupín z databázy
    useEffect(() => {
        if (!window.db) return;

        const groupsRef = doc(window.db, 'settings', 'groups');
        const unsubscribe = onSnapshot(groupsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setGroupsData(data);
                // Uložíme aj do window pre prístup z iných častí
                window.groupsData = data;
                console.log('📋 Načítané groupsData:', data);
            } else {
                setGroupsData({});
                window.groupsData = {};
                console.log('⚠️ Žiadne groupsData v databáze');
            }
        }, (error) => {
            console.error('Chyba pri načítaní skupín:', error);
        });
        
        return () => unsubscribe();
    }, []);

    // Pridajte tento useEffect do matchesHallApp komponentu -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
    useEffect(() => {
        window.registerMatchSetter(setSelectedMatch);
        window.registerUsersSetter(setUsers);
        window.__reactUsersState = users;
        return () => {
            window.__reactSelectedMatchSetter = null;
            window.__reactUsersSetter = null;
        };
    }, []);
    
    useEffect(() => {
        window.__reactUsersState = users;
    }, [users]);

    // Pridajte tento useEffect do matchesHallApp komponentu -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

    useEffect(() => { // ------------------------------------------------ ODSTRÁŇ TENTO USEFFECT - IBA VYPISUJE DO KONZOLY
        if (!selectedMatch) return;
        
        // Počkáme malé oneskorenie, aby sa načítali všetky dáta (users, categories)
        const timer = setTimeout(async () => {
            const homeTeamName = getTeamNameByIdentifier(selectedMatch.homeTeamIdentifier);
            const awayTeamName = getTeamNameByIdentifier(selectedMatch.awayTeamIdentifier);
            
            // Získanie ID tímov z databázy
            let homeTeamDatabaseId = null;
            let awayTeamDatabaseId = null;
            
            // Skúsime nájsť tím v používateľských dátach
            if (users && users.length > 0) {
                // Pre domáci tím
                const homeTeamDetails = getTeamDetailsFromIdentifier(selectedMatch.homeTeamIdentifier);
                if (homeTeamDetails && homeTeamDetails.userId) {
                    homeTeamDatabaseId = homeTeamDetails.userId;
                }
                
                // Pre hosťovský tím
                const awayTeamDetails = getTeamDetailsFromIdentifier(selectedMatch.awayTeamIdentifier);
                if (awayTeamDetails && awayTeamDetails.userId) {
                    awayTeamDatabaseId = awayTeamDetails.userId;
                }
            }
            
            // Ak sme nenašli ID cez getTeamDetails, skúsime vyhľadať v superstructureTeams
            if (!homeTeamDatabaseId && superstructureTeams) {
                const parts = selectedMatch.homeTeamIdentifier?.split(' ') || [];
                if (parts.length >= 2) {
                    const groupAndOrder = parts.pop();
                    const category = parts.join(' ');
                    
                    let groupLetter = '';
                    let order = '';
                    for (let i = 0; i < groupAndOrder.length; i++) {
                        const char = groupAndOrder[i];
                        if (char >= '0' && char <= '9') {
                            order = groupAndOrder.substring(i);
                            groupLetter = groupAndOrder.substring(0, i);
                            break;
                        }
                    }
                    
                    const fullGroupName = `skupina ${groupLetter}`;
                    const orderNum = parseInt(order, 10);
                    
                    const categoryTeams = superstructureTeams[category];
                    if (categoryTeams && Array.isArray(categoryTeams)) {
                        const team = categoryTeams.find(t => 
                            t.groupName === fullGroupName && 
                            t.order === orderNum
                        );
                        if (team && team.teamId) {
                            homeTeamDatabaseId = team.teamId;
                        }
                    }
                }
            }
            
            if (!awayTeamDatabaseId && superstructureTeams) {
                const parts = selectedMatch.awayTeamIdentifier?.split(' ') || [];
                if (parts.length >= 2) {
                    const groupAndOrder = parts.pop();
                    const category = parts.join(' ');
                    
                    let groupLetter = '';
                    let order = '';
                    for (let i = 0; i < groupAndOrder.length; i++) {
                        const char = groupAndOrder[i];
                        if (char >= '0' && char <= '9') {
                            order = groupAndOrder.substring(i);
                            groupLetter = groupAndOrder.substring(0, i);
                            break;
                        }
                    }
                    
                    const fullGroupName = `skupina ${groupLetter}`;
                    const orderNum = parseInt(order, 10);
                    
                    const categoryTeams = superstructureTeams[category];
                    if (categoryTeams && Array.isArray(categoryTeams)) {
                        const team = categoryTeams.find(t => 
                            t.groupName === fullGroupName && 
                            t.order === orderNum
                        );
                        if (team && team.teamId) {
                            awayTeamDatabaseId = team.teamId;
                        }
                    }
                }
            }
            
            // Výpis do konzoly
            console.log('\n' + '='.repeat(80));
            console.log('📋 AKTUÁLNE NAČÍTANÝ ZÁPAS');
            console.log('='.repeat(80));
            console.log(`🆔 ID zápasu: ${selectedMatch.id}`);
            console.log(`📅 Dátum: ${selectedMatch.scheduledTime ? formatDateWithDay(selectedMatch.scheduledTime.toDate()) : 'neurčený'}`);
            console.log(`⏰ Čas: ${selectedMatch.scheduledTime ? formatTime(selectedMatch.scheduledTime) : '--:--'}`);
            console.log(`🏷️ Kategória: ${selectedMatch.categoryName || 'neurčená'}`);
            console.log(`📊 Status: ${selectedMatch.status || 'neurčený'}`);
            console.log('-'.repeat(80));
            
            // Domáci tím
            console.log('\n🏠 DOMÁCI TÍM:');
            console.log(`   📛 Názov: ${homeTeamName}`);
            console.log(`   🔑 Identifikátor: ${selectedMatch.homeTeamIdentifier}`);
            console.log(`   🆔 ID v databáze: ${homeTeamDatabaseId || 'Nenájdené'}`);
            
            // Hosťovský tím
            console.log('\n✈️ HOSŤOVSKÝ TÍM:');
            console.log(`   📛 Názov: ${awayTeamName}`);
            console.log(`   🔑 Identifikátor: ${selectedMatch.awayTeamIdentifier}`);
            console.log(`   🆔 ID v databáze: ${awayTeamDatabaseId || 'Nenájdené'}`);
            
            // Výpis všetkých dostupných informácií o tímoch z users
            if (users && users.length > 0) {
//                console.log('\n👥 POUŽÍVATELIA S TÍMMI:');
                for (const user of users) {
                    if (user.teams && Object.keys(user.teams).length > 0) {
//                        console.log(`\n   📧 ${user.email} (ID: ${user.id})`);
                        for (const [category, teamsArray] of Object.entries(user.teams)) {
                            if (Array.isArray(teamsArray) && teamsArray.length > 0) {
//                                console.log(`      Kategória: ${category}`);
                                teamsArray.forEach(team => {
//                                    console.log(`         - ${team.teamName} (skupina: ${team.groupName}, poradie: ${team.order})`);
                                });
                            }
                        }
                    }
                }
            }
            
            console.log('\n' + '='.repeat(80) + '\n');
            
        }, 2500); // Oneskoríme o 500ms, aby sa načítali všetky potrebné dáta
        
        return () => clearTimeout(timer);
    }, [selectedMatch, users, superstructureTeams]);
    

    useEffect(() => {
        if (!window.db) return;
    
        const superstructureDocRef = doc(window.db, 'settings', 'superstructureGroups');
        const unsubscribe = onSnapshot(superstructureDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setSuperstructureTeams(docSnap.data());
            }
        });
        
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Skontrolujeme, či už je teamManager dostupný
        if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
            setTeamManagerReady(true);
            return;
        }
        
        // Počkáme na udalosť teamManagerUpdate
        const handleTeamManagerUpdate = () => {
            if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                setTeamManagerReady(true);
            }
        };
        
        window.addEventListener('teamManagerUpdate', handleTeamManagerUpdate);
        
        // Timeout pre prípad, že sa teamManager nenačíta
        const timeout = setTimeout(() => {
            setTeamManagerReady(true);
        }, 5000);
        
        return () => {
            window.removeEventListener('teamManagerUpdate', handleTeamManagerUpdate);
            clearTimeout(timeout);
        };
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            // Sledujeme tlačidlo "Všetky zápasy" (je v hornej časti)
            const backButton = document.querySelector('.absolute.left-4.top-4');
            
            if (backButton) {
                const rect = backButton.getBoundingClientRect();
                // Keď je tlačidlo mimo viewport (hore), zobrazíme plávajúci box
                if (rect.bottom < 0) {
                    setShowFloatingScore(true);
                } else {
                    setShowFloatingScore(false);
                }
            } else {
                // Fallback - sledujeme box s priebehom zápasu
                const matchSection = document.querySelector('.match-progress-section');
                if (matchSection) {
                    const rect = matchSection.getBoundingClientRect();
                    if (rect.top < 100) {
                        setShowFloatingScore(true);
                    } else {
                        setShowFloatingScore(false);
                    }
                }
            }
        };
        
        setTimeout(handleScroll, 100);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [selectedMatch]);

    // Prepočítanie štatistík hráčov pri zmene udalostí
    useEffect(() => {
        if (matchEvents.length > 0) {
            const stats = calculatePlayerStats(matchEvents);
            setPlayerStats(stats);
        } else {
            setPlayerStats({});
        }
    }, [matchEvents]);

    // ============================================================================
    // OPRAVA 3: UPRAVIŤ useEffect PRE SLEDOVANIE UKONČENÝCH ZÁPASOV (v zozname)
    // ============================================================================
    
    useEffect(() => {
        if (!window.db || matches.length === 0) return;
    
        const completedMatches = matches.filter(m => m.status === 'completed');
        
        if (completedMatches.length === 0) {
            setCompletedMatchData({});
            return;
        }
    
        const fetchCompletedMatches = async () => {
            const newData = {};
            let hasNewCompletion = false;
            
            for (const match of completedMatches) {
                // KONTROLA NA KONTUMÁCIU
                if (match.forfeitResult && match.forfeitResult.isForfeit) {
                    newData[match.id] = {
                        time: 0,
                        homeScore: match.forfeitResult.home,
                        awayScore: match.forfeitResult.away,
                        status: 'completed',
                        isForfeit: true
                    };
                    if (!completedMatchData[match.id] || 
                        completedMatchData[match.id].homeScore !== match.forfeitResult.home ||
                        completedMatchData[match.id].awayScore !== match.forfeitResult.away) {
                        hasNewCompletion = true;
                    }
                    continue;
                }
                
                // 🔥 KONTROLA NA MANUÁLNY VÝSLEDOK (finalScore)
                if (match.finalScore && !match.forfeitResult) {
                    newData[match.id] = {
                        time: 0,
                        homeScore: match.finalScore.home,
                        awayScore: match.finalScore.away,
                        status: 'completed',
                        isManual: true
                    };
                    if (!completedMatchData[match.id] || 
                        completedMatchData[match.id].homeScore !== match.finalScore.home ||
                        completedMatchData[match.id].awayScore !== match.finalScore.away) {
                        hasNewCompletion = true;
                    }
                    continue;
                }
                
                // Inak normálne udalosti
                try {
                    const eventsRef = collection(window.db, 'matchEvents');
                    const q = query(eventsRef, where("matchId", "==", match.id));
                    const querySnapshot = await getDocs(q);
                    
                    let homeScore = 0;
                    let awayScore = 0;
                    let matchTime = 0;
                    
                    querySnapshot.forEach((doc) => {
                        const event = doc.data();
                        
                        if (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) {
                            if (event.team === 'home') homeScore++;
                            else if (event.team === 'away') awayScore++;
                        }
                        
                        if (event.minute !== undefined && event.second !== undefined) {
                            const eventTimeInSeconds = event.minute * 60 + (event.second || 0);
                            if (eventTimeInSeconds > matchTime) {
                                matchTime = eventTimeInSeconds;
                            }
                        }
                    });
                    
                    if (!completedMatchData[match.id] || 
                        completedMatchData[match.id].homeScore !== homeScore || 
                        completedMatchData[match.id].awayScore !== awayScore) {
                        hasNewCompletion = true;
                    }
                    
                    newData[match.id] = {
                        time: matchTime,
                        homeScore,
                        awayScore,
                        status: 'completed'
                    };
                } catch (error) {
                    // Ticho ignorujeme chyby
                }
            }
            
            setCompletedMatchData(newData);
    
            if (hasNewCompletion && selectedMatch) {
                setTimeout(() => {
                    setForceUpdate(prev => prev + 1);
                }, 500);
            }
        };
        
        fetchCompletedMatches();
    }, [matches, completedMatchData]);

    // NOVÝ useEffect PRE SLEDOVANIE ŽIVÝCH ZÁPASOV
    useEffect(() => {
        if (!window.db || matches.length === 0) return;
    
        // Filtrujeme prebiehajúce zápasy
        const liveMatches = matches.filter(m => m.status === 'in-progress' || m.status === 'paused');
        
        if (liveMatches.length === 0) {
            setLiveMatchData({});
            return;
        }
    
        // Pre každý živý zápas načítame udalosti
        const unsubscribes = liveMatches.map(match => {
            const eventsRef = collection(window.db, 'matchEvents');
            const q = query(eventsRef, where("matchId", "==", match.id));
            
            return onSnapshot(q, (snapshot) => {
                let homeScore = 0;
                let awayScore = 0;
                let matchTime = 0;
                
                // Získame všetky udalosti a vypočítame skóre
                const events = [];
                snapshot.forEach((doc) => {
                    const event = { id: doc.id, ...doc.data() };
                    events.push(event);
                    
                    // Výpočet skóre
                    if (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) {
                        if (event.team === 'home') homeScore++;
                        else if (event.team === 'away') awayScore++;
                    }
                    
                    // Získame najnovší čas udalosti
                    if (event.minute !== undefined && event.second !== undefined) {
                        const eventTimeInSeconds = event.minute * 60 + (event.second || 0);
                        if (eventTimeInSeconds > matchTime) {
                            matchTime = eventTimeInSeconds;
                        }
                    }
                });
                
                // Ak máme startedAt, použijeme ho na výpočet aktuálneho času
                if (match.startedAt) {
                    const now = Timestamp.now();
                    const startedAt = match.startedAt;
                    
                    if (match.status === 'paused' && match.pausedAt) {
                        // Ak je pozastavené, čas je rozdiel medzi štartom a pozastavením + offset
                        matchTime = Math.floor((match.pausedAt.seconds - startedAt.seconds)) + (match.manualTimeOffset || 0);
                    } else {
                        // Ak beží, čas je aktuálny rozdiel + offset
                        matchTime = Math.floor((now.seconds - startedAt.seconds)) + (match.manualTimeOffset || 0);
                    }
                }
                
                setLiveMatchData(prev => ({
                    ...prev,
                    [match.id]: {
                        time: matchTime,
                        homeScore,
                        awayScore,
                        status: match.status
                    }
                }));
            }, (error) => {
                // Ticho ignorujeme chyby
            });
        });
    
        return () => {
            unsubscribes.forEach(unsubscribe => unsubscribe());
        };
    }, [matches]);
            
    // UPRAVENÝ useEffect pre timer - automatické zastavenie na konci periódy
    useEffect(() => {
        
        // Vymažeme existujúci interval
        if (timerInterval) {
            clearInterval(timerInterval);
            setTimerInterval(null);
        }
        
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = selectedMatch ? categories.find(c => c.name === selectedMatch.categoryName) : null;
        
        // Spustíme nový interval len ak je zápas v priebehu
        if (selectedMatch && selectedMatch.status === 'in-progress' && selectedMatch.startedAt && currentCategory) {
            
            const startedAt = selectedMatch.startedAt;
            const matchId = selectedMatch.id;
            let currentPeriod = selectedMatch.currentPeriod || 1;
            
            // Dĺžka jednej periódy v sekundách
            const periodDurationSeconds = (currentCategory.periodDuration || 20) * 60;
            const periods = currentCategory.periods || 2;
            
            // Vypočítame koniec aktuálnej periódy (v sekundách)
            const endOfCurrentPeriod = currentPeriod * periodDurationSeconds;
                        
            const interval = setInterval(() => {
                const now = Timestamp.now();
                
                // Ak je zápas pozastavený, čas nebeží
                if (selectedMatch.status === 'paused') {
                    return;
                }
                
                const baseSeconds = Math.floor((now.seconds - startedAt.seconds));
                const elapsedSeconds = baseSeconds + manualTimeOffset;
                
                // Aktualizujeme čas
                setMatchTime(elapsedSeconds);
                setCleanPlayingTime(elapsedSeconds);
                
                // Kontrola konca aktuálnej periódy
                if (elapsedSeconds >= endOfCurrentPeriod) {
                    
                    // Ak to nie je posledná perióda
                    if (currentPeriod < periods) {
                        // Zastavíme časovač (koniec periódy)
                        stopMatchTimer(matchId);
                        window.showGlobalNotification(`Koniec ${currentPeriod}. periódy`, 'info');
                    } else {
                        // Ak je to posledná perióda, ukončíme zápas
                        stopMatchTimer(matchId);
                        window.showGlobalNotification('Koniec zápasu', 'info');
                    }
                }
            }, 1000);
            
            setTimerInterval(interval);
            
            return () => clearInterval(interval);
        }
        
        return () => {
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        };
    }, [selectedMatch, selectedMatch?.status, selectedMatch?.startedAt, selectedMatch?.pausedAt, selectedMatch?.currentPeriod, categories, manualTimeOffset]);
    
    // UPRAVENÝ useEffect pre zobrazenie času - zobrazujeme čistý hrací čas
    // Tento useEffect môžete pridať na zobrazenie čistého hracieho času v UI
    useEffect(() => {
        if (selectedMatch && categories.length > 0) {
            const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
            if (currentCategory) {
                const cleanTime = convertTotalToCleanTime(matchTime, currentCategory);
                setCleanPlayingTime(cleanTime);
            }
        }
    }, [matchTime, selectedMatch, categories]);

    // UPRAVENÝ useEffect pre inicializáciu času
    useEffect(() => {

        if (selectedMatch && selectedMatch.startedAt) {
            const now = Timestamp.now();
            const startedAt = selectedMatch.startedAt;
            
            let baseTime = 0;
            
            if (selectedMatch.status === 'paused' && selectedMatch.pausedAt) {
                const pausedAt = selectedMatch.pausedAt;
                baseTime = Math.floor((pausedAt.seconds - startedAt.seconds));
            } else {
                baseTime = Math.floor((now.seconds - startedAt.seconds));
            }
            
            const totalTime = baseTime + (selectedMatch.manualTimeOffset || 0);
            
            setMatchTime(totalTime);
            setCleanPlayingTime(totalTime);
            
        } else {
//            console.log('Žiadny startedAt, nastavujem 0');
            setMatchTime(0);
            setCleanPlayingTime(0);
        }
    }, [selectedMatch, categories]);

    // Načítanie názvu haly
    useEffect(() => {
        const fetchHallName = async () => {
            if (!hallId || !window.db) {
                setHallName('Žiadna priradená hala');
                setLoading(false);
                return;
            }
            
            try {
                const placeRef = doc(window.db, 'places', hallId);
                const placeSnap = await getDoc(placeRef);
                
                if (placeSnap.exists()) {
                    const placeData = placeSnap.data();
                    setHallName(placeData.name || 'Neznámy názov haly');
                } else {
                    setHallName(hallId);
                }
            } catch (error) {
//                console.error("Chyba pri načítaní názvu haly:", error);
                setHallName(hallId || 'Chyba načítania');
            }
        };
        
        fetchHallName();
    }, [hallId]);

    // ============================================================================
    // OPRAVA 2: UPRAVIŤ useEffect PRE NAČÍTANIE UDALOSTÍ ZÁPASU - PODPORA MANUÁLNEHO VÝSLEDKU
    // ============================================================================
    
    useEffect(() => {
        if (!selectedMatch || !window.db) return;
    
        // AK JE ZÁPAS KONTUMOVANÝ, NASTAVÍME SKÓRE PODĽA forfeitResult
        if (selectedMatch.forfeitResult && selectedMatch.forfeitResult.isForfeit) {
            setMatchScore({ 
                home: selectedMatch.forfeitResult.home, 
                away: selectedMatch.forfeitResult.away 
            });
            setMatchEvents([]);
            setLoadingEvents(false);
            return;
        }
        
        // AK MÁ ZÁPAS MANUÁLNY VÝSLEDOK (finalScore) A NIE JE KONTUMOVANÝ
        if (selectedMatch.finalScore && selectedMatch.status === 'completed' && !selectedMatch.forfeitResult) {
            setMatchScore({ 
                home: selectedMatch.finalScore.home, 
                away: selectedMatch.finalScore.away 
            });
            // Stále načítame udalosti, ak existujú (napr. ak niekto pridal udalosti potom)
        }
    
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where("matchId", "==", selectedMatch.id));
        
        setLoadingEvents(true);
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedEvents = [];
            let homeScore = 0;
            let awayScore = 0;
            
            snapshot.forEach((doc) => {
                const event = { id: doc.id, ...doc.data() };
                loadedEvents.push(event);
            });
            
            // Zoradenie od najnovšej po najstaršiu (zostupne podľa času)
            loadedEvents.sort((a, b) => {
                if (a.minute !== b.minute) {
                    return (b.minute || 0) - (a.minute || 0);
                }
                return (b.second || 0) - (a.second || 0);
            });
            
            // Pre výpočet aktuálneho skóre ideme od najstaršej po najnovšiu
            const sortedAsc = [...loadedEvents].sort((a, b) => {
                if (a.minute !== b.minute) {
                    return (a.minute || 0) - (b.minute || 0);
                }
                return (a.second || 0) - (b.second || 0);
            });
            
            sortedAsc.forEach(event => {
                if (event.type === 'goal') {
                    if (event.team === 'home') homeScore++;
                    else if (event.team === 'away') awayScore++;
                } else if (event.type === 'penalty' && event.subType === 'scored') {
                    if (event.team === 'home') homeScore++;
                    else if (event.team === 'away') awayScore++;
                }
            });
            
            setMatchEvents(loadedEvents);
            
            // 🔥 DÔLEŽITÉ: AK MÁME MANUÁLNY VÝSLEDOK, POUŽIJEME HO (prepíše vypočítané skóre)
            if (selectedMatch.finalScore && selectedMatch.status === 'completed' && !selectedMatch.forfeitResult) {
                setMatchScore({ 
                    home: selectedMatch.finalScore.home, 
                    away: selectedMatch.finalScore.away 
                });
            } else {
                setMatchScore({ home: homeScore, away: awayScore });
            }
            
            setLoadingEvents(false);
        }, (error) => {
            console.error("Chyba pri načítaní udalostí zápasu:", error);
            setLoadingEvents(false);
        });
    
        return () => unsubscribe();
    }, [selectedMatch]);
    
    const deleteMatchEvent = async (eventId) => {
        if (!window.db || !eventId) return;
    
        // Namiesto window.confirm otvoríme modálne okno
        setEventToDelete(eventId);
        setConfirmModalOpen(true);
    };

    const confirmDeleteEvent = async () => {
        if (!eventToDelete) return;
    
        try {
            // Najprv získame zmazanú udalosť, aby sme zistili, o aký typ išlo a ktorý tím
            const deletedEventRef = doc(window.db, 'matchEvents', eventToDelete);
            const deletedEventSnap = await getDoc(deletedEventRef);
            
            if (!deletedEventSnap.exists()) {
                window.showGlobalNotification('Udalosť neexistuje', 'error');
                return;
            }
            
            const deletedEvent = deletedEventSnap.data();
            
            // Zmažeme udalosť
            await deleteDoc(deletedEventRef);
            
            // Ak ide o gól alebo premenenú penaltu, musíme prepočítať skóre pre nasledujúce udalosti
            if (deletedEvent.type === 'goal' || (deletedEvent.type === 'penalty' && deletedEvent.subType === 'scored')) {
                
                // Získame všetky udalosti pre tento zápas, ktoré nasledujú po zmazanej udalosti
                const eventsRef = collection(window.db, 'matchEvents');
                const q = query(
                    eventsRef, 
                    where("matchId", "==", selectedMatch.id),
                    orderBy("minute", "asc"),
                    orderBy("second", "asc")
                );
                
                const querySnapshot = await getDocs(q);
                const events = [];
                querySnapshot.forEach((doc) => {
                    events.push({ id: doc.id, ...doc.data() });
                });
                
                // Nájdeme index zmazanej udalosti v zoradenom zozname
                // (potrebujeme vedieť, kde presne bola)
                // Použijeme čas na porovnanie, ale pozor - môže byť viac udalostí v rovnakom čase
                const deletedEventTime = (deletedEvent.minute || 0) * 60 + (deletedEvent.second || 0);
                
                // Prepočítame skóre od začiatku
                let homeScore = 0;
                let awayScore = 0;
                const updatePromises = [];
                
                // Prejdeme všetky udalosti v chronologickom poradí
                for (const event of events) {
                    // Uložíme skóre pred udalosťou
                    const scoreBefore = { home: homeScore, away: awayScore };
                    
                    // Aktualizujeme skóre podľa typu udalosti (ak to nie je zmazaná udalosť)
                    if (event.id !== eventToDelete) {
                        if (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) {
                            if (event.team === 'home') {
                                homeScore++;
                            } else if (event.team === 'away') {
                                awayScore++;
                            }
                        }
                    }
                    
                    const scoreAfter = { home: homeScore, away: awayScore };
                    
                    // Ak sa skóre pred/po zmenilo, aktualizujeme udalosť
                    if (JSON.stringify(event.scoreBefore) !== JSON.stringify(scoreBefore) || 
                        JSON.stringify(event.scoreAfter) !== JSON.stringify(scoreAfter)) {
                        
                        const eventRef = doc(window.db, 'matchEvents', event.id);
                        updatePromises.push(
                            updateDoc(eventRef, {
                                scoreBefore: scoreBefore,
                                scoreAfter: scoreAfter
                            })
                        );
                    }
                }
                
                // Vykonáme všetky aktualizácie
                if (updatePromises.length > 0) {
                    await Promise.all(updatePromises);
                }
            }
            
            window.showGlobalNotification('Udalosť bola zmazaná', 'success');
            setEventToDelete(null);
        } catch (error) {
            console.error('Chyba pri mazaní udalosti:', error);
            window.showGlobalNotification('Chyba pri mazaní udalosti', 'error');
        }
    };
    
    const getPlayerNameFromRef = (playerRef) => {
        if (!playerRef || !playerRef.userId) return 'Neznámy hráč';
        
        const user = users.find(u => u.id === playerRef.userId);
        if (!user) return 'Neznámy hráč';
        
        // Kontrola, či ide o člena realizačného tímu (staff)
        if (playerRef.staffType && playerRef.staffIndex !== undefined) {
            // Získame detail tímu podľa identifikátora
            const teamDetails = getTeamDetailsFromIdentifier(playerRef.teamIdentifier);
            if (!teamDetails) return 'Neznámy člen RT';
            
            if (playerRef.staffType === 'men' && teamDetails.team.menTeamMemberDetails && 
                teamDetails.team.menTeamMemberDetails[playerRef.staffIndex]) {
                const member = teamDetails.team.menTeamMemberDetails[playerRef.staffIndex];
                return `${member.lastName} ${member.firstName}`;
            } else if (playerRef.staffType === 'women' && teamDetails.team.womenTeamMemberDetails && 
                       teamDetails.team.womenTeamMemberDetails[playerRef.staffIndex]) {
                const member = teamDetails.team.womenTeamMemberDetails[playerRef.staffIndex];
                return `${member.lastName} ${member.firstName}`;
            }
            return 'Neznámy člen RT';
        }
        
        // Pre hráča - OPRAVENÉ VYHĽADÁVANIE
        if (playerRef.playerIndex !== undefined) {
            // Získame detail tímu podľa identifikátora
            const teamDetails = getTeamDetailsFromIdentifier(playerRef.teamIdentifier);
            if (!teamDetails || !teamDetails.team.playerDetails) return 'Neznámy hráč';
            
            const players = teamDetails.team.playerDetails;
            
            // Skúsime nájsť hráča podľa uloženého ID (ak existuje)
            if (playerRef.playerId) {
                const player = players.find(p => p.id === playerRef.playerId);
                if (player && player.firstName && player.lastName) {
                    return `${player.lastName} ${player.firstName}`;
                }
            }
            
            // Skúsime podľa indexu (ale to je nespoľahlivé)
            if (playerRef.playerIndex < players.length) {
                const player = players[playerRef.playerIndex];
                if (player && player.firstName && player.lastName) {
                    return `${player.lastName} ${player.firstName}`;
                }
            }
            
            // Posledná možnosť - prehľadáme všetkých hráčov
            for (const player of players) {
                if (player.firstName && player.lastName) {
                    // Ak máme uložené číslo dresu v referencii
                    if (playerRef.jerseyNumber && player.jerseyNumber === playerRef.jerseyNumber) {
                        return `${player.lastName} ${player.firstName}`;
                    }
                }
            }
        }
        
        return 'Neznámy hráč';
    };

    const getRemainingExclusionTime = (event, currentMatchTime, exclusionDurationSeconds) => {
        if (!event || !event.minute !== undefined || !event.second !== undefined) return null;
        
        const eventTimeInSeconds = (event.minute || 0) * 60 + (event.second || 0);
        const elapsedSinceExclusion = currentMatchTime - eventTimeInSeconds;
        const remaining = exclusionDurationSeconds - elapsedSinceExclusion;
        
        if (remaining <= 0) return 0;
        return remaining;
    };
    
    // Funkcia na formátovanie zostávajúceho času
    const formatRemainingTime = (seconds) => {
        if (seconds === null || seconds === undefined) return '';
        if (seconds <= 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Funkcia na získanie aktívnych vylúčení pre tím
    const getActiveExclusions = (teamDetails, team, currentMatchTime, exclusionDurationSeconds) => {
        if (!matchEvents || matchEvents.length === 0) return [];
        
        const activeExclusions = [];
        
        matchEvents.forEach(event => {
            // Hľadáme vylúčenia (exclusion) pre daný tím
            if (event.type === 'exclusion' && event.team === team && event.playerRef) {
                const eventTimeInSeconds = (event.minute || 0) * 60 + (event.second || 0);
                const elapsedSinceExclusion = currentMatchTime - eventTimeInSeconds;
                
                // Ak ešte neuplynul čas vylúčenia
                if (elapsedSinceExclusion < exclusionDurationSeconds) {
                    const playerName = getPlayerNameFromRef(event.playerRef);
                    const remaining = exclusionDurationSeconds - elapsedSinceExclusion;
                    
                    // Získame číslo dresu
                    let jerseyNumber = '';
                    if (!event.playerRef.staffType) {
                        const user = users.find(u => u.id === event.playerRef.userId);
                        if (user && teamDetails) {
                            const parts = event.playerRef.teamIdentifier?.split(' ') || [];
                            if (parts.length >= 2) {
                                const groupAndOrder = parts.pop();
                                const category = parts.join(' ');
                                
                                let groupLetter = '', order = '';
                                for (let i = 0; i < groupAndOrder.length; i++) {
                                    const char = groupAndOrder[i];
                                    if (char >= '0' && char <= '9') {
                                        order = groupAndOrder.substring(i);
                                        groupLetter = groupAndOrder.substring(0, i);
                                        break;
                                    }
                                }
                                
                                const fullGroupName = `skupina ${groupLetter}`;
                                const orderNum = parseInt(order, 10);
                                
                                const userTeams = user.teams?.[category];
                                if (userTeams && Array.isArray(userTeams)) {
                                    const teamObj = userTeams.find(t => t.groupName === fullGroupName && t.order === orderNum);
                                    if (teamObj && teamObj.playerDetails && event.playerRef.playerIndex !== undefined) {
                                        const player = teamObj.playerDetails[event.playerRef.playerIndex];
                                        if (player && player.jerseyNumber) {
                                            jerseyNumber = player.jerseyNumber;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    activeExclusions.push({
                        playerName: playerName,
                        jerseyNumber: jerseyNumber,
                        remainingTime: remaining,
                        eventId: event.id,
                        eventTime: eventTimeInSeconds
                    });
                }
            }
        });
        
        // Zoradenie podľa zostávajúceho času (najskôr tí, ktorým to najskôr vyprší)
        activeExclusions.sort((a, b) => a.remainingTime - b.remainingTime);
        
        return activeExclusions;
    };

    const getActiveExclusionsForTeam = getActiveExclusions;
    
    // PRIDAJTE NOVÚ FUNKCIU NA ZÍSKANIE ČÍSLA DRESU
    const getJerseyNumberFromRef = (playerRef) => {
        if (!playerRef || !playerRef.userId || playerRef.staffType) return '';
        
        const user = users.find(u => u.id === playerRef.userId);
        if (!user) return '';
        
        // Získame detail tímu podľa identifikátora
        const teamDetails = getTeamDetailsFromIdentifier(playerRef.teamIdentifier);
        if (!teamDetails || !teamDetails.team.playerDetails) return '';
        
        const players = teamDetails.team.playerDetails;
        
        // Skúsime nájsť hráča podľa uloženého ID
        if (playerRef.playerId) {
            const player = players.find(p => p.id === playerRef.playerId);
            if (player && player.jerseyNumber) return player.jerseyNumber;
        }
        
        // Skúsime podľa indexu
        if (playerRef.playerIndex !== undefined && playerRef.playerIndex < players.length) {
            const player = players[playerRef.playerIndex];
            if (player && player.jerseyNumber) return player.jerseyNumber;
        }
        
        // Prehľadáme všetkých hráčov
        for (const player of players) {
            if (player.firstName && player.lastName) {
                const playerFullName = `${player.lastName} ${player.firstName}`;
                if (playerRef.playerName === playerFullName) {
                    return player.jerseyNumber || '';
                }
            }
        }
        
        return '';
    };

    // Načítanie kategórií z databázy
    useEffect(() => {
        const loadCategorySettings = async () => {
            if (!window.db) return;
            
            try {
                const catRef = doc(window.db, 'settings', 'categories');
                const catSnap = await getDoc(catRef);
                
                if (catSnap.exists()) {
                    const data = catSnap.data() || {};
                    const categoriesList = [];
                    const idMap = {}; // { categoryName: categoryId }
                    
                    Object.entries(data).forEach(([id, obj]) => {
                        const categoryName = obj.name || `Kategória ${id}`;
                        categoriesList.push({
                            id: id,
                            name: categoryName,
                            // ... ostatné vlastnosti
                            maxTeams: obj.maxTeams ?? 12,
                            maxPlayers: obj.maxPlayers ?? 12,
                            maxImplementationTeam: obj.maxImplementationTeam ?? 3,
                            periods: obj.periods ?? 2,
                            periodDuration: obj.periodDuration ?? 20,
                            breakDuration: obj.breakDuration ?? 2,
                            matchBreak: obj.matchBreak ?? 5,
                            drawColor: obj.drawColor ?? '#3B82F6',
                            transportColor: obj.transportColor ?? '#10B981',
                            dateFrom: obj.dateFrom ?? '',
                            dateTo: obj.dateTo ?? '',
                            dateFromActive: obj.dateFromActive ?? false,
                            dateToActive: obj.dateToActive ?? false,
                            timeoutCount: obj.timeoutCount ?? 2,
                            timeoutDuration: obj.timeoutDuration ?? 1,
                            exclusionTime: obj.exclusionTime ?? 2
                        });
                        
                        // Vytvoríme mapovanie názov -> ID
                        idMap[categoryName] = id;
                    });
                    
                    setCategories(categoriesList);
                    setCategoryIdMap(idMap);
                    window.categoryIdMap = idMap; // Uložíme aj do window pre debug
                    
                } else {
                    setCategories([]);
                    setCategoryIdMap({});
                }
            } catch (error) {
                console.error("Chyba pri načítaní kategórií:", error);
            }
        };
        
        loadCategorySettings();
    }, []);

    // NOVÝ LISTENER: Načítanie všetkých používateľov z kolekcie users
    useEffect(() => {
        if (!window.db) return;
    
        const unsubscribeUsers = onSnapshot(query(collection(window.db, 'users')), (querySnapshot) => {
            const usersList = [];
            
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                const teams = userData.teams || {};
                
                // 🔥 Pridáme unikátne ID pre všetkých hráčov a členov RT
                Object.keys(teams).forEach(category => {
                    if (Array.isArray(teams[category])) {
                        teams[category] = teams[category].map(team => ensureUniqueIds(team));
                    }
                });
                
                usersList.push({
                    id: doc.id,
                    email: userData.email,
                    displayName: userData.displayName,
                    role: userData.role,
                    approved: userData.approved,
                    createdAt: userData.createdAt,
                    teams: teams,
                    hallId: userData.hallId,
                });
            });
            
            setUsers(usersList);
        }, (error) => {
            // console.error('Chyba pri načítaní používateľov:', error);
        });
    
        return () => unsubscribeUsers();
    }, []);


    // PRIDAJTE TÚTO FUNKCIU NA ZAČIATOK KÓDU (napr. za importy) -------------------------------------------------------------------------------------------------------------------------------------- Odstran funkciu, iba vypisuje
    useEffect(() => {
        if (!selectedMatch) return;
        
        // Funkcia na kontrolu, či sú dáta pripravené
        const checkDataAndLog = () => {
            // Skontrolujeme, či máme users a superstructureTeams
            if (users.length === 0 && Object.keys(superstructureTeams).length === 0) {
                console.log('⏳ Dáta sa ešte načítavajú (users a superstructureTeams sú prázdne)...');
                // Skúsime znova o 1 sekundu
                setTimeout(checkDataAndLog, 1000);
                return;
            }
            
            // Dáta sú pripravené, vykonáme výpis
            const homeTeamName = getTeamNameByIdentifier(selectedMatch.homeTeamIdentifier);
            const awayTeamName = getTeamNameByIdentifier(selectedMatch.awayTeamIdentifier);
            
            console.log('\n' + '='.repeat(80));
            console.log('📋 AKTUÁLNE NAČÍTANÝ ZÁPAS');
            console.log('='.repeat(80));
            console.log(`🆔 ID zápasu: ${selectedMatch.id}`);
            console.log(`📅 Dátum: ${selectedMatch.scheduledTime ? formatDateWithDay(selectedMatch.scheduledTime.toDate()) : 'neurčený'}`);
            console.log(`⏰ Čas: ${selectedMatch.scheduledTime ? formatTime(selectedMatch.scheduledTime) : '--:--'}`);
            console.log(`🏷️ Kategória: ${selectedMatch.categoryName || 'neurčená'}`);
            console.log(`📊 Status: ${selectedMatch.status || 'neurčený'}`);
            console.log('-'.repeat(80));
            
            console.log(`\n🏠 DOMÁCI TÍM: ${homeTeamName}`);
            console.log(`   Identifikátor: ${selectedMatch.homeTeamIdentifier}`);
            
            console.log(`\n✈️ HOSŤOVSKÝ TÍM: ${awayTeamName}`);
            console.log(`   Identifikátor: ${selectedMatch.awayTeamIdentifier}`);
            
            console.log('\n' + '='.repeat(80) + '\n');
        };
        
        // Spustíme kontrolu s malým oneskorením
        const timer = setTimeout(checkDataAndLog, 500);
        
        return () => clearTimeout(timer);
    }, [selectedMatch, users, superstructureTeams]);
    

    // Načítanie zápasov pre túto halu
    useEffect(() => {
        if (!window.db || !hallId) {
            setLoading(false);
            return;
        }
    
        const matchesRef = collection(window.db, 'matches');
        const q = query(matchesRef, where("hallId", "==", hallId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedMatches = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
//                console.log('Načítaný zápas:', data); // Pre ladenie
                
                loadedMatches.push({
                    id: doc.id,
                    ...data,
                    currentPeriod: data.currentPeriod || 1,
                    manualTimeOffset: data.manualTimeOffset || 0
                });
                if (selectedMatch) {
                    setMatchPaused(selectedMatch.status === 'paused');
                }
            });
            
            // Zoradíme podľa času
            loadedMatches.sort((a, b) => {
                if (!a.scheduledTime) return 1;
                if (!b.scheduledTime) return -1;
                return a.scheduledTime.toDate() - b.scheduledTime.toDate();
            });
            
            setMatches(loadedMatches);
            
            // Zoskupenie podľa dňa
            const grouped = {};
            loadedMatches.forEach(match => {
                if (match.scheduledTime) {
                    const date = match.scheduledTime.toDate();
                    const dateStr = getLocalDateStr(date);
                    
                    if (!grouped[dateStr]) {
                        grouped[dateStr] = {
                            date: date,
                            dateStr: dateStr,
                            matches: []
                        };
                    }
                    grouped[dateStr].matches.push(match);
                }
            });
            
            setGroupedMatches(grouped);
            setLoading(false);
            
            // Skontrolujeme URL parametre pre domácich a hostí
            const homeIdentifierFromUrl = getUrlParameter('domaci');
            const awayIdentifierFromUrl = getUrlParameter('hostia');
            
            if (homeIdentifierFromUrl && awayIdentifierFromUrl && !selectedMatch) {
                // Hľadáme zápas, ktorý má oba identifikátory
                const matchFromUrl = loadedMatches.find(m => 
                    m.homeTeamIdentifier === homeIdentifierFromUrl && 
                    m.awayTeamIdentifier === awayIdentifierFromUrl
                );
                
                if (matchFromUrl) {
                    setSelectedMatch(matchFromUrl);
                    setManualTimeOffset(matchFromUrl.manualTimeOffset || 0);
                }
            }
            
        }, (error) => {
//            console.error("Chyba pri načítaní zápasov:", error);
            setLoading(false);
        });
    
        return () => unsubscribe();
    }, [hallId]);
    
    // SAMOSTATNÝ useEffect PRE VÝPIS DO KONZOLY - závislý na matches AJ categories
    useEffect(() => {
        // Spustí sa až keď sú obe dáta načítané
        if (matches.length > 0 && categories.length > 0) {
//            console.log('=== VŠETKY ZÁPASY V TEJTO HALE S NASTAVENIAMI KATEGÓRIE ===');
            matches.forEach((match, index) => {
                const homeTeamName = match.homeDisplayName || getTeamNameByIdentifier(match.homeTeamIdentifier);
                const awayTeamName = match.awayDisplayName || getTeamNameByIdentifier(match.awayTeamIdentifier);
                const matchTime = match.scheduledTime ? formatTime(match.scheduledTime) : 'neurčený';
                const matchDate = match.scheduledTime ? formatDateWithDay(match.scheduledTime.toDate()) : 'neurčený';
                const categoryName = match.categoryName || 'Neznáma kategória';
                
                // Nájdeme kategóriu podľa názvu
                const category = categories.find(c => c.name === match.categoryName);
                
                // VÝPIS NASTAVENÍ KATEGÓRIE
                if (category) {
                    
                    // Výpočet celkového času zápasu
                    const periods = category.periods ?? 2;
                    const periodDuration = category.periodDuration ?? 15;
                    const breakDuration = category.breakDuration ?? 3;
                    const matchBreak = category.matchBreak ?? 5;
                    
                    // Jednotlivé časti
                    const playingTime = periods * periodDuration;
                    const breaksBetweenPeriods = (periods - 1) * breakDuration;
                    const totalMatchTime = playingTime + breaksBetweenPeriods;
                    const totalTimeWithMatchBreak = totalMatchTime + matchBreak;
                }
                
            });
        }
    }, [matches, categories]); // Tento useEffect sa spustí vždy, keď sa zmenia matches ALEBO categories

    // Pomocná funkcia na získanie názvu tímu s čakaním na teamManager
    const getTeamNameSafe = (identifier) => {
        if (!identifier) return 'Neznámy tím';
        
        // Ak je teamManager dostupný, použijeme ho
        if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
            const teamName = window.teamManager.getTeamNameByDisplayIdSync(identifier);
            if (teamName) return teamName;
        }
        
        // Fallback - manuálne vyhľadávanie v users (pre user teams)
        if (users && users.length > 0) {
            const parts = identifier.split(' ');
            if (parts.length >= 2) {
                const groupAndOrder = parts.pop();
                const category = parts.join(' ');
                
                let groupLetter = '';
                let order = '';
                for (let i = 0; i < groupAndOrder.length; i++) {
                    const char = groupAndOrder[i];
                    if (char >= '0' && char <= '9') {
                        order = groupAndOrder.substring(i);
                        groupLetter = groupAndOrder.substring(0, i);
                        break;
                    }
                }
                
                const fullGroupName = `skupina ${groupLetter}`;
                const orderNum = parseInt(order, 10);
                
                for (const user of users) {
                    if (!user.teams) continue;
                    const userTeams = user.teams[category];
                    if (!userTeams || !Array.isArray(userTeams)) continue;
                    
                    const team = userTeams.find(t => 
                        t.groupName === fullGroupName && 
                        t.order === orderNum
                    );
                    
                    if (team && team.teamName) {
                        return team.teamName;
                    }
                }
            }
        }
        
        // Ak nič nenašlo, vrátime pôvodný identifikátor
        return identifier;
    };   

    // FUNKCIA NA ZÍSKANIE NÁZVU TÍMU PODĽA IDENTIFIKÁTORA (UPRAVENÁ)
    const getTeamNameByIdentifier = (identifier) => {
        if (!identifier) return 'Neznámy tím';
        
        // 1. NAJPRV SKÚSIME ZÍSKAť SPRÁVNY NÁZOV TÍMU CEZ matchTracker
        let resolvedTeamName = null;
        let originalIdentifier = identifier;
        
        if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
            const teamNameFromTracker = window.matchTracker.getTeamNameByDisplayId(identifier);
            if (teamNameFromTracker && teamNameFromTracker !== identifier) {
                resolvedTeamName = teamNameFromTracker;
//                console.log(`🔍 Pre identifikátor "${identifier}" bol nájdený názov tímu: "${resolvedTeamName}"`);
            }
        }
        
        // 2. AK MÁME VYRIEŠENÝ NÁZOV TÍMU, SKÚSIME HO NAJPRV POUŽIŤ NA VYHĽADÁVANIE
        if (resolvedTeamName) {
            // Skúsime vyhľadať tím podľa vyriešeného názvu v superstructureTeams
            if (superstructureTeams && Object.keys(superstructureTeams).length > 0) {
                // Prehľadáme všetky kategórie v superstructureTeams
                for (const [category, teamsArray] of Object.entries(superstructureTeams)) {
                    if (Array.isArray(teamsArray)) {
                        const foundTeam = teamsArray.find(t => t.teamName === resolvedTeamName);
                        if (foundTeam && foundTeam.teamName) {
                            console.log(`✅ Nájdený tím v superstructureTeams: "${foundTeam.teamName}" (kategória: ${category})`);
                            return foundTeam.teamName;
                        }
                    }
                }
            }
            
            // Skúsime vyhľadať podľa vyriešeného názvu v používateľských dátach
            if (users && users.length > 0) {
                for (const user of users) {
                    if (!user.teams) continue;
                    
                    for (const [category, teamsArray] of Object.entries(user.teams)) {
                        if (Array.isArray(teamsArray)) {
                            const foundTeam = teamsArray.find(t => t.teamName === resolvedTeamName);
                            if (foundTeam && foundTeam.teamName) {
//                                console.log(`✅ Nájdený tím v používateľských dátach: "${foundTeam.teamName}" (kategória: ${category})`);
                                return foundTeam.teamName;
                            }
                        }
                    }
                }
            }
            
            // Ak sme nenašli podľa vyriešeného názvu, vrátime ho ako taký
            console.log(`⚠️ Tím "${resolvedTeamName}" nebol nájdený v databáze, vraciam vyriešený názov.`);
            return resolvedTeamName;
        }
        
        // 3. PÔVODNÁ LOGIKA - vyhľadávanie podľa identifikátora v superstructureTeams
        if (superstructureTeams && Object.keys(superstructureTeams).length > 0) {
            const parts = identifier.split(' ');
            if (parts.length >= 2) {
                const groupAndOrder = parts.pop();
                const category = parts.join(' ');
                
                let groupLetter = '';
                let order = '';
                for (let i = 0; i < groupAndOrder.length; i++) {
                    const char = groupAndOrder[i];
                    if (char >= '0' && char <= '9') {
                        order = groupAndOrder.substring(i);
                        groupLetter = groupAndOrder.substring(0, i);
                        break;
                    }
                }
                
                if (order) {
                    const fullGroupName = `skupina ${groupLetter}`;
                    const orderNum = parseInt(order, 10);
                    
                    const categoryTeams = superstructureTeams[category];
                    if (categoryTeams && Array.isArray(categoryTeams)) {
                        const team = categoryTeams.find(t => 
                            t.groupName === fullGroupName && 
                            t.order === orderNum
                        );
                        if (team && team.teamName) {
                            return team.teamName;
                        }
                    }
                }
            }
        }
        
        // 4. PÔVODNÁ LOGIKA - vyhľadávanie v používateľoch
        if (users && users.length > 0) {
            const parts = identifier.split(' ');
            if (parts.length >= 2) {
                const groupAndOrder = parts.pop();
                const category = parts.join(' ');
                
                let groupLetter = '';
                let order = '';
                for (let i = 0; i < groupAndOrder.length; i++) {
                    const char = groupAndOrder[i];
                    if (char >= '0' && char <= '9') {
                        order = groupAndOrder.substring(i);
                        groupLetter = groupAndOrder.substring(0, i);
                        break;
                    }
                }
                
                if (order) {
                    const fullGroupName = `skupina ${groupLetter}`;
                    const orderNum = parseInt(order, 10);
                    
                    for (const user of users) {
                        if (!user.teams) continue;
                        const userTeams = user.teams[category];
                        if (!userTeams || !Array.isArray(userTeams)) continue;
                        
                        const team = userTeams.find(t => 
                            t.groupName === fullGroupName && 
                            t.order === orderNum
                        );
                        
                        if (team && team.teamName) {
                            return team.teamName;
                        }
                    }
                }
            }
        }
        
        // 5. Ak nič nenašlo, vrátime pôvodný identifikátor
        return identifier;
    };

    const getTeamDetailsByName = (teamName, categoryName) => {
        if (!teamName || !categoryName) return null;
        
        console.log(`🔍 getTeamDetailsByName() volaná s názvom: "${teamName}", kategória: "${categoryName}"`);
        
        // Hľadáme v users podľa názvu tímu a kategórie
        if (users && users.length > 0) {
            for (const user of users) {
                if (!user.teams) continue;
                
                const userTeams = user.teams[categoryName];
                if (!userTeams || !Array.isArray(userTeams)) continue;
                
                const team = userTeams.find(t => t.teamName === teamName);
                
                if (team) {
                    console.log(`   ✅ Nájdený tím: "${team.teamName}" (${user.email})`);
                    console.log(`   📊 Počet hráčov: ${team.playerDetails?.length || 0}`);
                    
                    return {
                        team,
                        userEmail: user.email,
                        userId: user.id,
                        userDisplayName: user.displayName
                    };
                }
            }
        }
        
        console.log(`   ❌ Tím "${teamName}" v kategórii "${categoryName}" nebol nájdený`);
        return null;
    };

    const getTeamDetailsByDisplayName = async (teamDisplayName, categoryName) => {
        if (!teamDisplayName || !categoryName) return null;
        
        console.log(`🔍 [getTeamDetailsByDisplayName] Hľadám tím: "${teamDisplayName}" v kategórii: "${categoryName}"`);
        
        // 1. NAJPRV SKÚSIME CEZ matchTracker získať čistý názov tímu (pre prípad, že displayName je už mapovaný)
        let resolvedTeamName = teamDisplayName;
        if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
            const result = window.matchTracker.getTeamNameByDisplayId(teamDisplayName);
            if (result && typeof result.then === 'function') {
                resolvedTeamName = await result;
            } else if (result) {
                resolvedTeamName = result;
            }
            
            if (resolvedTeamName && resolvedTeamName !== teamDisplayName) {
                console.log(`   🔄 Zmapovaný názov: "${teamDisplayName}" -> "${resolvedTeamName}"`);
            }
        }
        
        // 2. VYHĽADÁVAME V POUŽÍVATEĽSKÝCH DÁTACH (users)
        if (users && users.length > 0) {
            for (const user of users) {
                if (!user.teams) continue;
                
                const userTeams = user.teams[categoryName];
                if (!userTeams || !Array.isArray(userTeams)) continue;
                
                // Hľadáme podľa vyriešeného názvu (ak existuje) alebo podľa pôvodného displayName
                const team = userTeams.find(t => 
                    t.teamName === resolvedTeamName || t.teamName === teamDisplayName
                );
                
                if (team) {
                    console.log(`   ✅ Tím nájdený: "${team.teamName}" (používateľ: ${user.email})`);
                    console.log(`   📊 Hráčov: ${team.playerDetails?.length || 0}`);
                    console.log(`   👨‍🏫 RT muži: ${team.menTeamMemberDetails?.length || 0}`);
                    console.log(`   👩‍🏫 RT ženy: ${team.womenTeamMemberDetails?.length || 0}`);
                    
                    return {
                        team,
                        userId: user.id,
                        userEmail: user.email,
                        userDisplayName: user.displayName
                    };
                }
            }
        }
        
        // 3. FALLBACK: Skúsime vyhľadať v superstructureTeams (ak existuje)
        if (superstructureTeams && Object.keys(superstructureTeams).length > 0) {
            const categoryTeams = superstructureTeams[categoryName];
            if (categoryTeams && Array.isArray(categoryTeams)) {
                const superstructureTeam = categoryTeams.find(t => 
                    t.teamName === resolvedTeamName || t.teamName === teamDisplayName
                );
                
                if (superstructureTeam && superstructureTeam.teamId) {
                    console.log(`   ⚠️ Tím nájdený LEN v superstructureTeams: "${superstructureTeam.teamName}" (nemusí mať hráčov)`);
                    // Pre superstructure tímy nemáme hráčov, vrátime aspoň základné info
                    return {
                        team: {
                            teamName: superstructureTeam.teamName,
                            groupName: superstructureTeam.groupName,
                            order: superstructureTeam.order,
                            playerDetails: [],
                            menTeamMemberDetails: [],
                            womenTeamMemberDetails: []
                        },
                        userId: null,
                        userEmail: null,
                        userDisplayName: null,
                        isSuperstructureTeam: true
                    };
                }
            }
        }
        
        console.log(`   ❌ Tím "${teamDisplayName}" v kategórii "${categoryName}" nebol nájdený.`);
        return null;
    };

    const getTeamDetailsFromIdentifier = (identifier) => {
        if (!identifier) return null;
        
        // Kontrola, či je názov už zmapovaný
        const isHomeTeam = identifier === selectedMatch?.homeTeamIdentifier;
        const isAwayTeam = identifier === selectedMatch?.awayTeamIdentifier;
        
        if (isHomeTeam && !homeTeamNameReady) {
            console.log(`⏳ Čakám na zmapovanie domáceho tímu: ${identifier}`);
            return null;
        }
        
        if (isAwayTeam && !awayTeamNameReady) {
            console.log(`⏳ Čakám na zmapovanie hosťovského tímu: ${identifier}`);
            return null;
        }
        
        // Pôvodná logika getTeamDetailsFromIdentifier (ponechajte ju)
        const parts = identifier.split(' ');
        if (parts.length < 2) {
            console.log(`❌ Neplatný formát identifikátora: ${identifier}`);
            return null;
        }
        
        const groupAndOrder = parts.pop();
        const categoryName = parts.join(' ');
        
        // Použijeme už zmapovaný názov ak je k dispozícii
        let teamDisplayName;
        if (isHomeTeam && homeTeamResolvedName) {
            teamDisplayName = homeTeamResolvedName;
        } else if (isAwayTeam && awayTeamResolvedName) {
            teamDisplayName = awayTeamResolvedName;
        } else {
            teamDisplayName = getTeamNameByIdentifier(identifier);
        }
        
        if (!teamDisplayName || teamDisplayName === identifier) {
            console.log(`❌ Nepodarilo sa získať zobrazovací názov pre identifikátor: ${identifier}`);
            return null;
        }
        
        // Zvyšok pôvodnej logiky...
        if (users && users.length > 0) {
            for (const user of users) {
                if (!user.teams) continue;
                
                const userTeams = user.teams[categoryName];
                if (!userTeams || !Array.isArray(userTeams)) continue;
                
                const team = userTeams.find(t => t.teamName === teamDisplayName);
                
                if (team) {
                    return {
                        team,
                        userEmail: user.email,
                        userId: user.id,
                        userDisplayName: user.displayName
                    };
                }
            }
        }
        
        return null;
    };
    
    // A UPRAVTE existujúcu getTeamDetails na async verziu (alebo ju nechajte pre kompatibilitu)
    const getTeamDetails = (identifier) => {
        // Táto funkcia už nebude používaná na priame vyhľadávanie
        // Namiesto toho použite getTeamDetailsByName
        return null;
    };

    // FUNKCIA PRE ZOBRAZENIE VŠETKÝCH ZÁPASOV
    const showAllMatches = () => {
        setSelectedMatch(null);
        updateUrlParameters(null, null);
        
        // Vynútime refresh mapovania pri návrate na zoznam
        if (matches.length > 0 && window.matchTracker) {
            setTimeout(async () => {
                const updatedMatches = [...matches];
                let hasChanges = false;
                
                for (let i = 0; i < updatedMatches.length; i++) {
                    const match = updatedMatches[i];
                    const homeDisplayName = await window.matchTracker.getTeamNameByDisplayId(match.homeTeamIdentifier);
                    const awayDisplayName = await window.matchTracker.getTeamNameByDisplayId(match.awayTeamIdentifier);
                    
                    if (homeDisplayName && homeDisplayName !== match.homeTeamIdentifier) {
                        updatedMatches[i] = { ...updatedMatches[i], homeDisplayName };
                        hasChanges = true;
                    }
                    if (awayDisplayName && awayDisplayName !== match.awayTeamIdentifier) {
                        updatedMatches[i] = { ...updatedMatches[i], awayDisplayName };
                        hasChanges = true;
                    }
                }
                
                if (hasChanges) {
                    setMatches(updatedMatches);
                }
            }, 100);
        }
    };

    // FUNKCIA PRE VÝBER ZÁPASU
     const selectMatch = (match) => {
        setSelectedMatch(match);
        setManualTimeOffset(match.manualTimeOffset || 0);
        updateUrlParameters(match.homeTeamIdentifier, match.awayTeamIdentifier);
        window.currentMatchId = match.id;
    };

    // Zoradenie dní podľa dátumu
    const sortedDays = Object.values(groupedMatches).sort((a, b) => 
        a.date - b.date
    );

    // Ak je vybraný zápas, zobrazíme detail
    if (selectedMatch) {
        const homeTeamName = getTeamNameByIdentifier(selectedMatch.homeTeamIdentifier);
        const awayTeamName = getTeamNameByIdentifier(selectedMatch.awayTeamIdentifier);

//        console.log(`🏠 Domáci: ${homeTeamName}`);
//        console.log(`✈️ Hostia: ${awayTeamName}`);
        
        const homeTeamDetails = getTeamDetailsFromIdentifier(selectedMatch.homeTeamIdentifier);
        const awayTeamDetails = getTeamDetailsFromIdentifier(selectedMatch.awayTeamIdentifier);
        const matchDate = selectedMatch.scheduledTime ? formatDateWithDay(selectedMatch.scheduledTime.toDate()) : 'neurčený';
        const matchStartTime = selectedMatch.scheduledTime ? formatTime(selectedMatch.scheduledTime) : '-- : --';
        const category = categories.find(c => c.name === selectedMatch.categoryName);

        const activeMenStaffHome = homeTeamDetails?.team.menTeamMemberDetails?.filter(m => !m.removedForMatch?.[selectedMatch.id]) || [];
        const activeWomenStaffHome = homeTeamDetails?.team.womenTeamMemberDetails?.filter(m => !m.removedForMatch?.[selectedMatch.id]) || [];

        const activeMenStaffAway = awayTeamDetails?.team.menTeamMemberDetails?.filter(m => !m.removedForMatch?.[selectedMatch.id]) || [];
        const activeWomenStaffAway = awayTeamDetails?.team.womenTeamMemberDetails?.filter(m => !m.removedForMatch?.[selectedMatch.id]) || [];

        // Pridajte túto funkciu do časti if (selectedMatch) { ... }
        const recalculateScores = async () => {
            if (!selectedMatch || !window.db) return;
            
            try {
                // Získame všetky udalosti pre tento zápas zoradené chronologicky
                const eventsRef = collection(window.db, 'matchEvents');
                const q = query(
                    eventsRef, 
                    where("matchId", "==", selectedMatch.id),
                    orderBy("minute", "asc"),
                    orderBy("second", "asc")
                );
                
                const querySnapshot = await getDocs(q);
                const events = [];
                querySnapshot.forEach((doc) => {
                    events.push({ id: doc.id, ...doc.data() });
                });
                
                // Prepočítame skóre pre každú udalosť
                let homeScore = 0;
                let awayScore = 0;
                const updatePromises = [];
                
                for (const event of events) {
                    const scoreBefore = { home: homeScore, away: awayScore };
                    
                    // Aktualizujeme skóre podľa typu udalosti
                    if (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) {
                        if (event.team === 'home') {
                            homeScore++;
                        } else if (event.team === 'away') {
                            awayScore++;
                        }
                    }
                    
                    const scoreAfter = { home: homeScore, away: awayScore };
                    
                    // Ak sa skóre zmenilo, aktualizujeme udalosť
                    if (JSON.stringify(event.scoreBefore) !== JSON.stringify(scoreBefore) || 
                        JSON.stringify(event.scoreAfter) !== JSON.stringify(scoreAfter)) {
                        
                        const eventRef = doc(window.db, 'matchEvents', event.id);
                        updatePromises.push(
                            updateDoc(eventRef, {
                                scoreBefore: scoreBefore,
                                scoreAfter: scoreAfter
                            })
                        );
                    }
                }
                
                // Vykonáme všetky aktualizácie
                if (updatePromises.length > 0) {
                    await Promise.all(updatePromises);
                }
                
            } catch (error) {
                console.error('Chyba pri prepočítavaní skóre:', error);
            }
        };

        // Pridajte novú funkciu pre aktualizáciu zvýraznenej udalosti
        const updateHighlightedEvent = async (newType, newTeam, newSubType, newPlayer) => {
            if (!highlightedEventId || !window.db) {
                // Ak nie je zvýraznený žiadny riadok, správame sa štandardne - pridáme novú udalosť
                addMatchEvent(newType, newTeam, newSubType, newPlayer);
                return;
            }
            
            try {
                const eventRef = doc(window.db, 'matchEvents', highlightedEventId);
                
                // Získame aktuálnu udalosť
                const eventSnap = await getDoc(eventRef);
                if (!eventSnap.exists()) {
                    window.showGlobalNotification('Zvýraznená udalosť už neexistuje', 'error');
                    setHighlightedEventId(null);
                    // Skúsime pridať novú udalosť
                    addMatchEvent(newType, newTeam, newSubType, newPlayer);
                    return;
                }
                
                const currentEvent = eventSnap.data();
                
                // Výpočet nového stavu skóre
                let homeScoreAfter = matchScore.home;
                let awayScoreAfter = matchScore.away;
                
                // Odstránime starý vplyv na skóre (ak to bola gólová udalosť)
                if (currentEvent.type === 'goal' || (currentEvent.type === 'penalty' && currentEvent.subType === 'scored')) {
                    if (currentEvent.team === 'home') {
                        homeScoreAfter--;
                    } else if (currentEvent.team === 'away') {
                        awayScoreAfter--;
                    }
                }
                
                // Pridáme nový vplyv na skóre (ak je to gólová udalosť)
                if (newType === 'goal' || (newType === 'penalty' && newSubType === 'scored')) {
                    if (newTeam === 'home') {
                        homeScoreAfter++;
                    } else if (newTeam === 'away') {
                        awayScoreAfter++;
                    }
                }
                
                // Aktuálny čas v sekundách
                const totalSeconds = matchTime;
                const minute = Math.floor(totalSeconds / 60);
                const second = totalSeconds % 60;
                
                const eventData = {
                    type: newType,
                    team: newTeam,
                    minute: minute,
                    second: second,
                    formattedTime: `${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`,
                    editedAt: Timestamp.now(),
                    editedBy: userProfileData?.email || 'unknown',
                    // Uložíme nový stav
                    scoreBefore: {
                        home: matchScore.home,
                        away: matchScore.away
                    },
                    scoreAfter: {
                        home: homeScoreAfter,
                        away: awayScoreAfter
                    }
                };
                
                if (newType === 'penalty') {
                    eventData.subType = newSubType;
                } else {
                    eventData.subType = null;
                }
                
                if (newPlayer) {
                    const teamDetails = newTeam === 'home' ? homeTeamDetails : awayTeamDetails;
                    const teamIdentifier = newTeam === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
                    
                    let playerRef = null;
                    
                    if (newPlayer.isStaff) {
                        playerRef = createPlayerReference(
                            teamDetails,
                            teamIdentifier,
                            newPlayer,
                            true,
                            newPlayer.staffType,
                            newPlayer.staffIndex
                        );
                    } else {
                        playerRef = createPlayerReference(
                            teamDetails,
                            teamIdentifier,
                            newPlayer,
                            false
                        );
                    }
                    
                    if (playerRef) {
                        eventData.playerRef = playerRef;
                    }
                    
                    if (newType === 'yellow' || newType === 'red' || newType === 'blue' || newType === 'exclusion') {
                        eventData.cardType = newType === 'exclusion' ? 'exclusion' : newType;
                    }
                } else {
                    eventData.playerRef = null;
                }
                
                await updateDoc(eventRef, eventData);
                await recalculateScores();
                
                window.showGlobalNotification('Udalosť bola aktualizovaná', 'success');
                
                // Zrušíme zvýraznenie po úspešnej aktualizácii
                setHighlightedEventId(null);
        
                // Resetujeme stavy tlačidiel
                setSelectedPlayerForEvent(null);
                setEventType(null);
                setEventTeam(null);
                setEventSubType(null);
                
            } catch (error) {
                console.error('Chyba pri aktualizácii udalosti:', error);
                window.showGlobalNotification('Chyba pri aktualizácii udalosti', 'error');
            }
        };

        // Upravte funkciu addMatchEvent, aby používala updateHighlightedEvent ak je zvýraznený riadok
        const addMatchEvent = async (localEventType, localEventTeam, localEventSubType, localPlayer) => {
            if (!selectedMatch || !window.db) return;
            
            // Použijeme lokálne parametre alebo stavové premenné
            const type = localEventType;
            const team = localEventTeam;
            const subType = localEventSubType;
            const player = localPlayer;
            
            if (!type || !team) {
                window.showGlobalNotification('Vyberte typ udalosti a tím', 'error');
                return;
            }
        
            // Pre penalty potrebujeme aj subType
            if (type === 'penalty' && !subType) {
                window.showGlobalNotification('Vyberte typ penalty (premenená/nepremenená)', 'error');
                return;
            }
        
            // Pre gól a vylúčenie potrebujeme vybraného hráča
            if ((type === 'goal' || type === 'exclusion') && !player) {
                window.showGlobalNotification('Vyberte hráča', 'error');
                return;
            }
            
            // Pre penalty potrebujeme vybraného hráča
            if (type === 'penalty' && !player) {
                window.showGlobalNotification('Vyberte hráča pre 7m hod', 'error');
                return;
            }
            
            // AK JE ZVÝRAZNENÝ RIADOK - aktualizujeme existujúcu udalosť
            if (highlightedEventId) {
                await updateHighlightedEvent(type, team, subType, player);
                return;
            }
            
            // Inak pokračujeme s pôvodnou logikou pre pridanie novej udalosti
            try {
                const eventsRef = collection(window.db, 'matchEvents');
                
                // Výpočet minúty a sekundy z celkového času v sekundách
                const totalSeconds = matchTime;
                const minute = Math.floor(totalSeconds / 60);
                const second = totalSeconds % 60;
                
                // Formátovaný čas pre zobrazenie MM:SS
                const formattedTime = `${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
                
                // Výpočet stavu pred gólom
                let homeScoreBefore = matchScore.home;
                let awayScoreBefore = matchScore.away;
                let homeScoreAfter = matchScore.home;
                let awayScoreAfter = matchScore.away;
                
                // Ak ide o gól alebo premenenú penaltu, aktualizujeme skóre
                if (type === 'goal') {
                    // Normálny gól
                    if (team === 'home') {
                        homeScoreAfter = homeScoreBefore + 1;
                    } else if (team === 'away') {
                        awayScoreAfter = awayScoreBefore + 1;
                    }
                } else if (type === 'penalty' && subType === 'scored') {
                    // Premenený 7m
                    if (team === 'home') {
                        homeScoreAfter = homeScoreBefore + 1;
                    } else if (team === 'away') {
                        awayScoreAfter = awayScoreBefore + 1;
                    }
                }
                
                const eventData = {
                    matchId: selectedMatch.id,
                    type: type,
                    team: team,
                    minute: minute,
                    second: second,
                    formattedTime: formattedTime,
                    timestamp: Timestamp.now(),
                    createdBy: userProfileData?.email || 'unknown',
                    createdByUid: userProfileData?.uid || null,
                    // Uloženie stavu
                    scoreBefore: {
                        home: homeScoreBefore,
                        away: awayScoreBefore
                    },
                    scoreAfter: {
                        home: homeScoreAfter,
                        away: awayScoreAfter
                    }
                };
        
                if (player) {
                    // Získame detail tímu podľa identifikátora
                    const teamDetails = team === 'home' ? homeTeamDetails : awayTeamDetails;
                    const teamIdentifier = team === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
                    
                    let playerRef = null;
                    
                    if (player.isStaff) {
                        // Pre člena realizačného tímu
                        playerRef = createPlayerReference(
                            teamDetails, 
                            teamIdentifier, 
                            player, 
                            true, 
                            player.staffType, 
                            player.staffIndex
                        );
                    } else {
                        // Pre hráča
                        playerRef = createPlayerReference(
                            teamDetails, 
                            teamIdentifier, 
                            player, 
                            false
                        );
                    }
                    
                    if (playerRef) {
                        eventData.playerRef = playerRef;
                    }
                    
                    if (type === 'yellow' || type === 'red' || type === 'blue' || type === 'exclusion') {
                        eventData.cardType = type === 'exclusion' ? 'exclusion' : type;
                    }
                }
        
                // Pre penalty ukladáme subType
                if (type === 'penalty') {
                    eventData.subType = subType;
                }
        
                await addDoc(eventsRef, eventData);
                await recalculateScores();
                
                window.showGlobalNotification(`Udalosť bola pridaná v čase ${formattedTime}`, 'success');
                
                // Reset po pridaní
                setSelectedPlayerForEvent(null);
                setEventType(null);
                setEventTeam(null);
                setEventSubType(null);
                
            } catch (error) {
                console.error('Chyba pri pridávaní udalosti:', error);
                window.showGlobalNotification('Chyba pri ukladaní udalosti', 'error');
            }
        };

        // Funkcia na získanie počtu zápasov vylúčenia za modrú kartu z Nastavení tabuľky
        const getBlueCardSuspensionMatches = () => {
            // Predvolená hodnota, ak nie je v sessionStorage
            let suspensionMatches = 1;
            
            try {
                // Skúsime načítať z localStorage (rýchlejšie)
                const storedTableSettings = localStorage.getItem('tableSettings');
                if (storedTableSettings) {
                    const settings = JSON.parse(storedTableSettings);
                    if (settings.blueCardSuspensionMatches !== undefined) {
                        suspensionMatches = settings.blueCardSuspensionMatches;
                    }
                }
            } catch (e) {
                console.warn('Chyba pri načítaní nastavení z localStorage:', e);
            }
            
            return suspensionMatches;
        };
        
        // Funkcia na získanie všetkých zápasov pre daný tím (na zistenie histórie modrých kariet)
        const getTeamMatches = async (teamIdentifier) => {
            if (!window.db || !teamIdentifier) return [];
            
            try {
                const matchesRef = collection(window.db, 'matches');
                const q = query(
                    matchesRef,
                    where("homeTeamIdentifier", "==", teamIdentifier)
                );
                const homeMatchesSnap = await getDocs(q);
                
                const q2 = query(
                    matchesRef,
                    where("awayTeamIdentifier", "==", teamIdentifier)
                );
                const awayMatchesSnap = await getDocs(q2);
                
                const allMatches = [];
                
                homeMatchesSnap.forEach((doc) => {
                    allMatches.push({ id: doc.id, ...doc.data(), teamSide: 'home' });
                });
                
                awayMatchesSnap.forEach((doc) => {
                    allMatches.push({ id: doc.id, ...doc.data(), teamSide: 'away' });
                });
                
                // Zoradenie podľa dátumu (najstaršie prvé)
                allMatches.sort((a, b) => {
                    if (!a.scheduledTime) return 1;
                    if (!b.scheduledTime) return -1;
                    return a.scheduledTime.toDate() - b.scheduledTime.toDate();
                });
                
                return allMatches;
            } catch (error) {
                console.error('Chyba pri načítaní zápasov tímu:', error);
                return [];
            }
        };
        
        // Funkcia na získanie udalostí modrej karty pre konkrétneho hráča v zozname zápasov
        const getBlueCardEventsForPlayer = async (matches, playerIdentifier, currentMatchId) => {
            if (!window.db || !matches.length || !playerIdentifier) return [];
            
            const blueCardEvents = [];
            
            for (const match of matches) {
                if (match.id === currentMatchId) continue;
                
                try {
                    const eventsRef = collection(window.db, 'matchEvents');
                    const q = query(eventsRef, where("matchId", "==", match.id));
                    const eventsSnap = await getDocs(q);
                    
                    eventsSnap.forEach((doc) => {
                        const event = doc.data();
                        if (event.type === 'blue' && event.playerRef) {
                            let isSamePlayer = false;
                            
                            // 🔥 1. NAJLEPŠIE: Porovnanie podľa unikátneho ID hráča
                            if (playerIdentifier.playerId && event.playerRef.playerId) {
                                isSamePlayer = event.playerRef.playerId === playerIdentifier.playerId;
                            }
                            
                            // 2. Porovnanie podľa userId + teamIdentifier + playerIndex (ak nemáme ID)
                            if (!isSamePlayer && !playerIdentifier.playerId) {
                                isSamePlayer = event.playerRef.userId === playerIdentifier.userId &&
                                               event.playerRef.teamIdentifier === playerIdentifier.teamIdentifier &&
                                               event.playerRef.playerIndex === playerIdentifier.playerIndex;
                            }
                            
                            // 3. Porovnanie podľa mena (najmenej spoľahlivé)
                            if (!isSamePlayer && playerIdentifier.playerName) {
                                const playerFullName = `${playerIdentifier.lastName} ${playerIdentifier.firstName}`;
                                isSamePlayer = event.playerRef.playerName === playerFullName;
                            }
                            
                            if (isSamePlayer) {
                                // Získame poradie zápasu (index v zoradenom zozname)
                                const matchIndex = matches.findIndex(m => m.id === match.id);
                                
                                blueCardEvents.push({
                                    matchId: match.id,
                                    matchDate: match.scheduledTime,
                                    eventTimestamp: event.timestamp,
                                    matchStatus: match.status,
                                    matchOrder: matchIndex
                                });
                            }
                        }
                    });
                } catch (error) {
                    console.error('Chyba pri načítaní udalostí zápasu:', error);
                }
            }
            
            // Zoradenie podľa dátumu (najnovšie prvé)
            blueCardEvents.sort((a, b) => {
                if (!a.matchDate) return 1;
                if (!b.matchDate) return -1;
                return b.matchDate.toDate() - a.matchDate.toDate();
            });
            
            return blueCardEvents;
        };
        
        // Funkcia na zistenie, či je hráč v aktívnom treste za modrú kartu
        const isPlayerSuspendedForBlueCard = (blueCardEvents, suspensionMatchesCount, currentMatchOrder) => {
            if (!blueCardEvents.length) return false;
            
            const latestBlueCard = blueCardEvents[0];
            const blueCardMatchOrder = latestBlueCard.matchOrder;
            
            console.log(`📊 Kontrola suspendovania: currentMatchOrder=${currentMatchOrder}, blueCardMatchOrder=${blueCardMatchOrder}, suspensionMatchesCount=${suspensionMatchesCount}`);
            
            if (currentMatchOrder !== undefined && blueCardMatchOrder !== undefined) {
                const matchesPassed = currentMatchOrder - blueCardMatchOrder;
                console.log(`   Zápasy od modrej karty: ${matchesPassed}`);
                
                if (matchesPassed > 0 && matchesPassed <= suspensionMatchesCount) {
                    console.log(`   ✅ HRÁČ JE SUSPENDOVANÝ (musí odohrať ${suspensionMatchesCount} zápasov, aktuálne ${matchesPassed} odohraných)`);
                    return true;
                } else {
                    console.log(`   ❌ HRÁČ NIE JE SUSPENDOVANÝ (trest vypršal alebo ešte nezačal)`);
                }
            }
            
            return false;
        };

        const renderPlayersSection = (teamDetails, teamType, teamName, suspendedPlayers, isLoadingSuspensions, isNameReady) => {

            if (isNameReady === false) {
                return React.createElement(
                    'div',
                    { className: 'mt-4 p-4 text-center' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-center gap-2 text-gray-500' },
                        React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                        React.createElement('span', null, 'Čakám na mapovanie názvu tímu...')
                    )
                );
            }
            
            const teamData = teamDetails?.team;
            
            if (!teamData) {
                return React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'h4',
                        { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                        React.createElement('i', { className: 'fa-solid fa-users text-xs text-gray-500' }),
                        'Hráči (0)'
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-sm text-gray-500 italic p-2' },
                        'Nedostupné'
                    )
                );
            }
            
            // Získanie dĺžky vylúčenia z kategórie (v sekundách) - pre 2-minútové vylúčenia
            const currentCategory = categories.find(c => c.name === selectedMatch?.categoryName);
            const exclusionDurationSeconds = (currentCategory?.exclusionTime || 2) * 60;
            
            // Získanie aktívnych vylúčení pre tento tím (pre 2-minútové vylúčenia počas zápasu)
            const activeExclusions = getActiveExclusions(teamDetails, teamType, matchTime, exclusionDurationSeconds);
            
            // ============================================================================
            // KONTROLA VYLÚČENIA ZA MODRÚ KARTU Z PREDCHÁDZAJÚCICH ZÁPASOV
            // ============================================================================
            
            // Získame počet zápasov vylúčenia z nastavení tabuľky
            const blueCardSuspensionMatches = getBlueCardSuspensionMatches();
            
            // Získame všetkých aktívnych hráčov (ktorí nie sú odstránení pre tento zápas)
            const allActivePlayers = teamData.playerDetails?.filter(p => p && !p.removedForMatch) || [];
            
            // Odfiltrujeme hráčov, ktorí sú momentálne vylúčení (2-minútové vylúčenie počas zápasu)
            const activeExclusionPlayerNames = activeExclusions.map(e => e.playerName);
            const suspendedPlayerIndices = Object.keys(suspendedPlayers || {}).map(Number);
            
            // AKTÍVNI HRÁČI = nie sú v 2-minútovom vylúčení a nie sú suspendovaní za modrú kartu
            const activePlayers = allActivePlayers.filter((p, idx) => {
                const playerFullName = `${p.lastName} ${p.firstName}`;
                const isExcluded = activeExclusionPlayerNames.includes(playerFullName);
                const isSuspended = suspendedPlayerIndices.includes(idx);
                return !isExcluded && !isSuspended;
            });
            
            // OSTATNÍ HRÁČI = suspendovaní za modrú kartu (zobrazia sa v sekcii Ostatní)
            const suspendedForBlueCard = allActivePlayers.filter((p, idx) => suspendedPlayerIndices.includes(idx));
            
            const activePlayersWithOriginalIndex = activePlayers.map(player => ({
                ...player,
                originalIndex: teamData.playerDetails.findIndex(p => 
                    p.firstName === player.firstName && 
                    p.lastName === player.lastName && 
                    p.jerseyNumber === player.jerseyNumber
                )
            }));
            
            const removedPlayers = teamData.matchSpecificRemovals?.[selectedMatch?.id]?.removedPlayersForMatch || [];
            const removedMenStaff = teamData.matchSpecificRemovals?.[selectedMatch?.id]?.removedStaff?.filter(s => s.staffType === 'men') || [];
            const removedWomenStaff = teamData.matchSpecificRemovals?.[selectedMatch?.id]?.removedStaff?.filter(s => s.staffType === 'women') || [];
            
            const activeMenStaff = teamData.menTeamMemberDetails?.filter(m => !m.removedForMatch?.[selectedMatch?.id]) || [];
            const activeWomenStaff = teamData.womenTeamMemberDetails?.filter(m => !m.removedForMatch?.[selectedMatch?.id]) || [];
            
            // Do sekcie Ostatní pridáme aj suspendovaných hráčov
            const allRemovedPlayers = [...removedPlayers, ...suspendedForBlueCard];
            const totalRemoved = allRemovedPlayers.length + removedMenStaff.length + removedWomenStaff.length;
            
            const isMatchCompleted = selectedMatch?.status === 'completed';
            const isMatchInProgress = selectedMatch?.status === 'in-progress' || selectedMatch?.status === 'paused';
            const isMatchScheduled = selectedMatch?.status === 'scheduled';
            const showRemovedSection = totalRemoved > 0;
            const showExclusionsSection = activeExclusions.length > 0 && (selectedMatch?.status === 'in-progress' || selectedMatch?.status === 'paused');
            
            return React.createElement(
                'div',
                null,
                
                // Sekcia VYLÚČENÍ HRÁČI (2-minútové vylúčenia počas zápasu)
                showExclusionsSection && React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200' },
                    React.createElement(
                        'h4',
                        { className: 'font-semibold text-sm text-orange-700 mb-2 flex items-center gap-2' },
                        React.createElement('i', { className: 'fa-solid fa-hourglass-half text-xs' }),
                        `Vylúčenie (${activeExclusions.length})`
                    ),
                    React.createElement(
                        'div',
                        { className: 'space-y-2' },
                        activeExclusions.map((exclusion, idx) => 
                            React.createElement(
                                'div',
                                { 
                                    key: `${teamType}-exclusion-${exclusion.eventId}-${idx}`,
                                    className: 'flex items-center justify-between gap-2 p-2 rounded bg-white border border-orange-200 text-sm'
                                },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center gap-2' },
                                    React.createElement('i', { className: 'fa-solid fa-user-slash text-orange-500 text-xs' }),
                                    exclusion.jerseyNumber && React.createElement(
                                        'span',
                                        { className: 'font-bold text-gray-700 text-xs bg-gray-100 px-1.5 py-0.5 rounded' },
                                        `${exclusion.jerseyNumber}`
                                    ),
                                    React.createElement(
                                        'span',
                                        { className: 'font-medium text-gray-700' },
                                        exclusion.playerName
                                    )
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'exclusion-timer' },
                                    React.createElement('i', { className: 'fa-solid fa-clock mr-1' }),
                                    formatRemainingTime(Math.ceil(exclusion.remainingTime))
                                )
                            )
                        )
                    )
                ),
                
                // Indikátor načítavania suspendovaných hráčov
                isLoadingSuspensions === true && React.createElement(
                    'div',
                    { className: 'text-xs text-gray-400 italic mb-2 flex items-center gap-1' },
                    React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                    'Kontrola vylúčení za modré karty...'
                ),
                
                // Sekcia Hráči (aktívni - nie sú vylúčení počas zápasu ani suspendovaní)
                React.createElement(
                    'h4',
                    { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1 mt-3' },
                    React.createElement('i', { className: 'fa-solid fa-users text-xs text-gray-500' }),
                    `Hráči (${activePlayers.length})`
                ),
                
                // Hlavička pre štatistiky (ak sú zapnuté)
                showPlayerStats && React.createElement(
                    'div',
                    { className: 'grid grid-cols-12 gap-1 mb-2 px-2 text-xs font-semibold text-gray-600 bg-gray-100 py-2 rounded' },
                    React.createElement('div', { className: 'col-span-5 text-left' }, 'Meno'),
                    React.createElement('div', { className: 'col-span-1 text-center' }, 'G'),
                    React.createElement('div', { className: 'col-span-2 text-center' }, '7m'),
                    React.createElement('div', { className: 'col-span-1 text-center' }, 'ŽK'),
                    React.createElement('div', { className: 'col-span-1 text-center' }, 'ČK'),
                    React.createElement('div', { className: 'col-span-1 text-center' }, 'MK'),
                    React.createElement('div', { className: 'col-span-1 text-center' }, '2\'')
                ),
                
                // Zoznam aktívnych hráčov
                React.createElement(
                    'div',
                    { className: showPlayerStats ? 'space-y-1' : 'space-y-1' },
                    activePlayersWithOriginalIndex.length > 0 ? 
                        [...activePlayersWithOriginalIndex]
                            .sort((a, b) => {
                                const numA = a.jerseyNumber ? parseInt(a.jerseyNumber) || 999 : 999;
                                const numB = b.jerseyNumber ? parseInt(b.jerseyNumber) || 999 : 999;
                                return numA - numB;
                            })
                            .map((player, displayIdx) => {
                                const playerIdentifier = {
                                    userId: teamDetails.userId,
                                    teamIdentifier: teamType === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier,
                                    displayName: `${player.lastName} ${player.firstName}${player.jerseyNumber ? ` (#${player.jerseyNumber})` : ''}`,
                                    index: player.originalIndex,
                                    isStaff: false
                                };
                                
                                const stats = showPlayerStats ? getPlayerStats(playerIdentifier) : null;
                                
                                let onClickHandler = undefined;
                                let cursorClass = '';
                                
                                if (isMatchCompleted) {
                                    cursorClass = 'opacity-50 cursor-not-allowed';
                                } else if (isMatchScheduled) {
                                    onClickHandler = () => openEditPlayerModal(player, teamType, teamDetails, false);
                                    cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                } else if (isMatchActionAllowed()) {
                                    onClickHandler = () => {
                                        if (eventType) {
                                            const currentEventType = eventType;
                                            const currentEventSubType = eventSubType;
                                            const currentEventTeam = teamType;
                                            
                                            setEventType(null);
                                            setEventTeam(null);
                                            setEventSubType(null);
                                            setSelectedPlayerForEvent(null);
                                            
                                            if (currentEventType === 'goal' && currentEventSubType === null) {
                                                addMatchEvent('goal', currentEventTeam, null, playerIdentifier);
                                            } else if (currentEventType === 'penalty' && currentEventSubType === 'scored') {
                                                addMatchEvent('penalty', currentEventTeam, 'scored', playerIdentifier);
                                            } else if (currentEventType === 'penalty' && currentEventSubType === 'missed') {
                                                addMatchEvent('penalty', currentEventTeam, 'missed', playerIdentifier);
                                            } else {
                                                addMatchEvent(currentEventType, currentEventTeam, null, playerIdentifier);
                                            }
                                        }
                                    };
                                    cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                } else {
                                    cursorClass = 'cursor-not-allowed opacity-60';
                                }
                                
                                if (showPlayerStats) {
                                    const totalGoals = (stats?.goals || 0) + (stats?.penaltiesScored || 0);
                                    const totalPenalties = (stats?.penaltiesScored || 0) + (stats?.penaltiesMissed || 0);
                                    const penaltiesText = totalPenalties === 0 ? '' : `${stats?.penaltiesScored || 0}/${totalPenalties}`;
                                    
                                    return React.createElement(
                                        'div',
                                        { 
                                            key: `${teamType}-player-${player.id || player.originalIndex}-${player.firstName}-${player.lastName}`, 
                                            className: `grid grid-cols-12 gap-1 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                            onClick: onClickHandler,
                                            title: isMatchCompleted ? 'Zápas je ukončený' : (isMatchScheduled ? 'Kliknite pre úpravu hráča' : '')
                                        },
                                        React.createElement(
                                            'div',
                                            { className: 'col-span-5 flex items-center gap-2 truncate' },
                                            React.createElement('i', { className: 'fa-solid fa-shirt text-gray-600 text-xs flex-shrink-0' }),
                                            player.jerseyNumber && React.createElement(
                                                'span',
                                                { className: 'font-bold text-gray-700 text-xs bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0' },
                                                `${player.jerseyNumber}`
                                            ),
                                            React.createElement(
                                                'span',
                                                { className: 'font-medium truncate' },
                                                `${player.lastName} ${player.firstName}`
                                            )
                                        ),
                                        React.createElement('div', { className: 'col-span-1 text-center font-bold text-green-600' }, 
                                            totalGoals === 0 ? '' : totalGoals
                                        ),
                                        React.createElement('div', { className: 'col-span-2 text-center font-bold text-blue-600' }, 
                                            penaltiesText
                                        ),
                                        React.createElement('div', { className: 'col-span-1 text-center font-bold text-yellow-600' }, 
                                            (stats?.yellowCards || 0) === 0 ? '' : (stats?.yellowCards || 0)
                                        ),
                                        React.createElement('div', { className: 'col-span-1 text-center font-bold text-red-600' }, 
                                            (stats?.redCards || 0) === 0 ? '' : (stats?.redCards || 0)
                                        ),
                                        React.createElement('div', { className: 'col-span-1 text-center font-bold text-blue-800' }, 
                                            (stats?.blueCards || 0) === 0 ? '' : (stats?.blueCards || 0)
                                        ),
                                        React.createElement('div', { className: 'col-span-1 text-center font-bold text-orange-600' }, 
                                            (stats?.exclusions || 0) === 0 ? '' : (stats?.exclusions || 0)
                                        )
                                    );
                                } else {
                                    return React.createElement(
                                        'div',
                                        { 
                                            key: `${teamType}-player-${player.id || player.originalIndex}-${player.firstName}-${player.lastName}`, 
                                            className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                            onClick: onClickHandler,
                                            title: isMatchCompleted ? 'Zápas je ukončený' : (!isMatchActionAllowed() && !isMatchScheduled ? 'Zápas je ukončený' : '')
                                        },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-2' },
                                            React.createElement('i', { className: 'fa-solid fa-shirt text-gray-600 text-xs flex-shrink-0' }),
                                            player.jerseyNumber && React.createElement(
                                                'span',
                                                { className: 'font-bold text-gray-700 text-xs bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0' },
                                                `${player.jerseyNumber}`
                                            ),
                                            React.createElement(
                                                'span',
                                                { className: 'font-medium truncate' },
                                                `${player.lastName} ${player.firstName}`
                                            )
                                        ),
                                        isMatchScheduled && React.createElement(
                                            'i',
                                            { className: 'fa-solid fa-pencil text-xs text-gray-400' }
                                        )
                                    );
                                }
                            })
                        : React.createElement(
                            'div',
                            { className: 'text-sm text-gray-500 italic p-2 text-center' },
                            'Žiadni aktívni hráči'
                        )
                ),
                
                // Sekcia Ostatní (odstránení hráči + suspendovaní za modrú kartu + odstránení členovia RT)
                showRemovedSection && React.createElement(
                    'div',
                    { className: 'mt-4 pt-3 border-t border-gray-200' },
                    React.createElement(
                        'h4',
                        { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                        React.createElement('i', { className: 'fa-solid fa-user-slash text-xs text-gray-500' }),
                        `Ostatní (${totalRemoved})`
                    ),
                    React.createElement(
                        'div',
                        { className: 'space-y-1' },
                        
                        // Suspendovaní hráči za modrú kartu (s info o dôvode)
                        suspendedForBlueCard.map((player, idx) => {
                            const suspensionInfo = suspendedPlayers?.[teamData.playerDetails.findIndex(p => 
                                p.firstName === player.firstName && 
                                p.lastName === player.lastName && 
                                p.jerseyNumber === player.jerseyNumber
                            )];
                            
                            let titleText = suspensionInfo?.reason || 'Hráč je vylúčený';
                            
                            return React.createElement(
                                'div',
                                { 
                                    key: `${teamType}-suspended-blue-${idx}`, 
                                    className: 'flex items-center justify-between gap-2 p-2 rounded border border-red-200 bg-red-50 text-sm cursor-not-allowed opacity-60',
                                    title: titleText
                                },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center gap-2' },
                                    React.createElement('i', { className: 'fa-solid fa-shirt text-red-400 text-xs flex-shrink-0' }),
                                    player.jerseyNumber && React.createElement(
                                        'span',
                                        { className: 'font-bold text-red-600 text-xs bg-red-100 px-1.5 py-0.5 rounded flex-shrink-0' },
                                        `${player.jerseyNumber}`
                                    ),
                                    React.createElement(
                                        'span',
                                        { className: 'font-medium text-red-700' },
                                        `${player.lastName} ${player.firstName}`
                                    ),
                                    React.createElement(
                                        'span',
                                        { className: 'text-xs text-red-500 ml-2' },
                                        suspensionInfo?.reason || 'Vylúčený za modrú kartu'
                                    )
                                )
                            );
                        }),
                        
                        // Bežne odstránení hráči (cez modálne okno)
                        removedPlayers
                            .sort((a, b) => {
                                const numA = a.jerseyNumber ? parseInt(a.jerseyNumber) || 999 : 999;
                                const numB = b.jerseyNumber ? parseInt(b.jerseyNumber) || 999 : 999;
                                return numA - numB;
                            })
                            .map((player, idx) => {
                                let onClickHandler = undefined;
                                let cursorClass = 'cursor-not-allowed opacity-60';
                                
                                if (isMatchScheduled) {
                                    onClickHandler = () => restorePlayerToRoster(player, teamType, teamDetails);
                                    cursorClass = 'cursor-pointer hover:bg-blue-50';
                                }
                                
                                return React.createElement(
                                    'div',
                                    { 
                                        key: `${teamType}-removed-player-${idx}`, 
                                        className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 bg-gray-50 text-sm group relative transition-colors ${cursorClass}`,
                                        onClick: onClickHandler
                                    },
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center gap-2' },
                                        React.createElement('i', { className: 'fa-solid fa-shirt text-gray-400 text-xs flex-shrink-0' }),
                                        player.jerseyNumber && React.createElement(
                                            'span',
                                            { className: 'font-bold text-gray-500 text-xs bg-gray-200 px-1.5 py-0.5 rounded flex-shrink-0' },
                                            `${player.jerseyNumber}`
                                        ),
                                        React.createElement(
                                            'span',
                                            { className: `font-medium ${isMatchScheduled ? 'text-gray-700' : 'text-gray-400'}` },
                                            `${player.lastName} ${player.firstName}`
                                        )
                                    ),
                                    isMatchScheduled && React.createElement(
                                        'i',
                                        { className: 'fa-solid fa-undo text-xs text-green-500' }
                                    )
                                );
                            }),
                        
                        // Odstránení členovia RT (muži)
                        removedMenStaff.map((member, idx) => {
                            let onClickHandler = undefined;
                            let cursorClass = 'cursor-not-allowed opacity-60';
                            
                            if (isMatchScheduled) {
                                onClickHandler = () => restoreStaffToRoster(member, teamType, teamDetails, 'men');
                                cursorClass = 'cursor-pointer hover:bg-blue-50';
                            }
                            
                            return React.createElement(
                                'div',
                                { 
                                    key: `${teamType}-removed-men-${idx}`, 
                                    className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 bg-gray-50 text-sm group relative transition-colors ${cursorClass}`,
                                    onClick: onClickHandler
                                },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center gap-2' },
                                    React.createElement('i', { className: 'fa-solid fa-user text-gray-400 text-xs flex-shrink-0' }),
                                    React.createElement(
                                        'span',
                                        { className: `font-medium ${isMatchScheduled ? 'text-gray-700' : 'text-gray-400'}` },
                                        `${member.lastName} ${member.firstName}`
                                    )
                                ),
                                isMatchScheduled && React.createElement(
                                    'i',
                                    { className: 'fa-solid fa-undo text-xs text-green-500' }
                                )
                            );
                        }),
                        
                        // Odstránení členovia RT (ženy)
                        removedWomenStaff.map((member, idx) => {
                            let onClickHandler = undefined;
                            let cursorClass = 'cursor-not-allowed opacity-60';
                            
                            if (isMatchScheduled) {
                                onClickHandler = () => restoreStaffToRoster(member, teamType, teamDetails, 'women');
                                cursorClass = 'cursor-pointer hover:bg-blue-50';
                            }
                            
                            return React.createElement(
                                'div',
                                { 
                                    key: `${teamType}-removed-women-${idx}`, 
                                    className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 bg-gray-50 text-sm group relative transition-colors ${cursorClass}`,
                                    onClick: onClickHandler
                                },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center gap-2' },
                                    React.createElement('i', { className: 'fa-solid fa-user text-pink-400 text-xs flex-shrink-0' }),
                                    React.createElement(
                                        'span',
                                        { className: `font-medium ${isMatchScheduled ? 'text-gray-700' : 'text-gray-400'}` },
                                        `${member.lastName} ${member.firstName}`
                                    )
                                ),
                                isMatchScheduled && React.createElement(
                                    'i',
                                    { className: 'fa-solid fa-undo text-xs text-green-500' }
                                )
                            );
                        })
                    )
                )
            );
        };
        
        // Zistenie, či má zápas typ (finále, semifinále, o umiestnenie)
        const hasMatchType = selectedMatch.isPlacementMatch || selectedMatch.matchType;
        
        // Získanie zoradených zápasov podľa času pre navigáciu
        const sortedMatchesForNavigation = [...matches].sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return a.scheduledTime.toDate() - b.scheduledTime.toDate();
        });
        
        // Nájdenie indexu aktuálneho zápasu v zoradenom zozname
        const currentIndex = sortedMatchesForNavigation.findIndex(m => m.id === selectedMatch.id);
        
        // Zistenie, či existuje predchádzajúci a nasledujúci zápas
        const hasPrevious = currentIndex > 0;
        const hasNext = currentIndex < sortedMatchesForNavigation.length - 1;
        
        // Funkcie pre navigáciu
        const goToPreviousMatch = () => {
            if (hasPrevious) {
                const previousMatch = sortedMatchesForNavigation[currentIndex - 1];
                selectMatch(previousMatch);
            }
        };
        
        const goToNextMatch = () => {
            if (hasNext) {
                const nextMatch = sortedMatchesForNavigation[currentIndex + 1];
                selectMatch(nextMatch);
            }
        };

        const floatingScoreBox = (selectedMatch.status === 'in-progress' || selectedMatch.status === 'paused') && showFloatingScore && React.createElement(
            'div',
            { className: `floating-score-box ${showFloatingScore ? 'visible' : ''}` },
            React.createElement('span', { className: 'team-name', title: homeTeamName }, 
                (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function' 
                    ? (window.matchTracker.getTeamNameByDisplayId(homeTeamName) ?? homeTeamName)
                    : homeTeamName)
            ),
            React.createElement('span', { className: 'score' }, loadingEvents ? '--' : `${matchScore.home}`),
            React.createElement('span', { className: 'vs' }, ':'),
            React.createElement('span', { className: 'score' }, loadingEvents ? '--' : `${matchScore.away}`),
            React.createElement('span', { className: 'team-name', title: awayTeamName }, 
                (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function' 
                    ? (window.matchTracker.getTeamNameByDisplayId(awayTeamName) ?? awayTeamName)
                    : awayTeamName)
            ),
            React.createElement('div', { className: 'separator' }),
            React.createElement('span', { className: 'match-time' }, formatMatchTime(cleanPlayingTime || 0))
        );
    
        // ✅ HLAVNÝ OBSAH - vykreslenie detailu zápasu
        const mainContent = React.createElement(
            React.Fragment,
            null,
            floatingScoreBox,
            React.createElement(
                'div',
                    { className: 'flex-grow flex justify-center items-start p-4' },
                    React.createElement(
                        'div',
                        { className: 'w-full max-w-6xl bg-white rounded-xl shadow-xl p-8' },
                        
                        // Hlavička s názvom haly a navigačnými tlačidlami
                        React.createElement(
                            'div',
                            { className: 'flex flex-col items-center justify-center mb-8 p-4 -mx-8 -mt-8 rounded-t-xl bg-gradient-to-r from-red-50 to-white border-b border-red-200 relative' },
                            
                            // Tlačidlo "Všetky zápasy" v ľavom hornom rohu
                            React.createElement(
                                'button',
                                { 
                                    onClick: showAllMatches,
                                    className: 'absolute left-4 top-4 flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-gray-700 font-medium'
                                },
                                React.createElement('i', { className: 'fa-solid fa-arrow-left' }),
                                'Všetky zápasy'
                            ),
                            
                            // Navigačné tlačidlá v pravom hornom rohu
                            React.createElement(
                                'div',
                                { className: 'absolute right-4 top-4 flex items-center gap-2' },
                                
                                // Tlačidlo Predchádzajúci zápas (zobrazí sa len ak existuje)
                                hasPrevious && React.createElement(
                                    'button',
                                    { 
                                        onClick: goToPreviousMatch,
                                        className: 'flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-gray-700 font-medium'
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-chevron-left' }),
                                    'Predchádzajúci'
                                ),
                                
                                // Tlačidlo Nasledujúci zápas (zobrazí sa len ak existuje)
                                hasNext && React.createElement(
                                    'button',
                                    { 
                                        onClick: goToNextMatch,
                                        className: 'flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-gray-700 font-medium'
                                    },
                                    'Nasledujúci',
                                    React.createElement('i', { className: 'fa-solid fa-chevron-right' })
                                )
                            ),
                            
                            React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center text-gray-800' }, 'Detail zápasu'),
                            hallName && hallName !== 'Žiadna priradená hala' && React.createElement(
                                'div',
                                { className: 'mt-2 text-xl text-gray-600 flex items-center gap-2' },
                                React.createElement('i', { className: 'fa-solid fa-location-dot text-red-500' }),
                                `Športová hala ${hallName}`
                            )
                        ),
                
                        // Detail zápasu
                        React.createElement(
                            'div',
                            { className: 'mx-auto' },
                            
                            // Dátum a čas
                            React.createElement(
                                'div',
                                { className: 'text-center mb-8 p-4 bg-blue-50 rounded-lg' },
                                React.createElement('div', { className: 'text-lg font-semibold text-gray-700' }, matchDate),
                                React.createElement(
                                    'div', 
                                    { className: 'text-2xl font-bold text-blue-600 mt-1 flex items-center justify-center gap-1' },
                                    `${matchStartTime} hod.`
                                ),
                                // NOVÁ ČASŤ: Informácia o perióde
                                category && React.createElement(
                                    'div',
                                    { className: 'mt-2 text-sm text-gray-600 flex items-center justify-center gap-2' },
                                    React.createElement('span', null, `${category.periods || 2} x ${category.periodDuration || 20} min`),
                                    // Zobrazenie prestávky len ak je definovaná a väčšia ako 0
                                    (() => {
                                        const breakDur = category.breakDuration;
                                        const breakNum = typeof breakDur === 'number' ? breakDur : parseInt(breakDur, 10);
                                        if (breakDur && !isNaN(breakNum) && breakNum > 0) {
                                            return React.createElement(
                                                React.Fragment,
                                                null,
                                                React.createElement('span', { className: 'text-gray-400' }, '•'),
                                                React.createElement('span', null, `Prestávka: ${breakDur} min`)
                                            );
                                        }
                                        return null;
                                    })()
                                )
                            ),       
                            
                            // Tímy
                            React.createElement(
                                'div',
                                { className: 'flex items-center justify-between gap-4 mb-8' },
                                
                                // Domáci tím
                                React.createElement(
                                    'div',
                                    { className: 'flex-1 text-center' },
        //                            React.createElement('div', { className: 'text-sm text-gray-500 mb-2' }, 'DOMÁCI'),
                                    React.createElement('div', { className: 'text-xl font-bold text-gray-800' }, 
                                      window.matchTracker.getTeamNameByDisplayId(homeTeamName) ?? homeTeamName
                                    )
                                ),
                                
                                // VS
                                React.createElement(
                                    'div',
                                    { className: 'text-center' },
                                    React.createElement('div', { className: 'text-3xl font-bold text-gray-400' }, 'VS')
                                ),
                                
                                // Hosťovský tím
                                React.createElement(
                                    'div',
                                    { className: 'flex-1 text-center' },
        //                            React.createElement('div', { className: 'text-sm text-gray-500 mb-2' }, 'HOSTIA'),
                                    React.createElement('div', { className: 'text-xl font-bold text-gray-800' }, 
                                      window.matchTracker.getTeamNameByDisplayId(awayTeamName) ?? awayTeamName
                                    )
                                )
                            ),
                            
                            // Kategória a typ zápasu/skupina
                            React.createElement(
                                'div',
                                { className: 'grid grid-cols-2 gap-4 mb-6' },
                                React.createElement(
                                    'div',
                                    { className: 'bg-gray-50 p-3 rounded-lg text-center' },
                                    React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'Kategória'),
                                    React.createElement('div', { className: 'font-medium' }, selectedMatch.categoryName || 'neurčená')
                                ),
                                
                                // Ak má zápas typ, zobrazíme TYP ZÁPASU (aj keď má skupinu, skupina sa ignoruje)
                                hasMatchType ? React.createElement(
                                    'div',
                                    { className: 'bg-purple-50 p-3 rounded-lg text-center' },
                                    React.createElement('div', { className: 'text-xs text-purple-500 mb-1' }, 'Typ zápasu'),
                                    React.createElement('div', { className: 'font-medium text-purple-700' },
                                        selectedMatch.isPlacementMatch ? `Zápas o ${selectedMatch.placementRank}. miesto` : selectedMatch.matchType
                                    )
                                ) : (() => {
                                    // Získame typ skupiny z groupsData
                                    let groupTypeText = '';
                                    let groupTypeClass = '';
                                    
                                    if (selectedMatch.groupName && groupsData && Object.keys(groupsData).length > 0) {
                                        // Získame ID kategórie podľa názvu
                                        const categoryId = categoryIdMap[selectedMatch.categoryName];
                                        
                                        if (categoryId && groupsData[categoryId] && Array.isArray(groupsData[categoryId])) {
                                            const foundGroup = groupsData[categoryId].find(g => g.name === selectedMatch.groupName);
                                            if (foundGroup && foundGroup.type) {
                                                groupTypeText = foundGroup.type === 'základná skupina' ? 'Základná' : 'Nadstavbová';
                                                groupTypeClass = foundGroup.type === 'základná skupina' ? 'text-green-600' : 'text-blue-600';
                                            } else {
                                                console.log(`⚠️ Skupina ${selectedMatch.groupName} nebola nájdená v groupsData[${categoryId}]`);
                                            }
                                        } else {
                                            console.log(`⚠️ Kategória ${selectedMatch.categoryName} (ID: ${categoryId}) nebola nájdená v groupsData.`);
                                            console.log('Dostupné kategórie v groupsData:', Object.keys(groupsData));
                                        }
                                    }
                                    
                                    return React.createElement(
                                        'div',
                                        { className: 'bg-gray-50 p-3 rounded-lg text-center' },
                                        React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'Skupina'),
                                        React.createElement('div', { className: 'font-medium' }, selectedMatch.groupName || 'neurčená'),
                                        groupTypeText && React.createElement(
                                            'div',
                                            { className: `text-xs ${groupTypeClass} mt-1` },
                                            groupTypeText
                                        )
                                    );
                                })()
                            ),
                            
                            // Status a ovládacie prvky
                            React.createElement(
                                'div',
                                { className: 'bg-gray-50 p-4 rounded-lg mb-8' },
                                
                                // Status
                                React.createElement(
                                    'div',
                                    { className: 'text-center mb-4' },
                                    React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'Status'),
                                    React.createElement(
                                        'div', 
                                        { className: `font-medium ${
                                            selectedMatch.status === 'completed' ? 'text-green-600' : 
                                            selectedMatch.status === 'in-progress' ? 'text-blue-600' :
                                            selectedMatch.status === 'paused' ? 'text-yellow-600' : 
                                            'text-gray-600'
                                        }` },
                                        selectedMatch.status === 'completed' ? 'Odohrané' :
                                        selectedMatch.status === 'in-progress' ? 'Prebieha' :
                                        selectedMatch.status === 'paused' ? 'Pozastavené' : 
                                        'Naplánované'
                                    )
                                ),
                                
                                // PRIEBEH ČASU (nový prvok)
                                (selectedMatch.status === 'in-progress' || selectedMatch.status === 'paused') && React.createElement(
                                    'div',
                                    { className: 'text-center mb-4 p-3 bg-white rounded-lg border border-gray-200' },
                                    React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'Priebeh času'),
                                    React.createElement(
                                        'div',
                                        { className: 'text-3xl font-mono font-bold' },
                                        formatMatchTime(cleanPlayingTime || 0)
                                    )
                                ),
                                
                                // Ovládacie prvky pre adminov a hall users (ZOBRAZENÉ VŽDY)
                                (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && 
                                React.createElement(
                                    'div',
                                    { className: 'flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-gray-200' },
                                    
                                    // Čas štart / Čas stop / Pokračovať
                                    selectedMatch.status === 'in-progress' ? 
                                        React.createElement(
                                            'button',
                                            {
                                                className: 'px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                                onClick: () => stopMatchTimer(selectedMatch.id)
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-pause' }),
                                            'Čas stop'
                                        ) :
                                        selectedMatch.status === 'paused' ?
                                        React.createElement(
                                            'button',
                                            {
                                                className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                                    isResumeAllowed()
                                                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                                                        : 'bg-white text-green-600 border-2 border-green-600 cursor-not-allowed'
                                                }`,
                                                onClick: isResumeAllowed() ? () => resumeMatchTimer(selectedMatch.id) : undefined,
                                                disabled: !isResumeAllowed(),
                                                title: isResumeAllowed() ? 'Pokračovať v zápase' : selectedMatch.status === 'completed' ? 'Zápas je ukončený' : 'Nie je možné pokračovať - koniec periódy'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-play' }),
                                            'Pokračovať'
                                        ) :
                                        React.createElement(
                                            'button',
                                            {
                                                className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                                    isStartTimerAllowed()
                                                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                                                        : 'bg-white text-green-600 border-2 border-green-600 cursor-not-allowed'
                                                }`,
                                                onClick: isStartTimerAllowed() ? () => startMatchTimer(selectedMatch.id) : undefined,
                                                disabled: !isStartTimerAllowed(),
                                                title: isStartTimerAllowed() ? 'Spustiť čas zápasu' : 'Zápas už prebieha alebo je ukončený'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-play' }),
                                            'Čas štart'
                                        ),
                                    
                                    // Manuálne ovládanie času
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center gap-1 bg-gray-100 rounded-lg p-1' },
                                        React.createElement(
                                            'button',
                                            {
                                                className: `w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                                                    isSubtractMinuteAllowed()
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                                        : 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                                }`,
                                                onClick: isSubtractMinuteAllowed() ? subtractMinute : undefined,
                                                disabled: !isSubtractMinuteAllowed(),
                                                title: isSubtractMinuteAllowed() ? 'Odčítať minútu' : 'Nie je možné odčítať minútu - sme na začiatku periódy'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-minus' })
                                        ),
                                        React.createElement(
                                            'span',
                                            { className: 'px-2 text-sm font-medium text-gray-700' },
                                            'min'
                                        ),
                                        React.createElement(
                                            'button',
                                            {
                                                className: `w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                                                    isAddMinuteAllowed()
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                                        : 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                                }`,
                                                onClick: isAddMinuteAllowed() ? addMinute : undefined,
                                                disabled: !isAddMinuteAllowed(),
                                                title: isAddMinuteAllowed() ? 'Pridať minútu' : 'Nie je možné pridať minútu - koniec periódy'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-plus' })
                                        )
                                    ),
                                    
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center gap-1 bg-gray-100 rounded-lg p-1' },
                                        React.createElement(
                                            'button',
                                            {
                                                className: `w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                                                    isSubtractSecondAllowed()
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                                        : 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                                }`,
                                                onClick: isSubtractSecondAllowed() ? subtractSecond : undefined,
                                                disabled: !isSubtractSecondAllowed(),
                                                title: isSubtractSecondAllowed() ? 'Odčítať sekundu' : 'Nie je možné odčítať sekundu - sme na začiatku periódy'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-minus' })
                                        ),
                                        React.createElement(
                                            'span',
                                            { className: 'px-2 text-sm font-medium text-gray-700' },
                                            'sec'
                                        ),
                                        React.createElement(
                                            'button',
                                            {
                                                className: `w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                                                    isAddSecondAllowed()
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                                        : 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                                }`,
                                                onClick: isAddSecondAllowed() ? addSecond : undefined,
                                                disabled: !isAddSecondAllowed(),
                                                title: isAddSecondAllowed() ? 'Pridať sekundu' : 'Nie je možné pridať sekundu - koniec periódy'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-plus' })
                                        )
                                    ),
                                    
                                    // Perióda +/- (ak má kategória viac ako 1 periódu)
                                    category && category.periods > 1 && React.createElement(
                                        'div',
                                        { className: 'flex items-center gap-1 bg-gray-100 rounded-lg p-1' },
                                        React.createElement(
                                            'button',
                                            {
                                                className: `w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                                                    isDecreasePeriodAllowed()
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                                        : 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                                }`,
                                                onClick: isDecreasePeriodAllowed() ? () => decreasePeriod(selectedMatch.id) : undefined,
                                                disabled: !isDecreasePeriodAllowed(),
                                                title: isDecreasePeriodAllowed() ? 'Znížiť periódu' : 'Prvá perióda'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-minus' })
                                        ),
                                        React.createElement(
                                            'span',
                                            { className: 'px-2 text-sm font-medium text-gray-700' },
                                            `${selectedMatch.currentPeriod || 1} / ${category.periods}`
                                        ),
                                        React.createElement(
                                            'button',
                                            {
                                                className: `w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                                                    isIncreasePeriodAllowed()
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                                        : 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                                }`,
                                                onClick: isIncreasePeriodAllowed() ? () => increasePeriod(selectedMatch.id, category.periods) : undefined,
                                                disabled: !isIncreasePeriodAllowed(),
                                                title: isIncreasePeriodAllowed() ? 'Zvýšiť periódu' : 'Posledná perióda'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-plus' })
                                        )
                                    ),
                                    
                                    // Reset zápasu (vždy zobrazený)
                                    React.createElement(
                                        'button',
                                        {
                                            className: 'px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                            onClick: () => openResetModal(selectedMatch.id)
                                        },
                                        React.createElement('i', { className: 'fa-solid fa-rotate-right' }),
                                        'Reset'
                                    ),
                                    
                                    // Ukončiť zápas (zobrazí sa len pre neukončené zápasy)
                                    (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && React.createElement(
                                        'button',
                                        {
                                            className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                                selectedMatch.status === 'completed'
                                                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                                                    : 'bg-red-600 hover:bg-red-700 text-white'
                                            }`,
                                            onClick: () => {
                                                if (selectedMatch.status === 'completed') {
                                                    revertMatchToInProgress(selectedMatch.id);
                                                } else {
                                                    endMatch(selectedMatch.id);
                                                }
                                            },
                                            title: selectedMatch.status === 'completed' ? 'Obnoviť zápas do stavu Prebieha' : 'Ukončiť zápas'
                                        },
                                        React.createElement('i', { className: selectedMatch.status === 'completed' ? 'fa-solid fa-play' : 'fa-solid fa-flag-checkered' }),
                                        selectedMatch.status === 'completed' ? 'Obnoviť zápas' : 'Ukončiť zápas'
                                    ),

                                    (selectedMatch.status !== 'completed') && React.createElement(
                                        'button',
                                        {
                                            className: 'px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                            onClick: () => {
                                                setManualScoreMatchId(selectedMatch.id);
                                                setManualHomeScore('');
                                                setManualAwayScore('');
                                                setManualScoreModalOpen(true);
                                            }
                                        },
                                        React.createElement('i', { className: 'fa-solid fa-pen-to-square' }),
                                        'Zadať výsledok manuálne'
                                    ),

                                    // Tlačidlo Kontumácia zápasu (len pre neukončené zápasy)
                                    (selectedMatch.status !== 'completed') && React.createElement(
                                        'div',
                                        { className: 'relative inline-block' },
                                        React.createElement(
                                            'button',
                                            {
                                                className: 'px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                                onClick: () => {
                                                    setForfeitMatchId(selectedMatch.id);
                                                    setForfeitTeam(null);
                                                    setForfeitModalOpen(true);
                                                }
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-gavel' }),
                                            'Kontumácia'
                                        )
                                    ),
                
                                    React.createElement(
                                        'button',
                                        {
                                            className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                                showPlayerStats 
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                                    : 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50'
                                            }`,
                                            onClick: togglePlayerStats,
                                            title: showPlayerStats ? 'Skryť štatistiky' : 'Zobraziť štatistiky'
                                        },
                                        React.createElement('i', { className: 'fa-solid fa-chart-simple' }),
                                        'Štatistiky'
                                    )
                                )
                            ),
                            
                            // DETAILY TÍMOV - realizačný tím, hráči a priebeh zápasu
                            React.createElement(
                                'div',
                                { className: `transition-all duration-300` },
                                
                                // Keď nie sú štatistiky - grid so 4 stĺpcami (domáci, priebeh, hosťovský, prázdny)
                                !showPlayerStats ? React.createElement(
                                    'div',
                                    { className: 'grid grid-cols-4 gap-6' },
                                    
                                    // Domáci tím - detail
                                    React.createElement(
                                        'div',
                                        { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
                                        React.createElement(
                                            'h3',
                                            { className: 'font-bold text-lg text-gray-800 mb-3 text-center border-b border-gray-200 pb-2' },
                                            window.matchTracker.getTeamNameByDisplayId(homeTeamName) ?? homeTeamName
                                        ),
                                        
                                        // Realizačný tím pre domáci tím
                                        React.createElement(
                                            'div',
                                            { className: 'mb-4' },
                                            React.createElement(
                                                'h4',
                                                { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                                                React.createElement('i', { className: 'fa-solid fa-user-tie text-xs text-gray-500' }),
                                                'Realizačný tím'
                                            ),
                                            
                                            homeTeamDetails ? React.createElement(
                                                'div',
                                                { className: 'space-y-2' },
        
                                                // Muži v realizačnom tíme pre domáci tím (normálny režim)
                                                activeMenStaffHome.length > 0 && 
                                                React.createElement(
                                                    React.Fragment,
                                                    null,
                                                    activeMenStaffHome.map((member, idx) => {
                                                        const staffIdentifier = {
                                                            userId: homeTeamDetails.userId,
                                                            teamIdentifier: selectedMatch.homeTeamIdentifier,
                                                            displayName: `${member.lastName} ${member.firstName} (tréner)`,
                                                            isStaff: true,
                                                            staffType: 'men',
                                                            staffIndex: idx
                                                        };
                                                        
                                                        let onClickHandler = undefined;
                                                        let cursorClass = '';
                                                        
                                                        if (selectedMatch?.status === 'scheduled') {
                                                            onClickHandler = () => openEditStaffModal(member, 'home', homeTeamDetails, 'men', idx);
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else if (isMatchActionAllowed()) {
                                                            onClickHandler = () => {
                                                                if (eventType) {
                                                                    if (eventType === 'goal' || eventType === 'penalty') {
                                                                        window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                        return;
                                                                    }
                                                                    addMatchEvent(eventType, 'home', null, staffIdentifier);
                                                                }
                                                            };
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else {
                                                            cursorClass = 'cursor-not-allowed opacity-60';
                                                        }
                                                        
                                                        return React.createElement(
                                                            'div',
                                                            { 
                                                                key: `home-men-${idx}`, 
                                                                className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                onClick: onClickHandler,
                                                                title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                            },
                                                            React.createElement(
                                                                'div',
                                                                { className: 'flex items-center gap-2' },
                                                                React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs flex-shrink-0' }),
                                                                React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                            ),
                                                            selectedMatch?.status === 'scheduled' && React.createElement(
                                                                'i',
                                                                { className: 'fa-solid fa-pencil text-xs text-gray-400' }
                                                            )
                                                        );
                                                    })
                                                ),
                                                
                                                // Ženy v realizačnom tíme pre domáci tím (normálny režim)
                                                activeWomenStaffHome.length > 0 && 
                                                React.createElement(
                                                    React.Fragment,
                                                    null,
                                                    activeWomenStaffHome.map((member, idx) => {
                                                        const staffIdentifier = {
                                                            userId: homeTeamDetails.userId,
                                                            teamIdentifier: selectedMatch.homeTeamIdentifier,
                                                            displayName: `${member.lastName} ${member.firstName} (trénerka)`,
                                                            isStaff: true,
                                                            staffType: 'women',
                                                            staffIndex: idx
                                                        };
                                                        
                                                        let onClickHandler = undefined;
                                                        let cursorClass = '';
                                                        
                                                        if (selectedMatch?.status === 'scheduled') {
                                                            onClickHandler = () => openEditStaffModal(member, 'home', homeTeamDetails, 'women', idx);
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else if (isMatchActionAllowed()) {
                                                            onClickHandler = () => {
                                                                if (eventType) {
                                                                    if (eventType === 'goal' || eventType === 'penalty') {
                                                                        window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                        return;
                                                                    }
                                                                    addMatchEvent(eventType, 'home', null, staffIdentifier);
                                                                }
                                                            };
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else {
                                                            cursorClass = 'cursor-not-allowed opacity-60';
                                                        }
                                                        
                                                        return React.createElement(
                                                            'div',
                                                            { 
                                                                key: `home-women-${idx}`, 
                                                                className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                onClick: onClickHandler,
                                                                title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                            },
                                                            React.createElement(
                                                                'div',
                                                                { className: 'flex items-center gap-2' },
                                                                React.createElement('i', { className: 'fa-solid fa-user text-pink-600 text-xs flex-shrink-0' }),
                                                                React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                            ),
                                                            selectedMatch?.status === 'scheduled' && React.createElement(
                                                                'i',
                                                                { className: 'fa-solid fa-pencil text-xs text-gray-400' }
                                                            )
                                                        );
                                                    })
                                                ),
                                                
                                                (!homeTeamDetails.team.menTeamMemberDetails || homeTeamDetails.team.menTeamMemberDetails.length === 0) &&
                                                (!homeTeamDetails.team.womenTeamMemberDetails || homeTeamDetails.team.womenTeamMemberDetails.length === 0) &&
                                                React.createElement(
                                                    'div',
                                                    { className: 'text-sm text-gray-500 italic p-2' },
                                                    'Žiadni členovia realizačného tímu'
                                                )
                                            ) : React.createElement(
                                                'div',
                                                { className: 'text-sm text-gray-500 italic p-2' },
                                                'Nedostupné'
                                            )
                                        ),
                                        
                                        // Hráči pre domáci tím - POUŽITE FUNKCIU renderPlayersSection
                                        renderPlayersSection(homeTeamDetails, 'home', homeTeamName, suspendedPlayersHome, isLoadingSuspensionsHome, homeTeamNameReady)
                                    ),
                                    
                                    // Box s priebehom zápasu (medzi tímami)
                                    React.createElement(
                                        'div',
                                        { className: 'col-span-2 bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col match-progress-section' },
                                        React.createElement(
                                            'h3',
                                            { className: 'font-bold text-lg text-gray-800 mb-3 text-center border-b border-gray-200 pb-2' },
                                            'Priebeh zápasu'
                                        ),
                                        
                                        // Skóre
                                        React.createElement(
                                            'div',
                                            { className: 'mb-4 text-center' },
                                            React.createElement(
                                                'div',
                                                { className: 'text-3xl font-bold text-gray-800 mb-1' },
                                                loadingEvents ? '--:--' : `${matchScore.home} : ${matchScore.away}`
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'text-xs text-gray-500' },
                                                selectedMatch?.status === 'completed' ? 'Konečný výsledok' : 'Aktuálne skóre'
                                            )
                                        ),
                                        
                                        // Ovládacie tlačidlá pre adminov a hall users
                                        (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && React.createElement(
                                            'div',
                                            { className: 'flex flex-wrap gap-2 justify-center mb-4' },
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-green-600 border-green-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'goal' && eventSubType === null
                                                                ? 'bg-green-600 text-white border-green-600'
                                                                : eventType === 'penalty' && eventSubType === 'scored'
                                                                ? 'bg-green-600 text-white border-green-600'
                                                                : 'bg-white text-green-600 border-green-600 hover:bg-green-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed() 
                                                        ? () => {
                                                            if (eventType === 'penalty' && eventSubType === 'missed') {
                                                                setEventType('penalty');
                                                                setEventSubType('scored');
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } 
                                                            else if (eventType === 'penalty' && eventSubType === 'scored') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                            else if (eventType === 'goal' && eventSubType === null) {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } 
                                                            else {
                                                                setEventType('goal');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-futbol ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-green-600'
                                                        : (eventType === 'goal' && eventSubType === null) || (eventType === 'penalty' && eventSubType === 'scored')
                                                            ? 'text-white' 
                                                            : 'text-green-600'
                                                }` }),
                                                'Gól'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-blue-600 border-blue-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'penalty' && (eventSubType === 'missed' || eventSubType === 'scored')
                                                                ? 'bg-blue-600 text-white border-blue-600' 
                                                                : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'penalty') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('penalty');
                                                                setEventSubType('missed');
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-circle-dot ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-blue-600'
                                                        : eventType === 'penalty' ? 'text-white' : 'text-blue-600'
                                                }` }),
                                                '7m'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-yellow-600 border-yellow-500 cursor-not-allowed opacity-50'
                                                            : eventType === 'yellow' 
                                                                ? 'bg-yellow-500 text-white border-yellow-500' 
                                                                : 'bg-white text-yellow-600 border-yellow-500 hover:bg-yellow-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'yellow') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('yellow');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-square ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-yellow-600'
                                                        : eventType === 'yellow' ? 'text-white' : 'text-yellow-600'
                                                }` }),
                                                'ŽK'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-red-600 border-red-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'red' 
                                                                ? 'bg-red-600 text-white border-red-600' 
                                                                : 'bg-white text-red-600 border-red-600 hover:bg-red-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'red') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('red');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-square ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-red-600'
                                                        : eventType === 'red' ? 'text-white' : 'text-red-600'
                                                }` }),
                                                'ČK'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-blue-800 border-blue-800 cursor-not-allowed opacity-50'
                                                            : eventType === 'blue' 
                                                                ? 'bg-blue-800 text-white border-blue-800' 
                                                                : 'bg-white text-blue-800 border-blue-800 hover:bg-blue-100'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'blue') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('blue');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-square ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-blue-800'
                                                        : eventType === 'blue' ? 'text-white' : 'text-blue-800'
                                                }` }),
                                                'MK'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-orange-600 border-orange-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'exclusion' 
                                                                ? 'bg-orange-600 text-white border-orange-600' 
                                                                : 'bg-white text-orange-600 border-orange-600 hover:bg-orange-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'exclusion') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('exclusion');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-user-slash ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-orange-600'
                                                        : eventType === 'exclusion' ? 'text-white' : 'text-orange-600'
                                                }` }),
                                                'Vylúčenie'
                                            )
                                        ),
                                        
                                        // Zoznam udalostí
                                        React.createElement(
                                            'div',
                                            { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
                                            React.createElement(
                                                'h4',
                                                { className: 'font-semibold text-sm text-gray-700 mb-3 flex items-center gap-1' },
                                                React.createElement('i', { className: 'fa-solid fa-clock text-xs text-gray-500' }),
                                                'Priebeh zápasu',
                                                loadingEvents && React.createElement('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 ml-2' })
                                            ),
                                            
                                            matchEvents.length === 0 ? React.createElement(
                                                'div',
                                                { className: 'text-sm text-gray-500 italic p-4 text-center' },
                                                'Zatiaľ žiadne udalosti'
                                            ) : React.createElement(
                                                'div',
                                                { className: 'space-y-1' },
                                                
                                                matchEvents.map((event) => {
                                                    const isHighlighted = highlightedEventId === event.id;
                                                    const playerName = event.playerRef ? getPlayerNameFromRef(event.playerRef) : '';
                                                    
                                                    let jerseyNumber = '';
                                                    if (event.playerRef && !event.playerRef.staffType) {
                                                        // Použijeme novú funkciu na získanie čísla dresu
                                                        jerseyNumber = getJerseyNumberFromRef(event.playerRef);
                                                    }
                                                    
                                                    let eventIcon = '';
                                                    switch (event.type) {
                                                        case 'goal':
                                                            eventIcon = React.createElement('i', { className: 'fa-solid fa-futbol text-black text-sm' });
                                                            break;
                                                        case 'penalty':
                                                            eventIcon = React.createElement('div', { className: 'relative inline-flex items-center justify-center' },
                                                                React.createElement('i', { className: `fa-solid fa-futbol ${event.subType === 'scored' ? 'text-green-600' : 'text-red-600'} text-sm` }),
                                                                React.createElement('span', { className: `absolute -bottom-1 -right-2 text-[8px] font-bold ${event.subType === 'scored' ? 'text-green-600' : 'text-red-600'}` }, '7m')
                                                            );
                                                            break;
                                                        case 'yellow':
                                                            eventIcon = React.createElement('div', { className: 'w-4 h-5 bg-yellow-400 rounded-sm' });
                                                            break;
                                                        case 'red':
                                                            eventIcon = React.createElement('div', { className: 'w-4 h-5 bg-red-600 rounded-sm' });
                                                            break;
                                                        case 'blue':
                                                            eventIcon = React.createElement('div', { className: 'w-4 h-5 bg-blue-600 rounded-sm' });
                                                            break;
                                                        case 'exclusion':
                                                            eventIcon = React.createElement('span', { className: 'font-bold text-orange-600' }, '2\'');
                                                            break;
                                                        default:
                                                            eventIcon = React.createElement('i', { className: 'fa-solid fa-clock text-gray-600 text-sm' });
                                                    }
                                                    
                                                    const nameParts = playerName.split(' ');
                                                    const firstName = nameParts[0] || '';
                                                    const lastName = nameParts.slice(1).join(' ') || '';
                                                    const isStaff = event.playerRef?.staffType ? true : false;
                                                    const scoreBefore = event.scoreBefore || { home: 0, away: 0 };
                                                    const scoreAfter = event.scoreAfter || { home: 0, away: 0 };
                                                    
                                                    return React.createElement(
                                                        'div',
                                                        { 
                                                            key: event.id,
                                                            className: `grid grid-cols-[1fr_20px_50px_30px_60px_30px_50px_20px_1fr] gap-1 hover:bg-blue-50 transition-colors relative ${isHighlighted ? 'row-highlighted' : ''}`,
                                                        },
                                                        React.createElement('div', { className: `flex flex-col leading-tight text-right p-2` },
                                                            event.team === 'home' && React.createElement(
                                                                React.Fragment,
                                                                null,
                                                                React.createElement('span', { className: 'text-gray-700 text-xs font-medium' }, firstName),
                                                                lastName && React.createElement('span', { className: 'text-gray-700 text-xs' }, lastName)
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-end items-center p-2` },
                                                            event.team === 'home' && !isStaff && jerseyNumber && React.createElement(
                                                                'span',
                                                                { className: 'inline-block w-6 h-6 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center justify-center' },
                                                                jerseyNumber
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `text-center p-2` },
                                                            (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) && event.team === 'home' && React.createElement(
                                                                'span',
                                                                { className: 'inline-block px-2 py-1 rounded-full text-xs font-bold text-gray-700' },
                                                                `${scoreAfter.home}:${scoreAfter.away}`
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-center items-center p-2` },
                                                            event.team === 'home' && eventIcon
                                                        ),
                                                        React.createElement('div', { className: `text-center relative p-2 group` },
                                                            React.createElement('span', { className: `font-mono text-xs text-gray-800 ${(userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && selectedMatch?.status !== 'completed' ? 'group-hover:hidden' : ''}` },
                                                                `${event.minute}:${event.second?.toString().padStart(2, '0') || '00'}`
                                                            ),
                                                            (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && 
                                                            selectedMatch?.status !== 'completed' && React.createElement(
                                                                'div',
                                                                { className: 'hidden group-hover:flex items-center justify-center gap-2' },
                                                                React.createElement('button', { className: `text-blue-500 hover:text-blue-700 ${isHighlighted ? 'opacity-100' : ''}`, onClick: (e) => { e.stopPropagation(); highlightEventRow(event.id); }, title: isHighlighted ? 'Zrušiť zvýraznenie' : 'Zvýrazniť riadok' },
                                                                    React.createElement('i', { className: 'fa-solid fa-pencil text-xs' })
                                                                ),
                                                                React.createElement('button', { className: 'text-red-500 hover:text-red-700', onClick: (e) => { e.stopPropagation(); deleteMatchEvent(event.id); }, title: 'Zmazať udalosť' },
                                                                    React.createElement('i', { className: 'fa-solid fa-trash-can text-xs' })
                                                                )
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-center items-center p-2` },
                                                            event.team === 'away' && eventIcon
                                                        ),
                                                        React.createElement('div', { className: `text-center p-2` },
                                                            (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) && event.team === 'away' && React.createElement(
                                                                'span',
                                                                { className: 'inline-block px-2 py-1 rounded-full text-xs font-bold text-gray-700' }, 
                                                                `${scoreAfter.home}:${scoreAfter.away}`
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-start items-center p-2` },
                                                            event.team === 'away' && !isStaff && jerseyNumber && React.createElement(
                                                                'span',
                                                                { className: 'inline-block w-6 h-6 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center justify-center' },
                                                                jerseyNumber
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex flex-col leading-tight text-left p-2` },
                                                            event.team === 'away' && React.createElement(
                                                                React.Fragment,
                                                                null,
                                                                React.createElement('span', { className: 'text-gray-700 text-xs font-medium' }, firstName),
                                                                lastName && React.createElement('span', { className: 'text-gray-700 text-xs' }, lastName)
                                                            )
                                                        )
                                                    );
                                                })
                                            )
                                        )
                                    ),
                                    
                                    // Hosťovský tím - detail
                                    React.createElement(
                                        'div',
                                        { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
                                        React.createElement(
                                            'h3',
                                            { className: 'font-bold text-lg text-gray-800 mb-3 text-center border-b border-gray-200 pb-2' },
                                            window.matchTracker.getTeamNameByDisplayId(awayTeamName) ?? awayTeamName
                                        ),
                                        
                                        // Realizačný tím pre hosťovský tím
                                        React.createElement(
                                            'div',
                                            { className: 'mb-4' },
                                            React.createElement(
                                                'h4',
                                                { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                                                React.createElement('i', { className: 'fa-solid fa-user-tie text-xs text-gray-500' }),
                                                'Realizačný tím'
                                            ),
                                            
                                            awayTeamDetails ? React.createElement(
                                                'div',
                                                { className: 'space-y-2' },
                                                
                                                // Muži v realizačnom tíme pre hosťovský tím (normálny režim)
                                                activeMenStaffAway.length > 0 && 
                                                React.createElement(
                                                    React.Fragment,
                                                    null,
                                                    activeMenStaffAway.map((member, idx) => {
                                                        const staffIdentifier = {
                                                            userId: awayTeamDetails.userId,
                                                            teamIdentifier: selectedMatch.awayTeamIdentifier,
                                                            displayName: `${member.lastName} ${member.firstName} (tréner)`,
                                                            isStaff: true,
                                                            staffType: 'men',
                                                            staffIndex: idx
                                                        };
                                                        
                                                        let onClickHandler = undefined;
                                                        let cursorClass = '';
                                                        
                                                        if (selectedMatch?.status === 'scheduled') {
                                                            onClickHandler = () => openEditStaffModal(member, 'away', awayTeamDetails, 'men', idx);
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else if (isMatchActionAllowed()) {
                                                            onClickHandler = () => {
                                                                if (eventType) {
                                                                    if (eventType === 'goal' || eventType === 'penalty') {
                                                                        window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                        return;
                                                                    }
                                                                    addMatchEvent(eventType, 'away', null, staffIdentifier);
                                                                }
                                                            };
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else {
                                                            cursorClass = 'cursor-not-allowed opacity-60';
                                                        }
                                                        
                                                        return React.createElement(
                                                            'div',
                                                            { 
                                                                key: `away-men-${idx}`, 
                                                                className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                onClick: onClickHandler,
                                                                title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                            },
                                                            React.createElement(
                                                                'div',
                                                                { className: 'flex items-center gap-2' },
                                                                React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs flex-shrink-0' }),
                                                                React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                            ),
                                                            selectedMatch?.status === 'scheduled' && React.createElement(
                                                                'i',
                                                                { className: 'fa-solid fa-pencil text-xs text-gray-400' }
                                                            )
                                                        );
                                                    })
                                                ),
                                                
                                                // Ženy v realizačnom tíme pre hosťovský tím (normálny režim)
                                                activeWomenStaffAway.length > 0 && 
                                                React.createElement(
                                                    React.Fragment,
                                                    null,
                                                    activeWomenStaffAway.map((member, idx) => {
                                                        const staffIdentifier = {
                                                            userId: awayTeamDetails.userId,
                                                            teamIdentifier: selectedMatch.awayTeamIdentifier,
                                                            displayName: `${member.lastName} ${member.firstName} (trénerka)`,
                                                            isStaff: true,
                                                            staffType: 'women',
                                                            staffIndex: idx
                                                        };
                                                        
                                                        let onClickHandler = undefined;
                                                        let cursorClass = '';
                                                        
                                                        if (selectedMatch?.status === 'scheduled') {
                                                            onClickHandler = () => openEditStaffModal(member, 'away', awayTeamDetails, 'women', idx);
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else if (isMatchActionAllowed()) {
                                                            onClickHandler = () => {
                                                                if (eventType) {
                                                                    if (eventType === 'goal' || eventType === 'penalty') {
                                                                        window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                        return;
                                                                    }
                                                                    addMatchEvent(eventType, 'away', null, staffIdentifier);
                                                                }
                                                            };
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else {
                                                            cursorClass = 'cursor-not-allowed opacity-60';
                                                        }
                                                        
                                                        return React.createElement(
                                                            'div',
                                                            { 
                                                                key: `away-women-${idx}`, 
                                                                className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                onClick: onClickHandler,
                                                                title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                            },
                                                            React.createElement(
                                                                'div',
                                                                { className: 'flex items-center gap-2' },
                                                                React.createElement('i', { className: 'fa-solid fa-user text-pink-600 text-xs flex-shrink-0' }),
                                                                React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                            ),
                                                            selectedMatch?.status === 'scheduled' && React.createElement(
                                                                'i',
                                                                { className: 'fa-solid fa-pencil text-xs text-gray-400' }
                                                            )
                                                        );
                                                    })
                                                ),
                                                
                                                (!awayTeamDetails.team.menTeamMemberDetails || awayTeamDetails.team.menTeamMemberDetails.length === 0) &&
                                                (!awayTeamDetails.team.womenTeamMemberDetails || awayTeamDetails.team.womenTeamMemberDetails.length === 0) &&
                                                React.createElement(
                                                    'div',
                                                    { className: 'text-sm text-gray-500 italic p-2' },
                                                    'Žiadni členovia realizačného tímu'
                                                )
                                            ) : React.createElement(
                                                'div',
                                                { className: 'text-sm text-gray-500 italic p-2' },
                                                'Nedostupné'
                                            )
                                        ),
                                        
                                        // Hráči hosťovského tímu - POUŽITE FUNKCIU renderPlayersSection
                                        renderPlayersSection(awayTeamDetails, 'away', awayTeamName, suspendedPlayersAway, isLoadingSuspensionsAway, awayTeamNameReady)
                                    ),
                                    
                                    // Prázdny stĺpec pre zarovnanie
                                    React.createElement('div', { className: '' })
                                ) : 
                                // Keď sú štatistiky - grid s 2 stĺpcami (domáci a hosťovský)
                                React.createElement(
                                    React.Fragment,
                                    null,
                                    React.createElement(
                                        'div',
                                        { className: 'grid grid-cols-2 gap-6' },
                                        
                                        // Domáci tím - detail so štatistikami
                                        React.createElement(
                                            'div',
                                            { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
                                            React.createElement(
                                                'h3',
                                                { className: 'font-bold text-lg text-gray-800 mb-3 text-center border-b border-gray-200 pb-2' },
                                                homeTeamName
                                            ),
                                            
                                            // Realizačný tím pre domáci tím
                                            React.createElement(
                                                'div',
                                                { className: 'mb-4' },
                                                React.createElement(
                                                    'h4',
                                                    { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                                                    React.createElement('i', { className: 'fa-solid fa-user-tie text-xs text-gray-500' }),
                                                    'Realizačný tím'
                                                ),
                                                
                                                homeTeamDetails ? React.createElement(
                                                    'div',
                                                    { className: 'space-y-2' },
                                                    
                                                    // Hlavička pre realizačný tím
                                                    React.createElement(
                                                        'div',
                                                        { className: 'grid grid-cols-12 gap-1 mb-2 px-2 text-xs font-semibold text-gray-600 bg-gray-100 py-2 rounded' },
                                                        React.createElement('div', { className: 'col-span-8 text-left' }, 'Meno'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, 'ŽK'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, 'ČK'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, 'MK'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, '2\'')
                                                    ),
                                                    
                                                    // Muži v realizačnom tíme pre domáci tím (režim štatistík)
                                                    activeMenStaffHome.length > 0 && 
                                                    React.createElement(
                                                        React.Fragment,
                                                        null,
                                                        activeMenStaffHome.map((member, idx) => {
                                                            const staffIdentifier = {
                                                                userId: homeTeamDetails.userId,
                                                                teamIdentifier: selectedMatch.homeTeamIdentifier,
                                                                displayName: `${member.lastName} ${member.firstName} (tréner)`,
                                                                isStaff: true,
                                                                staffType: 'men',
                                                                staffIndex: idx
                                                            };
                                                            
                                                            const stats = getPlayerStats(staffIdentifier);
                                                            
                                                            let onClickHandler = undefined;
                                                            let cursorClass = '';
                                                            
                                                            if (selectedMatch?.status === 'scheduled') {
                                                                onClickHandler = () => openEditStaffModal(member, 'home', homeTeamDetails, 'men', idx);
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else if (isMatchActionAllowed()) {
                                                                onClickHandler = () => {
                                                                    if (eventType) {
                                                                        if (eventType === 'goal' || eventType === 'penalty') {
                                                                            window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                            return;
                                                                        }
                                                                        addMatchEvent(eventType, 'home', null, staffIdentifier);
                                                                    }
                                                                };
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else {
                                                                cursorClass = 'cursor-not-allowed opacity-60';
                                                            }
                                                            
                                                            return React.createElement(
                                                                'div',
                                                                { 
                                                                    key: `home-men-${idx}`, 
                                                                    className: `grid grid-cols-12 gap-1 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                    onClick: onClickHandler,
                                                                    title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                                },
                                                                React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-8 flex items-center gap-2 truncate' },
                                                                    React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs flex-shrink-0' }),
                                                                    React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                                ),
                                                                // ŽLTÉ KARTY
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-yellow-600' }, 
                                                                    (stats?.yellowCards || 0) === 0 ? '' : (stats?.yellowCards || 0)
                                                                ),
                                                                // ČERVENÉ KARTY
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-red-600' }, 
                                                                    (stats?.redCards || 0) === 0 ? '' : (stats?.redCards || 0)
                                                                ),
                                                                // MODRÉ KARTY
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-blue-800' }, 
                                                                    (stats?.blueCards || 0) === 0 ? '' : (stats?.blueCards || 0)
                                                                ),
                                                                // VYLÚČENIA
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-orange-600' }, 
                                                                    (stats?.exclusions || 0) === 0 ? '' : (stats?.exclusions || 0)
                                                                ),
                                                                !showPlayerStats && selectedMatch?.status === 'scheduled' && React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-1 text-right' },
                                                                    React.createElement('i', { className: 'fa-solid fa-pencil text-xs text-gray-400' })
                                                                )
                                                            );
                                                        })
                                                    ),
                                                    
                                                    // Ženy v realizačnom tíme pre domáci tím (režim štatistík)
                                                    activeWomenStaffHome.length > 0 && 
                                                    React.createElement(
                                                        React.Fragment,
                                                        null,
                                                        activeWomenStaffHome.map((member, idx) => {
                                                            const staffIdentifier = {
                                                                userId: homeTeamDetails.userId,
                                                                teamIdentifier: selectedMatch.homeTeamIdentifier,
                                                                displayName: `${member.lastName} ${member.firstName} (trénerka)`,
                                                                isStaff: true,
                                                                staffType: 'women',
                                                                staffIndex: idx
                                                            };
                                                            
                                                            const stats = getPlayerStats(staffIdentifier);
                                                            
                                                            let onClickHandler = undefined;
                                                            let cursorClass = '';
                                                            
                                                            if (selectedMatch?.status === 'scheduled') {
                                                                onClickHandler = () => openEditStaffModal(member, 'home', homeTeamDetails, 'women', idx);
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else if (isMatchActionAllowed()) {
                                                                onClickHandler = () => {
                                                                    if (eventType) {
                                                                        if (eventType === 'goal' || eventType === 'penalty') {
                                                                            window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                            return;
                                                                        }
                                                                        addMatchEvent(eventType, 'home', null, staffIdentifier);
                                                                    }
                                                                };
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else {
                                                                cursorClass = 'cursor-not-allowed opacity-60';
                                                            }
                                                            
                                                            return React.createElement(
                                                                'div',
                                                                { 
                                                                    key: `home-women-${idx}`, 
                                                                    className: `grid grid-cols-12 gap-1 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                    onClick: onClickHandler,
                                                                    title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                                },
                                                                React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-8 flex items-center gap-2 truncate' },
                                                                    React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs flex-shrink-0' }),
                                                                    React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                                ),
                                                                // ŽLTÉ KARTY
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-yellow-600' }, 
                                                                    (stats?.yellowCards || 0) === 0 ? '' : (stats?.yellowCards || 0)
                                                                ),
                                                                // ČERVENÉ KARTY
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-red-600' }, 
                                                                    (stats?.redCards || 0) === 0 ? '' : (stats?.redCards || 0)
                                                                ),
                                                                // MODRÉ KARTY
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-blue-800' }, 
                                                                    (stats?.blueCards || 0) === 0 ? '' : (stats?.blueCards || 0)
                                                                ),
                                                                // VYLÚČENIA
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-orange-600' }, 
                                                                    (stats?.exclusions || 0) === 0 ? '' : (stats?.exclusions || 0)
                                                                ),
                                                                !showPlayerStats && selectedMatch?.status === 'scheduled' && React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-1 text-right' },
                                                                    React.createElement('i', { className: 'fa-solid fa-pencil text-xs text-gray-400' })
                                                                )
                                                            );
                                                        })
                                                    ),
                                                    
                                                    (!homeTeamDetails.team.menTeamMemberDetails || homeTeamDetails.team.menTeamMemberDetails.length === 0) &&
                                                    (!homeTeamDetails.team.womenTeamMemberDetails || homeTeamDetails.team.womenTeamMemberDetails.length === 0) &&
                                                    React.createElement(
                                                        'div',
                                                        { className: 'text-sm text-gray-500 italic p-2' },
                                                        'Žiadni členovia realizačného tímu'
                                                    )
                                                ) : React.createElement(
                                                    'div',
                                                    { className: 'text-sm text-gray-500 italic p-2' },
                                                    'Nedostupné'
                                                )
                                            ),
                                            
                                            // Hráči pre domáci tím so štatistikami
                                            renderPlayersSection(homeTeamDetails, 'home', homeTeamName, suspendedPlayersHome, isLoadingSuspensionsHome, homeTeamNameReady)
                                        ),
                                        
                                        // Hosťovský tím - detail so štatistikami (LEN JEDEN!)
                                        React.createElement(
                                            'div',
                                            { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
                                            React.createElement(
                                                'h3',
                                                { className: 'font-bold text-lg text-gray-800 mb-3 text-center border-b border-gray-200 pb-2' },
                                                awayTeamName
                                            ),
                                            
                                            // Realizačný tím pre hosťovský tím
                                            React.createElement(
                                                'div',
                                                { className: 'mb-4' },
                                                React.createElement(
                                                    'h4',
                                                    { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                                                    React.createElement('i', { className: 'fa-solid fa-user-tie text-xs text-gray-500' }),
                                                    'Realizačný tím'
                                                ),
                                                
                                                awayTeamDetails ? React.createElement(
                                                    'div',
                                                    { className: 'space-y-2' },
                                                    
                                                    // Hlavička pre realizačný tím
                                                    React.createElement(
                                                        'div',
                                                        { className: 'grid grid-cols-12 gap-1 mb-2 px-2 text-xs font-semibold text-gray-600 bg-gray-100 py-2 rounded' },
                                                        React.createElement('div', { className: 'col-span-8 text-left' }, 'Meno'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, 'ŽK'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, 'ČK'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, 'MK'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, '2\'')
                                                    ),
                                                    
                                                    // Muži v realizačnom tíme pre hosťovský tím (režim štatistík)
                                                    activeMenStaffAway.length > 0 && 
                                                    React.createElement(
                                                        React.Fragment,
                                                        null,
                                                        activeMenStaffAway.map((member, idx) => {
                                                            const staffIdentifier = {
                                                                userId: awayTeamDetails.userId,
                                                                teamIdentifier: selectedMatch.awayTeamIdentifier,
                                                                displayName: `${member.lastName} ${member.firstName} (tréner)`,
                                                                isStaff: true,
                                                                staffType: 'men',
                                                                staffIndex: idx
                                                            };
                                                            
                                                            const stats = getPlayerStats(staffIdentifier);
                                                            
                                                            let onClickHandler = undefined;
                                                            let cursorClass = '';
                                                            
                                                            if (selectedMatch?.status === 'scheduled') {
                                                                onClickHandler = () => openEditStaffModal(member, 'away', awayTeamDetails, 'men', idx);
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else if (isMatchActionAllowed()) {
                                                                onClickHandler = () => {
                                                                    if (eventType) {
                                                                        if (eventType === 'goal' || eventType === 'penalty') {
                                                                            window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                            return;
                                                                        }
                                                                        addMatchEvent(eventType, 'away', null, staffIdentifier);
                                                                    }
                                                                };
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else {
                                                                cursorClass = 'cursor-not-allowed opacity-60';
                                                            }
                                                            
                                                            return React.createElement(
                                                                'div',
                                                                { 
                                                                    key: `away-men-${idx}`, 
                                                                    className: `grid grid-cols-12 gap-1 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                    onClick: onClickHandler,
                                                                    title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                                },
                                                                React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-8 flex items-center gap-2 truncate' },
                                                                    React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs flex-shrink-0' }),
                                                                    React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                                ),
                                                                // ŽLTÉ KARTY
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-yellow-600' }, 
                                                                    (stats?.yellowCards || 0) === 0 ? '' : (stats?.yellowCards || 0)
                                                                ),
                                                                // ČERVENÉ KARTY
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-red-600' }, 
                                                                    (stats?.redCards || 0) === 0 ? '' : (stats?.redCards || 0)
                                                                ),
                                                                // MODRÉ KARTY
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-blue-800' }, 
                                                                    (stats?.blueCards || 0) === 0 ? '' : (stats?.blueCards || 0)
                                                                ),
                                                                // VYLÚČENIA
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-orange-600' }, 
                                                                    (stats?.exclusions || 0) === 0 ? '' : (stats?.exclusions || 0)
                                                                ),
                                                                !showPlayerStats && selectedMatch?.status === 'scheduled' && React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-1 text-right' },
                                                                    React.createElement('i', { className: 'fa-solid fa-pencil text-xs text-gray-400' })
                                                                )
                                                            );
                                                        })
                                                    ),
                                                                                                                    
                                                    // Ženy v realizačnom tíme pre hosťovský tím (režim štatistík)
                                                    activeWomenStaffAway.length > 0 && 
                                                    React.createElement(
                                                        React.Fragment,
                                                        null,
                                                        activeWomenStaffAway.map((member, idx) => {
                                                            const staffIdentifier = {
                                                                userId: awayTeamDetails.userId,
                                                                teamIdentifier: selectedMatch.awayTeamIdentifier,
                                                                displayName: `${member.lastName} ${member.firstName} (trénerka)`,
                                                                isStaff: true,
                                                                staffType: 'women',
                                                                staffIndex: idx
                                                            };
                                                            
                                                            const stats = getPlayerStats(staffIdentifier);
                                                            
                                                            let onClickHandler = undefined;
                                                            let cursorClass = '';
                                                            
                                                            if (selectedMatch?.status === 'scheduled') {
                                                                onClickHandler = () => openEditStaffModal(member, 'away', awayTeamDetails, 'women', idx);
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else if (isMatchActionAllowed()) {
                                                                onClickHandler = () => {
                                                                    if (eventType) {
                                                                        if (eventType === 'goal' || eventType === 'penalty') {
                                                                            window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                            return;
                                                                        }
                                                                        addMatchEvent(eventType, 'away', null, staffIdentifier);
                                                                    }
                                                                };
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else {
                                                                cursorClass = 'cursor-not-allowed opacity-60';
                                                            }
                                                            
                                                            return React.createElement(
                                                                'div',
                                                                { 
                                                                    key: `away-women-${idx}`, 
                                                                    className: `grid grid-cols-12 gap-1 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                    onClick: onClickHandler,
                                                                    title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                                },
                                                                React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-8 flex items-center gap-2 truncate' },
                                                                    React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs flex-shrink-0' }),
                                                                    React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                                ),
                                                                // ŽLTÉ KARTY
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-yellow-600' }, 
                                                                    (stats?.yellowCards || 0) === 0 ? '' : (stats?.yellowCards || 0)
                                                                ),
                                                                // ČERVENÉ KARTY
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-red-600' }, 
                                                                    (stats?.redCards || 0) === 0 ? '' : (stats?.redCards || 0)
                                                                ),
                                                                // MODRÉ KARTY
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-blue-800' }, 
                                                                    (stats?.blueCards || 0) === 0 ? '' : (stats?.blueCards || 0)
                                                                ),
                                                                // VYLÚČENIA
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-orange-600' }, 
                                                                    (stats?.exclusions || 0) === 0 ? '' : (stats?.exclusions || 0)
                                                                ),
                                                                !showPlayerStats && selectedMatch?.status === 'scheduled' && React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-1 text-right' },
                                                                    React.createElement('i', { className: 'fa-solid fa-pencil text-xs text-gray-400' })
                                                                )
                                                            );
                                                        })
                                                    ),
                                                    
                                                    (!awayTeamDetails.team.menTeamMemberDetails || awayTeamDetails.team.menTeamMemberDetails.length === 0) &&
                                                    (!awayTeamDetails.team.womenTeamMemberDetails || awayTeamDetails.team.womenTeamMemberDetails.length === 0) &&
                                                    React.createElement(
                                                        'div',
                                                        { className: 'text-sm text-gray-500 italic p-2' },
                                                        'Žiadni členovia realizačného tímu'
                                                    )
                                                ) : React.createElement(
                                                    'div',
                                                    { className: 'text-sm text-gray-500 italic p-2' },
                                                    'Nedostupné'
                                                )
                                            ),
                                            
                                            // Hráči hosťovského tímu so štatistikami
                                            renderPlayersSection(awayTeamDetails, 'away', awayTeamName, suspendedPlayersAway, isLoadingSuspensionsAway, awayTeamNameReady)
                                        )
                                    ),
                                    
                                    // Box s priebehom zápasu - pod tímami (s horným okrajom)
                                    React.createElement(
                                        'div',
                                        { className: 'mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col match-progress-section' },
                                        React.createElement(
                                            'h3',
                                            { className: 'font-bold text-lg text-gray-800 mb-3 text-center border-b border-gray-200 pb-2' },
                                            'Priebeh zápasu'
                                        ),
                                        
                                        // Skóre
                                        React.createElement(
                                            'div',
                                            { className: 'mb-4 text-center' },
                                            React.createElement(
                                                'div',
                                                { className: 'text-3xl font-bold text-gray-800 mb-1' },
                                                loadingEvents ? '--:--' : `${matchScore.home} : ${matchScore.away}`
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'text-xs text-gray-500' },
                                                selectedMatch?.status === 'completed' ? 'Konečný výsledok' : 'Aktuálne skóre'
                                            )
                                        ),
                                        
                                        // Ovládacie tlačidlá pre adminov a hall users
                                        (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && React.createElement(
                                            'div',
                                            { className: 'flex flex-wrap gap-2 justify-center mb-4' },
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-green-600 border-green-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'goal' && eventSubType === null
                                                                ? 'bg-green-600 text-white border-green-600'
                                                                : eventType === 'penalty' && eventSubType === 'scored'
                                                                ? 'bg-green-600 text-white border-green-600'
                                                                : 'bg-white text-green-600 border-green-600 hover:bg-green-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed() 
                                                        ? () => {
                                                            if (eventType === 'penalty' && eventSubType === 'missed') {
                                                                setEventType('penalty');
                                                                setEventSubType('scored');
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } 
                                                            else if (eventType === 'penalty' && eventSubType === 'scored') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                            else if (eventType === 'goal' && eventSubType === null) {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } 
                                                            else {
                                                                setEventType('goal');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-futbol ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-green-600'
                                                        : (eventType === 'goal' && eventSubType === null) || (eventType === 'penalty' && eventSubType === 'scored')
                                                            ? 'text-white' 
                                                            : 'text-green-600'
                                                }` }),
                                                'Gól'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-blue-600 border-blue-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'penalty' && (eventSubType === 'missed' || eventSubType === 'scored')
                                                                ? 'bg-blue-600 text-white border-blue-600' 
                                                                : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'penalty') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('penalty');
                                                                setEventSubType('missed');
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-circle-dot ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-blue-600'
                                                        : eventType === 'penalty' ? 'text-white' : 'text-blue-600'
                                                }` }),
                                                '7m'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-yellow-600 border-yellow-500 cursor-not-allowed opacity-50'
                                                            : eventType === 'yellow' 
                                                                ? 'bg-yellow-500 text-white border-yellow-500' 
                                                                : 'bg-white text-yellow-600 border-yellow-500 hover:bg-yellow-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'yellow') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('yellow');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-square ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-yellow-600'
                                                        : eventType === 'yellow' ? 'text-white' : 'text-yellow-600'
                                                }` }),
                                                'ŽK'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-red-600 border-red-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'red' 
                                                                ? 'bg-red-600 text-white border-red-600' 
                                                                : 'bg-white text-red-600 border-red-600 hover:bg-red-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'red') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('red');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-square ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-red-600'
                                                        : eventType === 'red' ? 'text-white' : 'text-red-600'
                                                }` }),
                                                'ČK'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-blue-800 border-blue-800 cursor-not-allowed opacity-50'
                                                            : eventType === 'blue' 
                                                                ? 'bg-blue-800 text-white border-blue-800' 
                                                                : 'bg-white text-blue-800 border-blue-800 hover:bg-blue-100'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'blue') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('blue');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-square ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-blue-800'
                                                        : eventType === 'blue' ? 'text-white' : 'text-blue-800'
                                                }` }),
                                                'MK'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-orange-600 border-orange-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'exclusion' 
                                                                ? 'bg-orange-600 text-white border-orange-600' 
                                                                : 'bg-white text-orange-600 border-orange-600 hover:bg-orange-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'exclusion') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('exclusion');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-user-slash ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-orange-600'
                                                        : eventType === 'exclusion' ? 'text-white' : 'text-orange-600'
                                                }` }),
                                                'Vylúčenie'
                                            )
                                        ),
                                        
                                        // Zoznam udalostí
                                        React.createElement(
                                            'div',
                                            { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
                                            React.createElement(
                                                'h4',
                                                { className: 'font-semibold text-sm text-gray-700 mb-3 flex items-center gap-1' },
                                                React.createElement('i', { className: 'fa-solid fa-clock text-xs text-gray-500' }),
                                                'Priebeh zápasu',
                                                loadingEvents && React.createElement('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 ml-2' })
                                            ),
                                            
                                            matchEvents.length === 0 ? React.createElement(
                                                'div',
                                                { className: 'text-sm text-gray-500 italic p-4 text-center' },
                                                'Zatiaľ žiadne udalosti'
                                            ) : React.createElement(
                                                'div',
                                                { className: 'space-y-1' },
                                                
                                                matchEvents.map((event) => {
                                                    const isHighlighted = highlightedEventId === event.id;
                                                    const playerName = event.playerRef ? getPlayerNameFromRef(event.playerRef) : '';
                                                    
                                                    let jerseyNumber = '';
                                                    if (event.playerRef && !event.playerRef.staffType) {
                                                        // Použijeme novú funkciu na získanie čísla dresu
                                                        jerseyNumber = getJerseyNumberFromRef(event.playerRef);
                                                    }
                                                    
                                                    let eventIcon = '';
                                                    switch (event.type) {
                                                        case 'goal':
                                                            eventIcon = React.createElement('i', { className: 'fa-solid fa-futbol text-black text-sm' });
                                                            break;
                                                        case 'penalty':
                                                            eventIcon = React.createElement('div', { className: 'relative inline-flex items-center justify-center' },
                                                                React.createElement('i', { className: `fa-solid fa-futbol ${event.subType === 'scored' ? 'text-green-600' : 'text-red-600'} text-sm` }),
                                                                React.createElement('span', { className: `absolute -bottom-1 -right-2 text-[8px] font-bold ${event.subType === 'scored' ? 'text-green-600' : 'text-red-600'}` }, '7m')
                                                            );
                                                            break;
                                                        case 'yellow':
                                                            eventIcon = React.createElement('div', { className: 'w-4 h-5 bg-yellow-400 rounded-sm' });
                                                            break;
                                                        case 'red':
                                                            eventIcon = React.createElement('div', { className: 'w-4 h-5 bg-red-600 rounded-sm' });
                                                            break;
                                                        case 'blue':
                                                            eventIcon = React.createElement('div', { className: 'w-4 h-5 bg-blue-600 rounded-sm' });
                                                            break;
                                                        case 'exclusion':
                                                            eventIcon = React.createElement('span', { className: 'font-bold text-orange-600' }, '2\'');
                                                            break;
                                                        default:
                                                            eventIcon = React.createElement('i', { className: 'fa-solid fa-clock text-gray-600 text-sm' });
                                                    }
                                                    
                                                    const nameParts = playerName.split(' ');
                                                    const firstName = nameParts[0] || '';
                                                    const lastName = nameParts.slice(1).join(' ') || '';
                                                    const isStaff = event.playerRef?.staffType ? true : false;
                                                    const scoreBefore = event.scoreBefore || { home: 0, away: 0 };
                                                    const scoreAfter = event.scoreAfter || { home: 0, away: 0 };
                                                    
                                                    return React.createElement(
                                                        'div',
                                                        { 
                                                            key: event.id,
                                                            className: `grid grid-cols-[1fr_20px_50px_30px_60px_30px_50px_20px_1fr] gap-1 hover:bg-blue-50 transition-colors relative ${isHighlighted ? 'row-highlighted' : ''}`,
                                                        },
                                                        React.createElement('div', { className: `flex flex-col leading-tight text-right p-2` },
                                                            event.team === 'home' && React.createElement(
                                                                React.Fragment,
                                                                null,
                                                                React.createElement('span', { className: 'text-gray-700 text-xs font-medium' }, firstName),
                                                                lastName && React.createElement('span', { className: 'text-gray-700 text-xs' }, lastName)
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-end items-center p-2` },
                                                            event.team === 'home' && !isStaff && jerseyNumber && React.createElement(
                                                                'span',
                                                                { className: 'inline-block w-6 h-6 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center justify-center' },
                                                                jerseyNumber
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `text-center p-2` },
                                                            (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) && event.team === 'home' && React.createElement(
                                                                'span',
                                                                { className: 'inline-block px-2 py-1 rounded-full text-xs font-bold text-gray-700' },
                                                                `${scoreAfter.home}:${scoreAfter.away}`
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-center items-center p-2` },
                                                            event.team === 'home' && eventIcon
                                                        ),
                                                        React.createElement('div', { className: `text-center relative p-2 group` },
                                                            React.createElement('span', { className: `font-mono text-xs text-gray-800 ${(userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && selectedMatch?.status !== 'completed' ? 'group-hover:hidden' : ''}` },
                                                                `${event.minute}:${event.second?.toString().padStart(2, '0') || '00'}`
                                                            ),
                                                            (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && 
                                                            selectedMatch?.status !== 'completed' && React.createElement(
                                                                'div',
                                                                { className: 'hidden group-hover:flex items-center justify-center gap-2' },
                                                                React.createElement('button', { className: `text-blue-500 hover:text-blue-700 ${isHighlighted ? 'opacity-100' : ''}`, onClick: (e) => { e.stopPropagation(); highlightEventRow(event.id); }, title: isHighlighted ? 'Zrušiť zvýraznenie' : 'Zvýrazniť riadok' },
                                                                    React.createElement('i', { className: 'fa-solid fa-pencil text-xs' })
                                                                ),
                                                                React.createElement('button', { className: 'text-red-500 hover:text-red-700', onClick: (e) => { e.stopPropagation(); deleteMatchEvent(event.id); }, title: 'Zmazať udalosť' },
                                                                    React.createElement('i', { className: 'fa-solid fa-trash-can text-xs' })
                                                                )
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-center items-center p-2` },
                                                            event.team === 'away' && eventIcon
                                                        ),
                                                        React.createElement('div', { className: `text-center p-2` },
                                                            (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) && event.team === 'away' && React.createElement(
                                                                'span',
                                                                { className: 'inline-block px-2 py-1 rounded-full text-xs font-bold text-gray-700' }, 
                                                                `${scoreAfter.home}:${scoreAfter.away}`
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-start items-center p-2` },
                                                            event.team === 'away' && !isStaff && jerseyNumber && React.createElement(
                                                                'span',
                                                                { className: 'inline-block w-6 h-6 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center justify-center' },
                                                                jerseyNumber
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex flex-col leading-tight text-left p-2` },
                                                            event.team === 'away' && React.createElement(
                                                                React.Fragment,
                                                                null,
                                                                React.createElement('span', { className: 'text-gray-700 text-xs font-medium' }, firstName),
                                                                lastName && React.createElement('span', { className: 'text-gray-700 text-xs' }, lastName)
                                                            )
                                                        )
                                                    );
                                                })
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
        );
    
        return React.createElement(
            React.Fragment,
            null,
            mainContent,
            React.createElement(ConfirmModal, {
                isOpen: confirmModalOpen,
                onClose: () => {
                    setConfirmModalOpen(false);
                    setEventToDelete(null);
                },
                onConfirm: confirmDeleteEvent,
                title: 'Zmazanie udalosti',
                message: 'Naozaj chcete zmazať túto udalosť? Táto akcia je nenávratná.'
            }),
            React.createElement(ResetMatchModal, {
                isOpen: resetModalOpen,
                onClose: () => {
                    setResetModalOpen(false);
                    setResetMatchId(null);
                },
                onConfirm: () => resetMatchTimer(resetMatchId, false),
                onConfirmWithDelete: () => resetMatchTimer(resetMatchId, true),
                title: 'Reset zápasu',
                message: 'Naozaj chcete resetovať tento zápas? Čas sa vynuluje a zápas sa vráti do stavu "Naplánované".'
            }),
            React.createElement(EndMatchModal, {
                isOpen: endMatchModalOpen,
                onClose: () => {
                    setEndMatchModalOpen(false);
                    setEndMatchId(null);
                },
                onConfirm: () => {
                    confirmEndMatch();
                    setEndMatchModalOpen(false);
                    setEndMatchId(null);
                },
                title: 'Ukončenie zápasu',
                message: 'Naozaj chcete ukončiť tento zápas? Po ukončení zápasu už nebude možné pridávať ďalšie udalosti.'
            }),
            React.createElement(EditStaffModal, {
                isOpen: editStaffModalOpen,
                onClose: () => {
                    setEditStaffModalOpen(false);
                    setStaffToEdit(null);
                },
                onSave: saveStaffEdit,
                onRemove: removeStaffFromRoster,  // PRIDANÉ
                member: staffToEdit,
                firstName: editStaffFirstName,
                lastName: editStaffLastName,
                onFirstNameChange: setEditStaffFirstName,
                onLastNameChange: setEditStaffLastName
            }),
            React.createElement(EditPlayerModal, {
                isOpen: editPlayerModalOpen,
                onClose: () => {
                    setEditPlayerModalOpen(false);
                    setPlayerToEdit(null);
                },
                onSave: savePlayerEdit,
                onRemove: removePlayerFromRoster,
                player: playerToEdit,
                firstName: editPlayerFirstName,
                lastName: editPlayerLastName,
                jerseyNumber: editPlayerJerseyNumber,
                onFirstNameChange: setEditPlayerFirstName,
                onLastNameChange: setEditPlayerLastName,
                onJerseyNumberChange: setEditPlayerJerseyNumber
            }),
            React.createElement(ForfeitMatchModal, {
                isOpen: forfeitModalOpen,
                onClose: () => {
                    setForfeitModalOpen(false);
                    setForfeitMatchId(null);
                    setForfeitTeam(null);
                },
                onConfirm: () => {
                    confirmForfeitMatch();
                    setForfeitModalOpen(false);
                    setForfeitMatchId(null);
                    setForfeitTeam(null);
                },
                onTeamSelect: (team) => setForfeitTeam(team),
                selectedTeam: forfeitTeam,
                homeTeamName: homeTeamName,
                awayTeamName: awayTeamName,
                title: 'Kontumácia zápasu',
                message: 'Vyberte, ktorý tím vyhráva kontumačne 10:0'
            }),
            React.createElement(ManualScoreModal, {
                isOpen: manualScoreModalOpen,
                onClose: () => {
                    setManualScoreModalOpen(false);
                    setManualScoreMatchId(null);
                    setManualHomeScore('');
                    setManualAwayScore('');
                },
                onConfirm: () => {
                    confirmManualScore();
                    setManualScoreModalOpen(false);
                    setManualScoreMatchId(null);
                    setManualHomeScore('');
                    setManualAwayScore('');
                },
                homeScore: manualHomeScore,
                awayScore: manualAwayScore,
                onHomeScoreChange: setManualHomeScore,
                onAwayScoreChange: setManualAwayScore,
                homeTeamName: (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function' 
                    ? (window.matchTracker.getTeamNameByDisplayId(homeTeamName) ?? homeTeamName)
                    : homeTeamName),
                awayTeamName: (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function' 
                    ? (window.matchTracker.getTeamNameByDisplayId(awayTeamName) ?? awayTeamName)
                    : awayTeamName)
            }),
        );
    }
    
    // Inak zobrazíme zoznam všetkých zápasov
    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-start p-4' },
        React.createElement(
            'div',
            { className: 'w-full max-w-6xl bg-white rounded-xl shadow-xl p-8' },
            
            // Hlavička s názvom haly
            React.createElement(
                'div',
                { className: 'flex flex-col items-center justify-center mb-8 p-4 -mx-8 -mt-8 rounded-t-xl bg-gradient-to-r from-red-50 to-white border-b border-red-200' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center text-gray-800' }, 'Zápasy'),
                hallName && hallName !== 'Žiadna priradená hala' && React.createElement(
                    'div',
                    { className: 'mt-2 text-xl text-gray-600 flex items-center gap-2' },
                    React.createElement('i', { className: 'fa-solid fa-location-dot text-red-500' }),
                    `Športová hala ${hallName}`
                ),
                hallName === 'Žiadna priradená hala' && React.createElement(
                    'div',
                    { className: 'mt-2 text-lg text-gray-600' },
                    hallName
                )
            ),
    
            // Indikátor načítavania
            loading && React.createElement(
                'div',
                { className: 'flex justify-center items-center py-12' },
                React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
            ),
    
            // Žiadne zápasy
            !loading && matches.length === 0 && React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500' },
                React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-5xl mb-4 opacity-30' }),
                React.createElement('p', { className: 'text-xl' }, 'Pre túto halu nie sú naplánované žiadne zápasy')
            ),
    
            // Zápasy zoskupené podľa dní
            !loading && matches.length > 0 && React.createElement(
                'div',
                { className: 'space-y-8' },
                sortedDays.map((dayGroup) => 
                    React.createElement(
                        'div',
                        { key: dayGroup.dateStr, className: 'border border-gray-200 rounded-xl overflow-hidden shadow-sm' },
                        
                        // Hlavička dňa
                        React.createElement(
                            'div',
                            { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
                            React.createElement(
                                'h3',
                                { className: 'text-lg font-semibold text-gray-700 flex items-center gap-2' },
                                React.createElement('i', { className: 'fa-regular fa-calendar text-blue-500' }),
                                formatDateWithDay(dayGroup.date),
                                React.createElement(
                                    'span',
                                    { className: 'ml-2 text-sm font-normal text-gray-500' },
                                    `(${dayGroup.matches.length} ${dayGroup.matches.length === 1 ? 'zápas' : dayGroup.matches.length < 5 ? 'zápasy' : 'zápasov'})`
                                )
                            )
                        ),
            
                        // Zoznam zápasov pre tento deň
                        React.createElement(
                            'div',
                            { className: 'divide-y divide-gray-100' },
                            dayGroup.matches.map((match) => {
                                // Použijeme funkciu getTeamNameByIdentifier na získanie názvov tímov
                                const homeTeamName = match.homeDisplayName || getTeamNameByIdentifier(match.homeTeamIdentifier);
                                const awayTeamName = match.awayDisplayName || getTeamNameByIdentifier(match.awayTeamIdentifier);
                                const category = categories.find(c => c.name === match.categoryName);
                                
                                // Zistenie, či má zápas typ (finále, semifinále, o umiestnenie)
                                const hasMatchType = match.isPlacementMatch || match.matchType;
                                
                                // Príprava textu pre skupinu alebo typ zápasu
                                let groupOrTypeText = '';
                                let groupOrTypeClass = '';
                                
                                if (hasMatchType) {
                                    // Ak má zápas typ, zobrazíme typ
                                    if (match.isPlacementMatch) {
                                        groupOrTypeText = `o ${match.placementRank}. miesto`;
                                    } else {
                                        groupOrTypeText = match.matchType;
                                    }
                                    groupOrTypeClass = 'bg-purple-100 text-purple-700';
                                } else if (match.groupName) {
                                    // Ak má skupinu, zobrazíme skupinu
                                    groupOrTypeText = match.groupName;
                                    groupOrTypeClass = 'bg-green-100 text-green-700';
                                } else {
                                    // Ak nemá nič, zobrazíme pomlčku
                                    groupOrTypeText = '—';
                                    groupOrTypeClass = 'bg-gray-100 text-gray-500';
                                }
            
                                // Zistenie, či je zápas v stave, ktorý nie je "Naplánované" ani "Odohrané"
                                const isMatchInProgress = match.status === 'in-progress' || match.status === 'paused';
                                
                                // V časti s mapovaním zápasov (dayGroup.matches.map)
                                return React.createElement(
                                    'div',
                                    { 
                                        key: match.id, 
                                        className: 'px-6 py-4 hover:bg-blue-50 transition-colors cursor-pointer',
                                        onClick: () => selectMatch(match)
                                    },
                                    React.createElement(
                                        'div',
                                        { className: 'flex flex-wrap items-center gap-4' },
                                        
                                        // Čas
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-2 text-gray-600 min-w-[100px]' },
                                            React.createElement('i', { className: 'fa-regular fa-clock text-blue-500' }),
                                            React.createElement('span', { className: 'font-mono font-medium' }, formatTime(match.scheduledTime))
                                        ),
                                        
                                        // VS alebo aktuálny čas/skóre
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-3 flex-1' },
                                            React.createElement(
                                                'span',
                                                { className: 'font-medium text-gray-800 text-right flex-1' },
                                                window.matchTracker.getTeamNameByDisplayId(homeTeamName) ?? homeTeamName
                                            ),
                                            
                                            // Zobrazenie stavu zápasu
                                            liveMatchData[match.id] ? 
                                                React.createElement(
                                                    'div',
                                                    { 
                                                        className: 'flex items-center justify-center gap-2 px-3 py-1 min-w-[100px]',
                                                    },
                                                    React.createElement(
                                                        'span',
                                                        { className: 'font-mono font-bold text-blue-600 text-sm' },
                                                        `${liveMatchData[match.id].homeScore} : ${liveMatchData[match.id].awayScore}`
                                                    )
                                                ) :
                                                match.status === 'completed' ? 
                                                    (() => {
                                                        // NAJPRV SKONTROLUJEME, ČI IDE O KONTUMÁCIU
                                                        if (match.forfeitResult && match.forfeitResult.isForfeit) {
                                                            return React.createElement(
                                                                'div',
                                                                { 
                                                                    className: 'flex items-center justify-center gap-2 px-3 py-1 min-w-[100px]',
                                                                    title: 'Kontumovaný výsledok'
                                                                },
                                                                React.createElement(
                                                                    'span',
                                                                    { className: 'font-mono font-bold text-red-600 text-sm' },
                                                                    `${match.forfeitResult.home} : ${match.forfeitResult.away}`
                                                                )
                                                            );
                                                        }
                                                        // INÁK POUŽIJEME NORMÁLNE VÝSLEDKY Z completedMatchData
                                                        if (completedMatchData[match.id]) {
                                                            return React.createElement(
                                                                'div',
                                                                { 
                                                                    className: 'flex items-center justify-center gap-2 px-3 py-1 min-w-[100px]',
                                                                    title: 'Konečný výsledok'
                                                                },
                                                                React.createElement(
                                                                    'span',
                                                                    { className: 'font-mono font-bold text-green-600 text-sm' },
                                                                    `${completedMatchData[match.id].homeScore} : ${completedMatchData[match.id].awayScore}`
                                                                )
                                                            );
                                                        }
                                                        return React.createElement(
                                                            'span',
                                                            { className: 'text-xs font-bold text-gray-400 px-2' },
                                                            '-- : --'
                                                        );
                                                    })() :
                                                    React.createElement(
                                                        'span',
                                                        { className: 'text-xs font-bold text-gray-400 px-2' },
                                                        '-- : --'
                                                    ),
                                            
                                            React.createElement(
                                                'span',
                                                { className: 'font-medium text-gray-800 flex-1' },
                                                window.matchTracker.getTeamNameByDisplayId(awayTeamName) ?? awayTeamName
                                            )
                                        ),
                                        
                                        // Skupina alebo typ zápasu
                                        React.createElement(
                                            'span',
                                            { 
                                                className: `px-3 py-1 text-xs font-medium rounded-full`,
                                                style: (() => {
                                                    // Získame typ skupiny z groupsData pre dynamické farby
                                                    let bgColor = '#f3f4f6'; // Svetlo šedá pre fallback
                                                    let textColor = '#6b7280'; // Šedá pre fallback
            
                                                    if (hasMatchType) {
                                                        // Typ zápasu (finále, semifinále, o umiestnenie) - fialová
                                                        bgColor = '#f3e8ff';
                                                        textColor = '#6b21a5';
                                                    } else if (match.groupName && groupsData && Object.keys(groupsData).length > 0) {
                                                        // Získame ID kategórie podľa názvu
                                                        const categoryId = categoryIdMap[match.categoryName];
                                                        
                                                        if (categoryId && groupsData[categoryId] && Array.isArray(groupsData[categoryId])) {
                                                            const foundGroup = groupsData[categoryId].find(g => g.name === match.groupName);
                                                            if (foundGroup && foundGroup.type) {
                                                                if (foundGroup.type === 'základná skupina') {
                                                                    bgColor = '#dcfce7'; // Svetlo zelená
                                                                    textColor = '#166534'; // Tmavo zelená
                                                                } else if (foundGroup.type === 'nadstavbová skupina') {
                                                                    bgColor = '#dbeafe'; // Svetlo modrá
                                                                    textColor = '#1e40af'; // Tmavo modrá
                                                                }
                                                            }
                                                        }
                                                    } else if (groupOrTypeClass.includes('bg-purple')) {
                                                        // Fallback pre typ zápasu ak nemáme groupsData
                                                        bgColor = '#f3e8ff';
                                                        textColor = '#6b21a5';
                                                    } else if (groupOrTypeClass.includes('bg-green')) {
                                                        // Fallback pre skupinu
                                                        bgColor = '#dcfce7';
                                                        textColor = '#166534';
                                                    }
                                                    
                                                    return {
                                                        backgroundColor: bgColor,
                                                        color: textColor
                                                    };
                                                })()
                                            },
                                            groupOrTypeText
                                        ),
                                
                                        // Kategória (ak existuje)
                                        category && React.createElement(
                                            'span',
                                            { 
                                                className: 'px-3 py-1 text-xs font-medium rounded-full mr-2',
                                                style: { 
                                                    backgroundColor: `${category.drawColor}20`, // Farba z DB s 20% priehľadnosťou pre svetlé pozadie
                                                    color: category.drawColor
                                                }
                                            },
                                            category.name
                                        ),
                                        
                                        // Žltá šípka pre prebiehajúce zápasy (voliteľné - môžete ponechať alebo odstrániť)
                                        React.createElement(
                                            'span',
                                            { 
                                                className: `inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full min-w-[70px] ${
                                                    isMatchInProgress 
                                                        ? 'bg-yellow-100 text-yellow-700' 
                                                        : 'bg-white text-gray-400 border border-gray-200'
                                                }`,
                                                title: isMatchInProgress ? 'Zápas práve prebieha' : ''
                                            },
                                            React.createElement('i', { 
                                                className: `fa-solid fa-play text-xs ${
                                                    isMatchInProgress ? 'text-yellow-600' : 'text-gray-300'
                                                }` 
                                            }),
                                            'Detail'
                                        )
                                    )
                                );
                            })
                        )
                    )
                )
            )
        )
    );
};

// Komponent pre manuálne zadanie výsledku
const ManualScoreModal = ({ isOpen, onClose, onConfirm, homeScore, awayScore, onHomeScoreChange, onAwayScoreChange, homeTeamName, awayTeamName }) => {
    if (!isOpen) return null;

    // Validácia vstupov
    const homeScoreNum = parseInt(homeScore, 10);
    const awayScoreNum = parseInt(awayScore, 10);
    const isValid = homeScore !== '' && 
                    awayScore !== '' && 
                    !isNaN(homeScoreNum) && 
                    !isNaN(awayScoreNum) && 
                    homeScoreNum >= 0 && 
                    awayScoreNum >= 0;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[145]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-[458px] w-full mx-4' },
            
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Manuálne zadanie výsledku'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            React.createElement(
                'p',
                { className: 'text-gray-600 mb-4' },
                'Zadajte konečný výsledok zápasu:'
            ),
            
            // Zadanie výsledku
            React.createElement(
                'div',
                { className: 'grid grid-cols-2 gap-4 mb-6' },
                React.createElement(
                    'div',
                    { className: 'text-center' },
                    React.createElement(
                        'label', 
                        { 
                            className: 'block text-sm font-medium text-gray-700 mb-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-full',
                            title: homeTeamName || 'Domáci'
                        }, 
                        homeTeamName || 'Domáci'
                    ),
                    React.createElement(
                        'input',
                        {
                            type: 'number',
                            value: homeScore,
                            onChange: (e) => onHomeScoreChange(e.target.value),
                            min: 0,
                            className: 'w-full px-3 py-2 text-center text-2xl font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'text-center' },
                    React.createElement(
                        'label', 
                        { 
                            className: 'block text-sm font-medium text-gray-700 mb-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-full',
                            title: awayTeamName || 'Hostia'
                        }, 
                        awayTeamName || 'Hostia'
                    ),
                    React.createElement(
                        'input',
                        {
                            type: 'number',
                            value: awayScore,
                            onChange: (e) => onAwayScoreChange(e.target.value),
                            min: 0,
                            className: 'w-full px-3 py-2 text-center text-2xl font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }
                    )
                )
            ),

            // Zobrazenie chybovej správy pri neplatnom vstupe
            !isValid && homeScore !== '' && awayScore !== '' && React.createElement(
                'p',
                { className: 'text-red-500 text-sm text-center mb-4' },
                'Prosím, zadajte platné nezáporné čísla'
            ),

            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                    },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: isValid ? onConfirm : undefined,
                        disabled: !isValid,
                        className: `px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium ${
                            isValid 
                                ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer' 
                                : 'bg-white text-purple-600 border-2 border-purple-600 cursor-not-allowed'
                        }`
                    },
                    React.createElement('i', { className: `fa-solid fa-save ${isValid ? '' : 'text-purple-600'}` }),
                    'Uložiť výsledok'
                )
            )
        )
    );
};

const EditStaffModal = ({ isOpen, onClose, onSave, onRemove, member, firstName, lastName, onFirstNameChange, onLastNameChange }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[170]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Úprava člena realizačného tímu'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            React.createElement(
                'div',
                { className: 'space-y-4 mb-6' },
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Meno'),
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            value: firstName,
                            onChange: (e) => onFirstNameChange(e.target.value),
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }
                    )
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Priezvisko'),
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            value: lastName,
                            onChange: (e) => onLastNameChange(e.target.value),
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }
                    )
                )
            ),

            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                    },
                    'Zrušiť'
                ),
                // PRIDANÉ tlačidlo na odstránenie člena RT
                onRemove && React.createElement(
                    'button',
                    {
                        onClick: onRemove,
                        className: 'px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors'
                    },
                    'Odstrániť zo súpisky'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onSave,
                        className: 'px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
                    },
                    'Uložiť'
                )
            )
        )
    );
};

const EditPlayerModal = ({ isOpen, onClose, onSave, onRemove, player, firstName, lastName, jerseyNumber, onFirstNameChange, onLastNameChange, onJerseyNumberChange }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[160]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Úprava hráča'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            React.createElement(
                'div',
                { className: 'space-y-4 mb-6' },
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Číslo dresu'),
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            value: jerseyNumber,
                            onChange: (e) => onJerseyNumberChange(e.target.value),
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }
                    )
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Meno'),
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            value: firstName,
                            onChange: (e) => onFirstNameChange(e.target.value),
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }
                    )
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Priezvisko'),
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            value: lastName,
                            onChange: (e) => onLastNameChange(e.target.value),
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }
                    )
                )
            ),

            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                    },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onRemove,
                        className: 'px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors'
                    },
                    'Odstrániť zo súpisky'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onSave,
                        className: 'px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
                    },
                    'Uložiť'
                )
            )
        )
    );
};

const EndMatchModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[150]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, title || 'Ukončenie zápasu'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            React.createElement(
                'p',
                { className: 'text-gray-600 mb-6' },
                message || 'Naozaj chcete ukončiť tento zápas?'
            ),

            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                    },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            onConfirm();
                            onClose();
                        },
                        className: 'px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors'
                    },
                    'Ukončiť zápas'
                )
            )
        )
    );
};

// Komponent pre modálne okno resetu zápasu
const ResetMatchModal = ({ isOpen, onClose, onConfirm, onConfirmWithDelete, title, message }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[140]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, title || 'Reset zápasu'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            React.createElement(
                'p',
                { className: 'text-gray-600 mb-6' },
                message || 'Naozaj chcete resetovať tento zápas?'
            ),

            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                    },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            onConfirmWithDelete();
                            onClose();
                        },
                        className: 'px-4 py-2 text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors'
                    },
                    'Reset zápasu a\u00A0vymazať udalosti'
                )
            )
        )
    );
};

// Komponent pre potvrdzovacie modálne okno
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[130]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, title || 'Potvrdenie akcie'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            React.createElement(
                'p',
                { className: 'text-gray-600 mb-6' },
                message || 'Naozaj chcete vykonať túto akciu?'
            ),

            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                    },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            onConfirm();
                            onClose();
                        },
                        className: 'px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors'
                    },
                    'Zmazať'
                )
            )
        )
    );
};

const ForfeitMatchModal = ({ isOpen, onClose, onConfirm, title, message, homeTeamName, awayTeamName, selectedTeam, onTeamSelect }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[135]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, title || 'Kontumácia zápasu'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            React.createElement(
                'p',
                { className: 'text-gray-600 mb-4' },
                message || 'Vyberte, ktorý tím vyhráva kontumačne 10:0:'
            ),
            
            // Výber tímu
            React.createElement(
                'div',
                { className: 'grid grid-cols-2 gap-4 mb-6' },
                React.createElement(
                    'button',
                    {
                        className: `p-4 rounded-lg border-2 text-center transition-all ${
                            selectedTeam === 'home' 
                                ? 'border-green-500 bg-green-50' 
                                : 'border-gray-200 hover:border-green-300'
                        }`,
                        onClick: () => onTeamSelect('home')
                    },
                    React.createElement('div', { className: 'font-semibold' }, homeTeamName || 'Domáci'),
                ),
                React.createElement(
                    'button',
                    {
                        className: `p-4 rounded-lg border-2 text-center transition-all ${
                            selectedTeam === 'away' 
                                ? 'border-green-500 bg-green-50' 
                                : 'border-gray-200 hover:border-green-300'
                        }`,
                        onClick: () => onTeamSelect('away')
                    },
                    React.createElement('div', { className: 'font-semibold' }, awayTeamName || 'Hostia'),
                )
            ),

            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                    },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            if (!selectedTeam) {
                                window.showGlobalNotification('Vyberte tím, ktorý vyhráva kontumačne', 'error');
                                return;
                            }
                            onConfirm();
                        },
                        className: `px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-medium ${
                            selectedTeam 
                                ? 'bg-red-800 hover:bg-red-900 text-white cursor-pointer' 
                                : 'bg-white text-red-800 border-2 border-red-800 opacity-60 cursor-not-allowed'
                        }`,
                        disabled: !selectedTeam
                    },
                    'Potvrdiť kontumáciu'
                )
            )
        )
    );
};

// Premenná na sledovanie, či bol poslúcháč už nastavený
let isEmailSyncListenerSetup = false;

/**
 * Táto funkcia je poslúcháčom udalosti 'globalDataUpdated'.
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        // Synchronizácia e-mailu
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                await updateDoc(userProfileRef, { email: user.email });
                                
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });
                                
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná.', 'success');
                            }
                        }
                    } catch (error) {
//                        console.error("Chyba pri synchronizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(matchesHallApp, { userProfileData }));
        }
    } else {
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center h-full pt-16' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
                )
            );
        }
    }
};

// Funkcia pre výpis ID aktuálneho zápasu do konzoly
window.getCurrentMatchId = async () => {
    // Získame z URL parametrov
    const urlParams = new URLSearchParams(window.location.search);
    const homeIdentifier = urlParams.get('domaci');
    const awayIdentifier = urlParams.get('hostia');
    
    if (homeIdentifier && awayIdentifier) {
        console.log(`Aktuálny zápas - domáci: ${homeIdentifier}, hostia: ${awayIdentifier}`);
        
        // Najprv skúsime použiť uložené ID z React stavu
        if (window.currentMatchId) {
            console.log(`ID zápasu: ${window.currentMatchId}`);
            return window.currentMatchId;
        }
        
        // Ak nemáme uložené ID, vyhľadáme ho v databáze
        if (!window.db) {
            console.log('Firebase databáza nie je inicializovaná');
            return null;
        }
        
        try {
            const matchesRef = collection(window.db, 'matches');
            const q = query(
                matchesRef, 
                where("homeTeamIdentifier", "==", homeIdentifier),
                where("awayTeamIdentifier", "==", awayIdentifier)
            );
            
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                console.log('Zápas nebol nájdený v databáze');
                return null;
            }
            
            const matches = [];
            querySnapshot.forEach((doc) => {
                matches.push({ id: doc.id, ...doc.data() });
            });
            
            if (matches.length === 1) {
                const matchId = matches[0].id;
                console.log(`ID zápasu: ${matchId}`);
                // Uložíme si ID pre budúce použitie
                window.currentMatchId = matchId;
                return matchId;
            } else {
                console.log(`Nájdených viacero zápasov (${matches.length}):`);
                matches.forEach(match => {
                    console.log(`  - ID: ${match.id}`);
                });
                return matches[0]?.id || null;
            }
        } catch (error) {
            console.error('Chyba pri vyhľadávaní zápasu:', error);
            return null;
        }
    } else {
        console.log('Žiadny zápas nie je aktuálne zobrazený');
        return null;
    }
};

// Registrácia poslúcháča
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Kontrola existujúcich dát
if (window.globalUserProfileData) {
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            React.createElement(
                'div',
                { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
}




// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Funkcia na získanie názvu tímu podľa displayId z tabuľky skupiny (LEN PRI 100% ODOHRANÝCH ZÁPASOCH)
function getTeamNameByDisplayId(displayId) {
    if (!displayId) {
        console.log('❌ Nebol zadaný identifikátor tímu');
        return null;
    }
    
    // Parsovanie identifikátora: "U12 D 1A" -> kategória: "U12 D", pozícia: "1", skupina: "A"
    const parts = displayId.trim().split(' ');
    
    if (parts.length < 2) {
        console.log(`❌ Neplatný formát identifikátora: ${displayId}`);
        return null;
    }
    
    // Posledná časť je pozícia + skupina (napr. "1A")
    const positionAndGroup = parts.pop();
    // Zvyšok je názov kategórie (napr. "U12 D")
    const category = parts.join(' ');
    
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
        console.log(`❌ Neplatný formát pozície/skupiny: ${positionAndGroup} (očakáva sa napr. "1A")`);
        return null;
    }
    
    const positionNum = parseInt(position, 10);
    const fullGroupName = `skupina ${groupLetter.toUpperCase()}`;
    
    console.log(`🔍 Hľadám tím: kategória="${category}", skupina="${fullGroupName}", pozícia=${positionNum}`);
    
    // 1. NAJPRV SKÚSIME VYHĽADAŤ V POUŽÍVATEĽSKÝCH TÍMOCH (user teams)
    // Získame všetky tímy z používateľov (cez window.users alebo window.__teamManagerData)
    let userTeamsList = [];
    
    // Skúsime získať z window.__teamManagerData (najspoľahlivejšie)
    if (window.__teamManagerData?.allTeams) {
        userTeamsList = window.__teamManagerData.allTeams.filter(t => !t.isSuperstructureTeam);
    } 
    // Alebo z globálnej premennej ak je dostupná
    else if (window.allUsersTeams) {
        userTeamsList = window.allUsersTeams;
    }
    
    if (userTeamsList.length > 0) {
        // Hľadáme tím podľa kategórie, skupiny a poradia
        const userTeam = userTeamsList.find(t => 
            t.category === category && 
            t.groupName === fullGroupName && 
            t.order === positionNum
        );
        
        if (userTeam && userTeam.teamName) {
            console.log(`✅ Nájdený používateľský tím: ${userTeam.teamName}`);
            return userTeam.teamName;
        }
    }
    
    // 2. AK NENÁJDENÝ, SKÚSIME SUPERSTRUCTURE TÍMY
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
            const superstructureTeam = groupTable.teams[teamIndex];
            
            // Ak je to superstructure tím, skúsime ešte raz vyhľadať používateľský tím podľa názvu
            if (superstructureTeam.name && superstructureTeam.name !== displayId) {
                // Skúsime nájsť používateľský tím s rovnakým názvom
                const matchingUserTeam = userTeamsList.find(t => 
                    t.teamName === superstructureTeam.name
                );
                
                if (matchingUserTeam) {
                    console.log(`✅ Nájdený používateľský tím (podľa názvu): ${matchingUserTeam.teamName}`);
                    return matchingUserTeam.teamName;
                }
                
                console.log(`✅ Nájdený superstructure tím: ${superstructureTeam.name} (pozícia ${positionNum} v skupine ${fullGroupName})`);
                return superstructureTeam.name;
            }
        }
    }
    
    console.log(`❌ Tím nebol nájdený: ${displayId}`);
    return null;
}

// Pridáme aj funkciu na vyhľadávanie podľa samostatných parametrov
function getTeamNameByParams(category, groupLetter, position) {
    const displayId = `${category} ${position}${groupLetter.toUpperCase()}`;
    return getTeamNameByDisplayId(displayId);
}

// Pridáme funkciu na získanie kompletných informácií o tíme (vrátane štatistík)
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
    const category = parts.join(' ');
    
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

// Export funkcií do window.matchTracker
if (window.matchTracker) {
    window.matchTracker.getTeamNameByDisplayId = getTeamNameByDisplayId;
    window.matchTracker.getTeamNameByParams = getTeamNameByParams;
    window.matchTracker.getTeamInfoByDisplayId = getTeamInfoByDisplayId;
} else {
    window.getTeamNameByDisplayId = getTeamNameByDisplayId;
    window.getTeamNameByParams = getTeamNameByParams;
    window.getTeamInfoByDisplayId = getTeamInfoByDisplayId;
}

console.log('📋 Pridané funkcie (vyhľadávanie LEN pri 100% odohraných zápasoch):');
console.log('   • window.matchTracker.getTeamNameByDisplayId("U12 D 2B") - vráti názov tímu (len ak je skupina dokončená)');
console.log('   • window.matchTracker.getTeamNameByParams("U12 D", "B", 2) - rovnaký výsledok');
console.log('   • window.matchTracker.getTeamInfoByDisplayId("U12 D 2B") - vráti kompletné štatistiky tímu');












// ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------   D  O  Č  A  S  N  E

// ============================================================================
// NOVÁ FUNKCIA NA ZMENU STAVU ZÁPASU Z "ODOHRANÉ" NA "PREBIEHA"
// ============================================================================

/**
 * Zmení stav zápasu z "completed" (Odohrané) na "in-progress" (Prebieha).
 * @param {string} matchId - ID zápasu v databáze Firestore.
 * @returns {Promise<boolean>} - Vráti true pri úspechu, false pri chybe.
 */
window.setMatchToInProgress = async (matchId) => {
    if (!matchId) {
        console.error('❌ Chyba: Nebolo zadané ID zápasu.');
        return false;
    }

    if (!window.db) {
        console.error('❌ Chyba: Firebase databáza nie je inicializovaná.');
        return false;
    }

    try {
        const matchRef = doc(window.db, 'matches', matchId);
        const matchSnap = await getDoc(matchRef);

        if (!matchSnap.exists()) {
            console.error(`❌ Chyba: Zápas s ID "${matchId}" neexistuje.`);
            return false;
        }

        const matchData = matchSnap.data();
        const currentStatus = matchData.status;

        if (currentStatus !== 'completed') {
            console.warn(`⚠️ Zápas má stav "${currentStatus}". Funkcia je určená len pre zmenu z "completed" na "in-progress".`);
            // Ak chceš povoliť zmenu z akéhokoľvek stavu, odkomentuj nasledujúci riadok:
            // console.log('   Pokračujem napriek tomu...');
        }

        // Vykonáme zmenu stavu
        await updateDoc(matchRef, {
            status: 'in-progress',
            // Pri zmene späť na "prebieha" je vhodné vynulovať aj ukončovací čas, ak existuje
            endedAt: null,
            // Ak bol zápas pozastavený, odstránime aj ten záznam
            pausedAt: null,
            // Aktualizujeme čas poslednej zmeny (voliteľné)
            updatedAt: Timestamp.now()
        });

        console.log(`✅ Úspešne: Stav zápasu "${matchId}" bol zmenený z "${currentStatus}" na "in-progress".`);
        
        // Ak máme otvorený detail zápasu, môžeme vyvolať manuálnu aktualizáciu (voliteľné)
        if (window.currentMatchId === matchId && typeof window.dispatchEvent === 'function') {
            // Vyvoláme udalosť pre prípad, že by React komponent načítal nový stav
            window.dispatchEvent(new CustomEvent('matchStatusChanged', { detail: { matchId, newStatus: 'in-progress' } }));
        }
        
        return true;
    } catch (error) {
        console.error('❌ Chyba pri zmene stavu zápasu:', error);
        return false;
    }
};

/**
 * Pomocná funkcia na vyhľadanie ID zápasu podľa identifikátorov domácich a hostí.
 * @param {string} homeIdentifier - Identifikátor domáceho tímu (napr. "U12 D 2B").
 * @param {string} awayIdentifier - Identifikátor hosťovského tímu (napr. "U12 D 1A").
 * @returns {Promise<string|null>} - Vráti ID zápasu alebo null, ak nebol nájdený.
 */
window.findMatchByIdentifiers = async (homeIdentifier, awayIdentifier) => {
    if (!homeIdentifier || !awayIdentifier) {
        console.error('❌ Chyba: Je potrebné zadať oba identifikátory (domáci aj hostia).');
        return null;
    }

    if (!window.db) {
        console.error('❌ Chyba: Firebase databáza nie je inicializovaná.');
        return null;
    }

    try {
        const matchesRef = collection(window.db, 'matches');
        const q = query(
            matchesRef,
            where("homeTeamIdentifier", "==", homeIdentifier),
            where("awayTeamIdentifier", "==", awayIdentifier)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log(`❌ Zápas s domácimi "${homeIdentifier}" a hosťami "${awayIdentifier}" nebol nájdený.`);
            return null;
        }

        const matches = [];
        querySnapshot.forEach((doc) => {
            matches.push({ id: doc.id, ...doc.data() });
        });

        if (matches.length === 1) {
            console.log(`✅ Nájdený zápas s ID: ${matches[0].id} (stav: ${matches[0].status})`);
            return matches[0].id;
        } else {
            console.log(`⚠️ Nájdených viacero zápasov (${matches.length}):`);
            matches.forEach(match => {
                console.log(`   - ID: ${match.id} (stav: ${match.status})`);
            });
            return matches[0]?.id || null;
        }
    } catch (error) {
        console.error('❌ Chyba pri vyhľadávaní zápasu:', error);
        return null;
    }
};

/**
 * Kombinovaná funkcia: Nájde zápas podľa identifikátorov a zmení jeho stav z "completed" na "in-progress".
 * @param {string} homeIdentifier - Identifikátor domáceho tímu (napr. "U12 D 2B").
 * @param {string} awayIdentifier - Identifikátor hosťovského tímu (napr. "U12 D 1A").
 * @returns {Promise<boolean>} - Vráti true pri úspechu, false pri chybe.
 */
window.setMatchToInProgressByIdentifiers = async (homeIdentifier, awayIdentifier) => {
    console.log(`🔍 Hľadám zápas: Domáci = "${homeIdentifier}", Hostia = "${awayIdentifier}"`);
    const matchId = await window.findMatchByIdentifiers(homeIdentifier, awayIdentifier);
    
    if (!matchId) {
        console.error('❌ Zápas nebol nájdený, nie je možné zmeniť stav.');
        return false;
    }
    
    return await window.setMatchToInProgress(matchId);
};

// ============================================================================
// PRÍKLADY POUŽITIA V KONZOLE:
// ============================================================================
// 
// 1. Ak poznáš ID zápasu (napr. "abc123xyz"):
//    window.setMatchToInProgress("abc123xyz")
//
// 2. Ak poznáš identifikátory tímov (napr. "U12 D 2B" a "U12 D 1A"):
//    window.setMatchToInProgressByIdentifiers("U12 D 2B", "U12 D 1A")
//
// 3. Najprv vyhľadaj ID zápasu:
//    window.findMatchByIdentifiers("U12 D 2B", "U12 D 1A")
//    a potom použij prvú funkciu s vráteným ID.
//
// ============================================================================

console.log('✅ Pripravené funkcie na zmenu stavu zápasu:');
console.log('   • window.setMatchToInProgress(matchId)');
console.log('   • window.findMatchByIdentifiers(homeIdentifier, awayIdentifier)');
console.log('   • window.setMatchToInProgressByIdentifiers(homeIdentifier, awayIdentifier)');

// ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------   D  O  Č  A  S  N  E








// ============================================================================
// POMOCNÁ FUNKCIA NA VYHĽADANIE TÍMU V POUŽÍVATEĽSKÝCH DÁTACH
// ============================================================================

/**
 * Vyhľadá tím v používateľských dátach podľa názvu a kategórie.
 * @param {string} teamName - Názov tímu
 * @param {string} categoryName - Názov kategórie
 * @returns {Promise<Object|null>} - Informácie o tíme alebo null
 */
window.findTeamInUsers = async (teamName, categoryName) => {
    if (!window.db) {
        console.error('❌ Firebase databáza nie je inicializovaná.');
        return null;
    }
    
    try {
        // Načítame všetkých používateľov
        const usersRef = collection(window.db, 'users');
        const usersSnap = await getDocs(usersRef);
        
        let foundTeam = null;
        let foundUser = null;
        
        console.log(`🔍 Hľadám tím "${teamName}" v kategórii "${categoryName}"...`);
        
        // Prehľadávame všetkých používateľov
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const teams = userData.teams || {};
            
            // Prehľadávame všetky kategórie v tímoch používateľa
            for (const [category, teamsArray] of Object.entries(teams)) {
                // Kontrola, či kategória zodpovedá hľadanej (ak je zadaná)
                if (categoryName && category !== categoryName) continue;
                
                if (Array.isArray(teamsArray)) {
                    // Hľadáme tím s daným názvom (case-insensitive pre istotu)
                    const team = teamsArray.find(t => 
                        t.teamName && t.teamName.toLowerCase() === teamName.toLowerCase()
                    );
                    
                    if (team) {
                        foundTeam = team;
                        foundUser = {
                            id: userDoc.id,
                            email: userData.email,
                            displayName: userData.displayName
                        };
                        console.log(`✅ Tím nájdený u používateľa: ${userData.email}`);
                        break;
                    }
                }
            }
            
            if (foundTeam) break;
        }
        
        if (!foundTeam) {
            console.log(`❌ Tím "${teamName}" nebol nájdený v žiadnej kategórii.`);
            
            // Výpis dostupných tímov pre debug
            console.log('\n📋 Dostupné tímy v systéme:');
            for (const userDoc of usersSnap.docs) {
                const userData = userDoc.data();
                const teams = userData.teams || {};
                
                for (const [category, teamsArray] of Object.entries(teams)) {
                    if (Array.isArray(teamsArray)) {
                        teamsArray.forEach(team => {
                            if (team.teamName) {
                                console.log(`   - ${team.teamName} (${category}) - používateľ: ${userData.email}`);
                            }
                        });
                    }
                }
            }
            
            return null;
        }
        
        // Získame hráčov a členov RT
        const players = foundTeam.playerDetails || [];
        const menStaff = foundTeam.menTeamMemberDetails || [];
        const womenStaff = foundTeam.womenTeamMemberDetails || [];
        
        console.log(`📊 Tím obsahuje: ${players.length} hráčov, ${menStaff.length} mužov RT, ${womenStaff.length} žien RT`);
        
        return {
            teamName: foundTeam.teamName,
            groupName: foundTeam.groupName,
            order: foundTeam.order,
            players: players,
            menStaff: menStaff,
            womenStaff: womenStaff,
            userId: foundUser.id,
            userEmail: foundUser.email,
            teamData: foundTeam
        };
        
    } catch (error) {
        console.error('❌ Chyba pri vyhľadávaní tímu:', error);
        return null;
    }
};

// ============================================================================
// OPRAVENÁ FUNKCIA NA MANUÁLNE VLOŽENIE TÍMU DO UI PODĽA NÁZVU A KATEGÓRIE
// ============================================================================

/**
 * Vyhľadá tím v používateľských dátach podľa názvu tímu a kategórie
 * a vloží jeho hráčov a členov RT do aktuálneho detailu zápasu.
 * 
 * @param {string} teamName - Názov tímu (napr. "ŠK Slovan Bratislava")
 * @param {string} categoryName - Názov kategórie (napr. "U12 D")
 * @param {string} teamSide - Ktorá strana sa má nahradiť: 'home' alebo 'away'
 * @returns {Promise<Object|null>} - Vráti informácie o nájdenom tíme alebo null
 * 
 * Príklad použitia v konzole:
 * window.forceTeamIntoMatch("ŠK Slovan Bratislava", "U12 D", "home")
 * window.forceTeamIntoMatch("MŠK Žilina", "U12 D", "away")
 */
window.forceTeamIntoMatch = async (teamName, categoryName, teamSide = 'home') => {
    if (!teamName || !categoryName) {
        console.error('❌ Chyba: Je potrebné zadať názov tímu a názov kategórie.');
        return null;
    }

    if (!window.db) {
        console.error('❌ Chyba: Firebase databáza nie je inicializovaná.');
        return null;
    }

    // Získanie aktuálneho zápasu
    let currentMatchId = window.currentMatchId;
    
    if (!currentMatchId) {
        const urlParams = new URLSearchParams(window.location.search);
        const homeIdentifier = urlParams.get('domaci');
        const awayIdentifier = urlParams.get('hostia');
        
        if (homeIdentifier && awayIdentifier) {
            try {
                const matchesRef = collection(window.db, 'matches');
                const q = query(
                    matchesRef, 
                    where("homeTeamIdentifier", "==", homeIdentifier),
                    where("awayTeamIdentifier", "==", awayIdentifier)
                );
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    querySnapshot.forEach((doc) => {
                        currentMatchId = doc.id;
                        window.currentMatchId = currentMatchId;
                    });
                }
            } catch (error) {
                console.error('Chyba pri vyhľadávaní zápasu:', error);
            }
        }
    }
    
    if (!currentMatchId) {
        console.error('❌ Chyba: Nie je vybraný žiadny zápas.');
        return null;
    }

    try {
        // 1. Nájdenie tímu v používateľských dátach
        const usersRef = collection(window.db, 'users');
        const usersSnap = await getDocs(usersRef);
        
        let foundTeam = null;
        let foundUser = null;
        
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const teams = userData.teams || {};
            
            for (const [category, teamsArray] of Object.entries(teams)) {
                if (category !== categoryName) continue;
                
                if (Array.isArray(teamsArray)) {
                    const team = teamsArray.find(t => t.teamName === teamName);
                    
                    if (team) {
                        foundTeam = team;
                        foundUser = {
                            id: userDoc.id,
                            email: userData.email,
                            displayName: userData.displayName,
                            userData: userData
                        };
                        break;
                    }
                }
            }
            if (foundTeam) break;
        }
        
        if (!foundTeam) {
            console.error(`❌ Tím "${teamName}" v kategórii "${categoryName}" nebol nájdený.`);
            return null;
        }
        
        console.log(`✅ Nájdený tím: ${foundTeam.teamName}`);
        console.log(`   Hráči: ${foundTeam.playerDetails?.length || 0}`);
        console.log(`   RT muži: ${foundTeam.menTeamMemberDetails?.length || 0}`);
        
        // 2. Vytvorenie identifikátora
        const groupLetter = foundTeam.groupName ? foundTeam.groupName.replace('skupina ', '').toUpperCase() : '?';
        const teamIdentifier = `${categoryName} ${foundTeam.order}${groupLetter}`;
        
        // 3. Aktualizácia zápasu v databáze
        const matchRef = doc(window.db, 'matches', currentMatchId);
        const updateData = {};
        if (teamSide === 'home') {
            updateData.homeTeamIdentifier = teamIdentifier;
        } else {
            updateData.awayTeamIdentifier = teamIdentifier;
        }
        
        await updateDoc(matchRef, updateData);
        console.log(`✅ Zápas aktualizovaný: ${teamSide} tím nastavený na "${teamIdentifier}"`);
        
        // 4. KRITICKÉ: Aktualizácia lokálneho users stavu
        // Získame aktuálny users stav z Reactu
        const currentUsers = window.__reactUsersState || [];
        
        // Nájdeme index používateľa
        const userIndex = currentUsers.findIndex(u => u.id === foundUser.id);
        
        let updatedUsers = [...currentUsers];
        
        if (userIndex !== -1) {
            // Aktualizujeme existujúceho používateľa
            updatedUsers[userIndex] = {
                ...updatedUsers[userIndex],
                teams: foundUser.userData.teams  // Použijeme čerstvé dáta z databázy
            };
        } else {
            // Pridáme nového používateľa
            updatedUsers.push({
                id: foundUser.id,
                email: foundUser.email,
                displayName: foundUser.displayName,
                teams: foundUser.userData.teams
            });
        }
        
        // 5. Aktualizujeme selectedMatch v React stave
        const matchSnap = await getDoc(matchRef);
        const updatedMatch = { id: currentMatchId, ...matchSnap.data() };
        
        // 6. Zavoláme React settery
        if (window.__reactUsersSetter && typeof window.__reactUsersSetter === 'function') {
            window.__reactUsersSetter(updatedUsers);
            console.log('🔄 Stav users bol aktualizovaný.');
        }
        
        if (window.__reactSelectedMatchSetter && typeof window.__reactSelectedMatchSetter === 'function') {
            window.__reactSelectedMatchSetter(updatedMatch);
            console.log('🔄 Stav selectedMatch bol aktualizovaný.');
        }
        
        // 7. Výpis hráčov pre kontrolu
        console.log('\n📋 VLOŽENÝ TÍM - ZOZNAM HRÁČOV:');
        if (foundTeam.playerDetails && foundTeam.playerDetails.length > 0) {
            foundTeam.playerDetails.forEach((player, idx) => {
                console.log(`   ${idx + 1}. ${player.lastName} ${player.firstName} (#${player.jerseyNumber})`);
            });
        }
        
        console.log('\n👨‍🏫 REALIZAČNÝ TÍM:');
        if (foundTeam.menTeamMemberDetails && foundTeam.menTeamMemberDetails.length > 0) {
            foundTeam.menTeamMemberDetails.forEach((member, idx) => {
                console.log(`   ${idx + 1}. ${member.lastName} ${member.firstName}`);
            });
        }
        
        console.log('\n✅ Hotovo! UI by sa malo aktualizovať automaticky.');
        
        return {
            team: foundTeam,
            user: foundUser,
            teamIdentifier: teamIdentifier
        };
        
    } catch (error) {
        console.error('❌ Chyba pri vkladaní tímu:', error);
        return null;
    }
};

/**
 * Pomocná funkcia na zobrazenie všetkých dostupných tímov v systéme.
 * @returns {Promise<Array>} - Zoznam všetkých tímov
 */
window.listAllTeams = async () => {
    if (!window.db) {
        console.error('❌ Chyba: Firebase databáza nie je inicializovaná.');
        return [];
    }
    
    try {
        const usersRef = collection(window.db, 'users');
        const usersSnap = await getDocs(usersRef);
        const allTeams = [];
        
        console.log('📋 ZOZNAM VŠETKÝCH TÍMOV V SYSTÉME:\n');
        
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const teams = userData.teams || {};
            
            for (const [category, teamsArray] of Object.entries(teams)) {
                if (Array.isArray(teamsArray)) {
                    teamsArray.forEach(team => {
                        if (team.teamName) {
                            const teamInfo = {
                                name: team.teamName,
                                category: category,
                                group: team.groupName,
                                order: team.order,
                                userId: userDoc.id,
                                userEmail: userData.email,
                                playersCount: team.playerDetails?.length || 0,
                                menStaffCount: team.menTeamMemberDetails?.length || 0,
                                womenStaffCount: team.womenTeamMemberDetails?.length || 0
                            };
                            allTeams.push(teamInfo);
                            
                            console.log(`🏆 ${team.teamName}`);
                            console.log(`   Kategória: ${category}`);
                            console.log(`   Skupina: ${team.groupName || 'neurčená'}, Poradie: ${team.order || 'neurčené'}`);
                            console.log(`   Používateľ: ${userData.email}`);
                            console.log(`   Hráči: ${teamInfo.playersCount}, RT (M/Ž): ${teamInfo.menStaffCount}/${teamInfo.womenStaffCount}`);
                            console.log('   ---');
                        }
                    });
                }
            }
        }
        
        console.log(`\n📊 Celkový počet tímov: ${allTeams.length}`);
        return allTeams;
        
    } catch (error) {
        console.error('❌ Chyba pri načítaní tímov:', error);
        return [];
    }
};

/**
 * Funkcia na registráciu React settera pre aktualizáciu UI.
 * Túto funkciu treba zavolať z React komponentu, keď je selectedMatch dostupný.
 */
window.registerMatchSetter = (setterFunction) => {
    window.__reactSelectedMatchSetter = setterFunction;
    console.log('✅ React setter pre selectedMatch bol zaregistrovaný.');
};

// ============================================================================
// PRÍKLADY POUŽITIA V KONZOLE:
// ============================================================================
// 
// 1. Zobrazenie všetkých dostupných tímov:
//    window.listAllTeams()
//
// 2. Vloženie tímu do domácich:
//    window.forceTeamIntoMatch("MHK Piešťany", "U12 D", "home")
//
// 3. Vloženie tímu do hostí:
//    window.forceTeamIntoMatch("MŠK Žilina", "U12 D", "away")
//
// ============================================================================

console.log('✅ Pripravené funkcie na manuálne vloženie tímu do UI:');
console.log('   • window.listAllTeams() - zobrazenie všetkých dostupných tímov');
console.log('   • window.findTeamInUsers("názov", "kategória") - vyhľadanie tímu');
console.log('   • window.forceTeamIntoMatch("názov tímu", "kategória", "home/away") - vloženie tímu do zápasu');
console.log('   • window.registerMatchSetter(setterFunction) - registrácia React settera (voliteľné)');


// ============================================================================
// NOVÁ FUNKCIA NA PRIAMO VLOŽENIE TÍMU DO UI (bez spoliehania sa na getTeamDetails)
// ============================================================================

/**
 * Priamo vloží hráčov a členov RT tímu do UI podľa kategórie, skupiny a poradia.
 * Táto funkcia obchádza getTeamDetails() a priamo aktualizuje React stav.
 * 
 * @param {string} categoryName - Názov kategórie (napr. "U12 D")
 * @param {string} groupName - Názov skupiny (napr. "skupina B")
 * @param {number} order - Poradie tímu v skupine (napr. 2)
 * @param {string} teamSide - Ktorá strana: 'home' alebo 'away'
 * @returns {Promise<Object|null>} - Informácie o vloženom tíme
 * 
 * Príklad použitia v konzole:
 * window.forceTeamByGroup("U12 D", "skupina B", 2, "home")
 */
window.forceTeamByGroup = async (categoryName, groupName, order, teamSide = 'home') => {
    if (!categoryName || !groupName || !order) {
        console.error('❌ Chyba: Je potrebné zadať categoryName, groupName a order.');
        console.log('   Príklad: window.forceTeamByGroup("U12 D", "skupina B", 2, "home")');
        return null;
    }

    if (!window.db) {
        console.error('❌ Chyba: Firebase databáza nie je inicializovaná.');
        return null;
    }

    // Získanie aktuálneho zápasu
    let currentMatchId = window.currentMatchId;
    
    if (!currentMatchId) {
        const urlParams = new URLSearchParams(window.location.search);
        const homeIdentifier = urlParams.get('domaci');
        const awayIdentifier = urlParams.get('hostia');
        
        if (homeIdentifier && awayIdentifier) {
            try {
                const matchesRef = collection(window.db, 'matches');
                const q = query(
                    matchesRef, 
                    where("homeTeamIdentifier", "==", homeIdentifier),
                    where("awayTeamIdentifier", "==", awayIdentifier)
                );
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    querySnapshot.forEach((doc) => {
                        currentMatchId = doc.id;
                        window.currentMatchId = currentMatchId;
                    });
                }
            } catch (error) {
                console.error('Chyba pri vyhľadávaní zápasu:', error);
            }
        }
    }
    
    if (!currentMatchId) {
        console.error('❌ Chyba: Nie je vybraný žiadny zápas.');
        return null;
    }

    try {
        // 1. Vyhľadáme používateľa, ktorý vlastní tento tím
        const usersRef = collection(window.db, 'users');
        const usersSnap = await getDocs(usersRef);
        
        let foundTeam = null;
        let foundUser = null;
        
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const teams = userData.teams || {};
            
            for (const [category, teamsArray] of Object.entries(teams)) {
                if (category !== categoryName) continue;
                
                if (Array.isArray(teamsArray)) {
                    const team = teamsArray.find(t => 
                        t.groupName === groupName && 
                        t.order === order
                    );
                    
                    if (team) {
                        foundTeam = team;
                        foundUser = {
                            id: userDoc.id,
                            email: userData.email,
                            displayName: userData.displayName
                        };
                        break;
                    }
                }
            }
            if (foundTeam) break;
        }
        
        if (!foundTeam) {
            console.error(`❌ Tím nebol nájdený: kategória="${categoryName}", skupina="${groupName}", poradie=${order}`);
            return null;
        }
        
        console.log(`✅ Nájdený tím: ${foundTeam.teamName}`);
        console.log(`   Hráči: ${foundTeam.playerDetails?.length || 0}`);
        console.log(`   RT muži: ${foundTeam.menTeamMemberDetails?.length || 0}`);
        console.log(`   RT ženy: ${foundTeam.womenTeamMemberDetails?.length || 0}`);
        
        // 2. Vytvoríme identifikátor pre tím
        const groupLetter = groupName.replace('skupina ', '').toUpperCase();
        const teamIdentifier = `${categoryName} ${order}${groupLetter}`;
        
        // 3. Aktualizujeme zápas v databáze
        const matchRef = doc(window.db, 'matches', currentMatchId);
        const updateData = {};
        if (teamSide === 'home') {
            updateData.homeTeamIdentifier = teamIdentifier;
        } else {
            updateData.awayTeamIdentifier = teamIdentifier;
        }
        
        await updateDoc(matchRef, updateData);
        console.log(`✅ Zápas aktualizovaný: ${teamSide} tím nastavený na "${teamIdentifier}"`);
        
        // 4. AKTUÁLNE AKTUALIZUJEME LOKÁLNY STAV users
        // Nájdeme a aktualizujeme používateľa v stave users
        const updatedUsers = [...window.__reactUsersState || []];
        const userIndex = updatedUsers.findIndex(u => u.id === foundUser.id);
        
        if (userIndex !== -1) {
            // Aktualizujeme existujúceho používateľa
            const updatedUser = { ...updatedUsers[userIndex] };
            if (!updatedUser.teams) updatedUser.teams = {};
            if (!updatedUser.teams[categoryName]) updatedUser.teams[categoryName] = [];
            
            const teamIndex = updatedUser.teams[categoryName].findIndex(t => 
                t.groupName === groupName && t.order === order
            );
            
            if (teamIndex !== -1) {
                updatedUser.teams[categoryName][teamIndex] = foundTeam;
            } else {
                updatedUser.teams[categoryName].push(foundTeam);
            }
            
            updatedUsers[userIndex] = updatedUser;
            
            // Ak máme React setter pre users, zavoláme ho
            if (window.__reactUsersSetter && typeof window.__reactUsersSetter === 'function') {
                window.__reactUsersSetter(updatedUsers);
                console.log('🔄 Stav users bol aktualizovaný cez React setter.');
            }
        }
        
        // 5. Ak máme React setter pre selectedMatch, aktualizujeme ho
        if (window.__reactSelectedMatchSetter && typeof window.__reactSelectedMatchSetter === 'function') {
            const matchRef2 = doc(window.db, 'matches', currentMatchId);
            const matchSnap = await getDoc(matchRef2);
            if (matchSnap.exists()) {
                window.__reactSelectedMatchSetter({ id: currentMatchId, ...matchSnap.data() });
                console.log('🔄 Stav selectedMatch bol aktualizovaný.');
            }
        }
        
        // 6. Vypíšeme kompletný zoznam hráčov a RT
        console.log('\n📋 ZOZNAM HRÁČOV:');
        if (foundTeam.playerDetails && foundTeam.playerDetails.length > 0) {
            foundTeam.playerDetails.forEach((player, idx) => {
                console.log(`   ${idx + 1}. ${player.lastName} ${player.firstName}${player.jerseyNumber ? ` (#${player.jerseyNumber})` : ''}`);
            });
        } else {
            console.log('   Žiadni hráči');
        }
        
        console.log('\n👨‍🏫 REALIZAČNÝ TÍM (MUŽI):');
        if (foundTeam.menTeamMemberDetails && foundTeam.menTeamMemberDetails.length > 0) {
            foundTeam.menTeamMemberDetails.forEach((member, idx) => {
                console.log(`   ${idx + 1}. ${member.lastName} ${member.firstName}`);
            });
        } else {
            console.log('   Žiadni muži v RT');
        }
        
        console.log('\n👩‍🏫 REALIZAČNÝ TÍM (ŽENY):');
        if (foundTeam.womenTeamMemberDetails && foundTeam.womenTeamMemberDetails.length > 0) {
            foundTeam.womenTeamMemberDetails.forEach((member, idx) => {
                console.log(`   ${idx + 1}. ${member.lastName} ${member.firstName}`);
            });
        } else {
            console.log('   Žiadne ženy v RT');
        }
        
        console.log('\n💡 Pre úplné zobrazenie v UI môže byť potrebné obnoviť stránku (F5).');
        
        return {
            team: foundTeam,
            user: foundUser,
            teamIdentifier: teamIdentifier
        };
        
    } catch (error) {
        console.error('❌ Chyba pri vkladaní tímu:', error);
        return null;
    }
};

/**
 * Registrácia React settera pre users stav.
 */
window.registerUsersSetter = (setterFunction) => {
    window.__reactUsersSetter = setterFunction;
    console.log('✅ React setter pre users bol zaregistrovaný.');
};

/**
 * Získa všetky tímy v danej kategórii a skupine.
 */
window.getTeamsByGroup = async (categoryName, groupName) => {
    if (!window.db) return [];
    
    try {
        const usersRef = collection(window.db, 'users');
        const usersSnap = await getDocs(usersRef);
        const teams = [];
        
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const teamsData = userData.teams || {};
            
            for (const [category, teamsArray] of Object.entries(teamsData)) {
                if (category !== categoryName) continue;
                
                if (Array.isArray(teamsArray)) {
                    const filteredTeams = teamsArray.filter(t => t.groupName === groupName);
                    teams.push(...filteredTeams.map(t => ({
                        ...t,
                        userId: userDoc.id,
                        userEmail: userData.email
                    })));
                }
            }
        }
        
        console.log(`📋 Tímy v kategórii "${categoryName}", skupine "${groupName}":`);
        teams.forEach((team, idx) => {
            console.log(`   ${idx + 1}. ${team.teamName} (poradie: ${team.order})`);
        });
        
        return teams;
    } catch (error) {
        console.error('Chyba pri získavaní tímov:', error);
        return [];
    }
};

// ============================================================================
// PRÍKLADY POUŽITIA:
// ============================================================================
// 
// 1. Vloženie tímu podľa skupiny a poradia:
//    window.forceTeamByGroup("U12 D", "skupina B", 2, "home")
//
// 2. Získanie všetkých tímov v skupine:
//    window.getTeamsByGroup("U12 D", "skupina B")
//
// 3. Registrácia React setterov (pridajte do React komponentu):
//    useEffect(() => {
//        window.registerMatchSetter(setSelectedMatch);
//        window.registerUsersSetter(setUsers);
//        return () => {
//            window.__reactSelectedMatchSetter = null;
//            window.__reactUsersSetter = null;
//        };
//    }, []);
//
// ============================================================================

console.log('✅ Pripravené nové funkcie na vkladanie tímov podľa skupiny:');
console.log('   • window.forceTeamByGroup("U12 D", "skupina B", 2, "home") - vloženie tímu');
console.log('   • window.getTeamsByGroup("U12 D", "skupina B") - zoznam tímov v skupine');
console.log('   • window.registerUsersSetter(setUsers) - registrácia settera pre users');

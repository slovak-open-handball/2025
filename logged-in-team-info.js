// logged-in-team-info.js

// Funkcia na inicializáciu event listenerov pre hover nad názvami tímov
function initTeamHoverListeners() {
    // Vyberieme všetky elementy s class 'team-name' (predpokladáme, že názvy tímov majú túto class)
    const teamNames = document.querySelectorAll('.team-name');

    teamNames.forEach((teamNameElement) => {
        // Pridáme event listener pre mouseover
        teamNameElement.addEventListener('mouseover', (event) => {
            // Získame názov tímu z textContent elementu
            const teamName = event.target.textContent.trim();

            // Získame rodičovský element (predpokladáme, že rodič má data atribut s JSON údajmi o tíme)
            const teamElement = event.target.closest('.team-item');
            let teamData = {};

            if (teamElement && teamElement.dataset.teamInfo) {
                try {
                    // Parsujeme JSON z data-team-info atributu
                    teamData = JSON.parse(teamElement.dataset.teamInfo);
                } catch (error) {
                    console.error('Chyba pri parsovaní údajov o tíme:', error);
                }
            }

            // Vypíšeme do konzoly názov tímu a celý objekt s údajmi
            console.log(`Názov tímu: ${teamName}`);
            console.log('Údaje o tíme:', teamData);
        });
    });
}

// Spustíme inicializáciu po načítaní DOM
document.addEventListener('DOMContentLoaded', initTeamHoverListeners);

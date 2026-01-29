// logged-in-team-info.js

// Funkcia na inicializáciu event listenerov pre hover nad názvami tímov
function initTeamHoverListeners() {
    const teamSpans = document.querySelectorAll('span[data-team]');

    teamSpans.forEach(span => {
        span.addEventListener('mouseover', e => {
            const teamName = e.target.textContent.trim().replace(/^\d+\.\s*/, ''); // odstráni číslo poradia ak je

            let teamData = {};
            try {
                teamData = JSON.parse(span.getAttribute('data-team'));
            } catch (err) {
                console.error("Chyba parsovania team dát:", err);
            }

            console.log("Názov tímu:", teamName);
            console.log("Celý objekt tímu:", teamData);
            console.log("──────────────────────────────");
        });
    });
}

document.addEventListener('DOMContentLoaded', initTeamHoverListeners);

// Spustíme inicializáciu po načítaní DOM
document.addEventListener('DOMContentLoaded', initTeamHoverListeners);

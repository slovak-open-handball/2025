// logged-in-team-info.js

// Funkcia na inicializáciu event listenerov pre hover nad názvami tímov
// logged-in-team-info.js
function initTeamHoverListeners() {
    // Hľadáme všetky span-y, ktoré majú class flex-grow (toto je v tvojom kóde konzistentné)
    const nameSpans = document.querySelectorAll('li span.flex-grow');

    nameSpans.forEach(span => {
        span.addEventListener('mouseover', e => {
            let text = e.target.textContent.trim();

            // Odstránime číslo poradia ak je (napr. "3. Real Madrid" → "Real Madrid")
            text = text.replace(/^\d+\.\s*/, '');

            // Pokúsime sa zistiť, či je to tím bez skupiny alebo v skupine
            const li = e.target.closest('li');
            let context = '';

            if (li) {
                if (li.classList.contains('bg-yellow-50')) {
                    context = ' (nadstavbový / superstructure tím)';
                } else if (li.closest('.bg-blue-100')) {
                    context = ' (v nadstavbovej skupine)';
                } else if (li.closest('.bg-gray-100')) {
                    context = ' (v základnej skupine)';
                }

                // Ak je to placeholder diery
                if (li.textContent.includes('chýba tím')) {
                    context = ' → toto je len placeholder diery';
                }
            }

            console.log(`Názov tímu: ${text}${context}`);
            console.log("──────────────────────────────");
        });
    });
}

document.addEventListener('DOMContentLoaded', initTeamHoverListeners);

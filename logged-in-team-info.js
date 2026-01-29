// logged-in-team-info.js

console.log("logged-in-team-info.js → Skript sa spustil a inicializuje hover listenery...");

function initTeamHoverListeners() {
    console.log("Inicializujem hover listenery na názvy tímov...");

    // Hľadáme všetky span-y, ktoré majú class flex-grow
    const nameSpans = document.querySelectorAll('li span.flex-grow');

    console.log(`Nájdených ${nameSpans.length} potenciálnych elementov s názvami tímov`);

    nameSpans.forEach((span, index) => {
        span.addEventListener('mouseover', e => {
            let text = e.target.textContent.trim();
            // Odstránime číslo poradia ak je (napr. "3. Real Madrid" → "Real Madrid")
            text = text.replace(/^\d+\.\s*/, '');

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

                if (li.textContent.includes('chýba tím')) {
                    context = ' → toto je len placeholder diery';
                }
            }

            console.log(`Názov tímu: ${text}${context}`);
            console.log("──────────────────────────────");
        });
    });

    if (nameSpans.length === 0) {
        console.warn("Žiadne elementy s triedou 'flex-grow' v tímových riadkoch sa nenašli!");
    } else {
        console.log("Hover listenery boli úspešne priradené.");
    }
}

// Spustenie po načítaní DOM-u
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded → stránka načítaná, spúšťam initTeamHoverListeners()");
    initTeamHoverListeners();
});

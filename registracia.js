document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registrationForm');
    const messageDiv = document.getElementById('message');
    const submitButton = document.getElementById('submitButton');

    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Zabráni predvolenému odoslaniu formulára

        // Zobrazí správu o načítavaní
        showMessage('Odosielam registráciu...', 'info');
        submitButton.disabled = true; // Zablokuje tlačidlo počas odosielania

        // Získanie dát z formulára
        const formData = {
            officialClubName: document.getElementById('officialClubName').value,
            billingName: document.getElementById('billingName').value,
            ico: document.getElementById('ico').value,
            dic: document.getElementById('dic').value,
            icDph: document.getElementById('icDph').value,
            // Zmeny tu: Zbierame 4 samostatné polia pre adresu
            street: document.getElementById('street').value,
            houseNumber: document.getElementById('houseNumber').value,
            city: document.getElementById('city').value,
            zipCode: document.getElementById('zipCode').value,
            contactPersonFirstName: document.getElementById('contactPersonFirstName').value,
            contactPersonLastName: document.getElementById('contactPersonLastName').value,
            contactPersonPhone: document.getElementById('contactPersonPhone').value,
            contactPersonEmail: document.getElementById('contactPersonEmail').value,
            sprava: document.getElementById('sprava').value
        };

        // Tu by ste normálne odoslali dáta na server/Google Apps Script
        // Pre účely demonštrácie simulujeme odosielanie
        try {
            // Predpokladáme, že Google Apps Script URL je definované niekde inde
            // Napr. const GOOGLE_APPS_SCRIPT_URL = 'VAŠA_URL_GOOGLE_APPS_SCRIPT';
            // Ak nemáte skutočnú URL, táto časť zlyhá, ale ukazuje, ako by to fungovalo
            const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbynIBZv_hwIdU0ENt1nhlG72giaPxdE5LStnJNQXUXIVWm3HduMPyNc6jX8khvgAlU1/exec'; // ZMEŇTE TOTO NA VAŠU SKUTOČNÚ URL

            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Dôležité pre Google Apps Script, ak nevracia CORS hlavičky
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            // Kvôli 'no-cors' módu nemôžeme priamo čítať odpoveď.
            // Predpokladáme úspech, ak nedošlo k chybe siete.
            showMessage('Registrácia bola úspešne odoslaná!', 'success');
            form.reset(); // Vyčistí formulár po úspešnom odoslaní
        } catch (error) {
            console.error('Chyba pri odosielaní formulára:', error);
            showMessage('Nastala chyba pri odosielaní registrácie. Skúste to prosím znova.', 'error');
        } finally {
            submitButton.disabled = false; // Odomkne tlačidlo po dokončení
        }
    });

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`; // Nastaví triedu pre štýlovanie (success, error, info)
        messageDiv.classList.remove('hidden'); // Zobrazí správu
        // Skryje správu po 5 sekundách, ak nie je chyba
        if (type !== 'error') {
            setTimeout(() => {
                messageDiv.classList.add('hidden');
            }, 5000);
        }
    }
});

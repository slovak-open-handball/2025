document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registrationForm');
    const messageDiv = document.getElementById('message');
    const submitButton = document.getElementById('submitButton');

    // Získanie referencií na input polia pre validáciu
    const icoInput = document.getElementById('ico');
    const dicInput = document.getElementById('dic');
    const icDphInput = document.getElementById('icDph');
    const zipCodeInput = document.getElementById('zipCode');
    const phoneInput = document.getElementById('contactPersonPhone');

    // Funkcia na zobrazenie správy
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

    // Funkcia na validáciu IČO a DIČ (len čísla)
    function validateNumericInput(event) {
        const input = event.target;
        // Odstráni všetky znaky, ktoré nie sú čísla
        input.value = input.value.replace(/[^0-9]/g, '');
    }

    // Funkcia na validáciu a formátovanie PSČ (len čísla, 5 znakov, formát 000 00)
    function validateAndFormatZipCodeInput(event) {
        const input = event.target;
        let value = input.value.replace(/\s/g, ''); // Odstráni existujúce medzery pre spracovanie
        value = value.replace(/[^0-9]/g, ''); // Odstráni všetky znaky, ktoré nie sú čísla

        // Obmedzí dĺžku na 5 znakov
        if (value.length > 5) {
            value = value.slice(0, 5);
        }

        // Formátovanie pre zobrazenie: 000 00
        let formattedValue = value;
        if (value.length > 3) {
            formattedValue = value.substring(0, 3) + ' ' + value.substring(3);
        }
        input.value = formattedValue;
    }

    // Funkcia na validáciu IČ DPH (2 písmená, 10 číslic)
    function validateIcDphInput(event) {
        const input = event.target;
        let value = input.value;

        // Obmedzí celkovú dĺžku na 12 znakov
        if (value.length > 12) {
            value = value.slice(0, 12);
        }

        // Ak sú prvé dva znaky, povolí len písmená
        if (value.length <= 2) {
            input.value = value.replace(/[^A-Za-z]/g, '').toUpperCase(); // Len písmená, premení na veľké
        } else {
            // Pre zvyšných 10 znakov povolí len čísla
            const prefix = value.substring(0, 2).replace(/[^A-Za-z]/g, '').toUpperCase();
            const suffix = value.substring(2).replace(/[^0-9]/g, '');
            input.value = prefix + suffix;
        }
    }

    // Funkcia na validáciu telefónneho čísla
    function validatePhoneInput(event) {
        const input = event.target;
        // Povolí čísla, medzery, +, - a zátvorky
        input.value = input.value.replace(/[^0-9\s\+\-()]/g, '');
    }


    // Pridanie event listenerov pre real-time validáciu
    icoInput.addEventListener('input', validateNumericInput);
    dicInput.addEventListener('input', validateNumericInput);
    // Zmenený listener pre PSČ
    zipCodeInput.addEventListener('input', validateAndFormatZipCodeInput);
    icDphInput.addEventListener('input', validateIcDphInput);
    phoneInput.addEventListener('input', validatePhoneInput);


    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Zabráni predvolenému odoslaniu formulára

        // Dodatočná validácia pred odoslaním, ak by HTML pattern zlyhal alebo bol obídený
        if (!form.checkValidity()) {
            showMessage('Prosím, vyplňte všetky povinné polia správne.', 'error');
            return; // Zastaví odosielanie, ak formulár nie je validný
        }

        // Zobrazí správu o načítavaní
        showMessage('Odosielam registráciu...', 'info');
        submitButton.disabled = true; // Zablokuje tlačidlo počas odosielania

        // Získanie dát z formulára
        const formData = {
            officialClubName: document.getElementById('officialClubName').value,
            billingName: document.getElementById('billingName').value,
            ico: icoInput.value, // Používame už validované hodnoty
            dic: dicInput.value,
            icDph: icDphInput.value,
            street: document.getElementById('street').value,
            houseNumber: document.getElementById('houseNumber').value,
            city: document.getElementById('city').value,
            // Pre PSČ odstránime medzeru pred odoslaním
            zipCode: zipCodeInput.value.replace(/\s/g, ''),
            contactPersonFirstName: document.getElementById('contactPersonFirstName').value,
            contactPersonLastName: document.getElementById('contactPersonLastName').value,
            contactPersonPhone: phoneInput.value,
            contactPersonEmail: document.getElementById('contactPersonEmail').value,
            sprava: document.getElementById('sprava').value
        };

        try {
            // ZMEŇTE TOTO NA VAŠU SKUTOČNÚ URL Google Apps Scriptu
            const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbynIBZv_hwIdU0ENt1nhlG72giaPxdE5LStnJNQXUXIVWm3HduMPyNc6jX8khvgAlU1/exec';

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
});

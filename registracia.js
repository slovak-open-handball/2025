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

    // Funkcia na validáciu IČ DPH (2 písmená, 10 číslic)
    function validateIcDphInput(event) {
        const input = event.target;
        let value = input.value;

        // Odstráni všetky znaky, ktoré nie sú písmená alebo čísla
        value = value.replace(/[^A-Za-z0-9]/g, '');

        // Ak sú prvé dva znaky, povolí len písmená a premení na veľké
        let formattedValue = '';
        if (value.length > 0) {
            formattedValue += value[0].toUpperCase();
        }
        if (value.length > 1) {
            formattedValue += value[1].toUpperCase();
        }
        // Pre zvyšných 10 znakov povolí len čísla
        if (value.length > 2) {
            formattedValue += value.substring(2).replace(/[^0-9]/g, '');
        }

        // Obmedzí celkovú dĺžku na 12 znakov
        if (formattedValue.length > 12) {
            formattedValue = formattedValue.slice(0, 12);
        }

        input.value = formattedValue;
    }

    // Funkcia na validáciu a formátovanie PSČ (XXX XX)
    function validateZipCodeInput(event) {
        const input = event.target;
        let value = input.value.replace(/\s/g, ''); // Odstráni všetky medzery pre spracovanie
        let formattedValue = '';

        // Odstráni všetky znaky, ktoré nie sú čísla
        value = value.value.replace(/[^0-9]/g, '');

        if (value.length > 3) {
            formattedValue = value.substring(0, 3) + ' ' + value.substring(3, 5);
        } else {
            formattedValue = value;
        }

        // Obmedzí celkovú dĺžku na 6 znakov (vrátane medzery)
        if (formattedValue.length > 6) {
            formattedValue = formattedValue.slice(0, 6);
        }

        input.value = formattedValue;
    }

    // NOVÁ Funkcia na validáciu a formátovanie telefónneho čísla (flexibilné medzinárodné)
    function validatePhoneInput(event) {
        const input = event.target;
        let value = input.value;
        let formattedValue = '';

        // 1. Odstráni všetky znaky, ktoré nie sú číslice, okrem '+' na začiatku
        let cleanedValue = value.replace(/[^0-9+]/g, '');

        // Zabezpečí, že '+' je len na začiatku
        if (cleanedValue.indexOf('+') > 0) {
            cleanedValue = cleanedValue.replace(/\+/g, '');
            if (value.startsWith('+')) {
                cleanedValue = '+' + cleanedValue;
            }
        }

        // Ak je hodnota príliš krátka na spracovanie, vráti vyčistenú hodnotu
        if (cleanedValue.length < 1) {
            input.value = cleanedValue;
            return;
        }

        // Ak začína na '+421'
        if (cleanedValue.startsWith('+421')) {
            let digits = cleanedValue.substring(4); // Číslice po '+421'
            digits = digits.replace(/[^0-9]/g, ''); // Zabezpečí len číslice

            // Vynúti '9' ako prvú číslicu po +421, ak je dostatok číslic
            if (digits.length > 0 && digits[0] !== '9') {
                digits = '9' + digits.substring(1);
            } else if (digits.length === 0) {
                digits = '9'; // Ak ešte nie sú žiadne číslice, pridá '9'
            }

            // Formátovanie: +421 9xxx xxx xxx
            formattedValue = '+421';
            if (digits.length > 0) formattedValue += ' ' + digits.substring(0, 1); // '9'
            if (digits.length > 1) formattedValue += digits.substring(1, 4);
            if (digits.length > 4) formattedValue += ' ' + digits.substring(4, 7);
            if (digits.length > 7) formattedValue += ' ' + digits.substring(7, 10);

            // Obmedzenie na 17 znakov (+421 9xxx xxx xxx)
            if (formattedValue.length > 17) {
                formattedValue = formattedValue.slice(0, 17);
            }

        } else if (cleanedValue.startsWith('+420')) {
            let digits = cleanedValue.substring(4); // Číslice po '+420'
            digits = digits.replace(/[^0-9]/g, ''); // Zabezpečí len číslice

            // Formátovanie: +420 xxx xxx xxx
            formattedValue = '+420';
            if (digits.length > 0) formattedValue += ' ' + digits.substring(0, 3);
            if (digits.length > 3) formattedValue += ' ' + digits.substring(3, 6);
            if (digits.length > 6) formattedValue += ' ' + digits.substring(6, 9);

            // Obmedzenie na 16 znakov (+420 xxx xxx xxx)
            if (formattedValue.length > 16) {
                formattedValue = formattedValue.slice(0, 16);
            }

        } else if (cleanedValue.startsWith('+')) {
            // Pre iné medzinárodné predvoľby: len čísla a '+' na začiatku, s jednoduchým formátovaním
            let digits = cleanedValue.substring(1); // Číslice po '+'
            digits = digits.replace(/[^0-9]/g, ''); // Zabezpečí len číslice

            formattedValue = '+';
            // Jednoduché formátovanie po 3-4 čísliciach pre medzinárodné čísla
            for (let i = 0; i < digits.length; i++) {
                formattedValue += digits[i];
                // Pridá medzeru po každých 3 čísliciach, ale nie na konci a nie po príliš dlhom čísle
                if ((i + 1) % 3 === 0 && i + 1 !== digits.length && i < 12) {
                    formattedValue += ' ';
                }
            }
            // Obmedzenie na max 25 znakov pre všeobecné medzinárodné čísla
            if (formattedValue.length > 25) {
                formattedValue = formattedValue.slice(0, 25);
            }
        } else {
            // Ak nezačína na '+', len odstráni nečíselné znaky
            formattedValue = cleanedValue.replace(/[^0-9]/g, '');
            // Ak užívateľ zadá čísla bez +, necháme ich tak.
            // Validáciu formátu (+ predvoľba) zabezpečí HTML pattern pri odoslaní.
            if (formattedValue.length > 25) { // Obmedzenie dĺžky aj pre neformátované čísla
                formattedValue = formattedValue.slice(0, 25);
            }
        }
        input.value = formattedValue;
    }


    // Pridanie event listenerov pre real-time validáciu
    icoInput.addEventListener('input', validateNumericInput);
    dicInput.addEventListener('input', validateNumericInput);
    zipCodeInput.addEventListener('input', validateZipCodeInput);
    icDphInput.addEventListener('input', validateIcDphInput);
    phoneInput.addEventListener('input', validatePhoneInput); // Aktualizovaný listener


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
            ico: icoInput.value,
            dic: dicInput.value,
            icDph: icDphInput.value,
            street: document.getElementById('street').value,
            houseNumber: document.getElementById('houseNumber').value,
            city: document.getElementById('city').value,
            zipCode: zipCodeInput.value,
            contactPersonFirstName: document.getElementById('contactPersonFirstName').value,
            contactPersonLastName: document.getElementById('contactPersonLastName').value,
            contactPersonPhone: phoneInput.value, // Zabezpečí, že sa odošle formátovaná hodnota
            contactPersonEmail: document.getElementById('contactPersonEmail').value,
            sprava: document.getElementById('sprava').value
        };

        try {
            // ZMEŇTE TOTO NA VAŠU SKUTOČNÚ URL Google Apps Scriptu
            const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyEPiUWYz_IhAqnqBMgmlg-yznD-4NVzsi27GfHpg35HuqrXXSUaV4uRFxYvZT_u_22/exec';

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

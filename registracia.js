// Získanie referencií na elementy formulára a správové pole
const registrationForm = document.getElementById('registrationForm');
const submitButton = document.getElementById('submitButton');
const messageDiv = document.getElementById('message');

/**
 * Zobrazí správu v špeciálnom div elemente.
 * @param {string} type Typ správy ('success', 'error', 'info'). Určuje farbu pozadia.
 * @param {string} text Text správy, ktorý sa má zobraziť.
 */
function showMessage(type, text) {
    // Odstráni všetky predchádzajúce triedy a skrytie
    messageDiv.classList.remove('hidden', 'success', 'error', 'info');
    // Nastaví text správy
    messageDiv.textContent = text;
    // Pridá triedu pre typ správy (success, error, info)
    messageDiv.classList.add(type);
    // Zobrazí správu
    messageDiv.classList.remove('hidden');

    // Skryje správu po 5 sekundách
    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 5000);
}

/**
 * Validuje IČO. Musí byť presne 8 číslic.
 * @param {string} ico Vstupná hodnota IČO.
 * @returns {boolean} True, ak je IČO platné, inak false.
 */
function validateICO(ico) {
    return /^\d{8}$/.test(ico);
}

/**
 * Validuje DIČ. Musí byť presne 10 číslic.
 * @param {string} dic Vstupná hodnota DIČ.
 * @returns {boolean} True, ak je DIČ platné, inak false.
 */
function validateDIC(dic) {
    return /^\d{10}$/.test(dic);
}

/**
 * Validuje IČ DPH. Musí začať 2 písmenami a nasledovať 10 číslic.
 * @param {string} icDph Vstupná hodnota IČ DPH.
 * @returns {boolean} True, ak je IČ DPH platné, inak false.
 */
function validateICDPH(icDph) {
    return /^[A-Za-z]{2}\d{10}$/.test(icDph);
}

/**
 * Validuje PSČ. Musí byť vo formáte "XXX XX" (3 číslice, medzera, 2 číslice).
 * @param {string} zipCode Vstupná hodnota PSČ.
 * @returns {boolean} True, ak je PSČ platné, inak false.
 */
function validateZipCode(zipCode) {
    return /^\d{3}\s\d{2}$/.test(zipCode);
}

/**
 * Validuje lokálne telefónne číslo. Musí obsahovať 9 až 15 číslic a môže obsahovať medzery.
 * @param {string} phoneNumber Vstupná hodnota telefónneho čísla.
 * @returns {boolean} True, ak je telefónne číslo platné, inak false.
 */
function validatePhoneNumber(phoneNumber) {
    return /^[0-9\s]{9,15}$/.test(phoneNumber);
}

// Event listener pre odoslanie formulára
registrationForm.addEventListener('submit', async function(event) {
    event.preventDefault(); // Zabraňuje predvolenému odoslaniu formulára

    // Získanie hodnôt z formulára a odstránenie bielych znakov na začiatku/konci
    const officialClubName = document.getElementById('officialClubName').value.trim();
    const billingName = document.getElementById('billingName').value.trim();
    const ico = document.getElementById('ico').value.trim();
    const dic = document.getElementById('dic').value.trim();
    const icDph = document.getElementById('icDph').value.trim();
    const street = document.getElementById('street').value.trim();
    const houseNumber = document.getElementById('houseNumber').value.trim();
    const city = document.getElementById('city').value.trim();
    const zipCode = document.getElementById('zipCode').value.trim();
    const contactPersonFirstName = document.getElementById('contactPersonFirstName').value.trim();
    const contactPersonLastName = document.getElementById('contactPersonLastName').value.trim();
    const countryCode = document.getElementById('countryCode').value; // Predvoľba sa netrimuje, je to select
    const localPhoneNumber = document.getElementById('localPhoneNumber').value.trim();
    const contactPersonEmail = document.getElementById('contactPersonEmail').value.trim();
    const sprava = document.getElementById('sprava').value.trim();

    // Validácia všetkých povinných polí a ich formátov
    if (!officialClubName) {
        showMessage('error', 'Prosím, zadajte oficiálny názov klubu.');
        return;
    }
    if (!validateICO(ico)) {
        showMessage('error', 'Prosím, zadajte platné IČO (presne 8 číslic).');
        return;
    }
    if (!validateDIC(dic)) {
        showMessage('error', 'Prosím, zadajte platné DIČ (presne 10 číslic).');
        return;
    }
    if (!validateICDPH(icDph)) {
        showMessage('error', 'Prosím, zadajte platné IČ DPH (2 písmená a 10 číslic, napr. SK1234567890).');
        return;
    }
    if (!street || !houseNumber || !city) {
        showMessage('error', 'Prosím, vyplňte kompletnú adresu (Ulica, Číslo domu, Mesto).');
        return;
    }
    if (!validateZipCode(zipCode)) {
        showMessage('error', 'Prosím, zadajte platné PSČ vo formáte "XXX XX" (napr. 811 01).');
        return;
    }
    if (!contactPersonFirstName || !contactPersonLastName) {
        showMessage('error', 'Prosím, zadajte meno a priezvisko kontaktnej osoby.');
        return;
    }
    if (!validatePhoneNumber(localPhoneNumber)) {
        showMessage('error', 'Prosím, zadajte platné telefónne číslo (9-15 číslic, povolené medzery).');
        return;
    }
    // Základná validácia e-mailu
    if (!contactPersonEmail || !contactPersonEmail.includes('@') || !contactPersonEmail.includes('.')) {
        showMessage('error', 'Prosím, zadajte platnú e-mailovú adresu.');
        return;
    }

    // Zostavenie dát pre odoslanie (objekt, ktorý sa pošle na server)
    const formData = {
        officialClubName: officialClubName,
        billingName: billingName,
        ico: ico,
        dic: dic,
        icDph: icDph,
        address: {
            street: street,
            houseNumber: houseNumber,
            city: city,
            zipCode: zipCode
        },
        contactPerson: {
            firstName: contactPersonFirstName,
            lastName: contactPersonLastName,
            phone: countryCode + localPhoneNumber.replace(/\s/g, ''), // Spojenie predvoľby a lokálneho čísla bez medzier
            email: contactPersonEmail
        },
        message: sprava
    };

    // Zablokovanie tlačidla odoslať, aby sa predišlo viacnásobnému odoslaniu
    submitButton.disabled = true;
    showMessage('info', 'Odosielam registráciu...'); // Zobrazí správu, že sa odosiela

    try {
        // ZMEŇTE TOTO NA VAŠU SKUTOČNÚ URL Google Apps Scriptu
        // Túto URL získate po nasadení vášho Google Apps Scriptu ako webovej aplikácie.
        const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz0QHUrYaiKcDHE_AAu1iwII0DXDdwqZolhlh-gDiHI-4YkPwpqLn2u11bT5QAf9y62/exec';

        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            // 'no-cors' je dôležité, ak váš Google Apps Script neposiela CORS hlavičky.
            // Znamená to, že nebudete môcť čítať odpoveď zo servera (response.json() alebo response.text()),
            // ale požiadavka sa odošle.
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        // Kvôli 'no-cors' módu nemôžeme priamo čítať odpoveď (response.ok, response.json()).
        // Predpokladáme úspech, ak nedošlo k chybe siete.
        // Ak by ste chceli čítať odpoveď, museli by ste povoliť CORS na strane Google Apps Scriptu.
        console.log('Formulár odoslaný. Odpoveď servera (ak je povolené CORS):', response);
        showMessage('success', 'Registrácia bola úspešne odoslaná!');
        registrationForm.reset(); // Vyčistí formulár po úspešnom odoslaní

    } catch (error) {
        console.error('Chyba pri odosielaní formulára:', error);
        showMessage('error', 'Nastala chyba pri odosielaní registrácie. Skúste to prosím znova.');
    } finally {
        submitButton.disabled = false; // Odomkne tlačidlo po dokončení (či už úspešnom alebo s chybou)
    }
});

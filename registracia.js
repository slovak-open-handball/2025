document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registrationForm');
    const statusMessage = document.getElementById('statusMessage');
    const phonePrefixSelect = document.getElementById('phonePrefix');

    // Získanie referencií na input polia pre validáciu
    const icoInput = document.getElementById('icoInput');
    const dicInput = document.getElementById('dicInput');
    const icDPHInput = document.getElementById('icDPHInput');
    const houseNumberInput = document.getElementById('houseNumberInput');
    const pscInput = document.getElementById('pscInput');
    const phoneNumberInput = document.getElementById('phoneNumberInput');
    const emailInput = document.getElementById('emailInput'); // Nový input pre e-mail

    // Kompletný zoznam svetových predvolieb zoradený abecedne podľa názvu krajiny
    const phonePrefixes = [
        { code: '+93', name: 'Afganistan (+93)' },
        { code: '+355', name: 'Albánsko (+355)' },
        { code: '+213', name: 'Alžírsko (+213)' },
        { code: '+1-684', name: 'Americká Samoa (+1-684)' },
        { code: '+376', name: 'Andorra (+376)' },
        { code: '+244', name: 'Angola (+244)' },
        { code: '+1-264', name: 'Anguilla (+1-264)' },
        { code: '+672', name: 'Antarktída (+672)' },
        { code: '+1-268', name: 'Antigua a Barbuda (+1-268)' },
        { code: '+54', name: 'Argentína (+54)' },
        { code: '+374', name: 'Arménsko (+374)' },
        { code: '+297', name: 'Aruba (+297)' },
        { code: '+61', name: 'Austrália (+61)' },
        { code: '+43', name: 'Rakúsko (+43)' },
        { code: '+994', name: 'Azerbajdžan (+994)' },
        { code: '+1-242', name: 'Bahamy (+1-242)' },
        { code: '+973', name: 'Bahrajn (+973)' },
        { code: '+880', name: 'Bangladéš (+880)' },
        { code: '+1-246', name: 'Barbados (+1-246)' },
        { code: '+375', name: 'Bielorusko (+375)' },
        { code: '+32', name: 'Belgicko (+32)' },
        { code: '+501', name: 'Belize (+501)' },
        { code: '+229', name: 'Benin (+229)' },
        { code: '+1-441', name: 'Bermudy (+1-441)' },
        { code: '+975', name: 'Bhután (+975)' },
        { code: '+591', name: 'Bolívia (+591)' },
        { code: '+387', name: 'Bosna a Hercegovina (+387)' },
        { code: '+267', name: 'Botswana (+267)' },
        { code: '+55', name: 'Brazília (+55)' },
        { code: '+246', name: 'Britské indickooceánske územie (+246)' },
        { code: '+1-284', name: 'Britské Panenské ostrovy (+1-284)' },
        { code: '+673', name: 'Brunej (+673)' },
        { code: '+359', name: 'Bulharsko (+359)' },
        { code: '+226', name: 'Burkina Faso (+226)' },
        { code: '+257', name: 'Burundi (+257)' },
        { code: '+855', name: 'Kambodža (+855)' },
        { code: '+237', name: 'Kamerun (+237)' },
        { code: '+1', name: 'Kanada (+1)' },
        { code: '+238', name: 'Kapverdy (+238)' },
        { code: '+1-345', name: 'Kajmanské ostrovy (+1-345)' },
        { code: '+236', name: 'Stredoafrická republika (+236)' },
        { code: '+235', name: 'Čad (+235)' },
        { code: '+56', name: 'Čile (+56)' },
        { code: '+86', name: 'Čína (+86)' },
        { code: '+61', name: 'Vianočný ostrov (+61)' },
        { code: '+61', name: 'Kokosové ostrovy (Keelingove ostrovy) (+61)' },
        { code: '+57', name: 'Kolumbia (+57)' },
        { code: '+269', name: 'Komory (+269)' },
        { code: '+242', name: 'Kongo - Brazzaville (+242)' },
        { code: '+243', name: 'Kongo - Kinshasa (+243)' },
        { code: '+682', name: 'Cookove ostrovy (+682)' },
        { code: '+506', name: 'Kostarika (+506)' },
        { code: '+225', name: 'Pobrežie Slonoviny (+225)' },
        { code: '+385', name: 'Chorvátsko (+385)' },
        { code: '+53', name: 'Kuba (+53)' },
        { code: '+357', name: 'Cyprus (+357)' },
        { code: '+420', name: 'Česká republika (+420)' },
        { code: '+45', name: 'Dánsko (+45)' },
        { code: '+253', name: 'Džibutsko (+253)' },
        { code: '+1-767', name: 'Dominika (+1-767)' },
        { code: '+1-809', name: 'Dominikánska republika (+1-809), (+1-829), (+1-849)' },
        { code: '+593', name: 'Ekvádor (+593)' },
        { code: '+20', name: 'Egypt (+20)' },
        { code: '+503', name: 'Salvádor (+503)' },
        { code: '+240', name: 'Rovníková Guinea (+240)' },
        { code: '+291', name: 'Eritrea (+291)' },
        { code: '+372', name: 'Estónsko (+372)' },
        { code: '+251', name: 'Etiópia (+251)' },
        { code: '+500', name: 'Falklandy (+500)' },
        { code: '+298', name: 'Faerské ostrovy (+298)' },
        { code: '+679', name: 'Fidži (+679)' },
        { code: '+358', name: 'Fínsko (+358)' },
        { code: '+33', name: 'Francúzsko (+33)' },
        { code: '+594', name: 'Francúzska Guyana (+594)' },
        { code: '+689', name: 'Francúzska Polynézia (+689)' },
        { code: '+241', name: 'Gabon (+241)' },
        { code: '+220', name: 'Gambia (+220)' },
        { code: '+995', name: 'Gruzínsko (+995)' },
        { code: '+49', name: 'Nemecko (+49)' },
        { code: '+233', name: 'Ghana (+233)' },
        { code: '+350', name: 'Gibraltár (+350)' },
        { code: '+30', name: 'Grécko (+30)' },
        { code: '+299', name: 'Grónsko (+299)' },
        { code: '+1-473', name: 'Grenada (+1-473)' },
        { code: '+590', name: 'Guadeloupe (+590)' },
        { code: '+1-671', name: 'Guam (+1-671)' },
        { code: '+502', name: 'Guatemala (+502)' },
        { code: '+44-1481', name: 'Guernsey (+44-1481)' },
        { code: '+224', name: 'Guinea (+224)' },
        { code: '+245', name: 'Guinea-Bissau (+245)' },
        { code: '+592', name: 'Guyana (+592)' },
        { code: '+509', name: 'Haiti (+509)' },
        { code: '+504', name: 'Honduras (+504)' },
        { code: '+852', name: 'Hongkong (+852)' },
        { code: '+36', name: 'Maďarsko (+36)' },
        { code: '+354', name: 'Island (+354)' },
        { code: '+91', name: 'India (+91)' },
        { code: '+62', name: 'Indonézia (+62)' },
        { code: '+98', name: 'Irán (+98)' },
        { code: '+964', name: 'Irak (+964)' },
        { code: '+353', name: 'Írsko (+353)' },
        { code: '+44-1624', name: 'Ostrov Man (+44-1624)' },
        { code: '+972', name: 'Izrael (+972)' },
        { code: '+39', name: 'Taliansko (+39)' },
        { code: '+1-876', name: 'Jamajka (+1-876)' },
        { code: '+81', name: 'Japonsko (+81)' },
        { code: '+44-1534', name: 'Jersey (+44-1534)' },
        { code: '+962', name: 'Jordánsko (+962)' },
        { code: '+7', name: 'Kazachstan (+7)' },
        { code: '+254', name: 'Keňa (+254)' },
        { code: '+686', name: 'Kiribati (+686)' },
        { code: '+383', name: 'Kosovo (+383)' },
        { code: '+965', name: 'Kuvajt (+965)' },
        { code: '+996', name: 'Kirgizsko (+996)' },
        { code: '+856', name: 'Laos (+856)' },
        { code: '+371', name: 'Lotyšsko (+371)' },
        { code: '+961', name: 'Libanon (+961)' },
        { code: '+266', name: 'Lesotho (+266)' },
        { code: '+231', name: 'Libéria (+231)' },
        { code: '+218', name: 'Líbya (+218)' },
        { code: '+423', name: 'Lichtenštajnsko (+423)' },
        { code: '+370', name: 'Litva (+370)' },
        { code: '+352', name: 'Luxembursko (+352)' },
        { code: '+853', name: 'Macao (+853)' },
        { code: '+389', name: 'Severné Macedónsko (+389)' },
        { code: '+261', name: 'Madagaskar (+261)' },
        { code: '+265', name: 'Malawi (+265)' },
        { code: '+60', name: 'Malajzia (+60)' },
        { code: '+960', name: 'Maledivy (+960)' },
        { code: '+223', name: 'Mali (+223)' },
        { code: '+356', name: 'Malta (+356)' },
        { code: '+692', name: 'Marshallove ostrovy (+692)' },
        { code: '+596', name: 'Martinik (+596)' },
        { code: '+222', name: 'Mauritánia (+222)' },
        { code: '+230', name: 'Maurícius (+230)' },
        { code: '+262', name: 'Mayotte (+262)' },
        { code: '+52', name: 'Mexiko (+52)' },
        { code: '+691', name: 'Mikronézia (+691)' },
        { code: '+373', name: 'Moldavsko (+373)' },
        { code: '+377', name: 'Monako (+377)' },
        { code: '+976', name: 'Mongolsko (+976)' },
        { code: '+382', name: 'Čierna Hora (+382)' },
        { code: '+1-664', name: 'Montserrat (+1-664)' },
        { code: '+212', name: 'Maroko (+212)' },
        { code: '+258', name: 'Mozambik (+258)' },
        { code: '+95', name: 'Mjanmarsko (Barma) (+95)' },
        { code: '+264', name: 'Namíbia (+264)' },
        { code: '+674', name: 'Nauru (+674)' },
        { code: '+977', name: 'Nepál (+977)' },
        { code: '+31', name: 'Holandsko (+31)' },
        { code: '+599', name: 'Holandské Antily (+599)' },
        { code: '+687', name: 'Nová Kaledónia (+687)' },
        { code: '+64', name: 'Nový Zéland (+64)' },
        { code: '+505', name: 'Nikaragua (+505)' },
        { code: '+227', name: 'Niger (+227)' },
        { code: '+234', name: 'Nigéria (+234)' },
        { code: '+683', name: 'Niue (+683)' },
        { code: '+672', name: 'Norfolk (+672)' },
        { code: '+850', name: 'Severná Kórea (+850)' },
        { code: '+1-670', name: 'Severné Mariány (+1-670)' },
        { code: '+47', name: 'Nórsko (+47)' },
        { code: '+968', name: 'Omán (+968)' },
        { code: '+92', name: 'Pakistan (+92)' },
        { code: '+680', name: 'Palau (+680)' },
        { code: '+970', name: 'Palestínske územia (+970)' },
        { code: '+507', name: 'Panama (+507)' },
        { code: '+675', name: 'Papua-Nová Guinea (+675)' },
        { code: '+595', name: 'Paraguaj (+595)' },
        { code: '+51', name: 'Peru (+51)' },
        { code: '+63', name: 'Filipíny (+63)' },
        { code: '+870', name: 'Pitcairnove ostrovy (+870)' },
        { code: '+48', name: 'Poľsko (+48)' },
        { code: '+351', name: 'Portugalsko (+351)' },
        { code: '+1-787', name: 'Portoriko (+1-787), (+1-939)' },
        { code: '+974', name: 'Katar (+974)' },
        { code: '+262', name: 'Réunion (+262)' },
        { code: '+40', name: 'Rumunsko (+40)' },
        { code: '+7', name: 'Rusko (+7)' },
        { code: '+250', name: 'Rwanda (+250)' },
        { code: '+590', name: 'Svätý Bartolomej (+590)' },
        { code: '+290', name: 'Svätá Helena (+290)' },
        { code: '+1-869', name: 'Svätý Krištof a Nevis (+1-869)' },
        { code: '+1-758', name: 'Svätá Lucia (+1-758)' },
        { code: '+590', name: 'Svätý Martin (francúzska časť) (+590)' },
        { code: '+508', name: 'Saint-Pierre a Miquelon (+508)' },
        { code: '+1-784', name: 'Svätý Vincent a Grenadíny (+1-784)' },
        { code: '+685', name: 'Samoa (+685)' },
        { code: '+378', name: 'San Maríno (+378)' },
        { code: '+239', name: 'Svätý Tomáš a Princov ostrov (+239)' },
        { code: '+966', name: 'Saudská Arábia (+966)' },
        { code: '+221', name: 'Senegal (+221)' },
        { code: '+381', name: 'Srbsko (+381)' },
        { code: '+248', name: 'Seychely (+248)' },
        { code: '+232', name: 'Sierra Leone (+232)' },
        { code: '+65', name: 'Singapur (+65)' },
        { code: '+1-721', name: 'Sint Maarten (holandská časť) (+1-721)' },
        { code: '+421', name: 'Slovensko (+421)' },
        { code: '+386', name: 'Slovinsko (+386)' },
        { code: '+677', name: 'Šalamúnove ostrovy (+677)' },
        { code: '+252', name: 'Somálsko (+252)' },
        { code: '+27', name: 'Južná Afrika (+27)' },
        { code: '+82', name: 'Južná Kórea (+82)' },
        { code: '+211', name: 'Južný Sudán (+211)' },
        { code: '+34', name: 'Španielsko (+34)' },
        { code: '+94', name: 'Srí Lanka (+94)' },
        { code: '+249', name: 'Sudán (+249)' },
        { code: '+597', name: 'Surinam (+597)' },
        { code: '+47', name: 'Svalbard a Jan Mayen (+47)' },
        { code: '+268', name: 'Svazijsko (+268)' },
        { code: '+46', name: 'Švédsko (+46)' },
        { code: '+41', name: 'Švajčiarsko (+41)' },
        { code: '+963', name: 'Sýria (+963)' },
        { code: '+886', name: 'Taiwan (+886)' },
        { code: '+992', name: 'Tadžikistan (+992)' },
        { code: '+255', name: 'Tanzánia (+255)' },
        { code: '+66', name: 'Thajsko (+66)' },
        { code: '+670', name: 'Východný Timor (+670)' },
        { code: '+228', name: 'Togo (+228)' },
        { code: '+690', name: 'Tokelau (+690)' },
        { code: '+676', name: 'Tonga (+676)' },
        { code: '+1-868', name: 'Trinidad a Tobago (+1-868)' },
        { code: '+216', name: 'Tunisko (+216)' },
        { code: '+90', name: 'Turecko (+90)' },
        { code: '+993', name: 'Turkménsko (+993)' },
        { code: '+1-649', name: 'Turks a Caicos (+1-649)' },
        { code: '+688', name: 'Tuvalu (+688)' },
        { code: '+256', name: 'Uganda (+256)' },
        { code: '+380', name: 'Ukrajina (+380)' },
        { code: '+971', name: 'Spojené arabské emiráty (+971)' },
        { code: '+44', name: 'Spojené kráľovstvo (+44)' },
        { code: '+1', name: 'Spojené štáty (+1)' },
        { code: '+598', name: 'Uruguaj (+598)' },
        { code: '+998', name: 'Uzbekistan (+998)' },
        { code: '+678', name: 'Vanuatu (+678)' },
        { code: '+379', name: 'Vatikán (+379)' },
        { code: '+58', name: 'Venezuela (+58)' },
        { code: '+84', name: 'Vietnam (+84)' },
        { code: '+681', name: 'Wallis a Futuna (+681)' },
        { code: '+967', name: 'Jemen (+967)' },
        { code: '+260', name: 'Zambia (+260)' },
        { code: '+263', name: 'Zimbabwe (+263)' }
    ].sort((a, b) => a.name.localeCompare(b.name)); // Abecedné zoradenie

    // Naplnenie select boxu predvoľbami
    phonePrefixes.forEach(prefix => {
        const option = document.createElement('option');
        option.value = prefix.code;
        option.textContent = prefix.name; // Zobrazí "Názov krajiny (+Kód)"
        phonePrefixSelect.appendChild(option);
    });

    // Nastavenie predvolenej predvoľby na +421 (Slovensko)
    phonePrefixSelect.value = '+421';

    // Pôvodná funkcia setInitialSelectWidth bola odstránená,
    // pretože Tailwind CSS grid sa postará o rozloženie.
    // Ak by ste ju chceli vrátiť pre špecifické prípady,
    // zvážte menší offset alebo dynamickejší výpočet.

    // --- Validácia IČO (presne 8 číslic) ---
    if (icoInput) {
        icoInput.addEventListener('input', function(event) {
            // Odstráni všetky znaky, ktoré nie sú čísla
            let value = this.value.replace(/[^0-9]/g, '');
            // Obmedzí dĺžku na 8 číslic
            this.value = value.substring(0, 8);
        });
    }

    // --- Validácia DIČ (presne 10 číslic) ---
    if (dicInput) {
        dicInput.addEventListener('input', function(event) {
            // Odstráni všetky znaky, ktoré nie sú čísla
            let value = this.value.replace(/[^0-9]/g, '');
            // Obmedzí dĺžku na 10 číslic
            this.value = value.substring(0, 10);
        });
    }

    // --- Validácia IČ DPH (2 písmená + 10 číslic) ---
    if (icDPHInput) {
        icDPHInput.addEventListener('input', function(event) {
            let value = this.value;
            let formattedValue = '';

            // Prvé dva znaky: iba písmená, prevedené na veľké
            if (value.length > 0) {
                let firstTwo = value.substring(0, 2).toUpperCase();
                firstTwo = firstTwo.replace(/[^A-Z]/g, ''); // Ponechá len veľké písmená A-Z
                formattedValue += firstTwo;
            }

            // Zvyšných 10 znakov: iba čísla
            if (value.length > 2) {
                let remaining = value.substring(2);
                remaining = remaining.replace(/[^0-9]/g, ''); // Ponechá len čísla
                remaining = remaining.substring(0, 10); // Obmedzí na 10 číslic
                formattedValue += remaining;
            }

            this.value = formattedValue;
        });
    }

    // --- Validácia čísla domu (čísla a '/') ---
    if (houseNumberInput) {
        houseNumberInput.addEventListener('input', function(event) {
            // Ponechá iba číslice a znak '/'
            this.value = this.value.replace(/[^0-9/]/g, '');
        });
    }

    // --- Validácia PSČ (xxx xx, presne 6 znakov) ---
    if (pscInput) {
        pscInput.addEventListener('input', function(event) {
            let value = this.value.replace(/\s/g, ''); // Odstráni existujúce medzery
            let formattedValue = '';

            // Ponechá iba číslice
            value = value.replace(/[^0-9]/g, '');

            if (value.length > 3) {
                formattedValue = value.substring(0, 3) + ' ' + value.substring(3, 5);
            } else {
                formattedValue = value;
            }
            
            // Obmedzí celkovú dĺžku na 6 znakov (vrátane medzery)
            this.value = formattedValue.substring(0, 6);
        });
    }

    // --- Validácia telefónneho čísla (xxx xxx xxx, presne 11 znakov) ---
    if (phoneNumberInput) {
        phoneNumberInput.addEventListener('input', function(event) {
            let value = this.value.replace(/\s/g, ''); // Odstráni existujúce medzery
            let formattedValue = '';

            // Ponechá iba číslice
            value = value.replace(/[^0-9]/g, '');

            if (value.length > 6) {
                formattedValue = value.substring(0, 3) + ' ' + value.substring(3, 6) + ' ' + value.substring(6, 9);
            } else if (value.length > 3) {
                formattedValue = value.substring(0, 3) + ' ' + value.substring(3, 6);
            } else {
                formattedValue = value;
            }

            // Obmedzí celkovú dĺžku na 11 znakov (vrátane medzier)
            this.value = formattedValue.substring(0, 11);
        });
    }

    // --- Validácia e-mailu (musí obsahovať @) ---
    if (emailInput) {
        emailInput.addEventListener('input', function(event) {
            // Pre jednoduchú validáciu na prítomnosť '@'
            // Pre komplexnejšiu validáciu by sa použil pattern alebo regex
            if (this.value.includes('@')) {
                this.setCustomValidity(''); // Vynuluje chybovú správu, ak je platné
            } else {
                this.setCustomValidity('E-mailová adresa musí obsahovať znak "@"'); // Nastaví chybovú správu
            }
        });
        // Pridáme aj validáciu pri odosielaní formulára, ak by používateľ nechal pole prázdne alebo neplatné
        emailInput.addEventListener('blur', function() {
            if (!this.value.includes('@') && this.value.length > 0) {
                this.setCustomValidity('E-mailová adresa musí obsahovať znak "@"');
            } else {
                this.setCustomValidity('');
            }
        });
    }


    form.addEventListener('submit', async function(event) {
        event.preventDefault(); // Zabráni predvolenému odoslaniu formulára

        // Dodatočná kontrola e-mailu pred odoslaním formulára
        if (emailInput && !emailInput.value.includes('@')) {
            statusMessage.textContent = 'Chyba: E-mailová adresa musí obsahovať znak "@".';
            statusMessage.className = 'mt-4 text-center error-message';
            emailInput.focus(); // Zameria sa na pole e-mailu
            return; // Zastaví odosielanie formulára
        }

        statusMessage.textContent = 'Odosielam...';
        statusMessage.className = 'mt-4 text-center text-gray-600';

        const formData = {};
        const elements = form.elements;

        // Zber dát z formulára
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (element.name) {
                const nameParts = element.name.split('.');
                let current = formData;
                for (let j = 0; j < nameParts.length - 1; j++) {
                    if (!current[nameParts[j]]) {
                        current[nameParts[j]] = {};
                    }
                    current = current[nameParts[j]];
                }
                current[nameParts[nameParts.length - 1]] = element.value;
            }
        }

        // Špeciálne spracovanie pre telefónne číslo s predvoľbou
        // Zabezpečí, že predvoľba je súčasťou telefónneho čísla
        formData.contactPerson.phone = `${formData.contactPerson.phonePrefix}${formData.contactPerson.phone}`;
        delete formData.contactPerson.phonePrefix; // Odstráni samostatnú predvoľbu, ak už je spojená

        try {
            // Nahraďte túto URL vašou URL adresou nasadenej webovej aplikácie Google Apps Script
            const scriptUrl = 'https://script.google.com/macros/s/AKfycbw8vy_vpXN6rWjD9taZaJG03onWsJHWKEIZ6XkN2k3dD4-qatrT1dtmYu7jtd9m5Y99/exec'; // ZMEŇTE TOTO!

            const response = await fetch(scriptUrl, {
                method: 'POST',
                mode: 'cors', // Dôležité pre komunikáciu medzi doménami
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const result = await response.json();

            if (result.success) {
                statusMessage.textContent = result.message;
                statusMessage.className = 'mt-4 text-center success-message';
                form.reset(); // Vymaže formulár po úspešnom odoslaní
                phonePrefixSelect.value = '+421'; // Reset predvolenej predvoľby
            } else {
                statusMessage.textContent = `Chyba: ${result.message}`;
                statusMessage.className = 'mt-4 text-center error-message';
            }
        } catch (error) {
            console.error('Chyba pri odosielaní formulára:', error);
            statusMessage.textContent = 'Nastala chyba pri odosielaní formulára. Skúste to prosím znova.';
            statusMessage.className = 'mt-4 text-center error-message';
        }
    });
});

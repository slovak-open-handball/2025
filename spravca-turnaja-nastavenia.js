import { db, settingsCollectionRef, categoriesCollectionRef, getDoc, setDoc, doc, getDocs, query, orderBy, writeBatch } from './spravca-turnaja-common.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Kontrola prihláseného používateľa
    const loggedInUsername = localStorage.getItem('username');
    if (!loggedInUsername || loggedInUsername !== 'admin') {
        //window.location.href = 'login.html';
        window.location.href = 'spravca-turnaja-nastavenia.html';
        return;
    }

    // Získanie referencií na DOM elementy
    const settingsForm = document.getElementById('settingsForm');
    const firstDayStartTimeInput = document.getElementById('firstDayStartTimeInput');
    const otherDaysStartTimeInput = document.getElementById('otherDaysStartTimeInput');
    const settingsStatus = document.getElementById('settingsStatus');

    const categorySettingsForm = document.getElementById('categorySettingsForm');
    const categorySettingsContainer = document.getElementById('categorySettingsContainer');
    const categorySettingsStatus = document.getElementById('categorySettingsStatus');

    const SETTINGS_DOC_ID = 'matchTimeSettings'; // Konštantné ID dokumentu pre nastavenia

    /**
     * Načíta a zobrazí existujúce všeobecné nastavenia a nastavenia kategórií.
     */
    async function loadSettings() {
        try {
            const settingsDocRef = doc(settingsCollectionRef, SETTINGS_DOC_ID);
            const settingsDoc = await getDoc(settingsDocRef);
            let currentSettings = {};

            if (settingsDoc.exists()) {
                currentSettings = settingsDoc.data();
                firstDayStartTimeInput.value = currentSettings.firstDayStartTime || '';
                otherDaysStartTimeInput.value = currentSettings.otherDaysStartTime || '';
            } else {
                console.log("Dokument nastavení neexistuje, použijú sa predvolené hodnoty.");
                firstDayStartTimeInput.value = '';
                otherDaysStartTimeInput.value = '';
            }

            // Načítanie nastavení kategórií (trvanie zápasu, buffer, farba)
            await loadCategorySettings();

        } catch (error) {
            console.error("Chyba pri načítaní nastavení:", error);
            settingsStatus.textContent = 'Chyba pri načítaní nastavení. Pozrite si konzolu pre detaily.';
            settingsStatus.style.color = 'red';
        }
    }

    /**
     * Vypočíta celkové trvanie zápasu na základe zadaných častí.
     * Vzorec: c = n * (t + p) - p
     * @param {number} n Počet častí zápasu.
     * @param {number} t Trvanie časti zápasu (v minútach).
     * @param {number} p Prestávka medzi časťami zápasu (v minútach).
     * @returns {number} Celkový čas zápasu (v minútach).
     */
    function calculateTotalMatchDuration(n, t, p) {
        if (isNaN(n) || isNaN(t) || isNaN(p) || n < 0 || t < 0 || p < 0) {
            return 0; // Vráti 0 pre neplatné vstupy
        }
        // Ak je len jedna časť (n=1), nie je žiadna prestávka medzi časťami
        if (n === 1) {
            return n * t;
        }
        return n * (t + p) - p;
    }

    /**
     * Načíta a zobrazí nastavenia pre jednotlivé kategórie (trvanie, buffer, farba).
     */
    async function loadCategorySettings() {
        categorySettingsContainer.innerHTML = '<p>Načítavam kategórie...</p>';
        try {
            const categoriesSnapshot = await getDocs(query(categoriesCollectionRef, orderBy('name', 'asc')));
            if (categoriesSnapshot.empty) {
                categorySettingsContainer.innerHTML = '<p>Nenašli sa žiadne kategórie.</p>';
                return;
            }

            categorySettingsContainer.innerHTML = ''; // Vymaže existujúci obsah

            categoriesSnapshot.forEach(categoryDoc => {
                const categoryData = categoryDoc.data();
                const categoryId = categoryDoc.id;
                const categoryName = categoryData.name;

                const n_val = categoryData.n || 0;
                const t_val = categoryData.t || 0;
                const p_val = categoryData.p || 0;
                const z_val = categoryData.z || 0;
                const calculated_c = calculateTotalMatchDuration(n_val, t_val, p_val);


                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'category-settings-item';
                categoryDiv.innerHTML = `
                    <h3>${categoryName}</h3>
                    <div class="match-duration-group">
                        <div class="form-group">
                            <label for="n-${categoryId}">Počet častí zápasu:</label>
                            <input type="number" id="n-${categoryId}" class="category-setting-input match-duration-part" data-category-id="${categoryId}" data-setting-type="n" value="${n_val}" min="0">
                        </div>
                        <div class="form-group">
                            <label for="t-${categoryId}">Trvanie časti (min):</label>
                            <input type="number" id="t-${categoryId}" class="category-setting-input match-duration-part" data-category-id="${categoryId}" data-setting-type="t" value="${t_val}" min="0">
                        </div>
                        <div class="form-group">
                            <label for="p-${categoryId}">Prestávka medzi časťami (min):</label>
                            <input type="number" id="p-${categoryId}" class="category-setting-input match-duration-part" data-category-id="${categoryId}" data-setting-type="p" value="${p_val}" min="0">
                        </div>
                        <div class="form-group">
                            <label for="z-${categoryId}">Čas medzi zápasmi (min):</label>
                            <input type="number" id="z-${categoryId}" class="category-setting-input" data-category-id="${categoryId}" data-setting-type="z" value="${z_val}" min="0">
                        </div>
                        <div class="calculated-duration" id="calculated-c-${categoryId}">
                            Celkový čas zápasu: ${calculated_c} minút<br>+ ${z_val} minút (medzi zápasmi)
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="color-${categoryId}">Farba:</label>
                        <input type="color" id="color-${categoryId}" class="category-setting-input" data-category-id="${categoryId}" data-setting-type="color" value="${categoryData.color || '#000000'}">
                    </div>
                `;
                categorySettingsContainer.appendChild(categoryDiv);

                // Pridanie event listenerov pre dynamický výpočet C
                const n_input = document.getElementById(`n-${categoryId}`);
                const t_input = document.getElementById(`t-${categoryId}`);
                const p_input = document.getElementById(`p-${categoryId}`);
                const calculated_c_display = document.getElementById(`calculated-c-${categoryId}`);

                const updateCalculatedCDuration = () => {
                    const current_n = parseInt(n_input.value) || 0;
                    const current_t = parseInt(t_input.value) || 0;
                    const current_p = parseInt(p_input.value) || 0;
                    const new_c = calculateTotalMatchDuration(current_n, current_t, current_p);
                    calculated_c_display.textContent = `Celkový čas zápasu: ${new_c} minút`;
                };

                n_input.addEventListener('input', updateCalculatedCDuration);
                t_input.addEventListener('input', updateCalculatedCDuration);
                p_input.addEventListener('input', updateCalculatedCDuration);
            });
        } catch (error) {
            console.error("Chyba pri načítaní nastavení kategórií:", error);
            categorySettingsContainer.innerHTML = '<p style="color: red;">Chyba pri načítaní nastavení kategórií.</p>';
        }
    }


    // Načíta nastavenia pri načítaní stránky
    await loadSettings();

    // Ukladanie všeobecných nastavení turnaja
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstDayStartTime = firstDayStartTimeInput.value;
            const otherDaysStartTime = otherDaysStartTimeInput.value;

            if (!firstDayStartTime || !otherDaysStartTime) {
                settingsStatus.textContent = 'Prosím, vyplňte oba časy začiatku.';
                settingsStatus.style.color = 'red';
                return;
            }

            try {
                const settingsDocRef = doc(settingsCollectionRef, SETTINGS_DOC_ID);
                await setDoc(settingsDocRef, {
                    firstDayStartTime: firstDayStartTime,
                    otherDaysStartTime: otherDaysStartTime,
                    updatedAt: new Date()
                }, { merge: true });

                settingsStatus.textContent = 'Nastavenia uložené.';
                settingsStatus.style.color = 'green';
            } catch (error) {
                console.error("Chyba pri ukladaní nastavení turnaja: ", error);
                settingsStatus.textContent = 'Chyba pri ukladaní nastavení turnaja. Pozrite si konzolu pre detaily.';
                settingsStatus.style.color = 'red';
            }
        });
    }

    // Ukladanie nastavení kategórií (trvanie zápasu, buffer, farba)
    if (categorySettingsForm) {
        categorySettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const inputs = categorySettingsContainer.querySelectorAll('.category-setting-input');
            let allValid = true;
            const batch = writeBatch(db); // Používa batch pre efektívne ukladanie viacerých dokumentov

            const updatedCategoriesData = {};
            const categorySpecificInputs = {}; // Pre dočasné uloženie n, t, p, z pre výpočet 'c'

            inputs.forEach(input => {
                const categoryId = input.dataset.categoryId;
                const settingType = input.dataset.settingType;
                const value = input.value;

                if (!categorySpecificInputs[categoryId]) {
                    categorySpecificInputs[categoryId] = {};
                }

                if (['n', 't', 'p', 'z'].includes(settingType)) {
                    const numValue = parseInt(value);
                    if (isNaN(numValue) || numValue < 0) {
                        allValid = false;
                        input.style.borderColor = 'red';
                        return;
                    }
                    categorySpecificInputs[categoryId][settingType] = numValue;
                } else if (settingType === 'color') {
                    if (!value) {
                         allValid = false;
                         input.style.borderColor = 'red';
                         return;
                    }
                    categorySpecificInputs[categoryId][settingType] = value;
                }
                input.style.borderColor = ''; // Resetuje farbu okraja
            });

            if (!allValid) {
                categorySettingsStatus.textContent = 'Prosím, skontrolujte chyby vo vstupných poliach kategórií.';
                categorySettingsStatus.style.color = 'red';
                return;
            }

            // Výpočet 'c' a finalizácia 'updatedCategoriesData'
            for (const categoryId in categorySpecificInputs) {
                const data = categorySpecificInputs[categoryId];
                const n = data.n || 0;
                const t = data.t || 0;
                const p = data.p || 0;
                const z = data.z || 0; // 'z' je bufferTime
                
                const calculated_c = calculateTotalMatchDuration(n, t, p);

                updatedCategoriesData[categoryId] = {
                    n: n,
                    t: t,
                    p: p,
                    z: z, // Uložiť aj 'z' ako bufferTime
                    duration: calculated_c, // Uložiť vypočítané 'c' ako duration
                    bufferTime: z, // 'z' je čas medzi zápasmi, ktorý je použitý ako bufferTime
                    color: data.color || '#000000'
                };
            }


            try {
                // Iteruje cez zozbierané dáta a vykoná aktualizácie v batchi
                for (const categoryId in updatedCategoriesData) {
                    const categoryDocRef = doc(categoriesCollectionRef, categoryId);
                    batch.update(categoryDocRef, updatedCategoriesData[categoryId]);
                }
                await batch.commit();

                categorySettingsStatus.textContent = 'Nastavenia kategórií uložené.';
                categorySettingsStatus.style.color = 'green';
                await loadCategorySettings(); // Znova načíta nastavenia, aby sa prejavili zmeny
            } catch (error) {
                console.error("Chyba pri ukladaní nastavení kategórií: ", error);
                categorySettingsStatus.textContent = 'Chyba pri ukladaní nastavení kategórií. Pozrite si konzolu pre detaily.';
                categorySettingsStatus.style.color = 'red';
            }
        });
    }
});

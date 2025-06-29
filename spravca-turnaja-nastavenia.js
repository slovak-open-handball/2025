import { db, settingsCollectionRef, categoriesCollectionRef, getDoc, setDoc, doc, getDocs, query, orderBy, writeBatch } from './spravca-turnaja-common.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Kontrola prihláseného používateľa
    const loggedInUsername = localStorage.getItem('username');
    if (!loggedInUsername || loggedInUsername !== 'admin') {
        window.location.href = 'login.html';
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

                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'category-settings-item';
                categoryDiv.innerHTML = `
                    <h3>${categoryName}</h3>
                    <div class="form-group">
                        <label for="duration-${categoryId}">Trvanie zápasu (minúty):</label>
                        <input type="number" id="duration-${categoryId}" class="category-setting-input" data-category-id="${categoryId}" data-setting-type="duration" value="${categoryData.duration || 0}" min="0">
                    </div>
                    <div class="form-group">
                        <label for="bufferTime-${categoryId}">Čas medzi zápasmi (minúty):</label>
                        <input type="number" id="bufferTime-${categoryId}" class="category-setting-input" data-category-id="${categoryId}" data-setting-type="bufferTime" value="${categoryData.bufferTime || 0}" min="0">
                    </div>
                    <div class="form-group">
                        <label for="color-${categoryId}">Farba:</label>
                        <input type="color" id="color-${categoryId}" class="category-setting-input" data-category-id="${categoryId}" data-setting-type="color" value="${categoryData.color || '#000000'}">
                    </div>
                `;
                categorySettingsContainer.appendChild(categoryDiv);
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

            inputs.forEach(input => {
                const categoryId = input.dataset.categoryId;
                const settingType = input.dataset.settingType;
                const value = input.value;

                if (settingType === 'duration' || settingType === 'bufferTime') {
                    const numValue = parseInt(value);
                    if (isNaN(numValue) || numValue < 0) { // Trvanie a buffer čas musia byť >= 0
                        allValid = false;
                        input.style.borderColor = 'red';
                        return;
                    }
                    if (!updatedCategoriesData[categoryId]) {
                        updatedCategoriesData[categoryId] = {};
                    }
                    updatedCategoriesData[categoryId][settingType] = numValue;
                } else if (settingType === 'color') {
                    // Pre farbu stačí overiť, či nie je prázdna (input[type="color"] to zvyčajne rieši)
                    if (!value) {
                         allValid = false;
                         input.style.borderColor = 'red';
                         return;
                    }
                    if (!updatedCategoriesData[categoryId]) {
                        updatedCategoriesData[categoryId] = {};
                    }
                    updatedCategoriesData[categoryId][settingType] = value;
                }
                input.style.borderColor = ''; // Resetuje farbu okraja
            });

            if (!allValid) {
                categorySettingsStatus.textContent = 'Prosím, skontrolujte chyby vo vstupných poliach kategórií.';
                categorySettingsStatus.style.color = 'red';
                return;
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

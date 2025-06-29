import { db, settingsCollectionRef, categoriesCollectionRef, getDoc, setDoc, doc, getDocs, query, orderBy, writeBatch } from './spravca-turnaja-common.js';

document.addEventListener('DOMContentLoaded', async () => {
    const loggedInUsername = localStorage.getItem('username');
    if (!loggedInUsername || loggedInUsername !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    const settingsForm = document.getElementById('settingsForm');
    const firstDayStartTimeInput = document.getElementById('firstDayStartTimeInput');
    const otherDaysStartTimeInput = document.getElementById('otherDaysStartTimeInput');
    const settingsStatus = document.getElementById('settingsStatus');

    const categorySettingsForm = document.getElementById('categorySettingsForm');
    const categorySettingsContainer = document.getElementById('categorySettingsContainer');
    const categorySettingsStatus = document.getElementById('categorySettingsStatus');

    const SETTINGS_DOC_ID = 'matchTimeSettings'; // Constant document ID for settings

    // Function to load existing settings
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
                console.log("Settings document does not exist, default values will be used.");
                firstDayStartTimeInput.value = '';
                otherDaysStartTimeInput.value = '';
            }

            // Load category settings (match duration, buffer, color)
            await loadCategorySettings();

        } catch (error) {
            console.error("Error loading settings:", error);
            settingsStatus.textContent = 'Error loading settings. See console for details.';
            settingsStatus.style.color = 'red';
        }
    }

    // Function to load and display category settings (duration, buffer, color)
    async function loadCategorySettings() {
        categorySettingsContainer.innerHTML = '<p>Loading categories...</p>';
        try {
            const categoriesSnapshot = await getDocs(query(categoriesCollectionRef, orderBy('name', 'asc')));
            if (categoriesSnapshot.empty) {
                categorySettingsContainer.innerHTML = '<p>No categories found.</p>';
                return;
            }

            categorySettingsContainer.innerHTML = ''; // Clear content

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
            console.error("Error loading category settings:", error);
            categorySettingsContainer.innerHTML = '<p style="color: red;">Error loading category settings.</p>';
        }
    }


    // Load settings on page load
    await loadSettings();

    // Saving general tournament settings
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstDayStartTime = firstDayStartTimeInput.value;
            const otherDaysStartTime = otherDaysStartTimeInput.value;

            if (!firstDayStartTime || !otherDaysStartTime) {
                settingsStatus.textContent = 'Please fill in both start times.';
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
                console.error("Error saving tournament settings: ", error);
                settingsStatus.textContent = 'Error saving tournament settings. See console for details.';
                settingsStatus.style.color = 'red';
            }
        });
    }

    // Saving category settings (match duration, buffer, color)
    if (categorySettingsForm) {
        categorySettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const inputs = categorySettingsContainer.querySelectorAll('.category-setting-input');
            let allValid = true;
            const batch = writeBatch(db); // Use batch for efficient saving of multiple documents

            const updatedCategoriesData = {};

            inputs.forEach(input => {
                const categoryId = input.dataset.categoryId;
                const settingType = input.dataset.settingType;
                const value = input.value;

                if (settingType === 'duration' || settingType === 'bufferTime') {
                    const numValue = parseInt(value);
                    if (isNaN(numValue) || numValue < 0) { // Duration must be >= 0, buffer time >= 0
                        allValid = false;
                        input.style.borderColor = 'red';
                        return;
                    }
                    if (!updatedCategoriesData[categoryId]) {
                        updatedCategoriesData[categoryId] = {};
                    }
                    updatedCategoriesData[categoryId][settingType] = numValue;
                } else if (settingType === 'color') {
                    // For color, just validate that it's not empty (input[type="color"] usually handles this)
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
                input.style.borderColor = ''; // Reset border color
            });

            if (!allValid) {
                categorySettingsStatus.textContent = 'Please check for errors in the category input fields.';
                categorySettingsStatus.style.color = 'red';
                return;
            }

            try {
                // Iterate through collected data and perform updates in batch
                for (const categoryId in updatedCategoriesData) {
                    const categoryDocRef = doc(categoriesCollectionRef, categoryId);
                    batch.update(categoryDocRef, updatedCategoriesData[categoryId]);
                }
                await batch.commit();

                categorySettingsStatus.textContent = 'Nastavenia kategórií uložené.';
                categorySettingsStatus.style.color = 'green';
                await loadCategorySettings(); // Reload settings to reflect changes
            } catch (error) {
                console.error("Error saving category settings: ", error);
                categorySettingsStatus.textContent = 'Error saving category settings. See console for details.';
                categorySettingsStatus.style.color = 'red';
            }
        });
    }
});

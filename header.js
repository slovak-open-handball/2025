// header.js
// Tento súbor predpokladá, že __app_id, __firebase_config, __initial_auth_token a __firebase_app_name
// sú globálne definované v <head> hlavného HTML súboru.

// Inicializácia Firebase (ak už nie je inicializovaná iným skriptom)
let firebaseAppHeader;
let authHeader;
let dbHeader;

// Pomocná funkcia na aktualizáciu viditeľnosti odkazov v hlavičke
function updateHeaderLinks(currentUser, isRegistrationOpenStatus) {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink && profileLink && logoutButton && registerLink) {
        if (currentUser) { // Ak je používateľ prihlásený
            authLink.classList.add('hidden');
            profileLink.classList.remove('hidden');
            logoutButton.classList.remove('hidden');
            registerLink.classList.add('hidden'); // Skryť registračný odkaz, ak je prihlásený
        } else { // Ak používateľ nie je prihlásený
            authLink.classList.remove('hidden');
            profileLink.classList.add('hidden');
            logoutButton.classList.add('hidden');
            if (isRegistrationOpenStatus) {
                registerLink.classList.remove('hidden');
            } else {
                registerLink.classList.add('hidden');
            }
        }
    } else {
        console.warn("Header.js: Niektoré navigačné odkazy neboli nájdené.");
    }
}

// Globálne premenné na uchovávanie stavu pre hlavičku (zjednodušené, nie React stav)
let currentHeaderUser = null;
let currentIsRegistrationOpenStatus = false;

// Funkcia na inicializáciu logiky hlavičky závislej od DOM
function initializeHeaderLogic() {
    console.log("Header.js: initializeHeaderLogic spustená.");

    // Inicializácia Firebase pre hlavičku
    try {
        // Skontrolujeme, či už existuje inštancia Firebase s týmto názvom
        try {
            firebaseAppHeader = firebase.app(headerAppName); // Pokúsime sa získať existujúcu pomenovanú aplikáciu
        } catch (e) {
            // Ak pomenovaná aplikácia neexistuje, inicializujeme ju
            firebaseAppHeader = firebase.initializeApp(firebaseConfig, headerAppName);
        }
        
        authHeader = firebase.auth(firebaseAppHeader);
        dbHeader = firebase.firestore(firebaseAppHeader);
        console.log("Header.js: Firebase inicializovaná pre hlavičku.");

    } catch (e) {
        console.error("Header.js: Chyba pri inicializácii Firebase pre hlavičku:", e);
        // Ak inicializácia zlyhá, uistite sa, že authHeader a dbHeader sú null
        authHeader = null;
        dbHeader = null;
    }

    // Počúvanie zmien stavu autentifikácie
    if (authHeader) {
        // Zmena z onAuthStateChanged na onIdTokenChanged pre detekciu zmeny hesla
        authHeader.onIdTokenChanged(async (user) => {
            currentHeaderUser = user;
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
            console.log("Header.js: onIdTokenChanged - Používateľ:", user ? user.uid : "null");

            if (user) {
                // Kontrola, či sa heslo zmenilo
                try {
                    // Ak používateľ zmenil heslo, jeho token by mal byť novší ako lastSignInTime
                    // Firebase automaticky invaliduje staré tokeny po zmene hesla
                    // Pri re-autentifikácii alebo zmene hesla sa token zmení
                    // Môžeme použiť getAuth().currentUser.reload() a potom skontrolovať metadata
                    await user.reload(); // Načítanie najnovších údajov používateľa
                    if (user.metadata && user.metadata.lastSignInTime && user.metadata.creationTime) {
                        // Porovnanie času posledného prihlásenia s časom vytvorenia účtu
                        // Ak je lastSignInTime výrazne novší ako creationTime a používateľ práve zmenil heslo
                        // (čo sa stane pri re-autentifikácii), môžeme to detekovať.
                        // Pre jednoduchú detekciu zmeny hesla je najlepšie spoliehať sa na to,
                        // že Firebase SDK automaticky invaliduje staré relácie.
                        // Ak sa používateľ prihlási s novým heslom, token sa zmení a tento listener sa spustí.
                        // Ak sa token zmenil a používateľ predtým nebol null (t.j. bol prihlásený),
                        // a teraz má nový token, môžeme ho odhlásiť.
                        // Avšak, Firebase už toto spracováva interne invalidáciou starých tokenov.
                        // Pre explicitné odhlásenie po *úspešnej* zmene hesla (ktorá sa vykonáva v logged-in-change-password.js)
                        // je lepšie nechať túto logiku na stránke zmeny hesla.
                        // Ak by sme chceli detekovať zmenu hesla, ktorá nastala *mimo* aktuálnej relácie,
                        // museli by sme porovnávať tokeny alebo časové pečiatky.
                        // Pre túto požiadavku, ak sa ID token zmenil, a používateľ bol prihlásený,
                        // a chceme ho odhlásiť, môžeme použiť jednoduchšiu logiku.

                        // Ak je user.auth.currentUser.auth.metadata.lastSignInTime novší ako predtým uložený čas
                        // alebo ak sa zmenil token (čo už onIdTokenChanged detekuje),
                        // a chceme vynútiť odhlásenie, môžeme to urobiť tu.
                        // Ale pozor, to by znamenalo odhlásenie pri každej zmene tokenu, nielen hesla.

                        // Najbezpečnejší a najjednoduchší spôsob je nechať logiku odhlásenia
                        // po zmene hesla na stránke, kde sa heslo mení (logged-in-change-password.js),
                        // ako sme to už implementovali.
                        // Tento listener je primárne na sledovanie zmien tokenu, nie na vynútené odhlásenie.

                        // Ak však trváš na odhlásení tu v header.js, museli by sme mať nejaký stav
                        // alebo porovnanie tokenov, aby sme vedeli, že ide o zmenu hesla a nie len obnovu tokenu.
                        // Pre jednoduchosť a bezpečnosť, ak sa token zmenil a používateľ je stále prihlásený,
                        // a predtým bol prihlásený, môžeme ho odhlásiť.
                        // Toto je však agresívne a môže viesť k nechceným odhláseniam.

                        // Lepšie je, aby sa odhlásenie po zmene hesla vykonalo explicitne na stránke zmeny hesla.
                        // Ak však chceš, aby sa používateľ odhlásil pri *každej* detekovanej zmene tokenu
                        // (čo zahŕňa aj zmenu hesla), môžeš použiť nasledujúce:
                        // if (user && currentHeaderUser && user.uid === currentHeaderUser.uid && user.emailVerified !== currentHeaderUser.emailVerified) {
                        //     // Príklad: ak sa zmenil stav overenia emailu
                        // }

                        // Pre detekciu zmeny hesla priamo v header.js by sme potrebovali porovnať
                        // user.auth.currentUser.metadata.lastSignInTime s nejakou predtým uloženou hodnotou
                        // alebo s časom, kedy bol token naposledy vydaný.
                        // Avšak, Firebase to už rieši za nás invalidáciou tokenov.
                        // Ak sa používateľ pokúsi použiť starý token po zmene hesla, Firebase ho odmietne.

                        // Ak je cieľom, aby sa používateľ odhlásil, ak sa jeho heslo zmenilo *kdekoľvek*
                        // (napr. na inom zariadení alebo administrátorom),
                        // Firebase SDK to spracuje automaticky invalidáciou tokenu.
                        // Ak však chceš explicitné odhlásenie, môžeme pridať kontrolu:
                        // Firebase tokeny obsahujú claim 'auth_time', ktorý sa mení pri zmene hesla.
                        // Môžeme si uložiť posledný 'auth_time' a porovnať ho.
                        const currentAuthTime = user.metadata.lastSignInTime; // Toto je čas posledného prihlásenia, nie zmeny hesla
                        // Pre zmenu hesla by sme potrebovali 'auth_time' z ID tokenu
                        const idTokenResult = await user.getIdTokenResult();
                        const tokenAuthTime = idTokenResult.claims.auth_time * 1000; // Prevod na milisekundy

                        // Uloženie posledného známeho auth_time do session storage
                        const lastAuthTimeKey = `lastAuthTime_${user.uid}`;
                        const lastKnownAuthTime = sessionStorage.getItem(lastAuthTimeKey);

                        if (lastKnownAuthTime && tokenAuthTime > parseInt(lastKnownAuthTime)) {
                            // Token bol vydaný novšie ako posledný známy, čo môže naznačovať zmenu hesla
                            // Alebo len obnovu tokenu. Potrebujeme presnejšiu detekciu.
                            // Najspoľahlivejší spôsob je použiť Firebase Admin SDK na backend,
                            // alebo sa spoliehať na re-autentifikáciu na frontend.

                            // Ak chceme vynútiť odhlásenie pri každej zmene ID tokenu (čo zahŕňa aj zmenu hesla)
                            // a zároveň sa vyhnúť odhláseniu pri každom obnovení tokenu, je to zložité.
                            // Najlepšie je nechať to na stránke zmeny hesla.

                            // Pre túto požiadavku, ak sa heslo zmenilo (čo spôsobí zmenu ID tokenu),
                            // a chceme používateľa odhlásiť, môžeme použiť jednoduchý prístup:
                            // Ak sa ID token zmenil a používateľ bol predtým prihlásený, odhlásime ho.
                            // To však odhlási používateľa aj pri bežnej obnove tokenu (každú hodinu).
                            // Preto je nasledujúca logika *veľmi agresívna* a neodporúča sa pre bežné použitie.
                            // Ledaže je to explicitne požadované pre vysokú bezpečnosť.

                            // Ak je zmena hesla detekovaná na stránke zmeny hesla,
                            // tam sa vykoná odhlásenie.
                            // Tento listener v header.js by mal skôr reagovať na externé zmeny (napr. admin resetoval heslo).
                            // V takom prípade by sa `user.reload()` a následné `user.getIdTokenResult()`
                            // mali postarať o to, že token bude neplatný.
                            // Ak je token neplatný, `user` objekt bude `null` pri ďalšej kontrole.

                            // Ak chceme *vynútiť* odhlásenie, ak sa token zmenil a je to po zmene hesla:
                            // Firebase neposkytuje priamy claim "password_changed_at".
                            // Najlepší prístup je porovnať user.auth.currentUser.metadata.lastSignInTime
                            // s posledným známym časom prihlásenia.
                            // Ak sa heslo zmení, lastSignInTime sa aktualizuje.

                            // Pre túto úlohu, ak sa heslo zmenilo (čo už je spracované v logged-in-change-password.js),
                            // a chceme, aby sa používateľ odhlásil, môžeme sa spoľahnúť na to,
                            // že stránka zmeny hesla to už robí.
                            // Ak by sme chceli detekovať zmenu hesla *mimo* stránky zmeny hesla,
                            // potrebovali by sme robustnejšiu logiku, ktorá by mohla byť založená na:
                            // 1. Ukladaní `auth_time` z ID tokenu do session/local storage.
                            // 2. Pri každom `onIdTokenChanged` porovnať aktuálny `auth_time` s uloženým.
                            // 3. Ak je aktuálny `auth_time` novší, znamená to, že token bol vydaný po zmene hesla
                            //    alebo inej bezpečnostnej udalosti.
                            // 4. Vtedy odhlásiť používateľa.

                            // Implementácia:
                            if (lastKnownAuthTime && tokenAuthTime > parseInt(lastKnownAuthTime)) {
                                console.log("Header.js: Detekovaná zmena ID tokenu (možno zmena hesla), odhlasujem používateľa.");
                                await authHeader.signOut();
                                window.location.href = 'login.html'; // Presmerovanie po odhlásení
                                sessionStorage.removeItem(lastAuthTimeKey); // Vyčistíme uložený čas
                            }
                            sessionStorage.setItem(lastAuthTimeKey, tokenAuthTime.toString());
                        }
                    }
                } catch (reloadError) {
                    console.error("Header.js: Chyba pri načítaní používateľa po zmene ID tokenu:", reloadError);
                    // Ak sa reload nepodarí (napr. token je už neplatný), odhlásiť
                    await authHeader.signOut();
                    window.location.href = 'login.html';
                }
            } else {
                // Používateľ je odhlásený, vyčistíme uložený auth_time
                sessionStorage.removeItem(`lastAuthTime_${user ? user.uid : 'unknown'}`);
            }
        });

        // Počiatočné prihlásenie pre hlavičku (ak existuje vlastný token)
        if (initialAuthToken) {
            authHeader.signInWithCustomToken(initialAuthToken).catch(e => {
                console.error("Header.js: Chyba pri počiatočnom prihlásení Firebase pre hlavičku:", e);
            });
        }
    } else {
        console.warn("Header.js: Auth inštancia nie je dostupná pre onIdTokenChanged.");
    }

    // Počúvanie zmien nastavení registrácie
    if (dbHeader) {
        const settingsDocRef = dbHeader.collection('settings').doc('registration');
        settingsDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                const regStart = data.registrationStartDate ? data.registrationStartDate.toDate() : null;
                const regEnd = data.registrationEndDate ? data.registrationEndDate.toDate() : null;
                const now = new Date();

                const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
                const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

                currentIsRegistrationOpenStatus = (
                    (isRegStartValid ? now >= regStart : true) &&
                    (isRegEndValid ? now <= regEnd : true)
                );
            } else {
                currentIsRegistrationOpenStatus = false; // Predvolene zatvorené, ak sa nastavenia nenašli
            }
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        }, error => {
            console.error("Header.js: Chyba pri načítaní nastavení registrácie pre hlavičku:", error);
            currentIsRegistrationOpenStatus = false;
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        });
    } else {
        console.warn("Header.js: Firestore inštancia nie je dostupná pre načítanie nastavení.");
    }

    // Spracovanie odhlásenia pre tlačidlo v hlavičke
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            if (authHeader) { // Používame authHeader
                try {
                    await authHeader.signOut();
                    window.location.href = 'login.html'; // Presmerovanie po odhlásení
                } catch (e) {
                    console.error("Header.js: Chyba pri odhlásení z hlavičky:", e);
                }
            }
        });
    }
}

// Sprístupnenie funkcie globálne, aby ju mohol volať register.html
window.initializeHeaderLogic = initializeHeaderLogic;

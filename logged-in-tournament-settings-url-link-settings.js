// logged-in-tournament-settings-url-link-settings.js

import { doc, onSnapshot, setDoc, Timestamp, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function UrlLinkSettings({
    db,
    userProfileData,
    showNotification,
    sendAdminNotification,
}) {
    const [tournamentRulesUrl, setTournamentRulesUrl] = React.useState('');
    const [tournamentReglementUrl, setTournamentReglementUrl] = React.useState('');
    const [loading, setLoading] = React.useState(true);

    const originalValuesRef = React.useRef({
        tournamentRulesUrl: '',
        tournamentReglementUrl: ''
    });

    const hasUnsavedChangesRef = React.useRef(false);

    // Sledovanie neuložených zmien
    React.useEffect(() => {
        const hasChanges =
            tournamentRulesUrl !== originalValuesRef.current.tournamentRulesUrl ||
            tournamentReglementUrl !== originalValuesRef.current.tournamentReglementUrl;
        hasUnsavedChangesRef.current = hasChanges;
    }, [tournamentRulesUrl, tournamentReglementUrl]);

    // Načítanie URL adries z Firestore
    React.useEffect(() => {
        if (!db) return;

        const docRef = doc(collection(db, 'settings'), 'urlLinks');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // Ak má používateľ neuložené zmeny, neprepisuj inputy
            if (hasUnsavedChangesRef.current) {
                console.log("[UrlLinkSettings] onSnapshot ignorovaný – používateľ má neuložené zmeny");
                return;
            }

            if (docSnap.exists()) {
                const data = docSnap.data();
                const loadedRules = data.tournamentRulesUrl || '';
                const loadedReglement = data.tournamentReglementUrl || '';

                setTournamentRulesUrl(loadedRules);
                setTournamentReglementUrl(loadedReglement);

                originalValuesRef.current = {
                    tournamentRulesUrl: loadedRules,
                    tournamentReglementUrl: loadedReglement
                };
            } else {
                setTournamentRulesUrl('');
                setTournamentReglementUrl('');
                originalValuesRef.current = {
                    tournamentRulesUrl: '',
                    tournamentReglementUrl: ''
                };
            }
            setLoading(false);
        }, (error) => {
            showNotification(`Chyba pri načítaní URL adries: ${error.message}`, 'error');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, showNotification]);

    // Uloženie URL adries do Firestore
    const saveUrls = async () => {
        if (!db) return;

        const trimmedRules = tournamentRulesUrl.trim();
        const trimmedReglement = tournamentReglementUrl.trim();

        // Validácia URL (ak nie sú prázdne)
        const urlRegex = /^(https?:\/\/)[^\s]+$/i;
        if (trimmedRules && !urlRegex.test(trimmedRules)) {
            showNotification('URL adresa pre Pravidlá turnaja musí začínať http:// alebo https://', 'error');
            return;
        }
        if (trimmedReglement && !urlRegex.test(trimmedReglement)) {
            showNotification('URL adresa pre Reglement turnaja musí začínať http:// alebo https://', 'error');
            return;
        }

        // Uložíme si pôvodné hodnoty PRE zápisom, aby sme vedeli, čo sa zmenilo
        const originalRules = originalValuesRef.current.tournamentRulesUrl || '';
        const originalReglement = originalValuesRef.current.tournamentReglementUrl || '';

        try {
            const docRef = doc(collection(db, 'settings'), 'urlLinks');
            await setDoc(docRef, {
                tournamentRulesUrl: trimmedRules,
                tournamentReglementUrl: trimmedReglement,
                updatedAt: Timestamp.fromDate(new Date())
            }, { merge: true });

            console.log("[UrlLinkSettings] Uložené do Firestore.");
            console.log("[UrlLinkSettings] sendAdminNotification je:", typeof sendAdminNotification);
            console.log("[UrlLinkSettings] Pôvodné hodnoty:", { originalRules, originalReglement });
            console.log("[UrlLinkSettings] Nové hodnoty:", { trimmedRules, trimmedReglement });

            // Notifikácie pre administrátorov
            if (sendAdminNotification) {
                // --- PRAVIDLÁ TURNAJA ---
                if (originalRules !== trimmedRules) {
                    const isNewRules = originalRules === '' && trimmedRules !== '';
                    console.log(`[UrlLinkSettings] Zmena Pravidiel turnaja: '${originalRules}' -> '${trimmedRules}' (typ: ${isNewRules ? 'create' : 'edit'})`);

                    try {
                        if (isNewRules) {
                            sendAdminNotification({
                                type: 'createUrlLink',
                                data: {
                                    label: 'Pravidlá turnaja',
                                    url: trimmedRules
                                }
                            });
                        } else {
                            sendAdminNotification({
                                type: 'editUrlLink',
                                data: {
                                    originalLabel: 'Pravidlá turnaja',
                                    originalUrl: originalRules,
                                    newLabel: 'Pravidlá turnaja',
                                    newUrl: trimmedRules
                                }
                            });
                        }
                    } catch (notifError) {
                        console.error("[UrlLinkSettings] Chyba pri odosielaní notifikácie (Pravidlá):", notifError);
                    }
                }

                // --- REGLEMENT TURNAJA ---
                if (originalReglement !== trimmedReglement) {
                    const isNewReglement = originalReglement === '' && trimmedReglement !== '';
                    console.log(`[UrlLinkSettings] Zmena Reglementu turnaja: '${originalReglement}' -> '${trimmedReglement}' (typ: ${isNewReglement ? 'create' : 'edit'})`);

                    try {
                        if (isNewReglement) {
                            sendAdminNotification({
                                type: 'createUrlLink',
                                data: {
                                    label: 'Reglement turnaja',
                                    url: trimmedReglement
                                }
                            });
                        } else {
                            sendAdminNotification({
                                type: 'editUrlLink',
                                data: {
                                    originalLabel: 'Reglement turnaja',
                                    originalUrl: originalReglement,
                                    newLabel: 'Reglement turnaja',
                                    newUrl: trimmedReglement
                                }
                            });
                        }
                    } catch (notifError) {
                        console.error("[UrlLinkSettings] Chyba pri odosielaní notifikácie (Reglement):", notifError);
                    }
                }
            } else {
                console.warn("[UrlLinkSettings] sendAdminNotification nie je k dispozícii!");
            }

            // Aktualizujeme pôvodné hodnoty – PO úspešnom uložení
            originalValuesRef.current = {
                tournamentRulesUrl: trimmedRules,
                tournamentReglementUrl: trimmedReglement
            };

            showNotification('URL adresy boli úspešne uložené.', 'success');
        } catch (error) {
            console.error("[UrlLinkSettings] Chyba pri ukladaní:", error);
            showNotification(`Chyba pri ukladaní URL adries: ${error.message}`, 'error');
        }
    };

    if (loading) {
        return React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Načítavam URL adresy...');
    }

    return React.createElement(
        'div',
        { className: 'space-y-6' },
        React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Nastavenia odkazov na URL'),

        React.createElement(
            'div',
            { className: 'bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4' },

            // Pravidlá turnaja
            React.createElement(
                'div',
                null,
                React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-1' }, 'Pravidlá turnaja'),
                React.createElement('input', {
                    type: 'url',
                    value: tournamentRulesUrl,
                    onChange: (e) => setTournamentRulesUrl(e.target.value),
                    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500',
                    placeholder: 'https://...'
                })
            ),

            // Reglement turnaja
            React.createElement(
                'div',
                null,
                React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-1' }, 'Reglement turnaja'),
                React.createElement('input', {
                    type: 'url',
                    value: tournamentReglementUrl,
                    onChange: (e) => setTournamentReglementUrl(e.target.value),
                    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500',
                    placeholder: 'https://...'
                })
            ),

            // Tlačidlo Uložiť
            React.createElement(
                'button',
                {
                    onClick: saveUrls,
                    className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg w-full'
                },
                'Uložiť zmeny'
            )
        )
    );
}

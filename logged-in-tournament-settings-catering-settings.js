// logged-in-tournament-settings-catering-settings.js

import { doc, onSnapshot, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const buildTournamentDays = (arrivalDate, tournamentEnd) => {
    if (!arrivalDate || !tournamentEnd) return [];

    const start = new Date(arrivalDate);
    const end = new Date(tournamentEnd);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (start > end) return [];

    const days = [];
    const current = new Date(start);

    while (current <= end) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;

        days.push({
            date: new Date(current),
            key,
            label: current.toLocaleDateString('sk-SK', {
                weekday: 'short',
                day: 'numeric',
                month: 'numeric',
            }),
            fullLabel: current.toLocaleDateString('sk-SK', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            }),
        });
        current.setDate(current.getDate() + 1);
    }

    return days;
};

const EMPTY_DAY_TIMES = {
    lunch:  { from: '', to: '' },
    dinner: { from: '', to: '' },
};

export function CateringSettings({ db, userProfileData, showNotification, sendAdminNotification }) {
    const [tournamentDays, setTournamentDays] = React.useState([]);
    const [cateringTimes, setCateringTimes] = React.useState({});          // aktuálne v UI
    const [originalCateringTimes, setOriginalCateringTimes] = React.useState({}); // pôvodné z DB
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // 1) Načítame dátumy turnaja zo settings/registration
    React.useEffect(() => {
        if (!db) {
            setLoading(false);
            return;
        }

        const settingsDocRef = doc(db, 'settings', 'registration');

        const unsubscribe = onSnapshot(
            settingsDocRef,
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    const arrivalDate = data.arrivalDate ? data.arrivalDate.toDate() : null;
                    const tournamentEnd = data.tournamentEnd ? data.tournamentEnd.toDate() : null;
                    const days = buildTournamentDays(arrivalDate, tournamentEnd);
                    setTournamentDays(days);
                } else {
                    setTournamentDays([]);
                }
                setLoading(false);
            },
            (error) => {
                console.error('CateringSettings: chyba pri načítaní dátumov turnaja:', error);
                showNotification?.(`Chyba pri načítaní dátumov turnaja: ${error.message}`, 'error');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [db, showNotification]);

    // 2) Načítame existujúce časy stravovania zo settings/catering
    //    POZOR: naplníme AJ cateringTimes AJ originalCateringTimes
    React.useEffect(() => {
        if (!db) return;

        const cateringDocRef = doc(db, 'settings', 'catering');

        const unsubscribe = onSnapshot(
            cateringDocRef,
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data() || {};
                    const loaded = data.times || {};
                    setCateringTimes(loaded);
                    setOriginalCateringTimes(loaded); // 🔥 kópia pre porovnanie
                } else {
                    setCateringTimes({});
                    setOriginalCateringTimes({});
                }
            },
            (error) => {
                console.error('CateringSettings: chyba pri načítaní časov stravovania:', error);
                showNotification?.(`Chyba pri načítaní časov stravovania: ${error.message}`, 'error');
            }
        );

        return () => unsubscribe();
    }, [db, showNotification]);

    const getDayTimes = (dayKey) => {
        return cateringTimes[dayKey] || {
            lunch:  { ...EMPTY_DAY_TIMES.lunch },
            dinner: { ...EMPTY_DAY_TIMES.dinner },
        };
    };

    const handleTimeChange = (dayKey, mealType, field, value) => {
        setCateringTimes((prev) => {
            const day = prev[dayKey] || {
                lunch:  { ...EMPTY_DAY_TIMES.lunch },
                dinner: { ...EMPTY_DAY_TIMES.dinner },
            };
            return {
                ...prev,
                [dayKey]: {
                    ...day,
                    [mealType]: {
                        ...day[mealType],
                        [field]: value,
                    },
                },
            };
        });
    };

    const buildCateringChanges = (original, updated, days) => {
        const changes = [];
        const mealLabel = (m) => (m === 'lunch' ? 'Obed' : 'Večera');

        days.forEach((day) => {
            const orig = original?.[day.key] || {};
            const upd  = updated?.[day.key]  || {};

            ['lunch', 'dinner'].forEach((mealType) => {
                const oFrom = orig?.[mealType]?.from || '';
                const oTo   = orig?.[mealType]?.to   || '';
                const nFrom = upd?.[mealType]?.from  || '';
                const nTo   = upd?.[mealType]?.to    || '';

                const oEmpty = !oFrom && !oTo;
                const nEmpty = !nFrom && !nTo;

                if (oEmpty && nEmpty) return;

                if (oEmpty && !nEmpty) {
                    changes.push(
                        `Deň ${day.fullLabel}: pridané ${mealLabel(mealType)} ${nFrom || '?'} – ${nTo || '?'}`
                    );
                    return;
                }

                if (!oEmpty && nEmpty) {
                    changes.push(
                        `Deň ${day.fullLabel}: odobrané ${mealLabel(mealType)} (bolo ${oFrom || '?'} – ${oTo || '?'})`
                    );
                    return;
                }

                if (oFrom !== nFrom || oTo !== nTo) {
                    const fromChanged = oFrom !== nFrom ? `"od" z '${oFrom || '-'}' na '${nFrom || '-'}'` : '';
                    const toChanged   = oTo   !== nTo   ? `"do" z '${oTo || '-'}' na '${nTo || '-'}'` : '';
                    const parts = [fromChanged, toChanged].filter(Boolean).join(', ');
                    changes.push(
                        `Deň ${day.fullLabel}: ${mealLabel(mealType)} – zmena ${parts}`
                    );
                }
            });
        });

        return changes;
    };

    const handleSave = async () => {
        if (!db || !userProfileData || userProfileData.role !== 'admin') {
            showNotification?.('Nemáte oprávnenie na zmenu nastavení stravovania.', 'error');
            return;
        }

        for (const day of tournamentDays) {
            const t = cateringTimes[day.key];
            if (!t) continue;

            if (t.lunch?.from && t.lunch?.to && t.lunch.from >= t.lunch.to) {
                showNotification?.(`Deň ${day.fullLabel}: čas Obeda "od" musí byť pred časom "do".`, 'error');
                return;
            }
            if (t.dinner?.from && t.dinner?.to && t.dinner.from >= t.dinner.to) {
                showNotification?.(`Deň ${day.fullLabel}: čas Večere "od" musí byť pred časom "do".`, 'error');
                return;
            }
        }

        try {
            setSaving(true);

            // 🔥 PÔVODNÉ hodnoty berieme z originalCateringTimes (načítané z DB)
            const originalTimes = originalCateringTimes;

            const normalized = {};
            tournamentDays.forEach((day) => {
                const t = cateringTimes[day.key];
                if (!t) return;

                const lunchFrom  = t.lunch?.from  || '';
                const lunchTo    = t.lunch?.to    || '';
                const dinnerFrom = t.dinner?.from || '';
                const dinnerTo   = t.dinner?.to   || '';

                if (lunchFrom || lunchTo || dinnerFrom || dinnerTo) {
                    normalized[day.key] = {
                        lunch:  { from: lunchFrom,  to: lunchTo },
                        dinner: { from: dinnerFrom, to: dinnerTo },
                    };
                }
            });

            const cateringDocRef = doc(db, 'settings', 'catering');
            await setDoc(cateringDocRef, {
                times: normalized,
                updatedAt: Timestamp.fromDate(new Date()),
                updatedBy: userProfileData.email || null,
            }, { merge: true });

            // 🔥 Po úspešnom zápise aktualizujeme originalCateringTimes,
            // aby pri ďalšom uložení porovnávanie sedelo
            setOriginalCateringTimes(normalized);

            try {
                const changesList = buildCateringChanges(
                    originalTimes,
                    normalized,
                    tournamentDays
                );

                console.log('CateringSettings: zmeny na odoslanie:', changesList);

                if (typeof sendAdminNotification === 'function' && changesList.length > 0) {
                    await sendAdminNotification({
                        type: 'updateCateringSettings',
                        data: { changes: changesList },
                    });
                    console.log('CateringSettings: notifikácia odoslaná.');
                } else {
                    console.log('CateringSettings: notifikácia sa neposiela (prázdne zmeny alebo chýba funkcia).');
                }
            } catch (notifErr) {
                console.error('CateringSettings: chyba pri vytváraní notifikácie:', notifErr);
            }

            showNotification?.('Nastavenia stravovania boli uložené.', 'success');
        } catch (e) {
            console.error('CateringSettings: chyba pri ukladaní:', e);
            showNotification?.(`Chyba pri ukladaní nastavení stravovania: ${e.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center py-10' },
            React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
        );
    }

    if (tournamentDays.length === 0) {
        return React.createElement(
            'div',
            { className: 'p-6 border border-gray-200 rounded-lg shadow-sm' },
            React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Nastavenia stravovania'),
            React.createElement('p', { className: 'text-gray-500 text-center' },
                'Nie sú dostupné žiadne dátumy turnaja. Nastavte prosím dátum príchodu a koniec turnaja vo Všeobecných nastaveniach registrácie.'
            )
        );
    }

    return React.createElement(
        'div',
        { className: 'p-6 border border-gray-200 rounded-lg shadow-sm' },
        React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-2' }, 'Nastavenia stravovania'),
        React.createElement('p', { className: 'text-sm text-gray-500 mb-6' },
            'Nastavte časový rozsah (od – do) pre Obed a Večeru pre každý deň turnaja.'
        ),

        React.createElement(
            'div',
            { className: 'overflow-x-auto mb-6' },
            React.createElement(
                'table',
                { className: 'min-w-full border-collapse text-sm' },
                React.createElement(
                    'thead',
                    null,
                    React.createElement(
                        'tr',
                        null,
                        React.createElement('th', {
                            rowSpan: 2,
                            className: 'border border-gray-300 bg-gray-100 px-2 py-2 text-left font-bold text-gray-700 min-w-[110px] w-[110px]',
                        }, 'Deň'),
                        React.createElement('th', {
                            colSpan: 2,
                            className: 'border border-gray-300 bg-blue-50 px-3 py-2 text-center font-bold text-blue-700',
                        }, 'Obed'),
                        React.createElement('th', {
                            colSpan: 2,
                            className: 'border border-gray-300 bg-blue-50 px-3 py-2 text-center font-bold text-blue-700',
                        }, 'Večera')
                    ),
                    React.createElement(
                        'tr',
                        null,
                        React.createElement('th', { className: 'border border-gray-300 bg-blue-50 px-2 py-1 text-center text-xs text-blue-700' }, 'Od'),
                        React.createElement('th', { className: 'border border-gray-300 bg-blue-50 px-2 py-1 text-center text-xs text-blue-700' }, 'Do'),
                        React.createElement('th', { className: 'border border-gray-300 bg-blue-50 px-2 py-1 text-center text-xs text-blue-700' }, 'Od'),
                        React.createElement('th', { className: 'border border-gray-300 bg-blue-50 px-2 py-1 text-center text-xs text-blue-700' }, 'Do')
                    )
                ),
                React.createElement(
                    'tbody',
                    null,
                    tournamentDays.map((day, idx) => {
                        const t = getDayTimes(day.key);
                        return React.createElement(
                            'tr',
                            {
                                key: day.key,
                                className: idx % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                            },
                            React.createElement('td', {
                                className: 'border border-gray-300 px-2 py-2 font-medium text-gray-800 whitespace-nowrap w-[110px]',
                                title: day.fullLabel,
                            }, day.label),
                            React.createElement('td', { className: 'border border-gray-300 px-2 py-2 text-center' },
                                React.createElement('input', {
                                    type: 'time',
                                    value: t.lunch?.from || '',
                                    onChange: (e) => handleTimeChange(day.key, 'lunch', 'from', e.target.value),
                                    className: 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500',
                                })
                            ),
                            React.createElement('td', { className: 'border border-gray-300 px-2 py-2 text-center' },
                                React.createElement('input', {
                                    type: 'time',
                                    value: t.lunch?.to || '',
                                    onChange: (e) => handleTimeChange(day.key, 'lunch', 'to', e.target.value),
                                    className: 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500',
                                })
                            ),
                            React.createElement('td', { className: 'border border-gray-300 px-2 py-2 text-center' },
                                React.createElement('input', {
                                    type: 'time',
                                    value: t.dinner?.from || '',
                                    onChange: (e) => handleTimeChange(day.key, 'dinner', 'from', e.target.value),
                                    className: 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500',
                                })
                            ),
                            React.createElement('td', { className: 'border border-gray-300 px-2 py-2 text-center' },
                                React.createElement('input', {
                                    type: 'time',
                                    value: t.dinner?.to || '',
                                    onChange: (e) => handleTimeChange(day.key, 'dinner', 'to', e.target.value),
                                    className: 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500',
                                })
                            )
                        );
                    })
                )
            )
        ),

        React.createElement(
            'div',
            { className: 'flex flex-wrap justify-end items-center gap-3' },
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: handleSave,
                    disabled: saving,
                    className: `font-bold py-2 px-6 rounded-lg transition-colors duration-200 text-white ${
                        saving ? 'bg-blue-300 cursor-wait' : 'bg-blue-500 hover:bg-blue-700'
                    }`,
                },
                saving ? 'Ukladám...' : 'Uložiť nastavenia stravovania'
            )
        )
    );
}

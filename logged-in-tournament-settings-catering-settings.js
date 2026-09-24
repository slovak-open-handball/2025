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
            fullLabelNumeric: `${d}. ${m}. ${y}`,
        });
        current.setDate(current.getDate() + 1);
    }

    return days;
};

const EMPTY_DAY_TIMES = {
    lunch:  { from: '', to: '' },
    dinner: { from: '', to: '' },
};

const timeToMinutes = (t) => {
    if (!t || typeof t !== 'string') return null;
    const parts = t.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
};

/**
 * Overí, či časový reťazec obsahuje kompletný čas – teda hodiny AJ minúty.
 * Prijme formát "HH:MM" alebo "HH:MM:SS" (sekundy ignorujeme).
 * Vráti true iba ak sú hodiny aj minúty vyplnené a sú to čísla.
 */
const isCompleteTime = (t) => {
    if (!t || typeof t !== 'string') return false;
    const parts = t.split(':');
    if (parts.length < 2) return false;
    const h = parts[0];
    const m = parts[1];
    if (h === '' || m === '') return false;
    const hNum = parseInt(h, 10);
    const mNum = parseInt(m, 10);
    if (isNaN(hNum) || isNaN(mNum)) return false;
    if (hNum < 0 || hNum > 23) return false;
    if (mNum < 0 || mNum > 59) return false;
    return true;
};

/**
 * Vypočíta všetky validačné chyby pre aktuálny stav.
 * Vracia pole reťazcov (prázdne = žiadne chyby).
 */
const computeValidationErrors = (tournamentDays, cateringTimes, unitMinutesRaw) => {
    const errors = [];

    const unit = parseInt(unitMinutesRaw, 10);
    const hasValidUnit = !isNaN(unit) && unit > 0;

    if (unitMinutesRaw !== '' && !hasValidUnit) {
        errors.push('Trvanie stravovacej jednotky musí byť kladné číslo v minútach.');
    }

    for (const day of tournamentDays) {
        const t = cateringTimes[day.key];
        if (!t) continue;

        const dayLabel = day.fullLabelNumeric || day.fullLabel;

        const meals = [
            { key: 'lunch',  label: 'Obed'  },
            { key: 'dinner', label: 'Večera' },
        ];

        for (const meal of meals) {
            const from = t[meal.key]?.from || '';
            const to   = t[meal.key]?.to   || '';

            const fromFilled = from !== '';
            const toFilled   = to   !== '';

            if (fromFilled && !isCompleteTime(from)) {
                errors.push(
                    `Deň ${dayLabel}: ${meal.label} – čas od nemá zadané hodiny aj minúty.`
                );
            }
            if (toFilled && !isCompleteTime(to)) {
                errors.push(
                    `Deň ${dayLabel}: ${meal.label} – čas do nemá zadané hodiny aj minúty.`
                );
            }
        }

        if (
            isCompleteTime(t.lunch?.from) &&
            isCompleteTime(t.lunch?.to) &&
            t.lunch.from >= t.lunch.to
        ) {
            errors.push(`Deň ${dayLabel}: čas Obeda od musí byť pred časom do.`);
        }
        if (
            isCompleteTime(t.dinner?.from) &&
            isCompleteTime(t.dinner?.to) &&
            t.dinner.from >= t.dinner.to
        ) {
            errors.push(`Deň ${dayLabel}: čas Večere od musí byť pred časom do.`);
        }

        if (hasValidUnit) {
            for (const meal of meals) {
                const from = t[meal.key]?.from;
                const to   = t[meal.key]?.to;

                if (!isCompleteTime(from) || !isCompleteTime(to)) continue;

                const fromMin = timeToMinutes(from);
                const toMin   = timeToMinutes(to);
                if (fromMin == null || toMin == null) continue;

                const total = toMin - fromMin;
                if (total <= 0) {
                    errors.push(`Deň ${dayLabel}: ${meal.label} – neplatný časový rozsah.`);
                    continue;
                }
                if (total % unit !== 0) {
                    errors.push(
                        `Deň ${dayLabel}: ${meal.label} (${from} – ${to}) nie je možné presne rozdeliť na ${unit} minútové jednotky (celkovo ${total} min).`
                    );
                }
            }
        }
    }

    return errors;
};

export function CateringSettings({ db, userProfileData, showNotification, sendAdminNotification }) {
    const [tournamentDays, setTournamentDays] = React.useState([]);
    const [cateringTimes, setCateringTimes] = React.useState({});
    const [originalCateringTimes, setOriginalCateringTimes] = React.useState({});
    const [unitMinutes, setUnitMinutes] = React.useState('');
    const [originalUnitMinutes, setOriginalUnitMinutes] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

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
                showNotification?.(`Chyba pri načítaní dátumov turnaja: ${error.message}`, 'error');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [db, showNotification]);

    React.useEffect(() => {
        if (!db) return;

        const cateringDocRef = doc(db, 'settings', 'catering');

        const unsubscribe = onSnapshot(
            cateringDocRef,
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data() || {};
                    const loaded = data.times || {};
                    const loadedUnit = data.unitMinutes != null ? String(data.unitMinutes) : '';
                    setCateringTimes(loaded);
                    setOriginalCateringTimes(loaded);
                    setUnitMinutes(loadedUnit);
                    setOriginalUnitMinutes(loadedUnit);
                } else {
                    setCateringTimes({});
                    setOriginalCateringTimes({});
                    setUnitMinutes('');
                    setOriginalUnitMinutes('');
                }
            },
            (error) => {
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

    const buildCateringChanges = (original, updated, days, origUnit, newUnit) => {
        const changes = [];
        const mealLabel = (m) => (m === 'lunch' ? 'Obed' : 'Večera');

        if (String(origUnit || '') !== String(newUnit || '')) {
            const o = origUnit ? `${origUnit} min` : '(nezadané)';
            const n = newUnit ? `${newUnit} min` : '(nezadané)';
            changes.push(`Trvanie stravovacej jednotky: z '${o}' na '${n}'`);
        }

        days.forEach((day) => {
            const orig = original?.[day.key] || {};
            const upd  = updated?.[day.key]  || {};

            const dayLabel = day.fullLabelNumeric || day.fullLabel;

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
                        `Deň ${dayLabel}: pridané '''${mealLabel(mealType)} ${nFrom || '?'} – ${nTo || '?'}'`
                    );
                    return;
                }

                if (!oEmpty && nEmpty) {
                    changes.push(
                        `Deň ${dayLabel}: zmazané '''${mealLabel(mealType)} (bolo ${oFrom || '?'} – ${oTo || '?'})'`
                    );
                    return;
                }

                if (oFrom !== nFrom || oTo !== nTo) {
                    const fromChanged = oFrom !== nFrom ? `od z '${oFrom || '-'}' na '${nFrom || '-'}'` : '';
                    const toChanged   = oTo   !== nTo   ? `do z '${oTo || '-'}' na '${nTo || '-'}'` : '';
                    const parts = [fromChanged, toChanged].filter(Boolean).join(', ');
                    changes.push(
                        `Deň ${dayLabel}: ${mealLabel(mealType)} – zmena ${parts}`
                    );
                }
            });
        });

        return changes;
    };

    const validationErrors = computeValidationErrors(tournamentDays, cateringTimes, unitMinutes);
    const hasErrors = validationErrors.length > 0;

    const handleSave = async () => {
        if (!db || !userProfileData || userProfileData.role !== 'admin') {
            showNotification?.('Nemáte oprávnenie na zmenu nastavení stravovania.', 'error');
            return;
        }

        if (hasErrors) {
            return;
        }

        const unit = parseInt(unitMinutes, 10);
        const hasValidUnit = !isNaN(unit) && unit > 0;

        try {
            setSaving(true);

            const originalTimes = originalCateringTimes;
            const originalUnit  = originalUnitMinutes;

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
                unitMinutes: hasValidUnit ? unit : null,
                updatedAt: Timestamp.fromDate(new Date()),
                updatedBy: userProfileData.email || null,
            }, { merge: true });

            setOriginalCateringTimes(normalized);
            setOriginalUnitMinutes(hasValidUnit ? String(unit) : '');

            try {
                const changesList = buildCateringChanges(
                    originalTimes,
                    normalized,
                    tournamentDays,
                    originalUnit,
                    hasValidUnit ? String(unit) : ''
                );

                if (typeof sendAdminNotification === 'function' && changesList.length > 0) {
                    await sendAdminNotification({
                        type: 'updateCateringSettings',
                        data: { changes: changesList },
                    });
                }
            } catch (notifErr) { }

            showNotification?.('Nastavenia stravovania boli uložené.', 'success');
        } catch (e) {
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

    const saveButtonBase = 'font-bold py-2 px-6 rounded-lg transition-colors duration-200 border-2';
    const saveButtonEnabled = `${saveButtonBase} bg-blue-500 hover:bg-blue-700 text-white border-transparent`;
    const saveButtonDisabled = `${saveButtonBase} bg-white text-blue-500 border-blue-500 cursor-not-allowed`;
    const saveButtonSaving = `${saveButtonBase} bg-blue-300 text-white border-transparent cursor-wait`;

    const saveButtonClass = saving
        ? saveButtonSaving
        : (hasErrors ? saveButtonDisabled : saveButtonEnabled);

    return React.createElement(
        'div',
        { className: 'p-6 border border-gray-200 rounded-lg shadow-sm' },
        React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-2' }, 'Nastavenia stravovania'),
        React.createElement('p', { className: 'text-sm text-gray-500 mb-6' },
            'Nastavte časový rozsah (od – do) pre Obed a Večeru pre každý deň turnaja.'
        ),

        React.createElement(
            'div',
            { className: 'mb-6 flex flex-col sm:flex-row sm:items-end gap-3' },
            React.createElement(
                'div',
                { className: 'flex flex-col' },
                React.createElement(
                    'label',
                    { className: 'text-sm font-medium text-gray-700 mb-1' },
                    'Trvanie stravovacej jednotky (minúty):'
                ),
                React.createElement('input', {
                    type: 'number',
                    min: '1',
                    step: '1',
                    value: unitMinutes,
                    onChange: (e) => setUnitMinutes(e.target.value),
                    placeholder: 'napr. 30',
                    className: 'border border-gray-300 rounded px-3 py-2 text-sm w-56 focus:outline-none focus:border-blue-500',
                })
            ),
            React.createElement(
                'p',
                { className: 'text-xs text-gray-500 sm:mb-2' },
                'Celkový čas Obeda a Večere musí byť deliteľný touto jednotkou bez zvyšku.'
            )
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

        hasErrors && React.createElement(
            'div',
            {
                className: 'mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-700 space-y-1',
            },
            React.createElement(
                'p',
                { className: 'font-semibold mb-1' },
                'Pred uložením je potrebné odstrániť nasledujúce chyby:'
            ),
            ...validationErrors.map((err, i) =>
                React.createElement(
                    'p',
                    { key: i, className: 'flex items-start gap-2' },
                    React.createElement('span', { className: 'text-red-500' }, '•'),
                    React.createElement('span', null, err)
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
                    disabled: saving || hasErrors,
                    className: saveButtonClass,
                    title: hasErrors ? 'Nie je možné uložiť, kým existujú chyby.' : '',
                },
                saving ? 'Ukladám...' : 'Uložiť'
            )
        )
    );
}

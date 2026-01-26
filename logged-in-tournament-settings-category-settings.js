// logged-in-tournament-settings-category-settings.js

import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function CategorySettings({ db, userProfileData, showNotification, sendAdminNotification }) {
    const [categories, setCategories] = React.useState([]);
    const [showModal, setShowModal] = React.useState(false);
    const [currentEdit, setCurrentEdit] = React.useState(null);
    const [modalMode, setModalMode] = React.useState('add');

    // Polia v modalu
    const [name, setName] = React.useState('');
    const [maxTeams, setMaxTeams] = React.useState(12);
    const [birthFrom, setBirthFrom] = React.useState('');
    const [birthTo, setBirthTo] = React.useState('');

    const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);
    const [toDelete, setToDelete] = React.useState(null);

    // Načítanie kategórií
    React.useEffect(() => {
        if (!db || !userProfileData || userProfileData.role !== 'admin') return;

        const catRef = doc(db, 'settings', 'categories');

        const unsubscribe = onSnapshot(catRef, snap => {
            if (snap.exists()) {
                const data = snap.data();
                const list = Object.entries(data || {}).map(([id, obj]) => ({
                    id,
                    name: obj.name || '',
                    maxTeams: obj.maxTeams || 12,
                    birthFrom: obj.birthFrom || '',
                    birthTo: obj.birthTo || '',
                })).sort((a, b) => a.name.localeCompare(b.name));

                setCategories(list);
            } else {
                setDoc(catRef, {}).catch(err => {
                    showNotification(`Chyba pri inicializácii dokumentu kategórií: ${err.message}`, 'error');
                });
                setCategories([]);
            }
        }, err => {
            showNotification(`Chyba pri načítaní kategórií: ${err.message}`, 'error');
        });

        return () => unsubscribe();
    }, [db, userProfileData, showNotification]);

    const openAdd = () => {
        setModalMode('add');
        setName('');
        setMaxTeams(12);
        setBirthFrom('');
        setBirthTo('');
        setCurrentEdit(null);
        setShowModal(true);
    };

    const openEdit = (cat) => {
        setModalMode('edit');
        setName(cat.name);
        setMaxTeams(cat.maxTeams || 12);
        setBirthFrom(cat.birthFrom || '');
        setBirthTo(cat.birthTo || '');
        setCurrentEdit(cat);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setName('');
        setMaxTeams(12);
        setBirthFrom('');
        setBirthTo('');
        setCurrentEdit(null);
        setModalMode('add');
    };

    const handleSave = async () => {
        if (!db || userProfileData?.role !== 'admin') {
            showNotification("Nemáte oprávnenie.", 'error');
            return;
        }

        const trimmedName = name.trim();
        if (!trimmedName) {
            showNotification("Názov kategórie nemôže byť prázdny.", 'error');
            return;
        }

        if (maxTeams < 1) {
            showNotification("Maximálny počet tímov musí byť aspoň 1.", 'error');
            return;
        }

        const catRef = doc(db, 'settings', 'categories');

        try {
            if (modalMode === 'add') {
                // kontrola duplicity názvu
                if (categories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
                    showNotification(`Kategória s názvom „${trimmedName}“ už existuje.`, 'error');
                    return;
                }

                const newId = doc(collection(db, 'temp')).id; // náhodné ID

                await setDoc(catRef, {
                    [newId]: {
                        name: trimmedName,
                        maxTeams: Number(maxTeams),
                        birthFrom: birthFrom || '',
                        birthTo: birthTo || ''
                    }
                }, { merge: true });

                showNotification(`Kategória „${trimmedName}“ bola pridaná.`, 'success');
                await sendAdminNotification?.({
                    type: 'createCategory',
                    data: { name: trimmedName, maxTeams, birthFrom, birthTo }
                });
            }
            else if (modalMode === 'edit' && currentEdit) {
                // kontrola duplicity názvu (okrem seba)
                if (trimmedName.toLowerCase() !== currentEdit.name.toLowerCase() &&
                    categories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
                    showNotification(`Kategória s názvom „${trimmedName}“ už existuje.`, 'error');
                    return;
                }

                await setDoc(catRef, {
                    [currentEdit.id]: {
                        name: trimmedName,
                        maxTeams: Number(maxTeams),
                        birthFrom: birthFrom || '',
                        birthTo: birthTo || ''
                    }
                }, { merge: true });

                showNotification(`Kategória „${currentEdit.name}“ bola upravená.`, 'success');
                await sendAdminNotification?.({
                    type: 'editCategory',
                    data: {
                        original: currentEdit.name,
                        newName: trimmedName,
                        maxTeams,
                        birthFrom,
                        birthTo
                    }
                });
            }

            closeModal();
        } catch (err) {
            showNotification(`Chyba pri ukladaní: ${err.message}`, 'error');
        }
    };

    const openDeleteConfirm = (cat) => {
        setToDelete(cat);
        setShowConfirmDelete(true);
    };

    const closeDeleteConfirm = () => {
        setShowConfirmDelete(false);
        setToDelete(null);
    };

    const handleDelete = async () => {
        if (!toDelete) return;

        try {
            const catRef = doc(db, 'settings', 'categories');
            await setDoc(catRef, {
                [toDelete.id]: deleteField()
            }, { merge: true });

            showNotification(`Kategória „${toDelete.name}“ bola odstránená.`, 'success');
            await sendAdminNotification?.({
                type: 'deleteCategory',
                data: { name: toDelete.name }
            });
            closeDeleteConfirm();
        } catch (err) {
            showNotification(`Chyba pri mazaní: ${err.message}`, 'error');
        }
    };

    // ────────────────────────────────────────────────
    // Render
    // ────────────────────────────────────────────────

    return React.createElement(
        React.Fragment,
        null,

        // Hlavný kontajner
        React.createElement(
            'div',
            { className: 'space-y-4 p-6 border border-gray-200 rounded-lg shadow-sm mt-8' },
            React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Nastavenia kategórií'),

            // Zoznam kategórií
            React.createElement(
                'div',
                { className: 'space-y-3' },
                categories.length > 0 ?
                    categories.map(cat => React.createElement(
                        'div',
                        {
                            key: cat.id,
                            className: 'flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-4 rounded-md shadow-sm gap-3'
                        },
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-medium text-gray-800' }, cat.name),
                            React.createElement('div', { className: 'text-sm text-gray-600 mt-1' },
                                `Max tímov: ${cat.maxTeams}`,
                                cat.birthFrom || cat.birthTo ?
                                    `  |  Narodení ${cat.birthFrom ? `od ${cat.birthFrom}` : ''}${cat.birthTo ? ` do ${cat.birthTo}` : ''}` : ''
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex space-x-2 self-end sm:self-center' },
                            React.createElement('button', {
                                onClick: () => openEdit(cat),
                                className: 'bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold py-1 px-3 rounded transition-colors'
                            }, 'Upraviť'),
                            React.createElement('button', {
                                onClick: () => openDeleteConfirm(cat),
                                className: 'bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1 px-3 rounded transition-colors'
                            }, 'Vymazať')
                        )
                    )) :
                    React.createElement('p', { className: 'text-gray-500 text-center py-6' }, 'Zatiaľ nie sú definované žiadne kategórie.')
            ),

            // Tlačidlo Pridať
            React.createElement(
                'div',
                { className: 'flex justify-center mt-6' },
                React.createElement('button', {
                    onClick: openAdd,
                    className: 'bg-green-500 hover:bg-green-600 text-white font-bold p-4 rounded-full shadow-lg transition-colors w-14 h-14 flex items-center justify-center text-2xl'
                }, '+')
            )
        ),

        // ─── Modal ───────────────────────────────────────
        showModal && React.createElement(
            'div', { className: 'modal fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50' },
            React.createElement(
                'div', { className: 'bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl' },
                React.createElement('h3', { className: 'text-xl font-bold mb-5' },
                    modalMode === 'add' ? 'Pridať novú kategóriu' : `Upraviť kategóriu: ${currentEdit?.name}`
                ),

                // Názov
                React.createElement('label', { className: 'block text-gray-700 font-medium mb-1' }, 'Názov kategórie'),
                React.createElement('input', {
                    type: 'text',
                    className: 'border border-gray-300 rounded w-full px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400',
                    value: name,
                    onChange: e => setName(e.target.value),
                    placeholder: 'napr. Kadeti, Starší žiaci, Muži Open...'
                }),

                // Max tímov
                React.createElement('label', { className: 'block text-gray-700 font-medium mb-1' }, 'Maximálny počet tímov'),
                React.createElement('input', {
                    type: 'number',
                    min: 1,
                    className: 'border border-gray-300 rounded w-full px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400',
                    value: maxTeams,
                    onChange: e => setMaxTeams(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1)),
                }),

                // Dátum narodenia od – do (voliteľné)
                React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6' },
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { className: 'block text-gray-700 font-medium mb-1' }, 'Narodení od'),
                        React.createElement('input', {
                            type: 'date',
                            className: 'border border-gray-300 rounded w-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400',
                            value: birthFrom,
                            onChange: e => setBirthFrom(e.target.value)
                        })
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { className: 'block text-gray-700 font-medium mb-1' }, 'Narodení do'),
                        React.createElement('input', {
                            type: 'date',
                            className: 'border border-gray-300 rounded w-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400',
                            value: birthTo,
                            onChange: e => setBirthTo(e.target.value)
                        })
                    )
                ),

                // Tlačidlá
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3 mt-2' },
                    React.createElement('button', {
                        onClick: closeModal,
                        className: 'bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-2.5 rounded font-medium transition-colors'
                    }, 'Zrušiť'),
                    React.createElement('button', {
                        onClick: handleSave,
                        className: 'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded font-medium transition-colors'
                    }, modalMode === 'add' ? 'Pridať' : 'Uložiť')
                )
            )
        ),

        // Potvrdenie mazania
        showConfirmDelete && React.createElement(
            'div', { className: 'modal fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50' },
            React.createElement(
                'div', { className: 'bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl' },
                React.createElement('h3', { className: 'text-xl font-bold mb-4 text-center' }, 'Potvrdiť zmazanie'),
                React.createElement('p', { className: 'text-gray-700 mb-6 text-center' },
                    `Naozaj chcete zmazať kategóriu „${toDelete?.name}“?`
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-center gap-4' },
                    React.createElement('button', {
                        onClick: closeDeleteConfirm,
                        className: 'bg-gray-200 hover:bg-gray-300 px-6 py-2.5 rounded font-medium'
                    }, 'Zrušiť'),
                    React.createElement('button', {
                        onClick: handleDelete,
                        className: 'bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded font-medium'
                    }, 'Zmazať')
                )
            )
        )
    );
}

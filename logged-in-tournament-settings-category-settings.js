// logged-in-tournament-settings-category-settings.js

import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function CategorySettings({ db, userProfileData, showNotification, sendAdminNotification }) {
    const [categories, setCategories] = React.useState([]);
    const [showModal, setShowModal] = React.useState(false);
    const [currentEdit, setCurrentEdit] = React.useState(null);
    const [newCategoryName, setNewCategoryName] = React.useState('');
    const [modalMode, setModalMode] = React.useState('add');
    const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);
    const [toDelete, setToDelete] = React.useState(null);

    React.useEffect(() => {
        if (!db || !userProfileData || userProfileData.role !== 'admin') return;

        const catRef = doc(db, 'settings', 'categories');

        const unsubscribe = onSnapshot(catRef, snap => {
            if (snap.exists()) {
                const data = snap.data();
                setCategories((data.list || []).sort((a,b) => a.localeCompare(b)));
            } else {
                setDoc(catRef, { list: [] })
                    .catch(err => showNotification(`Chyba pri vytváraní dokumentu kategórií: ${err.message}`, 'error'));
                setCategories([]);
            }
        }, err => {
            showNotification(`Chyba pri načítaní kategórií: ${err.message}`, 'error');
        });

        return () => unsubscribe();
    }, [db, userProfileData, showNotification]);

    const openAdd = () => {
        setModalMode('add');
        setNewCategoryName('');
        setCurrentEdit(null);
        setShowModal(true);
    };

    const openEdit = (cat) => {
        setModalMode('edit');
        setNewCategoryName(cat);
        setCurrentEdit(cat);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setNewCategoryName('');
        setCurrentEdit(null);
        setModalMode('add');
    };

    const handleSave = async () => {
        if (!db || userProfileData?.role !== 'admin') {
            showNotification("Nemáte oprávnenie.", 'error');
            return;
        }

        const trimmed = newCategoryName.trim();
        if (!trimmed) {
            showNotification("Názov kategórie nemôže byť prázdny.", 'error');
            return;
        }

        const ref = doc(db, 'settings', 'categories');

        try {
            if (modalMode === 'add') {
                if (categories.includes(trimmed)) {
                    showNotification(`Kategória "${trimmed}" už existuje.`, 'error');
                    return;
                }
                await updateDoc(ref, { list: arrayUnion(trimmed) });
                showNotification(`Kategória "${trimmed}" pridaná.`, 'success');
                await sendAdminNotification?.({ type: 'createCategory', data: { name: trimmed } });
            } else {
                if (trimmed !== currentEdit && categories.includes(trimmed)) {
                    showNotification(`Kategória "${trimmed}" už existuje.`, 'error');
                    return;
                }
                await updateDoc(ref, { list: arrayRemove(currentEdit) });
                await updateDoc(ref, { list: arrayUnion(trimmed) });
                showNotification(`Kategória zmenená na "${trimmed}".`, 'success');
                await sendAdminNotification?.({
                    type: 'editCategory',
                    data: { original: currentEdit, newName: trimmed }
                });
            }
            closeModal();
        } catch (err) {
            showNotification(`Chyba: ${err.message}`, 'error');
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
            const ref = doc(db, 'settings', 'categories');
            await updateDoc(ref, { list: arrayRemove(toDelete) });
            showNotification(`Kategória "${toDelete}" odstránená.`, 'success');
            await sendAdminNotification?.({ type: 'deleteCategory', data: { name: toDelete } });
            closeDeleteConfirm();
        } catch (err) {
            showNotification(`Chyba pri mazaní: ${err.message}`, 'error');
        }
    };

    return React.createElement(
        React.Fragment,
        null,

        // Hlavný panel
        React.createElement(
            'div',
            { className: 'space-y-4 p-6 border border-gray-200 rounded-lg shadow-sm mt-8' },
            React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Nastavenia kategórií'),
            React.createElement(
                'div',
                { className: 'space-y-3' },
                categories.length > 0 ?
                    categories.map(cat => React.createElement(
                        'div',
                        { key: cat, className: 'flex justify-between items-center bg-gray-50 p-3 rounded-md shadow-sm' },
                        React.createElement('span', { className: 'text-gray-800 font-medium' }, cat),
                        React.createElement(
                            'div',
                            { className: 'flex space-x-2' },
                            React.createElement('button', {
                                onClick: () => openEdit(cat),
                                className: 'bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold py-1 px-3 rounded-lg'
                            }, 'Upraviť'),
                            React.createElement('button', {
                                onClick: () => openDeleteConfirm(cat),
                                className: 'bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1 px-3 rounded-lg'
                            }, 'Vymazať')
                        )
                    )) :
                    React.createElement('p', { className: 'text-gray-500 text-center' }, 'Zatiaľ nie sú definované žiadne kategórie.')
            ),
            React.createElement(
                'div',
                { className: 'flex justify-center mt-4' },
                React.createElement('button', {
                    onClick: openAdd,
                    className: 'bg-green-500 hover:bg-green-600 text-white font-bold p-3 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-lg'
                }, '+')
            )
        ),

        // Modal – pridanie / úprava
        showModal && React.createElement(
            'div', { className: 'modal' },
            React.createElement(
                'div', { className: 'modal-content' },
                React.createElement('h3', { className: 'text-xl font-bold mb-4' },
                    modalMode === 'add' ? 'Pridať novú kategóriu' : `Upraviť kategóriu: ${currentEdit}`
                ),
                React.createElement('input', {
                    type: 'text',
                    className: 'shadow border rounded-lg w-full py-2 px-3 text-gray-700 focus:outline-none focus:border-blue-500 mb-4',
                    placeholder: 'Názov kategórie (napr. Kadeti, Juniori, ...)',
                    value: newCategoryName,
                    onChange: e => setNewCategoryName(e.target.value)
                }),
                React.createElement(
                    'div',
                    { className: 'flex justify-end space-x-3' },
                    React.createElement('button', {
                        onClick: closeModal,
                        className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg'
                    }, 'Zrušiť'),
                    React.createElement('button', {
                        onClick: handleSave,
                        className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg'
                    }, modalMode === 'add' ? 'Pridať' : 'Uložiť')
                )
            )
        ),

        // Modal – potvrdenie mazania
        showConfirmDelete && React.createElement(
            'div', { className: 'modal' },
            React.createElement(
                'div', { className: 'modal-content' },
                React.createElement('h3', { className: 'text-xl font-bold mb-4' }, 'Potvrdiť zmazanie'),
                React.createElement('p', { className: 'text-gray-700 mb-6' },
                    `Naozaj chcete zmazať kategóriu "${toDelete}"?`
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end space-x-3' },
                    React.createElement('button', {
                        onClick: closeDeleteConfirm,
                        className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg'
                    }, 'Zrušiť'),
                    React.createElement('button', {
                        onClick: handleDelete,
                        className: 'bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg'
                    }, 'Zmazať')
                )
            )
        )
    );
}

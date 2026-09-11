// logged-in-tournament-settings-url-link-settings.js

import { doc, onSnapshot, setDoc, Timestamp, collection, addDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function UrlLinkSettings({
    db,
    userProfileData,
    showNotification,
    sendAdminNotification,
}) {
    const [links, setLinks] = React.useState([]);
    const [newLink, setNewLink] = React.useState({ label: '', url: '' });
    const [loading, setLoading] = React.useState(true);

    // Načítanie odkazov z Firestore (kolekcia 'settings', dokument 'urlLinks')
    React.useEffect(() => {
        if (!db) return;

        const docRef = doc(collection(db, 'settings'), 'urlLinks');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setLinks(Array.isArray(data.links) ? data.links : []);
            } else {
                setLinks([]);
            }
            setLoading(false);
        }, (error) => {
            showNotification(`Chyba pri načítaní odkazov: ${error.message}`, 'error');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, showNotification]);

    // Uloženie odkazov do Firestore
    const saveLinks = async (updatedLinks) => {
        if (!db) return;
        try {
            const docRef = doc(collection(db, 'settings'), 'urlLinks');
            await setDoc(docRef, {
                links: updatedLinks,
                updatedAt: Timestamp.fromDate(new Date())
            }, { merge: true });

            showNotification('Odkazy boli úspešne uložené.', 'success');
        } catch (error) {
            showNotification(`Chyba pri ukladaní odkazov: ${error.message}`, 'error');
        }
    };

    // Pridanie nového odkazu
    const handleAddLink = () => {
        if (!newLink.label.trim() || !newLink.url.trim()) {
            showNotification('Názov a URL adresa sú povinné.', 'error');
            return;
        }

        const updatedLinks = [...links, {
            id: Date.now().toString(),
            label: newLink.label.trim(),
            url: newLink.url.trim()
        }];

        setLinks(updatedLinks);
        setNewLink({ label: '', url: '' });
        saveLinks(updatedLinks);

        if (sendAdminNotification) {
            sendAdminNotification({
                type: 'createUrlLink',
                data: {
                    label: newLink.label.trim(),
                    url: newLink.url.trim()
                }
            });
        }
    };

    // Zmazanie odkazu
    const handleDeleteLink = (id) => {
        const linkToDelete = links.find(l => l.id === id);
        const updatedLinks = links.filter(l => l.id !== id);
        setLinks(updatedLinks);
        saveLinks(updatedLinks);

        if (sendAdminNotification && linkToDelete) {
            sendAdminNotification({
                type: 'deleteUrlLink',
                data: {
                    deletedLabel: linkToDelete.label,
                    deletedUrl: linkToDelete.url
                }
            });
        }
    };

    // Úprava odkazu
    const handleEditLink = (id, field, value) => {
        const updatedLinks = links.map(l =>
            l.id === id ? { ...l, [field]: value } : l
        );
        setLinks(updatedLinks);
    };

    // Uloženie zmien po úprave
    const handleSaveEdits = () => {
        saveLinks(links);

        if (sendAdminNotification) {
            sendAdminNotification({
                type: 'editUrlLink',
                data: {
                    originalLabel: '',
                    newLabel: 'Hromadná úprava odkazov',
                    newUrl: ''
                }
            });
        }
    };

    if (loading) {
        return React.createElement('div', { className: 'text-center py-8 text-gray-600' }, 'Načítavam odkazy...');
    }

    return React.createElement(
        'div',
        { className: 'space-y-6' },
        React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Nastavenia odkazov na URL'),

        // Formulár pre pridanie nového odkazu
        React.createElement(
            'div',
            { className: 'bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3' },
            React.createElement('h3', { className: 'text-lg font-semibold text-gray-700' }, 'Pridať nový odkaz'),

            React.createElement(
                'div',
                null,
                React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-1' }, 'Názov odkazu *'),
                React.createElement('input', {
                    type: 'text',
                    value: newLink.label,
                    onChange: (e) => setNewLink({ ...newLink, label: e.target.value }),
                    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500',
                    placeholder: 'napr. Oficiálna stránka turnaja'
                })
            ),

            React.createElement(
                'div',
                null,
                React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-1' }, 'URL adresa *'),
                React.createElement('input', {
                    type: 'url',
                    value: newLink.url,
                    onChange: (e) => setNewLink({ ...newLink, url: e.target.value }),
                    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500',
                    placeholder: 'https://...'
                })
            ),

            React.createElement(
                'button',
                {
                    onClick: handleAddLink,
                    className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg'
                },
                'Pridať odkaz'
            )
        ),

        // Zoznam existujúcich odkazov
        React.createElement(
            'div',
            { className: 'space-y-3' },
            React.createElement('h3', { className: 'text-lg font-semibold text-gray-700' }, `Existujúce odkazy (${links.length})`),

            links.length === 0 ? (
                React.createElement('p', { className: 'text-gray-500 italic' }, 'Zatiaľ nie sú pridané žiadne odkazy.')
            ) : (
                links.map((link) =>
                    React.createElement(
                        'div',
                        {
                            key: link.id,
                            className: 'bg-white p-4 rounded-lg border border-gray-200 space-y-2'
                        },
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-2' },
                            React.createElement('input', {
                                type: 'text',
                                value: link.label,
                                onChange: (e) => handleEditLink(link.id, 'label', e.target.value),
                                className: 'flex-1 px-3 py-2 border rounded-lg font-bold',
                                placeholder: 'Názov'
                            }),
                            React.createElement(
                                'button',
                                {
                                    onClick: () => handleDeleteLink(link.id),
                                    className: 'bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-lg'
                                },
                                'Zmazať'
                            )
                        ),
                        React.createElement('input', {
                            type: 'url',
                            value: link.url,
                            onChange: (e) => handleEditLink(link.id, 'url', e.target.value),
                            className: 'w-full px-3 py-2 border rounded-lg',
                            placeholder: 'https://...'
                        })
                    )
                )
            ),

            links.length > 0 && React.createElement(
                'button',
                {
                    onClick: handleSaveEdits,
                    className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg w-full'
                },
                'Uložiť zmeny'
            )
        )
    );
}

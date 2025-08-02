// Importy pre Firebase funkcie
import { doc, getFirestore, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

/**
 * Modálny komponent pre zmenu fakturačných údajov.
 */
export const ChangeBillingModal = ({ show, onClose, userProfileData, roleColor }) => {
    const db = window.db;

    const [billingAddress, setBillingAddress] = useState(userProfileData.billing_address || '');
    const [billingCity, setBillingCity] = useState(userProfileData.billing_city || '');
    const [billingZip, setBillingZip] = useState(userProfileData.billing_zip || '');
    const [billingCountry, setBillingCountry] = useState(userProfileData.billing_country || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Synchronizácia lokálneho stavu s globálnymi dátami
    useEffect(() => {
        setBillingAddress(userProfileData.billing_address || '');
        setBillingCity(userProfileData.billing_city || '');
        setBillingZip(userProfileData.billing_zip || '');
        setBillingCountry(userProfileData.billing_country || '');
        setError(null);
    }, [userProfileData]);

    const isFormChanged = () => {
        return (
            billingAddress !== userProfileData.billing_address ||
            billingCity !== userProfileData.billing_city ||
            billingZip !== userProfileData.billing_zip ||
            billingCountry !== userProfileData.billing_country
        );
    };

    const handleUpdateBilling = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        const user = window.auth.currentUser;
        if (!user) {
            window.showGlobalNotification('Používateľ nie je prihlásený.', 'error');
            setLoading(false);
            return;
        }

        try {
            const updatedData = {
                billing_address: billingAddress,
                billing_city: billingCity,
                billing_zip: billingZip,
                billing_country: billingCountry
            };
            
            await updateDoc(doc(db, "users", user.uid), updatedData);
            window.showGlobalNotification('Fakturačné údaje boli úspešne aktualizované!', 'success');
            onClose();

        } catch (e) {
            console.error("Chyba pri aktualizácii fakturačných údajov:", e);
            setError('Nepodarilo sa aktualizovať fakturačné údaje. Skúste to prosím neskôr.');
        } finally {
            setLoading(false);
        }
    };

    const ModalHeader = React.createElement('div', {
        className: `flex items-center justify-between p-4 sm:p-6 border-b`,
        style: { borderColor: roleColor, backgroundColor: '#F9FAFB' }
    },
        React.createElement('h3', { className: 'text-2xl font-semibold text-gray-900' }, 'Upraviť fakturačné údaje'),
        React.createElement('button', {
            type: 'button',
            className: `text-gray-400 hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center`,
            onClick: onClose
        },
            React.createElement('svg', { className: 'w-5 h-5', fill: 'currentColor', viewBox: '0 0 20 20' },
                React.createElement('path', { fillRule: 'evenodd', d: 'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z', clipRule: 'evenodd' })
            )
        )
    );

    const ModalContent = React.createElement('div', { className: 'p-4 sm:p-6' },
        error && React.createElement('div', { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
            React.createElement('strong', { className: 'font-bold' }, 'Chyba! '),
            React.createElement('span', { className: 'block sm:inline' }, error)
        ),
        React.createElement('form', { onSubmit: handleUpdateBilling },
            React.createElement('div', { className: 'space-y-4' },
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'billing_address', className: 'block text-sm font-medium text-gray-700' }, 'Adresa'),
                    React.createElement('input', { type: 'text', id: 'billing_address', value: billingAddress, onChange: (e) => setBillingAddress(e.target.value), className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm p-2` })
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'billing_city', className: 'block text-sm font-medium text-gray-700' }, 'Mesto'),
                    React.createElement('input', { type: 'text', id: 'billing_city', value: billingCity, onChange: (e) => setBillingCity(e.target.value), className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm p-2` })
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'billing_zip', className: 'block text-sm font-medium text-gray-700' }, 'PSČ'),
                    React.createElement('input', { type: 'text', id: 'billing_zip', value: billingZip, onChange: (e) => setBillingZip(e.target.value), className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm p-2` })
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'billing_country', className: 'block text-sm font-medium text-gray-700' }, 'Krajina'),
                    React.createElement('input', { type: 'text', id: 'billing_country', value: billingCountry, onChange: (e) => setBillingCountry(e.target.value), className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm p-2` })
                )
            ),
            React.createElement('div', { className: 'mt-6 flex justify-end' },
                React.createElement('button', {
                    type: 'button',
                    className: 'mr-3 inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2',
                    onClick: onClose
                }, 'Zrušiť'),
                React.createElement('button', {
                    type: 'submit',
                    disabled: loading || !isFormChanged(),
                    className: `inline-flex justify-center rounded-md py-2 px-4 text-sm font-medium shadow-sm focus:outline-none`,
                    style: {
                        backgroundColor: (loading || !isFormChanged()) ? '#E5E7EB' : roleColor,
                        color: (loading || !isFormChanged()) ? '#9CA3AF' : 'white',
                        border: 'none',
                        cursor: (loading || !isFormChanged()) ? 'not-allowed' : 'pointer',
                    }
                },
                    loading ? 'Ukladám...' : 'Uložiť zmeny'
                )
            )
        )
    );

    const modal = show ? React.createElement(
        'div', {
            className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[10000]',
            onClick: (e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }
        },
        React.createElement(
            'div', { className: 'bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto overflow-hidden' },
            ModalHeader,
            ModalContent
        )
    ) : null;

    return ReactDOM.createPortal(modal, document.body);
};

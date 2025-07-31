// logged-in-my-data.js
// Tento súbor definuje React komponent, ktorý zobrazuje údaje používateľa.
// Kód sa teraz spolieha na globálne dáta načítané skriptom authentication.js.

const MyDataApp = () => {
  // Lokálny stav pre používateľské dáta
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true); // Loading stav
  const [error, setError] = React.useState('');

  // Effect pre načítanie používateľských dát z globálnej premennej
  // Tento efekt sa spustí vždy, keď sa zmení stav autentifikácie alebo globálne dáta.
  React.useEffect(() => {
    // Čakáme, kým bude globálna autentifikácia pripravená
    if (window.isGlobalAuthReady) {
      // Ak sú globálne dáta profilu k dispozícii, použijeme ich
      if (window.globalUserProfileData) {
        console.log("MyDataApp: Používam globálne načítané dáta používateľa.");
        setUserProfileData(window.globalUserProfileData);
        setLoading(false);
        setError('');
      } else {
        // Ak sú dáta null, ale autentifikácia je hotová, znamená to, že profil neexistuje alebo nastala chyba
        console.log("MyDataApp: Globálne dáta používateľa neboli nájdené.");
        setLoading(false);
        setError('Nepodarilo sa načítať profil používateľa. Skúste sa prosím prihlásiť znova.');
      }
    }
  }, [window.isGlobalAuthReady, window.globalUserProfileData]); // Efekt sa znova spustí, ak sa zmenia tieto premenné

  // Zobrazenie načítania
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Zobrazenie chyby
  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-red-500 text-lg">{error}</p>
      </div>
    );
  }

  // Zobrazenie obsahu stránky
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
        <div className="flex-1 p-8 md:ml-64 mt-8 md:mt-0">
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-blue-500 pb-2">
                    Moje Údaje
                </h2>
                {userProfileData && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="text-xl font-semibold text-blue-800 mb-2">
                                Osobné informácie
                            </h3>
                            <div className="space-y-2">
                                <p className="text-gray-800 text-lg">
                                    <span className="font-bold">ID používateľa:</span> {userProfileData.uid || 'Nezadané'}
                                </p>
                                <p className="text-gray-800 text-lg">
                                    <span className="font-bold">Meno:</span> {userProfileData.firstName || 'Nezadané'}
                                </p>
                                <p className="text-gray-800 text-lg">
                                    <span className="font-bold">Priezvisko:</span> {userProfileData.lastName || 'Nezadané'}
                                </p>
                                <p className="text-gray-800 text-lg">
                                    <span className="font-bold">Email:</span> {userProfileData.email || 'Nezadané'}
                                </p>
                                {userProfileData.phoneNumber && (
                                    <p className="text-gray-800 text-lg">
                                        <span className="font-bold">Telefónne číslo:</span> {userProfileData.phoneNumber}
                                    </p>
                                )}
                            </div>
                        </div>
                        {userProfileData.billing && (
                            <div className="bg-green-50 p-4 rounded-lg">
                                <h3 className="text-xl font-semibold text-green-800 mb-2">
                                    Fakturačné údaje
                                </h3>
                                <div className="space-y-2">
                                    <p className="text-gray-800 text-lg">
                                        <span className="font-bold">Adresa:</span> {userProfileData.billing.address || 'Nezadané'}
                                    </p>
                                    {userProfileData.billing.ico && (
                                        <p className="text-gray-800 text-lg">
                                            <span className="font-bold">IČO:</span> {userProfileData.billing.ico}
                                        </p>
                                    )}
                                    {userProfileData.billing.dic && (
                                        <p className="text-gray-800 text-lg">
                                            <span className="font-bold">DIČ:</span> {userProfileData.billing.dic}
                                        </p>
                                    )}
                                    {userProfileData.billing.icDph && (
                                        <p className="text-gray-800 text-lg">
                                            <span className="font-bold">IČ DPH:</span> {userProfileData.billing.icDph}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;

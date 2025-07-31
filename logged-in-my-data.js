// logged-in-my-data.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-my-data.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.

// Main React component for the logged-in-my-data.html page
function MyDataApp() {
  // Lokálny stav pre používateľské dáta a stav načítania
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true); 

  // Efekt, ktorý čaká na globálne dáta a aktualizuje lokálny stav
  React.useEffect(() => {
    // Sledujeme zmeny v globálnych dátach z authentication.js
    const checkData = setInterval(() => {
      if (window.isGlobalAuthReady && window.globalUserProfileData) {
        setUserProfileData(window.globalUserProfileData);
        setLoading(false);
        clearInterval(checkData); // Zastavíme interval po načítaní dát
        console.log("MyDataApp: Lokálny stav aktualizovaný s globálnymi dátami.");
      }
    }, 100); // Kontrolujeme každých 100ms

    // Funkcia na vyčistenie intervalu, keď sa komponent odpojí
    return () => clearInterval(checkData);
  }, []);

  // Ak sa dáta ešte načítavajú, zobrazíme spinner
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Zobrazíme údaje používateľa
  return (
    <div className="flex flex-col md:flex-row bg-white rounded-lg shadow-lg p-6 md:p-10 max-w-4xl mx-auto my-8 space-y-8 md:space-y-0 md:space-x-8">
      {/* Ľavá časť - profil */}
      <div className="w-full md:w-1/2">
        <h2 className="text-3xl font-bold mb-4 text-blue-800">Moje údaje</h2>
        <div className="space-y-2 text-gray-800">
          <p className="text-lg">
            <span className="font-bold">Meno a priezvisko:</span> {userProfileData.firstName} {userProfileData.lastName}
          </p>
          <p className="text-lg">
            <span className="font-bold">E-mail:</span> {userProfileData.email}
          </p>
          <p className="text-lg">
            <span className="font-bold">Rola:</span> {userProfileData.role}
          </p>
          <p className="text-lg">
            <span className="font-bold">Stav schválenia:</span> {userProfileData.approved ? "Áno" : "Nie"}
          </p>
        </div>
      </div>

      {/* Pravá časť - fakturačné údaje (ak existujú) */}
      {userProfileData.billing && (
        <div className="w-full md:w-1/2">
          <h2 className="text-3xl font-bold mb-4 text-blue-800">Fakturačné údaje</h2>
          <div className="space-y-2 text-gray-800">
            {userProfileData.billing.companyName && (
              <p className="text-lg">
                <span className="font-bold">Názov firmy:</span> {userProfileData.billing.companyName}
              </p>
            )}
            {userProfileData.billing.street && (
              <p className="text-lg">
                <span className="font-bold">Ulica:</span> {userProfileData.billing.street}
              </p>
            )}
            {userProfileData.billing.city && (
              <p className="text-lg">
                <span className="font-bold">Mesto:</span> {userProfileData.billing.city}
              </p>
            )}
            {userProfileData.billing.zip && (
              <p className="text-lg">
                <span className="font-bold">PSČ:</span> {userProfileData.billing.zip}
              </p>
            )}
            {userProfileData.billing.country && (
              <p className="text-lg">
                <span className="font-bold">Krajina:</span> {userProfileData.billing.country}
              </p>
            )}
            {userProfileData.billing.ico && (
              <p className="text-lg">
                <span className="font-bold">IČO:</span> {userProfileData.billing.ico}
              </p>
            )}
            {userProfileData.billing.dic && (
              <p className="text-lg">
                <span className="font-bold">DIČ:</span> {userProfileData.billing.dic}
              </p>
            )}
            {userProfileData.billing.icDph && (
              <p className="text-lg">
                <span className="font-bold">IČ DPH:</span> {userProfileData.billing.icDph}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;

// logged-in-my-data.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný a prihlásenie prebehlo v logged-in-my-data.html.
// Kód definuje React komponent, ktorý zobrazuje údaje používateľa.

// Main React component for the logged-in-my-data.html page
const MyDataApp = () => {
  // Get references to Firebase services and global data from authentication.js
  const auth = window.auth;
  const db = window.db;

  // Local state for user data that is loaded after global authentication
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true); // Loading state for data in MyDataApp
  const [error, setError] = React.useState('');

  // Ensure appId is defined (using a global variable)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 
  
  // Use a state variable for userId to ensure reactivity
  const [userId, setUserId] = React.useState('anonymous');
  
  // Effect for loading user data from Firestore
  // This effect runs only when global authentication is ready.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Wait until global authentication is ready and the user is logged in
    if (window.isGlobalAuthReady && db && auth && auth.currentUser) {
      console.log(`MyDataApp: Global authentication is ready. Attempting to load user document for UID: ${auth.currentUser.uid}`);
      setLoading(true); // Set loading to true while user profile data is being fetched
      setUserId(auth.currentUser.uid); // Set the reactive userId

      try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid);
        
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            console.log("MyDataApp: User document exists, data:", userData);
            setUserProfileData(userData);
            setError('');
          } else {
            console.log("MyDataApp: User document does not exist. Creating it.");
            const defaultUserData = { email: auth.currentUser.email, createdAt: new Date() };
            setDoc(userDocRef, defaultUserData)
              .then(() => {
                console.log("MyDataApp: Created new user document.");
                setUserProfileData(defaultUserData);
                setError('');
              })
              .catch(err => {
                console.error("MyDataApp: Error creating user document:", err);
                setError('Error loading or creating user profile.');
              });
          }
          setLoading(false);
        }, (error) => {
          console.error("MyDataApp: Error loading user document:", error);
          setError('Error loading user profile.');
          setLoading(false);
        });

      } catch (e) {
        console.error("MyDataApp: General error trying to load the document:", e);
        setError('An error occurred while loading data. Please try again later.');
        setLoading(false);
      }
    } else if (window.isGlobalAuthReady && !auth.currentUser) {
        // If auth is ready but the user is not logged in
        setLoading(false);
        setError('You must be logged in to view this page.');
    }

    return () => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, [window.isGlobalAuthReady, db, auth]); // Effect will rerun when these dependencies change

  // Show loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show error if one occurred
  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-red-500 text-lg">{error}</p>
      </div>
    );
  }

  // Show page content
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
                                    <span className="font-bold">ID používateľa:</span> {userId}
                                </p>
                                <p className="text-gray-800 text-lg">
                                    <span className="font-bold">Meno:</span> {userProfileData.name || 'Nezadané'}
                                </p>
                                <p className="text-gray-800 text-lg">
                                    <span className="font-bold">Priezvisko:</span> {userProfileData.surname || 'Nezadané'}
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

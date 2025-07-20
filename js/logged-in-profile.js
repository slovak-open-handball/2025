// js/logged-in-profile.js

function MyDataComponent({ setLoading, setError, setMessage }) {
  const { user, db, userDataEditEndDate, isAuthReady, isRoleLoaded, fetchNotifications } = useAuth();
  const [userData, setUserData] = React.useState({
    fullName: '',
    teamName: '',
    birthDate: '',
    gender: '',
    nationality: '',
    city: '',
    address: '',
    phone: '',
  });
  const [isEditing, setIsEditing] = React.useState(false);
  const [canEdit, setCanEdit] = React.useState(false);
  const [initialUserData, setInitialUserData] = React.useState({});

  React.useEffect(() => {
    if (isAuthReady && user && db && isRoleLoaded) {
      const fetchUserData = async () => {
        setLoading(true);
        try {
          const userDoc = await db.collection('users').doc(user.uid).get();
          if (userDoc.exists) {
            const data = userDoc.data();
            const formattedData = {
              ...data,
              birthDate: data.birthDate ? formatToDatetimeLocal(data.birthDate.toDate()) : '',
            };
            setUserData(formattedData);
            setInitialUserData(formattedData);
          }
        } catch (err) {
          console.error("Chyba pri načítavaní užívateľských dát:", err);
          setError("Chyba pri načítavaní užívateľských dát.");
        } finally {
          setLoading(false);
        }
      };
      fetchUserData();
    }
  }, [user, db, isAuthReady, isRoleLoaded, setLoading, setError]);

  React.useEffect(() => {
    if (userDataEditEndDate) {
      const now = new Date();
      setCanEdit(now <= userDataEditEndDate);
    } else {
      setCanEdit(true); // If no end date, allow editing
    }
  }, [userDataEditEndDate, isEditing]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const dataToUpdate = {
        ...userData,
        birthDate: userData.birthDate ? firebase.firestore.Timestamp.fromDate(new Date(userData.birthDate)) : null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('users').doc(user.uid).update(dataToUpdate);
      setMessage('Profil bol úspešne aktualizovaný!');
      setIsEditing(false);
      setInitialUserData(dataToUpdate); // Update initial data after successful save
    } catch (err) {
      console.error("Chyba pri aktualizácii profilu:", err);
      setError("Chyba pri aktualizácii profilu.");
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    return JSON.stringify(userData) !== JSON.stringify(initialUserData);
  };

  const handleCancelEdit = () => {
    setUserData(initialUserData);
    setIsEditing(false);
    setError('');
    setMessage('');
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold text-blue-700 mb-4">Moje údaje</h2>
      {!canEdit && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
          <p className="font-bold">Dátum na úpravu údajov vypršal.</p>
          <p>Úpravy údajov sú povolené len do {userDataEditEndDate?.toLocaleString()}.</p>
        </div>
      )}

      <form onSubmit={handleUpdateProfile}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="fullName">Meno a Priezvisko</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={userData.fullName || ''}
              onChange={handleInputChange}
              required
              disabled={!isEditing}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="teamName">Názov tímu</label>
            <input
              type="text"
              id="teamName"
              name="teamName"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={userData.teamName || ''}
              onChange={handleInputChange}
              required
              disabled={!isEditing}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="birthDate">Dátum narodenia</label>
            <input
              type="datetime-local"
              id="birthDate"
              name="birthDate"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={userData.birthDate || ''}
              onChange={handleInputChange}
              required
              disabled={!isEditing}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="gender">Pohlavie</label>
            <select
              id="gender"
              name="gender"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={userData.gender || ''}
              onChange={handleInputChange}
              required
              disabled={!isEditing}
            >
              <option value="">Vyberte pohlavie</option>
              <option value="muž">Muž</option>
              <option value="žena">Žena</option>
              <option value="iné">Iné</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="nationality">Národnosť</label>
            <input
              type="text"
              id="nationality"
              name="nationality"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={userData.nationality || ''}
              onChange={handleInputChange}
              required
              disabled={!isEditing}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="city">Mesto</label>
            <input
              type="text"
              id="city"
              name="city"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={userData.city || ''}
              onChange={handleInputChange}
              required
              disabled={!isEditing}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="address">Adresa</label>
            <input
              type="text"
              id="address"
              name="address"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={userData.address || ''}
              onChange={handleInputChange}
              required
              disabled={!isEditing}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone">Telefónne číslo</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={userData.phone || ''}
              onChange={handleInputChange}
              required
              disabled={!isEditing}
            />
          </div>
        </div>
        <div className="flex justify-end space-x-4 mt-6">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              disabled={!canEdit}
            >
              Upraviť
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
              >
                Zrušiť
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                disabled={!hasChanges() || !canEdit}
              >
                Uložiť zmeny
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

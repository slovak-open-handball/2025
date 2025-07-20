function MyDataView({ user, isEditAllowed, userDataEditEndDate, isAdmin }) {
  const editEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h2 className="text-xl font-semibold text-gray-800">Moje údaje</h2>
      <p className="text-gray-700">
        <span className="font-semibold">E-mailová adresa: </span>{user.email || '-'}
      </p>
      <p className="text-gray-700">
        <span className="font-semibold">Meno a priezvisko: </span>{user.displayName || '-'}
      </p>
      {!isAdmin && ( // Telefónne číslo sa zobrazuje len pre bežných používateľov
        <p className="text-gray-700">
          <span className="font-semibold">Telefónne číslo: </span>{user.contactPhoneNumber || '-'}
        </p>
      )}
      {!isEditAllowed && (
          <p className="text-red-500 text-sm mt-2">
              Úpravy vašich údajov sú už uzavreté. Boli uzavreté dňa: {editEnd ? editEnd.toLocaleString('sk-SK') : '-'}
          </p>
      )}
    </div>
  );
}

export default MyDataView;

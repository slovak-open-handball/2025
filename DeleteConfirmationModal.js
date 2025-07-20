function DeleteConfirmationModal({ userToDelete, loading, closeDeleteConfirmationModal, handleDeleteUser }) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
      <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Potvrdiť odstránenie</h3> 
        <p className="text-gray-700 mb-6">Naozaj chcete natrvalo odstrániť používateľa {userToDelete?.email} z databázy? Táto akcia je nezvratná.</p> 
        <div className="flex justify-end space-x-4">
          <button
            onClick={closeDeleteConfirmationModal}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
          >
            Zrušiť
          </button>
          <button
            onClick={handleDeleteUser}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
            disabled={loading}
          >
            {loading ? 'Odstraňujem...' : 'Odstrániť'}
          </button> 
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmationModal;

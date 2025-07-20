// js/index-page.js

function IndexPage() {
  const { user, isAuthReady, isRegistrationOpen, countdown, loading, setLoading, message, error } = useAuth();
  const [teamCount, setTeamCount] = React.useState(0);

  // Volanie updateHeaderLinks po inicializácii Firebase a overení stavu autentifikácie
  React.useEffect(() => {
    if (isAuthReady) {
      // Funkcia updateHeaderLinks je globálne dostupná
      if (typeof updateHeaderLinks === 'function') {
        updateHeaderLinks();
      } else {
        console.warn("Global updateHeaderLinks function not found.");
      }
    }
  }, [isAuthReady, user]); // Závisí od isAuthReady a user na aktualizáciu odkazov

  React.useEffect(() => {
    // Db je k dispozícii z useAuth() po inicializácii Firebase
    if (!db) return;
    const fetchTeamCount = async () => {
      setLoading(true);
      try {
        // MODIFIKOVANÉ: Prístup k tímom cez cestu artifacts
        const querySnapshot = await db.collection('teams').get();
        setTeamCount(querySnapshot.size);
      } catch (err) {
        console.error("Chyba pri načítavaní počtu tímov:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeamCount();
  }, [db, setLoading]); // Depend on db instance and setLoading

  if (!isAuthReady) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center h-screen-minus-header' },
      React.createElement(
        'div',
        { className: 'text-center' },
        React.createElement(
          'p',
          { className: 'text-xl font-semibold text-gray-700' },
          'Načítavam aplikáciu...'
        ),
        React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mt-4' })
      )
    );
  }

  return React.createElement(
    'div',
    { className: 'container mx-auto p-4 pt-8' },
    React.createElement(
      'h1',
      { className: 'text-3xl font-bold text-center text-blue-800 mb-6' },
      'Vitajte na Slovak Open Handball 2025!'
    ),
    loading && React.createElement('p', { className: 'text-center text-gray-600' }, 'Načítavam...'),
    error && React.createElement('div', { className: 'text-red-600 text-center mb-4' }, error),
    message && React.createElement('div', { className: 'text-green-600 text-center mb-4' }, message),
    React.createElement(
      'section',
      { className: 'bg-white p-6 rounded-lg shadow-lg mb-8' },
      React.createElement(
        'h2',
        { className: 'text-2xl font-semibold text-blue-700 mb-4' },
        'O Turnaji'
      ),
      React.createElement(
        'p',
        { className: 'text-gray-700 leading-relaxed mb-4' },
        'Slovak Open Handball 2025 je prestížny medzinárodný hádzanársky turnaj, ktorý sa koná v srdci Slovenska. Tešíme sa na účasť tímov z celej Európy a na skvelú športovú atmosféru.'
      ),
      React.createElement(
        'p',
        { className: 'text-gray-700 leading-relaxed' },
        'Pripravili sme pre vás moderné športoviská, komfortné ubytovanie a bohatý sprievodný program. Veríme, že si z turnaja odnesiete nezabudnuteľné zážitky.'
      )
    ),
    React.createElement(
      'section',
      { className: 'bg-white p-6 rounded-lg shadow-lg mb-8' },
      React.createElement(
        'h2',
        { className: 'text-2xl font-semibold text-blue-700 mb-4' },
        'Registrácia'
      ),
      isRegistrationOpen ?
        React.createElement(
          'p',
          { className: 'text-green-600 font-semibold text-xl text-center mb-4' },
          'Registrácia je otvorená!'
        ) :
        React.createElement(
          'p',
          { className: 'text-red-600 font-semibold text-xl text-center mb-4' },
          'Registrácia je momentálne zatvorená.'
        ),
      countdown &&
        React.createElement(
          'p',
          { className: 'text-blue-500 text-center text-lg mb-4' },
          'Registrácia začína za: ',
          countdown
        ),
      !user &&
        React.createElement(
          'div',
          { className: 'flex justify-center space-x-4' },
          React.createElement(
            'a',
            { href: 'register.html', className: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-300' },
            'Zaregistrovať sa'
          ),
          React.createElement(
            'a',
            { href: 'login.html', className: 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-300' },
            'Prihlásiť sa'
          )
        ),
      user &&
        React.createElement(
          'p',
          { className: 'text-center text-gray-700' },
          'Ste prihlásení. Prejdite do ',
          React.createElement(
            'a',
            { href: 'logged-in.html', className: 'text-blue-600 hover:underline' },
            'Mojej zóny'
          ),
          '.'
        )
    ),
    React.createElement(
      'section',
      { className: 'bg-white p-6 rounded-lg shadow-lg' },
      React.createElement(
        'h2',
        { className: 'text-2xl font-semibold text-blue-700 mb-4' },
        'Účastníci'
      ),
      React.createElement(
        'p',
        { className: 'text-gray-700 text-lg text-center' },
        'Doteraz registrovaných tímov: ',
        React.createElement('span', { className: 'font-bold text-blue-600' }, teamCount)
      )
    )
  );
}

// Render the IndexPage component
document.addEventListener('DOMContentLoaded', () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AuthProvider, null, React.createElement(IndexPage, null)));
});

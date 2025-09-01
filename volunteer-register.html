<!DOCTYPE html>
<html lang="sk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SOH 2025 - Registrácia dobrovoľníka</title>
    <link rel="icon" href="favicon.ico" type="image/x-icon">
    <!-- Načítanie Tailwind CSS pre jednoduché a pekné štýly -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Google Fonts - Inter -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
        }
    </style>
</head>
<body class="bg-gray-100 min-h-screen flex flex-col justify-center items-center p-4">
    <div id="root" class="w-full max-w-2xl bg-white p-8 rounded-lg shadow-xl">
        <!-- Aplikácia sa načíta sem -->
        <div class="text-center text-gray-500">
            <div class="animate-spin inline-block h-8 w-8 border-4 border-t-blue-500 border-gray-200 rounded-full"></div>
            <p class="mt-4">Načítavam aplikáciu...</p>
        </div>
    </div>

    <!-- Externé knižnice - musíme ich načítať pred naším kódom -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>

    <!--
        Poradie skriptov je kľúčové!
        1. Najprv načítajte `authentication.js`, ktorý nastaví globálny stav.
        2. Až potom načítajte `volunteer-register.js`, ktorý na tento stav čaká.
    -->
    <script type="module" src="authentication.js"></script>
    <script type="module" src="volunteer-register.js"></script>

    <script type="module">
        // Tento skript čaká na globálny stav z `authentication.js`, kým nenačíta hlavnú aplikáciu
        const renderApp = () => {
            // Kontrola, či sú React a ReactDOM k dispozícii
            if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
                console.error("Chyba: Knižnice React alebo ReactDOM sa nenačítali. Skontrolujte poradie skriptov.");
                document.getElementById('root').innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Chyba pri načítaní aplikácie. Skúste to prosím neskôr.</div>';
                return;
            }
            // Kontrola, či je hlavný komponent aplikácie definovaný
            if (typeof App === 'undefined') {
                console.error("Chyba: Komponent App nie je definovaný. Skontrolujte súbor volunteer-register.js.");
                document.getElementById('root').innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Chyba pri načítaní komponentu aplikácie.</div>';
                return;
            }
            // Hlavná podmienka: čakáme, kým bude globálna autentifikácia pripravená
            if (!window.isGlobalAuthReady) {
                console.log("Čakám na globálnu autentifikáciu...");
                setTimeout(renderApp, 100); // Opakovať kontrolu po 100ms
                return;
            }

            // Ak sú React komponenty aj globálna autentifikácia pripravené, načíta sa aplikácia
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(React.createElement(App, null));
        };

        // Počiatočné volanie na načítanie aplikácie
        window.addEventListener('load', renderApp);
    </script>
</body>
</html>

<!DOCTYPE html>
<html lang="sk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SOH 2025 - Moja zóna</title>
    <link rel="icon" href="favicon.ico" type="image/x-icon">
    <!-- Použitie Tailwind CSS pre jednoduché a pekné štýly -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Google Fonts - Inter -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <!-- React a ReactDOM -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding-top: 64px; /* Odsadenie pre pevnú hlavičku */
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
    </style>
</head>
<body>
    <div id="header-placeholder"></div>
    <main id="main-content-area" class="flex-grow">
        <div id="root" class="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Obsah aplikácie bude vykreslený tu -->
        </div>
    </main>

    <!-- Načítanie JEDINÉHO modulu aplikácie -->
    <!-- `type="module"` je kľúčové pre správne spracovanie importov -->
    <script type="module" src="authentication.js"></script>
    <script type="module" src="header.js"></script>
    <script type="module" src="logged-in-my-data.js"></script>
</body>
</html>

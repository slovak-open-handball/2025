<!DOCTYPE html>
<html lang="sk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SOH 2025 - Zápasy</title>
    <link rel="icon" href="favicon.ico" type="image/x-icon">
    <!-- GitHub Pages - development only -->
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
        
        /* Štýl pre prepínač režimov */
        .view-mode-switcher {
            position: fixed;
            top: 70px;
            right: 20px;
            z-index: 1000;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 4px;
            display: flex;
            gap: 4px;
        }
        
        .view-mode-btn {
            padding: 8px 16px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
        }
        
        .view-mode-btn.active {
            background-color: #3b82f6;
            color: white;
        }
        
        .view-mode-btn:not(.active) {
            background-color: #f3f4f6;
            color: #4b5563;
        }
        
        .view-mode-btn:not(.active):hover {
            background-color: #e5e7eb;
        }
    </style>
</head>
<body>
    <div id="header-placeholder"></div>
    <!-- Tento placeholder bol pridaný pre vloženie obsahu ľavého menu -->
    <div id="menu-placeholder"></div>
    
    <!-- Prepínač režimov -->
    <div class="view-mode-switcher">
        <button 
            class="view-mode-btn" 
            id="btn-matches-mode"
            onclick="if(window.currentViewMode !== 'matches') { window.switchViewMode('matches'); }"
        >
            <i class="fa-solid fa-calendar-alt mr-1"></i>Zápasy
        </button>
        <button 
            class="view-mode-btn" 
            id="btn-spider-mode"
            onclick="if(window.currentViewMode !== 'spider') { window.switchViewMode('spider'); }"
        >
            <i class="fa-solid fa-sitemap mr-1"></i>Pavúk
        </button>
    </div>
    
    <main id="main-content-area" class="flex-grow flex">
        <!-- Sem sme pridali triedu pre plynulú animáciu -->
        <div class="flex-shrink-0 w-16 transition-all duration-300"></div> <!-- Pomocný div, ktorý vytvára priestor pre zbalené menu -->
        <div id="root" class="flex-grow w-full py-8">
            <!-- Obsah aplikácie bude vykreslený tu -->
            <div class="flex justify-center pt-16">
                <div class="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500"></div>
            </div>
        </div>
    </main>

    <!-- Načítanie základných súborov -->
    <script src="clear-console.js"></script>
    <script src="func-load-groups.js"></script>
    
    <!-- Prepínač režimov -->
    <script src="view-switcher.js"></script>
    
    <!-- Autentifikácia a hlavička -->
    <script type="module" src="authentication.js"></script>
    <script type="module" src="header.js"></script>
    <script type="module" src="logged-in-left-menu.js"></script>
    
    <!-- Dynamické načítanie správneho modulu -->
    <script type="module">
        import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        
        // Počkáme na načítanie autentifikácie a používateľských dát
        const checkUserAndLoad = () => {
            if (window.globalUserProfileData) {
                // Aktivujeme správne tlačidlo
                document.getElementById('btn-matches-mode').classList.toggle('active', window.currentViewMode === 'matches');
                document.getElementById('btn-spider-mode').classList.toggle('active', window.currentViewMode === 'spider');
                
                // Načítame správny modul
                window.loadViewModeScript();
            } else {
                setTimeout(checkUserAndLoad, 100);
            }
        };
        
        // Spustíme kontrolu
        checkUserAndLoad();
        
        // Sledujeme zmeny v autentifikácii
        if (window.auth) {
            onAuthStateChanged(window.auth, (user) => {
                if (user && window.globalUserProfileData) {
                    checkUserAndLoad();
                }
            });
        }
    </script>
</body>
</html>

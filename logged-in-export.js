// logged-in-export.js
import { doc, getDoc, getDocs, onSnapshot, updateDoc, addDoc, collection, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect } = React;

const SUPERSTRUCTURE_TEAMS_DOC_PATH = 'settings/superstructureGroups';

// ============================================================
// PEVNÉ ROZMERY PRE PDF GENEROVANIE
// Tieto hodnoty sa použijú vždy, bez ohľadu na okno používateľa
// ============================================================
const PDF_IFRAME_WIDTH = 1920; 
const PDF_IFRAME_HEIGHT = 1080;
const PDF_ZOOM = 1.75; 
const PDF_DEVICE_PIXEL_RATIO = 2.0;sv

window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        document.body.appendChild(notificationElement);
    }

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success': typeClasses = 'bg-green-500 text-white'; break;
        case 'error':   typeClasses = 'bg-red-500 text-white'; break;
        case 'info':    typeClasses = 'bg-blue-500 text-white'; break;
        default:        typeClasses = 'bg-gray-700 text-white';
    }

    // Zrušíme všetky predchádzajúce časovače, aby stará info správa
    // nezmizla počas zobrazovania novej
    if (window.__globalNotificationHideTimer) {
        clearTimeout(window.__globalNotificationHideTimer);
        window.__globalNotificationHideTimer = null;
    }
    if (window.__globalNotificationShowTimer) {
        clearTimeout(window.__globalNotificationShowTimer);
        window.__globalNotificationShowTimer = null;
    }

    // Ak ide o novú správu (iný text alebo typ), najprv schováme aktuálnu
    const currentText = notificationElement.textContent || '';
    const isSameMessage = currentText === message && notificationElement.dataset.notifType === type;

    if (!isSameMessage) {
        // Rýchle schovanie starej správy
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }

    // Nastavíme nový text a typ
    notificationElement.textContent = message;
    notificationElement.dataset.notifType = type;

    // Zobrazíme správu (s malým oneskorením, aby prebehla animácia)
    window.__globalNotificationShowTimer = setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, isSameMessage ? 10 : 60);

    // Automatické skrytie LEN pre success/error/default.
    // Info správa zostáva, kým ju nenahradí iná správa.
    if (type !== 'info') {
        window.__globalNotificationHideTimer = setTimeout(() => {
            notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
        }, 5000);
    }
};

window.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'PDF_EXPORT_COMPLETED') return;

    const { success, label } = event.data;

    if (success) {
        // Inkrementuj batch counter
        try {
            const isActive = sessionStorage.getItem('pdfBatchActive') === '1';
            if (isActive) {
                let completed = parseInt(sessionStorage.getItem('pdfBatchCompleted') || '0', 10);
                completed++;
                sessionStorage.setItem('pdfBatchCompleted', String(completed));

                const total = parseInt(sessionStorage.getItem('pdfBatchTotal') || '0', 10);

                if (total > 0 && completed >= total) {
                    window.showGlobalNotification(`Generovanie dokončené`, 'success');
                } else {
                    window.showGlobalNotification(`PDF bolo uložené: ${label}`, 'success');
                }
            } else {
                // Jednotlivé PDF (nie batch)
                window.showGlobalNotification(`PDF bolo uložené: ${label}`, 'success');
            }
        } catch (e) {
            window.showGlobalNotification(`PDF bolo uložené: ${label}`, 'success');
        }
    } else {
        window.showGlobalNotification(`Nepodarilo sa vytvoriť PDF pre: ${label}`, 'error');
    }
});

const hideHeaderAndMenuIfHash = () => {
    const hasHash = window.location.hash && window.location.hash.length > 0;

    const headerPlaceholder = document.getElementById('header-placeholder');
    const menuPlaceholder = document.getElementById('menu-placeholder');
    const rootElement = document.getElementById('root');
    const mainContentArea = document.getElementById('main-content-area');
    const spacerDiv = mainContentArea ? mainContentArea.querySelector('.flex-shrink-0.w-16') : null;

    if (hasHash) {
        if (headerPlaceholder) headerPlaceholder.style.display = 'none';
        if (menuPlaceholder) menuPlaceholder.style.display = 'none';
        document.body.style.paddingTop = '0';
        document.body.style.margin = '0';
        document.body.style.overflow = 'auto';

        if (spacerDiv) spacerDiv.style.display = 'none';

        if (mainContentArea) {
            mainContentArea.style.padding = '0';
            mainContentArea.style.margin = '0';
            mainContentArea.style.display = 'block';
        }
        if (rootElement) {
            rootElement.style.padding = '0';
            rootElement.style.margin = '0';
            rootElement.style.maxWidth = 'none';
            rootElement.style.width = '100%';
        }
    } else {
        if (headerPlaceholder) headerPlaceholder.style.display = '';
        if (menuPlaceholder) menuPlaceholder.style.display = '';
        document.body.style.paddingTop = '64px';
        document.body.style.overflow = '';

        if (spacerDiv) spacerDiv.style.display = '';
        if (mainContentArea) {
            mainContentArea.style.padding = '';
            mainContentArea.style.margin = '';
            mainContentArea.style.display = '';
        }
        if (rootElement) {
            rootElement.style.padding = '';
            rootElement.style.margin = '';
            rootElement.style.maxWidth = '';
            rootElement.style.width = '';
            rootElement.style.display = '';
        }
    }
};

hideHeaderAndMenuIfHash();
window.addEventListener('hashchange', hideHeaderAndMenuIfHash);

const spacesToDashes = (str) => (!str ? '' : str.replace(/\s+/g, '-'));
const dashesToSpaces = (str) => (!str ? '' : str.replace(/-/g, ' '));
window.spacesToDashes = spacesToDashes;
window.dashesToSpaces = dashesToSpaces;

const parseExportHash = () => {
    const hash = window.location.hash;
    if (!hash || hash === '#') return null;

    const raw = hash.substring(1);
    const parts = raw.split('/').filter(Boolean);

    if (parts.length === 0) return null;

    if (parts[0] === 'tabulky') {
        if (parts.length < 3) return null;
        const categoryName = dashesToSpaces(decodeURIComponent(parts[1]));
        const groupName = dashesToSpaces(decodeURIComponent(parts[2]));
        return { type: 'tabulky', categoryName, groupName };
    }

    if (parts[0] === 'zapasy') {
        // V URL je názov haly s pomlčkami: #zapasy/<hallName-s-pomlckami>
        if (parts.length >= 2) {
            const hallNameRaw = decodeURIComponent(parts[1]);
            const hallName = dashesToSpaces(hallNameRaw);
            return { type: 'zapasy', hallName };
        }
        return { type: 'zapasy' };
    }

    return null;
};

const normalizeName = (name) => {
    if (!name) return '';
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

const downloadPdfViaHiddenIframe = (hash, categoryName, groupName, silent = false) => {
    const iframe = document.createElement('iframe');

    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '-9999px'; 
    iframe.style.width = PDF_IFRAME_WIDTH + 'px';
    iframe.style.height = PDF_IFRAME_HEIGHT + 'px';
    iframe.style.border = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-1';

    iframe.name = `pdf-iframe-${hash}-${Date.now()}`;
    iframe.src = `logged-in-export.html?download=1&fixedZoom=${PDF_ZOOM}&fixedDpr=${PDF_DEVICE_PIXEL_RATIO}#${hash}`;

    iframe.onload = () => {
        console.log('[iframe] načítaný:', iframe.src);
        setTimeout(() => {
            try {
                document.body.removeChild(iframe);
            } catch (e) { }
        }, 20000);
    };

    document.body.appendChild(iframe);

    // Zobraz modrú notifikáciu LEN ak nie je silent
    if (!silent) {
        const label = groupName
            ? `${categoryName} - ${groupName}`
            : categoryName || 'neznáma kategória';
        window.showGlobalNotification(`Generujem PDF pre: ${label}`, 'info');
    }
};

const downloadMatchesPdfViaHiddenIframe = (hash, hallName, silent = false) => {
    const iframe = document.createElement('iframe');

    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '-9999px';
    iframe.style.width = PDF_IFRAME_WIDTH + 'px';
    iframe.style.height = PDF_IFRAME_HEIGHT + 'px';
    iframe.style.border = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-1';

    iframe.name = `matches-pdf-iframe-${Date.now()}`;
    iframe.src = `logged-in-export.html?download=1&fixedZoom=${PDF_ZOOM}&fixedDpr=${PDF_DEVICE_PIXEL_RATIO}#${hash}`;

    iframe.onload = () => {
        setTimeout(() => {
            try {
                document.body.removeChild(iframe);
            } catch (e) { }
        }, 20000);
    };

    document.body.appendChild(iframe);

    if (!silent) {
        window.showGlobalNotification(`Generujem PDF pre zápasy: ${hallName}`, 'info');
    }
};

const exportTableToPdf = async (categoryName, groupName, fixedDpr = null) => {
    console.log('[exportTableToPdf] ZAVOLANÉ:', { categoryName, groupName, fixedDpr });
    
    const element = document.getElementById('pdf-export-target');
    console.log('[exportTableToPdf] element pdf-export-target:', !!element);
    
    if (!element) {
        window.showGlobalNotification('Tabuľka ešte nie je načítaná.', 'error');
        // PO NOVOM: pošli postMessage aj pri tomto return
        try {
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'PDF_EXPORT_COMPLETED',
                    success: false,
                    label: `${categoryName} - ${groupName}`,
                    error: 'Element pdf-export-target sa nenašiel'
                }, '*');
            }
        } catch (e) { }
        return;
    }

    const html2canvasFn = window.html2canvas;
    const jsPDFClass = window.jspdf?.jsPDF;

    if (typeof html2canvasFn === 'undefined' || !jsPDFClass) {
        window.showGlobalNotification('PDF knižnice nie sú načítané.', 'error');
        // PO NOVOM: pošli postMessage
        try {
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'PDF_EXPORT_COMPLETED',
                    success: false,
                    label: `${categoryName} - ${groupName}`,
                    error: 'PDF knižnice nie sú načítané'
                }, '*');
            }
        } catch (e) { }
        return;
    }

    const safeCategory = (categoryName || 'kategoria').replace(/\s+/g, '-');
    const safeGroup = (groupName || 'skupina').replace(/\s+/g, '-');
    const fileName = `${safeCategory}_${safeGroup}.pdf`;

    const label = groupName
        ? `${categoryName} - ${groupName}`
        : categoryName || 'neznáma kategória';

    window.showGlobalNotification(`Generujem PDF pre: ${label}`, 'info');

    const scaleToUse = (fixedDpr || PDF_DEVICE_PIXEL_RATIO) * (PDF_ZOOM || 1);

    try {
        const rect = element.getBoundingClientRect();

        const cssWidth = rect.width;
        const cssHeight = rect.height;

        const canvas = await html2canvasFn(element, {
            scale: scaleToUse,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: cssWidth,
            height: cssHeight,
            windowWidth: cssWidth,
            windowHeight: cssHeight,
            foreignObjectRendering: false,
            allowTaint: true
        });

        const pxToMm = 0.264583;
        const pdfWidthMm = cssWidth * pxToMm;
        const pdfHeightMm = cssHeight * pxToMm;

        const pdf = new jsPDFClass({
            orientation: pdfWidthMm > pdfHeightMm ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pdfWidthMm, pdfHeightMm]
        });

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, pdfHeightMm);

        pdf.save(fileName);

        // ===== POČÍTADLÁ =====
        try {
            const currentHash = window.location.hash || '';
            let completedCount = parseInt(sessionStorage.getItem('pdfBatchCompleted') || '0', 10);
            completedCount++;
            sessionStorage.setItem('pdfBatchCompleted', String(completedCount));
            sessionStorage.setItem('pdfBatchLastLabel', label);

            const total = parseInt(sessionStorage.getItem('pdfBatchTotal') || '0', 10);
            const isActive = sessionStorage.getItem('pdfBatchActive') === '1';
        } catch (e) { }

        try {
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', newUrl);
        } catch (e) { }

        window.showGlobalNotification(`PDF bolo uložené: ${label}`, 'success');

        try {
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'PDF_EXPORT_COMPLETED',
                    success: true,
                    label: label,
                    fileName: fileName
                }, '*');
            }
        } catch (e) { }
    } catch (err) {
        console.error('[PDF] ❌ Chyba pri PDF exporte:', label, err);
        window.showGlobalNotification(`Nepodarilo sa vytvoriť PDF pre: ${label}`, 'error');
    
        // PO NOVOM: pošli správu do parent okna aj pri chybe
        try {
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'PDF_EXPORT_COMPLETED',
                    success: false,
                    label: label,
                    error: String(err)
                }, '*');
            }
        } catch (e) { }
    }
};

const exportMatchesToPdf = async (hallName, matchesByDay, formatDateHeaderFn, formatTimeFn, fixedDpr = null) => {
    const markBatchCompleted = () => {
        try {
            const isActive = sessionStorage.getItem('pdfBatchActive') === '1';
            if (isActive) {
                let completed = parseInt(sessionStorage.getItem('pdfBatchCompleted') || '0', 10);
                completed++;
                sessionStorage.setItem('pdfBatchCompleted', String(completed));
                sessionStorage.setItem('pdfBatchLastLabel', hallName || '');
            }
        } catch (e) { }
    };

    const element = document.getElementById('matches-pdf-export-target');
    if (!element) {
        window.showGlobalNotification('Zoznam zápasov ešte nie je načítaný.', 'error');
        markBatchCompleted();
        return;
    }

    const html2canvasFn = window.html2canvas;
    const jsPDFClass = window.jspdf?.jsPDF;

    if (typeof html2canvasFn === 'undefined' || !jsPDFClass) {
        window.showGlobalNotification('PDF knižnice nie sú načítané.', 'error');
        markBatchCompleted();
        return;
    }

    const safeHallName = (hallName || 'sportova-hala').replace(/\s+/g, '-');
    const fileName = `Zapasy_${safeHallName}.pdf`;

    window.showGlobalNotification(`Generujem PDF pre zápasy: ${hallName}`, 'info');

    // Pevný scale (priorita: parameter → konštanta → 1.5)
    const scaleToUse = (fixedDpr || PDF_DEVICE_PIXEL_RATIO) * (PDF_ZOOM || 1);

    try {
        const rect = element.getBoundingClientRect();
        const scaleToUse = (fixedDpr || PDF_DEVICE_PIXEL_RATIO) * (PDF_ZOOM || 1);

        const cssWidth = rect.width;
        const cssHeight = rect.height;
        
        const canvas = await html2canvasFn(element, {
            scale: scaleToUse,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: cssWidth,
            height: cssHeight,
            windowWidth: cssWidth,
            windowHeight: cssHeight,
            foreignObjectRendering: false,
            allowTaint: true
        });

        const pxToMm = 0.264583;
        const pdfWidthMm = cssWidth * pxToMm;
        const pdfHeightMm = cssHeight * pxToMm;

        const pdf = new jsPDFClass({
            orientation: pdfWidthMm > pdfHeightMm ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pdfWidthMm, pdfHeightMm]
        });

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, pdfHeightMm);

        pdf.save(fileName);

        try {
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', newUrl);
        } catch (e) { }

        window.showGlobalNotification(`PDF bolo uložené: ${fileName}`, 'success');
        markBatchCompleted();
        try {
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'PDF_EXPORT_COMPLETED',
                    success: true,
                    label: fileName,
                    fileName: fileName
                }, '*');
            }
        } catch (e) { }
    } catch (err) {
        console.error('[PDF zápasy] ❌ Chyba pri PDF exporte:', err);
        window.showGlobalNotification('Nepodarilo sa vytvoriť PDF pre zápasy.', 'error');
        markBatchCompleted();
    }
};

const ExportApp = ({ userProfileData }) => {
    const exportHash = parseExportHash();

    const [showPreview, setShowPreview] = useState(false);

    const [selectedOption, setSelectedOption] = useState('');
    const [categories, setCategories] = useState([]);
    const [groups, setGroups] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedGroupType, setSelectedGroupType] = useState('');
    const [selectedGroupName, setSelectedGroupName] = useState('');
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);

    const [halls, setHalls] = useState([]);
    const [selectedHallId, setSelectedHallId] = useState('');
    const [isLoadingHalls, setIsLoadingHalls] = useState(false);
    const [hallsLoaded, setHallsLoaded] = useState(false);

    // Dáta z Firestore
    const [userTeams, setUserTeams] = useState([]);
    const [superstructureTeams, setSuperstructureTeams] = useState({});
    const [allTeams, setAllTeams] = useState([]);
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [allGroupsByCategoryId, setAllGroupsByCategoryId] = useState({});
    const [categoryCarryOverPoints, setCategoryCarryOverPoints] = useState({});

    // Flagy pre inicializáciu listenerov
    const [categoriesLoaded, setCategoriesLoaded] = useState(false);
    const [groupsLoaded, setGroupsLoaded] = useState(false);
    const [usersLoaded, setUsersLoaded] = useState(false);
    const [superstructureLoaded, setSuperstructureLoaded] = useState(false);    

    // ============================================================
    // Sledovanie dokončenia hromadného generovania PDF
    // ============================================================
    useEffect(() => {
        const checkBatchCompletion = () => {
            try {
                const isActive = sessionStorage.getItem('pdfBatchActive') === '1';
                
                // Logy vždy, keď je batch aktívny
                const total = parseInt(sessionStorage.getItem('pdfBatchTotal') || '0', 10);
                const completed = parseInt(sessionStorage.getItem('pdfBatchCompleted') || '0', 10);
                const lastLabel = sessionStorage.getItem('pdfBatchLastLabel') || '-';

    
                if (!isActive) return;
    
                if (total > 0 && completed >= total) {    
                    window.showGlobalNotification(
                        `Generovanie dokončené`,
                        'success'
                    );
    
                    // Reset až po krátkej pauze, aby polling nezachytil medzistav
                    setTimeout(() => {
                        try {
                            sessionStorage.removeItem('pdfBatchTotal');
                            sessionStorage.removeItem('pdfBatchCompleted');
                            sessionStorage.removeItem('pdfBatchActive');
                            sessionStorage.removeItem('pdfBatchLastLabel');
                        } catch (e) { }
                    }, 2000);
                }
            } catch (e) { }
        };
    
        // Sledujeme každých 500 ms
        const interval = setInterval(checkBatchCompletion, 500);
    
        return () => clearInterval(interval);
    }, []);
    
    // ============================================================
    // LISTENERY PRE FIRESTORE
    // ============================================================
    useEffect(() => {
        if (!window.db) return;

        const unsubscribeUsers = onSnapshot(query(collection(window.db, 'users')), (querySnapshot) => {
            let userTeamsList = [];
            querySnapshot.forEach((docSnap) => {
                const userData = docSnap.data();
                if (userData && userData.teams) {
                    Object.entries(userData.teams).forEach(([categoryName, teamArray]) => {
                        if (Array.isArray(teamArray)) {
                            teamArray.forEach((team, teamIndex) => {
                                if (team.teamName) {
                                    const hasGroup = team.groupName && team.groupName.trim() !== '';
                                    userTeamsList.push({
                                        uid: docSnap.id,
                                        category: categoryName,
                                        id: team.id || `${docSnap.id}_${categoryName}_${team.teamName}_${teamIndex}`,
                                        teamName: team.teamName,
                                        groupName: team.groupName || null,
                                        order: hasGroup ? (team.order ?? 0) : null,
                                        isSuperstructureTeam: false,
                                    });
                                }
                            });
                        }
                    });
                }
            });
            setUserTeams(userTeamsList);
            setUsersLoaded(true);
        });

        const unsubscribeSuperstructure = onSnapshot(doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/')), (docSnap) => {
            setSuperstructureTeams(docSnap.exists() ? docSnap.data() : {});
            setSuperstructureLoaded(true);
        });

        const unsubscribeCategories = onSnapshot(doc(window.db, 'settings', 'categories'), (docSnap) => {
            const categoryIdToName = {};
            const carryOverMap = {};
            if (docSnap.exists()) {
                const categoryData = docSnap.data();
                Object.entries(categoryData).forEach(([categoryId, categoryObject]) => {
                    if (categoryObject && categoryObject.name) {
                        categoryIdToName[categoryId] = categoryObject.name;
                        carryOverMap[categoryId] = categoryObject.carryOverPoints === true;
                    }
                });
            }
            setCategoryIdToNameMap(categoryIdToName);
            setCategoryCarryOverPoints(carryOverMap);
            setCategoriesLoaded(true);
        });

        const unsubscribeGroups = onSnapshot(doc(window.db, 'settings', 'groups'), (docSnap) => {
            const groupsByCategoryId = {};
            if (docSnap.exists()) {
                const groupData = docSnap.data();
                Object.entries(groupData).forEach(([categoryId, groupArray]) => {
                    if (Array.isArray(groupArray)) {
                        groupsByCategoryId[categoryId] = groupArray.map(group => ({
                            name: group.name,
                            type: group.type
                        }));
                    }
                });
            }
            setAllGroupsByCategoryId(groupsByCategoryId);
            setGroupsLoaded(true);
        });

        return () => {
            unsubscribeUsers();
            unsubscribeSuperstructure();
            unsubscribeCategories();
            unsubscribeGroups();
        };
    }, []);

    // Spojenie userTeams + superstructureTeams do allTeams
    useEffect(() => {
        const globalTeamsList = Object.entries(superstructureTeams).flatMap(([categoryName, teamArray]) =>
            (teamArray || []).map((team, teamIndex) => ({
                uid: 'global',
                category: categoryName,
                id: team.id || `global_${categoryName}_${team.teamName}_${teamIndex}`,
                teamName: team.teamName,
                groupName: team.groupName || null,
                order: team.groupName ? (team.order ?? 0) : null,
                isSuperstructureTeam: true
            }))
        );
        setAllTeams([...userTeams, ...globalTeamsList]);
    }, [userTeams, superstructureTeams]);

    // ============================================================
    // NAČÍTANIE ZOZNAMU ŠPORTOVÝCH HÁL (kolekcia 'places')
    // ============================================================
    useEffect(() => {
        if (!window.db) return;
        if (selectedOption !== 'zapasy') return;
        if (hallsLoaded) return;
    
        setIsLoadingHalls(true);
    
        const placesRef = collection(window.db, 'places');
        const unsubscribe = onSnapshot(placesRef, (snapshot) => {
            const loadedHalls = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.type !== 'sportova_hala') return;
                loadedHalls.push({
                    id: docSnap.id,
                    name: data.name || 'Športová hala'
                });
            });
            loadedHalls.sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));
            setHalls(loadedHalls);
            setIsLoadingHalls(false);
            setHallsLoaded(true);
        }, (error) => {
            console.error('[Export] Chyba pri načítaní hál:', error);
            setIsLoadingHalls(false);
        });
    
        return () => unsubscribe();
    }, [selectedOption, hallsLoaded]);

    // DataLoading = false, keď sú načítané VŠETKY potrebné kolekcie
    const dataLoading = !(categoriesLoaded && groupsLoaded && usersLoaded && superstructureLoaded);

    // ============================================================
    // NAČÍTANIE PRE SELECTBOXY (len ak nie je hash)
    // ============================================================
    useEffect(() => {
        if (exportHash) return;
        if (selectedOption !== 'tabulky') return;

        const loadedCategories = Object.keys(categoryIdToNameMap).map(id => ({
            id: id,
            name: categoryIdToNameMap[id]
        }));
        loadedCategories.sort((a, b) => a.name.localeCompare(b.name));
        setCategories(loadedCategories);
        setGroups(allGroupsByCategoryId);
        setIsLoadingCategories(false);
    }, [selectedOption, exportHash, categoryIdToNameMap, allGroupsByCategoryId]);

    useEffect(() => {
        if (exportHash) return;
        setSelectedCategoryId('');
        setSelectedGroupType('');
        setSelectedGroupName('');
        setSelectedHallId('');
    }, [selectedOption, exportHash]);

    useEffect(() => {
        if (exportHash) return;
        setSelectedGroupType('');
        setSelectedGroupName('');
    }, [selectedCategoryId, exportHash]);

    useEffect(() => {
        if (exportHash) return;
        setSelectedGroupName('');
    }, [selectedGroupType, exportHash]);

    // ============================================================
    // VYTVORENIE TABUĽKY PRE EXPORT
    // ============================================================
    const [exportedTable, setExportedTable] = useState(null);
    const [errorTable, setErrorTable] = useState(null);

    useEffect(() => {
        if (!exportHash || exportHash.type !== 'tabulky') {
            setExportedTable(null);
            return;
        }

        if (dataLoading) {
            return;
        }

        // 1. Nájdeme kategóriu
        let categoryId = null;
        let categoryName = exportHash.categoryName;
        const targetCategoryNorm = normalizeName(exportHash.categoryName);

        for (const [catId, catName] of Object.entries(categoryIdToNameMap)) {
            if (normalizeName(catName) === targetCategoryNorm) {
                categoryId = catId;
                categoryName = catName;
                break;
            }
        }

        if (!categoryId) {
            setErrorTable(`Kategória ${exportHash.categoryName} sa nenašla.`);
            return;
        }

        // 2. Nájdeme skupinu
        const groupList = allGroupsByCategoryId[categoryId] || [];
        const targetGroupNorm = normalizeName(exportHash.groupName);
        let foundGroup = null;
        for (const g of groupList) {
            if (g && g.name && normalizeName(g.name) === targetGroupNorm) {
                foundGroup = g;
                break;
            }
        }

        if (!foundGroup) {
            setErrorTable(`Skupina ${exportHash.groupName} sa v kategórii ${categoryName} nenašla.`);
            return;
        }

        const groupName = foundGroup.name;
        const groupType = foundGroup.type;
        const carryOverEnabled = categoryCarryOverPoints[categoryId] === true;

        // 3. Vyfiltrujeme tímy pre našu kategóriu a skupinu
        const teamsInGroup = allTeams.filter(t => {
            if (normalizeName(t.category) !== normalizeName(categoryName)) return false;
            if (!t.groupName) return false;
            if (normalizeName(t.groupName) !== normalizeName(groupName)) return false;
            return true;
        });

        teamsInGroup.sort((a, b) => {
            const oa = typeof a.order === 'number' ? a.order : Infinity;
            const ob = typeof b.order === 'number' ? b.order : Infinity;
            return oa - ob;
        });

        // 4. Pripravíme si tímy pre tabuľku
        const teamsForTable = teamsInGroup.map(t => {
            let displayName = t.teamName;
            if (t.isSuperstructureTeam && t.category && displayName.startsWith(t.category + ' ')) {
                displayName = displayName.substring(t.category.length + 1).trim();
            }
            return {
                id: t.id,
                name: displayName,
                fullName: t.teamName,
                order: t.order,
                isSuperstructureTeam: t.isSuperstructureTeam
            };
        });

        setExportedTable({
            categoryName,
            groupName,
            groupType,
            teams: teamsForTable,
            sortedTeams: teamsForTable,
            matrix: {},
            teamNamesFromMatches: {},
            carryOverEnabled
        });
        setErrorTable(null);
    }, [
        exportHash && exportHash.type,
        exportHash && exportHash.categoryName,
        exportHash && exportHash.groupName,
        allTeams,
        categoryIdToNameMap,
        allGroupsByCategoryId,
        categoryCarryOverPoints,
        dataLoading
    ]);

    // Použijeme useRef namiesto sessionStorage – useRef sa resetuje pri každom mounte
    const autoDownloadTriggeredRef = React.useRef(false);
    
    useEffect(() => {
        if (!exportHash || exportHash.type !== 'tabulky') return;
        if (dataLoading) return;
        if (!exportedTable) return;
        if (!exportedTable.teams || exportedTable.teams.length === 0) return;
    
        const urlParams = new URLSearchParams(window.location.search);
        const shouldAutoDownload = urlParams.get('download') === '1';
    
        if (!shouldAutoDownload) return;
    
        const hashKey = `tabulkyPdfAutoDownloaded_${exportHash.categoryName}_${exportHash.groupName}`;
        let alreadyDownloaded = false;
        try {
            alreadyDownloaded = sessionStorage.getItem(hashKey) === '1';
        } catch (e) { }
    
        if (alreadyDownloaded) return;
    
        try {
            sessionStorage.setItem(hashKey, '1');
        } catch (e) { }
    
        const fixedDprFromUrl = parseFloat(urlParams.get('fixedDpr')) || PDF_DEVICE_PIXEL_RATIO;
    
        const timer = setTimeout(() => {
            exportTableToPdf(exportedTable.categoryName, exportedTable.groupName, fixedDprFromUrl);
        }, 1500);
    
        return () => clearTimeout(timer);
    }, [exportHash, dataLoading, exportedTable]);

    // ============================================================
    // Nastavenie titulku karty podľa kategórie a skupiny
    // ============================================================
    useEffect(() => {
        if (exportHash && exportHash.type === 'tabulky' && exportedTable) {
            const { categoryName, groupName } = exportedTable;
            if (categoryName && groupName) {
                document.title = `SOH 2025 | ${categoryName} - ${groupName}`;
            } else if (categoryName) {
                document.title = `SOH 2025 | ${categoryName}`;
            }
        } else if (exportHash && exportHash.type === 'zapasy') {
            document.title = 'SOH 2025 | Zápasy v športovej hale';
        } else {
            document.title = 'SOH 2025 - Export';
        }
    }, [exportHash && exportHash.type, exportHash && exportHash.categoryName, exportHash && exportHash.groupName, exportedTable]);

    const availableGroupTypes = selectedCategoryId
        ? Array.from(new Set((groups[selectedCategoryId] || []).map(g => g.type))).sort((a, b) => {
            if (a === b) return 0;
            return a === 'základná skupina' ? -1 : 1;
        })
        : [];

    const availableGroups = (selectedCategoryId && selectedGroupType)
        ? (groups[selectedCategoryId] || [])
            .filter(g => g.type === selectedGroupType)
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
        : [];

    const formatGroupType = (type) => {
        if (!type) return '';
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    const isGenerateDisabled =
        !selectedOption ||
        (selectedOption === 'tabulky' && (!selectedCategoryId || !selectedGroupType));

    const handleGenerate = () => {
        if (!selectedOption) {
            window.showGlobalNotification('Prosím, vyberte možnosť pred generovaním.', 'error');
            return;
        }
        if (selectedOption === 'tabulky') {
            if (!selectedCategoryId || !selectedGroupType) {
                window.showGlobalNotification('Prosím, vyberte kategóriu a typ skupiny.', 'error');
                return;
            }
    
            try {
                sessionStorage.removeItem('pdfAutoDownloaded');
            } catch (e) { }
    
            const selectedCategory = categories.find(c => c.id === selectedCategoryId);
            const categoryName = selectedCategory ? selectedCategory.name : selectedCategoryId;
            const categoryNameSafe = spacesToDashes(categoryName);
    
            let groupsToProcess = [];
    
            if (selectedGroupName) {
                groupsToProcess = [selectedGroupName];
            } else {
                groupsToProcess = (groups[selectedCategoryId] || [])
                    .filter(g => g.type === selectedGroupType)
                    .map(g => g.name);
            }
    
            if (groupsToProcess.length === 0) {
                window.showGlobalNotification('Nenašli sa žiadne skupiny pre vybraný typ.', 'error');
                return;
            }
    
            if (selectedGroupName) {
                const groupNameSafe = spacesToDashes(selectedGroupName);
                const hash = `tabulky/${categoryNameSafe}/${groupNameSafe}`;
            
                // Vymaž VŠETKY staré flagy pre túto tabuľku
                try {
                    const keysToRemove = [];
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        if (key && key.startsWith('tabulkyPdfAutoDownloaded_')) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(k => sessionStorage.removeItem(k));
                } catch (e) { }
            
                if (showPreview) {
                    window.open(`logged-in-export.html?download=1#${hash}`, '_blank');
                } else {
                    downloadPdfViaHiddenIframe(hash, categoryName, selectedGroupName);
                }
            } else {
                try {
                    sessionStorage.setItem('pdfBatchTotal', String(groupsToProcess.length));
                    sessionStorage.setItem('pdfBatchCompleted', '0');
                    sessionStorage.setItem('pdfBatchActive', '1');
                } catch (e) { }
    
                try {
                    const keysToRemove = [];
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        if (key && (key.startsWith('tabulkyPdfAutoDownloaded_') || key.startsWith('pdfAutoDownloaded'))) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(k => sessionStorage.removeItem(k));
                } catch (e) { }
            
                groupsToProcess.forEach((groupName, index) => {
                    const groupNameSafe = spacesToDashes(groupName);
                    const hash = `tabulky/${categoryNameSafe}/${groupNameSafe}`;

                    setTimeout(() => {
                        downloadPdfViaHiddenIframe(hash, categoryName, groupName, true);
                    }, index * 3000);
                });

                window.showGlobalNotification(
                    `Generujem PDF pre ${groupsToProcess.length} skupín v kategórii ${categoryName} typu ${formatGroupType(selectedGroupType)}. Prosím čakajte`,
                    'info'
                );    
            }
            return;
        }
    
        // ===== ZÁPASY V ŠPORTOVEJ HALE =====
        if (selectedOption === 'zapasy') {
            // Ak nie je vybraná konkrétna hala → hromadné generovanie pre všetky haly
            if (!selectedHallId) {
                if (halls.length === 0) {
                    window.showGlobalNotification('Nie sú načítané žiadne športové haly.', 'error');
                    return;
                }
        
                try {
                    sessionStorage.removeItem('pdfAutoDownloaded');
                } catch (e) { }
        
                try {
                    sessionStorage.setItem('pdfBatchTotal', String(halls.length));
                    sessionStorage.setItem('pdfBatchCompleted', '0');
                    sessionStorage.setItem('pdfBatchActive', '1');
                } catch (e) { }
        
                halls.forEach((hall, index) => {
                    const hallNameSafe = spacesToDashes(hall.name);
                    const hash = `zapasy/${encodeURIComponent(hallNameSafe)}`;
        
                    try {
                        sessionStorage.removeItem(`matchesPdfAutoDownloaded_${hall.name}`);
                        sessionStorage.removeItem(`matchesPdfAutoDownloaded_${hallNameSafe}`);
                        sessionStorage.removeItem('pdfAutoDownloaded');
                    } catch (e) { }
        
                    setTimeout(() => {
                        downloadMatchesPdfViaHiddenIframe(hash, hall.name, true);
                    }, index * 3000);
                });
        
                window.showGlobalNotification(
                    `Generujem PDF pre ${halls.length} športových hál. Prosím čakajte`,
                    'info'
                );
                return;
            }
        
            // Ak je vybraná konkrétna hala → správanie ako doteraz
            const selectedHall = halls.find(h => h.id === selectedHallId);
            const hallName = selectedHall ? selectedHall.name : selectedHallId;

            try {
                sessionStorage.removeItem('pdfAutoDownloaded');
            } catch (e) { }

            const hallNameSafe = spacesToDashes(hallName);
            const hash = `zapasy/${encodeURIComponent(hallNameSafe)}`;

            try {
                sessionStorage.removeItem(`matchesPdfAutoDownloaded_${hallName}`);
                sessionStorage.removeItem(`matchesPdfAutoDownloaded_${hallNameSafe}`);
                sessionStorage.removeItem('pdfAutoDownloaded');
            } catch (e) { }
            
            if (showPreview) {
                window.open(`logged-in-export.html?download=1#${hash}`, '_blank');
            } else {
                downloadMatchesPdfViaHiddenIframe(hash, hallName);
            }
            return;
        }

        window.open(`logged-in-export.html?download=1#${selectedOption}`, '_blank');
    };
    
    const handleExportPdf = () => {
        exportTableToPdf(exportedTable?.categoryName, exportedTable?.groupName, PDF_DEVICE_PIXEL_RATIO);
    };
        
    // Uchovávame si referenciu na aktuálne dáta
    const exportedTableRef = React.useRef(null);
    const dataLoadingRef = React.useRef(true);
        
    // Aktualizujeme ref pri každej zmene
    useEffect(() => {
        exportedTableRef.current = exportedTable;
    }, [exportedTable]);
    
    useEffect(() => {
        dataLoadingRef.current = dataLoading;
    }, [dataLoading]);
    
    if (exportHash && exportHash.type === 'tabulky') {
        return React.createElement(
            'div',
            { className: 'w-full p-0 m-0' },

            dataLoading && React.createElement(
                'div',
                { className: 'flex justify-center items-center py-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
            ),

            !dataLoading && errorTable && React.createElement(
                'div',
                { className: 'bg-red-50 border border-red-200 rounded-lg p-6 text-center m-4' },
                React.createElement('p', { className: 'text-red-700 font-medium' }, errorTable)
            ),

            !dataLoading && !errorTable && exportedTable && (
                (exportedTable.teams && exportedTable.teams.length > 0)
                    ? React.createElement(
                        'div',
                        { 
                            id: 'pdf-export-target', 
                            className: 'pdf-export-wrapper',
                            style: { 
                                display: 'inline-block',
                                width: 'max-content',
                                padding: '10px',
                                backgroundColor: '#ffffff'
                            }
                        },
                        React.createElement(CrossTable, {
                            teams: exportedTable.teams,
                            sortedTeams: exportedTable.sortedTeams,
                            matrix: exportedTable.matrix,
                            categoryName: exportedTable.categoryName,
                            groupName: exportedTable.groupName,
                            groupType: exportedTable.groupType,
                            teamNamesFromMatches: exportedTable.teamNamesFromMatches,
                            carryOverEnabled: exportedTable.carryOverEnabled
                        })
                    )
                    : React.createElement(
                        'div',
                        { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl m-4' },
                        React.createElement('p', { className: 'text-lg' }, 'Pre túto skupinu neexistujú žiadne tímy.')
                    )
            )
        );
    }

    // ============================================================
    // EXPORT ZÁPASOV PRE KONKRÉTNU HALU (bez výsledkov)
    // ============================================================
    if (exportHash && exportHash.type === 'zapasy') {
        const hallName = exportHash.hallName || null;
    
        // Ak chýba názov haly v hashi, zobrazíme chybu
        if (!hallName) {
            return React.createElement(
                'div',
                { className: 'w-full p-0 m-0' },
                React.createElement(
                    'div',
                    { className: 'mb-6 text-center pt-6' },
                    React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Zápasy v športovej hale')
                ),
                React.createElement(
                    'div',
                    { className: 'bg-red-50 border border-red-200 rounded-lg p-6 text-center m-4' },
                    React.createElement('p', { className: 'text-red-700 font-medium' }, 'Chýba názov športovej haly v URL.')
                )
            );
        }
    
        return React.createElement(MatchesExportView, { hallName });
    }

    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-center' },
        React.createElement(
            'div',
            { className: `w-full max-w-2xl bg-white rounded-xl shadow-xl p-8` },
            React.createElement(
                'div',
                { className: `flex flex-col items-center justify-center mb-6 p-4 -mx-8 -mt-8 rounded-t-xl` },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center' }, 'Export')
            ),
            React.createElement(
                'div',
                { className: 'flex flex-col gap-6' },

                React.createElement(
                    'div',
                    { className: 'flex flex-col gap-2' },
                    React.createElement('label', { htmlFor: 'export-option', className: 'text-sm font-medium text-gray-700' }, 'Vyberte typ exportu'),
                    React.createElement(
                        'select',
                        {
                            id: 'export-option',
                            value: selectedOption,
                            onChange: (e) => setSelectedOption(e.target.value),
                            className: 'w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700'
                        },
                        React.createElement('option', { value: '' }, '-- Vyberte možnosť --'),
                        React.createElement('option', { value: 'zapasy' }, 'Zápasy v športovej hale'),
                        React.createElement('option', { value: 'tabulky' }, 'Tabuľky')
                    )
                ),

                selectedOption === 'zapasy' && React.createElement(
                    'div',
                    { className: 'flex flex-col gap-2' },
                    React.createElement('label', { htmlFor: 'hall-option', className: 'text-sm font-medium text-gray-700' }, 'Vyberte športovú halu'),
                    React.createElement(
                        'select',
                        {
                            id: 'hall-option',
                            value: selectedHallId,
                            onChange: (e) => setSelectedHallId(e.target.value),
                            disabled: isLoadingHalls || halls.length === 0,
                            className: `w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700 ${(isLoadingHalls || halls.length === 0) ? 'cursor-not-allowed opacity-60' : ''}`
                        },
                        React.createElement('option', { value: '' },
                            isLoadingHalls ? '-- Načítavam haly... --'
                                : (halls.length === 0 ? '-- Žiadne haly --' : '-- Všetky haly (hromadne) --')
                        ),
                        halls.map(hall => React.createElement('option', { key: hall.id, value: hall.id }, hall.name))
                    )
                ),

                selectedOption === 'tabulky' && React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-2' },
                        React.createElement('label', { htmlFor: 'category-option', className: 'text-sm font-medium text-gray-700' }, 'Vyberte kategóriu'),
                        React.createElement(
                            'select',
                            {
                                id: 'category-option',
                                value: selectedCategoryId,
                                onChange: (e) => setSelectedCategoryId(e.target.value),
                                disabled: isLoadingCategories || categories.length === 0,
                                className: `w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700 ${(isLoadingCategories || categories.length === 0) ? 'cursor-not-allowed opacity-60' : ''}`
                            },
                            React.createElement('option', { value: '' },
                                isLoadingCategories ? '-- Načítavam kategórie... --'
                                    : (categories.length === 0 ? '-- Žiadne kategórie --' : '-- Vyberte kategóriu --')
                            ),
                            categories.map(cat => React.createElement('option', { key: cat.id, value: cat.id }, cat.name))
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-2' },
                        React.createElement('label', { htmlFor: 'group-type-option', className: 'text-sm font-medium text-gray-700' }, 'Vyberte typ skupiny'),
                        React.createElement(
                            'select',
                            {
                                id: 'group-type-option',
                                value: selectedGroupType,
                                onChange: (e) => setSelectedGroupType(e.target.value),
                                disabled: !selectedCategoryId || availableGroupTypes.length === 0,
                                className: `w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700 ${(!selectedCategoryId || availableGroupTypes.length === 0) ? 'cursor-not-allowed opacity-60' : ''}`
                            },
                            React.createElement('option', { value: '' },
                                !selectedCategoryId ? '-- Najprv vyberte kategóriu --'
                                    : (availableGroupTypes.length === 0 ? '-- Žiadne typy skupín --' : '-- Vyberte typ skupiny --')
                            ),
                            availableGroupTypes.map((type, idx) =>
                                React.createElement('option', { key: `${type}-${idx}`, value: type }, formatGroupType(type))
                            )
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-2' },
                        React.createElement('label', { htmlFor: 'group-option', className: 'text-sm font-medium text-gray-700' }, 'Vyberte skupinu'),
                        React.createElement(
                            'select',
                            {
                                id: 'group-option',
                                value: selectedGroupName,
                                onChange: (e) => setSelectedGroupName(e.target.value),
                                disabled: !selectedGroupType || availableGroups.length === 0,
                                className: `w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700 ${(!selectedGroupType || availableGroups.length === 0) ? 'cursor-not-allowed opacity-60' : ''}`
                            },
                            React.createElement('option', { value: '' },
                                !selectedGroupType ? '-- Najprv vyberte typ skupiny --'
                                    : (availableGroups.length === 0 ? '-- Žiadne skupiny --' : '-- Vyberte skupinu --')
                            ),
                            availableGroups.map((group, idx) =>
                                React.createElement('option', { key: `${group.name}-${idx}`, value: group.name }, group.name)
                            )
                        )
                    )
                ),

                selectedOption === 'zapasy' && !selectedHallId && halls.length > 0 && React.createElement(
                    'div',
                    { className: 'p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700' },
                    React.createElement('span', { className: 'font-semibold' }, 'Hromadné generovanie:'),
                    ' ',
                    `Vygenerujú sa PDF pre všetky športové haly (${halls.length}).`
                ),

                selectedOption === 'tabulky' && selectedCategoryId && selectedGroupType && !selectedGroupName && React.createElement(
                    'div',
                    { className: 'p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700' },
                    React.createElement('span', { className: 'font-semibold' }, 'Hromadné generovanie:'),
                    ' ',
                    `Vygenerujú sa PDF pre všetky skupiny typu "${formatGroupType(selectedGroupType)}" v kategórii.`
                ),

                // Náhľad checkbox – zobrazí sa pri vybranej skupine (tabulky)
                // alebo pri vybranej športovej hale (zapasy)
                selectedOption && (
                    (selectedOption === 'tabulky' && selectedGroupName) ||
                    (selectedOption === 'zapasy' && selectedHallId)
                ) && React.createElement(
                    'div',
                    { className: 'flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200' },
                    React.createElement('input', {
                        type: 'checkbox',
                        id: 'show-preview-checkbox',
                        checked: showPreview,
                        onChange: (e) => setShowPreview(e.target.checked),
                        className: 'w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer'
                    }),
                    React.createElement(
                        'label',
                        {
                            htmlFor: 'show-preview-checkbox',
                            className: 'text-sm font-medium text-gray-700 cursor-pointer select-none'
                        },
                        React.createElement('span', { className: 'font-semibold' }, 'Zobraziť náhľad'),
                        React.createElement('span', { className: 'block text-xs text-gray-500 mt-0.5' },
                            showPreview
                                ? (selectedOption === 'zapasy'
                                    ? 'Otvorí sa nová karta so zoznamom zápasov a PDF sa automaticky stiahne.'
                                    : 'Otvorí sa nová karta s tabuľkou a PDF sa automaticky stiahne.')
                                : 'PDF sa stiahne priamo v tejto karte (bez otvorenia novej karty).'
                        )
                    )
                ),

                React.createElement(
                    'div',
                    { className: isGenerateDisabled ? 'cursor-not-allowed' : '' },
                    React.createElement(
                        'button',
                        {
                            onClick: handleGenerate,
                            disabled: isGenerateDisabled,
                            className: `w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md ${!isGenerateDisabled ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' : 'bg-white border-2 border-blue-600 text-blue-600 cursor-not-allowed'}`
                        },
                        'Generovať'
                    )
                )
            )
        )
    );
};

// ============================================================
// KOMPONENT: Export zápasov pre konkrétnu halu (bez výsledkov)
// - prijíma hallName (názov haly z URL)
// - nájde halu podľa názvu, získa jej ID
// - filtruje zápasy podľa tohto ID
// ============================================================
const MatchesExportView = ({ hallName: hallNameFromUrl }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hallName, setHallName] = useState(hallNameFromUrl || '');
    const [hallId, setHallId] = useState(null);
    const [matches, setMatches] = useState([]);
    const [categoriesData, setCategoriesData] = useState({});
    const [groupsData, setGroupsData] = useState({});
    const [categoryDrawColors, setCategoryDrawColors] = useState({});

    const INFO_TAG_STYLE_BASE = {
        fontWeight: '500',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '20px',
        paddingLeft: '8px',
        paddingRight: '8px',
        paddingBottom: '12px',
        boxSizing: 'border-box'
    };

    // ============================================================
    // Čítanie pevných hodnôt z URL (nastavené rodičovským oknom)
    // ============================================================
    const urlParams = new URLSearchParams(window.location.search);
    const fixedZoom = React.useMemo(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return parseFloat(urlParams.get('fixedZoom')) || 1.0;
    }, []);

    const fixedDpr = React.useMemo(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return parseFloat(urlParams.get('fixedDpr')) || 1.5;
    }, []);

    // Načítanie haly podľa názvu z URL
    useEffect(() => {
        if (!window.db || !hallNameFromUrl) return;

        const findHallByName = async () => {
            try {
                const placesRef = collection(window.db, 'places');
                const snapshot = await getDocs(placesRef);

                let foundHall = null;
                const targetNorm = normalizeName(hallNameFromUrl);

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (data.type !== 'sportova_hala') return;
                    if (normalizeName(data.name) === targetNorm) {
                        foundHall = {
                            id: docSnap.id,
                            name: data.name
                        };
                    }
                });

                if (foundHall) {
                    setHallId(foundHall.id);
                    setHallName(foundHall.name);
                } else {
                    setError(`Športová hala "${hallNameFromUrl}" sa nenašla.`);
                    setLoading(false);
                }
            } catch (e) {
                console.error('[Export zápasy] Chyba pri hľadaní haly:', e);
                setError('Nepodarilo sa nájsť športovú halu.');
                setLoading(false);
            }
        };

        findHallByName();
    }, [hallNameFromUrl]);

    // Načítanie kategórií, skupín, farieb
    useEffect(() => {
        if (!window.db) return;

        const unsubCats = onSnapshot(doc(window.db, 'settings', 'categories'), (docSnap) => {
            const categories = {};
            const colors = {};
            if (docSnap.exists()) {
                const data = docSnap.data();
                Object.entries(data).forEach(([catId, catData]) => {
                    if (catData && catData.name) {
                        categories[catId] = catData.name;
                        if (catData.drawColor) colors[catId] = catData.drawColor;
                    }
                });
            }
            setCategoriesData(categories);
            setCategoryDrawColors(colors);
            window.categoriesData = categories;
            window.categoryDrawColors = colors;
        });

        const unsubGroups = onSnapshot(doc(window.db, 'settings', 'groups'), (docSnap) => {
            const groups = docSnap.exists() ? docSnap.data() : {};
            setGroupsData(groups);
            window.groupsData = groups;
        });

        return () => {
            unsubCats();
            unsubGroups();
        };
    }, []);

    // Načítanie zápasov pre konkrétnu halu (až keď poznáme hallId)
    useEffect(() => {
        if (!window.db || !hallId) return;

        setLoading(true);

        const matchesRef = collection(window.db, 'matches');
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const hallMatches = [];
            snapshot.forEach((docSnap) => {
                const match = { id: docSnap.id, ...docSnap.data() };
                if (match.hallId === hallId) {
                    hallMatches.push(match);
                }
            });

            hallMatches.sort((a, b) => {
                if (!a.scheduledTime) return 1;
                if (!b.scheduledTime) return -1;
                try {
                    return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime();
                } catch (e) {
                    return 0;
                }
            });

            setMatches(hallMatches);
            setLoading(false);
        }, (err) => {
            console.error('[Export zápasy] Chyba:', err);
            setError('Nepodarilo sa načítať zápasy.');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [hallId]);

    // Zobrazenie názvu tímu:
    // - pre zápasy v základných skupinách použije teamManager.getTeamNameByDisplayIdSync(...)
    // - pre nadstavbové, playoff a o umiestnenie vráti "" (prázdny reťazec)
    // - pre ostatné zápasy vráti pôvodný názov
    const getDisplayTeamNameForMatch = (match, rawTeamName) => {
        if (!rawTeamName) return '';
    
        // Ak ide o playoff / o umiestnenie → prázdny názov
        if (match.isPlacementMatch || isEliminationMatch(match)) {
            return '';
        }
    
        // Zápas musí byť v skupine
        if (!match.groupName) {
            return rawTeamName;
        }
    
        const categoryGroups = groupsData[match.categoryId] || [];
        const foundGroup = categoryGroups.find(g => g.name === match.groupName);
    
        if (!foundGroup) {
            return rawTeamName;
        }
    
        // Nadstavbová skupina → prázdny názov
        if (foundGroup.type === 'nadstavbová skupina') {
            return '';
        }
    
        // Základná skupina → mapovanie cez teamManager
        if (foundGroup.type === 'základná skupina') {
            if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                try {
                    const mapped = window.teamManager.getTeamNameByDisplayIdSync(rawTeamName);
                    if (mapped && mapped !== rawTeamName) {
                        return mapped;
                    }
                } catch (e) {
                    // ignore
                }
            }
            return rawTeamName;
        }
    
        return rawTeamName;
    };

    // Zobrazenie ID tímu:
    // - pre zápasy v základných skupinách vráti pôvodné ID (bez mapovania) s odstráneným názvom kategórie
    // - pre všetky ostatné zápasy (nadstavbové, playoff, o umiestnenie) pošle ID do teamManager.getTeamNameByDisplayIdSync(...)
    //   a následne z výsledku odstráni názov kategórie
    const getDisplayIdForMatch = (match, rawTeamName) => {
        if (!rawTeamName) return '';

        // Zistíme názov kategórie pre tento zápas
        let categoryName = match.categoryName;
        if (!categoryName && match.categoryId && categoriesData[match.categoryId]) {
            categoryName = categoriesData[match.categoryId];
        }

        // Pomocná funkcia – odstráni názov kategórie zo začiatku reťazca
        const stripCategoryPrefix = (value) => {
            if (!value) return '';
            if (!categoryName) return value;
            const prefix = categoryName + ' ';
            if (value.startsWith(prefix)) {
                return value.substring(prefix.length).trim();
            }
            return value;
        };

        // Zistíme, či ide o zápas v základnej skupine
        const categoryGroups = groupsData[match.categoryId] || [];
        const foundGroup = match.groupName ? categoryGroups.find(g => g.name === match.groupName) : null;

        const isBasicGroupMatch =
            foundGroup &&
            foundGroup.type === 'základná skupina' &&
            !match.isPlacementMatch &&
            !isEliminationMatch(match);

        // Pre základné skupiny vrátime pôvodné ID bez názvu kategórie
        if (isBasicGroupMatch) {
            return stripCategoryPrefix(rawTeamName);
        }

        // Pre všetky ostatné zápasy zavoláme teamManager
        if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
            try {
                const mapped = window.teamManager.getTeamNameByDisplayIdSync(rawTeamName);
                if (mapped && mapped !== rawTeamName) {
                    return stripCategoryPrefix(mapped);
                }
            } catch (e) {
                // ignore
            }
        }

        return stripCategoryPrefix(rawTeamName);
    };

    const getCategoryColor = (categoryId) => {
        if (!categoryId || !categoryDrawColors[categoryId]) return '#3B82F6';
        return categoryDrawColors[categoryId];
    };

    const getLighterColor = (color) => {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const lighterR = Math.min(255, Math.floor(r + (255 - r) * 0.8));
        const lighterG = Math.min(255, Math.floor(g + (255 - g) * 0.8));
        const lighterB = Math.min(255, Math.floor(b + (255 - b) * 0.8));
        return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
    };

    const isEliminationMatch = (match) => {
        if (match.isPlacementMatch) return true;
        if (match.matchType === 'Playoff' || match.matchType === 'Semifinále' ||
            match.matchType === 'Finále' || match.matchType === 'Štvrťfinále' ||
            match.matchType === 'Osemfinále' ||
            (match.matchType && match.matchType.includes('finále')) ||
            (match.matchType && match.matchType.includes('miesto'))) {
            return true;
        }
        return false;
    };

    const getGroupColors = (groupName, categoryId) => {
        const defaultColors = { backgroundColor: '#DCFCE7', textColor: '#166534' };
        if (!groupsData || !categoryId) return defaultColors;
        const categoryGroups = groupsData[categoryId] || [];
        const foundGroup = categoryGroups.find(g => g.name === groupName);
        if (foundGroup) {
            if (foundGroup.type === 'nadstavbová skupina') {
                return { backgroundColor: '#DBEAFE', textColor: '#1E40AF' };
            }
            if (foundGroup.type === 'základná skupina') {
                return { backgroundColor: '#DCFCE7', textColor: '#166534' };
            }
        }
        return defaultColors;
    };

    const formatDateHeader = (date) => {
        const days = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
        const dayName = days[date.getDay()];
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${dayName} ${day}. ${month}. ${year}`;
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '--:--';
        try {
            const date = timestamp.toDate();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        } catch (e) {
            return '--:--';
        }
    };

    const matchesByDay = React.useMemo(() => {
        const groups = {};
        matches.forEach(match => {
            if (!match.scheduledTime) return;
            try {
                const date = match.scheduledTime.toDate();
                const dateKey = date.toDateString();
                if (!groups[dateKey]) {
                    groups[dateKey] = { date, matches: [] };
                }
                groups[dateKey].matches.push(match);
            } catch (e) { }
        });
        return Object.values(groups).sort((a, b) => a.date - b.date);
    }, [matches]);
        
    // Auto-download PDF pri otvorení s ?download=1 (len raz)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const shouldAutoDownload = urlParams.get('download') === '1';

        console.log('[MatchesExportView] auto-download useEffect:', {
            shouldAutoDownload,
            loading,
            matchesByDayLength: matchesByDay.length,
            hallNameFromUrl,
            fixedDpr
        });
    
        if (!shouldAutoDownload) return;
        if (loading) return;
    
        const storageKey = `matchesPdfAutoDownloaded_${hallNameFromUrl || 'unknown'}`;
    
        let alreadyDownloaded = false;
        try {
            alreadyDownloaded = sessionStorage.getItem(storageKey) === '1';
        } catch (e) { }
    
        if (alreadyDownloaded) return;
    
        try {
            sessionStorage.setItem(storageKey, '1');
        } catch (e) { }
    
        // Ak hala nemá žiadne zápasy → iba inkrementujeme batch counter a skončíme
        if (matchesByDay.length === 0) {
            try {
                const isActive = sessionStorage.getItem('pdfBatchActive') === '1';
                if (isActive) {
                    let completed = parseInt(sessionStorage.getItem('pdfBatchCompleted') || '0', 10);
                    completed++;
                    sessionStorage.setItem('pdfBatchCompleted', String(completed));
                }
            } catch (e) { }
            return;
        }
    
        const timer = setTimeout(() => {
            exportMatchesToPdf(hallName || hallNameFromUrl, matchesByDay, formatDateHeader, formatTime, fixedDpr);
        }, 800);
    
        return () => clearTimeout(timer);
    }, [loading, matchesByDay, hallName, hallNameFromUrl, fixedDpr]);

    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center py-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
        );
    }

    if (error) {
        return React.createElement(
            'div',
            { className: 'bg-red-50 border border-red-200 rounded-lg p-6 text-center m-4' },
            React.createElement('p', { className: 'text-red-700 font-medium' }, error)
        );
    }

    return React.createElement(
        'div',
        { className: 'w-full p-0 m-0' },

        // PDF EXPORT TARGET – celý obsah sa použije pri generovaní PDF
        React.createElement(
            'div',
            {
                id: 'matches-pdf-export-target',
                style: {
                    display: 'inline-block',
                    width: '100%',
                    padding: '20px',
                    backgroundColor: '#ffffff'
                }
            },

            // Hlavička
            React.createElement(
                'div',
                { className: 'mb-6 text-center pt-6' },
                React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Zápasy v športovej hale'),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-center gap-2 mt-1' },
                    React.createElement('i', { className: 'fa-solid fa-location-dot text-blue-500 text-sm' }),
                    React.createElement('span', { className: 'text-gray-600' }, hallName || hallNameFromUrl || 'Športová hala')
                )
            ),

            // Tabuľka
            matchesByDay.length === 0 ?
                React.createElement(
                    'div',
                    { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl m-4' },
                    React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-5xl mb-3 opacity-50' }),
                    React.createElement('p', { className: 'text-lg' }, 'Pre túto halu nie sú naplánované žiadne zápasy.')
                ) :
                React.createElement(
                    'div',
                    { className: 'overflow-x-auto border border-gray-200 rounded-lg bg-white m-4' },
                    React.createElement(
                        'table',
                        { className: 'min-w-full divide-y divide-gray-200' },
                        React.createElement(
                            'thead',
                            { className: 'bg-gray-50' },
                            React.createElement(
                                'tr',
                                null,
                                // Čas
                                React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24' }, 'Čas'),
                        
                                // ID domáci
                                React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24' }, 'ID'),
                        
                                // Domáci
                                React.createElement('th', { className: 'px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Názov tímu'),
                        
                                // Skóre (colSpan 3)
                                React.createElement(
                                    'th',
                                    { colSpan: 3, className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider' },
                                    'Skóre'
                                ),
                        
                                // Hostia
                                React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Názov tímu'),
                        
                                // ID hostia
                                React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24' }, 'ID'),
                        
                                // Info
                                React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48' }, 'Info')
                            )
                        ),
                        React.createElement(
                            'tbody',
                            { className: 'divide-y divide-gray-100' },
                            matchesByDay.map((dayGroup, dayIndex) => {
                                const rows = [];

                                rows.push(
                                    React.createElement(
                                        'tr',
                                        { key: `day-${dayIndex}`, className: 'bg-blue-50' },
                                        React.createElement(
                                            'td',
                                            { colSpan: 9, className: 'px-4 py-4 text-left' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-2' },
                                                React.createElement('i', { className: 'fa-regular fa-calendar text-blue-500 text-lg' }),
                                                React.createElement('span', { className: 'font-semibold text-gray-800 text-base' }, formatDateHeader(dayGroup.date))
                                            )
                                        )
                                    )
                                );

                                dayGroup.matches.forEach((match, matchIndex) => {
                                    const homeTeamDisplay = getDisplayTeamNameForMatch(match, match.homeTeamIdentifier);
                                    const awayTeamDisplay = getDisplayTeamNameForMatch(match, match.awayTeamIdentifier);

                                    const categoryColor = getCategoryColor(match.categoryId);
                                    const lighterCategoryColor = getLighterColor(categoryColor);

                                    const infoTags = [];

                                    // Typ zápasu (matchType)
                                    if (match.matchType && !match.isPlacementMatch) {
                                        const isElim = isEliminationMatch(match);
                                        const colors = isElim
                                            ? { backgroundColor: '#F3E8FF', textColor: '#6B21A5' }
                                            : getGroupColors(match.groupName, match.categoryId);
                                        infoTags.push(
                                            React.createElement('span', {
                                                key: 'type',
                                                className: 'text-xs px-2 rounded-full whitespace-nowrap',
                                                style: { ...INFO_TAG_STYLE_BASE, backgroundColor: colors.backgroundColor, color: colors.textColor }
                                            }, match.matchType)
                                        );
                                    }
                                    
                                    // Umiestnenie (placement)
                                    if (match.isPlacementMatch) {
                                        infoTags.push(
                                            React.createElement('span', {
                                                key: 'placement',
                                                className: 'text-xs rounded-full whitespace-nowrap',
                                                style: { ...INFO_TAG_STYLE_BASE, backgroundColor: '#F3E8FF', color: '#6B21A5' }
                                            }, `o ${match.placementRank}. miesto`)
                                        );
                                    }
                                    
                                    // Skupina (groupName)
                                    if (match.groupName && !match.isPlacementMatch) {
                                        const isElim = isEliminationMatch(match);
                                        const groupColors = isElim
                                            ? { backgroundColor: '#F3E8FF', textColor: '#6B21A5' }
                                            : getGroupColors(match.groupName, match.categoryId);
                                        infoTags.push(
                                            React.createElement('span', {
                                                key: 'group',
                                                className: 'text-xs rounded-full whitespace-nowrap',
                                                style: { ...INFO_TAG_STYLE_BASE, backgroundColor: groupColors.backgroundColor, color: groupColors.textColor }
                                            }, match.groupName)
                                        );
                                    }
                                    
                                    // Kategória (categoryDisplayTag)
                                    let categoryDisplayTag = match.categoryName;
                                    if (!categoryDisplayTag && match.categoryId && categoriesData[match.categoryId]) {
                                        categoryDisplayTag = categoriesData[match.categoryId];
                                    }

                                    if (categoryDisplayTag) {
                                        infoTags.push(
                                            React.createElement('span', {
                                                key: 'category',
                                                className: 'text-xs rounded-full whitespace-nowrap',
                                                style: { ...INFO_TAG_STYLE_BASE, backgroundColor: lighterCategoryColor, color: categoryColor }
                                            }, categoryDisplayTag)
                                        );
                                    }

                                    rows.push(
                                        React.createElement(
                                            'tr',
                                            { key: `match-${dayIndex}-${matchIndex}`, className: 'hover:bg-gray-50 transition-colors' },

                                           // Čas
                                           React.createElement(
                                               'td',
                                               { className: 'px-4 py-3 whitespace-nowrap' },
                                               React.createElement(
                                                   'div',
                                                   { className: 'flex items-center gap-1' },
                                                   React.createElement('i', { className: 'fa-regular fa-clock text-gray-400 text-xs' }),
                                                   React.createElement('span', { className: 'font-mono font-medium text-gray-700 text-sm' }, formatTime(match.scheduledTime))
                                               )
                                           ),
                                           
                                           // ID domáci
                                           React.createElement(
                                               'td',
                                               { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                               React.createElement('span', { className: 'font-mono text-xs text-gray-500' },
                                                   getDisplayIdForMatch(match, match.homeTeamIdentifier)
                                               )
                                           ),
                                           
                                           // Domáci
                                           React.createElement(
                                               'td',
                                               { className: 'px-4 py-3 whitespace-nowrap text-right' },
                                               React.createElement('span', { className: 'font-medium text-gray-800 text-sm' }, homeTeamDisplay)
                                           ),
                                           
                                           // Skóre domáci
                                           React.createElement(
                                               'td',
                                               { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                               React.createElement('span', { className: 'font-bold text-gray-800 text-sm' }, '')
                                           ),
                                           
                                           // Dvojbodka
                                           React.createElement(
                                               'td',
                                               { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                               React.createElement('span', { className: 'text-gray-400 font-medium text-sm' }, ':')
                                           ),
                                           
                                           // Skóre hostia
                                           React.createElement(
                                               'td',
                                               { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                               React.createElement('span', { className: 'font-bold text-gray-800 text-sm' }, '')
                                           ),
                                           
                                           // Hostia
                                           React.createElement(
                                               'td',
                                               { className: 'px-4 py-3 whitespace-nowrap text-left' },
                                               React.createElement('span', { className: 'font-medium text-gray-800 text-sm' }, awayTeamDisplay)
                                           ),
                                           
                                           // ID hostia
                                           React.createElement(
                                               'td',
                                               { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                               React.createElement('span', { className: 'font-mono text-xs text-gray-500' },
                                                   getDisplayIdForMatch(match, match.awayTeamIdentifier)
                                               )
                                           ),
                                           
                                           // Info
                                           React.createElement(
                                               'td',
                                               { className: 'px-4 py-3' },
                                               React.createElement('div', { className: 'flex flex-col gap-1' }, infoTags)
                                           )
                                        )
                                    );
                                });

                                return rows;
                            }).flat()
                        )
                    )
                )
        )
    );
};

const CrossTable = ({
    teams,
    sortedTeams,
    matrix,
    categoryName,
    groupName,
    groupType,
    teamNamesFromMatches,
    carryOverEnabled
}) => {
    if (!teams || teams.length === 0) {
        return React.createElement(
            'div',
            { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl' },
            React.createElement('p', { className: 'text-lg' }, 'Pre túto skupinu neexistujú žiadne tímy.')
        );
    }

    const orderedTeams = (sortedTeams && sortedTeams.length > 0)
        ? sortedTeams.map(s => {
            const original = teams.find(t => t.id === s.id);
            return original || { id: s.id, name: s.name };
        })
        : teams;

    const CELL_WIDTH = '200px';
    const CELL_HEIGHT = '200px';
    const MIDDLE_CELL_WIDTH = '20px'; 
    const SIDE_CELL_WIDTH = '90px';

    const cellStyle = {
        width: CELL_WIDTH,
        minWidth: CELL_WIDTH,
        maxWidth: CELL_WIDTH,
        height: CELL_HEIGHT,
        minHeight: CELL_HEIGHT,
        maxHeight: CELL_HEIGHT
    };

    const subCellBaseStyle = {
        width: SIDE_CELL_WIDTH,
        minWidth: SIDE_CELL_WIDTH,
        maxWidth: SIDE_CELL_WIDTH,
        height: CELL_HEIGHT,
        minHeight: CELL_HEIGHT,
        maxHeight: CELL_HEIGHT,
        borderLeft: '1px solid #ffffff',
        borderRight: '1px solid #ffffff'
    };

    const subCellMiddleStyle = {
        width: MIDDLE_CELL_WIDTH,
        minWidth: MIDDLE_CELL_WIDTH,
        maxWidth: MIDDLE_CELL_WIDTH,
        height: CELL_HEIGHT,
        minHeight: CELL_HEIGHT,
        maxHeight: CELL_HEIGHT,
        borderLeft: '1px solid #ffffff',
        borderRight: '1px solid #ffffff'
    };

    const subCellLeftStyle = { ...subCellBaseStyle, borderLeft: '1px solid #000000' };
    const subCellRightStyle = { ...subCellBaseStyle, borderRight: '1px solid #000000' };

    const diagonalCellStyle = {
        width: CELL_WIDTH,
        minWidth: CELL_WIDTH,
        maxWidth: CELL_WIDTH,
        height: CELL_HEIGHT,
        minHeight: CELL_HEIGHT,
        maxHeight: CELL_HEIGHT,
        border: '1px solid #000000',
        position: 'relative',
        padding: 0,
        overflow: 'hidden'
    };

    const FONT_CLASS = 'text-2xl font-bold';
    const baseCell = 'border border-black text-black align-middle text-center';
    const baseThCell = 'border border-black text-black align-middle text-center bg-white';

    // Sivá farba pre podfarbenie
    const TRANSFERRED_BG = '#d1d5db';

    // Hrubšie orámovanie
    const THICK_BORDER = '3px solid #000000';

    const getStats = (teamId) => {
        if (!sortedTeams) return null;
        return sortedTeams.find(t => t.id === teamId) || null;
    };

    const getPosition = (teamId) => {
        if (!sortedTeams) return '';
        const idx = sortedTeams.findIndex(t => t.id === teamId);
        return idx === -1 ? '' : idx + 1;
    };

    const getLastChar = (team) => {
        if (!team || !team.name) return '';
        const trimmed = String(team.name).trim();
        if (trimmed.length === 0) return '';
        return trimmed.charAt(trimmed.length - 1).toUpperCase();
    };

    const shouldHighlightCell = (rowTeam, colTeam) => {
        if (carryOverEnabled !== true) return false;
        if (groupType !== 'nadstavbová skupina') return false;
        if (!rowTeam || !colTeam) return false;
        if (rowTeam.id === colTeam.id) return false;

        const rowChar = getLastChar(rowTeam);
        const colChar = getLastChar(colTeam);

        if (!rowChar || !colChar) return false;
        if (!/[A-ZÁÄČĎÉÍĽĹŇÓÔŘŔŠŤÚŮÝŽ]/.test(rowChar)) return false;
        if (!/[A-ZÁÄČĎÉÍĽĹŇÓÔŘŔŠŤÚŮÝŽ]/.test(colChar)) return false;

        return rowChar === colChar;
    };

    return React.createElement(
        'div',
        { className: 'bg-white p-0 m-0' },
        React.createElement(
            'div',
            { className: 'p-0 m-0' },
            React.createElement(
                'table',
                {
                    className: 'border-collapse',
                    style: { 
                        tableLayout: 'fixed', 
                        margin: 0, 
                        padding: 0, 
                        borderSpacing: 0,
                        border: THICK_BORDER
                    }
                },

                React.createElement(
                    'thead',
                    null,
                    React.createElement(
                        'tr',
                        null,
                        React.createElement(
                            'th',
                            {
                                className: baseThCell + ' px-3 py-2',
                                style: cellStyle,
                                rowSpan: 1
                            },
                            React.createElement(
                                'div',
                                { className: 'flex flex-col items-center justify-center leading-tight' },
                                React.createElement('span', { className: FONT_CLASS + ' text-black' }, categoryName),
                                React.createElement('span', { className: FONT_CLASS + ' text-black mt-1' }, groupName)
                            )
                        ),
                        orderedTeams.map((team, teamIdx) =>
                            React.createElement(
                                'th',
                                {
                                    key: `${team.id}_${teamIdx}`,
                                    colSpan: 3,
                                    className: baseThCell + ' px-3 py-2 ' + FONT_CLASS,
                                    style: cellStyle
                                },
                                team.name
                            )
                        ),
                        React.createElement('th', {
                            colSpan: 3,
                            className: baseThCell + ' px-3 py-2 ' + FONT_CLASS,
                            style: { ...cellStyle, borderLeft: THICK_BORDER }
                        }, 'Skóre'),
                        React.createElement('th', {
                            className: baseThCell + ' px-3 py-2 ' + FONT_CLASS,
                            style: cellStyle
                        }, 'Body'),
                        React.createElement('th', {
                            className: baseThCell + ' px-3 py-2 ' + FONT_CLASS,
                            style: cellStyle
                        }, 'Miesto v\u00A0skupine')
                    )
                ),

                React.createElement(
                    'tbody',
                    null,
                    orderedTeams.map((rowTeam, rowIdx) => {
                        const stats = getStats(rowTeam.id);
                        const position = getPosition(rowTeam.id);

                        const rowCells = [];

                        rowCells.push(
                            React.createElement(
                                'th',
                                {
                                    key: 'row-name-' + rowTeam.id + '-' + rowIdx,
                                    className: baseThCell + ' px-3 py-2 ' + FONT_CLASS + ' text-left',
                                    style: cellStyle
                                },
                                rowTeam.name
                            )
                        );

                        orderedTeams.forEach((colTeam, colIdx) => {
                            const keyBase = `${rowTeam.id}-${colTeam.id}-${rowIdx}-${colIdx}`;

                            if (rowTeam.id === colTeam.id) {
                                rowCells.push(
                                    React.createElement('td', {
                                        key: `${keyBase}-diag`,
                                        colSpan: 3,
                                        className: 'text-center align-middle',
                                        style: diagonalCellStyle
                                    },
                                        React.createElement(
                                            'svg',
                                            {
                                                width: '100%',
                                                height: '100%',
                                                viewBox: '0 0 100 100',
                                                preserveAspectRatio: 'none',
                                                style: { display: 'block', width: '100%', height: '100%' }
                                            },
                                            // Diagonála zľava-hore → vpravo-dole
                                            React.createElement('line', {
                                                x1: 0,
                                                y1: 0,
                                                x2: 100,
                                                y2: 100,
                                                stroke: '#000000',
                                                strokeWidth: 1,
                                                vectorEffect: 'non-scaling-stroke'
                                            }),
                                            // Diagonála zľava-dole → vpravo-hore
                                            React.createElement('line', {
                                                x1: 0,
                                                y1: 100,
                                                x2: 100,
                                                y2: 0,
                                                stroke: '#000000',
                                                strokeWidth: 1,
                                                vectorEffect: 'non-scaling-stroke'
                                            })
                                        )
                                    )
                                );
                                return;
                            }

                            const highlight = shouldHighlightCell(rowTeam, colTeam);

                            const leftStyle = { ...subCellLeftStyle };
                            const middleStyle = { ...subCellMiddleStyle };
                            const rightStyle = { ...subCellRightStyle };

                            if (highlight) {
                                leftStyle.backgroundColor = TRANSFERRED_BG;
                                middleStyle.backgroundColor = TRANSFERRED_BG;
                                rightStyle.backgroundColor = TRANSFERRED_BG;

                                leftStyle.borderRight = `1px solid ${TRANSFERRED_BG}`;
                                middleStyle.borderLeft = `1px solid ${TRANSFERRED_BG}`;
                                middleStyle.borderRight = `1px solid ${TRANSFERRED_BG}`;
                                rightStyle.borderLeft = `1px solid ${TRANSFERRED_BG}`;
                            } else {
                                leftStyle.backgroundColor = '#fff';
                                middleStyle.backgroundColor = '#fff';
                                rightStyle.backgroundColor = '#fff';
                            }

                            rowCells.push(
                                React.createElement('td', {
                                    key: `${keyBase}-s1`,
                                    className: baseCell + ' ' + FONT_CLASS,
                                    style: { ...leftStyle, color: '#000' }
                                }, ''),
                                React.createElement('td', {
                                    key: `${keyBase}-s2`,
                                    className: baseCell + ' ' + FONT_CLASS,
                                    style: { ...middleStyle, color: '#000' }
                                }, ':'),
                                React.createElement('td', {
                                    key: `${keyBase}-s3`,
                                    className: baseCell + ' ' + FONT_CLASS,
                                    style: { ...rightStyle, color: '#000' }
                                }, '')
                            );
                        });

                        const showTotals = stats && stats.played > 0;
                        rowCells.push(
                            React.createElement('td', {
                                key: 'total-scored-' + rowIdx,
                                className: baseCell + ' ' + FONT_CLASS,
                                style: { 
                                    ...subCellLeftStyle, 
                                    textAlign: 'right', 
                                    paddingRight: '10px',
                                    borderLeft: THICK_BORDER
                                }
                            }, showTotals ? stats.goalsFor : ''),
                            React.createElement('td', {
                                key: 'total-colon-' + rowIdx,
                                className: baseCell + ' ' + FONT_CLASS,
                                style: subCellMiddleStyle
                            }, ':'), 
                            React.createElement('td', {
                                key: 'total-conceded-' + rowIdx,
                                className: baseCell + ' ' + FONT_CLASS,
                                style: { ...subCellRightStyle, textAlign: 'left', paddingLeft: '10px' }
                            }, showTotals ? stats.goalsAgainst : '')
                        );

                        rowCells.push(
                            React.createElement('td', {
                                key: 'points-' + rowIdx,
                                className: baseCell + ' ' + FONT_CLASS,
                                style: cellStyle
                            }, stats && stats.played > 0 ? stats.points : '')
                        );

                        rowCells.push(
                            React.createElement('td', {
                                key: 'position-' + rowIdx,
                                className: baseCell + ' ' + FONT_CLASS,
                                style: cellStyle
                            }, stats && stats.played > 0 ? position : '')
                        );

                        return React.createElement(
                            'tr',
                            { key: rowTeam.id + '-' + rowIdx },
                            rowCells
                        );
                    })
                )
            )
        )
    );
};

let isEmailSyncListenerSetup = false;

const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    const hasHashInUrl = window.location.hash && window.location.hash.length > 1;
    const isExportPage = window.location.pathname.endsWith('logged-in-export.html');
    const shouldRenderExportWithoutUser = isExportPage && hasHashInUrl;

    if (userProfileData || shouldRenderExportWithoutUser) {
        if (userProfileData) {
            if (window.auth && window.db && !isEmailSyncListenerSetup) {
                onAuthStateChanged(window.auth, async (user) => {
                    if (user) {
                        try {
                            const userProfileRef = doc(window.db, 'users', user.uid);
                            const docSnap = await getDoc(userProfileRef);
                            if (docSnap.exists()) {
                                const firestoreEmail = docSnap.data().email;
                                if (user.email !== firestoreEmail) {
                                    await updateDoc(userProfileRef, { email: user.email });
                                    const notificationsCollectionRef = collection(window.db, 'notifications');
                                    await addDoc(notificationsCollectionRef, {
                                        userEmail: user.email,
                                        changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                        timestamp: new Date(),
                                    });
                                    window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');
                                }
                            }
                        } catch (error) {
                        }
                    }
                });
                isEmailSyncListenerSetup = true;
            }
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(ExportApp, { userProfileData: userProfileData || null }));
        }
    } else {
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center h-full pt-16' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
                )
            );
        }
    }
};

window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

if (window.globalUserProfileData) {
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            React.createElement(
                'div',
                { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
}

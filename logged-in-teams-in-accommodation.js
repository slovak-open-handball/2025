// Importy pre Firebase funkcie
import { doc, getDoc, getDocs, onSnapshot, updateDoc, addDoc, collection, Timestamp, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect } = React;

window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }
    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success': typeClasses = 'bg-green-500 text-white'; break;
        case 'error':   typeClasses = 'bg-red-500 text-white';   break;
        case 'info':    typeClasses = 'bg-blue-500 text-white';  break;
        default:        typeClasses = 'bg-gray-700 text-white';
    }
    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;
    setTimeout(() => { notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`; }, 10);
    setTimeout(() => { notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`; }, 5000);
};

let isEmailSyncListenerSetup = false;

const listeners = new Set();
const notify = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    listeners.forEach(cb => cb({ id, message, type }));
};
const subscribe = (cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
};

const NotificationPortal = () => {
    const [notification, setNotification] = React.useState(null);
    
    useEffect(() => {
        let timer;
        const unsubscribe = subscribe((notif) => {
            setNotification(notif);
            clearTimeout(timer);
            timer = setTimeout(() => setNotification(null), 5000);
        });
        
        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);
    
    if (!notification) return null;
    
    const typeClasses = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600',
        default: 'bg-gray-700'
    }[notification.type || 'default'];
    
    return ReactDOM.createPortal(
        React.createElement(
            'div',
            {
                key: notification.id,
                className: `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-2xl text-white text-center z-[9999] transition-all duration-400 ease-in-out opacity-100 scale-100 translate-y-0 ${typeClasses}`
            },
            notification.message
        ),
        document.body
    );
};

const createAccommodationNotification = async (action, data) => {
    if (!window.db) return;
    
    const currentUserEmail = window.globalUserProfileData?.email || null;
    
    let message = '';
    const { teamName, accommodationName, category, teamId, userId, totalPeople, oldAccommodation, newAccommodation } = data;
    
    switch (action) {
        case 'assign_accommodation':
            message = `Tím ${teamName} (${category}) bol priradený do ubytovne '''${accommodationName}'`;
            break;
        case 'change_accommodation':
            message = `Tím ${teamName} (${category}) bol presunutý z ubytovne '${oldAccommodation}' do '${newAccommodation}'`;
            break;
        case 'remove_accommodation':
            message = `Tím ${teamName} (${category}) bol odstránený z ubytovne '''${oldAccommodation}'`;
            break;
        case 'update_accommodation_color':
            message = `Bola zmenená farba ubytovne '''${accommodationName}'`;
            break;
        default:
            message = `Zmena v ubytovaní: ${action}`;
    }
    
    try {
        const notificationsRef = collection(window.db, 'notifications');
        await addDoc(notificationsRef, {
            userEmail: currentUserEmail || "",
            performedBy: currentUserEmail || null,
            changes: [message],
            timestamp: serverTimestamp(),
            relatedTeamId: teamId || null,
            relatedUserId: userId || null,
            relatedCategory: category || null,
            relatedAccommodation: accommodationName || null,
            actionType: action,
            teamName: teamName || null,
            accommodationName: accommodationName || null,
            totalPeople: totalPeople || null,
            oldAccommodation: oldAccommodation || null,
            newAccommodation: newAccommodation || null
        });
        console.log("[NOTIFIKÁCIA UBYTOVANIE] Uložená:", message);
    } catch (err) {
        console.error("[NOTIFIKÁCIA UBYTOVANIE] Chyba pri ukladaní:", err);
    }
};

const AddGroupsApp = ({ userProfileData }) => {
    const [accommodations, setAccommodations] = useState([]);
    const [allTeams, setAllTeams] = useState([]);
    const [selectedPlaceForEdit, setSelectedPlaceForEdit] = useState(null);
    const [isColorModalOpen, setIsColorModalOpen] = useState(false);
    const [newHeaderColor, setNewHeaderColor] = useState('#1e40af');
    const [newHeaderTextColor, setNewHeaderTextColor] = useState('#ffffff');
    
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [availableAccommodations, setAvailableAccommodations] = useState([]);
    const [selectedAccommodationId, setSelectedAccommodationId] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedAccommodationFilter, setSelectedAccommodationFilter] = useState('');
    const [selectedTeamNameFilter, setSelectedTeamNameFilter] = useState('');

    const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
    const [teamToRemove, setTeamToRemove] = useState(null);

    // Nový stav pre prepínač režimov
    const [viewMode, setViewMode] = useState('accommodation'); // 'accommodation' alebo 'category'

    useEffect(() => {
        if (!window.db) return;
        const unsubscribe = onSnapshot(
            collection(window.db, 'places'),
            (snapshot) => {
                const places = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (data.type !== "ubytovanie") return;
                    places.push({
                        id: docSnap.id,
                        name: data.name || '(bez názvu)',
                        accommodationType: data.accommodationType || null,
                        capacity: data.capacity ?? null,
                        headerColor: data.headerColor || '#1e40af',
                        headerTextColor: data.headerTextColor || '#ffffff',
                        assignedTeams: []
                    });
                });

                console.log("═══════════════════════════════════════════════════");
                console.log(`NAČÍTANÉ UBYTOVANIE — ${new Date().toLocaleTimeString('sk-SK')}`);
                console.log(`Celkový počet: ${places.length}`);
                console.log("═══════════════════════════════════════════════════");
                setAccommodations(places);
            },
            (err) => console.error("[PLACES]", err)
        );
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!window.db) return;
        const unsubscribe = onSnapshot(
            collection(window.db, 'users'),
            (snapshot) => {
                const teams = [];
                snapshot.forEach((doc) => {
                    const data = doc.data() || {};
                    if (data.teams && typeof data.teams === 'object') {
                        Object.entries(data.teams).forEach(([category, teamArray]) => {
                            if (!Array.isArray(teamArray)) return;
                            teamArray.forEach((team) => {
                                if (!team?.teamName) return;
                                const accomType = team.accommodation?.type?.trim?.() || '';
                                const hasAccommodation = accomType !== '' && accomType.toLowerCase() !== 'bez ubytovania';
                                if (!hasAccommodation) return;

                                const playerCount = Array.isArray(team.playerDetails) ? team.playerDetails.length : 0;
                                const womenRTCount = Array.isArray(team.womenTeamMemberDetails) ? team.womenTeamMemberDetails.length : 0;
                                const menRTCount = Array.isArray(team.menTeamMemberDetails) ? team.menTeamMemberDetails.length : 0;
                                const femaleDrivers = Array.isArray(team.driverDetailsFemale) ? team.driverDetailsFemale.length : 0;
                                const maleDrivers = Array.isArray(team.driverDetailsMale) ? team.driverDetailsMale.length : 0;
                                const totalPeople = playerCount + womenRTCount + menRTCount + femaleDrivers + maleDrivers;

                                teams.push({
                                    category,
                                    teamName: team.teamName.trim(),
                                    accommodation: accomType,
                                    totalPeople,
                                    fullTeamData: team,
                                    userId: doc.id,
                                    teamId: team.teamId || team.teamName.toLowerCase().replace(/\s+/g, '-'),
                                    assignedPlace: team.accommodation?.name || null,
                                    teamPath: {
                                        userId: doc.id,
                                        category: category,
                                        teamIndex: teamArray.indexOf(team)
                                    }
                                });
                            });
                        });
                    }
                });

                console.log("═══════════════════════════════════════════════════════════════════════════════════════");
                console.log(`VŠETKY TÍMY S UBYTOVANÍM — ${new Date().toLocaleTimeString('sk-SK')}`);
                console.log(`Celkom tímov: ${teams.length}`);
                console.log("═══════════════════════════════════════════════════════════════════════════════════════");
                setAllTeams(teams);
            },
            (err) => console.error("[USERS]", err)
        );
        return () => unsubscribe();
    }, []);

    // Funkcia na odstránenie veľkého písmenka na konci názvu tímu (A, B, C)
    const normalizeTeamName = (teamName) => {
        if (!teamName) return teamName;
        
        // Odstránenie veľkého písmenka na konci s medzerou pred ním
        // Napríklad: "Názov tímu A" -> "Názov tímu"
        const trimmed = teamName.trim();
        
        // Kontrola, či končí na veľké písmeno (A-Z)
        const lastChar = trimmed.slice(-1);
        const secondLastChar = trimmed.slice(-2, -1);
        
        // Ak je posledný znak veľké písmeno a predchádza mu medzera
        if (/^[A-Z]$/.test(lastChar) && secondLastChar === ' ') {
            return trimmed.slice(0, -2).trim(); // Odstráni medzeru a písmeno
        }
        
        // Ak je posledný znak veľké písmeno bez medzery pred ním
        if (/^[A-Z]$/.test(lastChar)) {
            return trimmed.slice(0, -1).trim(); // Odstráni iba písmeno
        }
        
        return trimmed;
    };

    // Generovanie jedinečných názvov tímov pre select box (bez písmenka na konci)
    const uniqueTeamNames = [...new Set(allTeams.map(team => {
        const normalized = normalizeTeamName(team.teamName);
        return normalized || team.teamName;
    }))].sort((a, b) => 
        a.localeCompare(b, 'sk', { sensitivity: 'base' })
    ).filter(name => name !== ''); // Filtrovanie prázdnych názvov

    // Funkcia na kontrolu, či tím zodpovedá vybranému filtru (vrátane variant s písmenkom)
    const teamMatchesFilter = (team, filter) => {
        if (!filter) return true;
        
        const normalizedTeamName = normalizeTeamName(team.teamName);
        const normalizedFilter = normalizeTeamName(filter);
        
        // Kontrola či sa normalizované názvy rovnajú
        if (normalizedTeamName === normalizedFilter) {
            return true;
        }
        
        // Kontrola či je názov tímu úplne rovnaký ako filter
        if (team.teamName === filter) {
            return true;
        }
        
        return false;
    };

    const sortTeams = (teams) => {
        return [...teams].sort((a, b) => {
            const categoryCompare = a.category.localeCompare(b.category, 'sk', { sensitivity: 'base' });
            if (categoryCompare !== 0) return categoryCompare;
            return a.teamName.localeCompare(b.teamName, 'sk', { sensitivity: 'base' });
        });
    };

    const unassignedTeams = sortTeams(allTeams.filter(team => !team.assignedPlace));
    const assignedTeams = sortTeams(allTeams.filter(team => team.assignedPlace));

    const categories = [...new Set(allTeams.map(team => team.category))].sort();

    const filteredUnassignedTeams = unassignedTeams.filter(team => {
        if (selectedCategory && team.category !== selectedCategory) return false;
        if (selectedTeamNameFilter && !teamMatchesFilter(team, selectedTeamNameFilter)) return false;
        return true;
    });

    const filteredAssignedTeams = assignedTeams.filter(team => {
        if (selectedCategory && team.category !== selectedCategory) return false;
        if (selectedTeamNameFilter && !teamMatchesFilter(team, selectedTeamNameFilter)) return false;
        if (selectedAccommodationFilter) {
            const selectedAccommodation = accommodations.find(a => a.id === selectedAccommodationFilter);
            if (!selectedAccommodation) return false;
            return team.assignedPlace === selectedAccommodation.name;
        }
        return true;
    });

    const getActualCapacity = (placeId) => {
        const place = accommodations.find(p => p.id === placeId);
        if (!place) return { used: 0, remaining: null };
        
        const allTeamsInPlace = assignedTeams.filter(team => team.assignedPlace === place.name);
        const usedCapacity = allTeamsInPlace.reduce((sum, team) => sum + team.totalPeople, 0);
        const remainingCapacity = place.capacity !== null ? place.capacity - usedCapacity : null;
        
        return {
            used: usedCapacity,
            remaining: remainingCapacity
        };
    };

    const getFilteredTeamsPeopleCount = (teamsArray) => {
        return teamsArray.reduce((sum, team) => sum + (team.totalPeople || 0), 0);
    };

    const accommodationsWithTeams = accommodations
        .filter(place => {
            if (selectedAccommodationFilter) {
                return place.id === selectedAccommodationFilter;
            }
            return true;
        })
        .map(place => {
            const allTeamsInPlace = sortTeams(
                assignedTeams.filter(team => team.assignedPlace === place.name)
            );
            
            const filteredTeamsInPlace = sortTeams(
                assignedTeams.filter(team => {
                    if (team.assignedPlace !== place.name) return false;
                    if (selectedCategory && team.category !== selectedCategory) return false;
                    if (selectedTeamNameFilter && !teamMatchesFilter(team, selectedTeamNameFilter)) return false;
                    return true;
                })
            );
            
            const actualCapacity = getActualCapacity(place.id);
            
            return {
                ...place,
                allAssignedTeams: allTeamsInPlace,
                filteredAssignedTeams: filteredTeamsInPlace,
                usedCapacity: actualCapacity.used,
                remainingCapacity: actualCapacity.remaining
            };
        })
        .filter(place => {
            if ((selectedCategory || selectedTeamNameFilter) && place.filteredAssignedTeams.length === 0) {
                return false;
            }
            return true;
        });

    // Pridané: Funkcia na získanie farby ubytovne pre tím
    const getTeamAccommodationColor = (team) => {
        if (!team.assignedPlace) return null;
        
        const accommodation = accommodations.find(place => place.name === team.assignedPlace);
        if (!accommodation) return null;
        
        return accommodation.headerColor || '#1e40af';
    };

    // Pridané: Logika pre režim kategórií
    const categoriesData = categories.map(category => {
        const teamsInCategory = allTeams.filter(team => team.category === category);
        const assignedTeamsInCategory = teamsInCategory.filter(team => team.assignedPlace);
        const unassignedTeamsInCategory = teamsInCategory.filter(team => !team.assignedPlace);
        
        // Spočítať osoby
        const totalPeople = teamsInCategory.reduce((sum, team) => sum + (team.totalPeople || 0), 0);
        const assignedPeople = assignedTeamsInCategory.reduce((sum, team) => sum + (team.totalPeople || 0), 0);
        const unassignedPeople = unassignedTeamsInCategory.reduce((sum, team) => sum + (team.totalPeople || 0), 0);
        
        return {
            name: category,
            teams: teamsInCategory,
            assignedTeams: assignedTeamsInCategory,
            unassignedTeams: unassignedTeamsInCategory,
            totalTeams: teamsInCategory.length,
            totalPeople,
            assignedPeople,
            unassignedPeople,
            assignedTeamsCount: assignedTeamsInCategory.length,
            unassignedTeamsCount: unassignedTeamsInCategory.length
        };
    });

    // Pridané: Filtrovanie kategórií podľa vybraných filtrov
    const filteredCategoriesData = categoriesData.filter(categoryData => {
        if (selectedCategory && categoryData.name !== selectedCategory) return false;
        if (selectedTeamNameFilter) {
            const hasMatchingTeam = categoryData.teams.some(team => 
                teamMatchesFilter(team, selectedTeamNameFilter)
            );
            if (!hasMatchingTeam) return false;
        }
        if (selectedAccommodationFilter) {
            const selectedAccommodation = accommodations.find(a => a.id === selectedAccommodationFilter);
            if (!selectedAccommodation) return false;
            const hasTeamInAccommodation = categoryData.assignedTeams.some(team => 
                team.assignedPlace === selectedAccommodation.name
            );
            if (!hasTeamInAccommodation) return false;
        }
        return true;
    });

    const openEditModal = (place) => {
        setSelectedPlaceForEdit(place);
        setNewHeaderColor(place.headerColor || '#1e40af');
        setNewHeaderTextColor(place.headerTextColor || '#ffffff');
        setIsColorModalOpen(true);
    };

    const saveHeaderColor = async () => {
        if (!selectedPlaceForEdit || !window.db) return;

        try {
            const placeRef = doc(window.db, 'places', selectedPlaceForEdit.id);
            await updateDoc(placeRef, { 
                headerColor: newHeaderColor,
                headerTextColor: newHeaderTextColor 
            });

            setAccommodations(prev =>
                prev.map(p =>
                    p.id === selectedPlaceForEdit.id 
                        ? { ...p, headerColor: newHeaderColor, headerTextColor: newHeaderTextColor }
                        : p
                )
            );

            await createAccommodationNotification('update_accommodation_color', {
                accommodationName: selectedPlaceForEdit.name,
                newHeaderColor: newHeaderColor,
                newHeaderTextColor: newHeaderTextColor
            });

            window.showGlobalNotification('Farba hlavičky bola aktualizovaná', 'success');
            notify('Farba ubytovne bola aktualizovaná', 'success');
        } catch (err) {
            console.error("Chyba pri ukladaní farby:", err);
            window.showGlobalNotification('Nepodarilo sa uložiť farbu', 'error');
            notify('Nepodarilo sa uložiť farbu ubytovne', 'error');
        }

        setIsColorModalOpen(false);
        setSelectedPlaceForEdit(null);
    };

    const openAssignModal = async (team) => {
        setSelectedTeam(team);
        setIsLoading(true);
        
        const filteredAccommodations = accommodations.filter(place => 
            place.accommodationType && 
            team.accommodation && 
            place.accommodationType.toLowerCase().includes(team.accommodation.toLowerCase())
        );
        
        setAvailableAccommodations(filteredAccommodations);
        
        if (team.assignedPlace) {
            const assignedPlace = filteredAccommodations.find(p => p.name === team.assignedPlace);
            if (assignedPlace) {
                setSelectedAccommodationId(assignedPlace.id);
            }
        } else {
            setSelectedAccommodationId('');
        }
        
        setIsLoading(false);
        setIsAssignModalOpen(true);
    };

    const saveAccommodationAssignment = async () => {
        if (!selectedTeam || !selectedAccommodationId || !window.db) return;

        const selectedPlace = availableAccommodations.find(p => p.id === selectedAccommodationId);
        if (!selectedPlace) return;

        setIsLoading(true);

        try {
            const userRef = doc(window.db, 'users', selectedTeam.userId);
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
                throw new Error('Používateľský dokument neexistuje');
            }

            const userData = userDoc.data();
            const teams = userData.teams || {};
            const teamArray = teams[selectedTeam.category] || [];

            const oldAccommodation = selectedTeam.assignedPlace;

            const updatedTeamArray = teamArray.map(teamItem => {
                if (teamItem.teamName === selectedTeam.teamName) {
                    return {
                        ...teamItem,
                        accommodation: {
                            ...teamItem.accommodation,
                            name: selectedPlace.name
                        }
                    };
                }
                return teamItem;
            });

            await updateDoc(userRef, {
                [`teams.${selectedTeam.category}`]: updatedTeamArray
            });

            if (oldAccommodation) {
                await createAccommodationNotification('change_accommodation', {
                    teamName: selectedTeam.teamName,
                    category: selectedTeam.category,
                    teamId: selectedTeam.teamId,
                    userId: selectedTeam.userId,
                    totalPeople: selectedTeam.totalPeople,
                    oldAccommodation: oldAccommodation,
                    newAccommodation: selectedPlace.name
                });
                notify(`Tím ${selectedTeam.teamName} bol presunutý z ${oldAccommodation} do ${selectedPlace.name}`, 'success');
            } else {
                await createAccommodationNotification('assign_accommodation', {
                    teamName: selectedTeam.teamName,
                    category: selectedTeam.category,
                    teamId: selectedTeam.teamId,
                    userId: selectedTeam.userId,
                    totalPeople: selectedTeam.totalPeople,
                    accommodationName: selectedPlace.name
                });
                notify(`Tím ${selectedTeam.teamName} bol priradený do ${selectedPlace.name}`, 'success');
            }

            window.showGlobalNotification(
                `Tím "${selectedTeam.teamName}" bol priradený do "${selectedPlace.name}"`,
                'success'
            );

            setIsAssignModalOpen(false);
            setSelectedTeam(null);
            setSelectedAccommodationId('');

        } catch (err) {
            console.error("Chyba pri ukladaní priradenia:", err);
            window.showGlobalNotification('Nepodarilo sa priradiť ubytovňu', 'error');
            notify('Nepodarilo sa priradiť ubytovňu', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const openRemoveConfirmation = (team) => {
        setTeamToRemove(team);
        setIsRemoveModalOpen(true);
    };

    const removeTeamAssignment = async () => {
        if (!teamToRemove || !window.db) return;

        setIsLoading(true);

        try {
            const userRef = doc(window.db, 'users', teamToRemove.userId);
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
                throw new Error('Používateľský dokument neexistuje');
            }

            const userData = userDoc.data();
            const teams = userData.teams || {};
            const teamArray = teams[teamToRemove.category] || [];

            const updatedTeamArray = teamArray.map(teamItem => {
                if (teamItem.teamName === teamToRemove.teamName) {
                    return {
                        ...teamItem,
                        accommodation: {
                            ...teamItem.accommodation,
                            name: null
                        }
                    };
                }
                return teamItem;
            });

            await updateDoc(userRef, {
                [`teams.${teamToRemove.category}`]: updatedTeamArray
            });

            await createAccommodationNotification('remove_accommodation', {
                teamName: teamToRemove.teamName,
                category: teamToRemove.category,
                teamId: teamToRemove.teamId,
                userId: teamToRemove.userId,
                totalPeople: teamToRemove.totalPeople,
                oldAccommodation: teamToRemove.assignedPlace
            });

            window.showGlobalNotification(
                `Priradenie tímu "${teamToRemove.teamName}" bolo odstránené`,
                'success'
            );
            notify(`Tím ${teamToRemove.teamName} bol odstránený z ubytovne ${teamToRemove.assignedPlace}`, 'success');

            setIsRemoveModalOpen(false);
            setTeamToRemove(null);

        } catch (err) {
            console.error("Chyba pri odstraňovaní priradenia:", err);
            window.showGlobalNotification('Nepodarilo sa odstrániť priradenie', 'error');
            notify('Nepodarilo sa odstrániť priradenie tímu', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const resetFilters = () => {
        setSelectedCategory('');
        setSelectedAccommodationFilter('');
        setSelectedTeamNameFilter('');
    };

    const getFilterDescription = () => {
        const filters = [];
        if (selectedCategory) {
            filters.push(`Kategória: ${selectedCategory}`);
        }
        if (selectedAccommodationFilter) {
            const accommodation = accommodations.find(a => a.id === selectedAccommodationFilter);
            filters.push(`Ubytovňa: ${accommodation?.name || selectedAccommodationFilter}`);
        }
        if (selectedTeamNameFilter) {
            filters.push(`Tím: ${selectedTeamNameFilter}`);
        }
        return filters.join(' + ');
    };

    const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1,3), 16);
        const g = parseInt(hex.slice(3,5), 16);
        const b = parseInt(hex.slice(5,7), 16);
        return `rgb(${r}, ${g}, ${b})`;
    };
    
    const hexToHsl = (hex) => {
        let r = parseInt(hex.slice(1,3), 16) / 255;
        let g = parseInt(hex.slice(3,5), 16) / 255;
        let b = parseInt(hex.slice(5,7), 16) / 255;
    
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
    
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
    
        h = Math.round(h * 360);
        s = Math.round(s * 100);
        l = Math.round(l * 100);
        return `hsl(${h}, ${s}%, ${l}%)`;
    };

    const [uiNotification, setUiNotification] = useState(null);
    useEffect(() => {
        let timer;
        const unsubscribe = subscribe((notification) => {
            setUiNotification(notification);
            clearTimeout(timer);
            timer = setTimeout(() => {
                setUiNotification(null);
            }, 5000);
        });
        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    const uiNotificationClasses = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-2xl text-white text-center z-[9999] transition-all duration-400 ease-in-out ${
        uiNotification
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-4 pointer-events-none'
    }`;
    
    let typeClasses = '';
    if (uiNotification) {
        switch (uiNotification.type) {
            case 'success': typeClasses = 'bg-green-500'; break;
            case 'error': typeClasses = 'bg-red-500'; break;
            case 'info': typeClasses = 'bg-blue-500'; break;
            default: typeClasses = 'bg-gray-700';
        }
    }

    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-50 py-8 px-4 relative' },
        
        uiNotification && React.createElement(
            'div',
            { className: `${uiNotificationClasses} ${typeClasses}` },
            uiNotification.message
        ),
        
        React.createElement(NotificationPortal, null),
        
        React.createElement(
            'div',
            { className: 'max-w-7xl mx-auto h-full' },

            // Pridané: Prepínač režimov
            React.createElement(
                'div',
                { className: 'mb-6 bg-white rounded-xl shadow-lg p-4' },
                React.createElement(
                    'div',
                    { className: 'flex flex-col sm:flex-row sm:items-center justify-between gap-4' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-3' },
                        React.createElement(
                            'span',
                            { className: 'text-lg font-semibold text-gray-700' },
                            'Režim zobrazenia:'
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-2' },
                            React.createElement(
                                'span',
                                { 
                                    className: `text-sm font-medium ${viewMode === 'accommodation' ? 'text-blue-600' : 'text-gray-500'}` 
                                },
                                'Ubytovní'
                            ),
                            React.createElement(
                                'button',
                                {
                                    onClick: () => setViewMode(viewMode === 'accommodation' ? 'category' : 'accommodation'),
                                    className: 'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                                    style: { 
                                        backgroundColor: viewMode === 'category' ? '#3b82f6' : '#d1d5db'
                                    }
                                },
                                React.createElement(
                                    'span',
                                    {
                                        className: 'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                                        style: { 
                                            transform: viewMode === 'category' ? 'translateX(6px)' : 'translateX(1px)'
                                        }
                                    }
                                )
                            ),
                            React.createElement(
                                'span',
                                { 
                                    className: `text-sm font-medium ${viewMode === 'category' ? 'text-blue-600' : 'text-gray-500'}` 
                                },
                                'Kategórií'
                            )
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-sm text-gray-600' },
                        viewMode === 'accommodation' 
                            ? 'Zobrazenie podľa ubytovní'
                            : 'Zobrazenie podľa kategórií'
                    )
                )
            ),
            
            React.createElement(
                'div',
                { className: 'mb-8 bg-white rounded-xl shadow-lg p-6' },
                React.createElement(
                    'div',
                    { className: 'flex flex-col md:flex-row md:items-end gap-6' },
                    
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        React.createElement(
                            'label',
                            { 
                                className: 'block text-sm font-medium text-gray-700 mb-2',
                                htmlFor: 'category-filter'
                            },
                            'Filtrovať podľa kategórie'
                        ),
                        React.createElement(
                            'select',
                            {
                                id: 'category-filter',
                                value: selectedCategory,
                                onChange: (e) => setSelectedCategory(e.target.value),
                                className: 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition'
                            },
                            React.createElement('option', { value: '' }, 'Všetky kategórie'),
                            categories.map(category => 
                                React.createElement('option', { key: category, value: category }, category)
                            )
                        )
                    ),
    
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        React.createElement(
                            'label',
                            { 
                                className: 'block text-sm font-medium text-gray-700 mb-2',
                                htmlFor: 'accommodation-filter'
                            },
                            'Filtrovať podľa ubytovne'
                        ),
                        React.createElement(
                            'select',
                            {
                                id: 'accommodation-filter',
                                value: selectedAccommodationFilter,
                                onChange: (e) => setSelectedAccommodationFilter(e.target.value),
                                className: 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition'
                            },
                            React.createElement('option', { value: '' }, 'Všetky ubytovne'),
                            accommodations.map(place => 
                                React.createElement('option', { key: place.id, value: place.id }, place.name)
                            )
                        )
                    ),

                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        React.createElement(
                            'label',
                            { 
                                className: 'block text-sm font-medium text-gray-700 mb-2',
                                htmlFor: 'team-name-filter'
                            },
                            'Filtrovať podľa názvu tímu'
                        ),
                        React.createElement(
                            'select',
                            {
                                id: 'team-name-filter',
                                value: selectedTeamNameFilter,
                                onChange: (e) => setSelectedTeamNameFilter(e.target.value),
                                className: 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition'
                            },
                            React.createElement('option', { value: '' }, 'Všetky tímy'),
                            uniqueTeamNames.map(teamName => 
                                React.createElement('option', { key: teamName, value: teamName }, teamName)
                            )
                        )
                    ),
    
                    React.createElement(
                        'div',
                        { className: 'md:flex items-end' },
                        React.createElement(
                            'button',
                            {
                                onClick: resetFilters,
                                className: 'px-6 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition font-medium whitespace-nowrap w-full md:w-auto'
                            },
                            'Zrušiť filtre'
                        )
                    )
                ),
    
                (selectedCategory || selectedAccommodationFilter || selectedTeamNameFilter) && React.createElement(
                    'div',
                    { className: 'mt-6 pt-6 border-t border-gray-200' },
                    React.createElement(
                        'div',
                        { className: 'flex flex-col sm:flex-row sm:items-center gap-3' },
                        React.createElement(
                            'span',
                            { className: 'text-gray-600 font-medium' },
                            'Aktívne filtre:'
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex flex-wrap gap-2' },
                            selectedCategory && React.createElement(
                                'span',
                                { className: 'px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium flex items-center gap-1' },
                                `Kategória: ${selectedCategory}`,
                                React.createElement(
                                    'button',
                                    {
                                        onClick: () => setSelectedCategory(''),
                                        className: 'ml-1 text-blue-600 hover:text-blue-800'
                                    },
                                    '×'
                                )
                            ),
                            selectedAccommodationFilter && React.createElement(
                                'span',
                                { className: 'px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1' },
                                `Ubytovňa: ${accommodations.find(a => a.id === selectedAccommodationFilter)?.name || selectedAccommodationFilter}`,
                                React.createElement(
                                    'button',
                                    {
                                        onClick: () => setSelectedAccommodationFilter(''),
                                        className: 'ml-1 text-green-600 hover:text-green-800'
                                    },
                                    '×'
                                )
                            ),
                            selectedTeamNameFilter && React.createElement(
                                'span',
                                { className: 'px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium flex items-center gap-1' },
                                `Tím: ${selectedTeamNameFilter}`,
                                React.createElement(
                                    'button',
                                    {
                                        onClick: () => setSelectedTeamNameFilter(''),
                                        className: 'ml-1 text-purple-600 hover:text-purple-800'
                                    },
                                    '×'
                                )
                            )
                        )
                    )
                )
            ),
    
            // Hlavný obsah - podmienené vykreslenie podľa režimu
            viewMode === 'accommodation' 
                ? // Pôvodné zobrazenie podľa ubytovní
                React.createElement(
                    'div',
                    { 
                        className: filteredUnassignedTeams.length > 0 
                            ? 'flex flex-col lg:flex-row gap-8 lg:gap-10 h-full' 
                            : 'grid grid-cols-1 h-full'
                    },
    
                    filteredUnassignedTeams.length > 0 && React.createElement(
                        'div',
                        { className: 'lg:w-[48%] xl:w-[46%] h-full flex flex-col' },
                        React.createElement(
                            'div',
                            { className: 'bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col' },
                            React.createElement(
                                'div',
                                { className: 'bg-green-700 text-white px-6 py-4' },
                                React.createElement('h2', { className: 'text-xl font-bold' }, 
                                    (selectedCategory || selectedAccommodationFilter || selectedTeamNameFilter)
                                        ? `Tímy bez priradenia ${getFilterDescription() ? `(${getFilterDescription()})` : ''} (${filteredUnassignedTeams.length})`
                                        : `Tímy bez priradenia (${filteredUnassignedTeams.length})`
                                )
                            ),
                            React.createElement(
                                'div',
                                { className: 'p-6 flex-grow overflow-y-auto' },
                                React.createElement(
                                    'ul',
                                    { className: 'space-y-3' },
                                    filteredUnassignedTeams.map((team, i) =>
                                        React.createElement(
                                            'li',
                                            {
                                                key: i,
                                                className: 'py-3 px-4 bg-gray-50 rounded border-l-4 border-green-500 flex justify-between items-center'
                                            },
                                            React.createElement(
                                                'div',
                                                { className: 'flex-grow min-w-0' },
                                                React.createElement('span', { 
                                                    className: 'font-medium whitespace-nowrap overflow-visible',
                                                    style: { textOverflow: 'clip' }
                                                }, `${team.category}: ${team.teamName}`),
                                                React.createElement('span', { 
                                                    className: 'text-gray-500 ml-3 text-sm whitespace-nowrap'
                                                }, `(${team.totalPeople} osôb)`)
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-3 flex-shrink-0' },
                                                React.createElement('span', { 
                                                    className: 'font-medium text-green-700 whitespace-nowrap'
                                                }, team.accommodation),
                                                React.createElement(
                                                    'button',
                                                    {
                                                        onClick: () => openAssignModal(team),
                                                        className: 'p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors flex-shrink-0',
                                                    },
                                                    React.createElement(
                                                        'svg',
                                                        { 
                                                            className: 'w-5 h-5', 
                                                            fill: 'none', 
                                                            stroke: 'currentColor', 
                                                            viewBox: '0 0 24 24',
                                                            strokeWidth: '2'
                                                        },
                                                        React.createElement('path', {
                                                            strokeLinecap: 'round',
                                                            strokeLinejoin: 'round',
                                                            d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                                                        })
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    ),
    
                    React.createElement(
                        'div',
                        { 
                            className: filteredUnassignedTeams.length > 0 
                                ? 'lg:w-[52%] xl:w-[54%] h-full flex flex-col' 
                                : 'w-full h-full flex flex-col'
                        },
                        React.createElement(
                            'div',
                            { className: 'h-full flex flex-col' },
                            filteredUnassignedTeams.length === 0 && React.createElement(
                                'h2',
                                { className: 'text-2xl font-bold text-gray-800 mb-4' },
                                (selectedCategory || selectedAccommodationFilter || selectedTeamNameFilter)
                                    ? `Ubytovacie miesta ${getFilterDescription() ? `(${getFilterDescription()})` : ''}`
                                    : 'Ubytovacie miesta s priradenými tímami'
                            ),
                            accommodationsWithTeams.length === 0
                                ? React.createElement(
                                    'div',
                                    { className: 'bg-white rounded-xl shadow-lg p-8 text-center flex-grow' },
                                    React.createElement('p', { className: 'text-gray-500 text-lg' }, 
                                        selectedCategory || selectedAccommodationFilter || selectedTeamNameFilter
                                            ? `Žiadne ubytovacie miesta pre zvolené filtre`
                                            : 'Zatiaľ žiadne ubytovacie miesta...'
                                    )
                                  )
                                : React.createElement(
                                    'div',
                                    { 
                                        className: filteredUnassignedTeams.length > 0
                                            ? 'space-y-6'
                                            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6'
                                    },
                                    accommodationsWithTeams.map((place) => {
                                        const baseHeight = 200;
                                        const teamItemHeight = 60;
                                        const minHeight = 400;

                                        const teamsToShow = place.filteredAssignedTeams.length;
                                        const calculatedHeight = Math.max(minHeight, baseHeight + (teamsToShow * teamItemHeight));
                                        
                                        return React.createElement(
                                            'div',
                                            { 
                                                key: place.id, 
                                                className: 'bg-white rounded-xl shadow-lg overflow-hidden flex flex-col min-w-0'
                                            },
                                            React.createElement(
                                                'div',
                                                {
                                                    className: 'text-white px-5 py-3 relative flex items-center justify-between flex-shrink-0 min-w-0',
                                                    style: { 
                                                        backgroundColor: place.headerColor,
                                                        color: place.headerTextColor || '#ffffff'
                                                    }
                                                },
                                                React.createElement(
                                                    'div',
                                                    { className: 'flex-grow min-w-0 overflow-hidden' },
                                                    React.createElement('h3', { 
                                                        className: 'text-lg font-bold whitespace-nowrap overflow-visible',
                                                        style: { textOverflow: 'clip' },
                                                    }, place.name || 'Ubytovacie miesto'),
                                                    React.createElement('div', { 
                                                        className: 'text-xs opacity-90 mt-1 whitespace-nowrap overflow-visible',
                                                        style: { textOverflow: 'clip' }
                                                    }, `${place.allAssignedTeams.length} tímov • ${place.usedCapacity} osôb`)
                                                ),
                                                React.createElement(
                                                    'button',
                                                    {
                                                        onClick: () => openEditModal(place),
                                                        className: 'flex-shrink-0 ml-3 flex items-center gap-1 px-3 py-1 bg-white text-black hover:bg-gray-100 active:bg-gray-200 transition-colors text-xs font-medium rounded-full border border-gray-300 shadow-sm whitespace-nowrap',
                                                    },
                                                    React.createElement(
                                                        'svg',
                                                        { 
                                                            className: 'w-3 h-3', 
                                                            fill: 'none', 
                                                            stroke: 'currentColor', 
                                                            viewBox: '0 0 24 24',
                                                            strokeWidth: '2'
                                                        },
                                                        React.createElement('path', {
                                                            strokeLinecap: 'round',
                                                            strokeLinejoin: 'round',
                                                            d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                                                        })
                                                    ),
                                                    React.createElement('span', null, 'Upraviť')
                                                )
                                            ),
                                            React.createElement(
                                                'div',
                                                { 
                                                    className: 'p-5 flex-grow overflow-hidden flex flex-col min-w-0',
                                                    style: { 
                                                        height: `${calculatedHeight - 80}px`
                                                    }
                                                },
                                                React.createElement(
                                                    'div',
                                                    { className: 'space-y-4 flex-grow flex flex-col min-w-0' },
                                                    React.createElement(
                                                        'div',
                                                        { className: 'space-y-2 flex-shrink-0 min-w-0' },
                                                        React.createElement(
                                                            'p',
                                                            { 
                                                                className: 'text-gray-700 text-sm whitespace-nowrap overflow-visible min-w-0',
                                                                style: { textOverflow: 'clip' }
                                                            },
                                                            React.createElement('span', { className: 'font-semibold' }, 'Typ: '),
                                                            place.accommodationType || 'neurčený'
                                                        ),
                                                        place.capacity !== null &&
                                                            React.createElement(
                                                                'div',
                                                                { 
                                                                    className: 'text-gray-700 text-sm whitespace-nowrap overflow-visible min-w-0',
                                                                    style: { textOverflow: 'clip' }
                                                                },
                                                                React.createElement('span', { className: 'font-semibold' }, 'Kapacita: '),
                                                                `${place.usedCapacity} / ${place.capacity} osôb`
                                                            ),
                                                        place.remainingCapacity !== null &&
                                                            React.createElement(
                                                                'p',
                                                                { 
                                                                    className: `text-sm whitespace-nowrap overflow-visible min-w-0 ${place.remainingCapacity < 0 ? 'text-red-600 font-semibold' : 'text-gray-700'}`,
                                                                    style: { textOverflow: 'clip' },
                                                                },
                                                                React.createElement('span', { className: 'font-semibold' }, 'Zostáva: '),
                                                                `${place.remainingCapacity} osôb`
                                                            )
                                                    ),
                                                    
                                                    place.filteredAssignedTeams.length > 0 &&
                                                    React.createElement(
                                                        'div',
                                                        { className: 'mt-2 flex-grow overflow-hidden flex flex-col min-w-0' },
                                                        React.createElement(
                                                            'h4',
                                                            { 
                                                                className: 'font-semibold text-gray-800 mb-2 text-sm flex-shrink-0 whitespace-nowrap overflow-visible',
                                                                style: { textOverflow: 'clip' }
                                                            },
                                                            `Priradené tímy ${selectedCategory || selectedAccommodationFilter || selectedTeamNameFilter ? '(filtrované)' : ''} (${place.filteredAssignedTeams.length}${selectedCategory || selectedAccommodationFilter || selectedTeamNameFilter ? '/' + getFilteredTeamsPeopleCount(place.filteredAssignedTeams) + ' osôb' : ''})`
                                                        ),
                                                        React.createElement(
                                                            'ul',
                                                            { className: 'space-y-1.5 flex-grow overflow-y-auto pr-1 min-w-0' },
                                                            place.filteredAssignedTeams.map((team, index) =>
                                                                React.createElement(
                                                                    'li',
                                                                    {
                                                                        key: index,
                                                                        className: 'py-1.5 px-2.5 bg-gray-50 rounded border border-gray-200 flex justify-between items-center hover:bg-gray-100 group flex-shrink-0 min-w-0'
                                                                    },
                                                                    React.createElement(
                                                                        'div',
                                                                        { className: 'min-w-0 flex-grow flex items-center' },
                                                                        React.createElement('span', { 
                                                                            className: 'font-medium text-sm whitespace-nowrap overflow-visible flex-shrink-0',
                                                                            style: { textOverflow: 'clip' },
                                                                        }, `${team.category}: ${team.teamName}`),
                                                                        React.createElement('span', { 
                                                                            className: 'text-gray-500 text-xs ml-2 whitespace-nowrap flex-shrink-0'
                                                                        }, `(${team.totalPeople} osôb)`)
                                                                    ),
                                                                    React.createElement(
                                                                        'div',
                                                                        { className: 'flex items-center gap-1 flex-shrink-0 ml-2' },
                                                                        React.createElement(
                                                                            'button',
                                                                            {
                                                                                onClick: () => openAssignModal(team),
                                                                                className: 'p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors opacity-0 group-hover:opacity-100',
                                                                            },
                                                                            React.createElement(
                                                                                'svg',
                                                                                { 
                                                                                    className: 'w-3.5 h-3.5', 
                                                                                    fill: 'none', 
                                                                                    stroke: 'currentColor', 
                                                                                    viewBox: '0 0 24 24',
                                                                                    strokeWidth: '2'
                                                                                },
                                                                                React.createElement('path', {
                                                                                    strokeLinecap: 'round',
                                                                                    strokeLinejoin: 'round',
                                                                                    d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                                                                                })
                                                                            )
                                                                        ),
                                                                        React.createElement(
                                                                            'button',
                                                                            {
                                                                                onClick: () => openRemoveConfirmation(team),
                                                                                className: 'p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100',
                                                                            },
                                                                            React.createElement(
                                                                                'svg',
                                                                                { 
                                                                                    className: 'w-3.5 h-3.5', 
                                                                                    fill: 'none', 
                                                                                    stroke: 'currentColor', 
                                                                                    viewBox: '0 0 24 24',
                                                                                    strokeWidth: '2'
                                                                                },
                                                                                React.createElement('path', {
                                                                                    strokeLinecap: 'round',
                                                                                    strokeLinejoin: 'round',
                                                                                    d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                                                                                })
                                                                            )
                                                                        )
                                                                    )
                                                                )
                                                            )
                                                        )
                                                    )
                                                )
                                            )
                                        );
                                    })
                                )
                        )
                    )
                )
                : // Nové zobrazenie podľa kategórií
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' },
                    filteredCategoriesData.length === 0
                        ? React.createElement(
                            'div',
                            { className: 'col-span-full bg-white rounded-xl shadow-lg p-8 text-center' },
                            React.createElement('p', { className: 'text-gray-500 text-lg' }, 
                                selectedCategory || selectedAccommodationFilter || selectedTeamNameFilter
                                    ? 'Žiadne kategórie pre zvolené filtre'
                                    : 'Zatiaľ žiadne kategórie s tímami...'
                            )
                        )
                        : filteredCategoriesData.map(category => {
                            // ODSTRÁNIŤ tieto výškové konštanty:
                            // const baseHeight = 220;
                            // const teamItemHeight = 52;
                            // const minHeight = 320;
                            // const maxHeight = 600;
                            
                            // Odstrániť celý výpočet pre calculatedHeight
                            // let teamsToShow = 0;
                            // if (selectedAccommodationFilter) {
                            //     const selectedAccommodation = accommodations.find(a => a.id === selectedAccommodationFilter);
                            //     if (selectedAccommodation) {
                            //         teamsToShow = category.teams.filter(team => 
                            //             team.assignedPlace === selectedAccommodation.name
                            //         ).length;
                            //     }
                            // } else if (selectedTeamNameFilter) {
                            //     teamsToShow = category.teams.filter(team => 
                            //         teamMatchesFilter(team, selectedTeamNameFilter)
                            //     ).length;
                            // } else {
                            //     teamsToShow = category.teams.length;
                            // }
                            
                            // const calculatedHeight = Math.min(
                            //     maxHeight,
                            //     Math.max(minHeight, baseHeight + (teamsToShow * teamItemHeight))
                            // );
                            
                            return React.createElement(
                                'div',
                                { 
                                    key: category.name, 
                                    className: 'bg-white rounded-xl shadow-lg overflow-hidden flex flex-col min-w-0' // ODSTRÁNIŤ h-full
                                },
                                // Hlavička kategórie
                                React.createElement(
                                    'div',
                                    {
                                        className: 'bg-blue-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0 min-w-0'
                                    },
                                    React.createElement(
                                        'div',
                                        { className: 'flex-grow min-w-0 overflow-hidden' },
                                        React.createElement('h3', { 
                                            className: 'text-lg font-bold whitespace-nowrap overflow-visible',
                                            style: { textOverflow: 'clip' },
                                        }, category.name),
                                        React.createElement('div', { 
                                            className: 'text-xs opacity-90 mt-0.5 whitespace-nowrap overflow-visible',
                                            style: { textOverflow: 'clip' }
                                        }, 
                                        `${category.assignedTeamsCount} z ${category.totalTeams} tímov • `,
                                        `${category.assignedPeople} z ${category.totalPeople} osôb`
                                        )
                                    ),
                                    React.createElement(
                                        'div',
                                        { className: 'flex-shrink-0 ml-2 text-xs font-medium bg-white text-blue-600 px-2 py-1 rounded-full whitespace-nowrap' },
                                        `${category.totalTeams} tímov`
                                    )
                                ),
                                
                                // Telo karty s tímami - ZMENIŤ CSS classy pre výšku
                                React.createElement(
                                    'div',
                                    { 
                                        className: 'p-4 flex-grow overflow-visible flex flex-col min-w-0', // Zmeniť overflow-hidden na overflow-visible
                                        // ODSTRÁNIŤ inline style pre výšku
                                    },
                                    // Nepriradené tímy
                                    category.unassignedTeams.length > 0 && 
                                    (selectedTeamNameFilter ? 
                                        category.unassignedTeams.filter(team => 
                                            teamMatchesFilter(team, selectedTeamNameFilter)
                                        ).length > 0 :
                                        true
                                    ) &&
                                    React.createElement(
                                        'div',
                                        { className: 'mb-4 flex-shrink-0 min-w-0' },
                                        React.createElement(
                                            'h4',
                                            { 
                                                className: 'font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-200 text-xs whitespace-nowrap overflow-visible',
                                                style: { textOverflow: 'clip' }
                                            },
                                            `Nepriradené (${category.unassignedTeamsCount})`
                                        ),
                                        React.createElement(
                                            'ul',
                                            { className: 'space-y-1.5 min-w-0' },
                                            category.unassignedTeams
                                                .filter(team => 
                                                    !selectedTeamNameFilter || teamMatchesFilter(team, selectedTeamNameFilter)
                                                )
                                                .map((team, index) =>
                                                    React.createElement(
                                                        'li',
                                                        {
                                                            key: `${team.teamId}-${index}`,
                                                            className: 'py-1.5 px-2.5 bg-gray-50 rounded border border-gray-200 flex justify-between items-center hover:bg-gray-100 group min-w-0'
                                                        },
                                                        React.createElement(
                                                            'div',
                                                            { className: 'min-w-0 flex-grow flex items-center overflow-hidden' },
                                                            React.createElement('span', { 
                                                                className: 'font-medium text-xs whitespace-nowrap overflow-visible flex-shrink-0',
                                                                style: { textOverflow: 'clip' },
                                                            }, `${team.category}: ${team.teamName}`),
                                                            React.createElement('span', { 
                                                                className: 'text-gray-500 text-xs ml-1.5 whitespace-nowrap flex-shrink-0'
                                                            }, `(${team.totalPeople})`
                                                            )
                                                        ),
                                                        React.createElement(
                                                            'div',
                                                            { className: 'flex items-center gap-0.5 flex-shrink-0 ml-1.5' },
                                                            React.createElement(
                                                                'button',
                                                                {
                                                                    onClick: () => openAssignModal(team),
                                                                    className: 'px-2 py-0.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors whitespace-nowrap'
                                                                },
                                                                'Priradiť'
                                                            )
                                                        )
                                                    )
                                                )
                                        )
                                    ),
                                    
                                    // Priradené tímy (bez nadpisov ubytovní) - ZMENIŤ CSS classy
                                    category.assignedTeams.length > 0 && 
                                    (selectedAccommodationFilter || selectedTeamNameFilter ? 
                                        category.assignedTeams.filter(team => {
                                            if (selectedAccommodationFilter) {
                                                const selectedAccommodation = accommodations.find(a => a.id === selectedAccommodationFilter);
                                                if (!selectedAccommodation) return false;
                                                return team.assignedPlace === selectedAccommodation.name;
                                            }
                                            if (selectedTeamNameFilter) {
                                                return teamMatchesFilter(team, selectedTeamNameFilter);
                                            }
                                            return true;
                                        }).length > 0 :
                                        true
                                    ) &&
                                    React.createElement(
                                        'div',
                                        { className: 'flex-grow overflow-visible flex flex-col min-w-0' }, // Zmeniť overflow-hidden na overflow-visible
                                        React.createElement(
                                            'h4',
                                            { 
                                                className: 'font-semibold text-gray-800 mb-2 text-xs whitespace-nowrap overflow-visible flex-shrink-0',
                                                style: { textOverflow: 'clip' }
                                            },
                                            `Priradené (${category.assignedTeamsCount})`
                                        ),
                                        React.createElement(
                                            'ul',
                                            { className: 'space-y-1.5 flex-grow overflow-visible pr-1 min-w-0' }, // Zmeniť overflow-y-auto na overflow-visible
                                            category.assignedTeams
                                                .filter(team => {
                                                    if (selectedAccommodationFilter) {
                                                        const selectedAccommodation = accommodations.find(a => a.id === selectedAccommodationFilter);
                                                        if (!selectedAccommodation) return false;
                                                        return team.assignedPlace === selectedAccommodation.name;
                                                    }
                                                    if (selectedTeamNameFilter) {
                                                        return teamMatchesFilter(team, selectedTeamNameFilter);
                                                    }
                                                    return true;
                                                })
                                                .sort((a, b) => {
                                                    // Najprv zoradiť podľa ubytovne, potom podľa názvu tímu
                                                    if (a.assignedPlace !== b.assignedPlace) {
                                                        return a.assignedPlace.localeCompare(b.assignedPlace, 'sk', { sensitivity: 'base' });
                                                    }
                                                    return a.teamName.localeCompare(b.teamName, 'sk', { sensitivity: 'base' });
                                                })
                                                .map((team, index) => {
                                                    const teamColor = getTeamAccommodationColor(team);
                                                    const accommodation = accommodations.find(place => place.name === team.assignedPlace);
                                                    
                                                    return React.createElement(
                                                        'li',
                                                        {
                                                            key: `${team.teamId}-${index}`,
                                                            className: 'py-1.5 px-2.5 bg-gray-50 rounded border border-gray-200 flex justify-between items-center hover:bg-gray-100 group min-w-0'
                                                        },
                                                        React.createElement(
                                                            'div',
                                                            { className: 'min-w-0 flex-grow flex flex-col overflow-hidden' },
                                                            React.createElement(
                                                                'div',
                                                                { className: 'flex items-center min-w-0' },
                                                                React.createElement('span', { 
                                                                    className: 'font-medium text-xs whitespace-nowrap overflow-visible flex-shrink-0',
                                                                    style: { 
                                                                        textOverflow: 'clip',
                                                                        color: teamColor || 'inherit'
                                                                    },
                                                                }, `${team.category}: ${team.teamName}`),
                                                                React.createElement('span', { 
                                                                    className: 'text-xs ml-1.5 whitespace-nowrap flex-shrink-0 font-medium',
                                                                    style: { 
                                                                        color: teamColor || '#6b7280'
                                                                    }
                                                                }, `(${team.totalPeople})`
                                                                )
                                                            ),
                                                            React.createElement(
                                                                'div',
                                                                { 
                                                                    className: 'text-xs text-gray-600 mt-0.5 flex items-center gap-0.5 min-w-0'
                                                                },
                                                                React.createElement(
                                                                    'span',
                                                                    {
                                                                        className: 'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
                                                                        style: { backgroundColor: teamColor || '#6b7280' }
                                                                    }
                                                                ),
                                                                React.createElement('span', { 
                                                                    className: 'whitespace-nowrap overflow-visible flex-shrink-0',
                                                                    style: { textOverflow: 'clip' }
                                                                }, team.assignedPlace),
                                                                accommodation && accommodation.accommodationType && 
                                                                React.createElement(
                                                                    'span',
                                                                    { 
                                                                        className: 'ml-1 text-gray-500 whitespace-nowrap flex-shrink-0',
                                                                        style: { textOverflow: 'clip' }
                                                                    },
                                                                    `(${accommodation.accommodationType})`
                                                                )
                                                            )
                                                        ),
                                                        React.createElement(
                                                            'div',
                                                            { className: 'flex items-center gap-0.5 flex-shrink-0 ml-1.5' },
                                                            React.createElement(
                                                                'button',
                                                                {
                                                                    onClick: () => openAssignModal(team),
                                                                    className: 'p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors opacity-0 group-hover:opacity-100'
                                                                },
                                                                React.createElement(
                                                                    'svg',
                                                                    { 
                                                                        className: 'w-3 h-3', 
                                                                        fill: 'none', 
                                                                        stroke: 'currentColor', 
                                                                        viewBox: '0 0 24 24',
                                                                        strokeWidth: '2'
                                                                    },
                                                                    React.createElement('path', {
                                                                        strokeLinecap: 'round',
                                                                        strokeLinejoin: 'round',
                                                                        d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                                                                    })
                                                                )
                                                            ),
                                                            React.createElement(
                                                                'button',
                                                                {
                                                                    onClick: () => openRemoveConfirmation(team),
                                                                    className: 'p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100'
                                                                },
                                                                React.createElement(
                                                                    'svg',
                                                                    { 
                                                                        className: 'w-3 h-3', 
                                                                        fill: 'none', 
                                                                        stroke: 'currentColor', 
                                                                        viewBox: '0 0 24 24',
                                                                        strokeWidth: '2'
                                                                    },
                                                                    React.createElement('path', {
                                                                        strokeLinecap: 'round',
                                                                        strokeLinejoin: 'round',
                                                                        d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                                                                    })
                                                                )
                                                            )
                                                        )
                                                    );
                                                })
                                        )
                                    )
                                )
                            );
                        })
                ),
            )
    
        isColorModalOpen &&
        React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]',
                onClick: (e) => { if (e.target === e.currentTarget) setIsColorModalOpen(false); }
            },
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4' },
                
                React.createElement(
                    'div',
                    { className: 'mb-6' },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-bold text-gray-900 inline' },
                        'Upraviť farby'
                    ),
                    React.createElement(
                        'span',
                        { className: 'text-lg font-medium text-gray-600 ml-2' },
                        '– ' + (selectedPlaceForEdit?.name || 'Ubytovacie miesto')
                    )
                ),
        
                React.createElement('div', { className: 'mb-10' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-3' }, 'Farba pozadia hlavičky'),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col items-center gap-4' },
                        React.createElement('input', {
                            type: 'color',
                            value: newHeaderColor,
                            onChange: (e) => setNewHeaderColor(e.target.value),
                            className: 'w-32 h-32 rounded-lg cursor-pointer border-2 border-gray-300 shadow-md'
                        }),
                        React.createElement(
                            'div',
                            { className: 'w-full text-center text-sm text-gray-600 space-y-1 font-mono' },
                            React.createElement('div', null, `HEX: ${newHeaderColor}`),
                            React.createElement('div', null, `RGB: ${hexToRgb(newHeaderColor)}`),
                            React.createElement('div', null, `HSL: ${hexToHsl(newHeaderColor)}`)
                        )
                    )
                ),
        
                React.createElement('div', { className: 'mb-10' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-3' }, 'Farba textu názvu'),
                    React.createElement(
                        'div',
                        { className: 'flex gap-4' },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => setNewHeaderTextColor('#ffffff'),
                                className: `flex-1 px-5 py-3 rounded-lg border text-center font-medium transition-all ${
                                    newHeaderTextColor === '#ffffff'
                                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                        : 'border-gray-300 hover:bg-gray-50'
                                }`,
                                style: { backgroundColor: '#ffffff', color: '#000000' }
                            },
                            'Biela'
                        ),
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => setNewHeaderTextColor('#000000'),
                                className: `flex-1 px-5 py-3 rounded-lg border text-center font-medium transition-all ${
                                    newHeaderTextColor === '#000000'
                                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                        : 'border-gray-300 hover:bg-gray-50'
                                }`,
                                style: { backgroundColor: '#000000', color: '#ffffff' }
                            },
                            'Čierna'
                        )
                    )
                ),
        
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-4 mt-8' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setIsColorModalOpen(false),
                            className: 'px-6 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: saveHeaderColor,
                            className: 'px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition'
                        },
                        'Uložiť'
                    )
                )
            )
        ),

        isRemoveModalOpen &&
        React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]',
                onClick: (e) => { if (e.target === e.currentTarget) setIsRemoveModalOpen(false); }
            },
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4' },
                
                React.createElement(
                    'div',
                    { className: 'mb-6' },
                    React.createElement(
                        'div',
                        { className: 'mb-6' },
                        React.createElement(
                            'h3',
                            { className: 'text-xl font-bold text-gray-900 mb-2' },
                            'Odstrániť priradenie'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-600' },
                            [
                                'Odstrániť priradenie tímu ',
                                React.createElement(
                                    'span',
                                    { 
                                        key: 'team-name',
                                        className: 'font-bold text-gray-800' 
                                    },
                                    `${teamToRemove?.category}: ${teamToRemove?.teamName}`
                                ),
                                ' z\u00A0ubytovne ',
                                React.createElement(
                                    'span',
                                    { 
                                        key: 'accommodation-name',
                                        className: 'font-bold text-gray-800' 
                                    },
                                    teamToRemove?.assignedPlace
                                ),
                                '?'
                            ]
                        ),
                        React.createElement(
                            'div',
                            { className: 'mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg' },
                            React.createElement(
                                'p',
                                { className: 'text-sm text-yellow-700' },
                                React.createElement('strong', null, 'Upozornenie: '),
                                'tím sa odstráni z tejto ubytovne, ale zostane v systéme a bude možné ho priradiť do inej ubytovne.'
                            )
                        )
                    )
                ),
    
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-4 mt-8' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                setIsRemoveModalOpen(false);
                                setTeamToRemove(null);
                            },
                            disabled: isLoading,
                            className: 'px-6 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition disabled:opacity-50'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: removeTeamAssignment,
                            disabled: isLoading,
                            className: `px-6 py-2.5 text-white rounded-lg transition ${
                                !isLoading
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-red-400 cursor-not-allowed'
                            }`
                        },
                        isLoading
                            ? React.createElement(
                                'span',
                                { className: 'flex items-center gap-2' },
                                React.createElement('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-white' }),
                                'Odstraňujem...'
                            )
                            : 'Áno, odstrániť'
                    )
                )
            )
        ),
    
        isAssignModalOpen &&
        React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]',
                onClick: (e) => { if (e.target === e.currentTarget) setIsAssignModalOpen(false); }
            },
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4' },
                
                React.createElement(
                    'div',
                    { className: 'mb-6' },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-bold text-gray-900 inline' },
                        'Priradiť ubytovňu'
                    ),
                    React.createElement(
                        'span',
                        { className: 'text-lg font-medium text-gray-600 ml-2' },
                        `– ${selectedTeam?.category}: ${selectedTeam?.teamName}`
                    )
                ),
    
                React.createElement('div', { className: 'mb-6' },
                    React.createElement('p', { className: 'text-sm text-gray-600 mb-3' },
                        `Typ ubytovania tímu: ${selectedTeam?.accommodation}`
                    ),
                    React.createElement('p', { className: 'text-sm text-gray-600' },
                        `Počet osôb v tíme: ${selectedTeam?.totalPeople || 0}`
                    )
                ),
    
                React.createElement('div', { className: 'mb-8' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-3' }, 'Vyberte ubytovňu'),
                    isLoading
                        ? React.createElement(
                            'div',
                            { className: 'flex justify-center py-8' },
                            React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500' })
                        )
                        : availableAccommodations.length === 0
                            ? React.createElement(
                                'div',
                                { className: 'bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center' },
                                React.createElement('p', { className: 'text-yellow-700' },
                                    `Žiadne dostupné ubytovne pre typ "${selectedTeam?.accommodation}"`
                                )
                            )
                            : React.createElement(
                                'div',
                                { className: 'space-y-3' },
                                availableAccommodations.map(place => {
                                    const actualCapacity = getActualCapacity(place.id);
                                    const canAccommodate = place.capacity === null || 
                                        (actualCapacity.remaining !== null && actualCapacity.remaining >= (selectedTeam?.totalPeople || 0));
                                    
                                    return React.createElement(
                                        'div',
                                        { 
                                            key: place.id,
                                            className: `p-4 rounded-lg border cursor-pointer transition-all ${
                                                selectedAccommodationId === place.id
                                                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                                    : 'border-gray-300 hover:bg-gray-50'
                                            } ${
                                                !canAccommodate ? 'opacity-60 cursor-not-allowed' : ''
                                            }`
                                        },
                                        React.createElement(
                                            'div',
                                            { 
                                                className: 'flex items-start gap-3',
                                                onClick: () => canAccommodate && setSelectedAccommodationId(place.id)
                                            },
                                            React.createElement(
                                                'div',
                                                { 
                                                    className: `w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${
                                                        selectedAccommodationId === place.id
                                                            ? 'border-blue-500 bg-blue-500'
                                                            : 'border-gray-400'
                                                    }` 
                                                },
                                                selectedAccommodationId === place.id &&
                                                React.createElement(
                                                    'svg',
                                                    { 
                                                        className: 'w-3 h-3 text-white', 
                                                        fill: 'none', 
                                                        stroke: 'currentColor', 
                                                        viewBox: '0 0 24 24',
                                                        strokeWidth: '3'
                                                    },
                                                    React.createElement('path', {
                                                        strokeLinecap: 'round',
                                                        strokeLinejoin: 'round',
                                                        d: 'M5 13l4 4L19 7'
                                                    })
                                                )
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'flex-grow min-w-0' },
                                                React.createElement(
                                                    'div',
                                                    { 
                                                        className: 'font-medium text-gray-900 whitespace-nowrap overflow-visible',
                                                        style: { textOverflow: 'clip' }
                                                    },
                                                    place.name
                                                ),
                                                React.createElement(
                                                    'div',
                                                    { 
                                                        className: 'text-sm text-gray-600 mt-1 whitespace-nowrap overflow-visible',
                                                        style: { textOverflow: 'clip' }
                                                    },
                                                    `Typ: ${place.accommodationType || 'neurčený'}`
                                                ),
                                                place.capacity !== null && (
                                                    React.createElement(
                                                        'div',
                                                        { 
                                                            className: `text-sm font-medium mt-1 whitespace-nowrap overflow-visible ${
                                                                actualCapacity.remaining < 0 ? 'text-red-600' :
                                                                actualCapacity.remaining < (selectedTeam?.totalPeople || 0) ? 'text-orange-600' :
                                                                'text-green-600'
                                                            }`,
                                                            style: { textOverflow: 'clip' }
                                                        },
                                                        `Kapacita: ${actualCapacity.used}/${place.capacity} osôb`,
                                                        actualCapacity.remaining !== null && (
                                                            React.createElement(
                                                                'span',
                                                                { className: 'ml-2' },
                                                                actualCapacity.remaining >= 0 ? 
                                                                    `(zostáva ${actualCapacity.remaining} osôb)` :
                                                                    `(prekročená o ${Math.abs(actualCapacity.remaining)} osôb)`
                                                            )
                                                        )
                                                    )
                                                ),
                                                !canAccommodate && (
                                                    React.createElement(
                                                        'div',
                                                        { className: 'text-sm text-red-600 mt-1 font-medium whitespace-nowrap' },
                                                        `Nedostatočná kapacita pre tím (${selectedTeam?.totalPeople || 0} osôb)`
                                                    )
                                                )
                                            )
                                        )
                                    );
                                })
                            )
                ),
    
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-4 mt-8' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setIsAssignModalOpen(false),
                            disabled: isLoading,
                            className: 'px-6 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition disabled:opacity-50'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: saveAccommodationAssignment,
                            disabled: !selectedAccommodationId || isLoading,
                            className: `px-6 py-2.5 text-white rounded-lg transition ${
                                selectedAccommodationId && !isLoading
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-green-400 cursor-not-allowed'
                            }`
                        },
                        isLoading
                            ? React.createElement(
                                'span',
                                { className: 'flex items-center gap-2' },
                                React.createElement('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-white' }),
                                'Ukladám...'
                            )
                            : selectedTeam?.assignedPlace ? 'Zmeniť' : 'Priradiť'
                    )
                )
            )
        )
    );
}

const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');
    if (userProfileData) {
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            console.log("logged-in-teams-in-accomodation.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`E-mail rozdiel: auth → ${user.email} vs firestore → ${firestoreEmail}`);
                                await updateDoc(userProfileRef, { email: user.email });
                                await addDoc(collection(window.db, 'notifications'), {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });
                                window.showGlobalNotification('E-mail bol automaticky aktualizovaný.', 'success');
                            }
                        }
                    } catch (error) {
                        console.error("Chyba pri synchronizácii e-mailu:", error);
                        window.showGlobalNotification('Chyba pri synchronizácii e-mailu.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
            console.log("Aplikácia vykreslená (AddGroupsApp)");
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

console.log("logged-in-teams-in-accomodation.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

if (window.globalUserProfileData) {
    console.log("Globálne dáta už existujú → vykresľujem okamžite");
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

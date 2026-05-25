import { collection, getDocs, doc, getDoc, onSnapshot, updateDoc, Timestamp, addDoc, query, where, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect, useRef } = React;

const formatMatchDateTime = (timestamp) => {
    if (!timestamp) return null;
    try {
        const date = timestamp.toDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return { time: `${hours}:${minutes}`, dateObj: date };
    } catch (e) {
        return null;
    }
};

const formatDateHeader = (date) => {
    const days = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
    const dayName = days[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${dayName} ${day}. ${month}. ${year}`;
};

const ELIMINATION_COLORS = {
    backgroundColor: '#F3E8FF',
    textColor: '#6B21A5'
};

const REMOVAL_COLORS = {
    backgroundColor: '#FFEDD5',
    textColor: '#EA580C'
};

const getCategoryDrawColor = (categoryId) => {
    if (!window.categoryDrawColors || !categoryId) return '#3B82F6';
    
    const color = window.categoryDrawColors[categoryId];
    if (color && color !== '#3B82F6') return color;
    
    return '#3B82F6';
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

const getGroupTypeColors = (groupName, categoryId, groupsData) => {
    let result = {
        backgroundColor: '#DCFCE7',
        textColor: '#166534'
    };
    
    if (!groupsData || !categoryId) return result;
    
    const categoryGroups = groupsData[categoryId] || [];
    const foundGroup = categoryGroups.find(g => g.name === groupName);
    
    if (foundGroup) {
        if (foundGroup.type === 'nadstavbová skupina') {
            result = {
                backgroundColor: '#DBEAFE',
                textColor: '#1E40AF'
            };
        } else if (foundGroup.type === 'základná skupina') {
            result = {
                backgroundColor: '#DCFCE7',
                textColor: '#166534'
            };
        }
    }
    
    return result;
};

const isEliminationMatch = (match) => {
    if (match.isPlacementMatch) return true;
    
    if (match.matchType === 'Playoff' || match.matchType === 'Semifinále' || 
        match.matchType === 'Finále' || match.matchType === 'Štvrťfinále' ||
        match.matchType === 'Osemfinále' || (match.matchType && match.matchType.includes('finále')) ||
        (match.matchType && match.matchType.includes('miesto'))) {
        return true;
    }
    
    return false;
};

const getMatchColors = (match, groupsData) => {
    if (isEliminationMatch(match)) {
        return ELIMINATION_COLORS;
    }
    
    if (match.groupName && match.categoryId) {
        return getGroupTypeColors(match.groupName, match.categoryId, groupsData);
    }
    
    return {
        backgroundColor: '#DCFCE7',
        textColor: '#166534'
    };
};

const getDisplayTeamName = (teamIdentifier) => {
    if (!teamIdentifier) return '???';
    
    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
        const teamName = window.teamManager.getTeamNameByDisplayIdSync(teamIdentifier);
        if (teamName && teamName !== teamIdentifier) return teamName;
    }
    
    return teamIdentifier;
};

const updateTeamNamesInMatches = async (matchesList, setTeamNames, currentTeamNames) => {
    if (!window.matchTracker || typeof window.matchTracker.getTeamNameByDisplayId !== 'function') {
        return;
    }
    
    const updatedNames = {};
    let needsUpdate = false;    
    
    for (const match of matchesList) {
        let categoryName = match.categoryName;
        if (!categoryName && match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
            categoryName = window.categoriesData[match.categoryId];
        }
        
        if (!categoryName) {
            continue;
        }
        
        if (match.homeTeamIdentifier) {
            const currentDisplayName = currentTeamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
            
            if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                try {
                    const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                    if (newName && newName !== currentDisplayName && newName !== updatedNames[match.homeTeamIdentifier]) {
                        updatedNames[match.homeTeamIdentifier] = newName;
                        needsUpdate = true;
                    }
                } catch (err) {
                    console.error(`Chyba pri získavaní názvu pre domáci tím ${currentDisplayName}:`, err);
                }
            }
        }
        
        if (match.awayTeamIdentifier) {
            const currentDisplayName = currentTeamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
            
            if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                try {
                    const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                    if (newName && newName !== currentDisplayName && newName !== updatedNames[match.awayTeamIdentifier]) {
                        updatedNames[match.awayTeamIdentifier] = newName;
                        needsUpdate = true;
                    } 
                } catch (err) {
                    console.error(`Chyba pri získavaní názvu pre hosťujúci tím ${currentDisplayName}:`, err);
                }
            }
        }
    }
    
    if (needsUpdate) {
        setTeamNames(prev => ({ ...prev, ...updatedNames }));
    }
};

const getCategoryNameById = (categoryId) => {
    if (!categoryId) return null;
    
    if (window.categoriesData && window.categoriesData[categoryId]) {
        return window.categoriesData[categoryId];
    }
    
    if (window.categoriesList) {
        const found = window.categoriesList.find(cat => cat.id === categoryId);
        if (found) return found.name;
    }
    
    return null;
};

const loadTeamMembers = async (teamName, categoryName, onUpdate, onMappedName) => {
    if (!window.db || !teamName || !categoryName) {
        if (onUpdate) onUpdate([]);
        if (onMappedName) onMappedName(teamName);
        return () => {};
    }
    
    let actualTeamName = teamName;
    if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
        try {
            const convertedName = await window.matchTracker.getTeamNameByDisplayId(teamName);
            if (convertedName && convertedName !== teamName) {
                actualTeamName = convertedName;
                if (onMappedName) {
                    onMappedName(actualTeamName);
                }
            } else {
                if (onMappedName) {
                    onMappedName(teamName);
                }
            }
        } catch (err) {
            if (onMappedName) {
                onMappedName(teamName);
            }
        }
    } else {
        if (onMappedName) {
            onMappedName(teamName);
        }
    }
    
    const usersRef = collection(window.db, 'users');
    
    const unsubscribe = onSnapshot(usersRef, (usersSnapshot) => {
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const teams = userData.teams || {};
            
            for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                if (categoryKey !== categoryName) continue;
                
                const foundTeam = (teamsArray || []).find(t => t.teamName === actualTeamName);
                
                if (foundTeam) {
                    
                    const members = [];
                    
                    if (foundTeam.playerDetails && Array.isArray(foundTeam.playerDetails)) {
                        foundTeam.playerDetails.forEach((player, idx) => {
                            members.push({
                                type: 'Hráč',
                                firstName: player.firstName || '',
                                lastName: player.lastName || '',
                                jerseyNumber: player.jerseyNumber || '',
                                registrationNumber: player.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx 
                            });
                        });
                    }
                    
                    if (foundTeam.menTeamMemberDetails && Array.isArray(foundTeam.menTeamMemberDetails)) {
                        foundTeam.menTeamMemberDetails.forEach((member, idx) => {
                            members.push({
                                type: 'Člen RT (muž)',
                                firstName: member.firstName || '',
                                lastName: member.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: member.registrationNumber || '',
                                userId: userId, 
                                originalIndex: idx 
                            });
                        });
                    }
                    
                    if (foundTeam.womenTeamMemberDetails && Array.isArray(foundTeam.womenTeamMemberDetails)) {
                        foundTeam.womenTeamMemberDetails.forEach((member, idx) => {
                            members.push({
                                type: 'Člen RT (žena)',
                                firstName: member.firstName || '',
                                lastName: member.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: member.registrationNumber || '',
                                userId: userId, 
                                originalIndex: idx 
                            });
                        });
                    }
                    
                    if (foundTeam.driverDetailsMale && Array.isArray(foundTeam.driverDetailsMale)) {
                        foundTeam.driverDetailsMale.forEach((driver, idx) => {
                            members.push({
                                type: 'Šofér (muž)',
                                firstName: driver.firstName || '',
                                lastName: driver.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: driver.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx
                            });
                        });
                    }
                    
                    if (foundTeam.driverDetailsFemale && Array.isArray(foundTeam.driverDetailsFemale)) {
                        foundTeam.driverDetailsFemale.forEach((driver, idx) => {
                            members.push({
                                type: 'Šofér (žena)',
                                firstName: driver.firstName || '',
                                lastName: driver.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: driver.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx
                            });
                        });
                    }
                    
                    if (onUpdate) onUpdate(members);
                    return;
                }
            }
        }
        
        if (onUpdate) onUpdate([]);
    }, (error) => {
        if (onUpdate) onUpdate([]);
    });
    
    return unsubscribe;
};

const ExclusionTimer = ({ member, matchId, teamType, exclusionDuration, matchTimerRef, match }) => {
    const [exclusionEndTimeSeconds, setExclusionEndTimeSeconds] = useState(null);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [isExcluded, setIsExcluded] = useState(false);
    const [currentMatchTime, setCurrentMatchTime] = useState(0);
    const [periodDurationSec, setPeriodDurationSec] = useState(0);
    
    const memberRef = useRef(member);
    useEffect(() => {
        memberRef.current = member;
    }, [member]);
    
    useEffect(() => {
        if (matchTimerRef?.current) {
            const timer = matchTimerRef.current;
            if (timer.getPeriodDuration) {
                setPeriodDurationSec(timer.getPeriodDuration());
            }
        } else if (match?.periodDuration) {
            setPeriodDurationSec(match.periodDuration * 60);
        } else if (match?.categoryId && window.categoriesData) {
            const categoryId = match.categoryId;
            if (window.categorySettings && window.categorySettings[categoryId]) {
                setPeriodDurationSec(window.categorySettings[categoryId].periodDuration * 60);
            }
        }
    }, [matchTimerRef, match]);
    
    useEffect(() => {
        const updateMatchTime = () => {
            let totalTime = 0;
            
            if (matchTimerRef?.current) {
                const timer = matchTimerRef.current;
                if (timer.getTotalTime) {
                    totalTime = timer.getTotalTime();
                } else if (timer.getPeriodTime) {
                    const periodTime = timer.getPeriodTime();
                    const currentPeriod = timer.getCurrentPeriod ? timer.getCurrentPeriod() : 1;
                    totalTime = ((currentPeriod - 1) * periodDurationSec) + periodTime;
                }
            }
            
            if (totalTime === 0 && match) {
                if (match.manualTimeOffset) {
                    totalTime = match.manualTimeOffset;
                }
                if (match.currentPeriod && match.currentPeriod > 1) {
                    totalTime = ((match.currentPeriod - 1) * periodDurationSec) + (match.manualTimeOffset || 0);
                }
            }
            
            setCurrentMatchTime(totalTime);
        };
        
        updateMatchTime();
        
        const interval = setInterval(updateMatchTime, 100);
        
        if (window.db && matchId) {
            const matchRef = doc(window.db, 'matches', matchId);
            const unsubscribe = onSnapshot(matchRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.manualTimeOffset !== undefined) {
                        updateMatchTime();
                    }
                }
            });
            return () => {
                clearInterval(interval);
                unsubscribe();
            };
        }
        
        return () => clearInterval(interval);
    }, [matchTimerRef, match, matchId, periodDurationSec]);
    
    useEffect(() => {
        if (!window.db || !matchId || !member) return;
        
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('matchId', '==', matchId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let latestExclusion = null;
            let latestReentry = null;
            
            let targetTypeKey = member.dbArrayName;
            let targetIndex = member.originalIndex;
            
            if (!targetTypeKey) {
                if (member.type === 'Hráč') targetTypeKey = 'playerDetails';
                else if (member.type === 'Člen RT (muž)') targetTypeKey = 'menTeamMemberDetails';
                else if (member.type === 'Člen RT (žena)') targetTypeKey = 'womenTeamMemberDetails';
                targetIndex = member.originalIndex !== undefined ? member.originalIndex : 0;
            }
            
            snapshot.forEach((doc) => {
                const event = doc.data();
                
                if (event.team === teamType && 
                    event.memberTypeKey === targetTypeKey && 
                    event.memberIndex === targetIndex) {
                    
                    if (event.eventType === 'exclusion') {
                        if (!latestExclusion || (event.totalTime || 0) > (latestExclusion.totalTime || 0)) {
                            latestExclusion = {
                                totalTime: event.totalTime || 0,
                                period: event.period || 1,
                                docId: doc.id
                            };
                        }
                    } else if (event.eventType === 'reentry') {
                        if (!latestReentry || (event.totalTime || 0) > (latestReentry.totalTime || 0)) {
                            latestReentry = {
                                totalTime: event.totalTime || 0,
                                docId: doc.id
                            };
                        }
                    }
                }
            });
            
            if (latestExclusion && (!latestReentry || latestReentry.totalTime < latestExclusion.totalTime)) {
                const exclusionStart = latestExclusion.totalTime;
                const exclusionEnd = exclusionStart + (exclusionDuration * 60);
                setExclusionEndTimeSeconds(exclusionEnd);
                setIsExcluded(true);
            } else {
                setIsExcluded(false);
                setExclusionEndTimeSeconds(null);
            }
        });
        
        return () => unsubscribe();
    }, [matchId, teamType, member, exclusionDuration]);
    
    useEffect(() => {
        if (!isExcluded || exclusionEndTimeSeconds === null) {
            setRemainingSeconds(0);
            return;
        }
        
        const remaining = Math.max(0, exclusionEndTimeSeconds - currentMatchTime);
        setRemainingSeconds(remaining);
                
    }, [currentMatchTime, isExcluded, exclusionEndTimeSeconds]);
    
    if (!isExcluded || remainingSeconds <= 0) return null;
    
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const timeDisplay = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
    
    return React.createElement(
        'div',
        { className: 'mt-1 text-xs text-orange-600 bg-orange-50 rounded px-2 py-0.5 inline-block' },
        React.createElement('i', { className: 'fa-solid fa-hourglass-half mr-1' }),
        `Zostáva: ${timeDisplay}`
    );
};

const TeamMembersList = ({ teamName, categoryName, teamType, timerRef, onMappedNameUpdate, matchId, periodDuration: propPeriodDuration, blueCardSuspensions: propBlueCardSuspensions }) => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mappedName, setMappedName] = useState(teamName);
    const [membersStats, setMembersStats] = useState({});
    const [exclusionDuration, setExclusionDuration] = useState(2);
    const [matchData, setMatchData] = useState(null);
    const [excludedMembers, setExcludedMembers] = useState({});
    
    const [currentTotalTime, setCurrentTotalTime] = useState(0);
    const [periodLengthSeconds, setPeriodLengthSeconds] = useState(0); 
    const matchDataRef = useRef(matchData);
    const timerIntervalRef = useRef(null);

    const [rosterRemovals, setRosterRemovals] = useState({});
    const [matchStatus, setMatchStatusLocal] = useState(null);

    useEffect(() => {
        if (!window.db || !matchId) return;
        
        const removalsRef = collection(window.db, 'matchEvents');
        const q = query(removalsRef, where('matchId', '==', matchId), where('eventType', '==', 'roster_removal'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const removals = {};
            
            snapshot.forEach((doc) => {
                const event = doc.data();
                if (event.userId && event.memberTypeKey && event.memberIndex !== undefined) {
                    const key = `${event.userId}_${event.memberTypeKey}_${event.memberIndex}`;
                    removals[key] = {
                        isRemoved: true,
                        eventId: doc.id,
                        removedAt: event.totalTime || 0
                    };
                }
            });
            
            setRosterRemovals(removals);
        });
        
        return () => unsubscribe();
    }, [matchId]);
    
    useEffect(() => {
        if (!window.db || !matchId) return;
        
        const matchRef = doc(window.db, 'matches', matchId);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMatchData(data);
                
                if (data.status) {
                    setMatchStatusLocal(data.status);
                }
                
                if (propPeriodDuration) {
                    setPeriodLengthSeconds(propPeriodDuration * 60);
                }
                else if (data.periodDuration) {
                    setPeriodLengthSeconds(data.periodDuration * 60);
                } 
                else {
                    const categoryId = data.categoryId;
                    if (categoryId && window.categorySettings && window.categorySettings[categoryId]) {
                        const periodDuration = window.categorySettings[categoryId].periodDuration || 20;
                        setPeriodLengthSeconds(periodDuration * 60);
                    }
                }
            }
        });
    
        return () => unsubscribe();
    }, [matchId, propPeriodDuration]);
    
    useEffect(() => {
        matchDataRef.current = matchData;
    }, [matchData]);
    
    useEffect(() => {
        const updateGameTime = () => {
            const currentMatchData = matchDataRef.current;
            if (!currentMatchData) {
                return;
            }
            
            const periodLength = periodLengthSeconds;
            
            if (periodLength === 0) {
                return;
            }
            
            const currentPeriod = currentMatchData.currentPeriod || 1;
            
            let currentPeriodTime = currentMatchData.manualTimeOffset || 0;
            
            if (currentMatchData.status === 'in-progress' && currentMatchData.startedAt) {
                const elapsed = Math.floor((Date.now() - currentMatchData.startedAt.toDate().getTime()) / 1000);
                currentPeriodTime = (currentMatchData.manualTimeOffset || 0) + elapsed;
                if (currentPeriodTime > periodLength) {
                    currentPeriodTime = periodLength;
                }
            }
            
            const totalGameTime = ((currentPeriod - 1) * periodLength) + currentPeriodTime;
            
            setCurrentTotalTime(prev => {
                if (Math.abs(prev - totalGameTime) >= 0.5) {
                    return totalGameTime;
                }
                return prev;
            });
        };
        
        updateGameTime();
        
        const interval = setInterval(updateGameTime, 200);
        timerIntervalRef.current = interval;
        
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        };
    }, [matchId, periodLengthSeconds]);
    
    useEffect(() => {
        const loadExclusionSettings = async () => {
            if (!window.db || !matchId) return;
            
            try {
                const matchRef = doc(window.db, 'matches', matchId);
                const matchSnap = await getDoc(matchRef);
                if (matchSnap.exists()) {
                    const matchData = matchSnap.data();
                    const categoryId = matchData.categoryId;
                    
                    if (categoryId) {
                        const settingsRef = doc(window.db, 'settings', 'categories');
                        const settingsSnap = await getDoc(settingsRef);
                        if (settingsSnap.exists()) {
                            const categoryData = settingsSnap.data()[categoryId];
                            if (categoryData && categoryData.exclusionTime) {
                                setExclusionDuration(categoryData.exclusionTime);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Chyba pri načítaní nastavení vylúčenia:', err);
            }
        };
        
        loadExclusionSettings();
    }, [matchId]);
    
    useEffect(() => {
        if (!window.db || !matchId || members.length === 0) {
            return;
        }
        
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('matchId', '==', matchId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const excluded = {};
            const currentMatchData = matchDataRef.current;
            const periodLength = periodLengthSeconds || (currentMatchData?.periodDuration * 60) || 1200;
            
            const currentPeriod = currentMatchData?.currentPeriod || 1;
            
            members.forEach((member) => {
                const uniqueKey = `${member.type}_${member.originalIndex}`;
                
                let targetTypeKey = member.dbArrayName;
                let targetIndex = member.originalIndex;
                
                if (!targetTypeKey) {
                    if (member.type === 'Hráč') targetTypeKey = 'playerDetails';
                    else if (member.type === 'Člen RT (muž)') targetTypeKey = 'menTeamMemberDetails';
                    else if (member.type === 'Člen RT (žena)') targetTypeKey = 'womenTeamMemberDetails';
                    targetIndex = member.originalIndex !== undefined ? member.originalIndex : 0;
                }
                
                const exclusions = [];
                
                snapshot.forEach((doc) => {
                    const event = doc.data();
                    
                    if (event.team === teamType && 
                        event.memberTypeKey === targetTypeKey && 
                        event.memberIndex === targetIndex &&
                        event.eventType === 'exclusion') {
                        
                        const exclusionTotalTime = event.totalTime || 0;
                        
                        let exclusionPeriod = event.period || 1;
                        if (!event.period && periodLength > 0) {
                            exclusionPeriod = Math.floor(exclusionTotalTime / periodLength) + 1;
                        }
                        
                        exclusions.push({
                            totalTime: exclusionTotalTime,
                            period: exclusionPeriod,
                            docId: doc.id
                        });
                    }
                });
                
                exclusions.sort((a, b) => a.totalTime - b.totalTime);
                
                if (exclusions.length === 0) {
                    excluded[uniqueKey] = { isExcluded: false, remainingSeconds: 0, endTotalTime: 0 };
                    return;
                }
                
                let totalPenaltyEndTotalTime = 0;
                const penaltyDurationSec = exclusionDuration * 60;
                
                for (let i = 0; i < exclusions.length; i++) {
                    const exclusion = exclusions[i];
                    const exclusionStartTotalTime = exclusion.totalTime;
                    
                    if (exclusionStartTotalTime >= totalPenaltyEndTotalTime) {
                        totalPenaltyEndTotalTime = exclusionStartTotalTime + penaltyDurationSec;
                    } else {
                        totalPenaltyEndTotalTime = totalPenaltyEndTotalTime + penaltyDurationSec;
                    }
                }
                
                const isCurrentlyExcluded = currentTotalTime < totalPenaltyEndTotalTime;
                
                if (isCurrentlyExcluded) {
                    const remainingTotalSeconds = Math.max(0, Math.ceil(totalPenaltyEndTotalTime - currentTotalTime));
                    
                    const currentPeriodNum = currentPeriod;
                    const timeInCurrentPeriod = currentTotalTime - ((currentPeriodNum - 1) * periodLength);
                    
                    const endPeriod = Math.floor(totalPenaltyEndTotalTime / periodLength);
                    const timeInEndPeriod = totalPenaltyEndTotalTime - (endPeriod * periodLength);
                    
                    let displayRemainingSeconds = remainingTotalSeconds;
                    
                    if (endPeriod > currentPeriodNum - 1) {
                        displayRemainingSeconds = remainingTotalSeconds;
                    } else if (endPeriod === currentPeriodNum - 1) {
                        displayRemainingSeconds = remainingTotalSeconds;
                    } else {
                        displayRemainingSeconds = remainingTotalSeconds;
                    }
                    
                    excluded[uniqueKey] = {
                        isExcluded: true,
                        remainingSeconds: displayRemainingSeconds,
                        endTotalTime: totalPenaltyEndTotalTime,
                        exclusionCount: exclusions.length
                    };                    
                } else {
                    excluded[uniqueKey] = { 
                        isExcluded: false, 
                        remainingSeconds: 0, 
                        endTotalTime: 0 
                    };
                }
            });
            
            setExcludedMembers(excluded);
        });
        
        return () => unsubscribe();
    }, [matchId, teamType, members, exclusionDuration, currentTotalTime, periodLengthSeconds, matchDataRef.current?.currentPeriod]);
    
    useEffect(() => {
        setLoading(true);
        setError(null);
        
        if (!teamName || !categoryName) {
            setLoading(false);
            return;
        }
        
        const handleMembersUpdate = (updatedMembers) => {
            const filteredMembers = updatedMembers.filter(m => m.type === 'Hráč' || m.type === 'Člen RT (muž)' || m.type === 'Člen RT (žena)');
            const rtMembers = filteredMembers.filter(m => m.type !== 'Hráč');
            const players = filteredMembers.filter(m => m.type === 'Hráč');
            const sortedMembers = [...rtMembers, ...players];
    
            const membersWithOriginalIndex = sortedMembers.map((member, displayIdx) => {
                let originalIndex = member.originalIndex !== undefined ? member.originalIndex : displayIdx;
                
                return {
                    ...member,
                    originalIndex: originalIndex,
                    dbArrayName: member.type === 'Hráč' ? 'playerDetails' : 
                                (member.type === 'Člen RT (muž)' ? 'menTeamMemberDetails' : 'womenTeamMemberDetails'),
                    userId: member.userId || null 
                };
            });
            
            setMembers(membersWithOriginalIndex);
            setLoading(false);
        };
        
        const handleMappedName = (newMappedName) => {
            if (newMappedName !== mappedName) {
                setMappedName(newMappedName);
                if (onMappedNameUpdate && typeof onMappedNameUpdate === 'function') {
                    onMappedNameUpdate(newMappedName);
                }
            }
        };
        
        const unsubscribe = loadTeamMembers(teamName, categoryName, handleMembersUpdate, handleMappedName);
        const timeoutId = setTimeout(() => setLoading(false), 5000);
        
        return () => {
            clearTimeout(timeoutId);
            if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
        };
    }, [teamName, categoryName]);
    
    useEffect(() => {
        if (!window.db || !matchId) return;
        
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('matchId', '==', matchId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newStats = {};
            
            members.forEach((member, idx) => {
                const memberKey = `${member.type}_${member.originalIndex}`;
                newStats[memberKey] = {
                    goals: 0,
                    convertedPenalties: 0,
                    missedPenalties: 0,
                    yellowCards: 0,
                    redCards: 0,
                    blueCards: 0,
                    exclusions: 0,
                    dbArrayName: member.dbArrayName,
                    dbIndex: member.originalIndex,
                    name: `${member.firstName} ${member.lastName}`.trim(),
                    jerseyNumber: member.jerseyNumber || '',
                    memberType: member.type
                };
            });
            
            snapshot.forEach((doc) => {
                const event = doc.data();
                if (event.team !== teamType) return;
                
                let foundMemberKey = null;
                for (const [memberKey, stat] of Object.entries(newStats)) {
                    if (stat.dbArrayName === event.memberTypeKey && stat.dbIndex === event.memberIndex) {
                        foundMemberKey = memberKey;
                        break;
                    }
                }
                
                if (!foundMemberKey) return;
                const stat = newStats[foundMemberKey];
                
                switch (event.eventType) {
                    case 'goal':
                        stat.goals++;
                        if (event.eventSubtype === 'converted_penalty') {
                            stat.convertedPenalties++;
                        }
                        break;
                    case 'penalty':
                        stat.missedPenalties++;
                        break;
                    case 'card':
                        if (event.eventSubtype === 'yellow') stat.yellowCards++;
                        else if (event.eventSubtype === 'red') stat.redCards++;
                        else if (event.eventSubtype === 'blue') stat.blueCards++;
                        break;
                    case 'exclusion':
                        stat.exclusions++;
                        break;
                }
            });
            
            setMembersStats(newStats);
        });
        
        return () => unsubscribe();
    }, [matchId, teamType, members]);

    const isPlayerSuspendedByBlueCard = (member) => {
        const suspensions = propBlueCardSuspensions || window.blueCardSuspensions;
        if (!suspensions) return false;

        const userId = member.userId;
        const dbArrayName = member.dbArrayName || (member.type === 'Hráč' ? 'playerDetails' : 
                              (member.type === 'Člen RT (muž)' ? 'menTeamMemberDetails' : 'womenTeamMemberDetails'));
        const originalIndex = member.originalIndex !== undefined ? member.originalIndex : 0;
        
        if (!userId) {
            return false;
        }
        
        const playerKey = `${userId}_${dbArrayName}_${originalIndex}`;
        const suspension = suspensions[playerKey];
        
        if (suspension && suspension.isExcludedByBlueCard) {
            return true;
        }
        return false;
    };

    const isPlayerRemovedFromRoster = (member, matchId, removals) => {
        if (!removals || !matchId) return false;
    
        const userId = member.userId;
        const dbArrayName = member.dbArrayName || (member.type === 'Hráč' ? 'playerDetails' : 
                              (member.type === 'Člen RT (muž)' ? 'menTeamMemberDetails' : 'womenTeamMemberDetails'));
        const originalIndex = member.originalIndex !== undefined ? member.originalIndex : 0;
    
        if (!userId) return false;
        
        const memberKey = `${userId}_${dbArrayName}_${originalIndex}`;
        const removal = removals[memberKey];
        
        if (removal && removal.isRemoved) {
            return true;
        }
        return false;
    };
    
    const getMemberIcon = (memberType) => {
        if (memberType === 'Hráč') {
            return React.createElement('i', { className: 'fa-solid fa-user text-gray-500 mr-2', style: { width: '16px' } });
        } else if (memberType === 'Člen RT (muž)') {
            return React.createElement('i', { className: 'fa-solid fa-user-tie text-blue-500 mr-2', style: { width: '16px' } });
        } else if (memberType === 'Člen RT (žena)') {
            return React.createElement('i', { className: 'fa-solid fa-user-tie text-red-500 mr-2', style: { width: '16px' } });
        }
        return React.createElement('i', { className: 'fa-solid fa-user text-gray-500 mr-2', style: { width: '16px' } });
    };
    
    const getMemberStats = (member) => {
        const memberKey = `${member.type}_${member.originalIndex}`;
        const stats = membersStats[memberKey];
        if (!stats) {
            return {
                goals: 0,
                convertedPenalties: 0,
                missedPenalties: 0,
                yellowCards: 0,
                redCards: 0,
                blueCards: 0,
                exclusions: 0
            };
        }
        return stats;
    };
    
    const handleMemberClick = async (member) => {
        if (!timerRef) {
            return;
        }
        
        const isSuspendedByBlue = isPlayerSuspendedByBlueCard(member);
        if (isSuspendedByBlue) {
            return;
        }
        
        const timerCurrent = timerRef.current;
        let selectedActionsSet = new Set();
        
        if (timerCurrent && typeof timerCurrent.getSelectedActions === 'function') {
            const actions = timerCurrent.getSelectedActions();
            if (actions && actions.size > 0) {
                selectedActionsSet = actions;
            }
        } 
        else if (timerCurrent && typeof timerCurrent.getSelectedAction === 'function') {
            const action = timerCurrent.getSelectedAction();
            if (action) {
                selectedActionsSet.add(action);
            }
        } else if (typeof timerRef.getSelectedAction === 'function') {
            const action = timerRef.getSelectedAction();
            if (action) {
                selectedActionsSet.add(action);
            }
        }
        
        if (selectedActionsSet.size === 0 && matchStatus === 'scheduled') {
            const isRemoved = isPlayerRemovedFromRoster(member, matchId, rosterRemovals);
            
            if (isRemoved) {
                const memberKey = `${member.userId}_${member.dbArrayName}_${member.originalIndex}`;
                const removalEvent = rosterRemovals[memberKey];
                
                if (removalEvent && removalEvent.eventId && window.db) {
                    try {
                        const eventRef = doc(window.db, 'matchEvents', removalEvent.eventId);
                        await deleteDoc(eventRef);
                    } catch (err) {
                        console.error('Chyba pri rušení odstránenia:', err);
                    }
                }
            } else {
                if (window.db && matchId) {
                    try {
                        const eventData = {
                            matchId: matchId,
                            totalTime: 0,
                            periodTime: 0,
                            period: 1,
                            eventType: 'roster_removal',
                            eventSubtype: null,
                            team: teamType,
                            memberType: member.type,
                            memberTypeKey: member.dbArrayName,
                            memberIndex: member.originalIndex,
                            userId: member.userId,
                            categoryName: categoryName,
                            createdAt: Timestamp.now(),
                            timestamp: Timestamp.now()
                        };
                        
                        const eventsRef = collection(window.db, 'matchEvents');
                        await addDoc(eventsRef, eventData);
                    } catch (err) {
                        console.error('Chyba pri ukladaní odstránenia člena:', err);
                    }
                }
            }
            return;
        }        
        
        if (selectedActionsSet.has('goal') && member.type !== 'Hráč') {
            return;
        }
        
        if (selectedActionsSet.has('7m') && member.type !== 'Hráč') {
            return;
        }
        
        const uniqueKey = `${member.type}_${member.originalIndex}`;
        const exclusionInfo = excludedMembers[uniqueKey];
        if (exclusionInfo && exclusionInfo.isExcluded) {
            if (selectedActionsSet.has('goal')) {
                return;
            }
            if (selectedActionsSet.has('7m')) {
                return;
            }
        }
        
        if (selectedActionsSet.size === 0) {
            return;
        }
        
        const memberForSave = {
            type: member.type,
            name: `${member.firstName} ${member.lastName}`.trim(),
            index: member.originalIndex,
            typeKey: member.dbArrayName
        };
        
        let success = false;
        
        if (timerCurrent && typeof timerCurrent.saveMatchEvent === 'function') {
            success = await timerCurrent.saveMatchEvent(teamType, memberForSave);
        } else if (typeof timerRef.saveMatchEvent === 'function') {
            success = await timerRef.saveMatchEvent(teamType, memberForSave);
        }        
    };
    
    if (loading) {
        return React.createElement(
            'div',
            { className: 'bg-white rounded-lg border border-gray-200 p-4 h-full' },
            React.createElement(
                'div',
                { className: 'text-center py-4' },
                React.createElement('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto' }),
                React.createElement('p', { className: 'text-xs text-gray-400 mt-2' }, 'Načítavam členov...')
            )
        );
    }
    
    if (error) {
        return React.createElement(
            'div',
            { className: 'bg-white rounded-lg border border-gray-200 p-4 h-full' },
            React.createElement(
                'div',
                { className: 'text-center py-4 text-red-500 text-sm' },
                'Nepodarilo sa načítať členov tímu'
            )
        );
    }
    
    const displayTeamName = mappedName !== teamName ? mappedName : teamName;
    
    const sortedPlayers = [...members.filter(m => m.type === 'Hráč')].sort((a, b) => {
        const aNum = parseInt(a.jerseyNumber) || 999;
        const bNum = parseInt(b.jerseyNumber) || 999;
        return aNum - bNum;
    });
    const rtMembers = members.filter(m => m.type !== 'Hráč');
    const allMembersSorted = [...sortedPlayers, ...rtMembers];
    
    return React.createElement(
        'div',
        { className: 'bg-white rounded-lg border border-gray-200 overflow-hidden h-full' },
        React.createElement(
            'div',
            { className: 'bg-gray-50 px-4 py-2 border-b border-gray-200' },
            React.createElement('h3', { className: 'font-semibold text-gray-800' }, displayTeamName),
            React.createElement('p', { className: 'text-xs text-gray-500 mt-0.5' }, 'Spolu: ' + members.length + ' členov')
        ),
        React.createElement(
            'div',
            { className: 'overflow-x-auto' },
            React.createElement(
                'table',
                { className: 'min-w-full text-sm' },
                React.createElement(
                    'thead',
                    { className: 'bg-gray-100 sticky top-0' },
                    React.createElement(
                        'tr',
                        { className: 'border-b border-gray-200' },
                        React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500', style: { width: '30px' } }, ''),
                        React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500' }, ''),
                        React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500' }, 'Meno a priezvisko'),
                        React.createElement('th', { className: 'px-2 py-2 text-center text-xs font-medium text-gray-500', style: { width: '45px' } }, 
                            React.createElement('div', { className: 'flex flex-col items-center' },
                                React.createElement('i', { className: 'fa-solid fa-futbol text-green-600 text-sm' }),
                                React.createElement('span', { className: 'text-xs mt-0.5' }, 'Gól')
                            )
                        ),
                        React.createElement('th', { className: 'px-2 py-2 text-center text-xs font-medium text-gray-500', style: { width: '55px' } }, 
                            React.createElement('div', { className: 'flex flex-col items-center' },
                                React.createElement('i', { className: 'fa-solid fa-futbol text-teal-500 text-sm' }),
                                React.createElement('span', { className: 'text-xs mt-0.5' }, '7m')
                            )
                        ),
                        React.createElement('th', { className: 'px-2 py-2 text-center text-xs font-medium text-gray-500', style: { width: '45px' } }, 
                            React.createElement('div', { className: 'flex flex-col items-center' },
                                React.createElement('i', { className: 'fa-solid fa-square text-yellow-500 text-sm' }),
                                React.createElement('span', { className: 'text-xs mt-0.5' }, 'ŽK')
                            )
                        ),
                        React.createElement('th', { className: 'px-2 py-2 text-center text-xs font-medium text-gray-500', style: { width: '45px' } }, 
                            React.createElement('div', { className: 'flex flex-col items-center' },
                                React.createElement('i', { className: 'fa-solid fa-square text-red-600 text-sm' }),
                                React.createElement('span', { className: 'text-xs mt-0.5' }, 'ČK')
                            )
                        ),
                        React.createElement('th', { className: 'px-2 py-2 text-center text-xs font-medium text-gray-500', style: { width: '45px' } }, 
                            React.createElement('div', { className: 'flex flex-col items-center' },
                                React.createElement('i', { className: 'fa-solid fa-square text-blue-500 text-sm' }),
                                React.createElement('span', { className: 'text-xs mt-0.5' }, 'MK')
                            )
                        ),
                        React.createElement('th', { className: 'px-2 py-2 text-center text-xs font-medium text-gray-500', style: { width: '55px' } }, 
                            React.createElement('div', { className: 'flex flex-col items-center' },
                                React.createElement('i', { className: 'fa-solid fa-clock text-orange-500 text-sm' }),
                                React.createElement('span', { className: 'text-xs mt-0.5' }, 'Vylúč.')
                            )
                        )
                    )
                ),
                React.createElement(
                    'tbody',
                    { className: 'divide-y divide-gray-100' },
                    allMembersSorted.map((member, idx) => {
                        const stats = getMemberStats(member);
                        const fullName = (member.firstName + ' ' + member.lastName).trim() || 'Neznámy';
                        const jerseyDisplay = member.jerseyNumber || '';
                        
                        const memberIcon = member.type === 'Hráč' 
                            ? React.createElement('i', { className: 'fa-solid fa-user text-gray-500 text-sm' })
                            : (member.type === 'Člen RT (muž)' 
                                ? React.createElement('i', { className: 'fa-solid fa-user-tie text-blue-500 text-sm' })
                                : React.createElement('i', { className: 'fa-solid fa-user-tie text-red-500 text-sm' }));
                        
                        const totalPenalties = stats.convertedPenalties + stats.missedPenalties;
                        const penaltiesDisplay = totalPenalties > 0 ? `${stats.convertedPenalties}/${totalPenalties}` : '';
                        
                        const uniqueKey = `${member.type}_${member.originalIndex}`;
                        const exclusionInfo = excludedMembers[uniqueKey];

                        const isRemovedFromRoster = isPlayerRemovedFromRoster(member, matchId, rosterRemovals);
                        const isSuspendedByBlue = isPlayerSuspendedByBlueCard(member);
                        const isExcludedNormally = exclusionInfo?.isExcluded === true && (exclusionInfo?.remainingSeconds || 0) > 0;
                        const isExcluded = isRemovedFromRoster || isExcludedNormally || isSuspendedByBlue;
                        
                        let exclusionDisplayRow = null;

                        let isClickable = !isSuspendedByBlue;
                        if (isRemovedFromRoster) {
                            isClickable = matchStatus === 'scheduled';
                        } else {
                            isClickable = matchStatus !== 'completed';
                        }
                        
                        const cursorClass = isClickable ? 'cursor-pointer' : 'cursor-not-allowed';
                        let rowClassName = `hover:bg-gray-50 transition-colors ${cursorClass}`;
                        if (isExcluded) {
                            if (isRemovedFromRoster) {
                                rowClassName = `hover:bg-orange-50 transition-colors ${cursorClass} opacity-80 bg-orange-100`;
                            } else {
                                rowClassName = `hover:bg-gray-50 transition-colors ${cursorClass} opacity-60 bg-gray-100`;
                            }
                        }
                        
                        if (isRemovedFromRoster) {
                            exclusionDisplayRow = React.createElement(
                                'tr',
                                { key: `removal-${idx}`, className: 'bg-orange-100' },
                                React.createElement('td', { colSpan: 9, className: 'px-2 py-1 text-center' },
                                    React.createElement(
                                        'div',
                                        { className: 'text-xs text-orange-700 font-medium flex items-center justify-center gap-1' },
                                        React.createElement('i', { className: 'fa-solid fa-user-slash' }),
                                        React.createElement('span', {}, 'Pre tento zápas odstránený zo súpisky')
                                    )
                                )
                            );
                        } else if (isExcludedNormally) {
                            const remainingSeconds = exclusionInfo.remainingSeconds;
                            const mins = Math.floor(remainingSeconds / 60);
                            const secs = remainingSeconds % 60;
                            const timeDisplay = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
                            
                            exclusionDisplayRow = React.createElement(
                                'tr',
                                { key: `exclusion-${idx}`, className: 'bg-orange-50' },
                                React.createElement('td', { colSpan: 9, className: 'px-2 py-1 text-center' },
                                    React.createElement(
                                        'div',
                                        { className: 'text-xs text-orange-600 font-medium flex items-center justify-center gap-1' },
                                        React.createElement('i', { className: 'fa-solid fa-hourglass-half' }),
                                        React.createElement('span', {}, `Zostáva: ${timeDisplay}`)
                                    )
                                )
                            );
                        } else if (isSuspendedByBlue) {
                            const suspensions = propBlueCardSuspensions || window.blueCardSuspensions;
                            const blueInfo = suspensions?.[`${member.userId || ''}_${member.dbArrayName || ''}_${member.originalIndex || 0}`];
                            const remainingMatches = blueInfo?.remainingMatches || 0;
                            
                            exclusionDisplayRow = React.createElement(
                                'tr',
                                { key: `blue-suspension-${idx}`, className: 'bg-blue-50' },
                                React.createElement('td', { colSpan: 9, className: 'px-2 py-1 text-center' },
                                    React.createElement(
                                        'div',
                                        { className: 'text-xs text-blue-600 font-medium flex items-center justify-center gap-1' },
                                        React.createElement('i', { className: 'fa-solid fa-ban' }),
                                        React.createElement('span', {}, `Vylúčenie za modrú kartu v predchádzajúcom zápase.`)
                                    )
                                )
                            );
                        }
                        
                        const mainRow = React.createElement(
                            'tr',
                            { 
                                key: `member-${idx}`,
                                className: rowClassName,
                                onClick: () => {
                                    if (isRemovedFromRoster && matchStatus === 'scheduled') {
                                        handleMemberClick(member);
                                    } else if (isClickable && !isRemovedFromRoster) {
                                        handleMemberClick(member);
                                    }
                                }
                            },
                            React.createElement('td', { className: 'px-2 py-2 text-center' }, memberIcon),
                            React.createElement('td', { className: 'px-2 py-2 font-mono font-medium text-gray-700 text-center' }, jerseyDisplay || ''),
                            React.createElement('td', { className: 'px-2 py-2 text-gray-800' }, fullName),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-green-600' }, stats.goals > 0 ? stats.goals : ''),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-medium text-teal-600' }, penaltiesDisplay),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-yellow-600' }, stats.yellowCards > 0 ? stats.yellowCards : ''),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-red-600' }, stats.redCards > 0 ? stats.redCards : ''),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-blue-600' }, stats.blueCards > 0 ? stats.blueCards : ''),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-orange-600' }, stats.exclusions > 0 ? stats.exclusions : '')
                        );
                        
                        if (exclusionDisplayRow) {
                            return React.createElement(React.Fragment, { key: `fragment-${idx}` }, mainRow, exclusionDisplayRow);
                        }
                        return mainRow;
                    })
                )
            )
        ),
        members.length === 0 && React.createElement(
            'div',
            { className: 'text-center py-8 text-gray-400 text-sm' },
            'Žiadni členovia tímu'
        )
    );
};

const MatchTimer = React.forwardRef(({ match, matchId, onTimeUpdate, categorySettings, teamNames, onActionSelected, selectedAction: externalSelectedAction }, ref) => {
    const [isRunning, setIsRunning] = useState(false);
    const [period, setPeriod] = useState(1);
    const [totalPeriods, setTotalPeriods] = useState(1);
    const [periodDuration, setPeriodDuration] = useState(20);
    const [displaySeconds, setDisplaySeconds] = useState(0);
    const [showEndMatchModal, setShowEndMatchModal] = useState(false);
    const [showForfeitModal, setShowForfeitModal] = useState(false);
    const [forfeitTeam, setForfeitTeam] = useState(null);
    const [selectedForfeitTeam, setSelectedForfeitTeam] = useState(null);
    const [showManualResultModal, setShowManualResultModal] = useState(false);
    const [manualHomeScore, setManualHomeScore] = useState('');
    const [manualAwayScore, setManualAwayScore] = useState('');
    const [modalLoadingMapping, setModalLoadingMapping] = useState(false);

    const [selectedAction, setSelectedAction] = useState(externalSelectedAction || null);
    const [matchEvents, setMatchEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    const [selectedActions, setSelectedActions] = useState(new Set());
    const [externalActionSync, setExternalActionSync] = useState(null);

    const [showResetModal, setShowResetModal] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    
    const intervalRef = useRef(null);
    const isRunningRef = useRef(false);
    const startTimeRef = useRef(null);
    const localStartOffsetRef = useRef(0);
    const periodDurationRef = useRef(periodDuration);
    const totalPeriodsRef = useRef(totalPeriods);
    const periodRef = useRef(period);
    const lastServerUpdateRef = useRef(0);
    const displaySecondsRef = useRef(0);
    
    const matchTimerRef = useRef(null);

    const [editingMode, setEditingMode] = React.useState(false);
    const [editingEvent, setEditingEvent] = React.useState(null);

    useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
    useEffect(() => { periodDurationRef.current = periodDuration; }, [periodDuration]);
    useEffect(() => { totalPeriodsRef.current = totalPeriods; }, [totalPeriods]);
    useEffect(() => { periodRef.current = period; }, [period]);
    useEffect(() => { displaySecondsRef.current = displaySeconds; }, [displaySeconds]);

    const handleResetConfirm = async () => {
        setResetLoading(true);
        try {
            if (isRunningRef.current) {
                stopLocalInterval();
                setIsRunning(false);
                isRunningRef.current = false;
            }

            if (isRunningRef.current) {
                await stopTimerAndSave();
            }
    
            await resetTime();
            
            setShowResetModal(false);
        } catch (err) {
            console.error('Chyba pri resetovaní:', err);
        } finally {
            setResetLoading(false);
        }
    };

    const getPeriodTime = (totalSeconds) => {
        return totalSeconds;
    };

    const getTotalTime = () => {
        return calculateTotalMatchTime();
    };

    const isEndOfPeriod = () => {
        const periodLength = periodDuration * 60;
        return displaySeconds >= periodLength;
    };

    const isEndOfMatch = () => {
        return period > totalPeriods;
    };

    useEffect(() => {
        if (onActionSelected && typeof onActionSelected === 'function') {
            const singleAction = selectedActions.size === 1 ? Array.from(selectedActions)[0] : null;
            onActionSelected(singleAction);
        }
    }, [selectedActions, onActionSelected]);

    useEffect(() => {
        if (externalSelectedAction !== undefined && externalSelectedAction !== externalActionSync) {
            setExternalActionSync(externalSelectedAction);
            if (externalSelectedAction) {
                setSelectedActions(prev => new Set([...prev, externalSelectedAction]));
            } else {
                setSelectedActions(new Set());
            }
        }
    }, [externalSelectedAction]);

    useEffect(() => {
        if (onActionSelected && typeof onActionSelected === 'function') {
            onActionSelected(selectedAction);
        }
    }, [selectedAction, onActionSelected]);

    useEffect(() => {
        if (externalSelectedAction !== undefined && externalSelectedAction !== selectedAction) {
            setSelectedAction(externalSelectedAction);
        }
    }, [externalSelectedAction]);

    const handleActionClick = (action) => {
        setSelectedActions(prev => {
            if (action === '7m' && prev.has('goal')) {
                const newSet = new Set();
                newSet.add('7m');
                return newSet;
            }
            
            if (action === 'goal' && prev.has('7m')) {
                const newSet = new Set(prev);
                newSet.add('goal');
                return newSet;
            }
            
            const newSet = new Set();
            
            if (prev.has(action)) {
                return newSet;
            }
            
            newSet.add(action);
            return newSet;
        });
    };

    const isActionSelected = (action) => {
        return selectedActions.has(action);
    };

    const getActionButtonClass = (action) => {
        const baseClass = "px-5 py-2 rounded-lg font-semibold transition-colors text-sm cursor-pointer";
        const isActive = isActionSelected(action);
        
        const colorStyles = {
            goal: { bg: "bg-green-500", hover: "hover:bg-green-600", border: "border-green-500", text: "text-green-600" },
            '7m': { bg: "bg-teal-500", hover: "hover:bg-teal-600", border: "border-teal-500", text: "text-teal-600" },
            yellow: { bg: "bg-yellow-500", hover: "hover:bg-yellow-600", border: "border-yellow-500", text: "text-yellow-600" },
            red: { bg: "bg-red-600", hover: "hover:bg-red-700", border: "border-red-600", text: "text-red-700" },
            blue: { bg: "bg-blue-400", hover: "hover:bg-blue-500", border: "border-blue-500", text: "text-blue-600" },
            exclusion: { bg: "bg-orange-500", hover: "hover:bg-orange-600", border: "border-orange-500", text: "text-orange-600" }
        };
    
        const style = colorStyles[action];
        
        if (isActive) {
            return `${baseClass} ${style.bg} ${style.hover} text-white`;
        } else {
            return `${baseClass} bg-white border-2 ${style.border} ${style.text} hover:bg-gray-50`;
        }
    };

    const loadMatchEvents = async () => {
        if (!window.db || !matchId) return;
        
        try {
            const eventsRef = collection(window.db, 'matchEvents');
            const q = query(eventsRef, where('matchId', '==', matchId), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            const events = [];
            querySnapshot.forEach((doc) => {
                events.push({ id: doc.id, ...doc.data() });
            });
            setMatchEvents(events);
        } catch (err) {
            console.error('Chyba pri načítaní udalostí:', err);
        } finally {
            setEventsLoading(false);
        }
    };

    useEffect(() => {
        if (!window.db || !matchId) return;
        
        loadMatchEvents();
        
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('matchId', '==', matchId), orderBy('timestamp', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const events = [];
            snapshot.forEach((doc) => {
                events.push({ id: doc.id, ...doc.data() });
            });
            setMatchEvents(events);
            setEventsLoading(false);
        }, (error) => {
            setEventsLoading(false);
        });
        
        return () => unsubscribe();
    }, [matchId]);

    const calculateTotalMatchTime = () => {
        const periodLengthSeconds = periodDuration * 60;
        const currentPeriodTime = displaySeconds;

        let totalTime = currentPeriodTime;
        if (period > 1) {
            totalTime = ((period - 1) * periodLengthSeconds) + currentPeriodTime;
        }
        
        return totalTime;
    };

    const saveMatchEventInternalWithAction = async (teamType, member, action) => {
        if (editingMode && editingEvent) {
            if (window.onEventEdited && typeof window.onEventEdited === 'function') {
                const success = await window.onEventEdited(teamType, member, editingEvent.id);
                if (success) {
                    setEditingMode(false);
                    setEditingEvent(null);
                    setSelectedActions(new Set());
                }
                return success;
            }
            return false;
        }
        if (selectedActions.size === 0 || !window.db || !matchId) {
            return false;
        }
        
        if (selectedActions.has('goal') && member.type !== 'Hráč') {
            return false;
        }
        
        if (selectedActions.has('7m') && member.type !== 'Hráč') {
            return false;
        }
        
        let totalMatchTime = displaySeconds;
        const periodLengthSeconds = periodDuration * 60;

        if (period > 1) {
            totalMatchTime = ((period - 1) * periodLengthSeconds) + displaySeconds;
        }
        
        const currentPeriodNum = period;
        const categoryNameForMatch = match.categoryName || (match.categoryId && window.categoriesData ? window.categoriesData[match.categoryId] : null);
        
        let userId = null;
        let teamNameForSearch = null;
        if (teamType === 'home') {
            teamNameForSearch = teamNames?.[match.homeTeamIdentifier] || match.homeTeamIdentifier;
        } else {
            teamNameForSearch = teamNames?.[match.awayTeamIdentifier] || match.awayTeamIdentifier;
        }
        
        if (window.db && teamNameForSearch && categoryNameForMatch) {
            try {
                const usersRef = collection(window.db, 'users');
                const usersSnapshot = await getDocs(usersRef);
                
                for (const userDoc of usersSnapshot.docs) {
                    const userData = userDoc.data();
                    const teams = userData.teams || {};
                    
                    for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                        if (categoryKey !== categoryNameForMatch) continue;
                        
                        const foundTeam = (teamsArray || []).find(t => t.teamName === teamNameForSearch);
                        
                        if (foundTeam) {
                            let memberExists = false;
                            
                            if (member.typeKey === 'playerDetails') {
                                if (foundTeam.playerDetails && foundTeam.playerDetails[member.index]) {
                                    memberExists = true;
                                }
                            } else if (member.typeKey === 'menTeamMemberDetails') {
                                if (foundTeam.menTeamMemberDetails && foundTeam.menTeamMemberDetails[member.index]) {
                                    memberExists = true;
                                }
                            } else if (member.typeKey === 'womenTeamMemberDetails') {
                                if (foundTeam.womenTeamMemberDetails && foundTeam.womenTeamMemberDetails[member.index]) {
                                    memberExists = true;
                                }
                            }
                            
                            if (memberExists) {
                                userId = userDoc.id;
                                break;
                            }
                        }
                    }
                    if (userId) break;
                }
            } catch (err) {
                console.error('Chyba pri vyhľadávaní userId:', err);
            }
        }
        
        const savedEvents = [];
        
        for (const selectedAction of selectedActions) {
            let eventType = '';
            let eventSubtype = null;
            
            switch (selectedAction) {
                case 'goal':
                    eventType = 'goal';
                    break;
                case '7m':
                    eventType = 'penalty';
                    eventSubtype = '7m';
                    break;
                case 'yellow':
                    eventType = 'card';
                    eventSubtype = 'yellow';
                    break;
                case 'red':
                    eventType = 'card';
                    eventSubtype = 'red';
                    break;
                case 'blue':
                    eventType = 'card';
                    eventSubtype = 'blue';
                    break;
                case 'exclusion':
                    eventType = 'exclusion';
                    break;
                default:
                    continue;
            }
            
            if (selectedActions.has('7m') && selectedActions.has('goal')) {
                if (selectedAction === '7m') {
                    continue;
                }
                eventType = 'goal';
                eventSubtype = 'converted_penalty'; 
            }
            
            const eventData = {
                matchId: matchId,
                totalTime: totalMatchTime,
                periodTime: displaySeconds,
                period: currentPeriodNum,
                eventType: eventType,
                eventSubtype: eventSubtype,
                team: teamType,
                memberType: member.type,
                memberTypeKey: member.typeKey,
                memberIndex: member.index,
                userId: userId,
                categoryName: categoryNameForMatch,
                createdAt: Timestamp.now(),
                timestamp: Timestamp.now()
            };
            
            try {
                const eventsRef = collection(window.db, 'matchEvents');
                await addDoc(eventsRef, eventData);
                savedEvents.push(selectedAction);
            } catch (err) {
                console.error('Chyba pri ukladaní udalosti:', err);
            }
        }
        
        if (savedEvents.length > 0) {
            setSelectedActions(new Set());
            if (onActionSelected && typeof onActionSelected === 'function') {
                onActionSelected(null);
            }
            return true;
        }
        
        return false;
    };

    const saveMatchEvent = async (teamType, member) => {
        return await saveMatchEventInternalWithAction(teamType, member, selectedAction);
    };

    React.useImperativeHandle(ref, () => ({
        saveMatchEvent: saveMatchEvent,
        getSelectedAction: () => {
            if (selectedActions.size > 0) {
                return Array.from(selectedActions)[0];
            }
            return null;
        },
        getSelectedActions: () => {
            return selectedActions;
        },
        isTimerRunning: () => {
            return isRunningRef.current;
        },
        saveEventWithAction: async (teamType, member, action) => {
            return await saveMatchEventInternalWithAction(teamType, member, action);
        },
        getTotalTime: () => {
            return calculateTotalMatchTime();
        },
        getCurrentPeriod: () => {
            return period;
        },
        setEditingMode: (isEditing, event) => {
            setEditingMode(isEditing);
            setEditingEvent(event);
            if (isEditing && event) {
                let actions = new Set();
                if (event.eventType === 'goal') {
                    if (event.eventSubtype === 'converted_penalty') {
                        actions.add('7m');
                        actions.add('goal');
                    } else {
                        actions.add('goal');
                    }
                } else if (event.eventType === 'penalty') {
                    actions.add('7m');
                } else if (event.eventType === 'card') {
                    if (event.eventSubtype === 'yellow') actions.add('yellow');
                    else if (event.eventSubtype === 'red') actions.add('red');
                    else if (event.eventSubtype === 'blue') actions.add('blue');
                } else if (event.eventType === 'exclusion') {
                    actions.add('exclusion');
                }
                setSelectedActions(actions);
            }
        },
        clearEditingMode: () => {
            setEditingMode(false);
            setEditingEvent(null);
        },
        clearSelectedActions: () => {
            setSelectedActions(new Set());
        },
        setSelectedActions: (actions) => {
            setSelectedActions(actions);
        },
        // 🔥 NOVÉ: Manuálne nastavenie periódy a času (pre synchronizáciu)
        setPeriodAndTime: (newPeriod, newTime) => {
            setPeriod(newPeriod);
            setDisplaySeconds(newTime);
            displaySecondsRef.current = newTime;
            periodRef.current = newPeriod;
        }
    }));

    const handleManualResultSubmit = async () => {
        const homeScoreInt = parseInt(manualHomeScore);
        const awayScoreInt = parseInt(manualAwayScore);
        
        if (isNaN(homeScoreInt) || isNaN(awayScoreInt)) {
            return;
        }
        
        if (homeScoreInt < 0 || awayScoreInt < 0) {
            return;
        }
        
        if (window.db && matchId) {
            try {
                if (isRunningRef.current) {
                    stopLocalInterval();
                    setIsRunning(false);
                    isRunningRef.current = false;
                }
                
                const matchRef = doc(window.db, 'matches', matchId);
                
                await updateDoc(matchRef, {
                    homeScore: homeScoreInt,
                    awayScore: awayScoreInt,
                    finalScore: {
                        home: homeScoreInt,
                        away: awayScoreInt
                    },
                    status: 'completed',
                    manualResultEntered: true,
                    manualResultEnteredAt: Timestamp.now(),
                    manualTimeOffset: displaySeconds,
                    currentPeriod: period, // 🔥 ULOŽENIE PERIÓDY
                    startedAt: null,
                    pausedAt: null,
                    updatedAt: Timestamp.now()
                });
                
                setShowManualResultModal(false);
                setManualHomeScore('');
                setManualAwayScore('');
                
                if (onTimeUpdate) onTimeUpdate({ totalSeconds: displaySeconds, period, isRunning: false });
                
                if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                    await window.updateTeamNamesGlobally();
                }
            } catch (err) {
                console.error('Chyba pri ukladaní manuálneho výsledku:', err);
            }
        }
    };

    const renderResetModal = () => {
        if (!showResetModal) return null;
        
        return React.createElement(
            'div',
            { 
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                onClick: () => !resetLoading && setShowResetModal(false)
            },
            React.createElement(
                'div',
                { 
                    className: 'bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold text-gray-800 mb-4' },
                    'Resetovať zápas'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-600 mb-6' },
                    'Naozaj chcete resetovať celý zápas? Všetky udalosti budú vymazané.'
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-3 justify-end' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setShowResetModal(false),
                            disabled: resetLoading,
                            className: 'px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: handleResetConfirm,
                            disabled: resetLoading,
                            className: 'px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-700 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
                        },
                        resetLoading && React.createElement('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-white' }),
                        resetLoading ? 'Resetujem...' : 'Potvrdiť reset'
                    )
                )
            )
        );
    };

    const renderManualResultModal = () => {
        if (!showManualResultModal) return null;
        
        const homeTeamDisplayName = teamNames?.[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
        const awayTeamDisplayName = teamNames?.[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
        
        if (modalLoadingMapping) {
            return React.createElement(
                'div',
                { 
                    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                    onClick: () => {
                        setShowManualResultModal(false);
                        setManualHomeScore('');
                        setManualAwayScore('');
                    }
                },
                React.createElement(
                    'div',
                    { 
                        className: 'bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6 text-center',
                        onClick: (e) => e.stopPropagation()
                    },
                    React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4' }),
                    React.createElement('p', { className: 'text-gray-600' }, 'Načítavam názvy tímov...')
                )
            );
        }
        
        return React.createElement(
            'div',
            { 
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                onClick: () => {
                    setShowManualResultModal(false);
                    setManualHomeScore('');
                    setManualAwayScore('');
                }
            },
            React.createElement(
                'div',
                { 
                    className: 'bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold text-gray-800 mb-4 text-center' },
                    'Zadať výsledok manuálne'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-600 mb-6 text-center text-sm' },
                    'Zadajte konečný výsledok zápasu'
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-6 mb-8' },
                    React.createElement(
                        'div',
                        { className: 'flex-1 text-center' },
                        React.createElement(
                            'label',
                            { className: 'block text-base font-medium text-gray-700 mb-3' },
                            homeTeamDisplayName
                        ),
                        React.createElement(
                            'input',
                            {
                                type: 'number',
                                value: manualHomeScore,
                                onChange: (e) => setManualHomeScore(e.target.value),
                                className: 'w-full px-6 py-4 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',
                                min: '0',
                                step: '1'
                            }
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-center text-3xl font-bold text-gray-400 px-2' },
                        ':'
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex-1 text-center' },
                        React.createElement(
                            'label',
                            { className: 'block text-base font-medium text-gray-700 mb-3' },
                            awayTeamDisplayName
                        ),
                        React.createElement(
                            'input',
                            {
                                type: 'number',
                                value: manualAwayScore,
                                onChange: (e) => setManualAwayScore(e.target.value),
                                className: 'w-full px-6 py-4 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',
                                min: '0',
                                step: '1'
                            }
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-4' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                setShowManualResultModal(false);
                                setManualHomeScore('');
                                setManualAwayScore('');
                            },
                            className: 'flex-1 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-colors cursor-pointer text-center'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: handleManualResultSubmit,
                            disabled: manualHomeScore === '' || manualAwayScore === '',
                            className: `flex-1 py-3 rounded-xl font-semibold transition-colors text-center ${
                                manualHomeScore !== '' && manualAwayScore !== ''
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                    : 'bg-white text-blue-600 border-2 border-blue-600 cursor-not-allowed'
                            }`
                        },
                        'Potvrdiť'
                    )
                )
            )
        );
    };

    const handleForfeit = async () => {
        if (!window.db || !matchId || !selectedForfeitTeam) return;
        
        try {
            if (isRunningRef.current) {
                stopLocalInterval();
                setIsRunning(false);
                isRunningRef.current = false;
            }
            
            let homeScore = 0;
            let awayScore = 0;
            
            if (selectedForfeitTeam === 'home') {
                homeScore = 10;
                awayScore = 0;
            } else if (selectedForfeitTeam === 'away') {
                homeScore = 0;
                awayScore = 10;
            }
            
            const matchRef = doc(window.db, 'matches', matchId);
            
            await updateDoc(matchRef, {
                homeScore: homeScore,
                awayScore: awayScore,
                status: 'completed',
                isForfeit: true,
                forfeitTeam: selectedForfeitTeam,
                forfeitAt: Timestamp.now(),
                forfeitResult: {
                    isForfeit: true,
                    home: homeScore,
                    away: awayScore,
                    team: selectedForfeitTeam,
                    timestamp: Timestamp.now()
                },
                manualTimeOffset: 0,
                currentPeriod: 1, // 🔥 RESET PERIÓDY
                startedAt: null,
                pausedAt: null,
                updatedAt: Timestamp.now()
            });
            
            setShowForfeitModal(false);
            setSelectedForfeitTeam(null);
            
            if (onTimeUpdate) onTimeUpdate({ totalSeconds: 0, period: 1, isRunning: false });
            
            if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                await window.updateTeamNamesGlobally();
            }
        } catch (err) {
            console.error('Chyba pri kontumácii zápasu:', err);
        }
    };

    const renderForfeitModal = () => {
        if (!showForfeitModal) return null;
        
        const homeTeamDisplayName = teamNames?.[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
        const awayTeamDisplayName = teamNames?.[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
        
        if (modalLoadingMapping) {
            return React.createElement(
                'div',
                { 
                    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                    onClick: () => {
                        setShowForfeitModal(false);
                        setSelectedForfeitTeam(null);
                    }
                },
                React.createElement(
                    'div',
                    { 
                        className: 'bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6 text-center',
                        onClick: (e) => e.stopPropagation()
                    },
                    React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4' }),
                    React.createElement('p', { className: 'text-gray-600' }, 'Načítavam názvy tímov...')
                )
            );
        }
        
        return React.createElement(
            'div',
            { 
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                onClick: () => {
                    setShowForfeitModal(false);
                    setSelectedForfeitTeam(null);
                }
            },
            React.createElement(
                'div',
                { 
                    className: 'bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-bold text-gray-800 mb-4 text-center' },
                    'Kontumácia zápasu'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-600 mb-6 text-center text-base' },
                    'Vyberte tím, v prospech ktorého sa zápas kontumuje (10:0)'
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-6 mb-8' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setSelectedForfeitTeam('home'),
                            className: `flex-1 py-4 rounded-xl font-bold transition-colors cursor-pointer text-center ${
                                selectedForfeitTeam === 'home' 
                                    ? 'bg-yellow-400 text-yellow-900 border-2 border-yellow-600' 
                                    : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                            }`
                        },
                            React.createElement('span', { className: 'block text-lg font-bold' }, 'Domáci'),
                            React.createElement('span', { className: 'block text-sm opacity-90 mt-1' }, homeTeamDisplayName)
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => setSelectedForfeitTeam('away'),
                            className: `flex-1 py-4 rounded-xl font-bold transition-colors cursor-pointer text-center ${
                                selectedForfeitTeam === 'away' 
                                    ? 'bg-yellow-400 text-yellow-900 border-2 border-yellow-600' 
                                    : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                            }`
                        },
                            React.createElement('span', { className: 'block text-lg font-bold' }, 'Hostia'),
                            React.createElement('span', { className: 'block text-sm opacity-90 mt-1' }, awayTeamDisplayName)
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-4' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                setShowForfeitModal(false);
                                setSelectedForfeitTeam(null);
                            },
                            className: 'flex-1 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold transition-colors cursor-pointer text-center'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => handleForfeit(),
                            disabled: !selectedForfeitTeam,
                            className: `flex-1 py-3 rounded-xl font-bold transition-colors text-center ${
                                selectedForfeitTeam 
                                    ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' 
                                    : 'bg-white text-green-600 border-2 border-green-600 cursor-not-allowed'
                            }`
                        },
                        'Potvrdiť'
                    )
                )
            )
        );
    };

    const renderEndMatchModal = () => {
        if (!showEndMatchModal) return null;
        
        return React.createElement(
            'div',
            { 
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                onClick: () => setShowEndMatchModal(false)
            },
            React.createElement(
                'div',
                { 
                    className: 'bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold text-gray-800 mb-4' },
                    'Ukončiť zápas'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-600 mb-4' },
                    'Naozaj chcete ukončiť tento zápas?'
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-3 justify-end' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setShowEndMatchModal(false),
                            className: 'px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors cursor-pointer'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: endMatch,
                            className: 'px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer'
                        },
                        'Ukončiť zápas'
                    )
                )
            )
        );
    };

    const formatTime = (totalSeconds) => {
        const totalMins = Math.floor(Math.max(0, totalSeconds) / 60);
        const totalSecs = Math.max(0, totalSeconds) % 60;
        return `${totalMins.toString().padStart(2, '0')}:${totalSecs.toString().padStart(2, '0')}`;
    };

    const formatPeriodTime = (periodSeconds) => {
        const mins = Math.floor(periodSeconds / 60);
        const secs = periodSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const updateDisplay = () => {
        if (!isRunningRef.current) return;
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current) / 1000);
        const total = localStartOffsetRef.current + elapsed;
        const periodLength = periodDuration * 60;
        let clamped = Math.min(total, periodLength);
    
        setDisplaySeconds(clamped);
        displaySecondsRef.current = clamped;
    
        if (clamped >= periodLength && isRunningRef.current) {
            stopLocalInterval();
            setIsRunning(false);
            isRunningRef.current = false;
            
            if (window.db && matchId) {
                const matchRef = doc(window.db, 'matches', matchId);
                updateDoc(matchRef, {
                    manualTimeOffset: clamped,
                    currentPeriod: periodRef.current, // 🔥 ULOŽENIE PERIÓDY
                    status: 'paused',
                    startedAt: null,
                    pausedAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                }).catch(console.error);
            }
            
            if (onTimeUpdate) onTimeUpdate({ 
                totalSeconds: clamped, 
                period: periodRef.current, 
                isRunning: false,
                periodEnded: true
            });
        }
    };

    const startLocalInterval = (startSeconds) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        startTimeRef.current = Date.now();
        localStartOffsetRef.current = startSeconds;
        intervalRef.current = setInterval(updateDisplay, 200);
    };

    const stopLocalInterval = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        startTimeRef.current = null;
    };

    const stopTimerAndSave = async (isPeriodEnd = false) => {
        if (!isRunningRef.current) return;
        const finalSeconds = displaySeconds;
        stopLocalInterval();
        setIsRunning(false);
        isRunningRef.current = false;
        
        if (window.db && matchId) {
            try {
                lastServerUpdateRef.current = Date.now();
                const matchRef = doc(window.db, 'matches', matchId);
                
                const periodLength = periodDuration * 60;
                const isMatchComplete = period >= totalPeriods && finalSeconds >= periodLength;
                
                if (isMatchComplete) {                    
                    const eventsRef = collection(window.db, 'matchEvents');
                    const q = query(eventsRef, where('matchId', '==', matchId));
                    const eventsSnapshot = await getDocs(q);
                    
                    let homeGoals = 0;
                    let awayGoals = 0;
                    
                    eventsSnapshot.forEach((eventDoc) => {
                        const event = eventDoc.data();
                        if (event.eventType === 'goal') {
                            if (event.team === 'home') homeGoals++;
                            else if (event.team === 'away') awayGoals++;
                        }
                    });                    
                    
                    await updateDoc(matchRef, {
                        manualTimeOffset: finalSeconds,
                        currentPeriod: period, // 🔥 ULOŽENIE PERIÓDY
                        status: 'completed',
                        startedAt: null,
                        pausedAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                        homeScore: homeGoals,
                        awayScore: awayGoals,
                        finalScore: {
                            home: homeGoals,
                            away: awayGoals
                        },
                        completedAt: Timestamp.now(),
                        resultCalculatedFromEvents: true
                    });
                } else {
                    await updateDoc(matchRef, {
                        manualTimeOffset: finalSeconds,
                        currentPeriod: period, // 🔥 ULOŽENIE PERIÓDY
                        status: 'paused',
                        startedAt: null,
                        pausedAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });
                }
                
                if (onTimeUpdate) onTimeUpdate({ 
                    totalSeconds: finalSeconds, 
                    period, 
                    isRunning: false,
                    periodEnded: isPeriodEnd && !isMatchComplete
                });
                
                setTimeout(() => { lastServerUpdateRef.current = 0; }, 300);
            } catch (err) { 
                console.error('Chyba pri zastavovaní časovača:', err);
            }
        }
    };

    const startTimer = async () => {
        if (match?.status === 'completed') return;
        if (isRunningRef.current) return;
        const currentSeconds = displaySeconds;
        const periodLength = periodDuration * 60;
        
        if (currentSeconds >= periodLength) {
            return;
        }
        
        startLocalInterval(currentSeconds);
        setIsRunning(true);
        isRunningRef.current = true;
        if (window.db && matchId) {
            try {
                lastServerUpdateRef.current = Date.now();
                const matchRef = doc(window.db, 'matches', matchId);
                await updateDoc(matchRef, {
                    manualTimeOffset: currentSeconds,
                    currentPeriod: period, // 🔥 ULOŽENIE PERIÓDY
                    startedAt: Timestamp.now(),
                    status: 'in-progress',
                    pausedAt: null,
                    updatedAt: Timestamp.now()
                });
                if (onTimeUpdate) onTimeUpdate({ totalSeconds: currentSeconds, period, isRunning: true });
                setTimeout(() => { lastServerUpdateRef.current = 0; }, 300);
            } catch (err) {
                console.error(err);
                stopLocalInterval();
                setIsRunning(false);
                isRunningRef.current = false;
            }
        }
    };

    const addTime = (deltaSeconds) => {
        if (match?.status === 'completed') return;
        let newSeconds = displaySeconds + deltaSeconds;
        const periodLength = periodDuration * 60;
        if (newSeconds < 0) newSeconds = 0;
        if (newSeconds > periodLength) newSeconds = periodLength;
        setDisplaySeconds(newSeconds);
        
        if (newSeconds >= periodLength && isRunningRef.current) {
            stopTimerAndSave(true);
        }
        
        if (isRunningRef.current) {
            startTimeRef.current = Date.now();
            localStartOffsetRef.current = newSeconds;
        }
        if (window.db && matchId) {
            lastServerUpdateRef.current = Date.now();
            const status = isRunningRef.current ? 'in-progress' : 'paused';
            const updateData = {
                manualTimeOffset: newSeconds,
                currentPeriod: period, // 🔥 ULOŽENIE PERIÓDY
                status: status,
                updatedAt: Timestamp.now()
            };
            if (!isRunningRef.current) updateData.pausedAt = Timestamp.now();
            if (isRunningRef.current) updateData.startedAt = Timestamp.now();
            updateDoc(doc(window.db, 'matches', matchId), updateData)
                .then(() => setTimeout(() => { lastServerUpdateRef.current = 0; }, 300))
                .catch(console.error);
        }
    };

    // 🔥 UPRAVENÁ synchronizácia z DB - teraz aj s periodou
    useEffect(() => {
        if (!window.db || !matchId) return;
        const matchRef = doc(window.db, 'matches', matchId);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (!docSnap.exists()) return;
            const now = Date.now();
            if (lastServerUpdateRef.current && (now - lastServerUpdateRef.current) < 300) return;
            const data = docSnap.data();
            const serverStatus = data.status;
            let serverSeconds = data.manualTimeOffset || 0;
            let serverPeriod = data.currentPeriod || 1;
            
            // 🔥 AKTUALIZÁCIA PERIÓDY
            if (serverPeriod !== period) {
                setPeriod(serverPeriod);
                periodRef.current = serverPeriod;
            }
            
            if (serverStatus === 'in-progress' && data.startedAt) {
                const elapsed = Math.floor((now - data.startedAt.toDate().getTime()) / 1000);
                const periodLength = periodDuration * 60;
                serverSeconds = Math.min(serverSeconds + elapsed, periodLength);
            }
            
            setDisplaySeconds(serverSeconds);
            displaySecondsRef.current = serverSeconds;
            
            if (serverStatus === 'in-progress') {
                if (!isRunningRef.current) {
                    startLocalInterval(serverSeconds);
                    setIsRunning(true);
                    isRunningRef.current = true;
                    if (onTimeUpdate) onTimeUpdate({ totalSeconds: serverSeconds, period: serverPeriod, isRunning: true });
                } else {
                    const diff = Math.abs(serverSeconds - displaySecondsRef.current);
                    if (diff > 0.5) {
                        startLocalInterval(serverSeconds);
                        if (onTimeUpdate) onTimeUpdate({ totalSeconds: serverSeconds, period: serverPeriod, isRunning: true });
                    }
                }
            } else if (serverStatus === 'paused' && isRunningRef.current) {
                stopLocalInterval();
                setIsRunning(false);
                isRunningRef.current = false;
                if (onTimeUpdate) onTimeUpdate({ totalSeconds: serverSeconds, period: serverPeriod, isRunning: false });
            }
        });
        return () => unsubscribe();
    }, [matchId, periodDuration]);

    // 🔥 UPRAVENÁ inicializácia z props - načítanie periódy z DB
    useEffect(() => {
        if (!match) return;
        if (categorySettings) {
            if (categorySettings.periods !== undefined) setTotalPeriods(categorySettings.periods);
            if (categorySettings.periodDuration !== undefined) setPeriodDuration(categorySettings.periodDuration);
        }
        
        // 🔥 NAČÍTANIE PERIÓDY Z DATABÁZY
        let initialPeriod = match.currentPeriod || 1;
        let initialSeconds = match.manualTimeOffset || 0;
        const periodLength = periodDuration * 60;
        
        setPeriod(initialPeriod);
        periodRef.current = initialPeriod;
        
        if (match.status === 'in-progress' && match.startedAt) {
            const elapsed = Math.floor((Date.now() - match.startedAt.toDate().getTime()) / 1000);
            initialSeconds = Math.min(initialSeconds + elapsed, periodLength);
        }
        
        setDisplaySeconds(initialSeconds);
        displaySecondsRef.current = initialSeconds;
        
        if (match.status === 'in-progress') {
            startLocalInterval(initialSeconds);
            setIsRunning(true);
            isRunningRef.current = true;
        } else {
            stopLocalInterval();
            setIsRunning(false);
            isRunningRef.current = false;
        }
        
        return () => stopLocalInterval();
    }, [match?.id, categorySettings]);

    const periodLength = periodDuration * 60;
    const isAtPeriodEnd = displaySeconds >= periodLength;
    const canSubtractMinute = () => displaySeconds >= 60 && match?.status !== 'completed' && !isAtPeriodEnd;
    const canAddMinute = () => displaySeconds + 60 <= periodLength && match?.status !== 'completed';
    const canSubtractSecond = () => displaySeconds >= 1 && match?.status !== 'completed' && !isAtPeriodEnd;
    const canAddSecond = () => displaySeconds + 1 <= periodLength && match?.status !== 'completed';
    const canReset = () => true;

    const addMinute = () => canAddMinute() && addTime(60);
    const subtractMinute = () => canSubtractMinute() && addTime(-60);
    const addSecond = () => canAddSecond() && addTime(1);
    const subtractSecond = () => canSubtractSecond() && addTime(-1);
    const toggleTimer = () => {
        if (match?.status === 'completed') return;
    
        const periodLength = periodDuration * 60;
        const isAtPeriodEnd = displaySeconds >= periodLength;
    
        if (!isRunningRef.current && isAtPeriodEnd) {
            return;
        }
        
        isRunningRef.current ? stopTimerAndSave() : startTimer();
    };

    const resetTime = async () => {
        if (!canReset()) return;
    
        setDisplaySeconds(0);
        displaySecondsRef.current = 0;
        setPeriod(1);
        periodRef.current = 1;
        
        if (window.db && matchId) {
            try {
                lastServerUpdateRef.current = Date.now();
                const matchRef = doc(window.db, 'matches', matchId);
                
                const matchSnap = await getDoc(matchRef);
                const currentMatchData = matchSnap.exists() ? matchSnap.data() : {};                
                
                const eventsRef = collection(window.db, 'matchEvents');
                const q = query(eventsRef, where('matchId', '==', matchId));
                const eventsSnapshot = await getDocs(q);
                
                const deletePromises = [];
                eventsSnapshot.forEach((eventDoc) => {
                    deletePromises.push(deleteDoc(doc(window.db, 'matchEvents', eventDoc.id)));
                });
                
                if (deletePromises.length > 0) {
                    await Promise.all(deletePromises);
                }
                
                const updateData = {
                    manualTimeOffset: 0,
                    currentPeriod: 1, // 🔥 RESET PERIÓDY
                    status: 'scheduled',
                    startedAt: null,
                    pausedAt: null,
                    updatedAt: Timestamp.now(),
                    homeScore: null,
                    awayScore: null,
                    isForfeit: null,
                    forfeitTeam: null,
                    forfeitAt: null,
                    forfeitResult: null
                };
                
                const fieldsToPreserve = [
                    'hallId', 'categoryId', 'categoryName', 'groupName', 
                    'homeTeamIdentifier', 'awayTeamIdentifier', 'matchType',
                    'isPlacementMatch', 'placementRank', 'scheduledTime'
                ];
                
                fieldsToPreserve.forEach(field => {
                    if (currentMatchData[field] !== undefined) {
                        updateData[field] = currentMatchData[field];
                    }
                });
                
                await updateDoc(matchRef, updateData);
                
                if (onTimeUpdate) onTimeUpdate({ 
                    totalSeconds: 0, 
                    period: 1, 
                    isRunning: false,
                    resetComplete: true,
                    resetEvents: true
                });
                
                setTimeout(() => { lastServerUpdateRef.current = 0; }, 300);                
                
            } catch (err) {
                console.error('Chyba pri resetovaní časovača:', err);
            }
        }
    };

    // 🔥 nextPeriod - manuálne prepnutie na ďalšiu periódu
    const nextPeriod = async () => {
        if (match?.status === 'completed') return;
        if (period >= totalPeriods) return;
        
        if (isRunningRef.current) {
            await stopTimerAndSave();
        }
        
        const newPeriodNum = period + 1;
        
        if (window.db && matchId) {
            try {
                const matchRef = doc(window.db, 'matches', matchId);
                await updateDoc(matchRef, {
                    currentPeriod: newPeriodNum,
                    status: 'paused',
                    manualTimeOffset: 0,
                    updatedAt: Timestamp.now()
                });
                setPeriod(newPeriodNum);
                periodRef.current = newPeriodNum;
                setDisplaySeconds(0);
                displaySecondsRef.current = 0;
                
                if (onTimeUpdate) onTimeUpdate({ 
                    totalSeconds: 0, 
                    period: newPeriodNum, 
                    isRunning: false 
                });
            } catch (err) {
                console.error('Chyba pri manuálnom prepnutí periódy:', err);
            }
        }
    };
    
    // 🔥 prevPeriod - manuálne prepnutie na predchádzajúcu periódu
    const prevPeriod = async () => {
        if (match?.status === 'completed') return;
        if (period <= 1) return;
        
        if (isRunningRef.current) {
            await stopTimerAndSave();
        }
        
        const newPeriodNum = period - 1;
        
        if (window.db && matchId) {
            try {
                const matchRef = doc(window.db, 'matches', matchId);
                await updateDoc(matchRef, {
                    currentPeriod: newPeriodNum,
                    status: 'paused',
                    manualTimeOffset: 0,
                    updatedAt: Timestamp.now()
                });
                setPeriod(newPeriodNum);
                periodRef.current = newPeriodNum;
                setDisplaySeconds(0);
                displaySecondsRef.current = 0;
                
                if (onTimeUpdate) onTimeUpdate({ 
                    totalSeconds: 0, 
                    period: newPeriodNum, 
                    isRunning: false 
                });
            } catch (err) {
                console.error('Chyba pri manuálnom prepnutí periódy:', err);
            }
        }
    };

    const endMatch = async () => {
        if (window.db && matchId) {
            try {
                if (isRunningRef.current) {
                    stopLocalInterval();
                    setIsRunning(false);
                    isRunningRef.current = false;
                }                
                
                const eventsRef = collection(window.db, 'matchEvents');
                const q = query(eventsRef, where('matchId', '==', matchId));
                const eventsSnapshot = await getDocs(q);
                
                let homeGoals = 0;
                let awayGoals = 0;
                
                eventsSnapshot.forEach((eventDoc) => {
                    const event = eventDoc.data();
                    if (event.eventType === 'goal') {
                        if (event.team === 'home') {
                            homeGoals++;
                        } else if (event.team === 'away') {
                            awayGoals++;
                        }
                    }
                });                
                
                const matchRef = doc(window.db, 'matches', matchId);
                
                const matchSnap = await getDoc(matchRef);
                const currentMatchData = matchSnap.exists() ? matchSnap.data() : {};
                
                const updateData = {
                    status: 'completed',
                    updatedAt: Timestamp.now(),
                    homeScore: homeGoals,
                    awayScore: awayGoals,
                    finalScore: {
                        home: homeGoals,
                        away: awayGoals
                    },
                    completedAt: Timestamp.now(),
                    resultCalculatedFromEvents: true,
                    currentPeriod: period // 🔥 ULOŽENIE PERIÓDY
                };
                
                const fieldsToPreserve = [
                    'hallId', 'categoryId', 'categoryName', 'groupName', 
                    'homeTeamIdentifier', 'awayTeamIdentifier', 'matchType',
                    'isPlacementMatch', 'placementRank', 'scheduledTime',
                    'manualTimeOffset'
                ];
                
                fieldsToPreserve.forEach(field => {
                    if (currentMatchData[field] !== undefined) {
                        updateData[field] = currentMatchData[field];
                    }
                });
                
                await updateDoc(matchRef, updateData);
                
                setShowEndMatchModal(false);
                
                if (onTimeUpdate) onTimeUpdate({ 
                    totalSeconds: displaySeconds, 
                    period, 
                    isRunning: false,
                    finalScore: { home: homeGoals, away: awayGoals }
                });
                
                if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                    await window.updateTeamNamesGlobally();
                }
                
            } catch (err) {
                console.error('Chyba pri ukončovaní zápasu:', err);
            }
        }
    };

    const isMatchCompleted = match?.status === 'completed';
    
    const isMinusMinuteDisabled = !canSubtractMinute();
    const isMinusSecondDisabled = !canSubtractSecond();
    const isPlusMinuteDisabled = !canAddMinute();
    const isPlusSecondDisabled = !canAddSecond();
    
    if (isMatchCompleted) {
        return React.createElement('div', { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
            React.createElement('div', { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
                React.createElement('h3', { className: 'font-semibold text-gray-800' }, 'Športový časovač'),
                React.createElement('p', { className: 'text-xs text-gray-500 mt-0.5' }, `Trvanie periódy: ${periodDuration} min | Počet periód: ${totalPeriods}`)
            ),
            React.createElement('div', { className: 'p-6' },
                React.createElement('div', { className: 'text-center mb-6 py-4' },
                    React.createElement('div', { className: 'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700' },
                        React.createElement('i', { className: 'fa-solid fa-flag-checkered' }),
                        React.createElement('span', { className: 'font-medium' }, 'Zápas bol ukončený')
                    )
                ),
                React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2' },
                    React.createElement('button', { 
                        onClick: () => setShowResetModal(true), 
                        className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer'
                    }, 
                        React.createElement('i', { className: 'fa-solid fa-arrow-rotate-left mr-1' }), 'Reset'
                    )
                )
            ),
            renderResetModal()
        );
    }
    
    return React.createElement('div', { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
        React.createElement('div', { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
            React.createElement('h3', { className: 'font-semibold text-gray-800' }, 'Športový časovač'),
            React.createElement('p', { className: 'text-xs text-gray-500 mt-0.5' }, `Trvanie periódy: ${periodDuration} min | Počet periód: ${totalPeriods}`)
        ),
        React.createElement('div', { className: 'p-6' },
            React.createElement('div', { className: 'text-center mb-4' },
                React.createElement('div', { className: 'text-6xl font-mono font-bold text-gray-800' }, formatTime(displaySeconds)),
                React.createElement('div', { className: 'text-sm text-gray-500' }, 
                    `Perióda ${period} / ${totalPeriods}`
                )
            ),
            
            React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2 mb-6' },
                React.createElement('button', { 
                    onClick: toggleTimer, 
                    disabled: isAtPeriodEnd,
                    className: `px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
                        isAtPeriodEnd ? 'bg-gray-300 text-gray-500 cursor-not-allowed' :
                        isRunning ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer' : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                    }` 
                },
                    React.createElement('i', { className: isRunning ? 'fa-solid fa-stop mr-1' : 'fa-solid fa-play mr-1' }), isRunning ? 'Stop' : 'Štart'
                ),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { 
                    onClick: subtractMinute, 
                    disabled: isMinusMinuteDisabled,
                    title: isMinusMinuteDisabled ? (displaySeconds < 60 ? 'Nie je možné odpočítať minútu (menej ako 1 minúta)' : '') : '',
                    className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${isMinusMinuteDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` 
                }, React.createElement('i', { className: 'fa-solid fa-minus' })),
                React.createElement('span', { className: 'text-sm text-gray-600 px-1 font-medium' }, 'Min'),
                React.createElement('button', { 
                    onClick: addMinute, 
                    disabled: isPlusMinuteDisabled,
                    title: isPlusMinuteDisabled ? (displaySeconds + 60 > periodLength ? 'Nie je možné pridať minútu (koniec periódy)' : '') : '',
                    className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${isPlusMinuteDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` 
                }, React.createElement('i', { className: 'fa-solid fa-plus' })),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { 
                    onClick: subtractSecond, 
                    disabled: isMinusSecondDisabled,
                    title: isMinusSecondDisabled ? (displaySeconds < 1 ? 'Nie je možné odpočítať sekundu (menej ako 1 sekunda)' : '') : '',
                    className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${isMinusSecondDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` 
                }, React.createElement('i', { className: 'fa-solid fa-minus' })),
                React.createElement('span', { className: 'text-sm text-gray-600 px-1 font-medium' }, 'Sec'),
                React.createElement('button', { 
                    onClick: addSecond, 
                    disabled: isPlusSecondDisabled,
                    title: isPlusSecondDisabled ? (displaySeconds + 1 > periodLength ? 'Nie je možné pridať sekundu (koniec periódy)' : '') : '',
                    className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${isPlusSecondDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` 
                }, React.createElement('i', { className: 'fa-solid fa-plus' })),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { 
                    onClick: prevPeriod, 
                    disabled: period <= 1 || isRunning,
                    title: period <= 1 ? 'Už ste na prvej perióde' : (isRunning ? 'Zastavte časovač pre prepnutie periódy' : ''),
                    className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${period <= 1 || isRunning ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` 
                }, React.createElement('i', { className: 'fa-solid fa-chevron-left' })),
                React.createElement('span', { className: 'text-sm text-gray-800 font-semibold px-1' }, 'Perióda'),
                React.createElement('button', { 
                    onClick: nextPeriod, 
                    disabled: period >= totalPeriods || isRunning,
                    title: period >= totalPeriods ? 'Už ste na poslednej perióde' : (isRunning ? 'Zastavte časovač pre prepnutie periódy' : ''),
                    className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${period >= totalPeriods || isRunning ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` 
                }, React.createElement('i', { className: 'fa-solid fa-chevron-right' })),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { 
                    onClick: () => setShowResetModal(true), 
                    className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer' 
                }, React.createElement('i', { className: 'fa-solid fa-arrow-rotate-left mr-1' }), 'Reset')
            ),
            
            React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2 mb-6 pt-2 border-t border-gray-100' },
                React.createElement('button', { 
                    onClick: () => setShowEndMatchModal(true), 
                    className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                },
                    React.createElement('i', { className: 'fa-solid fa-flag-checkered mr-1' }), 'Ukončiť zápas'
                ),
                React.createElement('button', { 
                    onClick: () => setShowManualResultModal(true), 
                    className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                },
                    React.createElement('i', { className: 'fa-solid fa-pen-to-square mr-1' }), 'Zadať výsledok manuálne'
                ),
                React.createElement('button', { 
                    onClick: () => setShowForfeitModal(true), 
                    className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                },
                    React.createElement('i', { className: 'fa-solid fa-gavel mr-1' }), 'Kontumácia'
                )
            ),
            
            React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-gray-100' },
                React.createElement('button', { 
                    onClick: () => handleActionClick('goal'), 
                    className: getActionButtonClass('goal')
                }, 'Gól'),
                React.createElement('button', { 
                    onClick: () => handleActionClick('7m'), 
                    className: getActionButtonClass('7m')
                }, '7m'),
                React.createElement('button', { 
                    onClick: () => handleActionClick('yellow'), 
                    className: getActionButtonClass('yellow')
                }, 'ŽK'),
                React.createElement('button', { 
                    onClick: () => handleActionClick('red'), 
                    className: getActionButtonClass('red')
                }, 'ČK'),
                React.createElement('button', { 
                    onClick: () => handleActionClick('blue'), 
                    className: getActionButtonClass('blue')
                }, 'MK'),
                React.createElement('button', { 
                    onClick: () => handleActionClick('exclusion'), 
                    className: getActionButtonClass('exclusion')
                }, 'Vylúčenie')
            )
        ),
        renderEndMatchModal(),
        renderForfeitModal(),
        renderManualResultModal(),
        renderResetModal()
    );
});

// Komponent pre detail zápasu (s navigáciou medzi zápasmi a časovačom)
const MatchDetailView = ({ match, teamNames, onBack, hallInfo, categoryDrawColors, groupsData, allMatches, currentMatchIndex, onNavigate, onMatchUpdate }) => {
    const dateTime = formatMatchDateTime(match.scheduledTime);
    const [currentHomeScore, setCurrentHomeScore] = React.useState(match.homeScore);
    const [currentAwayScore, setCurrentAwayScore] = React.useState(match.awayScore);
    const isResultAvailable = currentHomeScore !== undefined && currentHomeScore !== null && currentAwayScore !== undefined && currentAwayScore !== null;
    const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
    const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
    const categoryColor = getCategoryDrawColor(match.categoryId);
    const lighterCategoryColor = getLighterColor(categoryColor);
    const matchColors = getMatchColors(match, groupsData);

    const matchTimerRef = React.useRef(null);
    
    // STATE pre nastavenia kategórie
    const [categorySettings, setCategorySettings] = React.useState(null);
    const [loadingSettings, setLoadingSettings] = React.useState(true);
    
    // STATE pre aktuálny status zápasu (pre prípad, že by sa zmenil)
    const [currentMatchStatus, setCurrentMatchStatus] = React.useState(match.status || 'scheduled');

    const [homeTeamMappedName, setHomeTeamMappedName] = React.useState(homeTeamDisplay);
    const [awayTeamMappedName, setAwayTeamMappedName] = React.useState(awayTeamDisplay);
    
    // Stavy pre udalosti
    const [matchEvents, setMatchEvents] = React.useState([]);
    const [eventsLoading, setEventsLoading] = React.useState(true);
    
    // 🔥 NOVÉ: Stavy pre počítanie gólov z udalostí (pre manuálne zadaný výsledok)
    const [calculatedHomeScore, setCalculatedHomeScore] = React.useState(0);
    const [calculatedAwayScore, setCalculatedAwayScore] = React.useState(0);
    const [useCalculatedScore, setUseCalculatedScore] = React.useState(false);

    const [editingEventId, setEditingEventId] = React.useState(null);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = React.useState(false);
    const [eventToDelete, setEventToDelete] = React.useState(null);
    const [deleteLoading, setDeleteLoading] = React.useState(false); 

    // Stavy pre sledovanie modrých kariet a vylúčení
    const [blueCardSuspensions, setBlueCardSuspensions] = React.useState({});
    const [suspensionMatchesCount, setSuspensionMatchesCount] = React.useState(1);
    const [allMatchesForTeam, setAllMatchesForTeam] = React.useState([]);

    // Načítanie nastavenia počtu zápasov vylúčenia za modrú kartu
    const loadSuspensionSettings = async () => {
        if (!window.db) return;
        
        try {
            const settingsRef = doc(window.db, 'settings', 'table');
            const settingsSnap = await getDoc(settingsRef);
            
            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                const matches = data.blueCardSuspensionMatches || 1;
                setSuspensionMatchesCount(matches);
            }
        } catch (err) {
            console.error('Chyba pri načítaní nastavení vylúčenia za modrú kartu:', err);
        }
    };

    // Získanie všetkých zápasov pre tím v chronologickom poradí
    const loadTeamMatches = async (teamIdentifier) => {
        if (!window.db || !teamIdentifier) return [];
        
        try {
            const matchesRef = collection(window.db, 'matches');
            const matchesSnapshot = await getDocs(matchesRef);
            const teamMatches = [];
            
            matchesSnapshot.forEach((doc) => {
                const matchData = doc.data();
                if ((matchData.homeTeamIdentifier === teamIdentifier || matchData.awayTeamIdentifier === teamIdentifier) &&
                    matchData.scheduledTime) {
                    teamMatches.push({
                        id: doc.id,
                        ...matchData,
                        scheduledTimeDate: matchData.scheduledTime?.toDate()
                    });
                }
            });
            
            // Zoradenie podľa času (od najstaršieho po najnovší)
            teamMatches.sort((a, b) => {
                const timeA = a.scheduledTimeDate?.getTime() || 0;
                const timeB = b.scheduledTimeDate?.getTime() || 0;
                return timeA - timeB;
            });            
            return teamMatches;
        } catch (err) {
            console.error('Chyba pri načítaní zápasov tímu:', err);
            return [];
        }
    };    

    const calculateBlueCardSuspensions = async () => {
        if (!window.db || !match.id) return;
    
        try {
            const homeTeamMatches = await loadTeamMatches(match.homeTeamIdentifier);
            const awayTeamMatches = await loadTeamMatches(match.awayTeamIdentifier);
        
            await calculateBlueCardSuspensionsRealTime(homeTeamMatches, awayTeamMatches, homeTeamDisplay, awayTeamDisplay);
        } catch (err) {
            console.error('Chyba pri výpočte vylúčení:', err);
        }
    };

    const calculateBlueCardSuspensionsRealTime = async (homeTeamMatches, awayTeamMatches, homeTeamDisplayLocal, awayTeamDisplayLocal) => {
        if (!window.db || !match.id) return;
        
        try {
            // Načítame všetky udalosti (modré karty)
            const eventsRef = collection(window.db, 'matchEvents');
            const eventsSnapshot = await getDocs(eventsRef);
            
            // Načítame všetkých používateľov (kluby)
            const usersSnapshot = await getDocs(collection(window.db, 'users'));
            
            const suspensions = {};
            
            // Zistíme poradie aktuálneho zápasu v zozname pre každý tím
            const currentMatchIndexHome = homeTeamMatches.findIndex(m => m.id === match.id);
            const currentMatchIndexAway = awayTeamMatches.findIndex(m => m.id === match.id);
            
            // ========== SPRACOVANIE PRE DOMÁCI TÍM ==========
            if (currentMatchIndexHome !== -1) {
                for (const userDoc of usersSnapshot.docs) {
                    const userData = userDoc.data();
                    const teams = userData.teams || {};
                    
                    for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                        const foundTeam = (teamsArray || []).find(t => t.teamName === homeTeamDisplayLocal);
                        
                        if (foundTeam) {
                            const allMembers = [];
                            
                            if (foundTeam.playerDetails && Array.isArray(foundTeam.playerDetails)) {
                                foundTeam.playerDetails.forEach((player, idx) => {
                                    allMembers.push({
                                        userId: userDoc.id,
                                        memberTypeKey: 'playerDetails',
                                        memberIndex: idx,
                                        name: `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Neznámy hráč',
                                        jerseyNumber: player.jerseyNumber || '',
                                        type: 'Hráč'
                                    });
                                });
                            }
                            
                            if (foundTeam.menTeamMemberDetails && Array.isArray(foundTeam.menTeamMemberDetails)) {
                                foundTeam.menTeamMemberDetails.forEach((member, idx) => {
                                    allMembers.push({
                                        userId: userDoc.id,
                                        memberTypeKey: 'menTeamMemberDetails',
                                        memberIndex: idx,
                                        name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Neznámy člen RT',
                                        jerseyNumber: '',
                                        type: 'Člen RT (muž)'
                                    });
                                });
                            }
                            
                            if (foundTeam.womenTeamMemberDetails && Array.isArray(foundTeam.womenTeamMemberDetails)) {
                                foundTeam.womenTeamMemberDetails.forEach((member, idx) => {
                                    allMembers.push({
                                        userId: userDoc.id,
                                        memberTypeKey: 'womenTeamMemberDetails',
                                        memberIndex: idx,
                                        name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Neznámy člen RT',
                                        jerseyNumber: '',
                                        type: 'Člen RT (žena)'
                                    });
                                });
                            }
                            
                            for (const member of allMembers) {
                                const memberKey = `${userDoc.id}_${member.memberTypeKey}_${member.memberIndex}`;
                                const blueCardEvents = [];
                                
                                eventsSnapshot.forEach((eventDoc) => {
                                    const event = eventDoc.data();
                                    if (event.eventType === 'card' && 
                                        event.eventSubtype === 'blue' &&
                                        event.userId === member.userId &&
                                        event.memberTypeKey === member.memberTypeKey &&
                                        event.memberIndex === member.memberIndex) {
                                        
                                        const matchIdOfEvent = event.matchId;
                                        const matchIndex = homeTeamMatches.findIndex(m => m.id === matchIdOfEvent);
                                        
                                        if (matchIndex !== -1 && matchIndex < currentMatchIndexHome) {
                                            blueCardEvents.push({
                                                matchIndex: matchIndex,
                                                matchId: matchIdOfEvent
                                            });
                                        }
                                    }
                                });
                                
                                if (blueCardEvents.length > 0) {
                                    const lastBlueEvent = blueCardEvents[blueCardEvents.length - 1];
                                    const matchesSinceLastBlue = currentMatchIndexHome - lastBlueEvent.matchIndex;
                                    
                                    if (matchesSinceLastBlue >= 1 && matchesSinceLastBlue <= suspensionMatchesCount) {
                                        const remainingMatches = suspensionMatchesCount - (matchesSinceLastBlue - 1);
                                        
                                        suspensions[memberKey] = {
                                            isExcludedByBlueCard: true,
                                            remainingMatches: remainingMatches,
                                            totalSuspensionMatches: suspensionMatchesCount,
                                            playerName: member.name,
                                            jerseyNumber: member.jerseyNumber,
                                            memberType: member.type,
                                            reason: `Modrá karta v zápase č. ${lastBlueEvent.matchIndex + 1}`
                                        };
                                    }
                                }
                            }
                            break;
                        }
                    }
                }
            }
            
            // ========== SPRACOVANIE PRE HOSŤUJÚCI TÍM ==========
            if (currentMatchIndexAway !== -1) {
                for (const userDoc of usersSnapshot.docs) {
                    const userData = userDoc.data();
                    const teams = userData.teams || {};
                    
                    for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                        const foundTeam = (teamsArray || []).find(t => t.teamName === awayTeamDisplayLocal);
                        
                        if (foundTeam) {
                            const allMembers = [];
                            
                            if (foundTeam.playerDetails && Array.isArray(foundTeam.playerDetails)) {
                                foundTeam.playerDetails.forEach((player, idx) => {
                                    allMembers.push({
                                        userId: userDoc.id,
                                        memberTypeKey: 'playerDetails',
                                        memberIndex: idx,
                                        name: `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Neznámy hráč',
                                        jerseyNumber: player.jerseyNumber || '',
                                        type: 'Hráč'
                                    });
                                });
                            }
                            
                            if (foundTeam.menTeamMemberDetails && Array.isArray(foundTeam.menTeamMemberDetails)) {
                                foundTeam.menTeamMemberDetails.forEach((member, idx) => {
                                    allMembers.push({
                                        userId: userDoc.id,
                                        memberTypeKey: 'menTeamMemberDetails',
                                        memberIndex: idx,
                                        name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Neznámy člen RT',
                                        jerseyNumber: '',
                                        type: 'Člen RT (muž)'
                                    });
                                });
                            }
                            
                            if (foundTeam.womenTeamMemberDetails && Array.isArray(foundTeam.womenTeamMemberDetails)) {
                                foundTeam.womenTeamMemberDetails.forEach((member, idx) => {
                                    allMembers.push({
                                        userId: userDoc.id,
                                        memberTypeKey: 'womenTeamMemberDetails',
                                        memberIndex: idx,
                                        name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Neznámy člen RT',
                                        jerseyNumber: '',
                                        type: 'Člen RT (žena)'
                                    });
                                });
                            }
                            
                            for (const member of allMembers) {
                                const memberKey = `${userDoc.id}_${member.memberTypeKey}_${member.memberIndex}`;
                                const blueCardEvents = [];
                                
                                eventsSnapshot.forEach((eventDoc) => {
                                    const event = eventDoc.data();
                                    if (event.eventType === 'card' && 
                                        event.eventSubtype === 'blue' &&
                                        event.userId === member.userId &&
                                        event.memberTypeKey === member.memberTypeKey &&
                                        event.memberIndex === member.memberIndex) {
                                        
                                        const matchIdOfEvent = event.matchId;
                                        const matchIndex = awayTeamMatches.findIndex(m => m.id === matchIdOfEvent);
                                        
                                        if (matchIndex !== -1 && matchIndex < currentMatchIndexAway) {
                                            blueCardEvents.push({
                                                matchIndex: matchIndex,
                                                matchId: matchIdOfEvent
                                            });
                                        }
                                    }
                                });
                                
                                if (blueCardEvents.length > 0) {
                                    const lastBlueEvent = blueCardEvents[blueCardEvents.length - 1];
                                    const matchesSinceLastBlue = currentMatchIndexAway - lastBlueEvent.matchIndex;
                                    
                                    if (matchesSinceLastBlue >= 1 && matchesSinceLastBlue <= suspensionMatchesCount) {
                                        const remainingMatches = suspensionMatchesCount - (matchesSinceLastBlue - 1);
                                        
                                        suspensions[memberKey] = {
                                            isExcludedByBlueCard: true,
                                            remainingMatches: remainingMatches,
                                            totalSuspensionMatches: suspensionMatchesCount,
                                            playerName: member.name,
                                            jerseyNumber: member.jerseyNumber,
                                            memberType: member.type,
                                            reason: `Modrá karta v zápase č. ${lastBlueEvent.matchIndex + 1}`
                                        };
                                    }
                                }
                            }
                            break;
                        }
                    }
                }
            }
            
            setBlueCardSuspensions(suspensions);
            
        } catch (err) {
            console.error('Chyba pri real-time výpočte vylúčení:', err);
        }
    };

    const handleDeleteEvent = async () => {
        if (!eventToDelete || !window.db) return;
    
        setDeleteLoading(true);
        try {
            const eventRef = doc(window.db, 'matchEvents', eventToDelete.id);
            await deleteDoc(eventRef);
            setShowDeleteConfirmModal(false);
            setEventToDelete(null);
        } catch (err) {
            console.error('Chyba pri mazaní udalosti:', err);
        } finally {
            setDeleteLoading(false);
        }
    };
    
    // Funkcia na otvorenie modálneho okna pre mazanie
    const openDeleteConfirmModal = (event, e) => {
        e.stopPropagation();
        setEventToDelete(event);
        setShowDeleteConfirmModal(true);
    };
    
    // Funkcia na začatie editácie udalosti
    const startEditingEvent = (event, e) => {
        e.stopPropagation();
        setEditingEventId(event.id);
        
        // Nastavíme timer na editáciu podľa udalosti
        if (matchTimerRef.current && typeof matchTimerRef.current.setEditingMode === 'function') {
            matchTimerRef.current.setEditingMode(true, event);
        }
        
        // Nastavíme vybrané akcie podľa typu udalosti
        if (matchTimerRef.current && typeof matchTimerRef.current.setSelectedActions === 'function') {
            let actions = new Set();
            if (event.eventType === 'goal') {
                if (event.eventSubtype === 'converted_penalty') {
                    actions.add('7m');
                    actions.add('goal');
                } else {
                    actions.add('goal');
                }
            } else if (event.eventType === 'penalty') {
                actions.add('7m');
            } else if (event.eventType === 'card') {
                if (event.eventSubtype === 'yellow') actions.add('yellow');
                else if (event.eventSubtype === 'red') actions.add('red');
                else if (event.eventSubtype === 'blue') actions.add('blue');
            } else if (event.eventType === 'exclusion') {
                actions.add('exclusion');
            }
            matchTimerRef.current.setSelectedActions(actions);
        }
    };
    
    // Funkcia na uloženie editovanej udalosti (prepíše pôvodnú)
    const saveEditedEvent = async (teamType, member, eventId) => {
        if (!window.db || !eventId) return false;
        
        try {
            // Získame aktuálny stav časovača a vybrané akcie
            const selectedActionsSet = matchTimerRef.current?.getSelectedActions() || new Set();
            if (selectedActionsSet.size === 0) return false;
            
            // Zistíme nový typ udalosti
            let newEventType = '';
            let newEventSubtype = null;
            
            if (selectedActionsSet.has('7m') && selectedActionsSet.has('goal')) {
                newEventType = 'goal';
                newEventSubtype = 'converted_penalty';
            } else if (selectedActionsSet.has('goal')) {
                newEventType = 'goal';
            } else if (selectedActionsSet.has('7m')) {
                newEventType = 'penalty';
                newEventSubtype = '7m';
            } else if (selectedActionsSet.has('yellow')) {
                newEventType = 'card';
                newEventSubtype = 'yellow';
            } else if (selectedActionsSet.has('red')) {
                newEventType = 'card';
                newEventSubtype = 'red';
            } else if (selectedActionsSet.has('blue')) {
                newEventType = 'card';
                newEventSubtype = 'blue';
            } else if (selectedActionsSet.has('exclusion')) {
                newEventType = 'exclusion';
            } else {
                return false;
            }
            
            // 🔥 ZÍSKAME userId a categoryName pre člena (rovnako ako pri ukladaní)
            let userId = null;
            let categoryNameForMatch = match.categoryName || (match.categoryId && window.categoriesData ? window.categoriesData[match.categoryId] : null);
            let teamNameForSearch = null;
            
            if (teamType === 'home') {
                teamNameForSearch = teamNames?.[match.homeTeamIdentifier] || match.homeTeamIdentifier;
            } else {
                teamNameForSearch = teamNames?.[match.awayTeamIdentifier] || match.awayTeamIdentifier;
            }
            
            if (window.db && teamNameForSearch && categoryNameForMatch) {
                try {
                    const usersRef = collection(window.db, 'users');
                    const usersSnapshot = await getDocs(usersRef);
                    
                    for (const userDoc of usersSnapshot.docs) {
                        const userData = userDoc.data();
                        const teams = userData.teams || {};
                        
                        for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                            if (categoryKey !== categoryNameForMatch) continue;
                            
                            const foundTeam = (teamsArray || []).find(t => t.teamName === teamNameForSearch);
                            
                            if (foundTeam) {
                                let memberExists = false;
                                
                                if (member.typeKey === 'playerDetails') {
                                    if (foundTeam.playerDetails && foundTeam.playerDetails[member.index]) {
                                        memberExists = true;
                                    }
                                } else if (member.typeKey === 'menTeamMemberDetails') {
                                    if (foundTeam.menTeamMemberDetails && foundTeam.menTeamMemberDetails[member.index]) {
                                        memberExists = true;
                                    }
                                } else if (member.typeKey === 'womenTeamMemberDetails') {
                                    if (foundTeam.womenTeamMemberDetails && foundTeam.womenTeamMemberDetails[member.index]) {
                                        memberExists = true;
                                    }
                                }
                                
                                if (memberExists) {
                                    userId = userDoc.id;
                                    break;
                                }
                            }
                        }
                        if (userId) break;
                    }
                } catch (err) {
                    console.error('Chyba pri vyhľadávaní userId:', err);
                }
            }
            
            // Aktualizujeme existujúcu udalosť
            const eventRef = doc(window.db, 'matchEvents', eventId);
            await updateDoc(eventRef, {
                eventType: newEventType,
                eventSubtype: newEventSubtype,
                team: teamType,
                memberType: member.type,
                memberTypeKey: member.typeKey,
                memberIndex: member.index,
                userId: userId,
                categoryName: categoryNameForMatch,
                updatedAt: Timestamp.now()
            });
            
            // Vyčistíme editáciu
            setEditingEventId(null);
            if (matchTimerRef.current && typeof matchTimerRef.current.clearEditingMode === 'function') {
                matchTimerRef.current.clearEditingMode();
            }
            if (matchTimerRef.current && typeof matchTimerRef.current.clearSelectedActions === 'function') {
                matchTimerRef.current.clearSelectedActions();
            }
            
            return true;
        } catch (err) {
            console.error('Chyba pri editácii udalosti:', err);
            return false;
        }
    };
    
    // Funkcia na zrušenie editácie
    const cancelEditing = () => {
        setEditingEventId(null);
        if (matchTimerRef.current && typeof matchTimerRef.current.clearEditingMode === 'function') {
            matchTimerRef.current.clearEditingMode();
        }
        if (matchTimerRef.current && typeof matchTimerRef.current.clearSelectedActions === 'function') {
            matchTimerRef.current.clearSelectedActions();
        }
    };
    
    // Získanie názvu kategórie z ID (pre vyhľadávanie členov tímu)
    const getCategoryDisplayName = () => {
        if (match.categoryName) return match.categoryName;
        if (match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
            return window.categoriesData[match.categoryId];
        }
        return null;
    };
    
    const categoryDisplayName = getCategoryDisplayName();
    
    // 🔥 FUNKCIA: Výpočet gólov z udalostí
    const calculateGoalsFromEvents = (events) => {
        let homeGoals = 0;
        let awayGoals = 0;
        
        events.forEach(event => {
            if (event.eventType === 'goal') {
                if (event.team === 'home') {
                    homeGoals++;
                } else if (event.team === 'away') {
                    awayGoals++;
                }
            }
        });
        
        return { homeGoals, awayGoals };
    };

    React.useEffect(() => {
        if (!window.db || !match.id) return;        
        
        // Listener pre všetky udalosti (modré karty)
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('eventType', '==', 'card'), where('eventSubtype', '==', 'blue'));
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {            
            if (match.homeTeamIdentifier && match.awayTeamIdentifier) {
                // Získame aktuálne dáta pre výpočet
                const homeTeamMatches = await loadTeamMatches(match.homeTeamIdentifier);
                const awayTeamMatches = await loadTeamMatches(match.awayTeamIdentifier);                
                const homeTeamDisplayLocal = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                const awayTeamDisplayLocal = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);                
                await calculateBlueCardSuspensionsRealTime(homeTeamMatches, awayTeamMatches, homeTeamDisplayLocal, awayTeamDisplayLocal);
            }
        }, (error) => {
            console.error('[BlueCard] Chyba pri real-time počúvaní modrých kariet:', error);
        });
        
        return () => {
            unsubscribe();
        };
    }, [match.id, match.homeTeamIdentifier, match.awayTeamIdentifier, teamNames]);

    React.useEffect(() => {
        loadSuspensionSettings();
    }, []);

    React.useEffect(() => {        
        if (match.id && homeTeamDisplay && awayTeamDisplay) {
            calculateBlueCardSuspensions();
        }
    }, [match.id, homeTeamDisplay, awayTeamDisplay, suspensionMatchesCount]);
    
    React.useEffect(() => {
        window.blueCardSuspensions = blueCardSuspensions;
        return () => {
            delete window.blueCardSuspensions;
        };
    }, [blueCardSuspensions]);

    React.useEffect(() => {
        window.onEventEdited = async (teamType, member, eventId) => {
            return await saveEditedEvent(teamType, member, eventId);
        };
        
        return () => {
            delete window.onEventEdited;
        };
    }, []);

    React.useEffect(() => {
        if (match.resetComplete || match.resetEvents) {
            setCalculatedHomeScore(0);
            setCalculatedAwayScore(0);
            setUseCalculatedScore(false);
        }
    }, [match.resetComplete, match.resetEvents]);
    
    React.useEffect(() => {
        const isMatchInProgress = currentMatchStatus === 'in-progress' || currentMatchStatus === 'paused';
    
        if (isMatchInProgress) {
            const { homeGoals, awayGoals } = calculateGoalsFromEvents(matchEvents);
            setCalculatedHomeScore(homeGoals);
            setCalculatedAwayScore(awayGoals);
            setUseCalculatedScore(true);
        } else {
            setUseCalculatedScore(false);
        }
    }, [matchEvents, currentMatchStatus]);
        
    const loadMatchEvents = async () => {
        if (!window.db || !match.id) return;
        
        try {
            const eventsRef = collection(window.db, 'matchEvents');
            const q = query(eventsRef, where('matchId', '==', match.id), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            const events = [];
            querySnapshot.forEach((doc) => {
                events.push({ id: doc.id, ...doc.data() });
            });
            setMatchEvents(events);
        } catch (err) {
            console.error('Chyba pri načítaní udalostí:', err);
        } finally {
            setEventsLoading(false);
        }
    };

    // Real-time listener pre udalosti
    React.useEffect(() => {
        if (!window.db || !match.id) return;
        
        loadMatchEvents();
        
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('matchId', '==', match.id), orderBy('timestamp', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const events = [];
            snapshot.forEach((doc) => {
                events.push({ id: doc.id, ...doc.data() });
            });
            setMatchEvents(events);
            setEventsLoading(false);
        }, (error) => {
            setEventsLoading(false);
        });
        
        return () => unsubscribe();
    }, [match.id]);
    
    const getDisplayScore = () => {
        if (currentMatchStatus === 'completed' && currentHomeScore !== undefined && currentHomeScore !== null) {
            return { home: currentHomeScore, away: currentAwayScore };
        }
        
        if (useCalculatedScore) {
            return { home: calculatedHomeScore, away: calculatedAwayScore };
        }
        
        if (currentHomeScore !== undefined && currentHomeScore !== null) {
            return { home: currentHomeScore, away: currentAwayScore };
        }
        
        return null;
    };
    
    const getMatchStatusText = () => {
        switch (currentMatchStatus) {
            case 'in-progress':
                return 'Práve prebieha';
            case 'paused':
                return 'Pozastavený';
            case 'completed':
                return 'Ukončený';
            case 'scheduled':
            default:
                return 'Naplánovaný';
        }
    };
    
    const getMatchStatusColor = () => {
        switch (currentMatchStatus) {
            case 'in-progress':
                return 'text-green-600 bg-green-50';
            case 'paused':
                return 'text-yellow-600 bg-yellow-50';
            case 'completed':
                return 'text-blue-600 bg-blue-50';
            case 'scheduled':
            default:
                return 'text-gray-500 bg-gray-50';
        }
    };

    const renderDeleteConfirmModal = () => {
        if (!showDeleteConfirmModal) return null;
        
        return React.createElement(
            'div',
            { 
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                onClick: () => !deleteLoading && setShowDeleteConfirmModal(false)
            },
            React.createElement(
                'div',
                { 
                    className: 'bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold text-gray-800 mb-4' },
                    'Vymazať udalosť'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-600 mb-6' },
                    'Naozaj chcete vymazať túto udalosť? Táto akcia je nevratná.'
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-3 justify-end' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setShowDeleteConfirmModal(false),
                            disabled: deleteLoading,
                            className: 'px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors cursor-pointer disabled:opacity-50'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: handleDeleteEvent,
                            disabled: deleteLoading,
                            className: 'px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2'
                        },
                        deleteLoading && React.createElement('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-white' }),
                        deleteLoading ? 'Mažem...' : 'Potvrdiť vymazanie'
                    )
                )
            )
        );
    };

    const renderMatchEvents = () => {
        const [memberDataCache, setMemberDataCache] = React.useState({});        
        const isMatchCompleted = currentMatchStatus === 'completed';        
        const loadMemberDetails = async (userId, categoryName, teamName, memberTypeKey, memberIndex, eventId) => {
            if (!userId || !memberTypeKey || memberIndex === undefined) {
                return { name: 'Neznámy hráč', jerseyNumber: '' };
            }            
            const cacheKey = `${userId}_${categoryName}_${teamName}_${memberTypeKey}_${memberIndex}`;
            if (memberDataCache[cacheKey]) {
                return memberDataCache[cacheKey];
            }            
            try {
                const userRef = doc(window.db, 'users', userId);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const teams = userData.teams || {};
                    
                    for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                        if (categoryKey !== categoryName) continue;
                        
                        const foundTeam = (teamsArray || []).find(t => t.teamName === teamName);
                        
                        if (foundTeam) {
                            let member = null;
                            
                            if (memberTypeKey === 'playerDetails' && foundTeam.playerDetails && foundTeam.playerDetails[memberIndex]) {
                                member = foundTeam.playerDetails[memberIndex];
                            } else if (memberTypeKey === 'menTeamMemberDetails' && foundTeam.menTeamMemberDetails && foundTeam.menTeamMemberDetails[memberIndex]) {
                                member = foundTeam.menTeamMemberDetails[memberIndex];
                            } else if (memberTypeKey === 'womenTeamMemberDetails' && foundTeam.womenTeamMemberDetails && foundTeam.womenTeamMemberDetails[memberIndex]) {
                                member = foundTeam.womenTeamMemberDetails[memberIndex];
                            }
                            
                            if (member) {
                                const memberData = {
                                    name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Neznámy hráč',
                                    jerseyNumber: member.jerseyNumber || ''
                                };
                                
                                // Uložíme do cache
                                setMemberDataCache(prev => ({ ...prev, [cacheKey]: memberData }));
                                return memberData;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Chyba pri načítaní člena:', err);
            }
            
            return { name: 'Neznámy hráč', jerseyNumber: '' };
        };
        
        const getEventIcon = (eventType, eventSubtype) => {
            switch (eventType) {
                case 'goal':
                    if (eventSubtype === 'converted_penalty') {
                        return React.createElement('i', { className: 'fa-solid fa-futbol text-green-600', style: { fontSize: '18px' } });
                    }
                    return React.createElement('i', { className: 'fa-solid fa-futbol text-black', style: { fontSize: '18px' } });
                case 'penalty':
                    return React.createElement('i', { className: 'fa-solid fa-futbol text-red-600', style: { fontSize: '18px' } });
                case 'card':
                    if (eventSubtype === 'yellow') return React.createElement('i', { className: 'fa-solid fa-square text-yellow-500', style: { fontSize: '18px' } });
                    if (eventSubtype === 'red') return React.createElement('i', { className: 'fa-solid fa-square text-red-600', style: { fontSize: '18px' } });
                    if (eventSubtype === 'blue') return React.createElement('i', { className: 'fa-solid fa-square text-blue-500', style: { fontSize: '18px' } });
                    return React.createElement('i', { className: 'fa-solid fa-id-card', style: { fontSize: '18px' } });
                case 'exclusion':
                    return React.createElement('i', { className: 'fa-solid fa-clock text-orange-600', style: { fontSize: '18px' } });
                case 'roster_removal':
                    return React.createElement('i', { className: 'fa-solid fa-user-slash text-orange-600', style: { fontSize: '18px' } });
                default:
                    return React.createElement('i', { className: 'fa-solid fa-circle-info', style: { fontSize: '18px' } });
            }
        };
        
        const formatMatchTime = (event) => {
            let seconds = event.totalTime;
            if (seconds === undefined || seconds === null) {
                seconds = event.matchTime;
            }
            if (seconds === undefined || seconds === null) {
                return '?:??';
            }
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
        
        const PlayerDisplay = ({ event, isHomeEvent }) => {
            const [memberData, setMemberData] = React.useState({ name: '', jerseyNumber: '' });
            const [loading, setLoading] = React.useState(true);
            
            // Získanie názvu tímu podľa toho, či ide o domáci alebo hosťujúci tím
            const teamName = isHomeEvent 
                ? (teamNames?.[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier))
                : (teamNames?.[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier));
            
            React.useEffect(() => {
                const loadData = async () => {
                    const data = await loadMemberDetails(
                        event.userId, 
                        event.categoryName, 
                        teamName,
                        event.memberTypeKey, 
                        event.memberIndex, 
                        event.id
                    );
                    setMemberData(data);
                    setLoading(false);
                };
                loadData();
            }, [event.userId, event.categoryName, teamName, event.memberTypeKey, event.memberIndex]);
            
            if (loading) {
                return React.createElement('span', { className: 'text-gray-400 text-xs' }, '');
            }
            
            const displayName = memberData.name;
            const jerseyNumber = memberData.jerseyNumber;
            
            if (isHomeEvent) {
                return React.createElement(
                    'div',
                    { className: 'flex items-center justify-end gap-2' },
                    React.createElement('span', { className: 'text-gray-800' }, displayName),
                    jerseyNumber && React.createElement(
                        'span',
                        { className: 'inline-flex items-center justify-center bg-gray-100 text-gray-600 rounded-full w-6 h-6 text-xs font-mono font-bold' },
                        jerseyNumber
                    )
                );
            } else {
                return React.createElement(
                    'div',
                    { className: 'flex items-center gap-2' },
                    jerseyNumber && React.createElement(
                        'span',
                        { className: 'inline-flex items-center justify-center bg-gray-100 text-gray-600 rounded-full w-6 h-6 text-xs font-mono font-bold' },
                        jerseyNumber
                    ),
                    React.createElement('span', { className: 'text-gray-800' }, displayName)
                );
            }
        };
        
        const getScoreAtEvent = (eventsSortedDesc, targetEvent) => {
            if (targetEvent.eventType !== 'goal') return null;
            
            let homeGoals = 0;
            let awayGoals = 0;
            
            // Prechádzame udalosti od konca (najstaršie) po začiatok (najnovšie)
            // aby sme správne vypočítali skóre v čase udalosti
            for (let i = eventsSortedDesc.length - 1; i >= 0; i--) {
                const event = eventsSortedDesc[i];
                
                // Započítame gól pred aktuálnou udalosťou (v chronologickom poradí)
                if (event.id !== targetEvent.id && event.eventType === 'goal') {
                    if (event.team === 'home') homeGoals++;
                    else if (event.team === 'away') awayGoals++;
                }
                
                // Ak sme narazili na aktuálnu udalosť, započítame ju a ukončíme
                if (event.id === targetEvent.id) {
                    if (targetEvent.team === 'home') homeGoals++;
                    else if (targetEvent.team === 'away') awayGoals++;
                    break;
                }
            }
            
            return { home: homeGoals, away: awayGoals };
        };
        
        const eventsSortedDesc = [...matchEvents]
            .filter(event => event.eventType !== 'roster_removal')
            .sort((a, b) => {
                const timeA = a.totalTime !== undefined ? a.totalTime : (a.matchTime || 0);
                const timeB = b.totalTime !== undefined ? b.totalTime : (b.matchTime || 0);
                
                if (timeA !== timeB) return timeB - timeA;
                
                // Ak je čas rovnaký, použijeme timestamp (novšie najprv)
                const timestampA = a.timestamp?.toDate?.()?.getTime() || a.createdAt?.toDate?.()?.getTime() || 0;
                const timestampB = b.timestamp?.toDate?.()?.getTime() || b.createdAt?.toDate?.()?.getTime() || 0;
                return timestampB - timestampA;
            });
        
        return React.createElement(
            'div',
            { className: 'mt-6 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
            React.createElement(
                'div',
                { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
                React.createElement('h3', { className: 'font-semibold text-center text-gray-800' }, 'Udalosti zápasu'),
            ),
            React.createElement(
                'div',
                { className: 'w-full' },
                eventsLoading ? 
                    React.createElement('div', { className: 'text-center py-8 text-gray-400' }, 
                        React.createElement('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto' }),
                        React.createElement('p', { className: 'text-sm mt-2' }, 'Načítavam udalosti...')
                    ) :
                    matchEvents.length === 0 ?
                        React.createElement('div', { className: 'text-center py-8 text-gray-400' },
                            React.createElement('i', { className: 'fa-regular fa-clock text-3xl mb-2 opacity-50' }),
                            React.createElement('p', { className: 'text-sm' }, 'Žiadne udalosti zápasu.')
                        ) :
                        React.createElement(
                            'table',
                            { className: 'min-w-full divide-y divide-gray-100' },
                            React.createElement(
                                'thead',
                                { className: 'bg-gray-50' },
                                React.createElement(
                                    'tr',
                                    null,
                                    React.createElement('th', { className: 'px-4 py-2 text-right text-xs font-medium text-gray-500 w-1/4' }, 'Domáci'),
                                    React.createElement('th', { className: 'px-4 py-2 text-center text-xs font-medium text-gray-500 w-16' }, 'Skóre'),
                                    React.createElement('th', { className: 'px-4 py-2 text-center text-xs font-medium text-gray-500 w-12' }, 'Udalosť'),
                                    React.createElement('th', { className: 'px-4 py-2 text-center text-xs font-medium text-gray-500 w-20' }, 'Čas'),
                                    React.createElement('th', { className: 'px-4 py-2 text-center text-xs font-medium text-gray-500 w-12' }, 'Udalosť'),
                                    React.createElement('th', { className: 'px-4 py-2 text-center text-xs font-medium text-gray-500 w-16' }, 'Skóre'),
                                    React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 w-1/4' }, 'Hostia')
                                )
                            ),
                            React.createElement(
                                'tbody',
                                { className: 'divide-y divide-gray-100' },
                                eventsSortedDesc.map((event, idx) => {
                                    const isHomeEvent = event.team === 'home';
                                    const isGoal = event.eventType === 'goal';
                                    const score = isGoal ? getScoreAtEvent(eventsSortedDesc, event) : null;
                                    
                                    const getActionTitle = () => {
                                        switch (event.eventType) {
                                            case 'goal': 
                                                if (event.eventSubtype === 'converted_penalty') return '7m (premenený)';
                                                return 'Gól';
                                            case 'penalty': 
                                                return '7m (nepremenený)';
                                            case 'card':
                                                if (event.eventSubtype === 'yellow') return 'Žltá karta';
                                                if (event.eventSubtype === 'red') return 'Červená karta';
                                                if (event.eventSubtype === 'blue') return 'Modrá karta';
                                                return 'Karta';
                                            case 'exclusion': 
                                                return 'Vylúčenie';
                                            case 'roster_removal':
                                                return 'Odstránený zo súpisky';
                                            default: 
                                                return 'Udalosť';
                                        }
                                    };
                                    
                                    const formattedTime = formatMatchTime(event);
                                    const isEditing = editingEventId === event.id;
                                    
                                    const rowHoverClass = isMatchCompleted ? '' : "group hover:bg-blue-50 transition-colors cursor-pointer";
                                    const rowClass = `${rowHoverClass} ${isEditing ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`;
                                    
                                    return React.createElement(
                                        'tr',
                                        { key: event.id, className: rowClass },
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-sm text-right' },
                                            isHomeEvent ? 
                                                React.createElement(PlayerDisplay, { event: event, isHomeEvent: true }) :
                                                React.createElement('div', {}, '')
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-center font-mono text-sm font-bold' },
                                            isGoal && isHomeEvent && score ? 
                                                React.createElement(
                                                    'span',
                                                    { className: 'inline-block px-2 py-0.5 rounded text-black-700' },
                                                    `${score.home}:${score.away}`
                                                ) :
                                                React.createElement('span', { className: 'text-gray-300' }, '')
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-center' },
                                            isHomeEvent && React.createElement(
                                                'div',
                                                { className: 'flex justify-center', title: getActionTitle() },
                                                getEventIcon(event.eventType, event.eventSubtype)
                                            )
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-center font-mono text-sm font-medium text-gray-600 relative' },
                                            !isEditing ? React.createElement(
                                                'div',
                                                { className: 'relative flex justify-center items-center min-w-[60px]' },
                                                React.createElement('span', { className: 'group-hover:hidden' }, formattedTime),
                                                !isMatchCompleted && React.createElement(
                                                    'div',
                                                    { 
                                                        className: 'hidden group-hover:flex items-center justify-center gap-3 absolute inset-0 bg-white rounded',
                                                        style: { backgroundColor: 'inherit' }
                                                    },
                                                    React.createElement(
                                                        'button',
                                                        {
                                                            onClick: (e) => startEditingEvent(event, e),
                                                            className: 'text-blue-500 hover:text-blue-700 p-1 rounded transition-colors cursor-pointer',
                                                            title: 'Upraviť udalosť'
                                                        },
                                                        React.createElement('i', { className: 'fa-solid fa-pen text-base' })
                                                    ),
                                                    React.createElement(
                                                        'button',
                                                        {
                                                            onClick: (e) => openDeleteConfirmModal(event, e),
                                                            className: 'text-red-500 hover:text-red-700 p-1 rounded transition-colors cursor-pointer',
                                                            title: 'Vymazať udalosť'
                                                        },
                                                        React.createElement('i', { className: 'fa-solid fa-trash-can text-base' })
                                                    )
                                                )
                                            ) : React.createElement(
                                                'div',
                                                { 
                                                    className: 'flex items-center justify-center gap-2',
                                                    style: { backgroundColor: '#FEF3C7', padding: '4px 8px', borderRadius: '8px' }
                                                },
                                                React.createElement('span', { className: 'text-yellow-700 font-semibold text-xs' }, 'EDIT'),
                                                React.createElement(
                                                    'button',
                                                    {
                                                        onClick: () => cancelEditing(),
                                                        className: 'text-gray-500 hover:text-gray-700 cursor-pointer',
                                                        title: 'Zrušiť editáciu'
                                                    },
                                                    React.createElement('i', { className: 'fa-solid fa-times text-sm' })
                                                )
                                            )
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-center' },
                                            !isHomeEvent && React.createElement(
                                                'div',
                                                { className: 'flex justify-center', title: getActionTitle() },
                                                getEventIcon(event.eventType, event.eventSubtype)
                                            )
                                        ),
                                        
                                        // Skóre pre hostí
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-center font-mono text-sm font-bold' },
                                            isGoal && !isHomeEvent && score ? 
                                                React.createElement(
                                                    'span',
                                                    { className: 'inline-block px-2 py-0.5 rounded text-black-700' },
                                                    `${score.home}:${score.away}`
                                                ) :
                                                React.createElement('span', { className: 'text-gray-300' }, '')
                                        ),
                                        
                                        // Stĺpec pre hostí (číslo dresu + meno)
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-sm text-left' },
                                            !isHomeEvent ? 
                                                React.createElement(PlayerDisplay, { event: event, isHomeEvent: false }) :
                                                React.createElement('div', {}, '')
                                        )
                                    );
                                })
                            )
                        )
            )
        );
    };

    React.useEffect(() => {
        if (homeTeamMappedName !== homeTeamDisplay && match.homeTeamIdentifier) {
            if (onMatchUpdate) {
                onMatchUpdate(match.id, { 
                    updatedHomeTeamName: homeTeamMappedName,
                    homeTeamIdentifier: match.homeTeamIdentifier
                });
            }
            if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                window.updateTeamNamesGlobally();
            }
        }
    }, [homeTeamMappedName]);
    
    React.useEffect(() => {
        if (awayTeamMappedName !== awayTeamDisplay && match.awayTeamIdentifier) {
            if (onMatchUpdate) {
                onMatchUpdate(match.id, { 
                    updatedAwayTeamName: awayTeamMappedName,
                    awayTeamIdentifier: match.awayTeamIdentifier
                });
            }
            if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                window.updateTeamNamesGlobally();
            }
        }
    }, [awayTeamMappedName]);

    React.useEffect(() => {
        if (!window.db || !match.id) return;

        const matchRef = doc(window.db, 'matches', match.id);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                const updatedMatch = docSnap.data();
                const newHomeScore = updatedMatch.homeScore;
                const newAwayScore = updatedMatch.awayScore;
                const newStatus = updatedMatch.status || 'scheduled';
            
                setCurrentHomeScore(newHomeScore);
                setCurrentAwayScore(newAwayScore);
                setCurrentMatchStatus(newStatus);
            
                if (onMatchUpdate) {
                    onMatchUpdate(match.id, { 
                        homeScore: newHomeScore, 
                        awayScore: newAwayScore,
                        status: newStatus
                    });
                }
            }
        });
    
        return () => unsubscribe();
    }, [match.id]);
    
    // Real-time počúvanie zmien statusu zápasu
    React.useEffect(() => {
        if (!window.db || !match.id) return;        
        
        const matchRef = doc(window.db, 'matches', match.id);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                const updatedMatch = docSnap.data();
                const newStatus = updatedMatch.status || 'scheduled';
                const oldStatus = currentMatchStatus;                
                
                setCurrentMatchStatus(newStatus);
                
                if (onMatchUpdate) {
                    onMatchUpdate(match.id, { status: newStatus });
                }
            }
        }, (error) => {
            console.error(`[MatchDetailView] Chyba pri počúvaní zápasu ${match.id}:`, error);
        });
        
        return () => {
            unsubscribe();
        };
    }, [match.id]);
    
    // Načítanie nastavení kategórie z databázy
    React.useEffect(() => {
        const loadCategorySettings = async () => {
            if (!window.db || !match.categoryId) {
                setLoadingSettings(false);
                return;
            }
            
            try {
                const settingsRef = doc(window.db, 'settings', 'categories');
                const settingsSnap = await getDoc(settingsRef);
                
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    const categoryData = data[match.categoryId];
                    if (categoryData) {
                        setCategorySettings({
                            periods: categoryData.periods ?? 2,
                            periodDuration: categoryData.periodDuration ?? 20,
                            breakDuration: categoryData.breakDuration ?? 2,
                            matchBreak: categoryData.matchBreak ?? 5,
                            timeoutCount: categoryData.timeoutCount ?? 2,
                            timeoutDuration: categoryData.timeoutDuration ?? 1,
                            exclusionTime: categoryData.exclusionTime ?? 2
                        });
                            periods: categoryData.periods ?? 2,
                            periodDuration: categoryData.periodDuration ?? 20
                        });
                    } else {
                        setCategorySettings({
                            periods: 2,
                            periodDuration: 20,
                            breakDuration: 2,
                            matchBreak: 5,
                            timeoutCount: 2,
                            timeoutDuration: 1,
                            exclusionTime: 2
                        });
                    }
                } else {
                    setCategorySettings({
                        periods: 2,
                        periodDuration: 20,
                        breakDuration: 2,
                        matchBreak: 5,
                        timeoutCount: 2,
                        timeoutDuration: 1,
                        exclusionTime: 2
                    });
                }
            } catch (err) {
                setCategorySettings({
                    periods: 2,
                    periodDuration: 20,
                    breakDuration: 2,
                    matchBreak: 5,
                    timeoutCount: 2,
                    timeoutDuration: 1,
                    exclusionTime: 2
                });
            } finally {
                setLoadingSettings(false);
            }
        };
        
        loadCategorySettings();
    }, [match.categoryId]);
    
    // Sledujeme zmeny match.status z props (napr. pri navigácii medzi zápasmi)
    React.useEffect(() => {
        if (match.status && match.status !== currentMatchStatus) {
            setCurrentMatchStatus(match.status);
        }
    }, [match.status]);
    
    // Získanie informácií o skupine
    let groupInfo = null;
    if (match.groupName && !match.isPlacementMatch) {
        groupInfo = getGroupTypeColors(match.groupName, match.categoryId, groupsData);
    }
    
    // Formátovanie dátumu pre detail
    const formattedDate = dateTime?.dateObj ? formatDateHeader(dateTime.dateObj) : 'Dátum neznámy';
    
    // Či existuje predchádzajúci a nasledujúci zápas
    const hasPrevious = currentMatchIndex > 0;
    const hasNext = currentMatchIndex < allMatches.length - 1;
    
    // Handler pre aktualizáciu časovača
    const handleTimeUpdate = (timeData) => {
        if (onMatchUpdate) {
            onMatchUpdate(match.id, {
                timerMinutes: timeData.minutes,
                timerSeconds: timeData.seconds,
                currentPeriod: timeData.period,
                timerRunning: timeData.isRunning
            });
        }
    };
    
    // Získanie aktuálneho skóre pre zobrazenie
    let finalDisplayScore = null;
    const isMatchInProgress = currentMatchStatus === 'in-progress' || currentMatchStatus === 'paused';

    if (isMatchInProgress && useCalculatedScore) {
        // Prebiehajúci zápas - vždy zobrazíme skóre z udalostí (aj 0:0)
        finalDisplayScore = { home: calculatedHomeScore, away: calculatedAwayScore };
    } else if (currentMatchStatus === 'completed' && currentHomeScore !== undefined && currentHomeScore !== null) {
        // Ukončený zápas s výsledkom v DB
        finalDisplayScore = { home: currentHomeScore, away: currentAwayScore };
    } else if (currentHomeScore !== undefined && currentHomeScore !== null) {
        // Existujúci výsledok v DB (napr. manuálne zadaný počas zápasu - ale to by nemalo nastať)
        finalDisplayScore = { home: currentHomeScore, away: currentAwayScore };
    }
    
    const showScore = finalDisplayScore !== null;
    
    return React.createElement(
        'div',
        { className: 'max-w-6xl mx-auto px-4 py-6' },
        
        // Hlavička s tlačidlami navigácie
        React.createElement(
            'div',
            { className: 'mb-6 flex flex-wrap items-center justify-between gap-3' },
            React.createElement(
                'button',
                {
                    onClick: onBack,
                    className: 'flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer'
                },
                React.createElement('i', { className: 'fa-solid fa-arrow-left' }),
                React.createElement('span', {}, 'Späť na zoznam zápasov')
            ),
            React.createElement(
                'div',
                { className: 'flex gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: () => hasPrevious && onNavigate('prev'),
                        disabled: !hasPrevious,
                        className: `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            hasPrevious 
                                ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`
                    },
                    React.createElement('i', { className: 'fa-solid fa-chevron-left' }),
                    React.createElement('span', {}, 'Predchádzajúci')
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => hasNext && onNavigate('next'),
                        disabled: !hasNext,
                        className: `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            hasNext 
                                ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`
                    },
                    React.createElement('span', {}, 'Nasledujúci'),
                    React.createElement('i', { className: 'fa-solid fa-chevron-right' })
                )
            )
        ),
        
        // Nadpis s názvom haly a poradím zápasu
        React.createElement(
            'div',
            { className: 'text-center mb-6' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Detail zápasu'),
            React.createElement(
                'div',
                { className: 'flex items-center justify-center gap-2 mt-1' },
                React.createElement('i', { className: 'fa-solid fa-location-dot text-blue-500 text-sm' }),
                React.createElement('span', { className: 'text-gray-600' }, hallInfo?.name || 'Športová hala')
            ),
            React.createElement(
                'p',
                { className: 'text-xs text-gray-400 mt-1' },
                `Zápas ${currentMatchIndex + 1} z ${allMatches.length}`
            )
        ),
        
        // Karta s detailom zápasu
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6' },
            
            // Hlavička zápasu - dátum, čas, typy
            React.createElement(
                'div',
                { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
                React.createElement(
                    'div',
                    { className: 'flex flex-wrap items-center justify-between gap-3' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-4' },
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-2' },
                            React.createElement('i', { className: 'fa-regular fa-calendar text-gray-400' }),
                            React.createElement('span', { className: 'text-gray-700 text-sm' }, formattedDate)
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-2' },
                            React.createElement('i', { className: 'fa-regular fa-clock text-gray-400' }),
                            React.createElement('span', { className: 'font-mono text-gray-700 text-sm' }, dateTime?.time || '--:--')
                        ),
                        // Zobrazenie stavu zápasu
                        React.createElement(
                            'div',
                            { className: `inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getMatchStatusColor()}` },
                            React.createElement('i', { 
                                className: currentMatchStatus === 'in-progress' ? 'fa-solid fa-play' :
                                          currentMatchStatus === 'paused' ? 'fa-solid fa-pause' :
                                          currentMatchStatus === 'completed' ? 'fa-solid fa-check' :
                                          'fa-regular fa-clock'
                            }),
                            React.createElement('span', {}, getMatchStatusText())
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-wrap gap-2' },
                        match.matchType && !match.isPlacementMatch && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-2 py-0.5 rounded-full',
                                style: {
                                    backgroundColor: matchColors.backgroundColor,
                                    color: matchColors.textColor,
                                    fontWeight: '500'
                                }
                            },
                            match.matchType
                        ),
                        match.isPlacementMatch && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-2 py-0.5 rounded-full',
                                style: {
                                    backgroundColor: ELIMINATION_COLORS.backgroundColor,
                                    color: ELIMINATION_COLORS.textColor,
                                    fontWeight: '500'
                                }
                            },
                            'o ' + match.placementRank + '. miesto'
                        ),
                        match.groupName && !match.isPlacementMatch && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-2 py-0.5 rounded-full',
                                style: {
                                    backgroundColor: groupInfo?.backgroundColor || matchColors.backgroundColor,
                                    color: groupInfo?.textColor || matchColors.textColor,
                                    fontWeight: '500'
                                }
                            },
                            match.groupName
                        ),
                        (match.categoryName || categoryDisplayName) && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-2 py-0.5 rounded-full',
                                style: {
                                    backgroundColor: lighterCategoryColor,
                                    color: categoryColor,
                                    fontWeight: '500'
                                }
                            },
                            match.categoryName || categoryDisplayName
                        )
                    )
                )
            ),
            
            // Výsledok zápasu - UPRAVENÝ pre dynamické zobrazenie skóre
            React.createElement(
                'div',
                { className: 'px-6 py-6 bg-gradient-to-r from-gray-50 to-white' },
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-3 gap-4 items-center' },
                    React.createElement(
                        'div',
                        { className: 'text-center' },
                        React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'DOMÁCI'),
                        React.createElement('div', { className: 'text-lg font-bold text-gray-800' }, homeTeamDisplay)
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-center' },
                        showScore && finalDisplayScore ?
                            React.createElement(
                                'div',
                                { className: 'flex items-center justify-center gap-3' },
                                React.createElement('span', { className: 'text-3xl font-bold text-gray-800' }, finalDisplayScore.home),
                                React.createElement('span', { className: 'text-xl text-gray-400' }, ':'),
                                React.createElement('span', { className: 'text-3xl font-bold text-gray-800' }, finalDisplayScore.away)
                            ) :
                            React.createElement(
                                'div',
                                { className: 'text-center' },
                                React.createElement('span', { className: 'text-lg text-gray-400 font-medium' }, 'VS'),
                                React.createElement('div', { className: 'text-xs text-gray-400 mt-1' }, getMatchStatusText())
                            )
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-center' },
                        React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'HOSTIA'),
                        React.createElement('div', { className: 'text-lg font-bold text-gray-800' }, awayTeamDisplay)
                    )
                )
            ),
            
            // Detailné informácie - typ zápasu a umiestnenie
            (match.matchType || (match.isPlacementMatch && match.placementRank)) && React.createElement(
                'div',
                { className: 'border-t border-gray-200 px-6 py-2' },
                React.createElement(
                    'div',
                    { className: 'flex flex-wrap gap-4 text-sm' },
                    match.matchType && React.createElement(
                        'div',
                        null,
                        React.createElement('span', { className: 'text-gray-500' }, 'Typ zápasu: '),
                        React.createElement('span', { className: 'text-gray-800' }, match.matchType)
                    ),
                    match.isPlacementMatch && match.placementRank && React.createElement(
                        'div',
                        null,
                        React.createElement('span', { className: 'text-gray-500' }, 'O umiestnenie: '),
                        React.createElement('span', { className: 'text-gray-800' }, match.placementRank + '. miesto')
                    )
                )
            )
        ),
        
        // Časovač zápasu
        !loadingSettings && React.createElement(MatchTimer, {
            ref: matchTimerRef,
            match: { ...match, status: currentMatchStatus, homeScore: currentHomeScore, awayScore: currentAwayScore },
            matchId: match.id,
            onTimeUpdate: handleTimeUpdate,
            categorySettings: categorySettings,
            teamNames: teamNames
        }),
        
        // Ak sa ešte načítavajú nastavenia, zobrazíme spinner
        loadingSettings && React.createElement(
            'div',
            { className: 'bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-4 text-white shadow-xl text-center' },
            React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto' }),
            React.createElement('p', { className: 'text-sm mt-2' }, 'Načítavam nastavenia časovača...')
        ),
        
        // Dva boxy s členmi tímov vedľa seba
        React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-2 gap-6 mt-6' },
            React.createElement(TeamMembersList, {
                teamName: homeTeamDisplay,
                categoryName: categoryDisplayName,
                teamType: 'home',
                timerRef: matchTimerRef,
                onMappedNameUpdate: setHomeTeamMappedName,
                matchId: match.id,
                periodDuration: categorySettings?.periodDuration || 15,
                blueCardSuspensions: blueCardSuspensions
            }),
            React.createElement(TeamMembersList, {
                teamName: awayTeamDisplay,
                categoryName: categoryDisplayName,
                teamType: 'away',
                timerRef: matchTimerRef,
                onMappedNameUpdate: setAwayTeamMappedName,
                matchId: match.id,
                periodDuration: categorySettings?.periodDuration || 15,
                blueCardSuspensions: blueCardSuspensions
            })
        ),
        
        // Box s udalosťami zápasu (pod boxmi členov tímov)
        renderMatchEvents(),
        renderDeleteConfirmModal()
    );
};

// Hlavný komponent MatchesHallApp - upravený s podporou URL parametrov a real-time aktualizáciou farieb tlačidiel
const MatchesHallApp = () => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hallInfo, setHallInfo] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [teamNames, setTeamNames] = useState({});
    const [categoryDrawColors, setCategoryDrawColors] = useState({});
    const [groupsData, setGroupsData] = useState({});
    const [categoriesData, setCategoriesData] = useState({});
    const [categoriesList, setCategoriesList] = useState([]);
    
    // Nové stavy pre detail zápasu
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [showingDetail, setShowingDetail] = useState(false);
    const [allMatchesList, setAllMatchesList] = useState([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    
    // Stav pre real-time aktualizáciu statusov zápasov
    const [matchStatuses, setMatchStatuses] = useState({});
    const [matchScoresFromEvents, setMatchScoresFromEvents] = useState({});    

    // V MatchesHallApp, pridajte túto funkciu
    const calculateGoalsFromEvents = (events) => {
        let homeGoals = 0;
        let awayGoals = 0;
    
        events.forEach(event => {
            if (event.eventType === 'goal') {
                if (event.team === 'home') homeGoals++;
                else if (event.team === 'away') awayGoals++;
            }
        });
        
        return { home: homeGoals, away: awayGoals };
    };
    
    // Funkcia na vytvorenie hash pre zápas
    const createMatchHash = (homeTeamId, awayTeamId) => {
        // Nahradíme medzery za pomlčky a potom zakódujeme
        const encodedHome = encodeURIComponent(homeTeamId.replace(/ /g, '-'));
        const encodedAway = encodeURIComponent(awayTeamId.replace(/ /g, '-'));
        return `#match/${encodedHome}/${encodedAway}`;
    };
    
    // Funkcia na parsovanie hash z URL
    const parseMatchHash = () => {
        const hash = window.location.hash;
        const matchPattern = /^#match\/([^/]+)\/([^/]+)$/;
        const match = hash.match(matchPattern);
        if (match) {
            // Dekódujeme a nahradíme pomlčky späť na medzery
            const homeTeamIdentifier = decodeURIComponent(match[1]).replace(/-/g, ' ');
            const awayTeamIdentifier = decodeURIComponent(match[2]).replace(/-/g, ' ');
            return {
                homeTeamIdentifier: homeTeamIdentifier,
                awayTeamIdentifier: awayTeamIdentifier
            };
        }
        return null;
    };
    
    // Funkcia na vyhľadanie zápasu podľa identifikátorov
    const findMatchByIdentifiers = (homeTeamIdentifier, awayTeamIdentifier, matchesList) => {
        return matchesList.findIndex(match => 
            match.homeTeamIdentifier === homeTeamIdentifier && 
            match.awayTeamIdentifier === awayTeamIdentifier
        );
    };
    
    // Funkcia na aktualizáciu URL pri zmene zápasu
    const updateUrlForMatch = (match) => {
        if (match && match.homeTeamIdentifier && match.awayTeamIdentifier) {
            const newHash = createMatchHash(match.homeTeamIdentifier, match.awayTeamIdentifier);
            // Použijeme replaceState aby sme neukladali každý krok do histórie zbytočne
            window.history.replaceState(null, '', newHash);
        }
    };
    
    // Funkcia na zobrazenie detailu zápasu podľa URL
    const showMatchFromUrl = (matchesList) => {
        const urlMatch = parseMatchHash();
        if (urlMatch && matchesList.length > 0) {
            const matchIndex = findMatchByIdentifiers(
                urlMatch.homeTeamIdentifier, 
                urlMatch.awayTeamIdentifier, 
                matchesList
            );
            if (matchIndex !== -1) {
                setSelectedMatch(matchesList[matchIndex]);
                setCurrentMatchIndex(matchIndex);
                setShowingDetail(true);
                // Nezabudneme nastaviť loading na false, ak už bol true
                setLoading(false);
                return true;
            }
        }
        // Ak sme nenašli zápas podľa URL, uistíme sa, že nie sme v detaile
        setShowingDetail(false);
        setSelectedMatch(null);
        return false;
    };
    
    // Funkcia na nastavenie real-time listenera pre zmeny statusov a výsledkov zápasov
    const setupMatchesRealTimeListener = (hallId) => {
        if (!window.db || !hallId) return;
        
        const matchesRef = collection(window.db, 'matches');
        
        // LOKÁLNA CACHE PRE STATUSY (mimo React state)
        let localMatchStatuses = {};
        
        // Inicializácia lokálnej cache z aktuálneho React state
        setMatchStatuses(prev => {
            localMatchStatuses = { ...prev };
            return prev;
        });
        
        // Premenná pre timeout, aby sme nehromadili viacero volaní
        let pendingUpdateTimeout = null;
        
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const updatedStatuses = {};
            const updatedMatches = [];
            let hasMatchCompletedAnywhere = false;
            let completedMatchesList = []; // Zoznam zápasov, ktoré boli dokončené
            
            snapshot.docChanges().forEach(change => {
                const match = {
                    id: change.doc.id,
                    ...change.doc.data()
                };
                
                const oldStatus = localMatchStatuses[match.id];
                const newStatus = match.status || 'scheduled';
                
                // 🔥 DETEGUJEME ZMENU NA completed (len pri zmene, nie pri prvom načítaní)
                if (change.type === 'modified' && oldStatus && oldStatus !== 'completed' && newStatus === 'completed') {
                    hasMatchCompletedAnywhere = true;
                    completedMatchesList.push({
                        id: match.id,
                        hallId: match.hallId,
                        category: match.categoryName,
                        group: match.groupName,
                        oldStatus: oldStatus,
                        newStatus: newStatus
                    });
                }
                
                // Aktualizujeme lokálnu cache
                localMatchStatuses[match.id] = newStatus;
                updatedStatuses[match.id] = newStatus;
                
                // Aktualizujeme matches pre našu halu
                if (match.hallId === hallId) {
                    updatedMatches.push(match);
                    
                    // Aktualizujeme matches (hlavný zoznam)
                    setMatches(prevMatches => {
                        const existingIndex = prevMatches.findIndex(m => m.id === match.id);
                        if (existingIndex !== -1) {
                            const updatedPrevMatches = [...prevMatches];
                            updatedPrevMatches[existingIndex] = { ...updatedPrevMatches[existingIndex], ...match };
                            return updatedPrevMatches;
                        } else {
                            return [...prevMatches, match];
                        }
                    });
                    
                    // Aktualizujeme allMatchesList (zoznam pre detail)
                    setAllMatchesList(prevList => {
                        const existingIndex = prevList.findIndex(m => m.id === match.id);
                        if (existingIndex !== -1) {
                            const updatedList = [...prevList];
                            updatedList[existingIndex] = { ...updatedList[existingIndex], ...match };
                            return updatedList;
                        } else {
                            return [...prevList, match];
                        }
                    });
                }
            });
            
            // Aktualizujeme React state matchStatuses (pre zobrazenie)
            if (Object.keys(updatedStatuses).length > 0) {
                setMatchStatuses(prev => ({ ...prev, ...updatedStatuses }));
            }
            
            if (hasMatchCompletedAnywhere) {                
                if (pendingUpdateTimeout) {
                    clearTimeout(pendingUpdateTimeout);
                }
                
                pendingUpdateTimeout = setTimeout(() => {
                    if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                        window.updateTeamNamesGlobally();
                    } else {
                        console.error('❌ window.updateTeamNamesGlobally nie je dostupný!');
                    }
                    pendingUpdateTimeout = null;
                }, 5000);
            }
            
            setMatches(prevMatches => {
                return [...prevMatches].sort((a, b) => {
                    if (!a.scheduledTime) return 1;
                    if (!b.scheduledTime) return -1;
                    try {
                        const timeA = a.scheduledTime.toDate().getTime();
                        const timeB = b.scheduledTime.toDate().getTime();
                        return timeA - timeB;
                    } catch (e) {
                        return 0;
                    }
                });
            });
            
            setAllMatchesList(prevList => {
                return [...prevList].sort((a, b) => {
                    if (!a.scheduledTime) return 1;
                    if (!b.scheduledTime) return -1;
                    try {
                        const timeA = a.scheduledTime.toDate().getTime();
                        const timeB = b.scheduledTime.toDate().getTime();
                        return timeA - timeB;
                    } catch (e) {
                        return 0;
                    }
                });
            });
            
        }, (error) => {
            console.error('Chyba pri real-time načítaní zápasov:', error);
        });
        
        // Cleanup funkcia pre timeout pri odpojení listenera
        const cleanup = () => {
            if (pendingUpdateTimeout) {
                clearTimeout(pendingUpdateTimeout);
                pendingUpdateTimeout = null;
            }
        };
        
        // Vrátime unsubscribe funkciu, ktorá zároveň vyčistí timeout
        return () => {
            cleanup();
            unsubscribe();
        };
    };

    // Načítanie farieb kategórií a názvov z databázy
    const loadCategoryColors = async () => {
        if (!window.db) return;
        
        try {
            const settingsRef = doc(window.db, 'settings', 'categories');
            const settingsSnap = await getDoc(settingsRef);
            
            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                const colors = {};
                const categories = {};
                const list = [];
                
                Object.entries(data).forEach(([catId, catData]) => {
                    if (catData.drawColor) {
                        colors[catId] = catData.drawColor;
                    }
                    if (catData.name) {
                        categories[catId] = catData.name;
                        list.push({ id: catId, name: catData.name });
                    }
                });
                
                setCategoryDrawColors(colors);
                setCategoriesData(categories);
                setCategoriesList(list);
                window.categoryDrawColors = colors;
                window.categoriesData = categories;
                window.categoriesList = list;
            }
        } catch (err) {
            console.error('Chyba pri načítaní farieb kategórií:', err);
        }
    };

    // Načítanie skupín z databázy
    const loadGroupsData = async () => {
        if (!window.db) return;
        
        try {
            const groupsRef = doc(window.db, 'settings', 'groups');
            const groupsSnap = await getDoc(groupsRef);
            
            if (groupsSnap.exists()) {
                const data = groupsSnap.data();
                setGroupsData(data);
                window.groupsData = data;
            }
        } catch (err) {
            console.error('Chyba pri načítaní skupín:', err);
        }
    };

    // Načítanie informácií o hale
    const loadHallInfo = async (hallId) => {
        if (!window.db || !hallId) return;
        
        try {
            const hallRef = doc(window.db, 'places', hallId);
            const hallSnap = await getDoc(hallRef);
            if (hallSnap.exists()) {
                setHallInfo({ id: hallSnap.id, ...hallSnap.data() });
            }
        } catch (err) {
            console.error('Chyba pri načítaní haly:', err);
        }
    };

    // Spracovanie názvov tímov pre všetky zápasy - ASYNCHRÓNNA VERZIA S MAPOVANÍM
    const processTeamNames = async (matches) => {
        const names = { ...teamNames };
        let needsUpdate = false;
        
        for (const match of matches) {
            // Získanie názvu kategórie pre tento zápas
            let categoryName = match.categoryName;
            if (!categoryName && match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
                categoryName = window.categoriesData[match.categoryId];
            }
            
            if (!categoryName) {
                continue;
            }
            
            // Spracovanie domáceho tímu
            if (match.homeTeamIdentifier) {
                const currentDisplayName = names[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                
                // 🔥 KONTROLA: Mapujeme LEN ak názov tímu obsahuje názov kategórie
                if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                    if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                        try {
                            const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                            if (newName && newName !== currentDisplayName && newName !== names[match.homeTeamIdentifier]) {
                                names[match.homeTeamIdentifier] = newName;
                                needsUpdate = true;
                            }
                        } catch (err) {
                            console.error(`Chyba pri mapovaní domáceho tímu ${currentDisplayName}:`, err);
                        }
                    }
                } else if (!names[match.homeTeamIdentifier]) {
                    names[match.homeTeamIdentifier] = currentDisplayName;
                }
            }
            
            if (match.awayTeamIdentifier) {
                const currentDisplayName = names[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                
                if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                    if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                        try {
                            const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                            if (newName && newName !== currentDisplayName && newName !== names[match.awayTeamIdentifier]) {
                                names[match.awayTeamIdentifier] = newName;
                                needsUpdate = true;
                            }
                        } catch (err) {
                            console.error(`Chyba pri mapovaní hosťujúceho tímu ${currentDisplayName}:`, err);
                        }
                    }
                } else if (!names[match.awayTeamIdentifier]) {
                    names[match.awayTeamIdentifier] = currentDisplayName;
                }
            }
        }
        
        if (needsUpdate) {
            setTeamNames(prev => ({ ...prev, ...names }));
        } else {
            setTeamNames(names);
        }
    };

    const loadMatches = async (hallId) => {
        if (!window.db) {
            setError('Databáza nie je inicializovaná');
            setLoading(false);
            return;
        }
    
        if (!hallId) {
            setError('Používateľ nemá priradenú žiadnu halu');
            setLoading(false);
            return;
        }
    
        setLoading(true);
        setError(null);
    
        try {
            const matchesRef = collection(window.db, 'matches');
            const querySnapshot = await getDocs(matchesRef);
            
            const hallMatches = [];
            const allStatuses = {};
            
            querySnapshot.forEach((doc) => {
                const match = {
                    id: doc.id,
                    ...doc.data()
                };
                
                // Uložíme status pre KAŽDÝ zápas v databáze (aj z iných hál)
                allStatuses[doc.id] = match.status || 'scheduled';
                
                if (match.hallId === hallId) {
                    hallMatches.push(match);
                }
            });
            
            hallMatches.sort((a, b) => {
                if (!a.scheduledTime) return 1;
                if (!b.scheduledTime) return -1;
                try {
                    const timeA = a.scheduledTime.toDate().getTime();
                    const timeB = b.scheduledTime.toDate().getTime();
                    return timeA - timeB;
                } catch (e) {
                    return 0;
                }
            });            
            setMatches(hallMatches);
            setAllMatchesList(hallMatches);            
            setMatchStatuses(allStatuses);            
            await processTeamNames(hallMatches);            
            const matchShown = showMatchFromUrl(hallMatches);
            if (!matchShown) {
                setLoading(false);
            }            
            const unsubscribe = setupMatchesRealTimeListener(hallId);            
            window.__matchesRealTimeUnsubscribe = unsubscribe;
            
        } catch (err) {
            setError('Nepodarilo sa načítať zápasy: ' + err.message);
            setLoading(false);
        }
    };
    const globalUpdateTeamNames = async () => {
        if (allMatchesList.length > 0) {
            await updateTeamNamesInMatches(allMatchesList, setTeamNames, teamNames);
        }
    };
    useEffect(() => {
        window.updateTeamNamesGlobally = globalUpdateTeamNames;
        
        return () => {
            delete window.updateTeamNamesGlobally;
        };
    }, [allMatchesList, teamNames]);
    
    const handleDetailClick = (match, index) => {
        setSelectedMatch(match);
        setCurrentMatchIndex(index);
        setShowingDetail(true);
        updateUrlForMatch(match);
        window.scrollTo(0, 0);
    };

    const handleNavigateMatch = (direction) => {
        let newIndex;
        if (direction === 'prev') {
            newIndex = currentMatchIndex - 1;
        } else {
            newIndex = currentMatchIndex + 1;
        }
        
        if (newIndex >= 0 && newIndex < allMatchesList.length) {
            const newMatch = allMatchesList[newIndex];
            setSelectedMatch(newMatch);
            setCurrentMatchIndex(newIndex);
            updateUrlForMatch(newMatch);
            window.scrollTo(0, 0);
        }
    };

    const refreshMatchInList = (matchId, updates) => {
        let teamNamesUpdates = {};
        if (updates.updatedHomeTeamName && updates.homeTeamIdentifier) {
            teamNamesUpdates[updates.homeTeamIdentifier] = updates.updatedHomeTeamName;
        }
        if (updates.updatedAwayTeamName && updates.awayTeamIdentifier) {
            teamNamesUpdates[updates.awayTeamIdentifier] = updates.updatedAwayTeamName;
        }
        
        // Ak máme aktualizácie názvov tímov, vykonáme ich
        if (Object.keys(teamNamesUpdates).length > 0) {
            setTeamNames(prev => ({ ...prev, ...teamNamesUpdates }));
        }
    
        // Aktualizujeme v matches
        setMatches(prevMatches => 
            prevMatches.map(m => m.id === matchId ? { ...m, ...updates } : m)
        );
    
        // Aktualizujeme v allMatchesList
        setAllMatchesList(prevList => 
            prevList.map(m => m.id === matchId ? { ...m, ...updates } : m)
        );
    
        // Aktualizujeme v selectedMatch ak je zobrazený
        if (selectedMatch && selectedMatch.id === matchId) {
            setSelectedMatch(prev => ({ ...prev, ...updates }));
        }
    };
    
    const handleMatchUpdate = (matchId, updates) => {
        // Ak update obsahuje resetComplete, znamená to že výsledok bol vymazaný
        if (updates.resetComplete) {
            // Špeciálne spracovanie pre reset - vymažeme výsledky
            refreshMatchInList(matchId, {
                homeScore: undefined,
                awayScore: undefined,
                status: 'scheduled'
            });
        } else {
            refreshMatchInList(matchId, updates);
        }
    };

    // Handler pre návrat z detailu
    const handleBackToList = () => {
        setSelectedMatch(null);
        setShowingDetail(false);
        setCurrentMatchIndex(0); // Reset indexu
        // Odstránime hash z URL
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };

    // Počúvanie na zmeny hash v URL
    useEffect(() => {
        const handleHashChange = () => {
            // Ak sme v detaile, skúsime nájsť zápas podľa URL
            if (allMatchesList.length > 0) {
                const urlMatch = parseMatchHash();
                if (urlMatch) {
                    const matchIndex = findMatchByIdentifiers(
                        urlMatch.homeTeamIdentifier,
                        urlMatch.awayTeamIdentifier,
                        allMatchesList
                    );
                    if (matchIndex !== -1 && (!showingDetail || selectedMatch?.homeTeamIdentifier !== urlMatch.homeTeamIdentifier)) {
                        setSelectedMatch(allMatchesList[matchIndex]);
                        setCurrentMatchIndex(matchIndex);
                        setShowingDetail(true);
                        window.scrollTo(0, 0);
                    }
                } else if (showingDetail) {
                    // Ak hash neexistuje a sme v detaile, vrátime sa na zoznam
                    setSelectedMatch(null);
                    setShowingDetail(false);
                }
            }
        };
        
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [allMatchesList, showingDetail, selectedMatch]);

    // Real-time listener pre skóre z udalostí (góly)
    useEffect(() => {
        if (!window.db) return;        
        
        const eventsRef = collection(window.db, 'matchEvents');
        
        const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
            // Skupinujeme góly podľa matchId
            const goalsByMatch = {};
            
            // Prvý prechod: zozbierame všetky matchId, ktoré majú góly
            snapshot.forEach(doc => {
                const event = doc.data();
                if (event.eventType === 'goal') {
                    if (!goalsByMatch[event.matchId]) {
                        goalsByMatch[event.matchId] = { home: 0, away: 0 };
                    }
                    if (event.team === 'home') {
                        goalsByMatch[event.matchId].home++;
                    } else if (event.team === 'away') {
                        goalsByMatch[event.matchId].away++;
                    }
                }
            });
            
            setMatchScoresFromEvents(prev => {
                const newScores = {};
                
                Object.keys(goalsByMatch).forEach(matchId => {
                    newScores[matchId] = goalsByMatch[matchId];
                });               
                
                return newScores;
            });
            
        }, (error) => {
            console.error('Chyba pri real-time počúvaní udalostí:', error);
        });
        
        return () => {
            unsubscribe();
        };
    }, [window.db]);
    
    useEffect(() => {
        return () => {
            if (window.__matchesRealTimeUnsubscribe && typeof window.__matchesRealTimeUnsubscribe === 'function') {
                window.__matchesRealTimeUnsubscribe();
            }
        };
    }, []);

    useEffect(() => {
        const init = async () => {
            if (window.globalUserProfileData) {
                setUserProfile(window.globalUserProfileData);
                const hallId = window.globalUserProfileData.hallId;
                if (hallId) {
                    await loadCategoryColors();
                    await loadGroupsData();
                    await loadHallInfo(hallId);
                    await loadMatches(hallId);
                } else {
                    setError('Používateľ nemá priradenú žiadnu halu');
                    setLoading(false);
                }
            }
        };

        if (window.globalUserProfileData) {
            init();
        } else {
            window.addEventListener('globalDataUpdated', init);
            return () => window.removeEventListener('globalDataUpdated', init);
        }
    }, []);

    const renderDetailButton = (match, dayIndex, matchIndex) => {
        const matchStatus = matchStatuses[match.id] || match.status || 'scheduled';
        const isActive = matchStatus === 'in-progress' || matchStatus === 'paused';

        const buttonClass = isActive 
            ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer'
            : 'bg-gray-200 hover:bg-gray-300 text-gray-900 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer';

        return React.createElement(
            'button',
            {
                onClick: () => {
                    let globalIndex = 0;
                    for (let i = 0; i < dayIndex; i++) {
                        globalIndex += matchesByDay[i].matches.length;
                    }
                    globalIndex += matchIndex;
                    handleDetailClick(match, globalIndex);
                },
                className: buttonClass,
                style: { fontWeight: '500' }
            },
            'Detail'
        );
    };

    const getMatchesByDay = () => {
        const groups = {};
        
        matches.forEach(match => {
            if (match.scheduledTime) {
                try {
                    const date = match.scheduledTime.toDate();
                    const dateKey = date.toDateString();
                    if (!groups[dateKey]) {
                        groups[dateKey] = {
                            date: date,
                            matches: []
                        };
                    }
                    groups[dateKey].matches.push(match);
                } catch(e) {}
            }
        });
        
        return Object.values(groups).sort((a, b) => a.date - b.date);
    };

    if (showingDetail && selectedMatch) {
        return React.createElement(MatchDetailView, {
            match: selectedMatch,
            teamNames: teamNames,
            onBack: handleBackToList,
            hallInfo: hallInfo,
            categoryDrawColors: categoryDrawColors,
            groupsData: groupsData,
            allMatches: allMatchesList,
            currentMatchIndex: currentMatchIndex,
            onNavigate: handleNavigateMatch,
            onMatchUpdate: handleMatchUpdate
        });
    }

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
            { className: 'bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center m-4' },
            React.createElement('i', { className: 'fa-solid fa-exclamation-triangle text-yellow-500 text-3xl mb-3' }),
            React.createElement('p', { className: 'text-yellow-700' }, error)
        );
    }

    const matchesByDay = getMatchesByDay();
    const totalMatches = matches.length;

    return React.createElement(
        'div',
        { className: 'max-w-7xl mx-auto px-4 py-6' },
        
        React.createElement(
            'div',
            { className: 'mb-8 text-center' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Zápasy'),
            React.createElement(
                'div',
                { className: 'flex items-center justify-center gap-2 mt-1' },
                React.createElement('i', { className: 'fa-solid fa-location-dot text-blue-500 text-sm' }),
                React.createElement('span', { className: 'text-gray-600' }, hallInfo?.name || 'Športová hala'),
                React.createElement('span', { className: 'text-gray-400 text-sm ml-2' }, `(${totalMatches} zápasov)`)
            )
        ),
        
        matchesByDay.length === 0 ? 
            React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl' },
                React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-5xl mb-3 opacity-50' }),
                React.createElement('p', { className: 'text-lg' }, 'Žiadne zápasy pre túto halu')
            ) :
            React.createElement(
                'div',
                { className: 'overflow-x-auto border border-gray-200 rounded-lg bg-white' },
                React.createElement(
                    'table',
                    { className: 'min-w-full divide-y divide-gray-200' },
                    
                    React.createElement(
                        'thead',
                        { className: 'bg-gray-50' },
                        React.createElement(
                            'tr',
                            null,
                            React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24' }, 'Čas'),
                            React.createElement('th', { className: 'px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Domáci'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20' }, 'VS'),
                            React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Hostia'),
                            React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48' }, 'Info'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20' }, '')
                        )
                    ),
                    
                    React.createElement(
                        'tbody',
                        { className: 'divide-y divide-gray-100' },
                        matchesByDay.map((dayGroup, dayIndex) => {
                            const dayMatches = dayGroup.matches;
                            const dayDate = dayGroup.date;
                            const dayRows = [];
                            
                            dayRows.push(
                                React.createElement(
                                    'tr',
                                    { key: `day-${dayIndex}`, className: 'bg-blue-50' },
                                    React.createElement(
                                        'td',
                                        { colSpan: 6, className: 'px-4 py-4 text-left' },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-2' },
                                            React.createElement('i', { className: 'fa-regular fa-calendar text-blue-500 text-lg' }),
                                            React.createElement('span', { className: 'font-semibold text-gray-800 text-base' }, formatDateHeader(dayDate)),
                                            React.createElement('span', { className: 'text-sm text-gray-500 ml-2' }, `(${dayMatches.length} zápasov)`)
                                        )
                                    )
                                )
                            );
                            
                            dayMatches.forEach((match, matchIndex) => {
                                const dateTime = formatMatchDateTime(match.scheduledTime);
                                const eventsScore = matchScoresFromEvents[match.id];
                                const matchStatus = matchStatuses[match.id] || match.status || 'scheduled';
                                const isMatchInProgress = matchStatus === 'in-progress' || matchStatus === 'paused';
                                const hasDbScore = match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null;
                            
                                let displayHomeScore = null;
                                let displayAwayScore = null;
                                let showScore = false;
                            
                                if (isMatchInProgress) {
                                    if (eventsScore && (eventsScore.home > 0 || eventsScore.away > 0)) {
                                        displayHomeScore = eventsScore.home;
                                        displayAwayScore = eventsScore.away;
                                    } else {
                                        displayHomeScore = 0;
                                        displayAwayScore = 0;
                                    }
                                    showScore = true;
                                } else if (hasDbScore) {
                                    displayHomeScore = match.homeScore;
                                    displayAwayScore = match.awayScore;
                                    showScore = true;
                                }
                                
                                const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                                const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                                
                                const categoryColor = getCategoryDrawColor(match.categoryId);
                                const lighterCategoryColor = getLighterColor(categoryColor);
                                
                                const matchColors = getMatchColors(match, groupsData);
                                
                                const infoTags = [];
                                
                                if (match.matchType && !match.isPlacementMatch) {
                                    infoTags.push(
                                        React.createElement('span', { 
                                            key: 'type',
                                            className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                            style: {
                                                backgroundColor: matchColors.backgroundColor,
                                                color: matchColors.textColor,
                                                fontWeight: '500'
                                            }
                                        },
                                        match.matchType
                                    ));
                                }
                                
                                if (match.isPlacementMatch) {
                                    infoTags.push(
                                        React.createElement('span', { 
                                            key: 'placement',
                                            className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                            style: {
                                                backgroundColor: ELIMINATION_COLORS.backgroundColor,
                                                color: ELIMINATION_COLORS.textColor,
                                                fontWeight: '500'
                                            }
                                        },
                                        `o ${match.placementRank}. miesto`
                                    ));
                                }
                                
                                if (match.groupName && !match.isPlacementMatch) {
                                    let groupColors;
                                    if (isEliminationMatch(match)) {
                                        groupColors = ELIMINATION_COLORS;
                                    } else {
                                        groupColors = getGroupTypeColors(match.groupName, match.categoryId, groupsData);
                                    }
                                    
                                    infoTags.push(
                                        React.createElement('span', { 
                                            key: 'group',
                                            className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                            style: {
                                                backgroundColor: groupColors.backgroundColor,
                                                color: groupColors.textColor,
                                                fontWeight: '500'
                                            }
                                        },
                                        match.groupName
                                    ));
                                }
                                
                                let categoryDisplayTag = match.categoryName;
                                if (!categoryDisplayTag && match.categoryId && categoriesData[match.categoryId]) {
                                    categoryDisplayTag = categoriesData[match.categoryId];
                                }
                                
                                if (categoryDisplayTag) {
                                    infoTags.push(
                                        React.createElement('span', { 
                                            key: 'category',
                                            className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                            style: {
                                                backgroundColor: lighterCategoryColor,
                                                color: categoryColor,
                                                fontWeight: '500'
                                            }
                                        },
                                        categoryDisplayTag
                                    ));
                                }
                                
                                dayRows.push(
                                    React.createElement(
                                        'tr',
                                        { key: `match-${dayIndex}-${matchIndex}`, className: 'hover:bg-gray-50 transition-colors' },
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3 whitespace-nowrap' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-1' },
                                                React.createElement('i', { className: 'fa-regular fa-clock text-gray-400 text-xs' }),
                                                React.createElement('span', { className: 'font-mono font-medium text-gray-700 text-sm' }, dateTime?.time || '--:--')
                                            )
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3 whitespace-nowrap text-right' },
                                            React.createElement('span', { className: 'font-medium text-gray-800 text-sm' }, homeTeamDisplay)
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                            showScore ?
                                                React.createElement(
                                                    'div',
                                                    { className: 'flex items-center justify-center gap-1' },
                                                    React.createElement('span', { className: 'font-bold text-gray-800' }, displayHomeScore),
                                                    React.createElement('span', { className: 'text-gray-400' }, ':'),
                                                    React.createElement('span', { className: 'font-bold text-gray-800' }, displayAwayScore)
                                                ) :
                                                React.createElement('span', { className: 'text-gray-400 font-medium text-sm' }, 'VS')
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3 whitespace-nowrap text-left' },
                                            React.createElement('span', { className: 'font-medium text-gray-800 text-sm' }, awayTeamDisplay)
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex flex-col gap-1' },
                                                infoTags
                                            )
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                            renderDetailButton(match, dayIndex, matchIndex)
                                        )
                                    )
                                );
                            });
                            
                            return dayRows;
                        }).flat()
                    )
                )
            )
    );
};

const renderApp = () => {
    const rootElement = document.getElementById('root');
    if (rootElement && ReactDOM) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MatchesHallApp));
    }
};

if (window.db && window.globalUserProfileData) {
    renderApp();
} else {
    window.addEventListener('globalDataUpdated', () => {
        if (window.db && window.globalUserProfileData) {
            renderApp();
        }
    });
    setTimeout(() => {
        if (window.db && window.globalUserProfileData) {
            renderApp();
        }
    }, 3000);
}

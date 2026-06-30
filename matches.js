// Nahraďte celý obsah súboru matches.js nasledujúcim kódom:

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
                        
                        let rowClassName = 'hover:bg-gray-50 transition-colors cursor-default';
                        
                        if (isRemovedFromRoster) {
                            rowClassName = 'hover:bg-orange-100 transition-colors cursor-default bg-orange-100';
                        } 
                        else if (isSuspendedByBlue) {
                            rowClassName = 'hover:bg-blue-100 transition-colors cursor-default bg-blue-100';
                        }
                        else if (isExcludedNormally) {
                            rowClassName = 'hover:bg-gray-100 transition-colors cursor-default bg-gray-100';
                        }
                        
                        let exclusionDisplayRow = null;
                        
                        if (isRemovedFromRoster) {
                            exclusionDisplayRow = React.createElement(
                                'tr',
                                { key: `removal-${idx}`, className: 'bg-orange-100' },
                                React.createElement('td', { colspan: 9, className: 'px-2 py-1 text-center' },
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
                                { key: `exclusion-${idx}`, className: 'bg-orange-100' },
                                React.createElement('td', { colspan: 9, className: 'px-2 py-1 text-center' },
                                    React.createElement(
                                        'div',
                                        { className: 'text-xs text-orange-700 font-medium flex items-center justify-center gap-1' },
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
                                { key: `blue-suspension-${idx}`, className: 'bg-blue-100' },
                                React.createElement('td', { colspan: 9, className: 'px-2 py-1 text-center' },
                                    React.createElement(
                                        'div',
                                        { className: 'text-xs text-blue-700 font-medium flex items-center justify-center gap-1' },
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
                                className: rowClassName
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
    
    const intervalRef = useRef(null);
    const isRunningRef = useRef(false);
    const startTimeRef = useRef(null);
    const localStartOffsetRef = useRef(0);
    const periodDurationRef = useRef(periodDuration);
    const totalPeriodsRef = useRef(totalPeriods);
    const periodRef = useRef(period);
    const displaySecondsRef = useRef(0);
    
    const matchTimerRef = useRef(null);

    useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
    useEffect(() => { periodDurationRef.current = periodDuration; }, [periodDuration]);
    useEffect(() => { totalPeriodsRef.current = totalPeriods; }, [totalPeriods]);
    useEffect(() => { periodRef.current = period; }, [period]);
    useEffect(() => { displaySecondsRef.current = displaySeconds; }, [displaySeconds]);

    const getTotalTime = () => {
        return calculateTotalMatchTime();
    };

    const calculateTotalMatchTime = () => {
        const periodLengthSeconds = periodDuration * 60;
        const currentPeriodTime = displaySeconds;

        let totalTime = currentPeriodTime;
        if (period > 1) {
            totalTime = ((period - 1) * periodLengthSeconds) + currentPeriodTime;
        }
        
        return totalTime;
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
                    currentPeriod: periodRef.current, 
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

    // V MatchTimer komponente, v useEffect pre onSnapshot
    useEffect(() => {
        if (!window.db || !matchId) return;
        
        const matchRef = doc(window.db, 'matches', matchId);
        
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (!docSnap.exists()) return;
            
            const data = docSnap.data();
            const serverStatus = data.status;
            let serverSeconds = data.manualTimeOffset || 0;
            let serverPeriod = data.currentPeriod || 1;
            
            if (serverPeriod !== periodRef.current) {
                setPeriod(serverPeriod);
                periodRef.current = serverPeriod;
            }
            
            if (serverStatus === 'in-progress' && data.startedAt) {
                const now = Date.now();
                const elapsed = Math.floor((now - data.startedAt.toDate().getTime()) / 1000);
                const periodLength = periodDurationRef.current * 60;
                serverSeconds = Math.min(serverSeconds + elapsed, periodLength);
            }
            
            // AK SA ZÁPAS VRÁTIL DO STAVU SCHEDULED - RESET ČASOVAČA
            if (serverStatus === 'scheduled') {
                // Zastavíme všetky bežiace intervaly
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                
                // Resetujeme všetky stavy
                setIsRunning(false);
                isRunningRef.current = false;
                startTimeRef.current = null;
                localStartOffsetRef.current = 0;
                
                // Resetujeme zobrazenie
                setDisplaySeconds(0);
                displaySecondsRef.current = 0;
                setPeriod(1);
                periodRef.current = 1;
                
                if (onTimeUpdate) {
                    onTimeUpdate({ 
                        totalSeconds: 0, 
                        period: 1, 
                        isRunning: false,
                        resetComplete: true
                    });
                }
                
                return; // Ukončíme spracovanie, aby sme neprepísali reset
            }
            
            const currentDisplayValue = displaySecondsRef.current;
            const difference = Math.abs(serverSeconds - currentDisplayValue);
            
            if (difference > 0.5) {
                setDisplaySeconds(serverSeconds);
                displaySecondsRef.current = serverSeconds;
                
                if (isRunningRef.current && serverStatus === 'in-progress') {
                    stopLocalInterval();
                    startLocalInterval(serverSeconds);
                }
                
                if (onTimeUpdate) {
                    onTimeUpdate({ 
                        totalSeconds: serverSeconds, 
                        period: serverPeriod, 
                        isRunning: isRunningRef.current 
                    });
                }
            }
            
            if (serverStatus === 'in-progress') {
                if (!isRunningRef.current) {
                    startLocalInterval(serverSeconds);
                    setIsRunning(true);
                    isRunningRef.current = true;
                    if (onTimeUpdate) onTimeUpdate({ totalSeconds: serverSeconds, period: serverPeriod, isRunning: true });
                }
            } else if (serverStatus === 'paused') {
                if (isRunningRef.current) {
                    stopLocalInterval();
                    setIsRunning(false);
                    isRunningRef.current = false;
                    if (onTimeUpdate) onTimeUpdate({ totalSeconds: serverSeconds, period: serverPeriod, isRunning: false });
                }
            } else if (serverStatus === 'completed') {
                if (isRunningRef.current) {
                    stopLocalInterval();
                    setIsRunning(false);
                    isRunningRef.current = false;
                }
            }
        }, (error) => {
        });
        
        return () => unsubscribe();
    }, [matchId]);

    useEffect(() => {
        if (!match) return;
        if (categorySettings) {
            if (categorySettings.periods !== undefined) setTotalPeriods(categorySettings.periods);
            if (categorySettings.periodDuration !== undefined) setPeriodDuration(categorySettings.periodDuration);
        }
        
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

    const formatTime = (totalSeconds) => {
        const totalMins = Math.floor(Math.max(0, totalSeconds) / 60);
        const totalSecs = Math.max(0, totalSeconds) % 60;
        return `${totalMins.toString().padStart(2, '0')}:${totalSecs.toString().padStart(2, '0')}`;
    };

    const isMatchCompleted = match?.status === 'completed';
    
    return React.createElement('div', { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
        React.createElement('div', { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
            React.createElement('h3', { className: 'font-semibold text-gray-800' }, 'Športový časovač'),
            React.createElement('p', { className: 'text-xs text-gray-500 mt-0.5' }, `Trvanie periódy: ${periodDuration} min | Počet periód: ${totalPeriods}`)
        ),
        React.createElement('div', { className: 'p-6' },
            React.createElement('div', { className: 'text-center' },
                React.createElement('div', { className: 'text-6xl font-mono font-bold text-gray-800' }, formatTime(displaySeconds)),
                React.createElement('div', { className: 'text-sm text-gray-500 mt-2' }, 
                    `Perióda ${period} / ${totalPeriods}`
                ),
                isMatchCompleted && React.createElement(
                    'div',
                    { className: 'mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700' },
                    React.createElement('i', { className: 'fa-solid fa-flag-checkered' }),
                    React.createElement('span', { className: 'font-medium' }, 'Zápas bol ukončený')
                )
            )
        )
    );
});

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
    
    const [categorySettings, setCategorySettings] = React.useState(null);
    const [loadingSettings, setLoadingSettings] = React.useState(true);
    
    const [currentMatchStatus, setCurrentMatchStatus] = React.useState(match.status || 'scheduled');

    const [homeTeamMappedName, setHomeTeamMappedName] = React.useState(homeTeamDisplay);
    const [awayTeamMappedName, setAwayTeamMappedName] = React.useState(awayTeamDisplay);
    
    const [matchEvents, setMatchEvents] = React.useState([]);
    const [eventsLoading, setEventsLoading] = React.useState(true);
    
    const [calculatedHomeScore, setCalculatedHomeScore] = React.useState(0);
    const [calculatedAwayScore, setCalculatedAwayScore] = React.useState(0);
    const [useCalculatedScore, setUseCalculatedScore] = React.useState(false);

    const [blueCardSuspensions, setBlueCardSuspensions] = React.useState({});
    const [suspensionMatchesCount, setSuspensionMatchesCount] = React.useState(1);
    const [allMatchesForTeam, setAllMatchesForTeam] = React.useState([]);

    const [hallName, setHallName] = React.useState(null);
    const [loadingHall, setLoadingHall] = React.useState(true);

    React.useEffect(() => {
        const loadHallName = async () => {
            if (!window.db || !match.hallId) {
                setLoadingHall(false);
                return;
            }

            try {
                const hallRef = doc(window.db, 'places', match.hallId);
                const hallSnap = await getDoc(hallRef);
                if (hallSnap.exists()) {
                    const hallData = hallSnap.data();
                    setHallName(hallData.name || 'Športová hala');
                } else {
                    setHallName('Športová hala');
                }
            } catch (err) {
                setHallName('Športová hala');
            } finally {
                setLoadingHall(false);
            }
        };

        loadHallName();
    }, [match.hallId]);

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
        }
    };

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
            
            teamMatches.sort((a, b) => {
                const timeA = a.scheduledTimeDate?.getTime() || 0;
                const timeB = b.scheduledTimeDate?.getTime() || 0;
                return timeA - timeB;
            });            
            return teamMatches;
        } catch (err) {
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
        }
    };

    const calculateBlueCardSuspensionsRealTime = async (homeTeamMatches, awayTeamMatches, homeTeamDisplayLocal, awayTeamDisplayLocal) => {
        if (!window.db || !match.id) return;
        
        try {
            const eventsRef = collection(window.db, 'matchEvents');
            const eventsSnapshot = await getDocs(eventsRef);
            
            const usersSnapshot = await getDocs(collection(window.db, 'users'));
            
            const suspensions = {};
            
            const currentMatchIndexHome = homeTeamMatches.findIndex(m => m.id === match.id);
            const currentMatchIndexAway = awayTeamMatches.findIndex(m => m.id === match.id);
            
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
        }
    };

    const getCategoryDisplayName = () => {
        if (match.categoryName) return match.categoryName;
        if (match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
            return window.categoriesData[match.categoryId];
        }
        return null;
    };
    
    const categoryDisplayName = getCategoryDisplayName();
    
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
        
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('eventType', '==', 'card'), where('eventSubtype', '==', 'blue'));
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {            
            if (match.homeTeamIdentifier && match.awayTeamIdentifier) {
                const homeTeamMatches = await loadTeamMatches(match.homeTeamIdentifier);
                const awayTeamMatches = await loadTeamMatches(match.awayTeamIdentifier);                
                const homeTeamDisplayLocal = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                const awayTeamDisplayLocal = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);                
                await calculateBlueCardSuspensionsRealTime(homeTeamMatches, awayTeamMatches, homeTeamDisplayLocal, awayTeamDisplayLocal);
            }
        }, (error) => {
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
        } finally {
            setEventsLoading(false);
        }
    };

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
                                
                                setMemberDataCache(prev => ({ ...prev, [cacheKey]: memberData }));
                                return memberData;
                            }
                        }
                    }
                }
            } catch (err) {
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
            
            for (let i = eventsSortedDesc.length - 1; i >= 0; i--) {
                const event = eventsSortedDesc[i];
                
                if (event.id !== targetEvent.id && event.eventType === 'goal') {
                    if (event.team === 'home') homeGoals++;
                    else if (event.team === 'away') awayGoals++;
                }
                
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
                                    
                                    const rowClass = 'hover:bg-gray-50 transition-colors';
                                    
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
                                            { className: 'px-4 py-2 text-center font-mono text-sm font-medium text-gray-600' },
                                            React.createElement('span', {}, formattedTime)
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
        });
        
        return () => {
            unsubscribe();
        };
    }, [match.id]);
    
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
    
    React.useEffect(() => {
        if (match.status && match.status !== currentMatchStatus) {
            setCurrentMatchStatus(match.status);
        }
    }, [match.status]);
    
    let groupInfo = null;
    if (match.groupName && !match.isPlacementMatch) {
        groupInfo = getGroupTypeColors(match.groupName, match.categoryId, groupsData);
    }
    
    const formattedDate = dateTime?.dateObj ? formatDateHeader(dateTime.dateObj) : 'Dátum neznámy';
    
    const hasPrevious = currentMatchIndex > 0;
    const hasNext = currentMatchIndex < allMatches.length - 1;
    
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
    
    let finalDisplayScore = null;
    const isMatchInProgress = currentMatchStatus === 'in-progress' || currentMatchStatus === 'paused';

    if (isMatchInProgress && useCalculatedScore) {
        finalDisplayScore = { home: calculatedHomeScore, away: calculatedAwayScore };
    } else if (currentMatchStatus === 'completed' && currentHomeScore !== undefined && currentHomeScore !== null) {
        finalDisplayScore = { home: currentHomeScore, away: currentAwayScore };
    } else if (currentHomeScore !== undefined && currentHomeScore !== null) {
        finalDisplayScore = { home: currentHomeScore, away: currentAwayScore };
    }
    
    const showScore = finalDisplayScore !== null;
    
    return React.createElement(
        'div',
        { className: 'max-w-6xl mx-auto px-4 py-6' },
        
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
            )
        ),
        
        React.createElement(
            'div',
            { className: 'text-center mb-6' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Detail zápasu'),
            React.createElement(
                'div',
                { className: 'flex items-center justify-center gap-2 mt-1' },
                React.createElement('i', { className: 'fa-solid fa-location-dot text-blue-500 text-sm' }),
                React.createElement('span', { className: 'text-gray-600' }, 
                    loadingHall ? 'Načítavam...' : (hallName || 'Športová hala')
                )
            )
        ),
        
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6' },
            
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
        
        !loadingSettings && currentMatchStatus !== 'completed' && React.createElement(MatchTimer, {
            ref: matchTimerRef,
            match: { ...match, status: currentMatchStatus, homeScore: currentHomeScore, awayScore: currentAwayScore },
            matchId: match.id,
            onTimeUpdate: handleTimeUpdate,
            categorySettings: categorySettings,
            teamNames: teamNames
        }),
        
        loadingSettings && React.createElement(
            'div',
            { className: 'bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-4 text-white shadow-xl text-center' },
            React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto' }),
            React.createElement('p', { className: 'text-sm mt-2' }, 'Načítavam nastavenia časovača...')
        ),
        
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
        
        renderMatchEvents()
    );
};

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
    
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [showingDetail, setShowingDetail] = useState(false);
    const [allMatchesList, setAllMatchesList] = useState([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [hallNames, setHallNames] = useState({});    
    
    const [matchStatuses, setMatchStatuses] = useState({});
    const [matchScoresFromEvents, setMatchScoresFromEvents] = useState({});
    
    const [teamNamesLoaded, setTeamNamesLoaded] = useState(false);
    const [matchScoresFromDb, setMatchScoresFromDb] = useState({});

    // --- STAVY PRE FILTROVANIE ---
    const [selectedDay, setSelectedDay] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [selectedHall, setSelectedHall] = useState(null);
    const [filteredMatches, setFilteredMatches] = useState([]);
    
    // --- STAV PRE ZOBRAZENIE SKUPÍN PRE VYBRANÚ KATEGÓRIU ---
    const [groupsForSelectedCategory, setGroupsForSelectedCategory] = useState([]);

    // --- STAV PRE SPRACOVANIE URL HASH PRI NAČÍTANÍ ---
    const [initialHashProcessed, setInitialHashProcessed] = useState(false);
    const [isHashChangeFromNavigation, setIsHashChangeFromNavigation] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // --- FUNKCIE PRE PRÁCU S URL FILTAMI ---
    const updateUrlFilters = (day, category, group, hall) => {
        const params = new URLSearchParams(window.location.search);
        
        if (day) {
            params.set('day', day);
        } else {
            params.delete('day');
        }
        
        // ULOŽÍME NÁZOV KATEGÓRIE (nie ID)
        if (category) {
            // Získame názov kategórie podľa ID
            let categoryName = category;
            if (categoriesData[category]) {
                categoryName = categoriesData[category];
            } else {
                // Skúsime nájsť podľa ID v zozname kategórií
                const found = categoriesList.find(c => c.id === category);
                if (found) {
                    categoryName = found.name;
                }
            }
            params.set('category', categoryName);
        } else {
            params.delete('category');
        }
        
        // ULOŽÍME NÁZOV HALY (nie ID)
        if (hall) {
            let hallName = hall;
            if (hallNames[hall]) {
                hallName = hallNames[hall];
            }
            params.set('hall', hallName);
        } else {
            params.delete('hall');
        }
        
        if (group) {
            params.set('group', group);
        } else {
            params.delete('group');
        }
        
        const newUrl = window.location.pathname + '?' + params.toString();
        window.history.replaceState(null, '', newUrl);
    };
    
    const parseUrlFilters = () => {
        const params = new URLSearchParams(window.location.search);
        const day = params.get('day') || null;
        let category = params.get('category') || null;
        let hall = params.get('hall') || null;
        const group = params.get('group') || null;
        
        // PREVEDIEME NÁZOV KATEGÓRIE NA ID
        if (category) {
            // Skúsime nájsť kategóriu podľa názvu v categoriesData
            let foundId = null;
            for (const [id, name] of Object.entries(categoriesData)) {
                if (name === category) {
                    foundId = id;
                    break;
                }
            }
            // Ak sme nenašli, skúsime v categoriesList
            if (!foundId && categoriesList.length > 0) {
                const found = categoriesList.find(c => c.name === category);
                if (found) {
                    foundId = found.id;
                }
            }
            category = foundId || category; // Ak nenájdené, necháme pôvodnú hodnotu
        }
        
        // PREVEDIEME NÁZOV HALY NA ID
        if (hall) {
            let foundId = null;
            for (const [id, name] of Object.entries(hallNames)) {
                if (name === hall) {
                    foundId = id;
                    break;
                }
            }
            hall = foundId || hall; // Ak nenájdené, necháme pôvodnú hodnotu
        }
        
        return {
            day: day,
            category: category,
            group: group,
            hall: hall
        };
    };

    const loadHallNames = async (matches) => {
        const hallIds = new Set();
        matches.forEach(match => {
            if (match.hallId) {
                hallIds.add(match.hallId);
            }
        });
    
        const names = { ...hallNames };
        let needsUpdate = false;
        
        for (const hallId of hallIds) {
            if (!names[hallId]) {
                try {
                    const hallRef = doc(window.db, 'places', hallId);
                    const hallSnap = await getDoc(hallRef);
                    if (hallSnap.exists()) {
                        const hallData = hallSnap.data();
                        names[hallId] = hallData.name || 'Športová hala';
                        needsUpdate = true;
                    } else {
                        names[hallId] = 'Športová hala';
                        needsUpdate = true;
                    }
                } catch (err) {
                    names[hallId] = 'Športová hala';
                    needsUpdate = true;
                }
            }
        }
        
        if (needsUpdate) {
            setHallNames(names);
        }
    };

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
    
    const createMatchHash = (homeTeamId, awayTeamId) => {
        const encodedHome = encodeURIComponent(homeTeamId.replace(/ /g, '-'));
        const encodedAway = encodeURIComponent(awayTeamId.replace(/ /g, '-'));
        return `#match/${encodedHome}/${encodedAway}`;
    };
    
    const parseMatchHash = () => {
        const hash = window.location.hash;
        const matchPattern = /^#match\/([^/]+)\/([^/]+)$/;
        const match = hash.match(matchPattern);
        if (match) {
            const homeTeamIdentifier = decodeURIComponent(match[1]).replace(/-/g, ' ');
            const awayTeamIdentifier = decodeURIComponent(match[2]).replace(/-/g, ' ');
            return {
                homeTeamIdentifier: homeTeamIdentifier,
                awayTeamIdentifier: awayTeamIdentifier
            };
        }
        return null;
    };
    
    const findMatchByIdentifiers = (homeTeamIdentifier, awayTeamIdentifier, matchesList) => {
        return matchesList.findIndex(match => 
            match.homeTeamIdentifier === homeTeamIdentifier && 
            match.awayTeamIdentifier === awayTeamIdentifier
        );
    };
    
    const updateUrlForMatch = (match) => {
        if (match && match.homeTeamIdentifier && match.awayTeamIdentifier) {
            const newHash = createMatchHash(match.homeTeamIdentifier, match.awayTeamIdentifier);
            const searchParams = window.location.search;
            window.history.replaceState(null, '', window.location.pathname + searchParams + newHash);
        }
    };
    
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
                return true;
            }
        }
        return false;
    };
    
    const setupMatchesRealTimeListener = (hallId) => {
        if (!window.db || !hallId) return;
        
        const matchesRef = collection(window.db, 'matches');
        
        let localMatchStatuses = {};
        let localMatchScores = {};
        
        setMatchStatuses(prev => {
            localMatchStatuses = { ...prev };
            return prev;
        });
        
        setMatchScoresFromDb(prev => {
            localMatchScores = { ...prev };
            return prev;
        });
        
        let pendingUpdateTimeout = null;
        
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const updatedStatuses = {};
            const updatedScores = {};
            const updatedMatches = [];
            let hasMatchCompletedAnywhere = false;
            let completedMatchesList = [];
            
            snapshot.docChanges().forEach(change => {
                const match = {
                    id: change.doc.id,
                    ...change.doc.data()
                };
                
                const oldStatus = localMatchStatuses[match.id];
                const newStatus = match.status || 'scheduled';
                
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
                
                localMatchStatuses[match.id] = newStatus;
                updatedStatuses[match.id] = newStatus;
                
                if (match.homeScore !== undefined || match.awayScore !== undefined) {
                    const score = {
                        home: match.homeScore,
                        away: match.awayScore
                    };
                    localMatchScores[match.id] = score;
                    updatedScores[match.id] = score;
                }
                
                if (match.hallId === hallId) {
                    updatedMatches.push(match);
                    
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
            
            if (Object.keys(updatedStatuses).length > 0) {
                setMatchStatuses(prev => ({ ...prev, ...updatedStatuses }));
            }
            
            if (Object.keys(updatedScores).length > 0) {
                setMatchScoresFromDb(prev => ({ ...prev, ...updatedScores }));
            }
            
            if (hasMatchCompletedAnywhere) {
                if (pendingUpdateTimeout) {
                    clearTimeout(pendingUpdateTimeout);
                }
                
                pendingUpdateTimeout = setTimeout(async () => {
                    if (allMatchesList.length > 0) {
                        await globalUpdateTeamNames();
                    }
                    pendingUpdateTimeout = null;
                }, 2000);
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
        });
        
        const cleanup = () => {
            if (pendingUpdateTimeout) {
                clearTimeout(pendingUpdateTimeout);
                pendingUpdateTimeout = null;
            }
        };
        
        return () => {
            cleanup();
            unsubscribe();
        };
    };

    useEffect(() => {
        if (!window.db) return;
        
        const matchesRef = collection(window.db, 'matches');
        
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const updatedStatuses = {};
            const updatedScores = {};
            
            snapshot.docChanges().forEach(change => {
                const match = {
                    id: change.doc.id,
                    ...change.doc.data()
                };
                
                const newStatus = match.status || 'scheduled';
                updatedStatuses[match.id] = newStatus;
                
                if (match.homeScore !== undefined || match.awayScore !== undefined) {
                    updatedScores[match.id] = {
                        home: match.homeScore,
                        away: match.awayScore
                    };
                }
            });
            
            if (Object.keys(updatedStatuses).length > 0) {
                setMatchStatuses(prev => ({ ...prev, ...updatedStatuses }));
            }
            
            if (Object.keys(updatedScores).length > 0) {
                setMatchScoresFromDb(prev => ({ ...prev, ...updatedScores }));
            }
        }, (error) => {
        });
        
        return () => unsubscribe();
    }, [window.db]);

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
        }
    };

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
        }
    };

    const loadHallInfo = async (hallId) => {
        if (!window.db || !hallId) return;
        
        try {
            const hallRef = doc(window.db, 'places', hallId);
            const hallSnap = await getDoc(hallRef);
            if (hallSnap.exists()) {
                setHallInfo({ id: hallSnap.id, ...hallSnap.data() });
            }
        } catch (err) {
        }
    };

    const processTeamNames = async (matches) => {
        const names = { ...teamNames };
        let needsUpdate = false;
        
        let attempts = 0;
        while (!window.matchTracker && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        if (!window.matchTracker) {
            for (const match of matches) {
                if (match.homeTeamIdentifier && !names[match.homeTeamIdentifier]) {
                    names[match.homeTeamIdentifier] = match.homeTeamIdentifier;
                }
                if (match.awayTeamIdentifier && !names[match.awayTeamIdentifier]) {
                    names[match.awayTeamIdentifier] = match.awayTeamIdentifier;
                }
            }
            setTeamNames(names);
            setTeamNamesLoaded(true);
            return;
        }
        
        for (const match of matches) {
            let categoryName = match.categoryName;
            if (!categoryName && match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
                categoryName = window.categoriesData[match.categoryId];
            }
            
            if (!categoryName) {
                if (match.categoryId) {
                    try {
                        const settingsRef = doc(window.db, 'settings', 'categories');
                        const settingsSnap = await getDoc(settingsRef);
                        if (settingsSnap.exists()) {
                            const catData = settingsSnap.data()[match.categoryId];
                            if (catData && catData.name) {
                                categoryName = catData.name;
                                if (!window.categoriesData) window.categoriesData = {};
                                window.categoriesData[match.categoryId] = categoryName;
                                setCategoriesData(prev => ({ ...prev, [match.categoryId]: categoryName }));
                            }
                        }
                    } catch (err) {
                    }
                }
                
                if (!categoryName) {
                    continue;
                }
            }
            
            if (match.homeTeamIdentifier) {
                const currentDisplayName = names[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                
                if (currentDisplayName && (currentDisplayName.includes(categoryName) || currentDisplayName === match.homeTeamIdentifier)) {
                    try {
                        const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                        if (newName && newName !== currentDisplayName && newName !== names[match.homeTeamIdentifier]) {
                            names[match.homeTeamIdentifier] = newName;
                            needsUpdate = true;
                        }
                    } catch (err) {
                    }
                } else if (!names[match.homeTeamIdentifier]) {
                    names[match.homeTeamIdentifier] = currentDisplayName;
                }
            }
            
            if (match.awayTeamIdentifier) {
                const currentDisplayName = names[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                
                if (currentDisplayName && (currentDisplayName.includes(categoryName) || currentDisplayName === match.awayTeamIdentifier)) {
                    try {
                        const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                        if (newName && newName !== currentDisplayName && newName !== names[match.awayTeamIdentifier]) {
                            names[match.awayTeamIdentifier] = newName;
                            needsUpdate = true;
                        }
                    } catch (err) {
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
        
        setTeamNamesLoaded(true);
    };

    console.log('=== matches.js sa načítava ===');

    const loadMatches = async (hallId) => {
        console.log('=== loadMatches bola zavolaná ===');
        console.log('hallId:', hallId);
    
        if (!window.db) {
            console.error('window.db nie je definované');
            setError('Databáza nie je inicializovaná');
            setLoading(false);
            return;
        }
        
        setLoading(true);
        setError(null);
    
        try {
            console.log('=== loadMatches ZAČIATOK ===');
            console.log('hallId:', hallId);
            
            const matchesRef = collection(window.db, 'matches');
            const querySnapshot = await getDocs(matchesRef);
            
            const hallMatches = [];
            const allStatuses = {};
            const allScores = {};
            
            querySnapshot.forEach((doc) => {
                const match = {
                    id: doc.id,
                    ...doc.data()
                };
                
                allStatuses[doc.id] = match.status || 'scheduled';
                
                if (match.homeScore !== undefined || match.awayScore !== undefined) {
                    allScores[doc.id] = {
                        home: match.homeScore,
                        away: match.awayScore
                    };
                }
                
                if (!hallId || match.hallId === hallId) {
                    hallMatches.push(match);
                }
            });
            
            console.log('Počet načítaných zápasov:', hallMatches.length);
            
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
            setMatchScoresFromDb(allScores);
    
            await loadHallNames(hallMatches);
            await processTeamNames(hallMatches);
            
            // --- DÔLEŽITÉ: NAČÍTAME groupsData PRED SPRACOVANÍM URL FILTROV ---
            // Kontrola, či máme groupsData načítané
            let groupsLoaded = Object.keys(groupsData).length > 0;
            console.log('groupsData načítané pred kontrolou:', groupsLoaded);
            console.log('groupsData obsah:', Object.keys(groupsData));
            
            if (!groupsLoaded) {
                try {
                    console.log('Načítavam groupsData zo servera...');
                    const groupsRef = doc(window.db, 'settings', 'groups');
                    const groupsSnap = await getDoc(groupsRef);
                    if (groupsSnap.exists()) {
                        const data = groupsSnap.data();
                        console.log('Načítané groupsData:', data);
                        setGroupsData(data);
                        window.groupsData = data;
                        // Aktualizujeme lokálnu premennú pre tento scope
                        Object.assign(groupsData, data);
                        groupsLoaded = true;
                    } else {
                        console.warn('groupsRef neexistuje v databáze');
                    }
                } catch (err) {
                    console.warn('Nepodarilo sa načítať groupsData v loadMatches:', err);
                }
            }
            
            // --- SPRACOVANIE URL FILTROV ---
            const urlFilters = parseUrlFilters();
            console.log('URL filtre:', urlFilters);
            
            let dayFilter = urlFilters.day;
            let categoryFilter = urlFilters.category;
            let groupFilter = urlFilters.group;
            let hallFilter = urlFilters.hall;
            
            console.log('Pôvodné filtre po parsovaní:');
            console.log('  dayFilter:', dayFilter);
            console.log('  categoryFilter:', categoryFilter);
            console.log('  groupFilter:', groupFilter);
            console.log('  hallFilter:', hallFilter);
            
            // KONTROLA EXISTENCIE DNA
            if (dayFilter) {
                const dayExists = hallMatches.some(match => {
                    if (!match.scheduledTime) return false;
                    try {
                        return match.scheduledTime.toDate().toDateString() === dayFilter;
                    } catch (e) { return false; }
                });
                console.log(`Deň "${dayFilter}" existuje:`, dayExists);
                if (!dayExists) dayFilter = null;
            }
            
            // KONTROLA EXISTENCIE KATEGÓRIE
            if (categoryFilter) {
                const categoryExists = hallMatches.some(match => {
                    if (match.categoryId === categoryFilter) return true;
                    if (match.categoryName === categoryFilter) return true;
                    if (match.categoryId && categoriesData[match.categoryId] === categoryFilter) return true;
                    return false;
                });
                console.log(`Kategória "${categoryFilter}" existuje:`, categoryExists);
                if (!categoryExists) categoryFilter = null;
            }
            
            // KONTROLA EXISTENCIE SKUPINY - TERAZ S SPRÁVNYMI DATAMI
            console.log('Spracúvam groupFilter:', groupFilter);
            console.log('groupsLoaded:', groupsLoaded);
            console.log('groupsData (aktuálne):', groupsData);
            
            if (groupFilter && groupsLoaded) {
                const isSpecialGroup = groupFilter === '__ALL_BASIC__' || groupFilter === '__ALL_ADVANCED__' || groupFilter === '__PLAYOFF__';
                console.log(`Group filter "${groupFilter}" je špeciálny:`, isSpecialGroup);
                
                if (isSpecialGroup) {
                    let hasMatches = false;
                    
                    if (groupFilter === '__PLAYOFF__') {
                        hasMatches = hallMatches.some(match => isEliminationMatch(match));
                        console.log(`  PLAYOFF - nájdené zápasy:`, hasMatches);
                    } else if (groupFilter === '__ALL_BASIC__') {
                        const basicGroupNames = [];
                        if (categoryFilter) {
                            const categoryGroups = groupsData[categoryFilter] || [];
                            console.log(`  Kategória "${categoryFilter}" - skupiny:`, categoryGroups);
                            categoryGroups.forEach(group => {
                                if (group.type === 'základná skupina') {
                                    basicGroupNames.push(group.name);
                                }
                            });
                        }
                        if (basicGroupNames.length === 0) {
                            Object.keys(groupsData).forEach(catId => {
                                const catGroups = groupsData[catId] || [];
                                catGroups.forEach(group => {
                                    if (group.type === 'základná skupina') {
                                        basicGroupNames.push(group.name);
                                    }
                                });
                            });
                        }
                        console.log(`  Všetky základné skupiny:`, basicGroupNames);
                        hasMatches = hallMatches.some(match => match.groupName && basicGroupNames.includes(match.groupName));
                        console.log(`  ALL_BASIC - nájdené zápasy:`, hasMatches);
                    } else if (groupFilter === '__ALL_ADVANCED__') {
                        const advancedGroupNames = [];
                        if (categoryFilter) {
                            const categoryGroups = groupsData[categoryFilter] || [];
                            console.log(`  Kategória "${categoryFilter}" - skupiny:`, categoryGroups);
                            categoryGroups.forEach(group => {
                                if (group.type === 'nadstavbová skupina') {
                                    advancedGroupNames.push(group.name);
                                }
                            });
                        }
                        if (advancedGroupNames.length === 0) {
                            Object.keys(groupsData).forEach(catId => {
                                const catGroups = groupsData[catId] || [];
                                catGroups.forEach(group => {
                                    if (group.type === 'nadstavbová skupina') {
                                        advancedGroupNames.push(group.name);
                                    }
                                });
                            });
                        }
                        console.log(`  Všetky nadstavbové skupiny:`, advancedGroupNames);
                        hasMatches = hallMatches.some(match => match.groupName && advancedGroupNames.includes(match.groupName));
                        console.log(`  ALL_ADVANCED - nájdené zápasy:`, hasMatches);
                    }
                    
                    if (!hasMatches) {
                        console.log(`  Žiadne zápasy pre filter "${groupFilter}", nastavujem na null`);
                        groupFilter = null;
                    } else {
                        console.log(`  Zachovávam filter "${groupFilter}"`);
                    }
                } else {
                    const groupExists = hallMatches.some(match => match.groupName === groupFilter);
                    console.log(`  Skupina "${groupFilter}" existuje:`, groupExists);
                    if (!groupExists) {
                        groupFilter = null;
                    }
                }
            } else if (groupFilter && !groupsLoaded) {
                console.warn('groupsData nie sú načítané, nechávam groupFilter:', groupFilter);
            }
            
            // KONTROLA EXISTENCIE HALY
            if (hallFilter) {
                const hallExists = hallMatches.some(match => {
                    if (match.hallId === hallFilter) return true;
                    const hallName = hallNames[match.hallId] || match.hallId;
                    return hallName === hallFilter || hallNames[match.hallId] === hallFilter;
                });
                console.log(`Hala "${hallFilter}" existuje:`, hallExists);
                if (!hallExists) hallFilter = null;
            }
            
            console.log('Konečné filtre po overení:');
            console.log('  dayFilter:', dayFilter);
            console.log('  categoryFilter:', categoryFilter);
            console.log('  groupFilter:', groupFilter);
            console.log('  hallFilter:', hallFilter);
            
            // NASTAVENIE FILTROV
            setSelectedDay(dayFilter);
            setSelectedCategory(categoryFilter);
            setSelectedGroup(groupFilter);
            setSelectedHall(hallFilter);
            
            // APLIKUJEME FILTRE NA VÝSLEDKY
            let result = [...hallMatches];
            console.log('Aplikujem filtre na výsledky, počet pred filtrovaním:', result.length);
            
            if (dayFilter) {
                result = result.filter(match => {
                    if (!match.scheduledTime) return false;
                    try {
                        return match.scheduledTime.toDate().toDateString() === dayFilter;
                    } catch (e) { return false; }
                });
                console.log(`Po filtri dňa "${dayFilter}":`, result.length);
            }
            
            if (categoryFilter) {
                result = result.filter(match => {
                    if (match.categoryId === categoryFilter) return true;
                    if (match.categoryName === categoryFilter) return true;
                    if (match.categoryId && categoriesData[match.categoryId] === categoryFilter) return true;
                    return false;
                });
                console.log(`Po filtri kategórie "${categoryFilter}":`, result.length);
            }
            
            // APLIKÁCIA FILTRA SKUPINY - S KONTROLOU, ČI MÁME groupsData
            if (groupFilter && groupsLoaded) {
                console.log(`Aplikujem filter skupiny "${groupFilter}"`);
                if (groupFilter === '__ALL_BASIC__') {
                    const basicGroupNames = [];
                    if (categoryFilter) {
                        const categoryGroups = groupsData[categoryFilter] || [];
                        categoryGroups.forEach(group => {
                            if (group.type === 'základná skupina') {
                                basicGroupNames.push(group.name);
                            }
                        });
                    }
                    if (basicGroupNames.length === 0) {
                        Object.keys(groupsData).forEach(catId => {
                            const catGroups = groupsData[catId] || [];
                            catGroups.forEach(group => {
                                if (group.type === 'základná skupina') {
                                    basicGroupNames.push(group.name);
                                }
                            });
                        });
                    }
                    console.log('  ZÁKLADNÉ skupiny:', basicGroupNames);
                    result = result.filter(match => {
                        return match.groupName && basicGroupNames.includes(match.groupName);
                    });
                } else if (groupFilter === '__ALL_ADVANCED__') {
                    const advancedGroupNames = [];
                    if (categoryFilter) {
                        const categoryGroups = groupsData[categoryFilter] || [];
                        categoryGroups.forEach(group => {
                            if (group.type === 'nadstavbová skupina') {
                                advancedGroupNames.push(group.name);
                            }
                        });
                    }
                    if (advancedGroupNames.length === 0) {
                        Object.keys(groupsData).forEach(catId => {
                            const catGroups = groupsData[catId] || [];
                            catGroups.forEach(group => {
                                if (group.type === 'nadstavbová skupina') {
                                    advancedGroupNames.push(group.name);
                                }
                            });
                        });
                    }
                    console.log('  NADSTAVBOVÉ skupiny:', advancedGroupNames);
                    result = result.filter(match => {
                        return match.groupName && advancedGroupNames.includes(match.groupName);
                    });
                } else if (groupFilter === '__PLAYOFF__') {
                    console.log('  FILTER PLAYOFF');
                    result = result.filter(match => {
                        return isEliminationMatch(match);
                    });
                } else {
                    console.log(`  FILTER skupina "${groupFilter}"`);
                    result = result.filter(match => {
                        return match.groupName === groupFilter;
                    });
                }
                console.log(`Po filtri skupiny "${groupFilter}":`, result.length);
            }
            
            // APLIKÁCIA FILTRA HALY
            if (hallFilter) {
                result = result.filter(match => {
                    if (match.hallId === hallFilter) return true;
                    const hallName = hallNames[match.hallId] || match.hallId;
                    return hallName === hallFilter || hallNames[match.hallId] === hallFilter;
                });
                console.log(`Po filtri haly "${hallFilter}":`, result.length);
            }
            
            console.log('Konečný počet výsledkov:', result.length);
            setFilteredMatches(result);
            
            const hasHash = window.location.hash && window.location.hash.startsWith('#match/');
            console.log('Má hash #match/:', hasHash);
            
            if (hasHash) {
                const matchShown = showMatchFromUrl(hallMatches);
                console.log('Zápas z hash nájdený:', matchShown);
                if (!matchShown) {
                    const searchParams = window.location.search;
                    window.history.replaceState(null, '', window.location.pathname + searchParams);
                    console.log('Hash nebol nájdený, odstránený');
                }
            }
            
            setInitialHashProcessed(true);
            setIsInitialLoad(false);
            
            if (!hasHash) {
                setLoading(false);
            }
            
            if (hallId) {
                const unsubscribe = setupMatchesRealTimeListener(hallId);
                window.__matchesRealTimeUnsubscribe = unsubscribe;
            } else {
                setLoading(false);
            }
            
            console.log('=== loadMatches KONIEC ===');
            
        } catch (err) {
            console.error('Chyba v loadMatches:', err);
            setError('Nepodarilo sa načítať zápasy: ' + err.message);
            setLoading(false);
        }
    };
    
    const globalUpdateTeamNames = async () => {
        if (allMatchesList.length === 0) return;        
        
        const names = { ...teamNames };
        let needsUpdate = false;
        
        if (!window.matchTracker || typeof window.matchTracker.getTeamNameByDisplayId !== 'function') {
            return;
        }
        
        for (const match of allMatchesList) {
            let categoryName = match.categoryName;
            if (!categoryName && match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
                categoryName = window.categoriesData[match.categoryId];
            }
            
            if (!categoryName) continue;
            
            if (match.homeTeamIdentifier) {
                const currentDisplayName = names[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                
                if (currentDisplayName && (currentDisplayName.includes(categoryName) || currentDisplayName === match.homeTeamIdentifier)) {
                    try {
                        const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                        if (newName && newName !== currentDisplayName && newName !== names[match.homeTeamIdentifier]) {
                            names[match.homeTeamIdentifier] = newName;
                            needsUpdate = true;
                        }
                    } catch (err) {
                    }
                } else if (!names[match.homeTeamIdentifier]) {
                    names[match.homeTeamIdentifier] = currentDisplayName;
                }
            }
            
            if (match.awayTeamIdentifier) {
                const currentDisplayName = names[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                
                if (currentDisplayName && (currentDisplayName.includes(categoryName) || currentDisplayName === match.awayTeamIdentifier)) {
                    try {
                        const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                        if (newName && newName !== currentDisplayName && newName !== names[match.awayTeamIdentifier]) {
                            names[match.awayTeamIdentifier] = newName;
                            needsUpdate = true;
                        }
                    } catch (err) {
                    }
                } else if (!names[match.awayTeamIdentifier]) {
                    names[match.awayTeamIdentifier] = currentDisplayName;
                }
            }
        }
        
        if (needsUpdate) {
            setTeamNames(prev => ({ ...prev, ...names }));
        }
    };
    
    useEffect(() => {
        window.updateTeamNamesGlobally = globalUpdateTeamNames;
        
        const interval = setInterval(() => {
            if (allMatchesList.length > 0) {
                let hasCompleted = false;
                for (const match of allMatchesList) {
                    const status = matchStatuses[match.id] || match.status || 'scheduled';
                    if (status === 'completed') {
                        hasCompleted = true;
                        break;
                    }
                }
                
                if (hasCompleted) {
                    globalUpdateTeamNames();
                }
            }
        }, 5000);
        
        return () => {
            delete window.updateTeamNamesGlobally;
            clearInterval(interval);
        };
    }, [allMatchesList, teamNames, matchStatuses]);
    
    const handleDetailClick = (match, index) => {
        setSelectedMatch(match);
        setCurrentMatchIndex(index);
        setShowingDetail(true);
        setIsHashChangeFromNavigation(true);
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
            setIsHashChangeFromNavigation(true);
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
        
        if (Object.keys(teamNamesUpdates).length > 0) {
            setTeamNames(prev => ({ ...prev, ...teamNamesUpdates }));
        }
    
        setMatches(prevMatches => 
            prevMatches.map(m => m.id === matchId ? { ...m, ...updates } : m)
        );
    
        setAllMatchesList(prevList => 
            prevList.map(m => m.id === matchId ? { ...m, ...updates } : m)
        );
    
        setFilteredMatches(prevList => 
            prevList.map(m => m.id === matchId ? { ...m, ...updates } : m)
        );
    
        if (selectedMatch && selectedMatch.id === matchId) {
            setSelectedMatch(prev => ({ ...prev, ...updates }));
        }
    };
    
    const handleMatchUpdate = (matchId, updates) => {
        if (updates.resetComplete) {
            refreshMatchInList(matchId, {
                homeScore: undefined,
                awayScore: undefined,
                status: 'scheduled'
            });
        } else {
            refreshMatchInList(matchId, updates);
        }
    };

    const handleBackToList = () => {
        setSelectedMatch(null);
        setShowingDetail(false);
        setCurrentMatchIndex(0);
        setIsHashChangeFromNavigation(true);
        
        const searchParams = window.location.search;
        window.history.replaceState(null, '', window.location.pathname + searchParams);
        
        if (!teamNamesLoaded && allMatchesList.length > 0) {
            processTeamNames(allMatchesList);
        }
    };

    useEffect(() => {
        const handleHashChange = () => {
            if (isHashChangeFromNavigation) {
                setIsHashChangeFromNavigation(false);
                return;
            }
            
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
                    setShowingDetail(false);
                    setSelectedMatch(null);
                }
            }
        };
        
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [allMatchesList, showingDetail, selectedMatch, isHashChangeFromNavigation]);

    useEffect(() => {
        const handleUrlChange = () => {
            console.log('=== handleUrlChange ===');
            console.log('showingDetail:', showingDetail);
            console.log('isInitialLoad:', isInitialLoad);
            console.log('initialHashProcessed:', initialHashProcessed);
            
            if (showingDetail) return;
            if (isInitialLoad) return;
            if (!initialHashProcessed) return;
            
            const urlFilters = parseUrlFilters();
            console.log('URL filtre v handleUrlChange:', urlFilters);
            
            let dayFilter = urlFilters.day;
            let categoryFilter = urlFilters.category;
            let groupFilter = urlFilters.group;
            let hallFilter = urlFilters.hall;
            
            // KONTROLA EXISTENCIE DNA
            if (dayFilter) {
                const dayExists = allMatchesList.some(match => {
                    if (!match.scheduledTime) return false;
                    try {
                        return match.scheduledTime.toDate().toDateString() === dayFilter;
                    } catch (e) { return false; }
                });
                if (!dayExists) dayFilter = null;
            }
            
            // KONTROLA EXISTENCIE KATEGÓRIE
            if (categoryFilter) {
                const categoryExists = allMatchesList.some(match => {
                    if (match.categoryId === categoryFilter) return true;
                    if (match.categoryName === categoryFilter) return true;
                    if (match.categoryId && categoriesData[match.categoryId] === categoryFilter) return true;
                    return false;
                });
                if (!categoryExists) categoryFilter = null;
            }
            
            // KONTROLA EXISTENCIE SKUPINY - PONECHAŤ ŠPECIÁLNE HODNOTY
            if (groupFilter) {
                const isSpecialGroup = groupFilter === '__ALL_BASIC__' || groupFilter === '__ALL_ADVANCED__' || groupFilter === '__PLAYOFF__';
                
                if (isSpecialGroup) {
                    let hasMatches = false;
                    
                    if (groupFilter === '__PLAYOFF__') {
                        hasMatches = allMatchesList.some(match => isEliminationMatch(match));
                    } else if (groupFilter === '__ALL_BASIC__') {
                        const basicGroupNames = [];
                        if (categoryFilter) {
                            const categoryGroups = groupsData[categoryFilter] || [];
                            categoryGroups.forEach(group => {
                                if (group.type === 'základná skupina') {
                                    basicGroupNames.push(group.name);
                                }
                            });
                        }
                        if (basicGroupNames.length === 0) {
                            Object.keys(groupsData).forEach(catId => {
                                const catGroups = groupsData[catId] || [];
                                catGroups.forEach(group => {
                                    if (group.type === 'základná skupina') {
                                        basicGroupNames.push(group.name);
                                    }
                                });
                            });
                        }
                        hasMatches = allMatchesList.some(match => match.groupName && basicGroupNames.includes(match.groupName));
                    } else if (groupFilter === '__ALL_ADVANCED__') {
                        const advancedGroupNames = [];
                        if (categoryFilter) {
                            const categoryGroups = groupsData[categoryFilter] || [];
                            categoryGroups.forEach(group => {
                                if (group.type === 'nadstavbová skupina') {
                                    advancedGroupNames.push(group.name);
                                }
                            });
                        }
                        if (advancedGroupNames.length === 0) {
                            Object.keys(groupsData).forEach(catId => {
                                const catGroups = groupsData[catId] || [];
                                catGroups.forEach(group => {
                                    if (group.type === 'nadstavbová skupina') {
                                        advancedGroupNames.push(group.name);
                                    }
                                });
                            });
                        }
                        hasMatches = allMatchesList.some(match => match.groupName && advancedGroupNames.includes(match.groupName));
                    }
                    
                    if (!hasMatches) {
                        groupFilter = null;
                    }
                    // Ak existujú zápasy, PONECHÁME groupFilter (napr. '__ALL_BASIC__')
                } else {
                    const groupExists = allMatchesList.some(match => match.groupName === groupFilter);
                    if (!groupExists) {
                        groupFilter = null;
                    }
                }
            }
            
            // KONTROLA EXISTENCIE HALY
            if (hallFilter) {
                const hallExists = allMatchesList.some(match => {
                    if (match.hallId === hallFilter) return true;
                    const hallName = hallNames[match.hallId] || match.hallId;
                    return hallName === hallFilter || hallNames[match.hallId] === hallFilter;
                });
                if (!hallExists) hallFilter = null;
            }
            
            console.log('Nastavujem filtre v handleUrlChange:');
            console.log('  dayFilter:', dayFilter);
            console.log('  categoryFilter:', categoryFilter);
            console.log('  groupFilter:', groupFilter);
            console.log('  hallFilter:', hallFilter);
            
            // NASTAVENIE FILTROV IBA AK SA ZMENILI
            if (selectedDay !== dayFilter) setSelectedDay(dayFilter);
            if (selectedCategory !== categoryFilter) setSelectedCategory(categoryFilter);
            if (selectedGroup !== groupFilter) {
                console.log('Zmena selectedGroup z', selectedGroup, 'na', groupFilter);
                setSelectedGroup(groupFilter);
            }
            if (selectedHall !== hallFilter) setSelectedHall(hallFilter);
        };
        
        window.addEventListener('popstate', handleUrlChange);
        return () => window.removeEventListener('popstate', handleUrlChange);
    }, [allMatchesList, categoriesData, hallNames, showingDetail, selectedDay, selectedCategory, selectedGroup, selectedHall, initialHashProcessed, isInitialLoad]);

    useEffect(() => {
        if (!window.db) return;        
        
        const eventsRef = collection(window.db, 'matchEvents');
        
        const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
            const goalsByMatch = {};
            
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
        console.log('=== useEffect pre selectedCategory ===');
        console.log('selectedCategory:', selectedCategory);
    
        if (selectedCategory) {
            const categoryId = selectedCategory;
            const categoryGroups = groupsData[categoryId] || [];
            setGroupsForSelectedCategory(categoryGroups);
        
            // TOTO MÔŽE BYŤ PROBLÉM - resetuje selectedGroup na null
            if (selectedGroup) {
                const groupExists = categoryGroups.some(g => g.name === selectedGroup);
                // Skontrolujeme aj špeciálne hodnoty
                const isSpecialGroup = selectedGroup === '__ALL_BASIC__' || 
                                      selectedGroup === '__ALL_ADVANCED__' || 
                                      selectedGroup === '__PLAYOFF__';
                
                // Ak skupina neexistuje a nie je špeciálna, resetujeme
                if (!groupExists && !isSpecialGroup) {
                    console.log('Skupina neexistuje, resetujem na null');
                    setSelectedGroup(null);
                } else {
                    console.log('Skupina existuje alebo je špeciálna, ponechávam:', selectedGroup);
                }
            }
        } else {
            setGroupsForSelectedCategory([]);
            setSelectedGroup(null);
        }
    }, [selectedCategory, groupsData]);

    useEffect(() => {
        console.log('=== useEffect pre filtrovanie ===');
        console.log('selectedGroup:', selectedGroup);
        console.log('allMatchesList.length:', allMatchesList.length);
    
        // SKIPNUTIE POČAS INICIALIZÁCIE - ak ešte nebol initialHashProcessed, preskočíme
        if (!initialHashProcessed) {
            console.log('initialHashProcessed je false, preskakujem');
            return;
        }
        
        if (allMatchesList.length === 0) {
            console.log('allMatchesList je prázdne, return');
            return;
        }
        
        if (showingDetail) {
            console.log('showingDetail je true, return');
            return;
        }
        
        let result = [...allMatchesList];
        console.log('result počiatočný:', result.length);
        
        if (selectedDay !== null) {
            result = result.filter(match => {
                if (!match.scheduledTime) return false;
                try {
                    const date = match.scheduledTime.toDate();
                    const dateKey = date.toDateString();
                    return dateKey === selectedDay;
                } catch (e) {
                    return false;
                }
            });
        }
        
        if (selectedCategory !== null) {
            result = result.filter(match => {
                if (match.categoryId === selectedCategory) return true;
                if (match.categoryName === selectedCategory) return true;
                if (match.categoryId && categoriesData[match.categoryId] === selectedCategory) return true;
                return false;
            });
        }
        
        if (selectedGroup !== null) {
            if (selectedGroup === '__ALL_BASIC__') {
                const basicGroupNames = [];
                if (selectedCategory) {
                    const categoryGroups = groupsData[selectedCategory] || [];
                    categoryGroups.forEach(group => {
                        if (group.type === 'základná skupina') {
                            basicGroupNames.push(group.name);
                        }
                    });
                }
                if (basicGroupNames.length === 0) {
                    Object.keys(groupsData).forEach(catId => {
                        const catGroups = groupsData[catId] || [];
                        catGroups.forEach(group => {
                            if (group.type === 'základná skupina') {
                                basicGroupNames.push(group.name);
                            }
                        });
                    });
                }
                result = result.filter(match => {
                    return match.groupName && basicGroupNames.includes(match.groupName);
                });
            } else if (selectedGroup === '__ALL_ADVANCED__') {
                const advancedGroupNames = [];
                if (selectedCategory) {
                    const categoryGroups = groupsData[selectedCategory] || [];
                    categoryGroups.forEach(group => {
                        if (group.type === 'nadstavbová skupina') {
                            advancedGroupNames.push(group.name);
                        }
                    });
                }
                if (advancedGroupNames.length === 0) {
                    Object.keys(groupsData).forEach(catId => {
                        const catGroups = groupsData[catId] || [];
                        catGroups.forEach(group => {
                            if (group.type === 'nadstavbová skupina') {
                                advancedGroupNames.push(group.name);
                            }
                        });
                    });
                }
                result = result.filter(match => {
                    return match.groupName && advancedGroupNames.includes(match.groupName);
                });
            } else if (selectedGroup === '__PLAYOFF__') {
                result = result.filter(match => {
                    return isEliminationMatch(match);
                });
            } else {
                result = result.filter(match => {
                    return match.groupName === selectedGroup;
                });
            }
        }
        
        if (selectedHall !== null) {
            result = result.filter(match => {
                if (match.hallId === selectedHall) return true;
                const hallName = hallNames[match.hallId] || match.hallId;
                return hallName === selectedHall || hallNames[match.hallId] === selectedHall;
            });
        }
        
        setFilteredMatches(result);
        
        // --- OPRAVA: Aktualizujeme URL IBA AK SA FILTER ZMENIL POUŽÍVATEĽOM ---
        if (!showingDetail && !isInitialLoad) {
            const urlFilters = parseUrlFilters();
            const currentGroup = urlFilters.group;
            const currentCategory = urlFilters.category;
            const currentDay = urlFilters.day;
            const currentHall = urlFilters.hall;
            
            // Skontrolujeme, či sa niektorý filter zmenil oproti URL
            const groupChanged = selectedGroup !== currentGroup;
            const categoryChanged = selectedCategory !== currentCategory;
            const dayChanged = selectedDay !== currentDay;
            const hallChanged = selectedHall !== currentHall;
            
            // Aktualizujeme URL IBA ak sa filter naozaj zmenil
            if (groupChanged || categoryChanged || dayChanged || hallChanged) {
                updateUrlFilters(selectedDay, selectedCategory, selectedGroup, selectedHall);
            }
        }
        
    }, [selectedDay, selectedCategory, selectedGroup, selectedHall, allMatchesList, categoriesData, hallNames, showingDetail, isInitialLoad]);

    useEffect(() => {
        const init = async () => {
            await loadCategoryColors();
            await loadGroupsData();
            
            if (window.globalUserProfileData) {
                setUserProfile(window.globalUserProfileData);
                const hallId = window.globalUserProfileData.hallId;
                if (hallId) {
                    await loadHallInfo(hallId);
                    await loadMatches(hallId);
                } else {
                    await loadMatches(null);
                }
            } else {
                await loadMatches(null);
            }
        };
    
        init();
    }, []);

    useEffect(() => {
        if (teamNamesLoaded && matches.length > 0) {
            setMatches(prevMatches => [...prevMatches]);
            setAllMatchesList(prevList => [...prevList]);
            setFilteredMatches(prevList => [...prevList]);
        }
    }, [teamNamesLoaded, teamNames]);

    const renderDetailButton = (match, dayIndex, matchIndex, matchesByDay) => {
        const matchStatus = matchStatuses[match.id] || match.status || 'scheduled';
        const isActive = matchStatus === 'in-progress' || matchStatus === 'paused';

        const buttonClass = isActive 
            ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer'
            : 'bg-gray-200 hover:bg-gray-300 text-gray-900 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer';

        return React.createElement(
            'button',
            {
                onClick: () => {
                    const matchIndexInAll = allMatchesList.findIndex(m => m.id === match.id);
                    if (matchIndexInAll !== -1) {
                        handleDetailClick(match, matchIndexInAll);
                    } else {
                        handleDetailClick(match, currentMatchIndex);
                    }
                },
                className: buttonClass,
                style: { fontWeight: '500' }
            },
            'Detail'
        );
    };

    const getMatchesByDay = (matchesList) => {
        const groups = {};
        
        matchesList.forEach(match => {
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

    // Zistíme, či sú aktívne nejaké filtre
    const hasFilters = selectedDay !== null || selectedCategory !== null || selectedGroup !== null || selectedHall !== null;
    
    // Rozhodneme, ktoré zápasy zobraziť
    let displayMatches;
    let displayDays;
    let totalMatches;
    
    if (hasFilters) {
        // Ak máme filtre, použijeme filteredMatches
        displayMatches = filteredMatches;
        displayDays = getMatchesByDay(filteredMatches);
        totalMatches = filteredMatches.length;
    } else {
        // Ak nemáme filtre, zobrazíme všetky zápasy
        displayMatches = allMatchesList;
        displayDays = getMatchesByDay(allMatchesList);
        totalMatches = allMatchesList.length;
    }

    const allDays = getMatchesByDay(allMatchesList);

    const uniqueCategories = [];
    const categoryMap = {};
    
    allMatchesList.forEach(match => {
        let categoryName = match.categoryName;
        if (!categoryName && match.categoryId && categoriesData[match.categoryId]) {
            categoryName = categoriesData[match.categoryId];
        }
        if (!categoryName) return;
        
        const categoryKey = match.categoryId || categoryName;
        if (!categoryMap[categoryKey]) {
            categoryMap[categoryKey] = {
                id: match.categoryId || categoryName,
                name: categoryName
            };
            uniqueCategories.push(categoryMap[categoryKey]);
        }
    });

    uniqueCategories.sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));

    const uniqueHalls = [];
    const hallMap = {};
    
    allMatchesList.forEach(match => {
        if (!match.hallId) return;
        const hallName = hallNames[match.hallId] || 'Športová hala';
        if (!hallMap[match.hallId]) {
            hallMap[match.hallId] = {
                id: match.hallId,
                name: hallName
            };
            uniqueHalls.push(hallMap[match.hallId]);
        }
    });

    uniqueHalls.sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));

    const uniqueGroups = [];
    const groupMap = {};
    
    if (selectedCategory) {
        const categoryGroups = groupsData[selectedCategory] || [];
        categoryGroups.forEach(group => {
            if (!groupMap[group.name]) {
                groupMap[group.name] = group;
                uniqueGroups.push(group);
            }
        });
        
        uniqueGroups.sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));
    }

    return React.createElement(
        'div',
        { className: 'max-w-7xl mx-auto px-4 py-6' },
        
        React.createElement(
            'div',
            { className: 'mb-8 text-center' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Zápasy'),
        ),

        allDays.length > 0 && React.createElement(
            'div',
            { className: 'mb-3 flex flex-wrap gap-2 justify-center' },
            React.createElement(
                'button',
                {
                    onClick: () => setSelectedDay(null),
                    className: `px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        selectedDay === null 
                            ? 'bg-blue-600 text-white shadow-md scale-105' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`
                },
                'Všetky dni'
            ),
            allDays.map((dayGroup, index) => {
                const dateKey = dayGroup.date.toDateString();
                const isSelected = selectedDay === dateKey;
                return React.createElement(
                    'button',
                    {
                        key: `day-filter-${index}`,
                        onClick: () => setSelectedDay(isSelected ? null : dateKey),
                        className: `px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                            isSelected 
                                ? 'bg-blue-600 text-white shadow-md scale-105' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`
                    },
                    `${formatDateHeader(dayGroup.date)}`
                );
            })
        ),

        uniqueCategories.length > 0 && React.createElement(
            'div',
            { className: 'mb-3 flex flex-wrap gap-2 justify-center border-t border-gray-200 pt-3' },
            React.createElement(
                'button',
                {
                    onClick: () => {
                        setSelectedCategory(null);
                        setSelectedGroup(null);
                    },
                    className: `px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        selectedCategory === null 
                            ? 'bg-green-600 text-white shadow-md scale-105' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`
                },
                'Všetky kategórie'
            ),
            uniqueCategories.map((cat, index) => {
                const isSelected = selectedCategory === cat.id || selectedCategory === cat.name;
                const color = categoryDrawColors[cat.id] || '#3B82F6';
                const lighterColor = getLighterColor(color);
                
                return React.createElement(
                    'button',
                    {
                        key: `category-filter-${index}`,
                        onClick: () => {
                            if (isSelected) {
                                setSelectedCategory(null);
                                setSelectedGroup(null);
                            } else {
                                setSelectedCategory(cat.id || cat.name);
                                setSelectedGroup(null);
                            }
                        },
                        className: `px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                            isSelected 
                                ? 'text-white shadow-md scale-105' 
                                : 'text-gray-700 hover:bg-gray-300'
                        }`,
                        style: isSelected ? { backgroundColor: color } : { backgroundColor: lighterColor }
                    },
                    cat.name
                );
            })
        ),

        selectedCategory && uniqueGroups.length > 0 && React.createElement(
            'div',
            { className: 'mb-3 flex flex-col gap-2 border-t border-gray-200 pt-3' },
            
            (() => {
                const basicGroups = uniqueGroups.filter(g => g.type === 'základná skupina');
                if (basicGroups.length === 0) return null;
                
                const isAllBasicSelected = selectedGroup === '__ALL_BASIC__';
                
                return React.createElement(
                    'div',
                    { className: 'flex flex-wrap gap-2 justify-center' },
                    React.createElement(
                        'span',
                        { className: 'text-xs text-gray-500 font-medium mr-1 self-center' },
                        'Základné:'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                if (isAllBasicSelected) {
                                    setSelectedGroup(null);
                                } else {
                                    setSelectedGroup('__ALL_BASIC__');
                                }
                            },
                            className: `px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                isAllBasicSelected
                                    ? 'bg-purple-600 text-white shadow-md scale-105' 
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`
                        },
                        'Všetky základné'
                    ),
                    basicGroups.map((group, index) => {
                        const isSelected = selectedGroup === group.name;
                        const groupColors = getGroupTypeColors(group.name, selectedCategory, groupsData);
                        const bgColor = isSelected ? groupColors.textColor : groupColors.backgroundColor;
                        const textColor = isSelected ? '#FFFFFF' : groupColors.textColor;
                        
                        return React.createElement(
                            'button',
                            {
                                key: `basic-group-${index}`,
                                onClick: () => {
                                    if (isSelected) {
                                        setSelectedGroup(null);
                                    } else {
                                        setSelectedGroup(group.name);
                                    }
                                },
                                className: `px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                    isSelected 
                                        ? 'text-white shadow-md scale-105' 
                                        : 'hover:opacity-80'
                                }`,
                                style: {
                                    backgroundColor: bgColor,
                                    color: textColor
                                }
                            },
                            group.name
                        );
                    })
                );
            })(),
            
            (() => {
                const advancedGroups = uniqueGroups.filter(g => g.type === 'nadstavbová skupina');
                if (advancedGroups.length === 0) return null;
                
                const isAllAdvancedSelected = selectedGroup === '__ALL_ADVANCED__';
                
                return React.createElement(
                    'div',
                    { className: 'flex flex-wrap gap-2 justify-center' },
                    React.createElement(
                        'span',
                        { className: 'text-xs text-gray-500 font-medium mr-1 self-center' },
                        'Nadstavbové:'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                if (isAllAdvancedSelected) {
                                    setSelectedGroup(null);
                                } else {
                                    setSelectedGroup('__ALL_ADVANCED__');
                                }
                            },
                            className: `px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                isAllAdvancedSelected
                                    ? 'bg-purple-600 text-white shadow-md scale-105' 
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`
                        },
                        'Všetky nadstavbové'
                    ),
                    advancedGroups.map((group, index) => {
                        const isSelected = selectedGroup === group.name;
                        const groupColors = getGroupTypeColors(group.name, selectedCategory, groupsData);
                        const bgColor = isSelected ? groupColors.textColor : groupColors.backgroundColor;
                        const textColor = isSelected ? '#FFFFFF' : groupColors.textColor;
                        
                        return React.createElement(
                            'button',
                            {
                                key: `advanced-group-${index}`,
                                onClick: () => {
                                    if (isSelected) {
                                        setSelectedGroup(null);
                                    } else {
                                        setSelectedGroup(group.name);
                                    }
                                },
                                className: `px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                    isSelected 
                                        ? 'text-white shadow-md scale-105' 
                                        : 'hover:opacity-80'
                                }`,
                                style: {
                                    backgroundColor: bgColor,
                                    color: textColor
                                }
                            },
                            group.name
                        );
                    })
                );
            })(),
            
            // --- PRIDANÉ TLAČIDLO PRE PLAYOFF A ZÁPASY O UMIESTNENIE ---
            React.createElement(
                'div',
                { className: 'flex flex-wrap gap-2 justify-center' },
                React.createElement(
                    'span',
                    { className: 'text-xs text-gray-500 font-medium mr-1 self-center' },
                    'Playoff:'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            const isSelected = selectedGroup === '__PLAYOFF__';
                            if (isSelected) {
                                setSelectedGroup(null);
                            } else {
                                setSelectedGroup('__PLAYOFF__');
                            }
                        },
                        className: `px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            selectedGroup === '__PLAYOFF__'
                                ? 'bg-red-600 text-white shadow-md scale-105' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`,
                        style: selectedGroup === '__PLAYOFF__' 
                            ? { backgroundColor: '#DC2626' } 
                            : {}
                    },
//                    React.createElement('i', { className: 'fa-solid fa-trophy mr-1', style: { fontSize: '12px' } }),
                    'Playoff'
                )
            )
        ),

        uniqueHalls.length > 1 && React.createElement(
            'div',
            { className: 'mb-3 flex flex-wrap gap-2 justify-center border-t border-gray-200 pt-3' },
            React.createElement(
                'button',
                {
                    onClick: () => setSelectedHall(null),
                    className: `px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        selectedHall === null 
                            ? 'bg-blue-600 text-white shadow-md scale-105' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`
                },
                'Všetky miesta'
            ),
            uniqueHalls.map((hall, index) => {
                const isSelected = selectedHall === hall.id || selectedHall === hall.name;
                
                return React.createElement(
                    'button',
                    {
                        key: `hall-filter-${index}`,
                        onClick: () => setSelectedHall(isSelected ? null : (hall.id || hall.name)),
                        className: `px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                            isSelected 
                                ? 'bg-blue-600 text-white shadow-md scale-105' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`
                    },
                    React.createElement('i', { className: 'fa-solid fa-location-dot mr-1', style: { fontSize: '12px' } }),
                    hall.name
                );
            })
        ),

        (() => {
            if (hasFilters && displayDays.length === 0) {
                const filterDescriptions = [];
                
                if (selectedDay) {
                    const date = new Date(selectedDay);
                    filterDescriptions.push(formatDateHeader(date));
                }
                
                if (selectedCategory) {
                    const categoryName = categoriesData[selectedCategory] || selectedCategory;
                    filterDescriptions.push(`kategória: ${categoryName}`);
                }
                
                if (selectedGroup) {
                    let groupDisplay = selectedGroup;
                    if (selectedGroup === '__ALL_BASIC__') {
                        groupDisplay = 'všetky základné skupiny';
                    } else if (selectedGroup === '__ALL_ADVANCED__') {
                        groupDisplay = 'všetky nadstavbové skupiny';
                    }
                    filterDescriptions.push(`skupina: ${groupDisplay}`);
                }
                
                if (selectedHall) {
                    const hallName = hallNames[selectedHall] || selectedHall;
                    filterDescriptions.push(`miesto: ${hallName}`);
                }
                
                const filterText = filterDescriptions.join(', ');
                
                return React.createElement(
                    'div',
                    { className: 'text-center py-12 bg-gray-50 rounded-xl border border-gray-200' },
                    React.createElement('i', { className: 'fa-solid fa-filter text-4xl mb-4 text-gray-400' }),
                    React.createElement('p', { className: 'text-lg font-medium text-gray-700 mb-2' }, 'Pre zvolený filter neexistujú žiadne zápasy'),
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                setSelectedDay(null);
                                setSelectedCategory(null);
                                setSelectedGroup(null);
                                setSelectedHall(null);
                            },
                            className: 'mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer'
                        },
                        'Zrušiť všetky filtre'
                    )
                );
            }
            
            if (!hasFilters && displayDays.length === 0) {
                return React.createElement(
                    'div',
                    { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl' },
                    React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-5xl mb-3 opacity-50' }),
                    React.createElement('p', { className: 'text-lg' }, 'Žiadne zápasy')
                );
            }
            
            return React.createElement(
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
                            React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32' }, 'Miesto'),
                            React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48' }, 'Info'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20' }, '')
                        )
                    ),
                    
                    React.createElement(
                        'tbody',
                        { className: 'divide-y divide-gray-100' },
                        displayDays.map((dayGroup, dayIndex) => {
                            const dayMatches = dayGroup.matches;
                            const dayDate = dayGroup.date;
                            const dayRows = [];
                            
                            dayRows.push(
                                React.createElement(
                                    'tr',
                                    { key: `day-${dayIndex}`, className: 'bg-blue-50' },
                                    React.createElement(
                                        'td',
                                        { colSpan: 7, className: 'px-4 py-4 text-left' },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-2' },
                                            React.createElement('i', { className: 'fa-regular fa-calendar text-blue-500 text-lg' }),
                                            React.createElement('span', { className: 'font-semibold text-gray-800 text-base' }, formatDateHeader(dayDate)),
                                        )
                                    )
                                )
                            );
                            
                            dayMatches.forEach((match, matchIndex) => {
                                const dateTime = formatMatchDateTime(match.scheduledTime);
                                const eventsScore = matchScoresFromEvents[match.id];
                                const dbScore = matchScoresFromDb[match.id];
                                const matchStatus = matchStatuses[match.id] || match.status || 'scheduled';
                                const isMatchInProgress = matchStatus === 'in-progress' || matchStatus === 'paused';
                                const isMatchCompleted = matchStatus === 'completed';
                                const hasDbScore = dbScore && (dbScore.home !== undefined && dbScore.home !== null && dbScore.away !== undefined && dbScore.away !== null);
                            
                                let displayHomeScore = null;
                                let displayAwayScore = null;
                                let showScore = false;
                            
                                if (isMatchCompleted && hasDbScore) {
                                    displayHomeScore = dbScore.home;
                                    displayAwayScore = dbScore.away;
                                    showScore = true;
                                }
                                else if (isMatchInProgress) {
                                    if (eventsScore && (eventsScore.home > 0 || eventsScore.away > 0)) {
                                        displayHomeScore = eventsScore.home;
                                        displayAwayScore = eventsScore.away;
                                    } else {
                                        displayHomeScore = 0;
                                        displayAwayScore = 0;
                                    }
                                    showScore = true;
                                }
                                else if (hasDbScore) {
                                    displayHomeScore = dbScore.home;
                                    displayAwayScore = dbScore.away;
                                    showScore = true;
                                }
                            
                                const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                                const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                            
                                const matchHallName = hallNames[match.hallId] || hallInfo?.name || 'Športová hala';
                            
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
                                            { className: 'px-4 py-3 whitespace-nowrap text-left' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-1' },
                                                React.createElement('i', { className: 'fa-solid fa-location-dot text-blue-400 text-xs' }),
                                                React.createElement('span', { className: 'text-gray-600 text-sm max-w-32' }, matchHallName)
                                            )
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
                                            renderDetailButton(match, dayIndex, matchIndex, displayDays)
                                        )
                                    )
                                );
                            });
                            
                            return dayRows;
                        }).flat()
                    )
                )
            );
        })()
    );
};

const renderApp = () => {
    const rootElement = document.getElementById('root');
    if (rootElement && ReactDOM) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MatchesHallApp));
    }
};

renderApp();

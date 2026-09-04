import { collection, getDocs, doc, getDoc, onSnapshot, updateDoc, Timestamp, addDoc, query, where, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;

const formatMatchDateTime = (timestamp) => {
    if (!timestamp) return null;
    try {
        const date = timestamp.toDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return { time: `${hours}:${minutes}`, dateObj: date };
    } catch (e) {gb
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
    let result = { backgroundColor: '#DCFCE7', textColor: '#166534' };
    if (!groupsData || !categoryId) return result;
    const categoryGroups = groupsData[categoryId] || [];
    const foundGroup = categoryGroups.find(g => g.name === groupName);
    if (foundGroup) {
        if (foundGroup.type === 'nadstavbová skupina') {
            result = { backgroundColor: '#DBEAFE', textColor: '#1E40AF' };
        } else if (foundGroup.type === 'základná skupina') {
            result = { backgroundColor: '#DCFCE7', textColor: '#166534' };
        }
    }
    return result;
};

// ===== POMOCOVNÁ FUNKCIA PRE PLAYOFF =====
const isEliminationMatch = (match) => {
    if (!match) return false;
    if (match.isPlacementMatch) return true;
    if (match.matchType && [
        'finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto',
        'štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4',
        'osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
        'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8',
        'šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
        'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
        'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
        'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'
    ].includes(match.matchType)) return true;
    return false;
};

const ELIMINATION_COLORS = {
    backgroundColor: '#FEF3C7',
    textColor: '#92400E'
};

window.isEliminationMatch = isEliminationMatch;

const getDisplayTeamName = (teamIdentifier) => {
    if (!teamIdentifier) return '???';
    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
        const teamName = window.teamManager.getTeamNameByDisplayIdSync(teamIdentifier);
        if (teamName && teamName !== teamIdentifier) return teamName;
    }
    return teamIdentifier;
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

const encodeForURL = (text) => {
    if (!text) return '';
    return encodeURIComponent(text.replace(/ /g, '-'));
};

const decodeFromURL = (text) => {
    if (!text) return '';
    return decodeURIComponent(text).replace(/-/g, ' ');
};

const getFilterFromURL = () => {
    const hash = window.location.hash;
    if (!hash || hash === '#') return { category: null, group: null, view: null };
    try {
        const params = new URLSearchParams(hash.substring(1));
        const category = params.get('category');
        const group = params.get('group');
        const view = params.get('view');
        return { 
            category: category ? decodeFromURL(category) : null, 
            group: group ? decodeFromURL(group) : null,
            view: view ? decodeFromURL(view) : null
        };
    } catch (e) {
        return { category: null, group: null, view: null };
    }
};

const updateURLFilter = (category, group, view) => {
    try {
        const params = new URLSearchParams();
        if (category) params.set('category', encodeForURL(category));
        if (group) params.set('group', encodeForURL(group));
        if (view) params.set('view', encodeForURL(view));
        const newHash = params.toString() ? `#${params.toString()}` : '#';
        if (window.location.hash !== newHash) {
            history.replaceState(null, '', newHash);
        }
    } catch (e) {
    }
};

const FormIndicator = ({ result, matchInfo, onHoverStart, onHoverEnd, teamId, teamName }) => {
    let bgColor = '#9CA3AF';
    let textColor = '#FFFFFF';
    let label = 'N';
    
    switch (result) {
        case 'V':
            bgColor = '#22C55E';
            label = 'V';
            break;
        case 'P':
            bgColor = '#EF4444';
            label = 'P';
            break;
        case 'R':
            bgColor = '#FBBF24';
            textColor = '#000000';
            label = 'R';
            break;
        default:
            bgColor = '#D1D5DB';
            textColor = '#6B7280';
            label = 'N';
            break;
    }
    
    const showTooltip = matchInfo && matchInfo.homeTeamName && matchInfo.awayTeamName;
    const [isHovered, setIsHovered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const tooltipRef = useRef(null);
    const containerRef = useRef(null);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const [currentTargetRect, setCurrentTargetRect] = useState(null);
    const timeoutRef = useRef(null);
    const isHoveringRef = useRef(false);
    
    const calculatePosition = (rect, tooltipHeight) => {
        const tooltipWidth = 220;
        const padding = 8;
        
        let top = rect.top - tooltipHeight - padding;
        let left = rect.left + rect.width / 2 - tooltipWidth / 2;
        
        if (top < 10) {
            top = rect.bottom + padding;
        }
        
        if (left < 10) {
            left = 10;
        } else if (left + tooltipWidth > window.innerWidth - 10) {
            left = window.innerWidth - tooltipWidth - 10;
        }
        
        return { top, left };
    };
    
    const closeTooltip = useCallback(() => {
        setIsHovered(false);
        setIsVisible(false);
        setCurrentTargetRect(null);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (onHoverEnd && !isHoveringRef.current) {
            onHoverEnd();
        }
    }, [onHoverEnd]);
    
    const checkMouseOver = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = window.event?.clientX || 0;
            const mouseY = window.event?.clientY || 0;
            
            const isOver = mouseX >= rect.left && mouseX <= rect.right &&
                          mouseY >= rect.top && mouseY <= rect.bottom;
            
            if (!isOver) {
                isHoveringRef.current = false;
                closeTooltip();
            } else {
                isHoveringRef.current = true;
            }
        }
    }, [closeTooltip]);
    
    useLayoutEffect(() => {
        if (isVisible && tooltipRef.current && currentTargetRect) {
            const height = tooltipRef.current.offsetHeight;
            if (height > 0) {
                const position = calculatePosition(currentTargetRect, height);
                setTooltipPosition(position);
            }
        }
    }, [isVisible, currentTargetRect]);
    
    useEffect(() => {
        if (isVisible) {
            const handleScroll = () => {
                checkMouseOver();
                if (isVisible && currentTargetRect && isHoveringRef.current) {
                    const height = tooltipRef.current?.offsetHeight || 160;
                    const position = calculatePosition(currentTargetRect, height);
                    setTooltipPosition(position);
                }
            };
            
            const handleMouseMove = (e) => {
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const isOver = e.clientX >= rect.left && e.clientX <= rect.right &&
                                  e.clientY >= rect.top && e.clientY <= rect.bottom;
                    
                    if (!isOver) {
                        isHoveringRef.current = false;
                        closeTooltip();
                    } else {
                        isHoveringRef.current = true;
                    }
                }
            };
            
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleScroll);
            document.addEventListener('mousemove', handleMouseMove);
            
            return () => {
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleScroll);
                document.removeEventListener('mousemove', handleMouseMove);
            };
        }
    }, [isVisible, currentTargetRect, checkMouseOver, closeTooltip]);
    
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (onHoverEnd) {
                onHoverEnd();
            }
        };
    }, [onHoverEnd]);
    
    const tooltipContent = showTooltip ? (
        React.createElement(
            'div',
            { 
                ref: tooltipRef,
                className: 'fixed px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-2xl transition-opacity duration-200',
                style: { 
                    minWidth: '180px', 
                    maxWidth: '280px',
                    pointerEvents: 'none',
                    opacity: isVisible ? 1 : 0,
                    display: isVisible ? 'block' : 'none',
                    zIndex: 2147483647,
                    top: tooltipPosition.top + 'px',
                    left: tooltipPosition.left + 'px',
                    willChange: 'top, left'
                }
            },
            React.createElement(
                'div',
                { className: 'flex flex-col gap-0.5' },
                React.createElement(
                    'div',
                    { className: 'font-bold text-white text-xs' },
                    matchInfo.homeTeamName || '???'
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-center gap-2' },
                    React.createElement(
                        'span',
                        { className: 'font-bold text-white text-xs' },
                        matchInfo.awayTeamName || '???'
                    )
                ),
                matchInfo.dateTime && React.createElement(
                    'div',
                    { className: 'text-center text-gray-400 text-xs' },
                    `${matchInfo.dateTime} hod.`
                ),
                matchInfo.score ? (
                    React.createElement(
                        'div',
                        { className: 'text-center text-white text-sm font-bold' },
                        `${matchInfo.score}`
                    )
                ) : (
                    React.createElement(
                        'div',
                        { className: 'text-center text-gray-400 text-xs' },
                        'Zápas nebol odohraný'
                    )
                ),
                matchInfo.resultText && matchInfo.resultText !== 'NEODOHRANÉ' && React.createElement(
                    'div',
                    { 
                        className: `text-center text-xs font-bold mt-0.5`,
                        style: { 
                            color: result === 'V' ? '#4ADE80' : result === 'P' ? '#F87171' : '#FBBF24' 
                        }
                    },
                    matchInfo.resultText
                )
            )
        )
    ) : null;
    
    return React.createElement(
        'div',
        {
            ref: containerRef,
            className: 'relative inline-block',
            style: { zIndex: 0 },
            onMouseEnter: (e) => {
                
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
                
                if (window.__formIndicatorHover) {
                    window.__formIndicatorHover.isHovering = true;
                    window.__formIndicatorHover.teamName = teamName;
                }
                isHoveringRef.current = true;
                
                const rect = e.currentTarget.getBoundingClientRect();
                setCurrentTargetRect(rect);
                setIsHovered(true);
                setIsVisible(true);
                
                const estimatedHeight = 160;
                const position = calculatePosition(rect, estimatedHeight);
                setTooltipPosition(position);
                
                if (onHoverStart && teamName) {
                    onHoverStart(teamName);
                }
            },
            onMouseLeave: (e) => {
                if (window.__formIndicatorHover) {
                    window.__formIndicatorHover.isHovering = false;
                }
                isHoveringRef.current = false;
                
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
                
                timeoutRef.current = setTimeout(() => {
                    if (!isHoveringRef.current) {
                        if (onHoverEnd) {
                            onHoverEnd();
                        }
                        closeTooltip();
                    }
                }, 500); 
            },
            onMouseMove: (e) => {
                if (isVisible && currentTargetRect) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    if (rect.top !== currentTargetRect.top || rect.left !== currentTargetRect.left) {
                        setCurrentTargetRect(rect);
                        const height = tooltipRef.current?.offsetHeight || 160;
                        const position = calculatePosition(rect, height);
                        setTooltipPosition(position);
                    }
                }
            }
        },
        React.createElement(
            'span',
            {
                className: 'inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold mx-0.5 cursor-default transition-all duration-200 hover:scale-110 hover:shadow-lg',
                style: {
                    backgroundColor: bgColor,
                    color: textColor,
                    fontSize: '10px',
                    fontWeight: '700',
                    position: 'relative',
                    zIndex: 0
                }
            },
            label
        ),
        tooltipContent
    );
};

const getTeamForm = (teamId, groupMatches, teamNames, matches) => {
    const teamMatches = [];
    
    groupMatches.forEach(match => {
        const isHome = match.homeTeamIdentifier === teamId;
        const isAway = match.awayTeamIdentifier === teamId;
        
        let isTransferredMatch = match.isTransferred || false;
        let isTeamInMatch = isHome || isAway;
        
        if (!isTeamInMatch && isTransferredMatch) {
            const teamName = teamNames[teamId] || getDisplayTeamName(teamId) || teamId;
            const homeName = match.homeTeamName || match.homeTeamIdentifier || '';
            const awayName = match.awayTeamName || match.awayTeamIdentifier || '';
            
            const normalize = (name) => {
                if (!name) return '';
                return name
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .trim();
            };
            
            const teamNameNorm = normalize(teamName);
            const homeNameNorm = normalize(homeName);
            const awayNameNorm = normalize(awayName);
            
            if (teamNameNorm === homeNameNorm || teamNameNorm === awayNameNorm) {
                isTeamInMatch = true;
                if (teamNameNorm === homeNameNorm) {
                    match.homeTeamIdentifier = teamId;
                } else {
                    match.awayTeamIdentifier = teamId;
                }
            }
        }
        
        if (isTeamInMatch) {
            let homeScore = match.homeScore || 0;
            let awayScore = match.awayScore || 0;
            
            if (match.status !== 'completed' && match.id) {
                const events = window.matchTracker?.getEvents?.(match.id) || [];
                const score = getCurrentScoreFromEvents(events);
                if (score.home > 0 || score.away > 0) {
                    homeScore = score.home;
                    awayScore = score.away;
                }
            }
            
            let matchDate = null;
            if (match.scheduledTime) {
                try {
                    matchDate = match.scheduledTime.toDate();
                } catch (e) {}
            }
            
            let result = 'N'; 
            const isMatchCompleted = match.status === 'completed' || match.isTransferred === true;
            
            if (isMatchCompleted) {
                const finalIsHome = match.homeTeamIdentifier === teamId;
                const finalIsAway = match.awayTeamIdentifier === teamId;
                
                if (finalIsHome) {
                    if (homeScore > awayScore) result = 'V';
                    else if (homeScore < awayScore) result = 'P';
                    else result = 'R';
                } else if (finalIsAway) {
                    if (awayScore > homeScore) result = 'V';
                    else if (awayScore < homeScore) result = 'P';
                    else result = 'R';
                }
            }
            
            teamMatches.push({
                matchId: match.id,
                date: matchDate,
                result: result,
                isTransferred: match.isTransferred || false,
                scheduledTime: match.scheduledTime,
                homeTeamName: match.homeTeamName || match.homeTeamIdentifier,
                awayTeamName: match.awayTeamName || match.awayTeamIdentifier,
                homeTeamIdentifier: match.homeTeamIdentifier,
                awayTeamIdentifier: match.awayTeamIdentifier
            });
        }
    });
    
    teamMatches.sort((a, b) => {
        if (a.isTransferred && !b.isTransferred) return -1;
        if (!a.isTransferred && b.isTransferred) return 1;
        
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.getTime() - b.date.getTime();
    });
    
    return teamMatches;
};

const getCurrentScoreFromEvents = (events) => {
    if (!events || events.length === 0) {
        return { home: 0, away: 0 };
    }
    
    const sortedEvents = [...events].sort((a, b) => {
        if (a.minute !== b.minute) return (a.minute || 0) - (b.minute || 0);
        return (a.second || 0) - (b.second || 0);
    });
    
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    
    if (lastEvent && lastEvent.scoreAfter) {
        return {
            home: lastEvent.scoreAfter.home || 0,
            away: lastEvent.scoreAfter.away || 0
        };
    }
    
    let homeScore = 0;
    let awayScore = 0;
    
    sortedEvents.forEach(event => {
        if (event.type === 'goal') {
            if (event.team === 'home') homeScore++;
            else if (event.team === 'away') awayScore++;
        } else if (event.type === 'penalty' && event.subType === 'scored') {
            if (event.team === 'home') homeScore++;
            else if (event.team === 'away') awayScore++;
        }
    });
    
    return { home: homeScore, away: awayScore };
};

const calculateHeadToHead = (teamA, teamB, groupMatches) => {
    let teamAScore = 0;
    let teamBScore = 0;
    let teamAWins = 0;
    let teamBWins = 0;
    let foundMatch = false;
    
    const teamAName = (teamA.name || teamA.id || "").trim();
    const teamBName = (teamB.name || teamB.id || "").trim();
    
    if (!teamAName || !teamBName) {
        return { teamAScore, teamBScore, teamAWins, teamBWins };
    }
    
    const normalizeName = (name) => {
        if (!name) return '';
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');
    };
    
    const teamANormalized = normalizeName(teamAName);
    const teamBNormalized = normalizeName(teamBName);
    
    for (const match of groupMatches) {
        let homeName = match.homeTeamName || match.homeTeamIdentifier || '';
        let awayName = match.awayTeamName || match.awayTeamIdentifier || '';
        
        if (!homeName || !awayName) continue;
        
        const homeNormalized = normalizeName(homeName);
        const awayNormalized = normalizeName(awayName);
        
        const isMatchBetweenThem = (homeNormalized === teamANormalized && awayNormalized === teamBNormalized) || 
                                   (homeNormalized === teamBNormalized && awayNormalized === teamANormalized);
        
        if (isMatchBetweenThem && match.status === 'completed') {
            foundMatch = true;
            
            let homeScore = match.homeScore || 0;
            let awayScore = match.awayScore || 0;
            
            if (homeNormalized === teamANormalized) {
                teamAScore = homeScore;
                teamBScore = awayScore;
            } else {
                teamAScore = awayScore;
                teamBScore = homeScore;
            }
            
            if (teamAScore > teamBScore) {
                teamAWins = 1;
                teamBWins = 0;
            } else if (teamBScore > teamAScore) {
                teamAWins = 0;
                teamBWins = 1;
            }
            break;
        }
    }
    
    return { teamAScore, teamBScore, teamAWins, teamBWins };
};

const compareTeams = (teamA, teamB, groupMatches, sortingConditions) => {
    if (teamA.points !== teamB.points) {
        return teamB.points - teamA.points;
    }

    if (sortingConditions && sortingConditions.length > 0) {
        for (const condition of sortingConditions) {
            const { parameter, direction } = condition;
            let comparison = 0;
            
            switch (parameter) {
                case 'headToHead':
                    const headToHeadResult = calculateHeadToHead(teamA, teamB, groupMatches);
                    
                    if (headToHeadResult.teamAWins !== headToHeadResult.teamBWins) {
                        if (direction === 'desc') {
                            comparison = headToHeadResult.teamBWins - headToHeadResult.teamAWins;
                        } else {
                            comparison = headToHeadResult.teamAWins - headToHeadResult.teamBWins;
                        }
                    } else if (headToHeadResult.teamAScore !== headToHeadResult.teamBScore) {
                        if (direction === 'desc') {
                            comparison = headToHeadResult.teamBScore - headToHeadResult.teamAScore;
                        } else {
                            comparison = headToHeadResult.teamAScore - headToHeadResult.teamBScore;
                        }
                    }
                    break;
                
                case 'scoreDifference':
                    if (direction === 'desc') {
                        comparison = teamB.goalDifference - teamA.goalDifference;
                    } else {
                        comparison = teamA.goalDifference - teamB.goalDifference;
                    }
                    break;
                    
                case 'goalsScored':
                    if (direction === 'desc') {
                        comparison = teamB.goalsFor - teamA.goalsFor;
                    } else {
                        comparison = teamA.goalsFor - teamB.goalsFor;
                    }
                    break;
                    
                case 'goalsConceded':
                    if (direction === 'asc') {
                        comparison = teamA.goalsAgainst - teamB.goalsAgainst;
                    } else {
                        comparison = teamB.goalsAgainst - teamA.goalsAgainst;
                    }
                    break;
                
                case 'wins':
                    if (direction === 'desc') {
                        comparison = teamB.wins - teamA.wins;
                    } else {
                        comparison = teamA.wins - teamB.wins;
                    }
                    break;
                
                case 'losses':
                    if (direction === 'asc') {
                        comparison = teamA.losses - teamB.losses;
                    } else {
                        comparison = teamB.losses - teamA.losses;
                    }
                    break;
                
                case 'draw':
                    comparison = 0;
                    break;
                    
                default:
                    comparison = 0;
            }
        
            if (comparison !== 0) return comparison;
        }
    }
    
    return teamA.name.localeCompare(teamB.name);
};

const GroupMatchesList = ({ matches, groupName, categoryName, teamNames, hallNames, transferredMatches = [] }) => {
    const sortedMatches = useMemo(() => {
        return [...matches].sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            try {
                return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime();
            } catch (e) {
                return 0;
            }
        });
    }, [matches]);

    const allMatches = useMemo(() => {
        const result = [...sortedMatches];
        
        if (transferredMatches && transferredMatches.length > 0) {
            transferredMatches.forEach(transferred => {
                const exists = result.some(m => m.id === transferred.id);
                if (!exists) {
                    let originalMatch = null;
                    if (window.matchesData) {
                        originalMatch = window.matchesData.find(m => m.id === transferred.id);
                    }
                    
                    if (!originalMatch) {
                        originalMatch = matches.find(m => m.id === transferred.id);
                    }
                    
                    result.push({
                        ...transferred,
                        isTransferred: true,
                        scheduledTime: originalMatch?.scheduledTime || transferred.scheduledTime || null,
                        hallId: originalMatch?.hallId || transferred.hallId || null,
                        homeScore: transferred.homeScore !== undefined ? transferred.homeScore : 0,
                        awayScore: transferred.awayScore !== undefined ? transferred.awayScore : 0,
                        status: 'completed'
                    });
                }
            });
        }
        
        result.sort((a, b) => {
            if (!a.scheduledTime && !b.scheduledTime) return 0;
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            try {
                return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime();
            } catch (e) {
                return 0;
            }
        });
        
        return result;
    }, [sortedMatches, transferredMatches, matches]);

    const matchesByDay = useMemo(() => {
        const groups = {};
        
        allMatches.forEach(match => {
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
        
        const result = Object.values(groups).sort((a, b) => a.date - b.date);
        
        return result;
    }, [allMatches]);

    const createMatchDetailUrl = (match) => {
        if (!match.homeTeamIdentifier || !match.awayTeamIdentifier) return '#';
        const encodedHome = encodeURIComponent(match.homeTeamIdentifier.replace(/ /g, '-'));
        const encodedAway = encodeURIComponent(match.awayTeamIdentifier.replace(/ /g, '-'));
        return `matches.html#match/${encodedHome}/${encodedAway}`;
    };

    const isMatchActive = (match) => {
        const status = matchStatuses[match.id] || match.status || 'scheduled';
        return status === 'in-progress' || status === 'paused';
    };

    const [matchScoresFromEvents, setMatchScoresFromEvents] = useState({});
    const [matchScoresFromDb, setMatchScoresFromDb] = useState({});
    const [matchStatuses, setMatchStatuses] = useState({});
    
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
    }, []);
    
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
        
        return () => unsubscribe();
    }, []);

    if (allMatches.length === 0) {
        return React.createElement(
            'div',
            { className: 'text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-gray-200' },
            React.createElement('i', { className: 'fa-regular fa-calendar-xmark text-3xl mb-2 opacity-50' }),
            React.createElement('p', { className: 'text-sm' }, 'Žiadne zápasy v tejto skupine')
        );
    }

    return React.createElement(
        'div',
        { className: 'mt-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
        React.createElement(
            'div',
            { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
            React.createElement('h3', { className: 'font-semibold text-gray-800' }, 
                `Zápasy skupiny`
            )
        ),
        React.createElement(
            'div',
            { className: 'overflow-x-auto' },
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
                        React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24' }, '')
                    )
                ),
                React.createElement(
                    'tbody',
                    { className: 'divide-y divide-gray-100' },
                    matchesByDay.map((dayGroup, dayIndex) => {
                        const dayDate = dayGroup.date;
                        const dayMatches = dayGroup.matches;
                        const dayRows = [];

                        dayRows.push(
                            React.createElement(
                                'tr',
                                { key: `day-${dayIndex}`, className: 'bg-blue-50' },
                                React.createElement(
                                    'td',
                                    { colSpan: 6, className: 'px-4 py-3 text-left' },
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center gap-2' },
                                        React.createElement('i', { className: 'fa-regular fa-calendar text-blue-500' }),
                                        React.createElement('span', { className: 'font-semibold text-gray-800 text-sm' }, formatDateHeader(dayDate))
                                    )
                                )
                            )
                        );

                        dayMatches.forEach((match) => {
                            const dateTime = match.scheduledTime ? formatMatchDateTime(match.scheduledTime) : null;
                            const matchStatus = matchStatuses[match.id] || match.status || 'scheduled';
                            const isActive = isMatchActive(match);
                            const isTransferred = match.isTransferred || false;
                            
                            const eventsScore = matchScoresFromEvents[match.id];
                            const dbScore = matchScoresFromDb[match.id];
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
                            else if (isTransferred && match.homeScore !== undefined && match.awayScore !== undefined) {
                                displayHomeScore = match.homeScore;
                                displayAwayScore = match.awayScore;
                                showScore = true;
                            }

                            const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier) || match.homeTeamName || match.homeTeamIdentifier || '???';
                            const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier) || match.awayTeamName || match.awayTeamIdentifier || '???';
                            
                            let matchHallName = 'Športová hala';
                            
                            if (match.hallId && hallNames[match.hallId]) {
                                matchHallName = hallNames[match.hallId];
                            } else if (match.fromGroup) {
                                matchHallName = match.fromGroup;
                            }

                            const detailUrl = createMatchDetailUrl(match);
                            
                            const buttonClass = isActive
                                ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer font-medium'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer font-medium';

                            const rowClass = isTransferred
                                ? 'hover:bg-gray-200 transition-colors bg-gray-100'
                                : 'hover:bg-gray-200 transition-colors';

                            dayRows.push(
                                React.createElement(
                                    'tr',
                                    { key: `match-${dayIndex}-${match.id || match._id || Math.random()}`, className: rowClass },
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
                                            React.createElement('span', { className: 'text-gray-600 text-sm max-w-32 truncate' }, matchHallName)
                                        )
                                    ),
                                    React.createElement(
                                        'td',
                                        { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                        React.createElement(
                                            'a',
                                            {
                                                href: detailUrl,
                                                className: buttonClass
                                            },
                                            'Detail'
                                        )
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

const GroupTable = ({ table, filteredTables, groupMatches, transferredMatches, teamNames, matches, groupsDataState, handleTableHeaderClick, getTeamForm, hallNames }) => {
    const { category, categoryId, group, groupType, teams, totalMatches, completedCount, carryOverEnabled } = table;
    
    const colors = getGroupTypeColors(group, categoryId, groupsDataState);
    const groupTypeLabel = groupType === 'nadstavbová' ? 'NADSTAVBOVÁ' : 'ZÁKLADNÁ';
    const isAdvanced = groupType === 'nadstavbová';
    const isOnlyTable = filteredTables.length === 1;
    
    const [highlightedTeamId, setHighlightedTeamId] = useState(null);
    
    const allGroupMatchesForForm = useMemo(() => {
        const result = [...groupMatches];
        
        if (transferredMatches && transferredMatches.length > 0) {
            transferredMatches.forEach(transferred => {
                const exists = result.some(m => m.id === transferred.id);
                if (!exists) {
                    result.push({
                        ...transferred,
                        isTransferred: true,
                        homeScore: transferred.homeScore !== undefined ? transferred.homeScore : 0,
                        awayScore: transferred.awayScore !== undefined ? transferred.awayScore : 0,
                        status: 'completed'
                    });
                }
            });
        }
        
        return result;
    }, [groupMatches, transferredMatches]);

    const highlightTimeoutRef = useRef(null);
    const isHoveringRef = useRef(false);

    useEffect(() => {
        if (!window.__formIndicatorHover) {
            window.__formIndicatorHover = {
                isHovering: false,
                teamName: null
            };
        }
    }, []);
    
    const handleHoverStart = (teamName) => {        
        window.__formIndicatorHover.isHovering = true;
        window.__formIndicatorHover.teamName = teamName;
        
        if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
            highlightTimeoutRef.current = null;
        }
        
        if (teamName) {
            const foundTeam = teams.find(t => t.name === teamName);
            if (foundTeam) {
                setHighlightedTeamId(foundTeam.id);
            } 
        } 
    };
    
    const handleHoverEnd = () => {        
        if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
        }
        
        highlightTimeoutRef.current = setTimeout(() => {
            if (!window.__formIndicatorHover.isHovering) {
                setHighlightedTeamId(null);
                highlightTimeoutRef.current = null;
            } else {
                const teamName = window.__formIndicatorHover.teamName;
                if (teamName) {
                    const foundTeam = teams.find(t => t.name === teamName);
                    if (foundTeam) {
                        setHighlightedTeamId(foundTeam.id);
                    }
                }
            }
        }, 800); 
    };
    
    const normalizeName = useCallback((name) => {
        if (!name) return '';
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }, []);
    
    const getOpponentIdByName = useCallback((opponentName) => {
        if (!opponentName) {
            return null;
        }
        
        const oppNameNorm = normalizeName(opponentName);        
        
        for (const team of teams) {
            const teamNameNorm = normalizeName(team.name || '');
            if (teamNameNorm === oppNameNorm) {
                return team.id;
            }
            if (team.id === opponentName) {
                return team.id;
            }
        }        
        return null;
    }, [teams, normalizeName]);
    
    const getMatchInfoForForm = (teamId, match) => {
        if (!match) return null;        
        
        let finalIsHome = match.homeTeamIdentifier === teamId;
        let finalIsAway = match.awayTeamIdentifier === teamId;
        let opponentName = null;        
        
        if (!finalIsHome && !finalIsAway) {
            const teamName = teamNames[teamId] || getDisplayTeamName(teamId) || teamId;
            const homeName = match.homeTeamName || match.homeTeamIdentifier || '';
            const awayName = match.awayTeamName || match.awayTeamIdentifier || '';
            
            const teamNameNorm = normalizeName(teamName);
            const homeNameNorm = normalizeName(homeName);
            const awayNameNorm = normalizeName(awayName);            
            
            if (teamNameNorm === homeNameNorm) {
                finalIsHome = true;
                opponentName = awayName;
            } else if (teamNameNorm === awayNameNorm) {
                finalIsAway = true;
                opponentName = homeName;
            }
        } else if (finalIsHome) {
            opponentName = match.awayTeamName || match.awayTeamIdentifier || '';
        } else if (finalIsAway) {
            opponentName = match.homeTeamName || match.homeTeamIdentifier || '';
        }
        
        let opponentId = null;
        
        if (!opponentName && match.homeTeamName && match.awayTeamName) {
            const teamName = teamNames[teamId] || getDisplayTeamName(teamId) || teamId;
            const teamNameNorm = normalizeName(teamName);
            const homeNameNorm = normalizeName(match.homeTeamName || '');
            const awayNameNorm = normalizeName(match.awayTeamName || '');
            
            if (teamNameNorm === homeNameNorm) {
                opponentName = match.awayTeamName || match.awayTeamIdentifier || '';
                finalIsHome = true;
            } else if (teamNameNorm === awayNameNorm) {
                opponentName = match.homeTeamName || match.homeTeamIdentifier || '';
                finalIsAway = true;
            }
        }
        
        if (opponentName) {
            opponentId = getOpponentIdByName(opponentName);
        } else {
            if (finalIsHome && match.awayTeamIdentifier) {
                opponentId = getOpponentIdByName(match.awayTeamName || match.awayTeamIdentifier);
            } else if (finalIsAway && match.homeTeamIdentifier) {
                opponentId = getOpponentIdByName(match.homeTeamName || match.homeTeamIdentifier);
            }
        }
        
        let teamDisplayName = teamNames[teamId] || getDisplayTeamName(teamId) || teamId || '???';
        let opponentDisplayName = '???';
        
        const getTeamName = (identifier) => {
            if (!identifier) return '???';
            
            if (teamNames[identifier]) {
                return teamNames[identifier];
            }
            
            const displayName = getDisplayTeamName(identifier);
            if (displayName && displayName !== identifier) {
                return displayName;
            }
            
            const foundInTeams = teams.find(t => t.id === identifier);
            if (foundInTeams) {
                return foundInTeams.name;
            }
            
            const foundByName = teams.find(t => t.name === identifier);
            if (foundByName) {
                return foundByName.name;
            }
            
            return identifier;
        };
        
        if (opponentId) {
            opponentDisplayName = getTeamName(opponentId);
        } else if (opponentName) {
            opponentDisplayName = getTeamName(opponentName);
        }    
        
        let score = null;
        let resultText = '';
        let result = 'N';
        
        let homeScore = match.homeScore || 0;
        let awayScore = match.awayScore || 0;
        
        if (homeScore === 0 && awayScore === 0 && match.id) {
            const events = window.matchTracker?.getEvents?.(match.id) || [];
            const scoreData = getCurrentScoreFromEvents(events);
            homeScore = scoreData.home;
            awayScore = scoreData.away;
        }
        
        const isTransferred = match.isTransferred || false;
        const matchStatus = isTransferred ? 'completed' : (match.status || 'scheduled');
        
        if (matchStatus === 'completed' || homeScore > 0 || awayScore > 0 || isTransferred) {
            score = `${homeScore}:${awayScore}`;
            
            if (finalIsHome) {
                if (homeScore > awayScore) { result = 'V'; resultText = 'VÝHRA'; }
                else if (homeScore < awayScore) { result = 'P'; resultText = 'PREHRA'; }
                else { result = 'R'; resultText = 'REMÍZA'; }
            } else if (finalIsAway) {
                if (awayScore > homeScore) { result = 'V'; resultText = 'VÝHRA'; }
                else if (awayScore < homeScore) { result = 'P'; resultText = 'PREHRA'; }
                else { result = 'R'; resultText = 'REMÍZA'; }
            }
        } else {
            resultText = 'NEODOHRANÉ';
        }
        
        let dateTimeStr = null;
        if (match.scheduledTime) {
            try {
                const date = match.scheduledTime.toDate();
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear();
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                dateTimeStr = `${day}. ${month}. ${year} ${hours}:${minutes}`;
            } catch (e) {}
        } else if (isTransferred) {
            dateTimeStr = 'Prenesený zápas';
        }
        
        let homeTeamNameForTooltip, awayTeamNameForTooltip;
        
        if (finalIsHome) {
            homeTeamNameForTooltip = teamDisplayName;
            awayTeamNameForTooltip = opponentDisplayName;
        } else if (finalIsAway) {
            homeTeamNameForTooltip = opponentDisplayName;
            awayTeamNameForTooltip = teamDisplayName;
        } else {
            homeTeamNameForTooltip = match.homeTeamName || match.homeTeamIdentifier || '???';
            awayTeamNameForTooltip = match.awayTeamName || match.awayTeamIdentifier || '???';
        }        

        const opponentRawName = opponentName || match.awayTeamName || match.homeTeamName || null;
        
        let opponentNameForHighlight = null;
        
        if (opponentDisplayName && opponentDisplayName !== '???') {
            opponentNameForHighlight = opponentDisplayName;
        } else if (opponentName) {
            const foundTeamName = getTeamName(opponentName);
            if (foundTeamName && foundTeamName !== opponentName) {
                opponentNameForHighlight = foundTeamName;
            } else {
                opponentNameForHighlight = opponentName;
            }
        } else if (finalIsHome && match.awayTeamIdentifier) {
            opponentNameForHighlight = getTeamName(match.awayTeamName || match.awayTeamIdentifier);
        } else if (finalIsAway && match.homeTeamIdentifier) {
            opponentNameForHighlight = getTeamName(match.homeTeamName || match.homeTeamIdentifier);
        }
        
        if (!opponentNameForHighlight) {
            if (finalIsHome) {
                opponentNameForHighlight = awayTeamNameForTooltip;
            } else if (finalIsAway) {
                opponentNameForHighlight = homeTeamNameForTooltip;
            }
        }
        
        return {
            homeTeamName: homeTeamNameForTooltip,
            awayTeamName: awayTeamNameForTooltip,
            score: score,
            dateTime: dateTimeStr,
            resultText: resultText,
            matchId: match.id,
            isHome: finalIsHome,
            isAway: finalIsAway,
            opponentId: opponentId,
            opponentName: opponentNameForHighlight,
            result: result,
            isTransferred: isTransferred
        };
    };
    
    return React.createElement(
        'div', 
        { 
            key: `${category}|${group}`,
            className: 'mb-8 transition-all'
        },
        
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
            
            React.createElement(
                'div',
                { 
                    className: 'px-6 py-4 border-b cursor-pointer hover:opacity-80 transition-opacity',
                    style: { 
                        backgroundColor: colors.backgroundColor || '#DCFCE7',
                        color: colors.textColor || '#166534'
                    },
                    onClick: () => handleTableHeaderClick(category, group),
                },
                React.createElement(
                    'div',
                    { className: 'flex flex-wrap items-center justify-between gap-3' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-3' },
                        React.createElement('h3', { className: 'text-lg font-bold' }, `${category} - ${group}`),
                        React.createElement(
                            'span',
                            { 
                                className: 'text-xs px-2 py-0.5 rounded-full font-medium',
                                style: { backgroundColor: 'rgba(255,255,255,0.6)', color: colors.textColor }
                            },
                            groupTypeLabel
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-3 text-xs' },                            
                        isAdvanced && carryOverEnabled && React.createElement(
                            'span',
                            { className: 'text-black-600 font-medium' },
                            '• Vzájomné zápasy zo základných skupín sa započítavajú.'
                        ),
                        React.createElement(
                            'span',
                            { className: 'text-gray-600' },
                            `${completedCount}/${totalMatches} zápasov`
                        )
                    )
                )
            ),
            
            React.createElement(
                'div',
                { className: 'overflow-x-auto' },
                React.createElement(
                    'table',
                    { className: 'min-w-full divide-y divide-gray-200' },
                    
                    React.createElement(
                        'thead',
                        { className: 'bg-gray-50' },
                        React.createElement(
                            'tr',
                            null,
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12' }, '#'),
                            React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-72' }, 'Tím'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10' }, 'Z'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10' }, 'V'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10' }, 'R'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10' }, 'P'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16' }, 'Skóre'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12' }, '+/-'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12' }, 'Body'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-72' }, 'Forma'),
                        )
                    ),
                    
                    React.createElement(
                        'tbody',
                        { className: 'divide-y divide-gray-100' },
                        teams.map((team, index) => {
                            const position = index + 1;
                            const isHighlighted = highlightedTeamId === team.id;
                            
                            const teamForm = getTeamForm(team.id, allGroupMatchesForForm, teamNames, matches);
                            
                            const formMatchesWithInfo = teamForm.map((match, idx) => {
                                let fullMatch = groupMatches.find(m => m.id === match.matchId);
                                if (!fullMatch && transferredMatches) {
                                    fullMatch = transferredMatches.find(m => m.id === match.matchId);
                                }
                                if (!fullMatch) {
                                    fullMatch = match;
                                }
                                const matchInfo = getMatchInfoForForm(team.id, fullMatch || match);
                                return {
                                    ...match,
                                    matchInfo: matchInfo
                                };
                            });
                            
                            const rowBgColor = isHighlighted ? 'bg-yellow-50' : '';
                            
                            return React.createElement(
                                'tr',
                                { 
                                    key: team.id, 
                                    className: `hover:bg-gray-100 transition-colors duration-200 ${rowBgColor}`,
                                    style: isHighlighted ? { backgroundColor: '#FEFCE8' } : {}
                                },
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center font-bold text-gray-700' },
                                    position
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 font-medium text-gray-800 truncate max-w-xs' },
                                    team.name || '???'
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center text-gray-600' },
                                    team.played
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center text-green-600 font-bold' },
                                    team.wins
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center text-yellow-600' },
                                    team.draws
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center text-red-600' },
                                    team.losses
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center font-mono' },
                                    `${team.goalsFor}:${team.goalsAgainst}`
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center font-mono font-bold' },
                                    team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center font-bold text-blue-600' },
                                    team.points
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center' },
                                    React.createElement(
                                        'div',
                                        { 
                                            className: 'flex items-center justify-start gap-0.5 flex-wrap',
                                            style: { 
                                                maxWidth: '250px',
                                                flexWrap: 'nowrap',
                                                whiteSpace: 'nowrap',
                                                padding: '2px 0'
                                            }
                                        },
                                        formMatchesWithInfo.map((match, idx) => {
                                            const isTransferred = match.isTransferred || match.matchInfo?.isTransferred || false;
                                            const opponentId = match.matchInfo?.opponentId || null;
                                            const opponentName = match.matchInfo?.opponentName || null;

                                            let opponentTeamName = null;
                                            if (opponentName) {
                                                for (const [id, name] of Object.entries(teamNames)) {
                                                    if (name === opponentName) {
                                                        opponentTeamName = name;
                                                        break;
                                                    }
                                                }
                                                if (!opponentTeamName) {
                                                    opponentTeamName = opponentName;
                                                }
                                            } else if (opponentId) {
                                                opponentTeamName = teamNames[opponentId] || getDisplayTeamName(opponentId) || opponentId;
                                            }
                                            
                                            if (!opponentTeamName && match.matchInfo) {
                                                if (match.matchInfo.isHome) {
                                                    opponentTeamName = match.matchInfo.awayTeamName;
                                                } else if (match.matchInfo.isAway) {
                                                    opponentTeamName = match.matchInfo.homeTeamName;
                                                }
                                            }                                            
                                            
                                            return React.createElement(
                                                'div',
                                                {
                                                    key: idx,
                                                    className: 'relative',
                                                    style: { display: 'inline-block' }
                                                },
                                                React.createElement(FormIndicator, { 
                                                    result: match.result,
                                                    matchInfo: match.matchInfo,
                                                    onHoverStart: handleHoverStart,
                                                    onHoverEnd: handleHoverEnd,
                                                    teamId: opponentId,
                                                    teamName: opponentTeamName
                                                }),
                                                isTransferred && React.createElement(
                                                    'span',
                                                    {
                                                        className: 'absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full',
                                                        style: { backgroundColor: '#3B82F6' }
                                                    }
                                                )
                                            );
                                        })
                                    )
                                )
                            );
                        })
                    )
                )
            )
        ),
        
        isOnlyTable && React.createElement(
            'div',
            { className: 'mt-6' },
            React.createElement(
                GroupMatchesList,
                {
                    matches: groupMatches,
                    groupName: group,
                    categoryName: category,
                    teamNames: teamNames,
                    hallNames: hallNames,
                    transferredMatches: transferredMatches || []
                }
            )
        )
    );
};

const PlayoffMatchesList = ({ matches, teamNames, hallNames, categoriesData, category, onHeaderClick }) => {
    const [matchScoresFromEvents, setMatchScoresFromEvents] = useState({});
    const [matchScoresFromDb, setMatchScoresFromDb] = useState({});
    const [matchStatuses, setMatchStatuses] = useState({});

    useEffect(() => {
        if (!window.db) return;
        const matchesRef = collection(window.db, 'matches');
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const updatedStatuses = {};
            const updatedScores = {};
            snapshot.docChanges().forEach(change => {
                const match = { id: change.doc.id, ...change.doc.data() };
                updatedStatuses[match.id] = match.status || 'scheduled';
                if (match.homeScore !== undefined || match.awayScore !== undefined) {
                    updatedScores[match.id] = { home: match.homeScore, away: match.awayScore };
                }
            });
            if (Object.keys(updatedStatuses).length) setMatchStatuses(prev => ({ ...prev, ...updatedStatuses }));
            if (Object.keys(updatedScores).length) setMatchScoresFromDb(prev => ({ ...prev, ...updatedScores }));
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!window.db) return;
        const eventsRef = collection(window.db, 'matchEvents');
        const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
            const goalsByMatch = {};
            snapshot.forEach(doc => {
                const event = doc.data();
                if (event.eventType === 'goal') {
                    if (!goalsByMatch[event.matchId]) goalsByMatch[event.matchId] = { home: 0, away: 0 };
                    if (event.team === 'home') goalsByMatch[event.matchId].home++;
                    else if (event.team === 'away') goalsByMatch[event.matchId].away++;
                }
            });
            setMatchScoresFromEvents(goalsByMatch);
        });
        return () => unsubscribe();
    }, []);

    const getMatchesByDay = (matchesList) => {
        const groups = {};
        matchesList.forEach(match => {
            if (match.scheduledTime) {
                try {
                    const date = match.scheduledTime.toDate();
                    const dateKey = date.toDateString();
                    if (!groups[dateKey]) groups[dateKey] = { date, matches: [] };
                    groups[dateKey].matches.push(match);
                } catch(e) {}
            }
        });
        return Object.values(groups).sort((a, b) => a.date - b.date);
    };

    const isMatchActive = (match) => {
        const status = matchStatuses[match.id] || match.status || 'scheduled';
        return status === 'in-progress' || status === 'paused';
    };

    const createMatchDetailUrl = (match) => {
        if (!match.homeTeamIdentifier || !match.awayTeamIdentifier) return '#';
        const encodedHome = encodeURIComponent(match.homeTeamIdentifier.replace(/ /g, '-'));
        const encodedAway = encodeURIComponent(match.awayTeamIdentifier.replace(/ /g, '-'));
        return `matches.html#match/${encodedHome}/${encodedAway}`;
    };

    if (!matches || matches.length === 0) {
        return React.createElement(
            'div',
            { className: 'text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-gray-200' },
            React.createElement('i', { className: 'fa-regular fa-trophy text-3xl mb-2 opacity-50' }),
            React.createElement('p', { className: 'text-sm' }, 'Žiadne play-off zápasy')
        );
    }

    const sortedMatches = [...matches].sort((a, b) => {
        if (!a.scheduledTime) return 1;
        if (!b.scheduledTime) return -1;
        try { return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime(); } catch(e) { return 0; }
    });

    const matchesByDay = getMatchesByDay(sortedMatches);

    return React.createElement(
        'div',
        { className: 'mt-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
        React.createElement(
            'div',
            { 
                className: 'bg-red-200 px-6 py-3 border-b border-gray-200 cursor-pointer hover:bg-red-300 transition-colors',
                onClick: () => onHeaderClick && onHeaderClick(category)
            },
            React.createElement('h3', { className: 'font-semibold text-red-700' }, 'Play-off a zápasy o umiestnenie')
        ),
        React.createElement(
            'div',
            { className: 'overflow-x-auto' },
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
                    matchesByDay.map((dayGroup, dayIndex) => {
                        const dayDate = dayGroup.date;
                        const dayMatches = dayGroup.matches;
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
                                        React.createElement('span', { className: 'font-semibold text-gray-800 text-base' }, formatDateHeader(dayDate))
                                    )
                                )
                            )
                        );

                        dayMatches.forEach((match, matchIndex) => {
                            const dateTime = formatMatchDateTime(match.scheduledTime);
                            const matchStatus = matchStatuses[match.id] || match.status || 'scheduled';
                            const isActive = isMatchActive(match);
                            const eventsScore = matchScoresFromEvents[match.id];
                            const dbScore = matchScoresFromDb[match.id];
                            const isMatchInProgress = matchStatus === 'in-progress' || matchStatus === 'paused';
                            const isMatchCompleted = matchStatus === 'completed';
                            const hasDbScore = dbScore && dbScore.home !== undefined && dbScore.home !== null;

                            let displayHomeScore = null, displayAwayScore = null, showScore = false;
                            if (isMatchCompleted && hasDbScore) {
                                displayHomeScore = dbScore.home;
                                displayAwayScore = dbScore.away;
                                showScore = true;
                            } else if (isMatchInProgress) {
                                if (eventsScore && (eventsScore.home > 0 || eventsScore.away > 0)) {
                                    displayHomeScore = eventsScore.home;
                                    displayAwayScore = eventsScore.away;
                                } else {
                                    displayHomeScore = 0;
                                    displayAwayScore = 0;
                                }
                                showScore = true;
                            } else if (hasDbScore) {
                                displayHomeScore = dbScore.home;
                                displayAwayScore = dbScore.away;
                                showScore = true;
                            }

                            const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier) || match.homeTeamName || match.homeTeamIdentifier || '???';
                            const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier) || match.awayTeamName || match.awayTeamIdentifier || '???';

                            let matchHallName = 'Športová hala';
                            if (match.hallId && hallNames[match.hallId]) matchHallName = hallNames[match.hallId];

                            const matchColors = isEliminationMatch(match) ? ELIMINATION_COLORS : { backgroundColor: '#DCFCE7', textColor: '#166534' };

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
                                    }, match.matchType)
                                );
                            }
                            if (match.isPlacementMatch && match.placementRank) {
                                infoTags.push(
                                    React.createElement('span', {
                                        key: 'placement',
                                        className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                        style: {
                                            backgroundColor: ELIMINATION_COLORS.backgroundColor,
                                            color: ELIMINATION_COLORS.textColor,
                                            fontWeight: '500'
                                        }
                                    }, `o ${match.placementRank}. miesto`)
                                );
                            }
                            // Štítok kategórie bol odstránený – už sa nepridáva

                            const detailUrl = createMatchDetailUrl(match);
                            const buttonClass = isActive
                                ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer font-medium'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer font-medium';

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
                                            React.createElement('span', { className: 'text-gray-600 text-sm max-w-32 truncate' }, matchHallName)
                                        )
                                    ),
                                    React.createElement(
                                        'td',
                                        { className: 'px-4 py-3' },
                                        React.createElement(
                                            'div',
                                            { className: 'flex flex-wrap gap-1' },
                                            infoTags
                                        )
                                    ),
                                    React.createElement(
                                        'td',
                                        { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                        React.createElement(
                                            'a',
                                            { href: detailUrl, className: buttonClass },
                                            'Detail'
                                        )
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

const GroupTablesView = ({ matches, categoriesData, groupsData, teamNames, hallNames }) => {
    const [groupTables, setGroupTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [pointsForWin, setPointsForWin] = useState(3);
    const [sortingConditions, setSortingConditions] = useState([]);
    const [groupsDataState, setGroupsDataState] = useState(groupsData || {});
    const [isInitialized, setIsInitialized] = useState(false);
    const [categorySettings, setCategorySettings] = useState({});
    const [showPlayoff, setShowPlayoff] = useState(false);
    const [processedCarryOverGroups, setProcessedCarryOverGroups] = useState(new Set());

    const clearFilters = () => {
        setShowPlayoff(false);
        setSelectedCategory(null);
        setSelectedGroup(null);
    };
    
    useEffect(() => {
        const urlFilter = getFilterFromURL();
        if (urlFilter.category) {
            setSelectedCategory(urlFilter.category);
        }
        if (urlFilter.group) {
            setSelectedGroup(urlFilter.group);
        }
        if (urlFilter.view === 'playoff') {
            setShowPlayoff(true);
            setSelectedGroup(null); // skupina sa pri Playoff ignoruje
        } else {
            setShowPlayoff(false);
        }
        setIsInitialized(true);
    }, []);
    
    useEffect(() => {
        if (!isInitialized) return;
        const view = showPlayoff ? 'playoff' : null;
        updateURLFilter(selectedCategory, selectedGroup, view);
    }, [selectedCategory, selectedGroup, showPlayoff, isInitialized]);
    
    useEffect(() => {
        const loadSettings = async () => {
            if (!window.db) return;
            try {
                const settingsRef = doc(window.db, 'settings', 'table');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    const newPoints = data.pointsForWin !== undefined ? data.pointsForWin : 3;
                    setPointsForWin(newPoints);
                    setSortingConditions(data.sortingConditions || []);                    
                    window.__pointsForWin = newPoints;
                }
            } catch (err) {
            }
        };
        loadSettings();
    }, []);    
    
    const getCurrentPointsForWin = useCallback(() => {
        return pointsForWin;
    }, [pointsForWin]);
    
    useEffect(() => {
        const loadCategorySettings = async () => {
            if (!window.db) return;
            try {
                const settingsRef = doc(window.db, 'settings', 'categories');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    const settings = {};
                    for (const [catId, catData] of Object.entries(data)) {
                        if (catData.name) {
                            settings[catData.name] = {
                                carryOverPoints: catData.carryOverPoints ?? false,
                                id: catId
                            };
                        }
                    }
                    setCategorySettings(settings);
                    window.categorySettings = settings;
                }
            } catch (err) {
            }
        };
        loadCategorySettings();
    }, []);
    
    useEffect(() => {
        if (!window.db) return;
        const settingsRef = doc(window.db, 'settings', 'categories');
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const settings = {};
                for (const [catId, catData] of Object.entries(data)) {
                    if (catData.name) {
                        settings[catData.name] = {
                            carryOverPoints: catData.carryOverPoints ?? false,
                            id: catId
                        };
                    }
                }
                setCategorySettings(settings);
                window.categorySettings = settings;
            }
        }, (err) => {
        });
        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        const loadGroupsDataFromDB = async () => {
            if (!window.db) return;
            try {
                const groupsRef = doc(window.db, 'settings', 'groups');
                const groupsSnap = await getDoc(groupsRef);
                if (groupsSnap.exists()) {
                    const data = groupsSnap.data();
                    setGroupsDataState(data);
                    window.groupsData = data;
                }
            } catch (err) {
            }
        };
        loadGroupsDataFromDB();
    }, []);
    
    useEffect(() => {
        if (!window.db) return;
        const groupsRef = doc(window.db, 'settings', 'groups');
        const unsubscribe = onSnapshot(groupsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setGroupsDataState(data);
                window.groupsData = data;
            }
        }, (err) => {
        });
        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        if (!window.db) return;
        const settingsRef = doc(window.db, 'settings', 'table');
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const newPoints = data.pointsForWin !== undefined ? data.pointsForWin : 3;
                const newConditions = data.sortingConditions || [];
                
                let changed = false;
                if (pointsForWin !== newPoints) {
                    setPointsForWin(newPoints);
                    window.__pointsForWin = newPoints;
                    changed = true;
                }
                if (JSON.stringify(sortingConditions) !== JSON.stringify(newConditions)) {
                    setSortingConditions(newConditions);
                    changed = true;
                }
            }
        }, (err) => {
        });
        return () => unsubscribe();
    }, [pointsForWin, sortingConditions]);
    
    const getCurrentScoreFromEvents = (events) => {
        if (!events || events.length === 0) {
            return { home: 0, away: 0 };
        }
        
        const sortedEvents = [...events].sort((a, b) => {
            if (a.minute !== b.minute) return (a.minute || 0) - (b.minute || 0);
            return (a.second || 0) - (b.second || 0);
        });
        
        const lastEvent = sortedEvents[sortedEvents.length - 1];
        
        if (lastEvent && lastEvent.scoreAfter) {
            return {
                home: lastEvent.scoreAfter.home || 0,
                away: lastEvent.scoreAfter.away || 0
            };
        }
        
        let homeScore = 0;
        let awayScore = 0;
        
        sortedEvents.forEach(event => {
            if (event.type === 'goal') {
                if (event.team === 'home') homeScore++;
                else if (event.team === 'away') awayScore++;
            } else if (event.type === 'penalty' && event.subType === 'scored') {
                if (event.team === 'home') homeScore++;
                else if (event.team === 'away') awayScore++;
            }
        });
        
        return { home: homeScore, away: awayScore };
    };
    
    const calculateGroupTable = useCallback((category, group, groupMatches) => {
        const teamsMap = new Map();
        groupMatches.forEach(match => {
            if (match.homeTeamIdentifier && !teamsMap.has(match.homeTeamIdentifier)) {
                const teamName = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                teamsMap.set(match.homeTeamIdentifier, {
                    id: match.homeTeamIdentifier,
                    name: teamName,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0,
                    goalDifference: 0
                });
            }
            if (match.awayTeamIdentifier && !teamsMap.has(match.awayTeamIdentifier)) {
                const teamName = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                teamsMap.set(match.awayTeamIdentifier, {
                    id: match.awayTeamIdentifier,
                    name: teamName,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0,
                    goalDifference: 0
                });
            }
        });
        
        const currentPointsForWin = pointsForWin;
        
        const completedMatches = groupMatches.filter(m => m.status === 'completed');
        completedMatches.forEach(match => {
            const homeTeam = teamsMap.get(match.homeTeamIdentifier);
            const awayTeam = teamsMap.get(match.awayTeamIdentifier);
            
            if (!homeTeam || !awayTeam) return;
            
            let homeScore = match.homeScore || 0;
            let awayScore = match.awayScore || 0;
            
            if (homeScore === 0 && awayScore === 0 && match.id) {
                const events = window.matchTracker?.getEvents?.(match.id) || [];
                const score = getCurrentScoreFromEvents(events);
                homeScore = score.home;
                awayScore = score.away;
            }
            
            homeTeam.played++;
            awayTeam.played++;
            homeTeam.goalsFor += homeScore;
            homeTeam.goalsAgainst += awayScore;
            awayTeam.goalsFor += awayScore;
            awayTeam.goalsAgainst += homeScore;
            
            if (homeScore > awayScore) {
                homeTeam.wins++;
                homeTeam.points += currentPointsForWin;
                awayTeam.losses++;
            } else if (awayScore > homeScore) {
                awayTeam.wins++;
                awayTeam.points += currentPointsForWin;
                homeTeam.losses++;
            } else {
                homeTeam.draws++;
                homeTeam.points += 1;
                awayTeam.draws++;
                awayTeam.points += 1;
            }
        });
        
        const teams = Array.from(teamsMap.values());
        teams.forEach(team => {
            team.goalDifference = team.goalsFor - team.goalsAgainst;
        });
        
        const matchesForComparison = groupMatches.map(match => {
            const homeTeam = teamsMap.get(match.homeTeamIdentifier);
            const awayTeam = teamsMap.get(match.awayTeamIdentifier);
            
            let homeName = homeTeam ? homeTeam.name : match.homeTeamIdentifier;
            let awayName = awayTeam ? awayTeam.name : match.awayTeamIdentifier;
            
            let homeScore = match.homeScore || 0;
            let awayScore = match.awayScore || 0;
            
            if (homeScore === 0 && awayScore === 0 && match.id) {
                const events = window.matchTracker?.getEvents?.(match.id) || [];
                const score = getCurrentScoreFromEvents(events);
                homeScore = score.home;
                awayScore = score.away;
            }
            
            return {
                ...match,
                homeTeamName: homeName,
                awayTeamName: awayName,
                homeScore: homeScore,
                awayScore: awayScore
            };
        });
        
        const sortedTeams = [...teams].sort((a, b) => {
            return compareTeams(a, b, matchesForComparison, sortingConditions);
        });
        
        const totalMatches = groupMatches.length;
        const completedCount = completedMatches.length;
        
        return {
            category,
            group,
            groupType: 'základná',
            teams: sortedTeams,
            totalMatches,
            completedCount,
            matches: groupMatches,
            matchesForComparison: matchesForComparison,
            sortingConditions: sortingConditions,
            completionPercentage: totalMatches > 0 ? (completedCount / totalMatches * 100) : 0,
            isFullyCompleted: totalMatches === completedCount,
            pointsForWin: currentPointsForWin
        };
    }, [teamNames, pointsForWin, sortingConditions]);
    
    const calculateAdvancedGroupTable = useCallback((category, group, groupMatches, allBaseGroupTables) => {
        const groupType = 'nadstavbová';
        
        let categoryId = null;
        if (window.categoriesData) {
            for (const [catId, catName] of Object.entries(window.categoriesData)) {
                if (catName === category) {
                    categoryId = catId;
                    break;
                }
            }
        }
        
        const carryOverEnabled = categorySettings[category]?.carryOverPoints ?? false;
        
        const teamsMap = new Map();
        groupMatches.forEach(match => {
            if (match.homeTeamIdentifier && !teamsMap.has(match.homeTeamIdentifier)) {
                const teamName = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                teamsMap.set(match.homeTeamIdentifier, {
                    id: match.homeTeamIdentifier,
                    name: teamName,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0,
                    goalDifference: 0
                });
            }
            if (match.awayTeamIdentifier && !teamsMap.has(match.awayTeamIdentifier)) {
                const teamName = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                teamsMap.set(match.awayTeamIdentifier, {
                    id: match.awayTeamIdentifier,
                    name: teamName,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0,
                    goalDifference: 0
                });
            }
        });
        
        const teamNameMap = new Map();
        for (const [id, team] of teamsMap) {
            teamNameMap.set(id, team.name);
            if (team.name !== id) {
                teamNameMap.set(team.name, team.name);
            }
        }
        
        const currentPointsForWin = pointsForWin;
        
        const allMatchesForComparison = [];
        const transferredMatches = [];
        const processedPairs = new Set();
        
        groupMatches.forEach(match => {
            const homeTeam = teamsMap.get(match.homeTeamIdentifier);
            const awayTeam = teamsMap.get(match.awayTeamIdentifier);
            
            let homeName = homeTeam ? homeTeam.name : match.homeTeamIdentifier;
            let awayName = awayTeam ? awayTeam.name : match.awayTeamIdentifier;
            
            let homeScore = match.homeScore || 0;
            let awayScore = match.awayScore || 0;
            
            if (homeScore === 0 && awayScore === 0 && match.id) {
                const events = window.matchTracker?.getEvents?.(match.id) || [];
                const score = getCurrentScoreFromEvents(events);
                homeScore = score.home;
                awayScore = score.away;
            }
            
            const matchData = {
                ...match,
                homeTeamName: homeName,
                awayTeamName: awayName,
                homeScore: homeScore,
                awayScore: awayScore,
                isTransferred: false
            };
            allMatchesForComparison.push(matchData);
            
            if (match.status === 'completed' && homeTeam && awayTeam) {
                const pairKey = homeName < awayName ? `${homeName}|${awayName}` : `${awayName}|${homeName}`;
                if (!processedPairs.has(pairKey)) {
                    processedPairs.add(pairKey);
                    
                    homeTeam.played++;
                    awayTeam.played++;
                    homeTeam.goalsFor += homeScore;
                    homeTeam.goalsAgainst += awayScore;
                    awayTeam.goalsFor += awayScore;
                    awayTeam.goalsAgainst += homeScore;
                    
                    if (homeScore > awayScore) {
                        homeTeam.wins++;
                        homeTeam.points += currentPointsForWin;
                        awayTeam.losses++;
                    } else if (awayScore > homeScore) {
                        awayTeam.wins++;
                        awayTeam.points += currentPointsForWin;
                        homeTeam.losses++;
                    } else {
                        homeTeam.draws++;
                        homeTeam.points += 1;
                        awayTeam.draws++;
                        awayTeam.points += 1;
                    }
                }
            }
        });
        
        if (carryOverEnabled && allBaseGroupTables && allBaseGroupTables.length > 0) {
            for (const baseTable of allBaseGroupTables) {
                const baseCompletedMatches = baseTable.matches.filter(m => m.status === 'completed');
                
                for (const match of baseCompletedMatches) {
                    let homeFinalName = null;
                    let awayFinalName = null;
                    
                    for (const team of baseTable.teams) {
                        if (team.id === match.homeTeamIdentifier) {
                            homeFinalName = team.name;
                        }
                        if (team.id === match.awayTeamIdentifier) {
                            awayFinalName = team.name;
                        }
                    }
                    
                    if (!homeFinalName || !awayFinalName) continue;
                    
                    const homeInAdvanced = teamsMap.has(match.homeTeamIdentifier) || 
                                           Array.from(teamsMap.values()).some(t => t.name === homeFinalName);
                    const awayInAdvanced = teamsMap.has(match.awayTeamIdentifier) || 
                                           Array.from(teamsMap.values()).some(t => t.name === awayFinalName);
                    
                    if (homeInAdvanced && awayInAdvanced) {
                        const pairKey = homeFinalName < awayFinalName ? 
                            `${homeFinalName}|${awayFinalName}` : `${awayFinalName}|${homeFinalName}`;
                        
                        if (!processedPairs.has(pairKey)) {
                            let homeScore = match.homeScore || 0;
                            let awayScore = match.awayScore || 0;
                            
                            if (homeScore === 0 && awayScore === 0 && match.id) {
                                const events = window.matchTracker?.getEvents?.(match.id) || [];
                                const score = getCurrentScoreFromEvents(events);
                                homeScore = score.home;
                                awayScore = score.away;
                            }
                            
                            let homeTeam = teamsMap.get(match.homeTeamIdentifier);
                            let awayTeam = teamsMap.get(match.awayTeamIdentifier);
                            
                            if (!homeTeam) {
                                homeTeam = Array.from(teamsMap.values()).find(t => t.name === homeFinalName);
                            }
                            if (!awayTeam) {
                                awayTeam = Array.from(teamsMap.values()).find(t => t.name === awayFinalName);
                            }
                            
                            if (homeTeam && awayTeam) {
                                homeTeam.played++;
                                awayTeam.played++;
                                homeTeam.goalsFor += homeScore;
                                homeTeam.goalsAgainst += awayScore;
                                awayTeam.goalsFor += awayScore;
                                awayTeam.goalsAgainst += homeScore;
                                
                                if (homeScore > awayScore) {
                                    homeTeam.wins++;
                                    homeTeam.points += currentPointsForWin;
                                    awayTeam.losses++;
                                } else if (awayScore > homeScore) {
                                    awayTeam.wins++;
                                    awayTeam.points += currentPointsForWin;
                                    homeTeam.losses++;
                                } else {
                                    homeTeam.draws++;
                                    homeTeam.points += 1;
                                    awayTeam.draws++;
                                    awayTeam.points += 1;
                                }
                                
                                processedPairs.add(pairKey);
                                
                                transferredMatches.push({
                                    id: `transferred_${match.id}`,
                                    homeTeamIdentifier: match.homeTeamIdentifier,
                                    awayTeamIdentifier: match.awayTeamIdentifier,
                                    homeTeamName: homeFinalName,
                                    awayTeamName: awayFinalName,
                                    homeScore: homeScore,
                                    awayScore: awayScore,
                                    status: 'completed',
                                    isTransferred: true,
                                    fromGroup: match.groupName,
                                    scheduledTime: match.scheduledTime || null,
                                    hallId: match.hallId || null,
                                    categoryName: match.categoryName,
                                    categoryId: match.categoryId
                                });
                                
                                allMatchesForComparison.push({
                                    ...match,
                                    homeTeamName: homeFinalName,
                                    awayTeamName: awayFinalName,
                                    homeScore: homeScore,
                                    awayScore: awayScore,
                                    isTransferred: true,
                                    fromGroup: match.groupName
                                });
                            }
                        }
                    }
                }
            }
        }
        
        const teams = Array.from(teamsMap.values());
        teams.forEach(team => {
            team.goalDifference = team.goalsFor - team.goalsAgainst;
        });
        
        const sortedTeams = [...teams].sort((a, b) => {
            return compareTeams(a, b, allMatchesForComparison, sortingConditions);
        });
        
        const totalMatches = groupMatches.length;
        const completedCount = groupMatches.filter(m => m.status === 'completed').length;
        
        return {
            category,
            categoryId,
            group,
            groupType: groupType,
            teams: sortedTeams,
            totalMatches,
            completedCount,
            matches: groupMatches,
            matchesForComparison: allMatchesForComparison,
            transferredMatches: transferredMatches,
            sortingConditions: sortingConditions,
            completionPercentage: totalMatches > 0 ? (completedCount / totalMatches * 100) : 0,
            isFullyCompleted: totalMatches === completedCount,
            carryOverEnabled: carryOverEnabled,
            baseGroups: allBaseGroupTables ? allBaseGroupTables.map(t => t.group) : [],
            pointsForWin: currentPointsForWin
        };
    }, [teamNames, categorySettings, pointsForWin, sortingConditions]);
        
    useEffect(() => {
        if (!matches || matches.length === 0) {
            setLoading(false);
            return;
        }
        
        const calculateAllTables = () => {
            const groupsMap = new Map();
            
            matches.forEach(match => {
                if (match.isPlacementMatch) return;
                if (!match.categoryName || !match.groupName) return;
                
                const key = `${match.categoryName}|${match.groupName}`;
                if (!groupsMap.has(key)) {
                    groupsMap.set(key, {
                        category: match.categoryName,
                        group: match.groupName,
                        matches: []
                    });
                }
                groupsMap.get(key).matches.push(match);
            });
        
            const baseGroupTables = [];
            const advancedGroupData = [];
        
            for (const [key, groupData] of groupsMap) {
                const { category, group, matches: groupMatches } = groupData;
                
                let isAdvanced = false;
                let categoryId = null;
                
                if (window.categoriesData) {
                    for (const [catId, catName] of Object.entries(window.categoriesData)) {
                        if (catName === category) {
                            categoryId = catId;
                            break;
                        }
                    }
                }
                
                if (categoryId && groupsDataState[categoryId]) {
                    const found = groupsDataState[categoryId].find(g => g.name === group);
                    if (found && found.type === 'nadstavbová skupina') {
                        isAdvanced = true;
                    }
                }
                
                if (!isAdvanced && group.toLowerCase().includes('nadstavbová')) {
                    isAdvanced = true;
                }
                
                if (isAdvanced) {
                    advancedGroupData.push({
                        category,
                        categoryId,
                        group,
                        matches: groupMatches,
                        key
                    });
                } else {
                    const table = calculateGroupTable(category, group, groupMatches);
                    if (table) {
                        baseGroupTables.push(table);
                    }
                }
            }
            
            const allTables = [...baseGroupTables];
            
            const baseGroupsByCategory = {};
            for (const baseTable of baseGroupTables) {
                if (!baseGroupsByCategory[baseTable.category]) {
                    baseGroupsByCategory[baseTable.category] = [];
                }
                baseGroupsByCategory[baseTable.category].push(baseTable);
            }
            
            for (const advData of advancedGroupData) {
                const { category, group, matches: groupMatches } = advData;
                
                const baseGroups = baseGroupsByCategory[category] || [];
                
                const table = calculateAdvancedGroupTable(category, group, groupMatches, baseGroups);
                if (table) {
                    allTables.push(table);
                }
            }
            
            allTables.sort((a, b) => {
                if (a.category !== b.category) return a.category.localeCompare(b.category);
                const aIsAdvanced = a.groupType === 'nadstavbová';
                const bIsAdvanced = b.groupType === 'nadstavbová';
                if (aIsAdvanced !== bIsAdvanced) return aIsAdvanced ? 1 : -1;
                return a.group.localeCompare(b.group);
            });
            
            setGroupTables(allTables);
            setLoading(false);
        };
        
        calculateAllTables();
    }, [matches, categoriesData, groupsDataState, teamNames, pointsForWin, sortingConditions, categorySettings, calculateGroupTable, calculateAdvancedGroupTable]);
    
    const categories = useMemo(() => {
        const cats = new Set();
        groupTables.forEach(table => cats.add(table.category));
        return Array.from(cats).sort();
    }, [groupTables]);
    
    const filteredTables = useMemo(() => {
        let filtered = groupTables;
        if (selectedCategory) {
            filtered = filtered.filter(t => t.category === selectedCategory);
        }
        if (selectedGroup) {
            filtered = filtered.filter(t => t.group === selectedGroup);
        }
        return filtered;
    }, [groupTables, selectedCategory, selectedGroup]);
    
    const groupsForCategory = useMemo(() => {
        if (!selectedCategory) return [];
        const groups = new Set();
        groupTables
            .filter(t => t.category === selectedCategory)
            .forEach(t => groups.add(t.group));
        return Array.from(groups).sort();
    }, [groupTables, selectedCategory]);

    const handlePlayoffClick = () => {
        const newState = !showPlayoff;
        setShowPlayoff(newState);
        // Pri zapnutí Playoff zrušíme výber skupiny (lebo skupina sa v Playoff nepoužíva)
        if (newState) {
            setSelectedGroup(null);
        }
    };
    
    const handleTableHeaderClick = (category, group) => {
        setShowPlayoff(false);
        if (selectedCategory === category && selectedGroup === group) {
            setSelectedCategory(null);
            setSelectedGroup(null);
        } else {
            setSelectedCategory(category);
            setSelectedGroup(group);
        }
    };

    const handleCategoryPlayoffClick = useCallback((category) => {
        // Ak je už vybraná táto kategória a Playoff je aktívny, vypneme len Playoff
        if (selectedCategory === category && showPlayoff) {
            setShowPlayoff(false);
        } else {
            setSelectedCategory(category);
            setShowPlayoff(true);
            setSelectedGroup(null);
        }
    }, [selectedCategory, showPlayoff]);
    
    const clearFilters = useCallback(() => {
        setShowPlayoff(false);
        setSelectedCategory(null);
        setSelectedGroup(null);
    }, []);
    
    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center py-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
        );
    }
    
    if (groupTables.length === 0) {
        return React.createElement(
            'div',
            { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl' },
            React.createElement('i', { className: 'fa-solid fa-table text-5xl mb-3 opacity-50' }),
            React.createElement('p', { className: 'text-lg' }, 'Žiadne tabuľky skupín')
        );
    }
    
    const renderFilters = () => {
        const getGroupsByType = (category) => {
            if (!category) return { basic: [], advanced: [] };
            const groups = [];
            groupTables
                .filter(t => t.category === category)
                .forEach(t => groups.push(t.group));
            groups.sort();
            const basic = [];
            const advanced = [];
            groups.forEach(groupName => {
                let groupType = 'základná';
                let categoryId = null;
                if (window.categoriesData) {
                    for (const [catId, catName] of Object.entries(window.categoriesData)) {
                        if (catName === category) {
                            categoryId = catId;
                            break;
                        }
                    }
                }
                if (categoryId && groupsDataState[categoryId]) {
                    const found = groupsDataState[categoryId].find(g => g.name === groupName);
                    if (found && found.type) {
                        groupType = found.type === 'nadstavbová skupina' ? 'nadstavbová' : 'základná';
                    }
                }
                if (groupType === 'nadstavbová') {
                    advanced.push(groupName);
                } else {
                    basic.push(groupName);
                }
            });
            return { basic, advanced };
        };
    
        const { basic: basicGroups, advanced: advancedGroups } = getGroupsByType(selectedCategory);
    
        const getCategoryIdByName = (categoryName) => {
            if (!categoryName) return null;
            if (window.categoriesData) {
                for (const [catId, catName] of Object.entries(window.categoriesData)) {
                    if (catName === categoryName) {
                        return catId;
                    }
                }
            }
            return null;
        };
    
        return React.createElement(
            'div',
            { className: 'mb-6 space-y-3' },
    
            React.createElement(
                'div',
                { className: 'flex flex-wrap gap-2 justify-center' },
                React.createElement(
                    'button',
                    {
                        onClick: clearFilters,
                        className: `px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                            selectedCategory === null
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`
                    },
                    'Všetky kategórie'
                ),
                categories.map(cat => {
                    const isSelected = selectedCategory === cat;
                    const categoryId = getCategoryIdByName(cat);
                    const color = categoryId ? getCategoryDrawColor(categoryId) : '#3B82F6';
                    return React.createElement(
                        'button',
                        {
                            key: cat,
                            onClick: () => {
                                if (isSelected) {
                                    clearFilters();
                                } else {
                                    setShowPlayoff(false);
                                    setSelectedCategory(cat);
                                    setSelectedGroup(null);
                                }
                            },
                            className: `px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                                isSelected
                                    ? 'text-white shadow-md'
                                    : 'text-gray-700 hover:bg-gray-300'
                            }`,
                            style: isSelected ? { backgroundColor: color } : { backgroundColor: getLighterColor(color) }
                        },
                        cat
                    );
                })
            ),
    
            selectedCategory && (basicGroups.length > 0 || advancedGroups.length > 0) && React.createElement(
                'div',
                { className: 'border-t border-gray-200 pt-3 space-y-2' },
    
                basicGroups.length > 0 && React.createElement(
                    'div',
                    { className: 'flex flex-wrap items-center gap-2 justify-center' },
                    React.createElement(
                        'span',
                        { className: 'text-xs font-medium text-gray-400 mr-1' },
                        'Základné:'
                    ),
                    basicGroups.map(group => {
                        const isSelected = selectedGroup === group;
                        const bgColor = isSelected ? '#166534' : '#DCFCE7';
                        const textColor = isSelected ? '#FFFFFF' : '#166534';
                        return React.createElement(
                            'button',
                            {
                                key: group,
                                onClick: () => {
                                    setShowPlayoff(false);
                                    setSelectedGroup(isSelected ? null : group);
                                },
                                className: `px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                    isSelected ? 'shadow-md' : 'hover:opacity-80'
                                }`,
                                style: { backgroundColor: bgColor, color: textColor }
                            },
                            group
                        );
                    })
                ),
    
                advancedGroups.length > 0 && React.createElement(
                    'div',
                    { className: 'flex flex-wrap items-center gap-2 justify-center' },
                    React.createElement(
                        'span',
                        { className: 'text-xs font-medium text-gray-400 mr-1' },
                        'Nadstavbové:'
                    ),
                    advancedGroups.map(group => {
                        const isSelected = selectedGroup === group;
                        const bgColor = isSelected ? '#1E40AF' : '#DBEAFE';
                        const textColor = isSelected ? '#FFFFFF' : '#1E40AF';
                        return React.createElement(
                            'button',
                            {
                                key: group,
                                onClick: () => {
                                    setShowPlayoff(false);
                                    setSelectedGroup(isSelected ? null : group);
                                },
                                className: `px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                    isSelected ? 'shadow-md' : 'hover:opacity-80'
                                }`,
                                style: { backgroundColor: bgColor, color: textColor }
                            },
                            group
                        );
                    })
                )
            ),
    
            selectedCategory && React.createElement(
                'div',
                { className: 'flex flex-wrap gap-2 justify-center border-t border-gray-200 pt-3' },
                React.createElement(
                    'button',
                    {
                        onClick: handlePlayoffClick,
                        className: `px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                            showPlayoff
                                ? 'bg-red-600 text-white shadow-md scale-105'
                                : 'bg-red-200 text-red-700 hover:bg-red-300'
                        }`
                    },
                    React.createElement('i', { className: 'fa-solid fa-trophy mr-1' }),
                    'Playoff'
                )
            )
        );
    };
    
    // Získame tabuľky (filtrované)
    const tablesContent = (() => {
        if (filteredTables.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-center py-12 bg-gray-50 rounded-xl border border-gray-200' },
                React.createElement('i', { className: 'fa-solid fa-filter text-4xl mb-4 text-gray-400' }),
                React.createElement('p', { className: 'text-lg font-medium text-gray-700' }, 'Pre zvolený filter neexistujú žiadne tabuľky'),
                React.createElement(
                    'button',
                    {
                        onClick: clearFilters,
                        className: 'mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer'
                    },
                    'Zrušiť filtre'
                )
            );
        }
        return filteredTables.map(table => 
            React.createElement(GroupTable, {
                key: `${table.category}|${table.group}`,
                table: table,
                filteredTables: filteredTables,
                groupMatches: table.matches,
                transferredMatches: table.transferredMatches || [],
                teamNames: teamNames,
                matches: matches,
                groupsDataState: groupsDataState,
                handleTableHeaderClick: handleTableHeaderClick,
                getTeamForm: getTeamForm,
                hallNames: hallNames
            })
        );
    })();
    
    // Získame Playoff bloky (generujeme vždy, keď existujú play-off zápasy)
    const playoffContent = (() => {
        // Ak je vybraná konkrétna skupina, playoff bloky sa NESMIE zobrazovať
        if (selectedGroup) {
            return null;
        }

        let playoffMatches = matches.filter(m => isEliminationMatch(m));
        if (selectedCategory) {
            playoffMatches = playoffMatches.filter(m => {
                if (m.categoryId === selectedCategory) return true;
                if (m.categoryName === selectedCategory) return true;
                if (m.categoryId && categoriesData[m.categoryId] === selectedCategory) return true;
                return false;
            });
        }
        
        const spiderMatches = playoffMatches.filter(m => m.matchType && !m.isPlacementMatch);
        const placementMatches = playoffMatches.filter(m => m.isPlacementMatch);
        const allPlayoffMatches = [...spiderMatches, ...placementMatches];
        if (allPlayoffMatches.length === 0) return null;
    
        const getMatchCategory = (match) => {
            if (match.categoryId && categoriesData[match.categoryId]) return categoriesData[match.categoryId];
            if (match.categoryName) return match.categoryName;
            return null;
        };
    
        const matchesByCategory = {};
        allPlayoffMatches.forEach(m => {
            const cat = getMatchCategory(m);
            if (!cat) return;
            if (!matchesByCategory[cat]) matchesByCategory[cat] = [];
            matchesByCategory[cat].push(m);
        });
    
        const spiderByCategory = {};
        spiderMatches.forEach(m => {
            const cat = getMatchCategory(m);
            if (!cat) return;
            if (!spiderByCategory[cat]) spiderByCategory[cat] = [];
            spiderByCategory[cat].push(m);
        });
    
        const categoryComponents = Object.keys(matchesByCategory).map(cat => {
            const catAllMatches = matchesByCategory[cat];
            const catSpiderMatches = spiderByCategory[cat] || [];
            return React.createElement(
                'div',
                { key: `playoff-block-${cat}`, className: 'mb-12' },
                catSpiderMatches.length > 0 && React.createElement(PlayoffSpider, {
                    key: `spider-${cat}`,
                    matches: catSpiderMatches,
                    selectedCategory: cat,
                    teamNames: teamNames,
                    hallNames: hallNames,
                    categoriesData: categoriesData,
                    onHeaderClick: handleCategoryPlayoffClick
                }),
                React.createElement(PlayoffMatchesList, {
                    key: `matches-${cat}`,
                    matches: catAllMatches,
                    teamNames: teamNames,
                    hallNames: hallNames,
                    categoriesData: categoriesData,
                    category: cat,
                    onHeaderClick: handleCategoryPlayoffClick
                })
            );
        });
    
        return categoryComponents.length > 0 ? categoryComponents : null;
    })();
        
    // Hlavný návrat
    return React.createElement(
        'div',
        { className: 'max-w-7xl mx-auto px-4 py-6' },
        React.createElement(
            'div',
            { className: 'mb-6 text-center' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Tabuľky skupín'),
        ),
        renderFilters(),
        (() => {
            // 1. Ak je zapnutý prepínač Playoff a máme vybranú kategóriu → zobrazíme len playoff bloky
            if (selectedCategory && showPlayoff) {
                return playoffContent;
            }
    
            // 2. Ak existujú playoff bloky a máme nejaké tabuľky (filteredTables)
            if (playoffContent && filteredTables.length > 0) {
                // Zoskupíme tabuľky podľa kategórie
                const tablesByCategory = {};
                filteredTables.forEach(table => {
                    if (!tablesByCategory[table.category]) {
                        tablesByCategory[table.category] = [];
                    }
                    tablesByCategory[table.category].push(table);
                });
    
                const categoryOrder = Object.keys(tablesByCategory).sort();
                const content = [];
    
                categoryOrder.forEach(cat => {
                    const catTables = tablesByCategory[cat];
                    const basicTables = catTables.filter(t => t.groupType !== 'nadstavbová');
                    const advancedTables = catTables.filter(t => t.groupType === 'nadstavbová');
    
                    // Základné tabuľky
                    basicTables.forEach(table => {
                        content.push(React.createElement(GroupTable, {
                            key: `${table.category}|${table.group}`,
                            table: table,
                            filteredTables: filteredTables,
                            groupMatches: table.matches,
                            transferredMatches: table.transferredMatches || [],
                            teamNames: teamNames,
                            matches: matches,
                            groupsDataState: groupsDataState,
                            handleTableHeaderClick: handleTableHeaderClick,
                            getTeamForm: getTeamForm,
                            hallNames: hallNames
                        }));
                    });
    
                    // Nadstavbové tabuľky
                    advancedTables.forEach(table => {
                        content.push(React.createElement(GroupTable, {
                            key: `${table.category}|${table.group}`,
                            table: table,
                            filteredTables: filteredTables,
                            groupMatches: table.matches,
                            transferredMatches: table.transferredMatches || [],
                            teamNames: teamNames,
                            matches: matches,
                            groupsDataState: groupsDataState,
                            handleTableHeaderClick: handleTableHeaderClick,
                            getTeamForm: getTeamForm,
                            hallNames: hallNames
                        }));
                    });
    
                    // Ak má kategória nadstavbové tabuľky a existujú playoff bloky pre túto kategóriu,
                    // pridáme ich hneď za poslednú nadstavbovú tabuľku
                    if (advancedTables.length > 0 && playoffContent) {
                        const catPlayoffBlocks = playoffContent.filter(
                            block => block.key === `playoff-block-${cat}`
                        );
                        if (catPlayoffBlocks.length > 0) {
                            content.push(catPlayoffBlocks[0]);
                        }
                    }
                });
    
                return content;
            }
    
            // 3. Inak zobrazíme len tabuľky (žiadny playoff, alebo žiadne nadstavbové)
            return tablesContent;
        })()
    );
};

const PlayoffSpider = ({ matches, selectedCategory, teamNames, hallNames, categoriesData, onHeaderClick }) => {

    console.log('PlayoffSpider volaný, matches:', matches.length, 'selectedCategory:', selectedCategory);
    
    const [spiderModule, setSpiderModule] = useState(null);
    const [spiderData, setSpiderData] = useState(null);
    const [spiderLevel, setSpiderLevel] = useState(1);

    useEffect(() => {
        console.log('Spúšťam import logged-in-spider.js');
        import('./logged-in-spider.js')
            .then(module => {
                console.log('Modul načítaný:', Object.keys(module));
                // Odstrániť event listener, ktorý spúšťa renderovanie
                window.removeEventListener('globalDataUpdated', module.handleDataUpdateAndRender);
                setSpiderModule(module);
            })
            .catch(err => console.error('Chyba pri načítaní pavúka:', err));
    }, []);

    useEffect(() => {
        if (!spiderModule || !selectedCategory) return;

        const spiderMatches = matches.filter(m => 
            m.matchType && 
            ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto', 
             'štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4',
             'osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
             'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8',
             'šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
             'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
             'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
             'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'].includes(m.matchType)
        );

        if (spiderMatches.length === 0) {
            setSpiderData(null);
            return;
        }

        const hasSixteenfinals = spiderMatches.some(m => m.matchType.startsWith('šestnásťfinále'));
        const hasEightfinals = spiderMatches.some(m => m.matchType.startsWith('osemfinále'));
        const hasQuarterfinals = spiderMatches.some(m => m.matchType.startsWith('štvrťfinále'));

        let level = 1;
        if (hasSixteenfinals) level = 4;
        else if (hasEightfinals) level = 3;
        else if (hasQuarterfinals) level = 2;
        setSpiderLevel(level);

        const structure = {
            final: spiderMatches.find(m => m.matchType === 'finále') || { exists: false },
            semiFinals: [
                spiderMatches.find(m => m.matchType === 'semifinále 1') || { exists: false },
                spiderMatches.find(m => m.matchType === 'semifinále 2') || { exists: false }
            ],
            quarterFinals: [
                spiderMatches.find(m => m.matchType === 'štvrťfinále 1') || { exists: false },
                spiderMatches.find(m => m.matchType === 'štvrťfinále 2') || { exists: false },
                spiderMatches.find(m => m.matchType === 'štvrťfinále 3') || { exists: false },
                spiderMatches.find(m => m.matchType === 'štvrťfinále 4') || { exists: false }
            ],
            eightFinals: [
                spiderMatches.find(m => m.matchType === 'osemfinále 1') || { exists: false },
                spiderMatches.find(m => m.matchType === 'osemfinále 2') || { exists: false },
                spiderMatches.find(m => m.matchType === 'osemfinále 3') || { exists: false },
                spiderMatches.find(m => m.matchType === 'osemfinále 4') || { exists: false },
                spiderMatches.find(m => m.matchType === 'osemfinále 5') || { exists: false },
                spiderMatches.find(m => m.matchType === 'osemfinále 6') || { exists: false },
                spiderMatches.find(m => m.matchType === 'osemfinále 7') || { exists: false },
                spiderMatches.find(m => m.matchType === 'osemfinále 8') || { exists: false }
            ],
            sixteenFinals: [
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 1') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 2') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 3') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 4') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 5') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 6') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 7') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 8') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 9') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 10') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 11') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 12') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 13') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 14') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 15') || { exists: false },
                spiderMatches.find(m => m.matchType === 'šestnásťfinále 16') || { exists: false }
            ],
            thirdPlace: spiderMatches.find(m => m.matchType === 'o 3. miesto') || { exists: false }
        };

        spiderMatches.forEach(match => {
            const key = match.matchType;
            if (key === 'finále') {
                structure.final = { ...structure.final, ...match, exists: true };
            } else if (key === 'semifinále 1') {
                structure.semiFinals[0] = { ...structure.semiFinals[0], ...match, exists: true };
            } else if (key === 'semifinále 2') {
                structure.semiFinals[1] = { ...structure.semiFinals[1], ...match, exists: true };
            } else if (key === 'o 3. miesto') {
                structure.thirdPlace = { ...structure.thirdPlace, ...match, exists: true };
            } else if (key.startsWith('štvrťfinále')) {
                const index = parseInt(key.split(' ')[1]) - 1;
                if (index >= 0 && index < 4) {
                    structure.quarterFinals[index] = { ...structure.quarterFinals[index], ...match, exists: true };
                }
            } else if (key.startsWith('osemfinále')) {
                const index = parseInt(key.split(' ')[1]) - 1;
                if (index >= 0 && index < 8) {
                    structure.eightFinals[index] = { ...structure.eightFinals[index], ...match, exists: true };
                }
            } else if (key.startsWith('šestnásťfinále')) {
                const index = parseInt(key.split(' ')[1]) - 1;
                if (index >= 0 && index < 16) {
                    structure.sixteenFinals[index] = { ...structure.sixteenFinals[index], ...match, exists: true };
                }
            }
        });

        setSpiderData(structure);
    }, [selectedCategory, matches, spiderModule]);

    if (!spiderModule || !spiderData) return null;

    let renderFunction;
    if (spiderLevel === 4) renderFunction = spiderModule.renderLevel4;
    else if (spiderLevel === 3) renderFunction = spiderModule.renderLevel3;
    else if (spiderLevel === 2) renderFunction = spiderModule.renderLevel2;
    else renderFunction = spiderModule.renderLevel1;

    const dummyUserProfile = { role: 'user' };
    const categoryName = categoriesData[selectedCategory] || selectedCategory;

    return React.createElement(
        'div',
        { className: 'mt-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
        React.createElement(
            'div',
            { 
                className: 'bg-red-200 px-6 py-3 border-b border-gray-200 cursor-pointer hover:bg-red-300 transition-colors',
                onClick: () => onHeaderClick && onHeaderClick(selectedCategory)
            },
            React.createElement('h3', { className: 'font-semibold text-red-700' }, `Pavúk - ${categoryName}`)
        ),
        React.createElement(
            'div',
            { className: 'p-4 overflow-x-auto' },
            React.createElement(
                'table',
                {
                    style: {
                        borderCollapse: 'collapse',
                        width: '100%',
                        tableLayout: 'fixed',
                        border: '0px solid #d1d5db'
                    }
                },
                React.createElement(
                    'tbody',
                    null,
                    renderFunction(
                        spiderData,
                        dummyUserProfile,
                        false,
                        null,
                        null,
                        null,
                        null,
                        true,
                        matches,
                        false
                    )
                )
            )
        )
    );
};

const TablesApp = () => {
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
    const [hallNames, setHallNames] = useState({});
    
    const [matchStatuses, setMatchStatuses] = useState({});
    const [shouldRecalculate, setShouldRecalculate] = useState(false);
    const [lastCompletedMatchId, setLastCompletedMatchId] = useState(null);
    
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
    
    const recalculateAllTeamNames = useCallback(async () => {
        
        if (!window.matchTracker || typeof window.matchTracker.getTeamNameByDisplayId !== 'function') {
            return;
        }
        
        const names = { ...teamNames };
        let needsUpdate = false;
        
        for (const match of matches) {
            let categoryName = match.categoryName;
            if (!categoryName && match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
                categoryName = window.categoriesData[match.categoryId];
            }
            if (!categoryName) continue;
            
            if (match.homeTeamIdentifier) {
                const currentDisplayName = names[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                    try {
                        const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                        if (newName && newName !== currentDisplayName && newName !== names[match.homeTeamIdentifier]) {
                            names[match.homeTeamIdentifier] = newName;
                            needsUpdate = true;
                        }
                    } catch (err) {}
                } else if (!names[match.homeTeamIdentifier]) {
                    names[match.homeTeamIdentifier] = currentDisplayName;
                }
            }
            
            if (match.awayTeamIdentifier) {
                const currentDisplayName = names[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                    try {
                        const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                        if (newName && newName !== currentDisplayName && newName !== names[match.awayTeamIdentifier]) {
                            names[match.awayTeamIdentifier] = newName;
                            needsUpdate = true;
                        }
                    } catch (err) {}
                } else if (!names[match.awayTeamIdentifier]) {
                    names[match.awayTeamIdentifier] = currentDisplayName;
                }
            }
        }
        
        if (needsUpdate) {
            setTeamNames(prev => ({ ...prev, ...names }));
            window.teamNames = { ...window.teamNames, ...names };
        } else {
        }
    }, [matches, teamNames]);
    
    const recalculateAllTables = useCallback(() => {
        setShouldRecalculate(prev => !prev);
    }, []);
    
    useEffect(() => {
        if (!window.db) return;
        
        const matchesRef = collection(window.db, 'matches');
        let previousStatuses = {};
        
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const updatedStatuses = {};
            let hasNewCompleted = false;
            let completedMatchId = null;
            let completedMatchData = null;
            
            snapshot.docChanges().forEach(change => {
                const match = {
                    id: change.doc.id,
                    ...change.doc.data()
                };
                
                const newStatus = match.status || 'scheduled';
                const oldStatus = previousStatuses[match.id];
                
                updatedStatuses[match.id] = newStatus;
                
                if (change.type === 'modified' && oldStatus && oldStatus !== 'completed' && newStatus === 'completed') {
                    hasNewCompleted = true;
                    completedMatchId = match.id;
                    completedMatchData = match;
                }
            });
            
            if (Object.keys(updatedStatuses).length > 0) {
                previousStatuses = { ...previousStatuses, ...updatedStatuses };
                setMatchStatuses(prev => ({ ...prev, ...updatedStatuses }));
            }
            
            if (hasNewCompleted) {
                setLastCompletedMatchId(completedMatchId);
                
                setTimeout(async () => {                    
                    await recalculateAllTeamNames();                    
                    recalculateAllTables();                    
                    if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                        window.updateTeamNamesGlobally();
                    }
                    
                }, 1000);
            }
            
        }, (err) => {
        });
        
        return () => unsubscribe();
    }, [recalculateAllTeamNames, recalculateAllTables]);
    
    const loadTeamNames = async (matchesList) => {
        const names = { ...teamNames };
        let needsUpdate = false;
        
        if (!window.matchTracker || typeof window.matchTracker.getTeamNameByDisplayId !== 'function') {
            for (const match of matchesList) {
                if (match.homeTeamIdentifier && !names[match.homeTeamIdentifier]) {
                    names[match.homeTeamIdentifier] = match.homeTeamIdentifier;
                }
                if (match.awayTeamIdentifier && !names[match.awayTeamIdentifier]) {
                    names[match.awayTeamIdentifier] = match.awayTeamIdentifier;
                }
            }
            setTeamNames(names);
            return;
        }
        
        for (const match of matchesList) {
            let categoryName = match.categoryName;
            if (!categoryName && match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
                categoryName = window.categoriesData[match.categoryId];
            }
            if (!categoryName) continue;
            
            if (match.homeTeamIdentifier) {
                const currentDisplayName = names[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                    try {
                        const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                        if (newName && newName !== currentDisplayName && newName !== names[match.homeTeamIdentifier]) {
                            names[match.homeTeamIdentifier] = newName;
                            needsUpdate = true;
                        }
                    } catch (err) {}
                } else if (!names[match.homeTeamIdentifier]) {
                    names[match.homeTeamIdentifier] = currentDisplayName;
                }
            }
            
            if (match.awayTeamIdentifier) {
                const currentDisplayName = names[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                    try {
                        const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                        if (newName && newName !== currentDisplayName && newName !== names[match.awayTeamIdentifier]) {
                            names[match.awayTeamIdentifier] = newName;
                            needsUpdate = true;
                        }
                    } catch (err) {}
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
    
    const loadHallNames = async (matchesList) => {
        const hallIds = new Set();
        matchesList.forEach(match => {
            if (match.hallId) hallIds.add(match.hallId);
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
    
    useEffect(() => {
        const init = async () => {
            if (!window.db) {
                setError('Databáza nie je inicializovaná');
                setLoading(false);
                return;
            }
            
            setLoading(true);
            setError(null);
            
            try {
                await loadCategoryColors();
                await loadGroupsData();
                
                const matchesRef = collection(window.db, 'matches');
                const querySnapshot = await getDocs(matchesRef);
                
                const allMatches = [];
                const initialStatuses = {};
                querySnapshot.forEach((doc) => {
                    const match = { id: doc.id, ...doc.data() };
                    allMatches.push(match);
                    initialStatuses[doc.id] = match.status || 'scheduled';
                });
                
                allMatches.sort((a, b) => {
                    if (!a.scheduledTime) return 1;
                    if (!b.scheduledTime) return -1;
                    try {
                        return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime();
                    } catch (e) {
                        return 0;
                    }
                });
                
                setMatches(allMatches);
                setMatchStatuses(initialStatuses);
                
                await loadHallNames(allMatches);
                
                await loadTeamNames(allMatches);
                
                window.matchesData = allMatches;
                
            } catch (err) {
                setError('Nepodarilo sa načítať dáta: ' + err.message);
            } finally {
                setLoading(false);
            }
        };
        
        init();
    }, []);
    
    useEffect(() => {
        if (!window.db) return;
        
        const matchesRef = collection(window.db, 'matches');
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const updatedMatches = [];
            snapshot.forEach((doc) => {
                const match = { id: doc.id, ...doc.data() };
                updatedMatches.push(match);
            });
            
            updatedMatches.sort((a, b) => {
                if (!a.scheduledTime) return 1;
                if (!b.scheduledTime) return -1;
                try {
                    return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime();
                } catch (e) {
                    return 0;
                }
            });
            
            setMatches(updatedMatches);
            window.matchesData = updatedMatches;
        }, (err) => {
        });
        
        return () => unsubscribe();
    }, []);
    
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
    
    return React.createElement(GroupTablesView, {
        matches: matches,
        categoriesData: categoriesData,
        groupsData: groupsData,
        teamNames: teamNames,
        hallNames: hallNames
    });
};

const renderApp = () => {
    const rootElement = document.getElementById('root');
    if (rootElement && ReactDOM) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(TablesApp));
    }
};

renderApp();

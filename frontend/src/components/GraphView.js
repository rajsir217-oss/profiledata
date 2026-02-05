import React, { useRef, useMemo, useCallback, useState } from 'react';
import './GraphView.css';
import { getImageUrl } from '../utils/urlHelper';

/**
 * GraphView - Radial visualization of search results
 * 
 * Features:
 * - Center = current user ("Me")
 * - Profiles plotted based on distance from sorting value (e.g., age proximity)
 * - Concentric rings for Favorites, Shortlists, Excluder zones
 * - Hover for tooltip, drag to move between rings
 * - Lines connecting profiles to center
 */
// Fixed SVG coordinate system - always use these values for calculations
const SVG_WIDTH = 800;
const SVG_HEIGHT = 600;
const SVG_CENTER = { x: SVG_WIDTH / 2, y: SVG_HEIGHT / 2 };
const SVG_MAX_RADIUS = Math.min(SVG_WIDTH, SVG_HEIGHT) / 2 - 40;

const GraphView = ({
  users = [],
  currentUserProfile = {},
  sortBy = 'age',
  favoritedUsers = new Set(),
  shortlistedUsers = new Set(),
  excludedUsers = new Set(),
  onProfileAction,
}) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  
  // State for tooltip and drag-drop (kept minimal to avoid flickering)
  const [tooltip, setTooltip] = useState(null);
  const [dragState, setDragState] = useState(null); // { user, startPos, currentPos }
  const [dropZone, setDropZone] = useState(null); // 'favorites', 'shortlists', 'excluder', or null

  // Ring radii as percentages of the smaller dimension
  const RING_CONFIG = {
    me: 0.08,
    favorites: 0.28,
    shortlists: 0.48,
    neutral: 0.68,
    excluder: 0.88,
  };

  // Use fixed coordinate system - SVG viewBox handles scaling
  const center = SVG_CENTER;
  const maxRadius = SVG_MAX_RADIUS;

  // Get the current user's value for the sorting column
  const getCurrentUserValue = useCallback(() => {
    switch (sortBy) {
      case 'age':
        return currentUserProfile?.age || currentUserProfile?.birthYear 
          ? (currentUserProfile.age || new Date().getFullYear() - currentUserProfile.birthYear)
          : 30; // Default age
      case 'height':
        return currentUserProfile?.heightInches || 66; // Default 5'6"
      case 'matchScore':
        return 100; // Current user is 100% match to themselves
      default:
        return 0;
    }
  }, [sortBy, currentUserProfile]);

  // Calculate distance from current user based on sorting column
  const calculateDistance = useCallback((user) => {
    const myValue = getCurrentUserValue();
    
    switch (sortBy) {
      case 'age': {
        const userAge = user.age || (user.birthYear ? new Date().getFullYear() - user.birthYear : 30);
        const ageDiff = Math.abs(userAge - myValue);
        // Normalize: 0 years diff = 0, 20+ years diff = 1
        return Math.min(ageDiff / 20, 1);
      }
      case 'height': {
        const userHeight = user.heightInches || 66;
        const heightDiff = Math.abs(userHeight - myValue);
        // Normalize: 0 inches diff = 0, 12+ inches diff = 1
        return Math.min(heightDiff / 12, 1);
      }
      case 'matchScore': {
        const score = user.matchScore || user.l3v3lScore || 50;
        // Higher score = closer to center
        return 1 - (score / 100);
      }
      default:
        return 0.5; // Default to middle
    }
  }, [sortBy, getCurrentUserValue]);

  // Determine which ring a user belongs to based on their status
  // Use a stable function that reads from props directly
  const getUserRing = (user) => {
    const username = user.username;
    if (excludedUsers.has(username)) return 'excluder';
    if (favoritedUsers.has(username)) return 'favorites';
    if (shortlistedUsers.has(username)) return 'shortlists';
    return 'neutral';
  };

  // Create a stable key for users only (not dimensions)
  const usersKey = users.map(u => u.username).sort().join(',');
  
  // Calculate positions using useMemo - uses fixed SVG coordinate system
  const { userPositions, groupedUsers } = useMemo(() => {
    // Group users by ring
    const groups = { favorites: [], shortlists: [], excluder: [], neutral: [] };
    users.forEach(user => {
      const username = user.username;
      let ring = 'neutral';
      if (excludedUsers.has(username)) ring = 'excluder';
      else if (favoritedUsers.has(username)) ring = 'favorites';
      else if (shortlistedUsers.has(username)) ring = 'shortlists';
      groups[ring].push(user);
    });
    
    // Calculate positions using fixed SVG coordinates
    const positions = new Map();
    Object.entries(groups).forEach(([ringName, ringUsers]) => {
      ringUsers.forEach((user, index) => {
        const username = user.username;
        let userRing = 'neutral';
        if (excludedUsers.has(username)) userRing = 'excluder';
        else if (favoritedUsers.has(username)) userRing = 'favorites';
        else if (shortlistedUsers.has(username)) userRing = 'shortlists';
        
        // Calculate distance for neutral users
        let distance = 0.5;
        if (userRing === 'neutral') {
          const userAge = user.age || (user.birthYear ? new Date().getFullYear() - user.birthYear : 30);
          const myAge = currentUserProfile?.age || (currentUserProfile?.birthYear ? new Date().getFullYear() - currentUserProfile.birthYear : 30);
          distance = Math.min(Math.abs(userAge - myAge) / 20, 1);
        }
        
        let baseRadius;
        switch (userRing) {
          case 'favorites':
            baseRadius = RING_CONFIG.favorites * SVG_MAX_RADIUS;
            break;
          case 'shortlists':
            baseRadius = RING_CONFIG.shortlists * SVG_MAX_RADIUS;
            break;
          case 'excluder':
            baseRadius = RING_CONFIG.excluder * SVG_MAX_RADIUS;
            break;
          default:
            baseRadius = (RING_CONFIG.favorites + (RING_CONFIG.neutral - RING_CONFIG.favorites) * distance) * SVG_MAX_RADIUS;
        }
        
        const angleOffset = (2 * Math.PI) / Math.max(ringUsers.length, 1);
        const angle = index * angleOffset - Math.PI / 2;
        
        positions.set(user.username, {
          x: SVG_CENTER.x + baseRadius * Math.cos(angle),
          y: SVG_CENTER.y + baseRadius * Math.sin(angle),
          ring: userRing,
        });
      });
    });
    
    return { userPositions: positions, groupedUsers: groups };
  }, [usersKey, users, excludedUsers, favoritedUsers, shortlistedUsers, currentUserProfile, RING_CONFIG]);

  // Handle user click - open profile in new tab (only if not dragging)
  const handleUserClick = useCallback((user, e) => {
    // Don't open profile if we were dragging
    if (dragState) return;
    window.open(`/profile/${user.username}`, '_blank');
  }, [dragState]);

  // Convert screen coordinates to SVG coordinates
  const screenToSVG = useCallback((screenX, screenY) => {
    if (!svgRef.current || !containerRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = SVG_WIDTH / rect.width;
    const scaleY = SVG_HEIGHT / rect.height;
    return {
      x: (screenX - rect.left) * scaleX,
      y: (screenY - rect.top) * scaleY,
    };
  }, []);

  // Determine which ring a point is in based on distance from center
  const getDropZoneFromPosition = useCallback((svgX, svgY) => {
    const dx = svgX - SVG_CENTER.x;
    const dy = svgY - SVG_CENTER.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const normalizedDistance = distance / SVG_MAX_RADIUS;
    
    if (normalizedDistance <= RING_CONFIG.favorites) return 'favorites';
    if (normalizedDistance <= RING_CONFIG.shortlists) return 'shortlists';
    if (normalizedDistance <= RING_CONFIG.neutral) return null; // Neutral zone - remove from all
    return 'excluder';
  }, [RING_CONFIG]);

  // Handle mouse enter on user node - show tooltip
  const handleMouseEnter = useCallback((user, e) => {
    if (dragState) return; // Don't show tooltip while dragging
    const { name, age, location, height, occupation, education, matchScore } = getUserDisplay(user);
    const ring = getUserRing(user);
    const pos = userPositions.get(user.username);
    if (!pos) return;
    
    setTooltip({
      user,
      name,
      age,
      ring,
      location,
      height,
      occupation,
      education,
      matchScore,
      x: pos.x,
      y: pos.y - 45, // Position above the node
    });
  }, [dragState, userPositions]);

  // Handle mouse leave - hide tooltip
  const handleMouseLeave = useCallback(() => {
    if (!dragState) {
      setTooltip(null);
    }
  }, [dragState]);

  // Handle mouse down - start drag
  const handleMouseDown = useCallback((user, e) => {
    e.preventDefault();
    e.stopPropagation();
    const svgPos = screenToSVG(e.clientX, e.clientY);
    const pos = userPositions.get(user.username);
    
    setDragState({
      user,
      startPos: pos,
      currentPos: svgPos,
      offsetX: pos.x - svgPos.x,
      offsetY: pos.y - svgPos.y,
    });
    setTooltip(null); // Hide tooltip while dragging
  }, [screenToSVG, userPositions]);

  // Handle mouse move - update drag position
  const handleMouseMove = useCallback((e) => {
    if (!dragState) return;
    
    const svgPos = screenToSVG(e.clientX, e.clientY);
    const newX = svgPos.x + dragState.offsetX;
    const newY = svgPos.y + dragState.offsetY;
    
    setDragState(prev => ({
      ...prev,
      currentPos: { x: newX, y: newY },
    }));
    
    // Determine which drop zone we're over
    const zone = getDropZoneFromPosition(newX, newY);
    setDropZone(zone);
  }, [dragState, screenToSVG, getDropZoneFromPosition]);

  // Handle mouse up - complete drag
  const handleMouseUp = useCallback((e) => {
    if (!dragState) return;
    
    const { user } = dragState;
    const currentRing = getUserRing(user);
    
    // Execute the action based on drop zone
    if (dropZone && dropZone !== currentRing && onProfileAction) {
      const username = user.username;
      
      // First, remove from current ring if needed
      if (currentRing === 'favorites') {
        onProfileAction(e, username, 'unfavorite');
      } else if (currentRing === 'shortlists') {
        onProfileAction(e, username, 'unshortlist');
      } else if (currentRing === 'excluder') {
        onProfileAction(e, username, 'unexclude');
      }
      
      // Then add to new ring
      setTimeout(() => {
        if (dropZone === 'favorites') {
          onProfileAction(e, username, 'favorite');
        } else if (dropZone === 'shortlists') {
          onProfileAction(e, username, 'shortlist');
        } else if (dropZone === 'excluder') {
          onProfileAction(e, username, 'exclude');
        }
      }, 100);
    } else if (dropZone === null && currentRing !== 'neutral' && onProfileAction) {
      // Dropped in neutral zone - remove from current ring
      const username = user.username;
      if (currentRing === 'favorites') {
        onProfileAction(e, username, 'unfavorite');
      } else if (currentRing === 'shortlists') {
        onProfileAction(e, username, 'unshortlist');
      } else if (currentRing === 'excluder') {
        onProfileAction(e, username, 'unexclude');
      }
    }
    
    setDragState(null);
    setDropZone(null);
  }, [dragState, dropZone, onProfileAction, getUserRing]);

  // Format height for display (e.g., "5' 6\"")
  const formatHeight = (profile) => {
    if (profile?.height) return profile.height;
    if (profile?.heightInches) {
      const feet = Math.floor(profile.heightInches / 12);
      const inches = profile.heightInches % 12;
      return `${feet}'${inches}"`;
    }
    return null;
  };

  // Get occupation from profile
  const getOccupation = (profile) => {
    if (profile?.occupation) return profile.occupation;
    const workExp = profile?.workExperience;
    if (workExp && Array.isArray(workExp) && workExp.length > 0) {
      const currentJob = workExp.find(job => job.isCurrent === true);
      if (currentJob) return currentJob.description || currentJob.position || currentJob.title;
      return workExp[0].description || workExp[0].position || workExp[0].title;
    }
    return null;
  };

  // Get education from profile
  const getEducation = (profile) => {
    return profile?.education || profile?.educationHistory?.[0]?.degree || null;
  };

  // Get user display info
  const getUserDisplay = (user) => {
    const profile = user.viewerProfile || user.userProfile || user;
    const name = profile.firstName || profile.username;
    const age = profile.age || (profile.birthYear ? new Date().getFullYear() - profile.birthYear : null);
    const avatar = profile.images?.[0] || profile.profileImage;
    const initials = name ? name.charAt(0).toUpperCase() : '?';
    const location = profile.location || null;
    const height = formatHeight(profile);
    const occupation = getOccupation(profile);
    const education = getEducation(profile);
    const matchScore = user.matchScore || user.l3v3lScore || null;
    
    return { name, age, avatar, initials, gender: profile.gender, location, height, occupation, education, matchScore };
  };

  // Render ring labels
  const renderRingLabels = () => (
    <>
      <text
        x={center.x}
        y={center.y - RING_CONFIG.favorites * maxRadius - 15}
        className="ring-label favorites-label"
        textAnchor="middle"
      >
        ❤️ Favorites
      </text>
      <text
        x={center.x}
        y={center.y - RING_CONFIG.shortlists * maxRadius - 15}
        className="ring-label shortlists-label"
        textAnchor="middle"
      >
        ⭐ Shortlists
      </text>
      <text
        x={center.x}
        y={center.y - RING_CONFIG.excluder * maxRadius - 15}
        className="ring-label excluder-label"
        textAnchor="middle"
      >
        🚫 Excluded
      </text>
    </>
  );

  return (
    <div 
      className="graph-view-container" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg 
        ref={svgRef}
        width="100%" 
        height="100%"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="graph-view-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background rings - highlight active drop zone */}
        <g className="drop-zones">
          <circle 
            cx={center.x} cy={center.y} 
            r={RING_CONFIG.excluder * maxRadius} 
            className={`drop-zone excluder-zone ${dropZone === 'excluder' ? 'active' : ''}`} 
          />
          <circle 
            cx={center.x} cy={center.y} 
            r={RING_CONFIG.neutral * maxRadius} 
            className={`drop-zone neutral-zone ${dropZone === null && dragState ? 'active' : ''}`} 
          />
          <circle 
            cx={center.x} cy={center.y} 
            r={RING_CONFIG.shortlists * maxRadius} 
            className={`drop-zone shortlists-zone ${dropZone === 'shortlists' ? 'active' : ''}`} 
          />
          <circle 
            cx={center.x} cy={center.y} 
            r={RING_CONFIG.favorites * maxRadius} 
            className={`drop-zone favorites-zone ${dropZone === 'favorites' ? 'active' : ''}`} 
          />
        </g>

        {/* Ring boundaries */}
        <g className="ring-boundaries">
          <circle cx={center.x} cy={center.y} r={RING_CONFIG.favorites * maxRadius} className="ring-boundary favorites-boundary" />
          <circle cx={center.x} cy={center.y} r={RING_CONFIG.shortlists * maxRadius} className="ring-boundary shortlists-boundary" />
          <circle cx={center.x} cy={center.y} r={RING_CONFIG.neutral * maxRadius} className="ring-boundary neutral-boundary" />
          <circle cx={center.x} cy={center.y} r={RING_CONFIG.excluder * maxRadius} className="ring-boundary excluder-boundary" />
        </g>

        {/* Ring labels */}
        {renderRingLabels()}

        {/* Connection lines */}
        <g className="connection-lines">
          {users.map(user => {
            const pos = userPositions.get(user.username);
            if (!pos) return null;
            const ring = getUserRing(user);
            return (
              <line
                key={`line-${user.username}`}
                x1={center.x}
                y1={center.y}
                x2={pos.x}
                y2={pos.y}
                className={`connection-line ${ring}`}
              />
            );
          })}
        </g>

        {/* Center "Me" circle */}
        <g className="center-me">
          <circle
            cx={center.x}
            cy={center.y}
            r={RING_CONFIG.me * maxRadius}
            className="me-circle"
          />
          <text
            x={center.x}
            y={center.y + 5}
            className="me-label"
            textAnchor="middle"
          >
            Me
          </text>
        </g>

        {/* User nodes */}
        <g className="user-nodes">
          {users.map(user => {
            // Skip rendering the dragged user in its original position
            if (dragState && dragState.user.username === user.username) return null;
            
            const pos = userPositions.get(user.username);
            if (!pos) return null;
            const { name, age, avatar, initials } = getUserDisplay(user);
            const ring = getUserRing(user);
            const nodeRadius = 20;

            return (
              <g
                key={user.username}
                className={`user-node ${ring}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={(e) => handleUserClick(user, e)}
                onMouseEnter={(e) => handleMouseEnter(user, e)}
                onMouseLeave={handleMouseLeave}
                onMouseDown={(e) => handleMouseDown(user, e)}
                style={{ cursor: dragState ? 'grabbing' : 'grab' }}
              >
                {/* Node background */}
                <circle
                  r={nodeRadius}
                  className={`node-bg ${ring}`}
                />
                {/* Avatar or initials */}
                {avatar ? (
                  <clipPath id={`clip-${user.username}`}>
                    <circle r={nodeRadius - 2} />
                  </clipPath>
                ) : null}
                {avatar ? (
                  <image
                    href={getImageUrl(avatar)}
                    x={-nodeRadius + 2}
                    y={-nodeRadius + 2}
                    width={(nodeRadius - 2) * 2}
                    height={(nodeRadius - 2) * 2}
                    clipPath={`url(#clip-${user.username})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                ) : (
                  <text
                    className="node-initials"
                    textAnchor="middle"
                    dy="0.35em"
                  >
                    {initials}
                  </text>
                )}
                {/* Age badge */}
                {age && (
                  <g transform={`translate(${nodeRadius - 5}, ${-nodeRadius + 5})`}>
                    <circle r="10" className="age-badge-bg" />
                    <text className="age-badge-text" textAnchor="middle" dy="0.35em">{age}</text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Dragged node - rendered separately so it follows cursor */}
        {dragState && (() => {
          const user = dragState.user;
          const { age, avatar, initials } = getUserDisplay(user);
          const ring = getUserRing(user);
          const nodeRadius = 20;
          const pos = dragState.currentPos;

          return (
            <g
              className={`user-node ${ring} dragging`}
              transform={`translate(${pos.x}, ${pos.y})`}
              style={{ pointerEvents: 'none' }}
            >
              <circle r={nodeRadius} className={`node-bg ${ring}`} style={{ opacity: 0.8 }} />
              {avatar ? (
                <>
                  <clipPath id={`clip-drag-${user.username}`}>
                    <circle r={nodeRadius - 2} />
                  </clipPath>
                  <image
                    href={getImageUrl(avatar)}
                    x={-nodeRadius + 2}
                    y={-nodeRadius + 2}
                    width={(nodeRadius - 2) * 2}
                    height={(nodeRadius - 2) * 2}
                    clipPath={`url(#clip-drag-${user.username})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </>
              ) : (
                <text className="node-initials" textAnchor="middle" dy="0.35em">{initials}</text>
              )}
              {age && (
                <g transform={`translate(${nodeRadius - 5}, ${-nodeRadius + 5})`}>
                  <circle r="10" className="age-badge-bg" />
                  <text className="age-badge-text" textAnchor="middle" dy="0.35em">{age}</text>
                </g>
              )}
            </g>
          );
        })()}

        {/* SVG Tooltip - Rich profile card */}
        {tooltip && !dragState && (() => {
          const lines = [];
          // Line 1: Name, Age
          lines.push(`${tooltip.name}${tooltip.age ? `, ${tooltip.age}` : ''}`);
          // Line 2: Location
          if (tooltip.location) lines.push(`📍 ${tooltip.location}`);
          // Line 3: Education
          if (tooltip.education) lines.push(`🎓 ${tooltip.education.length > 25 ? tooltip.education.substring(0, 22) + '...' : tooltip.education}`);
          // Line 4: Occupation
          if (tooltip.occupation) lines.push(`💼 ${tooltip.occupation.length > 25 ? tooltip.occupation.substring(0, 22) + '...' : tooltip.occupation}`);
          // Line 5: Height & Match Score
          const extras = [];
          if (tooltip.height) extras.push(`📏 ${tooltip.height}`);
          if (tooltip.matchScore) extras.push(`🎯 ${tooltip.matchScore}%`);
          if (extras.length > 0) lines.push(extras.join('  '));
          
          const lineHeight = 16;
          const padding = 10;
          const tooltipHeight = lines.length * lineHeight + padding * 2;
          const tooltipWidth = 180;
          
          return (
            <g className="svg-tooltip" transform={`translate(${tooltip.x}, ${tooltip.y - tooltipHeight/2})`}>
              <rect
                x={-tooltipWidth/2}
                y={-tooltipHeight}
                width={tooltipWidth}
                height={tooltipHeight}
                rx="8"
                className="tooltip-bg"
              />
              {/* Ring indicator */}
              <rect
                x={-tooltipWidth/2}
                y={-tooltipHeight}
                width={tooltipWidth}
                height={4}
                rx="8"
                className={`tooltip-ring-indicator ${tooltip.ring}`}
              />
              {lines.map((line, idx) => (
                <text
                  key={idx}
                  x="0"
                  y={-tooltipHeight + padding + (idx + 1) * lineHeight - 4}
                  textAnchor="middle"
                  className={`tooltip-text ${idx === 0 ? 'tooltip-name' : 'tooltip-detail'}`}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="graph-legend">
        <div className="legend-item">
          <span className="legend-dot favorites"></span>
          <span>Favorites ({groupedUsers.favorites.length})</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot shortlists"></span>
          <span>Shortlists ({groupedUsers.shortlists.length})</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot neutral"></span>
          <span>Results ({groupedUsers.neutral.length})</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot excluder"></span>
          <span>Excluded ({groupedUsers.excluder.length})</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="graph-instructions">
        <p>🎯 Profiles closer to center are closer matches based on <strong>{sortBy}</strong></p>
        <p>👆 Click to view • ✋ Drag to move between rings</p>
      </div>
    </div>
  );
};

// Custom comparison to prevent re-renders when Set contents haven't changed
const arePropsEqual = (prevProps, nextProps) => {
  // Check if users array changed (by reference or length)
  if (prevProps.users !== nextProps.users && 
      (prevProps.users.length !== nextProps.users.length ||
       prevProps.users.map(u => u.username).join(',') !== nextProps.users.map(u => u.username).join(','))) {
    return false;
  }
  
  // Check if Set contents changed (not just reference)
  const prevFav = [...prevProps.favoritedUsers].sort().join(',');
  const nextFav = [...nextProps.favoritedUsers].sort().join(',');
  if (prevFav !== nextFav) return false;
  
  const prevShort = [...prevProps.shortlistedUsers].sort().join(',');
  const nextShort = [...nextProps.shortlistedUsers].sort().join(',');
  if (prevShort !== nextShort) return false;
  
  const prevExcl = [...prevProps.excludedUsers].sort().join(',');
  const nextExcl = [...nextProps.excludedUsers].sort().join(',');
  if (prevExcl !== nextExcl) return false;
  
  // Check other props
  if (prevProps.sortBy !== nextProps.sortBy) return false;
  
  // Props are equal, skip re-render
  return true;
};

export default React.memo(GraphView, arePropsEqual);

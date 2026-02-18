/**
 * Custom SVG Icon - Magnifying Glass with Butterfly
 * Represents Search with L3V3L AI Compatibility Scoring
 */
import React from 'react';

const SearchButterflyIcon = ({ size = 24, className = '' }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 200 200" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Magnifying glass */}
      <circle 
        cx="90" 
        cy="90" 
        r="60" 
        stroke="white" 
        strokeWidth="5" 
        fill="none"
      />
      <rect 
        x="140" 
        y="140" 
        width="15" 
        height="50" 
        transform="rotate(45 140 140)" 
        fill="white"
      />

      {/* Butterfly body */}
      <rect 
        x="85" 
        y="80" 
        width="10" 
        height="30" 
        fill="#7c3aed" 
        rx="2"
      />

      {/* Butterfly wings - L3V3L purple gradient */}
      <ellipse cx="75" cy="85" rx="15" ry="20" fill="#9333ea"/>
      <ellipse cx="75" cy="105" rx="15" ry="20" fill="#a855f7"/>
      <ellipse cx="105" cy="85" rx="15" ry="20" fill="#9333ea"/>
      <ellipse cx="105" cy="105" rx="15" ry="20" fill="#a855f7"/>

      {/* Antennae */}
      <line x1="88" y1="80" x2="80" y2="70" stroke="#7c3aed" strokeWidth="2"/>
      <line x1="92" y1="80" x2="100" y2="70" stroke="#7c3aed" strokeWidth="2"/>
    </svg>
  );
};

export default SearchButterflyIcon;

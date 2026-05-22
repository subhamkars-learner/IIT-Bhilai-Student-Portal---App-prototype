import React from 'react';

interface IITBhilaiLogoProps {
  className?: string;
  size?: number;
  variant?: 'colored' | 'monochrome' | 'white';
}

export default function IITBhilaiLogo({ className = '', size = 40, variant = 'colored' }: IITBhilaiLogoProps) {
  // Brand Colors
  const darkPurple = variant === 'colored' ? '#452c73' : (variant === 'white' ? '#ffffff' : 'currentColor');
  const lightPurple = variant === 'colored' ? '#927bba' : (variant === 'white' ? 'rgba(255, 255, 255, 0.45)' : 'currentColor');
  const strokeColor = '#ffffff';

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 200 200" 
      className={className}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      id="iit-bhilai-logo-svg"
    >
      <defs>
        {/* Flare/Arrow triangle at the vertices */}
        <polygon id="flare" points="100,35 83,12 117,12" fill={darkPurple} />
        
        {/* Globe clip path to ensure all inner elements stay perfectly circular */}
        <clipPath id="globe-clip">
          <circle cx="100" cy="100" r="50" />
        </clipPath>
      </defs>

      {/* 1. The Outer Hexagon Frame */}
      <polygon 
        points="100,35 156.29,67.5 156.29,132.5 100,165 43.71,132.5 43.71,67.5"
        fill="none" 
        stroke={darkPurple} 
        strokeWidth="6" 
        strokeLinejoin="miter" 
      />

      {/* 2. The Outward Flares on all 6 vertices */}
      <use href="#flare" />
      <use href="#flare" transform="rotate(60 100 100)" />
      <use href="#flare" transform="rotate(120 100 100)" />
      <use href="#flare" transform="rotate(180 100 100)" />
      <use href="#flare" transform="rotate(240 100 100)" />
      <use href="#flare" transform="rotate(300 100 100)" />

      {/* 3. The Inner Globe */}
      <g clipPath="url(#globe-clip)">
        
        {/* Base dark purple background of the globe */}
        <circle cx="100" cy="100" r="50" fill={darkPurple} />

        {/* Center light purple region (creates the vertical curves) */}
        <ellipse 
          cx="100" 
          cy="100" 
          rx="25" 
          ry="50" 
          fill={lightPurple} 
          stroke={strokeColor} 
          strokeWidth="4.5" 
        />

        {/* White Grid Lines */}
        
        {/* Center straight vertical line */}
        <line x1="100" y1="45" x2="100" y2="155" stroke={strokeColor} strokeWidth="4.5" />

        {/* Top horizontal line */}
        <line x1="40" y1="77" x2="160" y2="77" stroke={strokeColor} strokeWidth="4.5" />

        {/* Equator (Middle horizontal line) */}
        <line x1="40" y1="100" x2="160" y2="100" stroke={strokeColor} strokeWidth="4.5" />

        {/* Bottom horizontal line */}
        <line x1="40" y1="123" x2="160" y2="123" stroke={strokeColor} strokeWidth="4.5" />
      </g>
    </svg>
  );
}


import React from 'react';

interface VesperLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

export const VesperLogo: React.FC<VesperLogoProps> = ({
  size = 'md',
  showText = true,
  subtitle = 'Personal Sanctuary',
  className = '',
}) => {
  const dimensions = {
    sm: { icon: 28, text: '1.05rem', sub: '0.62rem', gap: '8px' },
    md: { icon: 36, text: '1.25rem', sub: '0.68rem', gap: '10px' },
    lg: { icon: 48, text: '1.65rem', sub: '0.78rem', gap: '14px' },
  }[size];

  return (
    <div
      className={`vesper-brand ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dimensions.gap,
        userSelect: 'none',
        textDecoration: 'none',
      }}
    >
      {/* Luxury Monolithic Emblem */}
      <div
        style={{
          position: 'relative',
          width: dimensions.icon,
          height: dimensions.icon,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          viewBox="0 0 48 48"
          width={dimensions.icon}
          height={dimensions.icon}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.45))',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <defs>
            {/* Platinum Luxury Left Facet */}
            <linearGradient id="vesperLeftFacet" x1="6" y1="8" x2="24" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>

            {/* Brushed Titanium Right Facet */}
            <linearGradient id="vesperRightFacet" x1="42" y1="8" x2="24" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="60%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>

            {/* Subtle Gold Evening Star (Vesper) Accent */}
            <linearGradient id="vesperStar" x1="20" y1="6" x2="28" y2="14" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>

            {/* Soft Ambient Shadow */}
            <radialGradient id="vesperGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Soft backplate glow */}
          <circle cx="24" cy="24" r="22" fill="url(#vesperGlow)" />

          {/* Precision Monolithic V Left Pillar */}
          <path
            d="M 10 9 L 19 9 L 24 33 L 17 38 Z"
            fill="url(#vesperLeftFacet)"
          />

          {/* Precision Monolithic V Right Pillar */}
          <path
            d="M 38 9 L 29 9 L 24 33 L 31 38 Z"
            fill="url(#vesperRightFacet)"
          />

          {/* Interlocking Beveled Apex */}
          <path
            d="M 17 38 L 24 33 L 31 38 L 24 43 Z"
            fill="#f8fafc"
            opacity="0.95"
          />

          {/* The Evening Star (Vesper Diamond Crown) */}
          <path
            d="M 24 6 L 26.5 10.5 L 31 13 L 26.5 15.5 L 24 20 L 21.5 15.5 L 17 13 L 21.5 10.5 Z"
            fill="url(#vesperStar)"
            style={{ filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.6))' }}
          />
        </svg>
      </div>

      {/* Brand Typography - Big Company Editorial Hierarchy */}
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: dimensions.text,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#ffffff',
              }}
            >
              VESPER
            </span>
            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              PRO
            </span>
          </div>

          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: dimensions.sub,
              color: '#64748b',
              fontWeight: 500,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginTop: '1px',
            }}
          >
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
};

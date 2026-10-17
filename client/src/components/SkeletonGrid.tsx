import React from 'react';

export const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--space-5)',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
          }}
        >
          {/* Shimmer Thumbnail */}
          <div
            className="skeleton-shimmer"
            style={{
              width: '100%',
              aspectRatio: '16/9',
              background: 'var(--bg-surface-elevated)',
            }}
          />

          {/* Details Skeleton */}
          <div style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
            <div
              className="skeleton-shimmer"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--bg-surface-elevated)',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                className="skeleton-shimmer"
                style={{
                  height: '14px',
                  width: '85%',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--bg-surface-elevated)',
                }}
              />
              <div
                className="skeleton-shimmer"
                style={{
                  height: '12px',
                  width: '55%',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--bg-surface-elevated)',
                }}
              />
            </div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes shimmerPulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.25; }
          100% { opacity: 0.6; }
        }
        .skeleton-shimmer {
          animation: shimmerPulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

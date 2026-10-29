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
        @keyframes liquidShimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.04) 0%,
            rgba(255, 255, 255, 0.12) 50%,
            rgba(255, 255, 255, 0.04) 100%
          ) !important;
          background-size: 200% 100% !important;
          animation: liquidShimmer 1.8s cubic-bezier(0.25, 1, 0.5, 1) infinite !important;
        }
      `}</style>
    </div>
  );
};

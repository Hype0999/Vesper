import React from 'react';

interface TopLoadingBarProps {
  isLoading: boolean;
}

export const TopLoadingBar: React.FC<TopLoadingBarProps> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 9999,
        background: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          background: 'linear-gradient(90deg, #6366f1 0%, #38bdf8 50%, #10b981 100%)',
          boxShadow: '0 0 12px rgba(56, 189, 248, 0.7), 0 0 6px #10b981',
          animation: 'ytLoading 1.2s infinite cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      />
      <style>{`
        @keyframes ytLoading {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 70%;
            margin-left: 20%;
          }
          100% {
            width: 100%;
            margin-left: 100%;
          }
        }
      `}</style>
    </div>
  );
};

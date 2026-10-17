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
          background: 'linear-gradient(90deg, #ff0000 0%, #ff4b4b 50%, #ffffff 100%)',
          boxShadow: '0 0 10px rgba(255, 0, 0, 0.7), 0 0 5px #ff4b4b',
          animation: 'ytLoading 1.2s infinite ease-in-out',
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

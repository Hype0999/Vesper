import React from 'react';
import { Film, Music, Image as ImageIcon, FileText, Lock, Unlock, Tv } from 'lucide-react';

export type ActiveTab = 'videos' | 'songs' | 'photos' | 'notes' | 'vault';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  videoCount: number;
  songCount: number;
  photoCount: number;
  noteCount: number;
  vaultCount: number;
  isVaultUnlocked: boolean;
  canAccessVault?: boolean;
  onOpenVaultModal?: () => void;
  onOpenTvRemote?: () => void;
  isHdmiConnected?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  videoCount,
  songCount,
  photoCount,
  noteCount,
  vaultCount,
  isVaultUnlocked,
  canAccessVault = true,
  onOpenVaultModal,
  onOpenTvRemote,
  isHdmiConnected = false,
}) => {
  const tabs = [
    { id: 'videos' as ActiveTab, label: 'Movies', icon: Film, count: videoCount },
    { id: 'photos' as ActiveTab, label: 'Memories', icon: ImageIcon, count: photoCount },
    { id: 'songs' as ActiveTab, label: 'Songs', icon: Music, count: songCount },
    { id: 'notes' as ActiveTab, label: 'Notes', icon: FileText, count: noteCount },
    ...(canAccessVault
      ? [
          {
            id: 'vault' as ActiveTab,
            label: 'Vault',
            icon: isVaultUnlocked ? Unlock : Lock,
            count: isVaultUnlocked ? vaultCount : undefined,
            isVault: true,
          },
        ]
      : []),
  ];

  return (
    <nav
      className="mobile-bottom-nav hide-on-desktop"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 65,
        background: 'rgba(10, 12, 16, 0.88)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        paddingTop: '6px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
        boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.5)',
      }}
      aria-label="Mobile Navigation"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          maxWidth: '480px',
          margin: '0 auto',
          padding: '0 8px',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.isVault && !isVaultUnlocked && onOpenVaultModal) {
                  onTabChange('vault');
                } else {
                  onTabChange(tab.id);
                }
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                padding: '6px 10px',
                borderRadius: '12px',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                minWidth: '56px',
                color: isActive
                  ? tab.isVault
                    ? '#f59e0b'
                    : '#ffffff'
                  : 'var(--text-muted)',
              }}
            >
              {/* Active Ambient Pill Indicator */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: '2px',
                    width: '32px',
                    height: '3px',
                    borderRadius: '999px',
                    background: tab.isVault
                      ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                      : 'linear-gradient(90deg, #6366f1, #a855f7)',
                    boxShadow: tab.isVault
                      ? '0 0 10px rgba(245, 158, 11, 0.8)'
                      : '0 0 10px rgba(168, 85, 247, 0.8)',
                  }}
                />
              )}

              {/* Icon Container with Badge */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.3 : 1.8}
                  style={{
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                />
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-10px',
                      background: tab.isVault ? '#f59e0b' : 'rgba(255, 255, 255, 0.18)',
                      color: tab.isVault ? '#000000' : '#ffffff',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      borderRadius: '999px',
                      padding: '1px 4px',
                      minWidth: '15px',
                      textAlign: 'center',
                      lineHeight: '12px',
                      border: '1px solid rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    {tab.count > 99 ? '99+' : tab.count}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: isActive ? 600 : 500,
                  marginTop: '3px',
                  letterSpacing: '-0.01em',
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* Companion TV Remote Button */}
        {onOpenTvRemote && (
          <button
            onClick={onOpenTvRemote}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              padding: '6px 10px',
              borderRadius: '12px',
              color: isHdmiConnected ? '#34d399' : 'var(--text-muted)',
              cursor: 'pointer',
              position: 'relative',
            }}
            title="Open Vesper TV Remote"
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tv size={18} />
              {isHdmiConnected && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-1px',
                    right: '-4px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                  }}
                />
              )}
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                marginTop: '3px',
                letterSpacing: '-0.01em',
              }}
            >
              Remote
            </span>
          </button>
        )}
      </div>
    </nav>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import type { TvSessionStatus, TvRemoteAction } from '@media-hub/shared';
import {
  X,
  Tv,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Square,
  ArrowLeft,
  VolumeX,
} from 'lucide-react';

interface TvRemoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export const TvRemoteModal: React.FC<TvRemoteModalProps> = ({
  isOpen,
  onClose,
  isAdmin = false,
}) => {
  const [tvStatus, setTvStatus] = useState<TvSessionStatus | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Poll status when modal is open
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/tv/status');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setTvStatus(json.data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchStatus();
      const interval = setInterval(fetchStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchStatus]);

  // Connect to SSE for instant playback mirror
  useEffect(() => {
    if (!isOpen) return;

    const es = new EventSource('/api/tv/events');
    es.addEventListener('playback_state', (e) => {
      try {
        const playback = JSON.parse(e.data);
        setTvStatus((prev) => (prev ? { ...prev, playback } : null));
      } catch {
        // ignore
      }
    });

    es.addEventListener('hdmi_status', (e) => {
      try {
        const data = JSON.parse(e.data);
        setTvStatus(data);
      } catch {
        // ignore
      }
    });

    return () => es.close();
  }, [isOpen]);

  const sendAction = async (action: TvRemoteAction, payload?: any) => {
    try {
      if (navigator.vibrate) navigator.vibrate(15);
      setLastAction(action);
      setTimeout(() => setLastAction(null), 1200);

      await fetch('/api/tv/remote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ action, payload }),
      });
    } catch {
      // ignore
    }
  };

  const toggleSimulation = async (connected: boolean) => {
    try {
      const res = await fetch('/api/tv/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ connected }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) setTvStatus(json.data);
      }
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const isConnected = tvStatus?.hdmi?.connected ?? false;
  const currentMedia = tvStatus?.playback?.currentMedia;
  const isPlaying = tvStatus?.playback?.playbackState === 'playing';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.85)',
        backdropFilter: 'blur(20px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#0d1117',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '28px',
          padding: '24px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          color: '#f8fafc',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              }}
            >
              <Tv size={18} color={isConnected ? '#34d399' : '#94a3b8'} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>Vesper TV Remote</span>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: isConnected ? '#10b981' : '#64748b',
                  }}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                {isConnected ? `${tvStatus?.hdmi?.tvModel || 'TV Display'} • ${tvStatus?.hdmi?.resolution || '1080p'}` : 'HDMI Display Disconnected'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Now Playing on TV Card */}
        {currentMedia && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img
                src={`/api/media/${currentMedia.id}/thumbnail`}
                alt={currentMedia.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                {isPlaying ? 'Playing on TV' : 'Paused on TV'}
              </span>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentMedia.title}
              </p>
            </div>
            <button
              onClick={() => sendAction('play_pause')}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {isPlaying ? <Pause size={16} color="#000" /> : <Play size={16} color="#000" style={{ marginLeft: '2px' }} />}
            </button>
          </div>
        )}

        {/* Frosted Glass Tactile D-Pad Controller */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
          <div
            style={{
              width: '230px',
              height: '230px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.5)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Up Button */}
            <button
              onClick={() => sendAction('up')}
              style={{
                position: 'absolute',
                top: '10px',
                width: '64px',
                height: '48px',
                background: 'none',
                border: 'none',
                color: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Up"
            >
              <ChevronUp size={28} />
            </button>

            {/* Down Button */}
            <button
              onClick={() => sendAction('down')}
              style={{
                position: 'absolute',
                bottom: '10px',
                width: '64px',
                height: '48px',
                background: 'none',
                border: 'none',
                color: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Down"
            >
              <ChevronDown size={28} />
            </button>

            {/* Left Button */}
            <button
              onClick={() => sendAction('left')}
              style={{
                position: 'absolute',
                left: '10px',
                width: '48px',
                height: '64px',
                background: 'none',
                border: 'none',
                color: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Left"
            >
              <ChevronLeft size={28} />
            </button>

            {/* Right Button */}
            <button
              onClick={() => sendAction('right')}
              style={{
                position: 'absolute',
                right: '10px',
                width: '48px',
                height: '64px',
                background: 'none',
                border: 'none',
                color: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Right"
            >
              <ChevronRight size={28} />
            </button>

            {/* Center OK / Select Button */}
            <button
              onClick={() => sendAction('select')}
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '0.05em',
              }}
            >
              OK
            </button>
          </div>
        </div>

        {/* Media Transport Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <button
            onClick={() => sendAction('seek_backward')}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Rewind 10s"
          >
            <RotateCcw size={18} />
          </button>

          <button
            onClick={() => sendAction('play_pause')}
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: '#38bdf8',
              border: 'none',
              color: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.5)',
            }}
            title="Play / Pause"
          >
            {isPlaying ? <Pause size={22} fill="#000" /> : <Play size={22} fill="#000" style={{ marginLeft: '2px' }} />}
          </button>

          <button
            onClick={() => sendAction('seek_forward')}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Forward 10s"
          >
            <RotateCw size={18} />
          </button>
        </div>

        {/* Secondary Actions (Back, Stop, Volume) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => sendAction('back')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <button
            onClick={() => sendAction('stop')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Square size={14} fill="#f8fafc" />
            <span>Stop TV</span>
          </button>

          <button
            onClick={() => sendAction('mute')}
            style={{
              padding: '10px 14px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Mute / Unmute"
          >
            <VolumeX size={16} />
          </button>
        </div>

        {/* Feedback notification */}
        {lastAction && (
          <div
            style={{
              textAlign: 'center',
              fontSize: '0.78rem',
              color: '#34d399',
              fontWeight: 600,
            }}
          >
            Action dispatched: <strong>{lastAction.toUpperCase()}</strong>
          </div>
        )}

        {/* Admin Diagnostic Simulation Switch */}
        {isAdmin && (
          <div
            style={{
              marginTop: '4px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Simulate HDMI Connection</span>
            <button
              onClick={() => toggleSimulation(!isConnected)}
              style={{
                fontSize: '0.72rem',
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: isConnected ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: isConnected ? '#f87171' : '#34d399',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {isConnected ? 'Disconnect TV' : 'Connect TV'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

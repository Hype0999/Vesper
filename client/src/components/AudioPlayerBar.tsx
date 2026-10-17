import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Maximize2,
  Minimize2,
  X,
  Music,
  Lock,
} from 'lucide-react';
import type { MediaItem } from '@media-hub/shared';

interface AudioPlayerBarProps {
  currentTrack: MediaItem | null;
  playlist: MediaItem[];
  onTrackChange: (track: MediaItem | null) => void;
  onClosePlayer: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  currentTrack,
  playlist,
  onTrackChange,
  onClosePlayer,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isLoop, setIsLoop] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Play / Pause toggle
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      void audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Skip to Next Track
  const handleNext = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return;
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * playlist.length);
      onTrackChange(playlist[randomIndex] || null);
      return;
    }
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % playlist.length;
    onTrackChange(playlist[nextIndex] || null);
  }, [currentTrack, playlist, isShuffle, onTrackChange]);

  // Skip to Previous Track
  const handlePrev = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return;
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    onTrackChange(playlist[prevIndex] || null);
  }, [currentTrack, playlist, onTrackChange]);

  // Seek handler
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pos * duration;
  };

  // Speed cycle
  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx] ?? 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  // Lock Screen MediaSession integration (crucial for phones on train)
  useEffect(() => {
    if (!currentTrack) return;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.categoryName || 'Vesper Audio Sanctuary',
        album: 'High-Res Audio Sanctuary',
        artwork: [
          {
            src: `/api/media/${currentTrack.id}/thumbnail`,
            sizes: '512x512',
            type: 'image/webp',
          },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        void audioRef.current?.play();
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause();
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (audioRef.current && details.seekTime !== undefined) {
          audioRef.current.currentTime = details.seekTime;
        }
      });
    }
  }, [currentTrack, handleNext, handlePrev]);

  // Reset audio on track change
  useEffect(() => {
    if (currentTrack && audioRef.current) {
      audioRef.current.src = `/api/media/${currentTrack.id}/stream`;
      audioRef.current.playbackRate = playbackSpeed;
      void audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [currentTrack]);

  if (!currentTrack) return null;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => {
          if (isLoop) {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              void audioRef.current.play();
            }
          } else {
            handleNext();
          }
        }}
      />

      {/* Expanded Modal View */}
      {isExpanded && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'linear-gradient(180deg, #181126 0%, #08090d 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-6)',
          }}
        >
          <button
            onClick={() => setIsExpanded(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              borderRadius: '50%',
              padding: '10px',
              cursor: 'pointer',
            }}
          >
            <Minimize2 size={20} />
          </button>

          {/* Vinyl Spinning Disc Graphic */}
          <div
            style={{
              width: '260px',
              height: '260px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1f242e 0%, #0a0c10 100%)',
              border: '8px solid rgba(255,255,255,0.06)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 40px rgba(139, 92, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'var(--space-6)',
              animation: isPlaying ? 'spin 18s linear infinite' : 'none',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <img
              src={`/api/media/${currentTrack.id}/thumbnail`}
              alt={currentTrack.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '50%',
              }}
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#0a0c10',
                border: '3px solid #8b5cf6',
              }}
            />
          </div>

          {/* Title and metadata */}
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: '6px', textAlign: 'center' }}>
            {currentTrack.title}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#a78bfa', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Music size={14} /> High-Definition Lossless Audio Stream
            {currentTrack.isPrivate && <Lock size={12} color="#f59e0b" />}
          </p>

          {/* Scrubber */}
          <div style={{ width: '100%', maxWidth: '420px', marginBottom: 'var(--space-4)' }}>
            <div
              onClick={handleSeek}
              style={{
                position: 'relative',
                height: '6px',
                width: '100%',
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #10b981, #1ed760)',
                  borderRadius: '3px',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af', marginTop: '6px' }}>
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Big Playback Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <button
              onClick={() => setIsShuffle(!isShuffle)}
              style={{ background: 'none', border: 'none', color: isShuffle ? '#a78bfa' : '#6b7280', cursor: 'pointer' }}
            >
              <Shuffle size={20} />
            </button>
            <button onClick={handlePrev} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <SkipBack size={26} />
            </button>
            <button
              onClick={togglePlay}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--spotify-green)',
                border: 'none',
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--spotify-glow)',
              }}
            >
              {isPlaying ? <Pause size={26} fill="#000000" color="#000000" /> : <Play size={26} fill="#000000" color="#000000" style={{ marginLeft: '3px' }} />}
            </button>
            <button onClick={handleNext} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <SkipForward size={26} />
            </button>
            <button
              onClick={() => setIsLoop(!isLoop)}
              style={{ background: 'none', border: 'none', color: isLoop ? 'var(--spotify-green)' : '#6b7280', cursor: 'pointer' }}
            >
              <Repeat size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Docked Floating Bottom Player Bar (Authentic Spotify style) */}
      <div
        className="docked-audio-bar"
        style={{
          background: '#181818',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '0.45rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.85)',
        }}
      >
        {/* Scrubber line at the very top of the bar */}
        <div
          onClick={handleSeek}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'rgba(255, 255, 255, 0.15)',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${duration ? (currentTime / duration) * 100 : 0}%`,
              background: 'var(--spotify-green)',
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '4px' }}>
          {/* Left: Track Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px', maxWidth: '30%' }}>
            <div
              onClick={() => setIsExpanded(true)}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '6px',
                overflow: 'hidden',
                background: '#1a1d26',
                flexShrink: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={`/api/media/${currentTrack.id}/thumbnail`}
                alt={currentTrack.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div
                onClick={() => setIsExpanded(true)}
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                {currentTrack.title}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--spotify-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {currentTrack.isPrivate ? 'Vault Track' : (currentTrack.categoryName || 'Music')}
                <span style={{ color: '#4b5563' }}>•</span>
                <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Center: Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setIsShuffle(!isShuffle)}
              style={{
                background: 'none',
                border: 'none',
                color: isShuffle ? '#a78bfa' : '#6b7280',
                cursor: 'pointer',
                padding: '4px',
              }}
              title="Shuffle"
            >
              <Shuffle size={16} />
            </button>
            <button
              onClick={handlePrev}
              style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: '4px' }}
              title="Previous"
            >
              <SkipBack size={18} />
            </button>
            <button
              onClick={togglePlay}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'var(--spotify-green)',
                border: 'none',
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={18} fill="#000000" color="#000000" /> : <Play size={18} fill="#000000" color="#000000" style={{ marginLeft: '2px' }} />}
            </button>
            <button
              onClick={handleNext}
              style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: '4px' }}
              title="Next"
            >
              <SkipForward size={18} />
            </button>
            <button
              onClick={() => setIsLoop(!isLoop)}
              style={{
                background: 'none',
                border: 'none',
                color: isLoop ? 'var(--spotify-green)' : '#6b7280',
                cursor: 'pointer',
                padding: '4px',
              }}
              title="Loop"
            >
              <Repeat size={16} />
            </button>
          </div>

          {/* Right: Volume & Expand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={cycleSpeed}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: '4px',
                color: '#d1d5db',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '3px 6px',
                cursor: 'pointer',
              }}
              title="Speed"
            >
              {playbackSpeed}x
            </button>
            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.muted = !audioRef.current.muted;
                  setIsMuted(audioRef.current.muted);
                }
              }}
              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                if (audioRef.current) {
                  audioRef.current.volume = val;
                  audioRef.current.muted = val === 0;
                  setIsMuted(val === 0);
                }
              }}
              style={{ width: '60px', height: '3px', accentColor: 'var(--spotify-green)', cursor: 'pointer' }}
            />
            <button
              onClick={() => setIsExpanded(true)}
              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
              title="Expand player"
            >
              <Maximize2 size={16} />
            </button>
            <button
              onClick={onClosePlayer}
              style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px' }}
              title="Close player"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

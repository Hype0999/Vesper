import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  X,
  Lock,
  Trash2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Share2,
  Download,
  Heart,
  Tv,
  Sliders,
} from 'lucide-react';
import type { MediaItem } from '@media-hub/shared';

interface VideoPlayerModalProps {
  media: MediaItem | null;
  allVideos?: MediaItem[];
  onClose: () => void;
  onDelete?: (id: string) => void;
  onSelectRelatedVideo?: (video: MediaItem) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  media,
  allVideos = [],
  onClose,
  onDelete,
  onSelectRelatedVideo,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [playRipple, setPlayRipple] = useState<'play' | 'pause' | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [doubleTapRipple, setDoubleTapRipple] = useState<{ side: 'left' | 'right'; text: string } | null>(null);
  const [hoverScrubTime, setHoverScrubTime] = useState<number | null>(null);
  const [hoverScrubX, setHoverScrubX] = useState<number>(0);
  const [streamQuality, setStreamQuality] = useState<'auto' | '4k' | '1080p' | '720p'>('auto');
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  useEffect(() => {
    if (media) {
      setIsFavorited(media.isFavorite);
    }
  }, [media]);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const saveProgress = useCallback(() => {
    if (!videoRef.current || !media) return;
    const cur = Math.floor(videoRef.current.currentTime);
    const dur = Math.floor(videoRef.current.duration);

    if (cur > 0 && dur > 0) {
      fetch(`/api/media/${media.id}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ positionSeconds: cur, durationSeconds: dur }),
        keepalive: true,
      }).catch(() => {});
    }
  }, [media]);

  // Keyboard hotkeys (YouTube standard)
  useEffect(() => {
    if (!media) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;

      if (e.key === 'Escape') {
        if (isFullscreen) {
          void document.exitFullscreen();
        } else {
          saveProgress();
          onClose();
        }
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft' || e.key === 'j') {
        e.preventDefault();
        skipTime(-10);
      } else if (e.key === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        skipTime(10);
      } else if (e.key === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f') {
        e.preventDefault();
        void toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [media, isFullscreen, isPlaying, onClose, saveProgress]);

  // Reset controls timer
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 2500);
    }
  };

  // Video playback handlers
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      void videoRef.current.play();
      setIsPlaying(true);
      setPlayRipple('play');
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setPlayRipple('pause');
    }
    setTimeout(() => setPlayRipple(null), 500);
  };

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const now = Date.now();
    const timeDiff = now - lastTapRef.current.time;

    if (timeDiff < 300) {
      if (clickX < 0.35) {
        skipTime(-10);
        setDoubleTapRipple({ side: 'left', text: '-10s' });
        setTimeout(() => setDoubleTapRipple(null), 600);
      } else if (clickX > 0.65) {
        skipTime(10);
        setDoubleTapRipple({ side: 'right', text: '+10s' });
        setTimeout(() => setDoubleTapRipple(null), 600);
      } else {
        togglePlay();
      }
      lastTapRef.current = { time: 0, x: clickX };
    } else {
      lastTapRef.current = { time: now, x: clickX };
      setTimeout(() => {
        if (Date.now() - lastTapRef.current.time >= 290 && lastTapRef.current.time !== 0) {
          togglePlay();
        }
      }, 300);
    }
  };

  const skipTime = (deltaSeconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + deltaSeconds));
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    setShowSpeedMenu(false);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * duration;
  };

  const handleShare = async () => {
    const url = window.location.origin;
    await navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!media) return null;

  const streamUrl = `/api/media/${media.id}/stream`;
  const relatedVideos = allVideos.filter((v) => v.id !== media.id && v.type === 'video');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 3, 4, 0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto',
        padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          saveProgress();
          onClose();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: isTheaterMode ? '100%' : '1120px',
          display: 'flex',
          flexDirection: 'column',
          margin: '0 auto',
          transition: 'max-width 0.3s ease',
        }}
      >
        {/* Top Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>Nest Theater</span>
            <span style={{ fontSize: '0.68rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ff4b4b', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              4K ULTRA HD • DIRECT STREAM
            </span>
            {media.isPrivate && (
              <span className="badge badge-warning" style={{ background: 'var(--vault-subtle)', color: 'var(--vault-primary)' }}>
                <Lock size={12} /> Vault Protected
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsTheaterMode(!isTheaterMode)}
              style={{
                background: isTheaterMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: isTheaterMode ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {isTheaterMode ? 'Standard View' : 'Theater Mode'}
            </button>
            <button
              onClick={() => { saveProgress(); onClose(); }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* YouTube Custom Video Player Frame */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            background: '#000000',
            borderRadius: isFullscreen ? 0 : 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: isTheaterMode ? '0 0 60px rgba(255, 0, 0, 0.2), 0 12px 40px rgba(0, 0, 0, 0.95)' : '0 8px 32px rgba(0, 0, 0, 0.9)',
            border: isFullscreen ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <video
            ref={videoRef}
            src={streamUrl}
            autoPlay
            playsInline
            onClick={handleVideoClick}
            onTimeUpdate={() => {
              if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setDuration(videoRef.current.duration);
                if (media.playbackPosition && media.playbackPosition > 5) {
                  videoRef.current.currentTime = media.playbackPosition;
                }
              }
            }}
            onPlay={() => {
              setIsPlaying(true);
              if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = window.setInterval(saveProgress, 5000);
            }}
            onPause={() => {
              setIsPlaying(false);
              if (progressIntervalRef.current) {
                window.clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
              saveProgress();
            }}
            style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
          />

          {/* Double Tap Seek Animation (YouTube Style Left or Right) */}
          {doubleTapRipple && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                [doubleTapRipple.side]: '15%',
                transform: 'translateY(-50%)',
                background: 'rgba(0, 0, 0, 0.8)',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '1.05rem',
                fontWeight: 700,
                pointerEvents: 'none',
                backdropFilter: 'blur(8px)',
                zIndex: 10,
              }}
            >
              {doubleTapRipple.side === 'left' ? <RotateCcw size={20} /> : <RotateCw size={20} />}
              <span>{doubleTapRipple.text}</span>
            </div>
          )}

          {/* Center Click Ripple Animation */}
          {playRipple && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                pointerEvents: 'none',
                backdropFilter: 'blur(6px)',
                animation: 'rippleFade 0.5s ease-out forwards',
              }}
            >
              {playRipple === 'play' ? <Play size={32} fill="#fff" /> : <Pause size={32} fill="#fff" />}
            </div>
          )}

          {/* Custom YouTube Scrubber & Control Bar Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 70%, transparent 100%)',
              padding: 'var(--space-3) var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              opacity: showControls ? 1 : 0,
              transition: 'opacity 0.25s ease',
              pointerEvents: showControls ? 'auto' : 'none',
            }}
          >
            {/* Scrubber / Progress Bar with Hover Preview Tooltip */}
            <div
              onClick={handleSeek}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setHoverScrubTime(pos * duration);
                setHoverScrubX(e.clientX - rect.left);
              }}
              onMouseLeave={() => setHoverScrubTime(null)}
              style={{
                position: 'relative',
                height: '6px',
                width: '100%',
                background: 'rgba(255, 255, 255, 0.25)',
                cursor: 'pointer',
                borderRadius: '3px',
                transition: 'height 0.15s ease',
              }}
            >
              {/* Floating Timestamp Tooltip */}
              {hoverScrubTime !== null && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: `${hoverScrubX}px`,
                    transform: 'translateX(-50%)',
                    background: 'rgba(10, 14, 23, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                    whiteSpace: 'nowrap',
                    zIndex: 25,
                  }}
                >
                  {formatTime(hoverScrubTime)}
                </div>
              )}

              <div
                style={{
                  height: '100%',
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #10b981 0%, #38bdf8 100%)',
                  boxShadow: '0 0 10px rgba(56, 189, 248, 0.6)',
                  borderRadius: '3px',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    right: '-6px',
                    top: '-3px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    boxShadow: '0 0 8px rgba(0,0,0,0.8)',
                  }}
                />
              </div>
            </div>

            {/* Bottom Controls Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                {/* Play / Pause */}
                <button
                  onClick={togglePlay}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
                  title={isPlaying ? 'Pause (space)' : 'Play (space)'}
                >
                  {isPlaying ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" />}
                </button>

                {/* Rewind 10s */}
                <button
                  onClick={() => skipTime(-10)}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
                  title="Rewind 10 seconds (J / ←)"
                >
                  <RotateCcw size={17} />
                </button>

                {/* Forward 10s */}
                <button
                  onClick={() => skipTime(10)}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
                  title="Forward 10 seconds (L / →)"
                >
                  <RotateCw size={17} />
                </button>

                {/* Volume & Mute */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={toggleMute}
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
                    title={isMuted ? 'Unmute (m)' : 'Mute (m)'}
                  >
                    {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    style={{
                      width: '64px',
                      height: '3px',
                      accentColor: '#ff0000',
                      cursor: 'pointer',
                    }}
                  />
                </div>

                {/* Time Display */}
                <span style={{ fontSize: '0.8rem', color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Right Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', position: 'relative' }}>
                {/* Playback Speed Menu Button */}
                <button
                  onClick={() => {
                    setShowSpeedMenu(!showSpeedMenu);
                    setShowQualityMenu(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    padding: '4px 6px',
                  }}
                  title="Playback speed"
                >
                  {playbackSpeed}x
                </button>

                {/* Speed Popup */}
                {showSpeedMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '36px',
                      right: '80px',
                      background: 'rgba(20, 22, 26, 0.95)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      zIndex: 20,
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => handleSpeedChange(spd)}
                        style={{
                          background: playbackSpeed === spd ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                          color: playbackSpeed === spd ? '#38bdf8' : '#ffffff',
                          border: 'none',
                          padding: '4px 12px',
                          fontSize: '0.75rem',
                          borderRadius: 'var(--radius-xs)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {spd === 1 ? 'Normal (1x)' : `${spd}x`}
                      </button>
                    ))}
                  </div>
                )}

                {/* Stream Quality Selector */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQualityMenu(!showQualityMenu);
                      setShowSpeedMenu(false);
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Stream Quality"
                  >
                    <Sliders size={12} />
                    <span>
                      {streamQuality === 'auto' ? 'Auto Direct' : streamQuality === '4k' ? '4K Direct' : streamQuality.toUpperCase()}
                    </span>
                  </button>

                  {showQualityMenu && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '36px',
                        right: 0,
                        background: 'rgba(15, 17, 23, 0.96)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        minWidth: '220px',
                        zIndex: 30,
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
                      }}
                    >
                      <div style={{ padding: '4px 8px', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        STREAMING QUALITY (0% CPU)
                      </div>
                      {[
                        { id: 'auto', label: 'Auto (Source Direct)', desc: '1:1 hardware passthrough' },
                        { id: '4k', label: '4K Ultra-HD Direct', desc: 'Zero transcode 2160p' },
                        { id: '1080p', label: '1080p Full HD Passthrough', desc: 'Crisp high-speed seek' },
                        { id: '720p', label: '720p Mobile Stream', desc: 'Bandwidth saver buffer' },
                      ].map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            setStreamQuality(q.id as any);
                            setShowQualityMenu(false);
                          }}
                          style={{
                            background: streamQuality === q.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                            color: streamQuality === q.id ? '#38bdf8' : '#ffffff',
                            border: 'none',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1px',
                          }}
                        >
                          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{q.label}</span>
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{q.desc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Picture in Picture */}
                <button
                  onClick={() => {
                    if (document.pictureInPictureElement) {
                      void document.exitPictureInPicture();
                    } else if (videoRef.current) {
                      void videoRef.current.requestPictureInPicture();
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
                  title="Picture in Picture"
                >
                  <Tv size={17} />
                </button>

                {/* Fullscreen */}
                <button
                  onClick={() => void toggleFullscreen()}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
                  title={isFullscreen ? 'Exit full screen (f)' : 'Full screen (f)'}
                >
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Information & Social Actions Bar (YouTube Style) */}
        <div style={{ padding: 'var(--space-4) 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Title */}
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {media.title}
          </h2>

          {/* User channel info + Action buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              paddingBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            {/* Channel avatar & info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                }}
              >
                V
              </div>
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Vesper Sanctuary Core
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  Local Storage • 0% CPU Hardware Direct Stream
                </p>
              </div>
            </div>

            {/* Actions: Favorite, Share, Download, Delete */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setIsFavorited(!isFavorited)}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  color: isFavorited ? '#ff3b3b' : 'var(--text-secondary)',
                }}
              >
                <Heart size={15} fill={isFavorited ? '#ff3b3b' : 'none'} />
                <span>{isFavorited ? 'Liked' : 'Like'}</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={handleShare}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
              >
                <Share2 size={15} />
                <span>{isCopied ? 'Link Copied!' : 'Share'}</span>
              </button>

              <a
                href={streamUrl}
                download={media.originalFilename}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', textDecoration: 'none' }}
              >
                <Download size={15} />
                <span>Download</span>
              </a>

              {onDelete && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to permanently delete this video?')) {
                      onDelete(media.id);
                      onClose();
                    }
                  }}
                  style={{ padding: '0.45rem 0.75rem', color: 'var(--accent-danger)', fontSize: '0.8rem' }}
                  title="Delete Video"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Expandable Description Box */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
              <span>{media.playCount} views</span>
              <span>•</span>
              <span>{new Date(media.createdAt).toLocaleDateString()}</span>
              {media.categoryName && (
                <span className="badge badge-subtle" style={{ fontSize: '0.72rem' }}>
                  {media.categoryName}
                </span>
              )}
            </div>

            {media.description ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
                {media.description}
              </p>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                No description provided for this video.
              </p>
            )}

            {media.tags && media.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
                {media.tags.map((tag) => (
                  <span key={tag} style={{ color: '#3b82f6', fontSize: '0.75rem', cursor: 'pointer' }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Related / More Videos Section */}
          {relatedVideos.length > 0 && onSelectRelatedVideo && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
                More from your Nest
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                {relatedVideos.slice(0, 4).map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => {
                      saveProgress();
                      onSelectRelatedVideo(rel);
                    }}
                    style={{
                      cursor: 'pointer',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ width: '100%', aspectRatio: '16/9', background: '#000' }}>
                      <img
                        src={`/api/media/${rel.id}/thumbnail`}
                        alt={rel.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                        {rel.title}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                        {rel.playCount} views
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

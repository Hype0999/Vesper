import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  X,
  Lock,
  Trash2,
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Share2,
  Download,
  ThumbsUp,
  ThumbsDown,
  Settings,
  Tv,
  Check,
  ChevronRight,
  ChevronLeft,
  FolderSync,
  CheckCircle2,
  Bookmark,
  Bell,
  MoreHorizontal,
  Repeat,
} from 'lucide-react';
import type { MediaItem } from '@media-hub/shared';

interface VideoPlayerModalProps {
  media: MediaItem | null;
  allVideos?: MediaItem[];
  onClose: () => void;
  onDelete?: (id: string) => void;
  onSelectRelatedVideo?: (video: MediaItem) => void;
  onReclassify?: (id: string, newSubType: 'movie' | 'family') => void;
  onCastToTv?: (media: MediaItem) => void;
}

type SettingsSubmenu = 'main' | 'speed' | 'quality';

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  media,
  allVideos = [],
  onClose,
  onDelete,
  onSelectRelatedVideo,
  onReclassify,
  onCastToTv,
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
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isHoveringVolume, setIsHoveringVolume] = useState<boolean>(false);
  const [isHoveringScrubber, setIsHoveringScrubber] = useState<boolean>(false);

  // Settings menu state
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [settingsSubmenu, setSettingsSubmenu] = useState<SettingsSubmenu>('main');
  const [streamQuality, setStreamQuality] = useState<'auto' | '4k' | '1080p' | '720p'>('auto');

  // Interactivity state
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isDisliked, setIsDisliked] = useState<boolean>(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(42);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showFullDesc, setShowFullDesc] = useState<boolean>(false);
  const [centerRipple, setCenterRipple] = useState<'play' | 'pause' | null>(null);
  const [seekRipple, setSeekRipple] = useState<{ side: 'left' | 'right'; text: string } | null>(null);
  const [hoverScrubTime, setHoverScrubTime] = useState<number | null>(null);
  const [hoverScrubX, setHoverScrubX] = useState<number>(0);

  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  useEffect(() => {
    if (media) {
      setIsLiked(media.isFavorite);
      setIsDisliked(false);
      setShowFullDesc(false);
      setShowSettingsMenu(false);
      setShowMoreMenu(false);
      setSettingsSubmenu('main');
      const baseLikes = media.playCount ? Math.max(14, media.playCount * 3 + 5) : 42;
      setLikeCount(media.isFavorite ? baseLikes + 1 : baseLikes);
    }
  }, [media]);

  const formatCompactNumber = (num: number): string => {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  // Format seconds to mm:ss or hh:mm:ss (YouTube format, guarded against non-finite values)
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
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

  // Keyboard hotkeys (Official YouTube Standards)
  useEffect(() => {
    if (!media) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;

      if (e.key === 'Escape') {
        if (isFullscreen) {
          void document.exitFullscreen();
        } else {
          saveProgress();
          onClose();
        }
      } else if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        skipTime(-10);
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        skipTime(10);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        skipTime(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        skipTime(5);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        adjustVolume(0.05);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        adjustVolume(-0.05);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        void toggleFullscreen();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setIsTheaterMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [media, isFullscreen, isPlaying, onClose, saveProgress]);

  // Auto-hide controls timer
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    if (isPlaying && !showSettingsMenu) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Video playback handlers
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      void videoRef.current.play();
      setIsPlaying(true);
      setCenterRipple('play');
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setCenterRipple('pause');
    }
    setTimeout(() => setCenterRipple(null), 500);
  };

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const now = Date.now();
    const timeDiff = now - lastTapRef.current.time;

    if (timeDiff < 300) {
      if (clickX < 0.35) {
        skipTime(-10);
        setSeekRipple({ side: 'left', text: '10 seconds' });
        setTimeout(() => setSeekRipple(null), 600);
      } else if (clickX > 0.65) {
        skipTime(10);
        setSeekRipple({ side: 'right', text: '10 seconds' });
        setTimeout(() => setSeekRipple(null), 600);
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

  const adjustVolume = (delta: number) => {
    if (!videoRef.current) return;
    const newVol = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVol);
    videoRef.current.volume = newVol;
    const muted = newVol === 0;
    setIsMuted(muted);
    videoRef.current.muted = muted;
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !videoRef.current.muted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    if (!newMuted && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
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
    setSettingsSubmenu('main');
    setShowSettingsMenu(false);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pos * duration;
  };

  const handleShare = async () => {
    const url = window.location.origin;
    await navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleToggleLike = async () => {
    if (!media) return;
    const nextState = !isLiked;
    setIsLiked(nextState);
    if (nextState) {
      setIsDisliked(false);
      setLikeCount((prev) => prev + 1);
    } else {
      setLikeCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await fetch(`/api/media/${media.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ isFavorite: nextState }),
      });
    } catch {
      // ignore
    }
  };

  if (!media) return null;

  const streamUrl = `/api/media/${media.id}/stream`;
  const relatedVideos = allVideos.filter((v) => v.id !== media.id && v.type === 'video');
  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto',
        color: '#f1f1f1',
        fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
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
          maxWidth: isTheaterMode ? '100%' : '1180px',
          display: 'flex',
          flexDirection: 'column',
          margin: '0 auto',
          padding: isTheaterMode ? '0' : '16px 20px',
          transition: 'max-width 0.25s ease, padding 0.25s ease',
        }}
      >
        {/* YouTube Video Player Viewport */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && !showSettingsMenu && setShowControls(false)}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            backgroundColor: '#000000',
            borderRadius: isFullscreen || isTheaterMode ? 0 : '12px',
            overflow: 'hidden',
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.95)',
            userSelect: 'none',
          }}
        >
          {/* Main Video Stream */}
          <video
            ref={videoRef}
            src={streamUrl}
            autoPlay
            playsInline
            loop={isLooping}
            onClick={handleVideoClick}
            onTimeUpdate={() => {
              if (videoRef.current) {
                const ct = videoRef.current.currentTime;
                if (isFinite(ct)) setCurrentTime(ct);
                const d = videoRef.current.duration;
                if (isFinite(d) && d > 0 && d !== duration) {
                  setDuration(d);
                }
              }
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                const d = videoRef.current.duration;
                if (isFinite(d) && d > 0) {
                  setDuration(d);
                } else if (media.duration && isFinite(media.duration) && media.duration > 0) {
                  setDuration(media.duration);
                }
                if (media.playbackPosition && media.playbackPosition > 5) {
                  videoRef.current.currentTime = media.playbackPosition;
                }
              }
            }}
            onDurationChange={() => {
              if (videoRef.current) {
                const d = videoRef.current.duration;
                if (isFinite(d) && d > 0) {
                  setDuration(d);
                } else if (media.duration && isFinite(media.duration) && media.duration > 0) {
                  setDuration(media.duration);
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
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              cursor: 'pointer',
              backgroundColor: '#000000',
            }}
          />

          {/* YouTube Subtle Top Header Vignette (Fades with controls) */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '16px 24px',
              background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              opacity: showControls ? 1 : 0,
              transition: 'opacity 0.25s ease',
              pointerEvents: showControls ? 'auto' : 'none',
              zIndex: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '1rem',
                  fontWeight: 500,
                  color: '#ffffff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.2px',
                }}
              >
                {media.title}
              </span>
              {media.isPrivate && (
                <span
                  style={{
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#f59e0b',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Lock size={11} /> Vault
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => setIsTheaterMode(!isTheaterMode)}
                style={{
                  background: isTheaterMode ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '16px',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  backdropFilter: 'blur(6px)',
                  transition: 'background 0.15s ease',
                }}
                title="Toggle Theater Mode (T)"
              >
                <Tv size={14} />
                <span>{isTheaterMode ? 'Default' : 'Theater'}</span>
              </button>

              <button
                onClick={() => {
                  saveProgress();
                  onClose();
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '7px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(6px)',
                  transition: 'background 0.15s ease',
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Center Play/Pause Soft Ripple Animation */}
          {centerRipple && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                pointerEvents: 'none',
                backdropFilter: 'blur(8px)',
                animation: 'youtubeRipple 0.5s ease-out forwards',
                zIndex: 25,
              }}
            >
              {centerRipple === 'play' ? <Play size={36} fill="#ffffff" /> : <Pause size={36} fill="#ffffff" />}
            </div>
          )}

          {/* Double-Tap 10s Seek Ripple (Classic YouTube Mobile & Desktop) */}
          {seekRipple && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                [seekRipple.side]: '12%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: '#ffffff',
                padding: '12px 22px',
                borderRadius: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.95rem',
                fontWeight: 600,
                pointerEvents: 'none',
                backdropFilter: 'blur(10px)',
                zIndex: 25,
              }}
            >
              {seekRipple.side === 'left' ? <RotateCcw size={20} /> : <RotateCw size={20} />}
              <span>{seekRipple.text}</span>
            </div>
          )}

          {/* Authentic YouTube Bottom Control Bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to top, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.5) 45%, rgba(0, 0, 0, 0.15) 75%, transparent 100%)',
              padding: '0 16px 12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              opacity: showControls ? 1 : 0,
              transition: 'opacity 0.2s cubic-bezier(0, 0, 0.2, 1)',
              pointerEvents: showControls ? 'auto' : 'none',
              zIndex: 30,
            }}
          >
            {/* Signature YouTube Scrubber Bar */}
            <div
              onMouseEnter={() => setIsHoveringScrubber(true)}
              onMouseLeave={() => {
                setIsHoveringScrubber(false);
                setHoverScrubTime(null);
              }}
              onClick={handleSeek}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setHoverScrubTime(pos * duration);
                setHoverScrubX(e.clientX - rect.left);
              }}
              style={{
                position: 'relative',
                width: '100%',
                height: isHoveringScrubber ? '6px' : '3px',
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                cursor: 'pointer',
                transition: 'height 0.1s ease',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {/* Hover Timestamp Tooltip */}
              {hoverScrubTime !== null && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: `${hoverScrubX}px`,
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(28, 28, 28, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '3px 7px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.7)',
                    whiteSpace: 'nowrap',
                    zIndex: 40,
                  }}
                >
                  {formatTime(hoverScrubTime)}
                </div>
              )}

              {/* YouTube Signature Red Played Bar */}
              <div
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  backgroundColor: '#ff0000',
                  position: 'relative',
                }}
              >
                {/* 13px YouTube Red Scrub Circle (Scales up on hover) */}
                <div
                  style={{
                    position: 'absolute',
                    right: '-6px',
                    top: '50%',
                    transform: isHoveringScrubber ? 'translateY(-50%) scale(1)' : 'translateY(-50%) scale(0)',
                    width: '13px',
                    height: '13px',
                    borderRadius: '50%',
                    backgroundColor: '#ff0000',
                    transition: 'transform 0.12s ease',
                  }}
                />
              </div>
            </div>

            {/* Bottom Controls Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
              {/* Left Controls: Play, Rewind, Forward, Volume, Time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Play / Pause */}
                <button
                  onClick={togglePlay}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    opacity: 0.92,
                    transition: 'opacity 0.15s ease',
                  }}
                  title={isPlaying ? 'Pause (k)' : 'Play (k)'}
                >
                  {isPlaying ? <Pause size={22} fill="#ffffff" /> : <Play size={22} fill="#ffffff" />}
                </button>

                {/* Rewind 10s */}
                <button
                  onClick={() => skipTime(-10)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.85,
                  }}
                  title="Rewind 10 seconds (j)"
                >
                  <RotateCcw size={18} />
                </button>

                {/* Forward 10s */}
                <button
                  onClick={() => skipTime(10)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.85,
                  }}
                  title="Forward 10 seconds (l)"
                >
                  <RotateCw size={18} />
                </button>

                {/* Volume & Slide-out Horizontal Slider */}
                <div
                  onMouseEnter={() => setIsHoveringVolume(true)}
                  onMouseLeave={() => setIsHoveringVolume(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <button
                    onClick={toggleMute}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ffffff',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={isMuted ? 'Unmute (m)' : 'Mute (m)'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX size={20} />
                    ) : volume < 0.5 ? (
                      <Volume1 size={20} />
                    ) : (
                      <Volume2 size={20} />
                    )}
                  </button>

                  <div
                    style={{
                      width: isHoveringVolume ? '64px' : '0px',
                      overflow: 'hidden',
                      transition: 'width 0.2s cubic-bezier(0, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      style={{
                        width: '56px',
                        height: '3.5px',
                        accentColor: '#ffffff',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                </div>

                {/* Time Display */}
                <span
                  style={{
                    fontSize: '0.82rem',
                    color: '#ffffff',
                    fontVariantNumeric: 'tabular-nums',
                    marginLeft: '6px',
                    opacity: 0.9,
                    userSelect: 'none',
                  }}
                >
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Right Controls: Settings Gear, PiP, Theater, Fullscreen */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                {/* Settings Gear */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => {
                      setShowSettingsMenu(!showSettingsMenu);
                      setSettingsSubmenu('main');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ffffff',
                      cursor: 'pointer',
                      padding: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: showSettingsMenu ? 1 : 0.85,
                      transform: showSettingsMenu ? 'rotate(30deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease, opacity 0.15s ease',
                    }}
                    title="Settings"
                  >
                    <Settings size={19} />
                  </button>

                  {/* YouTube Real Settings Popover Menu */}
                  {showSettingsMenu && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '44px',
                        right: 0,
                        width: '240px',
                        backgroundColor: 'rgba(28, 28, 28, 0.98)',
                        border: '1px solid #383838',
                        borderRadius: '10px',
                        padding: '6px 0',
                        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.9)',
                        backdropFilter: 'blur(16px)',
                        zIndex: 50,
                      }}
                    >
                      {settingsSubmenu === 'main' && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {/* Playback speed option */}
                          <div
                            onClick={() => setSettingsSubmenu('speed')}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 16px',
                              cursor: 'pointer',
                              fontSize: '0.84rem',
                              color: '#ffffff',
                              transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <span>Playback speed</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#aaaaaa', fontSize: '0.8rem' }}>
                              <span>{playbackSpeed === 1 ? 'Normal' : `${playbackSpeed}x`}</span>
                              <ChevronRight size={15} />
                            </div>
                          </div>

                          {/* Quality option */}
                          <div
                            onClick={() => setSettingsSubmenu('quality')}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 16px',
                              cursor: 'pointer',
                              fontSize: '0.84rem',
                              color: '#ffffff',
                              transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <span>Quality</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#aaaaaa', fontSize: '0.8rem' }}>
                              <span>{streamQuality === 'auto' ? 'Auto (Source)' : streamQuality.toUpperCase()}</span>
                              <ChevronRight size={15} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Speed Submenu */}
                      {settingsSubmenu === 'speed' && (
                        <div>
                          <div
                            onClick={() => setSettingsSubmenu('main')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 14px',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                              cursor: 'pointer',
                              fontSize: '0.84rem',
                              fontWeight: 600,
                            }}
                          >
                            <ChevronLeft size={16} />
                            <span>Playback speed</span>
                          </div>
                          {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((spd) => (
                            <div
                              key={spd}
                              onClick={() => handleSpeedChange(spd)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                color: '#ffffff',
                                backgroundColor: playbackSpeed === spd ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)')}
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = playbackSpeed === spd ? 'rgba(255, 255, 255, 0.1)' : 'transparent')
                              }
                            >
                              <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                                {playbackSpeed === spd && <Check size={14} color="#ffffff" />}
                              </div>
                              <span>{spd === 1 ? 'Normal' : `${spd}x`}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Quality Submenu */}
                      {settingsSubmenu === 'quality' && (
                        <div>
                          <div
                            onClick={() => setSettingsSubmenu('main')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 14px',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                              cursor: 'pointer',
                              fontSize: '0.84rem',
                              fontWeight: 600,
                            }}
                          >
                            <ChevronLeft size={16} />
                            <span>Quality</span>
                          </div>
                          {[
                            { id: 'auto', label: 'Auto (Source Direct)' },
                            { id: '4k', label: '4K Ultra HD (2160p)' },
                            { id: '1080p', label: '1080p Full HD' },
                            { id: '720p', label: '720p HD' },
                          ].map((q) => (
                            <div
                              key={q.id}
                              onClick={() => {
                                setStreamQuality(q.id as any);
                                setSettingsSubmenu('main');
                                setShowSettingsMenu(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                color: '#ffffff',
                                backgroundColor: streamQuality === q.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)')}
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = streamQuality === q.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent')
                              }
                            >
                              <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                                {streamQuality === q.id && <Check size={14} color="#ffffff" />}
                              </div>
                              <span>{q.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
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
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.85,
                  }}
                  title="Miniplayer (Picture in Picture)"
                >
                  <Tv size={18} />
                </button>

                {/* Theater Mode */}
                <button
                  onClick={() => setIsTheaterMode(!isTheaterMode)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.85,
                  }}
                  title={isTheaterMode ? 'Default view (t)' : 'Theater mode (t)'}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '13px',
                      border: '2px solid #ffffff',
                      borderRadius: '2px',
                      background: isTheaterMode ? '#ffffff' : 'transparent',
                    }}
                  />
                </button>

                {/* Fullscreen */}
                <button
                  onClick={() => void toggleFullscreen()}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.85,
                  }}
                  title={isFullscreen ? 'Exit full screen (f)' : 'Full screen (f)'}
                >
                  {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Information & Classic YouTube Actions */}
        <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Video Title */}
          <h1
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#f1f1f1',
              margin: 0,
              lineHeight: 1.3,
              letterSpacing: '-0.01em',
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            {media.title}
          </h1>

          {/* YouTube Channel Row & Action Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* Authentic YouTube Channel Info & Subscribe Pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  border: '2px solid rgba(255, 255, 255, 0.18)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.6)',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                {media.title.charAt(0).toUpperCase()}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '0px',
                    right: '0px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    border: '2px solid #0f0f0f',
                  }}
                  title="Offline Direct Stream Active"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    style={{
                      fontSize: '0.98rem',
                      fontWeight: 600,
                      color: '#f1f1f1',
                      letterSpacing: '0.1px',
                    }}
                  >
                    Vesper Cinema
                  </span>
                  <CheckCircle2
                    size={14}
                    color="#0f0f0f"
                    fill="#aaaaaa"
                    style={{ flexShrink: 0 }}
                  />
                </div>
                <span style={{ fontSize: '0.78rem', color: '#aaaaaa' }}>
                  1.42M subscribers • 4K Direct Bitstream
                </span>
              </div>

              {/* YouTube Subscribe / Subscribed Button */}
              <button
                onClick={() => setIsSubscribed((prev) => !prev)}
                style={{
                  marginLeft: '8px',
                  backgroundColor: isSubscribed ? 'rgba(255, 255, 255, 0.12)' : '#ffffff',
                  color: isSubscribed ? '#f1f1f1' : '#0f0f0f',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '0 16px',
                  height: '36px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'background 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s ease',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isSubscribed
                    ? 'rgba(255, 255, 255, 0.2)'
                    : '#e5e5e5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSubscribed
                    ? 'rgba(255, 255, 255, 0.12)'
                    : '#ffffff';
                }}
              >
                {isSubscribed ? (
                  <>
                    <Bell size={15} />
                    <span>Subscribed</span>
                  </>
                ) : (
                  <span>Subscribe</span>
                )}
              </button>
            </div>

            {/* YouTube Standard Segmented Pill Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Segmented Like / Dislike */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  height: '36px',
                }}
              >
                <button
                  onClick={handleToggleLike}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '0 14px',
                    height: '100%',
                    background: 'none',
                    border: 'none',
                    color: isLiked ? '#ffffff' : '#f1f1f1',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  title="Like this movie"
                >
                  <ThumbsUp size={16} fill={isLiked ? '#ffffff' : 'none'} />
                  <span>{formatCompactNumber(likeCount)}</span>
                </button>

                <button
                  onClick={() => {
                    setIsDisliked(!isDisliked);
                    if (!isDisliked) setIsLiked(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 12px',
                    height: '100%',
                    background: 'none',
                    border: 'none',
                    color: isDisliked ? '#ffffff' : '#f1f1f1',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  title="Dislike"
                >
                  <ThumbsDown size={16} fill={isDisliked ? '#ffffff' : 'none'} />
                </button>
              </div>

              {/* Share Pill */}
              <button
                onClick={handleShare}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 14px',
                  height: '36px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '20px',
                  color: '#f1f1f1',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                title="Share direct streaming link"
              >
                {isCopied ? <Check size={15} color="#10b981" /> : <Share2 size={15} />}
                <span>{isCopied ? 'Link Copied!' : 'Share'}</span>
              </button>

              {/* Download Pill */}
              <a
                href={streamUrl}
                download={media.originalFilename}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 14px',
                  height: '36px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '20px',
                  color: '#f1f1f1',
                  textDecoration: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                title="Save video file to device"
              >
                <Download size={15} />
                <span>Download</span>
              </a>

              {/* Save to Playlist / Vault Pill */}
              <button
                onClick={() => setIsSaved((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 14px',
                  height: '36px',
                  backgroundColor: isSaved ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '20px',
                  color: '#f1f1f1',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.22)')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = isSaved ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)')
                }
                title="Save to watchlist"
              >
                <Bookmark size={15} fill={isSaved ? '#ffffff' : 'none'} />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>

              {/* Cast to TV Pill */}
              {onCastToTv && (
                <button
                  onClick={() => onCastToTv(media)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 14px',
                    height: '36px',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '20px',
                    color: '#38bdf8',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.25)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.15)')}
                  title="Cast this movie to the big HDMI TV screen"
                >
                  <Tv size={15} />
                  <span>Play on TV</span>
                </button>
              )}

              {/* Move to Google Photos / Family Video Button */}
              {onReclassify && (
                <button
                  onClick={() => {
                    if (window.confirm('Move this video to "Photos & Memories" (Family Videos)?')) {
                      onReclassify(media.id, 'family');
                      onClose();
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 14px',
                    height: '36px',
                    backgroundColor: 'rgba(138, 180, 248, 0.12)',
                    border: '1px solid rgba(138, 180, 248, 0.25)',
                    borderRadius: '20px',
                    color: '#8ab4f8',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    transition: 'background 0.15s ease',
                  }}
                  title="Move to Google Photos (Family Video collection)"
                >
                  <FolderSync size={15} />
                  <span>Move to Memories</span>
                </button>
              )}

              {/* More Actions 3-dots popover */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowMoreMenu((prev) => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: showMoreMenu ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: '#f1f1f1',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = showMoreMenu
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(255, 255, 255, 0.1)')
                  }
                  title="More actions"
                >
                  <MoreHorizontal size={18} />
                </button>

                {showMoreMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '44px',
                      right: 0,
                      width: '210px',
                      backgroundColor: 'rgba(28, 28, 28, 0.98)',
                      border: '1px solid #383838',
                      borderRadius: '12px',
                      padding: '6px 0',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.9)',
                      backdropFilter: 'blur(16px)',
                      zIndex: 60,
                    }}
                  >
                    <div
                      onClick={() => {
                        setIsLooping(!isLooping);
                        setShowMoreMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 16px',
                        cursor: 'pointer',
                        fontSize: '0.84rem',
                        color: '#ffffff',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Repeat size={16} />
                        <span>Loop Video</span>
                      </div>
                      {isLooping && <Check size={14} color="#ffffff" />}
                    </div>

                    {onDelete && (
                      <div
                        onClick={() => {
                          setShowMoreMenu(false);
                          if (window.confirm(`Permanently delete "${media.title}"?`)) {
                            onDelete(media.id);
                            onClose();
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 16px',
                          cursor: 'pointer',
                          fontSize: '0.84rem',
                          color: '#f87171',
                          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Trash2 size={16} />
                        <span>Delete Movie</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* YouTube Sleek Description Card */}
          <div
            style={{
              backgroundColor: '#272727',
              borderRadius: '12px',
              padding: '14px 18px',
              fontSize: '0.88rem',
              lineHeight: 1.55,
              color: '#f1f1f1',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onClick={() => setShowFullDesc(!showFullDesc)}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#303030')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#272727')}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                marginBottom: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span>{formatCompactNumber(media.playCount || 1)} views</span>
              <span style={{ color: '#aaaaaa' }}>•</span>
              <span>
                {new Date(media.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>

              {/* YouTube Style Hashtags */}
              <span style={{ color: '#8ab4f8', fontWeight: 500 }}>
                #VesperCinema #4KDirect #ZeroTranscode
              </span>

              {media.categoryName && (
                <span
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    color: '#ffffff',
                  }}
                >
                  {media.categoryName}
                </span>
              )}
            </div>

            {/* Tech Specs Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  letterSpacing: '0.5px',
                }}
              >
                4K DIRECT PASSTHROUGH
              </span>

              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  letterSpacing: '0.5px',
                }}
              >
                0% CPU TRANSCODE
              </span>

              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#94a3b8',
                  background: 'rgba(255, 255, 255, 0.08)',
                  padding: '2px 7px',
                  borderRadius: '4px',
                }}
              >
                RFC-7233 512KB CHUNKS
              </span>
            </div>

            <div style={{ whiteSpace: 'pre-wrap', color: '#e0e0e0', marginTop: '6px' }}>
              {media.description ? (
                showFullDesc ? (
                  media.description
                ) : (
                  media.description.slice(0, 160) + (media.description.length > 160 ? '...' : '')
                )
              ) : (
                <span style={{ color: '#aaaaaa' }}>
                  Offline sanctuary playback. Direct bitstream streamed straight from high-speed storage without re-encoding or battery drain.
                </span>
              )}
            </div>

            {media.description && media.description.length > 160 && (
              <span
                style={{
                  fontWeight: 600,
                  color: '#f1f1f1',
                  display: 'inline-block',
                  marginTop: '8px',
                  fontSize: '0.82rem',
                }}
              >
                {showFullDesc ? 'Show less' : '...more'}
              </span>
            )}
          </div>

          {/* Up Next / Related Movies (YouTube Desktop Grid / Mobile Feed) */}
          {relatedVideos.length > 0 && onSelectRelatedVideo && (
            <div style={{ marginTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f1f1f1', margin: 0 }}>
                  More in Movies Library
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#aaaaaa' }}>
                  {relatedVideos.length} recommendations
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '16px',
                }}
              >
                {relatedVideos.slice(0, 4).map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => {
                      saveProgress();
                      onSelectRelatedVideo(rel);
                    }}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      backgroundColor: '#181818',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.8)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#000' }}>
                      <img
                        src={`/api/media/${rel.id}/thumbnail`}
                        alt={rel.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {rel.duration && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            color: '#ffffff',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {formatTime(rel.duration)}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <p
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          color: '#f1f1f1',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {rel.title}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.76rem', color: '#aaaaaa' }}>Vesper Cinema</span>
                        <CheckCircle2 size={11} color="#0f0f0f" fill="#aaaaaa" />
                      </div>
                      <p style={{ fontSize: '0.74rem', color: '#888888', margin: '3px 0 0 0' }}>
                        {formatCompactNumber(rel.playCount || 1)} views • Stream Direct
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

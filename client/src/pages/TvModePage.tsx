import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { MediaItem, TvRemoteAction, TvRemoteCommand } from '@media-hub/shared';
import {
  Play,
  Pause,
  Tv,
  Volume2,
  VolumeX,
  Wifi,
  Film,
  Music,
  Sparkles,
} from 'lucide-react';
import { VesperLogo } from '../components/VesperLogo';

export const TvModePage: React.FC = () => {
  // Navigation & Media State
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<'movies' | 'music'>('movies');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [focusedSection, setFocusedSection] = useState<'tabs' | 'grid' | 'player'>('grid');

  // Active Playback State
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showOsd, setShowOsd] = useState<boolean>(false);
  const [osdFeedback, setOsdFeedback] = useState<string | null>(null);

  // System & Connection State
  const [tvModel, setTvModel] = useState<string>('HDMI TV Display');
  const [localIp, setLocalIp] = useState<string>('vesper.local:3000');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const osdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial media and IP
  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const res = await fetch('/api/media');
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setMediaList(json.data.media.filter((m: MediaItem) => !m.isPrivate));
          }
        }
      } catch {
        // ignore
      }
    };

    const fetchNetwork = async () => {
      try {
        const res = await fetch('/api/network/status');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data.ipAddress) {
            setLocalIp(`${json.data.ipAddress}:3000`);
          }
        }
      } catch {
        // ignore
      }
    };

    void fetchMedia();
    void fetchNetwork();
  }, []);

  // Filtered list based on active category
  const filteredList = mediaList.filter((m) =>
    activeCategory === 'movies' ? m.type === 'video' : m.type === 'audio'
  );

  // Trigger OSD
  const triggerOsd = useCallback((feedbackText?: string) => {
    setShowOsd(true);
    if (feedbackText) {
      setOsdFeedback(feedbackText);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setOsdFeedback(null), 2500);
    }
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => setShowOsd(false), 4000);
  }, []);

  // Sync state back to server so phone remotes stay updated
  const reportPlaybackToServer = useCallback(
    (curTime: number, dur: number, state: 'playing' | 'paused' | 'stopped') => {
      fetch('/api/tv/playback-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbackState: state,
          currentTime: curTime,
          duration: dur,
          volume,
          isMuted,
        }),
      }).catch(() => {});
    },
    [volume, isMuted]
  );

  // Format time (mm:ss or hh:mm:ss)
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Guard against non-finite or premature duration values
  const effectiveDuration = Math.max(
    duration || 0,
    currentTime || 0,
    activeMedia?.duration && isFinite(activeMedia.duration) ? activeMedia.duration : 0
  );
  const progressPercent = effectiveDuration > 0
    ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
    : 0;

  // Play a media item on the TV
  const playMedia = useCallback(
    (media: MediaItem, startSeconds: number = 0) => {
      setActiveMedia(media);
      setFocusedSection('player');
      setIsPlaying(true);
      triggerOsd(`Now Playing: ${media.title}`);

      // Allow DOM to render video tag
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = startSeconds;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    },
    [triggerOsd]
  );

  // Handle remote command action (from CEC TV Remote, Phone Virtual Remote, or Keyboard)
  const handleRemoteAction = useCallback(
    (action: TvRemoteAction, payload?: any) => {
      if (focusedSection === 'player' && activeMedia) {
        // Player Controls
        switch (action) {
          case 'play':
            videoRef.current?.play();
            setIsPlaying(true);
            triggerOsd('Play');
            break;
          case 'pause':
            videoRef.current?.pause();
            setIsPlaying(false);
            triggerOsd('Pause');
            break;
          case 'play_pause':
            if (videoRef.current?.paused) {
              videoRef.current.play();
              setIsPlaying(true);
              triggerOsd('Play');
            } else {
              videoRef.current?.pause();
              setIsPlaying(false);
              triggerOsd('Pause');
            }
            break;
          case 'seek_forward':
          case 'right':
            if (videoRef.current) {
              videoRef.current.currentTime = Math.min(
                videoRef.current.duration || 0,
                videoRef.current.currentTime + 10
              );
              triggerOsd('+10s Forward');
            }
            break;
          case 'seek_backward':
          case 'left':
            if (videoRef.current) {
              videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
              triggerOsd('-10s Rewind');
            }
            break;
          case 'volume_up':
          case 'up':
            setVolume((prev) => {
              const next = Math.min(100, prev + 5);
              if (videoRef.current) videoRef.current.volume = next / 100;
              triggerOsd(`Volume: ${next}%`);
              return next;
            });
            break;
          case 'volume_down':
          case 'down':
            setVolume((prev) => {
              const next = Math.max(0, prev - 5);
              if (videoRef.current) videoRef.current.volume = next / 100;
              triggerOsd(`Volume: ${next}%`);
              return next;
            });
            break;
          case 'mute':
            setIsMuted((prev) => {
              const next = !prev;
              if (videoRef.current) videoRef.current.muted = next;
              triggerOsd(next ? 'Muted' : 'Unmuted');
              return next;
            });
            break;
          case 'stop':
          case 'back':
            videoRef.current?.pause();
            setActiveMedia(null);
            setIsPlaying(false);
            setFocusedSection('grid');
            reportPlaybackToServer(0, 0, 'stopped');
            break;
          case 'select':
            triggerOsd();
            break;
        }
        return;
      }

      // Grid Navigation
      const cols = 4;
      const totalItems = filteredList.length;

      switch (action) {
        case 'up':
          if (focusedSection === 'grid') {
            if (focusedIndex >= cols) {
              setFocusedIndex((prev) => prev - cols);
            } else {
              setFocusedSection('tabs');
            }
          }
          break;
        case 'down':
          if (focusedSection === 'tabs') {
            setFocusedSection('grid');
          } else if (focusedSection === 'grid') {
            if (focusedIndex + cols < totalItems) {
              setFocusedIndex((prev) => prev + cols);
            }
          }
          break;
        case 'left':
          if (focusedSection === 'tabs') {
            setActiveCategory('movies');
          } else if (focusedSection === 'grid') {
            setFocusedIndex((prev) => Math.max(0, prev - 1));
          }
          break;
        case 'right':
          if (focusedSection === 'tabs') {
            setActiveCategory('music');
          } else if (focusedSection === 'grid') {
            setFocusedIndex((prev) => Math.min(totalItems - 1, prev + 1));
          }
          break;
        case 'select':
          if (focusedSection === 'tabs') {
            setFocusedSection('grid');
          } else if (focusedSection === 'grid' && filteredList[focusedIndex]) {
            playMedia(filteredList[focusedIndex]);
          }
          break;
        case 'cast':
          if (payload && payload.media) {
            playMedia(payload.media, payload.startTime || 0);
          }
          break;
      }
    },
    [focusedSection, activeMedia, filteredList, focusedIndex, triggerOsd, playMedia, reportPlaybackToServer]
  );

  // Keep focused item scrolled into view smoothly
  useEffect(() => {
    if (focusedSection === 'grid' && gridContainerRef.current) {
      const el = gridContainerRef.current.children[focusedIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [focusedIndex, focusedSection]);

  // Connect to SSE event stream for live remote commands & cast events
  useEffect(() => {
    const eventSource = new EventSource('/api/tv/events');

    eventSource.addEventListener('initial_state', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.hdmi?.tvModel) setTvModel(data.hdmi.tvModel);
        if (data.playback?.currentMedia && data.playback.playbackState === 'playing') {
          playMedia(data.playback.currentMedia, data.playback.currentTime || 0);
        }
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('hdmi_status', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.hdmi?.tvModel) setTvModel(data.hdmi.tvModel);
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('remote_command', (e) => {
      try {
        const cmd: TvRemoteCommand = JSON.parse(e.data);
        handleRemoteAction(cmd.action, cmd.payload);
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('cast_media', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.media) {
          playMedia(payload.media, payload.startTime || 0);
        }
      } catch {
        // ignore
      }
    });

    return () => {
      eventSource.close();
    };
  }, [handleRemoteAction, playMedia]);

  // Keyboard navigation fallback (Direct USB keyboard or wireless air-mouse on Pi)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleRemoteAction('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleRemoteAction('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleRemoteAction('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleRemoteAction('right');
          break;
        case 'Enter':
          e.preventDefault();
          handleRemoteAction('select');
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          handleRemoteAction('back');
          break;
        case ' ':
          e.preventDefault();
          handleRemoteAction('play_pause');
          break;
        case 'MediaPlayPause':
          e.preventDefault();
          handleRemoteAction('play_pause');
          break;
        case 'MediaTrackNext':
          e.preventDefault();
          handleRemoteAction('seek_forward');
          break;
        case 'MediaTrackPrevious':
          e.preventDefault();
          handleRemoteAction('seek_backward');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRemoteAction]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#05070a',
        color: '#f8fafc',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: 'hidden',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 1. Header Bar: Vesper Ambient Crown & TV Connectivity Badges */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px 48px',
          background: 'linear-gradient(180deg, rgba(8, 10, 15, 0.95) 0%, transparent 100%)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <VesperLogo size="lg" showText={true} subtitle="Cinema Living Room Edition" />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          >
            <Tv size={14} />
            <span>{tvModel}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#94a3b8',
              fontSize: '0.9rem',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '6px 16px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Wifi size={15} color="#38bdf8" />
            <span>Cast from Phone: <strong>http://{localIp}</strong></span>
          </div>

          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
            {currentTimeStr}
          </div>
        </div>
      </header>

      {/* 2. Main 10-Foot Content Area */}
      {!activeMedia ? (
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '0 48px 48px',
            overflowY: 'auto',
          }}
        >
          {/* Navigation Category Tabs (Movies vs Music) */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
            <button
              onClick={() => {
                setActiveCategory('movies');
                setFocusedIndex(0);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 28px',
                borderRadius: '30px',
                fontSize: '1.05rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                background:
                  activeCategory === 'movies'
                    ? '#ffffff'
                    : 'rgba(255, 255, 255, 0.06)',
                color: activeCategory === 'movies' ? '#000000' : '#cbd5e1',
                border:
                  focusedSection === 'tabs' && activeCategory === 'movies'
                    ? '3px solid #38bdf8'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow:
                  focusedSection === 'tabs' && activeCategory === 'movies'
                    ? '0 0 20px rgba(56, 189, 248, 0.4)'
                    : 'none',
              }}
            >
              <Film size={18} />
              <span>Cinema & Movies</span>
            </button>

            <button
              onClick={() => {
                setActiveCategory('music');
                setFocusedIndex(0);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 28px',
                borderRadius: '30px',
                fontSize: '1.05rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                background:
                  activeCategory === 'music'
                    ? '#ffffff'
                    : 'rgba(255, 255, 255, 0.06)',
                color: activeCategory === 'music' ? '#000000' : '#cbd5e1',
                border:
                  focusedSection === 'tabs' && activeCategory === 'music'
                    ? '3px solid #38bdf8'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow:
                  focusedSection === 'tabs' && activeCategory === 'music'
                    ? '0 0 20px rgba(56, 189, 248, 0.4)'
                    : 'none',
              }}
            >
              <Music size={18} />
              <span>Lossless Audio</span>
            </button>
          </div>

          {/* Media Grid with 4-Column High-Impact Cards */}
          <div
            ref={gridContainerRef}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '28px',
              paddingBottom: '40px',
            }}
          >
            {filteredList.map((item, idx) => {
              const isFocused = focusedSection === 'grid' && focusedIndex === idx;
              return (
                <div
                  key={item.id}
                  onClick={() => playMedia(item)}
                  style={{
                    position: 'relative',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: '#131722',
                    cursor: 'pointer',
                    transform: isFocused ? 'scale(1.06)' : 'scale(1)',
                    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease',
                    border: isFocused ? '3px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: isFocused
                      ? '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(56, 189, 248, 0.5)'
                      : '0 8px 24px rgba(0, 0, 0, 0.5)',
                    zIndex: isFocused ? 10 : 1,
                  }}
                >
                  {/* Poster / Thumbnail (16:9 for Movies, 1:1 for Audio) */}
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: activeCategory === 'movies' ? '16/9' : '1/1',
                      position: 'relative',
                      backgroundColor: '#0a0d14',
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={`/api/media/${item.id}/thumbnail`}
                      alt={item.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />

                    {/* Resolution / Lossless Badge */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(8px)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: '#34d399',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {item.type === 'video' ? '4K DIRECT' : 'LOSSLESS'}
                    </div>

                    {/* Duration Badge */}
                    {item.duration && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '10px',
                          right: '10px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(0, 0, 0, 0.8)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#ffffff',
                        }}
                      >
                        {formatTime(item.duration)}
                      </div>
                    )}

                    {/* Glowing Focus Play Overlay */}
                    {isFocused && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0, 0, 0, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            backgroundColor: '#38bdf8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 20px rgba(56, 189, 248, 0.8)',
                          }}
                        >
                          <Play size={24} color="#000000" fill="#000000" style={{ marginLeft: '3px' }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Title Bar */}
                  <div style={{ padding: '14px 18px' }}>
                    <h3
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        margin: '0 0 4px',
                        color: isFocused ? '#ffffff' : '#e2e8f0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                      {item.categoryName || (item.type === 'video' ? 'Feature Film' : 'Audio Track')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      ) : (
        /* 3. Full-Screen 4K Cinema Player for TV */
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => triggerOsd()}
        >
          <video
            ref={videoRef}
            src={`/api/media/${activeMedia.id}/stream`}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onTimeUpdate={() => {
              if (videoRef.current) {
                const cur = videoRef.current.currentTime;
                const dur = videoRef.current.duration;
                if (isFinite(cur)) {
                  setCurrentTime(cur);
                  if (cur > duration) setDuration(cur);
                }
                if (isFinite(dur) && dur > 0) setDuration(Math.max(dur, isFinite(cur) ? cur : 0));
                reportPlaybackToServer(cur, dur, isPlaying ? 'playing' : 'paused');
              }
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                const dur = videoRef.current.duration;
                if (isFinite(dur) && dur > 0) {
                  setDuration(dur);
                } else if (activeMedia?.duration && isFinite(activeMedia.duration) && activeMedia.duration > 0) {
                  setDuration(activeMedia.duration);
                }
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              reportPlaybackToServer(duration, duration, 'stopped');
              triggerOsd('Playback Finished');
            }}
          />

          {/* Large Living Room On-Screen Display (OSD) Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '48px',
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.92) 100%)',
              opacity: showOsd ? 1 : 0,
              pointerEvents: showOsd ? 'auto' : 'none',
              transition: 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Top OSD Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span
                  style={{
                    color: '#34d399',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Direct 4K Bitstream Passthrough
                </span>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '4px 0 0', color: '#ffffff' }}>
                  {activeMedia.title}
                </h1>
              </div>

              {/* Instant Feedback Pill */}
              {osdFeedback && (
                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.25)',
                    border: '1px solid rgba(56, 189, 248, 0.5)',
                    color: '#ffffff',
                    padding: '8px 24px',
                    borderRadius: '24px',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {osdFeedback}
                </div>
              )}
            </div>

            {/* Bottom Scrubber & Transport Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Timeline Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    backgroundColor: '#38bdf8',
                    boxShadow: '0 0 14px rgba(56, 189, 248, 0.8)',
                    transition: 'width 0.2s linear',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button
                    onClick={() => handleRemoteAction('play_pause')}
                    style={{
                      background: '#ffffff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '48px',
                      height: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    {isPlaying ? <Pause size={22} color="#000" /> : <Play size={22} color="#000" style={{ marginLeft: '2px' }} />}
                  </button>

                  <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9' }}>
                    {formatTime(currentTime)} / {formatTime(effectiveDuration)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '18px', color: '#94a3b8', fontSize: '0.95rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isMuted ? <VolumeX size={18} color="#f87171" /> : <Volume2 size={18} />}
                    <span>{isMuted ? 'Muted' : `${volume}%`}</span>
                  </div>
                  <span>•</span>
                  <span>Press <strong>Back</strong> or <strong>Exit</strong> on TV Remote to close</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Ready-to-Cast Pill when idle */}
      {!activeMedia && (
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '48px',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '8px 18px',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            color: '#cbd5e1',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Sparkles size={14} color="#38bdf8" />
          <span>Physical TV Remote & Phone Remote Ready</span>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Lock,
  Trash2,
  Calendar,
  Download,
  Maximize2,
  Info,
  FileText,
  HardDrive,
  Shield,
  Star,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Repeat,
  Film,
} from 'lucide-react';
import type { MediaItem } from '@media-hub/shared';

interface PhotoLightboxModalProps {
  media: MediaItem | null;
  items?: MediaItem[];
  onClose: () => void;
  onDelete?: (id: string) => void;
  onSelectMedia?: (media: MediaItem) => void;
  onReclassify?: (id: string, newSubType: 'movie' | 'family') => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  media,
  items = [],
  onClose,
  onDelete,
  onSelectMedia,
  onReclassify,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Video playback states (for family videos in Google Photos)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(true);

  useEffect(() => {
    if (media) {
      setIsFavorited(media.isFavorite);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [media]);

  // Find index of current item for prev/next navigation
  const currentIndex = items.findIndex((i) => i.id === media?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < items.length - 1;

  const handlePrev = () => {
    if (hasPrev && onSelectMedia) {
      onSelectMedia(items[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectMedia) {
      onSelectMedia(items[currentIndex + 1]);
    }
  };

  useEffect(() => {
    if (!media) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;

      if (e.key === 'Escape') onClose();
      if (e.key === 'i' || e.key === 'I') setShowInfo((prev) => !prev);
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === ' ' && media.type === 'video') {
        e.preventDefault();
        toggleVideoPlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [media, onClose, hasPrev, hasNext, currentIndex]);

  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      void videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleFavorite = async () => {
    if (!media) return;
    const next = !isFavorited;
    setIsFavorited(next);
    try {
      await fetch(`/api/media/${media.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: next }),
      });
    } catch {
      // ignore
    }
  };

  const formatVideoTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!media) return null;

  const fullUrl = `/api/media/${media.id}/stream`;
  const isVideo = media.type === 'video';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 17, 21, 0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        color: '#ffffff',
        userSelect: 'none',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Google Photos Style Action Bar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 8px',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: '#ffffff',
              border: 'none',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Back / Close (Esc)"
          >
            <ChevronLeft size={24} />
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.98rem', fontWeight: 600, color: '#f1f1f1' }}>
                {media.title}
              </span>
              {media.isPrivate && (
                <span
                  style={{
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Lock size={10} /> VAULT MEMORY
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.76rem', color: '#9aa0a6', margin: '2px 0 0 0' }}>
              {new Date(media.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* Right Tools (Google Photos Standard Actions) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Star / Favorite */}
          <button
            onClick={toggleFavorite}
            style={{
              background: 'transparent',
              color: isFavorited ? '#fbbc04' : '#ffffff',
              border: 'none',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease, transform 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={19} fill={isFavorited ? '#fbbc04' : 'none'} />
          </button>

          {/* Reclassify: Move to Movies (if video) */}
          {isVideo && onReclassify && (
            <button
              onClick={() => {
                if (window.confirm('Move this family video into the Movies library?')) {
                  onReclassify(media.id, 'movie');
                  onClose();
                }
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '18px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 500,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
              title="Move this clip into the Movies & Shows player"
            >
              <Film size={14} />
              <span>Move to Movies</span>
            </button>
          )}

          {/* Info toggle */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            style={{
              background: showInfo ? 'rgba(138, 180, 248, 0.2)' : 'transparent',
              color: showInfo ? '#8ab4f8' : '#ffffff',
              border: 'none',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = showInfo ? 'rgba(138, 180, 248, 0.25)' : 'rgba(255, 255, 255, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = showInfo ? 'rgba(138, 180, 248, 0.2)' : 'transparent')}
            title="Info details (i)"
          >
            <Info size={19} />
          </button>

          {/* Download */}
          <a
            href={fullUrl}
            download={media.originalFilename}
            style={{
              background: 'transparent',
              color: '#ffffff',
              border: 'none',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Download original file"
          >
            <Download size={19} />
          </a>

          {/* Delete */}
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm('Delete this memory permanently?')) {
                  onDelete(media.id);
                  onClose();
                }
              }}
              style={{
                background: 'transparent',
                color: '#f87171',
                border: 'none',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.18)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              title="Delete memory"
            >
              <Trash2 size={19} />
            </button>
          )}
        </div>
      </div>

      {/* Main Stage (Photo or Family Video Player) */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '8px',
        }}
      >
        {/* Previous Navigation Arrow */}
        {hasPrev && (
          <button
            onClick={handlePrev}
            style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(32, 33, 36, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 30,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(60, 64, 67, 0.95)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(32, 33, 36, 0.8)')}
            title="Previous (Left Arrow)"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Next Navigation Arrow */}
        {hasNext && (
          <button
            onClick={handleNext}
            style={{
              position: 'absolute',
              right: showInfo ? '330px' : '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(32, 33, 36, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 30,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(60, 64, 67, 0.95)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(32, 33, 36, 0.8)')}
            title="Next (Right Arrow)"
          >
            <ChevronRight size={24} />
          </button>
        )}

        {/* Media Canvas */}
        <div
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {isVideo ? (
            /* Google Photos Clean Minimalist Video Player */
            <div
              style={{
                position: 'relative',
                maxHeight: '80vh',
                maxWidth: '90%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#000000',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)',
              }}
            >
              <video
                ref={videoRef}
                src={fullUrl}
                autoPlay
                playsInline
                loop={isLooping}
                onClick={toggleVideoPlay}
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
                    setIsPlaying(true);
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
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                style={{
                  maxHeight: '74vh',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  cursor: 'pointer',
                }}
              />

              {/* Clean Google Photos Player Controls Bar */}
              <div
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  backgroundColor: 'rgba(24, 24, 24, 0.95)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {/* Play / Pause */}
                <button
                  onClick={toggleVideoPlay}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {isPlaying ? <Pause size={18} fill="#ffffff" /> : <Play size={18} fill="#ffffff" />}
                </button>

                {/* Scrubber */}
                <div
                  onClick={(e) => {
                    if (!videoRef.current || !duration) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    videoRef.current.currentTime = pos * duration;
                  }}
                  style={{
                    flex: 1,
                    height: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                      backgroundColor: '#8ab4f8',
                      borderRadius: '2px',
                    }}
                  />
                </div>

                {/* Time */}
                <span style={{ fontSize: '0.78rem', color: '#bdc1c6', fontVariantNumeric: 'tabular-nums' }}>
                  {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
                </span>

                {/* Mute */}
                <button
                  onClick={() => {
                    if (!videoRef.current) return;
                    videoRef.current.muted = !videoRef.current.muted;
                    setIsMuted(videoRef.current.muted);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                </button>

                {/* Loop */}
                <button
                  onClick={() => setIsLooping(!isLooping)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isLooping ? '#8ab4f8' : '#888888',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={isLooping ? 'Looping enabled' : 'Looping disabled'}
                >
                  <Repeat size={17} />
                </button>
              </div>
            </div>
          ) : (
            /* Google Photos Image Viewer */
            <img
              src={fullUrl}
              alt={media.title}
              style={{
                maxWidth: '92%',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: '6px',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85)',
              }}
            />
          )}
        </div>

        {/* Google Photos Info Sidebar Drawer */}
        {showInfo && (
          <div
            style={{
              width: '310px',
              height: '100%',
              maxHeight: '82vh',
              backgroundColor: '#202124',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              color: '#ffffff',
              overflowY: 'auto',
              boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
              zIndex: 35,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.02rem', fontWeight: 600, margin: 0 }}>Info Details</h3>
              <button
                onClick={() => setShowInfo(false)}
                style={{ background: 'none', border: 'none', color: '#9aa0a6', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.84rem' }}>
              {/* Date */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: '#bdc1c6' }}>
                <Calendar size={18} color="#8ab4f8" />
                <div>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>Date & Time</div>
                  <div>{new Date(media.createdAt).toLocaleString()}</div>
                </div>
              </div>

              {/* Resolution / Dimensions */}
              {media.width && media.height ? (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: '#bdc1c6' }}>
                  <Maximize2 size={18} color="#8ab4f8" />
                  <div>
                    <div style={{ fontWeight: 600, color: '#ffffff' }}>Dimensions</div>
                    <div>
                      {media.width} × {media.height} px
                      {!isVideo && (
                        <span> ({((media.width * media.height) / 1000000).toFixed(1)} MP)</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Type */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: '#bdc1c6' }}>
                <Film size={18} color="#8ab4f8" />
                <div>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>Media Type</div>
                  <div>{isVideo ? 'Family Video Clip' : 'Photo Memory'}</div>
                </div>
              </div>

              {/* File Size */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: '#bdc1c6' }}>
                <HardDrive size={18} color="#8ab4f8" />
                <div>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>File Size</div>
                  <div>{(media.fileSize / (1024 * 1024)).toFixed(2)} MB</div>
                </div>
              </div>

              {/* Original Filename */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: '#bdc1c6' }}>
                <FileText size={18} color="#8ab4f8" />
                <div>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>File Name</div>
                  <div style={{ wordBreak: 'break-all' }}>{media.originalFilename}</div>
                </div>
              </div>

              {/* Storage & Encryption */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: '#bdc1c6' }}>
                <Shield size={18} color={media.isPrivate ? '#f59e0b' : '#34a853'} />
                <div>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>Storage Status</div>
                  <div>{media.isPrivate ? 'Encrypted Vault Storage' : 'Direct Local Storage'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subtle Bottom Item Count Indicator */}
      {items.length > 0 && (
        <div style={{ padding: '4px', fontSize: '0.78rem', color: '#9aa0a6' }}>
          {currentIndex + 1} of {items.length}
        </div>
      )}
    </div>
  );
};

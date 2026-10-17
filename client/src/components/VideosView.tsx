import React, { useState } from 'react';
import { Film, Play, Lock, Upload } from 'lucide-react';
import type { MediaItem } from '@media-hub/shared';

interface VideosViewProps {
  videos: MediaItem[];
  onSelectVideo: (video: MediaItem) => void;
  onOpenUpload: () => void;
}

export const VideosView: React.FC<VideosViewProps> = ({ videos, onSelectVideo, onOpenUpload }) => {
  const [selectedChip, setSelectedChip] = useState<'all' | '4k' | 'recent' | 'vault'>('all');

  const formatDuration = (seconds?: number | null): string => {
    if (!seconds || seconds <= 0) return '4K DIRECT';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredVideos = videos.filter((v) => {
    if (selectedChip === '4k') return v.width && v.width >= 1920;
    if (selectedChip === 'vault') return v.isPrivate;
    if (selectedChip === 'recent') {
      const dayAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return new Date(v.createdAt).getTime() > dayAgo;
    }
    return true;
  });

  if (videos.length === 0) {
    return (
      <div
        style={{
          background: '#0f0f0f',
          borderRadius: '16px',
          border: '1px solid #272727',
          padding: 'var(--space-12) var(--space-6)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255, 0, 0, 0.12)',
            border: '1px solid rgba(255, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--youtube-red)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <Film size={32} />
        </div>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', marginBottom: 'var(--space-2)' }}>
          No Videos in Library
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#aaaaaa', maxWidth: '420px', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
          Upload movies, shows, and clips. Direct 4K streaming plays instantly on your phone with zero CPU transcoding.
        </p>
        <button className="btn btn-youtube" onClick={onOpenUpload} style={{ padding: '0.8rem 1.8rem', fontSize: '0.95rem' }}>
          <Upload size={18} />
          <span>Upload Video</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* 1. YouTube-Style Filter Chips */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'none',
        }}
      >
        {[
          { id: 'all', label: 'All Videos' },
          { id: '4k', label: '4K Ultra HD' },
          { id: 'recent', label: 'Recently Added' },
          { id: 'vault', label: 'Vault Partition' },
        ].map((chip) => {
          const isActive = selectedChip === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setSelectedChip(chip.id as any)}
              style={{
                background: isActive ? '#ffffff' : '#272727',
                color: isActive ? '#0f0f0f' : '#f1f1f1',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 0.15s ease',
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* 2. YouTube-Style Video Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        {filteredVideos.map((video) => {
          const thumbUrl = `/api/media/${video.id}/thumbnail`;
          const hasProgress = video.playbackPosition && video.playbackPosition > 5;
          const progressPercent = video.duration && video.playbackPosition
            ? Math.min(100, Math.round((video.playbackPosition / video.duration) * 100))
            : (hasProgress ? 40 : 0);

          return (
            <div
              key={video.id}
              onClick={() => onSelectVideo(video)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                gap: '10px',
                userSelect: 'none',
              }}
            >
              {/* 16:9 Thumbnail Box */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16/9',
                  background: '#181818',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
                }}
              >
                <img
                  src={thumbUrl}
                  alt={video.title}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transition: 'transform 0.25s ease',
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />

                {/* Hover Play Button Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0';
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'rgba(0, 0, 0, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                    }}
                  >
                    <Play size={22} fill="#ffffff" style={{ marginLeft: '3px' }} />
                  </div>
                </div>

                {/* Top-Left Quality / Direct Stream Badge */}
                <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '4px' }}>
                  {video.isPrivate ? (
                    <span
                      style={{
                        background: 'rgba(245, 158, 11, 0.9)',
                        color: '#000000',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Lock size={10} /> VAULT
                    </span>
                  ) : (
                    <span
                      style={{
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(4px)',
                        color: '#ffffff',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      4K DIRECT
                    </span>
                  )}
                </div>

                {/* Bottom-Right Duration Pill (Classic YouTube) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    background: 'var(--youtube-badge)',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                  }}
                >
                  {formatDuration(video.duration)}
                </div>

                {/* YouTube Red Progress Bar along bottom of thumbnail */}
                {progressPercent > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '3.5px',
                      background: 'rgba(255, 255, 255, 0.25)',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${progressPercent}%`,
                        background: 'var(--youtube-red)',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Video Info Row below thumbnail (Classic YouTube Layout) */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                {/* Channel Avatar */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #272727 0%, #3f3f3f 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  {video.title.charAt(0).toUpperCase()}
                </div>

                {/* Title & Metadata */}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <h4
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      lineHeight: 1.3,
                      color: '#f1f1f1',
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={video.title}
                  >
                    {video.title}
                  </h4>

                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: '#aaaaaa',
                      marginTop: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>Vesper Direct</span>
                    <span>•</span>
                    <span>4K UHD</span>
                    <span>•</span>
                    <span>{new Date(video.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

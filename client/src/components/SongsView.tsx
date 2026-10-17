import React, { useState } from 'react';
import { Play, Pause, Lock, Upload, Search, Clock, Disc, Trash2, Volume2, Sparkles } from 'lucide-react';
import type { MediaItem } from '@media-hub/shared';

interface SongsViewProps {
  songs: MediaItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
  onSelectSong: (song: MediaItem) => void;
  onDeleteSong?: (id: string) => void;
  onTogglePlay?: () => void;
  onOpenUpload: () => void;
}

export const SongsView: React.FC<SongsViewProps> = ({
  songs,
  currentTrackId,
  isPlaying = false,
  onSelectSong,
  onDeleteSong,
  onTogglePlay,
  onOpenUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);

  const formatDuration = (seconds?: number | null): string => {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  const filteredSongs = songs.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      (s.originalFilename && s.originalFilename.toLowerCase().includes(q)) ||
      (s.fileExtension && s.fileExtension.toLowerCase().includes(q))
    );
  });

  const activeSong = songs.find((s) => s.id === currentTrackId) || (songs.length > 0 ? songs[0] : null);

  if (songs.length === 0) {
    return (
      <div
        style={{
          background: 'linear-gradient(180deg, #181818 0%, #121212 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
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
            background: 'rgba(30, 215, 96, 0.12)',
            border: '1px solid rgba(30, 215, 96, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--spotify-green)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <Disc size={32} />
        </div>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', marginBottom: 'var(--space-2)' }}>
          Your Music Sanctuary is Empty
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#b3b3b3', maxWidth: '420px', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
          Upload your favorite FLAC, MP3, AAC, and M4A audio files for offline, zero-transcode playback during train travel.
        </p>
        <button className="btn btn-spotify" onClick={onOpenUpload} style={{ padding: '0.8rem 1.8rem', fontSize: '0.95rem' }}>
          <Upload size={18} />
          <span>Upload Music</span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        color: '#ffffff',
      }}
    >
      {/* 1. Dynamic Spotify-Style Playing Banner / Hero Header */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Dynamic Blurred Ambient Backdrop from Song Thumbnail */}
        {activeSong && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(/api/media/${activeSong.id}/thumbnail)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: '#0f172a',
              filter: 'blur(45px) brightness(0.35) saturate(1.5)',
              transform: 'scale(1.25)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}

        {/* Ambient Dark Gradient Layer */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(18, 18, 18, 0.85) 0%, rgba(10, 10, 12, 0.94) 100%)',
            zIndex: 1,
          }}
        />

        {/* Banner Content Container */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'var(--space-6)',
            padding: 'var(--space-6)',
          }}
        >
          {/* Cover Art Box with Vinyl Disc Flare */}
          <div
            style={{
              width: '180px',
              height: '180px',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#181818',
              flexShrink: 0,
              boxShadow: isPlaying ? '0 16px 36px rgba(30, 215, 96, 0.28)' : '0 12px 32px rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'box-shadow 0.3s ease',
            }}
          >
            {/* Resilient Fallback Disc if thumbnail is missing or loading */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#64748b',
                gap: '8px',
                zIndex: 0,
              }}
            >
              <Disc size={56} color="var(--spotify-green)" />
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>
                AUDIO SANCTUARY
              </span>
            </div>

            {activeSong && (
              <img
                key={activeSong.id}
                src={`/api/media/${activeSong.id}/thumbnail`}
                alt={activeSong.title}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  zIndex: 1,
                  display: 'block',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            )}

            {/* Subtle Playing Vinyl Ring */}
            {isPlaying && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  border: '2px solid rgba(30, 215, 96, 0.5)',
                  borderRadius: '12px',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>

          {/* Header Metadata */}
          <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: isPlaying ? 'var(--spotify-green)' : '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {isPlaying ? (
                  <>
                    <Volume2 size={13} className="pulse" />
                    <span>NOW STREAMING</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>AUDIO SANCTUARY</span>
                  </>
                )}
              </span>

              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  background: 'rgba(30, 215, 96, 0.15)',
                  color: 'var(--spotify-green)',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  border: '1px solid rgba(30, 215, 96, 0.3)',
                }}
              >
                Hardware Direct (0% CPU)
              </span>

              {activeSong?.isPrivate && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Lock size={10} />
                  <span>Encrypted At Rest</span>
                </span>
              )}
            </div>

            <h1
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                margin: '2px 0',
                color: '#ffffff',
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              {activeSong ? activeSong.title : 'Your Music Library'}
            </h1>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: 0 }}>
              {activeSong?.originalFilename ? `${activeSong.originalFilename} • ` : ''}
              {activeSong?.fileExtension ? activeSong.fileExtension.toUpperCase() : 'HI-RES'}{' '}
              {activeSong?.fileSize ? `(${formatFileSize(activeSong.fileSize)})` : ''}
              {activeSong?.duration ? ` • ${formatDuration(activeSong.duration)}` : ''}
            </p>

            {/* Quick Play & Action Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
              <button
                className="btn btn-spotify"
                onClick={() => {
                  if (activeSong) {
                    if (currentTrackId === activeSong.id && onTogglePlay) {
                      onTogglePlay();
                    } else {
                      onSelectSong(activeSong);
                    }
                  } else if (filteredSongs.length > 0) {
                    onSelectSong(filteredSongs[0]);
                  }
                }}
                style={{
                  padding: '0.65rem 1.6rem',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                }}
                title={isPlaying ? 'Pause' : 'Play Song'}
              >
                {isPlaying && currentTrackId === activeSong?.id ? (
                  <>
                    <Pause size={18} fill="#000000" color="#000000" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play size={18} fill="#000000" color="#000000" />
                    <span>Play Song</span>
                  </>
                )}
              </button>

              <button
                className="btn btn-secondary"
                onClick={onOpenUpload}
                style={{ borderRadius: 'var(--radius-full)', padding: '0.6rem 1.2rem', fontSize: '0.82rem' }}
              >
                <Upload size={14} />
                <span>Add Audio</span>
              </button>

              {/* Delete Active Song Button */}
              {activeSong && onDeleteSong && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    if (window.confirm(`Permanently delete "${activeSong.title}" from your library?`)) {
                      onDeleteSong(activeSong.id);
                    }
                  }}
                  style={{
                    borderRadius: 'var(--radius-full)',
                    padding: '0.6rem 1rem',
                    fontSize: '0.82rem',
                    color: '#f87171',
                    gap: '5px',
                  }}
                  title="Delete this track"
                >
                  <Trash2 size={14} />
                  <span>Delete Song</span>
                </button>
              )}

              {/* In-view Search Filter */}
              <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '280px', marginLeft: 'auto' }}>
                <Search
                  size={14}
                  color="#888888"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  placeholder="Filter songs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 'var(--radius-full)',
                    padding: '7px 12px 7px 34px',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Spotify Track Table */}
      <div
        style={{
          background: '#121212',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          padding: 'var(--space-2)',
        }}
      >
        {/* Table Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '40px minmax(200px, 2fr) 90px 100px 70px 48px',
            padding: '10px 14px',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: '#b3b3b3',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            textTransform: 'uppercase',
            alignItems: 'center',
          }}
        >
          <span style={{ textAlign: 'center' }}>#</span>
          <span>Title</span>
          <span>Format</span>
          <span>Date</span>
          <span style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Clock size={14} />
          </span>
          <span style={{ textAlign: 'center' }}>Actions</span>
        </div>

        {/* Track Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
          {filteredSongs.map((song, index) => {
            const isCurrent = currentTrackId === song.id;
            const isHovered = hoveredTrackId === song.id;
            const thumbUrl = `/api/media/${song.id}/thumbnail`;

            return (
              <div
                key={song.id}
                onMouseEnter={() => setHoveredTrackId(song.id)}
                onMouseLeave={() => setHoveredTrackId(null)}
                onClick={() => onSelectSong(song)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px minmax(200px, 2fr) 90px 100px 70px 48px',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  alignItems: 'center',
                  background: isCurrent
                    ? 'rgba(30, 215, 96, 0.12)'
                    : isHovered
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                {/* Index / Play Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isHovered ? (
                    <Play size={15} fill={isCurrent ? 'var(--spotify-green)' : '#ffffff'} color={isCurrent ? 'var(--spotify-green)' : '#ffffff'} />
                  ) : isCurrent && isPlaying ? (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
                      <span style={{ width: '3px', height: '100%', background: 'var(--spotify-green)', borderRadius: '1px' }} />
                      <span style={{ width: '3px', height: '60%', background: 'var(--spotify-green)', borderRadius: '1px' }} />
                      <span style={{ width: '3px', height: '80%', background: 'var(--spotify-green)', borderRadius: '1px' }} />
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: isCurrent ? 'var(--spotify-green)' : '#a1a1a1', fontWeight: isCurrent ? 700 : 400 }}>
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Title & Album Art */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, paddingRight: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '6px',
                      background: '#1e293b',
                      overflow: 'hidden',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      position: 'relative',
                    }}
                  >
                    <Disc size={20} color="#64748b" style={{ position: 'absolute', zIndex: 0 }} />
                    <img
                      src={thumbUrl}
                      alt={song.title}
                      loading="lazy"
                      style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover', zIndex: 1, display: 'block' }}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>

                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 600,
                        color: isCurrent ? 'var(--spotify-green)' : '#ffffff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {song.title}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#b3b3b3',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {song.originalFilename || 'Local Offline Audio'}
                    </span>
                  </div>
                </div>

                {/* Format Pill */}
                <div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {song.fileExtension ? song.fileExtension.toUpperCase() : 'AUDIO'}
                  </span>
                </div>

                {/* Date Added */}
                <span style={{ fontSize: '0.78rem', color: '#888888' }}>
                  {new Date(song.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>

                {/* Duration & Vault Indicator */}
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                  {song.isPrivate && (
                    <span title="Vault Protected" style={{ color: 'var(--vault-primary)' }}>
                      <Lock size={12} />
                    </span>
                  )}
                  <span style={{ fontSize: '0.82rem', color: '#a1a1a1', fontFamily: 'monospace' }}>
                    {formatDuration(song.duration) !== '--:--' ? formatDuration(song.duration) : formatFileSize(song.fileSize)}
                  </span>
                </div>

                {/* Action Column: Delete Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {onDeleteSong && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Permanently delete "${song.title}" from your library?`)) {
                          onDeleteSong(song.id);
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isHovered ? '#ef4444' : '#64748b',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      title={`Delete "${song.title}"`}
                      aria-label={`Delete ${song.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


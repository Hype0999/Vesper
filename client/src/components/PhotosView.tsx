import React, { useState } from 'react';
import { Image as ImageIcon, Lock, Upload, Search } from 'lucide-react';
import type { MediaItem } from '@media-hub/shared';

interface PhotosViewProps {
  photos: MediaItem[];
  onSelectPhoto: (photo: MediaItem) => void;
  onOpenUpload: () => void;
}

export const PhotosView: React.FC<PhotosViewProps> = ({ photos, onSelectPhoto, onOpenUpload }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVault, setFilterVault] = useState(false);

  // Group photos by human-readable Date (Google Photos Timeline)
  const groupPhotosByDate = (items: MediaItem[]) => {
    const groups: { [key: string]: MediaItem[] } = {};
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toLocaleDateString();

    items.forEach((photo) => {
      const d = new Date(photo.createdAt);
      const dStr = d.toLocaleDateString();
      let label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

      if (dStr === todayStr) {
        label = 'Today';
      } else if (dStr === yesterdayStr) {
        label = 'Yesterday';
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(photo);
    });

    return groups;
  };

  const filteredPhotos = photos.filter((p) => {
    if (filterVault && !p.isPrivate) return false;
    if (!searchQuery.trim()) return true;
    return (
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.originalFilename && p.originalFilename.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const grouped = groupPhotosByDate(filteredPhotos);

  if (photos.length === 0) {
    return (
      <div
        style={{
          background: 'var(--gphotos-dark)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: 'var(--space-12) var(--space-4)',
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
            background: 'rgba(138, 180, 248, 0.12)',
            border: '1px solid rgba(138, 180, 248, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--gphotos-blue)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <ImageIcon size={32} />
        </div>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#ffffff', marginBottom: 'var(--space-1)' }}>
          No Photos in Your Gallery
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#9aa0a6', maxWidth: '400px', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
          Upload travel photos, wallpaper shots, and private memories. WebP thumbnails are automatically optimized with Sharp.
        </p>
        <button
          className="btn"
          onClick={onOpenUpload}
          style={{
            background: 'var(--gphotos-blue)',
            color: '#202124',
            fontWeight: 700,
            borderRadius: 'var(--radius-full)',
            padding: '0.75rem 1.8rem',
          }}
        >
          <Upload size={18} />
          <span>Upload Photos</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Google Photos Navigation & Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setFilterVault(false)}
            style={{
              background: !filterVault ? 'var(--gphotos-pill-hover)' : 'var(--gphotos-surface)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            All Photos ({photos.length})
          </button>
          <button
            onClick={() => setFilterVault(true)}
            style={{
              background: filterVault ? 'var(--vault-subtle)' : 'var(--gphotos-surface)',
              color: filterVault ? 'var(--vault-primary)' : '#9aa0a6',
              border: filterVault ? '1px solid var(--vault-border)' : 'none',
              borderRadius: 'var(--radius-full)',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Lock size={12} />
            Vault Only
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
          <Search size={15} color="#9aa0a6" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search photos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--gphotos-surface)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-full)',
              padding: '7px 12px 7px 34px',
              color: '#ffffff',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Google Photos Timeline Sections */}
      {Object.entries(grouped).map(([dateLabel, groupItems]) => (
        <div key={dateLabel} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Sticky-style Date Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 2px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8eaed' }}>
                {dateLabel}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#9aa0a6' }}>
                {groupItems.length} item{groupItems.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Grid Layout (Google Photos Density) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '6px',
            }}
          >
            {groupItems.map((photo) => {
              const thumbUrl = `/api/media/${photo.id}/thumbnail`;

              return (
                <div
                  key={photo.id}
                  onClick={() => onSelectPhoto(photo)}
                  style={{
                    position: 'relative',
                    aspectRatio: '1/1',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: 'var(--gphotos-surface)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    const overlay = e.currentTarget.querySelector('.photo-overlay') as HTMLElement;
                    if (overlay) overlay.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    const overlay = e.currentTarget.querySelector('.photo-overlay') as HTMLElement;
                    if (overlay) overlay.style.opacity = '0';
                  }}
                >
                  <img
                    src={thumbUrl}
                    alt={photo.title}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />

                  {/* Vault Lock Badge */}
                  {photo.isPrivate && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        background: 'rgba(245, 158, 11, 0.9)',
                        color: '#000000',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Lock size={10} /> Vault
                    </div>
                  )}

                  {/* Google Photos Subtle Gradient Overlay */}
                  <div
                    className="photo-overlay"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 60%)',
                      opacity: 0,
                      transition: 'opacity 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      padding: '8px',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        color: '#ffffff',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {photo.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

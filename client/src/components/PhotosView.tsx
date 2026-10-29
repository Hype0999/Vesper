import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Lock,
  Upload,
  Search,
  Circle,
  Trash2,
  Film,
  Sliders,
  X,
  Star,
  Check,
  Play,
} from 'lucide-react';
import type { MediaItem } from '@media-hub/shared';

interface PhotosViewProps {
  photos: MediaItem[]; // Note: this array contains both Photos and Family Videos (Memories)
  onSelectPhoto: (item: MediaItem) => void;
  onOpenUpload?: () => void;
  onDeleteMedia?: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
  onReclassify?: (id: string, newSubType: 'movie' | 'family') => void;
  canAccessVault?: boolean;
  canWrite?: boolean;
}

export const PhotosView: React.FC<PhotosViewProps> = ({
  photos,
  onSelectPhoto,
  onOpenUpload,
  onDeleteMedia,
  onBatchDelete,
  onReclassify,
  canAccessVault = true,
  canWrite = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'photos' | 'videos' | 'favorites' | 'vault'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showPathFilterModal, setShowPathFilterModal] = useState(false);

  // Group photos & family videos by human-readable Date (Google Photos Timeline)
  const groupMediaByDate = (items: MediaItem[]) => {
    const groups: { [key: string]: MediaItem[] } = {};
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toLocaleDateString();

    items.forEach((item) => {
      const d = new Date(item.createdAt);
      const dStr = d.toLocaleDateString();
      let label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

      if (dStr === todayStr) {
        label = 'Today';
      } else if (dStr === yesterdayStr) {
        label = 'Yesterday';
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });

    return groups;
  };

  const filteredItems = photos.filter((p) => {
    if (activeFilter === 'photos' && p.type !== 'photo') return false;
    if (activeFilter === 'videos' && p.type !== 'video') return false;
    if (activeFilter === 'favorites' && !p.isFavorite) return false;
    if (activeFilter === 'vault' && !p.isPrivate) return false;

    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(term) ||
      (p.originalFilename && p.originalFilename.toLowerCase().includes(term))
    );
  });

  const grouped = groupMediaByDate(filteredItems);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size > 0) {
        setIsSelectionMode(true);
      } else {
        setIsSelectionMode(false);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
      setIsSelectionMode(true);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Permanently delete ${selectedIds.size} selected item(s) from your memories?`)) {
      const idsArray = Array.from(selectedIds);
      if (onBatchDelete) {
        onBatchDelete(idsArray);
      } else if (onDeleteMedia) {
        for (const id of idsArray) {
          onDeleteMedia(id);
        }
      }
      clearSelection();
    }
  };

  const handleBatchMoveToMovies = async () => {
    const videoIds = filteredItems.filter((i) => selectedIds.has(i.id) && i.type === 'video').map((i) => i.id);
    if (videoIds.length === 0) {
      alert('None of the selected items are videos.');
      return;
    }
    if (window.confirm(`Move ${videoIds.length} video(s) to the Movies library?`)) {
      if (onReclassify) {
        for (const id of videoIds) {
          onReclassify(id, 'movie');
        }
      }
      clearSelection();
    }
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return '0:10';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (photos.length === 0) {
    return (
      <div
        style={{
          background: '#202124',
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
            color: '#8ab4f8',
            marginBottom: 'var(--space-4)',
          }}
        >
          <ImageIcon size={32} />
        </div>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#ffffff', marginBottom: 'var(--space-1)' }}>
          No Photos or Family Videos in Memories
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#9aa0a6', maxWidth: '440px', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
          {onOpenUpload
            ? 'Upload personal camera roll photos and family video clips. Phone videos and photos are automatically organized in Google Photos style.'
            : 'No personal photos or family video memories are currently available.'}
        </p>
        {onOpenUpload && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn"
              onClick={onOpenUpload}
              style={{
                background: '#8ab4f8',
                color: '#202124',
                fontWeight: 700,
                borderRadius: 'var(--radius-full)',
                padding: '0.75rem 1.8rem',
              }}
            >
              <Upload size={18} />
              <span>Upload Memories</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Sticky Google Photos Selection Bar (When items are selected) */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div
          style={{
            position: 'sticky',
            top: '12px',
            zIndex: 60,
            backgroundColor: '#1e293b',
            border: '1px solid rgba(138, 180, 248, 0.4)',
            borderRadius: '12px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={clearSelection}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
              title="Cancel selection"
            >
              <X size={20} />
            </button>
            <span style={{ fontSize: '0.96rem', fontWeight: 600, color: '#ffffff' }}>
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleSelectAll}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#8ab4f8',
                borderRadius: '14px',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {selectedIds.size === filteredItems.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Move to Movies button */}
            {onReclassify && (
              <button
                onClick={handleBatchMoveToMovies}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '16px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Move selected videos to Movies library"
              >
                <Film size={14} />
                <span>Move to Movies</span>
              </button>
            )}

            {/* Batch Delete button */}
            {onBatchDelete && (
              <button
                onClick={handleBatchDelete}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  borderRadius: '16px',
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={14} />
                <span>Delete ({selectedIds.size})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Google Photos Navigation, Filter Chips & Path Auto-filtration Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Google Photos Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All Memories (${photos.length})` },
            { id: 'photos', label: `Photos (${photos.filter((p) => p.type === 'photo').length})` },
            { id: 'videos', label: `Family Videos (${photos.filter((p) => p.type === 'video').length})` },
            { id: 'favorites', label: 'Favorites' },
            ...(canAccessVault ? [{ id: 'vault' as const, label: 'Vault Only', icon: Lock }] : []),
          ].map((chip) => {
            const isActive = activeFilter === chip.id;
            const Icon = (chip as any).icon;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id as any)}
                style={{
                  background: isActive ? '#3c4043' : '#202124',
                  color: isActive ? '#ffffff' : '#9aa0a6',
                  border: isActive ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '18px',
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'background 0.15s ease',
                }}
              >
                {Icon && <Icon size={12} />}
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Tools: Path Auto-filtration, Multi-Select Toggle, Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Path Auto-filtration Settings Pill (Only for write-enabled users) */}
          {canWrite && (
            <button
              onClick={() => setShowPathFilterModal(true)}
              style={{
                background: '#202124',
                color: '#8ab4f8',
                border: '1px solid rgba(138, 180, 248, 0.25)',
                borderRadius: '18px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Configure folder paths and automatic separation rules"
            >
            <Sliders size={13} />
            <span>Path & Auto-Filtration</span>
          </button>

          {/* Select Toggle */}
          <button
            onClick={() => {
              if (isSelectionMode) {
                clearSelection();
              } else {
                setIsSelectionMode(true);
              }
            }}
            style={{
              background: isSelectionMode ? '#8ab4f8' : '#202124',
              color: isSelectionMode ? '#202124' : '#9aa0a6',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '18px',
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isSelectionMode ? 'Cancel' : 'Select'}
          </button>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} color="#9aa0a6" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: '#202124',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '18px',
                padding: '6px 10px 6px 30px',
                color: '#ffffff',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            />
          </div>
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
              <span style={{ fontSize: '0.98rem', fontWeight: 600, color: '#e8eaed' }}>
                {dateLabel}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#9aa0a6' }}>
                {groupItems.length} item{groupItems.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Grid Layout (Google Photos Density & Aspect Ratio) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: '6px',
            }}
          >
            {groupItems.map((item) => {
              const thumbUrl = `/api/media/${item.id}/thumbnail`;
              const isSelected = selectedIds.has(item.id);
              const isVideo = item.type === 'video';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleSelect(item.id, {} as any);
                    } else {
                      onSelectPhoto(item);
                    }
                  }}
                  style={{
                    position: 'relative',
                    aspectRatio: '1/1',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: '#202124',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'transform 0.12s ease',
                    border: isSelected ? '3px solid #8ab4f8' : '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.transform = 'scale(1.02)';
                    const overlay = e.currentTarget.querySelector('.item-overlay') as HTMLElement;
                    if (overlay) overlay.style.opacity = '1';
                    const check = e.currentTarget.querySelector('.check-circle') as HTMLElement;
                    if (check) check.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.transform = 'scale(1)';
                    const overlay = e.currentTarget.querySelector('.item-overlay') as HTMLElement;
                    if (overlay) overlay.style.opacity = '0';
                    const check = e.currentTarget.querySelector('.check-circle') as HTMLElement;
                    if (check && !isSelected) check.style.opacity = '0';
                  }}
                >
                  {/* Thumbnail */}
                  <img
                    src={thumbUrl}
                    alt={item.title}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />

                  {/* Google Photos Selection Checkmark */}
                  <div
                    className="check-circle"
                    onClick={(e) => toggleSelect(item.id, e)}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? '#8ab4f8' : 'rgba(0, 0, 0, 0.5)',
                      color: isSelected ? '#202124' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isSelected || isSelectionMode ? 1 : 0,
                      transition: 'opacity 0.15s ease',
                      zIndex: 10,
                    }}
                  >
                    {isSelected ? <Check size={16} strokeWidth={3} /> : <Circle size={16} />}
                  </div>

                  {/* Video Badge with Duration (Google Photos Signature Video Indicator) */}
                  {isVideo && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(4px)',
                        color: '#ffffff',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontFamily: 'monospace',
                        zIndex: 5,
                      }}
                    >
                      <Play size={10} fill="#ffffff" />
                      <span>{formatDuration(item.duration)}</span>
                    </div>
                  )}

                  {/* Vault Lock Badge */}
                  {item.isPrivate && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: 'rgba(245, 158, 11, 0.9)',
                        color: '#000000',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        zIndex: 5,
                      }}
                    >
                      <Lock size={10} /> Vault
                    </div>
                  )}

                  {/* Favorite Star Badge */}
                  {item.isFavorite && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: item.isPrivate ? '60px' : '6px',
                        color: '#fbbc04',
                        zIndex: 5,
                      }}
                    >
                      <Star size={14} fill="#fbbc04" />
                    </div>
                  )}

                  {/* Google Photos Subtle Gradient Overlay */}
                  <div
                    className="item-overlay"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
                      opacity: 0,
                      transition: 'opacity 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      padding: '8px',
                      pointerEvents: 'none',
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
                      {item.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Path & Auto-Filtration Settings Modal */}
      {showPathFilterModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPathFilterModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#202124',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '24px',
              color: '#ffffff',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.9)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={20} color="#8ab4f8" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>
                  Path & Auto-Filtration Configuration
                </h3>
              </div>
              <button
                onClick={() => setShowPathFilterModal(false)}
                style={{ background: 'none', border: 'none', color: '#9aa0a6', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#bdc1c6', lineHeight: 1.5, marginBottom: '18px' }}>
              Your Vesper sanctuary automatically separates long movies from phone/family videos and photos.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.84rem' }}>
              {/* Rule 1: Movies vs Family */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ fontWeight: 600, color: '#8ab4f8', marginBottom: '4px' }}>
                  🎬 Movies & Cinema Library Path
                </div>
                <div style={{ color: '#aaaaaa' }}>
                  Targeted folders: <code>Movies/</code>, <code>Films/</code>, <code>Cinema/</code>, <code>Series/</code> or videos longer than 15 minutes.
                  Plays inside the dedicated YouTube-style Cinema Player.
                </div>
              </div>

              {/* Rule 2: Memories & Camera Roll */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ fontWeight: 600, color: '#8ab4f8', marginBottom: '4px' }}>
                  📷 Photos & Family Videos Path
                </div>
                <div style={{ color: '#aaaaaa' }}>
                  Targeted folders: <code>DCIM/</code>, <code>Camera/</code>, <code>Family/</code>, <code>WhatsApp/</code>, <code>Photos/</code>, or phone clips (under 15 mins).
                  Combined together in the chronological Google Photos timeline.
                </div>
              </div>

              {/* Ingestion Info */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(52, 168, 83, 0.1)',
                  borderRadius: '10px',
                  border: '1px solid rgba(52, 168, 83, 0.3)',
                  color: '#86efac',
                  fontSize: '0.82rem',
                }}
              >
                ✓ Automatic classification is active for all new uploads and drive scans. You can also reclassify any video anytime using the "Move to Movies" or "Move to Memories" button!
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setShowPathFilterModal(false)}
                className="btn"
                style={{
                  background: '#8ab4f8',
                  color: '#202124',
                  fontWeight: 600,
                  borderRadius: '20px',
                  padding: '8px 20px',
                }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

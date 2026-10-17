import React, { useEffect, useState } from 'react';
import { X, Lock, Trash2, Calendar, Download, Maximize2, Info, FileText, HardDrive, Shield } from 'lucide-react';
import type { MediaItem } from '@media-hub/shared';

interface PhotoLightboxModalProps {
  media: MediaItem | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({ media, onClose, onDelete }) => {
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!media) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'i' || e.key === 'I') setShowInfo((prev) => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [media, onClose]);

  if (!media) return null;

  const fullUrl = `/api/media/${media.id}/stream`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 17, 21, 0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Google Photos Style Action Bar */}
      <div
        style={{
          width: '100%',
          maxWidth: '1200px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-2) 0',
          marginBottom: 'var(--space-2)',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {media.isPrivate && (
            <span
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--vault-primary)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Lock size={12} /> VAULT MEMORY
            </span>
          )}
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f1f1f1' }}>{media.title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            onClick={() => setShowInfo(!showInfo)}
            style={{
              background: showInfo ? 'rgba(138, 180, 248, 0.2)' : 'transparent',
              color: showInfo ? 'var(--gphotos-blue)' : '#9aa0a6',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Toggle Info (i)"
          >
            <Info size={18} />
          </button>

          <a
            href={fullUrl}
            download={media.originalFilename}
            style={{
              background: 'transparent',
              color: '#9aa0a6',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
            title="Download full resolution"
          >
            <Download size={18} />
          </a>

          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm('Delete this photo permanently?')) {
                  onDelete(media.id);
                  onClose();
                }
              }}
              style={{
                background: 'transparent',
                color: '#f87171',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Delete photo"
            >
              <Trash2 size={18} />
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: '#9aa0a6',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Stage + Optional Side Info Drawer */}
      <div
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '1200px',
          display: 'flex',
          gap: 'var(--space-4)',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Photo Canvas */}
        <div
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src={fullUrl}
            alt={media.title}
            style={{
              maxWidth: '100%',
              maxHeight: '78vh',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.8)',
            }}
          />
        </div>

        {/* Google Photos Info Drawer */}
        {showInfo && (
          <div
            style={{
              width: '300px',
              height: '100%',
              maxHeight: '78vh',
              background: '#202124',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              color: '#ffffff',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Info Details</h3>
              <button
                onClick={() => setShowInfo(false)}
                style={{ background: 'none', border: 'none', color: '#9aa0a6', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#bdc1c6' }}>
                <Calendar size={16} color="var(--gphotos-blue)" />
                <div>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>Date Captured</div>
                  <div>{new Date(media.createdAt).toLocaleString()}</div>
                </div>
              </div>

              {media.width && media.height && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#bdc1c6' }}>
                  <Maximize2 size={16} color="var(--gphotos-blue)" />
                  <div>
                    <div style={{ fontWeight: 600, color: '#ffffff' }}>Dimensions</div>
                    <div>{media.width} × {media.height} px ({( (media.width * media.height) / 1000000 ).toFixed(1)} MP)</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#bdc1c6' }}>
                <HardDrive size={16} color="var(--gphotos-blue)" />
                <div>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>File Size</div>
                  <div>{(media.fileSize / (1024 * 1024)).toFixed(2)} MB</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#bdc1c6' }}>
                <FileText size={16} color="var(--gphotos-blue)" />
                <div>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>Original File</div>
                  <div style={{ wordBreak: 'break-all' }}>{media.originalFilename}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#bdc1c6' }}>
                <Shield size={16} color={media.isPrivate ? 'var(--vault-primary)' : 'var(--accent-success)'} />
                <div>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>Storage Status</div>
                  <div>{media.isPrivate ? 'Encrypted Vault Storage' : 'Direct Local Storage'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

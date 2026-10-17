import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { Lock, ShieldAlert, Film, Image as ImageIcon, FileText, KeyRound, Upload, Music } from 'lucide-react';
import { VideosView } from './VideosView';
import { PhotosView } from './PhotosView';
import { SongsView } from './SongsView';
import { NotesView } from './NotesView';
import type { MediaItem, NoteItem } from '@media-hub/shared';

interface VaultViewProps {
  media: MediaItem[];
  notes: NoteItem[];
  onSelectVideo: (video: MediaItem) => void;
  onSelectPhoto: (photo: MediaItem) => void;
  onSelectSong?: (song: MediaItem) => void;
  onDeleteSong?: (id: string) => void;
  currentTrackId?: string;
  isPlayingAudio?: boolean;
  onSelectNote: (note: NoteItem) => void;
  onOpenUpload: () => void;
  onOpenNewNote: () => void;
}

export const VaultView: React.FC<VaultViewProps> = ({
  media,
  notes,
  onSelectVideo,
  onSelectPhoto,
  onSelectSong,
  onDeleteSong,
  currentTrackId,
  isPlayingAudio,
  onSelectNote,
  onOpenUpload,
  onOpenNewNote,
}) => {
  const { isUnlocked, openUnlockModal, lockVault, isLoading } = useVault();
  const [subTab, setSubTab] = useState<'all' | 'videos' | 'songs' | 'photos' | 'notes'>('all');

  const privateVideos = media.filter((m) => m.isPrivate && m.type === 'video');
  const privateSongs = media.filter((m) => m.isPrivate && m.type === 'audio');
  const privatePhotos = media.filter((m) => m.isPrivate && m.type === 'photo');
  const privateNotes = notes.filter((n) => n.isPrivate);

  if (!isUnlocked) {
    return (
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-12) var(--space-4)',
          textAlign: 'center',
          maxWidth: '520px',
          margin: 'var(--space-8) auto',
          border: '1px solid var(--vault-border)',
          background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, rgba(16, 17, 20, 0.95) 100%)',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--vault-subtle)',
            border: '1px solid var(--vault-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--vault-primary)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <Lock size={32} />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
          Private Vault is Locked
        </h3>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: 'var(--space-6)', maxWidth: '380px' }}>
          This area contains your private media and encrypted notes. Two-tier step-up authorization with your dedicated passphrase is required to enter.
        </p>

        <button
          className="btn btn-primary"
          onClick={openUnlockModal}
          style={{
            background: 'var(--vault-primary)',
            color: '#000000',
            borderColor: 'var(--vault-primary)',
            fontWeight: 600,
            padding: '0.65rem 1.4rem',
          }}
        >
          <KeyRound size={16} />
          <span>Unlock Private Vault</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Vault Status Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--vault-subtle)',
          border: '1px solid var(--vault-border)',
          borderRadius: 'var(--radius-md)',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--vault-primary)',
            }}
          >
            <Lock size={16} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--vault-primary)', margin: 0 }}>
              Private Vault Partition
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              {privateVideos.length} Videos • {privateSongs.length} Songs • {privatePhotos.length} Photos • {privateNotes.length} Notes (Isolated from public feed)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className="btn btn-secondary"
            onClick={onOpenUpload}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
          >
            <Upload size={13} />
            <span>Add to Vault</span>
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => void lockVault()}
            disabled={isLoading}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', color: 'var(--vault-primary)' }}
          >
            <ShieldAlert size={13} />
            <span>Lock Now</span>
          </button>
        </div>
      </div>

      {/* Vault Sub-tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button
          className={`btn ${subTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setSubTab('all')}
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
        >
          All Vault Items
        </button>
        <button
          className={`btn ${subTab === 'videos' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setSubTab('videos')}
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
        >
          <Film size={13} />
          <span>Videos ({privateVideos.length})</span>
        </button>
        <button
          className={`btn ${subTab === 'songs' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setSubTab('songs')}
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
        >
          <Music size={13} />
          <span>Songs ({privateSongs.length})</span>
        </button>
        <button
          className={`btn ${subTab === 'photos' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setSubTab('photos')}
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
        >
          <ImageIcon size={13} />
          <span>Photos ({privatePhotos.length})</span>
        </button>
        <button
          className={`btn ${subTab === 'notes' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setSubTab('notes')}
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
        >
          <FileText size={13} />
          <span>Notes ({privateNotes.length})</span>
        </button>
      </div>

      {/* Content Rendering */}
      {subTab === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {privateVideos.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                Private Videos
              </h4>
              <VideosView videos={privateVideos} onSelectVideo={onSelectVideo} onOpenUpload={onOpenUpload} />
            </div>
          )}

          {privateSongs.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                Private Music & Audio
              </h4>
              <SongsView
                songs={privateSongs}
                currentTrackId={currentTrackId}
                isPlaying={isPlayingAudio}
                onSelectSong={(s) => onSelectSong?.(s)}
                onDeleteSong={onDeleteSong}
                onOpenUpload={onOpenUpload}
              />
            </div>
          )}

          {privatePhotos.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                Private Photos
              </h4>
              <PhotosView photos={privatePhotos} onSelectPhoto={onSelectPhoto} onOpenUpload={onOpenUpload} />
            </div>
          )}

          {privateNotes.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                Private Encrypted Notes
              </h4>
              <NotesView notes={privateNotes} onSelectNote={onSelectNote} onOpenNewNote={onOpenNewNote} />
            </div>
          )}

          {privateVideos.length === 0 && privateSongs.length === 0 && privatePhotos.length === 0 && privateNotes.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Your private vault is currently empty. Check "Mark as Private" when uploading or creating notes to store items here.
              </p>
            </div>
          )}
        </div>
      )}

      {subTab === 'videos' && (
        <VideosView videos={privateVideos} onSelectVideo={onSelectVideo} onOpenUpload={onOpenUpload} />
      )}

      {subTab === 'songs' && (
        <SongsView
          songs={privateSongs}
          currentTrackId={currentTrackId}
          isPlaying={isPlayingAudio}
          onSelectSong={(s) => onSelectSong?.(s)}
          onDeleteSong={onDeleteSong}
          onOpenUpload={onOpenUpload}
        />
      )}

      {subTab === 'photos' && (
        <PhotosView photos={privatePhotos} onSelectPhoto={onSelectPhoto} onOpenUpload={onOpenUpload} />
      )}

      {subTab === 'notes' && (
        <NotesView notes={privateNotes} onSelectNote={onSelectNote} onOpenNewNote={onOpenNewNote} />
      )}
    </div>
  );
};

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import { TopLoadingBar } from '../components/TopLoadingBar';
import { SkeletonGrid } from '../components/SkeletonGrid';
import { VaultBanner } from '../components/VaultBanner';
import { VaultModal } from '../components/VaultModal';
import { UploadModal } from '../components/UploadModal';
import { NoteEditorModal } from '../components/NoteEditorModal';
import { VideoPlayerModal } from '../components/VideoPlayerModal';
import { PhotoLightboxModal } from '../components/PhotoLightboxModal';
import { VideosView } from '../components/VideosView';
import { PhotosView } from '../components/PhotosView';
import { SongsView } from '../components/SongsView';
import { NotesView } from '../components/NotesView';
import { VaultView } from '../components/VaultView';
import { FactoryResetModal } from '../components/FactoryResetModal';
import { AudioPlayerBar } from '../components/AudioPlayerBar';
import { NetworkSettingsModal } from '../components/NetworkSettingsModal';
import { UsersModal } from '../components/UsersModal';
import { HardwareGuardianModal } from '../components/HardwareGuardianModal';
import { AdminCommandCenterModal } from '../components/AdminCommandCenterModal';
import { VesperLogo } from '../components/VesperLogo';
import { MobileBottomNav } from '../components/MobileBottomNav';
import {
  LogOut,
  Lock,
  Unlock,
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  Upload,
  Plus,
  Search,
  X,
  RefreshCw,
  FolderPlus,
  Trash2,
  Wifi,
  Users,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';
import type { MediaItem, NoteItem, Category } from '@media-hub/shared';

type ActiveTab = 'videos' | 'songs' | 'photos' | 'notes' | 'vault';

export function DashboardPage() {
  const { user, appName, logout } = useAuth();
  const { isUnlocked, openUnlockModal, lockVault, isLoading: isVaultLoading } = useVault();

  const [activeTab, setActiveTab] = useState<ActiveTab>('videos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);

  // Media & Notes state
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [notesList, setNotesList] = useState<NoteItem[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(true);

  // Modals & Player state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState<boolean>(false);
  const [isFactoryResetOpen, setIsFactoryResetOpen] = useState<boolean>(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState<boolean>(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState<boolean>(false);
  const [isHardwareGuardianOpen, setIsHardwareGuardianOpen] = useState<boolean>(false);
  const [isAdminStationOpen, setIsAdminStationOpen] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [playingVideo, setPlayingVideo] = useState<MediaItem | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<MediaItem | null>(null);
  const [playingAudio, setPlayingAudio] = useState<MediaItem | null>(null);

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setCategories(json.data.categories);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch Media
  const fetchMedia = useCallback(async () => {
    try {
      let url = '/api/media?';
      if (selectedCategory) url += `categoryId=${encodeURIComponent(selectedCategory)}&`;
      if (searchQuery.trim()) url += `search=${encodeURIComponent(searchQuery.trim())}&`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setMediaList(json.data.media);
      }
    } catch { /* ignore */ }
  }, [selectedCategory, searchQuery]);

  // Fetch Notes
  const fetchNotes = useCallback(async () => {
    try {
      let url = '/api/notes?';
      if (selectedCategory) url += `categoryId=${encodeURIComponent(selectedCategory)}&`;
      if (searchQuery.trim()) url += `search=${encodeURIComponent(searchQuery.trim())}&`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setNotesList(json.data.notes);
      }
    } catch { /* ignore */ }
  }, [selectedCategory, searchQuery]);

  // Load content
  const reloadAll = useCallback(async () => {
    setIsLoadingContent(true);
    await Promise.all([fetchCategories(), fetchMedia(), fetchNotes()]);
    setIsLoadingContent(false);
  }, [fetchCategories, fetchMedia, fetchNotes]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll, isUnlocked]);

  // Normal public items
  const normalVideos = mediaList.filter((m) => !m.isPrivate && m.type === 'video');
  const normalSongs = mediaList.filter((m) => !m.isPrivate && m.type === 'audio');
  const normalPhotos = mediaList.filter((m) => !m.isPrivate && m.type === 'photo');
  const normalNotes = notesList.filter((n) => !n.isPrivate);

  // Private vault items
  const privateVideos = mediaList.filter((m) => m.isPrivate && m.type === 'video');
  const privateSongs = mediaList.filter((m) => m.isPrivate && m.type === 'audio');
  const privatePhotos = mediaList.filter((m) => m.isPrivate && m.type === 'photo');
  const privateNotes = notesList.filter((n) => n.isPrivate);
  const totalVaultItems = privateVideos.length + privateSongs.length + privatePhotos.length + privateNotes.length;

  // Handlers
  const handleDeleteMedia = async (id: string) => {
    try {
      const res = await fetch(`/api/media/${id}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (res.ok) {
        setMediaList((prev) => prev.filter((m) => m.id !== id));
      }
    } catch { /* ignore */ }
  };

  const handleCreateCategory = async () => {
    const name = window.prompt('Enter new category name:');
    if (!name || !name.trim()) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setCategories((prev) => [...prev, json.data.category]);
        }
      }
    } catch { /* ignore */ }
  };

  // Check if any modal or viewer is open
  const isAnyModalOpen = Boolean(
    playingVideo ||
    viewingPhoto ||
    isUploadOpen ||
    isNoteEditorOpen ||
    isFactoryResetOpen ||
    isNetworkModalOpen ||
    isUsersModalOpen ||
    isHardwareGuardianOpen ||
    isAdminStationOpen
  );

  // Mobile Back Button Navigation Guard:
  // When an active modal/player opens, push history state so back gesture dismisses the modal
  // instead of closing the entire web sanctuary!
  useEffect(() => {
    if (isAnyModalOpen) {
      window.history.pushState({ vesperModalOpen: true }, '');

      const handlePopState = () => {
        if (playingVideo) setPlayingVideo(null);
        else if (viewingPhoto) setViewingPhoto(null);
        else if (isUploadOpen) setIsUploadOpen(false);
        else if (isNoteEditorOpen) {
          setIsNoteEditorOpen(false);
          setEditingNote(null);
        }
        else if (isNetworkModalOpen) setIsNetworkModalOpen(false);
        else if (isUsersModalOpen) setIsUsersModalOpen(false);
        else if (isHardwareGuardianOpen) setIsHardwareGuardianOpen(false);
        else if (isAdminStationOpen) setIsAdminStationOpen(false);
        else if (isFactoryResetOpen) setIsFactoryResetOpen(false);
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [
    isAnyModalOpen,
    playingVideo,
    viewingPhoto,
    isUploadOpen,
    isNoteEditorOpen,
    isNetworkModalOpen,
    isUsersModalOpen,
    isHardwareGuardianOpen,
    isAdminStationOpen,
    isFactoryResetOpen,
  ]);

  return (
    <div className="app-container" style={{ maxWidth: '1320px' }}>
      {/* YouTube-style Top Progress Loading Bar */}
      <TopLoadingBar isLoading={isLoadingContent} />

      {/* Modals */}
      <VaultModal />
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => void fetchMedia()}
        categories={categories}
        onCategoryCreated={(newCat) => setCategories((prev) => [...prev, newCat])}
      />
      <NoteEditorModal
        isOpen={isNoteEditorOpen}
        onClose={() => {
          setIsNoteEditorOpen(false);
          setEditingNote(null);
        }}
        onSaveSuccess={() => void fetchNotes()}
        categories={categories}
        editingNote={editingNote}
      />
      <VideoPlayerModal
        media={playingVideo}
        allVideos={activeTab === 'vault' ? privateVideos : normalVideos}
        onClose={() => setPlayingVideo(null)}
        onDelete={handleDeleteMedia}
        onSelectRelatedVideo={(v) => setPlayingVideo(v)}
      />
      <PhotoLightboxModal
        media={viewingPhoto}
        onClose={() => setViewingPhoto(null)}
        onDelete={handleDeleteMedia}
      />
      <FactoryResetModal
        isOpen={isFactoryResetOpen}
        onClose={() => setIsFactoryResetOpen(false)}
      />
      <NetworkSettingsModal
        isOpen={isNetworkModalOpen}
        onClose={() => setIsNetworkModalOpen(false)}
      />
      <UsersModal
        isOpen={isUsersModalOpen}
        onClose={() => setIsUsersModalOpen(false)}
        currentUserId={user?.id}
      />
      <HardwareGuardianModal
        isOpen={isHardwareGuardianOpen}
        onClose={() => setIsHardwareGuardianOpen(false)}
      />
      <AdminCommandCenterModal
        isOpen={isAdminStationOpen}
        onClose={() => setIsAdminStationOpen(false)}
        categories={categories}
        onMediaIngested={() => {
          void fetchMedia();
          void fetchNotes();
        }}
      />
      <AudioPlayerBar
        currentTrack={playingAudio}
        playlist={activeTab === 'vault' ? privateSongs : normalSongs}
        onTrackChange={(t) => setPlayingAudio(t)}
        onClosePlayer={() => setPlayingAudio(null)}
      />

      {/* Main App Navigation Header (YouTube / Modern Aesthetic) */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}
      >
        {/* Vesper Brand Logo */}
        <VesperLogo
          size="md"
          showText={true}
          subtitle={appName && appName !== 'Nest' ? appName : 'Media Sanctuary'}
        />

        {/* Global Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-full)',
            padding: '0.45rem 1rem',
            width: '100%',
            maxWidth: '380px',
            gap: 'var(--space-2)',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.4)',
            transition: 'all 0.2s ease',
          }}
        >
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search videos, songs, notes..."
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {/* Upload Button */}
          <button
            className="btn btn-brand"
            onClick={() => setIsUploadOpen(true)}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.84rem',
            }}
          >
            <Upload size={15} />
            <span>Upload</span>
          </button>

          {/* New Note Button */}
          <button
            className="btn btn-secondary"
            onClick={() => {
              setEditingNote(null);
              setIsNoteEditorOpen(true);
            }}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
          >
            <Plus size={15} />
            <span>Note</span>
          </button>

          {/* Vault Status Indicator / Toggle */}
          {isUnlocked ? (
            <button
              className="btn btn-ghost"
              onClick={() => void lockVault()}
              disabled={isVaultLoading}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                borderColor: 'var(--vault-border)',
                background: 'var(--vault-subtle)',
                color: 'var(--vault-primary)',
              }}
              title="Click to lock private vault"
            >
              <Unlock size={14} />
              <span>Vault Unlocked</span>
            </button>
          ) : (
            <button
              className="btn btn-ghost"
              onClick={openUnlockModal}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
              title="Unlock private vault"
            >
              <Lock size={14} />
              <span>Unlock Vault</span>
            </button>
          )}

          {/* Wi-Fi & Hotspot Modal Toggle */}
          <button
            className="btn btn-ghost"
            onClick={() => setIsNetworkModalOpen(true)}
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Wi-Fi, Pi Hotspot & Mobile Link QR"
          >
            <Wifi size={15} style={{ color: '#22c55e' }} />
            <span>Wi-Fi & Phone</span>
          </button>

          {/* Multi-User Companion Management */}
          <button
            className="btn btn-ghost"
            onClick={() => setIsUsersModalOpen(true)}
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Companion Users & Permissions"
          >
            <Users size={15} />
            <span>Companions</span>
          </button>

          {/* Hardware Guardian & Thermal Protection */}
          <button
            className="btn btn-ghost"
            onClick={() => setIsHardwareGuardianOpen(true)}
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Hardware Guardian & Thermal Protection"
          >
            <ShieldCheck size={15} style={{ color: '#10b981' }} />
            <span>Guardian</span>
          </button>

          {/* Secret Admin Command Station (Only visible to admin) */}
          {(user?.role === 'admin' || !user?.role) && (
            <button
              className="btn btn-ghost"
              onClick={() => setIsAdminStationOpen(true)}
              style={{
                padding: '0.45rem 0.75rem',
                fontSize: '0.82rem',
                color: '#c084fc',
                border: '1px solid rgba(192, 132, 252, 0.35)',
                background: 'rgba(139, 92, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 0 10px rgba(139, 92, 246, 0.15)',
              }}
              title="Secret Admin Station: Pendrive Linker, Media Ingestion & Hardware Telemetry"
            >
              <HardDrive size={15} style={{ color: '#c084fc' }} />
              <span>Admin Station</span>
            </button>
          )}

          {/* User badge */}
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {user?.username}
          </div>

          {/* Factory Hard Reset Button */}
          <button
            className="btn btn-ghost"
            onClick={() => setIsFactoryResetOpen(true)}
            style={{ padding: '0.45rem', color: 'rgba(239, 68, 68, 0.7)' }}
            title="Factory Hard Reset (Wipe all media & data)"
          >
            <Trash2 size={16} />
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => void logout()}
            style={{ padding: '0.45rem', color: 'var(--text-muted)' }}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Amber Active Vault Banner */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <VaultBanner />
      </div>

      {/* Tabs & Category Filter Sub-Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-5)',
        }}
      >
        {/* Main Navigation Tabs (Desktop) */}
        <div className="hide-on-mobile" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'videos' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('videos')}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.95rem' }}
          >
            <Film size={15} />
            <span>Videos</span>
            <span
              style={{
                background: activeTab === 'videos' ? '#000000' : 'var(--bg-surface-elevated)',
                color: activeTab === 'videos' ? '#ffffff' : 'var(--text-muted)',
                borderRadius: 'var(--radius-full)',
                padding: '1px 6px',
                fontSize: '0.7rem',
                marginLeft: '4px',
              }}
            >
              {normalVideos.length}
            </span>
          </button>

          <button
            className={`btn ${activeTab === 'songs' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('songs')}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.95rem' }}
          >
            <Music size={15} />
            <span>Songs</span>
            <span
              style={{
                background: activeTab === 'songs' ? '#000000' : 'var(--bg-surface-elevated)',
                color: activeTab === 'songs' ? '#ffffff' : 'var(--text-muted)',
                borderRadius: 'var(--radius-full)',
                padding: '1px 6px',
                fontSize: '0.7rem',
                marginLeft: '4px',
              }}
            >
              {normalSongs.length}
            </span>
          </button>

          <button
            className={`btn ${activeTab === 'photos' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('photos')}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.95rem' }}
          >
            <ImageIcon size={15} />
            <span>Photos</span>
            <span
              style={{
                background: activeTab === 'photos' ? '#000000' : 'var(--bg-surface-elevated)',
                color: activeTab === 'photos' ? '#ffffff' : 'var(--text-muted)',
                borderRadius: 'var(--radius-full)',
                padding: '1px 6px',
                fontSize: '0.7rem',
                marginLeft: '4px',
              }}
            >
              {normalPhotos.length}
            </span>
          </button>

          <button
            className={`btn ${activeTab === 'notes' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('notes')}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.95rem' }}
          >
            <FileText size={15} />
            <span>Notes</span>
            <span
              style={{
                background: activeTab === 'notes' ? '#000000' : 'var(--bg-surface-elevated)',
                color: activeTab === 'notes' ? '#ffffff' : 'var(--text-muted)',
                borderRadius: 'var(--radius-full)',
                padding: '1px 6px',
                fontSize: '0.7rem',
                marginLeft: '4px',
              }}
            >
              {normalNotes.length}
            </span>
          </button>

          {/* Dedicated Private Vault Tab */}
          <button
            className={`btn ${activeTab === 'vault' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('vault')}
            style={{
              fontSize: '0.85rem',
              padding: '0.45rem 0.95rem',
              borderColor: activeTab === 'vault' ? 'var(--vault-primary)' : 'var(--vault-border)',
              background: activeTab === 'vault' ? 'var(--vault-primary)' : 'var(--vault-subtle)',
              color: activeTab === 'vault' ? '#000000' : 'var(--vault-primary)',
            }}
          >
            {isUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
            <span>Private Vault</span>
            {isUnlocked && (
              <span
                style={{
                  background: activeTab === 'vault' ? '#000000' : 'rgba(245, 158, 11, 0.25)',
                  color: activeTab === 'vault' ? 'var(--vault-primary)' : 'var(--vault-primary)',
                  borderRadius: 'var(--radius-full)',
                  padding: '1px 6px',
                  fontSize: '0.7rem',
                  marginLeft: '4px',
                }}
              >
                {totalVaultItems}
              </span>
            )}
          </button>
        </div>

        {/* Category Filter Chips */}
        {activeTab !== 'vault' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedCategory('')}
              style={{
                background: !selectedCategory ? 'var(--text-primary)' : 'var(--bg-surface)',
                color: !selectedCategory ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
                style={{
                  background: selectedCategory === cat.id ? 'var(--text-primary)' : 'var(--bg-surface)',
                  color: selectedCategory === cat.id ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-default)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                {cat.name}
              </button>
            ))}
            <button
              onClick={() => void handleCreateCategory()}
              style={{
                background: 'transparent',
                border: '1px dashed var(--border-strong)',
                color: 'var(--text-muted)',
                padding: '0.25rem 0.55rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
              title="Create new category"
            >
              <FolderPlus size={12} />
              <span>Category</span>
            </button>
            <button
              onClick={() => void reloadAll()}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
              }}
              title="Refresh feed"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main style={{ minHeight: '420px' }}>
        {isLoadingContent ? (
          <SkeletonGrid count={6} />
        ) : (
          <>
            {activeTab === 'videos' && (
              <VideosView
                videos={normalVideos}
                onSelectVideo={(v) => setPlayingVideo(v)}
                onOpenUpload={() => setIsUploadOpen(true)}
              />
            )}
            {activeTab === 'songs' && (
              <SongsView
                songs={normalSongs}
                currentTrackId={playingAudio?.id}
                isPlaying={!!playingAudio}
                onSelectSong={(s) => setPlayingAudio(s)}
                onDeleteSong={handleDeleteMedia}
                onTogglePlay={() => {
                  if (playingAudio) {
                    setPlayingAudio(null);
                  } else if (normalSongs.length > 0) {
                    setPlayingAudio(normalSongs[0]);
                  }
                }}
                onOpenUpload={() => setIsUploadOpen(true)}
              />
            )}
            {activeTab === 'photos' && (
              <PhotosView
                photos={normalPhotos}
                onSelectPhoto={(p) => setViewingPhoto(p)}
                onOpenUpload={() => setIsUploadOpen(true)}
              />
            )}
            {activeTab === 'notes' && (
              <NotesView
                notes={normalNotes}
                onSelectNote={(n) => {
                  setEditingNote(n);
                  setIsNoteEditorOpen(true);
                }}
                onOpenNewNote={() => {
                  setEditingNote(null);
                  setIsNoteEditorOpen(true);
                }}
              />
            )}
            {activeTab === 'vault' && (
              <VaultView
                media={mediaList}
                notes={notesList}
                onSelectVideo={(v) => setPlayingVideo(v)}
                onSelectSong={(s) => setPlayingAudio(s)}
                onDeleteSong={handleDeleteMedia}
                currentTrackId={playingAudio?.id}
                isPlayingAudio={!!playingAudio}
                onSelectPhoto={(p) => setViewingPhoto(p)}
                onSelectNote={(n) => {
                  setEditingNote(n);
                  setIsNoteEditorOpen(true);
                }}
                onOpenUpload={() => setIsUploadOpen(true)}
                onOpenNewNote={() => {
                  setEditingNote(null);
                  setIsNoteEditorOpen(true);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Production Footer */}
      <footer style={{ marginTop: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', paddingBottom: 'var(--space-4)' }}>
        VESPER • Personal Media Sanctuary • Crafted with care by Kartikeya Saini
      </footer>

      {/* Mobile Bottom Thumb Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t)}
        videoCount={normalVideos.length}
        songCount={normalSongs.length}
        photoCount={normalPhotos.length}
        noteCount={normalNotes.length}
        vaultCount={totalVaultItems}
        isVaultUnlocked={isUnlocked}
        onOpenVaultModal={openUnlockModal}
      />
    </div>
  );
}

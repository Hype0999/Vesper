import React, { useState, useRef, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import {
  Upload,
  X,
  Film,
  Image as ImageIcon,
  Music,
  Lock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Check,
  Trash2,
} from 'lucide-react';
import type { Category, ApiResponse, MediaItem } from '@media-hub/shared';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (media: MediaItem) => void;
  categories: Category[];
  onCategoryCreated?: (newCategory: Category) => void;
}

interface QueuedFile {
  file: File;
  id: string;
  title: string;
  type: 'video' | 'audio' | 'photo';
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  bytesLoaded?: number;
  totalBytes?: number;
  speed?: string;
  statusText?: string;
  errorMessage?: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  categories,
  onCategoryCreated,
}) => {
  const { isUnlocked, unlockVault } = useVault();
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
  const [destination, setDestination] = useState<'auto' | 'movie' | 'family'>('auto');
  const [categoryId, setCategoryId] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [vaultPassphrase, setVaultPassphrase] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Inline Category creation
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [isSavingCategory, setIsSavingCategory] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setFileQueue([]);
      setDestination('auto');
      setCategoryId('');
      setIsPrivate(false);
      setVaultPassphrase('');
      setTags('');
      setError(null);
      setIsUploading(false);
      setIsCreatingCategory(false);
      setNewCategoryName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const detectType = (file: File): 'video' | 'audio' | 'photo' => {
    const name = file.name.toLowerCase();
    if (file.type.startsWith('video/') || ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'].some((e) => name.endsWith(e))) {
      return 'video';
    }
    if (file.type.startsWith('audio/') || ['.mp3', '.m4a', '.flac', '.wav', '.aac', '.ogg', '.opus', '.wma'].some((e) => name.endsWith(e))) {
      return 'audio';
    }
    return 'photo';
  };

  const addFilesToQueue = (newFiles: FileList | File[]) => {
    const additions: QueuedFile[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles[i];
      if (!f) continue;
      const t = detectType(f);
      additions.push({
        file: f,
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        title: f.name.replace(/\.[^/.]+$/, ''),
        type: t,
        status: 'pending',
        progress: 0,
      });
    }

    if (additions.length === 0) {
      setError('Please select valid video, audio, or photo files.');
      return;
    }

    setFileQueue((prev) => [...prev, ...additions]);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleCreateCategory = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newCategoryName.trim()) return;

    setIsSavingCategory(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });

      const json: ApiResponse<{ category: Category }> = await res.json();
      if (res.ok && json.success) {
        if (onCategoryCreated) onCategoryCreated(json.data.category);
        setCategoryId(json.data.category.id);
        setIsCreatingCategory(false);
        setNewCategoryName('');
      } else if (!json.success) {
        setError(json.error.message);
      }
    } catch {
      setError('Failed to create category');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const removeFileFromQueue = (id: string) => {
    setFileQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const uploadSingleItemWithProgress = (
    item: QueuedFile,
    index: number
  ): Promise<{ success: boolean; media?: MediaItem; error?: string }> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      let lastLoaded = 0;
      let lastTime = Date.now();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && e.total > 0) {
          const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          let speedStr = item.speed;

          if (timeDiff >= 0.25) {
            const bytesDiff = e.loaded - lastLoaded;
            const bytesPerSec = bytesDiff / timeDiff;
            if (bytesPerSec >= 1024 * 1024) {
              speedStr = `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
            } else {
              speedStr = `${Math.round(bytesPerSec / 1024)} KB/s`;
            }
            lastLoaded = e.loaded;
            lastTime = now;
          }

          setFileQueue((prev) =>
            prev.map((q, idx) =>
              idx === index
                ? {
                    ...q,
                    status: 'uploading',
                    progress: percent,
                    bytesLoaded: e.loaded,
                    totalBytes: e.total,
                    speed: speedStr,
                    statusText: `Uploading: ${percent}% (${formatFileSize(e.loaded)} / ${formatFileSize(e.total)})${speedStr ? ` • ${speedStr}` : ''}`,
                  }
                : q
            )
          );
        }
      });

      // When all request bytes are sent to server, update status to processing
      xhr.upload.addEventListener('load', () => {
        setFileQueue((prev) =>
          prev.map((q, idx) =>
            idx === index
              ? {
                  ...q,
                  progress: 100,
                  statusText: isPrivate
                    ? 'Encrypting file with AES-256-CTR...'
                    : 'Processing & extracting album art / video poster...',
                }
              : q
          )
        );
      });

      xhr.addEventListener('load', () => {
        try {
          const json: ApiResponse<{ media: MediaItem }> = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && json.success) {
            setFileQueue((prev) =>
              prev.map((q, idx) =>
                idx === index
                  ? {
                      ...q,
                      status: 'completed',
                      progress: 100,
                      statusText: '100% Upload Complete',
                    }
                  : q
              )
            );
            resolve({ success: true, media: json.data.media });
          } else {
            const msg = !json.success ? json.error.message : `Upload failed (status ${xhr.status})`;
            setFileQueue((prev) =>
              prev.map((q, idx) =>
                idx === index
                  ? {
                      ...q,
                      status: 'error',
                      errorMessage: msg,
                      statusText: 'Upload failed',
                    }
                  : q
              )
            );
            resolve({ success: false, error: msg });
          }
        } catch {
          const msg = 'Invalid server response';
          setFileQueue((prev) =>
            prev.map((q, idx) =>
              idx === index
                ? {
                    ...q,
                    status: 'error',
                    errorMessage: msg,
                    statusText: 'Upload failed',
                  }
                : q
            )
          );
          resolve({ success: false, error: msg });
        }
      });

      xhr.addEventListener('error', () => {
        const msg = 'Network error during upload';
        setFileQueue((prev) =>
          prev.map((q, idx) =>
            idx === index
              ? {
                  ...q,
                  status: 'error',
                  errorMessage: msg,
                  statusText: 'Network connection lost',
                }
              : q
          )
        );
        resolve({ success: false, error: msg });
      });

      xhr.addEventListener('timeout', () => {
        const msg = 'Upload timed out. Try again or check network';
        setFileQueue((prev) =>
          prev.map((q, idx) =>
            idx === index
              ? {
                  ...q,
                  status: 'error',
                  errorMessage: msg,
                  statusText: 'Upload timed out',
                }
              : q
          )
        );
        resolve({ success: false, error: msg });
      });

      xhr.timeout = 180000;

      const qParams = new URLSearchParams();
      qParams.set('title', item.title.trim() || item.file.name);
      if (categoryId) qParams.set('categoryId', categoryId);
      if (isPrivate) qParams.set('isPrivate', 'true');
      if (destination !== 'auto') qParams.set('subType', destination);

      const formData = new FormData();
      formData.append('title', item.title.trim() || item.file.name);
      if (categoryId) formData.append('categoryId', categoryId);
      formData.append('isPrivate', isPrivate ? 'true' : 'false');
      if (destination !== 'auto') formData.append('subType', destination);
      if (tags.trim()) formData.append('tags', tags.trim());
      formData.append('file', item.file);

      xhr.open('POST', `/api/media/upload?${qParams.toString()}`);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.send(formData);
    });
  };

  const startBatchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fileQueue.length === 0) {
      setError('Please select at least one video, song, or photo to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);

    // If private is chosen and vault is not yet unlocked, authenticate with provided passphrase first
    if (isPrivate && !isUnlocked) {
      if (!vaultPassphrase.trim()) {
        setError('Please enter your vault passphrase to authorize private upload.');
        setIsUploading(false);
        return;
      }

      const unlockRes = await unlockVault(vaultPassphrase);
      if (!unlockRes.success) {
        setError(unlockRes.error || 'Invalid vault passphrase');
        setIsUploading(false);
        return;
      }
    }

    let lastUploadedMedia: MediaItem | null = null;

    // Process files sequentially with real-time percentage progress
    for (let i = 0; i < fileQueue.length; i++) {
      const item = fileQueue[i];
      if (!item || item.status === 'completed') continue;

      setFileQueue((prev) =>
        prev.map((q, idx) => (idx === i ? { ...q, status: 'uploading', progress: 0, statusText: 'Starting upload...' } : q))
      );

      const result = await uploadSingleItemWithProgress(item, i);
      if (result.success && result.media) {
        lastUploadedMedia = result.media;
      }
    }

    setIsUploading(false);
    if (lastUploadedMedia) {
      onUploadSuccess(lastUploadedMedia);
      setTimeout(() => {
        onClose();
      }, 700);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  const completedCount = fileQueue.filter((f) => f.status === 'completed').length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          padding: 'var(--space-6)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <button
          onClick={onClose}
          disabled={isUploading}
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            <Upload size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Vesper Media Ingestion
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Lossless hardware storage for movies, songs, and photos on your Raspberry Pi
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--accent-danger)',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              marginBottom: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={startBatchUpload}>
          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? '#8b5cf6' : 'var(--border-strong)'}`,
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-6) var(--space-4)',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-surface)',
              transition: 'all var(--duration-fast)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,audio/*,image/*,.mp4,.webm,.mov,.mkv,.avi,.mp3,.flac,.m4a,.wav,.aac,.ogg,.opus,.jpg,.jpeg,.png,.webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  addFilesToQueue(e.target.files);
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <Film size={24} style={{ color: '#ff3b3b' }} />
              <Music size={24} style={{ color: '#8b5cf6' }} />
              <ImageIcon size={24} style={{ color: '#38bdf8' }} />
            </div>
            <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Drag and drop multiple files here, or <span style={{ textDecoration: 'underline', color: '#a78bfa' }}>browse</span>
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Movies (4K / 1080p MP4, WebM, MKV), Songs (MP3, FLAC, M4A, WAV), Photos
            </p>
          </div>

          {/* Selected File Queue List with Live Percentage Progress */}
          {fileQueue.length > 0 && (() => {
            const totalQueueBytes = fileQueue.reduce((acc, f) => acc + f.file.size, 0);
            const totalUploadedBytes = fileQueue.reduce((acc, f) => {
              if (f.status === 'completed') return acc + f.file.size;
              if (f.status === 'uploading') return acc + (f.bytesLoaded || 0);
              return acc;
            }, 0);
            const aggregatePercent = totalQueueBytes > 0 ? Math.min(100, Math.round((totalUploadedBytes / totalQueueBytes) * 100)) : 0;

            return (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Upload Queue ({fileQueue.length} files)
                  </span>
                  {isUploading && (
                    <span style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 600 }}>
                      Uploaded {completedCount} of {fileQueue.length} files
                    </span>
                  )}
                </div>

                {/* Aggregate Global Progress Bar */}
                {isUploading && (
                  <div
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#38bdf8' }}>
                        Total Upload Progress: {aggregatePercent}%
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {formatFileSize(totalUploadedBytes)} / {formatFileSize(totalQueueBytes)}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${aggregatePercent}%`,
                          background: 'linear-gradient(90deg, #38bdf8, #818cf8, #10b981)',
                          transition: 'width 200ms ease-out',
                        }}
                      />
                    </div>
                  </div>
                )}

                <div
                  style={{
                    maxHeight: '190px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-elevated)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px',
                  }}
                >
                  {fileQueue.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '8px 12px',
                        background: 'var(--bg-surface)',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: '0.8rem',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          {item.type === 'video' && <Film size={14} style={{ color: '#ff3b3b', flexShrink: 0 }} />}
                          {item.type === 'audio' && <Music size={14} style={{ color: '#8b5cf6', flexShrink: 0 }} />}
                          {item.type === 'photo' && <ImageIcon size={14} style={{ color: '#38bdf8', flexShrink: 0 }} />}
                          <span
                            style={{
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '220px',
                              fontWeight: 500,
                            }}
                          >
                            {item.title}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            ({formatFileSize(item.file.size)})
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {item.status === 'pending' && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                              Queued
                            </span>
                          )}
                          {item.status === 'uploading' && (
                            <span
                              style={{
                                color: '#38bdf8',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: 'rgba(56, 189, 248, 0.12)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                              }}
                            >
                              {item.progress}%
                            </span>
                          )}
                          {item.status === 'completed' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-success)', fontSize: '0.75rem', fontWeight: 600 }}>
                              <CheckCircle2 size={14} />
                              <span>Done</span>
                            </div>
                          )}
                          {item.status === 'error' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-danger)', fontSize: '0.72rem' }}>
                              <AlertCircle size={14} />
                              <span>{item.errorMessage || 'Error'}</span>
                            </div>
                          )}
                          {!isUploading && item.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => removeFileFromQueue(item.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Real-time Percentage & Progress Bar */}
                      {item.status === 'uploading' && (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {item.statusText || `Uploading ${item.progress}%`}
                            </span>
                            <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                              {item.progress}%
                            </span>
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: '5px',
                              background: 'rgba(255,255,255,0.08)',
                              borderRadius: '3px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${item.progress}%`,
                                background: isPrivate
                                  ? 'linear-gradient(90deg, #f59e0b, #ec4899)'
                                  : 'linear-gradient(90deg, #3b82f6, #06b6d4, #10b981)',
                                borderRadius: '3px',
                                transition: 'width 150ms ease-out',
                                boxShadow: isPrivate
                                  ? '0 0 10px rgba(245, 158, 11, 0.4)'
                                  : '0 0 10px rgba(56, 189, 248, 0.4)',
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Form Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            {/* Auto-filtration & Destination Selection */}
            <div>
              <label className="label" style={{ marginBottom: '6px' }}>Destination & Auto-Filtration</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setDestination('auto')}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: destination === 'auto' ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                    background: destination === 'auto' ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-surface)',
                    color: destination === 'auto' ? '#38bdf8' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <div>✨ Smart Auto-Filter</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    Films to Cinema, clips to Memories
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDestination('movie')}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: destination === 'movie' ? '1px solid #ff3b3b' : '1px solid var(--border-subtle)',
                    background: destination === 'movie' ? 'rgba(255, 59, 59, 0.12)' : 'var(--bg-surface)',
                    color: destination === 'movie' ? '#ff4b4b' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <div>🎬 Movie / Cinema</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    YouTube-style player
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDestination('family')}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: destination === 'family' ? '1px solid #8ab4f8' : '1px solid var(--border-subtle)',
                    background: destination === 'family' ? 'rgba(138, 180, 248, 0.12)' : 'var(--bg-surface)',
                    color: destination === 'family' ? '#8ab4f8' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <div>📷 Google Photos</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    Family videos & photos
                  </div>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              {/* Category selector */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="label" htmlFor="media-category" style={{ margin: 0 }}>Category</label>
                  {!isCreatingCategory && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingCategory(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        padding: 0,
                      }}
                    >
                      <Plus size={11} /> New
                    </button>
                  )}
                </div>
                {isCreatingCategory ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="text"
                      className="input"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category name"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={(e) => void handleCreateCategory(e)}
                      disabled={isSavingCategory || !newCategoryName.trim()}
                      style={{ padding: '0.35rem 0.6rem' }}
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setIsCreatingCategory(false)}
                      style={{ padding: '0.35rem 0.5rem' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <select
                    id="media-category"
                    className="input"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={isUploading}
                  >
                    <option value="">No Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="label" htmlFor="media-tags">Tags (Optional)</label>
                <input
                  id="media-tags"
                  type="text"
                  className="input"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="travel, train, 4k"
                  disabled={isUploading}
                />
              </div>
            </div>

            {/* Private Vault Checkbox */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                background: isPrivate ? 'var(--vault-subtle)' : 'transparent',
                border: `1px solid ${isPrivate ? 'var(--vault-border)' : 'var(--border-subtle)'}`,
                cursor: 'pointer',
                transition: 'all var(--duration-fast)',
              }}
              onClick={() => setIsPrivate(!isPrivate)}
            >
              <input
                type="checkbox"
                id="is-private"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--vault-primary)' }}
              />
              <label
                htmlFor="is-private"
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: isPrivate ? 'var(--vault-primary)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  margin: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={14} />
                  <span style={{ fontWeight: 600 }}>Store in Private Encrypted Vault</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: isPrivate ? '#f59e0b' : 'var(--text-muted)' }}>
                  AES-256-CTR at-rest encryption protects private media even if the physical USB flash drive is stolen.
                </span>
              </label>
            </div>

            {/* Step-Up Passphrase Prompt if Vault is Locked */}
            {isPrivate && !isUnlocked && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  background: 'var(--vault-subtle)',
                  border: '1px solid var(--vault-border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                <label className="label" htmlFor="vault-passphrase" style={{ color: 'var(--vault-primary)' }}>
                  Vault Passphrase Required
                </label>
                <input
                  id="vault-passphrase"
                  type="password"
                  className="input"
                  value={vaultPassphrase}
                  onChange={(e) => setVaultPassphrase(e.target.value)}
                  placeholder="Enter vault passphrase"
                  disabled={isUploading}
                  required
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isUploading || fileQueue.length === 0}
              style={{
                background: 'linear-gradient(135deg, #ff0000 0%, #8b5cf6 100%)',
                borderColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '0.5rem 1.25rem',
              }}
            >
              <Upload size={15} />
              <span>{isUploading ? 'Uploading...' : `Upload ${fileQueue.length > 1 ? `(${fileQueue.length} items)` : ''}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

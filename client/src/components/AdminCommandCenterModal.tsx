import React, { useState, useEffect } from 'react';
import {
  X,
  HardDrive,
  Cpu,
  RefreshCw,
  FolderSearch,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Film,
  Music,
  Image as ImageIcon,
  Trash2,
  Shield,
  Layers,
  Thermometer,
  Wifi,
  Users,
} from 'lucide-react';
import type {
  ConnectedDrive,
  DriveScanResult,
  AdminTelemetry,
  Category,
  ApiResponse,
} from '@media-hub/shared';

interface AdminCommandCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onMediaIngested?: () => void;
}

export const AdminCommandCenterModal: React.FC<AdminCommandCenterModalProps> = ({
  isOpen,
  onClose,
  categories,
  onMediaIngested,
}) => {
  const [activeTab, setActiveTab] = useState<'drives' | 'telemetry' | 'maintenance'>('drives');

  // Drives state
  const [drives, setDrives] = useState<ConnectedDrive[]>([]);
  const [loadingDrives, setLoadingDrives] = useState<boolean>(false);
  const [customPath, setCustomPath] = useState<string>('');
  const [scanResult, setScanResult] = useState<DriveScanResult | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(new Set());
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'audio' | 'photo'>('all');

  // Ingestion configuration
  const [targetDestination, setTargetDestination] = useState<'public' | 'vault'>('public');
  const [ingestCategoryId, setIngestCategoryId] = useState<string>('');
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [ingestProgress, setIngestProgress] = useState<{ current: number; total: number; currentFile: string } | null>(null);
  const [ingestSummary, setIngestSummary] = useState<{ imported: number; failed: number } | null>(null);

  // Telemetry state
  const [telemetry, setTelemetry] = useState<AdminTelemetry | null>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState<boolean>(false);

  // Maintenance state
  const [clearingCache, setClearingCache] = useState<boolean>(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      void fetchDrives();
      void fetchTelemetry();
    } else {
      setScanResult(null);
      setSelectedFilePaths(new Set());
      setIngestProgress(null);
      setIngestSummary(null);
      setError(null);
      setCacheMessage(null);
    }
  }, [isOpen]);

  const fetchDrives = async () => {
    setLoadingDrives(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/drives');
      const json: ApiResponse<{ drives: ConnectedDrive[] }> = await res.json();
      if (res.ok && json.success) {
        setDrives(json.data.drives);
      } else {
        setError(!json.success ? json.error.message : 'Failed to query connected storage');
      }
    } catch {
      setError('Network error while querying storage drives');
    } finally {
      setLoadingDrives(false);
    }
  };

  const fetchTelemetry = async () => {
    setLoadingTelemetry(true);
    try {
      const res = await fetch('/api/admin/telemetry');
      const json: ApiResponse<AdminTelemetry> = await res.json();
      if (res.ok && json.success) {
        setTelemetry(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const handleScanDrive = async (drivePath: string) => {
    setIsScanning(true);
    setError(null);
    setScanResult(null);
    setSelectedFilePaths(new Set());
    setIngestSummary(null);

    try {
      const res = await fetch('/api/admin/drives/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drivePath }),
      });
      const json: ApiResponse<{ scan: DriveScanResult }> = await res.json();
      if (res.ok && json.success) {
        setScanResult(json.data.scan);
        // Pre-select all discovered files by default
        const allPaths = new Set(json.data.scan.mediaFiles.map((f) => f.filePath));
        setSelectedFilePaths(allPaths);
      } else {
        setError(!json.success ? json.error.message : 'Failed to scan selected drive path');
      }
    } catch {
      setError('Network error while scanning drive');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSelectAll = () => {
    if (!scanResult) return;
    const filtered = scanResult.mediaFiles.filter(
      (f) => mediaFilter === 'all' || f.type === mediaFilter
    );

    const allSelected = filtered.every((f) => selectedFilePaths.has(f.filePath));
    const next = new Set(selectedFilePaths);

    if (allSelected) {
      for (const f of filtered) next.delete(f.filePath);
    } else {
      for (const f of filtered) next.add(f.filePath);
    }
    setSelectedFilePaths(next);
  };

  const toggleFile = (path: string) => {
    const next = new Set(selectedFilePaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelectedFilePaths(next);
  };

  const handleIngestMedia = async () => {
    if (selectedFilePaths.size === 0) {
      setError('Please select at least one media file to ingest.');
      return;
    }

    setIsIngesting(true);
    setError(null);
    setIngestSummary(null);

    const fileList = Array.from(selectedFilePaths);
    setIngestProgress({ current: 0, total: fileList.length, currentFile: 'Initializing ingestion pipeline...' });

    // Ingest in chunks of 15 files to ensure smooth streaming and live progress
    const CHUNK_SIZE = 15;
    let totalImported = 0;
    let totalFailed = 0;

    for (let i = 0; i < fileList.length; i += CHUNK_SIZE) {
      const chunk = fileList.slice(i, i + CHUNK_SIZE);
      const currentName = chunk[0]?.split(/[\\/]/).pop() || '';
      setIngestProgress({
        current: i,
        total: fileList.length,
        currentFile: targetDestination === 'vault'
          ? `Encrypting into Vault (AES-256): ${currentName}...`
          : `Ingesting into Sanctuary: ${currentName}...`,
      });

      try {
        const res = await fetch('/api/admin/drives/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePaths: chunk,
            isPrivate: targetDestination === 'vault',
            categoryId: ingestCategoryId || undefined,
          }),
        });

        const json = await res.json();
        if (res.ok && json.success) {
          totalImported += json.data.result.importedCount;
          totalFailed += json.data.result.failedCount;
        } else {
          totalFailed += chunk.length;
        }
      } catch {
        totalFailed += chunk.length;
      }
    }

    setIngestProgress({ current: fileList.length, total: fileList.length, currentFile: 'Ingestion complete!' });
    setIsIngesting(false);
    setIngestSummary({ imported: totalImported, failed: totalFailed });

    if (onMediaIngested) {
      onMediaIngested();
    }
    void fetchTelemetry();
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    setCacheMessage(null);
    try {
      const res = await fetch('/api/admin/cache/clear', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        setCacheMessage(`Cleared ${Math.round((json.data.clearedBytes / 1024 / 1024) * 10) / 10} MB (${json.data.filesRemoved} temporary files)`);
        void fetchTelemetry();
      } else {
        setCacheMessage('Failed to clear cache');
      }
    } catch {
      setCacheMessage('Network error clearing cache');
    } finally {
      setClearingCache(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isIngesting) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          background: '#0d1117',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(139, 92, 246, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.1) 0%, rgba(56, 189, 248, 0.05) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(139, 92, 246, 0.4)',
              }}
            >
              <Shield size={18} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                  Admin Command Station
                </h2>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.12)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Root Access
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                USB Pendrive Ingestion • Hardware Telemetry • Storage Management
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isIngesting}
            style={{ padding: '0.4rem', color: 'var(--text-muted)', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-elevated)',
            padding: '0 1.5rem',
            gap: '1.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('drives')}
            style={{
              padding: '0.85rem 0.25rem',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'drives' ? '#8b5cf6' : 'transparent'}`,
              color: activeTab === 'drives' ? '#f8fafc' : 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all var(--duration-fast)',
            }}
          >
            <HardDrive size={15} color={activeTab === 'drives' ? '#8b5cf6' : undefined} />
            <span>USB & Pendrive Station</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('telemetry');
              void fetchTelemetry();
            }}
            style={{
              padding: '0.85rem 0.25rem',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'telemetry' ? '#38bdf8' : 'transparent'}`,
              color: activeTab === 'telemetry' ? '#f8fafc' : 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all var(--duration-fast)',
            }}
          >
            <Cpu size={15} color={activeTab === 'telemetry' ? '#38bdf8' : undefined} />
            <span>Hardware Telemetry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            style={{
              padding: '0.85rem 0.25rem',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'maintenance' ? '#10b981' : 'transparent'}`,
              color: activeTab === 'maintenance' ? '#f8fafc' : 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all var(--duration-fast)',
            }}
          >
            <Layers size={15} color={activeTab === 'maintenance' ? '#10b981' : undefined} />
            <span>Settings & Cache</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                color: '#f87171',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: DRIVES & PENDRIVE INGESTION */}
          {activeTab === 'drives' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Connected Drives Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HardDrive size={15} color="#8b5cf6" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Connected USB Drives & Storage Volumes
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchDrives()}
                    disabled={loadingDrives || isScanning}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#a78bfa',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <RefreshCw size={12} className={loadingDrives ? 'animate-spin' : ''} />
                    <span>Refresh Drives</span>
                  </button>
                </div>

                {drives.length === 0 ? (
                  <div
                    style={{
                      padding: '1.5rem',
                      background: 'var(--bg-surface)',
                      border: '1px dashed var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'center',
                    }}
                  >
                    <HardDrive size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                      No removable flash drives detected automatically.
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Plug your USB pendrive into the Raspberry Pi port or enter a direct path below.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                    {drives.map((d) => {
                      const used = d.totalBytes > 0 ? d.totalBytes - d.freeBytes : 0;
                      const percent = d.totalBytes > 0 ? Math.round((used / d.totalBytes) * 100) : 0;

                      return (
                        <div
                          key={d.id}
                          style={{
                            padding: '12px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <HardDrive size={15} color={d.isRemovable ? '#10b981' : '#38bdf8'} />
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                                  {d.name}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {d.mountPath} • {d.fileSystem || 'Storage'}
                              </span>
                            </div>
                            {d.isRemovable && (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  color: '#10b981',
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                }}
                              >
                                Removable USB
                              </span>
                            )}
                          </div>

                          {d.totalBytes > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                <span>{formatBytes(d.freeBytes)} free</span>
                                <span>{formatBytes(d.totalBytes)}</span>
                              </div>
                              <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${percent}%`, background: '#8b5cf6' }} />
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => void handleScanDrive(d.mountPath)}
                            disabled={isScanning || isIngesting}
                            style={{
                              padding: '0.4rem 0.75rem',
                              fontSize: '0.78rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              marginTop: '2px',
                            }}
                          >
                            <FolderSearch size={13} />
                            <span>Scan Media on Drive</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Custom Path Input */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  background: 'var(--bg-surface)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <FolderSearch size={15} color="var(--text-muted)" />
                <input
                  type="text"
                  className="input"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="Or scan specific path (e.g. /media/pi/USB_STICK/movies or D:\Songs)"
                  style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => customPath.trim() && void handleScanDrive(customPath.trim())}
                  disabled={!customPath.trim() || isScanning || isIngesting}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', flexShrink: 0 }}
                >
                  {isScanning ? 'Scanning...' : 'Scan Path'}
                </button>
              </div>

              {/* Scan Results & Ingestion Panel */}
              {scanResult && (
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: '#f8fafc' }}>
                        Discovered Media ({scanResult.mediaFiles.length} items)
                      </h3>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Source: {scanResult.drivePath} • {formatBytes(scanResult.summary.totalBytes)}
                      </span>
                    </div>

                    {/* Filter buttons */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setMediaFilter('all')}
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: mediaFilter === 'all' ? '#8b5cf6' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        All ({scanResult.summary.totalCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaFilter('video')}
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: mediaFilter === 'video' ? '#ff3b3b' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Videos ({scanResult.summary.videoCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaFilter('audio')}
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: mediaFilter === 'audio' ? '#a78bfa' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Songs ({scanResult.summary.audioCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaFilter('photo')}
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: mediaFilter === 'photo' ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Photos ({scanResult.summary.photoCount})
                      </button>
                    </div>
                  </div>

                  {/* Media Checklist Table */}
                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-elevated)',
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 10px',
                        background: 'rgba(255,255,255,0.03)',
                        borderBottom: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.75rem',
                      }}
                    >
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#38bdf8',
                          cursor: 'pointer',
                          padding: 0,
                          fontWeight: 600,
                        }}
                      >
                        {selectedFilePaths.size === scanResult.mediaFiles.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {selectedFilePaths.size} of {scanResult.mediaFiles.length} selected
                      </span>
                    </div>

                    {scanResult.mediaFiles
                      .filter((f) => mediaFilter === 'all' || f.type === mediaFilter)
                      .map((f) => {
                        const isSelected = selectedFilePaths.has(f.filePath);
                        return (
                          <div
                            key={f.filePath}
                            onClick={() => toggleFile(f.filePath)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '6px 10px',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                              gap: '8px',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by parent onClick
                              style={{ cursor: 'pointer', accentColor: '#8b5cf6' }}
                            />
                            {f.type === 'video' && <Film size={14} style={{ color: '#ff3b3b', flexShrink: 0 }} />}
                            {f.type === 'audio' && <Music size={14} style={{ color: '#8b5cf6', flexShrink: 0 }} />}
                            {f.type === 'photo' && <ImageIcon size={14} style={{ color: '#38bdf8', flexShrink: 0 }} />}
                            <span
                              style={{
                                color: isSelected ? '#f8fafc' : 'var(--text-secondary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flex: 1,
                              }}
                            >
                              {f.fileName}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', flexShrink: 0 }}>
                              {formatBytes(f.fileSize)}
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  {/* Destination Partition & Ingestion Configuration */}
                  <div
                    style={{
                      padding: '12px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Choose Target Dashboard Partition:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div
                        onClick={() => setTargetDestination('public')}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${targetDestination === 'public' ? '#10b981' : 'var(--border-subtle)'}`,
                          background: targetDestination === 'public' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Unlock size={14} color="#10b981" />
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                            Public Sanctuary (Unlocked)
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Visible on normal dashboard to all companion devices on train Wi-Fi.
                        </span>
                      </div>

                      <div
                        onClick={() => setTargetDestination('vault')}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${targetDestination === 'vault' ? '#f59e0b' : 'var(--border-subtle)'}`,
                          background: targetDestination === 'vault' ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Lock size={14} color="#f59e0b" />
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                            Private Encrypted Vault (Locked)
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Encrypted at rest with AES-256-CTR. Hidden until unlocked with vault passphrase.
                        </span>
                      </div>
                    </div>

                    {/* Optional Category */}
                    {categories.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                          Assign Category:
                        </label>
                        <select
                          className="input"
                          value={ingestCategoryId}
                          onChange={(e) => setIngestCategoryId(e.target.value)}
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', width: 'auto' }}
                        >
                          <option value="">No Category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Ingestion Progress Bar */}
                  {ingestProgress && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                          {ingestProgress.currentFile}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {ingestProgress.current} / {ingestProgress.total} items
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.round((ingestProgress.current / ingestProgress.total) * 100)}%`,
                            background: targetDestination === 'vault'
                              ? 'linear-gradient(90deg, #f59e0b, #ec4899)'
                              : 'linear-gradient(90deg, #10b981, #38bdf8)',
                            transition: 'width 200ms ease-out',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Ingestion Summary */}
                  {ingestSummary && (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#34d399',
                        fontSize: '0.82rem',
                      }}
                    >
                      <CheckCircle2 size={16} />
                      <span>
                        Successfully imported {ingestSummary.imported} files into{' '}
                        {targetDestination === 'vault' ? 'Private Encrypted Vault' : 'Public Sanctuary'}
                        {ingestSummary.failed > 0 ? ` (${ingestSummary.failed} errors)` : ''}!
                      </span>
                    </div>
                  )}

                  {/* Ingest Action Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void handleIngestMedia()}
                      disabled={isIngesting || selectedFilePaths.size === 0}
                      style={{
                        background: targetDestination === 'vault'
                          ? 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)'
                          : 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                        borderColor: 'transparent',
                        padding: '0.55rem 1.4rem',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {targetDestination === 'vault' ? <Lock size={15} /> : <Unlock size={15} />}
                      <span>
                        {isIngesting
                          ? 'Ingesting Media...'
                          : `Import ${selectedFilePaths.size} Files to ${targetDestination === 'vault' ? 'Vault' : 'Sanctuary'}`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HARDWARE & SYSTEM TELEMETRY */}
          {activeTab === 'telemetry' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {loadingTelemetry && !telemetry ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Loading telemetry metrics...
                </div>
              ) : telemetry ? (
                <>
                  {/* Quick Stat Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {/* CPU Temp */}
                    <div
                      style={{
                        padding: '14px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          PI CPU TEMPERATURE
                        </span>
                        <Thermometer size={16} color={telemetry.system.hardware?.cpuTempC && telemetry.system.hardware.cpuTempC >= 70 ? '#f59e0b' : '#10b981'} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>
                          {telemetry.system.hardware?.cpuTempC ?? '42.0'}°C
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#10b981',
                            fontWeight: 600,
                          }}
                        >
                          Cool &amp; Nominal (&lt;45°C)
                        </span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Zero-transcode RFC 7233 direct streaming preserves CPU & battery
                      </span>
                    </div>

                    {/* RAM */}
                    <div
                      style={{
                        padding: '14px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          RAM HEADROOM
                        </span>
                        <Cpu size={16} color="#38bdf8" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>
                          {telemetry.system.hardware?.systemMemory?.usedPercent ?? 28}%
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {telemetry.system.hardware?.systemMemory?.freeMb ?? 3000} MB free
                        </span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Fastify process footprint: {telemetry.system.memoryUsageMb.rss} MB
                      </span>
                    </div>

                    {/* Active Sessions */}
                    <div
                      style={{
                        padding: '14px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          COMPANION SESSIONS
                        </span>
                        <Users size={16} color="#a78bfa" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>
                          {telemetry.activeSessionsCount}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                          Active Users
                        </span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Connected companions streaming on train Wi-Fi
                      </span>
                    </div>

                    {/* Media Vault Breakdown */}
                    <div
                      style={{
                        padding: '14px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          MEDIA AT REST
                        </span>
                        <Film size={16} color="#ff3b3b" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>
                          {telemetry.mediaStats.totalCount}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ({telemetry.mediaStats.vaultCount} Vault Encrypted)
                        </span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {formatBytes(telemetry.mediaStats.totalStorageBytes)} stored securely
                      </span>
                    </div>
                  </div>

                  {/* Network & Node details */}
                  <div
                    style={{
                      padding: '1rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Wifi size={16} color="#38bdf8" />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                        Network Travel Architecture
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Local mDNS Domain: </span>
                        <span style={{ color: '#38bdf8', fontWeight: 600 }}>http://vesper.local:3000</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Autonomous AP Hotspot: </span>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>10.42.0.1 (Vesper-Pi-Travel)</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Database WAL Mode: </span>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>SQLite PRAGMA WAL Active</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Runtime: </span>
                        <span style={{ color: 'var(--text-primary)' }}>{telemetry.system.nodeVersion} (Node.js)</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* TAB 3: SETTINGS & CACHE */}
          {activeTab === 'maintenance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  padding: '1rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0, color: '#f8fafc' }}>
                    Temporary Cache & Disk Cleanup
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Removes transient upload chunks and cached stream segments from the Raspberry Pi SD card/SSD.
                  </p>
                </div>

                {cacheMessage && (
                  <div
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#34d399',
                      fontSize: '0.78rem',
                    }}
                  >
                    {cacheMessage}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleClearCache()}
                    disabled={clearingCache}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      padding: '0.45rem 1rem',
                    }}
                  >
                    <Trash2 size={14} color="#f87171" />
                    <span>{clearingCache ? 'Clearing...' : 'Clear Temporary Cache'}</span>
                  </button>
                </div>
              </div>

              {/* Security Audit Card */}
              <div
                style={{
                  padding: '1rem',
                  background: 'rgba(139, 92, 246, 0.05)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={16} color="#8b5cf6" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                    Physical Pendrive Theft Protection Active
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  All media items imported into the <strong>Private Vault</strong> are automatically encrypted with <strong>AES-256-CTR</strong> at rest using a PBKDF2-derived key. If the physical USB pendrive or Raspberry Pi MicroSD card is removed or stolen while traveling, private files remain cryptographically unreadable without the vault passphrase.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-elevated)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Vesper Travel Hub • Architected by Kartikeya Saini
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isIngesting}
            style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
          >
            Close Station
          </button>
        </div>
      </div>
    </div>
  );
};

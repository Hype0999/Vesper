export type MediaType = 'video' | 'photo' | 'audio';
export type MediaSubType = 'movie' | 'family' | 'photo' | 'music';

export interface WifiNetwork {
  ssid: string;
  signal: number;
  security: string;
  inUse: boolean;
}

export interface NetworkStatus {
  connected: boolean;
  ipAddress: string;
  localDomain: string;
  ssid?: string;
  isHotspot: boolean;
  hotspotSsid?: string;
  availableNetworks: WifiNetwork[];
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface MediaItem {
  id: string;
  userId: string;
  type: MediaType;
  subType?: MediaSubType;
  title: string;
  description: string | null;
  categoryId: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  isPrivate: boolean;
  fileSize: number;
  mimeType: string;
  originalFilename: string;
  fileExtension: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  playCount: number;
  isFavorite: boolean;
  tags?: string[];
  playbackPosition?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  isEncrypted: boolean;
  categoryId: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  isPrivate: boolean;
  isFavorite: boolean;
  isPinned: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SystemHealth {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  nodeVersion: string;
  memoryUsageMb: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  database: {
    status: 'ok' | 'degraded' | 'error';
    migrationVersion: number;
  };
  hardware?: {
    cpuTempC?: number | null;
    cpuTempStatus: 'nominal' | 'elevated' | 'critical';
    throttled?: boolean;
    systemMemory?: {
      totalMb: number;
      freeMb: number;
      usedPercent: number;
    };
    storage?: {
      totalMb?: number;
      freeMb?: number;
      usedPercent?: number;
    };
    thermalWarning?: string | null;
  };
}

export interface ConnectedDrive {
  id: string;
  name: string;
  mountPath: string;
  label: string;
  totalBytes: number;
  freeBytes: number;
  isRemovable: boolean;
  fileSystem?: string;
}

export interface DiscoveredMediaFile {
  filePath: string;
  fileName: string;
  fileSize: number;
  type: MediaType;
  subType?: MediaSubType;
  extension: string;
  mimeType: string;
  parentDir: string;
}

export interface DriveScanResult {
  drivePath: string;
  scannedCount: number;
  mediaFiles: DiscoveredMediaFile[];
  summary: {
    totalCount: number;
    videoCount: number;
    audioCount: number;
    photoCount: number;
    totalBytes: number;
  };
}

export interface MediaIngestResult {
  importedCount: number;
  failedCount: number;
  items: Array<{
    filePath: string;
    title: string;
    status: 'success' | 'error';
    mediaId?: string;
    error?: string;
  }>;
}

export interface AdminTelemetry {
  system: SystemHealth;
  activeSessionsCount: number;
  mediaStats: {
    totalCount: number;
    publicCount: number;
    vaultCount: number;
    videoCount: number;
    audioCount: number;
    photoCount: number;
    totalStorageBytes: number;
  };
  storage: {
    mediaDir: string;
    vaultDir: string;
    tempDirSizeMb: number;
  };
}

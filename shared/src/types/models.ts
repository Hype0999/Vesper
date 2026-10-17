export type MediaType = 'video' | 'photo' | 'audio';

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

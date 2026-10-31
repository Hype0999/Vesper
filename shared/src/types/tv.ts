import type { MediaItem } from './models.js';

export interface HdmiDisplayStatus {
  connected: boolean;
  port: string;
  resolution?: string;
  audioSink?: string;
  cecSupported: boolean;
  tvModel?: string;
  isKioskRunning: boolean;
}

export type TvRemoteAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'back'
  | 'play_pause'
  | 'play'
  | 'pause'
  | 'stop'
  | 'volume_up'
  | 'volume_down'
  | 'mute'
  | 'seek_forward'
  | 'seek_backward'
  | 'cast'
  | 'home'
  | 'fullscreen';

export interface TvRemoteCommand {
  action: TvRemoteAction;
  payload?: any;
  source: 'cec' | 'phone_remote' | 'keyboard' | 'system';
  timestamp: number;
}

export interface TvPlaybackState {
  currentMedia: MediaItem | null;
  playbackState: 'playing' | 'paused' | 'stopped' | 'idle';
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  lastUpdated: string;
}

export interface TvSessionStatus {
  hdmi: HdmiDisplayStatus;
  playback: TvPlaybackState;
  activeClientCount: number;
}


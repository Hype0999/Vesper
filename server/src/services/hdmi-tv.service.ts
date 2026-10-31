import fs from 'node:fs';
import path from 'node:path';
import { spawn, exec, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import type { FastifyReply } from 'fastify';
import type {
  HdmiDisplayStatus,
  TvPlaybackState,
  TvRemoteAction,
  TvRemoteCommand,
  TvSessionStatus,
  MediaItem,
} from '@media-hub/shared';
import { logger } from '../utils/logger.js';
import { getDatabaseService } from '../db/index.js';

const execAsync = promisify(exec);

export class HdmiTvService {
  private static instance: HdmiTvService | null = null;

  // HDMI & Hardware State
  private isConnected: boolean = false;
  private connectedPort: string = 'HDMI-A-1';
  private resolution: string = '1920x1080@60Hz';
  private tvModelName: string = 'Generic HDMI Display';
  private audioSink: string = 'Default Audio Output';
  private cecAvailable: boolean = false;
  private cecProcess: ChildProcess | null = null;
  private kioskRunning: boolean = false;

  // Watchdog timer
  private pollInterval: NodeJS.Timeout | null = null;

  // SSE client connections (TV kiosk + mobile remotes)
  private sseClients: Set<FastifyReply> = new Set();

  // Playback state synchronization
  private playbackState: TvPlaybackState = {
    currentMedia: null,
    playbackState: 'idle',
    currentTime: 0,
    duration: 0,
    volume: 100,
    isMuted: false,
    lastUpdated: new Date().toISOString(),
  };

  private constructor() {
    this.initHardwareDetection();
  }

  public static getInstance(): HdmiTvService {
    if (!HdmiTvService.instance) {
      HdmiTvService.instance = new HdmiTvService();
    }
    return HdmiTvService.instance;
  }

  /**
   * Clean up timers, child processes and SSE connections
   */
  public destroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.stopCecBridge();
    for (const client of this.sseClients) {
      try { client.raw.end(); } catch { /* ignore */ }
    }
    this.sseClients.clear();
  }

  /**
   * Initialize hardware detection, DRM sysfs monitoring and CEC bridge
   */
  private initHardwareDetection(): void {
    // Initial hardware check
    this.checkHdmiStatus();

    // Start background poller every 3.5s for display plug/unplug events
    this.pollInterval = setInterval(() => {
      this.checkHdmiStatus();
    }, 3500);

    // Initial check for CEC hardware (/dev/cec0)
    try {
      if (fs.existsSync('/dev/cec0')) {
        this.cecAvailable = true;
        this.startCecBridge();
      }
    } catch {
      this.cecAvailable = false;
    }
  }

  /**
   * Check Linux DRM sysfs for HDMI connection state
   */
  public checkHdmiStatus(): boolean {
    const wasConnected = this.isConnected;
    let currentlyConnected = false;
    let detectedPort = 'HDMI-A-1';
    let detectedResolution = this.resolution;
    let detectedModel = this.tvModelName;

    // 1. Linux DRM sysfs probe (Raspberry Pi 4 / Debian / Ubuntu)
    try {
      const drmPath = '/sys/class/drm';
      if (fs.existsSync(drmPath)) {
        const entries = fs.readdirSync(drmPath);
        for (const entry of entries) {
          if (entry.includes('HDMI-A')) {
            const statusFile = path.join(drmPath, entry, 'status');
            if (fs.existsSync(statusFile)) {
              const status = fs.readFileSync(statusFile, 'utf8').trim();
              if (status === 'connected') {
                currentlyConnected = true;
                detectedPort = entry.replace(/^card\d+-/, '');

                // Read supported/current modes if available
                const modesFile = path.join(drmPath, entry, 'modes');
                if (fs.existsSync(modesFile)) {
                  const modes = fs.readFileSync(modesFile, 'utf8').trim().split('\n');
                  if (modes.length > 0 && modes[0]) {
                    detectedResolution = modes[0];
                  }
                }

                // Attempt to parse monitor name from EDID
                const edidFile = path.join(drmPath, entry, 'edid');
                if (fs.existsSync(edidFile)) {
                  const parsedName = this.extractMonitorNameFromEdid(edidFile);
                  if (parsedName) detectedModel = parsedName;
                }

                break;
              }
            }
          }
        }
      }
    } catch (err) {
      logger.debug({ err }, 'Error checking DRM sysfs for HDMI status');
    }

    // 2. Fallback for testing environments / desktops where DRM sysfs is simulated or non-standard
    if (!currentlyConnected && process.env.VESPER_SIMULATE_HDMI === 'true') {
      currentlyConnected = true;
      detectedPort = 'HDMI-A-1 (Simulated)';
      detectedModel = 'Living Room 4K Cinema TV';
      detectedResolution = '3840x2160@60Hz';
    }

    this.isConnected = currentlyConnected;
    this.connectedPort = detectedPort;
    this.resolution = detectedResolution;
    this.tvModelName = detectedModel;

    // Detect state changes
    if (!wasConnected && currentlyConnected) {
      this.handleDisplayConnected();
    } else if (wasConnected && !currentlyConnected) {
      this.handleDisplayDisconnected();
    }

    return this.isConnected;
  }

  /**
   * Extract human-readable monitor name from raw binary EDID
   */
  private extractMonitorNameFromEdid(edidPath: string): string | null {
    try {
      const buf = fs.readFileSync(edidPath);
      if (buf.length < 128) return null;

      // EDID descriptor blocks start at offset 54, 72, 90, 108 (each 18 bytes)
      const offsets = [54, 72, 90, 108];
      for (const off of offsets) {
        // Tag 0x00 0x00 0x00 0xFC represents ASCII Monitor Name Descriptor
        if (buf[off] === 0 && buf[off + 1] === 0 && buf[off + 2] === 0 && buf[off + 3] === 0xfc) {
          const nameBytes = buf.subarray(off + 5, off + 18);
          const rawName = nameBytes.toString('ascii').replace(/\n/g, '').trim();
          if (rawName) return rawName;
        }
      }
    } catch {
      // Ignore EDID read errors
    }
    return null;
  }

  /**
   * Handle display connected event:
   * 1. Route audio to HDMI
   * 2. Initialize CEC if available
   * 3. Launch/wake Kiosk if installed
   * 4. Broadcast state via SSE
   */
  private async handleDisplayConnected(): Promise<void> {
    logger.info(
      { port: this.connectedPort, model: this.tvModelName, resolution: this.resolution },
      '📺 HDMI TV Display connected! Initiating auto-configuration...'
    );

    // Route system audio to HDMI
    await this.routeAudioToHdmi();

    // Start CEC client bridge
    this.startCecBridge();

    // Launch/wake Kiosk if helper script exists
    await this.launchTvKiosk();

    // Broadcast HDMI connection event to all connected devices (phones, dashboard, TV)
    this.broadcast('hdmi_status', this.getStatus());
  }

  /**
   * Handle display disconnected event
   */
  private async handleDisplayDisconnected(): Promise<void> {
    logger.info('HDMI TV Display disconnected. Pausing TV playback and releasing audio sink.');

    this.kioskRunning = false;
    this.stopCecBridge();

    if (this.playbackState.playbackState === 'playing') {
      this.playbackState.playbackState = 'paused';
      this.playbackState.lastUpdated = new Date().toISOString();
    }

    this.broadcast('hdmi_status', this.getStatus());
  }

  /**
   * Automatically route Linux system audio to the connected HDMI output
   */
  public async routeAudioToHdmi(): Promise<boolean> {
    try {
      // Try PipeWire / WirePlumber (modern Debian / Bookworm on Pi)
      try {
        const { stdout } = await execAsync('wpctl status');
        const match = stdout.match(/(\d+)\.\s+.*(?:HDMI|bcm2835.*HDMI|Digital Audio)/i);
        if (match && match[1]) {
          const sinkId = match[1];
          await execAsync(`wpctl set-default ${sinkId}`);
          this.audioSink = `PipeWire HDMI Sink (${sinkId})`;
          logger.info({ sink: this.audioSink }, 'Routed audio to HDMI via wpctl');
          return true;
        }
      } catch {
        // Fall back to PulseAudio or ALSA
      }

      // Try PulseAudio
      try {
        const { stdout } = await execAsync('pactl list sinks short');
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.includes('hdmi') || line.includes('digital-stereo')) {
            const sinkName = line.split('\t')[1];
            if (sinkName) {
              await execAsync(`pactl set-default-sink ${sinkName}`);
              this.audioSink = `PulseAudio HDMI (${sinkName})`;
              logger.info({ sink: this.audioSink }, 'Routed audio to HDMI via pactl');
              return true;
            }
          }
        }
      } catch {
        // Fall back to ALSA
      }

      // Try Raspberry Pi ALSA cset
      try {
        await execAsync('amixer -c 0 cset numid=3 2');
        this.audioSink = 'ALSA Direct HDMI Output';
        logger.info('Routed audio to HDMI via ALSA cset');
        return true;
      } catch {
        // Ignored if ALSA card 0 not available
      }
    } catch (err) {
      logger.warn({ err }, 'Could not automatically route audio to HDMI output');
    }

    this.audioSink = 'Default System Audio';
    return false;
  }

  /**
   * Launch or notify the TV Fullscreen Kiosk display
   */
  private async launchTvKiosk(): Promise<void> {
    const kioskScript = '/usr/local/bin/vesper-tv-kiosk.sh';
    const localKioskScript = path.resolve(process.cwd(), 'scripts/vesper-tv-kiosk.sh');

    const scriptToRun = fs.existsSync(kioskScript)
      ? kioskScript
      : fs.existsSync(localKioskScript)
      ? localKioskScript
      : null;

    if (scriptToRun) {
      try {
        exec(`${scriptToRun} start`, (err) => {
          if (err) logger.warn({ err }, 'Error triggering TV kiosk script');
          else this.kioskRunning = true;
        });
      } catch (err) {
        logger.warn({ err }, 'Failed to trigger kiosk launch');
      }
    }
  }

  /**
   * Start HDMI-CEC bridge to capture physical TV remote buttons (Samsung, LG, Sony, etc.)
   */
  public startCecBridge(): void {
    if (this.cecProcess) return;

    if (!fs.existsSync('/dev/cec0') && process.env.VESPER_SIMULATE_CEC !== 'true') {
      this.cecAvailable = false;
      return;
    }

    this.cecAvailable = true;

    try {
      // Spawn cec-client in monitoring mode
      // -d 1: log level for events
      // -s: single command / standby friendly
      this.cecProcess = spawn('cec-client', ['-d', '1', '-s', 'RPI'], {
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      this.cecProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf8');
        this.handleCecOutput(text);
      });

      this.cecProcess.on('error', (err) => {
        logger.debug({ err }, 'cec-client process error, cec-utils may not be installed');
        this.cecProcess = null;
      });

      this.cecProcess.on('exit', () => {
        this.cecProcess = null;
      });

      logger.info('🎮 HDMI-CEC Remote control listener active on /dev/cec0');
    } catch (err) {
      logger.debug({ err }, 'Failed to initialize cec-client bridge');
      this.cecProcess = null;
    }
  }

  /**
   * Stop CEC bridge
   */
  public stopCecBridge(): void {
    if (this.cecProcess) {
      try {
        this.cecProcess.kill('SIGTERM');
      } catch {
        // ignore
      }
      this.cecProcess = null;
    }
  }

  /**
   * Parse incoming TV remote control events from cec-client stdout
   */
  private handleCecOutput(output: string): void {
    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/key pressed:\s*([a-z0-9_\-\s]+)\s*\(([0-9a-f]+)\)/i);
      if (match && match[1]) {
        const keyName = match[1].trim().toLowerCase();
        const action = this.mapCecKeyToAction(keyName);
        if (action) {
          logger.info({ keyName, action }, '🎮 Physical TV Remote button pressed');
          this.dispatchRemoteCommand(action, undefined, 'cec');
        }
      }
    }
  }

  /**
   * Map standard HDMI-CEC remote keys to Vesper TV actions
   */
  private mapCecKeyToAction(keyName: string): TvRemoteAction | null {
    if (keyName.includes('select') || keyName.includes('enter') || keyName === 'ok') return 'select';
    if (keyName.includes('up')) return 'up';
    if (keyName.includes('down')) return 'down';
    if (keyName.includes('left')) return 'left';
    if (keyName.includes('right')) return 'right';
    if (keyName.includes('exit') || keyName.includes('return') || keyName.includes('back')) return 'back';
    if (keyName.includes('play')) return 'play';
    if (keyName.includes('pause')) return 'pause';
    if (keyName.includes('stop')) return 'stop';
    if (keyName.includes('rewind') || keyName.includes('backward')) return 'seek_backward';
    if (keyName.includes('fast forward') || keyName.includes('forward')) return 'seek_forward';
    if (keyName.includes('mute')) return 'mute';
    if (keyName.includes('volume up')) return 'volume_up';
    if (keyName.includes('volume down')) return 'volume_down';
    return null;
  }

  /**
   * Dispatch remote control action to active TV screen via SSE
   */
  public dispatchRemoteCommand(
    action: TvRemoteAction,
    payload?: any,
    source: 'cec' | 'phone_remote' | 'keyboard' | 'system' = 'phone_remote'
  ): TvRemoteCommand {
    const command: TvRemoteCommand = {
      action,
      payload,
      source,
      timestamp: Date.now(),
    };

    // If action is play/pause/mute, adjust internal mirror state
    if (action === 'play') {
      this.playbackState.playbackState = 'playing';
    } else if (action === 'pause') {
      this.playbackState.playbackState = 'paused';
    } else if (action === 'stop') {
      this.playbackState.playbackState = 'stopped';
      this.playbackState.currentMedia = null;
    } else if (action === 'mute') {
      this.playbackState.isMuted = !this.playbackState.isMuted;
    } else if (action === 'volume_up') {
      this.playbackState.volume = Math.min(100, this.playbackState.volume + 5);
    } else if (action === 'volume_down') {
      this.playbackState.volume = Math.max(0, this.playbackState.volume - 5);
    }

    this.playbackState.lastUpdated = new Date().toISOString();

    // Broadcast command to TV display
    this.broadcast('remote_command', command);

    // Also broadcast updated playback state
    this.broadcast('playback_state', this.playbackState);

    return command;
  }

  /**
   * Cast a media item directly to the big TV screen
   */
  public async castMediaToTv(mediaId: string, startTime: number = 0): Promise<boolean> {
    const db = getDatabaseService().getDb();
    const row = db
      .prepare(`
        SELECT m.*, c.name as category_name, c.color as category_color
        FROM media m
        LEFT JOIN categories c ON m.category_id = c.id
        WHERE m.id = ?
      `)
      .get(mediaId) as any;

    if (!row) {
      throw new Error(`Media not found with id: ${mediaId}`);
    }

    const media: MediaItem = {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      subType: row.sub_type,
      title: row.title,
      description: row.description,
      categoryId: row.category_id,
      categoryName: row.category_name,
      categoryColor: row.category_color,
      isPrivate: Boolean(row.is_private),
      fileSize: row.file_size,
      mimeType: row.mime_type,
      originalFilename: row.original_filename,
      fileExtension: row.file_extension,
      width: row.width,
      height: row.height,
      duration: row.duration,
      playCount: row.play_count,
      isFavorite: Boolean(row.is_favorite),
      playbackPosition: row.playback_position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Update state
    this.playbackState.currentMedia = media;
    this.playbackState.playbackState = 'playing';
    this.playbackState.currentTime = startTime || media.playbackPosition || 0;
    this.playbackState.duration = media.duration || 0;
    this.playbackState.lastUpdated = new Date().toISOString();

    // Trigger CEC "Active Source" and "Image View On" to wake TV and switch input
    this.wakeAndSwitchTvInput();

    // Broadcast Cast command to TV display
    this.broadcast('cast_media', {
      media,
      startTime: this.playbackState.currentTime,
    });

    // Broadcast state update to phone remotes
    this.broadcast('playback_state', this.playbackState);

    logger.info({ title: media.title, type: media.type }, '📺 Casted media to HDMI TV screen');
    return true;
  }

  /**
   * Send CEC commands to wake TV and switch to Raspberry Pi input
   */
  private wakeAndSwitchTvInput(): void {
    if (this.cecProcess && this.cecProcess.stdin) {
      try {
        // 'as': Active Source (tells TV to switch input to Pi)
        this.cecProcess.stdin.write('as\n');
        // 'tx 10 04': Image View On
        this.cecProcess.stdin.write('tx 10 04\n');
      } catch {
        // ignore
      }
    }
  }

  /**
   * Update playback state reported from the active TV player
   */
  public updatePlaybackState(state: Partial<TvPlaybackState>): TvPlaybackState {
    this.playbackState = {
      ...this.playbackState,
      ...state,
      lastUpdated: new Date().toISOString(),
    };

    this.broadcast('playback_state', this.playbackState);
    return this.playbackState;
  }

  /**
   * Register a client for Server-Sent Events (SSE)
   */
  public addSseClient(reply: FastifyReply): void {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders();

    this.sseClients.add(reply);

    // Send initial snapshot
    const initialData = JSON.stringify(this.getStatus());
    reply.raw.write(`event: initial_state\ndata: ${initialData}\n\n`);

    // Clean up on disconnect
    reply.raw.on('close', () => {
      this.sseClients.delete(reply);
    });
  }

  /**
   * Broadcast message to all active SSE subscribers
   */
  public broadcast(eventName: string, data: any): void {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.raw.write(payload);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  /**
   * Get complete status of HDMI connection and playback
   */
  public getStatus(): TvSessionStatus {
    const hdmi: HdmiDisplayStatus = {
      connected: this.isConnected,
      port: this.connectedPort,
      resolution: this.resolution,
      audioSink: this.audioSink,
      cecSupported: this.cecAvailable,
      tvModel: this.tvModelName,
      isKioskRunning: this.kioskRunning,
    };

    return {
      hdmi,
      playback: this.playbackState,
      activeClientCount: this.sseClients.size,
    };
  }

  /**
   * For simulated desktop testing: toggle HDMI connection state manually
   */
  public simulateConnectionToggle(connected: boolean): TvSessionStatus {
    this.isConnected = connected;
    if (connected) {
      this.connectedPort = 'HDMI-A-1 (Test Mode)';
      this.tvModelName = 'Vesper Cinema TV 4K';
      this.resolution = '3840x2160@60Hz';
      this.audioSink = 'HDMI 4K Direct Passthrough';
      this.cecAvailable = true;
      this.handleDisplayConnected();
    } else {
      this.handleDisplayDisconnected();
    }
    return this.getStatus();
  }
}

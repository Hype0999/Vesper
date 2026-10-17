import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../utils/logger.js';
import type { NetworkStatus, WifiNetwork } from '@media-hub/shared';

const execFileAsync = promisify(execFile);

export class NetworkService {
  /**
   * Get active network information and IP address
   */
  public async getNetworkStatus(): Promise<NetworkStatus> {
    const interfaces = os.networkInterfaces();
    let detectedIp = '127.0.0.1';
    let isConnected = false;

    // Find primary non-internal IPv4 address
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          detectedIp = addr.address;
          isConnected = true;
          // Prefer wlan0 or Wi-Fi if available
          if (name.toLowerCase().includes('wlan') || name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wl')) {
            break;
          }
        }
      }
      if (isConnected && (name.toLowerCase().includes('wlan') || name.toLowerCase().includes('wi-fi'))) {
        break;
      }
    }

    const hostname = os.hostname().toLowerCase();
    const localDomain = `${hostname}.local`;

    let activeSsid: string | undefined = undefined;
    let isHotspot = false;
    let networks: WifiNetwork[] = [];

    // On Linux (Raspberry Pi OS) with NetworkManager (nmcli)
    if (process.platform === 'linux') {
      try {
        const { stdout } = await execFileAsync('nmcli', ['-t', '-f', 'active,ssid,signal,security', 'dev', 'wifi']);
        const lines = stdout.split('\n').filter(Boolean);
        for (const line of lines) {
          const [active, ssid, signal, security] = line.split(':');
          if (ssid) {
            const inUse = active === 'yes';
            if (inUse) activeSsid = ssid;
            networks.push({
              ssid,
              signal: parseInt(signal || '50', 10),
              security: security || 'Open',
              inUse,
            });
          }
        }
      } catch {
        // Fallback or nmcli not active yet
      }

      // Check if hotspot is active
      try {
        const { stdout } = await execFileAsync('nmcli', ['-t', '-f', 'NAME,TYPE', 'con', 'show', '--active']);
        if (stdout.toLowerCase().includes('hotspot') || stdout.toLowerCase().includes('vesper-hotspot')) {
          isHotspot = true;
          activeSsid = 'Vesper-Pi-Travel';
        }
      } catch {
        // Ignore
      }
    } else {
      // Laptop / Development Fallback Simulation
      activeSsid = 'Laptop-Host-Network';
      networks = [
        { ssid: 'Train-HighSpeed-WiFi', signal: 78, security: 'WPA2-PSK', inUse: false },
        { ssid: 'Phone-Personal-Hotspot', signal: 95, security: 'WPA2-PSK', inUse: false },
        { ssid: 'Vesper-Pi-Travel', signal: 100, security: 'WPA2-PSK', inUse: true },
      ];
    }

    return {
      connected: isConnected,
      ipAddress: detectedIp,
      localDomain,
      ssid: activeSsid,
      isHotspot,
      hotspotSsid: isHotspot ? 'Vesper-Pi-Travel' : undefined,
      availableNetworks: networks,
    };
  }

  /**
   * Scan for nearby Wi-Fi SSIDs
   */
  public async scanWifi(): Promise<WifiNetwork[]> {
    if (process.platform === 'linux') {
      try {
        await execFileAsync('nmcli', ['dev', 'wifi', 'rescan']);
      } catch {
        // Ignore rescan rate limit
      }

      try {
        const { stdout } = await execFileAsync('nmcli', ['-t', '-f', 'active,ssid,signal,security', 'dev', 'wifi']);
        const lines = stdout.split('\n').filter(Boolean);
        const map = new Map<string, WifiNetwork>();

        for (const line of lines) {
          const [active, ssid, signal, security] = line.split(':');
          if (ssid && ssid.trim() && !map.has(ssid)) {
            map.set(ssid, {
              ssid: ssid.trim(),
              signal: parseInt(signal || '50', 10),
              security: security || 'Open',
              inUse: active === 'yes',
            });
          }
        }
        return Array.from(map.values()).sort((a, b) => b.signal - a.signal);
      } catch (err) {
        logger.warn({ err }, 'Failed to scan Wi-Fi networks on Linux');
        return [];
      }
    }

    // Windows / laptop dev fallback
    return [
      { ssid: 'Train-HighSpeed-WiFi', signal: 88, security: 'WPA2-PSK', inUse: false },
      { ssid: 'Phone-Personal-Hotspot', signal: 96, security: 'WPA2-PSK', inUse: true },
      { ssid: 'Station-Public-WiFi', signal: 62, security: 'Open', inUse: false },
    ];
  }

  /**
   * Connect to an existing Wi-Fi network (e.g. phone's personal hotspot or train Wi-Fi)
   */
  public async connectWifi(ssid: string, password?: string): Promise<{ success: boolean; message: string }> {
    const cleanSsid = ssid.trim();
    if (!cleanSsid || cleanSsid.length > 32) {
      return { success: false, message: 'Invalid Wi-Fi network name' };
    }

    if (process.platform === 'linux') {
      try {
        logger.info({ ssid: cleanSsid }, 'Connecting to Wi-Fi network...');
        // If hotspot is active, bring it down first
        try {
          await execFileAsync('nmcli', ['con', 'down', 'Vesper-Hotspot']);
        } catch { /* ignore */ }

        const args = password
          ? ['dev', 'wifi', 'connect', cleanSsid, 'password', password]
          : ['dev', 'wifi', 'connect', cleanSsid];
        const { stdout } = await execFileAsync('nmcli', args);
        logger.info({ stdout }, 'Connected to Wi-Fi successfully');
        return { success: true, message: `Connected to ${cleanSsid} successfully` };
      } catch (err) {
        logger.error({ err, ssid: cleanSsid }, 'Failed to connect to Wi-Fi');
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Failed to connect to Wi-Fi network',
        };
      }
    }

    // Dev simulation
    return { success: true, message: `Simulated connection to ${cleanSsid} (Development Mode)` };
  }

  /**
   * Toggle Raspberry Pi Wi-Fi Hotspot / Access Point
   */
  public async toggleHotspot(enable: boolean, ssid = 'Vesper-Pi-Travel', password = 'vesperpass'): Promise<{ success: boolean; message: string }> {
    const cleanSsid = ssid.trim() || 'Vesper-Pi-Travel';
    const cleanPass = (password || 'vesperpass').trim();

    if (cleanPass.length < 8) {
      return { success: false, message: 'Hotspot password must be at least 8 characters' };
    }

    if (process.platform === 'linux') {
      try {
        if (enable) {
          logger.info({ ssid: cleanSsid }, 'Starting Vesper Sanctuary Wi-Fi Hotspot...');
          try {
            await execFileAsync('nmcli', ['con', 'up', 'Vesper-Hotspot']);
            return { success: true, message: `Hotspot "${cleanSsid}" started. Connect your phone now.` };
          } catch {
            await execFileAsync('nmcli', ['dev', 'wifi', 'hotspot', 'ssid', cleanSsid, 'password', cleanPass]);
            return { success: true, message: `Hotspot "${cleanSsid}" started. Connect your phone now.` };
          }
        } else {
          logger.info('Stopping Raspberry Pi Wi-Fi Hotspot...');
          try {
            await execFileAsync('nmcli', ['con', 'down', 'Vesper-Hotspot']);
          } catch {
            try {
              await execFileAsync('nmcli', ['con', 'down', 'Hotspot']);
            } catch {
              await execFileAsync('nmcli', ['con', 'down', cleanSsid]).catch(() => {});
            }
          }
          return { success: true, message: 'Hotspot stopped. Reconnected to standard Wi-Fi.' };
        }
      } catch (err) {
        logger.error({ err }, 'Failed to toggle Wi-Fi hotspot');
        return { success: false, message: err instanceof Error ? err.message : 'Failed to configure hotspot' };
      }
    }

    return {
      success: true,
      message: enable
        ? `Hotspot "${cleanSsid}" enabled (Development Mode)`
        : 'Hotspot disabled (Development Mode)',
    };
  }
}

let networkServiceInstance: NetworkService | null = null;
export function getNetworkService(): NetworkService {
  if (!networkServiceInstance) {
    networkServiceInstance = new NetworkService();
  }
  return networkServiceInstance;
}

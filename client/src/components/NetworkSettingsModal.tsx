import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  Radio,
  RefreshCw,
  QrCode,
  X,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { NetworkStatus, WifiNetwork, ApiResponse } from '@media-hub/shared';

interface NetworkSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkSettingsModal: React.FC<NetworkSettingsModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [availableNetworks, setAvailableNetworks] = useState<WifiNetwork[]>([]);
  const [selectedSsid, setSelectedSsid] = useState<string>('');
  const [wifiPassword, setWifiPassword] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showQr, setShowQr] = useState<boolean>(true);
  const [qrMode, setQrMode] = useState<'url' | 'wifi'>('url');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/network/status');
      if (res.ok) {
        const json: ApiResponse<{ status: NetworkStatus }> = await res.json();
        if (json.success && json.data?.status) {
          setStatus(json.data.status);
          setAvailableNetworks(json.data.status.availableNetworks || []);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  }, []);

  const scanWifi = async () => {
    try {
      setIsScanning(true);
      const res = await fetch('/api/network/scan');
      if (res.ok) {
        const json: ApiResponse<{ networks: WifiNetwork[] }> = await res.json();
        if (json.success && json.data?.networks) {
          setAvailableNetworks(json.data.networks || []);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSsid) return;

    setIsConnecting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/network/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ ssid: selectedSsid, password: wifiPassword }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setStatusMessage({ text: json.data?.message || 'Connected successfully', type: 'success' });
        setSelectedSsid('');
        setWifiPassword('');
        void fetchStatus();
      } else {
        setStatusMessage({ text: json.error?.message || 'Connection failed', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'Network request failed', type: 'error' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleToggleHotspot = async (enable: boolean) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/network/hotspot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ enable }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setStatusMessage({ text: json.data?.message || 'Hotspot updated', type: 'success' });
        void fetchStatus();
      } else {
        setStatusMessage({ text: json.error?.message || 'Hotspot toggle failed', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'Failed to update hotspot state', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchStatus();
    }
  }, [isOpen, fetchStatus]);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'http://travelhub.local:3000';
  const qrDirectUrl = status?.ipAddress
    ? `http://${status.ipAddress}:3000`
    : currentUrl;
  const hotspotSsid = status?.isHotspot ? (status?.ssid || 'Vesper-Pi-Travel') : 'Vesper-Pi-Travel';
  const wifiQrString = `WIFI:T:WPA;S:${hotspotSsid};P:vesperpass;;`;
  const targetQrPayload = qrMode === 'wifi' ? wifiQrString : qrDirectUrl;

  useEffect(() => {
    if (targetQrPayload) {
      const generateQr = async () => {
        try {
          const fn =
            typeof (QRCode as any)?.toDataURL === 'function'
              ? (QRCode as any).toDataURL
              : typeof (QRCode as any)?.default?.toDataURL === 'function'
              ? (QRCode as any).default.toDataURL
              : null;

          if (fn) {
            const url = await fn(targetQrPayload, {
              width: 280,
              margin: 1,
              color: {
                dark: '#0a0d14',
                light: '#ffffff',
              },
            });
            setQrCodeDataUrl(url);
          }
        } catch (err) {
          console.warn('Failed to generate offline QR code', err);
        }
      };
      void generateQr();
    }
  }, [targetQrPayload]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
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
            }}
          >
            <Wifi size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Travel Network & Wi-Fi
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Connect phones, tablets, and update train/hotspot wireless
            </p>
          </div>
        </div>

        {statusMessage && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              marginBottom: 'var(--space-4)',
              background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: statusMessage.type === 'success' ? '#10b981' : '#ef4444',
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Current Active Connection Status Card */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: status?.connected ? '#10b981' : '#f59e0b',
                  boxShadow: status?.connected ? '0 0 8px #10b981' : 'none',
                }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                {status?.isHotspot ? 'Raspberry Pi Hotspot Active' : (status?.ssid ? `Connected to ${status.ssid}` : 'Network Online')}
              </span>
            </div>
            <button
              onClick={() => void fetchStatus()}
              disabled={isLoading}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
            >
              <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            </button>
          </div>

          {/* Quick Access Addresses */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Local IP Address</span>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                http://{status?.ipAddress || '127.0.0.1'}:3000
              </div>
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>mDNS Domain</span>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#38bdf8' }}>
                http://{status?.localDomain || 'raspberrypi.local'}:3000
              </div>
            </div>
          </div>

          {/* Fast Mobile Phone Connect Link & QR Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              📱 Open on phone or connect directly to Pi
            </span>
            <button
              onClick={() => setShowQr(!showQr)}
              className="btn btn-ghost"
              style={{ padding: '4px 8px', fontSize: '0.75rem', gap: '4px' }}
            >
              <QrCode size={13} />
              <span>{showQr ? 'Hide QR' : 'Show Phone QR'}</span>
            </button>
          </div>

          {/* Visual QR Card for instant phone scanning */}
          {showQr && (
            <div
              style={{
                marginTop: '10px',
                padding: 'var(--space-4)',
                background: '#ffffff',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
              }}
            >
              {/* QR Mode Switcher */}
              <div
                style={{
                  display: 'flex',
                  background: '#f1f5f9',
                  padding: '3px',
                  borderRadius: '6px',
                  marginBottom: '10px',
                  width: '100%',
                  maxWidth: '260px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setQrMode('url')}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: qrMode === 'url' ? '#ffffff' : 'transparent',
                    color: qrMode === 'url' ? '#0f172a' : '#64748b',
                    boxShadow: qrMode === 'url' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  🌐 Open Vesper
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode('wifi')}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: qrMode === 'wifi' ? '#ffffff' : 'transparent',
                    color: qrMode === 'wifi' ? '#0f172a' : '#64748b',
                    boxShadow: qrMode === 'wifi' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📶 Join Hotspot
                </button>
              </div>

              {/* Local Offline QR Code */}
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Scan to connect"
                  style={{ width: '180px', height: '180px', borderRadius: '6px' }}
                />
              ) : (
                <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                  Generating QR Code...
                </div>
              )}

              <p style={{ margin: '8px 0 2px 0', fontSize: '0.78rem', color: '#0f172a', fontWeight: 700 }}>
                {qrMode === 'url' ? 'Scan to open Vesper in phone browser' : 'Scan with camera to connect to Hotspot'}
              </p>
              <span style={{ fontSize: '0.7rem', color: '#475569', wordBreak: 'break-all' }}>
                {qrMode === 'url' ? qrDirectUrl : `Wi-Fi: ${hotspotSsid} (Pass: travelhubpass)`}
              </span>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '8px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: '#ecfdf5',
                  color: '#059669',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                }}
              >
                <ShieldCheck size={12} />
                <span>100% Offline Local Engine (No Internet Required)</span>
              </div>
            </div>
          )}
        </div>

        {/* Travel Hotspot Mode Switch */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                  Travel Wi-Fi Hotspot (AP Mode)
                </h3>
                <span style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  AUTO-FAILOVER ON BOOT
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 6px 0' }}>
                When traveling on trains without your home Wi-Fi, the Pi automatically broadcasts this hotspot within 12 seconds so your phone can connect instantly.
              </p>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>SSID: <strong style={{ color: '#ffffff' }}>Vesper-Pi-Travel</strong></span>
                <span>Password: <strong style={{ color: '#ffffff' }}>vesperpass</strong></span>
                <span>Direct IP: <strong style={{ color: '#10b981' }}>10.42.0.1:3000</strong></span>
              </div>
            </div>
            {status?.isHotspot ? (
              <button
                className="btn btn-secondary"
                onClick={() => void handleToggleHotspot(false)}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', whiteSpace: 'nowrap' }}
              >
                Stop Hotspot
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => void handleToggleHotspot(true)}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderColor: 'transparent',
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.8rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <Radio size={14} />
                <span>Start Hotspot</span>
              </button>
            )}
          </div>
        </div>

        {/* Available Wi-Fi Networks Scanner */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Nearby Wi-Fi Networks
            </span>
            <button
              onClick={() => void scanWifi()}
              disabled={isScanning}
              className="btn btn-ghost"
              style={{ fontSize: '0.75rem', padding: '4px 8px', gap: '4px' }}
            >
              <RefreshCw size={12} className={isScanning ? 'spin' : ''} />
              <span>{isScanning ? 'Scanning...' : 'Rescan Wi-Fi'}</span>
            </button>
          </div>

          <div
            style={{
              maxHeight: '180px',
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
              marginBottom: 'var(--space-4)',
            }}
          >
            {availableNetworks.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No Wi-Fi networks found. Click Rescan Wi-Fi.
              </div>
            ) : (
              availableNetworks.map((net) => (
                <div
                  key={net.ssid}
                  onClick={() => setSelectedSsid(net.ssid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: selectedSsid === net.ssid ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface)',
                    borderLeft: selectedSsid === net.ssid ? '3px solid #10b981' : '3px solid transparent',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wifi size={15} style={{ color: net.inUse ? '#10b981' : 'var(--text-muted)' }} />
                    <span style={{ fontWeight: net.inUse ? 600 : 400, color: net.inUse ? '#10b981' : 'var(--text-primary)' }}>
                      {net.ssid}
                    </span>
                    {net.inUse && (
                      <span style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '1px 5px', borderRadius: '4px' }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    <span>{net.signal}%</span>
                    {net.security !== 'Open' && <Lock size={12} />}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Connect Form when a network is chosen */}
          {selectedSsid && (
            <form
              onSubmit={handleConnect}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
                  Connect to: <span style={{ color: '#10b981' }}>{selectedSsid}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSsid('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                >
                  <X size={14} />
                </button>
              </div>
              <input
                type="password"
                className="input"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder="Wi-Fi Password (leave blank if Open)"
                disabled={isConnecting}
                style={{ fontSize: '0.85rem' }}
                autoFocus
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isConnecting}
                style={{
                  background: '#10b981',
                  borderColor: '#10b981',
                  fontSize: '0.82rem',
                  padding: '0.4rem',
                  justifyContent: 'center',
                }}
              >
                {isConnecting ? 'Connecting...' : 'Connect to Network'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

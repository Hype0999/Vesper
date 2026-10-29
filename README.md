# Vesper — Personal Media Sanctuary
### Ultra-Reliable, Zero-Transcode Private Offline Travel Media Hub for Raspberry Pi 4 & Mobile Devices

<div align="center">

![Vesper Music Sanctuary](docs/images/vesper-music-sanctuary.png)

[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B%20LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.0-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://www.fastify.io/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Encryption](https://img.shields.io/badge/Cipher-AES--256--CTR-F59E0B?style=for-the-badge&logo=lock&logoColor=white)](#-cryptographic-vault--physical-theft-protection)
[![Zero-Transcode](https://img.shields.io/badge/CPU%20Load-0%25%20Passthrough-10B981?style=for-the-badge&logo=speedtest&logoColor=white)](#-2-zero-transcode-4k-direct-streaming)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-purple?style=for-the-badge)](LICENSE)
[![Author](https://img.shields.io/badge/Crafted%20by-Kartikeya%20Saini-emerald?style=for-the-badge)](#-author--credits)

**Designed and crafted with obsessive precision by Kartikeya Saini**

</div>

---

## 🌟 Overview

**Vesper** (`/ˈvɛspər/` — *the evening star, calm obsidian sanctuary*) is a state-of-the-art, self-hosted, offline-first personal media sanctuary engineered specifically for train journeys, flights, and travel without internet connectivity.

Running directly on a low-power **Raspberry Pi 4 (8GB RAM)** or personal laptop, Vesper allows you and your travel companions to stream high-bitrate 4K movies, listen to high-fidelity music with Spotify-grade album cover art, browse private photo galleries with Google Photos chronological grouping, and write secure travel notes—with **zero cellular data**, **0% CPU transcode load**, and **complete cryptographic privacy**.

---

## 🚀 Key Highlights & Architectural Features

### 🎬 1. YouTube-Standard Cinema Player (Desktop & Mobile)
Vesper completely abandons generic, clunky AI-style media players in favor of authentic YouTube desktop and mobile ergonomics:
- **Verified Creator Channel Bar**: Verified channel badge (`CheckCircle2`), creator insignia with active online status indicator, and an interactive **YouTube Subscribe / Subscribed Pill** with bell notifications.
- **YouTube Segmented Capsule Action Bar**:
  - **Segmented Like / Dislike**: Authentic capsule with live compact like counter (`1.4K`), vertical hairline divider, and dislike button.
  - **Share Pill**: Direct streaming clipboard copy with instant visual check feedback.
  - **Download Pill**: Direct original bitstream download.
  - **Save Pill**: Watchlist and vault playlist bookmarking.
  - **Reclassify to Memories**: 1-click reclassification to Google Photos family video collection.
  - **More Options (`...`)**: Loop toggle, video diagnostics, and permanent removal.
- **YouTube Sleek Description Box**: Dark frosted container (`#272727`), views counter, relative upload date, trending tags (`#VesperCinema #4KDirect #ZeroTranscode`), technical badges (`4K UHD Direct Passthrough`, `RFC-7233 512KB Chunks`, `0% CPU Transcode`), and expandable *Show more / Show less* toggle.
- **Up Next / Recommendation Feed**: 16:9 thumbnail ratio cards with monospace duration badges, 2-line title clamps, channel name, and view statistics.
- **Official YouTube Keyboard Hotkeys**:
  - `Space` or `k`: Play / Pause with center ripple animation
  - `j` / `l`: Jump backward / forward 10 seconds with double-tap ripple
  - `Left` / `Right Arrow`: Jump backward / forward 5 seconds
  - `Up` / `Down Arrow`: Adjust volume by 5%
  - `m`: Mute / Unmute
  - `f`: Toggle full screen
  - `t`: Toggle theater mode

### 📸 2. Google Photos & Memories Suite (Photos + Family Videos Separation)
Vesper solves the common media server frustration of mixing personal phone memories with feature-length films:
- **Automatic Smart Ingestion Separation**:
  - **Movies Library**: Full-length cinema, feature films, and series (`/movies`, `/cinema`).
  - **Photos & Memories**: Phone videos, family recordings, holiday clips (`DCIM/`, `Camera/`, `VID_`, `MOV_`, `PXL_`, `IMG_`), and photos.
- **Chronological Timeline Clustering**: Media is organized into chronological timeline date headers (*Today*, *Yesterday*, *Month Year*).
- **Batch Multi-Select Action Bar**: Select multiple memories to batch-favorite, reclassify to Movies, or batch-delete in one click.
- **Google Photos Minimalist Lightbox**: High-resolution zoomable viewer with an interactive EXIF metadata drawer (`i`) revealing dimensions, file size, timestamp, and camera metadata.

### ⚡ 3. Zero-Transcode 4K Direct Streaming (Ice-Cool Pi 4 Thermals)
- RFC 7233 compliant HTTP byte-range streaming with 512KB chunks.
- Delivers ultra-smooth direct streaming for 4K 60fps, 1080p, HEVC, and high-bitrate video.
- **Zero CPU transcoding load**: Your Raspberry Pi 4 runs ice-cool (< 45°C) even with multiple devices streaming simultaneously.

### 🎵 4. Spotify-Grade Music Sanctuary
- **Native ID3 Album Art Extraction**: Automatically extracts embedded APIC front-cover artwork directly from MP3, FLAC, M4A, and AAC files via FFmpeg copy streams.
- **Ambient Glowing Backdrops**: Renders dynamic blurred background lighting tailored to the active song's palette.
- **Resilient Fallback**: Sleek vinyl disc artwork guarantees no song banner or track row ever displays a blank void.
- Persistent playback bar with scrubbing, queue management, and volume controls docked above mobile thumb navigation.

### 🔒 5. Cryptographic Vault & Physical Pendrive Theft Protection
- Multi-tier step-up authorization with Argon2id passphrase hashing and dedicated vault sessions.
- **At-Rest AES-256-CTR File Encryption**: All Private Vault media and thumbnails are encrypted on the physical storage device (`.enc`).
- **Physical Theft Protection**: If an unauthorized party removes the USB flash drive or SD card, the raw files cannot be read without the server's session secret and vault authorization.
- On-the-fly random-access stream decryption with zero CPU transcode overhead.

### 💾 6. Secret Admin Station & USB Pendrive Ingestion Engine
- **Cross-Platform Drive Auto-Detection**: Instant discovery of USB drives, thumbdrives, and external storage (Linux `/media`, `/mnt`, `lsblk`, and Windows drive letters).
- **Non-Blocking Multi-Upload Engine**:
  - Files are processed in compact batches of 4 for fluid, live percentage tracking (`0%` to `100%`).
  - **Anti-Hang Protection**: Every file ingestion is guarded by an internal 25-second watchdog timer, and FFmpeg frame extractions have strict 7-second timeouts with instant SVG poster fallbacks.
  - **Cancellation Support**: A *Cancel Ingestion* button allows stopping remaining queued files without hanging the system.
- **Hardware Telemetry**: Real-time Raspberry Pi CPU core thermals (<45°C), RAM headroom, active companion count, and temporary cache purger.

### 🍎 7. Apple + Google Fluid Consumer Design
- **Serene Control Center Capsule**: Instead of cluttered buttons, utility controls (Wi-Fi status with live green ping dot, Companion manager, Guardian thermals, Vault lock/unlock, and Admin Station) are unified into an Apple-style frosted glass capsule.
- **Liquid Display Transitions**: Built with custom spring physics (`cubic-bezier(0.16, 1, 0.3, 1)` and `cubic-bezier(0.32, 0.72, 0, 1)`).
- **Specular Shimmer Skeletons**: 45-degree sweeping specular reflection gradient skeletons for smooth perceived loading.
- **Mobile Touch Ergonomics**: Minimum 44px tap targets, sticky glass bottom navigation, and safe-area inset compliance for notched iPhones and Androids.

### 🚆 8. Automated Travel Hotspot Failover (Solves the Train Wi-Fi Problem)
When traveling, your Raspberry Pi cannot reach your home Wi-Fi network. Standard setups stay idle in client mode with no IP and no signal broadcast.
- Vesper's background watchdog (`vesper-autohotspot.service`) waits 12 seconds on boot.
- If home Wi-Fi is unreachable, it **automatically switches into Access Point (AP) mode**!
- Broadcasts the Wi-Fi network: **`Vesper-Pi-Travel`** (Password: **`vesperpass`**).
- Connect your iPhone or Android and open **`http://10.42.0.1:3000`** or **`http://vesper.local:3000`** without needing a monitor, keyboard, or external router!

---

## 🏛️ Architectural Comparison: Vesper vs. Plex, Jellyfin & Kodi

*Plex, Jellyfin, and Kodi are world-class media solutions with immense achievements in the open-source and home entertainment ecosystems. Vesper does not compete with their home theater features; rather, it was engineered with a fundamentally different design philosophy focused on **ultra-mobile, battery-powered travel, offline independence, and cryptographic privacy**.*

| Dimension | 🚆 Vesper (Travel Sanctuary) | 🏠 Plex | 🌐 Jellyfin | 📺 Kodi |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Purpose** | **Travel & Trains**: Completely offline personal media sanctuary for mobile phones & laptops. | **Home Theater**: Central media library streaming to smart TVs, clients, and remote devices. | **Self-Hosted Home Media**: Open-source server for home gigabit LANs. | **Living Room Client**: Media player interface directly connected to a TV display. |
| **Internet Dependency** | **100% Zero-Internet**: Autonomous AP failover (`Vesper-Pi-Travel`, `10.42.0.1`). | Often relies on `plex.tv` cloud servers for account authentication. | Works offline on local LAN, but requires existing router/DHCP network. | Offline player, but requires local screen/HDMI connection. |
| **Transcoding & Thermals** | **Zero Transcode**: Strict RFC 7233 direct streams (<45°C on Pi 4 with 0% CPU overhead). | Often transcodes via FFmpeg in real-time, spiking Pi CPU to 80°C+ & draining battery. | Server-side transcode can overwhelm low-power ARM SoCs without hardware encoders. | Direct decode by device player (client-centric). |
| **Physical Theft Protection** | **AES-256-CTR at Rest**: Private Vault files are encrypted blobs (`.enc`). Unreadable if drive is stolen. | Unencrypted files stored in plaintext on disk/storage. | Unencrypted files stored in plaintext on disk/storage. | Unencrypted files stored in plaintext on disk/storage. |
| **Memory Footprint** | **< 60 MB RAM**: Fastify + SQLite WAL engine. Extremely lightweight. | ~300 MB – 1 GB+ RAM idle/runtime. | ~350 MB – 1.2 GB RAM (.NET runtime). | ~150 MB – 400 MB RAM (UI player process). |
| **Client Requirement** | **Pure Web Browser**: No app store install required. Works on any iPhone/Android. | Requires installing Plex apps (often requires Plex Pass or activation fee). | Requires installing Jellyfin app or accessing heavy web client. | Must run directly on the physical display hardware. |
| **Setup on the Go** | **Zero Router Needed**: Broadcasts its own Wi-Fi hotspot in 12s on boot. | Requires an existing home router & Wi-Fi infrastructure. | Requires an existing home router & Wi-Fi infrastructure. | Requires monitor and keyboard/remote. |

---

## ⌨️ Complete Keyboard Shortcuts Reference

### 🎬 YouTube Cinema Player Hotkeys
| Key | Action |
| :--- | :--- |
| `Space` or `k` | Toggle Play / Pause |
| `j` | Jump backward 10 seconds (with left ripple) |
| `l` | Jump forward 10 seconds (with right ripple) |
| `Left Arrow` | Skip backward 5 seconds |
| `Right Arrow` | Skip forward 5 seconds |
| `Up Arrow` | Volume up by 5% |
| `Down Arrow` | Volume down by 5% |
| `m` | Mute / Unmute audio |
| `f` | Toggle Full Screen |
| `t` | Toggle Theater Mode |
| `Esc` | Exit Full Screen / Close Cinema Player |

### 📸 Google Photos Lightbox Hotkeys
| Key | Action |
| :--- | :--- |
| `Left Arrow` | View Previous Memory |
| `Right Arrow` | View Next Memory |
| `Space` | Play / Pause Family Video |
| `i` | Toggle EXIF Metadata Drawer |
| `Esc` | Close Lightbox |

---

## 🍓 Raspberry Pi 4 (8GB) SSH & Installation Guide

### Step 1: Connect to Your Raspberry Pi via SSH
From your laptop terminal (PowerShell, macOS, or Linux):
```bash
ssh pi@raspberrypi.local
# Or using the direct IP:
# ssh pi@192.168.1.xxx
```

### Step 2: Clone the Repository
```bash
git clone https://github.com/<your-username>/vesper.git ~/vesper
cd ~/vesper
```

### Step 3: Run the 1-Click Automated Installer
```bash
sudo bash scripts/install-pi.sh
```

**What the installer handles automatically:**
1. Installs system packages: `avahi-daemon`, `network-manager`, `build-essential`, `libnss-mdns`.
2. Installs Node.js 20 LTS.
3. Compiles the frontend SPA and backend production bundles.
4. Installs the **Auto-Hotspot Failover Service** (`vesper-autohotspot.service`).
5. Configures and starts the **Vesper Systemd Service** (`vesper.service`) with auto-restart on boot.

---

## 📱 Connecting Your Phone on the Train

### Method A: Automatic Hotspot Mode (Recommended for Travel)
1. Power on your Raspberry Pi (via any 5V/3A USB-C power bank or train outlet).
2. Wait ~15 seconds: The Pi detects that your home Wi-Fi is unavailable and automatically activates **Access Point (AP) mode**:
   - **Wi-Fi Name (SSID)**: `Vesper-Pi-Travel`
   - **Wi-Fi Password**: `vesperpass`
3. Connect your phone or laptop to `Vesper-Pi-Travel`.
4. Open your browser and navigate to:
   - 👉 **`http://10.42.0.1:3000`** or **`http://vesper.local:3000`**

### Method B: Connect Pi to Your Phone's Personal Hotspot
1. Turn on **Personal Hotspot** on your phone.
2. In Vesper, click the **Wi-Fi icon** in the Control Center Capsule.
3. Scan for nearby Wi-Fi networks, select your Phone's hotspot, enter the password, and click **Connect**.
4. Once connected, open:
   - 👉 **`http://vesper.local:3000`**

---

## 💻 Running Locally on Windows / Mac / Linux Laptop

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build Production Bundle**:
   ```bash
   npm run build
   ```

3. **Launch Vesper**:
   - On Windows: Double-click `scripts/start-windows.bat` or run:
     ```cmd
     npm run start
     ```
   - Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Run Tests**:
   ```bash
   npm run test
   ```
   *(All 42 automated unit & integration tests pass with 100% success)*.

---

## 📁 Repository Structure

```
├── client/                     # Vite + React 18 Mobile-First SPA
│   ├── public/
│   │   └── favicon.svg         # Monolithic Vesper luxury platinum & gold emblem
│   ├── src/
│   │   ├── components/         # VideoPlayer, AudioPlayer, PhotosView, AdminCommandCenter, etc.
│   │   ├── pages/              # Dashboard, SetupWizard, Login
│   │   └── styles/             # Apple + Google fluid CSS tokens & liquid transitions
├── server/                     # Fastify Node.js Backend API
│   ├── src/
│   │   ├── config/             # Environment validation (env.ts)
│   │   ├── db/                 # SQLite database migrations (001-003) & schema
│   │   ├── middleware/         # Argon2id auth, vault auth, admin guard
│   │   ├── routes/             # Media, Admin, Auth, Notes, Network, Categories routes
│   │   ├── services/           # Media streaming, Admin USB discovery, NetworkManager, Vault cipher
│   │   └── utils/              # AES-256-CTR VaultCipher, redacted logger
│   └── tests/                  # Vitest automated test suite (42 tests across 6 suites)
├── shared/                     # Shared TypeScript interfaces & Zod schemas
├── scripts/                    # Raspberry Pi installer, auto-hotspot, Windows launchers
│   ├── install-pi.sh           # 1-Click Raspberry Pi 4 deployment script
│   ├── vesper-autohotspot.sh   # Automated travel Wi-Fi failover script
│   ├── vesper-autohotspot.service # Systemd failover watchdog
│   ├── start-windows.bat       # 1-Click Windows desktop launcher
│   ├── reset-password.bat      # 1-Click Windows password reset
│   ├── reset-password.mjs      # Cross-platform CLI credential manager
│   └── push-to-github.bat      # 1-Click Git repository initializer & push tool
├── docs/images/                # UI Showcase screenshots & diagrams
├── .gitignore                  # Strict exclusions preventing personal media leaks
└── README.md                   # Professional project documentation
```

---

## 🛡️ Security & Privacy Architecture

- **Zero Telemetry**: No third-party trackers, external CDNs, or cloud dependencies. Functions completely offline.
- **Argon2id Hashing**: Industry-standard resistant hashing for passwords and session tokens.
- **Origin & Referer Guards**: Strict state-modifying request validation prevents cross-site request forgery.
- **Encrypted at Rest**: Sensitive files are encrypted on the storage drive using AES-256-CTR.
- **Automatic Redaction**: Error logs and diagnostic outputs automatically redact passwords, session tokens, and system paths.

---

## 👨‍💻 Author & Credits

- **Creator & Lead Engineer**: **Kartikeya Saini**
- **Project**: Vesper Sanctuary Core (`vesper-sanctuary`)
- **License**: [AGPL-3.0 License](LICENSE)

*Vesper was designed and engineered for private, zero-transcode, ultra-reliable media streaming on trains and travels.*

# Vesper — Personal Media Sanctuary
### Ultra-Reliable, Zero-Transcode Private Offline Travel Media Hub for Raspberry Pi 4 & Mobile Devices

<div align="center">

![Vesper Music Sanctuary](docs/images/vesper-music-sanctuary.png)

[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B%20LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.28-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://www.fastify.io/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-purple?style=for-the-badge)](LICENSE)
[![Author](https://img.shields.io/badge/Crafted%20by-Kartikeya%20Saini-emerald?style=for-the-badge)](#-author--credits)

**Designed and crafted by Kartikeya Saini**

</div>

---

## 🌟 Overview

**Vesper** (`/ˈvɛspər/` — *the evening star, calm obsidian sanctuary*) is a modern, self-hosted, offline-first personal media sanctuary engineered specifically for train journeys, flights, and travel without reliable internet. 

Running directly on a low-power **Raspberry Pi 4 (8GB RAM)** or personal laptop, Vesper allows you and your travel companions to stream high-bitrate 4K movies, listen to high-fidelity music with Spotify-grade album cover art, browse private photo galleries, and write secure travel notes—with **zero cellular data**, **0% CPU transcode load**, and **complete cryptographic privacy**.

---

## 🚀 Key Highlights & Architectural Features

### 🚆 1. Automated Travel Hotspot Failover (Solves the Train Wi-Fi Problem)
When traveling, your Raspberry Pi cannot reach your home Wi-Fi network. Standard setups stay idle in client mode with no IP and no signal broadcast.
- Vesper's background watchdog (`vesper-autohotspot.service`) waits 12 seconds on boot.
- If home Wi-Fi is unreachable, it **automatically switches into Access Point (AP) mode**!
- Broadcasts the Wi-Fi network: **`Vesper-Pi-Travel`** (Password: **`vesperpass`**).
- Connect your iPhone or Android and open **`http://10.42.0.1:3000`** or **`http://vesper.local:3000`** without needing a monitor, keyboard, or external router!

### ⚡ 2. Zero-Transcode 4K Direct Streaming (Ice-Cool Pi 4 Thermals)
- RFC 7233 compliant HTTP byte-range streaming with 512KB chunks.
- Delivers ultra-smooth direct streaming for 4K 60fps, 1080p, HEVC, and high-bitrate video.
- **Zero CPU transcoding load**: Your Raspberry Pi 4 runs ice-cool (< 45°C) even with multiple devices streaming simultaneously.

### 🎵 3. Spotify-Grade Music Sanctuary
- **Native ID3 Album Art Extraction**: Automatically extracts embedded APIC front-cover artwork directly from MP3, FLAC, M4A, and AAC files via FFmpeg copy streams.
- **Ambient Glowing Backdrops**: Renders dynamic blurred background lighting tailored to the active song's palette.
- **Resilient Fallback**: Sleek vinyl disc artwork guarantees no song banner or track row ever displays a blank void.
- Persistent playback bar with scrubbing, queue management, and volume controls docked above mobile thumb navigation.

### 🎬 4. YouTube-Grade Video Sanctuary
- Modern 16:9 thumbnail ratio, category filter chips, and duration badges.
- **Stream Quality Selector**: Auto Direct, 4K Direct Passthrough, 1080p Passthrough, and 720p Mobile.
- **Scrubber Bar Timestamp Preview**: Hover/drag tooltip showing exact elapsed timestamps.
- Automatic playback position resume.

### 📸 5. Google Photos-Grade Photo Gallery
- Chronological timeline grouping (*Today*, *Yesterday*, *Month Year*).
- Fullscreen zoomable lightbox with interactive EXIF metadata drawer (`i`) revealing resolution, file size, date, and camera details.

### 🔒 6. Cryptographic Vault & Physical Pendrive Theft Protection
- Multi-tier step-up authorization with Argon2id passphrase hashing and dedicated vault sessions.
- **At-Rest AES-256-CTR File Encryption**: All Private Vault media and thumbnails are encrypted on the physical storage device (`.enc`).
- **Theft Protection**: If an unauthorized party removes the USB flash drive or SD card, the raw files cannot be read without the server's session secret and vault authorization.
- On-the-fly random-access stream decryption with zero CPU transcode overhead.

### 👥 7. Companion Access & Multi-User Sharing
- Dedicated public partition for sharing travel movies and playlists with friends.
- Strict cryptographic isolation for your Private Vault partition.
- Invite, manage, and configure companion users directly from the web interface.

---

## 🛠️ Tech Stack & Architecture

- **Core Runtime**: Node.js v20+ LTS / v24 LTS (TypeScript 5.5)
- **Backend API**: Fastify 4 (High performance, low footprint)
- **Database**: SQLite with WAL mode (`better-sqlite3`), robust foreign keys & connection pooling
- **Frontend SPA**: React 18, Vite 5, Lucide Icons, Pure Vanilla Modern CSS Design Tokens
- **Cryptography**: Argon2id (`argon2`), AES-256-CTR (`node:crypto`)
- **Image & Media Engine**: Sharp (WebP conversion), `@ffmpeg-installer/ffmpeg` (metadata extraction)
- **Networking**: NetworkManager (`nmcli`), Avahi Daemon (`.local` mDNS), Offline QR Code generation

---

## 🍓 Raspberry Pi 4 (8GB) SSH & Installation Guide

Follow these simple steps to install Vesper on your Raspberry Pi via SSH:

### Step 1: Connect to Your Raspberry Pi via SSH
From your laptop terminal (PowerShell, macOS, or Linux):
```bash
ssh pi@raspberrypi.local
# Or using the Pi's direct IP:
# ssh pi@192.168.1.xxx
```

### Step 2: Clone or Copy the Repository
Clone the repository to your Raspberry Pi user directory:
```bash
git clone https://github.com/<your-username>/vesper.git ~/vesper
cd ~/vesper
```
*(Alternatively, copy the project folder onto a USB drive or transfer via `scp -r "e:\Project KAz" pi@raspberrypi.local:~/vesper`)*.

### Step 3: Run the 1-Click Automated Installer
Run the installation script with root permissions:
```bash
sudo bash scripts/install-pi.sh
```

**What the installer handles automatically:**
1. Installs system dependencies: `avahi-daemon`, `network-manager`, `build-essential`, `libnss-mdns`.
2. Installs Node.js 20 LTS (if not already present).
3. Compiles the frontend SPA and backend production bundles.
4. Installs the **Auto-Hotspot Failover Service** (`vesper-autohotspot.service`).
5. Configures and starts the **Vesper Systemd Service** (`vesper.service`) with auto-restart on boot.

---

## 📱 Connecting Your Phone on the Train

### Method A: Automatic Hotspot Mode (Recommended for Travel)
1. Turn on your Raspberry Pi (powered by any 5V/3A USB-C power bank or train outlet).
2. Wait ~15 seconds: The Pi detects that your home Wi-Fi is unavailable and automatically activates **Access Point (AP) mode**:
   - **Wi-Fi Name (SSID)**: `Vesper-Pi-Travel`
   - **Wi-Fi Password**: `vesperpass`
3. Connect your phone or laptop to `Vesper-Pi-Travel`.
4. Open your browser and navigate to:
   - 👉 **`http://10.42.0.1:3000`** or **`http://vesper.local:3000`**

### Method B: Connect Pi to Your Phone's Personal Hotspot
1. Turn on **Personal Hotspot** on your phone.
2. In Vesper, click the **"Wi-Fi & Phone"** button in the header.
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
   *(All 34 automated unit & integration tests pass with 100% success)*.

---

## 🔄 1-Click Password & Vault Reset

If you ever need to reset your account password or vault passphrase:
- **On Windows**: Double-click `scripts/reset-password.bat`
- **On Linux / Raspberry Pi**:
  ```bash
  node scripts/reset-password.mjs <username> <newPassword> <newVaultPass>
  ```

---

## 📁 Repository Structure

```
├── client/                     # Vite + React 18 Mobile-First SPA
│   ├── src/
│   │   ├── components/         # VideoPlayer, AudioPlayer, SongsView, VaultView, etc.
│   │   ├── pages/              # Dashboard, SetupWizard, Login
│   │   └── styles/             # Obsidian Spotify/YouTube-inspired CSS design tokens
├── server/                     # Fastify Node.js Backend API
│   ├── src/
│   │   ├── config/             # Environment validation (env.ts)
│   │   ├── db/                 # SQLite database migrations & schema
│   │   ├── middleware/         # Argon2id auth, vault auth, CORS validation
│   │   ├── routes/             # Media, Auth, Notes, Network, Categories routes
│   │   ├── services/           # Media streaming, NetworkManager, Vault cipher
│   │   └── utils/              # AES-256-CTR VaultCipher, redacted logger
│   └── tests/                  # Vitest automated test suite (34 tests)
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
└── README.md                   # Project documentation
```

---

## 🛡️ Security & Privacy Architecture

- **Zero Telemetry**: No third-party trackers, external CDNs, or cloud dependencies. Functions completely offline.
- **Argon2id Hashing**: Industry-standard resistant hashing for passwords and session tokens.
- **Origin & Referer Guards**: Strict state-modifying request validation prevents cross-site request forgery.
- **Encrypted at Rest**: Sensitive files are encrypted on the storage drive using AES-256-CTR.
- **Automatic Sanitization**: Error logs and diagnostic outputs automatically redact passwords, session tokens, and system paths.

---

## 👨‍💻 Author & Credits

- **Creator & Lead Engineer**: **Kartikeya Saini**
- **Project**: Vesper Sanctuary Core (`vesper-sanctuary`)
- **License**: [AGPL-3.0 License](LICENSE)

*Vesper was designed and engineered for private, zero-transcode, ultra-reliable media streaming on trains and travels.*

# 🎬 TubeFetch - YouTube Video & Audio Downloader

TubeFetch is a full-featured, sleek web application for downloading YouTube videos and audio tracks with automatic quality selection and metadata extraction.

---

## 🛠️ Features

- ⚡ High-speed video & audio downloading (1080p, 720p, 480p, 360p, MP3 320kbps, M4A, WEBM)
- 📊 Automatic metadata extraction (Title, Channel, Views, Duration, Thumbnail)
- 📜 Download history tracking
- 🎨 Modern UI with Light / Dark Mode support

---

## 🚀 Running Locally

### Prerequisites

- Node.js (v18 or higher)
- Python 3 with `yt-dlp` installed (`pip install yt-dlp`)
- FFmpeg (optional, for quality merging)

### Instructions

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. Open `http://localhost:3000` in your browser.

---

## 🐙 Uploading to GitHub

1. Initialize git and commit files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of TubeFetch"
   ```
2. Create a new repository on GitHub.
3. Link and push:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/tubefetch.git
   git branch -M main
   git push -u origin main
   ```

---

## ☁️ Deployment Guide

> [!IMPORTANT]
> **Why Vercel serverless won't download real YouTube videos directly:**
> Vercel hosts static files and serverless functions (which lack Python, `yt-dlp`, and long execution timeouts required for streaming media files).

### Recommended Deployment (Render / Railway / VPS / Docker)

To run live video downloading on cloud servers:

1. **Render.com** (Free / Cheap Full-Stack Hosting):
   - Connect your GitHub repository to Render.
   - Choose **Web Service**.
   - Select **Docker** environment (it automatically detects the included `Dockerfile`).
   - Click **Deploy**!

2. **Railway.app**:
   - Create a new service from GitHub.
   - Railway will build and deploy using the `Dockerfile`.

3. **Vercel Deployment (Frontend Only)**:
   - If hosting the frontend on Vercel, deploy the `server.ts` backend to Render/Railway first and set the backend API URL in your environment.

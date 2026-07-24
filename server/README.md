# TubeFetch Backend Engine 🚀

A production-ready Node.js + Express backend for extracting and streaming YouTube videos and audio powered by `@distube/ytdl-core`.

---

## 📁 Project Folder Structure

```text
server/
├── routes/
│   └── download.js
├── controllers/
│   └── downloadController.js
├── utils/
│   └── ytdl.js
├── middleware/
│   └── errorHandler.js
├── package.json
├── server.js
├── .env.example
└── README.md
```

---

## 🛠️ Installation & Local Setup

1. **Navigate into the server directory**:
   ```bash
   cd server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

4. **Run in Development Mode**:
   ```bash
   npm run dev
   ```

5. **Run in Production Mode**:
   ```bash
   npm start
   ```

---

## 🌐 API Reference

### 1. Fetch Video Information & Qualities
- **Endpoint**: `GET /api/info?url=<YOUTUBE_URL>`
- **Response Example**:
```json
{
  "success": true,
  "id": "UhzxC1uR7P4",
  "title": "back 2 back Indirect shots 🔥🔥 #carrompool #shorts",
  "thumbnail": "https://i.ytimg.com/vi/UhzxC1uR7P4/maxresdefault.jpg",
  "duration": "0:27",
  "durationSeconds": 27,
  "author": "Mk Carrom Tricks",
  "videoFormats": [
    { "quality": "1080p", "container": "mp4", "size": "5.6 MB" },
    { "quality": "720p", "container": "mp4", "size": "3.1 MB" }
  ],
  "audioFormats": [
    { "quality": "320 kbps", "container": "mp3", "size": "1.1 MB" },
    { "quality": "128 kbps", "container": "mp3", "size": "0.4 MB" }
  ]
}
```

### 2. Download Video Stream
- **Endpoint**: `GET /api/download/video?url=<YOUTUBE_URL>&quality=1080p`
- **Response**: `video/mp4` attachment stream directly piped to client.

### 3. Download Audio Stream (MP3)
- **Endpoint**: `GET /api/download/audio?url=<YOUTUBE_URL>`
- **Response**: `audio/mpeg` attachment stream directly piped to client.

---

## 🚀 Deployment (Render / Railway)

- **Start Command**: `npm start`
- **Node Version**: `>=18.0.0`
- **Build Command**: `npm install`

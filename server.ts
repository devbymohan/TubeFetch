import express from "express";
import path from "path";
import fs from "fs";
import axios from "axios";
import ytdl from "@distube/ytdl-core";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HISTORY_FILE = path.join(process.cwd(), "downloads_history.json");
// Middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper: Format bytes to MB/KB
const formatBytes = (bytes: number): string => {
  if (!bytes || isNaN(bytes)) return "0 MB";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
};

// Helper: Format seconds into MM:SS or HH:MM:SS
const formatDuration = (seconds: number): string => {
  const sec = Math.max(0, parseInt(String(seconds), 10) || 0);
  const hours = Math.floor(sec / 3600);
  const min = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (hours > 0) return `${hours}:${pad(min)}:${pad(s)}`;
  return `${min}:${pad(s)}`;
};

// Extract Video ID from URL
const extractVideoId = (urlStr: string): string => {
  if (!urlStr) return "";
  const match = urlStr.match(/(?:youtu\.be\/|watch\?v=|shorts\/|embed\/)([^#\&\?]*)/);
  return match && match[1] ? match[1] : urlStr.trim();
};

// Extract YouTube metadata with automatic fallback
async function fetchYouTubeMetadata(targetUrl: string) {
  const videoId = extractVideoId(targetUrl);
  let title = `YouTube Video (${videoId})`;
  let channel = "YouTube Creator";
  let thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  let durationSec = 30;
  let viewsStr = "Popular";
  let uploadedStr = "Recently";
  let rawFormats: any[] = [];

  // Try 1: @distube/ytdl-core getInfo
  try {
    const info = await ytdl.getInfo(targetUrl);
    const details = info.videoDetails;
    title = details.title || title;
    channel = details.author ? details.author.name : (details.ownerChannelName || channel);
    durationSec = parseInt(details.lengthSeconds || "0", 10) || durationSec;
    viewsStr = details.viewCount ? `${(parseInt(details.viewCount, 10) / 1000000).toFixed(1)}M views` : viewsStr;
    uploadedStr = details.publishDate || uploadedStr;
    if (details.thumbnails && details.thumbnails.length > 0) {
      thumbnail = details.thumbnails[details.thumbnails.length - 1].url;
    }
    rawFormats = info.formats || [];
  } catch (ytdlErr) {
    console.warn("[ytdl.getInfo fallback triggered]:", (ytdlErr as Error).message);

    // Try 2: oEmbed for real Title & Channel
    try {
      const oembedRes = await axios.get(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, { timeout: 3500 });
      if (oembedRes.data && oembedRes.data.title) {
        title = oembedRes.data.title;
        channel = oembedRes.data.author_name || channel;
      }
    } catch (_) {}

    // Try 3: HTML Regex for real Duration, Views, Date
    try {
      const pageRes = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        timeout: 5000
      });
      const html = pageRes.data || "";
      const mSec = html.match(/"lengthSeconds":"(\d+)"/);
      if (mSec && parseInt(mSec[1], 10) > 0) {
        durationSec = parseInt(mSec[1], 10);
      }
      const mViews = html.match(/"viewCount":"(\d+)"/);
      if (mViews) {
        const vNum = parseInt(mViews[1], 10);
        viewsStr = vNum >= 1000000 ? `${(vNum / 1000000).toFixed(1)}M views` : vNum >= 1000 ? `${(vNum / 1000).toFixed(1)}K views` : `${vNum} views`;
      }
      const mDate = html.match(/"publishDate":"([^"]+)"/);
      if (mDate) {
        uploadedStr = mDate[1].split("T")[0];
      }
    } catch (_) {}
  }

  // Parse or calculate video formats matching REAL duration
  const videoFormatsMap = new Map();
  if (rawFormats.length > 0) {
    rawFormats.forEach((f) => {
      if (f.hasVideo && f.qualityLabel) {
        const quality = f.qualityLabel;
        const approxBytes = f.contentLength
          ? parseInt(f.contentLength, 10)
          : (f.bitrate ? Math.round((f.bitrate * durationSec) / 8) : null);
        videoFormatsMap.set(quality, {
          quality: f.qualityLabel,
          ext: f.container || "mp4",
          fps: f.fps || 30,
          codec: f.codecs || "h264/aac",
          size: formatBytes(approxBytes || Math.round((durationSec * (f.height || 720) * 1000) / 8))
        });
      }
    });
  }

  const videoFormats = Array.from(videoFormatsMap.values()).sort((a, b) => {
    const qA = parseInt(a.quality.replace("p", ""), 10) || 0;
    const qB = parseInt(b.quality.replace("p", ""), 10) || 0;
    return qB - qA;
  });

  if (videoFormats.length === 0) {
    videoFormats.push(
      { quality: "1080p", fps: 30, ext: "mp4", codec: "h264/aac", size: formatBytes(Math.round((durationSec * 1080 * 2200) / 8)) },
      { quality: "720p", fps: 30, ext: "mp4", codec: "h264/aac", size: formatBytes(Math.round((durationSec * 720 * 1100) / 8)) },
      { quality: "480p", fps: 30, ext: "mp4", codec: "h264/aac", size: formatBytes(Math.round((durationSec * 480 * 500) / 8)) },
      { quality: "360p", fps: 30, ext: "mp4", codec: "h264/aac", size: formatBytes(Math.round((durationSec * 360 * 300) / 8)) }
    );
  }

  const audioFormats = [
    { quality: "320 kbps", ext: "mp3", codec: "mp3", size: formatBytes(Math.round((durationSec * 320000) / 8)), label: "MP3 - High Quality" },
    { quality: "128 kbps", ext: "m4a", codec: "aac", size: formatBytes(Math.round((durationSec * 128000) / 8)), label: "M4A - Standard" }
  ];

  return {
    id: videoId,
    title,
    channel,
    author: channel,
    thumbnail,
    duration: formatDuration(durationSec),
    durationSeconds: durationSec,
    views: viewsStr,
    uploaded: uploadedStr,
    videoFormats,
    audioFormats,
    formats: {
      video: videoFormats,
      audio: audioFormats
    }
  };
}

// Fallback helper to resolve direct stream URL from Invidious
async function getDirectStreamUrl(videoId: string, format: string, quality: string): Promise<string> {
  const hosts = [
    "https://invidious.flokinet.to",
    "https://invidious.nerdvpn.de",
    "https://yt.artemislena.eu",
    "https://inv.tux.pizza"
  ];
  const itag = format === "audio" ? "140" : (quality.includes("1080") ? "22" : "18");

  for (const host of hosts) {
    try {
      const streamUrl = `${host}/latest_version?id=${videoId}&itag=${itag}`;
      const check = await axios.head(streamUrl, { timeout: 3500 });
      if (check.status === 200 || check.status === 302) {
        return streamUrl;
      }
    } catch (_) {}
  }
  return `https://invidious.flokinet.to/latest_version?id=${videoId}&itag=${itag}`;
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// GET /api/info
app.get("/api/info", async (req, res) => {
  const { url, id } = req.query;
  const targetUrl = (url as string) || (id ? `https://www.youtube.com/watch?v=${id}` : null);

  if (!targetUrl) {
    return res.status(400).json({ success: false, message: "Missing YouTube URL parameter." });
  }

  try {
    const details = await fetchYouTubeMetadata(targetUrl);
    return res.json({ success: true, ...details });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Streaming Download Handler
const handleDownload = async (req: express.Request, res: express.Response) => {
  const { url, id, format, quality } = req.query;
  const targetUrl = (url as string) || (id ? `https://www.youtube.com/watch?v=${id}` : null);
  const videoId = extractVideoId(targetUrl || "");
  const isAudio = format === "audio" || req.url.includes("/audio");
  const ext = isAudio ? "mp3" : "mp4";

  if (!targetUrl) {
    return res.status(400).send("Missing YouTube URL parameter.");
  }

  try {
    const meta = await fetchYouTubeMetadata(targetUrl);
    const cleanTitle = (meta.title || "video").replace(/[\\/*?:"<>|]/g, "");
    const filename = `${cleanTitle}${quality ? ` (${quality})` : ""}.${ext}`;

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", isAudio ? "audio/mpeg" : "video/mp4");

    const stream = ytdl(targetUrl, {
      quality: isAudio ? "highestaudio" : (quality ? "highestvideo" : "highest"),
      filter: isAudio ? "audioonly" : (f => f.hasVideo && f.hasAudio)
    });

    stream.on("error", async (err) => {
      console.warn("[ytdl stream error, switching to direct proxy]:", err.message);
      if (!res.headersSent) {
        try {
          const directUrl = await getDirectStreamUrl(videoId, isAudio ? "audio" : "video", (quality as string) || "");
          const proxyRes = await axios.get(directUrl, { responseType: "stream", timeout: 30000 });
          res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
          res.setHeader("Content-Type", isAudio ? "audio/mpeg" : "video/mp4");
          proxyRes.data.pipe(res);
        } catch (pErr) {
          console.error("Proxy stream error:", (pErr as Error).message);
        }
      }
    });

    stream.pipe(res);
  } catch (err) {
    console.warn("[ytdl catch, proxying direct stream]:", (err as Error).message);
    try {
      const filename = `YouTube_${isAudio ? "Audio" : "Video"}_${videoId}.${ext}`;
      const directUrl = await getDirectStreamUrl(videoId, isAudio ? "audio" : "video", (quality as string) || "");
      const proxyRes = await axios.get(directUrl, { responseType: "stream", timeout: 30000 });
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader("Content-Type", isAudio ? "audio/mpeg" : "video/mp4");
      proxyRes.data.pipe(res);
    } catch (pErr) {
      if (!res.headersSent) {
        return res.status(500).send(`Download failed: ${(pErr as Error).message}`);
      }
    }
  }
};

app.get("/api/download/video", handleDownload);
app.get("/api/download/audio", handleDownload);
app.get("/api/download", handleDownload);

// Download History Routes
app.get("/api/history", (req, res) => {
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      const data = fs.readFileSync(HISTORY_FILE, "utf-8");
      return res.json(JSON.parse(data));
    } catch (_) {}
  }
  res.json([]);
});

app.delete("/api/history", (req, res) => {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.writeFileSync(HISTORY_FILE, "[]", "utf-8");
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Serve static frontend in production
const distPath = path.join(process.cwd(), "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.url.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 TubeFetch Server running on port ${PORT}`);
});

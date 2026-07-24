import ytdl from "@distube/ytdl-core";
import axios from "axios";
import { isValidUrl, getVideoDetails } from "../utils/ytdl.js";

async function getFallbackStreamUrl(videoId, format, quality) {
  const invidiousHosts = [
    "https://invidious.flokinet.to",
    "https://invidious.nerdvpn.de",
    "https://yt.artemislena.eu",
    "https://inv.tux.pizza"
  ];
  const itag = format === "audio" ? "140" : (quality && quality.includes("1080") ? "22" : "18");

  for (const host of invidiousHosts) {
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

export const getVideoInfo = async (req, res, next) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Missing YouTube URL parameter."
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        message: "Invalid YouTube URL provided."
      });
    }

    const videoDetails = await getVideoDetails(url);

    return res.status(200).json({
      success: true,
      ...videoDetails
    });
  } catch (error) {
    console.error("[getVideoInfo Error]:", error.message);
    return res.status(500).json({
      success: false,
      message: `Failed to extract video information: ${error.message}`
    });
  }
};

export const downloadVideo = async (req, res, next) => {
  const { url, quality, id } = req.query;
  const targetUrl = url || (id ? `https://www.youtube.com/watch?v=${id}` : null);
  const videoId = id || (targetUrl ? (targetUrl.match(/(?:youtu\.be\/|watch\?v=|shorts\/)([^#\&\?]*)/) || [])[1] : "video");

  if (!targetUrl) {
    return res.status(400).send("Missing YouTube URL parameter.");
  }

  try {
    const info = await ytdl.getInfo(targetUrl);
    const cleanTitle = (info.videoDetails.title || "video").replace(/[\\/*?:"<>|]/g, "");
    const filename = `${cleanTitle}${quality ? ` (${quality})` : ""}.mp4`;

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", "video/mp4");

    const videoStream = ytdl(targetUrl, {
      quality: quality ? "highestvideo" : "highest",
      filter: (f) => f.hasVideo && f.hasAudio
    });

    videoStream.on("error", async (err) => {
      console.warn("[Video Stream Error]:", err.message);
      if (!res.headersSent) {
        try {
          const directUrl = await getFallbackStreamUrl(videoId, "video", quality);
          const proxyRes = await axios.get(directUrl, { responseType: "stream", timeout: 25000 });
          res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
          res.setHeader("Content-Type", "video/mp4");
          proxyRes.data.pipe(res);
        } catch (proxyErr) {
          console.error("[Proxy Stream Error]:", proxyErr.message);
        }
      }
    });

    videoStream.pipe(res);
  } catch (error) {
    console.error("[downloadVideo Catch Error]:", error.message);
    try {
      const filename = `YouTube_Video_${videoId}.mp4`;
      const directUrl = await getFallbackStreamUrl(videoId, "video", quality);
      const proxyRes = await axios.get(directUrl, { responseType: "stream", timeout: 25000 });
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader("Content-Type", "video/mp4");
      proxyRes.data.pipe(res);
    } catch (proxyErr) {
      if (!res.headersSent) {
        return res.status(500).send(`Failed to download video stream: ${proxyErr.message}`);
      }
    }
  }
};

export const downloadAudio = async (req, res, next) => {
  const { url, id } = req.query;
  const targetUrl = url || (id ? `https://www.youtube.com/watch?v=${id}` : null);
  const videoId = id || (targetUrl ? (targetUrl.match(/(?:youtu\.be\/|watch\?v=|shorts\/)([^#\&\?]*)/) || [])[1] : "audio");

  if (!targetUrl) {
    return res.status(400).send("Missing YouTube URL parameter.");
  }

  try {
    const info = await ytdl.getInfo(targetUrl);
    const cleanTitle = (info.videoDetails.title || "audio").replace(/[\\/*?:"<>|]/g, "");
    const filename = `${cleanTitle}.mp3`;

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", "audio/mpeg");

    const audioStream = ytdl(targetUrl, {
      quality: "highestaudio",
      filter: "audioonly"
    });

    audioStream.on("error", async (err) => {
      console.error("[Audio Stream Error]:", err.message);
      if (!res.headersSent) {
        try {
          const directUrl = await getFallbackStreamUrl(videoId, "audio", "");
          const proxyRes = await axios.get(directUrl, { responseType: "stream", timeout: 25000 });
          res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
          res.setHeader("Content-Type", "audio/mpeg");
          proxyRes.data.pipe(res);
        } catch (proxyErr) {
          console.error("[Audio Proxy Error]:", proxyErr.message);
        }
      }
    });

    audioStream.pipe(res);
  } catch (error) {
    console.error("[downloadAudio Catch Error]:", error.message);
    try {
      const filename = `YouTube_Audio_${videoId}.mp3`;
      const directUrl = await getFallbackStreamUrl(videoId, "audio", "");
      const proxyRes = await axios.get(directUrl, { responseType: "stream", timeout: 25000 });
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader("Content-Type", "audio/mpeg");
      proxyRes.data.pipe(res);
    } catch (proxyErr) {
      if (!res.headersSent) {
        return res.status(500).send(`Failed to download audio stream: ${proxyErr.message}`);
      }
    }
  }
};

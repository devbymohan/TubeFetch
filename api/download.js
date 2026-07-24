import ytdl from "@distube/ytdl-core";
import axios from "axios";

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url, id, format, quality } = req.query;
  const targetUrl = url || (id ? `https://www.youtube.com/watch?v=${id}` : null);

  if (!targetUrl) {
    return res.status(400).send("Missing YouTube URL parameter.");
  }

  const videoId = id || (targetUrl.match(/(?:youtu\.be\/|watch\?v=|shorts\/)([^#\&\?]*)/) || [])[1] || "video";
  const isAudio = format === "audio" || req.url.includes("/audio");
  const ext = isAudio ? "mp3" : "mp4";

  try {
    const info = await ytdl.getInfo(targetUrl);
    const cleanTitle = (info.videoDetails.title || "video").replace(/[\\/*?:"<>|]/g, "");
    const filename = `${cleanTitle}${quality ? ` (${quality})` : ""}.${ext}`;

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", isAudio ? "audio/mpeg" : "video/mp4");

    const stream = ytdl(targetUrl, {
      quality: isAudio ? "highestaudio" : (quality ? "highestvideo" : "highest"),
      filter: isAudio ? "audioonly" : (f => f.hasVideo && f.hasAudio)
    });

    stream.on("error", async (err) => {
      console.warn("[api/download ytdl error]:", err.message);
      if (!res.headersSent) {
        try {
          const directUrl = await getFallbackStreamUrl(videoId, isAudio ? "audio" : "video", quality);
          const proxyRes = await axios.get(directUrl, { responseType: "stream", timeout: 25000 });
          res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
          res.setHeader("Content-Type", isAudio ? "audio/mpeg" : "video/mp4");
          proxyRes.data.pipe(res);
        } catch (proxyErr) {
          console.error("[Proxy Stream Error]:", proxyErr.message);
        }
      }
    });

    stream.pipe(res);
  } catch (err) {
    console.warn("[api/download catch]:", err.message);
    try {
      const filename = `YouTube_Video_${videoId}.${ext}`;
      const directUrl = await getFallbackStreamUrl(videoId, isAudio ? "audio" : "video", quality);
      const proxyRes = await axios.get(directUrl, { responseType: "stream", timeout: 25000 });
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader("Content-Type", isAudio ? "audio/mpeg" : "video/mp4");
      proxyRes.data.pipe(res);
    } catch (proxyErr) {
      if (!res.headersSent) {
        return res.status(500).send(`Download failed: ${proxyErr.message}`);
      }
    }
  }
}

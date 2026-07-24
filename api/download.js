import ytdl from "@distube/ytdl-core";

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

  try {
    const info = await ytdl.getInfo(targetUrl);
    const cleanTitle = (info.videoDetails.title || "video").replace(/[\\/*?:"<>|]/g, "");

    if (format === "audio" || req.url.includes("/audio")) {
      const filename = `${cleanTitle}.mp3`;
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader("Content-Type", "audio/mpeg");

      const audioStream = ytdl(targetUrl, {
        quality: "highestaudio",
        filter: "audioonly"
      });
      audioStream.pipe(res);
    } else {
      const filename = `${cleanTitle}${quality ? ` (${quality})` : ""}.mp4`;
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader("Content-Type", "video/mp4");

      const videoStream = ytdl(targetUrl, {
        quality: quality ? "highestvideo" : "highest",
        filter: (f) => f.hasVideo && f.hasAudio
      });

      videoStream.on("error", () => {
        if (!res.headersSent) {
          const fallbackStream = ytdl(targetUrl, { quality: "highest" });
          fallbackStream.pipe(res);
        }
      });

      videoStream.pipe(res);
    }
  } catch (err) {
    console.error("[Vercel /api/download Error]:", err.message);
    if (!res.headersSent) {
      return res.status(500).send(`Download failed: ${err.message}`);
    }
  }
}

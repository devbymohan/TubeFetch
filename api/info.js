import ytdl from "@distube/ytdl-core";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url, id } = req.query;
  const targetUrl = url || (id ? `https://www.youtube.com/watch?v=${id}` : null);

  if (!targetUrl) {
    return res.status(400).json({ success: false, message: "Missing YouTube URL parameter." });
  }

  try {
    const info = await ytdl.getInfo(targetUrl);
    const details = info.videoDetails;

    const durationSec = parseInt(details.lengthSeconds || "0", 10);
    const min = Math.floor(durationSec / 60);
    const sec = durationSec % 60;
    const durationStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;

    const rawFormats = info.formats || [];
    const videoFormatsMap = new Map();

    rawFormats.forEach((f) => {
      if (f.hasVideo && f.qualityLabel) {
        const quality = f.qualityLabel;
        const approxBytes = f.contentLength
          ? parseInt(f.contentLength, 10)
          : (f.bitrate ? Math.round((f.bitrate * durationSec) / 8) : null);

        const sizeStr = approxBytes
          ? `${(approxBytes / (1024 * 1024)).toFixed(1)} MB`
          : `${((durationSec * (f.height || 720) * 0.003) / 8).toFixed(1)} MB`;

        if (!videoFormatsMap.has(quality) || f.hasAudio) {
          videoFormatsMap.set(quality, {
            quality: f.qualityLabel,
            ext: f.container || "mp4",
            fps: f.fps || 30,
            codec: f.codecs || "h264/aac",
            size: sizeStr
          });
        }
      }
    });

    const videoFormats = Array.from(videoFormatsMap.values()).sort((a, b) => {
      const qA = parseInt(a.quality.replace("p", ""), 10) || 0;
      const qB = parseInt(b.quality.replace("p", ""), 10) || 0;
      return qB - qA;
    });

    if (videoFormats.length === 0) {
      [1080, 720, 480, 360].forEach((h) => {
        videoFormats.push({
          quality: `${h}p`,
          ext: "mp4",
          fps: 30,
          codec: "h264/aac",
          size: `${((durationSec * h * 0.003) / 8).toFixed(1)} MB`
        });
      });
    }

    const audioFormats = [
      { quality: "320 kbps", ext: "mp3", codec: "mp3", size: `${((durationSec * 40) / 1024).toFixed(1)} MB`, label: "MP3 - High Quality" },
      { quality: "128 kbps", ext: "mp3", codec: "mp3", size: `${((durationSec * 16) / 1024).toFixed(1)} MB`, label: "MP3 - Standard" }
    ];

    const thumbs = details.thumbnails || [];
    const bestThumb = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${details.videoId}/maxresdefault.jpg`;

    return res.status(200).json({
      success: true,
      id: details.videoId,
      title: details.title,
      author: details.author ? details.author.name : (details.ownerChannelName || "YouTube Creator"),
      channel: details.author ? details.author.name : (details.ownerChannelName || "YouTube Creator"),
      thumbnail: bestThumb,
      duration: durationStr,
      views: details.viewCount ? `${(parseInt(details.viewCount, 10) / 1000000).toFixed(1)}M views` : "Popular",
      uploaded: details.publishDate || "Recently",
      videoFormats,
      audioFormats
    });
  } catch (err) {
    console.error("[Vercel /api/info Error]:", err.message);
    return res.status(500).json({
      success: false,
      message: `Extraction failed: ${err.message}`
    });
  }
}

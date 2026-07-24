import ytdl from "@distube/ytdl-core";

/**
 * Validate whether a string is a valid YouTube URL
 * @param {string} url 
 * @returns {boolean}
 */
export const isValidUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  return ytdl.validateURL(url.trim());
};

/**
 * Format duration in seconds into HH:MM:SS or MM:SS
 * @param {number|string} durationInSeconds 
 * @returns {string}
 */
const formatDuration = (durationInSeconds) => {
  const sec = parseInt(durationInSeconds, 10);
  if (isNaN(sec) || sec <= 0) return "0:00";
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  const pad = (n) => (n < 10 ? `0${n}` : n);
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
};

/**
 * Format number of bytes into human readable MB / KB string
 * @param {number} bytes 
 * @returns {string}
 */
const formatBytes = (bytes) => {
  if (!bytes || isNaN(bytes)) return null;
  const num = parseInt(bytes, 10);
  if (num >= 1024 * 1024 * 1024) return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (num >= 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  if (num >= 1024) return `${(num / 1024).toFixed(0)} KB`;
  return `${num} B`;
};

/**
 * Fetch YouTube video information and available formats
 * @param {string} url 
 * @returns {Promise<Object>}
 */
export const getVideoDetails = async (url) => {
  const info = await ytdl.getInfo(url);
  const details = info.videoDetails;

  const durationSec = parseInt(details.lengthSeconds || "0", 10);

  // Filter video & audio formats
  const rawFormats = info.formats || [];

  // Parse combined or video-only formats
  const videoFormatsMap = new Map();
  rawFormats.forEach((f) => {
    if (f.hasVideo && f.qualityLabel) {
      const quality = f.qualityLabel; // e.g. '1080p', '720p', '480p'
      const approxSizeBytes = f.contentLength 
        ? parseInt(f.contentLength, 10) 
        : (f.bitrate ? Math.round((f.bitrate * durationSec) / 8) : null);

      if (!videoFormatsMap.has(quality) || f.hasAudio) {
        videoFormatsMap.set(quality, {
          quality: f.qualityLabel,
          qualityItag: f.itag,
          container: f.container || "mp4",
          ext: f.container || "mp4",
          fps: f.fps || 30,
          codec: f.codecs || "h264/aac",
          hasAudio: f.hasAudio,
          bitrate: f.bitrate,
          contentLength: f.contentLength,
          size: formatBytes(approxSizeBytes) || `${((durationSec * (f.height || 720) * 0.003) / 8).toFixed(1)} MB`
        });
      }
    }
  });

  // Convert map to sorted array (highest quality first)
  const videoFormats = Array.from(videoFormatsMap.values()).sort((a, b) => {
    const qA = parseInt(a.quality.replace("p", ""), 10) || 0;
    const qB = parseInt(b.quality.replace("p", ""), 10) || 0;
    return qB - qA;
  });

  // Ensure default video format fallbacks if empty
  if (videoFormats.length === 0) {
    [1080, 720, 480, 360].forEach((h) => {
      videoFormats.push({
        quality: `${h}p`,
        qualityItag: null,
        container: "mp4",
        ext: "mp4",
        fps: 30,
        codec: "h264/aac",
        hasAudio: true,
        size: `${((durationSec * h * 0.003) / 8).toFixed(1)} MB`
      });
    });
  }

  // Parse audio formats
  const audioFormatsMap = new Map();
  rawFormats.forEach((f) => {
    if (f.hasAudio && !f.hasVideo) {
      const bitrateKbps = f.audioBitrate ? `${f.audioBitrate} kbps` : "128 kbps";
      const approxSizeBytes = f.contentLength 
        ? parseInt(f.contentLength, 10) 
        : (f.audioBitrate ? Math.round((f.audioBitrate * 1024 * durationSec) / 8) : null);

      if (!audioFormatsMap.has(bitrateKbps)) {
        audioFormatsMap.set(bitrateKbps, {
          quality: bitrateKbps,
          qualityItag: f.itag,
          container: f.container || "mp3",
          ext: "mp3",
          codec: f.audioCodec || "mp3",
          bitrate: f.audioBitrate,
          size: formatBytes(approxSizeBytes) || `${((durationSec * 16) / 1024).toFixed(1)} MB`,
          label: `MP3 - ${bitrateKbps}`
        });
      }
    }
  });

  const audioFormats = Array.from(audioFormatsMap.values());
  if (audioFormats.length === 0) {
    audioFormats.push(
      { quality: "320 kbps", container: "mp3", ext: "mp3", codec: "mp3", size: `${((durationSec * 40) / 1024).toFixed(1)} MB`, label: "MP3 - High Quality" },
      { quality: "128 kbps", container: "mp3", ext: "mp3", codec: "mp3", size: `${((durationSec * 16) / 1024).toFixed(1)} MB`, label: "MP3 - Standard" }
    );
  }

  // Best thumbnail
  const thumbnails = details.thumbnails || [];
  const bestThumbnail = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : `https://i.ytimg.com/vi/${details.videoId}/hqdefault.jpg`;

  return {
    id: details.videoId,
    title: details.title,
    thumbnail: bestThumbnail,
    duration: formatDuration(details.lengthSeconds),
    durationSeconds: durationSec,
    author: details.author ? details.author.name : (details.ownerChannelName || "YouTube Creator"),
    channel: details.author ? details.author.name : (details.ownerChannelName || "YouTube Creator"),
    views: details.viewCount ? `${(parseInt(details.viewCount, 10) / 1000000).toFixed(1)}M views` : "Available",
    uploaded: details.publishDate || "Recently",
    videoFormats,
    audioFormats
  };
};

/**
 * Get direct ytdl readable stream for pipe
 * @param {string} url 
 * @param {Object} options 
 * @returns {ReadableStream}
 */
export const getDownloadStream = (url, options = {}) => {
  return ytdl(url, {
    filter: "videoandaudio",
    quality: "highest",
    ...options
  });
};

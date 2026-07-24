import ytdl from "@distube/ytdl-core";
import { isValidUrl, getVideoDetails } from "../utils/ytdl.js";

/**
 * Controller to fetch YouTube video information
 * GET /api/info?url=
 */
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
        message: "Invalid YouTube URL provided. Please enter a valid YouTube video link."
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

/**
 * Controller to download video stream by quality
 * GET /api/download/video?url=&quality=
 */
export const downloadVideo = async (req, res, next) => {
  try {
    const { url, quality } = req.query;

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

    const info = await ytdl.getInfo(url);
    const cleanTitle = (info.videoDetails.title || "video").replace(/[\\/*?:"<>|]/g, "");
    const filename = `${cleanTitle}${quality ? ` (${quality})` : ""}.mp4`;

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", "video/mp4");

    // Stream video directly to client using @distube/ytdl-core
    const videoStream = ytdl(url, {
      quality: quality ? "highestvideo" : "highest",
      filter: (format) => format.hasVideo && format.hasAudio
    });

    // Fallback filter if combined stream not found
    videoStream.on("error", (err) => {
      console.warn("[Video Stream Warning]:", err.message);
      if (!res.headersSent) {
        // Try fallback filter
        const fallbackStream = ytdl(url, { quality: "highest" });
        fallbackStream.pipe(res);
      }
    });

    videoStream.pipe(res);
  } catch (error) {
    console.error("[downloadVideo Error]:", error.message);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: `Failed to download video stream: ${error.message}`
      });
    }
  }
};

/**
 * Controller to download audio stream as MP3
 * GET /api/download/audio?url=
 */
export const downloadAudio = async (req, res, next) => {
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

    const info = await ytdl.getInfo(url);
    const cleanTitle = (info.videoDetails.title || "audio").replace(/[\\/*?:"<>|]/g, "");
    const filename = `${cleanTitle}.mp3`;

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", "audio/mpeg");

    // Stream highest quality audio directly to client
    const audioStream = ytdl(url, {
      quality: "highestaudio",
      filter: "audioonly"
    });

    audioStream.on("error", (err) => {
      console.error("[Audio Stream Error]:", err.message);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: `Audio streaming failed: ${err.message}`
        });
      }
    });

    audioStream.pipe(res);
  } catch (error) {
    console.error("[downloadAudio Error]:", error.message);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: `Failed to download audio stream: ${error.message}`
      });
    }
  }
};

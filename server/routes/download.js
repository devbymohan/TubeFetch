import express from "express";
import { getVideoInfo, downloadVideo, downloadAudio } from "../controllers/downloadController.js";

const router = express.Router();

// GET /api/info?url=
router.get("/info", getVideoInfo);

// GET /api/download/video?url=&quality=
router.get("/download/video", downloadVideo);

// GET /api/download/audio?url=
router.get("/download/audio", downloadAudio);

// GET /api/download?id=&format=&quality= (Legacy compatible endpoint)
router.get("/download", (req, res, next) => {
  const { id, format, url } = req.query;
  const targetUrl = url || (id ? `https://www.youtube.com/watch?v=${id}` : null);
  req.query.url = targetUrl;
  
  if (format === "audio") {
    return downloadAudio(req, res, next);
  }
  return downloadVideo(req, res, next);
});

export default router;

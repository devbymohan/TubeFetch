export interface VideoFormat {
  quality: string;
  fps?: number;
  size: string;
  ext: string;
  codec: string;
  label?: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  views: string;
  uploaded: string;
  formats: {
    video: VideoFormat[];
    audio: VideoFormat[];
  };
}

export interface HistoryRecord {
  uniqueId: string;
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  format: "video" | "audio";
  quality: string;
  size: string;
  timestamp: string;
}

export interface DownloadState {
  isDownloading: boolean;
  progress: number;
  speed: string;
  eta: string;
  format: "video" | "audio";
  quality: string;
  size: string;
  title: string;
}

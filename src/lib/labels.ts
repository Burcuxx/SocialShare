import type { JobStatus, Platform } from "./db";

export const PLATFORM_NAMES: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

export const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Sırada",
  downloading: "İndiriliyor",
  processing: "Hazırlanıyor",
  uploading: "Yükleniyor",
  done: "Gönderildi",
  failed: "Hata",
};

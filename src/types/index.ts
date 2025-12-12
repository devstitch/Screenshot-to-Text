import { ObjectId } from "mongodb";

export interface OcrResult {
  text: string;
  confidence?: number;
  timestamp: Date;
}

export interface Screenshot {
  _id?: ObjectId;
  filename: string;
  extractedText: string;
  language: string;
  confidence: number;
  model: string; // "gpt-4o" or "gpt-4o-mini"
  promptTokens: number;
  completionTokens: number;
  imageSize: number; // in bytes
  mimeType: string;
  createdAt: Date;
  userId?: string;
}

export interface HistoryItem {
  _id: string;
  filename: string;
  extractedText: string;
  createdAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DatabaseStats {
  totalScreenshots: number;
  totalTextLength: number;
  averageConfidence: number;
  totalTokens: number;
}


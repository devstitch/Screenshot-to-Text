import { ObjectId } from "mongodb";
import { Screenshot } from "@/types";
import {
  saveScreenshot,
  getScreenshotHistory,
  getScreenshotById,
  deleteScreenshot,
  getStats,
} from "@/lib/mongodb";

/**
 * Screenshot Model - Database operations for screenshots
 */
export class ScreenshotModel {
  /**
   * Create a new screenshot record
   */
  static async create(
    data: Omit<Screenshot, "_id" | "createdAt">
  ): Promise<Screenshot> {
    return saveScreenshot(data);
  }

  /**
   * Get all screenshots (most recent first)
   */
  static async findAll(limit: number = 50): Promise<Screenshot[]> {
    return getScreenshotHistory(limit);
  }

  /**
   * Find a screenshot by ID
   */
  static async findById(id: string): Promise<Screenshot | null> {
    return getScreenshotById(id);
  }

  /**
   * Delete a screenshot by ID
   */
  static async deleteById(id: string): Promise<boolean> {
    return deleteScreenshot(id);
  }

  /**
   * Get database statistics
   */
  static async getStats() {
    return getStats();
  }
}

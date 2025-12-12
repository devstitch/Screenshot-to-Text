import { NextRequest, NextResponse } from "next/server";
import { ScreenshotModel } from "@/models/Screenshot";
import { ApiResponse, HistoryItem } from "@/types";
import { ObjectId } from "mongodb";

/**
 * GET /api/history
 * Fetch screenshot history with pagination support
 * 
 * Query parameters:
 * - limit: number (default 50, max 100)
 * - skip: number (default 0, for pagination)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get("limit");
    const skipParam = searchParams.get("skip");

    // Parse and validate limit
    let limit = 50; // default
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 100); // Max 100
      }
    }

    // Parse and validate skip
    let skip = 0; // default
    if (skipParam) {
      const parsedSkip = parseInt(skipParam, 10);
      if (!isNaN(parsedSkip) && parsedSkip >= 0) {
        skip = parsedSkip;
      }
    }

    // Fetch screenshots (Note: findAll doesn't support skip yet, but we can filter client-side)
    // For now, we'll fetch more and slice, but ideally ScreenshotModel should support skip
    const screenshots = await ScreenshotModel.findAll(limit + skip);
    
    // Apply skip manually (in production, add skip to ScreenshotModel.findAll)
    const paginatedScreenshots = screenshots.slice(skip, skip + limit);

    const history: HistoryItem[] = paginatedScreenshots.map((screenshot) => ({
      _id: screenshot._id?.toString() || "",
      filename: screenshot.filename,
      extractedText: screenshot.extractedText,
      createdAt: screenshot.createdAt,
    }));

    return NextResponse.json<ApiResponse<HistoryItem[]>>({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("History API error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch history",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/history
 * Delete a screenshot by ID
 * 
 * Accepts ID in:
 * - URL query parameter: ?id=...
 * - Request body: { id: "..." }
 */
export async function DELETE(request: NextRequest) {
  try {
    let id: string | null = null;

    // Try to get ID from URL params first
    const searchParams = request.nextUrl.searchParams;
    id = searchParams.get("id");

    // If not in URL params, try request body
    if (!id) {
      try {
        const body = await request.json();
        id = body.id || null;
      } catch {
        // Body parsing failed, continue with null
      }
    }

    if (!id) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "No ID provided. Provide ID in query parameter (?id=...) or request body ({ id: '...' })",
        },
        { status: 400 }
      );
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Invalid ID format. ID must be a valid MongoDB ObjectId",
        },
        { status: 400 }
      );
    }

    const deleted = await ScreenshotModel.deleteById(id);

    if (!deleted) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Screenshot not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Screenshot deleted successfully",
    });
  } catch (error) {
    console.error("Delete API error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete screenshot",
      },
      { status: 500 }
    );
  }
}

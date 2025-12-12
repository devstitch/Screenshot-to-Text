import { NextRequest, NextResponse } from "next/server";
import {
  extractTextFromImage,
  validateImageFormat,
  estimateTokens,
} from "@/lib/openai";
import { ScreenshotModel } from "@/models/Screenshot";
import { ApiResponse } from "@/types";
import { checkRateLimit, getClientIP } from "@/lib/rateLimiter";

/**
 * Maximum file size: 10MB
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Allowed image formats
 */
const ALLOWED_FORMATS = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

/**
 * Request log entry interface
 */
interface RequestLog {
  timestamp: Date;
  ip: string;
  imageSize: number;
  imageFormat: string;
  model: string;
  openaiResponseTime?: number;
  tokensUsed?: number;
  success: boolean;
  error?: string;
}

/**
 * In-memory request logs (in production, use a proper logging service)
 */
const requestLogs: RequestLog[] = [];
const MAX_LOG_ENTRIES = 1000; // Keep last 1000 requests

/**
 * Log request for debugging
 */
function logRequest(log: RequestLog): void {
  requestLogs.push(log);
  if (requestLogs.length > MAX_LOG_ENTRIES) {
    requestLogs.shift(); // Remove oldest entry
  }

  // Console log for debugging
  console.log(`[OCR API] ${log.timestamp.toISOString()} | IP: ${log.ip} | Size: ${log.imageSize} bytes | Format: ${log.imageFormat} | Model: ${log.model} | Success: ${log.success}${log.openaiResponseTime ? ` | Response Time: ${log.openaiResponseTime}ms` : ""}${log.tokensUsed ? ` | Tokens: ${log.tokensUsed}` : ""}${log.error ? ` | Error: ${log.error}` : ""}`);
}

/**
 * POST /api/ocr
 * Extract text from an uploaded image using OpenAI Vision API
 * 
 * Request body (FormData):
 * - image: File (required)
 * - model: "gpt-4o" | "gpt-4o-mini" (optional, defaults to "gpt-4o")
 * 
 * Response:
 * {
 *   success: boolean;
 *   data?: {
 *     extractedText: string;
 *     confidence: number;
 *     language: string;
 *     model: string;
 *     processingTime: number;
 *     _id: string;
 *   };
 *   error?: string;
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);
  const requestLog: RequestLog = {
    timestamp: new Date(),
    ip: clientIP,
    imageSize: 0,
    imageFormat: "",
    model: "gpt-4o",
    success: false,
  };

  try {
    // Rate limiting check
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      const errorMessage = `Rate limit exceeded. Maximum ${rateLimit.remaining} requests per minute. Try again after ${new Date(rateLimit.resetTime).toISOString()}`;
      requestLog.error = "Rate limit exceeded";
      logRequest(requestLog);
      
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: errorMessage,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetTime.toString(),
            "Retry-After": Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Parse form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      requestLog.error = "Invalid form data";
      logRequest(requestLog);
      
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Invalid request format. Expected multipart/form-data.",
        },
        { status: 400 }
      );
    }

    const file = formData.get("image") as File | null;
    const model =
      (formData.get("model") as "gpt-4o" | "gpt-4o-mini") || "gpt-4o";

    // Validate file exists
    if (!file || !(file instanceof File)) {
      requestLog.error = "No image file provided";
      logRequest(requestLog);
      
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "No image file provided",
        },
        { status: 400 }
      );
    }

    requestLog.imageSize = file.size;
    requestLog.imageFormat = file.type;
    requestLog.model = model;

    // Validate file size (10MB limit)
    if (file.size > MAX_FILE_SIZE) {
      requestLog.error = `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB`;
      logRequest(requestLog);
      
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB. Received: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        },
        { status: 400 }
      );
    }

    // Validate image format
    const isValidFormat = ALLOWED_FORMATS.some(
      (format) => file.type.toLowerCase() === format
    );

    if (!isValidFormat) {
      requestLog.error = `Unsupported format: ${file.type}`;
      logRequest(requestLog);
      
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `Unsupported image format: ${file.type}. Supported formats: PNG, JPEG, WebP`,
        },
        { status: 400 }
      );
    }

    // Additional validation using OpenAI utility
    if (!validateImageFormat(file.type)) {
      requestLog.error = `Invalid image format: ${file.type}`;
      logRequest(requestLog);
      
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `Invalid image format: ${file.type}`,
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    let buffer: Buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (error) {
      requestLog.error = "Failed to read file";
      logRequest(requestLog);
      
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Failed to read uploaded file",
        },
        { status: 500 }
      );
    }

    // Estimate tokens before processing
    const estimatedTokens = estimateTokens(buffer.length);

    // Extract text using OpenAI Vision API
    const openaiStartTime = Date.now();
    let extractionResult;
    
    try {
      extractionResult = await extractTextFromImage(
        buffer,
        file.type,
        model,
        {
          maxSize: MAX_FILE_SIZE,
          maxDimension: 2048,
          quality: 85,
        }
      );
      
      const openaiResponseTime = Date.now() - openaiStartTime;
      requestLog.openaiResponseTime = openaiResponseTime;
      requestLog.tokensUsed =
        extractionResult.promptTokens + extractionResult.completionTokens;
    } catch (error) {
      const openaiResponseTime = Date.now() - openaiStartTime;
      requestLog.openaiResponseTime = openaiResponseTime;
      requestLog.error =
        error instanceof Error ? error.message : "OpenAI API error";
      logRequest(requestLog);

      // Handle specific OpenAI errors
      let errorMessage = "Failed to extract text from image";
      let statusCode = 500;

      if (error instanceof Error) {
        errorMessage = error.message;

        if (errorMessage.includes("Rate limit")) {
          statusCode = 429;
        } else if (errorMessage.includes("API key") || errorMessage.includes("Invalid")) {
          statusCode = 401;
        } else if (errorMessage.includes("quota")) {
          statusCode = 402;
        } else if (errorMessage.includes("Unsupported")) {
          statusCode = 400;
        } else if (errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
          statusCode = 504;
        }
      }

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: errorMessage,
        },
        { status: statusCode }
      );
    }

    // Save to database
    let screenshot;
    try {
      screenshot = await ScreenshotModel.create({
        filename:
          file.name ||
          `screenshot-${Date.now()}.${file.type.split("/")[1] || "png"}`,
        extractedText: extractionResult.text,
        language: extractionResult.language,
        confidence: extractionResult.confidence,
        model: extractionResult.model,
        promptTokens: extractionResult.promptTokens,
        completionTokens: extractionResult.completionTokens,
        imageSize: file.size,
        mimeType: file.type,
      });
    } catch (error) {
      requestLog.error =
        error instanceof Error ? error.message : "Database save failed";
      logRequest(requestLog);

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Failed to save result to database",
        },
        { status: 500 }
      );
    }

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Success response
    requestLog.success = true;
    logRequest(requestLog);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          extractedText: extractionResult.text,
          confidence: extractionResult.confidence,
          language: extractionResult.language,
          model: extractionResult.model,
          processingTime,
          _id: screenshot._id?.toString() || "",
        },
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          "X-RateLimit-Reset": rateLimit.resetTime.toString(),
        },
      }
    );
  } catch (error) {
    // Catch-all error handler
    const processingTime = Date.now() - startTime;
    requestLog.error =
      error instanceof Error ? error.message : "Unknown error occurred";
    requestLog.openaiResponseTime = processingTime;
    logRequest(requestLog);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while processing the image",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ocr/logs
 * Get request logs (for debugging - remove in production or add authentication)
 */
export async function GET(request: NextRequest) {
  // In production, add authentication here
  const limit = parseInt(
    request.nextUrl.searchParams.get("limit") || "100",
    10
  );

  return NextResponse.json({
    logs: requestLogs.slice(-limit).reverse(), // Most recent first
    total: requestLogs.length,
  });
}

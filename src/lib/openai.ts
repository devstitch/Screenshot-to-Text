import OpenAI from "openai";
import sharp from "sharp";

// Lazy initialization to avoid build-time errors
let openaiClient: OpenAI | null = null;

/**
 * Get OpenAI client instance (lazy initialization)
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Please add your OpenAI API key to .env.local");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * OpenAI client instance (for backward compatibility)
 */
export const openai = {
  get chat() {
    return getOpenAIClient().chat;
  },
};

/**
 * Supported image MIME types
 */
const SUPPORTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/**
 * Maximum image size in bytes before compression (20MB)
 */
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

/**
 * Maximum image dimension (OpenAI recommends max 2048px)
 */
const MAX_IMAGE_DIMENSION = 2048;

/**
 * Result from text extraction
 */
export interface ExtractionResult {
  text: string;
  language: string;
  confidence: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Image processing options
 */
export interface ImageProcessingOptions {
  maxSize?: number;
  maxDimension?: number;
  quality?: number;
}

/**
 * Convert image buffer to base64 string
 * @param buffer - Image buffer
 * @param mimeType - Image MIME type
 * @returns Base64 encoded string (without data URL prefix)
 */
export function convertImageToBase64(
  buffer: Buffer,
  mimeType: string
): string {
  return buffer.toString("base64");
}

/**
 * Validate if the image format is supported
 * @param mimeType - Image MIME type
 * @returns True if format is supported
 */
export function validateImageFormat(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.some((type) =>
    mimeType.toLowerCase().includes(type.split("/")[1])
  );
}

/**
 * Estimate token usage for an image
 * OpenAI Vision API pricing:
 * - Low-res: 85 tokens per image
 * - High-res: 170 tokens per image (if > 512px on shortest side)
 * @param imageSize - Image size in bytes
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Estimated token count
 */
export function estimateTokens(
  imageSize: number,
  width?: number,
  height?: number
): number {
  // Base tokens for the image
  let tokens = 85; // Low-res base

  // If we have dimensions and image is high-res, use high-res pricing
  if (width && height) {
    const minDimension = Math.min(width, height);
    if (minDimension > 512) {
      tokens = 170; // High-res base
      // Additional tokens for larger images (rough estimate)
      const maxDimension = Math.max(width, height);
      if (maxDimension > 2048) {
        tokens += Math.ceil((maxDimension - 2048) / 512) * 85;
      }
    }
  }

  // Add tokens for base64 encoding overhead (rough estimate)
  const base64Overhead = Math.ceil(imageSize / 3) * 0.75;
  tokens += Math.ceil(base64Overhead / 4); // Rough token estimate

  return tokens;
}

/**
 * Compress and resize image if needed to reduce token usage
 * @param buffer - Image buffer
 * @param mimeType - Original MIME type
 * @param options - Processing options
 * @returns Processed image buffer and updated MIME type
 */
export async function compressImageIfNeeded(
  buffer: Buffer,
  mimeType: string,
  options: ImageProcessingOptions = {}
): Promise<{ buffer: Buffer; mimeType: string; width?: number; height?: number }> {
  const maxSize = options.maxSize || MAX_IMAGE_SIZE;
  const maxDimension = options.maxDimension || MAX_IMAGE_DIMENSION;
  const quality = options.quality || 85;

  // If image is small enough, return as-is
  if (buffer.length <= maxSize) {
    try {
      const metadata = await sharp(buffer).metadata();
      if (
        metadata.width &&
        metadata.height &&
        metadata.width <= maxDimension &&
        metadata.height <= maxDimension
      ) {
        return {
          buffer,
          mimeType,
          width: metadata.width,
          height: metadata.height,
        };
      }
    } catch (error) {
      // If sharp can't process it, return original
      console.warn("Could not process image metadata:", error);
      return { buffer, mimeType };
    }
  }

  try {
    let image = sharp(buffer);

    // Get metadata
    const metadata = await image.metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    // Resize if needed
    if (originalWidth > maxDimension || originalHeight > maxDimension) {
      image = image.resize(maxDimension, maxDimension, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Convert to JPEG for better compression (unless it's already optimized)
    let outputMimeType = mimeType;
    if (mimeType === "image/png" && buffer.length > 500 * 1024) {
      // Convert large PNGs to JPEG
      image = image.jpeg({ quality });
      outputMimeType = "image/jpeg";
    } else if (mimeType.includes("heic") || mimeType.includes("heif")) {
      // Convert HEIC/HEIF to JPEG
      image = image.jpeg({ quality });
      outputMimeType = "image/jpeg";
    } else if (mimeType === "image/webp") {
      image = image.webp({ quality });
    } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
      image = image.jpeg({ quality });
    }

    // Compress
    let compressedBuffer = await image.toBuffer();

    // If still too large, reduce quality further
    if (compressedBuffer.length > maxSize && quality > 50) {
      const reducedQuality = Math.max(50, quality - 20);
      image = sharp(buffer)
        .resize(maxDimension, maxDimension, {
          fit: "inside",
          withoutEnlargement: true,
        });

      if (outputMimeType === "image/jpeg" || outputMimeType === "image/jpg") {
        image = image.jpeg({ quality: reducedQuality });
      } else {
        image = image.webp({ quality: reducedQuality });
      }

      compressedBuffer = await image.toBuffer();
    }

    const finalMetadata = await sharp(compressedBuffer).metadata();

    return {
      buffer: compressedBuffer,
      mimeType: outputMimeType,
      width: finalMetadata.width,
      height: finalMetadata.height,
    };
  } catch (error) {
    console.error("Error compressing image:", error);
    // Return original if compression fails
    return { buffer, mimeType };
  }
}

/**
 * Parse language and confidence from OpenAI response
 * @param text - Full response text from OpenAI
 * @returns Object with extracted text, language, and confidence
 */
function parseExtractionResponse(text: string): {
  extractedText: string;
  language: string;
  confidence: number;
} {
  // Look for LANGUAGE: and CONFIDENCE: markers
  const languageMatch = text.match(/LANGUAGE:\s*([a-z]{2,3})/i);
  const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+(?:\.\d+)?)/i);

  let extractedText = text;
  let language = "en"; // Default
  let confidence = 95; // Default

  // Extract language
  if (languageMatch) {
    language = languageMatch[1].toLowerCase();
    // Remove the LANGUAGE line from text
    extractedText = extractedText.replace(/LANGUAGE:\s*[a-z]{2,3}\s*/i, "");
  }

  // Extract confidence
  if (confidenceMatch) {
    confidence = parseFloat(confidenceMatch[1]);
    // Remove the CONFIDENCE line from text
    extractedText = extractedText.replace(/CONFIDENCE:\s*\d+(?:\.\d+)?\s*/i, "");
  }

  // Clean up the text (remove trailing newlines and whitespace)
  extractedText = extractedText.trim();

  // If no markers found, try to detect language from text
  if (!languageMatch) {
    language = detectLanguageFromText(extractedText);
  }

  // If no confidence found, estimate based on text characteristics
  if (!confidenceMatch) {
    confidence = estimateConfidence(extractedText);
  }

  return { extractedText, language, confidence };
}

/**
 * Detect language from text using heuristics
 * @param text - Text to analyze
 * @returns Language code
 */
function detectLanguageFromText(text: string): string {
  // Chinese characters
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  // Japanese characters (Hiragana, Katakana)
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "ja";
  // Korean characters
  if (/[\uac00-\ud7a3]/.test(text)) return "ko";
  // Arabic characters
  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  // Cyrillic characters
  if (/[\u0400-\u04ff]/.test(text)) return "ru";
  // Thai characters
  if (/[\u0e00-\u0e7f]/.test(text)) return "th";
  // Hebrew characters
  if (/[\u0590-\u05ff]/.test(text)) return "he";

  // Default to English
  return "en";
}

/**
 * Estimate confidence based on text characteristics
 * @param text - Extracted text
 * @returns Confidence score (0-100)
 */
function estimateConfidence(text: string): number {
  if (!text || text.length === 0) return 0;

  let confidence = 80; // Base confidence

  // Increase confidence if text has good structure
  if (text.length > 10) confidence += 5;
  if (text.length > 50) confidence += 5;
  if (text.length > 100) confidence += 5;

  // Check for common patterns that suggest good extraction
  const hasLetters = /[a-zA-Z]/.test(text);
  const hasNumbers = /\d/.test(text);
  const hasSpaces = /\s/.test(text);
  const hasPunctuation = /[.,!?;:]/.test(text);

  if (hasLetters && hasSpaces) confidence += 5;
  if (hasNumbers) confidence += 2;
  if (hasPunctuation) confidence += 3;

  // Decrease confidence if text looks garbled
  const garbledPattern = /[^\w\s\u00C0-\u017F\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7a3.,!?;:()\[\]{}\-'"\/\\]/.test(text);
  if (garbledPattern && text.length < 20) confidence -= 10;

  return Math.min(100, Math.max(0, confidence));
}

/**
 * Handle OpenAI API errors with retry logic
 * @param error - Error object
 * @param retries - Number of retries attempted
 * @returns Error message
 */
function handleApiError(error: unknown, retries: number = 0): string {
  if (error instanceof OpenAI.APIError) {
    // Rate limit error
    if (error.status === 429) {
      const retryAfter = error.headers?.["retry-after"];
      return `Rate limit exceeded. Please try again${retryAfter ? ` after ${retryAfter} seconds` : " later"}.`;
    }

    // Invalid API key
    if (error.status === 401) {
      return "Invalid OpenAI API key. Please check your configuration.";
    }

    // Insufficient quota
    if (error.status === 402) {
      return "Insufficient OpenAI API quota. Please check your account.";
    }

    // Model not found
    if (error.status === 404) {
      return "OpenAI model not found. Please check the model name.";
    }

    // Server error
    if (error.status >= 500) {
      return `OpenAI server error. Please try again${retries > 0 ? ` (retry ${retries})` : ""}.`;
    }

    return error.message || "OpenAI API error occurred.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred while processing the image.";
}

/**
 * Extract text from image using OpenAI Vision API
 * @param imageBuffer - Image buffer or base64 string
 * @param mimeType - Image MIME type
 * @param model - OpenAI model to use (gpt-4o or gpt-4o-mini)
 * @param options - Image processing options
 * @returns Extraction result with text, language, confidence, and token usage
 * @throws Error if extraction fails
 */
export async function extractTextFromImage(
  imageBuffer: Buffer | string,
  mimeType: string,
  model: "gpt-4o" | "gpt-4o-mini" = "gpt-4o",
  options: ImageProcessingOptions = {}
): Promise<ExtractionResult> {
  // Validate image format
  if (!validateImageFormat(mimeType)) {
    throw new Error(
      `Unsupported image format: ${mimeType}. Supported formats: PNG, JPEG, WebP, HEIC`
    );
  }

  let buffer: Buffer;
  let finalMimeType = mimeType;
  let width: number | undefined;
  let height: number | undefined;

  // Convert base64 to buffer if needed
  if (typeof imageBuffer === "string") {
    buffer = Buffer.from(imageBuffer, "base64");
  } else {
    buffer = imageBuffer;
  }

  // Compress and resize if needed
  try {
    const processed = await compressImageIfNeeded(buffer, mimeType, options);
    buffer = processed.buffer;
    finalMimeType = processed.mimeType;
    width = processed.width;
    height = processed.height;
  } catch (error) {
    console.warn("Image compression failed, using original:", error);
    // Continue with original image
  }

  // Convert to base64
  const base64Image = convertImageToBase64(buffer, finalMimeType);

  // Optimized prompt for text extraction
  const prompt = `Extract all text from this image with high accuracy. 
Preserve formatting, line breaks, and structure. 
If the image contains tables, preserve their structure.
Return the text in plain text format.
After the text, on a new line, add:
LANGUAGE: [detected language code]
CONFIDENCE: [your confidence level 0-100]`;

  // Retry logic for API calls
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${finalMimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1, // Lower temperature for more consistent extraction
      });

      const fullText = response.choices[0]?.message?.content || "";
      const usage = response.usage;

      // Parse the response
      const { extractedText, language, confidence } =
        parseExtractionResponse(fullText);

      return {
        text: extractedText,
        language,
        confidence,
        model: response.model,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on certain errors
      if (error instanceof OpenAI.APIError) {
        if (error.status === 401 || error.status === 402 || error.status === 404) {
          throw new Error(handleApiError(error));
        }

        // Rate limit - wait before retrying
        if (error.status === 429 && attempt < maxRetries - 1) {
          const retryAfter = error.headers?.["retry-after"];
          const waitTime = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }

      // If it's the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw new Error(handleApiError(error, attempt));
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }

  throw new Error(
    lastError
      ? handleApiError(lastError, maxRetries)
      : "Failed to extract text from image after multiple attempts"
  );
}

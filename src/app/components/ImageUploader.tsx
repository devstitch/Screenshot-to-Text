"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Image as ImageIcon, X } from "lucide-react";
import { ApiResponse } from "@/types";

interface ImageUploaderProps {
  onTextExtracted: (data: {
    extractedText: string;
    confidence: number;
    language: string;
    model: string;
    processingTime: number;
    _id: string;
  }) => void;
  onError: (error: string) => void;
  isProcessing?: boolean;
  setIsProcessing?: (processing: boolean) => void;
}

export default function ImageUploader({
  onTextExtracted,
  onError,
  isProcessing: externalIsProcessing,
  setIsProcessing: setExternalIsProcessing,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const isProcessing = externalIsProcessing ?? uploading;

  const processFile = useCallback(
    async (file: File) => {
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload and process
      const processing = true;
      setUploading(processing);
      setExternalIsProcessing?.(processing);

      const formData = new FormData();
      formData.append("image", file);

      try {
        const response = await fetch("/api/ocr", {
          method: "POST",
          body: formData,
        });

        const data: ApiResponse<{
          extractedText: string;
          confidence: number;
          language: string;
          model: string;
          processingTime: number;
          _id: string;
        }> = await response.json();

        if (!data.success || !data.data) {
          throw new Error(data.error || "Failed to extract text");
        }

        onTextExtracted(data.data);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to process image";
        onError(errorMessage);
      } finally {
        setUploading(false);
        setExternalIsProcessing?.(false);
      }
    },
    [onTextExtracted, onError, setExternalIsProcessing]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      processFile(file);
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    maxFiles: 1,
    disabled: isProcessing,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const clearPreview = () => {
    setPreview(null);
  };

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative group">
          <img
            src={preview}
            alt="Preview"
            className="w-full max-w-md mx-auto rounded-lg shadow-lg transition-transform group-hover:scale-[1.02]"
          />
          <button
            onClick={clearPreview}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-all shadow-lg hover:scale-110"
            aria-label="Remove image"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
            transition-all duration-200
            ${
              isDragActive
                ? "border-blue-500 bg-blue-50 scale-[1.02] shadow-lg"
                : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50"
            }
            ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            {isProcessing ? (
              <>
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-500"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
                <div>
                  <p className="text-lg font-medium text-gray-700">
                    Processing image...
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    This may take a few seconds
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-5 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full">
                  {isDragActive ? (
                    <Upload className="w-10 h-10 text-blue-600" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">
                    {isDragActive
                      ? "Drop the image here"
                      : "Drag & drop an image here"}
                  </p>
                  <p className="text-sm text-gray-500 mb-1">
                    or click to select a file
                  </p>
                  <p className="text-xs text-gray-400">
                    Supports PNG, JPG, JPEG, WebP (max 10MB)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

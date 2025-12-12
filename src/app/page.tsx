"use client";

import { useState, useEffect, useCallback } from "react";
import ImageUploader from "./components/ImageUploader";
import TextResult from "./components/TextResult";
import HistoryList from "./components/HistoryList";
import ToastContainer, { useToast } from "./components/Toast";
import { TextResultSkeleton } from "./components/LoadingSkeleton";
import { ApiResponse } from "@/types";

interface ExtractedData {
  extractedText: string;
  confidence: number;
  language: string;
  model: string;
  processingTime: number;
  _id: string;
}

export default function Home() {
  const [extractedText, setExtractedText] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [language, setLanguage] = useState("");
  const [model, setModel] = useState("");
  const [processingTime, setProcessingTime] = useState(0);
  const [extractedId, setExtractedId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshHistory, setRefreshHistory] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();

  // Handle text extraction from OCR API
  const handleTextExtracted = useCallback(
    (data: ExtractedData) => {
      setExtractedText(data.extractedText);
      setConfidence(data.confidence);
      setLanguage(data.language);
      setModel(data.model);
      setProcessingTime(data.processingTime);
      setExtractedId(data._id);
      setError(null);
      setRefreshHistory((prev) => prev + 1);
      toast.success("Text extracted successfully!");
    },
    [toast]
  );

  // Handle errors
  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage);
      setExtractedText("");
      toast.error(errorMessage);
    },
    [toast]
  );

  // Clear current result
  const handleClear = useCallback(() => {
    setExtractedText("");
    setConfidence(0);
    setLanguage("");
    setModel("");
    setProcessingTime(0);
    setExtractedId("");
    setError(null);
  }, []);

  // Handle history update trigger
  const handleHistoryUpdate = useCallback(() => {
    setRefreshHistory((prev) => prev + 1);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+V or Cmd+V: Paste image from clipboard
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        // Handle paste event
        const handlePaste = async (event: ClipboardEvent) => {
          const items = event.clipboardData?.items;
          if (!items) return;

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf("image") !== -1) {
              e.preventDefault();
              const blob = item.getAsFile();
              if (blob) {
                const file = new File([blob], "pasted-image.png", {
                  type: blob.type,
                });
                setIsProcessing(true);
                setError(null);

                try {
                  const formData = new FormData();
                  formData.append("image", file);

                  const response = await fetch("/api/ocr", {
                    method: "POST",
                    body: formData,
                  });

                  const data: ApiResponse<ExtractedData> =
                    await response.json();

                  if (!data.success || !data.data) {
                    throw new Error(data.error || "Failed to extract text");
                  }

                  handleTextExtracted(data.data);
                } catch (error) {
                  const errorMessage =
                    error instanceof Error
                      ? error.message
                      : "Failed to process image";
                  handleError(errorMessage);
                } finally {
                  setIsProcessing(false);
                }
              }
            }
          }
        };

        document.addEventListener("paste", handlePaste, { once: true });
      }

      // Escape: Clear current result
      if (e.key === "Escape" && extractedText) {
        handleClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [extractedText, handleClear, handleTextExtracted, handleError]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Screenshot to Text
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Extract text from images using AI-powered OCR. Upload screenshots,
            paste from clipboard (Ctrl+V), or drag and drop images.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm text-gray-500">
            <span className="px-3 py-1 bg-white rounded-full shadow-sm">
              Ctrl+V to paste
            </span>
            <span className="px-3 py-1 bg-white rounded-full shadow-sm">
              Esc to clear
            </span>
            <span className="px-3 py-1 bg-white rounded-full shadow-sm">
              Supports PNG, JPEG, WebP
            </span>
          </div>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left Column: Upload and Results */}
          <div className="space-y-6">
            {/* Image Uploader */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Upload Image
              </h2>
              <ImageUploader
                onTextExtracted={handleTextExtracted}
                onError={handleError}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
              />
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg animate-in fade-in slide-in-from-top-2">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Text Result */}
            {isProcessing ? (
              <TextResultSkeleton />
            ) : extractedText ? (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <TextResult
                  result={{
                    text: extractedText,
                    confidence,
                    timestamp: new Date(),
                  }}
                  language={language}
                  model={model}
                  processingTime={processingTime}
                  onClear={handleClear}
                  onCopy={() => toast.copy()}
                />
              </div>
            ) : null}
          </div>

          {/* Right Column: History */}
          <div className="animate-in fade-in slide-in-from-right-4">
            <HistoryList
              refreshTrigger={refreshHistory}
              onDelete={() => {
                toast.deleteToast();
                handleHistoryUpdate();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

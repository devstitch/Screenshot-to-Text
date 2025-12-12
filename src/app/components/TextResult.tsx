"use client";

import { Copy, Check, X, Globe, Zap, Clock, Download } from "lucide-react";
import { useState } from "react";
import { OcrResult } from "@/types";

interface TextResultProps {
  result: OcrResult;
  language?: string;
  model?: string;
  processingTime?: number;
  onClear?: () => void;
  onCopy?: () => void;
}

export default function TextResult({
  result,
  language,
  model,
  processingTime,
  onClear,
  onCopy,
}: TextResultProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([result.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracted-text-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Extracted Text
          </h2>
          <div className="flex items-center gap-2">
            {onClear && (
              <button
                onClick={onClear}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Clear result"
                title="Clear (Esc)"
              >
                <X size={18} />
              </button>
            )}
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all shadow-sm hover:shadow-md"
              aria-label="Download as TXT"
              title="Download as TXT"
            >
              <Download size={18} />
              <span>Download</span>
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg"
              aria-label="Copy text"
            >
              {copied ? (
                <>
                  <Check size={18} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={18} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Metadata */}
        {(language || model || processingTime || result.confidence) && (
          <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-gray-200">
            {result.confidence !== undefined && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>
                  Confidence:{" "}
                  <span className="font-semibold">
                    {result.confidence.toFixed(0)}%
                  </span>
                </span>
              </div>
            )}
            {language && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Globe size={14} />
                <span className="uppercase">{language}</span>
              </div>
            )}
            {model && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Zap size={14} />
                <span>{model}</span>
              </div>
            )}
            {processingTime && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Clock size={14} />
                <span>{processingTime}ms</span>
              </div>
            )}
          </div>
        )}

        {/* Extracted Text */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-96 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
            {result.text || "No text extracted"}
          </pre>
        </div>

        {/* Timestamp */}
        {result.timestamp && (
          <p className="text-xs text-gray-500 mt-4">
            Extracted at: {new Date(result.timestamp).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

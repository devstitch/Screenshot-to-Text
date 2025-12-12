"use client";

import { useEffect, useState } from "react";
import { Trash2, FileText, RefreshCw } from "lucide-react";
import { HistoryItem, ApiResponse } from "@/types";
import { HistoryListSkeleton, HistoryItemSkeleton } from "./LoadingSkeleton";

interface HistoryListProps {
  refreshTrigger?: number;
  onDelete?: () => void;
}

export default function HistoryList({
  refreshTrigger = 0,
  onDelete,
}: HistoryListProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/history?limit=50");
      const data: ApiResponse<HistoryItem[]> = await response.json();

      if (data.success && data.data) {
        setHistory(data.data);
      } else {
        setError(data.error || "Failed to load history");
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
      setError("Database connection failed. History is unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) {
      return;
    }

    try {
      setDeletingId(id);
      const response = await fetch(`/api/history?id=${id}`, {
        method: "DELETE",
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        setHistory(history.filter((item) => item._id !== id));
        onDelete?.();
      } else {
        alert(data.error || "Failed to delete item");
      }
    } catch (error) {
      console.error("Failed to delete item:", error);
      alert("Failed to delete item");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger]);

  if (loading) {
    return <HistoryListSkeleton />;
  }

  return (
    <div className="w-full">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">History</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {error ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-red-600 text-lg mb-2">Connection Error</p>
            <p className="text-gray-500 text-sm mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">No history yet</p>
            <p className="text-gray-400 text-sm">
              Upload an image to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {history.map((item) => (
              <div
                key={item._id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all bg-white/50 backdrop-blur-sm animate-in fade-in slide-in-from-right-4"
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {item.filename}
                      </p>
                      <button
                        onClick={() => handleDelete(item._id)}
                        disabled={deletingId === item._id}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all hover:scale-110 disabled:opacity-50 flex-shrink-0 ml-2"
                        aria-label="Delete item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">
                      {item.extractedText.substring(0, 150)}
                      {item.extractedText.length > 150 ? "..." : ""}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

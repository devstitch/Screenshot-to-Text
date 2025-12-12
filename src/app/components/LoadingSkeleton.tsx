"use client";

export function TextResultSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-gray-200 rounded w-32"></div>
          <div className="h-10 bg-gray-200 rounded w-24"></div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
        <div className="h-3 bg-gray-200 rounded w-48 mt-4"></div>
      </div>
    </div>
  );
}

export function HistoryItemSkeleton() {
  return (
    <div className="border border-gray-200 rounded-lg p-4 animate-pulse">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-1">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistoryListSkeleton() {
  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="h-6 bg-gray-200 rounded w-24 mb-4"></div>
        <div className="space-y-4">
          <HistoryItemSkeleton />
          <HistoryItemSkeleton />
          <HistoryItemSkeleton />
        </div>
      </div>
    </div>
  );
}


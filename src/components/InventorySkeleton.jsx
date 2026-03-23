import React from 'react';

export default function InventorySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_120px_100px_140px] gap-6 px-8 py-4 border-b border-gray-100">
        <div className="h-4 bg-gray-200 rounded w-24"></div>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
        <div className="h-4 bg-gray-200 rounded w-24"></div>
        <div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div>
        <div className="h-4 bg-gray-200 rounded w-12 ml-auto"></div>
        <div className="h-4 bg-gray-200 rounded w-20 ml-auto"></div>
      </div>
      
      {/* Rows Skeletons */}
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_120px_100px_140px] gap-4 lg:gap-6 px-4 lg:px-8 py-4 border-b border-gray-50 items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl"></div>
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-100 rounded w-3/4"></div>
              <div className="h-3 bg-gray-50 rounded w-1/2"></div>
            </div>
          </div>
          <div className="hidden lg:block h-4 bg-gray-50 rounded w-full"></div>
          <div className="hidden lg:block h-4 bg-gray-50 rounded w-full"></div>
          <div className="hidden lg:block h-4 bg-gray-100 rounded w-2/3 ml-auto"></div>
          <div className="hidden lg:block h-4 bg-gray-100 rounded w-1/2 ml-auto"></div>
          <div className="flex justify-end gap-2">
            <div className="w-8 h-8 bg-gray-100 rounded-lg"></div>
            <div className="w-8 h-8 bg-gray-100 rounded-lg"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

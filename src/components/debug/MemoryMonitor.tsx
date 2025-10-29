import { useEffect, useState } from 'react';
import { getChunkedStorage } from '@/services/storage/ChunkedSessionStorage';

/**
 * MemoryMonitor - Real-time memory usage display for debugging
 *
 * Shows:
 * - JavaScript heap size
 * - Cache size and hit rate
 * - Memory growth rate
 * - Top memory consumers
 *
 * Usage: Add <MemoryMonitor /> anywhere in your app during debugging
 */
export function MemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<{
    heapUsed: number;
    heapTotal: number;
    heapLimit: number;
    cacheSize: number;
    cacheItems: number;
    cacheHitRate: number;
    growthRate: number;
  } | null>(null);

  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    const updateMemoryInfo = async () => {
      // Get JS heap info (if available - Chrome/Electron only)
      const performance = (window.performance as any);
      const memory = performance.memory;

      if (!memory) {
        console.warn('[MemoryMonitor] performance.memory not available - run in Chrome/DevTools');
        return;
      }

      const heapUsed = memory.usedJSHeapSize;
      const heapTotal = memory.totalJSHeapSize;
      const heapLimit = memory.jsHeapSizeLimit;

      // Get cache stats
      const chunkedStorage = await getChunkedStorage();
      const cacheStats = chunkedStorage.getCacheStats();

      // Calculate growth rate
      const newHistory = [...history, heapUsed].slice(-10); // Keep last 10 samples
      setHistory(newHistory);

      const growthRate = newHistory.length >= 2
        ? newHistory[newHistory.length - 1] - newHistory[0]
        : 0;

      setMemoryInfo({
        heapUsed,
        heapTotal,
        heapLimit,
        cacheSize: cacheStats.size,
        cacheItems: cacheStats.items,
        cacheHitRate: cacheStats.hitRate,
        growthRate,
      });

      // Log to console for debugging
      console.log('[MemoryMonitor]', {
        heapUsedMB: (heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (heapTotal / 1024 / 1024).toFixed(2),
        heapLimitMB: (heapLimit / 1024 / 1024).toFixed(2),
        cacheSizeMB: (cacheStats.size / 1024 / 1024).toFixed(2),
        cacheItems: cacheStats.items,
        cacheHitRate: cacheStats.hitRate.toFixed(1) + '%',
        growthRateMB: (growthRate / 1024 / 1024).toFixed(2) + ' MB/30s',
      });
    };

    // Update every 3 seconds
    const interval = setInterval(updateMemoryInfo, 3000);
    updateMemoryInfo(); // Initial update

    return () => clearInterval(interval);
  }, [history]);

  if (!memoryInfo) {
    return (
      <div className="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg max-w-md">
        <h3 className="font-bold mb-2">⚠️ Memory Monitor Unavailable</h3>
        <p className="text-sm">
          Open Chrome DevTools (Cmd+Option+I) to enable memory monitoring.
        </p>
        <p className="text-xs mt-2 opacity-75">
          performance.memory API not available
        </p>
      </div>
    );
  }

  const heapUsedMB = memoryInfo.heapUsed / 1024 / 1024;
  const heapTotalMB = memoryInfo.heapTotal / 1024 / 1024;
  const heapLimitMB = memoryInfo.heapLimit / 1024 / 1024;
  const cacheSizeMB = memoryInfo.cacheSize / 1024 / 1024;
  const growthRateMB = memoryInfo.growthRate / 1024 / 1024;

  const usagePercent = (heapUsedMB / heapLimitMB) * 100;
  const isLeaking = growthRateMB > 100; // Growing >100MB per 30 seconds

  return (
    <div
      className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg max-w-md text-white ${
        isLeaking ? 'bg-red-600' : usagePercent > 80 ? 'bg-orange-600' : 'bg-gray-800'
      }`}
      style={{ zIndex: 9999 }}
    >
      <h3 className="font-bold mb-3 flex items-center justify-between">
        <span>📊 Memory Monitor</span>
        {isLeaking && <span className="text-xs bg-red-800 px-2 py-1 rounded">LEAK DETECTED</span>}
      </h3>

      <div className="space-y-2 text-sm font-mono">
        {/* Heap Usage */}
        <div>
          <div className="flex justify-between mb-1">
            <span>Heap Used:</span>
            <span className="font-bold">{heapUsedMB.toFixed(0)} MB</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                usagePercent > 80 ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <div className="text-xs opacity-75 mt-1">
            {heapTotalMB.toFixed(0)} MB total / {heapLimitMB.toFixed(0)} MB limit ({usagePercent.toFixed(1)}%)
          </div>
        </div>

        {/* Growth Rate */}
        <div className={`${isLeaking ? 'bg-red-800/50 -mx-2 px-2 py-1 rounded' : ''}`}>
          <div className="flex justify-between">
            <span>Growth Rate:</span>
            <span className={`font-bold ${isLeaking ? 'text-red-200' : ''}`}>
              {growthRateMB > 0 ? '+' : ''}{growthRateMB.toFixed(1)} MB/30s
            </span>
          </div>
          {isLeaking && (
            <div className="text-xs text-red-200 mt-1">
              ⚠️ Memory is growing rapidly!
            </div>
          )}
        </div>

        {/* Cache Stats */}
        <div>
          <div className="flex justify-between">
            <span>Cache Size:</span>
            <span>{cacheSizeMB.toFixed(1)} MB ({memoryInfo.cacheItems} items)</span>
          </div>
          <div className="flex justify-between text-xs opacity-75">
            <span>Hit Rate:</span>
            <span>{memoryInfo.cacheHitRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 mt-2 border-t border-white/20 space-x-2">
          <button
            onClick={() => {
              const chunkedStorage = getChunkedStorage();
              chunkedStorage.then(s => {
                s.clearCache();
                console.log('[MemoryMonitor] Cache cleared');
              });
            }}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded"
          >
            Clear Cache
          </button>
          <button
            onClick={() => {
              if (window.gc) {
                window.gc();
                console.log('[MemoryMonitor] Manual GC triggered');
              } else {
                console.warn('[MemoryMonitor] Manual GC not available. Run Chrome with --js-flags="--expose-gc"');
              }
            }}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded"
          >
            Force GC
          </button>
        </div>
      </div>

      <div className="text-xs opacity-50 mt-3 text-center">
        Press Cmd+Option+I to open DevTools
      </div>
    </div>
  );
}

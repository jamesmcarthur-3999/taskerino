/**
 * MultiSourceRecordingConfig Component
 *
 * Allows users to configure multiple recording sources (displays, windows) for video recording.
 * Provides UI for:
 * - Adding/removing displays
 * - Adding/removing windows
 * - Selecting compositor layout (passthrough, grid, side-by-side)
 *
 * Task 2.10 - Phase 2
 */

import React, { useState } from 'react';
import { Monitor, X, Plus, Layout } from 'lucide-react';
import type { RecordingSource } from '../../services/videoRecordingService';
import type { DisplayInfo, WindowInfo } from '../../types';

interface Props {
  sources: RecordingSource[];
  compositor: 'passthrough' | 'grid' | 'sidebyside';
  availableDisplays: DisplayInfo[];
  availableWindows: WindowInfo[];
  onSourcesChange: (sources: RecordingSource[]) => void;
  onCompositorChange: (compositor: 'passthrough' | 'grid' | 'sidebyside') => void;
  onLoadDevices?: () => void;
  loadingDevices?: boolean;
}

export function MultiSourceRecordingConfig({
  sources,
  compositor,
  availableDisplays,
  availableWindows,
  onSourcesChange,
  onCompositorChange,
  onLoadDevices,
  loadingDevices = false,
}: Props) {
  const [showDisplayPicker, setShowDisplayPicker] = useState(false);
  const [showWindowPicker, setShowWindowPicker] = useState(false);

  const addDisplay = (display: DisplayInfo) => {
    const newSource: RecordingSource = {
      type: 'display',
      id: display.displayId,
      name: `Display ${display.displayId} (${display.width}x${display.height})`,
    };

    // Check if already added
    if (sources.some(s => s.type === 'display' && s.id === display.displayId)) {
      return;
    }

    onSourcesChange([...sources, newSource]);
    setShowDisplayPicker(false);
  };

  const addWindow = (window: WindowInfo) => {
    const newSource: RecordingSource = {
      type: 'window',
      id: window.windowId,
      name: `${window.owningApp}: ${window.title}`,
    };

    // Check if already added
    if (sources.some(s => s.type === 'window' && s.id === window.windowId)) {
      return;
    }

    onSourcesChange([...sources, newSource]);
    setShowWindowPicker(false);
  };

  const removeSource = (index: number) => {
    const newSources = sources.filter((_, i) => i !== index);
    onSourcesChange(newSources);
  };

  // Automatically switch to passthrough when only one source
  React.useEffect(() => {
    if (sources.length === 1 && compositor !== 'passthrough') {
      onCompositorChange('passthrough');
    }
  }, [sources.length, compositor, onCompositorChange]);

  return (
    <div className="space-y-4">
      {/* Sources List */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Recording Sources
        </label>

        {sources.length === 0 ? (
          <div className="text-sm text-gray-500 italic bg-gray-50 rounded-lg p-4 text-center">
            No sources added. Click "+ Add Display" or "+ Add Window" to begin.
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((source, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">
                    {source.name || `${source.type} ${source.id}`}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {source.type}
                  </span>
                </div>
                <button
                  onClick={() => removeSource(idx)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove source"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Buttons */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <button
            onClick={() => {
              if (availableDisplays.length === 0 && onLoadDevices) {
                onLoadDevices();
              }
              setShowDisplayPicker(!showDisplayPicker);
              setShowWindowPicker(false);
            }}
            disabled={loadingDevices}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">
              {loadingDevices ? 'Loading...' : 'Add Display'}
            </span>
          </button>

          {/* Display Picker Dropdown */}
          {showDisplayPicker && (
            <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto">
              {availableDisplays.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center">
                  No displays available. Check screen recording permissions.
                </div>
              ) : (
                <div className="p-2">
                  {availableDisplays.map((display) => (
                    <button
                      key={display.displayId}
                      onClick={() => addDisplay(display)}
                      disabled={sources.some(s => s.type === 'display' && s.id === display.displayId)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-medium text-gray-900">
                        Display {display.displayId}
                      </div>
                      <div className="text-xs text-gray-500">
                        {display.width}x{display.height} • {display.isPrimary ? 'Primary' : 'Secondary'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative flex-1">
          <button
            onClick={() => {
              if (availableWindows.length === 0 && onLoadDevices) {
                onLoadDevices();
              }
              setShowWindowPicker(!showWindowPicker);
              setShowDisplayPicker(false);
            }}
            disabled={loadingDevices}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">
              {loadingDevices ? 'Loading...' : 'Add Window'}
            </span>
          </button>

          {/* Window Picker Dropdown */}
          {showWindowPicker && (
            <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto">
              {availableWindows.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center">
                  No windows available. Check screen recording permissions.
                </div>
              ) : (
                <div className="p-2">
                  {availableWindows.map((window) => (
                    <button
                      key={window.windowId}
                      onClick={() => addWindow(window)}
                      disabled={sources.some(s => s.type === 'window' && s.id === window.windowId)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-medium text-gray-900 truncate">
                        {window.title || 'Untitled Window'}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {window.owningApp} • {window.bounds?.width || 0}x{window.bounds?.height || 0}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compositor Selector (only show for multiple sources) */}
      {sources.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Layout className="w-4 h-4 inline mr-1" />
            Layout Compositor
          </label>
          <select
            value={compositor}
            onChange={(e) => onCompositorChange(e.target.value as any)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="grid">Grid Layout (2x2 or 3x3)</option>
            <option value="sidebyside">Side by Side</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {compositor === 'grid' && 'Sources arranged in a grid pattern'}
            {compositor === 'sidebyside' && 'Sources arranged horizontally'}
          </p>
        </div>
      )}

      {/* Info Message */}
      {sources.length > 0 && (
        <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <strong className="text-blue-900">Tip:</strong> You can record up to 4 sources simultaneously.
          {sources.length === 1 && ' Add more sources to enable compositor options.'}
        </div>
      )}
    </div>
  );
}

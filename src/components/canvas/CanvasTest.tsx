/**
 * Canvas Test Page
 *
 * Visual test page for the Canvas Component System.
 * Renders the sample canvas to validate all 20 primitive components.
 */

import React from 'react';
import { ComponentRenderer } from './ComponentRenderer';
import { sampleCanvas } from './sample-canvas';

export function CanvasTest() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8 p-6 bg-white/80 backdrop-blur-md border-2 border-gray-200 rounded-xl shadow-lg">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Canvas Component System - Test Page
          </h1>
          <p className="text-gray-600">
            Visual validation of all 20 primitive components in a comprehensive session summary layout.
          </p>
          <div className="mt-4 flex gap-2">
            <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
              ✓ 20 Components
            </span>
            <span className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
              ✓ Type Safe
            </span>
            <span className="px-3 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
              ✓ AI Composable
            </span>
          </div>
        </div>

        {/* Render Sample Canvas */}
        <div className="space-y-6">
          <ComponentRenderer tree={sampleCanvas} />
        </div>

        {/* Debug Info */}
        <div className="mt-8 p-6 bg-gray-900 text-gray-100 rounded-xl font-mono text-sm overflow-x-auto">
          <div className="font-bold text-cyan-400 mb-2">Canvas JSON Structure:</div>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(sampleCanvas, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

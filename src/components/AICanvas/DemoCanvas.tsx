/**
 * Demo AI Canvas
 *
 * This demonstrates what an AI-generated session summary canvas would look like.
 * Uses REAL session data to show a beautiful, bespoke layout.
 */

import React, { useState } from 'react';
import { Calendar, Clock, Target, Lightbulb, AlertCircle, CheckCircle2, Camera, TrendingUp } from 'lucide-react';
import type { Session } from '../../types';
import { getRadiusClass, getGlassClasses } from '../../design-system/theme';

interface DemoCanvasProps {
  session: Session;
}

export function DemoCanvas({ session }: DemoCanvasProps) {
  const [selectedMoment, setSelectedMoment] = useState<number | null>(null);

  // Calculate duration
  const duration = session.endTime
    ? Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
    : 0;

  // Get summary data
  const summary = session.summary;
  const hasAudio = session.audioSegments && session.audioSegments.length > 0;
  const hasVideo = session.video?.fullVideoAttachmentId;

  // Determine canvas theme based on session type
  const theme = getCanvasTheme(session);

  // Get key moments (screenshots with high importance)
  const keyMoments = session.screenshots
    .filter(s => s.aiAnalysis?.confidence && s.aiAnalysis.confidence > 0.7)
    .slice(0, 4);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div
        className={`relative overflow-hidden ${getRadiusClass('card')} shadow-2xl`}
        style={{
          background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
          minHeight: '280px',
        }}
      >
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 animate-gradient" />

        <div className="relative z-10 p-8 text-white">
          {/* Session type badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-sm font-semibold mb-4">
            <span className="text-2xl">{theme.icon}</span>
            <span>{theme.label}</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold mb-4 drop-shadow-lg">
            {session.name}
          </h1>

          {/* Narrative */}
          {summary?.narrative && (
            <p className="text-lg text-white/90 leading-relaxed max-w-3xl mb-6 drop-shadow">
              {summary.narrative}
            </p>
          )}

          {/* Stats bar */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>{Math.floor(duration / 60)}h {duration % 60}m</span>
            </div>
            <div className="flex items-center gap-2">
              <Camera size={16} />
              <span>{session.screenshots.length} captures</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>{new Date(session.startTime).toLocaleDateString()}</span>
            </div>
            {hasAudio && (
              <div className="flex items-center gap-2">
                <TrendingUp size={16} />
                <span>Audio insights</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left column - Timeline */}
        <div className="col-span-2 space-y-6">
          {/* The Journey */}
          {keyMoments.length > 0 && (
            <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6 shadow-xl`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                  📸
                </div>
                <h2 className="text-xl font-bold text-gray-900">The Journey</h2>
              </div>

              <div className="space-y-4">
                {keyMoments.map((screenshot, idx) => {
                  const time = new Date(screenshot.timestamp);
                  const isSelected = selectedMoment === idx;

                  return (
                    <div
                      key={screenshot.id}
                      onClick={() => setSelectedMoment(idx)}
                      className={`group relative cursor-pointer transition-all ${
                        isSelected ? 'scale-[1.02]' : ''
                      }`}
                    >
                      {/* Timeline dot */}
                      <div className="absolute left-0 top-6 w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-4 border-white shadow-lg z-10" />

                      {/* Timeline line */}
                      {idx < keyMoments.length - 1 && (
                        <div className="absolute left-[7px] top-10 w-[2px] h-full bg-gradient-to-b from-purple-300 to-pink-300" />
                      )}

                      {/* Content card */}
                      <div className={`ml-10 ${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 hover:shadow-lg transition-all ${
                        isSelected ? 'ring-2 ring-purple-500 shadow-xl' : ''
                      }`}>
                        <div className="flex items-start gap-4">
                          {/* Thumbnail */}
                          {screenshot.attachmentId && (
                            <div className="flex-shrink-0 w-24 h-16 bg-gray-200 rounded-lg overflow-hidden">
                              <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400" />
                            </div>
                          )}

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-600 mb-1">
                              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-sm font-semibold text-gray-900 mb-1">
                              {screenshot.aiAnalysis?.detectedActivity || 'Activity detected'}
                            </div>
                            <p className="text-sm text-gray-700 line-clamp-2">
                              {screenshot.aiAnalysis?.summary || 'Working on task'}
                            </p>
                          </div>

                          {/* Confidence badge */}
                          {screenshot.aiAnalysis?.confidence && (
                            <div className="flex-shrink-0">
                              <div className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                                {Math.round(screenshot.aiAnalysis.confidence * 100)}%
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Insights */}
          {summary?.keyInsights && summary.keyInsights.length > 0 && (
            <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6 shadow-xl`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <Lightbulb size={20} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Key Insights</h2>
              </div>

              <div className="space-y-3">
                {summary.keyInsights.slice(0, 3).map((insight, idx) => (
                  <div
                    key={idx}
                    className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 border-amber-500`}
                  >
                    <p className="text-gray-800 font-medium">{insight.insight}</p>
                    <p className="text-xs text-gray-600 mt-2">
                      {new Date(insight.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column - Achievements & Blockers */}
        <div className="space-y-6">
          {/* Achievements */}
          {summary?.achievements && summary.achievements.length > 0 && (
            <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6 shadow-xl`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Wins</h2>
              </div>

              <div className="space-y-3">
                {summary.achievements.map((achievement, idx) => (
                  <div
                    key={idx}
                    className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} p-3 border-l-4 border-green-500`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 text-lg flex-shrink-0">✓</span>
                      <p className="text-sm text-gray-800">{achievement}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blockers */}
          {summary?.blockers && summary.blockers.length > 0 && (
            <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6 shadow-xl`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center">
                  <AlertCircle size={20} className="text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Blockers</h2>
              </div>

              <div className="space-y-3">
                {summary.blockers.map((blocker, idx) => (
                  <div
                    key={idx}
                    className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} p-3 border-l-4 border-red-500`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-red-600 text-lg flex-shrink-0">⚠</span>
                      <p className="text-sm text-gray-800">{blocker}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Tasks */}
          {summary?.recommendedTasks && summary.recommendedTasks.length > 0 && (
            <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6 shadow-xl`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <Target size={20} className="text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Next Steps</h2>
              </div>

              <div className="space-y-3">
                {summary.recommendedTasks.slice(0, 3).map((task, idx) => (
                  <div
                    key={idx}
                    className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} p-3`}
                  >
                    <div className="font-semibold text-gray-900 text-sm mb-1">
                      {task.title}
                    </div>
                    <div className="text-xs text-gray-600">
                      Priority: <span className="font-semibold">{task.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Demo badge */}
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-full text-sm text-gray-700">
          ✨ <strong>Demo Canvas</strong> - This layout was designed to showcase what AI would generate for this session
        </div>
      </div>
    </div>
  );
}

/**
 * Determine canvas theme based on session characteristics
 */
function getCanvasTheme(session: Session) {
  const category = session.category?.toLowerCase() || '';
  const summary = session.summary;

  // Coding/Development
  if (category.includes('dev') || category.includes('coding') || category.includes('debug')) {
    return {
      label: 'Deep Work Session',
      icon: '⚡️',
      primary: '#3b82f6',
      secondary: '#8b5cf6',
    };
  }

  // Meeting/Collaboration
  if (category.includes('meeting') || category.includes('collab')) {
    return {
      label: 'Collaborative Meeting',
      icon: '👥',
      primary: '#10b981',
      secondary: '#06b6d4',
    };
  }

  // Learning
  if (category.includes('learn') || category.includes('research')) {
    return {
      label: 'Learning Session',
      icon: '📚',
      primary: '#f59e0b',
      secondary: '#ef4444',
    };
  }

  // Creative
  if (category.includes('design') || category.includes('creative')) {
    return {
      label: 'Creative Work',
      icon: '🎨',
      primary: '#ec4899',
      secondary: '#8b5cf6',
    };
  }

  // Default
  return {
    label: 'Work Session',
    icon: '🎯',
    primary: '#6366f1',
    secondary: '#06b6d4',
  };
}

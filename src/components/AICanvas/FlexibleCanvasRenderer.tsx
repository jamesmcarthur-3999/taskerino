/**
 * Flexible Canvas Renderer
 *
 * Renders FlexibleSessionSummary with dynamic sections chosen by AI.
 * Each session gets a unique layout based on the sections the AI selected.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Session, FlexibleSessionSummary, SummarySection, RelatedContextSection, Task, Note } from '../../types';
import type { CanvasSpec } from '../../services/aiCanvasGenerator';
import { HeroTimeline } from './heroes/HeroTimeline';
import { HeroSplit } from './heroes/HeroSplit';
import { HeroCelebration } from './heroes/HeroCelebration';
import { getRadiusClass, getGlassClasses } from '../../design-system/theme';
import { fadeInVariants, createStaggerVariants } from '../../lib/animations';
import {
  LearningCard,
  BreakthroughCard,
  ProblemSolvingCard,
  TechnicalDiscoveryCard,
  FlowStateCard,
  FocusAreaCard,
  EmotionalJourneyCard,
  CreativeSolutionCard,
  CollaborationCard,
} from './cards';
import { Link2, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useTasks } from '../../context/TasksContext';
import { useNotes } from '../../context/NotesContext';

interface FlexibleCanvasRendererProps {
  session: Session;
  summary: FlexibleSessionSummary;
  spec: CanvasSpec;
}

export function FlexibleCanvasRenderer({ session, summary, spec }: FlexibleCanvasRendererProps) {
  const duration = session.endTime
    ? Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
    : 0;

  const stats = {
    duration: `${Math.floor(duration / 60)}h ${duration % 60}m`,
    screenshots: session.screenshots?.length || 0,
    date: new Date(session.startTime).toLocaleDateString(),
  };

  const staggerVariants = createStaggerVariants({ staggerChildren: 0.1 });

  // Sort sections by emphasis and position
  const sortedSections = [...summary.sections].sort((a, b) => {
    const emphasisWeight = { high: 3, medium: 2, low: 1 };
    if (a.emphasis !== b.emphasis) {
      return emphasisWeight[b.emphasis] - emphasisWeight[a.emphasis];
    }
    return a.position - b.position;
  });

  return (
    <motion.div
      className="space-y-6 max-w-7xl mx-auto"
      initial="hidden"
      animate="visible"
      variants={staggerVariants}
    >
      {/* Hero Section */}
      <FlexibleHero
        session={session}
        summary={summary}
        spec={spec}
        stats={stats}
      />

      {/* Dynamic Sections */}
      <div className="space-y-6">
        {sortedSections.map((section, idx) => (
          <FlexibleSectionRenderer
            key={idx}
            section={section}
            session={session}
            spec={spec}
          />
        ))}
      </div>

      {/* AI Metadata Badge */}
      <AIMetadataBadge summary={summary} />
    </motion.div>
  );
}

/**
 * Hero section - chooses variant based on emphasis
 */
function FlexibleHero({
  session,
  summary,
  spec,
  stats,
}: {
  session: Session;
  summary: FlexibleSessionSummary;
  spec: CanvasSpec;
  stats: any;
}) {
  const { generationMetadata } = summary;

  // Celebration hero for achievement-focused sessions
  if (generationMetadata.emphasis === 'achievement-focused') {
    const achievementSection = summary.sections.find(s => s.type === 'achievements');
    if (achievementSection && 'achievements' in achievementSection.data) {
      const firstAchievement = achievementSection.data.achievements[0];
      if (firstAchievement) {
        return (
          <HeroCelebration
            title={session.name}
            achievement={firstAchievement.title}
            confetti={spec.theme.mood === 'celebratory'}
            theme={{
              primary: spec.theme.primary,
              secondary: spec.theme.secondary,
              mode: 'light',
              primaryColor: spec.theme.primary,
            }}
          />
        );
      }
    }
  }

  // Split hero for story/journey sessions
  if (generationMetadata.emphasis === 'journey-focused' || generationMetadata.emphasis === 'learning-focused') {
    return (
      <HeroSplit
        title={session.name}
        narrative={summary.narrative}
        stats={stats}
        theme={{
          primary: spec.theme.primary,
          secondary: spec.theme.secondary,
        }}
        featuredImage={session.screenshots?.[0]?.attachmentId}
      />
    );
  }

  // Default: Timeline hero
  return (
    <HeroTimeline
      title={session.name}
      narrative={summary.narrative}
      stats={stats}
      theme={{
        primary: spec.theme.primary,
        secondary: spec.theme.secondary,
      }}
    />
  );
}

/**
 * Dynamic section renderer - routes to appropriate component
 */
function FlexibleSectionRenderer({
  section,
  session,
  spec,
}: {
  section: SummarySection;
  session: Session;
  spec: CanvasSpec;
}) {
  return (
    <motion.div variants={fadeInVariants}>
      <SectionContainer
        title={section.title}
        icon={section.icon}
        colorTheme={section.colorTheme}
        emphasis={section.emphasis}
      >
        <SectionContentRenderer section={section} session={session} spec={spec} />
      </SectionContainer>
    </motion.div>
  );
}

/**
 * Section container with header
 */
function SectionContainer({
  title,
  icon,
  colorTheme,
  emphasis,
  children,
}: {
  title: string;
  icon?: string;
  colorTheme?: string;
  emphasis: 'low' | 'medium' | 'high';
  children: React.ReactNode;
}) {
  const gradients = {
    success: 'from-green-500 to-emerald-500',
    warning: 'from-amber-500 to-orange-500',
    info: 'from-cyan-500 to-blue-500',
    error: 'from-red-500 to-rose-500',
    neutral: 'from-gray-500 to-slate-500',
    creative: 'from-purple-500 to-pink-500',
  };

  const gradient = colorTheme ? gradients[colorTheme as keyof typeof gradients] : gradients.neutral;
  const sizeClass = emphasis === 'high' ? 'p-8' : emphasis === 'medium' ? 'p-6' : 'p-4';

  return (
    <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} ${sizeClass} shadow-xl`}>
      <div className="flex items-center gap-3 mb-6">
        {icon && (
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xl`}>
            {icon}
          </div>
        )}
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

/**
 * Section content renderer - handles different section data structures
 */
function SectionContentRenderer({
  section,
  session,
  spec,
}: {
  section: SummarySection;
  session: Session;
  spec: CanvasSpec;
}) {
  // This is a simplified renderer - in production you'd import the appropriate card components
  // For now, we'll render generic content

  if (section.type === 'achievements' && 'achievements' in section.data) {
    return (
      <div className="space-y-3">
        {section.data.achievements.map((achievement: any, idx: number) => (
          <div key={idx} className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 border-green-500`}>
            <div className="font-semibold text-gray-900">{achievement.title}</div>
            {achievement.timestamp && (
              <div className="text-xs text-gray-500 mt-1">
                {new Date(achievement.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'breakthrough-moments' && 'moments' in section.data) {
    return (
      <div className="space-y-3">
        {section.data.moments.map((moment: any, idx: number) => (
          <BreakthroughCard
            key={idx}
            moment={moment.title || moment.description}
            beforeState={moment.context}
            impact="medium"
            timestamp={moment.timestamp}
          />
        ))}
      </div>
    );
  }

  if (section.type === 'problem-solving-journey' && 'approach' in section.data) {
    return (
      <ProblemSolvingCard
        problem={section.data.problem}
        approach={section.data.approach}
        resolution={section.data.resolution}
      />
    );
  }

  if (section.type === 'learning-highlights' && 'learnings' in section.data) {
    return (
      <div className="space-y-3">
        {section.data.learnings.map((learning: any, idx: number) => (
          <LearningCard
            key={idx}
            discovery={learning.insight || learning.topic}
            context={learning.topic !== learning.insight ? learning.topic : undefined}
            timestamp={learning.timestamp}
          />
        ))}
      </div>
    );
  }

  if (section.type === 'technical-discoveries' && 'discoveries' in section.data) {
    return (
      <div className="space-y-3">
        {section.data.discoveries.map((discovery: any, idx: number) => (
          <TechnicalDiscoveryCard
            key={idx}
            title={discovery.title}
            technology={discovery.technology}
            finding={discovery.finding}
            timestamp={discovery.timestamp}
          />
        ))}
      </div>
    );
  }

  if (section.type === 'recommended-tasks' && 'tasks' in section.data) {
    const priorityColors = {
      urgent: { border: 'border-red-500', bg: 'bg-red-100', text: 'text-red-700' },
      high: { border: 'border-orange-500', bg: 'bg-orange-100', text: 'text-orange-700' },
      medium: { border: 'border-yellow-500', bg: 'bg-yellow-100', text: 'text-yellow-700' },
      low: { border: 'border-gray-500', bg: 'bg-gray-100', text: 'text-gray-700' },
    };

    return (
      <div className="space-y-3">
        {section.data.tasks.map((task: any, idx: number) => {
          const colors = priorityColors[task.priority as keyof typeof priorityColors];
          return (
            <div
              key={idx}
              className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 ${colors.border}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="font-semibold text-gray-900">{task.title}</div>
                <span className={`px-2 py-1 ${colors.bg} ${colors.text} text-xs font-medium rounded-full uppercase flex-shrink-0`}>
                  {task.priority}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-2">{task.context}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {task.estimatedDuration && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    ~{task.estimatedDuration} min
                  </span>
                )}
                {task.category && (
                  <span className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                    {task.category}
                  </span>
                )}
                {task.relatedScreenshotIds && task.relatedScreenshotIds.length > 0 && (
                  <span className="text-xs text-gray-500">
                    📎 {task.relatedScreenshotIds.length} screenshot{task.relatedScreenshotIds.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (section.type === 'flow-states' && 'flowPeriods' in section.data) {
    return (
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {section.data.totalFlowTime} minutes
              </div>
              <div className="text-sm text-gray-600">Total Flow Time</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-600">
                {section.data.flowPercentage}%
              </div>
              <div className="text-sm text-gray-600">of Session</div>
            </div>
          </div>
        </div>

        {/* Flow Periods */}
        <div className="space-y-3">
          {section.data.flowPeriods.map((period: any, idx: number) => (
            <FlowStateCard
              key={idx}
              activity={period.activity}
              duration={period.duration}
              focusScore={period.quality === 'deep' ? 90 : period.quality === 'moderate' ? 70 : 50}
            />
          ))}
        </div>
      </div>
    );
  }

  if (section.type === 'blockers' && 'blockers' in section.data) {
    const getStatusBadge = (status: string) => {
      const badges = {
        unresolved: { text: 'Unresolved', color: 'bg-red-100 text-red-700 border-red-200' },
        resolved: { text: 'Resolved', color: 'bg-green-100 text-green-700 border-green-200' },
        workaround: { text: 'Workaround', color: 'bg-amber-100 text-amber-700 border-amber-200' },
      };
      const badge = badges[status as keyof typeof badges] || badges.unresolved;
      return (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${badge.color}`}>
          {badge.text}
        </span>
      );
    };

    return (
      <div className="space-y-3">
        {section.data.blockers.map((blocker: any, idx: number) => (
          <div
            key={idx}
            className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 border-red-500 ${
              blocker.status === 'resolved' ? 'bg-red-50' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="font-semibold text-gray-900">{blocker.title}</div>
              {getStatusBadge(blocker.status)}
            </div>

            <p className="text-sm text-gray-700 mb-2">{blocker.description}</p>

            {blocker.timestamp && (
              <div className="text-xs text-gray-500">
                {new Date(blocker.timestamp).toLocaleString()}
              </div>
            )}

            {blocker.status === 'resolved' && blocker.resolution && (
              <div className="mt-3 pt-3 border-t border-red-200">
                <div className="flex items-start gap-2">
                  <span className="text-green-600 font-semibold text-sm">✓ Resolution:</span>
                  <p className="text-sm text-gray-700 flex-1">{blocker.resolution}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'key-insights' && 'insights' in section.data) {
    const categoryColors = {
      pattern: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-500', icon: '🔍' },
      trend: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500', icon: '📈' },
      risk: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500', icon: '⚠️' },
      opportunity: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-500', icon: '💡' },
      observation: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-500', icon: '👁️' },
    };

    return (
      <div className="space-y-3">
        {section.data.insights.map((insight: any, idx: number) => {
          const colors = categoryColors[insight.category as keyof typeof categoryColors] || categoryColors.observation;
          return (
            <div
              key={idx}
              className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 ${colors.border}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{colors.icon}</span>
                  <div className="font-semibold text-gray-900">{insight.insight}</div>
                </div>
                <span className={`px-2 py-1 ${colors.bg} ${colors.text} text-xs font-medium rounded-full uppercase flex-shrink-0`}>
                  {insight.category}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-2">{insight.context}</p>
              {insight.relatedScreenshotIds && insight.relatedScreenshotIds.length > 0 && (
                <span className="text-xs text-gray-500">
                  📎 {insight.relatedScreenshotIds.length} screenshot{insight.relatedScreenshotIds.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (section.type === 'timeline' && 'events' in section.data) {
    const events = section.data.events as Array<{
      time: string;
      title: string;
      description: string;
      type: 'start' | 'milestone' | 'blocker' | 'breakthrough' | 'end';
      screenshotIds?: string[];
    }>;

    return (
      <div className="space-y-4">
        <div className="relative border-l-2 border-gray-300 ml-4 pl-6 space-y-6">
          {events.map((event, idx: number) => (
            <div key={idx} className="relative">
              {/* Timeline dot */}
              <div className="absolute -left-[1.875rem] top-2 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow" />

              {/* Event card */}
              <div className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="font-semibold text-gray-900">{event.title}</div>
                  <div className="text-xs text-gray-500 flex-shrink-0">
                    {new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <p className="text-sm text-gray-700">{event.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section.type === 'focus-areas' && 'areas' in section.data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {section.data.areas.map((area: any, idx: number) => (
          <FocusAreaCard
            key={idx}
            name={area.name}
            timeSpent={area.timeSpent}
            tasks={area.tasks}
          />
        ))}
      </div>
    );
  }

  if (section.type === 'emotional-journey' && 'journey' in section.data) {
    const journey = section.data.journey as Array<{
      timestamp: string;
      emotion: string;
      description: string;
      context: string;
    }>;

    const validEmotions = ['frustrated', 'confused', 'focused', 'excited', 'satisfied', 'neutral'] as const;
    const isValidEmotion = (emotion: string): emotion is typeof validEmotions[number] => {
      return validEmotions.includes(emotion as any);
    };

    return (
      <div className="space-y-3">
        {journey.map((phase, idx: number) => (
          <EmotionalJourneyCard
            key={idx}
            emotion={isValidEmotion(phase.emotion) ? phase.emotion : 'neutral'}
            context={phase.context}
            startTime={phase.timestamp}
          />
        ))}
      </div>
    );
  }

  if (section.type === 'creative-solutions' && 'solutions' in section.data) {
    return (
      <div className="space-y-3">
        {section.data.solutions.map((solution: any, idx: number) => (
          <CreativeSolutionCard
            key={idx}
            title={solution.title}
            description={solution.description}
            approach={solution.approach}
            outcome={solution.outcome}
            timestamp={solution.timestamp}
          />
        ))}
      </div>
    );
  }

  if (section.type === 'collaboration-wins' && 'collaborations' in section.data) {
    const collaborations = section.data.collaborations as Array<{
      title: string;
      description: string;
      participants?: string[];
      timestamp?: string;
      outcome?: string;
    }>;

    return (
      <div className="space-y-3">
        {collaborations.map((collab, idx: number) => (
          <CollaborationCard
            key={idx}
            title={collab.title}
            description={collab.description}
            participants={collab.participants}
            timestamp={collab.timestamp}
          />
        ))}
      </div>
    );
  }

  if (section.type === 'related-context') {
    return <RelatedContextSectionRenderer section={section as RelatedContextSection} />;
  }

  // Generic fallback for other section types
  return (
    <div className="text-sm text-gray-700">
      <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded">
        {JSON.stringify(section.data, null, 2)}
      </pre>
    </div>
  );
}

/**
 * AI metadata badge showing reasoning and confidence
 */
function AIMetadataBadge({ summary }: { summary: FlexibleSessionSummary }) {
  const { generationMetadata } = summary;

  return (
    <motion.div
      className="text-center py-4"
      variants={fadeInVariants}
    >
      <div className="inline-flex flex-col items-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          ✨ <strong>AI-Designed Canvas</strong>
          <span className="text-xs font-normal text-gray-600">
            ({Math.round(generationMetadata.confidence * 100)}% confident)
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
            {generationMetadata.detectedSessionType}
          </span>
          <span>{generationMetadata.primaryTheme}</span>
        </div>

        <details className="mt-2 text-xs text-gray-600 max-w-2xl">
          <summary className="cursor-pointer hover:text-gray-800">AI Reasoning</summary>
          <p className="mt-2 text-left p-3 bg-white/50 rounded">
            {generationMetadata.reasoning}
          </p>
        </details>
      </div>
    </motion.div>
  );
}

/**
 * Version Diff Module Component
 *
 * A version diff viewer for the AI Canvas system.
 * Displays differences between two versions of content with support for AI vs User edits.
 *
 * Features:
 * - Side-by-side and unified diff views
 * - AI vs User edit distinction
 * - Syntax highlighting support
 * - Line numbers
 * - Statistics (lines added/removed)
 * - Expand/collapse functionality
 * - Responsive design
 * - Loading and error states
 * - Smooth animations with Framer Motion
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Clock,
  User,
  Bot,
  Plus,
  Minus,
  Loader2,
  AlertCircle,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  FileCode,
  Sparkles,
} from 'lucide-react';
import { Card } from '../../Card';
import { Badge } from '../../Badge';
import { getRadiusClass, getGlassClasses, getSuccessGradient, getDangerGradient, getInfoGradient, getWarningGradient } from '../../../design-system/theme';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type DiffVariant = 'side-by-side' | 'unified' | 'compact';

export interface ThemeConfig {
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
}

export interface VersionMeta {
  oldVersionId: string;
  newVersionId: string;
  oldTimestamp: string;
  newTimestamp: string;
  editor: 'ai' | 'user';
  changeDescription?: string;
}

export interface VersionDiffProps {
  oldVersion: string;
  newVersion: string;
  versionMeta: VersionMeta;
  variant?: DiffVariant;
  theme?: ThemeConfig;
  showLineNumbers?: boolean;
  showStats?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onVersionClick?: (versionId: string) => void;
}

// ============================================================================
// CONSTANTS & CONFIGS
// ============================================================================

// Initialize gradient helpers
const successGradient = getSuccessGradient();
const infoGradient = getInfoGradient();
const dangerGradient = getDangerGradient();
const warningGradient = getWarningGradient();

// Editor type configurations
const EDITOR_CONFIG = {
  ai: {
    icon: Bot,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    accentColor: 'blue',
    label: 'AI Generated',
    badgeVariant: 'info' as const,
    iconBg: 'bg-blue-100',
    glowColor: 'shadow-blue-200',
  },
  user: {
    icon: User,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    accentColor: 'green',
    label: 'User Edited',
    badgeVariant: 'success' as const,
    iconBg: 'bg-green-100',
    glowColor: 'shadow-green-200',
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2 },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFullTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

interface DiffLine {
  type: 'addition' | 'deletion' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

function calculateDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff: DiffLine[] = [];

  let oldIndex = 0;
  let newIndex = 0;

  // Simple line-by-line diff (in production, use a proper diff library like diff-match-patch)
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];

    if (oldLine === newLine) {
      // Context line (unchanged)
      diff.push({
        type: 'context',
        content: oldLine || '',
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1,
      });
      oldIndex++;
      newIndex++;
    } else if (newIndex >= newLines.length) {
      // Deletion (old line removed)
      diff.push({
        type: 'deletion',
        content: oldLine || '',
        oldLineNumber: oldIndex + 1,
      });
      oldIndex++;
    } else if (oldIndex >= oldLines.length) {
      // Addition (new line added)
      diff.push({
        type: 'addition',
        content: newLine || '',
        newLineNumber: newIndex + 1,
      });
      newIndex++;
    } else {
      // Check if next lines match (to detect insertions/deletions)
      const nextOldMatchesNew = oldLines[oldIndex + 1] === newLine;
      const nextNewMatchesOld = newLines[newIndex + 1] === oldLine;

      if (nextOldMatchesNew && !nextNewMatchesOld) {
        // Deletion
        diff.push({
          type: 'deletion',
          content: oldLine || '',
          oldLineNumber: oldIndex + 1,
        });
        oldIndex++;
      } else if (nextNewMatchesOld && !nextOldMatchesNew) {
        // Addition
        diff.push({
          type: 'addition',
          content: newLine || '',
          newLineNumber: newIndex + 1,
        });
        newIndex++;
      } else {
        // Modified line (treat as deletion + addition)
        diff.push({
          type: 'deletion',
          content: oldLine || '',
          oldLineNumber: oldIndex + 1,
        });
        diff.push({
          type: 'addition',
          content: newLine || '',
          newLineNumber: newIndex + 1,
        });
        oldIndex++;
        newIndex++;
      }
    }
  }

  return diff;
}

function calculateStats(diffLines: DiffLine[]): { additions: number; deletions: number } {
  return diffLines.reduce(
    (acc, line) => {
      if (line.type === 'addition') acc.additions++;
      if (line.type === 'deletion') acc.deletions++;
      return acc;
    },
    { additions: 0, deletions: 0 }
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Change Stats Component
 */
function ChangeStats({
  additions,
  deletions,
  compact,
}: {
  additions: number;
  deletions: number;
  compact?: boolean;
}) {
  const total = additions + deletions;
  const addedPercent = total > 0 ? (additions / total) * 100 : 0;
  const successGradient = getSuccessGradient();
  const dangerGradient = getDangerGradient();

  return (
    <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <div className={`flex items-center gap-1 ${successGradient.iconColor}`}>
        <Plus className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
        <span className="font-medium">{additions}</span>
      </div>
      <div className={`flex items-center gap-1 ${dangerGradient.iconColor}`}>
        <Minus className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
        <span className="font-medium">{deletions}</span>
      </div>
      {!compact && (
        <div className={`flex-1 ml-2 h-2 ${getGlassClasses('medium')} ${getRadiusClass('pill')} overflow-hidden min-w-[60px] max-w-[100px]`}>
          <div
            className={`h-full ${successGradient.iconBg}`}
            style={{ width: `${addedPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Version Header Component
 */
function VersionHeader({
  versionMeta,
  stats,
  onVersionClick,
}: {
  versionMeta: VersionMeta;
  stats: { additions: number; deletions: number };
  onVersionClick?: (versionId: string) => void;
}) {
  const editorConfig = EDITOR_CONFIG[versionMeta.editor];
  const EditorIcon = editorConfig.icon;

  return (
    <Card variant="flat" className={`border-l-4 ${editorConfig.borderColor} ${editorConfig.bgColor}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className={`${editorConfig.iconBg} p-2 ${getRadiusClass('card')}`}>
              <EditorIcon className={`w-5 h-5 ${editorConfig.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-gray-900">Version Comparison</h3>
                <Badge variant={editorConfig.badgeVariant} size="sm">
                  {editorConfig.label}
                </Badge>
              </div>
              {versionMeta.changeDescription && (
                <p className="text-sm text-gray-700 mt-1">{versionMeta.changeDescription}</p>
              )}
            </div>
          </div>
          <ChangeStats additions={stats.additions} deletions={stats.deletions} />
        </div>

        <div className="flex items-center gap-6 text-xs text-gray-600">
          <button
            onClick={() => onVersionClick?.(versionMeta.oldVersionId)}
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            title={formatFullTimestamp(versionMeta.oldTimestamp)}
          >
            <FileText className="w-3 h-3" />
            <span className="font-medium">Old:</span>
            <span className="font-mono">{versionMeta.oldVersionId.substring(0, 8)}</span>
            <Clock className="w-3 h-3 ml-1" />
            <span>{formatTimestamp(versionMeta.oldTimestamp)}</span>
          </button>

          <button
            onClick={() => onVersionClick?.(versionMeta.newVersionId)}
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            title={formatFullTimestamp(versionMeta.newTimestamp)}
          >
            <FileCode className="w-3 h-3" />
            <span className="font-medium">New:</span>
            <span className="font-mono">{versionMeta.newVersionId.substring(0, 8)}</span>
            <Clock className="w-3 h-3 ml-1" />
            <span>{formatTimestamp(versionMeta.newTimestamp)}</span>
          </button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Unified Diff View
 */
function UnifiedDiffView({
  diffLines,
  showLineNumbers,
}: {
  diffLines: DiffLine[];
  showLineNumbers: boolean;
}) {
  return (
    <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} overflow-hidden`}>
      <div className="overflow-x-auto">
        <div className="text-xs font-mono">
          {diffLines.map((line, index) => {
            const successGradient = getSuccessGradient();
            const dangerGradient = getDangerGradient();
            let bgColor = 'bg-gray-900';
            let textColor = 'text-gray-300';
            let lineNumberColor = 'text-gray-600';

            if (line.type === 'addition') {
              bgColor = `${successGradient.container}`;
              textColor = successGradient.textPrimary;
              lineNumberColor = 'text-green-700';
            } else if (line.type === 'deletion') {
              bgColor = `${dangerGradient.container}`;
              textColor = dangerGradient.textPrimary;
              lineNumberColor = 'text-red-700';
            }

            const prefix = line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';

            return (
              <div
                key={index}
                className={`flex ${bgColor} ${textColor} hover:brightness-95 transition-all`}
              >
                {showLineNumbers && (
                  <>
                    <span className={`flex-shrink-0 w-12 ${lineNumberColor} text-right pr-2 select-none border-r border-gray-700`}>
                      {line.oldLineNumber || ''}
                    </span>
                    <span className={`flex-shrink-0 w-12 ${lineNumberColor} text-right pr-2 select-none border-r border-gray-700`}>
                      {line.newLineNumber || ''}
                    </span>
                  </>
                )}
                <span className="flex-shrink-0 w-6 text-center select-none text-gray-500">
                  {prefix}
                </span>
                <span className="flex-1 px-3 py-0.5 whitespace-pre">
                  {line.content || ' '}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Side-by-Side Diff View
 */
function SideBySideDiffView({
  diffLines,
  showLineNumbers,
}: {
  diffLines: DiffLine[];
  showLineNumbers: boolean;
}) {
  // Group consecutive additions and deletions together
  const groupedLines: Array<{ old: DiffLine | null; new: DiffLine | null }> = [];

  for (const line of diffLines) {
    if (line.type === 'context') {
      groupedLines.push({ old: line, new: line });
    } else if (line.type === 'deletion') {
      groupedLines.push({ old: line, new: null });
    } else if (line.type === 'addition') {
      // Try to pair with previous deletion
      const lastGroup = groupedLines[groupedLines.length - 1];
      if (lastGroup && lastGroup.old && lastGroup.old.type === 'deletion' && !lastGroup.new) {
        lastGroup.new = line;
      } else {
        groupedLines.push({ old: null, new: line });
      }
    }
  }

  const successGradient = getSuccessGradient();
  const dangerGradient = getDangerGradient();

  return (
    <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} overflow-hidden`}>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-2 gap-px bg-gray-700">
          {/* Header */}
          <div className="bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-300 flex items-center gap-2">
            <Minus className="w-3 h-3" />
            Old Version
          </div>
          <div className="bg-green-900/20 px-3 py-2 text-xs font-semibold text-green-300 flex items-center gap-2">
            <Plus className="w-3 h-3" />
            New Version
          </div>

          {/* Content */}
          {groupedLines.map((group, index) => (
            <>
              {/* Old side */}
              <div
                key={`old-${index}`}
                className={`flex text-xs font-mono ${
                  group.old?.type === 'deletion'
                    ? `${dangerGradient.container} ${dangerGradient.textPrimary}`
                    : 'bg-gray-900 text-gray-300'
                }`}
              >
                {showLineNumbers && (
                  <span className="flex-shrink-0 w-12 text-gray-600 text-right pr-2 select-none border-r border-gray-700">
                    {group.old?.oldLineNumber || ''}
                  </span>
                )}
                <span className="flex-1 px-3 py-0.5 whitespace-pre">
                  {group.old?.content || ' '}
                </span>
              </div>

              {/* New side */}
              <div
                key={`new-${index}`}
                className={`flex text-xs font-mono ${
                  group.new?.type === 'addition'
                    ? `${successGradient.container} ${successGradient.textPrimary}`
                    : 'bg-gray-900 text-gray-300'
                }`}
              >
                {showLineNumbers && (
                  <span className="flex-shrink-0 w-12 text-gray-600 text-right pr-2 select-none border-r border-gray-700">
                    {group.new?.newLineNumber || ''}
                  </span>
                )}
                <span className="flex-1 px-3 py-0.5 whitespace-pre">
                  {group.new?.content || ' '}
                </span>
              </div>
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Diff View
 */
function CompactDiffView({
  diffLines,
  stats,
}: {
  diffLines: DiffLine[];
  stats: { additions: number; deletions: number };
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const previewLines = 5;
  const displayLines = isExpanded ? diffLines : diffLines.slice(0, previewLines);
  const hasMore = diffLines.length > previewLines;

  return (
    <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} overflow-hidden`}>
      {/* Compact header */}
      <div
        className="flex items-center justify-between p-3 bg-gray-800 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
          <FileCode className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">
            {diffLines.length} lines changed
          </span>
        </div>
        <ChangeStats additions={stats.additions} deletions={stats.deletions} compact />
      </div>

      {/* Diff content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="text-xs font-mono">
              {displayLines.map((line, index) => {
                const successGradient = getSuccessGradient();
                const dangerGradient = getDangerGradient();
                let bgColor = 'bg-gray-900';
                let textColor = 'text-gray-300';

                if (line.type === 'addition') {
                  bgColor = `${successGradient.container}`;
                  textColor = successGradient.textPrimary;
                } else if (line.type === 'deletion') {
                  bgColor = `${dangerGradient.container}`;
                  textColor = dangerGradient.textPrimary;
                }

                const prefix = line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';

                return (
                  <div key={index} className={`flex ${bgColor} ${textColor}`}>
                    <span className="flex-shrink-0 w-6 text-center select-none text-gray-500">
                      {prefix}
                    </span>
                    <span className="flex-1 px-3 py-0.5 whitespace-pre">
                      {line.content || ' '}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Show more indicator */}
      {!isExpanded && hasMore && (
        <div className="text-gray-500 px-3 py-2 text-xs text-center border-t border-gray-700 bg-gray-800">
          ... {diffLines.length - previewLines} more lines
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * VersionDiffModule - Main component for displaying version diffs
 */
export function VersionDiffModule({
  oldVersion,
  newVersion,
  versionMeta,
  variant = 'unified',
  theme,
  showLineNumbers = true,
  showStats = true,
  isLoading = false,
  error = null,
  onVersionClick,
}: VersionDiffProps) {
  // Calculate diff
  const diffLines = useMemo(() => {
    return calculateDiff(oldVersion, newVersion);
  }, [oldVersion, newVersion]);

  // Calculate stats
  const stats = useMemo(() => {
    return calculateStats(diffLines);
  }, [diffLines]);

  // Loading state
  if (isLoading) {
    const infoGradient = getInfoGradient();
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className={`w-8 h-8 ${infoGradient.iconColor}`} />
        </motion.div>
      </div>
    );
  }

  // Error state
  if (error) {
    const dangerGradient = getDangerGradient();
    return (
      <Card variant="flat" className="p-6">
        <div className={`flex items-center gap-3 ${dangerGradient.iconColor}`}>
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className={`font-semibold ${dangerGradient.textPrimary}`}>Error loading version diff</p>
            <p className={`text-sm ${dangerGradient.textSecondary}`}>{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  // Empty state (no changes)
  if (diffLines.length === 0 || (stats.additions === 0 && stats.deletions === 0)) {
    return (
      <Card variant="flat" className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <FileCode className="w-12 h-12 text-gray-300 mb-4" />
          </motion.div>
          <h3 className="text-lg font-semibold text-gray-600 mb-1">
            No changes detected
          </h3>
          <p className="text-sm text-gray-400">
            Both versions are identical
          </p>
        </div>
      </Card>
    );
  }

  // Render based on variant
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Version Header */}
      {showStats && (
        <VersionHeader
          versionMeta={versionMeta}
          stats={stats}
          onVersionClick={onVersionClick}
        />
      )}

      {/* Diff View */}
      <motion.div variants={itemVariants}>
        {variant === 'side-by-side' && (
          <SideBySideDiffView diffLines={diffLines} showLineNumbers={showLineNumbers} />
        )}
        {variant === 'unified' && (
          <UnifiedDiffView diffLines={diffLines} showLineNumbers={showLineNumbers} />
        )}
        {variant === 'compact' && (
          <CompactDiffView diffLines={diffLines} stats={stats} />
        )}
      </motion.div>
    </motion.div>
  );
}

export default VersionDiffModule;

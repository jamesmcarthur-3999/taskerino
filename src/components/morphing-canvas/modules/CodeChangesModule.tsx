/**
 * Code Changes Module Component
 *
 * A flexible code changes/diffs display module for the Morphing Canvas system.
 * Supports multiple variants: list, detailed, compact.
 *
 * Features:
 * - Multiple view variants (list, detailed, compact)
 * - File changes with additions/deletions
 * - Syntax highlighting support
 * - Change type indicators (added, modified, deleted, renamed)
 * - File path navigation
 * - Responsive design
 * - Loading, empty, and error states
 * - Smooth animations with Framer Motion
 * - Git-style diff viewing
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  File,
  FileText,
  FilePlus,
  FileMinus,
  FileEdit,
  GitBranch,
  GitCommit,
  GitPullRequest,
  ChevronRight,
  ChevronDown,
  Code,
  Clock,
  User,
  Hash,
  Plus,
  Minus,
  Loader2,
  AlertCircle,
  FolderGit2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
// Removed unused ModuleProps import
import { Card } from '../../Card';
import { Badge } from '../../Badge';
import { getRadiusClass, getGlassClasses, getSuccessGradient, getDangerGradient, getInfoGradient, getWarningGradient } from '../../../design-system/theme';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type CodeChangesVariant = 'list' | 'detailed' | 'compact';

export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

export interface CodeChange {
  id: string;
  filePath: string;
  fileName: string;
  changeType: ChangeType;
  linesAdded: number;
  linesDeleted: number;
  language?: string;
  diff?: string;
  oldPath?: string; // For renamed files
  timestamp?: string;
  author?: string;
  commitHash?: string;
  commitMessage?: string;
  isExpanded?: boolean;
}

export interface CodeChangesData {
  changes: CodeChange[];
  sessionId?: string;
  sessionName?: string;
  totalFiles?: number;
  totalAdditions?: number;
  totalDeletions?: number;
  branch?: string;
  lastCommit?: {
    hash: string;
    message: string;
    author: string;
    timestamp: string;
  };
}

export interface CodeChangesConfig {
  showDiff?: boolean;
  showLineNumbers?: boolean;
  showAuthor?: boolean;
  showTimestamp?: boolean;
  groupByChangeType?: boolean;
  highlightSyntax?: boolean;
  expandByDefault?: boolean;
  maxDiffLines?: number;
  showFileIcons?: boolean;
  showStats?: boolean;
}

export interface CodeChangesModuleProps {
  data: CodeChangesData;
  variant?: CodeChangesVariant;
  config?: CodeChangesConfig;
  onFileClick?: (change: CodeChange) => void;
  onCommitClick?: (hash: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

// ============================================================================
// CONSTANTS & CONFIGS
// ============================================================================

// Initialize gradient helpers
const successGradient = getSuccessGradient();
const infoGradient = getInfoGradient();
const dangerGradient = getDangerGradient();
const warningGradient = getWarningGradient();

const CHANGE_TYPE_CONFIG = {
  added: {
    icon: FilePlus,
    color: successGradient.iconColor,
    bgColor: successGradient.iconBg,
    borderColor: 'border-green-200',
    label: 'Added',
    badgeVariant: 'success' as const,
  },
  modified: {
    icon: FileEdit,
    color: infoGradient.iconColor,
    bgColor: infoGradient.iconBg,
    borderColor: 'border-blue-200',
    label: 'Modified',
    badgeVariant: 'info' as const,
  },
  deleted: {
    icon: FileMinus,
    color: dangerGradient.iconColor,
    bgColor: dangerGradient.iconBg,
    borderColor: 'border-red-200',
    label: 'Deleted',
    badgeVariant: 'danger' as const,
  },
  renamed: {
    icon: FileText,
    color: warningGradient.iconColor,
    bgColor: warningGradient.iconBg,
    borderColor: 'border-orange-200',
    label: 'Renamed',
    badgeVariant: 'warning' as const,
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
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    x: -20,
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

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function getFileIcon(filePath: string): typeof File {
  const ext = getFileExtension(filePath).toLowerCase();

  // Map extensions to icons (simplified)
  const iconMap: Record<string, typeof File> = {
    js: Code,
    ts: Code,
    jsx: Code,
    tsx: Code,
    py: Code,
    java: Code,
    go: Code,
    rs: Code,
    md: FileText,
    txt: FileText,
  };

  return iconMap[ext] || File;
}

function parseDiffLine(line: string): { type: 'addition' | 'deletion' | 'context'; content: string } {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return { type: 'addition', content: line.substring(1) };
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return { type: 'deletion', content: line.substring(1) };
  }
  return { type: 'context', content: line };
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Diff Viewer Component
 */
function DiffViewer({
  diff,
  maxLines,
  showLineNumbers,
}: {
  diff: string;
  maxLines?: number;
  showLineNumbers?: boolean;
}) {
  const lines = useMemo(() => {
    const allLines = diff.split('\n');
    return maxLines ? allLines.slice(0, maxLines) : allLines;
  }, [diff, maxLines]);

  const isTruncated = maxLines && diff.split('\n').length > maxLines;

  return (
    <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} overflow-hidden`}>
      <div className="overflow-x-auto">
        <div className="text-xs font-mono">
          {lines.map((line, index) => {
            const parsed = parseDiffLine(line);
            const successGradient = getSuccessGradient();
            const dangerGradient = getDangerGradient();
            let bgColor = 'bg-gray-900';
            let textColor = 'text-gray-300';

            if (parsed.type === 'addition') {
              bgColor = `${successGradient.container}`;
              textColor = successGradient.textPrimary;
            } else if (parsed.type === 'deletion') {
              bgColor = `${dangerGradient.container}`;
              textColor = dangerGradient.textPrimary;
            }

            return (
              <div
                key={index}
                className={`flex ${bgColor} ${textColor}`}
              >
                {showLineNumbers && (
                  <span className="flex-shrink-0 w-12 text-gray-600 text-right pr-3 select-none">
                    {index + 1}
                  </span>
                )}
                <span className="flex-1 px-3 py-0.5 whitespace-pre">
                  {parsed.content || ' '}
                </span>
              </div>
            );
          })}
          {isTruncated && (
            <div className="text-gray-500 px-3 py-2 text-center border-t border-gray-700">
              ... {diff.split('\n').length - maxLines!} more lines
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Change Stats Component
 */
function ChangeStats({
  linesAdded,
  linesDeleted,
  compact,
}: {
  linesAdded: number;
  linesDeleted: number;
  compact?: boolean;
}) {
  const total = linesAdded + linesDeleted;
  const addedPercent = total > 0 ? (linesAdded / total) * 100 : 0;
  const successGradient = getSuccessGradient();
  const dangerGradient = getDangerGradient();

  return (
    <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <div className={`flex items-center gap-1 ${successGradient.iconColor}`}>
        <Plus className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
        <span className="font-medium">{linesAdded}</span>
      </div>
      <div className={`flex items-center gap-1 ${dangerGradient.iconColor}`}>
        <Minus className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
        <span className="font-medium">{linesDeleted}</span>
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
 * Detailed Change Item - Full view with diff
 */
function DetailedChangeItem({
  change,
  config,
  onClick,
}: {
  change: CodeChange;
  config: CodeChangesConfig;
  onClick: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(config.expandByDefault || change.isExpanded);
  const typeConfig = CHANGE_TYPE_CONFIG[change.changeType];
  const Icon = typeConfig.icon;
  const FileIcon = getFileIcon(change.filePath);

  return (
    <motion.div variants={itemVariants}>
      <Card variant="flat" className="overflow-hidden">
        {/* Header */}
        <div
          className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors ${typeConfig.bgColor} border-l-4 ${typeConfig.borderColor}`}
          onClick={() => {
            setIsExpanded(!isExpanded);
            onClick();
          }}
        >
          {/* Change Type Icon */}
          <div className={`flex-shrink-0 ${typeConfig.color}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <h4 className="text-sm font-bold text-gray-900 truncate">
                    {change.fileName}
                  </h4>
                  <Badge variant={typeConfig.badgeVariant} size="sm">
                    {typeConfig.label}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 font-mono truncate">
                  {change.filePath}
                </p>
                {change.changeType === 'renamed' && change.oldPath && (
                  <p className="text-xs text-gray-500 font-mono truncate mt-1">
                    <span className="text-gray-400">from:</span> {change.oldPath}
                  </p>
                )}
              </div>

              {/* Expand/Collapse Icon */}
              <ChevronDown
                className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 flex-wrap">
              <ChangeStats
                linesAdded={change.linesAdded}
                linesDeleted={change.linesDeleted}
              />

              {/* Metadata */}
              {config.showAuthor && change.author && (
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <User className="w-3 h-3" />
                  {change.author}
                </div>
              )}
              {config.showTimestamp && change.timestamp && (
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(change.timestamp)}
                </div>
              )}
              {change.commitHash && (
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Hash className="w-3 h-3" />
                  {change.commitHash.substring(0, 7)}
                </div>
              )}
            </div>

            {/* Commit Message */}
            {change.commitMessage && (
              <p className="text-xs text-gray-600 mt-2 line-clamp-1">
                {change.commitMessage}
              </p>
            )}
          </div>
        </div>

        {/* Diff View */}
        <AnimatePresence>
          {isExpanded && config.showDiff && change.diff && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden border-t border-gray-200"
            >
              <div className="p-4">
                <DiffViewer
                  diff={change.diff}
                  maxLines={config.maxDiffLines}
                  showLineNumbers={config.showLineNumbers}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

/**
 * List Change Item - Standard list view
 */
function ListChangeItem({
  change,
  config,
  onClick,
}: {
  change: CodeChange;
  config: CodeChangesConfig;
  onClick: () => void;
}) {
  const typeConfig = CHANGE_TYPE_CONFIG[change.changeType];
  const Icon = typeConfig.icon;
  const FileIcon = getFileIcon(change.filePath);

  return (
    <motion.div variants={itemVariants}>
      <Card
        variant="interactive"
        hover
        className="cursor-pointer"
        onClick={onClick}
      >
        <div className={`flex items-center gap-3 p-3 border-l-4 ${typeConfig.borderColor}`}>
          {/* Change Type Icon */}
          <div className={`flex-shrink-0 ${typeConfig.color}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FileIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <h4 className="text-sm font-semibold text-gray-900 truncate">
                {change.fileName}
              </h4>
              <Badge variant={typeConfig.badgeVariant} size="sm">
                {typeConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-gray-600 font-mono truncate">
              {change.filePath}
            </p>
          </div>

          {/* Stats */}
          <div className="flex-shrink-0">
            <ChangeStats
              linesAdded={change.linesAdded}
              linesDeleted={change.linesDeleted}
              compact
            />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/**
 * Compact Change Item - Minimal view
 */
function CompactChangeItem({
  change,
  onClick,
}: {
  change: CodeChange;
  onClick: () => void;
}) {
  const typeConfig = CHANGE_TYPE_CONFIG[change.changeType];
  const Icon = typeConfig.icon;
  const successGradient = getSuccessGradient();
  const dangerGradient = getDangerGradient();

  return (
    <motion.div
      variants={itemVariants}
      className={`flex items-center gap-2 px-3 py-2 ${getRadiusClass('card')} hover:bg-gray-50 transition-colors cursor-pointer`}
      onClick={onClick}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${typeConfig.color}`} />
      <span className="text-sm text-gray-800 font-mono truncate flex-1 min-w-0">
        {change.fileName}
      </span>
      <div className="flex items-center gap-1 text-xs flex-shrink-0">
        <span className={successGradient.iconColor}>+{change.linesAdded}</span>
        <span className={dangerGradient.iconColor}>-{change.linesDeleted}</span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// VARIANT RENDERERS
// ============================================================================

/**
 * List Variant - Standard list view
 */
function ListView({
  changes,
  config,
  onFileClick,
}: {
  changes: CodeChange[];
  config: CodeChangesConfig;
  onFileClick: (change: CodeChange) => void;
}) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-2"
    >
      {changes.map((change) => (
        <ListChangeItem
          key={change.id}
          change={change}
          config={config}
          onClick={() => onFileClick(change)}
        />
      ))}
    </motion.div>
  );
}

/**
 * Detailed Variant - Full view with diffs
 */
function DetailedView({
  changes,
  config,
  onFileClick,
}: {
  changes: CodeChange[];
  config: CodeChangesConfig;
  onFileClick: (change: CodeChange) => void;
}) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      {changes.map((change) => (
        <DetailedChangeItem
          key={change.id}
          change={change}
          config={config}
          onClick={() => onFileClick(change)}
        />
      ))}
    </motion.div>
  );
}

/**
 * Compact Variant - Minimal list
 */
function CompactView({
  changes,
  onFileClick,
}: {
  changes: CodeChange[];
  onFileClick: (change: CodeChange) => void;
}) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-1"
    >
      {changes.map((change) => (
        <CompactChangeItem
          key={change.id}
          change={change}
          onClick={() => onFileClick(change)}
        />
      ))}
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * CodeChangesModule - Main component for displaying code changes
 */
export function CodeChangesModule({
  data,
  variant = 'list',
  config = {},
  onFileClick,
  onCommitClick,
  isLoading = false,
  error = null,
}: CodeChangesModuleProps) {
  // Group changes by type if configured
  const groupedChanges = useMemo(() => {
    if (!config.groupByChangeType) {
      return { all: data.changes };
    }

    return data.changes.reduce((acc, change) => {
      if (!acc[change.changeType]) {
        acc[change.changeType] = [];
      }
      acc[change.changeType].push(change);
      return acc;
    }, {} as Record<ChangeType, CodeChange[]>);
  }, [data.changes, config.groupByChangeType]);

  const handleFileClick = useCallback(
    (change: CodeChange) => {
      onFileClick?.(change);
    },
    [onFileClick]
  );

  // Calculate totals
  const totals = useMemo(() => {
    return data.changes.reduce(
      (acc, change) => ({
        additions: acc.additions + change.linesAdded,
        deletions: acc.deletions + change.linesDeleted,
      }),
      { additions: 0, deletions: 0 }
    );
  }, [data.changes]);

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
            <p className={`font-semibold ${dangerGradient.textPrimary}`}>Error loading code changes</p>
            <p className={`text-sm ${dangerGradient.textSecondary}`}>{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  // Empty state
  if (data.changes.length === 0) {
    return (
      <Card variant="flat" className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <FolderGit2 className="w-12 h-12 text-gray-300 mb-4" />
          </motion.div>
          <h3 className="text-lg font-semibold text-gray-600 mb-1">
            No code changes
          </h3>
          <p className="text-sm text-gray-400">
            Code changes will appear here once made
          </p>
        </div>
      </Card>
    );
  }

  // Render based on variant
  return (
    <div className="space-y-4">
      {/* Summary Header */}
      {config.showStats && (
        <Card variant="flat" className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-semibold text-gray-900">
                  {data.changes.length} files changed
                </span>
              </div>
              {data.branch && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <GitBranch className="w-4 h-4" />
                  {data.branch}
                </div>
              )}
            </div>
            <ChangeStats
              linesAdded={totals.additions}
              linesDeleted={totals.deletions}
            />
          </div>

          {/* Last Commit */}
          {data.lastCommit && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-start gap-2">
                <GitCommit className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium line-clamp-1">
                    {data.lastCommit.message}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {data.lastCommit.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(data.lastCommit.timestamp)}
                    </span>
                    <button
                      onClick={() => onCommitClick?.(data.lastCommit!.hash)}
                      className={`flex items-center gap-1 hover:${getInfoGradient().iconColor} transition-colors`}
                    >
                      <Hash className="w-3 h-3" />
                      {data.lastCommit.hash.substring(0, 7)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Changes */}
      {config.groupByChangeType ? (
        <div className="space-y-4">
          {Object.entries(groupedChanges).map(([type, changes]) => {
            const typeConfig = CHANGE_TYPE_CONFIG[type as ChangeType];
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <typeConfig.icon className={`w-4 h-4 ${typeConfig.color}`} />
                  <h3 className="text-sm font-semibold text-gray-700">
                    {typeConfig.label} ({changes.length})
                  </h3>
                </div>
                {variant === 'detailed' && (
                  <DetailedView
                    changes={changes}
                    config={config}
                    onFileClick={handleFileClick}
                  />
                )}
                {variant === 'list' && (
                  <ListView
                    changes={changes}
                    config={config}
                    onFileClick={handleFileClick}
                  />
                )}
                {variant === 'compact' && (
                  <CompactView changes={changes} onFileClick={handleFileClick} />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {variant === 'detailed' && (
            <DetailedView
              changes={data.changes}
              config={config}
              onFileClick={handleFileClick}
            />
          )}
          {variant === 'list' && (
            <ListView
              changes={data.changes}
              config={config}
              onFileClick={handleFileClick}
            />
          )}
          {variant === 'compact' && (
            <CompactView changes={data.changes} onFileClick={handleFileClick} />
          )}
        </>
      )}
    </div>
  );
}

export default CodeChangesModule;

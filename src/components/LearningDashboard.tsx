import { useState } from 'react';
import type { Learning, AppState } from '../types';
import { LearningService } from '../services/learningService';
import { claudeService } from '../services/claudeService';
import { useSettings } from '../context/SettingsContext';
import {
  getGlassClasses,
  getRadiusClass,
  getSuccessGradient,
  getInfoGradient,
  getActivityGradient,
  getGradientClasses,
  MODAL_OVERLAY,
  TRANSITIONS,
  SCALE,
} from '../design-system/theme';

interface LearningDashboardProps {
  onClose: () => void;
}

export function LearningDashboard({ onClose }: LearningDashboardProps) {
  const { state: settingsState, dispatch: settingsDispatch } = useSettings();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'rules' | 'patterns' | 'observations'>('all');
  const [expandedLearningId, setExpandedLearningId] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<{
    reasoning: string;
    applied: boolean;
  } | null>(null);

  const learningService = new LearningService(settingsState.learnings, settingsState.learningSettings);
  const metrics = learningService.analyzeLearningEffectiveness();

  // Categorize learnings
  const rules = settingsState.learnings.learnings.filter(l =>
    l.strength >= settingsState.learningSettings.thresholds.rule && l.status === 'active'
  );
  const patterns = settingsState.learnings.learnings.filter(l =>
    l.strength >= settingsState.learningSettings.thresholds.active &&
    l.strength < settingsState.learningSettings.thresholds.rule &&
    l.status === 'active'
  );
  const observations = settingsState.learnings.learnings.filter(l =>
    l.status === 'experimental' || l.status === 'deprecated'
  );

  const displayedLearnings =
    selectedCategory === 'rules' ? rules :
    selectedCategory === 'patterns' ? patterns :
    selectedCategory === 'observations' ? observations :
    settingsState.learnings.learnings;

  const handleFlagToggle = (learningId: string) => {
    const learning = settingsState.learnings.learnings.find(l => l.id === learningId);
    if (!learning) return;

    if (learning.isFlag) {
      learningService.unflagLearning(learningId);
    } else {
      learningService.flagLearning(learningId);
    }

    settingsDispatch({
      type: 'LOAD_SETTINGS',
      payload: { learnings: learningService.getLearnings() }
    });
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setOptimizationResult(null);

    try {
      const optimizationContext = learningService.getOptimizationContext();
      const result = await claudeService.optimizeLearningParameters(optimizationContext);

      if (result.shouldOptimize && result.suggestedSettings) {
        // Apply AI's suggested settings
        settingsDispatch({
          type: 'UPDATE_LEARNING_SETTINGS',
          payload: result.suggestedSettings
        });

        setOptimizationResult({
          reasoning: result.reasoning,
          applied: true
        });
      } else {
        setOptimizationResult({
          reasoning: result.reasoning,
          applied: false
        });
      }
    } catch (error) {
      setOptimizationResult({
        reasoning: `Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        applied: false
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleExport = () => {
    const profile = learningService.exportProfile();
    const blob = new Blob([profile], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskerino-learning-profile-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = learningService.importProfile(text);
        settingsDispatch({
          type: 'LOAD_SETTINGS',
          payload: { learnings: imported }
        });
        alert('Profile imported successfully!');
      } catch (error) {
        alert('Failed to import profile: ' + (error instanceof Error ? error.message : 'Invalid format'));
      }
    };
    input.click();
  };

  return (
    <div className={`${MODAL_OVERLAY} flex items-center justify-center z-50 p-4`}>
      <div className={`${getGlassClasses('medium')} ${getRadiusClass('modal')} max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-white/30">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Learning System</h2>
            <p className="text-sm text-gray-700 mt-1">
              View and manage what the AI has learned from your corrections
            </p>
          </div>
          <button
            onClick={onClose}
            className={`text-gray-600 hover:text-gray-900 ${TRANSITIONS.fast}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Metrics Bar */}
        <div className={`${getGlassClasses('subtle')} px-6 py-4 border-b-2 border-white/30`}>
          <div className="grid grid-cols-4 gap-4">
            <div className={`p-4 ${getRadiusClass('field')} ${getGlassClasses('medium')}`}>
              <div className="text-xs text-gray-700 mb-1">Total Learnings</div>
              <div className="text-2xl font-bold text-gray-900">{metrics.totalLearnings}</div>
            </div>
            <div className={`p-4 ${getRadiusClass('field')} ${getSuccessGradient('medium').container}`}>
              <div className={`text-xs ${getSuccessGradient('medium').textSecondary} mb-1`}>Accuracy Rate</div>
              <div className={`text-2xl font-bold ${getSuccessGradient('medium').textPrimary}`}>{(metrics.accuracy * 100).toFixed(1)}%</div>
            </div>
            <div className={`p-4 ${getRadiusClass('field')} ${getInfoGradient('medium').container}`}>
              <div className={`text-xs ${getInfoGradient('medium').textSecondary} mb-1`}>Active Rules</div>
              <div className={`text-2xl font-bold ${getInfoGradient('medium').textPrimary}`}>{rules.length}</div>
            </div>
            <div className={`p-4 ${getRadiusClass('field')} ${getActivityGradient('design').background} ${getGlassClasses('medium').split(' ').slice(1).join(' ')} border ${getActivityGradient('design').border}`}>
              <div className={`text-xs ${getActivityGradient('design').text} mb-1`}>Active Patterns</div>
              <div className={`text-2xl font-bold ${getActivityGradient('design').text}`}>{patterns.length}</div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className={`${getGlassClasses('subtle')} px-6 py-3 border-b-2 border-white/30 flex items-center justify-between`}>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 ${getRadiusClass('element')} text-sm ${TRANSITIONS.fast} ${
                selectedCategory === 'all'
                  ? `${getGradientClasses('ocean', 'accent')} text-white shadow-md`
                  : `${getGlassClasses('subtle')} text-gray-700 hover:${getGlassClasses('medium')}`
              }`}
            >
              All ({settingsState.learnings.learnings.length})
            </button>
            <button
              onClick={() => setSelectedCategory('rules')}
              className={`px-3 py-1 ${getRadiusClass('element')} text-sm ${TRANSITIONS.fast} ${
                selectedCategory === 'rules'
                  ? `${getGradientClasses('ocean', 'accent')} text-white shadow-md`
                  : `${getGlassClasses('subtle')} text-gray-700 hover:${getGlassClasses('medium')}`
              }`}
            >
              ✅ Rules ({rules.length})
            </button>
            <button
              onClick={() => setSelectedCategory('patterns')}
              className={`px-3 py-1 ${getRadiusClass('element')} text-sm ${TRANSITIONS.fast} ${
                selectedCategory === 'patterns'
                  ? `${getGradientClasses('ocean', 'accent')} text-white shadow-md`
                  : `${getGlassClasses('subtle')} text-gray-700 hover:${getGlassClasses('medium')}`
              }`}
            >
              📊 Patterns ({patterns.length})
            </button>
            <button
              onClick={() => setSelectedCategory('observations')}
              className={`px-3 py-1 ${getRadiusClass('element')} text-sm ${TRANSITIONS.fast} ${
                selectedCategory === 'observations'
                  ? `${getGradientClasses('ocean', 'accent')} text-white shadow-md`
                  : `${getGlassClasses('subtle')} text-gray-700 hover:${getGlassClasses('medium')}`
              }`}
            >
              🔬 Observations ({observations.length})
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleOptimize}
              disabled={isOptimizing || metrics.totalLearnings < 5}
              className={`px-4 py-2 ${getRadiusClass('field')} ${getGradientClasses('lavender', 'accent')} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm ${TRANSITIONS.fast} flex items-center gap-2 shadow-md`}
            >
              {isOptimizing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Optimize
                </>
              )}
            </button>
            <button
              onClick={handleExport}
              className={`px-4 py-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} text-gray-700 hover:${getGlassClasses('strong')} text-sm ${TRANSITIONS.fast}`}
            >
              Export Profile
            </button>
            <button
              onClick={handleImport}
              className={`px-4 py-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} text-gray-700 hover:${getGlassClasses('strong')} text-sm ${TRANSITIONS.fast}`}
            >
              Import Profile
            </button>
          </div>
        </div>

        {/* Optimization Result */}
        {optimizationResult && (
          <div className={`mx-6 mt-4 p-4 ${getRadiusClass('field')} ${
            optimizationResult.applied
              ? getSuccessGradient('medium').container
              : getInfoGradient('medium').container
          }`}>
            <div className="flex items-start gap-2">
              <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${optimizationResult.applied ? getSuccessGradient('medium').textSecondary : getInfoGradient('medium').textSecondary}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <div className={`font-medium mb-1 ${optimizationResult.applied ? getSuccessGradient('medium').textPrimary : getInfoGradient('medium').textPrimary}`}>
                  {optimizationResult.applied ? '✅ Parameters Optimized' : 'ℹ️ AI Analysis Complete'}
                </div>
                <div className="text-sm text-gray-700">{optimizationResult.reasoning}</div>
              </div>
              <button
                onClick={() => setOptimizationResult(null)}
                className={`text-gray-600 hover:text-gray-900 ${TRANSITIONS.fast}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Learnings List */}
        <div className="flex-1 overflow-y-auto p-6">
          {displayedLearnings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-700 text-lg mb-2">No learnings yet</div>
              <div className="text-gray-600 text-sm">
                The AI will start learning as you edit tasks and notes
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedLearnings.map(learning => (
                <LearningCard
                  key={learning.id}
                  learning={learning}
                  settings={settingsState.learningSettings}
                  isExpanded={expandedLearningId === learning.id}
                  onToggleExpand={() => setExpandedLearningId(
                    expandedLearningId === learning.id ? null : learning.id
                  )}
                  onToggleFlag={() => handleFlagToggle(learning.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface LearningCardProps {
  learning: Learning;
  settings: AppState['learningSettings'];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleFlag: () => void;
}

function LearningCard({ learning, settings, isExpanded, onToggleExpand, onToggleFlag }: LearningCardProps) {
  const getStatusBadge = () => {
    if (learning.strength >= settings.thresholds.rule) {
      return <span className={`px-2 py-1 ${getSuccessGradient('strong').container} ${getSuccessGradient('strong').textPrimary} ${getRadiusClass('element')} text-xs font-medium`}>✅ RULE</span>;
    } else if (learning.strength >= settings.thresholds.active) {
      return <span className={`px-2 py-1 ${getInfoGradient('strong').container} ${getInfoGradient('strong').textPrimary} ${getRadiusClass('element')} text-xs font-medium`}>📊 PATTERN</span>;
    } else {
      return <span className={`px-2 py-1 ${getGlassClasses('subtle')} text-gray-700 ${getRadiusClass('element')} text-xs font-medium`}>🔬 OBSERVATION</span>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const getColorClasses = () => {
      switch (category) {
        case 'task-creation':
          return `${getActivityGradient('design').background} ${getActivityGradient('design').text} border ${getActivityGradient('design').border}`;
        case 'task-timing':
          return `${getInfoGradient('strong').container} ${getInfoGradient('strong').textPrimary}`;
        case 'task-priority':
          return `${getActivityGradient('meeting').background} ${getActivityGradient('meeting').text} border ${getActivityGradient('meeting').border}`;
        case 'topic-detection':
          return `${getSuccessGradient('strong').container} ${getSuccessGradient('strong').textPrimary}`;
        case 'note-merging':
          return `${getActivityGradient('writing').background} ${getActivityGradient('writing').text} border ${getActivityGradient('writing').border}`;
        case 'tagging':
          return `${getActivityGradient('design').background} ${getActivityGradient('design').text} border ${getActivityGradient('design').border}`;
        case 'formatting':
          return `${getActivityGradient('document').background} ${getActivityGradient('document').text} border ${getActivityGradient('document').border}`;
        default:
          return `${getGlassClasses('subtle')} text-gray-700`;
      }
    };

    return (
      <span className={`px-2 py-1 backdrop-blur-xl ${getRadiusClass('element')} text-xs ${getColorClasses()}`}>
        {category.replace('-', ' ')}
      </span>
    );
  };

  return (
    <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {getStatusBadge()}
              {getCategoryBadge(learning.category)}
              {learning.isFlag && (
                <span className={`px-2 py-1 ${getActivityGradient('writing').background} backdrop-blur-xl border ${getActivityGradient('writing').border} ${getActivityGradient('writing').text} ${getRadiusClass('element')} text-xs font-medium`}>
                  🚩 FLAGGED
                </span>
              )}
              <span className="text-xs text-gray-600">
                Strength: {learning.strength.toFixed(1)}%
              </span>
            </div>
            <div className="text-gray-900 font-medium mb-1">{learning.pattern}</div>
            <div className="text-sm text-gray-700">{learning.action}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleFlag}
              className={`p-2 ${getRadiusClass('element')} ${TRANSITIONS.fast} ${
                learning.isFlag
                  ? `${getActivityGradient('writing').background} ${getActivityGradient('writing').text} hover:opacity-80`
                  : `${getGlassClasses('subtle')} text-gray-600 hover:${getGlassClasses('medium')}`
              }`}
              title={learning.isFlag ? 'Remove flag' : 'Flag for faster learning'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </button>
            <button
              onClick={onToggleExpand}
              className={`p-2 ${getGlassClasses('subtle')} text-gray-600 hover:${getGlassClasses('medium')} ${getRadiusClass('element')} ${TRANSITIONS.fast}`}
            >
              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span>✓ {learning.timesConfirmed} confirmations</span>
          <span>✗ {learning.timesRejected} rejections</span>
          <span>↻ {learning.timesApplied} applications</span>
        </div>
      </div>

      {isExpanded && (
        <div className={`border-t-2 border-white/30 ${getGlassClasses('subtle')} p-4`}>
          <div className="text-sm text-gray-700 mb-3 font-medium">Evidence History</div>
          {learning.evidence.length === 0 ? (
            <div className="text-sm text-gray-600">No evidence recorded yet</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {learning.evidence.slice().reverse().map(evidence => (
                <div key={evidence.id} className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-3`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 ${getRadiusClass('element')} text-xs font-medium backdrop-blur-xl ${
                      evidence.userAction === 'confirm' ? `${getSuccessGradient('strong').container} ${getSuccessGradient('strong').textPrimary}` :
                      evidence.userAction === 'reject' ? `${getActivityGradient('meeting').background} ${getActivityGradient('meeting').text} border ${getActivityGradient('meeting').border}` :
                      evidence.userAction === 'modify' ? `${getActivityGradient('writing').background} ${getActivityGradient('writing').text} border ${getActivityGradient('writing').border}` :
                      `${getGlassClasses('subtle')} text-gray-700`
                    }`}>
                      {evidence.userAction}
                    </span>
                    <span className="text-xs text-gray-600">
                      {new Date(evidence.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">{evidence.context}</div>
                  {evidence.details && (evidence.details.before || evidence.details.after) && (
                    <div className="mt-2 text-xs text-gray-600">
                      {evidence.details.before && <div>Before: {JSON.stringify(evidence.details.before)}</div>}
                      {evidence.details.after && <div>After: {JSON.stringify(evidence.details.after)}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

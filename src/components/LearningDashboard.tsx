import { useState } from 'react';
import type { Learning, AppState } from '../types';
import { LearningService } from '../services/learningService';
import { claudeService } from '../services/claudeService';
import { useSettings } from '../context/SettingsContext';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">AI Learning System</h2>
            <p className="text-sm text-gray-400 mt-1">
              View and manage what the AI has learned from your corrections
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Metrics Bar */}
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-1">Total Learnings</div>
              <div className="text-2xl font-bold text-white">{metrics.totalLearnings}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Accuracy Rate</div>
              <div className="text-2xl font-bold text-green-400">{(metrics.accuracy * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Active Rules</div>
              <div className="text-2xl font-bold text-blue-400">{rules.length}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Active Patterns</div>
              <div className="text-2xl font-bold text-purple-400">{patterns.length}</div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-gray-800 px-6 py-3 border-b border-gray-700 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All ({settingsState.learnings.learnings.length})
            </button>
            <button
              onClick={() => setSelectedCategory('rules')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedCategory === 'rules' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ✅ Rules ({rules.length})
            </button>
            <button
              onClick={() => setSelectedCategory('patterns')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedCategory === 'patterns' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              📊 Patterns ({patterns.length})
            </button>
            <button
              onClick={() => setSelectedCategory('observations')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedCategory === 'observations' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🔬 Observations ({observations.length})
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleOptimize}
              disabled={isOptimizing || metrics.totalLearnings < 5}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-sm transition-colors flex items-center gap-2"
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
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
            >
              Export Profile
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
            >
              Import Profile
            </button>
          </div>
        </div>

        {/* Optimization Result */}
        {optimizationResult && (
          <div className={`mx-6 mt-4 p-4 rounded border ${
            optimizationResult.applied
              ? 'bg-green-900/20 border-green-700'
              : 'bg-blue-900/20 border-blue-700'
          }`}>
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <div className="font-medium mb-1">
                  {optimizationResult.applied ? '✅ Parameters Optimized' : 'ℹ️ AI Analysis Complete'}
                </div>
                <div className="text-sm text-gray-300">{optimizationResult.reasoning}</div>
              </div>
              <button
                onClick={() => setOptimizationResult(null)}
                className="text-gray-400 hover:text-white"
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
              <div className="text-gray-500 text-lg mb-2">No learnings yet</div>
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
      return <span className="px-2 py-1 bg-green-900/50 border border-green-700 text-green-300 rounded text-xs font-medium">✅ RULE</span>;
    } else if (learning.strength >= settings.thresholds.active) {
      return <span className="px-2 py-1 bg-blue-900/50 border border-blue-700 text-blue-300 rounded text-xs font-medium">📊 PATTERN</span>;
    } else {
      return <span className="px-2 py-1 bg-gray-800 border border-gray-700 text-gray-400 rounded text-xs font-medium">🔬 OBSERVATION</span>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      'task-creation': 'bg-purple-900/30 text-purple-300 border-purple-700',
      'task-timing': 'bg-blue-900/30 text-blue-300 border-blue-700',
      'task-priority': 'bg-red-900/30 text-red-300 border-red-700',
      'topic-detection': 'bg-green-900/30 text-green-300 border-green-700',
      'note-merging': 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
      'tagging': 'bg-pink-900/30 text-pink-300 border-pink-700',
      'formatting': 'bg-indigo-900/30 text-indigo-300 border-indigo-700',
    };

    return (
      <span className={`px-2 py-1 border rounded text-xs ${colors[category] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
        {category.replace('-', ' ')}
      </span>
    );
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {getStatusBadge()}
              {getCategoryBadge(learning.category)}
              {learning.isFlag && (
                <span className="px-2 py-1 bg-orange-900/50 border border-orange-700 text-orange-300 rounded text-xs font-medium">
                  🚩 FLAGGED
                </span>
              )}
              <span className="text-xs text-gray-500">
                Strength: {learning.strength.toFixed(1)}%
              </span>
            </div>
            <div className="text-white font-medium mb-1">{learning.pattern}</div>
            <div className="text-sm text-gray-400">{learning.action}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleFlag}
              className={`p-2 rounded transition-colors ${
                learning.isFlag
                  ? 'bg-orange-900/30 text-orange-300 hover:bg-orange-900/50'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={learning.isFlag ? 'Remove flag' : 'Flag for faster learning'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </button>
            <button
              onClick={onToggleExpand}
              className="p-2 bg-gray-700 text-gray-400 hover:bg-gray-600 rounded transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>✓ {learning.timesConfirmed} confirmations</span>
          <span>✗ {learning.timesRejected} rejections</span>
          <span>↻ {learning.timesApplied} applications</span>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-700 bg-gray-900/50 p-4">
          <div className="text-sm text-gray-400 mb-3 font-medium">Evidence History</div>
          {learning.evidence.length === 0 ? (
            <div className="text-sm text-gray-600">No evidence recorded yet</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {learning.evidence.slice().reverse().map(evidence => (
                <div key={evidence.id} className="bg-gray-800 border border-gray-700 rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      evidence.userAction === 'confirm' ? 'bg-green-900/30 text-green-300' :
                      evidence.userAction === 'reject' ? 'bg-red-900/30 text-red-300' :
                      evidence.userAction === 'modify' ? 'bg-yellow-900/30 text-yellow-300' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {evidence.userAction}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(evidence.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300">{evidence.context}</div>
                  {evidence.details && (evidence.details.before || evidence.details.after) && (
                    <div className="mt-2 text-xs text-gray-500">
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

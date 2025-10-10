import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { claudeService } from '../services/claudeService';
import { X, Key, Brain, Sparkles, Download, Upload, Trash2, User } from 'lucide-react';
import type { AppState } from '../types';
import { LearningDashboard } from './LearningDashboard';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { state, dispatch } = useApp();
  const [apiKey, setApiKey] = useState('');
  const [localSettings, setLocalSettings] = useState(state.aiSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [userName, setUserName] = useState(state.userProfile.name);
  const [showLearningDashboard, setShowLearningDashboard] = useState(false);

  useEffect(() => {
    // Load API key from localStorage
    const savedKey = localStorage.getItem('claude-api-key');
    if (savedKey) setApiKey(savedKey);

    setLocalSettings(state.aiSettings);
    setUserName(state.userProfile.name);
  }, [state.aiSettings, state.userProfile.name, isOpen]);

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('claude-api-key', apiKey.trim());
      claudeService.setApiKey(apiKey.trim());
      alert('API key saved successfully!');
    }
  };

  const handleUpdateSettings = () => {
    dispatch({ type: 'UPDATE_AI_SETTINGS', payload: localSettings });
    setHasChanges(false);
    alert('Settings updated successfully!');
  };

  const handleSaveUserProfile = () => {
    dispatch({ type: 'UPDATE_USER_PROFILE', payload: { name: userName.trim() } });
    alert('Profile updated successfully!');
  };

  const handleSettingChange = (key: keyof AppState['aiSettings'], value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleExportData = () => {
    const data = {
      topics: state.topics,
      notes: state.notes,
      tasks: state.tasks,
      aiSettings: state.aiSettings,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskerino-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);

        if (confirm('This will replace all your current data. Continue?')) {
          dispatch({ type: 'LOAD_STATE', payload: data });
          alert('Data imported successfully!');
        }
      } catch (error) {
        alert('Failed to import data. Invalid file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = () => {
    if (confirm('This will permanently delete all your topics, notes, and tasks. Are you sure?')) {
      if (confirm('This action cannot be undone. Really delete everything?')) {
        localStorage.removeItem('taskerino-v2-state');
        dispatch({ type: 'LOAD_STATE', payload: { topics: [], notes: [], tasks: [] } });
        alert('All data cleared.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white/60 backdrop-blur-2xl border-2 border-white/50 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b-2 border-white/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 backdrop-blur-sm flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/60 backdrop-blur-md rounded-xl transition-all duration-300 hover:scale-110 active:scale-95"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* User Profile */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-violet-600" />
              <h3 className="text-lg font-semibold text-gray-900">Your Profile</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 bg-white/70 backdrop-blur-xl border border-white/60 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 transition-all shadow-sm"
                />
              </div>

              <button
                onClick={handleSaveUserProfile}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors duration-200"
              >
                Save Profile
              </button>
            </div>
          </section>

          {/* API Key */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-violet-600" />
              <h3 className="text-lg font-semibold text-gray-900">Claude API Key</h3>
            </div>

            <div className="space-y-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-4 py-3 bg-white/70 backdrop-blur-xl border border-white/60 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 transition-all shadow-sm"
              />

              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors duration-200"
              >
                Save API Key
              </button>

              <p className="text-sm text-gray-600">
                Get your API key from{' '}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 hover:underline"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>
          </section>

          {/* AI Behavior */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-violet-600" />
              <h3 className="text-lg font-semibold text-gray-900">AI Behavior</h3>
            </div>

            <div className="space-y-4">
              {/* System Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Instructions
                </label>
                <textarea
                  value={localSettings.systemInstructions}
                  onChange={(e) => handleSettingChange('systemInstructions', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-white/70 backdrop-blur-xl border border-white/60 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 transition-all resize-none shadow-sm"
                  placeholder="Customize how the AI should behave..."
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <ToggleSetting
                  label="Auto-merge similar notes"
                  description="Automatically merge new notes with recent similar ones"
                  checked={localSettings.autoMergeNotes}
                  onChange={(checked) => handleSettingChange('autoMergeNotes', checked)}
                />

                <ToggleSetting
                  label="Auto-extract tasks"
                  description="Automatically detect and create tasks from your notes"
                  checked={localSettings.autoExtractTasks}
                  onChange={(checked) => handleSettingChange('autoExtractTasks', checked)}
                />

                {/* Generate summaries setting removed - not implemented yet */}
              </div>

              {/* Topic Creation Sensitivity - removed, not implemented yet */}

              {/* Learning Dashboard Button */}
              <div className="pt-2">
                <button
                  onClick={() => setShowLearningDashboard(true)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  View AI Learning System ({state.learnings.learnings.length} learnings)
                </button>
                <p className="text-sm text-gray-600 mt-2">
                  See what the AI has learned from your edits and manage learning patterns
                </p>
              </div>

              {hasChanges && (
                <button
                  onClick={handleUpdateSettings}
                  className="w-full px-4 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200"
                >
                  Save AI Settings
                </button>
              )}
            </div>
          </section>

          {/* Data Management */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-violet-600" />
              <h3 className="text-lg font-semibold text-gray-900">Data Management</h3>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleExportData}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200"
              >
                <Download className="w-5 h-5" />
                Export All Data
              </button>

              <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200 cursor-pointer">
                <Upload className="w-5 h-5" />
                Import Data
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleClearAllData}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors duration-200"
              >
                <Trash2 className="w-5 h-5" />
                Clear All Data
              </button>
            </div>
          </section>

          {/* Stats */}
          <section className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Data</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-violet-600">{state.topics.length}</div>
                <div className="text-sm text-gray-600">Topics</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-fuchsia-600">{state.notes.length}</div>
                <div className="text-sm text-gray-600">Notes</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-cyan-600">{state.tasks.length}</div>
                <div className="text-sm text-gray-600">Tasks</div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-white/30 bg-white/40 backdrop-blur-xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-medium hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shadow-cyan-200/50"
          >
            Close
          </button>
        </div>
      </div>

      {/* Learning Dashboard Overlay */}
      {showLearningDashboard && (
        <LearningDashboard onClose={() => setShowLearningDashboard(false)} />
      )}
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl">
      <div className="flex-1">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-sm text-gray-600 mt-1">{description}</div>
      </div>

      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${
          checked ? 'bg-violet-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

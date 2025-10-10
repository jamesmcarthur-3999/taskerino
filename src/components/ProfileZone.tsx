import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { claudeService } from '../services/claudeService';
import { Key, Brain, Download, Upload, Trash2, Settings, Clock, Globe, Calendar, ChevronDown, RefreshCw, Sparkles, Bot } from 'lucide-react';
import type { AppState } from '../types';
import { LearningDashboard } from './LearningDashboard';
import { NedSettings } from './ned/NedSettings';

type SettingsTab = 'general' | 'ai' | 'ned' | 'time' | 'data';

export function ProfileZone() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [apiKey, setApiKey] = useState('');
  const [localAISettings, setLocalAISettings] = useState(state.aiSettings);
  const [localPreferences, setLocalPreferences] = useState(state.ui.preferences);
  const [userName, setUserName] = useState(state.userProfile.name);
  const [showLearningDashboard, setShowLearningDashboard] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('claude-api-key');
    if (savedKey) setApiKey(savedKey);
    setLocalAISettings(state.aiSettings);
    setLocalPreferences(state.ui.preferences);
    setUserName(state.userProfile.name);
  }, [state.aiSettings, state.ui.preferences, state.userProfile.name]);

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('claude-api-key', apiKey.trim());
      claudeService.setApiKey(apiKey.trim());
      alert('API key saved successfully!');
    }
  };

  const handleSaveAISettings = () => {
    dispatch({ type: 'UPDATE_AI_SETTINGS', payload: localAISettings });
    alert('AI settings saved!');
  };

  const handleSavePreferences = () => {
    dispatch({ type: 'UPDATE_PREFERENCES', payload: localPreferences });
    alert('Preferences saved!');
  };

  const handleSaveUserProfile = () => {
    dispatch({ type: 'UPDATE_USER_PROFILE', payload: { name: userName.trim() } });
    alert('Profile saved!');
  };

  const handleExportData = () => {
    const data = {
      topics: state.topics,
      notes: state.notes,
      tasks: state.tasks,
      aiSettings: state.aiSettings,
      preferences: state.ui.preferences,
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


  const handleResetOnboarding = () => {
    if (confirm('This will reset the onboarding flow. You\'ll see the welcome screen next time you refresh. Continue?')) {
      dispatch({ type: 'RESET_ONBOARDING' });
      alert('Onboarding reset! Refresh the page to see the welcome flow again.');
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'ai', label: 'AI Behavior', icon: <Brain className="w-4 h-4" /> },
    { id: 'ned', label: 'Ned Assistant', icon: <Bot className="w-4 h-4" /> },
    { id: 'time', label: 'Time & Date', icon: <Clock className="w-4 h-4" /> },
    { id: 'data', label: 'Data', icon: <Download className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full w-full bg-gradient-to-br from-cyan-50 via-blue-50/30 to-teal-50 overflow-hidden">
      <div className="h-full overflow-y-auto p-8 pt-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Configure your workspace</p>
          </div>

          {/* Tabs */}
          <div className="backdrop-blur-2xl bg-white/40 rounded-[1.5rem] shadow-xl border-2 border-white/30 overflow-hidden">
            <div className="border-b border-gray-200 px-2 pt-2">
              <div className="flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-t-xl font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-white text-cyan-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="bg-white p-8 space-y-6">
              {/* General Tab */}
              {activeTab === 'general' && (
                <>
                  <Section title="Profile">
                    <Input
                      label="Your Name"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Enter your name"
                    />
                    <SaveButton onClick={handleSaveUserProfile} label="Save Profile" />
                  </Section>

                  <Section title="Claude API Key">
                    <Input
                      label="API Key"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                    />
                    <p className="text-sm text-gray-600">
                      Get your API key from{' '}
                      <a
                        href="https://console.anthropic.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-600 hover:underline font-medium"
                      >
                        console.anthropic.com
                      </a>
                    </p>
                    <SaveButton onClick={handleSaveApiKey} label="Save API Key" />
                  </Section>

                  <Section title="Onboarding">
                    <button
                      onClick={handleResetOnboarding}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-700 rounded-xl font-semibold hover:from-cyan-500/20 hover:to-blue-500/20 transition-all border-2 border-cyan-200"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Reset Onboarding
                    </button>
                    <p className="text-sm text-gray-600">
                      Reset the welcome flow and see the onboarding experience again
                    </p>
                  </Section>
                </>
              )}

              {/* AI Behavior Tab */}
              {activeTab === 'ai' && (
                <>
                  <Section title="How AI Processes Your Notes">
                    <Toggle
                      label="Combine similar notes automatically"
                      description="When AI detects a similar recent note, it will merge them instead of creating duplicates"
                      checked={localAISettings.autoMergeNotes}
                      onChange={(checked) =>
                        setLocalAISettings((prev) => ({ ...prev, autoMergeNotes: checked }))
                      }
                    />
                    <Toggle
                      label="Extract tasks from notes"
                      description="AI will automatically detect action items and create tasks"
                      checked={localAISettings.autoExtractTasks}
                      onChange={(checked) =>
                        setLocalAISettings((prev) => ({ ...prev, autoExtractTasks: checked }))
                      }
                    />
                  </Section>

                  <Section title="AI Agents">
                    <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                          <Brain className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">AI Agents - Coming Soon</h4>
                          <p className="text-sm text-gray-600">Autonomous AI that learns from your workflow</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">
                        AI agents will automatically handle tasks, learn your preferences, and adapt to your workflow over time.
                      </p>
                    </div>
                  </Section>

                  <details className="group">
                    <summary className="cursor-pointer text-sm font-semibold text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2">
                      <span>Advanced Settings</span>
                      <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                    </summary>
                    <Section title="Custom AI Instructions">
                      <Textarea
                        label="System Instructions"
                        value={localAISettings.systemInstructions}
                        onChange={(e) =>
                          setLocalAISettings((prev) => ({ ...prev, systemInstructions: e.target.value }))
                        }
                        rows={4}
                        placeholder="Customize how the AI should behave..."
                      />
                      <p className="text-xs text-gray-500">
                        Advanced: These instructions are prepended to every AI request. Only change if you know what you're doing.
                      </p>
                    </Section>
                  </details>

                  <SaveButton onClick={handleSaveAISettings} label="Save AI Settings" />
                </>
              )}

              {/* Ned Assistant Tab */}
              {activeTab === 'ned' && <NedSettings />}

              {/* Time & Date Tab */}
              {activeTab === 'time' && (
                <>
                  <Section title="Time Format">
                    <Select
                      label="Time Display"
                      value={localPreferences.dateFormat}
                      onChange={(e) =>
                        setLocalPreferences((prev) => ({ ...prev, dateFormat: e.target.value as '12h' | '24h' }))
                      }
                      options={[
                        { value: '12h', label: '12-hour (2:30 PM)' },
                        { value: '24h', label: '24-hour (14:30)' },
                      ]}
                    />
                  </Section>

                  <Section title="Timezone">
                    <Input
                      label="Timezone"
                      value={localPreferences.timezone}
                      onChange={(e) => setLocalPreferences((prev) => ({ ...prev, timezone: e.target.value }))}
                      placeholder="America/New_York"
                    />
                    <p className="text-sm text-gray-600">
                      Current timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </p>
                  </Section>

                  <Section title="Calendar">
                    <Select
                      label="Week Starts On"
                      value={localPreferences.weekStartsOn}
                      onChange={(e) =>
                        setLocalPreferences((prev) => ({
                          ...prev,
                          weekStartsOn: e.target.value as 'sunday' | 'monday',
                        }))
                      }
                      options={[
                        { value: 'sunday', label: 'Sunday' },
                        { value: 'monday', label: 'Monday' },
                      ]}
                    />
                  </Section>

                  <SaveButton onClick={handleSavePreferences} label="Save Preferences" />
                </>
              )}

              {/* Data Tab */}
              {activeTab === 'data' && (
                <>
                  <Section title="Backup & Restore">
                    <button
                      onClick={handleExportData}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                    >
                      <Download className="w-5 h-5" />
                      Export All Data
                    </button>

                    <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all cursor-pointer">
                      <Upload className="w-5 h-5" />
                      Import Data
                      <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                    </label>

                    <p className="text-sm text-gray-600">
                      Export your data to back it up, or import from a previous backup
                    </p>
                  </Section>


                  <Section title="Danger Zone">
                    <button
                      onClick={handleClearAllData}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                      Clear All Data
                    </button>
                    <p className="text-sm text-red-600">
                      This will permanently delete all your topics, notes, and tasks. This action cannot be undone.
                    </p>
                  </Section>

                  <Section title="Storage Info">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <div className="text-2xl font-bold text-gray-900">{state.topics.length}</div>
                        <div className="text-sm text-gray-600">Topics</div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <div className="text-2xl font-bold text-gray-900">{state.notes.length}</div>
                        <div className="text-sm text-gray-600">Notes</div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <div className="text-2xl font-bold text-gray-900">{state.tasks.length}</div>
                        <div className="text-sm text-gray-600">Tasks</div>
                      </div>
                    </div>
                  </Section>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Learning Dashboard Overlay */}
      {showLearningDashboard && <LearningDashboard onClose={() => setShowLearningDashboard(false)} />}
    </div>
  );
}

// Helper Components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
      />
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none transition-all"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({
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
        <div className="font-semibold text-gray-900">{label}</div>
        <div className="text-sm text-gray-600 mt-1">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
          checked ? 'bg-cyan-600' : 'bg-gray-300'
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

function SaveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
    >
      {label}
    </button>
  );
}

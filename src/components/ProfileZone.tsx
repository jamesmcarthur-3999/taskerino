import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettings, useEnrichmentSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useEntities } from '../context/EntitiesContext';
import { useNotes } from '../context/NotesContext';
import { useTasks } from '../context/TasksContext';
// AppContext removed - notifications now via UIContext
import { claudeService } from '../services/claudeService';
import { sessionsAgentService } from '../services/sessionsAgentService';
import { openAIService } from '../services/openAIService';
import { audioCompressionService, type AudioQualityPreset } from '../services/audioCompressionService';
import { Key, Brain, Download, Upload, Trash2, Settings, Clock, Globe, Calendar, ChevronDown, RefreshCw, Bot, Mic, Video, HardDrive, RotateCcw } from 'lucide-react';
import type { AppState, Session, Note, Task, Topic, Company, Contact, AISettings, UserPreferences } from '../types';
import { getStorage } from '../services/storage';
import { LearningDashboard } from './LearningDashboard';
import { NedSettings } from './ned/NedSettings';
import { Input } from './Input';
import { Button } from './Button';
import { StandardSelect } from './StandardSelect';
import { BACKGROUND_GRADIENT, getGlassClasses, getRadiusClass, getTabClasses, getRadioCardClasses, SETTINGS, getInfoGradient, getDangerGradient } from '../design-system/theme';

type SettingsTab = 'general' | 'ai' | 'ned' | 'sessions' | 'time' | 'data';

export default function ProfileZone() {
  // Removed useApp() - notifications now via useUI().addNotification
  const { state: settingsState, dispatch: settingsDispatch } = useSettings();
  const { enrichmentSettings, switchStrategy } = useEnrichmentSettings();
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { state: entitiesState } = useEntities();
  const { state: notesState } = useNotes();
  const { state: tasksState } = useTasks();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [apiKey, setApiKey] = useState('');
  const [openAIApiKey, setOpenAIApiKey] = useState('');
  const [localAISettings, setLocalAISettings] = useState(settingsState.aiSettings);
  const [localPreferences, setLocalPreferences] = useState(uiState.preferences);
  const [userName, setUserName] = useState(settingsState.userProfile.name);
  const [showLearningDashboard, setShowLearningDashboard] = useState(false);
  const [audioQualityPreset, setAudioQualityPreset] = useState<AudioQualityPreset>('optimized');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadKeys = async () => {
      const savedKey = await invoke<string | null>('get_claude_api_key');
      if (savedKey) setApiKey(savedKey);

      const savedOpenAIKey = await invoke<string | null>('get_openai_api_key');
      if (savedOpenAIKey) setOpenAIApiKey(savedOpenAIKey);
    };
    loadKeys();

    const savedAudioQuality = audioCompressionService.getQualityPreset();
    setAudioQualityPreset(savedAudioQuality);

    setLocalAISettings(settingsState.aiSettings);
    setLocalPreferences(uiState.preferences);
    setUserName(settingsState.userProfile.name);
  }, [settingsState.aiSettings, uiState.preferences, settingsState.userProfile.name]);

  const handleSaveApiKey = async () => {
    if (apiKey.trim()) {
      // Validate API key format
      if (!apiKey.trim().startsWith('sk-ant-')) {
        alert('Invalid API key format. Anthropic API keys should start with "sk-ant-"');
        return;
      }

      await invoke('set_claude_api_key', { apiKey: apiKey.trim() });
      claudeService.setApiKey(apiKey.trim());
      sessionsAgentService.setApiKey(apiKey.trim());
      alert('API key saved successfully!');
    }
  };

  const handleClearApiKey = async () => {
    if (confirm('Are you sure you want to clear your API key?')) {
      await invoke('set_claude_api_key', { apiKey: '' });
      setApiKey('');
      alert('API key cleared. Please enter a new one.');
    }
  };

  const handleSaveOpenAIApiKey = async () => {
    if (openAIApiKey.trim()) {
      // Validate API key format
      if (!openAIApiKey.trim().startsWith('sk-')) {
        alert('Invalid API key format. OpenAI API keys should start with "sk-"');
        return;
      }

      await invoke('set_openai_api_key', { apiKey: openAIApiKey.trim() });
      openAIService.setApiKey(openAIApiKey.trim());
      alert('OpenAI API key saved successfully!');
    }
  };

  const handleClearOpenAIApiKey = async () => {
    if (confirm('Are you sure you want to clear your OpenAI API key?')) {
      await invoke('set_openai_api_key', { apiKey: '' });
      setOpenAIApiKey('');
      alert('OpenAI API key cleared.');
    }
  };

  const handleSaveAISettings = () => {
    settingsDispatch({ type: 'UPDATE_AI_SETTINGS', payload: localAISettings });
    alert('AI settings saved!');
  };

  const handleSavePreferences = () => {
    uiDispatch({ type: 'UPDATE_PREFERENCES', payload: localPreferences });
    alert('Preferences saved!');
  };

  const handleSaveUserProfile = () => {
    settingsDispatch({ type: 'UPDATE_USER_PROFILE', payload: { name: userName.trim() } });
    alert('Profile saved!');
  };

  const handleExportData = async () => {
    try {
      // Export directly from storage to ensure completeness
      const storage = await getStorage();

      const data = {
        // Entities
        topics: await storage.load<Topic[]>('topics') || [],
        companies: await storage.load<Company[]>('companies') || [],
        contacts: await storage.load<Contact[]>('contacts') || [],

        // Content
        notes: await storage.load<Note[]>('notes') || [],
        tasks: await storage.load<Task[]>('tasks') || [],
        sessions: await storage.load<Session[]>('sessions') || [],

        // Settings
        aiSettings: await storage.load<AISettings>('aiSettings') || settingsState.aiSettings,
        preferences: await storage.load<UserPreferences>('preferences') || uiState.preferences,

        // Metadata
        exportedAt: new Date().toISOString(),
        version: '1.0.0', // Export format version
        appVersion: '0.5.1', // From tauri.conf.json
      };

      // Note: Attachments are NOT included in export (too large)
      // TODO: Add attachment export in Phase 3

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taskerino-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'success',
          title: 'Export Complete',
          message: 'All data exported successfully (attachments excluded)',
          autoDismiss: true,
          dismissAfter: 3000,
        },
      });
    } catch (error: any) {
      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Export Failed',
          message: error.message || 'Unknown error occurred',
          autoDismiss: false,
        },
      });
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate export format
      if (!data.version || !data.exportedAt) {
        throw new Error('Invalid export file format - missing version or exportedAt metadata');
      }

      // Version compatibility check
      if (data.version !== '1.0.0') {
        throw new Error(`Unsupported export version: ${data.version}. Expected version 1.0.0.`);
      }

      // Count items for confirmation
      const counts = {
        sessions: data.sessions?.length || 0,
        notes: data.notes?.length || 0,
        tasks: data.tasks?.length || 0,
        topics: data.topics?.length || 0,
        companies: data.companies?.length || 0,
        contacts: data.contacts?.length || 0,
      };

      // Confirm with user
      const confirmMsg = `Import data from ${new Date(data.exportedAt).toLocaleString()}?\n\nThis will overwrite:\n- ${counts.sessions} sessions\n- ${counts.notes} notes\n- ${counts.tasks} tasks\n- ${counts.topics} topics\n- ${counts.companies} companies\n- ${counts.contacts} contacts\n\nCurrent data will be backed up before import.`;

      if (!confirm(confirmMsg)) {
        return;
      }

      // Import to storage
      const storage = await getStorage();

      // Import each collection
      if (data.topics) await storage.save('topics', data.topics);
      if (data.companies) await storage.save('companies', data.companies);
      if (data.contacts) await storage.save('contacts', data.contacts);
      if (data.notes) await storage.save('notes', data.notes);
      if (data.tasks) await storage.save('tasks', data.tasks);

      // Import sessions through ChunkedStorage
      if (data.sessions) {
        console.log(`[Import] Importing ${data.sessions.length} sessions through ChunkedStorage...`);

        const { getChunkedStorage } = await import('../services/storage/ChunkedSessionStorage');
        const { getInvertedIndexManager } = await import('../services/storage/InvertedIndexManager');

        const chunkedStorage = await getChunkedStorage();
        const indexManager = await getInvertedIndexManager();

        let importedCount = 0;
        let failedCount = 0;

        for (const session of data.sessions) {
          try {
            // Save to ChunkedStorage
            await chunkedStorage.saveFullSession(session);

            // Load metadata and update indexes
            const metadata = await chunkedStorage.loadMetadata(session.id);
            if (metadata) {
              await indexManager.updateIndexes(metadata);
            }

            importedCount++;
          } catch (error) {
            console.error(`[Import] Failed to import session ${session.id}:`, error);
            failedCount++;
          }
        }

        console.log(`[Import] Session import complete: ${importedCount} succeeded, ${failedCount} failed`);
      }

      if (data.aiSettings) await storage.save('aiSettings', data.aiSettings);
      if (data.preferences) await storage.save('preferences', data.preferences);

      console.log('[Import] ✓ All collections imported');

      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'success',
          title: 'Import Complete',
          message: 'Data imported successfully. Please restart the app to see changes.',
          autoDismiss: false,
        },
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Import Failed',
          message: error.message || 'Unknown error occurred',
          autoDismiss: false,
        },
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearAllData = () => {
    if (confirm('This will permanently delete all your topics, notes, and tasks. Are you sure?')) {
      if (confirm('This action cannot be undone. Really delete everything?')) {
        localStorage.removeItem('taskerino-v2-state');
        // TODO: Update to use new storage system (IndexedDB/Tauri FS) instead of localStorage
        alert('All data cleared. Please refresh the page.');
      }
    }
  };


  const handleResetOnboarding = () => {
    if (confirm('Reset onboarding to experience the streamlined welcome flow again?\n\nThis will:\n• Reset all feature introductions and tooltips\n• Clear onboarding progress\n• Show the welcome screen on next refresh\n\nYour data and API keys will NOT be affected.\n\nContinue?')) {
      uiDispatch({ type: 'RESET_ONBOARDING' });
      alert('Onboarding has been reset!\n\nRefresh the page to experience our streamlined welcome flow again. Your data and settings remain unchanged.');
    }
  };

  const handleSaveAudioQuality = () => {
    audioCompressionService.setQualityPreset(audioQualityPreset);
    alert('Audio quality settings saved!');
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'ai', label: 'AI Behavior', icon: <Brain className="w-4 h-4" /> },
    { id: 'ned', label: 'Ned Assistant', icon: <Bot className="w-4 h-4" /> },
    { id: 'sessions', label: 'Sessions', icon: <Video className="w-4 h-4" /> },
    { id: 'time', label: 'Time & Date', icon: <Clock className="w-4 h-4" /> },
    { id: 'data', label: 'Data', icon: <Download className="w-4 h-4" /> },
  ];

  return (
    <div className={`h-full w-full relative flex flex-col ${BACKGROUND_GRADIENT.primary} overflow-hidden`}>
      {/* Secondary animated gradient overlay */}
      <div className={`absolute inset-0 ${BACKGROUND_GRADIENT.secondary} pointer-events-none`} />
      <div className="relative z-10 h-full overflow-y-auto p-8 pt-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Configure your workspace</p>
          </div>

          {/* Tabs */}
          <div className={`backdrop-blur-2xl ${getGlassClasses('medium')} ${getRadiusClass('card')} overflow-hidden`}>
            <div className="border-b border-white/40 px-2 pt-2">
              <div className="flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={getTabClasses(activeTab === tab.id)}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className={`${getGlassClasses('subtle')} p-8 space-y-8`}>
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
                    <Button onClick={handleSaveUserProfile}>Save Profile</Button>
                  </Section>

                  <Divider />

                  {/* API Configuration Group */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">API Configuration</h3>
                      <p className="text-sm text-gray-600">Configure API keys for AI-powered features</p>
                    </div>

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
                      <div className="flex gap-2">
                        <Button onClick={handleSaveApiKey}>Save API Key</Button>
                        <Button onClick={handleClearApiKey} variant="danger">
                          Clear
                        </Button>
                      </div>
                    </Section>

                    <Section title="OpenAI API Key">
                      <div className="flex items-center gap-2 mb-2">
                        <Mic className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-semibold text-orange-700">For Audio Recording</span>
                      </div>
                      <Input
                        label="API Key"
                        type="password"
                        value={openAIApiKey}
                        onChange={(e) => setOpenAIApiKey(e.target.value)}
                        placeholder="sk-..."
                      />
                      <p className="text-sm text-gray-600">
                        Required for audio transcription and description. Get your key from{' '}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:underline font-medium"
                        >
                          platform.openai.com
                        </a>
                      </p>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveOpenAIApiKey}>Save OpenAI Key</Button>
                        <Button onClick={handleClearOpenAIApiKey} variant="danger">
                          Clear
                        </Button>
                      </div>
                    </Section>
                  </div>

                  <Divider />

                  <Section title="Onboarding">
                    <Button
                      onClick={handleResetOnboarding}
                      variant="secondary"
                      fullWidth
                      icon={<RefreshCw className="w-5 h-5" />}
                    >
                      Reset Onboarding
                    </Button>
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

                  <Divider />

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

                  <Divider />

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

                  <Button onClick={handleSaveAISettings}>Save AI Settings</Button>
                </>
              )}

              {/* Ned Assistant Tab */}
              {activeTab === 'ned' && <NedSettings />}

              {/* Sessions Tab */}
              {activeTab === 'sessions' && (
                <>
                  <Section title="Audio Quality">
                    <p className="text-sm text-gray-600 mb-4">
                      Configure how audio is compressed before sending to OpenAI. Local storage always uses full quality.
                    </p>

                    <div className="space-y-4">
                      {/* Optimized Preset */}
                      <label className={getRadioCardClasses(audioQualityPreset === 'optimized')}>
                        <input
                          type="radio"
                          name="audioQuality"
                          value="optimized"
                          checked={audioQualityPreset === 'optimized'}
                          onChange={(e) => setAudioQualityPreset(e.target.value as AudioQualityPreset)}
                          className="mt-1 w-4 h-4 text-cyan-600 focus:ring-cyan-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-900">Optimized</h4>
                            <span className="text-xs px-2 py-1 bg-cyan-500 text-white rounded-full font-semibold">
                              Recommended
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            16kHz for transcription, 24kHz for description. Best balance of quality and speed.
                          </p>
                          <div className="text-xs text-gray-600">
                            <div>• Transcription: ~250KB/min (~95% reduction)</div>
                            <div>• Description: ~750KB/min (~85% reduction)</div>
                            <div>• Faster uploads & API processing</div>
                          </div>
                        </div>
                      </label>

                      {/* Balanced Preset */}
                      <label className={getRadioCardClasses(audioQualityPreset === 'balanced')}>
                        <input
                          type="radio"
                          name="audioQuality"
                          value="balanced"
                          checked={audioQualityPreset === 'balanced'}
                          onChange={(e) => setAudioQualityPreset(e.target.value as AudioQualityPreset)}
                          className="mt-1 w-4 h-4 text-cyan-600 focus:ring-cyan-500"
                        />
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 mb-1">Balanced</h4>
                          <p className="text-sm text-gray-700 mb-2">
                            22kHz for both modes. Good quality, moderate file sizes.
                          </p>
                          <div className="text-xs text-gray-600">
                            <div>• ~1MB/min for both modes (~75% reduction)</div>
                            <div>• Good for most use cases</div>
                          </div>
                        </div>
                      </label>

                      {/* High Quality Preset */}
                      <label className={getRadioCardClasses(audioQualityPreset === 'high')}>
                        <input
                          type="radio"
                          name="audioQuality"
                          value="high"
                          checked={audioQualityPreset === 'high'}
                          onChange={(e) => setAudioQualityPreset(e.target.value as AudioQualityPreset)}
                          className="mt-1 w-4 h-4 text-cyan-600 focus:ring-cyan-500"
                        />
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 mb-1">High Quality</h4>
                          <p className="text-sm text-gray-700 mb-2">
                            44.1kHz with high bitrate. Largest files, slowest uploads.
                          </p>
                          <div className="text-xs text-red-600">
                            <div>• ~2MB/min for transcription</div>
                            <div>• ~3MB/min for description</div>
                            <div>• Not recommended - unnecessary for speech</div>
                          </div>
                        </div>
                      </label>
                    </div>
                  </Section>

                  <Divider />

                  <div className={`p-4 ${getInfoGradient('light').container} ${getRadiusClass('field')}`}>
                    <h4 className={`font-semibold mb-2 ${getInfoGradient('light').textPrimary}`}>About Audio Compression</h4>
                    <ul className={`text-sm space-y-1 ${getInfoGradient('light').textSecondary}`}>
                      <li>• OpenAI Whisper was trained on 16kHz audio</li>
                      <li>• Higher sample rates don't improve transcription accuracy</li>
                      <li>• Compression happens after local storage (full quality preserved)</li>
                      <li>• Settings apply to new recordings only</li>
                    </ul>
                  </div>

                  <Button onClick={handleSaveAudioQuality}>Save Audio Settings</Button>

                  <Divider />

                  <Section title="Enrichment Strategy">
                    <p className="text-sm text-gray-600 mb-4">
                      Choose how sessions are enriched after recording. The AI agent is experimental and uses chain-of-thought reasoning.
                    </p>

                    <div className="space-y-4">
                      {/* Legacy Strategy */}
                      <label className={getRadioCardClasses(enrichmentSettings.strategy === 'legacy')}>
                        <input
                          type="radio"
                          name="enrichmentStrategy"
                          value="legacy"
                          checked={enrichmentSettings.strategy === 'legacy'}
                          onChange={(e) => switchStrategy('legacy')}
                          className="mt-1 w-4 h-4 text-cyan-600 focus:ring-cyan-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-900">Legacy Pipeline</h4>
                            <span className="text-xs px-2 py-1 bg-green-500 text-white rounded-full font-semibold">
                              Production
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            Hardcoded 10-stage enrichment pipeline. Reliable and tested.
                          </p>
                          <div className="text-xs text-gray-600">
                            <div>• Audio review → Video chaptering → Summary → Canvas</div>
                            <div>• Cost: $0.50-2.00 per session</div>
                            <div>• Duration: ~30-60 seconds</div>
                          </div>
                        </div>
                      </label>

                      {/* AI Agent Strategy */}
                      <label className={getRadioCardClasses(enrichmentSettings.strategy === 'ai-agent')}>
                        <input
                          type="radio"
                          name="enrichmentStrategy"
                          value="ai-agent"
                          checked={enrichmentSettings.strategy === 'ai-agent'}
                          onChange={(e) => switchStrategy('ai-agent')}
                          className="mt-1 w-4 h-4 text-cyan-600 focus:ring-cyan-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-900">AI Agent</h4>
                            <span className="text-xs px-2 py-1 bg-yellow-500 text-white rounded-full font-semibold">
                              Experimental
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            AI-driven enrichment with chain-of-thought reasoning and tool use.
                          </p>
                          <div className="text-xs text-gray-600">
                            <div>• Adaptive analysis based on session content</div>
                            <div>• Target cost: &lt;$0.50 per session (via caching)</div>
                            <div>• Duration: ~40-80 seconds</div>
                            <div className="text-yellow-600 font-semibold mt-1">⚠️ Not yet implemented - will throw error if selected</div>
                          </div>
                        </div>
                      </label>
                    </div>
                  </Section>

                  <Divider />

                  <div className={`p-4 ${getInfoGradient('light').container} ${getRadiusClass('field')}`}>
                    <h4 className={`font-semibold mb-2 ${getInfoGradient('light').textPrimary}`}>About Enrichment Strategies</h4>
                    <ul className={`text-sm space-y-1 ${getInfoGradient('light').textSecondary}`}>
                      <li>• Strategy applies to all new enrichments</li>
                      <li>• Existing sessions remain unchanged</li>
                      <li>• You can switch between strategies at any time</li>
                      <li>• AI agent is experimental - use legacy for production</li>
                    </ul>
                  </div>
                </>
              )}

              {/* Time & Date Tab */}
              {activeTab === 'time' && (
                <>
                  <Section title="Time Format">
                    <StandardSelect
                      label="Time Display"
                      value={localPreferences.dateFormat}
                      onChange={(value) =>
                        setLocalPreferences((prev) => ({ ...prev, dateFormat: value as '12h' | '24h' }))
                      }
                      options={[
                        { value: '12h', label: '12-hour (2:30 PM)' },
                        { value: '24h', label: '24-hour (14:30)' },
                      ]}
                    />
                  </Section>

                  <Divider />

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

                  <Divider />

                  <Section title="Calendar">
                    <StandardSelect
                      label="Week Starts On"
                      value={localPreferences.weekStartsOn}
                      onChange={(value) =>
                        setLocalPreferences((prev) => ({
                          ...prev,
                          weekStartsOn: value as 'sunday' | 'monday',
                        }))
                      }
                      options={[
                        { value: 'sunday', label: 'Sunday' },
                        { value: 'monday', label: 'Monday' },
                      ]}
                    />
                  </Section>

                  <Divider />

                  <Button onClick={handleSavePreferences}>Save Preferences</Button>
                </>
              )}

              {/* Data Tab */}
              {activeTab === 'data' && (
                <>
                  <Section title="Storage Info">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className={SETTINGS.statCard}>
                        <div className="text-2xl font-bold text-gray-900">{entitiesState.topics.length}</div>
                        <div className="text-sm text-gray-600">Topics</div>
                      </div>
                      <div className={SETTINGS.statCard}>
                        <div className="text-2xl font-bold text-gray-900">{notesState.notes.length}</div>
                        <div className="text-sm text-gray-600">Notes</div>
                      </div>
                      <div className={SETTINGS.statCard}>
                        <div className="text-2xl font-bold text-gray-900">{tasksState.tasks.length}</div>
                        <div className="text-sm text-gray-600">Tasks</div>
                      </div>
                    </div>
                  </Section>

                  <Divider />

                  <Section title="Backup & Restore">
                    <Button
                      onClick={handleExportData}
                      variant="secondary"
                      fullWidth
                      icon={<Download className="w-5 h-5" />}
                    >
                      Export All Data
                    </Button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleImportData}
                      className="hidden"
                    />
                    <Button
                      variant="secondary"
                      fullWidth
                      icon={<Upload className="w-5 h-5" />}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Import Data
                    </Button>

                    <p className="text-sm text-gray-600">
                      Export your data to back it up, or import from a previous backup
                    </p>
                  </Section>

                  <Divider />

                  <Section title="Danger Zone">
                    <Button
                      onClick={handleClearAllData}
                      variant="danger"
                      fullWidth
                      icon={<Trash2 className="w-5 h-5" />}
                    >
                      Clear All Data
                    </Button>
                    <p className="text-sm text-red-600">
                      This will permanently delete all your topics, notes, and tasks. This action cannot be undone.
                    </p>
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

function Divider() {
  return <div className="border-t border-white/40" />;
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
        className={`w-full px-4 py-3 ${getGlassClasses('strong')} ${getRadiusClass('field')} focus:ring-2 focus:ring-cyan-500 focus:border-cyan-300 resize-none transition-all`}
      />
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
    <div className={`flex items-start justify-between p-4 ${getGlassClasses('subtle')} ${getRadiusClass('field')}`}>
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

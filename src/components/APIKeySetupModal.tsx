import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Check, X, ExternalLink, Lock } from 'lucide-react';
import { validateOpenAIKey, validateAnthropicKey } from '../utils/validation';
import { getGlassClasses, getRadiusClass } from '../design-system/theme';
import { modalBackdropVariants, modalFormVariants } from '../animations/variants';
import { Button } from './Button';
import { Input } from './Input';

interface APIKeySetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

type Tab = 'openai' | 'anthropic';

interface KeyState {
  value: string;
  isValid: boolean;
  error: string;
  showPassword: boolean;
}

export function APIKeySetupModal({ isOpen, onComplete }: APIKeySetupModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('openai');
  const [isSaving, setIsSaving] = useState(false);

  // Separate state for each API key
  const [openAIState, setOpenAIState] = useState<KeyState>({
    value: '',
    isValid: false,
    error: '',
    showPassword: false,
  });

  const [anthropicState, setAnthropicState] = useState<KeyState>({
    value: '',
    isValid: false,
    error: '',
    showPassword: false,
  });

  // Check if both keys are valid
  const canSave = openAIState.isValid && anthropicState.isValid;

  // Real-time validation for OpenAI key
  useEffect(() => {
    if (!openAIState.value.trim()) {
      setOpenAIState(prev => ({ ...prev, isValid: false, error: '' }));
      return;
    }

    const validation = validateOpenAIKey(openAIState.value);
    setOpenAIState(prev => ({
      ...prev,
      isValid: validation.isValid,
      error: validation.error || '',
    }));
  }, [openAIState.value]);

  // Real-time validation for Anthropic key
  useEffect(() => {
    if (!anthropicState.value.trim()) {
      setAnthropicState(prev => ({ ...prev, isValid: false, error: '' }));
      return;
    }

    const validation = validateAnthropicKey(anthropicState.value);
    setAnthropicState(prev => ({
      ...prev,
      isValid: validation.isValid,
      error: validation.error || '',
    }));
  }, [anthropicState.value]);

  const handleOpenAIChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOpenAIState(prev => ({ ...prev, value: e.target.value }));
  };

  const handleAnthropicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAnthropicState(prev => ({ ...prev, value: e.target.value }));
  };

  const toggleOpenAIVisibility = () => {
    setOpenAIState(prev => ({ ...prev, showPassword: !prev.showPassword }));
  };

  const toggleAnthropicVisibility = () => {
    setAnthropicState(prev => ({ ...prev, showPassword: !prev.showPassword }));
  };

  const handleSave = async () => {
    if (!canSave || isSaving) return;

    setIsSaving(true);

    try {
      // Save both API keys
      await invoke('set_openai_api_key', { apiKey: openAIState.value.trim() });
      await invoke('set_claude_api_key', { apiKey: anthropicState.value.trim() });

      // Call onComplete to proceed
      onComplete();
    } catch (error) {
      console.error('[APIKeySetupModal] Failed to save API keys:', error);
      // In production, you might want to show an error toast here
      setIsSaving(false);
    }
  };

  // Tab animation variants
  const tabContentVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 20 : -20,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      },
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 20 : -20,
      opacity: 0,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1],
      },
    }),
  };

  const [[activeTabIndex, direction], setActiveTabIndex] = useState([0, 0]);

  const handleTabChange = (tab: Tab) => {
    const newIndex = tab === 'openai' ? 0 : 1;
    const dir = newIndex > activeTabIndex ? 1 : -1;
    setActiveTabIndex([newIndex, dir]);
    setActiveTab(tab);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - Cannot be dismissed */}
          <motion.div
            variants={modalBackdropVariants.standard}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            variants={modalFormVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div
              className={`${getGlassClasses('strong')} ${getRadiusClass('modal')} w-full max-w-md pointer-events-auto overflow-hidden shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 pb-4 border-b border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    API Keys Required
                  </h2>
                </div>
                <p className="text-sm text-gray-600 ml-11">
                  Configure both API keys to use Taskerino's AI features
                </p>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/20 px-6">
                <button
                  onClick={() => handleTabChange('openai')}
                  className={`flex-1 py-3 text-sm font-medium transition-all relative ${
                    activeTab === 'openai'
                      ? 'text-purple-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  OpenAI
                  {activeTab === 'openai' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-600 to-blue-600"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  {openAIState.isValid && (
                    <Check className="w-4 h-4 text-green-500 absolute top-3 right-4" />
                  )}
                </button>
                <button
                  onClick={() => handleTabChange('anthropic')}
                  className={`flex-1 py-3 text-sm font-medium transition-all relative ${
                    activeTab === 'anthropic'
                      ? 'text-purple-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Anthropic
                  {activeTab === 'anthropic' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-600 to-blue-600"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  {anthropicState.isValid && (
                    <Check className="w-4 h-4 text-green-500 absolute top-3 right-4" />
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6 min-h-[320px]">
                <AnimatePresence mode="wait" custom={direction}>
                  {activeTab === 'openai' && (
                    <motion.div
                      key="openai"
                      custom={direction}
                      variants={tabContentVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="space-y-4"
                    >
                      {/* Heading */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          OpenAI API Key
                        </h3>
                        <p className="text-sm text-gray-600">
                          Used for Whisper transcription and GPT-4o audio analysis
                        </p>
                      </div>

                      {/* Input Field */}
                      <div className="relative">
                        <input
                          type={openAIState.showPassword ? 'text' : 'password'}
                          value={openAIState.value}
                          onChange={handleOpenAIChange}
                          placeholder="sk-..."
                          className={`w-full px-4 pr-20 py-3 ${getGlassClasses('medium')} border ${
                            openAIState.error
                              ? 'border-red-400'
                              : openAIState.isValid
                              ? 'border-green-400'
                              : 'border-white/60'
                          } ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all shadow-sm text-gray-900 placeholder:text-gray-500`}
                        />

                        {/* Visibility Toggle & Validation Indicator */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          {openAIState.value.trim() && (
                            <div className="flex items-center">
                              {openAIState.isValid ? (
                                <Check className="w-5 h-5 text-green-500" />
                              ) : openAIState.error ? (
                                <X className="w-5 h-5 text-red-500" />
                              ) : null}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={toggleOpenAIVisibility}
                            className="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
                            tabIndex={-1}
                          >
                            {openAIState.showPassword ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Error Message */}
                      {openAIState.error && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-red-600"
                        >
                          {openAIState.error}
                        </motion.p>
                      )}

                      {/* Helper Text */}
                      <div className="text-sm text-gray-600 space-y-2">
                        <p>Your API key should start with "sk-"</p>
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 transition-colors"
                        >
                          Get your OpenAI API key
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'anthropic' && (
                    <motion.div
                      key="anthropic"
                      custom={direction}
                      variants={tabContentVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="space-y-4"
                    >
                      {/* Heading */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          Anthropic API Key
                        </h3>
                        <p className="text-sm text-gray-600">
                          Used for Claude Sonnet 4.5 processing and analysis
                        </p>
                      </div>

                      {/* Input Field */}
                      <div className="relative">
                        <input
                          type={anthropicState.showPassword ? 'text' : 'password'}
                          value={anthropicState.value}
                          onChange={handleAnthropicChange}
                          placeholder="sk-ant-..."
                          className={`w-full px-4 pr-20 py-3 ${getGlassClasses('medium')} border ${
                            anthropicState.error
                              ? 'border-red-400'
                              : anthropicState.isValid
                              ? 'border-green-400'
                              : 'border-white/60'
                          } ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all shadow-sm text-gray-900 placeholder:text-gray-500`}
                        />

                        {/* Visibility Toggle & Validation Indicator */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          {anthropicState.value.trim() && (
                            <div className="flex items-center">
                              {anthropicState.isValid ? (
                                <Check className="w-5 h-5 text-green-500" />
                              ) : anthropicState.error ? (
                                <X className="w-5 h-5 text-red-500" />
                              ) : null}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={toggleAnthropicVisibility}
                            className="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
                            tabIndex={-1}
                          >
                            {anthropicState.showPassword ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Error Message */}
                      {anthropicState.error && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-red-600"
                        >
                          {anthropicState.error}
                        </motion.p>
                      )}

                      {/* Helper Text */}
                      <div className="text-sm text-gray-600 space-y-2">
                        <p>Your API key should start with "sk-ant-"</p>
                        <a
                          href="https://console.anthropic.com/settings/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 transition-colors"
                        >
                          Get your Anthropic API key
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="p-6 pt-4 border-t border-white/20">
                <Button
                  onClick={handleSave}
                  disabled={!canSave || isSaving}
                  variant="primary"
                  size="lg"
                  fullWidth
                  className="font-semibold"
                >
                  {isSaving ? 'Saving...' : 'Save & Continue'}
                </Button>

                {!canSave && (
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    Both API keys are required to continue
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

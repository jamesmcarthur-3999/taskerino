import { useState } from 'react';
import { Sparkles, User, Key, CheckCircle2, ArrowRight, ArrowLeft, BookOpen, Zap } from 'lucide-react';
import { Input } from './Input';
import { validateName, validateAnthropicKey, validateOpenAIKey } from '../utils/validation';

interface WelcomeFlowProps {
  onComplete: (name: string, anthropicKey: string, openAIKey: string) => void;
}

export function WelcomeFlow({ onComplete }: WelcomeFlowProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openAIKey, setOpenAIKey] = useState('');
  const [nameError, setNameError] = useState('');
  const [anthropicKeyError, setAnthropicKeyError] = useState('');
  const [openAIKeyError, setOpenAIKeyError] = useState('');

  const handleNext = () => {
    // Step 0: Welcome - no validation needed
    if (step === 0) {
      const validation = validateName(name);
      if (!validation.isValid) {
        setNameError(validation.error || 'Invalid name');
        return;
      }
      setNameError('');
    }

    // Step 1: Validate Anthropic API key
    if (step === 1) {
      const validation = validateAnthropicKey(anthropicKey);
      if (!validation.isValid) {
        setAnthropicKeyError(validation.error || 'Invalid API key');
        return;
      }
      setAnthropicKeyError('');
    }

    // Step 2: Validate OpenAI API key
    if (step === 2) {
      const validation = validateOpenAIKey(openAIKey);
      if (!validation.isValid) {
        setOpenAIKeyError(validation.error || 'Invalid API key');
        return;
      }
      setOpenAIKeyError('');
    }

    // Step 3: Feature overview - no validation needed
    // Step 4: Tutorial - complete onboarding
    if (step === 4) {
      onComplete(name, anthropicKey, openAIKey);
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSkipTutorial = () => {
    onComplete(name, anthropicKey, openAIKey);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-cyan-500/20 backdrop-blur-sm animate-gradient">
      {/* Welcome Card */}
      <div className="w-full max-w-2xl bg-white/40 backdrop-blur-2xl rounded-[32px] shadow-2xl border-2 border-white/60 overflow-hidden animate-scaleIn">
        {/* Progress Indicator */}
        <div className="h-2 bg-gray-200/50 flex">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <div className="p-12">
          {/* Step 0: Welcome & Name */}
          {step === 0 && (
            <div className="space-y-8 animate-fadeIn">
              {/* Logo & Title */}
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-3xl shadow-xl mb-4">
                  <span className="text-4xl font-bold text-white">T</span>
                </div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  Welcome to Taskerino
                </h1>
                <p className="text-xl text-gray-600 max-w-xl mx-auto">
                  Your AI-powered second brain for capturing ideas, organizing notes, and managing tasks effortlessly.
                </p>
              </div>

              {/* Value Props */}
              <div className="grid grid-cols-3 gap-6 py-8">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-100 rounded-2xl mb-2">
                    <Sparkles className="w-6 h-6 text-violet-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">AI-Powered</h3>
                  <p className="text-sm text-gray-600">Claude analyzes and organizes everything</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-cyan-100 rounded-2xl mb-2">
                    <CheckCircle2 className="w-6 h-6 text-cyan-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Auto-Extract Tasks</h3>
                  <p className="text-sm text-gray-600">Never miss an action item</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-2xl mb-2">
                    <User className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Personalized</h3>
                  <p className="text-sm text-gray-600">Learns your preferences over time</p>
                </div>
              </div>

              {/* Name Input */}
              <div className="space-y-3">
                <Input
                  type="text"
                  label="What should we call you?"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && name.trim() && handleNext()}
                  placeholder="Enter your name"
                  helperText="This helps personalize your experience"
                  className="text-lg px-6 py-4"
                  autoFocus
                  error={nameError}
                />
              </div>

              {/* Continue Button */}
              <button
                onClick={handleNext}
                disabled={!name.trim()}
                className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold text-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 1: Anthropic API Key Setup */}
          {step === 1 && (
            <div className="space-y-8 animate-fadeIn">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl shadow-xl mb-4">
                  <Key className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-4xl font-bold text-gray-900">
                  Connect Your AI Assistant
                </h2>
                <p className="text-lg text-gray-600 max-w-xl mx-auto">
                  Taskerino uses Claude AI to understand and organize your notes. You'll need an Anthropic API key to get started.
                </p>
              </div>

              {/* API Key Input */}
              <div className="space-y-3">
                <Input
                  variant="password"
                  label="Anthropic API Key"
                  value={anthropicKey}
                  onChange={(e) => {
                    setAnthropicKey(e.target.value);
                    if (anthropicKeyError) setAnthropicKeyError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && anthropicKey.trim() && handleNext()}
                  placeholder="sk-ant-..."
                  className="text-lg px-6 py-4 font-mono"
                  autoFocus
                  error={anthropicKeyError}
                />
                {!anthropicKeyError && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-0.5">💡</span>
                    <div>
                      <p>Don't have an API key? Get one from{' '}
                        <a
                          href="https://console.anthropic.com/settings/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-600 hover:text-cyan-700 font-semibold underline"
                        >
                          Anthropic Console
                        </a>
                      </p>
                      <p className="mt-1 text-gray-500">Your key is stored locally and never shared.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleBack}
                  className="px-6 py-4 bg-white/60 hover:bg-white/80 backdrop-blur-sm text-gray-700 rounded-2xl font-semibold transition-all flex items-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!anthropicKey.trim()}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold text-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  Next
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: OpenAI API Key Setup */}
          {step === 2 && (
            <div className="space-y-8 animate-fadeIn">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-3xl shadow-xl mb-4">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-4xl font-bold text-gray-900">
                  Add OpenAI for Audio Features
                </h2>
                <p className="text-lg text-gray-600 max-w-xl mx-auto">
                  We use OpenAI for audio transcription (Whisper) and advanced audio analysis in Sessions.
                </p>
              </div>

              {/* API Key Input */}
              <div className="space-y-3">
                <Input
                  variant="password"
                  label="OpenAI API Key"
                  value={openAIKey}
                  onChange={(e) => {
                    setOpenAIKey(e.target.value);
                    if (openAIKeyError) setOpenAIKeyError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && openAIKey.trim() && handleNext()}
                  placeholder="sk-..."
                  className="text-lg px-6 py-4 font-mono"
                  autoFocus
                  error={openAIKeyError}
                />
                {!openAIKeyError && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-0.5">💡</span>
                    <div>
                      <p>Don't have an API key? Get one from{' '}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-600 hover:text-cyan-700 font-semibold underline"
                        >
                          OpenAI Platform
                        </a>
                      </p>
                      <p className="mt-1 text-gray-500">Your key is stored locally and never shared.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleBack}
                  className="px-6 py-4 bg-white/60 hover:bg-white/80 backdrop-blur-sm text-gray-700 rounded-2xl font-semibold transition-all flex items-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!openAIKey.trim()}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold text-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  Next
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Feature Overview */}
          {step === 3 && (
            <div className="space-y-8 animate-fadeIn">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl shadow-xl mb-4">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-4xl font-bold text-gray-900">
                  You're all set, {name}!
                </h2>
                <p className="text-lg text-gray-600 max-w-xl mx-auto">
                  Here's a quick overview of what you can do:
                </p>
              </div>

              {/* Feature Cards */}
              <div className="space-y-4">
                <div className="p-6 bg-white/60 backdrop-blur-sm rounded-2xl border-2 border-white/60">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">📝 Capture Zone</h3>
                  <p className="text-gray-600">
                    Type or paste anything. AI organizes it into notes and extracts tasks automatically. Works in the background while you continue.
                  </p>
                </div>

                <div className="p-6 bg-white/60 backdrop-blur-sm rounded-2xl border-2 border-white/60">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">✅ Smart Tasks</h3>
                  <p className="text-gray-600">
                    Track action items with priorities, due dates, and subtasks. View as a table or Kanban board.
                  </p>
                </div>

                <div className="p-6 bg-white/60 backdrop-blur-sm rounded-2xl border-2 border-white/60">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">📚 Organized Notes</h3>
                  <p className="text-gray-600">
                    Everything auto-organized by company, person, and topic. Search instantly with ⌘K.
                  </p>
                </div>

                <div className="p-6 bg-white/60 backdrop-blur-sm rounded-2xl border-2 border-white/60">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">🤖 Ned Assistant</h3>
                  <p className="text-gray-600">
                    Your AI copilot. Ask questions, create tasks, or search your work with natural language.
                  </p>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleNext}
                className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold text-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600 flex items-center justify-center gap-2"
              >
                Let's Get Started
                <ArrowRight className="w-5 h-5" />
              </button>

              {/* Skip Link */}
              <div className="text-center">
                <button
                  onClick={handleSkipTutorial}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Skip tutorial, take me to the app
                </button>
              </div>
            </div>
          )}

          {/* Step 4: First Capture Tutorial */}
          {step === 4 && (
            <div className="space-y-8 animate-fadeIn">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl shadow-xl mb-4">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-4xl font-bold text-gray-900">
                  Let's Create Your First Note!
                </h2>
                <p className="text-lg text-gray-600 max-w-xl mx-auto">
                  Try typing or pasting anything here - meeting notes, ideas, or tasks.
                </p>
              </div>

              {/* Sample Text Box */}
              <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-200">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Sample Text</h3>
                <p className="text-gray-700 mb-4 leading-relaxed">
                  "Had a great call with Sarah from Acme Corp about the Q2 project. We need to finalize the proposal by Friday and schedule a follow-up next week. Also, need to review their contract terms before signing."
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">I'll automatically:</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Extract action items as tasks</li>
                    <li>• Organize by topic and entity</li>
                    <li>• Create a structured note</li>
                  </ul>
                </div>
              </div>

              {/* Tutorial Buttons */}
              <div className="space-y-4">
                <button
                  onClick={handleSkipTutorial}
                  className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold text-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600 flex items-center justify-center gap-2"
                >
                  Try with Sample Text
                  <Sparkles className="w-5 h-5" />
                </button>

                <div className="text-center">
                  <button
                    onClick={handleSkipTutorial}
                    className="text-sm text-gray-600 hover:text-gray-800 underline"
                  >
                    Skip Tutorial
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Sparkles, User, Key, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

interface WelcomeFlowProps {
  onComplete: (name: string, apiKey: string) => void;
}

export function WelcomeFlow({ onComplete }: WelcomeFlowProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleNext = () => {
    if (step === 1 && !name.trim()) return;
    if (step === 2 && !apiKey.trim()) return;

    if (step === 3) {
      onComplete(name, apiKey);
    } else {
      setStep(step + 1);
    }
  };

  const handleSkipApiKey = () => {
    // Don't allow skipping - API key is required
    return;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-gradient-to-br from-cyan-500/30 via-blue-500/30 to-teal-500/30 backdrop-blur-xl flex items-center justify-center p-6">
      {/* Welcome Card */}
      <div className="w-full max-w-2xl bg-white/80 backdrop-blur-2xl rounded-[2rem] shadow-2xl border-2 border-white/60 overflow-hidden">
        {/* Progress Indicator */}
        <div className="h-2 bg-gray-200/50 flex">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-12">
          {/* Step 1: Welcome & Name */}
          {step === 1 && (
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
                <label className="block text-sm font-semibold text-gray-700">
                  What should we call you?
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && name.trim() && handleNext()}
                  placeholder="Enter your name"
                  className="w-full px-6 py-4 text-lg bg-white/60 backdrop-blur-sm border-2 border-white/60 rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                  autoFocus
                />
                <p className="text-sm text-gray-500">This helps personalize your experience</p>
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

          {/* Step 2: API Key Setup */}
          {step === 2 && (
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
                <label className="block text-sm font-semibold text-gray-700">
                  Anthropic API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && apiKey.trim() && handleNext()}
                    placeholder="sk-ant-..."
                    className="w-full px-6 py-4 pr-24 text-lg bg-white/60 backdrop-blur-sm border-2 border-white/60 rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all font-mono"
                    autoFocus
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-cyan-600 hover:text-cyan-700"
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
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
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-4 bg-white/60 hover:bg-white/80 backdrop-blur-sm text-gray-700 rounded-2xl font-semibold transition-all flex items-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!apiKey.trim()}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold text-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  Continue
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
                    Type or paste anything. AI organizes it into notes and extracts tasks automatically.
                  </p>
                </div>

                <div className="p-6 bg-white/60 backdrop-blur-sm rounded-2xl border-2 border-white/60">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">✅ Smart Tasks</h3>
                  <p className="text-gray-600">
                    Track action items with priorities, due dates, and links back to your notes.
                  </p>
                </div>

                <div className="p-6 bg-white/60 backdrop-blur-sm rounded-2xl border-2 border-white/60">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">📚 Organized Library</h3>
                  <p className="text-gray-600">
                    Everything auto-organized by topic. Search instantly with ⌘K.
                  </p>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleNext}
                className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold text-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600 flex items-center justify-center gap-2"
              >
                Let's Get Started!
                <Sparkles className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

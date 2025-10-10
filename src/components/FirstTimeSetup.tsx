import { useState } from 'react';
import { claudeService } from '../services/claudeService';
import { Key, Sparkles } from 'lucide-react';

interface FirstTimeSetupProps {
  onComplete: () => void;
}

export function FirstTimeSetup({ onComplete }: FirstTimeSetupProps) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!apiKey.trim()) {
      setError('Please enter your API key');
      return;
    }

    if (!apiKey.startsWith('sk-ant-')) {
      setError('Invalid API key format. Should start with sk-ant-');
      return;
    }

    setIsSubmitting(true);

    try {
      // Test the API key with a simple request
      claudeService.setApiKey(apiKey.trim());

      // Save to localStorage
      localStorage.setItem('claude-api-key', apiKey.trim());

      onComplete();
    } catch (err) {
      setError('Failed to validate API key. Please check and try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-cyan-500/20 backdrop-blur-sm">
      <div className="w-full max-w-2xl px-6">
        {/* Welcome Card */}
        <div className="backdrop-blur-xl bg-white/90 rounded-3xl shadow-2xl border border-white/20 p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome to Taskerino</h1>
            <p className="text-gray-600 text-lg">
              AI-powered notes & tasks. Zero friction.
            </p>
          </div>

          {/* API Key Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Key className="w-4 h-4 inline mr-2" />
                Claude API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-lg"
                autoFocus
                disabled={isSubmitting}
              />
              <p className="text-sm text-gray-500 mt-2">
                Get your API key from{' '}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 hover:underline font-medium"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl font-medium text-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isSubmitting ? 'Validating...' : 'Get Started'}
            </button>
          </form>

          {/* Quick Tour */}
          <div className="pt-6 border-t border-gray-200 space-y-4">
            <h3 className="font-semibold text-gray-900 text-center">How it works</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-4 bg-violet-50 rounded-xl">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-violet-100 text-violet-600 rounded-lg mb-2 font-bold">
                  ⌘K
                </div>
                <h4 className="font-medium text-gray-900 mb-1">Command Palette</h4>
                <p className="text-sm text-gray-600">
                  Press ⌘K to search everything instantly
                </p>
              </div>

              <div className="text-center p-4 bg-fuchsia-50 rounded-xl">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-fuchsia-100 text-fuchsia-600 rounded-lg mb-2">
                  ✏️
                </div>
                <h4 className="font-medium text-gray-900 mb-1">Rich Editing</h4>
                <p className="text-sm text-gray-600">
                  Bold, bullets, links—just like Notion
                </p>
              </div>

              <div className="text-center p-4 bg-cyan-50 rounded-xl">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-cyan-100 text-cyan-600 rounded-lg mb-2 font-bold text-sm">
                  ⌘↑↓
                </div>
                <h4 className="font-medium text-gray-900 mb-1">Navigate Zones</h4>
                <p className="text-sm text-gray-600">
                  ⌘+↑/↓ to switch between zones
                </p>
              </div>

              <div className="text-center p-4 bg-green-50 rounded-xl">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-green-100 text-green-600 rounded-lg mb-2">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="font-medium text-gray-900 mb-1">AI Processing</h4>
                <p className="text-sm text-gray-600">
                  Auto-organize notes & extract tasks
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ClaudeChatResponse } from '../types/tauri-ai-commands';
import { Sparkles, RefreshCw } from 'lucide-react';
import { ICON_SIZES } from '../design-system/theme';

interface SarcasticQuoteProps {
  className?: string;
}

export function SarcasticQuote({ className = '' }: SarcasticQuoteProps) {
  const [quote, setQuote] = useState<string>('');
  const [attribution, setAttribution] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);

  const generateQuote = async () => {
    try {
      setIsLoading(true);

      // Check if API key exists
      const savedKey = await invoke<string | null>('get_claude_api_key');
      if (!savedKey) {
        setHasApiKey(false);
        setIsLoading(false);
        return;
      }

      setHasApiKey(true);

      const prompt = `Create one piece of EDGY, sharp, dark humor for tech workers. Make it actually funny - aim for a genuine laugh.

Pick ONE format:
- Fake inspirational quote (absurd attribution)
- Depressing observation about work/tech/life
- Cynical advice
- Satirical take on tech culture

MAKE IT EDGY:
- Reference real controversies, events, companies, tech drama
- Tech layoffs, crypto crashes, AI hype, startup failures, CEO scandals, return-to-office, hustle culture
- Be specific - mention real companies/events when relevant
- Punch UP at corporations/tech bros, not down at people

Rules:
- EDGY and DARK (standup comedy, not HR-approved)
- Adult (18+)
- Max 20 words
- Actually FUNNY, not just clever
- Be creative, don't copy patterns

OUTPUT:
- ONLY the joke - NO preamble, explanation, emoji, commentary
- Format: "Quote" - Attribution OR just statement
- JUST the joke, nothing else

Generate ONE:`;

      const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
        request: {
          model: 'claude-haiku-4-5',
          maxTokens: 100,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          system: 'You are a witty AI that creates darkly humorous inspirational quotes. Be clever and subtle.',
          temperature: 0.9,
        },
      });

      // Parse the response
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? block.text : ''))
        .join('')
        .trim();

      // Extract quote and attribution if it's in quote format
      const quoteMatch = text.match(/^"(.+?)"\s*-\s*(.+)$/);
      if (quoteMatch) {
        setQuote(quoteMatch[1]);
        setAttribution(quoteMatch[2]);
      } else {
        // It's a fact/tip/observation without attribution
        setQuote(text);
        setAttribution(''); // No attribution for facts/tips
      }
    } catch (error) {
      console.error('Failed to generate quote:', error);
      // Use a fallback
      setQuote("Pro Tip: If you stare at your task list long enough, some of it becomes less urgent.");
      setAttribution('');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate quote on mount
  useEffect(() => {
    generateQuote();
  }, []);

  if (!hasApiKey && !isLoading) {
    return null; // Don't show anything if no API key
  }

  return (
    <div className={`text-center mb-8 group ${className}`}>
      <div className="relative inline-block">
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-400 animate-pulse">
            <Sparkles size={ICON_SIZES.sm} className="animate-spin" />
            <span className="text-sm font-medium">Generating wisdom...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3 mb-2">
              <Sparkles size={ICON_SIZES.xs} className="text-cyan-400/70" />
              <p className="text-lg font-medium text-gray-600/80 italic">
                {attribution ? `"${quote}"` : quote}
              </p>
              <Sparkles size={ICON_SIZES.xs} className="text-cyan-400/70" />
            </div>
            {attribution && (
              <p className="text-sm text-gray-500/70 font-light">
                — {attribution}
              </p>
            )}

            {/* Refresh button - appears on hover */}
            <button
              onClick={generateQuote}
              className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-cyan-600 hover:rotate-180 transform transition-transform duration-500"
              aria-label="Generate new quote"
              title="Get a new quote"
            >
              <RefreshCw size={ICON_SIZES.sm} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

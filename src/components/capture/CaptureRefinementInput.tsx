import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';

export interface CaptureRefinementInputProps {
  onSubmit: (message: string) => Promise<void>;
  isLoading: boolean;
}

/**
 * Inline message input for requesting changes to capture results
 * Simple, minimal design - NOT chat-like
 */
export function CaptureRefinementInput({ onSubmit, isLoading }: CaptureRefinementInputProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return;

    const messageToSend = message.trim();
    setMessage(''); // Clear immediately for better UX

    try {
      await onSubmit(messageToSend);
    } catch (error) {
      // Error will be handled by parent component
      console.error('Failed to submit refinement request:', error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full space-y-2">
      <div className="relative flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me to adjust the results..."
          disabled={isLoading}
          className="
            flex-1 px-4 py-2.5
            bg-white/50 dark:bg-zinc-800/50
            border border-zinc-300 dark:border-zinc-600
            rounded-lg
            text-sm text-zinc-900 dark:text-zinc-100
            placeholder:text-zinc-500 dark:placeholder:text-zinc-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
          aria-label="Request changes"
        />

        <button
          onClick={handleSubmit}
          disabled={!message.trim() || isLoading}
          className="
            p-2.5
            bg-blue-500 dark:bg-blue-600
            hover:bg-blue-600 dark:hover:bg-blue-500
            disabled:bg-zinc-300 dark:disabled:bg-zinc-700
            disabled:cursor-not-allowed
            rounded-lg
            text-white
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2
          "
          aria-label={isLoading ? 'Processing...' : 'Send request'}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      {isLoading && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 pl-4">
          Processing your request...
        </p>
      )}
    </div>
  );
}

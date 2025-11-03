import { useState, useRef, type KeyboardEvent, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

export interface CaptureRefinementInputProps {
  onSubmit: (message: string) => Promise<void>;
  isLoading: boolean;
}

/**
 * Inline message input for requesting changes to capture results
 * Simple, minimal design - NOT chat-like
 * Expands as user types, starts compact
 */
export function CaptureRefinementInput({ onSubmit, isLoading }: CaptureRefinementInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  return (
    <div className="inline-flex items-center gap-2">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask me to adjust the results..."
        disabled={isLoading}
        autoFocus
        rows={1}
        className="
          px-4 py-2.5
          bg-white/40 backdrop-blur-sm
          border-2 border-white/60
          rounded-full
          text-sm text-gray-900 font-medium
          placeholder:text-gray-500/70
          focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-300/60
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all
          shadow-md
          resize-none
          overflow-hidden
          min-w-[300px]
          max-w-[500px]
          min-h-[40px]
          max-h-[120px]
          leading-relaxed
        "
        style={{
          lineHeight: '1.5',
        }}
        aria-label="Request changes"
      />

      <button
        onClick={handleSubmit}
        disabled={!message.trim() || isLoading}
        className="
          px-4 py-2.5
          bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500
          hover:from-purple-600 hover:via-pink-600 hover:to-purple-600
          disabled:from-gray-300 disabled:to-gray-400
          disabled:cursor-not-allowed
          rounded-full
          text-white font-semibold text-sm
          transition-all
          shadow-md hover:shadow-lg
          focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2
          flex items-center gap-2
          flex-shrink-0
          h-[40px]
        "
        aria-label={isLoading ? 'Processing...' : 'Send request'}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            <span>Send</span>
          </>
        )}
      </button>
    </div>
  );
}

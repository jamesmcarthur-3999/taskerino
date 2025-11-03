/**
 * AIQuestionBar
 *
 * Displays AI questions to the user and captures text responses.
 * Appears when AI needs clarification via the ask_user_question tool.
 * Features countdown timer and auto-dismiss on timeout.
 *
 * @example
 * ```tsx
 * <AIQuestionBar
 *   sessionId="session-123"
 *   onAnswerSubmit={(answer) => console.log('User answered:', answer)}
 * />
 * ```
 */

import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, Send, Loader2 } from 'lucide-react';
import { getGlassClasses, getInfoGradient } from '@/design-system/theme';
import { LiveSessionEventEmitter } from '@/services/liveSession/events';

interface AIQuestion {
  questionId: string;
  question: string;
  context?: string;
  suggestedAnswers?: string[];
  timeoutSeconds: number;
}

interface AIQuestionBarProps {
  sessionId: string;
  onAnswerSubmit?: (answer: string) => void;
}

export const AIQuestionBar: React.FC<AIQuestionBarProps> = ({
  sessionId,
  onAnswerSubmit
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<AIQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for AI questions (custom event from tool executor)
  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<AIQuestion>;
      const { questionId, question, context, suggestedAnswers, timeoutSeconds } = customEvent.detail;

      setCurrentQuestion({ questionId, question, context, suggestedAnswers, timeoutSeconds });
      setTimeRemaining(timeoutSeconds);
      setAnswer('');

      // Auto-focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    window.addEventListener('ai-question-asked', handler);
    return () => window.removeEventListener('ai-question-asked', handler);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          handleTimeout();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const handleTimeout = () => {
    if (!currentQuestion) return;

    console.log('[AIQuestionBar] Question timed out');

    // Emit timeout event (answer as null)
    LiveSessionEventEmitter.emitUserQuestionAnswered(
      sessionId,
      currentQuestion.questionId,
      currentQuestion.question,
      null // null indicates timeout
    );

    // Clear question
    setCurrentQuestion(null);
    setTimeRemaining(null);
  };

  const handleSubmit = async () => {
    if (!currentQuestion || !answer.trim()) return;

    setIsSubmitting(true);

    try {
      // Emit answer event
      LiveSessionEventEmitter.emitUserQuestionAnswered(
        sessionId,
        currentQuestion.questionId,
        currentQuestion.question,
        answer.trim()
      );

      // Call callback
      onAnswerSubmit?.(answer.trim());

      // Clear question
      setCurrentQuestion(null);
      setTimeRemaining(null);
      setAnswer('');
    } catch (error) {
      console.error('[AIQuestionBar] Failed to submit answer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickReply = (suggestedAnswer: string) => {
    setAnswer(suggestedAnswer);
    // Auto-submit after a brief delay
    setTimeout(() => {
      handleSubmit();
    }, 100);
  };

  const handleDismiss = () => {
    if (!currentQuestion) return;

    // Emit empty answer (skip)
    LiveSessionEventEmitter.emitUserQuestionAnswered(
      sessionId,
      currentQuestion.questionId,
      currentQuestion.question,
      '' // empty string indicates skip
    );

    // Clear question
    setCurrentQuestion(null);
    setTimeRemaining(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      handleDismiss();
    }
  };

  // Don't render if no question
  if (!currentQuestion) return null;

  return (
    <div
      className={`${getInfoGradient('light').container} rounded-2xl p-4 border-2 border-cyan-400/60 animate-in slide-in-from-top duration-300`}
      role="dialog"
      aria-labelledby="ai-question-text"
      aria-live="assertive"
    >
      {/* Question Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0">
          <HelpCircle className="text-cyan-600" size={24} />
        </div>
        <div className="flex-1">
          <p id="ai-question-text" className="font-medium text-gray-900 mb-1">
            {currentQuestion.question}
          </p>
          {currentQuestion.context && (
            <p className="text-sm text-gray-600">{currentQuestion.context}</p>
          )}
        </div>
        {timeRemaining !== null && (
          <div
            className="flex-shrink-0 px-2 py-1 bg-white/60 rounded-lg text-xs font-mono text-gray-700"
            aria-label={`${timeRemaining} seconds remaining`}
          >
            {timeRemaining}s
          </div>
        )}
      </div>

      {/* Suggested Answers (Quick Reply) */}
      {currentQuestion.suggestedAnswers && currentQuestion.suggestedAnswers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {currentQuestion.suggestedAnswers.map((suggested, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickReply(suggested)}
              className={`px-3 py-1.5 ${getGlassClasses(
                'medium'
              )} hover:bg-cyan-100 rounded-lg text-sm font-medium text-gray-700 transition-colors`}
              disabled={isSubmitting}
            >
              {suggested}
            </button>
          ))}
        </div>
      )}

      {/* Text Input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer..."
          className={`flex-1 px-3 py-2 ${getGlassClasses(
            'subtle'
          )} border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent`}
          disabled={isSubmitting}
          autoFocus
          aria-label="Answer input"
        />
        <button
          onClick={handleSubmit}
          disabled={!answer.trim() || isSubmitting}
          className={`px-4 py-2 ${getInfoGradient(
            'strong'
          ).container} text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center gap-2`}
          aria-label="Submit answer"
        >
          {isSubmitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
        <button
          onClick={handleDismiss}
          className="px-4 py-2 bg-white/60 text-gray-700 rounded-lg font-medium hover:bg-white/80 transition-colors"
          disabled={isSubmitting}
          aria-label="Skip question"
        >
          Skip
        </button>
      </div>
    </div>
  );
};

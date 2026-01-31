// src/bots/hooks/useNed.ts
import { useState, useCallback, useRef } from 'react';
import {
  sendMessageToNed,
  createConversation,
  clearConversation,
  type NedConfig,
  type NedStreamHandler
} from '../ned-assistant';
import type { BaleybotStreamEvent } from '@baleybots/core';

export interface NedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: Array<{ name: string; arguments: unknown; result?: unknown }>;
}

export interface UseNedOptions {
  config: Omit<NedConfig, 'dispatch'>;
  dispatch: NedConfig['dispatch'];
  onToolCall?: (toolName: string, args: unknown) => void;
  onToolResult?: (toolName: string, result: unknown) => void;
}

export interface UseNedReturn {
  messages: NedMessage[];
  isLoading: boolean;
  streamingContent: string;
  sendMessage: (message: string) => Promise<void>;
  clearHistory: () => void;
  conversationId: string;
}

export function useNed(options: UseNedOptions): UseNedReturn {
  const [messages, setMessages] = useState<NedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const conversationIdRef = useRef(createConversation());
  const toolCallsRef = useRef<NedMessage['toolCalls']>([]);

  const sendMessage = useCallback(async (message: string) => {
    const userMessage: NedMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingContent('');
    toolCallsRef.current = [];

    const config: NedConfig = {
      ...options.config,
      dispatch: options.dispatch,
    };

    const handleStream: NedStreamHandler = (event: BaleybotStreamEvent) => {
      switch (event.type) {
        case 'text_delta':
          if ('content' in event) {
            setStreamingContent(prev => prev + event.content);
          }
          break;
        case 'tool_execution_start':
          if ('toolName' in event && 'arguments' in event) {
            options.onToolCall?.(event.toolName, event.arguments);
            toolCallsRef.current?.push({
              name: event.toolName,
              arguments: event.arguments
            });
          }
          break;
        case 'tool_execution_output':
          if ('toolName' in event && 'result' in event) {
            options.onToolResult?.(event.toolName, event.result);
            const existing = toolCallsRef.current?.find(tc => tc.name === event.toolName);
            if (existing) {
              existing.result = event.result;
            }
          }
          break;
      }
    };

    try {
      const response = await sendMessageToNed(
        message,
        conversationIdRef.current,
        config,
        handleStream
      );

      const assistantMessage: NedMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        toolCalls: toolCallsRef.current?.length ? [...toolCallsRef.current] : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: NedMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  }, [options]);

  const clearHistory = useCallback(() => {
    clearConversation(conversationIdRef.current);
    conversationIdRef.current = createConversation();
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    streamingContent,
    sendMessage,
    clearHistory,
    conversationId: conversationIdRef.current,
  };
}

/**
 * API Key Validation Utilities
 * 
 * Provides validation functions for different AI provider API keys
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate OpenAI API key format
 * OpenAI keys start with 'sk-' and are typically 48+ characters
 */
export function validateOpenAIKey(key: string): ValidationResult {
  if (!key || key.trim().length === 0) {
    return {
      isValid: false,
      error: 'API key is required',
    };
  }

  const trimmedKey = key.trim();

  if (!trimmedKey.startsWith('sk-')) {
    return {
      isValid: false,
      error: 'OpenAI API key must start with "sk-"',
    };
  }

  if (trimmedKey.length < 40) {
    return {
      isValid: false,
      error: 'API key is too short (must be at least 40 characters)',
    };
  }

  return { isValid: true };
}

/**
 * Validate Anthropic API key format
 * Anthropic keys start with 'sk-ant-' and are typically 100+ characters
 */
export function validateAnthropicKey(key: string): ValidationResult {
  if (!key || key.trim().length === 0) {
    return {
      isValid: false,
      error: 'API key is required',
    };
  }

  const trimmedKey = key.trim();

  if (!trimmedKey.startsWith('sk-ant-')) {
    return {
      isValid: false,
      error: 'Anthropic API key must start with "sk-ant-"',
    };
  }

  if (trimmedKey.length < 40) {
    return {
      isValid: false,
      error: 'API key is too short',
    };
  }

  return { isValid: true };
}

/**
 * Validate user name input
 */
export function validateName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return {
      isValid: false,
      error: 'Name is required',
    };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    return {
      isValid: false,
      error: 'Name must be at least 2 characters',
    };
  }

  if (trimmedName.length > 30) {
    return {
      isValid: false,
      error: 'Name must be between 2 and 30 characters',
    };
  }

  return { isValid: true };
}

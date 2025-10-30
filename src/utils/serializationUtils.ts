/**
 * serializationUtils.ts
 *
 * Safe JSON serialization utilities to prevent circular references,
 * undefined values, and non-serializable data from breaking storage operations.
 *
 * Used by storage adapters to ensure all data can be safely persisted.
 */

/**
 * Result of serialization validation
 */
export interface SerializationValidation {
  isValid: boolean;
  error?: string;
  sanitizedData?: any;
  warnings: string[];
}

/**
 * Options for deep sanitization
 */
export interface SanitizationOptions {
  maxDepth?: number;           // Max recursion depth (default: 50)
  removeUndefined?: boolean;   // Convert undefined to null (default: true)
  removeFunctions?: boolean;   // Remove function properties (default: true)
  removeSymbols?: boolean;     // Remove symbol properties (default: true)
  detectCircular?: boolean;    // Detect and break circular refs (default: true)
  logWarnings?: boolean;       // Log warnings to console (default: true)
}

const DEFAULT_OPTIONS: Required<SanitizationOptions> = {
  maxDepth: 50,
  removeUndefined: true,
  removeFunctions: true,
  removeSymbols: true,
  detectCircular: true,
  logWarnings: true,
};

/**
 * Test if a value can be serialized to JSON
 *
 * @param value - Value to test
 * @returns Validation result with errors and warnings
 */
export function validateSerialization(value: any): SerializationValidation {
  const warnings: string[] = [];

  try {
    // Test basic serialization
    const jsonString = JSON.stringify(value);

    // Check if stringify returned undefined (non-serializable)
    if (jsonString === undefined) {
      return {
        isValid: false,
        error: 'JSON.stringify returned undefined - value is not serializable',
        warnings,
      };
    }

    // Try to parse back (round-trip test)
    const parsed = JSON.parse(jsonString);

    return {
      isValid: true,
      sanitizedData: parsed,
      warnings,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : String(error),
      warnings,
    };
  }
}

/**
 * Deep sanitize an object to make it JSON-serializable
 *
 * Removes:
 * - Circular references (replaces with "[Circular]")
 * - Functions (removes property)
 * - Symbols (removes property)
 * - Undefined values (converts to null or removes)
 *
 * @param obj - Object to sanitize
 * @param options - Sanitization options
 * @returns Sanitized copy of object
 */
export function deepSanitize<T = any>(
  obj: T,
  options: SanitizationOptions = {}
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const warnings: string[] = [];
  const seen = new WeakSet<object>();

  function sanitizeValue(value: any, path: string, depth: number): any {
    // Max depth check
    if (depth > opts.maxDepth) {
      const warning = `Max depth (${opts.maxDepth}) exceeded at path: ${path}`;
      warnings.push(warning);
      if (opts.logWarnings) {
        console.warn('[SerializationUtils]', warning);
      }
      return '[MaxDepth]';
    }

    // Null and primitives
    if (value === null || value === undefined) {
      if (value === undefined && opts.removeUndefined) {
        return null;
      }
      return value;
    }

    // Primitives (string, number, boolean)
    if (typeof value !== 'object' && typeof value !== 'function') {
      return value;
    }

    // Functions
    if (typeof value === 'function') {
      if (opts.removeFunctions) {
        const warning = `Removed function at path: ${path}`;
        warnings.push(warning);
        if (opts.logWarnings) {
          console.warn('[SerializationUtils]', warning);
        }
        return undefined; // Will be filtered out
      }
      return '[Function]';
    }

    // Dates (preserve as ISO string)
    if (value instanceof Date) {
      return value.toISOString();
    }

    // RegExp (preserve as string)
    if (value instanceof RegExp) {
      return value.toString();
    }

    // Arrays
    if (Array.isArray(value)) {
      // Circular check
      if (opts.detectCircular && seen.has(value)) {
        const warning = `Circular reference detected (array) at path: ${path}`;
        warnings.push(warning);
        if (opts.logWarnings) {
          console.warn('[SerializationUtils]', warning);
        }
        return '[Circular]';
      }

      if (opts.detectCircular) {
        seen.add(value);
      }

      const sanitized = value
        .map((item, index) => sanitizeValue(item, `${path}[${index}]`, depth + 1))
        .filter((item) => item !== undefined); // Remove undefined values

      return sanitized;
    }

    // Objects
    if (typeof value === 'object') {
      // Circular check
      if (opts.detectCircular && seen.has(value)) {
        const warning = `Circular reference detected (object) at path: ${path}`;
        warnings.push(warning);
        if (opts.logWarnings) {
          console.warn('[SerializationUtils]', warning);
        }
        return '[Circular]';
      }

      if (opts.detectCircular) {
        seen.add(value);
      }

      const sanitized: any = {};

      for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          continue;
        }

        // Symbol keys
        if (typeof key === 'symbol' && opts.removeSymbols) {
          const warning = `Removed symbol property at path: ${path}`;
          warnings.push(warning);
          if (opts.logWarnings) {
            console.warn('[SerializationUtils]', warning);
          }
          continue;
        }

        const propertyValue = value[key as keyof typeof value];
        const sanitizedValue = sanitizeValue(propertyValue, `${path}.${key}`, depth + 1);

        // Skip undefined values (functions that were removed)
        if (sanitizedValue !== undefined) {
          sanitized[key] = sanitizedValue;
        }
      }

      return sanitized;
    }

    // Fallback for unknown types
    const warning = `Unknown type at path ${path}: ${typeof value}`;
    warnings.push(warning);
    if (opts.logWarnings) {
      console.warn('[SerializationUtils]', warning);
    }
    return '[Unknown]';
  }

  const sanitized = sanitizeValue(obj, 'root', 0);

  // Log summary if warnings occurred
  if (warnings.length > 0 && opts.logWarnings) {
    console.warn(
      `[SerializationUtils] Sanitized object with ${warnings.length} warning(s)`,
      { warnings: warnings.slice(0, 5) } // Show first 5 warnings
    );
  }

  return sanitized;
}

/**
 * Safe JSON stringify with automatic sanitization
 *
 * @param value - Value to stringify
 * @param options - Sanitization options
 * @returns JSON string or throws with detailed error
 */
export function safeStringify(
  value: any,
  options: SanitizationOptions = {}
): string {
  // First attempt: Try standard JSON.stringify
  try {
    const result = JSON.stringify(value);
    if (result === undefined) {
      throw new Error('JSON.stringify returned undefined');
    }
    return result;
  } catch (error) {
    // Failed - sanitize and retry
    console.warn(
      '[SerializationUtils] Initial stringify failed, attempting sanitization:',
      error instanceof Error ? error.message : String(error)
    );

    try {
      const sanitized = deepSanitize(value, options);
      const result = JSON.stringify(sanitized);

      if (result === undefined) {
        throw new Error('JSON.stringify returned undefined even after sanitization');
      }

      console.log('[SerializationUtils] Sanitization successful');
      return result;
    } catch (sanitizationError) {
      // Both failed - throw detailed error
      throw new Error(
        `Failed to stringify value even after sanitization. ` +
        `Original error: ${error instanceof Error ? error.message : String(error)}. ` +
        `Sanitization error: ${sanitizationError instanceof Error ? sanitizationError.message : String(sanitizationError)}. ` +
        `Value type: ${typeof value}, ` +
        `Value constructor: ${value?.constructor?.name || 'unknown'}`
      );
    }
  }
}

/**
 * Safe JSON parse with validation
 *
 * @param jsonString - JSON string to parse
 * @returns Parsed object or throws error
 */
export function safeParse<T = any>(jsonString: string): T {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}. ` +
      `String preview: ${jsonString.substring(0, 100)}...`
    );
  }
}

/**
 * Sanitize session metadata specifically
 *
 * Handles common problematic fields in SessionMetadata:
 * - enrichmentStatus (may have circular refs)
 * - enrichmentLock (may have functions/promises)
 * - enrichmentConfig (may have non-serializable data)
 * - video object (may have complex nested data)
 *
 * @param metadata - Session metadata to sanitize
 * @returns Sanitized copy
 */
export function sanitizeSessionMetadata<T extends Record<string, any>>(
  metadata: T
): T {
  const sanitized = deepSanitize(metadata, {
    maxDepth: 50,
    removeUndefined: true,
    removeFunctions: true,
    removeSymbols: true,
    detectCircular: true,
    logWarnings: true,
  });

  // Additional validation for specific fields
  if ('enrichmentLock' in sanitized) {
    const lock = (sanitized as any).enrichmentLock;
    if (lock && typeof lock === 'object' && lock !== null) {
      (sanitized as any).enrichmentLock = {
        locked: Boolean(lock.locked),
        lockedBy: lock.lockedBy || null,
        lockedAt: lock.lockedAt || null,
      };
    }
  }

  return sanitized;
}

/**
 * Test if an object is JSON-safe (no need for sanitization)
 *
 * @param obj - Object to test
 * @returns True if object can be safely stringified
 */
export function isJSONSafe(obj: any): boolean {
  const validation = validateSerialization(obj);
  return validation.isValid;
}

/**
 * Get detailed information about why an object is not JSON-safe
 *
 * @param obj - Object to analyze
 * @returns Array of issues found
 */
export function diagnoseJSONIssues(obj: any): string[] {
  const issues: string[] = [];
  const seen = new WeakSet<object>();

  function diagnoseValue(value: any, path: string, depth: number): void {
    if (depth > 50) {
      issues.push(`Max depth exceeded at: ${path}`);
      return;
    }

    if (value === null || value === undefined) {
      if (value === undefined) {
        issues.push(`undefined value at: ${path}`);
      }
      return;
    }

    if (typeof value === 'function') {
      issues.push(`function at: ${path}`);
      return;
    }

    if (typeof value === 'symbol') {
      issues.push(`symbol at: ${path}`);
      return;
    }

    if (typeof value !== 'object') {
      return;
    }

    // Circular check
    if (seen.has(value)) {
      issues.push(`circular reference at: ${path}`);
      return;
    }
    seen.add(value);

    // Arrays
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        diagnoseValue(item, `${path}[${index}]`, depth + 1);
      });
      return;
    }

    // Objects
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        diagnoseValue(value[key], `${path}.${key}`, depth + 1);
      }
    }
  }

  diagnoseValue(obj, 'root', 0);
  return issues;
}

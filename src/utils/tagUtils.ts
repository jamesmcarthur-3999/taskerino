/**
 * Tag Utility Functions
 *
 * Provides consistent tag management across all zones including normalization,
 * validation, and immutable array operations for adding/removing tags.
 */

/**
 * Normalizes a tag by converting to lowercase and trimming whitespace.
 *
 * @param tag - The tag string to normalize
 * @returns The normalized tag string
 *
 * @example
 * ```typescript
 * normalize("  Work  ") // "work"
 * normalize("URGENT") // "urgent"
 * ```
 */
function normalize(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Validates a tag against validation rules and checks for duplicates.
 *
 * Validation Rules:
 * - Minimum length: 1 character (after trim)
 * - Maximum length: 50 characters
 * - Only alphanumeric characters, hyphens, and underscores allowed
 * - Must not be a duplicate (case-insensitive)
 *
 * @param tag - The tag to validate
 * @param existingTags - Array of existing tags to check for duplicates
 * @returns true if the tag is valid and not a duplicate, false otherwise
 *
 * @example
 * ```typescript
 * validate("work", ["personal"]) // true
 * validate("WORK", ["work"]) // false (duplicate)
 * validate("", []) // false (empty)
 * validate("a".repeat(51), []) // false (too long)
 * validate("invalid tag!", []) // false (special chars)
 * ```
 */
function validate(tag: string, existingTags: string[]): boolean {
  const normalized = normalize(tag);

  // Check minimum length
  if (normalized.length === 0) {
    return false;
  }

  // Check maximum length
  if (normalized.length > 50) {
    return false;
  }

  // Check for valid characters (alphanumeric, hyphens, underscores)
  const validPattern = /^[a-z0-9_-]+$/;
  if (!validPattern.test(normalized)) {
    return false;
  }

  // Check for duplicates (case-insensitive)
  if (includes(normalized, existingTags)) {
    return false;
  }

  return true;
}

/**
 * Adds a tag to an array of tags, returning a new array.
 * Normalizes the tag before adding and prevents duplicates.
 *
 * @param tag - The tag to add
 * @param existingTags - The current array of tags
 * @returns A new array with the tag added, or the original array if invalid/duplicate
 *
 * @example
 * ```typescript
 * add("work", ["personal"]) // ["personal", "work"]
 * add("WORK", ["work"]) // ["work"] (duplicate, unchanged)
 * add("", ["work"]) // ["work"] (invalid, unchanged)
 * ```
 */
function add(tag: string, existingTags: string[]): string[] {
  const normalized = normalize(tag);

  // Validate before adding
  if (!validate(tag, existingTags)) {
    return existingTags;
  }

  // Return new array with added tag
  return [...existingTags, normalized];
}

/**
 * Removes a tag from an array of tags, returning a new array.
 * Uses case-insensitive matching to find and remove the tag.
 *
 * @param tag - The tag to remove
 * @param existingTags - The current array of tags
 * @returns A new array with the tag removed
 *
 * @example
 * ```typescript
 * remove("work", ["work", "personal"]) // ["personal"]
 * remove("WORK", ["work", "personal"]) // ["personal"] (case-insensitive)
 * remove("nonexistent", ["work"]) // ["work"] (unchanged)
 * ```
 */
function remove(tag: string, existingTags: string[]): string[] {
  const normalized = normalize(tag);
  return existingTags.filter(
    existingTag => normalize(existingTag) !== normalized
  );
}

/**
 * Checks if a tag exists in an array of tags (case-insensitive).
 *
 * @param tag - The tag to search for
 * @param tags - The array of tags to search in
 * @returns true if the tag exists (case-insensitive), false otherwise
 *
 * @example
 * ```typescript
 * includes("work", ["work", "personal"]) // true
 * includes("WORK", ["work", "personal"]) // true (case-insensitive)
 * includes("urgent", ["work", "personal"]) // false
 * ```
 */
function includes(tag: string, tags: string[]): boolean {
  const normalized = normalize(tag);
  return tags.some(existingTag => normalize(existingTag) === normalized);
}

/**
 * Filters items by selected tags using AND logic.
 * An item must have ALL selected tags to be included in the result.
 * Uses case-insensitive tag matching.
 *
 * @param items - Array of items to filter
 * @param selectedTags - Array of tags that items must match (AND logic)
 * @param getItemTags - Function to extract tags from an item
 * @returns Filtered array of items that have all selected tags
 *
 * @example
 * ```typescript
 * const tasks = [
 *   { id: 1, tags: ["work", "urgent"] },
 *   { id: 2, tags: ["work"] },
 *   { id: 3, tags: ["personal"] }
 * ];
 *
 * filterByTags(tasks, ["work"], task => task.tags)
 * // [{ id: 1, tags: ["work", "urgent"] }, { id: 2, tags: ["work"] }]
 *
 * filterByTags(tasks, ["work", "urgent"], task => task.tags)
 * // [{ id: 1, tags: ["work", "urgent"] }]
 *
 * filterByTags(tasks, [], task => task.tags)
 * // [{ id: 1, tags: ["work", "urgent"] }, { id: 2, tags: ["work"] }, { id: 3, tags: ["personal"] }]
 * ```
 */
function filterByTags<T>(
  items: T[],
  selectedTags: string[],
  getItemTags: (item: T) => string[]
): T[] {
  // If no tags selected, return all items
  if (selectedTags.length === 0) {
    return items;
  }

  // Normalize selected tags for comparison
  const normalizedSelectedTags = selectedTags.map(normalize);

  // Filter items that have ALL selected tags (AND logic)
  return items.filter(item => {
    const itemTags = getItemTags(item).map(normalize);

    // Check if item has all selected tags
    return normalizedSelectedTags.every(selectedTag =>
      itemTags.includes(selectedTag)
    );
  });
}

/**
 * Get all unique tags from items with their frequency counts.
 * Returns tags sorted by frequency (descending).
 *
 * @param items - Array of items to extract tags from
 * @param getItemTags - Function to extract tags from an item
 * @returns Array of { tag, count } objects sorted by count (descending)
 *
 * @example
 * ```typescript
 * const tasks = [
 *   { tags: ["work", "urgent"] },
 *   { tags: ["work"] },
 *   { tags: ["personal"] }
 * ];
 *
 * getTagsWithFrequency(tasks, task => task.tags || [])
 * // [{ tag: "work", count: 2 }, { tag: "urgent", count: 1 }, { tag: "personal", count: 1 }]
 * ```
 */
function getTagsWithFrequency<T>(
  items: T[],
  getItemTags: (item: T) => string[]
): Array<{ tag: string; count: number }> {
  const tagCounts = new Map<string, number>();

  items.forEach(item => {
    const tags = getItemTags(item);
    if (tags && tags.length > 0) {
      tags.forEach(tag => {
        const normalized = normalize(tag);
        tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
      });
    }
  });

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get top N tags by frequency.
 *
 * @param items - Array of items to extract tags from
 * @param getItemTags - Function to extract tags from an item
 * @param limit - Maximum number of tags to return (default: 8)
 * @returns Array of top tags (by frequency)
 *
 * @example
 * ```typescript
 * getTopTags(tasks, task => task.tags || [], 5)
 * // ["work", "urgent", "personal", "bug", "feature"]
 * ```
 */
function getTopTags<T>(
  items: T[],
  getItemTags: (item: T) => string[],
  limit: number = 8
): string[] {
  return getTagsWithFrequency(items, getItemTags)
    .slice(0, limit)
    .map(({ tag }) => tag);
}

/**
 * Get tag suggestions based on existing tags (excludes already selected tags).
 *
 * @param items - Array of items to extract tags from
 * @param getItemTags - Function to extract tags from an item
 * @param currentTags - Tags that are already selected (to exclude from suggestions)
 * @param limit - Maximum number of suggestions to return (default: 5)
 * @returns Array of suggested tags
 *
 * @example
 * ```typescript
 * getTagSuggestions(tasks, task => task.tags || [], ["work"], 3)
 * // ["urgent", "personal", "bug"]
 * ```
 */
function getTagSuggestions<T>(
  items: T[],
  getItemTags: (item: T) => string[],
  currentTags: string[] = [],
  limit: number = 5
): string[] {
  const normalizedCurrent = currentTags.map(normalize);
  const allTags = getTagsWithFrequency(items, getItemTags);

  return allTags
    .filter(({ tag }) => !normalizedCurrent.includes(normalize(tag)))
    .slice(0, limit)
    .map(({ tag }) => tag);
}

/**
 * Tag utility functions for consistent tag management across all zones.
 *
 * Features:
 * - Consistent normalization (lowercase + trim)
 * - Duplicate prevention (case-insensitive)
 * - Validation (length, characters, duplicates)
 * - Immutable add/remove operations
 * - Case-insensitive filtering
 * - Frequency analysis and suggestions
 */
export const tagUtils = {
  normalize,
  validate,
  add,
  remove,
  includes,
  filterByTags,
  getTagsWithFrequency,
  getTopTags,
  getTagSuggestions,
};

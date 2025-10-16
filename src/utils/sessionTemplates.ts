/**
 * Session Template Management
 *
 * Handles storage, retrieval, and management of session templates
 * Templates allow users to quickly start sessions with predefined configurations
 */

export interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  screenshotInterval: number; // in minutes
  enableScreenshots: boolean; // Enable/disable screenshot capture
  audioRecording: boolean;
  videoRecording?: boolean;
  tags: string[];
  isDefault: boolean; // Default templates cannot be deleted
}

const STORAGE_KEY = 'taskerino:session-templates';

/**
 * Get default templates that ship with the app
 */
export function getDefaultTemplates(): SessionTemplate[] {
  return [
    {
      id: 'deep-work',
      name: 'Deep Work',
      description: 'Long focused session with minimal interruptions',
      icon: '🎯',
      screenshotInterval: 2,
      enableScreenshots: true,
      audioRecording: false,
      videoRecording: false,
      tags: ['deep-work', 'focus'],
      isDefault: true,
    },
    {
      id: 'quick-task',
      name: 'Quick Task',
      description: 'Short task with frequent capture',
      icon: '⚡',
      screenshotInterval: 0.5,
      enableScreenshots: true,
      audioRecording: false,
      videoRecording: false,
      tags: ['quick', 'task'],
      isDefault: true,
    },
    {
      id: 'meeting-notes',
      name: 'Meeting Notes',
      description: 'Meeting session with audio recording',
      icon: '📝',
      screenshotInterval: 1,
      enableScreenshots: true,
      audioRecording: true,
      videoRecording: false,
      tags: ['meeting', 'notes'],
      isDefault: true,
    },
    {
      id: 'design-session',
      name: 'Design Session',
      description: 'Creative work with moderate capture rate',
      icon: '🎨',
      screenshotInterval: 3,
      enableScreenshots: true,
      audioRecording: false,
      videoRecording: false,
      tags: ['design', 'creative'],
      isDefault: true,
    },
    {
      id: 'debugging',
      name: 'Debugging',
      description: 'Frequent capture with audio recording',
      icon: '🔬',
      screenshotInterval: 0.5,
      enableScreenshots: true,
      audioRecording: true,
      videoRecording: false,
      tags: ['debugging', 'coding'],
      isDefault: true,
    },
    {
      id: 'audio-only-meeting',
      name: 'Audio Meeting',
      description: 'Meeting or conversation with audio recording only',
      icon: '🎙️',
      screenshotInterval: 0, // Not used when screenshots disabled
      enableScreenshots: false,
      audioRecording: true,
      videoRecording: false,
      tags: ['meeting', 'audio-only'],
      isDefault: true,
    },
  ];
}

/**
 * Load all templates (default + custom) from localStorage
 */
export function getTemplates(): SessionTemplate[] {
  const defaultTemplates = getDefaultTemplates();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultTemplates;
    }

    const customTemplates: SessionTemplate[] = JSON.parse(stored);

    // Combine default templates with custom ones
    // Default templates always come first
    return [...defaultTemplates, ...customTemplates];
  } catch (error) {
    console.error('Failed to load session templates:', error);
    return defaultTemplates;
  }
}

/**
 * Get a single template by ID
 */
export function getTemplate(id: string): SessionTemplate | undefined {
  const templates = getTemplates();
  return templates.find(t => t.id === id);
}

/**
 * Save a new custom template
 */
export function saveTemplate(template: Omit<SessionTemplate, 'id' | 'isDefault'>): SessionTemplate {
  try {
    const templates = getTemplates();

    // Generate unique ID
    const id = `custom-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const newTemplate: SessionTemplate = {
      ...template,
      id,
      isDefault: false,
    };

    // Get only custom templates (exclude defaults)
    const customTemplates = templates.filter(t => !t.isDefault);

    // Add new template
    customTemplates.push(newTemplate);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));

    console.log('✅ Template saved:', newTemplate.name);
    return newTemplate;
  } catch (error) {
    console.error('❌ Failed to save template:', error);
    throw new Error('Failed to save template. Storage may be full.');
  }
}

/**
 * Update an existing custom template
 */
export function updateTemplate(id: string, updates: Partial<Omit<SessionTemplate, 'id' | 'isDefault'>>): boolean {
  try {
    const templates = getTemplates();
    const template = templates.find(t => t.id === id);

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.isDefault) {
      throw new Error('Cannot update default templates');
    }

    // Get only custom templates
    const customTemplates = templates.filter(t => !t.isDefault);

    // Update the template
    const updatedTemplates = customTemplates.map(t =>
      t.id === id ? { ...t, ...updates } : t
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTemplates));

    console.log('✅ Template updated:', template.name);
    return true;
  } catch (error) {
    console.error('❌ Failed to update template:', error);
    return false;
  }
}

/**
 * Delete a custom template
 */
export function deleteTemplate(id: string): boolean {
  try {
    const templates = getTemplates();
    const template = templates.find(t => t.id === id);

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.isDefault) {
      throw new Error('Cannot delete default templates');
    }

    // Get only custom templates and remove the specified one
    const customTemplates = templates.filter(t => !t.isDefault && t.id !== id);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));

    console.log('✅ Template deleted:', template.name);
    return true;
  } catch (error) {
    console.error('❌ Failed to delete template:', error);
    return false;
  }
}

/**
 * Check if a template name already exists
 */
export function templateNameExists(name: string, excludeId?: string): boolean {
  const templates = getTemplates();
  return templates.some(t =>
    t.name.toLowerCase() === name.toLowerCase() &&
    t.id !== excludeId
  );
}

/**
 * Get recently used templates (sorted by usage count)
 * This could be expanded to track usage in the future
 */
export function getRecentTemplates(limit: number = 3): SessionTemplate[] {
  // For now, just return the first few templates
  // In future, this could track actual usage from localStorage
  const templates = getTemplates();
  return templates.slice(0, limit);
}

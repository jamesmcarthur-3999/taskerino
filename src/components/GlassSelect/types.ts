import type { LucideProps } from 'lucide-react';

export interface GlassSelectOption<T = string> {
  value: T;
  label: string;
  icon?: React.ComponentType<LucideProps>;
  description?: string;
  disabled?: boolean;
  badge?: string | number;
}

export interface GlassSelectProps<T = string> {
  // Core functionality
  value: T;
  options: GlassSelectOption<T>[];
  onChange: (value: T) => void;

  // Display
  label?: string;
  placeholder?: string;
  variant?: 'primary' | 'secondary' | 'compact' | 'filter';

  // Visual customization
  showLabel?: boolean;
  showChevron?: boolean;
  triggerIcon?: React.ComponentType<LucideProps>;

  // Behavior
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  closeOnSelect?: boolean;

  // Layout
  menuPosition?: 'left' | 'right' | 'auto';
  menuWidth?: 'trigger' | 'content' | number;
  maxHeight?: number;

  // Advanced
  renderOption?: (option: GlassSelectOption<T>) => React.ReactNode;
  renderTrigger?: (selected: GlassSelectOption<T> | null) => React.ReactNode;

  // Styling
  className?: string;
  menuClassName?: string;
}

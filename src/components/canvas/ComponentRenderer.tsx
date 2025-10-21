/**
 * ComponentRenderer
 *
 * Core engine that interprets AI-generated JSON and renders React components.
 * Maps component types to React components and handles recursive rendering.
 */

import React from 'react';
import type { ComponentTree, ComponentType } from './types';
import { CANVAS_COMPONENTS } from '../../design-system/theme';

// Import primitive components (to be built in Phase 2+)
import { CanvasStack } from './primitives/CanvasStack';
import { CanvasGrid } from './primitives/CanvasGrid';
import { CanvasCard } from './primitives/CanvasCard';
import { CanvasTabs } from './primitives/CanvasTabs';
import { CanvasAccordion } from './primitives/CanvasAccordion';
import { CanvasHeading } from './primitives/CanvasHeading';
import { CanvasText } from './primitives/CanvasText';
import { CanvasBadge } from './primitives/CanvasBadge';
import { CanvasSeparator } from './primitives/CanvasSeparator';
import { CanvasList } from './primitives/CanvasList';
import { CanvasTimeline } from './primitives/CanvasTimeline';
import { CanvasTable } from './primitives/CanvasTable';
import { CanvasStatCard } from './primitives/CanvasStatCard';
import { CanvasChart } from './primitives/CanvasChart';
import { CanvasProgressBar } from './primitives/CanvasProgressBar';
import { CanvasImageGallery } from './primitives/CanvasImageGallery';
import { CanvasKeyValue } from './primitives/CanvasKeyValue';
import { CanvasButton } from './primitives/CanvasButton';
import { CanvasActionToolbar } from './primitives/CanvasActionToolbar';
import { CanvasToggleGroup } from './primitives/CanvasToggleGroup';
import { ActionCard } from './primitives/ActionCard';
import { ActionGroup } from './primitives/ActionGroup';
import { RelatedItemsPanel } from './primitives/RelatedItemsPanel';
import { ActionReviewDashboard } from './primitives/ActionReviewDashboard';

/**
 * Component Registry - Maps component types to React components
 */
const COMPONENT_REGISTRY: Record<ComponentType, React.ComponentType<any>> = {
  // Layout
  Stack: CanvasStack,
  Grid: CanvasGrid,
  Card: CanvasCard,
  Tabs: CanvasTabs,
  Accordion: CanvasAccordion,

  // Typography
  Heading: CanvasHeading,
  Text: CanvasText,
  Badge: CanvasBadge,
  Separator: CanvasSeparator,

  // Data Display
  List: CanvasList,
  Timeline: CanvasTimeline,
  Table: CanvasTable,
  StatCard: CanvasStatCard,
  Chart: CanvasChart,
  ProgressBar: CanvasProgressBar,
  ImageGallery: CanvasImageGallery,
  KeyValue: CanvasKeyValue,

  // Interactive
  Button: CanvasButton,
  ActionToolbar: CanvasActionToolbar,
  ToggleGroup: CanvasToggleGroup,

  // Action Components
  ActionCard: ActionCard,
  ActionGroup: ActionGroup,
  RelatedItemsPanel: RelatedItemsPanel,
  ActionReviewDashboard: ActionReviewDashboard,
};

/**
 * Props for ComponentRenderer
 */
interface ComponentRendererProps {
  tree: ComponentTree;
  depth?: number;  // Track recursion depth for debugging
}

/**
 * Fallback component when a component type is unknown or fails to render
 */
function FallbackComponent({ tree, error }: { tree: ComponentTree; error?: Error }) {
  return (
    <div className="p-4 bg-amber-50/50 border-2 border-amber-200 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
          <span className="text-amber-700 text-lg">⚠️</span>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-900 mb-1">
            Component Rendering Issue
          </h4>
          <p className="text-xs text-amber-700 mb-2">
            {error
              ? `Error: ${error.message}`
              : `Unknown component type: "${tree.component}"`}
          </p>
          <details className="text-xs">
            <summary className="cursor-pointer text-amber-600 hover:text-amber-800">
              View component data
            </summary>
            <pre className="mt-2 p-2 bg-white/50 rounded overflow-auto max-h-40">
              {JSON.stringify(tree, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

/**
 * Error Boundary for catching render errors
 */
class ComponentErrorBoundary extends React.Component<
  { children: React.ReactNode; tree: ComponentTree },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; tree: ComponentTree }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ComponentRenderer] Render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <FallbackComponent tree={this.props.tree} error={this.state.error} />;
    }

    return this.props.children;
  }
}

/**
 * Apply style presets to component props
 */
function applyStylePresets(
  props: Record<string, any>,
  style?: ComponentTree['style']
): Record<string, any> {
  if (!style) return props;

  const styledProps = { ...props };

  // Apply spacing if specified
  if (style.spacing) {
    styledProps.spacing = style.spacing;
  }

  // Apply theme if specified
  if (style.theme) {
    styledProps.theme = style.theme;
  }

  // Apply emphasis if specified (for typography components)
  if (style.emphasis) {
    styledProps.emphasis = style.emphasis;
  }

  return styledProps;
}

/**
 * Main ComponentRenderer
 * Recursively renders component trees from AI-generated JSON
 */
export function ComponentRenderer({ tree, depth = 0 }: ComponentRendererProps) {
  const { component, props, children, style } = tree;

  // Safety check: Prevent infinite recursion
  if (depth > 50) {
    console.error('[ComponentRenderer] Max recursion depth exceeded');
    return (
      <FallbackComponent
        tree={tree}
        error={new Error('Maximum nesting depth (50) exceeded')}
      />
    );
  }

  // Get the React component from registry
  const Component = COMPONENT_REGISTRY[component];

  // Handle unknown component types
  if (!Component) {
    console.warn(`[ComponentRenderer] Unknown component type: "${component}"`);
    return <FallbackComponent tree={tree} />;
  }

  // Apply style presets to props
  const styledProps = applyStylePresets(props, style);

  // Render children if present
  const renderedChildren = children?.map((child, index) => (
    <ComponentRenderer key={index} tree={child} depth={depth + 1} />
  ));

  // Merge rendered children into props if component expects them
  const finalProps = {
    ...styledProps,
    ...(renderedChildren && renderedChildren.length > 0 ? { children: renderedChildren } : {}),
  };

  // Render with error boundary
  return (
    <ComponentErrorBoundary tree={tree}>
      <Component {...finalProps} />
    </ComponentErrorBoundary>
  );
}

/**
 * Convenience component for rendering an array of component trees
 */
export function ComponentTreeList({ trees }: { trees: ComponentTree[] }) {
  return (
    <>
      {trees.map((tree, index) => (
        <ComponentRenderer key={index} tree={tree} />
      ))}
    </>
  );
}

/**
 * Validate a component tree before rendering
 * Returns validation errors if any
 */
export function validateComponentTree(tree: ComponentTree): string[] {
  const errors: string[] = [];

  // Check required fields
  if (!tree.component) {
    errors.push('Missing required field: component');
  }

  if (!tree.props) {
    errors.push('Missing required field: props');
  }

  // Check component type is valid
  if (tree.component && !COMPONENT_REGISTRY[tree.component]) {
    errors.push(`Unknown component type: "${tree.component}"`);
  }

  // Recursively validate children
  if (tree.children && Array.isArray(tree.children)) {
    tree.children.forEach((child, index) => {
      const childErrors = validateComponentTree(child);
      if (childErrors.length > 0) {
        errors.push(`Child ${index}: ${childErrors.join(', ')}`);
      }
    });
  }

  return errors;
}

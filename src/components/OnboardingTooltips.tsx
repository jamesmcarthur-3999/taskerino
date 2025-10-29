/**
 * OnboardingTooltips Component
 *
 * Orchestrates all onboarding tooltips for contextual feature guidance.
 * Uses the existing FeatureTooltip component with smart trigger logic based on UIContext tracking.
 *
 * Features:
 * - Three main tooltips: Capture Box, Sessions, Keyboard Shortcuts
 * - Smart triggering based on user interactions and onboarding state
 * - Auto-dismissal with configurable delays
 * - Respects user preferences (never re-show dismissed tooltips)
 * - Lightweight and non-blocking
 *
 * Integration:
 * - Render in CaptureZone and SessionsZone components
 * - Uses useUI() hook for onboarding state management
 * - Dispatches MARK_FEATURE_INTRODUCED when tooltips are shown
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FeatureTooltip } from './FeatureTooltip';
import { useUI } from '../context/UIContext';

// Tooltip IDs for tracking dismissals
const TOOLTIP_IDS = {
  CAPTURE_BOX: 'capture-box-intro',
  SESSIONS: 'sessions-intro',
  KEYBOARD_SHORTCUTS: 'keyboard-shortcuts-intro',
} as const;

// Tooltip configurations
interface TooltipConfig {
  id: string;
  featureFlag: keyof typeof import('../types').OnboardingState['featureIntroductions'];
  position: 'top' | 'bottom' | 'left' | 'right' | 'bottom-right' | 'center';
  title: string;
  message: string | React.ReactNode;
  autoDismissDelay: number;
  delay?: number;
}

const TOOLTIP_CONFIGS: Record<string, TooltipConfig> = {
  captureBox: {
    id: TOOLTIP_IDS.CAPTURE_BOX,
    featureFlag: 'captureBox',
    position: 'bottom',
    title: 'Capture Your Thoughts',
    message: 'Type anything here - tasks, notes, ideas. AI will automatically organize and categorize everything for you.',
    autoDismissDelay: 8000,
    delay: 500,
  },
  sessions: {
    id: TOOLTIP_IDS.SESSIONS,
    featureFlag: 'sessions',
    position: 'bottom-right',
    title: 'Track Your Work Sessions',
    message: 'Sessions record screenshots and audio of your work, then generate AI-powered summaries and insights to help you review what you accomplished.',
    autoDismissDelay: 10000,
    delay: 300,
  },
  keyboardShortcuts: {
    id: TOOLTIP_IDS.KEYBOARD_SHORTCUTS,
    featureFlag: 'cmdK',
    position: 'top',
    title: 'Keyboard Shortcuts',
    message: (
      <div>
        <p className="mb-2">Speed up your workflow with these shortcuts:</p>
        <ul className="text-sm space-y-1">
          <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">⌘+Enter</kbd> Submit capture</li>
          <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">⌘+K</kbd> Open command palette</li>
          <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">⌘+/</kbd> View all shortcuts</li>
        </ul>
      </div>
    ),
    autoDismissDelay: 6000,
    delay: 1000,
  },
};

// Props for individual tooltip components
interface TooltipTriggerProps {
  tooltipKey: keyof typeof TOOLTIP_CONFIGS;
  triggerCondition: boolean;
  onTriggerChange?: (triggered: boolean) => void;
}

/**
 * Individual Tooltip Component
 * Handles the display logic for a single tooltip based on trigger conditions
 */
function TooltipTrigger({ tooltipKey, triggerCondition, onTriggerChange }: TooltipTriggerProps) {
  const { state, dispatch } = useUI();
  const config = TOOLTIP_CONFIGS[tooltipKey];
  const [localTrigger, setLocalTrigger] = useState(false);

  // Check if tooltip should show
  const shouldShow =
    !state.onboarding.featureIntroductions[config.featureFlag] &&
    !state.onboarding.dismissedTooltips.includes(config.id) &&
    (triggerCondition || localTrigger);

  // Handle trigger condition changes
  useEffect(() => {
    if (triggerCondition && !localTrigger) {
      setLocalTrigger(true);
      onTriggerChange?.(true);
    }
  }, [triggerCondition, localTrigger, onTriggerChange]);

  // Mark feature as introduced when tooltip is shown
  useEffect(() => {
    if (shouldShow) {
      dispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: config.featureFlag });
      dispatch({ type: 'INCREMENT_TOOLTIP_STAT', payload: 'shown' });
    }
  }, [shouldShow, dispatch, config.featureFlag]);

  // Handle tooltip dismissal
  const handleDismiss = useCallback(() => {
    dispatch({ type: 'DISMISS_TOOLTIP', payload: config.id });
    dispatch({ type: 'INCREMENT_TOOLTIP_STAT', payload: 'dismissed' });
    setLocalTrigger(false);
    onTriggerChange?.(false);
  }, [dispatch, config.id, onTriggerChange]);

  return (
    <FeatureTooltip
      show={shouldShow}
      onDismiss={handleDismiss}
      position={config.position}
      title={config.title}
      message={config.message}
      autoDismiss={true}
      autoDismissDelay={config.autoDismissDelay}
      delay={config.delay}
    />
  );
}

/**
 * Capture Box Tooltip Props
 */
interface CaptureBoxTooltipProps {
  /** Whether the capture input is focused */
  isCaptureInputFocused: boolean;
}

/**
 * Capture Box Tooltip
 * Shows when user focuses on the capture input for the first time
 */
export function CaptureBoxTooltip({ isCaptureInputFocused }: CaptureBoxTooltipProps) {
  return (
    <TooltipTrigger
      tooltipKey="captureBox"
      triggerCondition={isCaptureInputFocused}
    />
  );
}

/**
 * Sessions Tooltip Props
 */
interface SessionsTooltipProps {
  /** Whether the Sessions tab is being hovered */
  isSessionsTabHovered: boolean;
}

/**
 * Sessions Tooltip
 * Shows when user hovers over the Sessions tab for the first time
 */
export function SessionsTooltip({ isSessionsTabHovered }: SessionsTooltipProps) {
  return (
    <TooltipTrigger
      tooltipKey="sessions"
      triggerCondition={isSessionsTabHovered}
    />
  );
}

/**
 * Keyboard Shortcuts Tooltip Props
 */
interface KeyboardShortcutsTooltipProps {
  /** Whether the user has completed their first capture */
  hasCompletedFirstCapture?: boolean;
}

/**
 * Keyboard Shortcuts Tooltip
 * Shows after user's first successful capture
 */
export function KeyboardShortcutsTooltip({ hasCompletedFirstCapture }: KeyboardShortcutsTooltipProps) {
  const { state } = useUI();

  // Trigger when first capture is completed (from UIContext)
  const triggerCondition =
    hasCompletedFirstCapture ?? state.onboarding.firstCaptureCompleted;

  return (
    <TooltipTrigger
      tooltipKey="keyboardShortcuts"
      triggerCondition={triggerCondition}
    />
  );
}

/**
 * All Tooltips Component
 * Convenience component that renders all tooltips together
 * Useful for testing or when all tooltips share the same container
 */
interface AllTooltipsProps {
  captureInputFocused?: boolean;
  sessionsTabHovered?: boolean;
  firstCaptureCompleted?: boolean;
}

export function AllOnboardingTooltips({
  captureInputFocused = false,
  sessionsTabHovered = false,
  firstCaptureCompleted = false,
}: AllTooltipsProps) {
  return (
    <>
      <CaptureBoxTooltip isCaptureInputFocused={captureInputFocused} />
      <SessionsTooltip isSessionsTabHovered={sessionsTabHovered} />
      <KeyboardShortcutsTooltip hasCompletedFirstCapture={firstCaptureCompleted} />
    </>
  );
}

/**
 * Hook for managing tooltip triggers
 * Provides utilities for tracking user interactions that should trigger tooltips
 */
export function useTooltipTriggers() {
  const { state, dispatch } = useUI();

  const markFirstCaptureComplete = useCallback(() => {
    if (!state.onboarding.firstCaptureCompleted) {
      dispatch({ type: 'COMPLETE_FIRST_CAPTURE' });
      dispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'captureCount' });
    }
  }, [state.onboarding.firstCaptureCompleted, dispatch]);

  const shouldShowTooltip = useCallback((tooltipKey: keyof typeof TOOLTIP_CONFIGS): boolean => {
    const config = TOOLTIP_CONFIGS[tooltipKey];
    return (
      !state.onboarding.featureIntroductions[config.featureFlag] &&
      !state.onboarding.dismissedTooltips.includes(config.id)
    );
  }, [state.onboarding.featureIntroductions, state.onboarding.dismissedTooltips]);

  return {
    markFirstCaptureComplete,
    shouldShowTooltip,
    firstCaptureCompleted: state.onboarding.firstCaptureCompleted,
  };
}

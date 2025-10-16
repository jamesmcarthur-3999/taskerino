import { useState, useEffect, type RefObject } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'top-right' | 'bottom-right';

interface Coordinates {
  x: number;
  y: number;
}

interface UseTooltipPositionReturn {
  adjustedPosition: TooltipPosition;
  coordinates: Coordinates | null;
}

/**
 * Hook to calculate smart positioning for tooltips
 * Detects if tooltip would go off-screen and auto-adjusts position
 * 
 * @param targetRef - Reference to the element the tooltip points to
 * @param tooltipRef - Reference to the tooltip element
 * @param preferredPosition - The desired position
 * @param show - Whether the tooltip is currently shown
 * @returns Adjusted position and coordinates
 */
export function useTooltipPosition(
  targetRef: RefObject<HTMLElement> | undefined,
  tooltipRef: RefObject<HTMLDivElement>,
  preferredPosition: TooltipPosition,
  show: boolean
): UseTooltipPositionReturn {
  const [adjustedPosition, setAdjustedPosition] = useState<TooltipPosition>(preferredPosition);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);

  useEffect(() => {
    if (!show || !targetRef?.current || !tooltipRef.current) {
      setCoordinates(null);
      return;
    }

    const calculatePosition = () => {
      if (!targetRef?.current || !tooltipRef.current) return;

      const target = targetRef.current.getBoundingClientRect();
      const tooltip = tooltipRef.current.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      const spacing = 12; // Gap between target and tooltip
      let position = preferredPosition;
      let x = 0;
      let y = 0;

      // Calculate initial position based on preference
      switch (preferredPosition) {
        case 'top':
          x = target.left + target.width / 2 - tooltip.width / 2;
          y = target.top - tooltip.height - spacing;
          break;
        case 'bottom':
          x = target.left + target.width / 2 - tooltip.width / 2;
          y = target.bottom + spacing;
          break;
        case 'left':
          x = target.left - tooltip.width - spacing;
          y = target.top + target.height / 2 - tooltip.height / 2;
          break;
        case 'right':
          x = target.right + spacing;
          y = target.top + target.height / 2 - tooltip.height / 2;
          break;
        case 'top-right':
          x = target.right - tooltip.width;
          y = target.top - tooltip.height - spacing;
          break;
        case 'bottom-right':
          x = target.right - tooltip.width;
          y = target.bottom + spacing;
          break;
      }

      // Check if tooltip goes off-screen and adjust
      const margin = 16; // Minimum margin from viewport edge

      // Horizontal overflow checks
      if (x < margin) {
        x = margin;
        if (position === 'left') position = 'right';
      } else if (x + tooltip.width > viewport.width - margin) {
        x = viewport.width - tooltip.width - margin;
        if (position === 'right') position = 'left';
      }

      // Vertical overflow checks
      if (y < margin) {
        y = margin;
        if (position === 'top' || position === 'top-right') {
          position = position === 'top-right' ? 'bottom-right' : 'bottom';
        }
      } else if (y + tooltip.height > viewport.height - margin) {
        y = viewport.height - tooltip.height - margin;
        if (position === 'bottom' || position === 'bottom-right') {
          position = position === 'bottom-right' ? 'top-right' : 'top';
        }
      }

      setAdjustedPosition(position);
      setCoordinates({ x, y });
    };

    // Calculate position initially and on scroll/resize
    calculatePosition();

    const handleResize = () => calculatePosition();
    const handleScroll = () => calculatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [show, targetRef, tooltipRef, preferredPosition]);

  return {
    adjustedPosition,
    coordinates,
  };
}

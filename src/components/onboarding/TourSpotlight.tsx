'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourSpotlightProps {
  targetSelector: string | null;
  allowInteraction?: boolean;
  visible: boolean;
}

const PADDING = 8;
const BORDER_RADIUS = 6;

function getTargetRect(selector: string | null): SpotlightRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left - PADDING,
    y: rect.top - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };
}

export function TourSpotlight({ targetSelector, allowInteraction, visible }: TourSpotlightProps) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  const updateRect = useCallback(() => {
    setRect(getTargetRect(targetSelector));
  }, [targetSelector]);

  useEffect(() => {
    updateRect();

    // Observe layout changes
    const observer = new ResizeObserver(updateRect);
    observer.observe(document.body);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    // Poll briefly to catch elements that render with delay
    const interval = setInterval(updateRect, 300);
    const timeout = setTimeout(() => clearInterval(interval), 3000);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [updateRect]);

  if (!visible) return null;

  // No target = full overlay (centered modal mode)
  const hasTarget = rect !== null && targetSelector !== null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0"
        style={{
          zIndex: 9998,
          pointerEvents: allowInteraction ? 'none' : 'auto',
        }}
      >
        <svg
          width="100%"
          height="100%"
          className="absolute inset-0"
          style={{ pointerEvents: allowInteraction ? 'none' : 'auto' }}
        >
          <defs>
            <mask id="tour-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {hasTarget && (
                <motion.rect
                  initial={{ opacity: 0 }}
                  animate={{
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    opacity: 1,
                  }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  rx={BORDER_RADIUS}
                  ry={BORDER_RADIUS}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.6)"
            mask="url(#tour-spotlight-mask)"
          />
          {/* Highlight border around spotlight */}
          {hasTarget && (
            <motion.rect
              initial={{ opacity: 0 }}
              animate={{
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                opacity: 1,
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              rx={BORDER_RADIUS}
              ry={BORDER_RADIUS}
              fill="none"
              stroke="oklch(0.70 0.15 220)"
              strokeWidth={2}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>

        {/* Clickable hole: allow clicking through the spotlight area */}
        {hasTarget && !allowInteraction && (
          <motion.div
            className="absolute"
            initial={{ opacity: 0 }}
            animate={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              opacity: 1,
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ pointerEvents: 'none' }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

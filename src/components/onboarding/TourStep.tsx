'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from '@/i18n';
import type { TourStepConfig } from './steps';
import { TOUR_STEPS } from './steps';

interface TourStepProps {
  step: TourStepConfig;
  stepIndex: number;
  onNext: () => void;
}

const TOOLTIP_GAP = 16;
const PADDING = 8;

interface Position {
  top: number;
  left: number;
  arrowSide: 'top' | 'bottom' | 'left' | 'right';
}

function computePosition(
  targetSelector: string | null,
  tooltipPosition: TourStepConfig['tooltipPosition'],
  tooltipRef: React.RefObject<HTMLDivElement | null>,
): Position {
  if (!targetSelector) {
    // Centered modal
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      arrowSide: 'top',
    };
  }

  const target = document.querySelector(targetSelector);
  if (!target) {
    return { top: window.innerHeight / 2, left: window.innerWidth / 2, arrowSide: 'top' };
  }

  const rect = target.getBoundingClientRect();
  const tooltipEl = tooltipRef.current;
  const tw = tooltipEl?.offsetWidth ?? 340;
  const th = tooltipEl?.offsetHeight ?? 200;

  let top = 0;
  let left = 0;
  let arrowSide: Position['arrowSide'] = 'top';

  switch (tooltipPosition) {
    case 'bottom':
      top = rect.bottom + PADDING + TOOLTIP_GAP;
      left = rect.left + rect.width / 2 - tw / 2;
      arrowSide = 'top';
      break;
    case 'top':
      top = rect.top - PADDING - TOOLTIP_GAP - th;
      left = rect.left + rect.width / 2 - tw / 2;
      arrowSide = 'bottom';
      break;
    case 'right':
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.right + PADDING + TOOLTIP_GAP;
      arrowSide = 'left';
      break;
    case 'left':
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.left - PADDING - TOOLTIP_GAP - tw;
      arrowSide = 'right';
      break;
  }

  // Clamp to viewport
  const margin = 12;
  left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - th - margin));

  return { top, left, arrowSide };
}

export function TourStep({ step, stepIndex, onNext }: TourStepProps) {
  const { t } = useTranslation();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0, arrowSide: 'top' });
  const [visible, setVisible] = useState(false);

  const updatePosition = useCallback(() => {
    setPosition(computePosition(step.targetSelector, step.tooltipPosition, tooltipRef));
  }, [step.targetSelector, step.tooltipPosition]);

  useEffect(() => {
    // Delay slightly to let target elements render
    const timer = setTimeout(() => {
      updatePosition();
      setVisible(true);
    }, 100);

    window.addEventListener('resize', updatePosition);
    const interval = setInterval(updatePosition, 500);
    const cleanup = setTimeout(() => clearInterval(interval), 5000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      clearInterval(interval);
      clearTimeout(cleanup);
    };
  }, [updatePosition]);

  const isClickNext = step.trigger.type === 'click-next';
  const isAuto = step.trigger.type === 'auto';
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  // Button label
  let buttonLabel: string;
  if (isFirstStep) {
    buttonLabel = t('onboarding.start');
  } else if (isLastStep) {
    buttonLabel = t('onboarding.finish');
  } else {
    buttonLabel = t('onboarding.next');
  }

  const isCentered = step.targetSelector === null;

  return (
    <>
      {visible && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] animate-in fade-in zoom-in-95 duration-250"
          style={
            isCentered
              ? {
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }
              : {
                  top: position.top,
                  left: position.left,
                }
          }
        >
          <div
            className={`
              bg-card border border-border shadow-2xl
              ${isCentered ? 'w-[440px]' : 'w-[340px]'}
              relative
            `}
            style={{ borderRadius: '8px' }}
          >
            {/* Arrow */}
            {!isCentered && <Arrow side={position.arrowSide} />}

            {/* Content */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {t(step.titleKey)}
              </h3>
              <div className="text-xs text-muted-foreground leading-relaxed">
                <FormattedText text={t(step.descriptionKey)} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 pb-4">
              <span className="text-[10px] font-mono text-muted-foreground">
                {stepIndex + 1} {t('onboarding.stepOf')} {TOUR_STEPS.length}
              </span>

              {isClickNext && (
                <button
                  onClick={onNext}
                  className="px-4 py-1.5 text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity cursor-pointer"
                  style={{ borderRadius: '4px' }}
                >
                  {buttonLabel}
                </button>
              )}

              {isAuto && (
                <span className="text-[10px] text-muted-foreground/70 italic animate-pulse">
                  ...
                </span>
              )}

              {!isClickNext && !isAuto && (
                <span className="text-[10px] text-signal-active font-mono animate-pulse">
                  ● {t('onboarding.next').toLowerCase()}...
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-0.5 bg-muted overflow-hidden" style={{ borderRadius: '0 0 8px 8px' }}>
              <div
                className="h-full bg-foreground/40 transition-all duration-500"
                style={{ width: `${((stepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Renders text with **bold** and \n line breaks */
function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => (
        <div key={i} className="flex gap-1.5">
          {lines.length > 1 && <span className="text-muted-foreground/50 shrink-0">•</span>}
          <span>
            {line.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <span key={j} className="font-semibold text-foreground">
                    {part.slice(2, -2)}
                  </span>
                );
              }
              return <span key={j}>{part}</span>;
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

function Arrow({ side }: { side: 'top' | 'bottom' | 'left' | 'right' }) {
  const base = 'absolute w-3 h-3 bg-card border-border rotate-45';

  switch (side) {
    case 'top':
      return (
        <div
          className={`${base} border-l border-t`}
          style={{ top: -6, left: '50%', marginLeft: -6 }}
        />
      );
    case 'bottom':
      return (
        <div
          className={`${base} border-r border-b`}
          style={{ bottom: -6, left: '50%', marginLeft: -6 }}
        />
      );
    case 'left':
      return (
        <div
          className={`${base} border-l border-b`}
          style={{ left: -6, top: '50%', marginTop: -6 }}
        />
      );
    case 'right':
      return (
        <div
          className={`${base} border-r border-t`}
          style={{ right: -6, top: '50%', marginTop: -6 }}
        />
      );
  }
}

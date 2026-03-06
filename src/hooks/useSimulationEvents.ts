'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SimulationEvent, SimulationEventType } from '@/types';
import { simulationEvents } from '@/engine/events';

const MAX_EVENTS = 500;
const BATCH_INTERVAL_MS = 100;

/**
 * Hook qui s'abonne aux evenements de simulation via l'emitter singleton.
 * Maintient un ring buffer et batche les re-renders a 100ms.
 */
export function useSimulationEvents() {
  const eventsRef = useRef<SimulationEvent[]>([]);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const batchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = simulationEvents.on('*' as SimulationEventType, (event: SimulationEvent) => {
      eventsRef.current.push(event);
      if (eventsRef.current.length > MAX_EVENTS) {
        eventsRef.current = eventsRef.current.slice(-MAX_EVENTS);
      }

      if (batchTimerRef.current === null) {
        batchTimerRef.current = window.setTimeout(() => {
          setEvents([...eventsRef.current]);
          batchTimerRef.current = null;
        }, BATCH_INTERVAL_MS);
      }
    });

    return () => {
      unsubscribe();
      if (batchTimerRef.current !== null) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
    };
  }, []);

  const clear = useCallback(() => {
    eventsRef.current = [];
    setEvents([]);
  }, []);

  return { events, clear };
}

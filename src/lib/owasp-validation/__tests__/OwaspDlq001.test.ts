import { describe, it, expect } from 'vitest';
import { OwaspDlq001 } from '../rules/OwaspDlq001';
import type { GraphNode } from '@/types/graph';

const mkMq = (id: string, dlq: boolean): GraphNode => ({
  id, type: 'message-queue', position: { x: 0, y: 0 },
  data: { deadLetterEnabled: dlq } as GraphNode['data'],
});

describe('OwaspDlq001 — DLQ enabled on MQ', () => {
  it('passes when DLQ enabled', () => {
    expect(OwaspDlq001.validate({ nodes: [mkMq('mq', true)], edges: [] })).toEqual([]);
  });
  it('flags when DLQ disabled', () => {
    expect(OwaspDlq001.validate({ nodes: [mkMq('mq', false)], edges: [] })).toHaveLength(1);
  });
  it('flags when deadLetterEnabled missing', () => {
    const node: GraphNode = { id: 'mq', type: 'message-queue', position: { x: 0, y: 0 }, data: {} as GraphNode['data'] };
    expect(OwaspDlq001.validate({ nodes: [node], edges: [] })).toHaveLength(1);
  });
});

import { describe, it, expect } from 'vitest';
import { OwaspAuth002 } from '../rules/OwaspAuth002';
import type { GraphNode } from '@/types/graph';

const mkIdP = (id: string, mfa: boolean): GraphNode => ({
  id, type: 'identity-provider', position: { x: 0, y: 0 },
  data: { mfaEnabled: mfa } as GraphNode['data'],
});

describe('OwaspAuth002 — MFA enabled on IdPs', () => {
  it('passes when MFA enabled', () => {
    expect(OwaspAuth002.validate({ nodes: [mkIdP('idp', true)], edges: [] })).toEqual([]);
  });
  it('flags when MFA disabled', () => {
    const violations = OwaspAuth002.validate({ nodes: [mkIdP('idp', false)], edges: [] });
    expect(violations).toHaveLength(1);
    expect(violations[0].affectedNodeIds).toEqual(['idp']);
  });
  it('passes when no IdP in graph', () => {
    expect(OwaspAuth002.validate({ nodes: [], edges: [] })).toEqual([]);
  });
});

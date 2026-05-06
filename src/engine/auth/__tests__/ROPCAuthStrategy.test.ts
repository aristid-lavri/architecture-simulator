import { describe, it, expect } from 'vitest';
import { ROPCAuthStrategy } from '../ROPCAuthStrategy';
import type { GraphNode } from '@/types/graph';

const mkNode = (id: string, type: string): GraphNode => ({
  id, type: type as GraphNode['type'], position: { x: 0, y: 0 }, data: {} as GraphNode['data'],
});

describe('ROPCAuthStrategy', () => {
  const s = new ROPCAuthStrategy();

  it('declares kind=ropc', () => {
    expect(s.kind).toBe('ropc');
  });
  it('requires an auth request', () => {
    expect(s.requiresAuthRequest).toBe(true);
  });
  it('builds POST /auth/login', () => {
    const req = s.buildAuthRequest(mkNode('c', 'client-group'), mkNode('idp', 'identity-provider'));
    expect(req.method).toBe('POST');
    expect(req.path).toBe('/auth/login');
    expect(req.payloadSizeBytes).toBeGreaterThan(0);
  });
  it('isAuthPath matches /auth/* paths', () => {
    expect(s.isAuthPath('/auth/login')).toBe(true);
    expect(s.isAuthPath('/auth/refresh')).toBe(true);
    expect(s.isAuthPath('/api/comptes')).toBe(false);
  });
});

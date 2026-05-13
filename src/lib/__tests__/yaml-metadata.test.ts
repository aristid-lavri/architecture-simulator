import { describe, it, expect } from 'vitest';
import { exportToYaml } from '../yaml-exporter';
import { parseYamlArchitecture as parseYaml } from '../yaml-parser';
import type { GraphNode, GraphEdge } from '@/types/graph';

/**
 * Vérifie que `metadata` (NodeMetadata) traverse le round-trip YAML :
 *   GraphNode[] → exportToYaml() → string → parseYaml() → GraphNode[]
 *
 * L'export utilise la clé `annotations` (et non `metadata`) à cause d'une collision
 * volontairement évitée avec la clé `metadata` racine (qui porte le `projectMeta`).
 */
describe('YAML round-trip — node metadata (annotations)', () => {
  it('preserves notes/tags/lastReviewed/owner across export → parse', () => {
    const nodes: GraphNode[] = [
      {
        id: 'api',
        type: 'http-server',
        position: { x: 100, y: 100 },
        data: { label: 'API', port: 8080 },
        metadata: {
          notes: 'Critical service',
          tags: ['critical', 'PCI'],
          lastReviewed: '2026-05-13',
          owner: { team: 'platform', individual: 'a.lavri' },
        },
      },
    ];
    const edges: GraphEdge[] = [];

    const yaml = exportToYaml(nodes, edges, 'Test');
    expect(yaml).toContain('annotations:');
    expect(yaml).toContain('Critical service');

    const parsed = parseYaml(yaml);
    if ('error' in parsed) throw new Error(`Parse error: ${parsed.error}`);

    const apiNode = parsed.nodes.find((n) => n.id === 'api');
    expect(apiNode).toBeDefined();
    expect(apiNode!.metadata).toEqual({
      notes: 'Critical service',
      tags: ['critical', 'PCI'],
      lastReviewed: '2026-05-13',
      owner: { team: 'platform', individual: 'a.lavri' },
    });
  });

  it('omits annotations key when metadata is undefined', () => {
    const nodes: GraphNode[] = [
      {
        id: 'api',
        type: 'http-server',
        position: { x: 0, y: 0 },
        data: { label: 'API' },
      },
    ];
    const yaml = exportToYaml(nodes, [], 'Test');
    expect(yaml).not.toContain('annotations:');
  });

  it('sanitizes hand-rolled annotations with unknown keys', () => {
    const yaml = `version: 1
name: Test
components:
  svc:
    type: http-server
    position: { x: 0, y: 0 }
    config:
      label: Svc
    annotations:
      notes: hello
      tags: [a, b, '']
      bogus: should-not-survive
      owner:
        team: ops
        rogue: nope
connections: []
`;
    const parsed = parseYaml(yaml);
    if ('error' in parsed) throw new Error(`Parse error: ${parsed.error}`);
    const svc = parsed.nodes.find((n) => n.id === 'svc')!;
    expect(svc.metadata).toEqual({
      notes: 'hello',
      tags: ['a', 'b'],
      owner: { team: 'ops' },
    });
    // Unknown keys must NOT leak through
    expect((svc.metadata as Record<string, unknown>).bogus).toBeUndefined();
    expect((svc.metadata?.owner as Record<string, unknown>).rogue).toBeUndefined();
  });

  it('round-trips zone and host annotations as well', () => {
    const nodes: GraphNode[] = [
      {
        id: 'zone-backend',
        type: 'network-zone',
        position: { x: 0, y: 0 },
        width: 400,
        height: 300,
        data: { label: 'Backend', zoneType: 'backend' },
        metadata: { tags: ['internal'] },
      },
      {
        id: 'host-1',
        type: 'host-server',
        position: { x: 10, y: 10 },
        width: 350,
        height: 200,
        parentId: 'zone-backend',
        data: { label: 'Host 1', ipAddress: '10.0.0.1' },
        metadata: { owner: { team: 'sre' } },
      },
    ];
    const yaml = exportToYaml(nodes, [], 'Test');
    const parsed = parseYaml(yaml);
    if ('error' in parsed) throw new Error(`Parse error: ${parsed.error}`);

    const zone = parsed.nodes.find((n) => n.id === 'zone-backend');
    const host = parsed.nodes.find((n) => n.id === 'host-1');
    expect(zone?.metadata).toEqual({ tags: ['internal'] });
    expect(host?.metadata).toEqual({ owner: { team: 'sre' } });
  });
});

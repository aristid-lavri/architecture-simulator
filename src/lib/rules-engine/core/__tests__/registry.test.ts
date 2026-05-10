import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ruleRegistry } from '../registry';
import type { Rule, RulePack } from '../types';

function makeRule(
  id: string,
  scope: Rule['scope'],
  packId: string,
  category = 'test',
): Rule {
  return {
    id,
    scope,
    severity: 'error',
    category,
    packId,
    evaluate: () => [],
  };
}

function makePack(id: string, rules: Rule[]): RulePack {
  return { id, rules };
}

describe('ruleRegistry', () => {
  beforeEach(() => {
    ruleRegistry.clear();
  });

  it('registerPack adds rules to allRules() and rulesFor(scope)', () => {
    const pack = makePack('pack-a', [
      makeRule('pack-a/cat/r1', 'edge', 'pack-a'),
      makeRule('pack-a/cat/r2', 'graph', 'pack-a'),
    ]);
    ruleRegistry.registerPack(pack);

    expect(ruleRegistry.allRules()).toHaveLength(2);
    expect(ruleRegistry.rulesFor('edge')).toHaveLength(1);
    expect(ruleRegistry.rulesFor('edge')[0].id).toBe('pack-a/cat/r1');
    expect(ruleRegistry.rulesFor('graph')).toHaveLength(1);
    expect(ruleRegistry.rulesFor('graph')[0].id).toBe('pack-a/cat/r2');
  });

  it('throws when registering the same pack ID twice', () => {
    const pack = makePack('dup', [makeRule('dup/cat/r1', 'edge', 'dup')]);
    ruleRegistry.registerPack(pack);
    expect(() => ruleRegistry.registerPack(pack)).toThrow(/already registered/);
  });

  it('rulesFor("edge") only returns edge-scope rules', () => {
    ruleRegistry.registerPack(
      makePack('p1', [
        makeRule('p1/c/e1', 'edge', 'p1'),
        makeRule('p1/c/g1', 'graph', 'p1'),
      ]),
    );
    ruleRegistry.registerPack(
      makePack('p2', [
        makeRule('p2/c/e1', 'edge', 'p2'),
        makeRule('p2/c/g1', 'graph', 'p2'),
        makeRule('p2/c/g2', 'graph', 'p2'),
      ]),
    );

    const edgeRules = ruleRegistry.rulesFor('edge');
    expect(edgeRules).toHaveLength(2);
    expect(edgeRules.every((r) => r.scope === 'edge')).toBe(true);

    const graphRules = ruleRegistry.rulesFor('graph');
    expect(graphRules).toHaveLength(3);
    expect(graphRules.every((r) => r.scope === 'graph')).toBe(true);
  });

  it('unregisterPack removes all rules of that pack', () => {
    ruleRegistry.registerPack(
      makePack('keep', [makeRule('keep/c/r1', 'edge', 'keep')]),
    );
    ruleRegistry.registerPack(
      makePack('drop', [
        makeRule('drop/c/r1', 'edge', 'drop'),
        makeRule('drop/c/r2', 'graph', 'drop'),
      ]),
    );

    expect(ruleRegistry.allRules()).toHaveLength(3);
    ruleRegistry.unregisterPack('drop');
    const remaining = ruleRegistry.allRules();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].packId).toBe('keep');
  });

  it('clear() empties the registry', () => {
    ruleRegistry.registerPack(
      makePack('a', [makeRule('a/c/r1', 'edge', 'a')]),
    );
    ruleRegistry.registerPack(
      makePack('b', [makeRule('b/c/r1', 'graph', 'b')]),
    );
    expect(ruleRegistry.allRules()).toHaveLength(2);
    ruleRegistry.clear();
    expect(ruleRegistry.allRules()).toHaveLength(0);
    expect(ruleRegistry.rulesFor('edge')).toHaveLength(0);
    expect(ruleRegistry.rulesFor('graph')).toHaveLength(0);
  });

  it('on("packRegistered", listener) fires when a pack is registered and unsubscribes correctly', () => {
    const listener = vi.fn();
    const unsubscribe = ruleRegistry.on('packRegistered', listener);

    const pack1 = makePack('one', [makeRule('one/c/r1', 'edge', 'one')]);
    ruleRegistry.registerPack(pack1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(pack1);

    unsubscribe();

    const pack2 = makePack('two', [makeRule('two/c/r1', 'edge', 'two')]);
    ruleRegistry.registerPack(pack2);
    expect(listener).toHaveBeenCalledTimes(1); // not called again
  });

  it('a listener throwing does not break subsequent listeners', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing = vi.fn(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();

    ruleRegistry.on('packRegistered', throwing);
    ruleRegistry.on('packRegistered', ok);

    const pack = makePack('p', [makeRule('p/c/r1', 'edge', 'p')]);
    expect(() => ruleRegistry.registerPack(pack)).not.toThrow();
    expect(throwing).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });
});

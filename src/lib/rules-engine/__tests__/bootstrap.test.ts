import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ruleRegistry } from '@/lib/rules-engine/core';
import { edgeCreationDecoratorRegistry } from '@/plugins/extensions/edge-creation';
import { registerCoreRulesEngine, __resetForTests } from '../bootstrap';

const DECORATOR_ID = 'core-rules-engine';

describe('registerCoreRulesEngine', () => {
  beforeEach(() => {
    ruleRegistry.clear();
    edgeCreationDecoratorRegistry.unregister(DECORATOR_ID);
    __resetForTests();
  });

  afterEach(() => {
    edgeCreationDecoratorRegistry.unregister(DECORATOR_ID);
    ruleRegistry.clear();
    __resetForTests();
  });

  it('registers the core-sanity pack with its 30 rules', () => {
    registerCoreRulesEngine();
    expect(ruleRegistry.allRules()).toHaveLength(30);
  });

  it('registers the core-rules-engine decorator on the edge-creation registry', () => {
    expect(edgeCreationDecoratorRegistry.hasDecorators()).toBe(false);
    registerCoreRulesEngine();
    expect(edgeCreationDecoratorRegistry.hasDecorators()).toBe(true);
  });

  it('is idempotent : two calls keep 30 rules and one decorator entry', () => {
    registerCoreRulesEngine();
    registerCoreRulesEngine();
    expect(ruleRegistry.allRules()).toHaveLength(30);
    // hasDecorators is just truthy, but we can verify single entry by unregistering once
    edgeCreationDecoratorRegistry.unregister(DECORATOR_ID);
    expect(edgeCreationDecoratorRegistry.hasDecorators()).toBe(false);
  });

  it('after __resetForTests, calling again re-runs the registrations', () => {
    registerCoreRulesEngine();
    expect(ruleRegistry.allRules()).toHaveLength(30);

    // Simulate a fresh module : clear external state + reset internal flag
    ruleRegistry.clear();
    edgeCreationDecoratorRegistry.unregister(DECORATOR_ID);
    __resetForTests();

    registerCoreRulesEngine();
    expect(ruleRegistry.allRules()).toHaveLength(30);
    expect(edgeCreationDecoratorRegistry.hasDecorators()).toBe(true);
  });
});

import { ruleRegistry } from './core';
import { coreSanityPack } from './packs/core-sanity';
import { edgeCreationDecoratorRegistry } from '@/plugins/extensions/edge-creation';
import { coreRulesDecorator } from './adapters';

let registered = false;

/**
 * Registers the core-sanity pack and wires the core rules decorator into the edge-creation pipeline.
 * Idempotent — calling more than once is a no-op.
 *
 * Call this once at app bootstrap, ideally from the same place where other extension registrations happen
 * (e.g. `src/plugins/extensions/index.ts` or a dedicated `register-defaults.ts`).
 */
export function registerCoreRulesEngine(): void {
  if (registered) return;
  registered = true;
  ruleRegistry.registerPack(coreSanityPack);
  edgeCreationDecoratorRegistry.register('core-rules-engine', coreRulesDecorator, 10);
}

/**
 * Test-only : resets the module-level `registered` flag so the next call to
 * `registerCoreRulesEngine()` will re-execute its side effects. Do NOT call from app code.
 */
export function __resetForTests(): void {
  registered = false;
}

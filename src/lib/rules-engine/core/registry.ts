import type { Rule, RulePack, RuleScope } from './types';

type RegistryEvent = 'packRegistered';
type EventListener = (pack: RulePack) => void;

class RuleRegistryImpl {
  private packs: Map<string, RulePack> = new Map();
  private listeners: Map<RegistryEvent, Set<EventListener>> = new Map();

  registerPack(pack: RulePack): void {
    if (this.packs.has(pack.id)) {
      throw new Error(`[ruleRegistry] Pack already registered: ${pack.id}`);
    }
    this.packs.set(pack.id, pack);
    const listeners = this.listeners.get('packRegistered');
    if (listeners) {
      for (const l of listeners) {
        try {
          l(pack);
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[ruleRegistry] listener threw', e);
          }
        }
      }
    }
  }

  unregisterPack(packId: string): void {
    this.packs.delete(packId);
  }

  rulesFor(scope: RuleScope): Rule[] {
    const out: Rule[] = [];
    for (const pack of this.packs.values()) {
      for (const rule of pack.rules) {
        if (rule.scope === scope) out.push(rule);
      }
    }
    return out;
  }

  allRules(): Rule[] {
    const out: Rule[] = [];
    for (const pack of this.packs.values()) out.push(...pack.rules);
    return out;
  }

  clear(): void {
    this.packs.clear();
  }

  on(event: RegistryEvent, listener: EventListener): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
    };
  }
}

export const ruleRegistry = new RuleRegistryImpl();

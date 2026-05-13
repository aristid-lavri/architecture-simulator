// src/lib/rules-engine/custom/compiler.ts
import {
  type Rule,
  type RulePack,
  type RuleViolation,
  createViolation,
} from '@/lib/rules-engine/core';
import { matchNode, matchEdge, getAncestorZone, getDottedField } from './matchers';
import {
  type CustomRulesDocument,
  type CustomRuleDeclaration,
  type CustomRulesCompileResult,
  type CustomRulesError,
  type Requirement,
  CUSTOM_RULES_PACK_ID,
} from './types';

function err(ruleIndex: number, ruleId: string | null, message: string, path?: string): CustomRulesError {
  return { ruleIndex, ruleId, message, path };
}

function validateDecl(decl: CustomRuleDeclaration, idx: number, seen: Set<string>): CustomRulesError[] {
  const errors: CustomRulesError[] = [];
  if (typeof decl.id !== 'string' || decl.id.length === 0) {
    errors.push(err(idx, null, 'Rule is missing required `id`.', 'id'));
    return errors;
  }
  if (seen.has(decl.id)) {
    errors.push(err(idx, decl.id, `Duplicate rule id \`${decl.id}\`.`, 'id'));
  }
  if (decl.severity !== 'error' && decl.severity !== 'warning') {
    errors.push(err(idx, decl.id, '`severity` must be "error" or "warning".', 'severity'));
  }
  if (decl.scope !== 'graph' && decl.scope !== 'edge') {
    errors.push(err(idx, decl.id, '`scope` must be "graph" or "edge".', 'scope'));
  }
  if (decl.scope === 'edge') {
    if (!decl.forbid && !decl.when) {
      errors.push(err(idx, decl.id, 'Edge-scope rule must define `forbid` or `when`+`require`.', 'forbid'));
    }
    if (decl.when && !decl.require) {
      errors.push(err(idx, decl.id, '`when` requires a `require` clause.', 'require'));
    }
  }
  if (decl.scope === 'graph') {
    if (!decl.forall || (!decl.forall.node && !decl.forall.edge)) {
      errors.push(err(idx, decl.id, 'Graph-scope rule must define `forall.node` or `forall.edge`.', 'forall'));
    }
    if (!decl.require) {
      errors.push(err(idx, decl.id, 'Graph-scope rule must define a `require` clause.', 'require'));
    }
  }
  return errors;
}

function evalRequirement(
  req: Requirement,
  ctx: { node?: import('@/types/graph').GraphNode; edge?: import('@/types/graph').GraphEdge },
  nodeMap: Map<string, import('@/types/graph').GraphNode>,
): boolean {
  if ('ancestor_zone' in req) {
    if (!ctx.node) return false;
    const zone = getAncestorZone(ctx.node, nodeMap);
    if (!zone) return false;
    return matchNode(zone, req.ancestor_zone, nodeMap);
  }
  if ('metadata_field' in req) {
    if (!ctx.node) return false;
    return getDottedField(ctx.node, req.metadata_field) !== undefined;
  }
  if ('protocol_in' in req) {
    if (!ctx.edge) return false;
    const proto = (ctx.edge.data?.protocol as string | undefined) ?? '';
    return req.protocol_in.includes(proto);
  }
  if ('target_type' in req) {
    if (!ctx.edge) return false;
    const target = nodeMap.get(ctx.edge.target);
    if (!target) return false;
    const types = Array.isArray(req.target_type) ? req.target_type : [req.target_type];
    return types.includes(target.type as never);
  }
  if ('tag' in req) {
    if (!ctx.node) return false;
    return (ctx.node.metadata?.tags ?? []).includes(req.tag);
  }
  return false;
}

function compileOne(decl: CustomRuleDeclaration): Rule {
  const ruleId = decl.id;
  if (decl.scope === 'edge') {
    return {
      id: ruleId,
      packId: CUSTOM_RULES_PACK_ID,
      category: 'custom',
      scope: 'edge',
      severity: decl.severity,
      evaluate: (ctx) => {
        const e = ctx.draftEdge;
        if (!e) return [];
        const violations: RuleViolation[] = [];
        const src = ctx.nodeMap.get(e.source);
        const tgt = ctx.nodeMap.get(e.target);
        if (!src || !tgt) return [];

        const edgeId = (e as { id?: string }).id ?? 'draft';

        if (decl.forbid) {
          if (
            matchEdge(
              { id: edgeId, source: e.source, target: e.target, data: e.data ?? {} },
              decl.forbid,
              ctx.nodeMap,
            )
          ) {
            violations.push(
              createViolation(ruleId, decl.severity, {
                edgeIds: [edgeId],
                nodeIds: [e.source, e.target],
                messageKey: `rules.${ruleId}.message`,
              }),
            );
          }
          return violations;
        }

        if (decl.when?.edge) {
          if (
            !matchEdge(
              { id: edgeId, source: e.source, target: e.target, data: e.data ?? {} },
              decl.when.edge,
              ctx.nodeMap,
            )
          ) return [];
        }
        if (decl.require) {
          const ok = evalRequirement(decl.require, {
            edge: { id: edgeId, source: e.source, target: e.target, data: e.data ?? {} },
          }, ctx.nodeMap);
          if (!ok) {
            violations.push(
              createViolation(ruleId, decl.severity, {
                edgeIds: [edgeId],
                nodeIds: [e.source, e.target],
                messageKey: `rules.${ruleId}.message`,
              }),
            );
          }
        }
        return violations;
      },
    };
  }

  // graph scope
  return {
    id: ruleId,
    packId: CUSTOM_RULES_PACK_ID,
    category: 'custom',
    scope: 'graph',
    severity: decl.severity,
    evaluate: (ctx) => {
      const violations: RuleViolation[] = [];
      if (decl.forall?.node) {
        for (const node of ctx.nodes) {
          if (!matchNode(node, decl.forall.node, ctx.nodeMap)) continue;
          if (!decl.require) continue;
          const ok = evalRequirement(decl.require, { node }, ctx.nodeMap);
          if (!ok) {
            violations.push(
              createViolation(ruleId, decl.severity, {
                nodeIds: [node.id],
                messageKey: `rules.${ruleId}.message`,
              }),
            );
          }
        }
      } else if (decl.forall?.edge) {
        for (const edge of ctx.edges) {
          if (!matchEdge(edge, decl.forall.edge, ctx.nodeMap)) continue;
          if (!decl.require) continue;
          const ok = evalRequirement(decl.require, { edge }, ctx.nodeMap);
          if (!ok) {
            violations.push(
              createViolation(ruleId, decl.severity, {
                edgeIds: [edge.id],
                messageKey: `rules.${ruleId}.message`,
              }),
            );
          }
        }
      }
      return violations;
    },
  };
}

export interface CompileOutput {
  pack: RulePack;
  result: CustomRulesCompileResult;
}

export function compileCustomRules(doc: CustomRulesDocument): CompileOutput {
  const errors: CustomRulesError[] = [];
  const seen = new Set<string>();
  const rules: Rule[] = [];

  doc.rules.forEach((decl, idx) => {
    const declErrors = validateDecl(decl, idx, seen);
    if (declErrors.length > 0) {
      errors.push(...declErrors);
      return;
    }
    seen.add(decl.id);
    rules.push(compileOne(decl));
  });

  return {
    pack: { id: CUSTOM_RULES_PACK_ID, rules },
    result: { ok: errors.length === 0, rulesCount: rules.length, errors },
  };
}

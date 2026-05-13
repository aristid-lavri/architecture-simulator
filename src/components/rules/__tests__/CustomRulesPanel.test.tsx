// src/components/rules/__tests__/CustomRulesPanel.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomRulesPanel } from '../CustomRulesPanel';
import { ruleRegistry } from '@/lib/rules-engine/core';

describe('CustomRulesPanel', () => {
  beforeEach(() => {
    ruleRegistry.clear();
  });

  it('shows current YAML and an apply button', () => {
    render(<CustomRulesPanel />);
    expect(screen.getByRole('textbox', { name: /custom rules yaml|règles personnalisées/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /apply|appliquer/i })).toBeDefined();
  });

  it('initializes from initialYaml prop', () => {
    const seed = 'rules: []\n';
    render(<CustomRulesPanel initialYaml={seed} />);
    const textarea = screen.getByRole('textbox', { name: /custom rules yaml|règles personnalisées/i }) as HTMLTextAreaElement;
    expect(textarea.value).toBe(seed);
  });

  it('apply with valid YAML displays success count and registers the pack', () => {
    render(<CustomRulesPanel />);
    const textarea = screen.getByRole('textbox', { name: /custom rules yaml|règles personnalisées/i });
    fireEvent.change(textarea, {
      target: {
        value: `
rules:
  - id: my/r1
    description: ''
    severity: warning
    scope: graph
    forall: { node: {} }
    require: { tag: x }
`,
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /apply|appliquer/i }));
    expect(screen.getByText(/1 rule|1 règle/i)).toBeDefined();
    expect(ruleRegistry.allRules().map((r) => r.id)).toEqual(['my/r1']);
  });

  it('apply with invalid YAML displays errors and does not register', () => {
    render(<CustomRulesPanel />);
    fireEvent.change(screen.getByRole('textbox', { name: /custom rules yaml|règles personnalisées/i }), {
      target: { value: 'rules:\n  - id: my/r\n    severity: bogus\n    scope: edge\n' },
    });
    fireEvent.click(screen.getByRole('button', { name: /apply|appliquer/i }));
    // At least one error mentioning severity must appear in the rendered list.
    expect(screen.getAllByText(/severity/i).length).toBeGreaterThan(0);
    expect(ruleRegistry.allRules()).toHaveLength(0);
  });

  it('invokes onApply with the YAML and result on success', () => {
    const onApply = vi.fn();
    render(<CustomRulesPanel onApply={onApply} />);
    const yaml = `
rules:
  - id: my/r2
    description: ''
    severity: error
    scope: edge
    forbid:
      source: { type: cache }
      target: { type: http-client }
`;
    fireEvent.change(screen.getByRole('textbox', { name: /custom rules yaml|règles personnalisées/i }), {
      target: { value: yaml },
    });
    fireEvent.click(screen.getByRole('button', { name: /apply|appliquer/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toBe(yaml);
    expect(onApply.mock.calls[0][1].ok).toBe(true);
    expect(onApply.mock.calls[0][1].rulesCount).toBe(1);
  });

  it('does not invoke onApply when validation fails', () => {
    const onApply = vi.fn();
    render(<CustomRulesPanel onApply={onApply} />);
    fireEvent.change(screen.getByRole('textbox', { name: /custom rules yaml|règles personnalisées/i }), {
      target: { value: 'rules:\n  - id: my/r\n    severity: bogus\n    scope: edge\n' },
    });
    fireEvent.click(screen.getByRole('button', { name: /apply|appliquer/i }));
    expect(onApply).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetadataSection } from '../MetadataSection';
import type { GraphNode } from '@/types/graph';

function makeNode(metadata?: GraphNode['metadata']): GraphNode {
  return {
    id: 'node-1',
    type: 'http-server',
    position: { x: 0, y: 0 },
    data: { label: 'Test' },
    ...(metadata ? { metadata } : {}),
  };
}

describe('MetadataSection', () => {
  it('renders the collapsed heading by default', () => {
    const onChange = vi.fn();
    render(<MetadataSection node={makeNode()} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Métadonnées/i })).toBeDefined();
    // Body is not rendered while collapsed.
    expect(screen.queryByLabelText('Notes')).toBeNull();
  });

  it('renders all fields when expanded', () => {
    const onChange = vi.fn();
    render(<MetadataSection node={makeNode()} onChange={onChange} defaultCollapsed={false} />);
    expect(screen.getByLabelText('Notes')).toBeDefined();
    expect(screen.getByLabelText('Tags')).toBeDefined();
    expect(screen.getByLabelText('Dernière revue')).toBeDefined();
    expect(screen.getByLabelText('Équipe propriétaire')).toBeDefined();
    expect(screen.getByLabelText('Personne responsable')).toBeDefined();
  });

  it('toggles collapsed state on heading click', () => {
    render(<MetadataSection node={makeNode()} onChange={() => {}} />);
    const heading = screen.getByRole('button', { name: /Métadonnées/i });
    fireEvent.click(heading);
    expect(screen.getByLabelText('Notes')).toBeDefined();
    fireEvent.click(heading);
    expect(screen.queryByLabelText('Notes')).toBeNull();
  });

  it('fires onChange with notes patch (trimmed, undefined when empty)', () => {
    const onChange = vi.fn();
    render(
      <MetadataSection node={makeNode()} onChange={onChange} defaultCollapsed={false} />,
    );
    const notes = screen.getByLabelText('Notes');
    fireEvent.change(notes, { target: { value: '  Critical path  ' } });
    expect(onChange).toHaveBeenLastCalledWith({
      metadata: { notes: 'Critical path' },
    });

    // Empty value → metadata becomes undefined (clean serialization)
    fireEvent.change(notes, { target: { value: '   ' } });
    expect(onChange).toHaveBeenLastCalledWith({ metadata: undefined });
  });

  it('parses tags from CSV string to deduped string[]', () => {
    const onChange = vi.fn();
    render(
      <MetadataSection node={makeNode()} onChange={onChange} defaultCollapsed={false} />,
    );
    const tags = screen.getByLabelText('Tags');
    fireEvent.change(tags, { target: { value: 'critical, PCI, critical, legacy' } });
    expect(onChange).toHaveBeenLastCalledWith({
      metadata: { tags: ['critical', 'PCI', 'legacy'] },
    });
  });

  it('handles empty tags input as undefined', () => {
    const onChange = vi.fn();
    render(
      <MetadataSection node={makeNode()} onChange={onChange} defaultCollapsed={false} />,
    );
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: ' , , ' } });
    expect(onChange).toHaveBeenLastCalledWith({ metadata: undefined });
  });

  it('renders tag chips and supports removal', () => {
    const onChange = vi.fn();
    render(
      <MetadataSection
        node={makeNode({ tags: ['critical', 'PCI'] })}
        onChange={onChange}
        defaultCollapsed={false}
      />,
    );
    // Chips visible
    expect(screen.getByText('critical')).toBeDefined();
    expect(screen.getByText('PCI')).toBeDefined();

    // Remove "critical"
    fireEvent.click(screen.getByRole('button', { name: /critical/i }));
    expect(onChange).toHaveBeenLastCalledWith({
      metadata: { tags: ['PCI'] },
    });
  });

  it('updates owner.team while preserving owner.individual', () => {
    const onChange = vi.fn();
    render(
      <MetadataSection
        node={makeNode({ owner: { individual: 'aristid' } })}
        onChange={onChange}
        defaultCollapsed={false}
      />,
    );
    fireEvent.change(screen.getByLabelText('Équipe propriétaire'), {
      target: { value: 'platform' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      metadata: { owner: { individual: 'aristid', team: 'platform' } },
    });
  });

  it('clears owner entirely when both team and individual become empty', () => {
    const onChange = vi.fn();
    render(
      <MetadataSection
        node={makeNode({ owner: { team: 'platform' } })}
        onChange={onChange}
        defaultCollapsed={false}
      />,
    );
    fireEvent.change(screen.getByLabelText('Équipe propriétaire'), {
      target: { value: '' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ metadata: undefined });
  });

  it('lastReviewed accepts ISO date', () => {
    const onChange = vi.fn();
    render(
      <MetadataSection node={makeNode()} onChange={onChange} defaultCollapsed={false} />,
    );
    const dateInput = screen.getByLabelText('Dernière revue');
    fireEvent.change(dateInput, { target: { value: '2026-05-13' } });
    expect(onChange).toHaveBeenLastCalledWith({
      metadata: { lastReviewed: '2026-05-13' },
    });
  });

  it('lastReviewed clears to undefined when emptied (with pre-existing value)', () => {
    const onChange = vi.fn();
    render(
      <MetadataSection
        node={makeNode({ lastReviewed: '2026-05-13' })}
        onChange={onChange}
        defaultCollapsed={false}
      />,
    );
    const dateInput = screen.getByLabelText('Dernière revue') as HTMLInputElement;
    expect(dateInput.value).toBe('2026-05-13');
    fireEvent.change(dateInput, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ metadata: undefined });
  });

  it('initializes fields from existing metadata', () => {
    render(
      <MetadataSection
        node={makeNode({
          notes: 'design context',
          tags: ['critical'],
          lastReviewed: '2026-01-15',
          owner: { team: 'platform', individual: 'a.lavri' },
        })}
        onChange={() => {}}
        defaultCollapsed={false}
      />,
    );
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('design context');
    expect((screen.getByLabelText('Tags') as HTMLInputElement).value).toBe('critical');
    expect((screen.getByLabelText('Dernière revue') as HTMLInputElement).value).toBe('2026-01-15');
    expect((screen.getByLabelText('Équipe propriétaire') as HTMLInputElement).value).toBe('platform');
    expect((screen.getByLabelText('Personne responsable') as HTMLInputElement).value).toBe('a.lavri');
  });
});

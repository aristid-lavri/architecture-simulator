import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RelatedADRsSection } from '../RelatedADRsSection';
import { useAdrStore } from '@/store/adr-store';

describe('RelatedADRsSection', () => {
  beforeEach(() => { useAdrStore.setState({ adrs: [] }); });

  it('shows empty state when no related ADRs', () => {
    render(<RelatedADRsSection elementKind="node" elementId="n1" />);
    expect(screen.getByText(/no ADRs linked|adr\.related\.empty/i)).toBeInTheDocument();
  });

  it('lists only ADRs linked to the element', () => {
    const a = useAdrStore.getState().createADR();
    const b = useAdrStore.getState().createADR();
    useAdrStore.getState().updateADR(a, { title: 'A' });
    useAdrStore.getState().updateADR(b, { title: 'B' });
    useAdrStore.getState().addLink(a, { kind: 'node', targetId: 'n1' });
    useAdrStore.getState().addLink(b, { kind: 'node', targetId: 'n2' });
    render(<RelatedADRsSection elementKind="node" elementId="n1" />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
  });

  it('the "Link to ADR" picker links a new ADR', () => {
    const a = useAdrStore.getState().createADR();
    useAdrStore.getState().updateADR(a, { title: 'A' });
    render(<RelatedADRsSection elementKind="node" elementId="n1" />);
    fireEvent.change(screen.getByLabelText(/link to ADR|adr\.related\.link/i), { target: { value: a } });
    expect(useAdrStore.getState().adrs[0].links).toEqual([{ kind: 'node', targetId: 'n1' }]);
  });
});

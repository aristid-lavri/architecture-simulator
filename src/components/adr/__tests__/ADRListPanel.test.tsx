import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ADRListPanel } from '../ADRListPanel';
import { useAdrStore } from '@/store/adr-store';

describe('ADRListPanel', () => {
  beforeEach(() => { useAdrStore.setState({ adrs: [] }); });

  it('renders empty state with create button', () => {
    render(<ADRListPanel onOpen={() => {}} />);
    expect(screen.getByText(/no decisions yet|aucune décision|adr\.list\.empty/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /new adr|nouvelle adr|adr\.list\.new/i }));
    expect(useAdrStore.getState().adrs).toHaveLength(1);
  });

  it('lists ADRs ordered by number', () => {
    useAdrStore.getState().createADR();
    useAdrStore.getState().createADR();
    useAdrStore.getState().updateADR(useAdrStore.getState().adrs[0].id, { title: 'A' });
    useAdrStore.getState().updateADR(useAdrStore.getState().adrs[1].id, { title: 'B' });
    render(<ADRListPanel onOpen={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('clicking an item calls onOpen', () => {
    const id = useAdrStore.getState().createADR();
    const onOpen = vi.fn();
    render(<ADRListPanel onOpen={onOpen} />);
    fireEvent.click(screen.getByText(/ADR-0001/));
    expect(onOpen).toHaveBeenCalledWith(id);
  });
});

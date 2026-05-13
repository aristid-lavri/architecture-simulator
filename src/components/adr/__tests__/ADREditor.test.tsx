import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ADREditor } from '../ADREditor';
import { useAdrStore } from '@/store/adr-store';

describe('ADREditor', () => {
  beforeEach(() => {
    useAdrStore.setState({ adrs: [] });
  });

  it('renders title, status, context, decision, consequences fields', () => {
    const id = useAdrStore.getState().createADR();
    render(<ADREditor adrId={id} />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/context/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/decision/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/consequences/i)).toBeInTheDocument();
  });

  it('updating title persists into store', () => {
    const id = useAdrStore.getState().createADR();
    render(<ADREditor adrId={id} />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Pick Postgres' } });
    expect(useAdrStore.getState().adrs[0].title).toBe('Pick Postgres');
  });

  it('changing status persists', () => {
    const id = useAdrStore.getState().createADR();
    render(<ADREditor adrId={id} />);
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'accepted' } });
    expect(useAdrStore.getState().adrs[0].status).toBe('accepted');
  });
});

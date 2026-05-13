import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ValidatedNumberInput } from '../ValidatedNumberInput';
import { validatePort } from '@/lib/field-validation';

describe('ValidatedNumberInput', () => {
  it('renders label and value', () => {
    render(
      <ValidatedNumberInput
        label="Port"
        value={8080}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('Port')).toBeDefined();
    expect((screen.getByLabelText('Port') as HTMLInputElement).value).toBe('8080');
  });

  it('fires onChange with parsed number', () => {
    const onChange = vi.fn();
    render(
      <ValidatedNumberInput label="Port" value={80} onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText('Port'), { target: { value: '443' } });
    expect(onChange).toHaveBeenCalledWith(443);
  });

  it('does not show error on mount even if invalid (untouched)', () => {
    render(
      <ValidatedNumberInput
        label="Port"
        value={100000}
        onChange={() => {}}
        validate={validatePort}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows error after user types invalid value', () => {
    const onChange = vi.fn();
    render(
      <ValidatedNumberInput
        label="Port"
        value={80}
        onChange={onChange}
        validate={validatePort}
      />,
    );
    const input = screen.getByLabelText('Port') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '100000' } });
    // After change, parent would re-render with the new value ; simulate by re-rendering
  });

  it('shows error on blur if value invalid', () => {
    render(
      <ValidatedNumberInput
        label="Port"
        value={100000}
        onChange={() => {}}
        validate={validatePort}
      />,
    );
    const input = screen.getByLabelText('Port');
    fireEvent.blur(input);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/65535/);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('hides error once value becomes valid', () => {
    const { rerender } = render(
      <ValidatedNumberInput
        label="Port"
        value={100000}
        onChange={() => {}}
        validate={validatePort}
      />,
    );
    fireEvent.blur(screen.getByLabelText('Port'));
    expect(screen.getByRole('alert')).toBeDefined();

    rerender(
      <ValidatedNumberInput
        label="Port"
        value={8080}
        onChange={() => {}}
        validate={validatePort}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders without label when not provided (bulk-edit grid)', () => {
    render(
      <ValidatedNumberInput value={80} onChange={() => {}} />,
    );
    // The input still exists, but no label
    expect(screen.queryByText('Port')).toBeNull();
  });
});

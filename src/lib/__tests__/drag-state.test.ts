import { describe, it, expect, beforeEach } from 'vitest';
import {
  setDraggedComponentType,
  getDraggedComponentType,
  clearDraggedComponentType,
} from '../drag-state';

describe('drag-state', () => {
  beforeEach(() => {
    clearDraggedComponentType();
  });

  it('returns null when no drag is in progress', () => {
    expect(getDraggedComponentType()).toBeNull();
  });

  it('stores and reads back the dragged type synchronously', () => {
    setDraggedComponentType('http-server');
    expect(getDraggedComponentType()).toBe('http-server');
  });

  it('clearDraggedComponentType resets to null', () => {
    setDraggedComponentType('database');
    clearDraggedComponentType();
    expect(getDraggedComponentType()).toBeNull();
  });

  it('setDraggedComponentType(null) also resets', () => {
    setDraggedComponentType('cache');
    setDraggedComponentType(null);
    expect(getDraggedComponentType()).toBeNull();
  });

  it('subsequent calls overwrite the type (single drag at a time)', () => {
    setDraggedComponentType('container');
    setDraggedComponentType('host-server');
    expect(getDraggedComponentType()).toBe('host-server');
  });
});

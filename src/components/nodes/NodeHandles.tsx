'use client';

import { Handle, Position } from '@xyflow/react';

interface NodeHandlesProps {
  color: string;
  type: 'both' | 'source-only' | 'target-only';
}

const SIDES = [
  { position: Position.Left, suffix: 'left', primary: true },
  { position: Position.Top, suffix: 'top', primary: false },
  { position: Position.Right, suffix: 'right', primary: true },
  { position: Position.Bottom, suffix: 'bottom', primary: false },
] as const;

export function NodeHandles({ color, type }: NodeHandlesProps) {
  return (
    <>
      {(type === 'both' || type === 'target-only') &&
        SIDES.map(({ position, suffix, primary }) => (
          <Handle
            key={`target-${suffix}`}
            type="target"
            id={`target-${suffix}`}
            position={position}
            style={{
              borderColor: color,
              ...(primary ? {} : { opacity: 0, width: 6, height: 6, minWidth: 0, minHeight: 0, pointerEvents: 'none' as const }),
            }}
          />
        ))}
      {(type === 'both' || type === 'source-only') &&
        SIDES.map(({ position, suffix, primary }) => (
          <Handle
            key={`source-${suffix}`}
            type="source"
            id={`source-${suffix}`}
            position={position}
            style={{
              borderColor: color,
              ...(primary ? {} : { opacity: 0, width: 6, height: 6, minWidth: 0, minHeight: 0, pointerEvents: 'none' as const }),
            }}
          />
        ))}
    </>
  );
}

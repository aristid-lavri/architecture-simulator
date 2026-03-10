'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface MetricSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

function MetricSparklineBase({ data, width = 120, height = 28, color = 'text-blue-400', className }: MetricSparklineProps) {
  const svgPath = useMemo(() => {
    if (data.length < 2) return '';

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    const points = data.map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    });

    return `M${points.join(' L')}`;
  }, [data, width, height]);

  const fillPath = useMemo(() => {
    if (data.length < 2) return '';
    return `${svgPath} L${width},${height} L0,${height} Z`;
  }, [svgPath, width, height, data.length]);

  if (data.length < 2) {
    return <div style={{ width, height }} className={className} />;
  }

  return (
    <svg
      width={width}
      height={height}
      className={cn('overflow-visible', className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      <path d={fillPath} fill="currentColor" opacity={0.1} className={color} />
      <path d={svgPath} fill="none" stroke="currentColor" strokeWidth={1.5} className={color} />
    </svg>
  );
}

export const MetricSparkline = memo(MetricSparklineBase);

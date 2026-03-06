'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface PropertyInfo {
  name: string;
  type: string;
  defaultValue: string;
  description: string;
}

interface ComponentCardProps {
  icon: ReactNode;
  name: string;
  description: string;
  category: 'simulation' | 'infrastructure' | 'data';
  properties: PropertyInfo[];
}

const categoryColors = {
  simulation: { border: 'border-blue-500/20', accent: 'bg-blue-500', text: 'text-blue-400', hover: 'hover:border-blue-500/40' },
  infrastructure: { border: 'border-purple-500/20', accent: 'bg-purple-500', text: 'text-purple-400', hover: 'hover:border-purple-500/40' },
  data: { border: 'border-emerald-500/20', accent: 'bg-emerald-500', text: 'text-emerald-400', hover: 'hover:border-emerald-500/40' },
};

const typeColors: Record<string, string> = {
  enum: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  number: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  string: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  boolean: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  object: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

export function ComponentCard({ icon, name, description, category, properties }: ComponentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = categoryColors[category];

  return (
    <div
      id={`component-${name.toLowerCase().replace(/\s+/g, '-')}`}
      className={cn('border bg-card/30 transition-all duration-300 scroll-mt-16', colors.border, colors.hover)}
      style={{ borderRadius: '3px' }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left group"
      >
        {/* Signal bar */}
        <div className={cn('w-0.5 h-8 self-stretch shrink-0', colors.accent)} style={{ borderRadius: '1px' }} />

        <div className={cn('text-muted-foreground group-hover:scale-110 transition-transform', colors.text)}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-sm font-semibold text-foreground">{name}</h3>
            <span className={cn('text-[8px] font-mono px-1.5 py-px border', typeColors[category === 'simulation' ? 'number' : category === 'infrastructure' ? 'enum' : 'string'])} style={{ borderRadius: '2px' }}>
              {properties.length} props
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{description}</p>
        </div>

        <ChevronDown className={cn(
          'w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0',
          expanded && 'rotate-180'
        )} />
      </button>

      {/* Properties — collapsible */}
      {expanded && properties.length > 0 && (
        <div className="border-t border-border/50 px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px] mt-3">
              <thead>
                <tr className="text-muted-foreground/70 text-left">
                  <th className="pb-2 pr-4 text-[8px] uppercase font-semibold">Propriété</th>
                  <th className="pb-2 pr-4 text-[8px] uppercase font-semibold">Type</th>
                  <th className="pb-2 pr-4 text-[8px] uppercase font-semibold">Défaut</th>
                  <th className="pb-2 text-[8px] uppercase font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {properties.map((prop) => (
                  <tr key={prop.name} className="text-foreground/80">
                    <td className="py-1.5 pr-4 text-foreground font-medium whitespace-nowrap">{prop.name}</td>
                    <td className="py-1.5 pr-4">
                      <span className={cn('px-1 py-px text-[9px] border', typeColors[prop.type] || 'text-muted-foreground')} style={{ borderRadius: '2px' }}>
                        {prop.type}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 text-muted-foreground">{prop.defaultValue}</td>
                    <td className="py-1.5 text-muted-foreground">{prop.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

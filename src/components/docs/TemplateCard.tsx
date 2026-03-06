import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface TemplateCardProps {
  name: string;
  description: string;
  topology: string;
  components: string[];
  useCase: string;
}

export function TemplateCard({ name, description, topology, components, useCase }: TemplateCardProps) {
  return (
    <div className="border border-border bg-card/30 hover:border-border/80 transition-all duration-300 group" style={{ borderRadius: '3px' }}>
      {/* Header */}
      <div className="p-4 pb-3">
        <h3 className="font-mono text-sm font-semibold text-foreground group-hover:text-signal-active transition-colors">{name}</h3>
        <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
      </div>

      {/* Topology visualization */}
      <div className="mx-4 mb-3 font-mono text-[10px] text-foreground/70 bg-background/50 px-3 py-2 border border-border/50 flex items-center gap-1.5 overflow-x-auto" style={{ borderRadius: '2px' }}>
        {topology.split(' → ').map((node, i, arr) => (
          <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-foreground/90">{node}</span>
            {i < arr.length - 1 && <ArrowRight className="w-2.5 h-2.5 text-signal-active/50 shrink-0" />}
          </span>
        ))}
      </div>

      {/* Component tags */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {components.map((comp) => (
          <span
            key={comp}
            className="px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground/80 border border-border/60 bg-card/50"
            style={{ borderRadius: '2px' }}
          >
            {comp}
          </span>
        ))}
      </div>

      {/* Use case */}
      <div className="px-4 pb-4 border-t border-border/30 pt-3">
        <span className="text-[8px] font-mono text-muted-foreground/60 uppercase font-semibold block mb-1">Cas d&apos;usage</span>
        <p className="text-[11px] text-foreground/70 leading-relaxed">{useCase}</p>
      </div>
    </div>
  );
}

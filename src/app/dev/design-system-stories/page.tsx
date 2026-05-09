'use client';
import {
  EEBadge, GovernanceBadge, GovernanceStrip, LockedOverlay,
  ButtonEE, CardEE, TabsEE, TabsEEList, TabsEETrigger, TabsEEContent,
  EEPanelHeader, EEEmptyState, CmdKPalette,
  Inspector,
} from '@/_ds';

export default function DesignSystemStories() {
  return (
    <div className="p-8 space-y-10 bg-paper text-ink min-h-screen">
      <section>
        <h2 className="font-display text-[14px] uppercase tracking-[0.08em] text-ee-elevation-bright">Badges</h2>
        <div className="flex gap-3 mt-3 items-center">
          <EEBadge size="xs" />
          <EEBadge size="sm" />
          <EEBadge size="md" />
          <EEBadge size="sm" muted />
          <GovernanceBadge size="sm" label="GOV" />
          <GovernanceBadge size="sm" label="SIGNED" />
          <GovernanceBadge size="sm" label="POLICY V3" />
        </div>
      </section>

      <section>
        <h2 className="font-display text-[14px] uppercase tracking-[0.08em] text-ee-elevation-bright">Buttons</h2>
        <div className="flex gap-3 mt-3 items-center">
          <ButtonEE variant="primary">Primary</ButtonEE>
          <ButtonEE variant="ghost">Ghost</ButtonEE>
          <ButtonEE variant="ee">◆ EE</ButtonEE>
          <ButtonEE variant="ee-ghost">◆ Ghost</ButtonEE>
          <ButtonEE variant="govern">⬢ Sign</ButtonEE>
          <ButtonEE variant="govern-ghost">⬢ Audit</ButtonEE>
        </div>
      </section>

      <section>
        <h2 className="font-display text-[14px] uppercase tracking-[0.08em] text-ee-elevation-bright">Strip + Card</h2>
        <CardEE variant="ee" className="mt-3">
          <GovernanceStrip variant="with-actions" actionHref="#" actionLabel="View log →">
            Governed · audit on
          </GovernanceStrip>
          <div className="p-4 text-[12px] text-ink-2">
            <EEPanelHeader title="◆ Cost projection" />
            <p className="mt-3">12-month projection across compute, storage, egress and signed contracts.</p>
          </div>
        </CardEE>
      </section>

      <section>
        <h2 className="font-display text-[14px] uppercase tracking-[0.08em] text-ee-elevation-bright">Tabs</h2>
        <TabsEE defaultValue="props" className="mt-3">
          <TabsEEList>
            <TabsEETrigger value="props">Properties</TabsEETrigger>
            <TabsEETrigger value="anno" gated>Annotations</TabsEETrigger>
            <TabsEETrigger value="audit" gated>Audit</TabsEETrigger>
          </TabsEEList>
          <TabsEEContent value="props" className="p-4 text-ink-2 text-[12px]">Properties content.</TabsEEContent>
        </TabsEE>
      </section>

      <section>
        <h2 className="font-display text-[14px] uppercase tracking-[0.08em] text-ee-elevation-bright">Empty state</h2>
        <CardEE variant="ee" className="mt-3">
          <EEEmptyState line="No chaos runs yet" hint="Pick a scenario from the library" ctaLabel="Run cascade-failure" onCta={() => {}} />
        </CardEE>
      </section>

      <section>
        <h2 className="font-display text-[14px] uppercase tracking-[0.08em] text-ee-elevation-bright">Inspector</h2>
        <div className="relative h-[280px] bg-paper-2 mt-3">
          <Inspector
            node={{ id: 'orders-svc', type: 'api-service', label: 'orders-svc', meta: { cpu: '2 cores', mem: '4 GB', cost: '$420/mo' } }}
            onClose={() => {}}
            onCta={() => {}}
            ctaLabel="◆ Run chaos here"
            linkLabel="↗ open in cost mode"
            onLink={() => {}}
          />
        </div>
      </section>

      <section>
        <h2 className="font-display text-[14px] uppercase tracking-[0.08em] text-ee-elevation-bright">⌘K palette (rendered open)</h2>
        <div className="relative h-[420px] mt-3">
          <CmdKPalette
            open
            onClose={() => {}}
            onSelect={() => {}}
            items={[
              { id: 'chaos', section: 'workspaces', name: 'Run chaos · cascade-failure', glyph: '◆', kbd: '⌘1' },
              { id: 'cost', section: 'workspaces', name: 'Open cost mode', glyph: '◆', kbd: '⌘2' },
              { id: 'sign', section: 'actions', name: 'Sign current snapshot', glyph: '⬢', kbd: '⌘S' },
            ]}
          />
        </div>
      </section>

      <section>
        <h2 className="font-display text-[14px] uppercase tracking-[0.08em] text-ee-elevation-bright">Locked overlay</h2>
        <div className="relative h-[180px] bg-paper-2 mt-3">
          <LockedOverlay onUnlock={() => {}} />
        </div>
      </section>
    </div>
  );
}

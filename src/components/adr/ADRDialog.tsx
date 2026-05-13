'use client';

/**
 * Modal shell that hosts the ADR list (left) and editor (right) — A7.2.
 *
 * Triggered from the Header (or any caller that passes a `trigger` node).
 * Selection state is held locally; once integrated with the project store
 * the open/closed and selected-id state can be hoisted if needed.
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { ADRListPanel } from './ADRListPanel';
import { ADREditor } from './ADREditor';

export interface ADRDialogProps {
  trigger: React.ReactNode;
}

export function ADRDialog({ trigger }: ADRDialogProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-5xl h-[85vh] p-0 flex">
        <DialogTitle className="sr-only">Architecture Decision Records</DialogTitle>
        <div className="w-72 border-r">
          <ADRListPanel onOpen={setOpenId} />
        </div>
        <div className="flex-1 overflow-auto">
          {openId ? (
            <ADREditor adrId={openId} />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Select an ADR
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

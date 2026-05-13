/**
 * Architecture Decision Records (ADR) — A7.2
 *
 * Native ADR system for documenting architectural decisions, scoped per project.
 * See `Dossiers-projet/PLAN-A7.2-ADR-System.md` for the full design.
 */

export type ADRStatus = 'proposed' | 'accepted' | 'superseded' | 'deprecated';

export interface ADRLink {
  /** 'node' | 'edge' — which graph element this links to */
  kind: 'node' | 'edge';
  /** id of the linked node or edge */
  targetId: string;
}

export interface ADR {
  /** Stable internal id (e.g. `adr_<ms>_<rand>`). */
  id: string;
  /** Human-friendly slug-like number ("ADR-0012"). Display only, auto-generated. */
  number: number;
  title: string;
  status: ADRStatus;
  /** ISO date YYYY-MM-DD of the decision. */
  date: string;
  /** Markdown */
  context: string;
  /** Markdown */
  decision: string;
  /** Markdown */
  consequences: string;
  /** Markdown — optional */
  alternatives?: string;
  /** Tags free-form. */
  tags?: string[];
  /** Graph elements this ADR relates to. */
  links?: ADRLink[];
  /** Author (free-form). */
  author?: string;
  /** Other ADR ids this one supersedes. */
  supersedes?: string[];
  /** Other ADR id that supersedes this one. Set when another ADR transitions us. */
  supersededBy?: string;
  /** Created/updated timestamps (ms epoch). */
  createdAt: number;
  updatedAt: number;
}

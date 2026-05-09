import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';

/**
 * Extension du schéma YAML : permet à un plugin de
 *   1. enrichir les structures sérialisées (metadata, fields additionnels par nœud/edge)
 *   2. parser ces extensions au chargement.
 *
 * Les fonctions sont optionnelles : un plugin peut n'enregistrer que ce dont il a besoin.
 */
export interface YAMLSchemaExtension {
  /** Identifiant unique. */
  id: string;

  // ============== Sérialisation (export) ==============

  /**
   * Retourne des champs additionnels à fusionner dans la `metadata` racine du YAML.
   * Ne pas écraser les clés CE existantes (`name`, `version`, etc.).
   */
  serializeMetadata?: (projectMeta: ProjectKindMeta) => Record<string, unknown> | null;

  /**
   * Retourne des champs additionnels à mélanger dans la sérialisation d'un nœud.
   * Ne pas écraser les clés CE (`type`, `position`, etc.).
   */
  serializeNode?: (node: GraphNode) => Record<string, unknown> | null;

  /**
   * Retourne des champs additionnels pour un edge sérialisé.
   */
  serializeEdge?: (edge: GraphEdge) => Record<string, unknown> | null;

  // ============== Parsing (import) ==============

  /**
   * Lit la `metadata` brute du YAML et retourne les champs ProjectKindMeta extensibles.
   * Doit retourner un objet partiel à merger dans le ProjectKindMeta final.
   */
  parseMetadata?: (raw: Record<string, unknown>) => Partial<ProjectKindMeta> | null;

  /**
   * Lit les champs bruts d'un nœud et retourne un patch à merger sur le GraphNode après création.
   * Permet d'ajouter des champs au niveau racine (ex: `level`, `parentContainerId`).
   */
  parseNode?: (raw: Record<string, unknown>) => Partial<GraphNode> | null;

  /**
   * Lit les champs bruts d'un nœud et retourne un patch à merger dans `node.data`.
   * Préférer ce hook quand les champs sont attachés à la donnée métier du nœud
   * plutôt qu'à la structure du graphe (positions, parentId, etc.).
   */
  parseNodeData?: (raw: Record<string, unknown>) => Record<string, unknown> | null;

  /**
   * Lit les champs bruts d'un edge et retourne un patch à merger.
   */
  parseEdge?: (raw: Record<string, unknown>) => Partial<GraphEdge> | null;
}

type YAMLSchemaListener = () => void;

class YAMLSchemaRegistryImpl {
  private extensions: Map<string, YAMLSchemaExtension> = new Map();
  private listeners: Set<YAMLSchemaListener> = new Set();

  register(extension: YAMLSchemaExtension): void {
    this.extensions.set(extension.id, extension);
    this.notify();
  }

  unregister(id: string): void {
    if (this.extensions.delete(id)) this.notify();
  }

  list(): YAMLSchemaExtension[] {
    return Array.from(this.extensions.values());
  }

  /** Fusionne les extensions metadata produites par tous les plugins. */
  serializeMetadata(projectMeta: ProjectKindMeta): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const ext of this.extensions.values()) {
      const part = ext.serializeMetadata?.(projectMeta);
      if (part) Object.assign(result, part);
    }
    return result;
  }

  /** Fusionne les extensions par nœud produites par tous les plugins. */
  serializeNode(node: GraphNode): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const ext of this.extensions.values()) {
      const part = ext.serializeNode?.(node);
      if (part) Object.assign(result, part);
    }
    return result;
  }

  /** Fusionne les extensions par edge produites par tous les plugins. */
  serializeEdge(edge: GraphEdge): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const ext of this.extensions.values()) {
      const part = ext.serializeEdge?.(edge);
      if (part) Object.assign(result, part);
    }
    return result;
  }

  /** Cumule les ProjectKindMeta partials lus par les plugins. */
  parseMetadata(raw: Record<string, unknown>): Partial<ProjectKindMeta> {
    const result: Partial<ProjectKindMeta> = {};
    for (const ext of this.extensions.values()) {
      const part = ext.parseMetadata?.(raw);
      if (part) Object.assign(result, part);
    }
    return result;
  }

  /** Cumule les patches de nœud lus par les plugins. */
  parseNode(raw: Record<string, unknown>): Partial<GraphNode> {
    const result: Partial<GraphNode> = {};
    for (const ext of this.extensions.values()) {
      const part = ext.parseNode?.(raw);
      if (part) Object.assign(result, part);
    }
    return result;
  }

  /** Cumule les patches dans `node.data` lus par les plugins. */
  parseNodeData(raw: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const ext of this.extensions.values()) {
      const part = ext.parseNodeData?.(raw);
      if (part) Object.assign(result, part);
    }
    return result;
  }

  /** Cumule les patches d'edge lus par les plugins. */
  parseEdge(raw: Record<string, unknown>): Partial<GraphEdge> {
    const result: Partial<GraphEdge> = {};
    for (const ext of this.extensions.values()) {
      const part = ext.parseEdge?.(raw);
      if (part) Object.assign(result, part);
    }
    return result;
  }

  hasExtensions(): boolean {
    return this.extensions.size > 0;
  }

  subscribe(listener: YAMLSchemaListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const yamlSchemaRegistry = new YAMLSchemaRegistryImpl();

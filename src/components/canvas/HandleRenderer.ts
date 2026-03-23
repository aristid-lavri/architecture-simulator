import { Container, Graphics } from 'pixi.js';
import type { GraphNode, GraphEdge } from '@/types/graph';
import { NODE_WIDTH, NODE_HEIGHT, CONTAINER_COMPONENT_TYPES, HANDLE_RADIUS, HANDLE_WIDTH, HANDLE_HEIGHT, NODE_COLORS } from './constants';

export type HandleSide = 'left' | 'right' | 'top' | 'bottom';
export type HandleType = 'source' | 'target';

export interface HandleInfo {
  nodeId: string;
  side: HandleSide;
  type: HandleType;
  x: number; // absolute world position
  y: number;
}

/**
 * Renders connection handles on nodes and manages edge creation by dragging.
 * Handles appear on hover/selection and allow users to create new edges.
 */
export class HandleRenderer {
  private handles: Map<string, { graphics: Graphics; info: HandleInfo }[]> = new Map();
  private nodeCache: Map<string, GraphNode> = new Map();
  private previewLine: Graphics;
  private hoveredNodeId: string | null = null;
  private selectedNodeId: string | null = null;

  // Drag state for edge creation
  private dragging = false;
  private dragSource: HandleInfo | null = null;
  private dragEndX = 0;
  private dragEndY = 0;

  // Callbacks
  onEdgeCreated: ((source: string, target: string, sourceHandle: string, targetHandle: string) => void) | null = null;

  constructor(private layer: Container) {
    this.previewLine = new Graphics();
    this.previewLine.visible = false;
    this.layer.addChild(this.previewLine);
  }

  /**
   * Build handles for all nodes. Handles are only visible for hovered/selected nodes.
   */
  renderHandles(nodes: GraphNode[], selectedId: string | null, hoveredId: string | null): void {
    this.selectedNodeId = selectedId;
    this.hoveredNodeId = hoveredId;

    // Build node cache for parentId chain lookups
    this.nodeCache.clear();
    for (const node of nodes) {
      this.nodeCache.set(node.id, node);
    }

    const nodeIds = new Set(nodes.map((n) => n.id));

    // Remove handles for nodes no longer present
    for (const [nodeId, handleList] of this.handles) {
      if (!nodeIds.has(nodeId)) {
        for (const h of handleList) h.graphics.destroy();
        this.handles.delete(nodeId);
      }
    }

    // Create/update handles for all nodes
    for (const node of nodes) {
      if (CONTAINER_COMPONENT_TYPES.has(node.type)) continue; // No handles on zones

      const existing = this.handles.get(node.id);
      if (existing) {
        // Update positions
        for (const h of existing) {
          const pos = this.computeHandlePosition(node, h.info.side, h.info.type);
          h.info.x = pos.x;
          h.info.y = pos.y;
          h.graphics.position.set(pos.x, pos.y);
        }
        continue;
      }

      // Create 4 handles (right source, left target, top target, bottom source)
      const handleConfigs: { side: HandleSide; type: HandleType }[] = [
        { side: 'right', type: 'source' },
        { side: 'left', type: 'target' },
        { side: 'top', type: 'target' },
        { side: 'bottom', type: 'source' },
      ];

      const handleList: { graphics: Graphics; info: HandleInfo }[] = [];
      const colors = NODE_COLORS[node.type] ?? { border: 0x555555 };

      for (const config of handleConfigs) {
        const pos = this.computeHandlePosition(node, config.side, config.type);
        const info: HandleInfo = { nodeId: node.id, side: config.side, type: config.type, x: pos.x, y: pos.y };

        const g = new Graphics();
        g.eventMode = 'static';
        g.cursor = 'crosshair';
        g.hitArea = { contains: (x: number, y: number) => x * x + y * y <= (HANDLE_RADIUS + 4) ** 2 };

        this.drawHandle(g, colors.border, config.type === 'source', config.side);

        g.position.set(pos.x, pos.y);
        g.alpha = 0.7;

        // Hover effects
        g.on('pointerover', () => { g.alpha = 1; g.scale.set(1.3); });
        g.on('pointerout', () => {
          if (!this.dragging || this.dragSource?.nodeId !== node.id) {
            g.alpha = 0.7;
            g.scale.set(1);
          }
        });

        // Drag to create edge
        g.on('pointerdown', (e) => {
          e.stopPropagation();
          this.startDrag(info, pos.x, pos.y);
        });

        this.layer.addChild(g);
        handleList.push({ graphics: g, info });
      }

      this.handles.set(node.id, handleList);
    }
  }

  /**
   * Call on global pointer move during edge creation drag.
   */
  updateDrag(worldX: number, worldY: number): void {
    if (!this.dragging || !this.dragSource) return;
    this.dragEndX = worldX;
    this.dragEndY = worldY;

    this.previewLine.clear();
    this.previewLine.visible = true;
    this.previewLine.setStrokeStyle({ width: 2, color: 0x6366f1, alpha: 0.6 });
    this.previewLine.moveTo(this.dragSource.x, this.dragSource.y);
    this.previewLine.lineTo(worldX, worldY);
    this.previewLine.stroke();

    // Draw a square at the end
    this.previewLine.roundRect(worldX - 4, worldY - 4, 8, 8, 1);
    this.previewLine.fill({ color: 0x6366f1, alpha: 0.4 });
  }

  /**
   * Call on global pointer up to finish edge creation.
   * Returns the target node/handle if the drop landed on a valid handle.
   */
  endDrag(worldX: number, worldY: number, nodes: GraphNode[]): void {
    if (!this.dragging || !this.dragSource) return;

    this.previewLine.clear();
    this.previewLine.visible = false;
    this.dragging = false;

    // Ensure node cache is up-to-date for findHandleAt
    this.nodeCache.clear();
    for (const node of nodes) {
      this.nodeCache.set(node.id, node);
    }

    // Use stored drag end position if caller passes (0,0)
    const finalX = worldX === 0 && worldY === 0 ? this.dragEndX : worldX;
    const finalY = worldX === 0 && worldY === 0 ? this.dragEndY : worldY;

    // Find target handle near drop point
    const target = this.findHandleAt(finalX, finalY, nodes);
    if (target && target.nodeId !== this.dragSource.nodeId) {
      // Determine source/target based on handle types
      const sourceHandle = `source-${this.dragSource.side}`;
      const targetHandle = `target-${target.side}`;
      this.onEdgeCreated?.(this.dragSource.nodeId, target.nodeId, sourceHandle, targetHandle);
    }

    this.dragSource = null;
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  private startDrag(info: HandleInfo, x: number, y: number): void {
    this.dragging = true;
    this.dragSource = info;
    this.dragEndX = x;
    this.dragEndY = y;
  }

  private findHandleAt(worldX: number, worldY: number, nodes: GraphNode[]): HandleInfo | null {
    const hitRadius = HANDLE_RADIUS + 8;

    for (const node of nodes) {
      if (CONTAINER_COMPONENT_TYPES.has(node.type)) continue;

      const sides: HandleSide[] = ['left', 'right', 'top', 'bottom'];
      const types: HandleType[] = ['target', 'source', 'target', 'source'];

      for (let i = 0; i < sides.length; i++) {
        const pos = this.computeHandlePosition(node, sides[i], types[i]);
        const dx = worldX - pos.x;
        const dy = worldY - pos.y;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          return { nodeId: node.id, side: sides[i], type: types[i], x: pos.x, y: pos.y };
        }
      }
    }

    return null;
  }

  private computeHandlePosition(
    node: GraphNode,
    side: HandleSide,
    _type: HandleType,
  ): { x: number; y: number } {
    const w = node.width ?? NODE_WIDTH;
    const h = node.height ?? NODE_HEIGHT;
    // Walk parentId chain for absolute position
    const abs = this.getAbsolutePosition(node);

    switch (side) {
      case 'left': return { x: abs.x, y: abs.y + h / 2 };
      case 'right': return { x: abs.x + w, y: abs.y + h / 2 };
      case 'top': return { x: abs.x + w / 2, y: abs.y };
      case 'bottom': return { x: abs.x + w / 2, y: abs.y + h };
    }
  }

  private getAbsolutePosition(node: GraphNode): { x: number; y: number } {
    let x = node.position.x;
    let y = node.position.y;
    let current = node;

    while (current.parentId) {
      const parent = this.nodeCache.get(current.parentId);
      if (!parent) break;
      x += parent.position.x;
      y += parent.position.y;
      current = parent;
    }

    return { x, y };
  }

  private drawHandle(g: Graphics, color: number, isSource: boolean, side: HandleSide): void {
    // Horizontal handles (top/bottom) use HANDLE_WIDTH × HANDLE_HEIGHT
    // Vertical handles (left/right) use HANDLE_HEIGHT × HANDLE_WIDTH (rotated)
    const isVertical = side === 'left' || side === 'right';
    const w = isVertical ? HANDLE_HEIGHT : HANDLE_WIDTH;
    const h = isVertical ? HANDLE_WIDTH : HANDLE_HEIGHT;
    const hw = w / 2;
    const hh = h / 2;
    // Outer rectangle
    g.roundRect(-hw, -hh, w, h, 1);
    g.fill({ color: 0x1a1a2e, alpha: 0.9 });
    g.roundRect(-hw, -hh, w, h, 1);
    g.stroke({ width: 1.5, color, alpha: 0.8 });

    // Inner square for source handles
    if (isSource) {
      g.roundRect(-2, -2, 4, 4, 0.5);
      g.fill({ color, alpha: 0.9 });
    }
  }

  hideAll(): void {
    for (const [, handleList] of this.handles) {
      for (const h of handleList) h.graphics.destroy();
    }
    this.handles.clear();
    this.previewLine.visible = false;
  }

  destroy(): void {
    this.hideAll();
    this.previewLine.destroy();
  }
}

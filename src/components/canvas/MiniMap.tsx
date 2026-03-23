'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { GraphNode } from '@/types/graph';
import type { Viewport } from 'pixi-viewport';
import { NODE_COLORS, NODE_WIDTH, NODE_HEIGHT, CONTAINER_COMPONENT_TYPES } from './constants';

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;
const PADDING = 20;

interface MiniMapProps {
  nodes: GraphNode[];
  viewport: Viewport | null;
}

/**
 * A small overview map showing all nodes and the current viewport bounds.
 * Rendered as a 2D canvas overlay for simplicity and performance.
 */
export function MiniMap({ nodes, viewport }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewport || nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = MINIMAP_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    // Compute bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      const w = node.width ?? NODE_WIDTH;
      const h = node.height ?? NODE_HEIGHT;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    }

    // Add padding
    minX -= PADDING; minY -= PADDING;
    maxX += PADDING; maxY += PADDING;

    const worldW = maxX - minX || 1;
    const worldH = maxY - minY || 1;
    const scaleX = MINIMAP_WIDTH / worldW;
    const scaleY = MINIMAP_HEIGHT / worldH;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (MINIMAP_WIDTH - worldW * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - worldH * scale) / 2;

    // Clear
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    ctx.fillStyle = 'rgba(15, 15, 19, 0.85)';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw nodes
    for (const node of nodes) {
      const w = node.width ?? NODE_WIDTH;
      const h = node.height ?? NODE_HEIGHT;
      const nx = offsetX + (node.position.x - minX) * scale;
      const ny = offsetY + (node.position.y - minY) * scale;
      const nw = w * scale;
      const nh = h * scale;

      const colors = NODE_COLORS[node.type];
      const isZone = CONTAINER_COMPONENT_TYPES.has(node.type);

      if (isZone) {
        ctx.strokeStyle = `#${colors?.border.toString(16).padStart(6, '0') ?? '475569'}`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(nx, ny, nw, nh);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = `#${colors?.border.toString(16).padStart(6, '0') ?? '888888'}`;
        ctx.fillRect(nx, ny, Math.max(nw, 2), Math.max(nh, 2));
      }
    }

    // Draw viewport bounds
    const vb = viewport.getVisibleBounds();
    const vx = offsetX + (vb.x - minX) * scale;
    const vy = offsetY + (vb.y - minY) * scale;
    const vw = vb.width * scale;
    const vh = vb.height * scale;

    ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.fillRect(vx, vy, vw, vh);
  }, [nodes, viewport]);

  // Redraw on viewport changes
  useEffect(() => {
    if (!viewport) return;

    const redraw = () => {
      draw();
      animFrameRef.current = requestAnimationFrame(redraw);
    };
    animFrameRef.current = requestAnimationFrame(redraw);

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [viewport, draw]);

  // Click to navigate
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!viewport || nodes.length === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Compute same transform as draw
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      const w = node.width ?? NODE_WIDTH;
      const h = node.height ?? NODE_HEIGHT;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    }
    minX -= PADDING; minY -= PADDING;
    maxX += PADDING; maxY += PADDING;

    const worldW = maxX - minX || 1;
    const worldH = maxY - minY || 1;
    const scaleX = MINIMAP_WIDTH / worldW;
    const scaleY = MINIMAP_HEIGHT / worldH;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (MINIMAP_WIDTH - worldW * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - worldH * scale) / 2;

    // Convert click to world coordinates
    const worldClickX = minX + (clickX - offsetX) / scale;
    const worldClickY = minY + (clickY - offsetY) / scale;

    viewport.moveCenter(worldClickX, worldClickY);
  }, [viewport, nodes]);

  if (nodes.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute bottom-20 right-3 z-10 rounded border border-border/50 cursor-pointer"
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      onClick={handleClick}
    />
  );
}

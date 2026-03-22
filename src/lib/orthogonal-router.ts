/**
 * Orthogonal (Manhattan) edge routing with obstacle avoidance.
 * Uses A* pathfinding on a visibility graph derived from node bounding boxes.
 */

type HandleSide = 'top' | 'right' | 'bottom' | 'left';

interface Point {
  x: number;
  y: number;
}

interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RouteResult {
  waypoints: Point[];
  bendCount: number;
}

interface SourceTarget {
  x: number;
  y: number;
  side: HandleSide;
}

const MARGIN = 20;
const BEND_PENALTY = 50; // Extra cost per turn to favor fewer bends
const GRID_RESOLUTION = 10;

/**
 * Compute an orthogonal route from source to target, avoiding obstacles.
 */
export function computeOrthogonalRoute(
  source: SourceTarget,
  target: SourceTarget,
  obstacles: Obstacle[],
  excludeIds?: Set<string>
): RouteResult {
  // Filter obstacles, excluding source/target nodes themselves
  const filteredObstacles = excludeIds
    ? obstacles.filter((o) => !excludeIds.has(o.id))
    : obstacles;

  // Expand obstacles by margin
  const expanded = filteredObstacles.map((o) => ({
    ...o,
    x: o.x - MARGIN,
    y: o.y - MARGIN,
    width: o.width + 2 * MARGIN,
    height: o.height + 2 * MARGIN,
  }));

  // Generate the exit point: extend from the handle side by MARGIN
  const sourceExit = getExitPoint(source);
  const targetEntry = getExitPoint(target);

  // Build waypoint candidates from obstacle corners + source/target
  const candidates = buildCandidatePoints(sourceExit, targetEntry, expanded);

  // Build visibility graph (only orthogonal connections)
  const path = aStarOrthogonal(sourceExit, targetEntry, candidates, expanded);

  if (path.length === 0) {
    // Fallback: direct L-shaped route
    return {
      waypoints: computeLRoute(sourceExit, targetEntry, source.side, target.side),
      bendCount: 1,
    };
  }

  // Simplify: remove collinear intermediate points
  const simplified = simplifyPath([sourceExit, ...path, targetEntry]);
  const bendCount = simplified.length - 2;

  return { waypoints: simplified, bendCount: Math.max(0, bendCount) };
}

function getExitPoint(st: SourceTarget): Point {
  switch (st.side) {
    case 'right': return { x: st.x + MARGIN, y: st.y };
    case 'left': return { x: st.x - MARGIN, y: st.y };
    case 'bottom': return { x: st.x, y: st.y + MARGIN };
    case 'top': return { x: st.x, y: st.y - MARGIN };
  }
}

function computeLRoute(from: Point, to: Point, fromSide: HandleSide, _toSide: HandleSide): Point[] {
  // Simple L-shaped route with one bend
  if (fromSide === 'right' || fromSide === 'left') {
    // Horizontal first, then vertical
    const midX = (from.x + to.x) / 2;
    return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
  }
  // Vertical first, then horizontal
  const midY = (from.y + to.y) / 2;
  return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
}

function buildCandidatePoints(source: Point, target: Point, obstacles: Obstacle[]): Point[] {
  const points: Point[] = [];

  // Add corners of expanded obstacles (snapped to grid)
  for (const obs of obstacles) {
    const corners = [
      { x: obs.x, y: obs.y },
      { x: obs.x + obs.width, y: obs.y },
      { x: obs.x, y: obs.y + obs.height },
      { x: obs.x + obs.width, y: obs.y + obs.height },
    ];
    for (const c of corners) {
      const snapped = snapToGrid(c);
      if (!isInsideAnyObstacle(snapped, obstacles)) {
        points.push(snapped);
      }
    }
  }

  // Add alignment points (horizontal/vertical projections of source/target through candidate space)
  // These help create cleaner orthogonal paths
  const alignX = [source.x, target.x];
  const alignY = [source.y, target.y];

  for (const obs of obstacles) {
    alignX.push(obs.x, obs.x + obs.width);
    alignY.push(obs.y, obs.y + obs.height);
  }

  for (const x of alignX) {
    for (const y of alignY) {
      const p = snapToGrid({ x, y });
      if (!isInsideAnyObstacle(p, obstacles)) {
        points.push(p);
      }
    }
  }

  return deduplicatePoints(points);
}

function snapToGrid(p: Point): Point {
  return {
    x: Math.round(p.x / GRID_RESOLUTION) * GRID_RESOLUTION,
    y: Math.round(p.y / GRID_RESOLUTION) * GRID_RESOLUTION,
  };
}

function isInsideAnyObstacle(p: Point, obstacles: Obstacle[]): boolean {
  for (const obs of obstacles) {
    if (p.x > obs.x && p.x < obs.x + obs.width && p.y > obs.y && p.y < obs.y + obs.height) {
      return true;
    }
  }
  return false;
}

function deduplicatePoints(points: Point[]): Point[] {
  const seen = new Set<string>();
  return points.filter((p) => {
    const key = `${p.x},${p.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * A* pathfinding on orthogonal connections between candidate points.
 * Only allows horizontal and vertical movement.
 * Segments must not intersect obstacles.
 */
function aStarOrthogonal(
  source: Point,
  target: Point,
  candidates: Point[],
  obstacles: Obstacle[]
): Point[] {
  const allPoints = [source, ...candidates, target];
  const targetIdx = allPoints.length - 1;

  // Build adjacency: connect points that share an X or Y coordinate
  // and have a clear orthogonal path (no obstacle intersection)
  const adjacency = new Map<number, Array<{ to: number; cost: number }>>();

  for (let i = 0; i < allPoints.length; i++) {
    adjacency.set(i, []);
  }

  for (let i = 0; i < allPoints.length; i++) {
    for (let j = i + 1; j < allPoints.length; j++) {
      const a = allPoints[i];
      const b = allPoints[j];
      const isHorizontal = Math.abs(a.y - b.y) < 1;
      const isVertical = Math.abs(a.x - b.x) < 1;

      if (!isHorizontal && !isVertical) continue;

      if (!segmentClearsObstacles(a, b, obstacles)) continue;

      const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      adjacency.get(i)!.push({ to: j, cost: dist });
      adjacency.get(j)!.push({ to: i, cost: dist });
    }
  }

  // A* search
  const gScore = new Float64Array(allPoints.length).fill(Infinity);
  const fScore = new Float64Array(allPoints.length).fill(Infinity);
  const cameFrom = new Int32Array(allPoints.length).fill(-1);
  const dirFrom = new Int8Array(allPoints.length).fill(-1); // 0=horizontal, 1=vertical

  gScore[0] = 0;
  fScore[0] = heuristic(allPoints[0], allPoints[targetIdx]);

  // Simple priority queue (array-based for small graphs)
  const openSet = new Set<number>([0]);

  while (openSet.size > 0) {
    // Find node with lowest fScore
    let current = -1;
    let bestF = Infinity;
    for (const idx of openSet) {
      if (fScore[idx] < bestF) {
        bestF = fScore[idx];
        current = idx;
      }
    }

    if (current === targetIdx) {
      // Reconstruct path
      const path: Point[] = [];
      let c = current;
      while (c !== 0 && c !== -1) {
        path.unshift(allPoints[c]);
        c = cameFrom[c];
      }
      // Remove source and target (they're added by the caller)
      if (path.length > 0 && pointsEqual(path[path.length - 1], allPoints[targetIdx])) {
        path.pop();
      }
      return path;
    }

    openSet.delete(current);

    for (const neighbor of adjacency.get(current) || []) {
      // Determine direction of this segment
      const currentDir = Math.abs(allPoints[current].x - allPoints[neighbor.to].x) < 1 ? 1 : 0;
      // Add bend penalty if direction changes
      const bendCost = (cameFrom[current] !== -1 && dirFrom[current] !== currentDir) ? BEND_PENALTY : 0;

      const tentativeG = gScore[current] + neighbor.cost + bendCost;
      if (tentativeG < gScore[neighbor.to]) {
        cameFrom[neighbor.to] = current;
        dirFrom[neighbor.to] = currentDir;
        gScore[neighbor.to] = tentativeG;
        fScore[neighbor.to] = tentativeG + heuristic(allPoints[neighbor.to], allPoints[targetIdx]);
        openSet.add(neighbor.to);
      }
    }
  }

  // No path found
  return [];
}

function heuristic(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;
}

/**
 * Check if an orthogonal segment (horizontal or vertical) is clear of obstacles.
 */
function segmentClearsObstacles(a: Point, b: Point, obstacles: Obstacle[]): boolean {
  const isHorizontal = Math.abs(a.y - b.y) < 1;

  for (const obs of obstacles) {
    if (isHorizontal) {
      // Horizontal segment: check if it passes through obstacle vertically
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const y = a.y;
      if (y > obs.y && y < obs.y + obs.height && maxX > obs.x && minX < obs.x + obs.width) {
        return false;
      }
    } else {
      // Vertical segment: check if it passes through obstacle horizontally
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      const x = a.x;
      if (x > obs.x && x < obs.x + obs.width && maxY > obs.y && minY < obs.y + obs.height) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Remove collinear intermediate points from a path.
 */
function simplifyPath(path: Point[]): Point[] {
  if (path.length <= 2) return path;
  const result: Point[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = path[i];
    const next = path[i + 1];
    // Keep point if direction changes
    const sameX = Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1;
    const sameY = Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1;
    if (!sameX && !sameY) {
      result.push(curr);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}

/**
 * Build an SVG path string from waypoints with optional rounded corners.
 */
export function waypointsToSvgPath(waypoints: Point[], cornerRadius: number = 6): string {
  if (waypoints.length < 2) return '';
  if (waypoints.length === 2) {
    return `M ${waypoints[0].x} ${waypoints[0].y} L ${waypoints[1].x} ${waypoints[1].y}`;
  }

  let d = `M ${waypoints[0].x} ${waypoints[0].y}`;

  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const next = waypoints[i + 1];

    // Distance to prev and next points
    const dPrev = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
    const dNext = Math.sqrt((next.x - curr.x) ** 2 + (next.y - curr.y) ** 2);
    const r = Math.min(cornerRadius, dPrev / 2, dNext / 2);

    if (r < 1) {
      // Too close for rounding, just line to
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    // Point before the corner
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const beforeX = curr.x - (dx1 / len1) * r;
    const beforeY = curr.y - (dy1 / len1) * r;

    // Point after the corner
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    const afterX = curr.x + (dx2 / len2) * r;
    const afterY = curr.y + (dy2 / len2) * r;

    d += ` L ${beforeX} ${beforeY}`;
    d += ` Q ${curr.x} ${curr.y} ${afterX} ${afterY}`;
  }

  const last = waypoints[waypoints.length - 1];
  d += ` L ${last.x} ${last.y}`;

  return d;
}

/**
 * Parse handle ID to determine side.
 */
export function parseHandleSide(handleId: string | null | undefined): HandleSide {
  if (!handleId) return 'right';
  if (handleId.includes('top')) return 'top';
  if (handleId.includes('bottom')) return 'bottom';
  if (handleId.includes('left')) return 'left';
  return 'right';
}

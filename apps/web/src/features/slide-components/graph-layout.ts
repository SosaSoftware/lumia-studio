import type { FlowDirection, FlowModel } from '@lumia/packages/catalog';

/** Position of a node, as the center of its cell in a unit square (0 to 1 on both axes). */
export interface PlacedNode {
  id: string;
  /** Layer the node belongs to: its distance from the start of the diagram along the main axis. */
  layer: number;
  x: number;
  y: number;
}

export interface GraphLayout {
  nodes: PlacedNode[];
  /** Indexes of the links that point backwards (they close a loop) and must be drawn around the nodes. */
  back: ReadonlySet<number>;
  /** Number of layers along the main axis. */
  layers: number;
  /** Largest number of nodes in one layer. */
  breadth: number;
}

export type Direction = FlowDirection;

/**
 * Layered layout of a flowchart: loops are broken by marking the links that return to a node still being visited,
 * each node goes one layer after its latest predecessor, and nodes inside a layer are ordered by the average
 * position of their neighbors so links cross as little as the small size of a slide allows.
 */
export function layerGraph(model: FlowModel, direction: Direction): GraphLayout {
  const ids = model.nodes.map((node) => node.id);
  const index = new Map(ids.map((id, position) => [id, position]));
  const out: number[][] = ids.map(() => []);
  const incoming = ids.map(() => 0);
  model.links.forEach((link, position) => {
    const from = index.get(link.from);
    const to = index.get(link.to);
    if (from === undefined || to === undefined) return;
    out[from]?.push(position);
    incoming[to] = (incoming[to] ?? 0) + 1;
  });

  // Back links: depth-first from the nodes nothing points to, then from whatever is left.
  const back = new Set<number>();
  const state = ids.map(() => 0);
  const visit = (node: number): void => {
    state[node] = 1;
    for (const position of out[node] ?? []) {
      const target = index.get(model.links[position]?.to ?? '');
      if (target === undefined) continue;
      if (state[target] === 1) back.add(position);
      else if (state[target] === 0) visit(target);
    }
    state[node] = 2;
  };
  ids.forEach((_, node) => {
    if ((incoming[node] ?? 0) === 0 && state[node] === 0) visit(node);
  });
  ids.forEach((_, node) => {
    if (state[node] === 0) visit(node);
  });

  const forward = model.links.map((link, position) => ({ from: index.get(link.from), to: index.get(link.to), position })).filter((link): link is { from: number; to: number; position: number } => link.from !== undefined && link.to !== undefined && !back.has(link.position) && link.from !== link.to);

  const layer = ids.map(() => 0);
  // Relax the links until no node moves; there are no loops left, so it ends within `ids.length` passes.
  let changed = true;
  for (let guard = ids.length; changed && guard >= 0; guard -= 1) {
    changed = false;
    for (const link of forward) {
      const wanted = (layer[link.from] ?? 0) + 1;
      if (wanted > (layer[link.to] ?? 0)) {
        layer[link.to] = wanted;
        changed = true;
      }
    }
  }

  const layers = Math.max(1, ...layer.map((value) => value + 1));
  const groups: number[][] = Array.from({ length: layers }, () => []);
  ids.forEach((_, node) => groups[layer[node] ?? 0]?.push(node));

  const rank = ids.map(() => 0);
  const stamp = (): void => {
    groups.forEach((group) => {
      group.forEach((node, position) => {
        rank[node] = position;
      });
    });
  };
  stamp();
  const average = (node: number, neighbors: number[]): number => (neighbors.length === 0 ? (rank[node] ?? 0) : neighbors.reduce((sum, other) => sum + (rank[other] ?? 0), 0) / neighbors.length);
  const before = (node: number): number[] => forward.filter((link) => link.to === node).map((link) => link.from);
  const after = (node: number): number[] => forward.filter((link) => link.from === node).map((link) => link.to);
  for (let sweep = 0; sweep < 2; sweep += 1) {
    for (let at = 1; at < layers; at += 1) {
      groups[at]?.sort((a, b) => average(a, before(a)) - average(b, before(b)) || a - b);
      stamp();
    }
    for (let at = layers - 2; at >= 0; at -= 1) {
      groups[at]?.sort((a, b) => average(a, after(a)) - average(b, after(b)) || a - b);
      stamp();
    }
  }

  const breadth = Math.max(1, ...groups.map((group) => group.length));
  const nodes: PlacedNode[] = [];
  groups.forEach((group, at) => {
    group.forEach((node, position) => {
      const along = (at + 0.5) / layers;
      const across = (position + 0.5) / group.length;
      nodes.push({ id: ids[node] ?? '', layer: at, x: direction === 'LR' ? along : across, y: direction === 'LR' ? across : along });
    });
  });
  return { nodes, back, layers, breadth };
}

/** Nodes on an ellipse in the order they appear, starting at the top and going clockwise: for cycles. */
export function ringGraph(model: FlowModel): PlacedNode[] {
  const count = Math.max(1, model.nodes.length);
  return model.nodes.map((node, position) => {
    const angle = (position / count) * Math.PI * 2 - Math.PI / 2;
    return { id: node.id, layer: position, x: 0.5 + 0.38 * Math.cos(angle), y: 0.5 + 0.36 * Math.sin(angle) };
  });
}

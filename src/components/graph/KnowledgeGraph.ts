/**
 * KnowledgeGraph custom element
 *
 * Hydrates the <knowledge-graph> element using force-graph.
 * Loaded as a Vite-bundled module via an inline <script> in the .astro file,
 * which Astro includes only on pages that use the component.
 *
 * Visual encoding:
 *   Node colour → note type  (blue = til, green = technical, yellow = longform)
 *   Node size   → connection degree (more links = bigger node)
 *   Edge width  → edge weight (wikilinks thicker than tag edges)
 */

// force-graph is a function factory but TS types it as a class — cast to avoid errors.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import ForceGraphCtor from 'force-graph';
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph = ForceGraphCtor as any;

// ── Gruvbox palette tokens (must stay in sync with global.css) ──
const COLORS = {
  bg:          '#282828',
  bg1:         '#3c3836',
  bg2:         '#504945',
  fg4:         '#a89984',
  // Node colours by type
  til:         '#83a598',  // gruv-blue-b
  technical:   '#b8bb26',  // gruv-green-b
  freeform:    '#fabd2f',  // gruv-yellow-b
  project:     '#fe8019',  // gruv-orange-b
  // Hover highlight
  hover:       '#d3869b',  // gruv-pink-b
} as const;

// ── Custom element ──────────────────────────────────────────────

class KnowledgeGraphElement extends HTMLElement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #graph: any = null;
  #observer: IntersectionObserver | null = null;

  connectedCallback() {
    // Use IntersectionObserver so the graph only initialises when visible.
    // This mirrors Astro's client:visible without relying on Astro's runtime.
    this.#observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          this.#init();
          this.#observer?.disconnect();
          this.#observer = null;
        }
      },
      { threshold: 0.1 }
    );
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#graph?._destructor?.();
  }

  #init() {
    const rawData = this.dataset.graph;
    if (!rawData) return;

    let data: GraphData;
    try {
      data = JSON.parse(rawData) as GraphData;
    } catch {
      console.error('[KnowledgeGraph] Failed to parse graph data');
      return;
    }

    const width  = parseInt(this.dataset.width  ?? '560', 10);
    const height = parseInt(this.dataset.height ?? '480', 10);

    // Build degree map for node sizing
    const degree = new Map<string, number>(data.nodes.map((n) => [n.id, 0]));
    for (const edge of data.edges) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + edge.weight);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + edge.weight);
    }

    const maxDegree = Math.max(1, ...degree.values());

    // force-graph appends its own <canvas> into the container element (this)
    this.#graph = ForceGraph()(this)
      .width(width)
      .height(height)
      .backgroundColor(COLORS.bg)
      .graphData({ nodes: data.nodes, links: data.edges })
      // Nodes
      .nodeId('id')
      .nodeLabel('label')
      .nodeColor((n: GraphNode) => COLORS[n.type] ?? COLORS.fg4)
      .nodeRelSize(4)
      .nodeVal((n: GraphNode) => {
        const d = degree.get(n.id) ?? 0;
        return 1 + (d / maxDegree) * 4;
      })
      // Links
      .linkSource('source')
      .linkTarget('target')
      .linkColor(() => COLORS.bg2)
      .linkWidth((e: GraphEdge) => e.weight)
      .linkDirectionalParticles(0)
      // Interaction
      .onNodeClick((node: GraphNode | null) => {
        const url = node?.url;
        if (url) window.location.href = url;
      })
      .onNodeHover((node: GraphNode | null) => {
        const c = this.querySelector('canvas');
        if (c) (c as HTMLCanvasElement).style.cursor = node ? 'pointer' : 'default';
      })
      // Performance
      .cooldownTicks(150)
      .d3AlphaDecay(0.03)
      .d3VelocityDecay(0.4);
  }
}

customElements.define('knowledge-graph', KnowledgeGraphElement);

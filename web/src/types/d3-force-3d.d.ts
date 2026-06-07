declare module 'd3-force-3d' {
  interface ForceGeneric<Node> {
    (alpha: number): void;
    initialize?: (nodes: Node[], ...args: unknown[]) => void;
  }

  interface ForceX<Node> extends ForceGeneric<Node> {
    x(): (node: Node, i: number, nodes: Node[]) => number;
    x(x: number | ((node: Node, i: number, nodes: Node[]) => number)): this;
    strength(): number | ((node: Node, i: number, nodes: Node[]) => number);
    strength(strength: number | ((node: Node, i: number, nodes: Node[]) => number)): this;
  }

  interface ForceY<Node> extends ForceGeneric<Node> {
    y(): (node: Node, i: number, nodes: Node[]) => number;
    y(y: number | ((node: Node, i: number, nodes: Node[]) => number)): this;
    strength(): number | ((node: Node, i: number, nodes: Node[]) => number);
    strength(strength: number | ((node: Node, i: number, nodes: Node[]) => number)): this;
  }

  interface ForceLink<Node, Link> extends ForceGeneric<Node> {
    id(): (node: Node) => string | number;
    id(id: (node: Node) => string | number): this;
    distance(): number | ((link: Link, i: number, links: Link[]) => number);
    distance(distance: number | ((link: Link, i: number, links: Link[]) => number)): this;
    strength(): number | ((link: Link, i: number, links: Link[]) => number);
    strength(strength: number | ((link: Link, i: number, links: Link[]) => number)): this;
    links(): Link[];
    links(links: Link[]): this;
  }

  interface ForceManyBody<Node> extends ForceGeneric<Node> {
    strength(): number | ((node: Node, i: number, nodes: Node[]) => number);
    strength(strength: number | ((node: Node, i: number, nodes: Node[]) => number)): this;
  }

  export function forceLink<Node, Link>(): ForceLink<Node, Link>;
  export function forceManyBody<Node>(): ForceManyBody<Node>;
  export function forceX<Node>(): ForceX<Node>;
  export function forceY<Node>(): ForceY<Node>;
}

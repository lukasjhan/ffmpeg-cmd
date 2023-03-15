import { getHashCode } from "./utils";

    /*
    Node in a directed-acyclic graph (DAG).

    Edges:
        DagNodes are connected by edges.  An edge connects two nodes with a label for
        each side:
         - ``upstream_node``: upstream/parent node
         - ``upstream_label``: label on the outgoing side of the upstream node
         - ``downstream_node``: downstream/child node
         - ``downstream_label``: label on the incoming side of the downstream node

        For example, DagNode A may be connected to DagNode B with an edge labelled
        "foo" on A's side, and "bar" on B's side:

           _____               _____
          |     |             |     |
          |  A  >[foo]---[bar]>  B  |
          |_____|             |_____|

        Edge labels may be integers or strings, and nodes cannot have more than one
        incoming edge with the same label.

        DagNodes may have any number of incoming edges and any number of outgoing
        edges.  DagNodes keep track only of their incoming edges, but the entire graph
        structure can be inferred by looking at the furthest downstream nodes and
        working backwards.

    Hashing:
        DagNodes must be hashable, and two nodes are considered to be equivalent if
        they have the same hash value.

        Nodes are immutable, and the hash should remain constant as a result.  If a
        node with new contents is required, create a new node and throw the old one
        away.

    String representation:
        In order for graph visualization tools to show useful information, nodes must
        be representable as strings.  The ``repr`` operator should provide a more or
        less "full" representation of the node, and the ``short_repr`` property should
        be a shortened, concise representation.

        Again, because nodes are immutable, the string representations should remain
        constant.
    */
export interface DagNode {
  readonly hash: number,
  /*
    hash of the node.
  */

  eq: (other: DagNode) => boolean,
  /*
    Compare two nodes; implementations should return True if hashes match.
  */
  getIncomingEdgeMap: () => IncomingEdgeMap,
  /*
    Provides information about all incoming edges that connect to this node.

    The edge map is a dictionary that maps an ``incoming_label`` to
    ``(outgoing_node, outgoing_label)``.  Note that implicity, ``incoming_node`` is
    ``self``.  See "Edges" section above.
  */
  getIncomingEdges: () => DagEdge[],
}

export type Label = string;
export type Selector = 'a' | 'v' | undefined;
export type IncomingEdgeMap = Map<Label, { upstreamNode: DagNode, upstreamLabel: Label, upstreamSelector: Selector }>;
export type OutgoingEdgeMap = Map<Label, Array<{ downstreamNode: DagNode, downstreamLabel: Label, downstreamSelector: Selector }>>;

export interface DagEdge {
  downstreamNode: DagNode,
  downstreamLabel: Label,
  upstreamNode: DagNode,
  upstreamLabel: Label,
  upstreamSelector?: Selector,
}

export class KwargReprNode implements DagNode {
  // A DagNode that can be represented as a set of args+kwargs.

  public name: string;
  private incomingEdgeMap: IncomingEdgeMap;
  public kwargs: Record<string, string> | string[];
  public readonly hash: number;
  private incomingEdges: DagEdge[];

  constructor(incomingEdgeMap: any, name: string, kwargs: Record<string, string> | string[]) {
    this.name = name;
    this.kwargs = kwargs;
    this.incomingEdgeMap = incomingEdgeMap;
    this.hash = this.calHash();
    this.incomingEdges = this.setIncomingEdges();
  }

  private calHash = (): number => {
    return this.getInnerHash() + this.getUpstreamHash();
  }

  public eq = (node: DagNode) => {
    return this.hash === node.hash;
  }

  public getIncomingEdgeMap = () => {
    return this.incomingEdgeMap;
  }

  private getInnerHash = () => {
    const obj = {name: this.name, kwargs: this.kwargs};
    return getHashCode(obj);
  }

  private getUpstreamHash = () => {
    let hash = 0;
    this.incomingEdgeMap.forEach((value, key) => {
      const downstreamLabel = key;
      const { upstreamNode, upstreamLabel, upstreamSelector } = value;
      const values = {
        downstreamLabel,
        upstreamHash: upstreamNode.hash,
        upstreamLabel,
        upstreamSelector,
      }
      const hashValue = getHashCode(values);
      hash += hashValue;
    });
    return hash;
  }

  private setIncomingEdges = () => getIncomingEdges(this, this.incomingEdgeMap);
  public getIncomingEdges = () => this.incomingEdges;
}

export const getIncomingEdges = (downstreamNode: DagNode, incomingEdgeMap: IncomingEdgeMap): DagEdge[] => {
  const edges: DagEdge[] = [];
  incomingEdgeMap.forEach((value, key) => {
    const downstreamLabel = key;
    const { upstreamNode, upstreamLabel, upstreamSelector } = value;
    const edge: DagEdge = {
      downstreamNode: downstreamNode,
      downstreamLabel: downstreamLabel,
      upstreamNode: upstreamNode,
      upstreamLabel: upstreamLabel,
      upstreamSelector: upstreamSelector,
    }
    edges.push(edge);
  });
  return edges;
}

export const getOutgoingEdges = (upstreamNode: DagNode, outgoingEdgeMap: OutgoingEdgeMap): DagEdge[] => {
  const edges: DagEdge[] = [];
  outgoingEdgeMap.forEach((value, key) => {
    const upstreamLabel = key;
    const downstreamInfos = value;
    downstreamInfos.forEach(downstreamInfo => {
      const { downstreamNode, downstreamLabel, downstreamSelector } = downstreamInfo;

      const edge: DagEdge = {
        downstreamNode: downstreamNode,
        downstreamLabel: downstreamLabel,
        upstreamNode: upstreamNode,
        upstreamLabel: upstreamLabel,
        upstreamSelector: downstreamSelector,
      }
      edges.push(edge);
    })
  });
  return edges;
}

export const topoSort = (downstreamNodes: DagNode[]) => {
  const markedNodes: DagNode[] = [];
  const sortedNodes: DagNode[] = [];
  const outgoingEdgeMaps: Map<DagNode, OutgoingEdgeMap> = new Map();

  const visit = (
    upstreamNode: DagNode,
    upstreamLabel: Label,
    downstreamNode?: DagNode,
    downstreamLabel?: Label,
    downstreamSelector: Selector = undefined,
  ) => {
    if (markedNodes.includes(upstreamNode)) {
      throw Error("Graph is not a DAG");
    }

    if (downstreamNode !== undefined && downstreamLabel !== undefined) {
      const outgoingEdgeMap: OutgoingEdgeMap = outgoingEdgeMaps.get(upstreamNode) ?? new Map();
      const outgoingEdgeInfos: Array<{ downstreamNode: DagNode, downstreamLabel: Label, downstreamSelector: Selector }> = outgoingEdgeMap.get(upstreamLabel) ?? [];
      outgoingEdgeInfos.push({downstreamNode, downstreamLabel, downstreamSelector});

      outgoingEdgeMap.set(upstreamLabel, outgoingEdgeInfos);
      outgoingEdgeMaps.set(upstreamNode, outgoingEdgeMap);
    }

    if (!sortedNodes.includes(upstreamNode)) {
      markedNodes.push(upstreamNode);

      for (const edge of upstreamNode.getIncomingEdges()) {
        visit(edge.upstreamNode, edge.upstreamLabel, edge.downstreamNode, edge.upstreamLabel, edge.upstreamSelector);
      }
      markedNodes.splice(markedNodes.indexOf(upstreamNode), 1);
      sortedNodes.push(upstreamNode);
    }
  }

  for (const upstreamNode of downstreamNodes) {
    visit(upstreamNode, '', undefined, undefined);
  }
  return { sortedNodes, outgoingEdgeMaps }
}
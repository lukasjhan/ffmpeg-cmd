import { DagEdge, IncomingEdgeMap, KwargReprNode, Label, Selector } from "./daq";
import { compile, filter, output } from "./ffmpeg";
import { getHashCode } from "./utils";

enum STREAM_TYPE {
  FILTERABLE_STREAM,
  OUTPUT_STREAM,
}

enum NODE_TYPE {
  INPUT,
  FILTER,
  OUTPUT,
}

type StreamMap = Map<Label, Stream>;

export class Stream {
  public node: Node;
  public label: Label;
  public selector: Selector;
  public readonly hash: number; 

  constructor(upstreamNode: Node, upstreamLabel: Label, upstreamSelector: Selector | undefined = undefined) {
    this.node = upstreamNode;
    this.label = upstreamLabel;
    this.selector = upstreamSelector;
    this.hash = this.node.hash + getHashCode(this.label);
  }

  public eq = (other: Stream) => {
    return this.hash === other.hash;
  }

  public get = (item: 'a' | 'v') => {
    if (this.selector !== undefined) {
      throw Error('already selected');
    }

    return this.node.stream(this.label, item);
  }

  public audio = () => {
    return this.node.stream(this.label, 'a');
  }

  public video = () => {
    return this.node.stream(this.label, 'v');
  }
}

export class FilterableStream extends Stream {
  constructor(upstreamNode: Node, upstreamLabel: Label, upstreamSelector: Selector = undefined) {
    super(upstreamNode, upstreamLabel, upstreamSelector);
  }

  public output = (filename: string, kwargs: Record<string, string> | string[] = {}) => {
    return output(this, filename, kwargs);
  }

  public filter = (filterName: string, kwargs: Record<string, string> | string[] = {}) => {
    return filter(this, filterName, kwargs);
  }
}

export class OutputStream extends Stream {
  constructor(upstreamNode: Node, upstreamLabel: Label, upstreamSelector: Selector = undefined) {
    super(upstreamNode, upstreamLabel, upstreamSelector);
  }

  public compile = (cmd: string = 'ffmpeg', overWriteOutput: boolean = true) => {
    return compile(this, cmd, overWriteOutput);
  }
}

const getStreamMapNode = (streamMap: StreamMap) => {
  const nodes: Node[] = [];
  streamMap.forEach((v, k) => {
    nodes.push(v.node);
  });
  return nodes;
}

export const getStreamSpecNode = (streamSpec: Stream) => {
  const streamMap = getStreamMap(streamSpec);
  return getStreamMapNode(streamMap);
}

const getStreamMap = (streamSpec: Stream | Stream[] | null): StreamMap => {
  if (streamSpec === null)
    return new Map();
  if (Array.isArray(streamSpec)) {
    const streamMap: StreamMap = new Map();
    streamSpec.forEach((v, i) => {
      streamMap.set(`${i}`, v);
    });
    return streamMap;
  }
  return new Map().set('', streamSpec);
}

const getIncomingEdgeMap = (streamMap: StreamMap): IncomingEdgeMap => {
  const incomingEdgeMap: IncomingEdgeMap = new Map();
  streamMap.forEach((value, key) => {
    const downstreamLabel = key;
    incomingEdgeMap.set(downstreamLabel, {upstreamNode: value.node, upstreamLabel: value.label, upstreamSelector: value.selector});
  })

  return incomingEdgeMap;
}

class Node extends KwargReprNode {
  private incomingStreamType: STREAM_TYPE | null;
  private outgoingStreamType: STREAM_TYPE;
  constructor(
    incomingEdgeMap: IncomingEdgeMap,
    name: string,
    incomingStreamType: STREAM_TYPE | null,
    outgoingStreamType: STREAM_TYPE,
    kwargs: Record<string, string> | string[] = {},
  ) {
    super(incomingEdgeMap, name, kwargs);
    this.incomingStreamType = incomingStreamType;
    this.outgoingStreamType = outgoingStreamType;
  }

  public stream = (label: Label = '', upstreamSelector: Selector = undefined): Stream => {
    switch(this.outgoingStreamType) {
      case STREAM_TYPE.FILTERABLE_STREAM: {
        return new FilterableStream(this, label, upstreamSelector);
      }
      case STREAM_TYPE.OUTPUT_STREAM: {
        return new OutputStream(this, label, upstreamSelector);
      }
      default:
        throw Error('no stream type');
    }
  }
}

export class InputNode extends Node {
  constructor(name: string, kwarg: Record<string, string> | string[] = {}) {
    super(new Map(), name, null, STREAM_TYPE.FILTERABLE_STREAM, kwarg);
  }
  
  public stream = (label: Label = '', upstreamSelector: Selector = undefined): FilterableStream => {
    return new FilterableStream(this, label, upstreamSelector);
  }
}

export class FilterNode extends Node {
  constructor(streamSpec: Stream | Stream[], name: string, kwargs: Record<string, string> | string[] = {}) {
    super(getIncomingEdgeMap(getStreamMap(streamSpec)), name, STREAM_TYPE.FILTERABLE_STREAM, STREAM_TYPE.FILTERABLE_STREAM, kwargs);
  }

  public stream = (label: Label = '', upstreamSelector: Selector = undefined): FilterableStream => {
    return new FilterableStream(this, label, upstreamSelector);
  }

  public getFilter = () => {
    const filterName = this.name;
    const kwargs = this.kwargs;
    const keys = Object.keys(kwargs);
    const filterParams: string[] = keys.map((key) => {
      const value = kwargs[key];
      return `${key}=${value}`;
    });

    if (filterParams.length > 0) {
      const paramText = filterParams.join(':');
      const filterString = `${filterName}=${paramText}`;
      return filterString;
    } else {
      return filterName;
    }
  }
}

export class OutputNode extends Node {
  constructor(stream: Stream | Stream[], name: string, kwargs: Record<string, string> | string[] = {}) {
    super(getIncomingEdgeMap(getStreamMap(stream)), name, STREAM_TYPE.FILTERABLE_STREAM, STREAM_TYPE.OUTPUT_STREAM, kwargs);
  }

  public stream = (label: Label = '', upstreamSelector: Selector = undefined): OutputStream => {
    return new OutputStream(this, label, upstreamSelector);
  }
}
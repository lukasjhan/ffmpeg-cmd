import { DagEdge, DagNode, getOutgoingEdges, KwargReprNode, OutgoingEdgeMap, topoSort } from "./daq";
import { FilterNode, getStreamSpecNode, InputNode, OutputNode, OutputStream, Stream } from "./node";
import { filterUndefined } from './utils';

export const input = (filename: string, kwargs: {[key: string]: string } = {}) => {
  kwargs['filename'] = filename;
  return new InputNode('input', [], kwargs).stream();
}

export const output = (stream: Stream, filename: string, kwargs: {[key: string]: string } = {}) => {
  kwargs['filename'] = filename;
  return new OutputNode(stream, 'output', kwargs).stream();
}

export const compile = (streamSpec: Stream, cmd: string = 'ffmpeg', overWriteOutput: boolean = false) => {
  const cmds: string[] = [cmd, '-hide_banner', ...getArgs(streamSpec)];
  if (overWriteOutput) {
    cmds.push('-y');
  }
  return cmds;
}

export const filter = (streamSpec: Stream | Stream[], filterName: string, kwargs: {[key: string]: string } = {}) => {
  return new FilterNode(streamSpec, filterName, kwargs).stream();
}

const getArgs = (streamSpec: Stream): string[] => {
  const nodes = getStreamSpecNode(streamSpec);
  const args: string[] = [];

  const { sortedNodes, outgoingEdgeMaps } = topoSort(nodes);
  const inputNodes = sortedNodes.filter((node) => node instanceof InputNode);
  const outputNodes = sortedNodes.filter((node) => node instanceof OutputNode);
  const filterNodes = sortedNodes.filter((node) => node instanceof FilterNode);

  inputNodes.forEach((node) => {
    if (node instanceof KwargReprNode) {
      const inputArgs = getInputArgs(node);
      args.push(...inputArgs);
    }
  });

  const streamNameMap: Map<string, string> = new Map();
  inputNodes.forEach((node, i) => {
    const key = `${node.hash}_${''}`;
    streamNameMap.set(key, `${i}`);
  });

  const filterArgs: string = getFilterArgs(filterNodes, outgoingEdgeMaps, streamNameMap);
  if (filterArgs.length > 0) {
    args.push('-filter_complex');
    args.push(filterArgs);
  }
  
  outputNodes.forEach((node) => {
    if (node instanceof KwargReprNode) {
      const outputArgs = getOutputArgs(node, streamNameMap);
      args.push(...outputArgs);
    }
  });

  return args;
}

const allocateFilterStreamName = (
  filterNodes: FilterNode[], 
  outgoingEdgeMaps: Map<DagNode, OutgoingEdgeMap>, 
  streamNameMap: Map<string, string>
) => {
  let streamCount = 0;
  for (const upstreamNode of filterNodes) {
    const outgoingEdgeMap = outgoingEdgeMaps.get(upstreamNode) ?? new Map();
    outgoingEdgeMap.forEach((value, key) => {
      const upstreamLabel = key;
      const downstreams = value;

      if (downstreams.length > 1) {
        throw new Error('error1');
      }
      const nameMapkey = `${upstreamNode.hash}_${upstreamLabel}`;
      streamNameMap.set(nameMapkey, `s${streamCount}`);
      streamCount += 1;
    })
  } 
}

const getFilterSpec = (node: FilterNode, outgoingEdgeMap: OutgoingEdgeMap, streamNameMap: Map<string, string>): string => {
  const incomingEdges = node.getIncomingEdges();
  const outgoingEdges = getOutgoingEdges(node, outgoingEdgeMap);
  const inputs: string[] = incomingEdges.map((edge) => {
    return formatInputStreamName(streamNameMap, edge);
  });
  const outputs: string[] = outgoingEdges.map((edge) => {
    return formatOutputStreamName(streamNameMap, edge);
  });
  const filterSpec = `${inputs.join('')}${node.getFilter()}${outputs.join('')}`;
  return filterSpec;
}

const getFilterArgs = (nodes: DagNode[], outgoingEdgeMaps: Map<DagNode, OutgoingEdgeMap>, streamNameMap: Map<string, string>): string => {
  const filterNodes = nodes.map((node) => {
    if (node instanceof FilterNode) {
      return node;
    }
    return undefined;
  }).filter(filterUndefined);

  allocateFilterStreamName(filterNodes, outgoingEdgeMaps, streamNameMap);

  const filterSpec: string[] = filterNodes.map((node) => {
    const outgoingEdgeMap: OutgoingEdgeMap = outgoingEdgeMaps.get(node) ?? new Map();
    return getFilterSpec(node, outgoingEdgeMap, streamNameMap);
  });

  return filterSpec.join(';');
}

const formatInputStreamName = (streamNameMap: Map<string, string>, edge: DagEdge, isFinalArg: boolean = false): string => {
  const key = `${edge.upstreamNode.hash}_${edge.upstreamLabel}`;
  const prefix: string | undefined = streamNameMap.get(key);
  let suffix = '';

  if (prefix !== undefined && edge.upstreamSelector !== undefined) {
    suffix = `:${edge.upstreamSelector}`;
  }

  if (isFinalArg && edge.upstreamNode instanceof InputNode) {
    return `${prefix}${suffix}`;
  }
  else {
    return `[${prefix}${suffix}]`;
  }
}

const formatOutputStreamName = (streamNameMap: Map<string, string>, edge: DagEdge): string => {
  const key = `${edge.upstreamNode.hash}_${edge.upstreamLabel}`;
  return `[${streamNameMap.get(key)}]`;
}

const getOutputArgs = (outputNode: KwargReprNode, streamNameMap: Map<string, string>): string[] => {
  const args: string[] = [];

  const incomingEdges = outputNode.getIncomingEdges();
  incomingEdges.forEach((edge) => {
    const streamName = formatInputStreamName(streamNameMap, edge, true);
    if (streamName != '0' || incomingEdges.length > 1) {
      args.push('-map');
      args.push(streamName);
    }
  });
  const kwargs = outputNode.kwargs;
  const filename = kwargs['filename'];
  const outputArgs = [...args, ...convertKwargsToCmdArgs(kwargs), filename];

  return outputArgs;
}

const getInputArgs = (inputNode: KwargReprNode) => {
  const kwargs = inputNode.kwargs;
  const filename = kwargs['filename'];
  const args: string[] = [...convertKwargsToCmdArgs(kwargs), '-i', filename];
  return args;
}

const convertKwargsToCmdArgs = (kwargs: {[key: string]: string}) => {
  const args: string[] = [];
  for (const key of Object.keys(kwargs)) {
    if (key === 'filename') continue;
    const value = kwargs[key];
    args.push(`-${key}`);
    args.push(value);
  }
  return args;
}
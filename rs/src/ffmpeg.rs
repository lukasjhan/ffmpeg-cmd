use crate::daq::{
  DagEdge, DagNode, get_outgoing_edges, get_stream_spec_node, KwargReprNode, OutgoingEdgeMap,
  topo_sort,
};
use crate::node::{FilterNode, InputNode, OutputNode, Stream};
use crate::utils::filter_undefined;

pub fn input(filename: &str, kwargs: &mut std::collections::HashMap<String, String>) -> Stream {
  kwargs.insert(String::from("filename"), String::from(filename));
  InputNode::new(String::from("input"), vec![], kwargs.clone()).stream()
}

pub fn output(stream: Stream, filename: &str, kwargs: &mut std::collections::HashMap<String, String>) -> Stream {
  kwargs.insert(String::from("filename"), String::from(filename));
  OutputNode::new(stream, String::from("output"), kwargs.clone()).stream()
}

pub fn compile(stream_spec: &Stream, cmd: &str, overwrite_output: bool) -> Vec<String> {
  let mut cmds: Vec<String> = vec![String::from(cmd)];
  cmds.append(&mut get_args(stream_spec, overwrite_output));
  if overwrite_output {
      cmds.push(String::from("-y"));
  }
  cmds
}

pub fn filter(stream_spec: &Stream, filter_name: &str, kwargs: &mut std::collections::HashMap<String, String>) -> Stream {
  FilterNode::new(stream_spec.clone(), String::from(filter_name), kwargs.clone()).stream()
}

fn get_args(stream_spec: &Stream, overwrite_output: bool) -> Vec<String> {
  let nodes = get_stream_spec_node(stream_spec);
  let mut args: Vec<String> = vec![];

  let (sorted_nodes, outgoing_edge_maps) = topo_sort(&nodes);
  let input_nodes: Vec<&DagNode> = sorted_nodes.iter().filter(|node| node.is::<InputNode>()).collect();
  let output_nodes: Vec<&DagNode> = sorted_nodes.iter().filter(|node| node.is::<OutputNode>()).collect();
  let filter_nodes: Vec<&DagNode> = sorted_nodes.iter().filter(|node| node.is::<FilterNode>()).collect();

  for node in input_nodes {
      if let Some(kwarg_repr_node) = node.downcast_ref::<KwargReprNode>() {
          let input_args = get_input_args(kwarg_repr_node);
          args.extend(input_args);
      }
  }

  let mut stream_name_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
  for (i, input_node) in input_nodes.iter().enumerate() {
      let key = format!("{}_{}", input_node.hash(), "");
      stream_name_map.insert(key, format!("s{}", i));
  }

  let filter_args = get_filter_args(&filter_nodes, &outgoing_edge_maps, &mut stream_name_map);
  if !filter_args.is_empty() {
      args.push(String::from("-filter_complex"));
      args.push(filter_args);
  }

  for node in output_nodes {
      if let Some(kwarg_repr_node) = node.downcast_ref::<KwargReprNode>() {
          let output_args = get_output_args(kwarg_repr_node, &stream_name_map);
          args.extend(output_args);
      }
  }

  if overwrite_output && output_nodes.is_empty() {
      args.push(String::from("-y"));
  }

  args
}

fn allocate_filter_stream_name(filter_nodes: &[FilterNode], outgoing_edge_maps: &HashMap<DagNode, OutgoingEdgeMap>, stream_name_map: &mut HashMap<String, String>) {
    let mut stream_count = 0;
    for upstream_node in filter_nodes {
        let outgoing_edge_map = outgoing_edge_maps.get(upstream_node).unwrap_or(&OutgoingEdgeMap::new());
        for (key, value) in outgoing_edge_map.iter() {
            let upstream_label = key;
            let downstreams = value;
            if downstreams.len() > 1 {
                panic!("error1");
            }
            let name_map_key = format!("{}_{}", upstream_node.hash, upstream_label);
            stream_name_map.insert(name_map_key, format!("s{}", stream_count));
            stream_count += 1;
        }
    }
}

fn get_filter_spec(node: &FilterNode, outgoing_edge_map: &OutgoingEdgeMap, stream_name_map: &HashMap<String, String>) -> String {
    let incoming_edges = node.get_incoming_edges();
    let outgoing_edges = get_outgoing_edges(node, outgoing_edge_map);
    let inputs: Vec<String> = incoming_edges.iter().map(|edge| {
        format_input_stream_name(stream_name_map, edge)
    }).collect();
    let outputs: Vec<String> = outgoing_edges.iter().map(|edge| {
        format_output_stream_name(stream_name_map, edge)
    }).collect();
    let filter_spec = format!("{}{}{}", inputs.join(""), node.get_filter(), outputs.join(""));
    filter_spec
}

fn get_filter_args(nodes: &[DagNode], outgoing_edge_maps: &HashMap<DagNode, OutgoingEdgeMap>, stream_name_map: &mut HashMap<String, String>) -> String {
    let filter_nodes: Vec<&FilterNode> = nodes.iter().filter_map(|node| {
        if let Some(filter_node) = node.downcast_ref::<FilterNode>() {
            Some(filter_node)
        } else {
            None
        }
    }).collect();
    allocate_filter_stream_name(&filter_nodes, outgoing_edge_maps, stream_name_map);
    let filter_spec: Vec<String> = filter_nodes.iter().map(|node| {
        let outgoing_edge_map = outgoing_edge_maps.get(node).unwrap_or(&OutgoingEdgeMap::new());
        get_filter_spec(node, outgoing_edge_map, stream_name_map)
    }).collect();
    filter_spec.join(";")
}

fn format_input_stream_name(stream_name_map: &HashMap<String, String>, edge: &DagEdge, is_final_arg: bool) -> String {
    let key = format!("{}_{}", edge.upstream_node.hash, edge.upstream_label);
    let prefix = stream_name_map.get(&key).unwrap_or(&"".to_string()).clone();
    let mut suffix = "".to_string();
    if let Some(upstream_selector) = &edge.upstream_selector {
        suffix = format!(":{}", upstream_selector);
    }
    if is_final_arg && edge.upstream_node.downcast_ref::<InputNode>().is_some() {
        format!("{}{}", prefix, suffix)
    } else {
        format!("[{}{}]", prefix, suffix)
    }
}

fn format_output_stream_name(stream_name_map: &HashMap<String, String>, edge: &DagEdge) -> String {
    let key = format!("{}_{}", edge.upstream_node.hash, edge.upstream_label);
    format!("[{}]", stream_name_map.get(&key).unwrap_or(&"".to_string()))
}

fn get_output_args(output_node: &KwargReprNode, stream_name_map: &HashMap<String, String>) -> Vec<String> {
  let mut args: Vec<String> = Vec::new();

  let incoming_edges = output_node.get_incoming_edges();
  for edge in incoming_edges {
      let stream_name = format_input_stream_name(stream_name_map, &edge, true);
      if stream_name != "0" || incoming_edges.len() > 1 {
          args.push("-map".to_owned());
          args.push(stream_name);
      }
  }

  let kwargs = &output_node.kwargs;
  let filename = &kwargs["filename"];
  let mut output_args = args;
  output_args.append(&mut convert_kwargs_to_cmd_args(kwargs));
  output_args.push(filename.to_owned());

  return output_args;
}

fn get_input_args(input_node: &KwargReprNode) -> Vec<String> {
  let kwargs = &input_node.kwargs;
  let filename = &kwargs["filename"];
  let mut args = convert_kwargs_to_cmd_args(kwargs);
  args.push("-i".to_owned());
  args.push(filename.to_owned());
  return args;
}

fn convert_kwargs_to_cmd_args(kwargs: &HashMap<String, String>) -> Vec<String> {
  let mut args: Vec<String> = Vec::new();
  for (key, value) in kwargs {
      if key == "filename" {
          continue;
      }
      args.push(format!("-{}", key));
      args.push(value.to_owned());
  }
  return args;
}
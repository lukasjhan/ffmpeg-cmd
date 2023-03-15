use std::collections::HashMap;
use std::hash::{Hash, Hasher};

#[derive(PartialEq, Eq, Hash)]
enum STREAM_TYPE {
    FILTERABLE_STREAM,
    OUTPUT_STREAM,
}

#[derive(PartialEq, Eq, Hash)]
enum NODE_TYPE {
    INPUT,
    FILTER,
    OUTPUT,
}

struct Node {
  incoming_edge_map: IncomingEdgeMap,
  name: String,
  incoming_stream_type: Option<STREAM_TYPE>,
  outgoing_stream_type: STREAM_TYPE,
  kwargs: HashMap<String, String>,
}

impl Node {
  fn new(
      incoming_edge_map: IncomingEdgeMap,
      name: String,
      incoming_stream_type: Option<STREAM_TYPE>,
      outgoing_stream_type: STREAM_TYPE,
      kwargs: HashMap<String, String>,
  ) -> Node {
      Node {
          incoming_edge_map,
          name,
          incoming_stream_type,
          outgoing_stream_type,
          kwargs,
      }
  }

  fn stream(&self, label: Label, upstream_selector: Selector) -> Stream {
      match self.outgoing_stream_type {
          STREAM_TYPE::FILTERABLE_STREAM => {
              Stream::new_filterable_stream(self, label, upstream_selector)
          }
          STREAM_TYPE::OUTPUT_STREAM => {
              Stream::new_output_stream(self, label, upstream_selector)
          }
      }
  }
}

struct InputNode {
  node: Node,
}

impl InputNode {
  fn new(name: String, args: Vec<String>, kwargs: HashMap<String, String>) -> InputNode {
      InputNode {
          node: Node::new(
              HashMap::new(),
              name,
              None,
              STREAM_TYPE::FILTERABLE_STREAM,
              kwargs,
          ),
      }
  }

  fn stream(&self, label: Label, upstream_selector: Selector) -> FilterableStream {
      FilterableStream::new(&self.node, label, upstream_selector)
  }
}

struct FilterNode {
  node: Node,
}

impl FilterNode {
  fn new(stream_spec: &StreamSpec, name: String, kwargs: HashMap<String, String>) -> FilterNode {
      FilterNode {
          node: Node::new(
              get_incoming_edge_map(get_stream_map(stream_spec)),
              name,
              Some(STREAM_TYPE::FILTERABLE_STREAM),
              STREAM_TYPE::FILTERABLE_STREAM,
              kwargs,
          ),
      }
  }

  fn stream(&self, label: Label, upstream_selector: Selector) -> FilterableStream {
      FilterableStream::new(&self.node, label, upstream_selector)
  }

  fn get_filter(&self) -> String {
      let filter_name = &self.node.name;
      let kwargs = &self.node.kwargs;
      let filter_params: Vec<String> = kwargs
          .iter()
          .map(|(key, value)| format!("{}={}", key, value))
          .collect();
      if filter_params.is_empty() {
          filter_name.to_string()
      } else {
          format!("{}={}", filter_name, filter_params.join(":"))
      }
  }
}

pub struct OutputNode<'a> {
    node: Node,
    pub streams: Vec<OutputStream<'a>>,
}

impl<'a> OutputNode<'a> {
    pub fn new(stream: &Stream, name: &str, kwargs: HashMap<String, String>) -> OutputNode {
        let stream_map = get_stream_map(stream);
        let incoming_edge_map = get_incoming_edge_map(&stream_map);
        let node = Node::new(&incoming_edge_map, name, STREAM_TYPE_FILTERABLE_STREAM, STREAM_TYPE_OUTPUT_STREAM, kwargs);
        let streams = stream_map.iter().map(|(label, stream)| {
            OutputStream::new(&node, label.clone(), stream.selector.clone())
        }).collect();

        OutputNode {
            node,
            streams,
        }
    }

    pub fn stream(&self, label: &str, upstream_selector: Option<&Selector>) -> OutputStream {
        let upstream_selector = upstream_selector.cloned();
        OutputStream::new(&self.node, label.to_string(), upstream_selector)
    }
}

#[derive(PartialEq, Eq, Hash)]
struct Stream {
  node: Node,
  label: Label,
  selector: Selector,
  hash: u64,
}

impl Stream {
    pub fn new(node: Node, label: Label, selector: Selector) -> Self {
        let mut hash = node.hash();
        hash += label.as_bytes().iter().fold(0, |acc, x| acc + (*x as u64));
        Self { node, label, selector, hash }
    }

    pub fn eq(&self, other: &Self) -> bool {
        self.hash == other.hash
    }

    pub fn get(&self, item: &'static str) -> Result<Stream, String> {
        if self.selector.is_some() {
            return Err("Already selected".to_string());
        }

        match item {
            "a" => Ok(self.node.stream(&self.label, "a")),
            "v" => Ok(self.node.stream(&self.label, "v")),
            _ => Err(format!("Invalid item: {}", item)),
        }
    }

    pub fn audio(&self) -> Result<Stream, String> {
        self.get("a")
    }

    pub fn video(&self) -> Result<Stream, String> {
        self.get("v")
    }
}

pub struct FilterableStream(Stream);

impl FilterableStream {
    pub fn new(stream: Stream) -> Self {
        Self(stream)
    }

    pub fn output(&self, filename: &str, kwargs: HashMap<String, String>) -> Result<(), String> {
        output(&self.0, filename, kwargs);
        Ok(())
    }

    pub fn filter(&self, filter_name: &str, kwargs: HashMap<String, String>) -> Result<Stream, String> {
        filter(&self.0, filter_name, kwargs)
    }
}

pub struct OutputStream(Stream);

impl OutputStream {
    pub fn new(stream: Stream) -> Self {
        Self(stream)
    }

    pub fn compile(&self, cmd: &str, overwrite_output: bool) -> Result<(), String> {
        compile(&self.0, cmd, overwrite_output);
        Ok(())
    }
}

type StreamMap = HashMap<Label, Stream>;

fn get_stream_map_node(stream_map: &StreamMap) -> Vec<Node> {
    stream_map.values().map(|s| s.node.clone()).collect()
}

pub fn get_stream_spec_node(stream_spec: &Stream) -> Vec<Node> {
    let stream_map = get_stream_map(stream_spec);
    get_stream_map_node(&stream_map)
}

fn get_stream_map(stream_spec: &Option<Box<[Stream]>>) -> StreamMap {
    match stream_spec {
        None => StreamMap::new(),
        Some(streams) => streams
            .iter()
            .enumerate()
            .map(|(i, s)| (i.to_string(), s.clone()))
            .collect(),
    }
}

fn get_incoming_edge_map(stream_map: &StreamMap) -> IncomingEdgeMap {
  let mut incoming_edge_map: IncomingEdgeMap = HashMap::new();
  for (key, value) in stream_map.iter() {
      let downstream_label = key.to_string();
      incoming_edge_map.insert(downstream_label, IncomingEdge {
          upstream_node: value.node,
          upstream_label: value.label.clone(),
          upstream_selector: value.selector.clone(),
      });
  }

  incoming_edge_map
}
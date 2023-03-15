use std::collections::{HashMap, HashSet};
use std::error::Error;

fn get_hash_code(obj: &impl std::hash::Hash) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    obj.hash(&mut hasher);
    hasher.finish()
}

type Label = String;
type Selector = Option<char>;
type IncomingEdgeMap = HashMap<Label, (Box<dyn DagNode>, Label, Selector)>;
type OutgoingEdgeMap = HashMap<Label, Vec<(Box<dyn DagNode>, Label, Selector)>>;

trait DagNode {
    fn hash(&self) -> u64;
    fn eq(&self, other: &dyn DagNode) -> bool;
    fn get_incoming_edge_map(&self) -> IncomingEdgeMap;
    fn get_incoming_edges(&self) -> Vec<DagEdge>;
}

struct KwargReprNode {
    name: String,
    incoming_edge_map: IncomingEdgeMap,
    kwargs: HashMap<String, String>,
    hash: u64,
    incoming_edges: Vec<DagEdge>,
}

impl KwargReprNode {
    fn new(incoming_edge_map: IncomingEdgeMap, name: String, kwargs: HashMap<String, String>) -> Self {
        let hash = Self::cal_hash(&name, &kwargs, &incoming_edge_map);
        let incoming_edges = Self::set_incoming_edges(&incoming_edge_map);
        Self {
            name,
            incoming_edge_map,
            kwargs,
            hash,
            incoming_edges,
        }
    }

    fn cal_hash(name: &str, kwargs: &HashMap<String, String>, incoming_edge_map: &IncomingEdgeMap) -> u64 {
        Self::get_inner_hash(name, kwargs) + Self::get_upstream_hash(incoming_edge_map)
    }

    fn get_inner_hash(name: &str, kwargs: &HashMap<String, String>) -> u64 {
        let obj = format!("{}{:?}", name, kwargs);
        get_hash_code(&obj)
    }

    fn get_upstream_hash(incoming_edge_map: &IncomingEdgeMap) -> u64 {
        incoming_edge_map
            .iter()
            .map(|(downstream_label, (upstream_node, upstream_label, upstream_selector))| {
                let values = format!(
                    "{:?}{:?}{:?}{:?}",
                    downstream_label, upstream_node.hash(), upstream_label, upstream_selector
                );
                get_hash_code(&values)
            })
            .sum()
    }

    fn set_incoming_edges(incoming_edge_map: &IncomingEdgeMap) -> Vec<DagEdge> {
        incoming_edge_map
            .iter()
            .map(|(downstream_label, (upstream_node, upstream_label, upstream_selector))| {
                DagEdge {
                    downstream_node: Box::new(Self {
                        name: "".to_string(),
                        incoming_edge_map: IncomingEdgeMap::new(),
                        kwargs: HashMap::new(),
                        hash: upstream_node.hash(),
                        incoming_edges: vec![],
                    }),
                    downstream_label: downstream_label.clone(),
                    upstream_node: upstream_node.clone(),
                    upstream_label: upstream_label.clone(),
                    upstream_selector: upstream_selector.clone(),
                }
            })
            .collect()
    }
}

fn get_incoming_edges<'a>(downstream_node: &'a DagNode, incoming_edge_map: &IncomingEdgeMap<'a>) -> Vec<&'a DagEdge<'a>> {
    let mut edges = Vec::new();
    for (key, value) in incoming_edge_map {
        let downstream_label = key;
        let upstream_node = value.upstream_node;
        let upstream_label = value.upstream_label;
        let upstream_selector = value.upstream_selector.clone();

        let edge = DagEdge {
            downstream_node,
            downstream_label: downstream_label.clone(),
            upstream_node,
            upstream_label: upstream_label.clone(),
            upstream_selector,
        };

        edges.push(edge);
    }
    edges
}

fn get_outgoing_edges<'a>(upstream_node: &'a DagNode, outgoing_edge_map: &OutgoingEdgeMap<'a>) -> Vec<&'a DagEdge<'a>> {
    let mut edges = Vec::new();
    for (key, value) in outgoing_edge_map {
        let upstream_label = key;
        let downstream_infos = value;
        for downstream_info in downstream_infos {
            let downstream_node = downstream_info.downstream_node;
            let downstream_label = downstream_info.downstream_label.clone();
            let downstream_selector = downstream_info.downstream_selector.clone();

            let edge = DagEdge {
                downstream_node,
                downstream_label,
                upstream_node,
                upstream_label: upstream_label.clone(),
                upstream_selector: downstream_selector,
            };

            edges.push(edge);
        }
    }
    edges
}

pub fn topo_sort(downstream_nodes: &[DagNode]) -> Result<(Vec<DagNode>, HashMap<&DagNode, HashMap<&str, Vec<DagEdge>>>>, Box<dyn Error>> {
    let mut marked_nodes: HashSet<&DagNode> = HashSet::new();
    let mut sorted_nodes: Vec<DagNode> = Vec::new();
    let mut outgoing_edge_maps: HashMap<&DagNode, HashMap<&str, Vec<DagEdge>>> = HashMap::new();

    fn visit<'a>(
        upstream_node: &'a DagNode,
        upstream_label: &str,
        downstream_node: Option<&'a DagNode>,
        downstream_label: Option<&str>,
        downstream_selector: Option<&Selector>,
        marked_nodes: &mut HashSet<&'a DagNode>,
        sorted_nodes: &mut Vec<DagNode>,
        outgoing_edge_maps: &mut HashMap<&'a DagNode, HashMap<&str, Vec<DagEdge>>>,
    ) -> Result<(), Box<dyn Error>> {
        if marked_nodes.contains(upstream_node) {
            return Err("Graph is not a DAG".into());
        }

        if let (Some(downstream_node), Some(downstream_label)) = (downstream_node, downstream_label) {
            let outgoing_edge_map = outgoing_edge_maps.entry(upstream_node).or_insert(HashMap::new());
            let outgoing_edge_infos = outgoing_edge_map.entry(downstream_label).or_insert(Vec::new());
            outgoing_edge_infos.push(DagEdge {
                downstream_node: downstream_node.clone(),
                downstream_label: downstream_label.to_owned(),
                upstream_node: upstream_node.clone(),
                upstream_label: upstream_label.to_owned(),
                upstream_selector: downstream_selector.cloned(),
            });
        }

        if !sorted_nodes.contains(upstream_node) {
            marked_nodes.insert(upstream_node);

            for edge in upstream_node.get_incoming_edges() {
                visit(
                    &edge.upstream_node,
                    &edge.upstream_label,
                    Some(&edge.downstream_node),
                    Some(&edge.upstream_label),
                    edge.upstream_selector.as_ref(),
                    marked_nodes,
                    sorted_nodes,
                    outgoing_edge_maps,
                )?;
            }

            marked_nodes.remove(upstream_node);
            sorted_nodes.push(upstream_node.clone());
        }

        Ok(())
    }

    for upstream_node in downstream_nodes {
        visit(
            upstream_node,
            "",
            None,
            None,
            None,
            &mut marked_nodes,
            &mut sorted_nodes,
            &mut outgoing_edge_maps,
        )?;
    }

    Ok((sorted_nodes, outgoing_edge_maps))
}
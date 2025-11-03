//! Audio graph module for node-based audio processing
//!
//! This module provides a flexible, composable audio processing system based on
//! a directed acyclic graph (DAG) of audio nodes. Nodes can be sources (produce audio),
//! processors (transform audio), or sinks (consume audio).
//!
//! # Architecture Overview
//!
//! ```text
//! ┌─────────────┐
//! │   Sources   │  AudioSource trait
//! │  (produce)  │  - MicrophoneSource
//! └──────┬──────┘  - SystemAudioSource
//!        │         - FileSource
//!        ↓
//! ┌─────────────┐
//! │ Processors  │  AudioProcessor trait
//! │ (transform) │  - Mixer
//! └──────┬──────┘  - Resampler
//!        │         - VolumeControl
//!        ↓         - SilenceDetector
//! ┌─────────────┐
//! │   Sinks     │  AudioSink trait
//! │  (consume)  │  - EncoderSink (WAV, MP3)
//! └─────────────┘  - BufferSink
//!                  - NullSink
//! ```
//!
//! # Design Decisions
//!
//! ## Pull-based Processing
//!
//! The graph uses a **pull-based** model where sinks pull data from sources:
//! - Sinks call `process_once()` to pull one buffer through the graph
//! - Sources produce data on-demand (may buffer internally)
//! - Processors transform data as it flows through
//!
//! **Why pull?** Better backpressure handling. If a sink is slow (e.g., writing to disk),
//! it naturally slows down the entire graph without needing explicit coordination.
//!
//! ## Single-threaded Processing
//!
//! Each graph runs in a single thread (but multiple graphs can run in parallel):
//! - Simpler reasoning about data flow
//! - No need for complex synchronization between nodes
//! - Predictable latency characteristics
//! - Still allows parallelism at the graph level (one graph per recording)
//!
//! **Why single-threaded?** Audio processing is latency-sensitive. Multi-threaded
//! processing adds complexity (synchronization overhead, unpredictable scheduling)
//! without significant benefit for typical workloads.
//!
//! ## Error Handling Strategy
//!
//! Errors propagate through the graph with **fail-fast** semantics:
//! - Any node error stops the current processing iteration
//! - Errors are logged and exposed to the caller
//! - Graph state is preserved (can retry or modify configuration)
//! - Graceful degradation is possible (e.g., skip one source if it fails)
//!
//! # Usage Example
//!
//! ```rust,no_run
//! use audio::graph::{AudioGraph, AudioNode};
//! use audio::sources::MicrophoneSource;
//! use audio::sinks::WavEncoderSink;
//!
//! // Create graph
//! let mut graph = AudioGraph::new();
//!
//! // Add nodes
//! let mic_id = graph.add_source(Box::new(MicrophoneSource::new()?));
//! let encoder_id = graph.add_sink(Box::new(WavEncoderSink::new("output.wav")?));
//!
//! // Connect nodes
//! graph.connect(mic_id, encoder_id)?;
//!
//! // Start processing
//! graph.start()?;
//!
//! // Process audio (in loop or separate thread)
//! while graph.is_active() {
//!     graph.process_once()?;
//! }
//!
//! graph.stop()?;
//! ```

pub mod traits;
pub mod sources;
pub mod processors;

#[cfg(test)]
pub mod prototype_demo;

#[cfg(test)]
mod integration_tests;

pub use traits::{
    AudioBuffer, AudioError, AudioFormat, AudioProcessor, AudioSink, AudioSource,
    ProcessorStats, SampleFormat, SinkStats, SourceStats,
};

pub use sources::MicrophoneSource;
pub use processors::Mixer;
// Note: Sinks are now in audio::sinks module, not audio::graph::sinks

use std::collections::{HashMap, HashSet, VecDeque};

/// Unique identifier for a node in the graph
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct NodeId(usize);

impl NodeId {
    fn new(id: usize) -> Self {
        Self(id)
    }

    pub fn as_usize(&self) -> usize {
        self.0
    }
}

/// Node in the audio graph
pub enum AudioNode {
    /// Audio source (produces buffers)
    Source(Box<dyn AudioSource>),
    /// Audio processor (transforms buffers)
    Processor(Box<dyn AudioProcessor>),
    /// Audio sink (consumes buffers)
    Sink(Box<dyn AudioSink>),
}

impl AudioNode {
    /// Get node type as string
    pub fn node_type(&self) -> &str {
        match self {
            AudioNode::Source(_) => "source",
            AudioNode::Processor(_) => "processor",
            AudioNode::Sink(_) => "sink",
        }
    }

    /// Get node name
    pub fn name(&self) -> &str {
        match self {
            AudioNode::Source(s) => s.name(),
            AudioNode::Processor(p) => p.name(),
            AudioNode::Sink(s) => s.name(),
        }
    }
}

/// Connection between two nodes in the graph
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Edge {
    from: NodeId,
    to: NodeId,
}

/// Graph state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GraphState {
    /// Graph is idle (not processing)
    Idle,
    /// Graph is starting (initializing nodes)
    Starting,
    /// Graph is active (processing audio)
    Active,
    /// Graph is stopping (cleaning up nodes)
    Stopping,
    /// Graph has an error
    Error,
}

/// Audio graph manages a DAG of audio nodes
///
/// The graph maintains nodes and their connections, validates the topology,
/// and orchestrates audio processing flow.
pub struct AudioGraph {
    /// All nodes in the graph
    nodes: HashMap<NodeId, AudioNode>,
    /// Edges (connections) between nodes
    edges: Vec<Edge>,
    /// Current graph state
    state: GraphState,
    /// Next node ID to assign
    next_node_id: usize,
    /// Topologically sorted node order (for processing)
    processing_order: Vec<NodeId>,
    /// Buffer storage between nodes (from_id -> buffer queue)
    buffers: HashMap<NodeId, VecDeque<AudioBuffer>>,
    /// Maximum buffer size per connection (prevents unbounded memory growth)
    max_buffer_size: usize,
}

impl AudioGraph {
    /// Create a new empty audio graph
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: Vec::new(),
            state: GraphState::Idle,
            next_node_id: 0,
            processing_order: Vec::new(),
            buffers: HashMap::new(),
            max_buffer_size: 20000, // 20,000 buffers per connection (massive headroom)
        }
    }

    /// Set maximum buffer size per connection
    pub fn set_max_buffer_size(&mut self, size: usize) {
        self.max_buffer_size = size;
    }

    /// Add a source node to the graph
    pub fn add_source(&mut self, source: Box<dyn AudioSource>) -> NodeId {
        let id = self.allocate_node_id();
        self.nodes.insert(id, AudioNode::Source(source));
        id
    }

    /// Add a processor node to the graph
    pub fn add_processor(&mut self, processor: Box<dyn AudioProcessor>) -> NodeId {
        let id = self.allocate_node_id();
        self.nodes.insert(id, AudioNode::Processor(processor));
        id
    }

    /// Add a sink node to the graph
    pub fn add_sink(&mut self, sink: Box<dyn AudioSink>) -> NodeId {
        let id = self.allocate_node_id();
        self.nodes.insert(id, AudioNode::Sink(sink));
        id
    }

    /// Remove a node from the graph
    ///
    /// This also removes all edges connected to this node.
    pub fn remove_node(&mut self, node_id: NodeId) -> Result<(), AudioError> {
        if self.state == GraphState::Active {
            return Err(AudioError::InvalidState(
                "Cannot remove node while graph is active".to_string(),
            ));
        }

        // Remove all edges connected to this node
        self.edges.retain(|e| e.from != node_id && e.to != node_id);

        // Remove the node
        self.nodes
            .remove(&node_id)
            .ok_or_else(|| AudioError::ConfigurationError(format!("Node {:?} not found", node_id)))?;

        // Remove buffer queue
        self.buffers.remove(&node_id);

        Ok(())
    }

    /// Connect two nodes in the graph
    ///
    /// Creates a directed edge from `from_id` to `to_id`. Audio will flow
    /// from the `from` node to the `to` node.
    ///
    /// # Validation
    ///
    /// This method validates:
    /// - Both nodes exist
    /// - Connection doesn't create a cycle
    /// - Format compatibility (if applicable)
    pub fn connect(&mut self, from_id: NodeId, to_id: NodeId) -> Result<(), AudioError> {
        if self.state == GraphState::Active {
            return Err(AudioError::InvalidState(
                "Cannot modify connections while graph is active".to_string(),
            ));
        }

        // Validate nodes exist
        if !self.nodes.contains_key(&from_id) {
            return Err(AudioError::ConfigurationError(format!(
                "Source node {:?} not found",
                from_id
            )));
        }
        if !self.nodes.contains_key(&to_id) {
            return Err(AudioError::ConfigurationError(format!(
                "Target node {:?} not found",
                to_id
            )));
        }

        // Check if connection already exists
        if self.edges.iter().any(|e| e.from == from_id && e.to == to_id) {
            return Err(AudioError::ConfigurationError(format!(
                "Connection from {:?} to {:?} already exists",
                from_id, to_id
            )));
        }

        // Add edge
        self.edges.push(Edge {
            from: from_id,
            to: to_id,
        });

        // Validate no cycles
        if self.has_cycle() {
            // Remove the edge we just added
            self.edges.pop();
            return Err(AudioError::ConfigurationError(
                "Connection would create a cycle".to_string(),
            ));
        }

        // Initialize buffer queue for this connection
        self.buffers.entry(from_id).or_insert_with(VecDeque::new);

        Ok(())
    }

    /// Disconnect two nodes
    pub fn disconnect(&mut self, from_id: NodeId, to_id: NodeId) -> Result<(), AudioError> {
        if self.state == GraphState::Active {
            return Err(AudioError::InvalidState(
                "Cannot modify connections while graph is active".to_string(),
            ));
        }

        let initial_len = self.edges.len();
        self.edges.retain(|e| !(e.from == from_id && e.to == to_id));

        if self.edges.len() == initial_len {
            return Err(AudioError::ConfigurationError(format!(
                "Connection from {:?} to {:?} not found",
                from_id, to_id
            )));
        }

        Ok(())
    }

    /// Start the audio graph
    ///
    /// This initializes all nodes and begins processing.
    pub fn start(&mut self) -> Result<(), AudioError> {
        if self.state == GraphState::Active {
            return Ok(()); // Already started
        }

        self.state = GraphState::Starting;

        // Validate graph structure
        self.validate()?;

        // Compute topological sort for processing order
        self.processing_order = self.topological_sort()?;

        // Start all source nodes
        for node_id in &self.processing_order {
            if let Some(AudioNode::Source(source)) = self.nodes.get_mut(node_id) {
                source.start().map_err(|e| {
                    self.state = GraphState::Error;
                    e
                })?;
            }
        }

        self.state = GraphState::Active;
        Ok(())
    }

    /// Stop the audio graph
    ///
    /// This stops all nodes and flushes all sinks.
    pub fn stop(&mut self) -> Result<(), AudioError> {
        if self.state != GraphState::Active {
            return Ok(()); // Already stopped
        }

        self.state = GraphState::Stopping;

        // Stop all source nodes (in reverse processing order)
        for node_id in self.processing_order.iter().rev() {
            match self.nodes.get_mut(node_id) {
                Some(AudioNode::Source(source)) => {
                    if let Err(e) = source.stop() {
                        eprintln!("Error stopping source {}: {}", source.name(), e);
                    }
                }
                Some(AudioNode::Sink(sink)) => {
                    if let Err(e) = sink.flush() {
                        eprintln!("Error flushing sink {}: {}", sink.name(), e);
                    }
                }
                _ => {}
            }
        }

        // Clear all buffers
        for queue in self.buffers.values_mut() {
            queue.clear();
        }

        self.state = GraphState::Idle;
        Ok(())
    }

    /// Process one iteration of the graph
    ///
    /// This pulls one buffer through the entire graph, from sources to sinks.
    /// Call this in a loop to continuously process audio.
    ///
    /// Returns `Ok(true)` if processing occurred, `Ok(false)` if no data was available.
    pub fn process_once(&mut self) -> Result<bool, AudioError> {
        if self.state != GraphState::Active {
            return Err(AudioError::InvalidState(
                "Graph is not active".to_string(),
            ));
        }

        let mut processed_any = false;

        // Process nodes in topological order
        for &node_id in &self.processing_order.clone() {
            // Pre-compute upstream nodes before borrowing self.nodes mutably
            let upstream_nodes = self.get_upstream_nodes(node_id);

            match self.nodes.get_mut(&node_id) {
                Some(AudioNode::Source(source)) => {
                    // Read from source (one buffer per iteration for steady flow)
                    if let Some(buffer) = source.read()? {
                        // Store buffer for downstream nodes
                        if let Some(queue) = self.buffers.get_mut(&node_id) {
                            if queue.len() >= self.max_buffer_size {
                                return Err(AudioError::BufferError(format!(
                                    "Buffer overflow for source {}",
                                    source.name()
                                )));
                            }
                            queue.push_back(buffer);
                            processed_any = true;
                        }
                    }
                }
                Some(AudioNode::Processor(processor)) => {
                    // Get input buffers from upstream nodes (computed above)

                    // Process if we have input from all upstream nodes
                    let mut inputs = Vec::new();
                    for upstream_id in &upstream_nodes {
                        if let Some(queue) = self.buffers.get_mut(upstream_id) {
                            if let Some(buffer) = queue.pop_front() {
                                inputs.push(buffer);
                            }
                        }
                    }

                    // Only process if we have input
                    if !inputs.is_empty() {
                        // For now, process the first input (TODO: multi-input processors)
                        let input = inputs.into_iter().next().unwrap();
                        let output = processor.process(input)?;

                        // Store output for downstream nodes
                        if let Some(queue) = self.buffers.get_mut(&node_id) {
                            if queue.len() >= self.max_buffer_size {
                                return Err(AudioError::BufferError(format!(
                                    "Buffer overflow for processor {}",
                                    processor.name()
                                )));
                            }
                            queue.push_back(output);
                            processed_any = true;
                        }
                    }
                }
                Some(AudioNode::Sink(sink)) => {
                    // Get input buffers from upstream nodes (computed above)
                    for upstream_id in &upstream_nodes {
                        if let Some(queue) = self.buffers.get_mut(upstream_id) {
                            while let Some(buffer) = queue.pop_front() {
                                // Write ALL buffers (including empty ones from resampler accumulation)
                                // Empty buffers maintain pipeline flow and timing
                                sink.write(buffer)?;
                                processed_any = true;
                            }
                        }
                    }
                }
                None => {}
            }
        }

        Ok(processed_any)
    }

    /// Check if graph is currently active
    pub fn is_active(&self) -> bool {
        self.state == GraphState::Active
    }

    /// Get current graph state
    pub fn state(&self) -> GraphState {
        self.state
    }

    /// Get list of all node IDs
    pub fn node_ids(&self) -> Vec<NodeId> {
        self.nodes.keys().copied().collect()
    }

    /// Get node by ID
    pub fn get_node(&self, node_id: NodeId) -> Option<&AudioNode> {
        self.nodes.get(&node_id)
    }

    /// Validate graph structure
    fn validate(&self) -> Result<(), AudioError> {
        // Check for at least one source and one sink
        let has_source = self.nodes.values().any(|n| matches!(n, AudioNode::Source(_)));
        let has_sink = self.nodes.values().any(|n| matches!(n, AudioNode::Sink(_)));

        if !has_source {
            return Err(AudioError::ConfigurationError(
                "Graph must have at least one source".to_string(),
            ));
        }

        if !has_sink {
            return Err(AudioError::ConfigurationError(
                "Graph must have at least one sink".to_string(),
            ));
        }

        // Check for cycles
        if self.has_cycle() {
            return Err(AudioError::ConfigurationError(
                "Graph contains a cycle".to_string(),
            ));
        }

        // Check that all nodes are reachable
        let sources: Vec<NodeId> = self
            .nodes
            .iter()
            .filter_map(|(id, node)| {
                if matches!(node, AudioNode::Source(_)) {
                    Some(*id)
                } else {
                    None
                }
            })
            .collect();

        let reachable = self.reachable_nodes(&sources);
        if reachable.len() != self.nodes.len() {
            return Err(AudioError::ConfigurationError(
                "Not all nodes are reachable from sources".to_string(),
            ));
        }

        Ok(())
    }

    /// Check if graph contains a cycle using DFS
    fn has_cycle(&self) -> bool {
        let mut visited = HashSet::new();
        let mut rec_stack = HashSet::new();

        for node_id in self.nodes.keys() {
            if self.has_cycle_util(*node_id, &mut visited, &mut rec_stack) {
                return true;
            }
        }

        false
    }

    fn has_cycle_util(
        &self,
        node_id: NodeId,
        visited: &mut HashSet<NodeId>,
        rec_stack: &mut HashSet<NodeId>,
    ) -> bool {
        if rec_stack.contains(&node_id) {
            return true; // Found cycle
        }

        if visited.contains(&node_id) {
            return false; // Already processed
        }

        visited.insert(node_id);
        rec_stack.insert(node_id);

        // Check all neighbors
        for edge in &self.edges {
            if edge.from == node_id {
                if self.has_cycle_util(edge.to, visited, rec_stack) {
                    return true;
                }
            }
        }

        rec_stack.remove(&node_id);
        false
    }

    /// Compute topological sort of nodes for processing order
    fn topological_sort(&self) -> Result<Vec<NodeId>, AudioError> {
        let mut sorted = Vec::new();
        let mut visited = HashSet::new();
        let mut temp_mark = HashSet::new();

        for node_id in self.nodes.keys() {
            if !visited.contains(node_id) {
                self.topological_sort_util(*node_id, &mut visited, &mut temp_mark, &mut sorted)?;
            }
        }

        sorted.reverse();
        Ok(sorted)
    }

    fn topological_sort_util(
        &self,
        node_id: NodeId,
        visited: &mut HashSet<NodeId>,
        temp_mark: &mut HashSet<NodeId>,
        sorted: &mut Vec<NodeId>,
    ) -> Result<(), AudioError> {
        if temp_mark.contains(&node_id) {
            return Err(AudioError::ConfigurationError(
                "Graph contains a cycle".to_string(),
            ));
        }

        if !visited.contains(&node_id) {
            temp_mark.insert(node_id);

            // Visit all neighbors
            for edge in &self.edges {
                if edge.from == node_id {
                    self.topological_sort_util(edge.to, visited, temp_mark, sorted)?;
                }
            }

            temp_mark.remove(&node_id);
            visited.insert(node_id);
            sorted.push(node_id);
        }

        Ok(())
    }

    /// Get all upstream nodes (sources of incoming edges)
    fn get_upstream_nodes(&self, node_id: NodeId) -> Vec<NodeId> {
        self.edges
            .iter()
            .filter_map(|e| if e.to == node_id { Some(e.from) } else { None })
            .collect()
    }

    /// Get all reachable nodes from a set of starting nodes
    fn reachable_nodes(&self, start_nodes: &[NodeId]) -> HashSet<NodeId> {
        let mut reachable = HashSet::new();
        let mut queue = VecDeque::from_iter(start_nodes.iter().copied());

        while let Some(node_id) = queue.pop_front() {
            if reachable.insert(node_id) {
                // Add all downstream nodes to queue
                for edge in &self.edges {
                    if edge.from == node_id {
                        queue.push_back(edge.to);
                    }
                }
            }
        }

        reachable
    }

    /// Allocate a new unique node ID
    fn allocate_node_id(&mut self) -> NodeId {
        let id = NodeId::new(self.next_node_id);
        self.next_node_id += 1;
        id
    }
}

impl Default for AudioGraph {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Mock implementations for testing

    struct MockSource {
        format: AudioFormat,
        active: bool,
        buffers_to_produce: usize,
        buffers_produced: usize,
    }

    impl MockSource {
        fn new(format: AudioFormat, buffers_to_produce: usize) -> Self {
            Self {
                format,
                active: false,
                buffers_to_produce,
                buffers_produced: 0,
            }
        }
    }

    impl AudioSource for MockSource {
        fn format(&self) -> AudioFormat {
            self.format
        }

        fn start(&mut self) -> Result<(), AudioError> {
            self.active = true;
            Ok(())
        }

        fn stop(&mut self) -> Result<(), AudioError> {
            self.active = false;
            Ok(())
        }

        fn read(&mut self) -> Result<Option<AudioBuffer>, AudioError> {
            if !self.active || self.buffers_produced >= self.buffers_to_produce {
                return Ok(None);
            }

            self.buffers_produced += 1;
            Ok(Some(AudioBuffer::silent(self.format, 0.1)))
        }

        fn is_active(&self) -> bool {
            self.active
        }

        fn name(&self) -> &str {
            "MockSource"
        }
    }

    struct MockProcessor {
        format: AudioFormat,
    }

    impl MockProcessor {
        fn new(format: AudioFormat) -> Self {
            Self { format }
        }
    }

    impl AudioProcessor for MockProcessor {
        fn process(&mut self, input: AudioBuffer) -> Result<AudioBuffer, AudioError> {
            Ok(input) // Pass-through
        }

        fn output_format(&self, _input: AudioFormat) -> AudioFormat {
            self.format
        }

        fn name(&self) -> &str {
            "MockProcessor"
        }
    }

    struct MockSink {
        buffers_received: usize,
    }

    impl MockSink {
        fn new() -> Self {
            Self {
                buffers_received: 0,
            }
        }
    }

    impl AudioSink for MockSink {
        fn write(&mut self, _buffer: AudioBuffer) -> Result<(), AudioError> {
            self.buffers_received += 1;
            Ok(())
        }

        fn flush(&mut self) -> Result<(), AudioError> {
            Ok(())
        }

        fn name(&self) -> &str {
            "MockSink"
        }
    }

    #[test]
    fn test_graph_creation() {
        let graph = AudioGraph::new();
        assert_eq!(graph.state(), GraphState::Idle);
        assert_eq!(graph.node_ids().len(), 0);
    }

    #[test]
    fn test_add_nodes() {
        let mut graph = AudioGraph::new();
        let format = AudioFormat::speech();

        let source_id = graph.add_source(Box::new(MockSource::new(format, 5)));
        let sink_id = graph.add_sink(Box::new(MockSink::new()));

        assert_eq!(graph.node_ids().len(), 2);
        assert!(graph.get_node(source_id).is_some());
        assert!(graph.get_node(sink_id).is_some());
    }

    #[test]
    fn test_connect_nodes() {
        let mut graph = AudioGraph::new();
        let format = AudioFormat::speech();

        let source_id = graph.add_source(Box::new(MockSource::new(format, 5)));
        let sink_id = graph.add_sink(Box::new(MockSink::new()));

        assert!(graph.connect(source_id, sink_id).is_ok());
    }

    #[test]
    fn test_cycle_detection() {
        let mut graph = AudioGraph::new();
        let format = AudioFormat::speech();

        let proc1_id = graph.add_processor(Box::new(MockProcessor::new(format)));
        let proc2_id = graph.add_processor(Box::new(MockProcessor::new(format)));

        assert!(graph.connect(proc1_id, proc2_id).is_ok());
        assert!(graph.connect(proc2_id, proc1_id).is_err()); // Would create cycle
    }

    #[test]
    fn test_simple_graph_processing() {
        let mut graph = AudioGraph::new();
        let format = AudioFormat::speech();

        let source_id = graph.add_source(Box::new(MockSource::new(format, 5)));
        let sink_id = graph.add_sink(Box::new(MockSink::new()));

        graph.connect(source_id, sink_id).unwrap();
        graph.start().unwrap();

        // Process all buffers
        for _ in 0..10 {
            graph.process_once().unwrap();
        }

        graph.stop().unwrap();
    }

    #[test]
    fn test_validation_requires_source_and_sink() {
        let mut graph = AudioGraph::new();
        let format = AudioFormat::speech();

        // Only processor, no source or sink
        graph.add_processor(Box::new(MockProcessor::new(format)));

        assert!(graph.start().is_err());
    }

    #[test]
    fn test_remove_node() {
        let mut graph = AudioGraph::new();
        let format = AudioFormat::speech();

        let source_id = graph.add_source(Box::new(MockSource::new(format, 5)));
        assert_eq!(graph.node_ids().len(), 1);

        graph.remove_node(source_id).unwrap();
        assert_eq!(graph.node_ids().len(), 0);
    }
}

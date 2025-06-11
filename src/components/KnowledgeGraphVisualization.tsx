import {
  useEffect,
  useReducer,
  useState,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import * as d3 from "d3";

// Define types for our data structures
interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  type: string;
}

interface Relation {
  from: string;
  to: string;
  relationType: string;
  type: string;
}

interface GraphData {
  entities: Entity[];
  relations: Relation[];
}

interface Stats {
  entityCount: number;
  relationCount: number;
  entityTypeCount: number;
  relationTypeCount: number;
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  entityType: string;
  observations: string[];
  x?: number;
  y?: number;
  degree?: number;
}

interface Link {
  source: Node;
  target: Node;
  type: string;
}

// History state for node selection and navigation
type HistoryState = {
  history: Node[];
  index: number;
  selectedNode: Node | null;
};
type HistoryAction =
  | { type: 'select'; node: Node }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'clear' }
  | { type: 'reset' };
function historyReducer(
  state: HistoryState,
  action: HistoryAction
): HistoryState {
  switch (action.type) {
    case 'select': {
      const newHistory = state.history.slice(0, state.index + 1);
      newHistory.push(action.node);
      return {
        history: newHistory,
        index: newHistory.length - 1,
        selectedNode: action.node,
      };
    }
    case 'back': {
      if (state.index > 0) {
        const newIndex = state.index - 1;
        return {
          ...state,
          index: newIndex,
          selectedNode: state.history[newIndex],
        };
      }
      return state;
    }
    case 'forward': {
      if (state.index < state.history.length - 1) {
        const newIndex = state.index + 1;
        return {
          ...state,
          index: newIndex,
          selectedNode: state.history[newIndex],
        };
      }
      return state;
    }
    case 'clear': {
      return { ...state, selectedNode: null };
    }
    case 'reset': {
      return { history: [], index: -1, selectedNode: null };
    }
    default:
      return state;
  }
}

const KnowledgeGraphVisualization = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  // History and navigation for selected nodes
  const [historyState, dispatchHistory] = useReducer(
    historyReducer,
    { history: [], index: -1, selectedNode: null } as HistoryState
  );
  const { history, index, selectedNode } = historyState;
  // Refs to manage D3 nodes and zoom behavior for recentering
  const nodesRef = useRef<Node[]>([]);
  const nodeMapRef = useRef<Map<string, Node>>(new Map());
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEntityType, setFilterEntityType] = useState("All");
  const [filterRelationType, setFilterRelationType] = useState("All");
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  // Function to parse the JSON file
  const parseMemoryJson = (content: string) => {
    try {
      setIsLoading(true);
      // Split the content by new lines
      const lines = content.split("\n").filter((line) => line.trim());

      const entities: Entity[] = [];
      const relations: Relation[] = [];

      // Parse each line as a separate JSON object
      lines.forEach((line) => {
        try {
          const obj = JSON.parse(line);
          if (obj.type === "entity") {
            entities.push(obj as Entity);
          } else if (obj.type === "relation") {
            relations.push(obj as Relation);
          }
        } catch (err) {
          console.error("Error parsing line:", line, err);
        }
      });

      if (entities.length === 0 && relations.length === 0) {
        setErrorMessage(
          "No valid entities or relations found in the file. Please check the format."
        );
        setIsLoading(false);
        return;
      }

      setGraphData({ entities, relations });
      setStats({
        entityCount: entities.length,
        relationCount: relations.length,
        entityTypeCount: new Set(entities.map((e) => e.entityType)).size,
        relationTypeCount: new Set(relations.map((r) => r.relationType)).size,
      });
      setErrorMessage("");
      setIsLoading(false);
    } catch (err) {
      console.error("Error parsing JSON:", err);
      setErrorMessage("Error parsing JSON file. Please check the format.");
      setIsLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setErrorMessage("");
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const content = e.target?.result;
        if (typeof content === "string") {
          parseMemoryJson(content);
        }
      };
      reader.onerror = () => {
        setErrorMessage("Error reading file. Please try again.");
      };
      reader.readAsText(file);
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMessage("");

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];

      // Check if it's a JSON file
      if (!file.name.endsWith(".json") && !file.type.includes("json")) {
        setErrorMessage("Please upload a JSON file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const content = e.target?.result;
        if (typeof content === "string") {
          parseMemoryJson(content);
        }
      };
      reader.onerror = () => {
        setErrorMessage("Error reading file. Please try again.");
      };
      reader.readAsText(file);
    }
  };

  // Handle paste from clipboard
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (clipboardData) {
      const pastedText = clipboardData.getData("Text");
      if (pastedText) {
        setErrorMessage("");
        parseMemoryJson(pastedText);
      }
    }
  }, []);

  // Add paste event listener
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  // Get unique entity types and relation types for filters
  const entityTypes = graphData
    ? ["All", ...new Set(graphData.entities.map((entity) => entity.entityType))]
    : ["All"];

  const relationTypes = graphData
    ? [
        "All",
        ...new Set(
          graphData.relations.map((relation) => relation.relationType)
        ),
      ]
    : ["All"];

  // Apply filters to the graph data
  const getFilteredData = () => {
    if (!graphData) return { nodes: [] as Node[], links: [] as Link[] };

    // Filter entities based on search term and entity type
    let filteredEntities = graphData.entities;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredEntities = filteredEntities.filter(
        (entity) =>
          entity.name.toLowerCase().includes(term) ||
          entity.entityType.toLowerCase().includes(term) ||
          entity.observations.some((obs) => obs.toLowerCase().includes(term))
      );
    }

    if (filterEntityType !== "All") {
      filteredEntities = filteredEntities.filter(
        (entity) => entity.entityType === filterEntityType
      );
    }

    // Get entity names to filter relations
    const entityNames = new Set(filteredEntities.map((entity) => entity.name));

    // Filter relations based on relation type and entity names
    let filteredRelations = graphData.relations.filter(
      (relation) =>
        entityNames.has(relation.from) && entityNames.has(relation.to)
    );

    if (filterRelationType !== "All") {
      filteredRelations = filteredRelations.filter(
        (relation) => relation.relationType === filterRelationType
      );
    }

    // Create nodes from filtered entities
    const nodes: Node[] = filteredEntities.map((entity) => ({
      id: entity.name,
      name: entity.name,
      entityType: entity.entityType,
      observations: entity.observations,
      // Add these properties to satisfy SimulationNodeDatum
      index: undefined,
      x: undefined,
      y: undefined,
      vx: undefined,
      vy: undefined,
      fx: undefined,
      fy: undefined,
    }));

    // Create links from filtered relations with proper typing
    const links: Link[] = [];

    // First create all nodes to ensure they exist
    const nodeMap = new Map<string, Node>();
    nodes.forEach((node) => nodeMap.set(node.id, node));

    // Then create links with proper source and target references
    filteredRelations.forEach((relation) => {
      const source = nodeMap.get(relation.from);
      const target = nodeMap.get(relation.to);

      if (source && target) {
        links.push({
          source,
          target,
          type: relation.relationType,
        });
      }
    });

    return { nodes, links };
  };

  // Calculate dimensions based on container size
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) {
          console.log("Setting dimensions:", { width, height });
          setDimensions({ width, height });
        } else {
          console.warn("Invalid dimensions detected:", { width, height });
        }
      }
    };

    // Initial update
    updateDimensions();

    // Add resize listener
    window.addEventListener("resize", updateDimensions);

    // Force multiple recalculations to ensure container is fully rendered
    const timeoutId1 = setTimeout(updateDimensions, 100);
    const timeoutId2 = setTimeout(updateDimensions, 500);

    return () => {
      window.removeEventListener("resize", updateDimensions);
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
    };
  }, [graphData]); // Re-run when graphData changes

  // D3 force graph
  useEffect(() => {
    if (!graphData || !svgRef.current) {
      console.log("Skipping graph render due to missing graph data or SVG ref");
      return;
    }

    if (dimensions.width <= 0 || dimensions.height <= 0) {
      console.log(
        "Skipping graph render due to invalid dimensions:",
        dimensions
      );
      return;
    }

    console.log("Rendering graph with dimensions:", dimensions);

    const { nodes, links } = getFilteredData();
    // Store nodes and lookup map for navigation and recentering
    nodesRef.current = nodes;
    nodeMapRef.current = new Map(nodes.map((node) => [node.id, node]));
    if (nodes.length === 0) return;

    const width = dimensions.width;
    const height = dimensions.height;

    // Clear previous graph
    const svgElement = svgRef.current;
    d3.select(svgElement).selectAll("*").remove();

    // Set explicit dimensions on the SVG element
    svgElement.setAttribute("width", `${width}px`);
    svgElement.setAttribute("height", `${height}px`);

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .html(""); // Clear any existing content

    // Add zoom functionality with controllable behavior
    const g = svg.append("g");
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .extent([
        [0, 0],
        [width, height],
      ])
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        transformRef.current = event.transform;
      });
    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior as any);

    // Arrow marker for the links
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10) // Path tip is at x=10, so refX=10 makes tip align with line end
      .attr("refY", 0)
      .attr("markerWidth", 6) // Adjust size as needed
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#999")
      .attr("d", "M0,-5L10,0L0,5"); // Standard arrow path

    // Calculate node degrees and add to nodes
    const nodeDegrees = new Map<string, number>();
    nodes.forEach(node => {
      const { inbound, outbound } = getRelationCounts(node.id);
      node.degree = inbound + outbound;
      nodeDegrees.set(node.name, node.degree);
    });

    // Create scales for node size and color based on degree
    const maxDegree = Math.max(...nodes.map(d => d.degree || 0));
    const minDegree = Math.min(...nodes.map(d => d.degree || 0));
    
    const sizeScale = d3.scaleLinear()
      .domain([minDegree, maxDegree])
      .range([6, 20]); // Node radius range
    
    const colorScale = d3.scaleLinear()
      .domain([minDegree, maxDegree])
      .range([0.3, 1.0]); // Color intensity range

    // Create the force simulation with improved spacing
    const simulation = d3
      .forceSimulation<Node>(nodes)
      .force(
        "link",
        d3
          .forceLink<Node, Link>(links)
          .id((d) => d.id)
          .distance(180) // Increased distance to reduce overlap
      )
      .force("charge", d3.forceManyBody<Node>().strength(-800)) // Stronger repulsion
      .force("center", d3.forceCenter<Node>(width / 2, height / 2))
      .force("x", d3.forceX<Node>())
      .force("y", d3.forceY<Node>())
      .force("collision", d3.forceCollide<Node>().radius((d) => sizeScale(d.degree) + 5)); // Dynamic collision detection

    // Create the links
    const link = g
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("marker-end", "url(#arrowhead)") // Use the single defined arrowhead

      .attr("fill", "none");

    // Add link labels with collision avoidance
    const linkText = g
      .append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .text((d) => d.type)
      .attr("font-size", 10)
      .attr("text-anchor", "middle")
      .attr("dy", (d, i) => {
        // Stagger text positions to reduce overlap with smaller offsets
        // Alternate between above and below the line with reduced distance
        const baseOffset = i % 2 === 0 ? -4 : 6;
        // Add smaller random offset to reduce collisions while staying close to line
        const randomOffset = (i % 3 - 1) * 1;
        return baseOffset + randomOffset;
      })
      .attr("fill", "#666")
      .attr("opacity", 0.8);

    // Create a group for each node
    const node = g
      .append("g")
      .selectAll(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .call(drag(simulation) as any) // Type assertion needed for D3 drag
      .on("click", (event, d) => {
        // Select node and record history
        dispatchHistory({ type: 'select', node: d });
        event.stopPropagation();
      });

    // Add circles to nodes with dynamic size and color
    node
      .append("circle")
      .attr("r", (d) => sizeScale(d.degree))
      .attr("fill", (d) => {
        // Generate a color based on entity type with dynamic intensity
        // const typeColors: Record<string, string> = {
        //   Memory: "#ff8c00",
        //   Research: "#9370db",
        //   System: "#3cb371",
        //   FileCategories: "#4682b4",
        //   ScanRecord: "#cd5c5c",
        //   FileGroup: "#20b2aa",
        //   ActionPlan: "#ff6347",
        //   PatternLibrary: "#9acd32",
        //   UserPreference: "#ff69b4",
        //   Project: "#1e90ff",
        //   Use_Case: "#ff7f50",
        //   Strategy: "#8a2be2",
        // };
        // const baseColor = typeColors[d.entityType] || "#ccc";
        // const intensity = colorScale(d.degree);
        // Interpolate between white and the base color based on intensity
        // return d3.interpolate("#ffffff", baseColor)(intensity);
        return d.degree > 0 ? "#4593c3" : "#e27171";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    // Add labels to nodes with dynamic positioning based on node size
    node
      .append("text")
      .attr("dx", (d) => sizeScale(d.degree) + 8) // Position text outside the node radius
      .attr("dy", ".35em")
      .text((d) => d.name)
      .attr("font-size", 11)
      .attr("fill", "#333")
      .attr("font-weight", "500")
      .style("pointer-events", "none")
      .style("text-shadow", "1px 1px 2px rgba(255,255,255,0.8)");

    // Add titles for hover
    node.append("title").text((d) => `${d.name} (${d.entityType})`);

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link.attr("d", (d) => {
        if (
          d.source.x === undefined ||
          d.source.y === undefined ||
          d.target.x === undefined ||
          d.target.y === undefined
        )
          return "";

        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate source and target node radii
        const sourceRadius = sizeScale(nodeDegrees.get(d.source.name) || 0);
        const targetRadius = sizeScale(nodeDegrees.get(d.target.name) || 0);
        
        // Calculate unit vector from source to target
        const unitX = dx / dr;
        const unitY = dy / dr;
        
        // Calculate start and end points at node edges
        const startX = d.source.x + unitX * sourceRadius;
        const startY = d.source.y + unitY * sourceRadius;
        const endX = d.target.x - unitX * targetRadius;
        const endY = d.target.y - unitY * targetRadius;
        
        return `M${startX},${startY}L${endX},${endY}`;
      });

      linkText.attr("transform", (d) => {
        if (
          d.source.x === undefined ||
          d.source.y === undefined ||
          d.target.x === undefined ||
          d.target.y === undefined
        )
          return "";

        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const x = (d.source.x + d.target.x) / 2;
        const y = (d.source.y + d.target.y) / 2;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        
        // Prevent text from being upside down by adjusting angle
        // If angle is greater than 90 or less than -90, flip it by 180 degrees
        if (angle > 90 || angle < -90) {
          angle += 180;
        }
        
        return `translate(${x},${y}) rotate(${angle})`;
      });

      node.attr("transform", (d) => {
        if (d.x === undefined || d.y === undefined) return "";
        return `translate(${d.x},${d.y})`;
      });
    });

    // Drag functionality
    function drag(simulation: d3.Simulation<Node, undefined>) {
      function dragstarted(event: d3.D3DragEvent<Element, Node, Node>) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event: d3.D3DragEvent<Element, Node, Node>) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: d3.D3DragEvent<Element, Node, Node>) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3
        .drag<Element, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    // Click outside to deselect node
    svg.on("click", () => {
      dispatchHistory({ type: 'clear' });
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, searchTerm, filterEntityType, filterRelationType, dimensions]);
  
  // Recenter graph when a node is selected
  useEffect(() => {
    if (!selectedNode || !svgRef.current) return;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!zoomBehavior) return;
    const { x, y } = selectedNode;
    if (x === undefined || y === undefined) return;
    const k = transformRef.current.k;
    const width = dimensions.width;
    const height = dimensions.height;
    const newX = width / 2 - x * k;
    const newY = height / 2 - y * k;
    const svgSel = d3.select(svgRef.current);
    svgSel
      .transition()
      .duration(750)
      .call(
        zoomBehavior.transform as any,
        d3.zoomIdentity.translate(newX, newY).scale(k)
      );
  }, [selectedNode, dimensions]);

  // Helper function to get relation counts
  const getRelationCounts = (nodeName) => {
    if (!graphData) return { inbound: 0, outbound: 0 };

    const inbound = graphData.relations.filter((r) => r.to === nodeName).length;
    const outbound = graphData.relations.filter(
      (r) => r.from === nodeName
    ).length;

    return { inbound, outbound };
  };

  // Reset the visualization
  const resetVisualization = () => {
    setGraphData(null);
    // Reset history and selection
    dispatchHistory({ type: 'reset' });
    setSearchTerm("");
    setFilterEntityType("All");
    setFilterRelationType("All");
    setErrorMessage("");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {!graphData ? (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <svg className="w-24 h-24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="none" stroke="#9370db" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 19a2 2 0 0 1-2-2v-4l-1-1l1-1V7a2 2 0 0 1 2-2m6 6.875l3-1.687m-3 1.687v3.375m0-3.375l-3-1.687m3 1.687l3 1.688M12 8.5v3.375m0 0l-3 1.688M18 19a2 2 0 0 0 2-2v-4l1-1l-1-1V7a2 2 0 0 0-2-2"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4">
              Anthropic Memory Visualizer
            </h1>
            <p className="text-lg text-gray-600">
              Explore and analyze knowledge graphs from Anthropic's Memory MCP
            </p>
            <span>
              <a
                href="https://github.com/modelcontextprotocol/servers/tree/main/src/memory"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline text-xs"
              >
                https://github.com/modelcontextprotocol/servers/tree/main/src/memory
              </a>
            </span>

            {isLoading && (
              <div className="flex justify-center mb-6">
                <svg
                  className="animate-spin h-8 w-8 text-blue-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
            )}

            {errorMessage && (
              <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">
                <div className="flex items-center">
                  <svg
                    className="h-6 w-6 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}
          </div>

          <div
            className={`border-4 border-dashed rounded-lg p-12 w-full max-w-xl flex flex-col items-center justify-center transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-white"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="text-center mb-6">
              <div className="relative">
                <svg
                  className="mx-auto h-16 w-16 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-medium text-gray-900">
                Drag & drop your memory.json file
              </h2>
              <p className="mt-2 text-gray-500">or click to browse</p>
              <p className="mt-2 text-sm text-gray-400">
                You can also paste JSON content directly (⌘+V / Ctrl+V)
              </p>
            </div>

            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="mt-2 py-2 px-6 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md cursor-pointer transition-colors flex items-center"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z"
                />
              </svg>
              Upload memory.json
            </label>
          </div>

          <div className="mt-8 text-center">
            <h3 className="flex items-center justify-center font-medium mb-3 text-purple-800">
              <svg 
                className="w-5 h-5 mr-2" 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24"
              >
                <path fill="none" stroke="#9370db" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 19a2 2 0 0 1-2-2v-4l-1-1l1-1V7a2 2 0 0 1 2-2m6 6.875l3-1.687m-3 1.687v3.375m0-3.375l-3-1.687m3 1.687l3 1.688M12 8.5v3.375m0 0l-3 1.688M18 19a2 2 0 0 0 2-2v-4l1-1l-1-1V7a2 2 0 0 0-2-2"/>
              </svg>
              Anthropic Memory MCP Format:
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 inline-block text-left">
              <div className="flex items-center mb-2 text-purple-800">
                <svg
                  className="w-5 h-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 5H21V7H3V5ZM3 11H21V13H3V11ZM3 17H21V19H3V17Z"
                    fill="currentColor"
                  />
                </svg>
                <p className="font-medium">File Structure:</p>
              </div>
              <p className="text-sm mb-2 ml-7">
                • Each line is a separate JSON object (entities/relations)
              </p>

              <div className="flex items-center mb-2 text-purple-800">
                <svg
                  className="w-5 h-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 18C11.45 18 11 17.55 11 17C11 16.45 11.45 16 12 16C12.55 16 13 16.45 13 17C13 17.55 12.55 18 12 18ZM13 14H11C11 12.32 12.68 12.5 12.68 11C12.68 10.18 11.96 9.5 11 9.5C10.22 9.5 9.54 10 9.16 10.75L7.56 9.83C8.19 8.33 9.5 7.5 11 7.5C13.21 7.5 15 9.08 15 11C15 12.94 13 13.31 13 14Z"
                    fill="currentColor"
                  />
                </svg>
                <p className="font-medium">Required Properties:</p>
              </div>
              <p className="text-sm mb-1 ml-7">
                •{" "}
                <code className="bg-gray-200 px-1 rounded">
                  "type": "entity"
                </code>{" "}
                or{" "}
                <code className="bg-gray-200 px-1 rounded">
                  "type": "relation"
                </code>
              </p>
              <p className="text-sm mb-2 ml-7">
                • Entities need: name, entityType, observations
              </p>
              <p className="text-sm mb-1 ml-7">
                • Relations need: from, to, relationType
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-screen">
          <div className="bg-white p-4 border-b border-gray-300 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                {/* Back/Forward navigation */}
                <button
                  onClick={() => dispatchHistory({ type: 'back' })}
                  disabled={index <= 0}
                  className="p-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded"
                >
                  &larr;
                </button>
                <button
                  onClick={() => dispatchHistory({ type: 'forward' })}
                  disabled={index >= history.length - 1}
                  className="p-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded"
                >
                  &rarr;
                </button>
                <svg
                  className="w-8 h-8 text-purple-700"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="none"
                    stroke="#9370db"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 19a2 2 0 0 1-2-2v-4l-1-1l1-1V7a2 2 0 0 1 2-2m6 6.875l3-1.687m-3 1.687v3.375m0-3.375l-3-1.687m3 1.687l3 1.688M12 8.5v3.375m0 0l-3 1.688M18 19a2 2 0 0 0 2-2v-4l1-1l-1-1V7a2 2 0 0 0-2-2"
                  />
                </svg>
                <h1 className="text-xl font-bold">
                  Anthropic Memory MCP Visualizer
                </h1>
              </div>
              <button
                onClick={resetVisualization}
                className="py-1 px-4 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition-colors flex items-center"
              >
                <svg 
                  className="w-4 h-4 mr-1" 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24"
                >
                  <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 19a2 2 0 0 1-2-2v-4l-1-1l1-1V7a2 2 0 0 1 2-2m6 6.875l3-1.687m-3 1.687v3.375m0-3.375l-3-1.687m3 1.687l3 1.688M12 8.5v3.375m0 0l-3 1.688M18 19a2 2 0 0 0 2-2v-4l1-1l-1-1V7a2 2 0 0 0-2-2"/>
                </svg>
                Upload New File
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                {stats.entityCount} Entities
              </div>
              <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium border-2 border-purple-200">
                {stats.relationCount} Relations
              </div>
              <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                {stats.entityTypeCount} Entity Types
              </div>
              <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm font-medium border-2 border-purple-100">
                {stats.relationTypeCount} Relation Types
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="search"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Search:
                </label>
                <input
                  id="search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or content..."
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label
                  htmlFor="entityType"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Filter by Entity Type:
                </label>
                <select
                  id="entityType"
                  value={filterEntityType}
                  onChange={(e) => setFilterEntityType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  {entityTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="relationType"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Filter by Relation Type:
                </label>
                <select
                  id="relationType"
                  value={filterRelationType}
                  onChange={(e) => setFilterRelationType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  {relationTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div
            className="flex flex-1 overflow-hidden"
            style={{ height: "calc(100vh - 180px)", minHeight: "500px" }}
            ref={containerRef}
          >
            <div
              className="flex-1 overflow-hidden relative"
              style={{ height: "100%", width: "100%" }}
            >
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                className="bg-white absolute top-0 left-0"
                style={{ minHeight: "500px" }}
              ></svg>
            </div>

            {selectedNode && (
              <div className="w-1/3 p-4 bg-purple-50 border-l border-purple-200 overflow-y-auto">
                <div className="flex items-center mb-3">
                  <svg 
                    className="w-5 h-5 mr-2 text-purple-600" 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24"
                  >
                    <path fill="none" stroke="#9370db" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 19a2 2 0 0 1-2-2v-4l-1-1l1-1V7a2 2 0 0 1 2-2m6 6.875l3-1.687m-3 1.687v3.375m0-3.375l-3-1.687m3 1.687l3 1.688M12 8.5v3.375m0 0l-3 1.688M18 19a2 2 0 0 0 2-2v-4l1-1l-1-1V7a2 2 0 0 0-2-2"/>
                  </svg>
                  <span className="text-sm font-medium text-purple-600">Entity Details</span>
                </div>
                <h2 className="text-lg font-bold mb-2">{selectedNode.name}</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Type: {selectedNode.entityType}
                </p>

                {selectedNode.observations && (
                  <>
                    <h3 className="font-bold text-purple-800 mb-2 flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z"
                          fill="currentColor"
                        />
                      </svg>
                      Observations:
                    </h3>
                    <ul className="list-disc pl-5 mb-4">
                      {selectedNode.observations.map((obs, i) => (
                        <li key={i} className="text-sm mb-1">
                          {obs}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {graphData && (
                  <>
                    <h3 className="font-bold text-gray-700 mb-2">Relations:</h3>
                    <div className="mb-2">
                      <p className="text-sm">
                        <span className="font-medium">Connections:</span>{" "}
                        {getRelationCounts(selectedNode.name).inbound +
                          getRelationCounts(selectedNode.name).outbound}
                        &nbsp;({getRelationCounts(selectedNode.name).inbound}{" "}
                        inbound, {getRelationCounts(selectedNode.name).outbound}{" "}
                        outbound)
                      </p>
                    </div>

                    {graphData.relations.filter(
                      (r) => r.from === selectedNode.name
                    ).length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-sm font-semibold mb-1">
                          Outbound:
                        </h4>
                        <ul className="list-disc pl-5">
                          {graphData.relations
                            .filter((r) => r.from === selectedNode.name)
                            .map((r, i) => (
                              <li key={i} className="text-sm mb-1">
                                <span className="italic text-blue-600">
                                  {r.relationType}
                                </span>{" "}
                                →{" "}
                                <button
                                  onClick={() => {
                                    // Navigate to outbound node
                                    const node = nodeMapRef.current.get(r.to);
                                    if (node) {
                                      dispatchHistory({ type: 'select', node });
                                    }
                                  }}
                                  className="text-blue-600 hover:underline"
                                >
                                  {r.to}
                                </button>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {graphData.relations.filter(
                      (r) => r.to === selectedNode.name
                    ).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Inbound:</h4>
                        <ul className="list-disc pl-5">
                          {graphData.relations
                            .filter((r) => r.to === selectedNode.name)
                            .map((r, i) => (
                              <li key={i} className="text-sm mb-1">
                                <button
                                  onClick={() => {
                                    // Navigate to inbound node
                                    const node = nodeMapRef.current.get(r.from);
                                    if (node) {
                                      dispatchHistory({ type: 'select', node });
                                    }
                                  }}
                                  className="text-blue-600 hover:underline"
                                >
                                  {r.from}
                                </button>{" "}
                                →{" "}
                                <span className="italic text-blue-600">
                                  {r.relationType}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-100 p-2 border-t border-gray-300 text-xs text-gray-600">
            <p>
              <span className="font-medium">Instructions:</span> Drag nodes to
              reposition. Zoom with mouse wheel. Click a node to see details.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphVisualization;

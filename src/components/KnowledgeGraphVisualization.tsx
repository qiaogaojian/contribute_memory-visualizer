import React, { useEffect, useState, useRef, useCallback } from "react";
import * as d3 from "d3";

const KnowledgeGraphVisualization = () => {
  const svgRef = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEntityType, setFilterEntityType] = useState("All");
  const [filterRelationType, setFilterRelationType] = useState("All");
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState(null);

  // Function to parse the JSON file
  const parseMemoryJson = (content) => {
    try {
      setIsLoading(true);
      // Split the content by new lines
      const lines = content.split("\n").filter((line) => line.trim());

      const entities = [];
      const relations = [];

      // Parse each line as a separate JSON object
      lines.forEach((line) => {
        try {
          const obj = JSON.parse(line);
          if (obj.type === "entity") {
            entities.push(obj);
          } else if (obj.type === "relation") {
            relations.push(obj);
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
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setErrorMessage("");
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        parseMemoryJson(content);
      };
      reader.onerror = () => {
        setErrorMessage("Error reading file. Please try again.");
      };
      reader.readAsText(file);
    }
  };

  // Handle drag events
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
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
      reader.onload = (e) => {
        const content = e.target.result;
        parseMemoryJson(content);
      };
      reader.onerror = () => {
        setErrorMessage("Error reading file. Please try again.");
      };
      reader.readAsText(file);
    }
  };

  // Handle paste from clipboard
  const handlePaste = useCallback((e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = clipboardData.getData("Text");
    if (pastedText) {
      setErrorMessage("");
      parseMemoryJson(pastedText);
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
    if (!graphData) return { nodes: [], links: [] };

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
    const nodes = filteredEntities.map((entity) => ({
      id: entity.name,
      name: entity.name,
      entityType: entity.entityType,
      observations: entity.observations,
    }));

    // Create links from filtered relations
    const links = filteredRelations.map((relation) => ({
      source: relation.from,
      target: relation.to,
      type: relation.relationType,
    }));

    return { nodes, links };
  };

  // D3 force graph
  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    const { nodes, links } = getFilteredData();
    if (nodes.length === 0) return;

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    const width = 800;
    const height = 600;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    // Add zoom functionality
    const g = svg.append("g");

    svg.call(
      d3
        .zoom()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0.1, 8])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        })
    );

    // Arrow markers for the links
    svg
      .append("defs")
      .selectAll("marker")
      .data(["end"])
      .enter()
      .append("marker")
      .attr("id", (d) => d)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#999")
      .attr("d", "M0,-5L10,0L0,5");

    // Create the force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(150)
      )
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX())
      .force("y", d3.forceY());

    // Create the links
    const link = g
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("marker-end", "url(#end)")
      .attr("fill", "none");

    // Add link labels
    const linkText = g
      .append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .text((d) => d.type)
      .attr("font-size", 10)
      .attr("text-anchor", "middle")
      .attr("dy", -5)
      .attr("fill", "#666");

    // Create a group for each node
    const node = g
      .append("g")
      .selectAll(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .call(drag(simulation))
      .on("click", (event, d) => {
        setSelectedNode(d);
        event.stopPropagation();
      });

    // Add circles to nodes
    node
      .append("circle")
      .attr("r", 10)
      .attr("fill", (d) => {
        // Generate a color based on entity type
        const typeColors = {
          Memory: "#ff8c00",
          Research: "#9370db",
          System: "#3cb371",
          FileCategories: "#4682b4",
          ScanRecord: "#cd5c5c",
          FileGroup: "#20b2aa",
          ActionPlan: "#ff6347",
          PatternLibrary: "#9acd32",
          UserPreference: "#ff69b4",
          Project: "#1e90ff",
          Use_Case: "#ff7f50",
          Strategy: "#8a2be2",
        };
        return typeColors[d.entityType] || "#ccc";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    // Add labels to nodes
    node
      .append("text")
      .attr("dx", 15)
      .attr("dy", ".35em")
      .text((d) => d.name)
      .attr("font-size", 12);

    // Add titles for hover
    node.append("title").text((d) => `${d.name} (${d.entityType})`);

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link.attr("d", (d) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });

      linkText.attr("transform", (d) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const x = (d.source.x + d.target.x) / 2;
        const y = (d.source.y + d.target.y) / 2;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return `translate(${x},${y}) rotate(${angle})`;
      });

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Drag functionality
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    // Click outside to deselect node
    svg.on("click", () => {
      setSelectedNode(null);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, searchTerm, filterEntityType, filterRelationType]);

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
    setSelectedNode(null);
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
            <h1 className="text-3xl font-bold mb-4">
              Knowledge Graph Visualizer
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              Upload your memory.json file to visualize your knowledge graph
            </p>

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
              <h2 className="mt-4 text-lg font-medium text-gray-900">
                Drag & drop your memory.json file
              </h2>
              <p className="mt-2 text-gray-500">or click to browse</p>
              <p className="mt-2 text-sm text-gray-400">
                You can also paste JSON content directly (Ctrl+V / Cmd+V)
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
              className="mt-2 py-2 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md cursor-pointer transition-colors"
            >
              Select File
            </label>
          </div>

          <div className="mt-8 text-center text-gray-600">
            <h3 className="font-medium mb-2">Format Requirements:</h3>
            <p className="text-sm mb-1">
              • Memory JSON file from Anthropic Memory MCP Server
            </p>
            <p className="text-sm mb-1">
              • Each line should be a valid JSON object
            </p>
            <p className="text-sm mb-1">
              • Objects should have "type": "entity" or "type": "relation"
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-screen">
          <div className="bg-white p-4 border-b border-gray-300 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-xl font-bold">
                Knowledge Graph Visualization
              </h1>
              <button
                onClick={resetVisualization}
                className="py-1 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
              >
                Upload New File
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {stats.entityCount} Entities
              </div>
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                {stats.relationCount} Relations
              </div>
              <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                {stats.entityTypeCount} Entity Types
              </div>
              <div className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-sm font-medium">
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

          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-auto">
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                className="bg-white"
              ></svg>
            </div>

            {selectedNode && (
              <div className="w-1/3 p-4 bg-gray-50 border-l border-gray-300 overflow-y-auto">
                <h2 className="text-lg font-bold mb-2">{selectedNode.name}</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Type: {selectedNode.entityType}
                </p>

                {selectedNode.observations && (
                  <>
                    <h3 className="font-bold text-gray-700 mb-2">
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
                                    const targetNode = graphData.entities.find(
                                      (e) => e.name === r.to
                                    );
                                    if (targetNode) setSelectedNode(targetNode);
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
                                    const sourceNode = graphData.entities.find(
                                      (e) => e.name === r.from
                                    );
                                    if (sourceNode) setSelectedNode(sourceNode);
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

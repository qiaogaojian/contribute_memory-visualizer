# Memory Visualizer

Interactive visualizer for Anthropic's Memory MCP knowledge graphs. Instantly explore, debug, and analyze entities, relations, and observations from memory.json files in the Model Context Protocol.

## Features

- Interactive knowledge graph visualization using D3.js
- Filter by entity and relation types
- Search across entities and relationships
- View detailed observations in the info panel
- Drop memory.json files or paste directly from clipboard
- Navigate complex entity networks visually
- Debug AI memory structures and connections

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

No environment variables are required for basic deployment.

## Tech Stack

- React + TypeScript
- D3.js for visualization
- Vite
- TailwindCSS

## Knowledge Graph Structure

Visualizes Anthropic's Memory MCP format:

- **Entities**: Nodes with name, type, and observations (e.g., people, organizations)
- **Relations**: Directed connections between entities in active voice (e.g., "works_at")
- **Observations**: Atomic facts attached to entities

## Use Cases

- Debug entity relationships in AI memory
- Analyze memory.json structures
- Explore entity connections
- Visualize graph growth over time

## Related

- [Anthropic Memory MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)

# Memory Visualizer

A React-based knowledge graph visualization tool that helps you visualize and explore memory data.

## Features

- Interactive D3-based graph visualization
- Entity and relation filtering
- Search functionality
- Detailed node information panel
- Drag & drop JSON file upload
- Clipboard paste support

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Deployment with Coolify

This project is configured for easy deployment with Coolify. To deploy:

1. Fork or clone this repository
2. In Coolify dashboard, create a new application
3. Select your repository
4. Choose "Static Site" as the deployment type
5. Configure the following build settings:
   - Build Command: `npm run build`
   - Publish Directory: `dist`
   - Node Version: 18 (or latest LTS)
6. Deploy!

## Environment Variables

No environment variables are required for basic deployment.

## Tech Stack

- React
- TypeScript
- D3.js
- Vite
- TailwindCSS

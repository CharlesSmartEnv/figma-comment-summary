# Comment Summariser ✨

A Figma plugin that automatically fetches and summarizes comments from your Figma documents using AI. 
Summarise crit sessions, catch-up after time-off, or remind yourself of the  

## 🔗 Figma Plugin

**[Install Comment Summariser from Figma Community](https://www.figma.com/community/plugin/1510186428265043923/Comment-Summariser)**


## ✨ Features

- **OAuth Authentication**: Secure integration with Figma using OAuth 2.0 flow
- **Comment Fetching**: Automatically retrieves comments from your Figma documents via REST API
- **AI-Powered Summarization**: Uses AI to generate concise summaries of comment threads
- **Date Range Filtering**: Filter comments by specific date ranges


## 🏗️ Architecture

This project consists of two main components:

### Frontend (Figma Plugin)
- **React + TypeScript**: Modern UI built with React and TypeScript
- **Webpack**: Bundled with Webpack for optimal performance
- **Figma Plugin API**: Integrates with Figma's plugin system

### Backend (Express Server)
- **Express.js**: RESTful API server handling OAuth and comment processing
- **OAuth Flow**: Handles Figma OAuth authentication
- **AI Integration**: Processes comments using AI services (OpenAI/Google GenAI)
- **CORS Configured**: Properly configured for Figma plugin communication

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js (v14 or higher)
- Yarn or npm
- Figma account with developer access
- ngrok (for local development)

### 1. Install Dependencies
```bash
yarn install
# or
npm install
```

### 2. Plugin Development
```bash
# Build and watch the plugin
yarn build:watch

# In Figma: Plugins → Development → Import plugin from manifest...
# Select the manifest.json file from this repo
```

### 3. Server Development
```bash
# Start the development server
yarn dev:server
# Server runs on http://localhost:3000
```

## 🔧 Local Development Setup

For full OAuth functionality during development, you'll need to set up local tunneling and configure various components. See detailed [Local Development Guide](./local_development.md) 


### Key Development Commands

```bash
# Plugin Development
yarn build:watch          # Watch mode for plugin development
yarn build                # Production build

# Server Development  
yarn dev:server           # Development server with hot reload
yarn start:server         # Start with tsx
yarn build:server         # Build server TypeScript
yarn start                # Start production server

# Code Quality
yarn prettier:format      # Format code with Prettier
```


## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
FIGMA_CLIENT_ID=your_figma_client_id
FIGMA_CLIENT_SECRET=your_figma_client_secret
FIGMA_REDIRECT_URI=your_redirect_uri
OPENROUTER_API_KEY=your_google_ai_api_key
```


## 📝 License

This project is licensed under the MIT License use it however you want, but please note: I don't know what I'm doing and the oAuth flow is heavily vibe coded so 



# Comment Summariser ✨

A Figma plugin that automatically fetches and summarizes comments from your Figma documents using AI. 
Summarise crit sessions, catch-up after time-off, or remind yourself of the  

## 🔗 Figma Plugin

**[Install Comment Summary from Figma Community](https://www.figma.com/community/plugin/1521063587587196294/comment-summary)**


## 🔒 Privacy & Data Handling

User comments (including handles, messages, timestamps, and reactions) are fetched from Figma's API and sent to OpenRouter for AI summarization. No comment data is stored persistently—only temporary in-memory OAuth sessions (expiring after 15 minutes) are maintained for authentication. All processing occurs on-demand and data is not retained after the request completes.


## ✨ Features

- **OAuth Authentication**: Secure integration with Figma using OAuth 2.0 flow
- **Comment Fetching**: Automatically retrieves comments from your Figma documents via REST API
- **AI-Powered Summarization**: Uses AI to generate concise summaries of comment threads


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
npm run build:dev

# In Figma: Plugins → Development → Import plugin from manifest...
# Select the manifest.json file from this repo
```

### 3. Server Development
```bash
# Start the development server
npm run dev:server
# Server runs on http://localhost:3000
```

## 🔧 Local Development Setup

For full OAuth functionality during development, you'll need to set up local tunneling and configure various components. See detailed [Local Development Guide](./local_development.md) 


## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
FIGMA_CLIENT_ID=your_figma_client_id
FIGMA_CLIENT_SECRET=your_figma_client_secret
FIGMA_REDIRECT_URI=your_redirect_uri
OPENROUTER_API_KEY=your_google_ai_api_key
```

## 📝 License

This project is licensed under the MIT License use it however you want, but please note: I don't know what I'm doing and the oAuth flow is heavily vibe coded so take caution when using it for published plugins and code.



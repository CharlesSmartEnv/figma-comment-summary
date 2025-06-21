# Local Development Setup Guide for Figma Plugin with OAuth


### 1. Run Your Local Server

First, get your backend server running locally.

*   **Install Dependencies:** Open your terminal in the project's root directory and run:
    ```bash
    npm install
    # or if you use yarn
    # yarn install
    ```
*   **Start the Server:**
    ```bash
    npm run dev:server
    ```
    By default (as seen in `api/server.ts`), the server runs on port `3000`. Note this port if it's different.

### 2. Set Up Ngrok Forwarding

Ngrok will expose your local server to the internet with a public URL.

*   **Start Ngrok:** In a new terminal window, run the following command (assuming your server is on port 3000):
    ```bash
    ngrok http 3000
    ```
*   **Copy the HTTPS URL:** Ngrok will display a "Forwarding" URL that looks something like `https://random-string.ngrok-free.app`. **Copy the `https` URL.** This will be your public base URL.



### 3. Configure Figma Developer App Redirect URI

You need to tell Figma to allow redirects back to your ngrok URL.

*   Go to the [Figma Developer Console](https://www.figma.com/developers/apps).
*   Select your OAuth app.
*   Find the section for "Redirect URIs" or "Callback URLs".
*   Add a **new Redirect URI**:
    `YOUR_NGROK_HTTPS_URL/api/oauth/callback`
    *   **Replace `YOUR_NGROK_HTTPS_URL`** with the actual `https` URL you copied from ngrok in 

### 4. Configure Server Environment Variables (`.env`)

Your local server needs to know its public redirect URI and your Figma app credentials via .env file.

*   Add or update the following lines:

    ```env
        # Development Configuration 
        NGROK_URL=YOUR_NGROK_HTTPS_URL      
        FIGMA_REDIRECT_URI=YOUR_NGROK_HTTPS_URL/api/oauth/callback
    ```
    
*   **Restart your local server** (from Step 1) for it to pick up these new environment variables.

### 5. Update Server CORS Configuration

    ```
*   **Ensure the ngrok header is enabled** in the `allowedHeaders` array (around line 46):
    ```typescript
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'ngrok-skip-browser-warning'
    ]
    ```


### 6. Build Plugin

Build the plugin in development mode with your ngrok URL:

```bash
npm run build:dev
```

For continuous development with auto-rebuild on changes:

```bash
npm run build:watch
```

After building, import the plugin in Figma:
*   In Figma: **Plugins → Development → Import plugin from manifest...**
*   Select the `manifest.json` file from this repository



### 7. Test the OAuth Flow

1.  Open your plugin in Figma.
2.  Trigger the action that starts the authentication process.
3.  You should be redirected to Figma to authorize, and then redirected back to your ngrok URL (`/api/oauth/callback`), which forwards to your local server.
4.  Your local server should handle the callback and complete the OAuth flow.

## Important Notes & Troubleshooting

*   **Dynamic Ngrok URL:** If you are using the free tier of ngrok, the `random-string` part of the URL will change *every time you restart ngrok*. If it changes, you **MUST** update the URLs above.
*   **Exact URI Match:** Ensure the `FIGMA_REDIRECT_URI` in your `.env` file and the one registered in the Figma Developer Console are *identical* (scheme, hostname, path, no unexpected trailing slashes).
*   **Server Logs:** Check your local server's terminal output for any error messages during the OAuth flow.
*   **Browser Console:** If the popup window shows an error, open the browser's developer console in that popup for more clues.
*   **CORS:** Your `server.ts` already includes CORS configuration. The `ngrok-skip-browser-warning` header added to `allowedHeaders` is good for development with ngrok.
*   **Polling Errors for HTML:** If you see `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON` during polling, it's a strong indicator that the `ngrok-skip-browser-warning` header is missing from the client-side polling request, and you're receiving ngrok's HTML interstitial page instead of JSON.

This is important for polling too, as the polling hits the ngrok interstitial

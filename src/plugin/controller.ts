figma.showUI( __html__, { width: 700, height: 500 });

figma.ui.onmessage = async (msg) => {


  if (msg.type === 'store-token') {
    try {
      await figma.clientStorage.setAsync('figma-token', msg.token);
      // Also store the refresh token if your backend needs it for re-authentication
      // if (msg.refreshToken) {
      //   await figma.clientStorage.setAsync('figma-refresh-token', msg.refreshToken);
      // }
      figma.ui.postMessage({ type: 'token-stored' });
    } catch (error) {
      console.error('Failed to store token:', error);
      figma.ui.postMessage({ 
        type: 'auth-error', 
        message: 'Failed to store authentication token' 
      });
    }
  }

  if (msg.type === 'check-auth') {
    try {
      const token = await figma.clientStorage.getAsync('figma-token');
      if (token) {
        figma.ui.postMessage({ 
          type: 'auth-status-checked', 
          isAuthenticated: true,
          token 
        });
      } else {
        figma.ui.postMessage({ type: 'auth-status-checked', isAuthenticated: false });
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      figma.ui.postMessage({ type: 'auth-status-checked', isAuthenticated: false, error: 'Error checking auth status' });
    }
  }

  if (msg.type === 'clear-token') {
    try {
      await figma.clientStorage.deleteAsync('figma-token');
      // Also clear refresh token if you're storing it
      await figma.clientStorage.deleteAsync('figma-refresh-token');
      figma.ui.postMessage({ type: 'token-cleared' });
      figma.notify("Disconnected from Figma account");
    } catch (error) {
      console.error('Failed to clear token:', error);
      figma.ui.postMessage({ 
        type: 'auth-error', 
        message: 'Failed to clear authentication token' 
      });
    }
  }

  if (msg.type === 'cancel') {
    // figma.closePlugin();
  }

  // Handler for when UI requests Figma data (fileKey, accessToken) for comment processing
  if (msg.type === 'request-figma-data-for-comment-processing') {
    // Use the fileKey from the message if provided, otherwise fall back to figma.fileKey
    const fileKey = msg.fileKey || figma.fileKey;
    
    if (!fileKey) {
      figma.ui.postMessage({
        type: 'figma-data-retrieval-error',
        error: 'Please provide a valid Figma file URL. The file key could not be determined.',
      });
      return;
    }

    try {
      const accessToken = await figma.clientStorage.getAsync('figma-token');
      
      if (!accessToken) {
        figma.ui.postMessage({
          type: 'figma-data-retrieval-error',
          error: 'Figma access token not found. Please authenticate first.',
        });
        return;
      }

      
      figma.ui.postMessage({
        type: 'figma-data-for-comment-processing-ready',
        fileKey,
        accessToken,
      });
      
      figma.notify("Comments sent for processing.");

    } catch (error) {
      console.error('CONTROLLER: Error retrieving access token from clientStorage:', error);
      figma.ui.postMessage({
        type: 'figma-data-retrieval-error',
        error: 'Failed to retrieve access token. Please try authenticating again.',
      });
    }
  }
};

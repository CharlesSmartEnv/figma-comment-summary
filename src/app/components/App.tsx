import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import '../styles/ui.css';
import backgroundImage from '../assets/background.jpg';
import emptyStateImage from '../assets/empty-illustration.svg';
const ReactMarkdown = lazy(() => import('react-markdown'));
import CommentReferenceBadge from './CommentReferenceBadge';
import Loader from './Loader';

const POLLING_INTERVAL_MS = 3000; // Poll every 3 seconds
const POLLING_TIMEOUT_MS = 2 * 60 * 1000; // Stop polling after 2 minutes

interface FilteredComment {
  userHandle: string | null;
  message: string;
  createdAt: string;
  reactions: any[];
  location: string | null;
  id: string | null;
  parentComment: string | null;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false); 

  const pollingIntervalIdRef = useRef<number | null>(null);
  const authWindowRef = useRef<Window | null>(null);
  const currentReadKeyRef = useRef<string | null>(null);
  const pollingTimeoutIdRef = useRef<number | null>(null);

  const [isProcessingComments, setIsProcessingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [processedComments, setProcessedComments] = useState<string | null>(null);
  const [commentsData, setCommentsData] = useState<FilteredComment[] | null>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [commentsMap, setCommentsMap] = useState<Map<string, FilteredComment>>(new Map());
  
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'summary' | 'json'>('summary');
  
  const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

  const [showChunkingWarning, setShowChunkingWarning] = useState(false);
  const [hasConfirmedChunking, setHasConfirmedChunking] = useState(false);

  const [figmaUrl, setFigmaUrl] = useState<string>('');
  const [figmaUrlError, setFigmaUrlError] = useState<string | null>(null);

  // Function to extract file key from Figma URL
  const extractFileKeyFromUrl = (url: string): string | null => {
    try {
      // Reset URL error when attempting extraction
      setFigmaUrlError(null);
      
      if (!url.trim()) {
        return null;
      }

      // Match various Figma URL patterns
      // Pattern: https://www.figma.com/design/{fileKey}/{fileName}...
      // Pattern: https://figma.com/design/{fileKey}/{fileName}...
      // Pattern: https://www.figma.com/file/{fileKey}/{fileName}...
      const regex = /^https?:\/\/(?:www\.)?figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)(?:\/|$)/;
      const match = url.match(regex);
      
      if (match && match[1]) {
        return match[1];
      } else {
        setFigmaUrlError('Invalid Figma URL format. Please use a valid Figma file URL.');
        return null;
      }
    } catch (error) {
      setFigmaUrlError('Error parsing Figma URL.');
      return null;
    }
  };

  const clearPolling = useCallback(() => {
    if (pollingIntervalIdRef.current) {
      clearInterval(pollingIntervalIdRef.current);
      pollingIntervalIdRef.current = null;
    }
    if (pollingTimeoutIdRef.current) {
      clearTimeout(pollingTimeoutIdRef.current);
      pollingTimeoutIdRef.current = null;
    }
    if (authWindowRef.current && !authWindowRef.current.closed) {
      authWindowRef.current.close();
      authWindowRef.current = null;
    }
    setIsAuthenticating(false);
    currentReadKeyRef.current = null;
  }, []);

  const pollForToken = useCallback(async (readKey: string) => {
    if (!readKey) {
      console.error("pollForToken called without a readKey.");
      clearPolling();
      setAuthError("Internal error: Polling started without a key.");
      return;
    }

    try {
      const response = await fetch(`${SERVER_URL}/api/oauth/poll-status?readKey=${readKey}`, {headers: {
        "ngrok-skip-browser-warning": "1",
      }});
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Polling failed with status: ${response.status}` }));
        console.error('Polling error response:', errorData);
        setAuthError(errorData.message || 'Polling request failed.');
        clearPolling();
        return;
      }

      const data = await response.json();

      if (data.status === 'completed' && data.accessToken) {
        parent.postMessage({
          pluginMessage: {
            type: 'store-token',
            token: data.accessToken,
          }
        }, '*');
        setIsAuthenticated(true);
        setAuthError(null);
        clearPolling();
      } else if (data.status === 'pending') {
        console.log('Authentication pending...');
      } else if (data.status === 'error') {
        console.error('Authentication error from poll:', data.message);
        setAuthError(data.message || 'Authentication failed.');
        clearPolling();
      } else {
        console.error('Unexpected poll status:', data);
        setAuthError('Received an unexpected response during authentication.');
        clearPolling();
      }
    } catch (error) {
      console.error('Network error during polling:', error);
      setAuthError('Network error while checking authentication status.');
      clearPolling();
    }
  }, [clearPolling, SERVER_URL]);

  const startPolling = useCallback((readKey: string) => {
    if (pollingIntervalIdRef.current) {
      clearInterval(pollingIntervalIdRef.current);
    }
    if (pollingTimeoutIdRef.current) {
      clearTimeout(pollingTimeoutIdRef.current);
    }

    currentReadKeyRef.current = readKey;
    setIsAuthenticating(true);
    setAuthError(null);

    pollForToken(readKey);

    pollingIntervalIdRef.current = setInterval(() => {
      if (currentReadKeyRef.current) {
        pollForToken(currentReadKeyRef.current);
      }
    }, POLLING_INTERVAL_MS) as any as number;

    pollingTimeoutIdRef.current = setTimeout(() => {
      if (pollingIntervalIdRef.current) { 
        setAuthError('Authentication timed out. Please try again.');
        clearPolling();
      }
    }, POLLING_TIMEOUT_MS) as any as number;

  }, [pollForToken, clearPolling]);


  const handleConnectFigma = async () => {
    if (isAuthenticating) return;

    setAuthError(null);
    setIsAuthenticating(true);

    try {
      const response = await fetch(`${SERVER_URL}/api/oauth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Failed to initiate auth: ${response.status}` }));
        throw new Error(errorData.message || `Failed to initiate authentication. Status: ${response.status}`);
      }

      const { readKey, authUrlToOpen } = await response.json();

      if (!readKey || !authUrlToOpen) {
        throw new Error('Invalid response from initiation server.');
      }

      if (authWindowRef.current && !authWindowRef.current.closed) {
        authWindowRef.current.close();
      }

      authWindowRef.current = window.open(authUrlToOpen, '_blank', 'width=600,height=700,resizable=yes,scrollbars=yes');
      
      if (!authWindowRef.current) {
        setAuthError("Attempting to open auth window. If it doesn't appear, check for a 'Popup Blocked' notification and allow it.");
      }
      startPolling(readKey);

    } catch (error: any) {
      console.error('ERROR CAUGHT in handleConnectFigma:', error.message, error);
      setAuthError(error.message || 'An error occurred during authentication setup.');
      setIsAuthenticating(false);
      clearPolling(); 
       if (authWindowRef.current && !authWindowRef.current.closed) {
         authWindowRef.current.close();
       }
    }
  };

  const handleDisconnectFigma = () => {
    parent.postMessage({
      pluginMessage: {
        type: 'clear-token'
      }
    }, '*');
    
    setIsAuthenticated(false);
    setAuthError(null);
    setCommentsData(null);
    setProcessedComments(null);
    setAiSummary('');
    setCommentsError(null);
    setCommentsMap(new Map());
    setShowChunkingWarning(false);
    setHasConfirmedChunking(false);
    clearPolling();
  };

  const handleReconnectFigma = async () => {
    // Force a clean re-auth to avoid dealing with expired tokens.
    handleDisconnectFigma();
    await handleConnectFigma();
  };

  const handleProcessFigmaComments = () => {
    if (isProcessingComments) {
      return;
    }

    // Extract file key from URL first
    const fileKey = extractFileKeyFromUrl(figmaUrl);
    if (!fileKey) {
      if (!figmaUrl.trim()) {
        setFigmaUrlError('Please enter a Figma file URL.');
      }
      return;
    }

    setIsProcessingComments(true);
    setCommentsError(null);
    setProcessedComments(null);
    setAiSummary('');
    setCommentsMap(new Map());
    setHasConfirmedChunking(false);

    parent.postMessage({ 
      pluginMessage: { 
        type: 'request-figma-data-for-comment-processing',
        fileKey: fileKey 
      } 
    }, '*');
  };

  const handleProceedWithChunking = () => {
    // Extract file key from URL
    const fileKey = extractFileKeyFromUrl(figmaUrl);
    if (!fileKey) {
      if (!figmaUrl.trim()) {
        setFigmaUrlError('Please enter a Figma file URL.');
      }
      return;
    }

    setShowChunkingWarning(false);
    setHasConfirmedChunking(true);
    setIsProcessingComments(true);
    parent.postMessage({ 
      pluginMessage: { 
        type: 'request-figma-data-for-comment-processing',
        fileKey: fileKey // Pass the extracted file key
      } 
    }, '*');
  };

  const handleCancelChunking = () => {
    setShowChunkingWarning(false);
    setHasConfirmedChunking(false);
    setIsProcessingComments(false);
  };

  useEffect(() => {
    const handlePluginMessages = async (event: MessageEvent) => {
      if (!event.data || !event.data.pluginMessage) {
        if (event.data && event.data.source === 'react-devtools-content-script') {
            return;
        }
        return;
      }
      
      const { type, token, isAuthenticated: controllerIsAuthenticated, error: pluginError, fileKey, accessToken } = event.data.pluginMessage;
      
      if (type === 'token-stored' || (type === 'auth-status-checked' && controllerIsAuthenticated && token)) {
        setIsAuthenticated(true);
        setAuthError(null);
        clearPolling();
      } else if (type === 'auth-status-checked' && !controllerIsAuthenticated) {
        setIsAuthenticated(false);
      } else if (type === 'figma-data-for-comment-processing-ready') {
        if (!fileKey || !accessToken) {
          setCommentsError("Internal error: Plugin did not provide necessary data for comment processing.");
          setIsProcessingComments(false);
          return;
        }
        
        try {
          const backendResponse = await fetch(`${SERVER_URL}/api/comments/getComments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              fileKey, 
              accessToken, 
              dateRange: selectedDateRange,
              proceedWithChunking: hasConfirmedChunking // Use the confirmation flag instead
            }),
          });

          if (!backendResponse.ok) {
            const errData = await backendResponse.json().catch(() => ({ message: `Server error: ${backendResponse.status}` }));
            throw new Error(errData.message || errData.error || `Failed to process comments. Server status: ${backendResponse.status}`);
          }

          const responseData = await backendResponse.json();
          
          if (responseData.requiresChunking) {
            setShowChunkingWarning(true);
            setIsProcessingComments(false);
            return;
          }
          
          if (responseData.filteredComments && Array.isArray(responseData.filteredComments)) {
            const typedComments: FilteredComment[] = responseData.filteredComments;
            setCommentsData(typedComments);
            setProcessedComments(`Summarised ${typedComments.length} comments`);
            setAiSummary(responseData.aiSummary || '');
            
            const newMap = new Map<string, FilteredComment>();
            typedComments.forEach((comment) => {
              if (comment.id) {
                newMap.set(comment.id, comment);
              }
            });
            setCommentsMap(newMap);
          } else {
            setCommentsData(null);
            setProcessedComments("Successfully processed comments. (No specific data returned to UI)");
            setAiSummary(responseData.aiSummary || 'AI summary unavailable or no comments found.');
            setCommentsMap(new Map());
          }
          setCommentsError(null);
        } catch (fetchError: any) {
          setCommentsError(fetchError.message || 'An error occurred while processing comments.');
          setProcessedComments(null);
          setAiSummary('Failed to generate AI summary. Probably because I\'m too cheap to pay for non rate limited API access');
          setCommentsMap(new Map());
        } finally {
          setIsProcessingComments(false);
        }
      } else if (type === 'figma-data-retrieval-error') {
        setCommentsError(pluginError || 'Plugin controller encountered an error retrieving Figma data.');
        setIsProcessingComments(false);
        setProcessedComments(null);
        setAiSummary('Failed to generate AI summary');
      } else if (type === 'token-cleared') {
        setIsAuthenticated(false);
        setAuthError(null);
      }
    };
    
    window.addEventListener('message', handlePluginMessages);
    parent.postMessage({ pluginMessage: { type: 'check-auth' } }, '*');

    return () => {
      window.removeEventListener('message', handlePluginMessages);
      clearPolling();
    };
  }, [clearPolling, SERVER_URL, selectedDateRange, showChunkingWarning, hasConfirmedChunking]);

  const processTextWithIdReferences = (text: string): (string | JSX.Element)[] => {
    if (!text || typeof text !== 'string' || commentsMap.size === 0) {
      return [text];
    }

    const idTagPattern = /(\[ID:\s*[\w\d-]+(?:,\s*[\w\d-]+)*\])/g;
    const idContentPattern = /^\[ID:\s*([\w\d-]+(?:,\s*[\w\d-]+)*)\]$/;

    const parts = text.split(idTagPattern);
    
    return parts.map((part, index) => {
      if (index % 2 === 0) {
        return part;
      } else {
        const idContentMatch = part.match(idContentPattern);
        if (idContentMatch && idContentMatch[1]) {
          const idsString = idContentMatch[1];
          const commentIds = idsString.split(',').map(id => id.trim());
          
          return (
            <span key={`id-group-${index}`} className="comment-reference-badge-wrapper">
              {commentIds.map((id, idIdx) => {
                const comment = commentsMap.get(id);
                if (comment) {
                  return (
                    <CommentReferenceBadge
                      key={`badge-${id}-${idIdx}`}
                      commentId={id}
                      comment={comment}
                    />
                  );
                } else {
                  return (
                    <span key={`missing-id-${id}-${idIdx}`} className="text-red-500">
                      {`[ID: ${id} not found]`}
                    </span>
                  );
                }
              })}
            </span>
          );
        }
        return part;
      }
    }).filter(Boolean);
  };

  const processChildren = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === 'string') {
      const processed = processTextWithIdReferences(children);
      return processed.length === 1 ? processed[0] : processed;
    }
    
    if (Array.isArray(children)) {
      return children.map((child, index) => {
        if (React.isValidElement(child)) {
          const childProps = child.props as any; // Type assertion to access children
          return React.cloneElement(child, { key: index }, processChildren(childProps.children));
        } else if (typeof child === 'string') {
          return processTextWithIdReferences(child);
        } else {
          return child;
        }
      }).flat();
    }
    
    return children;
  };

  const markdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="">{processChildren(children)}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="">{processChildren(children)}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="">{processChildren(children)}</h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="comments-text">{processChildren(children)}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="">{processChildren(children)}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="">{processChildren(children)}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="">{processChildren(children)}</li>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="">{processChildren(children)}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="">{processChildren(children)}</em>
    ),
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="">{processChildren(children)}</code>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="">{processChildren(children)}</blockquote>
    ),
  };

  const renderSummaryWithInlineReferences = (summary: string): JSX.Element => {
    if (!summary) return <div>No summary available</div>;
    
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <ReactMarkdown components={markdownComponents}>
          {summary}
        </ReactMarkdown>
      </Suspense>
    );
  };

  return (
    <div>
      {/* <div className="pageContainer"> */}
        {!isAuthenticated && (
          <div
            className="sign-in-container"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: "top center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <span className="grid-line-horizontal top"></span>
            <span className="grid-line-vertical left"></span>
            <span className="grid-line-vertical right"></span>
            <span className="grid-line-horizontal bottom"></span>
  
            <div
              className={
                !isAuthenticated
                  ? "header-content-unauthenticated"
                  : "header-content"
              }
            >
              <h1>Summarise and export comments</h1>
              <p className="secondary-text">
                Summarises and exports all unresolved comments in the file.
              </p>
  
              <div className="connect-button-container">
                <button
                  onClick={handleConnectFigma}
                  className="primary-button"
                  disabled={isAuthenticating}
                  aria-label="Connect Figma Account"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6.91775 19.1667C5.4143 19.1667 4.19553 17.9176 4.19553 16.3768C4.19553 14.836 5.4143 13.587 6.91775 13.587H9.63997V16.3768C9.63997 17.9176 8.42119 19.1667 6.91775 19.1667ZM13.1112 6.41305H10.389V0.833344H13.1112C14.6146 0.833344 15.8334 2.0824 15.8334 3.6232C15.8334 5.164 14.6146 6.41305 13.1112 6.41305ZM6.88897 6.41305H9.61119V0.833344H6.88897C5.38553 0.833344 4.16675 2.0824 4.16675 3.6232C4.16675 5.164 5.38553 6.41305 6.88897 6.41305ZM6.88897 12.7899H9.61119V7.21015H6.88897C5.38553 7.21015 4.16675 8.45921 4.16675 10C4.16675 11.5408 5.38553 12.7899 6.88897 12.7899ZM12.7223 7.21015C12.1035 7.21015 11.51 7.46209 11.0724 7.91055C10.6348 8.35901 10.389 8.96725 10.389 9.60146C10.389 10.2357 10.6348 10.8439 11.0724 11.2924C11.51 11.7408 12.1035 11.9928 12.7223 11.9928C13.3411 11.9928 13.9346 11.7408 14.3722 11.2924C14.8098 10.8439 15.0556 10.2357 15.0556 9.60146C15.0556 8.96725 14.8098 8.35901 14.3722 7.91055C13.9346 7.46209 13.3411 7.21015 12.7223 7.21015Z"
                      fill="white"
                    />
                  </svg>
  
                  {isAuthenticating ? "Authenticating..." : "Connect Figma"}
                </button>
                {authError && (
                  <p
                    role="alert"
                    className="error-message"
                    style={{ color: "red" }}
                  >
                    {authError}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      <div className="app-container">
        {isAuthenticated && (
          <>
            <div className="date-range-header">
              <div className="date-range-header-left">
                
                {/* Figma URL Input */}
                <div className="figma-url-container">
                  <label htmlFor="figma-url-input" className="url-input-label">
                    Figma file URL
                  </label>
                  <input
                    id="figma-url-input"
                    type="url"
                    value={figmaUrl}
                    onChange={(e) => {
                      setFigmaUrl(e.target.value);
                      setFigmaUrlError(null); // Clear error when user types
                    }}
                    placeholder="https://www.figma.com/design/KtVYgefRcRfvFYgUlJxiN7/..."
                    className="url-input"
                  />
                  {figmaUrlError && (
                    <p className="error-message" style={{ 
                      color: '#ff4444', 
                      fontSize: '12px', 
                      marginTop: '4px',
                      marginBottom: '0'
                    }}>
                      {figmaUrlError}
                    </p>
                  )}
                </div>
              </div>
              <div className="date-range-container">
                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label htmlFor="date-range-select" className="url-input-label">
                      Date range
                </label>
                <select
                  id="date-range-select"
                  aria-label="Select date range"
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                >
                  <option value="all">All time</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="3d">Last 3 days</option>
                  <option value="7d">Last 7 days</option>
                </select>
                </div>
              <button
                onClick={handleProcessFigmaComments}
                disabled={isProcessingComments}
                aria-label="Summarise Figma Comments"
                className="blue-button"
              >
                {isProcessingComments ? "Processing..." : "Summarise"}
              </button>
              </div>
            </div>
          {/* </> */}
        {/* // <> */}
          <div className="commentsPanel">
          {commentsError && (
            <p
              role="alert"
              className="error-message"
              style={{ marginTop: "8px"}}
            >
              {commentsError}
            </p>
          )}
            {showChunkingWarning && (
              <div className="chunking-warning-dialog">
                <div className="warning-content">
                  <h4>⚠️ Large Comment Set Detected</h4>
                  <p>
                    Comments will be chunked into smaller sets. <br />
                    To avoid this try limiting the date range.
                  </p>
                  <div className="warning-actions">
                    <button
                      onClick={handleCancelChunking}
                      className="tertiary-button"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleProceedWithChunking}
                      className="primary-button"
                    >
                      Proceed
                    </button>
                  </div>
                </div>
              </div>
            )}
            {!isProcessingComments &&
              !processedComments &&
              !showChunkingWarning && (
                commentsError ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0, marginBottom: '8px' }}>Confirm the share URL is correct, and that you authenticated the correct Figma account.</p>
                    </div>
                    <button
                      onClick={handleReconnectFigma}
                      className="primary-button"
                      aria-label="Reconnect Figma Account"
                    >
                      Reconnect Figma
                    </button>
                  </div>
                ) : (
                  <img
                    src={emptyStateImage}
                    alt="Empty State"
                    className="empty-state-image"
                  />
                )
              )}
            {isProcessingComments && (
              <div className="processing-comments-container">
                <Loader />
              </div>
            )}
            
  
            {processedComments && (
              <>
                <div className="tab-navigation">
                  <button
                    onClick={() => setActiveTab("summary")}
                    className={`tab-button ${activeTab === "summary" ? "active" : ""}`}
                  >
                    Summary
                  </button>
                  <button
                    onClick={() => setActiveTab("json")}
                    className={`tab-button ${activeTab === "json" ? "active" : ""}`}
                  >
                    Raw JSON
                  </button>
                </div>
  
                <div className="tab-content">
                  {activeTab === "summary" && (
                    <>
                      <div>
                      <p className="primary-text" style={{marginBottom: '16px'}}>{processedComments || "All unresolved comments"}</p>
                        {aiSummary && (
                          <div className="ai-summary-content">
                            {renderSummaryWithInlineReferences(aiSummary)}
                          </div>
                        )}
                      </div>
                    </>
                  )}
  
                  {activeTab === "json" && (
                    <div>
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          background: "#f5f5f5",
                          padding: "16px",
                          borderRadius: "8px",
                          overflow: "auto",
                          maxHeight: "400px",
                          fontSize: "10px",
                        }}
                      >
                        {commentsData
                          ? JSON.stringify(commentsData, null, 2)
                          : "No data"}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
        )}
      </div>
  
      {isAuthenticated && (
        <div className="footer">
          <button
            onClick={handleDisconnectFigma}
            className="tertiary-button"
            aria-label="Log out of Figma Account"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m16 17 5-5-5-5"/>
              <path d="M21 12H9"/>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            </svg>
            Log Out
          </button>
        </div>
      )}
    </div>
  );
  
}

export default App; 
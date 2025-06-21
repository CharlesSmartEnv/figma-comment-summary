import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import logo from '../assets/logo.svg';
import '../styles/ui.css';
// Lazy load ReactMarkdown to reduce initial bundle size
const ReactMarkdown = lazy(() => import('react-markdown'));
import CommentReferenceBadge from './CommentReferenceBadge';

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
  const [commentsData, setCommentsData] = useState<FilteredComment[] | null>(null); // Typed commentsData
  const [aiSummary, setAiSummary] = useState<string>('');
  const [commentsMap, setCommentsMap] = useState<Map<string, FilteredComment>>(new Map());
  
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  
  const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

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
    }, POLLING_INTERVAL_MS) as any as number; // Added type assertion for setInterval return

    pollingTimeoutIdRef.current = setTimeout(() => {
      if (pollingIntervalIdRef.current) { 
        setAuthError('Authentication timed out. Please try again.');
        clearPolling();
      }
    }, POLLING_TIMEOUT_MS) as any as number; // Added type assertion for setTimeout return

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
    clearPolling();
  };

  const handleProcessFigmaComments = () => {
    if (isProcessingComments) {
      return;
    }
    setIsProcessingComments(true);
    setCommentsError(null);
    setProcessedComments(null);
    setAiSummary(''); // Clear previous summary
    setCommentsMap(new Map()); // Clear previous map

    parent.postMessage({ pluginMessage: { type: 'request-figma-data-for-comment-processing' } }, '*');
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
            body: JSON.stringify({ fileKey, accessToken, dateRange: selectedDateRange }),
          });

          if (!backendResponse.ok) {
            const errData = await backendResponse.json().catch(() => ({ message: `Server error: ${backendResponse.status}` }));
            throw new Error(errData.message || errData.error || `Failed to process comments. Server status: ${backendResponse.status}`);
          }

          const responseData = await backendResponse.json();
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
          setAiSummary('Failed to generate AI summary');
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
  }, [clearPolling, SERVER_URL, selectedDateRange]);

  const markdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="">{children}</h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      // Added a wrapper to allow inline elements like our badge to flow correctly with paragraph text
      <p className="comments-text">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="">{children}</li>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="">{children}</em>
    ),
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="">{children}</code>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="">{children}</blockquote>
    ),
  };

  const parseSummaryAndRenderWithReferences = (summary: string): (JSX.Element | null)[] => {
    if (!summary) return [];
    if (commentsMap.size === 0) {
        return [
            <Suspense key="plain-summary" fallback={<div>Loading...</div>}>
                <ReactMarkdown components={markdownComponents}>
                    {summary}
                </ReactMarkdown>
            </Suspense>
        ];
    }

    const idTagPattern = /(\[ID:\s*[\w\d-]+(?:,\s*[\w\d-]+)*\])/g; // Allow digits in IDs
    const idContentPattern = /^\[ID:\s*([\w\d-]+(?:,\s*[\w\d-]+)*)\]$/; // Allow digits in IDs

    const parts = summary.split(idTagPattern);
    let partKeyIndex = 0;

    const elements = parts.map((part, index) => {
      if (index % 2 === 0) { 
        if (part) {
          // Wrap text parts in a span if they are intended to be inline with badges
          // Or render as ReactMarkdown if they can be block elements
          return (
            <span key={`text-${partKeyIndex++}`}>
                <Suspense fallback={<span>Loading...</span>}>
                    <ReactMarkdown components={markdownComponents}>
                        {part}
                    </ReactMarkdown>
                </Suspense>
            </span>
          );
        }
        return null;
      } else { 
        const idContentMatch = part.match(idContentPattern);
        if (idContentMatch && idContentMatch[1]) {
          const idsString = idContentMatch[1]; 
          const commentIds = idsString.split(',').map(id => id.trim());
          
          const badgeElements = commentIds.map((id, idIdx) => {
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
          });
          
          // Join badge elements with a comma and space, rendered as text node if it's just one badge
          return (
            <span key={`id-group-${partKeyIndex++}`}>
              {badgeElements.reduce((prev, curr) => {
                return prev === null ? [curr] : [...(prev as JSX.Element[]), curr];
              }, null as (JSX.Element[] | null))}
            </span>
          );

        }        
        return (
            <span key={`malformed-tag-${partKeyIndex++}`}>
                <Suspense fallback={<span>Loading...</span>}>
                    <ReactMarkdown components={markdownComponents}>
                        {part}
                    </ReactMarkdown>
                </Suspense>
            </span>
        );
      }
    });
    return elements.filter(Boolean as unknown as (value: JSX.Element | null) => value is JSX.Element); // type assertion for filter
  };

  return (
    <div>
      <div className='pageContainer'>
        <div className='header'>
        <img className='logo' src={logo} alt="Plugin Logo" />
        {isAuthenticated && (
          <button
                  onClick={handleDisconnectFigma}
                  className="disconnect-button"
                  aria-label="Log out of Figma Account"
                >
                  Log Out
          </button>
        )}
        </div>
      <h2>Comment Summariser</h2>
      <p className='primary-text'>Summarises all unresolved comments in the file. <br /> Large comment sets will be batch processed.</p>

      {!isAuthenticated ? (
        <div style={{ marginTop: '24px' }}>
          <button
            onClick={handleConnectFigma}
            className="connect-button"
            disabled={isAuthenticating}
            aria-label="Connect Figma Account"
          >
            {isAuthenticating ? 'Authenticating...' : 'Connect Figma'}
          </button>
          {isAuthenticating && <p className='secondary-text' style={{ marginTop: '16px' }}>😬 I'm too cheap to pay for a server, so it might take 30s+ to load the first time</p>}
          {authError && (
            <p role="alert" className="error-message" style={{ color: 'red' }}>{authError}</p>
          )}
        </div>
      ) : (
        <>
          <div className='CommentsContainer' style={{ marginTop: '24px' }}>
            <div className='date-range-container'>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="date-range-select" style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                  Filter by date
                </label>
                <select 
                  id="date-range-select"
                  value={selectedDateRange} 
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                  style={{
                    maxWidth: '200px',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #949494',
                    fontSize: '16px',
                    backgroundColor: 'transparent',
                    fontFamily: 'inherit'
                  }}
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
                className="action-button"
              >
                {isProcessingComments ? 'Processing Comments...' : 'Summarise Comments'}
              </button>
            </div>
            {commentsError && (
              <p role="alert" className="error-message" style={{ color: 'red', marginTop: '5px' }}>
                {commentsError}
              </p>
            )}
            {processedComments && !commentsError && (
              <div className="commentsPanel">
                <h3 style={{ marginTop: '0' }}>{processedComments}</h3>
                <div className="space-y-4">
                  {aiSummary && (
                    <div className="prose prose-sm max-w-none ai-summary-content">
                       {parseSummaryAndRenderWithReferences(aiSummary).map((element, index) => (
                        <React.Fragment key={index}>{element}</React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
                <hr />
                <details style={{ marginTop: '16px' }}>
                  <summary>Raw JSON Data</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '12px' }}>
                    {commentsData ? JSON.stringify(commentsData, null, 2) : 'No data'}
                  </pre>
                </details>
              </div>
            )}      
          </div>
        </>
      )}
    </div>
    </div>
  );
}

export default App; 
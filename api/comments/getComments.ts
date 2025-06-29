import axios, { AxiosError } from 'axios';
import express from 'express';
import { config } from 'dotenv';
config();

const FIGMA_API_BASE_URL = 'https://api.figma.com/v1';
const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1';

// OpenRouter configuration
const openRouterApiKey = process.env.OPENROUTER_API_KEY || (() => {
  throw new Error('OPENROUTER_API_KEY environment variable is not set');
})();

interface FilteredComment {
  userHandle: string | null;
  message: string;
  createdAt: string;
  reactions: any[];
  location: string | null;
  id: string | null;
  parentComment: string  | null;
}


const filterCommentsByDateRange = (comments: any[], dateRange: string): any[] => {
  if (!dateRange || dateRange === 'all') {
    return comments;
  }

  const now = new Date();
  let cutoffDate: Date;

  switch (dateRange) {
    case '24h':
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '3d':
      cutoffDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      break;
    case '7d':
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      return comments;
  }

  return comments.filter(comment => {
    if (!comment.created_at) return false;
    const commentDate = new Date(comment.created_at);
    return commentDate >= cutoffDate;
  });
};


const extractCommentData = (comments: any[]): FilteredComment[] => {
  // First, create a set of resolved comment IDs for quick lookup
  const resolvedCommentIds = new Set(
    comments
      .filter(comment => comment.resolved_at)
      .map(comment => comment.id)
  );

  return comments
    .filter(comment => {
      // Filter out resolved comments
      if (comment.resolved_at) return false;
      
      // Filter out comments that are replies to resolved parent comments
      if (comment.parent_id && resolvedCommentIds.has(comment.parent_id)) {
        return false;
      }
      
      return true;
    })
    .map(comment => ({
      userHandle: comment.user?.handle || null,
      message: comment.message,
      createdAt: comment.created_at,
      reactions: comment.reactions || [],
      location: comment.client_meta?.node_id || null,
      id: comment.id|| null,
      parentComment: comment.parent_id || null
    }));
};

/**
 * Chunks comments into smaller groups to avoid token limits
 */
const chunkComments = (comments: FilteredComment[], maxChunkSize: number = 20): FilteredComment[][] => {
  const chunks: FilteredComment[][] = [];
  for (let i = 0; i < comments.length; i += maxChunkSize) {
    chunks.push(comments.slice(i, i + maxChunkSize));
  }
  return chunks;
};


const estimateTokenCount = (text: string): number => {
  return Math.ceil(text.length / 4);
};


const summarizeCommentsWithAI = async (sortedComments: FilteredComment[]): Promise<string> => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  if (sortedComments.length === 0) {
    return 'No comments to summarize.';
  }

  try {
    // For large comment sets, chunk them
    if (sortedComments.length > 100) {
      
      const chunks = chunkComments(sortedComments, 25);
      const chunkSummaries: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        const commentsText = chunk.map(comment => 
          `ID: ${comment.id || 'N/A'}
          User: ${comment.userHandle || 'Anonymous'}
          Message: ${comment.message}
          Created: ${comment.createdAt}
          Reactions: ${comment.reactions.length > 0 ? JSON.stringify(comment.reactions) : 'None'}
          ---`
        ).join('\n');

        // Estimate token count
        const estimatedTokens = estimateTokenCount(commentsText);

        if (estimatedTokens > 3000) {
          console.warn(`Chunk ${i + 1} may be too large (${estimatedTokens} tokens). Skipping.`);
          chunkSummaries.push(`Chunk ${i + 1}: Too large to process (${chunk.length} comments)`);
          continue;
        }

        const response = await axios.post(
          `${OPENROUTER_API_BASE_URL}/chat/completions`,
          {
            model: 'deepseek/deepseek-chat-v3-0324:free',
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant that summarizes Figma design comments. Provide a concise summary highlighting key feedback themes with primary action points at the top. Merge similar themes together and do not number them. At the end of each theme in your summary, cite the ID(s) of the original comment(s) that support it using the format [ID: comment_id_1, comment_id_2]. Each comment in the input will have an \'ID:\' field. Do not include comment ID citations for action point summary. Keep it brief as this is part of a larger summary.',
              },
              {
                role: 'user',
                content: `Please summarize these Figma comments (chunk ${i + 1}/${chunks.length}):\n\n${commentsText}`
              }
            ],
            // max_tokens: 300,
            // temperature: 0.7,
          },
          {
            headers: {
              'Authorization': `Bearer ${openRouterApiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
              'X-Title': 'Figma Comment Export'
            },
          }
        );

        const chunkSummary = response.data.choices[0]?.message?.content || `Unable to summarize chunk ${i + 1}`;
        chunkSummaries.push(`**Chunk ${i + 1}:** ${chunkSummary}`);

        // Add delay between requests to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Combine all chunk summaries
      const finalSummary = `**Summary of ${sortedComments.length} comments (processed in ${chunks.length} chunks):**\n\n${chunkSummaries.join('\n\n')}`;
      return finalSummary;

    } else {
      // Handle smaller comment sets normally
      const commentsText = sortedComments.map(comment => 
        `ID: ${comment.id || 'N/A'}
        User: ${comment.userHandle || 'Anonymous'}
        Message: ${comment.message}
        Created: ${comment.createdAt}
        Reactions: ${comment.reactions.length > 0 ? JSON.stringify(comment.reactions) : 'None'}
        ---`
      ).join('\n');

      const estimatedTokens = estimateTokenCount(commentsText);

      if (estimatedTokens > 10000) {
        throw new Error(`Comment set too large (${estimatedTokens} estimated tokens). Consider reducing comment count.`);
      }

      const response = await axios.post(
        `${OPENROUTER_API_BASE_URL}/chat/completions`,
        {
          model: 'deepseek/deepseek-chat-v3-0324:free',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that summarizes Figma design comments. Provide a concise summary highlighting key feedback themes with primary action points at the top. Merge similar themes together and do not number them. At the end of each theme in your summary, cite the ID(s) of the original comment(s) that support it using the format [ID: comment_id_1, comment_id_2]. Each comment in the input will have an \'ID:\' field. Do not include comment ID citations for action point summary. Keep it brief as this is part of a larger summary.'
            },
            {
              role: 'user',
              content: `Please summarize these Figma comments:\n\n${commentsText}`
            }
          ],
          // max_tokens: 300,
          // temperature: 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
            'X-Title': 'Figma Comment Export'
          },
        }
      );

      return response.data.choices[0]?.message?.content || 'Unable to generate summary.';
    }

  } catch (error) {
    console.error('Error calling OpenRouter API:', error);
    
    // More specific error handling
    if (error instanceof Error) {
      if (error.message.includes('token')) {
        throw new Error(`Token limit exceeded: ${error.message}`);
      }
      if (error.message.includes('rate')) {
        throw new Error(`Rate limit exceeded: ${error.message}`);
      }
      throw new Error(`OpenRouter API error: ${error.message}`);
    }
    
    throw new Error('Failed to generate AI summary');
  }
};


const handleGetFileComments = async (req: express.Request, res: express.Response) => {

  const { fileKey, accessToken, dateRange, proceedWithChunking } = req.body;

  if (!fileKey) {
    return res.status(400).json({ error: 'Missing fileKey in request body' });
  }

  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized: Missing accessToken in request body' });
  }

  try {
    console.log('Figma Filekey:', fileKey);
    console.log('accessToken (first 8):', accessToken?.slice(0,8));
    const response = await axios.get(
      `${FIGMA_API_BASE_URL}/files/${fileKey}/comments`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const comments = response.data.comments;
    
    // Apply date range filtering first
    const dateFilteredComments = filterCommentsByDateRange(comments || [], dateRange);
    
    // Extract filtered comment data for AI processing
    const filteredComments = extractCommentData(dateFilteredComments);

    // Create a proper parent-child sorted structure
    const createParentChildSortedComments = (comments: FilteredComment[]): FilteredComment[] => {
      const commentMap = new Map<string, FilteredComment>();
      const childrenMap = new Map<string, FilteredComment[]>();
      const rootComments: FilteredComment[] = [];

      comments.forEach(comment => {
        if (comment.id) {
          commentMap.set(comment.id, comment);
        }
        
        if (comment.parentComment) {
          // Child comment
          if (!childrenMap.has(comment.parentComment)) {
            childrenMap.set(comment.parentComment, []);
          }
          childrenMap.get(comment.parentComment)!.push(comment);
        } else {
          // root comment
          rootComments.push(comment);
        }
      });

      // Sort root comments by creation date (or location if you prefer)
      rootComments.sort((a, b) => {
        // First try to sort by location if both have it
        if (a.location && b.location) {
          return a.location.localeCompare(b.location);
        }
        // If one has location and other doesn't, prioritize the one with location
        if (a.location && !b.location) return -1;
        if (!a.location && b.location) return 1;
        // If neither has location, sort by creation date
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      // Recursive function to add a comment and all its descendants
      const addCommentWithChildren = (comment: FilteredComment, result: FilteredComment[]) => {

        result.push(comment);
        
        if (comment.id && childrenMap.has(comment.id)) {
          const children = childrenMap.get(comment.id)!;
          children.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          
          children.forEach(child => {
            addCommentWithChildren(child, result);
          });
        }
      };

      // Final array
      const result: FilteredComment[] = [];
      
      rootComments.forEach(rootComment => {
        addCommentWithChildren(rootComment, result);
      });

      // Handle orphaned comments (children whose parents might have been filtered out)
      const processedIds = new Set(result.map(c => c.id).filter(Boolean));
      comments.forEach(comment => {
        if (comment.id && !processedIds.has(comment.id)) {
          result.push(comment);
        }
      });

      return result;
    };

    const sortedComments = createParentChildSortedComments(filteredComments);

    // Early warning check for large comment sets
    if (sortedComments.length > 100 && !proceedWithChunking) {
      return res.status(200).json({
        requiresChunking: true,
        message: `Found ${sortedComments.length} comments. Processing will require chunking and may take ${Math.ceil(sortedComments.length / 25) * 2} seconds or more. Do you want to proceed?`
      });
    }

    let aiSummary = '';
    try {
      aiSummary = await summarizeCommentsWithAI(sortedComments);
    } catch (aiError) {
      console.error('Failed to generate AI summary:', aiError);
      aiSummary = 'AI summary unavailable due to processing error.';
    }

    return res.status(200).json({ 
      processedData: comments || [],
      aiSummary: aiSummary,
      filteredComments: sortedComments
    });

  } catch (error) {
    console.error('Error fetching Figma comments:', error);

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        console.error('Figma API Error Response:', axiosError.response.data);
        console.error('Status:', axiosError.response.status);
        console.error('Headers:', axiosError.response.headers);
        console.error('Body:', axiosError.response.data);   // <-- most useful
        return res.status(axiosError.response.status || 500).json({
          error: 'Failed to fetch comments from Figma API',
          details: axiosError.response.data,
        });
      }
    }
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

export default handleGetFileComments; 
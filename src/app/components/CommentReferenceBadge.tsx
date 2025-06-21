import React, { useState } from 'react';
import './CommentReferenceBadge.css'; // Import the CSS file

// Define the structure of a comment object, mirroring FilteredComment from the backend
// Or import it if you have a shared types directory
interface FilteredComment {
  userHandle: string | null;
  message: string;
  createdAt: string;
  reactions: any[];
  location: string | null;
  id: string | null;
  parentComment: string | null;
}

interface CommentReferenceBadgeProps {
  commentId: string;
  comment: FilteredComment;
}

const CommentReferenceBadge: React.FC<CommentReferenceBadgeProps> = ({ commentId, comment }) => {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <span 
      className="comment-reference-badge-wrapper"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocus={() => setIsHovering(true)} 
      onBlur={() => setIsHovering(false)}  
    >
      <span 
        className="comment-reference-badge"
        aria-label={`Reference to comment ID ${commentId}. Press enter or space to view details.`}
        tabIndex={0} 
        role="button" 
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsHovering(!isHovering); 
          }
        }}
      >
        {comment.userHandle?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
      </span>
      {isHovering && (
        <div 
          className="comment-tooltip"
          role="tooltip"
        >
          <p className="tooltip-user-handle">{comment.userHandle || 'Anonymous'}</p>
          <p className="tooltip-message">{comment.message}</p>
          <p className="tooltip-meta">
            Created: {new Date(comment.createdAt).toLocaleString()}
          </p>
          {comment.location && <p className="tooltip-meta">Node ID: {comment.location}</p>}
          {comment.reactions && comment.reactions.length > 0 && (
            <p className="tooltip-meta">
              Reactions: {comment.reactions.map((r: any) => r.emoji).join(' ')}
            </p>
          )}
        </div>
      )}
    </span>
  );
};

export default CommentReferenceBadge; 
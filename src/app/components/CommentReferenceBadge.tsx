import React, { useState } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
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
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(5),
      flip({
        fallbackAxisSideDirection: "start",
      }),
      shift()
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { move: false });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return (
    <>
      <span 
        className="comment-reference-badge-wrapper"
        ref={refs.setReference}
        {...getReferenceProps()}
      >
        <span 
          className="comment-reference-badge"
          aria-label={`Reference to comment ID ${commentId}. Press enter or space to view details.`}
          tabIndex={0} 
          role="button"
        >
          {comment.userHandle?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
        </span>
      </span>
      
      {isOpen && (
        <FloatingPortal>
          <div 
            className="comment-tooltip"
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
          >
            <p className="tooltip-user-handle">{comment.userHandle || 'Anonymous'}</p>
            <p className="tooltip-message">{comment.message}</p>
            <p className="tooltip-meta">
              Created: {new Date(comment.createdAt).toLocaleString()}
            </p>
            {comment.reactions && comment.reactions.length > 0 && (
              <p className="tooltip-meta">
                Reactions: {comment.reactions.map((r: any) => r.emoji).join(' ')}
              </p>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
};

export default CommentReferenceBadge; 
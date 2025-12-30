import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface MessageBubbleProps {
  content: string;
  thinking?: string;
  position: { x: number; y: number };
  isVisible: boolean;
  alignment: 'left' | 'right';
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  content, 
  thinking, 
  position, 
  isVisible,
  alignment 
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, thinking]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={clsx(
            "absolute z-50 w-64 md:w-80 pointer-events-auto",
            "flex flex-col"
          )}
          style={{
            left: position.x,
            top: position.y,
            transform: `translate(${alignment === 'left' ? '-100%' : '0'}, -50%)`,
            marginLeft: alignment === 'left' ? '-20px' : '20px',
            marginRight: alignment === 'right' ? '-20px' : '20px',
          }}
        >
          {/* Bubble Tail */}
          <div 
            className={clsx(
              "absolute top-1/2 w-4 h-4 bg-slate-800 rotate-45 border border-slate-600",
              alignment === 'left' ? "-right-2 border-l-0 border-b-0" : "-left-2 border-r-0 border-t-0"
            )} 
          />

          <div className="bg-slate-800/95 backdrop-blur-md border border-slate-600 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[300px]">
            {/* Header / Thinking Status */}
            {thinking && (
              <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-700/50">
                <div className="flex items-center gap-2 text-xs text-purple-400">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  <span className="font-medium">深度思考中...</span>
                </div>
              </div>
            )}

            {/* Scrollable Content Area */}
            <div 
              ref={contentRef}
              className="p-4 overflow-y-auto custom-scrollbar scroll-smooth"
            >
              {/* Thinking Content (Collapsible or Distinct) */}
              {thinking && (
                <div className="mb-3 text-xs text-slate-400 italic border-l-2 border-purple-500/30 pl-3">
                  {thinking}
                </div>
              )}
              
              {/* Main Content */}
              <div className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">
                {content}
                {(content.length === 0 && !thinking) && (
                  <span className="animate-pulse text-slate-500">...</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MessageBubble;

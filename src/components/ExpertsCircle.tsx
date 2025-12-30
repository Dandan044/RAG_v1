import React from 'react';
import { motion } from 'framer-motion';
import { Expert, DiscussionMessage } from '@/types';
import clsx from 'clsx';
import MessageBubble from './MessageBubble';

interface ExpertsCircleProps {
  experts: Expert[];
  // Support for multiple active speakers (Novel Mode)
  activeExpertIds?: string[];
  expertContentMap?: Record<string, { content: string; thinking?: string }>;
  // Legacy/Single Speaker Mode
  currentSpeakerId?: string;
  messages?: DiscussionMessage[];
}

const ExpertsCircle: React.FC<ExpertsCircleProps> = ({ 
  experts, 
  activeExpertIds = [], 
  expertContentMap = {}, 
  currentSpeakerId, 
  messages = []
}) => {
  const radius = 260; // Radius of the circle
  const center = 300; // Center of the container

  // Normalize active speakers
  const activeIds = currentSpeakerId ? [currentSpeakerId] : activeExpertIds;

  return (
    <div className="relative w-[600px] h-[600px] mx-auto flex items-center justify-center transform scale-75 origin-center">
      {/* Roundtable Table Graphic */}
      <div className="absolute inset-0 m-auto w-[400px] h-[400px] rounded-full bg-slate-800/50 border-4 border-slate-700 shadow-2xl backdrop-blur-sm flex items-center justify-center">
        <div className="w-[300px] h-[300px] rounded-full border border-slate-700/50 opacity-50" />
        {/* Center Decoration or Logo */}
        <div className="absolute w-20 h-20 rounded-full bg-slate-900/80 border border-slate-600 flex items-center justify-center shadow-inner">
           <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 animate-pulse" />
        </div>
      </div>

      {experts.map((expert, index) => {
        const angle = (index * (360 / experts.length)) - 90; // Start from top
        const radian = (angle * Math.PI) / 180;
        const x = center + radius * Math.cos(radian) - 40; // 40 is half of avatar size (80px)
        const y = center + radius * Math.sin(radian) - 40;

        const isSpeaking = activeIds.includes(expert.id);
        
        // Determine content
  let content = '';
  let thinking = '';

  if (expertContentMap[expert.id]) {
      content = expertContentMap[expert.id].content;
      thinking = expertContentMap[expert.id].thinking || '';
  } else if (messages.length > 0) {
       const lastMsg = messages
          .filter(m => m.expertId === expert.id)
          .sort((a, b) => b.timestamp - a.timestamp)[0];
       if (lastMsg) {
           content = lastMsg.content;
           thinking = lastMsg.thinking || '';
       }
  }

  // Determine bubble alignment based on position (left or right side of circle)
  // Cosine is positive on right side (0 to 90, 270 to 360), negative on left
  const isRightSide = Math.cos(radian) >= 0;

  return (
    <React.Fragment key={expert.id}>
      <motion.div
        className="absolute"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ 
          opacity: 1, 
          scale: isSpeaking ? 1.1 : 1,
          left: x,
          top: y,
          zIndex: isSpeaking ? 50 : 10,
          filter: isSpeaking ? 'none' : 'grayscale(100%) opacity(0.7)'
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="flex flex-col items-center gap-2 w-32">
          <div className={clsx(
            "relative w-20 h-20 rounded-full bg-slate-800 border-4 transition-all duration-300 overflow-hidden",
            isSpeaking ? "border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.5)] scale-110" : "border-slate-600"
          )}>
            <img 
              src={expert.avatar} 
              alt={expert.name} 
              className="w-full h-full object-cover"
            />
            {isSpeaking && (
              <motion.div
                className="absolute inset-0 bg-blue-500/20"
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
          </div>
          
          <div className={clsx(
            "text-center transition-all duration-300 p-2 rounded-lg backdrop-blur-md",
            isSpeaking ? "bg-slate-800/90 shadow-lg -translate-y-1" : "bg-slate-900/50"
          )}>
            <div className="font-bold text-sm text-slate-100 truncate w-full">{expert.name}</div>
            <div className="text-xs text-slate-400 truncate w-full">{expert.field}</div>
          </div>
        </div>
      </motion.div>

      {/* Floating Message Bubble */}
      <MessageBubble 
        isVisible={isSpeaking && (!!content || !!thinking)}
        content={content}
        thinking={thinking}
        position={{ x: isRightSide ? x + 80 : x, y: y + 40 }} // Anchor to avatar side
        alignment={isRightSide ? 'right' : 'left'}
      />
    </React.Fragment>
  );
})}
    </div>
  );
};

export default ExpertsCircle;

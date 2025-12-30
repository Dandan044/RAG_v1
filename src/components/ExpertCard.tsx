import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Expert } from '@/types';
import clsx from 'clsx';
import { Maximize2, Minimize2, Database, Brain } from 'lucide-react';

interface ExpertCardProps {
  expert: Expert;
  isActive: boolean;
  content?: string;
  thinking?: string;
}

const ExpertCard: React.FC<ExpertCardProps> = ({ expert, isActive, content, thinking }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <motion.div
        layout
        onClick={() => setIsExpanded(true)}
        className={clsx(
          "w-full bg-slate-900/80 border rounded-xl p-4 cursor-pointer transition-all relative overflow-hidden group",
          isActive ? "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]" : "border-slate-800 hover:border-slate-700"
        )}
      >
        {/* Active Indicator */}
        {isActive && (
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
        )}

        <div className="flex items-start gap-3">
          <div className={clsx(
            "w-12 h-12 rounded-full border-2 overflow-hidden flex-shrink-0",
            isActive ? "border-blue-400" : "border-slate-600 grayscale"
          )}>
            <img src={expert.avatar} alt={expert.name} className="w-full h-full object-cover" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-slate-200 text-sm">{expert.name}</h4>
                <span className="text-xs text-slate-500">{expert.field}</span>
              </div>
              {isActive && (
                <span className="flex items-center gap-1 text-[10px] bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full animate-pulse">
                  <Brain className="w-3 h-3" />
                  Speaking
                </span>
              )}
            </div>

            {/* Preview Content */}
            {(content || thinking) && (
              <div className="mt-2 text-xs text-slate-400 line-clamp-2">
                {thinking ? (
                  <span className="text-purple-400 italic mr-1">[思考中...]</span>
                ) : null}
                {content}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Expanded Modal */}
      <AnimatePresence>
        {isExpanded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsExpanded(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <img src={expert.avatar} alt={expert.name} className="w-16 h-16 rounded-full border-2 border-slate-600" />
                  <div>
                    <h3 className="text-xl font-bold text-slate-100">{expert.name}</h3>
                    <p className="text-slate-400">{expert.field} • {expert.personality}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                >
                  <Minimize2 className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Initial Stance */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <h5 className="text-xs font-bold text-slate-500 uppercase mb-2">初始立场</h5>
                  <p className="text-sm text-slate-300">{expert.initialStance}</p>
                </div>

                {/* Current Content */}
                {(content || thinking) ? (
                  <div className="space-y-4">
                    {thinking && (
                      <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-xl">
                        <h5 className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase mb-2">
                          <Brain className="w-4 h-4" />
                          思维链 & 工具调用
                        </h5>
                        <div className="text-sm text-purple-200/80 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                          {/* Parse and highlight tool logs */}
                          {thinking.split('\n').map((line, i) => {
                            if (line.includes('[系统]')) {
                                return <div key={i} className="text-yellow-400 font-bold my-1 p-1 bg-yellow-900/20 rounded border-l-2 border-yellow-500 pl-2">{line}</div>;
                            }
                            return <div key={i}>{line}</div>;
                          })}
                        </div>
                      </div>
                    )}
                    
                    {content && (
                      <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl">
                        <h5 className="text-xs font-bold text-blue-400 uppercase mb-2">评审意见</h5>
                        <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {content}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-12">
                    暂无发言记录
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ExpertCard;

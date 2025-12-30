import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDiscussionStore } from '@/store/useDiscussionStore';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, RefreshCw, Home } from 'lucide-react';
import { motion } from 'framer-motion';

const ConclusionPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, generateSessionConclusion, isGeneratingConclusion } = useDiscussionStore();

  useEffect(() => {
    if (!session) {
      navigate('/');
      return;
    }

    if (!session.conclusion && !isGeneratingConclusion) {
      generateSessionConclusion();
    }
  }, [session, navigate, isGeneratingConclusion, generateSessionConclusion]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              会议总结
            </h1>
            <div className="text-xs text-slate-500">
              {session.topic}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 overflow-y-auto p-4 md:p-8">
        {/* Background Grid - CSS Noise */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20 pointer-events-none" />
        
        <div className="max-w-3xl w-full z-10 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-slate-700 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <span className="text-xl">🎙️</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">主持人总结</h2>
                <p className="text-sm text-slate-400">基于 {session.messages.length} 条发言记录</p>
              </div>
            </div>

            <div className="prose prose-invert max-w-none">
              {session.conclusion ? (
                <ReactMarkdown>{session.conclusion}</ReactMarkdown>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 animate-pulse">
                  <RefreshCw className="w-8 h-8 mb-4 animate-spin" />
                  <p>正在生成会议总结...</p>
                </div>
              )}
            </div>
          </motion.div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors font-medium border border-slate-700"
            >
              <Home className="w-4 h-4" />
              返回首页
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConclusionPage;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDiscussionStore } from '@/store/useDiscussionStore';
import { ArrowLeft, Copy, Check, Home } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';

const FinalNovelPage: React.FC = () => {
  const navigate = useNavigate();
  const { novelSession } = useDiscussionStore();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!novelSession || novelSession.status !== 'completed') {
       // If refreshed or accessed directly, redirect if no session
       if (!novelSession) navigate('/');
    }
  }, [novelSession, navigate]);

  if (!novelSession) return null;

  const finalDraft = novelSession.drafts[novelSession.drafts.length - 1];

  const handleCopy = () => {
    if (finalDraft) {
      navigator.clipboard.writeText(finalDraft.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              最终成稿
            </h1>
            <div className="text-sm text-slate-500 truncate max-w-md">
              {novelSession.requirements}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-all active:scale-95 border border-slate-700"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? '已复制' : '复制全文'}
          </button>
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Home className="w-4 h-4" />
            返回首页
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-8 md:p-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 md:p-16 shadow-2xl relative overflow-hidden"
        >
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative font-serif text-lg md:text-xl leading-loose text-slate-200 prose prose-invert max-w-none prose-headings:text-emerald-400 prose-p:mb-6 prose-p:text-slate-300">
             <ReactMarkdown>{finalDraft?.content || ''}</ReactMarkdown>
          </div>
          
          <div className="mt-16 pt-8 border-t border-slate-800 flex justify-center text-slate-500 text-sm italic">
            — 由 AI 小说创作工坊生成 —
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default FinalNovelPage;
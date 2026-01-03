import React, { useState } from 'react';
import NovelSetup from '@/components/NovelSetup';
import { BookOpen, Settings } from 'lucide-react';
import AgentConfigDashboard from '@/components/AgentConfigDashboard';

const HomePage: React.FC = () => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
      <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" />
      
      {/* Config Button */}
      <button 
        onClick={() => setIsConfigOpen(true)}
        className="absolute top-6 right-6 z-50 p-2 text-slate-400 hover:text-blue-400 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50"
        title="智能体参数配置"
      >
        <Settings className="w-6 h-6" />
      </button>

      <AgentConfigDashboard isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
      
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 rounded-full mb-6 ring-1 ring-emerald-500/30">
            <BookOpen className="w-16 h-16 text-emerald-400" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent mb-4 tracking-tight">
            AI 小说创作工坊
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            专家团并行评审，多轮迭代优化，打造逻辑严密、剧情精彩的小说。
          </p>
        </div>

        <NovelSetup />
      </div>
    </div>
  );
};

export default HomePage;

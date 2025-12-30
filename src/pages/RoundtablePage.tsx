import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDiscussionStore } from '@/store/useDiscussionStore';
import ExpertsCircle from '@/components/ExpertsCircle';
import ControlPanel from '@/components/ControlPanel';
import { ArrowLeft } from 'lucide-react';

const RoundtablePage: React.FC = () => {
  const navigate = useNavigate();
  const { session, currentSpeakerId } = useDiscussionStore();

  useEffect(() => {
    if (!session) {
      navigate('/');
    } else if (session.status === 'completed') {
      navigate('/conclusion');
    }
  }, [session, navigate]);

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
              {session.topic}
            </h1>
            <div className="text-xs text-slate-500">
              {session.experts.length} 位专家 • {session.maxRounds} 轮讨论
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
         {/* Background Grid */}
        <div className="absolute inset-0 bg-[url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E&quot;)] opacity-20 pointer-events-none" />
        
        <div className="flex-1 w-full flex items-center justify-center relative">
          <ExpertsCircle 
            experts={session.experts} 
            currentSpeakerId={currentSpeakerId || undefined} 
            messages={session.messages}
          />
        </div>
        
        <div className="w-full max-w-4xl px-4 pb-8 z-10">
          <ControlPanel />
        </div>
      </main>
    </div>
  );
};

export default RoundtablePage;

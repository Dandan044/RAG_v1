import React from 'react';
import { Play, Pause, Square, FastForward } from 'lucide-react';
import { useDiscussionStore } from '@/store/useDiscussionStore';

const ControlPanel: React.FC = () => {
  const { 
    session, 
    startDiscussion, 
    pauseDiscussion, 
    resumeDiscussion, 
    stopDiscussion, 
    speed, 
    setSpeed 
  } = useDiscussionStore();

  if (!session) return null;

  const isActive = session.status === 'active';
  const isPaused = session.status === 'paused';
  const isPending = session.status === 'pending';
  const isCompleted = session.status === 'completed';

  return (
    <div className="flex items-center gap-6 p-4 bg-slate-800/80 backdrop-blur-md rounded-xl border border-slate-700 shadow-lg">
      <div className="flex items-center gap-2">
        {isPending && (
          <button
            onClick={startDiscussion}
            className="p-3 bg-green-600 hover:bg-green-500 rounded-full text-white transition-colors"
            title="开始讨论"
          >
            <Play className="w-5 h-5 fill-current" />
          </button>
        )}

        {isActive && (
          <button
            onClick={pauseDiscussion}
            className="p-3 bg-amber-600 hover:bg-amber-500 rounded-full text-white transition-colors"
            title="暂停讨论"
          >
            <Pause className="w-5 h-5 fill-current" />
          </button>
        )}

        {isPaused && (
          <button
            onClick={resumeDiscussion}
            className="p-3 bg-green-600 hover:bg-green-500 rounded-full text-white transition-colors"
            title="继续讨论"
          >
            <Play className="w-5 h-5 fill-current" />
          </button>
        )}

        {!isCompleted && !isPending && (
          <button
            onClick={stopDiscussion}
            className="p-3 bg-slate-700 hover:bg-red-600 rounded-full text-slate-200 hover:text-white transition-colors"
            title="结束讨论"
          >
            <Square className="w-5 h-5 fill-current" />
          </button>
        )}
      </div>

      <div className="h-8 w-px bg-slate-700" />

      <div className="flex items-center gap-4 flex-1">
        <FastForward className="w-5 h-5 text-slate-400" />
        <div className="flex-1 flex flex-col gap-1 w-32">
          <label className="text-xs text-slate-400 font-medium">讨论速度</label>
          <input
            type="range"
            min="1000"
            max="10000"
            step="500"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            style={{ direction: 'rtl' }} // Higher value = Slower, so flip direction visually? No, wait. 
            // Value is delay in ms. Higher delay = Slower speed.
            // Slider left (min) should be slow? Or fast?
            // Usually right is faster.
            // If right is faster, delay should be smaller.
            // So min=1000 (fast), max=10000 (slow).
            // But slider usually goes Low -> High.
            // Let's invert it for UX.
          />
        </div>
      </div>
      
      <div className="px-3 py-1 bg-slate-900 rounded text-xs text-slate-400 font-mono border border-slate-700">
        第 {session.currentRound}/{session.maxRounds} 轮
      </div>
    </div>
  );
};

export default ControlPanel;

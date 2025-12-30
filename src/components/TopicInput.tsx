import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDiscussionStore } from '@/store/useDiscussionStore';
import { Users, RefreshCw, Play, Brain } from 'lucide-react';
import LoadingOverlay from './LoadingOverlay';

const TopicInput: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [expertCount, setExpertCount] = useState(5);
  const [maxRounds, setMaxRounds] = useState(5);
  const [enableThinking, setEnableThinking] = useState(true);
  const navigate = useNavigate();
  const { initSession, isLoading, error } = useDiscussionStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    await initSession(topic, {
      topic,
      expertCount,
      maxRounds,
      enableThinking,
      discussionGoal: 'exploration'
    });
    
    navigate('/roundtable');
  };

  return (
    <>
      <LoadingOverlay isLoading={isLoading} topic={topic} />
      
      <div className="w-full max-w-2xl mx-auto p-8 bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
        <h2 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          开启圆桌讨论
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="topic" className="block text-sm font-medium text-slate-300 mb-2">
              讨论话题
            </label>
            <textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full h-32 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-100 placeholder-slate-500 resize-none transition-all"
              placeholder="例如：通用人工智能的未来及其对社会的影响..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  专家数量: {expertCount}
                </div>
              </label>
              <input
                type="range"
                min="3"
                max="8"
                value={expertCount}
                onChange={(e) => setExpertCount(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>3</span>
                <span>8</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  讨论轮次: {maxRounds}
                </div>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={maxRounds}
                onChange={(e) => setMaxRounds(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1</span>
                <span>10</span>
              </div>
            </div>
          </div>

          {/* Thinking Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-slate-200">深度思考模式 (DeepSeek R1)</div>
                <div className="text-xs text-slate-500">开启后模型将进行思维链推理，回答更深入但速度较慢</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={enableThinking}
                onChange={(e) => setEnableThinking(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {error && (
            <div className="p-4 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !topic.trim()}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
              isLoading || !topic.trim()
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg hover:shadow-blue-500/25'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                生成专家团...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                开始讨论
              </>
            )}
          </button>
        </form>
      </div>
    </>
  );
};

export default TopicInput;

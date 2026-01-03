import React, { useState, useEffect } from 'react';
import { X, Database, Activity, RefreshCw, Layers, Sparkles, LayoutTemplate, Terminal } from 'lucide-react';
import { memoryStore, MemorySegment } from '@/lib/vectorStore';
import { useDiscussionStore } from '@/store/useDiscussionStore';
import { useDebugStore } from '@/store/debugStore';
import { estimateTokens, MAX_CONTEXT_TOKENS } from '@/utils/tokenManager';

interface DebugDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const DebugDashboard: React.FC<DebugDashboardProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'memory' | 'tokens' | 'summaries' | 'worldview' | 'outlines' | 'logs'>('memory');
  const [segments, setSegments] = useState<MemorySegment[]>([]);
  const [summaries, setSummaries] = useState<{round: number, content: string}[]>([]);
  const { novelSession } = useDiscussionStore();
  const { logs } = useDebugStore();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const selectedLog = logs.find(l => l.id === selectedLogId);
  
  // Force refresh segments when opening
  useEffect(() => {
    if (isOpen) {
      setSegments(memoryStore.getAllSegments());
      setSummaries(novelSession?.summaries || []);
    }
  }, [isOpen, activeTab, novelSession]);

  if (!isOpen) return null;

  // Token Calculations
  const historyText = novelSession?.compiledStory || '';
  const currentTokens = estimateTokens(historyText);
  const usagePercentage = Math.min(100, (currentTokens / MAX_CONTEXT_TOKENS) * 100);
  
  // Thresholds
  const WARNING_THRESHOLD = 0.7; // 70%
  const CRITICAL_THRESHOLD = 0.8; // 80% (Summarization trigger)

  const getTokenStatus = () => {
    if (usagePercentage > CRITICAL_THRESHOLD * 100) return { label: '触发摘要', color: 'text-red-400', bg: 'bg-red-500' };
    if (usagePercentage > WARNING_THRESHOLD * 100) return { label: '接近上限', color: 'text-yellow-400', bg: 'bg-yellow-500' };
    return { label: '健康', color: 'text-emerald-400', bg: 'bg-emerald-500' };
  };

  const status = getTokenStatus();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[800px] h-[600px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            系统内部状态监控
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('memory')}
            className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'memory' 
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Database className="w-4 h-4" />
            向量记忆库 ({segments.length})
          </button>
          <button
            onClick={() => setActiveTab('tokens')}
            className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'tokens' 
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            Token 与上下文
          </button>
          <button
            onClick={() => setActiveTab('summaries')}
            className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'summaries' 
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/5' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            摘要历史
          </button>
          <button
            onClick={() => setActiveTab('worldview')}
            className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'worldview' 
                ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-500/5' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            世界观
          </button>
          <button
            onClick={() => setActiveTab('outlines')}
            className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'outlines' 
                ? 'text-pink-400 border-b-2 border-pink-400 bg-pink-500/5' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <LayoutTemplate className="w-4 h-4" />
            大纲 ({novelSession?.outlines.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'logs' 
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Prompt 日志
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6 bg-slate-950/50">
          
          {activeTab === 'memory' && (
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div className="text-xs text-slate-500">
                  此处显示已定稿并向量化的故事片段，供专家检索使用。
                </div>
                <button 
                  onClick={() => setSegments(memoryStore.getAllSegments())}
                  className="text-xs flex items-center gap-1 text-slate-400 hover:text-white"
                >
                  <RefreshCw className="w-3 h-3" /> 刷新
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {segments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600">
                    <Database className="w-12 h-12 mb-2 opacity-20" />
                    <p>暂无向量记忆数据</p>
                    <p className="text-xs mt-1">定稿完成后会自动切片存入</p>
                  </div>
                ) : (
                  segments.map((seg) => (
                    <div key={seg.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-mono text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded border border-blue-900/30">
                          ID: {seg.id.slice(0, 8)}...
                        </span>
                        <span className="text-[10px] text-slate-500">
                          第 {seg.metadata.round} 轮 • {new Date(seg.metadata.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm text-slate-300 line-clamp-3 group-hover:line-clamp-none transition-all">
                        {seg.text}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'tokens' && (
            <div className="h-full space-y-8">
              {/* Status Card */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-1">当前上下文估算</div>
                    <div className="text-3xl font-bold text-slate-100 font-mono">
                      {currentTokens.toLocaleString()} <span className="text-lg text-slate-500 font-normal">/ {MAX_CONTEXT_TOKENS.toLocaleString()} tokens</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold border ${status.color} bg-opacity-10 border-opacity-20`}>
                    状态: {status.label}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`absolute top-0 left-0 h-full transition-all duration-500 ease-out ${status.bg}`}
                    style={{ width: `${usagePercentage}%` }}
                  />
                  {/* Warning Marker */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-yellow-500/50" style={{ left: '70%' }} title="警告阈值 (70%)" />
                  {/* Critical Marker */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/50" style={{ left: '80%' }} title="触发摘要 (80%)" />
                </div>
                <div className="flex justify-between text-xs text-slate-500 font-mono">
                  <span>0%</span>
                  <span>摘要触发线 (80%)</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  构成明细 (估算)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div className="text-xs text-slate-500 mb-1">历史正文 (Compiled Story)</div>
                    <div className="text-lg font-mono text-slate-200">
                      {estimateTokens(novelSession?.compiledStory || '').toLocaleString()} <span className="text-xs text-slate-600">tokens</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div className="text-xs text-slate-500 mb-1">系统预设 & 当前草稿</div>
                    <div className="text-lg font-mono text-slate-200">
                      ~{(currentTokens - estimateTokens(novelSession?.compiledStory || '')).toLocaleString()} <span className="text-xs text-slate-600">tokens</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-900/10 border border-blue-900/30 text-xs text-blue-300">
                <strong>说明：</strong> 当上下文使用量超过 80% ({Math.floor(MAX_CONTEXT_TOKENS * 0.8).toLocaleString()} tokens) 时，系统将自动触发“摘要模型”，将历史正文压缩为简短的“前情提要”，以释放上下文空间。
              </div>
            </div>
          )}

          {activeTab === 'summaries' && (
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div className="text-xs text-slate-500">
                  此处显示系统自动生成的历史摘要（包括上下文压缩摘要和编辑修改指南）。
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {summaries.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600">
                    <RefreshCw className="w-12 h-12 mb-2 opacity-20" />
                    <p>暂无摘要记录</p>
                    <p className="text-xs mt-1">当进行修订或触发长文压缩时会产生记录</p>
                  </div>
                ) : (
                  summaries.map((summary, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-mono text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded border border-purple-900/30">
                          第 {summary.round} 轮
                        </span>
                        <span className="text-[10px] text-slate-500">
                           编辑指南 / 上下文摘要
                        </span>
                      </div>
                      <div className="text-sm text-slate-300 whitespace-pre-wrap font-serif leading-relaxed">
                        {summary.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'worldview' && (
            <div className="h-full flex flex-col p-2">
                <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                    世界观设定
                </h4>
                <div className="flex-1 overflow-y-auto bg-slate-900/50 p-6 rounded-xl border border-slate-800 prose prose-invert max-w-none">
                    <div className="whitespace-pre-wrap font-serif text-slate-300 leading-relaxed">
                        {novelSession?.worldview || "暂无世界观设定"}
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'outlines' && (
            <div className="h-full flex flex-col space-y-4">
                 <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <LayoutTemplate className="w-4 h-4 text-pink-400" />
                    剧情大纲历史
                </h4>
                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                    {(!novelSession?.outlines || novelSession.outlines.length === 0) ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600">
                            <LayoutTemplate className="w-12 h-12 mb-2 opacity-20" />
                            <p>暂无大纲记录</p>
                            <p className="text-xs mt-1">每 5 轮会自动生成一次阶段性大纲</p>
                        </div>
                    ) : (
                        novelSession.outlines.map((outline, idx) => (
                            <div key={idx} className="p-6 rounded-xl bg-slate-900 border border-slate-800">
                                <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                                    <span className="text-sm font-bold text-pink-400 bg-pink-900/20 px-3 py-1 rounded-full border border-pink-900/30">
                                        {outline.range}
                                    </span>
                                </div>
                                <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                                    <div className="whitespace-pre-wrap">{outline.content}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="h-full flex gap-4">
                {/* Agent List (Sidebar) */}
                <div className="w-1/4 flex flex-col border-r border-slate-800 pr-2">
                    <div className="flex justify-between items-center mb-2 px-2">
                        <h4 className="text-sm font-medium text-slate-300">智能体列表</h4>
                        <button onClick={() => useDebugStore.getState().clearLogs()} className="text-xs text-red-400 hover:text-red-300">清空</button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                        {(() => {
                            // Group logs by Agent
                            const logsByAgent = logs.reduce((acc, log) => {
                                if (!acc[log.agentName]) {
                                    acc[log.agentName] = { type: log.type, count: 0, latest: 0 };
                                }
                                acc[log.agentName].count++;
                                acc[log.agentName].latest = Math.max(acc[log.agentName].latest, log.timestamp);
                                return acc;
                            }, {} as Record<string, { type: string, count: number, latest: number }>);

                            const typePriority: Record<string, number> = { system: 0, writer: 1, expert: 2, moderator: 3, outline: 4, summary: 5 };
                            
                            return Object.keys(logsByAgent).sort((a, b) => {
                                const typeA = logsByAgent[a].type;
                                const typeB = logsByAgent[b].type;
                                if (typePriority[typeA] !== typePriority[typeB]) return (typePriority[typeA] || 99) - (typePriority[typeB] || 99);
                                return b.localeCompare(a); // Sort by name
                            }).map(agentName => {
                                const info = logsByAgent[agentName];
                                const isSelected = selectedLog?.agentName === agentName;
                                
                                return (
                                    <button
                                        key={agentName}
                                        onClick={() => {
                                            // Select the latest log for this agent
                                            const agentLogs = logs.filter(l => l.agentName === agentName).sort((a, b) => b.timestamp - a.timestamp);
                                            if (agentLogs.length > 0) setSelectedLogId(agentLogs[0].id);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center justify-between ${
                                            isSelected
                                                ? 'bg-slate-800 border-slate-600'
                                                : 'bg-transparent border-transparent hover:bg-slate-800/50'
                                        }`}
                                    >
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-xs font-medium text-slate-200 truncate">{agentName}</span>
                                            <span className={`text-[10px] uppercase font-bold mt-0.5 ${
                                                info.type === 'writer' ? 'text-emerald-400' :
                                                info.type === 'expert' ? 'text-blue-400' :
                                                info.type === 'system' ? 'text-slate-500' :
                                                'text-purple-400'
                                            }`}>
                                                {info.type}
                                            </span>
                                        </div>
                                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-400 border border-slate-700">
                                            {info.count}
                                        </span>
                                    </button>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* Task List (Middle) */}
                <div className="w-1/4 flex flex-col border-r border-slate-800 pr-2">
                     <h4 className="text-sm font-medium text-slate-300 mb-2 px-2">任务历史</h4>
                     <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                        {selectedLog ? (
                            logs
                                .filter(l => l.agentName === selectedLog.agentName)
                                .sort((a, b) => b.timestamp - a.timestamp)
                                .map(log => (
                                    <button
                                        key={log.id}
                                        onClick={() => setSelectedLogId(log.id)}
                                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                            selectedLogId === log.id 
                                                ? 'bg-cyan-900/20 border-cyan-500/50' 
                                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="text-[10px] text-slate-500 mb-1">{new Date(log.timestamp).toLocaleTimeString()}</div>
                                        <div className="text-xs text-slate-300 font-medium truncate" title={log.request.userPrompt}>
                                            {log.request.userPrompt.slice(0, 50)}...
                                        </div>
                                    </button>
                                ))
                        ) : (
                            <div className="text-center text-xs text-slate-600 mt-10">请先选择智能体</div>
                        )}
                     </div>
                </div>
                
                {/* Log Detail (Right) */}
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900/30 rounded-xl border border-slate-800">
                    {selectedLog ? (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-200">{selectedLog.agentName}</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">ID: {selectedLog.id} • {new Date(selectedLog.timestamp).toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                                {/* System Prompt */}
                                <div>
                                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">System Prompt</h5>
                                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
                                        {selectedLog.request.systemPrompt}
                                    </div>
                                </div>

                                {/* User Prompt */}
                                <div>
                                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">User Prompt</h5>
                                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap">
                                        {selectedLog.request.userPrompt}
                                    </div>
                                </div>

                                {/* Thinking */}
                                {selectedLog.response.thinking && (
                                    <div>
                                        <h5 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">Thinking Process</h5>
                                        <div className="bg-blue-950/20 p-4 rounded-lg border border-blue-900/30 text-xs font-mono text-blue-200 whitespace-pre-wrap">
                                            {selectedLog.response.thinking}
                                        </div>
                                    </div>
                                )}

                                {/* Response */}
                                <div>
                                    <h5 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Final Response</h5>
                                    <div className="bg-emerald-950/10 p-4 rounded-lg border border-emerald-900/30 text-xs font-mono text-emerald-100 whitespace-pre-wrap">
                                        {selectedLog.response.content}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600">
                            <Terminal className="w-12 h-12 mb-2 opacity-20" />
                            <p>请选择一条日志查看详情</p>
                        </div>
                    )}
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default DebugDashboard;

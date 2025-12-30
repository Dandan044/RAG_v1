import React, { useState } from 'react';
import { X, Settings, RotateCcw, Save, Activity, CheckCircle, AlertCircle } from 'lucide-react';
import { useAgentConfigStore, AgentType, DEFAULT_CONFIGS } from '@/store/agentConfigStore';
import { deepseekClient } from '@/lib/axios';
import { getEmbeddings } from '@/lib/embedding';

interface AgentConfigDashboardProps {
    isOpen: boolean;
    onClose: () => void;
}

const AGENT_LABELS: Record<AgentType, string> = {
    expert_generator: '专家生成系统 (System)',
    expert_responder: '专家发言 (Expert)',
    conclusion_generator: '总结主持人 (Moderator)',
    expert_suggestion: '专家推荐系统 (System)',
    story_summarizer: '故事摘要师 (System)',
    novel_writer: '小说作家 (Writer)',
    expert_critique: '专家评审 (Expert)',
    critique_summarizer: '评审总结 (Moderator)',
    novel_rewriter: '小说修订 (Writer)',
    outline_contributor: '大纲贡献 (Expert)',
    outline_summarizer: '大纲总结 (Moderator)',
    worldview_architect: '世界观架构师 (System)',
    character_recorder: '人物记录者 (Recorder)',
    task_recorder: '任务记录者 (Recorder)'
};

const AgentConfigDashboard: React.FC<AgentConfigDashboardProps> = ({ isOpen, onClose }) => {
    const { configs, updateConfig, resetConfig } = useAgentConfigStore();
    const [selectedAgent, setSelectedAgent] = useState<AgentType>('expert_generator');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testResult, setTestResult] = useState<string>('');

    if (!isOpen) return null;

    const currentConfig = configs[selectedAgent];

    const handleReset = () => {
        if (confirm('确定要恢复该智能体的默认设置吗？')) {
            resetConfig(selectedAgent);
        }
    };

    const runSystemTest = async () => {
        setTestStatus('testing');
        setTestResult('正在测试所有 API 服务...');
        let logs: string[] = [];

        try {
            // 1. Test DeepSeek LLM
            logs.push('⏳ 正在测试 LLM API (DeepSeek)...');
            setTestResult(logs.join('\n'));
            
            const llmStart = Date.now();
            await deepseekClient.post('/chat/completions', {
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: 'Ping' }],
                max_tokens: 5
            });
            logs.push(`✅ LLM API 连接成功 (${Date.now() - llmStart}ms)`);
            setTestResult(logs.join('\n'));

            // 2. Test Embedding Service
            logs.push('⏳ 正在测试 Embedding API (Internal)...');
            setTestResult(logs.join('\n'));
            
            const embStart = Date.now();
            await getEmbeddings(['test']);
            logs.push(`✅ Embedding API 连接成功 (${Date.now() - embStart}ms)`);
            setTestResult(logs.join('\n'));

            setTestStatus('success');
            logs.push('🎉 所有服务运行正常');
            setTestResult(logs.join('\n'));

        } catch (error: any) {
            console.error('System test failed:', error);
            setTestStatus('error');
            logs.push(`❌ 测试失败: ${error.message || '未知错误'}`);
            if (error.response) {
                 logs.push(`   Status: ${error.response.status}`);
                 logs.push(`   Data: ${JSON.stringify(error.response.data)}`);
            }
            setTestResult(logs.join('\n'));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-blue-400" />
                        智能体参数配置中心
                    </h3>
                    <div className="flex items-center gap-3">
                        {/* Test Button */}
                        <button 
                            onClick={runSystemTest}
                            disabled={testStatus === 'testing'}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors border ${
                                testStatus === 'testing' ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-wait' :
                                testStatus === 'success' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/50 hover:bg-emerald-900/50' :
                                testStatus === 'error' ? 'bg-red-900/30 text-red-400 border-red-500/50 hover:bg-red-900/50' :
                                'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white'
                            }`}
                        >
                            {testStatus === 'testing' ? <Activity className="w-3 h-3 animate-spin" /> : 
                             testStatus === 'success' ? <CheckCircle className="w-3 h-3" /> : 
                             testStatus === 'error' ? <AlertCircle className="w-3 h-3" /> : 
                             <Activity className="w-3 h-3" />}
                            {testStatus === 'testing' ? '测试中...' : '系统自检'}
                        </button>

                        <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar: Agent List */}
                    <div className="w-64 border-r border-slate-800 bg-slate-950/30 flex flex-col">
                        <div className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            选择智能体
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {(Object.keys(AGENT_LABELS) as AgentType[]).map((agent) => (
                                <button
                                    key={agent}
                                    onClick={() => setSelectedAgent(agent)}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                        selectedAgent === agent
                                            ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                                    }`}
                                >
                                    {AGENT_LABELS[agent]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900/50 relative">
                        
                        {/* Test Result Overlay */}
                        {testStatus !== 'idle' && (
                            <div className="absolute top-4 right-4 z-10 w-80 bg-slate-950 border border-slate-700 rounded-lg shadow-xl p-4 text-xs font-mono animate-in slide-in-from-top-2">
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800">
                                    <span className="font-bold text-slate-400">系统诊断报告</span>
                                    <button onClick={() => setTestStatus('idle')} className="text-slate-500 hover:text-slate-300">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                                <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed">
                                    {testResult}
                                </pre>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            
                            {/* Model & Temp Row */}
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">模型 (Model)</label>
                                    <input
                                        type="text"
                                        value={currentConfig.model}
                                        onChange={(e) => updateConfig(selectedAgent, { model: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                        placeholder="e.g. deepseek-chat"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                                        <span>温度 (Temperature)</span>
                                        <span className="text-blue-400">{currentConfig.temperature}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1.5"
                                        step="0.1"
                                        value={currentConfig.temperature}
                                        onChange={(e) => updateConfig(selectedAgent, { temperature: parseFloat(e.target.value) })}
                                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                                        <span>精确 (0.0)</span>
                                        <span>均衡 (0.7)</span>
                                        <span>创意 (1.5)</span>
                                    </div>
                                </div>
                            </div>

                            {/* System Prompt */}
                            <div className="flex-1 flex flex-col min-h-[300px]">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between items-center">
                                    <span>系统提示词模板 (System Prompt Template)</span>
                                    <span className="text-[10px] normal-case text-slate-600">支持 {'{{variable}}'} 变量插值</span>
                                </label>
                                <div className="relative flex-1">
                                    <textarea
                                        value={currentConfig.systemPrompt}
                                        onChange={(e) => updateConfig(selectedAgent, { systemPrompt: e.target.value })}
                                        className="w-full h-full min-h-[400px] bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-300 font-mono text-xs leading-relaxed focus:outline-none focus:border-blue-500 transition-colors resize-none"
                                        spellCheck={false}
                                    />
                                </div>
                            </div>

                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-between items-center">
                            <div className="text-xs text-slate-500">
                                修改将自动保存并立即生效
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleReset}
                                    className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2 text-sm"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    恢复默认
                                </button>
                                {/* "Save" is visual only since state updates automatically, but good for UX */}
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2 text-sm font-medium"
                                >
                                    <Save className="w-4 h-4" />
                                    完成配置
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentConfigDashboard;

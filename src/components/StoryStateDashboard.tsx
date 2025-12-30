import React, { useState } from 'react';
import { Users, ClipboardList, MapPin, Activity, Tag, CheckCircle2, Circle, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { useDiscussionStore } from '@/store/useDiscussionStore';
import { CharacterProfile, StoryTask } from '@/types';

interface StoryStateDashboardProps {
    isOpen: boolean;
    onClose: () => void;
}

const StoryStateDashboard: React.FC<StoryStateDashboardProps> = ({ isOpen, onClose }) => {
    const { novelSession } = useDiscussionStore();
    const [activeTab, setActiveTab] = useState<'characters' | 'tasks'>('characters');

    if (!isOpen || !novelSession) return null;

    const { characters, tasks } = novelSession;

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-[450px] bg-slate-900 border-l border-slate-700 shadow-2xl transform transition-transform duration-300 flex flex-col">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    <h2 className="text-lg font-bold text-slate-200">故事状态监控</h2>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900/50">
                <button
                    onClick={() => setActiveTab('characters')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        activeTab === 'characters' 
                        ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/5' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    人物档案 ({characters?.length || 0})
                </button>
                <button
                    onClick={() => setActiveTab('tasks')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        activeTab === 'tasks' 
                        ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                    <ClipboardList className="w-4 h-4" />
                    任务清单 ({tasks?.length || 0})
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-900/50">
                
                {activeTab === 'characters' && (
                    <div className="space-y-4">
                        {(!characters || characters.length === 0) ? (
                            <div className="text-center py-10 text-slate-500 text-sm">
                                暂无人物记录，请等待第一次定稿完成。
                            </div>
                        ) : (
                            characters.map((char) => (
                                <CharacterCard key={char.id} character={char} />
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div className="space-y-4">
                        {(!tasks || tasks.length === 0) ? (
                            <div className="text-center py-10 text-slate-500 text-sm">
                                暂无任务记录，请等待第一次定稿完成。
                            </div>
                        ) : (
                            tasks.map((task) => (
                                <TaskCard key={task.id} task={task} />
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const CharacterCard: React.FC<{ character: CharacterProfile }> = ({ character }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden transition-all hover:border-slate-600">
            <div 
                className="p-3 flex items-start justify-between cursor-pointer hover:bg-slate-800/80"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-lg border border-purple-500/30">
                        {character.name[0]}
                    </div>
                    <div>
                        <h3 className="text-slate-200 font-bold text-sm">{character.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1">
                                <Activity className="w-3 h-3 text-slate-500" />
                                {character.status}
                            </span>
                        </div>
                    </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </div>

            {isExpanded && (
                <div className="p-3 pt-0 text-sm border-t border-slate-700/30 mt-2 bg-slate-950/20">
                    <div className="space-y-3 mt-3">
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase">简介</span>
                            <p className="text-slate-300 mt-1 leading-relaxed">{character.description}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> 位置
                                </span>
                                <p className="text-slate-300 mt-1 truncate" title={character.location}>{character.location}</p>
                            </div>
                            <div>
                                <span className="text-xs font-bold text-slate-500 uppercase">最后更新</span>
                                <p className="text-slate-300 mt-1">第 {character.lastUpdatedRound} 轮</p>
                            </div>
                        </div>

                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase">人际关系</span>
                            <p className="text-slate-400 mt-1 text-xs italic">{character.relationships}</p>
                        </div>

                        {character.tags && character.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                                {character.tags.map((tag, idx) => (
                                    <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 text-[10px] border border-slate-600">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const TaskCard: React.FC<{ task: StoryTask }> = ({ task }) => {
    const isCompleted = task.status === 'completed';
    const isFailed = task.status === 'failed';
    
    return (
        <div className={`p-3 rounded-lg border ${
            isCompleted ? 'bg-emerald-900/10 border-emerald-500/30' : 
            isFailed ? 'bg-red-900/10 border-red-500/30' : 
            'bg-slate-800/50 border-slate-700/50'
        }`}>
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${
                    isCompleted ? 'text-emerald-500' : 
                    isFailed ? 'text-red-500' : 
                    'text-blue-500'
                }`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : 
                     isFailed ? <AlertCircle className="w-5 h-5" /> : 
                     <Circle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className={`text-sm font-bold truncate pr-2 ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                            {task.title}
                        </h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                            task.type === 'main' 
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                            : 'bg-slate-700/30 text-slate-400 border-slate-600/30'
                        }`}>
                            {task.type === 'main' ? '主线' : '支线'}
                        </span>
                    </div>
                    
                    <p className="text-xs text-slate-400 mb-2 leading-relaxed">
                        {task.description}
                    </p>

                    <div className="bg-slate-950/30 rounded p-2 text-xs">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-slate-500 font-bold">当前进度</span>
                            <span className="text-slate-600">更新于 R{task.lastUpdatedRound}</span>
                        </div>
                        <p className="text-slate-300">{task.progress}</p>
                    </div>

                    {task.rewards && (
                         <div className="mt-2 text-xs text-amber-500/80 flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            <span>奖励: {task.rewards}</span>
                         </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StoryStateDashboard;

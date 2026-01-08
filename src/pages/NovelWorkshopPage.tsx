import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDiscussionStore } from '@/store/useDiscussionStore';
import { ArrowLeft, Edit3, MessageSquare, FileText, CheckCircle, RefreshCw, Brain, Activity, LayoutTemplate, ChevronLeft, ChevronRight, Users, User, Backpack } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ExpertCard from '@/components/ExpertCard';
import DebugDashboard from '@/components/DebugDashboard';
import { StoryStateDashboard } from '@/components/StoryStateDashboard';
import BodyStatusView from '@/components/BodyStatusView';

const NovelWorkshopPage: React.FC = () => {
  const navigate = useNavigate();
  const { novelSession, startNovelWorkflow, stopNovel, isGenerating, currentSpeakerId, submitOption } = useDiscussionStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDraftsCollapsed, setIsDraftsCollapsed] = useState(true);
  const [activePanel, setActivePanel] = useState<'none' | 'experts' | 'body'>('none');
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [customOption, setCustomOption] = useState('');

  // Timer Logic for Selection Phase
  useEffect(() => {
    // Only run if status is selecting_option AND we haven't already made a choice locally (though submitOption handles state)
    if (novelSession?.status === 'selecting_option') {
        setTimeLeft(60);
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Random selection if time runs out
                    // IMPORTANT: Check status again inside callback to prevent race conditions if user clicked at last second
                    // Accessing latest state via store would be safer, but here we rely on effect cleanup.
                    // If component unmounts or status changes, cleanup runs.
                    // However, `submitOption` is async.
                    
                    const options = novelSession.currentOptions || [];
                    if (options.length > 0) {
                        const randomChoice = options[Math.floor(Math.random() * options.length)];
                        submitOption(randomChoice);
                    } else {
                         submitOption("继续观察"); // Fallback
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    } else {
        setCustomOption(''); // Reset input
    }
  }, [novelSession?.status, novelSession?.currentOptions, submitOption]);

  useEffect(() => {
    if (!novelSession) {
      navigate('/');
      return;
    }
    if (novelSession.status === 'setup') {
      startNovelWorkflow();
    }
    // Removed auto-navigation to final-novel
  }, [novelSession, navigate, startNovelWorkflow]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [novelSession?.drafts, novelSession?.critiques, novelSession?.outlineDiscussions]);

  if (!novelSession) return null;

  const currentDraft = novelSession.drafts[novelSession.drafts.length - 1];
  const currentCritiques = novelSession.critiques.filter(c => c.round === novelSession.currentRound);
  const currentSummary = novelSession.summaries.find(s => s.round === novelSession.currentRound);

  // Helper to determine what to show in the "Final Story" view
  // If revising, we append the streaming revision draft to the compiled story for a seamless effect.
  const isRevising = novelSession.status === 'revising';
  // IMPORTANT: If status is 'selecting_option', it means revision is DONE and merged into compiledStory.
  // We should NOT show streamingContent in that case to avoid duplication.
  const showStreaming = isRevising && currentDraft && currentDraft.round === novelSession.currentRound;
  const streamingContent = showStreaming ? currentDraft.content : '';
  const displayedStory = novelSession.compiledStory + (streamingContent ? '\n\n' + streamingContent : '');

  // Prepare data for ExpertsCircle
  const allParticipants = novelSession.moderator 
    ? [...novelSession.experts, novelSession.moderator]
    : novelSession.experts;

  const protagonist = novelSession.characters.find(c => c.isProtagonist);

  const activeExpertIds = novelSession.status === 'critiquing' 
    ? novelSession.experts.map(e => e.id) 
    : novelSession.status === 'summarizing' && novelSession.moderator
      ? [novelSession.moderator.id]
      : novelSession.status === 'outline_discussion' && currentSpeakerId
        ? [currentSpeakerId]
        : [];

  const expertContentMap = currentCritiques.reduce((acc, c) => ({
    ...acc,
    [c.expertId]: { content: c.content, thinking: c.thinking }
  }), {} as Record<string, { content: string; thinking?: string }>);

  // If summarizing, map moderator content
  if (novelSession.status === 'summarizing' && novelSession.moderator && currentSummary) {
      expertContentMap[novelSession.moderator.id] = { content: currentSummary.content };
  }

  // If outline discussion, map expert contributions
  if (novelSession.status === 'outline_discussion') {
      const currentRoundDiscussions = novelSession.outlineDiscussions.filter(d => d.round === novelSession.currentRound);
      
      currentRoundDiscussions.forEach(msg => {
          const existing = expertContentMap[msg.expertId];
          expertContentMap[msg.expertId] = {
              content: existing ? existing.content + '\n\n' + msg.content : msg.content,
              thinking: msg.thinking // Use latest thinking or accumulate? Usually latest is fine for "current thought process"
          };
      });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              小说创作工坊
            </h1>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                第 {novelSession.currentRound} / {novelSession.maxRounds} 轮
              </span>
              <span>•</span>
              <span className="uppercase tracking-wider font-medium text-emerald-500">
                {novelSession.status === 'outline_discussion' && '正在研讨剧情大纲...'}
                {novelSession.status === 'drafting' && '正在创作初稿...'}
                {novelSession.status === 'critiquing' && '专家评审中...'}
                {novelSession.status === 'summarizing' && '主持人总结中...'}
                {novelSession.status === 'revising' && '正在修订稿件...'}
                {novelSession.status === 'completed' && '创作完成'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
             <button
                onClick={() => setIsDebugOpen(true)}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                title="系统状态监控"
             >
                <Activity className="w-5 h-5" />
             </button>

             <button
                onClick={() => setIsStateOpen(true)}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                title="故事状态"
             >
                <Brain className="w-5 h-5" />
             </button>

             <button
                onClick={() => {
                    stopNovel();
                }}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/50 rounded-lg text-sm font-medium transition-colors"
             >
                结束创作
             </button>
        </div>
      </header>

      <DebugDashboard isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} />
      <StoryStateDashboard isOpen={isStateOpen} onClose={() => setIsStateOpen(false)} />

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Left Panel: Novel Content or Outline Discussion */}
        <div className="flex-1 flex flex-col border-r border-slate-800 bg-slate-900/50 relative">

          {/* 1. Final Story Section (Fixed Top) */}
          <div className="flex-1 flex flex-col min-h-0 border-b border-slate-800">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 sticky top-0 z-10">
              <h2 className="font-semibold text-slate-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  定稿 (已完成章节)
              </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-8 font-serif leading-relaxed text-lg text-slate-300 space-y-6 scroll-smooth">
              {displayedStory ? (
                  <div className="prose prose-invert max-w-none pb-20">
                      <ReactMarkdown 
                        components={{
                            blockquote: (props) => (
                                <blockquote className="border-l-4 border-emerald-500 pl-4 py-2 bg-emerald-900/20 rounded-r my-6 italic text-emerald-100" {...props} />
                            ),
                            hr: () => (
                                <div className="flex items-center justify-center my-8 gap-2 opacity-50">
                                    <div className="h-px bg-slate-700 w-12" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                    <div className="h-px bg-slate-700 w-12" />
                                </div>
                            )
                        }}
                      >
                        {displayedStory}
                      </ReactMarkdown>
                      {showStreaming && (
                         <span className="inline-block w-2 h-5 bg-emerald-500 ml-1 animate-pulse align-middle" />
                      )}
                  </div>
              ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 italic">
                      <span>暂无定稿内容，正在创作第一章...</span>
                  </div>
              )}
              
              {/* Inline Selection UI */}
              {novelSession.status === 'selecting_option' && (
                  <div className="mt-8 p-6 bg-slate-900/80 border border-slate-700 rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Activity className="w-5 h-5 text-emerald-400" />
                                做出你的选择
                            </h2>
                            <div className="text-slate-400 text-sm font-mono bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                                剩余时间: <span className={`${timeLeft <= 5 ? 'text-red-400' : 'text-emerald-400'} font-bold`}>{timeLeft}s</span>
                            </div>
                        </div>
                        
                        <div className="grid gap-3 mb-4">
                            {novelSession.currentOptions?.map((opt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => submitOption(opt)}
                                    className="p-4 bg-slate-800/50 hover:bg-emerald-600/20 border border-slate-700 hover:border-emerald-500 rounded-xl text-left transition-all group flex items-start gap-3"
                                >
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs group-hover:bg-emerald-500 group-hover:text-white mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <span className="text-slate-200 group-hover:text-white leading-relaxed">{opt}</span>
                                </button>
                            ))}
                        </div>

                        <div className="relative pt-2 border-t border-slate-800/50 mt-4">
                            <input 
                                type="text"
                                value={customOption}
                                onChange={(e) => setCustomOption(e.target.value)}
                                placeholder="或者... 输入你自己的想法"
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pr-20 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && customOption.trim()) {
                                        submitOption(customOption.trim());
                                    }
                                }}
                                autoFocus
                            />
                            <button
                                onClick={() => {
                                    if (customOption.trim()) submitOption(customOption.trim());
                                }}
                                disabled={!customOption.trim()}
                                className="absolute right-1.5 top-3.5 bottom-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                确认
                            </button>
                        </div>
                  </div>
              )}
              <div ref={scrollRef} />
              </div>
          </div>

          {/* 2. Drafts / Outline Discussion Section (Collapsible Bottom) */}
          <div className="flex-shrink-0 bg-slate-900/30 border-t border-slate-800 transition-all duration-300 ease-in-out flex flex-col"
              style={{ height: isDraftsCollapsed ? '48px' : '40%' }}>
              
              <button 
              onClick={() => setIsDraftsCollapsed(!isDraftsCollapsed)}
              className="w-full p-3 flex items-center justify-between bg-slate-900/80 hover:bg-slate-800 transition-colors border-b border-slate-800/50 cursor-pointer"
              >
              <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${
                      isDraftsCollapsed ? 'bg-slate-800' :
                      novelSession.status === 'outline_discussion' ? 'bg-pink-500/20 text-pink-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                  {novelSession.status === 'outline_discussion' ? (
                      <LayoutTemplate className="w-4 h-4" />
                  ) : (
                      <Edit3 className="w-4 h-4" />
                  )}
                  </div>
                  <div className="flex flex-col items-start">
                  <span className="text-sm font-medium text-slate-300">
                      {novelSession.status === 'outline_discussion' ? '剧情大纲研讨会' : '本轮初稿与迭代'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                      {novelSession.status === 'outline_discussion'
                          ? `第 ${novelSession.currentRound} - ${novelSession.currentRound + 4} 轮 • ${novelSession.outlineDiscussions.length} 条发言`
                          : `第 ${novelSession.currentRound} 轮 • ${novelSession.drafts.filter(d => d.round === novelSession.currentRound).length} 个版本`
                      }
                  </span>
                  </div>
              </div>
              
              <div className="flex items-center gap-3">
                  {isGenerating && (novelSession.status === 'drafting' || novelSession.status === 'revising' || novelSession.status === 'outline_discussion') && (
                  <div className={`flex items-center gap-2 text-xs animate-pulse mr-2 ${
                      novelSession.status === 'outline_discussion' ? 'text-pink-400' : 'text-emerald-400'
                  }`}>
                      <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          novelSession.status === 'outline_discussion' ? 'bg-pink-400' : 'bg-emerald-400'
                      }`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                          novelSession.status === 'outline_discussion' ? 'bg-pink-500' : 'bg-emerald-500'
                      }`}></span>
                      </span>
                      {novelSession.status === 'outline_discussion' ? '正在研讨...' : '正在撰写...'}
                  </div>
                  )}
                  <div className={`transition-transform duration-300 ${isDraftsCollapsed ? 'rotate-0' : 'rotate-180'}`}>
                      <ArrowLeft className="w-4 h-4 text-slate-500 rotate-90" />
                  </div>
              </div>
              </button>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30">
              {novelSession.status === 'outline_discussion' ? (
                  <div className="space-y-6">
                      {novelSession.outlineDiscussions.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-slate-500 italic">
                              <span>专家团正在进入研讨...</span>
                          </div>
                      ) : (
                          novelSession.outlineDiscussions.map((msg) => {
                              const expert = novelSession.experts.find(e => e.id === msg.expertId);
                              return (
                                  <div key={msg.id} className="flex gap-4 max-w-3xl">
                                      <img 
                                        src={expert?.avatar} 
                                        className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex-shrink-0"
                                        alt={expert?.name}
                                      />
                                      <div className="flex-1">
                                          <div className="flex items-baseline gap-2 mb-1">
                                              <span className="font-medium text-slate-200">{expert?.name}</span>
                                              <span className="text-xs text-slate-500">{expert?.field}</span>
                                          </div>
                                          <div className="p-4 rounded-xl rounded-tl-none bg-slate-800/50 border border-slate-700 text-slate-300">
                                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                                          </div>
                                      </div>
                                  </div>
                              );
                          })
                      )}
                      <div ref={scrollRef} />
                  </div>
              ) : (
                  <div className="space-y-8">
                      {novelSession.drafts.filter(d => d.round === novelSession.currentRound).map((draft, index) => {
                          // Hide the revision draft from bottom panel if we are revising, 
                          // because it is now shown in the top panel.
                          // Draft index 0 is the initial draft. Index 1+ are revisions.
                          // If status is revising, the last draft is the active one.
                          if (novelSession.status === 'revising' && index === novelSession.drafts.filter(d => d.round === novelSession.currentRound).length - 1) {
                              return null;
                          }

                          return (
                          <div key={draft.createdAt} className="group">
                              <div className="flex items-center gap-2 mb-3 text-xs text-slate-500 uppercase tracking-wider font-sans">
                                  <span className="bg-slate-800 px-2 py-1 rounded text-slate-400 border border-slate-700">
                                  v{draft.version}
                                  </span>
                                  <span>{index === 0 ? '初始草稿' : '修订版本'}</span>
                                  <span className="text-slate-600">•</span>
                                  <span>{new Date(draft.createdAt).toLocaleTimeString()}</span>
                              </div>
                              <div className="prose prose-invert prose-sm max-w-none p-4 rounded-xl border border-slate-800 bg-slate-900/50 group-hover:border-slate-700 transition-colors">
                                  <ReactMarkdown>{draft.content}</ReactMarkdown>
                                  {isGenerating && draft === currentDraft && (
                                      <span className="inline-block w-1.5 h-4 bg-emerald-500 ml-1 animate-pulse align-middle" />
                                  )}
                              </div>
                          </div>
                      )})}
                      <div ref={scrollRef} />
                  </div>
              )}
              </div>
          </div>

        </div>

        {/* Floating Toggle Buttons */}
        <div className={`absolute top-24 z-50 flex flex-col gap-2 transition-all duration-300 ${
            activePanel !== 'none' ? 'right-[450px]' : 'right-0'
        }`}>
            {/* Body View Toggle */}
            <button
                onClick={() => setActivePanel(activePanel === 'body' ? 'none' : 'body')}
                className={`p-3 rounded-l-xl shadow-xl border-y border-l transition-all ${
                    activePanel === 'body' 
                        ? 'bg-emerald-900/80 border-emerald-700 text-emerald-400 translate-x-0' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 translate-x-1 hover:translate-x-0'
                }`}
                title="主角状态"
            >
                <Activity className="w-5 h-5" />
            </button>

            {/* Expert View Toggle */}
            <button
                onClick={() => setActivePanel(activePanel === 'experts' ? 'none' : 'experts')}
                className={`p-3 rounded-l-xl shadow-xl border-y border-l transition-all ${
                    activePanel === 'experts' 
                        ? 'bg-blue-900/80 border-blue-700 text-blue-400 translate-x-0' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-blue-400 hover:bg-slate-800 translate-x-1 hover:translate-x-0'
                }`}
                title="专家评审团"
            >
                <Users className="w-5 h-5" />
            </button>
        </div>

        {/* Right Panel: Workflow & Critique */}
        <div className={`flex flex-col bg-slate-950 border-l border-slate-800 relative shadow-2xl z-10 transition-all duration-300 ease-in-out ${
            activePanel !== 'none' ? 'w-[450px]' : 'w-0 border-l-0'
        }`}>
          <div className="w-[450px] flex flex-col h-full overflow-hidden">
          
          {/* Panel Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900 z-10 flex justify-between items-center">
             <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                {activePanel === 'body' ? (
                    <>
                        <User className="w-4 h-4 text-emerald-400" />
                        主角状态监控
                    </>
                ) : (
                    <>
                        <Users className="w-4 h-4 text-blue-400" />
                        专家评审团
                    </>
                )}
             </h3>
             <button onClick={() => setActivePanel('none')} className="text-slate-500 hover:text-white">
                 <ChevronRight className="w-4 h-4" />
             </button>
          </div>

          {/* Workflow Progress (Always Visible in Expert View, maybe hidden in Body view? Or kept for context?) */}
          {/* User request: "human body view and expert view should not be in the same view". 
              So if body view is active, we show body. If expert view is active, we show experts + workflow? 
              Workflow is usually associated with experts. Let's keep workflow in Expert Panel only for now, or both?
              Let's put it in Expert Panel as it was.
          */}
          
          {activePanel === 'experts' && (
            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex justify-between items-center relative">
                    {/* Progress Line */}
                    <div className="absolute left-0 top-1/2 w-full h-0.5 bg-slate-800 -z-10" />
                    
                    {['drafting', 'critiquing', 'summarizing', 'revising'].map((step, idx) => {
                    const isActive = novelSession.status === step;
                    const isPast = ['drafting', 'critiquing', 'summarizing', 'revising', 'completed'].indexOf(novelSession.status) > idx;
                    
                    let icon = <Edit3 className="w-3 h-3" />;
                    if (step === 'critiquing') icon = <MessageSquare className="w-3 h-3" />;
                    if (step === 'summarizing') icon = <CheckCircle className="w-3 h-3" />;
                    if (step === 'revising') icon = <RefreshCw className="w-3 h-3" />;

                    return (
                        <div key={step} className={`flex flex-col items-center gap-2 ${isActive ? 'scale-110' : ''} transition-all`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                            isActive ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20' :
                            isPast ? 'bg-slate-800 border-emerald-800 text-emerald-500' :
                            'bg-slate-900 border-slate-700 text-slate-600'
                        }`}>
                            {icon}
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">{step}</span>
                        </div>
                    );
                    })}
                </div>
            </div>
          )}
          
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto bg-slate-950 custom-scrollbar">
              
              {/* BODY VIEW CONTENT */}
              {activePanel === 'body' && (
                  <div className="p-6">
                      {protagonist ? (
                          <BodyStatusView character={protagonist} />
                      ) : (
                          <div className="text-center text-slate-500 mt-10">
                              <p>暂无主角数据</p>
                          </div>
                      )}
                  </div>
              )}

              {/* EXPERT VIEW CONTENT */}
              {activePanel === 'experts' && (
                  <div className="p-4 space-y-4">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                            专家团 ({allParticipants.length})
                        </div>
                        
                        {allParticipants.map(expert => {
                            const isActive = activeExpertIds.includes(expert.id);
                            const contentData = expertContentMap[expert.id];
                            
                            return (
                            <ExpertCard 
                                key={expert.id}
                                expert={expert}
                                isActive={isActive}
                                content={contentData?.content}
                                thinking={contentData?.thinking}
                            />
                            );
                        })}
                        
                        {/* Status overlay for non-active phases */}
                        {(novelSession.status === 'drafting' || novelSession.status === 'revising' || novelSession.status === 'outline_discussion') && (
                            <div className="mt-8 text-center p-6 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                            <div className="animate-pulse flex flex-col items-center gap-3">
                                {novelSession.status === 'drafting' ? (
                                    <>
                                        <Edit3 className="w-8 h-8 text-slate-600" />
                                        <span className="text-sm text-slate-500">正在创作新章节...</span>
                                    </>
                                ) : novelSession.status === 'outline_discussion' ? (
                                    <>
                                        <LayoutTemplate className="w-8 h-8 text-slate-600" />
                                        <span className="text-sm text-slate-500">专家团正在研讨剧情大纲...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-8 h-8 text-slate-600" />
                                        <span className="text-sm text-slate-500">正在修订文稿...</span>
                                    </>
                                )}
                            </div>
                            </div>
                        )}
                  </div>
              )}
          </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NovelWorkshopPage;

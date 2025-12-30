import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDiscussionStore } from '@/store/useDiscussionStore';
import { Users, RefreshCw, Play, Brain, Sparkles, Plus, X, LayoutTemplate } from 'lucide-react';
import { Expert } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface Template {
  id: string;
  name: string;
  description: string;
  requirements: string;
  experts: Omit<Expert, 'id' | 'avatar' | 'color'>[];
  maxRounds: number;
  enableThinking: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: 'mecha-battle',
    name: '机甲遭遇战',
    description: '近未来末世背景下的机甲战斗，注重逻辑与设定。',
    requirements: '发生在近未来末世背景下的一场两个不同势力间的机甲遭遇战',
    experts: [
      { name: '小A', field: '时间逻辑专家', personality: '严谨', initialStance: '洞悉小说时间逻辑漏洞' },
      { name: '小B', field: '人物设定专家', personality: '敏锐', initialStance: '洞悉小说人物设定、人物关系漏洞' },
      { name: '小C', field: '世界观架构师', personality: '宏观', initialStance: '洞悉小说世界观设定、场景地点逻辑漏洞' },
      { name: '小D', field: '行为逻辑专家', personality: '务实', initialStance: '洞悉小说任务驱动、行为逻辑漏洞' }
    ],
    maxRounds: 2,
    enableThinking: false
  },
  {
    id: 'quick-test',
    name: '快速测试 (单人)',
    description: '用于快速验证系统流程的测试模板，仅有一名专家。',
    requirements: '写一个关于程序员在深夜调试代码时发现了一个产生自我意识的AI的短篇故事开头。请严格控制字数在600字以内。',
    experts: [
      { name: '测试员T', field: '系统测试', personality: '直接', initialStance: '检查逻辑完整性' }
    ],
    maxRounds: 10, 
    enableThinking: true
  }
];

const NovelSetup: React.FC = () => {
  const [requirements, setRequirements] = useState('');
  const [worldview, setWorldview] = useState(''); // New State
  const [maxRounds, setMaxRounds] = useState(10); // Default to 10 for outline logic to work
  const [enableThinking, setEnableThinking] = useState(true);
  const [suggestedExperts, setSuggestedExperts] = useState<Expert[]>([]);
  const [selectedExperts, setSelectedExperts] = useState<Expert[]>([]);
  const [customExpertName, setCustomExpertName] = useState('');
  const [customExpertField, setCustomExpertField] = useState('');
  const [isGeneratingWorldview, setIsGeneratingWorldview] = useState(false);
  
  const navigate = useNavigate();
  const { initNovelSession, getExpertSuggestions, generateWorldview, isLoading, error } = useDiscussionStore();

  const handleGenerateWorldview = async () => {
    if (!requirements.trim()) return;
    setIsGeneratingWorldview(true);
    const result = await generateWorldview(requirements);
    setWorldview(result);
    setIsGeneratingWorldview(false);
  };

  const applyTemplate = (template: Template) => {
    setRequirements(template.requirements);
    setMaxRounds(template.maxRounds);
    setEnableThinking(template.enableThinking);
    setWorldview(''); // Reset worldview for template
    
    const experts: Expert[] = template.experts.map(e => ({
      ...e,
      id: uuidv4(),
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.name}`
    }));
    setSelectedExperts(experts);
    setSuggestedExperts([]);
  };

  const handleGetSuggestions = async () => {
    if (!requirements.trim()) return;
    const suggestions = await getExpertSuggestions(requirements);
    setSuggestedExperts(suggestions);
  };

  const toggleExpertSelection = (expert: Expert) => {
    if (selectedExperts.find(e => e.id === expert.id)) {
      setSelectedExperts(selectedExperts.filter(e => e.id !== expert.id));
    } else {
      setSelectedExperts([...selectedExperts, expert]);
    }
  };

  const addCustomExpert = () => {
    if (!customExpertName.trim() || !customExpertField.trim()) return;
    const newExpert: Expert = {
      id: uuidv4(),
      name: customExpertName,
      field: customExpertField,
      personality: '自定义',
      initialStance: '自定义',
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${customExpertName}`
    };
    setSelectedExperts([...selectedExperts, newExpert]);
    setCustomExpertName('');
    setCustomExpertField('');
  };

  const handleStart = () => {
    if (!requirements.trim() || selectedExperts.length === 0) return;
    initNovelSession(requirements, worldview, selectedExperts, maxRounds, enableThinking);
    navigate('/novel-workshop');
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-8 bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
      <h2 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
        AI 小说创作工坊
      </h2>
      
      <div className="space-y-8">
        {/* Templates */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4" />
            快速开始模板
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                className="text-left p-4 bg-slate-900/50 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 rounded-xl transition-all group"
              >
                <div className="font-medium text-slate-200 mb-1 group-hover:text-emerald-400 transition-colors">
                  {template.name}
                </div>
                <div className="text-xs text-slate-500 line-clamp-2">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Novel Requirements */}
        <div>
          <label className="block text-lg font-medium text-slate-200 mb-3">
            小说开头或创作要求
          </label>
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            className="w-full h-32 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-100 placeholder-slate-500 resize-none"
            placeholder="例如：在一个赛博朋克风格的未来城市，一名私家侦探接到了一个寻找失踪仿生人的委托..."
          />
        </div>

        {/* Worldview Settings */}
        <div className="bg-slate-900/30 p-6 rounded-xl border border-slate-700">
           <div className="flex justify-between items-center mb-4">
             <label className="block text-lg font-medium text-slate-200">
                世界观设定 (可选)
             </label>
             <button
                onClick={handleGenerateWorldview}
                disabled={isGeneratingWorldview || !requirements.trim()}
                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-600/50 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
             >
                {isGeneratingWorldview ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                AI 自动生成
             </button>
           </div>
           <textarea
             value={worldview}
             onChange={(e) => setWorldview(e.target.value)}
             className="w-full h-40 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-300 placeholder-slate-600 resize-none font-serif leading-relaxed"
             placeholder="在此输入详细的世界观设定，包含势力、力量体系、关键人物等。如果不填，AI 将自行发挥。建议使用上方按钮基于要求生成。"
           />
        </div>

        {/* Expert Selection Section */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              评审专家团 ({selectedExperts.length})
            </h3>
            <button
              onClick={handleGetSuggestions}
              disabled={isLoading || !requirements.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI 推荐专家
            </button>
          </div>

          {/* Selected Experts Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedExperts.length === 0 && (
              <span className="text-slate-500 text-sm italic">暂无选定专家，请从下方选择或手动添加</span>
            )}
            {selectedExperts.map(expert => (
              <div key={expert.id} className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30">
                <span className="text-sm font-medium">{expert.name}</span>
                <span className="text-xs opacity-75">({expert.field})</span>
                <button onClick={() => toggleExpertSelection(expert)} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* AI Suggestions Grid */}
          {suggestedExperts.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm text-slate-400 mb-3">AI 推荐人选：</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestedExperts.map(expert => {
                  const isSelected = selectedExperts.some(e => e.id === expert.id);
                  return (
                    <div 
                      key={expert.id}
                      onClick={() => toggleExpertSelection(expert)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                        isSelected 
                          ? 'bg-emerald-500/20 border-emerald-500' 
                          : 'bg-slate-800 border-slate-700 hover:border-emerald-500/50'
                      }`}
                    >
                      <img src={expert.avatar} alt={expert.name} className="w-8 h-8 rounded-full bg-slate-700" />
                      <div>
                        <div className="text-sm font-medium text-slate-200">{expert.name}</div>
                        <div className="text-xs text-slate-400">{expert.field}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manual Add */}
          <div className="flex gap-3 items-end border-t border-slate-700 pt-4">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">专家姓名</label>
              <input
                value={customExpertName}
                onChange={(e) => setCustomExpertName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                placeholder="例如：王教授"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">专业领域</label>
              <input
                value={customExpertField}
                onChange={(e) => setCustomExpertField(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                placeholder="例如：科幻文学批评"
              />
            </div>
            <button
              onClick={addCustomExpert}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              添加
            </button>
          </div>
        </div>

        {/* Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                迭代轮次: {maxRounds}
              </div>
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={maxRounds}
              onChange={(e) => setMaxRounds(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>1</span>
              <span>5</span>
            </div>
          </div>

           {/* Thinking Mode Toggle */}
           <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-slate-200">深度思考模式</div>
                <div className="text-xs text-slate-500">启用 DeepSeek R1 思维链</div>
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
        </div>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={isLoading || !requirements.trim() || selectedExperts.length === 0}
          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
            isLoading || !requirements.trim() || selectedExperts.length === 0
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg hover:shadow-emerald-500/25'
          }`}
        >
          <Play className="w-5 h-5 fill-current" />
          开始创作流程
        </button>
      </div>
    </div>
  );
};

export default NovelSetup;
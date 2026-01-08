import React from 'react';
import { CharacterProfile, BodyPartStatus } from '@/types';
import { Activity, AlertCircle, ShieldCheck, Backpack, Package } from 'lucide-react';

interface BodyStatusViewProps {
    character: CharacterProfile;
}

const BodyStatusView: React.FC<BodyStatusViewProps> = ({ character }) => {
    const hasBodyStatus = character.bodyStatus && Object.keys(character.bodyStatus).length > 0;
    const hasInventory = character.inventory && character.inventory.length > 0;

    const getPartColor = (status?: BodyPartStatus) => {
        if (!status) return 'fill-slate-800/50 stroke-slate-700'; // Default healthy color
        switch (status.severity) {
            case 'critical': return 'fill-red-600/80 stroke-red-400 animate-pulse';
            case 'high': return 'fill-orange-600/80 stroke-orange-400';
            case 'medium': return 'fill-yellow-600/80 stroke-yellow-400';
            case 'low': return 'fill-blue-600/80 stroke-blue-400';
            default: return 'fill-slate-700/50 stroke-slate-600';
        }
    };

    const parts = character.bodyStatus || {};

    return (
        <div className="flex flex-col gap-6">
            {/* Body Status Section */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        生理体征
                    </h4>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                        更新于第 {character.lastUpdatedRound} 轮
                    </span>
                </div>

                <div className="flex gap-4">
                    {/* Visual Representation (Left) - Always Visible */}
                    <div className="relative w-32 h-64 flex-shrink-0 mx-auto bg-slate-900/20 rounded-xl border border-slate-800/50 p-2">
                        <svg viewBox="0 0 100 200" className="w-full h-full drop-shadow-xl">
                            {/* Head */}
                            <circle 
                                cx="50" cy="20" r="12" 
                                className={`${getPartColor(parts['head'])} transition-all duration-500`} 
                                strokeWidth="2"
                            />
                            {/* Torso */}
                            <path 
                                d="M35 40 H65 L60 100 H40 Z" 
                                className={`${getPartColor(parts['torso'])} transition-all duration-500`}
                                strokeWidth="2"
                            />
                            {/* Left Arm (Viewer's Left) */}
                            <path 
                                d="M35 42 L15 90" 
                                className={`${getPartColor(parts['left_arm'])} transition-all duration-500`}
                                strokeWidth="4" strokeLinecap="round"
                                fill="none"
                            />
                            {/* Right Arm */}
                            <path 
                                d="M65 42 L85 90" 
                                className={`${getPartColor(parts['right_arm'])} transition-all duration-500`}
                                strokeWidth="4" strokeLinecap="round"
                                fill="none"
                            />
                            {/* Left Leg */}
                            <path 
                                d="M42 100 L35 170" 
                                className={`${getPartColor(parts['left_leg'])} transition-all duration-500`}
                                strokeWidth="4" strokeLinecap="round"
                                fill="none"
                            />
                            {/* Right Leg */}
                            <path 
                                d="M58 100 L65 170" 
                                className={`${getPartColor(parts['right_leg'])} transition-all duration-500`}
                                strokeWidth="4" strokeLinecap="round"
                                fill="none"
                            />
                        </svg>
                    </div>

                    {/* Status List (Right) - Shows placeholder if healthy */}
                    <div className="flex-1 space-y-2 overflow-y-auto max-h-64 custom-scrollbar pr-1">
                        {hasBodyStatus ? (
                            Object.values(parts).map((part, idx) => (
                                <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded p-2 text-xs">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-slate-300">{part.name}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                                            part.severity === 'critical' ? 'bg-red-900/30 text-red-400' :
                                            part.severity === 'high' ? 'bg-orange-900/30 text-orange-400' :
                                            part.severity === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                                            'bg-blue-900/30 text-blue-400'
                                        }`}>
                                            {part.status}
                                        </span>
                                    </div>
                                    {part.description && (
                                        <p className="text-slate-500 leading-tight scale-95 origin-top-left">
                                            {part.description}
                                        </p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                                <ShieldCheck className="w-8 h-8 opacity-50" />
                                <span className="text-xs">身体机能正常</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Inventory Section - Always Visible (shows empty state) */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                        <Backpack className="w-4 h-4 text-blue-400" />
                        随身物品 ({character.inventory?.length || 0})
                    </h4>
                </div>
                
                {hasInventory ? (
                    <div className="grid grid-cols-2 gap-2">
                        {character.inventory?.map((item, idx) => (
                            <div key={idx} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2 flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center flex-shrink-0 text-slate-400">
                                    <Package className="w-3 h-3" />
                                </div>
                                <span className="text-xs text-slate-200 truncate" title={item}>
                                    {item}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="border-2 border-dashed border-slate-800 rounded-lg p-4 flex flex-col items-center justify-center text-slate-600 gap-1">
                        <Package className="w-4 h-4 opacity-50" />
                        <span className="text-[10px]">行囊空空如也</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BodyStatusView;

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, Users, Sparkles, Server } from 'lucide-react';

interface LoadingOverlayProps {
  isLoading: boolean;
  topic: string;
}

const STEPS = [
  { icon: BrainCircuit, text: "正在分析讨论话题...", color: "text-blue-400" },
  { icon: Server, text: "正在连接 DeepSeek V3.2...", color: "text-purple-400" },
  { icon: Users, text: "正在寻找合适的专家...", color: "text-green-400" },
  { icon: Sparkles, text: "正在生成专家人设...", color: "text-amber-400" },
  { icon: BrainCircuit, text: "正在准备圆桌会议...", color: "text-pink-400" }
];

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading, topic }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isLoading) {
      setStep(0);
      const interval = setInterval(() => {
        setStep(prev => (prev < STEPS.length - 1 ? prev + 1 : prev));
      }, 1500); // Change step every 1.5 seconds

      return () => clearInterval(interval);
    }
  }, [isLoading]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-xl"
        >
          <div className="w-full max-w-md p-8 relative">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px] animate-pulse" />

            <div className="relative z-10 flex flex-col items-center gap-8">
              {/* Main Icon Animation */}
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="w-24 h-24 rounded-full border-t-4 border-l-4 border-blue-500/50"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 w-24 h-24 rounded-full border-b-4 border-r-4 border-purple-500/50 scale-75"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                   {/* Dynamically change the center icon based on current step */}
                   {React.createElement(STEPS[step].icon, { 
                     className: `w-8 h-8 ${STEPS[step].color} animate-pulse` 
                   })}
                </div>
              </div>

              {/* Status Text */}
              <div className="text-center space-y-2 h-20">
                <motion.h3
                  key={step}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-2xl font-bold text-white"
                >
                  {STEPS[step].text}
                </motion.h3>
                <p className="text-slate-400 text-sm max-w-xs mx-auto truncate px-4">
                  "{topic}"
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                  initial={{ width: "0%" }}
                  animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingOverlay;

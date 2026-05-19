import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { SyncState } from '../data';

const ensembleChannel = new BroadcastChannel('ensemble-sync');

export default function Overlay() {
  const [subtitle, setSubtitle] = useState('');
  const [isAI, setIsAI] = useState(false);
  const [stageTitle, setStageTitle] = useState('');
  const [timeTag, setTimeTag] = useState('');
  const [useTypewriter, setUseTypewriter] = useState(true);
  
  // Real-time typewriter effect state
  const [displayedText, setDisplayedText] = useState('');
  const textContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMsg = (e: MessageEvent<SyncState>) => {
      const state = e.data;
      if (state.clear) {
        setSubtitle('');
        setDisplayedText('');
      } else {
        setSubtitle(state.text);
        setIsAI(state.isAI);
        setStageTitle(state.stageTitle);
        setTimeTag(state.timeTag);
        setUseTypewriter(state.typewriter);
        if (!state.typewriter) {
          setDisplayedText(state.text);
        } else {
          setDisplayedText('');
        }
      }
    };
    ensembleChannel.addEventListener('message', handleMsg);
    
    return () => {
      ensembleChannel.removeEventListener('message', handleMsg);
    };
  }, []);

  // Simple Typewriter tick effect
  useEffect(() => {
    if (!useTypewriter || !subtitle) return;
    
    let currentIdx = 0;
    setDisplayedText('');
    
    const interval = setInterval(() => {
      currentIdx++;
      setDisplayedText(subtitle.slice(0, currentIdx));
      if (textContainerRef.current) {
        textContainerRef.current.scrollTop = textContainerRef.current.scrollHeight;
      }
      if (currentIdx >= subtitle.length) {
        clearInterval(interval);
      }
    }, 40); // speed
    
    return () => clearInterval(interval);
  }, [subtitle, useTypewriter]);

  return (
    <div className="overlay-root">
      <div className="fixed top-4 left-4 pointer-events-auto">
        <Link 
          to="/"
          className="flex items-center gap-2 px-3 py-1.5 bg-black/40 hover:bg-black/80 text-white/70 hover:text-white rounded-lg text-xs font-medium backdrop-blur-md border border-white/10 shadow-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回主页
        </Link>
      </div>
      <AnimatePresence mode="wait">
        {subtitle && (
          <motion.div
            key={subtitle} 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="max-w-5xl px-8 flex flex-col items-center"
          >
            {/* Top Indicator Tags */}
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-3 flex items-center justify-center gap-2 pointer-events-none"
            >
              {isAI ? (
                <div className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(59,130,246,0.3)] backdrop-blur-md flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  AI 正在回答
                </div>
              ) : (
                <div className="px-3 py-0.5 rounded-full bg-primary/20 border border-primary/40 text-primary text-[10px] font-bold tracking-widest shadow-[0_0_15px_rgba(242,125,38,0.2)] backdrop-blur-md flex items-center gap-1.5">
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                  </span>
                  ON AIR
                </div>
              )}
              
              {!isAI && stageTitle && (
                <div className="px-3 py-0.5 rounded-full glass-panel border border-white/20 text-white/90 text-[10px] font-bold tracking-widest flex items-center gap-1.5">
                  <span className="text-white/50">{timeTag}</span>
                  <span>{stageTitle}</span>
                </div>
              )}
            </motion.div>
            
            {/* Main Subtitle Box */}
            <div 
              ref={textContainerRef}
              className="caption-overlay"
            >
              <div className="text-center text-[clamp(1.5rem,2.5vw,2.5rem)] font-bold text-white leading-[1.6] tracking-tight max-h-[50vh] overflow-y-auto scroll-hide">
                {displayedText.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 && line.trim() ? "mt-2" : ""}>{line}</p>
                ))}
                {/* Blinking cursor for typewriter effect */}
                {useTypewriter && displayedText.length < subtitle.length && (
                  <span className="inline-block w-[3px] h-[1em] bg-primary ml-1 align-middle animate-pulse" />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

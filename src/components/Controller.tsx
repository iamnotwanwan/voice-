import { useEffect, useState, useRef } from 'react';
import { STAGES, StageInfo, SyncState } from '../data';

interface VoiceSettings {
  rate: number;
  pitch: number;
  volume: number;
  pause: number;
  preset: string;
  cloudVoiceId: string;
  useVoiceClone: boolean;
  referenceVoiceUrl: string;
  audioProfile: string;
  directorsNote: string;
  scene: string;
  sampleContext: string;
  userGeminiApiKey: string;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  pause: 300,
  preset: '正式主持人',
  cloudVoiceId: 'gemini-achird',
  useVoiceClone: false,
  referenceVoiceUrl: "https://www.image2url.com/r2/default/audio/1779201128312-4d68fea3-71cd-44ed-b1db-d4a30b988a72.mp3",
  audioProfile: "A vibrant and theatrical host.",
  directorsNote: "Style: The \"Vocal Smile\": The soft palate is raised to keep the tone bright, sunny, and explicitly inviting. Pace: Natural conversational pace. Accent: American (Gen).",
  scene: "Trivia night at a pub.",
  sampleContext: "High-energy and theatrical. Fast pacing with dramatic, suspenseful beats before reveals.",
  userGeminiApiKey: ""
};

const CLOUD_VOICES = [
  { id: 'gemini-achird', name: 'Gemini - Achird (推荐剧情配音)', provider: 'gemini', voice: 'Achird' }
];

const PRESETS: Record<string, any> = {
  '正式主持人': { rate: 0.95, pitch: 1.0, pause: 400 },
  '活泼主持人': { rate: 1.15, pitch: 1.1, pause: 200 },
  '温柔导览员': { rate: 0.85, pitch: 1.0, pause: 500 },
  '自定义': {}
};

const SUGGESTED_QS = [
  "什么是《合奏 Ensemble》？",
  "虚拟展馆里能看到什么？",
  "“声成”部分是怎么生成的？",
  "报错后系统会发生什么？",
  "音乐和视觉有什么关系？",
  "交互部分怎么参与？"
];

const ensembleChannel = new BroadcastChannel('ensemble-sync');

function splitTextIntoSentences(text: string): string[] {
  return text.split(/([。！？!?\n]+)/).reduce((acc, part, i, arr) => {
    if (i % 2 === 0) {
      const punct = arr[i + 1] || '';
      const sentence = (part + punct).trim();
      if (sentence) acc.push(sentence);
    }
    return acc;
  }, [] as string[]);
}

function polishForSpeech(text: string, preset: string): string {
  let polished = text;
  // 简单做一些拟人化替换，让口语播报更自然
  if (preset === '活泼主持人') {
    polished = polished.replace(/各位老师、同学，大家好。/g, "哈喽，各位老师、同学，大家好！");
    polished = polished.replace(/这是一场由声音、视觉、交互和现场流程共同组成的视觉交互表演。/g, "这是一场由声音、视觉、交互和现场流程一起组成的视觉大秀哦！");
    polished = polished.replace(/第一部分，叫做「声成」。/g, "我们把第一部分，叫做「声成」。");
    polished = polished.replace(/接下来，/g, "好，接下来啊，");
  } else if (preset === '温柔导览员') {
    polished = polished.replace(/现在，我们进入/g, "接下来，我们将带您慢慢进入");
    polished = polished.replace(/请跟随第一视角向前浏览。/g, "大家可以跟随画面第一视角向前浏览一下。");
  }
  return polished;
}

export default function Controller() {
  const [activeTab, setActiveTab] = useState<'timeline' | 'qa' | 'voice' | 'settings'>('timeline');
  const [question, setQuestion] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [typewriterEnabled, setTypewriterEnabled] = useState(true);
  const [aiAnswer, setAiAnswer] = useState('');
  
  // Timeline states
  const [autoMode, setAutoMode] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0); // in ms
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);
  
  // Voice settings state
  const [vSettings, setVSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [currentSentenceInfo, setCurrentSentenceInfo] = useState('');
  const [audioStatusMsg, setAudioStatusMsg] = useState("");

  const timerRef = useRef<number | null>(null);
  const activeUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const stopRequested = useRef<boolean>(false);
  const generatedAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Load Voice Settings from localStorage
    const saved = localStorage.getItem('ensembleVoiceSettings');
    if (saved) {
      try {
        setVSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (e) { }
    }
  }, []);

  const saveVoiceSettings = (newSettings: VoiceSettings) => {
    setVSettings(newSettings);
    localStorage.setItem('ensembleVoiceSettings', JSON.stringify(newSettings));
  };

  const applyVoicePreset = (presetName: string) => {
    const p = PRESETS[presetName];
    if (p) {
      saveVoiceSettings({ ...vSettings, rate: p.rate, pitch: p.pitch, pause: p.pause, preset: presetName });
    } else {
      saveVoiceSettings({ ...vSettings, preset: presetName });
    }
  };

  const sendState = (state: SyncState) => {
    ensembleChannel.postMessage(state);
  };

  const clearSubtitle = () => {
    sendState({ text: "", stageTitle: "", timeTag: "", isAI: false, typewriter: false, clear: true });
    setCurrentStageId(null);
    setCurrentSentenceInfo('');
  };

  const unlockSpeech = () => {
    // No longer required for cloud TTS 
  };

  const testVoice = () => {
    handleTextBroadcast("你好，我是《合奏 Ensemble》的 AI 主持人。现在声音测试成功，我们的合奏即将开始。");
  };

  const generateVoiceCloneAudio = async (text: string) => {
    const selectedVoice = CLOUD_VOICES.find(v => v.id === vSettings.cloudVoiceId) || CLOUD_VOICES[0];

    const response = await fetch("/api/tts-clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        provider: selectedVoice.provider,
        voiceId: selectedVoice.voice,
        referenceVoiceUrl: vSettings.useVoiceClone ? vSettings.referenceVoiceUrl : undefined,
        audioProfile: vSettings.audioProfile,
        directorsNote: vSettings.directorsNote,
        scene: vSettings.scene,
        sampleContext: vSettings.sampleContext,
        geminiApiKey: vSettings.userGeminiApiKey,
        voiceStyle: {
          emotion: vSettings.preset,
          tone: "young host",
          speed: vSettings.rate,
          pitch: vSettings.pitch
        }
      })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.error || `API error: ${response.status}`);
    }
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("audio")) {
      throw new Error("Invalid response content");
    }
    
    const audioBlob = await response.blob();
    return URL.createObjectURL(audioBlob);
  };

  const playGeneratedAudio = (audioUrl: string) => {
    return new Promise<void>((resolve, reject) => {
      const audio = new Audio(audioUrl);
      generatedAudioRef.current = audio;
      audio.volume = vSettings.volume;
      audio.onended = () => {
        generatedAudioRef.current = null;
        resolve();
      };
      audio.onerror = (e) => {
        generatedAudioRef.current = null;
        reject(e);
      };
      audio.play().catch(reject);
    });
  };

  const speakWithConfig = async (text: string) => {    
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume(); 

    const finalTexts = polishForSpeech(text, vSettings.preset);
    const sentences = splitTextIntoSentences(finalTexts);
    
    for (let i = 0; i < sentences.length; i++) {
      if (stopRequested.current) break;
      setCurrentSentenceInfo(`正在朗读第 ${i + 1} 句 / 共 ${sentences.length} 句`);
      await new Promise<void>(resolve => {
        const utterance = new SpeechSynthesisUtterance(sentences[i]);
        activeUtterance.current = utterance;
        utterance.lang = "zh-CN";
        utterance.rate = vSettings.rate;
        utterance.pitch = vSettings.pitch;
        utterance.volume = vSettings.volume;
        
        utterance.onend = () => { activeUtterance.current = null; resolve(); };
        utterance.onerror = () => { activeUtterance.current = null; resolve(); }; 
        window.speechSynthesis.speak(utterance);
      });
      if (stopRequested.current) break;
      if (vSettings.pause > 0 && i < sentences.length - 1) {
        await new Promise(r => setTimeout(r, vSettings.pause));
      }
    }
    
    if (!stopRequested.current) {
      setCurrentSentenceInfo('');
    }
  };

  const handleTextBroadcast = async (text: string) => {
    if (!speechEnabled) return;
    
    stopRequested.current = false;
    stopAllAudio();
    setAudioStatusMsg("");
    
    setAudioStatusMsg("正在调用云端高性能 TTS...");
    try {
      const finalTexts = polishForSpeech(text, vSettings.preset);
      const url = await generateVoiceCloneAudio(finalTexts);
      if (stopRequested.current) return;
      setAudioStatusMsg("正在播放语音...");
      await playGeneratedAudio(url);
      setAudioStatusMsg("");
    } catch (error) {
      console.error("云端语音生成失败：", error);
      setAudioStatusMsg(`语音生成失败: ${error instanceof Error ? error.message : "未知错误"}，已回退到浏览器自带语音`);
      if (!stopRequested.current) {
        await speakWithConfig(text);
      }
    }
  };

  const stopAllAudio = () => {
    if (generatedAudioRef.current) {
      generatedAudioRef.current.pause();
      generatedAudioRef.current.currentTime = 0;
      generatedAudioRef.current = null;
    }
  };

  const playSegment = (stage: StageInfo) => {
    setCurrentStageId(stage.id);
    const fullTextStr = stage.text.join("\n");
    
    // 发送完整字幕给 overlay
    sendState({ 
      text: fullTextStr, 
      stageTitle: stage.title, 
      timeTag: stage.timeTag, 
      isAI: false, 
      typewriter: typewriterEnabled 
    });

    handleTextBroadcast(fullTextStr);
  };

  const askAI = async (qText: string) => {
    if (!qText.trim() || isAnswering) return;
    setIsAnswering(true);
    setAiAnswer('');
    
    sendState({ text: "AI思考中...", stageTitle: "AI 问答", timeTag: "Q&A", isAI: true, typewriter: false });

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: qText,
          geminiApiKey: vSettings.userGeminiApiKey
        })
      });
      const data = await res.json();
      const fullAnswer = data.answer || "抱歉，出现了一些小故障。";
      setAiAnswer(fullAnswer);

      sendState({ 
        text: fullAnswer, 
        stageTitle: "AI 问答", 
        timeTag: "Q&A", 
        isAI: true, 
        typewriter: typewriterEnabled 
      });
      
      handleTextBroadcast(fullAnswer);

    } catch (e) {
      console.error(e);
      sendState({ text: "系统有点开小差啦...", stageTitle: "AI 问答", timeTag: "Q&A", isAI: true, typewriter: false });
    } finally {
      setIsAnswering(false);
    }
  };

  // --- Auto Flow Logic ---
  const startAutoFlow = () => {
    unlockSpeech();
    setAutoMode(true);
    setAutoPaused(false);
    setTimeElapsed(0);
    clearSubtitle();
  };

  const stopAutoFlow = () => {
    setAutoMode(false);
    setAutoPaused(false);
    setTimeElapsed(0);
    clearSubtitle();
    setCurrentStageId(null);
  };

  const pauseAutoFlow = () => {
    setAutoPaused(true);
    if (generatedAudioRef.current) generatedAudioRef.current.pause();
  };

  const resumeAutoFlow = () => {
    setAutoPaused(false);
    if (generatedAudioRef.current && Number.isFinite(generatedAudioRef.current.duration)) generatedAudioRef.current.play().catch(console.error);
  };

  const stopBroadcast = () => {
    stopRequested.current = true;
    stopAllAudio();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (autoMode) {
      setAutoMode(false);
      setAutoPaused(false);
      setTimeElapsed(0);
      setCurrentStageId(null);
    }
    setAudioStatusMsg("");
    setCurrentSentenceInfo("");
  };

  useEffect(() => {
    if (autoMode && !autoPaused) {
      timerRef.current = window.setInterval(() => {
        setTimeElapsed(prev => prev + 1000);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoMode, autoPaused]);

  // Handle stage transitions
  useEffect(() => {
    if (!autoMode || autoPaused) return;
    const stage = STAGES.find(s => timeElapsed === s.startTimeMs);
    if (stage) {
      playSegment(stage);
    }
  }, [timeElapsed, autoMode, autoPaused]);

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-bg text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="glass-panel p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-orange-500 to-blue-500 rounded-full flex items-center justify-center font-bold text-2xl drop-shadow-md">E</div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Ensemble AI Host Controller</h1>
              <p className="text-xs text-white/50">20-MINUTE TIMELINE CONTROL</p>
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer bg-white/5 px-4 py-2 rounded-full hover:bg-white/10 transition-colors border border-white/10">
              <input 
                type="checkbox" 
                checked={typewriterEnabled} 
                onChange={e => setTypewriterEnabled(e.target.checked)} 
                className="accent-primary"
              />
              <span className="text-sm font-medium">逐字效果</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-white/5 px-4 py-2 rounded-full hover:bg-white/10 transition-colors border border-white/10">
              <input 
                type="checkbox" 
                checked={speechEnabled} 
                onChange={e => {
                   setSpeechEnabled(e.target.checked);
                   if (!e.target.checked && window.speechSynthesis) {
                       window.speechSynthesis.cancel();
                   }
                }} 
                className="accent-primary"
              />
              <span className="text-sm font-medium">开启语音</span>
            </label>
          </div>
        </header>

        <div className="flex gap-2 mb-2 p-2 glass-panel rounded-full overflow-hidden flex-wrap md:flex-nowrap">
          <button 
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-3 px-4 rounded-full text-sm font-bold transition-all ${activeTab === 'timeline' ? 'bg-primary text-white glow-orange border border-primary' : 'bg-transparent text-white/60 hover:bg-white/10'}`}
          >
            时间轴模式
          </button>
          <button 
            onClick={() => setActiveTab('qa')}
            className={`flex-1 py-3 px-4 rounded-full text-sm font-bold transition-all ${activeTab === 'qa' ? 'bg-primary text-white glow-orange border border-primary' : 'bg-transparent text-white/60 hover:bg-white/10'}`}
          >
            AI 问答交流
          </button>
          <button 
            onClick={() => setActiveTab('voice')}
            className={`flex-1 py-3 px-4 rounded-full text-sm font-bold transition-all ${activeTab === 'voice' ? 'bg-primary text-white glow-orange border border-primary' : 'bg-transparent text-white/60 hover:bg-white/10'}`}
          >
            配音设置
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 px-4 rounded-full text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-primary text-white glow-orange border border-primary' : 'bg-transparent text-white/60 hover:bg-white/10'}`}
          >
            系统设置
          </button>
        </div>

        {activeTab === 'timeline' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 flex flex-col md:flex-row gap-4 items-center justify-between border border-white/20">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold text-white">自动流程控制器</h2>
                  {autoMode && <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-green-500/20 text-green-400 border border-green-500/30">RUNNING</span>}
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-primary/10 text-primary border border-primary/20">
                    {CLOUD_VOICES.find(v => v.id === vSettings.cloudVoiceId)?.name || "Gemini Voice"}
                  </span>
                </div>
                <div className="text-sm text-white/50 font-mono tracking-widest uppercase">
                  Time Elapsed: <span className="text-white font-bold">{formatTime(timeElapsed)}</span> / 20:00
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-3">
                <div className="flex gap-2">
                  {!autoMode ? (
                    <button onClick={startAutoFlow} className="px-6 py-2 bg-green-500/20 text-green-400 border border-green-500/50 rounded-xl hover:bg-green-500/30 transition-colors font-bold text-sm">
                      开始 20 分钟自动流程
                    </button>
                  ) : (
                    <>
                      {autoPaused ? (
                        <button onClick={resumeAutoFlow} className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded-xl hover:bg-blue-500/30 transition-colors font-bold text-sm">
                          继续流程
                        </button>
                      ) : (
                        <button onClick={pauseAutoFlow} className="px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 rounded-xl hover:bg-yellow-500/30 transition-colors font-bold text-sm">
                          暂停流程
                        </button>
                      )}
                      <button onClick={stopAutoFlow} className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-xl hover:bg-red-500/30 transition-colors font-bold text-sm">
                        停止并重置
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {currentSentenceInfo && (
              <div className="px-4 py-2 bg-primary/20 border border-primary/40 rounded-xl text-primary text-xs font-bold tracking-widest text-center animate-pulse">
                ► {currentSentenceInfo}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {STAGES.map((stage) => {
                const isCurrent = currentStageId === stage.id;
                return (
                  <div key={stage.id} className={`glass-panel p-5 transition-all relative overflow-hidden ${isCurrent ? 'border-primary shadow-[0_0_20px_rgba(242,125,38,0.2)] bg-primary/5' : 'border-white/10'}`}>
                    {isCurrent && <div className="absolute top-0 left-0 w-1 h-full bg-primary" />}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-white/70">{stage.timeTag}</span>
                          {isCurrent && <span className="text-[10px] uppercase tracking-wider text-primary font-bold flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"/> ON AIR</span>}
                        </div>
                        <h3 className="font-bold text-lg">{stage.title}</h3>
                      </div>
                      <button 
                        onClick={() => {
                          unlockSpeech();
                          playSegment(stage);
                        }}
                        disabled={autoMode}
                        className="px-4 py-1.5 text-xs font-bold rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 disabled:opacity-30 transition-colors"
                      >
                        手动播放
                      </button>
                    </div>
                    <div className="text-xs text-white/50 space-y-1.5 max-h-32 overflow-y-auto scroll-hide">
                      {stage.text.map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
              <button 
                onClick={clearSubtitle}
                className="px-6 py-3 bg-white/5 text-white/60 font-bold border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                清空屏幕字幕
              </button>
              <button 
                onClick={stopBroadcast}
                className="px-6 py-3 bg-red-500/10 text-red-400 font-bold border border-red-500/30 rounded-xl hover:bg-red-500/20 transition-colors text-sm"
              >
                停止所有配音
              </button>
            </div>
          </div>
        )}

        {activeTab === 'qa' && (
          <div className="glass-panel p-8 space-y-8">
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-white/50 flex items-center gap-2">
                <span className="text-primary">✦</span> 快捷提问
              </h2>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QS.map((sq, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      unlockSpeech();
                      askAI(sq);
                    }}
                    disabled={isAnswering}
                    className="text-xs px-4 py-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 disabled:opacity-50 transition-colors"
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-white/50">手动输入问题</h2>
              <div className="relative flex items-center gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="向 AI 主持人提问 (例如: 这个作品讲了什么？)"
                  disabled={isAnswering}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm outline-none focus:border-primary/50 transition-colors"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      unlockSpeech();
                      askAI(question);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    unlockSpeech();
                    askAI(question);
                  }}
                  disabled={isAnswering || !question.trim()}
                  className="px-8 py-4 bg-primary text-white font-bold rounded-xl disabled:opacity-50 transition-colors border border-primary shadow-lg whitespace-nowrap"
                >
                  提问发送
                </button>
              </div>
            </div>

            {aiAnswer && (
              <div className="p-5 bg-white/5 border border-white/10 rounded-xl text-white/90 leading-relaxed text-sm">
                <span className="font-semibold text-white/50 block mb-3 text-xs uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                  AI FULL RESPONSE
                </span>
                {aiAnswer}
              </div>
            )}
            
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6 md:mt-12">
              <button 
                onClick={clearSubtitle}
                className="px-6 py-3 bg-white/5 text-white/60 font-bold border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                清空屏幕字幕
              </button>
              <button 
                onClick={stopBroadcast}
                className="px-6 py-3 bg-red-500/10 text-red-400 font-bold border border-red-500/30 rounded-xl hover:bg-red-500/20 transition-colors text-sm"
              >
                停止所有配音
              </button>
            </div>
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="glass-panel p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">配音设置 Voice Settings</h2>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white/80">云端高性能模型选择 Cloud Voice Select</label>
                  <select 
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary/50"
                    value={vSettings.cloudVoiceId}
                    onChange={(e) => saveVoiceSettings({ ...vSettings, cloudVoiceId: e.target.value })}
                  >
                    {CLOUD_VOICES.map(v => (
                      <option key={v.id} value={v.id} className="bg-[#111] text-white">
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                {vSettings.cloudVoiceId.startsWith('gemini') && (
                  <div className="space-y-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Gemini TTS 特有设置</h3>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-white/60">Audio Profile</label>
                      <textarea 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary/50 text-white/80 h-20"
                        value={vSettings.audioProfile}
                        onChange={e => saveVoiceSettings({ ...vSettings, audioProfile: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-white/60">Director's Note</label>
                      <textarea 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary/50 text-white/80 h-24"
                        value={vSettings.directorsNote}
                        onChange={e => saveVoiceSettings({ ...vSettings, directorsNote: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-white/60">Scene (场景描述)</label>
                      <input 
                        type="text"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary/50 text-white/80"
                        value={vSettings.scene}
                        onChange={e => saveVoiceSettings({ ...vSettings, scene: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-white/60">Sample Context (背景语境)</label>
                      <textarea 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary/50 text-white/80 h-20"
                        value={vSettings.sampleContext}
                        onChange={e => saveVoiceSettings({ ...vSettings, sampleContext: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <label className="font-semibold text-white/80">语速 Rate</label>
                    <span className="text-white/50 font-mono">{vSettings.rate.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.7" max="1.4" step="0.01" value={vSettings.rate} 
                    onChange={e => saveVoiceSettings({ ...vSettings, rate: parseFloat(e.target.value), preset: '自定义' })}
                    className="w-full accent-primary h-1.5 bg-white/10 rounded-lg outline-none cursor-pointer" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <label className="font-semibold text-white/80">音量 Volume</label>
                    <span className="text-white/50 font-mono">{vSettings.volume.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" value={vSettings.volume} 
                    onChange={e => saveVoiceSettings({ ...vSettings, volume: parseFloat(e.target.value) })}
                    className="w-full accent-primary h-1.5 bg-white/10 rounded-lg outline-none cursor-pointer" />
                </div>
              </div>

              <div className="space-y-6">
                <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 flex justify-between items-center">
                  播报风格预设 Preset
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-primary">{vSettings.preset}</span>
                </h2>
                
                <div className="flex flex-col gap-3">
                  {Object.keys(PRESETS).map(key => (
                    <button 
                      key={key} 
                      onClick={() => applyVoicePreset(key)}
                      className={`px-4 py-3 text-left rounded-xl border text-sm font-semibold transition-colors
                        ${vSettings.preset === key ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(242,125,38,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                    >
                      {key}
                    </button>
                  ))}
                  <button 
                    onClick={() => applyVoicePreset('自定义')}
                    className={`px-4 py-3 text-left rounded-xl border text-sm font-semibold transition-colors
                      ${vSettings.preset === '自定义' ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(242,125,38,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                  >
                    自定义调整
                  </button>
                </div>

                <div className="pt-6 border-t border-white/10 space-y-4">
                  <button 
                    onClick={testVoice}
                    className="w-full px-6 py-3 bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/50 rounded-xl hover:bg-indigo-500/30 transition-colors flex justify-center items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    测试当前语音效果
                  </button>

                  <button 
                    onClick={stopBroadcast}
                    className="w-full px-6 py-3 bg-red-500/10 text-red-400 font-bold border border-red-500/30 rounded-xl hover:bg-red-500/20 transition-colors"
                  >
                    停止播报声音
                  </button>
                </div>

                {audioStatusMsg && (
                  <div className="text-xs text-primary font-bold animate-pulse px-4 py-2 border border-primary/20 rounded-lg bg-primary/10 break-all">
                    {audioStatusMsg}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="glass-panel p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  系统环境设置 System Settings
                </h2>
                <p className="text-sm text-white/50">在此配置您的 API 密钥。密钥将保存在浏览器本地，不会上传到公共服务器。</p>
              </div>

              <div className="space-y-6 bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-white/80 block">用户自定义 Gemini API Key</label>
                  <input 
                    type="password" 
                    value={vSettings.userGeminiApiKey}
                    onChange={e => saveVoiceSettings({ ...vSettings, userGeminiApiKey: e.target.value })}
                    placeholder="输入您的 Gemini API Key..."
                    className="w-full bg-black/40 border border-white/20 rounded-xl px-5 py-4 text-sm outline-none focus:border-primary/50 text-primary font-mono"
                  />
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-2">
                    <p className="text-[11px] text-primary/80 leading-relaxed">
                      💡 <b>提示：</b> 如果您在这里填写了 Key，系统将优先使用您的 Key 进行 AI 问答和语音播报。如果您没有在 AI Studio 的 Secrets 中配置环境变量，请务必在此填写以运行项目。
                    </p>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-[11px] text-blue-400 hover:underline inline-block"
                    >
                      获取您的 API Key →
                    </a>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <button 
                    onClick={() => {
                        saveVoiceSettings({ ...vSettings, userGeminiApiKey: "" });
                        alert("API Key 已从本地存储中清除。");
                    }}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors font-bold"
                  >
                    清除本地保存的 API Key
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="glass-panel p-5 space-y-2 border-white/5">
                    <h3 className="text-xs font-bold text-white/40 uppercase">数据持久化</h3>
                    <p className="text-sm">您的所有配音预设、语速设置和 API Key 均已通过 LocalStorage 加密存储在当前浏览器中。</p>
                 </div>
                 <div className="glass-panel p-5 space-y-2 border-white/5">
                    <h3 className="text-xs font-bold text-white/40 uppercase">系统版本</h3>
                    <p className="text-sm font-mono text-white/60">Ensemble Controller v1.2.0-STABLE</p>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

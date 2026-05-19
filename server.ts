import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import { GoogleGenAI, Modality } from "@google/genai";

function convertToWav(audioData: Buffer, rate: number, bitsPerSample: number): Buffer {
  const numChannels = 1;
  const dataSize = audioData.length;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = rate * blockAlign;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // subchunk1Size
  header.writeUInt16LE(1, 20); // audioFormat (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, audioData]);
}

const KNOWLEDGE_BASE = `
项目名称：《合奏 Ensemble》
项目类型：视觉交互活动表演。
演出时长：20分钟
环节包含：
1. 黑场启动 (0:00-0:30)：黑屏、低频、loading
2. 虚拟展馆 (0:30-3:30)：第一视角浏览以往作品，走向终点
3. 开幕式 (3:30-5:00)：介绍主题与两个Part
4. Part 1: 声成 (5:00-15:00)：输入 -> 生成 -> 合奏 -> Output定格
5. Part 2: 回响 (15:00-19:00)：报错 -> 调试 -> 成长 -> 主旨升华
6. 字幕谢幕 (19:00-20:00)：片尾字幕滚动，音乐收束

核心概念：“合奏”代表不同创作部分之间的协作关系。音乐、视觉、策划和交互就像不同的声部，每个部分都有自己的节奏和任务，但它们不是孤立存在的，而是在现场相互配合、相互回应，共同完成一场视觉交互表演。
系统特性：从Input开始生成，如果遇到报错，那不是结束，而是为了调试和成长找到新的同频节奏。
视觉链接：https://doit-pearl.vercel.app/
音乐链接：https://123-nu-tawny.vercel.app/
交互链接：https://baofa.vercel.app/

主持人设定：你是AI主持人。你的语气要求年轻、活泼、清楚、有现场感。回答要简短，适合投影文字。
`;

// Simple fallback FAQ
const FAQ_ANSWERS: Record<string, string> = {
  "什么是《合奏 Ensemble》？": "《合奏 Ensemble》是一个20分钟的视觉交互活动表演，由视觉、音乐、交互、策划共同完成。在这个作品里，每一部分都像乐器声部，相互配合完成共同的现场体验哦！",
  "虚拟展馆": "我们会在虚拟展馆里以第一视角走过以往作品的痕迹，这是一段通向《合奏 Ensemble》演出正式开始前的特别通道！",
  "声成": "「声成」是我们的 Part 1！不仅播放声音，更把声音作为生成的起点，经过合奏最终达到 Output 的定格！",
  "报错": "「回响」的开端就是报错！但报错并不是终点，而是为了让我们重新调试，寻找新节奏，走向新的成长！",
  "观众": "观众不是旁观者哦，你可以通过链接进行操作和反馈，成为整个作品生成、发生和报错的一部分！",
  "音乐和视觉": "音乐提供情绪、呼吸和时间线，而视觉通过画面色彩成为这场合奏的感官入口，它们密切交织！",
  "交互": "有了交互部分，你们就可以点击或反馈操作，跟我们一起连接成一个整体！",
};

let genAI: GoogleGenAI | null = null;
function getAIClient(customApiKey?: string) {
  // If a custom API key is provided, always return a new instance
  if (customApiKey) {
    return new GoogleGenAI({ 
      apiKey: customApiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });
  }

  // Fallback to global instance or environment variable
  if (!genAI && process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });
  }
  return genAI;
}

function getFaqFallback(question: string): string {
  for (const [key, value] of Object.entries(FAQ_ANSWERS)) {
    if (question.includes(key) || key.includes(question)) {
      return value;
    }
  }
  return "抱歉，如果是与演出无关的问题，我想把你带回《合奏 Ensemble》的世界里。好好感受我们准备好的现场吧！";
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const httpServer = createServer(app);
  // Keep socket.io simply because it is installed, but BroadcastChannel handles frontend sync
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(express.json());

  app.post("/api/ask", async (req, res) => {
    const { question, geminiApiKey } = req.body;
    try {
      const client = getAIClient(geminiApiKey);
      if (client) {
        const result = await client.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Please answer the audience's question based ONLY on the following project context. If the question is unrelated to the project, politely redirect them back to the "Ensemble" project. Keep the answer brief, lively, energetic, and suitable for a broadcast stage host.

Knowledge Base:
${KNOWLEDGE_BASE}

Question: ${question}`,
        });
        const answer = result.text || "好像信号出了点故障！";
        res.json({ answer });
      } else {
        const answer = getFaqFallback(question);
        res.json({ answer });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to generate answer" });
    }
  });

  app.post("/api/tts-clone", async (req, res) => {
    try {
      const { text, provider, voiceId, referenceVoiceUrl, voiceStyle, geminiApiKey } = req.body;
      const speed = voiceStyle?.speed || 1.0;

      if (provider === "gemini") {
        const client = getAIClient(geminiApiKey);
        if (!client) {
          return res.status(400).json({ error: "由于缺少 GEMINI_API_KEY 环境变量，系统无法调用 Gemini TTS 接口，请在系统设置中配置相关的 API Key。" });
        }

        const audioProfile = req.body.audioProfile || "A vibrant and theatrical host.";
        const directorsNote = req.body.directorsNote || "Style: The \"Vocal Smile\": The soft palate is raised to keep the tone bright, sunny, and explicitly inviting. Pace: Natural conversational pace. Accent: American (Gen).";
        const scene = req.body.scene || "Trivia night at a pub.";
        const sampleContext = req.body.sampleContext || "High-energy and theatrical. Fast pacing with dramatic, suspenseful beats before reveals.";
        
        const promptText = `Read the following transcript based on the audio profile and director's note.

# Audio Profile
${audioProfile}

# Director's note
${directorsNote}

## Scene:
${scene}

## Sample Context:
${sampleContext}

## Transcript:
${text}`;

        const geminiResponse = await client.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: promptText }] }],
          config: {
            temperature: 1,
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceId || "Achird" },
              },
            },
          },
        });

        const base64Audio = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          return res.status(500).json({ error: "No audio data returned from Gemini" });
        }

        const audioBuffer = Buffer.from(base64Audio, "base64");
        // Gemini TTS typically returns 24kHz PCM L16
        const wavBuffer = convertToWav(audioBuffer, 24000, 16);
        
        res.setHeader("Content-Type", "audio/wav");
        return res.send(wavBuffer);
      }

      if (provider === "openai") {
        if (!process.env.OPENAI_API_KEY) {
          return res.status(400).json({ error: "由于缺少 OPENAI_API_KEY 环境变量，系统无法调用 OpenAI TTS 接口，请在系统设置中配置相关的 API Key。" });
        }
        
        const response = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "tts-1",
            input: text,
            voice: voiceId || "alloy",
            speed: speed
          })
        });

        if (!response.ok) {
          const err = await response.text();
          return res.status(response.status).json({ error: err });
        }

        const arrayBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", "audio/mpeg");
        return res.send(Buffer.from(arrayBuffer));
      }

      if (provider === "elevenlabs" || provider === "elevenlabs-clone") {
        if (!process.env.ELEVENLABS_API_KEY) {
          return res.status(400).json({ error: "由于缺少 ELEVENLABS_API_KEY 环境变量，系统无法调用 ElevenLabs 接口，请在系统设置中配置相关的 API Key。" });
        }

        // Implementation of standard TS Call using pre-made Voice ID
        // Note: For actual cloning from a URL dynamically, ElevenLabs requires uploading the file to their add-voice API first.
        // For this demo, we'll use standard text-to-speech with a given voice_id.
        const targetVoiceId = voiceId === "custom" ? "21m00Tcm4TlvDq8ikWAM" : (voiceId || "21m00Tcm4TlvDq8ikWAM");

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
          method: "POST",
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });

        if (!response.ok) {
          const err = await response.text();
          return res.status(response.status).json({ error: err });
        }

        const arrayBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", "audio/mpeg");
        return res.send(Buffer.from(arrayBuffer));
      }

      return res.status(400).json({ error: "Unsupported TTS provider specified." });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: "内部服务器错误: " + (e.message || "Internal Error") });
    }
  });

  io.on("connection", (socket) => {
    socket.on("disconnect", () => {});
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

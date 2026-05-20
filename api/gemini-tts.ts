import { GoogleGenAI } from "@google/genai";

function parseAudioMimeType(mimeType: string) {
  let bitsPerSample = 16;
  let rate = 24000;

  const parts = mimeType.split(";");

  for (const param of parts) {
    const trimmed = param.trim();

    if (trimmed.toLowerCase().startsWith("rate=")) {
      const value = Number(trimmed.split("=")[1]);
      if (!Number.isNaN(value)) rate = value;
    }

    if (trimmed.includes("L16")) {
      bitsPerSample = 16;
    }
  }

  return { bitsPerSample, rate };
}

function convertToWav(audioData: Buffer, mimeType: string) {
  const { bitsPerSample, rate } = parseAudioMimeType(mimeType);
  const numChannels = 1;
  const dataSize = audioData.length;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = rate * blockAlign;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, audioData]);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, geminiApiKey } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "缺少 GEMINI_API_KEY，且未在系统设置中配置用户个人的 API Key。" });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const model =
      process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";

    const prompt = `
Read the following transcript based on the audio profile and director's note.

# Audio Profile
A vibrant and theatrical host.

# Director's note
Style: The "Vocal Smile": The tone is bright, sunny, and explicitly inviting.
Pace: Natural conversational pace.
Accent: American (Gen).

## Scene:
A live digital performance host for the project 《合奏 Ensemble》.

## Sample Context:
High-energy and theatrical. Fast pacing with dramatic, suspenseful beats before reveals.

## Transcript:
${text}
`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 1,
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Achird"
            }
          }
        }
      }
    });

    const part = response.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData?.data
    );

    if (!part?.inlineData?.data) {
      return res.status(500).json({
        error: "Gemini TTS did not return audio data"
      });
    }

    const mimeType = part.inlineData.mimeType || "audio/L16;rate=24000";
    const rawAudio = Buffer.from(part.inlineData.data, "base64");
    const wavAudio = convertToWav(rawAudio, mimeType);

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(wavAudio);
  } catch (error) {
    console.error("Gemini TTS server error:", error);

    return res.status(500).json({
      error: "Gemini TTS failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

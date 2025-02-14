import { openai } from './openai';

export class VoiceChat {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioElement: HTMLAudioElement | null = null;
  private onMessageCallback: ((event: any) => void) | null = null;
  private onSpeechEndCallback: (() => void) | null = null;
  private stream: MediaStream | null = null;
  private isProcessing: boolean = false;
  private silenceDetector: ScriptProcessorNode | null = null;
  private audioContext: AudioContext | null = null;
  private lastSpeechTime: number = Date.now();
  private isSpeaking: boolean = false;
  private hasPlayedGreeting: boolean = false;

  constructor() {
    this.audioElement = document.createElement('audio');
    this.audioElement.autoplay = true;
  }

  async connect() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.silenceDetector = this.audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(this.silenceDetector);
      this.silenceDetector.connect(this.audioContext.destination);

      this.silenceDetector.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const sum = input.reduce((acc, val) => acc + Math.abs(val), 0);
        const average = sum / input.length;
        
        const isSpeakingNow = average > 0.01;

        if (isSpeakingNow && !this.isSpeaking) {
          this.startRecording();
        }
        
        if (isSpeakingNow) {
          this.lastSpeechTime = Date.now();
        } else if (this.isSpeaking && Date.now() - this.lastSpeechTime > 1500) {
          this.stopRecording();
        }
      };

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (!this.isProcessing && this.audioChunks.length > 0) {
          this.isProcessing = true;
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          await this.processAudioInput(audioBlob);
          this.audioChunks = [];
          this.isProcessing = false;
        }
      };

      if (!this.hasPlayedGreeting) {
        await this.playGreeting();
        this.hasPlayedGreeting = true;
      }

    } catch (error) {
      console.error('Voice chat connection error:', error);
      if (error instanceof Error && error.name === 'NotAllowedError') {
        throw new Error('Microphone access denied');
      }
      throw error;
    }
  }

  private async convertToWav(audioBlob: Blob): Promise<Blob> {
    const audioContext = new AudioContext();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const wavBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(wavBuffer);
    
    // Write WAV header
    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length * 2, true);

    // Write audio data
    const channel = audioBuffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channel[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  private startRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'inactive' && !this.isProcessing) {
      this.isSpeaking = true;
      this.audioChunks = [];
      this.mediaRecorder.start(100);
    }
  }

  private stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.isSpeaking = false;
      this.mediaRecorder.stop();
    }
  }

  private async playGreeting() {
    try {
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: "Hello! I'm your AI language learning assistant. I'm here to help you practice speaking and improve your language skills. Feel free to start a conversation, ask questions about grammar, vocabulary, or pronunciation, or practice speaking about any topic you'd like to discuss."
      });

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (this.audioElement) {
        this.audioElement.src = audioUrl;
        this.audioElement.onplay = () => {
          if (this.onMessageCallback) {
            this.onMessageCallback({
              type: 'assistant',
              text: "Hello! I'm your AI language learning assistant. I'm here to help you practice speaking and improve your language skills. Feel free to start a conversation, ask questions about grammar, vocabulary, or pronunciation, or practice speaking about any topic you'd like to discuss."
            });
          }
        };
        await this.audioElement.play();
        
        this.audioElement.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (this.onSpeechEndCallback) {
            this.onSpeechEndCallback();
          }
        };
      }
    } catch (error) {
      console.error('Error playing greeting:', error);
    }
  }

  private async processAudioInput(audioBlob: Blob) {
    try {
      const wavBlob = await this.convertToWav(audioBlob);
      
      const transcription = await openai.audio.transcriptions.create({
        file: new File([wavBlob], 'audio.wav', { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      if (transcription.text.trim()) {
        if (this.onMessageCallback) {
          this.onMessageCallback({
            type: 'user',
            text: transcription.text
          });
        }

        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are a dedicated language learning assistant focused on helping users improve their language skills. Your responsibilities include:

1. Helping with grammar, vocabulary, and pronunciation
2. Engaging in natural conversations for practice
3. Providing gentle corrections when users make mistakes
4. Explaining language concepts clearly and concisely
5. Suggesting alternative phrases or expressions
6. Adapting to the user's proficiency level

Important boundaries:
- Stay focused on language learning and related topics
- Do not provide help with programming, coding, or technical questions
- Do not engage in tasks unrelated to language learning
- Keep responses natural, encouraging, and educational

If a user asks about topics unrelated to language learning, politely redirect them back to language practice.`
            },
            {
              role: "user",
              content: transcription.text
            }
          ],
          temperature: 0.7,
          max_tokens: 150
        });

        const response = completion.choices[0].message.content;

        if (response) {
          const speechResponse = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: response
          });

          const audioBlob = await speechResponse.blob();
          const audioUrl = URL.createObjectURL(audioBlob);

          if (this.audioElement) {
            this.audioElement.src = audioUrl;
            this.audioElement.onplay = () => {
              if (this.onMessageCallback) {
                this.onMessageCallback({
                  type: 'assistant',
                  text: response
                });
              }
            };
            await this.audioElement.play();
            
            this.audioElement.onended = () => {
              URL.revokeObjectURL(audioUrl);
              if (this.onSpeechEndCallback) {
                this.onSpeechEndCallback();
              }
            };
          }
        }
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      if (this.onMessageCallback) {
        this.onMessageCallback({
          type: 'error',
          text: 'Failed to process voice input. Please try again.'
        });
      }
    }
  }

  setMessageHandler(callback: (event: any) => void) {
    this.onMessageCallback = callback;
  }

  setSpeechEndCallback(callback: () => void) {
    this.onSpeechEndCallback = callback;
  }

  disconnect() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
    }

    if (this.silenceDetector) {
      this.silenceDetector.disconnect();
      this.silenceDetector = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isProcessing = false;
    this.isSpeaking = false;
    this.hasPlayedGreeting = false;
    this.onSpeechEndCallback = null;
  }
}
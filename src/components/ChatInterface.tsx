import { useState, useRef, useEffect } from 'react';
import { Mic, StopCircle } from 'lucide-react';
import { VoiceChat } from '../lib/webrtc';

type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  type: 'voice';
  created_at: string;
};

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voiceChatRef = useRef<VoiceChat | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      startVoiceChat();
    }
    return () => {
      if (voiceChatRef.current) {
        voiceChatRef.current.disconnect();
      }
    };
  }, []);

  const generateId = () => {
    return Date.now().toString() + Math.random().toString(36).substring(2, 9);
  };

  const addMessage = (content: string, role: 'user' | 'assistant') => {
    const newMessage: Message = {
      id: generateId(),
      content,
      role,
      type: 'voice',
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  };

  const startVoiceChat = async () => {
    try {
      if (!voiceChatRef.current) {
        voiceChatRef.current = new VoiceChat();
        
        voiceChatRef.current.setMessageHandler(async (event) => {
          try {
            if (event.type === 'user' || event.type === 'assistant') {
              addMessage(event.text, event.type);
              if (event.type === 'assistant') {
                setIsAISpeaking(true);
                voiceChatRef.current?.setSpeechEndCallback(() => {
                  setIsAISpeaking(false);
                });
              }
            } else if (event.type === 'error') {
              setError(event.text);
            }
          } catch (error) {
            console.error('Error handling voice message:', error);
            setError('Failed to process voice message');
          }
        });

        await voiceChatRef.current.connect();
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Error starting voice chat:', error);
      setError(
        error instanceof Error && error.message === 'Microphone access denied'
          ? 'Please allow microphone access to use voice chat'
          : 'Failed to start voice chat. Please try again.'
      );
      setIsRecording(false);
    }
  };

  const stopVoiceChat = () => {
    if (voiceChatRef.current) {
      voiceChatRef.current.disconnect();
      voiceChatRef.current = null;
    }
    setIsRecording(false);
    setIsAISpeaking(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopVoiceChat();
    } else {
      startVoiceChat();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-4xl mx-auto">
      <div className="flex-1 flex items-center justify-center relative">
        <div className="relative">
          <div
            className={`absolute inset-0 bg-blue-100 rounded-full 
              ${isRecording ? 'animate-ping opacity-75' : 'opacity-0'}`}
          />
          <div
            className={`absolute inset-0 
              ${isAISpeaking ? 'animate-pulse bg-green-100 rounded-full opacity-75' : 'opacity-0'}`}
          />
          <button
            onClick={toggleRecording}
            className={`relative z-10 p-8 rounded-full transition-all duration-300 transform hover:scale-110
              ${isRecording
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              }`}
            title={isRecording ? 'Stop voice chat' : 'Start voice chat'}
          >
            {isRecording ? (
              <StopCircle className="w-12 h-12" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </button>
        </div>

        <div className="absolute bottom-8 text-center">
          {isRecording ? (
            <p className="text-lg text-gray-700 font-medium">
              {isAISpeaking ? 'AI is speaking...' : 'Listening...'}
            </p>
          ) : (
            <p className="text-lg text-gray-600">
              Click the microphone to start a conversation
            </p>
          )}
          {error && (
            <p className="text-red-500 mt-2">{error}</p>
          )}
        </div>
      </div>

      {messages.length > 0 && (
        <div className="mt-4 border-t pt-4 max-h-60 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-2">Conversation History</h3>
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className="flex">
                <div
                  className={`px-3 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-100 mr-auto'
                      : 'bg-green-100 ml-auto'
                  }`}
                >
                  <p>{msg.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
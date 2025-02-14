import React, { useState, useRef, useEffect } from 'react';
import { Mic, StopCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { VoiceChat } from '../lib/webrtc';

type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  type: 'voice';
  created_at: string;
};

export function ChatInterface() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voiceChatRef = useRef<VoiceChat | null>(null);
  const hasInitializedRef = useRef(false);
  const currentSessionRef = useRef<string | null>(null);

  // Initialize voice chat when component mounts
  useEffect(() => {
    if (user && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      startVoiceChat();
      createNewSession();
    }
    return () => {
      if (voiceChatRef.current) {
        voiceChatRef.current.disconnect();
      }
    };
  }, [user]);

  const createNewSession = async () => {
    if (!user) return;

    try {
      const { data: session, error: sessionError } = await supabase
        .from('learning_sessions')
        .insert([
          {
            user_id: user.id,
            session_type: 'voice',
            language: 'english',
          },
        ])
        .select()
        .single();

      if (sessionError) throw sessionError;
      if (session) {
        currentSessionRef.current = session.id;
      }
    } catch (error) {
      console.error('Error creating session:', error);
      setError('Failed to start a new learning session');
    }
  };

  useEffect(() => {
    if (user) {
      loadMessages();
    }
  }, [user]);

  const loadMessages = async () => {
    if (!currentSessionRef.current) return;

    try {
      const { data } = await supabase
        .from('session_messages')
        .select('*')
        .eq('session_id', currentSessionRef.current)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data as Message[]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages. Please try refreshing the page.');
    }
  };

  const saveMessage = async (content: string, role: 'user' | 'assistant') => {
    if (!currentSessionRef.current || !user) {
      await createNewSession();
    }

    try {
      const { data: messageData, error: messageError } = await supabase
        .from('session_messages')
        .insert([
          {
            session_id: currentSessionRef.current,
            content,
            role,
            type: 'voice',
          },
        ])
        .select()
        .single();

      if (messageError) throw messageError;

      if (messageData) {
        setMessages((prev) => [...prev, messageData as Message]);
      }

      return messageData;
    } catch (error) {
      console.error('Error saving message:', error);
      setError('Failed to save message');
      throw error;
    }
  };

  const startVoiceChat = async () => {
    try {
      if (!voiceChatRef.current) {
        voiceChatRef.current = new VoiceChat();
        
        voiceChatRef.current.setMessageHandler(async (event) => {
          try {
            if (event.type === 'user' || event.type === 'assistant') {
              await saveMessage(event.text, event.type);
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
        {/* Central microphone visualization */}
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

        {/* Status text */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-lg font-medium text-gray-700">
            {isAISpeaking ? (
              <span className="flex items-center justify-center gap-2">
                AI is speaking
                <span className="flex gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </span>
            ) : isRecording ? (
              <span className="flex items-center justify-center gap-2">
                Listening
                <span className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </span>
            ) : (
              'Click the microphone to start'
            )}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="absolute top-8 left-0 right-0 mx-auto max-w-md">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg" role="alert">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Last message display */}
        {messages.length > 0 && (
          <div className="absolute top-8 left-0 right-0 mx-auto max-w-md px-4">
            <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Last message:</p>
              <p className="text-gray-700">{messages[messages.length - 1].content}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface VoicePreferences {
  voiceModeEnabled: boolean;
  setVoiceModeEnabled: (enabled: boolean) => void;
}

export const useVoiceStore = create<VoicePreferences>()(
  persist(
    (set) => ({
      voiceModeEnabled: true, // Default to true
      setVoiceModeEnabled: (enabled) => set({ voiceModeEnabled: enabled }),
    }),
    {
      name: 'voice-preferences',
    }
  )
);
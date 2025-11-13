import { Audio } from 'expo-av';

export class AudioService {
  private static instance: AudioService;
  private sound: Audio.Sound | null = null;
  private isLoaded = false;

  private constructor() {
    this.initializeAudio();
  }

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  private async initializeAudio() {
    try {
      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Load the printer connection sound
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/printer.mp3'),
        { shouldPlay: false }
      );
      
      this.sound = sound;
      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to initialize audio service:', error);
    }
  }

  public async playPrinterConnectedSound(): Promise<void> {
    try {
      if (!this.isLoaded || !this.sound) {
        console.warn('Audio service not initialized, attempting to reload...');
        await this.initializeAudio();
      }

      if (this.sound) {
        // Reset position to beginning and play
        await this.sound.setPositionAsync(0);
        await this.sound.playAsync();
      }
    } catch (error) {
      console.error('Failed to play printer connected sound:', error);
    }
  }

  public async cleanup(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
        this.isLoaded = false;
      }
    } catch (error) {
      console.error('Failed to cleanup audio service:', error);
    }
  }

  public async setVolume(volume: number): Promise<void> {
    try {
      if (this.sound && this.isLoaded) {
        await this.sound.setVolumeAsync(Math.max(0, Math.min(1, volume)));
      }
    } catch (error) {
      console.error('Failed to set volume:', error);
    }
  }
}

export default AudioService;

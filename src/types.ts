export interface ScoreConfig {
  base: number;
  creativityBonus: number;
  timeBonus: number;
}

export interface AnimationConfig {
  theme: string;
  description: string;
  javascript: string;
}

export interface CameraVerificationConfig {
  enabled: boolean;
  expectedPose: string;
  confidenceThreshold: number;
}

export interface MiniGameConfig {
  name: string;
  instructions: string;
  duration: string; // duration in seconds
}

export interface ChallengeData {
  id: string;
  language: string;
  category: string;
  mode: "Truth" | "Dare";
  difficulty: "Easy" | "Medium" | "Hard";
  title: string;
  challenge: string;
  funnyHint: string;
  estimatedTime: string;
  score: ScoreConfig;
  illustrationPrompt: string;
  animation: AnimationConfig;
  cameraVerification: CameraVerificationConfig;
  miniGame: MiniGameConfig;
  voiceSuggestions: string[];
}

export interface Player {
  id: string;
  name: string;
  score: number;
  color: string;
}

export type GameView = "setup" | "wheel" | "challenge" | "minigame" | "camera" | "leaderboard";

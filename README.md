# 🎡 TruthVerse AI

**TruthVerse AI** is an interactive, AI-powered Truth or Dare game engine featuring high-performance dynamic mechanics, immersive visuals, voice-controlled commands, and an AI companion. 

---

## 🚀 Key Features

* **🎡 Dynamic Spinning Wheel**: High-performance HTML5 Canvas custom-drawn wheel for smooth visual selections.
* **🗣️ Voice Commands**: Fully hands-free controls ("spin the wheel", "select truth", "select dare", "next", etc.) with multi-language and regional dialect voice recognition.
* **📸 Camera Assistant**: Live facial-expression scanner and interactive photo filter booth to capture players during their hilarious challenges.
* **🤖 AI Challenge Generator**: High-fidelity dynamic truth or dare prompt generation tailored to player categories with premium local fallback generators.
* **🎮 Mini-Game Playground**: Interactive quick mini-challenges to break the ice between rounds.

---

## 🛠️ How It Works

1. **Setup Players**: Enter the lobby, add your friends, and select custom profile configurations.
2. **Spin & Choose**: Spin the custom wheel to select a player, or use the voice assistant by saying **"Spin the wheel"**.
3. **Select Your Fate**: Use standard UI buttons or voice commands (**"Truth"** or **"Dare"**) to fetch a customized challenge.
4. **Complete with Camera**: Execute your challenge in front of the active **Camera Assistant** for immersive effects, filters, and dynamic gameplay.

---

## 💻 Tech Stack

* **Frontend**: React (Vite, TypeScript, Tailwind CSS, Motion animations)
* **Backend**: Node.js, Express, TypeScript (built to standalone CJS server)
* **AI Engine**: Google Gemini Pro (with local robust fallbacks)
* **Animations**: Canvas procedural math & `motion` library

---

## 🏃 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* A Gemini API Key (optional for the live AI generator)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Chethan-S-Skill/Truthverse_AI-truth-or-dare-.git
   cd Truthverse_AI-truth-or-dare-
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your Environment:
   ```bash
   cp .env.example .env
   # Add your GEMINI_API_KEY to the .env file (optional)
   ```

### Running the App
* **Development mode**:
  ```bash
  npm run dev
  ```
* **Production Build**:
  ```bash
  npm run build
  npm start
  ```

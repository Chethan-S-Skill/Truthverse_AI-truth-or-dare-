# 🎡 TruthVerse AI

**TruthVerse AI** is an interactive, AI-powered Truth or Dare game engine featuring high-performance dynamic mechanics, immersive visuals, hands-free voice commands, and an AI companion. 

Built as a lightweight, clean **Python Flask** application with a responsive **Tailwind CSS** frontend, the entire game engine runs seamlessly on all devices without requiring any complex build systems.

---

## 🚀 Key Features

* **🎡 Dynamic Spinning Wheel**: High-performance HTML5 Canvas custom-drawn wheel for smooth visual selections.
* **🗣️ Voice Commands**: Fully hands-free controls ("spin the wheel", "select truth", "select dare", "next", etc.) with multi-language and regional dialect voice recognition.
* **🤖 AI Challenge Generator**: High-fidelity dynamic truth or dare prompt generation tailored to player categories with premium local fallback generators.
* **🎮 Mini-Game Playground**: Interactive quick mini-challenges to break the ice between rounds.

---

## 💻 Tech Stack

* **Backend**: Python (Flask, Requests, Pydantic, Python-dotenv)
* **Frontend**: HTML5, Canvas Procedural Graphics, Tailwind CSS, Lucide icons, Responsive layout
* **AI Engine**: Google Gemini (via the official Google GenAI SDK with local fallbacks)

---

## 🏃 Getting Started

### Prerequisites
* [Python 3.10+](https://www.python.org/)
* A Gemini API Key (optional for the live AI generator)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Chethan-S-Skill/Truthverse_AI-truth-or-dare-.git
   cd Truthverse_AI-truth-or-dare-
   ```

2. Install Python dependencies:
   ```bash
   pip install flask requests google-genai python-dotenv pydantic
   ```

3. Configure your Environment:
   ```bash
   cp .env.example .env
   # Add your GEMINI_API_KEY to the .env file (optional)
   ```

### Running the App

Run the Flask server:
```bash
python server.py
```

Open your browser and navigate to `http://localhost:3000` to start playing!

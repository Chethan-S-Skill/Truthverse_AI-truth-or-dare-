import os
import random
import base64
from flask import Flask, request, jsonify, send_from_directory, Response, render_template
import requests
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List

# Import our lists of Truths and Dares
from questions import TRUTHS_KIDS, TRUTHS_ADULTS, DARES_KIDS, DARES_ADULTS
from translations import TRANSLATIONS, ANNOUNCEMENT_TRANSLATIONS, VOICE_COMMANDS, ANNOUNCEMENT_PHONETIC_TRANSLATIONS

load_dotenv()

app = Flask(__name__)
PORT = 3000

# Initialize Google GenAI Client
api_key = os.environ.get("GEMINI_API_KEY", "")
client = None
if api_key:
    client = genai.Client(api_key=api_key)

# History to keep track of generated challenges for zero duplication
generated_history = set()

# Pydantic schema for structured output validation
class Score(BaseModel):
    base: int
    creativityBonus: int
    timeBonus: int

class Animation(BaseModel):
    theme: str
    description: str
    javascript: str

class CameraVerification(BaseModel):
    enabled: bool
    expectedPose: str
    confidenceThreshold: float

class MiniGame(BaseModel):
    name: str
    instructions: str
    duration: str

class ChallengeResponse(BaseModel):
    id: str
    language: str
    category: str
    mode: str
    difficulty: str
    title: str
    challenge: str
    phoneticChallenge: str = ""
    funnyHint: str
    estimatedTime: str
    score: Score
    illustrationPrompt: str
    animation: Animation
    cameraVerification: CameraVerification
    miniGame: MiniGame
    voiceSuggestions: List[str]


def get_fallback_svg(prompt_text):
    lowercase_prompt = (prompt_text or "").lower()
    icon_svg = ""
    bg_color = "#020617"
    accent_color = "#3b82f6"
    
    # 1. Animal / Pets / Cute creatures
    if any(k in lowercase_prompt for k in ["penguin", "crab", "fish", "worm", "panda", "sloth", "cat", "dog", "chicken", "duck", "monkey", "lion", "animal", "dinosaur", "dino", "beast", "pet"]):
        bg_color = "#064e3b" # Deep emerald
        accent_color = "#34d399" # Bright green
        if "penguin" in lowercase_prompt:
            icon_svg = """
              <ellipse cx="100" cy="110" rx="45" ry="55" fill="#1e293b" />
              <ellipse cx="100" cy="115" rx="30" ry="40" fill="#ffffff" />
              <circle cx="85" cy="80" r="6" fill="#1e293b" />
              <circle cx="115" cy="80" r="6" fill="#1e293b" />
              <polygon points="100,85 92,95 108,95" fill="#f59e0b" />
              <ellipse cx="65" cy="110" rx="10" ry="25" fill="#1e293b" transform="rotate(-15, 65, 110)" />
              <ellipse cx="135" cy="110" rx="10" ry="25" fill="#1e293b" transform="rotate(15, 135, 110)" />
              <ellipse cx="85" cy="160" rx="15" ry="8" fill="#f59e0b" />
              <ellipse cx="115" cy="160" rx="15" ry="8" fill="#f59e0b" />
            """
        elif "chicken" in lowercase_prompt or "duck" in lowercase_prompt:
            icon_svg = """
              <circle cx="100" cy="100" r="45" fill="#f59e0b" opacity="0.2" />
              <circle cx="100" cy="100" r="35" fill="#fbbf24" />
              <circle cx="90" cy="90" r="5" fill="#111827" />
              <circle cx="110" cy="90" r="5" fill="#111827" />
              <polygon points="100,95 90,105 110,105" fill="#f97316" />
              <path d="M100,55 C105,45 115,50 100,65 Z" fill="#ef4444" />
            """
        elif "monkey" in lowercase_prompt:
            icon_svg = """
              <circle cx="100" cy="100" r="45" fill="#78350f" />
              <ellipse cx="100" cy="110" rx="35" ry="28" fill="#fde047" opacity="0.8" />
              <circle cx="60" cy="85" r="15" fill="#78350f" />
              <circle cx="140" cy="85" r="15" fill="#78350f" />
              <circle cx="85" cy="90" r="6" fill="#111827" />
              <circle cx="115" cy="90" r="6" fill="#111827" />
              <path d="M90,115 Q100,125 110,115" fill="none" stroke="#78350f" stroke-width="4" stroke-linecap="round" />
            """
        else: # Generic cute paw print
            icon_svg = f"""
              <circle cx="100" cy="115" r="30" fill="{accent_color}" />
              <circle cx="70" cy="75" r="12" fill="{accent_color}" />
              <circle cx="100" cy="60" r="14" fill="{accent_color}" />
              <circle cx="130" cy="75" r="12" fill="{accent_color}" />
            """
            
    # 2. Tech / Phone / Call / Apps / Screens
    elif any(k in lowercase_prompt for k in ["phone", "call", "alien", "gps", "message", "text", "app", "boss", "webcam", "camera", "computer", "wi-fi", "wifi"]):
        bg_color = "#1e1b4b" # Deep Indigo
        accent_color = "#818cf8" # Indigo light
        icon_svg = f"""
          <rect x="65" y="40" width="70" height="120" rx="12" fill="#312e81" stroke="{accent_color}" stroke-width="6" />
          <rect x="73" y="52" width="54" height="85" rx="6" fill="#1e1b4b" />
          <circle cx="100" cy="148" r="6" fill="{accent_color}" />
          <line x1="90" y1="46" x2="110" y2="46" stroke="{accent_color}" stroke-width="3" stroke-linecap="round" />
          <path d="M85,75 L95,85 M115,70 L105,80" stroke="{accent_color}" stroke-width="4" stroke-linecap="round" />
          <circle cx="100" cy="80" r="15" fill="{accent_color}" opacity="0.3" />
        """
        
    # 3. Singing / Music / Microphone / Sound
    elif any(k in lowercase_prompt for k in ["sing", "song", "opera", "music", "mic", "microphone", "scream", "shout", "vocal", "sound", "noise", "alphabet"]):
        bg_color = "#311042" # Deep violet
        accent_color = "#c084fc" # Purple sparkle
        icon_svg = f"""
          <line x1="100" y1="130" x2="100" y2="175" stroke="{accent_color}" stroke-width="6" stroke-linecap="round" />
          <line x1="75" y1="175" x2="125" y2="175" stroke="{accent_color}" stroke-width="6" stroke-linecap="round" />
          <rect x="88" y="75" width="24" height="60" rx="12" fill="#581c87" stroke="{accent_color}" stroke-width="4" />
          <circle cx="100" cy="65" r="22" fill="{accent_color}" />
          <circle cx="100" cy="65" r="18" fill="#ffffff" opacity="0.4" />
          <path d="M130,45 A8,8 0 0,0 125,50 L125,75 A5,5 0 1,1 120,80" fill="none" stroke="{accent_color}" stroke-width="4" stroke-linecap="round" />
          <path d="M65,55 A8,8 0 0,0 60,60 L60,85 A5,5 0 1,1 55,90" fill="none" stroke="{accent_color}" stroke-width="4" stroke-linecap="round" />
        """
        
    # 4. Dance / Active / Jumping / Run / Physical movement
    elif any(k in lowercase_prompt for k in ["dance", "dancing", "jump", "run", "hop", "active", "foot", "feet", "crab", "climb", "walk", "slow motion", "slide"]):
        bg_color = "#4c0519" # Rose dark
        accent_color = "#fb7185" # Rose light
        icon_svg = f"""
          <circle cx="100" cy="60" r="18" fill="{accent_color}" />
          <path d="M100,78 L100,115 L80,145 M100,115 L120,145" stroke="{accent_color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M65,85 Q85,100 100,90 Q115,80 135,95" fill="none" stroke="{accent_color}" stroke-width="8" stroke-linecap="round" />
          <circle cx="65" cy="55" r="4" fill="#ffffff" />
          <circle cx="135" cy="55" r="4" fill="#ffffff" />
          <circle cx="100" cy="160" r="5" fill="{accent_color}" opacity="0.4" />
        """
        
    # 5. Food / Eating / Drink / Chef
    elif any(k in lowercase_prompt for k in ["eat", "eating", "bite", "taste", "cookie", "spaghetti", "banana", "pizza", "apple", "fruit", "vegetable", "chef", "fridge", "snack", "cook"]):
        bg_color = "#451a03" # Warm brown
        accent_color = "#f97316" # Orange
        if "banana" in lowercase_prompt:
            icon_svg = """
              <path d="M140,50 C100,50 60,80 60,130 C60,145 70,155 85,155 C115,155 145,115 150,85 C152,70 148,60 140,50 Z" fill="#eab308" />
              <path d="M135,53 C105,53 72,78 72,125 Q72,143 85,143 C108,143 133,110 138,85" fill="none" stroke="#facc15" stroke-width="4" stroke-linecap="round" />
              <path d="M140,50 L146,42" stroke="#78350f" stroke-width="6" stroke-linecap="round" />
              <path d="M60,130 L55,134" stroke="#78350f" stroke-width="6" stroke-linecap="round" />
            """
        elif "cookie" in lowercase_prompt or "eat" in lowercase_prompt or "snack" in lowercase_prompt:
            icon_svg = """
              <circle cx="100" cy="100" r="50" fill="#d97706" />
              <circle cx="80" cy="80" r="6" fill="#451a03" />
              <circle cx="120" cy="85" r="7" fill="#451a03" />
              <circle cx="95" cy="115" r="6" fill="#451a03" />
              <circle cx="115" cy="120" r="5" fill="#451a03" />
              <circle cx="75" cy="110" r="7" fill="#451a03" />
              <path d="M140,70 A25,25 0 0,0 150,110 A25,25 0 0,0 130,135" fill="#451a03" stroke="#451a03" stroke-width="4" />
            """
        else: # Food bowl
            icon_svg = f"""
              <path d="M50,90 Q100,85 150,90 L135,140 Q100,150 65,140 Z" fill="#e2e8f0" stroke="{accent_color}" stroke-width="6" />
              <ellipse cx="100" cy="90" rx="45" ry="15" fill="{accent_color}" />
              <path d="M85,65 Q90,50 85,40" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
              <path d="M115,65 Q120,50 115,40" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
            """
            
    # 6. Sleep / Bed / Sleepy / Pillow
    elif any(k in lowercase_prompt for k in ["sleep", "sleepy", "bed", "pillow", "napper", "dream", "night", "room", "statue"]):
        bg_color = "#030712" # Space Black
        accent_color = "#38bdf8" # Sky blue
        icon_svg = f"""
          <path d="M130,120 A45,45 0 1,1 80,45 A45,45 0 0,0 130,120 Z" fill="{accent_color}" />
          <polygon points="65,55 67,61 73,61 69,65 71,71 65,67 59,71 61,65 57,61 63,61" fill="#ffffff" />
          <polygon points="135,45 137,51 143,51 139,55 141,61 135,57 129,61 131,55 127,51 133,51" fill="#ffffff" />
          <text x="110" y="85" font-family="sans-serif" font-weight="bold" font-size="20" fill="#fef08a">Z</text>
          <text x="125" y="65" font-family="sans-serif" font-weight="bold" font-size="14" fill="#fef08a">z</text>
          <text x="135" y="50" font-family="sans-serif" font-weight="bold" font-size="10" fill="#fef08a">z</text>
        """
        
    # 7. Superhero / Cape / Pose / Winner / Crown
    elif any(k in lowercase_prompt for k in ["superhero", "hero", "cape", "pose", "winner", "award", "trophy", "crown", "king", "queen"]):
        bg_color = "#1e1b4b"
        accent_color = "#fbbf24" # Gold yellow
        icon_svg = f"""
          <path d="M55,60 L75,60 L85,120 L65,120 Z" fill="#ef4444" opacity="0.8" />
          <path d="M145,60 L125,60 L115,120 L135,120 Z" fill="#ef4444" opacity="0.8" />
          <rect x="75" y="70" width="50" height="70" rx="10" fill="#1e3a8a" stroke="{accent_color}" stroke-width="4" />
          <circle cx="100" cy="50" r="16" fill="#fde047" />
          <polygon points="100,85 115,95 110,115 100,125 90,115 85,95" fill="{accent_color}" />
          <text x="95" y="112" font-family="sans-serif" font-weight="bold" font-size="18" fill="#1e3a8a">S</text>
        """
        
    # 8. Secret / Whisper / Talk / Speak / Voice / Truth
    elif any(k in lowercase_prompt for k in ["secret", "whisper", "talk", "speak", "voice", "gossip", "hear", "ear", "mouth", "truth"]):
        bg_color = "#0f172a"
        accent_color = "#38bdf8"
        icon_svg = f"""
          <circle cx="70" cy="110" r="25" fill="#1e293b" stroke="{accent_color}" stroke-width="4" />
          <circle cx="130" cy="110" r="25" fill="#1e293b" stroke="{accent_color}" stroke-width="4" />
          <path d="M92,105 Q100,110 108,105" fill="none" stroke="{accent_color}" stroke-width="4" stroke-linecap="round" />
          <path d="M90,95 Q100,85 110,95" fill="none" stroke="{accent_color}" stroke-width="3" stroke-linecap="round" opacity="0.6" />
          <path d="M100,80 L100,70" stroke="{accent_color}" stroke-width="4" stroke-linecap="round" />
          <circle cx="100" cy="65" r="5" fill="{accent_color}" />
        """
        
    # 9. Fire / Action / Challenge / Dare / Game Show
    elif any(k in lowercase_prompt for k in ["dare", "action", "fire", "danger", "flame", "hot", "brave", "bold", "game show"]):
        bg_color = "#1c0c0e"
        accent_color = "#ef4444"
        icon_svg = f"""
          <path d="M100,35 C115,65 140,80 140,115 C140,145 120,165 100,165 C80,165 60,145 60,115 C60,75 85,55 100,35 Z" fill="{accent_color}" opacity="0.2" />
          <path d="M100,55 C110,75 125,85 125,110 C125,130 112,145 100,145 C88,145 75,130 75,110 C75,85 90,70 100,55 Z" fill="{accent_color}" />
          <path d="M100,75 C105,88 115,95 115,110 C115,120 108,128 100,128 C92,128 85,120 85,110 C85,95 95,88 100,75 Z" fill="#ffffff" />
        """
        
    # 10. Default Spark / Star for general magic / mystery / unclassified
    else:
        bg_color = "#0b1329"
        accent_color = "#f59e0b"
        icon_svg = f"""
          <polygon points="100,30 118,70 160,73 128,102 138,145 100,122 62,145 72,102 40,73 82,70" fill="{accent_color}" opacity="0.15" />
          <polygon points="100,45 113,80 145,83 120,105 128,138 100,120 72,138 80,105 55,83 87,80" fill="{accent_color}" />
          <circle cx="100" cy="95" r="12" fill="#ffffff" />
        """
        
    svg_string = f"""
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
        <rect width="200" height="200" rx="32" fill="{bg_color}" />
        <defs>
          <radialGradient id="grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="{accent_color}" stop-opacity="0.25" />
            <stop offset="100%" stop-color="{bg_color}" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="200" height="200" rx="32" fill="url(#grad)" />
        <g stroke-linecap="round" stroke-linejoin="round">
          {icon_svg}
        </g>
      </svg>
    """.strip()
    svg_string = " ".join(svg_string.split())
    base64_encoded = base64.b64encode(svg_string.encode('utf-8')).decode('utf-8')
    return f"data:image/svg+xml;base64,{base64_encoded}"


def generate_dynamic_svg(prompt_text):
    if not client:
        return None
    try:
        system_instruction = """You are an expert SVG icon designer. Your task is to generate a beautiful, clean, modern flat-design SVG icon for a Truth or Dare game, specifically representing the given prompt.
Rules:
1. ONLY return the raw SVG code. Do not include any markdown formatting (like ```xml or ```svg), no explanation, no HTML wrapper. Just start with <svg> and end with </svg>.
2. The SVG MUST have a viewBox of "0 0 200 200" and be fully responsive.
3. Use a modern, dark aesthetic with deep, vibrant colors. Frame it with a beautiful rounded background card (rx="32") with a gradient or glowing effect.
4. The icon itself must be clean, elegant, and highly relevant to the prompt. Use simple shapes, paths, and smooth lines.
5. Ensure valid SVG syntax with self-closing tags. Do not use external resources."""
        
        user_prompt = f"Create a beautiful, simple, flat-style SVG icon for a cartoon illustration representing this action or question: {prompt_text}"
        
        print(f"[Info] Generating dynamic SVG using gemini-2.5-flash for: {prompt_text}")
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2,
            )
        )
        
        svg_code = response.text.strip()
        if "```" in svg_code:
            import re
            svg_match = re.search(r'<svg.*?</svg>', svg_code, re.DOTALL)
            if svg_match:
                svg_code = svg_match.group(0)
            else:
                lines = svg_code.split("\n")
                clean_lines = []
                for line in lines:
                    if line.strip().startswith("```"):
                        continue
                    clean_lines.append(line)
                svg_code = "\n".join(clean_lines).strip()
                
        if "<svg" in svg_code and "</svg>" in svg_code:
            base64_encoded = base64.b64encode(svg_code.encode('utf-8')).decode('utf-8')
            return f"data:image/svg+xml;base64,{base64_encoded}"
    except Exception as e:
        print(f"[Info] Dynamic SVG generation failed: {str(e)}")
    return None



def generate_fallback(mode, category, language, difficulty):
    is_kids = category in ["Kids (7-12)", "Teens (13-17)", "Family"]
    if mode == "Truth":
        source_list = TRUTHS_KIDS if is_kids else TRUTHS_ADULTS
    else:
        source_list = DARES_KIDS if is_kids else DARES_ADULTS
        
    selected_text = random.choice(source_list)
    
    if mode == "Truth":
        fallback_javascript = """
(function() {
  let stars = [];
  for (let i = 0; i < 35; i++) {
    stars.push({
      x: Math.random() * (canvas.width || 400),
      y: Math.random() * (canvas.height || 300),
      size: Math.random() * 3 + 1,
      speed: Math.random() * 0.4 + 0.1,
      color: "rgba(129, 140, 248, " + (Math.random() * 0.6 + 0.4) + ")"
    });
  }
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let s of stars) {
      s.y -= s.speed;
      if (s.y < 0) s.y = canvas.height;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
    }
    requestAnimationFrame(render);
  }
  render();
})();
        """
    else:
        fallback_javascript = """
(function() {
  let bubbles = [];
  for (let i = 0; i < 15; i++) {
    bubbles.push({
      x: Math.random() * (canvas.width || 400),
      y: Math.random() * (canvas.height || 300),
      radius: Math.random() * 20 + 10,
      speedX: (Math.random() - 0.5) * 1.5,
      speedY: -Math.random() * 1.2 - 0.3,
      color: "hsla(" + (Math.random() * 360) + ", 85%, 60%, 0.6)"
    });
  }
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let b of bubbles) {
      b.x += b.speedX;
      b.y += b.speedY;
      if (b.y < -b.radius) b.y = canvas.height + b.radius;
      if (b.x < -b.radius || b.x > canvas.width + b.radius) b.speedX *= -1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
    }
    requestAnimationFrame(render);
  }
  render();
})();
        """
        
    return {
        "id": "fallback_" + "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=9)),
        "language": language,
        "category": category,
        "mode": mode,
        "difficulty": difficulty,
        "title": "Spark of Truth" if mode == "Truth" else "Power Dare",
        "challenge": selected_text,
        "phoneticChallenge": selected_text,
        "funnyHint": "Be honest and speak clearly so everyone can hear you!" if mode == "Truth" else "Show your squad how brave you are with confidence!",
        "estimatedTime": "45 seconds",
        "score": {
            "base": 30 if difficulty == "Hard" else (20 if difficulty == "Medium" else 10),
            "creativityBonus": 5,
            "timeBonus": 5
        },
        "illustrationPrompt": f"A cute flat colorful cartoon design representing {selected_text}",
        "animation": {
            "theme": "Starlight Voyage" if mode == "Truth" else "Bouncing Bubble Wave",
            "description": f"An animated background matching your {mode} challenge.",
            "javascript": fallback_javascript.strip()
        },
        "cameraVerification": {
            "enabled": True,
            "expectedPose": "smiling",
            "confidenceThreshold": 0.75
        },
        "miniGame": {
            "name": "Burst Balloons" if mode == "Truth" else "Tap Floating Stars",
            "instructions": "Tap or click the moving objects to burst them and earn bonus points!",
            "duration": "15"
        },
        "voiceSuggestions": [
            "I completed it",
            "Give me another",
            "Change to easy"
        ]
    }


# Endpoints
@app.route("/api/challenge/generate", methods=["POST"])
def generate_challenge():
    data = request.json or {}
    mode = data.get("mode", "Truth")
    category = data.get("category", "Friends")
    language = data.get("language", "English")
    difficulty = data.get("difficulty", "Medium")
    custom_voice_intent = data.get("customVoiceIntent", "")
    
    # Determine if kids category
    is_kids = category in ["Kids (7-12)", "Teens (13-17)", "Family"]
    
    # Select question list
    if mode == "Truth":
        source_list = TRUTHS_KIDS if is_kids else TRUTHS_ADULTS
    else:
        source_list = DARES_KIDS if is_kids else DARES_ADULTS
        
    global generated_history
    available = [q for q in source_list if q not in generated_history]
    if not available:
        # Clear partition from history
        for item in source_list:
            generated_history.discard(item)
        available = source_list
        
    selected_text = ""
    if custom_voice_intent:
        keyword = custom_voice_intent.lower()
        match = next((q for q in available if keyword in q.lower()), None)
        if match:
            selected_text = match
            
    if not selected_text:
        selected_text = random.choice(available)
        
    generated_history.add(selected_text)
    
    if not client:
        print("[Info] Gemini client not configured. Local fallback active.")
        return jsonify(generate_fallback(mode, category, language, difficulty))
        
    system_instruction = f"""You are "TruthVerse AI", an advanced AI Game Engine for a high-fidelity, interactive Truth & Dare platform.
Your task is to take the provided predefined Truth/Dare question and wrap it into a fully complete, rich, unique, and safe play package.

Predefined Question/Dare to Wrap:
"{selected_text}"

Strict Safety Rules:
- Keep the challenge completely safe for children and adults alike.
- NEVER generate harmful, embarrassing, dangerous, romantic, physical, political, violent, or sensitive content.
- Dares must be indoor-friendly and physically safe. Absolutely NO running, NO jumping, NO climbing, NO eating weird items, NO breaking things, NO public prank/embarrassment, NO calling strangers, NO posting on social media.

Strict Game Engine Guidelines:
1. You MUST use the exact predefined question: "{selected_text}" as the basis of the challenge. Do NOT invent any other question, scenario, or task.
2. Support the target language exactly: English, Kannada, Hindi, Telugu, Tamil, Malayalam, Marathi, Gujarati, Bengali, Punjabi, Odia.
   - For English, you MUST set the "challenge" field to the exact string: "{selected_text}" with no changes, no additions, and no omissions.
   - For other languages, you MUST set the "challenge" field to a direct, precise, high-fidelity literal translation of "{selected_text}" with no extra fluff or modifications.
3. Animation Rule: Provide raw, clean JavaScript code for HTML5 Canvas. The canvas size will be responsive. It must use requestAnimationFrame() to loop forever and animate a scene that visually fits the challenge theme (e.g. bouncing balloon, floating stars, blinking robot, etc.).
   - The javascript code MUST be self-contained. It can assume that variables 'canvas' and 'ctx' (2D context) are already declared in the local scope.
   - Avoid creating global window variables. All variables should be inside a self-contained anonymous block or scope.
   - Limit animation code to under 200 lines. Ensure smooth performance (60 FPS).
4. Camera Verification (Dare only): Suggest physical verification details (e.g. expected pose like 'sitting', 'hands up', 'smiling', 'standing').
5. Mini Game (Dare only): Suggest a simple interactive 10-20 seconds mini game that the user can play on-screen (e.g., 'Tap floating stars', 'Burst balloons', 'Catch bouncing emojis'). Provide clear instructions in the selected language.
6. Scoring:
   - Easy: 10 points
   - Medium: 20 points
   - Hard: 30 points
   - Creativity Bonus: +5 points
   - Speed Bonus: +5 points
7. Phonetic Challenge Guideline (Crucial):
   - For English, set "phoneticChallenge" to the exact string: "{selected_text}".
   - For all other languages, you MUST provide a high-quality phonetic Latin transliteration (Romanized / English spelling using standard Latin/English alphabet) of the translated challenge. This is used by the screen reader voice assistant to read the challenge correctly if a native voice pack is not installed on the user's browser/OS.
     - Example Hindi: 'अपने सिर पर एक पुस्तक रखकर १० सेकंड के लिए चलें' -> 'Apne sir par ek pustak rakhkar das second ke liye chalein'
     - Example Kannada: 'ನಿಮ್ಮ ತಲೆಯ ಮೇಲೆ ಪುಸ್ತಕವನ್ನಿಟ್ಟುಕೊಂಡು ೧೦ ಸೆಕೆಂಡುಗಳ ಕಾಲ ನಡೆದಾಡಿ' -> 'Nimma thaleya mele pusthakavannittukondu hatthu secondugala kaala nadedaadi'
"""

    user_prompt = f"""Wrap the predefined question "{selected_text}" into a premium challenge package with:
- Mode: {mode}
- Category: {category}
- Language: {language}
- Difficulty: {difficulty}

Remember:
- For English, the challenge and phoneticChallenge fields in the JSON MUST be exactly: "{selected_text}".
- For other languages, return the precise direct translation of "{selected_text}" in "challenge" and a phonetic Romanized transliteration in "phoneticChallenge".
- Return JSON strictly following the required schema.
- The javascript animation code must render on a HTML5 canvas. It should draw a beautiful, fun cartoon theme matching the challenge, and must run a render loop using requestAnimationFrame."""

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1,
                response_mime_type="application/json",
                response_schema=ChallengeResponse
            )
        )
        
        challenge_data = ChallengeResponse.model_validate_json(response.text).model_dump()
        
        # Override to be absolutely certain we use exact selected_text for English
        if not challenge_data.get("challenge") or language.lower() in ["english", "en"]:
            challenge_data["challenge"] = selected_text
        if not challenge_data.get("phoneticChallenge") or language.lower() in ["english", "en"]:
            challenge_data["phoneticChallenge"] = selected_text
            
        return jsonify(challenge_data)
    except Exception as e:
        print(f"[Info] Gemini API invocation failed: {str(e)}. Falling back locally.")
        fallback_data = generate_fallback(mode, category, language, difficulty)
        fallback_data["challenge"] = selected_text
        return jsonify(fallback_data)


@app.route("/api/challenge/generate-image", methods=["POST"])
def generate_image():
    data = request.json or {}
    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400
        
    if not client:
        print("[Info] Gemini client not configured. Falling back to SVG generator.")
        return jsonify({"imageUrl": get_fallback_svg(prompt), "isFallback": True})
        
    try:
        # Try high-quality Imagen 3 model first via generate_images
        print(f"[Info] Generating image using imagen-3.0-generate-002 for: {prompt}")
        result = client.models.generate_images(
            model='imagen-3.0-generate-002',
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="1:1",
                output_mime_type="image/jpeg"
            )
        )
        if result.generated_images:
            image_bytes = result.generated_images[0].image.image_bytes
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            print("[Info] Successfully generated image via imagen-3.0-generate-002")
            return jsonify({"imageUrl": f"data:image/jpeg;base64,{base64_image}"})
            
    except Exception as e1:
        print(f"[Info] Imagen 3 generation failed: {str(e1)}. Trying dynamic SVG generation via Gemini 2.5 Flash as second layer...")
        
    try:
        # Try dynamic SVG generation as high-fidelity vector fallback
        svg_url = generate_dynamic_svg(prompt)
        if svg_url:
            print("[Info] Successfully generated custom dynamic SVG via gemini-2.5-flash")
            return jsonify({"imageUrl": svg_url})
            
    except Exception as e2:
        print(f"[Info] Dynamic SVG generation failed: {str(e2)}. Falling back to local graphics engine...")
        
    # Return custom procedural SVG as safe final fallback
    print("[Info] Handled illustration request with custom graphics engine fallback.")
    return jsonify({"imageUrl": get_fallback_svg(prompt), "isFallback": True})


@app.route("/api/config/translations")
def get_translations_config():
    return jsonify({
        "TRANSLATIONS": TRANSLATIONS,
        "ANNOUNCEMENT_TRANSLATIONS": ANNOUNCEMENT_TRANSLATIONS,
        "VOICE_COMMANDS": VOICE_COMMANDS,
        "ANNOUNCEMENT_PHONETIC_TRANSLATIONS": ANNOUNCEMENT_PHONETIC_TRANSLATIONS
    })


# Render the single-page application template
@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=True)

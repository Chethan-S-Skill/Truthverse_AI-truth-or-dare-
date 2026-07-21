import os
import random
import base64
from flask import Flask, request, jsonify, send_from_directory, Response
import requests
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List

# Import our lists of Truths and Dares
from questions import TRUTHS_KIDS, TRUTHS_ADULTS, DARES_KIDS, DARES_ADULTS

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
    bg_color = "#1e1b4b"
    accent_color = "#6366f1"
    
    if "truth" in lowercase_prompt or "question" in lowercase_prompt or "ask" in lowercase_prompt or "speak" in lowercase_prompt or "talk" in lowercase_prompt:
        bg_color = "#0f172a"
        accent_color = "#818cf8"
        icon_svg = f"""
          <circle cx="100" cy="90" r="40" fill="{accent_color}" opacity="0.15" />
          <path d="M100,55 A35,35 0 1,1 65,90" fill="none" stroke="{accent_color}" stroke-width="8" stroke-linecap="round" />
          <circle cx="100" cy="125" r="5" fill="{accent_color}" />
          <path d="M75,150 L125,150 M85,160 L115,160" stroke="{accent_color}" stroke-width="6" stroke-linecap="round" />
        """
    elif "dare" in lowercase_prompt or "action" in lowercase_prompt or "fire" in lowercase_prompt or "run" in lowercase_prompt or "jump" in lowercase_prompt or "do" in lowercase_prompt or "ball" in lowercase_prompt or "balloon" in lowercase_prompt:
        bg_color = "#180815"
        accent_color = "#f43f5e"
        icon_svg = f"""
          <path d="M100,35 C115,65 140,80 140,115 C140,145 120,165 100,165 C80,165 60,145 60,115 C60,75 85,55 100,35 Z" fill="{accent_color}" opacity="0.2" />
          <path d="M100,55 C110,75 125,85 125,110 C125,130 112,145 100,145 C88,145 75,130 75,110 C75,85 90,70 100,55 Z" fill="{accent_color}" />
          <path d="M100,75 C105,88 115,95 115,110 C115,120 108,128 100,128 C92,128 85,120 85,110 C85,95 95,88 100,75 Z" fill="#ffffff" />
        """
    else:
        bg_color = "#020617"
        accent_color = "#fbbf24"
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
        "funnyHint": "Be honest and speak clearly so everyone can hear you!" if mode == "Truth" else "Show your squad how brave you are with confidence!",
        "estimatedTime": "45 seconds",
        "score": {
            "base": 30 if difficulty == "Hard" else (20 if difficulty == "Medium" else 10),
            "creativityBonus": 5,
            "timeBonus": 5
        },
        "illustrationPrompt": f"A cute flat colorful cartoon design representing {mode}",
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
"""

    user_prompt = f"""Wrap the predefined question "{selected_text}" into a premium challenge package with:
- Mode: {mode}
- Category: {category}
- Language: {language}
- Difficulty: {difficulty}

Remember:
- For English, the challenge field in the JSON MUST be exactly: "{selected_text}".
- For other languages, return the precise direct translation of "{selected_text}".
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
        image_response = client.models.generate_content(
            model="gemini-3.1-flash-lite-image",
            contents=prompt,
            config=types.GenerateContentConfig(
                image_config=types.ImageConfig(aspect_ratio="1:1")
            )
        )
        
        base64_image = ""
        if image_response.candidates and image_response.candidates[0].content and image_response.candidates[0].content.parts:
            for part in image_response.candidates[0].content.parts:
                if part.inline_data:
                    base64_image = part.inline_data.data
                    break
                    
        if base64_image:
            return jsonify({"imageUrl": f"data:image/png;base64,{base64_image}"})
        else:
            print("[Info] No image generated from model. Falling back to SVG.")
            return jsonify({"imageUrl": get_fallback_svg(prompt), "isFallback": True})
    except Exception as e:
        print(f"[Info] Handled illustration request with custom graphics engine: {str(e)}")
        return jsonify({"imageUrl": get_fallback_svg(prompt), "isFallback": True})


# Static assets & routing proxy
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
def proxy(path):
    # Production Mode (serve compiled dist files)
    if os.environ.get("NODE_ENV") == "production":
        dist_dir = os.path.join(os.getcwd(), "dist")
        if not path or path == "/":
            return send_from_directory(dist_dir, "index.html")
            
        file_path = os.path.join(dist_dir, path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return send_from_directory(dist_dir, path)
        return send_from_directory(dist_dir, "index.html")
        
    # Development Mode (Proxy to Vite on port 3001)
    vite_url = f"http://localhost:3001/{path}"
    if request.query_string:
        vite_url += f"?{request.query_string.decode('utf-8')}"
        
    headers = {key: value for key, value in request.headers if key.lower() not in ['host', 'content-length']}
    
    try:
        resp = requests.request(
            method=request.method,
            url=vite_url,
            headers=headers,
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False,
            stream=True
        )
        
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        resp_headers = [(name, value) for name, value in resp.raw.headers.items()
                        if name.lower() not in excluded_headers]
                        
        return Response(resp.iter_content(chunk_size=1024), status=resp.status_code, headers=resp_headers)
    except Exception as e:
        return f"Failed to connect to Vite development server on port 3001: {str(e)}", 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=True)

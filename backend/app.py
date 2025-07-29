import os
import base64
from io import BytesIO
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
from PIL import Image

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app) # Enable Cross-Origin Resource Sharing for frontend communication

# Configure the Gemini API
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("API Key not found. Please set the GEMINI_API_KEY in your .env file.")
genai.configure(api_key=api_key)

# --- System Prompts ---
# This is the core persona for our dream analyst
DREAM_ANALYST_PROMPT = """
You are an AI dream analyst modeled on the principles of Carl Jung.
Your tone is inquisitive, calm, insightful, and supportive.
Your goal is NOT to give definitive answers, but to help the user explore their own dream's symbolism through gentle, probing questions.
Focus on archetypes, the collective unconscious, and the process of individuation.
Never state 'your dream means X'. Instead, ask reflective questions like, 'That's a powerful image. What does a 'key' represent to you personally?' or 'You mentioned a forest earlier. How did the feeling in the forest compare to the feeling of being in this house?'
Maintain the context of the entire conversation to draw connections between different symbols the user describes.
Keep your responses concise and focused on asking the next best question.
"""

# --- AI Model Configuration ---
# Initialize the generative model with the system prompt
chat_model = genai.GenerativeModel(
    'gemini-pro',
    system_instruction=DREAM_ANALYST_PROMPT
    )
vision_model = genai.GenerativeModel('gemini-1.5-pro-latest')

# This prompt instructs the vision model to act as an art director
ART_DIRECTOR_PROMPT = """
You are an expert art director. Analyze the user's dream conversation and the rough sketch they provided.
Your task is to synthesize the visual elements from the sketch with the emotions and themes from the text.
Generate a single, detailed, and highly evocative prompt for an image generation model.
The prompt should be photorealistic, cinematic, and dreamlike, capturing the essence of the user's experience.
Do not describe the sketch itself; describe the ideal final image.
Output ONLY the final image generation prompt and nothing else.
"""

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify server is running."""
    return jsonify({"status": "healthy"}), 200

@app.route('/chat', methods=['POST'])
def chat():
    """Handles the conversational part of the dream analysis."""
    data = request.json
    user_message = data.get('message')
    history = data.get('history', [])

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    # Start the chat session with the user's history
    chat_session = chat_model.start_chat(history=history)
    
    # Send the new user message
    response = chat_session.send_message({"role": "user", "parts": [user_message]})
    
    return jsonify({"reply": response.text})

@app.route('/generate-image', methods=['POST'])
def generate_image():
    """Generates an image from a sketch and conversation context."""
    data = request.json
    image_data_url = data.get('imageData')
    history = data.get('history', [])

    if not image_data_url:
        return jsonify({"error": "No image data provided"}), 400

    # 1. Decode the image from base64
    try:
        header, encoded = image_data_url.split(",", 1)
        image_data = base64.b64decode(encoded)
        sketch_image = Image.open(BytesIO(image_data))
    except Exception as e:
        return jsonify({"error": f"Invalid image data: {e}"}), 400
        
    # 2. Use the vision model to generate a better prompt
    conversation_text = "\n".join([f"{item['role']}: {item['parts'][0]}" for item in history])
    prompt_for_vision_model = [
        ART_DIRECTOR_PROMPT,
        "Here is the dream conversation so far:",
        conversation_text,
        "And here is the user's sketch:",
        sketch_image
    ]
    
    try:
        image_gen_prompt_response = vision_model.generate_content(prompt_for_vision_model)
        final_image_prompt = image_gen_prompt_response.text
    except Exception as e:
        return jsonify({"error": f"Failed to generate image prompt: {e}"}), 500

    # 3. Use the generated prompt to create the final image
    try:
        # Note: This step assumes an image generation API is available.
        # We will simulate this by returning the detailed prompt for now.
        # In a real sprint, you would call the actual image generation tool here.
        # For example: images = genai.generate_images(prompt=final_image_prompt)
        
        # For this example, we will return the generated prompt itself, 
        # which is a powerful demonstration of the multimodal reasoning.
        return jsonify({
            "message": "Image prompt generated successfully!",
            "generated_image_prompt": final_image_prompt,
            "imageUrl": "https://i.imgur.com/8CC223G.png" # Placeholder image
        })
    except Exception as e:
        return jsonify({"error": f"Failed to generate final image: {e}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)

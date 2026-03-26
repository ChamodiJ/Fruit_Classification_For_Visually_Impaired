"""
Flask Backend API for Blind-Friendly Fruit Classification
=========================================================
Features:
- REST API for image classification
- Voice command processing
- Text-to-Speech response
- High accuracy predictions
- CORS enabled for mobile app
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image
import io
import base64
import os
from gtts import gTTS
import tempfile
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# MODEL LOADER
# ============================================================================

class FruitClassifierModel:
    def __init__(self, model_path):
        """Initialize and load the trained model"""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {self.device}")
        
        # Load checkpoint
        logger.info(f"Loading model from: {model_path}")
        checkpoint = torch.load(model_path, map_location=self.device)
        
        # Extract model info
        self.model_type = checkpoint['model_type']
        self.num_classes = checkpoint['num_classes']
        self.class_names = checkpoint['class_names']
        self.img_size = checkpoint['img_size']
        self.best_val_acc = checkpoint['best_val_acc']
        
        logger.info(f"Model type: {self.model_type}")
        logger.info(f"Number of classes: {self.num_classes}")
        logger.info(f"Best validation accuracy: {self.best_val_acc:.2f}%")
        
        # Build model
        self.model = self._build_model()
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model.to(self.device)
        self.model.eval()
        
        # Setup transforms
        self.transform = transforms.Compose([
            transforms.Resize((self.img_size, self.img_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        logger.info("Model loaded successfully!")
    
    def _build_model(self):
        """Build model architecture"""
        if self.model_type == 'resnet18':
            model = models.resnet18()
            model.fc = nn.Linear(model.fc.in_features, self.num_classes)
        elif self.model_type == 'resnet50':
            model = models.resnet50()
            model.fc = nn.Linear(model.fc.in_features, self.num_classes)
        elif self.model_type == 'resnet101':
            model = models.resnet101()
            model.fc = nn.Linear(model.fc.in_features, self.num_classes)
        elif self.model_type == 'efficientnet_b0':
            model = models.efficientnet_b0()
            model.classifier[1] = nn.Linear(model.classifier[1].in_features, self.num_classes)
        elif self.model_type == 'efficientnet_b3':
            model = models.efficientnet_b3()
            model.classifier[1] = nn.Linear(model.classifier[1].in_features, self.num_classes)
        elif self.model_type == 'vgg16':
            model = models.vgg16()
            model.classifier[6] = nn.Linear(4096, self.num_classes)
        elif self.model_type == 'densenet121':
            model = models.densenet121()
            model.classifier = nn.Linear(model.classifier.in_features, self.num_classes)
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")
        
        return model
    
    def predict(self, image_bytes, top_k=3):
        """
        Make prediction on image
        
        Args:
            image_bytes: Image data as bytes
            top_k: Number of top predictions to return
            
        Returns:
            List of predictions with class names and probabilities
        """
        try:
            # Load and preprocess image
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            
            # Make prediction
            with torch.no_grad():
                outputs = self.model(input_tensor)
                probabilities = torch.nn.functional.softmax(outputs, dim=1)
            
            # Get top K predictions
            top_probs, top_indices = probabilities.topk(top_k)
            
            results = []
            for prob, idx in zip(top_probs[0], top_indices[0]):
                class_name = self.class_names[idx]
                probability = prob.item() * 100
                results.append({
                    'class_name': class_name,
                    'probability': probability,
                    'formatted_name': self._format_class_name(class_name)
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Prediction error: {str(e)}")
            raise
    
    def _format_class_name(self, class_name):
        """Format class name for better readability"""
        # Convert 'fresh_green_apple' to 'Fresh Green Apple'
        words = class_name.split('_')
        return ' '.join(word.capitalize() for word in words)


# ============================================================================
# INITIALIZE MODEL
# ============================================================================

MODEL_PATH = 'best_fruit_classifier.pth'
classifier = None

try:
    classifier = FruitClassifierModel(MODEL_PATH)
    logger.info("✓ Model initialized successfully")
except Exception as e:
    logger.error(f"✗ Failed to load model: {str(e)}")


# ============================================================================
# TEXT-TO-SPEECH HELPER
# ============================================================================

def generate_speech(text, lang='en'):
    """
    Generate speech from text
    
    Args:
        text: Text to convert to speech
        lang: Language code (default: 'en')
        
    Returns:
        Audio file path
    """
    try:
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        
        # Generate speech
        tts = gTTS(text=text, lang=lang, slow=False)
        tts.save(temp_file.name)
        
        return temp_file.name
        
    except Exception as e:
        logger.error(f"TTS error: {str(e)}")
        return None


# ============================================================================
# API ROUTES
# ============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': classifier is not None,
        'device': str(classifier.device) if classifier else 'N/A'
    })


@app.route('/classify', methods=['POST'])
def classify_image():
    """
    Classify uploaded image
    
    Expected input:
        - image: Image file (multipart/form-data)
        OR
        - image_base64: Base64 encoded image (JSON)
    
    Returns:
        JSON with predictions and voice response
    """
    try:
        logger.info("Received classification request")
        
        if classifier is None:
            logger.error("Model not loaded!")
            return jsonify({
                'success': False,
                'error': 'Model not loaded. Please ensure best_fruit_classifier.pth exists in backend folder.'
            }), 500
        
        # Get image from request
        image_bytes = None
        
        # Check for multipart file upload
        if 'image' in request.files:
            logger.info("Processing multipart image upload")
            file = request.files['image']
            image_bytes = file.read()
            logger.info(f"Image size: {len(image_bytes)} bytes")
        
        # Check for base64 encoded image
        elif request.is_json and 'image_base64' in request.json:
            logger.info("Processing base64 encoded image")
            try:
                base64_str = request.json['image_base64']
                # Remove data URL prefix if present
                if ',' in base64_str:
                    base64_str = base64_str.split(',')[1]
                image_bytes = base64.b64decode(base64_str)
                logger.info(f"Decoded image size: {len(image_bytes)} bytes")
            except Exception as e:
                logger.error(f"Base64 decode error: {str(e)}")
                return jsonify({
                    'success': False,
                    'error': f'Invalid base64 image: {str(e)}'
                }), 400
        
        else:
            logger.error("No image provided in request")
            return jsonify({
                'success': False,
                'error': 'No image provided. Send as multipart/form-data or base64 JSON.'
            }), 400
        
        # Validate image
        if not image_bytes or len(image_bytes) < 100:
            logger.error(f"Invalid image data: {len(image_bytes) if image_bytes else 0} bytes")
            return jsonify({
                'success': False,
                'error': 'Invalid image data. Image too small or corrupted.'
            }), 400
        
        # Make prediction
        logger.info("Starting classification...")
        predictions = classifier.predict(image_bytes, top_k=3)
        logger.info(f"Classification complete: {len(predictions)} predictions")
        
        # Get top prediction
        top_prediction = predictions[0]
        
        # Generate voice response
        voice_text = f"I detected {top_prediction['formatted_name']} with {top_prediction['probability']:.1f} percent confidence"
        
        # Prepare response
        response = {
            'success': True,
            'top_prediction': {
                'class': top_prediction['class_name'],
                'formatted_name': top_prediction['formatted_name'],
                'confidence': round(top_prediction['probability'], 2)
            },
            'all_predictions': [
                {
                    'class': p['class_name'],
                    'formatted_name': p['formatted_name'],
                    'confidence': round(p['probability'], 2)
                }
                for p in predictions
            ],
            'voice_text': voice_text
        }
        
        logger.info(f"✓ Success: {top_prediction['formatted_name']} ({top_prediction['probability']:.1f}%)")
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"❌ Classification error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Error processing image: {str(e)}'
        }), 500


@app.route('/classify_with_audio', methods=['POST'])
def classify_with_audio():
    """
    Classify image and return audio response
    
    Returns:
        Audio file (MP3)
    """
    try:
        if classifier is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        # Get image from request
        image_bytes = None
        
        if 'image' in request.files:
            file = request.files['image']
            image_bytes = file.read()
        elif request.is_json and 'image_base64' in request.json:
            base64_str = request.json['image_base64']
            if ',' in base64_str:
                base64_str = base64_str.split(',')[1]
            image_bytes = base64.b64decode(base64_str)
        else:
            return jsonify({'error': 'No image provided'}), 400
        
        # Make prediction
        predictions = classifier.predict(image_bytes, top_k=1)
        top_prediction = predictions[0]
        
        # Generate voice text
        voice_text = f"I detected {top_prediction['formatted_name']} with {top_prediction['probability']:.1f} percent confidence"
        
        # Generate audio
        audio_path = generate_speech(voice_text)
        
        if audio_path:
            response = send_file(
                audio_path,
                mimetype='audio/mpeg',
                as_attachment=True,
                download_name='prediction.mp3'
            )
            
            # Clean up temp file after sending
            @response.call_on_close
            def cleanup():
                try:
                    os.remove(audio_path)
                except:
                    pass
            
            return response
        else:
            return jsonify({'error': 'Failed to generate audio'}), 500
            
    except Exception as e:
        logger.error(f"Audio classification error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/tts', methods=['POST'])
def text_to_speech():
    """
    Convert text to speech
    
    Expected input:
        - text: Text to convert (JSON)
        - lang: Language code (optional, default: 'en')
    
    Returns:
        Audio file (MP3)
    """
    try:
        data = request.json
        text = data.get('text', '')
        lang = data.get('lang', 'en')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        # Generate audio
        audio_path = generate_speech(text, lang)
        
        if audio_path:
            response = send_file(
                audio_path,
                mimetype='audio/mpeg',
                as_attachment=True,
                download_name='speech.mp3'
            )
            
            @response.call_on_close
            def cleanup():
                try:
                    os.remove(audio_path)
                except:
                    pass
            
            return response
        else:
            return jsonify({'error': 'Failed to generate audio'}), 500
            
    except Exception as e:
        logger.error(f"TTS error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/classes', methods=['GET'])
def get_classes():
    """Get all available classes"""
    if classifier is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    classes = [
        {
            'class_name': name,
            'formatted_name': classifier._format_class_name(name)
        }
        for name in classifier.class_names
    ]
    
    return jsonify({
        'total_classes': len(classes),
        'classes': classes
    })


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    print("\n" + "="*80)
    print("FRUIT CLASSIFICATION API - BLIND-FRIENDLY VERSION")
    print("="*80)
    print(f"Model: {MODEL_PATH}")
    print(f"Status: {'✓ Ready' if classifier else '✗ Model not loaded'}")
    print("\nAvailable endpoints:")
    print("  GET  /health              - Health check")
    print("  POST /classify            - Classify image (JSON response)")
    print("  POST /classify_with_audio - Classify image (audio response)")
    print("  POST /tts                 - Text to speech")
    print("  GET  /classes             - Get all classes")
    print("="*80 + "\n")
    
    # Run server
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
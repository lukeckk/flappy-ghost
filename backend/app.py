from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import logging
from datetime import datetime
import re
# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor

# Initialize OpenTelemetry
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

# Configure OTLP exporter (replaces deprecated Jaeger exporter)
otel_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
if otel_endpoint:
    try:
        # Production: Use OTEL collector
        otlp_exporter = OTLPSpanExporter(
            endpoint=otel_endpoint,
            insecure=True
        )
        span_processor = BatchSpanProcessor(otlp_exporter)
        trace.get_tracer_provider().add_span_processor(span_processor)
        logger.info(f"OTLP exporter configured for {otel_endpoint}")
    except Exception as e:
        logger.warning(f"OTLP exporter failed, using console: {e}")
        console_exporter = ConsoleSpanExporter()
        span_processor = BatchSpanProcessor(console_exporter)
        trace.get_tracer_provider().add_span_processor(span_processor)
else:
    # Development: Use console exporter (no warnings)
    console_exporter = ConsoleSpanExporter()
    span_processor = BatchSpanProcessor(console_exporter)
    trace.get_tracer_provider().add_span_processor(span_processor)
    logger.info("Using console exporter for development")

app = Flask(__name__)
CORS(app)

# Instrument Flask app
FlaskInstrumentor().instrument_app(app)
RequestsInstrumentor().instrument()

# Data file path - use persistent volume in Kubernetes
import os
DATA_DIR = os.getenv('DATA_DIR', '/app/data')
SCORES_FILE = os.path.join(DATA_DIR, 'scores.json')
TELEMETRY_FILE = os.path.join(DATA_DIR, 'telemetry.json')

# Ensure data directory exists (with error handling for read-only filesystems)
try:
    os.makedirs(DATA_DIR, exist_ok=True)
except OSError as e:
    if e.errno == 30:  # Read-only file system
        logger.warning(f"Cannot create data directory {DATA_DIR}: read-only filesystem. Using /tmp instead.")
        DATA_DIR = '/tmp/flappy-kiro-data'
        SCORES_FILE = os.path.join(DATA_DIR, 'scores.json')
        TELEMETRY_FILE = os.path.join(DATA_DIR, 'telemetry.json')
        os.makedirs(DATA_DIR, exist_ok=True)
    else:
        raise

class ScoreManager:
    def __init__(self, filename):
        self.filename = filename
        self.scores = self.load_scores()
    
    def load_scores(self):
        """Load scores from JSON file"""
        with tracer.start_as_current_span("load_scores") as span:
            try:
                if os.path.exists(self.filename):
                    with open(self.filename, 'r') as f:
                        scores = json.load(f)
                        span.set_attribute("scores_loaded", len(scores))
                        logger.info(f"Loaded {len(scores)} scores from {self.filename}")
                        return scores
                else:
                    logger.info(f"No existing scores file found, starting fresh")
                    return []
            except Exception as e:
                logger.error(f"Error loading scores: {e}")
                span.record_exception(e)
                return []
    
    def save_scores(self):
        """Save scores to JSON file"""
        with tracer.start_as_current_span("save_scores") as span:
            try:
                with open(self.filename, 'w') as f:
                    json.dump(self.scores, f, indent=2)
                span.set_attribute("scores_saved", len(self.scores))
                logger.info(f"Saved {len(self.scores)} scores to {self.filename}")
            except Exception as e:
                logger.error(f"Error saving scores: {e}")
                span.record_exception(e)
                raise
    
    def add_score(self, username, score, difficulty):
        """Add a new score and maintain sorted order"""
        with tracer.start_as_current_span("add_score") as span:
            span.set_attributes({
                "username": username,
                "score": score,
                "difficulty": difficulty
            })
            
            new_score = {
                'username': username,
                'score': score,
                'difficulty': difficulty,
                'timestamp': datetime.now().isoformat()
            }
            
            self.scores.append(new_score)
            # Sort by score (descending), then by timestamp (ascending for ties)
            self.scores.sort(key=lambda x: (-x['score'], x['timestamp']))
            
            # Keep only top 100 scores
            self.scores = self.scores[:100]
            
            self.save_scores()
            logger.info(f"Added score: {username} - {score} ({difficulty})")
            
            return new_score
    
    def get_leaderboard(self, limit=50):
        """Get top scores for leaderboard"""
        with tracer.start_as_current_span("get_leaderboard") as span:
            leaderboard = self.scores[:limit]
            span.set_attribute("leaderboard_size", len(leaderboard))
            return leaderboard

class TelemetryManager:
    def __init__(self, filename):
        self.filename = filename
    
    def log_event(self, event_data):
        """Log telemetry event"""
        with tracer.start_as_current_span("log_telemetry") as span:
            try:
                # Add server timestamp
                event_data['server_timestamp'] = datetime.now().isoformat()
                
                # Load existing events
                events = []
                if os.path.exists(self.filename):
                    with open(self.filename, 'r') as f:
                        events = json.load(f)
                
                events.append(event_data)
                
                # Keep only last 10000 events to prevent file from growing too large
                events = events[-10000:]
                
                # Save back to file
                with open(self.filename, 'w') as f:
                    json.dump(events, f, indent=2)
                
                span.set_attributes({
                    "event_name": event_data.get('eventName', 'unknown'),
                    "session_id": event_data.get('sessionId', 'unknown')
                })
                
                logger.info(f"Logged telemetry event: {event_data.get('eventName')}")
                
            except Exception as e:
                logger.error(f"Error logging telemetry: {e}")
                span.record_exception(e)

# Initialize managers
score_manager = ScoreManager(SCORES_FILE)
telemetry_manager = TelemetryManager(TELEMETRY_FILE)

def validate_username(username):
    """Validate username according to rules"""
    if not username or len(username) < 2 or len(username) > 20:
        return False, "Username must be 2-20 characters long"
    
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        return False, "Username can only contain letters, numbers, underscores, and hyphens"
    
    # Check for inappropriate content
    inappropriate_words = ['admin', 'root', 'test', 'null', 'undefined', 'bot', 'fuck', 'shit', 'damn']
    username_lower = username.lower()
    for word in inappropriate_words:
        if word in username_lower:
            return False, "Username contains inappropriate content"
    
    return True, "Valid"

@app.route('/')
def serve_frontend():
    """Serve the main HTML file"""
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory('../frontend', filename)

@app.route('/api/scores', methods=['GET'])
def get_scores():
    """Get leaderboard scores"""
    with tracer.start_as_current_span("api_get_scores"):
        try:
            scores = score_manager.get_leaderboard()
            logger.info(f"Retrieved {len(scores)} scores for leaderboard")
            return jsonify(scores)
        except Exception as e:
            logger.error(f"Error retrieving scores: {e}")
            return jsonify({'error': 'Failed to retrieve scores'}), 500

@app.route('/api/scores', methods=['POST'])
def submit_score():
    """Submit a new score"""
    with tracer.start_as_current_span("api_submit_score") as span:
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            username = data.get('username', '').strip()
            score = data.get('score')
            difficulty = data.get('difficulty', '').lower()
            
            # Validate input
            if not username or score is None or not difficulty:
                return jsonify({'error': 'Missing required fields'}), 400
            
            # Validate username
            is_valid, message = validate_username(username)
            if not is_valid:
                return jsonify({'error': message}), 400
            
            # Validate score
            if not isinstance(score, int) or score < 0:
                return jsonify({'error': 'Invalid score'}), 400
            
            # Validate difficulty
            if difficulty not in ['easy', 'medium', 'hard']:
                return jsonify({'error': 'Invalid difficulty'}), 400
            
            span.set_attributes({
                "username": username,
                "score": score,
                "difficulty": difficulty
            })
            
            # Add score
            new_score = score_manager.add_score(username, score, difficulty)
            
            logger.info(f"Score submitted successfully: {username} - {score}")
            return jsonify({
                'message': 'Score submitted successfully',
                'score': new_score
            }), 201
            
        except Exception as e:
            logger.error(f"Error submitting score: {e}")
            span.record_exception(e)
            return jsonify({'error': 'Failed to submit score'}), 500

@app.route('/api/telemetry', methods=['POST'])
def log_telemetry():
    """Log telemetry data"""
    with tracer.start_as_current_span("api_log_telemetry"):
        try:
            event_data = request.get_json()
            if event_data:
                telemetry_manager.log_event(event_data)
                return jsonify({'status': 'logged'}), 200
            else:
                return jsonify({'error': 'No data provided'}), 400
        except Exception as e:
            logger.error(f"Error logging telemetry: {e}")
            return jsonify({'error': 'Failed to log telemetry'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    with tracer.start_as_current_span("api_health_check"):
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'scores_count': len(score_manager.scores)
        })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5223))
    logger.info(f"Starting Flappy Kiro backend server on port {port}")
    app.run(debug=False, host='0.0.0.0', port=port)
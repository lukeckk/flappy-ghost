# Flappy Kiro

A fun arcade-style game where you control Ghosty, a friendly ghost, through a series of walls. Navigate through randomly positioned gaps, avoid collisions, and compete on the global leaderboard!

## What is Flappy Kiro?

Flappy Kiro is a browser-based game inspired by Flappy Bird, featuring:
- **Ghosty**: A friendly ghost character that moves continuously to the right
- **Simple Controls**: Press spacebar to make Ghosty jump and avoid walls
- **Three Difficulty Levels**: Easy, Medium, and Hard with different physics
- **Global Leaderboard**: Submit high scores with username validation
- **Real-time Scoring**: Earn points for each wall successfully passed

## Architecture

This application demonstrates modern cloud-native development practices:

### **Microservices Design**
- **Frontend**: HTML5/JavaScript game served by Nginx
- **Backend**: Python Flask REST API for leaderboard management
- **Database**: JSON file storage for simplicity

### **Cloud Infrastructure**
- **Containerization**: Docker containers for both services
- **Container Registry**: Amazon ECR for image storage
- **Orchestration**: Amazon EKS (Kubernetes) for container management
- **Load Balancing**: AWS Application Load Balancer (ALB)
- **Monitoring**: OpenTelemetry for distributed tracing and logging

### **Traffic Flow**
```
User → AWS ALB → Frontend Pod → Backend Pod → JSON Storage
```

## Tools Used

- **Frontend**: HTML5 Canvas, JavaScript, CSS3, Nginx
- **Backend**: Python, Flask, OpenTelemetry
- **Infrastructure**: Docker, Kubernetes, AWS EKS, AWS ALB
- **CI/CD**: Docker buildx, Amazon ECR
- **Monitoring**: OpenTelemetry, AWS CloudWatch

## Local Development Setup

### Prerequisites
- Python 3.11+
- Docker (optional, for containerized development)

### Quick Start

1. **Clone and setup backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

2. **Serve frontend** (in another terminal):
```bash
cd frontend
python -m http.server 8080
```

3. **Play the game**:
Open your browser to `http://localhost:8080`

### Game Controls
- **Spacebar**: Make Ghosty jump
- **Mouse**: Navigate menus and select difficulty
- **Goal**: Guide Ghosty through wall gaps without colliding

### API Endpoints
- `GET /api/health` - Health check
- `GET /api/scores` - Get leaderboard
- `POST /api/scores` - Submit score
- `POST /api/telemetry` - Log game events

That's it! The game runs locally with a simple Python backend and static file server. For production deployment on AWS EKS, see the deployment scripts in the `scripts/` directory.

Enjoy playing Flappy Kiro! 🎮👻
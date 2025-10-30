// Simple OTEL-style telemetry for frontend
class Telemetry {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.events = [];
        this.startTime = Date.now();
        this.backendUrl = window.BACKEND_URL || '/api';
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    logEvent(eventName, attributes = {}) {
        const event = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            eventName,
            attributes: {
                ...attributes,
                userAgent: navigator.userAgent,
                url: window.location.href
            }
        };
        
        this.events.push(event);
        console.log('[TELEMETRY]', event);
        
        // Send to backend if available
        this.sendToBackend(event);
    }

    async sendToBackend(event) {
        try {
            await fetch(`${this.backendUrl}/telemetry`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event)
            });
        } catch (error) {
            console.warn('Failed to send telemetry to backend:', error);
        }
    }

    logGameStart(difficulty) {
        this.logEvent('game_started', { difficulty });
    }

    logGameEnd(score, difficulty, duration) {
        this.logEvent('game_ended', { 
            score, 
            difficulty, 
            duration_ms: duration,
            session_duration_ms: Date.now() - this.startTime
        });
    }

    logScoreSubmission(username, score, difficulty) {
        this.logEvent('score_submitted', { username, score, difficulty });
    }

    logError(error, context = {}) {
        this.logEvent('error', { 
            error: error.message || error, 
            stack: error.stack,
            ...context 
        });
    }

    logPageView(page) {
        this.logEvent('page_view', { page });
    }

    logUserAction(action, details = {}) {
        this.logEvent('user_action', { action, ...details });
    }
}

// Global telemetry instance
window.telemetry = new Telemetry();
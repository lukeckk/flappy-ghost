class FlappyKiroApp {
    constructor() {
        this.game = null;
        this.selectedDifficulty = 'medium';
        this.backendUrl = window.BACKEND_URL || '/api';
        this.initializeElements();
        this.bindEvents();
        telemetry.logPageView('menu');
    }

    initializeElements() {
        // Screens
        this.menuScreen = document.getElementById('menu-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.leaderboardScreen = document.getElementById('leaderboard-screen');
        
        // Buttons
        this.startGameBtn = document.getElementById('start-game');
        this.showLeaderboardBtn = document.getElementById('show-leaderboard');
        this.playAgainBtn = document.getElementById('play-again');
        this.backToMenuBtn = document.getElementById('back-to-menu');
        this.backFromLeaderboardBtn = document.getElementById('back-from-leaderboard');
        this.submitScoreBtn = document.getElementById('submit-score');
        
        // Game elements
        this.canvas = document.getElementById('game-canvas');
        this.scoreDisplay = document.getElementById('score');
        this.difficultyDisplay = document.getElementById('difficulty-display');
        this.finalScoreDisplay = document.getElementById('final-score');
        this.usernameInput = document.getElementById('username');
        this.leaderboardContent = document.getElementById('leaderboard-content');
        
        // Difficulty buttons
        this.difficultyBtns = document.querySelectorAll('.difficulty-btn');
        
        // Initialize game
        this.game = new FlappyKiroGame(this.canvas);
    }

    bindEvents() {
        // Menu events
        this.startGameBtn.addEventListener('click', () => this.startGame());
        this.showLeaderboardBtn.addEventListener('click', () => this.showLeaderboard());
        
        // Game over events
        this.playAgainBtn.addEventListener('click', () => this.startGame());
        this.backToMenuBtn.addEventListener('click', () => this.showMenu());
        this.submitScoreBtn.addEventListener('click', () => this.submitScore());
        
        // Leaderboard events
        this.backFromLeaderboardBtn.addEventListener('click', () => this.showMenu());
        
        // Difficulty selection
        this.difficultyBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectDifficulty(btn.dataset.difficulty));
        });
        
        // Game controls
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.game) {
                    this.game.jump();
                }
            }
        });
        
        // Game over event
        window.addEventListener('gameOver', (e) => this.handleGameOver(e.detail));
        
        // Username input validation
        this.usernameInput.addEventListener('input', () => this.validateUsername());
        
        // Set initial difficulty
        this.selectDifficulty('medium');
    }

    selectDifficulty(difficulty) {
        this.selectedDifficulty = difficulty;
        this.game.setDifficulty(difficulty);
        
        // Update UI
        this.difficultyBtns.forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.difficulty === difficulty);
        });
        
        telemetry.logUserAction('difficulty_changed', { difficulty });
    }

    startGame() {
        console.log('Starting game with difficulty:', this.selectedDifficulty);
        console.log('Canvas element:', this.canvas);
        console.log('Game object:', this.game);
        
        this.showScreen('game');
        this.game.setDifficulty(this.selectedDifficulty);
        this.game.start();
        this.updateGameUI();
        telemetry.logPageView('game');
        
        console.log('Game started successfully');
    }

    showMenu() {
        this.showScreen('menu');
        telemetry.logPageView('menu');
    }

    showLeaderboard() {
        this.showScreen('leaderboard');
        this.loadLeaderboard();
        telemetry.logPageView('leaderboard');
    }

    showScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        const screens = {
            'menu': this.menuScreen,
            'game': this.gameScreen,
            'gameOver': this.gameOverScreen,
            'leaderboard': this.leaderboardScreen
        };
        
        if (screens[screenName]) {
            screens[screenName].classList.add('active');
        }
    }

    updateGameUI() {
        const updateLoop = () => {
            if (this.game && this.game.gameRunning) {
                this.scoreDisplay.textContent = `Score: ${this.game.getScore()}`;
                this.difficultyDisplay.textContent = `Difficulty: ${this.game.getDifficulty().toUpperCase()}`;
                requestAnimationFrame(updateLoop);
            }
        };
        updateLoop();
    }

    handleGameOver(gameData) {
        this.finalScoreDisplay.textContent = `Final Score: ${gameData.score}`;
        this.showScreen('gameOver');
        telemetry.logPageView('game_over');
    }

    validateUsername() {
        const username = this.usernameInput.value.trim();
        const isValid = username.length >= 2 && username.length <= 20 && 
                       /^[a-zA-Z0-9_-]+$/.test(username) &&
                       !this.containsInappropriateContent(username);
        
        this.submitScoreBtn.disabled = !isValid;
        
        // Remove existing error messages
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        if (!isValid && username.length > 0) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.textContent = 'Username must be 2-20 characters, alphanumeric, and appropriate';
            this.usernameInput.parentNode.appendChild(errorMsg);
        }
        
        return isValid;
    }

    containsInappropriateContent(username) {
        const inappropriate = ['admin', 'root', 'test', 'null', 'undefined', 'bot'];
        return inappropriate.some(word => username.toLowerCase().includes(word));
    }

    async submitScore() {
        if (!this.validateUsername()) return;
        
        const username = this.usernameInput.value.trim();
        const score = this.game.getScore();
        const difficulty = this.game.getDifficulty();
        
        try {
            const response = await fetch(`${this.backendUrl}/scores`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    score,
                    difficulty
                })
            });
            
            if (response.ok) {
                telemetry.logScoreSubmission(username, score, difficulty);
                this.usernameInput.value = '';
                this.showLeaderboard();
            } else {
                throw new Error('Failed to submit score');
            }
        } catch (error) {
            telemetry.logError(error, { context: 'score_submission' });
            alert('Failed to submit score. Please try again.');
        }
    }

    async loadLeaderboard() {
        try {
            const response = await fetch(`${this.backendUrl}/scores`);
            const scores = await response.json();
            
            this.displayLeaderboard(scores);
            telemetry.logUserAction('leaderboard_loaded', { scores_count: scores.length });
        } catch (error) {
            telemetry.logError(error, { context: 'leaderboard_loading' });
            this.leaderboardContent.innerHTML = '<p>Failed to load leaderboard</p>';
        }
    }

    displayLeaderboard(scores) {
        if (scores.length === 0) {
            this.leaderboardContent.innerHTML = '<p>No scores yet. Be the first!</p>';
            return;
        }
        
        const html = scores.map((score, index) => `
            <div class="leaderboard-entry">
                <span class="leaderboard-rank">#${index + 1}</span>
                <span class="leaderboard-username">${score.username}</span>
                <span class="leaderboard-score">${score.score}</span>
                <span class="leaderboard-difficulty">${score.difficulty}</span>
            </div>
        `).join('');
        
        this.leaderboardContent.innerHTML = html;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FlappyKiroApp();
});
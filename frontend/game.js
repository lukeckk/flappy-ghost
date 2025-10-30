class FlappyKiroGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Difficulty settings - initialize before reset()
        this.difficulties = {
            easy: { gravity: 0.3, jumpPower: -6, wallSpeed: 2, wallGap: 200 },
            medium: { gravity: 0.4, jumpPower: -7, wallSpeed: 3, wallGap: 160 },
            hard: { gravity: 0.5, jumpPower: -8, wallSpeed: 4, wallGap: 120 }
        };
        
        this.currentDifficulty = 'medium';
        this.gameStartTime = null;
        
        // Now reset after properties are initialized
        this.reset();
    }

    reset() {
        this.ghosty = {
            x: 100,
            y: 300,
            width: 40,
            height: 40,
            velocity: 0
        };
        
        this.walls = [];
        this.score = 0;
        this.gameRunning = false;
        this.gameStartTime = null;
        
        // Generate initial walls
        for (let i = 0; i < 3; i++) {
            this.walls.push(this.createWall(800 + i * 300));
        }
    }

    setDifficulty(difficulty) {
        this.currentDifficulty = difficulty;
        telemetry.logUserAction('difficulty_selected', { difficulty });
    }

    createWall(x) {
        const settings = this.difficulties[this.currentDifficulty];
        const gapY = Math.random() * (this.canvas.height - settings.wallGap - 100) + 50;
        
        return {
            x: x,
            topHeight: gapY,
            bottomY: gapY + settings.wallGap,
            bottomHeight: this.canvas.height - (gapY + settings.wallGap),
            width: 60,
            passed: false
        };
    }

    start() {
        this.reset();
        this.gameRunning = true;
        this.gameStartTime = Date.now();
        telemetry.logGameStart(this.currentDifficulty);
        this.gameLoop();
    }

    jump() {
        if (this.gameRunning) {
            const settings = this.difficulties[this.currentDifficulty];
            this.ghosty.velocity = settings.jumpPower;
            telemetry.logUserAction('jump', { 
                ghosty_y: this.ghosty.y, 
                velocity: this.ghosty.velocity 
            });
        }
    }

    update() {
        if (!this.gameRunning) return;

        const settings = this.difficulties[this.currentDifficulty];
        
        // Update Ghosty
        this.ghosty.velocity += settings.gravity;
        this.ghosty.y += this.ghosty.velocity;
        
        // Update walls
        for (let i = this.walls.length - 1; i >= 0; i--) {
            const wall = this.walls[i];
            wall.x -= settings.wallSpeed;
            
            // Check if wall passed
            if (!wall.passed && wall.x + wall.width < this.ghosty.x) {
                wall.passed = true;
                this.score++;
                telemetry.logUserAction('wall_passed', { 
                    score: this.score, 
                    difficulty: this.currentDifficulty 
                });
            }
            
            // Remove walls that are off screen
            if (wall.x + wall.width < 0) {
                this.walls.splice(i, 1);
            }
        }
        
        // Add new walls
        const lastWall = this.walls[this.walls.length - 1];
        if (lastWall && lastWall.x < this.canvas.width - 300) {
            this.walls.push(this.createWall(this.canvas.width + 100));
        }
        
        // Check collisions
        this.checkCollisions();
    }

    checkCollisions() {
        // Ground and ceiling collision
        if (this.ghosty.y + this.ghosty.height > this.canvas.height || this.ghosty.y < 0) {
            this.endGame('boundary_collision');
            return;
        }
        
        // Wall collision
        for (const wall of this.walls) {
            if (this.ghosty.x < wall.x + wall.width &&
                this.ghosty.x + this.ghosty.width > wall.x) {
                
                if (this.ghosty.y < wall.topHeight ||
                    this.ghosty.y + this.ghosty.height > wall.bottomY) {
                    this.endGame('wall_collision');
                    return;
                }
            }
        }
    }

    endGame(reason) {
        this.gameRunning = false;
        const duration = Date.now() - this.gameStartTime;
        telemetry.logGameEnd(this.score, this.currentDifficulty, duration);
        telemetry.logUserAction('game_over', { 
            reason, 
            final_score: this.score,
            duration_ms: duration
        });
        
        // Trigger game over event
        window.dispatchEvent(new CustomEvent('gameOver', { 
            detail: { 
                score: this.score, 
                difficulty: this.currentDifficulty 
            } 
        }));
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw ground
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(0, this.canvas.height - 20, this.canvas.width, 20);
        
        // Draw Ghosty
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        
        // Simple ghost shape
        this.ctx.beginPath();
        this.ctx.arc(this.ghosty.x + 20, this.ghosty.y + 15, 15, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Ghost eyes
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(this.ghosty.x + 12, this.ghosty.y + 8, 4, 6);
        this.ctx.fillRect(this.ghosty.x + 24, this.ghosty.y + 8, 4, 6);
        
        // Ghost tail (wavy bottom)
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.strokeStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.moveTo(this.ghosty.x + 5, this.ghosty.y + 25);
        for (let i = 0; i < 6; i++) {
            this.ctx.lineTo(this.ghosty.x + 5 + i * 5, this.ghosty.y + 30 + (i % 2 === 0 ? 5 : 0));
        }
        this.ctx.lineTo(this.ghosty.x + 35, this.ghosty.y + 25);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Draw walls
        this.ctx.fillStyle = '#228B22';
        this.ctx.strokeStyle = '#006400';
        this.ctx.lineWidth = 3;
        
        for (const wall of this.walls) {
            // Top wall
            this.ctx.fillRect(wall.x, 0, wall.width, wall.topHeight);
            this.ctx.strokeRect(wall.x, 0, wall.width, wall.topHeight);
            
            // Bottom wall
            this.ctx.fillRect(wall.x, wall.bottomY, wall.width, wall.bottomHeight);
            this.ctx.strokeRect(wall.x, wall.bottomY, wall.width, wall.bottomHeight);
        }
    }

    gameLoop() {
        this.update();
        this.draw();
        
        if (this.gameRunning) {
            requestAnimationFrame(() => this.gameLoop());
        }
    }

    getScore() {
        return this.score;
    }

    getDifficulty() {
        return this.currentDifficulty;
    }
}
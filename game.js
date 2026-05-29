class Game {
    constructor() {
        this.canvas = document.getElementById('game_canvas');
        this.ctx = this.canvas.getContext('2d');

        // Set virtual resolution
        this.virtualWidth = 450;
        this.virtualHeight = 800;

        // Player configuration
        this.player = {
            x: 225,
            y: 650,
            width: 42,
            height: 76,
            targetX: 225,
            vx: 0,
            speed: 0,
            scooterType: 'classic',
            hp: 300,
            maxHp: 300,
            slipTime: 0,
            drunkTime: 0,
            invulnTime: 0,
            score: 0
        };

        this.scooterSettings = {
            classic: { maxSpeed: 10, accel: 0.5, handling: 0.18, maxHp: 300 },
            delivery: { maxSpeed: 14, accel: 0.3, handling: 0.12, maxHp: 300 }
        };

        // Roads and scrolling
        this.roadScrollY = 0;
        this.intersectionScrollY = -1000;
        this.roadSpeed = 5;

        // Key states
        this.keys = { left: false, right: false };

        // Entities
        this.obstacles = [];
        this.particles = [];

        // Game timeline
        this.gameTime = 0; // seconds elapsed
        this.isPlaying = false;
        this.warningTimer = 0;

        // Bind keyboard events
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Adjust resolution
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Assign to window
        window.gameInstance = this;
    }

    resize() {
        const parent = this.canvas.parentElement;
        const rect = parent.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    setScooterType(type) {
        this.player.scooterType = type;
        const settings = this.scooterSettings[type];
        this.player.maxHp = settings.maxHp;
        this.player.hp = settings.maxHp;
    }

    start() {
        this.isPlaying = true;
        this.gameTime = 0;
        this.player.hp = this.player.maxHp;
        this.player.x = 225;
        this.player.targetX = 225;
        this.player.vx = 0;
        this.player.slipTime = 0;
        this.player.invulnTime = 0;
        this.player.score = 0;
        this.roadSpeed = 5;
        this.obstacles = [];
        this.particles = [];
        this.keys = { left: false, right: false };
        this.warningTimer = 0;
        
        // Reset boss triggers
        this.boss20Triggered = false;
        this.boss40Triggered = false;
        this.boss60Triggered = false;
        this.boss80Triggered = false;

        if (window.audioManager) {
            window.audioManager.startEngine();
        }

        // Loop animation
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    handleKeyDown(e) {
        if (!this.isPlaying) return;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            this.keys.left = true;
        }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            this.keys.right = true;
        }
        if (e.key === ' ') {
            e.preventDefault();
            triggerHorn();
        }
    }

    handleKeyUp(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            this.keys.left = false;
        }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            this.keys.right = false;
        }
    }

    hornTriggered() {
        // Scares away dogs and cats, or makes pedestrians step aside
        this.obstacles.forEach(obs => {
            if (obs.type === 'cat' || obs.type === 'dog' || obs.type === 'pedestrian') {
                const distY = obs.y - this.player.y;
                // If nearby in front
                if (distY < 0 && distY > -300) {
                    obs.scared = true;
                    obs.vx = obs.x < 225 ? -6 : 6; // flee outward
                }
            }
        });
    }

    gameOver(reason) {
        this.isPlaying = false;
        if (window.audioManager) {
            window.audioManager.stopEngine();
            window.audioManager.playCrash();
        }
        document.getElementById('hud_overlay').style.display = 'none';
        const goScreen = document.getElementById('gameover_screen');
        document.getElementById('gameover_reason').innerText = reason;
        goScreen.classList.add('active');
    }

    victory() {
        this.isPlaying = false;
        if (window.audioManager) {
            window.audioManager.stopEngine();
            window.audioManager.playWin();
        }
        localStorage.setItem('gameBeaten', 'true');
        document.getElementById('hud_overlay').style.display = 'none';
        const vicScreen = document.getElementById('victory_screen');
        document.getElementById('score_display').innerText = `生存積分: ${Math.floor(this.player.score)}`;
        vicScreen.classList.add('active');
        this.spawnWinConfetti();
    }

    spawnWinConfetti() {
        for (let i = 0; i < 150; i++) {
            this.particles.push({
                x: Math.random() * this.virtualWidth,
                y: Math.random() * this.virtualHeight - 200,
                vx: Math.random() * 6 - 3,
                vy: Math.random() * 4 + 2,
                color: `hsl(${Math.random() * 360}, 100%, 60%)`,
                size: Math.random() * 6 + 4,
                life: 200
            });
        }
    }

    spawnSparks(x, y) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: Math.random() * 8 - 4,
                vy: Math.random() * 8 - 4,
                color: '#ffaa00',
                size: Math.random() * 3 + 1,
                life: 30
            });
        }
    }

    spawnDust(x, y) {
        this.particles.push({
            x: x,
            y: y,
            vx: Math.random() * 2 - 1,
            vy: Math.random() * 2 + 1,
            color: 'rgba(200,200,200,0.3)',
            size: Math.random() * 8 + 4,
            life: 20
        });
    }

    spawnObstacle(type, customProps = {}) {
        const baseObstacles = {
            granny: { width: 30, height: 50, color: '#e0a0ff', speedY: 0, type: 'granny', action: 'idle', vx: 0 },
            car: { width: 50, height: 90, color: '#00ccff', speedY: 1.5, type: 'car', suddenStop: false, stopping: false },
            scooter: { width: 35, height: 70, color: '#ff5555', speedY: 3, type: 'scooter', suddenStop: false, stopping: false },
            dog: { width: 25, height: 20, color: '#d2b48c', speedY: 0, type: 'dog', vx: -4, scared: false },
            cat: { width: 20, height: 16, color: '#ffffff', speedY: 0, type: 'cat', vx: 5, scared: false },
            pedestrian: { width: 30, height: 50, color: '#39ff14', speedY: 0, type: 'pedestrian', vx: 2, scared: false },
            hotgirl: { width: 28, height: 50, color: '#ff00ff', speedY: 0, type: 'hotgirl', waved: false },
            roadblock: { width: 90, height: 35, color: '#ffa500', speedY: 0, type: 'roadblock' },
            pothole: { width: 45, height: 30, color: '#2a2a3a', speedY: 0, type: 'pothole' }
        };

        const obs = Object.assign({}, baseObstacles[type], customProps);
        if (obs.x === undefined) {
            // Default random lanes: lane 1 (center 155), lane 2 (center 295)
            const lane = Math.random() < 0.5 ? 155 : 295;
            obs.x = lane - obs.width / 2;
        }
        if (obs.y === undefined) {
            obs.y = -100; // spawn off-screen top
        }
        this.obstacles.push(obs);
    }

    // Timeline spawns
    handleTimeline(dt) {
        this.gameTime += dt;
        const progress = Math.min((this.gameTime / 90) * 100, 100);
        document.getElementById('time_val').innerText = `${Math.max(0, 90.0 - this.gameTime).toFixed(1)}s`;
        document.getElementById('progress_fill').style.width = `${progress}%`;

        if (this.gameTime >= 90) {
            this.victory();
            return;
        }

        // Show warnings ahead of BOSS events
        let isBossImpending = false;
        if (this.isUltraMode) {
            isBossImpending = (this.gameTime > 7 && this.gameTime < 10) ||
                              (this.gameTime > 27 && this.gameTime < 30) ||
                              (this.gameTime > 47 && this.gameTime < 50) ||
                              (this.gameTime > 67 && this.gameTime < 70);
        } else {
            isBossImpending = (this.gameTime > 17 && this.gameTime < 20) ||
                              (this.gameTime > 37 && this.gameTime < 40) ||
                              (this.gameTime > 57 && this.gameTime < 60) ||
                              (this.gameTime > 77 && this.gameTime < 80);
        }
        
        const banner = document.getElementById('warning_banner');
        if (isBossImpending) {
            let label = "⚠️ 注意 ⚠️";
            if (this.isUltraMode) {
                if (this.gameTime < 10) label = "⚠️ 坑洞 ＆ 夾擊 ⚠️";
                else if (this.gameTime < 30) label = "⚠️ 毒駕 ＆ 碰瓷 ⚠️";
                else if (this.gameTime < 50) label = "⚠️ 四車包夾 ＆ 坑洞 ⚠️";
                else if (this.gameTime < 70) label = "🔥 終極魔王大亂鬥 🔥";
            } else {
                if (this.gameTime < 20) label = "⚠️ 前方連續路坑 ⚠️";
                else if (this.gameTime < 40) label = "⚠️ 注意後方逼車 ⚠️";
                else if (this.gameTime < 60) label = "⚠️ 警報！毒駕蛇行車 ⚠️";
                else if (this.gameTime < 80) label = "⚠️ 注意！假摔碰瓷魔人 ⚠️";
            }
            banner.innerText = label;
            banner.classList.add('active');
        } else {
            banner.classList.remove('active');
        }

        // Trigger boss spawns
        const second = Math.floor(this.gameTime);
        if (this.isUltraMode) {
            if (second === 10 && !this.boss20Triggered) { this.boss20Triggered = true; this.triggerUltraBossA(); }
            if (second === 30 && !this.boss40Triggered) { this.boss40Triggered = true; this.triggerUltraBossB(); }
            if (second === 50 && !this.boss60Triggered) { this.boss60Triggered = true; this.triggerUltraBossC(); }
            if (second === 70 && !this.boss80Triggered) { this.boss80Triggered = true; this.triggerUltraBossFinal(); }
        } else {
            if (second === 20 && !this.boss20Triggered) { this.boss20Triggered = true; this.triggerPotholeStorm(); }
            if (second === 40 && !this.boss40Triggered) { this.boss40Triggered = true; this.triggerMotorcycleSqueeze(); }
            if (second === 60 && !this.boss60Triggered) { this.boss60Triggered = true; this.triggerDrunkDriver(); }
            if (second === 80 && !this.boss80Triggered) { this.boss80Triggered = true; this.triggerFraudFall(); }
        }

        // Random Obstacle Spawner (when no bosses are active)
        const isBossActive = (this.gameTime >= 19 && this.gameTime <= 25) ||
                             (this.gameTime >= 39 && this.gameTime <= 45) ||
                             (this.gameTime >= 59 && this.gameTime <= 66) ||
                             (this.gameTime >= 79 && this.gameTime <= 83);

        if (!isBossActive && Math.random() < 0.015 && !this.isUltraMode) {
            const r = Math.random();
            if (r < 0.2) {
                // Sudden stopping car/scooter
                const isCar = Math.random() < 0.5;
                this.spawnObstacle(isCar ? 'car' : 'scooter', {
                    y: -100,
                    suddenStop: true,
                    speedY: 4
                });
            } else if (r < 0.4) {
                // Side runner (cat/dog/pedestrian)
                const fromLeft = Math.random() < 0.5;
                const type = Math.random() < 0.3 ? 'cat' : (Math.random() < 0.6 ? 'dog' : 'pedestrian');
                this.spawnObstacle(type, {
                    x: fromLeft ? 0 : 420,
                    y: Math.random() * 200 + 100, // Spawn higher up screen
                    vx: fromLeft ? (type === 'cat' ? 6 : 4) : (type === 'cat' ? -6 : -4)
                });
            } else if (r < 0.6) {
                // Granny jumpout or fall
                const action = Math.random() < 0.5 ? 'jump' : 'fall';
                const fromLeft = Math.random() < 0.5;
                this.spawnObstacle('granny', {
                    x: fromLeft ? 60 : 360,
                    y: 150,
                    action: action,
                    vx: fromLeft ? 3.5 : -3.5,
                    color: action === 'fall' ? '#ff9999' : '#e0a0ff'
                });
            } else if (r < 0.75) {
                // Road closure forcing lane change
                const leftLane = Math.random() < 0.5;
                this.spawnObstacle('roadblock', {
                    x: leftLane ? 80 : 225,
                    y: -100
                });
            } else if (r < 0.9) {
                // Hot girl waving
                this.spawnObstacle('hotgirl', {
                    x: Math.random() < 0.5 ? 45 : 380,
                    y: -50
                });
            }
        }
    }

    // --- BOSS EVENTS IMPLEMENTATION ---

    triggerUltraBossA() {
        this.triggerPotholeStorm();
        this.triggerMotorcycleSqueeze();
    }

    triggerUltraBossB() {
        this.triggerDrunkDriver();
        this.triggerFraudFall();
    }

    triggerUltraBossC() {
        this.triggerMotorcycleSqueeze();
        // 2 additional motorcycles
        this.spawnObstacle('scooter', { x: 100, y: 850, speedY: 10, targetX: 200, squeezeState: 'approaching', stopping: false, color: '#ffaa00' });
        this.spawnObstacle('scooter', { x: 300, y: 850, speedY: 10, targetX: 180, squeezeState: 'approaching', stopping: false, color: '#00ffaa' });
        this.triggerPotholeStorm();
    }

    triggerUltraBossFinal() {
        this.triggerDrunkDriver();
        this.triggerMotorcycleSqueeze();
        this.triggerPotholeStorm();
    }

    triggerPotholeStorm() {
        // 25s: Taiwanese broken road - irregular, organic potholes
        const patterns = [
            { delay: 0, x: 135 },
            { delay: 250, x: 275 },
            { delay: 450, x: 155 },
            { delay: 850, x: 295 },
            { delay: 950, x: 120 },  // close double
            { delay: 1300, x: 220 }, // middle pothole
            { delay: 1650, x: 280 },
            { delay: 2000, x: 140 },
            { delay: 2200, x: 270 },
            { delay: 2600, x: 160 },
            { delay: 2750, x: 245 }
        ];

        patterns.forEach(p => {
            setTimeout(() => {
                if (!this.isPlaying) return;
                const width = 35 + Math.random() * 25;
                const height = 25 + Math.random() * 15;
                this.spawnObstacle('pothole', {
                    x: p.x + (Math.random() * 30 - 15) - width / 2,
                    y: -50,
                    width: width,
                    height: height
                });
            }, p.delay);
        });
    }

    triggerMotorcycleSqueeze() {
        // 50s: 2 motorcycles from behind squeeze player, block, and brake
        if (window.audioManager) window.audioManager.playScreech();
        this.spawnObstacle('scooter', {
            x: 135,
            y: 850, // come from bottom
            speedY: 9, // moving faster than roadSpeed (5) to overtake from behind (relative speed is -4)
            targetX: 275,
            squeezeState: 'approaching',
            stopping: false,
            color: '#ff00ff'
        });
        this.spawnObstacle('scooter', {
            x: 275,
            y: 850,
            speedY: 9, // moving faster than roadSpeed (5) to overtake from behind
            targetX: 135,
            squeezeState: 'approaching',
            stopping: false,
            color: '#00ffff'
        });
    }

    triggerDrunkDriver() {
        // 75s: Toxic/drunk driver weaving in front or crashing
        this.spawnObstacle('car', {
            x: 200,
            y: -120,
            speedY: 2,
            type: 'drunk',
            color: '#adff2f', // toxic green
            weaveTimer: 0
        });
    }

    triggerFraudFall() {
        // 80s: The insurance scammer who falls down ahead on purpose
        this.spawnObstacle('granny', {
            x: 210,
            y: -100,
            width: 40,
            height: 65,
            speedY: 2,
            type: 'scammer',
            color: '#ff3333',
            state: 'riding',
            fallTimer: 0
        });
    }

    // --- PHYSICS & LOGIC LOOP ---

    loop(timestamp) {
        if (!this.isPlaying) return;
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        const scale = window.timeScale || 1.0;
        const iterations = Math.floor(scale);
        
        for (let i = 0; i < iterations; i++) {
            this.update(dt);
        }

        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // Player HP Check
        if (this.player.hp <= 0) {
            this.gameOver("你受傷過重，車輛損毀！請重新挑戰。");
            return;
        }

        // Increase base score slowly over time
        this.player.score += dt * 10;

        // Progress timeline
        this.handleTimeline(dt);

        const settings = this.scooterSettings[this.player.scooterType];
        
        // Handle input & steering
        let steeringFactor = settings.handling;
        
        // Slipping mechanics (from pothole)
        if (this.player.slipTime > 0) {
            this.player.slipTime -= dt;
            // Wobble violently, disable user keys
            this.player.vx += Math.sin(performance.now() / 40) * 1.5;
            this.spawnDust(this.player.x + 20, this.player.y + 70);
        } else {
            // Normal steering
            if (this.keys.left) {
                this.player.vx -= settings.accel;
            } else if (this.keys.right) {
                this.player.vx += settings.accel;
            } else {
                this.player.vx *= 0.8; // drag
            }
        }

        // Apply velocity & boundary check
        this.player.vx = Math.max(-settings.maxSpeed, Math.min(settings.maxSpeed, this.player.vx));
        this.player.x += this.player.vx;

        // Keep inside roads (lanes 80 to 370, vehicle width is 42)
        if (this.player.x < 80) {
            this.player.x = 80;
            this.player.vx = 0;
        }
        if (this.player.x > 370 - this.player.width) {
            this.player.x = 370 - this.player.width;
            this.player.vx = 0;
        }

        // Invulnerable timer decrease
        if (this.player.invulnTime > 0) {
            this.player.invulnTime -= dt;
        }

        // Speed engine soundpitch adjustment
        if (window.audioManager) {
            const speedRatio = Math.abs(this.player.vx) / settings.maxSpeed;
            window.audioManager.updateEnginePitch(0.4 + speedRatio * 0.6);
        }

        // Scroll background
        this.roadScrollY = (this.roadScrollY + this.roadSpeed) % 80;

        // Update obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];

            // Speed relative to player's road movement
            let finalSpeedY = this.roadSpeed - obs.speedY;
            obs.y += finalSpeedY;

            // Obstacle specific behaviors
            if (obs.vx !== undefined && !obs.scared) {
                obs.x += obs.vx;
            } else if (obs.vx !== undefined && obs.scared) {
                obs.x += obs.vx * 1.5; // run away faster
            }

            // 1. Sudden stopping vehicle behavior
            if (obs.suddenStop) {
                // If it is ahead in front, randomly brakes
                if (obs.y > 200 && !obs.stopping) {
                    if (Math.random() < 0.05) {
                        obs.stopping = true;
                        obs.speedY = 0.5; // slow down drastically
                        if (window.audioManager) window.audioManager.playScreech();
                    }
                }
            }

            // 2. Granny jumping out or falling down
            if (obs.type === 'granny' && obs.action === 'jump') {
                // Granny moves across road
                if (obs.x < 80 || obs.x > 370) {
                    obs.vx = -obs.vx; // bounce/stay on road area
                }
            } else if (obs.type === 'granny' && obs.action === 'fall') {
                if (obs.y > 250 && !obs.fallen) {
                    obs.fallen = true;
                    obs.vx = 0; // stop moving
                    obs.height = 30; // becomes flat on road
                    obs.width = 60;
                    obs.color = '#ff6666';
                }
            }

            // 3. Boss 50: Motorcyclists squeeze
            if (obs.squeezeState) {
                if (obs.squeezeState === 'approaching') {
                    if (obs.y < 350) { // Overtaken and reached front
                        obs.squeezeState = 'crossing';
                        obs.speedY = this.roadSpeed; // match speed
                    }
                } else if (obs.squeezeState === 'crossing') {
                    // Move towards targetX
                    const dx = obs.targetX - obs.x;
                    obs.x += dx * 0.05;
                    if (Math.abs(dx) < 5) {
                        obs.squeezeState = 'front';
                        // After crossing, brake
                        setTimeout(() => {
                            if (obs && this.isPlaying) {
                                obs.speedY = 1; // sudden brake!
                                if (window.audioManager) window.audioManager.playScreech();
                            }
                        }, 500); // 0.5s after crossing
                    }
                }
            }

            // 4. Boss 60: Drunk weaving car
            if (obs.type === 'drunk') {
                obs.weaveTimer += dt;
                // Add unpredictable noise
                const noiseX = Math.sin(obs.weaveTimer * 5.2) * 20;
                // Use different frequencies for X and Y to create chaotic irregular motion (Lissajous curve)
                obs.x = 200 + Math.sin(obs.weaveTimer * 1.3) * 110 + noiseX;
                // Speeds up and brakes out of sync with horizontal movement
                const noiseY = Math.sin(obs.weaveTimer * 4.1) * 1.5;
                obs.speedY = 4 + Math.cos(obs.weaveTimer * 1.8) * 3.5 + noiseY;
            }

            // 5. Boss 85: Insurance fraud scammer
            if (obs.type === 'scammer') {
                obs.fallTimer += dt;
                if (obs.state === 'riding') {
                    // Position front of player
                    const dx = this.player.x - obs.x;
                    obs.x += dx * 0.05; // track player x lane
                    if (obs.y > 250) {
                        obs.state = 'falling';
                        obs.speedY = 0; // sudden fall/brake
                        obs.height = 35;
                        obs.width = 45;
                        obs.color = '#ff3333';
                    }
                }
            }

            // Check collision with player
            if (this.checkCollision(this.player, obs)) {
                this.handleCollision(obs, i);
                continue;
            }

            // Remove off-screen obstacles
            if (obs.y > this.virtualHeight + 100 || obs.y < -300) {
                this.obstacles.splice(i, 1);
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update HUD
        const hpPercent = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
        document.getElementById('hp_fill').style.width = `${hpPercent}%`;
    }

    checkCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    handleCollision(obs, index) {
        // Special case: Pothole causes slip, no damage
        if (obs.type === 'pothole') {
            if (this.player.slipTime <= 0) {
                this.player.slipTime = 1.2; // 1.2 seconds slip
                if (window.audioManager) window.audioManager.playScreech();
            }
            this.obstacles.splice(index, 1);
            return;
        }

        // Special case: Hot girl waving
        if (obs.type === 'hotgirl') {
            if (!obs.waved) {
                obs.waved = true;
                this.player.score += 200; // Bonus score
                if (this.player.hp < this.player.maxHp) {
                    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20); // Heal
                }
                if (window.audioManager) window.audioManager.playBonus();
                // Spawn bonus sparkles
                for (let i = 0; i < 15; i++) {
                    this.particles.push({
                        x: obs.x + 15,
                        y: obs.y + 25,
                        vx: Math.random() * 4 - 2,
                        vy: Math.random() * 4 - 2,
                        color: '#ff00ff',
                        size: Math.random() * 4 + 2,
                        life: 30
                    });
                }
            }
            this.obstacles.splice(index, 1);
            return;
        }

        // Special case: Fraud scammer 85s
        if (obs.type === 'scammer') {
            this.gameOver("你被告了！三寶突然倒地，你避讓不及，被控防衛過當與過失傷害罪！");
            return;
        }

        // Normal obstacle damage collision
        if (this.player.invulnTime <= 0) {
            this.player.hp -= 25;
            this.player.invulnTime = 1.0; // 1 second invulnerability
            this.spawnSparks(this.player.x + 20, this.player.y + 20);
            if (window.audioManager) window.audioManager.playCrash();

            // Push player away slightly
            this.player.vx = this.player.x < obs.x ? -8 : 8;
        }

        // Remove the hit obstacle (except heavy roadblocks)
        if (obs.type !== 'roadblock') {
            this.obstacles.splice(index, 1);
        }
    }

    // --- RENDER SYSTEM ---

    draw() {
        // Dynamic Canvas Resizing for sharp drawing
        if (this.canvas.width !== this.canvas.clientWidth || this.canvas.height !== this.canvas.clientHeight) {
            this.canvas.width = this.canvas.clientWidth;
            this.canvas.height = this.canvas.clientHeight;
        }

        // Calculate scaling
        const scaleX = this.canvas.width / this.virtualWidth;
        const scaleY = this.canvas.height / this.virtualHeight;

        this.ctx.save();
        this.ctx.scale(scaleX, scaleY);

        // Draw Road Background
        this.drawRoad();

        // Draw obstacles
        this.obstacles.forEach(obs => this.drawObstacle(obs));

        // Draw Player scooter
        this.drawPlayer();

        // Draw particles
        this.particles.forEach(p => this.drawParticle(p));

        this.ctx.restore();
    }

    drawRoad() {
        // Ground base (Dark grey road)
        this.ctx.fillStyle = '#1e1e24';
        this.ctx.fillRect(80, 0, 290, this.virtualHeight);

        // Sidewalks
        this.ctx.fillStyle = '#2d2d35';
        this.ctx.fillRect(0, 0, 80, this.virtualHeight);
        this.ctx.fillRect(370, 0, 80, this.virtualHeight);

        // Sidewalk borders (curbs) with yellow/black neon pattern
        this.ctx.fillStyle = '#ffcc00';
        this.ctx.fillRect(76, 0, 4, this.virtualHeight);
        this.ctx.fillRect(370, 0, 4, this.virtualHeight);

        // Dash lane separator (white line) down the center
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([30, 50]);
        this.ctx.beginPath();
        this.ctx.moveTo(225, 0 + this.roadScrollY);
        this.ctx.lineTo(225, this.virtualHeight + this.roadScrollY);
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Reset line dash

        // Draw side walk decorations (neon posts / sidewalk lines)
        this.ctx.strokeStyle = '#3a3a4c';
        this.ctx.lineWidth = 1;
        for (let y = this.roadScrollY - 80; y < this.virtualHeight; y += 80) {
            // Left sidewalk grid line
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(80, y);
            this.ctx.stroke();
            // Right sidewalk grid line
            this.ctx.beginPath();
            this.ctx.moveTo(370, y);
            this.ctx.lineTo(this.virtualWidth, y);
            this.ctx.stroke();
        }
    }

    drawPlayer() {
        // Flashing effect if invulnerable
        if (this.player.invulnTime > 0 && Math.floor(performance.now() / 100) % 2 === 0) {
            return;
        }

        const px = this.player.x;
        const py = this.player.y;
        const w = this.player.width;
        const h = this.player.height;

        this.ctx.save();

        // Draw shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.beginPath();
        this.ctx.ellipse(px + w / 2, py + h - 5, w / 1.5, 8, 0, 0, 2 * Math.PI);
        this.ctx.fill();

        // Vehicle body (neon cyber style scooter)
        const isDelivery = this.player.scooterType === 'delivery';
        this.ctx.fillStyle = isDelivery ? '#ff0055' : '#00e5ff';
        
        // Main scooter body
        this.ctx.fillRect(px + 8, py + 15, w - 16, h - 30);

        // Rear/cargo rack
        this.ctx.fillStyle = '#33333f';
        if (isDelivery) {
            this.ctx.fillStyle = '#ffd700'; // Gold外送箱
            this.ctx.fillRect(px + 5, py + 48, w - 10, 22);
            this.ctx.fillStyle = '#111';
            this.ctx.font = 'bold 9px sans-serif';
            this.ctx.fillText("UBER", px + 9, py + 62);
        } else {
            this.ctx.fillRect(px + 8, py + 52, w - 16, 12);
        }

        // Tires
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(px + w / 2 - 6, py + 5, 12, 12); // Front tire
        this.ctx.fillRect(px + w / 2 - 6, py + h - 17, 12, 15); // Rear tire

        // Headlight glow
        const glowColor = isDelivery ? 'rgba(255, 234, 0, 0.4)' : 'rgba(0, 240, 255, 0.4)';
        const grad = this.ctx.createRadialGradient(px + w/2, py + 5, 2, px + w/2, py - 40, 45);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, glowColor);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.moveTo(px + w/2, py + 5);
        this.ctx.lineTo(px - 20, py - 50);
        this.ctx.lineTo(px + w + 20, py - 50);
        this.ctx.closePath();
        this.ctx.fill();

        // Rider helmet/shoulders
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(px + w / 2, py + 30, 8, 0, 2 * Math.PI); // Helmet
        this.ctx.fill();
        this.ctx.fillStyle = '#ff5500'; // Visor
        this.ctx.fillRect(px + w/2 - 5, py + 24, 10, 3);

        this.ctx.restore();
    }

    drawObstacle(obs) {
        this.ctx.save();

        if (obs.type === 'pothole') {
            // Draw dark pothole with neon alert border
            this.ctx.fillStyle = '#0a0a0c';
            this.ctx.strokeStyle = '#ff3300';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.ellipse(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/2, obs.height/2, 0, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
        }
        else if (obs.type === 'roadblock') {
            // Stripes pattern roadblock
            this.ctx.fillStyle = '#ffa500';
            this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            this.ctx.fillStyle = '#000';
            for (let ox = 0; ox < obs.width; ox += 20) {
                this.ctx.beginPath();
                this.ctx.moveTo(obs.x + ox, obs.y);
                this.ctx.lineTo(obs.x + ox + 10, obs.y);
                this.ctx.lineTo(obs.x + ox, obs.y + obs.height);
                this.ctx.lineTo(obs.x + ox - 10, obs.y + obs.height);
                this.ctx.closePath();
                this.ctx.fill();
            }
            // Warning flashing light on top
            if (Math.floor(performance.now() / 200) % 2 === 0) {
                this.ctx.fillStyle = '#ff3300';
                this.ctx.beginPath();
                this.ctx.arc(obs.x + obs.width/2, obs.y - 4, 6, 0, 2 * Math.PI);
                this.ctx.fill();
            }
        }
        else if (obs.type === 'granny' || obs.type === 'scammer') {
            // Granny/Scammer drawing
            const isScammer = obs.type === 'scammer';
            this.ctx.fillStyle = obs.color || '#e0a0ff';
            if (obs.fallen || obs.state === 'falling') {
                // fallen block
                this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                // "Anger" indicator or funny text
                this.ctx.fillStyle = '#fff';
                this.ctx.font = isScammer ? '14px sans-serif' : '10px sans-serif';
                this.ctx.fillText(isScammer ? "賠錢啦!" : "哎喲喂呀!", obs.x - 5, obs.y - 10);
                // White hair when fallen
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(obs.x + obs.width/2 + 10, obs.y + 10, 8, 0, 2 * Math.PI);
                this.ctx.fill();
            } else {
                // Standing/walking/riding granny
                this.ctx.fillRect(obs.x + 5, obs.y + 15, obs.width - 10, obs.height - 15);
                this.ctx.fillStyle = '#ffdbac'; // Skin
                this.ctx.beginPath();
                this.ctx.arc(obs.x + obs.width/2, obs.y + 10, 8, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.fillStyle = '#ffffff'; // Big White hair
                this.ctx.beginPath();
                this.ctx.arc(obs.x + obs.width/2, obs.y + 3, isScammer ? 10 : 6, 0, 2 * Math.PI);
                this.ctx.fill();
                
                if (isScammer) {
                    // Scammer rides a small bike
                    this.ctx.fillStyle = '#555';
                    this.ctx.fillRect(obs.x + obs.width/2 - 2, obs.y + obs.height - 5, 4, 15);
                    this.ctx.fillStyle = '#111';
                    this.ctx.fillRect(obs.x + obs.width/2 - 6, obs.y + obs.height + 5, 12, 12);
                }
            }
        }
        else if (obs.type === 'car' || obs.type === 'drunk') {
            // Draw car
            this.ctx.fillStyle = obs.color;
            this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

            // Windows
            this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
            this.ctx.fillRect(obs.x + 4, obs.y + 20, obs.width - 8, 15); // front windshield
            this.ctx.fillRect(obs.x + 4, obs.y + obs.height - 25, obs.width - 8, 12); // rear windshield

            // Brake lights
            this.ctx.fillStyle = (obs.stopping || obs.type === 'drunk') ? '#ff0000' : '#880000';
            this.ctx.fillRect(obs.x + 2, obs.y + obs.height - 6, 8, 6);
            this.ctx.fillRect(obs.x + obs.width - 10, obs.y + obs.height - 6, 8, 6);
        }
        else if (obs.type === 'scooter') {
            // Draw NPC scooter
            this.ctx.fillStyle = obs.color;
            this.ctx.fillRect(obs.x + 6, obs.y + 10, obs.width - 12, obs.height - 20);
            this.ctx.fillStyle = '#111';
            this.ctx.fillRect(obs.x + obs.width/2 - 5, obs.y + obs.height - 10, 10, 10);
            if (obs.speedY === 1) { // Braking state
                this.ctx.fillStyle = '#ff0000';
                this.ctx.fillRect(obs.x + 4, obs.y + obs.height - 15, obs.width - 8, 4);
            }
        }
        else if (obs.type === 'dog' || obs.type === 'cat') {
            // Four-legged animal representation
            this.ctx.fillStyle = obs.color;
            this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            // head
            this.ctx.fillRect(obs.vx > 0 ? obs.x + obs.width - 5 : obs.x, obs.y - 4, 6, 6);
        }
        else if (obs.type === 'pedestrian') {
            // Pedestrian
            this.ctx.fillStyle = obs.color;
            this.ctx.fillRect(obs.x + 5, obs.y + 10, obs.width - 10, obs.height - 10);
            this.ctx.fillStyle = '#ffdbac';
            this.ctx.beginPath();
            this.ctx.arc(obs.x + obs.width/2, obs.y + 8, 6, 0, 2 * Math.PI);
            this.ctx.fill();
        }
        else if (obs.type === 'hotgirl') {
            // Hot girl waving
            this.ctx.fillStyle = obs.color;
            this.ctx.fillRect(obs.x + 6, obs.y + 12, obs.width - 12, obs.height - 12);
            // Skin
            this.ctx.fillStyle = '#ffdbac';
            this.ctx.beginPath();
            this.ctx.arc(obs.x + obs.width/2, obs.y + 8, 6, 0, 2 * Math.PI);
            this.ctx.fill();
            // Wave arm animation
            this.ctx.strokeStyle = '#ffdbac';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(obs.x + obs.width/2 + 5, obs.y + 16);
            const waveY = obs.y + 4 + Math.sin(performance.now() / 150) * 12;
            this.ctx.lineTo(obs.x + obs.width + 8, waveY);
            this.ctx.stroke();

            // Heart bubble above
            if (Math.floor(performance.now() / 300) % 2 === 0) {
                this.ctx.fillStyle = '#ff3399';
                this.ctx.font = '12px Arial';
                this.ctx.fillText("❤️", obs.x + 2, obs.y - 12);
            }
        }

        this.ctx.restore();
    }

    drawParticle(p) {
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(p.x, p.y, p.size, p.size);
    }
}

// Instantiate on window load
window.addEventListener('load', () => {
    new Game();
});

// Elephant Conservation Game Version
const GAME_VERSION = "v1.9.7";

// Simple Web Audio API sound generator
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3;
        this.initAudio();
    }
    
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    }
    
    playTone(frequency, duration = 0.2, type = 'sine', volume = null) {
        if (!this.enabled || !this.audioContext || !document.hasFocus()) return;
        
        const actualVolume = volume !== null ? volume : this.volume;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(actualVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    playChord(frequencies, duration = 0.5, type = 'sine') {
        frequencies.forEach((freq, index) => {
            setTimeout(() => this.playTone(freq, duration * 0.8, type), index * 50);
        });
    }
    
    playSequence(notes, noteDuration = 0.15) {
        notes.forEach((freq, index) => {
            setTimeout(() => this.playTone(freq, noteDuration), index * noteDuration * 1000);
        });
    }
    
    // Specific sound effects
    gameStart() {
        this.playSequence([262, 330, 392, 523], 0.2); // C, E, G, C major chord sequence
    }
    
    gameWin() {
        this.playSequence([523, 659, 784, 1047], 0.3); // C, E, G, C victory fanfare
    }
    
    gameLose() {
        this.playSequence([392, 349, 311, 262], 0.4); // Descending sad sequence
    }
    
    levelStart() {
        this.playChord([262, 330, 392], 0.4); // C major chord
    }
    
    levelEnd() {
        this.playSequence([392, 523, 659], 0.2); // Rising success notes
    }
    
    deterrentPick() {
        this.playTone(800, 0.1, 'square', 0.2); // Sharp click
    }
    
    deterrentPlace() {
        this.playTone(400, 0.3, 'triangle', 0.3); // Placement sound
    }
    
    farmDamage() {
        this.playTone(150, 0.5, 'sawtooth', 0.4); // Low warning sound
    }
    
    villagerIntercept() {
        this.playSequence([600, 500, 400], 0.1); // Alert sequence
    }
    
    elephantSafety() {
        this.playTone(660, 0.3, 'sine', 0.25); // Happy chime
    }
}

class Elephant extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'elephant');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Scale elephant to reasonable size (made slightly larger)
        this.setDisplaySize(50, 38);
        // Increase visibility with a subtle glow effect
        this.setAlpha(1.0);
        this.setTint(0xbbbbbb);
        
        // Movement properties
        this.speed = 20;
        this.migrationTarget = { x: 1250, y: y }; // Target beyond right edge
        this.isAbandoned = false;
        this.herdId = null;
        this.isAttractedToFarm = false;
        
        // Random walk properties
        this.randomWalkTimer = 0;
        this.currentDirection = { x: 1, y: 0 }; // Start moving right
        this.walkChangeInterval = Phaser.Math.Between(1000, 3000); // Change direction every 1-3 seconds
        this.rightwardBias = 0.3; // 30% bias towards moving right
        this.spawnTime = Date.now(); // Track when this elephant was spawned
        
        // Set initial velocity
        this.body.setVelocity(this.speed, 0);
        
        // Face the correct direction
        this.setFlipX(false);
        
        // Debug arrows for movement visualization
        this.debugArrows = [];
        this.movementType = 'random'; // 'random', 'deterrent_avoidance', 'farm_attraction'
        
        // Unique ID for damage tracking
        this.elephantId = Math.random().toString(36).substr(2, 9);
    }
    
    update() {
        if (this.isAbandoned) {
            // Move back to left edge
            this.body.setVelocity(-this.speed * 2, 0);
            this.setFlipX(true);
            
            // Remove if off screen (already counted as lost when villager confronted)
            if (this.x < -50) {
                this.scene.removeAbandonedElephant(this);
            }
            return;
        }
        
        // Update random walk timer
        this.randomWalkTimer += 16;
        
        // Change direction periodically for random walk
        if (this.randomWalkTimer >= this.walkChangeInterval) {
            this.chooseNewWalkDirection();
            this.randomWalkTimer = 0;
            this.walkChangeInterval = Phaser.Math.Between(1000, 3000);
        }
        
        // Base movement from random walk
        let moveX = this.currentDirection.x * this.speed;
        let moveY = this.currentDirection.y * this.speed;
        
        // Apply behavioral forces on top of random walk
        let deterrentForce = this.calculateDeterrentAvoidance();
        let farmAttraction = this.calculateFarmAttraction();
        let herdForce = this.calculateHerdBehavior();
        let migrationForce = this.calculateProgressiveMigrationForce();
        
        // Add forces (deterrent avoidance has highest priority)
        const oldMoveX = moveX;
        const oldMoveY = moveY;
        moveX += deterrentForce.x + (farmAttraction.x * 0.5) + (herdForce.x * 0.3) + migrationForce.x;
        moveY += deterrentForce.y + (farmAttraction.y * 0.5) + (herdForce.y * 0.3) + migrationForce.y;
        
        // Determine primary movement type for debug arrow
        let movementType = 'random';
        const deterrentMagnitude = Math.sqrt(deterrentForce.x * deterrentForce.x + deterrentForce.y * deterrentForce.y);
        const farmMagnitude = Math.sqrt(farmAttraction.x * farmAttraction.x + farmAttraction.y * farmAttraction.y);
        const herdMagnitude = Math.sqrt(herdForce.x * herdForce.x + herdForce.y * herdForce.y);
        const migrationMagnitude = Math.sqrt(migrationForce.x * migrationForce.x + migrationForce.y * migrationForce.y);
        
        if (deterrentMagnitude > 1) {
            movementType = 'deterrent_avoidance';
        } else if (migrationMagnitude > 1) {
            movementType = 'migration_force';
        } else if (farmMagnitude > 1) {
            movementType = 'farm_attraction';
        } else if (herdMagnitude > 1) {
            movementType = 'herd_behavior';
        }
        
        // Log movement changes when deterrent forces are applied
        if (deterrentForce.x !== 0 || deterrentForce.y !== 0) {
            console.log(`🐘 MOVEMENT: Base: (${oldMoveX.toFixed(1)}, ${oldMoveY.toFixed(1)}) → Final: (${moveX.toFixed(1)}, ${moveY.toFixed(1)})`);
        }
        
        // Physics engine now handles deterrent collisions automatically
        
        // Limit maximum speed to prevent excessive movement
        const maxSpeed = this.speed * 2;
        const currentSpeed = Math.sqrt(moveX * moveX + moveY * moveY);
        if (currentSpeed > maxSpeed) {
            const scale = maxSpeed / currentSpeed;
            moveX *= scale;
            moveY *= scale;
        }
        
        // Keep within bounds
        if (this.y < 50) moveY = Math.max(0, moveY);
        if (this.y > 550) moveY = Math.min(0, moveY);
        
        this.body.setVelocity(moveX, moveY);
        
        // Update debug arrows to show all forces
        this.updateDebugArrows({
            random: { x: this.currentDirection.x * this.speed, y: this.currentDirection.y * this.speed },
            deterrent: deterrentForce,
            farm: farmAttraction,
            herd: herdForce,
            migration: migrationForce
        });
        
        // Face movement direction
        this.setFlipX(moveX < 0);
        
        // Check if reached migration target
        if (this.x > this.migrationTarget.x) {
            this.scene.elephantReachedSafety(this);
        }
    }
    
    calculateDeterrentAvoidance() {
        // Abandoned elephants don't avoid deterrents - they just want to get home
        if (this.isAbandoned) {
            return { x: 0, y: 0 };
        }
        
        let avoidanceX = 0;
        let avoidanceY = 0;
        let deterrentsInRange = 0;
        
        this.scene.deterrents.forEach(deterrent => {
            if (deterrent.active) {
                const distance = Phaser.Math.Distance.Between(this.x, this.y, deterrent.x, deterrent.y);
                
                if (distance <= deterrent.range) {
                    deterrentsInRange++;
                    // Show deterrent range for debugging
                    deterrent.showRange();
                    
                    console.log(`🔍 DETERRENT INFLUENCE: ${deterrent.type} (${deterrent.blocking ? 'Blocking' : 'Area-Effect'}) at distance ${distance.toFixed(1)} (range: ${deterrent.range})`);
                    
                    if (deterrent.blocking) {
                        // Blocking deterrents: elephants try to avoid them completely
                        const effectiveness = 1.0; // Always 100% effectiveness for blocking
                        const angle = Phaser.Math.Angle.Between(deterrent.x, deterrent.y, this.x, this.y);
                        const force = effectiveness * this.speed * 1.0; // Strong avoidance
                        
                        avoidanceX += Math.cos(angle) * force;
                        avoidanceY += Math.sin(angle) * force;
                        
                        console.log(`   🚫 Strong blocking avoidance: (${(Math.cos(angle) * force).toFixed(1)}, ${(Math.sin(angle) * force).toFixed(1)})`);
                    } else {
                        // Area-effect deterrents: probabilistic avoidance based on effectiveness
                        const effectiveness = deterrent.effectiveness / 100;
                        const angle = Phaser.Math.Angle.Between(deterrent.x, deterrent.y, this.x, this.y);
                        const force = effectiveness * this.speed * 0.6; // Moderate avoidance
                        
                        avoidanceX += Math.cos(angle) * force;
                        avoidanceY += Math.sin(angle) * force;
                        
                        console.log(`   🌪️ Area-effect repulsion: (${(Math.cos(angle) * force).toFixed(1)}, ${(Math.sin(angle) * force).toFixed(1)})`);
                    }
                } else {
                    deterrent.hideRange();
                }
            }
        });
        
        if (deterrentsInRange > 0) {
            console.log(`📊 Total avoidance force from ${deterrentsInRange} deterrents: (${avoidanceX.toFixed(1)}, ${avoidanceY.toFixed(1)})`);
        }
        
        return { x: avoidanceX, y: avoidanceY };
    }
    
    calculateFarmAttraction() {
        let attractionX = 0;
        let attractionY = 0;
        
        this.scene.farms.forEach(farm => {
            const distance = Phaser.Math.Distance.Between(this.x, this.y, farm.x, farm.y);
            
            // Only attract to farms that aren't fully damaged and this elephant hasn't already damaged
            if (distance < 120 && farm.damageLevel < 2 && !farm.damagedByElephants.has(this.elephantId)) {
                // Elephants are attracted to undamaged or lightly damaged farms they haven't touched
                const angle = Phaser.Math.Angle.Between(this.x, this.y, farm.x, farm.y);
                const force = this.speed * 0.5 / Math.max(distance, 20);
                
                attractionX += Math.cos(angle) * force;
                attractionY += Math.sin(angle) * force;
                
                this.isAttractedToFarm = true;
            }
        });
        
        return { x: attractionX, y: attractionY };
    }
    
    calculateProgressiveMigrationForce() {
        const currentTime = Date.now();
        const elephantAge = currentTime - this.spawnTime; // Time since spawn in milliseconds
        
        // Start applying migration force after 30 seconds (30,000ms) for easier debugging
        if (elephantAge < 30000) {
            return { x: 0, y: 0 };
        }
        
        // Every 15 seconds after 30 seconds, increase force
        const timeAfterThreshold = elephantAge - 30000;
        const intervals = Math.floor(timeAfterThreshold / 15000); // Every 15 seconds
        
        // Base force starts at 5, increases by 3 every interval
        const baseForce = 5;
        const forceIncrement = 3;
        const migrationForce = baseForce + (intervals * forceIncrement);
        
        // Cap the force to prevent elephants from moving too fast
        const maxForce = this.speed * 2;
        const finalForce = Math.min(migrationForce, maxForce);
        
        // Log when migration force kicks in (limit logging to reduce spam)
        if (finalForce > 0 && Math.random() < 0.1) {
            console.log(`⏰ Migration force applied: ${finalForce} (age: ${(elephantAge/1000).toFixed(1)}s, intervals: ${intervals})`);
        }
        
        return { x: finalForce, y: 0 }; // Only rightward force
    }
    
    calculateHerdBehavior() {
        let cohesionX = 0;
        let cohesionY = 0;
        let separationX = 0;
        let separationY = 0;
        let alignmentX = 0;
        let alignmentY = 0;
        let nearbyCount = 0;
        
        this.scene.elephants.forEach(other => {
            if (other !== this && other.active && !other.isAbandoned) {
                const distance = Phaser.Math.Distance.Between(this.x, this.y, other.x, other.y);
                
                if (distance < 100) { // Herd influence radius
                    nearbyCount++;
                    
                    // Cohesion - move towards average position
                    cohesionX += other.x;
                    cohesionY += other.y;
                    
                    // Separation - avoid being too close
                    if (distance < 40) {
                        const angle = Phaser.Math.Angle.Between(other.x, other.y, this.x, this.y);
                        const force = (40 - distance) / 40;
                        separationX += Math.cos(angle) * force * this.speed * 0.2;
                        separationY += Math.sin(angle) * force * this.speed * 0.2;
                    }
                    
                    // Alignment - match velocity
                    alignmentX += other.body.velocity.x;
                    alignmentY += other.body.velocity.y;
                }
            }
        });
        
        if (nearbyCount > 0) {
            // Average cohesion force
            cohesionX = (cohesionX / nearbyCount - this.x) * 0.1;
            cohesionY = (cohesionY / nearbyCount - this.y) * 0.1;
            
            // Average alignment force
            alignmentX = (alignmentX / nearbyCount - this.body.velocity.x) * 0.1;
            alignmentY = (alignmentY / nearbyCount - this.body.velocity.y) * 0.1;
        }
        
        return {
            x: cohesionX + separationX + alignmentX,
            y: cohesionY + separationY + alignmentY
        };
    }
    
    chooseNewWalkDirection() {
        // Simple approach: decide between biased and random movement
        if (Math.random() < this.rightwardBias) {
            // Biased movement - pick direction favoring right
            const angle = Phaser.Math.FloatBetween(-Math.PI/4, Math.PI/4); // -45° to +45°
            this.currentDirection.x = Math.cos(angle);
            this.currentDirection.y = Math.sin(angle);
        } else {
            // Random movement - any direction
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            this.currentDirection.x = Math.cos(angle);
            this.currentDirection.y = Math.sin(angle);
        }
        
        // Direction choice logged only when deterrents are nearby
        if (this.scene.deterrents.some(d => d.active && Phaser.Math.Distance.Between(this.x, this.y, d.x, d.y) <= d.range)) {
            console.log(`🎯 Direction change near deterrent: x=${this.currentDirection.x.toFixed(2)}, y=${this.currentDirection.y.toFixed(2)}`);
        }
    }
    
    updateDebugArrows(forces) {
        // Debug flag to disable arrows (set to false to hide them)
        const showDebugArrows = false;
        
        // Remove old arrows
        this.debugArrows.forEach(arrow => arrow.destroy());
        this.debugArrows = [];
        
        // Early return if debug arrows are disabled
        if (!showDebugArrows) return;
        
        // Define colors for each force type
        const forceColors = {
            random: 0x00ff00,      // Green for random movement
            deterrent: 0xff0000,   // Red for deterrent avoidance
            farm: 0xffff00,        // Yellow for farm attraction
            herd: 0x0000ff,        // Blue for herd behavior
            migration: 0xff8c00     // Orange for migration force
        };
        
        // Create arrows for each force type
        Object.entries(forces).forEach(([forceType, force]) => {
            const magnitude = Math.sqrt(force.x * force.x + force.y * force.y);
            
            // Show arrows for all forces (even very small ones)
            if (magnitude > 0.01) {
                const color = forceColors[forceType];
                const maxArrowLength = 60;
                const minArrowLength = 5;
                
                // Scale arrow length proportionally to force magnitude
                // Normalize magnitude for better visualization
                const normalizedMagnitude = Math.min(magnitude / this.speed, 2);
                const arrowLength = minArrowLength + (normalizedMagnitude * (maxArrowLength - minArrowLength));
                
                const angle = Math.atan2(force.y, force.x);
                const endX = this.x + Math.cos(angle) * arrowLength;
                const endY = this.y + Math.sin(angle) * arrowLength;
                
                // Create arrow graphics
                const arrow = this.scene.add.graphics();
                arrow.lineStyle(2, color, 0.8);
                arrow.beginPath();
                arrow.moveTo(this.x, this.y);
                arrow.lineTo(endX, endY);
                arrow.stroke();
                
                // Add arrowhead
                const arrowheadSize = 6;
                const arrowheadAngle1 = angle + Math.PI - 0.3;
                const arrowheadAngle2 = angle + Math.PI + 0.3;
                
                arrow.beginPath();
                arrow.moveTo(endX, endY);
                arrow.lineTo(endX + Math.cos(arrowheadAngle1) * arrowheadSize, endY + Math.sin(arrowheadAngle1) * arrowheadSize);
                arrow.moveTo(endX, endY);
                arrow.lineTo(endX + Math.cos(arrowheadAngle2) * arrowheadSize, endY + Math.sin(arrowheadAngle2) * arrowheadSize);
                arrow.stroke();
                
                this.debugArrows.push(arrow);
            }
        });
    }
    
    abandonMigration() {
        this.isAbandoned = true;
        this.setFlipX(true);
    }
    
    destroy() {
        // Clean up debug arrows
        this.debugArrows.forEach(arrow => arrow.destroy());
        this.debugArrows = [];
        super.destroy();
    }
}

class Villager extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y) {
        const villagerType = Phaser.Math.Between(1, 2);
        super(scene, x, y, `villager_${villagerType}`);
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.setDisplaySize(24, 24);
        this.speed = 30;
        this.target = null;
        this.homeX = x;
        this.homeY = y;
        this.state = 'emerging'; // emerging, chasing, returning
        this.stateTimer = 0;
    }
    
    update() {
        this.stateTimer += 16;
        
        if (this.state === 'emerging') {
            // Wait a moment before chasing
            if (this.stateTimer > 500) {
                this.state = 'chasing';
                this.findNearestElephant();
            }
        } else if (this.state === 'chasing') {
            if (this.target && this.target.active && !this.target.isAbandoned) {
                // Move towards target elephant
                const distance = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
                
                if (distance < 40) {
                    // Confronted elephant - mark as lost immediately
                    console.log('Villager confronted elephant!');
                    this.scene.soundManager.villagerIntercept();
                    this.scene.elephantLostToVillager(this.target);
                    this.target.abandonMigration();
                    this.state = 'returning';
                    this.stateTimer = 0;
                } else {
                    // Move towards elephant
                    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
                    this.body.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
                }
            } else {
                // Target lost or abandoned - return home
                this.state = 'returning';
                this.stateTimer = 0;
            }
        } else if (this.state === 'returning') {
            // Move back to house
            const distance = Phaser.Math.Distance.Between(this.x, this.y, this.homeX, this.homeY);
            
            if (distance < 10) {
                // Reached home - disappear
                this.destroy();
                return;
            }
            
            const angle = Phaser.Math.Angle.Between(this.x, this.y, this.homeX, this.homeY);
            this.body.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
        }
    }
    
    findNearestElephant() {
        let nearestElephant = null;
        let nearestDistance = Infinity;
        
        this.scene.elephants.forEach(elephant => {
            if (elephant.active && !elephant.isAbandoned) {
                const distance = Phaser.Math.Distance.Between(this.x, this.y, elephant.x, elephant.y);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestElephant = elephant;
                }
            }
        });
        
        this.target = nearestElephant;
    }
}

class Deterrent extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, type) {
        const config = scene.getDeterrentConfig(type);
        if (!config) {
            console.error(`Unknown deterrent type: ${type}`);
            return;
        }
        
        super(scene, x, y, config.sprite);
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.type = type;
        this.cost = config.cost;
        this.effectiveness = config.effectiveness;
        this.duration = config.duration;
        this.range = config.range;
        this.size = config.size;
        this.blocking = config.blocking;
        this.timeLeft = config.duration;
        this.active = true;
        
        // Scale based on size from config
        this.setDisplaySize(this.size, this.size);
        
        // Create black outline effect using multiple sprite copies
        const outlineThickness = 1;
        
        this.outlineSprites = [];
        const directions = [
            [-outlineThickness, -outlineThickness], [0, -outlineThickness], [outlineThickness, -outlineThickness],
            [-outlineThickness, 0], [outlineThickness, 0],
            [-outlineThickness, outlineThickness], [0, outlineThickness], [outlineThickness, outlineThickness]
        ];
        
        // Set main sprite depth first
        this.setDepth(100);
        
        directions.forEach(([dx, dy]) => {
            const outlineSprite = scene.add.sprite(x + dx, y + dy, this.texture.key);
            outlineSprite.setDisplaySize(this.size, this.size);
            outlineSprite.setTint(0x964B00); // brown outline
            outlineSprite.setDepth(99); // Behind main sprite
            outlineSprite.setAlpha(1.0); // Fully opaque
            this.outlineSprites.push(outlineSprite);
            console.log(`Created outline sprite at offset (${dx}, ${dy})`);
        });
        
        console.log(`Created ${this.outlineSprites.length} outline sprites for deterrent at (${x}, ${y})`)
        
        // Set up physics body based on deterrent type
        this.body.setImmovable(true);
        
        if (this.blocking) {
            // Blocking deterrents have small collision area for physical blocking
            this.body.setCircle(this.size * 0.4);
        } else {
            // Area-effect deterrents have no physical collision, only range effect
            this.body.setCircle(this.size * 0.2);
            this.body.setSize(1, 1); // Minimal collision for area-effect deterrents
        }
        
        console.log(`🛡️ DETERRENT CREATED: ${this.type} at (${x}, ${y})`);
        console.log(`   Type: ${this.blocking ? 'Blocking' : 'Area-Effect'}, Range: ${this.range}, Size: ${this.size}, Effectiveness: ${this.effectiveness}%`);
        
        // Red circle for range visualization (always visible for debugging)
        this.rangeCircle = scene.add.circle(x, y, this.range, 0xff0000, 0.2);
        this.rangeCircle.setStrokeStyle(2, 0xff0000, 1.0);
        
        // Different visualization for blocking vs area-effect
        if (this.blocking) {
            // Blocking deterrents show a solid red circle for collision area
            this.collisionZone = scene.add.circle(x, y, this.size * 0.4, 0xff0000, 0.4);
        } else {
            // Area-effect deterrents show a dashed circle pattern
            this.rangeCircle.setAlpha(0.3);
        }
    }
    
    update(delta) {
        if (!this.active) return;
        
        this.timeLeft -= delta;
        
        // Flash when about to expire
        if (this.timeLeft < 10000) {
            this.setAlpha(0.5 + Math.sin(this.timeLeft / 200) * 0.5);
        }
        
        // Remove when expired
        if (this.timeLeft <= 0) {
            this.expire();
        }
    }
    
    expire() {
        this.active = false;
        this.rangeCircle.destroy();
        if (this.collisionZone) {
            this.collisionZone.destroy();
        }
        if (this.outlineSprites) {
            this.outlineSprites.forEach(sprite => sprite.destroy());
            this.outlineSprites = [];
        }
        this.destroy();
    }
    
    showRange() {
        this.rangeCircle.setVisible(true);
        if (this.collisionZone) {
            this.collisionZone.setVisible(true);
        }
    }
    
    hideRange() {
        this.rangeCircle.setVisible(false);
        if (this.collisionZone) {
            this.collisionZone.setVisible(false);
        }
    }
    
    isInRange(x, y) {
        const distance = Phaser.Math.Distance.Between(this.x, this.y, x, y);
        return distance <= this.range;
    }
}

class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
        this.textLines = [
            "Every year during the dry season, hundreds of Asian elephants gather at Minneriya Reservoir in Sri Lanka.",
            "This magnificent spectacle represents one of nature's greatest wildlife congregations.",
            "However, expanding human settlements block traditional migration routes.",
            "Human-elephant conflict has led to dwindling elephant populations across Asia.",
            "Only 13 countries still have wild Asian elephant populations."
        ];
        this.currentLine = 0;
        this.textObjects = [];
        this.titleComplete = false;
    }
    
    preload() {
        // Load background music if not already loaded
        if (!this.cache.audio.exists('background_music')) {
            this.load.audio('background_music', 'sprites/background_music.wav');
        }
    }
    
    create() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        
        // Create black background similar to level transition screens
        this.add.rectangle(centerX, centerY, 1200, 600, 0x000000);
        
        // Add title with large, bold text
        this.titleText = this.add.text(centerX, centerY - 200, 'The Great Elephant Gathering', {
            fontSize: '48px',
            fontFamily: 'Arial, sans-serif',
            color: '#f0f0f0',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        
        // Remove subtitle - focusing on wildlife event only
        
        // Set up spacebar key
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Start the text reveal sequence after a delay
        this.time.delayedCall(500, () => {
            this.revealNextLine();
        });
    }
    
    revealNextLine() {
        if (this.currentLine < this.textLines.length) {
            const centerX = this.cameras.main.width / 2;
            const startY = this.cameras.main.height / 2 - 50;
            
            const textObj = this.add.text(centerX, startY + (this.currentLine * 40), this.textLines[this.currentLine], {
                fontSize: '18px',
                fontFamily: 'Arial, sans-serif',
                color: '#e0e0e0',
                align: 'center',
                wordWrap: { width: 900 }
            }).setOrigin(0.5);
            
            // Fade in effect
            textObj.setAlpha(0);
            this.tweens.add({
                targets: textObj,
                alpha: 1,
                duration: 1000,
                ease: 'Power2'
            });
            
            this.textObjects.push(textObj);
            this.currentLine++;
            
            // Schedule next line or completion
            if (this.currentLine < this.textLines.length) {
                this.time.delayedCall(2500, () => {
                    this.revealNextLine();
                });
            } else {
                this.titleComplete = true;
                // Add "Press SPACE to continue" at the bottom after a delay
                this.time.delayedCall(1500, () => {
                    this.continueText = this.add.text(centerX, this.cameras.main.height - 80, 'Press [SPACE] to continue', {
                        fontSize: '20px',
                        fontFamily: 'Arial, sans-serif',
                        color: '#ffffff',
                        align: 'center'
                    }).setOrigin(0.5);
                    
                    // Add pulsing effect to continue text
                    this.tweens.add({
                        targets: this.continueText,
                        alpha: 0.6,
                        duration: 800,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Power2'
                    });
                });
            }
        }
    }
    
    update() {
        // Allow skipping to game intro after title sequence completes
        if (this.titleComplete && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.scene.start('GameIntroScene');
        }
    }
}

class GameIntroScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameIntroScene' });
        this.textLines = [
            "Your objective is to guide elephant herds safely through human settlements.",
            "Use deterrents to create safe passages without harming the elephants.",
            "Some deterrents physically block paths, while others create areas elephants prefer to avoid.",
            "Your goal: Save elephants while protecting the farms",
            "Balance your budget carefully - every deterrent costs money."
        ];
        this.currentLine = 0;
        this.textObjects = [];
        this.titleComplete = false;
    }
    
    preload() {
        // No additional assets needed
    }
    
    create() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        
        // Create black background
        this.add.rectangle(centerX, centerY, 1200, 600, 0x000000);
        
        // Add title
        this.titleText = this.add.text(centerX, centerY - 200, 'Game Objective', {
            fontSize: '42px',
            fontFamily: 'Arial, sans-serif',
            color: '#f0f0f0',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        
        // Set up spacebar key
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Start the text reveal sequence after a delay
        this.time.delayedCall(1500, () => {
            this.revealNextLine();
        });
    }
    
    revealNextLine() {
        if (this.currentLine < this.textLines.length) {
            const centerX = this.cameras.main.width / 2;
            const startY = this.cameras.main.height / 2 - 80;
            
            const textObj = this.add.text(centerX, startY + (this.currentLine * 35), this.textLines[this.currentLine], {
                fontSize: '18px',
                fontFamily: 'Arial, sans-serif',
                color: '#e0e0e0',
                align: 'center',
                wordWrap: { width: 900 }
            }).setOrigin(0.5);
            
            // Fade in effect
            textObj.setAlpha(0);
            this.tweens.add({
                targets: textObj,
                alpha: 1,
                duration: 1000,
                ease: 'Power2'
            });
            
            this.textObjects.push(textObj);
            this.currentLine++;
            
            // Schedule next line or completion
            if (this.currentLine < this.textLines.length) {
                this.time.delayedCall(2200, () => {
                    this.revealNextLine();
                });
            } else {
                this.titleComplete = true;
                // Add "Press SPACE to continue" at the bottom after a delay
                this.time.delayedCall(1500, () => {
                    this.continueText = this.add.text(centerX, this.cameras.main.height - 80, 'Press [SPACE] to continue', {
                        fontSize: '20px',
                        fontFamily: 'Arial, sans-serif',
                        color: '#ffffff',
                        align: 'center'
                    }).setOrigin(0.5);
                    
                    // Add pulsing effect to continue text
                    this.tweens.add({
                        targets: this.continueText,
                        alpha: 0.6,
                        duration: 800,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Power2'
                    });
                });
            }
        }
    }
    
    update() {
        // Allow skipping to game after sequence completes
        if (this.titleComplete && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.scene.start('GameScene');
        }
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.budget = 500;
        this.wave = 1;
        this.saved = 0;
        this.farms = [];
        this.houses = [];
        this.elephants = [];
        this.elephantSpawnTimer = 0;
        this.deterrents = [];
        this.selectedDeterrent = null;
        this.villagers = [];
        
        // Level-based game management
        this.levelsConfig = null;
        this.deterrentsConfig = null;
        this.currentLevel = 0; // 0-based index
        this.currentHerd = 0; // 0-based index within current level
        this.maxHerdsPerLevel = 3;
        this.elephantsPerHerd = 8;
        this.elephantsSpawnedInHerd = 0;
        this.elephantsFinishedInHerd = 0; // Track elephants that reached safety or were lost
        this.timeBetweenHerds = 12000; // 12 seconds between herds
        this.herdSpawnTimer = 0;
        this.gameState = 'level_transition'; // level_transition, playing, won, lost
        this.lossReason = null; // 'farms' or 'elephants'
        this.totalElephants = 0;
        this.elephantsLost = 0;
        this.herdComplete = false; // Track if current herd is fully spawned
        
        // Transition screen elements
        this.transitionText = null;
        this.transitionSubtext = null;
        
        // Farm damage tracking
        this.damagedFarmsCount = 0;
        
        // Elephant loss tracking for current herd
        this.elephantsLostThisHerd = 0;
        
        // Sound manager
        this.soundManager = new SoundManager();
    }

    preload() {
        // Add loading progress display
        this.load.on('progress', (value) => {
            console.log('Loading progress:', value);
        });
        
        this.load.on('complete', () => {
            console.log('All assets loaded');
        });
        
        this.load.on('loaderror', (file) => {
            console.error('Failed to load:', file.src);
        });
        
        // Add cache-busting timestamp for development
        const cacheBuster = `?v=${Date.now()}`;
        
        // Load levels configuration
        this.load.json('levels', `levels.config${cacheBuster}`);
        
        // Load deterrents configuration
        this.load.json('deterrents', `deterrents.config${cacheBuster}`);
        
        // Load all sprites
        this.load.image('elephant', `sprites/elephant.png${cacheBuster}`);
        this.load.image('farm', `sprites/farm.png${cacheBuster}`);
        this.load.image('house_1', `sprites/house_1.png${cacheBuster}`);
        this.load.image('house_2', `sprites/house_2.png${cacheBuster}`);
        this.load.image('villager_1', `sprites/villager_1.png${cacheBuster}`);
        this.load.image('villager_2', `sprites/villager_2.png${cacheBuster}`);
        
        // Load deterrent sprites
        this.load.image('electric_fence', `sprites/electric_fence.png${cacheBuster}`);
        this.load.image('trench', `sprites/trench.png${cacheBuster}`);
        this.load.image('bee_hive', `sprites/bee_hive.png${cacheBuster}`);
        this.load.image('citrus_tree', `sprites/citrus_tree.png${cacheBuster}`);
        this.load.image('thorns', `sprites/thorns.png${cacheBuster}`);
        
        // Load background tiles
        for (let i = 1; i <= 9; i++) {
            this.load.image(`background_${i}`, `sprites/background_${i}.png${cacheBuster}`);
        }
        
        // Load trees for decoration
        this.load.image('tree_1', `sprites/tree_1.png${cacheBuster}`);
        this.load.image('tree_2', `sprites/tree_2.png${cacheBuster}`);
        
        // Load background music
        this.load.audio('background_music', `sprites/background_music.wav${cacheBuster}`);
    }

    create() {
        const gameWidth = 1200;
        const gameHeight = 600;
        
        // Display version in console
        console.log(`🐘 Elephant Conservation Game ${GAME_VERSION}`);
        
        // Load levels configuration
        this.loadLevelsConfiguration();
        
        // Set up input for deterrent placement
        this.input.on('pointerdown', (pointer) => {
            this.handleClick(pointer.x, pointer.y);
        });
        
        // Set up deterrent selection buttons
        this.setupDeterrentButtons();
        
        // Set up sound toggle
        this.setupSoundToggle();
        
        // Set up spacebar key for level transitions
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Show level transition screen
        this.showLevelTransition();
        
        // Play game start sound
        this.soundManager.gameStart();
        
        // Set up background music
        this.backgroundMusic = this.sound.add('background_music', { 
            loop: true, 
            volume: 0.3 
        });
        
        // Start background music if sound is enabled
        if (this.soundManager.enabled) {
            this.backgroundMusic.play();
        }
    }

    createTiledBackground(width, height) {
        // Check if background sprites loaded properly
        const testTexture = this.textures.get('background_1');
        if (!testTexture || testTexture.key === '__MISSING') {
            console.error('Background textures not loaded properly');
            // Create a simple colored background as fallback
            const graphics = this.add.graphics();
            graphics.fillStyle(0x4a7c59);
            graphics.fillRect(0, 0, width, height);
            return;
        }
        
        // Get actual sprite dimensions
        const spriteWidth = testTexture.source[0].width;
        const spriteHeight = testTexture.source[0].height;
        console.log(`Sprite dimensions: ${spriteWidth}x${spriteHeight}`);
        
        // Use a reasonable tile size for the game (64x64 pixels)
        const tileSize = 64;
        const tilesX = Math.ceil(width / tileSize);
        const tilesY = Math.ceil(height / tileSize);
        
        console.log(`Creating ${tilesX}x${tilesY} tiles of size ${tileSize}x${tileSize}`);
        
        // Create a shuffled array of tile numbers to ensure variety
        const totalTiles = tilesX * tilesY;
        const tileNumbers = [];
        
        // Fill array with repeating pattern of all 9 tiles
        for (let i = 0; i < totalTiles; i++) {
            tileNumbers.push((i % 9) + 1);
        }
        
        // Shuffle the array for random distribution
        Phaser.Utils.Array.Shuffle(tileNumbers);
        
        let tileIndex = 0;
        for (let x = 0; x < tilesX; x++) {
            for (let y = 0; y < tilesY; y++) {
                const tileNum = tileNumbers[tileIndex];
                const tile = this.add.image(x * tileSize, y * tileSize, `background_${tileNum}`);
                tile.setOrigin(0, 0);
                // Scale sprite to fit tile size
                tile.setDisplaySize(tileSize, tileSize);
                // Dim the background slightly
                tile.setAlpha(0.9);
                tileIndex++;
            }
        }
    }

    generateFarms() {
        const gameWidth = 1200;
        const gameHeight = 600;
        const numFarms = this.getCurrentLevelConfig().farms;
        
        for (let i = 0; i < numFarms; i++) {
            let x, y;
            let validPosition = false;
            let attempts = 0;
            
            // Try to find a valid position (not too close to other farms)
            while (!validPosition && attempts < 50) {
                // Don't spawn farms in the leftmost quarter (elephant migration zone)
                x = Phaser.Math.Between(gameWidth / 4, gameWidth - 100);
                y = Phaser.Math.Between(100, gameHeight - 100);
                
                validPosition = true;
                for (let farm of this.farms) {
                    const distance = Phaser.Math.Distance.Between(x, y, farm.x, farm.y);
                    if (distance < 120) {
                        validPosition = false;
                        break;
                    }
                }
                attempts++;
            }
            
            if (validPosition) {
                const farm = this.add.image(x, y, 'farm');
                farm.setOrigin(0.5, 0.5);
                // Scale farm to reasonable size
                farm.setDisplaySize(80, 50);
                farm.damageLevel = 0; // 0 = undamaged, 1 = half damaged, 2 = fully damaged
                farm.damageTimer = 0;
                farm.damagedByElephants = new Set(); // Track which elephants have damaged this farm
                this.farms.push(farm);
                console.log(`🌾 Farm ${i + 1} created at (${x}, ${y}) for level ${this.currentLevel + 1}`);
            }
        }
    }

    generateHouses() {
        const gameWidth = 1200;
        const gameHeight = 600;
        const numHouses = this.getCurrentLevelConfig().houses;
        
        console.log(`🏠 Generating ${numHouses} houses for level ${this.currentLevel + 1}`);
        
        // Generate specified number of houses
        for (let i = 0; i < numHouses; i++) {
            let x, y;
            let validPosition = false;
            let attempts = 0;
            
            while (!validPosition && attempts < 50) {
                // Place house randomly in the game area
                x = Phaser.Math.Between(80, gameWidth - 80);
                y = Phaser.Math.Between(80, gameHeight - 80);
                
                validPosition = true; // Reset for this attempt
                
                // Check distance from other houses
                for (let house of this.houses) {
                    const houseDistance = Phaser.Math.Distance.Between(x, y, house.x, house.y);
                    if (houseDistance < 80) {
                        validPosition = false;
                        break;
                    }
                }
                
                // Check distance from farms (shouldn't be too close)
                if (validPosition) {
                    for (let farm of this.farms) {
                        const farmDistance = Phaser.Math.Distance.Between(x, y, farm.x, farm.y);
                        if (farmDistance < 60) {
                            validPosition = false;
                            break;
                        }
                    }
                }
                
                attempts++;
            }
            
            if (validPosition) {
                const houseType = Phaser.Math.Between(1, 2);
                const house = this.add.image(x, y, `house_${houseType}`);
                house.setOrigin(0.5, 0.5);
                // Scale house to reasonable size
                house.setDisplaySize(60, 60);
                this.houses.push(house);
                console.log(`🏠 House ${i + 1} placed at (${x}, ${y})`);
            } else {
                console.log(`🏠 Failed to place house ${i + 1} after ${attempts} attempts`);
            }
        }
    }

    updateUI() {
        document.getElementById('version').textContent = GAME_VERSION;
        document.getElementById('budget').textContent = this.budget;
        document.getElementById('level').textContent = this.currentLevel + 1;
        document.getElementById('herd').textContent = this.currentHerd + 1;
        document.getElementById('herd-progress').textContent = `${this.elephantsFinishedInHerd}/${this.elephantsPerHerd}`;
        document.getElementById('saved').textContent = this.saved;
        document.getElementById('lost').textContent = this.elephantsLost;
        document.getElementById('damaged-farms').textContent = this.damagedFarmsCount;
        document.getElementById('lost-this-herd').textContent = this.elephantsLostThisHerd;
        
        const total = this.saved + this.elephantsLost;
        const successRate = total > 0 ? Math.round((this.saved / total) * 100) : 0;
        document.getElementById('success-rate').textContent = `${successRate}%`;
        
        // Update game status
        const statusElement = document.getElementById('game-status');
        if (this.gameState === 'won') {
            statusElement.textContent = '🎉 Victory! All herds migrated safely!';
            statusElement.style.color = '#4ade80';
        } else if (this.gameState === 'lost') {
            if (this.lossReason === 'farms') {
                statusElement.textContent = '💔 Defeat! Too many farms destroyed!';
            } else if (this.lossReason === 'elephants') {
                statusElement.textContent = '💔 Defeat! Too many elephants lost!';
            } else {
                statusElement.textContent = '💔 Defeat!';
            }
            statusElement.style.color = '#ef4444';
        } else if (this.currentHerd >= this.maxHerdsPerLevel - 1 && this.currentLevel + 1 >= this.levelsConfig.levels.length) {
            statusElement.textContent = '⏳ Final herd migrating...';
            statusElement.style.color = '#fbbf24';
        } else {
            if (this.herdComplete) {
                statusElement.textContent = `Waiting for herd ${this.currentHerd + 1} to finish...`;
                statusElement.style.color = '#fbbf24';
            } else {
                statusElement.textContent = `Spawning herd ${this.currentHerd + 1}...`;
                statusElement.style.color = '#94a3b8';
            }
        }
        
        // Update deterrent button states
        this.updateDeterrentButtons();
    }
    
    setupDeterrentButtons() {
        this.updateDeterrentMenu();
        
        document.getElementById('clear-selection').addEventListener('click', () => {
            this.clearSelection();
        });
    }
    
    updateDeterrentMenu() {
        const container = document.getElementById('deterrent-buttons-container');
        container.innerHTML = ''; // Clear existing buttons
        
        const availableDeterrents = this.getAvailableDeterrents();
        
        Object.entries(availableDeterrents).forEach(([type, config]) => {
            const button = document.createElement('button');
            button.className = 'deterrent-button tooltip';
            button.dataset.type = type;
            
            // Create tooltip text
            const durationSec = Math.round(config.duration / 1000);
            const durationMin = durationSec > 60 ? `${Math.round(durationSec/60)}min` : `${durationSec}s`;
            const tooltip = `${config.effectiveness}% effective, ${durationMin} duration, ${config.range}px range`;
            button.dataset.tooltip = tooltip;
            
            // Create button content with sprite image and text
            const spriteImg = document.createElement('img');
            spriteImg.src = `sprites/${config.sprite}.png`;
            spriteImg.style.width = '20px';
            spriteImg.style.height = '20px';
            spriteImg.style.marginRight = '5px';
            spriteImg.style.verticalAlign = 'middle';
            
            const textSpan = document.createElement('span');
            textSpan.textContent = `${config.name} - Rs.${config.cost}`;
            textSpan.style.verticalAlign = 'middle';
            
            button.appendChild(spriteImg);
            button.appendChild(textSpan);
            
            button.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type; // Use currentTarget to get button's data
                this.selectDeterrent(type);
            });
            
            container.appendChild(button);
        });
        
        console.log(`🛡️ Level ${this.currentLevel + 1}: ${Object.keys(availableDeterrents).length} deterrents available`);
    }
    
    updateDeterrentButtons() {
        const buttons = document.querySelectorAll('.deterrent-button[data-type]');
        buttons.forEach(button => {
            const type = button.dataset.type;
            const config = this.getDeterrentConfig(type);
            if (config) {
                const canAfford = this.budget >= config.cost;
                
                button.disabled = !canAfford;
                button.classList.toggle('selected', this.selectedDeterrent === type);
            }
        });
    }
    
    selectDeterrent(type) {
        this.selectedDeterrent = type;
        this.updateDeterrentButtons();
        this.soundManager.deterrentPick();
        console.log(`Selected deterrent: ${type}`);
    }
    
    clearSelection() {
        this.selectedDeterrent = null;
        this.updateDeterrentButtons();
        console.log('Cleared deterrent selection');
    }
    
    setupSoundToggle() {
        const soundToggle = document.getElementById('sound-toggle');
        soundToggle.addEventListener('click', () => {
            this.soundManager.enabled = !this.soundManager.enabled;
            soundToggle.textContent = this.soundManager.enabled ? '🔊' : '🔇';
            
            // Control background music
            if (this.backgroundMusic) {
                if (this.soundManager.enabled) {
                    this.backgroundMusic.resume();
                } else {
                    this.backgroundMusic.pause();
                }
            }
            
            console.log(`Sound ${this.soundManager.enabled ? 'enabled' : 'disabled'}`);
        });
    }
    
    handleClick(x, y) {
        if (this.selectedDeterrent) {
            this.placeDeterrent(x, y, this.selectedDeterrent);
        }
    }
    
    placeDeterrent(x, y, type) {
        const config = this.getDeterrentConfig(type);
        if (!config) {
            console.log(`Unknown deterrent type: ${type}`);
            return;
        }
        
        const cost = config.cost;
        
        if (this.budget < cost) {
            console.log('Not enough budget!');
            return;
        }
        
        // Check if position is valid (not too close to farms/houses)
        const minDistance = 40;
        const tooCloseToFarm = this.farms.some(farm => 
            Phaser.Math.Distance.Between(x, y, farm.x, farm.y) < minDistance
        );
        const tooCloseToHouse = this.houses.some(house => 
            Phaser.Math.Distance.Between(x, y, house.x, house.y) < minDistance
        );
        
        if (tooCloseToFarm || tooCloseToHouse) {
            console.log('Cannot place deterrent too close to buildings!');
            return;
        }
        
        // Create deterrent
        const deterrent = new Deterrent(this, x, y, type);
        this.deterrents.push(deterrent);
        
        // Set up collisions with existing elephants
        this.elephants.forEach(elephant => {
            if (elephant.active) {
                this.physics.add.collider(elephant, deterrent, (elephant, deterrent) => {
                    console.log(`🚫 COLLISION: Elephant hit newly placed ${deterrent.type} at (${deterrent.x}, ${deterrent.y})`);
                });
            }
        });
        
        // Deduct cost
        this.budget -= cost;
        this.updateUI();
        
        this.soundManager.deterrentPlace();
        console.log(`Placed ${type} at (${x}, ${y}) for Rs.${cost}`);
    }
    
    startNewHerd() {
        const levelConfig = this.getCurrentLevelConfig();
        if (this.currentHerd < this.maxHerdsPerLevel) {
            // Get elephant count from current herd configuration
            const herdConfig = this.getCurrentHerdConfig();
            this.elephantsPerHerd = herdConfig.elephants;
            
            this.elephantsSpawnedInHerd = 0;
            this.elephantsFinishedInHerd = 0;
            this.herdComplete = false;
            this.herdSpawnTimer = this.timeBetweenHerds;
            this.elephantsLostThisHerd = 0; // Reset elephants lost count for new herd
            console.log(`Starting herd ${this.currentHerd + 1} of level ${this.currentLevel + 1} with ${this.elephantsPerHerd} elephants`);
            this.updateUI(); // Update UI when new herd starts
        }
    }
    
    completeCurrentHerd() {
        this.currentHerd++;
        console.log(`Completed herd ${this.currentHerd}/${this.maxHerdsPerLevel} of level ${this.currentLevel + 1}`);
        
        if (this.currentHerd >= this.maxHerdsPerLevel) {
            // All herds in current level completed
            if (this.currentLevel + 1 >= this.levelsConfig.levels.length) {
                // All levels completed - end game
                this.checkGameEnd();
            } else {
                // Move to next level
                this.advanceToNextLevel();
            }
        } else {
            this.startNewHerd();
        }
    }
    
    advanceToNextLevel() {
        this.soundManager.levelEnd();
        this.initializeLevel(this.currentLevel + 1);
        
        // Set state to transition and show transition screen
        this.gameState = 'level_transition';
        this.showLevelTransition();
        
        console.log(`🎉 Advanced to Level ${this.currentLevel + 1}: ${this.getCurrentLevelConfig().name}`);
    }
    
    clearLevel() {
        // Clear existing farms
        this.farms.forEach(farm => farm.destroy());
        this.farms = [];
        
        // Clear existing houses
        this.houses.forEach(house => house.destroy());
        this.houses = [];
        
        // Clear any remaining elephants
        this.elephants.forEach(elephant => elephant.destroy());
        this.elephants = [];
        
        // Clear villagers
        this.villagers.forEach(villager => villager.destroy());
        this.villagers = [];
        
        // Clear deterrents
        this.deterrents.forEach(deterrent => deterrent.destroy());
        this.deterrents = [];
    }
    
    checkGameEnd() {
        // Game ends when all levels are completed
        const activeElephants = this.elephants.length;
        
        // Check if all levels are completed
        if (this.currentLevel + 1 >= this.levelsConfig.levels.length && 
            this.currentHerd >= this.maxHerdsPerLevel && 
            activeElephants === 0) {
            
            const successRate = this.saved / (this.saved + this.elephantsLost);
            
            if (successRate >= 0.6) { // 60% success rate needed to win
                this.gameState = 'won';
                this.soundManager.gameWin();
            } else {
                this.gameState = 'lost';
                this.lossReason = 'low_success';
                this.soundManager.gameLose();
            }
            
            this.updateUI();
            console.log(`Game ended! Success rate: ${Math.round(successRate * 100)}%`);
            
            // Show restart option after a delay
            setTimeout(() => {
                const restart = confirm(`Game Over! Success Rate: ${Math.round(successRate * 100)}%\n\nClick OK to restart.`);
                if (restart) {
                    location.reload();
                }
            }, 3000);
        }
    }
    
    spawnElephant() {
        if (this.gameState !== 'playing') return;
        
        // Check if we can spawn more elephants in current herd
        if (this.elephantsSpawnedInHerd >= this.elephantsPerHerd) return;
        
        // Spawn elephant at random Y position on left edge
        const y = Phaser.Math.Between(100, 500);
        const elephant = new Elephant(this, -30, y);
        elephant.herdId = this.currentHerd;
        this.elephants.push(elephant);
        
        // Set up collision detection with each farm individually
        this.farms.forEach(farm => {
            this.physics.add.overlap(elephant, farm, (elephant, farm) => {
                this.handleElephantFarmCollision(elephant, farm);
            });
        });
        
        console.log(`🐘 Elephant collision detection set up with ${this.farms.length} farms (Level ${this.currentLevel + 1})`);
        
        // Set up physical collisions only with blocking deterrents
        this.deterrents.forEach(deterrent => {
            if (deterrent.active && deterrent.blocking) {
                this.physics.add.collider(elephant, deterrent, (elephant, deterrent) => {
                    // Don't block abandoned elephants - they're just trying to get home
                    if (elephant.isAbandoned) {
                        return false; // Allow elephant to pass through
                    }
                    
                    console.log(`🚫 BLOCKED: Elephant hit ${deterrent.type} blocking deterrent at (${deterrent.x}, ${deterrent.y})`);
                    console.log(`   Elephant velocity before: (${elephant.body.velocity.x.toFixed(1)}, ${elephant.body.velocity.y.toFixed(1)})`);
                    // The physics engine will handle the collision automatically for blocking deterrents
                });
            }
        });
        
        this.elephantsSpawnedInHerd++;
        this.totalElephants++;
        
        console.log(`Spawned elephant ${this.elephantsSpawnedInHerd}/${this.elephantsPerHerd} in herd ${this.currentHerd + 1}`);
        
        // Mark herd spawning as complete if we've spawned all elephants
        if (this.elephantsSpawnedInHerd >= this.elephantsPerHerd) {
            this.herdComplete = true;
            console.log(`Herd ${this.currentHerd + 1} spawning complete. Waiting for all elephants to finish...`);
        }
    }
    
    handleElephantFarmCollision(elephant, farm) {
        // Only process if farm can take more damage and this elephant hasn't damaged this farm yet
        if (farm.damageLevel < 2 && !farm.damagedByElephants.has(elephant.elephantId)) {
            farm.damageTimer += 16;
            
            // Debug logging
            if (Math.random() < 0.05) {
                console.log(`🌾 Farm damage timer: ${farm.damageTimer}ms (Level ${this.currentLevel + 1}, Elephant ${elephant.elephantId.substr(0,3)})`);
            }
            
            // Farm gets damaged after 2 seconds of continuous contact
            if (farm.damageTimer > 2000) {
                this.damageFarm(farm, elephant);
            }
        }
    }
    
    damageFarm(farm, elephant) {
        // Mark this elephant as having damaged this farm
        farm.damagedByElephants.add(elephant.elephantId);
        farm.damageTimer = 0; // Reset timer
        
        // Increase damage level
        farm.damageLevel++;
        
        // Apply visual damage based on level
        if (farm.damageLevel === 1) {
            // Half damage - light red tint
            farm.setTint(0xff9999);
            this.soundManager.farmDamage();
            console.log(`🌾 Farm half-damaged by elephant ${elephant.elephantId.substr(0,3)}`);
        } else if (farm.damageLevel === 2) {
            // Full damage - dark red tint
            farm.setTint(0xff3333);
            this.damagedFarmsCount++;
            this.soundManager.farmDamage();
            
            // Spawn villager from nearest house for fully damaged farms
            this.spawnVillagerForFarm(farm);
            
            console.log(`🌾 Farm fully damaged by elephant ${elephant.elephantId.substr(0,3)}! Total damaged: ${this.damagedFarmsCount}`);
            
            // Check for game loss condition
            if (this.damagedFarmsCount >= 3) {
                this.gameState = 'lost';
                this.lossReason = 'farms';
                this.soundManager.gameLose();
                console.log('💔 Game Over! Too many farms damaged!');
            }
        }
        
        // Update UI to reflect changes
        this.updateUI();
    }
    
    spawnVillagerForFarm(farm) {
        // Find nearest house to this farm
        let nearestHouse = null;
        let nearestDistance = Infinity;
        
        this.houses.forEach(house => {
            const distance = Phaser.Math.Distance.Between(farm.x, farm.y, house.x, house.y);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestHouse = house;
            }
        });
        
        if (nearestHouse) {
            const villager = new Villager(this, nearestHouse.x, nearestHouse.y);
            this.villagers.push(villager);
        }
    }
    
    elephantReachedSafety(elephant) {
        // Remove elephant and increment saved count
        this.saved++;
        
        // Add budget reward for saving elephant
        this.budget += 10;
        
        // Track if this elephant is from current herd
        if (elephant.herdId === this.currentHerd) {
            this.elephantsFinishedInHerd++;
        }
        
        this.soundManager.elephantSafety();
        this.updateUI();
        
        // Remove from array
        const index = this.elephants.indexOf(elephant);
        if (index > -1) {
            this.elephants.splice(index, 1);
        }
        
        elephant.destroy();
        console.log(`Elephant reached safety! Total saved: ${this.saved}, Budget: Rs.${this.budget} (+Rs.10)`);
        
        // Check if current herd is complete
        this.checkHerdCompletion();
        
        // Check if game should end
        this.checkGameEnd();
    }
    
    elephantLostToVillager(elephant) {
        // Called when villager confronts elephant (immediate loss)
        this.elephantsLost++;
        this.elephantsLostThisHerd++;
        
        // Track if this elephant is from current herd
        if (elephant.herdId === this.currentHerd) {
            this.elephantsFinishedInHerd++;
        }
        
        this.updateUI();
        
        console.log(`🏃‍♂️ Elephant chased away by villager! Lost this herd: ${this.elephantsLostThisHerd}, Total lost: ${this.elephantsLost}`);
        
        // Check for game loss condition - 3 elephants lost in current herd
        if (this.elephantsLostThisHerd >= 3) {
            this.gameState = 'lost';
            this.lossReason = 'elephants';
            this.soundManager.gameLose();
            console.log('💔 Game Over! Too many elephants lost in this herd!');
        }
        
        // Check if current herd is complete
        this.checkHerdCompletion();
        
        // Check if game should end
        this.checkGameEnd();
    }
    
    removeAbandonedElephant(elephant) {
        // Remove abandoned elephant that has reached the left edge (already counted as lost)
        const index = this.elephants.indexOf(elephant);
        if (index > -1) {
            this.elephants.splice(index, 1);
        }
        
        elephant.destroy();
        console.log(`🐘 Abandoned elephant removed from screen`);
    }
    
    elephantLost(elephant) {
        // Called when elephant abandons migration or is lost
        this.elephantsLost++;
        
        // Track if this elephant is from current herd
        if (elephant.herdId === this.currentHerd) {
            this.elephantsFinishedInHerd++;
        }
        
        this.updateUI();
        
        // Remove from array
        const index = this.elephants.indexOf(elephant);
        if (index > -1) {
            this.elephants.splice(index, 1);
        }
        
        console.log(`Elephant lost! Total lost: ${this.elephantsLost}`);
        
        // Check if current herd is complete
        this.checkHerdCompletion();
        
        // Check if game should end
        this.checkGameEnd();
    }
    
    loadLevelsConfiguration() {
        this.levelsConfig = this.cache.json.get('levels');
        this.deterrentsConfig = this.cache.json.get('deterrents');
        
        if (!this.levelsConfig || !this.levelsConfig.levels) {
            console.error('Failed to load levels configuration');
            // Fallback to default configuration
            this.levelsConfig = {
                levels: [{
                    id: 1,
                    name: "Default Level",
                    farms: 4,
                    houses: 2,
                    herds: [
                        { elephants: 8 },
                        { elephants: 10 },
                        { elephants: 12 }
                    ]
                }]
            };
        }
        
        if (!this.deterrentsConfig || !this.deterrentsConfig.deterrents) {
            console.error('Failed to load deterrents configuration');
            // Fallback to basic configuration
            this.deterrentsConfig = {
                deterrents: {
                    thorny_bush: {
                        name: "Thorny Bush",
                        cost: 20,
                        effectiveness: 50,
                        duration: 200000,
                        range: 50,
                        unlockLevel: 1
                    }
                }
            };
        }
        
        // Set up first level
        this.initializeLevel(0);
        
        console.log(`📊 Loaded ${this.levelsConfig.levels.length} levels`);
        console.log(`🛡️ Loaded ${Object.keys(this.deterrentsConfig.deterrents).length} deterrent types`);
        console.log(`🎮 Starting Level ${this.currentLevel + 1}: ${this.getCurrentLevelConfig().name}`);
    }
    
    initializeLevel(levelIndex) {
        this.currentLevel = levelIndex;
        this.currentHerd = 0;
        this.elephantsFinishedInHerd = 0;
        this.elephantsSpawnedInHerd = 0;
        this.herdComplete = false;
        this.damagedFarmsCount = 0; // Reset damaged farms count for new level
        
        const levelConfig = this.getCurrentLevelConfig();
        this.elephantsPerHerd = levelConfig.herds[0].elephants;
        
        console.log(`🎯 Level ${levelIndex + 1} initialized: ${levelConfig.farms} farms, ${levelConfig.houses} houses`);
    }
    
    getNewDeterrentsForLevel(level) {
        if (!this.deterrentsConfig) return [];
        
        const newDeterrents = [];
        Object.entries(this.deterrentsConfig.deterrents).forEach(([type, config]) => {
            if (config.unlockLevel === level) {
                newDeterrents.push({
                    type,
                    name: config.name,
                    description: config.description,
                    cost: config.cost,
                    blocking: config.blocking
                });
            }
        });
        
        return newDeterrents;
    }

    showLevelTransition() {
        // Clear any existing level content
        this.clearLevel();
        
        // Create dark background
        const gameWidth = 1200;
        const gameHeight = 600;
        const overlay = this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x000000, 0.8);
        
        // Get current level config
        const levelConfig = this.getCurrentLevelConfig();
        
        // Main level text
        this.transitionText = this.add.text(gameWidth / 2, gameHeight / 2 - 50, `LEVEL ${this.currentLevel + 1}`, {
            fontSize: '64px',
            fontFamily: 'Arial, sans-serif',
            fill: '#ffffff',
            fontStyle: 'bold'
        });
        this.transitionText.setOrigin(0.5);
        
        // Level name
        const levelName = this.add.text(gameWidth / 2, gameHeight / 2, levelConfig.name, {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            fill: '#fbbf24'
        });
        levelName.setOrigin(0.5);
        
        // Instructions
        this.transitionSubtext = this.add.text(gameWidth / 2, gameHeight / 2 + 80, 'Press [SPACE] to continue', {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            fill: '#94a3b8'
        });
        this.transitionSubtext.setOrigin(0.5);
        
        // Level details
        const details = `${levelConfig.farms} Farms • ${levelConfig.houses} Houses • ${levelConfig.herds.length} Herds`;
        const detailsText = this.add.text(gameWidth / 2, gameHeight / 2 + 120, details, {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fill: '#6b7280'
        });
        detailsText.setOrigin(0.5);
        
        // Get newly unlocked deterrents for this level
        const newDeterrents = this.getNewDeterrentsForLevel(this.currentLevel + 1);
        let newDeterrentText = null;
        
        if (newDeterrents.length > 0) {
            const deterrentNames = newDeterrents.map(d => d.name).join(', ');
            const unlockMessage = `New Deterrents Unlocked: ${deterrentNames}`;
            
            newDeterrentText = this.add.text(gameWidth / 2, gameHeight / 2 + 150, unlockMessage, {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                fill: '#6b7280'
            });
            newDeterrentText.setOrigin(0.5);
            
            // Add deterrent descriptions
            const descriptions = newDeterrents.map(d => `• ${d.name}: ${d.description}`).join('\n');
            const descriptionText = this.add.text(gameWidth / 2, gameHeight / 2 + 180, descriptions, {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                fill: '#6b7280',
                align: 'center',
                wordWrap: { width: 900 }
            });
            descriptionText.setOrigin(0.5);
            
            // Store transition elements for cleanup
            this.transitionElements = [overlay, this.transitionText, levelName, this.transitionSubtext, detailsText, newDeterrentText, descriptionText];
        } else {
            // Store transition elements for cleanup
            this.transitionElements = [overlay, this.transitionText, levelName, this.transitionSubtext, detailsText];
        }
        
        console.log(`🎬 Level ${this.currentLevel + 1} transition screen shown`);
    }
    
    startLevel() {
        // Clear transition screen
        if (this.transitionElements) {
            this.transitionElements.forEach(element => element.destroy());
            this.transitionElements = null;
        }
        
        // Create level content
        const gameWidth = 1200;
        const gameHeight = 600;
        
        // Create tiled background
        this.createTiledBackground(gameWidth, gameHeight);
        
        // Generate farms and houses
        this.generateFarms();
        this.generateHouses();
        
        // Enable physics for farms and houses
        this.farms.forEach(farm => {
            this.physics.add.existing(farm);
            farm.body.setImmovable(true);
        });
        
        this.houses.forEach(house => {
            this.physics.add.existing(house);
            house.body.setImmovable(true);
        });
        
        // Update UI
        this.updateUI();
        
        // Update deterrent menu for new level
        this.updateDeterrentMenu();
        
        // Change game state to playing
        this.gameState = 'playing';
        
        // Start first herd
        this.elephantSpawnTimer = 2000; // First elephant after 2 seconds
        this.startNewHerd();
        
        // Play level start sound
        this.soundManager.levelStart();
        
        console.log(`🎮 Level ${this.currentLevel + 1} started`);
    }
    
    getCurrentLevelConfig() {
        const levelConfig = this.levelsConfig.levels[this.currentLevel];
        if (!levelConfig) {
            console.error(`🚨 No level config found for level ${this.currentLevel}`);
            return this.levelsConfig.levels[0]; // Fallback to first level
        }
        return levelConfig;
    }
    
    getCurrentHerdConfig() {
        const levelConfig = this.getCurrentLevelConfig();
        return levelConfig.herds[this.currentHerd];
    }
    
    getAvailableDeterrents() {
        const currentLevel = this.currentLevel + 1; // Convert to 1-based
        const available = {};
        
        Object.entries(this.deterrentsConfig.deterrents).forEach(([key, deterrent]) => {
            if (deterrent.unlockLevel <= currentLevel) {
                available[key] = deterrent;
            }
        });
        
        return available;
    }
    
    getDeterrentConfig(type) {
        return this.deterrentsConfig.deterrents[type];
    }
    
    checkHerdCompletion() {
        // Only proceed to next herd if current herd is fully spawned and all elephants are finished
        if (this.herdComplete && this.elephantsFinishedInHerd >= this.elephantsPerHerd) {
            console.log(`🎉 Herd ${this.currentHerd + 1} completely finished! (${this.elephantsFinishedInHerd}/${this.elephantsPerHerd})`);
            this.completeCurrentHerd();
            this.updateUI(); // Update UI after herd completion
        }
    }

    update() {
        // Handle level transition state
        if (this.gameState === 'level_transition') {
            if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
                this.startLevel();
            }
            return;
        }
        
        if (this.gameState !== 'playing') return;
        
        const delta = 16; // Assuming 60fps
        
        // Update herd spawn timer
        this.herdSpawnTimer -= delta;
        
        // Update elephant spawn timer
        this.elephantSpawnTimer -= delta;
        
        if (this.elephantSpawnTimer <= 0 && this.elephantsSpawnedInHerd < this.elephantsPerHerd && !this.herdComplete) {
            this.spawnElephant();
            // Next elephant in 2-4 seconds
            this.elephantSpawnTimer = Phaser.Math.Between(2000, 4000);
        }
        
        // Update all elephants
        this.elephants.forEach(elephant => {
            if (elephant.active) {
                elephant.update();
            }
        });
        
        // Update all deterrents
        this.deterrents.forEach(deterrent => {
            if (deterrent.active) {
                deterrent.update(delta);
            }
        });
        
        // Update all villagers
        this.villagers.forEach(villager => {
            if (villager.active) {
                villager.update();
            }
        });
        
        // Reset farm damage timers for farms not being touched by elephants that can still damage them
        this.farms.forEach(farm => {
            if (farm.damageLevel < 2) { // Only reset timer for farms that can still take damage
                let eligibleElephantOnFarm = false;
                this.elephants.forEach(elephant => {
                    if (elephant.active && !elephant.isAbandoned && !farm.damagedByElephants.has(elephant.elephantId)) {
                        const distance = Phaser.Math.Distance.Between(elephant.x, elephant.y, farm.x, farm.y);
                        if (distance < 50) {
                            eligibleElephantOnFarm = true;
                        }
                    }
                });
                
                if (!eligibleElephantOnFarm) {
                    farm.damageTimer = 0;
                }
            }
        });
        
        // Clean up destroyed objects
        this.elephants = this.elephants.filter(elephant => elephant.active);
        this.deterrents = this.deterrents.filter(deterrent => deterrent.active);
        this.villagers = this.villagers.filter(villager => villager.active);
    }
}

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#2d5a27',
    scene: [TitleScene, GameIntroScene, GameScene],
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    }
};

// Start the game
const game = new Phaser.Game(config);
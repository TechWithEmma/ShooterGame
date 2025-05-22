const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextBubbleCanvas = document.getElementById('next-bubble-canvas');
const nextBubbleCtx = nextBubbleCanvas.getContext('2d');

const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('high-score');
const levelDisplay = document.getElementById('level');
const gameOverMessage = document.getElementById('game-over-message');
const finalScoreDisplay = document.getElementById('final-score');
const finalLevelDisplay = document.getElementById('final-level');
const restartButton = document.getElementById('restart-button');
const pauseButton = document.getElementById('pause-button');
const resumeButton = document.getElementById('resume-button');
const pauseOverlay = document.getElementById('pause-overlay');
const soundButton = document.getElementById('sound-button');
const powerupBomb = document.getElementById('powerup-bomb');
const powerupColor = document.getElementById('powerup-color');

// Game Settings
const BUBBLE_RADIUS = 15;
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
const GRID_COLS = 15; // How many bubbles fit across
const SHOOTER_Y_OFFSET = 20; // How far up from bottom the shooter base is
const SHOT_SPEED = 10;
const MAX_LEVEL = 10;

// Initialize audio elements
const popSound = new Audio('media/pop.wav');
const shootSound = new Audio('media/shoot.mp3');
const gameOverSound = new Audio('media/gameover.wav');
const levelUpSound = new Audio('media/levelup.mp3');
const powerupSound = new Audio('media/powerup.mp3');

// Level configuration
const levelConfig = [
    { rows: 5, colors: ['red', 'green', 'blue'] },
    { rows: 5, colors: ['red', 'green', 'blue', 'yellow'] },
    { rows: 6, colors: ['red', 'green', 'blue', 'yellow'] },
    { rows: 6, colors: ['red', 'green', 'blue', 'yellow', 'purple'] },
    { rows: 7, colors: ['red', 'green', 'blue', 'yellow', 'purple'] },
    { rows: 7, colors: ['red', 'green', 'blue', 'yellow', 'purple', 'orange'] },
    { rows: 8, colors: ['red', 'green', 'blue', 'yellow', 'purple', 'orange'] },
    { rows: 8, colors: ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'cyan'] },
    { rows: 9, colors: ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'cyan'] },
    { rows: 10, colors: ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'cyan', 'magenta'] }
];

let grid = [];
let shooterBubble;
let nextShooterBubble;
let flyingBubble = null;
let score = 0;
let highScore = localStorage.getItem('highScore') || 0;
let currentLevel = 1;
let gameOver = false;
let isPaused = false;
let isSoundEnabled = true;
let GRID_ROWS = 12; // Default, will adjust by level
let START_ROWS = 5; // Default, will adjust by level
let COLORS = ['red', 'green', 'blue']; // Default, will adjust by level
let powerups = {
    bomb: 0,
    color: 0
};
let gameLoopRequestId = null;
let aimAngle = -Math.PI / 2; // Straight up

// Set canvas size
canvas.width = GRID_COLS * BUBBLE_DIAMETER;
canvas.height = (GRID_ROWS + 2) * BUBBLE_DIAMETER; // +2 for shooter area

// Initialize high score display
highScoreDisplay.textContent = highScore;

function getRandomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function Bubble(x, y, color, isStatic = true, row = -1, col = -1) {
    return {
        x, y, color, isStatic,
        radius: BUBBLE_RADIUS,
        dx: 0, dy: 0, // For flying bubbles
        row, col, // Grid position
        visible: true,
        isSpecial: Math.random() < 0.1 // 10% chance of being a special bubble
    };
}

function getGridPosition(x, y) {
    // This is for a simple rectangular grid. Hex grids are more complex.
    // Odd rows are slightly offset for a more "packed" look
    const isOddRow = Math.floor(y / BUBBLE_DIAMETER) % 2 !== 0;
    const colOffset = isOddRow ? BUBBLE_RADIUS : 0;
    
    let col = Math.floor((x - colOffset) / BUBBLE_DIAMETER);
    let row = Math.floor(y / BUBBLE_DIAMETER);

    // Ensure col is within bounds
    col = Math.max(0, Math.min(GRID_COLS - 1, col));
    if (isOddRow && col >= GRID_COLS -1) col = GRID_COLS - 2; // prevent overflow on odd rows

    return { row, col };
}

function getCanvasCoordinates(row, col) {
    const isOddRow = row % 2 !== 0;
    const xOffset = isOddRow ? BUBBLE_RADIUS : 0;
    const x = col * BUBBLE_DIAMETER + BUBBLE_RADIUS + xOffset;
    const y = row * BUBBLE_DIAMETER + BUBBLE_RADIUS;
    return { x, y };
}

function initGrid() {
    grid = [];
    
    // Get level configuration
    const config = levelConfig[currentLevel - 1] || levelConfig[levelConfig.length - 1];
    START_ROWS = config.rows;
    COLORS = config.colors;
    
    for (let r = 0; r < GRID_ROWS; r++) {
        grid[r] = [];
        for (let c = 0; c < GRID_COLS; c++) {
            grid[r][c] = null;
            if (r < START_ROWS) {
                // Adjust for offset rows to prevent going out of bounds
                const isOddRow = r % 2 !== 0;
                if (isOddRow && c === GRID_COLS - 1) continue; // Skip last cell in odd rows if it would overflow

                const { x, y } = getCanvasCoordinates(r, c);
                grid[r][c] = Bubble(x, y, getRandomColor(), true, r, c);
            }
        }
    }
}

function prepareShooterBubble() {
    const shooterX = canvas.width / 2;
    const shooterY = canvas.height - BUBBLE_RADIUS - SHOOTER_Y_OFFSET;
    if (!nextShooterBubble) {
        nextShooterBubble = Bubble(0, 0, getRandomColor(), false); // Position doesn't matter for next
    }
    shooterBubble = Bubble(shooterX, shooterY, nextShooterBubble.color, false);
    nextShooterBubble.color = getRandomColor(); // Prepare the next one
    drawNextBubble();
}

function drawNextBubble() {
    nextBubbleCtx.clearRect(0, 0, nextBubbleCanvas.width, nextBubbleCanvas.height);
    if (nextShooterBubble) {
        nextBubbleCtx.beginPath();
        nextBubbleCtx.arc(nextBubbleCanvas.width / 2, nextBubbleCanvas.height / 2, BUBBLE_RADIUS, 0, Math.PI * 2);
        nextBubbleCtx.fillStyle = nextShooterBubble.color;
        nextBubbleCtx.fill();
        nextBubbleCtx.strokeStyle = 'black';
        nextBubbleCtx.stroke();
    }
}

function drawBubble(bubble) {
    if (!bubble || !bubble.visible) return;
    
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    
    // Normal bubble
    ctx.fillStyle = bubble.color;
    ctx.fill();
    
    // Special bubble effect (powerup)
    if (bubble.isSpecial) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.restore();
        
        // Add star effect
        ctx.save();
        ctx.beginPath();
        const starPoints = 5;
        const outerRadius = bubble.radius * 0.4;
        const innerRadius = bubble.radius * 0.2;
        
        for (let i = 0; i < starPoints * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI * 2 * i) / (starPoints * 2);
            const x = bubble.x + radius * Math.cos(angle);
            const y = bubble.y + radius * Math.sin(angle);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fillStyle = 'gold';
        ctx.fill();
        ctx.restore();
    }
    
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();
}

function drawGrid() {
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r] && grid[r][c]) {
                drawBubble(grid[r][c]);
            }
        }
    }
}

function drawShooter() {
    if (!shooterBubble) return;
    
    drawBubble(shooterBubble);

    // Draw aim line
    ctx.beginPath();
    ctx.moveTo(shooterBubble.x, shooterBubble.y);
    ctx.lineTo(
        shooterBubble.x + Math.cos(aimAngle) * 60,
        shooterBubble.y + Math.sin(aimAngle) * 60
    );
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1; // Reset
    
    // Draw shooter base
    ctx.beginPath();
    ctx.moveTo(shooterBubble.x - 20, canvas.height);
    ctx.lineTo(shooterBubble.x - 15, canvas.height - SHOOTER_Y_OFFSET);
    ctx.lineTo(shooterBubble.x + 15, canvas.height - SHOOTER_Y_OFFSET);
    ctx.lineTo(shooterBubble.x + 20, canvas.height);
    ctx.fillStyle = '#555';
    ctx.fill();
}

function drawFlyingBubble() {
    if (flyingBubble) {
        drawBubble(flyingBubble);
    }
}

function updateFlyingBubble() {
    if (!flyingBubble) return;

    flyingBubble.x += flyingBubble.dx;
    flyingBubble.y += flyingBubble.dy;

    // Wall collision
    if (flyingBubble.x - flyingBubble.radius < 0 || flyingBubble.x + flyingBubble.radius > canvas.width) {
        flyingBubble.dx *= -1;
        // Ensure it's inside bounds after bounce
        if (flyingBubble.x - flyingBubble.radius < 0) flyingBubble.x = flyingBubble.radius;
        if (flyingBubble.x + flyingBubble.radius > canvas.width) flyingBubble.x = canvas.width - flyingBubble.radius;
        
        if (isSoundEnabled) {
            const bounceSound = new Audio('https://freesound.org/data/previews/587/587566_1954971-lq.mp3');
            bounceSound.volume = 0.3;
            bounceSound.play();
        }
    }

    // Top ceiling collision
    if (flyingBubble.y - flyingBubble.radius < 0) {
        flyingBubble.y = flyingBubble.radius; // Stick to top
        snapBubbleToGrid(flyingBubble);
        return;
    }

    // Collision with grid bubbles
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const staticBubble = grid[r][c];
            if (staticBubble && staticBubble.visible) {
                const dist = Math.hypot(flyingBubble.x - staticBubble.x, flyingBubble.y - staticBubble.y);
                if (dist < BUBBLE_DIAMETER - 5) { // -5 for a bit of overlap tolerance
                    snapBubbleToGrid(flyingBubble, staticBubble);
                    return;
                }
            }
        }
    }
}

function snapBubbleToGrid(bubble, collidedWith = null) {
    // Simple snapping: find the nearest empty grid slot
    // A more robust system would find the slot closest to the impact point
    // or use hexagonal grid math.
    
    let bestPos = null;
    let minDist = Infinity;

    // Determine the general area based on bubble's current position or collided bubble
    let searchRow = Math.floor(bubble.y / BUBBLE_DIAMETER);
    let searchCol = Math.floor(bubble.x / BUBBLE_DIAMETER); // Approximate

    // If collided, try to snap near the collision point
    if (collidedWith) {
        searchRow = collidedWith.row;
        searchCol = collidedWith.col;
    }
    searchRow = Math.max(0, Math.min(GRID_ROWS - 1, searchRow));

    // Search adjacent cells for an empty spot
    // This is a simplified search
    for (let rOffset = -1; rOffset <= 1; rOffset++) {
        for (let cOffset = -1; cOffset <= 1; cOffset++) {
            let r = searchRow + rOffset;
            let c = searchCol + cOffset; // This needs refinement for hex-like structure

            // Refine col for odd/even rows
            const isOddTargetRow = r % 2 !== 0;
            const currentIsOdd = Math.floor(bubble.y / BUBBLE_DIAMETER) % 2 !== 0;
            let approxGridCol = Math.floor((bubble.x - (currentIsOdd ? BUBBLE_RADIUS : 0)) / BUBBLE_DIAMETER);
            
            c = approxGridCol + cOffset;
            
            if (r < 0 || r >= GRID_ROWS || c < 0 || c >= (isOddTargetRow ? GRID_COLS -1 : GRID_COLS)) continue;
            if (grid[r][c]) continue; // Slot occupied

            const { x: targetX, y: targetY } = getCanvasCoordinates(r, c);
            const dist = Math.hypot(bubble.x - targetX, bubble.y - targetY);

            if (dist < minDist) {
                minDist = dist;
                bestPos = { r, c, x: targetX, y: targetY };
            }
        }
    }
    
    // If no adjacent empty found, try direct grid position
    if (!bestPos) {
        const pos = getGridPosition(bubble.x, bubble.y);
        if (pos.row >= GRID_ROWS) { // Went below game area
            endGame();
            return;
        }
        if (!grid[pos.row][pos.col]) {
             const { x: targetX, y: targetY } = getCanvasCoordinates(pos.row, pos.col);
             bestPos = {r: pos.row, c: pos.col, x:targetX, y: targetY};
        } else {
            // This case is tricky: try to find *any* nearby empty slot
            // For simplicity, we might just stick it somewhat arbitrarily or end game
            // Let's try a slightly higher row if current is full
            let r = Math.max(0, pos.row -1);
            const {x: targetX, y: targetY} = getCanvasCoordinates(r, pos.col);
            if (!grid[r][pos.col]) {
                bestPos = {r, c:pos.col, x: targetX, y:targetY};
            } else { // Failsafe: if absolutely no spot, might cause overlap or error
                console.warn("Could not find empty slot for snapping!");
                 // Place it at the top-most available logical slot if hitting ceiling
                if (bubble.y - BUBBLE_RADIUS <= 0) {
                    let topRow = 0;
                    let {col} = getGridPosition(bubble.x, BUBBLE_RADIUS);
                    const {x: targetX, y: targetY} = getCanvasCoordinates(topRow, col);
                    if(!grid[topRow][col]) {
                        bestPos = {r:topRow, c:col, x:targetX, y:targetY};
                    } else {
                        // Last resort: put it slightly off, might cause visual glitch
                        // or just end game if this is a problem
                        endGame(); // Game might become unplayable
                        return;
                    }
                } else {
                     // This usually means it hit a bubble and the adjacent slots are full
                    // For this simple version, we'll let it try to find *any* grid pos
                    // This is a weakness of the simple snapping logic
                    const fallbackPos = getGridPosition(bubble.x, bubble.y);
                    const { x: targetX, y: targetY } = getCanvasCoordinates(fallbackPos.row, fallbackPos.col);
                    // If grid[fallbackPos.row][fallbackPos.col] is occupied, this WILL cause an overwrite.
                    // This is a point for future improvement.
                    bestPos = {r: fallbackPos.row, c: fallbackPos.col, x: targetX, y: targetY};
                }
            }
        }
    }

    if (bestPos) {
        // Keep the special property if the flying bubble was special
        const newBubble = Bubble(bestPos.x, bestPos.y, bubble.color, true, bestPos.r, bestPos.c);
        newBubble.isSpecial = bubble.isSpecial;
        grid[bestPos.r][bestPos.c] = newBubble;
        
        // Play pop sound
        if (isSoundEnabled) {
            popSound.currentTime = 0;
            popSound.play();
        }
        
        flyingBubble = null;
        
        const matchedBubbles = findMatches(bestPos.r, bestPos.c);
        if (matchedBubbles.length >= 3) {
            // Check for special bubbles in matches
            let specialCount = 0;
            matchedBubbles.forEach(bubble => {
                if (bubble.isSpecial) {
                    specialCount++;
                    // 50% chance for bomb, 50% chance for color change
                    if (Math.random() < 0.5) {
                        powerups.bomb++;
                        document.querySelector('#powerup-bomb .powerup-count').textContent = powerups.bomb;
                    } else {
                        powerups.color++;
                        document.querySelector('#powerup-color .powerup-count').textContent = powerups.color;
                    }
                }
            });
            
            // If special bubbles were found, play powerup sound
            if (specialCount > 0 && isSoundEnabled) {
                powerupSound.currentTime = 0;
                powerupSound.play();
            }
            
            removeBubbles(matchedBubbles);
            score += matchedBubbles.length * 10 * currentLevel; // More points in higher levels
            removeFloatingBubbles();
            
            // Check for level completion
            checkLevelCompletion();
        }
        
        if (checkGameOverCondition()) {
            endGame();
            return;
        }
        prepareShooterBubble();

    } else {
        console.error("Failed to snap bubble!");
        flyingBubble = null; // Prevent infinite loop
        prepareShooterBubble();
    }
    updateScore();
}

function findMatches(startRow, startCol) {
    const targetColor = grid[startRow][startCol].color;
    const toVisit = [{ r: startRow, c: startCol }];
    const visited = new Set();
    const matched = [];

    while (toVisit.length > 0) {
        const current = toVisit.pop();
        const key = `${current.r}-${current.c}`;

        if (visited.has(key)) continue;
        visited.add(key);

        if (grid[current.r] && grid[current.r][current.c] &&
            grid[current.r][current.c].visible &&
            grid[current.r][current.c].color === targetColor) {
            
            matched.push(grid[current.r][current.c]);

            // Check neighbors (simplified for rectangular grid, hex is more complex)
            const neighbors = getNeighbors(current.r, current.c);
            neighbors.forEach(n => {
                if (grid[n.r] && grid[n.r][n.c] && grid[n.r][n.c].visible) {
                     toVisit.push({ r: n.r, c: n.c });
                }
            });
        }
    }
    return matched;
}

function getNeighbors(r, c) {
    const neighbors = [];
    const isOddRow = r % 2 !== 0;
    
    // Directions: N, S, E, W, and diagonal for hex-like feel
    const directions = [
        { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, // N, S
        { dr: 0, dc: -1 }, { dr: 0, dc: 1 }, // W, E
        // Diagonals depend on row parity for hex-like packing
        { dr: -1, dc: isOddRow ? 1 : -1 }, // NW/NE
        { dr: 1, dc: isOddRow ? 1 : -1 }   // SW/SE
    ];

    for (const dir of directions) {
        const nr = r + dir.dr;
        const nc = c + dir.dc;
        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < ( (nr % 2 !== 0) ? GRID_COLS -1 : GRID_COLS) ) {
             if (grid[nr] && grid[nr][nc]) { // Check if bubble exists
                neighbors.push({ r: nr, c: nc });
             }
        }
    }
    return neighbors;
}

function removeBubbles(bubblesToRemove) {
    // Create pop effect
    bubblesToRemove.forEach(bubble => {
        // Create a visual effect for popping
        createPopEffect(bubble.x, bubble.y, bubble.color);
        
        // Remove from grid
        if (grid[bubble.row] && grid[bubble.row][bubble.col]) {
            grid[bubble.row][bubble.col] = null;
        }
    });
}

function createPopEffect(x, y, color) {
    // Create particles for a pop effect
    const particles = [];
    const numParticles = 8;
    
    for (let i = 0; i < numParticles; i++) {
        const angle = (Math.PI * 2 * i) / numParticles;
        const speed = 2 + Math.random() * 2;
        
        particles.push({
            x: x,
            y: y,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            radius: 3 + Math.random() * 3,
            color: color,
            life: 20 + Math.random() * 10
        });
    }
    
    // Animate particles
    function animateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.dx;
            p.y += p.dy;
            p.life--;
            
            // Draw particle
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * (p.life / 30), 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / 30;
            ctx.fill();
            ctx.globalAlpha = 1;
            
            // Remove dead particles
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
        
        // Continue animation if particles exist
        if (particles.length > 0 && !gameOver && !isPaused) {
            requestAnimationFrame(animateParticles);
        }
    }
    
    // Start animation
    animateParticles();
}

function removeFloatingBubbles() {
    const supported = new Set();
    const toVisit = [];

    // Start BFS from all bubbles in the top row
    for (let c = 0; c < GRID_COLS; c++) {
        if (grid[0][c] && grid[0][c].visible) {
            toVisit.push({ r: 0, c: c });
            supported.add(`0-${c}`);
        }
    }

    while (toVisit.length > 0) {
        const current = toVisit.pop();
        const neighbors = getNeighbors(current.r, current.c);
        neighbors.forEach(n => {
            const key = `${n.r}-${n.c}`;
            if (grid[n.r][n.c] && grid[n.r][n.c].visible && !supported.has(key)) {
                supported.add(key);
                toVisit.push(n);
            }
        });
    }

    let floatingRemovedCount = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r][c] && grid[r][c].visible && !supported.has(`${r}-${c}`)) {
                // Create falling effect
                createFallingEffect(grid[r][c]);
                
                grid[r][c] = null; // Remove floating bubble
                floatingRemovedCount++;
            }
        }
    }
    
    if (floatingRemovedCount > 0) {
        score += floatingRemovedCount * 20 * currentLevel; // Bonus for dropping clusters
        
        // Play dropping sound if bubbles are dropped
        if (isSoundEnabled && floatingRemovedCount > 0) {
            const dropSound = new Audio('media/burstdrop.mp3');
            dropSound.volume = 0.5;
            dropSound.play();
        }
    }
}

function createFallingEffect(bubble) {
    // Create a clone of the bubble to animate falling
    const fallingBubble = {
        x: bubble.x,
        y: bubble.y,
        color: bubble.color,
        radius: bubble.radius,
        dy: 2, // Initial falling speed
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.2
    };
    
    // Animate falling
    function animateFall() {
        fallingBubble.y += fallingBubble.dy;
        fallingBubble.dy += 0.2; // Gravity
        fallingBubble.rotation += fallingBubble.rotationSpeed;
        
        // Draw falling bubble with rotation
        ctx.save();
        ctx.translate(fallingBubble.x, fallingBubble.y);
        ctx.rotate(fallingBubble.rotation);
        
        ctx.beginPath();
        ctx.arc(0, 0, fallingBubble.radius, 0, Math.PI * 2);
        ctx.fillStyle = fallingBubble.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.stroke();
        
        // Add a highlight
        ctx.beginPath();
        ctx.arc(-fallingBubble.radius * 0.3, -fallingBubble.radius * 0.3, fallingBubble.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
        
        ctx.restore();
        
        // Continue animation if bubble is still on screen
        if (fallingBubble.y < canvas.height + fallingBubble.radius && !gameOver && !isPaused) {
            requestAnimationFrame(animateFall);
        }
    }
    
    // Start animation
    animateFall();
}

function checkGameOverCondition() {
    // Check if any bubble in the last effective row (GRID_ROWS - 1) exists
    // or if a bubble has been snapped to a row that's too low.
    for (let c = 0; c < GRID_COLS; c++) {
        if (grid[GRID_ROWS - 1] && grid[GRID_ROWS - 1][c] && grid[GRID_ROWS - 1][c].visible) {
            return true;
        }
    }
    // Also, if a bubble tries to snap beyond GRID_ROWS (handled in snapBubbleToGrid)
    return false;
}

function checkLevelCompletion() {
    // Check if all rows are clear or only have a few bubbles left
    let bubbleCount = 0;
    
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r][c] && grid[r][c].visible) {
                bubbleCount++;
            }
        }
    }
    
    // If less than 5 bubbles remain, level is considered complete
    if (bubbleCount <= 5) {
        levelUp();
    }
}

function levelUp() {
    if (currentLevel < MAX_LEVEL) {
        currentLevel++;
        levelDisplay.textContent = currentLevel;
        
        // Play level up sound
        if (isSoundEnabled) {
            levelUpSound.currentTime = 0;
            levelUpSound.play();
        }
        
        // Add bonus points for completing the level
        score += 500 * currentLevel;
        updateScore();
        
        // Show level up message
        const levelUpMsg = document.createElement('div');
        levelUpMsg.className = 'level-up-message';
        levelUpMsg.innerHTML = `<h3>Level ${currentLevel}!</h3><p>+${500 * currentLevel} Points</p>`;
        document.querySelector('.game-container').appendChild(levelUpMsg);
        
        // Remove message after animation
        setTimeout(() => {
            levelUpMsg.remove();
        }, 2000);
        
        // Reset and initialize next level
        flyingBubble = null;
        initGrid();
        prepareShooterBubble();
    }
}

function updateScore() {
    scoreDisplay.textContent = score;
    
    // Update high score if needed
    if (score > highScore) {
        highScore = score;
        highScoreDisplay.textContent = highScore;
        localStorage.setItem('highScore', highScore);
    }
}

function gameLoop() {
    if (gameOver || isPaused) {
        if (gameLoopRequestId) {
            cancelAnimationFrame(gameLoopRequestId);
            gameLoopRequestId = null;
        }
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background patterns
    drawBackground();
    
    updateFlyingBubble();
    drawGrid();
    drawShooter();
    drawFlyingBubble();
    
    gameLoopRequestId = requestAnimationFrame(gameLoop);
}

function drawBackground() {
    // Draw subtle grid pattern
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    
    // Vertical lines
    for (let x = 0; x <= canvas.width; x += BUBBLE_DIAMETER) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= canvas.height; y += BUBBLE_DIAMETER) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    
    ctx.restore();
}

function endGame() {
    gameOver = true;
    finalScoreDisplay.textContent = score;
    finalLevelDisplay.textContent = currentLevel;
    gameOverMessage.classList.remove('hidden');
    
    // Play game over sound
    if (isSoundEnabled) {
        gameOverSound.currentTime = 0;
        gameOverSound.play();
    }
    
    console.log("Game Over! Score:", score);
}

function togglePause() {
    isPaused = !isPaused;
    
    if (isPaused) {
        pauseOverlay.classList.remove('hidden');
        pauseButton.innerHTML = '<i class="fas fa-play"></i>';
    } else {
        pauseOverlay.classList.add('hidden');
        pauseButton.innerHTML = '<i class="fas fa-pause"></i>';
        // Resume game loop
        if (!gameLoopRequestId) {
            gameLoop();
        }
    }
}

function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    soundButton.innerHTML = isSoundEnabled ? 
        '<i class="fas fa-volume-up"></i>' : 
        '<i class="fas fa-volume-mute"></i>';
}

function useBombPowerup() {
    if (powerups.bomb <= 0 || !shooterBubble) return;
    
    powerups.bomb--;
    document.querySelector('#powerup-bomb .powerup-count').textContent = powerups.bomb;
    
    // Create explosion effect
    const explosionRadius = BUBBLE_DIAMETER * 3;
    const centerX = shooterBubble.x;
    const centerY = canvas.height / 3;
    
    // Visual explosion effect
    createExplosion(centerX, centerY, explosionRadius);
    
    // Play explosion sound
    if (isSoundEnabled) {
        const explosionSound = new Audio('https://freesound.org/data/previews/587/587183_7724198-lq.mp3');
        explosionSound.volume = 0.5;
        explosionSound.play();
    }
    
    // Remove bubbles in explosion radius
    const bubblesInRadius = [];
    
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r][c] && grid[r][c].visible) {
                const dist = Math.hypot(grid[r][c].x - centerX, grid[r][c].y - centerY);
                if (dist <= explosionRadius) {
                    bubblesInRadius.push(grid[r][c]);
                }
            }
        }
    }
    
    // Remove bubbles and update score
    removeBubbles(bubblesInRadius);
    score += bubblesInRadius.length * 15;
    
    // Check for floating bubbles
    removeFloatingBubbles();
    updateScore();
    
    // Check for level completion
    checkLevelCompletion();
}

function createExplosion(x, y, radius) {
    // Create explosion effect with expanding circle and particles
    const duration = 30; // frames
    let frame = 0;
    
    function animateExplosion() {
        const progress = frame / duration;
        const currentRadius = radius * progress;
        
        // Draw expanding circle
        ctx.beginPath();
        ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 200, 50, ${1 - progress})`;
        ctx.fill();
        
        // Draw shock wave
        ctx.beginPath();
        ctx.arc(x, y, currentRadius * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        frame++;
        
        // Continue animation if not complete
        if (frame <= duration && !gameOver && !isPaused) {
            requestAnimationFrame(animateExplosion);
        }
    }
    
    // Start animation
    animateExplosion();
    
    // Create particles
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        const size = 2 + Math.random() * 4;
        const life = 20 + Math.random() * 40;
        const particle = {
            x: x,
            y: y,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            size: size,
            life: life,
            maxLife: life,
            color: `hsl(${30 + Math.random() * 30}, 100%, 50%)`
        };
        
        function animateParticle() {
            particle.x += particle.dx;
            particle.y += particle.dy;
            particle.life--;
            
            const fadeAlpha = particle.life / particle.maxLife;
            
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size * fadeAlpha, 0, Math.PI * 2);
            ctx.fillStyle = particle.color;
            ctx.globalAlpha = fadeAlpha;
            ctx.fill();
            ctx.globalAlpha = 1;
            
            if (particle.life > 0 && !gameOver && !isPaused) {
                requestAnimationFrame(animateParticle);
            }
        }
        
        animateParticle();
    }
}

function useColorPowerup() {
    if (powerups.color <= 0 || !shooterBubble) return;
    
    powerups.color--;
    document.querySelector('#powerup-color .powerup-count').textContent = powerups.color;
    
    // Play color change sound
    if (isSoundEnabled) {
        const colorSound = new Audio('https://freesound.org/data/previews/415/415510_5121236-lq.mp3');
        colorSound.volume = 0.5;
        colorSound.play();
    }
    
    // Find most prevalent color in grid to maximize potential matches
    const colorCounts = {};
    let maxColor = null;
    let maxCount = 0;
    
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r][c] && grid[r][c].visible) {
                const color = grid[r][c].color;
                colorCounts[color] = (colorCounts[color] || 0) + 1;
                
                if (colorCounts[color] > maxCount) {
                    maxCount = colorCounts[color];
                    maxColor = color;
                }
            }
        }
    }
    
    // Change shooter bubble color
    if (maxColor) {
        shooterBubble.color = maxColor;
        
        // Visual effect for color change
        createColorChangeEffect(shooterBubble);
    }
}

function createColorChangeEffect(bubble) {
    const x = bubble.x;
    const y = bubble.y;
    const radius = bubble.radius;
    const duration = 15;
    let frame = 0;
    
    function animateColorChange() {
        const progress = frame / duration;
        
        // Draw expanding circle
        ctx.beginPath();
        ctx.arc(x, y, radius * (1 + progress), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw sparkles
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = radius * (0.5 + progress * 1.5);
            
            const sparkleX = x + Math.cos(angle) * dist;
            const sparkleY = y + Math.sin(angle) * dist;
            const sparkleSize = 1 + Math.random() * 2;
            
            ctx.beginPath();
            ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
        }
        
        frame++;
        
        if (frame <= duration && !gameOver && !isPaused) {
            requestAnimationFrame(animateColorChange);
        }
    }
    
    animateColorChange();
}

function startGame() {
    gameOver = false;
    isPaused = false;
    score = 0;
    currentLevel = 1;
    flyingBubble = null;
    grid = []; // Clear grid
    aimAngle = -Math.PI / 2;
    powerups = {
        bomb: 1, // Start with one bomb powerup
        color: 1  // Start with one color powerup
    };
    
    // Update powerup displays
    document.querySelector('#powerup-bomb .powerup-count').textContent = powerups.bomb;
    document.querySelector('#powerup-color .powerup-count').textContent = powerups.color;
    
    // Reset UI elements
    gameOverMessage.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    pauseButton.innerHTML = '<i class="fas fa-pause"></i>';
    levelDisplay.textContent = currentLevel;
    updateScore();
    
    // Initialize game
    initGrid();
    prepareShooterBubble(); // Prepare first and next
    prepareShooterBubble(); // Call again to set up shooterBubble from next, and generate a new next
    
    if (!gameLoopRequestId) { // Prevent multiple loops if restart is called rapidly
        gameLoop();
    }
}

// Event Listeners
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('click', handleMouseClick);
restartButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
resumeButton.addEventListener('click', togglePause);
soundButton.addEventListener('click', toggleSound);
powerupBomb.addEventListener('click', useBombPowerup);
powerupColor.addEventListener('click', useColorPowerup);

function handleMouseMove(event) {
    if (gameOver || !shooterBubble || isPaused) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    aimAngle = Math.atan2(mouseY - shooterBubble.y, mouseX - shooterBubble.x);
    // Restrict angle to mostly upwards
    if (aimAngle > -0.1) aimAngle = -0.1; // Prevent shooting too horizontally to the right
    if (aimAngle < -Math.PI + 0.1) aimAngle = -Math.PI + 0.1; // Prevent shooting too horizontally to the left
}

function handleMouseClick(event) {
    if (gameOver || !shooterBubble || flyingBubble || isPaused) return;

    // Play shoot sound
    if (isSoundEnabled) {
        shootSound.currentTime = 0;
        shootSound.play();
    }

    flyingBubble = shooterBubble;
    flyingBubble.dx = Math.cos(aimAngle) * SHOT_SPEED;
    flyingBubble.dy = Math.sin(aimAngle) * SHOT_SPEED;
    shooterBubble = null; // Shooter bubble is now flying
}

// Show help tooltip on page load
function showTutorial() {
    const tutorial = document.createElement('div');
    tutorial.className = 'tutorial';
    tutorial.innerHTML = `
        <h3>How to Play</h3>
        <p>Aim and click to shoot bubbles. Match 3+ of the same color to remove them.</p>
        <p>Special bubbles with stars give you powerups!</p>
        <p>Clear the screen to advance to the next level.</p>
        <button id="tutorial-close">Got it!</button>
    `;
    document.querySelector('.game-container').appendChild(tutorial);
    
    document.getElementById('tutorial-close').addEventListener('click', () => {
        tutorial.classList.add('fade-out');
        setTimeout(() => tutorial.remove(), 500);
    });
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (document.contains(tutorial)) {
            tutorial.classList.add('fade-out');
            setTimeout(() => tutorial.remove(), 500);
        }
    }, 10000);
}

// Initial Setup
window.onload = function() {
    showTutorial();
    startGame();
};
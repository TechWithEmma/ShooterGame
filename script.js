const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextBubbleCanvas = document.getElementById('next-bubble-canvas');
const nextBubbleCtx = nextBubbleCanvas.getContext('2d');

const scoreDisplay = document.getElementById('score');
const gameOverMessage = document.getElementById('game-over-message');
const finalScoreDisplay = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');

// Game Settings
const BUBBLE_RADIUS = 15;
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
const GRID_ROWS = 12; // Max rows bubbles can occupy
const GRID_COLS = 15; // How many bubbles fit across
const START_ROWS = 5; // Initial rows of bubbles
const COLORS = ['red', 'green', 'blue', 'yellow', 'purple', 'orange'];
const SHOOTER_Y_OFFSET = 20; // How far up from bottom the shooter base is
const SHOT_SPEED = 10;

let grid = [];
let shooterBubble;
let nextShooterBubble;
let flyingBubble = null;
let score = 0;
let gameOver = false;
let aimAngle = -Math.PI / 2; // Straight up

canvas.width = GRID_COLS * BUBBLE_DIAMETER;
canvas.height = (GRID_ROWS + 2) * BUBBLE_DIAMETER; // +2 for shooter area

function getRandomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function Bubble(x, y, color, isStatic = true, row = -1, col = -1) {
    return {
        x, y, color, isStatic,
        radius: BUBBLE_RADIUS,
        dx: 0, dy: 0, // For flying bubbles
        row, col, // Grid position
        visible: true
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
        nextShooterBubble = Bubble(0,0, getRandomColor(), false); // Position doesn't matter for next
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
    ctx.fillStyle = bubble.color;
    ctx.fill();
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
    if (shooterBubble) {
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
    }
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
                if (dist < BUBBLE_DIAMETER -5) { // -5 for a bit of overlap tolerance
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
                bestPos = {r,c:pos.col, x: targetX, y:targetY};
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
        grid[bestPos.r][bestPos.c] = Bubble(bestPos.x, bestPos.y, bubble.color, true, bestPos.r, bestPos.c);
        flyingBubble = null;
        
        const matchedBubbles = findMatches(bestPos.r, bestPos.c);
        if (matchedBubbles.length >= 3) {
            removeBubbles(matchedBubbles);
            score += matchedBubbles.length * 10;
            removeFloatingBubbles();
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
    bubblesToRemove.forEach(bubble => {
        if (grid[bubble.row] && grid[bubble.row][bubble.col]) {
            grid[bubble.row][bubble.col] = null; // Or set visible to false
        }
    });
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
                grid[r][c] = null; // Remove floating bubble
                floatingRemovedCount++;
            }
        }
    }
    if (floatingRemovedCount > 0) {
        score += floatingRemovedCount * 20; // Bonus for dropping clusters
    }
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

function updateScore() {
    scoreDisplay.textContent = score;
}

function gameLoop() {
    if (gameOver) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateFlyingBubble();

    drawGrid();
    drawShooter();
    drawFlyingBubble();

    requestAnimationFrame(gameLoop);
}

function handleMouseMove(event) {
    if (gameOver || !shooterBubble) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    aimAngle = Math.atan2(mouseY - shooterBubble.y, mouseX - shooterBubble.x);
    // Restrict angle to mostly upwards
    if (aimAngle > -0.1) aimAngle = -0.1; // Prevent shooting too horizontally to the right
    if (aimAngle < -Math.PI + 0.1) aimAngle = -Math.PI + 0.1; // Prevent shooting too horizontally to the left
}

function handleMouseClick() {
    if (gameOver || !shooterBubble || flyingBubble) return;

    flyingBubble = shooterBubble;
    flyingBubble.dx = Math.cos(aimAngle) * SHOT_SPEED;
    flyingBubble.dy = Math.sin(aimAngle) * SHOT_SPEED;
    shooterBubble = null; // Shooter bubble is now flying
}

function startGame() {
    gameOver = false;
    score = 0;
    flyingBubble = null;
    grid = []; // Clear grid
    aimAngle = -Math.PI / 2;
    
    gameOverMessage.classList.add('hidden');
    updateScore();
    initGrid();
    prepareShooterBubble(); // Prepare first and next
    prepareShooterBubble(); // Call again to set up shooterBubble from next, and generate a new next
    
    if (!gameLoopRequestId) { // Prevent multiple loops if restart is called rapidly
        gameLoop();
    }
}
let gameLoopRequestId = null; // To manage requestAnimationFrame

function gameLoop() {
    if (gameOver) {
        if (gameLoopRequestId) {
            cancelAnimationFrame(gameLoopRequestId);
            gameLoopRequestId = null;
        }
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateFlyingBubble();
    drawGrid();
    drawShooter();
    drawFlyingBubble();
    
    gameLoopRequestId = requestAnimationFrame(gameLoop);
}


function endGame() {
    gameOver = true;
    finalScoreDisplay.textContent = score;
    gameOverMessage.classList.remove('hidden');
    console.log("Game Over! Score:", score);
}

// Event Listeners
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('click', handleMouseClick);
restartButton.addEventListener('click', startGame);

// Initial Setup
startGame();
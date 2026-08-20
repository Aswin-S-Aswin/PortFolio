// ── TETRIS ENGINE (Rules: Tetrics.txt) ────────────────────────
// ══════════════════════════════════════════════════════════════
(() => {
    'use strict';
    const COLS = 10, ROWS = 20, BLOCK = 20;
    const LB_KEY = 'tetris_leaderboard_v1';

    // ── SUPABASE DATABASE CONFIGURATION ────────────────────────
    // Replace these placeholders with your Supabase Project URL & Anon Key
    const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
    const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
    
    let supabaseClient = null;
    if (window.supabase && SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL' && SUPABASE_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    // ── Speed table (ms per drop, per level) ─────────────────
    // Rule 16: L1=800, L2=700, L3=600... L10=150, beyond=100
    const SPEED_TABLE = [800, 700, 600, 500, 400, 350, 300, 250, 200, 150];
    function getSpeed(lvl) {
        const idx = lvl - 1;
        return idx < SPEED_TABLE.length ? SPEED_TABLE[idx] : 100;
    }

    // ── Tetromino definitions (SRS spawn orientation) ─────────
    const TETROMINOES = {
        I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#38bdf8' },
        O: { shape: [[1,1],[1,1]],                              color: '#fbbf24' },
        T: { shape: [[0,1,0],[1,1,1],[0,0,0]],                  color: '#b8b0ff' },
        S: { shape: [[0,1,1],[1,1,0],[0,0,0]],                  color: '#22c55e' },
        Z: { shape: [[1,1,0],[0,1,1],[0,0,0]],                  color: '#f472b6' },
        J: { shape: [[1,0,0],[1,1,1],[0,0,0]],                  color: '#7c6ff7' },
        L: { shape: [[0,0,1],[1,1,1],[0,0,0]],                  color: '#f97316' },
    };
    const PIECE_NAMES = Object.keys(TETROMINOES);

    // ── SRS Wall-Kick tables ──────────────────────────────────
    // Index = fromRotation (0-3). Each entry = [kickX, kickY] offsets to try CW.
    // For CCW, negate kicks and use toRotation as index.
    const KICKS_JLSTZ = [
        [[0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],  // 0→1
        [[0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],  // 1→2
        [[0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],  // 2→3
        [[0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],  // 3→0
    ];
    const KICKS_I = [
        [[0,0],[-2,0],[ 1,0],[-2,-1],[ 1, 2]],  // 0→1
        [[0,0],[-1,0],[ 2,0],[-1, 2],[ 2,-1]],  // 1→2
        [[0,0],[ 2,0],[-1,0],[ 2, 1],[-1,-2]],  // 2→3
        [[0,0],[ 1,0],[-2,0],[ 1,-2],[-2, 1]],  // 3→0
    ];

    // ── Canvas setup ──────────────────────────────────────────
    const canvas  = document.getElementById('tetris-canvas');
    const ctx     = canvas.getContext('2d');
    const nextCvs = document.getElementById('tetris-next');
    const nextCtx = nextCvs.getContext('2d');
    const holdCvs = document.getElementById('tetris-hold');
    const holdCtx = holdCvs.getContext('2d');

    // HiDPI support — call once per canvas, before any drawing
    function scaleCanvas(c, cssW, cssH) {
        const dpr = window.devicePixelRatio || 1;
        c.width  = cssW * dpr;
        c.height = cssH * dpr;
        c.style.width  = cssW + 'px';
        c.style.height = cssH + 'px';
        c.getContext('2d').scale(dpr, dpr);
    }
    scaleCanvas(canvas,  COLS * BLOCK, ROWS * BLOCK);
    scaleCanvas(nextCvs, 80, 80);
    scaleCanvas(holdCvs, 80, 80);

    // ── DOM refs ──────────────────────────────────────────────
    const scoreEl  = document.getElementById('tetris-score');
    const levelEl  = document.getElementById('tetris-level');
    const linesEl  = document.getElementById('tetris-lines');
    const comboEl  = document.getElementById('tetris-combo');
    const overlay      = document.getElementById('tetris-overlay');
    const overlayTitle = document.getElementById('tetris-overlay-title');
    const overlaySub   = document.getElementById('tetris-overlay-sub');
    const overlayBtn   = document.getElementById('tetris-overlay-btn');
    const nameInput    = document.getElementById('tetris-name-input');
    const startBtn     = document.getElementById('tetris-start-btn');
    const pauseBtn     = document.getElementById('tetris-pause-btn');

    // ── Game state variables ──────────────────────────────────
    // Rule 28: states = START | PLAYING | PAUSED | GAME_OVER
    let board, piece, nextPiece, holdPiece, holdUsed;
    let score, level, lines, combo, backToBack;
    let gameState = 'idle'; // 'idle'|'playing'|'paused'|'over'
    let dropInterval, lastDrop, raf;
    let bag = [];
    // Flash animation state
    let flashRows = [], flashTimer = 0;
    // Focus guard — keyboard only fires when user has clicked on the game area
    let gameFocused = false;
    const gameWrap = document.querySelector('.tetris-game-wrap');

    // Click inside game wrap → focus; click outside → blur
    gameWrap.addEventListener('click', () => {
        gameFocused = true;
        gameWrap.style.outline = '2px solid var(--accent)';
        gameWrap.style.outlineOffset = '3px';
    });
    document.addEventListener('click', e => {
        if (!gameWrap.contains(e.target)) {
            gameFocused = false;
            gameWrap.style.outline = '';
            gameWrap.style.outlineOffset = '';
        }
    }, true);

    // ── Utility functions ─────────────────────────────────────
    function cloneShape(s) { return s.map(r => [...r]); }

    // Clockwise rotation (SRS)
    function rotateCW(shape) {
        const N = shape.length;
        return Array.from({length: N}, (_, r) =>
            Array.from({length: N}, (_, c) => shape[N - 1 - c][r])
        );
    }
    // Counter-clockwise = 3× clockwise
    function rotateCCW(shape) { return rotateCW(rotateCW(rotateCW(shape))); }

    function emptyBoard() {
        return Array.from({length: ROWS}, () => Array(COLS).fill(0));
    }

    // 7-Bag randomizer (Rule 4)
    function nextFromBag() {
        if (!bag.length) bag = [...PIECE_NAMES].sort(() => Math.random() - 0.5);
        return bag.pop();
    }

    function spawnPiece(name) {
        const t = TETROMINOES[name];
        return {
            name,
            shape: cloneShape(t.shape),
            color: t.color,
            x: Math.floor(COLS / 2) - Math.floor(t.shape[0].length / 2),
            y: 0,
            rot: 0,
        };
    }

    // ── Collision detection (Rule 7) ──────────────────────────
    function collides(shape, ox, oy) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                const nx = ox + c, ny = oy + r;
                if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
                if (ny >= 0 && board[ny][nx]) return true;
            }
        }
        return false;
    }

    // ── Wall-kick rotation (Rule 6) ───────────────────────────
    function tryRotate(cw) {
        const newShape = cw ? rotateCW(piece.shape) : rotateCCW(piece.shape);
        const kicks    = piece.name === 'I' ? KICKS_I : KICKS_JLSTZ;
        const fromRot  = piece.rot;
        const toRot    = (fromRot + (cw ? 1 : 3)) % 4;

        // For CW use fromRot table; for CCW use toRot table with negated offsets
        const kickData = cw
            ? kicks[fromRot]
            : kicks[toRot].map(([x, y]) => [-x, -y]);

        for (const [kx, ky] of kickData) {
            // SRS: ky is defined with Y-up; our board is Y-down so subtract ky
            if (!collides(newShape, piece.x + kx, piece.y - ky)) {
                piece.shape = newShape;
                piece.x += kx;
                piece.y -= ky;
                piece.rot = toRot;
                return;
            }
        }
    }

    // ── Ghost piece ───────────────────────────────────────────
    function ghostY() {
        let gy = piece.y;
        while (!collides(piece.shape, piece.x, gy + 1)) gy++;
        return gy;
    }

    // ── Piece placement and line clearing ─────────────────────
    function lockPiece() {
        // Place piece on board (Rule 8)
        piece.shape.forEach((row, r) => {
            row.forEach((v, c) => {
                if (v) {
                    const ny = piece.y + r;
                    if (ny >= 0) board[ny][piece.x + c] = piece.color;
                }
            });
        });
        clearLines();
        // Spawn next piece (Rule 8)
        piece = spawnPiece(nextPiece);
        nextPiece = nextFromBag();
        holdUsed = false;
        // Game over check (Rule 24)
        if (collides(piece.shape, piece.x, piece.y)) {
            triggerGameOver();
        }
    }

    function clearLines() {
        // Find complete rows (Rule 9)
        const completedRows = [];
        for (let r = 0; r < ROWS; r++) {
            if (board[r].every(v => v)) completedRows.push(r);
        }
        const cleared = completedRows.length;

        if (!cleared) {
            // Rule 12: combo resets on no clear
            combo = 0;
            updateHUD();
            return;
        }

        // Flash effect
        flashRows = [...completedRows];
        flashTimer = 8; // frames

        // Remove completed rows (Rule 9)
        for (const r of [...completedRows].reverse()) {
            board.splice(r, 1);
            board.unshift(Array(COLS).fill(0));
        }

        // ── Scoring (Rules 11-14) ─────────────────────────────
        const LINE_SCORES = [0, 100, 300, 500, 800];
        let pts = LINE_SCORES[Math.min(cleared, 4)] * level;

        // Back-to-Back bonus (Rule 18): consecutive Tetris clears × 1.5
        const isTetris = (cleared === 4);
        if (isTetris) {
            if (backToBack) pts = Math.floor(pts * 1.5);
            backToBack = true;
        } else {
            backToBack = false;
        }

        // Combo bonus (Rule 17): 50 × combo × level (combo increments first)
        combo += 1;
        const comboBonus = combo > 1 ? 50 * (combo - 1) * level : 0;

        score += pts + comboBonus;
        lines += cleared;

        // Level update (Rule 15): LEVEL = floor(lines / 10) + 1
        level = Math.floor(lines / 10) + 1;
        dropInterval = getSpeed(level);

        updateHUD();
        showClearFeedback(cleared, isTetris, combo > 1 ? combo - 1 : 0, comboBonus);
    }

    // Brief text flash on the canvas when lines are cleared
    let clearMsg = null, clearMsgTimer = 0;
    function showClearFeedback(cleared, b2b, comboChain, bonus) {
        const labels = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!'];
        let msg = labels[cleared] || '';
        if (b2b && cleared === 4) msg = 'BACK-TO-BACK TETRIS!';
        if (comboChain > 0) msg += `\n${comboChain}× COMBO +${bonus}`;
        clearMsg = msg;
        clearMsgTimer = 90; // frames (~1.5 s at 60fps)
    }

    // ── HUD update ────────────────────────────────────────────
    function updateHUD() {
        scoreEl.textContent = score.toLocaleString();
        levelEl.textContent = level;
        linesEl.textContent = lines;
        comboEl.textContent = combo > 0 ? combo : 0;
        // Pulse combo display when active
        const comboPanel = document.getElementById('tetris-combo-panel');
        if (comboPanel) {
            comboPanel.style.borderColor = combo > 1
                ? 'rgba(251,191,36,0.5)' : '';
        }
    }

    // ── Controls ──────────────────────────────────────────────
    function moveLeft()  { if (!collides(piece.shape, piece.x - 1, piece.y)) { piece.x--; render(); } }
    function moveRight() { if (!collides(piece.shape, piece.x + 1, piece.y)) { piece.x++; render(); } }

    function softDrop() {
        if (!collides(piece.shape, piece.x, piece.y + 1)) {
            piece.y++;
            score += 1;     // Rule 13: 1 pt per cell
            lastDrop = performance.now();
            updateHUD();
            render();
        }
    }

    function hardDrop() {
        let dropped = 0;
        while (!collides(piece.shape, piece.x, piece.y + 1)) { piece.y++; dropped++; }
        score += dropped * 2;   // Rule 14: 2 pts per cell
        updateHUD();
        lockPiece();
    }

    function holdAction() {
        // Rule 20: cannot hold twice per piece
        if (holdUsed) return;
        holdUsed = true;
        if (!holdPiece) {
            holdPiece = piece.name;
            piece = spawnPiece(nextPiece);
            nextPiece = nextFromBag();
        } else {
            const tmp = holdPiece;
            holdPiece = piece.name;
            piece = spawnPiece(tmp);
        }
        render();
    }

    // Keyboard handler (Rule 5) — only fires when game area is focused
    document.addEventListener('keydown', e => {
        if (gameState !== 'playing') return;
        // Arrow keys & Space: only capture if user clicked on the game wrap
        const isGameKey = ['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space',
                           'KeyZ','KeyC','ShiftLeft','ShiftRight','KeyP'].includes(e.code);
        if (isGameKey && !gameFocused) return; // let browser scroll normally
        switch (e.code) {
            case 'ArrowLeft':  e.preventDefault(); moveLeft();      break;
            case 'ArrowRight': e.preventDefault(); moveRight();     break;
            case 'ArrowDown':  e.preventDefault(); softDrop();      break;
            case 'ArrowUp':    e.preventDefault(); tryRotate(true); break;
            case 'KeyZ':       e.preventDefault(); tryRotate(false);break;
            case 'Space':      e.preventDefault(); hardDrop();      break;
            case 'KeyC':
            case 'ShiftLeft':
            case 'ShiftRight': e.preventDefault(); holdAction();    break;
            case 'KeyP':       e.preventDefault(); window.tetrisPause(); break;
        }
        render();
    });


    // ── Drawing ───────────────────────────────────────────────
    function cssVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function drawBlock(ctx2, x, y, color, size, alpha = 1) {
        ctx2.save();
        ctx2.globalAlpha = alpha;
        ctx2.fillStyle = color;
        ctx2.beginPath();
        ctx2.roundRect(x * size + 1, y * size + 1, size - 2, size - 2, 3);
        ctx2.fill();
        // Inner highlight
        ctx2.fillStyle = 'rgba(255,255,255,0.2)';
        ctx2.beginPath();
        ctx2.roundRect(x * size + 2, y * size + 2, size - 4, 5, 2);
        ctx2.fill();
        ctx2.restore();
    }

    function drawMiniPiece(ctx2, shape, color, cssW, cssH, size = 16) {
        ctx2.clearRect(0, 0, cssW, cssH);
        const cols = shape[0].length, rows = shape.length;
        // Filter empty rows/cols for tighter centering
        const filledRows = shape.filter(r => r.some(v => v));
        const filledCols = shape[0].map((_, c) => shape.some(r => r[c]));
        const usedCols = filledCols.filter(Boolean).length;
        const usedRows = filledRows.length;
        const ox = Math.floor((cssW / size - usedCols) / 2);
        const oy = Math.floor((cssH / size - usedRows) / 2);
        let fr = 0;
        for (let r = 0; r < rows; r++) {
            if (!shape[r].some(v => v)) continue;
            let fc = 0;
            for (let c = 0; c < cols; c++) {
                if (!filledCols[c]) continue;
                if (shape[r][c]) drawBlock(ctx2, ox + fc, oy + fr, color, size);
                fc++;
            }
            fr++;
        }
    }

    function render() {
        const bgColor = cssVar('--bg');
        const bdColor = cssVar('--border');

        // ── Main board ────────────────────────────────────────
        ctx.clearRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);

        // Grid lines
        ctx.strokeStyle = bdColor;
        ctx.lineWidth = 0.5;
        for (let r = 0; r <= ROWS; r++) {
            ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(COLS * BLOCK, r * BLOCK); ctx.stroke();
        }
        for (let c = 0; c <= COLS; c++) {
            ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, ROWS * BLOCK); ctx.stroke();
        }

        // Locked blocks
        board.forEach((row, r) => {
            // Flash animation for just-cleared rows
            const isFlash = flashRows.includes(r) && flashTimer > 0;
            row.forEach((color, c) => {
                if (color) {
                    drawBlock(ctx, c, r, isFlash ? '#ffffff' : color, BLOCK, isFlash ? (flashTimer / 8) : 1);
                }
            });
        });

        if (piece && (gameState === 'playing' || gameState === 'paused')) {
            // Ghost piece (Rule 22)
            const gy = ghostY();
            piece.shape.forEach((row, r) => {
                row.forEach((v, c) => {
                    if (v) {
                        ctx.save();
                        ctx.globalAlpha = 0.2;
                        ctx.fillStyle = piece.color;
                        ctx.beginPath();
                        ctx.roundRect((piece.x + c) * BLOCK + 1, (gy + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2, 3);
                        ctx.fill();
                        ctx.restore();
                    }
                });
            });

            // Active piece
            piece.shape.forEach((row, r) => {
                row.forEach((v, c) => {
                    if (v) drawBlock(ctx, piece.x + c, piece.y + r, piece.color, BLOCK);
                });
            });
        }

        // ── Clear message overlay on canvas ───────────────────
        if (clearMsg && clearMsgTimer > 0 && gameState === 'playing') {
            const alpha = Math.min(1, clearMsgTimer / 20);
            ctx.save();
            ctx.globalAlpha = alpha;
            const lines2 = clearMsg.split('\n');
            ctx.textAlign = 'center';
            ctx.shadowColor = '#b8b0ff';
            ctx.shadowBlur = 18;
            lines2.forEach((line, i) => {
                const isMain = i === 0;
                ctx.font = `bold ${isMain ? 22 : 14}px Syne, sans-serif`;
                ctx.fillStyle = isMain ? '#b8b0ff' : '#fbbf24';
                ctx.fillText(line, COLS * BLOCK / 2, ROWS * BLOCK / 2 - 16 + i * 26);
            });
            ctx.restore();
            clearMsgTimer--;
        }

        // ── Next & Hold previews ──────────────────────────────
        const nextT = TETROMINOES[nextPiece];
        drawMiniPiece(nextCtx, nextT.shape, nextT.color, 80, 80);

        if (holdPiece) {
            const holdT = TETROMINOES[holdPiece];
            drawMiniPiece(holdCtx, holdT.shape, holdT.color, 80, 80, holdUsed ? 12 : 16);
        } else {
            holdCtx.clearRect(0, 0, 80, 80);
        }

        // flashTimer is decremented in the game loop only (avoids double-step from keyboard render calls)
    }

    // ── Game loop ─────────────────────────────────────────────
    function loop(ts) {
        if (gameState !== 'playing') return;
        if (ts - lastDrop >= dropInterval) {
            if (!collides(piece.shape, piece.x, piece.y + 1)) {
                piece.y++;
            } else {
                lockPiece();
            }
            lastDrop = ts;
        }
        // Decrement flash timer once per animation frame (not per render call)
        if (flashTimer > 0) flashTimer--;
        render();
        raf = requestAnimationFrame(loop);
    }

    // ── Game state management ─────────────────────────────────
    function initState() {
        // Rule 31: game start resets everything
        board       = emptyBoard();
        bag         = [];
        score       = 0;
        level       = 1;
        lines       = 0;
        combo       = 0;
        backToBack  = false;
        holdPiece   = null;
        holdUsed    = false;
        flashRows   = [];
        flashTimer  = 0;
        clearMsg    = null;
        clearMsgTimer = 0;
        dropInterval = getSpeed(1);
        nextPiece   = nextFromBag();
        piece       = spawnPiece(nextFromBag());
        updateHUD();
    }

    function triggerGameOver() {
        gameState = 'over';
        cancelAnimationFrame(raf);
        render();

        overlayTitle.textContent = 'GAME OVER';
        overlaySub.textContent   = `Score: ${score.toLocaleString()} · Level ${level} · ${lines} lines`;
        nameInput.style.display  = 'block';
        nameInput.value          = '';
        overlayBtn.textContent   = '💾 Save Score';
        overlay.classList.remove('hidden');
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        setTimeout(() => nameInput.focus(), 100);
    }

    // ── Public API (called by HTML buttons) ───────────────────
    window.tetrisStart = function () {
        if (gameState === 'playing') return;
        initState();
        gameState = 'playing';
        lastDrop  = performance.now();
        overlay.classList.add('hidden');
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
    };

    window.tetrisPause = function () {
        if (gameState === 'playing') {
            gameState = 'paused';
            cancelAnimationFrame(raf);
            overlayTitle.textContent = 'PAUSED';
            overlaySub.textContent   = `Score: ${score.toLocaleString()} · Level ${level}`;
            nameInput.style.display  = 'none';
            overlayBtn.textContent   = '▶ Resume';
            overlay.classList.remove('hidden');
            pauseBtn.textContent = '▶ Resume';
        } else if (gameState === 'paused') {
            gameState = 'playing';
            overlay.classList.add('hidden');
            lastDrop = performance.now();
            pauseBtn.textContent = '⏸ Pause';
            raf = requestAnimationFrame(loop);
        }
    };

    window.tetrisRestart = function () {
        cancelAnimationFrame(raf);
        initState();
        gameState = 'idle';
        overlay.classList.remove('hidden');
        overlayTitle.textContent = 'TETRIS';
        overlaySub.textContent   = 'Ready to play!';
        nameInput.style.display  = 'none';
        overlayBtn.textContent   = '▶ Start Game';
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        pauseBtn.textContent = '⏸ Pause';
        render();
    };

    window.tetrisOverlayAction = function () {
        if (gameState === 'over')        { saveScore();            }
        else if (gameState === 'paused') { window.tetrisPause();   }
        else                             { window.tetrisStart();   }
    };

    // ── Leaderboard (Supabase Database + Local Storage Fallback) ──────
    async function fetchLeaderboard() {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('leaderboard')
                    .select('name, score, level, lines')
                    .order('score', { ascending: false })
                    .limit(10);
                if (!error && data) return data;
            } catch (err) {
                console.warn('Supabase fetch failed, falling back to local storage:', err);
            }
        }
        // Fallback to localStorage
        try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; }
        catch { return []; }
    }

    function saveLocalLeaderboard(lb) {
        localStorage.setItem(LB_KEY, JSON.stringify(lb));
    }

    async function renderLeaderboard() {
        const lb = await fetchLeaderboard();
        const tbody = document.getElementById('tetris-lb-body');
        if (!tbody) return;
        if (!lb.length) {
            tbody.innerHTML = '<tr><td class="lb-empty" colspan="5">No scores yet. Be the first!</td></tr>';
            return;
        }
        const medals = ['🥇', '🥈', '🥉'];
        tbody.innerHTML = lb.map((e, i) => {
            const cls  = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
            const rank = i < 3 ? medals[i] : `#${i + 1}`;
            return `<tr class="${cls}">
                <td><span class="lb-rank">${rank}</span></td>
                <td><span class="lb-name">${esc(e.name)}</span></td>
                <td><span class="lb-score">${Number(e.score).toLocaleString()}</span></td>
                <td>${e.level}</td>
                <td>${e.lines}</td>
            </tr>`;
        }).join('');
    }

    function esc(s) {
        return String(s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    async function saveScore() {
        const name = nameInput.value.trim() || 'Anonymous';
        const newEntry = { name, score, level, lines };

        // 1. Try saving to Supabase online database
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient
                    .from('leaderboard')
                    .insert([newEntry]);
                if (error) console.error('Error inserting into Supabase:', error);
            } catch (err) {
                console.error('Supabase save error:', err);
            }
        }

        // 2. Also save to local storage
        let localLb = [];
        try { localLb = JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch {}
        localLb.push({ ...newEntry, date: new Date().toLocaleDateString() });
        localLb.sort((a, b) => b.score - a.score);
        localLb.splice(10);
        saveLocalLeaderboard(localLb);

        // 3. Refresh display
        await renderLeaderboard();

        overlayTitle.textContent = 'SAVED! 🎉';
        overlaySub.textContent   = `${esc(name)}: ${score.toLocaleString()} pts`;
        nameInput.style.display  = 'none';
        overlayBtn.textContent   = '▶ Play Again';
        gameState = 'idle';
    }

    nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') tetrisOverlayAction();
    });

    // ── Mobile Touch D-Pad wiring ─────────────────────────────
    function wireTouch(id, action) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('pointerdown', e => {
            e.preventDefault();
            if (gameState !== 'playing') return;
            gameFocused = true; // keep keyboard focus alive too
            action();
            render();
        });
    }
    wireTouch('touch-left',     () => moveLeft());
    wireTouch('touch-right',    () => moveRight());
    wireTouch('touch-down',     () => softDrop());
    wireTouch('touch-hard',     () => hardDrop());
    wireTouch('touch-rotate',   () => tryRotate(true));
    wireTouch('touch-hold-btn', () => holdAction());

    // ── Init ──────────────────────────────────────────────────
    initState();
    renderLeaderboard();
    render();

})(); // end Tetris IIFE

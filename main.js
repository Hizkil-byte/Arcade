// ==========================================
// MAIN.JS - GAME ENGINE & UI CONTROLLER (ULTIMATE MULTIPLAYER & 1-ON-1 SYSTEM)
// ==========================================

import {
    romanticQuotes, slPhysicalChallenges, shopChallenges, arenas, SL_PRIZES,
    M_BANKRUPT, RENT_CHALLENGES, shopKatalog, boardData, danaUmumCards,
    kesempatanCards, jailBribes, calcSpin, sleep, getCellCoords,
    initAudio, HAP, playClickSound, playStepSound, playDiceSound
} from './utils.js';

// ==========================================
// STATUS MULTIPLAYER 2 HP
// ==========================================
let isMultiplayer = false;
let myPlayerId = 0; // 0 = Host (P1), 1 = Client (P2)
let peer = null;
let conn = null;

// ==========================================
// OPSI HADIAH PEMENANG (SISTEM 1-ON-1)
// ==========================================
const WINNER_PRIZE_OPTIONS = [
    "💆‍♂️ Dipijit pundak/punggung selama 10 menit",
    "☕ Dibuatkan minuman atau snack favorit sekarang juga",
    "🍕 Bebas menentukan menu/tempat makan berikutnya",
    "👑 Diturutin 1 permintaan romantis tanpa membantah",
    "🫂 Diberikan pelukan hangat 20 detik & usapan kepala"
];

// ==========================================
// ROULETTE TIMER & SESSION GUARD
// ==========================================
let activeRouletteInterval = null;
let activeRouletteTimeout = null;
let gameSessionToken = 0;

function stopRouletteTimer() {
    if (activeRouletteInterval !== null) { clearInterval(activeRouletteInterval); activeRouletteInterval = null; }
    if (activeRouletteTimeout !== null) { clearTimeout(activeRouletteTimeout); activeRouletteTimeout = null; }
}

function invalidateGameSession() {
    gameSessionToken++;
}

function safeTimeout(fn, delay) {
    const token = gameSessionToken;
    return setTimeout(() => {
        if (token === gameSessionToken) {
            fn();
        }
    }, delay);
}

// ==========================================
// GLOBAL MOVEMENT & TRANSACTION STATUS (ATTACHED TO WINDOW)
// ==========================================
window.SL_isMoving = false;
window.M_isMoving = false;
window.M_isShopBuying = false;

// ==========================================
// SINGLE SOURCE OF TRUTH: NAMA PEMAIN
// ==========================================
let playerNames = {
    p1: "P1 🤵",
    p2: "P2 👰"
};

let SL_players = [ 
    { id: 0, name: "P1 🤵", icon: "🤵", pos: 1, element: null }, 
    { id: 1, name: "P2 👰", icon: "👰", pos: 1, element: null } 
];

let M_players = [ 
    { id: 0, name: "P1 🤵", icon: "🤵", pos: 0, money: 800, debt: 0, inJail: false, jailTurns: 0, items: {bunga:0, kopi:0, payung:0, cokelat:0, tiket:0, parfum:0, kamera:0, bantal:0, surat:0, jam:0}, activeCoffeeCount: 0 }, 
    { id: 1, name: "P2 👰", icon: "👰", pos: 0, money: 800, debt: 0, inJail: false, jailTurns: 0, items: {bunga:0, kopi:0, payung:0, cokelat:0, tiket:0, parfum:0, kamera:0, bantal:0, surat:0, jam:0}, activeCoffeeCount: 0 } 
];

function loadPlayerNames() {
    const saved = localStorage.getItem('arcade_cinta_names');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.p1) playerNames.p1 = data.p1;
            if (data.p2) playerNames.p2 = data.p2;
        } catch(e) {}
    }
    syncPlayerNames(playerNames.p1, playerNames.p2, false);
}

function syncPlayerNames(p1Name, p2Name, save = true) {
    if (p1Name) playerNames.p1 = p1Name;
    if (p2Name) playerNames.p2 = p2Name;

    if (M_players && M_players[0]) M_players[0].name = playerNames.p1;
    if (M_players && M_players[1]) M_players[1].name = playerNames.p2;
    if (SL_players && SL_players[0]) SL_players[0].name = playerNames.p1;
    if (SL_players && SL_players[1]) SL_players[1].name = playerNames.p2;

    let p1Label = document.getElementById('p1-label');
    if (p1Label) p1Label.innerText = playerNames.p1;
    let p2Label = document.getElementById('p2-label');
    if (p2Label) p2Label.innerText = playerNames.p2;

    if (save) {
        localStorage.setItem('arcade_cinta_names', JSON.stringify(playerNames));
    }
}

function cleanName(name) {
    if (!name) return '';
    return name.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim();
}

// ==========================================
// MENU & SUB-MODALS CONTROLLERS
// ==========================================
window.openPlayModal = function() {
    const playModal = document.getElementById('play-modal');
    if (playModal) playModal.style.display = 'flex';
    initAudio();
}
window.closePlayModal = function() {
    const playModal = document.getElementById('play-modal');
    if (playModal) playModal.style.display = 'none';
}

window.openOptionsModal = function() {
    const modal = document.getElementById('options-modal');
    if (modal) modal.style.display = 'flex';
    initAudio();
}
window.closeOptionsModal = function() {
    const modal = document.getElementById('options-modal');
    if (modal) modal.style.display = 'none';
}

window.openCustomBgModal = function() {
    const modal = document.getElementById('custom-bg-modal');
    if (modal) modal.style.display = 'flex';
}

window.openMusicModal = function() {
    const modal = document.getElementById('music-modal');
    if (modal) modal.style.display = 'flex';
}
window.closeMusicModal = function() {
    const modal = document.getElementById('music-modal');
    if (modal) modal.style.display = 'none';
}

// ==========================================
// CUSTOM MUSIC ENGINE
// ==========================================
let currentAudioUrl = null;

function initMusicEngine() {
    const inputMusik = document.getElementById('inputMusikHP');
    const player = document.getElementById('bg-music-player');
    const titleEl = document.getElementById('music-track-title');

    if (inputMusik) {
        inputMusik.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (currentAudioUrl) {
                    URL.revokeObjectURL(currentAudioUrl);
                }
                currentAudioUrl = URL.createObjectURL(file);
                
                player.src = currentAudioUrl;
                if (titleEl) {
                    titleEl.innerText = file.name;
                    titleEl.style.color = '#10b981';
                    titleEl.style.fontWeight = '800';
                }
                
                showCpuToast("Lagu berhasil dimuat! Siap diputar 🎵");
                const btnToggle = document.getElementById('btn-toggle-music');
                if (btnToggle) btnToggle.innerHTML = '▶️ Play';
            }
        });
    }

    if (player) {
        player.addEventListener('ended', function() {
            const btnToggle = document.getElementById('btn-toggle-music');
            if (btnToggle) btnToggle.innerHTML = '▶️ Play';
        });
    }
}

window.togglePlayMusic = function() {
    const player = document.getElementById('bg-music-player');
    const btn = document.getElementById('btn-toggle-music');
    if (!player || !btn) return;

    if (!player.src || player.src.endsWith(window.location.host + '/') || player.src.endsWith('.html')) {
        showCpuToast("Pilih lagu dari HP dulu ya! 📂");
        return;
    }
    
    if (player.paused) {
        player.play().then(() => {
            btn.innerHTML = '⏸️ Pause';
        }).catch(err => {
            console.error("Gagal putar lagu:", err);
            showCpuToast("Gagal memutar musik.");
        });
    } else {
        player.pause();
        btn.innerHTML = '▶️ Play';
    }
};

window.stopMusic = function() {
    const player = document.getElementById('bg-music-player');
    const btn = document.getElementById('btn-toggle-music');
    if (!player || !btn) return;

    if (player && player.src) {
        player.pause();
        player.currentTime = 0;
        btn.innerHTML = '▶️ Play';
    }
};

// ==========================================
// CUSTOM BACKGROUND ENGINE
// ==========================================
let selectedCustomArenaId = 'default';

function initCustomBgEngine() {
    const inputGaleri = document.getElementById('inputGaleriHP');
    const container = document.getElementById('arena-list-container');

    if (container && arenas && arenas.length > 0) {
        selectedCustomArenaId = arenas[0].id;
        container.innerHTML = arenas.map((a, idx) => `
            <div class="arena-option-card" onclick="window.setCustomArenaChoice('${a.id}', this)" style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; margin-bottom:6px; background:${idx === 0 ? '#ffe6ea' : '#ffffff'}; border:2px solid ${idx === 0 ? '#ff4d6d' : '#eeeeee'}; border-radius:10px; cursor:pointer; font-weight:700; font-size:13px; color:#333;">
                <span>${a.icon} ${a.name}</span>
                <span class="opt-check">${idx === 0 ? '🔘' : '⚪'}</span>
            </div>
        `).join('');
    }

    if (inputGaleri) {
        inputGaleri.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const selectedArenaId = selectedCustomArenaId || (activeArena ? activeArena.id : 'default');

            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const img = new Image();
                    img.src = event.target.result;

                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        const MAX_WIDTH = 800;
                        const MAX_HEIGHT = 800;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                        } else {
                            if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);

                        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                        try {
                            localStorage.setItem('arcade_cinta_bg_' + selectedArenaId, compressedBase64);
                            applyArenaVisualTheme();
                            showCpuToast("Foto background berhasil dipasang! 🖼️");
                            const bgModal = document.getElementById('custom-bg-modal');
                            if (bgModal) bgModal.style.display = 'none';
                            inputGaleri.value = '';
                        } catch (err) {
                            showCpuToast("Gambar terlalu besar! Gagal menyimpan.");
                        }
                    };
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

window.setCustomArenaChoice = function(id, el) {
    selectedCustomArenaId = id;
    document.querySelectorAll('.arena-option-card').forEach(card => {
        card.style.background = '#ffffff';
        card.style.borderColor = '#eeeeee';
        const check = card.querySelector('.opt-check');
        if (check) check.innerText = '⚪';
    });
    if (el) {
        el.style.background = '#ffe6ea';
        el.style.borderColor = '#ff4d6d';
        const check = el.querySelector('.opt-check');
        if (check) check.innerText = '🔘';
    }
};

window.resetCurrentArenaBg = function() {
    const selectedArenaId = selectedCustomArenaId || (activeArena ? activeArena.id : 'default');
    localStorage.removeItem('arcade_cinta_bg_' + selectedArenaId);
    applyArenaVisualTheme();
    showCpuToast("Background arena dikembalikan ke bawaan! 🔄");
};

// ==========================================
// INITIAL LOADING SCREEN ENGINE
// ==========================================
function runInitialLoading() {
    let progress = 0;
    const fillEl = document.getElementById('progress-bar-fill');
    const percentEl = document.getElementById('progress-text-percent');
    const quoteEl = document.getElementById('loading-quote-text');
    
    if (quoteEl) quoteEl.innerText = romanticQuotes[Math.floor(Math.random() * romanticQuotes.length)];

    const quoteInterval = setInterval(() => {
        if (quoteEl && progress < 90) {
            quoteEl.innerText = romanticQuotes[Math.floor(Math.random() * romanticQuotes.length)];
        }
    }, 700);

    const timer = setInterval(() => {
        progress += Math.floor(Math.random() * 8) + 4;
        if (progress >= 100) {
            progress = 100;
            clearInterval(timer);
            clearInterval(quoteInterval);
            
            if (fillEl) fillEl.style.width = '100%';
            if (percentEl) percentEl.innerText = '100%';
            if (quoteEl) quoteEl.innerText = 'Siap Bermain! 💖';

            setTimeout(() => {
                const loadScreen = document.getElementById('loading-screen');
                const menuScreen = document.getElementById('menu-screen');
                if (loadScreen) loadScreen.classList.remove('active');
                if (menuScreen) menuScreen.classList.add('active');
            }, 400);
        } else {
            if (fillEl) fillEl.style.width = progress + '%';
            if (percentEl) percentEl.innerText = progress + '%';
        }
    }, 50);
}

window.addEventListener('DOMContentLoaded', () => {
    loadPlayerNames();
    runInitialLoading();
    initCustomBgEngine();
    initMusicEngine();
});

// ==========================================
// POSITION CACHING SYSTEM
// ==========================================
let SL_cellRectCache = null;
let SL_playerSizeCache = null;

function SL_invalidatePositionCache() { 
    SL_cellRectCache = null; 
    SL_playerSizeCache = null; 
}

let M_cellRectCache = null;
let M_playerSizeCache = null;

function M_invalidatePositionCache() { 
    M_cellRectCache = null; 
    M_playerSizeCache = null; 
}

window.addEventListener('resize', () => {
    if (document.getElementById('monopoly-screen').classList.contains('active')) {
        M_invalidatePositionCache();
        M_updatePositions();
    }
    if (document.getElementById('sl-screen').classList.contains('active')) {
        SL_invalidatePositionCache();
        SL_updatePositions();
    }
});

// ==========================================
// LOCALSTORAGE STATS & JOURNAL ENGINE
// ==========================================
let globalStats = {
    monopoly: { p1Wins: 0, p2Wins: 0, p1Losses: 0, p2Losses: 0, history: [] },
    sl: { p1Wins: 0, p2Wins: 0, p1Losses: 0, p2Losses: 0, history: [] }
};

function loadStats() {
    const saved = localStorage.getItem('arcade_cinta_stats_v2');
    if (saved) {
        try { globalStats = JSON.parse(saved); } catch(e) {}
    }
}

function saveStats() {
    localStorage.setItem('arcade_cinta_stats_v2', JSON.stringify(globalStats));
}

function recordMatchResult(gameType, winnerId, loserId, summaryText = "") {
    if (globalStats[gameType]) {
        if (winnerId === 0) globalStats[gameType].p1Wins++;
        if (winnerId === 1) globalStats[gameType].p2Wins++;
        if (loserId === 0) globalStats[gameType].p1Losses++;
        if (loserId === 1) globalStats[gameType].p2Losses++;
        
        let winnerName = winnerId === 0 ? (M_players[0].name || "P1 🤵") : (M_players[1].name || "P2 👰");
        globalStats[gameType].history.unshift({
            date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
            winner: winnerName,
            summary: summaryText || "Sesi kencan berhasil diselesaikan!"
        });

        if (globalStats[gameType].history.length > 10) {
            globalStats[gameType].history.pop();
        }
        
        saveStats();
    }
}

function resetStats() {
    if (confirm("Yakin ingin mereset seluruh statistik & jurnal kencan?")) {
        globalStats = {
            monopoly: { p1Wins: 0, p2Wins: 0, p1Losses: 0, p2Losses: 0, history: [] },
            sl: { p1Wins: 0, p2Wins: 0, p1Losses: 0, p2Losses: 0, history: [] }
        };
        saveStats();
        openStatsModal();
        showCpuToast("Statistik berhasil direset! 🔄");
    }
}
window.resetStats = resetStats;

// ==========================================
// STATS & JOURNAL MODAL UI FUNCTIONS
// ==========================================
let currentStatsTab = 'monopoly';

function openStatsModal() {
    showModal("📊", "Statistik & Jurnal Kencan", `
        <div style="display: flex; gap: 6px; justify-content: center; margin-bottom: 10px;">
            <button class="btn-action btn-buy" style="padding: 6px 12px; font-size: 11px;" onclick="switchStatsTab('monopoly')">🎩 Monopoli</button>
            <button class="btn-action btn-buy" style="padding: 6px 12px; font-size: 11px; background: linear-gradient(135deg, #4ea8de, #0077b6);" onclick="switchStatsTab('sl')">🪜 Ular Tangga</button>
        </div>
        <div id="stats-tab-content" style="max-height: 200px; overflow-y: auto; text-align: left; font-size: 11.5px; padding-right: 4px;">
        </div>
        <div style="margin-top: 10px; text-align: center;">
            <button class="btn-action btn-pay" style="padding: 6px 12px; font-size: 10.5px; background: #d90429;" onclick="resetStats()">🔄 Reset Statistik</button>
        </div>
    `, `<button class="btn-action btn-pass" style="width:100%;" onclick="closeModal()">Tutup</button>`);
    switchStatsTab(currentStatsTab);
}
window.openStatsModal = openStatsModal;

function switchStatsTab(type) {
    currentStatsTab = type;
    let data = globalStats[type];
    let title = type === 'monopoly' ? 'Monopoli Ekstrem' : 'Ular Tangga Asmara';
    
    let historyHtml = data.history.length > 0 
        ? data.history.map(h => `
            <div style="border-bottom: 1px dashed #ffb3c6; padding: 5px 0;">
                <div style="display:flex; justify-content:space-between; font-weight:700; color:var(--primary-dark); font-size:11px;">
                    <span>🏆 Pemenang: ${h.winner}</span>
                    <span style="font-size:9.5px; color:#666;">${h.date}</span>
                </div>
                <div style="font-size:10px; color:#444; margin-top:2px;">📝 ${h.summary}</div>
            </div>`).join('')
        : '<i style="color:#777; display:block; text-align:center; padding: 12px 0; font-size:11px;">Belum ada riwayat kencan di mode ini. Ayo mainkan sekarang! 💖</i>';

    let box = document.getElementById('stats-tab-content');
    if(box) {
        box.innerHTML = `
            <div style="background:#ffe6ea; padding:8px 10px; border-radius:10px; margin-bottom:8px; border:2px solid var(--primary);">
                <b style="color:var(--primary-dark); font-size:11.5px;">🏆 Skor (${title}):</b><br>
                • P1 (🤵) - Menang: <b>${data.p1Wins}</b> | Kalah: <b>${data.p1Losses}</b><br>
                • P2 (👰) - Menang: <b>${data.p2Wins}</b> | Kalah: <b>${data.p2Losses}</b>
            </div>
            <b style="color:#333; font-size:11.5px;">📖 Jurnal Kencan & Kenangan:</b>
            <div style="margin-top:3px; background:#fff; padding:4px 8px; border-radius:8px; border:1px solid #ddd; max-height:100px; overflow-y:auto;">
                ${historyHtml}
            </div>
        `;
    }
}
window.switchStatsTab = switchStatsTab;

// ==========================================
// KUSTOMISASI NAMA PEMAIN
// ==========================================
function openNameConfigModal() {
    let currentP1 = playerNames.p1.replace(" 🤵", "");
    let currentP2 = playerNames.p2.replace(" 👰", "");
    showModal("✏️", "Kustomisasi Nama Pemain", 
        `<div style="text-align:left; font-size:12px; margin-bottom:10px;">
            <label style="font-weight:700; color:var(--primary-dark);">Nama Pemain 1 (🤵):</label>
            <input type="text" id="custom-p1-name" value="${currentP1}" style="width:100%; padding:8px; border-radius:8px; border:1px solid #ccc; margin-top:4px; margin-bottom:10px; box-sizing:border-box; font-family:var(--font-main);">
            
            <label style="font-weight:700; color:var(--primary-dark);">Nama Pemain 2 (👰):</label>
            <input type="text" id="custom-p2-name" value="${currentP2}" style="width:100%; padding:8px; border-radius:8px; border:1px solid #ccc; margin-top:4px; box-sizing:border-box; font-family:var(--font-main);">
        </div>`,
        `<button class="btn-action btn-buy" onclick="saveCustomNames()">Simpan Nama ✨</button>
         <button class="btn-action btn-pass" onclick="closeModal()">Batal</button>`
    );
}
window.openNameConfigModal = openNameConfigModal;

function saveCustomNames() {
    let p1Val = document.getElementById('custom-p1-name').value.trim();
    let p2Val = document.getElementById('custom-p2-name').value.trim();
    
    let newP1 = p1Val ? p1Val + " 🤵" : playerNames.p1;
    let newP2 = p2Val ? p2Val + " 👰" : playerNames.p2;

    syncPlayerNames(newP1, newP2, true);

    closeModal();
    showCpuToast("Nama panggilan berhasil disimpan! 💖");
}
window.saveCustomNames = saveCustomNames;

// ==========================================
// GAME SAVE & LOAD ENGINE (PERBAIKAN BUG #5)
// ==========================================
function saveMonopolyState() {
    const data = {
        arenaId: activeArena.id,
        currPlayer: M_currPlayer,
        globalEco: M_globalEco,
        ecoState: M_ecoState,
        turnCounter: M_turnCounter,
        ecoShiftTarget: M_ecoShiftTarget,
        matchStats: M_matchStats,
        players: M_players.map(p => ({
            id: p.id, name: p.name, icon: p.icon, pos: p.pos, money: p.money, debt: p.debt,
            inJail: p.inJail, jailTurns: p.jailTurns, items: p.items, activeCoffeeCount: p.activeCoffeeCount
        })),
        boardProps: boardData.map(s => ({ owner: s.owner, level: s.level, mortgaged: s.mortgaged || false }))
    };
    localStorage.setItem('arcade_cinta_save_monopoly', JSON.stringify(data));
}

function clearMonopolySave() {
    localStorage.removeItem('arcade_cinta_save_monopoly');
}

function startNewMonopolySession() {
    invalidateGameSession();
    M_resetGame();
    closeModal();
    goToRoulette();
}
window.startNewMonopolySession = startNewMonopolySession;

function loadMonopolyState() {
    const saved = localStorage.getItem('arcade_cinta_save_monopoly');
    if (!saved) return false;
    try {
        const data = JSON.parse(saved);
        const arenaObj = arenas.find(a => a.id === data.arenaId);
        if (arenaObj) activeArena = arenaObj;

        M_currPlayer = data.currPlayer;
        M_globalEco = data.globalEco;
        M_ecoState = data.ecoState;
        M_turnCounter = data.turnCounter;
        if (data.ecoShiftTarget !== undefined) {
            M_ecoShiftTarget = data.ecoShiftTarget;
        }
        M_matchStats = data.matchStats;
        M_players = data.players;

        let p1LoadedName = data.players[0] && data.players[0].name ? data.players[0].name : playerNames.p1;
        let p2LoadedName = data.players[1] && data.players[1].name ? data.players[1].name : playerNames.p2;
        syncPlayerNames(p1LoadedName, p2LoadedName, true);

        M_players.forEach(p => {
            if (p.pos >= boardData.length) p.pos = 0;
        });

        if (!M_initialized) {
            M_initBoard();
        }

        if (data.boardProps && Array.isArray(data.boardProps)) {
            data.boardProps.forEach((p, idx) => {
                if (boardData[idx]) {
                    boardData[idx].owner = p.owner;
                    boardData[idx].level = p.level || 1;
                    boardData[idx].mortgaged = p.mortgaged || false;
                }
            });
        }

        document.querySelectorAll('.owner-marker').forEach(e => e.remove());
        boardData.forEach((s, idx) => {
            if (s.owner !== undefined) M_updateMarker(idx);
        });

        let eco = document.getElementById('economy-status');
        if (eco) eco.innerText = `Ekonomi: ${M_ecoState}`;

        M_refreshRentUI();
        M_updateStatsImm();

        let ind = document.getElementById('m-turn-indicator');
        if (ind) {
            ind.innerText = M_currPlayer === 0 ? `Giliran: ${M_players[0].name}` : `Giliran: ${M_players[1].name}`;
            ind.style.background = M_currPlayer === 0 ? "linear-gradient(135deg, #ff4d6d, #c9184a)" : "linear-gradient(135deg, #3a86ff, #001f54)";
        }

        applyArenaVisualTheme();
        document.getElementById('active-arena-tag').innerText = `${activeArena.icon} ${activeArena.name.split(' ')[1] || activeArena.name}`;
        setTimeout(M_updatePositions, 100);

        // PERBAIKAN BUG #5: Sync Arena ke Client jika Host melakukan load save state
        if (isMultiplayer && myPlayerId === 0) {
            sendPeerData({ type: 'SYNC_ARENA', arenaId: activeArena.id });
        }

        document.getElementById('menu-screen').classList.remove('active');
        document.getElementById('monopoly-screen').classList.add('active');

        showCpuToast("Permainan Monopoli berhasil dilanjutkan! 🎩");
        return true;
    } catch(e) {
        console.error("Error loading Monopoly save:", e);
        clearMonopolySave();
        return false;
    }
}
window.loadMonopolyState = loadMonopolyState;

function saveSLState() {
    const data = {
        arenaId: activeArena.id,
        currPlayer: SL_currPlayer,
        players: SL_players.map(p => ({ id: p.id, name: p.name, icon: p.icon, pos: p.pos }))
    };
    localStorage.setItem('arcade_cinta_save_sl', JSON.stringify(data));
}

function clearSLSave() {
    localStorage.removeItem('arcade_cinta_save_sl');
}

function startNewSLSession() {
    invalidateGameSession();
    SL_resetGame();
    closeModal();
    goToRoulette();
}
window.startNewSLSession = startNewSLSession;

function loadSLState() {
    const saved = localStorage.getItem('arcade_cinta_save_sl');
    if (!saved) return false;
    try {
        const data = JSON.parse(saved);
        const arenaObj = arenas.find(a => a.id === data.arenaId);
        if (arenaObj) activeArena = arenaObj;

        SL_currPlayer = data.currPlayer;
        data.players.forEach((p, idx) => {
            if (SL_players[idx]) {
                SL_players[idx].pos = p.pos;
            }
        });

        let p1LoadedName = data.players[0] && data.players[0].name ? data.players[0].name : playerNames.p1;
        let p2LoadedName = data.players[1] && data.players[1].name ? data.players[1].name : playerNames.p2;
        syncPlayerNames(p1LoadedName, p2LoadedName, true);

        applyArenaVisualTheme();
        SL_initBoard();

        let indicator = document.getElementById('sl-turn-indicator');
        if (indicator) {
            indicator.innerText = SL_currPlayer === 0 ? `Giliran: ${SL_players[0].name}` : `Giliran: ${SL_players[1].name}`;
            indicator.style.background = SL_currPlayer === 0 ? "linear-gradient(135deg, #ff4d6d, #c9184a)" : "linear-gradient(135deg, #3a86ff, #001f54)";
        }

        document.getElementById('sl-arena-tag').innerText = `Arena Aktif: ${activeArena.name}`;

        // PERBAIKAN BUG #5: Sync Arena ke Client jika Host melakukan load save state
        if (isMultiplayer && myPlayerId === 0) {
            sendPeerData({ type: 'SYNC_ARENA', arenaId: activeArena.id });
        }

        document.getElementById('sl-screen').classList.add('active');
        document.getElementById('menu-screen').classList.remove('active');

        showCpuToast("Permainan Ular Tangga berhasil dilanjutkan! 🪜");
        return true;
    } catch(e) {
        console.error("Error loading SL save:", e);
        clearSLSave();
        return false;
    }
}
window.loadSLState = loadSLState;

// ==========================================
// GUIDE DATA & FUNCTIONS
// ==========================================
function generateArenaGuideHTML() {
    let html = `<div style="font-weight:900; color:#7209b7; font-size:13.5px; margin-bottom:8px;">✨ Katalog Efek Arena (Buff & Nerf)</div>`;
    arenas.forEach(arena => {
        html += `
        <div class="guide-arena-card">
            <div class="guide-arena-head">
                <span>${arena.icon}</span>
                <span>${cleanName(arena.name)}</span>
            </div>
            <div style="font-size:10.5px; color:#666; margin-bottom:6px; font-style:italic;">"${arena.desc}"</div>
            
            <span class="guide-tag-mono">🎩 Mode Monopoli:</span>
            <div style="font-size:11px; color:#2e7d32; margin-top:2px;"><b>🟢 Buff:</b> ${arena.monopoly.buff}</div>
            <div style="font-size:11px; color:#c62828; margin-top:1px;"><b>🔴 Nerf:</b> ${arena.monopoly.nerf}</div>

            <span class="guide-tag-sl">🪜 Mode Ular Tangga:</span>
            <div style="font-size:11px; color:#2e7d32; margin-top:2px;"><b>🟢 Buff:</b> ${arena.snakes.buff}</div>
            <div style="font-size:11px; color:#c62828; margin-top:1px;"><b>🔴 Nerf:</b> ${arena.snakes.nerf}</div>
        </div>`;
    });
    return html;
}

const guideTexts = {
    monopoly: `
        <div style="font-weight:900; color:#b54553; font-size:14px; margin-bottom:6px;">🎩 Monopoli Ekstrem Pasangan</div>
        <b style="color:#1d3557;">1. Tujuan Permainan:</b><br>
        Kuasai aset properti sebanyak-banyaknya dan pertahankan keuangan agar tidak bangkrut (Batas utang maksimal 10.000 KS).<br><br>
        <b style="color:#1d3557;">2. Cara Bermain:</b><br>
        • Lempar sepasang dadu untuk berjalan mengelilingi papan 54 petak.<br>
        • Beli properti yang kosong atau upgrade level properti untuk menaikkan harga sewa.<br>
        • Mendarat di properti lawan mewajibkanmu membayar sewa sambil melakukan <b>tantangan romantis</b>.<br><br>
        <b style="color:#1d3557;">3. Fitur Utama:</b><br>
        • <b>Bank Sentral:</b> Tempat pinjam atau cicil utang uang.<br>
        • <b>Gadai Aset:</b> Gadai propertimu sendiri di Bank buat dapat cash cepat (50% harga), tapi properti itu jadi gak bisa narik sewa sampai kamu tebus lagi (55% harga).<br>
        • <b>Trade Properti:</b> Tawar-menawar properti (boleh lebih dari satu, plus KS tambahan) sama pasangan lewat menu Bank &rarr; Trade.<br>
        • <b>Toko Suvenir:</b> Belanja 10 item buff dengan syarat melakukan aksi nyata bersama pasangan.<br>
        • <b>Ekonomi Dinamis:</b> Kondisi ekonomi bisa berubah secara acak tiap giliran.
    `,
    sl: `
        <div style="font-weight:900; color:#0077b6; font-size:14px; margin-bottom:6px;">🪜 Ular Tangga Asmara</div>
        <b style="color:#1d3557;">1. Tujuan Permainan:</b><br>
        Jadilah pemain pertama yang mencapai petak 100 (Finish) untuk memenangkan hadiah spesial romantis!<br><br>
        <b style="color:#1d3557;">2. Cara Bermain:</b><br>
        • Putar dadu giliran untuk melangkah maju dari petak 1.<br>
        • Mendarat di pangkal <b>Tangga</b> akan membawamu naik ke atas dengan pesan positif.<br>
        • Mendarat di kepala <b>Ular</b> akan membuatmu merosot turun, namun disertai kejutan <b>30 aksi tantangan sentuhan fisik & perhatian</b> acak.<br><br>
        <b style="color:#1d3557;">3. Zona Maut Puncak:</b><br>
        Petak 80-99 memiliki risiko ular dengan tantangan ganda untuk keseruan menegangkan di akhir permainan!
    `,
    other: `
        <div style="font-weight:900; color:#7209b7; font-size:14px; margin-bottom:6px;">⚙️ Fitur Lain di Menu Utama</div>

        <b style="color:#1d3557;">📱📱 Mode 2 HP (Koneksi Hotspot):</b><br>
        Saat memilih game (Monopoli/Ular Tangga), kamu bisa pilih main di <b>1 HP gantian</b> atau <b>2 HP terpisah</b>.<br>
        • Pastikan kedua HP terhubung ke Hotspot/Wi-Fi yang sama.<br>
        • Satu pemain jadi <b>Host</b> (Buat Room) dan akan dapat kode 4 digit.<br>
        • Pemain lain pilih <b>Masuk Room Pasangan</b>, lalu masukkan kode tersebut untuk tersambung.<br><br>

        <b style="color:#1d3557;">📊 Statistik & Jurnal Kencan:</b><br>
        Menyimpan skor menang/kalah tiap pemain untuk Monopoli dan Ular Tangga, plus jurnal riwayat setiap sesi (pemenang, tanggal, ringkasan kencan). Bisa direset kapan saja lewat tombol Reset Statistik.<br><br>

        <b style="color:#1d3557;">✏️ Kustomisasi Nama:</b><br>
        Ganti panggilan Pemain 1 (🤵) dan Pemain 2 (👰) sesuai selera, lalu simpan agar terpakai di seluruh permainan.<br><br>

        <b style="color:#1d3557;">🖼️ Kustomisasi Papan (Galeri):</b><br>
        Pilih arena tertentu, lalu unggah foto dari galeri HP untuk mengganti latar papan arena tersebut. Ada juga tombol Reset untuk mengembalikan tampilan default arena yang dipilih.
    `
};

function openGuideModal() {
    const modal = document.getElementById('guide-modal');
    if (modal) modal.style.display = 'flex';
    switchGuideTab('monopoly');
}
window.openGuideModal = openGuideModal;

function closeGuideModal() {
    const modal = document.getElementById('guide-modal');
    if (modal) modal.style.display = 'none';
}
window.closeGuideModal = closeGuideModal;

function switchGuideTab(tab) {
    const box = document.getElementById('guide-content-box');
    if (!box) return;
    if (tab === 'arenas') {
        box.innerHTML = generateArenaGuideHTML();
    } else {
        box.innerHTML = guideTexts[tab];
    }
}
window.switchGuideTab = switchGuideTab;

// ==========================================
// INTERACTIVE ARENA TAG FUNCTIONS
// ==========================================
function showActiveArenaInfo() {
    if (!activeArena) return;
    showModal(activeArena.icon, activeArena.name, 
        `<div style="font-style:italic; font-size:12px; margin-bottom:10px; color:#555;">"${activeArena.desc}"</div>` +
        `<div class="buff-box"><b>🟢 Keuntungan (Buff):</b><br>${activeArena.monopoly.buff}</div>` +
        `<div class="nerf-box"><b>🔴 Tantangan (Nerf):</b><br>${activeArena.monopoly.nerf}</div>`,
        `<button class="btn-action btn-buy" onclick="closeModal()">Tutup Info</button>`
    );
}
window.showActiveArenaInfo = showActiveArenaInfo;

function showEconomyInfo() {
    let pct = Math.round(M_globalEco * 100);
    let desc = M_globalEco > 1 ? "Ekonomi lagi NAIK 🔥 Harga properti & sewa jadi lebih MAHAL!" 
             : M_globalEco < 1 ? "Ekonomi lagi TURUN 📉 Harga properti & sewa jadi lebih MURAH!"
             : "Ekonomi Normal ⚖️ Harga properti & sewa berjalan sesuai harga dasar.";
    showModal("🌍", `Ekonomi: ${M_ecoState}`,
        `<div style="font-size:12px; line-height:1.5; color:#555; margin-bottom:10px;">${desc}</div>` +
        `<div class="stats-row" style="margin-bottom:8px;"><div class="stat-pill">Pengali Harga &amp; Sewa Saat Ini<br><span style="font-size:14px; color:var(--primary-dark);">${pct}%</span></div></div>`,
        `<button class="btn-action btn-buy" onclick="closeModal()">Tutup</button>`
    );
}
window.showEconomyInfo = showEconomyInfo;

function showActiveSLArenaInfo() {
    if (!activeArena) return;
    showModal(activeArena.icon, activeArena.name, 
        `<div style="font-style:italic; font-size:12px; margin-bottom:10px; color:#555;">"${activeArena.desc}"</div>` +
        `<div class="buff-box"><b>🟢 Keuntungan Ular Tangga (Buff):</b><br>${activeArena.snakes.buff}</div>` +
        `<div class="nerf-box"><b>🔴 Tantangan Ular Tangga (Nerf):</b><br>${activeArena.snakes.nerf}</div>`,
        `<button class="btn-action btn-buy" onclick="closeModal()">Tutup Info</button>`
    );
}
window.showActiveSLArenaInfo = showActiveSLArenaInfo;

// ==========================================
// SYSTEM AUDIO & HAPTICS BINDING
// ==========================================
document.addEventListener('click', function(e) { if(e.target.closest('button')) playClickSound(); });

// ==========================================
// CANVAS PARTICLE ENGINE
// ==========================================
const cvs = document.getElementById('vfx-canvas');
const ctx = cvs.getContext('2d');
let particles = [];
let isVfxRunning = false;

function resizeCanvas() { cvs.width = window.innerWidth; cvs.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

function spawnVFX(x, y, type, count) {
    for(let i=0; i<count; i++) {
        particles.push({
            x: x, y: y, type: type,
            vx: (Math.random() - 0.5) * (type==='confetti'?15:8),
            vy: (Math.random() - 0.5) * (type==='confetti'?15:8) - (type==='heart'?2:5),
            life: 1.0, decay: Math.random() * 0.015 + 0.01,
            size: Math.random() * 15 + 10,
            color: `hsl(${Math.random()*360}, 100%, 60%)`,
            rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.2
        });
    }
    if (!isVfxRunning) {
        isVfxRunning = true;
        requestAnimationFrame(loopVFX);
    }
}

function drawHeart(ctx, x, y, size) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size/20, size/20);
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.bezierCurveTo(0, 0, -10, 0, -10, 10); ctx.bezierCurveTo(-10, 20, 0, 25, 0, 30); ctx.bezierCurveTo(0, 25, 10, 20, 10, 10); ctx.bezierCurveTo(10, 0, 0, 0, 0, 5); ctx.fillStyle = '#ff4d6d'; ctx.fill(); ctx.restore();
}

function loopVFX() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    for(let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += (p.type==='confetti' ? 0.4 : -0.1);
        p.life -= p.decay; p.rot += p.rotV;
        
        if(p.life <= 0) { particles.splice(i, 1); continue; }
        
        ctx.globalAlpha = Math.max(0, p.life);
        if (p.type === 'heart') { drawHeart(ctx, p.x, p.y, p.size); }
        else if (p.type === 'coin') {
            ctx.save(); ctx.translate(p.x, p.y); ctx.beginPath(); ctx.arc(0,0,p.size/2,0,Math.PI*2); ctx.fillStyle='#ffd700'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#daa520'; ctx.stroke();
            ctx.fillStyle='#b8860b'; ctx.font=`bold ${p.size/1.5}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('$',0,0); ctx.restore();
        }
        else {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2); ctx.restore();
        }
    }
    ctx.globalAlpha = 1.0;
    if (particles.length > 0) {
        requestAnimationFrame(loopVFX);
    } else {
        isVfxRunning = false;
    }
}

// ==========================================
// KARTU HASIL KENCAN (VISUAL JOURNAL)
// ==========================================
const BULAN_INDO = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function formatTanggalIndo(d) {
    return `${d.getDate()} ${BULAN_INDO[d.getMonth()]} ${d.getFullYear()}`;
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    let words = String(text).split(' ');
    let line = '';
    let lines = [];
    for (let i = 0; i < words.length; i++) {
        let testLine = line + words[i] + ' ';
        if (ctx.measureText(testLine).width > maxWidth && line !== '') {
            lines.push(line.trim());
            line = words[i] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line.trim());
    lines.forEach((l, i) => ctx.fillText(l, x, y + (i * lineHeight)));
    return lines.length * lineHeight;
}

function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

async function drawResultCardCanvas(data) {
    try { await document.fonts.ready; } catch(e) {}

    const W = 1080, H = 1920;
    const cvsCard = document.createElement('canvas');
    cvsCard.width = W; cvsCard.height = H;
    const c = cvsCard.getContext('2d');

    let bg = c.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#ff9a9e'); 
    bg.addColorStop(0.5, '#fecfef'); 
    bg.addColorStop(1, '#ffc3a0');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);

    c.shadowColor = 'rgba(0,0,0,0.15)';
    c.shadowBlur = 40;
    c.shadowOffsetY = 20;
    c.fillStyle = '#ffffff';
    roundRectPath(c, 80, 100, W - 160, H - 200, 50);
    c.fill();
    c.shadowColor = 'transparent';

    c.strokeStyle = '#ffb3c6';
    c.lineWidth = 3;
    roundRectPath(c, 100, 120, W - 200, H - 240, 35);
    c.stroke();

    c.textAlign = 'center';
    
    c.fillStyle = '#ff4d6d';
    c.font = "800 32px 'Nunito', sans-serif";
    c.letterSpacing = "6px";
    c.fillText("ARCADE CINTA", W / 2, 220);

    c.fillStyle = '#c9184a';
    c.font = "900 68px 'Nunito', sans-serif";
    c.fillText("MEMORI KENCAN", W / 2, 300);

    c.fillStyle = '#ffe6ea';
    c.fillRect(W/2 - 150, 340, 300, 4);

    c.fillStyle = '#8d6e63';
    c.font = "600 32px 'Poppins', sans-serif";
    let arenaHeight = wrapCanvasText(c, `${data.gameIcon} ${data.gameType} • ${data.arenaName}`, W / 2, 420, W - 260, 42);
    
    c.fillStyle = '#9a8a90';
    c.font = "500 28px 'Poppins', sans-serif";
    c.fillText(`📅 ${data.dateStr}`, W / 2, 420 + arenaHeight + 15);

    c.fillStyle = '#ffd700';
    c.font = "120px 'Nunito', sans-serif";
    c.fillText("👑", W / 2, 630);

    c.fillStyle = '#d90429';
    c.font = "900 65px 'Nunito', sans-serif";
    c.fillText(`${data.winnerName} MENANG!`, W / 2, 730);

    if (data.loserName) {
        c.fillStyle = '#4a4e69';
        c.font = "600 34px 'Poppins', sans-serif";
        c.fillText(`Berhasil mengalahkan ${data.loserName}`, W / 2, 790);
    }

    c.fillStyle = '#fafafa';
    roundRectPath(c, 120, 860, W - 240, 400, 30);
    c.fill();
    c.strokeStyle = '#f3dde3'; c.lineWidth = 2; c.stroke();

    c.textAlign = 'left';
    c.fillStyle = '#2b2d42';
    c.font = "800 34px 'Poppins', sans-serif";
    c.fillText("📈 Rekap Statistik", 160, 930);

    c.font = "500 28px 'Poppins', sans-serif";
    c.fillStyle = '#55474b';
    let sy = 1000;
    data.statLines.forEach(line => { 
        let addedHeight = wrapCanvasText(c, line, 160, sy, W - 320, 40); 
        sy += addedHeight + 15; 
    });

    c.textAlign = 'center';
    let goldGrad = c.createLinearGradient(120, 1300, W - 120, 1550);
    goldGrad.addColorStop(0, '#fff4d6'); goldGrad.addColorStop(1, '#ffecb3');
    c.fillStyle = goldGrad;
    roundRectPath(c, 120, 1300, W - 240, 250, 30);
    c.fill();
    c.strokeStyle = '#d4a373'; c.lineWidth = 3; c.stroke();

    c.fillStyle = '#b9770e';
    c.font = "700 30px 'Poppins', sans-serif";
    c.fillText("✨ Gelar / Hadiah Spesial ✨", W / 2, 1370);
    
    c.fillStyle = '#c9184a';
    c.font = "900 42px 'Nunito', sans-serif";
    wrapCanvasText(c, `"${data.title}"`, W / 2, 1445, W - 280, 50);

    const quotes = [
        "Setiap detik bersamamu adalah kemenangan terbesarku.",
        "Bukan tentang siapa yang menang, tapi dengan siapa aku bermain.",
        "Takdir mempertemukan kita, dadu hanya merayakannya."
    ];
    let randQuote = quotes[Math.floor(Math.random() * quotes.length)];

    c.fillStyle = '#8a7a80';
    c.font = "italic 500 28px 'Poppins', sans-serif";
    wrapCanvasText(c, `"${randQuote}"`, W / 2, 1680, W - 260, 40);

    c.fillStyle = '#b5838d';
    c.font = "700 24px 'Poppins', sans-serif";
    c.fillText("Dibuat dengan 💖 oleh Arcade Cinta", W / 2, H - 140);

    return cvsCard;
}

async function shareOrDownloadCanvas(canvas, filename) {
    let shareSuccess = false;

    if (navigator.canShare && navigator.share) {
        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], filename, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Kartu Kenangan Arcade Cinta' });
                shareSuccess = true;
                return;
            }
        } catch (e) {}
    }

    if (!shareSuccess) {
        try {
            const dataUrl = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showCpuToast("Mencoba menyimpan gambar... 💾");
        } catch (error) {
            alert("Browser kamu memblokir download otomatis. Silakan TEKAN TAHAN gambar untuk menyimpannya!");
        }
    }
}

async function showResultCardPreview(data, gameTypeCode) {
    try {
        showCpuToast("📸 Sedang mencetak memori kencan...");
        const canvas = await drawResultCardCanvas(data);
        const dataUrl = canvas.toDataURL('image/png');

        window.currentExportCanvas = canvas;
        window.currentExportFilename = `ArcadeCinta-${gameTypeCode}-${Date.now()}.png`;

        showModal("💌", "Kartu Kenangan Selesai!",
            `<div style="text-align:center; max-height:45vh; overflow-y:auto; margin-bottom:12px; border-radius:12px; border:2px solid #ffb3c6; padding:6px; background:#fffbf7;">
                <img src="${dataUrl}" style="width:100%; height:auto; border-radius:8px; display:block; box-shadow: 0 4px 10px rgba(0,0,0,0.1); 
                user-select: auto !important; -webkit-user-select: auto !important; -webkit-touch-callout: default !important; pointer-events: auto !important;">
            </div>`,
            `<button class="btn-action btn-buy" style="margin-bottom:8px; background:linear-gradient(135deg, #11998e, #38ef7d);" onclick="downloadCurrentExport()">💾 Coba Simpan / Share</button>
             <button class="btn-action btn-pass" onclick="closeModal()">Tutup</button>`
        );
        HAP('win');
    } catch (e) {
        showCpuToast("Gagal memuat kartu 😢");
    }
}

window.M_saveResultCard = async function() {
    if (!M_lastMatchResult) return;
    await showResultCardPreview(M_lastMatchResult, 'Monopoli');
}

window.SL_saveResultCard = async function() {
    if (!SL_lastMatchResult) return;
    await showResultCardPreview(SL_lastMatchResult, 'UlarTangga');
}

window.downloadCurrentExport = async function() {
    if (!window.currentExportCanvas) return;
    try {
        await shareOrDownloadCanvas(window.currentExportCanvas, window.currentExportFilename);
    } catch(e) {
        showCpuToast("Gagal menyimpan gambar.");
    }
}

// ==========================================
// ARENAS & FEATURES SETUP
// ==========================================
let selectedGameMode = '';
let activeArena = arenas[0];

function promptModeSetup(mode) {
    initAudio();
    selectedGameMode = mode;
    if (mode === 'monopoly') {
        const hasSave = localStorage.getItem('arcade_cinta_save_monopoly');
        if (hasSave) {
            showModal("💾", "Lanjutkan Permainan?", "Ditemukan data sesi Monopoli yang belum selesai. Mau lanjut atau mulai baru?",
                `<button class="btn-action btn-buy" onclick="closeModal(); loadMonopolyState();">▶️ Lanjutkan Permainan</button>
                 <button class="btn-action btn-pay" onclick="startNewMonopolySession();">🆕 Permainan Baru</button>
                 <button class="btn-action btn-pass" onclick="closeModal()">Batal</button>`
            );
        } else {
            startNewMonopolySession();
        }
    } else {
        const hasSave = localStorage.getItem('arcade_cinta_save_sl');
        if (hasSave) {
            showModal("💾", "Lanjutkan Permainan?", "Ditemukan data sesi Ular Tangga yang belum selesai. Mau lanjut atau mulai baru?",
                `<button class="btn-action btn-buy" onclick="closeModal(); loadSLState();">▶️ Lanjutkan Permainan</button>
                 <button class="btn-action btn-pay" onclick="startNewSLSession();">🆕 Permainan Baru</button>
                 <button class="btn-action btn-pass" onclick="closeModal()">Batal</button>`
            );
        } else {
            startNewSLSession();
        }
    }
}
window.promptModeSetup = promptModeSetup;

function goToRoulette() {
    stopRouletteTimer(); 
    document.getElementById('menu-screen').classList.remove('active');
    document.getElementById('roulette-screen').classList.add('active');
    document.getElementById('roulette-icon').innerText = '🎲';
    document.getElementById('roulette-name').innerText = 'Mengacak Arena...';
    document.getElementById('roulette-desc').innerText = 'Tekan tombol di bawah untuk mulai!';
    let btnSpin = document.getElementById('btn-spin');
    if (btnSpin) {
        btnSpin.disabled = false;
        btnSpin.classList.remove('opacity-50');
    }
}
window.goToRoulette = goToRoulette;

function startRoulette() {
    stopRouletteTimer(); 

    if (isMultiplayer && myPlayerId === 1) {
        showCpuToast("Hanya Host (HP 1) yang menentukan arena! ⏳");
        return;
    }

    const btnSpin = document.getElementById('btn-spin');
    if (btnSpin) {
        btnSpin.disabled = true;
        btnSpin.classList.add('opacity-50');
    }

    let counter = 0;
    const maxCount = 20;
    const intervalTime = 100;

    activeRouletteInterval = setInterval(() => {
        const randomArena = arenas[Math.floor(Math.random() * arenas.length)];
        document.getElementById('roulette-icon').innerText = randomArena.icon;
        document.getElementById('roulette-name').innerText = randomArena.name;
        document.getElementById('roulette-desc').innerText = randomArena.desc;
        
        counter++;
        if (counter >= maxCount) {
            stopRouletteTimer();
            activeArena = arenas[Math.floor(Math.random() * arenas.length)];
            
            document.getElementById('roulette-icon').innerText = activeArena.icon;
            document.getElementById('roulette-name').innerText = activeArena.name;
            document.getElementById('roulette-desc').innerText = "Mood Kencan Terpilih!";
            
            if (isMultiplayer && myPlayerId === 0) {
                sendPeerData({ type: 'SYNC_ARENA', arenaId: activeArena.id });
            }

            activeRouletteTimeout = setTimeout(() => {
                activeRouletteTimeout = null;
                showArenaInfoPreview();
            }, 1200);
        }
    }, intervalTime);
}
window.startRoulette = startRoulette;

function showArenaInfoPreview() {
    document.getElementById('roulette-screen').classList.remove('active');
    document.getElementById('arena-info-screen').classList.add('active');

    document.getElementById('info-icon').innerText = activeArena.icon;
    document.getElementById('info-name').innerText = activeArena.name;
    document.getElementById('info-desc').innerText = activeArena.desc;

    if (selectedGameMode === 'monopoly') {
        document.getElementById('info-buff').innerText = activeArena.monopoly.buff;
        document.getElementById('info-nerf').innerText = activeArena.monopoly.nerf;
    } else {
        document.getElementById('info-buff').innerText = activeArena.snakes.buff;
        document.getElementById('info-nerf').innerText = activeArena.snakes.nerf;
    }
}
window.showArenaInfoPreview = showArenaInfoPreview;

function applyArenaVisualTheme() {
    if (!activeArena) return;

    if (activeArena.theme && activeArena.theme.body) {
        document.body.style.background = activeArena.theme.body;
    }

    const style = activeArena.boardStyle;
    const primaryColor = activeArena.theme ? activeArena.theme.primary : '#ff4d6d';

    const customBg = localStorage.getItem('arcade_cinta_bg_' + activeArena.id);

    let mBoard = document.getElementById('m-board');
    if (mBoard && style) {
        if (customBg) {
            mBoard.style.backgroundImage = `url('${customBg}')`;
        } else {
            mBoard.style.backgroundImage = '';
            mBoard.style.background = style.boardBg;
        }
        mBoard.style.border = style.boardBorder;
        mBoard.style.boxShadow = `
            0 4px 0 #3d2514,
            0 12px 30px rgba(0, 0, 0, 0.4),
            0 0 25px ${primaryColor}66
        `;
    }

    let centerArea = document.querySelector('.center-area');
    if (centerArea && style) {
        centerArea.style.gridArea = "2 / 2 / 16 / 9";
        centerArea.style.display = "flex";
        centerArea.style.flexDirection = "column";
        centerArea.style.justifyContent = "space-between";
        centerArea.style.alignItems = "center";
        centerArea.style.padding = "6px 4px";
        centerArea.style.boxSizing = "border-box";
        centerArea.style.border = style.centerBorder || "";
        centerArea.style.background = customBg ? 'transparent' : (style.centerPattern || "");
        centerArea.style.boxShadow = `inset 0 3px 6px rgba(0, 0, 0, 0.08), 0 0 15px ${primaryColor}22`;
        centerArea.style.zIndex = "10";
    }

    let rollBtn = document.getElementById('m-btn-roll');
    if (rollBtn) {
        rollBtn.style.background = `linear-gradient(135deg, ${primaryColor}, #1a1a1a)`;
        rollBtn.style.color = '#ffffff';
        rollBtn.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
    }

    if (style) {
        let cells = document.querySelectorAll('.m-cell');
        cells.forEach(cell => {
            if (customBg) {
                cell.style.background = 'rgba(255, 255, 255, 0.85)';
            } else {
                cell.style.background = style.cellBg;
            }
            cell.style.borderColor = style.cellBorder;

            let cellName = cell.querySelector('.cell-name');
            if (cellName) cellName.style.color = style.textColor;

            let cellPrice = cell.querySelector('.cell-price');
            if (cellPrice && !cellPrice.classList.contains('monopoly-active')) {
                cellPrice.style.color = style.textColor;
            }
        });
    }

    let slBoard = document.getElementById('sl-board');
    if (slBoard) {
        if (customBg) {
            slBoard.style.backgroundImage = `url('${customBg}')`;
        } else {
            slBoard.style.backgroundImage = '';
            slBoard.style.background = activeArena.theme ? activeArena.theme.board : (style ? style.boardBg : '#ffb3c6');
        }
        slBoard.style.borderColor = primaryColor;
        slBoard.style.boxShadow = `0 10px 30px rgba(0, 0, 0, 0.35), 0 0 20px ${primaryColor}44`;
    }
}

function enterGameSession() {
    document.getElementById('arena-info-screen').classList.remove('active');
    applyArenaVisualTheme();

    if (selectedGameMode === 'monopoly') {
        document.getElementById('monopoly-screen').classList.add('active');
        document.getElementById('active-arena-tag').innerText = `${activeArena.icon} ${activeArena.name.split(' ')[1] || activeArena.name}`;
        if (!M_initialized) { 
            M_initBoard(); 
        } else { 
            M_refreshRentUI();
            M_updateStatsImm();
            setTimeout(M_updatePositions, 100); 
        }
        saveMonopolyState();
        M_updateRollButtonState();
    } else {
        document.getElementById('sl-screen').classList.add('active');
        document.getElementById('sl-arena-tag').innerText = `Arena Aktif: ${activeArena.name}`;
        SL_initBoard(); 
        saveSLState();
    }
}
window.enterGameSession = enterGameSession;

function backToMenu() {
    if (window.M_isMoving || window.SL_isMoving) { HAP('error'); showCpuToast("Selesaikan giliran terlebih dahulu!"); return; }
    
    stopRouletteTimer();
    invalidateGameSession();
    
    initAudio(); closeModal(); closeBank(); closeShop();

    if (selectedGameMode === 'monopoly' && M_initialized) saveMonopolyState();
    if (selectedGameMode === 'sl' && SL_initialized) saveSLState();

    document.getElementById('monopoly-screen').classList.remove('active');
    document.getElementById('sl-screen').classList.remove('active');
    document.getElementById('roulette-screen').classList.remove('active');
    document.getElementById('arena-info-screen').classList.remove('active');
    document.body.style.background = 'radial-gradient(circle at top right, #ffe6ea, #fcf0f4, #fff0f3)';
    safeTimeout(() => { document.getElementById('menu-screen').classList.add('active'); }, 400);
}
window.backToMenu = backToMenu;

function showModal(icon, title, text, buttonsHtml) {
    const iconEl = document.getElementById('modal-icon');
    const titleEl = document.getElementById('modal-title');
    const textEl = document.getElementById('modal-text');
    const btnsEl = document.getElementById('modal-buttons');
    const modalEl = document.getElementById('global-modal');

    if (iconEl) iconEl.innerText = icon;
    if (titleEl) titleEl.innerText = title;
    if (textEl) textEl.innerHTML = text;
    if (btnsEl) btnsEl.innerHTML = buttonsHtml;
    if (modalEl) modalEl.style.display = 'flex';
}
window.showModal = showModal;

function closeModal() { 
    const modalEl = document.getElementById('global-modal');
    if (modalEl) modalEl.style.display = 'none'; 
}
window.closeModal = closeModal;

function showCpuToast(msg) {
    let container = document.body;
    let toast = document.createElement('div');
    toast.className = 'cpu-toast'; toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { if(toast.parentNode) toast.remove(); }, 2500);
}
window.showCpuToast = showCpuToast;

// ==========================================
// GAME 2: ULAR TANGGA ASMARA
// ==========================================
let SL_initialized = false;
let SL_currPlayer = 0; let SL_diceRot = { x: 0, y: 0 };
let SL_lastMatchResult = null;

function SL_initBoard() {
    const board = document.getElementById('sl-board');
    if (!board) return;
    
    SL_invalidatePositionCache(); 
    
    const svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgLayer.setAttribute('class', 'sl-svg-layer');
    svgLayer.setAttribute('id', 'sl-svg');
    svgLayer.setAttribute('viewBox', '0 0 100 100');
    svgLayer.setAttribute('preserveAspectRatio', 'none');

    const fragment = document.createDocumentFragment();

    let svgHTML = `
        <defs>
            <linearGradient id="snakeGrad3D" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2b9348" /><stop offset="50%" stop-color="#55a630" /><stop offset="100%" stop-color="#004b23" /></linearGradient>
            <linearGradient id="ladderGrad3D" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f4a261" /><stop offset="100%" stop-color="#e76f51" /></linearGradient>
        </defs>`;
    
    for (let r = 9; r >= 0; r--) {
        for (let c = 0; c < 10; c++) {
            let num = (r % 2 === 0) ? (r * 10 + c + 1) : (r * 10 + 10 - c);
            let cell = document.createElement('div'); 
            cell.className = 'sl-cell' + ((r+c)%2===0 ? ' alt' : ''); 
            cell.id = 'sl-cell-' + num;
            if(num === 1) cell.classList.add('start'); 
            if(num === 100) cell.classList.add('finish');
            cell.innerHTML = `<div class="sl-cell-num">${num}</div>`; 
            fragment.appendChild(cell);
        }
    }

    let currentFeatures = activeArena.slFeatures;
    for (let start in currentFeatures) {
        let feat = currentFeatures[start]; 
        let p1 = getCellCoords(parseInt(start)); 
        let p2 = getCellCoords(feat.end);
        
        if (feat.type === 'ladder') {
            let dx = p2.x - p1.x; 
            let dy = p2.y - p1.y; 
            let angle = Math.atan2(dy, dx);
            let offX = Math.cos(angle + Math.PI/2) * 1.8; 
            let offY = Math.sin(angle + Math.PI/2) * 1.8;
            
            svgHTML += `<line x1="${p1.x - offX}" y1="${p1.y - offY}" x2="${p2.x - offX}" y2="${p2.y - offY}" stroke="#2b2d42" stroke-width="2.2" stroke-linecap="round"/>`;
            svgHTML += `<line x1="${p1.x - offX}" y1="${p1.y - offY}" x2="${p2.x - offX}" y2="${p2.y - offY}" stroke="url(#ladderGrad3D)" stroke-width="1.1" stroke-linecap="round"/>`;
            svgHTML += `<line x1="${p1.x + offX}" y1="${p1.y + offY}" x2="${p2.x + offX}" y2="${p2.y + offY}" stroke="#2b2d42" stroke-width="2.2" stroke-linecap="round"/>`;
            svgHTML += `<line x1="${p1.x + offX}" y1="${p1.y + offY}" x2="${p2.x + offX}" y2="${p2.y + offY}" stroke="url(#ladderGrad3D)" stroke-width="1.1" stroke-linecap="round"/>`;
            
            let stepCount = Math.max(3, Math.floor(Math.sqrt(dx*dx + dy*dy) / 3));
            for(let i=1; i<stepCount; i++) {
                let rx = p1.x + dx * (i/stepCount); 
                let ry = p1.y + dy * (i/stepCount);
                svgHTML += `<line x1="${rx - offX}" y1="${ry - offY}" x2="${rx + offX}" y2="${ry + offY}" stroke="#2b2d42" stroke-width="1.5" stroke-linecap="round"/>`;
                svgHTML += `<line x1="${rx - offX}" y1="${ry - offY}" x2="${rx + offX}" y2="${rx + offY}" stroke="#fff" stroke-width="0.8" stroke-linecap="round"/>`;
            }
        } else {
            let cx = (p1.x + p2.x) / 2 + ((parseInt(start) % 2 === 0) ? 6 : -6); 
            let cy = (p1.y + p2.y) / 2;
            
            svgHTML += `<path d="M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}" stroke="#1b4332" stroke-width="4" fill="none" stroke-linecap="round"/>`;
            svgHTML += `<path d="M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}" stroke="url(#snakeGrad3D)" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
            
            let hAngle = Math.atan2(cy - p1.y, cx - p1.x) * (180/Math.PI);
            let tx = p1.x - Math.cos(hAngle*Math.PI/180)*2.5; 
            let ty = p1.y - Math.sin(hAngle*Math.PI/180)*2.5;
            svgHTML += `<path d="M ${p1.x} ${p1.y} L ${tx} ${ty}" stroke="#d90429" stroke-width="1.2" fill="none"/>`;
            svgHTML += `<ellipse cx="${p1.x}" cy="${p1.y}" rx="2.5" ry="1.8" fill="#004b23" transform="rotate(${hAngle} ${p1.x} ${p1.y})"/>`;
            svgHTML += `<circle cx="${p1.x - 0.8}" cy="${p1.y - 1}" r="0.6" fill="#fff"/><circle cx="${p1.x - 0.8}" cy="${p1.y + 1}" r="0.6" fill="#fff"/>`;
        }
    }

    svgLayer.innerHTML = svgHTML;
    board.innerHTML = '';
    board.appendChild(svgLayer);
    board.appendChild(fragment);

    SL_players.forEach(p => {
        let el = document.createElement('div'); 
        el.className = `player p${p.id + 1}`; 
        el.innerText = p.icon; 
        el.id = 'sl-p' + p.id;
        board.appendChild(el); 
        p.element = el;
    });

    setTimeout(SL_updatePositions, 100); 
    SL_initialized = true;
}

function SL_updatePositions(targetPlayerId = null) {
    if (!document.getElementById('sl-screen').classList.contains('active')) return;
    
    if (!SL_cellRectCache) {
        SL_cellRectCache = Array.from({ length: 100 }, (_, i) => {
            const cell = document.getElementById('sl-cell-' + (i + 1));
            return cell ? { top: cell.offsetTop, left: cell.offsetLeft, width: cell.offsetWidth, height: cell.offsetHeight } : null;
        });
    }
    if (!SL_playerSizeCache) {
        SL_playerSizeCache = SL_players.map((p) => {
            const el = p.element || document.getElementById('sl-p' + p.id);
            return el ? { w: el.offsetWidth, h: el.offsetHeight } : { w: 16, h: 16 };
        });
    }

    requestAnimationFrame(() => {
        SL_players.forEach((p, i) => {
            if (targetPlayerId !== null && targetPlayerId !== p.id) return;
            
            let rect = SL_cellRectCache[p.pos - 1];
            let el = p.element || document.getElementById('sl-p' + p.id);
            if (rect && el) {
                let size = SL_playerSizeCache[i];
                let top = rect.top + (rect.height / 2) - (size.h / 2); 
                let left = rect.left + (rect.width / 2) - (size.w / 2);
                let offset = rect.width * 0.2; 
                if (i === 0) { left -= offset; top -= offset; } else { left += offset; top += offset; }
                
                let bump = el.classList.contains('moving') ? ' scale(1.35) translateY(-3px)' : '';
                el.style.transform = `translate3d(${left}px, ${top}px, 0)${bump}`;
            }
        });
    });
}

function getRotationSL(face) {
    switch(face) { case 1: return { x: 0, y: 0 }; case 2: return { x: -90, y: 0 }; case 3: return { x: 0, y: -90 }; case 4: return { x: 0, y: 90 }; case 5: return { x: 90, y: 0 }; case 6: return { x: 180, y: 0 }; default: return { x: 0, y: 0 }; }
}

function calcSpinSL(curr, targetFace) {
    let tgt = getRotationSL(targetFace); let nx = curr.x + 1080; let ny = curr.y + 1080;
    nx += (tgt.x - (nx % 360)); ny += (tgt.y - (ny % 360)); return { x: nx, y: ny };
}

async function SL_rollDice() {
    if(window.SL_isMoving) return; 

    if (isMultiplayer && myPlayerId !== SL_currPlayer) {
        showCpuToast("Tunggu giliran pasanganmu! ⏳");
        return;
    }

    window.SL_isMoving = true; 
    const token = gameSessionToken;
    const rollBtn = document.getElementById('sl-btn-roll');
    if (rollBtn) rollBtn.disabled = true;

    try {
        playDiceSound(); let roll = Math.floor(Math.random() * 6) + 1;
        
        if (activeArena.id === 'cafe' && roll >= 5) { roll += 1; showCpuToast("☕ Buff Cafe: Bonus +1 langkah!"); }
        if (activeArena.id === 'library') { roll = Math.min(6, Math.max(2, roll)); }
        if (activeArena.id === 'beach') {
            if (Math.random() < 0.3) { roll += 1; showCpuToast("🌅 Buff Beach: Angin pantai +1 langkah!"); }
            else if (Math.random() < 0.3) { roll = Math.max(1, roll - 1); showCpuToast("🌊 Nerf Beach: Ombak menghambat -1 langkah!"); }
        }
        if (activeArena.id === 'cosmos') {
            if (Math.random() < 0.3) { roll += 2; showCpuToast("🚀 Buff Cosmos: Dorongan roket +2 langkah!"); }
            else if (Math.random() < 0.3) { roll = Math.max(1, roll - 2); showCpuToast("🕳️ Nerf Cosmos: Lubang hitam menyedot -2 langkah!"); }
        }

        if (isMultiplayer) {
            sendPeerData({ type: 'SYNC_ROLL_SL', roll: roll });
        }

        SL_diceRot = calcSpinSL(SL_diceRot, ((roll - 1) % 6) + 1); 
        const slDice = document.getElementById('sl-dice');
        if (slDice) slDice.style.transform = `rotateX(${SL_diceRot.x}deg) rotateY(${SL_diceRot.y}deg)`;
        await sleep(1300);
        
        if (token !== gameSessionToken) {
            window.SL_isMoving = false;
            if (rollBtn) rollBtn.disabled = false;
            return;
        }
        
        await SL_animateMove(SL_players[SL_currPlayer], roll);
    } catch (err) {
        console.error('SL_rollDice error:', err);
        window.SL_isMoving = false;
        if (rollBtn) rollBtn.disabled = false;
    }
}
window.SL_rollDice = SL_rollDice;

async function SL_animateMove(player, roll) {
    const token = gameSessionToken;
    if (player.element) player.element.classList.add('moving'); 
    let direction = 1;
    for(let i = 0; i < roll; i++) {
        if (token !== gameSessionToken) {
            if (player.element) player.element.classList.remove('moving');
            return;
        }
        player.pos += direction; 
        if(player.pos === 100 && i < roll - 1) direction = -1; 
        SL_updatePositions(); 
        playStepSound(); 
        await sleep(300); 
    }
    
    if (token !== gameSessionToken) {
        if (player.element) player.element.classList.remove('moving');
        return;
    }
    if (player.element) player.element.classList.remove('moving'); 
    await sleep(300);
    if (token !== gameSessionToken) return;
    
    let currentFeatures = activeArena.slFeatures;
    if (currentFeatures[player.pos]) {
        let feat = currentFeatures[player.pos]; 
        let isSnake = feat.type === 'snake';
        
        player.pos = feat.end;
        SL_updatePositions();
        
        if (!isMultiplayer || myPlayerId === player.id) {
            syncGameStateSL();

            if (isSnake) {
                let randomChallenge = slPhysicalChallenges[Math.floor(Math.random() * slPhysicalChallenges.length)];
                showModal("🐍", "Ops! Turun karena Ular!", 
                    `<b>${feat.msg}</b><br><br>Menuju petak ${feat.end}<br><br><div style="background:#ffe6ea; padding:12px; border-radius:12px; border:2px solid var(--primary); text-align:left; font-size:12px; line-height:1.4; color:var(--primary-dark);"><b style="color:#d90429;">💖 Tantangan Sentuhan Fisik:</b><br>"${randomChallenge}"</div>`, 
                    `<button class="btn-action btn-pay" onclick="SL_finishFeatureStep(${player.id})">Sudah Dilakukan! Meluncur Turun 😭</button>`
                );
            } else {
                showModal("🪜", "Yey! Naik!", `<b>${feat.msg}</b><br><br>Menuju petak ${feat.end}`, 
                    `<button class="btn-action btn-buy" onclick="SL_finishFeatureStep(${player.id})">Let's Go!</button>`
                );
            }
        }
    } else if (player.pos === 100) { 
        if (!isMultiplayer || myPlayerId === player.id) {
            syncGameStateSL();
            SL_winGame(player); 
        }
    } else { 
        if (!isMultiplayer || myPlayerId === player.id) {
            syncGameStateSL();
            SL_endTurn(); 
        }
    }
}

window.SL_finishFeatureStep = function(playerId) {
    closeModal();
    let player = SL_players[playerId];
    
    if (isMultiplayer && myPlayerId !== playerId) return;

    if (player.pos === 100) {
        SL_winGame(player); 
    } else {
        SL_endTurn();
    }
};

function SL_resetGame() {
    invalidateGameSession();
    clearSLSave();
    SL_players.forEach(p => p.pos = 1);
    syncPlayerNames(playerNames.p1, playerNames.p2, false);
    SL_currPlayer = 0; window.SL_isMoving = false; SL_diceRot = {x:0, y:0};
    SL_updatePositions();
    let indicator = document.getElementById('sl-turn-indicator');
    if(indicator) { indicator.innerText = `Giliran: ${SL_players[0].name}`; indicator.style.background = "linear-gradient(135deg, #ff4d6d, #c9184a)"; }
    let rollBtn = document.getElementById('sl-btn-roll');
    if(rollBtn) rollBtn.disabled = false;
    closeModal();
}
window.SL_resetGame = SL_resetGame;

function SL_winGame(player) {
    clearSLSave();
    window.SL_isMoving = false; 
    let winnerId = player.id;
    let loserId = player.id === 0 ? 1 : 0;
    let loserPlayer = SL_players[loserId];
    
    recordMatchResult('sl', winnerId, loserId, `Mencapai petak finish 100 di arena ${activeArena.name}.`);
    spawnVFX(window.innerWidth/2, window.innerHeight/2, 'confetti', 100); HAP('win');

    let prizeTextDefault = SL_PRIZES[Math.floor(Math.random() * SL_PRIZES.length)];

    SL_lastMatchResult = {
        gameType: 'Ular Tangga Asmara', gameIcon: '🪜', arenaName: activeArena.name,
        dateStr: formatTanggalIndo(new Date()),
        winnerName: player.name, loserName: loserPlayer ? loserPlayer.name : '',
        statLines: [`🏁 Finish di petak 100`],
        title: "Pemenang Ular Tangga 👑"
    };

    if (isMultiplayer) {
        if (myPlayerId === winnerId) {
            let optionsHtml = WINNER_PRIZE_OPTIONS.map(opt => 
                `<button class="btn-action btn-buy" style="margin-bottom:6px; font-size:11.5px; text-align:left;" onclick="SL_claimPrize('${opt}')">🎁 ${opt}</button>`
            ).join('');

            showModal("👑", `KEMENANGAN MUTLAK!`, 
                `<b>${player.name} MENCAPAI FINISH!</b><br><br>` +
                `<div style="font-size:12px; font-weight:800; color:var(--primary-dark); margin-bottom:8px;">Pilih 1 Hadiah Kemenanganmu:</div>` +
                optionsHtml, 
                `<button class="btn-action btn-buy" style="background:linear-gradient(135deg, #ffb703, #d4a373); margin-top:6px;" onclick="SL_saveResultCard()">📸 Simpan Kartu Kenangan</button>`
            );
        } else {
            showModal("💖", `Kalah di Papan, Menang di Hati!`, 
                `<b>${player.name}</b> berhasil mencapai petak 100 duluan!<br><br>` +
                `<div style="background:#ffe6ea; padding:12px; border-radius:12px; border:2px solid #ff4d6d; font-size:12px; color:#c9184a; font-weight:700;">` +
                `⏳ Menunggu ${player.name} memilih hadiah kemenangannya...` +
                `</div>`,
                `<button class="btn-action btn-buy" style="background:linear-gradient(135deg, #ffb703, #d4a373);" onclick="SL_saveResultCard()">📸 Simpan Kartu Kenangan</button>`
            );
        }
    } else {
        showModal("👑", `KEMENANGAN MUTLAK!`, 
            `<b>${player.name} MENCAPAI FINISH!</b><br><br>` +
            `<div style="background:#ffe6ea; padding:12px; border-radius:12px; border:2px solid #ff4d6d; margin-top:10px;"><b style="color:#d90429;">🎁 HADIAH SPESIALMU:</b><br><span style="font-size:14px; font-weight:800; color:#333;">"${prizeTextDefault}"</span></div>`, 
            `<button class="btn-action btn-buy" style="background:linear-gradient(135deg, #ffb703, #d4a373); margin-bottom:8px;" onclick="SL_saveResultCard()">📸 Simpan Kartu Kenangan</button><button class="btn-action btn-buy" onclick="SL_resetGame(); backToMenu();">Selesai & Main Lagi!</button>`
        );
    }
}

function SL_endTurn(fromRemote = false) {
    SL_currPlayer = SL_currPlayer === 0 ? 1 : 0; 
    let indicator = document.getElementById('sl-turn-indicator');
    let playerName = SL_currPlayer === 0 ? SL_players[0].name : SL_players[1].name;
    if (indicator) {
        indicator.innerText = `Giliran: ${playerName}`; 
        indicator.style.background = SL_currPlayer === 0 ? "linear-gradient(135deg, #ff4d6d, #c9184a)" : "linear-gradient(135deg, #3a86ff, #001f54)";
    }
    const rollBtn = document.getElementById('sl-btn-roll');
    if (rollBtn) rollBtn.disabled = false;
    window.SL_isMoving = false;
    saveSLState();

    if (isMultiplayer && !fromRemote) {
        syncGameStateSL();
        sendPeerData({ type: 'SYNC_END_TURN' });
    }
}

// ==========================================
// GAME 1: MONOPOLY
// ==========================================
let M_initialized = false;

let M_matchStats = [
    { challenges: 0, properties: 0 },
    { challenges: 0, properties: 0 }
];
let M_lastMatchResult = null;

let M_currPlayer = 0; const MAX_DEBT = 10000;
let M_diceRot = [{ x: 0, y: 0 }, { x: 0, y: 0 }]; let M_displayMoney = [800, 800];
let M_hasExtraTurn = false; let M_doubleCount = 0; let M_turnCounter = 0; let M_globalEco = 1.0; let M_ecoState = "Normal ⚖️";
let M_ecoShiftTarget = Math.floor(Math.random() * 6) + 5; 

// ==========================================
// MONOPOLI MULTIPLAYER TURN-LOCK & ROLL SEQUENCE ENGINE
// ==========================================
let M_lastRollSeq = 0;

function M_updateRollButtonState() {
    const rollBtn = document.getElementById('m-btn-roll');
    if (!rollBtn) return;

    const isMyTurn = !isMultiplayer || (myPlayerId === M_currPlayer);
    const canRoll = isMyTurn && !window.M_isMoving;

    rollBtn.disabled = !canRoll;
    if (!canRoll) {
        rollBtn.classList.add('opacity-50');
    } else {
        rollBtn.classList.remove('opacity-50');
    }
}
window.M_updateRollButtonState = M_updateRollButtonState;

function M_initBoard() {
    const board = document.getElementById('m-board');
    if (!board) return;

    M_invalidatePositionCache();

    board.querySelectorAll('.m-cell, .player, .owner-marker').forEach(el => el.remove());

    boardData.forEach((space, index) => {
        let div = document.createElement('div'); 
        div.className = 'm-cell'; 
        div.id = 'm-space-' + index;
        let row, col;
        
        if (index >= 0 && index <= 8) { 
            row = 16; col = 9 - index; 
        } else if (index >= 9 && index <= 22) { 
            col = 1; row = 16 - (index - 8); 
        } else if (index >= 23 && index <= 31) { 
            row = 1; col = 1 + (index - 23); 
        } else if (index >= 32 && index <= 45) { 
            col = 9; row = 2 + (index - 32); 
        }

        div.style.gridArea = `${row} / ${col} / ${row+1} / ${col+1}`;
        if (space.type === "property" || space.type === "transport" || space.type === "utility") {
            div.innerHTML = `<div class="cell-header" style="background:${space.color};"></div><div class="cell-body"><div class="cell-icon">${space.icon}</div><div class="cell-name">${space.name}</div><div class="cell-price" id="rent-display-${index}">${space.price}</div></div>`;
        } else if (space.type === "go" || space.type === "jail" || space.type === "free" || space.type === "goto_jail") {
            div.classList.add('corner-cell'); 
            div.innerHTML = `<div class="cell-body" style="background:${space.color}; padding:1px;"><div class="cell-icon">${space.icon}</div><div class="cell-name">${space.name}</div></div>`;
        } else {
            let priceText = space.amount ? (typeof space.amount === 'string' ? space.amount : `${space.amount}`) : '';
            div.innerHTML = `<div class="cell-body" style="background:${space.color};"><div class="cell-icon">${space.icon}</div><div class="cell-name">${space.name}</div>${priceText ? `<div class="cell-price">${priceText}</div>` : ''}</div>`;
        }
        board.appendChild(div);
    });

    M_players.forEach((p, i) => { 
        let el = document.createElement('div'); 
        el.className = `player p${i+1}`; 
        el.innerText = p.icon; 
        el.id = 'm-player-' + (i+1); 
        board.appendChild(el); 
        p.element = el;
    });

    setTimeout(M_updatePositions, 100); 
    M_updateStatsImm(); 
    applyArenaVisualTheme();
    M_initialized = true;
}

function M_updatePositions(targetPlayerId = null) {
    if(!document.getElementById('monopoly-screen').classList.contains('active')) return;

    if (!M_cellRectCache) {
        M_cellRectCache = boardData.map((_, index) => {
            const cell = document.getElementById('m-space-' + index);
            return cell ? { top: cell.offsetTop, left: cell.offsetLeft, width: cell.offsetWidth, height: cell.offsetHeight } : null;
        });
    }
    if (!M_playerSizeCache) {
        M_playerSizeCache = M_players.map((p, i) => {
            const el = p.element || document.getElementById('m-player-' + (i + 1));
            return el ? { w: el.offsetWidth, h: el.offsetHeight } : { w: 14, h: 14 };
        });
    }

    M_players.forEach((p, index) => {
        if (targetPlayerId !== null && targetPlayerId !== p.id) return;

        let el = p.element || document.getElementById('m-player-' + (index + 1));
        let rect = M_cellRectCache[p.pos];
        if (rect && el) {
            let size = M_playerSizeCache[index];
            let top = rect.top + (rect.height / 2) - (size.h / 2);
            let left = rect.left + (rect.width / 2) - (size.w / 2);
            let offset = rect.width * 0.15; 
            if(index === 0) { left -= offset; top -= offset; } else { left += offset; top += offset; }
            
            let bump = el.classList.contains('moving') ? ' scale(1.35) translateY(-3px)' : '';
            el.style.transform = `translate3d(${left}px, ${top}px, 0)${bump}`;
        }
    });
}

function M_calcRent(space) {
    if (space.owner === undefined) {
        let basePrc = space.price;
        if (activeArena.id === 'cafe') basePrc *= 0.9;
        if (activeArena.id === 'carnival') basePrc *= 1.05;
        return Math.floor(basePrc * M_globalEco);
    }
    let ownerId = space.owner; let currentRent = space.rent;
    if (space.mortgaged) return 0;
    if (activeArena.id === 'castle' && space.level === 3) currentRent *= 1.5;
    if (activeArena.id === 'museum') currentRent *= 0.9;
    if (activeArena.id === 'cafe') currentRent *= 0.9;

    let sameGroup = boardData.filter(s => s.group === space.group); let ownsAll = sameGroup.every(s => s.owner === ownerId); 
    if (space.type === "property") { currentRent = currentRent * Math.pow(2, space.level - 1); if (ownsAll) currentRent *= 2; 
    } else if (space.type === "transport") { currentRent = currentRent * Math.pow(2, boardData.filter(s => s.type === "transport" && s.owner === ownerId).length - 1);
    } else if (space.type === "utility") { currentRent = currentRent * boardData.filter(s => s.type === "utility" && s.owner === ownerId).length; }
    return Math.floor(currentRent * M_globalEco);
}

function M_refreshRentUI() {
    let monopolizedGroups = new Set();
    let groupMap = {};
    boardData.forEach(s => { if (s.type === 'property' && s.group) { (groupMap[s.group] = groupMap[s.group] || []).push(s); } });
    Object.keys(groupMap).forEach(g => {
        let arr = groupMap[g];
        if (arr[0].owner !== undefined && arr.every(s => s.owner === arr[0].owner)) monopolizedGroups.add(g);
    });

    boardData.forEach((space, index) => {
        let el = document.getElementById('rent-display-' + index); if (!el) return;
        let displayPrice = space.price;
        if(activeArena.id === 'cafe') displayPrice = Math.floor(displayPrice * 0.9);
        if(activeArena.id === 'carnival') displayPrice = Math.floor(displayPrice * 1.05);
        if (space.owner === undefined) { el.innerText = `${Math.floor(displayPrice * M_globalEco)}`; el.classList.remove('monopoly-active'); } 
        else {
            let actualRent = M_calcRent(space); let isMono = space.type === "property" && monopolizedGroups.has(space.group);
            if (space.mortgaged) {
                el.innerHTML = `<span class="rent-badge" style="background:#94a3b8; color:#fff; border-color:#64748b;">🔒 Gadai</span>`;
                el.classList.remove('monopoly-active');
            } else {
                el.innerHTML = `<span class="rent-badge" ${isMono ? 'style="background:#ffd700; color:#333; border-color:#d4a373;"' : ''}>Sewa ${actualRent}</span>`;
                if(isMono) el.classList.add('monopoly-active');
            }
        }
    });
}

function M_shiftEco() {
    let states = [ { name: "Normal ⚖️", mult: 1.0, gaji: 1000, color: "#4a4e69" }, { name: "Inflasi 🔥", mult: 1.5, gaji: 1500, color: "#d90429" }, { name: "Resesi 📉", mult: 0.5, gaji: 500, color: "#3a86ff" } ];
    let rand;
    if (activeArena.id === 'cosmos') {
        let roll = Math.random();
        rand = roll < 0.45 ? states[1] : (roll < 0.75 ? states[0] : states[2]);
    } else {
        rand = states[Math.floor(Math.random() * states.length)];
    }
    M_ecoState = rand.name; M_globalEco = rand.mult;
    let finalGaji = Math.floor(rand.gaji);
    boardData[0].name = `START<br>(+${finalGaji})`; 
    let ecoUI = document.getElementById('economy-status');
    if(ecoUI) { ecoUI.innerText = `Ekonomi: ${M_ecoState}`; ecoUI.style.background = rand.color; }
    M_refreshRentUI(); showCpuToast(`🌍 EKONOMI: ${M_ecoState}`);
}

let M_animReq = [null, null];
function M_updateStats() { 
    M_animMoney(0, M_players[0].money); 
    M_animMoney(1, M_players[1].money); 
    const debtP1 = document.getElementById('m-debt-p1');
    const debtP2 = document.getElementById('m-debt-p2');
    if (debtP1) debtP1.innerText = M_players[0].debt; 
    if (debtP2) debtP2.innerText = M_players[1].debt; 
}

function M_updateStatsImm() { 
    M_displayMoney[0] = M_players[0].money; 
    M_displayMoney[1] = M_players[1].money; 
    const moneyP1 = document.getElementById('m-money-p1');
    const moneyP2 = document.getElementById('m-money-p2');
    const debtP1 = document.getElementById('m-debt-p1');
    const debtP2 = document.getElementById('m-debt-p2');
    if (moneyP1) moneyP1.innerText = M_displayMoney[0]; 
    if (moneyP2) moneyP2.innerText = M_displayMoney[1]; 
    if (debtP1) debtP1.innerText = M_players[0].debt; 
    if (debtP2) debtP2.innerText = M_players[1].debt; 
}

function M_animMoney(pIdx, tgt) {
    let start = M_displayMoney[pIdx]; if (start === tgt) return;
    if(M_animReq[pIdx]) cancelAnimationFrame(M_animReq[pIdx]);
    let el = document.getElementById(`m-money-p${pIdx + 1}`);
    let inc = (tgt - start) / 15; let step = 0;
    function run() {
        step++; start += inc; M_displayMoney[pIdx] = Math.round(start);
        if(step >= 15) M_displayMoney[pIdx] = tgt;
        if(el) el.innerText = M_displayMoney[pIdx];
        if (step < 15) M_animReq[pIdx] = requestAnimationFrame(run);
    }
    M_animReq[pIdx] = requestAnimationFrame(run);
}

function M_updateMarker(pos) {
    let space = boardData[pos]; if (space.owner === undefined) return;
    let p = M_players[space.owner]; let stars = "⭐".repeat(space.level);
    let marker = document.getElementById('owner-' + pos);
    if (!marker) { marker = document.createElement('div'); marker.className = 'owner-marker'; marker.id = 'owner-' + pos; let spaceEl = document.getElementById('m-space-' + pos); if(spaceEl) spaceEl.appendChild(marker); }
    if (space.mortgaged) { if(marker) marker.innerHTML = `🔒`; return; }
    if(marker) marker.innerHTML = `${p.icon} <span style="color:#fbc02d">${stars}</span>`;
}

// ===== BANK SYSTEM =====
function M_openBank() {
    let p = M_players[M_currPlayer]; 
    const pName = document.getElementById('bank-player-name');
    const pMoney = document.getElementById('bank-money');
    const pDebt = document.getElementById('bank-debt');
    const bankModal = document.getElementById('bank-modal');

    if (pName) pName.innerText = p.name; 
    if (pMoney) pMoney.innerText = p.money + " KS";
    let maxDebtLimit = activeArena.id === 'winter' ? 15000 : MAX_DEBT;
    if (pDebt) pDebt.innerText = p.debt + " KS (Maks: " + maxDebtLimit + ")"; 
    if (bankModal) bankModal.style.display = 'flex';

    const repayBtn = document.getElementById('bank-repay-btn');
    if (repayBtn) {
        let payAmount = Math.min(1000, p.debt);
        repayBtn.innerText = p.debt > 0 ? `Bayar ${payAmount}` : "Tidak Ada Utang";
    }

    if (isMultiplayer && myPlayerId === M_currPlayer) {
        syncUIStatus(true, "Bank Sentral", "🏦");
    }
}
window.M_openBank = M_openBank;

function closeBank() { 
    const bankModal = document.getElementById('bank-modal');
    if (bankModal) bankModal.style.display = 'none'; 
    if (isMultiplayer && myPlayerId === M_currPlayer) {
        syncUIStatus(false, "Bank Sentral", "🏦");
    }
}
window.closeBank = closeBank;

// ===== GADAI SYSTEM =====
function M_openGadaiModal() {
    let p = M_players[M_currPlayer];
    const container = document.getElementById('gadai-items-container');
    const nameEl = document.getElementById('gadai-player-name');
    if (nameEl) nameEl.innerText = p.name;

    let myProps = boardData.filter(s => s.owner === p.id && (s.type === 'property' || s.type === 'transport' || s.type === 'utility'));
    let html = '';
    if (myProps.length === 0) {
        html = '<i style="color:#9a8a90; font-size:11px; display:block; text-align:center; padding:10px 0;">Kamu belum punya properti buat digadai.</i>';
    } else {
        myProps.forEach(s => {
            let gadaiVal = Math.floor(s.price * 0.5);
            let tebusVal = Math.floor(s.price * 0.55);
            let btn = s.mortgaged
                ? `<button class="shop-btn-buy" onclick="M_tebusGadai(${s.id})">Tebus ${tebusVal}</button>`
                : `<button class="shop-btn-use" onclick="M_doGadai(${s.id})">Gadai +${gadaiVal}</button>`;
            html += `<div class="shop-item"><div class="shop-item-info"><div class="shop-item-title">${s.icon} ${s.name.replace(/<br>/g,' ')}</div><div class="shop-item-desc">${s.mortgaged ? '🔒 Sedang digadai' : `Nilai gadai: ${gadaiVal} KS`}</div></div>${btn}</div>`;
        });
    }
    if (container) container.innerHTML = html;
    const modal = document.getElementById('gadai-modal');
    if (modal) modal.style.display = 'flex';

    if (isMultiplayer && myPlayerId === M_currPlayer) {
        syncUIStatus(true, "Menu Gadai", "🔒");
    }
}
window.M_openGadaiModal = M_openGadaiModal;

function closeGadai() { 
    const m = document.getElementById('gadai-modal'); 
    if (m) m.style.display = 'none'; 
    if (isMultiplayer && myPlayerId === M_currPlayer) {
        syncUIStatus(false, "Menu Gadai", "🔒");
    }
}
window.closeGadai = closeGadai;

function M_doGadai(pos) {
    let s = boardData[pos]; let p = M_players[M_currPlayer];
    if (s.owner !== p.id || s.mortgaged) return;
    let gadaiVal = Math.floor(s.price * 0.5);
    s.mortgaged = true; p.money += gadaiVal;
    M_updateStats(); M_updateMarker(pos); M_refreshRentUI(); saveMonopolyState();
    syncGameStateM();
    showCpuToast(`🔒 ${s.name.replace(/<br>/g,' ')} digadai, +${gadaiVal} KS!`);
    M_openGadaiModal();
}
window.M_doGadai = M_doGadai;

function M_tebusGadai(pos) {
    let s = boardData[pos]; let p = M_players[M_currPlayer];
    if (s.owner !== p.id || !s.mortgaged) return;
    let tebusVal = Math.floor(s.price * 0.55);
    if (p.money < tebusVal) { HAP('error'); showCpuToast("Uang kurang buat nebus!"); return; }
    p.money -= tebusVal; s.mortgaged = false;
    M_updateStats(); M_updateMarker(pos); M_refreshRentUI(); saveMonopolyState();
    syncGameStateM();
    showCpuToast(`🔓 ${s.name.replace(/<br>/g,' ')} berhasil ditebus!`);
    M_openGadaiModal();
}
window.M_tebusGadai = M_tebusGadai;

// ===== TRADE SYSTEM (PERBAIKAN BUG #2) =====
function M_openTradeModal() {
    let me = M_players[M_currPlayer]; let other = M_players[M_currPlayer === 0 ? 1 : 0];
    const nameEl = document.getElementById('trade-player-name');
    const otherNameEl = document.getElementById('trade-other-name');
    if (nameEl) nameEl.innerText = me.name;
    if (otherNameEl) otherNameEl.innerText = other.name;

    let myProps = boardData.filter(s => s.owner === me.id && (s.type === 'property' || s.type === 'transport' || s.type === 'utility'));
    let otherProps = boardData.filter(s => s.owner === other.id && (s.type === 'property' || s.type === 'transport' || s.type === 'utility'));

    const renderList = (list) => list.length === 0
        ? '<i style="color:#9a8a90; font-size:10.5px; display:block; padding:6px 0;">Tidak ada properti.</i>'
        : list.map(s => `<label style="display:flex; align-items:center; gap:6px; padding:5px 2px; font-size:11px; font-weight:700; border-bottom:1px solid #f3dde3;"><input type="checkbox" class="trade-check-${s.owner === me.id ? 'mine' : 'theirs'}" value="${s.id}"> ${s.icon} ${s.name.replace(/<br>/g,' ')} ${s.mortgaged ? '<span style="color:#64748b; font-weight:800;">(🔒 Digadai)</span>' : ''}</label>`).join('');

    const myList = document.getElementById('trade-my-props');
    const otherList = document.getElementById('trade-other-props');
    if (myList) myList.innerHTML = renderList(myProps);
    if (otherList) otherList.innerHTML = renderList(otherProps);

    const giveCash = document.getElementById('trade-give-cash'); if (giveCash) giveCash.value = 0;
    const wantCash = document.getElementById('trade-want-cash'); if (wantCash) wantCash.value = 0;

    const modal = document.getElementById('trade-modal');
    if (modal) modal.style.display = 'flex';

    if (isMultiplayer && myPlayerId === M_currPlayer) {
        syncUIStatus(true, "Menu Trade", "🔄");
    }
}
window.M_openTradeModal = M_openTradeModal;

function closeTrade() { 
    const m = document.getElementById('trade-modal'); 
    if (m) m.style.display = 'none'; 
    if (isMultiplayer && myPlayerId === M_currPlayer) {
        syncUIStatus(false, "Menu Trade", "🔄");
    }
}
window.closeTrade = closeTrade;

let M_pendingTrade = null;

function M_submitTradeOffer() {
    let fromId = M_currPlayer; 
    let toId = M_currPlayer === 0 ? 1 : 0;
    let giveProps = Array.from(document.querySelectorAll('.trade-check-mine:checked')).map(c => parseInt(c.value));
    let wantProps = Array.from(document.querySelectorAll('.trade-check-theirs:checked')).map(c => parseInt(c.value));
    let giveCash = parseInt(document.getElementById('trade-give-cash').value) || 0;
    let wantCash = parseInt(document.getElementById('trade-want-cash').value) || 0;

    if (giveProps.length === 0 && wantProps.length === 0 && giveCash === 0 && wantCash === 0) {
        HAP('error'); 
        showCpuToast("Pilih minimal 1 properti atau KS dulu!"); 
        return;
    }
    if (giveCash > M_players[fromId].money) { 
        HAP('error'); 
        showCpuToast("KS yang kamu tawarin lebih dari uangmu!"); 
        return; 
    }

    M_pendingTrade = { fromId, toId, giveProps, wantProps, giveCash, wantCash };
    closeTrade();

    let giveText = (giveProps.map(id => boardData[id].name.replace(/<br>/g,' ') + (boardData[id].mortgaged ? ' 🔒' : '')).concat(giveCash > 0 ? [`${giveCash} KS`] : [])).join(', ') || '-';
    let wantText = (wantProps.map(id => boardData[id].name.replace(/<br>/g,' ') + (boardData[id].mortgaged ? ' 🔒' : '')).concat(wantCash > 0 ? [`${wantCash} KS`] : [])).join(', ') || '-';

    if (isMultiplayer) {
        sendPeerData({
            type: 'SYNC_TRADE_OFFER',
            tradeData: M_pendingTrade,
            giveText: giveText,
            wantText: wantText
        });
        showModal("🔄", "Menunggu Respon Trade", 
            `Tawaran trade telah dikirim ke <b>${M_players[toId].name}</b>.<br><br><i>Menunggu konfirmasi... ⏳</i>`, 
            `<button class="btn-action btn-pass" onclick="M_rejectTrade()">Batal Trade</button>`
        );
    } else {
        showModal("🔄", "Tawaran Trade!", 
            `<b>${M_players[fromId].name}</b> menawarkan trade ke <b>${M_players[toId].name}</b>:<br><br>` +
            `<div style="background:#eaf7ec; padding:8px; border-radius:10px; margin-bottom:6px; font-size:11.5px;"><b>Dikasih:</b> ${giveText}</div>` +
            `<div style="background:#fdecee; padding:8px; border-radius:10px; font-size:11.5px;"><b>Diminta:</b> ${wantText}</div>` +
            `<div style="font-size:10px; color:#9a8a90; margin-top:8px;">Serahkan HP ke ${M_players[toId].name} buat konfirmasi 👇</div>`,
            `<button class="btn-action btn-buy" onclick="M_acceptTrade()">Setuju ✅</button><button class="btn-action btn-pay" onclick="M_rejectTrade()">Tolak ❌</button>`
        );
    }
}
window.M_submitTradeOffer = M_submitTradeOffer;

function receiveTradeOffer(data) {
    M_pendingTrade = data.tradeData;
    let fromPlayer = M_players[M_pendingTrade.fromId];
    
    showModal("🔄", "Tawaran Trade Masuk!", 
        `<b>${fromPlayer.name}</b> menawarkan trade kepadamu:<br><br>` +
        `<div style="background:#eaf7ec; padding:8px; border-radius:10px; margin-bottom:6px; font-size:11.5px;"><b>Kamu Akan Dapat:</b> ${data.giveText}</div>` +
        `<div style="background:#fdecee; padding:8px; border-radius:10px; font-size:11.5px;"><b>Kamu Harus Beri:</b> ${data.wantText}</div>`,
        `<button class="btn-action btn-buy" onclick="M_acceptTrade()">Setuju ✅</button><button class="btn-action btn-pay" onclick="M_rejectTrade()">Tolak ❌</button>`
    );
}

function M_acceptTrade() {
    if (!M_pendingTrade) { closeModal(); return; }
    let { fromId, toId, giveProps, wantProps, giveCash, wantCash } = M_pendingTrade;
    let pFrom = M_players[fromId]; let pTo = M_players[toId];

    if (pFrom.money < giveCash || pTo.money < wantCash) {
        HAP('error'); showCpuToast("Trade batal, uang gak cukup lagi!"); M_pendingTrade = null; closeModal(); return;
    }

    giveProps.forEach(id => { if (boardData[id].owner === fromId) boardData[id].owner = toId; });
    wantProps.forEach(id => { if (boardData[id].owner === toId) boardData[id].owner = fromId; });
    pFrom.money -= giveCash; pTo.money += giveCash;
    pTo.money -= wantCash; pFrom.money += wantCash;

    giveProps.concat(wantProps).forEach(id => M_updateMarker(id));
    M_updateStats(); M_refreshRentUI(); saveMonopolyState();
    syncGameStateM();
    HAP('win'); spawnVFX(window.innerWidth/2, window.innerHeight/2, 'heart', 40);
    showCpuToast("🔄 Trade berhasil!");
    M_pendingTrade = null; closeModal();
}
window.M_acceptTrade = M_acceptTrade;

function M_rejectTrade() { 
    if (isMultiplayer && conn && conn.open) {
        sendPeerData({ type: 'SYNC_TRADE_REJECT' });
    }
    M_pendingTrade = null; 
    HAP('error'); 
    showCpuToast("Trade ditolak."); 
    closeModal(); 
}
window.M_rejectTrade = M_rejectTrade;

// ==========================================
// TOKO SUVENIR SYSTEM (PERBAIKAN BUG #3 & BUG #4)
// ==========================================

window.M_openShop = function(isRefresh = false) {
    let p = M_players[M_currPlayer];
    const shopPName = document.getElementById('shop-player-name');
    const shopPMoney = document.getElementById('shop-money');
    const shopContainer = document.getElementById('shop-items-container');
    const shopModal = document.getElementById('shop-modal');

    if (shopPName) shopPName.innerText = p.name;
    if (shopPMoney) shopPMoney.innerText = p.money + " KS";
    
    let shopHtml = '';
    shopKatalog.forEach(item => {
        let qty = p.items[item.id] || 0;
        let btnHtml = `<button class="shop-btn-buy" onclick="M_buyItem('${item.id}', ${item.price})">Beli ${item.price}</button>`;
        
        if (item.id === 'kopi' && qty > 0) {
            btnHtml = `<button class="shop-btn-use" onclick="M_useKopi()">Minum (${qty})</button>`;
        } else if (item.id === 'cokelat' && qty > 0) {
            btnHtml = `<button class="shop-btn-use" onclick="M_useCokelat()">Makan (${qty})</button>`;
        } else if (item.id === 'tiket' && qty > 0) {
            btnHtml = `<button class="shop-btn-use" onclick="M_useTiket()">Pakai (${qty})</button>`;
        } else if (item.id === 'surat' && qty > 0) {
            btnHtml = `<button class="shop-btn-use" onclick="M_useSurat()">Kirim (${qty})</button>`;
        }

        shopHtml += `
        <div class="shop-item">
            <div class="shop-item-info">
                <span class="shop-item-title">${item.name} ${qty > 0 ? `<span style="color:#10b981;">[${qty}]</span>` : ''}</span>
                <span class="shop-item-desc">${item.desc}</span>
            </div>
            <div>${btnHtml}</div>
        </div>`;
    });

    if (shopContainer) shopContainer.innerHTML = shopHtml;
    if (!isRefresh && shopModal) {
        shopModal.style.display = 'flex';
        if (isMultiplayer && myPlayerId === M_currPlayer) {
            syncUIStatus(true, "Toko Suvenir", "🛍️");
        }
    }
}

window.closeShop = function() { 
    closeModal(); 
    window.M_isShopBuying = false;
    const shopModal = document.getElementById('shop-modal');
    if (shopModal) shopModal.style.display = 'none'; 
    if (isMultiplayer && myPlayerId === M_currPlayer) {
        syncUIStatus(false, "Toko Suvenir", "🛍️");
    }
}

window.M_buyItem = function(id, price) {
    if (window.M_isShopBuying) return;

    if (isMultiplayer && myPlayerId !== M_currPlayer) {
        showCpuToast("Bukan giliranmu untuk membeli!");
        return;
    }

    let p = M_players[M_currPlayer];
    if (p.money < price) { HAP('error'); showCpuToast("Uangmu tidak cukup!"); return; }
    
    let randomChallenge = shopChallenges[Math.floor(Math.random() * shopChallenges.length)];
    closeShop(); 

    window.M_isShopBuying = true;

    showModal("💖", "Tantangan Toko Suvenir!", 
        `Sebelum membeli item ini, lakukan aksi nyata bersama pasanganmu:<br><br>` +
        `<div style="background:#ffe6ea; padding:12px; border-radius:12px; border:2px solid var(--primary); font-size:13px; font-weight:700; color:var(--primary-dark);">"${randomChallenge}"</div>`,
        `<button class="btn-action btn-buy" onclick="M_confirmBuyItem('${id}', ${price})">Sudah Dilakukan! Lanjut Beli ✨</button>` +
        `<button class="btn-action btn-pass" onclick="closeModal(); window.M_isShopBuying=false; M_openShop();">Batal</button>`
    );
};

window.M_confirmBuyItem = function(id, price) {
    let p = M_players[M_currPlayer];
    if (isMultiplayer && myPlayerId !== M_currPlayer) {
        window.M_isShopBuying = false;
        showCpuToast("Bukan giliranmu untuk membeli!");
        return;
    }

    if (p.money >= price) {
        p.money -= price;
        p.items[id] = (p.items[id] || 0) + 1;
        M_matchStats[p.id].challenges++;

        M_updateStats();
        spawnVFX(window.innerWidth/2, window.innerHeight/2, 'heart', 40);
        HAP('win');
        closeModal();
        showCpuToast("Item berhasil dibeli & tantangan selesai! 🛍️");
        
        saveMonopolyState();
        syncGameStateM();
        
        window.M_isShopBuying = false;
        M_openShop(); 
    } else {
        closeModal();
        window.M_isShopBuying = false;
        showCpuToast("Uangmu tidak cukup!");
    }
}

window.M_useKopi = function() {
    let p = M_players[M_currPlayer];
    if (isMultiplayer && myPlayerId !== M_currPlayer) return;
    if ((p.items.kopi || 0) <= 0) return;

    p.items.kopi--;
    p.activeCoffeeCount = (p.activeCoffeeCount || 0) + 1;
    
    closeShop();
    spawnVFX(window.innerWidth/2, window.innerHeight/2, 'heart', 20);
    HAP('win');
    showCpuToast(`☕ Kopi diminum! Total bonus: +${p.activeCoffeeCount * 2} langkah.`);
    
    saveMonopolyState();
    syncGameStateM();
}

window.M_useCokelat = function() {
    let p = M_players[M_currPlayer];
    if (isMultiplayer && myPlayerId !== M_currPlayer) return;
    if ((p.items.cokelat || 0) <= 0) return;

    p.items.cokelat--;
    if (p.debt > 0) {
        let cut = Math.min(500, p.debt);
        p.debt -= cut;
        showCpuToast(`🍫 Cokelat melunasi utang Bank sebesar ${cut} KS!`);
    } else {
        p.money += 300;
        showCpuToast(`🍫 Cokelat memberi semangat! +300 KS.`);
    }
    
    M_updateStats();
    closeShop();
    spawnVFX(window.innerWidth/2, window.innerHeight/2, 'coin', 20);
    HAP('win');
    
    saveMonopolyState();
    syncGameStateM();
}

// PERBAIKAN BUG #3: M_useTiket mem-broadcast animasi pergerakan remote 3 langkah ke HP lawan
window.M_useTiket = async function() {
    let p = M_players[M_currPlayer];
    
    if (isMultiplayer && myPlayerId !== M_currPlayer) return;
    if ((p.items.tiket || 0) <= 0 || window.M_isMoving) return;

    window.M_isMoving = true;
    M_updateRollButtonState();
    p.items.tiket--;
    
    closeShop();
    showCpuToast(`🎟️ Tiket Bioskop digunakan! Maju 3 langkah!`);
    spawnVFX(window.innerWidth/2, window.innerHeight/2, 'confetti', 25);
    HAP('win');

    M_lastRollSeq++;
    const currentSeq = M_lastRollSeq;

    if (isMultiplayer) {
        sendPeerData({ 
            type: 'SYNC_ROLL_M', 
            d1: 0, 
            d2: 0, 
            total: 3,
            doubleCount: 0,
            hasExtraTurn: false,
            seq: currentSeq
        });
    }

    saveMonopolyState();
    syncGameStateM();

    await M_animMove(p, 3);
};

window.M_useSurat = function() {
    let p = M_players[M_currPlayer];
    let opp = M_players[p.id === 0 ? 1 : 0];
    if (isMultiplayer && myPlayerId !== M_currPlayer) return;
    if ((p.items.surat || 0) <= 0) return;

    p.items.surat--;
    let stolen = Math.max(0, Math.min(300, opp.money));
    opp.money -= stolen;
    p.money += stolen;

    M_updateStats();
    closeShop();
    spawnVFX(window.innerWidth/2, window.innerHeight/2, 'coin', 25);
    HAP('win');
    showCpuToast(`💌 Surat Cinta mencuri ${stolen} KS dari lawan!`);

    saveMonopolyState();
    syncGameStateM();
}

// PERBAIKAN BUG #4: Menggunakan safeTimeout menggantikan setTimeout biasa
window.M_useBunga = function() {
    let p = M_players[M_currPlayer];
    if (isMultiplayer && myPlayerId !== M_currPlayer) return;
    if ((p.items.bunga || 0) <= 0 || window.M_isMoving) return;

    window.M_isMoving = true;
    M_updateRollButtonState();
    p.items.bunga--;
    closeModal();
    spawnVFX(window.innerWidth/2, window.innerHeight/2, 'heart', 30);
    HAP('win');

    showCpuToast("🌹 Kado Bunga diberikan! Bebas dari penjara!");
    saveMonopolyState();
    syncGameStateM();
    
    safeTimeout(() => { 
        window.M_isMoving = false; 
        M_updateRollButtonState();
        M_execRoll(false); 
    }, 500);
}

// PERBAIKAN BUG #4: Menggunakan safeTimeout menggantikan setTimeout biasa
window.M_usePayung = function() {
    let p = M_players[M_currPlayer];
    if (isMultiplayer && myPlayerId !== M_currPlayer) return;
    if ((p.items.payung || 0) <= 0) return;

    p.items.payung--;
    closeModal();
    spawnVFX(window.innerWidth/2, window.innerHeight/2, 'confetti', 30);
    HAP('win');

    showCpuToast("☂️ Payung Ajaib dipakai! Terbebas dari tagihan ini.");
    
    saveMonopolyState();
    syncGameStateM();
    
    M_checkBankrupt();
    if(window.M_isMoving) safeTimeout(M_endTurn, 800);
}

// PERBAIKAN BUG #4: Menggunakan safeTimeout menggantikan setTimeout biasa
window.M_useBantal = function() {
    let p = M_players[M_currPlayer];
    if (isMultiplayer && myPlayerId !== M_currPlayer) return;
    if ((p.items.bantal || 0) <= 0) return;

    p.items.bantal--;
    closeModal();
    spawnVFX(window.innerWidth/2, window.innerHeight/2, 'confetti', 30);
    HAP('win');

    showCpuToast("🛏️ Bantal Tidur dipakai! Kebal dari pajak.");
    
    saveMonopolyState();
    syncGameStateM();
    
    if(window.M_isMoving) safeTimeout(M_endTurn, 800);
}

function M_borrow() { 
    let p = M_players[M_currPlayer]; 
    let maxDebtLimit = activeArena.id === 'winter' ? 15000 : MAX_DEBT;
    if (p.debt + 1000 > maxDebtLimit) { HAP('error'); showCpuToast(`Limit ${maxDebtLimit} KS.`); return; } 
    p.money += 1000; p.debt += 1000; M_updateStats(); spawnVFX(window.innerWidth/2, window.innerHeight/2, 'coin', 20); M_openBank(); 
    saveMonopolyState();
    syncGameStateM();
}
window.M_borrow = M_borrow;

function M_repay() { 
    let p = M_players[M_currPlayer]; 
    if (p.debt <= 0) { HAP('error'); showCpuToast("Kamu tidak punya utang!"); return; } 
    let payAmount = Math.min(1000, p.debt);
    if (p.money < payAmount) { HAP('error'); showCpuToast("Uang tidak cukup!"); return; } 
    p.money -= payAmount; p.debt -= payAmount; M_updateStats(); spawnVFX(window.innerWidth/2, window.innerHeight/2, 'coin', 10); M_openBank(); 
    saveMonopolyState(); 
    syncGameStateM();
}
window.M_repay = M_repay;

function M_autoBailout(p) {
    if (p.money < 0) {
        let chunks = Math.ceil(Math.abs(p.money) / 1000) * 1000; 
        p.money += chunks; p.debt += chunks; M_updateStats();
        HAP('error');
        showModal("⚠️", "AUTO-BAILOUT!", `Bank meminjamkan paksa <b>${chunks} KS</b> karena uangmu minus!`, `<button class="btn-action btn-buy" onclick="closeModal()">Waduh...</button>`);
        M_checkBankrupt();
        syncGameStateM();
    }
}

// ==========================================
// M_rollDice & M_execRoll (AUTHORITATIVE ROLL)
// ==========================================
window.M_rollDice = function() {
    if (window.M_isMoving) return; 

    if (isMultiplayer && myPlayerId !== M_currPlayer) {
        showCpuToast("Tunggu sebentar, ini giliran pasanganmu! ⏳");
        return;
    }

    window.M_isMoving = true;
    M_updateRollButtonState();
    
    let p = M_players[M_currPlayer];

    if (p.inJail) { 
        window.M_isMoving = false;
        M_updateRollButtonState();

        let rIdx = Math.floor(Math.random() * jailBribes.length);
        let btns = `<button class="btn-action btn-pay" onclick="M_payBail()">Bayar 500 KS</button>` +
                   `<button class="btn-action btn-buy" onclick="M_execRoll(true)">Coba Double Dadu</button>` +
                   `<button class="btn-action btn-bank-act" onclick="M_bribe(${rIdx})">💖 Sogok Pakai Cinta</button>`;
        
        if (p.items.bunga > 0) {
            btns = `<button class="btn-action" style="background:linear-gradient(135deg, #ec4899, #be185d); color:white; font-weight:800; box-shadow: 0 4px 12px rgba(236,72,153,0.4); margin-bottom:8px;" onclick="M_useBunga()">Pakai Kado Bunga 🌹 (Sisa: ${p.items.bunga})</button>` + btns;
        }

        showModal("⛓️", "Terkurung!", `Sisa percobaan: <b>${p.jailTurns} kali</b>`, btns); 
        return; 
    }

    M_execRoll(false);
};

function M_bribe(idx) { 
    let b = jailBribes[idx]; closeModal(); 
    showModal("😘", b.title, `Hukuman Romantis:<br><b>${b.desc}</b>`, `<button class="btn-action btn-buy" onclick="M_finishBribe()">${b.action}</button><button class="btn-action btn-pay" onclick="M_rejectBribe()">Tolak (Hangus!) 😤</button>`); 
}
window.M_bribe = M_bribe;

function M_finishBribe() { 
    let p = M_players[M_currPlayer]; p.inJail = false; closeModal(); spawnVFX(window.innerWidth/2, window.innerHeight/2, 'heart', 30); HAP('win'); 
    safeTimeout(() => { showCpuToast("Sogokan Diterima! 😍"); M_execRoll(false); }, 500); 
}
window.M_finishBribe = M_finishBribe;

function M_rejectBribe() { HAP('error'); showCpuToast("Sogokan ditolak! Giliran hangus."); closeModal(); M_endTurn(); }
window.M_rejectBribe = M_rejectBribe;

function M_payBail() { 
    let p = M_players[M_currPlayer]; if (p.money < 500) { HAP('error'); showCpuToast("Uang ga cukup!"); return; } 
    p.money -= 500; M_updateStats(); p.inJail = false; spawnVFX(window.innerWidth/2, window.innerHeight/2, 'coin', 20); closeModal(); 
    syncGameStateM();
    M_execRoll(false); 
}
window.M_payBail = M_payBail;

async function M_execRoll(isJail) {
    if (isMultiplayer && myPlayerId !== M_currPlayer) {
        showCpuToast("Bukan giliranmu!");
        window.M_isMoving = false;
        M_updateRollButtonState();
        return;
    }

    closeModal();
    window.M_isMoving = true;
    M_updateRollButtonState();

    const token = gameSessionToken;
    playDiceSound();
    
    let d1 = Math.floor(Math.random() * 6) + 1; 
    let d2 = Math.floor(Math.random() * 6) + 1; 
    let total = d1 + d2;
    let pCurr = M_players[M_currPlayer];

    if (pCurr.items.jam > 0 && total <= 4 && !isJail) {
        pCurr.items.jam--;
        showCpuToast(`⌚ Jam Tangan aktif! Mengocok ulang dadu...`);
        playDiceSound();
        d1 = Math.floor(Math.random() * 6) + 1; 
        d2 = Math.floor(Math.random() * 6) + 1; 
        total = d1 + d2;
    }

    if (pCurr.activeCoffeeCount > 0) {
        let bonusSteps = pCurr.activeCoffeeCount * 2;
        total += bonusSteps;
        showCpuToast(`☕ Kopi Aktif: +${bonusSteps} Langkah!`);
        pCurr.activeCoffeeCount = 0; 
    }

    if (activeArena.id === 'rooftop' && d1 === d2) {
        pCurr.money += 300;
        showCpuToast("🌃 Buff Rooftop: Bonus +300 KS dari dadu kembar!");
    }

    if (d1 === d2 && !isJail) {
        M_doubleCount++;
        let jailLimit = activeArena.id === 'rooftop' ? 4 : 3;
        if (M_doubleCount === jailLimit) {
            M_diceRot[0] = calcSpin(M_diceRot[0], d1); 
            M_diceRot[1] = calcSpin(M_diceRot[1], d2);
            let d1El = document.getElementById('m-dice1'); 
            let d2El = document.getElementById('m-dice2');
            if(d1El) d1El.style.transform = `rotateX(${M_diceRot[0].x}deg) rotateY(${M_diceRot[0].y}deg)`; 
            if(d2El) d2El.style.transform = `rotateX(${M_diceRot[1].x}deg) rotateY(${M_diceRot[1].y}deg)`;
            
            M_goToJail();
            return;
        }
        M_hasExtraTurn = true;
    } else { 
        M_doubleCount = 0; 
        M_hasExtraTurn = false; 
    }

    M_lastRollSeq++;
    const currentSeq = M_lastRollSeq;

    if (isMultiplayer) {
        sendPeerData({ 
            type: 'SYNC_ROLL_M', 
            d1: d1, 
            d2: d2, 
            total: total,
            doubleCount: M_doubleCount,
            hasExtraTurn: M_hasExtraTurn,
            seq: currentSeq
        });
    }

    M_diceRot[0] = calcSpin(M_diceRot[0], d1); 
    M_diceRot[1] = calcSpin(M_diceRot[1], d2);
    let d1El = document.getElementById('m-dice1'); 
    let d2El = document.getElementById('m-dice2');
    if(d1El) d1El.style.transform = `rotateX(${M_diceRot[0].x}deg) rotateY(${M_diceRot[0].y}deg)`; 
    if(d2El) d2El.style.transform = `rotateX(${M_diceRot[1].x}deg) rotateY(${M_diceRot[1].y}deg)`;

    safeTimeout(async () => { 
        if (token !== gameSessionToken) {
            window.M_isMoving = false;
            M_updateRollButtonState();
            return;
        }
        try {
            if (isJail) {
                if (d1 === d2) { 
                    showCpuToast(`Dadu Kembar! Bebas!`); 
                    pCurr.inJail = false; 
                    M_hasExtraTurn = false; 
                    await M_animMove(pCurr, total); 
                } else {
                    pCurr.jailTurns--;
                    if (pCurr.jailTurns > 0) { 
                        showCpuToast(`Gagal! Sisa: ${pCurr.jailTurns}`); 
                        M_endTurn(); 
                    } else { 
                        let jailFine = activeArena.id === 'beach' ? Math.floor(500 * 1.15) : 500;
                        showCpuToast(`Gagal! Denda ${jailFine} KS.`); 
                        pCurr.money -= jailFine; 
                        M_autoBailout(pCurr); 
                        pCurr.inJail = false; 
                        M_updateStats(); 
                        await M_animMove(pCurr, total); 
                    }
                }
            } else { 
                await M_animMove(pCurr, total); 
            }
        } catch (err) {
            console.error("M_execRoll Error:", err);
            window.M_isMoving = false;
            M_updateRollButtonState();
        }
    }, 1300);
}
window.M_execRoll = M_execRoll;

async function M_animMove(player, steps) {
    const token = gameSessionToken;
    let el = document.getElementById('m-player-' + (player.id + 1));
    for(let i=0; i<steps; i++) {
        if (token !== gameSessionToken) {
            if (el) el.classList.remove('moving');
            return;
        }
        player.pos++;
        if (player.pos >= boardData.length) {
            player.pos = 0; 
            let baseGaji = (M_globalEco === 1.5) ? 1500 : (M_globalEco === 0.5 ? 500 : 1000);
            if(activeArena.id === 'beach') baseGaji *= 1.2;
            if(activeArena.id === 'library') baseGaji *= 0.9; 
            let gaji = Math.floor(baseGaji);

            if (player.items.parfum > 0) {
                gaji += 400;
                showCpuToast("🌸 Parfum Romantis: Bonus +400 KS di START!");
            }

            if (player.debt > 0) { 
                let interestRate = activeArena.id === 'winter' ? 0.15 : (activeArena.id === 'museum' ? 0.05 : 0.10); 
                let interest = Math.floor(player.debt * interestRate); player.debt += interest; 
                let debet = Math.min(500, player.debt); player.debt -= debet; gaji -= debet; 
                showCpuToast(`🚨 Lewat START. Auto debet utang ${debet} KS!`);
            }
            player.money += gaji; M_updateStats(); spawnVFX(window.innerWidth/2, window.innerHeight/2, 'coin', 15);
        }
        if(el) el.classList.add('moving'); M_updatePositions(); playStepSound(); await sleep(220); 
        if (token !== gameSessionToken) {
            if (el) el.classList.remove('moving');
            return;
        }
        if(el) el.classList.remove('moving'); M_updatePositions(); await sleep(50); 
    }
    if (token !== gameSessionToken) {
        if (el) el.classList.remove('moving');
        return;
    }
    safeTimeout(() => M_resolve(player), 300);
}

async function M_animMoveBack(player, steps) {
    const token = gameSessionToken;
    let el = document.getElementById('m-player-' + (player.id + 1));
    for(let i=0; i<steps; i++) {
        if (token !== gameSessionToken) {
            if (el) el.classList.remove('moving');
            return;
        }
        player.pos--; if (player.pos < 0) player.pos = boardData.length - 1;
        if(el) el.classList.add('moving'); M_updatePositions(); playStepSound(); await sleep(220); 
        if (token !== gameSessionToken) {
            if (el) el.classList.remove('moving');
            return;
        }
        if(el) el.classList.remove('moving'); M_updatePositions(); await sleep(50); 
    }
    if (token !== gameSessionToken) {
        if (el) el.classList.remove('moving');
        return;
    }
    safeTimeout(() => M_resolve(player), 300);
}

// ===== PERBAIKAN BUG #1 (CRITICAL) =====
function M_resolve(player) {
    let space = boardData[player.pos];

    if (isMultiplayer && myPlayerId !== player.id) {
        showCpuToast(`${player.name} mendarat di ${space.name.replace(/<br>/g, ' ')}...`);
        window.M_isMoving = false;
        M_updateRollButtonState();
        return;
    }

    if (space.type === "property" || space.type === "transport" || space.type === "utility") {
        let rRent = M_calcRent(space); 
        let rPrice = Math.floor(space.price * M_globalEco);
        if(activeArena.id === 'cafe') rPrice = Math.floor(rPrice * 0.9);
        if(activeArena.id === 'carnival') rPrice = Math.floor(rPrice * 1.05);

        if (space.owner === undefined) {
            showModal(space.icon, `Beli Aset?`, `<b>${space.name}</b><br>Harga: ${rPrice} KS`, `<button class="btn-action btn-buy" onclick="M_buy(${player.pos}, ${rPrice})">Beli</button><button class="btn-action btn-bank-act" onclick="M_openBank()">Ke Bank Dulu</button><button class="btn-action btn-pass" onclick="M_endTurn()">Lewat</button>`);
        } else if (space.owner !== player.id) {
            if (space.mortgaged) {
                showModal("🔒", `Properti Digadai`, `<b>${space.name}</b> milik ${M_players[space.owner].name} lagi digadai ke Bank.<br>Kamu lewat gratis!`, `<button class="btn-action btn-buy" onclick="M_endTurn()">Lanjut</button>`);
                return;
            }
            let challengeText = RENT_CHALLENGES[Math.floor(Math.random() * RENT_CHALLENGES.length)];
            
            let btns = `<button class="btn-action btn-buy" onclick="M_payRent(${player.pos}, ${space.owner}, ${rRent})">Lakukan & Bayar Sewa ✅</button>` +
                       `<button class="btn-action btn-pay" onclick="M_rejectRent()">Tolak (Masuk Penjara!) 🚔</button>` +
                       `<button class="btn-action btn-bank-act" onclick="M_openBank()">Ke Bank Dulu</button>`;
            
            if (player.items.payung > 0) {
                btns = `<button class="btn-action" style="background:linear-gradient(135deg, #a855f7, #9333ea); color:white; font-weight:800; box-shadow: 0 4px 12px rgba(168,85,247,0.4); margin-bottom:8px;" onclick="M_usePayung()">Pakai Payung Ajaib ☂️ (Sisa: ${player.items.payung})</button>` + btns;
            }

            showModal("💖", `Bayar Sewa & Tantangan!`, `Milik ${M_players[space.owner].name}.<br>Sewa: <b>${rRent} KS</b><br><br><div style="background:#ffe6ea; padding:10px; border-radius:10px; border:1px solid var(--primary); font-size:12px;"><b style="color:var(--primary-dark);">Tantangan Pasangan:</b><br>"${challengeText}"</div>`, btns);
        } else {
            if (player.items.kamera > 0) {
                player.items.kamera--;
                player.money += 250;
                M_updateStats();
                showCpuToast("📸 Kamera Polaroid: Dapat cashback +250 KS!");
            }

            let cost = Math.floor(rPrice / 2);
            if (activeArena.id === 'library') cost = Math.floor(cost * 0.8);
            if (activeArena.id === 'castle') cost = Math.floor(cost * 1.2);

            if (space.level < 3 && space.type === "property" && !space.mortgaged) {
                showModal("🏗️", `Upgrade?`, `Lv.${space.level+1} Biaya: ${cost} KS`, `<button class="btn-action btn-buy" onclick="M_upg(${player.pos}, ${cost})">Upgrade</button><button class="btn-action btn-bank-act" onclick="M_openBank()">Ke Bank Dulu</button><button class="btn-action btn-pass" onclick="M_endTurn()">Biarkan</button>`);
            } else if (space.mortgaged) {
                showModal("🔒", `Properti Digadai`, `Properti ini sedang digadai, tebus dulu di Bank sebelum di-upgrade.`, `<button class="btn-action btn-bank-act" onclick="M_openBank()">Ke Bank</button><button class="btn-action btn-pass" onclick="M_endTurn()">Lanjut</button>`);
            } else { M_endTurn(); }
        }
    } 
    else if (space.type === "kesempatan" || space.type === "dana_umum") {
        let isKesempatan = space.type === "kesempatan"; let cardList = isKesempatan ? kesempatanCards : danaUmumCards;
        let rIndex = Math.floor(Math.random() * cardList.length);
        if (!isKesempatan && activeArena.id === 'sakura' && Math.random() < 0.5) {
            let smallPenaltyIdx = cardList.map((c, i) => i).filter(i => cardList[i].type === 'money' && cardList[i].value < 0 && cardList[i].value >= -300);
            if (smallPenaltyIdx.length) rIndex = smallPenaltyIdx[Math.floor(Math.random() * smallPenaltyIdx.length)];
        }
        let card = cardList[rIndex];
        showModal("💼", "Kartu", `<b>${card.text}</b>`, `<button class="btn-action btn-buy" onclick="M_execCard('${space.type}', ${rIndex})">OK</button>`);
    }
    else if (space.type === "free") { 
        showModal(space.icon, "Bebas Parkir 🚗", "Selamat! Kamu beristirahat sejenak.<br>Bebas Parkir tanpa biaya, silakan lanjut.", `<button class="btn-action btn-buy" onclick="M_endTurn()">Lanjut</button>`);
    }
    else if (space.type === "tax") { 
        let amt = space.amount; 
        if(typeof amt === 'string' && amt.includes('%')) { 
            amt = Math.floor(player.money * (parseInt(amt)/100)); if(amt<0) amt=0; 
        }
        if(activeArena.id === 'sakura') amt = Math.floor(amt * 0.75);
        if(activeArena.id === 'beach') amt = Math.floor(amt * 1.15); 

        let btns = `<button class="btn-action btn-pay" onclick="M_payTax(${amt})">Bayar Pajak (${amt} KS)</button>`;
        
        if (player.items.bantal > 0) {
            btns = `<button class="btn-action" style="background:linear-gradient(135deg, #3b82f6, #1d4ed8); color:white; font-weight:800; box-shadow: 0 4px 12px rgba(59,130,246,0.4); margin-bottom:8px;" onclick="M_useBantal()">Pakai Bantal Tidur 🛏️ (Sisa: ${player.items.bantal})</button>` + btns;
        }

        if (player.items.payung > 0) {
            btns = `<button class="btn-action" style="background:linear-gradient(135deg, #a855f7, #9333ea); color:white; font-weight:800; box-shadow: 0 4px 12px rgba(168,85,247,0.4); margin-bottom:8px;" onclick="M_usePayung()">Pakai Payung Ajaib ☂️ (Sisa: ${player.items.payung})</button>` + btns;
        }

        showModal(space.icon, `Pajak!`, `Harus bayar <b>${amt} KS</b>`, btns);
    }
    else if (space.type === "goto_jail") { 
        showModal(space.icon, `Terciduk! 🚨`, `Masuk Penjara Rindu!`, `<button class="btn-action btn-pay" onclick="M_goToJail()">Ya ampun...</button>`);
    }
    else { M_endTurn(); }
}

async function M_execCard(type, index) {
    closeModal(); 
    let p = M_players[M_currPlayer]; 
    
    if (isMultiplayer && myPlayerId !== p.id) return;

    let c = (type === 'kesempatan') ? kesempatanCards[index] : danaUmumCards[index];
    if (c.type==="money"){ 
        let val = c.value;
        if(activeArena.id === 'carnival' && type === 'kesempatan' && val > 0) val = Math.floor(val * 1.3);
        p.money+=val; M_updateStats(); M_autoBailout(p); if(val > 0) spawnVFX(window.innerWidth/2, window.innerHeight/2, 'coin', 30); 
    }
    else if (c.type==="payOther"){ let o = M_players[M_currPlayer===0?1:0]; p.money-=c.value; o.money+=c.value; M_updateStats(); M_autoBailout(p); spawnVFX(window.innerWidth/2, window.innerHeight/2, 'coin', 20); }
    else if (c.type==="move"){ 
        let s = c.target - p.pos; 
        if(s <= 0) s += boardData.length; 
        await M_animMove(p, s); 
        syncGameStateM();
        return; 
    }
    else if (c.type==="move_relative"){ 
        if(c.steps<0) await M_animMoveBack(p,Math.abs(c.steps)); else await M_animMove(p,c.steps); 
        syncGameStateM();
        return; 
    }
    else if (c.type==="jail"){ M_goToJail(); return; }
    
    M_checkBankrupt(); 
    syncGameStateM();
    if(window.M_isMoving) M_endTurn();
}

function M_buy(pos, prc) { 
    let p = M_players[M_currPlayer]; 
    let s = boardData[pos]; 
    if(p.money < prc) { HAP('error'); showCpuToast("Uang kurang"); return; } 
    
    p.money -= prc; 
    s.owner = p.id; 
    M_updateStats(); 
    M_updateMarker(pos); 
    M_refreshRentUI(); 
    closeModal(); 
    spawnVFX(window.innerWidth/2, window.innerHeight/2, 'confetti', 50); 
    HAP('win'); 

    syncGameStateM();
    safeTimeout(M_endTurn, 1000); 
}
window.M_buy = M_buy;

function M_upg(pos, cst) { 
    let p = M_players[M_currPlayer]; 
    let s = boardData[pos]; 
    if(p.money < cst) { HAP('error'); showCpuToast("Uang kurang"); return; } 
    
    p.money -= cst; 
    s.level += 1; 
    M_updateStats(); 
    M_updateMarker(pos); 
    M_refreshRentUI(); 
    closeModal(); 
    spawnVFX(window.innerWidth/2, window.innerHeight/2, 'confetti', 30); 
    HAP('win'); 

    syncGameStateM();
    safeTimeout(M_endTurn, 1000); 
}
window.M_upg = M_upg;

function M_payRent(p, o, a) { 
    M_players[M_currPlayer].money -= a; 
    M_players[o].money += a; 
    M_updateStats(); 
    M_autoBailout(M_players[M_currPlayer]); 
    closeModal(); 
    spawnVFX(window.innerWidth/2, window.innerHeight/2, 'heart', 40); 
    HAP('win'); 
    M_checkBankrupt(); 
    
    syncGameStateM();

    if(window.M_isMoving) safeTimeout(M_endTurn, 1000); 
}
window.M_payRent = M_payRent;

function M_rejectRent() { 
    closeModal(); HAP('error'); 
    showModal("🚔", "Terciduk!", "Kamu menolak tantangan & sewa! Diseret ke Penjara Rindu!", `<button class="btn-action btn-pay" onclick="M_goToJail()">Aduh...</button>`); 
}
window.M_rejectRent = M_rejectRent;

function M_payTax(a) { 
    M_players[M_currPlayer].money -= a; 
    M_updateStats(); 
    M_autoBailout(M_players[M_currPlayer]); 
    closeModal(); 
    M_checkBankrupt(); 
    
    syncGameStateM();

    if(window.M_isMoving) safeTimeout(M_endTurn, 0); 
}
window.M_payTax = M_payTax;

function M_goToJail() { 
    closeModal(); 
    const jailIndex = boardData.findIndex(s => s.type === 'jail');
    M_players[M_currPlayer].pos = jailIndex !== -1 ? jailIndex : 8; 
    
    M_players[M_currPlayer].inJail = true; 
    M_players[M_currPlayer].jailTurns = 3; 
    M_hasExtraTurn = false; 
    M_doubleCount = 0; 
    M_updatePositions(); 
    HAP('error'); 
    
    syncGameStateM();

    safeTimeout(M_endTurn, 800); 
}
window.M_goToJail = M_goToJail;

function M_resetGame() {
    invalidateGameSession();
    clearMonopolySave();
    M_players = [ 
        { id: 0, name: playerNames.p1, icon: "🤵", pos: 0, money: 800, debt: 0, inJail: false, jailTurns: 0, items: {bunga:0, kopi:0, payung:0, cokelat:0, tiket:0, parfum:0, kamera:0, bantal:0, surat:0, jam:0}, activeCoffeeCount: 0 }, 
        { id: 1, name: playerNames.p2, icon: "👰", pos: 0, money: 800, debt: 0, inJail: false, jailTurns: 0, items: {bunga:0, kopi:0, payung:0, cokelat:0, tiket:0, parfum:0, kamera:0, bantal:0, surat:0, jam:0}, activeCoffeeCount: 0 } 
    ];
    syncPlayerNames(playerNames.p1, playerNames.p2, false);

    M_matchStats = [{ challenges: 0, properties: 0 }, { challenges: 0, properties: 0 }];

    boardData.forEach(s => { 
        if(s.type === 'property' || s.type === 'transport' || s.type === 'utility') { 
            s.owner = undefined; 
            s.level = 1; 
            s.mortgaged = false;
        } 
    });
    M_currPlayer = 0; window.M_isMoving = false; window.M_isShopBuying = false; M_doubleCount = 0; M_hasExtraTurn = false; M_turnCounter = 0; M_lastRollSeq = 0;
    M_globalEco = 1.0; M_ecoState = "Normal ⚖️"; M_diceRot = [{x:0, y:0}, {x:0, y:0}];
    let eco = document.getElementById('economy-status'); if(eco) { eco.innerText = `Ekonomi: Normal ⚖️`; eco.style.background = "#4a4e69"; }
    M_refreshRentUI(); M_updateStatsImm(); M_updatePositions();
    let ind = document.getElementById('m-turn-indicator'); if(ind) { ind.innerText = `Giliran: ${M_players[0].name}`; ind.style.background = "linear-gradient(135deg, #ff4d6d, #c9184a)"; }
    M_updateRollButtonState();
    closeModal(); closeShop();
}
window.M_resetGame = M_resetGame;

function M_checkBankrupt() { 
    let maxDebtLimit = activeArena.id === 'winter' ? 15000 : MAX_DEBT;
    if (M_players[M_currPlayer].debt > maxDebtLimit) { 
        clearMonopolySave();
        let loser = M_players[M_currPlayer];
        let winner = M_players[M_currPlayer === 0 ? 1 : 0];
        
        M_matchStats[0].properties = boardData.filter(s => s.owner === 0).length;
        M_matchStats[1].properties = boardData.filter(s => s.owner === 1).length;

        let winStats = M_matchStats[winner.id];
        let loseStats = M_matchStats[loser.id];

        let title = winner.id === 0 ? "Sultan Paling Romantis 👑" : "Raja Keberuntungan Sejati ✨";
        if (winStats.challenges >= 3) title = "Pasangan Paling UwU & Kompak 💖";

        recordMatchResult('monopoly', winner.id, loser.id, `Dominasi ${winStats.properties} properti & ${winStats.challenges} misi toko di arena ${activeArena.name}.`);

        spawnVFX(window.innerWidth/2, window.innerHeight/2, 'confetti', 150); 
        HAP('win');

        M_lastMatchResult = {
            gameType: 'Monopoli Cinta', gameIcon: '🎩', arenaName: activeArena.name,
            dateStr: formatTanggalIndo(new Date()),
            winnerName: winner.name, loserName: loser.name,
            statLines: [
                `${winner.name}: ${winStats.properties} Properti • ${winStats.challenges} Tantangan Toko`,
                `${loser.name}: ${loseStats.properties} Properti • ${loseStats.challenges} Tantangan Toko`
            ],
            title: title
        };

        if (isMultiplayer) {
            if (myPlayerId === winner.id) {
                let optionsHtml = WINNER_PRIZE_OPTIONS.map(opt => 
                    `<button class="btn-action btn-buy" style="margin-bottom:6px; font-size:11.5px; text-align:left;" onclick="M_claimPrize('${opt}')">🎁 ${opt}</button>`
                ).join('');

                showModal("🏆", `REKAP KENCAN & KEMENANGAN!`, 
                    `<div style="font-size:15px; font-weight:900; color:var(--primary-dark); margin-bottom:8px;">${winner.name} MENANG! 🏆</div>` +
                    `<div style="font-size:12px; font-weight:800; color:#333; margin-bottom:8px;">Pilih 1 Hadiah Kemenanganmu:</div>` +
                    optionsHtml, 
                    `<button class="btn-action btn-buy" style="background:linear-gradient(135deg, #ffb703, #d4a373); margin-top:6px;" onclick="M_saveResultCard()">📸 Simpan Kartu Kenangan</button>`
                );
            } else {
                showModal("💖", `Kalah di Papan, Menang di Hati!`, 
                    `<div style="font-size:14px; font-weight:800; color:var(--primary-dark); margin-bottom:8px;">Gak apa-apa bangkrut, kamu tetap juara di hatinya!</div>` +
                    `<div style="background:#ffe6ea; padding:12px; border-radius:12px; border:2px solid #ff4d6d; font-size:12px; color:#c9184a; font-weight:700;">` +
                    `⏳ Menunggu ${winner.name} memilih hadiah kemenangannya...` +
                    `</div>`,
                    `<button class="btn-action btn-buy" style="background:linear-gradient(135deg, #ffb703, #d4a373);" onclick="M_saveResultCard()">📸 Simpan Kartu Kenangan</button>`
                );
            }
        } else {
            showModal("📊", `REKAP KENCAN & KEMENANGAN!`, `
                <div style="font-size:16px; font-weight:900; color:var(--primary-dark); margin-bottom:8px;">${winner.name} MENANG! 🏆</div>
                <div style="background:#ffe6ea; padding:12px; border-radius:14px; border:2px solid var(--primary); text-align:left; font-size:11.5px; line-height:1.6; margin-bottom:10px;">
                    <b>📈 Statistik Kencan Kalian:</b><br>
                    • <b>${winner.name}</b>: ${winStats.properties} Properti | ${winStats.challenges} Tantangan Toko<br>
                    • <b>${loser.name}</b>: ${loseStats.properties} Properti | ${loseStats.challenges} Tantangan Toko<br>
                    <hr style="border:0; border-top:1px dashed #ffb3c6; margin:6px 0;">
                    <b>✨ Gelar Akhir:</b> <span style="color:#d90429; font-weight:800;">${title}</span><br>
                    <b>💡 Hukuman Kalah:</b> ${M_BANKRUPT[Math.floor(Math.random() * M_BANKRUPT.length)]}
                </div>
            `, `<button class="btn-action btn-buy" style="background:linear-gradient(135deg, #ffb703, #d4a373); margin-bottom:8px;" onclick="M_saveResultCard()">📸 Simpan Kartu Kenangan</button><button class="btn-action btn-buy" onclick="M_resetGame(); backToMenu();">Kembali ke Menu</button>`); 
        }

        window.M_isMoving = true; 
    } 
}

function M_endTurn(fromRemote = false) {
    let maxDebtLimit = activeArena.id === 'winter' ? 15000 : MAX_DEBT;
    if (M_players[M_currPlayer].debt > maxDebtLimit) return; 
    closeModal();
    
    M_doubleCount = 0;
    
    if (M_hasExtraTurn) { 
        M_hasExtraTurn = false; 
        showCpuToast("Double Dadu! Jalan lagi!"); 
        window.M_isMoving = false; 
        M_updateRollButtonState();
        saveMonopolyState();
        if (isMultiplayer && !fromRemote) {
            syncGameStateM();
        }
        return; 
    }
    
    if (!fromRemote) {
        M_currPlayer = M_currPlayer === 0 ? 1 : 0; 
        M_turnCounter++;
        
        let ecoShiftChance = activeArena.id === 'cosmos' ? 0.35 : 0.20; 
        if (Math.random() < ecoShiftChance) {
            M_shiftEco();
        }
    }
    
    saveMonopolyState();
    
    let ind = document.getElementById('m-turn-indicator');
    if (ind) { 
        let playerName = M_currPlayer === 0 ? M_players[0].name : M_players[1].name;
        ind.innerText = `Giliran: ${playerName}`; 
        ind.style.background = M_currPlayer === 0 ? "linear-gradient(135deg, #ff4d6d, #c9184a)" : "linear-gradient(135deg, #3a86ff, #001f54)"; 
    }
    
    window.M_isMoving = false;
    M_updateRollButtonState();

    if (isMultiplayer && !fromRemote) {
        syncGameStateM();
        sendPeerData({ 
            type: 'SYNC_END_TURN', 
            nextPlayer: M_currPlayer, 
            turnCounter: M_turnCounter 
        });
    }
}
window.M_endTurn = M_endTurn;

loadStats();

// ==========================================
// EXPOSE FUNCTIONS TO GLOBAL WINDOW
// ==========================================
window.openPlayModal = openPlayModal;
window.closePlayModal = closePlayModal;
window.openOptionsModal = openOptionsModal;
window.closeOptionsModal = closeOptionsModal;
window.openGuideModal = openGuideModal;
window.closeGuideModal = closeGuideModal;
window.switchGuideTab = switchGuideTab;
window.promptModeSetup = promptModeSetup;
window.openNameConfigModal = openNameConfigModal;
window.saveCustomNames = saveCustomNames;
window.enterGameSession = enterGameSession;
window.backToMenu = backToMenu;
window.M_rollDice = M_rollDice;
window.SL_rollDice = SL_rollDice;
window.M_openBank = M_openBank;
window.closeBank = closeBank;
window.M_borrow = M_borrow;
window.M_repay = M_repay;
window.M_openShop = M_openShop;
window.closeShop = closeShop;
window.M_openGadaiModal = M_openGadaiModal;
window.closeGadai = closeGadai;
window.M_doGadai = M_doGadai;
window.M_tebusGadai = M_tebusGadai;
window.M_openTradeModal = M_openTradeModal;
window.closeTrade = closeTrade;
window.M_submitTradeOffer = M_submitTradeOffer;
window.M_acceptTrade = M_acceptTrade;
window.M_rejectTrade = M_rejectTrade;
window.showActiveArenaInfo = showActiveArenaInfo;
window.showActiveSLArenaInfo = showActiveSLArenaInfo;
window.startRoulette = startRoulette;
window.openCustomBgModal = openCustomBgModal;
window.resetCurrentArenaBg = resetCurrentArenaBg;
window.openMusicModal = openMusicModal;
window.closeMusicModal = closeMusicModal;
window.togglePlayMusic = togglePlayMusic;
window.stopMusic = stopMusic;
window.M_execCard = M_execCard;


// ==========================================
// LOGIKA UTAMA LOBBY & PEERJS
// ==========================================
window.promptMultiplayerChoice = function(gameMode) {
    selectedGameMode = gameMode;
    showModal("🎮", "Pilih Mode Bermain", "Mau main di 1 HP (gantian) atau 2 HP masing-masing?", 
        `<button class="btn-action btn-buy" onclick="closeModal(); startSinglePlayer();">📱 1 HP (Lokal Gantian)</button>
         <button class="btn-action btn-pay" onclick="closeModal(); openLobbySelection();">📱📱 2 HP (Koneksi Hotspot)</button>
         <button class="btn-action btn-pass" onclick="closeModal()">Batal</button>`
    );
};

function startSinglePlayer() {
    isMultiplayer = false;
    promptModeSetup(selectedGameMode);
}
window.startSinglePlayer = startSinglePlayer;

function openLobbySelection() {
    showModal("🌐", "Pilih Peran 2 HP", "Siapa yang membuat Room?",
        `<button class="btn-action btn-buy" onclick="closeModal(); initHostRoom();">👑 Buat Room Baru (Host)</button>
         <button class="btn-action btn-pay" onclick="closeModal(); initJoinRoom();">🔗 Masuk Room Pasangan</button>
         <button class="btn-action btn-pass" onclick="closeModal()">Batal</button>`
    );
}
window.openLobbySelection = openLobbySelection;

window.initHostRoom = function() {
    if (typeof Peer === 'undefined') {
        showCpuToast("Gagal memuat PeerJS. Cek koneksi internet!");
        return;
    }
    isMultiplayer = true;
    myPlayerId = 0;
    const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    document.getElementById('lobby-host-sec').style.display = 'block';
    document.getElementById('lobby-join-sec').style.display = 'none';
    document.getElementById('room-code-display').innerText = randomCode;
    document.getElementById('lobby-modal').style.display = 'flex';

    try {
        peer = new Peer('arcade-cinta-' + randomCode);
        peer.on('connection', (c) => {
            conn = c;
            setupConnection();
            document.getElementById('lobby-modal').style.display = 'none';
            showCpuToast("Pasangan terhubung! Memulai permainan... 🎉");
            promptModeSetup(selectedGameMode);
        });
    } catch (e) {
        showCpuToast("Gagal membuat room. Coba lagi!");
    }
};

window.initJoinRoom = function() {
    if (typeof Peer === 'undefined') {
        showCpuToast("Gagal memuat PeerJS. Cek koneksi internet!");
        return;
    }
    isMultiplayer = true;
    myPlayerId = 1;
    document.getElementById('lobby-host-sec').style.display = 'none';
    document.getElementById('lobby-join-sec').style.display = 'block';
    document.getElementById('lobby-modal').style.display = 'flex';
};

window.joinMultiplayerRoom = function() {
    const code = document.getElementById('input-room-code').value.trim();
    if (!code || code.length !== 4) {
        showCpuToast("Masukkan 4 digit kode yang benar!");
        return;
    }

    try {
        peer = new Peer();
        peer.on('open', () => {
            conn = peer.connect('arcade-cinta-' + code);
            setupConnection();
            conn.on('open', () => {
                document.getElementById('lobby-modal').style.display = 'none';
                showCpuToast("Berhasil tersambung ke HP pasangan! 🚀");
                promptModeSetup(selectedGameMode);
            });
        });
    } catch (e) {
        showCpuToast("Gagal terhubung ke room!");
    }
};

// ==========================================
// PUSAT PENERIMA DATA ANTAR HP (ULTIMATE SYNC ENGINE)
// ==========================================
function setupConnection() {
    conn.on('data', (data) => {
        if (data.type === 'SYNC_ARENA') {
            const arenaObj = arenas.find(a => a.id === data.arenaId);
            if (arenaObj) {
                activeArena = arenaObj;
                applyArenaVisualTheme();

                const rIcon = document.getElementById('roulette-icon');
                const rName = document.getElementById('roulette-name');
                const rDesc = document.getElementById('roulette-desc');
                if (rIcon) rIcon.innerText = activeArena.icon;
                if (rName) rName.innerText = activeArena.name;
                if (rDesc) rDesc.innerText = "Mood Kencan Terpilih!";

                stopRouletteTimer();
                activeRouletteTimeout = setTimeout(() => {
                    activeRouletteTimeout = null;
                    showArenaInfoPreview();
                }, 1200);
            }
        } else if (data.type === 'SYNC_ROLL_M') {
            executeRemoteMonopolyRoll(data.d1, data.d2, data.total, data.doubleCount, data.hasExtraTurn, data.seq);
        } else if (data.type === 'SYNC_ROLL_SL') {
            executeRemoteSLRoll(data.roll);
        } else if (data.type === 'SYNC_FULL_STATE_M') {
            applyFullStateM(data);
        } else if (data.type === 'SYNC_FULL_STATE_SL') {
            applyFullStateSL(data);
        } else if (data.type === 'SYNC_END_TURN') {
            if (selectedGameMode === 'monopoly') {
                if (data.turnCounter !== undefined && data.turnCounter < M_turnCounter) return;
                if (data.nextPlayer !== undefined) M_currPlayer = data.nextPlayer;
                if (data.turnCounter !== undefined) M_turnCounter = data.turnCounter;
                M_endTurn(true);
            } else {
                SL_endTurn(true);
            }
        } else if (data.type === 'SYNC_UI_STATUS') {
            const pName = data.senderName || "Pasanganmu";
            if (data.isOpen) {
                showCpuToast(`${data.icon} ${pName} sedang membuka ${data.label}...`);
            }
        } else if (data.type === 'SYNC_WINNER_PRIZE') {
            handleWinnerPrizeReceived(data);
        } else if (data.type === 'SYNC_TRADE_OFFER') {
            receiveTradeOffer(data);
        } else if (data.type === 'SYNC_TRADE_REJECT') {
            showCpuToast("Tawaran trade kamu ditolak oleh pasangan.");
            closeModal();
        }
    });
}

function sendPeerData(data) {
    if (isMultiplayer && conn && conn.open) {
        conn.send(data);
    }
}

function syncUIStatus(isOpen, label, icon) {
    if (!isMultiplayer || !conn || !conn.open) return;
    const myName = M_players[myPlayerId] ? M_players[myPlayerId].name : "Pasanganmu";
    sendPeerData({
        type: 'SYNC_UI_STATUS',
        isOpen: isOpen,
        label: label,
        icon: icon,
        senderName: myName
    });
}

// ==========================================
// KONTROL HADIAH 1-ON-1 (KLAIM & SINKRONISASI TUGAS)
// ==========================================
window.M_claimPrize = function(prizeText) {
    closeModal();
    showModal("👑", "Hadiah Diklaim!",
        `Kamu memilih:<br><b style="color:#d90429; font-size:14px; display:block; margin:8px 0;">"${prizeText}"</b>` +
        `<div style="font-size:11.5px; color:#555; line-height:1.5; margin-top:10px;"><i>Sinyal tugas sudah dikirim ke HP pasanganmu! Minta dia melaksanakannya sekarang.<br>Jangan lupa kasih pelukan/usap kepala setelahnya ya! 🥰</i></div>`,
        `<button class="btn-action btn-buy" onclick="M_resetGame(); backToMenu();">Selesai & Kembali ke Menu</button>`
    );
    if (isMultiplayer) {
        sendPeerData({
            type: 'SYNC_WINNER_PRIZE',
            prizeText: prizeText,
            winnerName: M_players[myPlayerId].name
        });
    }
};

window.SL_claimPrize = function(prizeText) {
    closeModal();
    showModal("👑", "Hadiah Diklaim!",
        `Kamu memilih:<br><b style="color:#d90429; font-size:14px; display:block; margin:8px 0;">"${prizeText}"</b>` +
        `<div style="font-size:11.5px; color:#555; line-height:1.5; margin-top:10px;"><i>Sinyal tugas sudah dikirim ke HP pasanganmu! Minta dia melaksanakannya sekarang.<br>Jangan lupa kasih pelukan/usap kepala setelahnya ya! 🥰</i></div>`,
        `<button class="btn-action btn-buy" onclick="SL_resetGame(); backToMenu();">Selesai & Kembali ke Menu</button>`
    );
    if (isMultiplayer) {
        sendPeerData({
            type: 'SYNC_WINNER_PRIZE',
            prizeText: prizeText,
            winnerName: SL_players[myPlayerId].name
        });
    }
};

function handleWinnerPrizeReceived(data) {
    closeModal();
    HAP('win');
    spawnVFX(window.innerWidth/2, window.innerHeight/2, 'heart', 40);
    showModal("📜", "Tugas Kekalahan Romantis!",
        `<div style="font-size:13px; font-weight:800; color:var(--primary-dark); margin-bottom:8px;">Pemenang (${data.winnerName}) Memilih Hadiah:</div>` +
        `<div style="background:#ffe6ea; padding:12px; border-radius:12px; border:2px solid #ff4d6d; font-size:13px; font-weight:800; color:#d90429; margin-bottom:10px;">"${data.prizeText}"</div>` +
        `<div style="font-size:11.5px; color:#555; line-height:1.5;">👉 <b>Segera laksanakan tugas di atas sekarang!</b><br><i>(Eits tenang, setelah tugasmu selesai, kamu BERHAK minta 1 pelukan hangat & usapan kepala dari Pemenang! 🥰)</i></div>`,
        `<button class="btn-action btn-buy" onclick="closeModal(); if(selectedGameMode==='monopoly'){M_resetGame();}else{SL_resetGame();} backToMenu();">Siap Laksanakan! 💖</button>`
    );
}

// -------------------------------------------------------------------------
// SYNC MONOPOLI
// -------------------------------------------------------------------------
function syncGameStateM() {
    if (!isMultiplayer || !conn || !conn.open) return;
    const state = {
        type: 'SYNC_FULL_STATE_M',
        currPlayer: M_currPlayer,
        ecoState: M_ecoState,
        globalEco: M_globalEco,
        doubleCount: M_doubleCount,
        hasExtraTurn: M_hasExtraTurn,
        turnCounter: M_turnCounter,
        players: M_players.map(p => ({
            pos: p.pos, money: p.money, debt: p.debt, inJail: p.inJail, 
            jailTurns: p.jailTurns, items: p.items, activeCoffeeCount: p.activeCoffeeCount
        })),
        boardProps: boardData.map(s => ({
            owner: s.owner, level: s.level, mortgaged: s.mortgaged
        }))
    };
    conn.send(state);
}

function applyFullStateM(data) {
    if (data.turnCounter !== undefined && data.turnCounter < M_turnCounter) {
        return;
    }

    M_currPlayer = data.currPlayer;
    M_ecoState = data.ecoState;
    M_globalEco = data.globalEco;
    
    if (data.doubleCount !== undefined) M_doubleCount = data.doubleCount;
    if (data.hasExtraTurn !== undefined) M_hasExtraTurn = data.hasExtraTurn;
    if (data.turnCounter !== undefined) M_turnCounter = data.turnCounter;
    
    data.players.forEach((dp, i) => {
        let p = M_players[i];
        if (!window.M_isMoving) {
            p.pos = dp.pos;
        }
        p.money = dp.money; 
        p.debt = dp.debt;
        p.inJail = dp.inJail; 
        p.jailTurns = dp.jailTurns;
        p.items = dp.items; 
        p.activeCoffeeCount = dp.activeCoffeeCount;
    });
    
    data.boardProps.forEach((dp, i) => {
        if (boardData[i]) {
            boardData[i].owner = dp.owner;
            boardData[i].level = dp.level || 1;
            boardData[i].mortgaged = dp.mortgaged || false;
        }
    });

    M_updateStatsImm();
    M_refreshRentUI();
    
    let ecoUI = document.getElementById('economy-status');
    if (ecoUI) { ecoUI.innerText = `Ekonomi: ${M_ecoState}`; }
    
    let ind = document.getElementById('m-turn-indicator');
    if (ind) { 
        let playerName = M_currPlayer === 0 ? M_players[0].name : M_players[1].name;
        ind.innerText = `Giliran: ${playerName}`; 
        ind.style.background = M_currPlayer === 0 ? "linear-gradient(135deg, #ff4d6d, #c9184a)" : "linear-gradient(135deg, #3a86ff, #001f54)"; 
    }

    document.querySelectorAll('.owner-marker').forEach(e => e.remove());
    boardData.forEach((s, idx) => {
        if (s.owner !== undefined) M_updateMarker(idx);
    });
    
    if (!window.M_isMoving) {
        M_updatePositions();
    }

    M_updateRollButtonState();

    const shopModal = document.getElementById('shop-modal');
    if (shopModal && shopModal.style.display === 'flex') {
        M_openShop(true); 
    }
}

// -------------------------------------------------------------------------
// SYNC ULAR TANGGA
// -------------------------------------------------------------------------
function syncGameStateSL() {
    if (!isMultiplayer || !conn || !conn.open) return;
    const state = {
        type: 'SYNC_FULL_STATE_SL',
        currPlayer: SL_currPlayer,
        players: SL_players.map(p => ({ pos: p.pos }))
    };
    conn.send(state);
}

function applyFullStateSL(data) {
    data.players.forEach((dp, i) => {
        SL_players[i].pos = dp.pos;
    });
    
    let ind = document.getElementById('sl-turn-indicator');
    if (ind) {
        let playerName = SL_currPlayer === 0 ? SL_players[0].name : SL_players[1].name;
        ind.innerText = `Giliran: ${playerName}`; 
        ind.style.background = SL_currPlayer === 0 ? "linear-gradient(135deg, #ff4d6d, #c9184a)" : "linear-gradient(135deg, #3a86ff, #001f54)";
    }
    
    SL_updatePositions();
}

// -------------------------------------------------------------------------
// EXECUTE REMOTE ROLL HANDLERS (PERBAIKAN BUG #3)
// -------------------------------------------------------------------------
function executeRemoteMonopolyRoll(d1, d2, total, doubleCount, hasExtraTurn, seq) {
    if (seq !== undefined) {
        if (seq <= M_lastRollSeq) return;
        M_lastRollSeq = seq;
    }

    window.M_isMoving = true;
    M_updateRollButtonState();
    
    if (doubleCount !== undefined) M_doubleCount = doubleCount;
    if (hasExtraTurn !== undefined) M_hasExtraTurn = hasExtraTurn;

    const hasDiceRoll = (d1 > 0 && d2 > 0);

    if (hasDiceRoll) {
        M_diceRot[0] = calcSpin(M_diceRot[0], d1); 
        M_diceRot[1] = calcSpin(M_diceRot[1], d2);
        
        let d1El = document.getElementById('m-dice1'); 
        let d2El = document.getElementById('m-dice2');
        if (d1El) d1El.style.transform = `rotateX(${M_diceRot[0].x}deg) rotateY(${M_diceRot[0].y}deg)`; 
        if (d2El) d2El.style.transform = `rotateX(${M_diceRot[1].x}deg) rotateY(${M_diceRot[1].y}deg)`;
    }

    safeTimeout(async () => { 
        try {
            await M_animMove(M_players[M_currPlayer], total);
        } catch (err) {
            console.error("executeRemoteMonopolyRoll error:", err);
            window.M_isMoving = false;
            M_updateRollButtonState();
        }
    }, hasDiceRoll ? 1300 : 100);
}

function executeRemoteSLRoll(roll) {
    let rollBtn = document.getElementById('sl-btn-roll');
    if (rollBtn) rollBtn.disabled = true;
    
    SL_diceRot = calcSpinSL(SL_diceRot, ((roll - 1) % 6) + 1); 
    const slDice = document.getElementById('sl-dice');
    if (slDice) slDice.style.transform = `rotateX(${SL_diceRot.x}deg) rotateY(${SL_diceRot.y}deg)`;
    
    safeTimeout(async () => {
        await SL_animateMove(SL_players[SL_currPlayer], roll);
    }, 1300);
}

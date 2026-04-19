// board
let board;
let boardWidth = 360;
let boardHeight = 640;
let context;

// bird
let birdWidth = 34; // width/height ratio = 408/228 = 17/12
let birdHeight = 24;
let birdX = boardHeight / 8;
let birdY = boardHeight / 2;
let birdImg;
const birdImages = {};

let bird = {
    x: birdX,
    y: birdY,
    width: birdWidth,
    height: birdHeight,
};

// pipes
let pipeArray = [];
let pipeWidth = 64; // width/height ratio = 384/3072 = 1/8
let pipeHeight = 512;
let pipeX = boardWidth;
let pipeY = 0;

let topPipeImg;
let bottomPipeImg;
let coinArray = [];

// physics
let velocityX = -2; // speed of the pipes moving left
let velocityY = 0; // speed of the bird moving up and down
let gravity = 0.4; // gravity pulling the bird down

let gameOver = false;
let gameStarted = false;
let score = 0;
let runCoins = 0;
let totalCoins = Number(localStorage.getItem("flappy-total-coins") || 0);
let pipeTimer;

let startScreen;
let endScreen;
let finalScore;
let finalCoins;
let totalCoinsLabel;
let shopItems;
let mqttClient;
let currentUser = null;
let activePlayerName = "";
const playerProfiles = {};
const mutedUsers = new Set();
let accounts = loadAccounts();
const CHAT_TOPIC = "hhs/flappybird/global-chat-v1";
const ADMIN_TOPIC = "hhs/flappybird/admin-v1";
const PROFILE_TOPIC = "hhs/flappybird/profile-v1";
const ACCOUNT_TOPIC = "hhs/flappybird/account-v1";
const OWNER_USERNAME = "owner";
const OWNER_PASSWORD = "owner-keep-private";
const COIN_RADIUS = 10;
const SKIN_STORAGE_KEY = "flappy-selected-skin";
const OWNED_SKINS_KEY = "flappy-owned-skins";
const SKINS = [
    { id: "classic", name: "Classic", cost: 0, filter: "none", image: "./flappybird.png" },
    { id: "gold", name: "Golden", cost: 25, filter: "hue-rotate(25deg) saturate(170%) brightness(1.1)", image: "./flappybird.png" },
    { id: "neon", name: "Neon", cost: 60, filter: "hue-rotate(180deg) saturate(190%) brightness(1.05)", image: "./flappybird.png" },
    { id: "shadow", name: "Shadow", cost: 90, filter: "grayscale(1) contrast(1.3) brightness(0.85)", image: "./flappybird.png" },
    { id: "jeffy2", name: "Jeffy Bird 2", cost: 140, filter: "none", image: "./jeffy_bird_2.png" },
];
let selectedSkinId = localStorage.getItem(SKIN_STORAGE_KEY) || "classic";
let ownedSkinIds = loadOwnedSkins();
const CUSS_WORDS = [
    "ass",
    "asshole",
    "bastard",
    "bitch",
    "bullshit",
    "damn",
    "dick",
    "fuck",
    "fucker",
    "fucking",
    "shit",
];
const PROFANITY_PATTERNS = [
    /\bf+u+c+k+(?:e+r+|i+n+g+|e+d+|s+)?\b/gi,
    /\bs+h+i+t+(?:t+y+|s+)?\b/gi,
    /\bb+i+t+c+h+(?:e+s+|y+)?\b/gi,
    /\bd+a+m+n+\b/gi,
    /\ba+s+s+(?:h+o+l+e+)?\b/gi,
    /\bd+i+c+k+\b/gi,
    /\bb+a+s+t+a+r+d+\b/gi,
    /\bc+u+n+t+\b/gi,
    /\bn[\W_]*[i1!|l][\W_]*[g69][\W_]*[g69](?:[\W_]*[ea@4])(?:[\W_]*[r4])?\b/gi,
    /\br[\W_]*[e3][\W_]*t[\W_]*[a@4][\W_]*r[\W_]*d\b/gi,
    /\bf[\W_]*[a@4][\W_]*g[\W_]*g[\W_]*[o0][\W_]*t\b/gi,
];
const MAX_PROFANITY_MATCHES = 2;

window.onload = function () {
    board = document.getElementById("board");
    board.height = boardHeight;
    board.width = boardWidth;
    context = board.getContext("2d");

    startScreen = document.getElementById("start-screen");
    endScreen = document.getElementById("end-screen");
    finalScore = document.getElementById("final-score");
    finalCoins = document.getElementById("final-coins");
    totalCoinsLabel = document.getElementById("total-coins");
    shopItems = document.getElementById("shop-items");

    const startBtn = document.getElementById("start-btn");
    const restartBtn = document.getElementById("restart-btn");

    startBtn.addEventListener("click", startGame);
    restartBtn.addEventListener("click", restartGame);

    setupShop();
    ensureOwnerAccount();
    setupChatRoom();
    setupAdminPanel();
    preloadBirdImages();

    birdImg = birdImages[getCurrentSkin().image] || birdImages["./flappybird.png"];

    topPipeImg = new Image();
    topPipeImg.src = "./toppipe.png";
    bottomPipeImg = new Image();
    bottomPipeImg.src = "./bottompipe.png";

    requestAnimationFrame(update);
    document.addEventListener("keydown", moveBird);
    document.addEventListener("click", moveBird);
};

function startGame() {
    gameStarted = true;
    gameOver = false;
    startScreen.classList.remove("visible");
    endScreen.classList.remove("visible");

    if (pipeTimer) {
        clearInterval(pipeTimer);
    }
    pipeTimer = setInterval(placePipes, 1500);
}

function restartGame() {
    bird.y = birdY;
    velocityY = 0;
    pipeArray = [];
    coinArray = [];
    score = 0;
    runCoins = 0;
    startGame();
}

function update() {
    requestAnimationFrame(update);
    context.clearRect(0, 0, board.width, board.height);

    if (!gameStarted) {
        birdImg = getCurrentBirdImage();
        context.filter = getCurrentSkin().filter;
        context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);
        context.filter = "none";
        return;
    }

    if (gameOver) {
        return;
    }

    // draw the bird
    velocityY += gravity;
    bird.y = Math.max(bird.y + velocityY, 0);
    birdImg = getCurrentBirdImage();
    context.filter = getCurrentSkin().filter;
    context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);
    context.filter = "none";

    if (bird.y > board.height) {
        endGame();
    }

    // draw the pipes
    for (let i = 0; i < pipeArray.length; i++) {
        let pipe = pipeArray[i];
        pipe.x += velocityX;
        context.drawImage(pipe.img, pipe.x, pipe.y, pipe.width, pipe.height);

        if (!pipe.passed && bird.x > pipe.x + pipe.width) {
            score += 0.5;
            pipe.passed = true;
        }

        if (detectCollision(bird, pipe)) {
            endGame();
        }
    }

    // draw and collect coins
    for (let i = 0; i < coinArray.length; i++) {
        const coin = coinArray[i];
        coin.x += velocityX;
        drawCoin(coin);

        if (!coin.collected && detectCircleRectCollision(coin, bird)) {
            coin.collected = true;
            runCoins += 1;
            totalCoins += 1;
            if (activePlayerName) {
                if (!playerProfiles[activePlayerName]) {
                    playerProfiles[activePlayerName] = { coins: 0, highScore: 0 };
                }
                playerProfiles[activePlayerName].coins = totalCoins;
                if (mqttClient) {
                    mqttClient.publish(PROFILE_TOPIC, JSON.stringify({ user: activePlayerName, ...playerProfiles[activePlayerName] }));
                }
            }
            saveCoins();
            updateCoinDisplays();
        }
    }

    while (pipeArray.length > 0 && pipeArray[0].x < -pipeWidth) {
        pipeArray.shift();
    }
    while (coinArray.length > 0 && coinArray[0].x < -30) {
        coinArray.shift();
    }

    context.fillStyle = "white";
    context.font = "45px sans-serif";
    context.fillText(score, 5, 45);
    context.font = "20px sans-serif";
    context.fillText(`🪙 ${runCoins}`, 5, 72);
}

function endGame() {
    gameOver = true;
    clearInterval(pipeTimer);
    finalScore.textContent = `Score: ${score}`;
    finalCoins.textContent = `Coins this run: ${runCoins}`;
    updatePlayerHighScore(Math.floor(score));
    endScreen.classList.add("visible");
}

function placePipes() {
    if (!gameStarted || gameOver) {
        return;
    }

    let randomPipeY = pipeY - pipeHeight / 4 - Math.random() * (pipeHeight / 2);
    let openingspace = board.height / 4;

    let topPipe = {
        img: topPipeImg,
        x: pipeX,
        y: randomPipeY,
        width: pipeWidth,
        height: pipeHeight,
        passed: false,
    };

    let bottomPipe = {
        img: bottomPipeImg,
        x: pipeX,
        y: randomPipeY + pipeHeight + openingspace,
        width: pipeWidth,
        height: pipeHeight,
        passed: false,
    };

    pipeArray.push(topPipe);
    pipeArray.push(bottomPipe);

    const coin = {
        x: pipeX + pipeWidth / 2 - COIN_RADIUS,
        y: randomPipeY + pipeHeight + openingspace / 2 - COIN_RADIUS,
        radius: COIN_RADIUS,
        collected: false,
    };
    coinArray.push(coin);
}

function moveBird(e) {
    const isFlyAction =
        e.code === "Space" ||
        e.code === "ArrowUp" ||
        e.code === "ContextMenu" ||
        e.type === "click";

    if (!isFlyAction) {
        return;
    }

    if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) {
        return;
    }

    const clickedInsideGame = e.type !== "click" || e.target.closest(".game-shell");
    if (!clickedInsideGame) {
        return;
    }

    e.preventDefault();

    if (!gameStarted) {
        startGame();
    }

    if (gameOver) {
        restartGame();
    }

    velocityY = -6;
}

function detectCollision(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function drawCoin(coin) {
    if (coin.collected) {
        return;
    }

    const x = coin.x + coin.radius;
    const y = coin.y + coin.radius;
    context.beginPath();
    context.fillStyle = "#facc15";
    context.strokeStyle = "#ca8a04";
    context.lineWidth = 2;
    context.arc(x, y, coin.radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.closePath();
}

function detectCircleRectCollision(circle, rect) {
    if (circle.collected) {
        return false;
    }

    const closestX = Math.max(rect.x, Math.min(circle.x + circle.radius, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.y + circle.radius, rect.y + rect.height));
    const dx = circle.x + circle.radius - closestX;
    const dy = circle.y + circle.radius - closestY;
    return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function preloadBirdImages() {
    const uniqueSources = [...new Set(SKINS.map((skin) => skin.image))];
    for (const src of uniqueSources) {
        const img = new Image();
        img.src = src;
        birdImages[src] = img;
    }
}

function setupShop() {
    if (!ownedSkinIds.includes("classic")) {
        ownedSkinIds.push("classic");
    }
    if (!SKINS.some((skin) => skin.id === selectedSkinId)) {
        selectedSkinId = "classic";
    }

    updateCoinDisplays();
    renderShop();
}

function renderShop() {
    shopItems.innerHTML = "";

    for (const skin of SKINS) {
        const row = document.createElement("div");
        row.className = "shop-item";

        const name = document.createElement("span");
        name.className = "shop-item-name";
        name.textContent = `${skin.name} (${skin.cost} coins)`;

        const button = document.createElement("button");
        const isOwned = ownedSkinIds.includes(skin.id);
        const isSelected = selectedSkinId === skin.id;

        if (isSelected) {
            button.textContent = "Selected";
            button.disabled = true;
        } else if (isOwned) {
            button.textContent = "Equip";
            button.addEventListener("click", () => equipSkin(skin.id));
        } else {
            button.textContent = "Buy";
            button.disabled = totalCoins < skin.cost;
            button.addEventListener("click", () => buySkin(skin.id));
        }

        row.appendChild(name);
        row.appendChild(button);
        shopItems.appendChild(row);
    }
}

function buySkin(skinId) {
    const skin = SKINS.find((item) => item.id === skinId);
    if (!skin || totalCoins < skin.cost) {
        return;
    }

    totalCoins -= skin.cost;
    ownedSkinIds.push(skin.id);
    selectedSkinId = skin.id;
    saveCoins();
    saveOwnedSkins();
    saveSelectedSkin();
    updateCoinDisplays();
    renderShop();
}

function equipSkin(skinId) {
    if (!ownedSkinIds.includes(skinId)) {
        return;
    }

    selectedSkinId = skinId;
    saveSelectedSkin();
    renderShop();
}

function getCurrentSkin() {
    return SKINS.find((skin) => skin.id === selectedSkinId) || SKINS[0];
}

function getCurrentBirdImage() {
    return birdImages[getCurrentSkin().image] || birdImages["./flappybird.png"] || birdImg;
}

function updateCoinDisplays() {
    totalCoinsLabel.textContent = String(totalCoins);
}

function saveCoins() {
    localStorage.setItem("flappy-total-coins", String(totalCoins));
    renderShop();
}

function loadOwnedSkins() {
    try {
        const parsed = JSON.parse(localStorage.getItem(OWNED_SKINS_KEY) || "[\"classic\"]");
        return Array.isArray(parsed) ? parsed : ["classic"];
    } catch (_) {
        return ["classic"];
    }
}

function saveOwnedSkins() {
    localStorage.setItem(OWNED_SKINS_KEY, JSON.stringify(ownedSkinIds));
}

function saveSelectedSkin() {
    localStorage.setItem(SKIN_STORAGE_KEY, selectedSkinId);
}

function setupAdminPanel() {
    const registerForm = document.getElementById("account-register-form");
    const loginForm = document.getElementById("account-login-form");
    const registerUserInput = document.getElementById("register-user");
    const registerPassInput = document.getElementById("register-pass");
    const loginUserInput = document.getElementById("login-user");
    const loginPassInput = document.getElementById("login-pass");
    const accountStatus = document.getElementById("account-status");
    const adminStatus = document.getElementById("admin-status");
    const adminControls = document.getElementById("admin-controls");
    const targetUserInput = document.getElementById("admin-target-user");
    const coinAmountInput = document.getElementById("admin-coins-amount");
    const setCoinsInput = document.getElementById("admin-coins-set");
    const highScoreInput = document.getElementById("admin-highscore-value");
    const grantCoinsBtn = document.getElementById("admin-grant-coins");
    const setCoinsBtn = document.getElementById("admin-set-coins");
    const setHighScoreBtn = document.getElementById("admin-set-highscore");
    const toggleChatBtn = document.getElementById("admin-toggle-chat");
    const allowAdminBtn = document.getElementById("admin-allow-admin");
    const removeAdminBtn = document.getElementById("admin-remove-admin");

    registerForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const user = registerUserInput.value.trim().toLowerCase();
        const pass = registerPassInput.value.trim();
        if (!user || !pass || accounts[user]) {
            accountStatus.textContent = "Cannot create account (username exists or invalid).";
            return;
        }

        accounts[user] = { passwordHash: hashPassword(pass), isAdmin: false, isOwner: false };
        saveAccounts();
        publishAccountUpdate(user);
        accountStatus.textContent = `Account ${user} created.`;
    });

    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const user = loginUserInput.value.trim().toLowerCase();
        const pass = loginPassInput.value.trim();
        if (!authenticate(user, pass)) {
            accountStatus.textContent = "Login failed.";
            return;
        }

        currentUser = user;
        activePlayerName = user;
        syncPlayerProfile(user);
        accountStatus.textContent = `Logged in as ${user}.`;
        updateAdminVisibility(adminControls, adminStatus);
    });

    grantCoinsBtn.addEventListener("click", () => {
        if (!ensureAdminAccess(adminStatus, adminControls)) return;
        const targetUser = targetUserInput.value.trim().toLowerCase();
        const amount = Number(coinAmountInput.value);
        if (!targetUser || !Number.isFinite(amount) || amount <= 0) return;

        publishAdminAction({
            type: "grant-coins",
            targetUser,
            amount: Math.floor(amount),
            by: currentUser,
        });
    });

    setCoinsBtn.addEventListener("click", () => {
        if (!ensureAdminAccess(adminStatus, adminControls)) return;
        const targetUser = targetUserInput.value.trim().toLowerCase();
        const amount = Number(setCoinsInput.value);
        if (!targetUser || !Number.isFinite(amount) || amount < 0) return;

        publishAdminAction({
            type: "set-coins",
            targetUser,
            amount: Math.floor(amount),
            by: currentUser,
        });
    });

    setHighScoreBtn.addEventListener("click", () => {
        if (!ensureAdminAccess(adminStatus, adminControls)) return;
        const targetUser = targetUserInput.value.trim().toLowerCase();
        const scoreValue = Number(highScoreInput.value);
        if (!targetUser || !Number.isFinite(scoreValue) || scoreValue < 0) return;

        publishAdminAction({
            type: "set-high-score",
            targetUser,
            score: Math.floor(scoreValue),
            by: currentUser,
        });
    });

    toggleChatBtn.addEventListener("click", () => {
        if (!ensureAdminAccess(adminStatus, adminControls)) return;
        const targetUser = targetUserInput.value.trim().toLowerCase();
        if (!targetUser) return;
        const shouldMute = !mutedUsers.has(targetUser);

        publishAdminAction({
            type: "toggle-chat",
            targetUser,
            mute: shouldMute,
            by: currentUser,
        });
    });

    allowAdminBtn.addEventListener("click", () => {
        if (!ensureOwnerAccess(adminStatus, adminControls)) return;
        const targetUser = targetUserInput.value.trim().toLowerCase();
        if (!targetUser) return;

        publishAdminAction({
            type: "allow-admin",
            targetUser,
            by: currentUser,
        });
    });

    removeAdminBtn.addEventListener("click", () => {
        if (!ensureOwnerAccess(adminStatus, adminControls)) return;
        const targetUser = targetUserInput.value.trim().toLowerCase();
        if (!targetUser) return;

        publishAdminAction({
            type: "remove-admin",
            targetUser,
            by: currentUser,
        });
    });

    updateAdminVisibility(adminControls, adminStatus);
}

function ensureAdminAccess(adminStatusEl, adminControlsEl) {
    if (!currentUser || !accounts[currentUser]?.isAdmin) {
        adminStatusEl.textContent = "Please login as admin first.";
        adminControlsEl.classList.add("hidden");
        return false;
    }
    return true;
}

function ensureOwnerAccess(adminStatusEl, adminControlsEl) {
    if (!currentUser || !accounts[currentUser]?.isOwner) {
        adminStatusEl.textContent = "Only the owner can do that.";
        adminControlsEl.classList.add("hidden");
        return false;
    }
    return true;
}

function publishAdminAction(action) {
    if (!mqttClient) {
        applyAdminAction(action);
        return;
    }

    mqttClient.publish(ADMIN_TOPIC, JSON.stringify(action));
}

function applyAdminAction(action) {
    if (!action || !action.type || !action.targetUser) {
        return;
    }

    const target = action.targetUser.toLowerCase();
    if (!playerProfiles[target]) {
        playerProfiles[target] = { coins: 0, highScore: 0 };
    }

    if (action.type === "grant-coins") {
        playerProfiles[target].coins += Number(action.amount) || 0;
        notifyUser(target, `Your coins were updated by ${action.by}.`);
    } else if (action.type === "set-coins") {
        playerProfiles[target].coins = Math.max(0, Number(action.amount) || 0);
        notifyUser(target, `Your coins were set by ${action.by}.`);
    } else if (action.type === "set-high-score") {
        playerProfiles[target].highScore = Number(action.score) || 0;
        notifyUser(target, `Your high score was changed by ${action.by}.`);
    } else if (action.type === "toggle-chat") {
        if (action.mute) mutedUsers.add(target);
        else mutedUsers.delete(target);
        notifyUser(target, action.mute ? "You were blocked from chat by an admin." : "Your chat access was restored.");
    } else if (action.type === "allow-admin") {
        if (!accounts[target]) {
            accounts[target] = { passwordHash: "", isAdmin: false, isOwner: false };
        }
        accounts[target].isAdmin = true;
        saveAccounts();
        publishAccountUpdate(target);
        notifyUser(target, "You were granted admin privileges.");
    } else if (action.type === "remove-admin") {
        if (accounts[target] && !accounts[target].isOwner) {
            accounts[target].isAdmin = false;
            saveAccounts();
            publishAccountUpdate(target);
            notifyUser(target, "Your admin privileges were removed.");
        }
    }

    if (target === activePlayerName.toLowerCase()) {
        totalCoins = playerProfiles[target].coins;
        saveCoins();
        updateCoinDisplays();
    }

    if (mqttClient) {
        mqttClient.publish(PROFILE_TOPIC, JSON.stringify({ user: target, ...playerProfiles[target] }));
    }
}

function applyProfileUpdate(data) {
    if (!data || !data.user) {
        return;
    }

    const user = String(data.user).toLowerCase();
    playerProfiles[user] = {
        coins: Number(data.coins) || 0,
        highScore: Number(data.highScore) || 0,
    };
}

function updatePlayerHighScore(scoreValue) {
    if (!activePlayerName) {
        return;
    }

    const user = activePlayerName.toLowerCase();
    if (!playerProfiles[user]) {
        playerProfiles[user] = { coins: totalCoins, highScore: 0 };
    }

    if (scoreValue > (playerProfiles[user].highScore || 0)) {
        playerProfiles[user].highScore = scoreValue;
        if (mqttClient) {
            mqttClient.publish(PROFILE_TOPIC, JSON.stringify({ user, ...playerProfiles[user] }));
        }
    }
}

function syncPlayerProfile(user) {
    if (!playerProfiles[user]) {
        playerProfiles[user] = { coins: totalCoins, highScore: 0 };
        if (mqttClient) {
            mqttClient.publish(PROFILE_TOPIC, JSON.stringify({ user, ...playerProfiles[user] }));
        }
    }

    activePlayerName = user;
    totalCoins = playerProfiles[user].coins;
    updateCoinDisplays();
    renderShop();
}

function updateAdminVisibility(adminControls, adminStatus) {
    if (currentUser && accounts[currentUser]?.isAdmin) {
        adminControls.classList.remove("hidden");
        adminStatus.textContent = accounts[currentUser].isOwner
            ? "Owner privileges active."
            : "Admin privileges active.";
    } else {
        adminControls.classList.add("hidden");
        adminStatus.textContent = "Admin tools are locked (owner/admin required).";
    }
}

function notifyUser(targetUser, message) {
    if (!currentUser || currentUser !== targetUser) {
        return;
    }
    showToast(message);
}

function showToast(message) {
    const toast = document.getElementById("admin-toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    window.setTimeout(() => toast.classList.add("hidden"), 4500);
}

function authenticate(user, password) {
    const account = accounts[user];
    if (!account) {
        return false;
    }
    return account.passwordHash === hashPassword(password);
}

function ensureOwnerAccount() {
    if (!accounts[OWNER_USERNAME]) {
        accounts[OWNER_USERNAME] = {
            passwordHash: hashPassword(OWNER_PASSWORD),
            isAdmin: true,
            isOwner: true,
        };
        saveAccounts();
    }
}

function publishAccountUpdate(user) {
    if (!mqttClient || !accounts[user]) {
        return;
    }
    mqttClient.publish(ACCOUNT_TOPIC, JSON.stringify({ user, ...accounts[user] }));
}

function applyAccountUpdate(data) {
    if (!data || !data.user) {
        return;
    }
    accounts[data.user] = {
        passwordHash: data.passwordHash || "",
        isAdmin: Boolean(data.isAdmin),
        isOwner: Boolean(data.isOwner),
    };
    saveAccounts();

    if (currentUser && currentUser === data.user) {
        updateAdminVisibility(
            document.getElementById("admin-controls"),
            document.getElementById("admin-status")
        );
    }
}

function loadAccounts() {
    try {
        return JSON.parse(localStorage.getItem("flappy-accounts") || "{}");
    } catch (_) {
        return {};
    }
}

function saveAccounts() {
    localStorage.setItem("flappy-accounts", JSON.stringify(accounts));
}

function hashPassword(password) {
    return btoa(unescape(encodeURIComponent(password)));
}

function setupChatRoom() {
    const chatForm = document.getElementById("chat-form");
    const chatMessages = document.getElementById("chat-messages");
    const nameInput = document.getElementById("chat-name");
    const textInput = document.getElementById("chat-text");
    const chatStatus = document.getElementById("chat-status");
    const chatWarning = document.getElementById("chat-warning");

    if (typeof mqtt === "undefined") {
        chatStatus.textContent = "Live chat unavailable right now. Messages will stay local.";
        setupLocalChat(chatForm, chatMessages, nameInput, textInput);
        return;
    }

    const clientId = `flappy-${Math.random().toString(16).slice(2)}`;
    const brokerUrl = "wss://test.mosquitto.org:8081";
    mqttClient = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 2000,
    });

    const seenPayloads = new Set();

    mqttClient.on("connect", () => {
        chatStatus.textContent = "Connected to live chat.";
        mqttClient.subscribe([CHAT_TOPIC, ADMIN_TOPIC, PROFILE_TOPIC, ACCOUNT_TOPIC], (err) => {
            if (err) {
                chatStatus.textContent = "Connected, but failed to join room. Messages may not sync for everyone.";
            }
        });
    });

    mqttClient.on("message", (topic, payload) => {
        try {
            const text = payload.toString();
            const dedupeKey = `${topic}:${text}`;
            if (seenPayloads.has(dedupeKey)) {
                return;
            }

            seenPayloads.add(dedupeKey);
            const data = JSON.parse(text);
            if (topic === CHAT_TOPIC) {
                if (!data || !data.name || !data.message) {
                    return;
                }

                appendChatMessage(chatMessages, data.name, censorCussWords(data.message).text);
            } else if (topic === ADMIN_TOPIC) {
                applyAdminAction(data);
            } else if (topic === PROFILE_TOPIC) {
                applyProfileUpdate(data);
            } else if (topic === ACCOUNT_TOPIC) {
                applyAccountUpdate(data);
            }
        } catch (_) {
            // ignore malformed messages from public topic
        }
    });

    mqttClient.on("error", () => {
        chatStatus.textContent = "Live chat connection issue. Messages may not sync for everyone.";
    });

    chatForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const name = nameInput.value.trim();
        const message = textInput.value.trim();
        chatWarning.textContent = "";
        activePlayerName = name;

        if (!name || !message) {
            return;
        }
        syncPlayerProfile(name.toLowerCase());
        if (mutedUsers.has(name.toLowerCase())) {
            chatWarning.textContent = "You are currently blocked from chat.";
            return;
        }

        const profanityResult = censorCussWords(message);
        if (profanityResult.matches >= MAX_PROFANITY_MATCHES) {
            chatWarning.textContent = "Too many of these cuss words.";
            return;
        }

        const cleanedMessage = profanityResult.text;
        const payload = JSON.stringify({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name,
            message: cleanedMessage,
            createdAt: Date.now(),
        });

        seenPayloads.add(`${CHAT_TOPIC}:${payload}`);
        mqttClient.publish(CHAT_TOPIC, payload);
        appendChatMessage(chatMessages, name, cleanedMessage);
        textInput.value = "";
    });
}

function setupLocalChat(chatForm, chatMessages, nameInput, textInput) {
    const chatWarning = document.getElementById("chat-warning");
    chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = nameInput.value.trim();
        const message = textInput.value.trim();
        chatWarning.textContent = "";
        activePlayerName = name;

        if (!name || !message) {
            return;
        }
        syncPlayerProfile(name.toLowerCase());
        if (mutedUsers.has(name.toLowerCase())) {
            chatWarning.textContent = "You are currently blocked from chat.";
            return;
        }

        const profanityResult = censorCussWords(message);
        if (profanityResult.matches >= MAX_PROFANITY_MATCHES) {
            chatWarning.textContent = "Too many of these cuss words.";
            return;
        }

        appendChatMessage(chatMessages, name, profanityResult.text);
        textInput.value = "";
    });
}

function appendChatMessage(chatMessages, name, message) {
    const messageRow = document.createElement("p");
    messageRow.className = "chat-message";

    const nameLabel = document.createElement("span");
    nameLabel.className = "name";
    nameLabel.textContent = `${name}:`;

    const messageLabel = document.createElement("span");
    messageLabel.textContent = message;

    messageRow.appendChild(nameLabel);
    messageRow.appendChild(messageLabel);
    chatMessages.appendChild(messageRow);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function isTypingTarget(target) {
    if (!target || !(target instanceof HTMLElement)) {
        return false;
    }

    return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
    );
}

function censorCussWords(text) {
    let sanitized = text;
    let matches = 0;

    for (const word of CUSS_WORDS) {
        const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, "gi");
        sanitized = sanitized.replace(pattern, (match) => {
            matches += 1;
            return "#".repeat(match.length);
        });
    }

    for (const pattern of PROFANITY_PATTERNS) {
        sanitized = sanitized.replace(pattern, (match) => {
            matches += 1;
            return "#".repeat(match.length);
        });
    }

    return { text: sanitized, matches };
}

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
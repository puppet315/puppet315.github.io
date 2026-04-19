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
let totalCoins = 0;
let pipeTimer;

let startScreen;
let endScreen;
let finalScore;
let finalCoins;
let totalCoinsLabel;
let shopItems;
let leaderboardList;
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
const SKINS = [
    { id: "classic", name: "Classic", cost: 0, filter: "none", image: "./flappybird.png" },
    { id: "green", name: "Green", cost: 25, filter: "hue-rotate(25deg) saturate(170%) brightness(1.1)", image: "./flappybird.png" },
    { id: "ice", name: "Ice", cost: 60, filter: "hue-rotate(180deg) saturate(190%) brightness(1.05)", image: "./flappybird.png" },
    { id: "white", name: "White", cost: 90, filter: "grayscale(1) contrast(1.3) brightness(0.85)", image: "./flappybird.png" },
    { id: "jeffy2", name: "Jeffy Bird", cost: 140, filter: "none", image: "./jeffy_bird_2.png" },
];
let selectedSkinId = "classic";
let ownedSkinIds = ["classic"];
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
    "motherfucker",
    "cunt",
    "nigger",
    "nigga",
    "clanker",
    "cp",
    "child",
    "porn",
    "Minor",
    "kid",
    "Pedophile",
    "pedo",
    "incest",
    "predator",
    "rape",
    "rapist",
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
    leaderboardList = document.getElementById("leaderboard-list");

    const startBtn = document.getElementById("start-btn");
    const restartBtn = document.getElementById("restart-btn");

    startBtn.addEventListener("click", startGame);
    restartBtn.addEventListener("click", restartGame);

    setupShop();
    ensureOwnerAccount();
    renderLeaderboard();
    setupShopModal();
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
    if (currentUser && accounts[currentUser]?.isBanned) {
        showToast("Banned accounts cannot play the game.");
        return;
    }
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

    if (currentUser && accounts[currentUser]?.isBanned) {
        gameStarted = false;
        gameOver = true;
        clearInterval(pipeTimer);
        context.fillStyle = "white";
        context.font = "22px sans-serif";
        context.fillText("Banned accounts cannot play.", 20, board.height / 2);
        return;
    }

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
                if (accounts[activePlayerName]) {
                    accounts[activePlayerName].coins = totalCoins;
                    saveAccounts();
                    renderLeaderboard();
                    publishAccountUpdate(activePlayerName);
                }
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

function setupShopModal() {
    const modal = document.getElementById("shop-modal");
    const openBtn = document.getElementById("open-shop-btn");
    const closeBtn = document.getElementById("close-shop-btn");

    openBtn.addEventListener("click", () => {
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
    });

    closeBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
    });
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
        } else if (!currentUser) {
            button.textContent = "Login Required";
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
    if (!currentUser) {
        return;
    }
    const skin = SKINS.find((item) => item.id === skinId);
    if (!skin || totalCoins < skin.cost) {
        return;
    }

    totalCoins -= skin.cost;
    ownedSkinIds.push(skin.id);
    selectedSkinId = skin.id;
    saveCoins();
    updateCoinDisplays();
    renderShop();
}

function equipSkin(skinId) {
    if (!currentUser) {
        return;
    }
    if (!ownedSkinIds.includes(skinId)) {
        return;
    }

    selectedSkinId = skinId;
    saveAccountProgress();
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
    saveAccountProgress();
    renderShop();
}

function saveAccountProgress() {
    if (!currentUser || !accounts[currentUser]) {
        return;
    }
    accounts[currentUser].coins = totalCoins;
    accounts[currentUser].ownedSkins = [...new Set(ownedSkinIds)];
    accounts[currentUser].selectedSkin = selectedSkinId;
    saveAccounts();
    renderLeaderboard();
    publishAccountUpdate(currentUser);
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
    const banUserBtn = document.getElementById("admin-ban-user");
    const unbanUserBtn = document.getElementById("admin-unban-user");
    const resetAccountBtn = document.getElementById("admin-reset-account");
    const viewUserBtn = document.getElementById("admin-view-user");
    const broadcastInput = document.getElementById("admin-broadcast-text");
    const broadcastBtn = document.getElementById("admin-broadcast-btn");
    const deleteUserBtn = document.getElementById("admin-delete-user");

    registerForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const user = registerUserInput.value.trim().toLowerCase();
        const pass = registerPassInput.value.trim();
        if (!user || !pass || accounts[user]) {
            accountStatus.textContent = "Cannot create account (username exists or invalid).";
            return;
        }

        accounts[user] = {
            passwordHash: hashPassword(pass),
            isAdmin: false,
            isOwner: false,
            isBanned: false,
            coins: 0,
            highScore: 0,
            ownedSkins: ["classic"],
            selectedSkin: "classic",
        };
        saveAccounts();
        publishAccountUpdate(user);
        renderLeaderboard();
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

    banUserBtn.addEventListener("click", () => {
        if (!ensureOwnerAccess(adminStatus, adminControls)) return;
        const targetUser = targetUserInput.value.trim().toLowerCase();
        if (!targetUser) return;
        publishAdminAction({
            type: "ban-user",
            targetUser,
            by: currentUser,
        });
    });

    unbanUserBtn.addEventListener("click", () => {
        if (!ensureOwnerAccess(adminStatus, adminControls)) return;
        const targetUser = targetUserInput.value.trim().toLowerCase();
        if (!targetUser) return;
        publishAdminAction({
            type: "unban-user",
            targetUser,
            by: currentUser,
        });
    });

    deleteUserBtn.addEventListener("click", () => {
        if (!ensureOwnerAccess(adminStatus, adminControls)) return;
        const targetUser = targetUserInput.value.trim().toLowerCase();
        if (!targetUser) return;
        publishAdminAction({
            type: "delete-account",
            targetUser,
            by: currentUser,
        });
    });

    resetAccountBtn.addEventListener("click", () => {
        if (!ensureAdminAccess(adminStatus, adminControls)) return;
        const targetUser = targetUserInput.value.trim().toLowerCase();
        if (!targetUser) return;
        publishAdminAction({
            type: "reset-account",
            targetUser,
            by: currentUser,
        });
    });

    viewUserBtn.addEventListener("click", () => {
        if (!ensureAdminAccess(adminStatus, adminControls)) return;
        const targetUser = targetUserInput.value.trim().toLowerCase();
        if (!targetUser || !accounts[targetUser]) {
            adminStatus.textContent = "User not found.";
            return;
        }

        const account = accounts[targetUser];
        adminStatus.textContent = `@${targetUser} | Coins: ${account.coins || 0}, High Score: ${account.highScore || 0}, Admin: ${account.isAdmin ? "Yes" : "No"}, Banned: ${account.isBanned ? "Yes" : "No"}`;
    });

    broadcastBtn.addEventListener("click", () => {
        if (!ensureAdminAccess(adminStatus, adminControls)) return;
        const message = broadcastInput.value.trim();
        if (!message) return;
        publishAdminAction({
            type: "broadcast-message",
            targetUser: "__all__",
            message,
            by: currentUser,
        });
        broadcastInput.value = "";
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
    if (action.type === "broadcast-message") {
        if (action.message) {
            showAnnouncement(action.message, action.by);
        }
        return;
    }

    const target = action.targetUser.toLowerCase();
    if (!playerProfiles[target]) {
        playerProfiles[target] = { coins: 0, highScore: 0 };
    }
    if (!accounts[target]) {
        accounts[target] = {
            passwordHash: "",
            isAdmin: false,
            isOwner: false,
            isBanned: false,
            coins: 0,
            highScore: 0,
            ownedSkins: ["classic"],
            selectedSkin: "classic",
        };
    }

    if (action.type === "grant-coins") {
        playerProfiles[target].coins += Number(action.amount) || 0;
        accounts[target].coins = playerProfiles[target].coins;
        notifyUser(target, `Your coins were updated by ${action.by}.`);
    } else if (action.type === "set-coins") {
        playerProfiles[target].coins = Math.max(0, Number(action.amount) || 0);
        accounts[target].coins = playerProfiles[target].coins;
        notifyUser(target, `Your coins were set by ${action.by}.`);
    } else if (action.type === "set-high-score") {
        playerProfiles[target].highScore = Number(action.score) || 0;
        accounts[target].highScore = playerProfiles[target].highScore;
        notifyUser(target, `Your high score was changed by ${action.by}.`);
    } else if (action.type === "toggle-chat") {
        if (action.mute) mutedUsers.add(target);
        else mutedUsers.delete(target);
        notifyUser(target, action.mute ? "You were blocked from chat by an admin." : "Your chat access was restored.");
    } else if (action.type === "allow-admin") {
        if (!accounts[target]) {
            accounts[target] = {
                passwordHash: "",
                isAdmin: false,
                isOwner: false,
                isBanned: false,
                coins: 0,
                highScore: 0,
                ownedSkins: ["classic"],
                selectedSkin: "classic",
            };
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
    } else if (action.type === "ban-user") {
        if (accounts[target] && !accounts[target].isOwner) {
            accounts[target].isBanned = true;
            mutedUsers.add(target);
            saveAccounts();
            publishAccountUpdate(target);
            notifyUser(target, "Your account was banned by the owner.");
        }
    } else if (action.type === "unban-user") {
        if (accounts[target] && !accounts[target].isOwner) {
            accounts[target].isBanned = false;
            mutedUsers.delete(target);
            saveAccounts();
            publishAccountUpdate(target);
            notifyUser(target, "Your account was unbanned by the owner.");
        }
    } else if (action.type === "reset-account") {
        if (accounts[target]) {
            playerProfiles[target].coins = 0;
            playerProfiles[target].highScore = 0;
            accounts[target].coins = 0;
            accounts[target].highScore = 0;
            accounts[target].ownedSkins = ["classic"];
            accounts[target].selectedSkin = "classic";
            mutedUsers.delete(target);
            saveAccounts();
            publishAccountUpdate(target);
            notifyUser(target, "Your account progress was reset by an admin.");
        }
    } else if (action.type === "delete-account") {
        if (accounts[target] && !accounts[target].isOwner) {
            delete accounts[target];
            delete playerProfiles[target];
            mutedUsers.delete(target);
            saveAccounts();
            renderLeaderboard();
            if (mqttClient) {
                mqttClient.publish(ACCOUNT_TOPIC, JSON.stringify({ user: target, deleted: true }));
            }
            if (currentUser === target) {
                currentUser = null;
                activePlayerName = "";
                totalCoins = 0;
                ownedSkinIds = ["classic"];
                selectedSkinId = "classic";
                updateCoinDisplays();
                renderShop();
                showToast("Your account was deleted by the owner.");
            }
        }
    }

    if (target === activePlayerName.toLowerCase()) {
        totalCoins = accounts[target].coins;
        saveCoins();
        updateCoinDisplays();
    }

    saveAccounts();
    renderLeaderboard();
    if (mqttClient) {
        publishAccountUpdate(target);
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
    if (!accounts[user]) {
        accounts[user] = {
            passwordHash: "",
            isAdmin: false,
            isOwner: false,
            isBanned: false,
            coins: 0,
            highScore: 0,
            ownedSkins: ["classic"],
            selectedSkin: "classic",
        };
    }
    accounts[user].coins = playerProfiles[user].coins;
    accounts[user].highScore = playerProfiles[user].highScore;
    saveAccounts();
    renderLeaderboard();
}

function updatePlayerHighScore(scoreValue) {
    if (!activePlayerName) {
        return;
    }

    const user = activePlayerName.toLowerCase();
    if (!playerProfiles[user]) {
        playerProfiles[user] = { coins: totalCoins, highScore: 0 };
    }
    if (!accounts[user]) {
        accounts[user] = {
            passwordHash: "",
            isAdmin: false,
            isOwner: false,
            isBanned: false,
            coins: totalCoins,
            highScore: 0,
            ownedSkins: ["classic"],
            selectedSkin: "classic",
        };
    }

    if (scoreValue > (playerProfiles[user].highScore || 0)) {
        playerProfiles[user].highScore = scoreValue;
        accounts[user].highScore = scoreValue;
        saveAccounts();
        renderLeaderboard();
        publishAccountUpdate(user);
        if (mqttClient) {
            mqttClient.publish(PROFILE_TOPIC, JSON.stringify({ user, ...playerProfiles[user] }));
        }
    }
}

function syncPlayerProfile(user) {
    if (!playerProfiles[user]) {
        const accountCoins = accounts[user]?.coins ?? totalCoins;
        const accountHigh = accounts[user]?.highScore ?? 0;
        playerProfiles[user] = { coins: accountCoins, highScore: accountHigh };
        if (mqttClient) {
            mqttClient.publish(PROFILE_TOPIC, JSON.stringify({ user, ...playerProfiles[user] }));
        }
    }

    activePlayerName = user;
    totalCoins = accounts[user]?.coins ?? 0;
    ownedSkinIds = [...(accounts[user]?.ownedSkins || ["classic"])];
    selectedSkinId = accounts[user]?.selectedSkin || "classic";
    updateCoinDisplays();
    renderShop();
    renderLeaderboard();
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

function showAnnouncement(message, by) {
    const announcer = by ? `Announcement from ${by}: ` : "Announcement: ";
    showToast(`${announcer}${message}`);
}

function authenticate(user, password) {
    const account = accounts[user];
    if (!account) {
        return false;
    }
    if (account.isBanned) {
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
            isBanned: false,
            coins: 0,
            highScore: 0,
            ownedSkins: ["classic"],
            selectedSkin: "classic",
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
    if (data.deleted) {
        delete accounts[data.user];
        saveAccounts();
        renderLeaderboard();
        if (currentUser === data.user) {
            currentUser = null;
            activePlayerName = "";
            totalCoins = 0;
            ownedSkinIds = ["classic"];
            selectedSkinId = "classic";
            renderShop();
            updateCoinDisplays();
            showToast("Your account was deleted by the owner.");
        }
        return;
    }
    accounts[data.user] = {
        passwordHash: data.passwordHash || "",
        isAdmin: Boolean(data.isAdmin),
        isOwner: Boolean(data.isOwner),
        isBanned: Boolean(data.isBanned),
        coins: Number(data.coins) || 0,
        highScore: Number(data.highScore) || 0,
        ownedSkins: Array.isArray(data.ownedSkins) ? data.ownedSkins : ["classic"],
        selectedSkin: data.selectedSkin || "classic",
    };
    saveAccounts();
    renderLeaderboard();

    if (currentUser && currentUser === data.user) {
        if (accounts[data.user].isBanned) {
            currentUser = null;
            activePlayerName = "";
            totalCoins = 0;
            ownedSkinIds = ["classic"];
            selectedSkinId = "classic";
            renderShop();
            updateCoinDisplays();
            showToast("Your account was banned by the owner.");
            updateAdminVisibility(
                document.getElementById("admin-controls"),
                document.getElementById("admin-status")
            );
            return;
        }
        totalCoins = accounts[data.user].coins;
        ownedSkinIds = [...accounts[data.user].ownedSkins];
        selectedSkinId = accounts[data.user].selectedSkin;
        renderShop();
        updateCoinDisplays();
        updateAdminVisibility(
            document.getElementById("admin-controls"),
            document.getElementById("admin-status")
        );
    }
}

function loadAccounts() {
    try {
        const raw = JSON.parse(localStorage.getItem("flappy-accounts") || "{}");
        for (const [user, account] of Object.entries(raw)) {
            raw[user] = {
                passwordHash: account.passwordHash || "",
                isAdmin: Boolean(account.isAdmin),
                isOwner: Boolean(account.isOwner),
                isBanned: Boolean(account.isBanned),
                coins: Number(account.coins) || 0,
                highScore: Number(account.highScore) || 0,
                ownedSkins: Array.isArray(account.ownedSkins) ? account.ownedSkins : ["classic"],
                selectedSkin: account.selectedSkin || "classic",
            };
        }
        return raw;
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

function renderLeaderboard() {
    if (!leaderboardList) {
        return;
    }

    const rows = Object.entries(accounts)
        .filter(([, account]) => account.passwordHash && !account.isBanned)
        .sort((a, b) => {
            const scoreDiff = (b[1].highScore || 0) - (a[1].highScore || 0);
            if (scoreDiff !== 0) return scoreDiff;
            return (b[1].coins || 0) - (a[1].coins || 0);
        })
        .slice(0, 10);

    leaderboardList.innerHTML = "";
    const header = document.createElement("div");
    header.className = "leaderboard-row header";
    header.innerHTML = "<span>User</span><span>High Score</span><span>Coins</span>";
    leaderboardList.appendChild(header);

    for (const [user, account] of rows) {
        const row = document.createElement("div");
        row.className = "leaderboard-row";
        row.innerHTML = `<span>${user}</span><span>${account.highScore || 0}</span><span>${account.coins || 0}</span>`;
        leaderboardList.appendChild(row);
    }
}

function setupChatRoom() {
    const chatForm = document.getElementById("chat-form");
    const chatMessages = document.getElementById("chat-messages");
    const textInput = document.getElementById("chat-text");
    const chatStatus = document.getElementById("chat-status");
    const chatWarning = document.getElementById("chat-warning");

    if (typeof mqtt === "undefined") {
        chatStatus.textContent = "Live chat unavailable right now. Messages will stay local.";
        setupLocalChat(chatForm, chatMessages, textInput);
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

        const message = textInput.value.trim();
        chatWarning.textContent = "";

        if (!currentUser || !message) {
            chatWarning.textContent = "You must log in to use chat.";
            return;
        }
        if (accounts[currentUser]?.isBanned) {
            chatWarning.textContent = "This account is banned.";
            return;
        }

        syncPlayerProfile(currentUser);
        if (mutedUsers.has(currentUser.toLowerCase())) {
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
            name: currentUser,
            message: cleanedMessage,
            createdAt: Date.now(),
        });

        seenPayloads.add(`${CHAT_TOPIC}:${payload}`);
        mqttClient.publish(CHAT_TOPIC, payload);
        appendChatMessage(chatMessages, currentUser, cleanedMessage);
        textInput.value = "";
    });
}

function setupLocalChat(chatForm, chatMessages, textInput) {
    const chatWarning = document.getElementById("chat-warning");
    chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const message = textInput.value.trim();
        chatWarning.textContent = "";

        if (!currentUser || !message) {
            chatWarning.textContent = "You must log in to use chat.";
            return;
        }
        if (accounts[currentUser]?.isBanned) {
            chatWarning.textContent = "This account is banned.";
            return;
        }
        syncPlayerProfile(currentUser);
        if (mutedUsers.has(currentUser.toLowerCase())) {
            chatWarning.textContent = "You are currently blocked from chat.";
            return;
        }

        const profanityResult = censorCussWords(message);
        if (profanityResult.matches >= MAX_PROFANITY_MATCHES) {
            chatWarning.textContent = "Too many of these cuss words.";
            return;
        }

        appendChatMessage(chatMessages, currentUser, profanityResult.text);
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
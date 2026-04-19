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

// physics
let velocityX = -2; // speed of the pipes moving left
let velocityY = 0; // speed of the bird moving up and down
let gravity = 0.4; // gravity pulling the bird down

let gameOver = false;
let gameStarted = false;
let score = 0;
let pipeTimer;

let startScreen;
let endScreen;
let finalScore;
const CHAT_TOPIC = "hhs/flappybird/global-chat-v1";

window.onload = function () {
    board = document.getElementById("board");
    board.height = boardHeight;
    board.width = boardWidth;
    context = board.getContext("2d");

    startScreen = document.getElementById("start-screen");
    endScreen = document.getElementById("end-screen");
    finalScore = document.getElementById("final-score");

    const startBtn = document.getElementById("start-btn");
    const restartBtn = document.getElementById("restart-btn");

    startBtn.addEventListener("click", startGame);
    restartBtn.addEventListener("click", restartGame);

    setupChatRoom();

    birdImg = new Image();
    birdImg.src = "./flappybird.png";
    birdImg.onload = function () {
        context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);
    };

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
    score = 0;
    startGame();
}

function update() {
    requestAnimationFrame(update);
    context.clearRect(0, 0, board.width, board.height);

    if (!gameStarted) {
        context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);
        return;
    }

    if (gameOver) {
        return;
    }

    // draw the bird
    velocityY += gravity;
    bird.y = Math.max(bird.y + velocityY, 0);
    context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);

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

    while (pipeArray.length > 0 && pipeArray[0].x < -pipeWidth) {
        pipeArray.shift();
    }

    context.fillStyle = "white";
    context.font = "45px sans-serif";
    context.fillText(score, 5, 45);
}

function endGame() {
    gameOver = true;
    clearInterval(pipeTimer);
    finalScore.textContent = `Score: ${score}`;
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

function setupChatRoom() {
    const chatForm = document.getElementById("chat-form");
    const chatMessages = document.getElementById("chat-messages");
    const nameInput = document.getElementById("chat-name");
    const textInput = document.getElementById("chat-text");
    const chatStatus = document.getElementById("chat-status");

    if (typeof mqtt === "undefined") {
        chatStatus.textContent = "Live chat unavailable right now. Messages will stay local.";
        setupLocalChat(chatForm, chatMessages, nameInput, textInput);
        return;
    }

    const clientId = `flappy-${Math.random().toString(16).slice(2)}`;
    const brokerUrl = "wss://test.mosquitto.org:8081";
    const client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 2000,
    });

    const seenPayloads = new Set();

    client.on("connect", () => {
        chatStatus.textContent = "Connected to live chat.";
        client.subscribe(CHAT_TOPIC, (err) => {
            if (err) {
                chatStatus.textContent = "Connected, but failed to join room. Messages may not sync for everyone.";
            }
        });
    });

    client.on("message", (_, payload) => {
        try {
            const text = payload.toString();
            if (seenPayloads.has(text)) {
                return;
            }

            seenPayloads.add(text);
            const data = JSON.parse(text);
            if (!data || !data.name || !data.message) {
                return;
            }

            appendChatMessage(chatMessages, data.name, data.message);
        } catch (_) {
            // ignore malformed messages from public topic
        }
    });

    client.on("error", () => {
        chatStatus.textContent = "Live chat connection issue. Messages may not sync for everyone.";
    });

    chatForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const name = nameInput.value.trim();
        const message = textInput.value.trim();

        if (!name || !message) {
            return;
        }

        const payload = JSON.stringify({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name,
            message,
            createdAt: Date.now(),
        });

        seenPayloads.add(payload);
        client.publish(CHAT_TOPIC, payload);
        appendChatMessage(chatMessages, name, message);
        textInput.value = "";
    });
}

function setupLocalChat(chatForm, chatMessages, nameInput, textInput) {
    chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = nameInput.value.trim();
        const message = textInput.value.trim();

        if (!name || !message) {
            return;
        }

        appendChatMessage(chatMessages, name, message);
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
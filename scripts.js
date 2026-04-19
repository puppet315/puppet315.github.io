
//board
let board;
let boardWidth = 360;
let boardHeight = 640;
let context;

//bird
let birdWidth = 34; // width/height ratio = 408/228 = 17/12
let birdHeight = 24;
let birdX = boardHeight/8;
let birdY = boardHeight/2;
let birdImg;

let bird = {
    x: birdX,
    y: birdY,
    width: birdWidth,
    height: birdHeight
}
//pipes
let pipeArray = [];
let pipeWidth = 64; // width/height ratio = 384/3072 = 1/8
let pipeHeight = 512;
let pipeX = boardWidth;
let pipeY = 0;

let topPipeImg;
let bottomPipeImg;

//physics
let velocityX = -2; // speed of the pipes moving left
let velocityY = 0; // speed of the bird moving up and down
let gravity = 0.4; // gravity pulling the bird down

let gameOver = false;
let score = 0;


window.onload = function() { // executes after the page is loaded
    board = document.getElementById("board"); // reference to the canvas element
    board.height = boardHeight; // set the height of the canvas
    board.width = boardWidth; // set the width of the canvas
    context = board.getContext("2d"); // used for drawing on the board


//draw flappy bird


    //load the bird image
    birdImg = new Image();
    birdImg.src = "./images/flappybird.png";
    birdImg.onload = function() { // executes after the image is loaded
        context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height); // draw the bird image on the canvas
}
    topPipeImg = new Image();
    topPipeImg.src = "./images/toppipe.png";
    bottomPipeImg = new Image();
    bottomPipeImg.src = "./images/bottompipe.png";

    requestAnimationFrame(update); // update the canvas
    setInterval(placePipes, 1500); // place pipes every 1.5 seconds
    document.addEventListener("keydown", moveBird); // listen for key presses to move the bird
    document.addEventListener("click", moveBird); // listen for mouse clicks to move the bird
}
function update() {
    requestAnimationFrame(update); // update the canvas
    if (gameOver) {
        return; // stop the game loop if the game is over
    }
    context.clearRect(0, 0, board.width, board.height); // clear the canvas

    
    //draw the bird
    velocityY += gravity; // apply gravity to the bird's vertical velocity
    bird.y = Math.max(bird.y + velocityY, 0); // update the bird's y position and prevent it from going above the canvas
    context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height); // draw the bird image on the canvas

    if (bird.y > board.height) {
        gameOver = true; // end the game if the bird hits the bottom of the canvas
    }

    //draw the pipes
    for(let i = 0; i < pipeArray.length; i++) {
        let pipe = pipeArray[i];
        pipe.x += velocityX; // move the pipe left
        context.drawImage(pipe.img, pipe.x, pipe.y, pipe.width, pipe.height); // draw the pipe image on the canvas

        if (!pipe.passed && bird.x > pipe.x + pipe.width) {
            score += 0.5; // increase the score by 0.5 for each pipe passed (top and bottom pipes count as one)
            pipe.passed = true; // mark the pipe as passed
        }

    



        //check for collision with the bird
        if (detectCollision(bird, pipe)) {
            gameOver = true;
        }

    }

    //clear pipes that have moved off the screen
    while (pipeArray.length > 0 && pipeArray[0].x < -pipeWidth) {
        pipeArray.shift(); // remove the first pipe from the array
    }



    //score
    context.fillStyle = "white";
    context.font = "45px sans-serif";
    context.fillText(score, 5, 45); // display the score on the canvas

    if (gameOver) {
        context.fillText("Game Over!", 5, 90); // display game over message
    }
}
function placePipes() {
    if (gameOver) {
        return; // stop placing pipes if the game is over
    }

    let randomPipeY = pipeY - pipeHeight/4 - Math.random() * (pipeHeight/2); // random y position for the top pipe
    let openingspace = board.height/4; // space between the top and bottom pipes


    let topPipe = {
        img : topPipeImg,
        x: pipeX,
        y: randomPipeY,
        width: pipeWidth,
        height: pipeHeight,
        passed : false
    };

    let bottomPipe = {
        img : bottomPipeImg,
        x: pipeX,
        y: randomPipeY + pipeHeight + openingspace, // 100 is the gap between the pipes
        width: pipeWidth,
        height: pipeHeight,
        passed : false
    };
    
    pipeArray.push(topPipe); // add the top pipe to the array
    pipeArray.push(bottomPipe); // add the bottom pipe to the array
}


function moveBird(e) {
    if (e.code == "Space" || e.code == "ArrowUp" || e.code == "ContextMenu" || e.type === "click") {
        e.preventDefault(); // Prevents default context menu
        //jump
        velocityY = -6; // move the bird up

    
        // reset the game if it's over
        if (gameOver) {
            bird.y = birdY; // reset the bird's position
            pipeArray = []; // clear the pipes
            score = 0; // reset the score
            gameOver = false; // reset the game over flag
        }
    }
}

function detectCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}





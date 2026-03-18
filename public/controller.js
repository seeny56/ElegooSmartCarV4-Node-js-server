const gamepads = {};
let mainGamePad = null;
function gamepadHandler(event, connected) {
    const gamepad = event.gamepad;
    // Note:
    // gamepad === navigator.getGamepads()[gamepad.index]

    // this will naturally set the most recent gamepad as the main and ignore the previous gamepads
    //BUG: if a previous gamepad disconnects it will disconect the current gamepad also
    if (connected) {
        gamepads[gamepad.index] = gamepad;
        mainGamePad = gamepad;
    } else {
        delete gamepads[gamepad.index];
        mainGamePad = null;
    }
}

window.addEventListener("gamepadconnected", (e) => {
    console.log("controller connected");
    gamepadHandler(e, true);
});
window.addEventListener("gamepaddisconnected", (e) => {
    gamepadHandler(e, false);
});

const mainLogic = () => {
    //const canvas = document.getElementById('myCanvas');
    //const ctx = canvas.getContext('2d');
    const btn = document.getElementById('snapBtn');

    btn.addEventListener('click', async () => {
        try {
            const response = await fetch('/snapshot', { method: 'POST' });
            if (!response.ok) throw new Error("Server hasn't received an image yet.");

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, 640, 480);
                URL.revokeObjectURL(url); // Clean up memory
            };
            img.src = url;
        } catch (err) {
            alert(err.message);
        }
    });
    console.log("running");

    

    const socket = new WebSocket("wss://controller.flickshotpro.com");

    socket.addEventListener("open", () => {
        console.log("WebSocket connected");
        //socket.send("hello server");

        setInterval(() => {
            if (mainGamePad) {
                const gp = navigator.getGamepads()[mainGamePad.index];
                console.log(
                    "Gamepad connected at index %d: %s. %d buttons, %d axes.",
                    gp.index,
                    gp.id,
                    gp.buttons.length,
                    gp.axes.length,
                );
                let buttons = [];
                for(let i =0; i < 16; i++){
                    buttons.push(gp.buttons[i].value);
                }
                let axes = [];
                for(let i =0; i <4;i++){
                    axes.push(gp.axes[i]);
                }
                socket.send(JSON.stringify({
                    buttons,
                    axes
                }));
            }
            
        }, 1000 / 60);// default poll controllers at 60hz

    });

    socket.addEventListener("message", (event) => {
        console.log("Received:", event.data);
    });

    socket.addEventListener("error", (err) => {
        console.error("WebSocket error:", err);
    });

    socket.addEventListener("close", (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
    });

    // Video feed WebSocket - separate from your gamepad/control socket
    const videoSocket = new WebSocket("wss://feed.flickshotpro.com");
    videoSocket.binaryType = "arraybuffer"; // Important — frames are binary, not text

    const videoFeed = document.getElementById('videoFeed');
    let currentObjectURL = null;

    videoSocket.addEventListener("message", (event) => {
        const blob = new Blob([event.data], { type: "image/jpeg" });
        const newURL = URL.createObjectURL(blob);

        videoFeed.src = newURL;

        // Revoke the previous URL after the new frame loads to avoid memory leak
        videoFeed.onload = () => {
            if (currentObjectURL) URL.revokeObjectURL(currentObjectURL);
            currentObjectURL = newURL;
        };
    });

    videoSocket.addEventListener("open", () => console.log("[Video] feed connected"));
    videoSocket.addEventListener("error", (err) => console.error("[Video] feed error:", err));
    videoSocket.addEventListener("close", () => console.log("[Video] feed closed"));
};


mainLogic();
# hello-express

A project representing my latest work bridging embedded hardware and a browser client over a custom binary protocol under real networking constraints.


<p aligned="center"> <em> Note: Changed Master Slam Files included in this repo representing added websocket listener</em> </p>

## What It Does

A Node.js server acting as a multi-protocol hub between an **ESP32 camera module**, a **browser gamepad client**, and a **SLAM processing system**. The browser streams live JPEG video from the robot and sends gamepad input back to drive it — all in real time.

## Controls

- **Right stick** — drive the robot (forward / back / left / right)
- **Dead zone** — 0.1 radius to suppress stick drift
- **20 Hz command rate** — throttled to prevent ESP32 buffer overflow

## Setup

```bash
git clone https://github.com/seeny56/hello-express.git
cd hello-express
npm install
npm run dev
# server on http://localhost:3000
```

Open `http://localhost:3000` in a browser, connect a gamepad, and point an ESP32 at port `41235`.

## Tech Stack

- **Node.js / Express 5** — HTTP server and static asset hosting
- **ws** — WebSocket servers for browser video feed, SLAM feed, and controller input
- **TCP (net module)** — binary frame receiver from ESP32 camera
- **HTML5 Gamepad API** — browser-side controller polling at 60 Hz
- **ES modules** — native `import`/`export` throughout
- **nodemon** — dev auto-reload

## Key Design Decisions

- **Custom binary framing protocol** — 16-byte header (magic `0xDEADBEEF`, frame index, timestamp, data length) synchronises the TCP stream; re-syncs on corrupt bytes rather than dropping the connection
- **Bidirectional binary commands** — server writes 12-byte headers (`0xBEEFDEAD`) + JSON payload back to ESP32 over the same TCP socket
- **Input throttling** — controller messages gated at 50 ms intervals so the ESP32 is never flooded
- **Analog-to-command translation** — right stick magnitude maps linearly to motor speed (0–150) and direction is resolved to a cardinal command
- **Dual WebSocket broadcast** — same JPEG frame fan-out to browser and SLAM system independently

## Architecture

| Layer | File | Role |
|---|---|---|
| HTTP shell | `server.js` | Express setup, CORS, static files, VideoServer init |
| Core hub | `src/VideoRecording/videoServer.js` | TCP receiver, WS servers, frame routing, command translation |
| Browser client | `public/controller.js` | Gamepad polling, WS send, JPEG display |
| Data model | `public/controllerSnapshot.js` | Xbox button/axis mapping constants |

## Network Topology

```
ESP32 Camera ──TCP:41235──► Server ──WS:41236──► Browser (video)
                                   └──WS:3002───► SLAM system

Browser (gamepad) ──WS:3001──► Server ──TCP:41235──► ESP32
```

| Port | Protocol | Direction | Purpose |
|------|----------|-----------|---------|
| 3000 | HTTP | — | Web UI |
| 41235 | TCP | Inbound | ESP32 JPEG frame stream + outbound commands |
| 41236 | WebSocket | Outbound | Browser video feed |
| 3001 | WebSocket | Inbound | Gamepad controller input |
| 3002 | WebSocket | Outbound | SLAM system video feed |

## Wire Protocol

**ESP32 → Server (TCP)**
```
Bytes 0–3   Magic    0xDEADBEEF (LE)
Bytes 4–7   Frame index
Bytes 8–11  Timestamp (ms)
Bytes 12–15 JPEG payload length
[JPEG bytes]
```

**Server → ESP32 (TCP)**
```
Bytes 0–3   Magic    0xBEEFDEAD (LE)
Bytes 4–7   Command index
Bytes 8–11  JSON payload length
[JSON command e.g. {"N":3,"D1":3,"D2":120}]
```

**Movement commands**

| Command | D1 | Meaning |
|---|---|---|
| `{N:3, D1:1, D2:spd}` | 1 | Left |
| `{N:3, D1:2, D2:spd}` | 2 | Right |
| `{N:3, D1:3, D2:spd}` | 3 | Forward |
| `{N:3, D1:4, D2:spd}` | 4 | Backward |
| `{N:100}` | — | Stop |

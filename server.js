import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import VideoServer from './src/VideoRecording/videoServer.js';
import ControllerServer from './src/WebSocketController/controllerServer.js';
import Server from './src/Udp/server.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

//cors to allow cross origin connection from subdomains and if running locally
const allowedOrigins = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$|^https:\/\/feed\.flickshotpro\.com$/;
app.use(cors({ origin: allowedOrigins }));

// Internal storage for the image
let latestImageBuffer = Buffer.alloc(0);

let tempReconstructionBuffer = Buffer.alloc(0);// i had planned to store more snapshots

app.use(express.static('public'));// static file serving in the public folder

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// old post request method to grab latest snapshot; not used anymore since websocket feed
app.post('/snapshot', (req, res) => {
    if (latestImageBuffer.length === 0) {
        return res.status(404).send("No image received yet from ESP32");
    }
    
    // We send the JPEG buffer directly
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(latestImageBuffer);
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Express server spinning up at http://192.168.0.144:${port}`);
});


//main elegoo v4 program
let videoServer = new VideoServer();

//test program for Gaffer on Games udp reliability protocol i was implementing to learn c++
//let udpServer = new Server();
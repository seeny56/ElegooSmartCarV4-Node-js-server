import net from 'node:net';
import { WebSocketServer } from 'ws';

const MAGIC = 0xDEADBEEF; 
const HEADER_SIZE = 16;

const MAGIC_CONTROLLER = 0xBEEFDEAD;
const CONTROLLER_HEADER_SIZE = 12;

export default class VideoServer {

    constructor() {

        //can combine controller and browser camera feed into one web socket server
        //just didn't feel like writing bi directional communication because needed clear separation of concerns

        const wss = new WebSocketServer({ port: 41236 }); // browser live feed
        const slamWss = new WebSocketServer({ port: 3002 }); // slam live feed
        const cwss = new WebSocketServer({ port: 3001 }); // controller input

        let esp32Socket = null; // shared reference accessible everywhere
        let commandIndex = 0;

        // --- Helpers ---

        const buildCommand = (jsonPayload) => {
            const payload = Buffer.from(JSON.stringify(jsonPayload), 'utf8');
            const header = Buffer.allocUnsafe(CONTROLLER_HEADER_SIZE); // unnecessary for now but optimization for future memory
            header.writeUInt32LE(MAGIC_CONTROLLER, 0);//tells byte stream that incoming data is new controller frame
            header.writeUInt32LE(commandIndex++, 4);//not used now but will be used later when using udp
            header.writeUInt32LE(payload.length, 8);
            return Buffer.concat([header, payload]);
        };

        const sendCommand = (command) => {
            if (esp32Socket && esp32Socket.writable) {
                esp32Socket.write(buildCommand(command));
            }
        };

        const getMovementCommand = (movementX, movementY, speed = 150) => {
            if (movementY === 1) return { N: 3, D1: 3, D2: speed }; // Forward
            else if (movementY === -1) return { N: 3, D1: 4, D2: speed }; // Backward
            else if (movementX === -1) return { N: 3, D1: 1, D2: speed }; // Left
            else if (movementX === 1) return { N: 3, D1: 2, D2: speed }; // Right
            else return { N: 100 };                  // Stop
        };

        const broadcast = (frameBuffer) => {
            //browser clients
            wss.clients.forEach(client => {
                if (client.readyState === 1) client.send(frameBuffer);
            });
            //slam server
            slamWss.clients.forEach(client => {
                if (client.readyState === 1) client.send(frameBuffer);
            });
        };

        // --- Controller WebSocket ---
        cwss.on('connection', (ws) => {
            console.log('[Controller] connected');

            ws.on('error', console.error);

            let lastCommandTime = 0;
            const COMMAND_RATE = 1000 / 20; // 50ms between commands = 20fps

            ws.on('message', (data) => {
                const controllerSnapshot = JSON.parse(data);

                const axisX = controllerSnapshot.axes[2];
                const axisY = controllerSnapshot.axes[3];
                console.log(axisX);
                console.log(axisY);

                let command;

                //radius of 0.1 to to deal with stick drift
                if (Math.abs(axisX) < 0.1 && Math.abs(axisY) < 0.1) {
                    command = { N: 100 };
                } 
                else if (Math.abs(axisY) >= Math.abs(axisX)) {
                    //change speed depening on joystick magnitude
                    const speed = Math.round(150 * Math.abs(axisY));
                    //convert axis to hard value -1 or 1;
                    const direction = axisY < 0 ? 1 : -1;
                    command = getMovementCommand(0, direction, speed);
                } 
                else {
                    const speed = Math.round(150 * Math.abs(axisX));
                    const direction = axisX > 0 ? 1 : -1;
                    command = getMovementCommand(direction, 0, speed);
                }

                // Throttle — only forward to ESP32 at 20fps regardless of browser poll rate
                // constrained at 20fps to prevent overflow happening too soon.
                const now = Date.now();
                if (now - lastCommandTime >= COMMAND_RATE) {
                    lastCommandTime = now;
                    sendCommand(command);
                }
            });

            ws.on('close', () => {
                console.log('[Controller] disconnected — sending stop');
                sendCommand({ N: 100 });
            });

            ws.send('connected');
        });

        // --- Video WebSocket ---

        wss.on('connection', () => console.log('[Browser] connected (41236)'));
        slamWss.on('connection', () => console.log('[SLAM ]connected (3002)'));

        // --- TCP Server (ESP32) ---

        const tcpServer = net.createServer((socket) => {
            console.log('[ESP32] connected');
            esp32Socket = socket; // make available to controller handler
            let buf = Buffer.alloc(0);

            socket.on('data', (data) => {
                buf = Buffer.concat([buf, data]);

                while (true) {
                    if (buf.length < HEADER_SIZE) break;

                    const magic = buf.readUInt32LE(0);
                    if (magic !== MAGIC) {
                        const next = buf.indexOf(Buffer.from([0xEF, 0xBE, 0xAD, 0xDE]), 1);
                        buf = next === -1 ? Buffer.alloc(0) : buf.subarray(next);
                        continue;
                    }

                    const frameIndex = buf.readUInt32LE(4);
                    const timestamp = buf.readUInt32LE(8);
                    const dataLen = buf.readUInt32LE(12);

                    if (buf.length < HEADER_SIZE + dataLen) break;

                    const jpeg = buf.subarray(HEADER_SIZE, HEADER_SIZE + dataLen);
                   // console.log(`[Frame] ${frameIndex} | ${timestamp}ms | ${dataLen} bytes`);
                    broadcast(jpeg);

                    buf = buf.subarray(HEADER_SIZE + dataLen);
                }
            });

            socket.on('end', () => {
                console.log('[ESP32] disconnected');
                esp32Socket = null;
            });

            socket.on('error', (err) => {
                console.error('TCP error:', err.message);
                esp32Socket = null;
            });
        });

        tcpServer.listen(41235, '0.0.0.0', () => {
            console.log('[TCP] frame receiver on port 41235');
            console.log('[WebSocket] [Video] feed on port 41236');
            console.log('[WebSocket] [SLAM] feed on port 3002');
            console.log('[WebSocket] [Controller] on port 3001');
        });
    }
}
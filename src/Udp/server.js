import * as dgram from 'node:dgram';

class Packet{
    
}

export default class Server {

    constructor() {
        // --- UDP Logic to handle your 1, 2, 3 ID Protocol ---
        const server = dgram.createSocket('udp4');

        server.on('listening', () => {
            process.stdin.setEncoding("utf8");

            process.stdin.on("data", (data) => {
                console.log(`You entered: ${data.trim()}`);
                server.send(data.trim(), 9000, "0.0.0.0");
            });
        });
        let packetArray = [];

        server.on('message', (msg, rinfo) => {
            console.log(msg);
        });
        server.bind(41234);
        server.on('error', (error) => { console.log(error) });
        server.send('hello', 9000, "0.0.0.0");

    }
}
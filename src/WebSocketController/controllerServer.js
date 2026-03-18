//client websocket
import { WebSocketServer } from 'ws';



export default class ControllerServer{
  constructor(){
    const wss = new WebSocketServer({ port: 3001 });

wss.on('connection', function connection(ws) {
  ws.on('error', console.error);

  ws.on('message', function message(data) {
    console.log(JSON.parse(data));
  });

  ws.send('something');
});
  }
}
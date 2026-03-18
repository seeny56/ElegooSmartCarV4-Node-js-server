export default class NetworkClient{
    static states = {
        DISCONNECTED:0,
        PENDING:1,
        CONNECTED:2
    };
    connectionState;
    ipAddress;
    port;
    constructor(){
        this.connectionState = NetworkClient.states.DISCONNECTED;
        this.ipAddress = "";
        this.port = "";
    }
    
}
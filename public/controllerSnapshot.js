export default class ControllerSnapshot{
    static XBOX_BUTTONS = {
        A:0,
        B:1,
        X:2,
        Y:3,
        LeftBumper:4,
        RightBumpder:5,
        LeftTrigger:6,
        RightTrigger:7,
        Start:8,
        Select:9,
        LeftStick:10,
        RightStick:11,
        Up:12,
        Down:13,
        Left:14,
        Right:15
    };
    static XBOX_AXIS ={
        LeftX:0,
        LeftY:1,
        RightX:2,
        RightY:3
    };
    index; // unique index in navigator.getGamepads()[]
    id; // unique hardware info id telling what kind of controller
    buttons; // array of buttons
    axes;   // array of axes
    constructor(gamepad){
        this.index = gamepad.index;
        this.id = gamepad.id;
        this.buttons = gamepad.buttons;
        this.axes = gamepad.axes;
    }
    getButton(index){
        return this.buttons[index].value;
    }
    getAxes(index){
        return this.axes[index].value;
    }
}
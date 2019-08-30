const {spawn} = require("child_process");
const options = {
    stdio: "inherit",
    env: Object.assign({}, process.env, { MSYSTEM: "" }),
    cwd: __dirname
};

const child = require("os").platform() === "win32" ? spawn("cmd.exe", ["/c", __dirname + "\\embind.bat"], options) : spawn("bash", [__dirname + "/embind.sh"], options);

child.on("exit", code => {
    process.exit(code);
});

/* eslint quotes: [2, "single"], curly: 2 */

const path = require('path');
const {spawn} = require('child_process');
const waterfall = require('async/waterfall');
const which = require('which');

const isWindows = process.platform === 'win32' || process.env.OSTYPE === 'cygwin' || process.env.OSTYPE === 'msys';

const exec = (cmd, args, options, cb) => {
    const child = spawn(cmd, args, Object.assign({
        stdio: 'inherit'
    }, options));

    child.on('error', cb);
    child.on('exit', cb);
};

const bash = isWindows ? `${ process.env.WINDIR }\\System32\\bash.exe` : 'bash';
const cmd = which.sync('cmd.exe');
const ESC = isWindows ? '\\' : '';
const QUOTE = isWindows ? '"' : '';

waterfall([
    next => {
        exec(bash, ['-c', [
            `export NVS_HOME="${ ESC }$HOME/.nvs"`,
            `[ ! -s "${ ESC }$NVS_HOME/nvs.sh" ] || . "${ ESC }$NVS_HOME/nvs.sh"`,
            'nvs use latest',
            'prebuildify --napi',
        ].join(' && ')], {
            cwd: path.resolve(__dirname, '..'),
        }, next);
    },

    (signal, next) => {
        exec(cmd, ['/s', '/c', `${ QUOTE }nvs use latest && prebuildify --napi${ QUOTE }`], {
            windowsVerbatimArguments: true,
            cwd: path.resolve(__dirname, '..')
        }, next);
    },
], err => {
    if (err) {
        if (typeof err === 'number') {
            process.exit(err);
        }
        throw err;
    }
});

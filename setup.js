const process = require('process');
const child = require('child_process');
child.execSync(`npm --prefix ${__dirname} ci`, {stdio: 'inherit'});
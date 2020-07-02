const child = require('child_process');
child.execSync('npm ci', {stdio: 'inherit'});

import { createRequire } from 'module'; 
import path from 'path'; 
// Absolute path to node modules (or native addons)
const modulesPath = path.resolve(process.cwd(), 'node_modules');


const require = createRequire(modulesPath);
const Nodehun = require('nodehun');

module.exports = Nodehun;


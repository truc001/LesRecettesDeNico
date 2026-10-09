// Loads the project's TypeScript modules in plain Node: transpiles them on
// require and resolves the "@/" alias from the repository root.
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const root = path.join(__dirname, '..');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
 return resolveFilename.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
 module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, filename);
};
module.exports = name => require(path.join(root, name));

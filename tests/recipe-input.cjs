const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const path = require('node:path');
const source = path.join(__dirname, '../lib/recipe-input.ts');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleUnderTest = new Module(source);
moduleUnderTest._compile(compiled, source);
const { parseRecipeInput, parseRecipeTag, assertAllowedKeys } = moduleUnderTest.exports;
const valid = { title:'Tarte aux pommes',category:'Dessert',description:'Une tarte maison',duration:'45 min',servings:'6 personnes',ingredients:'Pommes\nFarine',steps:'Mélanger\nCuire',contributor:'Nico',emoji:'assiette' };

test('normalizes safe recipe text without interpreting it', () => {
 const result = parseRecipeInput({...valid,title:'  Tarte aux pommes  ',ingredients:'Pommes\r\nFarine'},true);
 assert.equal(result.title,'Tarte aux pommes');
 assert.equal(result.ingredients,'Pommes\nFarine');
});

test('turns pasted tabs into spaces, which the Firestore rules accept', () => {
 assert.equal(parseRecipeInput({...valid,ingredients:'Farine\t\t200 g\nSucre\t50 g'},true).ingredients,'Farine 200 g\nSucre 50 g');
});

test('rejects markup, executable protocols and hidden controls', () => {
 for (const title of ['<script>alert(1)</script>','javascript:alert(1)','Tarte\u202Ecachée','Tarte`code`']) {
  assert.throws(()=>parseRecipeInput({...valid,title},true),/caractères interdits/);
 }
});

test('rejects oversized, multiline single-line and incomplete content', () => {
 assert.throws(()=>parseRecipeInput({...valid,title:'x'.repeat(201)},true),/trop long/);
 assert.throws(()=>parseRecipeInput({...valid,category:'Plat\nDessert'},true),/une seule ligne/);
 assert.throws(()=>parseRecipeInput({...valid,ingredients:'x'},true),/trop court/);
});

test('accepts a short optional tag and refuses unsafe ones', () => {
 assert.equal(parseRecipeTag('  deNico '),'deNico');
 assert.equal(parseRecipeTag(undefined),'');
 assert.throws(()=>parseRecipeTag('x'.repeat(41)),/trop long/);
 assert.throws(()=>parseRecipeTag('<b>'),/caractères interdits/);
});

test('rejects schema pollution', () => {
 assert.throws(()=>assertAllowedKeys({...valid,role:'admin'},Object.keys(valid)),/champs non autorisés/);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const path = require('node:path');
const source = path.join(__dirname, '../lib/firestore-recipes.ts');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleUnderTest = new Module(source);
moduleUnderTest._compile(compiled, source);
const store = moduleUnderTest.exports;
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-nico-firestore';
const doc = id => ({ name: 'projects/demo/databases/(default)/documents/recipes/'+id, fields: {title:{stringValue:'Recette '+id},featured:{booleanValue:true},createdAt:{timestampValue:'2026-09-13T00:00:00Z'}} });
const values = { title:'Test',category:'Pâtisserie',description:'Description',duration:'20 min',servings:'4',emoji:'cookie',ingredients:'Farine',steps:'Mélanger' };
test('listing follows every Firestore page and does not use a static fallback', async t => {
 const calls=[];
 t.mock.method(globalThis,'fetch',async url=>{
  calls.push(String(url));
  return Response.json(calls.length===1?{documents:[doc('a')],nextPageToken:'next+page'}:{documents:[doc('b')]});
 });
 const recipes=await store.listFirestoreRecipes();
 assert.deepEqual(recipes.map(r=>r.id),['a','b']);
 assert.equal(new URL(calls[1]).searchParams.get('pageToken'),'next+page');
 assert.equal(recipes[0].featured,true);
});
test('an empty Firestore database stays empty', async t => {
 t.mock.method(globalThis,'fetch',async()=>Response.json({}));
 assert.deepEqual(await store.listFirestoreRecipes(),[]);
});
test('writes use the caller token and update only editable fields', async t => {
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url:String(url),options});return Response.json(doc('a'));});
 await store.createFirestoreRecipe(values,'Bearer firebase-user-token');
 await store.updateFirestoreRecipe('notion-super-cookies',values,'Bearer firebase-user-token');
 assert.equal(calls[0].options.headers.Authorization,'Bearer firebase-user-token');
 assert.equal(JSON.parse(calls[0].options.body).fields.featured.booleanValue,false);
 const url = new URL(calls[1].url);
 assert.equal(url.searchParams.get('currentDocument.exists'),'true');
 assert.deepEqual(url.searchParams.getAll('updateMask.fieldPaths'),Object.keys(values));
 assert.ok(!('createdAt' in JSON.parse(calls[1].options.body).fields));
 assert.ok(!('featured' in JSON.parse(calls[1].options.body).fields));
});
test('Firestore errors propagate rather than reporting successful saves', async t => {
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:'denied'},{status:403}));
 await assert.rejects(store.updateFirestoreRecipe('a',values,'Bearer wrong'),e=>e.status===403);
 await assert.rejects(store.listFirestoreRecipes(),e=>e.status===403);
});

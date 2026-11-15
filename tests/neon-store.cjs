// Runs the real data access code of lib/ and the migration script against an
// in-memory Postgres (PGlite) loaded with db/schema.sql.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./load-ts.cjs');
const db = load('lib/db.ts');
const recipes = load('lib/recipes-store.ts');
const submissions = load('lib/submissions-store.ts');
const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
let pg;
const sql = async (text, params = []) => (await pg.query(text, params)).rows;
before(async () => {
 const { PGlite } = await import('@electric-sql/pglite');
 pg = new PGlite();
 await pg.exec(schema);
 db.setDatabaseForTests(sql);
});
const values = { title:'Tarte du test',category:'Dessert',description:'Une tarte',duration:'45 min',servings:'6 personnes',emoji:'🍽️',ingredients:'Pommes\nFarine',steps:'Mélanger\nCuire',contributor:'Nico' };
const status = expected => error => error instanceof db.StoreError && error.status === expected;

test('recipes are created, edited, listed and deleted', async () => {
 const created = await recipes.createRecipe(values);
 assert.match(created.id, /^[a-zA-Z0-9_-]{1,128}$/);
 assert.equal(created.featured, false);
 assert.match(created.createdAt, /^\d{4}-\d\d-\d\dT/);
 const updated = await recipes.updateRecipe(created.id, { ...values, title:'Tarte renommée', tag:'deNico', featured:true });
 assert.equal(updated.featured, true);
 assert.equal(updated.tag, 'deNico');
 assert.equal(updated.createdAt, created.createdAt);
 const cleared = await recipes.updateRecipe(created.id, { tag:'', contributor:'' });
 assert.equal(cleared.tag, undefined);
 assert.equal(cleared.contributor, undefined);
 assert.equal(cleared.title, 'Tarte renommée');
 assert.ok((await recipes.listRecipes()).some(recipe => recipe.id === created.id));
 await recipes.deleteRecipe(created.id);
 assert.ok(!(await recipes.listRecipes()).some(recipe => recipe.id === created.id));
 await assert.rejects(recipes.deleteRecipe(created.id), status(404));
 await assert.rejects(recipes.updateRecipe(created.id, values), status(404));
});

test('newest recipes come first', async () => {
 await sql("insert into recipes (id,title,category,description,duration,servings,emoji,created_at) values ('old','Ancienne','Dessert','d','1 h','4','🍰','2026-01-01'),('new','Récente','Dessert','d','1 h','4','🍰','2026-12-01')");
 const ids = (await recipes.listRecipes()).map(recipe => recipe.id);
 assert.ok(ids.indexOf('new') < ids.indexOf('old'));
});

test('the schema refuses text the site would never write', async () => {
 await assert.rejects(recipes.createRecipe({ ...values, title:'<script>' }), status(400));
 await assert.rejects(recipes.createRecipe({ ...values, steps:'Cliquer javascript: ici' }), status(400));
 await assert.rejects(recipes.createRecipe({ ...values, description:'Tab\there' }), status(400));
 await assert.rejects(recipes.createRecipe({ ...values, title:'x'.repeat(201) }), status(400));
 await recipes.createRecipe({ ...values, steps:'Une ligne\nUne autre « avec » des guillemets – et un tiret' });
});

test('each account may propose 5 recipes per 24 hours', async () => {
 const ids = [];
 for (let i = 1; i <= 5; i++) ids.push((await submissions.createSubmission({ ...values, title:'Proposition '+i }, 'viewer')).id);
 await assert.rejects(submissions.createSubmission(values, 'viewer'), status(429));
 assert.equal((await sql("select count(*)::int n from recipe_submissions where submitter_uid = 'viewer'"))[0].n, 5);
 await submissions.createSubmission(values, 'someone-else');
 await sql("update submission_limits set window_start = now() - interval '25 hours' where submitter_uid = 'viewer'");
 await submissions.createSubmission(values, 'viewer');
 assert.equal((await sql("select count from submission_limits where submitter_uid = 'viewer'"))[0].count, 1);
 const mine = (await submissions.listSubmissions()).filter(submission => submission.submitterUid === 'viewer');
 assert.equal(mine.length, 6);
 assert.equal(mine[0].contributor, 'Nico');

 assert.deepEqual(await submissions.moderateSubmission(ids[0], 'reject'), {});
 await assert.rejects(submissions.moderateSubmission(ids[0], 'reject'), status(404));
 const approved = await submissions.moderateSubmission(ids[1], 'approve');
 assert.equal(approved.recipe.id, 'community-'+ids[1]);
 assert.equal(approved.recipe.contributor, 'Nico');
 assert.ok((await recipes.listRecipes()).some(recipe => recipe.id === approved.recipe.id));
 await assert.rejects(submissions.moderateSubmission(ids[1], 'approve'), status(404));
 assert.ok(!(await submissions.listSubmissions()).some(submission => [ids[0], ids[1]].includes(submission.id)));
});

test('a burst of proposals cannot exceed the limit', async () => {
 const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => submissions.createSubmission({ ...values, title:'Rafale '+i }, 'burst')));
 assert.equal(results.filter(result => result.status === 'fulfilled').length, 5);
});

test('the migration copies Firestore, then refreshes it on a second run', async () => {
 const { migrate } = await import('../tools/migrate-to-neon.mjs');
 const doc = (id, fields) => ({ name: 'projects/p/databases/(default)/documents/x/'+id, createTime: '2026-09-13T17:35:13Z', fields });
 const s = value => ({ stringValue: value });
 let title = 'Cake citron';
 const firestore = async url => {
  const collection = new URL(url).pathname.split('/').at(-1);
  const pages = {
   recipes: [doc('notion-cake', { title:s(title), category:s('Pâtisserie'), description:s('Un cake'), duration:s('50 min'), servings:s('À préciser'), emoji:s('🍋'), ingredients:s('Farine'), steps:s('Cuire'), tag:s('deNico'), contributor:s(''), featured:{booleanValue:true}, createdAt:{timestampValue:'2026-09-13T17:35:13.999Z'} })],
   recipeSubmissions: [doc('sub-1', { ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, s(v)])), status:s('pending'), submitterUid:s('uid-1'), createdAt:{timestampValue:'2026-11-12T08:00:00Z'} })],
   submissionLimits: [doc('uid-1', { count:{integerValue:'1'}, windowStart:{timestampValue:new Date().toISOString()}, lastAt:{timestampValue:new Date().toISOString()} })],
  };
  return Response.json({ documents: pages[collection] });
 };
 const report = await migrate({ query: sql, fetch: firestore, accessToken: 'token', schema, log: () => {} });
 assert.equal(report.recipes, 1);
 assert.equal(report.submissions, 1);
 title = 'Cake citron pavot';
 await migrate({ query: sql, fetch: firestore, accessToken: 'token', schema, log: () => {} });
 const cake = (await recipes.listRecipes()).find(recipe => recipe.id === 'notion-cake');
 assert.equal(cake.title, 'Cake citron pavot');
 assert.equal(cake.tag, 'deNico');
 assert.equal(cake.contributor, undefined);
 assert.equal(cake.featured, true);
 assert.equal(cake.createdAt, '2026-09-13T17:35:13.999Z');
 assert.ok((await submissions.listSubmissions()).some(submission => submission.id === 'sub-1' && submission.submitterUid === 'uid-1'));
});

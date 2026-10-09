// Runs the real Firestore access code of lib/ against the emulator and the
// real security rules. Started by "npm run test:emulator".
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs');
const project = 'demo-nico-firestore';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = project;
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:' + (process.env.TEST_FIRESTORE_PORT || '8085');
const recipes = load('lib/firestore-recipes.ts');
const submissions = load('lib/firestore-submissions.ts');
function bearer(email, uid) {
 const b = v => Buffer.from(JSON.stringify(v)).toString('base64url');
 const now = Math.floor(Date.now()/1000);
 return 'Bearer '+b({alg:'none',typ:'JWT'})+'.'+b({iss:'https://securetoken.google.com/'+project,aud:project,iat:now,exp:now+3600,auth_time:now,sub:uid,user_id:uid,email,email_verified:true,firebase:{sign_in_provider:'google.com',identities:{}}})+'.';
}
const admin = bearer('appcraft31@gmail.com','lib-admin');
const viewer = bearer('lib-viewer@example.com','lib-viewer');
const values = { title:'Tarte du test',category:'Dessert',description:'Une tarte',duration:'45 min',servings:'6 personnes',emoji:'🍽️',ingredients:'Pommes\nFarine',steps:'Mélanger\nCuire',contributor:'Nico' };
const status = expected => error => error.status === expected;
(async()=>{
 assert.equal(await submissions.isFirestoreAdmin(admin), true);
 assert.equal(await submissions.isFirestoreAdmin(viewer), false);

 const created = await recipes.createFirestoreRecipe(values, admin);
 assert.match(created.id, /^[a-zA-Z0-9_-]{1,128}$/);
 assert.equal(created.featured, false);
 assert.equal((await recipes.updateFirestoreRecipe(created.id, {...values, title:'Tarte renommée', featured:true}, admin)).featured, true);
 assert.ok((await recipes.listFirestoreRecipes()).some(recipe => recipe.id === created.id && recipe.title === 'Tarte renommée'));
 await assert.rejects(recipes.createFirestoreRecipe(values, viewer), status(403));
 await assert.rejects(recipes.updateFirestoreRecipe(created.id, values, viewer), status(403));
 await assert.rejects(recipes.deleteFirestoreRecipe(created.id, viewer), status(403));
 await recipes.deleteFirestoreRecipe(created.id, admin);
 assert.ok(!(await recipes.listFirestoreRecipes()).some(recipe => recipe.id === created.id));
 await assert.rejects(recipes.deleteFirestoreRecipe(created.id, admin), status(404));

 const ids = [];
 for (let i = 1; i <= 5; i++) ids.push((await submissions.createFirestoreSubmission({...values, title:'Proposition '+i}, 'lib-viewer', viewer)).id);
 await assert.rejects(submissions.createFirestoreSubmission(values, 'lib-viewer', viewer), status(429));
 await assert.rejects(submissions.createFirestoreSubmission(values, 'someone-else', viewer), status(403));
 await assert.rejects(submissions.listFirestoreSubmissions(viewer), status(403));
 const mine = async () => (await submissions.listFirestoreSubmissions(admin)).filter(submission => submission.submitterUid === 'lib-viewer');
 assert.equal((await mine()).length, 5);

 await assert.rejects(submissions.moderateFirestoreSubmission(ids[0], 'reject', viewer), status(403));
 assert.deepEqual(await submissions.moderateFirestoreSubmission(ids[0], 'reject', admin), {});
 const approved = await submissions.moderateFirestoreSubmission(ids[1], 'approve', admin);
 assert.equal(approved.recipe.id, 'community-'+ids[1]);
 assert.ok((await recipes.listFirestoreRecipes()).some(recipe => recipe.id === approved.recipe.id && recipe.contributor === 'Nico'));
 await assert.rejects(submissions.moderateFirestoreSubmission(ids[1], 'approve', admin), status(404));
 assert.deepEqual((await mine()).map(submission => submission.id).sort(), ids.slice(2).sort());
 console.log('Accès Firestore de lib/ vérifié dans l’émulateur.');
})().catch(e=>{console.error(e);process.exit(1)});

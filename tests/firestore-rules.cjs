const assert = require('node:assert/strict');
const project = 'demo-nico-firestore';
const port = process.env.TEST_FIRESTORE_PORT || '8085';
const base = 'http://127.0.0.1:'+port+'/v1/projects/'+project+'/databases/(default)/documents';
function token(email, verified=true, provider='google.com', uid='test-user') {
 const b = v => Buffer.from(JSON.stringify(v)).toString('base64url');
 const now = Math.floor(Date.now()/1000);
 return b({alg:'none',typ:'JWT'})+'.'+b({iss:'https://securetoken.google.com/'+project,aud:project,iat:now,exp:now+3600,auth_time:now,sub:uid,user_id:uid,email,email_verified:verified,firebase:{sign_in_provider:provider,identities:{}}})+'.';
}
const admin = token('appcraft31@gmail.com');
const fields = {
 title:{stringValue:'Test local'},category:{stringValue:'Pâtisserie'},description:{stringValue:'Recette de test'},
 duration:{stringValue:'20 min'},servings:{stringValue:'4 pers.'},emoji:{stringValue:'cookie'},
 ingredients:{stringValue:'Farine'},steps:{stringValue:'Mélanger'},featured:{booleanValue:false},createdAt:{timestampValue:new Date().toISOString()}
};
const submissionFields = {
 title:{stringValue:'Tarte communautaire'},category:{stringValue:'Pâtisserie'},description:{stringValue:'Recette proposée'},
 duration:{stringValue:'40 min'},servings:{stringValue:'6 personnes'},emoji:{stringValue:'assiette'},
 ingredients:{stringValue:'Farine\nPommes'},steps:{stringValue:'Mélanger\nCuire'},contributor:{stringValue:'Nico'},
 submitterUid:{stringValue:'viewer-one'},status:{stringValue:'pending'},createdAt:{timestampValue:new Date().toISOString()}
};
const results=[];
async function check(name, method, path, auth, body, expected) {
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();
 assert.equal(response.status,expected,name+': '+JSON.stringify(data));
 results.push({name,status:response.status});
}
(async()=>{
 await fetch(base+'/recipes/valid',{method:'DELETE',headers:{Authorization:'Bearer owner'}});
 await check('anonymous create denied','POST','/recipes?documentId=public',null,{fields},403);
 await check('other Google account denied','POST','/recipes?documentId=other',token('other@example.com'),{fields},403);
 await check('unverified administrator denied','POST','/recipes?documentId=unverified',token('appcraft31@gmail.com',false),{fields},403);
 await check('non-Google provider denied','POST','/recipes?documentId=password',token('appcraft31@gmail.com',true,'password'),{fields},403);
 await check('admin creates recipe','POST','/recipes?documentId=valid',admin,{fields},200);
 await check('public reads recipe','GET','/recipes/valid',null,null,200);
 await check('public lists recipes','GET','/recipes?pageSize=100',null,null,200);
 await check('admin updates title','PATCH','/recipes/valid?updateMask.fieldPaths=title&currentDocument.exists=true',admin,{fields:{title:{stringValue:'Nouveau titre'}}},200);
 await check('anonymous update denied','PATCH','/recipes/valid?updateMask.fieldPaths=title',null,{fields:{title:{stringValue:'Intrusion'}}},403);
 await check('other user update denied','PATCH','/recipes/valid?updateMask.fieldPaths=title',token('other@example.com'),{fields:{title:{stringValue:'Intrusion'}}},403);
 await check('missing required field denied','PATCH','/recipes/valid?updateMask.fieldPaths=title',admin,{fields:{}},403);
 await check('oversized update denied','PATCH','/recipes/valid?updateMask.fieldPaths=steps',admin,{fields:{steps:{stringValue:'x'.repeat(4001)}}},403);
 await check('wrong field type denied','PATCH','/recipes/valid?updateMask.fieldPaths=title',admin,{fields:{title:{integerValue:'12'}}},403);
 await check('additional field denied','PATCH','/recipes/valid?updateMask.fieldPaths=role',admin,{fields:{role:{stringValue:'admin'}}},403);
 await check('immutable creation timestamp','PATCH','/recipes/valid?updateMask.fieldPaths=createdAt',admin,{fields:{createdAt:{timestampValue:'2020-01-01T00:00:00Z'}}},403);
 await check('immutable source ID','PATCH','/recipes/valid?updateMask.fieldPaths=sourceId',admin,{fields:{sourceId:{stringValue:'hijack'}}},403);
 await check('missing recipe is not recreated','PATCH','/recipes/missing?currentDocument.exists=true',admin,{fields},403);
 await check('admin tags recipe','PATCH','/recipes/valid?updateMask.fieldPaths=tag&currentDocument.exists=true',admin,{fields:{tag:{stringValue:'deNico'}}},200);
 await check('oversized tag denied','PATCH','/recipes/valid?updateMask.fieldPaths=tag',admin,{fields:{tag:{stringValue:'x'.repeat(41)}}},403);
 await check('markup in tag denied','PATCH','/recipes/valid?updateMask.fieldPaths=tag',admin,{fields:{tag:{stringValue:'<b>'}}},403);
 await check('submission cannot carry a tag','POST',':commit',token('viewer@example.com',true,'google.com','viewer-zero'),{writes:[{update:{name:'projects/'+project+'/databases/(default)/documents/recipeSubmissions/tagged',fields:{...submissionFields,submitterUid:{stringValue:'viewer-zero'},tag:{stringValue:'deNico'}}}},{update:{name:'projects/'+project+'/databases/(default)/documents/submissionLimits/viewer-zero',fields:{count:{integerValue:'1'},lastSubmissionId:{stringValue:'tagged'}}},updateTransforms:[{fieldPath:'lastAt',setToServerValue:'REQUEST_TIME'},{fieldPath:'windowStart',setToServerValue:'REQUEST_TIME'}]}]},403);
 await check('admin toggles featured','PATCH','/recipes/valid?updateMask.fieldPaths=featured&currentDocument.exists=true',admin,{fields:{featured:{booleanValue:true}}},200);
 await check('anonymous deletion denied','DELETE','/recipes/valid',null,null,403);
 await check('other user deletion denied','DELETE','/recipes/valid',token('other@example.com'),null,403);
 await check('private collection denied','GET','/users',admin,null,403);
 await check('nested collection denied','GET','/recipes/valid/private',admin,null,403);
 await check('invalid document ID denied','POST','/recipes?documentId=bad.id',admin,{fields},403);
 await check('old creation timestamp denied','POST','/recipes?documentId=old',admin,{fields:{...fields,createdAt:{timestampValue:'2020-01-01T00:00:00Z'}}},403);
 await check('oversized creation denied','POST','/recipes?documentId=big',admin,{fields:{...fields,ingredients:{stringValue:'x'.repeat(4001)}}},403);
 await check('tab character denied','POST','/recipes?documentId=tab',admin,{fields:{...fields,ingredients:{stringValue:'Farine\t200 g'}}},403);
 await check('admin deletes recipe','DELETE','/recipes/valid?currentDocument.exists=true',admin,null,200);
 await check('deleted recipe is gone','GET','/recipes/valid',null,null,404);
 const viewer = token('viewer@example.com',true,'google.com','viewer-one');
 const otherViewer = token('other@example.com',true,'google.com','viewer-two');
 const docs='projects/'+project+'/databases/(default)/documents/';
 // Same two writes as createFirestoreSubmission in lib/firestore-submissions.ts.
 const submit=(id,{uid='viewer-one',count=1,windowStart,limitUid=uid,limitId=id,submission={},precondition}={})=>({writes:[
  {update:{name:docs+'recipeSubmissions/'+id,fields:{...submissionFields,submitterUid:{stringValue:uid},...submission}},currentDocument:{exists:false}},
  {update:{name:docs+'submissionLimits/'+limitUid,fields:{count:{integerValue:String(count)},lastSubmissionId:{stringValue:limitId},...(windowStart?{windowStart:{timestampValue:windowStart}}:{})}},
   updateTransforms:[{fieldPath:'lastAt',setToServerValue:'REQUEST_TIME'},...(windowStart?[]:[{fieldPath:'windowStart',setToServerValue:'REQUEST_TIME'}])],
   ...(precondition?{currentDocument:precondition}:{})}
 ]});
 await check('anonymous submission denied','POST',':commit',null,submit('anonymous'),403);
 await check('password account submission denied','POST',':commit',token('viewer@example.com',true,'password','viewer-one'),submit('password-user'),403);
 await check('unverified account submission denied','POST',':commit',token('viewer@example.com',false,'google.com','viewer-one'),submit('unverified-user'),403);
 await check('spoofed submitter UID denied','POST',':commit',viewer,submit('spoofed',{uid:'victim',limitUid:'viewer-one'}),403);
 await check('markup in submission denied','POST',':commit',viewer,submit('markup',{submission:{title:{stringValue:'Tarte <script>'}}}),403);
 await check('executable protocol in submission denied','POST',':commit',viewer,submit('protocol',{submission:{steps:{stringValue:'Préparer\njavascript:alert(1)'}}}),403);
 await check('hidden bidi control denied','POST',':commit',viewer,submit('hidden',{submission:{title:{stringValue:'Tarte ‮ cachée'}}}),403);
 await check('oversized submission denied','POST',':commit',viewer,submit('huge',{submission:{steps:{stringValue:'x'.repeat(4001)}}}),403);
 await check('pre-approved submission denied','POST',':commit',viewer,submit('approved',{submission:{status:{stringValue:'approved'}}}),403);
 await check('submission without its counter denied','POST','/recipeSubmissions?documentId=uncounted',viewer,{fields:submissionFields},403);
 await check('counter pointing at another submission denied','POST',':commit',viewer,submit('mismatch',{limitId:'elsewhere'}),403);
 await check('counter of another account denied','POST',':commit',viewer,submit('borrowed',{limitUid:'viewer-two'}),403);
 await check('counter not starting at one denied','POST',':commit',viewer,submit('skipped',{count:0}),403);
 await check('Google viewer creates pending submission','POST',':commit',viewer,submit('submission-1'),200);
 await check('counter without a new submission denied','PATCH','/submissionLimits/viewer-one',viewer,{fields:{count:{integerValue:'1'},lastSubmissionId:{stringValue:'submission-1'},lastAt:{timestampValue:new Date().toISOString()},windowStart:{timestampValue:new Date().toISOString()}}},403);
 await check('counter deletion denied','DELETE','/submissionLimits/viewer-one',viewer,null,403);
 await check('other viewer cannot read counter','GET','/submissionLimits/viewer-one',otherViewer,null,403);
 const limitResponse=await fetch(base+'/submissionLimits/viewer-one',{headers:{Authorization:'Bearer '+viewer}});
 const limit=await limitResponse.json();
 assert.equal(limitResponse.status,200,'owner reads own counter: '+JSON.stringify(limit));
 assert.equal(limit.fields.count.integerValue,'1');
 const windowStart=limit.fields.windowStart.timestampValue;
 await check('counter cannot be reset inside the window','POST',':commit',viewer,submit('reset'),403);
 await check('counter cannot stay still','POST',':commit',viewer,submit('still',{count:1,windowStart}),403);
 await check('counter cannot move the window','POST',':commit',viewer,submit('moved',{count:2,windowStart:new Date(Date.now()-60000).toISOString()}),403);
 for (const count of [2,3,4,5]) await check('submission '+count+' of the day accepted','POST',':commit',viewer,submit('submission-'+count,{count,windowStart}),200);
 await check('sixth submission of the day denied','POST',':commit',viewer,submit('submission-6',{count:6,windowStart}),403);
 await check('other viewer has an independent counter','POST',':commit',otherViewer,submit('other-1',{uid:'viewer-two'}),200);
 await check('submitter cannot read own submission','GET','/recipeSubmissions/submission-1',viewer,null,403);
 await check('other viewer cannot read submission','GET','/recipeSubmissions/submission-1',otherViewer,null,403);
 await check('admin reads submission','GET','/recipeSubmissions/submission-1',admin,null,200);
 await check('admin probe lists submissions','GET','/recipeSubmissions?pageSize=1&mask.fieldPaths=status',admin,null,200);
 await check('admin probe denied to viewer','GET','/recipeSubmissions?pageSize=1&mask.fieldPaths=status',viewer,null,403);
 const pending={structuredQuery:{from:[{collectionId:'recipeSubmissions'}],where:{fieldFilter:{field:{fieldPath:'status'},op:'EQUAL',value:{stringValue:'pending'}}},limit:100}};
 await check('admin queries pending submissions','POST',':runQuery',admin,pending,200);
 await check('viewer cannot query submissions','POST',':runQuery',viewer,pending,403);
 await check('submitter cannot update submission','PATCH','/recipeSubmissions/submission-1?updateMask.fieldPaths=title',viewer,{fields:{title:{stringValue:'Intrusion'}}},403);
 await check('admin cannot rewrite submitted content','PATCH','/recipeSubmissions/submission-1?updateMask.fieldPaths=title',admin,{fields:{title:{stringValue:'Réécriture'}}},403);
 await check('submitter cannot delete submission','DELETE','/recipeSubmissions/submission-1',viewer,null,403);
 await check('admin rejects submission by deleting it','POST',':commit',admin,{writes:[{delete:docs+'recipeSubmissions/submission-1'}]},200);
 await check('rejected submission is gone','GET','/recipeSubmissions/submission-1',admin,null,404);
 await check('rejected submission cannot be replayed','POST','/recipeSubmissions?documentId=submission-1',viewer,{fields:submissionFields},403);
 await check('approval atomically publishes recipe','POST',':commit',admin,{writes:[
  {update:{name:docs+'recipes/community-submission-2',fields:{
   title:submissionFields.title,category:submissionFields.category,description:submissionFields.description,
   duration:submissionFields.duration,servings:submissionFields.servings,emoji:submissionFields.emoji,
   ingredients:submissionFields.ingredients,steps:submissionFields.steps,contributor:{stringValue:''},
   featured:{booleanValue:false},createdAt:{timestampValue:new Date().toISOString()}
  }},currentDocument:{exists:false}},
  {delete:docs+'recipeSubmissions/submission-2'}
 ]},200);
 await check('approved recipe is publicly readable','GET','/recipes/community-submission-2',null,null,200);
 await check('approved submission is gone','GET','/recipeSubmissions/submission-2',admin,null,404);
 await check('viewer cannot publish a recipe','POST',':commit',viewer,{writes:[{update:{name:docs+'recipes/community-intrusion',fields}}]},403);
 console.log(results.length+' vérifications des règles réussies.');
})().catch(e=>{console.error(e);process.exit(1)});

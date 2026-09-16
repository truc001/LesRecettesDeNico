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
 await check('deletion denied even to admin','DELETE','/recipes/valid',admin,null,403);
 await check('private collection denied','GET','/users',admin,null,403);
 await check('nested collection denied','GET','/recipes/valid/private',admin,null,403);
 await check('invalid document ID denied','POST','/recipes?documentId=bad.id',admin,{fields},403);
 await check('old creation timestamp denied','POST','/recipes?documentId=old',admin,{fields:{...fields,createdAt:{timestampValue:'2020-01-01T00:00:00Z'}}},403);
 await check('oversized creation denied','POST','/recipes?documentId=big',admin,{fields:{...fields,ingredients:{stringValue:'x'.repeat(4001)}}},403);
 const viewer = token('viewer@example.com',true,'google.com','viewer-one');
 const otherViewer = token('other@example.com',true,'google.com','viewer-two');
 await check('anonymous submission denied','POST','/recipeSubmissions?documentId=anonymous',null,{fields:submissionFields},403);
 await check('password account submission denied','POST','/recipeSubmissions?documentId=password-user',token('viewer@example.com',true,'password','viewer-one'),{fields:submissionFields},403);
 await check('unverified account submission denied','POST','/recipeSubmissions?documentId=unverified-user',token('viewer@example.com',false,'google.com','viewer-one'),{fields:submissionFields},403);
 await check('spoofed submitter UID denied','POST','/recipeSubmissions?documentId=spoofed',viewer,{fields:{...submissionFields,submitterUid:{stringValue:'victim'}}},403);
 await check('markup in submission denied','POST','/recipeSubmissions?documentId=markup',viewer,{fields:{...submissionFields,title:{stringValue:'Tarte <script>'}}},403);
 await check('executable protocol in submission denied','POST','/recipeSubmissions?documentId=protocol',viewer,{fields:{...submissionFields,steps:{stringValue:'Préparer\njavascript:alert(1)'}}},403);
 await check('hidden bidi control denied','POST','/recipeSubmissions?documentId=hidden',viewer,{fields:{...submissionFields,title:{stringValue:'Tarte \u202E cachée'}}},403);
 await check('oversized submission denied','POST','/recipeSubmissions?documentId=huge',viewer,{fields:{...submissionFields,steps:{stringValue:'x'.repeat(4001)}}},403);
 await check('Google viewer creates pending submission','POST','/recipeSubmissions?documentId=submission-one',viewer,{fields:submissionFields},200);
 await check('submitter cannot read own submission','GET','/recipeSubmissions/submission-one',viewer,null,403);
 await check('other viewer cannot read submission','GET','/recipeSubmissions/submission-one',otherViewer,null,403);
 await check('admin reads submission','GET','/recipeSubmissions/submission-one',admin,null,200);
 await check('admin lists submissions','GET','/recipeSubmissions?pageSize=100',admin,null,200);
 await check('submitter cannot update submission','PATCH','/recipeSubmissions/submission-one?updateMask.fieldPaths=title',viewer,{fields:{title:{stringValue:'Intrusion'}}},403);
 await check('admin cannot rewrite submitted content','PATCH','/recipeSubmissions/submission-one?updateMask.fieldPaths=title',admin,{fields:{title:{stringValue:'Réécriture'}}},403);
 await check('admin approves pending submission','PATCH','/recipeSubmissions/submission-one?updateMask.fieldPaths=status&updateMask.fieldPaths=reviewedAt&updateMask.fieldPaths=recipeId',admin,{fields:{status:{stringValue:'approved'},reviewedAt:{timestampValue:new Date().toISOString()},recipeId:{stringValue:'community-submission-one'}}},200);
 await check('approved submission cannot be reviewed twice','PATCH','/recipeSubmissions/submission-one?updateMask.fieldPaths=status',admin,{fields:{status:{stringValue:'rejected'}}},403);
 await check('submission deletion denied to admin','DELETE','/recipeSubmissions/submission-one',admin,null,403);
 await check('second Google submission accepted','POST','/recipeSubmissions?documentId=submission-two',viewer,{fields:submissionFields},200);
 await check('admin rejects pending submission','PATCH','/recipeSubmissions/submission-two?updateMask.fieldPaths=status&updateMask.fieldPaths=reviewedAt&updateMask.fieldPaths=recipeId',admin,{fields:{status:{stringValue:'rejected'},reviewedAt:{timestampValue:new Date().toISOString()},recipeId:{stringValue:''}}},200);
 await check('third Google submission accepted','POST','/recipeSubmissions?documentId=submission-three',viewer,{fields:submissionFields},200);
 const reviewedAt = new Date().toISOString();
 await check('approval atomically publishes recipe','POST',':commit',admin,{writes:[
  {update:{name:'projects/'+project+'/databases/(default)/documents/recipes/community-submission-three',fields:{
   title:submissionFields.title,category:submissionFields.category,description:submissionFields.description,
   duration:submissionFields.duration,servings:submissionFields.servings,emoji:submissionFields.emoji,
   ingredients:submissionFields.ingredients,steps:submissionFields.steps,contributor:{stringValue:''},
   featured:{booleanValue:false},createdAt:{timestampValue:reviewedAt}
  }},currentDocument:{exists:false}},
  {update:{name:'projects/'+project+'/databases/(default)/documents/recipeSubmissions/submission-three',fields:{
   ...submissionFields,status:{stringValue:'approved'},reviewedAt:{timestampValue:reviewedAt},recipeId:{stringValue:'community-submission-three'}
  }}}
 ]},200);
 await check('approved recipe is publicly readable','GET','/recipes/community-submission-three',null,null,200);
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});

const assert = require('node:assert/strict');
const project = 'demo-nico-firestore';
const base = 'http://127.0.0.1:8085/v1/projects/'+project+'/databases/(default)/documents';
function token(email, verified=true, provider='google.com') {
 const b = v => Buffer.from(JSON.stringify(v)).toString('base64url');
 const now = Math.floor(Date.now()/1000);
 return b({alg:'none',typ:'JWT'})+'.'+b({iss:'https://securetoken.google.com/'+project,aud:project,iat:now,exp:now+3600,auth_time:now,sub:'test-user',user_id:'test-user',email,email_verified:verified,firebase:{sign_in_provider:provider,identities:{}}})+'.';
}
const admin = token('appcraft31@gmail.com');
const fields = {
 title:{stringValue:'Test local'},category:{stringValue:'Pâtisserie'},description:{stringValue:'Recette de test'},
 duration:{stringValue:'20 min'},servings:{stringValue:'4 pers.'},emoji:{stringValue:'cookie'},
 ingredients:{stringValue:'Farine'},steps:{stringValue:'Mélanger'},featured:{booleanValue:false},createdAt:{timestampValue:new Date().toISOString()}
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
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});

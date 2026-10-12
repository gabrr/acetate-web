import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import{runInNewContext}from'node:vm';
const source=await readFile(new URL('../public/auth-receive.js',import.meta.url),'utf8');
async function setup(authorized=true){
 const sent=[],sessions=[];let listener;
 const parent={postMessage:(data,origin)=>sent.push({data,origin})};
 const window={parent,addEventListener:(_,fn)=>listener=fn,removeEventListener(){},supabase:{createClient:()=>({auth:{setSession:async session=>{sessions.push(session);return {error:null}}}})}};
 await runInNewContext(source,{window,location:{hostname:'app.acetate.me'},crypto:{randomUUID:()=> 'test-nonce'},setTimeout:()=>1,clearTimeout(){},fetch:async path=>path==='/api/auth/config'?{ok:true,json:async()=>({landingOrigin:'https://www.acetate.me',url:'https://example.supabase.co',publishableKey:'public'})}:{ok:authorized}});
 return {sent,sessions,listener,parent};
}
test('handoff rejects wrong origin, wrong window, wrong nonce, and replay',async()=>{
 const x=await setup(),data={type:'acetate-auth-session',nonce:'test-nonce',access_token:'access',refresh_token:'refresh'};
 await x.listener({origin:'https://attacker.example',source:x.parent,data});
 await x.listener({origin:'https://www.acetate.me',source:{},data});
 await x.listener({origin:'https://www.acetate.me',source:x.parent,data:{...data,nonce:'wrong'}});
 assert.equal(x.sessions.length,0);
 await x.listener({origin:'https://www.acetate.me',source:x.parent,data});
 await x.listener({origin:'https://www.acetate.me',source:x.parent,data});
 assert.equal(x.sessions.length,1);assert.equal(x.sent.at(-1).data.type,'acetate-auth-complete');
 assert.equal(x.sent.at(-1).origin,'https://www.acetate.me');
});
test('handoff never persists a session when server authorization fails',async()=>{
 const x=await setup(false);await x.listener({origin:'https://www.acetate.me',source:x.parent,data:{type:'acetate-auth-session',nonce:'test-nonce',access_token:'access',refresh_token:'refresh'}});
 assert.equal(x.sessions.length,0);assert.equal(x.sent.at(-1).data.type,'acetate-auth-error');
});

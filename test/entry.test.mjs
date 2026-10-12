import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';
import {invited,requestAccess} from '../server/entry.mjs';
const env={AUTH_ALLOWED_EMAILS:'member@example.com',AUTH_SUPABASE_URL:'https://example.supabase.co',AUTH_SUPABASE_PUBLISHABLE_KEY:'public-test'};
const request={headers:{authorization:'Bearer test-token'}};
test('access fails closed without configuration or a bearer token',async()=>{
 assert.equal(await invited(request,{}),503);assert.equal(await invited({headers:{}},env),401);
});
test('access uses verified confirmed identity, not client-supplied profile',async()=>{
 for(const [user,status] of [[{email:'member@example.com',email_confirmed_at:'2026-01-01'},200],[{email:'outsider@example.com',email_confirmed_at:'2026-01-01'},403],[{email:'member@example.com'},403]]){
  assert.equal(await invited(request,env,async()=>({ok:true,json:async()=>user})),status);
 }
 assert.equal(await invited(request,env,async()=>({ok:false})),401);
});
function res(){return {writeHead(code){this.status=code;return this},end(body){this.body=JSON.parse(body)}}}
test('invitation validates data and does not return success when delivery fails',async()=>{
 const configured={RESEND_API_KEY:'test',REQUEST_ACCESS_NOTIFY_TO:'owner@example.com'};
 let response=res();await requestAccess(Readable.from(['{"name":"","email":"invalid"}']),response,configured,()=>{throw Error('must not send')});assert.equal(response.status,400);
 response=res();await requestAccess(Readable.from([JSON.stringify({name:'Preview',email:'test@example.com'})]),response,configured,async()=>({ok:false}));assert.equal(response.status,502);
 response=res();await requestAccess(Readable.from([JSON.stringify({name:'Preview',email:'test@example.com'})]),response,configured,async()=>({ok:true}));assert.equal(response.status,202);
});

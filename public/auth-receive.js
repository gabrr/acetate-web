(async()=>{
  if(window.parent===window)return;
  const response=await fetch('/api/auth/config',{cache:'no-store'});if(!response.ok)return;
  const settings=await response.json();
  const origin=settings.landingOrigin;
  if(!['https://www.acetate.me','https://acetate.me'].includes(origin)&&!(location.hostname==='127.0.0.1'&&/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)))return;
  const nonce=crypto.randomUUID();let received=false;
  const timer=setTimeout(()=>window.removeEventListener('message',receive),15000);
  async function receive(event){
    if(event.origin!==origin||event.source!==window.parent||event.data?.type!=='acetate-auth-session'||event.data.nonce!==nonce||received)return;
    received=true;clearTimeout(timer);window.removeEventListener('message',receive);
    try{
      const {access_token,refresh_token}=event.data;
      if(typeof access_token!=='string'||typeof refresh_token!=='string')throw Error();
      const authorized=await fetch('/api/auth/authorize',{headers:{Authorization:`Bearer ${access_token}`},cache:'no-store'});if(!authorized.ok)throw Error();
      const result=await fetch('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({access_token,refresh_token}),cache:'no-store'});if(!result.ok)throw Error();
      window.parent.postMessage({type:'acetate-auth-complete',nonce},origin);
    }catch{window.parent.postMessage({type:'acetate-auth-error',nonce},origin)}
  }
  window.addEventListener('message',receive);
  window.parent.postMessage({type:'acetate-auth-ready',nonce},origin);
})();

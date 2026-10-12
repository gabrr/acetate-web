const json=(res,status,body)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(body));
export async function invited(request,env=process.env,fetcher=fetch){
  const allowed=(env.AUTH_ALLOWED_EMAILS||env.NEXT_PUBLIC_ALLOWED_USER_EMAIL||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!allowed.length||!env.AUTH_SUPABASE_URL||!env.AUTH_SUPABASE_PUBLISHABLE_KEY)return 503;
  const token=request.headers.authorization;
  if(!token?.startsWith('Bearer '))return 401;
  try{
    const result=await fetcher(new URL('/auth/v1/user',env.AUTH_SUPABASE_URL),{headers:{Authorization:token,apikey:env.AUTH_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(10000)});
    if(!result.ok)return 401;
    const user=await result.json();return user.email_confirmed_at&&allowed.includes(user.email?.toLowerCase())?200:403;
  }catch{return 503}
}
export async function requestAccess(req,res,env=process.env,fetcher=fetch){
  if(!env.RESEND_API_KEY||!env.REQUEST_ACCESS_NOTIFY_TO){json(res,503,{error:'Invitation requests are unavailable.'});return}
  let raw='';try{for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096){json(res,413,{error:'Request too large.'});return}}}catch{json(res,400,{error:'Invalid request.'});return}
  let data;try{data=JSON.parse(raw)}catch{json(res,400,{error:'Invalid request.'});return}
  if(!data||typeof data!=='object'||Array.isArray(data)){json(res,400,{error:'Invalid request.'});return}
  const name=typeof data.name==='string'?data.name.trim():'',email=typeof data.email==='string'?data.email.trim():'';
  if(!name||name.length>100||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){json(res,400,{error:'Enter your name and email.'});return}
  try{
    // Preserve the existing owner notification; never claim a confirmation email was sent.
    const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.REQUEST_ACCESS_FROM||'Acetate <onboarding@updates.acetate.me>',to:[env.REQUEST_ACCESS_NOTIFY_TO],subject:'Acetate invitation request',text:`Name: ${name}\nEmail: ${email}`}),signal:AbortSignal.timeout(15000)});
    json(res,response.ok?202:502,response.ok?{message:'Request received.'}:{error:'Request could not be sent.'});
  }catch{json(res,502,{error:'Request could not be sent.'})}
}

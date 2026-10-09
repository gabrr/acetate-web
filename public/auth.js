const panel = document.querySelector('.account-panel');
const status = document.querySelector('#account-status');
const signIn = document.querySelector('#sign-in');
const signOut = document.querySelector('#sign-out');
const errorMessage = document.querySelector('#auth-error');
let client;

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

function render(session) {
  const signedIn = Boolean(session?.user);
  status.textContent = signedIn ? session.user.email || 'Signed in' : 'Sign in to your account';
  status.title = status.textContent;
  signIn.hidden = signedIn;
  signOut.hidden = !signedIn;
  signIn.disabled = false;
  signOut.disabled = false;
  panel.dataset.signedIn = String(signedIn);
  panel.setAttribute('aria-busy', 'false');
  window.dispatchEvent(new CustomEvent('acetate-auth', { detail: session }));
}

async function startSignIn() {
  showError('');
  signIn.disabled = true;
  panel.setAttribute('aria-busy', 'true');
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  } catch (error) {
    showError(error.message || 'Could not sign in. Please try again.');
    signIn.disabled = false;
    panel.setAttribute('aria-busy', 'false');
  }
}
signIn.addEventListener('click', startSignIn);

signOut.addEventListener('click', async () => {
  showError('');
  signOut.disabled = true;
  panel.setAttribute('aria-busy', 'true');
  try {
    const { error } = await client.auth.signOut();
    if (error) throw error;
    render(null);
  } catch (error) {
    showError(error.message || 'Could not sign out. Please try again.');
    signOut.disabled = false;
    panel.setAttribute('aria-busy', 'false');
  }
});

async function initialize() {
  try {
    const response = await fetch('/api/auth/config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load sign-in settings.');
    const { url, publishableKey } = await response.json();
    if (!url || !publishableKey) throw new Error('Sign-in is not configured yet.');
    if (!window.supabase) throw new Error('Could not load sign-in. Please refresh.');
    client = window.supabase.createClient(url, publishableKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    render(data.session);
    const authPath = ['/login', '/auth/callback'].includes(window.location.pathname);
    if (data.session && authPath) { window.location.replace('/'); return; }
    const callback = new URL(window.location.href);
    if (callback.searchParams.has('error_description')) {
      showError(callback.searchParams.get('error_description'));
      for (const key of ['error', 'error_code', 'error_description']) callback.searchParams.delete(key);
      window.history.replaceState({}, '', callback);
    }
    client.auth.onAuthStateChange((_event, session) => {
      render(session);
      if (session && authPath) window.location.replace('/');
    });
    if (!data.session && window.location.pathname === '/login') await startSignIn();
  } catch (error) {
    if (client) render(null);
    status.textContent = 'Sign-in unavailable';
    panel.setAttribute('aria-busy', 'false');
    showError(error.message || 'Could not load sign-in. Please refresh.');
  }
}

export const authReady = initialize();

export async function getSession() {
  await authReady;
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getAccessToken() {
  let session = await getSession();
  if (!session) throw new Error('Sign in to submit or follow a statement.');
  if (session.expires_at * 1000 < Date.now() + 60_000) {
    const { data, error } = await client.auth.refreshSession();
    if (error || !data.session) throw new Error('Your session expired. Please sign in again.');
    session = data.session;
  }
  return session.access_token;
}

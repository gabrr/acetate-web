import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/auth.js', import.meta.url), 'utf8');

async function mount({ session = null, configured = true, loginError = null } = {}) {
  const elements = new Map();
  const calls = [];
  let listener;
  for (const selector of ['.account-panel', '#account-status', '#sign-in', '#sign-out', '#auth-error']) {
    elements.set(selector, { hidden: false, disabled: true, dataset: {}, textContent: '', handlers: {},
      setAttribute() {}, addEventListener(event, handler) { this.handlers[event] = handler; } });
  }
  const auth = {
    async getSession() { return { data: { session }, error: null }; },
    onAuthStateChange(callback) { listener = callback; },
    async signInWithOAuth(options) { calls.push(options); return { error: loginError }; },
    async signOut() { listener('SIGNED_OUT', null); return { error: null }; },
  };
  runInNewContext(source.replace(/export /g, ''), {
    document: { querySelector: selector => elements.get(selector) },
    window: { dispatchEvent() {}, location: { assign: url => calls.push({redirect:url}), origin: 'http://127.0.0.1:3000', href: 'http://127.0.0.1:3000/' },
      supabase: { createClient: () => ({ auth }) } },
    fetch: async () => ({ ok: true, json: async () => ({ url: configured ? 'https://example.supabase.co' : '', publishableKey: configured ? 'sb_publishable_example' : '' }) }),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    URL,
  });
  await new Promise(resolve => setImmediate(resolve));
  return { elements, calls };
}

test('signed-out account opens the landing sign-in card', async () => {
  const { elements, calls } = await mount();
  assert.equal(elements.get('#sign-in').disabled, false);
  await elements.get('#sign-in').handlers.click();
  assert.equal(calls[0].redirect, 'https://www.acetate.me/#sign-in');
});

test('restored session shows identity and sign-out clears the account panel', async () => {
  const { elements } = await mount({ session: { user: { email: 'user@example.com' } } });
  assert.equal(elements.get('#account-status').textContent, 'user@example.com');
  assert.equal(elements.get('#sign-in').hidden, true);
  assert.equal(elements.get('#sign-out').hidden, false);
  await elements.get('#sign-out').handlers.click();
  assert.equal(elements.get('#sign-in').hidden, false);
  assert.equal(elements.get('#sign-out').hidden, true);
});

test('missing configuration cannot initiate sign-in and reports why', async () => {
  const { elements } = await mount({ configured: false });
  assert.equal(elements.get('#sign-in').disabled, true);
  assert.equal(elements.get('#auth-error').textContent, 'Sign-in is not configured yet.');
});

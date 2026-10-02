import { apiClient } from './client';
import { authApi } from './auth';
import { CLIENTS } from '../data/clients';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalize = (text) => String(text).toLowerCase().replace(/[^a-z0-9]/g, '');

// The caller's clients from /auth/me, fetched once per sign-in: a different
// token means a different user, who may hold different clients.
let cache = { token: null, clients: null };

async function serverClients() {
  const token = apiClient.getToken();
  if (cache.token !== token || !cache.clients) {
    cache = {
      token,
      clients: authApi
        .getMe()
        .then((me) => (Array.isArray(me?.clients) ? me.clients : []))
        .catch(() => {
          cache = { token: null, clients: null };
          return [];
        })
    };
  }
  return cache.clients;
}

/**
 * The UI's client (slug, colour) for a client the API names, matched by name;
 * undefined for a client the UI does not list.
 */
export function uiClientFor(serverName) {
  const target = normalize(serverName);
  return CLIENTS.find((c) => normalize(c.name) === target || normalize(c.id) === target);
}

/**
 * The API's id for a client picked in the UI.
 *
 * The UI names clients by slug ('sugarland'); the API takes the client's UUID
 * and answers 400 to anything else. Matched by name against the clients the
 * caller holds, per /auth/me.
 *
 * Resolves to the UUID; to `undefined` for no filter ('all' or empty); and to
 * `null` when the server holds no such client for this caller, which means the
 * answer is an empty list.
 */
export async function toServerClientId(value) {
  if (!value || value === 'all') return undefined;
  if (UUID.test(value)) return value;

  const name = CLIENTS.find((c) => c.id === value)?.name ?? value;
  const match = (await serverClients()).find(
    (c) => c && (normalize(c.name) === normalize(name) || normalize(c.name) === normalize(value))
  );
  return match?.id ?? null;
}

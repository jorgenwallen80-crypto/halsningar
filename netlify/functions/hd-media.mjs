import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const BUCKET = process.env.HANDELSER_BUCKET || 'handelser-images';
const MAX_BYTES = 500000;
const ALLOWED_TYPES = new Set(['image/jpeg','image/png','image/webp']);
const RPC_ALLOWLIST = new Set([
  'hd_add_memory','hd_admin_help_requests','hd_admin_memories','hd_admin_presentation','hd_admin_resolve_help',
  'hd_admin_settings','hd_admin_update_memory','hd_admin_update_presentation','hd_admin_update_settings','hd_check_quiz',
  'hd_check_sudoku','hd_day_available','hd_day_capacity','hd_my_memories','hd_random_fact','hd_request_admin_help',
  'hd_server_clock','hd_sudoku_hint','hd_timeline','hd_update_memory','hd_verify_admin','hd_verify_friend','hd_viewer_presentation'
]);
const requestWindows = new Map();
function clientIp(event) {
  return String(event.headers?.['x-nf-client-connection-ip'] || event.headers?.['x-forwarded-for'] || 'unknown').split(',')[0].trim();
}
function enforceRateLimit(event, action) {
  const ip=clientIp(event); const now=Date.now();
  const authAction=action==='rpc' && /^hd_(verify_|timeline$|server_clock$)/.test(String(JSON.parse(event.body||'{}').name||''));
  const windowMs=authAction?15*60*1000:60*1000; const max=authAction?12:180; const key=`${ip}:${authAction?'auth':'general'}`;
  const current=requestWindows.get(key);
  if(!current || current.resetAt<=now){requestWindows.set(key,{count:1,resetAt:now+windowMs});return;}
  current.count+=1;
  if(current.count>max){const seconds=Math.max(1,Math.ceil((current.resetAt-now)/1000));const error=new Error(`För många försök. Vänta ${seconds} sekunder.`);error.statusCode=429;throw error;}
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    },
    body: JSON.stringify(body)
  };
}

function cleanError(error) {
  const message = String(error?.message || error || 'Något gick fel');
  return message.replace(/SUPABASE_SERVICE_ROLE_KEY/gi, 'servernyckel').slice(0, 500);
}

function requireEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Netlify saknar SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY');
  return { url, serviceKey };
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function extensionFor(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

async function ensureBucket(client) {
  const { data, error } = await client.storage.getBucket(BUCKET);
  if (!error && data) return;
  const created = await client.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: [...ALLOWED_TYPES]
  });
  if (created.error && !/already exists/i.test(created.error.message || '')) throw created.error;
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}

async function verifyFriend(client, pin) {
  const ok = await rpc(client, 'hd_verify_friend', { p_friend_pin: pin });
  if (!ok) throw new Error('Fel kod');
}

async function verifyAdmin(client, pin) {
  const ok = await rpc(client, 'hd_verify_admin', { p_admin_pin: pin });
  if (!ok) throw new Error('Fel kod');
}

async function signedImage(client, body) {
  let path = '';
  if (body.role === 'viewer') {
    path = await rpc(client, 'hd_viewer_image_path', { p_viewer_pin: body.pin, p_id: body.memoryId });
  } else if (body.role === 'friend') {
    path = await rpc(client, 'hd_friend_image_path', {
      p_friend_pin: body.pin,
      p_contributor_token: body.contributorToken,
      p_id: body.memoryId
    });
  } else if (body.role === 'admin') {
    path = await rpc(client, 'hd_admin_image_path', { p_admin_pin: body.pin, p_id: body.memoryId });
  } else {
    throw new Error('Ogiltig bildbehörighet');
  }
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error) throw error;
  return { url: data.signedUrl, expiresIn: 600 };
}

async function removePath(client, path) {
  if (!path) return;
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error && !/not found/i.test(error.message || '')) throw error;
}

async function listAllPaths(client) {
  const paths = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.storage.from(BUCKET).list('', {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' }
    });
    if (error) {
      if (/not found/i.test(error.message || '')) return [];
      throw error;
    }
    const files = (data || []).filter((item) => item.id && item.name).map((item) => item.name);
    paths.push(...files);
    if ((data || []).length < 1000) break;
    offset += 1000;
  }
  return paths;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Endast POST stöds' });
  try {
    const { url, serviceKey } = requireEnv();
    const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = JSON.parse(event.body || '{}');
    const action = String(body.action || '');
    enforceRateLimit(event,action);

    if (action === 'rpc') {
      const name=String(body.name || '');
      if(!RPC_ALLOWLIST.has(name)) throw new Error('RPC-anropet är inte tillåtet');
      const data=await rpc(client,name,body.args && typeof body.args==='object'?body.args:{});
      return response(200,{data});
    }

    if (action === 'create-upload') {
      if (!validUuid(body.contributorToken)) throw new Error('Enhetens bidragsnyckel är ogiltig');
      const contentType = String(body.contentType || '');
      const size = Number(body.size || 0);
      if (!ALLOWED_TYPES.has(contentType)) throw new Error('Bildformatet stöds inte');
      if (!Number.isFinite(size) || size < 1 || size > MAX_BYTES) throw new Error('Bilden är för stor');
      await verifyFriend(client, body.pin);
      await ensureBucket(client);
      const path = `${body.contributorToken}-${randomUUID()}.${extensionFor(contentType)}`;
      const { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
      if (error) throw error;
      return response(200, { path, token: data.token });
    }

    if (action === 'create-admin-upload') {
      const contentType = String(body.contentType || '');
      const size = Number(body.size || 0);
      if (!ALLOWED_TYPES.has(contentType)) throw new Error('Bildformatet stöds inte');
      if (!Number.isFinite(size) || size < 1 || size > MAX_BYTES) throw new Error('Bilden är för stor');
      await verifyAdmin(client, body.pin);
      await ensureBucket(client);
      const path = `admin-${randomUUID()}.${extensionFor(contentType)}`;
      const { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
      if (error) throw error;
      return response(200, { path, token: data.token });
    }

    if (action === 'cleanup-admin-upload') {
      await verifyAdmin(client, body.pin);
      const path = String(body.path || '');
      if (!path || path.includes('/') || !/\.(jpg|png|webp)$/i.test(path)) throw new Error('Ogiltig bildsökväg');
      await removePath(client, path);
      return response(200, { ok: true });
    }

    if (action === 'signed-image') {
      if (!validUuid(body.memoryId)) throw new Error('Bilden kunde inte hittas');
      await ensureBucket(client);
      return response(200, await signedImage(client, body));
    }

    if (action === 'cleanup-upload') {
      if (!validUuid(body.contributorToken)) throw new Error('Enhetens bidragsnyckel är ogiltig');
      await verifyFriend(client, body.pin);
      const path = String(body.path || '');
      if (!path.startsWith(`${body.contributorToken}-`)) throw new Error('Filen tillhör inte den här enheten');
      await removePath(client, path);
      return response(200, { ok: true });
    }

    if (action === 'delete-memory') {
      if (!validUuid(body.memoryId)) throw new Error('Händelsen kunde inte hittas');
      let path = '';
      if (body.role === 'friend') {
        path = await rpc(client, 'hd_friend_image_path', {
          p_friend_pin: body.pin,
          p_contributor_token: body.contributorToken,
          p_id: body.memoryId
        }).catch(() => '');
        await removePath(client, path);
        await rpc(client, 'hd_delete_memory', {
          p_friend_pin: body.pin,
          p_contributor_token: body.contributorToken,
          p_id: body.memoryId
        });
      } else if (body.role === 'admin') {
        await verifyAdmin(client, body.pin);
        path = await rpc(client, 'hd_admin_image_path', { p_admin_pin: body.pin, p_id: body.memoryId }).catch(() => '');
        await removePath(client, path);
        await rpc(client, 'hd_admin_delete_memory', { p_admin_pin: body.pin, p_id: body.memoryId });
      } else {
        throw new Error('Ogiltig raderingsbehörighet');
      }
      return response(200, { ok: true });
    }

    if (action === 'purge-all') {
      await verifyAdmin(client, body.pin);
      if (String(body.confirmation || '').trim().toLocaleUpperCase('sv-SE') !== 'AVSLUTA HÄNDELSER') {
        throw new Error('Skriv AVSLUTA HÄNDELSER för att bekräfta');
      }
      await ensureBucket(client);
      const paths = await listAllPaths(client);
      for (let index = 0; index < paths.length; index += 1000) {
        const batch = paths.slice(index, index + 1000);
        if (batch.length) {
          const { error } = await client.storage.from(BUCKET).remove(batch);
          if (error) throw error;
        }
      }
      await rpc(client, 'hd_admin_delete_all', { p_admin_pin: body.pin, p_confirmation: body.confirmation });
      return response(200, { ok: true, deletedImages: paths.length });
    }

    throw new Error('Okänd åtgärd');
  } catch (error) {
    return response(Number(error?.statusCode)||400, { error: cleanError(error) });
  }
}

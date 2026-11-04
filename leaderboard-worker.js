// DRGNFLEYE SIDEQUEST · public leaderboard
// A tiny Cloudflare Worker backed by one KV namespace (binding name: SCORES).
//   GET  /scores  → top 200 players, highest score first (public, anyone can read)
//   POST /scores  → { id, name, coins, swag, speed } · upserts that player's latest totals
// Score = coins collected + swag bought + speed points (each level capped at 400 speed points).
// Deploy: Cloudflare dashboard → Workers & Pages → Create Worker → paste this file → Settings → Bindings →
//         add KV namespace "SCORES" → Deploy. Put the worker URL into LB_API in sidequest.html.

export default {
  async fetch(req, env) {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (url.pathname !== '/scores') return new Response('Not found', { status: 404, headers: cors });

    const board = JSON.parse((await env.SCORES.get('board')) || '{}');

    if (req.method === 'POST') {
      const b = await req.json().catch(() => null);
      if (!b || typeof b.id !== 'string' || !b.id || b.id.length > 64)
        return new Response('Bad request', { status: 400, headers: cors });
      const name = String(b.name || 'GUEST').toUpperCase().replace(/[^A-Z0-9 _.-]/g, '').trim().slice(0, 16) || 'GUEST';
      const num = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
      const e = { id: b.id, name, coins: num(b.coins, 1e6), swag: num(b.swag, 1e6), speed: num(b.speed, 1600), t: Date.now() };
      e.score = e.coins + e.swag + e.speed;
      board[e.id] = e;
      await env.SCORES.put('board', JSON.stringify(board));
    }

    const list = Object.values(board).sort((a, b) => b.score - a.score).slice(0, 200);
    return new Response(JSON.stringify(list), {
      headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  },
};

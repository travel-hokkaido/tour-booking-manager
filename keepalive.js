module.exports = async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return res.status(500).json({ ok: false, error: 'SUPABASE_URL or SUPABASE_ANON_KEY is not set' });
  }

  try {
    const r = await fetch(`${url}/rest/v1/groups?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message });
  }
};

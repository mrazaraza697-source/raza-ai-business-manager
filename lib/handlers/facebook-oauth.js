import { createHash, randomBytes, createCipheriv } from "node:crypto";

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v27.0";
const APP_ID = process.env.META_APP_ID || "2246703162543052";
const TARGET_PAGE_ID = process.env.META_PAGE_ID || "614275441770147";

function getAction(req) {
  return String(req.query?.action || "");
}

function getRedirectUri() {
  const value = process.env.META_REDIRECT_URI;
  if (!value) throw new Error("META_REDIRECT_URI is not configured.");
  return value;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return { url: url.replace(/\/$/, ""), key };
}

async function supabaseRequest(path, options = {}) {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    console.error("Meta connection database error:", data);
    throw new Error("Secure connection storage failed. Check the Meta connection database tables.");
  }
  return data;
}

function encryptPageToken(token) {
  const keyHex = process.env.META_TOKEN_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(keyHex)) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY must be a 32-byte hexadecimal key.");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final()
  ]);
  return {
    page_access_token_ciphertext: ciphertext.toString("base64"),
    page_access_token_iv: iv.toString("base64"),
    page_access_token_tag: cipher.getAuthTag().toString("base64")
  };
}

function hashState(value) {
  return createHash("sha256").update(value).digest("hex");
}

function appHome(status, extra = {}) {
  const home = new URL("/", getRedirectUri());
  home.searchParams.set("facebook", status);
  for (const [key, value] of Object.entries(extra)) {
    if (value) home.searchParams.set(key, String(value));
  }
  return home.toString();
}

async function graphGet(path, params) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error) {
    console.error("Meta Graph API error:", data.error || data);
    throw new Error(data.error?.message || "Meta Graph API request failed.");
  }
  return data;
}

async function startOAuth(req, res) {
  if (!req.user?.id) {
    return res.status(401).json({ error: "Please log in to RAZA AI first." });
  }

  const appSecret = process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET;
  if (!APP_ID || !appSecret) {
    return res.status(500).json({
      error: "Meta App ID or App Secret is not configured on the server."
    });
  }

  let redirectUri;
  try { redirectUri = getRedirectUri(); }
  catch (error) { return res.status(500).json({ error: error.message }); }

  const state = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  try {
    await supabaseRequest("meta_oauth_states", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        state_hash: hashState(state),
        user_id: req.user.id,
        expires_at: expiresAt
      })
    });

    const authUrl = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    authUrl.searchParams.set("client_id", APP_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set(
      "scope",
      "pages_show_list,pages_read_engagement,pages_manage_posts"
    );

    return res.status(200).json({ success: true, authUrl: authUrl.toString() });
  } catch (error) {
    console.error("Meta OAuth start error:", error);
    return res.status(500).json({ error: "Could not start secure Facebook login." });
  }
}

async function handleCallback(req, res) {
  const query = new URL(req.url, "https://localhost").searchParams;
  const code = query.get("code");
  const state = query.get("state");
  const metaError = query.get("error");

  if (metaError) {
    return res.redirect(302, appHome("error", { reason: "login_cancelled" }));
  }
  if (!code || !state || !/^[a-f0-9]{64}$/.test(state)) {
    return res.status(400).send("Facebook connection could not be verified. Please start again from RAZA AI.");
  }

  const appSecret = process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET;
  if (!APP_ID || !appSecret) {
    return res.status(500).send("Meta App ID or App Secret is not configured.");
  }

  try {
    // Consume the one-time OAuth state to prevent login CSRF and replay.
    const stateParams = new URLSearchParams({
      state_hash: `eq.${hashState(state)}`,
      expires_at: `gt.${new Date().toISOString()}`,
      select: "user_id"
    });
    const consumed = await supabaseRequest(
      `meta_oauth_states?${stateParams.toString()}`,
      { method: "DELETE", headers: { Prefer: "return=representation" } }
    );

    const owner = consumed?.[0]?.user_id;
    if (!owner) {
      return res.status(400).send("Facebook login expired or was already used. Return to RAZA AI and try again.");
    }

    const redirectUri = getRedirectUri();
    const shortToken = await graphGet("oauth/access_token", {
      client_id: APP_ID,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code
    });

    const longToken = await graphGet("oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: APP_ID,
      client_secret: appSecret,
      fb_exchange_token: shortToken.access_token
    });

    const pages = await graphGet("me/accounts", {
      fields: "id,name,access_token,tasks",
      limit: "100",
      access_token: longToken.access_token
    });

    const page = (pages.data || []).find(item => String(item.id) === String(TARGET_PAGE_ID));
    if (!page?.access_token) {
      return res.redirect(302, appHome("error", { reason: "page_not_available" }));
    }

    const encryptedToken = encryptPageToken(page.access_token);

    await supabaseRequest("meta_page_connections?on_conflict=user_id,page_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: owner,
        page_id: String(page.id),
        page_name: page.name || "The Beauty Vault",
        ...encryptedToken,
        granted_scopes: [
          "pages_show_list",
          "pages_read_engagement",
          "pages_manage_posts"
        ],
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    return res.redirect(302, appHome("connected", { page: page.name || "The Beauty Vault" }));
  } catch (error) {
    console.error("Facebook OAuth callback error:", error);
    return res.redirect(302, appHome("error", { reason: "connection_failed" }));
  }
}

async function getStatus(req, res) {
  if (!req.user?.id) return res.status(401).json({ error: "Please log in first." });

  try {
    const params = new URLSearchParams({
      select: "page_id,page_name,connected_at,granted_scopes",
      user_id: `eq.${req.user.id}`,
      page_id: `eq.${TARGET_PAGE_ID}`,
      limit: "1"
    });
    const rows = await supabaseRequest(`meta_page_connections?${params.toString()}`);
    const page = rows?.[0];
    return res.status(200).json({
      success: true,
      connected: Boolean(page),
      page: page ? {
        id: page.page_id,
        name: page.page_name,
        connectedAt: page.connected_at,
        permissions: page.granted_scopes || []
      } : null
    });
  } catch (error) {
    console.error("Facebook status error:", error);
    return res.status(500).json({ error: "Could not check Facebook connection status." });
  }
}

export default async function handler(req, res) {
  const action = getAction(req);

  if (action === "callback" && req.method === "GET") {
    return handleCallback(req, res);
  }
  if (action === "start" && req.method === "POST") {
    return startOAuth(req, res);
  }
  if (action === "status" && req.method === "GET") {
    return getStatus(req, res);
  }

  return res.status(405).json({ error: "Unsupported Facebook OAuth action." });
}

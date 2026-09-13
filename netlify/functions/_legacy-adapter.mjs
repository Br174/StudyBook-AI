function applyNetlifyEnv() {
  if (!globalThis.Netlify?.env?.get) return;
  for (const key of ['AI_API_URL', 'AI_API_KEY', 'AI_MODEL', 'AI_TIMEOUT_MS']) {
    const value = globalThis.Netlify.env.get(key);
    if (value) process.env[key] = value;
  }
}

function requestHeaders(request) {
  return Object.fromEntries(request.headers.entries());
}

export async function runLegacyApi(handler, request) {
  applyNetlifyEnv();

  let body = {};
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const raw = await request.text();
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return Response.json({ error: 'JSON non valido.' }, { status: 400 });
    }
  }

  const req = {
    method: request.method,
    body,
    headers: requestHeaders(request),
    url: request.url,
  };

  let statusCode = 200;
  const headers = new Headers();
  let responseBody = '';
  let finished = false;

  const res = {
    setHeader(name, value) {
      if (Array.isArray(value)) value.forEach((item) => headers.append(name, String(item)));
      else headers.set(name, String(value));
      return res;
    },
    status(code) {
      statusCode = Number(code) || 200;
      return res;
    },
    json(value) {
      headers.set('Content-Type', 'application/json; charset=utf-8');
      responseBody = JSON.stringify(value ?? null);
      finished = true;
      return res;
    },
    send(value) {
      responseBody = typeof value === 'string' ? value : JSON.stringify(value ?? '');
      finished = true;
      return res;
    },
    end(value = '') {
      responseBody = String(value ?? '');
      finished = true;
      return res;
    },
  };

  const returned = await handler(req, res);
  if (!finished && returned instanceof Response) return returned;

  return new Response(responseBody, {
    status: statusCode,
    headers,
  });
}

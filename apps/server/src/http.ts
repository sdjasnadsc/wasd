import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

export function requestOriginAllowed(req: IncomingMessage) {
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    if (origin.host === req.headers.host) return true;
    if (process.env.TRUST_PROXY === '1' && origin.host === req.headers['x-forwarded-host']) return true;

    // The Codespaces proxy can replace Host with the container address.
    const { CODESPACES, CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN } = process.env;
    const port = req.socket.localPort;
    if (CODESPACES !== 'true' || !CODESPACE_NAME || !GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || !port) return false;
    return origin.origin === `https://${CODESPACE_NAME}-${port}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
  } catch { return false; }
}

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export interface Request extends IncomingMessage {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  ip: string;
  pathname: string;
}
export type NextFunction = (error?: unknown) => void;
export type RequestHandler = (req: Request, res: Response, next: NextFunction) => unknown;
type ErrorHandler = (error: unknown, req: Request, res: Response, next: NextFunction) => unknown;
export interface Response extends ServerResponse {
  locals: Record<string, unknown>;
  status(code: number): Response;
  set(key: string, value: string): Response;
  json(value: unknown): void;
  attachment(filename: string): Response;
  cookie(name: string, value: string, options: { httpOnly: boolean; sameSite: string; secure: boolean; maxAge: number; path: string }): void;
  sendFile(file: string): void;
}
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg',
};
function enhance(res: ServerResponse) {
  const response = res as Response;
  response.locals = {};
  response.status = code => { res.statusCode = code; return response; };
  response.set = (key, value) => { res.setHeader(key, value); return response; };
  response.json = value => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
  response.attachment = filename => { res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); return response; };
  response.cookie = (name, value, options) => {
    res.setHeader('Set-Cookie', [name + '=' + encodeURIComponent(value), 'Path=' + options.path,
      'Max-Age=' + Math.floor(options.maxAge / 1000), 'SameSite=' + options.sameSite, options.httpOnly && 'HttpOnly', options.secure && 'Secure'].filter(Boolean).join('; '));
  };
  response.sendFile = file => {
    let size: number;
    try { const stat = statSync(file); if (!stat.isFile()) throw new Error(); size = stat.size; }
    catch { response.status(404).json({ error: 'File not found.' }); return; }
    res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    res.setHeader('Content-Length', size);
    res.setHeader('Cache-Control', 'no-cache');
    if (res.req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  };
  return response;
}
async function parseJSON(raw: IncomingMessage) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(raw.method ?? '')) return undefined;
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of raw.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > 96 * 1024) throw new HttpError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  if (!bytes) return undefined;
  if (!raw.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Use JSON for requests.');
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new HttpError(400, 'Malformed JSON.'); }
}

export function createRouter() {
  const stack: { match: (req: Request) => Record<string, string> | null; handler: RequestHandler }[] = [];
  let handleError: ErrorHandler = (error, _req, res) => res.status(500).json({ error: String(error) });
  const use = (prefix: string, ...handlers: RequestHandler[]) => {
    stack.push(...handlers.map(handler => ({ handler, match: (req: Request) => prefix === '/' || req.pathname === prefix || req.pathname.startsWith(prefix + '/') ? {} : null })));
  };
  const route = (method: string, pattern: string, ...handlers: RequestHandler[]) => {
    const params: string[] = [];
    const regex = pattern === '*' ? /.*/u : new RegExp('^' + pattern.replace(/:([\w]+)/g, (_part, name: string) => {
      params.push(name);
      return '([^/]+)';
    }) + '/?$');
    stack.push(...handlers.map(handler => ({
      handler, match: (req: Request) => {
        if (req.method !== method && !(req.method === 'HEAD' && method === 'GET')) return null;
        const match = regex.exec(req.pathname);
        return match ? Object.fromEntries(params.map((key, i) => [key, match[i + 1]])) : null;
      },
    })));
  };
  const listener = async (raw: IncomingMessage, base: ServerResponse) => {
    const req = raw as Request;
    const res = enhance(base);
    const fail = (error: unknown) => { if (!res.headersSent) handleError(error, req, res, () => {}); else res.destroy(); };
    try {
      const url = new URL(raw.url ?? '/', 'http://localhost');
      req.pathname = decodeURIComponent(url.pathname);
      req.query = Object.fromEntries(url.searchParams);
      req.ip = process.env.TRUST_PROXY === '1' ? raw.headers['x-forwarded-for']?.toString().split(',').at(-1)?.trim() ?? raw.socket.remoteAddress ?? 'local' : raw.socket.remoteAddress ?? 'local';
      req.body = await parseJSON(raw);
      let index = 0;
      const next: NextFunction = error => {
        if (error) { fail(error); return; }
        try {
          while (index < stack.length) {
            const { handler, match } = stack[index++];
            const params = match(req);
            if (!params) continue;
            req.params = params;
            handler(req, res, next);
            return;
          }
          res.status(404).json({ error: 'Page not found.' });
        } catch (err) { fail(err); }
      };
      next();
    } catch (error) { fail(error); }
  };
  return {
    listener, use, onError: (handler: ErrorHandler) => { handleError = handler; },
    get: route.bind(null, 'GET'), post: route.bind(null, 'POST'), put: route.bind(null, 'PUT'),
    patch: route.bind(null, 'PATCH'), delete: route.bind(null, 'DELETE'),
  };
}
export function staticFiles(root: string): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const file = resolve(root, '.' + req.pathname);
    if (!file.startsWith(resolve(root) + sep) || !mime[extname(file)]) return next();
    res.sendFile(file);
  };
}

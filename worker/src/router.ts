export type Handler = (request: Request, params: Record<string, string>) => Promise<Response>;

interface Route {
  method: string;
  pattern: URLPattern;
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler) {
    this.routes.push({ method, pattern: new URLPattern({ pathname: path }), handler });
  }

  get(path: string, handler: Handler) { this.add('GET', path, handler); }
  post(path: string, handler: Handler) { this.add('POST', path, handler); }
  put(path: string, handler: Handler) { this.add('PUT', path, handler); }
  delete(path: string, handler: Handler) { this.add('DELETE', path, handler); }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    for (const route of this.routes) {
      if (route.method !== request.method) continue;
      const match = route.pattern.exec({ pathname: url.pathname });
      if (!match) continue;
      const params = (match.pathname.groups ?? {}) as Record<string, string>;
      return route.handler(request, params);
    }
    return json({ error: 'not found' }, 404);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

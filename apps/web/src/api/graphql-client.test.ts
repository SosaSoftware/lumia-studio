import { describe, expect, it } from 'vitest';
import { ApiError, GraphqlClient, parseFieldErrors } from './graphql-client.ts';

function client(body: unknown, status = 200, onUnauthorized: () => void = () => undefined): GraphqlClient {
  const fetcher: typeof fetch = () => Promise.resolve(new Response(JSON.stringify(body), { status }));
  return new GraphqlClient('/studio/graphql', { getToken: () => Promise.resolve('token') }, onUnauthorized, fetcher);
}

describe('parseFieldErrors', () => {
  it('extracts one message per field of a validation error', () => {
    const message = 'Elemento (title): props.text: Muy pequeño. geometry: El elemento sale de la diapositiva por la derecha (máximo 100).';
    expect(parseFieldErrors(message)).toEqual({
      'props.text': 'Muy pequeño.',
      geometry: 'El elemento sale de la diapositiva por la derecha (máximo 100).',
    });
  });

  it('reads nested paths and returns nothing for free text', () => {
    expect(parseFieldErrors('Elemento (multiple_choice): props.options.1.text: Requerido.')).toEqual({ 'props.options.1.text': 'Requerido.' });
    expect(parseFieldErrors('La clase ya tiene un documento.')).toEqual({});
  });
});

describe('GraphqlClient', () => {
  it('sends the bearer token and returns data', async () => {
    let seen: RequestInit | undefined;
    const fetcher: typeof fetch = (_url, init) => {
      seen = init;
      return Promise.resolve(new Response(JSON.stringify({ data: { ok: true } })));
    };
    const data = await new GraphqlClient('/x', { getToken: () => Promise.resolve('abc') }, () => undefined, fetcher).request('{ ok }');
    expect(data).toEqual({ ok: true });
    expect(new Headers(seen?.headers).get('authorization')).toBe('abc');
  });

  it('normalizes errors with their errorType and field paths', async () => {
    const failing = client({ errors: [{ errorType: 'ValidationError', message: 'Elemento (title): props.text: Texto requerido.' }] });
    await expect(failing.request('mutation { x }')).rejects.toMatchObject({
      errorType: 'ValidationError',
      fields: { 'props.text': 'Texto requerido.' },
    });
    await expect(failing.request('x')).rejects.toBeInstanceOf(ApiError);
  });

  it('signals an expired session', async () => {
    let called = 0;
    const unauthorized = client({ errors: [{ errorType: 'Unauthorized', message: 'No autorizado.' }] }, 200, () => {
      called += 1;
    });
    await expect(unauthorized.request('x')).rejects.toMatchObject({ isUnauthorized: true });
    expect(called).toBe(1);
  });

  it('reports a network failure in Spanish', async () => {
    const offline: typeof fetch = () => Promise.reject(new TypeError('offline'));
    await expect(new GraphqlClient('/x', { getToken: () => Promise.resolve(null) }, () => undefined, offline).request('x')).rejects.toMatchObject({
      errorType: 'NetworkError',
      message: 'No se pudo conectar con el servidor.',
    });
  });
});

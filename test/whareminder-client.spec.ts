import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendWhatsApp } from '../src/whatsapp/whareminder-client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => mockFetch.mockReset());

const cfg = {
  baseUrl: 'https://api.whareminder.com',
  apiKey: 'test-key',
  sessionId: 'session-123',
  templateId: 'tpl-456',
  phone: '51986550234',
};

describe('sendWhatsApp', () => {
  it('hace POST al endpoint correcto con sessionId en la ruta', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await sendWhatsApp(cfg, 'Hola!');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.whareminder.com/sessions/session-123/schedules',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('envía x-api-key en el header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await sendWhatsApp(cfg, 'Test');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
      }),
    );
  });

  it('envía templateId, phone, variables.content y sendAt en el body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await sendWhatsApp(cfg, 'Mi mensaje');
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.templateId).toBe('tpl-456');
    expect(body.phone).toBe('51986550234');
    expect(body.variables.content).toBe('Mi mensaje');
    expect(typeof body.sendAt).toBe('string');
    expect(new Date(body.sendAt).getTime()).toBeGreaterThan(Date.now() - 5000);
  });

  it('lanza si la respuesta no es ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });
    await expect(sendWhatsApp(cfg, 'x')).rejects.toThrow('401');
  });
});

import { api } from './api';

describe('api instance', () => {
  it('has baseURL set to localhost:3001', () => {
    expect(api.defaults.baseURL).toBe('http://localhost:3001');
  });

  it('has Content-Type header set', () => {
    expect(api.defaults.headers['Content-Type']).toBe('application/json');
  });
});

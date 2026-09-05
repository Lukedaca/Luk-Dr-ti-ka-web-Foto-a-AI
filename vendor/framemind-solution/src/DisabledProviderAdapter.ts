import type { ProviderAdapter, ProviderRequest, ProviderResponse } from './types.js';

export class DisabledProviderAdapter implements ProviderAdapter {
  readonly id = 'disabled';
  readonly enabled = false;

  async generate(_request: ProviderRequest): Promise<ProviderResponse> {
    throw new Error('provider adapter disabled');
  }
}

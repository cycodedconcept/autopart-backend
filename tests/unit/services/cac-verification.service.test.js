require('../../setup/jest');

const { createCacVerificationService } = require('../../../src/services/cac-verification.service');

describe('cac verification service', () => {
  it('returns not_configured when Dojah credentials are missing', async () => {
    const fetchImpl = jest.fn();
    const service = createCacVerificationService({
      env: {
        DOJAH_BASE_URL: 'https://sandbox.dojah.io',
        DOJAH_APP_ID: '',
        DOJAH_API_KEY: ''
      },
      fetchImpl
    });

    const result = await service.verifyBusiness({
      businessName: 'Prime Auto Hub',
      cacNumber: 'RC-123456',
      customerReference: 'seller-registration-RC-123456'
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.status).toBe('not_configured');
    expect(result.response).toBeNull();
  });

  it('returns the provider payload for a successful lookup', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        entity_name: 'Prime Auto Hub'
      })
    }));
    const service = createCacVerificationService({
      env: {
        DOJAH_BASE_URL: 'https://sandbox.dojah.io',
        DOJAH_APP_ID: 'app-id',
        DOJAH_API_KEY: 'secret-key'
      },
      fetchImpl
    });

    const result = await service.verifyBusiness({
      businessName: 'Prime Auto Hub',
      cacNumber: 'RC-123456',
      customerReference: 'seller-registration-RC-123456'
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining('/api/v1/kyc/cac/basic')
      }),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          AppId: 'app-id',
          Authorization: 'secret-key'
        })
      })
    );
    expect(result.status).toBe('completed');
    expect(result.response).toEqual({
      body: {
        entity_name: 'Prime Auto Hub'
      },
      httpStatusCode: 200
    });
  });

  it('returns unavailable when the Dojah request throws', async () => {
    const logger = {
      error: jest.fn()
    };
    const service = createCacVerificationService({
      env: {
        DOJAH_BASE_URL: 'https://sandbox.dojah.io',
        DOJAH_APP_ID: 'app-id',
        DOJAH_API_KEY: 'secret-key'
      },
      fetchImpl: jest.fn(async () => {
        throw new Error('socket hang up');
      }),
      logger
    });

    const result = await service.verifyBusiness({
      businessName: 'Prime Auto Hub',
      cacNumber: 'RC-123456',
      customerReference: 'seller-registration-RC-123456'
    });

    expect(result.status).toBe('unavailable');
    expect(result.error).toEqual({
      message: 'Dojah CAC verification is currently unavailable.'
    });
    expect(logger.error).toHaveBeenCalled();
  });
});

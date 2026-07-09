const { CAC_VERIFICATION_OUTCOMES } = require('../config/constants');

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || 'https://api.dojah.io').replace(/\/+$/, '');
}

function buildLookupUrl({ baseUrl, businessName, cacNumber, customerReference }) {
  const url = new URL('/api/v1/kyc/cac/basic', normalizeBaseUrl(baseUrl));

  url.searchParams.set('rc_number', cacNumber);
  url.searchParams.set('company_name', businessName);
  url.searchParams.set('customer_reference', customerReference);

  return url;
}

function parseJsonSafely(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return {
      raw: value
    };
  }
}

function buildResult({ checkedAt, error = null, response = null, status }) {
  return {
    checkedAt,
    error,
    response,
    status
  };
}

function createCacVerificationService({ env, fetchImpl = fetch, logger }) {
  return {
    async verifyBusiness(payload) {
      const checkedAt = new Date().toISOString();

      if (!env.DOJAH_APP_ID || !env.DOJAH_API_KEY) {
        return buildResult({
          checkedAt,
          status: CAC_VERIFICATION_OUTCOMES.NOT_CONFIGURED
        });
      }

      const requestUrl = buildLookupUrl({
        baseUrl: env.DOJAH_BASE_URL,
        businessName: payload.businessName.trim(),
        cacNumber: payload.cacNumber.trim(),
        customerReference: payload.customerReference
      });

      try {
        const providerResponse = await fetchImpl(requestUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            AppId: env.DOJAH_APP_ID,
            Authorization: env.DOJAH_API_KEY
          }
        });
        const responseText = await providerResponse.text();
        const responseBody = parseJsonSafely(responseText);
        const response = {
          body: responseBody,
          httpStatusCode: providerResponse.status
        };

        if (!providerResponse.ok) {
          return buildResult({
            checkedAt,
            error: {
              message: responseBody && responseBody.error
                ? responseBody.error
                : 'Dojah CAC verification request failed.'
            },
            response,
            status: CAC_VERIFICATION_OUTCOMES.FAILED
          });
        }

        return buildResult({
          checkedAt,
          response,
          status: CAC_VERIFICATION_OUTCOMES.COMPLETED
        });
      } catch (error) {
        if (logger) {
          logger.error('Dojah CAC verification request failed.', {
            error: error.message
          });
        }

        return buildResult({
          checkedAt,
          error: {
            message: 'Dojah CAC verification is currently unavailable.'
          },
          status: CAC_VERIFICATION_OUTCOMES.UNAVAILABLE
        });
      }
    }
  };
}

module.exports = {
  createCacVerificationService
};

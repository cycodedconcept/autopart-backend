const NIGERIAN_PHONE_REGEX = /^\+234[789]\d{9}$/;

function normalizeNigerianPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Phone number is required.');
  }

  const cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+234') && cleaned.length === 14) {
    if (!NIGERIAN_PHONE_REGEX.test(cleaned)) {
      throw new Error('Phone number must be a valid Nigerian phone number.');
    }

    return cleaned;
  }

  if (cleaned.startsWith('234') && cleaned.length === 13) {
    const normalized = `+${cleaned}`;

    if (!NIGERIAN_PHONE_REGEX.test(normalized)) {
      throw new Error('Phone number must be a valid Nigerian phone number.');
    }

    return normalized;
  }

  if (cleaned.startsWith('0') && cleaned.length === 11) {
    const normalized = `+234${cleaned.slice(1)}`;

    if (!NIGERIAN_PHONE_REGEX.test(normalized)) {
      throw new Error('Phone number must be a valid Nigerian phone number.');
    }

    return normalized;
  }

  throw new Error('Phone number must be a valid Nigerian phone number.');
}

function isValidNigerianPhone(phone) {
  try {
    normalizeNigerianPhone(phone);
    return true;
  } catch (_error) {
    return false;
  }
}

module.exports = {
  isValidNigerianPhone,
  normalizeNigerianPhone
};

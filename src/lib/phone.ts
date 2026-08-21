// ============================================================
// Phone Intelligence — Egyptian phone normalization
// ============================================================

export interface PhoneResult {
  raw_phone: string;
  normalized_phone: string | null;
  country: string;
  phone_type: 'mobile' | 'landline' | 'unknown';
  valid: boolean;
  verification_status: 'verified' | 'unverified' | 'invalid';
}

const EGYPT_MOBILE_PREFIXES = ['10', '11', '12', '15'];

export function normalizePhone(raw: string | undefined | null): PhoneResult {
  const rawPhone = (raw ?? '').trim();
  if (!rawPhone) {
    return {
      raw_phone: '',
      normalized_phone: null,
      country: 'unknown',
      phone_type: 'unknown',
      valid: false,
      verification_status: 'invalid',
    };
  }

  let digits = rawPhone.replace(/[^\d+]/g, '');

  if (digits.startsWith('+20')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0020')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length === 10 && digits.startsWith('2')) {
    return {
      raw_phone: rawPhone,
      normalized_phone: `+20${digits}`,
      country: 'Egypt',
      phone_type: 'landline',
      valid: true,
      verification_status: 'verified',
    };
  }

  if (digits.length === 10 && EGYPT_MOBILE_PREFIXES.includes(digits.slice(0, 2))) {
    return {
      raw_phone: rawPhone,
      normalized_phone: `+20${digits}`,
      country: 'Egypt',
      phone_type: 'mobile',
      valid: true,
      verification_status: 'verified',
    };
  }

  if (digits.length === 11 && digits.startsWith('0') && EGYPT_MOBILE_PREFIXES.includes(digits.slice(1, 3))) {
    return {
      raw_phone: rawPhone,
      normalized_phone: `+20${digits.slice(1)}`,
      country: 'Egypt',
      phone_type: 'mobile',
      valid: true,
      verification_status: 'verified',
    };
  }

  return {
    raw_phone: rawPhone,
    normalized_phone: null,
    country: 'unknown',
    phone_type: 'unknown',
    valid: false,
    verification_status: 'invalid',
  };
}

export function isEgyptianMobile(raw: string | undefined | null): boolean {
  const result = normalizePhone(raw);
  return result.valid && result.phone_type === 'mobile' && result.country === 'Egypt';
}

export const getProfileShareFallbackUrl = (profileId, origin = '') => {
  if (!profileId) {
    return '';
  }

  const cleanOrigin = origin ? origin.replace(/\/$/, '') : '';
  return `${cleanOrigin}/p/${profileId}`;
};

export const buildProfileShareMessage = ({ name, username, profileId } = {}, shareUrl = '') => {
  const displayName = name || username || profileId || 'this profile';
  const prefix = `Check out ${displayName} on L3V3L MATCHES:`;

  return shareUrl ? `${prefix}\n\n${shareUrl}` : prefix;
};

export const buildWhatsAppShareUrl = (message) => {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
};

export const buildSmsShareUrl = (message) => {
  return `sms:?body=${encodeURIComponent(message)}`;
};

export const copyTextToClipboard = async (text) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const input = document.createElement('input');
  input.value = text;
  input.setAttribute('readonly', 'readonly');
  input.style.position = 'absolute';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.select();

  try {
    document.execCommand('copy');
    return true;
  } finally {
    document.body.removeChild(input);
  }
};

const profileShare = {
  getProfileShareFallbackUrl,
  buildProfileShareMessage,
  buildWhatsAppShareUrl,
  buildSmsShareUrl,
  copyTextToClipboard
};

export default profileShare;

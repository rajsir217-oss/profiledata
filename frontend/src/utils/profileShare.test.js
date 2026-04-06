import {
  buildProfileShareMessage,
  buildSmsShareUrl,
  buildWhatsAppShareUrl,
  copyTextToClipboard,
  getProfileShareFallbackUrl
} from './profileShare';

describe('profileShare helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('builds a fallback profile URL from the origin and profileId', () => {
    expect(getProfileShareFallbackUrl('abc123', 'https://example.com')).toBe(
      'https://example.com/p/abc123'
    );
  });

  test('builds a profile share message with the profile URL', () => {
    const message = buildProfileShareMessage(
      { name: 'Sneha R', username: 'sneha_r' },
      'https://example.com/p/abc123'
    );

    expect(message).toContain('Sneha R');
    expect(message).toContain('https://example.com/p/abc123');
  });

  test('builds WhatsApp share URL with encoded text', () => {
    const url = buildWhatsAppShareUrl('Check this out');
    expect(url).toBe('https://wa.me/?text=Check%20this%20out');
  });

  test('builds SMS share URL with encoded text', () => {
    const url = buildSmsShareUrl('Check this out');
    expect(url).toBe('sms:?body=Check%20this%20out');
  });

  test('copies text using the clipboard API when available', async () => {
    const writeText = jest.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    await copyTextToClipboard('https://example.com/p/abc123');

    expect(writeText).toHaveBeenCalledWith('https://example.com/p/abc123');
  });
});

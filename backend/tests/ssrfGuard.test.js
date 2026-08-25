const { isPrivateIPv4, isPrivateIPv6, isSafeUrl } = require('../src/utils/ssrfGuard');

describe('SSRF Guard Utility', () => {
  describe('isPrivateIPv4', () => {
    it('should identify loopback and private IPv4 ranges as private', () => {
      expect(isPrivateIPv4('127.0.0.1')).toBe(true);
      expect(isPrivateIPv4('127.255.255.254')).toBe(true);
      expect(isPrivateIPv4('10.0.0.1')).toBe(true);
      expect(isPrivateIPv4('172.16.5.5')).toBe(true);
      expect(isPrivateIPv4('172.31.255.255')).toBe(true);
      expect(isPrivateIPv4('192.168.1.100')).toBe(true);
      expect(isPrivateIPv4('169.254.169.254')).toBe(true);
      expect(isPrivateIPv4('0.0.0.0')).toBe(true);
    });

    it('should identify public IPv4 ranges as public/safe', () => {
      expect(isPrivateIPv4('8.8.8.8')).toBe(false);
      expect(isPrivateIPv4('93.184.216.34')).toBe(false);
      expect(isPrivateIPv4('172.32.0.1')).toBe(false);
    });
  });

  describe('isPrivateIPv6', () => {
    it('should identify standard loopback and link-local IPv6 ranges as private', () => {
      expect(isPrivateIPv6('::1')).toBe(true);
      expect(isPrivateIPv6('::')).toBe(true);
      expect(isPrivateIPv6('fe80::1')).toBe(true);
      expect(isPrivateIPv6('fc00::')).toBe(true);
      expect(isPrivateIPv6('fd00::1')).toBe(true);
    });

    it('should identify standard public IPv6 ranges as public/safe', () => {
      expect(isPrivateIPv6('2001:db8::1')).toBe(false);
      expect(isPrivateIPv6('2606:4700:4700::1111')).toBe(false);
    });

    it('should identify IPv4-mapped IPv6 private/loopback addresses as private (bypass protection)', () => {
      // Decimal mapping
      expect(isPrivateIPv6('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateIPv6('::ffff:169.254.169.254')).toBe(true);
      expect(isPrivateIPv6('::ffff:192.168.1.1')).toBe(true);
      
      // Hex mapping
      expect(isPrivateIPv6('::ffff:7f00:0001')).toBe(true); // 127.0.0.1
      expect(isPrivateIPv6('::ffff:a9fe:a9fe')).toBe(true); // 169.254.169.254
      expect(isPrivateIPv6('::ffff:c0a8:0101')).toBe(true); // 192.168.1.1
    });

    it('should identify IPv4-mapped IPv6 public addresses as public/safe', () => {
      expect(isPrivateIPv6('::ffff:8.8.8.8')).toBe(false);
      expect(isPrivateIPv6('::ffff:0808:0808')).toBe(false); // 8.8.8.8
    });
  });

  describe('isSafeUrl', () => {
    it('should block unsafe hostnames and direct private IPs', async () => {
      // Direct IPs
      expect(await isSafeUrl('127.0.0.1')).toBe(false);
      expect(await isSafeUrl('::1')).toBe(false);
      expect(await isSafeUrl('::ffff:127.0.0.1')).toBe(false);
      
      // URLs containing private IPs
      expect(await isSafeUrl('http://127.0.0.1/status')).toBe(false);
      expect(await isSafeUrl('https://[::1]/metadata')).toBe(false);
      expect(await isSafeUrl('http://[::ffff:169.254.169.254]/')).toBe(false);
    });

    it('should allow safe URLs', async () => {
      expect(await isSafeUrl('https://example.com')).toBe(true);
      expect(await isSafeUrl('http://8.8.8.8')).toBe(true);
    });
  });
});

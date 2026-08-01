const VPN_KEYWORDS = [
  'vpn', 'proxy', 'hosting', 'datacenter', 'data center',
  'mullvad', 'expressvpn', 'nordvpn', 'surfshark',
  'proton', 'protonvpn', 'proton ag', 'proton vpn',
  'openvpn', 'wireguard', 'tunnel', 'anonymizer',
  'cloudflare', 'digitalocean', 'linode', 'vultr',
  'aws', 'amazon', 'google cloud', 'azure', 'microsoft',
  'hetzner', 'ovh', 'fastly', 'akamai', 'leaseweb',
  'privado', 'pia', 'private internet', 'cyberghost',
  'ipvanish', 'torguard', 'hide.me', 'windscribe',
  'purevpn', 'hotspot shield', 'strongvpn', 'vyprvpn',
  'vpn unlimited', 'tunnelbear', 'hide my ass', 'hma',
  'server', 'colo', 'colocation', 'anonymous', 'relay'
];

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/,
  /^fc00:/i,
  /^fd00:/i
];

function getClientIp(req) {
  const headerNames = [
    'x-forwarded-for',
    'x-vercel-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'true-client-ip',
    'x-client-ip'
  ];

  for (const name of headerNames) {
    const value = req.headers[name];
    if (!value) continue;
    const first = String(value).split(',')[0].trim().replace(/^::ffff:/, '');
    if (first) return first;
  }

  return req.socket?.remoteAddress?.replace(/^::ffff:/, '') || '';
}

function isPrivateIp(ip) {
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(ip));
}

async function fetchJsonWithTimeout(url, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function inspectIpMetadata(data) {
  if (!data || typeof data !== 'object') return false;

  const matchesVpn = (value) =>
    VPN_KEYWORDS.some(keyword => String(value || '').toLowerCase().includes(keyword));

  const security = data.security || data.privacy || {};
  const booleanFlags = [
    data.vpn,
    data.proxy,
    data.tor,
    data.hosting,
    data.is_vpn,
    data.is_proxy,
    data.is_tor,
    data.is_hosting,
    security.vpn,
    security.proxy,
    security.tor,
    security.hosting,
    security.relay
  ];

  if (booleanFlags.some(Boolean)) return true;

  const typedFields = [
    data.type,
    data.connection?.type,
    data.company?.type,
    security.type
  ];

  if (typedFields.some(type => ['vpn', 'proxy', 'tor', 'hosting', 'relay'].includes(String(type || '').toLowerCase()))) {
    return true;
  }

  const textFields = [
    data.org,
    data.isp,
    data.asn,
    data.asn_org,
    data.network,
    data.hostname,
    data.connection?.isp,
    data.connection?.org,
    data.connection?.domain,
    data.company?.name,
    data.company?.domain
  ];

  return textFields.some(matchesVpn);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  if (!ip || isPrivateIp(ip)) {
    return res.status(200).json({
      restricted: false,
      isVpnDetected: false,
      source: 'local'
    });
  }

  const providers = [
    `https://ipwho.is/${encodeURIComponent(ip)}`,
    `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
    `https://ipinfo.io/${encodeURIComponent(ip)}/json`
  ];

  let isVpnDetected = false;
  let source = null;

  for (const url of providers) {
    try {
      const data = await fetchJsonWithTimeout(url);
      if (inspectIpMetadata(data)) {
        isVpnDetected = true;
        source = new URL(url).hostname;
        break;
      }
    } catch (_) {
      // Continue with the next provider.
    }
  }

  return res.status(200).json({
    restricted: isVpnDetected,
    isVpnDetected,
    source
  });
}

// /api/scrape.js — Vercel Serverless Function
// Proxy para hacer fetch a sitios públicos (esquiva CORS del navegador)
//
// Uso desde el frontend:
//   fetch('/api/scrape', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ url: 'https://quinielaposible.com/historico-progol/' })
//   })
//
// Solo permitimos URLs de sitios deportivos conocidos (whitelist)
// para evitar que alguien use el proxy para abusos.
 
const ALLOWED_DOMAINS = [
  'quinielaposible.com',
  'pronosticos.gob.mx',
  'loterianacional.gob.mx',
  'quinielaganadora.com',
  'progol.es',
  'pronosports.net',
  'gainblers.com',
  'transfermarkt.es',
  'transfermarkt.com',
  'transfermarkt.com.mx',
  'flashscore.com',
  'flashscore.com.mx',
  'sofascore.com',
  'es.besoccer.com',
  'fbref.com',
  'liga-mx.net',
  'ligamx.net',
  'mediotiempo.com',
  'marca.com',
  'as.com',
  'espn.com.mx',
  'espn.com',
  'foxsports.com.mx',
  'wikipedia.org',
  'es.wikipedia.org',
  'en.wikipedia.org'
];
 
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { url } = req.body;
  
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Falta el campo "url" en el body' });
  }
  
  // Valida URL
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'URL inválida' });
  }
  
  // Verifica que el dominio esté en la whitelist
  const domain = urlObj.hostname.replace(/^www\./, '');
  const allowed = ALLOWED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
  
  if (!allowed) {
    return res.status(403).json({ 
      error: `Dominio no permitido: ${domain}`,
      allowedDomains: ALLOWED_DOMAINS
    });
  }
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MelateGenius/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8'
      },
      timeout: 15000
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Error al fetchear: ${response.status} ${response.statusText}`
      });
    }
    
    const html = await response.text();
    
    // Devolvemos el HTML para que el frontend lo parsee
    res.status(200).json({
      url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      size: html.length,
      html
    });
  } catch (error) {
    console.error('Error en scrape:', error);
    res.status(500).json({ 
      error: 'Error al conectar: ' + error.message 
    });
  }
}

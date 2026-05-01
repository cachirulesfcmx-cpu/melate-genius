// /api/web-search.js — Vercel Serverless Function
// Búsqueda web para que el agente IA investigue partidos en tiempo real
//
// Como no tenemos API de Google/Bing pagada, usamos DuckDuckGo HTML
// que es gratis y no requiere API key. Es menos sofisticado que Google
// pero funciona bien para queries deportivos.
//
// Si en el futuro quieres mejor calidad, puedes cambiar a:
// - Brave Search API (gratis 2000 búsquedas/mes)
// - Serper.dev (gratis 100/mes)
// - SerpAPI (gratis 100/mes)
 
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { query, max_results = 5 } = req.body;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Falta el campo "query"' });
  }
  
  try {
    // DuckDuckGo HTML version (no API key required)
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Error en búsqueda: ${response.status}`
      });
    }
    
    const html = await response.text();
    
    // Parse simple sin librerías - regex sobre la estructura HTML conocida de DDG
    const results = [];
    const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    
    let linkMatch;
    let snippetMatch;
    const links = [];
    const snippets = [];
    
    while ((linkMatch = linkRegex.exec(html)) !== null && links.length < max_results) {
      let url = linkMatch[1];
      // DDG returns wrapped URLs - unwrap them
      const ddgWrap = url.match(/uddg=([^&]+)/);
      if (ddgWrap) {
        url = decodeURIComponent(ddgWrap[1]);
      }
      // Remove HTML entities and tags from title
      const title = linkMatch[2]
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
      links.push({ url, title });
    }
    
    while ((snippetMatch = snippetRegex.exec(html)) !== null && snippets.length < max_results) {
      const snippet = snippetMatch[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      snippets.push(snippet);
    }
    
    for (let i = 0; i < links.length; i++) {
      results.push({
        url: links[i].url,
        title: links[i].title,
        snippet: snippets[i] || ''
      });
    }
    
    res.status(200).json({
      query,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('Error en web-search:', error);
    res.status(500).json({ 
      error: 'Error en búsqueda: ' + error.message 
    });
  }
}

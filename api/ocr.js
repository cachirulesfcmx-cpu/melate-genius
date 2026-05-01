// /api/ocr.js — Vercel Serverless Function
// OCR de fotos de boletos de Progol usando Claude Vision API
//
// Uso desde el frontend:
//   fetch('/api/ocr', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ 
//       imageBase64: '...',  // base64 sin el prefijo "data:image/..."
//       mediaType: 'image/jpeg',  // o image/png
//       tipo: 'progol' // o 'revancha' o 'media_semana'
//     })
//   })
//
// Devuelve:
//   { partidos: [{numero: 1, local: "Cruz Azul", visitante: "América"}, ...] }
 
const PROMPTS = {
  progol: `Esta es una foto del boletín oficial de PROGOL (México). 
La quiniela tiene 14 partidos numerados del 1 al 14. 
Para cada partido, identifica el equipo local y el equipo visitante.
Devuelve SOLO un JSON válido en este formato exacto, sin markdown ni texto adicional:
 
{
  "jornada": número_de_la_jornada_si_se_ve,
  "fecha": "fecha_si_se_ve_o_null",
  "partidos": [
    {"numero": 1, "local": "nombre_equipo_local", "visitante": "nombre_equipo_visitante", "liga": "liga_si_se_identifica"},
    ...14 partidos
  ]
}
 
Si solo identificas algunos partidos, devuelve los que veas con su número correcto.`,
 
  revancha: `Esta es una foto del boletín oficial de PROGOL REVANCHA (México).
La quiniela tiene 7 partidos numerados del 1 al 7.
Para cada partido, identifica el equipo local y el equipo visitante.
Devuelve SOLO un JSON válido en este formato exacto, sin markdown ni texto adicional:
 
{
  "jornada": número_de_la_jornada_si_se_ve,
  "fecha": "fecha_si_se_ve_o_null",
  "partidos": [
    {"numero": 1, "local": "nombre_equipo_local", "visitante": "nombre_equipo_visitante", "liga": "liga_si_se_identifica"}
  ]
}`,
 
  media_semana: `Esta es una foto del boletín oficial de PROGOL MEDIA SEMANA (México).
La quiniela tiene 9 partidos numerados del 1 al 9.
Para cada partido, identifica el equipo local y el equipo visitante.
Devuelve SOLO un JSON válido en este formato exacto, sin markdown ni texto adicional:
 
{
  "jornada": número_de_la_jornada_si_se_ve,
  "fecha": "fecha_si_se_ve_o_null",
  "partidos": [
    {"numero": 1, "local": "nombre_equipo_local", "visitante": "nombre_equipo_visitante", "liga": "liga_si_se_identifica"}
  ]
}`
};
 
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key no configurada' });
  }
  
  const { imageBase64, mediaType = 'image/jpeg', tipo = 'progol' } = req.body;
  
  if (!imageBase64) {
    return res.status(400).json({ error: 'Falta imageBase64 en el body' });
  }
  
  if (!['progol', 'revancha', 'media_semana'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo debe ser progol, revancha, o media_semana' });
  }
  
  // Limpia el base64 si viene con prefijo "data:image/..."
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
  
  const prompt = PROMPTS[tipo];
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: cleanBase64
                }
              },
              { type: 'text', text: prompt }
            ]
          }
        ]
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || data.error) {
      return res.status(response.status || 500).json({ 
        error: data.error?.message || 'Error en API' 
      });
    }
    
    // Extrae el texto de la respuesta
    const textContent = data.content?.find(c => c.type === 'text')?.text || '';
    
    // Intenta parsear JSON
    let parsed;
    try {
      // Limpia posibles markdown fences
      const cleaned = textContent
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      return res.status(500).json({
        error: 'No se pudo parsear la respuesta como JSON',
        rawResponse: textContent
      });
    }
    
    // Valida estructura
    if (!Array.isArray(parsed.partidos)) {
      return res.status(500).json({
        error: 'La respuesta no contiene un array de partidos válido',
        parsed
      });
    }
    
    res.status(200).json({
      success: true,
      tipo,
      ...parsed,
      tokens_used: data.usage
    });
    
  } catch (error) {
    console.error('Error en OCR:', error);
    res.status(500).json({ 
      error: 'Error al procesar la imagen: ' + error.message 
    });
  }
}
 

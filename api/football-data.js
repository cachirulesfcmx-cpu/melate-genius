// /api/football-data.js — Vercel Serverless Function
// 
// Proxy a Football-data.org (API gratuita)
// 
// Permite al agente IA obtener datos REALES de equipos:
//   - Tabla de posiciones actual
//   - Últimos partidos
//   - Próximos partidos
//   - Plantilla
// 
// Plan free: 12 ligas top (Premier, La Liga, Bundesliga, Serie A, Ligue 1,
// Eredivisie, Liga MX, Championship, MLS, etc.) — 10 req/min, 1,440/día.
// 
// CONFIG:
//   Necesitas registrarte gratis en https://www.football-data.org/client/register
//   y agregar la variable de entorno FOOTBALL_DATA_TOKEN en Vercel.
//   Si no está configurado, devuelve {error: "API key no configurada"}
//   y el agente seguirá usando solo web search.
 
const LIGA_MAP = {
  // Football-data.org competition IDs (gratis tier)
  'premier league': 'PL',
  'premier': 'PL',
  'la liga': 'PD',
  'liga española': 'PD',
  'laliga': 'PD',
  'bundesliga': 'BL1',
  'serie a': 'SA',
  'ligue 1': 'FL1',
  'eredivisie': 'DED',
  'liga portugal': 'PPL',
  'primeira liga': 'PPL',
  'championship': 'ELC',
  'mls': 'MLS',
  'liga mx': 'LMX',
  'brasileirao': 'BSA',
  'copa libertadores': 'CLI',
  'champions league': 'CL',
  'europa league': 'EL',
  'world cup': 'WC',
  'euro': 'EC'
};
 
function detectarLiga(nombre) {
  if (!nombre) return null;
  const lower = nombre.toLowerCase().trim();
  for (const [key, code] of Object.entries(LIGA_MAP)) {
    if (lower.includes(key)) return code;
  }
  return null;
}
 
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return res.status(200).json({ 
      error: 'API key no configurada. Configura FOOTBALL_DATA_TOKEN en Vercel.',
      configured: false,
      help: 'Regístrate gratis en https://www.football-data.org/client/register y agrega el token como variable de entorno en Vercel.'
    });
  }
  
  const { accion, liga, equipo, equipo_local, equipo_visitante } = req.body;
  
  try {
    let url;
    let datos = {};
    
    switch (accion) {
      case 'tabla': {
        // Tabla de posiciones de una liga
        const codigo = detectarLiga(liga);
        if (!codigo) return res.status(400).json({ error: `Liga no soportada: ${liga}` });
        
        url = `https://api.football-data.org/v4/competitions/${codigo}/standings`;
        const response = await fetch(url, { headers: { 'X-Auth-Token': token } });
        
        if (!response.ok) {
          return res.status(response.status).json({ 
            error: `Error API: ${response.status}`,
            details: await response.text().catch(() => '')
          });
        }
        
        const data = await response.json();
        const tabla = data.standings?.[0]?.table || [];
        datos = {
          liga: data.competition?.name,
          temporada: data.season?.startDate?.slice(0, 4),
          tabla: tabla.map(t => ({
            posicion: t.position,
            equipo: t.team?.name,
            partidos: t.playedGames,
            ganados: t.won,
            empates: t.draw,
            perdidos: t.lost,
            puntos: t.points,
            gf: t.goalsFor,
            gc: t.goalsAgainst,
            forma: t.form // últimos 5: "WDLWW"
          }))
        };
        break;
      }
      
      case 'forma_equipo': {
        // Últimos partidos de un equipo (busca por nombre en la liga)
        const codigo = detectarLiga(liga);
        if (!codigo || !equipo) {
          return res.status(400).json({ error: 'Falta liga o equipo' });
        }
        
        // Primero obtener el ID del equipo
        const teamsUrl = `https://api.football-data.org/v4/competitions/${codigo}/teams`;
        const teamsResp = await fetch(teamsUrl, { headers: { 'X-Auth-Token': token } });
        const teamsData = await teamsResp.json();
        
        const equipoLower = equipo.toLowerCase();
        const team = teamsData.teams?.find(t => 
          t.name.toLowerCase().includes(equipoLower) ||
          t.shortName?.toLowerCase().includes(equipoLower) ||
          t.tla?.toLowerCase() === equipoLower
        );
        
        if (!team) {
          return res.status(404).json({ 
            error: `Equipo "${equipo}" no encontrado en ${liga}`,
            disponibles: teamsData.teams?.slice(0, 5).map(t => t.name) || []
          });
        }
        
        // Últimos partidos del equipo
        const matchesUrl = `https://api.football-data.org/v4/teams/${team.id}/matches?status=FINISHED&limit=10`;
        const matchesResp = await fetch(matchesUrl, { headers: { 'X-Auth-Token': token } });
        const matchesData = await matchesResp.json();
        
        const partidos = (matchesData.matches || []).slice(0, 10).map(m => ({
          fecha: m.utcDate?.slice(0, 10),
          local: m.homeTeam?.name,
          visitante: m.awayTeam?.name,
          marcador: `${m.score?.fullTime?.home ?? '?'}-${m.score?.fullTime?.away ?? '?'}`,
          ganador: m.score?.winner === 'HOME_TEAM' ? 'L' : m.score?.winner === 'AWAY_TEAM' ? 'V' : 'E',
          esLocal: m.homeTeam?.id === team.id
        }));
        
        // Análisis de forma
        const ultimos5 = partidos.slice(0, 5);
        const formaEquipo = ultimos5.map(p => {
          if (p.ganador === 'E') return 'D';
          if (p.esLocal && p.ganador === 'L') return 'W';
          if (!p.esLocal && p.ganador === 'V') return 'W';
          return 'L';
        }).join('');
        
        const wins = (formaEquipo.match(/W/g) || []).length;
        const draws = (formaEquipo.match(/D/g) || []).length;
        const losses = (formaEquipo.match(/L/g) || []).length;
        
        datos = {
          equipo: team.name,
          liga: liga,
          forma: formaEquipo, // ej: "WDLWW"
          ultimos5: { wins, draws, losses },
          partidos_local: partidos.filter(p => p.esLocal).slice(0, 5).map(p => ({
            fecha: p.fecha, vs: p.visitante, marcador: p.marcador, resultado: p.ganador
          })),
          partidos_visitante: partidos.filter(p => !p.esLocal).slice(0, 5).map(p => ({
            fecha: p.fecha, vs: p.local, marcador: p.marcador, resultado: p.ganador
          })),
          partidos_recientes: partidos.slice(0, 10)
        };
        break;
      }
      
      case 'h2h': {
        // Head to head entre dos equipos
        const codigo = detectarLiga(liga);
        if (!codigo || !equipo_local || !equipo_visitante) {
          return res.status(400).json({ error: 'Falta liga, equipo_local o equipo_visitante' });
        }
        
        const teamsUrl = `https://api.football-data.org/v4/competitions/${codigo}/teams`;
        const teamsResp = await fetch(teamsUrl, { headers: { 'X-Auth-Token': token } });
        const teamsData = await teamsResp.json();
        
        const localLower = equipo_local.toLowerCase();
        const visitLower = equipo_visitante.toLowerCase();
        const teamL = teamsData.teams?.find(t => t.name.toLowerCase().includes(localLower));
        const teamV = teamsData.teams?.find(t => t.name.toLowerCase().includes(visitLower));
        
        if (!teamL || !teamV) {
          return res.status(404).json({ error: 'No se encontraron uno o ambos equipos' });
        }
        
        // Buscar partido próximo o último entre ellos
        const matchesUrl = `https://api.football-data.org/v4/teams/${teamL.id}/matches?limit=50`;
        const matchesResp = await fetch(matchesUrl, { headers: { 'X-Auth-Token': token } });
        const matchesData = await matchesResp.json();
        
        const h2hMatches = (matchesData.matches || []).filter(m => 
          m.homeTeam?.id === teamV.id || m.awayTeam?.id === teamV.id
        ).slice(0, 5);
        
        let resumen = { L: 0, E: 0, V: 0 };
        h2hMatches.forEach(m => {
          if (m.status !== 'FINISHED') return;
          const teamLAsLocal = m.homeTeam?.id === teamL.id;
          const winner = m.score?.winner;
          if (winner === 'DRAW') resumen.E++;
          else if (winner === 'HOME_TEAM') (teamLAsLocal ? resumen.L++ : resumen.V++);
          else if (winner === 'AWAY_TEAM') (teamLAsLocal ? resumen.V++ : resumen.L++);
        });
        
        datos = {
          equipo_local: teamL.name,
          equipo_visitante: teamV.name,
          h2h_resumen: resumen,
          partidos: h2hMatches.map(m => ({
            fecha: m.utcDate?.slice(0, 10),
            local: m.homeTeam?.name,
            visitante: m.awayTeam?.name,
            marcador: `${m.score?.fullTime?.home ?? '?'}-${m.score?.fullTime?.away ?? '?'}`,
            ganador: m.score?.winner === 'HOME_TEAM' ? 'L' : m.score?.winner === 'AWAY_TEAM' ? 'V' : m.score?.winner === 'DRAW' ? 'E' : null
          }))
        };
        break;
      }
      
      default:
        return res.status(400).json({ 
          error: 'Acción inválida', 
          acciones_validas: ['tabla', 'forma_equipo', 'h2h']
        });
    }
    
    res.status(200).json({
      success: true,
      configured: true,
      ...datos
    });
    
  } catch (error) {
    console.error('Error en football-data:', error);
    res.status(500).json({ 
      error: 'Error: ' + error.message,
      configured: true
    });
  }
}

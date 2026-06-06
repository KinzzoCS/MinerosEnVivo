export const demoSettings = {
  liveStreamUrl: "https://www.youtube.com/embed/live_stream?channel=UC4R8DWoMoI7CAwX8_LjQHig",
  liveStatus: true,
  liveTitle: "Mineros vs Dorados - Juego de preparacion"
};

export const demoMatches = [
  { rival: "Dorados", date: "2026-06-12", time: "19:30", stadium: "Estadio Minero", tournament: "Liga Regional" },
  { rival: "Algodoneros", date: "2026-06-15", time: "20:00", stadium: "Parque Norte", tournament: "Temporada 2026" },
  { rival: "Indios", date: "2026-06-19", time: "18:45", stadium: "Estadio Minero", tournament: "Temporada 2026" }
];

export const demoResults = [
  { home: "Mineros", away: "Dorados", homeScore: 7, awayScore: 4, date: "2026-06-01" },
  { home: "Mineros", away: "Algodoneros", homeScore: 3, awayScore: 2, date: "2026-05-28" },
  { home: "Indios", away: "Mineros", homeScore: 5, awayScore: 6, date: "2026-05-24" }
];

export const demoNews = [
  {
    id: "inicio-temporada",
    title: "Mineros abre temporada con una ofensiva encendida",
    summary: "El equipo mostro poder al bate y solidez desde el bullpen en su primer compromiso.",
    content: "Mineros inicio la temporada con una actuacion completa. La ofensiva respondio temprano, el cuerpo de lanzadores controlo los momentos de presion y la aficion acompano con gran energia desde la primera entrada.",
    imageUrl: "assets/img/news-1.svg",
    date: "2026-06-02",
    featured: true
  },
  {
    id: "roster-renovado",
    title: "Roster renovado para competir cada entrada",
    summary: "La directiva confirmo incorporaciones clave para fortalecer defensa, velocidad y pitcheo.",
    content: "El nuevo roster combina experiencia y juventud. La prioridad deportiva es sostener intensidad en defensa, producir carreras con contacto oportuno y mantener profundidad en el relevo.",
    imageUrl: "assets/img/news-2.svg",
    date: "2026-05-30",
    featured: true
  },
  {
    id: "comunidad-minera",
    title: "La comunidad minera tendra nuevas dinamicas en vivo",
    summary: "Mineros TV suma chat, calendario y contenido editorial para acompanar cada transmision.",
    content: "La plataforma Mineros TV nace para reunir transmisiones, informacion y comunidad. El objetivo es que cada aficionado encuentre el juego, el contexto y la conversacion en un solo lugar.",
    imageUrl: "assets/img/news-3.svg",
    date: "2026-05-26",
    featured: true
  }
];

export const demoPlayers = [
  { id: "21", name: "Carlos Mendoza", position: "Pitcher", number: 21, bio: "Lanzador derecho con recta pesada y buen control.", photoUrl: "assets/img/player-1.svg" },
  { id: "8", name: "Rafael Soto", position: "Catcher", number: 8, bio: "Receptor lider, fuerte manejo del staff de pitcheo.", photoUrl: "assets/img/player-2.svg" },
  { id: "14", name: "Luis Herrera", position: "Shortstop", number: 14, bio: "Infielder veloz con gran rango defensivo.", photoUrl: "assets/img/player-3.svg" },
  { id: "33", name: "Diego Torres", position: "Outfielder", number: 33, bio: "Bateador de poder para el centro del lineup.", photoUrl: "assets/img/player-4.svg" },
  { id: "5", name: "Marco Ruiz", position: "Second Base", number: 5, bio: "Contacto consistente y lectura agresiva de bases.", photoUrl: "assets/img/player-5.svg" },
  { id: "47", name: "Javier Luna", position: "Reliever", number: 47, bio: "Brazo de cierre con slider dominante.", photoUrl: "assets/img/player-6.svg" }
];

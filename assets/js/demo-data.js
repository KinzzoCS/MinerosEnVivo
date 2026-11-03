export const demoSettings = {
  activeStream: "1",
  liveStreamUrl1: "https://www.youtube.com/embed/live_stream?channel=UC4R8DWoMoI7CAwX8_LjQHig",
  liveStatus1: true,
  liveTitle1: "Mineros vs Dorados - Juego de preparacion",
  liveStreamUrl2: "https://www.youtube.com/embed/live_stream?channel=UC4R8DWoMoI7CAwX8_LjQHig",
  liveStatus2: false,
  liveTitle2: "Segundo stream - Comentarios alternativos"
};

// Fechas relativas a hoy para que el modo demo siempre tenga juegos próximos y resultados recientes.
function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Configuración de deportes de ejemplo: en el modo demo se muestran los dos.
export const demoSportsConfig = {
  beisbol: {
    activo: true, equipo: "Mineros", nombre: "Mineros de Parral", liga: "Estatal Chihuahua 2026", escudo: "assets/icons/escudo.png",
    redes: { facebook: "https://www.facebook.com/", instagram: "https://www.instagram.com/" }
  },
  basquetbol: { activo: true, equipo: "Mineros", nombre: "Mineros A.C.", liga: "Liga de ejemplo", escudo: "", redes: { facebook: "https://www.facebook.com/" } }
};

// Medios de transmisión de ejemplo (spec 004): dos en vivo y uno apagado, que no aparece en la app.
export const demoStreams = [
  { id: "1", name: "Mineros TV", title: "Mineros vs Dorados - Juego de preparación", url: "https://www.youtube.com/embed/live_stream?channel=UC4R8DWoMoI7CAwX8_LjQHig", live: true, sport: "beisbol", order: 1 },
  { id: "2", name: "La Poderosa De Parral", title: "Narración de La Poderosa", url: "https://www.youtube.com/embed/live_stream?channel=UC4R8DWoMoI7CAwX8_LjQHig", live: true, sport: "beisbol", order: 2 },
  { id: "demo-basquet", name: "Mineros A.C. TV", title: "Básquetbol", url: "https://www.youtube.com/embed/live_stream?channel=UC4R8DWoMoI7CAwX8_LjQHig", live: false, sport: "basquetbol", order: 3 }
];

// Campeonatos y temporadas de ejemplo (spec 003). Las fechas se calculan desde hoy.
function yearFromToday(offset) {
  return new Date().getFullYear() + offset;
}

export const demoChampionships = [
  { id: "demo-estatal", name: "Estatal Chihuahua", sport: "beisbol", logo: "assets/icons/escudo.png" },
  { id: "demo-liga-basquet", name: "Liga de ejemplo", sport: "basquetbol", logo: "" }
];

export const demoSeasons = [
  { id: "demo-estatal-actual", championshipId: "demo-estatal", sport: "beisbol", name: String(yearFromToday(0)), startDate: daysFromToday(-60), endDate: daysFromToday(60) },
  { id: "demo-estatal-pasada", championshipId: "demo-estatal", sport: "beisbol", name: String(yearFromToday(-1)), startDate: daysFromToday(-420), endDate: daysFromToday(-300) },
  { id: "demo-basquet-actual", championshipId: "demo-liga-basquet", sport: "basquetbol", name: `Apertura ${yearFromToday(0)}`, startDate: daysFromToday(-30), endDate: daysFromToday(90) }
];

export const demoMatches = [
  { rival: "Dorados", date: daysFromToday(2), seasonId: "demo-estatal-actual", time: "19:30", stadium: "Estadio Minero", tournament: "Estatal Chihuahua 2026" },
  { rival: "Algodoneros", date: daysFromToday(6), seasonId: "demo-estatal-actual", time: "20:00", stadium: "Parque Norte", tournament: "Estatal Chihuahua 2026", minerIsAway: true },
  { rival: "Indios", date: daysFromToday(9), seasonId: "demo-estatal-actual", time: "18:45", stadium: "Estadio Minero", tournament: "Estatal Chihuahua 2026" },
  { sport: "basquetbol", rival: "Halcones", seasonId: "demo-basquet-actual", date: daysFromToday(3), time: "20:00", stadium: "Gimnasio Municipal", tournament: "Liga de ejemplo" },
  { sport: "basquetbol", rival: "Toros", seasonId: "demo-basquet-actual", date: daysFromToday(8), time: "19:00", stadium: "Gimnasio de Toros", tournament: "Liga de ejemplo", minerIsAway: true }
];

export const demoResults = [
  {
    seasonId: "demo-estatal-actual", home: "Mineros", away: "Dorados", homeScore: 7, awayScore: 4, date: daysFromToday(-3),
    awayInnings: [0, 1, 0, 0, 2, 0, 1, 0, 0], homeInnings: [2, 0, 0, 3, 0, 1, 0, 1],
    awayHits: 8, homeHits: 11, awayErrors: 2, homeErrors: 0
  },
  { seasonId: "demo-estatal-actual", home: "Mineros", away: "Algodoneros", homeScore: 3, awayScore: 2, date: daysFromToday(-7) },
  { home: "Indios", away: "Mineros", homeScore: 5, awayScore: 6, date: daysFromToday(-10) },
  { seasonId: "demo-estatal-pasada", home: "Mineros", away: "Dorados", homeScore: 2, awayScore: 5, date: daysFromToday(-330) },
  { sport: "basquetbol", seasonId: "demo-basquet-actual", home: "Mineros", away: "Halcones", homeScore: 74, awayScore: 70, date: daysFromToday(-2),
    awayPeriods: [18, 20, 15, 17], homePeriods: [20, 16, 19, 19] },
  { sport: "basquetbol", seasonId: "demo-basquet-actual", home: "Toros", away: "Mineros", homeScore: 80, awayScore: 82, date: daysFromToday(-9),
    awayPeriods: [20, 18, 17, 19, 8], homePeriods: [22, 15, 20, 17, 6] }
];

// Juego en vivo de ejemplo, con la misma forma que publica la pizarra en liveGame/actual.
export const demoLiveGame = {
  status: "en_vivo",
  away: "Dorados", home: "Mineros",
  awayInnings: [0, 1, 0, 0, 1, 0], homeInnings: [2, 0, 0, 2, 0],
  awayScore: 2, homeScore: 4,
  awayHits: 6, homeHits: 7, awayErrors: 1, homeErrors: 0,
  inning: 6, half: "alta", balls: 2, strikes: 1, outs: 2,
  bases: [true, false, true]
};

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

export const demoBasketballNews = [
  {
    id: "basquet-arranque",
    sports: ["basquetbol"],
    title: "Mineros A.C. arranca su temporada de básquetbol",
    summary: "El equipo de básquetbol se suma a Mineros TV con transmisiones y resultados.",
    content: "Noticia de ejemplo para el modo demo.",
    imageUrl: "assets/img/news-2.svg",
    date: "2026-05-29",
    featured: true
  },
  {
    id: "dos-deportes",
    sports: ["beisbol", "basquetbol"],
    title: "Béisbol y básquetbol en una sola app",
    summary: "Ahora puedes seguir a los dos equipos de Mineros desde Mineros TV.",
    content: "Noticia de ejemplo que aparece en los dos deportes.",
    imageUrl: "assets/img/news-3.svg",
    date: "2026-05-27",
    featured: true
  }
];

export const demoBasketballPlayers = [
  { id: "b7", sport: "basquetbol", name: "Iván Chávez", position: "Base", number: 7, bio: "Jugador de ejemplo.", photoUrl: "assets/img/player-3.svg" },
  { id: "b11", sport: "basquetbol", name: "Óscar Prieto", position: "Escolta", number: 11, bio: "Jugador de ejemplo.", photoUrl: "assets/img/player-4.svg" },
  { id: "b23", sport: "basquetbol", name: "Jorge Baca", position: "Pívot", number: 23, bio: "Jugador de ejemplo.", photoUrl: "assets/img/player-5.svg" }
];

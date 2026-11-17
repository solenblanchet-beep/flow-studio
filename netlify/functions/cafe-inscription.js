/**
 * Netlify Function — Inscription au Café IA & Systems
 * Crée une fiche prospect dans la CRM Notion (même base que notion-prospect).
 *
 * Variables d'environnement (déjà configurées sur Netlify) :
 *   NOTION_TOKEN   — integration token (secret, jamais côté client)
 *   NOTION_DB_ID   — 2693bb6f-bc49-80c4-9905-000b5a9598ea
 */

const EDITIONS = {
  'saint-germain': { label: 'Saint-Germain-en-Laye', short: 'Saint-Germain', date: '2027-01-20', num: '01' },
  'cergy':         { label: 'Cergy',                 short: 'Cergy',         date: '2027-02-25', num: '02' }
};

const TEAM = {
  'solo':   { label: 'Solo',                 potentiel: 'Faible', priorite: 'P3 - Froid (veille)' },
  '2-10':   { label: '2 à 10 personnes',     potentiel: 'Moyen',  priorite: 'P2 - Tiède (nurture)' },
  '11-50':  { label: '11 à 50 personnes',    potentiel: 'Élevé',  priorite: 'P2 - Tiède (nurture)' },
  '50+':    { label: 'Plus de 50 personnes', potentiel: 'Élevé',  priorite: 'P2 - Tiède (nurture)' }
};

function clean(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_DB_ID = process.env.NOTION_DB_ID || '2693bb6f-bc49-80c4-9905-000b5a9598ea';
  if (!NOTION_TOKEN) {
    console.error('NOTION_TOKEN not set');
    return json(500, { error: 'Server configuration error' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Invalid JSON' }); }

  // Piège à robots : champ invisible pour un humain
  if (clean(body.website, 200)) return json(200, { ok: true });

  const edition   = EDITIONS[body.edition];
  const firstname = clean(body.firstname, 80);
  const lastname  = clean(body.lastname, 80);
  const email     = clean(body.email, 160).toLowerCase();
  const company   = clean(body.company, 160);
  const role      = clean(body.role, 160);
  const team      = TEAM[body.team] || null;
  const challenge = String(body.challenge == null ? '' : body.challenge).trim().slice(0, 1500);
  const optin     = body.optin === true;

  if (!edition || !firstname || !lastname || !company || !role || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: 'Champs obligatoires manquants ou invalides' });
  }

  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  const relance = new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10);
  const dateFr = edition.date.split('-').reverse().join('/');
  const fullName = firstname + ' ' + lastname;

  const notes = [
    'Inscription Café IA & Systems · Édition ' + edition.num + ' · ' + edition.label + ' · ' + dateFr + ' (date à confirmer)',
    'Inscrit le ' + now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
    '',
    'Contact : ' + fullName + ' · ' + email,
    'Entreprise : ' + company,
    'Fonction : ' + role,
    'Taille de l\'équipe : ' + (team ? team.label : 'non renseignée'),
    '',
    'Difficulté à aborder : ' + (challenge || 'non renseignée'),
    '',
    'Accord actualités et invitations Flow Studio : ' + (optin ? 'OUI (' + today + ')' : 'non')
  ].join('\n').slice(0, 1990);

  const properties = {
    'Nom': { title: [{ text: { content: 'Café IA & Systems · ' + edition.short + ' · ' + company } }] },
    'Contact principal': { rich_text: [{ text: { content: fullName } }] },
    'Email': { email: email },
    'Poste': { rich_text: [{ text: { content: role } }] },
    'Entité': { multi_select: [{ name: 'Flow Studio' }] },
    'Type de contact': { select: { name: 'Prospect' } },
    'Source de lead': { select: { name: 'Réseau / événement' } },
    'Offre actuelle': { multi_select: [{ name: 'Flow Studio' }] },
    'Priorité': { select: { name: team ? team.priorite : 'P2 - Tiède (nurture)' } },
    'Prochaine action': { rich_text: [{ text: { content: 'Café IA & Systems ' + edition.short + ' (' + dateFr + ') : confirmer l\'inscription et envoyer le lieu' } }] },
    'Date de dernier contact': { date: { start: today } },
    'Date de relance': { date: { start: relance } },
    'Notes': { rich_text: [{ text: { content: notes } }] }
  };
  if (team) properties['Potentiel'] = { select: { name: team.potentiel } };

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({ parent: { database_id: NOTION_DB_ID }, properties })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Notion API error:', JSON.stringify(data));
      return json(502, { error: 'Notion API error' });
    }
    return json(200, { ok: true });
  } catch (err) {
    console.error('Fetch error:', err);
    return json(500, { error: 'Internal server error' });
  }
};

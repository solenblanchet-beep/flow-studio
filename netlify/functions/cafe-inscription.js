/**
 * Netlify Function — Inscription au Café IA & Systems
 * 1. Crée une fiche prospect dans la CRM Notion
 * 2. Envoie l'email de confirmation (Brevo) avec l'invitation agenda (.ics)
 * 3. Trace l'envoi dans « Dernières actions »
 *
 * Variables d'environnement Netlify : NOTION_TOKEN, NOTION_DB_ID, BREVO_API_KEY
 */
const cafe = require('../lib/cafe');

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
  if (!process.env.NOTION_TOKEN) {
    console.error('NOTION_TOKEN not set');
    return json(500, { error: 'Server configuration error' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Invalid JSON' }); }

  // Piège à robots : champ invisible pour un humain
  if (clean(body.website, 200)) return json(200, { ok: true, emailSent: true });

  const edition   = cafe.EDITIONS[body.edition];
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
    'Inscription Café IA & Systems · Édition ' + edition.num + ' · ' + edition.city + ' · ' + dateFr,
    'Inscrit le ' + cafe.nowParis(),
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
    'Prochaine action': { rich_text: [{ text: { content: 'Café IA & Systems ' + edition.short + ' (' + dateFr + ') : qualifier avant la rencontre' } }] },
    'Date de dernier contact': { date: { start: today } },
    'Date de relance': { date: { start: relance } },
    'Notes': { rich_text: [{ text: { content: notes } }] }
  };
  if (team) properties['Potentiel'] = { select: { name: team.potentiel } };

  // 1. Fiche CRM
  let pageId;
  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: cafe.notionHeaders(),
      body: JSON.stringify({ parent: { database_id: cafe.dbId() }, properties })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Notion API error:', JSON.stringify(data));
      return json(502, { error: 'Notion API error' });
    }
    pageId = data.id;
  } catch (err) {
    console.error('Fetch error:', err);
    return json(500, { error: 'Internal server error' });
  }

  // 2. Email de confirmation (l'inscription reste valide même si l'envoi échoue)
  let emailSent = false, action;
  try {
    const mail = cafe.confirmationEmail(edition, firstname, challenge);
    await cafe.sendEmail({
      to: email, toName: fullName, subject: mail.subject, html: mail.html,
      bcc: cafe.ADMIN_EMAIL, tags: ['confirmation', 'edition-' + edition.num],
      attachment: { name: 'cafe-ia-systems-' + edition.short.toLowerCase().replace(/[^a-z]/g, '') + '.ics', content: cafe.ics(edition, email) }
    });
    emailSent = true;
    action = 'Confirmation Café envoyée le ' + cafe.nowParis();
  } catch (err) {
    console.error('Confirmation email error:', err.message);
    action = 'ÉCHEC envoi confirmation Café le ' + cafe.nowParis() + ' : à envoyer à la main';
  }

  // 3. Traçabilité
  await cafe.appendAction(pageId, '', action);

  return json(200, { ok: true, emailSent });
};

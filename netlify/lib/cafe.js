/**
 * Café IA & Systems — configuration des éditions et emails (Brevo + Notion)
 * Partagé par netlify/functions/cafe-inscription.js et cafe-rappel.js
 *
 * Variables d'environnement Netlify : NOTION_TOKEN, NOTION_DB_ID, BREVO_API_KEY
 */

// ─── À METTRE À JOUR QUAND LE LIEU EST CONFIRMÉ ─────────────────────────────
// address : adresse complète (si vide, le rappel n'est PAS envoyé aux inscrits :
//           Solen reçoit une alerte à la place)
// access  : précision facultative (étage, parking, salle…)
const EDITIONS = {
  'saint-germain': {
    num: '01', short: 'Saint-Germain', city: 'Saint-Germain-en-Laye',
    date: '2027-01-20', dateLabel: 'mercredi 20 janvier 2027',
    theme: "Votre entreprise utilise l'IA. Mais est-elle vraiment intégrée à votre fonctionnement ?",
    address: '', access: ''
  },
  'cergy': {
    num: '02', short: 'Cergy', city: 'Cergy',
    date: '2027-02-25', dateLabel: 'jeudi 25 février 2027',
    theme: 'Votre CRM sert-il réellement à piloter votre activité ?',
    address: '', access: ''
  }
};
const START = '08:30', END = '10:00', HOURS = '8h30–10h';
const SENDER = { name: 'Solen Ouahioune · Flow Studio', email: 'solen@flow-studio.app' };
const ADMIN_EMAIL = 'solen@flow-studio.app';
const SITE = 'https://flow-studio.app';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ─── Invitation agenda (.ics) ─────────────────────────────────────────── */
function ics(edition, attendeeEmail) {
  const d = edition.date.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const where = edition.address ? edition.address : edition.city + ' (adresse exacte envoyée la veille)';
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Flow Studio//Cafe IA Systems//FR', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', 'TZID:Europe/Paris',
    'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'END:STANDARD',
    'BEGIN:DAYLIGHT', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'END:DAYLIGHT',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'UID:cafe-ia-systems-' + edition.num + '-' + d + '-' + String(attendeeEmail).replace(/[^a-z0-9]/gi, '') + '@flow-studio.app',
    'DTSTAMP:' + stamp,
    'DTSTART;TZID=Europe/Paris:' + d + 'T' + START.replace(':', '') + '00',
    'DTEND;TZID=Europe/Paris:' + d + 'T' + END.replace(':', '') + '00',
    'SUMMARY:Café IA & Systems · ' + edition.city,
    'LOCATION:' + where.replace(/[,;]/g, '\\$&'),
    'DESCRIPTION:' + ('Édition ' + edition.num + ' · ' + edition.theme + '\\nContact : ' + ADMIN_EMAIL).replace(/[,;]/g, '\\$&'),
    'ORGANIZER;CN=Solen Ouahioune:mailto:' + ADMIN_EMAIL,
    'END:VEVENT', 'END:VCALENDAR'
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64');
}

/* ─── Gabarit email (charte Flow Studio, tables pour compatibilité) ─────── */
function layout(preheader, inner) {
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
  + '<body style="margin:0;padding:0;background:#EAE6E1;">'
  + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc(preheader) + '</div>'
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EAE6E1;"><tr><td align="center" style="padding:32px 12px;">'
  + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#F7F5F2;">'
  + '<tr><td style="padding:28px 40px;border-bottom:1px solid #D9D3CC;font-family:Georgia,serif;font-size:15px;letter-spacing:5px;text-transform:uppercase;color:#0F0F0F;">Flow Studio</td></tr>'
  + '<tr><td style="padding:40px 40px 36px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#3E3A36;">' + inner + '</td></tr>'
  + '<tr><td style="padding:22px 40px;border-top:1px solid #D9D3CC;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:#8A857F;">'
  + 'Flow Studio · Business Systems Design · <a href="' + SITE + '" style="color:#8A857F;">flow-studio.app</a><br>'
  + 'Vous recevez cet email parce que vous vous êtes inscrit(e) au Café IA &amp; Systems. '
  + '<a href="' + SITE + '/mentions-legales#politique-confidentialite" style="color:#8A857F;">Politique de confidentialité</a>'
  + '</td></tr></table></td></tr></table></body></html>';
}

function eyebrow(t) { return '<p style="margin:0 0 14px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#B5ADA5;">' + t + '</p>'; }
function h1(t) { return '<h1 style="margin:0 0 22px;font-family:Georgia,serif;font-weight:normal;font-size:28px;line-height:1.25;color:#0F0F0F;">' + t + '</h1>'; }
function p(t) { return '<p style="margin:0 0 18px;">' + t + '</p>'; }
function details(rows) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 26px;background:#EAE6E1;">'
    + rows.map(function(r) {
      return '<tr><td style="padding:12px 18px;width:90px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8A857F;vertical-align:top;">' + r[0] + '</td>'
        + '<td style="padding:12px 18px 12px 0;font-size:14px;color:#0F0F0F;vertical-align:top;">' + r[1] + '</td></tr>';
    }).join('') + '</table>';
}
function signature() {
  return '<p style="margin:26px 0 0;">À bientôt,</p><p style="margin:4px 0 0;font-family:Georgia,serif;font-size:17px;color:#0F0F0F;">Solen Ouahioune</p>'
    + '<p style="margin:0;font-size:12px;color:#8A857F;">Fondatrice de Flow Studio</p>';
}
function lieu(edition) {
  if (edition.address) return esc(edition.address) + (edition.access ? '<br><span style="color:#6B6560;font-size:13px;">' + esc(edition.access) + '</span>' : '');
  return esc(edition.city) + '<br><span style="color:#6B6560;font-size:13px;">Adresse exacte envoyée dans le rappel, la veille</span>';
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function confirmationEmail(edition, firstname, challenge) {
  const subject = 'Votre place au Café IA & Systems · ' + edition.city + ', ' + edition.dateLabel.replace(/ \d{4}$/, '');
  const inner = eyebrow('Café IA &amp; Systems · Édition ' + edition.num)
    + h1('Votre place est réservée, ' + esc(firstname) + '.')
    + p('Merci pour votre inscription. Voici les informations pratiques.')
    + details([['Date', cap(esc(edition.dateLabel))], ['Horaire', HOURS], ['Lieu', lieu(edition)], ['Question', esc(edition.theme)]])
    + (challenge ? p('Vous souhaitez aborder : « ' + esc(challenge) + ' ». J\'en tiendrai compte pour préparer la matinée.') : '')
    + p('L\'invitation est jointe à cet email pour l\'ajouter à votre agenda. Un rappel vous sera envoyé la veille. En cas de changement de date ou de lieu, vous serez prévenu(e) par email.')
    + p('Si vous ne pouvez plus venir, répondez simplement à cet email : votre place pourra être proposée à une autre personne.')
    + signature();
  return { subject, html: layout(cap(edition.dateLabel) + ', ' + HOURS + ' · ' + edition.city, inner) };
}

function reminderEmail(edition, firstname) {
  const subject = 'Demain 8h30 · Café IA & Systems à ' + edition.city;
  const inner = eyebrow('Café IA &amp; Systems · Édition ' + edition.num)
    + h1('À demain, ' + esc(firstname) + '.')
    + p('Le Café IA &amp; Systems a lieu demain matin. Voici l\'essentiel.')
    + details([['Date', cap(esc(edition.dateLabel))], ['Horaire', HOURS + ' · accueil dès 8h30'], ['Lieu', lieu(edition)]])
    + p('La question de cette édition : « ' + esc(edition.theme) + ' »')
    + p('Venez avec une situation concrète de votre entreprise : c\'est elle qui nourrit les échanges.')
    + p('Un empêchement ? Répondez à cet email pour libérer votre place.')
    + signature();
  return { subject, html: layout('Demain, ' + HOURS + ' · ' + (edition.address || edition.city), inner) };
}

/* ─── Brevo ─────────────────────────────────────────────────────────────── */
async function sendEmail(opts) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY not set');
  const payload = {
    sender: SENDER,
    to: [{ email: opts.to, name: opts.toName || undefined }],
    replyTo: { email: ADMIN_EMAIL, name: 'Solen Ouahioune' },
    subject: opts.subject,
    htmlContent: opts.html,
    tags: ['cafe-ia-systems'].concat(opts.tags || [])
  };
  if (opts.bcc) payload.bcc = [{ email: opts.bcc }];
  if (opts.attachment) payload.attachment = [opts.attachment];
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'accept': 'application/json', 'content-type': 'application/json', 'api-key': key },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('Brevo ' + res.status + ' ' + t.slice(0, 300));
  }
  return res.json();
}

/* ─── Notion ────────────────────────────────────────────────────────────── */
function notionHeaders() {
  return {
    'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  };
}
function dbId() { return process.env.NOTION_DB_ID || '2693bb6f-bc49-80c4-9905-000b5a9598ea'; }

function plain(prop) {
  if (!prop) return '';
  if (prop.type === 'email') return prop.email || '';
  const arr = prop.rich_text || prop.title || [];
  return arr.map(function(t) { return t.plain_text || (t.text && t.text.content) || ''; }).join('');
}

async function appendAction(pageId, existing, line) {
  const text = (existing ? existing + '\n' : '') + line;
  const res = await fetch('https://api.notion.com/v1/pages/' + pageId, {
    method: 'PATCH',
    headers: notionHeaders(),
    body: JSON.stringify({ properties: { 'Dernières actions': { rich_text: [{ text: { content: text.slice(-1990) } }] } } })
  });
  if (!res.ok) console.error('Notion PATCH error', res.status, await res.text());
}

function nowParis() {
  return new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
}

module.exports = { EDITIONS, ADMIN_EMAIL, esc, ics, confirmationEmail, reminderEmail, sendEmail, notionHeaders, dbId, plain, appendAction, nowParis };

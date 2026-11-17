/**
 * Netlify Scheduled Function — Rappel J-1 du Café IA & Systems
 * Planifiée dans netlify.toml (tous les jours, 8h UTC = 9h à Paris en hiver).
 *
 * Si une édition a lieu demain :
 *   - retrouve les inscrits dans la CRM Notion (titre « Café IA & Systems · <ville> · … »,
 *     hors fiches dont le « Statut de la relation » est « Annulé ») ;
 *   - envoie le rappel à chacun, une seule fois (contrôle via « Dernières actions ») ;
 *   - envoie un récapitulatif à Solen.
 * Si l'adresse du lieu n'est pas renseignée dans netlify/lib/cafe.js, aucun rappel
 * ne part : Solen reçoit une alerte à la place.
 */
const cafe = require('../lib/cafe');

function parisDate(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

async function registrants(edition) {
  const out = [];
  let cursor;
  do {
    const res = await fetch('https://api.notion.com/v1/databases/' + cafe.dbId() + '/query', {
      method: 'POST',
      headers: cafe.notionHeaders(),
      body: JSON.stringify({
        page_size: 100,
        start_cursor: cursor,
        filter: { and: [
          { property: 'Nom', title: { contains: 'Café IA & Systems · ' + edition.short + ' ·' } },
          { property: 'Statut de la relation', select: { does_not_equal: 'Annulé' } }
        ] }
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Notion query ' + res.status + ' ' + JSON.stringify(data).slice(0, 300));
    out.push.apply(out, data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return out;
}

async function adminMail(subject, lines) {
  try {
    await cafe.sendEmail({
      to: cafe.ADMIN_EMAIL, subject: subject, tags: ['admin'],
      html: '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#222;">' + lines.map(cafe.esc).join('<br>') + '</div>'
    });
  } catch (e) { console.error('Admin mail error:', e.message); }
}

exports.handler = async function() {
  const tomorrow = parisDate(1);
  const editions = Object.keys(cafe.EDITIONS).map(function(k) { return cafe.EDITIONS[k]; })
    .filter(function(e) { return e.date === tomorrow; });

  if (!editions.length) {
    console.log('Aucune édition le ' + tomorrow);
    return { statusCode: 200, body: 'no edition tomorrow' };
  }

  for (const edition of editions) {
    let pages;
    try { pages = await registrants(edition); }
    catch (e) {
      console.error(e.message);
      await adminMail('Café IA & Systems · ' + edition.city + ' : rappels NON envoyés', [
        'La lecture du CRM a échoué, aucun rappel n\'est parti.', 'Erreur : ' + e.message,
        'Envoie le rappel à la main aux inscrits de l\'édition ' + edition.num + '.'
      ]);
      continue;
    }

    if (!edition.address) {
      await adminMail('Café IA & Systems · ' + edition.city + ' demain : adresse manquante', [
        pages.length + ' inscrit(s) pour demain, ' + edition.dateLabel + '.',
        'Aucun rappel n\'est parti : l\'adresse du lieu n\'est pas renseignée dans netlify/lib/cafe.js.',
        'Renseigne-la puis relance la fonction « cafe-rappel » depuis Netlify (Functions > cafe-rappel > Run now), ou envoie le rappel à la main.'
      ]);
      continue;
    }

    const seen = {};
    const sent = [], skipped = [], failed = [];
    for (const page of pages) {
      const props = page.properties || {};
      const email = cafe.plain(props['Email']).trim().toLowerCase();
      const name = cafe.plain(props['Contact principal']).trim();
      const actions = cafe.plain(props['Dernières actions']);
      if (!email || seen[email]) { skipped.push((name || page.id) + ' (doublon ou sans email)'); continue; }
      seen[email] = true;
      if (actions.indexOf('Rappel J-1 envoyé') !== -1) { skipped.push(name + ' (déjà reçu)'); continue; }

      const firstname = name.split(' ')[0] || '';
      try {
        const mail = cafe.reminderEmail(edition, firstname);
        await cafe.sendEmail({ to: email, toName: name, subject: mail.subject, html: mail.html, tags: ['rappel', 'edition-' + edition.num] });
        await cafe.appendAction(page.id, actions, 'Rappel J-1 envoyé le ' + cafe.nowParis());
        sent.push(name + ' · ' + email);
      } catch (e) {
        console.error('Reminder error for ' + email + ':', e.message);
        failed.push(name + ' · ' + email);
      }
    }

    await adminMail('Café IA & Systems · ' + edition.city + ' demain : ' + sent.length + ' rappel(s) envoyé(s)', [
      'Édition ' + edition.num + ' · ' + edition.dateLabel + ' · ' + edition.address, '',
      'Envoyés (' + sent.length + ') :'].concat(sent.length ? sent : ['aucun'])
      .concat(failed.length ? ['', 'ÉCHECS, à relancer à la main (' + failed.length + ') :'].concat(failed) : [])
      .concat(skipped.length ? ['', 'Ignorés (' + skipped.length + ') :'].concat(skipped) : []));
  }

  return { statusCode: 200, body: 'done' };
};

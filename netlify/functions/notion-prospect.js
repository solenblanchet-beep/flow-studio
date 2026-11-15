/**
 * Netlify Function — Création d'un prospect dans la CRM Notion
 * Base : collection://2693bb6f-bc49-80c4-9905-000b5a9598ea
 *
 * Variables d'environnement requises sur Netlify :
 *   NOTION_TOKEN   — integration token (secret)
 *   NOTION_DB_ID   — 2693bb6f-bc49-80c4-9905-000b5a9598ea
 */

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_DB_ID = process.env.NOTION_DB_ID || '2693bb6f-bc49-80c4-9905-000b5a9598ea';

  if (!NOTION_TOKEN) {
    console.error('NOTION_TOKEN not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, email, company, budget, priority, notes } = body;

  if (!name || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'name and email required' }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  const pageTitle = `Prospect Flow Private AI — ${today}${company ? ' — ' + company : ''}`;

  const notionPayload = {
    parent: { database_id: NOTION_DB_ID },
    properties: {
      // Champ titre
      'Nom': {
        title: [{ text: { content: pageTitle } }]
      },
      // Entité
      'Entité': {
        multi_select: [{ name: 'Flow Studio' }]
      },
      // Type de contact
      'Type de contact': {
        select: { name: 'Prospect' }
      },
      // Source de lead
      'Source de lead': {
        select: { name: 'Site web' }
      },
      // Offre actuelle
      'Offre actuelle': {
        multi_select: [{ name: 'Flow Studio' }]
      },
      // Priorité calculée
      'Priorité': {
        select: { name: priority || 'P2 - Tiède (nurture)' }
      },
      // Budget estimé (TCO infrastructure privée)
      'Budget estimé': {
        number: budget || null
      },
      // Prochaine action
      'Prochaine action': {
        rich_text: [{ text: { content: 'Appel découverte Flow Private AI' } }]
      },
      // Notes : simulation complète + contact
      'Notes': {
        rich_text: [{
          text: {
            content: `Contact : ${name} — ${email}${company ? ' — ' + company : ''}\n\n${notes || ''}`
          }
        }]
      }
    }
  };

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(notionPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Notion API error:', JSON.stringify(data));
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Notion API error', details: data.message })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, page_id: data.id })
    };

  } catch (err) {
    console.error('Fetch error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

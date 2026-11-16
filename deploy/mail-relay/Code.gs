/**
 * Mail relay for the Maritime Safety Heritage Archive.
 *
 * Some hosts (Render's free plan, for example) block the ports email normally uses, so the server sends
 * each email here over HTTPS and this script sends it from the Gmail account that owns the script.
 * Free Gmail accounts can send about 100 emails a day this way.
 *
 * Setup: script.google.com, New project, paste this file, Deploy, New deployment, type "Web app",
 * Execute as "Me", Who has access "Anyone", Deploy, authorise, then copy the Web app URL into the
 * server's MAIL_WEBHOOK_URL setting. Treat that URL like a password: anyone who has it can send email
 * from this account.
 */
function doPost(e) {
  var m;
  try { m = JSON.parse(e.postData.contents); } catch (err) { return reply('bad request'); }
  var to = String(m.to || '').trim();
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to) || !m.subject) return reply('bad request');
  MailApp.sendEmail({
    to: to,
    subject: String(m.subject).slice(0, 250),
    body: String(m.text || ''),
    name: String(m.name || 'Maritime Safety Heritage Archive').slice(0, 80)
  });
  return reply('sent');
}

function doGet() { return reply('Maritime Safety Heritage mail relay is running.'); }

function reply(text) { return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT); }

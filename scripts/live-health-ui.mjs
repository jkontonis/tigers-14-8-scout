// Apply only health messaging to the already-built tournament interface.
import fs from 'node:fs';
const patch = (file, edit) => { const before = fs.readFileSync(file, 'utf8'); fs.writeFileSync(file, edit(before)); };
const replace = (text, from, to) => { if (!text.includes(from)) throw new Error('Health integration anchor missing: ' + from.slice(0,70)); return text.replace(from,to); };
patch('assets/tournament.js', text => {
  if (text.includes('reader-health-ui-v1')) return text;
  text = "import {readerHealth} from '/lib/reader-health.js?v=1'; // reader-health-ui-v1\n" + text;
  text = replace(text, 'function sourceStatus(){', "function sourceStatus(){const health=readerHealth(data?.meta);const prefix=data&&health.paused?health.title+': '+health.message+' ':'';");
  text = replace(text, "return (dataError?'Unable to refresh.", "return prefix+(dataError?'Unable to refresh.");
  text = replace(text, 'function renderData(){', "function renderData(){const health=readerHealth(data?.meta);const banner=document.getElementById('reader-health-banner');if(banner){banner.hidden=!data||!health.paused;banner.textContent=health.title+'. '+health.message;}");
  return text.replace('./scout-v3.js?v=1', './scout-v3.js?v=health-1');
});
patch('assets/scout-v3.js', text => {
  if (text.includes('reader-health-ui-v1')) return text;
  text = "import {readerHealth} from '/lib/reader-health.js?v=1'; // reader-health-ui-v1\n" + text;
  text = replace(text, 'function cover(){const c=', 'function cover(){const health=readerHealth(data.meta);const c=');
  text = replace(text, "classList.toggle('stale',stale||", "classList.toggle('stale',health.paused||stale||");
  text = replace(text, "${stale?'SOURCE CHECK OVERDUE':'COLLECTED DATA'}", "${health.paused?health.title:stale?'SOURCE CHECK OVERDUE':'COLLECTED DATA'}");
  return replace(text, '<small>Reload reads the latest published snapshot.', "${health.paused?'<p><strong>'+esc(health.message)+'</strong></p>':''}<small>Reload reads the latest published snapshot.");
});
patch('index.html', text => {
  if (!text.includes('id="reader-health-banner"')) text = replace(text, '<main id="app-main">', '<main id="app-main"><div id="reader-health-banner" role="status" hidden style="border:1px solid #ffcb08;background:var(--app-surface);border-radius:14px;padding:15px;margin-bottom:20px;font-size:14px;line-height:1.55"></div>');
  return text.replace('/assets/tournament.js?v=scout-3','/assets/tournament.js?v=health-1');
});
console.log('Reader health messaging ready; no source timestamps or results changed');

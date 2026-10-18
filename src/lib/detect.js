import { franc } from 'franc-min';
import { byIso3 } from './languages.js';
import { stripTags } from './tagged.js';

// Rilevamento locale della lingua (nessuna chiamata di rete, nessun costo).
// Restituisce la lingua riconosciuta oppure null se il testo è insufficiente o la lingua non è in elenco;
// in quel caso il modello rileverà la lingua da solo durante la traduzione.
export function detectLanguage(segments) {
  let sample = '';
  for (const s of segments) {
    if (sample.length > 6000) break;
    sample += stripTags(s).replace(/[*_`#>[\]()!]/g, ' ') + '\n';
  }
  if (sample.trim().length < 20) return null;
  const iso3 = franc(sample, { minLength: 20 });
  if (iso3 === 'und') return null;
  return byIso3(iso3);
}

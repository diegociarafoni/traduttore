# Traduzione

## Modelli

L'utente sceglie il modello nell'interfaccia (`MODELS` in `src/lib/translate.js`):

| Modello                         | Uso consigliato                | Prezzo indicativo (USD per milione di token, ingresso/uscita) |
| ------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| `claude-opus-5-5` (predefinito) | qualità massima                | 4 / 20                                                        |
| `claude-sonnet-5-5`             | equilibrio tra qualità e costo | 2 / 10                                                        |
| `claude-haiku-5-5`              | documenti lunghi e bozze       | 0,10 / 0,50                                                   |

Le richieste usano lo streaming, `effort: low` (la traduzione non richiede ragionamenti lunghi e così costa meno) e, per Opus e Sonnet, il fallback lato server sui rifiuti (`fallbacks: "default"`); se l'API non accetta il parametro, la richiesta viene ripetuta senza.

## Segmenti e lotti

1. Ogni testo traducibile del documento è un **segmento**: un paragrafo, un titolo, una voce di elenco, una cella.
2. I segmenti senza lettere (numeri, simboli) non si inviano; quelli identici si traducono una volta sola (RF-13).
3. I segmenti si raggruppano in **lotti** di circa 6000 caratteri o 80 segmenti, inviati con tre richieste in parallelo. Ogni lotto contiene segmenti consecutivi, così il modello vede il contesto e mantiene la terminologia coerente.
4. Nel messaggio ogni segmento è racchiuso in `<s i="N">…</s>`; la risposta deve rispettare la stessa numerazione.

## Tag della formattazione

La formattazione in linea dei percorsi sul posto viaggia come tag numerati (`Ciao <1>mondo</1><2/>`, vedi `src/lib/tagged.js`). Il testo è sempre escapato (`&amp;`, `&lt;`, `&gt;`). Alla risposta si verifica che ogni segmento contenga gli stessi tag dell'originale; i segmenti mancanti o con tag diversi vengono richiesti di nuovo, prima dividendo il lotto e poi singolarmente.

## Rilevamento della lingua

Il rilevamento avviene nel browser con `franc-min` sui primi 6000 caratteri, senza chiamate di rete né costi. Se il testo è troppo breve o la lingua non è tra quelle supportate, il modello riceve l'istruzione di riconoscerla da sé. Se l'utente sceglie la lingua di origine, quella prevale. Se la lingua rilevata coincide con quella di destinazione, l'interfaccia lo segnala senza bloccare.

## Stima dei costi

Prima della traduzione si mostrano caratteri, token stimati (un token ogni 3,5 caratteri circa) e costo, contando un'uscita pari a 1,3 volte l'ingresso. È un ordine di grandezza: i prezzi effettivi sono quelli del listino di Anthropic.

## Errori

Gli errori dell'API sono tradotti in messaggi in italiano (`describeApiError`): chiave non valida, permessi, limite di richieste, rete, rifiuto del modello, annullamento. L'SDK ripete in automatico fino a quattro volte le richieste fallite per sovraccarico o limite di frequenza.

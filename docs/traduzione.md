# Traduzione

## Servizio

La traduzione usa l'API di [DeepL](https://developers.deepl.com/docs) (`/v2/translate`). Il browser non parla direttamente con DeepL: passa dal proxy in `worker/`, che aggiunge la chiave e controlla la parola d'ordine ([proxy.md](proxy.md)). Il client è `createClient` in `src/lib/translate.js`.

Le lingue disponibili sono quelle supportate da DeepL (`src/lib/languages.js`); per ognuna sono indicati il codice di origine e quello di destinazione. Dove DeepL chiede una variante si usa quella europea: inglese britannico (`EN-GB`), portoghese europeo (`PT-PT`), cinese semplificato (`ZH-HANS`).

## Segmenti e lotti

1. Ogni testo traducibile del documento è un **segmento**: un paragrafo, un titolo, una voce di elenco, una cella.
2. I segmenti senza lettere (numeri, simboli) non si inviano; quelli identici si traducono una volta sola (RF-13).
3. I segmenti si raggruppano in **lotti** di al massimo 50 segmenti o 25 000 caratteri, inviati con due richieste in parallelo; al primo errore non si inviano altri lotti. I limiti stanno sotto quelli del proxy (50 testi, 120 kB per richiesta). Un segmento oltre 20 000 caratteri (per esempio un testo senza righe vuote) si divide a fine riga, a fine frase o a uno spazio (`splitLong`), si traduce a pezzi senza formattazione e si ricompone.
4. Le risposte 429 e 5xx si ripetono fino a tre volte con attesa crescente (1, 2, 4 secondi), tranne gli errori che un nuovo tentativo non risolve (quota esaurita, configurazione, parola d'ordine, richiesta non valida), che si segnalano subito.

## Tag della formattazione

La formattazione in linea viaggia come tag numerati (`Ciao <1>mondo</1><2/>`, vedi `src/lib/tagged.js`), sia nei percorsi sul posto sia nelle conversioni: in queste il Markdown in linea (`**grassetto**`, `*corsivo*`, link) diventa tag con `inlineToTagged` e torna Markdown con `taggedToInline` (`src/lib/inline.js`). Codice in linea e immagini diventano tag vuoti, così DeepL non li traduce. I testi semplici (txt, pdf) viaggiano senza tag.

DeepL accetta solo XML ben formato, quindi prima dell'invio `<1>` diventa `<t1>` (`toDeeplXml`) e al ritorno si fa il contrario (`fromDeeplXml`); la richiesta usa `tag_handling: xml`. Il testo è sempre escapato (`&amp;`, `&lt;`, `&gt;`). Alla risposta si verifica che ogni segmento contenga gli stessi tag dell'originale; i segmenti mancanti o con tag diversi vengono richiesti di nuovo, prima dividendo il lotto e poi singolarmente. Un segmento che resta senza risposta anche dopo l'ultimo tentativo rimane nella lingua originale: `translateSegments` li conta con `onUntranslated` e l'interfaccia, al termine, avvisa quanti sono (RF-20).

## Rilevamento della lingua

Al caricamento la lingua si stima nel browser con `franc-min` sui primi 6000 caratteri, senza chiamate di rete, e si mostra nell'interfaccia. Se l'utente lascia «Rilevamento automatico», la richiesta non indica la lingua di origine e la riconosce DeepL, in modo più affidabile della stima locale. Se l'utente sceglie la lingua di origine, quella viene passata a DeepL. Se la lingua rilevata coincide con quella di destinazione, l'interfaccia lo segnala senza bloccare.

## Caratteri e quota

DeepL conta i caratteri del testo inviato. Prima della traduzione l'interfaccia mostra i caratteri da tradurre (`countCharacters`: testo visibile, senza tag e senza i segmenti non traducibili) e la quota del mese ancora disponibile, letta dal proxy (`/api/utilizzo`, che interroga `/v2/usage`). Se il documento supera la quota residua compare un avviso; la quota si aggiorna dopo ogni traduzione.

## Errori

Il proxy risponde con un codice di errore (`parola_d_ordine`, `quota`, `troppe_richieste`, `configurazione`, `troppo_grande`, `richiesta_non_valida`, `servizio`); `describeError` li traduce in messaggi in italiano, insieme alla rete assente e all'annullamento.

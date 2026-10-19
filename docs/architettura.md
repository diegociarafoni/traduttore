# Architettura

## Stack

- Sito statico in JavaScript (moduli ES) costruito con [Vite](https://vite.dev); nessun server applicativo.
- Traduzione con l'API di [DeepL](https://developers.deepl.com) o di [Claude](https://platform.claude.com/docs), raggiunte tramite un proxy su Cloudflare Workers (`worker/`) che custodisce la chiave e controlla la parola d'ordine ([proxy.md](proxy.md)).
- Librerie per i formati: `marked` (Markdown), `mammoth` e `docx` (Word), `jszip` (EPUB e pacchetti Office), `pdfjs-dist` (lettura PDF), `jspdf` con i caratteri DejaVu (scrittura PDF), `franc-min` (rilevamento della lingua).

## Componenti

| Modulo                 | Ruolo                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| `src/main.js`          | Interfaccia: eventi, stato della pagina, avanzamento e download       |
| `src/lib/pipeline.js`  | Registro dei formati; sceglie il percorso, legge, traduce e scrive    |
| `src/lib/model.js`     | Modello documento comune e conversione da HTML a blocchi              |
| `src/lib/formats/`     | Lettura e scrittura di ogni formato                                   |
| `src/lib/translate.js` | Lotti, ritentativi, client del proxy, conteggio dei caratteri, errori |
| `src/lib/tagged.js`    | Codifica a tag numerati della formattazione in linea                  |
| `src/lib/inline.js`    | Formattazione in linea in stile Markdown                              |
| `src/lib/detect.js`    | Rilevamento locale della lingua                                       |
| `src/i18n/`            | Catalogo dei testi dell'interfaccia                                   |
| `worker/src/index.js`  | Proxy verso DeepL e Claude: parola d'ordine, limiti, CORS             |

## Modello documento

Tutti i formati, nel percorso di conversione, passano da una struttura comune:

```js
{ title, name, chapters: [{ title, blocks: [
  { type: 'heading', level, text }, { type: 'paragraph', text }, { type: 'list', ordered, items },
  { type: 'quote', text }, { type: 'code', text }, { type: 'table', rows }, { type: 'hr' },
] }] }
```

Il testo dei blocchi usa la formattazione in linea di Markdown (`**grassetto**`, `*corsivo*`, `` `codice` ``, link). I blocchi letti da testo semplice e PDF hanno `plain: true`: il loro testo non viene interpretato come Markdown.

## Flusso di una traduzione

1. **Analisi** (`inspectFile`): al caricamento il file viene letto per estrarre i segmenti, rilevare la lingua e contare i caratteri da tradurre.
2. **Percorso**:
   - _sul posto_ per docx→docx ed epub→epub: si modifica solo il testo dentro il pacchetto originale ([formati.md](formati.md#traduzione-sul-posto));
   - _conversione_ negli altri casi: lettura nel modello documento, traduzione dei testi, scrittura nel formato scelto.
3. **Traduzione** (`translateSegments`): deduplicazione, lotti, chiamate parallele, verifica dei tag ([traduzione.md](traduzione.md)).
4. **Download**: il risultato è un `Blob` scaricato con nome `<nome>.<lingua>.<estensione>`.

## Aggiungere un formato

Ogni formato è una voce di `FORMATS` in `src/lib/pipeline.js`: etichetta, estensione, `parse` e `render` verso e dal modello documento e, se serve, `inPlace` (traduzione senza conversione) e `inspect` (segmenti da contare quando differiscono da quelli del modello). Il resto della pipeline e l'interfaccia leggono il registro, quindi un formato nuovo si aggiunge in un solo punto, più il modulo in `src/lib/formats/` e la voce `format.<sigla>` nel catalogo dei testi.

Le librerie pesanti per il PDF (pdf.js, jsPDF, caratteri) si caricano solo quando servono.

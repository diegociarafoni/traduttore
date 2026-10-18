# Architettura

## Stack

- Sito statico in JavaScript (moduli ES) costruito con [Vite](https://vite.dev); nessun server applicativo.
- Traduzione con l'API di [DeepL](https://developers.deepl.com), raggiunta tramite un proxy su Cloudflare Workers (`worker/`) che custodisce la chiave e controlla la parola d'ordine ([proxy.md](proxy.md)).
- Librerie per i formati: `marked` (Markdown), `mammoth` e `docx` (Word), `jszip` (EPUB e pacchetti Office), `pdfjs-dist` (lettura PDF), `jspdf` con i caratteri DejaVu (scrittura PDF), `franc-min` (rilevamento della lingua).

## Componenti

| Modulo                 | Ruolo                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| `src/main.js`          | Interfaccia: eventi, stato della pagina, avanzamento e download        |
| `src/lib/pipeline.js`  | Sceglie il percorso (sul posto o conversione), legge, traduce e scrive |
| `src/lib/model.js`     | Modello documento comune e conversione da HTML a blocchi               |
| `src/lib/formats/`     | Lettura e scrittura di ogni formato                                    |
| `src/lib/translate.js` | Lotti, ritentativi, client del proxy, conteggio dei caratteri, errori  |
| `src/lib/tagged.js`    | Codifica a tag numerati della formattazione in linea                   |
| `src/lib/inline.js`    | Formattazione in linea in stile Markdown                               |
| `src/lib/detect.js`    | Rilevamento locale della lingua                                        |
| `src/i18n/`            | Catalogo dei testi dell'interfaccia                                    |
| `worker/src/index.js`  | Proxy verso DeepL: parola d'ordine, limiti, CORS                       |

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

Le librerie pesanti per il PDF (pdf.js, jsPDF, caratteri) si caricano solo quando servono.

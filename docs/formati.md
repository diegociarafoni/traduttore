# Formati

| Formato                       | Lettura                                                                                                                 | Scrittura                                                                     | Sul posto                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| Markdown (`.md`, `.markdown`) | `marked`: titoli, paragrafi, elenchi, citazioni, codice, tabelle, righe; i link per riferimento diventano link in linea | Markdown standard (GFM per le tabelle)                                        | no, ma l'andata e ritorno conserva la struttura |
| Testo (`.txt`)                | paragrafi separati da righe vuote (senza righe vuote, una riga per paragrafo), elenchi con `-`, `*`, `•` o numeri       | testo semplice, titoli principali in maiuscolo                                | no                                              |
| Word (`.docx`)                | `mammoth` (HTML) per la conversione                                                                                     | `docx`: titoli, elenchi puntati e numerati, citazioni, codice, tabelle, link  | sì                                              |
| EPUB (`.epub`)                | pagine XHTML nell'ordine dello spine                                                                                    | EPUB 3 con indice `nav.xhtml` e `toc.ncx`, un file per capitolo               | sì                                              |
| PDF (`.pdf`)                  | livello di testo con `pdf.js`: righe, paragrafi, titoli dalla dimensione del carattere, elenchi                         | `jsPDF` con DejaVu Sans (latino, greco, cirillico), A4, impaginazione propria | no                                              |

## Traduzione sul posto

Quando ingresso e uscita sono docx o epub, il file originale non viene ricostruito: si cambia solo il testo.

- **Word**: si traducono i paragrafi di `word/document.xml`, intestazioni, piè di pagina, note. I _run_ consecutivi con la stessa formattazione si uniscono; quelli con formattazione diversa diventano tag numerati (`<1>…</1>`), così il grassetto resta sulle parole giuste anche se cambia l'ordine. Tabulazioni e a capo dentro un run (`w:tab`, `w:br`, comprese le interruzioni di pagina) restano al loro posto. Il testo delle caselle di testo si traduce come paragrafo a sé. Si aggiorna la lingua di correzione (`w:lang`).
- **EPUB**: si traducono i blocchi «foglia» di ogni pagina XHTML (paragrafi, titoli, voci di elenco, celle…), il titolo della pagina, le voci di `toc.ncx` e il titolo nei metadati. Gli elementi in linea (`em`, `strong`, `a`, `span`, `br`, `img`) diventano tag numerati e vengono ricostruiti clonando gli originali, con attributi, classi e link. `code` e `pre` non si traducono. Il testo diretto di un blocco che contiene altri blocchi (per esempio «Capitolo 1» in `<li>Capitolo 1<ol>…</ol></li>` dell'indice) si traduce come unità a sé. Se i tag si perdono anche dopo i ritentativi, il blocco diventa testo semplice ma conserva immagini e codice in linea. Si aggiornano `lang` e `dc:language`.

Se DeepL perde o inventa un tag anche dopo i ritentativi, il paragrafo viene scritto come testo semplice nel primo elemento: il contenuto resta corretto, si perde solo la formattazione interna di quel paragrafo.

## Limiti noti

- **PDF**: serve il livello di testo; un PDF scansionato produce il messaggio «Il PDF non contiene testo selezionabile» (OCR in [backlog.md](backlog.md), RF-14). L'impaginazione originale, le immagini e le colonne multiple non vengono riprodotte; i numeri di pagina isolati vengono scartati e le parole spezzate a fine riga vengono riunite.
- **Conversione**: le immagini non vengono riportate (resta il testo alternativo tra parentesi quadre); gli elenchi annidati diventano un solo livello (RF-19).
- **PDF in uscita**: i caratteri DejaVu non coprono cinese, giapponese, coreano, arabo, ebraico, persiano, hindi e thai; per queste lingue l'interfaccia consiglia docx o epub.

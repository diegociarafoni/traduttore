# Interfaccia

Una sola pagina in tre passi, più l'area delle azioni.

1. **Accesso al servizio**: parola d'ordine (campo nascosto), pulsante **Accedi** e casella «Memorizza la parola d'ordine in questo browser». L'accesso si verifica subito chiedendo al proxy la quota DeepL; l'esito compare sotto il campo.
2. **Documento**: area in cui trascinare il file o aprirlo (anche da tastiera con Invio o Spazio). Dopo l'analisi compaiono nome, formato, lingua rilevata, caratteri da tradurre e, dopo l'accesso, la quota DeepL residua del mese. Se il documento supera la quota compare un avviso.
3. **Opzioni di traduzione**: lingua di origine («Rilevamento automatico» predefinito), lingua di destinazione (italiano predefinito, l'ultima scelta viene ricordata), formato di uscita (quello del file caricato). Una nota spiega cosa si conserva: tutto nei percorsi sul posto, la struttura nelle conversioni, solo il testo dal PDF.

Il pulsante **Traduci** è attivo quando ci sono un documento con testo e un accesso verificato. Durante la traduzione compaiono la barra di avanzamento (segmenti tradotti sul totale) e **Annulla**; al termine il collegamento **Scarica** offre il file `<nome>.<lingua>.<estensione>`.

## Messaggi

I messaggi di stato usano un'area `role="status"` annunciata dai lettori di schermo, con colori distinti per esito positivo, avviso ed errore. I testi sono in `src/i18n/it.json` ([localizzazione.md](localizzazione.md)).

## Aspetto e accessibilità

- Tema chiaro e scuro secondo l'impostazione del sistema (`prefers-color-scheme`), con contrasto WCAG AA in entrambi.
- Ogni campo ha un'etichetta visibile; l'area del file è raggiungibile da tastiera.
- Layout a colonne su schermi larghi, una colonna sul telefono.

I test in `tests/e2e/aspetto.spec.js` verificano con axe-core le regole WCAG 2.1 AA in tema chiaro, scuro e su telefono, l'apertura del file da tastiera, e confrontano le schermate con i riferimenti in `tests/e2e/__screenshots__/`.

# Interfaccia

Una sola pagina in tre passi, più l'area delle azioni.

1. **Accesso al servizio**: parola d'ordine (campo nascosto), pulsante **Accedi** e casella «Memorizza la parola d'ordine in questo browser». L'accesso si verifica subito chiedendo al proxy i motori disponibili e la quota DeepL; l'esito compare sotto il campo.
2. **Documento**: area in cui trascinare il file o aprirlo (anche da tastiera con Invio o Spazio). Dopo l'analisi compaiono nome, formato, lingua rilevata, caratteri da tradurre e, dopo l'accesso e con DeepL come motore, la quota DeepL residua del mese. Se il documento supera la quota compare un avviso.
3. **Opzioni di traduzione**: motore di traduzione (DeepL o Claude, solo se il proxy li offre entrambi; l'ultima scelta viene ricordata), lingua di origine («Rilevamento automatico» predefinito), lingua di destinazione (italiano predefinito, l'ultima scelta viene ricordata), formato di uscita (quello del file caricato). Una nota spiega cosa si conserva: tutto nei percorsi sul posto, la struttura nelle conversioni, solo il testo dal PDF.

Il pulsante **Traduci** è attivo quando ci sono un documento con testo e un accesso verificato; finché manca qualcosa, una riga sotto il pulsante (collegata con `aria-describedby`) dice quale passo completare (RF-21). Durante la traduzione compaiono la barra di avanzamento (segmenti tradotti sul totale) e **Annulla**, mentre documento e opzioni restano bloccati perché non avrebbero effetto sul lavoro in corso. Al termine il collegamento **Scarica** offre il file `<nome>.<lingua>.<estensione>` e riceve il focus; se alcuni segmenti sono rimasti nella lingua originale, un avviso ne indica il numero (RF-20).

## Messaggi

I messaggi di stato usano un'area `role="status"` annunciata dai lettori di schermo, con colori distinti per esito positivo, avviso ed errore. Gli avvisi che dipendono dal documento (quota insufficiente, lingua già uguale alla destinazione) spariscono quando non valgono più; gli esiti della traduzione restano. L'esito dell'accesso è collegato al campo della parola d'ordine, che con una parola errata è marcato `aria-invalid`. I testi sono in `src/i18n/it/` ([localizzazione.md](localizzazione.md)).

## Aspetto e accessibilità

- Tema chiaro e scuro secondo l'impostazione del sistema (`prefers-color-scheme`), con contrasto WCAG AA in entrambi: almeno 4,5:1 per i testi e 3:1 per i bordi dei campi e dell'area del file (`--field-border`, criterio 1.4.11). Il test `tests/unit/contrasto.test.js` calcola i rapporti dalle variabili di `src/style.css`.
- Ogni elemento interattivo mostra un contorno di focus visibile (`:focus-visible`).
- Ogni campo ha un'etichetta visibile; l'area del file è un pulsante (`role="button"`) raggiungibile da tastiera, con i formati ammessi come descrizione.
- Le preferenze salvate nel browser che risultano danneggiate vengono ignorate, senza bloccare la pagina.
- Layout a colonne su schermi larghi, una colonna sul telefono.

I test in `tests/e2e/aspetto.spec.js` verificano con axe-core le regole WCAG 2.1 AA in tema chiaro, scuro e su telefono, l'apertura del file da tastiera, il contorno di focus, l'errore della parola d'ordine annunciato e il focus su **Scarica**, e confrontano le schermate con i riferimenti in `tests/e2e/__screenshots__/`.

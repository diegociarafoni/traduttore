# Dipendenze e licenze

Il codice del progetto è sotto GPL-3.0 o successiva ([LICENSE](../LICENSE)).

## Dipendenze di produzione

| Pacchetto           | Uso                                                              | Licenza                           |
| ------------------- | ---------------------------------------------------------------- | --------------------------------- |
| `@anthropic-ai/sdk` | chiamate all'API Messages                                        | MIT                               |
| `marked`            | lettura del Markdown                                             | MIT                               |
| `mammoth`           | lettura dei docx in HTML                                         | BSD-2-Clause                      |
| `docx`              | scrittura dei docx                                               | MIT                               |
| `jszip`             | pacchetti docx ed epub                                           | MIT o GPL-3.0                     |
| `pdfjs-dist`        | lettura dei PDF (versione `legacy`, compatibile con più browser) | Apache-2.0                        |
| `jspdf`             | scrittura dei PDF                                                | MIT                               |
| `dejavu-fonts-ttf`  | caratteri del PDF in uscita                                      | Bitstream Vera e pubblico dominio |
| `franc-min`         | rilevamento della lingua                                         | MIT                               |

## Controllo automatico

`tool/check-licenses.mjs` legge l'albero delle dipendenze di produzione (`npm ls --omit=dev --all`) e verifica che ogni licenza, o almeno un'alternativa di un'espressione SPDX con `OR`, sia tra quelle ammesse in `tool/policy.json`. Le eccezioni stanno in `licenses.overrides`, ciascuna con il motivo:

- `dejavu-fonts-ttf`: il `package.json` rimanda al file di licenza invece di un identificativo SPDX;
- `duck`: il `package.json` dichiara solo «BSD»; il testo è la BSD a due clausole.

Gira in CI (`npm run check:conventions`). Per aggiungere una licenza ammessa o un'eccezione si modifica `tool/policy.json` nella stessa PR della dipendenza, con il motivo.

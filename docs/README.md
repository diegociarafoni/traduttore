# Documentazione del Traduttore

Il Traduttore è un'applicazione web statica che traduce documenti mantenendo il formato di ingresso o convertendolo in un altro. Tutta l'elaborazione avviene nel browser; il testo da tradurre viene inviato a DeepL attraverso un proxy su Cloudflare Workers, che custodisce la chiave DeepL e accetta solo chi conosce la parola d'ordine.

## Indice

| Documento                                          | Contenuto                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [backlog.md](backlog.md)                           | Requisiti con codice (RF, RNF), stato e funzioni da fare                           |
| [architettura.md](architettura.md)                 | Componenti, modello documento e flusso di una traduzione                           |
| [formati.md](formati.md)                           | Come si leggono e si scrivono md, docx, txt, epub e pdf, con i limiti di ciascuno  |
| [traduzione.md](traduzione.md)                     | DeepL, segmenti, lotti, tag della formattazione, rilevamento della lingua, quota   |
| [proxy.md](proxy.md)                               | Proxy su Cloudflare Workers: parola d'ordine, interfaccia, limiti ed errori        |
| [interfaccia.md](interfaccia.md)                   | Schermata, flusso d'uso, messaggi e accessibilità                                  |
| [localizzazione.md](localizzazione.md)             | Catalogo dei testi dell'interfaccia e come aggiungere una lingua                   |
| [pubblicazione.md](pubblicazione.md)               | Pubblicazione del proxy e del sito, segreti e impostazioni del repository          |
| [sicurezza.md](sicurezza.md)                       | Privacy, segreti, parola d'ordine, Content Security Policy e scansioni automatiche |
| [dipendenze-e-licenze.md](dipendenze-e-licenze.md) | Dipendenze, licenze ammesse e controllo automatico                                 |
| [sviluppo.md](sviluppo.md)                         | Ambiente di sviluppo, comandi, test e metodo di lavoro                             |
| [qualita.md](qualita.md)                           | Controlli di qualità, limiti numerici e dove girano                                |
| [convenzioni-git.md](convenzioni-git.md)           | Rami, commit Angular, hook locali, merge e protezione di main                      |
| [mappa-del-codice.md](mappa-del-codice.md)         | Cartelle del codice e documento che le descrive                                    |

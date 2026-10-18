const REFERENCE = /\b(PR|pull request|issue)\s*#?\d+|\(#\d+\)/i;
const REMINDER = /\b(TODO|FIXME|XXX|HACK)\b(?!: .{15,})/;

// Problemi nei commenti a riga intera (// oppure righe di blocchi /* */).
// Un commento con un indirizzo web è una fonte e non si controlla.
export function checkComments(sources) {
  const problems = [];
  for (const [path, text] of Object.entries(sources)) {
    text.split('\n').forEach((raw, i) => {
      const line = raw.trimStart();
      const isComment = line.startsWith('//') || line.startsWith('/*') || line.startsWith('* ') || line === '*';
      if (!isComment || line.includes('http')) return;
      const where = `${path}:${i + 1}`;
      if (REFERENCE.test(line)) problems.push(`${where}: il commento rimanda a una PR o a un'issue`);
      if (REMINDER.test(line)) {
        problems.push(`${where}: promemoria senza motivo, scrivi "TODO: " e almeno una frase che dica cosa manca`);
      }
    });
  }
  return problems;
}

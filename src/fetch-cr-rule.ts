// fetch-cr-rule.ts
//
// Consulta las Comprehensive Rules oficiales de Magic vía Academy Ruins
// API (academyruins.com), en vez de depender de busquedas web manuales
// cada vez que agregamos una keyword nueva al diccionario de patrones.
//
// Uso:
//   npx ts-node src/fetch-cr-rule.ts <version> <numero_de_regla>
//
// Ejemplo:
//   npx ts-node src/fetch-cr-rule.ts current 702.79a
//
// La <version> es el identificador que usa Academy Ruins para la
// version del CR (ej. un codigo de set como "KLD", o el alias que
// tengan para "la mas reciente" — confirmalo entrando a
// https://academyruins.com/ en el navegador y viendo el link a la
// version vigente, ya que no pude confirmar el alias exacto de
// "ultima version" sin poder ejecutar JavaScript en la documentacion
// interactiva de la API.

async function fetchRule(version: string, ruleNumber: string) {
  const url = `https://api.academyruins.com/file/cr/${encodeURIComponent(version)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`No se pudo descargar el CR version "${version}" (${res.status})`);
  }

  const fullText = await res.text();

  // Las reglas siguen el patron "NNN.NNa Texto de la regla..." — se
  // busca donde empieza el numero exacto y se corta hasta que empiece
  // el siguiente numero de regla (mismo formato) o un doble salto de
  // linea, lo que venga primero.
  const escapedNumber = ruleNumber.replace(/\./g, '\\.');
  const pattern = new RegExp(
    `${escapedNumber}\\.?\\s+([\\s\\S]*?)(?=\\n\\d{3}\\.\\d+[a-z]?\\.?\\s|\\n\\n)`,
    'm',
  );

  const match = fullText.match(pattern);
  if (!match) {
    console.error(`No se encontro la regla ${ruleNumber} en esta version del CR.`);
    return null;
  }

  return match[1].trim();
}

async function main() {
  const [version, ruleNumber] = process.argv.slice(2);

  if (!version || !ruleNumber) {
    console.error('Uso: npx ts-node src/fetch-cr-rule.ts <version> <numero_de_regla>');
    console.error('Ejemplo: npx ts-node src/fetch-cr-rule.ts current 702.79a');
    process.exitCode = 1;
    return;
  }

  const rule = await fetchRule(version, ruleNumber);
  if (rule) {
    console.log(`\nRegla ${ruleNumber}:\n${rule}\n`);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});

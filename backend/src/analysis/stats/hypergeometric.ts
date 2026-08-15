// src/analysis/stats/hypergeometric.ts
//
// Matematica pura de la distribucion hipergeometrica — responde
// preguntas tipo "¿que probabilidad tengo de ver al menos 1 tierra de
// este color en mi mano inicial?". No depende de nada de Magic en si,
// solo de combinatoria — facil de probar de forma aislada.

/**
 * Combinaciones C(n, k), calculadas de forma iterativa (no via
 * factorial directo) para evitar desbordamiento con numeros grandes —
 * un mazo de 100 cartas ya desborda un factorial normal en punto
 * flotante si se calcula ingenuamente.
 */
export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k); // C(n,k) == C(n,n-k), usar el mas chico reduce iteraciones
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

/**
 * P(X = k): probabilidad de exactamente k exitos al tomar una muestra
 * de tamaño 'sampleSize' de una poblacion de 'populationSize' que
 * tiene 'successStates' exitos en total, SIN reemplazo — exactamente
 * como robar cartas de un mazo (una vez que sale, ya no puede volver
 * a salir).
 */
export function hypergeometricPMF(
  populationSize: number,
  successStates: number,
  sampleSize: number,
  k: number,
): number {
  const denominator = combinations(populationSize, sampleSize);
  if (denominator === 0) return 0;

  return (
    (combinations(successStates, k) * combinations(populationSize - successStates, sampleSize - k)) /
    denominator
  );
}

/**
 * P(X >= minSuccesses): probabilidad de ver AL MENOS minSuccesses
 * exitos — la pregunta que casi siempre importa en Magic ("¿al menos
 * 1 fuente de este color?"), no "exactamente N fuentes".
 */
export function hypergeometricAtLeast(
  populationSize: number,
  successStates: number,
  sampleSize: number,
  minSuccesses: number,
): number {
  if (successStates <= 0) return minSuccesses <= 0 ? 1 : 0;
  if (sampleSize <= 0) return minSuccesses <= 0 ? 1 : 0;

  const maxK = Math.min(sampleSize, successStates);
  let probability = 0;
  for (let k = Math.max(minSuccesses, 0); k <= maxK; k++) {
    probability += hypergeometricPMF(populationSize, successStates, sampleSize, k);
  }
  return probability;
}

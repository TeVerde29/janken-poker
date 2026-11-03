/**
 * JANKEN CARDS — Motor de Física de Muelles e Iluminación Especular
 * Basado en Apple WWDC "Designing Fluid Interfaces" (Damping Ratio + Response)
 * Archivo independiente guardado en el Art Pack (No altera el sistema actual).
 */

export const JANKEN_SPRINGS = {
  /** Amortiguación crítica (Damping 1.0, Response 0.40s): Elevación y foco sin rebote */
  tactileSelect: { damping: 1.0, response: 0.40 },
  /** Sub-amortiguado sutil (Damping 0.78, Response 0.38s): Lanzamiento de carta a la mesa */
  cardThrow: { damping: 0.78, response: 0.38 },
  /** Masa mineral pesada (Damping 1.0, Response 0.55s): Revelación simultánea 3D */
  cinematicReveal: { damping: 1.0, response: 0.55 },
  /** Choque simétrico (Damping 0.72, Response 0.32s): Colisión de empate */
  drawCollision: { damping: 0.72, response: 0.32 }
};

/**
 * Conecta el seguimiento 1:1 de puntero (Direct Manipulation) sobre una carta
 * para inclinar su plano 3D y desplazar la luz especular dorada en tiempo real.
 * @param {HTMLElement} cardElement
 */
export function attachTactileCardPhysics(cardElement) {
  let rafId = null;

  const onPointerMove = (e) => {
    const rect = cardElement.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width - 0.5;  // [-0.5, 0.5]
    const normY = (e.clientY - rect.top) / rect.height - 0.5;  // [-0.5, 0.5]

    const rotateY = normX * 22;   // Máx ±11 deg
    const rotateX = -normY * 22;  // Máx ±11 deg
    const sheenX = (normX + 0.5) * 100;
    const sheenY = (normY + 0.5) * 100;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      cardElement.style.transform = `translate3d(0, -16px, 32px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
      cardElement.style.setProperty('--jc-sheen-x', `${sheenX.toFixed(1)}%`);
      cardElement.style.setProperty('--jc-sheen-y', `${sheenY.toFixed(1)}%`);
    });
  };

  const onPointerLeave = () => {
    if (rafId) cancelAnimationFrame(rafId);
    cardElement.style.transform = '';
  };

  cardElement.addEventListener('pointermove', onPointerMove);
  cardElement.addEventListener('pointerleave', onPointerLeave);

  return () => {
    cardElement.removeEventListener('pointermove', onPointerMove);
    cardElement.removeEventListener('pointerleave', onPointerLeave);
  };
}

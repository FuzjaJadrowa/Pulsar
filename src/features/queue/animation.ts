export function animateQueueOrb(
  source:
    | HTMLElement
    | DOMRect
    | { left: number; top: number; width?: number; height?: number }
    | null,
) {
  let startX = window.innerWidth / 2;
  let startY = window.innerHeight / 2;

  if (source) {
    if (
      "getBoundingClientRect" in source &&
      typeof source.getBoundingClientRect === "function"
    ) {
      const rect = source.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0 || rect.left > 0 || rect.top > 0) {
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
      }
    } else if ("left" in source && "top" in source) {
      startX = source.left + (source.width || 0) / 2;
      startY = source.top + (source.height || 0) / 2;
    }
  }

  setTimeout(() => {
    const btn = document.getElementById("btn-queue");
    if (!btn) return;

    if (btn.offsetWidth === 0 && btn.offsetHeight === 0) {
      btn.style.display = "flex";
    }

    const t = btn.getBoundingClientRect();
    const endX = t.left + t.width / 2;
    const endY = t.top + t.height / 2;
    const dx = endX - startX;
    const dy = endY - startY;

    const orb = document.createElement("div");
    orb.className = "queue-orb";
    orb.style.left = `${startX}px`;
    orb.style.top = `${startY}px`;
    document.body.appendChild(orb);

    const a = orb.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0.95 },
        {
          transform: `translate(-50%, -50%) translate(${dx * 0.48}px, ${dy * 0.48 - 30}px) scale(1.2)`,
          opacity: 1,
        },
        {
          transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.7)`,
          opacity: 0.9,
        },
      ],
      { duration: 600, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );

    a.onfinish = () => {
      orb.remove();
      btn.classList.add("queue-pulse");

      setTimeout(() => {
        btn.classList.remove("queue-pulse");
      }, 700);
    };
  }, 10);
}

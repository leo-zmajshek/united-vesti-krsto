/* Last-resort SSR failure page. Rendered when the app cannot boot at all, so it
   carries no CSS from the app — the Macedonian copy and large type are inlined.
   Krsto only reads Macedonian, so this must never fall back to English. */

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="mk">
  <head>
    <meta charset="utf-8" />
    <title>Страницата не се вчита</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#a01a1a" />
    <style>
      body { font: 20px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; background: #fdfbf8; color: #1b1614; display: grid; place-items: center; min-height: 100vh; min-height: 100dvh; margin: 0; padding: 1.5rem; }
      .card { max-width: 30rem; width: 100%; text-align: center; }
      h1 { font-size: 1.85rem; font-weight: 800; line-height: 1.15; margin: 0 0 0.75rem; }
      p { color: #4a423e; margin: 0 0 1.75rem; }
      .actions { display: flex; flex-direction: column; gap: 0.75rem; }
      a, button { display: block; width: 100%; min-height: 3.5rem; padding: 1rem 1.25rem; border-radius: 0.85rem; font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; border: 2px solid transparent; box-sizing: border-box; }
      .primary { background: #a01a1a; color: #fff; }
      .secondary { background: #fff; color: #1b1614; border-color: #d8cfc9; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Страницата не се вчита</h1>
      <p>Проверете го интернетот и обидете се повторно.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Обиди се повторно</button>
        <a class="secondary" href="/">Почетна страница</a>
      </div>
    </div>
  </body>
</html>`;
}

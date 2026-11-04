let installPrompt;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;

  const installButton = document.getElementById('installAppButton');
  if (installButton) installButton.hidden = false;
});

window.addEventListener('appinstalled', () => {
  installPrompt = undefined;
  const installButton = document.getElementById('installAppButton');
  if (installButton) installButton.hidden = true;
});

document.getElementById('installAppButton')?.addEventListener('click', async () => {
  if (!installPrompt) return;

  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = undefined;

  const installButton = document.getElementById('installAppButton');
  if (installButton) installButton.hidden = true;
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .catch((error) => console.error('PWA service worker registration failed:', error));
  });
}

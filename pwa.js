(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  window.addEventListener('load',async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await registration.update();
      const activate = (worker) => { if (worker) worker.postMessage({type:'SKIP_WAITING'}); };
      if (registration.waiting) activate(registration.waiting);
      registration.addEventListener('updatefound',() => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange',() => {
          if (worker.state==='installed' && navigator.serviceWorker.controller) activate(worker);
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange',() => {
        if (sessionStorage.getItem('handelser_sw_reload')==='1') return;
        sessionStorage.setItem('handelser_sw_reload','1');
        location.reload();
      });
    } catch (error) { console.warn('Service worker kunde inte startas:',error); }
  });
})();

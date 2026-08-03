(function () {
  'use strict';

  const paths = {
    sparkle: '<path d="M12 2.75c.55 4.13 2.87 6.45 7 7-4.13.55-6.45 2.87-7 7-.55-4.13-2.87-6.45-7-7 4.13-.55 6.45-2.87 7-7Z"/><path d="M19 16.5c.25 1.75 1.25 2.75 3 3-1.75.25-2.75 1.25-3 3-.25-1.75-1.25-2.75-3-3 1.75-.25 2.75-1.25 3-3Z"/>',
    message: '<path d="M7.5 18.5 3 21l1.1-4.2A8 8 0 1 1 7.5 18.5Z"/><path d="M8 10h8M8 14h5"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01M8.5 14.2c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 4.5-4 3.5 3 3.2-3 4.8 4.5"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 0 1 4.8 1c0 2-2.5 2-2.5 4M12 17.5h.01"/>',
    youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9 5 3-5 3Z"/>',
    link: '<path d="M10.5 13.5 13.5 10.5"/><path d="M7.8 16.2 5.6 18.4a3.7 3.7 0 0 1-5.2-5.2l3.2-3.2a3.7 3.7 0 0 1 5.2 0"/><path d="m16.2 7.8 2.2-2.2a3.7 3.7 0 0 1 5.2 5.2l-3.2 3.2a3.7 3.7 0 0 1-5.2 0"/>',
    'external-link': '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    heart: '<path d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.8l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/>',
    'heart-filled': '<path fill="currentColor" stroke="none" d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.8l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/>',
    play: '<path d="m9 7 8 5-8 5Z"/>',
    'arrow-left': '<path d="m14.5 5-7 7 7 7M8 12h12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    edit: '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18 6l2 2M17.9 16A7 7 0 0 1 6 18l-2-2"/>',
    shield: '<path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
    expand: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/><path d="M3 8l6-6M21 8l-6-6M21 16l-6 6M3 16l6 6"/>',
    gift: '<rect x="4" y="9" width="16" height="12" rx="2"/><path d="M3 6h18v5H3zM12 6v15M8.5 6C6 6 5 4.5 5.8 3.3 7 1.5 10 3 12 6M15.5 6C18 6 19 4.5 18.2 3.3 17 1.5 14 3 12 6"/>',
    leaf: '<path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16Z"/><path d="M5 20c3-5 7-8 12-11"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    'chevron-down': '<path d="m7 10 5 5 5-5"/>',
    flower: '<path d="M12 12c-2.8 0-5-1.9-5-4.2S9.2 3.5 12 6c2.8-2.5 5-.5 5 1.8S14.8 12 12 12Z"/><path d="M12 12c2.8 0 5 1.9 5 4.2S14.8 20.5 12 18c-2.8 2.5-5 .5-5-1.8S9.2 12 12 12Z"/><circle cx="12" cy="12" r="1.8"/><path d="M12 18v4M12 21c-2.8-2.2-5.3-2.7-7.4-1.5M12 21c2.8-2.2 5.3-2.7 7.4-1.5"/>',
    sudoku: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/><path d="M5.7 6h.01M12 12h.01M18.3 18h.01"/>',
    fact: '<path d="M8 4h8a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M9 9a3 3 0 1 1 4.6 2.5C12.4 12.3 12 13 12 14M12 17h.01"/>',
    shuffle: '<path d="M3 7h3c4.5 0 6.5 10 11 10h4"/><path d="m18 14 3 3-3 3M3 17h3c1.8 0 3.2-1.6 4.5-3.6M15 7c.8-.5 1.5-.8 2-.8h4M18 3l3 3-3 3"/>'
  };

  function icon(name, className, label) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','1.8');
    svg.setAttribute('stroke-linecap','round');
    svg.setAttribute('stroke-linejoin','round');
    svg.classList.add('ui-icon');
    if (className) className.split(/\s+/).filter(Boolean).forEach((value) => svg.classList.add(value));
    if (label) {
      svg.setAttribute('role','img');
      svg.setAttribute('aria-label',label);
    } else {
      svg.setAttribute('aria-hidden','true');
    }
    svg.innerHTML = paths[name] || paths.sparkle;
    return svg;
  }

  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((target) => {
      if (target.dataset.iconReady === 'true') return;
      target.dataset.iconReady = 'true';
      target.appendChild(icon(target.dataset.icon,target.dataset.iconClass || ''));
    });
  }

  window.HandelserIcons = { icon, hydrate };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',() => hydrate(document));
  else hydrate(document);
})();

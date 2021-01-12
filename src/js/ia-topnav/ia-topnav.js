/* eslint-disable no-undef */
import '@internetarchive/ia-topnav';
import log from '../util/log.js';

/*
 * To avoid having to rewrite the analytics.js, we create placeholder elements
 * to broadcast the events as we receive them.
 */
document.addEventListener('DOMContentLoaded', () => {
  const topnav = document.querySelector('ia-topnav');
  const localLog = (msg) => {
    log(`<ia-topnav>: ${msg}`);
  };
  const trackEvent = ({ event }) => {
    if (!window.archive_analytics) return;
    const [category, action] = event.split('|');
    window.archive_analytics.send_event_no_sampling(
      category,
      action,
      window.location.pathname,
    );
  };

  if (!topnav) { return; }

  const staticTopNav = topnav.querySelector('.static-content');
  if (staticTopNav) { staticTopNav.remove(); }

  localLog('adding tracking event listeners');

  topnav.addEventListener('trackClick', ({ detail }) => {
    trackEvent(detail);
    localLog(`Analytics click fired: ${detail.event}`);
  });

  topnav.addEventListener('trackSubmit', ({ detail }) => {
    trackEvent(detail);
    localLog(`Analytics submit fired: ${detail.event}`);
  });

  // In Safari, prevent loading from cache, which breaks WebComponents
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      window.location.reload();
    }
  });
});

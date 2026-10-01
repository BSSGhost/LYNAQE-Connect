/**
 * Petites briques d'interface : notifications et fenêtres modales.
 */

import { el, esc } from './dom.js';
import { icon } from './icons.js';

/* --- Notifications ------------------------------------------------------ */

const TOAST_ICONS = { success: 'checkCircle', error: 'alert', info: 'info', warning: 'alert' };
const TOAST_TITLES = { success: 'Succès', error: 'Erreur', info: 'Information', warning: 'Attention' };

export function toast(message, type = 'info', duration = 4500) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const tone = TOAST_ICONS[type] ? type : 'info';
  const node = el('div', { class: `toast toast-${tone}`, role: 'status' }, [
    el('span', { class: 'toast-icon', innerHTML: icon(TOAST_ICONS[tone], { size: 20 }) }),
    el('div', {}, [
      el('strong', { text: TOAST_TITLES[tone] }),
      el('p', { text: message }),
    ]),
  ]);
  region.append(node);

  const remove = () => {
    node.classList.add('is-leaving');
    node.addEventListener('animationend', () => node.remove(), { once: true });
  };
  const timer = setTimeout(remove, duration);
  node.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

/* --- Fenêtres modales --------------------------------------------------- */

let lastFocused = null;

export function openModal({ title, content, actions = [], size = 'md' }) {
  const root = document.getElementById('modal-root');
  if (!root) return () => {};
  lastFocused = document.activeElement;

  const close = () => {
    root.replaceChildren();
    document.body.style.removeProperty('overflow');
    document.removeEventListener('keydown', onKeydown);
    lastFocused?.focus?.();
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape') close();
  };

  const footer = actions.length
    ? el(
        'div',
        { class: 'modal-footer' },
        actions.map((action) =>
          el(
            'button',
            {
              class: `btn ${action.variant ?? 'btn-ghost'}`,
              type: 'button',
              onclick: async () => {
                if (action.onClick) await action.onClick(close);
                else close();
              },
            },
            action.label,
          ),
        ),
      )
    : null;

  const modal = el('div', { class: `modal modal-${size}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
    el('div', { class: 'modal-header' }, [
      el('h2', { text: title }),
      el('button', { class: 'btn btn-icon btn-ghost', type: 'button', 'aria-label': 'Fermer', onclick: close, innerHTML: icon('close', { size: 20 }) }),
    ]),
    el('div', { class: 'modal-body' }, [content instanceof Node ? content : el('div', { innerHTML: content })]),
    footer,
  ]);

  const backdrop = el('div', { class: 'modal-backdrop', onclick: (event) => { if (event.target === backdrop) close(); } }, [modal]);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKeydown);
  root.replaceChildren(backdrop);
  modal.querySelector('button, [tabindex]')?.focus?.();
  return close;
}

export function confirmDialog({ title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false }) {
  return new Promise((resolve) => {
    const close = openModal({
      title,
      content: el('p', { text: message }),
      actions: [
        { label: cancelLabel, variant: 'btn-ghost', onClick: (done) => { done(); resolve(false); } },
        {
          label: confirmLabel,
          variant: danger ? 'btn-danger' : 'btn-primary',
          onClick: (done) => { done(); resolve(true); },
        },
      ],
    });
    void close;
  });
}

/* --- Copie dans le presse-papiers -------------------------------------- */

export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    return false;
  }
}

/* --- Décorations -------------------------------------------------------- */

export function statusBadge(statusInfo) {
  const tone = statusInfo?.tone ?? 'neutral';
  return `<span class="badge tone-${esc(tone)}"><span class="dot"></span>${esc(statusInfo?.value ?? '—')}</span>`;
}

export function categoryTag(categoryInfo) {
  return `<span class="tag">${icon(categoryInfo?.icon ?? 'dots', { size: 14 })}${esc(categoryInfo?.value ?? '—')}</span>`;
}

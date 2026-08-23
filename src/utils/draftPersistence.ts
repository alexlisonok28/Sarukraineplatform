type DraftValue = {
  key: string;
  value?: string;
  checked?: boolean;
};

const PREFIX = 'sar-draft:';

const isEligible = (element: Element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return false;
  const readOnly = 'readOnly' in element ? Boolean(element.readOnly) : false;
  if (element.hasAttribute('data-no-draft') || element.disabled || readOnly) return false;
  if (element instanceof HTMLInputElement && ['password', 'file', 'hidden', 'submit', 'button'].includes(element.type)) return false;
  return true;
};

const fields = () => Array.from(document.querySelectorAll('input, textarea, select')).filter(isEligible);

const fieldKey = (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, index: number) => {
  const explicit = element.getAttribute('data-draft-key') || element.name || element.id || element.getAttribute('aria-label') || element.getAttribute('placeholder');
  // Keep the DOM index even when a name exists so radio groups/repeated rows do not
  // overwrite each other. The page/entity itself is already isolated by scope.
  return explicit ? `${element.tagName}:${explicit}:index:${index}` : `${element.tagName}:index:${index}`;
};

const storageKey = (scope: string) => `${PREFIX}${scope}`;

export function clearDraft(scope: string) {
  try { localStorage.removeItem(storageKey(scope)); } catch {}
}

function readDraft(scope: string): DraftValue[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(scope)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDraft(scope: string) {
  const values: DraftValue[] = fields().map((element, index) => {
    const key = fieldKey(element, index);
    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      return { key, checked: element.checked, value: element.value };
    }
    return { key, value: element.value };
  });

  try {
    if (values.length) localStorage.setItem(storageKey(scope), JSON.stringify(values));
  } catch {}
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, draft: DraftValue) {
  if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
    descriptor?.set?.call(element, Boolean(draft.checked));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  const prototype = element instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLSelectElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, draft.value ?? '');
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function bindDraftPersistence(scope: string) {
  let restoring = false;
  let restoreTimer = 0;

  const restore = () => {
    const draft = readDraft(scope);
    if (!draft.length) return;

    restoring = true;
    const currentFields = fields();
    currentFields.forEach((element, index) => {
      const key = fieldKey(element, index);
      const saved = draft.find(item => item.key === key);
      if (saved) setNativeValue(element, saved);
    });
    restoring = false;
  };

  const scheduleRestore = () => {
    window.clearTimeout(restoreTimer);
    restoreTimer = window.setTimeout(restore, 120);
  };

  const onFieldChange = (event: Event) => {
    if (restoring || !(event.target instanceof Element) || !isEligible(event.target)) return;
    writeDraft(scope);
  };

  const onClick = (event: Event) => {
    const target = (event.target as HTMLElement | null)?.closest('button');
    if (!target) return;
    const text = (target.textContent || '').trim().toLowerCase();
    if (target.hasAttribute('data-draft-clear') || /^(скасувати|відмінити|cancel)$/.test(text)) clearDraft(scope);
  };

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        const text = node instanceof HTMLElement ? (node.textContent || '').toLowerCase() : '';
        if (/зміни збережено успішно|успішно збережено|збережено успішно/.test(text)) {
          clearDraft(scope);
          return;
        }
      }
    }
    scheduleRestore();
  });

  document.addEventListener('input', onFieldChange, true);
  document.addEventListener('change', onFieldChange, true);
  document.addEventListener('click', onClick, true);
  observer.observe(document.body, { childList: true, subtree: true });

  // Restore after initial render and again after async page data has mounted fields.
  window.setTimeout(restore, 0);
  window.setTimeout(restore, 350);
  window.setTimeout(restore, 1000);

  return () => {
    window.clearTimeout(restoreTimer);
    observer.disconnect();
    document.removeEventListener('input', onFieldChange, true);
    document.removeEventListener('change', onFieldChange, true);
    document.removeEventListener('click', onClick, true);
  };
}

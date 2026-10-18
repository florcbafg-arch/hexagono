(() => {
  if (window.__hexaflowEnterNavigationInstalled) return
  window.__hexaflowEnterNavigationInstalled = true

  const selector = [
    'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="checkbox"]):not([type="radio"])',
    'select',
    'textarea',
    '[contenteditable="true"]'
  ].join(',')

  function visible(el) {
    if (!el || el.disabled || el.readOnly) return false
    if (el.getAttribute('aria-hidden') === 'true') return false
    if (el.getAttribute('tabindex') === '-1') return false
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0
  }

  function campos(scope = document) {
    return [...scope.querySelectorAll(selector)].filter(visible)
  }

  function siguienteCampo(actual) {
    const form = actual.form
    const lista = campos(form || document)
    const pos = lista.indexOf(actual)
    return pos >= 0 ? lista[pos + 1] || null : null
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return

    const actual = event.target
    if (!(actual instanceof HTMLElement) || !actual.matches(selector)) return
    if (actual.dataset.enterIgnore === 'true') return

    // En campos multilínea, Shift+Enter conserva el salto de línea.
    if (actual.tagName === 'TEXTAREA' && event.shiftKey) return

    const siguiente = siguienteCampo(actual)

    if (siguiente) {
      event.preventDefault()
      siguiente.focus()
      if (typeof siguiente.select === 'function' && siguiente.tagName === 'INPUT') {
        try { siguiente.select() } catch (_) {}
      }
      return
    }

    // En el último campo de un formulario, Enter ejecuta el submit normal.
    if (actual.form) {
      event.preventDefault()
      if (typeof actual.form.requestSubmit === 'function') actual.form.requestSubmit()
      else actual.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    }
  }, true)
})()

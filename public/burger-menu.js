/**
 * <burger-menu> custom element
 *
 * Minimal vanilla JS — no framework, no build step, loaded async.
 * State is managed entirely via a data-open attribute on the host element,
 * with all visual transitions handled in CSS.
 */
class BurgerMenu extends HTMLElement {
  #btn;
  #nav;
  #backdrop;

  connectedCallback() {
    this.#btn      = this.querySelector('[data-toggle]');
    this.#nav      = this.querySelector('[data-nav]');
    this.#backdrop = this.querySelector('[data-backdrop]');

    this.#btn?.addEventListener('click', () => this.#toggle());
    this.#backdrop?.addEventListener('click', () => this.#close());

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.hasAttribute('data-open')) this.#close();
    });

    // Close when navigating to an anchor on the same page
    this.#nav?.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => this.#close());
    });
  }

  #toggle() {
    this.hasAttribute('data-open') ? this.#close() : this.#open();
  }

  #open() {
    this.setAttribute('data-open', '');
    this.#btn?.setAttribute('aria-expanded', 'true');
    this.#nav?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  #close() {
    this.removeAttribute('data-open');
    this.#btn?.setAttribute('aria-expanded', 'false');
    this.#nav?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

customElements.define('burger-menu', BurgerMenu);

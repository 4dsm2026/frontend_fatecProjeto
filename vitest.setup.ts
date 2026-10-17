import "@testing-library/jest-dom/vitest";

// O jsdom implementa <dialog> e a propriedade `open`, mas não showModal()/close().
// Componentes que usam o <dialog> nativo (ex.: ConfirmDialog) dependem deles.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

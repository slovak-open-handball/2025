// loader.js
// Tento súbor definuje globálne funkcie pre zobrazenie a skrytie načítavacieho prvku.

let loaderElement = null;

// Funkcia na vytvorenie a zobrazenie načítavacieho prvku
window.showGlobalLoader = () => {
  if (!loaderElement) {
    loaderElement = document.createElement('div');
    loaderElement.id = 'global-loader';
    loaderElement.className = 'fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[100] transition-opacity duration-300 ease-in-out';
    loaderElement.innerHTML = `
      <div class="ease-linear rounded-full border-4 border-t-4 border-gray-200 border-t-blue-500 h-12 w-12 animate-spin"></div>
    `;
    document.body.appendChild(loaderElement);
  }
  loaderElement.style.display = 'flex';
};

// Funkcia na skrytie načítavacieho prvku
window.hideGlobalLoader = () => {
  if (loaderElement) {
    loaderElement.style.display = 'none';
  }
};

// Volanie funkcie na skrytie po načítaní DOM
document.addEventListener('DOMContentLoaded', () => {
  window.hideGlobalLoader();
});

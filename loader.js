// loader.js
// Tento súbor definuje globálne funkcie pre zobrazenie a skrytie načítavacieho prvku.

let loaderElement = null;
let loaderContentElement = null;

// Funkcia na vytvorenie a zobrazenie načítavacieho prvku
window.showGlobalLoader = () => {
  if (!loaderElement) {
    loaderElement = document.createElement('div');
    loaderElement.id = 'global-loader';
    loaderElement.className = 'fixed inset-0 bg-white flex items-center justify-center z-[999999999999] transition-opacity duration-300 ease-in-out';
    loaderElement.innerHTML = `
      <div id="loader-content" class="flex flex-col items-center justify-center">
        <div class="relative">
          <!-- Veľké koliesko -->
          <div class="ease-linear rounded-full border-8 border-gray-200 h-24 w-24"></div>
          <!-- Animované koliesko -->
          <div class="ease-linear rounded-full border-8 border-t-8 border-t-blue-500 h-24 w-24 animate-spin absolute top-0 left-0"></div>
          <!-- Stred kolieska -->
          <div class="ease-linear rounded-full bg-blue-500 h-8 w-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
        </div>
        <!-- Text pod kolieskom -->
        <div class="mt-6 text-gray-700 text-lg font-semibold">Načítava sa...</div>
      </div>
    `;
    document.body.appendChild(loaderElement);
    loaderContentElement = document.getElementById('loader-content');
  }
  loaderElement.style.display = 'flex';
  loaderElement.style.opacity = '1';
  
  // Zabraňujeme interakcii s obsahom stránky počas načítavania
  loaderElement.style.pointerEvents = 'auto';
};

// Funkcia na skrytie načítavacieho prvku
window.hideGlobalLoader = () => {
  if (loaderElement) {
    loaderElement.style.opacity = '0';
    setTimeout(() => {
      if (loaderElement) {
        loaderElement.style.display = 'none';
      }
    }, 300);
  }
};

// Funkcia na zmenu textu načítavacieho prvku
window.setLoaderText = (text) => {
  if (loaderContentElement) {
    const textElement = loaderContentElement.querySelector('div:nth-child(2)');
    if (textElement) {
      textElement.textContent = text;
    }
  }
};

// Funkcia na zmenu farby kolieska
window.setLoaderColor = (color) => {
  if (loaderContentElement) {
    const spinnerElement = loaderContentElement.querySelector('.border-t-blue-500');
    const centerElement = loaderContentElement.querySelector('.bg-blue-500');
    if (spinnerElement) {
      spinnerElement.classList.remove('border-t-blue-500');
      spinnerElement.classList.add(`border-t-${color}`);
    }
    if (centerElement) {
      centerElement.classList.remove('bg-blue-500');
      centerElement.classList.add(`bg-${color}`);
    }
  }
};

// Testovacie funkcie pre vývoj
window.testLoader = () => {
  window.showGlobalLoader();
  setTimeout(() => {
    window.setLoaderText('Testovanie...');
    window.setLoaderColor('green');
  }, 1000);
  setTimeout(() => {
    window.setLoaderText('Hotovo!');
    window.setLoaderColor('green');
  }, 2000);
  setTimeout(() => {
    window.hideGlobalLoader();
  }, 3000);
};

// Volanie funkcie na skrytie po načítaní DOM
document.addEventListener('DOMContentLoaded', () => {
  window.hideGlobalLoader();
});

// Automatické zobrazenie pri spustení (voliteľné)
// window.showGlobalLoader();

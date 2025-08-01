// loader.js
// Tento súbor definuje univerzálny React komponent pre načítavacie koliesko.
// Je navrhnutý tak, aby sa dal použiť na akejkoľvek stránke, ktorá potrebuje zobraziť
// stav načítavania.

// Komponent pre načítavacie koliesko
function Loader() {
  return React.createElement(
    'div',
    { className: 'flex flex-col items-center justify-center min-h-[calc(100vh-64px)]' },
    React.createElement(
      'div',
      {
        // Vylepšené triedy pre lepšiu viditeľnosť a efekt otáčania
        className: 'ease-linear rounded-full border-4 border-gray-200 border-t-4 border-t-blue-500 h-12 w-12 mb-4 animate-spin'
      }
    ),
    React.createElement('p', { className: 'text-gray-600' }, 'Načítavam dáta...')
  );
}

// Komponent je exportovaný do globálneho objektu 'window',
// aby ho bolo možné použiť v iných skriptoch.
window.Loader = Loader;

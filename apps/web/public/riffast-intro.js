/*! Riffast Intro 1.0 — animación de entrada / pantalla de carga
 *
 *  INTEGRACIÓN MÍNIMA (pégalo justo después de <body>):
 *
 *    <div id="riffast-intro" style="position:fixed;inset:0;z-index:9999;background:#008B5A"></div>
 *    <script src="riffast-intro.js"></script>
 *    <script>RiffastIntro.mount({ container: '#riffast-intro' });</script>
 *
 *  El div con estilo inline evita que se vea la web antes de que cargue el script.
 *  La salida se dispara sola con el evento `load` de la página (autoReady: true).
 *  Si el contenido tarda más de 1.95 s, el trébol se queda respirando hasta que
 *  llegue `load` (o hasta `maxWait`). Nunca se repite la introducción.
 *
 *  CONTROL MANUAL (SPA, datos propios, fuentes, etc.):
 *
 *    const intro = RiffastIntro.mount({ container: '#riffast-intro', autoReady: false });
 *    Promise.all([cargarDatos(), document.fonts.ready]).then(() => intro.ready());
 *
 *  OPCIONES (todas opcionales):
 *    container      Elemento o selector. Si se omite, se crea un overlay en <body>.
 *    preset         'agil' (v2, cambios decididos con reposos breves) | 'suave' (v1, fases
 *                   encadenadas). Ambas duran ~2.3 s.
 *    background     '#008B5A'   Verde del fondo (se le añade una luz radial muy sutil).
 *    ink            '#DFEFE6'   Blanco matizado de letras y trébol (el reflejo es blanco puro).
 *    autoReady      true        Llama a ready() con window 'load'.
 *    minTime        1.95        Momento más temprano (s) en que puede empezar la salida.
 *                               Usa 1.5 para salir justo al formarse el trébol, sin reflejo.
 *    maxWait        10          Segundos máximos de espera antes de salir sí o sí.
 *    reducedMotion  'auto'      'auto' respeta prefers-reduced-motion; true/false lo fuerza.
 *    speed          1           Velocidad de reproducción (útil para revisar la animación).
 *    zIndex         9999
 *    removeOnDone   true        Elimina el overlay del DOM al terminar.
 *    onDone         fn          Callback al terminar. También se emite el evento
 *                               'riffast-intro:done' en document.
 *
 *  Mientras la intro está activa, <html> lleva la clase `riffast-intro-active`
 *  (útil para pausar animaciones propias del hero hasta que termine).
 *
 *  API de la instancia: ready(), replay(), destroy(), state ('playing'|'holding'|'exiting'|'done').
 */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  // Trazados exactos del logotipo (Riffast_logo_vectorial.svg, viewBox 0 0 1390 499)
  var LETTERS = [
    // R
    'M 488.245 235.75 L 488.5 131.5 541 131.511 C 581.023 131.52 595.282 131.848 601 132.89 C 630.661 138.294 649.789 153.278 658.796 178.165 C 661.217 184.855 661.448 186.776 661.422 200 C 661.396 213.103 661.128 215.299 658.64 222.792 C 655.151 233.3 647.369 244.885 639.456 251.35 C 633.8 255.971 621.023 263 618.278 263 C 615.366 263 616.122 264.166 659.191 326.089 C 663.535 332.335 666.643 337.767 666.334 338.573 C 665.876 339.766 660.73 340 634.916 340 L 604.045 340 596.084 327.75 C 591.706 321.012 581.903 305.825 574.3 294 L 560.478 272.5 551.489 272.5 L 542.5 272.5 542.237 306.25 L 541.973 340 514.982 340 L 487.991 340 488.245 235.75 Z M 589.577 225.885 C 597.294 222.998 602.465 217.649 604.583 210.361 C 608.468 197 603.459 184.25 592.064 178.492 C 586.764 175.814 554.142 173.822 545.125 175.625 L 542 176.25 542 202.125 L 542 228 562.962 228 C 581.856 228 584.483 227.791 589.577 225.885 Z',
    // punto de la i
    'M 697.404 173.234 C 677.988 166.291 671.53 142.04 685.017 126.718 C 697.554 112.476 721.491 113.557 732.165 128.849 C 742.688 143.922 737.864 163.433 721.563 171.734 C 714.81 175.173 704.6 175.807 697.404 173.234 Z',
    // asta de la i
    'M 682.244 262.75 L 682.5 185.5 708.5 185.5 L 734.5 185.5 734.756 262.75 L 735.012 340 708.5 340 L 681.988 340 682.244 262.75 Z',
    // f
    'M 765.657 339.25 C 765.404 338.837 765.318 317.575 765.466 292 C 765.615 266.425 765.503 241.562 765.218 236.75 L 764.701 228 758.6 227.985 C 755.245 227.976 751.928 227.606 751.229 227.163 C 750.253 226.543 750.021 221.602 750.229 205.928 L 750.5 185.5 758.25 185.208 L 766 184.916 766 177.118 C 766 172.626 766.837 166.046 767.975 161.596 C 776.145 129.654 803.518 115.245 844.5 121.315 L 852.5 122.5 852.5 144 L 852.5 165.5 842 165.181 C 832.611 164.896 831.026 165.108 827.023 167.181 C 821.842 169.865 819.267 173.771 818.371 180.308 L 817.736 184.942 831.618 185.221 L 845.5 185.5 845.771 205.773 C 845.98 221.452 845.754 226.154 844.771 226.52 C 844.072 226.781 837.875 227.108 831 227.247 L 818.5 227.5 818.242 283.75 L 817.983 340 792.051 340 C 777.788 340 765.911 339.663 765.657 339.25 Z',
    // f
    'M 874.758 283.767 L 874.5 227.5 867.5 227.31 C 863.65 227.206 859.928 227.094 859.23 227.06 C 858.236 227.013 858.018 222.477 858.23 206.25 L 858.5 185.5 866.75 185.21 L 875 184.919 875 176.62 C 875 141.648 897.786 120.032 934.678 120.007 C 946.101 119.999 959.847 121.632 961.77 123.226 C 962.737 124.027 962.976 129.079 962.77 144.389 L 962.5 164.5 951 164.5 C 933.921 164.5 928.151 168.128 927.212 179.459 L 926.752 185 942.676 185 C 953.728 185 958.967 185.367 959.8 186.2 C 961.542 187.942 961.495 225.562 959.75 226.691 C 959.062 227.136 951.416 227.401 942.758 227.281 L 927.017 227.061 926.758 283.281 L 926.5 339.5 900.758 339.767 L 875.017 340.034 874.758 283.767 Z',
    // a
    'M 998.161 342.972 C 975.497 339.859 960.538 325.975 956.954 304.727 C 953.914 286.702 960.635 268.629 974.241 258.243 C 988.413 247.424 1004.561 243.279 1036.25 242.327 L 1057 241.703 1056.996 238.602 C 1056.989 232.895 1052.589 227.317 1045.5 224.027 C 1032.524 218.004 1014.59 221.929 1000.153 233.95 C 992.441 240.371 993.553 240.764 978.265 226.202 C 964.816 213.392 964.862 213.873 976.048 202.895 C 992.63 186.622 1018.529 178.891 1046.679 181.812 C 1079.964 185.266 1099.397 199.261 1106.647 225 C 1108.318 230.932 1108.479 236.218 1108.489 285.5 L 1108.5 339.5 1083.5 339.5 L 1058.5 339.5 1058.207 331.698 L 1057.914 323.896 1051.559 328.953 C 1037.197 340.381 1017.309 345.603 998.161 342.972 Z M 1039.57 303.04 C 1043.125 301.29 1047.276 298.276 1048.985 296.205 C 1052.673 291.733 1056 283.252 1056 278.322 L 1056 274.72 1039.75 275.271 C 1028.497 275.652 1022.088 276.323 1018.907 277.451 C 1007.216 281.599 1003.1 294.176 1010.982 301.662 C 1017.49 307.843 1028.714 308.384 1039.57 303.04 Z',
    // s
    'M 1168.867 342.98 C 1157.562 341.699 1149.556 339.392 1139.5 334.517 C 1130.55 330.178 1119 321.148 1119 318.489 C 1119 316.098 1138.895 287 1140.53 287 C 1141.386 287 1144.436 288.774 1147.307 290.942 C 1159.479 300.132 1177.088 305.417 1187.654 303.053 C 1196.226 301.135 1199.881 296.384 1196.97 290.945 C 1195.405 288.021 1191.36 286.329 1175.489 281.963 C 1143.491 273.161 1132.948 266.624 1125.629 251.047 C 1119.886 238.825 1120.838 219.959 1127.796 208.086 C 1134.526 196.601 1149.264 186.808 1165 183.365 C 1181.202 179.819 1203.673 181.506 1219.476 187.455 C 1231.282 191.899 1244.904 202.201 1243.57 205.677 C 1242.11 209.483 1221.5 234 1219.761 234 C 1218.703 234 1215.961 232.5 1213.668 230.667 C 1201.401 220.859 1187.182 217.465 1177.251 221.973 C 1169.453 225.512 1168.995 232.179 1176.26 236.378 C 1178.592 237.725 1188.15 240.909 1197.5 243.452 C 1234.064 253.396 1246.618 264.756 1247.784 288.953 C 1249.319 320.846 1226.114 341.448 1186.5 343.361 C 1181 343.627 1173.065 343.455 1168.867 342.98 Z',
    // t
    'M 1300.782 341.506 C 1285.306 337.595 1275.972 329.313 1270.863 314.96 C 1268.636 308.704 1268.553 307.232 1268.203 268.25 L 1267.842 228 1265.171 227.849 C 1263.702 227.766 1261.211 227.802 1259.635 227.929 C 1258.059 228.055 1255.687 227.887 1254.364 227.555 L 1251.96 226.952 1252.23 206.226 L 1252.5 185.5 1260.25 185.208 L 1268 184.916 1268 165.58 C 1268 150.4 1268.295 146 1269.374 145.104 C 1270.341 144.302 1277.981 144.043 1295.124 144.232 L 1319.5 144.5 1319.771 164.723 L 1320.041 184.947 1334.771 185.223 L 1349.5 185.5 1349.5 206 L 1349.5 226.5 1336 227.132 C 1328.575 227.479 1321.938 227.817 1321.25 227.882 C 1319.627 228.035 1319.461 286.519 1321.067 292.302 C 1322.818 298.607 1326.575 300.261 1337.656 299.607 C 1345.067 299.169 1346.917 299.341 1347.365 300.508 C 1347.669 301.301 1347.641 310.29 1347.302 320.483 L 1346.685 339.016 1341.593 340.628 C 1334.39 342.908 1308.531 343.464 1300.782 341.506 Z'
  ];
  var LEAVES = [
    // hoja superior izquierda
    'M 102.787 218.98 C 78.303 212.893 55.675 193.602 46.147 170.691 C 35.408 144.866 39.417 113.587 55.459 98.04 L 59.029 94.58 61.909 98.073 C 69.468 107.244 83.27 110.068 94.23 104.686 C 110.577 96.659 113.9 77.003 101.283 62.97 L 96.75 57.928 100.625 54.457 C 106.166 49.494 119.224 43.392 128.208 41.566 C 163.78 34.338 198.876 52.708 216.447 87.751 C 224.048 102.911 224.414 105.707 224.459 149 C 224.496 183.819 224.324 188.023 222.658 192.969 C 218.678 204.785 210.414 213.662 199.153 218.215 C 193.612 220.455 192.681 220.504 152 220.698 C 114.043 220.88 109.842 220.733 102.787 218.98 Z',
    // hoja inferior izquierda
    'M 126.468 412.186 C 116.137 409.551 107.253 405.017 100.742 399.056 L 94.984 393.785 100.283 388.061 C 111.139 376.335 110.817 361.517 99.481 351.157 C 88.697 341.3 74.537 341.656 63.749 352.055 L 58.624 356.995 56.229 354.748 C 51.681 350.479 46.366 341.306 43.58 332.917 C 30.408 293.261 56.308 249.355 100.5 236.427 C 105.644 234.922 112.082 234.614 145.638 234.265 C 170.804 234.003 186.831 234.237 190.532 234.921 C 208.094 238.168 221.195 251.31 224.007 268.5 C 225.332 276.598 225.269 333.92 223.925 343.582 C 219.639 374.4 196.454 401.153 165.5 410.997 C 155.669 414.123 136.369 414.711 126.468 412.186 Z',
    // hoja superior derecha
    'M 273.746 219.914 C 262.801 217.335 252.789 208.996 247.674 198.201 L 244.5 191.5 244.195 153.823 C 243.911 118.709 244.03 115.559 245.939 107.522 C 252.161 81.322 270.814 58.215 294.493 47.374 C 319.757 35.808 350.964 38.487 367.928 53.678 L 372.356 57.644 368.231 61.769 C 362.5 67.5 360.75 71.383 360.221 79.54 C 359.147 96.094 370.888 107.854 387.417 106.782 C 395.459 106.26 398.547 104.922 405.164 99.091 L 409.828 94.981 413.947 99.741 C 422.959 110.156 427.441 123.907 427.395 141 C 427.31 172.225 408.923 200.379 379.678 214.064 C 365.726 220.592 361.922 221.011 317.59 220.9 C 295.541 220.844 275.811 220.401 273.746 219.914 Z',
    // hoja inferior derecha con tallo
    'M 335.5 457.764 C 326.109 454.389 306.556 438.603 292.395 422.964 C 270.461 398.74 250.859 366.822 245.96 347.352 C 244.042 339.73 243.928 336.761 244.205 301.352 L 244.5 263.5 247.18 257.782 C 252.645 246.123 263.742 237.519 276.54 235.019 C 286.528 233.069 359.828 234.131 367.5 236.337 C 394.662 244.15 415.064 263.526 424.171 290.158 C 431.547 311.73 426.671 337.267 412.563 350.939 L 409.015 354.378 405.636 350.43 C 395.429 338.505 377.157 338.512 366.157 350.445 C 357.48 359.858 357.81 375.227 366.896 384.906 C 370.913 389.185 370.489 390.219 363.216 393.891 C 346.139 402.511 326.383 402.197 304.75 392.962 C 299.938 390.907 296 389.544 296 389.932 C 296 391.418 313.878 407.972 321.793 413.814 C 326.354 417.18 336.254 422.948 343.793 426.631 C 360.38 434.734 362 436.033 362 441.234 C 362 444.532 361.234 445.93 356.932 450.478 C 349.294 458.555 343.336 460.58 335.5 457.764 Z'
  ];
  // Cada letra viaja a una hoja. La "primaria" adopta la silueta exacta de la hoja;
  // las demás se funden dentro de ella (versión reducida de la misma hoja).
  var PLAN = [
    { g: 0, glyph: 0, primary: true,  leaf: 0 },            // R  → hoja sup. izq.
    { g: 1, glyph: 1, primary: false, leaf: 1, dot: true }, // punto de la i
    { g: 1, glyph: 1, primary: false, leaf: 1 },            // asta de la i
    { g: 1, glyph: 2, primary: true,  leaf: 1 },            // f  → hoja inf. izq.
    { g: 2, glyph: 3, primary: false, leaf: 2 },            // f
    { g: 2, glyph: 4, primary: true,  leaf: 2 },            // a  → hoja sup. der.
    { g: 3, glyph: 5, primary: false, leaf: 3 },            // s
    { g: 3, glyph: 6, primary: true,  leaf: 3 }             // t  → hoja inf. der. + tallo
  ];
  var VB = { w: 1000, h: 640 };
  var K = 1.25;                 // tamaño del trébol respecto al nombre
  var DRIFT = 90;               // cuánto a la izquierda nace el trébol antes del ajuste final
  var INSET = 0.42;             // reducción de las hojas "absorbidas"
  var N_OUT = 280, N_HOLE = 64; // puntos de muestreo por contorno
  var BODY_CENTER = { 3: [338, 310] }; // centro del cuerpo de la hoja con tallo
  // ---- easings ---------------------------------------------------------------
  var clamp01 = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var win = function (t, a, b) { return clamp01((t - a) / (b - a)); };
  var eInOutQuad = function (x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
  var eInOutCubic = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  var eInOutQuart = function (x) { return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2; };
  var eInOutQuint = function (x) { return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2; };
  var eInOutSine = function (x) { return -(Math.cos(Math.PI * x) - 1) / 2; };
  var eOutCubic = function (x) { return 1 - Math.pow(1 - x, 3); };
  var eOutQuart = function (x) { return 1 - Math.pow(1 - x, 4); };

  // ---- líneas de tiempo (segundos). Ambas duran ~2.3 s ----------------------
  var PRESETS = {
    // v1 · Suave: fases encadenadas sin pausas, curvas cúbicas
    suave: {
      reveal: 0.65, gather: [0.65, 1.32], morph: [0.80, 1.42], absorb: [0.86, 1.46],
      recenter: [1.26, 1.54], shine: [1.50, 1.95],
      exitAt: 1.95, exitDur: 0.35, exitScale: 0.9, stagger: 0.025, rise: 10, smooth: 9,
      ease: { reveal: eInOutQuad, riseE: eOutCubic, move: eInOutCubic, shape: eInOutCubic, recenter: eInOutSine, shine: eInOutSine, exit: eInOutCubic }
    },
    // v2 · Ágil: misma duración total; cada cambio es más decidido (curvas quínticas)
    // y entre fases hay reposos breves que hacen legible cada estado
    agil: {
      reveal: 0.52, gather: [0.60, 1.02], morph: [0.68, 1.14], absorb: [0.70, 1.16],
      recenter: [1.00, 1.24], shine: [1.30, 1.80],
      exitAt: 1.95, exitDur: 0.32, exitScale: 0.9, stagger: 0.012, rise: 12, smooth: 11,
      ease: { reveal: eInOutSine, riseE: eOutCubic, move: eInOutQuint, shape: eInOutQuint, recenter: eInOutQuint, shine: eInOutSine, exit: eInOutQuart }
    }
  };
  var BREATH = { period: 3.2, amp: 0.028 };            // respiración en espera
  var RM = { fadeIn: 0.3, minHold: 0.7, exitDur: 0.3 }; // alternativa con movimiento reducido
  var DEFAULTS = {
    container: null, preset: 'agil', background: '#008B5A', ink: '#DFEFE6', autoReady: true,
    minTime: null, maxWait: 10, reducedMotion: 'auto', speed: 1, zIndex: 9999,
    removeOnDone: true, onDone: null
  };

  // ---- utilidades -----------------------------------------------------------
  var fmt = function (n) { return Math.round(n * 100) / 100; };
  var bbox = function (pts) {
    var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (var i = 0; i < pts.length; i++) { var p = pts[i]; if (p[0] < b.minX) b.minX = p[0]; if (p[0] > b.maxX) b.maxX = p[0]; if (p[1] < b.minY) b.minY = p[1]; if (p[1] > b.maxY) b.maxY = p[1]; }
    return b;
  };
  var merge = function (a, b) { return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) }; };
  var center = function (b) { return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]; };
  var area = function (pts) { var s = 0; for (var i = 0, n = pts.length; i < n; i++) { var p = pts[i], q = pts[(i + 1) % n]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
  var flat = function (arrs) { return [].concat.apply([], arrs); };
  var splitRings = function (d) { return d.trim().split(/(?=M\s)/).map(function (s) { return s.trim(); }).filter(Boolean); };
  // Rota el contorno origen para que cada punto quede frente al punto más cercano del destino
  var rotateToFit = function (src, tgt) {
    var n = src.length, best = Infinity, bestO = 0;
    for (var o = 0; o < n; o++) {
      var sum = 0;
      for (var i = 0; i < n; i++) { var a = src[(i + o) % n], b = tgt[i]; var dx = a[0] - b[0], dy = a[1] - b[1]; sum += dx * dx + dy * dy; if (sum > best) break; }
      if (sum < best) { best = sum; bestO = o; }
    }
    var out = new Array(n);
    for (var j = 0; j < n; j++) out[j] = src[(j + bestO) % n];
    return out;
  };
  var boxSmooth = function (xs, ys, h) { // media móvil circular (suma acumulada, O(n))
    var n = xs.length, px = new Float64Array(3 * n + 1), py = new Float64Array(3 * n + 1);
    for (var i = 0; i < 3 * n; i++) { px[i + 1] = px[i] + xs[i % n]; py[i + 1] = py[i] + ys[i % n]; }
    var w = 2 * h + 1, ox = new Array(n), oy = new Array(n);
    for (var k = 0; k < n; k++) { var a = k + n - h, b = k + n + h + 1; ox[k] = (px[b] - px[a]) / w; oy[k] = (py[b] - py[a]) / w; }
    return [ox, oy];
  };
  var shade = function (hex, amt) { // aclara (>0) u oscurece (<0) un color hex
    var m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (c) { return Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt)))); };
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  };
  var uid = 0;

  // ---- instancia -------------------------------------------------------------
  function Intro(opts) {
    this.o = Object.assign({}, DEFAULTS, opts || {});
    this.tl = PRESETS[this.o.preset] || PRESETS.agil;
    if (this.o.minTime == null) this.o.minTime = this.tl.exitAt;
    this.id = 'ri' + (++uid);
    this.state = 'playing';
    this.t = 0; this.scale = 1; this.isReady = false; this.exitStart = null; this.exitFrom = 1;
    this.morphing = false; this.settled = false; this.shineOn = false; this.raf = 0;
    this.rm = this.o.reducedMotion === 'auto'
      ? !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches)
      : !!this.o.reducedMotion;
    this._tick = this._tick.bind(this);
    this._container();
    this._geometry();
    this._dom();
    document.documentElement.classList.add('riffast-intro-active');
    this._start();
    if (this.o.autoReady) {
      if (document.readyState === 'complete') this.ready();
      else global.addEventListener('load', this.ready.bind(this), { once: true });
    }
    if (this.o.maxWait > 0) this.maxTimer = setTimeout(this.ready.bind(this), this.o.maxWait * 1000);
  }

  Intro.prototype._container = function () {
    var c = this.o.container;
    if (typeof c === 'string') c = document.querySelector(c);
    this.created = !c;
    if (!c) { c = document.createElement('div'); (document.body || document.documentElement).appendChild(c); }
    this.el = c;
    var bg = this.o.background;
    var s = c.style;
    s.position = 'fixed'; s.top = s.right = s.bottom = s.left = '0'; s.zIndex = String(this.o.zIndex);
    s.display = 'flex'; s.alignItems = 'center'; s.justifyContent = 'center'; s.margin = '0'; s.padding = '0';
    s.background = bg;
    s.background = 'radial-gradient(120% 90% at 50% 46%, ' + shade(bg, 0.06) + ' 0%, ' + bg + ' 52%, ' + shade(bg, -0.1) + ' 100%)';
    s.opacity = '1'; s.willChange = 'opacity';
  };

  Intro.prototype._geometry = function () {
    if (this.rm) return; // la versión de movimiento reducido no morfea
    var meas = document.createElementNS(NS, 'svg');
    meas.setAttribute('width', '10'); meas.setAttribute('height', '10');
    meas.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:10px;overflow:hidden;pointer-events:none';
    (document.body || document.documentElement).appendChild(meas);
    var sample = function (d, n) {
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); meas.appendChild(p);
      var L = p.getTotalLength(), out = new Array(n);
      for (var i = 0; i < n; i++) { var q = p.getPointAtLength(L * i / n); out[i] = [q.x, q.y]; }
      meas.removeChild(p); return out;
    };
    var cx = VB.w / 2, cy = VB.h / 2;
    // Hojas en coordenadas locales del trébol (centro = origen, ya escaladas)
    var leaves = LEAVES.map(function (d) { return sample(d, N_OUT); });
    var cb = bbox(flat(leaves)), cc = center(cb);
    var toLocal = function (p) { return [K * (p[0] - cc[0]), K * (p[1] - cc[1])]; };
    var leafLocal = leaves.map(function (pts) { return pts.map(toLocal); });
    var insetLocal = leaves.map(function (pts, i) {
      var bl = toLocal(BODY_CENTER[i] || center(bbox(pts)));
      return pts.map(function (p) { var q = toLocal(p); return [bl[0] + INSET * (q[0] - bl[0]), bl[1] + INSET * (q[1] - bl[1])]; });
    });
    this.cloverBox = { minX: cx + K * (cb.minX - cc[0]), maxX: cx + K * (cb.maxX - cc[0]), minY: cy + K * (cb.minY - cc[1]), maxY: cy + K * (cb.maxY - cc[1]) };
    this.Cfinal = [cx, cy]; this.Cleft = [cx - DRIFT, cy];
    this.T = 'translate(' + fmt(cx - K * cc[0]) + ' ' + fmt(cy - K * cc[1]) + ') scale(' + K + ')';
    // Letras: contorno exterior + agujeros (R y a)
    var rings = LETTERS.map(function (d) { return splitRings(d).map(function (r, i) { return sample(r, i ? N_HOLE : N_OUT); }); });
    var wb = bbox(flat(rings.map(function (r) { return r[0]; })));
    this.wb = wb;
    var wo = [cx - (wb.minX + wb.maxX) / 2, cy - (wb.minY + wb.maxY) / 2];
    this.wordOffset = wo;
    this.glyphBox = [];
    var self = this;
    this.paths = PLAN.map(function (pl, i) {
      var rs = rings[i], b = bbox(rs[0]);
      self.glyphBox[pl.glyph] = self.glyphBox[pl.glyph] ? merge(self.glyphBox[pl.glyph], b) : b;
      var c0 = [(b.minX + b.maxX) / 2 + wo[0], (b.minY + b.maxY) / 2 + wo[1]];
      var tgt = pl.primary ? leafLocal[pl.leaf] : insetLocal[pl.leaf];
      var qc = center(bbox(tgt));
      var tRel = tgt.map(function (p) { return [p[0] - qc[0], p[1] - qc[1]]; });
      var tSign = area(tRel) >= 0 ? 1 : -1;
      var rel = function (p) { return [p[0] + wo[0] - c0[0], p[1] + wo[1] - c0[1]]; };
      var outer = rs[0].map(rel);
      if ((area(outer) >= 0 ? 1 : -1) !== tSign) outer.reverse();
      var data = [{ src: rotateToFit(outer, tRel), tgt: tRel }];
      for (var h = 1; h < rs.length; h++) {
        var hole = rs[h].map(rel);
        if ((area(hole) >= 0 ? 1 : -1) === tSign) hole.reverse(); // sentido opuesto → agujero con nonzero
        data.push({ src: hole, tgt: null });
      }
      return { g: pl.g, glyph: pl.glyph, primary: pl.primary, leaf: pl.leaf, dot: !!pl.dot, c0: c0, qc: qc, rings: data, el: null };
    });
    meas.parentNode.removeChild(meas);
  };

  Intro.prototype._dom = function () {
    var id = this.id, ink = this.o.ink, bg = this.o.background;
    var wrap = document.createElement('div');
    var svg;
    if (this.rm) {
      var rmT = this._rmTransform();
      wrap.innerHTML = '<svg xmlns="' + NS + '" viewBox="0 0 ' + VB.w + ' ' + VB.h + '" aria-hidden="true" focusable="false">' +
        LEAVES.map(function (d) { return '<path d="' + d + '" fill="' + ink + '" fill-rule="evenodd" transform="' + rmT + '"/>'; }).join('') + '</svg>';
      svg = wrap.firstElementChild;
      svg.style.opacity = '0';
    } else {
      var T = this.T, wo = this.wordOffset, self = this;
      var pathTag = function (i) { return '<path id="' + id + '-p' + i + '" d="' + LETTERS[i] + '" fill="' + ink + '" fill-rule="evenodd"' + (PLAN[i].dot ? ' opacity="0"' : '') + '/>'; };
      wrap.innerHTML =
        '<svg xmlns="' + NS + '" viewBox="0 0 ' + VB.w + ' ' + VB.h + '" aria-hidden="true" focusable="false">' +
        '<defs>' +
          '<linearGradient id="' + id + '-wg" gradientUnits="userSpaceOnUse" x1="' + fmt(this.wb.minX - 300) + '" y1="0" x2="' + fmt(this.wb.minX - 170) + '" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
          '<mask id="' + id + '-wm" maskUnits="userSpaceOnUse" x="-4000" y="-4000" width="9000" height="9000"><rect x="-4000" y="-4000" width="9000" height="9000" fill="url(#' + id + '-wg)"/></mask>' +
          '<clipPath id="' + id + '-cc">' + LEAVES.map(function (d) { return '<path d="' + d + '" transform="' + T + '"/>'; }).join('') + '</clipPath>' +
          '<linearGradient id="' + id + '-sg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0" stop-color="#ffffff" stop-opacity="0"/>' +
            '<stop offset="0.3" stop-color="#ffffff" stop-opacity="0.1"/>' +
            '<stop offset="0.42" stop-color="#ffffff" stop-opacity="0.65"/>' +
            '<stop offset="0.5" stop-color="#ffffff" stop-opacity="1"/>' +
            '<stop offset="0.58" stop-color="#ffffff" stop-opacity="0.65"/>' +
            '<stop offset="0.7" stop-color="#ffffff" stop-opacity="0.1"/>' +
            '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>' +
          '</linearGradient>' +
          '<linearGradient id="' + id + '-sg2" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0" stop-color="#ffffff" stop-opacity="0"/>' +
            '<stop offset="0.5" stop-color="#ffffff" stop-opacity="0.75"/>' +
            '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<g id="' + id + '-word" transform="translate(' + fmt(wo[0]) + ' ' + fmt(wo[1]) + ')">' +
          '<g id="' + id + '-masked" mask="url(#' + id + '-wm)">' + PLAN.map(function (p, i) { return p.dot ? '' : pathTag(i); }).join('') + '</g>' +
          PLAN.map(function (p, i) { return p.dot ? pathTag(i) : ''; }).join('') +
        '</g>' +
        '<g id="' + id + '-shine" clip-path="url(#' + id + '-cc)" opacity="0">' +
          '<rect x="0" y="0" width="' + VB.w + '" height="' + VB.h + '" fill="url(#' + id + '-sg)"/>' +
          '<rect x="0" y="0" width="' + VB.w + '" height="' + VB.h + '" fill="url(#' + id + '-sg2)"/>' +
        '</g>' +
        '</svg>';
      svg = wrap.firstElementChild;
      this.wipe = svg.querySelector('#' + id + '-wg');
      this.shineGrad = svg.querySelector('#' + id + '-sg');
      this.shineGrad2 = svg.querySelector('#' + id + '-sg2');
      this.shineG = svg.querySelector('#' + id + '-shine');
      this.wordG = svg.querySelector('#' + id + '-word');
      this.maskedG = svg.querySelector('#' + id + '-masked');
      this.paths.forEach(function (p, i) { p.el = svg.querySelector('#' + id + '-p' + i); });
    }
    svg.style.display = 'block';
    svg.style.width = '72vw';
    svg.style.width = 'clamp(280px, min(72vw, 118vh), 780px)';
    svg.style.height = 'auto';
    svg.style.transformOrigin = '50% 50%';
    svg.style.willChange = 'transform';
    this.el.appendChild(svg);
    this.svg = svg;
  };

  Intro.prototype._rmTransform = function () {
    // Transformación del trébol centrado (misma que en la versión completa), sin muestreo
    var cx = VB.w / 2, cy = VB.h / 2, cc = [233.5, 249.5];
    return 'translate(' + fmt(cx - K * cc[0]) + ' ' + fmt(cy - K * cc[1]) + ') scale(' + K + ')';
  };

  Intro.prototype._start = function () {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._tick);
  };

  Intro.prototype._tick = function (now) {
    var dt = Math.min(0.05, (now - this.last) / 1000); // sin saltos al volver de otra pestaña
    this.last = now;
    this.t += dt * this.o.speed;
    this._render(this.t);
    if (this.state !== 'done') this.raf = requestAnimationFrame(this._tick);
  };

  Intro.prototype._render = function (t) {
    if (this.rm) return this._renderReduced(t);
    if (t < this.tl.reveal) this._reveal(t);
    else {
      if (!this.morphing) this._beginMorph();
      if (!this.settled) this._morph(t);
    }
    this._shine(t);
    this._exitOrHold(t);
  };

  // 1) El nombre se escribe de izquierda a derecha
  Intro.prototype._reveal = function (t) {
    var S = 130, wb = this.wb, tl = this.tl;
    var p = tl.ease.reveal(t / tl.reveal);
    var X = (wb.minX - S) + ((wb.maxX + 6) - (wb.minX - S)) * p;
    this.wipe.setAttribute('x1', fmt(X)); this.wipe.setAttribute('x2', fmt(X + S));
    var gb = this.glyphBox;
    for (var i = 0; i < this.paths.length; i++) {
      var P = this.paths[i], g = gb[P.glyph];
      var local = clamp01((X - (g.minX - S)) / (g.maxX - g.minX + S));
      if (P.dot) { // el punto cae sobre la i cuando el asta ya está a medio revelar
        var pd = clamp01((local - 0.3) / 0.5), e = tl.ease.riseE(pd);
        P.el.setAttribute('opacity', fmt(clamp01(pd * 1.8)));
        P.el.setAttribute('transform', 'translate(0 ' + fmt(-16 * (1 - e)) + ')');
      } else {
        var rise = tl.rise * (1 - tl.ease.riseE(local));
        P.el.setAttribute('transform', rise > 0.05 ? 'translate(0 ' + fmt(rise) + ')' : '');
      }
    }
  };

  Intro.prototype._beginMorph = function () {
    this.morphing = true;
    this.wordG.removeAttribute('transform');
    this.maskedG.removeAttribute('mask');
    for (var i = 0; i < this.paths.length; i++) {
      var el = this.paths[i].el;
      el.removeAttribute('transform'); el.setAttribute('opacity', '1'); el.setAttribute('fill-rule', 'nonzero');
    }
  };

  // 2) Las letras se acercan, se desplazan a la izquierda y se convierten en el trébol
  Intro.prototype._morph = function (t) {
    var tl = this.tl;
    var w = tl.ease.recenter(win(t, tl.recenter[0], tl.recenter[1]));
    var Cx = this.Cleft[0] + (this.Cfinal[0] - this.Cleft[0]) * w, Cy = this.Cfinal[1];
    var done = w >= 1;
    for (var i = 0; i < this.paths.length; i++) {
      var P = this.paths[i], st = P.g * tl.stagger;
      var v = tl.ease.move(win(t, tl.gather[0] + st, tl.gather[1] + st));
      var uw = P.primary ? tl.morph : tl.absorb;
      var u = tl.ease.shape(win(t, uw[0] + st, uw[1] + st));
      if (v < 1 || u < 1) done = false;
      var px = P.c0[0] + (Cx + P.qc[0] - P.c0[0]) * v, py = P.c0[1] + (Cy + P.qc[1] - P.c0[1]) * v;
      var uh = clamp01(u / 0.5); // los agujeros (R, a) se cierran antes de acabar
      var sm = Math.round(tl.smooth * Math.sin(Math.PI * u)); // a mitad de camino las formas son más orgánicas
      var d = '';
      for (var r = 0; r < P.rings.length; r++) {
        var src = P.rings[r].src, tgt = P.rings[r].tgt, n = src.length, xs = new Array(n), ys = new Array(n);
        for (var k = 0; k < n; k++) {
          var a = src[k];
          if (tgt) { var b = tgt[k]; xs[k] = px + a[0] + (b[0] - a[0]) * u; ys[k] = py + a[1] + (b[1] - a[1]) * u; }
          else { xs[k] = px + a[0] * (1 - uh); ys[k] = py + a[1] * (1 - uh); }
        }
        if (tgt && sm > 0) { var o = boxSmooth(xs, ys, sm); xs = o[0]; ys = o[1]; }
        var s = '';
        for (var q = 0; q < n; q++) s += (q ? 'L' : 'M') + xs[q].toFixed(1) + ' ' + ys[q].toFixed(1);
        d += s + 'Z';
      }
      P.el.setAttribute('d', d);
    }
    if (done) this._settle();
  };

  Intro.prototype._settle = function () { // trazados exactos del trébol original
    this.settled = true;
    for (var i = 0; i < this.paths.length; i++) {
      var P = this.paths[i];
      if (P.primary) { P.el.setAttribute('d', LEAVES[P.leaf]); P.el.setAttribute('transform', this.T); P.el.setAttribute('fill-rule', 'evenodd'); }
      else P.el.setAttribute('display', 'none');
    }
  };

  // 3) Reflejo diagonal recortado dentro del trébol: un haz principal nítido y, detrás,
  //    un segundo haz fino y más tenue, como el doble reflejo de una superficie pulida
  Intro.prototype._shine = function (t) {
    var a = this.tl.shine[0], b = this.tl.shine[1];
    if (t < a || t > b) { if (this.shineOn) { this.shineG.setAttribute('opacity', '0'); this.shineOn = false; } return; }
    if (!this.shineOn) { this.shineG.setAttribute('opacity', '1'); this.shineOn = true; }
    var p = this.tl.ease.shine(win(t, a, b));
    var W = 240, th = 24 * Math.PI / 180, dx = Math.cos(th), dy = Math.sin(th);
    var box = this.cloverBox, reach = Math.tan(th) * (box.maxY - box.minY) / 2;
    var from = box.minX - W / 2 - reach, to = box.maxX + W / 2 + reach;
    var cx = from + (to - from) * p, cy = this.Cfinal[1];
    var set = function (g, c, w) {
      g.setAttribute('x1', fmt(c - dx * w / 2)); g.setAttribute('y1', fmt(cy - dy * w / 2));
      g.setAttribute('x2', fmt(c + dx * w / 2)); g.setAttribute('y2', fmt(cy + dy * w / 2));
    };
    set(this.shineGrad, cx, W);
    set(this.shineGrad2, cx - 70, 34);
  };

  // 4) Salida coordinada, o respiración mientras la página termina de cargar
  Intro.prototype._exitOrHold = function (t) {
    var tl = this.tl;
    if (this.exitStart === null) {
      if (this.isReady && t >= this.o.minTime) { this.exitStart = t; this.exitFrom = this.scale; this.state = 'exiting'; }
      else if (t >= tl.exitAt) {
        this.state = 'holding';
        var u = (t - tl.exitAt) / BREATH.period;
        this.scale = 1 + BREATH.amp * 0.5 * (1 - Math.cos(2 * Math.PI * u));
        this.svg.style.transform = 'scale(' + this.scale.toFixed(4) + ')';
        return;
      } else return;
    }
    var e = tl.ease.exit(win(t, this.exitStart, this.exitStart + tl.exitDur));
    this.scale = this.exitFrom + (tl.exitScale - this.exitFrom) * e;
    this.svg.style.transform = 'scale(' + this.scale.toFixed(4) + ')';
    this.el.style.opacity = (1 - e).toFixed(3);
    if (e >= 1) this._finish();
  };

  Intro.prototype._renderReduced = function (t) {
    this.svg.style.opacity = eOutCubic(win(t, 0, RM.fadeIn)).toFixed(3);
    if (this.exitStart === null) {
      if (this.isReady && t >= RM.minHold) { this.exitStart = t; this.state = 'exiting'; }
      else { this.state = t >= RM.minHold ? 'holding' : 'playing'; return; }
    }
    var e = eInOutSine(win(t, this.exitStart, this.exitStart + RM.exitDur));
    this.el.style.opacity = (1 - e).toFixed(3);
    if (e >= 1) this._finish();
  };

  Intro.prototype._finish = function () {
    this.state = 'done';
    cancelAnimationFrame(this.raf);
    clearTimeout(this.maxTimer);
    document.documentElement.classList.remove('riffast-intro-active');
    if (this.o.removeOnDone && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    else this.el.style.display = 'none';
    try { document.dispatchEvent(new CustomEvent('riffast-intro:done', { detail: { intro: this } })); } catch (e) {}
    if (typeof this.o.onDone === 'function') this.o.onDone(this);
  };

  // ---- API pública -----------------------------------------------------------
  Intro.prototype.ready = function () { this.isReady = true; return this; };

  Intro.prototype.replay = function (opts) { // solo para demostraciones
    var keepReady = opts && opts.keepReady;
    cancelAnimationFrame(this.raf);
    if (this.svg && this.svg.parentNode) this.svg.parentNode.removeChild(this.svg);
    this.t = 0; this.scale = 1; this.exitStart = null; this.exitFrom = 1;
    this.morphing = false; this.settled = false; this.shineOn = false; this.state = 'playing';
    if (!keepReady) this.isReady = false;
    if (!this.el.parentNode) (document.body || document.documentElement).appendChild(this.el);
    this.el.style.display = 'flex'; this.el.style.opacity = '1';
    this._dom();
    document.documentElement.classList.add('riffast-intro-active');
    this._start();
    return this;
  };

  Intro.prototype.destroy = function () {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.maxTimer);
    this.state = 'done';
    document.documentElement.classList.remove('riffast-intro-active');
    if (this.created) { if (this.el.parentNode) this.el.parentNode.removeChild(this.el); }
    else { this.el.innerHTML = ''; this.el.style.display = 'none'; }
  };

  function mount(opts) {
    var o = opts || {};
    if (!document.body && !(o.container instanceof Element)) {
      // script en <head>: esperamos al body para poder montar el overlay
      var pending = { _q: [], ready: function () { pending._q.push('ready'); return pending; }, state: 'init' };
      document.addEventListener('DOMContentLoaded', function () {
        var inst = new Intro(o);
        if (pending._q.length) inst.ready();
        Object.assign(pending, { ready: inst.ready.bind(inst), replay: inst.replay.bind(inst), destroy: inst.destroy.bind(inst), instance: inst });
      }, { once: true });
      return pending;
    }
    return new Intro(o);
  }

  global.RiffastIntro = { mount: mount, presets: PRESETS, version: '1.1.0' };
})(typeof window !== 'undefined' ? window : this);

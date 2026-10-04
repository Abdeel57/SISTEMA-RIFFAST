import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, GUIDE_TOPICS, guideSection, NOTA_SIN_IMAGENES, parseGuide, readGuideText, type ContextVars } from '../prompt.js';

const CONTEXT: ContextVars = {
  NOMBRE: 'Ana (página «Rifas Ana»)',
  ROL: 'administrador',
  URL_PAGINA: 'https://rifasana.com',
  PLAN: 'Completo',
  TELEFONO: '662 123 4567',
  FECHA_HORA: 'sábado, 3 de octubre de 2026, 12:00',
  ZONA: 'America/Mexico_City',
  MONEDA: 'MXN',
  DATOS_PAGO: 'sin configurar',
  RIFAS: '• Aún no tiene rifas.',
};

describe('prompt', () => {
  for (const vision of [true, false]) {
    test(`no quedan variables sin rellenar (imágenes: ${vision})`, () => {
      const p = buildSystemPrompt(
        { MARCA: 'Riffast', NOTA_IMAGENES: vision ? '' : NOTA_SIN_IMAGENES, HORARIO_LLAMADAS: 'de 9:00 a 21:00' },
        CONTEXT,
      );
      assert.doesNotMatch(p.fijo, /\{\{|\}\}/);
      assert.doesNotMatch(p.variable, /\{\{|\}\}/);
      assert.match(p.fijo, /^Eres el asistente de soporte de Riffast/);
      assert.match(p.fijo, /<\/ejemplo>$/);
      assert.match(p.variable, /^## Contexto de esta conversación/);
      assert.doesNotMatch(p.fijo, /aquí termina la parte fija/);
      assert.doesNotMatch(p.fijo, /<!--/);
      assert.equal(p.fijo.includes(NOTA_SIN_IMAGENES), !vision);
    });
  }

  test('la parte fija no cambia con el contexto (cacheable)', () => {
    const fixed = { MARCA: 'Riffast', NOTA_IMAGENES: '', HORARIO_LLAMADAS: 'x' };
    const a = buildSystemPrompt(fixed, CONTEXT);
    const b = buildSystemPrompt(fixed, { ...CONTEXT, FECHA_HORA: 'otro día', RIFAS: '• Otra' });
    assert.equal(a.fijo, b.fijo);
    assert.notEqual(a.variable, b.variable);
  });
});

describe('guía', () => {
  test('hay una sección para cada tema de consultar_guia', () => {
    const sections = parseGuide(readGuideText(), 'Riffast');
    for (const topic of GUIDE_TOPICS) {
      assert.ok(sections[topic], `falta la sección "## ${topic}" en guia.md`);
      assert.ok(sections[topic].length > 80, `la sección "${topic}" está casi vacía`);
      assert.doesNotMatch(sections[topic], /\{\{/);
    }
    assert.deepEqual(Object.keys(sections).sort(), [...GUIDE_TOPICS].sort());
  });

  test('la marca sale de la variable', () => {
    const s = guideSection('datos_pago', 'MiMarca');
    assert.ok(s?.includes('MiMarca'));
  });
});

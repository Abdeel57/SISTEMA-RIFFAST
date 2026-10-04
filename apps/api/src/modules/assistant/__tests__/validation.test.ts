import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  clabeBank,
  clabeBankWarning,
  clabeValid,
  localDateTimeToUtc,
  luhnValid,
  mentionsSensitiveCardData,
  validateCardNumber,
  validateClabe,
  validateDrawDate,
  validatePhone,
} from '../validation.js';
import { formatPhone, fullDate, groupDigits, money, safeTimeZone, shortDate } from '../format.js';

describe('tarjeta (Luhn)', () => {
  test('números válidos e inválidos', () => {
    assert.equal(luhnValid('4111111111111111'), true);
    assert.equal(luhnValid('4111111111111112'), false);
    assert.equal(luhnValid('5555555555554444'), true);
    assert.equal(validateCardNumber('4111 1111 1111 1111').ok, true);
  });

  test('mensaje claro cuando un dígito está mal', () => {
    const r = validateCardNumber('4152 3138 0000 0001');
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.error : '', /El número de tarjeta 4152 3138 .* no es válido: algún dígito está mal\./);
    const short = validateCardNumber('4111 1111');
    assert.equal(short.ok, false);
    assert.match(!short.ok ? short.error : '', /13 a 19 dígitos/);
  });
});

describe('CLABE', () => {
  test('032180000118359719 es válida', () => {
    assert.equal(clabeValid('032180000118359719'), true);
    assert.equal(validateClabe('0321 8000 0118 3597 19').ok, true);
  });

  test('dígito de control incorrecto o largo incorrecto', () => {
    assert.equal(clabeValid('032180000118359718'), false);
    const bad = validateClabe('032180000118359718');
    assert.equal(bad.ok, false);
    assert.match(!bad.ok ? bad.error : '', /no es válida: algún dígito está mal/);
    const len = validateClabe('12345');
    assert.match(!len.ok ? len.error : '', /18 dígitos/);
  });

  test('banco por prefijo y aviso cuando no coincide', () => {
    assert.equal(clabeBank('012180000000000000'), 'BBVA/Bancomer');
    assert.equal(clabeBank('638180000000000000'), 'Nu');
    assert.equal(clabeBankWarning('BBVA', '012180000000000000'), null);
    assert.equal(clabeBankWarning('Bancomer', '012180000000000000'), null);
    assert.equal(clabeBankWarning('Mercado Pago', '722969010000000000'), null);
    assert.equal(clabeBankWarning('Banco Azteca', '127180000000000000'), null);
    const w = clabeBankWarning('Banorte', '012180000000000000');
    assert.ok(w);
    assert.match(w!, /BBVA\/Bancomer/);
    assert.match(w!, /Banorte/);
    // "nu" no debe coincidir dentro de otra palabra ("nuevo")
    assert.ok(clabeBankWarning('Banamex nuevo', '638180000000000000'));
    assert.equal(clabeBankWarning('Nu México', '638180000000000000'), null);
    // prefijo desconocido: sin aviso
    assert.equal(clabeBankWarning('Lo que sea', '999180000000000000'), null);
  });

  test('detecta vencimiento/CVV escondidos en una nota', () => {
    assert.equal(mentionsSensitiveCardData('Vence 12/28'), true);
    assert.equal(mentionsSensitiveCardData('CVV 123'), true);
    assert.equal(mentionsSensitiveCardData('Solo depósitos en OXXO'), false);
    assert.equal(mentionsSensitiveCardData('Spin by OXXO'), false);
  });
});

describe('fechas', () => {
  test('hora local → UTC según la zona del navegador', () => {
    assert.equal(localDateTimeToUtc('2026-11-30T20:00', 'America/Mexico_City')?.toISOString(), '2026-12-01T02:00:00.000Z');
    assert.equal(localDateTimeToUtc('2026-11-30T20:00', 'America/Hermosillo')?.toISOString(), '2026-12-01T03:00:00.000Z');
    assert.equal(localDateTimeToUtc('2026-11-30T20:00', 'America/Tijuana')?.toISOString(), '2026-12-01T04:00:00.000Z');
    // Zona inválida → respaldo America/Mexico_City
    assert.equal(localDateTimeToUtc('2026-11-30T20:00', 'Marte/Base')?.toISOString(), '2026-12-01T02:00:00.000Z');
  });

  test('fechas inexistentes', () => {
    assert.equal(localDateTimeToUtc('2026-02-31T10:00', 'America/Mexico_City'), null);
    assert.equal(localDateTimeToUtc('2026-13-01T10:00', 'America/Mexico_City'), null);
    assert.equal(localDateTimeToUtc('2026-03-08T02:30', 'America/Tijuana'), null); // hueco del cambio de horario
    assert.equal(localDateTimeToUtc('30/11/2026 20:00', 'America/Mexico_City'), null);
  });

  test('reglas: pasada, menos de 15 min, más de 2 años', () => {
    const now = new Date('2026-10-03T18:00:00Z'); // 12:00 en CDMX
    assert.equal(validateDrawDate('2026-11-30T20:00', 'America/Mexico_City', now).ok, true);
    const past = validateDrawDate('2026-10-01T10:00', 'America/Mexico_City', now);
    assert.match(!past.ok ? past.error : '', /ya pasó/);
    const soon = validateDrawDate('2026-10-03T12:10', 'America/Mexico_City', now);
    assert.match(!soon.ok ? soon.error : '', /15 minutos/);
    const far = validateDrawDate('2029-01-01T10:00', 'America/Mexico_City', now);
    assert.match(!far.ok ? far.error : '', /2 años/);
    const invalid = validateDrawDate('2026-02-31T10:00', 'America/Mexico_City', now);
    assert.match(!invalid.ok ? invalid.error : '', /no existe/);
    const fmt = validateDrawDate('mañana', 'America/Mexico_City', now);
    assert.match(!fmt.ok ? fmt.error : '', /AAAA-MM-DDTHH:MM/);
  });
});

describe('formatos', () => {
  test('dinero, fechas, dígitos y teléfono', () => {
    assert.equal(money(50, 'MXN'), '$50 MXN');
    assert.equal(money(1500, 'MXN'), '$1,500 MXN');
    assert.match(money(20, 'USD'), /USD/);
    const d = new Date('2026-12-01T02:00:00Z');
    assert.equal(fullDate(d, 'America/Mexico_City'), 'lunes, 30 de noviembre de 2026, 20:00');
    assert.equal(shortDate(d, 'America/Mexico_City'), 'lun 30 nov 20:00');
    assert.equal(groupDigits('032180000118359719'), '0321 8000 0118 3597 19');
    assert.equal(formatPhone('6621234567'), '662 123 4567');
    assert.equal(formatPhone('+52 662 123 4567'), '+52 662 123 4567');
    assert.equal(validatePhone('662-123-4567').ok, true);
    assert.equal(validatePhone('123').ok, false);
    assert.equal(safeTimeZone('Nada/Nada'), 'America/Mexico_City');
  });
});

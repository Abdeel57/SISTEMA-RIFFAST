// Siembra apartados de demo (compradores realistas) vía el endpoint público,
// para que la pantalla de Órdenes luzca con pagos por confirmar.
const API = 'http://localhost:4000';

async function getRaffleId() {
  const r = await fetch(`${API}/public/raffles/by-event/rifasdelasuerte/2`);
  const d = await r.json();
  return d.raffle.id;
}

const BUYERS = [
  { fullName: 'María Fernanda López', phone: '6671234501', tickets: [101, 102, 103] },
  { fullName: 'José Luis Hernández', phone: '8112345602', tickets: [250, 251] },
  { fullName: 'Ana Karen Ramírez', phone: '3312345703', tickets: [777] },
  { fullName: 'Carlos Eduardo Soto', phone: '5512345804', tickets: [1500, 1501, 1502, 1503] },
];

const raffleId = await getRaffleId();
for (const b of BUYERS) {
  const res = await fetch(`${API}/public/raffles/${raffleId}/reserve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      buyer: { fullName: b.fullName, phone: b.phone, whatsapp: b.phone, state: '' },
      ticketNumbers: b.tickets,
    }),
  });
  const d = await res.json().catch(() => null);
  console.log(`${b.fullName} → ${res.status} ${d?.receipt?.code ?? d?.message ?? ''}`);
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Eye,
  FileBarChart,
  Headset,
  LayoutDashboard,
  Palette,
  Settings,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ListGroup, ListRow } from '@/components/owner/List';
import { useAssistant } from '@/components/owner/Assistant';

interface RowDef {
  title: string;
  desc?: string;
  icon: LucideIcon;
  to: string;
}

const GROUPS: { label: string; rows: RowDef[] }[] = [
  {
    label: 'Tu página',
    rows: [
      { title: 'Apariencia', desc: 'Logo, colores y portada', icon: Palette, to: '/admin/diseno' },
      { title: 'Perfil', desc: 'Nombre, descripción y redes', icon: User, to: '/admin/perfil' },
    ],
  },
  {
    label: 'Cobros',
    rows: [{ title: 'Datos de pago', desc: 'Cuenta, CLABE e instrucciones', icon: CreditCard, to: '/admin/pagos' }],
  },
  {
    label: 'Tu negocio',
    rows: [
      { title: 'Resumen', desc: 'Métricas de tus rifas', icon: LayoutDashboard, to: '/admin/inicio' },
      { title: 'Reportes', desc: 'Exporta órdenes, boletos y compradores', icon: FileBarChart, to: '/admin/reportes' },
      { title: 'Usuarios y Roles', desc: 'Administradores y vendedores con su link', icon: Users, to: '/admin/usuarios' },
      { title: 'Ajustes', desc: 'Apartado, comprobantes y ganadores', icon: Settings, to: '/admin/configuracion' },
    ],
  },
];

// Hub de configuración (pestaña "Más"): lista agrupada como Ajustes de iOS.
export function MoreMenu({ onPick }: { onPick: (to: string) => void }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { openAssistant } = useAssistant();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/', { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  return (
    <div>
      {GROUPS.map((group) => (
        <ListGroup key={group.label} header={group.label}>
          {group.rows.map((row) => (
            <ListRow key={row.title} icon={row.icon} title={row.title} subtitle={row.desc} onClick={() => onPick(row.to)} />
          ))}
        </ListGroup>
      ))}

      <ListGroup header="Ayuda">
        <ListRow
          icon={Headset}
          title="Asistencia 24 h"
          subtitle="Dudas y cambios en tu administrador"
          onClick={openAssistant}
        />
      </ListGroup>

      <ListGroup header="Cuenta">
        <ListRow icon={Eye} iconTone="neutral" title="Ver mi página" onClick={() => navigate('/')} />
      </ListGroup>

      <ListGroup>
        <ListRow title="Cerrar sesión" destructive center onClick={() => setConfirmLogout(true)} />
      </ListGroup>

      <p className="px-4 pb-2 pt-6 text-center text-caption text-rf-tertiary">Riffast · Panel del rifero</p>

      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="¿Cerrar sesión?"
        description="Para volver a entrar tendrás que escribir tu usuario y contraseña."
        confirmLabel="Cerrar sesión"
        destructive
        loading={loggingOut}
        onConfirm={() => void doLogout()}
      />
    </div>
  );
}

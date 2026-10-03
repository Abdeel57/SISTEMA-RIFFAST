import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Copy, Pencil, ShieldCheck, Store, KeyRound, Users as UsersIcon } from 'lucide-react';
import {
  createPanelUserSchema,
  STAFF_ROLE_LABELS,
  formatMXN,
  type PanelUserDTO,
  type CreatePanelUserInput,
  type UpdatePanelUserInput,
} from '@riffast/shared';
import { userService } from '@/services/users';
import { ApiError } from '@/lib/api';
import { buildSellerHomeUrl } from '@/lib/site';
import { copyToClipboard } from '@/lib/clipboard';
import { PanelIntro, PANEL_CARD, IconButton } from '@/components/owner/PanelKit';
import { HeaderAction } from '@/components/owner/AdminChrome';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PageLoader, EmptyState, ErrorState } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

function RoleBadge({ role }: { role: PanelUserDTO['role'] }) {
  if (role === 'SELLER') {
    return (
      <Badge variant="info">
        <Store /> Vendedor
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <ShieldCheck /> Administrador
    </Badge>
  );
}

// Métrica compacta (valor + etiqueta) para la cuadrícula de estadísticas.
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'warning' | 'info' }) {
  return (
    <div className="min-w-0 px-2 py-2.5 text-center">
      <p
        className={cn(
          'truncate text-body font-semibold tabular-nums',
          tone === 'accent' && 'text-rf-accent',
          tone === 'warning' && 'text-rf-warning',
          tone === 'info' && 'text-rf-info',
          !tone && 'text-rf-label',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-caption text-rf-secondary">{label}</p>
    </div>
  );
}

function UserCard({ user, onEdit }: { user: PanelUserDTO; onEdit: (u: PanelUserDTO) => void }) {
  const queryClient = useQueryClient();
  const [confirmToggle, setConfirmToggle] = useState(false);

  const isActive = user.status === 'ACTIVE';
  const link = user.sellerCode ? buildSellerHomeUrl(user.sellerCode) : null;

  const toggleStatus = useMutation({
    mutationFn: () => userService.update(user.id, { status: isActive ? 'SUSPENDED' : 'ACTIVE' }),
    onSuccess: () => {
      setConfirmToggle(false);
      toast.success(isActive ? 'Usuario desactivado.' : 'Usuario activado.');
      void queryClient.invalidateQueries({ queryKey: ['panel-users'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo actualizar'),
  });

  const s = user.stats;

  return (
    <article className={cn(PANEL_CARD, 'p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-body font-semibold text-rf-label">{user.name}</h3>
            {user.isOwner && <Badge variant="warning">Dueño</Badge>}
          </div>
          <p className="truncate text-callout text-rf-secondary">{user.email}</p>
        </div>
        <RoleBadge role={user.role} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant={isActive ? 'success' : 'muted'}>{isActive ? 'Activo' : 'Inactivo'}</Badge>
        {user.sellerCode && <Badge variant="outline" className="tabular-nums">{user.sellerCode}</Badge>}
      </div>

      {/* Link de venta del vendedor */}
      {link && (
        <div className="mt-3 flex items-center gap-2 rounded-control bg-rf-fill py-1 pl-3 pr-1">
          <span className="min-w-0 flex-1 truncate text-callout text-rf-secondary">{link}</span>
          <IconButton
            icon={Copy}
            label="Copiar link de venta"
            tone="accent"
            onClick={() => void copyToClipboard(link, 'Link copiado')}
          />
        </div>
      )}

      {/* Métricas del vendedor */}
      {user.role === 'SELLER' && s && (
        <div className="mt-3 grid grid-cols-3 divide-x divide-y divide-rf-separator overflow-hidden rounded-control ring-1 ring-inset ring-rf-separator [&>*:nth-child(-n+3)]:border-t-0 [&>*:nth-child(3n+1)]:border-l-0">
          <Stat label="Órdenes" value={s.ordersTotal.toLocaleString('es-MX')} />
          <Stat label="Boletos" value={s.ticketsSold.toLocaleString('es-MX')} />
          <Stat label="Vendido" value={formatMXN(s.revenue)} tone="accent" />
          <Stat label="Pendientes" value={s.pendingOrders.toLocaleString('es-MX')} tone="warning" />
          <Stat label="Pagadas" value={s.paidOrders.toLocaleString('es-MX')} tone="info" />
          <Stat label="Canceladas" value={s.cancelledOrders.toLocaleString('es-MX')} />
        </div>
      )}

      {/* Acciones */}
      <div className="mt-4 flex items-center gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => onEdit(user)}>
          <Pencil className="h-[18px] w-[18px]" /> Editar
        </Button>
        {!user.isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className={isActive ? 'text-rf-danger active:bg-rf-danger/10' : undefined}
            onClick={() => setConfirmToggle(true)}
          >
            {isActive ? 'Desactivar' : 'Activar'}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmToggle}
        onOpenChange={setConfirmToggle}
        title={isActive ? '¿Desactivar este usuario?' : '¿Activar este usuario?'}
        description={
          isActive ? (
            <>
              <span className="font-semibold text-rf-label">{user.name}</span> ya no podrá iniciar sesión hasta que lo
              vuelvas a activar. Sus ventas anteriores se conservan.
            </>
          ) : (
            <>
              <span className="font-semibold text-rf-label">{user.name}</span> podrá volver a iniciar sesión en el
              panel.
            </>
          )
        }
        confirmLabel={isActive ? 'Sí, desactivar' : 'Sí, activar'}
        destructive={isActive}
        loading={toggleStatus.isPending}
        onConfirm={() => toggleStatus.mutate()}
      />
    </article>
  );
}

// ── Hoja de crear/editar usuario ───────────────────────────
type FormValues = CreatePanelUserInput;

function UserFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: PanelUserDTO | null;
}) {
  const queryClient = useQueryClient();
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createPanelUserSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', role: 'SELLER', sellerCode: '' },
  });

  const role = watch('role');

  // Prellena el formulario al abrir: con los datos del usuario (editar) o en
  // blanco (crear). Va en efecto porque Radix no llama onOpenChange al abrir
  // de forma programática desde el padre.
  useEffect(() => {
    if (!open) return;
    setTempPassword(null);
    if (editing) {
      reset({
        name: editing.name,
        email: editing.email,
        phone: '',
        password: '',
        role: editing.role === 'SELLER' ? 'SELLER' : 'RIFERO',
        sellerCode: editing.sellerCode ?? '',
      });
    } else {
      reset({ name: '', email: '', phone: '', password: '', role: 'SELLER', sellerCode: '' });
    }
  }, [open, editing, reset]);

  const create = useMutation({
    mutationFn: (values: FormValues) => userService.create(values),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['panel-users'] });
      if (res.tempPassword) {
        setTempPassword(res.tempPassword);
        toast.success('Usuario creado. Comparte la contraseña temporal.');
      } else {
        toast.success('Usuario creado.');
        onOpenChange(false);
        reset();
      }
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo crear el usuario'),
  });

  const update = useMutation({
    mutationFn: (values: FormValues) => {
      // Solo enviamos rol/código cuando cambian: así editar al dueño o la propia
      // cuenta (nombre/contraseña) no choca con las protecciones del backend.
      const payload: UpdatePanelUserInput = {
        name: values.name,
        phone: values.phone,
        password: values.password,
      };
      if (!editing!.isOwner && values.role !== editing!.role) payload.role = values.role;
      if (values.role === 'SELLER' && (values.sellerCode ?? '') !== (editing!.sellerCode ?? '')) {
        payload.sellerCode = values.sellerCode;
      }
      return userService.update(editing!.id, payload);
    },
    onSuccess: () => {
      toast.success('Usuario actualizado.');
      void queryClient.invalidateQueries({ queryKey: ['panel-users'] });
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo actualizar'),
  });

  // Cierre (limpia la contraseña temporal mostrada).
  const onOpenChangeWrapped = (o: boolean) => {
    if (!o) setTempPassword(null);
    onOpenChange(o);
  };

  const submit = (values: FormValues) => {
    if (editing) update.mutate(values);
    else create.mutate(values);
  };

  const pending = create.isPending || update.isPending;
  const editingOwner = editing?.isOwner ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChangeWrapped}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Actualiza los datos, el rol o la contraseña de este usuario.'
              : 'Crea un administrador o un vendedor con su propio acceso al panel.'}
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          // Éxito: contraseña temporal (se muestra una sola vez).
          <div className="space-y-4">
            <div className="rounded-control bg-rf-accent/[0.08] p-4">
              <p className="text-callout font-medium text-rf-label">
                Usuario creado. Comparte esta contraseña temporal (no se volverá a mostrar):
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 rounded-control bg-rf-surface px-3 py-2.5 text-heading tabular-nums tracking-wide">
                  {tempPassword}
                </code>
                <IconButton
                  icon={Copy}
                  label="Copiar contraseña"
                  tone="accent"
                  onClick={() => void copyToClipboard(tempPassword, 'Contraseña copiada')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  onOpenChangeWrapped(false);
                  reset();
                }}
              >
                Entendido
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(submit)} className="space-y-4">
            <div>
              <Label htmlFor="u-name">Nombre completo</Label>
              <Input
                id="u-name"
                placeholder="Juan Pérez"
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && <p role="alert" className="mt-1.5 text-callout text-rf-danger">{errors.name.message}</p>}
            </div>

            <div>
              <Label htmlFor="u-email">Usuario o correo</Label>
              <Input
                id="u-email"
                placeholder="juan@correo.com o juanventas"
                disabled={!!editing}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {editing && <p className="mt-1.5 text-caption text-rf-secondary">El usuario de acceso no se puede cambiar.</p>}
              {errors.email && <p role="alert" className="mt-1.5 text-callout text-rf-danger">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="u-phone">Teléfono (opcional)</Label>
              <Input
                id="u-phone"
                type="tel"
                inputMode="tel"
                placeholder="55 1234 5678"
                autoComplete="off"
                enterKeyHint="next"
                {...register('phone')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="u-role">Rol</Label>
                <Select id="u-role" {...register('role')} disabled={editingOwner}>
                  <option value="SELLER">{STAFF_ROLE_LABELS.SELLER}</option>
                  <option value="RIFERO">{STAFF_ROLE_LABELS.RIFERO}</option>
                </Select>
              </div>
              {role === 'SELLER' && (
                <div>
                  <Label htmlFor="u-code">Código (opcional)</Label>
                  <Input
                    id="u-code"
                    placeholder="VEN01"
                    className="uppercase"
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    {...register('sellerCode')}
                  />
                </div>
              )}
            </div>
            {role === 'SELLER' && (
              <p className="-mt-2 text-caption text-rf-secondary">Si lo dejas vacío se genera automáticamente (VEN01, VEN02…).</p>
            )}

            <div>
              <Label htmlFor="u-pass" className="flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-rf-secondary" />
                {editing ? 'Nueva contraseña (opcional)' : 'Contraseña (opcional)'}
              </Label>
              <Input
                id="u-pass"
                type="text"
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              <p className="mt-1.5 text-caption text-rf-secondary">
                {editing ? 'Déjala vacía para no cambiarla.' : 'Déjala vacía y el sistema generará una contraseña temporal.'}
              </p>
              {errors.password && <p role="alert" className="mt-1.5 text-callout text-rf-danger">{errors.password.message}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChangeWrapped(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending} loadingText={editing ? 'Guardando…' : 'Creando…'}>
                {editing ? 'Guardar cambios' : 'Crear usuario'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PanelUserDTO | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['panel-users'],
    queryFn: () => userService.list(),
  });
  const users = data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (u: PanelUserDTO) => {
    setEditing(u);
    setFormOpen(true);
  };

  return (
    <div>
      <HeaderAction label="Nuevo usuario" icon={Plus} onClick={openCreate} />
      <PanelIntro description="Da acceso al panel a administradores y vendedores. Cada vendedor tiene su propio link de venta." />

      {isLoading ? (
        <PageLoader label="Cargando usuarios..." />
      ) : isError ? (
        <ErrorState
          title="No pudimos cargar los usuarios"
          description={error instanceof ApiError ? error.message : undefined}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="Aún no hay usuarios"
          description="Crea tu primer vendedor para empezar a repartir links de venta."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-5 w-5" /> Crear usuario
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {users.map((u) => (
            <UserCard key={u.id} user={u} onEdit={openEdit} />
          ))}
        </div>
      )}

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
    </div>
  );
}

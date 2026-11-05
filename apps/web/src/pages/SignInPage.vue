<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AuthError } from '../auth/auth-provider.ts';
import { ACTIONS, useApp } from '../composables/app-context.ts';
import { theme } from '../composables/theme.ts';

const app = useApp();
const router = useRouter();
const modal = ref(false);
const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const noAccess = ref(false);
const busy = ref(false);
const emailInput = ref<HTMLInputElement | null>(null);
/** A first sign-in in Cognito replaces the temporary password before entering. */
const step = ref<'credentials' | 'new_password'>('credentials');
const newPassword = ref('');
const repeatPassword = ref('');
const newPasswordInput = ref<HTMLInputElement | null>(null);
const dialog = ref<HTMLElement | null>(null);
const opener = ref<HTMLButtonElement | null>(null);

const studioLogo = computed(() => (theme.value === 'light' ? '/logos/studio-light.png' : '/logos/studio-dark.png'));
/** The development login of the sandbox only needs the email of an active account. */
const devLogin = app.config.authMode === 'dev';

onMounted(() => {
  if (app.user.value !== null && app.can(ACTIONS.view)) void router.replace({ name: 'workspace' });
});

async function open(): Promise<void> {
  modal.value = true;
  error.value = null;
  await nextTick();
  emailInput.value?.focus();
}

function close(): void {
  modal.value = false;
  step.value = 'credentials';
  password.value = '';
  newPassword.value = '';
  repeatPassword.value = '';
  void nextTick(() => opener.value?.focus());
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close();
    return;
  }
  if (event.key !== 'Tab' || dialog.value === null) return;
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>('button, input, a[href]')].filter((element) => !element.hasAttribute('disabled'));
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function showNoAccess(): void {
  modal.value = false;
  noAccess.value = true;
}

async function enter(): Promise<void> {
  if (!app.can(ACTIONS.view)) {
    await app.signOut();
    showNoAccess();
    return;
  }
  await router.replace({ name: 'workspace' });
}

async function submit(): Promise<void> {
  if (busy.value) return;
  if (step.value === 'new_password' && newPassword.value !== repeatPassword.value) {
    error.value = 'Las contraseñas no coinciden.';
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    if (step.value === 'new_password') await app.confirmNewPassword(newPassword.value);
    else await app.signIn(email.value, password.value);
    await enter();
  } catch (cause) {
    if (cause instanceof AuthError && cause.reason === 'new_password') {
      step.value = 'new_password';
      await nextTick();
      newPasswordInput.value?.focus();
    } else if (cause instanceof AuthError && cause.reason === 'no_access') showNoAccess();
    else error.value = cause instanceof AuthError ? cause.message : 'No se pudo iniciar sesión.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="signin">
    <section class="brand">
      <img :src="studioLogo" alt="Lumia Studio" class="brand-logo" />
      <svg class="star" viewBox="-110 -115 220 230" width="520" height="520" aria-hidden="true">
        <path fill="#2F6BFF" d="M0,-100 C4,-6.9 4,-6.9 86.6,-50 C8,0 8,0 86.6,50 C4,6.9 4,6.9 0,100 C-4,6.9 -4,6.9 -86.6,50 C-8,0 -8,0 -86.6,-50 C-4,-6.9 -4,-6.9 0,-100Z" />
        <g fill="#3FC5F0">
          <circle cx="35" cy="-60.6" r="10" /><circle cx="70" cy="0" r="10" /><circle cx="35" cy="60.6" r="10" />
          <circle cx="-35" cy="60.6" r="10" /><circle cx="-70" cy="0" r="10" /><circle cx="-35" cy="-60.6" r="10" />
        </g>
      </svg>
      <div class="pitch">
        <span class="kicker">Plataforma de contenido</span>
        <h1>Crea el contenido de tus clases</h1>
        <p>El entorno de trabajo donde cada clase se convierte en contenido interactivo, con Lumi a tu lado.</p>
      </div>
      <div class="points">
        <div class="point"><span class="point-title">Todo en un árbol</span><span class="point-text">Cada clase en su carpeta, lista para crear su contenido</span></div>
        <div class="point"><span class="point-title">Lumi a tu lado</span><span class="point-text">Te ayuda a crear y revisar el contenido</span></div>
        <div class="point"><span class="point-title">Contenido dinámico</span><span class="point-text">Crea clases dinámicas para los estudiantes</span></div>
      </div>
    </section>

    <section class="entry">
      <div class="entry-box">
        <div class="entry-head">
          <h2>Inicia sesión</h2>
          <p>Entra con tu cuenta de Lumia Studio.</p>
        </div>
        <p v-if="noAccess" class="no-access" role="alert" data-testid="sign-in-no-access">Tu cuenta no tiene acceso a Lumia Studio. Pide a un administrador que habilite tu acceso.</p>
        <button ref="opener" type="button" class="btn-primary big" aria-haspopup="dialog" data-testid="sign-in-open" @click="open">
          <svg viewBox="-100 -105 200 210" width="18" height="18" aria-hidden="true">
            <path fill="#FFFFFF" d="M0,-100 C4,-6.9 4,-6.9 86.6,-50 C8,0 8,0 86.6,50 C4,6.9 4,6.9 0,100 C-4,6.9 -4,6.9 -86.6,50 C-8,0 -8,0 -86.6,-50 C-4,-6.9 -4,-6.9 0,-100Z" />
            <g fill="#A5E8FF">
              <circle cx="35" cy="-60.6" r="13" /><circle cx="70" cy="0" r="13" /><circle cx="35" cy="60.6" r="13" />
              <circle cx="-35" cy="60.6" r="13" /><circle cx="-70" cy="0" r="13" /><circle cx="-35" cy="-60.6" r="13" />
            </g>
          </svg>
          Iniciar sesión
        </button>
        <span class="foot">Lumia Studio · Plataforma de contenido</span>
      </div>
    </section>

    <div v-if="modal" class="overlay" @keydown="onKeydown">
      <section ref="dialog" class="dialog" role="dialog" aria-modal="true" aria-labelledby="sign-in-title" data-testid="sign-in-dialog">
        <div class="dialog-head">
          <img :src="studioLogo" alt="Lumia Studio" class="dialog-logo" />
          <button type="button" class="x" aria-label="Cerrar" title="Cerrar" data-testid="sign-in-close" @click="close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div v-if="step === 'credentials'" class="dialog-title">
          <h2 id="sign-in-title">Inicia sesión</h2>
          <p v-if="devLogin">Sandbox: escribe el correo de una cuenta activa; la contraseña no se revisa.</p>
          <p v-else>Usa el correo y la contraseña de tu cuenta de Lumia Studio.</p>
        </div>
        <div v-else class="dialog-title">
          <h2 id="sign-in-title">Crea tu contraseña</h2>
          <p>Es tu primer inicio de sesión. Elige una contraseña de al menos 12 caracteres, con mayúsculas, minúsculas, números y símbolos.</p>
        </div>
        <form class="form" @submit.prevent="submit">
          <template v-if="step === 'credentials'">
            <label class="field">Correo
              <input ref="emailInput" v-model="email" type="email" autocomplete="username" required data-testid="sign-in-email" />
            </label>
            <label class="field">Contraseña
              <input v-model="password" type="password" autocomplete="current-password" :required="!devLogin" data-testid="sign-in-password" />
            </label>
          </template>
          <template v-else>
            <label class="field">Contraseña nueva
              <input ref="newPasswordInput" v-model="newPassword" type="password" autocomplete="new-password" minlength="12" required data-testid="sign-in-new-password" />
            </label>
            <label class="field">Repite la contraseña
              <input v-model="repeatPassword" type="password" autocomplete="new-password" minlength="12" required data-testid="sign-in-repeat-password" />
            </label>
          </template>
          <p v-if="error" class="error" role="alert" data-testid="sign-in-error">{{ error }}</p>
          <button v-if="step === 'credentials'" type="button" class="lnk" title="Próximamente" @click.prevent>¿Olvidaste tu contraseña?</button>
          <div class="actions">
            <button type="button" class="btn-2" data-testid="sign-in-cancel" @click="close">Cancelar</button>
            <button type="submit" class="btn-primary" :disabled="busy" data-testid="sign-in-submit">{{ step === 'credentials' ? 'Iniciar sesión' : 'Guardar y entrar' }}</button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.signin { position: relative; min-height: 100vh; background: var(--s-editor); color: var(--s-text); display: flex; flex-wrap: wrap; align-items: stretch; }
.brand { flex: 1 1 520px; background: var(--s-chrome); border-right: 1px solid var(--s-border); padding: 56px 64px; display: flex; flex-direction: column; justify-content: space-between; gap: 48px; position: relative; overflow: hidden; }
.brand-logo { height: 40px; width: auto; align-self: flex-start; position: relative; }
.star { position: absolute; right: -140px; top: 160px; opacity: 0.12; }
.pitch { display: flex; flex-direction: column; gap: 20px; max-width: 520px; position: relative; }
.kicker { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--s-accent-fg); }
h1 { margin: 0; font-size: 44px; line-height: 1.12; font-weight: 500; letter-spacing: -0.02em; }
.pitch p { margin: 0; font-size: 16px; line-height: 1.6; color: var(--s-text-2); }
.points { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; position: relative; }
.point { display: flex; flex-direction: column; gap: 6px; padding-top: 14px; border-top: 1px solid var(--s-border); }
.point-title { font-weight: 500; }
.point-text { font-size: 13px; color: var(--s-text-2); line-height: 1.5; }
.entry { flex: 1 1 420px; padding: 56px 32px; display: flex; align-items: center; justify-content: center; }
.entry-box { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 24px; }
.entry-head { display: flex; flex-direction: column; gap: 8px; }
.entry-head h2 { margin: 0; font-size: 28px; font-weight: 500; }
.entry-head p { margin: 0; line-height: 1.55; color: var(--s-text-2); }
.btn-primary { background: #2f6bff; color: #fff; border: 0; cursor: pointer; }
.btn-primary:hover { background: #2560f0; }
.btn-primary:disabled { opacity: 0.6; cursor: progress; }
.big { min-height: 48px; padding: 0 18px; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 10px; font-size: 15px; font-weight: 500; }
.foot { font-size: 12px; color: var(--s-text-2); text-align: center; }
.no-access { margin: 0; padding: 12px 14px; border: 1px solid var(--s-danger); border-radius: 10px; color: var(--s-danger); font-size: 13px; line-height: 1.5; }
.overlay { position: absolute; inset: 0; z-index: 10; background: var(--s-overlay); display: flex; align-items: center; justify-content: center; padding: 16px; }
.dialog { width: 100%; max-width: 440px; background: var(--s-chrome); border: 1px solid var(--s-border); border-radius: 16px; padding: 24px 28px 28px; display: flex; flex-direction: column; gap: 22px; box-shadow: 0 30px 80px var(--s-shadow); }
.dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dialog-logo { height: 28px; width: auto; }
.x { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: transparent; border: 0; border-radius: 8px; color: var(--s-text-2); cursor: pointer; }
.x:hover, .btn-2:hover { background: var(--s-hover); }
.dialog-title { display: flex; flex-direction: column; gap: 6px; }
.dialog-title h2 { margin: 0; font-size: 20px; font-weight: 500; }
.dialog-title p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--s-text-2); }
.form { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--s-text-2); }
.field input { min-height: 44px; padding: 0 12px; background: var(--s-editor); border: 1px solid var(--s-border); border-radius: 8px; color: var(--s-text); font-size: 14px; }
.error { margin: 0; font-size: 13px; color: var(--s-danger); }
.lnk { align-self: flex-end; padding: 0; background: transparent; border: 0; color: var(--s-accent-fg); font-size: 13px; cursor: pointer; }
.actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 6px; }
.btn-2 { min-height: 44px; padding: 0 16px; background: transparent; border: 1px solid var(--s-border); border-radius: 8px; color: var(--s-text); font-size: 14px; cursor: pointer; }
.actions .btn-primary { min-height: 44px; padding: 0 18px; border-radius: 8px; font-size: 14px; font-weight: 500; }
</style>

import { createApp } from 'vue';
import App from './App.vue';
import { loadConfig } from './config/app-config.ts';
import { AppContext, setApp } from './composables/app-context.ts';
import { applyTheme, readTheme } from './composables/theme.ts';
import { createAppRouter } from './router/index.ts';
import './styles/theme.css';
import './styles/slide.css';
import './styles/workspace.css';
import './styles/app.css';
import './styles/base.css';

async function start(): Promise<void> {
  applyTheme(readTheme());
  const config = await loadConfig();
  const app = new AppContext(config);
  setApp(app);
  await app.init();
  createApp(App).use(createAppRouter()).mount('#app');
}

start().catch((error: unknown) => {
  const root = document.getElementById('app');
  if (root !== null) root.textContent = error instanceof Error ? error.message : 'No se pudo iniciar Lumia Studio.';
});

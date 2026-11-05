import { createRouter, createWebHistory } from 'vue-router';
import type { Router } from 'vue-router';
import { ACTIONS, useApp } from '../composables/app-context.ts';
import { resetWorkspace } from '../composables/workspace.ts';

export function createAppRouter(): Router {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/sign-in', name: 'sign-in', component: () => import('../pages/SignInPage.vue') },
      { path: '/', name: 'workspace', component: () => import('../pages/WorkspacePage.vue'), meta: { requiresAuth: true } },
      // Public: plays the demo class without signing in.
      { path: '/demo', name: 'demo', component: () => import('../pages/DemoPage.vue') },
      { path: '/:rest(.*)*', redirect: '/' },
    ],
  });
  router.beforeEach((to) => {
    const app = useApp();
    const user = app.user.value;
    if (to.meta.requiresAuth === true && (user === null || !app.can(ACTIONS.view))) {
      resetWorkspace();
      return { name: 'sign-in' };
    }
    return true;
  });
  return router;
}

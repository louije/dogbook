/**
 * Trigger frontend build webhook
 * Call this after any data change that should update the frontend
 */
export async function triggerFrontendBuild() {
  const webhookUrl = process.env.FRONTEND_BUILD_HOOK_URL;

  if (!webhookUrl) {
    console.log('No FRONTEND_BUILD_HOOK_URL configured, skipping frontend build trigger');
    return;
  }

  try {
    console.log('Triggering frontend build...');
    const response = await fetch(webhookUrl, { method: 'POST' });

    if (response.ok) {
      console.log('Frontend build triggered successfully');
    } else {
      console.error('Failed to trigger frontend build:', response.status);
    }
  } catch (error) {
    console.error('Error triggering frontend build:', error);
  }
}

/**
 * Hook that can be added to lists to trigger builds on changes
 */
export const buildTriggerHooks = {
  afterOperation: async ({ operation }: any) => {
    // Trigger build on create, update, or delete
    if (['create', 'update', 'delete'].includes(operation)) {
      await triggerFrontendBuild();
    }
  },
};

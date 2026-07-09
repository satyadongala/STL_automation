import { Router } from 'express';

const router = Router();

router.get('/live-browser', (_req, res) => {
  const enabled = process.env.VNC_ENABLED !== '0';
  const base = process.env.VNC_PUBLIC_URL?.trim();
  res.json({
    enabled: enabled && Boolean(base),
    url: base ? `${base.replace(/\/$/, '')}/vnc.html?autoconnect=true&resize=scale` : null,
    passwordRequired: Boolean(process.env.VNC_PASSWORD),
  });
});

export default router;

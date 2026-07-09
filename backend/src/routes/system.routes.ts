import { Router } from 'express';
import { isLiveBrowserAvailable } from '../vnc-proxy';

const router = Router();

router.get('/live-browser', (req, res) => {
  const enabled = isLiveBrowserAvailable();
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host') || 'localhost:5001';
  const base =
    process.env.VNC_PUBLIC_URL?.trim() ||
    `${proto}://${host}/live-browser`;

  res.json({
    enabled,
    url: enabled
      ? `${base.replace(/\/$/, '')}/vnc.html?autoconnect=true&resize=scale&path=websockify`
      : null,
    passwordRequired: Boolean(process.env.VNC_PASSWORD),
  });
});

export default router;

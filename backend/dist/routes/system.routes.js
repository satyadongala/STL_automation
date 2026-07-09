"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/live-browser', (_req, res) => {
    const enabled = process.env.VNC_ENABLED !== '0';
    const base = process.env.VNC_PUBLIC_URL?.trim();
    res.json({
        enabled: enabled && Boolean(base),
        url: base ? `${base.replace(/\/$/, '')}/vnc.html?autoconnect=true&resize=scale` : null,
        passwordRequired: Boolean(process.env.VNC_PASSWORD),
    });
});
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vnc_proxy_1 = require("../vnc-proxy");
const router = (0, express_1.Router)();
router.get('/live-browser', (req, res) => {
    const enabled = (0, vnc_proxy_1.isLiveBrowserAvailable)();
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host') || 'localhost:5001';
    const base = process.env.VNC_PUBLIC_URL?.trim() ||
        `${proto}://${host}/live-browser`;
    res.json({
        enabled,
        url: enabled
            ? `${base.replace(/\/$/, '')}/vnc.html?autoconnect=true&resize=scale&path=websockify`
            : null,
        passwordRequired: Boolean(process.env.VNC_PASSWORD),
    });
});
exports.default = router;

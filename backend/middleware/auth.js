const Account = require("../models/Account");
const sessions = require("../services/sessions");

const getSessionId = (req) => {
    const cookie = req.headers.cookie
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("cleancity_session="));

    return cookie ? decodeURIComponent(cookie.slice("cleancity_session=".length)) : null;
};

const requireAuth = async (req, res, next) => {
    const sessionId = getSessionId(req);
    const session = sessionId && sessions.get(sessionId);
    if (!session || session.expiresAt <= Date.now()) {
        if (sessionId) sessions.delete(sessionId);
        return res.status(401).json({ success: false, message: "Please sign in to continue" });
    }

    try {
        const account = await Account.findById(session.accountId);
        if (!account || !account.active) {
            sessions.delete(sessionId);
            return res.status(401).json({ success: false, message: "This account is inactive" });
        }

        req.user = {
            id: account._id,
            loginId: account.loginId,
            email: account.email,
            name: account.name,
            role: account.role,
            linkedId: account.linkedId
        };
        req.sessionId = sessionId;
        return next();
    } catch (error) {
        return next(error);
    }
};

const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to perform this action"
        });
    }
    return next();
};

module.exports = { requireAuth, requireRole };

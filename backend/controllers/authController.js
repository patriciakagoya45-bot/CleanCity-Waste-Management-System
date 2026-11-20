const { promisify } = require("node:util");
const { randomBytes, randomUUID, scrypt: scryptCallback, timingSafeEqual } = require("node:crypto");
const Account = require("../models/Account");
const Household = require("../models/Household");
const sessions = require("../services/sessions");

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "cleancity_session";
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const publicAccount = (account) => ({
    id: account._id,
    loginId: account.loginId,
    email: account.email,
    name: account.name,
    role: account.role,
    linkedId: account.linkedId,
    active: account.active
});

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizePhone = (phone) => String(phone || "").replace(/\D/g, "");

const hashPassword = async (password, salt = randomBytes(16).toString("hex")) => ({
    salt,
    hash: (await scrypt(password, salt, 64)).toString("hex")
});

const validateCredentials = ({ email, password }) => {
    if (!normalizeEmail(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))) {
        return "Enter a valid email address";
    }
    if (typeof password !== "string" || password.length < 10 || password.length > 128) {
        return "Password must be between 10 and 128 characters";
    }
    return null;
};

const createAccount = async ({ loginId, email, name, role, linkedId, password }) => {
    const credentialError = validateCredentials({ email, password });
    if (credentialError) {
        const error = new Error(credentialError);
        error.status = 400;
        throw error;
    }

    const credentials = await hashPassword(password);
    return Account.create({
        _id: randomUUID(),
        loginId: String(loginId).trim(),
        email: normalizeEmail(email),
        name: String(name).trim(),
        role,
        linkedId: String(linkedId).trim(),
        passwordHash: credentials.hash,
        passwordSalt: credentials.salt
    });
};

const setSessionCookie = (res, sessionId, secure) => {
    const secureAttribute = secure ? "; Secure" : "";
    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_LIFETIME_MS / 1000}${secureAttribute}`
    );
};

const clearSessionCookie = (res, secure) => {
    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? "; Secure" : ""}`
    );
};

const isSecureRequest = (req) => req.secure || req.get("x-forwarded-proto") === "https";

const handleError = (res, error) => {
    const status = error.status || (error.code === 11000 ? 409 : 500);
    res.status(status).json({
        success: false,
        message: status === 500 ? "Unable to complete the request" : error.message
    });
};

const login = async (req, res) => {
    try {
        const body = req.body || {};
        const identifier = String(body.identifier || "").trim();
        const account = await Account.findOne({
            $or: [
                { loginId: identifier },
                { email: normalizeEmail(identifier) }
            ]
        }).select("+passwordHash +passwordSalt");

        if (!account || !account.active) {
            return res.status(401).json({ success: false, message: "Invalid ID/email or password" });
        }

        const candidate = Buffer.from(
            (await scrypt(String(body.password || ""), account.passwordSalt, 64)).toString("hex"),
            "hex"
        );
        const expected = Buffer.from(account.passwordHash, "hex");
        if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
            return res.status(401).json({ success: false, message: "Invalid ID/email or password" });
        }

        const sessionId = randomBytes(32).toString("hex");
        sessions.set(sessionId, { accountId: account._id, expiresAt: Date.now() + SESSION_LIFETIME_MS });
        setSessionCookie(res, sessionId, isSecureRequest(req));
        return res.status(200).json({ success: true, data: publicAccount(account) });
    } catch (error) {
        return handleError(res, error);
    }
};

const registerHousehold = async (req, res) => {
    let householdId;
    try {
        const { email, password, name, phone, address, division, parish, plan } = req.body || {};
        const credentialError = validateCredentials({ email, password });
        if (credentialError) {
            return res.status(400).json({ success: false, message: credentialError });
        }
        if (![name, phone, address, division, parish, plan].every((value) => String(value || "").trim())) {
            return res.status(400).json({ success: false, message: "Complete all required household details" });
        }

        householdId = `H-${randomUUID()}`;
        await Household.create({
            _id: householdId,
            HouseholdName: String(name).trim(),
            phone: String(phone).trim(),
            division: String(division).trim(),
            parish: String(parish).trim(),
            address: String(address).trim(),
            plan: String(plan).trim(),
            registered_on: new Date()
        });

        try {
            const account = await createAccount({
                loginId: householdId,
                email,
                name,
                role: "household",
                linkedId: householdId,
                password
            });
            return res.status(201).json({ success: true, data: { id: account._id, loginId: householdId } });
        } catch (error) {
            await Household.deleteOne({ _id: householdId });
            throw error;
        }
    } catch (error) {
        return handleError(res, error);
    }
};

const claimHousehold = async (req, res) => {
    try {
        const body = req.body || {};
        const householdId = String(body.householdId || "").trim();
        const household = await Household.findById(householdId);
        if (!household || normalizePhone(household.phone) !== normalizePhone(body.phone)) {
            return res.status(400).json({
                success: false,
                message: "Household ID and registered phone number do not match"
            });
        }

        if (await Account.exists({ $or: [{ loginId: householdId }, { linkedId: householdId, role: "household" }] })) {
            return res.status(409).json({ success: false, message: "This household already has a login" });
        }

        const account = await createAccount({
            loginId: householdId,
            email: body.email,
            name: household.HouseholdName,
            role: "household",
            linkedId: householdId,
            password: body.password
        });
        return res.status(201).json({ success: true, data: { id: account._id, loginId: householdId } });
    } catch (error) {
        return handleError(res, error);
    }
};

const getCurrentAccount = async (req, res) => {
    res.json({ success: true, data: req.user });
};

const logout = async (req, res) => {
    sessions.delete(req.sessionId);
    clearSessionCookie(res, isSecureRequest(req));
    res.json({ success: true, message: "Signed out successfully" });
};

module.exports = {
    createAccount,
    login,
    registerHousehold,
    claimHousehold,
    getCurrentAccount,
    logout,
    publicAccount
};

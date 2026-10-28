import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, api } from "./api";
import { coerceValues, emptyValues, fieldsFromSchema, type SchemaField } from "./schemaForm";
import type { ApplicationSummary, JsonSchema, ProfileResponse, Session } from "./types";

const SESSION_KEY = "baked-demoapp.session";

type Health = "unknown" | "ok" | "down";

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  if (session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Session expired or token was rejected. Sign in again.";
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [authHealth, setAuthHealth] = useState<Health>("unknown");
  const [userHealth, setUserHealth] = useState<Health>("unknown");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback((next: Session) => {
    saveSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback((reason?: string) => {
    saveSession(null);
    setSession(null);
    setError(reason ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      const [auth, user] = await Promise.allSettled([api.authHealth(), api.userHealth()]);
      if (cancelled) return;
      setAuthHealth(auth.status === "fulfilled" ? "ok" : "down");
      setUserHealth(user.status === "fulfilled" ? "ok" : "down");
    };
    void ping();
    const timer = window.setInterval(() => void ping(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark" aria-hidden="true">
            B
          </div>
          <div>
            <h1>Baked Demo</h1>
            <p>A small client for baked-auth and baked-user.</p>
          </div>
        </div>
        <div className="status">
          <span className="pill">
            <span className={`dot ${authHealth}`} />
            baked-auth {authHealth}
          </span>
          <span className="pill">
            <span className={`dot ${userHealth}`} />
            baked-user {userHealth}
          </span>
        </div>
      </header>

      <div className="layout">
        <AuthCard
          session={session}
          notice={notice}
          error={error}
          onNotice={setNotice}
          onError={setError}
          onSignIn={signIn}
          onSignOut={signOut}
        />
        <ProfileCard session={session} onAuthExpired={() => signOut("Please sign in again.")} />
      </div>
    </div>
  );
}

function AuthCard({
  session,
  notice,
  error,
  onNotice,
  onError,
  onSignIn,
  onSignOut,
}: {
  session: Session | null;
  notice: string | null;
  error: string | null;
  onNotice: (value: string | null) => void;
  onError: (value: string | null) => void;
  onSignIn: (session: Session) => void;
  onSignOut: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onError(null);
    onNotice(null);
    setBusy(true);
    try {
      if (mode === "register") {
        await api.register(username, password);
        onNotice(`Registered ${username.toLowerCase()}. Signing you in.`);
      }
      const token = await api.login(username, password);
      const user = await api.me(token.access_token);
      onSignIn({ token: token.access_token, user });
      setPassword("");
    } catch (err) {
      onError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  if (session) {
    return (
      <section className="card">
        <h2>Signed in</h2>
        <p className="lede">Identity from baked-auth <code>GET /v1/users/me</code>.</p>
        {error ? <div className="banner">{error}</div> : null}
        <div className="meta">
          <div>
            <span>Username</span>
            <strong>{session.user.username}</strong>
          </div>
          <div>
            <span>User id</span>
            <strong>{session.user.id}</strong>
          </div>
          <div>
            <span>Roles</span>
            <strong>{session.user.roles.join(", ") || "none"}</strong>
          </div>
          <div>
            <span>Active</span>
            <strong>{session.user.is_active ? "yes" : "no"}</strong>
          </div>
        </div>
        <button className="secondary" type="button" onClick={() => onSignOut()}>
          Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>{mode === "login" ? "Sign in" : "Create an account"}</h2>
      <p className="lede">
        Register hits baked-auth <code>/v1/auth/register</code>. Sign-in uses the OAuth2 password
        flow at <code>/v1/auth/token</code>.
      </p>
      {notice ? <div className="banner ok">{notice}</div> : null}
      {error ? <div className="banner">{error}</div> : null}
      <form onSubmit={handleSubmit}>
        <label>
          Username
          <input
            type="text"
            autoComplete="username"
            minLength={3}
            maxLength={64}
            pattern="[A-Za-z0-9_]+"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <div className="row">
          <button type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Register and sign in"}
          </button>
          <button
            className="secondary"
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Need an account?" : "Have an account?"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ProfileCard({
  session,
  onAuthExpired,
}: {
  session: Session | null;
  onAuthExpired: () => void;
}) {
  const [apps, setApps] = useState<ApplicationSummary[]>([]);
  const [appName, setAppName] = useState<string>("");
  const [schema, setSchema] = useState<JsonSchema | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fields = useMemo(() => (schema ? fieldsFromSchema(schema) : []), [schema]);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        onAuthExpired();
        return;
      }
      setError(messageFrom(err));
    },
    [onAuthExpired],
  );

  useEffect(() => {
    if (!session) {
      setApps([]);
      setAppName("");
      setSchema(null);
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await api.applications(session.token);
        if (cancelled) return;
        setApps(list);
        setAppName((current) => current || list[0]?.name || "");
      } catch (err) {
        if (!cancelled) handleError(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, handleError]);

  useEffect(() => {
    if (!session || !appName) {
      setSchema(null);
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setError(null);
      setBusy(true);
      try {
        const nextSchema = await api.schema(appName);
        let nextProfile: ProfileResponse | null = null;
        try {
          nextProfile = await api.getMyProfile(appName, session.token);
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 404)) {
            throw err;
          }
        }
        if (cancelled) return;
        const nextFields = fieldsFromSchema(nextSchema);
        setSchema(nextSchema);
        setProfile(nextProfile);
        setValues(
          nextProfile
            ? { ...emptyValues(nextFields), ...nextProfile.profile }
            : emptyValues(nextFields),
        );
      } catch (err) {
        if (!cancelled) handleError(err);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, appName, handleError]);

  if (!session) {
    return (
      <section className="card">
        <h2>App profile</h2>
        <p className="lede">
          After you sign in, this panel lists applications from baked-user and lets you create or
          edit the profile document for the selected app.
        </p>
        <p className="hint">
          The browser talks to this app only. Nginx (or the Vite dev proxy) forwards{" "}
          <code>/auth</code> to baked-auth and <code>/user</code> to baked-user, so you do not have
          to fight CORS from a Docker origin.
        </p>
      </section>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!session || !appName) return;
    setBusy(true);
    setError(null);
    try {
      const payload = coerceValues(fields, values);
      const saved = profile
        ? await api.replaceProfile(appName, session.token, payload)
        : await api.createProfile(appName, session.token, payload);
      setProfile(saved);
      setValues({ ...emptyValues(fields), ...saved.profile });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!session || !appName || !profile) return;
    if (!window.confirm(`Delete your ${appName} profile?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteProfile(appName, session.token);
      setProfile(null);
      setValues(emptyValues(fields));
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  const selected = apps.find((item) => item.name === appName);

  return (
    <section className="card">
      <h2>App profile</h2>
      <p className="lede">
        Applications come from baked-user <code>GET /applications</code>. Profiles are stored per
        app and keyed by the auth user id in the JWT.
      </p>
      {error ? <div className="banner">{error}</div> : null}
      <div className="apps">
        {apps.map((item) => (
          <button
            key={item.name}
            type="button"
            className={item.name === appName ? "active" : ""}
            onClick={() => setAppName(item.name)}
          >
            {item.display_name}
          </button>
        ))}
      </div>
      {selected ? <p className="hint">{selected.description}</p> : null}
      {busy && !schema ? <p className="hint">Loading schema…</p> : null}
      {!profile && schema ? (
        <div className="profile-empty">No profile yet for this app. Fill the form and create one.</div>
      ) : null}
      {schema ? (
        <form onSubmit={save}>
          {fields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
            />
          ))}
          <div className="row">
            <button type="submit" disabled={busy}>
              {profile ? "Save profile" : "Create profile"}
            </button>
            {profile ? (
              <button className="danger" type="button" disabled={busy} onClick={() => void remove()}>
                Delete
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      {profile ? (
        <>
          <p className="hint" style={{ marginTop: 18 }}>
            Profile id {profile.id} · updated {new Date(profile.updated_at).toLocaleString()}
          </p>
          <pre>{JSON.stringify(profile, null, 2)}</pre>
        </>
      ) : null}
    </section>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: SchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.inputType === "checkbox") {
    return (
      <label className="checkbox">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        {field.label}
      </label>
    );
  }

  return (
    <label>
      {field.label}
      {field.required ? " *" : ""}
      <input
        type={field.inputType}
        required={field.required}
        minLength={field.minLength}
        maxLength={field.maxLength}
        pattern={field.pattern}
        value={value == null ? "" : String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

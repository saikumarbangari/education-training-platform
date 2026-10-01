import { useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  validateLogin,
  validateRegistration,
} from "../../server/validation.js";

export default function AuthPage({ register = false }) {
  const { user, signIn } = useAuth();
  const location = useLocation();
  const [values, setValues] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const summary = useRef(null);
  const from = location.state?.from;
  const destination =
    typeof from === "string" &&
    /^\/(?!\/)/.test(from) &&
    !["/login", "/register"].includes(from)
      ? from
      : "/learning";
  if (user) return <Navigate replace to={destination} />;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = (register ? validateRegistration : validateLogin)(
      values,
    );
    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setBusy(true);
    try {
      await signIn(register ? "register" : "login", values);
    } catch (error) {
      setErrors(error.errors || {});
      setMessage(error.message);
      requestAnimationFrame(() => summary.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-page">
      <header className="page-heading">
        <p className="eyebrow">Your learning account</p>
        <h1>{register ? "Create an account" : "Sign in"}</h1>
        <p>Keep your courses, progress and attendance together.</p>
      </header>
      <form className="enrol-form" onSubmit={submit} noValidate>
        {(message || Object.keys(errors).length > 0) && (
          <div
            className="error-summary"
            role="alert"
            tabIndex="-1"
            ref={summary}
          >
            {message || "Check the highlighted fields."}
          </div>
        )}
        {(register
          ? ["fullName", "email", "password"]
          : ["email", "password"]
        ).map((name) => (
          <div className="field" key={name}>
            <label htmlFor={name}>
              {
                {
                  fullName: "Full name",
                  email: "Email address",
                  password: "Password",
                }[name]
              }
            </label>
            <input
              id={name}
              name={name}
              type={
                name === "password"
                  ? "password"
                  : name === "email"
                    ? "email"
                    : "text"
              }
              autoComplete={
                name === "password"
                  ? register
                    ? "new-password"
                    : "current-password"
                  : name === "email"
                    ? "username"
                    : "name"
              }
              maxLength={
                name === "password" ? 128 : name === "email" ? 254 : 100
              }
              value={values[name]}
              disabled={busy}
              onChange={(event) =>
                setValues({ ...values, [name]: event.target.value })
              }
              aria-invalid={Boolean(errors[name])}
              aria-describedby={
                errors[name]
                  ? `${name}-error`
                  : name === "password" && register
                    ? "password-hint"
                    : undefined
              }
            />
            {name === "password" && register && (
              <span className="field-hint" id="password-hint">
                Use 10–128 characters. Choose a password you do not use
                elsewhere.
              </span>
            )}
            {errors[name] && (
              <span className="field-error" id={`${name}-error`}>
                {errors[name]}
              </span>
            )}
          </div>
        ))}
        <button className="button" disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
        </button>
        <p className="field-hint">
          On a shared laptop, sign out when you finish. This tab keeps your
          session until you sign out, close it or it expires.
        </p>
        <p>
          {register ? "Already registered? " : "New here? "}
          <Link
            className="text-link"
            to={register ? "/login" : "/register"}
            state={location.state}
            onClick={() => {
              setErrors({});
              setMessage("");
              setValues({ fullName: "", email: "", password: "" });
            }}
          >
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </form>
    </section>
  );
}

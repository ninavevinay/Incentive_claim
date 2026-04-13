import { useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function GoogleSignInButton({ onCredential, disabled = false, text = "continue_with" }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(Boolean(window.google?.accounts?.id));
  const [error, setError] = useState("");

  useEffect(() => {
    if (window.google?.accounts?.id) {
      setReady(true);
      return undefined;
    }

    const pollId = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        setReady(true);
        window.clearInterval(pollId);
      }
    }, 200);

    return () => window.clearInterval(pollId);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    if (!ready || !GOOGLE_CLIENT_ID || disabled) {
      containerRef.current.innerHTML = "";
      return undefined;
    }

    let active = true;
    containerRef.current.innerHTML = "";

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        if (!active) return;
        if (!response?.credential) {
          setError("Google sign-in did not return a credential.");
          return;
        }
        setError("");
        onCredential(response.credential);
      }
    });

    window.google.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      text,
      shape: "pill",
      width: 320
    });

    return () => {
      active = false;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [disabled, onCredential, ready, text]);

  if (!GOOGLE_CLIENT_ID) {
    return <div className="text-sm text-rose-600">Google sign-in is not configured. Set `VITE_GOOGLE_CLIENT_ID`.</div>;
  }

  if (disabled) {
    return (
      <div className="space-y-2">
        <button className="btn btn-primary w-full opacity-60" type="button" disabled>
          Continue with Google
        </button>
        <div className="muted text-sm">Complete the required fields before continuing with your college Google account.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="flex justify-center" />
      {!ready && <div className="muted text-center text-sm">Loading Google sign-in...</div>}
      {error && <div className="text-center text-sm text-rose-600">{error}</div>}
    </div>
  );
}

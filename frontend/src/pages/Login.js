import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  auth,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "../firebase";
import { Button } from "../components/ui/button";
import { onAuthStateChanged } from "firebase/auth";

// Magic link redirect back here → then go to /dashboard
const actionCodeSettings = {
  url: window.location.origin + "/login", // land back on /login first
  handleCodeInApp: true,
};

export default function Login() {
  const [email, setEmail] = useState("");
  const nav = useNavigate();

  // 1) Redirect if already signed in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) nav("/dashboard", { replace: true });
    });
    return unsubscribe;
  }, [nav]);

  // 2) Handle arrival via magic link
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const savedEmail = window.localStorage.getItem("emailForSignIn");
      signInWithEmailLink(auth, savedEmail, window.location.href)
        .then(() => {
          window.localStorage.removeItem("emailForSignIn");
          nav("/dashboard", { replace: true });
        })
        .catch(console.error);
    }
  }, [nav]);

  // 3) Send the magic link
  const handleSubmit = async (e) => {
    e.preventDefault();
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem("emailForSignIn", email);
    alert("✔️ Check your inbox for the login link!");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto p-6 space-y-4 text-center"
    >
      <h2 className="text-2xl font-bold">Premium Login</h2>
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <Button type="submit">Send login link</Button>
    </form>
  );
}
